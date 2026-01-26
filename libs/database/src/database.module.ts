import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Location } from './entities/location.entity';
import { Area } from './entities/area.entity';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { Alert } from './entities/alert.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'myuser',
      password: process.env.DB_PASSWORD || 'mypassword',
      database: process.env.DB_NAME || 'track_me_db',
      entities: [User, Location, Area, Group, GroupMember, Alert],
      synchronize: process.env.NODE_ENV !== 'production', // Safe for production
      ssl: process.env.DB_HOST !== 'localhost' ? {
        rejectUnauthorized: false
      } : false,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule { }