export type ExperimentStatus = "draft" | "running" | "paused" | "completed";

export type PlanId = "free" | "starter" | "growth";

export type VariantPayload = {
  headline: string;
  subhead: string;
  cta: string;
};

export type VariantWeight = {
  id: string;
  key: string;
  weight: number;
};

export type ExperimentConfig = {
  id: string;
  key: string;
  status: ExperimentStatus;
  group: string | null;
  trafficAllocation: number;
  variants: VariantWeight[];
};

export type EdgeVariant = VariantWeight & {
  payload: VariantPayload;
};

export type EdgeExperiment = Omit<ExperimentConfig, "variants"> & {
  winnerVariantKey: string | null;
  variants: EdgeVariant[];
};

export type EdgeConfig = {
  generatedAt: string;
  experiments: EdgeExperiment[];
};

export type FreshAssignment = {
  experimentId: string;
  experimentKey: string;
  variantId: string;
  variantKey: string;
};

export const VISITOR_COOKIE = "sl_vid";
export const ASSIGNMENT_COOKIE = "sl_asg";
export const PREVIEW_COOKIE = "sl_preview";

export const DEMO_API_KEY = "sl_test_demo_key";
export const DEV_SIGNING_SECRET = "splitline-dev-secret";
