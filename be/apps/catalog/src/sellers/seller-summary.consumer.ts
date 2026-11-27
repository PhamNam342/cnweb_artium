import {
  EventEnvelope,
  IdentityEvents,
  SellerProfileUpsertedPayload,
} from '@app/contracts';
import { InboxService } from '@app/database';
import { RabbitMqService } from '@app/messaging';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const SELLER_SUMMARY_QUEUE = 'catalog.identity-sellers';
const CONSUMER = 'catalog.seller-summary';

/**
 * Dựng bảng seller_summaries (projection) từ event identity.seller_profile.upserted,
 * để catalog hiển thị tên / avatar / slug nghệ sĩ mà không phải gọi sang identity.
 * - Idempotent nhờ inbox.
 * - Event đến trễ (occurredAt cũ hơn bản đang lưu) không ghi đè dữ liệu mới.
 */
@Injectable()
export class SellerSummaryConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(SellerSummaryConsumer.name);

  constructor(
    private readonly rabbit: RabbitMqService,
    private readonly inbox: InboxService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get('EVENT_CONSUMERS_ENABLED', 'true') !== 'true') return;
    await this.rabbit.subscribe({
      queue: SELLER_SUMMARY_QUEUE,
      routingKeys: [IdentityEvents.SellerProfileUpserted],
      prefetch: 10,
      handler: async (envelope) => {
        await this.handle(envelope);
      },
    });
  }

  async handle(envelope: EventEnvelope): Promise<boolean> {
    if (envelope.type !== IdentityEvents.SellerProfileUpserted) return false;
    const p = envelope.payload as SellerProfileUpsertedPayload;
    const done = await this.inbox.processOnce(
      envelope.id,
      CONSUMER,
      async (m) => {
        await m.query(
          `INSERT INTO seller_summaries (seller_id, slug, display_name, avatar_url, is_verified, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (seller_id) DO UPDATE SET
           slug = EXCLUDED.slug,
           display_name = EXCLUDED.display_name,
           avatar_url = EXCLUDED.avatar_url,
           is_verified = EXCLUDED.is_verified,
           updated_at = EXCLUDED.updated_at
         WHERE seller_summaries.updated_at <= EXCLUDED.updated_at`,
          [
            p.sellerId,
            p.slug,
            p.displayName,
            p.avatarUrl,
            p.isVerified,
            envelope.occurredAt,
          ],
        );
      },
    );
    if (done)
      this.logger.log(`Cập nhật seller_summary ${p.sellerId} (${p.slug})`);
    return done;
  }
}
