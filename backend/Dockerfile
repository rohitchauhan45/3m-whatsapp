FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
# Dummy DB URL so `prisma generate` (triggered by postinstall/build scripts) can
# validate its config without needing real connectivity at build time.
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/db
COPY package.json pnpm-lock.yaml .npmrc prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml .npmrc prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL=postgresql://user:pass@localhost:5432/db pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist

EXPOSE 4001
# Supabase's pooled connection (port 6543, PgBouncer transaction mode) hangs on
# Prisma's migration connectivity check, so migrate deploy runs against the
# pooler's session-mode port (5432) while the running app keeps using the
# original pooled DATABASE_URL from .env.
CMD ["sh", "-c", "DATABASE_URL=$(printf '%s' \"$DATABASE_URL\" | sed 's/:6543/:5432/') npx prisma migrate deploy --config prisma.config.ts && node dist/src/start.js"]
