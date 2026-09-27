import type { ExperimentStatus } from "@splitline/core";
import { Badge } from "@/components/ui/badge";

const copy: Record<ExperimentStatus, string> = {
  draft: "Draft",
  running: "Running",
  paused: "Paused",
  completed: "Completed",
};

export function StatusBadge({ status }: { status: ExperimentStatus }) {
  if (status === "running") {
    return <Badge className="bg-copper text-white">{copy[status]}</Badge>;
  }
  if (status === "completed") {
    return <Badge className="bg-signal text-white">{copy[status]}</Badge>;
  }
  return <Badge variant={status === "paused" ? "secondary" : "outline"}>{copy[status]}</Badge>;
}
