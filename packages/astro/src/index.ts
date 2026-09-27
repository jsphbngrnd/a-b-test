import type { EdgeConfig, VariantPayload } from "@splitline/core";

export type SplitlineLocals = {
  visitorId: string;
  assignments: Record<string, string>;
  track: Record<string, string>;
  preview: boolean;
  config: EdgeConfig | null;
  error: string | null;
};

export function getVariant(locals: { splitline?: SplitlineLocals } | undefined, experimentKey: string): string | null {
  return locals?.splitline?.assignments[experimentKey] ?? null;
}

export function shouldTrack(
  locals: { splitline?: SplitlineLocals } | undefined,
  experimentKey: string,
): boolean {
  return Boolean(locals?.splitline?.track[experimentKey]);
}

export function getVariantPayload(
  config: EdgeConfig | null | undefined,
  experimentKey: string,
  variantKey: string | null,
): VariantPayload | null {
  const experiment = config?.experiments.find((item) => item.key === experimentKey);
  if (!experiment) return null;
  const variant =
    experiment.variants.find((item) => item.key === variantKey) ??
    experiment.variants.find((item) => item.key === "control") ??
    experiment.variants[0];
  return variant?.payload ?? null;
}
