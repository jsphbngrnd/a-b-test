import type { EdgeConfig, ExperimentStatus, PlanId, VariantPayload } from "@splitline/core";

export type Variant = {
  id: string;
  key: string;
  name: string;
  weight: number;
  sanityDocumentId: string;
  payload: VariantPayload;
};

export type Experiment = {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  group: string | null;
  trafficAllocation: number;
  goalEventName: string;
  startedAt: string | null;
  endedAt: string | null;
  winnerVariantId: string | null;
  variants: Variant[];
  createdAt: string;
  updatedAt: string;
};

export type Organization = {
  id: string;
  name: string;
  plan: PlanId;
  sanityProjectId: string;
  vercelProjectId: string;
};

export type Rollup = {
  experimentId: string;
  variantId: string;
  date: string;
  exposures: number;
  conversions: number;
};

export type StoredEvent = {
  id: string;
  orgId: string;
  experimentId: string;
  variantId: string;
  visitorId: string;
  eventType: "exposure" | "conversion" | "custom";
  eventName: string;
  occurredAt: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type ApiKeyRecord = {
  id: string;
  orgId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
};

export type PublicApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
};

export type Teammate = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "invited";
};

export type EdgeSyncState = {
  at: string;
  ok: boolean;
  detail: string;
};

export type VariantInput = {
  key: string;
  name: string;
  weight: number;
  sanityDocumentId: string;
  payload: VariantPayload;
};

export type ExperimentInput = {
  name: string;
  key: string;
  description: string;
  group: string | null;
  trafficAllocation: number;
  goalEventName: string;
  variants: VariantInput[];
};

export type IngestInput = {
  experimentKey: string;
  variantKey: string;
  visitorId: string;
  eventType: StoredEvent["eventType"];
  eventName: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type IngestResult = {
  accepted: boolean;
  duplicate: boolean;
  reason: string;
};

export type DailyPoint = {
  date: string;
  exposures: number;
  conversions: number;
};

export type VariantStats = {
  variantId: string;
  variantKey: string;
  name: string;
  exposures: number;
  conversions: number;
  conversionRate: number;
  daily: DailyPoint[];
};

export type Comparison = {
  variantId: string;
  variantKey: string;
  z: number;
  pValue: number;
  absoluteLift: number;
  relativeLift: number | null;
  confidenceInterval: [number, number];
  significantFixed: boolean;
  sequentialBoundary: number;
  informationFraction: number;
  call: "winner" | "behind" | "keep-testing";
  requiredPerVariant: number;
  insufficient: boolean;
};

export type ExperimentResults = {
  goalEventName: string;
  controlKey: string;
  variants: VariantStats[];
  comparisons: Comparison[];
};

export type Usage = {
  month: string;
  events: number;
  limit: number;
  plan: PlanId;
};

export type State = {
  version: 1;
  org: Organization;
  experiments: Experiment[];
  rollups: Rollup[];
  events: StoredEvent[];
  dedupe: string[];
  apiKeys: ApiKeyRecord[];
  teammates: Teammate[];
  usageMonth: string;
  eventsThisMonth: number;
  edgeSync: EdgeSyncState | null;
};

export interface Store {
  kind: "file" | "supabase";
  getOrg(): Promise<Organization>;
  updateOrg(
    patch: Partial<Pick<Organization, "name" | "plan" | "sanityProjectId" | "vercelProjectId">>,
  ): Promise<Organization>;
  listExperiments(): Promise<Experiment[]>;
  getExperiment(id: string): Promise<Experiment | null>;
  createExperiment(input: ExperimentInput): Promise<Experiment>;
  updateExperiment(id: string, input: ExperimentInput): Promise<Experiment>;
  deleteExperiment(id: string): Promise<void>;
  setStatus(id: string, status: ExperimentStatus): Promise<Experiment>;
  declareWinner(id: string, variantId: string): Promise<Experiment>;
  ingest(input: IngestInput): Promise<IngestResult>;
  recentEvents(options?: { experimentId?: string; limit?: number }): Promise<StoredEvent[]>;
  results(experimentId: string): Promise<ExperimentResults>;
  listKeys(): Promise<PublicApiKey[]>;
  createKey(name: string, scopes: string[]): Promise<{ key: PublicApiKey; plaintext: string }>;
  revokeKey(id: string): Promise<void>;
  authenticate(plaintext: string): Promise<{ scopes: string[] } | null>;
  listTeammates(): Promise<Teammate[]>;
  inviteTeammate(input: { name: string; email: string; role: Teammate["role"] }): Promise<Teammate>;
  removeTeammate(id: string): Promise<void>;
  edgeConfig(): Promise<EdgeConfig>;
  usage(): Promise<Usage>;
  getEdgeSync(): Promise<EdgeSyncState | null>;
  setEdgeSync(state: EdgeSyncState): Promise<void>;
  experimentsForDocument(documentId: string, keys: string[]): Promise<Experiment[]>;
}
