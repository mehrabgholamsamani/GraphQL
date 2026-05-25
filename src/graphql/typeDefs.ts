export const typeDefs = `#graphql
  scalar DateTime

  enum Role {
    OWNER
    ADMIN
    EDITOR
    VIEWER
  }

  enum ApiScope {
    documents_read
    documents_write
    audit_read
  }

  type User {
    id: ID!
    email: String!
    name: String!
    createdAt: DateTime!
  }

  type Organization {
    id: ID!
    name: String!
    createdAt: DateTime!
    workspaces: [Workspace!]!
    myRole: Role!
  }

  type Workspace {
    id: ID!
    organizationId: ID!
    name: String!
    createdAt: DateTime!
  }

  type Document {
    id: ID!
    organizationId: ID!
    workspaceId: ID!
    title: String!
    body: String!
    tags: [Tag!]!
    createdBy: User!
    updatedBy: User!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Comment {
    id: ID!
    documentId: ID!
    body: String!
    createdBy: User!
    createdAt: DateTime!
  }

  type Tag {
    id: ID!
    organizationId: ID!
    name: String!
    createdAt: DateTime!
  }

  type AuditLog {
    id: ID!
    organizationId: ID!
    actorUserId: ID
    actorApiKeyId: ID
    action: String!
    targetType: String!
    targetId: ID!
    metadata: String!
    createdAt: DateTime!
  }

  type ApiKeyCreated {
    id: ID!
    name: String!
    token: String!
    scopes: [String!]!
    createdAt: DateTime!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  type PageInfo {
    endCursor: String
    hasNextPage: Boolean!
  }

  type DocumentConnection {
    nodes: [Document!]!
    pageInfo: PageInfo!
  }

  type AuditLogConnection {
    nodes: [AuditLog!]!
    pageInfo: PageInfo!
  }

  input RegisterInput {
    email: String!
    password: String!
    name: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input CreateOrganizationInput {
    name: String!
  }

  input CreateWorkspaceInput {
    organizationId: ID!
    name: String!
  }

  input CreateDocumentInput {
    workspaceId: ID!
    title: String!
    body: String!
    tags: [String!] = []
  }

  input UpdateDocumentInput {
    id: ID!
    title: String
    body: String
    tags: [String!]
  }

  input AddCommentInput {
    documentId: ID!
    body: String!
  }

  input CreateApiKeyInput {
    organizationId: ID!
    name: String!
    scopes: [ApiScope!]!
  }

  type Query {
    me: User!
    organization(id: ID!): Organization!
    workspace(id: ID!): Workspace!
    documents(workspaceId: ID!, first: Int = 20, after: String): DocumentConnection!
    document(id: ID!): Document!
    comments(documentId: ID!): [Comment!]!
    auditLogs(organizationId: ID!, first: Int = 20, after: String): AuditLogConnection!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    refreshToken(refreshToken: String!): AuthPayload!
    logout(refreshToken: String!): Boolean!
    createOrganization(input: CreateOrganizationInput!): Organization!
    createWorkspace(input: CreateWorkspaceInput!): Workspace!
    createDocument(input: CreateDocumentInput!): Document!
    updateDocument(input: UpdateDocumentInput!): Document!
    deleteDocument(id: ID!): Boolean!
    addComment(input: AddCommentInput!): Comment!
    createApiKey(input: CreateApiKeyInput!): ApiKeyCreated!
    revokeApiKey(id: ID!): Boolean!
  }
`;
