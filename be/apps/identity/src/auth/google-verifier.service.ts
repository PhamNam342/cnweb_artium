import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { IDENTITY_CONFIG } from '../config/identity-config.provider';
import type { IdentityConfig } from '../config/identity-env';

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

@Injectable()
export class GoogleVerifierService {
  private readonly client = new OAuth2Client();

  constructor(
    @Inject(IDENTITY_CONFIG) private readonly config: IdentityConfig,
  ) {}

  /** Xác minh ID token với khóa công khai của Google và đúng audience (GOOGLE_CLIENT_ID). */
  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!this.config.googleClientId) {
      throw new ServiceUnavailableException(
        'Đăng nhập Google chưa được cấu hình',
      );
    }
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.config.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google ID token không hợp lệ');
    }
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Google ID token thiếu thông tin email');
    }
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name ?? payload.email.split('@')[0],
      picture: payload.picture ?? null,
    };
  }
}
