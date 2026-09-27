import type { PlanId } from "./types";

export const PLANS: Record<
  PlanId,
  {
    label: string;
    price: number;
    sites: number;
    concurrentExperiments: number;
    eventsPerMonth: number;
  }
> = {
  free: {
    label: "Free",
    price: 0,
    sites: 1,
    concurrentExperiments: 1,
    eventsPerMonth: 10_000,
  },
  starter: {
    label: "Starter",
    price: 49,
    sites: 3,
    concurrentExperiments: 5,
    eventsPerMonth: 100_000,
  },
  growth: {
    label: "Growth",
    price: 149,
    sites: Number.POSITIVE_INFINITY,
    concurrentExperiments: Number.POSITIVE_INFINITY,
    eventsPerMonth: 1_000_000,
  },
};

export function formatLimit(value: number): string {
  if (!Number.isFinite(value)) return "Unlimited";
  return new Intl.NumberFormat("en-US").format(value);
}
