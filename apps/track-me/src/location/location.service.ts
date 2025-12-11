import { Inject, Injectable, Logger } from '@nestjs/common';
import { CreateLocationDto } from './dto/create-location.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location, User, Area } from '@app/database';
import Redis from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class LocationService {
  // Logger עוזר לנו לראות הודעות יפות בטרמינל
  private readonly logger = new Logger(LocationService.name);
  // מפתח קבוע לשמירה ברדיס
  private readonly REDIS_KEY = 'location_buffer';

  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Area)
    private areaRepository: Repository<Area>,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) { }

  // --- Fast Path: כתיבה מהירה לרדיס ---
  async create(createLocationDto: CreateLocationDto) {
    // במקום לשמור ל-DB או Redis, אנחנו שולחים "אירוע"
    this.kafkaClient.emit('location_update', {
      ...createLocationDto,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Sent location to Kafka: User ${createLocationDto.userId}`);

    // מחזירים תשובה פיקטיבית ללקוח (הוא לא צריך לחכות לשמירה)
    return { status: 'sent_to_queue' };
  }

  // --- פונקציות עזר (ללא שינוי) ---

  findAll() { return []; }

  async createDummyUser() { return null; }
  async assignGroupToUser() { return null; }
}