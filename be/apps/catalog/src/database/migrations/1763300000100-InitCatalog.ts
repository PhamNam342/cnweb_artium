import { createInfraTables, dropInfraTables } from '@app/database';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Khởi tạo catalog_db: bảng hạ tầng outbox/inbox. Bảng nghiệp vụ thêm ở migration tiếp theo. */
export class InitCatalog1763300000100 implements MigrationInterface {
  name = 'InitCatalog1763300000100';

  async up(qr: QueryRunner): Promise<void> {
    await createInfraTables(qr);
  }

  async down(qr: QueryRunner): Promise<void> {
    await dropInfraTables(qr);
  }
}
