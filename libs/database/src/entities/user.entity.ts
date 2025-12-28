import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Location } from './location.entity';
// import { Group } from './group.entity'; // No longer direct relation
import { GroupMember } from './group-member.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password?: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Location, (location) => location.user)
  locations: Location[];

  @OneToMany(() => GroupMember, (member) => member.user)
  memberships: GroupMember[];
}