import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
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
}