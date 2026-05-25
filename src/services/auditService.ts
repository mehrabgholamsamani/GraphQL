import type { RequestContext } from "../context.js";

export function writeAudit(
  ctx: RequestContext,
  organizationId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {}
) {
  const log = {
    id: ctx.store.id(),
    organizationId,
    actorUserId: ctx.user?.id,
    actorApiKeyId: ctx.apiKey?.id,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: ctx.store.now()
  };

  ctx.store.auditLogs.set(log.id, log);
  return log;
}
