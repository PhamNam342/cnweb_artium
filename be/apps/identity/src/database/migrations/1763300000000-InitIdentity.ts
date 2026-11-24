import { createInfraTables, dropInfraTables } from '@app/database';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Khởi tạo identity_db theo docs/database/schema-entities.md (mục Identity Service). */
export class InitIdentity1763300000000 implements MigrationInterface {
  name = 'InitIdentity1763300000000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(
      `CREATE TYPE "user_role" AS ENUM ('collector', 'seller', 'admin')`,
    );
    await qr.query(`CREATE TYPE "user_status" AS ENUM ('active', 'suspended')`);
    await qr.query(`CREATE TYPE "oauth_provider" AS ENUM ('google')`);
    await qr.query(
      `CREATE TYPE "user_token_type" AS ENUM ('email_verification', 'password_reset')`,
    );
    await qr.query(
      `CREATE TYPE "seller_profile_type" AS ENUM ('individual', 'gallery', 'institution')`,
    );
    await qr.query(
      `CREATE TYPE "seller_verification_status" AS ENUM ('unverified', 'pending', 'verified', 'rejected')`,
    );

    await qr.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar(320) NOT NULL,
        "password_hash" varchar(255),
        "full_name" varchar(255) NOT NULL,
        "avatar_url" varchar(1024),
        "phone" varchar(20),
        "roles" "user_role"[] NOT NULL DEFAULT '{collector}',
        "status" "user_status" NOT NULL DEFAULT 'active',
        "email_verified_at" timestamptz,
        "last_login_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )`);
    await qr.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email")`);
    await qr.query(
      `CREATE INDEX "idx_users_status_created" ON "users" ("status", "created_at")`,
    );

    await qr.query(`
      CREATE TABLE "oauth_accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "provider" "oauth_provider" NOT NULL,
        "provider_user_id" varchar(255) NOT NULL,
        "email" varchar(320),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oauth_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "uq_oauth_provider_user" UNIQUE ("provider", "provider_user_id"),
        CONSTRAINT "uq_oauth_user_provider" UNIQUE ("user_id", "provider"),
        CONSTRAINT "fk_oauth_accounts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);

    await qr.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "family_id" uuid NOT NULL,
        "token_hash" char(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "replaced_by_id" uuid,
        "user_agent" varchar(512),
        "ip_address" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await qr.query(
      `CREATE UNIQUE INDEX "uq_refresh_tokens_hash" ON "refresh_tokens" ("token_hash")`,
    );
    await qr.query(
      `CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" ("user_id")`,
    );
    await qr.query(
      `CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens" ("family_id")`,
    );
    await qr.query(
      `CREATE INDEX "idx_refresh_tokens_expires" ON "refresh_tokens" ("expires_at")`,
    );

    await qr.query(`
      CREATE TABLE "user_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "type" "user_token_type" NOT NULL,
        "token_hash" char(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "fk_user_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await qr.query(
      `CREATE UNIQUE INDEX "uq_user_tokens_hash" ON "user_tokens" ("token_hash")`,
    );
    await qr.query(
      `CREATE INDEX "idx_user_tokens_user_type" ON "user_tokens" ("user_id", "type")`,
    );

    await qr.query(`
      CREATE TABLE "seller_profiles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "slug" varchar(120) NOT NULL,
        "display_name" varchar(255) NOT NULL,
        "profile_type" "seller_profile_type" NOT NULL DEFAULT 'individual',
        "bio" text,
        "avatar_url" varchar(1024),
        "cover_image_url" varchar(1024),
        "location" varchar(255),
        "social_links" jsonb NOT NULL DEFAULT '{}',
        "tax_code" varchar(32),
        "business_address" jsonb,
        "verification_status" "seller_verification_status" NOT NULL DEFAULT 'unverified',
        "verified_at" timestamptz,
        "is_featured" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_seller_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "fk_seller_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await qr.query(
      `CREATE UNIQUE INDEX "uq_seller_profiles_user" ON "seller_profiles" ("user_id")`,
    );
    await qr.query(
      `CREATE UNIQUE INDEX "uq_seller_profiles_slug" ON "seller_profiles" ("slug")`,
    );
    await qr.query(
      `CREATE INDEX "idx_seller_profiles_verification" ON "seller_profiles" ("verification_status", "is_featured")`,
    );

    await qr.query(`
      CREATE TABLE "seller_websites" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "seller_profile_id" uuid NOT NULL,
        "type" varchar(32) NOT NULL DEFAULT 'portfolio',
        "title" varchar(255) NOT NULL,
        "url" varchar(1024) NOT NULL,
        "display_order" integer NOT NULL DEFAULT 0,
        "is_visible" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_seller_websites" PRIMARY KEY ("id"),
        CONSTRAINT "fk_seller_websites_profile" FOREIGN KEY ("seller_profile_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE
      )`);
    await qr.query(
      `CREATE INDEX "idx_seller_websites_profile_order" ON "seller_websites" ("seller_profile_id", "display_order")`,
    );

    await createInfraTables(qr);
  }

  async down(qr: QueryRunner): Promise<void> {
    await dropInfraTables(qr);
    for (const t of [
      'seller_websites',
      'seller_profiles',
      'user_tokens',
      'refresh_tokens',
      'oauth_accounts',
      'users',
    ]) {
      await qr.query(`DROP TABLE IF EXISTS "${t}"`);
    }
    for (const e of [
      'seller_verification_status',
      'seller_profile_type',
      'user_token_type',
      'oauth_provider',
      'user_status',
      'user_role',
    ]) {
      await qr.query(`DROP TYPE IF EXISTS "${e}"`);
    }
  }
}
