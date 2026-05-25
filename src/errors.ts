import { GraphQLError } from "graphql";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400
  ) {
    super(message);
  }
}

export const unauthenticated = () => new AppError("Authentication required", "UNAUTHENTICATED", 401);
export const forbidden = () => new AppError("You are not allowed to perform this action", "FORBIDDEN", 403);
export const notFound = () => new AppError("Resource not found", "NOT_FOUND", 404);
export const badInput = (message: string) => new AppError(message, "BAD_USER_INPUT", 400);

export function toGraphQLError(error: unknown, production: boolean): GraphQLError {
  if (error instanceof AppError) {
    return new GraphQLError(error.message, {
      extensions: { code: error.code, http: { status: error.statusCode } }
    });
  }

  return new GraphQLError(production ? "Internal server error" : String(error), {
    extensions: { code: "INTERNAL_SERVER_ERROR" }
  });
}
