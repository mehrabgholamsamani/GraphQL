import jwt from "jsonwebtoken";
import type { AppConfig } from "../config.js";

export interface AccessTokenPayload {
  sub: string;
  typ: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  typ: "refresh";
}

export function signAccessToken(userId: string, config: AppConfig): string {
  return jwt.sign({ sub: userId, typ: "access" } satisfies AccessTokenPayload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.ACCESS_TOKEN_TTL_SECONDS
  });
}

export function signRefreshToken(userId: string, tokenId: string, config: AppConfig): string {
  return jwt.sign({ sub: userId, jti: tokenId, typ: "refresh" } satisfies RefreshTokenPayload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.REFRESH_TOKEN_TTL_SECONDS
  });
}

export function verifyAccessToken(token: string, config: AppConfig): AccessTokenPayload {
  const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessTokenPayload;
  if (payload.typ !== "access") throw new Error("Invalid token type");
  return payload;
}

export function verifyRefreshToken(token: string, config: AppConfig): RefreshTokenPayload {
  const payload = jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  if (payload.typ !== "refresh") throw new Error("Invalid token type");
  return payload;
}
