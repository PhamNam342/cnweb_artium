import type { AuthUser } from '@app/common';
import { CurrentUser, Public } from '@app/common';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { IDENTITY_CONFIG } from '../config/identity-config.provider';
import type { IdentityConfig } from '../config/identity-env';
import { AuthSession, AuthService } from './auth.service';
import { AuthResponse, MessageResponse } from './dto/auth-response';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie';
import { ClientMeta } from './token.service';

/** Giới hạn chặt cho route nhạy cảm: 10 request / phút / IP. */
const STRICT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(IDENTITY_CONFIG) private readonly config: IdentityConfig,
  ) {}

  /** Đăng ký bằng email + mật khẩu. Refresh token trả trong cookie httpOnly. */
  @Public()
  @Throttle(STRICT)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.register(dto, meta(req)));
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.login(dto, meta(req)));
  }

  /** Đăng nhập/đăng ký bằng Google ID token (Google Identity Services ở FE). */
  @Public()
  @Throttle(STRICT)
  @HttpCode(HttpStatus.OK)
  @Post('google')
  async google(
    @Body() dto: GoogleLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(
      res,
      await this.auth.loginWithGoogle(dto.idToken, meta(req)),
    );
  }

  /** Cấp access token mới + xoay vòng refresh token (cookie hoặc body). */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const raw = dto.refreshToken ?? readRefreshCookie(req);
    try {
      return this.respond(res, await this.auth.refresh(raw, meta(req)));
    } catch (err) {
      clearRefreshCookie(res, this.config.cookieSecure);
      throw err;
    }
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponse> {
    await this.auth.logout(dto.refreshToken ?? readRefreshCookie(req));
    clearRefreshCookie(res, this.config.cookieSecure);
    return { message: 'Đã đăng xuất' };
  }

  /** Đăng xuất khỏi mọi thiết bị. */
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponse> {
    await this.auth.logoutAll(user.id);
    clearRefreshCookie(res, this.config.cookieSecure);
    return { message: 'Đã đăng xuất khỏi tất cả thiết bị' };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponse> {
    await this.auth.verifyEmail(dto.token);
    return { message: 'Xác minh email thành công' };
  }

  @ApiBearerAuth()
  @Throttle(STRICT)
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('resend-verification')
  async resendVerification(
    @CurrentUser() user: AuthUser,
  ): Promise<MessageResponse> {
    await this.auth.resendVerification(user.id);
    return { message: 'Đã gửi lại email xác minh' };
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<MessageResponse> {
    await this.auth.forgotPassword(dto.email);
    return {
      message: 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi',
    };
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponse> {
    await this.auth.resetPassword(dto);
    return { message: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại' };
  }

  @ApiBearerAuth()
  @Throttle(STRICT)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<MessageResponse> {
    await this.auth.changePassword(user.id, dto);
    return { message: 'Đổi mật khẩu thành công' };
  }

  private respond(res: Response, session: AuthSession): AuthResponse {
    setRefreshCookie(
      res,
      session.refresh.token,
      session.refresh.expiresAt,
      this.config.cookieSecure,
    );
    return session.body;
  }
}

function meta(req: Request): ClientMeta {
  return { userAgent: req.get('user-agent'), ipAddress: req.ip };
}
