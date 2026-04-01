import { IsString, IsOptional, MaxLength, IsEmail } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @MaxLength(1000)
  question: string;

  @IsString()
  @MaxLength(100)
  author: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
