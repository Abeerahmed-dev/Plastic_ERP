# Sabir Plastic ERP

Production ERP system for Sabir Plastic — plastic bag retailer/wholesaler.

**Stack:** Node.js · Express · TypeScript · PostgreSQL · Knex · React · Vite · Tailwind CSS

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 LTS |
| npm | 10+ |
| PostgreSQL | 15 |
| Docker Desktop | Latest (for dev DB) |

---

## Quick Start

### 1. Copy environment files

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit the `.env` files and set secure passwords and a strong `JWT_SECRET`.

### 2. Start the database

```bash
docker compose up -d
```

PostgreSQL is available at `localhost:5432`.  
pgAdmin UI is available at `http://localhost:5050`.

### 3. Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 4. Run database migrations

```bash
cd backend
npm run migrate:latest
```

### 5. Start development servers

```bash
# Terminal 1 — Backend API (port 3001)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

- API: http://localhost:3001/api/v1/health
- Frontend: http://localhost:5173

---

## Available Scripts

### Backend

| Script | Description |
|---|---|
| `npm run dev` | Start with hot-reload |
| `npm run build` | Compile TypeScript |
| `npm run type-check` | Type-check without emitting |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |
| `npm run migrate:latest` | Run pending migrations |
| `npm run migrate:rollback` | Roll back last migration batch |

### Frontend

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run type-check` | Type-check without emitting |
| `npm run lint` | Run ESLint |

---

## Project Structure

```
Sabir-Plastic-ERP/
├── backend/           Node.js / Express API
│   ├── src/
│   │   ├── config/    env, logger
│   │   ├── db/        Knex singleton, migrations, seeds
│   │   ├── middleware/ error handler, auth (Session 02)
│   │   ├── modules/   feature modules (health, auth, …)
│   │   └── shared/    API response helpers, error classes
│   └── tests/
├── frontend/          React / Vite
│   └── src/
│       ├── services/  axios API client + service files
│       ├── types/     shared TypeScript types
│       ├── pages/     page components (Session 02+)
│       ├── components/ reusable UI components
│       ├── hooks/     custom React hooks
│       └── store/     Zustand stores
└── docs/
    └── SESSION_LOG.md
```

---

## Development Sessions

See [docs/SESSION_LOG.md](docs/SESSION_LOG.md) for a record of all completed sessions and the master session plan.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` |
| `PORT` | API server port (default: 3001) |
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port |
| `DB_NAME` | Database name |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `JWT_SECRET` | Secret for signing JWTs (min 16 chars) |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime (default: 15m) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime (default: 7d) |
| `LOG_LEVEL` | Pino log level (default: info) |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL |
