import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location, Area } from '@app/database'; // שים לב לייבוא הנכון
import Redis from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ProcessorService {
  private readonly logger = new Logger(ProcessorService.name);
  private readonly REDIS_KEY = 'location_buffer';

  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(Area)
    private areaRepository: Repository<Area>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) { }

  // --- 1. קבלת הודעה מקפקא ושמירה ברדיס ---
  async processLocation(data: any) {
    // data מגיע כ-Object, אנחנו צריכים להפוך ל-String בשביל רדיס
    const locationString = JSON.stringify(data);

    // דחיפה לבאפר
    await this.redis.rpush(this.REDIS_KEY, locationString);

    // לוג כדי שנראה שזה עובד
    this.logger.log(`📥 Processor received location for User ${data.userId}`);
  }

  // --- 2. תהליך הרקע (Cron) שפורק ל-DB ---
  @Cron(CronExpression.EVERY_10_SECONDS)
  async syncLocationsToDatabase() {
    const length = await this.redis.llen(this.REDIS_KEY);
    if (length === 0) return;

    this.logger.log(`⏳ Processor flushing ${length} locations...`);

    const rawData = await this.redis.lrange(this.REDIS_KEY, 0, -1);
    await this.redis.del(this.REDIS_KEY);

    const locationsToSave = rawData.map((item) => {
      const parsed = JSON.parse(item);
      return this.locationRepository.create({
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        userId: parsed.userId,
        timestamp: parsed.timestamp,
        geom: {
          type: 'Point',
          coordinates: [parsed.longitude, parsed.latitude],
        } as any,
      });
    });

    const savedLocations = await this.locationRepository.save(locationsToSave);
    this.logger.log(`✅ Processor saved ${savedLocations.length} locations to DB.`);

    // --- התוספת החדשה: דיווח בזמן אמת ---
    for (const location of savedLocations) {
      // אנחנו מפרסמים לערוץ שנקרא 'live_updates'
      await this.redis.publish('live_updates', JSON.stringify(location));
    }

    // הפעלת בדיקת אזורים
    await this.checkGeofences(savedLocations);
  }

  // --- 3. בדיקת Geofencing ---
  private async checkGeofences(locations: Location[]) {
    for (const location of locations) {
      const matchingAreas = await this.areaRepository
        .createQueryBuilder('area')
        .where(`ST_Contains(area.polygon, ST_GeomFromGeoJSON(:point))`, {
          point: JSON.stringify(location.geom)
        })
        .andWhere('area.groupId = :groupId', {
          groupId: 'my-family' // עדיין הארד-קוד, נטפל בזה בהמשך
        })
        .getMany();

      if (matchingAreas.length > 0) {
        matchingAreas.forEach(area => {
          this.logger.warn(`🚨 PROCESSOR ALERT: User ${location.userId} is inside ${area.name}!`);
        });
      }
    }
  }
}