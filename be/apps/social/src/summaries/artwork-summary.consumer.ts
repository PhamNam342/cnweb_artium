import {
  ArtworkSnapshotPayload,
  CatalogEvents,
  EventEnvelope,
} from '@app/contracts';
import { InboxService } from '@app/database';
import { RabbitMqService } from '@app/messaging';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const ARTWORK_SUMMARY_QUEUE = 'social.catalog-artworks';
const CONSUMER = 'social.artwork-summary';

const ROUTING_KEYS = [
  CatalogEvents.ArtworkPublished,
  CatalogEvents.ArtworkUpdated,
  CatalogEvents.ArtworkArchived,
];

/** Trạng thái tác phẩm được coi là công khai (khớp catalog: published | sold_out). */
const PUBLIC_STATUSES = ['published', 'sold_out'];

/**
 * Dựng bảng artwork_summaries từ event catalog.
 * - published / updated: upsert, is_public theo status.
 * - archived (gỡ, lưu trữ, xóa): is_public = false, KHÔNG xóa dòng.
 * - Idempotent nhờ inbox; event đến trễ không ghi đè.
 */
@Injectable()
export class ArtworkSummaryConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(ArtworkSummaryConsumer.name);

  constructor(
    private readonly rabbit: RabbitMqService,
    private readonly inbox: InboxService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get('EVENT_CONSUMERS_ENABLED', 'true') !== 'true') return;
    await this.rabbit.subscribe({
      queue: ARTWORK_SUMMARY_QUEUE,
      routingKeys: ROUTING_KEYS,
      prefetch: 10,
      handler: async (envelope) => {
        await this.handle(envelope);
      },
    });
  }

  async handle(envelope: EventEnvelope): Promise<boolean> {
    if (!(ROUTING_KEYS as string[]).includes(envelope.type)) return false;
    const p = envelope.payload as ArtworkSnapshotPayload;
    const isPublic =
      envelope.type !== CatalogEvents.ArtworkArchived &&
      PUBLIC_STATUSES.includes(p.status);
    const done = await this.inbox.processOnce(
      envelope.id,
      CONSUMER,
      async (m) => {
        await m.query(
          `INSERT INTO artwork_summaries (artwork_id, seller_id, title, cover_image_url, is_public, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (artwork_id) DO UPDATE SET
             seller_id = EXCLUDED.seller_id,
             title = EXCLUDED.title,
             cover_image_url = EXCLUDED.cover_image_url,
             is_public = EXCLUDED.is_public,
             updated_at = EXCLUDED.updated_at
           WHERE artwork_summaries.updated_at <= EXCLUDED.updated_at`,
          [
            p.artworkId,
            p.sellerId,
            p.title,
            p.coverImageUrl,
            isPublic,
            envelope.occurredAt,
          ],
        );
      },
    );
    if (done)
      this.logger.log(
        `Cập nhật artwork_summary ${p.artworkId} (public=${isPublic})`,
      );
    return done;
  }
}
