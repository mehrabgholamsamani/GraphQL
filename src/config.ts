import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_ACCESS_SECRET: z.string().min(24).default("dev-access-secret-change-before-production"),
  JWT_REFRESH_SECRET: z.string().min(24).default("dev-refresh-secret-change-before-production"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  GRAPHQL_INTROSPECTION: z.coerce.boolean().default(false)
});

export const config = configSchema.parse(process.env);
export type AppConfig = typeof config;
