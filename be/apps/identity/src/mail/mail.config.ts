import { ConfigService } from '@nestjs/config';
import * as Joi from 'joi';

export const mailEnvSchema: Joi.PartialSchemaMap = {
  /** Bỏ trống => không gửi thật, chỉ ghi nội dung mail ra log (tiện khi dev không có SMTP). */
  SMTP_HOST: Joi.string().allow('').default(''),
  SMTP_PORT: Joi.number().port().default(1025),
  /** true cho cổng 465 (SSL). Cổng 587/25/1025 dùng false (STARTTLS tự nâng cấp nếu server hỗ trợ). */
  SMTP_SECURE: Joi.string().valid('true', 'false').default('false'),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASS: Joi.string().allow('').default(''),
  MAIL_FROM: Joi.string().default('Artium <no-reply@artium.local>'),
  /** Bật/tắt consumer gửi mail của identity (tắt khi chạy test). */
  MAILER_ENABLED: Joi.string().valid('true', 'false').default('true'),
};

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  consumerEnabled: boolean;
}

export const MAIL_CONFIG = Symbol('MAIL_CONFIG');

export const mailConfigProvider = {
  provide: MAIL_CONFIG,
  inject: [ConfigService],
  useFactory: (c: ConfigService): MailConfig => ({
    host: c.get<string>('SMTP_HOST', ''),
    port: Number(c.get('SMTP_PORT', 1025)),
    secure: c.get<string>('SMTP_SECURE') === 'true',
    user: c.get<string>('SMTP_USER', ''),
    pass: c.get<string>('SMTP_PASS', ''),
    from: c.get<string>('MAIL_FROM', 'Artium <no-reply@artium.local>'),
    consumerEnabled: c.get<string>('MAILER_ENABLED', 'true') === 'true',
  }),
};
