import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  CreateSellerProfileDto,
  SellerWebsiteDto,
} from '../sellers/dto/seller.dto';
import { UserResponse } from '../users/user.mapper';

export type OnboardingRole = 'collector' | 'artist';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class OnboardingDto {
  @ApiProperty({ enum: ['collector', 'artist'] })
  @IsIn(['collector', 'artist'])
  role!: OnboardingRole;

  @Transform(trim)
  @IsString()
  @Length(2, 255)
  fullName!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1024)
  avatarUrl?: string;

  @IsOptional()
  @Matches(/^(\+84|0)\d{9,10}$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  city?: string;

  /** Slug thể loại, VD: ['son-dau', 'nhiep-anh'] */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    each: true,
    message: 'Sở thích không hợp lệ',
  })
  interests?: string[];

  /** Bắt buộc khi role = artist. */
  @ValidateIf((o: OnboardingDto) => o.role === 'artist')
  @IsDefined({ message: 'Nghệ sĩ cần điền hồ sơ người bán' })
  @ValidateNested()
  @Type(() => CreateSellerProfileDto)
  seller?: CreateSellerProfileDto;

  /** Chỉ dùng khi role = artist (bước 3, không bắt buộc). */
  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMaxSize(20)
  @Type(() => SellerWebsiteDto)
  websites?: SellerWebsiteDto[];
}

export class OnboardingResponse {
  user!: UserResponse;
  /** Access token mới (đã có role seller nếu chọn nghệ sĩ) — FE thay token đang giữ. */
  accessToken!: string;
  expiresIn!: number;
}
