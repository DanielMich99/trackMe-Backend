import { Module } from '@nestjs/common';
import { IngestionServiceController } from './ingestion-service.controller';
import { IngestionServiceService } from './ingestion-service.service';

@Module({
  imports: [],
  controllers: [IngestionServiceController],
  providers: [IngestionServiceService],
})
export class IngestionServiceModule {}
