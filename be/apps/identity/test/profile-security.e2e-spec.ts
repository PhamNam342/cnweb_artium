/**
 * E2E: đổi mật khẩu bằng mã email + đổi ảnh đại diện (Cloudinary giả lập bằng khóa test).
 * Chạy trên identity_db thật (IDENTITY_DATABASE_URL trong be/.env).
 */
process.env.OUTBOX_RELAY_ENABLED = 'false';
process.env.MAILER_ENABLED = 'false';
process.env.GOOGLE_CLIENT_ID = '';
process.env.REFRESH_REUSE_GRACE_SECONDS = '0';
process.env.CLOUDINARY_CLOUD_NAME = 'artium-test';
process.env.CLOUDINARY_API_KEY = '000000000000000';
process.env.CLOUDINARY_API_SECRET = 'e2e-avatar-secret';
process.env.CLOUDINARY_FOLDER = 'artium';

import { configureServiceApp } from '@app/common';
import { CloudinaryService } from '@app/storage';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { IdentityModule } from '../src/identity.module';

interface UserBody {
  id: string;
  avatarUrl: string | null;
  sellerSlug: string | null;
}
interface AuthBody {
  accessToken: string;
  user: UserBody;
}

const cookieOf = (res: request.Response): string => {
  const c = (res.get('Set-Cookie') ?? []).find((x) =>
    x.startsWith('artium_rt='),
  );
  if (!c) throw new Error('Không có cookie refresh token');
  return c.split(';')[0];
};

describe('Hồ sơ: đổi mật khẩu bằng mã + ảnh đại diện (e2e)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;
  const destroyed: string[] = [];
  const email = `sec-${randomUUID().slice(0, 8)}@artium.test`;
  const password = 'Matkhau123';
  let userId = '';
  let access = '';
  let cookie = '';

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${access}` });

  /** Mã mới nhất nằm trong payload outbox (thứ mailer sẽ gửi đi). */
  const latestCode = async () => {
    const rows: { payload: { code: string } }[] = await ds.query(
      `SELECT payload FROM outbox WHERE aggregate_id = $1 AND event_type = 'identity.password_change.requested'
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    return rows[0].payload.code;
  };
  /** Bỏ qua giới hạn 1 mã / phút trong test. */
  const skipThrottle = () =>
    ds.query(
      `UPDATE user_tokens SET created_at = now() - interval '2 minutes' WHERE user_id = $1`,
      [userId],
    );

  const uploaded = (publicId: string, version = 1795000000) => ({
    publicId,
    version,
    signature: createHash('sha1')
      .update(
        `public_id=${publicId}&version=${version}${process.env.CLOUDINARY_API_SECRET}`,
      )
      .digest('hex'),
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [IdentityModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureServiceApp(app, 'Identity');
    await app.init();
    ds = app.get(DataSource);
    jest
      .spyOn(app.get(CloudinaryService), 'destroy')
      .mockImplementation((ids) => {
        destroyed.push(...ids);
        return Promise.resolve();
      });
    const res = await http()
      .post('/api/auth/register')
      .send({ email, password, fullName: 'Người Test Bảo Mật' })
      .expect(201);
    const body = res.body as AuthBody;
    userId = body.user.id;
    access = body.accessToken;
    cookie = cookieOf(res);
  });

  afterAll(async () => {
    await ds.query(
      `DELETE FROM outbox WHERE aggregate_id = $1 OR payload->>'email' = $2`,
      [userId, email],
    );
    await ds.query(`DELETE FROM users WHERE email = $1`, [email]);
    await app.close();
  });

  describe('Đổi mật khẩu bằng mã email', () => {
    it('gửi mã: 6 chữ số trong outbox, email được che bớt, DB chỉ lưu bản băm', async () => {
      const res = await http()
        .post('/api/auth/password/change-code')
        .set(auth())
        .expect(200);
      const body = res.body as { sentTo: string; expiresAt: string };
      expect(body.sentTo).toMatch(/^se•+@artium\.test$/);
      const code = await latestCode();
      expect(code).toMatch(/^\d{6}$/);
      const [row]: { token_hash: string }[] = await ds.query(
        `SELECT token_hash FROM user_tokens WHERE user_id = $1 AND type = 'password_change'`,
        [userId],
      );
      expect(row.token_hash).not.toContain(code);
    });

    it('chặn gửi lại trong vòng 1 phút', async () => {
      await http()
        .post('/api/auth/password/change-code')
        .set(auth())
        .expect(400);
    });

    it('cần đăng nhập', async () => {
      await http().post('/api/auth/password/change-code').expect(401);
    });

    it('sai mã: báo số lần còn lại; sai 5 lần thì mã bị hủy', async () => {
      const code = await latestCode();
      const wrong = code === '000000' ? '111111' : '000000';
      for (let i = 4; i >= 1; i--) {
        const r = await http()
          .post('/api/auth/password/change-with-code')
          .set(auth())
          .send({ code: wrong, newPassword: 'MatKhauMoi1' })
          .expect(400);
        expect((r.body as { message: string }).message).toBe(
          `Mã không đúng — còn ${i} lần thử`,
        );
      }
      const last = await http()
        .post('/api/auth/password/change-with-code')
        .set(auth())
        .send({ code: wrong, newPassword: 'MatKhauMoi1' })
        .expect(400);
      expect((last.body as { message: string }).message).toMatch(
        /quá nhiều lần/,
      );
      // Mã đúng cũng không dùng được nữa
      await http()
        .post('/api/auth/password/change-with-code')
        .set(auth())
        .send({ code, newPassword: 'MatKhauMoi1' })
        .expect(400);
    });

    it('validate: mã 6 số, mật khẩu mới đủ mạnh', async () => {
      await http()
        .post('/api/auth/password/change-with-code')
        .set(auth())
        .send({ code: '12ab', newPassword: 'MatKhauMoi1' })
        .expect(400);
      await http()
        .post('/api/auth/password/change-with-code')
        .set(auth())
        .send({ code: '123456', newPassword: 'ngan' })
        .expect(400);
    });

    it('đúng mã: đổi mật khẩu, cấp phiên mới, đăng xuất thiết bị khác, mã không dùng lại được', async () => {
      await skipThrottle();
      await http()
        .post('/api/auth/password/change-code')
        .set(auth())
        .expect(200);
      const code = await latestCode();
      const res = await http()
        .post('/api/auth/password/change-with-code')
        .set(auth())
        .send({ code, newPassword: 'MatKhauMoi1' })
        .expect(200);
      const body = res.body as AuthBody;
      expect(body.accessToken).toBeTruthy();
      const newCookie = cookieOf(res);

      // Phiên cũ (thiết bị khác) bị thu hồi, phiên mới dùng được
      await http().post('/api/auth/refresh').set('Cookie', cookie).expect(401);
      const refreshed = await http()
        .post('/api/auth/refresh')
        .set('Cookie', newCookie)
        .expect(200);
      cookie = cookieOf(refreshed);
      access = (refreshed.body as AuthBody).accessToken;

      // Mật khẩu cũ hết tác dụng, mật khẩu mới đăng nhập được
      await http()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(401);
      await http()
        .post('/api/auth/login')
        .send({ email, password: 'MatKhauMoi1' })
        .expect(200);

      // Dùng lại mã → lỗi
      await http()
        .post('/api/auth/password/change-with-code')
        .set(auth())
        .send({ code, newPassword: 'MatKhauKhac2' })
        .expect(400);
    });
  });

  describe('Ảnh đại diện', () => {
    let firstId = '';

    it('cấp chữ ký upload vào thư mục avatar riêng', async () => {
      const res = await http()
        .post('/api/users/me/avatar/upload-ticket')
        .set(auth())
        .expect(200);
      const t = res.body as {
        items: { publicId: string }[];
        uploadUrl: string;
      };
      expect(t.items).toHaveLength(1);
      expect(t.items[0].publicId.startsWith(`artium/avatars/${userId}/`)).toBe(
        true,
      );
      firstId = t.items[0].publicId;
    });

    it('từ chối chữ ký giả và ảnh của người khác', async () => {
      await http()
        .put('/api/users/me/avatar')
        .set(auth())
        .send({ ...uploaded(firstId), signature: 'x'.repeat(40) })
        .expect(400);
      await http()
        .put('/api/users/me/avatar')
        .set(auth())
        .send(uploaded(`artium/avatars/${randomUUID()}/stolen`))
        .expect(400);
    });

    it('đặt ảnh: URL cắt vuông theo khuôn mặt + ghi event user.updated', async () => {
      const res = await http()
        .put('/api/users/me/avatar')
        .set(auth())
        .send(uploaded(firstId))
        .expect(200);
      const u = res.body as UserBody;
      expect(u.avatarUrl).toBe(
        `https://res.cloudinary.com/artium-test/image/upload/c_fill,w_256,h_256,g_face,f_auto,q_auto/v1795000000/${firstId}`,
      );
      const rows: unknown[] = await ds.query(
        `SELECT 1 FROM outbox WHERE aggregate_id = $1 AND event_type = 'identity.user.updated'`,
        [userId],
      );
      expect(rows.length).toBeGreaterThan(0);
    });

    it('đổi ảnh khác: ảnh cũ bị xóa khỏi Cloudinary', async () => {
      const t = (
        await http()
          .post('/api/users/me/avatar/upload-ticket')
          .set(auth())
          .expect(200)
      ).body as {
        items: { publicId: string }[];
      };
      await http()
        .put('/api/users/me/avatar')
        .set(auth())
        .send(uploaded(t.items[0].publicId, 1795000001))
        .expect(200);
      expect(destroyed).toEqual([firstId]);
    });

    it('nghệ sĩ: hồ sơ nghệ sĩ dùng chung ảnh được cập nhật theo', async () => {
      const slug = `sec-${userId.slice(0, 8)}`;
      await http()
        .post('/api/sellers/me')
        .set(auth())
        .send({
          displayName: 'Nghệ sĩ Bảo Mật',
          slug,
          profileType: 'individual',
        })
        .expect(201);
      const t = (
        await http()
          .post('/api/users/me/avatar/upload-ticket')
          .set(auth())
          .expect(200)
      ).body as {
        items: { publicId: string }[];
      };
      const res = await http()
        .put('/api/users/me/avatar')
        .set(auth())
        .send(uploaded(t.items[0].publicId, 1795000002))
        .expect(200);
      const url = (res.body as UserBody).avatarUrl;
      const [p]: { avatar_url: string }[] = await ds.query(
        `SELECT avatar_url FROM seller_profiles WHERE user_id = $1`,
        [userId],
      );
      expect(p.avatar_url).toBe(url);
      const ev: { payload: { avatarUrl: string } }[] = await ds.query(
        `SELECT payload FROM outbox WHERE aggregate_id = (SELECT id FROM seller_profiles WHERE user_id = $1)
         AND event_type = 'identity.seller_profile.upserted' ORDER BY created_at DESC LIMIT 1`,
        [userId],
      );
      expect(ev[0].payload.avatarUrl).toBe(url);
    });

    it('gỡ ảnh: avatar về null, ảnh trên Cloudinary bị xóa', async () => {
      const before = destroyed.length;
      const res = await http()
        .delete('/api/users/me/avatar')
        .set(auth())
        .expect(200);
      expect((res.body as UserBody).avatarUrl).toBeNull();
      expect(destroyed.length).toBe(before + 1);
    });
  });
});
