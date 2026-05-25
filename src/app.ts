import http from "node:http";
import { ApolloServer } from "@apollo/server";
import { unwrapResolverError } from "@apollo/server/errors";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express4";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import depthLimit from "graphql-depth-limit";
import helmet from "helmet";
import type { AppConfig } from "./config.js";
import { createContextFactory, type RequestContext } from "./context.js";
import type { InMemoryStore } from "./database/inMemoryStore.js";
import { AppError } from "./errors.js";
import { resolvers } from "./graphql/resolvers.js";
import { typeDefs } from "./graphql/typeDefs.js";
import { fieldCountLimit } from "./security/queryComplexity.js";
import { ZodError } from "zod";

export async function createApp(store: InMemoryStore, config: AppConfig) {
  const app = express();
  const httpServer = http.createServer(app);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: config.NODE_ENV === "production" ? config.CORS_ORIGIN : true,
      credentials: true
    })
  );
  app.use(express.json({ limit: "128kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "secure-graphql-backend" });
  });

  const loginLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false
  });

  const server = new ApolloServer<RequestContext>({
    typeDefs,
    resolvers,
    introspection: config.NODE_ENV !== "production" && config.GRAPHQL_INTROSPECTION,
    validationRules: [depthLimit(8), fieldCountLimit(120)],
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    formatError(formattedError, error) {
      const originalError = unwrapResolverError(error);
      if (originalError instanceof AppError) {
        return {
          message: originalError.message,
          extensions: { code: originalError.code, http: { status: originalError.statusCode } }
        };
      }
      if (originalError instanceof ZodError) {
        return {
          message: "Invalid input",
          extensions: {
            code: "BAD_USER_INPUT",
            issues: originalError.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message
            }))
          }
        };
      }
      if (config.NODE_ENV === "production" && formattedError.extensions?.code === "INTERNAL_SERVER_ERROR") {
        return { message: "Internal server error", extensions: { code: "INTERNAL_SERVER_ERROR" } };
      }
      return formattedError;
    }
  });

  await server.start();

  app.use(
    "/graphql",
    (req, res, next) => {
      const body = req.body as { operationName?: string; query?: string } | undefined;
      const isLogin = body?.operationName === "Login" || body?.query?.includes("login(");
      return isLogin ? loginLimiter(req, res, next) : next();
    },
    expressMiddleware(server, {
      context: createContextFactory(store, config)
    })
  );

  return { app, httpServer, server };
}
