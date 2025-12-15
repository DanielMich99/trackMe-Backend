import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location, Area, User } from '@app/database';
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
    @InjectRepository(User)
    private userRepository: Repository<User>,
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

    const locationsToSave: Location[] = [];

    // 1. Group by userId to minimize DB queries
    const locationsByUserId = new Map<string, any[]>();
    for (const item of rawData) {
      const parsed = JSON.parse(item);
      if (!locationsByUserId.has(parsed.userId)) {
        locationsByUserId.set(parsed.userId, []);
      }
      locationsByUserId.get(parsed.userId)!.push(parsed);
    }

    // 2. Validate users existence
    const uniqueUserIds = Array.from(locationsByUserId.keys());
    if (uniqueUserIds.length > 0) {
      const validUsers = await this.userRepository.createQueryBuilder('user')
        .where('user.id IN (:...ids)', { ids: uniqueUserIds })
        .select('user.id')
        .getMany();

      const validUserIdsSet = new Set(validUsers.map(u => u.id));

      // 3. Filter and prepare locations for valid users only
      for (const [userId, userLocations] of locationsByUserId.entries()) {
        if (validUserIdsSet.has(userId)) {
          userLocations.forEach(parsed => {
            locationsToSave.push(this.locationRepository.create({
              latitude: parsed.latitude,
              longitude: parsed.longitude,
              userId: parsed.userId,
              timestamp: parsed.timestamp,
              geom: {
                type: 'Point',
                coordinates: [parsed.longitude, parsed.latitude],
              } as any,
            }));
          });
        } else {
          this.logger.warn(`⚠️ Skipping ${userLocations.length} locations for non-existent User ID: ${userId}`);
        }
      }
    }

    if (locationsToSave.length === 0) {
      this.logger.log(`ℹ️ No valid locations to save after validation.`);
      return;
    }

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

  // --- 3. בדיקת Geofencing משופרת (Safe/Danger Zones) ---
  private async checkGeofences(locations: Location[]) {
    for (const location of locations) {
      // 1. קודם כל, נביא את המשתמש עם הקבוצות שלו כדי שנדע אילו אזורים רלוונטיים אליו
      const user = await this.userRepository.findOne({
        where: { id: location.userId },
        relations: ['memberships', 'memberships.group'],
      });

      if (!user || !user.memberships || user.memberships.length === 0) continue;

      const groupIds = user.memberships.map(m => m.group.id);

      // 2. נחפש אזורים ש:
      //    (א) מכילים את הנקודה הנוכחית
      //    (ב) שייכים לאחת הקבוצות של המשתמש
      //    (ג) (אופציונלי) מיועדים ספציפית למשתמש הזה או לכולם (NULL)
      const triggeringAreas = await this.areaRepository
        .createQueryBuilder('area')
        .where(`ST_Contains(area.polygon, ST_GeomFromGeoJSON(:point))`, {
          point: JSON.stringify(location.geom)
        })
        .andWhere('area.groupId IN (:...groupIds)', { groupIds })
        // תמיכה ב-Target User ספציפי (או NULL לכולם)
        .andWhere('(area.targetUserId IS NULL OR area.targetUserId = :userId)', { userId: user.id })
        .getMany();

      // לוגיקה:
      // אם אזור הוא DANGER ונכנסנו אליו -> התראה
      // אם אזור הוא SAFE ויצאנו ממנו -> התראה (זה יותר מורכב, דורש לדעת מצב קודם.
      // בגרסה הפשוטה הזו נתמקד ב-"נמצא מחוץ לאזור בטוח" או "נכנס לאזור מסוכן")

      // בדיקת "נמצא בתוך אזור מסוכן"
      const dangerZones = triggeringAreas.filter(a => a.type === 'DANGER');
      dangerZones.forEach(area => {
        if (area.alertOn === 'ENTER' || area.alertOn === 'BOTH') {
          this.logger.warn(`🚨 ALERT: User ${user.name} is INSIDE DANGER ZONE: ${area.name}`);
          // כאן היינו שולחים פוש / סוקט
          this.redis.publish('alerts', JSON.stringify({
            type: 'DANGER_ZONE_ENTER',
            user: user.name,
            area: area.name,
            groupId: area.groupId
          }));
        }
      });

      // בדיקת "נמצא מחוץ לאזור בטוח"
      // זה קצת טריקי: אנחנו צריכים לדעת אם הוא *אמור* להיות באזור בטוח וכרגע הוא לא באף אחד מהם.
      // נשמור את זה לשלב הבא כי זה מחייב בדיקה של "כל האזורים הבטוחים" שלא הוחזרו בשאילתה.
    }
  }
}