import {
  CommonAuthModule,
  HealthModule,
  ServiceConfigModule,
} from '@app/common';
import { DatabaseModule, OutboxModule } from '@app/database';
import { StorageModule } from '@app/storage';
import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { socialEnvSchema } from './config/social-env';
import { SummariesModule } from './summaries/summaries.module';
import { TargetsModule } from './targets/targets.module';

/**
 * Social service: theo dõi, like, bình luận, moments.
 * Nền tảng (issue 00): projection user_summaries / artwork_summaries + TargetRegistry.
 * Schema: docs/database/schema-entities.md, mục "Social Service".
 */
@Module({
  imports: [
    ServiceConfigModule.forRoot('social', 3004, socialEnvSchema),
    DatabaseModule.forRoot({
      migrations: [join(__dirname, 'database/migrations/*.{ts,js}')],
    }),
    OutboxModule,
    CommonAuthModule,
    HealthModule,
    StorageModule,
    SummariesModule,
    TargetsModule,
  ],
})
export class SocialModule {}
