import { useEffect, useState } from "react";
import { useEditState, type DocumentInspectorProps } from "sanity";

type ExperimentSummary = {
  id: string;
  name: string;
  key: string;
  status: string;
  variants: { key: string; name: string }[];
};

export function ExperimentInspector(
  props: DocumentInspectorProps & { apiOrigin: string; apiKey?: string },
) {
  const state = useEditState(props.documentId, props.documentType);
  const keys = collectExperimentKeys(state.draft ?? state.published);
  const keySignature = keys.join("|");
  const [experiments, setExperiments] = useState<ExperimentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ documentId: props.documentId });
    if (keySignature) params.set("keys", keySignature.replaceAll("|", ","));
    setExperiments(null);
    setError(null);
    fetch(`${props.apiOrigin}/api/v1/experiments?${params.toString()}`, {
      headers: props.apiKey ? { authorization: `Bearer ${props.apiKey}` } : {},
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Splitline responded ${response.status}.`);
        return (await response.json()) as { experiments: ExperimentSummary[] };
      })
      .then((body) => setExperiments(body.experiments))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Splitline could not be reached.");
      });
    return () => controller.abort();
  }, [keySignature, props.apiKey, props.apiOrigin, props.documentId]);

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <div>
        <strong>Splitline</strong>
        <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.75 }}>
          Experiments that reference this document, or that use an experiment key found in its fields.
        </p>
      </div>
      {error ? (
        <div style={{ padding: 12, border: "1px solid #9f2d2d", borderRadius: 8 }}>
          <strong>Couldn’t reach Splitline</strong>
          <p style={{ margin: "6px 0" }}>{error}</p>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
            The dashboard should be running at {props.apiOrigin}. You can change apiOrigin in the plugin options.
          </p>
        </div>
      ) : null}
      {!error && experiments === null ? <p style={{ fontSize: 13, opacity: 0.75 }}>Looking up experiments…</p> : null}
      {experiments && experiments.length === 0 ? (
        <p style={{ fontSize: 13, lineHeight: 1.5 }}>
          No experiments reference this document yet. In the dashboard, set a variant’s Sanity document id to{" "}
          {props.documentId}, or match the experiment key used in this document.
        </p>
      ) : null}
      {experiments?.map((experiment) => (
        <div key={experiment.id} style={{ padding: 12, border: "1px solid #e4d9cc", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <strong>{experiment.name}</strong>
            <span>{experiment.status}</span>
          </div>
          <p style={{ margin: "6px 0", fontSize: 13, opacity: 0.75 }}>
            {experiment.key} · {experiment.variants.map((variant) => variant.key).join(", ")}
          </p>
          <a href={`${props.apiOrigin}/experiments/${experiment.id}`}>Open in the dashboard</a>
        </div>
      ))}
    </div>
  );
}

function collectExperimentKeys(value: unknown, found = new Set<string>()): string[] {
  if (!value || typeof value !== "object") return [...found];
  if (Array.isArray(value)) {
    for (const item of value) collectExperimentKeys(item, found);
    return [...found];
  }
  const record = value as Record<string, unknown>;
  if (typeof record.experimentKey === "string" && record.experimentKey) found.add(record.experimentKey);
  for (const child of Object.values(record)) collectExperimentKeys(child, found);
  return [...found];
}
