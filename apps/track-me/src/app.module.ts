import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@app/database'; // הייבוא החכם מהספרייה שיצרנו
import { LocationModule } from './location/location.module';
import { AreasModule } from './areas/areas.module';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule, LocationModule, AreasModule, AuthModule, GroupsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }