import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import config from "../../configs";
import logger from "../log/logger";

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 10_000,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

const connectWithDatabase = async (): Promise<void> => {
  logger.info("Connecting to PostgreSQL via Prisma...");
  await prisma.$connect();
  logger.info("Connected to PostgreSQL");
};

const disconnectFromDatabase = async (): Promise<void> => {
  logger.info("Disconnecting Prisma/PostgreSQL...");
  await prisma.$disconnect();
  await pool.end();
  logger.info("Disconnected from PostgreSQL");
};

export { prisma, connectWithDatabase, disconnectFromDatabase };
