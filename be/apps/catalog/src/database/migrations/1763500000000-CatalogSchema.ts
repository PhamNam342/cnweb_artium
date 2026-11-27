import { MigrationInterface, QueryRunner } from 'typeorm';

/** Bảng nghiệp vụ catalog_db theo docs/database/schema-entities.md (mục Catalog Service) + seed tag hệ thống. */
export class CatalogSchema1763500000000 implements MigrationInterface {
  name = 'CatalogSchema1763500000000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `CREATE TYPE "artwork_status" AS ENUM ('draft', 'published', 'sold_out', 'archived')`,
    );
    await qr.query(
      `CREATE TYPE "listing_type" AS ENUM ('for_sale', 'inquire', 'display_only')`,
    );
    await qr.query(`CREATE TYPE "dimension_unit" AS ENUM ('cm', 'in')`);
    await qr.query(`CREATE TYPE "weight_unit" AS ENUM ('kg', 'lb')`);
    await qr.query(
      `CREATE TYPE "tag_category" AS ENUM ('medium', 'style', 'subject', 'other')`,
    );
    await qr.query(
      `CREATE TYPE "reservation_status" AS ENUM ('active', 'confirmed', 'released')`,
    );

    await qr.query(`
      CREATE TABLE "artwork_folders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "seller_id" uuid NOT NULL,
        "parent_id" uuid,
        "name" varchar(255) NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "is_hidden" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_artwork_folders" PRIMARY KEY ("id"),
        CONSTRAINT "fk_artwork_folders_parent" FOREIGN KEY ("parent_id") REFERENCES "artwork_folders"("id") ON DELETE SET NULL
      )`);
    await qr.query(
      `CREATE INDEX "idx_artwork_folders_seller_parent_position" ON "artwork_folders" ("seller_id", "parent_id", "position")`,
    );

    await qr.query(`
      CREATE TABLE "artworks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "seller_id" uuid NOT NULL,
        "folder_id" uuid,
        "title" varchar(100) NOT NULL,
        "description" varchar(350),
        "creator_name" varchar(100),
        "creation_year" smallint,
        "edition" varchar(24),
        "medium" varchar(80),
        "width_cm" numeric(8,2),
        "height_cm" numeric(8,2),
        "depth_cm" numeric(8,2),
        "dimension_unit" "dimension_unit" NOT NULL DEFAULT 'cm',
        "weight_kg" numeric(8,2),
        "weight_unit" "weight_unit" NOT NULL DEFAULT 'kg',
        "is_framed" boolean NOT NULL DEFAULT false,
        "listing_type" "listing_type" NOT NULL DEFAULT 'for_sale',
        "price" bigint,
        "quantity_total" integer NOT NULL DEFAULT 1,
        "quantity_available" integer NOT NULL DEFAULT 1,
        "allow_offers" boolean NOT NULL DEFAULT false,
        "shipping" jsonb,
        "status" "artwork_status" NOT NULL DEFAULT 'draft',
        "published_at" timestamptz,
        "view_count" integer NOT NULL DEFAULT 0,
        "like_count" integer NOT NULL DEFAULT 0,
        "comment_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_artworks" PRIMARY KEY ("id"),
        CONSTRAINT "fk_artworks_folder" FOREIGN KEY ("folder_id") REFERENCES "artwork_folders"("id") ON DELETE SET NULL
      )`);
    // CHECK khai báo cả ở entity (@Check) để TypeORM không đòi xóa
    await qr.query(
      `ALTER TABLE "artworks" ADD CONSTRAINT "chk_artworks_quantity" CHECK (quantity_available >= 0 AND quantity_available <= quantity_total)`,
    );
    await qr.query(
      `ALTER TABLE "artworks" ADD CONSTRAINT "chk_artworks_price" CHECK (price IS NULL OR price > 0)`,
    );
    await qr.query(
      `CREATE INDEX "idx_artworks_seller_status_created" ON "artworks" ("seller_id", "status", "created_at")`,
    );
    await qr.query(
      `CREATE INDEX "idx_artworks_status_published" ON "artworks" ("status", "published_at")`,
    );
    await qr.query(
      `CREATE INDEX "idx_artworks_folder" ON "artworks" ("folder_id")`,
    );

    await qr.query(`
      CREATE TABLE "artwork_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "artwork_id" uuid NOT NULL,
        "public_id" varchar(255) NOT NULL,
        "version" integer NOT NULL,
        "format" varchar(10) NOT NULL,
        "width" integer NOT NULL,
        "height" integer NOT NULL,
        "bytes" integer NOT NULL,
        "position" smallint NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_artwork_images" PRIMARY KEY ("id"),
        CONSTRAINT "fk_artwork_images_artwork" FOREIGN KEY ("artwork_id") REFERENCES "artworks"("id") ON DELETE CASCADE
      )`);
    await qr.query(
      `CREATE UNIQUE INDEX "uq_artwork_images_public_id" ON "artwork_images" ("public_id")`,
    );
    await qr.query(
      `CREATE INDEX "idx_artwork_images_artwork_position" ON "artwork_images" ("artwork_id", "position")`,
    );

    await qr.query(`
      CREATE TABLE "tags" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "seller_id" uuid,
        "category" "tag_category" NOT NULL DEFAULT 'other',
        "name" varchar(64) NOT NULL,
        "slug" varchar(80) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tags" PRIMARY KEY ("id")
      )`);
    await qr.query(
      `CREATE UNIQUE INDEX "uq_tags_seller_slug" ON "tags" ("seller_id", "slug") NULLS NOT DISTINCT`,
    );
    await qr.query(`CREATE INDEX "idx_tags_category" ON "tags" ("category")`);

    await qr.query(`
      CREATE TABLE "artwork_tags" (
        "artwork_id" uuid NOT NULL,
        "tag_id" uuid NOT NULL,
        CONSTRAINT "PK_artwork_tags" PRIMARY KEY ("artwork_id", "tag_id"),
        CONSTRAINT "fk_artwork_tags_artwork" FOREIGN KEY ("artwork_id") REFERENCES "artworks"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_artwork_tags_tag" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
      )`);
    await qr.query(
      `CREATE INDEX "idx_artwork_tags_tag" ON "artwork_tags" ("tag_id")`,
    );

    await qr.query(`
      CREATE TABLE "artwork_reservations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "artwork_id" uuid NOT NULL,
        "order_id" uuid NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "status" "reservation_status" NOT NULL DEFAULT 'active',
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_artwork_reservations" PRIMARY KEY ("id"),
        CONSTRAINT "uq_artwork_reservations_order_artwork" UNIQUE ("order_id", "artwork_id"),
        CONSTRAINT "fk_artwork_reservations_artwork" FOREIGN KEY ("artwork_id") REFERENCES "artworks"("id") ON DELETE RESTRICT
      )`);
    await qr.query(
      `CREATE INDEX "idx_artwork_reservations_status_expires" ON "artwork_reservations" ("status", "expires_at")`,
    );

    await qr.query(`
      CREATE TABLE "seller_summaries" (
        "seller_id" uuid NOT NULL,
        "slug" varchar(120) NOT NULL,
        "display_name" varchar(255) NOT NULL,
        "avatar_url" varchar(1024),
        "is_verified" boolean NOT NULL DEFAULT false,
        "updated_at" timestamptz NOT NULL,
        CONSTRAINT "PK_seller_summaries" PRIMARY KEY ("seller_id")
      )`);

    // Seed tag hệ thống. Slug khớp danh mục sở thích ở popup onboarding (users.interests).
    const seed: Array<[string, string, string]> = [
      ['medium', 'son-dau', 'Sơn dầu'],
      ['medium', 'acrylic', 'Acrylic'],
      ['medium', 'mau-nuoc', 'Màu nước'],
      ['medium', 'son-mai', 'Sơn mài'],
      ['medium', 'lua', 'Lụa'],
      ['medium', 'giay-do', 'Giấy dó'],
      ['medium', 'chi-than', 'Chì / than'],
      ['medium', 'tranh-in', 'Tranh in'],
      ['medium', 'nhiep-anh', 'Nhiếp ảnh'],
      ['medium', 'dieu-khac', 'Điêu khắc'],
      ['medium', 'gom', 'Gốm'],
      ['medium', 'tranh-so', 'Tranh số'],
      ['medium', 'chat-lieu-hon-hop', 'Chất liệu hỗn hợp'],
      ['style', 'truu-tuong', 'Trừu tượng'],
      ['style', 'hien-thuc', 'Hiện thực'],
      ['style', 'an-tuong', 'Ấn tượng'],
      ['style', 'bieu-hien', 'Biểu hiện'],
      ['style', 'duong-dai', 'Đương đại'],
      ['style', 'toi-gian', 'Tối giản'],
      ['style', 'sieu-thuc', 'Siêu thực'],
      ['style', 'pop-art', 'Pop art'],
      ['style', 'dan-gian', 'Dân gian'],
      ['style', 'lap-the', 'Lập thể'],
      ['subject', 'phong-canh', 'Phong cảnh'],
      ['subject', 'chan-dung', 'Chân dung'],
      ['subject', 'tinh-vat', 'Tĩnh vật'],
      ['subject', 'do-thi', 'Đô thị'],
      ['subject', 'thien-nhien', 'Thiên nhiên'],
      ['subject', 'con-nguoi', 'Con người'],
      ['subject', 'dong-vat', 'Động vật'],
      ['subject', 'hoa', 'Hoa'],
      ['subject', 'tam-linh', 'Tâm linh'],
      ['subject', 'bien', 'Biển'],
    ];
    for (const [category, slug, name] of seed) {
      await qr.query(
        `INSERT INTO "tags" ("category", "slug", "name") VALUES ($1, $2, $3)`,
        [category, slug, name],
      );
    }
  }

  async down(qr: QueryRunner): Promise<void> {
    for (const t of [
      'seller_summaries',
      'artwork_reservations',
      'artwork_tags',
      'tags',
      'artwork_images',
      'artworks',
      'artwork_folders',
    ]) {
      await qr.query(`DROP TABLE IF EXISTS "${t}"`);
    }
    for (const e of [
      'reservation_status',
      'tag_category',
      'weight_unit',
      'dimension_unit',
      'listing_type',
      'artwork_status',
    ]) {
      await qr.query(`DROP TYPE IF EXISTS "${e}"`);
    }
  }
}
