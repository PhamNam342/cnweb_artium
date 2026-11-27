import {
  EmailVerificationRequestedPayload,
  EventEnvelope,
  IdentityEvents,
  PasswordChangeCodeRequestedPayload,
  PasswordResetRequestedPayload,
} from '@app/contracts';
import { InboxService } from '@app/database';
import { RabbitMqService } from '@app/messaging';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { MAIL_CONFIG } from './mail.config';
import type { MailConfig } from './mail.config';
import {
  passwordChangeCodeEmail,
  passwordResetEmail,
  verificationEmail,
} from './mail-templates';
import { MailMessage, MailService } from './mail.service';

export const MAILER_QUEUE = 'identity.mailer';
const CONSUMER = 'identity.mailer';
/** Thời gian chờ giữa các lần thử lại khi SMTP lỗi (ms). Hết lượt => message vào DLQ. */
export const RETRY_DELAYS_MS = [1_000, 5_000, 15_000];

/**
 * Nhận event "cần gửi email" từ RabbitMQ (do outbox của chính identity phát) và gửi qua SMTP.
 * - Idempotent: mỗi message chỉ gửi một lần nhờ bảng inbox.
 * - Link đã hết hạn thì bỏ qua (VD: broker tồn đọng lâu).
 * Sau này chuyển sang social service chỉ cần dời thư mục mail/.
 */
@Injectable()
export class IdentityMailerConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(IdentityMailerConsumer.name);
  /** Cho phép test thay hàm chờ. */
  sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  constructor(
    private readonly rabbit: RabbitMqService,
    private readonly inbox: InboxService,
    private readonly mail: MailService,
    @Inject(MAIL_CONFIG) private readonly config: MailConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.consumerEnabled) return;
    await this.rabbit.subscribe({
      queue: MAILER_QUEUE,
      routingKeys: [
        IdentityEvents.EmailVerificationRequested,
        IdentityEvents.PasswordResetRequested,
        IdentityEvents.PasswordChangeCodeRequested,
      ],
      prefetch: 5,
      handler: async (envelope) => {
        await this.handle(envelope);
      },
    });
  }

  /** Trả về true nếu đã gửi, false nếu bỏ qua (trùng, hết hạn, không nhận diện). */
  async handle(envelope: EventEnvelope): Promise<boolean> {
    const message = this.buildMessage(envelope);
    if (!message) return false;

    const expiresAt = (envelope.payload as { expiresAt?: string }).expiresAt;
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      this.logger.warn(
        `Bỏ qua ${envelope.type} (${envelope.id}): liên kết đã hết hạn`,
      );
      return false;
    }

    const sent = await this.inbox.processOnce(envelope.id, CONSUMER, () =>
      this.sendWithRetry(message),
    );
    if (!sent) this.logger.log(`Bỏ qua message trùng ${envelope.id}`);
    return sent;
  }

  private buildMessage(envelope: EventEnvelope): MailMessage | null {
    switch (envelope.type) {
      case IdentityEvents.EmailVerificationRequested:
        return verificationEmail(
          envelope.payload as EmailVerificationRequestedPayload,
        );
      case IdentityEvents.PasswordResetRequested:
        return passwordResetEmail(
          envelope.payload as PasswordResetRequestedPayload,
        );
      case IdentityEvents.PasswordChangeCodeRequested:
        return passwordChangeCodeEmail(
          envelope.payload as PasswordChangeCodeRequestedPayload,
        );
      default:
        return null;
    }
  }

  private async sendWithRetry(message: MailMessage): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        await this.mail.send(message);
        return;
      } catch (err) {
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) throw err;
        this.logger.warn(
          `Gửi mail tới ${message.to} lỗi (lần ${attempt + 1}): ${(err as Error).message}. Thử lại sau ${delay}ms`,
        );
        await this.sleep(delay);
      }
    }
  }
}
