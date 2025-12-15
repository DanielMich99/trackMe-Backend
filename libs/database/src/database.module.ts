import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Location } from './entities/location.entity';
import { Area } from './entities/area.entity';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5435'),
      username: 'myuser',
      password: 'mypassword',
      database: 'track_me_db',
      entities: [User, Location, Area, Group, GroupMember],
      synchronize: true,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule { }