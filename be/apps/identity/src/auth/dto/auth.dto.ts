import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsJWT,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const toLowerTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Ít nhất 8 ký tự, có chữ và số. */
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const PASSWORD_MESSAGE =
  'Mật khẩu 8-72 ký tự, gồm ít nhất một chữ cái và một chữ số';

export class RegisterDto {
  @Transform(toLowerTrim)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;

  @IsString()
  @Length(2, 255)
  fullName!: string;
}

export class LoginDto {
  @Transform(toLowerTrim)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class GoogleLoginDto {
  /** ID token (credential) nhận từ Google Identity Services ở FE. */
  @IsJWT()
  idToken!: string;
}

export class RefreshDto {
  /** Không bắt buộc: mặc định đọc từ cookie httpOnly `artium_rt`. Dùng cho mobile/Postman. */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ForgotPasswordDto {
  @Transform(toLowerTrim)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}

export class ChangePasswordWithCodeDto {
  /** Mã 6 chữ số trong email */
  @Matches(/^\d{6}$/, { message: 'Mã gồm 6 chữ số' })
  code!: string;

  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}

export class ChangePasswordDto {
  /** Bỏ trống nếu tài khoản chưa có mật khẩu (đăng ký bằng Google) — khi đó là đặt mật khẩu lần đầu. */
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}
