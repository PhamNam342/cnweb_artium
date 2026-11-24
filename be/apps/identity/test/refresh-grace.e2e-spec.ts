/** Ân hạn khi refresh song song (nhiều tab / React StrictMode). */
process.env.OUTBOX_RELAY_ENABLED = 'false';
process.env.MAILER_ENABLED = 'false';
process.env.REFRESH_REUSE_GRACE_SECONDS = '10';

import { configureServiceApp } from '@app/common';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { IdentityModule } from '../src/identity.module';

const cookieOf = (res: request.Response) =>
  (res.get('Set-Cookie') ?? [])
    .find((c) => c.startsWith('artium_rt='))!
    .split(';')[0];

describe('Refresh token — ân hạn khi refresh song song (e2e)', () => {
  let app: INestApplication<App>;
  const email = `grace-${randomUUID().slice(0, 8)}@artium.test`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [IdentityModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureServiceApp(app, 'Identity');
    await app.init();
  });

  afterAll(async () => {
    const ds = app.get(DataSource);
    await ds.query(`DELETE FROM outbox WHERE payload->>'email' = $1`, [email]);
    await ds.query(`DELETE FROM users WHERE email = $1`, [email]);
    await app.close();
  });

  it('hai request refresh cùng lúc với một cookie đều thành công, phiên không bị thu hồi', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Matkhau123', fullName: 'Nhiều Tab' })
      .expect(201);
    const cookie = cookieOf(reg);

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookie),
      request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', cookie),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);

    // Cả hai token mới vẫn dùng tiếp được
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieOf(a))
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieOf(b))
      .expect(200);
  });
});
