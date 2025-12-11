import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices'; // <-- הוספה
import { LocationService } from './location.service';
import { LocationController } from './location.controller';
import { LocationGateway } from './location.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location, User, Area } from '@app/database';
import Redis from 'ioredis';
// (מחק את הייבוא של Redis אם הוא שם, אנחנו מחליפים אותו בקפקא)

@Module({
  imports: [
    TypeOrmModule.forFeature([Location, User, Area]),
    // הגדרת הלקוח של קפקא
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE', // השם שדרכו נפנה אליו
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: ['localhost:9092'], // הכתובת של קפקא בדוקר
          },
          consumer: {
            groupId: 'track-me-producer', // מזהה ייחודי
          },
        },
      },
    ]),
  ],
  controllers: [LocationController],
  providers: [
    LocationService,
    LocationGateway,
    // --- הוספנו את רדיס חזרה (בשביל ה-Gateway) ---
    {
      provide: 'REDIS_SUB', // שם מיוחד למנוי
      useFactory: () => {
        return new Redis({ host: 'localhost', port: 6379 });
      },
    },
  ],
})
export class LocationModule { }