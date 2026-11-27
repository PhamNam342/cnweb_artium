/**
 * E2E Catalog: chạy trên catalog_db thật (CATALOG_DATABASE_URL trong be/.env, đã migrate).
 * Token được ký bằng JWT_ACCESS_SECRET chung (giống identity cấp). Cloudinary dùng khóa giả:
 * chữ ký upload được tính lại trong test, destroy() bị thay bằng mock.
 *   npm run test:e2e
 */
process.env.OUTBOX_RELAY_ENABLED = 'false';
process.env.EVENT_CONSUMERS_ENABLED = 'false';
process.env.CLOUDINARY_CLOUD_NAME = 'artium-test';
process.env.CLOUDINARY_API_KEY = '000000000000000';
process.env.CLOUDINARY_API_SECRET = 'e2e-cloudinary-secret';
process.env.CLOUDINARY_FOLDER = 'artium';

import { configureServiceApp, UserRole } from '@app/common';
import { IdentityEvents } from '@app/contracts';
import { CloudinaryService } from '@app/storage';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { CatalogModule } from '../src/catalog.module';
import { SellerSummaryConsumer } from '../src/sellers/seller-summary.consumer';

interface ImageBody {
  publicId: string;
  thumbUrl: string;
  position: number;
}
interface ArtworkBody {
  id: string;
  title: string;
  status: string;
  price: number | null;
  quantityTotal: number;
  quantityAvailable: number;
  widthCm: number | null;
  dimensionUnit: string;
  folderId?: string | null;
  images: ImageBody[];
  coverImage: ImageBody | null;
  tags: { id: string; slug: string; isSystem: boolean }[];
  seller: { slug: string; displayName: string } | null;
}
interface TicketBody {
  uploadUrl: string;
  items: { publicId: string; timestamp: number; signature: string }[];
}

describe('Catalog (e2e)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;
  let jwt: JwtService;
  const destroyed: string[] = [];

  const seller = { id: randomUUID(), email: `s-${Date.now()}@artium.test` };
  const other = { id: randomUUID(), email: `o-${Date.now()}@artium.test` };
  const collector = { id: randomUUID(), email: `c-${Date.now()}@artium.test` };

  const token = (u: { id: string; email: string }, role: UserRole, ev = true) =>
    jwt.sign({ sub: u.id, email: u.email, role, ev });
  let S: string; // seller, đã xác minh email
  let O: string; // seller khác
  let C: string; // collector

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  /** Giả lập kết quả Cloudinary trả về sau khi upload với ticket server cấp. */
  const uploaded = (publicId: string, version = 1700000000) => ({
    publicId,
    version,
    signature: createHash('sha1')
      .update(
        `public_id=${publicId}&version=${version}${process.env.CLOUDINARY_API_SECRET}`,
      )
      .digest('hex'),
    format: 'jpg',
    width: 1600,
    height: 1200,
    bytes: 345_678,
  });

  const ticket = async (t: string, count: number) =>
    (
      await http()
        .post('/api/uploads/artwork-images')
        .set(auth(t))
        .send({ count })
        .expect(200)
    ).body as TicketBody;

  const systemTag = async (slug: string) => {
    const res = await http()
      .get('/api/tags')
      .query({ scope: 'system' })
      .expect(200);
    return (res.body as { id: string; slug: string }[]).find(
      (t) => t.slug === slug,
    )!;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CatalogModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureServiceApp(app, 'Catalog');
    await app.init();
    ds = app.get(DataSource);
    jwt = app.get(JwtService);
    jest
      .spyOn(app.get(CloudinaryService), 'destroy')
      .mockImplementation((ids) => {
        destroyed.push(...ids);
        return Promise.resolve();
      });
    S = token(seller, UserRole.Seller);
    O = token(other, UserRole.Seller);
    C = token(collector, UserRole.Collector);
  });

  afterAll(async () => {
    const ids = [seller.id, other.id];
    await ds.query(`DELETE FROM artworks WHERE seller_id = ANY($1)`, [ids]);
    await ds.query(`DELETE FROM artwork_folders WHERE seller_id = ANY($1)`, [
      ids,
    ]);
    await ds.query(`DELETE FROM tags WHERE seller_id = ANY($1)`, [ids]);
    await ds.query(`DELETE FROM seller_summaries WHERE seller_id = ANY($1)`, [
      ids,
    ]);
    await ds.query(`DELETE FROM outbox WHERE payload->>'sellerId' = ANY($1)`, [
      ids,
    ]);
    await app.close();
  });

  describe('Phân quyền', () => {
    it('collector không tạo được tác phẩm, không xin được chữ ký upload', async () => {
      await http()
        .post('/api/artworks')
        .set(auth(C))
        .send({ title: 'X' })
        .expect(403);
      await http()
        .post('/api/uploads/artwork-images')
        .set(auth(C))
        .send({ count: 1 })
        .expect(403);
    });
    it('chưa đăng nhập → 401', async () => {
      await http().get('/api/artworks/mine').expect(401);
    });
  });

  describe('Upload ảnh (chữ ký Cloudinary)', () => {
    it('cấp public_id trong thư mục riêng của seller', async () => {
      const t = await ticket(S, 3);
      expect(t.uploadUrl).toBe(
        'https://api.cloudinary.com/v1_1/artium-test/image/upload',
      );
      expect(t.items).toHaveLength(3);
      for (const it of t.items) {
        expect(it.publicId.startsWith(`artium/artworks/${seller.id}/`)).toBe(
          true,
        );
      }
    });
    it('giới hạn số ảnh mỗi lần', async () => {
      await http()
        .post('/api/uploads/artwork-images')
        .set(auth(S))
        .send({ count: 11 })
        .expect(400);
    });
  });

  describe('Vòng đời tác phẩm', () => {
    let artworkId: string;
    let imgs: string[];

    it('tạo bản nháp với ảnh, tag, kích thước theo cm', async () => {
      const t = await ticket(S, 2);
      imgs = t.items.map((i) => i.publicId);
      const tag = await systemTag('son-dau');
      const res = await http()
        .post('/api/artworks')
        .set(auth(S))
        .send({
          title: '  Hoàng hôn Hồ Tây ',
          description: 'Sơn dầu trên toan',
          creationYear: 2024,
          widthCm: 60,
          heightCm: 80.5,
          dimensionUnit: 'in',
          listingType: 'for_sale',
          price: 12_000_000,
          quantityTotal: 1,
          tagIds: [tag.id],
          images: imgs.map((id) => uploaded(id)),
        })
        .expect(201);
      const a = res.body as ArtworkBody;
      artworkId = a.id;
      expect(a).toMatchObject({
        title: 'Hoàng hôn Hồ Tây',
        status: 'draft',
        widthCm: 60,
        dimensionUnit: 'in',
        price: 12_000_000,
        quantityAvailable: 1,
        folderId: null,
      });
      expect(a.images.map((i) => i.publicId)).toEqual(imgs);
      expect(a.coverImage?.thumbUrl).toContain('/c_fill,w_400,h_400');
      expect(a.tags[0]).toMatchObject({ slug: 'son-dau', isSystem: true });
    });

    it('bản nháp không hiện công khai, nhưng chủ xem trước được', async () => {
      await http().get(`/api/artworks/${artworkId}`).expect(404);
      await http().get(`/api/artworks/${artworkId}`).set(auth(O)).expect(404);
      await http().get(`/api/artworks/${artworkId}`).set(auth(S)).expect(200);
    });

    it('từ chối ảnh có chữ ký giả hoặc không thuộc thư mục của seller', async () => {
      const fake = {
        ...uploaded(`artium/artworks/${seller.id}/fake`),
        signature: 'x'.repeat(40),
      };
      await http()
        .put(`/api/artworks/${artworkId}/images`)
        .set(auth(S))
        .send({ images: [fake] })
        .expect(400);
      const foreign = uploaded(`artium/artworks/${other.id}/stolen`);
      const res = await http()
        .put(`/api/artworks/${artworkId}/images`)
        .set(auth(S))
        .send({ images: [foreign] })
        .expect(400);
      expect((res.body as { message: string }).message).toContain(
        'không thuộc tài khoản',
      );
    });

    it('seller khác không sửa / đăng được', async () => {
      await http()
        .patch(`/api/artworks/${artworkId}`)
        .set(auth(O))
        .send({ title: 'Hack' })
        .expect(404);
      await http()
        .post(`/api/artworks/${artworkId}/publish`)
        .set(auth(O))
        .expect(404);
    });

    it('chưa xác minh email thì không đăng được', async () => {
      const unverified = token(seller, UserRole.Seller, false);
      await http()
        .post(`/api/artworks/${artworkId}/publish`)
        .set(auth(unverified))
        .expect(403);
    });

    it('đăng tác phẩm → công khai + ghi event published vào outbox', async () => {
      const res = await http()
        .post(`/api/artworks/${artworkId}/publish`)
        .set(auth(S))
        .expect(200);
      expect((res.body as ArtworkBody).status).toBe('published');
      const pub = await http().get(`/api/artworks/${artworkId}`).expect(200);
      expect((pub.body as ArtworkBody).folderId).toBeUndefined(); // field riêng của chủ
      const rows: { payload: { coverImageUrl: string; price: number } }[] =
        await ds.query(
          `SELECT payload FROM outbox WHERE aggregate_id = $1 AND event_type = 'catalog.artwork.published'`,
          [artworkId],
        );
      expect(rows).toHaveLength(1);
      expect(rows[0].payload.price).toBe(12_000_000);
      expect(rows[0].payload.coverImageUrl).toContain(imgs[0]);
    });

    it('đăng lại lần nữa không sinh event trùng', async () => {
      await http()
        .post(`/api/artworks/${artworkId}/publish`)
        .set(auth(S))
        .expect(200);
      const [{ n }]: { n: string }[] = await ds.query(
        `SELECT COUNT(*) n FROM outbox WHERE aggregate_id = $1 AND event_type = 'catalog.artwork.published'`,
        [artworkId],
      );
      expect(Number(n)).toBe(1);
    });

    it('đổi thứ tự ảnh, bỏ một ảnh → ảnh bị bỏ bị xóa khỏi Cloudinary', async () => {
      const res = await http()
        .put(`/api/artworks/${artworkId}/images`)
        .set(auth(S))
        .send({ images: [{ publicId: imgs[1] }] })
        .expect(200);
      const a = res.body as ArtworkBody;
      expect(a.images.map((i) => i.publicId)).toEqual([imgs[1]]);
      expect(a.coverImage?.publicId).toBe(imgs[1]);
      expect(destroyed).toContain(imgs[0]);
    });

    it('tác phẩm đang hiển thị không được bỏ hết ảnh hay xóa giá', async () => {
      await http()
        .put(`/api/artworks/${artworkId}/images`)
        .set(auth(S))
        .send({ images: [] })
        .expect(422);
      const res = await http()
        .patch(`/api/artworks/${artworkId}`)
        .set(auth(S))
        .send({ price: null })
        .expect(422);
      expect((res.body as { message: string }).message).toContain('giá');
    });

    it('sửa tác phẩm đang hiển thị → event updated', async () => {
      await http()
        .patch(`/api/artworks/${artworkId}`)
        .set(auth(S))
        .send({ price: 15_000_000 })
        .expect(200);
      const rows: unknown[] = await ds.query(
        `SELECT 1 FROM outbox WHERE aggregate_id = $1 AND event_type = 'catalog.artwork.updated'`,
        [artworkId],
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('gỡ đăng → nháp + event archived(reason=unpublished)', async () => {
      const res = await http()
        .post(`/api/artworks/${artworkId}/unpublish`)
        .set(auth(S))
        .expect(200);
      expect((res.body as ArtworkBody).status).toBe('draft');
      const rows: { payload: { reason: string } }[] = await ds.query(
        `SELECT payload FROM outbox WHERE aggregate_id = $1 AND event_type = 'catalog.artwork.archived'`,
        [artworkId],
      );
      expect(rows.map((r) => r.payload.reason)).toEqual(['unpublished']);
    });

    it('lưu trữ / khôi phục / xóa mềm', async () => {
      await http()
        .post(`/api/artworks/${artworkId}/archive`)
        .set(auth(S))
        .expect(200);
      await http()
        .patch(`/api/artworks/${artworkId}`)
        .set(auth(S))
        .send({ title: 'Y' })
        .expect(400);
      const r = await http()
        .post(`/api/artworks/${artworkId}/restore`)
        .set(auth(S))
        .expect(200);
      expect((r.body as ArtworkBody).status).toBe('draft');
      await http()
        .delete(`/api/artworks/${artworkId}`)
        .set(auth(S))
        .expect(204);
      await http()
        .get(`/api/artworks/mine/${artworkId}`)
        .set(auth(S))
        .expect(404);
    });
  });

  describe('Điều kiện đăng', () => {
    it('thiếu ảnh và giá → 422 kèm danh sách lỗi', async () => {
      const a = (
        await http()
          .post('/api/artworks')
          .set(auth(S))
          .send({ title: 'Chưa xong', listingType: 'for_sale' })
          .expect(201)
      ).body as ArtworkBody;
      const res = await http()
        .post(`/api/artworks/${a.id}/publish`)
        .set(auth(S))
        .expect(422);
      expect((res.body as { errors: string[] }).errors).toEqual([
        'Tác phẩm cần ít nhất 1 ảnh',
        'Tác phẩm bán cần có giá lớn hơn 0',
      ]);
    });

    it('display_only không cần giá và tự xóa giá', async () => {
      const t = await ticket(S, 1);
      const a = (
        await http()
          .post('/api/artworks')
          .set(auth(S))
          .send({
            title: 'Chỉ trưng bày',
            listingType: 'display_only',
            price: 5_000_000,
            images: [uploaded(t.items[0].publicId)],
          })
          .expect(201)
      ).body as ArtworkBody;
      expect(a.price).toBeNull();
      await http()
        .post(`/api/artworks/${a.id}/publish`)
        .set(auth(S))
        .expect(200);
    });

    it('đã bán ngoài nền tảng: ẩn tên người mua với người ngoài, không có giá bán', async () => {
      const t = await ticket(S, 1);
      const create = (saleRecord: object) =>
        http()
          .post('/api/artworks')
          .set(auth(S))
          .send({
            title: 'Đã bán cho nhà sưu tầm',
            listingType: 'sold',
            price: 9_000_000,
            saleRecord,
            images: [uploaded(t.items[0].publicId)],
          });
      // Bật hiện trên hồ sơ thì phải có giá + ngày bán
      await create({ showOnProfile: true }).expect(400);
      await create({
        showOnProfile: true,
        soldPrice: 20_000_000,
        soldAt: '2999-01-01',
      }).expect(400);
      const res = await create({
        collectorName: 'Bộ sưu tập Nguyễn',
        showOnProfile: true,
        soldPrice: 20_000_000,
        soldAt: '2025-06-01',
      }).expect(201);
      const a = res.body as ArtworkBody & {
        saleRecord: Record<string, unknown>;
      };
      expect(a.price).toBeNull();
      expect(a.saleRecord).toMatchObject({
        collectorName: 'Bộ sưu tập Nguyễn',
        soldPrice: 20_000_000,
      });
      await http()
        .post(`/api/artworks/${a.id}/publish`)
        .set(auth(S))
        .expect(200);
      const pub = (await http().get(`/api/artworks/${a.id}`).expect(200))
        .body as {
        status: string;
        saleRecord: Record<string, unknown>;
      };
      expect(pub.status).toBe('published');
      expect(pub.saleRecord).toEqual({
        soldPrice: 20_000_000,
        soldAt: '2025-06-01',
      });
      // Đổi sang bán thường thì thông tin bán bị xóa
      const upd = await http()
        .patch(`/api/artworks/${a.id}`)
        .set(auth(S))
        .send({ listingType: 'for_sale', price: 21_000_000 })
        .expect(200);
      expect((upd.body as { saleRecord: unknown }).saleRecord).toBeNull();
      await http()
        .post(`/api/artworks/${a.id}/archive`)
        .set(auth(S))
        .expect(200);
    });

    it('validate dữ liệu đầu vào', async () => {
      await http()
        .post('/api/artworks')
        .set(auth(S))
        .send({ title: '' })
        .expect(400);
      await http()
        .post('/api/artworks')
        .set(auth(S))
        .send({ title: 'A', price: -5 })
        .expect(400);
      await http()
        .post('/api/artworks')
        .set(auth(S))
        .send({ title: 'A', widthCm: 1.234 })
        .expect(400);
      await http()
        .post('/api/artworks')
        .set(auth(S))
        .send({ title: 'A', description: 'x'.repeat(351) })
        .expect(400);
    });

    it('không cho dùng một ảnh cho hai tác phẩm', async () => {
      const t = await ticket(S, 1);
      const img = uploaded(t.items[0].publicId);
      await http()
        .post('/api/artworks')
        .set(auth(S))
        .send({ title: 'A1', images: [img] })
        .expect(201);
      await http()
        .post('/api/artworks')
        .set(auth(S))
        .send({ title: 'A2', images: [img] })
        .expect(400);
    });
  });

  describe('Thư mục', () => {
    let root: string;
    let child: string;

    it('tạo cây thư mục, chặn trùng tên cùng cấp', async () => {
      root = (
        (
          await http()
            .post('/api/folders')
            .set(auth(S))
            .send({ name: 'Series 2024' })
            .expect(201)
        ).body as { id: string }
      ).id;
      child = (
        (
          await http()
            .post('/api/folders')
            .set(auth(S))
            .send({ name: 'Phong cảnh', parentId: root })
            .expect(201)
        ).body as { id: string }
      ).id;
      await http()
        .post('/api/folders')
        .set(auth(S))
        .send({ name: 'series 2024' })
        .expect(409);
    });

    it('chặn vòng lặp và giới hạn 3 cấp', async () => {
      await http()
        .patch(`/api/folders/${root}`)
        .set(auth(S))
        .send({ parentId: child })
        .expect(400);
      const c3 = (
        (
          await http()
            .post('/api/folders')
            .set(auth(S))
            .send({ name: 'C3', parentId: child })
            .expect(201)
        ).body as { id: string }
      ).id;
      await http()
        .post('/api/folders')
        .set(auth(S))
        .send({ name: 'C4', parentId: c3 })
        .expect(400);
    });

    it('chuyển thư mục có con: được khi tổng vẫn ≤ 3 cấp, chặn khi vượt', async () => {
      const other = (
        (
          await http()
            .post('/api/folders')
            .set(auth(S))
            .send({ name: 'Nhánh khác' })
            .expect(201)
        ).body as { id: string }
      ).id;
      // child (cấp 2) có 1 con (C3) → cao 2 cấp; vào "Nhánh khác" (cấp 1) thành đúng 3 cấp
      await http()
        .patch(`/api/folders/${child}`)
        .set(auth(S))
        .send({ parentId: other })
        .expect(200);
      // root giờ chỉ còn 1 cấp; "Nhánh khác" cao 3 cấp → cho vào root sẽ thành 4 cấp
      await http()
        .patch(`/api/folders/${other}`)
        .set(auth(S))
        .send({ parentId: root })
        .expect(400);
    });

    it('không dùng được thư mục của người khác', async () => {
      await http()
        .post('/api/artworks')
        .set(auth(O))
        .send({ title: 'B', folderId: root })
        .expect(400);
      await http()
        .patch(`/api/folders/${root}`)
        .set(auth(O))
        .send({ name: 'X' })
        .expect(404);
    });

    it('chuyển hàng loạt vào thư mục, đếm số tác phẩm, xóa thư mục giữ lại tác phẩm', async () => {
      const mine = (
        await http().get('/api/artworks/mine').set(auth(S)).expect(200)
      ).body as { items: ArtworkBody[] };
      const ids = mine.items.map((a) => a.id);
      expect(ids.length).toBeGreaterThan(0);
      const r = await http()
        .post('/api/artworks/bulk')
        .set(auth(S))
        .send({ ids, action: 'move', folderId: child })
        .expect(200);
      expect((r.body as { updated: number }).updated).toBe(ids.length);

      const folders = (
        await http().get('/api/folders').set(auth(S)).expect(200)
      ).body as { id: string; artworkCount: number }[];
      expect(folders.find((f) => f.id === child)?.artworkCount).toBe(
        ids.length,
      );

      const filtered = (
        await http()
          .get('/api/artworks/mine')
          .query({ folderId: child })
          .set(auth(S))
          .expect(200)
      ).body as { total: number };
      expect(filtered.total).toBe(ids.length);
      const inFolder = filtered as unknown as {
        counts: Record<string, number>;
      };
      expect(Object.values(inFolder.counts).reduce((x, y) => x + y, 0)).toBe(
        ids.length,
      );

      await http().delete(`/api/folders/${child}`).set(auth(S)).expect(204);
      const none = (
        await http()
          .get('/api/artworks/mine')
          .query({ folderId: 'none' })
          .set(auth(S))
          .expect(200)
      ).body as { total: number };
      expect(none.total).toBe(ids.length);
    });
  });

  describe('Tag', () => {
    it('có sẵn 33 tag hệ thống theo nhóm', async () => {
      const res = await http()
        .get('/api/tags')
        .query({ scope: 'system' })
        .expect(200);
      const tags = res.body as { category: string }[];
      expect(tags).toHaveLength(33);
      expect(new Set(tags.map((t) => t.category))).toEqual(
        new Set(['medium', 'style', 'subject']),
      );
    });

    it('tạo tag riêng idempotent; gõ trùng tag hệ thống thì trả về tag hệ thống', async () => {
      const a = (
        await http()
          .post('/api/tags')
          .set(auth(S))
          .send({ name: 'Phố cổ  Hà Nội' })
          .expect(201)
      ).body as { id: string; slug: string; isSystem: boolean };
      expect(a).toMatchObject({ slug: 'pho-co-ha-noi', isSystem: false });
      const b = (
        await http()
          .post('/api/tags')
          .set(auth(S))
          .send({ name: 'phố cổ hà nội' })
          .expect(201)
      ).body as { id: string };
      expect(b.id).toBe(a.id);
      const sys = (
        await http()
          .post('/api/tags')
          .set(auth(S))
          .send({ name: 'Sơn Dầu' })
          .expect(201)
      ).body as { slug: string; isSystem: boolean };
      expect(sys).toMatchObject({ slug: 'son-dau', isSystem: true });

      const mine = (
        await http()
          .get('/api/tags')
          .query({ scope: 'mine' })
          .set(auth(S))
          .expect(200)
      ).body as { id: string }[];
      expect(mine.map((t) => t.id)).toEqual([a.id]);
    });

    it('không gắn được tag riêng của seller khác', async () => {
      const tagOfS = (
        (await http().get('/api/tags').query({ scope: 'mine' }).set(auth(S)))
          .body as { id: string }[]
      )[0];
      await http()
        .post('/api/artworks')
        .set(auth(O))
        .send({ title: 'B', tagIds: [tagOfS.id] })
        .expect(400);
    });
  });

  describe('Danh sách công khai + projection seller', () => {
    it('event seller_profile.upserted dựng seller_summaries; event cũ không ghi đè', async () => {
      const consumer = app.get(SellerSummaryConsumer);
      const base = {
        type: IdentityEvents.SellerProfileUpserted,
        source: 'identity',
      };
      const payload = {
        sellerId: seller.id,
        profileId: randomUUID(),
        avatarUrl: null,
        isVerified: true,
      };
      const newer = {
        ...base,
        id: randomUUID(),
        occurredAt: new Date().toISOString(),
        payload: {
          ...payload,
          slug: `nghe-si-${seller.id.slice(0, 8)}`,
          displayName: 'Nghệ sĩ Mới',
        },
      };
      const older = {
        ...base,
        id: randomUUID(),
        occurredAt: new Date(Date.now() - 60_000).toISOString(),
        payload: { ...payload, slug: 'cu', displayName: 'Tên cũ' },
      };
      expect(await consumer.handle(newer)).toBe(true);
      expect(await consumer.handle(newer)).toBe(false); // trùng message
      await consumer.handle(older);
      const [row]: { display_name: string }[] = await ds.query(
        `SELECT display_name FROM seller_summaries WHERE seller_id = $1`,
        [seller.id],
      );
      expect(row.display_name).toBe('Nghệ sĩ Mới');
    });

    it('lọc theo slug nghệ sĩ, tag, chỉ hiện tác phẩm đã đăng, kèm thông tin seller', async () => {
      const slug = `nghe-si-${seller.id.slice(0, 8)}`;
      const res = await http()
        .get('/api/artworks')
        .query({ sellerSlug: slug })
        .expect(200);
      const page = res.body as { items: ArtworkBody[]; total: number };
      expect(page.total).toBe(1); // chỉ tác phẩm display_only đã đăng
      expect(page.items[0].seller).toMatchObject({
        slug,
        displayName: 'Nghệ sĩ Mới',
      });
      // Tác phẩm tạo sau khi đã có hồ sơ: tác giả mặc định = tên nghệ sĩ
      const created = (
        await http()
          .post('/api/artworks')
          .set(auth(S))
          .send({ title: 'Có tác giả' })
          .expect(201)
      ).body as { creatorName: string };
      expect(created.creatorName).toBe('Nghệ sĩ Mới');
      expect(
        page.items.every((a) => ['published', 'sold_out'].includes(a.status)),
      ).toBe(true);

      const byTag = await http()
        .get('/api/artworks')
        .query({ sellerSlug: slug, tag: 'son-dau' })
        .expect(200);
      expect((byTag.body as { total: number }).total).toBe(0);
    });

    it('kho của seller có số đếm theo trạng thái và tìm kiếm', async () => {
      const res = await http()
        .get('/api/artworks/mine')
        .query({ q: 'chỉ trưng' })
        .set(auth(S))
        .expect(200);
      const body = res.body as {
        total: number;
        counts: Record<string, number>;
      };
      expect(body.total).toBe(1);
      expect(body.counts.published).toBe(1);
      expect(body.counts.draft).toBeGreaterThanOrEqual(2);
    });
  });
});
