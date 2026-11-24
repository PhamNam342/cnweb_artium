import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  SellerProfileType,
  SellerVerificationStatus,
} from '../entities/seller-profile.entity';

class SocialLinksDto {
  @IsOptional() @IsUrl({ require_protocol: true }) instagram?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) facebook?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) tiktok?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) website?: string;
}

export class CreateSellerProfileDto {
  @IsString()
  @Length(2, 255)
  displayName!: string;

  /** Bỏ trống => tự sinh từ displayName. Chỉ gồm a-z, 0-9, dấu gạch ngang. */
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ gồm a-z, 0-9 và dấu gạch ngang',
  })
  @Length(3, 120)
  slug?: string;

  @IsOptional()
  @IsEnum(SellerProfileType)
  profileType?: SellerProfileType;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1024)
  avatarUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1024)
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;

  @IsOptional()
  @Matches(/^\d{10}(-\d{3})?$/, { message: 'Mã số thuế không hợp lệ' })
  taxCode?: string;

  @IsOptional()
  @IsObject()
  businessAddress?: Record<string, string>;
}

export class UpdateSellerProfileDto extends PartialType(
  CreateSellerProfileDto,
) {}

export class SellerWebsiteDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  type?: string;

  @IsString()
  @Length(1, 255)
  title!: string;

  @IsUrl({ require_protocol: true })
  @MaxLength(1024)
  url!: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class ReplaceWebsitesDto {
  @ValidateNested({ each: true })
  @ArrayMaxSize(20)
  @Type(() => SellerWebsiteDto)
  websites!: SellerWebsiteDto[];
}

export class SetVerificationDto {
  @ApiProperty({
    enum: [
      SellerVerificationStatus.Verified,
      SellerVerificationStatus.Rejected,
    ],
  })
  @IsEnum(SellerVerificationStatus)
  status!: SellerVerificationStatus;
}

export class SlugQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}

export class SlugAvailabilityResponse {
  slug!: string;
  available!: boolean;
  reason?: string;
}
