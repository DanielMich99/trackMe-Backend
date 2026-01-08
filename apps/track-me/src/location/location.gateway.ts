import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { LocationService } from './location.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@app/database';
import { Repository } from 'typeorm';
import { Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class LocationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {

  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationGateway.name);

  constructor(
    @Inject('REDIS_SUB') private readonly redisSub: Redis,
    private readonly locationService: LocationService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) { }

  // --- Subscribe to Redis for real-time location broadcasts and alerts ---
  async onModuleInit() {
    try {
      await this.redisSub.subscribe('live_updates', 'alerts');
      this.logger.log('📡 Gateway subscribed to Redis channels: live_updates, alerts');

      this.redisSub.on('message', async (channel, message) => {
        try {
          if (channel === 'live_updates') {
            const location = JSON.parse(message);
            this.logger.log(
              `📡 Gateway received update via Redis for User ${location.userId}`,
            );

            // Use groupIds from message (sent by processor) - no DB query needed!
            const groupIds: string[] = location.groupIds ?? [];

            for (const groupId of groupIds) {
              this.server.to(groupId).emit('newLocationReceived', location);
              this.logger.log(`>> Emitted location to Group Room: ${groupId}`);
            }
          }

          // Handle danger zone alerts
          if (channel === 'alerts') {
            const alert = JSON.parse(message);
            this.logger.warn(`🚨 Alert received: ${alert.user} entered ${alert.area}`);

            // Emit to all users in the group
            // Determine event name based on type
            const eventName = alert.type.includes('SAFE') ? 'safeZoneAlert' : 'dangerZoneAlert';

            this.server.to(alert.groupId).emit(eventName, {
              type: alert.type,
              userName: alert.user,
              areaName: alert.area,
              timestamp: new Date().toISOString(),
            });
            this.logger.log(`>>🚨🚨 Emitted alert to Group Room: ${alert.groupId}`);
          }
        } catch (error) {
          this.logger.error('Error processing Redis message', error);
        }
      });
    } catch (error) {
      this.logger.error('Error subscribing to Redis', error);
    }
  }

  // --- Cleanup: Unsubscribe from Redis on module destroy ---
  async onModuleDestroy() {
    try {
      await this.redisSub.unsubscribe('live_updates', 'alerts');
      this.logger.log('📡 Gateway unsubscribed from Redis channels: live_updates, alerts');
    } catch (error) {
      this.logger.error('Error unsubscribing from Redis', error);
    }
  }

  // --- Connection and Room Management ---
  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      this.logger.warn(`Client connected without userId: ${client.id}`);
      return;
    }

    // Find user to determine which rooms to join
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['memberships', 'memberships.group'],
    });

    if (user && user.memberships) {
      // Use for...of instead of forEach with async (proper awaiting)
      for (const member of user.memberships) {
        await client.join(member.group.id);
        this.logger.log(
          `User ${user.email} joined room: ${member.group.name} (${member.group.id})`,
        );
      }
    } else {
      this.logger.log(`User ${userId} connected (No Groups)`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // --- (Legacy) Receive location directly via WebSocket ---
  @SubscribeMessage('updateLocation')
  async handleUpdateLocation(
    @MessageBody() createLocationDto: CreateLocationDto,
    @ConnectedSocket() client: Socket,
  ) {
    const result = await this.locationService.create(createLocationDto);

    this.logger.log(
      `Direct socket update received from ${createLocationDto.userId}`,
    );

    return result;
  }

  // --- Manually join a group room (e.g. after creating/joining a group) ---
  @SubscribeMessage('joinGroup')
  async handleJoinGroup(
    @MessageBody() data: { groupId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data.groupId) {
      await client.join(data.groupId);
      this.logger.log(`Client ${client.id} manually joined group ${data.groupId}`);
    }
  }

  // --- Public helper to force a user's socket(s) to join a group room ---
  async addUserToGroup(userId: string, groupId: string) {
    let count = 0;
    for (const [_, socket] of this.server.sockets.sockets) {
      const socketUserId = socket.handshake.query.userId as string;
      if (socketUserId === userId) {
        await socket.join(groupId);
        count++;
        this.logger.log(`🔌 Added socket ${socket.id} (User ${userId}) to group ${groupId} by server request`);
      }
    }
    if (count === 0) {
      this.logger.debug(`⚠️ No active sockets found for User ${userId} to join group ${groupId}`);
    }
  }
}