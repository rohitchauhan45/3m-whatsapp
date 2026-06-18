import fs from "fs";
import path from "path";
import { parseArgs } from "node:util";
import { PrismaClient, Prisma } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const options = parseArgs({
  options: {
    products: { type: "string" },
    customers: { type: "string" },
    dryRun: { type: "boolean", default: false },
  },
});

const { products, customers, dryRun } = options.values;

if (!products && !customers) {
  console.error(
    "Usage: ts-node scripts/dev/migrate-mongo-to-postgres.ts --products ./products.json --customers ./customers.json"
  );
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL must be set before running the migration helper.");
  process.exit(1);
}

const resolveJson = (filePath: string): any[] => {
  const absolute = path.resolve(filePath);
  const payload = JSON.parse(fs.readFileSync(absolute, "utf-8"));
  return Array.isArray(payload) ? payload : payload.data ?? [];
};

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

const toDecimal = (value: number | string | null | undefined): Prisma.Decimal => {
  const numericValue = typeof value === "string" ? Number(value) : value;
  if (numericValue === undefined || numericValue === null || Number.isNaN(numericValue)) {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(numericValue);
};

const migrateProducts = async (filePath: string): Promise<void> => {
  const records = resolveJson(filePath);
  console.log(`Importing ${records.length} products from ${filePath}`);
  for (const record of records) {
    const data = {
      name: record.name ?? "Untitled product",
      description: record.description ?? record.details ?? null,
      price: toDecimal(record.price ?? record.amount ?? 0),
      inStock: typeof record.inStock === "boolean" ? record.inStock : true,
      createdAt: record.createdAt ? new Date(record.createdAt) : undefined,
      updatedAt: record.updatedAt ? new Date(record.updatedAt) : undefined,
    };
    if (dryRun) {
      console.log("[dry-run] product ->", data);
      continue;
    }
    await prisma.product.create({ data });
  }
};

const migrateCustomers = async (filePath: string): Promise<void> => {
  const records = resolveJson(filePath);
  console.log(`Importing ${records.length} customers from ${filePath}`);
  for (const record of records) {
    const data = {
      name: record.name ?? record.fullName ?? "Unknown customer",
      createdAt: record.createdAt ? new Date(record.createdAt) : undefined,
      updatedAt: record.updatedAt ? new Date(record.updatedAt) : undefined,
    };
    if (dryRun) {
      console.log("[dry-run] customer ->", data);
      continue;
    }
    await prisma.customer.create({ data });
  }
};

async function main(): Promise<void> {
  try {
    if (products) {
      await migrateProducts(products);
    }
    if (customers) {
      await migrateCustomers(customers);
    }
    console.log("Migration helper completed");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main();

