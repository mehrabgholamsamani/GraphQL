import DataLoader from "dataloader";
import type { InMemoryStore } from "../database/inMemoryStore.js";

export function createLoaders(store: InMemoryStore) {
  return {
    userById: new DataLoader(async (ids: readonly string[]) => ids.map((id) => store.users.get(id))),
    organizationById: new DataLoader(async (ids: readonly string[]) => ids.map((id) => store.organizations.get(id))),
    workspaceById: new DataLoader(async (ids: readonly string[]) => ids.map((id) => store.workspaces.get(id)))
  };
}

export type Loaders = ReturnType<typeof createLoaders>;
