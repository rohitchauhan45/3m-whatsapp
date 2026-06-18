## Runtime Configuration Cheatsheet

- `NODE_ENV`: `development` | `production` | `test`
- `DATABASE_URL`: PostgreSQL connection string consumed by Prisma. Example: `postgresql://postgres:postgres@localhost:5432/cm_boilerplate`
- `RATE`: Custom app-level setting (see domain logic)
- `PORT`: Port Express listens on

Place env-specific overrides in `.env.<environment>` files or the matching `config.<environment>.json`. Environment variables always take precedence.

