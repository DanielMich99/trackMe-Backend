import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@app/database'; // הייבוא החכם מהספרייה שיצרנו
import { LocationModule } from './location/location.module';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule, LocationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }