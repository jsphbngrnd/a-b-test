import { hashToUnit, selectVariant } from "./hash";
import type { ExperimentConfig, FreshAssignment } from "./types";

/**
 * Stateless bucketing. Running experiments only.
 * Experiments that share a group are mutually exclusive: a visitor is enrolled in at most one.
 * `trafficAllocation` is the percent of traffic the experiment receives (0–100).
 * Inside a group those percents share one 100-point range. Above 100 they are scaled down.
 */
export function assignExperiments(input: {
  visitorId: string;
  experiments: ExperimentConfig[];
}): Record<string, FreshAssignment | null> {
  const running = input.experiments.filter((experiment) => experiment.status === "running");
  const result: Record<string, FreshAssignment | null> = {};
  const grouped = new Map<string, ExperimentConfig[]>();

  for (const experiment of running) {
    if (experiment.group) {
      const members = grouped.get(experiment.group) ?? [];
      members.push(experiment);
      grouped.set(experiment.group, members);
      continue;
    }
    result[experiment.key] = assignIndependent(input.visitorId, experiment);
  }

  for (const [group, members] of grouped) {
    const chosen = pickGroupMember(input.visitorId, group, members);
    for (const experiment of members) {
      if (experiment !== chosen) {
        result[experiment.key] = null;
        continue;
      }
      const variant = selectVariant(
        hashToUnit(`${input.visitorId}:${experiment.id}:variant`),
        experiment.variants,
      );
      result[experiment.key] = toAssignment(experiment, variant);
    }
  }

  return result;
}

function assignIndependent(visitorId: string, experiment: ExperimentConfig): FreshAssignment | null {
  const allocation = clampAllocation(experiment.trafficAllocation);
  if (allocation <= 0) return null;
  const enrolled = hashToUnit(`${visitorId}:${experiment.id}:alloc`) < allocation / 100;
  if (!enrolled) return null;
  const variant = selectVariant(
    hashToUnit(`${visitorId}:${experiment.id}:variant`),
    experiment.variants,
  );
  return toAssignment(experiment, variant);
}

function pickGroupMember(
  visitorId: string,
  group: string,
  members: ExperimentConfig[],
): ExperimentConfig | null {
  const sorted = [...members].sort((left, right) => left.id.localeCompare(right.id));
  let allocations = sorted.map((experiment) => clampAllocation(experiment.trafficAllocation));
  const sum = allocations.reduce((total, value) => total + value, 0);
  if (sum <= 0) return null;
  if (sum > 100) allocations = allocations.map((value) => (value / sum) * 100);
  const point = hashToUnit(`${visitorId}:group:${group}`) * 100;
  let cursor = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    cursor += allocations[index];
    if (point < cursor) return sorted[index];
  }
  return null;
}

function clampAllocation(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function toAssignment(
  experiment: ExperimentConfig,
  variant: ExperimentConfig["variants"][number],
): FreshAssignment {
  return {
    experimentId: experiment.id,
    experimentKey: experiment.key,
    variantId: variant.id,
    variantKey: variant.key,
  };
}
