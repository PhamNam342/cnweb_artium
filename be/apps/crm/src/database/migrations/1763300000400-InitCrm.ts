import { createInfraTables, dropInfraTables } from '@app/database';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Khởi tạo crm_db: bảng hạ tầng outbox/inbox. Bảng nghiệp vụ thêm ở migration tiếp theo. */
export class InitCrm1763300000400 implements MigrationInterface {
  name = 'InitCrm1763300000400';

  async up(qr: QueryRunner): Promise<void> {
    await createInfraTables(qr);
  }

  async down(qr: QueryRunner): Promise<void> {
    await dropInfraTables(qr);
  }
}
