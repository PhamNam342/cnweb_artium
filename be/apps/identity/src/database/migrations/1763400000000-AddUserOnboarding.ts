import { MigrationInterface, QueryRunner } from 'typeorm';

/** Popup onboarding lần đầu: thành phố, sở thích, mốc hoàn tất onboarding. */
export class AddUserOnboarding1763400000000 implements MigrationInterface {
  name = 'AddUserOnboarding1763400000000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "users" ADD "city" varchar(100)`);
    await qr.query(
      `ALTER TABLE "users" ADD "interests" text[] NOT NULL DEFAULT '{}'`,
    );
    await qr.query(
      `ALTER TABLE "users" ADD "onboarding_completed_at" timestamptz`,
    );
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "users" DROP COLUMN "onboarding_completed_at"`);
    await qr.query(`ALTER TABLE "users" DROP COLUMN "interests"`);
    await qr.query(`ALTER TABLE "users" DROP COLUMN "city"`);
  }
}
