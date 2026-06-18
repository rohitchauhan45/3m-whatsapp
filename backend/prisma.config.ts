import "dotenv/config";
import fs from "fs";
import path from "path";
import { defineConfig, env } from "prisma/config";

const prismaFolder = "./prisma";

// Load DATABASE_URL from environment variable or config file and set it in process.env
// This ensures Prisma's env() function can access it
if (!process.env.DATABASE_URL) {
  const environment = process.env.NODE_ENV || "development";
  const configFileName = `config.${environment}.json`;
  const configLookups = [
    path.join(process.cwd(), configFileName),
    path.join(process.cwd(), "src", "configs", configFileName),
  ];
  
  const configFile = configLookups.find((lookupPath) =>
    fs.existsSync(lookupPath),
  );
  
  if (configFile) {
    const config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
    if (config.DATABASE_URL) {
      process.env.DATABASE_URL = config.DATABASE_URL;
    }
  }
}

export default defineConfig({
  schema: `${prismaFolder}/schema.prisma`,
  migrations: {
    path: `${prismaFolder}/migrations`,
    seed: "npx ts-node --compiler-options {\"module\":\"CommonJS\"} scripts/seed-users.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

