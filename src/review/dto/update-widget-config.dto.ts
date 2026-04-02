import { Transform } from 'class-transformer';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsIn,
  IsUrl,
  Min,
  Max,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';

const HEX_COLOR = /^#([0-9a-fA-F]{3,8})$/;

export class UpdateWidgetConfigDto {
  @IsString() @IsOptional() @MaxLength(200) titleText?: string;
  @IsString() @IsOptional() @Matches(HEX_COLOR) accentColor?: string;
  @IsString() @IsOptional() @Matches(HEX_COLOR) starColor?: string;
  @IsString() @IsOptional() @Matches(HEX_COLOR) starBgColor?: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'starIconUrl must be a valid HTTPS URL' })
  @MaxLength(500)
  starIconUrl?: string;
  @IsString() @IsOptional() @Matches(HEX_COLOR) textColor?: string;
  @IsString() @IsOptional() @Matches(HEX_COLOR) mutedColor?: string;
  @IsString() @IsOptional() @Matches(HEX_COLOR) bgColor?: string;
  @IsString() @IsOptional() @Matches(HEX_COLOR) bgAltColor?: string;
  @IsString() @IsOptional() @Matches(HEX_COLOR) borderColor?: string;
  @IsString() @IsOptional() @Matches(HEX_COLOR) verifiedColor?: string;
  @IsInt() @IsOptional() @Min(0) @Max(50) radius?: number;
  @IsBoolean() @IsOptional() autoApprove?: boolean;
  @IsBoolean() @IsOptional() showTitle?: boolean;
  @IsBoolean() @IsOptional() showDate?: boolean;
  @IsBoolean() @IsOptional() showFilter?: boolean;
  @IsBoolean() @IsOptional() showSort?: boolean;
  @IsIn(['hidden', 'mask', 'full']) @IsOptional() emailDisplay?:
    | 'hidden'
    | 'mask'
    | 'full';
  @IsIn(['hidden', 'mask', 'full']) @IsOptional() phoneDisplay?:
    | 'hidden'
    | 'mask'
    | 'full';
  @IsIn(['hidden', 'optional', 'required']) @IsOptional() formEmailMode?:
    | 'hidden'
    | 'optional'
    | 'required';
  @IsIn(['hidden', 'optional', 'required']) @IsOptional() formPhoneMode?:
    | 'hidden'
    | 'optional'
    | 'required';
  @IsIn(['hidden', 'optional', 'required']) @IsOptional() formTitleMode?:
    | 'hidden'
    | 'optional'
    | 'required';
  @IsIn(['hidden', 'optional', 'required']) @IsOptional() formContentMode?:
    | 'hidden'
    | 'optional'
    | 'required';
  @IsIn(['list', 'grid', 'masonry']) @IsOptional() reviewLayout?: 'list' | 'grid' | 'masonry';
  @IsInt() @IsOptional() @Min(1) @Max(50) reviewItemsPerPage?: number;
  @IsBoolean() @IsOptional() allowImage?: boolean;
  @IsBoolean() @IsOptional() allowVideo?: boolean;
  @IsBoolean() @IsOptional() allowQnA?: boolean;
  @IsIn(['list', 'grid']) @IsOptional() qnaDisplayMode?: 'list' | 'grid';
  @IsInt() @IsOptional() @Min(1) @Max(50) qnaItemsPerPage?: number;
  @IsBoolean() @IsOptional() allowReply?: boolean;
  @IsString() @IsOptional() @MaxLength(100) replyBadgeText?: string;
  @IsString() @IsOptional() @Matches(HEX_COLOR) replyBgColor?: string;
  @IsString() @IsOptional() @Matches(HEX_COLOR) replyBorderColor?: string;
  @IsBoolean() @IsOptional() showVerified?: boolean;
  @IsBoolean() @IsOptional() showVerifiedAll?: boolean;
  @IsBoolean() @IsOptional() requireLogin?: boolean;
}
