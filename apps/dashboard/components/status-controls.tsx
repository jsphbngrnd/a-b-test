"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExperimentStatus } from "@splitline/core";
import type { Comparison } from "@splitline/store";
import { changeStatus, declareWinner } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function StatusControls({
  id,
  status,
  comparisons,
  controlVariantId,
  controlName,
}: {
  id: string;
  status: ExperimentStatus;
  comparisons: Comparison[];
  controlVariantId: string;
  controlName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function run(label: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(label);
    setError(null);
    const result = await action();
    setPending(null);
    if (!result.ok) {
      setError(result.error ?? "Could not update the experiment.");
      return;
    }
    router.refresh();
  }

  const winner = comparisons.find((item) => item.call === "winner");
  const behind = comparisons.find((item) => item.call === "behind");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status !== "running" ? (
          <Button disabled={pending !== null} onClick={() => run("start", () => changeStatus(id, "running"))}>
            {pending === "start" ? "Starting…" : "Start"}
          </Button>
        ) : null}
        {status === "running" ? (
          <Button variant="outline" disabled={pending !== null} onClick={() => run("pause", () => changeStatus(id, "paused"))}>
            {pending === "pause" ? "Pausing…" : "Pause"}
          </Button>
        ) : null}
        {status !== "completed" && status !== "draft" ? (
          <Button variant="outline" disabled={pending !== null} onClick={() => run("complete", () => changeStatus(id, "completed"))}>
            {pending === "complete" ? "Stopping…" : "Stop without a winner"}
          </Button>
        ) : null}
        {winner ? (
          <Button
            disabled={pending !== null}
            onClick={() => run("winner", () => declareWinner(id, winner.variantId))}
          >
            {pending === "winner" ? "Declaring…" : `Declare ${winner.variantKey} the winner`}
          </Button>
        ) : null}
        {behind ? (
          <Button
            variant="secondary"
            disabled={pending !== null}
            onClick={() => run("control", () => declareWinner(id, controlVariantId))}
          >
            {pending === "control" ? "Declaring…" : `Declare ${controlName} the winner`}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
