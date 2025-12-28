import { Module } from '@nestjs/common';
import { ProcessorController } from './processor.controller';
import { ProcessorService } from './processor.service';
import { DatabaseModule, Location, User, Area } from '@app/database';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';

@Module({
  imports: [
    // 1. חיבור לדאטה בייס (דרך הספרייה המשותפת)
    DatabaseModule,
    // 2. רישום הטבלאות שאנחנו הולכים לעבוד איתן
    TypeOrmModule.forFeature([Location, User, Area]),
    // 3. הפעלת מנגנון התזמון (Cron)
    ScheduleModule.forRoot(),
  ],
  controllers: [ProcessorController],
  providers: [
    ProcessorService,
    // 4. הגדרת חיבור ל-Redis (בדיוק כמו שהיה ב-API)
    // זה יוצר לי סינגלטון של רדיס שאותו אני מזריק לסרביס
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis({
          host: 'localhost', // בדוקר נשנה את זה ל-redis
          port: 6379,
        });
      },
    },
  ],
})
export class ProcessorModule { }