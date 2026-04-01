import {
  IsInt,
  IsString,
  IsArray,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsPositive,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  IsIn,
  IsUrl,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class MediaItemDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url: string;

  @IsIn(['image', 'video'])
  type: 'image' | 'video';
}

export class UpdateReviewDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  content?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  author?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  title?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(200)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsBoolean()
  @IsOptional()
  verified?: boolean;

  @IsBoolean()
  @IsOptional()
  pinned?: boolean;

  @IsIn(['approved', 'pending', 'hidden', 'spam'])
  @IsOptional()
  status?: string;

  @IsPositive()
  @IsOptional()
  created_at?: number;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  media?: MediaItemDto[];
}
