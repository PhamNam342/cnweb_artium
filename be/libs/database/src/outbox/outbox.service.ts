import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OutboxMessage } from './outbox-message.entity';

export interface DomainEvent<T extends object = object> {
  aggregateType: string;
  aggregateId: string;
  type: string;
  payload: T;
}

@Injectable()
export class OutboxService {
  /**
   * Ghi event vào outbox. PHẢI truyền `manager` của transaction đang ghi dữ liệu nghiệp vụ,
   * để event và dữ liệu cùng commit hoặc cùng rollback.
   */
  async enqueue(
    manager: EntityManager,
    ...events: DomainEvent[]
  ): Promise<void> {
    if (events.length === 0) return;
    const repo = manager.getRepository(OutboxMessage);
    await repo.save(
      events.map((e) => {
        const msg = new OutboxMessage();
        msg.aggregateType = e.aggregateType;
        msg.aggregateId = e.aggregateId;
        msg.eventType = e.type;
        msg.payload = e.payload as Record<string, unknown>;
        return msg;
      }),
    );
  }
}
