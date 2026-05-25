# Secure GraphQL Backend

Mini midlevel backend project focused on GraphQL, Express, TypeScript, and security practices.

## Build Steps

1. Foundation: Express server, TypeScript, config validation, health endpoint.
2. GraphQL core: schema, resolvers, context, custom auth-aware errors.
3. Authentication: registration, login, short-lived access tokens, refresh-token rotation, logout.
4. Authorization: organization membership, role checks, object-level access checks.
5. Workspace domain: organizations, workspaces, documents, comments, tags.
6. Security hardening: Helmet, CORS allowlist, login rate limits, max page size, query depth and complexity limits, safe production errors.
7. Auditability: audit logs for sensitive actions and API-key lifecycle events.
8. API keys: hashed tokens, scopes, revocation, machine authentication.
9. Tests: auth flow, tenant isolation, API-key scopes, GraphQL limits.
10. Production extension: replace the in-memory repository with PostgreSQL plus migrations.

## Run

```bash
npm install
npm run dev
```

GraphQL endpoint:

```txt
http://localhost:4000/graphql
```

Health endpoint:

```txt
http://localhost:4000/health
```

## Test

```bash
npm test
```

## Security Features

- Passwords are hashed with Argon2.
- Access and refresh tokens use separate secrets and TTLs.
- Refresh tokens are rotated and reuse is rejected.
- API keys are stored as hashes and can be scoped.
- Every resolver verifies object-level access instead of trusting client IDs.
- Query depth and complexity limits reduce GraphQL abuse risk.
- Pagination has a hard maximum page size.
- Sensitive mutations write audit logs.
- Production error formatting avoids leaking internals.

## Example GraphQL Flow

```graphql
mutation Register {
  register(input: {
    email: "owner@example.com"
    password: "correct horse battery staple"
    name: "Owner"
  }) {
    accessToken
    refreshToken
    user { id email }
  }
}
```

Use the returned access token:

```txt
Authorization: Bearer <accessToken>
```

```graphql
mutation CreateOrg {
  createOrganization(input: { name: "Acme Security" }) {
    id
    name
  }
}
```
