import { Controller, Post, Body, Get, Param, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { LocationService } from './location.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createLocationDto: CreateLocationDto, @Request() req) {
    createLocationDto.userId = req.user.userId;
    return this.locationService.create(createLocationDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll() {
    return this.locationService.findAll();
  }

  @Get('history/:userId')
  @UseGuards(AuthGuard('jwt'))
  async getHistory(
    @Param('userId') userId: string,
    @Query('groupId') groupId: string,
    @Query('date') date: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Request() req,
  ) {
    // Validate required params
    if (!groupId || !date) {
      throw new BadRequestException('groupId and date are required');
    }

    // Validate date is within last 7 days
    const requestedDate = new Date(date);
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (requestedDate > today || requestedDate < sevenDaysAgo) {
      throw new BadRequestException('Date must be within the last 7 days');
    }

    return this.locationService.getHistory(req.user.userId, userId, groupId, date, startTime, endTime);
  }
}