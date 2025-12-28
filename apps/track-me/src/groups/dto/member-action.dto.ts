import { IsNotEmpty, IsUUID } from 'class-validator';

// DTO for admin actions on group members (approve, kick, promote, demote, reject)
export class MemberActionDto {
    @IsNotEmpty()
    @IsUUID()
    groupId: string;

    @IsNotEmpty()
    @IsUUID()
    userId: string; // The target user to perform action on
}
