import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mỗi tài khoản chỉ một vai trò: users.roles (mảng) → users.role.
 * Dữ liệu cũ: có admin → admin, có seller → seller, còn lại → collector.
 */
export class SingleUserRole1763600000000 implements MigrationInterface {
  name = 'SingleUserRole1763600000000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `ALTER TABLE "users" ADD "role" "user_role" NOT NULL DEFAULT 'collector'`,
    );
    await qr.query(`
      UPDATE "users" SET "role" = CASE
        WHEN 'admin' = ANY("roles") THEN 'admin'::user_role
        WHEN 'seller' = ANY("roles") THEN 'seller'::user_role
        ELSE 'collector'::user_role
      END`);
    await qr.query(`ALTER TABLE "users" DROP COLUMN "roles"`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(
      `ALTER TABLE "users" ADD "roles" "user_role"[] NOT NULL DEFAULT '{collector}'`,
    );
    await qr.query(`UPDATE "users" SET "roles" = ARRAY["role"]`);
    await qr.query(`ALTER TABLE "users" DROP COLUMN "role"`);
  }
}
