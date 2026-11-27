# Artium

Nền tảng mua bán & cộng đồng nghệ thuật.

## Tech stack

- **Backend:** NestJS microservices (monorepo), TypeORM, PostgreSQL (database-per-service), RabbitMQ, Redis
- **Thanh toán:** PayOS · **Đăng nhập:** email/mật khẩu + Google
- **Frontend:** React, TypeScript, Vite
- **Hạ tầng:** Docker Compose

## Tài liệu

- Kiến trúc & cách chạy backend: [`be/README.md`](be/README.md)
- Database (sinh tự động, luôn khớp nhau): [`docs/database/schema-entities.md`](docs/database/schema-entities.md),
  [`docs/database/artium_database_erd.drawio`](docs/database/artium_database_erd.drawio)
- Quy trình Git: [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md)

## Cài đặt cho thành viên mới

### 1. Cần cài trước

| Công cụ | Phiên bản | Ghi chú |
| --- | --- | --- |
| Git | bất kỳ | |
| Node.js | **22** (xem `.nvmrc`) | Nên dùng [nvm](https://github.com/nvm-sh/nvm): `nvm install 22` |
| Docker Desktop | bản mới | Chạy Postgres, Redis, RabbitMQ, Mailpit. Mở Docker Desktop trước khi chạy lệnh |
| Python 3 | ≥ 3.9 | Chỉ cần khi sửa thiết kế database (`npm run docs:db`) |

### 2. Clone và cài package

```bash
git clone https://github.com/PhamNam342/cnweb_artium.git
cd cnweb_artium
nvm use
npm install
npm --prefix be install
npm --prefix FE install
```

`npm install` ở thư mục gốc cũng cài git hook (husky): mỗi lần commit sẽ tự chạy lint, typecheck và kiểm tra tên commit.

### 3. Tạo file cấu hình

```bash
cp .env.example .env
cp be/.env.example be/.env
cp FE/.env.example FE/.env
```

Các file `.env` **không được commit** (đã có trong `.gitignore`). Mặc định đã chạy được, chỉ cần điền thêm:

- **Cloudinary** (bắt buộc nếu muốn upload ảnh tác phẩm, avatar, moment): điền `CLOUDINARY_CLOUD_NAME`,
  `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` trong `be/.env`. Xin khóa của nhóm qua tin nhắn riêng,
  hoặc tự tạo tài khoản miễn phí tại cloudinary.com (Dashboard → API Keys). **Không dán khóa vào issue, PR hay commit.**
- **Google đăng nhập** (không bắt buộc): `GOOGLE_CLIENT_ID` trong `be/.env` và `VITE_GOOGLE_CLIENT_ID` trong `FE/.env`.
  Bỏ trống thì nút Google bị ẩn.

### 4. Bật hạ tầng, tạo database, đổ dữ liệu mẫu

```bash
docker compose up -d
npm run migrate
npm run seed
```

- `docker compose up -d` bật Postgres (cổng **55432**, tự tạo 5 database), Redis, RabbitMQ và Mailpit.
- `npm run migrate` tạo bảng cho mọi service. Chạy lại lệnh này **mỗi lần pull code mới** có migration.
- `npm run seed` tạo tài khoản và tác phẩm mẫu. Mật khẩu mọi tài khoản mẫu: **`Artium123`**
  (danh sách tài khoản ở [`be/README.md`](be/README.md#dữ-liệu-mẫu)).

### 5. Chạy

Mở 2 terminal:

```bash
npm run dev:be
```

```bash
npm run dev:fe
```

| Địa chỉ | Dùng để |
| --- | --- |
| http://localhost:5173 | Giao diện web. Đăng nhập thử bằng `lan.nguyen@artium.vn` / `Artium123` |
| http://localhost:3000/api | API qua gateway |
| http://localhost:3001/docs | Swagger của identity (catalog `:3002/docs`, social `:3004/docs`, ...) |
| http://localhost:8025 | **Mailpit**: mọi email khi dev (xác minh tài khoản, mã đổi mật khẩu) vào đây, không vào Gmail thật |
| http://localhost:15672 | RabbitMQ UI (`artium` / `artium_dev`) |

Xem database bằng TablePlus/DBeaver: `localhost:55432`, user `artium`, mật khẩu `artium_dev`,
hoặc chạy `npm run db:inspect -- all --summary`.

### Lỗi hay gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| `docker compose up` báo cổng đã bị chiếm | Một Postgres/Redis khác đang chạy. Tắt nó đi, hoặc đổi `POSTGRES_PORT`/`REDIS_PORT` trong `.env` (nhớ đổi cả URL tương ứng trong `be/.env`) |
| Backend báo `relation "..." does not exist` | Chưa migrate, hoặc vừa pull code có migration mới: `npm run migrate` |
| Trang Khám phá trống, không đăng nhập được tài khoản mẫu | Chưa chạy `npm run seed` |
| Upload ảnh báo lỗi, tác phẩm mẫu không có ảnh | Thiếu khóa `CLOUDINARY_*` trong `be/.env`. Điền xong thì khởi động lại backend và chạy lại `npm run seed` |
| Không nhận được mã đổi mật khẩu / mail xác minh | Mở Mailpit http://localhost:8025 |
| Commit bị chặn | Hook đang báo lỗi lint/typecheck hoặc tên commit sai chuẩn. Sửa lỗi rồi commit lại, **không** dùng `--no-verify` |
| Sau khi pull, chạy báo thiếu package | Có người thêm thư viện: chạy lại 3 lệnh `npm install` ở bước 2 |

> `setup.sh` và `continue-setup.sh` ở thư mục gốc là script dựng khung project lúc đầu. **Không chạy hai file này**:
> chúng có thể ghi đè code hiện tại.

## Kiểm tra chất lượng

```bash
npm run lint && npm run format:check && npm run typecheck && npm run test && npm run build
npm run test:e2e   # backend e2e, cần Postgres đã migrate
```

## Git workflow

Nhóm làm việc trên một nhánh chính là `main`. Mỗi việc (thường là một issue) làm trên một nhánh riêng tách từ `main`,
xong thì mở Pull Request để merge vào `main`. Chi tiết: [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md).

```bash
git switch main
git pull origin main
git switch -c feature/social-01-like
```
