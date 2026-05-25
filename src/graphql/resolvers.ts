import { GraphQLScalarType, Kind } from "graphql";
import { z } from "zod";
import type { RequestContext } from "../context.js";
import type { ApiScope, Document, Tag } from "../domain/types.js";
import { badInput, notFound } from "../errors.js";
import { requireMembership, requireRole, requireScope, requireUser } from "../policies/permissions.js";
import { randomSecret, sha256 } from "../security/crypto.js";
import { login, logout, register, rotateRefreshToken } from "../services/authService.js";
import { writeAudit } from "../services/auditService.js";
import { paginate } from "./pagination.js";

const registerInput = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1).max(100)
});

const nameInput = z.string().min(1).max(120);
const textInput = z.string().min(1).max(20000);

const scopeMap: Record<string, ApiScope> = {
  documents_read: "documents:read",
  documents_write: "documents:write",
  audit_read: "audit:read"
};

function getDocument(ctx: RequestContext, id: string): Document {
  const document = ctx.store.documents.get(id);
  if (!document || document.deletedAt) throw notFound();
  requireMembership(ctx, document.organizationId);
  return document;
}

function upsertTags(ctx: RequestContext, organizationId: string, names: string[]): Tag[] {
  return names.map((rawName) => {
    const name = nameInput.parse(rawName.trim());
    const existing = [...ctx.store.tags.values()].find(
      (tag) => tag.organizationId === organizationId && tag.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return existing;

    const tag = { id: ctx.store.id(), organizationId, name, createdAt: ctx.store.now() };
    ctx.store.tags.set(tag.id, tag);
    return tag;
  });
}

export const resolvers = {
  DateTime: new GraphQLScalarType({
    name: "DateTime",
    serialize(value) {
      return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
    },
    parseValue(value) {
      return new Date(String(value));
    },
    parseLiteral(ast) {
      return ast.kind === Kind.STRING ? new Date(ast.value) : null;
    }
  }),

  Query: {
    me: (_: unknown, __: unknown, ctx: RequestContext) => requireUser(ctx),
    organization: (_: unknown, args: { id: string }, ctx: RequestContext) => {
      const organization = ctx.store.organizations.get(args.id);
      if (!organization) throw notFound();
      requireMembership(ctx, organization.id);
      return organization;
    },
    workspace: (_: unknown, args: { id: string }, ctx: RequestContext) => {
      const workspace = ctx.store.workspaces.get(args.id);
      if (!workspace) throw notFound();
      requireMembership(ctx, workspace.organizationId);
      return workspace;
    },
    documents: (_: unknown, args: { workspaceId: string; first?: number; after?: string }, ctx: RequestContext) => {
      const workspace = ctx.store.workspaces.get(args.workspaceId);
      if (!workspace) throw notFound();
      requireMembership(ctx, workspace.organizationId);
      requireScope(ctx, "documents:read");
      return paginate(ctx.store.documentsForWorkspace(workspace.id), args.first, args.after);
    },
    document: (_: unknown, args: { id: string }, ctx: RequestContext) => {
      requireScope(ctx, "documents:read");
      return getDocument(ctx, args.id);
    },
    comments: (_: unknown, args: { documentId: string }, ctx: RequestContext) => {
      const document = getDocument(ctx, args.documentId);
      requireScope(ctx, "documents:read");
      return ctx.store.commentsForDocument(document.id);
    },
    auditLogs: (_: unknown, args: { organizationId: string; first?: number; after?: string }, ctx: RequestContext) => {
      requireRole(ctx, args.organizationId, "ADMIN");
      requireScope(ctx, "audit:read");
      return paginate(ctx.store.auditLogsForOrganization(args.organizationId), args.first, args.after);
    }
  },

  Mutation: {
    register: async (_: unknown, args: { input: unknown }, ctx: RequestContext) =>
      register(ctx.store, ctx.config, registerInput.parse(args.input)),
    login: async (_: unknown, args: { input: unknown }, ctx: RequestContext) => {
      const input = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(args.input);
      return login(ctx.store, ctx.config, input);
    },
    refreshToken: (_: unknown, args: { refreshToken: string }, ctx: RequestContext) =>
      rotateRefreshToken(ctx.store, ctx.config, args.refreshToken),
    logout: (_: unknown, args: { refreshToken: string }, ctx: RequestContext) =>
      logout(ctx.store, ctx.config, args.refreshToken),
    createOrganization: (_: unknown, args: { input: { name: string } }, ctx: RequestContext) => {
      const user = requireUser(ctx);
      const organization = {
        id: ctx.store.id(),
        name: nameInput.parse(args.input.name),
        createdAt: ctx.store.now()
      };
      ctx.store.organizations.set(organization.id, organization);
      ctx.store.memberships.set(ctx.store.id(), {
        id: ctx.store.id(),
        userId: user.id,
        organizationId: organization.id,
        role: "OWNER",
        createdAt: ctx.store.now()
      });
      writeAudit(ctx, organization.id, "organization.created", "Organization", organization.id);
      return organization;
    },
    createWorkspace: (_: unknown, args: { input: { organizationId: string; name: string } }, ctx: RequestContext) => {
      requireRole(ctx, args.input.organizationId, "ADMIN");
      const workspace = {
        id: ctx.store.id(),
        organizationId: args.input.organizationId,
        name: nameInput.parse(args.input.name),
        createdAt: ctx.store.now()
      };
      ctx.store.workspaces.set(workspace.id, workspace);
      writeAudit(ctx, workspace.organizationId, "workspace.created", "Workspace", workspace.id);
      return workspace;
    },
    createDocument: (_: unknown, args: { input: { workspaceId: string; title: string; body: string; tags: string[] } }, ctx: RequestContext) => {
      const user = requireUser(ctx);
      const workspace = ctx.store.workspaces.get(args.input.workspaceId);
      if (!workspace) throw notFound();
      requireRole(ctx, workspace.organizationId, "EDITOR");
      requireScope(ctx, "documents:write");
      const tags = upsertTags(ctx, workspace.organizationId, args.input.tags ?? []);
      const document = {
        id: ctx.store.id(),
        organizationId: workspace.organizationId,
        workspaceId: workspace.id,
        title: nameInput.parse(args.input.title),
        body: textInput.parse(args.input.body),
        tagIds: tags.map((tag) => tag.id),
        createdById: user.id,
        updatedById: user.id,
        createdAt: ctx.store.now(),
        updatedAt: ctx.store.now()
      };
      ctx.store.documents.set(document.id, document);
      writeAudit(ctx, document.organizationId, "document.created", "Document", document.id);
      return document;
    },
    updateDocument: (_: unknown, args: { input: { id: string; title?: string; body?: string; tags?: string[] } }, ctx: RequestContext) => {
      const user = requireUser(ctx);
      const document = getDocument(ctx, args.input.id);
      requireRole(ctx, document.organizationId, "EDITOR");
      requireScope(ctx, "documents:write");
      if (args.input.title !== undefined) document.title = nameInput.parse(args.input.title);
      if (args.input.body !== undefined) document.body = textInput.parse(args.input.body);
      if (args.input.tags !== undefined) {
        document.tagIds = upsertTags(ctx, document.organizationId, args.input.tags).map((tag) => tag.id);
      }
      document.updatedById = user.id;
      document.updatedAt = ctx.store.now();
      writeAudit(ctx, document.organizationId, "document.updated", "Document", document.id);
      return document;
    },
    deleteDocument: (_: unknown, args: { id: string }, ctx: RequestContext) => {
      const document = getDocument(ctx, args.id);
      requireRole(ctx, document.organizationId, "ADMIN");
      requireScope(ctx, "documents:write");
      document.deletedAt = ctx.store.now();
      writeAudit(ctx, document.organizationId, "document.deleted", "Document", document.id);
      return true;
    },
    addComment: (_: unknown, args: { input: { documentId: string; body: string } }, ctx: RequestContext) => {
      const user = requireUser(ctx);
      const document = getDocument(ctx, args.input.documentId);
      requireRole(ctx, document.organizationId, "EDITOR");
      requireScope(ctx, "documents:write");
      const comment = {
        id: ctx.store.id(),
        organizationId: document.organizationId,
        documentId: document.id,
        body: textInput.parse(args.input.body),
        createdById: user.id,
        createdAt: ctx.store.now()
      };
      ctx.store.comments.set(comment.id, comment);
      writeAudit(ctx, document.organizationId, "comment.created", "Comment", comment.id);
      return comment;
    },
    createApiKey: (_: unknown, args: { input: { organizationId: string; name: string; scopes: string[] } }, ctx: RequestContext) => {
      const user = requireUser(ctx);
      requireRole(ctx, args.input.organizationId, "ADMIN");
      const token = randomSecret("sk_");
      const apiKey = {
        id: ctx.store.id(),
        organizationId: args.input.organizationId,
        name: nameInput.parse(args.input.name),
        keyHash: sha256(token),
        scopes: args.input.scopes.map((scope) => scopeMap[scope]),
        createdById: user.id,
        createdAt: ctx.store.now()
      };
      if (apiKey.scopes.some((scope) => !scope)) throw badInput("Invalid API key scope");
      ctx.store.apiKeys.set(apiKey.id, apiKey);
      writeAudit(ctx, apiKey.organizationId, "api_key.created", "ApiKey", apiKey.id, { scopes: apiKey.scopes });
      return { id: apiKey.id, name: apiKey.name, token, scopes: apiKey.scopes, createdAt: apiKey.createdAt };
    },
    revokeApiKey: (_: unknown, args: { id: string }, ctx: RequestContext) => {
      const apiKey = ctx.store.apiKeys.get(args.id);
      if (!apiKey) throw notFound();
      requireRole(ctx, apiKey.organizationId, "ADMIN");
      apiKey.revokedAt = ctx.store.now();
      writeAudit(ctx, apiKey.organizationId, "api_key.revoked", "ApiKey", apiKey.id);
      return true;
    }
  },

  Organization: {
    workspaces: (organization: { id: string }, _: unknown, ctx: RequestContext) => ctx.store.workspacesForOrganization(organization.id),
    myRole: (organization: { id: string }, _: unknown, ctx: RequestContext) => requireMembership(ctx, organization.id).role
  },
  Document: {
    tags: (document: Document, _: unknown, ctx: RequestContext) => document.tagIds.map((id) => ctx.store.tags.get(id)).filter(Boolean),
    createdBy: (document: Document, _: unknown, ctx: RequestContext) => ctx.loaders.userById.load(document.createdById),
    updatedBy: (document: Document, _: unknown, ctx: RequestContext) => ctx.loaders.userById.load(document.updatedById)
  },
  Comment: {
    createdBy: (comment: { createdById: string }, _: unknown, ctx: RequestContext) => ctx.loaders.userById.load(comment.createdById)
  },
  AuditLog: {
    metadata: (log: { metadata: Record<string, unknown> }) => JSON.stringify(log.metadata)
  }
};
