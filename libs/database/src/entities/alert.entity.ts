import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('alerts')
export class Alert {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column()
    groupId: string;

    @Column()
    userId: string;

    @Column()
    userName: string; // Cached for display

    @Column({ nullable: true })
    areaId: number;

    @Column({ nullable: true })
    areaName: string; // Cached for display

    @Column({
        type: 'enum',
        enum: ['DANGER_ZONE_ENTER', 'DANGER_ZONE_LEAVE', 'SAFE_ZONE_ENTER', 'SAFE_ZONE_LEAVE', 'SOS_ALERT'],
        default: 'DANGER_ZONE_ENTER'
    })
    type: 'DANGER_ZONE_ENTER' | 'DANGER_ZONE_LEAVE' | 'SAFE_ZONE_ENTER' | 'SAFE_ZONE_LEAVE' | 'SOS_ALERT';

    @CreateDateColumn()
    createdAt: Date;
}
