import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { GroupMember } from './group-member.entity';

@Entity('groups')
export class Group {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string; // שם הקבוצה (למשל "משפחת כהן")

    @Column({ unique: true })
    joinCode: string; // קוד סודי להצטרפות (למשל "X7Z-22A")

    // קשר: לקבוצה יכולים להיות הרבה משתמשים, ומשתמש יכול להיות בהרבה קבוצות
    // קשר: לקבוצה יש רשימת חברים
    @OneToMany(() => GroupMember, (member) => member.group)
    members: GroupMember[];
}