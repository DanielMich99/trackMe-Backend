import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('areas')
export class Area {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column()
    name: string; // לדוגמה: "School", "Home", "Grandma's House"

    @Column()
    groupId: string; // כדי שרק המשפחה שיצרה את האזור תראה אותו

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