# Artium — Database Schema

> **File này được SINH TỰ ĐỘNG** từ `docs/database/tools/schema_spec.py` cùng với `artium_database_erd.drawio`. Đừng sửa tay — sửa spec rồi chạy `python3 docs/database/tools/generate.py`.

Tổng cộng **5 service có database**, **57 bảng nghiệp vụ** (+ `outbox`, `inbox` trong mỗi database).

## 1. Quy ước

- **Database-per-service:** mỗi service một database PostgreSQL riêng (chung 1 Postgres instance khi dev). Không service nào đọc/ghi database của service khác.
- **FK** = khóa ngoại vật lý trong cùng database. **REF** = tham chiếu logic sang service khác: chỉ lưu UUID, không có ràng buộc; tính hợp lệ được kiểm tra qua API/event.
- **Khóa chính:** luôn tên `id`, kiểu `uuid` (`gen_random_uuid()`), trừ bảng nối dùng PK kép và bảng projection dùng id nguồn.
- **Tên:** `snake_case`, bảng số nhiều, FK đặt `<entity>_id`.
- **Thời gian:** `timestamptz`; bảng thay đổi được có `created_at` + `updated_at`; soft delete dùng `deleted_at`.
- **Tiền:** chỉ VND (PayOS), lưu `bigint` theo đơn vị đồng — không dùng `decimal`, không cần cột `currency`.
- **Token/bí mật:** chỉ lưu hash (SHA-256 cho token, argon2id cho mật khẩu).
- **Counter** (`like_count`, `registered_count`...) là dữ liệu phi chuẩn hóa; cột nằm ở service nào thì chỉ service đó ghi, giá trị đến từ event của service làm chủ.
- **Projection** (`seller_summaries`, `user_summaries`) là bản sao chỉ-đọc, cập nhật qua event; nguồn sự thật vẫn ở service gốc.

## 2. Thay đổi so với bản thiết kế cũ

| Thay đổi | Lý do |
| --- | --- |
| Bỏ toàn bộ blockchain (wallet, auction, escrow, `blockchain_*`, `*_wei`, `tx_hash`) | Không thuộc phạm vi |
| Bỏ Stripe, PayPal (`stripe_*`, `paypal_*`, `payment_methods`, `stripe_customers`); thêm `payments` PayOS + `payment_webhook_events` | Thanh toán chỉ dùng PayOS |
| Giữ Google login nhưng tách sang `oauth_accounts` (thay `users.google_id`) | Một user có thể có cả mật khẩu và Google |
| Gộp 9 service còn 5 + gateway: orders+payments → **commerce**; community+messaging+events+notifications → **social** | Giảm giao tiếp chéo; order và payment cùng transaction |
| `orders` tách thêm `seller_orders` (vận chuyển theo từng seller) | Một đơn có thể gồm nhiều seller giao riêng |
| Thêm `artwork_reservations` | Chống bán trùng tác phẩm độc bản |
| Thêm `payout_items`; bỏ `order_items.payout_status` | Đối soát chi trả, payments làm chủ dữ liệu payout |
| `promotions` chuyển từ CRM sang commerce | Checkout cần kiểm tra mã đồng bộ |
| Gộp `artwork_likes`/`likes` → `reactions`; `artwork_comments`/`comments` → `comments` | Một hệ thống tương tác duy nhất |
| Gộp `event_rsvps` + `event_attendees` → `event_registrations`; cho phép khách không tài khoản | Bỏ trùng trạng thái check-in |
| Bỏ `read_receipts`, `typing_indicators`; thêm `last_read_message_id` vào participants, typing để ở Redis | Bảng read receipt tăng N×M |
| Bỏ `activity_feeds`, `notification_history`; thay bằng `notifications` + `email_deliveries` | Bỏ trùng chức năng |
| Thêm `user_tokens` (xác minh email, reset mật khẩu); `refresh_tokens` lưu hash + rotation | Bảo mật |
| Thêm bảng còn thiếu: `moodboard_collaborators`, `segment_members`, `campaign_segments`, `private_view_artworks`, `private_view_invitees`, `notification_preferences` | ERD cũ có cờ nhưng không có bảng |
| Bỏ chỉ số bán hàng khỏi `seller_profiles`; bỏ `users.stripe_customer_id` | Một dữ liệu chỉ một service làm chủ |

## 3. Bản đồ service

| Service | Port | Database | Bảng |
| --- | --- | --- | --- |
| gateway | 3000 | — | — (định tuyến HTTP, không có DB) |
| identity | 3001 | `identity_db` | `users`, `oauth_accounts`, `refresh_tokens`, `user_tokens`, `seller_profiles`, `seller_websites` |
| catalog | 3002 | `catalog_db` | `artworks`, `artwork_images`, `artwork_folders`, `tags`, `artwork_tags`, `artwork_reservations`, `seller_summaries` |
| commerce | 3003 | `commerce_db` | `carts`, `cart_items`, `promotions`, `promotion_redemptions`, `orders`, `seller_orders`, `order_items`, `payments`, `payment_webhook_events`, `refunds`, `seller_payout_accounts`, `payouts`, `payout_items`, `invoices`, `invoice_items` |
| social | 3004 | `social_db` | `follows`, `reactions`, `comments`, `moments`, `moment_artworks`, `moodboards`, `moodboard_artworks`, `moodboard_collaborators`, `reviews`, `events`, `event_registrations`, `event_artworks`, `conversations`, `conversation_participants`, `messages`, `notifications`, `email_deliveries`, `notification_preferences`, `user_summaries`, `artwork_summaries` |
| crm | 3005 | `crm_db` | `contacts`, `segments`, `segment_members`, `email_campaigns`, `campaign_segments`, `campaign_recipients`, `private_views`, `private_view_artworks`, `private_view_invitees` |

### Định tuyến qua gateway

| Prefix | Service |
| --- | --- |
| `/api/auth, /api/users, /api/sellers` | identity :3001 |
| `/api/artworks, /api/folders, /api/tags, /api/uploads` | catalog :3002 |
| `/api/cart, /api/orders, /api/payments, /api/promotions, /api/invoices, /api/payouts, /api/webhooks/payos` | commerce :3003 |
| `/api/follows, /api/reactions, /api/comments, /api/moments, /api/moodboards, /api/reviews, /api/events, /api/conversations, /api/notifications` | social :3004 |
| `/api/crm` | crm :3005 |

## 4. Identity Service — `identity_db`

Tài khoản, xác thực (email/mật khẩu + Google), phiên đăng nhập, hồ sơ người bán.

### `users`

Tài khoản trung tâm. Email lưu dạng lowercase.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `email` | `varchar(320)` | UNIQUE, NOT NULL |  |
| `password_hash` | `varchar(255)` | NULL | argon2id; NULL nếu chỉ đăng nhập Google |
| `full_name` | `varchar(255)` | NOT NULL |  |
| `avatar_url` | `varchar(1024)` | NULL |  |
| `phone` | `varchar(20)` | NULL |  |
| `role` | `user_role` | NOT NULL, DEFAULT `'collector'` | mỗi tài khoản 1 vai trò: collector \| seller \| admin |
| `status` | `user_status` | NOT NULL, DEFAULT `'active'` | active \| suspended |
| `email_verified_at` | `timestamptz` | NULL | NULL = chưa xác minh |
| `city` | `varchar(100)` | NULL | tỉnh/thành, nhập khi onboarding |
| `interests` | `text[]` | NOT NULL, DEFAULT `'{}'` | slug thể loại quan tâm, VD: son-dau, nhiep-anh |
| `onboarding_completed_at` | `timestamptz` | NULL | NULL = chưa qua popup chọn vai trò |
| `last_login_at` | `timestamptz` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `deleted_at` | `timestamptz` | NULL | soft delete |

- **Index:** `(status, created_at)`

### `oauth_accounts`

Liên kết tài khoản với nhà cung cấp OAuth (hiện tại: Google). Tách bảng để một user có thể vừa có mật khẩu vừa có Google.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `user_id` | `uuid` | FK → `users.id` (CASCADE), NOT NULL |  |
| `provider` | `oauth_provider` | NOT NULL | google |
| `provider_user_id` | `varchar(255)` | NOT NULL | 'sub' trong Google ID token |
| `email` | `varchar(320)` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Unique:** `(provider, provider_user_id)`
- **Unique:** `(user_id, provider)`

### `refresh_tokens`

Refresh token có xoay vòng (rotation). Chỉ lưu SHA-256 của token. Dùng lại token đã xoay => thu hồi cả family (phát hiện đánh cắp token).

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `user_id` | `uuid` | FK → `users.id` (CASCADE), NOT NULL |  |
| `family_id` | `uuid` | NOT NULL | chung cho mọi token sinh ra từ 1 lần đăng nhập |
| `token_hash` | `char(64)` | UNIQUE, NOT NULL |  |
| `expires_at` | `timestamptz` | NOT NULL |  |
| `revoked_at` | `timestamptz` | NULL |  |
| `replaced_by_id` | `uuid` | NULL | token kế tiếp sau khi xoay |
| `user_agent` | `varchar(512)` | NULL |  |
| `ip_address` | `varchar(64)` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(user_id)`
- **Index:** `(family_id)`
- **Index:** `(expires_at)`

### `user_tokens`

Token một lần: xác minh email, đặt lại mật khẩu (link), mã 6 số đổi mật khẩu. Chỉ lưu hash.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `user_id` | `uuid` | FK → `users.id` (CASCADE), NOT NULL |  |
| `type` | `user_token_type` | NOT NULL | email_verification \| password_reset \| password_change (mã 6 số qua email) |
| `token_hash` | `char(64)` | UNIQUE, NOT NULL |  |
| `expires_at` | `timestamptz` | NOT NULL |  |
| `used_at` | `timestamptz` | NULL |  |
| `attempts` | `smallint` | NOT NULL, DEFAULT `0` | số lần nhập sai mã; quá 5 lần thì mã bị hủy |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(user_id, type)`

### `seller_profiles`

Hồ sơ người bán (nghệ sĩ/gallery), 1-1 với user có role seller. Thông tin nhận tiền nằm ở commerce.seller_payout_accounts; chỉ số bán hàng tính ở commerce, không lưu ở đây.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `user_id` | `uuid` | FK → `users.id` (CASCADE), UNIQUE, NOT NULL |  |
| `slug` | `varchar(120)` | UNIQUE, NOT NULL | URL công khai /sellers/:slug |
| `display_name` | `varchar(255)` | NOT NULL |  |
| `profile_type` | `seller_profile_type` | NOT NULL, DEFAULT `'individual'` | individual \| gallery \| institution |
| `bio` | `text` | NULL |  |
| `avatar_url` | `varchar(1024)` | NULL |  |
| `cover_image_url` | `varchar(1024)` | NULL |  |
| `location` | `varchar(255)` | NULL |  |
| `social_links` | `jsonb` | NOT NULL, DEFAULT `'{}'` | {instagram, facebook, tiktok, website} |
| `tax_code` | `varchar(32)` | NULL |  |
| `business_address` | `jsonb` | NULL |  |
| `verification_status` | `seller_verification_status` | NOT NULL, DEFAULT `'unverified'` | unverified \| pending \| verified \| rejected |
| `verified_at` | `timestamptz` | NULL |  |
| `is_featured` | `boolean` | NOT NULL, DEFAULT `false` |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(verification_status, is_featured)`

### `seller_websites`

Liên kết portfolio/website của người bán.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `seller_profile_id` | `uuid` | FK → `seller_profiles.id` (CASCADE), NOT NULL |  |
| `type` | `varchar(32)` | NOT NULL, DEFAULT `'portfolio'` |  |
| `title` | `varchar(255)` | NOT NULL |  |
| `url` | `varchar(1024)` | NOT NULL |  |
| `display_order` | `int` | NOT NULL, DEFAULT `0` |  |
| `is_visible` | `boolean` | NOT NULL, DEFAULT `true` |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(seller_profile_id, display_order)`

## 5. Catalog Service — `catalog_db`

Tác phẩm, thư mục, tag, giữ hàng (reservation) khi checkout.

### `artworks`

Tác phẩm/listing. Tiền là VND kiểu bigint (đồng). Kích thước lưu chuẩn theo cm/kg, kèm đơn vị người dùng chọn để hiển thị lại. like_count/comment_count là projection từ social.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `seller_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `folder_id` | `uuid` | FK → `artwork_folders.id` (SET NULL), NULL |  |
| `title` | `varchar(100)` | NOT NULL |  |
| `description` | `varchar(350)` | NULL |  |
| `creator_name` | `varchar(100)` | NULL | nghệ sĩ (có thể khác seller nếu là gallery) |
| `creation_year` | `smallint` | NULL |  |
| `edition` | `varchar(24)` | NULL | VD: 12/100, Limited Edition |
| `medium` | `varchar(80)` | NULL | chất liệu, VD: Sơn dầu trên canvas |
| `width_cm` | `numeric(8,2)` | NULL |  |
| `height_cm` | `numeric(8,2)` | NULL |  |
| `depth_cm` | `numeric(8,2)` | NULL |  |
| `dimension_unit` | `dimension_unit` | NOT NULL, DEFAULT `'cm'` | cm \| in — đơn vị hiển thị |
| `weight_kg` | `numeric(8,2)` | NULL |  |
| `weight_unit` | `weight_unit` | NOT NULL, DEFAULT `'kg'` | kg \| lb — đơn vị hiển thị |
| `is_framed` | `boolean` | NOT NULL, DEFAULT `false` | có khung trang trí |
| `listing_type` | `listing_type` | NOT NULL, DEFAULT `'for_sale'` | for_sale \| inquire \| display_only \| sold (bán ngoài nền tảng) |
| `price` | `bigint` | NULL | VND; bắt buộc khi đăng với for_sale |
| `quantity_total` | `int` | NOT NULL, DEFAULT `1` |  |
| `quantity_available` | `int` | NOT NULL, DEFAULT `1` | CHECK 0 <= available <= total |
| `allow_offers` | `boolean` | NOT NULL, DEFAULT `false` | chưa dùng — cần luồng offer ở commerce |
| `shipping` | `jsonb` | NULL | {method: box\|crate\|tube, widthCm, heightCm, depthCm, weightKg} |
| `sale_record` | `jsonb` | NULL | khi listing_type = sold: {collectorName, showOnProfile, soldPrice, soldAt} |
| `status` | `artwork_status` | NOT NULL, DEFAULT `'draft'` | draft \| published \| sold_out \| archived |
| `published_at` | `timestamptz` | NULL |  |
| `view_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `like_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `comment_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `deleted_at` | `timestamptz` | NULL |  |

- **Index:** `(seller_id, status, created_at)`
- **Index:** `(status, published_at)`
- **Index:** `(folder_id)`

### `artwork_images`

Ảnh tác phẩm lưu trên Cloudinary. position 0 là ảnh bìa. URL ảnh thu nhỏ sinh từ public_id (Cloudinary transform), không lưu.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `artwork_id` | `uuid` | FK → `artworks.id` (CASCADE), NOT NULL |  |
| `public_id` | `varchar(255)` | UNIQUE, NOT NULL | artium/artworks/<sellerId>/<id> |
| `version` | `int` | NOT NULL | version Cloudinary, dùng trong URL để tránh cache cũ |
| `format` | `varchar(10)` | NOT NULL |  |
| `width` | `int` | NOT NULL |  |
| `height` | `int` | NOT NULL |  |
| `bytes` | `int` | NOT NULL |  |
| `position` | `smallint` | NOT NULL, DEFAULT `0` |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(artwork_id, position)`

### `artwork_folders`

Cây thư mục để seller sắp xếp tác phẩm.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `seller_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `parent_id` | `uuid` | FK → `artwork_folders.id` (SET NULL), NULL |  |
| `name` | `varchar(255)` | NOT NULL |  |
| `position` | `int` | NOT NULL, DEFAULT `0` |  |
| `is_hidden` | `boolean` | NOT NULL, DEFAULT `false` |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(seller_id, parent_id, position)`

### `tags`

Tag hệ thống (seller_id NULL, seed sẵn) hoặc tag riêng của seller, chia theo nhóm.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `seller_id` | `uuid` | REF → `identity.users`, NULL | NULL = tag hệ thống |
| `category` | `tag_category` | NOT NULL, DEFAULT `'other'` | medium \| style \| subject \| other |
| `name` | `varchar(64)` | NOT NULL |  |
| `slug` | `varchar(80)` | NOT NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Unique:** `(seller_id, slug) NULLS NOT DISTINCT`
- **Index:** `(category)`

### `artwork_tags`

Bảng nối n-n artwork - tag.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `artwork_id` | `uuid` | PK, FK → `artworks.id` (CASCADE) |  |
| `tag_id` | `uuid` | PK, FK → `tags.id` (CASCADE) |  |

- **PK kép:** `(artwork_id, tag_id)`
- **Index:** `(tag_id)`

### `artwork_reservations`

Giữ hàng khi tạo đơn để chống bán trùng tác phẩm độc bản. Hết hạn thanh toán => released, số lượng được trả lại.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `artwork_id` | `uuid` | FK → `artworks.id` (RESTRICT), NOT NULL |  |
| `order_id` | `uuid` | REF → `commerce.orders`, NOT NULL |  |
| `quantity` | `int` | NOT NULL, DEFAULT `1` |  |
| `status` | `reservation_status` | NOT NULL, DEFAULT `'active'` | active \| confirmed \| released |
| `expires_at` | `timestamptz` | NOT NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Unique:** `(order_id, artwork_id)`
- **Index:** `(status, expires_at)`

### `seller_summaries`

PROJECTION từ identity (event seller_profile.upserted) để hiển thị tên/avatar seller trên listing mà không gọi chéo service.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `seller_id` | `uuid` | PK, REF → `identity.users` |  |
| `slug` | `varchar(120)` | NOT NULL |  |
| `display_name` | `varchar(255)` | NOT NULL |  |
| `avatar_url` | `varchar(1024)` | NULL |  |
| `is_verified` | `boolean` | NOT NULL, DEFAULT `false` |  |
| `updated_at` | `timestamptz` | NOT NULL |  |

## 6. Commerce Service — `commerce_db`

Giỏ hàng, đơn hàng (tách theo seller), khuyến mãi, thanh toán PayOS, hóa đơn, chi trả seller.

### `carts`

Mỗi user một giỏ. Tổng tiền tính khi đọc, không lưu.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `user_id` | `uuid` | REF → `identity.users`, UNIQUE, NOT NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

### `cart_items`

Dòng hàng trong giỏ. Giá được kiểm tra lại với catalog khi checkout.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `cart_id` | `uuid` | FK → `carts.id` (CASCADE), NOT NULL |  |
| `artwork_id` | `uuid` | REF → `catalog.artworks`, NOT NULL |  |
| `seller_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `quantity` | `int` | NOT NULL, DEFAULT `1` |  |
| `added_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Unique:** `(cart_id, artwork_id)`

### `promotions`

Mã giảm giá của platform (seller_id NULL) hoặc của seller (chỉ áp cho item của seller đó). Nằm ở commerce vì checkout cần kiểm tra đồng bộ.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `seller_id` | `uuid` | REF → `identity.users`, NULL |  |
| `code` | `varchar(32)` | UNIQUE, NOT NULL | lưu UPPERCASE |
| `description` | `varchar(255)` | NULL |  |
| `discount_type` | `discount_type` | NOT NULL | percent \| fixed |
| `discount_value` | `bigint` | NOT NULL | % (1-100) hoặc VND |
| `min_order_amount` | `bigint` | NOT NULL, DEFAULT `0` |  |
| `max_discount_amount` | `bigint` | NULL |  |
| `starts_at` | `timestamptz` | NOT NULL |  |
| `ends_at` | `timestamptz` | NULL |  |
| `max_uses` | `int` | NULL |  |
| `max_uses_per_user` | `int` | NOT NULL, DEFAULT `1` |  |
| `used_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `is_active` | `boolean` | NOT NULL, DEFAULT `true` |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(seller_id, is_active)`

### `promotion_redemptions`

Lịch sử dùng mã, để giới hạn số lần/user.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `promotion_id` | `uuid` | FK → `promotions.id` (RESTRICT), NOT NULL |  |
| `order_id` | `uuid` | FK → `orders.id` (CASCADE), NOT NULL |  |
| `user_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `discount_amount` | `bigint` | NOT NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Unique:** `(promotion_id, order_id)`
- **Index:** `(promotion_id, user_id)`

### `orders`

Đơn thanh toán của người mua (1 lần thanh toán PayOS). Vận chuyển được tách theo seller ở seller_orders.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `order_number` | `varchar(20)` | UNIQUE, NOT NULL | VD: ART-20261116-000123 |
| `buyer_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `status` | `order_status` | NOT NULL, DEFAULT `'pending_payment'` | pending_payment \| paid \| completed \| cancelled \| refunded |
| `subtotal_amount` | `bigint` | NOT NULL |  |
| `discount_amount` | `bigint` | NOT NULL, DEFAULT `0` |  |
| `shipping_amount` | `bigint` | NOT NULL, DEFAULT `0` |  |
| `total_amount` | `bigint` | NOT NULL |  |
| `promotion_code` | `varchar(32)` | NULL |  |
| `shipping_address` | `jsonb` | NOT NULL | {fullName, phone, line1, ward, district, province} |
| `buyer_note` | `text` | NULL |  |
| `payment_expires_at` | `timestamptz` | NOT NULL | quá hạn => cancelled, nhả reservation |
| `paid_at` | `timestamptz` | NULL |  |
| `cancelled_at` | `timestamptz` | NULL |  |
| `cancel_reason` | `varchar(255)` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(buyer_id, created_at)`
- **Index:** `(status, payment_expires_at)`

### `seller_orders`

Phần đơn của từng seller: mỗi seller giao hàng, cập nhật vận đơn riêng.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `order_id` | `uuid` | FK → `orders.id` (CASCADE), NOT NULL |  |
| `seller_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `status` | `seller_order_status` | NOT NULL, DEFAULT `'pending'` | pending \| confirmed \| shipped \| delivered \| cancelled |
| `subtotal_amount` | `bigint` | NOT NULL |  |
| `shipping_amount` | `bigint` | NOT NULL, DEFAULT `0` |  |
| `platform_fee_amount` | `bigint` | NOT NULL, DEFAULT `0` |  |
| `seller_net_amount` | `bigint` | NOT NULL | số tiền seller được nhận |
| `carrier` | `varchar(64)` | NULL |  |
| `tracking_number` | `varchar(64)` | NULL |  |
| `shipped_at` | `timestamptz` | NULL |  |
| `delivered_at` | `timestamptz` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Unique:** `(order_id, seller_id)`
- **Index:** `(seller_id, status, created_at)`

### `order_items`

Snapshot tác phẩm tại thời điểm mua (bất biến).

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `order_id` | `uuid` | FK → `orders.id` (CASCADE), NOT NULL |  |
| `seller_order_id` | `uuid` | FK → `seller_orders.id` (CASCADE), NOT NULL |  |
| `artwork_id` | `uuid` | REF → `catalog.artworks`, NOT NULL |  |
| `artwork_title` | `varchar(255)` | NOT NULL |  |
| `artwork_image_url` | `varchar(1024)` | NULL |  |
| `unit_price` | `bigint` | NOT NULL |  |
| `quantity` | `int` | NOT NULL |  |
| `line_total` | `bigint` | NOT NULL |  |

- **Index:** `(order_id)`
- **Index:** `(seller_order_id)`
- **Index:** `(artwork_id)`

### `payments`

Một lần tạo payment link PayOS cho order HOẶC invoice (đúng 1 trong 2). payos_order_code là số nguyên PayOS yêu cầu, dùng làm khóa idempotency.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `order_id` | `uuid` | FK → `orders.id` (RESTRICT), NULL |  |
| `invoice_id` | `uuid` | FK → `invoices.id` (RESTRICT), NULL |  |
| `payos_order_code` | `bigint` | UNIQUE, NOT NULL |  |
| `payos_payment_link_id` | `varchar(64)` | UNIQUE, NULL |  |
| `checkout_url` | `varchar(1024)` | NULL |  |
| `qr_code` | `text` | NULL |  |
| `amount` | `bigint` | NOT NULL |  |
| `description` | `varchar(25)` | NOT NULL | PayOS giới hạn 25 ký tự |
| `status` | `payment_status` | NOT NULL, DEFAULT `'pending'` | pending \| paid \| cancelled \| expired \| failed |
| `transaction_reference` | `varchar(64)` | NULL | mã tham chiếu ngân hàng từ webhook |
| `paid_at` | `timestamptz` | NULL |  |
| `expires_at` | `timestamptz` | NOT NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(order_id)`
- **Index:** `(invoice_id)`
- **Index:** `(status, expires_at)`

### `payment_webhook_events`

Log mọi webhook PayOS (đã verify chữ ký) để audit và xử lý idempotent.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `payos_order_code` | `bigint` | NOT NULL |  |
| `payload_hash` | `char(64)` | UNIQUE, NOT NULL | SHA-256 body, chống xử lý trùng |
| `payload` | `jsonb` | NOT NULL |  |
| `status` | `webhook_status` | NOT NULL, DEFAULT `'received'` | received \| processed \| ignored \| failed |
| `error` | `text` | NULL |  |
| `received_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `processed_at` | `timestamptz` | NULL |  |

- **Index:** `(payos_order_code)`

### `refunds`

PayOS không có API hoàn tiền: admin chuyển khoản thủ công và ghi nhận ở đây.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `payment_id` | `uuid` | FK → `payments.id` (RESTRICT), NOT NULL |  |
| `amount` | `bigint` | NOT NULL |  |
| `reason` | `varchar(255)` | NOT NULL |  |
| `status` | `refund_status` | NOT NULL, DEFAULT `'pending'` | pending \| completed \| rejected |
| `bank_transfer_ref` | `varchar(64)` | NULL |  |
| `processed_by` | `uuid` | REF → `identity.users`, NULL |  |
| `processed_at` | `timestamptz` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(payment_id)`

### `seller_payout_accounts`

Tài khoản ngân hàng nhận tiền của seller (mã BIN theo chuẩn VietQR).

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `seller_id` | `uuid` | REF → `identity.users`, UNIQUE, NOT NULL |  |
| `bank_bin` | `varchar(10)` | NOT NULL |  |
| `bank_name` | `varchar(255)` | NOT NULL |  |
| `account_number` | `varchar(32)` | NOT NULL |  |
| `account_name` | `varchar(255)` | NOT NULL |  |
| `is_verified` | `boolean` | NOT NULL, DEFAULT `false` |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

### `payouts`

Một đợt chi trả cho seller (gom nhiều seller_order đã giao thành công).

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `seller_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `payout_account_id` | `uuid` | FK → `seller_payout_accounts.id` (RESTRICT), NOT NULL |  |
| `amount` | `bigint` | NOT NULL |  |
| `status` | `payout_status` | NOT NULL, DEFAULT `'pending'` | pending \| processing \| paid \| failed |
| `transfer_reference` | `varchar(64)` | NULL |  |
| `failure_reason` | `varchar(255)` | NULL |  |
| `paid_at` | `timestamptz` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(seller_id, status)`

### `payout_items`

Đối soát: mỗi seller_order chỉ được chi trả đúng một lần.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `payout_id` | `uuid` | FK → `payouts.id` (CASCADE), NOT NULL |  |
| `seller_order_id` | `uuid` | FK → `seller_orders.id` (RESTRICT), UNIQUE, NOT NULL |  |
| `amount` | `bigint` | NOT NULL |  |

### `invoices`

Hóa đơn seller gửi khách (bán nhanh ngoài giỏ hàng), thanh toán qua PayOS.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `invoice_number` | `varchar(20)` | UNIQUE, NOT NULL |  |
| `seller_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `buyer_id` | `uuid` | REF → `identity.users`, NULL | NULL nếu khách chưa có tài khoản |
| `customer_name` | `varchar(255)` | NOT NULL |  |
| `customer_email` | `varchar(320)` | NOT NULL |  |
| `status` | `invoice_status` | NOT NULL, DEFAULT `'draft'` | draft \| sent \| paid \| cancelled |
| `subtotal_amount` | `bigint` | NOT NULL |  |
| `discount_amount` | `bigint` | NOT NULL, DEFAULT `0` |  |
| `total_amount` | `bigint` | NOT NULL |  |
| `note` | `text` | NULL |  |
| `due_at` | `timestamptz` | NULL |  |
| `sent_at` | `timestamptz` | NULL |  |
| `paid_at` | `timestamptz` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(seller_id, status)`
- **Index:** `(buyer_id)`

### `invoice_items`

Dòng hàng của hóa đơn.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `invoice_id` | `uuid` | FK → `invoices.id` (CASCADE), NOT NULL |  |
| `artwork_id` | `uuid` | REF → `catalog.artworks`, NULL | NULL nếu là dịch vụ/commission |
| `description` | `varchar(500)` | NOT NULL |  |
| `unit_price` | `bigint` | NOT NULL |  |
| `quantity` | `int` | NOT NULL, DEFAULT `1` |  |
| `line_total` | `bigint` | NOT NULL |  |

- **Index:** `(invoice_id)`

## 7. Social Service — `social_db`

Cộng đồng (follow, reaction, comment, moment, moodboard, review), sự kiện, nhắn tin, thông báo (in-app + email).

### `follows`

Quan hệ theo dõi user-user.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `follower_id` | `uuid` | PK, REF → `identity.users` |  |
| `followee_id` | `uuid` | PK, REF → `identity.users` | CHECK follower_id <> followee_id |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **PK kép:** `(follower_id, followee_id)`
- **Index:** `(followee_id, created_at)`

### `reactions`

Like DUY NHẤT cho mọi đối tượng (gồm cả artwork). Thay cho artwork_likes + likes cũ.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `user_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `target_type` | `social_target_type` | NOT NULL | artwork \| moment \| moodboard \| comment \| review |
| `target_id` | `uuid` | NOT NULL |  |
| `target_owner_id` | `uuid` | REF → `identity.users`, NOT NULL | để gửi thông báo |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Unique:** `(user_id, target_type, target_id)`
- **Index:** `(target_type, target_id)`

### `comments`

Comment DUY NHẤT cho mọi đối tượng, hỗ trợ reply 1 cấp qua parent_id.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `user_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `target_type` | `social_target_type` | NOT NULL |  |
| `target_id` | `uuid` | NOT NULL |  |
| `target_owner_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `parent_id` | `uuid` | FK → `comments.id` (CASCADE), NULL |  |
| `content` | `text` | NOT NULL |  |
| `reaction_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `reply_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `edited_at` | `timestamptz` | NULL |  |
| `deleted_at` | `timestamptz` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(target_type, target_id, created_at)`
- **Index:** `(parent_id)`

### `moments`

Bài đăng ngắn dạng story. Lượt xem đếm ở Redis, định kỳ ghi vào view_count.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `user_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `caption` | `text` | NULL |  |
| `media_url` | `varchar(1024)` | NOT NULL |  |
| `media_type` | `media_type` | NOT NULL | image \| video |
| `thumbnail_url` | `varchar(1024)` | NULL |  |
| `expires_at` | `timestamptz` | NULL | NULL = không hết hạn |
| `is_archived` | `boolean` | NOT NULL, DEFAULT `false` |  |
| `view_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `reaction_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `comment_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(user_id, created_at)`

### `moment_artworks`

Tác phẩm được gắn trong moment.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `moment_id` | `uuid` | PK, FK → `moments.id` (CASCADE) |  |
| `artwork_id` | `uuid` | PK, REF → `catalog.artworks` |  |
| `display_order` | `int` | NOT NULL, DEFAULT `0` |  |

- **PK kép:** `(moment_id, artwork_id)`

### `moodboards`

Bộ sưu tập tác phẩm do người dùng tuyển chọn.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `owner_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `title` | `varchar(255)` | NOT NULL |  |
| `description` | `text` | NULL |  |
| `cover_image_url` | `varchar(1024)` | NULL |  |
| `visibility` | `visibility` | NOT NULL, DEFAULT `'private'` | private \| public |
| `is_collaborative` | `boolean` | NOT NULL, DEFAULT `false` |  |
| `artwork_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(owner_id, created_at)`

### `moodboard_artworks`

Tác phẩm trong moodboard.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `moodboard_id` | `uuid` | PK, FK → `moodboards.id` (CASCADE) |  |
| `artwork_id` | `uuid` | PK, REF → `catalog.artworks` |  |
| `added_by` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `note` | `text` | NULL |  |
| `display_order` | `int` | NOT NULL, DEFAULT `0` |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **PK kép:** `(moodboard_id, artwork_id)`
- **Index:** `(artwork_id)`

### `moodboard_collaborators`

Người được mời cùng chỉnh sửa moodboard.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `moodboard_id` | `uuid` | PK, FK → `moodboards.id` (CASCADE) |  |
| `user_id` | `uuid` | PK, REF → `identity.users` |  |
| `role` | `collaborator_role` | NOT NULL, DEFAULT `'editor'` | editor \| viewer |
| `invited_by` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **PK kép:** `(moodboard_id, user_id)`
- **Index:** `(user_id)`

### `reviews`

Đánh giá sau mua. Mỗi order_item chỉ review một lần (verified purchase).

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `order_item_id` | `uuid` | REF → `commerce.order_items`, UNIQUE, NOT NULL |  |
| `buyer_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `seller_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `artwork_id` | `uuid` | REF → `catalog.artworks`, NOT NULL |  |
| `rating` | `smallint` | NOT NULL | CHECK 1..5 |
| `content` | `text` | NULL |  |
| `images` | `jsonb` | NOT NULL, DEFAULT `'[]'` |  |
| `seller_response` | `text` | NULL |  |
| `seller_responded_at` | `timestamptz` | NULL |  |
| `status` | `review_status` | NOT NULL, DEFAULT `'published'` | published \| hidden |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(seller_id, status, created_at)`
- **Index:** `(artwork_id, status)`

### `events`

Sự kiện (triển lãm, workshop...). Phiên bản này chỉ hỗ trợ sự kiện miễn phí.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `organizer_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `title` | `varchar(255)` | NOT NULL |  |
| `description` | `text` | NULL |  |
| `type` | `event_type` | NOT NULL | exhibition \| opening \| workshop \| talk \| online |
| `status` | `event_status` | NOT NULL, DEFAULT `'draft'` | draft \| published \| cancelled \| completed |
| `visibility` | `event_visibility` | NOT NULL, DEFAULT `'public'` | public \| invite_only |
| `starts_at` | `timestamptz` | NOT NULL |  |
| `ends_at` | `timestamptz` | NOT NULL |  |
| `timezone` | `varchar(64)` | NOT NULL, DEFAULT `'Asia/Ho_Chi_Minh'` |  |
| `location` | `jsonb` | NOT NULL | {mode: offline\|online, venue, address, url} |
| `cover_image_url` | `varchar(1024)` | NULL |  |
| `capacity` | `int` | NULL | NULL = không giới hạn |
| `registration_deadline` | `timestamptz` | NULL |  |
| `registered_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `published_at` | `timestamptz` | NULL |  |
| `cancelled_at` | `timestamptz` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(organizer_id, status)`
- **Index:** `(status, starts_at)`

### `event_registrations`

Đăng ký + check-in (gộp rsvps và attendees cũ). Khách vãng lai/walk-in dùng guest_*, CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL).

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `event_id` | `uuid` | FK → `events.id` (CASCADE), NOT NULL |  |
| `user_id` | `uuid` | REF → `identity.users`, NULL |  |
| `guest_name` | `varchar(255)` | NULL |  |
| `guest_email` | `varchar(320)` | NULL |  |
| `guest_count` | `smallint` | NOT NULL, DEFAULT `1` |  |
| `source` | `registration_source` | NOT NULL, DEFAULT `'online'` | online \| invite \| walk_in |
| `status` | `registration_status` | NOT NULL, DEFAULT `'registered'` | registered \| waitlisted \| cancelled |
| `checked_in_at` | `timestamptz` | NULL |  |
| `checked_in_by` | `uuid` | REF → `identity.users`, NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Unique:** `(event_id, user_id)`
- **Unique:** `(event_id, guest_email)`
- **Index:** `(event_id, status)`

### `event_artworks`

Tác phẩm trưng bày tại sự kiện.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `event_id` | `uuid` | PK, FK → `events.id` (CASCADE) |  |
| `artwork_id` | `uuid` | PK, REF → `catalog.artworks` |  |
| `display_order` | `int` | NOT NULL, DEFAULT `0` |  |
| `is_featured` | `boolean` | NOT NULL, DEFAULT `false` |  |

- **PK kép:** `(event_id, artwork_id)`

### `conversations`

Hội thoại direct/group/hỏi mua. direct_key = 2 user id sắp xếp, chống tạo trùng chat 1-1.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `type` | `conversation_type` | NOT NULL | direct \| group \| inquiry |
| `title` | `varchar(255)` | NULL |  |
| `direct_key` | `varchar(80)` | UNIQUE, NULL |  |
| `context_type` | `varchar(32)` | NULL | artwork \| order \| event |
| `context_id` | `uuid` | NULL |  |
| `created_by` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `last_message_at` | `timestamptz` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(last_message_at)`

### `conversation_participants`

Thành viên + trạng thái đã đọc (thay cho read_receipts từng tin nhắn).

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `conversation_id` | `uuid` | PK, FK → `conversations.id` (CASCADE) |  |
| `user_id` | `uuid` | PK, REF → `identity.users` |  |
| `role` | `participant_role` | NOT NULL, DEFAULT `'member'` | member \| admin |
| `last_read_message_id` | `uuid` | NULL |  |
| `last_read_at` | `timestamptz` | NULL |  |
| `muted_until` | `timestamptz` | NULL |  |
| `joined_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `left_at` | `timestamptz` | NULL |  |

- **PK kép:** `(conversation_id, user_id)`
- **Index:** `(user_id)`

### `messages`

Tin nhắn. Typing indicator để ở Redis (TTL), không lưu DB.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `conversation_id` | `uuid` | FK → `conversations.id` (CASCADE), NOT NULL |  |
| `sender_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `type` | `message_type` | NOT NULL, DEFAULT `'text'` | text \| image \| file \| artwork_share \| system |
| `content` | `text` | NULL |  |
| `attachments` | `jsonb` | NOT NULL, DEFAULT `'[]'` | [{url, name, mimeType, size}] hoặc {artworkId} |
| `reply_to_id` | `uuid` | FK → `messages.id` (SET NULL), NULL |  |
| `edited_at` | `timestamptz` | NULL |  |
| `deleted_at` | `timestamptz` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(conversation_id, created_at)`

### `notifications`

Thông báo in-app (thay activity_feeds + notification_history cũ).

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `user_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `type` | `varchar(64)` | NOT NULL | VD: order.paid, social.followed |
| `title` | `varchar(255)` | NOT NULL |  |
| `body` | `text` | NULL |  |
| `data` | `jsonb` | NOT NULL, DEFAULT `'{}'` | deep-link: {orderId, artworkId...} |
| `read_at` | `timestamptz` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(user_id, created_at)`
- **Index:** `(user_id) WHERE read_at IS NULL`

### `email_deliveries`

Hàng đợi + log gửi email (xác minh, reset mật khẩu, đơn hàng...).

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `source_event_id` | `uuid` | UNIQUE, NULL | message_id gây ra email => idempotent |
| `to_email` | `varchar(320)` | NOT NULL |  |
| `template` | `varchar(64)` | NOT NULL |  |
| `payload` | `jsonb` | NOT NULL |  |
| `status` | `delivery_status` | NOT NULL, DEFAULT `'pending'` | pending \| sent \| failed |
| `attempts` | `int` | NOT NULL, DEFAULT `0` |  |
| `last_error` | `text` | NULL |  |
| `sent_at` | `timestamptz` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(status, created_at)`

### `notification_preferences`

Tùy chọn nhận thông báo của user.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `user_id` | `uuid` | PK, REF → `identity.users` |  |
| `email_enabled` | `boolean` | NOT NULL, DEFAULT `true` |  |
| `in_app_enabled` | `boolean` | NOT NULL, DEFAULT `true` |  |
| `muted_types` | `text[]` | NOT NULL, DEFAULT `'{}'` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

### `user_summaries`

PROJECTION từ identity để hiển thị tên/avatar trong feed, chat, comment.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `user_id` | `uuid` | PK, REF → `identity.users` |  |
| `full_name` | `varchar(255)` | NOT NULL |  |
| `avatar_url` | `varchar(1024)` | NULL |  |
| `seller_slug` | `varchar(120)` | NULL |  |
| `updated_at` | `timestamptz` | NOT NULL |  |

### `artwork_summaries`

PROJECTION từ catalog (catalog.artwork.*): chủ tác phẩm + có đang công khai không, để like / bình luận / gắn vào moment mà không gọi sang catalog. Gỡ / xóa: giữ dòng, is_public = false.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `artwork_id` | `uuid` | PK, REF → `catalog.artworks` |  |
| `seller_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `title` | `varchar(100)` | NOT NULL |  |
| `cover_image_url` | `varchar(1024)` | NULL |  |
| `is_public` | `boolean` | NOT NULL | status published \| sold_out |
| `updated_at` | `timestamptz` | NOT NULL |  |

- **Index:** `(seller_id) WHERE is_public`

## 8. CRM Service — `crm_db`

Công cụ cho seller: danh bạ khách hàng, phân khúc, email campaign, private view.

### `contacts`

Danh bạ khách của từng seller. Chỉ số mua là projection từ event commerce.order.paid.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `seller_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `user_id` | `uuid` | REF → `identity.users`, NULL | NULL nếu khách ngoài hệ thống |
| `email` | `varchar(320)` | NOT NULL |  |
| `full_name` | `varchar(255)` | NULL |  |
| `phone` | `varchar(20)` | NULL |  |
| `source` | `contact_source` | NOT NULL, DEFAULT `'manual'` | manual \| purchase \| event \| inquiry \| import |
| `status` | `contact_status` | NOT NULL, DEFAULT `'active'` | active \| unsubscribed \| bounced |
| `tags` | `text[]` | NOT NULL, DEFAULT `'{}'` |  |
| `notes` | `text` | NULL |  |
| `total_orders` | `int` | NOT NULL, DEFAULT `0` |  |
| `total_spent` | `bigint` | NOT NULL, DEFAULT `0` |  |
| `last_order_at` | `timestamptz` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Unique:** `(seller_id, email)`
- **Index:** `(seller_id, status)`

### `segments`

Phân khúc khách: static (thêm tay) hoặc dynamic (theo rules, tính lại định kỳ).

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `seller_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `name` | `varchar(255)` | NOT NULL |  |
| `type` | `segment_type` | NOT NULL | static \| dynamic |
| `rules` | `jsonb` | NULL | dynamic: [{field, op, value}] |
| `member_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `last_computed_at` | `timestamptz` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(seller_id)`

### `segment_members`

Thành viên của segment (thay mảng JSONB customer_segment_ids cũ).

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `segment_id` | `uuid` | PK, FK → `segments.id` (CASCADE) |  |
| `contact_id` | `uuid` | PK, FK → `contacts.id` (CASCADE) |  |
| `added_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **PK kép:** `(segment_id, contact_id)`
- **Index:** `(contact_id)`

### `email_campaigns`

Chiến dịch email marketing.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `seller_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `name` | `varchar(255)` | NOT NULL |  |
| `subject` | `varchar(255)` | NOT NULL |  |
| `body_html` | `text` | NOT NULL |  |
| `status` | `campaign_status` | NOT NULL, DEFAULT `'draft'` | draft \| scheduled \| sending \| sent \| cancelled |
| `scheduled_at` | `timestamptz` | NULL |  |
| `sent_at` | `timestamptz` | NULL |  |
| `recipient_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `opened_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `clicked_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(seller_id, status)`
- **Index:** `(status, scheduled_at)`

### `campaign_segments`

Segment được nhắm tới trong campaign.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `campaign_id` | `uuid` | PK, FK → `email_campaigns.id` (CASCADE) |  |
| `segment_id` | `uuid` | PK, FK → `segments.id` (CASCADE) |  |

- **PK kép:** `(campaign_id, segment_id)`

### `campaign_recipients`

Trạng thái gửi/mở/click cho từng contact.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `campaign_id` | `uuid` | FK → `email_campaigns.id` (CASCADE), NOT NULL |  |
| `contact_id` | `uuid` | FK → `contacts.id` (CASCADE), NOT NULL |  |
| `email` | `varchar(320)` | NOT NULL |  |
| `status` | `recipient_status` | NOT NULL, DEFAULT `'pending'` | pending \| sent \| failed \| bounced |
| `sent_at` | `timestamptz` | NULL |  |
| `opened_at` | `timestamptz` | NULL |  |
| `clicked_at` | `timestamptz` | NULL |  |
| `error` | `text` | NULL |  |

- **Unique:** `(campaign_id, contact_id)`
- **Index:** `(campaign_id, status)`

### `private_views`

Phòng xem riêng cho khách VIP qua link có token (chỉ lưu hash).

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `seller_id` | `uuid` | REF → `identity.users`, NOT NULL |  |
| `title` | `varchar(255)` | NOT NULL |  |
| `description` | `text` | NULL |  |
| `access_token_hash` | `char(64)` | UNIQUE, NOT NULL |  |
| `password_hash` | `varchar(255)` | NULL |  |
| `expires_at` | `timestamptz` | NULL |  |
| `max_views` | `int` | NULL |  |
| `view_count` | `int` | NOT NULL, DEFAULT `0` |  |
| `show_prices` | `boolean` | NOT NULL, DEFAULT `true` |  |
| `allow_purchase` | `boolean` | NOT NULL, DEFAULT `true` |  |
| `status` | `private_view_status` | NOT NULL, DEFAULT `'active'` | active \| expired \| revoked |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(seller_id, status)`

### `private_view_artworks`

Tác phẩm trong private view.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `private_view_id` | `uuid` | PK, FK → `private_views.id` (CASCADE) |  |
| `artwork_id` | `uuid` | PK, REF → `catalog.artworks` |  |
| `display_order` | `int` | NOT NULL, DEFAULT `0` |  |
| `note` | `text` | NULL |  |

- **PK kép:** `(private_view_id, artwork_id)`

### `private_view_invitees`

Người được mời xem.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` |  |
| `private_view_id` | `uuid` | FK → `private_views.id` (CASCADE), NOT NULL |  |
| `contact_id` | `uuid` | FK → `contacts.id` (SET NULL), NULL |  |
| `email` | `varchar(320)` | NOT NULL |  |
| `invited_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |
| `viewed_at` | `timestamptz` | NULL |  |

- **Unique:** `(private_view_id, email)`

## 9. Bảng hạ tầng (có trong MỌI database)

### `outbox`

Transactional outbox: ghi event trong CÙNG transaction với dữ liệu nghiệp vụ, worker relay đọc và publish lên RabbitMQ (at-least-once).

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | cũng là message_id gửi lên broker |
| `aggregate_type` | `varchar(64)` | NOT NULL | VD: User, Order |
| `aggregate_id` | `uuid` | NOT NULL |  |
| `event_type` | `varchar(128)` | NOT NULL | VD: identity.user.registered |
| `payload` | `jsonb` | NOT NULL |  |
| `status` | `outbox_status` | NOT NULL, DEFAULT `'pending'` | pending \| published \| failed |
| `attempts` | `int` | NOT NULL, DEFAULT `0` |  |
| `available_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | dùng cho retry backoff |
| `published_at` | `timestamptz` | NULL |  |
| `last_error` | `text` | NULL |  |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **Index:** `(status, available_at) WHERE status = 'pending'`

### `inbox`

Idempotency cho consumer: mỗi message chỉ được xử lý một lần cho mỗi consumer.

| Cột | Kiểu | Ràng buộc | Ghi chú |
| --- | --- | --- | --- |
| `message_id` | `uuid` | PK | = outbox.id của service phát |
| `consumer` | `varchar(100)` | PK | tên handler |
| `processed_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |  |

- **PK kép:** `(message_id, consumer)`

## 10. Event giữa các service

Exchange `artium.events` (topic) trên RabbitMQ. Service phát ghi vào `outbox` trong cùng transaction; consumer ghi `inbox` để xử lý idempotent.

| Event (routing key) | Phát bởi | Tiêu thụ bởi |
| --- | --- | --- |
| `identity.user.registered` | identity | social (tạo user_summary, gửi email chào mừng) |
| `identity.user.updated` | identity | social, catalog (cập nhật projection) |
| `identity.email_verification.requested` | identity | identity.mailer (gửi email xác minh qua SMTP; sau này chuyển sang social) |
| `identity.password_reset.requested` | identity | identity.mailer (gửi email đặt lại mật khẩu qua SMTP; sau này chuyển sang social) |
| `identity.seller_profile.upserted` | identity | catalog (seller_summaries), social (user_summaries) |
| `catalog.artwork.published / updated / archived` | catalog | social (artwork_summaries), commerce (vô hiệu giỏ hàng nếu ngừng bán) |
| `catalog.reservation.failed` | catalog | commerce (hủy đơn vì hết hàng) |
| `commerce.order.created` | commerce | catalog (tạo reservation) |
| `commerce.order.paid` | commerce | catalog (confirm reservation), crm (cập nhật contact), social (thông báo seller + buyer) |
| `commerce.order.cancelled` | commerce | catalog (release reservation), social (thông báo) |
| `commerce.seller_order.shipped / delivered` | commerce | social (thông báo buyer) |
| `social.reaction.changed / social.comment.changed` | social | catalog (like_count, comment_count) |

## 11. Enum

| Enum | Giá trị |
| --- | --- |
| `artwork_status` | draft \| published \| sold_out \| archived |
| `campaign_status` | draft \| scheduled \| sending \| sent \| cancelled |
| `collaborator_role` | editor \| viewer |
| `contact_source` | manual \| purchase \| event \| inquiry \| import |
| `contact_status` | active \| unsubscribed \| bounced |
| `conversation_type` | direct \| group \| inquiry |
| `delivery_status` | pending \| sent \| failed |
| `dimension_unit` | cm \| in |
| `discount_type` | percent \| fixed |
| `event_status` | draft \| published \| cancelled \| completed |
| `event_type` | exhibition \| opening \| workshop \| talk \| online |
| `event_visibility` | public \| invite_only |
| `invoice_status` | draft \| sent \| paid \| cancelled |
| `listing_type` | for_sale \| inquire \| display_only \| sold |
| `media_type` | image \| video |
| `message_type` | text \| image \| file \| artwork_share \| system |
| `oauth_provider` | google |
| `order_status` | pending_payment \| paid \| completed \| cancelled \| refunded |
| `outbox_status` | pending \| published \| failed |
| `participant_role` | member \| admin |
| `payment_status` | pending \| paid \| cancelled \| expired \| failed |
| `payout_status` | pending \| processing \| paid \| failed |
| `private_view_status` | active \| expired \| revoked |
| `recipient_status` | pending \| sent \| failed \| bounced |
| `refund_status` | pending \| completed \| rejected |
| `registration_source` | online \| invite \| walk_in |
| `registration_status` | registered \| waitlisted \| cancelled |
| `reservation_status` | active \| confirmed \| released |
| `review_status` | published \| hidden |
| `segment_type` | static \| dynamic |
| `seller_order_status` | pending \| confirmed \| shipped \| delivered \| cancelled |
| `seller_profile_type` | individual \| gallery \| institution |
| `seller_verification_status` | unverified \| pending \| verified \| rejected |
| `social_target_type` | artwork \| moment \| moodboard \| comment \| review |
| `tag_category` | medium \| style \| subject \| other |
| `user_role` | mỗi tài khoản 1 vai trò |
| `user_status` | active \| suspended |
| `user_token_type` | email_verification \| password_reset \| password_change |
| `visibility` | private \| public |
| `webhook_status` | received \| processed \| ignored \| failed |
| `weight_unit` | kg \| lb |

## 12. Đề xuất bổ sung từ thiết kế Figma (CHƯA triển khai)

Các điểm thiết kế cần nhưng schema hiện tại chưa có. Khi làm tới tính năng tương ứng: chuyển vào `SERVICES` trong spec, sinh lại tài liệu, rồi viết migration.

| Bổ sung | Service | Lý do (màn hình Figma) |
| --- | --- | --- |
| `identity.users.lat/lng (numeric) hoặc PostGIS` | identity | Màn 'Who's Near You', 'Discover - Nearby' cần tọa độ để lọc theo khoảng cách (hiện chỉ có users.city và seller_profiles.location dạng chuỗi). |
| `identity.seller_profiles.about jsonb {affiliations[], seen_at[], currently, invited_by}` | identity | Khối About Me: Affiliations, You might have seen me at, Currently, Invited by. |
| `catalog.artwork_certificates(id, artwork_id, certificate_no, issued_at, issuer, file_url, verify_code)` | catalog | Trang 'Verified Certificates' — chứng nhận tác phẩm thật, có mã tra cứu công khai. |
| `social.articles(id, author_id, type, title, slug, cover_url, body, published_at, read_minutes)` | social | Khối 'Weekly Editorial For You' (Blog / Spotlight) trên trang chủ app. |
| `Thay 'Stripe Tap to Pay' và nhãn giá ETH trong Figma` | commerce | Dự án chỉ dùng PayOS + VND: màn 'Invoice Page / QR Code' dùng QR của PayOS; bỏ màn Tap to Pay. |

## 13. Luồng nghiệp vụ chính

**Checkout (saga):** commerce tạo `orders` + `seller_orders` + `order_items` (`pending_payment`) → phát `commerce.order.created` → catalog tạo `artwork_reservations`, giảm `quantity_available` (thất bại → `catalog.reservation.failed` → commerce hủy đơn) → commerce tạo `payments` + payment link PayOS → webhook PayOS (verify chữ ký, log `payment_webhook_events`) → `payments.paid`, `orders.paid` → phát `commerce.order.paid` → catalog confirm reservation, crm cập nhật contact, social gửi thông báo. Hết `payment_expires_at` → `orders.cancelled` → catalog release reservation.

**Chi trả seller:** `seller_orders.delivered` → admin tạo `payouts` gom các seller_order chưa chi trả (`payout_items.seller_order_id` UNIQUE) → chuyển khoản → `payouts.paid`.
