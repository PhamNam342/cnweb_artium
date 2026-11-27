import { MigrationInterface, QueryRunner } from 'typeorm';

/** Thêm kiểu niêm yết "Đã bán" (bán ngoài nền tảng) + thông tin bán. */
export class ArtworkSoldListing1763700000000 implements MigrationInterface {
  name = 'ArtworkSoldListing1763700000000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TYPE "listing_type" ADD VALUE IF NOT EXISTS 'sold'`);
    await qr.query(`ALTER TABLE "artworks" ADD "sale_record" jsonb`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "artworks" DROP COLUMN "sale_record"`);
    // Postgres không xóa được giá trị enum: dựng lại kiểu
    await qr.query(
      `UPDATE "artworks" SET "listing_type" = 'display_only' WHERE "listing_type" = 'sold'`,
    );
    await qr.query(`ALTER TYPE "listing_type" RENAME TO "listing_type_old"`);
    await qr.query(
      `CREATE TYPE "listing_type" AS ENUM ('for_sale', 'inquire', 'display_only')`,
    );
    await qr.query(
      `ALTER TABLE "artworks" ALTER COLUMN "listing_type" DROP DEFAULT`,
    );
    await qr.query(
      `ALTER TABLE "artworks" ALTER COLUMN "listing_type" TYPE "listing_type" USING "listing_type"::text::"listing_type"`,
    );
    await qr.query(
      `ALTER TABLE "artworks" ALTER COLUMN "listing_type" SET DEFAULT 'for_sale'`,
    );
    await qr.query(`DROP TYPE "listing_type_old"`);
  }
}
