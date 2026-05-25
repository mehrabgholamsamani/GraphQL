import type { ApiScope, Membership, Role } from "../domain/types.js";
import { forbidden, unauthenticated } from "../errors.js";
import type { RequestContext } from "../context.js";

const roleRank: Record<Role, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4
};

export function requireActor(ctx: RequestContext): void {
  if (!ctx.user && !ctx.apiKey) throw unauthenticated();
}

export function requireUser(ctx: RequestContext): NonNullable<RequestContext["user"]> {
  if (!ctx.user) throw unauthenticated();
  return ctx.user;
}

export function requireMembership(ctx: RequestContext, organizationId: string): Membership {
  requireActor(ctx);

  if (ctx.user) {
    const membership = ctx.store.membership(ctx.user.id, organizationId);
    if (!membership) throw forbidden();
    return membership;
  }

  if (ctx.apiKey?.organizationId === organizationId) {
    return {
      id: "api-key-membership",
      userId: ctx.apiKey.createdById,
      organizationId,
      role: "VIEWER",
      createdAt: ctx.apiKey.createdAt
    };
  }

  throw forbidden();
}

export function requireRole(ctx: RequestContext, organizationId: string, minimumRole: Role): Membership {
  const membership = requireMembership(ctx, organizationId);
  if (roleRank[membership.role] < roleRank[minimumRole]) throw forbidden();
  return membership;
}

export function requireScope(ctx: RequestContext, scope: ApiScope): void {
  if (!ctx.apiKey) return;
  if (!ctx.apiKey.scopes.includes(scope)) throw forbidden();
}
