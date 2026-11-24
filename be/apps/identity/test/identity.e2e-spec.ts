/**
 * E2E Identity: chạy trên identity_db thật (IDENTITY_DATABASE_URL trong be/.env, đã migrate).
 *   npm run test:e2e
 */
process.env.OUTBOX_RELAY_ENABLED = 'false';
process.env.MAILER_ENABLED = 'false';
process.env.GOOGLE_CLIENT_ID = '';
process.env.REFRESH_REUSE_GRACE_SECONDS = '0'; // kiểm tra phát hiện dùng lại token ngay lập tức

import { configureServiceApp } from '@app/common';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { IdentityModule } from '../src/identity.module';

interface AuthBody {
  accessToken: string;
  user: {
    id: string;
    email: string;
    roles: string[];
    emailVerified: boolean;
    hasPassword: boolean;
    sellerSlug: string | null;
  };
}

const cookieOf = (res: request.Response): string => {
  const raw = res.get('Set-Cookie') ?? [];
  const c = raw.find((x) => x.startsWith('artium_rt='));
  if (!c) throw new Error('Không có cookie refresh token');
  return c.split(';')[0];
};

describe('Identity (e2e)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;
  const email = `e2e-${randomUUID().slice(0, 8)}@artium.test`;
  const password = 'Matkhau123';
  const extraEmails: string[] = [];

  const outboxUrl = async (userId: string, type: string, key: string) => {
    const rows: { payload: Record<string, string> }[] = await ds.query(
      `SELECT payload FROM outbox WHERE aggregate_id = $1 AND event_type = $2 ORDER BY created_at DESC LIMIT 1`,
      [userId, type],
    );
    return new URL(rows[0].payload[key]).searchParams.get('token')!;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [IdentityModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureServiceApp(app, 'Identity');
    await app.init();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    const all = [email, ...extraEmails];
    await ds.query(`DELETE FROM outbox WHERE payload->>'email' = ANY($1)`, [
      all,
    ]);
    await ds.query(`DELETE FROM users WHERE email = ANY($1)`, [all]);
    await app.close();
  });

  let userId = '';
  let access = '';
  let cookie = '';

  it('đăng ký: trả access token + cookie refresh httpOnly', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: email.toUpperCase(),
        password,
        fullName: 'Nguyễn Văn Test',
      })
      .expect(201);
    const body = res.body as AuthBody;
    expect(body.user.email).toBe(email); // đã lowercase
    expect(body.user.roles).toEqual(['collector']);
    expect(body.user.emailVerified).toBe(false);
    expect(res.get('Set-Cookie')?.[0]).toMatch(/HttpOnly/);
    userId = body.user.id;
    access = body.accessToken;
    cookie = cookieOf(res);
  });

  it('không lưu token/mật khẩu dạng rõ', async () => {
    const [u]: { password_hash: string }[] = await ds.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId],
    );
    expect(u.password_hash).toMatch(/^\$argon2id\$/);
    const rt: { token_hash: string }[] = await ds.query(
      `SELECT token_hash FROM refresh_tokens WHERE user_id = $1`,
      [userId],
    );
    expect(rt[0].token_hash).toHaveLength(64);
    expect(cookie).not.toContain(rt[0].token_hash);
  });

  it('ghi event vào outbox cùng transaction', async () => {
    const rows: { event_type: string }[] = await ds.query(
      `SELECT event_type FROM outbox WHERE aggregate_id = $1 ORDER BY created_at`,
      [userId],
    );
    expect(rows.map((r) => r.event_type)).toEqual(
      expect.arrayContaining([
        'identity.user.registered',
        'identity.email_verification.requested',
      ]),
    );
  });

  it('chặn đăng ký trùng email và mật khẩu yếu', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, fullName: 'Trùng' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: `x${email}`, password: 'abc', fullName: 'Yếu' })
      .expect(400);
  });

  it('đăng nhập sai => 401, đúng => 200', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'SaiMatKhau1' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
  });

  it('GET /users/me cần token', async () => {
    await request(app.getHttpServer()).get('/api/users/me').expect(401);
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${access}`)
      .expect(200);
    expect((res.body as AuthBody['user']).hasPassword).toBe(true);
  });

  it('refresh xoay vòng token; dùng lại token cũ => thu hồi cả family', async () => {
    const r1 = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    const newCookie = cookieOf(r1);
    expect(newCookie).not.toBe(cookie);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
    // token mới cũng bị thu hồi vì cùng family
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', newCookie)
      .expect(401);
  });

  it('xác minh email bằng token một lần', async () => {
    const token = await outboxUrl(
      userId,
      'identity.email_verification.requested',
      'verifyUrl',
    );
    await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token })
      .expect(400);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    expect((login.body as AuthBody).user.emailVerified).toBe(true);
    access = (login.body as AuthBody).accessToken;
    cookie = cookieOf(login);
  });

  it('quên mật khẩu -> đặt lại -> mọi phiên cũ bị thu hồi', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'khongtontai@artium.test' })
      .expect(202);
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email })
      .expect(202);
    const token = await outboxUrl(
      userId,
      'identity.password_reset.requested',
      'resetUrl',
    );
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'MatKhauMoi456' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'MatKhauMoi456' })
      .expect(200);
    access = (login.body as AuthBody).accessToken;
    cookie = cookieOf(login);
  });

  it('trở thành người bán: slug tự sinh, cần refresh để có role seller', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/sellers/me')
      .set('Authorization', `Bearer ${access}`)
      .send({
        displayName: `Phòng Tranh Đà Lạt ${randomUUID().slice(0, 4)}`,
        taxCode: '0123456789',
      })
      .expect(201);
    const slug = (created.body as { slug: string }).slug;
    expect(slug).toMatch(/^phong-tranh-da-lat-/);

    // token cũ chưa có role seller
    await request(app.getHttpServer())
      .get('/api/sellers/me')
      .set('Authorization', `Bearer ${access}`)
      .expect(403);

    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    const body = refreshed.body as AuthBody;
    expect(body.user.roles).toEqual(['collector', 'seller']);
    expect(body.user.sellerSlug).toBe(slug);

    await request(app.getHttpServer())
      .put('/api/sellers/me/websites')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .send({
        websites: [
          { title: 'Portfolio', url: 'https://example.com', isVisible: false },
        ],
      })
      .expect(200);

    const pub = await request(app.getHttpServer())
      .get(`/api/sellers/${slug}`)
      .expect(200);
    const p = pub.body as { taxCode?: string; websites: unknown[] };
    expect(p.taxCode).toBeUndefined(); // không lộ thông tin kinh doanh
    expect(p.websites).toHaveLength(0); // website ẩn không hiển thị công khai
  });

  describe('onboarding lần đầu', () => {
    const register = async (tag: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: `${tag}-${email}`, password, fullName: 'Người Mới' })
        .expect(201);
      extraEmails.push(`${tag}-${email}`);
      return res.body as AuthBody & { user: { onboardingCompleted: boolean } };
    };

    it('nhà sưu tầm: lưu thông tin cơ bản, chỉ làm được một lần', async () => {
      const reg = await register('col');
      expect(reg.user.onboardingCompleted).toBe(false);
      const auth = `Bearer ${reg.accessToken}`;

      const res = await request(app.getHttpServer())
        .post('/api/users/me/onboarding')
        .set('Authorization', auth)
        .send({
          role: 'collector',
          fullName: '  Trần Sưu Tầm ',
          city: 'Hà Nội',
          interests: ['son-dau', 'nhiep-anh', 'son-dau'],
        })
        .expect(200);
      const body = res.body as {
        user: {
          onboardingCompleted: boolean;
          fullName: string;
          interests: string[];
          roles: string[];
        };
      };
      expect(body.user).toMatchObject({
        onboardingCompleted: true,
        fullName: 'Trần Sưu Tầm',
        interests: ['son-dau', 'nhiep-anh'],
        roles: ['collector'],
      });

      await request(app.getHttpServer())
        .post('/api/users/me/onboarding')
        .set('Authorization', auth)
        .send({ role: 'collector', fullName: 'Lần hai' })
        .expect(409);
    });

    it('nghệ sĩ: bắt buộc có hồ sơ người bán', async () => {
      const reg = await register('art0');
      await request(app.getHttpServer())
        .post('/api/users/me/onboarding')
        .set('Authorization', `Bearer ${reg.accessToken}`)
        .send({ role: 'artist', fullName: 'Thiếu Hồ Sơ' })
        .expect(400);
    });

    it('nghệ sĩ: tạo hồ sơ + website, token mới có ngay role seller', async () => {
      const reg = await register('art');
      const name = `Xưởng Gốm Bát Tràng ${randomUUID().slice(0, 4)}`;

      const check = await request(app.getHttpServer())
        .get('/api/sellers/slug-availability')
        .query({ name })
        .expect(200);
      const suggested = check.body as { slug: string; available: boolean };
      expect(suggested.available).toBe(true);
      expect(suggested.slug).toMatch(/^xuong-gom-bat-trang-/);

      const res = await request(app.getHttpServer())
        .post('/api/users/me/onboarding')
        .set('Authorization', `Bearer ${reg.accessToken}`)
        .send({
          role: 'artist',
          fullName: 'Nghệ Nhân',
          seller: {
            displayName: name,
            slug: suggested.slug,
            profileType: 'institution',
          },
          websites: [
            {
              title: 'Instagram',
              url: 'https://instagram.com/xuonggom',
              type: 'instagram',
            },
          ],
        })
        .expect(200);
      const body = res.body as {
        accessToken: string;
        user: { roles: string[]; sellerSlug: string };
      };
      expect(body.user.roles).toEqual(['collector', 'seller']);
      expect(body.user.sellerSlug).toBe(suggested.slug);

      const me = await request(app.getHttpServer())
        .get('/api/sellers/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
      expect((me.body as { websites: unknown[] }).websites).toHaveLength(1);

      const taken = await request(app.getHttpServer())
        .get('/api/sellers/slug-availability')
        .query({ slug: suggested.slug })
        .expect(200);
      expect(taken.body).toMatchObject({ available: false });
    });
  });

  it('đăng nhập Google khi chưa cấu hình => 503', async () => {
    const fakeJwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln';
    await request(app.getHttpServer())
      .post('/api/auth/google')
      .send({ idToken: fakeJwt })
      .expect(503);
  });

  it('health', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'identity',
      database: 'up',
    });
  });
});
