/**
 * E2E nền tảng Social (issue 00): chạy trên social_db thật (SOCIAL_DATABASE_URL trong be/.env, đã migrate).
 * Consumer được gọi thẳng bằng handle(envelope) — không cần RabbitMQ.
 *   npm run test:e2e
 */
process.env.OUTBOX_RELAY_ENABLED = 'false';
process.env.EVENT_CONSUMERS_ENABLED = 'false';

import { configureServiceApp } from '@app/common';
import {
  ArtworkSnapshotPayload,
  CatalogEvents,
  EventEnvelope,
  IdentityEvents,
} from '@app/contracts';
import {
  BadRequestException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { SocialModule } from '../src/social.module';
import { ArtworkSummaryConsumer } from '../src/summaries/artwork-summary.consumer';
import { ArtworkSummary } from '../src/summaries/artwork-summary.entity';
import { UserSummaryConsumer } from '../src/summaries/user-summary.consumer';
import { UserSummary } from '../src/summaries/user-summary.entity';
import { TargetRegistry } from '../src/targets/target-registry';

const at = (minutes: number) =>
  new Date(Date.UTC(2026, 10, 1, 12, minutes)).toISOString();

function envelope<T>(
  type: string,
  occurredAt: string,
  payload: T,
): EventEnvelope<T> {
  return { id: randomUUID(), type, source: 'test', occurredAt, payload };
}

describe('Social foundation (e2e)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;
  let users: UserSummaryConsumer;
  let artworks: ArtworkSummaryConsumer;
  let registry: TargetRegistry;
  const userIds: string[] = [];
  const artworkIds: string[] = [];

  const newUser = () => {
    const id = randomUUID();
    userIds.push(id);
    return id;
  };
  const newArtwork = () => {
    const id = randomUUID();
    artworkIds.push(id);
    return id;
  };
  const userRow = (id: string) =>
    ds.getRepository(UserSummary).findOneBy({ userId: id });
  const artworkRow = (id: string) =>
    ds.getRepository(ArtworkSummary).findOneBy({ artworkId: id });

  const registered = (
    userId: string,
    fullName: string,
    when: string,
    avatarUrl: string | null = null,
  ) =>
    envelope(IdentityEvents.UserRegistered, when, {
      userId,
      email: `${userId}@artium.test`,
      fullName,
      avatarUrl,
      provider: 'password',
    });
  const updated = (
    userId: string,
    fullName: string,
    when: string,
    avatarUrl: string | null = null,
  ) =>
    envelope(IdentityEvents.UserUpdated, when, {
      userId,
      email: `${userId}@artium.test`,
      fullName,
      avatarUrl,
      role: 'collector',
      status: 'active',
    });
  const sellerUpserted = (
    sellerId: string,
    slug: string,
    displayName: string,
    when: string,
    avatarUrl: string | null = null,
  ) =>
    envelope(IdentityEvents.SellerProfileUpserted, when, {
      sellerId,
      profileId: randomUUID(),
      slug,
      displayName,
      avatarUrl,
      isVerified: false,
    });
  const snapshot = (
    type: string,
    artworkId: string,
    sellerId: string,
    status: string,
    when: string,
    title = 'Phố cổ mùa thu',
  ) =>
    envelope<ArtworkSnapshotPayload>(type, when, {
      artworkId,
      sellerId,
      title,
      coverImageUrl: 'https://res.cloudinary.com/x/image/upload/v1/cover',
      listingType: 'for_sale',
      status,
      price: 1_000_000,
      quantityAvailable: 1,
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SocialModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureServiceApp(app, 'Social');
    await app.init();
    ds = app.get(DataSource);
    users = app.get(UserSummaryConsumer);
    artworks = app.get(ArtworkSummaryConsumer);
    registry = app.get(TargetRegistry);
  });

  afterAll(async () => {
    if (userIds.length)
      await ds.query(`DELETE FROM user_summaries WHERE user_id = ANY($1)`, [
        userIds,
      ]);
    if (artworkIds.length)
      await ds.query(
        `DELETE FROM artwork_summaries WHERE artwork_id = ANY($1)`,
        [artworkIds],
      );
    await app.close();
  });

  it('health', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  describe('user_summaries', () => {
    it('user.registered tạo dòng; nhận lại cùng event thì bỏ qua', async () => {
      const id = newUser();
      const e = registered(id, 'Nguyễn Văn A', at(0));
      await expect(users.handle(e)).resolves.toBe(true);
      await expect(users.handle(e)).resolves.toBe(false);
      expect(await userRow(id)).toMatchObject({
        fullName: 'Nguyễn Văn A',
        avatarUrl: null,
        sellerSlug: null,
      });
    });

    it('user.updated mới hơn thì ghi đè, cũ hơn thì không', async () => {
      const id = newUser();
      await users.handle(registered(id, 'Tên cũ', at(0)));
      await users.handle(updated(id, 'Tên mới', at(10), 'https://img/new.jpg'));
      await users.handle(
        updated(id, 'Tên đến trễ', at(5), 'https://img/late.jpg'),
      );
      expect(await userRow(id)).toMatchObject({
        fullName: 'Tên mới',
        avatarUrl: 'https://img/new.jpg',
      });
    });

    it('seller_profile.upserted chỉ cập nhật slug, không đè tên tài khoản', async () => {
      const id = newUser();
      await users.handle(
        registered(id, 'Nguyễn Thị Lan', at(0), 'https://img/acc.jpg'),
      );
      await users.handle(
        sellerUpserted(
          id,
          'lan-studio',
          'Lan Studio',
          at(1),
          'https://img/profile.jpg',
        ),
      );
      expect(await userRow(id)).toMatchObject({
        fullName: 'Nguyễn Thị Lan',
        avatarUrl: 'https://img/acc.jpg',
        sellerSlug: 'lan-studio',
      });
    });

    it('seller_profile.upserted điền avatar khi tài khoản chưa có', async () => {
      const id = newUser();
      await users.handle(registered(id, 'Trần Minh', at(0)));
      await users.handle(
        sellerUpserted(id, 'tran-minh', 'Minh', at(1), 'https://img/p.jpg'),
      );
      expect((await userRow(id))?.avatarUrl).toBe('https://img/p.jpg');
    });

    it('seller_profile đến trước event tài khoản: event tài khoản (dù cũ hơn) vẫn sửa được tên', async () => {
      const id = newUser();
      await users.handle(sellerUpserted(id, 'gallery-x', 'Gallery X', at(5)));
      expect(await userRow(id)).toMatchObject({
        fullName: 'Gallery X',
        sellerSlug: 'gallery-x',
      });
      await users.handle(updated(id, 'Chủ Gallery', at(4)));
      expect(await userRow(id)).toMatchObject({
        fullName: 'Chủ Gallery',
        sellerSlug: 'gallery-x',
      });
    });

    it('bỏ qua event không liên quan', async () => {
      await expect(
        users.handle(
          envelope(IdentityEvents.PasswordResetRequested, at(0), {}),
        ),
      ).resolves.toBe(false);
    });
  });

  describe('artwork_summaries', () => {
    const seller = randomUUID();

    it('published => công khai; updated sold_out => vẫn công khai', async () => {
      const id = newArtwork();
      await expect(
        artworks.handle(
          snapshot(
            CatalogEvents.ArtworkPublished,
            id,
            seller,
            'published',
            at(0),
          ),
        ),
      ).resolves.toBe(true);
      expect(await artworkRow(id)).toMatchObject({
        sellerId: seller,
        isPublic: true,
      });
      await artworks.handle(
        snapshot(
          CatalogEvents.ArtworkUpdated,
          id,
          seller,
          'sold_out',
          at(1),
          'Tên mới',
        ),
      );
      expect(await artworkRow(id)).toMatchObject({
        title: 'Tên mới',
        isPublic: true,
      });
    });

    it('archived => ẩn nhưng giữ dòng; event published đến trễ không mở lại', async () => {
      const id = newArtwork();
      await artworks.handle(
        snapshot(
          CatalogEvents.ArtworkPublished,
          id,
          seller,
          'published',
          at(0),
        ),
      );
      await artworks.handle(
        snapshot(CatalogEvents.ArtworkArchived, id, seller, 'archived', at(10)),
      );
      expect(await artworkRow(id)).toMatchObject({ isPublic: false });
      await artworks.handle(
        snapshot(CatalogEvents.ArtworkUpdated, id, seller, 'published', at(5)),
      );
      expect((await artworkRow(id))?.isPublic).toBe(false);
    });

    it('archived (unpublish về nháp) => ẩn; đăng lại => công khai', async () => {
      const id = newArtwork();
      await artworks.handle(
        snapshot(
          CatalogEvents.ArtworkPublished,
          id,
          seller,
          'published',
          at(0),
        ),
      );
      await artworks.handle(
        snapshot(CatalogEvents.ArtworkArchived, id, seller, 'draft', at(1)),
      );
      expect((await artworkRow(id))?.isPublic).toBe(false);
      await artworks.handle(
        snapshot(
          CatalogEvents.ArtworkPublished,
          id,
          seller,
          'published',
          at(2),
        ),
      );
      expect((await artworkRow(id))?.isPublic).toBe(true);
    });

    it('cùng event nhận 2 lần chỉ áp dụng 1 lần', async () => {
      const id = newArtwork();
      const e = snapshot(
        CatalogEvents.ArtworkPublished,
        id,
        seller,
        'published',
        at(0),
      );
      await expect(artworks.handle(e)).resolves.toBe(true);
      await expect(artworks.handle(e)).resolves.toBe(false);
    });
  });

  describe('TargetRegistry', () => {
    const seller = randomUUID();
    let publicId: string;
    let hiddenId: string;

    beforeAll(async () => {
      publicId = newArtwork();
      hiddenId = newArtwork();
      await artworks.handle(
        snapshot(
          CatalogEvents.ArtworkPublished,
          publicId,
          seller,
          'published',
          at(0),
        ),
      );
      await artworks.handle(
        snapshot(
          CatalogEvents.ArtworkPublished,
          hiddenId,
          seller,
          'published',
          at(0),
        ),
      );
      await artworks.handle(
        snapshot(
          CatalogEvents.ArtworkArchived,
          hiddenId,
          seller,
          'archived',
          at(1),
        ),
      );
    });

    it('artwork công khai => trả về chủ tác phẩm', async () => {
      await expect(
        registry.require(ds.manager, 'artwork', publicId),
      ).resolves.toEqual({
        ownerId: seller,
        visible: true,
      });
    });

    it('artwork đã gỡ hoặc không tồn tại => 404; find vẫn thấy tác phẩm đã gỡ', async () => {
      await expect(
        registry.require(ds.manager, 'artwork', hiddenId),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        registry.require(ds.manager, 'artwork', randomUUID()),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        registry.find(ds.manager, 'artwork', hiddenId),
      ).resolves.toEqual({
        ownerId: seller,
        visible: false,
      });
    });

    it('loại chưa hỗ trợ => 400', async () => {
      await expect(
        registry.require(ds.manager, 'review', publicId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
