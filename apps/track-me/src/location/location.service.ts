import { Injectable } from '@nestjs/common';
import { CreateLocationDto } from './dto/create-location.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location, User } from '@app/database'; // הייבוא מהספרייה המשותפת שלך

@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createLocationDto: CreateLocationDto) {
    // 1. קודם כל, נבדוק שהמשתמש קיים (אופציונלי אך מומלץ)
    // בפועל, אם ה-User ID לא קיים, ה-DB יזרוק שגיאה בגלל Foreign Key, אבל זה יותר נקי
    
    // 2. יצירת האובייקט לשמירה
    const location = this.locationRepository.create({
      latitude: createLocationDto.latitude,
      longitude: createLocationDto.longitude,
      userId: createLocationDto.userId,
      // PostGIS Magic: יצירת אובייקט GeoJSON של נקודה
      geom: {
        type: 'Point',
        coordinates: [createLocationDto.longitude, createLocationDto.latitude], 
      } as any, // ה-TypeORM לפעמים מתלונן על הטיפוסים של GeoJSON, ה-any פותר את זה נקודתית
    });

    return await this.locationRepository.save(location);
  }

  findAll() {
    return this.locationRepository.find();
  }

  // הוסף את זה בתוך המחלקה LocationService
  async createDummyUser() {
    const user = this.userRepository.create({
      name: 'Test User',
      email: 'test-${Date.now()}@test.com',
    });
    return await this.userRepository.save(user);
  }

  // הוסף את זה למחלקה
  async assignGroupToUser(userId: string, groupId: string) {
    return await this.userRepository.update(userId, { groupId });
  }
}