import path from "node:path";
import { createFileStore } from "./file-store";
import { SplitlineError } from "./model";
import { createSupabaseStore } from "./supabase-store";
import type { Store } from "./types";

export { createFileStore } from "./file-store";
export { SplitlineError } from "./model";
export { createSupabaseStore } from "./supabase-store";
export type { Store } from "./types";
export type {
  Comparison,
  EdgeSyncState,
  Experiment,
  ExperimentInput,
  ExperimentResults,
  IngestInput,
  Organization,
  PublicApiKey,
  StoredEvent,
  Teammate,
  Usage,
  Variant,
  VariantInput,
  VariantStats,
} from "./types";

const globalForStore = globalThis as { __splitlineStore?: Store };

export function createStoreFromEnv(): Store {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return createSupabaseStore({ url, serviceRoleKey: key });
  const file = process.env.SPLITLINE_DATA_PATH ?? path.join(process.cwd(), "data", "splitline.json");
  return createFileStore(file);
}

export function getStore(): Store {
  if (!globalForStore.__splitlineStore) globalForStore.__splitlineStore = createStoreFromEnv();
  return globalForStore.__splitlineStore;
}

export function storeKind(): Store["kind"] {
  return getStore().kind;
}

export { SplitlineError as StoreError };
