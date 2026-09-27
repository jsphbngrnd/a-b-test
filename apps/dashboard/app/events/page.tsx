import { when } from "@/lib/format";
import { store } from "@/lib/store";

export const metadata = { title: "Events" };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ experiment?: string }>;
}) {
  const { experiment: experimentId } = await searchParams;
  const db = store();
  const experiments = await db.listExperiments();
  const events = await db.recentEvents({ experimentId, limit: 80 });
  const names = new Map(experiments.map((experiment) => [experiment.id, experiment.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Events</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Exposures and conversions accepted by the ingestion endpoint. Duplicates for the same visitor are dropped, so a refresh does not inflate the rollup.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Filter href="/events" on={!experimentId} label="All experiments" />
        {experiments.map((experiment) => (
          <Filter
            key={experiment.id}
            href={`/events?experiment=${experiment.id}`}
            on={experimentId === experiment.id}
            label={experiment.name}
          />
        ))}
      </div>
      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10">
          <h2 className="font-serif text-2xl">No events for this view</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Open the Northline demo, or send a POST to /api/v1/events with the demo key, and they will land here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {events.map((event) => (
            <li key={event.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center">
              <span>
                <span className="font-medium">{event.eventName}</span>
                <span className="text-muted-foreground"> · {event.eventType}</span>
              </span>
              <span className="text-muted-foreground">{names.get(event.experimentId) ?? event.experimentId}</span>
              <span className="text-muted-foreground">{when(event.occurredAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Filter({ href, on, label }: { href: string; on: boolean; label: string }) {
  return (
    <a
      href={href}
      className={`rounded-full border px-3 py-1 text-sm ${on ? "border-foreground bg-foreground text-background" : "border-border bg-card"}`}
    >
      {label}
    </a>
  );
}
