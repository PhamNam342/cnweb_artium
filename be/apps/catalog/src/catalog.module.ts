import {
  CommonAuthModule,
  HealthModule,
  ServiceConfigModule,
} from '@app/common';
import { DatabaseModule, OutboxModule } from '@app/database';
import { Module } from '@nestjs/common';
import { join } from 'node:path';

/**
 * Catalog service — khung đã sẵn sàng (config, DB riêng, outbox, auth, health).
 * Bảng cần tạo: xem docs/database/schema-entities.md, mục "Catalog Service".
 */
@Module({
  imports: [
    ServiceConfigModule.forRoot('catalog', 3002),
    DatabaseModule.forRoot({
      migrations: [join(__dirname, 'database/migrations/*.{ts,js}')],
    }),
    OutboxModule,
    CommonAuthModule,
    HealthModule,
  ],
})
export class CatalogModule {}
