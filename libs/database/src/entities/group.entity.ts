import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { GroupMember } from './group-member.entity';

@Entity('groups')
export class Group {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string; // Group name (e.g., "Smith Family")

    @Column({ unique: true })
    joinCode: string; // Secret code to join the group (e.g., "X7Z-22A")

    // Relationship: A group can have many users, and a user can be in many groups
    // Group members list
    @OneToMany(() => GroupMember, (member) => member.group)
    members: GroupMember[];
}