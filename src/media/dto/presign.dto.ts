import {
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
  IsIn,
} from 'class-validator';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
] as const;

export class PresignDto {
  @IsString()
  @MaxLength(100)
  productId: string;

  @IsString()
  @MaxLength(255)
  @Matches(/^(?!.*\.\.)(?!.*[/\\])[\s\S]+$/, { message: 'Invalid filename' })
  filename: string;

  @IsIn(ALLOWED_TYPES)
  contentType: string;

  @IsInt()
  @Min(1)
  @Max(52428800) // 50 MB max
  fileSize: number;
}
