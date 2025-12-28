import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateAreaDto } from './dto/create-area.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Area, GroupMember, MemberStatus } from '@app/database';
import { Repository } from 'typeorm';

@Injectable()
export class AreasService {
  constructor(
    @InjectRepository(Area)
    private areaRepository: Repository<Area>,
    @InjectRepository(GroupMember)
    private memberRepository: Repository<GroupMember>,
  ) { }

  async create(createAreaDto: CreateAreaDto, userId: string) {
    // Verify user is a member of the group
    const membership = await this.memberRepository.findOne({
      where: { userId, groupId: createAreaDto.groupId, status: MemberStatus.APPROVED }
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // Close polygon if not closed
    const coords = createAreaDto.coordinates;
    const firstPoint = coords[0];
    const lastPoint = coords[coords.length - 1];
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
      coords.push(firstPoint);
    }

    const area = this.areaRepository.create({
      name: createAreaDto.name,
      groupId: createAreaDto.groupId,
      type: createAreaDto.type ?? 'DANGER',
      targetUserId: createAreaDto.targetUserId || undefined,
      alertOn: createAreaDto.alertOn ?? 'ENTER',
      polygon: {
        type: 'Polygon',
        coordinates: [coords],
      } as any,
    });

    return await this.areaRepository.save(area);
  }

  async findByGroup(groupId: string, userId: string) {
    // Verify user is a member of the group
    const membership = await this.memberRepository.findOne({
      where: { userId, groupId, status: MemberStatus.APPROVED }
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    return this.areaRepository.find({ where: { groupId } });
  }

  async update(id: number, updateData: Partial<CreateAreaDto>, userId: string) {
    const area = await this.areaRepository.findOne({ where: { id } });
    if (!area) {
      throw new NotFoundException('Area not found');
    }

    // Verify user is a member of the group
    const membership = await this.memberRepository.findOne({
      where: { userId, groupId: area.groupId, status: MemberStatus.APPROVED }
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // Update fields
    if (updateData.name) area.name = updateData.name;
    if (updateData.type) area.type = updateData.type;
    if (updateData.targetUserId !== undefined) area.targetUserId = updateData.targetUserId;
    if (updateData.alertOn) area.alertOn = updateData.alertOn;

    if (updateData.coordinates) {
      const coords = updateData.coordinates;
      const firstPoint = coords[0];
      const lastPoint = coords[coords.length - 1];
      if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
        coords.push(firstPoint);
      }
      area.polygon = { type: 'Polygon', coordinates: [coords] } as any;
    }

    return await this.areaRepository.save(area);
  }

  async delete(id: number, userId: string) {
    const area = await this.areaRepository.findOne({ where: { id } });
    if (!area) {
      throw new NotFoundException('Area not found');
    }

    // Verify user is a member of the group
    const membership = await this.memberRepository.findOne({
      where: { userId, groupId: area.groupId, status: MemberStatus.APPROVED }
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    await this.areaRepository.delete(id);
    return { message: 'Area deleted' };
  }

  findAll() {
    return this.areaRepository.find();
  }
}