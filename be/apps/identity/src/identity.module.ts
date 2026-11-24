import {
  CommonAuthModule,
  HealthModule,
  ServiceConfigModule,
} from '@app/common';
import { DatabaseModule, OutboxModule } from '@app/database';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'node:path';
import { AuthModule } from './auth/auth.module';
import { IdentityConfigModule } from './config/identity-config.module';
import { identityEnvSchema } from './config/identity-env';
import { mailEnvSchema } from './mail/mail.config';
import { MailModule } from './mail/mail.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { SellersModule } from './sellers/sellers.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ServiceConfigModule.forRoot('identity', 3001, {
      ...identityEnvSchema,
      ...mailEnvSchema,
    }),
    IdentityConfigModule,
    DatabaseModule.forRoot({
      migrations: [join(__dirname, 'database/migrations/*.{ts,js}')],
    }),
    OutboxModule,
    CommonAuthModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    HealthModule,
    UsersModule,
    AuthModule,
    SellersModule,
    OnboardingModule,
    MailModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class IdentityModule {}
