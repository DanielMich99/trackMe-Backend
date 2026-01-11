import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@app/database';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt'; // Library for password hashing
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { GoogleLoginDto } from './dto/google-login.dto';

@Injectable()
export class AuthService {
  private client: OAuth2Client;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.client = new OAuth2Client(this.configService.get("GOOGLE_CLIENT_ID"));
  }

  // --- Registration ---
  async register(registerDto: LoginDto) {
    // 1. Hash the password (Salting & Hashing)
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(registerDto.password, salt);

    // 2. Create the user
    const user = this.userRepository.create({
      email: registerDto.email,
      password: hashedPassword, // Store hashed password, not the original!
      name: registerDto.name || registerDto.email.split('@')[0], // Use name if provided
    });

    try {
      const savedUser = await this.userRepository.save(user);

      // 3. Create JWT token (same as login)
      const payload = { sub: savedUser.id, email: savedUser.email };

      return {
        accessToken: this.jwtService.sign(payload),
        user: {
          id: savedUser.id,
          email: savedUser.email,
          name: savedUser.name,
        },
      };
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
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  // --- Google Login ---
  async googleLogin(googleLoginDto: GoogleLoginDto) {
    const { token } = googleLoginDto;

    // 1. Verify Google Token
    const ticket = await this.client.verifyIdToken({
      idToken: token,
      audience: this.configService.get("GOOGLE_CLIENT_ID"),
    });
    const ticketPayload = ticket.getPayload();

    if (!ticketPayload) {
      throw new UnauthorizedException('Invalid Google Token: Payload not found');
    }

    const { email, name, sub } = ticketPayload;

    if (!email) {
      throw new UnauthorizedException('Invalid Google Token: Email not found');
    }

    // 2. Check if user exists
    let user = await this.userRepository.findOne({ where: { email } });

    // 3. If not, register user
    if (!user) {
      user = this.userRepository.create({
        email,
        name: name || email.split('@')[0],
        // password is deliberately undefined for Google users
      });
      user = await this.userRepository.save(user);
    }

    // 4. Create JWT token
    const payload = { sub: user.id, email: user.email };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
}