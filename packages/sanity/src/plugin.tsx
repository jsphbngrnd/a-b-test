import { defineField, definePlugin, defineDocumentInspector, type FieldDefinition } from "sanity";
import { ExperimentInspector } from "./inspector";
import { VariantsInput } from "./variants-input";

export type SplitlineOptions = {
  /** Origin of the experiments dashboard, without a trailing slash. */
  apiOrigin?: string;
  apiKey?: string;
};

export function experimentVariants(options: {
  name: string;
  title?: string;
  description?: string;
  fields: FieldDefinition[];
}) {
  return defineField({
    name: options.name,
    title: options.title ?? "Experiment variants",
    description:
      options.description ??
      "Control and challenger content. One of these is served per visitor, at the edge, with no client-side swap.",
    type: "object",
    components: { input: VariantsInput },
    fields: [
      defineField({
        name: "experimentKey",
        title: "Experiment key",
        type: "string",
        description: "Matches the key in the experiments dashboard, for example homepage-hero.",
      }),
      defineField({
        name: "variants",
        title: "Variants",
        type: "array",
        of: [
          {
            type: "object",
            name: "splitlineVariant",
            fields: [
              defineField({
                name: "key",
                title: "Variant key",
                type: "string",
                description: "control, variant_b, variant_c…",
              }),
              defineField({
                name: "weight",
                title: "Weight",
                type: "number",
                initialValue: 50,
                description: "Relative traffic. Weights do not have to sum to 100.",
              }),
              ...options.fields,
            ],
            preview: {
              select: { title: "key", subtitle: "headline" },
              prepare({ title, subtitle }) {
                return { title: title || "Variant", subtitle };
              },
            },
          },
        ],
      }),
    ],
  });
}

export const splitline = definePlugin<SplitlineOptions | void>((options) => {
  const apiOrigin = options?.apiOrigin?.replace(/\/$/, "") || "http://127.0.0.1:43123";
  const apiKey = options?.apiKey;
  const inspector = defineDocumentInspector({
    name: "splitline",
    useMenuItem: () => ({ title: "Experiments", showAsAction: true }),
    component: function SplitlineInspectorBridge(props) {
      return <ExperimentInspector {...props} apiOrigin={apiOrigin} apiKey={apiKey} />;
    },
  });
  return {
    name: "splitline",
    document: {
      inspectors: (previous) => [inspector, ...previous],
    },
  };
});
