import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { LocationService } from './location.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@app/database';
import { Repository } from 'typeorm';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class LocationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly locationService: LocationService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // 1. פונקציה שרצה אוטומטית כשמישהו מתחבר
  async handleConnection(client: Socket) {
    // הלקוח ישלח את ה-userId בפרמטרים של החיבור
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      console.log('Client connected without userId, disconnecting...');
      client.disconnect();
      return;
    }

    // נביא את המשתמש מה-DB כדי לדעת מה ה-GroupId שלו
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (user && user.groupId) {
      // הקסם קורה כאן: מכניסים את הסוקט לחדר בשם ה-GroupId
      await client.join(user.groupId);
      console.log(`User ${user.name} joined room: ${user.groupId}`);
    } else {
      console.log(`User ${userId} has no group, not joining any room.`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('updateLocation')
  async handleUpdateLocation(
    @MessageBody() createLocationDto: CreateLocationDto,
    @ConnectedSocket() client: Socket, // גישה ללקוח הספציפי ששלח
  ) {
    const savedLocation = await this.locationService.create(createLocationDto);
    
    // נביא שוב את המשתמש כדי לוודא לאיזה חדר לשדר
    // (במערכת אמיתית היינו שומרים את זה ב-Session כדי לחסוך פניה ל-DB)
    const user = await this.userRepository.findOne({ where: { id: createLocationDto.userId } });

    if (user && user.groupId) {
      // שידור רק למי שבחדר!
      this.server.to(user.groupId).emit('newLocationReceived', savedLocation);
      console.log(`Sent location to room ${user.groupId}`);
    }

    return savedLocation;
  }
}