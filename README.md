# Sabir Plastic ERP

Production ERP & POS system for **Sabir Plastic** — plastic bag manufacturing, wholesale, and retail distribution.

**Stack:** Node.js · Express · TypeScript · PostgreSQL 15 · Knex · React 19 · Vite · Tailwind CSS · Docker

---

## 🏗️ Architecture Overview

Sabir Plastic ERP supports two flexible operating modes:

1. **🚀 Complete Monolith Mode (Recommended / Production / Factory LAN)**:
   * The Node.js Express backend serves **both** the compiled React Single Page Application (SPA) and the REST API from **a single port (`http://localhost:3001`)**.
   * **Benefits:** Zero CORS overhead, single-process execution, easy LAN deployment across warehouse tablets and counter PCs, and minimal server hosting costs.

2. **⚡ Decoupled Development Mode (Vite Hot-Reload)**:
   * Run the Vite dev server on port `5173` and Express API on port `3001` with instant Hot Module Replacement (HMR) for active UI development.

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | 20 LTS or 22+ | Runtime environment |
| **npm** | 10+ | Package manager |
| **Docker Desktop** | Latest | Runs isolated PostgreSQL 15 & pgAdmin 4 |

---

## Quick Start (Monolith in 5 Steps)

### 1. Copy Environment Files
```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
*(On Windows PowerShell, use `Copy-Item .env.example .env`, etc.)*

### 2. Start Database & pgAdmin (Docker)
*(Ensure Docker Desktop is open and running)*
```bash
docker compose up -d
```
* **PostgreSQL:** Running on port `5433` (or `5432` as configured in `.env`).
* **pgAdmin Web Console:** Available at `http://localhost:5050` (`admin@sabir.local` / `change_me_in_production`).

### 3. Install Dependencies (From Root)
```bash
npm run install:all
```
*(Or install separately: `cd backend && npm install`, then `cd ../frontend && npm install`)*

### 4. Run Database Migrations & Seeds (From Root)
```bash
npm run migrate:latest
npm run seed:run
```

### 5. Build & Launch Monolith (Single Port 3001)
```bash
# Build frontend bundle
npm run build:frontend

# Start the unified server
npm start
```

🎉 **Access the entire application at:** **[http://localhost:3001](http://localhost:3001)**

---

## Default Login Credentials (From Seed Data)

| Role | Email | Password | Access Level |
|---|---|---|---|
| **Owner (Admin)** | `owner@sabir.local` | `Admin@1234` | Full access to POS, Invoices, Customers, Purchases, Inventory, Reports & Settings |

---

## Available Root Scripts

Run all commands directly from the project root:

| Command | Description |
|---|---|
| `npm run install:all` | Install all dependencies for both backend and frontend in one step |
| `npm start` | Start the monolithic server (serves frontend & API on port 3001) |
| `npm run start:prod` | Build both applications and run production Node server |
| `npm run build` | Compile both backend (`tsc`) and frontend (`vite build`) |
| `npm run build:frontend` | Compile React SPA into `frontend/dist` |
| `npm run build:backend` | Compile TypeScript backend into `backend/dist` |
| `npm run dev:frontend` | Start standalone Vite dev server with HMR on port 5173 |
| `npm run dev:backend` | Start standalone backend API with hot-reload on port 3001 |
| `npm run type-check` | Run TypeScript type checks across backend & frontend |
| `npm run lint` | Run ESLint checks across backend & frontend |
| `npm run lint:fix` | Automatically fix ESLint issues across the workspace |
| `npm run test:backend` | Run Jest unit & integration tests |
| `npm run migrate:latest` | Run pending Knex database migrations |
| `npm run seed:run` | Seed default roles, permissions, UOMs, and Owner user |
| `npm run db:clean` | Reset and re-seed transactional database tables |

---

## Project Structure

```text
Sabir-Plastic-ERP/
├── docker-compose.yml     # PostgreSQL 15 & pgAdmin container orchestration
├── package.json           # Root monorepo workspace scripts
├── .env.example           # Root Docker & PostgreSQL env template
│
├── backend/               # Node.js / Express / TypeScript REST API
│   ├── src/
│   │   ├── config/        # Environment validation (Zod), Pino logger
│   │   ├── db/            # Knex connection, migrations (60+), seeders
│   │   ├── middleware/    # Rate limiter, errorHandler, JWT & RBAC auth
│   │   ├── modules/       # 26 domain modules (pos, invoices, customers, inventory, pdcs, etc.)
│   │   ├── app.ts         # Express app, unified v1Router & static frontend SPA serving
│   │   └── server.ts      # HTTP server entrypoint
│   └── tests/             # Unit and integration test suites
│
├── frontend/              # React 19 / Vite / Tailwind SPA
│   ├── src/
│   │   ├── components/    # Reusable UI components & modals
│   │   ├── pages/         # 25+ application pages (POS, Invoices, Customers, Reports)
│   │   ├── services/      # Axios API client with automatic JWT refresh mutex
│   │   ├── store/         # Zustand stores (auth, products, theme, reports)
│   │   ├── types/         # TypeScript DTOs & domain models
│   │   └── utils/         # Thermal receipt printing (ESC/POS 80mm), bilingual helpers
│   └── dist/              # Production compiled bundle served by the monolith
│
└── docs/                  # Architecture specs, session logs, and API testing guides
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `3001` | Unified Monolith server port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5433` | PostgreSQL port |
| `DB_NAME` | `sabir_plastic_erp` | Database name |
| `DB_USER` | `erp_user` | Database user |
| `DB_PASSWORD` | `change_me_in_production` | Database password |
| `JWT_SECRET` | *(Secret min 16 chars)* | Signing secret for authentication tokens |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Lifetime of JWT access token |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Lifetime of refresh token |
| `LOG_LEVEL` | `debug` | Pino logger verbosity |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3001/api/v1` | Backend API base URL |
