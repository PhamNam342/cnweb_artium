import {
  EventEnvelope,
  IdentityEvents,
  SellerProfileUpsertedPayload,
  UserRegisteredPayload,
  UserUpdatedPayload,
} from '@app/contracts';
import { InboxService } from '@app/database';
import { RabbitMqService } from '@app/messaging';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';

export const USER_SUMMARY_QUEUE = 'social.identity-users';
const CONSUMER = 'social.user-summary';

const ROUTING_KEYS = [
  IdentityEvents.UserRegistered,
  IdentityEvents.UserUpdated,
  IdentityEvents.SellerProfileUpserted,
];

/**
 * Dựng bảng user_summaries từ event identity.
 * - user.registered / user.updated: tên + avatar tài khoản.
 * - seller_profile.upserted: chỉ seller_slug (không đè tên tài khoản bằng tên hồ sơ nghệ sĩ);
 *   avatar chỉ được điền khi dòng chưa có avatar.
 * - Idempotent nhờ inbox; event đến trễ (occurredAt cũ hơn bản đang lưu) không ghi đè.
 */
@Injectable()
export class UserSummaryConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserSummaryConsumer.name);

  constructor(
    private readonly rabbit: RabbitMqService,
    private readonly inbox: InboxService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get('EVENT_CONSUMERS_ENABLED', 'true') !== 'true') return;
    await this.rabbit.subscribe({
      queue: USER_SUMMARY_QUEUE,
      routingKeys: ROUTING_KEYS,
      prefetch: 10,
      handler: async (envelope) => {
        await this.handle(envelope);
      },
    });
  }

  /** Trả về true nếu event được áp dụng lần đầu (false: không liên quan hoặc đã xử lý). */
  async handle(envelope: EventEnvelope): Promise<boolean> {
    if (!(ROUTING_KEYS as string[]).includes(envelope.type)) return false;
    const done = await this.inbox.processOnce(envelope.id, CONSUMER, (m) =>
      this.apply(m, envelope),
    );
    if (done) this.logger.log(`Cập nhật user_summary (${envelope.type})`);
    return done;
  }

  private async apply(m: EntityManager, e: EventEnvelope): Promise<void> {
    if (e.type === IdentityEvents.SellerProfileUpserted) {
      const p = e.payload as SellerProfileUpsertedPayload;
      // Chưa có dòng của user (event tài khoản chưa tới): tạm dùng tên hồ sơ, với updated_at = 1970-01-01
      // để event tài khoản đến sau luôn ghi đè được. updated_at chỉ theo dõi event tài khoản (tên, avatar).
      await m.query(
        `INSERT INTO user_summaries (user_id, full_name, avatar_url, seller_slug, updated_at)
         VALUES ($1, $2, $3, $4, 'epoch')
         ON CONFLICT (user_id) DO UPDATE SET
           seller_slug = EXCLUDED.seller_slug,
           avatar_url = COALESCE(user_summaries.avatar_url, EXCLUDED.avatar_url)`,
        [p.sellerId, p.displayName, p.avatarUrl, p.slug],
      );
      return;
    }
    const p = e.payload as UserRegisteredPayload | UserUpdatedPayload;
    await m.query(
      `INSERT INTO user_summaries (user_id, full_name, avatar_url, seller_slug, updated_at)
       VALUES ($1, $2, $3, NULL, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         avatar_url = EXCLUDED.avatar_url,
         updated_at = EXCLUDED.updated_at
       WHERE user_summaries.updated_at <= EXCLUDED.updated_at`,
      [p.userId, p.fullName, p.avatarUrl, e.occurredAt],
    );
  }
}
