import type { Request } from "express";
import type { AppConfig } from "./config.js";
import type { InMemoryStore } from "./database/inMemoryStore.js";
import type { ApiKey, User } from "./domain/types.js";
import { createLoaders, type Loaders } from "./graphql/loaders.js";
import { sha256 } from "./security/crypto.js";
import { verifyAccessToken } from "./security/tokens.js";

export interface RequestContext {
  store: InMemoryStore;
  config: AppConfig;
  loaders: Loaders;
  user?: User;
  apiKey?: ApiKey;
  requestId: string;
}

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length).trim();
}

function apiKeyToken(req: Request): string | undefined {
  const header = req.headers["x-api-key"];
  return Array.isArray(header) ? header[0] : header;
}

export function createContextFactory(store: InMemoryStore, config: AppConfig) {
  return async ({ req }: { req: Request }): Promise<RequestContext> => {
    const token = bearerToken(req);
    const key = apiKeyToken(req);
    let user: User | undefined;
    let apiKey: ApiKey | undefined;

    if (token) {
      try {
        const payload = verifyAccessToken(token, config);
        user = store.users.get(payload.sub);
      } catch {
        user = undefined;
      }
    }

    if (!user && key) {
      const keyHash = sha256(key);
      apiKey = [...store.apiKeys.values()].find((candidate) => candidate.keyHash === keyHash && !candidate.revokedAt);
      if (apiKey) apiKey.lastUsedAt = store.now();
    }

    return {
      store,
      config,
      loaders: createLoaders(store),
      user,
      apiKey,
      requestId: req.header("x-request-id") ?? store.id()
    };
  };
}
