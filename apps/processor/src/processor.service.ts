import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Location, Area, User, Alert } from '@app/database';
import Redis from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ProcessorService {
  private readonly logger = new Logger(ProcessorService.name);
  private readonly REDIS_KEY = 'location_buffer';
  private readonly MIN_DISTANCE_METERS = 1; // Only save if moved more than 50 meters

  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(Area)
    private areaRepository: Repository<Area>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) { }

  // --- 1. Receive message from Kafka and save to Redis ---
  async processLocation(data: any) {
    try {
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
    } catch (error) {
      this.logger.error(`❌ Error processing location for user ${data?.userId}: ${error.message}`, error.stack);
    }
  }

  // --- Real-time geofence check (called on every location update) ---
  private async checkGeofenceImmediate(data: any, groupIds: string[]) {
    if (groupIds.length === 0) return;

    // Create a GeoJSON point for the location
    const point = {
      type: 'Point',
      coordinates: [data.longitude, data.latitude],
    };

    // Find ALL danger zones that contain this point (for any alertOn type)
    this.logger.debug(`[Geofence] Checking user ${data.userId} at ${data.latitude}, ${data.longitude} | Groups: ${groupIds.length}`);
    const currentZones = await this.areaRepository
      .createQueryBuilder('area')
      .where(`ST_Contains(area.polygon, ST_SetSRID(ST_GeomFromGeoJSON(:point), 4326))`, {
        point: JSON.stringify(point),
      })
      .andWhere('area.groupId IN (:...groupIds)', { groupIds })
      .andWhere('(area.targetUserId IS NULL OR area.targetUserId = :userId)', { userId: data.userId })
      .andWhere("area.type IN (:...types)", { types: ['DANGER', 'SAFE'] })
      .getMany();

    this.logger.debug(`[Geofence] Query found ${currentZones.length} zones. IDs: ${currentZones.map(z => z.id).join(', ')}`);

    const currentZoneIds = new Set(currentZones.map(z => z.id));

    // Get previous zones from Redis
    const zoneStateKey = `user:${data.userId}:zones`;
    const previousZonesJson = await this.redis.get(zoneStateKey);
    const previousZoneIds: number[] = previousZonesJson ? JSON.parse(previousZonesJson) : [];

    // Find ENTERED zones (in current but not in previous)
    const enteredZoneIds = [...currentZoneIds].filter(id => !previousZoneIds.includes(id));

    // Find LEFT zones (in previous but not in current)
    const leftZoneIds = previousZoneIds.filter(id => !currentZoneIds.has(id));

    if (enteredZoneIds.length > 0 || leftZoneIds.length > 0) {
      this.logger.debug(`[Geofence] Previous: ${previousZoneIds.join(', ')} | Entered: ${enteredZoneIds.join(', ')} | Left: ${leftZoneIds.join(', ')}`);
    }

    // Get user name once for all alerts
    let userName = '';
    const getUser = async (): Promise<string> => {
      if (!userName) {
        const user = await this.userRepository.findOne({ where: { id: data.userId } });
        userName = user?.name || data.userId;
      }
      return userName;
    };

    // Process ENTER alerts
    for (const zoneId of enteredZoneIds) {
      const zone = currentZones.find(z => z.id === zoneId);
      if (zone) {
        await this.handleZoneAlert(data.userId, zone, 'ENTER', getUser);
      }
    }

    // Process LEAVE alerts
    for (const zoneId of leftZoneIds) {
      // Need to fetch zone info for left zones as they are not in currentZones
      const zone = await this.areaRepository.findOne({ where: { id: zoneId } });
      if (zone) {
        await this.handleZoneAlert(data.userId, zone, 'LEAVE', getUser);
      }
    }

    // Update zone state in Redis (TTL 10 minutes)
    await this.redis.set(zoneStateKey, JSON.stringify([...currentZoneIds]), 'EX', 600);
  }

  // --- Helper: Handle Zone Alert Logic (DRY) ---
  private async handleZoneAlert(
    userId: string,
    zone: Area,
    trigger: 'ENTER' | 'LEAVE',
    getUserFn: () => Promise<string>
  ) {
    if (zone.alertOn !== trigger && zone.alertOn !== 'BOTH') return;

    const alertKey = `alert:${trigger.toLowerCase()}:${userId}:${zone.id}`;

    // Check if user was recently alerted to avoid spam
    const recentlyAlerted = await this.redis.get(alertKey);
    if (recentlyAlerted) return;

    const name = await getUserFn();
    const isDanger = zone.type === 'DANGER';

    // Determine event type and logging details
    let eventType: string;
    if (trigger === 'ENTER') {
      eventType = isDanger ? 'DANGER_ZONE_ENTER' : 'SAFE_ZONE_ENTER';
    } else {
      eventType = isDanger ? 'DANGER_ZONE_LEAVE' : 'SAFE_ZONE_LEAVE';
    }

    const logPrefix = isDanger ? '🚨' : (trigger === 'ENTER' ? '✅' : '⚠️');
    const logType = isDanger ? 'DANGER' : 'SAFE';

    this.logger.warn(`${logPrefix} ${trigger} ALERT: ${name} ${trigger === 'ENTER' ? 'entered' : 'left'} ${logType} ZONE: ${zone.name}`);

    // Create and save alert to DB
    const alert = this.alertRepository.create({
      groupId: zone.groupId,
      userId: userId,
      userName: name,
      areaId: zone.id,
      areaName: zone.name,
      type: eventType as any,
      createdAt: new Date(),
    });
    await this.alertRepository.save(alert);

    // Publish to Redis for real-time frontend updates
    await this.redis.publish('alerts', JSON.stringify({
      type: eventType,
      user: name,
      area: zone.name,
      groupId: zone.groupId,
    }));

    // Set cooldown prevent multiple alerts for 5 minutes
    await this.redis.set(alertKey, '1', 'EX', 300);
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