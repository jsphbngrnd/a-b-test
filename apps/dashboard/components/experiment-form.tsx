"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Experiment, VariantInput } from "@splitline/store";
import { saveExperiment } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DraftVariant = VariantInput;

const blank = (key: string, name: string): DraftVariant => ({
  key,
  name,
  weight: 50,
  sanityDocumentId: "",
  payload: { headline: "", subhead: "", cta: "" },
});

export function ExperimentForm({ experiment }: { experiment?: Experiment }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [variants, setVariants] = useState<DraftVariant[]>(
    experiment?.variants.map((variant) => ({
      key: variant.key,
      name: variant.name,
      weight: variant.weight,
      sanityDocumentId: variant.sanityDocumentId,
      payload: variant.payload,
    })) ?? [blank("control", "Control"), blank("variant_b", "Variant B")],
  );

  function updateVariant(index: number, patch: Partial<Omit<DraftVariant, "payload">> & { payload?: Partial<DraftVariant["payload"]> }) {
    setVariants((current) =>
      current.map((variant, itemIndex) => {
        if (itemIndex !== index) return variant;
        return {
          ...variant,
          ...patch,
          payload: { ...variant.payload, ...patch.payload },
        };
      }),
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const group = String(form.get("group") ?? "").trim();
    setPending(true);
    setError(null);
    const result = await saveExperiment(experiment?.id ?? null, {
      name: String(form.get("name") ?? ""),
      key: String(form.get("key") ?? ""),
      description: String(form.get("description") ?? ""),
      group: group || null,
      trafficAllocation: Number(form.get("trafficAllocation")),
      goalEventName: String(form.get("goalEventName") ?? "cta_click"),
      variants,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/experiments/${result.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" required defaultValue={experiment?.name} placeholder="Homepage hero" />
        </Field>
        <Field label="Key" htmlFor="key">
          <Input id="key" name="key" required defaultValue={experiment?.key} placeholder="homepage-hero" />
        </Field>
        <Field label="Goal event" htmlFor="goalEventName">
          <Input id="goalEventName" name="goalEventName" required defaultValue={experiment?.goalEventName ?? "cta_click"} />
        </Field>
        <Field label="Traffic allocation (%)" htmlFor="trafficAllocation">
          <Input
            id="trafficAllocation"
            name="trafficAllocation"
            type="number"
            min={1}
            max={100}
            required
            defaultValue={experiment?.trafficAllocation ?? 100}
          />
        </Field>
        <Field label="Mutual-exclusion group" htmlFor="group" className="sm:col-span-2">
          <Input id="group" name="group" defaultValue={experiment?.group ?? ""} placeholder="Leave empty for an independent test" />
        </Field>
        <Field label="Description" htmlFor="description" className="sm:col-span-2">
          <Textarea id="description" name="description" defaultValue={experiment?.description} rows={3} />
        </Field>
      </div>

      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Variants</h2>
            <p className="text-sm text-muted-foreground">
              Preview copy is what the demo renders until a Sanity project is connected. In Studio, the same fields live on the experiment variants input.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setVariants((current) => [...current, blank(`variant_${String.fromCharCode(97 + current.length)}`, `Variant ${current.length + 1}`)])}
          >
            Add variant
          </Button>
        </div>
        {variants.map((variant, index) => (
          <fieldset key={`${variant.key}-${index}`} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <legend className="px-1 text-sm font-medium">{variant.name || `Variant ${index + 1}`}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Key">
                <Input value={variant.key} onChange={(event) => updateVariant(index, { key: event.target.value })} required />
              </Field>
              <Field label="Name">
                <Input value={variant.name} onChange={(event) => updateVariant(index, { name: event.target.value })} required />
              </Field>
              <Field label="Weight">
                <Input
                  type="number"
                  min={1}
                  value={variant.weight}
                  onChange={(event) => updateVariant(index, { weight: Number(event.target.value) })}
                  required
                />
              </Field>
              <Field label="Sanity document id">
                <Input
                  value={variant.sanityDocumentId}
                  onChange={(event) => updateVariant(index, { sanityDocumentId: event.target.value })}
                  placeholder="homepage"
                />
              </Field>
              <Field label="Headline" className="sm:col-span-2">
                <Input
                  value={variant.payload.headline}
                  onChange={(event) => updateVariant(index, { payload: { headline: event.target.value } })}
                  required
                />
              </Field>
              <Field label="Subhead" className="sm:col-span-2">
                <Textarea
                  value={variant.payload.subhead}
                  onChange={(event) => updateVariant(index, { payload: { subhead: event.target.value } })}
                  required
                  rows={3}
                />
              </Field>
              <Field label="Button label" className="sm:col-span-2">
                <Input
                  value={variant.payload.cta}
                  onChange={(event) => updateVariant(index, { payload: { cta: event.target.value } })}
                  required
                />
              </Field>
            </div>
            {variants.length > 2 ? (
              <Button type="button" variant="ghost" onClick={() => setVariants((current) => current.filter((_, item) => item !== index))}>
                Remove variant
              </Button>
            ) : null}
          </fieldset>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : experiment ? "Save changes" : "Create draft"}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 block">
        {label}
      </Label>
      {children}
    </div>
  );
}
