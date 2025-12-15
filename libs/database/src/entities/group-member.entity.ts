
import { Entity, Column, ManyToOne, PrimaryGeneratedColumn, JoinColumn, Unique } from 'typeorm';
import { User } from './user.entity';
import { Group } from './group.entity';

export enum GroupRole {
    ADMIN = 'ADMIN',
    MEMBER = 'MEMBER',
}

export enum MemberStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

@Entity('group_members')
@Unique(['user', 'group']) // מניעת כפילויות (משתמש לא יכול להיות באותה קבוצה פעמיים)
export class GroupMember {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: GroupRole,
        default: GroupRole.MEMBER,
    })
    role: GroupRole;

    @Column({
        type: 'enum',
        enum: MemberStatus,
        default: MemberStatus.PENDING,
    })
    status: MemberStatus;

    @ManyToOne(() => User, (user) => user.memberships, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    userId: string;

    @ManyToOne(() => Group, (group) => group.members, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'groupId' })
    group: Group;

    @Column()
    groupId: string;
}
