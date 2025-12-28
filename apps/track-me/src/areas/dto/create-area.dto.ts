import { IsString, IsNotEmpty, IsArray, IsOptional, IsEnum } from 'class-validator';

export class CreateAreaDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    groupId: string;

    // Array of coordinate pairs: [[lng, lat], [lng, lat], ...]
    @IsArray()
    coordinates: number[][];

    @IsOptional()
    @IsEnum(['SAFE', 'DANGER'])
    type?: 'SAFE' | 'DANGER';

    @IsOptional()
    @IsString()
    targetUserId?: string;  // If null, applies to all group members

    @IsOptional()
    @IsEnum(['ENTER', 'LEAVE', 'BOTH'])
    alertOn?: 'ENTER' | 'LEAVE' | 'BOTH';
}