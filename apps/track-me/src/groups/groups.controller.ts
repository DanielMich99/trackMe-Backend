import { Controller, Post, Body, UseGuards, Request, Get, Query } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { MemberActionDto } from './dto/member-action.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('groups')
@UseGuards(AuthGuard('jwt')) // All operations here require a token!
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) { }

  @Post('create')
  create(@Body() createGroupDto: CreateGroupDto, @Request() req) {
    // req.user.userId comes from the token
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
  approve(@Body() dto: MemberActionDto, @Request() req) {
    return this.groupsService.approveMember(req.user.userId, dto.groupId, dto.userId);
  }

  @Post('kick')
  kick(@Body() dto: MemberActionDto, @Request() req) {
    return this.groupsService.kickMember(req.user.userId, dto.groupId, dto.userId);
  }

  @Post('promote')
  promote(@Body() dto: MemberActionDto, @Request() req) {
    return this.groupsService.promoteMember(req.user.userId, dto.groupId, dto.userId);
  }

  @Post('demote')
  demote(@Body() dto: MemberActionDto, @Request() req) {
    return this.groupsService.demoteMember(req.user.userId, dto.groupId, dto.userId);
  }

  @Get('locations')
  getGroupLocations(@Request() req, @Query('groupId') groupId: string) {
    return this.groupsService.getGroupMemberLocations(req.user.userId, groupId);
  }

  @Get('pending')
  getPending(@Request() req, @Query('groupId') groupId: string) {
    return this.groupsService.getPendingRequests(req.user.userId, groupId);
  }

  @Post('reject')
  reject(@Body() dto: MemberActionDto, @Request() req) {
    return this.groupsService.rejectRequest(req.user.userId, dto.groupId, dto.userId);
  }
}