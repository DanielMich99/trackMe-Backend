import { Controller, Post, Body, Get } from '@nestjs/common';
import { LocationService } from './location.service';
import { CreateLocationDto } from './dto/create-location.dto';

@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post()
  create(@Body() createLocationDto: CreateLocationDto) {
    return this.locationService.create(createLocationDto);
  }

  @Get()
  findAll() {
    return this.locationService.findAll();
  }

  // הוסף את זה בתוך המחלקה LocationController
  @Post('dummy-user')
  createDummy() {
    return this.locationService.createDummyUser(); // אל תשכח להוסיף את הפונקציה ב-Service קודם
  }

  @Post('assign-group')
  assignGroup(@Body() body: { userId: string; groupId: string }) {
    return this.locationService.assignGroupToUser(body.userId, body.groupId);
  }
}