import { QueryRunner } from 'typeorm';

/** Tạo bảng outbox + inbox. Gọi trong migration khởi tạo của MỖI service. */
export async function createInfraTables(qr: QueryRunner): Promise<void> {
  await qr.query(
    `CREATE TYPE "outbox_status" AS ENUM ('pending', 'published', 'failed')`,
  );
  await qr.query(`
    CREATE TABLE "outbox" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "aggregate_type" varchar(64) NOT NULL,
      "aggregate_id" uuid NOT NULL,
      "event_type" varchar(128) NOT NULL,
      "payload" jsonb NOT NULL,
      "status" "outbox_status" NOT NULL DEFAULT 'pending',
      "attempts" integer NOT NULL DEFAULT 0,
      "available_at" timestamptz NOT NULL DEFAULT now(),
      "published_at" timestamptz,
      "last_error" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "pk_outbox" PRIMARY KEY ("id")
    )`);
  await qr.query(
    `CREATE INDEX "idx_outbox_pending" ON "outbox" ("status", "available_at") WHERE status = 'pending'`,
  );
  await qr.query(`
    CREATE TABLE "inbox" (
      "message_id" uuid NOT NULL,
      "consumer" varchar(100) NOT NULL,
      "processed_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "pk_inbox" PRIMARY KEY ("message_id", "consumer")
    )`);
}

export async function dropInfraTables(qr: QueryRunner): Promise<void> {
  await qr.query(`DROP TABLE IF EXISTS "inbox"`);
  await qr.query(`DROP TABLE IF EXISTS "outbox"`);
  await qr.query(`DROP TYPE IF EXISTS "outbox_status"`);
}
