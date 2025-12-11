import { Inject, Injectable, Logger } from '@nestjs/common';
import { CreateLocationDto } from './dto/create-location.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location, User } from '@app/database';
import Redis from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class LocationService {
  // Logger עוזר לנו לראות הודעות יפות בטרמינל
  private readonly logger = new Logger(LocationService.name);
  // מפתח קבוע לשמירה ברדיס
  private readonly REDIS_KEY = 'location_buffer';

  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis, // כאן אנחנו מקבלים את רדיס
  ) { }

  // --- Fast Path: כתיבה מהירה לרדיס ---
  async create(createLocationDto: CreateLocationDto) {
    // 1. הופכים את המידע ל-JSON String כדי לשמור ברדיס
    const locationString = JSON.stringify({
      ...createLocationDto,
      timestamp: new Date(), // מוסיפים זמן עכשיו, כי השמירה האמיתית תתעכב
    });

    // 2. דוחפים לסוף הרשימה (Right Push)
    await this.redis.rpush(this.REDIS_KEY, locationString);

    // 3. מחזירים אובייקט מדמה, כדי שהלקוח יקבל תשובה מיידית
    return {
      ...createLocationDto,
      timestamp: new Date(),
      // שים לב: אין ID ואין geom אמיתי כרגע, וזה בסדר לריל-טיים
    };
  }

  // --- Slow Path: תהליך רקע לשמירה ב-DB ---
  // הפונקציה הזו תרוץ אוטומטית כל 10 שניות
  @Cron(CronExpression.EVERY_10_SECONDS)
  async syncLocationsToDatabase() {
    // 1. בדיקה האם יש בכלל נתונים?
    const length = await this.redis.llen(this.REDIS_KEY);
    if (length === 0) return;

    this.logger.log(`⏳ Flushing ${length} locations from Redis to DB...`);

    // 2. שליפת כל הנתונים ומחיקת הבאפר
    // (לוקחים הכל מרדיס ומנקים אותו כדי שיהיה מוכן לנגלה הבאה)
    const rawData = await this.redis.lrange(this.REDIS_KEY, 0, -1);
    await this.redis.del(this.REDIS_KEY);

    // 3. המרה חזרה מ-JSON לאובייקטים שמתאימים ל-DB
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

    // 4. שמירה מרוכזת (Bulk Insert) - שאילתה אחת גדולה!
    await this.locationRepository.save(locationsToSave);

    this.logger.log(`✅ Successfully saved ${locationsToSave.length} locations to Postgres.`);
  }

  // --- פונקציות עזר (ללא שינוי) ---

  findAll() {
    return this.locationRepository.find();
  }

  async createDummyUser() {
    const user = this.userRepository.create({
      name: 'Test User',
      email: `test-${Date.now()}@test.com`,
    });
    return await this.userRepository.save(user);
  }

  async assignGroupToUser(userId: string, groupId: string) {
    return await this.userRepository.update(userId, { groupId });
  }
}