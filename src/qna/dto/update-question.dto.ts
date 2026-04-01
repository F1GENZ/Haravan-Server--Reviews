import { IsString, IsOptional, MaxLength, IsEmail } from 'class-validator';

export class UpdateQuestionDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  question?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  author?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  answer?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  answered_by?: string;
}
