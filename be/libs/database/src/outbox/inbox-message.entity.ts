import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('inbox')
export class InboxMessage {
  @PrimaryColumn({ name: 'message_id', type: 'uuid' })
  messageId!: string;

  @PrimaryColumn({ type: 'varchar', length: 100 })
  consumer!: string;

  @Column({ name: 'processed_at', type: 'timestamptz', default: () => 'now()' })
  processedAt!: Date;
}
