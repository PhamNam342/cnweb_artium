import { Module } from '@nestjs/common';
import { IdentityMailerConsumer } from './identity-mailer.consumer';
import { mailConfigProvider } from './mail.config';
import { MailService } from './mail.service';

@Module({
  providers: [mailConfigProvider, MailService, IdentityMailerConsumer],
  exports: [MailService],
})
export class MailModule {}
