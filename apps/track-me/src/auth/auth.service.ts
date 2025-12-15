import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@app/database';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt'; // הספרייה להצפנה
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) { }

  // --- הרשמה ---
  async register(registerDto: LoginDto) {
    // 1. הצפנת הסיסמה (Salting & Hashing)
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(registerDto.password, salt);

    // 2. יצירת המשתמש
    const user = this.userRepository.create({
      email: registerDto.email,
      password: hashedPassword, // שומרים את המוצפן, לא את המקור!
      name: registerDto.email.split('@')[0], // שם זמני
    });

    try {
      await this.userRepository.save(user);
      return { message: 'User registered successfully' };
    } catch (error) {
      // קוד 23505 = אימייל כפול (כבר קיים)
      if (error.code === '23505') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  // --- התחברות ---
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // 1. בדיקה אם המשתמש קיים
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. השוואת הסיסמה שהוזנה לסיסמה המוצפנת ב-DB
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. יצירת הטוקן (JWT)
    // בתוך הטוקן נשמור את ה-ID והאימייל (Payload)
    const payload = { sub: user.id, email: user.email };

    return {
      access_token: this.jwtService.sign(payload), // החתימה הדיגיטלית
      userId: user.id, // מחזירים גם את ה-ID לנוחות
    };
  }
}