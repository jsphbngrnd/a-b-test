import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { store } from "@/lib/store";
import type { ExperimentStatus } from "@splitline/core";

export const metadata = { title: "Experiments" };

const filters: Array<{ label: string; value?: ExperimentStatus }> = [
  { label: "All" },
  { label: "Running", value: "running" },
  { label: "Paused", value: "paused" },
  { label: "Draft", value: "draft" },
  { label: "Completed", value: "completed" },
];

export default async function ExperimentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const selected = filters.some((filter) => filter.value === status) ? (status as ExperimentStatus) : undefined;
  const experiments = (await store().listExperiments()).filter((experiment) => !selected || experiment.status === selected);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-serif text-4xl">Experiments</h1>
          <p className="mt-2 text-sm text-muted-foreground">Drafts stay out of the edge config’s assignment path until you start them.</p>
        </div>
        <Button asChild>
          <Link href="/experiments/new">New experiment</Link>
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const href = filter.value ? `/experiments?status=${filter.value}` : "/experiments";
          const on = selected === filter.value;
          return (
            <Link
              key={filter.label}
              href={href}
              className={`rounded-full border px-3 py-1 text-sm ${on ? "border-foreground bg-foreground text-background" : "border-border bg-card"}`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>
      {experiments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10">
          <h2 className="font-serif text-2xl">{selected ? `No ${selected} experiments` : "No experiments yet"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {selected ? "Try another status, or create a new draft." : "The first test can be a headline, a button, or a whole section."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {experiments.map((experiment) => (
            <li key={experiment.id}>
              <Link href={`/experiments/${experiment.id}`} className="block rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{experiment.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{experiment.key}</p>
                  </div>
                  <StatusBadge status={experiment.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {experiment.variants.map((variant) => `${variant.name} ${variant.weight}`).join(" · ")}
                  {experiment.group ? ` · group ${experiment.group}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
