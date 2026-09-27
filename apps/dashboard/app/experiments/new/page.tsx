import { ExperimentForm } from "@/components/experiment-form";

export const metadata = { title: "New experiment" };

export default function NewExperimentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">New experiment</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          It is saved as a draft. Starting it enrolls visitors with a signed cookie and a stable hash, so the same person keeps their variant.
        </p>
      </div>
      <ExperimentForm />
    </div>
  );
}
