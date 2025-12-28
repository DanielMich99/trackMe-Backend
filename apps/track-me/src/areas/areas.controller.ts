import { Controller, Get, Post, Put, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';

@Controller('areas')
@UseGuards(AuthGuard('jwt'))
export class AreasController {
  constructor(private readonly areasService: AreasService) { }

  @Post()
  create(@Body() createAreaDto: CreateAreaDto, @Request() req: any) {
    return this.areasService.create(createAreaDto, req.user.id);
  }

  @Get('group/:groupId')
  findByGroup(@Param('groupId') groupId: string, @Request() req: any) {
    return this.areasService.findByGroup(groupId, req.user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateAreaDto>,
    @Request() req: any
  ) {
    return this.areasService.update(+id, updateData, req.user.id);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req: any) {
    return this.areasService.delete(+id, req.user.id);
  }

  @Get()
  findAll() {
    return this.areasService.findAll();
  }
}