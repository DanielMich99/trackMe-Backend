import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            // 1. Where is the token located? In the Authorization header
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            // 2. Should we accept expired tokens? No.
            ignoreExpiration: false,
            // 3. Secret key (must match what we defined in Module)
            secretOrKey: process.env.JWT_SECRET || 'mySecretKey123',
        });
    }

    // This function runs automatically if the token is valid
    async validate(payload: any) {
        // What we return here will be injected into "request.user" in the Controller
        return { userId: payload.sub, email: payload.email, groupId: payload.groupId };
    }
}