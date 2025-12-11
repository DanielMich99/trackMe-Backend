import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('groups')
@UseGuards(AuthGuard('jwt')) // כל הפעולות כאן דורשות טוקן!
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) { }

  @Post('create')
  create(@Body() createGroupDto: CreateGroupDto, @Request() req) {
    // req.user.userId מגיע מהטוקן
    return this.groupsService.create(createGroupDto, req.user.userId);
  }

  @Post('join')
  join(@Body() joinGroupDto: JoinGroupDto, @Request() req) {
    return this.groupsService.join(joinGroupDto, req.user.userId);
  }

  @Get('my-group')
  getMyGroup(@Request() req) {
    return this.groupsService.getMyGroup(req.user.userId);
  }
}