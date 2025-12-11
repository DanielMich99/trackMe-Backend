import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';

@Entity('groups')
export class Group {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string; // שם הקבוצה (למשל "משפחת כהן")

    @Column({ unique: true })
    joinCode: string; // קוד סודי להצטרפות (למשל "X7Z-22A")

    // קשר: לקבוצה אחת יש הרבה משתמשים
    @OneToMany(() => User, (user) => user.group)
    users: User[];
}