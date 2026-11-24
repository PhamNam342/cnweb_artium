import { createInfraTables, dropInfraTables } from '@app/database';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Khởi tạo commerce_db: bảng hạ tầng outbox/inbox. Bảng nghiệp vụ thêm ở migration tiếp theo. */
export class InitCommerce1763300000200 implements MigrationInterface {
  name = 'InitCommerce1763300000200';

  async up(qr: QueryRunner): Promise<void> {
    await createInfraTables(qr);
  }

  async down(qr: QueryRunner): Promise<void> {
    await dropInfraTables(qr);
  }
}
