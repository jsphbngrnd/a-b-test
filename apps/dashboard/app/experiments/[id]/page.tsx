import { notFound } from "next/navigation";
import { DeleteExperiment } from "@/components/delete-experiment";
import { ExperimentForm } from "@/components/experiment-form";
import { ResultsView } from "@/components/results-view";
import { StatusBadge } from "@/components/status-badge";
import { StatusControls } from "@/components/status-controls";
import { store } from "@/lib/store";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const experiment = await store().getExperiment(id);
  return { title: experiment?.name ?? "Experiment" };
}

export default async function ExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = store();
  const experiment = await db.getExperiment(id);
  if (!experiment) notFound();
  const results = await db.results(id);
  const control = experiment.variants.find((variant) => variant.key === "control") ?? experiment.variants[0];

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-4xl">{experiment.name}</h1>
          <StatusBadge status={experiment.status} />
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{experiment.description}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {experiment.key}
          {experiment.group ? ` · group ${experiment.group}` : " · independent"} · {experiment.trafficAllocation}% of traffic · goal {experiment.goalEventName}
        </p>
        {experiment.winnerVariantId ? (
          <p className="text-sm">
            Winner: {experiment.variants.find((variant) => variant.id === experiment.winnerVariantId)?.name}. Every visitor now sees that version, and it is not tracked.
          </p>
        ) : null}
        <StatusControls
          id={experiment.id}
          status={experiment.status}
          comparisons={results.comparisons}
          controlVariantId={control.id}
          controlName={control.name}
        />
      </div>
      <ResultsView results={results} />
      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Content and weights</h2>
        <p className="text-sm text-muted-foreground">
          Weight changes apply to new visitors. People who already have a signed assignment keep their variant.
        </p>
        <ExperimentForm experiment={experiment} />
      </section>
      <DeleteExperiment id={experiment.id} name={experiment.name} />
    </div>
  );
}
