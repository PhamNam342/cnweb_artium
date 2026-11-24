import { EVENTS_EXCHANGE, EventEnvelope } from '@app/contracts';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Channel,
  ChannelModel,
  ConfirmChannel,
  connect,
  ConsumeMessage,
} from 'amqplib';

export interface SubscribeOptions {
  /** Tên queue bền vững, VD: 'social.identity-events'. */
  queue: string;
  routingKeys: string[];
  handler: (envelope: EventEnvelope, raw: ConsumeMessage) => Promise<void>;
  prefetch?: number;
}

const RECONNECT_DELAY_MS = 5000;

/**
 * Kết nối RabbitMQ có tự kết nối lại.
 * - publish: confirm channel => chỉ resolve khi broker đã nhận (outbox mới đánh dấu published).
 * - subscribe: consumer được dựng lại sau khi reconnect; handler lỗi => nack vào '<queue>.dlq'.
 */
@Injectable()
export class RabbitMqService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection?: ChannelModel;
  private connecting?: Promise<ChannelModel>;
  private publisher?: Promise<ConfirmChannel>;
  private readonly subscriptions: SubscribeOptions[] = [];
  private reconnectTimer?: NodeJS.Timeout;
  private closing = false;

  constructor(private readonly config: ConfigService) {}

  async publish(envelope: EventEnvelope, timeoutMs = 5000): Promise<void> {
    const channel = await this.withTimeout(
      this.getPublisher(),
      timeoutMs,
      'Kết nối RabbitMQ',
    );
    await this.withTimeout(
      new Promise<void>((resolve, reject) => {
        channel.publish(
          EVENTS_EXCHANGE,
          envelope.type,
          Buffer.from(JSON.stringify(envelope)),
          {
            persistent: true,
            contentType: 'application/json',
            messageId: envelope.id,
            type: envelope.type,
            timestamp: Math.floor(Date.now() / 1000),
          },
          (err) =>
            err
              ? reject(err instanceof Error ? err : new Error(String(err)))
              : resolve(),
        );
      }),
      timeoutMs,
      'Publish',
    );
  }

  async subscribe(options: SubscribeOptions): Promise<void> {
    this.subscriptions.push(options);
    try {
      await this.setupConsumer(await this.getConnection(), options);
    } catch (err) {
      this.logger.warn(
        `Chưa subscribe được ${options.queue}: ${(err as Error).message}`,
      );
      this.scheduleReconnect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await this.connection?.close().catch(() => undefined);
  }

  // ------------------------------------------------------------------ nội bộ

  private getConnection(): Promise<ChannelModel> {
    if (this.connection) return Promise.resolve(this.connection);
    this.connecting ??= connect(
      this.config.getOrThrow<string>('RABBITMQ_URL'),
      {
        timeout: 5000,
      },
    )
      .then((conn) => {
        this.connection = conn;
        this.logger.log('Đã kết nối RabbitMQ');
        conn.on('error', (err: Error) =>
          this.logger.warn(`RabbitMQ lỗi: ${err.message}`),
        );
        conn.on('close', () => {
          this.connection = undefined;
          this.publisher = undefined;
          if (!this.closing) {
            this.logger.warn('Mất kết nối RabbitMQ, sẽ kết nối lại');
            this.scheduleReconnect();
          }
        });
        return conn;
      })
      .finally(() => {
        this.connecting = undefined;
      });
    return this.connecting;
  }

  private getPublisher(): Promise<ConfirmChannel> {
    this.publisher ??= this.getConnection()
      .then(async (conn) => {
        const ch = await conn.createConfirmChannel();
        await ch.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
        ch.on('close', () => (this.publisher = undefined));
        return ch;
      })
      .catch((err: Error) => {
        this.publisher = undefined;
        throw err;
      });
    return this.publisher;
  }

  private async setupConsumer(
    conn: ChannelModel,
    options: SubscribeOptions,
  ): Promise<void> {
    const dlq = `${options.queue}.dlq`;
    const ch = await conn.createChannel();
    await ch.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(dlq, { durable: true });
    await ch.assertQueue(options.queue, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: dlq,
    });
    for (const key of options.routingKeys) {
      await ch.bindQueue(options.queue, EVENTS_EXCHANGE, key);
    }
    await ch.prefetch(options.prefetch ?? 10);
    await ch.consume(options.queue, (msg) => {
      if (msg) void this.handle(ch, msg, options);
    });
    this.logger.log(
      `Đang lắng nghe ${options.queue} [${options.routingKeys.join(', ')}]`,
    );
  }

  private async handle(
    ch: Channel,
    msg: ConsumeMessage,
    options: SubscribeOptions,
  ) {
    try {
      const envelope = JSON.parse(msg.content.toString()) as EventEnvelope;
      await options.handler(envelope, msg);
      ch.ack(msg);
    } catch (err) {
      this.logger.error(
        `Xử lý message ${String(msg.properties.messageId)} thất bại: ${(err as Error).message}`,
      );
      ch.nack(msg, false, false);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.closing) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.getConnection()
        .then(async (conn) => {
          for (const sub of this.subscriptions)
            await this.setupConsumer(conn, sub);
        })
        .catch((err: Error) => {
          this.logger.warn(`Kết nối lại RabbitMQ thất bại: ${err.message}`);
          this.scheduleReconnect();
        });
    }, RECONNECT_DELAY_MS);
  }

  private withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
    let timer: NodeJS.Timeout;
    return Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${what} quá thời gian ${ms}ms`)),
          ms,
        );
      }),
    ]).finally(() => clearTimeout(timer));
  }
}
