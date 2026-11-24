import { EventEnvelope } from '@app/contracts';
import { RabbitMqService } from '@app/messaging';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { OutboxMessage, OutboxStatus } from './outbox-message.entity';

const MAX_ATTEMPTS = 10;

/**
 * Đọc outbox định kỳ và publish lên RabbitMQ.
 * FOR UPDATE SKIP LOCKED => chạy nhiều instance service cũng không publish trùng.
 * Lỗi => backoff lũy thừa (tối đa 5 phút), quá MAX_ATTEMPTS => failed.
 */
@Injectable()
export class OutboxRelayService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly source: string;
  private readonly intervalMs: number;
  private readonly enabled: boolean;

  constructor(
    private readonly dataSource: DataSource,
    private readonly rabbit: RabbitMqService,
    config: ConfigService,
  ) {
    this.source = config.get<string>('SERVICE_NAME', 'unknown');
    this.intervalMs = Number(config.get('OUTBOX_POLL_INTERVAL_MS', 1000));
    this.enabled =
      config.get<string>('OUTBOX_RELAY_ENABLED', 'true') === 'true';
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(batchSize = 50): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(OutboxMessage);
        const batch = await repo
          .createQueryBuilder('o')
          .where('o.status = :status', { status: OutboxStatus.Pending })
          .andWhere('o.available_at <= now()')
          .orderBy('o.created_at', 'ASC')
          .limit(batchSize)
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getMany();

        for (const msg of batch) {
          const envelope: EventEnvelope = {
            id: msg.id,
            type: msg.eventType,
            source: this.source,
            occurredAt: msg.createdAt.toISOString(),
            payload: msg.payload,
          };
          try {
            await this.rabbit.publish(envelope);
            await repo.update(msg.id, {
              status: OutboxStatus.Published,
              publishedAt: new Date(),
              attempts: msg.attempts + 1,
              lastError: null,
            });
          } catch (err) {
            const attempts = msg.attempts + 1;
            const delayMs = Math.min(2 ** attempts * 1000, 5 * 60 * 1000);
            await repo.update(msg.id, {
              attempts,
              status:
                attempts >= MAX_ATTEMPTS
                  ? OutboxStatus.Failed
                  : OutboxStatus.Pending,
              availableAt: new Date(Date.now() + delayMs),
              lastError: (err as Error).message,
            });
            this.logger.warn(
              `Publish ${msg.eventType} (${msg.id}) lỗi lần ${attempts}`,
            );
            break; // giữ thứ tự: dừng batch khi broker lỗi
          }
        }
        return batch.length;
      });
    } catch (err) {
      this.logger.error(`Outbox relay lỗi: ${(err as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
