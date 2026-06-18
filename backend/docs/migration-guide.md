## Mongo → Postgres Migration Helper

Use this guide when you need to re-home historical MongoDB data into the new PostgreSQL/Prisma stack.

### 1. Export your Mongo collections

```bash
mongoexport --uri="$OLD_MONGODB_URI" --collection=products --out=products.json
mongoexport --uri="$OLD_MONGODB_URI" --collection=customers --out=customers.json
```

Each export should produce a JSON array of documents. The helper is flexible with field names (`description` vs `details`, `price` vs `amount`, etc.).

### 2. Point Prisma at your target database

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cm_boilerplate"
```

### 3. Dry-run the migration script

```bash
npx ts-node scripts/dev/migrate-mongo-to-postgres.ts \
  --products ./products.json \
  --customers ./customers.json \
  --dryRun
```

The dry run logs the normalized payloads without touching the database.

### 4. Import for real

Remove `--dryRun` once you are confident in the mapping:

```bash
npx ts-node scripts/dev/migrate-mongo-to-postgres.ts \
  --products ./products.json \
  --customers ./customers.json
```

Products receive fresh Prisma `cuid`s so downstream APIs continue to validate IDs using the new format. Customers follow the same rule.

### 5. Verify and cleanup

Run `npx prisma studio --config prisma.config.ts` or hit the `/api/v1/products` endpoints to confirm the data landed as expected. Once verified, archive the raw export files securely.

