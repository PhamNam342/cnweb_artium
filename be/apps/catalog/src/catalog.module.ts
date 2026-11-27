import {
  CommonAuthModule,
  HealthModule,
  ServiceConfigModule,
} from '@app/common';
import { DatabaseModule, OutboxModule } from '@app/database';
import { StorageModule } from '@app/storage';
import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { ArtworksModule } from './artworks/artworks.module';
import { catalogEnvSchema } from './config/catalog-env';
import { FoldersModule } from './folders/folders.module';
import { SellersModule } from './sellers/sellers.module';
import { TagsModule } from './tags/tags.module';
import { UploadsModule } from './uploads/uploads.module';

/**
 * Catalog service: tác phẩm, ảnh (Cloudinary), thư mục, tag, projection seller_summaries.
 * Schema: docs/database/schema-entities.md, mục "Catalog Service".
 */
@Module({
  imports: [
    ServiceConfigModule.forRoot('catalog', 3002, catalogEnvSchema),
    DatabaseModule.forRoot({
      migrations: [join(__dirname, 'database/migrations/*.{ts,js}')],
    }),
    OutboxModule,
    CommonAuthModule,
    HealthModule,
    StorageModule,
    ArtworksModule,
    FoldersModule,
    TagsModule,
    UploadsModule,
    SellersModule,
  ],
})
export class CatalogModule {}
