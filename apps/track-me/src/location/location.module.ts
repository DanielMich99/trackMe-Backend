import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices'; // Added for Kafka
import { LocationService } from './location.service';
import { LocationController } from './location.controller';
import { LocationGateway } from './location.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location, User, Area } from '@app/database';
import Redis from 'ioredis';
// (Remove Redis import if present, we're replacing it with Kafka)

@Module({
  imports: [
    TypeOrmModule.forFeature([Location, User, Area]),
    // Kafka client configuration
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE', // Service name for dependency injection
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: ['localhost:9092'], // Kafka broker address in Docker
          },
          consumer: {
            groupId: 'track-me-producer', // Unique consumer group ID
          },
        },
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
      useFactory: () => {
        return new Redis({ host: 'localhost', port: 6379 });
      },
    },
  ],
  exports: [LocationGateway, LocationService],
})
export class LocationModule { }