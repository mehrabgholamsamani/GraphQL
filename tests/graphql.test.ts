import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { config, parseConfig } from "../src/config.js";
import { createStore } from "../src/database/inMemoryStore.js";

async function gql(app: Awaited<ReturnType<typeof createApp>>["app"], query: string, variables?: object, token?: string, apiKey?: string) {
  const req = request(app).post("/graphql").send({ query, variables });
  if (token) req.set("Authorization", `Bearer ${token}`);
  if (apiKey) req.set("x-api-key", apiKey);
  return req;
}

describe("secure GraphQL backend", () => {
  async function seedOwnerWorkspace(runtime: Awaited<ReturnType<typeof createApp>>, email: string) {
    const registered = await gql(
      runtime.app,
      `mutation Register($input: RegisterInput!) {
        register(input: $input) { accessToken }
      }`,
      { input: { email, password: "correct horse battery staple", name: "Owner" } }
    );
    const accessToken = registered.body.data.register.accessToken as string;

    const org = await gql(
      runtime.app,
      `mutation CreateOrg($input: CreateOrganizationInput!) {
        createOrganization(input: $input) { id }
      }`,
      { input: { name: `${email} org` } },
      accessToken
    );
    const organizationId = org.body.data.createOrganization.id as string;

    const workspace = await gql(
      runtime.app,
      `mutation CreateWorkspace($input: CreateWorkspaceInput!) {
        createWorkspace(input: $input) { id }
      }`,
      { input: { organizationId, name: "Security" } },
      accessToken
    );

    return { accessToken, organizationId, workspaceId: workspace.body.data.createWorkspace.id as string };
  }

  it("supports auth, tenancy, documents, API keys, and audit logs", async () => {
    const runtime = await createApp(createStore(), { ...config, NODE_ENV: "test", GRAPHQL_INTROSPECTION: true });

    const registered = await gql(
      runtime.app,
      `mutation Register($input: RegisterInput!) {
        register(input: $input) { accessToken refreshToken user { id email } }
      }`,
      { input: { email: "owner@example.com", password: "correct horse battery staple", name: "Owner" } }
    );
    const accessToken = registered.body.data.register.accessToken;

    const org = await gql(
      runtime.app,
      `mutation CreateOrg($input: CreateOrganizationInput!) {
        createOrganization(input: $input) { id name myRole }
      }`,
      { input: { name: "Acme" } },
      accessToken
    );
    const organizationId = org.body.data.createOrganization.id;

    const workspace = await gql(
      runtime.app,
      `mutation CreateWorkspace($input: CreateWorkspaceInput!) {
        createWorkspace(input: $input) { id name }
      }`,
      { input: { organizationId, name: "Security" } },
      accessToken
    );
    const workspaceId = workspace.body.data.createWorkspace.id;

    const document = await gql(
      runtime.app,
      `mutation CreateDocument($input: CreateDocumentInput!) {
        createDocument(input: $input) { id title tags { name } }
      }`,
      { input: { workspaceId, title: "Threat model", body: "Private content", tags: ["security"] } },
      accessToken
    );
    expect(document.body.data.createDocument.title).toBe("Threat model");

    const apiKey = await gql(
      runtime.app,
      `mutation CreateKey($input: CreateApiKeyInput!) {
        createApiKey(input: $input) { id token scopes }
      }`,
      { input: { organizationId, name: "ci", scopes: ["documents_read", "audit_read"] } },
      accessToken
    );

    const docsViaKey = await gql(
      runtime.app,
      `query Docs($workspaceId: ID!) {
        documents(workspaceId: $workspaceId) { nodes { title } pageInfo { hasNextPage } }
      }`,
      { workspaceId },
      undefined,
      apiKey.body.data.createApiKey.token
    );
    expect(docsViaKey.body.data.documents.nodes).toHaveLength(1);

    const logs = await gql(
      runtime.app,
      `query Audit($organizationId: ID!) {
        auditLogs(organizationId: $organizationId) { nodes { action targetType } }
      }`,
      { organizationId },
      accessToken
    );
    expect(logs.body.data.auditLogs.nodes.map((log: { action: string }) => log.action)).toContain("document.created");

    await runtime.server.stop();
  });

  it("allows scoped API keys to write documents but not manage workspaces", async () => {
    const runtime = await createApp(createStore(), { ...config, NODE_ENV: "test", GRAPHQL_INTROSPECTION: true });
    const seeded = await seedOwnerWorkspace(runtime, "apikey-writer@example.com");

    const apiKey = await gql(
      runtime.app,
      `mutation CreateKey($input: CreateApiKeyInput!) {
        createApiKey(input: $input) { token }
      }`,
      { input: { organizationId: seeded.organizationId, name: "writer", scopes: ["documents_read", "documents_write"] } },
      seeded.accessToken
    );

    const created = await gql(
      runtime.app,
      `mutation CreateDocument($input: CreateDocumentInput!) {
        createDocument(input: $input) { id title createdBy { email } }
      }`,
      { input: { workspaceId: seeded.workspaceId, title: "API written", body: "Created by scoped API key" } },
      undefined,
      apiKey.body.data.createApiKey.token
    );
    expect(created.body.data.createDocument.title).toBe("API written");
    expect(created.body.data.createDocument.createdBy.email).toBe("apikey-writer@example.com");

    const blocked = await gql(
      runtime.app,
      `mutation CreateWorkspace($input: CreateWorkspaceInput!) {
        createWorkspace(input: $input) { id }
      }`,
      { input: { organizationId: seeded.organizationId, name: "Blocked" } },
      undefined,
      apiKey.body.data.createApiKey.token
    );
    expect(blocked.body.errors[0].extensions.code).toBe("UNAUTHENTICATED");

    await runtime.server.stop();
  });

  it("rejects malformed bearer tokens", async () => {
    const runtime = await createApp(createStore(), { ...config, NODE_ENV: "test", GRAPHQL_INTROSPECTION: true });

    const response = await gql(runtime.app, `query { me { id } }`, undefined, "not-a-real-token");

    expect(response.body.errors[0].extensions.code).toBe("UNAUTHENTICATED");
    await runtime.server.stop();
  });

  it("returns BAD_USER_INPUT for validation errors", async () => {
    const runtime = await createApp(createStore(), { ...config, NODE_ENV: "test", GRAPHQL_INTROSPECTION: true });

    const response = await gql(
      runtime.app,
      `mutation Register($input: RegisterInput!) {
        register(input: $input) { user { id } }
      }`,
      { input: { email: "not-an-email", password: "short", name: "" } }
    );

    expect(response.body.errors[0].extensions.code).toBe("BAD_USER_INPUT");
    await runtime.server.stop();
  });

  it("rejects default JWT secrets in production", () => {
    expect(() => parseConfig({ NODE_ENV: "production" })).toThrow();
    expect(() =>
      parseConfig({
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "replace-this-access-secret-in-prod",
        JWT_REFRESH_SECRET: "replace-this-refresh-secret-in-prod"
      })
    ).not.toThrow();
  });

  it("blocks cross-tenant document reads", async () => {
    const runtime = await createApp(createStore(), { ...config, NODE_ENV: "test", GRAPHQL_INTROSPECTION: true });

    async function registerUser(email: string) {
      const response = await gql(
        runtime.app,
        `mutation($input: RegisterInput!) { register(input: $input) { accessToken } }`,
        { input: { email, password: "correct horse battery staple", name: email } }
      );
      return response.body.data.register.accessToken as string;
    }

    const ownerToken = await registerUser("owner2@example.com");
    const strangerToken = await registerUser("stranger@example.com");

    const org = await gql(runtime.app, `mutation($input: CreateOrganizationInput!) { createOrganization(input: $input) { id } }`, {
      input: { name: "Private org" }
    }, ownerToken);
    const organizationId = org.body.data.createOrganization.id;
    const workspace = await gql(runtime.app, `mutation($input: CreateWorkspaceInput!) { createWorkspace(input: $input) { id } }`, {
      input: { organizationId, name: "Private workspace" }
    }, ownerToken);
    const document = await gql(runtime.app, `mutation($input: CreateDocumentInput!) { createDocument(input: $input) { id } }`, {
      input: { workspaceId: workspace.body.data.createWorkspace.id, title: "Secret", body: "Nope" }
    }, ownerToken);

    const blocked = await gql(runtime.app, `query($id: ID!) { document(id: $id) { id title } }`, {
      id: document.body.data.createDocument.id
    }, strangerToken);

    expect(blocked.body.errors[0].extensions.code).toBe("FORBIDDEN");
    await runtime.server.stop();
  });
});
