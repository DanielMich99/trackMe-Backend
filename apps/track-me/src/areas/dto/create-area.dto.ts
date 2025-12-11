import { IsString, IsNotEmpty, IsArray } from 'class-validator';

export class CreateAreaDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    groupId: string;

    // מערך של מערכים: [[lat, long], [lat, long], ...]
    @IsArray()
    coordinates: number[][];
}