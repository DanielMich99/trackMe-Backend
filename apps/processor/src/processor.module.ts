import { Module } from '@nestjs/common';
import { ProcessorController } from './processor.controller';
import { ProcessorService } from './processor.service';
import { DatabaseModule, Location, User, Area, Alert } from '@app/database';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';

@Module({
  imports: [
    // 1. חיבור לדאטה בייס (דרך הספרייה המשותפת)
    DatabaseModule,
    // 2. רישום הטבלאות שאנחנו הולכים לעבוד איתן
    TypeOrmModule.forFeature([Location, User, Area, Alert]),
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
        if (process.env.REDIS_URL) {
          return new Redis(process.env.REDIS_URL);
        }
        return new Redis({
          host: 'localhost',
          port: 6379,
        });
      },
    },
  ],
})
export class ProcessorModule { }