#!/usr/bin/env bash
set -Eeuo pipefail

# ============================================================
# Artium Phase 1 Scaffold
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# Optional:
#   ./setup.sh /path/to/target-directory
#
# Default target: directory containing this setup.sh file.
#
# No User Entity, UsersService or UsersModule is generated.
# ============================================================

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TARGET_ARG="${1:-$SCRIPT_DIR}"

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

log() {
  printf '\n\033[1;34m[INFO]\033[0m %s\n' "$1"
}

success() {
  printf '\033[1;32m[SUCCESS]\033[0m %s\n' "$1"
}

warn() {
  printf '\033[1;33m[WARNING]\033[0m %s\n' "$1"
}

error() {
  printf '\033[1;31m[ERROR]\033[0m %s\n' "$1" >&2
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    error "$1 is required."
    exit 1
  }
}

# ------------------------------------------------------------
# Validate environment
# ------------------------------------------------------------

require_command node
require_command npm
require_command git

NODE_VERSION="$(node -p 'process.versions.node')"
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
NODE_MINOR="$(node -p 'Number(process.versions.node.split(".")[1])')"

if (( NODE_MAJOR < 22 || (NODE_MAJOR == 22 && NODE_MINOR < 12) )); then
  error "Node.js 22.12+ is required. Found: $NODE_VERSION"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  warn "Docker was not found. You can install it later."
fi

PROJECT_ROOT="$(mkdir -p "$TARGET_ARG" && cd "$TARGET_ARG" && pwd)"

# ------------------------------------------------------------
# Prevent accidental overwriting
# ------------------------------------------------------------

GENERATED_PATHS=(
  "BE"
  "FE"
  ".github"
  ".husky"
  "package.json"
  "package-lock.json"
  "docker-compose.yml"
  "docker-compose.prod.yml"
  "README.md"
)

for path in "${GENERATED_PATHS[@]}"; do
  if [[ -e "$PROJECT_ROOT/$path" ]]; then
    error "Existing generated path found: $PROJECT_ROOT/$path"
    error "Move or back up the existing project files before running setup.sh."
    exit 1
  fi
done

cd "$PROJECT_ROOT"

log "Creating Artium Phase 1 at: $PROJECT_ROOT"

# ------------------------------------------------------------
# Git
# ------------------------------------------------------------

if [[ ! -d .git ]]; then
  git init
fi

# ------------------------------------------------------------
# Root package.json
# ------------------------------------------------------------

cat > package.json <<'EOF'
{
  "name": "artium",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "prepare": "husky",
    "lint": "npm --prefix BE run lint && npm --prefix FE run lint",
    "lint:fix": "npm --prefix BE run lint:fix && npm --prefix FE run lint:fix",
    "format": "prettier --write \"BE/src/**/*.ts\" \"BE/test/**/*.ts\" \"FE/src/**/*.{ts,tsx,css}\"",
    "format:check": "prettier --check \"BE/src/**/*.ts\" \"BE/test/**/*.ts\" \"FE/src/**/*.{ts,tsx,css}\"",
    "typecheck": "npm --prefix BE run typecheck && npm --prefix FE run typecheck",
    "test": "npm --prefix BE run test && npm --prefix FE run test",
    "build": "npm --prefix BE run build && npm --prefix FE run build"
  }
}
EOF

mkdir -p .husky

cat > .nvmrc <<'EOF'
22
EOF

# ------------------------------------------------------------
# Root development dependencies
# ------------------------------------------------------------

log "Installing root development dependencies..."

npm install -D \
  prettier \
  husky \
  @commitlint/cli \
  @commitlint/config-conventional

cat > .prettierrc.json <<'EOF'
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
EOF

cat > .prettierignore <<'EOF'
**/node_modules
**/dist
**/coverage
**/package-lock.json
FE/.vite
EOF

cat > commitlint.config.cjs <<'EOF'
module.exports = {
  extends: ['@commitlint/config-conventional'],
};
EOF

cat > .husky/pre-commit <<'EOF'
npm run lint
npm run format:check
EOF

cat > .husky/commit-msg <<'EOF'
./node_modules/.bin/commitlint --edit "$1"
EOF

chmod +x .husky/pre-commit .husky/commit-msg

# ============================================================
# BACKEND
# NestJS 11 + TypeORM + PostgreSQL + Redis
# ============================================================

log "Creating NestJS backend..."

npx --yes @nestjs/cli new BE \
  --package-manager npm \
  --skip-git \
  --strict

cd "$PROJECT_ROOT/BE"

# ------------------------------------------------------------
# Backend dependencies
# ------------------------------------------------------------

log "Installing backend dependencies..."

npm install \
  @nestjs/config@^4 \
  @nestjs/typeorm@^11 \
  typeorm@^0.3 \
  pg \
  ioredis \
  class-validator \
  class-transformer \
  joi \
  @nestjs/jwt@^11 \
  @nestjs/passport@^11 \
  passport \
  passport-jwt \
  argon2 \
  @nestjs/throttler@^6 \
  @nestjs/swagger@^11

npm install -D \
  prettier \
  eslint-config-prettier \
  supertest \
  @types/supertest \
  @types/passport-jwt \
  dotenv \
  ts-node

# ------------------------------------------------------------
# Backend scripts
# ------------------------------------------------------------

npm pkg set 'scripts.start:prod=node dist/main.js'
npm pkg set 'scripts.typecheck=tsc --noEmit'
npm pkg set 'scripts.lint=eslint "{src,test}/**/*.ts"'
npm pkg set 'scripts.lint:fix=eslint "{src,test}/**/*.ts" --fix'
npm pkg set 'scripts.format=prettier --write "src/**/*.ts" "test/**/*.ts"'
npm pkg set 'scripts.format:check=prettier --check "src/**/*.ts" "test/**/*.ts"'
npm pkg set 'scripts.migration:generate=typeorm-ts-node-commonjs migration:generate'
npm pkg set 'scripts.migration:run=typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts'
npm pkg set 'scripts.migration:revert=typeorm-ts-node-commonjs migration:revert -d src/database/data-source.ts'

cat > .prettierignore <<'EOF'
node_modules
dist
coverage
package-lock.json
EOF

mkdir -p \
  src/database/migrations \
  src/identity/auth \
  src/infrastructure/redis \
  src/health

# ------------------------------------------------------------
# Backend bootstrap
# ------------------------------------------------------------

cat > src/main.ts <<'EOF'
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Artium API')
    .setDescription('Artium Phase 1 API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
EOF

# ------------------------------------------------------------
# App module
# ------------------------------------------------------------

cat > src/app.module.ts <<'EOF'
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as Joi from 'joi';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { RedisModule } from './infrastructure/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().default(3001),
        WEB_ORIGIN: Joi.string().default('http://localhost:5173'),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
      }),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
        retryAttempts: 5,
        retryDelay: 3000,
      }),
    }),

    RedisModule,
    IdentityModule,
    HealthModule,
  ],
})
export class AppModule {}
EOF

# ------------------------------------------------------------
# TypeORM DataSource
# ------------------------------------------------------------

cat > src/database/data-source.ts <<'EOF'
import 'dotenv/config';
import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTableName: 'typeorm_migrations',
});

export default dataSource;
EOF

# ------------------------------------------------------------
# Identity foundation
# No User Entity / UsersService / UsersModule
# ------------------------------------------------------------

cat > src/identity/auth/auth.service.ts <<'EOF'
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {}
EOF

cat > src/identity/auth/auth.controller.ts <<'EOF'
import { Controller } from '@nestjs/common';

@Controller('auth')
export class AuthController {}
EOF

cat > src/identity/auth/auth.module.ts <<'EOF'
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
EOF

cat > src/identity/identity.module.ts <<'EOF'
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule],
  exports: [AuthModule],
})
export class IdentityModule {}
EOF

# ------------------------------------------------------------
# Redis infrastructure
# ------------------------------------------------------------

cat > src/infrastructure/redis/redis.constants.ts <<'EOF'
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
EOF

cat > src/infrastructure/redis/redis.module.ts <<'EOF'
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: 3,
          lazyConnect: false,
        }),
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
EOF

cat > src/infrastructure/redis/redis.service.ts <<'EOF'
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  get client(): Redis {
    return this.redis;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
EOF

# ------------------------------------------------------------
# Health check
# ------------------------------------------------------------

cat > src/health/health.controller.ts <<'EOF'
import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    await this.dataSource.query('SELECT 1');

    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
EOF

cat > src/health/health.module.ts <<'EOF'
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
EOF

# ------------------------------------------------------------
# Backend environment
# ------------------------------------------------------------

cat > .env.example <<'EOF'
NODE_ENV=development
PORT=3001
WEB_ORIGIN=http://localhost:5173

DATABASE_URL=postgresql://artium:artium_dev@localhost:5432/artium
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=replace-with-a-random-secret-at-least-32-characters
JWT_REFRESH_SECRET=replace-with-a-different-random-secret-at-least-32-characters
EOF

# ------------------------------------------------------------
# Backend Dockerfile
# ------------------------------------------------------------

cat > Dockerfile <<'EOF'
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 3001

CMD ["node", "dist/main.js"]
EOF

cat > .dockerignore <<'EOF'
node_modules
dist
coverage
.env
.env.*
.git
test
*.log
EOF

# ============================================================
# FRONTEND
# React + TypeScript + Vite + Vitest
# ============================================================

cd "$PROJECT_ROOT"

log "Creating React frontend..."

npm create vite@latest FE -- --template react-ts

cd "$PROJECT_ROOT/FE"

npm install

npm install -D \
  prettier \
  eslint-config-prettier \
  vitest \
  @vitest/coverage-v8 \
  jsdom \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event

# ------------------------------------------------------------
# Frontend scripts
# ------------------------------------------------------------

npm pkg set 'scripts.typecheck=tsc -b --pretty false'
npm pkg set 'scripts.lint=eslint .'
npm pkg set 'scripts.lint:fix=eslint . --fix'
npm pkg set 'scripts.format=prettier --write "src/**/*.{ts,tsx,css}"'
npm pkg set 'scripts.format:check=prettier --check "src/**/*.{ts,tsx,css}"'
npm pkg set 'scripts.test=vitest run'
npm pkg set 'scripts.test:watch=vitest'
npm pkg set 'scripts.test:cov=vitest run --coverage'

# ------------------------------------------------------------
# Vite + Vitest configuration
# ------------------------------------------------------------

cat > vite.config.ts <<'EOF'
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
EOF

mkdir -p src/test src/domains/auth

cat > src/test/setup.ts <<'EOF'
import '@testing-library/jest-dom/vitest';
EOF

cat > src/test/smoke.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';

describe('Frontend test environment', () => {
  it('runs Vitest successfully', () => {
    expect(true).toBe(true);
  });
});
EOF

# ------------------------------------------------------------
# Frontend environment
# ------------------------------------------------------------

cat > .env.example <<'EOF'
VITE_API_URL=/api
EOF

# ------------------------------------------------------------
# Frontend Dockerfile
# ------------------------------------------------------------

cat > Dockerfile <<'EOF'
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

cat > nginx.conf <<'EOF'
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:3001/api/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

cat > .dockerignore <<'EOF'
node_modules
dist
coverage
.env
.env.*
.git
*.log
EOF

# ============================================================
# INFRASTRUCTURE
# ============================================================

cd "$PROJECT_ROOT"

# ------------------------------------------------------------
# Development Docker Compose
# ------------------------------------------------------------

log "Creating Docker Compose configuration..."

cat > docker-compose.yml <<'EOF'
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped

    environment:
      POSTGRES_USER: artium
      POSTGRES_PASSWORD: artium_dev
      POSTGRES_DB: artium

    ports:
      - "5432:5432"

    volumes:
      - postgres_data:/var/lib/postgresql/data

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U artium -d artium"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped

    ports:
      - "6379:6379"

    volumes:
      - redis_data:/data

    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  postgres_data:
  redis_data:
EOF

# ------------------------------------------------------------
# Production Docker Compose
# ------------------------------------------------------------

cat > docker-compose.prod.yml <<'EOF'
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped

    environment:
      POSTGRES_USER: ${POSTGRES_USER:?Set POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:?Set POSTGRES_DB}

    volumes:
      - postgres_data:/var/lib/postgresql/data

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10

    networks:
      - app_network

  redis:
    image: redis:7-alpine
    restart: unless-stopped

    command:
      [
        "redis-server",
        "--appendonly",
        "yes",
        "--requirepass",
        "${REDIS_PASSWORD:?Set REDIS_PASSWORD}"
      ]

    volumes:
      - redis_data:/data

    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a \"$${REDIS_PASSWORD}\" ping | grep -q PONG"]
      interval: 5s
      timeout: 3s
      retries: 10

    networks:
      - app_network

  backend:
    build:
      context: ./BE
      dockerfile: Dockerfile

    restart: unless-stopped

    environment:
      NODE_ENV: production
      PORT: 3001
      WEB_ORIGIN: ${WEB_ORIGIN:-http://localhost}

      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379

      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET:?Set JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?Set JWT_REFRESH_SECRET}

    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
        ]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

    networks:
      - app_network

  frontend:
    build:
      context: ./FE
      dockerfile: Dockerfile
      args:
        VITE_API_URL: /api

    restart: unless-stopped

    ports:
      - "${WEB_PORT:-80}:80"

    depends_on:
      backend:
        condition: service_healthy

    networks:
      - app_network

volumes:
  postgres_data:
  redis_data:

networks:
  app_network:
    driver: bridge
EOF

# ------------------------------------------------------------
# Production environment example
# ------------------------------------------------------------

cat > .env.prod.example <<'EOF'
POSTGRES_USER=artium
POSTGRES_PASSWORD=replace-with-a-long-random-password
POSTGRES_DB=artium

REDIS_PASSWORD=replace-with-another-long-random-password

JWT_ACCESS_SECRET=replace-with-a-random-secret-at-least-32-characters
JWT_REFRESH_SECRET=replace-with-a-different-random-secret-at-least-32-characters

WEB_ORIGIN=https://your-domain.example
WEB_PORT=80
EOF

# ============================================================
# GITHUB ACTIONS
# ============================================================

mkdir -p .github/workflows

cat > .github/workflows/ci.yml <<'EOF'
name: Artium CI

on:
  push:
    branches: [main, develop]

  pull_request:
    branches: [main, develop]

permissions:
  contents: read

jobs:
  backend:
    name: Backend quality

    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: BE

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: BE/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Format check
        run: npm run format:check

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Unit tests
        run: npm run test

      - name: Build
        run: npm run build

  frontend:
    name: Frontend quality

    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: FE

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: FE/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Format check
        run: npm run format:check

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Unit tests
        run: npm run test

      - name: Build
        run: npm run build

  docker:
    name: Docker build validation

    runs-on: ubuntu-latest

    needs:
      - backend
      - frontend

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Build backend image
        run: docker build -t artium-backend:ci ./BE

      - name: Build frontend image
        run: docker build -t artium-frontend:ci ./FE
EOF

# ============================================================
# ROOT GIT CONFIGURATION
# ============================================================

cat > .gitignore <<'EOF'
**/node_modules/
**/dist/
**/coverage/
**/.env
**/.env.local
**/.env.*.local
.env.prod
.DS_Store
*.log
EOF

# ============================================================
# README
# ============================================================

cat > README.md <<'EOF'
# Artium Phase 1

Foundation scaffold for the Artium application.

## Technology stack

### Backend
- NestJS 11
- TypeScript
- TypeORM
- PostgreSQL
- Redis
- Jest
- Supertest

### Frontend
- React
- TypeScript
- Vite
- Vitest
- React Testing Library

### Development tools
- ESLint
- Prettier
- Husky
- Commitlint
- Docker
- Docker Compose
- GitHub Actions

## Requirements

- Node.js 22.12+
- npm
- Git
- Docker Desktop or Docker Engine

## Project structure

```text
.
├── BE/
├── FE/
├── .github/
├── .husky/
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json
└── README.md
```

## Local development

Start PostgreSQL and Redis:

```bash
docker compose up -d
```

Configure the backend:

```bash
cp BE/.env.example BE/.env
```

Configure the frontend:

```bash
cp FE/.env.example FE/.env.local
```

Start the backend:

```bash
cd BE
npm run start:dev
```

Start the frontend in another terminal:

```bash
cd FE
npm run dev
```

## Local URLs

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- API prefix: http://localhost:3001/api
- Health: http://localhost:3001/api/health
- Swagger: http://localhost:3001/api/docs

## Database migrations

Create entities and migrations during implementation.

Generate a migration:

```bash
cd BE

npm run migration:generate -- \
  src/database/migrations/DescribeChange \
  -d src/database/data-source.ts
```

Run migrations:

```bash
npm run migration:run
```

Revert the latest migration:

```bash
npm run migration:revert
```

Never enable TypeORM synchronize in production.

Review generated migrations before applying them.

## Quality commands

Run these commands from the project root:

```bash
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run typecheck
npm run test
npm run build
```

## Production Docker Compose

Create production environment:

```bash
cp .env.prod.example .env.prod
```

Replace all example secrets with strong, unique values.

Start the production stack:

```bash
docker compose \
  --env-file .env.prod \
  -f docker-compose.prod.yml \
  up -d --build
```

PostgreSQL and Redis are not published to host ports in production.

## Phase 1 implementation order

1. Verify infrastructure and health endpoint.
2. Design database schema.
3. Create entities and initial migration.
4. Implement registration and login.
5. Implement access and refresh token lifecycle.
6. Implement logout and token revocation.
7. Add authentication guards and role-based authorization.
8. Implement email OTP.
9. Implement Google authentication.
10. Build authentication screens.
11. Add integration and end-to-end tests.

## Important notes

- No business entities are generated by this scaffold.
- No User Entity, UsersService or UsersModule is generated.
- Auth and Identity are foundation modules only.
- OTP values should use Redis TTL.
- Passwords must be hashed with Argon2.
- Normalize email addresses before persistence and lookup.
- Never commit environment files or production secrets.
- CI validates source code and Docker builds; it does not deploy.
EOF

# ============================================================
# FINAL FORMATTING
# ============================================================

log "Formatting generated source files..."

npx prettier --write 
  "BE/src/**/*.ts" 
  "BE/test/**/*.ts" 
  "FE/src/**/*.{ts,tsx,css}" \
  >/dev/null

# ------------------------------------------------------------
# Finish
# ------------------------------------------------------------

echo
success "Artium Phase 1 scaffold created successfully!"
echo
echo "Project directory:"
echo "  $PROJECT_ROOT"
echo
echo "Next steps:"
echo
echo "  1. Start infrastructure:"
echo "     docker compose up -d"
echo
echo "  2. Configure backend:"
echo "     cp BE/.env.example BE/.env"
echo
echo "  3. Configure frontend:"
echo "     cp FE/.env.example FE/.env.local"
echo
echo "  4. Start backend:"
echo "     cd BE && npm run start:dev"
echo
echo "  5. Start frontend in another terminal:"
echo "     cd FE && npm run dev"
echo
echo "  6. Run quality checks from project root:"
echo "     npm run lint"
echo "     npm run format:check"
echo "     npm run typecheck"
echo "     npm run test"
echo "     npm run build"
echo
echo "No User Entity, UsersService or UsersModule was generated."