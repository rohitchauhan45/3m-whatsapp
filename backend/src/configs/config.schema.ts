import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .url()
    .refine((url) => url.startsWith("postgresql://"), {
      message: "DATABASE_URL must be a PostgreSQL connection string",
    }),
  RATE: z.number().min(0),
  PORT: z.number().min(1000).default(4000),
  JWT_SECRET: z.string().optional(),
  AUTH_SERVER_URL: z.string().url().optional(),
});

export default schema;
