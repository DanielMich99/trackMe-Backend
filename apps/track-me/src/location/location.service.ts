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
  // Logger helps display formatted messages in the terminal
  private readonly logger = new Logger(LocationService.name);
  // Constant key for storing in Redis
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

  // --- Fast Path: Quick write to Kafka ---
  async create(createLocationDto: CreateLocationDto) {
    // Instead of saving to DB or Redis directly, we send an "event"
    this.kafkaClient.emit('location_update', {
      ...createLocationDto,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Sent location to Kafka: User ${createLocationDto.userId}`);

    // Return immediate response to client (no need to wait for save)
    return { status: 'sent_to_queue' };
  }

  // --- Helper functions (no changes) ---

  findAll() { return []; }

  async createDummyUser() { return null; }
  async assignGroupToUser() { return null; }
}