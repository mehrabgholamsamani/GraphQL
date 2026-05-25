import { GraphQLError, type ValidationContext } from "graphql";

export function fieldCountLimit(maxFields: number) {
  return (context: ValidationContext) => {
    let fields = 0;

    return {
      Field() {
        fields += 1;
        if (fields > maxFields) {
          context.reportError(
            new GraphQLError(`GraphQL operation exceeds field complexity limit of ${maxFields}`, {
              extensions: { code: "GRAPHQL_COMPLEXITY_LIMIT" }
            })
          );
        }
      }
    };
  };
}
