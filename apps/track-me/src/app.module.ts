import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@app/database';
import { LocationModule } from './location/location.module';
import { AreasModule } from './areas/areas.module';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
import { SosModule } from './sos/sos.module';
import { AlertsModule } from './alerts/alerts.module';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule, LocationModule, AreasModule, AuthModule, GroupsModule, SosModule, AlertsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }