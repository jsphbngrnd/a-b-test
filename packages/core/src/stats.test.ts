import { describe, expect, it } from "vitest";
import {
  inverseNormal,
  obrienFlemingBoundary,
  requiredSampleSizePerVariant,
  twoProportionZTest,
} from "./stats";

describe("stats", () => {
  it("matches a known two-proportion z statistic", () => {
    const result = twoProportionZTest(
      { successes: 100, trials: 1000 },
      { successes: 150, trials: 1000 },
    );
    expect(result.z).toBeCloseTo(3.381, 2);
    expect(result.pValue).toBeLessThan(0.001);
    expect(result.significant).toBe(true);
    expect(result.relativeLift).toBeCloseTo(0.5, 5);
    expect(result.confidenceInterval[0]).toBeGreaterThan(0);
  });

  it("does not call a tiny sample significant", () => {
    const result = twoProportionZTest({ successes: 1, trials: 20 }, { successes: 2, trials: 20 });
    expect(result.significant).toBe(false);
  });

  it("asks for more visitors when the effect is smaller", () => {
    const coarse = requiredSampleSizePerVariant({
      baselineRate: 0.04,
      minimumDetectableEffect: 0.02,
    });
    const fine = requiredSampleSizePerVariant({
      baselineRate: 0.04,
      minimumDetectableEffect: 0.01,
    });
    expect(fine).toBeGreaterThan(coarse);
    expect(fine).toBeGreaterThan(5000);
  });

  it("raises the O'Brien–Fleming boundary early in the test", () => {
    expect(inverseNormal(0.975)).toBeCloseTo(1.96, 2);
    expect(obrienFlemingBoundary(1)).toBeCloseTo(1.96, 2);
    expect(obrienFlemingBoundary(0.25)).toBeGreaterThan(3.5);
  });
});
