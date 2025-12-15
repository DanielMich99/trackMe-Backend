import { Controller, Post, Body, UseGuards, Request, Get, Query } from '@nestjs/common';
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

  @Get('my-groups')
  getMyGroups(@Request() req) {
    return this.groupsService.getMyGroups(req.user.userId);
  }

  @Post('approve')
  approve(@Body() body: { groupId: string; userId: string }, @Request() req) {
    return this.groupsService.approveMember(req.user.userId, body.groupId, body.userId);
  }

  @Post('kick')
  kick(@Body() body: { groupId: string; userId: string }, @Request() req) {
    return this.groupsService.kickMember(req.user.userId, body.groupId, body.userId);
  }

  @Post('promote')
  promote(@Body() body: { groupId: string; userId: string }, @Request() req) {
    return this.groupsService.promoteMember(req.user.userId, body.groupId, body.userId);
  }

  @Post('demote')
  demote(@Body() body: { groupId: string; userId: string }, @Request() req) {
    return this.groupsService.demoteMember(req.user.userId, body.groupId, body.userId);
  }

  @Get('pending')
  getPending(@Request() req, @Query('groupId') groupId: string) {
    return this.groupsService.getPendingRequests(req.user.userId, groupId);
  }
}