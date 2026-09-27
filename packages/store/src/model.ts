import { createHash, randomBytes } from "node:crypto";
import {
  DEMO_API_KEY,
  obrienFlemingBoundary,
  PLANS,
  requiredSampleSizePerVariant,
  twoProportionZTest,
  type ExperimentStatus,
} from "@splitline/core";
import type {
  Comparison,
  Experiment,
  ExperimentInput,
  ExperimentResults,
  Rollup,
  State,
  Variant,
  VariantInput,
} from "./types";

export class SplitlineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SplitlineError";
  }
}

export const KEY_SCOPES = ["events:write", "config:read"] as const;

const KEY_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

export function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function generateApiKey(): string {
  return `sl_live_${randomBytes(24).toString("base64url")}`;
}

export function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function recentDates(days: number, now = new Date()): string[] {
  const dates: string[] = [];
  for (let ago = days - 1; ago >= 0; ago -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - ago);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

export function publicKey<T extends { keyHash: string }>(record: T): Omit<T, "keyHash"> {
  const { keyHash: _hash, ...rest } = record;
  return rest;
}

export function validateExperimentInput(input: ExperimentInput, existingKeys: string[]): void {
  const name = input.name.trim();
  const key = input.key.trim();
  if (name.length < 2 || name.length > 80) {
    throw new SplitlineError("Give the experiment a name between 2 and 80 characters.");
  }
  if (!KEY_PATTERN.test(key)) {
    throw new SplitlineError("Experiment keys use lowercase letters, numbers, hyphens, and underscores.");
  }
  if (existingKeys.includes(key)) {
    throw new SplitlineError(`An experiment already uses the key “${key}”.`);
  }
  if (input.description.trim().length > 500) {
    throw new SplitlineError("Keep the description under 500 characters.");
  }
  if (!Number.isInteger(input.trafficAllocation) || input.trafficAllocation < 1 || input.trafficAllocation > 100) {
    throw new SplitlineError("Traffic allocation is a whole number from 1 to 100.");
  }
  if (!KEY_PATTERN.test(input.goalEventName.trim())) {
    throw new SplitlineError("Goal event names use lowercase letters, numbers, hyphens, and underscores.");
  }
  if (input.variants.length < 2) {
    throw new SplitlineError("An experiment needs a control and at least one challenger.");
  }
  const seen = new Set<string>();
  for (const variant of input.variants) {
    if (!KEY_PATTERN.test(variant.key.trim())) {
      throw new SplitlineError(`“${variant.key}” is not a valid variant key.`);
    }
    if (seen.has(variant.key)) throw new SplitlineError(`Variant key “${variant.key}” is repeated.`);
    seen.add(variant.key);
    if (!variant.name.trim()) throw new SplitlineError("Every variant needs a name.");
    if (!Number.isFinite(variant.weight) || variant.weight <= 0) {
      throw new SplitlineError("Variant weights have to be greater than zero.");
    }
    for (const field of ["headline", "subhead", "cta"] as const) {
      if (variant.payload[field].trim().length === 0) {
        throw new SplitlineError(`Add ${field} copy for ${variant.name}.`);
      }
    }
  }
}

export function assertCanRun(state: Pick<State, "org" | "experiments">, experimentId: string): void {
  const limit = PLANS[state.org.plan].concurrentExperiments;
  const running = state.experiments.filter(
    (experiment) => experiment.status === "running" && experiment.id !== experimentId,
  ).length;
  if (running + 1 > limit) {
    const noun = limit === 1 ? "experiment" : "experiments";
    throw new SplitlineError(
      `The ${PLANS[state.org.plan].label} plan allows ${limit} concurrent ${noun}. Pause one, or change the plan in settings.`,
    );
  }
}

export function applyStatus(experiment: Experiment, status: ExperimentStatus, now: string): Experiment {
  const next: Experiment = { ...experiment, status, updatedAt: now };
  if (status === "running") {
    next.startedAt = experiment.startedAt ?? now;
    next.endedAt = null;
    if (experiment.status === "completed") next.winnerVariantId = null;
  }
  if (status === "completed") next.endedAt = now;
  if (status === "draft") {
    next.startedAt = null;
    next.endedAt = null;
    next.winnerVariantId = null;
  }
  return next;
}

export function toEdgeConfig(state: Pick<State, "experiments">, generatedAt = new Date().toISOString()) {
  return {
    generatedAt,
    experiments: state.experiments.map((experiment) => ({
      id: experiment.id,
      key: experiment.key,
      status: experiment.status,
      group: experiment.group,
      trafficAllocation: experiment.trafficAllocation,
      winnerVariantKey:
        experiment.variants.find((variant) => variant.id === experiment.winnerVariantId)?.key ?? null,
      variants: experiment.variants.map((variant) => ({
        id: variant.id,
        key: variant.key,
        weight: variant.weight,
        payload: variant.payload,
      })),
    })),
  };
}

export function computeResults(experiment: Experiment, rollups: Rollup[], now = new Date()): ExperimentResults {
  const dates = recentDates(14, now);
  const control = experiment.variants.find((variant) => variant.key === "control") ?? experiment.variants[0];
  const variants = experiment.variants.map((variant) => {
    const rows = rollups.filter((row) => row.experimentId === experiment.id && row.variantId === variant.id);
    const exposures = rows.reduce((sum, row) => sum + row.exposures, 0);
    const conversions = rows.reduce((sum, row) => sum + row.conversions, 0);
    return {
      variantId: variant.id,
      variantKey: variant.key,
      name: variant.name,
      exposures,
      conversions,
      conversionRate: exposures === 0 ? 0 : conversions / exposures,
      daily: dates.map((date) => {
        const row = rows.find((item) => item.date === date);
        return { date, exposures: row?.exposures ?? 0, conversions: row?.conversions ?? 0 };
      }),
    };
  });
  const controlStats = variants.find((variant) => variant.variantId === control.id) ?? variants[0];
  const requiredPerVariant = requiredSampleSizePerVariant({
    baselineRate: controlStats.conversionRate > 0 ? controlStats.conversionRate : 0.04,
    minimumDetectableEffect: 0.01,
  });
  const comparisons: Comparison[] = variants
    .filter((variant) => variant.variantId !== control.id)
    .map((variant) => {
      const test = twoProportionZTest(
        { successes: controlStats.conversions, trials: controlStats.exposures },
        { successes: variant.conversions, trials: variant.exposures },
      );
      const seen = Math.min(controlStats.exposures, variant.exposures);
      const informationFraction =
        !Number.isFinite(requiredPerVariant) || requiredPerVariant === 0
          ? 1
          : Math.min(1, seen / requiredPerVariant);
      const sequentialBoundary = obrienFlemingBoundary(informationFraction);
      const crossed = !test.insufficient && Math.abs(test.z) >= sequentialBoundary;
      return {
        variantId: variant.variantId,
        variantKey: variant.variantKey,
        z: test.z,
        pValue: test.pValue,
        absoluteLift: test.absoluteLift,
        relativeLift: test.relativeLift,
        confidenceInterval: test.confidenceInterval,
        significantFixed: test.significant,
        sequentialBoundary,
        informationFraction,
        call: !crossed ? "keep-testing" : test.absoluteLift > 0 ? "winner" : "behind",
        requiredPerVariant,
        insufficient: test.insufficient,
      };
    });
  return { goalEventName: experiment.goalEventName, controlKey: control.key, variants, comparisons };
}

export function mergeVariants(existing: Variant[], input: VariantInput[], createId: () => string): Variant[] {
  return input.map((variant) => {
    const previous = existing.find((item) => item.key === variant.key.trim());
    return {
      id: previous?.id ?? createId(),
      key: variant.key.trim(),
      name: variant.name.trim(),
      weight: variant.weight,
      sanityDocumentId: variant.sanityDocumentId.trim(),
      payload: {
        headline: variant.payload.headline.trim(),
        subhead: variant.payload.subhead.trim(),
        cta: variant.payload.cta.trim(),
      },
    };
  });
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distribute(total: number, days: number, seed: number): number[] {
  const random = mulberry32(seed);
  const weights = Array.from({ length: days }, () => 0.35 + random());
  const sum = weights.reduce((totalWeight, weight) => totalWeight + weight, 0);
  const counts = weights.map((weight) => Math.floor((weight / sum) * total));
  let drift = total - counts.reduce((totalCount, count) => totalCount + count, 0);
  for (let index = 0; drift > 0; index += 1, drift -= 1) counts[index % days] += 1;
  return counts;
}

function allocateConversions(exposures: number[], conversions: number): number[] {
  const result = exposures.map(() => 0);
  const totalExposures = exposures.reduce((sum, value) => sum + value, 0);
  let left = conversions;
  for (let index = 0; index < exposures.length; index += 1) {
    const share = totalExposures === 0 ? 0 : Math.floor((exposures[index] / totalExposures) * conversions);
    const take = Math.min(exposures[index], share);
    result[index] = take;
    left -= take;
  }
  for (let index = 0; left > 0 && index < exposures.length * 4; index += 1) {
    const slot = index % exposures.length;
    if (result[slot] < exposures[slot]) {
      result[slot] += 1;
      left -= 1;
    }
  }
  return result;
}

function series(
  experimentId: string,
  variantId: string,
  exposures: number,
  conversions: number,
  seed: number,
  dates: string[],
) {
  const exposureCounts = distribute(exposures, dates.length, seed);
  const conversionCounts = allocateConversions(exposureCounts, conversions);
  return dates.map((date, index) => ({
    experimentId,
    variantId,
    date,
    exposures: exposureCounts[index],
    conversions: conversionCounts[index],
  }));
}

function variant(
  id: string,
  key: string,
  name: string,
  weight: number,
  sanityDocumentId: string,
  headline: string,
  subhead: string,
  cta: string,
): Variant {
  return { id, key, name, weight, sanityDocumentId, payload: { headline, subhead, cta } };
}

export function seedState(now = new Date()): State {
  const iso = now.toISOString();
  const dates = recentDates(14, now);
  const started = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString();
  const experiments: Experiment[] = [
    {
      id: "exp_homepage_hero",
      orgId: "org_northline",
      key: "homepage-hero",
      name: "Homepage hero",
      description:
        "Tests the first headline and the primary call to action on the Northline marketing site. The goal is a click on the hero button.",
      status: "running",
      group: null,
      trafficAllocation: 100,
      goalEventName: "cta_click",
      startedAt: started,
      endedAt: null,
      winnerVariantId: null,
      createdAt: started,
      updatedAt: iso,
      variants: [
        variant(
          "var_hero_control",
          "control",
          "Control",
          50,
          "homepage",
          "Close the books without the scramble.",
          "Northline keeps the close calendar, reconciliations, and the audit trail in one workspace, so controllers stop chasing spreadsheets the week after month-end.",
          "See the close calendar",
        ),
        variant(
          "var_hero_b",
          "variant_b",
          "Friday close",
          50,
          "homepage",
          "Month-end, finished by Friday.",
          "Give your controllers a close that ends when the week does — not the following Wednesday. Northline runs the checklist, the ties-out, and the sign-off.",
          "Book a close review",
        ),
      ],
    },
    {
      id: "exp_pricing_cta",
      orgId: "org_northline",
      key: "pricing-cta",
      name: "Pricing page CTA",
      description:
        "Compares a direct pilot ask with a pricing-first ask. Paused while the pricing page is being rewritten in Sanity.",
      status: "paused",
      group: null,
      trafficAllocation: 100,
      goalEventName: "cta_click",
      startedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      endedAt: null,
      winnerVariantId: null,
      createdAt: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: iso,
      variants: [
        variant(
          "var_pricing_control",
          "control",
          "Control",
          50,
          "pricing",
          "Start with one close cycle.",
          "A four-week pilot on your real entities. No migration project, and no professional-services block before the first close.",
          "Start a pilot",
        ),
        variant(
          "var_pricing_b",
          "variant_b",
          "Pricing first",
          50,
          "pricing",
          "Pricing that follows your entities.",
          "See what Northline costs for the companies you close today, not a generic seat count.",
          "See pricing for your team",
        ),
      ],
    },
    {
      id: "exp_docs_banner",
      orgId: "org_northline",
      key: "docs-banner",
      name: "Docs sidebar banner",
      description: "A draft banner for the docs sidebar. It stays in the lifecycle group so it cannot overlap a later banner test.",
      status: "draft",
      group: "lifecycle",
      trafficAllocation: 50,
      goalEventName: "cta_click",
      startedAt: null,
      endedAt: null,
      winnerVariantId: null,
      createdAt: iso,
      updatedAt: iso,
      variants: [
        variant(
          "var_docs_control",
          "control",
          "Control",
          50,
          "docs-home",
          "New to the close checklist?",
          "The getting-started guide walks through a single entity, from import to sign-off.",
          "Read the guide",
        ),
        variant(
          "var_docs_b",
          "variant_b",
          "Import angle",
          50,
          "docs-home",
          "Import a close in an afternoon.",
          "Bring last month's workbook. Northline maps the accounts and leaves the commentary to your team.",
          "Watch the import",
        ),
      ],
    },
  ];

  const rollups = [
    ...series("exp_homepage_hero", "var_hero_control", 4200, 168, 11, dates),
    ...series("exp_homepage_hero", "var_hero_b", 4150, 228, 29, dates),
    ...series("exp_pricing_cta", "var_pricing_control", 310, 22, 41, dates),
    ...series("exp_pricing_cta", "var_pricing_b", 290, 24, 53, dates),
  ];

  const month = monthKey(now);
  const eventsThisMonth = rollups
    .filter((row) => row.date.startsWith(month))
    .reduce((sum, row) => sum + row.exposures + row.conversions, 0);

  const sampleVisitors = ["9f3a1c", "b71e02", "44ac88", "e0d219", "17bb40", "c83aa1"];
  const events = sampleVisitors.flatMap((suffix, index) => {
    const occurredAt = new Date(now.getTime() - (index + 1) * 17 * 60 * 1000).toISOString();
    const variantId = index % 2 === 0 ? "var_hero_control" : "var_hero_b";
    const exposure = {
      id: `evt_seed_${index}a`,
      orgId: "org_northline",
      experimentId: "exp_homepage_hero",
      variantId,
      visitorId: `seed${suffix}`,
      eventType: "exposure" as const,
      eventName: "exposure",
      occurredAt,
      metadata: {},
    };
    if (index % 3 !== 0) return [exposure];
    return [
      exposure,
      {
        ...exposure,
        id: `evt_seed_${index}b`,
        eventType: "conversion" as const,
        eventName: "cta_click",
        occurredAt: new Date(now.getTime() - (index + 1) * 17 * 60 * 1000 + 40_000).toISOString(),
      },
    ];
  });

  return {
    version: 1,
    org: {
      id: "org_northline",
      name: "Northline",
      plan: "starter",
      sanityProjectId: "",
      vercelProjectId: "",
    },
    experiments,
    rollups,
    events,
    dedupe: [],
    apiKeys: [
      {
        id: "key_demo",
        orgId: "org_northline",
        name: "Northline demo site",
        keyHash: hashKey(DEMO_API_KEY),
        keyPrefix: DEMO_API_KEY.slice(0, 12),
        scopes: ["events:write"],
        createdAt: started,
        revokedAt: null,
      },
    ],
    teammates: [
      {
        id: "mate_maya",
        name: "Maya Chen",
        email: "maya.chen@northline.example",
        role: "admin",
        status: "active",
      },
      {
        id: "mate_owen",
        name: "Owen Park",
        email: "owen.park@northline.example",
        role: "editor",
        status: "active",
      },
      {
        id: "mate_priya",
        name: "Priya Shah",
        email: "priya.shah@northline.example",
        role: "viewer",
        status: "invited",
      },
    ],
    usageMonth: month,
    eventsThisMonth,
    edgeSync: null,
  };
}
