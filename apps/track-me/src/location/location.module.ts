import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // <-- הוספה חשובה
import { LocationService } from './location.service';
import { LocationController } from './location.controller';
import { Location, User, Area } from '@app/database'; // <-- הוספה חשובה
import { LocationGateway } from './location.gateway';
import Redis from 'ioredis';

@Module({
  imports: [
    // השורה הזו אומרת לנסט: "המודול הזה הולך להשתמש בטבלאות האלה"
    TypeOrmModule.forFeature([Location, User, Area]),
  ],
  controllers: [LocationController],
  providers: [
    LocationService,
    LocationGateway,
    {
      provide: 'REDIS_CLIENT', // זה השם שבו נשתמש כדי לבקש את החיבור ב-Service
      useFactory: () => {
        return new Redis({
          host: 'localhost', // אנחנו מתחברים לדוקר שרץ על המחשב שלנו
          port: 6379,
        });
      },
    },
  ],
})
export class LocationModule { }