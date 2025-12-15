import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  // מחקנו מכאן את OnModuleInit
} from '@nestjs/websockets';
import { LocationService } from './location.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@app/database';
import { Repository } from 'typeorm';
// הוספנו את OnModuleInit לשורה הזו:
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class LocationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  // <-- 2. הוספנו את OnModuleInit לרשימה
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationGateway.name);

  constructor(
    @Inject('REDIS_SUB') private readonly redisSub: Redis,
    // 3. החזרנו את התלויות שהיו חסרות כדי שהקוד הישן יעבוד
    private readonly locationService: LocationService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) { }

  // --- החלק החדש: האזנה לרדיס ושידור ללקוחות ---
  async onModuleInit() {
    try {
      await this.redisSub.subscribe('live_updates');
      this.logger.log('📡 Gateway subscribed to Redis channel: live_updates');

      this.redisSub.on('message', async (channel, message) => {
        if (channel === 'live_updates') {
          const location = JSON.parse(message);
          this.logger.log(
            `📡 Gateway received update via Redis for User ${location.userId}`,
          );

          // כדי לדעת לאילו חדרים לשדר, נביא את הקבוצות של המשתמש
          // (אופטימיזציה: אפשר היה שלקפקא->רדיס יגיע כבר עם רשימת ה-GroupIDs)
          const user = await this.userRepository.findOne({
            where: { id: location.userId },
            relations: ['memberships', 'memberships.group'],
          });

          if (user && user.memberships) {
            user.memberships.forEach((member) => {
              // רק אם החברות מאושרת, משדרים (אופציונלי, כרגע נשדר לכולם)
              if (member.status === 'APPROVED' || true) {
                this.server.to(member.group.id).emit('newLocationReceived', location);
                this.logger.log(`>> Emitted location to Group Room: ${member.group.id}`);
              }
            });
          }
        }
      });
    } catch (error) {
      this.logger.error('Error subscribing to Redis', error);
    }
  }

  // --- ניהול חיבורים וחדרים (נשאר מהקוד הקודם) ---
  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      this.logger.warn(`Client connected without userId: ${client.id}`);
      // client.disconnect(); // ביטלתי זמנית את הניתוק כדי להקל על דיבוג
      return;
    }

    // חיפוש המשתמש כדי לדעת לאיזה Room לשייך אותו
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['memberships', 'memberships.group'],
    });

    if (user && user.memberships) {
      user.memberships.forEach(async (member) => {
        // מצטרפים לחדר של הקבוצה
        await client.join(member.group.id);
        this.logger.log(
          `User ${user.email} joined room: ${member.group.name} (${member.group.id})`,
        );
      });
    } else {
      this.logger.log(`User ${userId} connected (No Groups)`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // --- (Legacy) קבלת מיקום ישירות מהסוקט ---
  // הפונקציה הזו עדיין שימושית אם נרצה שהלקוח ישלח דרך סוקט במקום HTTP POST
  @SubscribeMessage('updateLocation')
  async handleUpdateLocation(
    @MessageBody() createLocationDto: CreateLocationDto,
    @ConnectedSocket() client: Socket,
  ) {
    // זה שולח לקפקא (דרך הסרביס המעודכן)
    const result = await this.locationService.create(createLocationDto);

    // לוג לניטור
    this.logger.log(
      `Direct socket update received from ${createLocationDto.userId}`,
    );

    return result;
  }
}