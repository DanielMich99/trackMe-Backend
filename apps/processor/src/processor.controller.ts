import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ProcessorService } from './processor.service';

@Controller()
export class ProcessorController {
  constructor(private readonly processorService: ProcessorService) { }

  // מאזין לאותו אירוע ששלחנו מה-Gateway
  @EventPattern('location_update')
  async handleLocationUpdate(@Payload() data: any) {
    // data מכיל את ה-JSON ששלחנו (userId, lat, long, timestamp)
    await this.processorService.processLocation(data);
  }
}