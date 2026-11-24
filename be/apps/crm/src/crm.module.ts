import {
  CommonAuthModule,
  HealthModule,
  ServiceConfigModule,
} from '@app/common';
import { DatabaseModule, OutboxModule } from '@app/database';
import { Module } from '@nestjs/common';
import { join } from 'node:path';

/**
 * Crm service — khung đã sẵn sàng (config, DB riêng, outbox, auth, health).
 * Bảng cần tạo: xem docs/database/schema-entities.md, mục "Crm Service".
 */
@Module({
  imports: [
    ServiceConfigModule.forRoot('crm', 3005),
    DatabaseModule.forRoot({
      migrations: [join(__dirname, 'database/migrations/*.{ts,js}')],
    }),
    OutboxModule,
    CommonAuthModule,
    HealthModule,
  ],
})
export class CrmModule {}
