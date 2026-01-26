import { NestFactory } from '@nestjs/core';
import { ProcessorModule } from './processor.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  // במקום create רגיל, אנחנו יוצרים microservice
  console.log('DEBUG: KAFKA_BROKERS value:', process.env.KAFKA_BROKERS);
  console.log('DEBUG: KAFKA_API_KEY present:', !!process.env.KAFKA_API_KEY);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ProcessorModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
          ssl: !!process.env.KAFKA_API_KEY,
          sasl: process.env.KAFKA_API_KEY ? {
            mechanism: 'plain',
            username: process.env.KAFKA_API_KEY,
            password: process.env.KAFKA_API_SECRET || '',
          } : undefined,
        },
        consumer: {
          groupId: 'track-me-processor',
        },
      },
    },
  );

  await app.listen();
  console.log('🚀 Processor Microservice is listening to Kafka...');
}
bootstrap();