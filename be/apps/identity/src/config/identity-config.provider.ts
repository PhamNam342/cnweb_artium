import { ConfigService } from '@nestjs/config';
import { IdentityConfig } from './identity-env';

export const IDENTITY_CONFIG = Symbol('IDENTITY_CONFIG');

export const identityConfigProvider = {
  provide: IDENTITY_CONFIG,
  inject: [ConfigService],
  useFactory: (c: ConfigService): IdentityConfig => ({
    accessTtlSeconds: Number(c.get('JWT_ACCESS_TTL_SECONDS')),
    refreshTtlDays: Number(c.get('REFRESH_TOKEN_TTL_DAYS')),
    refreshReuseGraceSeconds: Number(c.get('REFRESH_REUSE_GRACE_SECONDS')),
    emailVerificationTtlHours: Number(c.get('EMAIL_VERIFICATION_TTL_HOURS')),
    passwordResetTtlMinutes: Number(c.get('PASSWORD_RESET_TTL_MINUTES')),
    passwordChangeCodeTtlMinutes: Number(
      c.get('PASSWORD_CHANGE_CODE_TTL_MINUTES'),
    ),
    googleClientId: c.get<string>('GOOGLE_CLIENT_ID', ''),
    cookieSecure: c.get<string>('COOKIE_SECURE') === 'true',
    webOrigin: c.getOrThrow<string>('WEB_ORIGIN'),
  }),
};
