import {
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(2, 255)
  fullName?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1024)
  avatarUrl?: string | null;

  /** Số điện thoại Việt Nam, VD: 0912345678 hoặc +84912345678 */
  @IsOptional()
  @Matches(/^(\+84|0)\d{9,10}$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string | null;
}
