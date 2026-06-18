# Consistent Minds Boilerplate

Full-stack starter that pairs an Express/Prisma API with a Next.js frontend. Everything ships with TypeScript, sensible lint/test tooling, and docs that explain the moving pieces.

## Repository Layout
- `backend/` – Express API, Prisma schema/migrations, scripts, and operational docs.
- `fe/` – Next.js app with Auth, dashboard shells, and UI primitives.
- `docs/` folders inside each package dig into architecture, domain modeling, and how to extend the stack.

## Requirements
- Node.js 18+ and npm 10+.
- PostgreSQL 16 (local install or Docker).
- Optional: `pnpm`/`nvm` if that matches your workflow.

## Getting Started
1. **Clone** the repo and install dependencies for each package:
   ```bash
   cd backend && npm install
   cd ../fe && npm install
   ```
2. **Configure the database**:
   ```bash
   createdb boilerplate_dev
   createuser --pwprompt boilerplate_app
   ```
   Copy `backend/src/configs/config.example.json` to the environment-specific file you use (e.g. `config.development.json`) and update `DATABASE_URL`, for example:
   ```
   postgresql://boilerplate_app:<password>@localhost:5432/boilerplate_dev
   ```
3. **Run database migrations**:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```
4. **Start the services**:
   ```bash
   # backend
   npm run dev

   # frontend (new shell)
   cd fe
   npm run dev
   ```

## Testing & Tooling
- `cd backend && npm test` – Jest + Supertest coverage for the API.
- `cd backend && npm run lint` – Biome/ESLint configuration via `eslint.config.js`.
- `cd fe && npm run lint` – Next.js lint rules with TypeScript support.

## Documentation
- Backend deep-dives: `backend/docs/` plus per-domain markdown under `backend/src`.
- Frontend notes: `fe/components/` and `fe/app/` include colocation docs and examples.

Contributions are welcome—see `backend/CONTRIBUTING.md` for coding standards and workflows used by the Consistent Minds team.

