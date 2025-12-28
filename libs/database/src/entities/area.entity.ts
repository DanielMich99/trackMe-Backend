import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('areas')
export class Area {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column()
    name: string; // Example: "School", "Home", "Grandma's House"

    @Column()
    groupId: string; // Only the group that created this area can see it

    @Column({
        type: 'enum',
        enum: ['SAFE', 'DANGER'],
        default: 'DANGER'
    })
    type: 'SAFE' | 'DANGER';

    @Column({ nullable: true })
    targetUserId?: string; // If NULL -> applies to everyone. If has ID -> only that user

    @Column({
        type: 'enum',
        enum: ['ENTER', 'LEAVE', 'BOTH'],
        default: 'ENTER'
    })
    alertOn: 'ENTER' | 'LEAVE' | 'BOTH';

    // PostGIS Polygon
    @Column({
        type: 'geometry',
        spatialFeatureType: 'Polygon',
        srid: 4326,
    })
    polygon: string;

    @CreateDateColumn()
    createdAt: Date;
}