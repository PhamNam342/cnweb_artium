import * as Joi from 'joi';

export const identityEnvSchema: Joi.PartialSchemaMap = {
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).default(30),
  /**
   * Trong khoảng này (giây) sau khi token bị xoay, dùng lại token cũ vẫn được cấp token mới
   * thay vì bị coi là đánh cắp — tránh đăng xuất oan khi nhiều tab refresh cùng lúc. 0 = tắt.
   */
  REFRESH_REUSE_GRACE_SECONDS: Joi.number()
    .integer()
    .min(0)
    .max(60)
    .default(10),
  EMAIL_VERIFICATION_TTL_HOURS: Joi.number().integer().min(1).default(24),
  PASSWORD_RESET_TTL_MINUTES: Joi.number().integer().min(5).default(30),
  /** Hạn của mã 6 số đổi mật khẩu gửi qua email. */
  PASSWORD_CHANGE_CODE_TTL_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(60)
    .default(10),
  /** Client ID OAuth của Google (Web). Bỏ trống => tắt đăng nhập Google. */
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  /** true khi chạy HTTPS (production) để cookie refresh token có cờ Secure. */
  COOKIE_SECURE: Joi.string().valid('true', 'false').default('false'),
};

export interface IdentityConfig {
  accessTtlSeconds: number;
  refreshTtlDays: number;
  refreshReuseGraceSeconds: number;
  emailVerificationTtlHours: number;
  passwordResetTtlMinutes: number;
  passwordChangeCodeTtlMinutes: number;
  googleClientId: string;
  cookieSecure: boolean;
  webOrigin: string;
}
