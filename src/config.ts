import "dotenv/config";
import { z } from "zod";

const devAccessSecret = "dev-access-secret-change-before-production";
const devRefreshSecret = "dev-refresh-secret-change-before-production";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_ACCESS_SECRET: z.string().min(24).default(devAccessSecret),
  JWT_REFRESH_SECRET: z.string().min(24).default(devRefreshSecret),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  GRAPHQL_INTROSPECTION: z.coerce.boolean().default(false)
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production") return;

  if (value.JWT_ACCESS_SECRET === devAccessSecret) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_ACCESS_SECRET"],
      message: "JWT_ACCESS_SECRET must be set explicitly in production"
    });
  }

  if (value.JWT_REFRESH_SECRET === devRefreshSecret) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_REFRESH_SECRET"],
      message: "JWT_REFRESH_SECRET must be set explicitly in production"
    });
  }
});

export function parseConfig(env: NodeJS.ProcessEnv) {
  return configSchema.parse(env);
}

export const config = parseConfig(process.env);
export type AppConfig = typeof config;
