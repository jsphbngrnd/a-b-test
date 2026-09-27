const LOWER_A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
  -3.066479806614716e1, 2.506628277459239,
];
const LOWER_B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
  -1.328068155288572e1,
];
const TAIL_C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
  4.374664141464968, 2.938163982698783,
];
const TAIL_D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

/** Inverse standard normal CDF (Acklam). `p` is in (0, 1). */
export function inverseNormal(probability: number): number {
  if (probability <= 0 || probability >= 1) {
    throw new Error("Probability must be between 0 and 1.");
  }
  const plow = 0.02425;
  const phigh = 1 - plow;
  if (probability < plow) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (
      (((((TAIL_C[0] * q + TAIL_C[1]) * q + TAIL_C[2]) * q + TAIL_C[3]) * q + TAIL_C[4]) * q +
        TAIL_C[5]) /
      ((((TAIL_D[0] * q + TAIL_D[1]) * q + TAIL_D[2]) * q + TAIL_D[3]) * q + 1)
    );
  }
  if (probability > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - probability));
    return (
      -(
        (((((TAIL_C[0] * q + TAIL_C[1]) * q + TAIL_C[2]) * q + TAIL_C[3]) * q + TAIL_C[4]) * q +
          TAIL_C[5]) /
        ((((TAIL_D[0] * q + TAIL_D[1]) * q + TAIL_D[2]) * q + TAIL_D[3]) * q + 1)
      )
    );
  }
  const q = probability - 0.5;
  const r = q * q;
  return (
    ((((((LOWER_A[0] * r + LOWER_A[1]) * r + LOWER_A[2]) * r + LOWER_A[3]) * r + LOWER_A[4]) * r +
      LOWER_A[5]) *
      q) /
    (((((LOWER_B[0] * r + LOWER_B[1]) * r + LOWER_B[2]) * r + LOWER_B[3]) * r + LOWER_B[4]) * r +
      1)
  );
}

/** Standard normal CDF via the Abramowitz and Stegun erf approximation. */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

export type Proportion = {
  successes: number;
  trials: number;
};

export type ZTestResult = {
  z: number;
  pValue: number;
  absoluteLift: number;
  relativeLift: number | null;
  controlRate: number;
  variantRate: number;
  significant: boolean;
  confidenceInterval: [number, number];
  insufficient: boolean;
};

/** Two-proportion z-test. The interval is on the absolute rate difference (variant − control). */
export function twoProportionZTest(
  control: Proportion,
  variant: Proportion,
  alpha = 0.05,
): ZTestResult {
  const n1 = control.trials;
  const n2 = variant.trials;
  const insufficient = n1 <= 0 || n2 <= 0;
  const p1 = insufficient ? 0 : control.successes / n1;
  const p2 = insufficient ? 0 : variant.successes / n2;
  const pooled = n1 + n2 === 0 ? 0 : (control.successes + variant.successes) / (n1 + n2);
  const pooledSe =
    insufficient || pooled <= 0 || pooled >= 1
      ? 0
      : Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  const z = pooledSe > 0 ? (p2 - p1) / pooledSe : 0;
  const pValue = pooledSe > 0 ? Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))) : 1;
  const unpooledSe = insufficient
    ? 0
    : Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  const zCritical = inverseNormal(1 - alpha / 2);
  const difference = p2 - p1;
  return {
    z,
    pValue,
    absoluteLift: difference,
    relativeLift: p1 > 0 ? difference / p1 : null,
    controlRate: p1,
    variantRate: p2,
    significant: pooledSe > 0 && pValue < alpha,
    confidenceInterval: [difference - zCritical * unpooledSe, difference + zCritical * unpooledSe],
    insufficient,
  };
}

/** Visitors required in each variant for a two-sided test of an absolute rate difference. */
export function requiredSampleSizePerVariant(input: {
  baselineRate: number;
  minimumDetectableEffect: number;
  alpha?: number;
  power?: number;
}): number {
  const p1 = input.baselineRate;
  const effect = input.minimumDetectableEffect;
  if (effect === 0) return Number.POSITIVE_INFINITY;
  const p2 = p1 + effect;
  const zAlpha = inverseNormal(1 - (input.alpha ?? 0.05) / 2);
  const zBeta = inverseNormal(input.power ?? 0.8);
  const n = ((zAlpha + zBeta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) / effect ** 2;
  return Math.ceil(n);
}

/**
 * O'Brien–Fleming critical |z| at this information fraction.
 * Early looks need a larger test statistic, so peeking does not use a flat p < 0.05 cutoff.
 */
export function obrienFlemingBoundary(informationFraction: number, alpha = 0.05): number {
  const fraction = Math.min(1, Math.max(informationFraction, 0.01));
  return inverseNormal(1 - alpha / 2) / Math.sqrt(fraction);
}
