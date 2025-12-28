import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@app/database';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt'; // Library for password hashing
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) { }

  // --- Registration ---
  async register(registerDto: LoginDto) {
    // 1. Hash the password (Salting & Hashing)
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(registerDto.password, salt);

    // 2. Create the user
    const user = this.userRepository.create({
      email: registerDto.email,
      password: hashedPassword, // Store hashed password, not the original!
      name: registerDto.email.split('@')[0], // Temporary name from email
    });

    try {
      await this.userRepository.save(user);
      return { message: 'User registered successfully' };
    } catch (error) {
      // Error code 23505 = duplicate email (already exists)
      if (error.code === '23505') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  // --- Login ---
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // 1. Check if user exists
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Compare entered password with hashed password in DB
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Create JWT token
    // Store user ID and email in the token payload
    const payload = { sub: user.id, email: user.email };

    return {
      access_token: this.jwtService.sign(payload), // Digital signature
      userId: user.id, // Also return ID for convenience
    };
  }
}