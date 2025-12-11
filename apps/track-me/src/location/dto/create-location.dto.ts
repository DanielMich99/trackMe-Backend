import { IsNotEmpty, IsNumber, IsString, IsUUID, Min, Max } from 'class-validator';

export class CreateLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsString()
  @IsUUID() // מוודא שזה מזהה משתמש תקין
  @IsNotEmpty()
  userId: string;
}