import { badInput } from "../errors.js";

export interface Connection<T> {
  nodes: T[];
  pageInfo: {
    endCursor?: string;
    hasNextPage: boolean;
  };
}

const maxFirst = 50;

export function encodeCursor(index: number): string {
  return Buffer.from(String(index), "utf8").toString("base64url");
}

export function decodeCursor(cursor?: string): number {
  if (!cursor) return -1;
  const raw = Buffer.from(cursor, "base64url").toString("utf8");
  const value = Number(raw);
  if (!Number.isInteger(value) || value < -1) throw badInput("Invalid pagination cursor");
  return value;
}

export function paginate<T>(items: T[], first = 20, after?: string): Connection<T> {
  if (!Number.isInteger(first) || first < 1) throw badInput("first must be a positive integer");
  const size = Math.min(first, maxFirst);
  const start = decodeCursor(after) + 1;
  const nodes = items.slice(start, start + size);
  const endIndex = start + nodes.length - 1;

  return {
    nodes,
    pageInfo: {
      endCursor: nodes.length ? encodeCursor(endIndex) : undefined,
      hasNextPage: endIndex + 1 < items.length
    }
  };
}
