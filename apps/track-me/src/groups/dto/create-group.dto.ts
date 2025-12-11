import { IsNotEmpty, IsString } from 'class-validator';

export class CreateGroupDto {
    @IsString()
    @IsNotEmpty()
    name: string; // למשל: "The Cohen Family"
}