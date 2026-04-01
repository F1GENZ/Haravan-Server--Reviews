import {
  IsBoolean,
  IsInt,
  IsArray,
  IsString,
  IsOptional,
  Min,
  Max,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';

export class UpdateSpamConfigDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  autoApprove?: boolean;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(500)
  minContentLength?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(20)
  maxUrls?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(50)
  maxReviewsPerAuthor?: number;

  @IsBoolean()
  @IsOptional()
  blockDuplicate?: boolean;

  @IsBoolean()
  @IsOptional()
  blockRepeatedChars?: boolean;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  blockedWords?: string[];
}
