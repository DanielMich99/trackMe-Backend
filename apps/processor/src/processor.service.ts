import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Location, Area, User } from '@app/database';
import Redis from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ProcessorService {
  private readonly logger = new Logger(ProcessorService.name);
  private readonly REDIS_KEY = 'location_buffer';
  private readonly MIN_DISTANCE_METERS = 50; // Only save if moved more than 50 meters

  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(Area)
    private areaRepository: Repository<Area>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) { }

  // --- 1. Receive message from Kafka and save to Redis ---
  async processLocation(data: any) {
    const locationString = JSON.stringify(data);

    // 1. Push to buffer (for batch DB save)
    await this.redis.rpush(this.REDIS_KEY, locationString);

    // 2. Update read cache - store latest location for fast retrieval
    await this.redis.set(`user:${data.userId}:latest_location`, locationString);

    // 3. Get user's approved groups (cache first, then DB)
    const groupIds = await this.getUserGroupIds(data.userId);

    // 4. Publish for real-time WebSocket updates (include groupIds to avoid DB query in gateway)
    const messageWithGroups = JSON.stringify({ ...data, groupIds });
    await this.redis.publish('live_updates', messageWithGroups);

    // 5. Check geofences immediately for real-time alerts
    await this.checkGeofenceImmediate(data, groupIds);

    this.logger.log(`📥 Processor received location for User ${data.userId} (cached + buffered)`);
  }

  // --- Real-time geofence check (called on every location update) ---
  private async checkGeofenceImmediate(data: any, groupIds: string[]) {
    if (groupIds.length === 0) return;

    // Create a GeoJSON point for the location
    const point = {
      type: 'Point',
      coordinates: [data.longitude, data.latitude],
    };

    // Find danger zones that contain this point
    const dangerZones = await this.areaRepository
      .createQueryBuilder('area')
      .where(`ST_Contains(area.polygon, ST_GeomFromGeoJSON(:point))`, {
        point: JSON.stringify(point),
      })
      .andWhere('area.groupId IN (:...groupIds)', { groupIds })
      .andWhere('(area.targetUserId IS NULL OR area.targetUserId = :userId)', { userId: data.userId })
      .andWhere("area.type = 'DANGER'")
      .getMany();

    for (const area of dangerZones) {
      if (area.alertOn === 'ENTER' || area.alertOn === 'BOTH') {
        // Check cooldown: don't spam alerts for same user/area within 5 minutes
        const alertKey = `alert:${data.userId}:${area.id}`;
        const recentlyAlerted = await this.redis.get(alertKey);

        if (!recentlyAlerted) {
          // Get user name for the alert
          const user = await this.userRepository.findOne({ where: { id: data.userId } });
          const userName = user?.name || data.userId;

          this.logger.warn(`🚨 REAL-TIME ALERT: ${userName} entered DANGER ZONE: ${area.name}`);

          await this.redis.publish('alerts', JSON.stringify({
            type: 'DANGER_ZONE_ENTER',
            user: userName,
            area: area.name,
            groupId: area.groupId,
          }));

          // Set cooldown (5 minutes = 300 seconds)
          await this.redis.set(alertKey, '1', 'EX', 300);
        }
      }
    }
  }

  // --- Helper: Get user's group IDs from cache or DB ---
  private async getUserGroupIds(userId: string): Promise<string[]> {
    const cacheKey = `user:${userId}:groups`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.debug(`📦 Cache HIT for user ${userId} groups`);
      return JSON.parse(cached);
    }

    // Cache miss - fetch from DB
    this.logger.debug(`📦 Cache MISS for user ${userId} groups - fetching from DB`);
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['memberships', 'memberships.group'],
    });

    const groupIds = user?.memberships
      ?.filter((m) => m.status === 'APPROVED')
      .map((m) => m.group.id) ?? [];

    // Store in cache (no TTL - invalidated explicitly on membership change)
    await this.redis.set(cacheKey, JSON.stringify(groupIds));

    return groupIds;
  }

  // --- 2. Background process (Cron) that flushes to DB ---
  @Cron(CronExpression.EVERY_10_SECONDS)
  async syncLocationsToDatabase() {
    const rawData = await this.popAllFromBuffer();
    if (rawData.length === 0) return;

    this.logger.log(`⏳ Processor flushing ${rawData.length} locations...`);

    const locationsByUserId = this.groupByUserId(rawData);
    const uniqueUserIds = Array.from(locationsByUserId.keys());

    if (uniqueUserIds.length === 0) return;

    const validUserIdsSet = await this.getValidUserIds(uniqueUserIds);
    const lastLocations = await this.getLastLocations(validUserIdsSet);
    const { locationsToSave, skippedCount } = this.filterByDistance(
      locationsByUserId,
      validUserIdsSet,
      lastLocations,
    );

    if (skippedCount > 0) {
      this.logger.log(`📍 Skipped ${skippedCount} locations (user didn't move ${this.MIN_DISTANCE_METERS}m)`);
    }

    if (locationsToSave.length === 0) {
      this.logger.log(`ℹ️ No valid locations to save after validation.`);
      return;
    }

    const savedLocations = await this.locationRepository.save(locationsToSave);
    this.logger.log(`✅ Processor saved ${savedLocations.length} locations to DB.`);

    await this.checkGeofences(savedLocations);
  }

  // --- Helper: Atomically pop all items from Redis buffer ---
  private async popAllFromBuffer(): Promise<string[]> {
    const multi = this.redis.multi();
    multi.lrange(this.REDIS_KEY, 0, -1);
    multi.del(this.REDIS_KEY);
    const results = await multi.exec();
    return (results?.[0]?.[1] as string[]) ?? [];
  }

  // --- Helper: Group raw location data by userId ---
  private groupByUserId(rawData: string[]): Map<string, any[]> {
    const locationsByUserId = new Map<string, any[]>();
    for (const item of rawData) {
      const parsed = JSON.parse(item);
      if (!locationsByUserId.has(parsed.userId)) {
        locationsByUserId.set(parsed.userId, []);
      }
      locationsByUserId.get(parsed.userId)!.push(parsed);
    }
    return locationsByUserId;
  }

  // --- Helper: Validate which user IDs exist in the database ---
  private async getValidUserIds(userIds: string[]): Promise<Set<string>> {
    const validUsers = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id IN (:...ids)', { ids: userIds })
      .select('user.id')
      .getMany();
    return new Set(validUsers.map((u) => u.id));
  }

  // --- Helper: Get last known location for each user (single query) ---
  private async getLastLocations(validUserIdsSet: Set<string>): Promise<Map<string, Location>> {
    if (validUserIdsSet.size === 0) return new Map();

    const lastLocationsArray = await this.locationRepository
      .createQueryBuilder('location')
      .where('location.userId IN (:...ids)', { ids: Array.from(validUserIdsSet) })
      .distinctOn(['location.userId'])
      .orderBy('location.userId')
      .addOrderBy('location.timestamp', 'DESC')
      .getMany();

    return new Map(lastLocationsArray.map((loc) => [loc.userId, loc]));
  }

  // --- Helper: Filter locations by minimum distance moved ---
  private filterByDistance(
    locationsByUserId: Map<string, any[]>,
    validUserIdsSet: Set<string>,
    lastLocations: Map<string, Location>,
  ): { locationsToSave: Location[]; skippedCount: number } {
    const locationsToSave: Location[] = [];
    let skippedCount = 0;

    for (const [userId, userLocations] of locationsByUserId.entries()) {
      if (!validUserIdsSet.has(userId)) {
        this.logger.warn(`⚠️ Skipping ${userLocations.length} locations for non-existent User ID: ${userId}`);
        continue;
      }

      // Sort by timestamp to ensure correct order for distance calculation
      userLocations.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      let currentLastLocation = lastLocations.get(userId);

      for (const parsed of userLocations) {
        if (currentLastLocation) {
          const distance = this.calculateDistance(
            currentLastLocation.latitude,
            currentLastLocation.longitude,
            parsed.latitude,
            parsed.longitude,
          );

          if (distance < this.MIN_DISTANCE_METERS) {
            skippedCount++;
            continue;
          }
        }

        const newLocation = this.locationRepository.create({
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          userId: parsed.userId,
          timestamp: parsed.timestamp,
          geom: {
            type: 'Point',
            coordinates: [parsed.longitude, parsed.latitude],
          } as any,
        });
        locationsToSave.push(newLocation);
        currentLastLocation = newLocation as Location;
      }
    }

    return { locationsToSave, skippedCount };
  }

  // --- Helper: Calculate distance between two GPS coordinates (Haversine formula) ---
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // --- 3. Geofencing check (Safe/Danger Zones) ---
  private async checkGeofences(locations: Location[]) {
    for (const location of locations) {
      const user = await this.userRepository.findOne({
        where: { id: location.userId },
        relations: ['memberships', 'memberships.group'],
      });

      if (!user || !user.memberships || user.memberships.length === 0) continue;

      const groupIds = user.memberships.map(m => m.group.id);

      const triggeringAreas = await this.areaRepository
        .createQueryBuilder('area')
        .where(`ST_Contains(area.polygon, ST_GeomFromGeoJSON(:point))`, {
          point: JSON.stringify(location.geom)
        })
        .andWhere('area.groupId IN (:...groupIds)', { groupIds })
        .andWhere('(area.targetUserId IS NULL OR area.targetUserId = :userId)', { userId: user.id })
        .getMany();

      // Check if user is inside a danger zone
      const dangerZones = triggeringAreas.filter(a => a.type === 'DANGER');
      dangerZones.forEach(area => {
        if (area.alertOn === 'ENTER' || area.alertOn === 'BOTH') {
          this.logger.warn(`🚨 ALERT: User ${user.name} is INSIDE DANGER ZONE: ${area.name}`);
          this.redis.publish('alerts', JSON.stringify({
            type: 'DANGER_ZONE_ENTER',
            user: user.name,
            area: area.name,
            groupId: area.groupId
          }));
        }
      });

      // TODO: Check if user is outside a safe zone (requires tracking previous state)
    }
  }

  // --- 4. Cleanup old locations (runs every 10 minutes, deletes locations older than 10 minutes) ---
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupOldLocations() {
    const cutoffTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

    const result = await this.locationRepository.delete({
      timestamp: LessThan(cutoffTime),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(`🧹 Cleanup: Deleted ${result.affected} old locations (older than 10 minutes)`);
    }
  }
}