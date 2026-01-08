import { Injectable, NotFoundException, BadRequestException, Inject, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Group, User, GroupMember, GroupRole, MemberStatus } from '@app/database';
import { Repository } from 'typeorm';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import Redis from 'ioredis';
import { LocationGateway } from '../location/location.gateway';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(GroupMember)
    private memberRepository: Repository<GroupMember>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly locationGateway: LocationGateway,
  ) { }

  // --- Create new group ---
  async create(createGroupDto: CreateGroupDto, userId: string) {
    // 1. Generate random 6-character join code
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 2. Create the group
    const group = this.groupRepository.create({
      name: createGroupDto.name,
      joinCode: joinCode,
    });

    let savedGroup;
    try {
      savedGroup = await this.groupRepository.save(group);
    } catch (error) {
      if (error.code === '23505') { // Postgres unique_violation code
        // In a perfect world, we'd retry with a new code here.
        // For now, fail gracefully so the user knows to try again.
        throw new ConflictException('Failed to generate a unique group code. Please try again.');
      }
      throw error;
    }

    // 3. Create membership (Admin + Approved)
    const member = this.memberRepository.create({
      userId: userId,
      groupId: savedGroup.id,
      role: GroupRole.ADMIN,
      status: MemberStatus.APPROVED,
    });

    await this.memberRepository.save(member);

    // Invalidate user's group cache
    await this.redis.del(`user:${userId}:groups`);

    // Force socket to join new group room
    await this.locationGateway.addUserToGroup(userId, savedGroup.id);

    return savedGroup;
  }

  // --- Join existing group ---
  async join(joinGroupDto: JoinGroupDto, userId: string) {
    console.log(`[Join] User ${userId} attempting to join with code ${joinGroupDto.joinCode}`);
    // 1. Find group by join code
    const group = await this.groupRepository.findOne({
      where: { joinCode: joinGroupDto.joinCode },
    });

    if (!group) {
      console.log(`[Join] Invalid code: ${joinGroupDto.joinCode}`);
      throw new NotFoundException('Invalid join code');
    }

    // 2. Check if user is already in the group
    const existingMember = await this.memberRepository.findOne({
      where: { userId: userId, groupId: group.id }
    });

    if (existingMember) {
      console.log(`[Join] User already in group. Status: ${existingMember.status}`);
      if (existingMember.status === MemberStatus.PENDING) {
        return { message: 'Request already pending', group };
      }
      return { message: 'Already a member', group };
    }

    // 3. Create join request (Member + Pending)
    const member = this.memberRepository.create({
      userId: userId,
      groupId: group.id,
      role: GroupRole.MEMBER,
      status: MemberStatus.PENDING
    });

    await this.memberRepository.save(member);
    console.log(`[Join] Success! User ${userId} is now PENDING in group ${group.id}`);

    return { message: `Join request sent to ${group.name}`, group };
  }

  // Function to fetch user's groups
  // Get all my groups (including pending ones)
  async getMyGroups(userId: string) {
    // Fetch both APPROVED and PENDING memberships
    const memberships = await this.memberRepository.find({
      where: [
        { userId: userId, status: MemberStatus.APPROVED },
        { userId: userId, status: MemberStatus.PENDING }
      ],
      relations: ['group', 'group.members', 'group.members.user'], // Also fetch other members
    });

    // Transform structure for response
    return memberships.map(m => {
      const isPending = m.status === MemberStatus.PENDING;

      return {
        ...m.group,
        // Add flag to indicate user's status in this group
        myStatus: m.status,
        myRole: m.role, // Add user's role (ADMIN/MEMBER)
        // Only show APPROVED members if user is approved in this group
        // PENDING users shouldn't see the member list
        users: isPending ? [] : m.group.members
          .filter(gm => gm.status === MemberStatus.APPROVED)
          .map(gm => ({
            id: gm.user.id,
            name: gm.user.name,
            email: gm.user.email,
            role: gm.role, // Added role to returned data
            status: gm.status
          }))
      };
    });
  }

  // --- Member management ---
  private async checkAdmin(userId: string, groupId: string) {
    const member = await this.memberRepository.findOne({ where: { userId, groupId } });
    if (!member || member.role !== GroupRole.ADMIN) {
      throw new BadRequestException('Only admins can perform this action');
    }
  }

  async approveMember(adminId: string, groupId: string, targetUserId: string) {
    console.log(`[Approve] Admin ${adminId} approving user ${targetUserId} in group ${groupId}`);
    await this.checkAdmin(adminId, groupId);

    const member = await this.memberRepository.findOne({ where: { userId: targetUserId, groupId } });
    if (!member) throw new NotFoundException('Member not found');

    member.status = MemberStatus.APPROVED;
    const res = await this.memberRepository.save(member);

    // Invalidate user's group cache so their locations broadcast to this group
    await this.redis.del(`user:${targetUserId}:groups`);

    // Force socket to join new group room
    await this.locationGateway.addUserToGroup(targetUserId, groupId);

    console.log(`[Approve] Success. Member status is now ${res.status}`);
    return res;
  }

  async kickMember(adminId: string, groupId: string, targetUserId: string) {
    await this.checkAdmin(adminId, groupId);

    await this.memberRepository.delete({ userId: targetUserId, groupId });

    // Invalidate user's group cache so their locations stop broadcasting to this group
    await this.redis.del(`user:${targetUserId}:groups`);

    return { message: 'Member removed' };
  }

  async promoteMember(adminId: string, groupId: string, targetUserId: string) {
    await this.checkAdmin(adminId, groupId);

    const member = await this.memberRepository.findOne({ where: { userId: targetUserId, groupId } });
    if (!member) throw new NotFoundException('Member not found');

    member.role = GroupRole.ADMIN;
    return this.memberRepository.save(member);
  }

  async demoteMember(adminId: string, groupId: string, targetUserId: string) {
    await this.checkAdmin(adminId, groupId);

    const member = await this.memberRepository.findOne({ where: { userId: targetUserId, groupId } });
    if (!member) throw new NotFoundException('Member not found');

    member.role = GroupRole.MEMBER;
    return this.memberRepository.save(member);
  }

  // Function to fetch all pending requests (for admins)
  async getPendingRequests(userId: string, groupId: string) {
    console.log(`[Pending] User ${userId} fetching pending requests for group ${groupId}`);
    await this.checkAdmin(userId, groupId);

    const requests = await this.memberRepository.find({
      where: { groupId, status: MemberStatus.PENDING },
      relations: ['user']
    });
    console.log(`[Pending] Found ${requests.length} requests for group ${groupId}`);
    return requests;
  }

  // Reject a pending join request (admin only)
  async rejectRequest(adminId: string, groupId: string, targetUserId: string) {
    console.log(`[Reject] Admin ${adminId} rejecting user ${targetUserId} from group ${groupId}`);
    await this.checkAdmin(adminId, groupId);

    const member = await this.memberRepository.findOne({
      where: { userId: targetUserId, groupId, status: MemberStatus.PENDING }
    });

    if (!member) {
      throw new NotFoundException('Pending request not found');
    }

    await this.memberRepository.delete({ userId: targetUserId, groupId });
    console.log(`[Reject] Success. Request rejected.`);
    return { message: 'Request rejected' };
  }

  // --- Fetch last known locations for group members ---
  async getGroupMemberLocations(userId: string, groupId: string) {
    console.log(`[Locations] User ${userId} fetching locations for group ${groupId}`);

    // Verify user has access to this group
    const membership = await this.memberRepository.findOne({
      where: { userId, groupId, status: MemberStatus.APPROVED }
    });
    if (!membership) {
      throw new NotFoundException('Group not found or access denied');
    }

    // Get all approved members
    const members = await this.memberRepository.find({
      where: { groupId, status: MemberStatus.APPROVED },
      relations: ['user']
    });

    const locations: any[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    // For each member, try Redis cache first, then fall back to DB
    for (const m of members) {
      // 1. Try Redis cache first
      const cachedLocation = await this.redis.get(`user:${m.user.id}:latest_location`);

      if (cachedLocation) {
        // Cache hit - use cached data
        const parsed = JSON.parse(cachedLocation);
        locations.push({
          userId: m.user.id,
          userName: m.user.name,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          timestamp: parsed.timestamp
        });
        cacheHits++;
      } else {
        // Cache miss - query DB for this user's latest location
        const userWithLocations = await this.userRepository.findOne({
          where: { id: m.user.id },
          relations: ['locations']
        });

        if (userWithLocations && userWithLocations.locations?.length > 0) {
          const lastLocation = userWithLocations.locations
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

          locations.push({
            userId: m.user.id,
            userName: m.user.name,
            latitude: lastLocation.latitude,
            longitude: lastLocation.longitude,
            timestamp: lastLocation.timestamp.toISOString()
          });
        }
        cacheMisses++;
      }
    }

    console.log(`[Locations] Found ${locations.length} locations (Cache hits: ${cacheHits}, misses: ${cacheMisses})`);
    return locations;
  }
}