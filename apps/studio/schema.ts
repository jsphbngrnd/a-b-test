import { defineField, defineType } from "sanity";
import { experimentVariants } from "@splitline/sanity";

export const marketingPage = defineType({
  name: "marketingPage",
  title: "Page",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    experimentVariants({
      name: "hero",
      title: "Hero",
      fields: [
        defineField({ name: "headline", title: "Headline", type: "string", validation: (rule) => rule.required() }),
        defineField({ name: "subhead", title: "Subhead", type: "text", rows: 3 }),
        defineField({ name: "ctaLabel", title: "Button label", type: "string" }),
      ],
    }),
  ],
});
