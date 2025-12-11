// libs/database/src/entities/location.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('float')
  latitude: number;

  @Column('float')
  longitude: number;

  // הגדרת עמודה גיאוגרפית ל-PostGIS
  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  geom: string; 

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => User, (user) => user.locations, { onDelete: 'CASCADE' })
  user: User;
  
  @Column()
  userId: string;
}