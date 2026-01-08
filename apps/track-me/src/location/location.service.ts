import { Inject, Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { CreateLocationDto } from './dto/create-location.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Location, User, Area, GroupMember, MemberStatus } from '@app/database';
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
    @InjectRepository(GroupMember)
    private groupMemberRepository: Repository<GroupMember>,
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

  // --- Get location history for a user on a specific date ---
  async getHistory(requestingUserId: string, targetUserId: string, groupId: string, date: string, startTime?: string, endTime?: string) {
    // Validate both users are in the same group
    const requestingMember = await this.groupMemberRepository.findOne({
      where: { userId: requestingUserId, groupId, status: MemberStatus.APPROVED },
    });
    const targetMember = await this.groupMemberRepository.findOne({
      where: { userId: targetUserId, groupId, status: MemberStatus.APPROVED },
    });

    if (!requestingMember || !targetMember) {
      throw new ForbiddenException('Not authorized to view this user\'s history');
    }

    // Parse date and create range for that day
    const startOfDay = new Date(date);
    if (startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      startOfDay.setHours(hours, minutes, 0, 0);
    } else {
      startOfDay.setHours(0, 0, 0, 0);
    }

    const endOfDay = new Date(date);
    if (endTime) {
      const [hours, minutes] = endTime.split(':').map(Number);
      endOfDay.setHours(hours, minutes, 59, 999);
    } else {
      endOfDay.setHours(23, 59, 59, 999);
    }

    // Get locations for that day, sorted by timestamp
    const locations = await this.locationRepository.find({
      where: {
        userId: targetUserId,
        timestamp: Between(startOfDay, endOfDay),
      },
      order: { timestamp: 'ASC' },
    });

    this.logger.log(`Found ${locations.length} locations for user ${targetUserId} on ${date}${startTime ? ` from ${startTime}` : ''}${endTime ? ` to ${endTime}` : ''}`);

    return locations;
  }

  // --- Helper functions (no changes) ---

  findAll() { return []; }

  async createDummyUser() { return null; }
  async assignGroupToUser() { return null; }
}