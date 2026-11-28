/**
 * Đồng bộ projection của social_db (user_summaries, artwork_summaries) thẳng từ identity_db và catalog_db.
 * Cần khi: tài khoản / tác phẩm được tạo TRƯỚC khi social chạy (dữ liệu seed, dữ liệu cũ), hoặc event bị lỡ.
 * Chạy lại bao nhiêu lần cũng được. Lúc chạy bình thường, consumer của social tự cập nhật qua RabbitMQ.
 *   npm run sync:social        (seed cũng tự gọi hàm này)
 */
import { config } from 'dotenv';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

/** Giống CloudinaryService.imageUrl(..., 'medium') — URL ảnh bìa trong event catalog. */
const MEDIUM_TRANSFORM = 'c_limit,w_1200,f_auto,q_auto';

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

export interface SocialSyncResult {
  users: number;
  artworks: number;
  publicArtworks: number;
  hidden: number;
}

export async function syncSocialProjections(
  identity: Queryable,
  catalog: Queryable,
  social: Queryable,
  cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? '',
): Promise<SocialSyncResult> {
  const users = (await identity.query(
    `SELECT u.id AS user_id, u.full_name, u.avatar_url, sp.slug AS seller_slug, u.updated_at
       FROM users u
       LEFT JOIN seller_profiles sp ON sp.user_id = u.id
      WHERE u.deleted_at IS NULL`,
  )) as unknown[];

  const artworks = (await catalog.query(
    `SELECT a.id AS artwork_id, a.seller_id, a.title,
            (a.status IN ('published', 'sold_out') AND a.deleted_at IS NULL) AS is_public,
            i.public_id, i.version, a.updated_at
       FROM artworks a
       LEFT JOIN LATERAL (
         SELECT public_id, version FROM artwork_images
          WHERE artwork_id = a.id ORDER BY position LIMIT 1
       ) i ON true`,
  )) as {
    artwork_id: string;
    seller_id: string;
    title: string;
    is_public: boolean;
    public_id: string | null;
    version: number | null;
    updated_at: Date;
  }[];

  const artworkRows = artworks.map((a) => ({
    artwork_id: a.artwork_id,
    seller_id: a.seller_id,
    title: a.title,
    cover_image_url:
      a.public_id && cloudName
        ? `https://res.cloudinary.com/${cloudName}/image/upload/${MEDIUM_TRANSFORM}/v${a.version}/${a.public_id}`
        : null,
    is_public: a.is_public,
    updated_at: a.updated_at,
  }));

  await social.query('BEGIN');
  try {
    await social.query(
      `INSERT INTO user_summaries (user_id, full_name, avatar_url, seller_slug, updated_at)
       SELECT user_id, full_name, avatar_url, seller_slug, updated_at
         FROM json_to_recordset($1::json)
           AS x(user_id uuid, full_name varchar, avatar_url varchar, seller_slug varchar, updated_at timestamptz)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         avatar_url = EXCLUDED.avatar_url,
         seller_slug = EXCLUDED.seller_slug,
         updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(users)],
    );
    await social.query(
      `INSERT INTO artwork_summaries (artwork_id, seller_id, title, cover_image_url, is_public, updated_at)
       SELECT artwork_id, seller_id, title, cover_image_url, is_public, updated_at
         FROM json_to_recordset($1::json)
           AS x(artwork_id uuid, seller_id uuid, title varchar, cover_image_url varchar, is_public boolean, updated_at timestamptz)
       ON CONFLICT (artwork_id) DO UPDATE SET
         seller_id = EXCLUDED.seller_id,
         title = EXCLUDED.title,
         cover_image_url = EXCLUDED.cover_image_url,
         is_public = EXCLUDED.is_public,
         updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(artworkRows)],
    );
    // Tác phẩm đã bị xóa hẳn khỏi catalog (VD: seed xóa rồi tạo lại): giữ dòng, ẩn đi.
    const hidden = (await social.query(
      `UPDATE artwork_summaries SET is_public = false
        WHERE is_public AND NOT (artwork_id = ANY($1::uuid[]))
        RETURNING artwork_id`,
      [artworkRows.map((a) => a.artwork_id)],
    )) as [unknown[], number] | unknown[];
    await social.query('COMMIT');
    return {
      users: users.length,
      artworks: artworkRows.length,
      publicArtworks: artworkRows.filter((a) => a.is_public).length,
      hidden: Array.isArray(hidden[0]) ? hidden[0].length : hidden.length,
    };
  } catch (e) {
    await social.query('ROLLBACK');
    throw e;
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Thiếu ${name} trong be/.env`);
  return v;
}

async function main(): Promise<void> {
  config({ path: join(__dirname, '..', '.env'), quiet: true });
  const sources = await Promise.all(
    [
      'IDENTITY_DATABASE_URL',
      'CATALOG_DATABASE_URL',
      'SOCIAL_DATABASE_URL',
    ].map((k) =>
      new DataSource({ type: 'postgres', url: requireEnv(k) }).initialize(),
    ),
  );
  // QueryRunner = một kết nối cố định, để BEGIN/COMMIT của social áp dụng đúng chỗ
  const social = sources[2].createQueryRunner();
  try {
    const r = await syncSocialProjections(sources[0], sources[1], social);
    console.log(
      `✔ social: ${r.users} người dùng, ${r.artworks} tác phẩm (${r.publicArtworks} công khai)` +
        (r.hidden ? `, ẩn ${r.hidden} tác phẩm không còn trong catalog` : ''),
    );
  } finally {
    await social.release();
    await Promise.all(sources.map((s) => s.destroy()));
  }
}

if (require.main === module) {
  main().catch((e: unknown) => {
    console.error('✖ Đồng bộ social lỗi:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
