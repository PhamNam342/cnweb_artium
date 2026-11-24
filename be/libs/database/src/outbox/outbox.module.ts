import { MessagingModule } from '@app/messaging';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboxMessage } from './inbox-message.entity';
import { InboxService } from './inbox.service';
import { OutboxMessage } from './outbox-message.entity';
import { OutboxRelayService } from './outbox-relay.service';
import { OutboxService } from './outbox.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxMessage, InboxMessage]),
    MessagingModule,
  ],
  providers: [OutboxService, InboxService, OutboxRelayService],
  exports: [OutboxService, InboxService, OutboxRelayService],
})
export class OutboxModule {}
