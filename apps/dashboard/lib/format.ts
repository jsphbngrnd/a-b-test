export function percent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

export function signedPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  const points = value * 100;
  const sign = points > 0 ? "+" : "";
  return `${sign}${points.toFixed(1)}%`;
}

export function pValue(value: number): string {
  if (value < 0.001) return "< 0.001";
  return value.toFixed(3);
}

export function compact(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function when(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
