import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices'; // Added for Kafka
import { LocationService } from './location.service';
import { LocationController } from './location.controller';
import { LocationGateway } from './location.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location, User, Area, GroupMember } from '@app/database';
import Redis from 'ioredis';
// (Remove Redis import if present, we're replacing it with Kafka)

@Module({
  imports: [
    TypeOrmModule.forFeature([Location, User, Area, GroupMember]),
    // Kafka client configuration
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        useFactory: (configService: ConfigService) => {
          const kafkaApiKey = configService.get<string>('KAFKA_API_KEY');
          const kafkaApiSecret = configService.get<string>('KAFKA_API_SECRET');
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                brokers: [configService.get<string>('KAFKA_BROKERS') || 'localhost:9092'],
                sasl: kafkaApiKey && kafkaApiSecret ? {
                  mechanism: 'plain',
                  username: kafkaApiKey,
                  password: kafkaApiSecret,
                } : undefined,
                ssl: !!kafkaApiKey,
              },
              consumer: {
                groupId: 'track-me-producer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [LocationController],
  providers: [
    LocationService,
    LocationGateway,
    // --- Added Redis back (for the Gateway) ---
    {
      provide: 'REDIS_SUB', // Special name for subscriber
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          return new Redis(redisUrl);
        }
        return new Redis({ host: 'localhost', port: 6379 });
      },
      inject: [ConfigService],
    },
  ],
  exports: [LocationGateway, LocationService],
})
export class LocationModule { }