import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Group, User } from '@app/database';
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

    // 3. שיוך המשתמש (היוצר) לקבוצה החדשה
    // מי שיוצר את הקבוצה הוא אוטומטית המנהל/חבר בה
    await this.userRepository.update(userId, { groupId: savedGroup.id });

    return savedGroup;
  }

  // --- הצטרפות לקבוצה קיימת ---
  async join(joinGroupDto: JoinGroupDto, userId: string) {
    // 1. חיפוש הקבוצה לפי הקוד
    const group = await this.groupRepository.findOne({
      where: { joinCode: joinGroupDto.joinCode },
    });

    if (!group) {
      throw new NotFoundException('Invalid join code');
    }

    // 2. עדכון המשתמש
    await this.userRepository.update(userId, { groupId: group.id });

    return { message: `Joined group ${group.name} successfully`, group };
  }

  // פונקציה לשליפת הקבוצה של המשתמש (נחמד שיהיה)
  async getMyGroup(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['group', 'group.users'] // מביא גם את פרטי הקבוצה וגם את החברים בה!
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.group) {
      throw new NotFoundException('User has no group');
    }

    return user.group;
  }
}