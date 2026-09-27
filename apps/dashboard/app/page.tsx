import Link from "next/link";
import { PLANS, formatLimit } from "@splitline/core";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { compact, percent, when } from "@/lib/format";
import { store } from "@/lib/store";

export const metadata = { title: "Overview" };

const demoUrl = process.env.NEXT_PUBLIC_DEMO_URL ?? "http://127.0.0.1:43124";

export default async function OverviewPage() {
  const db = store();
  const [org, experiments, usage, events] = await Promise.all([
    db.getOrg(),
    db.listExperiments(),
    db.usage(),
    db.recentEvents({ limit: 6 }),
  ]);
  const running = experiments.filter((experiment) => experiment.status === "running").length;
  const plan = PLANS[org.plan];
  const usageRatio = Math.min(1, usage.events / usage.limit);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Today at {org.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {running === 0
              ? "Nothing is in market. Start a draft when the variant copy is ready in Sanity."
              : `${running} experiment${running === 1 ? "" : "s"} assigning visitors at the edge.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={demoUrl}>Open the demo site</a>
          </Button>
          <Button asChild>
            <Link href="/experiments/new">New experiment</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Running</p>
          <p className="mt-1 font-serif text-4xl">{running}</p>
          <p className="text-sm text-muted-foreground">of {formatLimit(plan.concurrentExperiments)} on {plan.label}</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Events this month</p>
          <p className="mt-1 font-serif text-4xl">{compact(usage.events)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-copper" style={{ width: `${usageRatio * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{compact(usage.limit)} included on {plan.label}</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Plan</p>
          <p className="mt-1 font-serif text-4xl">${plan.price}</p>
          <p className="text-sm text-muted-foreground">per month · {formatLimit(plan.sites)} site{plan.sites === 1 ? "" : "s"}</p>
        </article>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Experiments</h2>
        {experiments.length === 0 ? (
          <Empty />
        ) : (
          <ul className="grid gap-3">
            {experiments.map((experiment) => (
              <li key={experiment.id}>
                <Link href={`/experiments/${experiment.id}`} className="block rounded-xl border border-border bg-card p-4 hover:border-copper">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{experiment.name}</p>
                    <StatusBadge status={experiment.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{experiment.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl">Latest events</h2>
          <Link href="/events" className="text-sm underline">
            View all
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            No events stored yet. Exposures show up after a visitor hits a page that renders a running experiment.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {events.map((event) => (
              <li key={event.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:justify-between">
                <span>
                  <span className="font-medium">{event.eventName}</span>
                  <span className="text-muted-foreground"> · {event.eventType}</span>
                </span>
                <span className="text-muted-foreground">{when(event.occurredAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          The list is the latest stored events. Conversion rates on an experiment come from the daily rollup.
        </p>
      </section>
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10">
      <h3 className="font-serif text-2xl">No experiments yet</h3>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        Create a draft, write the control and a challenger, then start it. The Astro demo will pick up the running config.
      </p>
      <Button className="mt-4" asChild>
        <Link href="/experiments/new">Create an experiment</Link>
      </Button>
    </div>
  );
}
