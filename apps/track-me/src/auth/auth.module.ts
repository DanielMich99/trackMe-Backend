import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@app/database'; // Our User table
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    // 1. Database access
    TypeOrmModule.forFeature([User]),

    // 2. Passport library for authentication
    PassportModule,

    // 3. JWT configuration
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'mySecretKey123', // In production, use .env file
      signOptions: { expiresIn: '7d' }, // Token valid for 7 days
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService], // Export for use in other modules
})
export class AuthModule { }