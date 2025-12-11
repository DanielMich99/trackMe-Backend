import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Location } from './location.entity';
import { Group } from './group.entity';

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

  // --- הוסף את השורות האלה ---
  @Column({ nullable: true })
  groupId: string;
  // ---------------------------

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Location, (location) => location.user)
  locations: Location[];

  @ManyToOne(() => Group, (group) => group.users)
  @JoinColumn({ name: 'groupId' })
  group: Group;
}