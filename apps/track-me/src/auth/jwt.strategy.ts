import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            // 1. איפה הטוקן מסתתר? בכותרת Authorization
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            // 2. האם לקבל טוקן שפג תוקפו? לא.
            ignoreExpiration: false,
            // 3. המפתח הסודי (חייב להיות זהה למה שהגדרנו ב-Module)
            secretOrKey: process.env.JWT_SECRET || 'mySecretKey123',
        });
    }

    // הפונקציה הזו רצה אוטומטית אם הטוקן תקין
    async validate(payload: any) {
        // מה שאנחנו מחזירים פה ייכנס לתוך "request.user" ב-Controller
        return { userId: payload.sub, email: payload.email, groupId: payload.groupId };
    }
}