import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Location } from './entities/location.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5435, // <-- שים לב ששינינו את זה מ-5432 ל-5435
      username: 'myuser',
      password: 'mypassword',
      database: 'track_me_db',
      entities: [User, Location],
      synchronize: true,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}