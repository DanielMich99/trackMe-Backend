import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group, User, GroupMember, Location } from '@app/database';
import Redis from 'ioredis';

import { LocationModule } from '../location/location.module';

@Module({
  imports: [TypeOrmModule.forFeature([Group, User, GroupMember, Location]), LocationModule],
  controllers: [GroupsController],
  providers: [
    GroupsService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => new Redis({ host: 'localhost', port: 6379 }),
    },
  ],
})
export class GroupsModule { }
