import { IsNotEmpty, IsString } from 'class-validator';

export class CreateGroupDto {
    @IsString()
    @IsNotEmpty()
    name: string; // Example: "The Smith Family"
}