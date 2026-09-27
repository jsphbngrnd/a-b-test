import type { ExperimentResults } from "@splitline/store";
import { compact, percent, pValue, signedPercent } from "@/lib/format";

export function ResultsView({ results }: { results: ExperimentResults }) {
  const max = Math.max(1, ...results.variants.flatMap((variant) => variant.daily.map((day) => day.exposures)));
  const empty = results.variants.every((variant) => variant.exposures === 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl">Results</h2>
        <p className="text-sm text-muted-foreground">
          Primary goal: <span className="font-medium text-foreground">{results.goalEventName}</span>. Rates use the daily
          rollup, not a scan of raw events. The call uses an O’Brien–Fleming boundary so early checks stay conservative.
        </p>
      </div>
      {empty ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-sm text-muted-foreground">
          No exposures yet. Start the experiment and send traffic through the edge middleware. The demo site records an
          exposure when someone lands on the matching page.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {results.variants.map((variant) => (
              <article key={variant.variantId} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">{variant.name}</p>
                <p className="mt-1 font-serif text-4xl">{percent(variant.conversionRate)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {compact(variant.conversions)} conversions · {compact(variant.exposures)} exposures
                </p>
              </article>
            ))}
          </div>
          {results.comparisons.map((comparison) => (
            <article key={comparison.variantId} className="rounded-xl border border-border bg-card p-4 text-sm leading-6">
              <p className="font-medium">
                {comparison.variantKey} vs {results.controlKey}: {signedPercent(comparison.relativeLift)} relative lift
              </p>
              <p className="text-muted-foreground">
                z {comparison.z.toFixed(2)} · p {pValue(comparison.pValue)} · 95% interval on the rate difference{" "}
                {signedPercent(comparison.confidenceInterval[0])} to {signedPercent(comparison.confidenceInterval[1])}
              </p>
              <p className="mt-2">
                {comparison.call === "winner"
                  ? "This challenger is ahead, and the sequential boundary has been crossed."
                  : comparison.call === "behind"
                    ? "Control is ahead after the sequential correction."
                    : "Keep testing. The result has not crossed the sequential boundary."}
              </p>
              <p className="text-muted-foreground">
                About {compact(comparison.requiredPerVariant)} visitors per variant to detect a 1 point change (80%
                power). Information so far: {(comparison.informationFraction * 100).toFixed(0)}%. Boundary |z| ≥{" "}
                {comparison.sequentialBoundary.toFixed(2)}.
              </p>
            </article>
          ))}
          <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-sm text-muted-foreground">Daily exposures, last 14 days</p>
            <div className="flex min-w-[640px] items-end gap-2">
              {results.variants[0]?.daily.map((day, index) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-28 w-full items-end justify-center gap-1">
                    {results.variants.map((variant, variantIndex) => {
                      const point = variant.daily[index];
                      const height = Math.max(2, Math.round((point.exposures / max) * 112));
                      return (
                        <div
                          key={variant.variantId}
                          title={`${variant.variantKey}: ${point.exposures} exposures, ${point.conversions} conversions`}
                          className={variantIndex === 0 ? "w-2 rounded-sm bg-foreground/70" : "w-2 rounded-sm bg-copper"}
                          style={{ height }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{day.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
