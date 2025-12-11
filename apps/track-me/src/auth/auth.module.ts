import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@app/database'; // הטבלה שלנו
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    // 1. גישה לדאטה בייס
    TypeOrmModule.forFeature([User]),

    // 2. ספריית הדרכונים (Passport)
    PassportModule,

    // 3. הגדרת ה-JWT
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'mySecretKey123', // בייצור נשים את זה ב-.env
      signOptions: { expiresIn: '7d' }, // הטוקן תקף לשבוע
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService], // נרצה להשתמש בזה במקומות אחרים
})
export class AuthModule { }