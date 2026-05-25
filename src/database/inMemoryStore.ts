import { v4 as uuid } from "uuid";
import type {
  ApiKey,
  AuditLog,
  Comment,
  Document,
  Membership,
  Organization,
  RefreshToken,
  Tag,
  User,
  Workspace
} from "../domain/types.js";

export class InMemoryStore {
  users = new Map<string, User>();
  organizations = new Map<string, Organization>();
  memberships = new Map<string, Membership>();
  workspaces = new Map<string, Workspace>();
  documents = new Map<string, Document>();
  comments = new Map<string, Comment>();
  tags = new Map<string, Tag>();
  refreshTokens = new Map<string, RefreshToken>();
  apiKeys = new Map<string, ApiKey>();
  auditLogs = new Map<string, AuditLog>();

  id(): string {
    return uuid();
  }

  now(): Date {
    return new Date();
  }

  findUserByEmail(email: string): User | undefined {
    return [...this.users.values()].find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  membershipsForUser(userId: string): Membership[] {
    return [...this.memberships.values()].filter((membership) => membership.userId === userId);
  }

  membership(userId: string, organizationId: string): Membership | undefined {
    return [...this.memberships.values()].find(
      (membership) => membership.userId === userId && membership.organizationId === organizationId
    );
  }

  workspacesForOrganization(organizationId: string): Workspace[] {
    return [...this.workspaces.values()].filter((workspace) => workspace.organizationId === organizationId);
  }

  documentsForWorkspace(workspaceId: string): Document[] {
    return [...this.documents.values()].filter((document) => document.workspaceId === workspaceId && !document.deletedAt);
  }

  commentsForDocument(documentId: string): Comment[] {
    return [...this.comments.values()].filter((comment) => comment.documentId === documentId);
  }

  auditLogsForOrganization(organizationId: string): AuditLog[] {
    return [...this.auditLogs.values()]
      .filter((log) => log.organizationId === organizationId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
}

export function createStore(): InMemoryStore {
  return new InMemoryStore();
}
