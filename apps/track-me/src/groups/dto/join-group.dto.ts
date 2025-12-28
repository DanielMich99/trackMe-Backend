import { IsNotEmpty, IsString } from 'class-validator';

export class JoinGroupDto {
    @IsString()
    @IsNotEmpty()
    joinCode: string; // Example: "X9F2KD"
}