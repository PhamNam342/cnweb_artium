import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nền tảng Social (issue 00): enum loại đối tượng + 2 bảng projection.
 * - user_summaries: từ identity (tên, avatar, slug nghệ sĩ).
 * - artwork_summaries: từ catalog (chủ tác phẩm, có đang công khai không).
 */
export class SocialFoundation1764300000000 implements MigrationInterface {
  name = 'SocialFoundation1764300000000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `CREATE TYPE "social_target_type" AS ENUM ('artwork', 'moment', 'comment', 'moodboard', 'review')`,
    );

    await qr.query(`
      CREATE TABLE "user_summaries" (
        "user_id" uuid NOT NULL,
        "full_name" varchar(255) NOT NULL,
        "avatar_url" varchar(1024),
        "seller_slug" varchar(120),
        "updated_at" timestamptz NOT NULL,
        CONSTRAINT "PK_user_summaries" PRIMARY KEY ("user_id")
      )`);

    await qr.query(`
      CREATE TABLE "artwork_summaries" (
        "artwork_id" uuid NOT NULL,
        "seller_id" uuid NOT NULL,
        "title" varchar(100) NOT NULL,
        "cover_image_url" varchar(1024),
        "is_public" boolean NOT NULL,
        "updated_at" timestamptz NOT NULL,
        CONSTRAINT "PK_artwork_summaries" PRIMARY KEY ("artwork_id")
      )`);
    await qr.query(
      `CREATE INDEX "idx_artwork_summaries_seller" ON "artwork_summaries" ("seller_id") WHERE "is_public"`,
    );
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE "artwork_summaries"`);
    await qr.query(`DROP TABLE "user_summaries"`);
    await qr.query(`DROP TYPE "social_target_type"`);
  }
}
