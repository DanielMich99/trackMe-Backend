import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Location } from './location.entity';

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
}