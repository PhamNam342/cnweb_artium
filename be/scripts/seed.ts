/**
 * Đổ dữ liệu mẫu cho môi trường dev (identity_db + catalog_db), rồi đồng bộ projection sang social_db.
 *   npm run seed
 * Chạy lại bao nhiêu lần cũng được: dữ liệu mẫu cũ (theo email / id cố định) bị xóa rồi tạo lại.
 * Lưu ý: xóa TOÀN BỘ tác phẩm / thư mục / tag riêng của các tài khoản nghệ sĩ mẫu (kể cả thứ tạo tay khi
 * đăng nhập bằng các tài khoản đó). Tài khoản tự đăng ký không bị ảnh hưởng.
 * Ảnh tác phẩm: nếu be/.env có CLOUDINARY_*, ảnh mẫu được tải lên Cloudinary và tác phẩm được đăng;
 * nếu chưa có, tác phẩm chỉ ở dạng bản nháp (không ảnh).
 */
import { hash } from 'argon2';
import { v2 as cloudinary } from 'cloudinary';
import { config } from 'dotenv';
import { join } from 'node:path';
import { DataSource, QueryRunner } from 'typeorm';
import { syncSocialProjections } from './social-sync';

config({ path: join(__dirname, '..', '.env'), quiet: true });

export const SEED_PASSWORD = 'Artium123';

/** id cố định để chạy lại không sinh bản trùng */
const U = {
  admin: '00000000-0000-4000-a000-000000000001',
  collector: '00000000-0000-4000-a000-000000000002',
  newbie: '00000000-0000-4000-a000-000000000003',
  lan: '00000000-0000-4000-a000-000000000011',
  minh: '00000000-0000-4000-a000-000000000012',
  gallery: '00000000-0000-4000-a000-000000000013',
};

interface SeedUser {
  id: string;
  email: string;
  fullName: string;
  role: 'collector' | 'seller' | 'admin';
  city: string | null;
  interests: string[];
  onboarded: boolean;
}

const USERS: SeedUser[] = [
  {
    id: U.admin,
    email: 'admin@artium.vn',
    fullName: 'Quản trị Artium',
    role: 'admin',
    city: 'Hà Nội',
    interests: [],
    onboarded: true,
  },
  {
    id: U.collector,
    email: 'buyer@artium.vn',
    fullName: 'Lê Hoàng Anh',
    role: 'collector',
    city: 'TP. Hồ Chí Minh',
    interests: ['son-dau', 'phong-canh', 'truu-tuong'],
    onboarded: true,
  },
  {
    id: U.newbie,
    email: 'newbie@artium.vn',
    fullName: 'Người dùng mới',
    role: 'collector',
    city: null,
    interests: [],
    onboarded: false,
  },
  {
    id: U.lan,
    email: 'lan.nguyen@artium.vn',
    fullName: 'Nguyễn Thị Lan',
    role: 'seller',
    city: 'Hà Nội',
    interests: ['son-mai', 'lua'],
    onboarded: true,
  },
  {
    id: U.minh,
    email: 'minh.tran@artium.vn',
    fullName: 'Trần Đức Minh',
    role: 'seller',
    city: 'Đà Nẵng',
    interests: ['truu-tuong'],
    onboarded: true,
  },
  {
    id: U.gallery,
    email: 'gallery@artium.vn',
    fullName: 'Hanoi Art Space',
    role: 'seller',
    city: 'Hà Nội',
    interests: [],
    onboarded: true,
  },
];

interface SeedSeller {
  userId: string;
  profileId: string;
  slug: string;
  displayName: string;
  type: 'individual' | 'gallery';
  bio: string;
  location: string;
  verified: boolean;
  featured: boolean;
  website?: string;
}

const SELLERS: SeedSeller[] = [
  {
    userId: U.lan,
    profileId: '00000000-0000-4000-b000-000000000011',
    slug: 'nguyen-thi-lan',
    displayName: 'Nguyễn Thị Lan',
    type: 'individual',
    bio: 'Họa sĩ sơn mài và lụa, tốt nghiệp ĐH Mỹ thuật Việt Nam. Cảm hứng từ phố cổ và làng quê Bắc Bộ.',
    location: 'Hà Nội',
    verified: true,
    featured: true,
    website: 'https://example.com/nguyen-thi-lan',
  },
  {
    userId: U.minh,
    profileId: '00000000-0000-4000-b000-000000000012',
    slug: 'tran-duc-minh',
    displayName: 'Trần Đức Minh',
    type: 'individual',
    bio: 'Vẽ trừu tượng bằng acrylic và chất liệu hỗn hợp, lấy cảm hứng từ biển miền Trung.',
    location: 'Đà Nẵng',
    verified: false,
    featured: false,
  },
  {
    userId: U.gallery,
    profileId: '00000000-0000-4000-b000-000000000013',
    slug: 'hanoi-art-space',
    displayName: 'Hanoi Art Space',
    type: 'gallery',
    bio: 'Không gian trưng bày nghệ thuật đương đại tại trung tâm Hà Nội.',
    location: 'Hoàn Kiếm, Hà Nội',
    verified: true,
    featured: true,
    website: 'https://example.com/hanoi-art-space',
  },
];

type Status = 'draft' | 'published' | 'sold_out' | 'archived';
interface SeedArtwork {
  seller: string;
  title: string;
  description: string;
  year: number;
  medium: string;
  w: number;
  h: number;
  d?: number;
  unit?: 'cm' | 'in';
  framed?: boolean;
  listing: 'for_sale' | 'inquire' | 'display_only';
  price?: number;
  qty?: number;
  sold?: number;
  offers?: boolean;
  status: Status;
  folder?: string;
  tags: string[];
  images: number;
}

const ARTWORKS: SeedArtwork[] = [
  {
    seller: U.lan,
    title: 'Phố cổ mùa thu',
    description: 'Góc phố Hàng Mã trong nắng thu, sơn mài vóc nhiều lớp.',
    year: 2024,
    medium: 'Sơn mài trên vóc',
    w: 80,
    h: 60,
    framed: true,
    listing: 'for_sale',
    price: 25_000_000,
    status: 'published',
    folder: 'Phố cổ',
    tags: ['son-mai', 'do-thi', 'duong-dai'],
    images: 3,
  },
  {
    seller: U.lan,
    title: 'Ngõ nhỏ Hàng Bạc',
    description: 'Ngõ nhỏ buổi sớm, ánh vàng son mài.',
    year: 2023,
    medium: 'Sơn mài',
    w: 60,
    h: 60,
    listing: 'for_sale',
    price: 18_000_000,
    status: 'published',
    folder: 'Phố cổ',
    tags: ['son-mai', 'do-thi'],
    images: 2,
  },
  {
    seller: U.lan,
    title: 'Thiếu nữ bên hoa sen',
    description: 'Lụa vẽ thiếu nữ áo dài trắng bên đầm sen.',
    year: 2024,
    medium: 'Màu nước trên lụa',
    w: 50,
    h: 70,
    framed: true,
    listing: 'for_sale',
    price: 32_000_000,
    offers: true,
    status: 'published',
    folder: 'Lụa',
    tags: ['lua', 'chan-dung', 'hoa'],
    images: 2,
  },
  {
    seller: U.lan,
    title: 'Làng quê Bắc Bộ',
    description: 'Cổng làng, cây đa, mái đình.',
    year: 2022,
    medium: 'Sơn mài',
    w: 120,
    h: 80,
    listing: 'for_sale',
    price: 45_000_000,
    status: 'sold_out',
    sold: 1,
    folder: 'Phố cổ',
    tags: ['son-mai', 'phong-canh', 'dan-gian'],
    images: 2,
  },
  {
    seller: U.lan,
    title: 'Phác thảo chợ Đồng Xuân',
    description: 'Bản nháp chưa hoàn thiện.',
    year: 2025,
    medium: 'Chì than',
    w: 42,
    h: 30,
    listing: 'for_sale',
    status: 'draft',
    tags: ['chi-than', 'do-thi'],
    images: 1,
  },
  {
    seller: U.minh,
    title: 'Sóng',
    description: 'Chuyển động của biển Mỹ Khê qua những mảng màu xanh.',
    year: 2024,
    medium: 'Acrylic trên toan',
    w: 100,
    h: 100,
    d: 4,
    unit: 'in',
    listing: 'for_sale',
    price: 15_000_000,
    status: 'published',
    folder: 'Biển',
    tags: ['acrylic', 'truu-tuong', 'bien'],
    images: 2,
  },
  {
    seller: U.minh,
    title: 'Hoàng hôn Sơn Trà',
    description: 'Cam, tím và xanh đan nhau trên bán đảo Sơn Trà.',
    year: 2024,
    medium: 'Acrylic',
    w: 90,
    h: 60,
    listing: 'for_sale',
    price: 12_500_000,
    qty: 3,
    status: 'published',
    folder: 'Biển',
    tags: ['acrylic', 'phong-canh', 'bien'],
    images: 1,
  },
  {
    seller: U.minh,
    title: 'Nhịp điệu #7',
    description: 'Chuỗi tác phẩm trừu tượng về nhịp sống đô thị.',
    year: 2025,
    medium: 'Chất liệu hỗn hợp',
    w: 70,
    h: 90,
    listing: 'inquire',
    status: 'published',
    tags: ['chat-lieu-hon-hop', 'truu-tuong', 'toi-gian'],
    images: 2,
  },
  {
    seller: U.minh,
    title: 'Tĩnh vật bình gốm',
    description: 'Bài tập tĩnh vật thời sinh viên.',
    year: 2018,
    medium: 'Sơn dầu',
    w: 40,
    h: 50,
    listing: 'display_only',
    status: 'archived',
    tags: ['son-dau', 'tinh-vat'],
    images: 1,
  },
  {
    seller: U.gallery,
    title: 'Mẹ và con',
    description: 'Tranh sơn dầu khổ lớn của họa sĩ khách mời.',
    year: 2021,
    medium: 'Sơn dầu trên toan',
    w: 150,
    h: 120,
    d: 5,
    framed: true,
    listing: 'inquire',
    status: 'published',
    folder: 'Triển lãm 2025',
    tags: ['son-dau', 'con-nguoi', 'hien-thuc'],
    images: 2,
  },
  {
    seller: U.gallery,
    title: 'Tranh in Đông Hồ — Đám cưới chuột',
    description: 'Bản in khắc gỗ trên giấy điệp, ấn bản giới hạn.',
    year: 2020,
    medium: 'Tranh in khắc gỗ',
    w: 40,
    h: 30,
    listing: 'for_sale',
    price: 3_500_000,
    qty: 20,
    sold: 6,
    status: 'published',
    folder: 'Tranh in',
    tags: ['tranh-in', 'dan-gian', 'dong-vat'],
    images: 1,
  },
  {
    seller: U.gallery,
    title: 'Tĩnh lặng',
    description: 'Tác phẩm trưng bày, không bán.',
    year: 2019,
    medium: 'Gốm men rạn',
    w: 30,
    h: 45,
    d: 30,
    listing: 'display_only',
    status: 'published',
    folder: 'Triển lãm 2025',
    tags: ['gom', 'toi-gian', 'tam-linh'],
    images: 2,
  },
];

const seedUuid = (prefix: string, i: number, j = 0) =>
  `00000000-0000-4000-${prefix}${String(j).padStart(3, '0')}-${String(i).padStart(12, '0')}`;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Thiếu ${name} trong be/.env`);
  return v;
}

async function seedIdentity(db: QueryRunner): Promise<void> {
  const emails = USERS.map((u) => u.email);
  const ids = USERS.map((u) => u.id);
  await db.query('BEGIN');
  try {
    await db.query(
      `DELETE FROM users WHERE id = ANY($1) OR lower(email) = ANY($2)`,
      [ids, emails],
    );
    const passwordHash = await hash(SEED_PASSWORD, { type: 2 }); // 2 = argon2id
    for (const u of USERS) {
      await db.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, status, email_verified_at,
                            city, interests, onboarding_completed_at)
         VALUES ($1, $2, $3, $4, $5::user_role, 'active', now(), $6, $7, $8)`,
        [
          u.id,
          u.email,
          passwordHash,
          u.fullName,
          u.role,
          u.city,
          u.interests,
          u.onboarded ? new Date() : null,
        ],
      );
    }
    for (const s of SELLERS) {
      await db.query(
        `INSERT INTO seller_profiles (id, user_id, slug, display_name, profile_type, bio, location,
                                      verification_status, verified_at, is_featured)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          s.profileId,
          s.userId,
          s.slug,
          s.displayName,
          s.type,
          s.bio,
          s.location,
          s.verified ? 'verified' : 'unverified',
          s.verified ? new Date() : null,
          s.featured,
        ],
      );
      if (s.website) {
        await db.query(
          `INSERT INTO seller_websites (seller_profile_id, title, url) VALUES ($1, 'Portfolio', $2)`,
          [s.profileId, s.website],
        );
      }
    }
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
}

interface UploadedImage {
  publicId: string;
  version: number;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

/** Tải ảnh mẫu (picsum.photos) lên Cloudinary; Cloudinary tự kéo ảnh từ URL. */
async function uploadImages(
  sellerId: string,
  artworkIdx: number,
  count: number,
): Promise<UploadedImage[]> {
  const folder = `${process.env.CLOUDINARY_FOLDER || 'artium'}/artworks/${sellerId}`;
  const out: UploadedImage[] = [];
  for (let j = 0; j < count; j++) {
    const publicId = `${folder}/seed-${artworkIdx}-${j}`;
    const r = (await cloudinary.uploader.upload(
      `https://picsum.photos/seed/artium-${artworkIdx}-${j}/1600/1200`,
      {
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: 'image',
      },
    )) as {
      public_id: string;
      version: number;
      format: string;
      width: number;
      height: number;
      bytes: number;
    };
    out.push({
      publicId: r.public_id,
      version: r.version,
      format: r.format,
      width: r.width,
      height: r.height,
      bytes: r.bytes,
    });
  }
  return out;
}

async function seedCatalog(
  db: QueryRunner,
): Promise<{ withImages: boolean; published: number; drafts: number }> {
  const sellerIds = SELLERS.map((s) => s.userId);
  const withImages = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
  if (withImages) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  // Tải ảnh trước khi mở transaction (gọi mạng lâu)
  const images = new Map<number, UploadedImage[]>();
  if (withImages) {
    for (const [i, a] of ARTWORKS.entries()) {
      process.stdout.write(`  ảnh ${i + 1}/${ARTWORKS.length}: ${a.title}\r`);
      images.set(i, await uploadImages(a.seller, i + 1, a.images));
    }
    process.stdout.write('\n');
  }

  const tagRows: { id: string; slug: string }[] = await db.query(
    `SELECT id, slug FROM tags WHERE seller_id IS NULL`,
  );
  const tagId = new Map(tagRows.map((t) => [t.slug, t.id]));

  let published = 0;
  let drafts = 0;
  await db.query('BEGIN');
  try {
    await db.query(
      `DELETE FROM artwork_reservations WHERE artwork_id IN (SELECT id FROM artworks WHERE seller_id = ANY($1))`,
      [sellerIds],
    );
    await db.query(`DELETE FROM artworks WHERE seller_id = ANY($1)`, [
      sellerIds,
    ]);
    await db.query(`DELETE FROM artwork_folders WHERE seller_id = ANY($1)`, [
      sellerIds,
    ]);
    await db.query(`DELETE FROM tags WHERE seller_id = ANY($1)`, [sellerIds]);
    await db.query(`DELETE FROM seller_summaries WHERE seller_id = ANY($1)`, [
      sellerIds,
    ]);

    for (const s of SELLERS) {
      await db.query(
        `INSERT INTO seller_summaries (seller_id, slug, display_name, avatar_url, is_verified, updated_at)
         VALUES ($1, $2, $3, NULL, $4, now())`,
        [s.userId, s.slug, s.displayName, s.verified],
      );
    }

    // Thư mục: mỗi seller một nhóm, đánh số theo thứ tự xuất hiện
    const folderId = new Map<string, string>();
    let fi = 0;
    for (const a of ARTWORKS) {
      if (!a.folder) continue;
      const key = `${a.seller}/${a.folder}`;
      if (folderId.has(key)) continue;
      const id = seedUuid('8', ++fi); // nhóm 4 phải bắt đầu bằng 8|9|a|b mới là UUID hợp lệ
      const pos = [...folderId.keys()].filter((k) =>
        k.startsWith(a.seller),
      ).length;
      await db.query(
        `INSERT INTO artwork_folders (id, seller_id, name, position) VALUES ($1, $2, $3, $4)`,
        [id, a.seller, a.folder, pos],
      );
      folderId.set(key, id);
    }

    for (const [i, a] of ARTWORKS.entries()) {
      const id = seedUuid('9', i + 1);
      const imgs = images.get(i) ?? [];
      // Không có ảnh thì không đủ điều kiện hiển thị → hạ xuống bản nháp
      const isPublicStatus =
        a.status === 'published' || a.status === 'sold_out';
      const status: Status =
        isPublicStatus && imgs.length === 0 ? 'draft' : a.status;
      const qty = a.qty ?? 1;
      const available = Math.max(0, qty - (a.sold ?? 0));
      const daysAgo = (ARTWORKS.length - i) * 3;
      await db.query(
        `INSERT INTO artworks (id, seller_id, folder_id, title, description, creator_name, creation_year, medium,
            width_cm, height_cm, depth_cm, dimension_unit, is_framed, listing_type, price,
            quantity_total, quantity_available, allow_offers, status, published_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                 now() - make_interval(days => $21), now() - make_interval(days => $21))`,
        [
          id,
          a.seller,
          a.folder ? folderId.get(`${a.seller}/${a.folder}`) : null,
          a.title,
          a.description,
          SELLERS.find((s) => s.userId === a.seller)!.displayName,
          a.year,
          a.medium,
          a.w,
          a.h,
          a.d ?? null,
          a.unit ?? 'cm',
          a.framed ?? false,
          a.listing,
          a.listing === 'display_only' ? null : (a.price ?? null),
          qty,
          available,
          a.offers ?? false,
          status,
          status === 'published' || status === 'sold_out'
            ? new Date(Date.now() - daysAgo * 86_400_000)
            : null,
          daysAgo,
        ],
      );
      for (const [pos, img] of imgs.entries()) {
        await db.query(
          `INSERT INTO artwork_images (artwork_id, public_id, version, format, width, height, bytes, position)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            id,
            img.publicId,
            img.version,
            img.format,
            img.width,
            img.height,
            img.bytes,
            pos,
          ],
        );
      }
      for (const slug of a.tags) {
        const t = tagId.get(slug);
        if (!t)
          throw new Error(
            `Không có tag hệ thống "${slug}" — đã chạy migrate catalog chưa?`,
          );
        await db.query(
          `INSERT INTO artwork_tags (artwork_id, tag_id) VALUES ($1, $2)`,
          [id, t],
        );
      }
      if (status === 'published' || status === 'sold_out') published++;
      else if (status === 'draft') drafts++;
    }

    // Một tag riêng của nghệ sĩ Lan
    await db.query(
      `INSERT INTO tags (seller_id, category, name, slug) VALUES ($1, 'subject', 'Phố cổ Hà Nội', 'pho-co-ha-noi')`,
      [U.lan],
    );
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
  return { withImages, published, drafts };
}

/** Social có thể chưa được migrate (DB khác / chưa chạy) — không làm hỏng cả seed. */
async function syncSocial(
  identity: DataSource,
  catalog: DataSource,
): Promise<void> {
  const url = process.env.SOCIAL_DATABASE_URL;
  if (!url) {
    console.log('  ⚠ Bỏ qua: chưa có SOCIAL_DATABASE_URL trong be/.env');
    return;
  }
  const socialDs = await new DataSource({ type: 'postgres', url }).initialize();
  const social = socialDs.createQueryRunner();
  try {
    const s = await syncSocialProjections(identity, catalog, social);
    console.log(
      `  ${s.users} người dùng, ${s.artworks} tác phẩm (${s.publicArtworks} công khai)`,
    );
  } catch (e) {
    console.log(
      `  ⚠ Không đồng bộ được social (đã chạy "npm run migrate" chưa?): ${e instanceof Error ? e.message : e}`,
    );
  } finally {
    await social.release();
    await socialDs.destroy();
  }
}

async function main(): Promise<void> {
  const identityDs = await new DataSource({
    type: 'postgres',
    url: requireEnv('IDENTITY_DATABASE_URL'),
  }).initialize();
  const catalogDs = await new DataSource({
    type: 'postgres',
    url: requireEnv('CATALOG_DATABASE_URL'),
  }).initialize();
  // QueryRunner = một kết nối cố định, để BEGIN/COMMIT áp dụng đúng chỗ
  const identity = identityDs.createQueryRunner();
  const catalog = catalogDs.createQueryRunner();
  try {
    console.log('▶ identity: tài khoản + hồ sơ nghệ sĩ');
    await seedIdentity(identity);
    console.log('▶ catalog: thư mục, tác phẩm, ảnh, tag');
    const r = await seedCatalog(catalog);
    console.log('▶ social: đồng bộ user_summaries + artwork_summaries');
    await syncSocial(identityDs, catalogDs);

    console.log(`\n✔ Xong. Mật khẩu mọi tài khoản: ${SEED_PASSWORD}\n`);
    console.table(
      USERS.map((u) => ({
        email: u.email,
        vai_tro: u.role,
        ghi_chu: u.onboarded
          ? (SELLERS.find((s) => s.userId === u.id)?.slug ?? '')
          : 'chưa onboarding (hiện popup)',
      })),
    );
    console.log(
      `Tác phẩm: ${ARTWORKS.length} (công khai ${r.published}, nháp ${r.drafts})`,
    );
    if (!r.withImages) {
      console.log(
        '⚠ Chưa cấu hình CLOUDINARY_* trong be/.env nên tác phẩm không có ảnh và chỉ ở dạng nháp.\n' +
          '  Điền khóa Cloudinary rồi chạy lại "npm run seed" để có ảnh và tác phẩm công khai.',
      );
    }
  } finally {
    await identity.release();
    await catalog.release();
    await identityDs.destroy();
    await catalogDs.destroy();
  }
}

main().catch((e: unknown) => {
  console.error('✖ Seed lỗi:', e instanceof Error ? e.message : e);
  process.exit(1);
});
