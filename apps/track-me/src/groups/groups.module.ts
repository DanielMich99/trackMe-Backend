import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group, User, GroupMember } from '@app/database';

@Module({
  imports: [TypeOrmModule.forFeature([Group, User, GroupMember])],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule { }
