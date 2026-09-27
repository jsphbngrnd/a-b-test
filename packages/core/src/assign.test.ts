import { describe, expect, it } from "vitest";
import { assignExperiments } from "./assign";
import type { ExperimentConfig } from "./types";

function experiment(overrides: Partial<ExperimentConfig> & Pick<ExperimentConfig, "id" | "key">): ExperimentConfig {
  return {
    status: "running",
    group: null,
    trafficAllocation: 100,
    variants: [
      { id: `${overrides.id}_control`, key: "control", weight: 50 },
      { id: `${overrides.id}_b`, key: "variant_b", weight: 50 },
    ],
    ...overrides,
  };
}

describe("assignExperiments", () => {
  it("is stable for the same visitor", () => {
    const experiments = [experiment({ id: "exp_hero", key: "homepage-hero" })];
    const first = assignExperiments({ visitorId: "visitor-1", experiments });
    const second = assignExperiments({ visitorId: "visitor-1", experiments });
    expect(second).toEqual(first);
    expect(first["homepage-hero"]?.variantKey).toMatch(/control|variant_b/);
  });

  it("splits a 50/50 test near the configured weights", () => {
    const experiments = [experiment({ id: "exp_hero", key: "homepage-hero" })];
    let variantB = 0;
    const total = 6000;
    for (let index = 0; index < total; index += 1) {
      const assigned = assignExperiments({ visitorId: `v${index}`, experiments });
      if (assigned["homepage-hero"]?.variantKey === "variant_b") variantB += 1;
    }
    expect(variantB / total).toBeGreaterThan(0.46);
    expect(variantB / total).toBeLessThan(0.54);
  });

  it("holds back visitors outside the traffic allocation", () => {
    const experiments = [
      experiment({ id: "exp_hero", key: "homepage-hero", trafficAllocation: 20 }),
    ];
    let enrolled = 0;
    const total = 4000;
    for (let index = 0; index < total; index += 1) {
      const assigned = assignExperiments({ visitorId: `a${index}`, experiments });
      if (assigned["homepage-hero"]) enrolled += 1;
    }
    expect(enrolled / total).toBeGreaterThan(0.16);
    expect(enrolled / total).toBeLessThan(0.24);
  });

  it("enrolls a visitor in at most one experiment in a group", () => {
    const experiments = [
      experiment({ id: "exp_a", key: "banner-a", group: "lifecycle", trafficAllocation: 40 }),
      experiment({ id: "exp_b", key: "banner-b", group: "lifecycle", trafficAllocation: 40 }),
    ];
    let neither = 0;
    for (let index = 0; index < 3000; index += 1) {
      const assigned = assignExperiments({ visitorId: `g${index}`, experiments });
      const hits = ["banner-a", "banner-b"].filter((key) => assigned[key]);
      expect(hits.length).toBeLessThanOrEqual(1);
      if (hits.length === 0) neither += 1;
    }
    expect(neither / 3000).toBeGreaterThan(0.14);
    expect(neither / 3000).toBeLessThan(0.26);
  });

  it("ignores experiments that are not running", () => {
    const assigned = assignExperiments({
      visitorId: "visitor-9",
      experiments: [experiment({ id: "exp_docs", key: "docs-banner", status: "draft" })],
    });
    expect(assigned["docs-banner"]).toBeUndefined();
  });
});
