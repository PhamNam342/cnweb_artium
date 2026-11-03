# Artium Project

## Tech Stack

- Backend: NestJS, TypeORM, PostgreSQL, Redis
- Frontend: React, TypeScript, Vite
- Infrastructure: Docker Compose
- Package Manager: npm
- Runtime: Node.js

## Requirements

- Node.js version specified in `.nvmrc`
- npm
- Docker Desktop
- Git

## Installation

### 1. Clone repository

```bash
git clone <REPOSITORY_URL>
cd CNWEB_artium_blockchain
```

### 2. Setup Node.js

```bash
nvm install
nvm use
```

### 3. Install dependencies

```bash
npm run setup
```

### 4. Configure environment variables

Copy the example environment files and configure the values:

```bash
cp .env.example .env
cp be/.env.example be/.env
cp FE/.env.example FE/.env
```

### 5. Start infrastructure

```bash
docker compose up -d
```

### 6. Start development servers

Backend:

```bash
npm run dev:be
```

Frontend:

```bash
npm run dev:fe
```

## Quality Checks

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

## Git Workflow

- `main`: Production branch
- `develop`: Development integration branch
- `feature/*`: Feature development
- `fix/*`: Bug fixes
- `hotfix/*`: Production hotfixes

Always create a feature branch from `develop` before starting new work.