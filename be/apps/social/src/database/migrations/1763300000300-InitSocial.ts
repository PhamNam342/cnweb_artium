import { createInfraTables, dropInfraTables } from '@app/database';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Khởi tạo social_db: bảng hạ tầng outbox/inbox. Bảng nghiệp vụ thêm ở migration tiếp theo. */
export class InitSocial1763300000300 implements MigrationInterface {
  name = 'InitSocial1763300000300';

  async up(qr: QueryRunner): Promise<void> {
    await createInfraTables(qr);
  }

  async down(qr: QueryRunner): Promise<void> {
    await dropInfraTables(qr);
  }
}
