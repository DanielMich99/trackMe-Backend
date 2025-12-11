import { NestFactory } from '@nestjs/core';
import { ProcessorModule } from './processor.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  // במקום create רגיל, אנחנו יוצרים microservice
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ProcessorModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          brokers: ['localhost:9092'], // מתחבר לאותו קפקא
        },
        consumer: {
          groupId: 'location-processor-group', // קבוצת צרכנים נפרדת
        },
      },
    },
  );

  await app.listen();
  console.log('🚀 Processor Microservice is listening to Kafka...');
}
bootstrap();