import { MigrationInterface, QueryRunner } from 'typeorm';

/** Mã 6 số đổi mật khẩu qua email: thêm loại token + đếm số lần nhập sai. */
export class PasswordChangeCode1763800000000 implements MigrationInterface {
  name = 'PasswordChangeCode1763800000000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `ALTER TYPE "user_token_type" ADD VALUE IF NOT EXISTS 'password_change'`,
    );
    await qr.query(
      `ALTER TABLE "user_tokens" ADD "attempts" smallint NOT NULL DEFAULT 0`,
    );
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "user_tokens" DROP COLUMN "attempts"`);
    await qr.query(
      `DELETE FROM "user_tokens" WHERE "type" = 'password_change'`,
    );
    // Postgres không xóa được giá trị enum: dựng lại kiểu
    await qr.query(
      `ALTER TYPE "user_token_type" RENAME TO "user_token_type_old"`,
    );
    await qr.query(
      `CREATE TYPE "user_token_type" AS ENUM ('email_verification', 'password_reset')`,
    );
    await qr.query(
      `ALTER TABLE "user_tokens" ALTER COLUMN "type" TYPE "user_token_type" USING "type"::text::"user_token_type"`,
    );
    await qr.query(`DROP TYPE "user_token_type_old"`);
  }
}
