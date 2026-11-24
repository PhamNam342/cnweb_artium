# Artium Backend — NestJS microservices monorepo

## Kiến trúc

```
FE (Vite :5173) ──► gateway :3000 ──┬─► identity :3001 ─► identity_db
                    /api/*           ├─► catalog  :3002 ─► catalog_db
                                     ├─► commerce :3003 ─► commerce_db   (PayOS)
                                     ├─► social   :3004 ─► social_db
                                     └─► crm      :3005 ─► crm_db
              mọi service ──(outbox → RabbitMQ exchange artium.events → inbox)──► service khác
```

- **gateway**: chỉ định tuyến theo prefix (`apps/gateway/src/routes.ts`), không có DB, không parse body.
- Mỗi service **một database riêng**; không join/đọc chéo DB. Tham chiếu sang service khác chỉ là UUID (REF).
- **Xác thực**: identity ký access token JWT (HS256, 15 phút); mọi service tự verify bằng `JWT_ACCESS_SECRET` dùng chung
  (`@app/common` → `CommonAuthModule`). Route mặc định cần đăng nhập; dùng `@Public()` để mở, `@Roles(UserRole.Seller)` để giới hạn.
- **Refresh token**: chuỗi ngẫu nhiên, lưu SHA-256, xoay vòng mỗi lần refresh, cookie httpOnly `artium_rt` (path `/api/auth`).
  Dùng lại token cũ ⇒ thu hồi cả phiên (phát hiện token bị đánh cắp).
- **Event**: ghi vào bảng `outbox` trong cùng transaction với dữ liệu; `OutboxRelayService` publish lên RabbitMQ;
  consumer dùng `InboxService.processOnce()` để xử lý đúng một lần.

Schema chi tiết: [`docs/database/schema-entities.md`](../docs/database/schema-entities.md) và
[`docs/database/artium_database_erd.drawio`](../docs/database/artium_database_erd.drawio).

## Cấu trúc thư mục

```
be/
├── apps/
│   ├── gateway/     # API gateway (proxy)
│   ├── identity/    # ✅ hoàn chỉnh: auth, users, sellers
│   ├── catalog/     # khung: config, DB, outbox, auth, health
│   ├── commerce/    # khung
│   ├── social/      # khung
│   └── crm/         # khung
├── libs/
│   ├── common/      # bootstrap, auth guard/decorator, env, health, utils
│   ├── database/    # DatabaseModule, outbox/inbox, helper migration
│   ├── messaging/   # RabbitMqService (publish/subscribe, tự reconnect)
│   └── contracts/   # tên event + kiểu payload dùng chung
└── scripts/         # dev-all, build-all, migrate, start-prod
```

## Chạy dev

```bash
# 1. Hạ tầng (ở thư mục gốc repo): Postgres (cổng 55432, tự tạo 5 DB), Redis, RabbitMQ
cp .env.example .env
docker compose up -d

# 2. Backend
cd be
cp .env.example .env            # đổi JWT_ACCESS_SECRET, điền GOOGLE_CLIENT_ID nếu dùng Google
npm install
npm run migrate -- all run      # migration cho cả 5 database
npm run dev                     # chạy cả 6 app (watch)
npm run dev -- identity gateway # hoặc chỉ một số app
```

- API qua gateway: `http://localhost:3000/api/...`
- Swagger từng service: `http://localhost:3001/docs` (identity), `:3002/docs`, ...
- RabbitMQ UI: `http://localhost:15672` (artium / artium_dev)
- Mailpit (hộp thư ảo khi dev): `http://localhost:8025`
- Postgres trong Docker dùng cổng **55432** trên máy (tránh đụng Postgres cài sẵn ở 5432).
  Kết nối bằng TablePlus/DBeaver: `localhost:55432`, user `artium`, mật khẩu `artium_dev`.

## Lệnh thường dùng

| Lệnh | Tác dụng |
| --- | --- |
| `npm run migrate -- <service\|all> run` | Chạy migration |
| `npm run migrate -- <service> revert` | Hoàn tác migration gần nhất |
| `npm run migrate -- <service> generate TenMigration` | Sinh migration từ thay đổi entity |
| `npm run build` | Build cả 6 app vào `dist/apps/*` |
| `npm test` | Unit test |
| `npm run test:e2e` | E2E (cần Postgres đã migrate) |
| `npm run lint` / `npm run typecheck` | Kiểm tra code |

## API Identity

| Method | Path | Mô tả |
| --- | --- | --- |
| POST | `/api/auth/register` | Đăng ký email/mật khẩu (gửi event email xác minh) |
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/google` | Đăng nhập Google — body `{ idToken }` từ Google Identity Services |
| POST | `/api/auth/refresh` | Xoay vòng refresh token (cookie), trả access token mới |
| POST | `/api/auth/logout` · `/logout-all` | Đăng xuất phiên hiện tại / mọi thiết bị |
| POST | `/api/auth/verify-email` · `/resend-verification` | Xác minh email |
| POST | `/api/auth/forgot-password` · `/reset-password` | Quên mật khẩu |
| POST | `/api/auth/change-password` | Đổi (hoặc đặt lần đầu) mật khẩu |
| GET/PATCH | `/api/users/me` | Xem / sửa tài khoản |
| GET | `/api/users/:id` | Hồ sơ công khai tối thiểu |
| POST | `/api/users/me/onboarding` | Hoàn tất popup chọn vai trò lần đầu (nhà sưu tầm / nghệ sĩ), trả access token mới |
| GET | `/api/sellers/slug-availability?slug=` hoặc `?name=` | Kiểm tra / gợi ý slug trang nghệ sĩ |
| POST | `/api/sellers/me` | Trở thành người bán (sau đó gọi `/auth/refresh` để có role seller) |
| GET/PATCH | `/api/sellers/me` | Hồ sơ người bán |
| PUT | `/api/sellers/me/websites` | Thay danh sách website/portfolio |
| POST | `/api/sellers/me/verification-request` | Gửi yêu cầu xác minh |
| PATCH | `/api/sellers/:id/verification` | (admin) duyệt/từ chối |
| GET | `/api/sellers/:slug` | Trang công khai người bán |

### Gửi email (SMTP)

Identity gửi email xác minh và đặt lại mật khẩu qua SMTP: event được ghi vào outbox → RabbitMQ →
consumer `identity.mailer` (thư mục `apps/identity/src/mail/`) gửi mail. Mỗi message chỉ gửi một lần (bảng `inbox`),
SMTP lỗi thì thử lại 3 lần (1s, 5s, 15s) rồi đẩy vào hàng đợi lỗi `identity.mailer.dlq` (xem ở RabbitMQ UI).
Link đã hết hạn thì không gửi.

| Môi trường | Cấu hình trong `be/.env` |
| --- | --- |
| Dev (Mailpit trong docker-compose) | `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_SECURE=false` — xem mail tại http://localhost:8025 |
| Gmail | `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=<gmail>`, `SMTP_PASS=<App Password 16 ký tự>`, `MAIL_FROM="Artium <gmail>"` |
| Không cấu hình | `SMTP_HOST=` trống → nội dung mail (kèm link) chỉ in ra log của identity |

Gmail yêu cầu bật xác minh 2 bước và tạo **App Password** (Tài khoản Google → Bảo mật → Mật khẩu ứng dụng);
không dùng mật khẩu Gmail thường. Cần RabbitMQ đang chạy thì mail mới được gửi (event vẫn nằm an toàn trong outbox nếu broker tắt).

FE nên gọi API với `credentials: 'include'` để cookie refresh token được gửi kèm, và **không gọi `/auth/refresh` song song**
(refresh token xoay vòng). Backend có ân hạn `REFRESH_REUSE_GRACE_SECONDS` (mặc định 10 giây) cho trường hợp nhiều tab.

## Thêm tính năng cho service khác (ví dụ catalog)

1. Viết entity theo đúng bảng trong `docs/database/schema-entities.md`.
2. `npm run migrate -- catalog generate AddArtworks` → kiểm tra file sinh ra → `npm run migrate -- catalog run`.
3. Phát event: `outbox.enqueue(manager, {...})` trong cùng transaction.
4. Nhận event: `rabbit.subscribe({ queue: 'catalog.commerce-events', routingKeys: ['commerce.order.*'], handler })`
   và bọc xử lý trong `inbox.processOnce(envelope.id, 'catalog.reserve', ...)`.
5. Sửa schema thì sửa `docs/database/tools/schema_spec.py` rồi chạy `npm run docs:db` ở thư mục gốc.
