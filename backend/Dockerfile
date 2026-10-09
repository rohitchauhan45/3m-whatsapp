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

EXPOSE 4000
# migrate deploy uses DATABASE_URL from compose (postgres:5432 on the Docker network).
CMD ["sh", "-c", "npx prisma migrate deploy --config prisma.config.ts && node dist/src/start.js"]
