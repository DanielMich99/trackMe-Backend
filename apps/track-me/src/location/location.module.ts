import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // <-- הוספה חשובה
import { LocationService } from './location.service';
import { LocationController } from './location.controller';
import { Location, User } from '@app/database'; // <-- הוספה חשובה
import { LocationGateway } from './location.gateway';

@Module({
  imports: [
    // השורה הזו אומרת לנסט: "המודול הזה הולך להשתמש בטבלאות האלה"
    TypeOrmModule.forFeature([Location, User]), 
  ],
  controllers: [LocationController],
  providers: [LocationService, LocationGateway],
})
export class LocationModule {}