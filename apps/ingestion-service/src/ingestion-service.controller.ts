import { Controller, Get } from '@nestjs/common';
import { IngestionServiceService } from './ingestion-service.service';

@Controller()
export class IngestionServiceController {
  constructor(private readonly ingestionServiceService: IngestionServiceService) {}

  @Get()
  getHello(): string {
    return this.ingestionServiceService.getHello();
  }
}
