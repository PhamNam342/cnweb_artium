import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class InboxService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Chạy handler đúng MỘT lần cho mỗi (messageId, consumer), trong một transaction.
   * Trả về false nếu message đã được xử lý trước đó.
   */
  async processOnce(
    messageId: string,
    consumer: string,
    handler: (manager: EntityManager) => Promise<void>,
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const rows: unknown[] = await manager.query(
        `INSERT INTO "inbox" ("message_id", "consumer") VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING "message_id"`,
        [messageId, consumer],
      );
      if (rows.length === 0) return false;
      await handler(manager);
      return true;
    });
  }
}
