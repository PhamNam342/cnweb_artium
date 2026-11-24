import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { MAIL_CONFIG } from './mail.config';
import type { MailConfig } from './mail.config';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Gửi email qua SMTP (nodemailer). Không cấu hình SMTP_HOST => chỉ ghi log. */
@Injectable()
export class MailService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: Transporter;

  constructor(@Inject(MAIL_CONFIG) private readonly config: MailConfig) {
    if (config.host) {
      this.transporter = createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.user
          ? { user: config.user, pass: config.pass }
          : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
    }
  }

  get enabled(): boolean {
    return Boolean(this.transporter);
  }

  /** Kiểm tra kết nối SMTP lúc khởi động — chỉ cảnh báo, không chặn service. */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        'Chưa cấu hình SMTP_HOST: email sẽ chỉ được ghi ra log, không gửi thật',
      );
      return;
    }
    try {
      await this.transporter.verify();
      this.logger.log(`SMTP sẵn sàng: ${this.config.host}:${this.config.port}`);
    } catch (err) {
      this.logger.warn(
        `Chưa kết nối được SMTP (${this.config.host}): ${(err as Error).message}`,
      );
    }
  }

  async send(msg: MailMessage): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[MAIL - chưa cấu hình SMTP] tới ${msg.to}: ${msg.subject}\n${msg.text}`,
      );
      return;
    }
    const info = (await this.transporter.sendMail({
      from: this.config.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    })) as { messageId?: string };
    this.logger.log(
      `Đã gửi "${msg.subject}" tới ${msg.to} (${info.messageId ?? 'no-id'})`,
    );
  }

  onModuleDestroy(): void {
    this.transporter?.close();
  }
}
