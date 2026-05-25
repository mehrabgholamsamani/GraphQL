import type { AppConfig } from "../config.js";
import type { InMemoryStore } from "../database/inMemoryStore.js";
import type { User } from "../domain/types.js";
import { badInput, forbidden, unauthenticated } from "../errors.js";
import { hashPassword, sha256, verifyPassword } from "../security/crypto.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../security/tokens.js";

export interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  user: User;
}

function refreshExpiry(config: AppConfig): Date {
  return new Date(Date.now() + config.REFRESH_TOKEN_TTL_SECONDS * 1000);
}

async function issueTokens(store: InMemoryStore, config: AppConfig, user: User): Promise<AuthPayload> {
  const refreshId = store.id();
  const refreshToken = signRefreshToken(user.id, refreshId, config);

  store.refreshTokens.set(refreshId, {
    id: refreshId,
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: refreshExpiry(config),
    createdAt: store.now()
  });

  return {
    accessToken: signAccessToken(user.id, config),
    refreshToken,
    user
  };
}

export async function register(
  store: InMemoryStore,
  config: AppConfig,
  input: { email: string; password: string; name: string }
): Promise<AuthPayload> {
  if (store.findUserByEmail(input.email)) throw badInput("Email is already registered");

  const user: User = {
    id: store.id(),
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash: await hashPassword(input.password),
    createdAt: store.now()
  };
  store.users.set(user.id, user);

  return issueTokens(store, config, user);
}

export async function login(
  store: InMemoryStore,
  config: AppConfig,
  input: { email: string; password: string }
): Promise<AuthPayload> {
  const user = store.findUserByEmail(input.email);
  if (!user) throw unauthenticated();

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) throw unauthenticated();

  return issueTokens(store, config, user);
}

export async function rotateRefreshToken(store: InMemoryStore, config: AppConfig, refreshToken: string): Promise<AuthPayload> {
  const payload = verifyRefreshToken(refreshToken, config);
  const stored = store.refreshTokens.get(payload.jti);

  if (!stored || stored.tokenHash !== sha256(refreshToken) || stored.expiresAt < store.now()) {
    throw unauthenticated();
  }

  if (stored.revokedAt) {
    throw forbidden();
  }

  stored.revokedAt = store.now();
  const user = store.users.get(stored.userId);
  if (!user) throw unauthenticated();

  const next = await issueTokens(store, config, user);
  const nextPayload = verifyRefreshToken(next.refreshToken, config);
  stored.replacedByTokenId = nextPayload.jti;
  return next;
}

export function logout(store: InMemoryStore, config: AppConfig, refreshToken: string): boolean {
  const payload = verifyRefreshToken(refreshToken, config);
  const stored = store.refreshTokens.get(payload.jti);
  if (!stored || stored.tokenHash !== sha256(refreshToken)) return true;
  stored.revokedAt = store.now();
  return true;
}
