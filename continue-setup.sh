#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# Artium - Continue Setup
# Complete the existing project scaffold without recreating it.
#
# Project structure:
#   be/   - NestJS backend
#   FE/   - React + Vite frontend
#
# Usage:
#   chmod +x continue-setup.sh
#   ./continue-setup.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

cd "$PROJECT_ROOT"

# ------------------------------------------------------------
# 1. Helpers
# ------------------------------------------------------------

info() {
  printf '\n\033[1;34m[INFO]\033[0m %s\n' "$1"
}

success() {
  printf '\033[1;32m[OK]\033[0m %s\n' "$1"
}

warning() {
  printf '\033[1;33m[WARN]\033[0m %s\n' "$1"
}

error() {
  printf '\033[1;31m[ERROR]\033[0m %s\n' "$1"
}

fail() {
  error "$1"
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

backup_once() {
  local target="$1"

  if [[ -f "$target" && ! -f "${target}.continue-setup.bak" ]]; then
    cp "$target" "${target}.continue-setup.bak"
    info "Backup created: ${target}.continue-setup.bak"
  fi
}

write_file() {
  local target="$1"
  local content="$2"

  mkdir -p "$(dirname "$target")"

  backup_once "$target"

  printf '%s\n' "$content" > "$target"

  success "Created/updated: $target"
}

# ------------------------------------------------------------
# 2. Preflight checks
# ------------------------------------------------------------

info "Checking project structure..."

[[ -f "$PROJECT_ROOT/package.json" ]] \
  || fail "Root package.json not found."

[[ -f "$PROJECT_ROOT/be/package.json" ]] \
  || fail "be/package.json not found."

[[ -f "$PROJECT_ROOT/FE/package.json" ]] \
  || fail "FE/package.json not found."

command_exists node || fail "Node.js is not installed."
command_exists npm || fail "npm is not installed."

NODE_VERSION="$(node -p "process.versions.node")"

success "Node.js version: $NODE_VERSION"

node -e '
const [major, minor] = process.versions.node.split(".").map(Number);

if (
  major < 20 ||
  (major === 20 && minor < 19) ||
  (major === 22 && minor < 12)
) {
  console.error("Node.js 20.19+ or 22.12+ is required.");
  process.exit(1);
}
' || fail "Your Node.js version is not supported by the current Vite toolchain."

info "Project structure verified."

# ------------------------------------------------------------
# 3. Root package scripts
# ------------------------------------------------------------

info "Configuring root package scripts..."

npm pkg set \
  'scripts.prepare=husky' \
  'scripts.dev:be=npm --prefix be run start:dev' \
  'scripts.dev:fe=npm --prefix FE run dev' \
  'scripts.lint=npm --prefix be run lint && npm --prefix FE run lint' \
  'scripts.lint:fix=npm --prefix be run lint:fix && npm --prefix FE run lint:fix' \
  'scripts.format=prettier --write "be/src/**/*.ts" "be/test/**/*.ts" "FE/src/**/*.{ts,tsx,css}"' \
  'scripts.format:check=prettier --check "be/src/**/*.ts" "be/test/**/*.ts" "FE/src/**/*.{ts,tsx,css}"' \
  'scripts.typecheck=npm --prefix be run typecheck && npm --prefix FE run typecheck' \
  'scripts.test=npm --prefix be run test && npm --prefix FE run test' \
  'scripts.test:coverage=npm --prefix be run test:cov && npm --prefix FE run test:coverage' \
  'scripts.build=npm --prefix be run build && npm --prefix FE run build'

success "Root package scripts configured."

# ------------------------------------------------------------
# 4. Root .gitignore
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/.gitignore" '
# Dependencies
node_modules/
**/node_modules/

# Build outputs
dist/
build/
coverage/
.nest/
.next/
out/

# Environment files
.env
.env.*
!.env.example
!.env.*.example

# Logs
*.log
logs/

# Operating system
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json

# Testing
.nyc_output/
test-results/
playwright-report/

# Temporary files
*.tmp
*.swp
*.bak
*.continue-setup.bak

# Local databases and volumes
*.sqlite
*.db
'

# ------------------------------------------------------------
# 5. Prettier configuration
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/.prettierrc.json" '
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
'

write_file "$PROJECT_ROOT/.prettierignore" '
node_modules
dist
build
coverage
package-lock.json
*.min.js
*.min.css
'

# ------------------------------------------------------------
# 6. Frontend testing dependencies
# ------------------------------------------------------------

info "Installing frontend testing dependencies..."

(
  cd "$PROJECT_ROOT/FE"

  npm install --save-dev \
    vitest@^4 \
    @vitest/coverage-v8@^4 \
    jsdom \
    @testing-library/react \
    @testing-library/jest-dom \
    @testing-library/user-event

  npm pkg set \
    'scripts.typecheck=tsc -b --pretty false' \
    'scripts.test=vitest run' \
    'scripts.test:watch=vitest' \
    'scripts.test:coverage=vitest run --coverage'
)

success "Frontend testing dependencies installed."

# ------------------------------------------------------------
# 7. Frontend Vitest configuration
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/FE/vite.config.ts" '
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.d.ts",
        "**/*.config.*",
      ],
    },
  },
});
'

write_file "$PROJECT_ROOT/FE/src/test/setup.ts" '
import "@testing-library/jest-dom/vitest";
'

write_file "$PROJECT_ROOT/FE/src/test/smoke.test.ts" '
import { describe, expect, it } from "vitest";

describe("Frontend test environment", () => {
  it("should run Vitest successfully", () => {
    expect(true).toBe(true);
  });
});
'

success "Frontend test configuration created."

# ------------------------------------------------------------
# 8. Frontend environment example
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/FE/.env.example" '
VITE_API_BASE_URL=http://localhost:3000/api
'

# ------------------------------------------------------------
# 9. Husky and Commitlint
# ------------------------------------------------------------

info "Configuring Husky and Commitlint..."

if [[ ! -f "$PROJECT_ROOT/commitlint.config.cjs" ]]; then
  write_file "$PROJECT_ROOT/commitlint.config.cjs" '
module.exports = {
  extends: ["@commitlint/config-conventional"],
};
'
fi

mkdir -p "$PROJECT_ROOT/.husky"

write_file "$PROJECT_ROOT/.husky/pre-commit" '
#!/usr/bin/env sh

npm run lint
npm run typecheck
'

write_file "$PROJECT_ROOT/.husky/commit-msg" '
#!/usr/bin/env sh

npx --no -- commitlint --edit "$1"
'

chmod +x \
  "$PROJECT_ROOT/.husky/pre-commit" \
  "$PROJECT_ROOT/.husky/commit-msg"

npx husky

success "Husky and Commitlint configured."

# ------------------------------------------------------------
# 10. Frontend Dockerfile
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/FE/Dockerfile" '
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

FROM nginx:alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
'

# ------------------------------------------------------------
# 11. Frontend Nginx configuration
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/FE/nginx.conf" '
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:3000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
'

# ------------------------------------------------------------
# 12. Frontend Docker ignore
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/FE/.dockerignore" '
node_modules
dist
coverage
.env
.env.*
!.env.example
.git
.DS_Store
'

# ------------------------------------------------------------
# 13. Root environment example
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/.env.example" '
POSTGRES_DB=artium_db
POSTGRES_USER=artium
POSTGRES_PASSWORD=change_me_to_a_strong_password

POSTGRES_PORT=5432
REDIS_PORT=6379
'

# ------------------------------------------------------------
# 14. Development Docker Compose
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/docker-compose.yml" '
services:
  postgres:
    image: postgres:16-alpine
    container_name: artium_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-artium_db}
      POSTGRES_USER: ${POSTGRES_USER:-artium}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-change_me}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-artium} -d ${POSTGRES_DB:-artium_db}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: artium_redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
'

# ------------------------------------------------------------
# 15. Production environment example
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/.env.prod.example" '
POSTGRES_DB=artium_db
POSTGRES_USER=artium
POSTGRES_PASSWORD=replace_with_a_strong_password

POSTGRES_PORT=5432
REDIS_PORT=6379

BACKEND_PORT=3000
FRONTEND_PORT=80
'

# ------------------------------------------------------------
# 16. Production Docker Compose
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/docker-compose.prod.yml" '
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-artium_db}
      POSTGRES_USER: ${POSTGRES_USER:-artium}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-artium} -d ${POSTGRES_DB:-artium_db}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - artium_network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - artium_network

  backend:
    build:
      context: ./be
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - ./be/.env
    environment:
      NODE_ENV: production
      PORT: 3000
    expose:
      - "3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - artium_network

  frontend:
    build:
      context: ./FE
      dockerfile: Dockerfile
      args:
        VITE_API_BASE_URL: /api
    restart: unless-stopped
    ports:
      - "${FRONTEND_PORT:-80}:80"
    depends_on:
      - backend
    networks:
      - artium_network

volumes:
  postgres_data:
  redis_data:

networks:
  artium_network:
    driver: bridge
'

# ------------------------------------------------------------
# 17. Backend Docker ignore
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/be/.dockerignore" '
node_modules
dist
coverage
.env
.env.*
!.env.example
.git
.DS_Store
'

# ------------------------------------------------------------
# 18. GitHub Actions CI
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/.github/workflows/ci.yml" '
name: CI

on:
  push:
    branches:
      - main
      - develop
      - "feature/**"
      - "release/**"
      - "hotfix/**"

  pull_request:
    branches:
      - main
      - develop

jobs:
  quality:
    name: Lint, Typecheck, Test and Build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: |
            package-lock.json
            be/package-lock.json
            FE/package-lock.json

      - name: Install root dependencies
        run: npm ci

      - name: Install backend dependencies
        run: npm ci
        working-directory: be

      - name: Install frontend dependencies
        run: npm ci
        working-directory: FE

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format:check

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm run test

      - name: Build
        run: npm run build
'

# ------------------------------------------------------------
# 19. GitHub Actions CD
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/.github/workflows/cd.yml" '
name: CD - Build and Publish Images

on:
  push:
    tags:
      - "v*"

  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  publish:
    name: Build and Publish Docker Images
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set lowercase image namespace
        id: image
        run: |
          echo "namespace=ghcr.io/${GITHUB_REPOSITORY,,}" >> "$GITHUB_OUTPUT"

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push backend
        uses: docker/build-push-action@v6
        with:
          context: ./be
          file: ./be/Dockerfile
          push: true
          tags: |
            ${{ steps.image.outputs.namespace }}-backend:latest
            ${{ steps.image.outputs.namespace }}-backend:${{ github.sha }}

      - name: Build and push frontend
        uses: docker/build-push-action@v6
        with:
          context: ./FE
          file: ./FE/Dockerfile
          push: true
          tags: |
            ${{ steps.image.outputs.namespace }}-frontend:latest
            ${{ steps.image.outputs.namespace }}-frontend:${{ github.sha }}
'

# ------------------------------------------------------------
# 20. Git workflow documentation
# ------------------------------------------------------------

write_file "$PROJECT_ROOT/docs/GIT_WORKFLOW.md" '
# Git Workflow

This project follows a simplified GitFlow workflow.

## Main branches

- `main`: production-ready code.
- `develop`: integration branch for upcoming features.

## Supporting branches

- `feature/<name>`: new features.
- `release/<version>`: release preparation.
- `hotfix/<name>`: urgent production fixes.

## Feature workflow

1. Create a feature branch from `develop`.
2. Implement the feature.
3. Run lint, typecheck, test and build.
4. Push the branch.
5. Open a Pull Request into `develop`.
6. Review and merge.

Example:

```bash
git switch develop
git pull origin develop
git switch -c feature/user-authentication
```

## Release workflow

1. Create a release branch from `develop`.
2. Update version and release notes.
3. Run the full quality checks.
4. Open a Pull Request into `main`.
5. Merge and tag the release.
6. Merge release changes back into `develop`.

## Commit convention

Use Conventional Commits.

Examples:

- `feat: add authentication`
- `fix: handle invalid token`
- `docs: update API documentation`
- `refactor: simplify user service`
- `test: add authentication tests`
- `chore: configure CI pipeline`
'
 
# ------------------------------------------------------------
# 21. Install root dependencies
# ------------------------------------------------------------

info "Installing root dependencies..."

npm install

success "Root dependencies installed."

# ------------------------------------------------------------
# 22. Validate required files
# ------------------------------------------------------------

info "Checking generated files..."

REQUIRED_FILES=(
  ".gitignore"
  ".prettierrc.json"
  ".prettierignore"
  "docker-compose.yml"
  "docker-compose.prod.yml"
  ".env.example"
  ".env.prod.example"
  "FE/Dockerfile"
  "FE/nginx.conf"
  "FE/vite.config.ts"
  "FE/src/test/setup.ts"
  "FE/src/test/smoke.test.ts"
  "be/.dockerignore"
  ".github/workflows/ci.yml"
  ".github/workflows/cd.yml"
  "docs/GIT_WORKFLOW.md"
  ".husky/pre-commit"
  ".husky/commit-msg"
)

for file in "${REQUIRED_FILES[@]}"; do
  [[ -f "$PROJECT_ROOT/$file" ]] || fail "Required file missing: $file"
done

success "All required files exist."

# ------------------------------------------------------------
# 23. Final summary
# ------------------------------------------------------------

printf '\n'
printf '\033[1;32m'
printf '============================================================\n'
printf '             ARTIUM CONTINUE SETUP COMPLETED                \n'
printf '============================================================\n'
printf '\033[0m'

printf '\nProject root: %s\n' "$PROJECT_ROOT"

printf '\nAvailable root commands:\n'
printf '  npm run dev:be\n'
printf '  npm run dev:fe\n'
printf '  npm run lint\n'
printf '  npm run lint:fix\n'
printf '  npm run format\n'
printf '  npm run format:check\n'
printf '  npm run typecheck\n'
printf '  npm run test\n'
printf '  npm run test:coverage\n'
printf '  npm run build\n'

printf '\nDocker commands:\n'
printf '  docker compose up -d\n'
printf '  docker compose down\n'
printf '  docker compose -f docker-compose.prod.yml up -d --build\n'

printf '\nNext steps:\n'
printf '  1. Review generated configuration files.\n'
printf '  2. Run quality checks.\n'
printf '  3. Configure environment variables.\n'
printf '  4. Initialize the first Git commit.\n'
printf '\n'

success "Setup script finished."
