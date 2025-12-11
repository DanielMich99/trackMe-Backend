import { IsNotEmpty, IsString } from 'class-validator';

export class JoinGroupDto {
    @IsString()
    @IsNotEmpty()
    joinCode: string; // למשל: "X9F2KD"
}