/** E2E outbox relay trên identity_db (đã migrate) với publisher giả. */
import { loadServiceEnv } from '@app/common';
import { EventEnvelope } from '@app/contracts';
import { RabbitMqService } from '@app/messaging';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { InboxMessage } from '../src/outbox/inbox-message.entity';
import { InboxService } from '../src/outbox/inbox.service';
import {
  OutboxMessage,
  OutboxStatus,
} from '../src/outbox/outbox-message.entity';
import { OutboxRelayService } from '../src/outbox/outbox-relay.service';
import { OutboxService } from '../src/outbox/outbox.service';

describe('Outbox relay + inbox (e2e)', () => {
  let ds: DataSource;
  const aggregateId = randomUUID();
  const config = {
    get: (_k: string, d?: unknown) => d,
  } as unknown as ConfigService;

  beforeAll(async () => {
    loadServiceEnv('identity');
    ds = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [OutboxMessage, InboxMessage],
    });
    await ds.initialize();
    // Dọn các message pending cũ để test xác định
    await ds.query(
      `UPDATE outbox SET status = 'published' WHERE status = 'pending'`,
    );
  });

  afterAll(async () => {
    await ds.query(`DELETE FROM outbox WHERE aggregate_id = $1`, [aggregateId]);
    await ds.destroy();
  });

  it('publish thành công => published; broker lỗi => backoff', async () => {
    await ds.transaction((m) =>
      new OutboxService().enqueue(m, {
        aggregateType: 'Test',
        aggregateId,
        type: 'test.happened',
        payload: { n: 1 },
      }),
    );

    const failing = {
      publish: jest.fn().mockRejectedValue(new Error('broker down')),
    };
    const relayFail = new OutboxRelayService(
      ds,
      failing as unknown as RabbitMqService,
      config,
    );
    await relayFail.tick();
    let [row] = await ds.getRepository(OutboxMessage).findBy({ aggregateId });
    expect(row.status).toBe(OutboxStatus.Pending);
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe('broker down');
    expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());

    await ds
      .getRepository(OutboxMessage)
      .update(row.id, { availableAt: new Date(0) });
    const sent: EventEnvelope[] = [];
    const ok = {
      publish: jest.fn((e: EventEnvelope) => (sent.push(e), Promise.resolve())),
    };
    await new OutboxRelayService(
      ds,
      ok as unknown as RabbitMqService,
      config,
    ).tick();
    [row] = await ds.getRepository(OutboxMessage).findBy({ aggregateId });
    expect(row.status).toBe(OutboxStatus.Published);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      id: row.id,
      type: 'test.happened',
      payload: { n: 1 },
    });
  });

  it('inbox chỉ xử lý mỗi message một lần', async () => {
    const inbox = new InboxService(ds);
    const id = randomUUID();
    const handler = jest.fn(() => Promise.resolve());
    expect(await inbox.processOnce(id, 'test-consumer', handler)).toBe(true);
    expect(await inbox.processOnce(id, 'test-consumer', handler)).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
    await ds.query(`DELETE FROM inbox WHERE message_id = $1`, [id]);
  });
});
