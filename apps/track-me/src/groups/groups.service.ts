import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Group, User, GroupMember, GroupRole, MemberStatus } from '@app/database';
import { Repository } from 'typeorm';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(GroupMember)
    private memberRepository: Repository<GroupMember>,
  ) { }

  // --- יצירת קבוצה חדשה ---
  async create(createGroupDto: CreateGroupDto, userId: string) {
    // 1. יצירת קוד הצטרפות רנדומלי (6 תווים)
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 2. יצירת הקבוצה
    const group = this.groupRepository.create({
      name: createGroupDto.name,
      joinCode: joinCode,
    });
    const savedGroup = await this.groupRepository.save(group);

    // 3. יצירת חברות (Admin + Approved)
    const member = this.memberRepository.create({
      userId: userId,
      groupId: savedGroup.id,
      role: GroupRole.ADMIN,
      status: MemberStatus.APPROVED,
    });

    await this.memberRepository.save(member);

    return savedGroup;
  }

  // --- הצטרפות לקבוצה קיימת ---
  async join(joinGroupDto: JoinGroupDto, userId: string) {
    console.log(`[Join] User ${userId} attempting to join with code ${joinGroupDto.joinCode}`);
    // 1. חיפוש הקבוצה לפי הקוד
    const group = await this.groupRepository.findOne({
      where: { joinCode: joinGroupDto.joinCode },
    });

    if (!group) {
      console.log(`[Join] Invalid code: ${joinGroupDto.joinCode}`);
      throw new NotFoundException('Invalid join code');
    }

    // 2. בדיקה אם המשתמש כבר בקבוצה
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

    // 3. יצירת בקשת הצטרפות (Member + Pending)
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

  // פונקציה לשליפת הקבוצה של המשתמש (נחמד שיהיה)
  // שליפת כל הקבוצות שלי
  async getMyGroups(userId: string) {
    const memberships = await this.memberRepository.find({
      where: { userId: userId, status: MemberStatus.APPROVED },
      relations: ['group', 'group.members', 'group.members.user'], // להביא גם את החברים האחרים
    });

    // המרת המבנה לחזרה
    return memberships.map(m => ({
      ...m.group,
      // Fixed: Only return APPROVED members in the public list
      users: m.group.members
        .filter(gm => gm.status === MemberStatus.APPROVED)
        .map(gm => ({
          id: gm.user.id,
          name: gm.user.name,
          email: gm.user.email,
          role: gm.role, // הוספנו את התפקיד למידע שחוזר
          status: gm.status
        }))
    }));
  }

  // --- ניהול חברים ---
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
    console.log(`[Approve] Success. Member status is now ${res.status}`);
    return res;
  }

  async kickMember(adminId: string, groupId: string, targetUserId: string) {
    await this.checkAdmin(adminId, groupId);

    await this.memberRepository.delete({ userId: targetUserId, groupId });
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

  // פונקציה להביא את כל הבקשות הממתינות (עבור אדמין)
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
}