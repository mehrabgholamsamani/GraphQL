export type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
export type ApiScope = "documents:read" | "documents:write" | "audit:read";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
  createdAt: Date;
}

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  createdAt: Date;
}

export interface Document {
  id: string;
  organizationId: string;
  workspaceId: string;
  title: string;
  body: string;
  tagIds: string[];
  createdById: string;
  updatedById: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Comment {
  id: string;
  organizationId: string;
  documentId: string;
  body: string;
  createdById: string;
  createdAt: Date;
}

export interface Tag {
  id: string;
  organizationId: string;
  name: string;
  createdAt: Date;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByTokenId?: string;
  createdAt: Date;
}

export interface ApiKey {
  id: string;
  organizationId: string;
  name: string;
  keyHash: string;
  scopes: ApiScope[];
  createdById: string;
  createdAt: Date;
  revokedAt?: Date;
  lastUsedAt?: Date;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  actorUserId?: string;
  actorApiKeyId?: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
