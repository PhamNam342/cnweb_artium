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
│   ├── catalog/     # ✅ tác phẩm, ảnh Cloudinary, thư mục, tag
│   ├── commerce/    # khung
│   ├── social/      # khung
│   └── crm/         # khung
├── libs/
│   ├── common/      # bootstrap, auth guard/decorator, env, health, utils
│   ├── database/    # DatabaseModule, outbox/inbox, helper migration
│   ├── messaging/   # RabbitMqService (publish/subscribe, tự reconnect)
│   ├── storage/     # CloudinaryService (ký upload, xác minh, URL ảnh, xóa)
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
| `npm run db:inspect -- [service\|all] [bảng] [--summary\|--md\|--all-tables]` | Xem database thật đang có bảng nào, cột nào (kiểu, null, mặc định, PK/FK, index, enum). `--md` ghi ra `docs/database/db-actual.md` |
| `npm run seed` | Đổ dữ liệu mẫu (tài khoản, nghệ sĩ, tác phẩm) — xem mục bên dưới |
| `npm run sync:social` | Đồng bộ `user_summaries` / `artwork_summaries` của social từ identity + catalog (seed đã tự chạy) |
| `npm run build` | Build cả 6 app vào `dist/apps/*` |
| `npm test` | Unit test |
| `npm run test:e2e` | E2E (cần Postgres đã migrate) |
| `npm run lint` / `npm run typecheck` | Kiểm tra code |

## Dữ liệu mẫu

`npm run seed` (sau khi đã `npm run migrate -- all run`). Chạy lại bao nhiêu lần cũng được: dữ liệu mẫu cũ bị xóa rồi tạo lại.
⚠ Mỗi lần chạy, **toàn bộ** tác phẩm, thư mục và tag riêng của 3 tài khoản nghệ sĩ mẫu bị xóa — kể cả thứ bạn
tự tạo khi đăng nhập bằng các tài khoản đó. Tài khoản bạn tự đăng ký thì không bị ảnh hưởng.
Mật khẩu mọi tài khoản: **`Artium123`**.

| Email | Vai trò | Ghi chú |
| --- | --- | --- |
| `admin@artium.vn` | admin | |
| `buyer@artium.vn` | collector | đã onboarding |
| `newbie@artium.vn` | collector | chưa onboarding → hiện popup chọn vai trò |
| `lan.nguyen@artium.vn` | seller | `/nguyen-thi-lan` — đã xác minh, nổi bật |
| `minh.tran@artium.vn` | seller | `/tran-duc-minh` — chưa xác minh hồ sơ |
| `gallery@artium.vn` | seller (gallery) | `/hanoi-art-space` |

Có 12 tác phẩm với đủ trạng thái (đang bán, hỏi giá, chỉ trưng bày, hết hàng, nháp, lưu trữ), thư mục và tag.
Ảnh mẫu được tải lên Cloudinary khi `be/.env` có `CLOUDINARY_*`. Chưa có khóa thì tác phẩm chỉ ở dạng nháp, không ảnh;
điền khóa rồi chạy lại `npm run seed`.

Cuối cùng seed đồng bộ người dùng và tác phẩm sang social (`user_summaries`, `artwork_summaries`), vì dữ liệu seed được
ghi thẳng vào database nên không có event nào gửi cho social. Muốn đồng bộ lại mà không seed: `npm run sync:social`.

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
| POST | `/api/auth/password/change-code` | Gửi mã 6 số qua email để đổi mật khẩu (1 mã/phút, hết hạn sau `PASSWORD_CHANGE_CODE_TTL_MINUTES`, mặc định 10) → `{sentTo, expiresAt}` |
| POST | `/api/auth/password/change-with-code` | `{code, newPassword}` — sai 5 lần thì mã bị hủy. Thành công: đăng xuất thiết bị khác, trả phiên mới (cookie + access token) |
| GET/PATCH | `/api/users/me` | Xem / sửa tài khoản |
| POST | `/api/users/me/avatar/upload-ticket` | Chữ ký Cloudinary để trình duyệt upload ảnh đại diện (thư mục `artium/avatars/<userId>`) |
| PUT / DELETE | `/api/users/me/avatar` | Gắn ảnh vừa upload `{publicId, version, signature}` (URL cắt vuông 256px theo khuôn mặt) / gỡ ảnh. Ảnh cũ bị xóa trên Cloudinary; hồ sơ nghệ sĩ dùng chung ảnh được cập nhật theo |
| GET | `/api/users/:id` | Hồ sơ công khai tối thiểu |
| POST | `/api/users/me/onboarding` | Hoàn tất popup chọn vai trò lần đầu (nhà sưu tầm / nghệ sĩ), trả access token mới |
| GET | `/api/sellers/slug-availability?slug=` hoặc `?name=` | Kiểm tra / gợi ý slug trang nghệ sĩ |
| POST | `/api/sellers/me` | Trở thành người bán: vai trò đổi từ collector sang seller (sau đó gọi `/auth/refresh` để token có role mới) |
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

## API Catalog (đăng tác phẩm)

Quy trình đăng ảnh: trình duyệt upload **thẳng lên Cloudinary**, backend chỉ ký tham số và xác minh kết quả.

1. `POST /api/uploads/artwork-images` `{count}` → `{uploadUrl, apiKey, items:[{publicId, timestamp, signature}], allowedFormats, maxBytes}`.
2. FE gửi `multipart/form-data` tới `uploadUrl` cho từng file: `file`, `api_key`, `timestamp`, `signature`, `public_id`, `allowed_formats`.
3. Cloudinary trả `{public_id, version, signature, format, width, height, bytes}` → FE gửi nguyên các trường này
   (đổi sang camelCase) trong `images` khi tạo tác phẩm hoặc `PUT /api/artworks/:id/images`.
   Backend kiểm tra chữ ký và `publicId` phải nằm trong thư mục `artium/artworks/<sellerId>/` của chính seller.

Mỗi tài khoản có **đúng một vai trò** (`users.role`: `collector` | `seller` | `admin`); access token mang claim `role`.

Hình thức niêm yết (`listingType`): `for_sale` (bán, cần giá + số lượng), `inquire` (hỏi giá — giá chỉ là ghi chú riêng,
người ngoài không thấy), `sold` (đã bán ngoài nền tảng, kèm `saleRecord {collectorName, showOnProfile, soldPrice, soldAt}`;
người ngoài chỉ thấy giá + ngày khi `showOnProfile`), `display_only` (chỉ trưng bày).
Tác phẩm mới mặc định `creatorName` = tên nghệ sĩ.

Kích thước luôn lưu theo **cm / kg**; `dimensionUnit` (`cm`|`in`) và `weightUnit` (`kg`|`lb`) chỉ là đơn vị seller chọn để hiển thị.
Giá tính bằng VND (số nguyên).

| Method | Đường dẫn | Ghi chú |
| --- | --- | --- |
| GET | `/api/artworks` | Công khai: `sellerId`, `sellerSlug`, `tag` (slug), `q`, `listingType`, `sort`, `page`, `pageSize` |
| GET | `/api/artworks/:id` | Công khai (chủ tác phẩm xem trước được cả bản nháp) |
| GET | `/api/artworks/mine` | (seller) Kho: `status` (mặc định ẩn archived, `all`), `folderId` (uuid / `none`), `tagId`, `q`, `sort` + `counts` theo trạng thái |
| GET | `/api/artworks/mine/:id` | (seller) |
| POST | `/api/artworks` | (seller) Tạo bản nháp, có thể kèm `images`, `tagIds`, `folderId` |
| PATCH | `/api/artworks/:id` | (seller) Sửa; tác phẩm đang hiển thị vẫn phải đủ điều kiện đăng |
| PUT | `/api/artworks/:id/images` | (seller) Thay danh sách ảnh — thứ tự = vị trí, ảnh đầu là ảnh bìa; ảnh bị bỏ bị xóa khỏi Cloudinary |
| POST | `/api/artworks/:id/publish` | (seller, email đã xác minh) Cần tên, ≥1 ảnh; bán thì cần giá > 0, số lượng ≥ 1. Lỗi → 422 `{errors: [...]}` |
| POST | `/api/artworks/:id/unpublish` · `/archive` · `/restore` | (seller) |
| DELETE | `/api/artworks/:id` | (seller) Xóa mềm; chặn khi đang có đơn chờ thanh toán |
| POST | `/api/artworks/bulk` | (seller) `{ids, action: move|archive|unpublish, folderId?}` |
| GET/POST | `/api/folders` | (seller) Danh sách phẳng kèm `artworkCount`; lồng tối đa 3 cấp |
| PATCH/DELETE | `/api/folders/:id` | (seller) Xóa thư mục: tác phẩm ra "chưa xếp", thư mục con lên một cấp |
| GET | `/api/tags` | `category`, `scope=all|system|mine` — 33 tag hệ thống (chất liệu, phong cách, chủ đề) |
| POST | `/api/tags` | (seller) Tạo tag riêng; trùng slug với tag có sẵn thì trả lại tag đó |

Event phát qua outbox: `catalog.artwork.published`, `catalog.artwork.updated`, `catalog.artwork.archived` (`reason`: unpublished/archived/deleted).
Catalog nhận `identity.seller_profile.upserted` (queue `catalog.identity-sellers`) để dựng bảng `seller_summaries`.

Cấu hình trong `be/.env` (Cloudinary Console → Dashboard → API Keys):
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER=artium`.
Chưa cấu hình thì các API khác vẫn chạy, riêng xin chữ ký upload trả 503.

## Social: nền tảng (projection + TargetRegistry)

Social không gọi API sang identity / catalog. Nó giữ bản sao cần thiết, cập nhật qua RabbitMQ:

| Bảng | Nguồn (event) | Dùng để |
| --- | --- | --- |
| `user_summaries` | `identity.user.registered`, `identity.user.updated`, `identity.seller_profile.upserted` | Tên, avatar, slug nghệ sĩ trong bình luận, danh sách theo dõi, moment |
| `artwork_summaries` | `catalog.artwork.published / updated / archived` | Tác phẩm có tồn tại, của ai, đang công khai không. Gỡ / xóa: giữ dòng, `is_public = false` |

Consumer nằm ở `apps/social/src/summaries/` (idempotent nhờ inbox, event đến trễ không ghi đè).

`TargetRegistry` (`apps/social/src/targets/`) trả lời "đối tượng `artwork` / `comment` / `moment` có id X có tồn tại không, ai là chủ".
Like và bình luận chỉ làm việc qua registry. Thêm một loại đối tượng mới:

```ts
@Injectable()
export class MomentTargetResolver implements TargetResolver, OnModuleInit {
  readonly type = SocialTargetType.Moment;
  constructor(private readonly registry: TargetRegistry) {}
  onModuleInit() { this.registry.register(this); }
  async resolve(m: EntityManager, id: string, viewerId?: string) { /* { ownerId, visible } | null */ }
  async setCount(m: EntityManager, id: string, field: 'reactions' | 'comments', count: number) { /* tùy chọn */ }
}
// module của bạn: imports: [TargetsModule], providers: [MomentTargetResolver]
```

- `registry.require(m, type, id, viewerId?)`: không tồn tại hoặc không hiển thị => 404; loại chưa đăng ký => 400.
- `registry.find(...)`: như trên nhưng không kiểm tra hiển thị (bỏ like / xóa bình luận trên tác phẩm đã gỡ).
- Event `social.reaction.changed` / `social.comment.changed` (`SocialEvents` trong `@app/contracts`) mang **số đếm mới nhất**.

## Thêm tính năng cho service khác (ví dụ commerce)

1. Viết entity theo đúng bảng trong `docs/database/schema-entities.md`.
2. `npm run migrate -- catalog generate AddArtworks` → kiểm tra file sinh ra → `npm run migrate -- catalog run`.
3. Phát event: `outbox.enqueue(manager, {...})` trong cùng transaction.
4. Nhận event: `rabbit.subscribe({ queue: 'catalog.commerce-events', routingKeys: ['commerce.order.*'], handler })`
   và bọc xử lý trong `inbox.processOnce(envelope.id, 'catalog.reserve', ...)`.
5. Sửa schema thì sửa `docs/database/tools/schema_spec.py` rồi chạy `npm run docs:db` ở thư mục gốc.
