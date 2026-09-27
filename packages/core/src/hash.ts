export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Stable unit interval in [0, 1). The same input always maps to the same bucket. */
export function hashToUnit(input: string): number {
  return fnv1a(input) / 2 ** 32;
}

export function selectVariant<T extends { weight: number }>(unit: number, variants: T[]): T {
  if (variants.length === 0) {
    throw new Error("Cannot assign a variant when the experiment has none.");
  }
  const total = variants.reduce((sum, variant) => sum + Math.max(0, variant.weight), 0);
  if (total <= 0) return variants[0];
  let cursor = Math.min(Math.max(unit, 0), 0.999999999) * total;
  for (const variant of variants) {
    cursor -= Math.max(0, variant.weight);
    if (cursor < 0) return variant;
  }
  return variants[variants.length - 1];
}
