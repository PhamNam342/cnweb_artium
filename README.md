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

## Bắt đầu nhanh

```bash
nvm use
npm install && npm --prefix be install && npm --prefix FE install

cp .env.example .env && docker compose up -d     # Postgres (5 DB), Redis, RabbitMQ
cp be/.env.example be/.env && cp FE/.env.example FE/.env
npm run migrate                                  # migration cho mọi service

npm run dev:be   # gateway :3000 + 5 service
npm run dev:fe   # http://localhost:5173
```

## Kiểm tra chất lượng

```bash
npm run lint && npm run format:check && npm run typecheck && npm run test && npm run build
npm run test:e2e   # backend e2e, cần Postgres đã migrate
```

## Git workflow

- `main`: production · `develop`: tích hợp · `feature/*`, `fix/*`, `hotfix/*`
- Luôn tạo nhánh feature từ `develop`.
