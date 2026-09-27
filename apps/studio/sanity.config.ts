import { defineConfig } from "sanity";
import { splitline } from "@splitline/sanity";
import { marketingPage } from "./schema";

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || "placeholder";
const dataset = process.env.SANITY_STUDIO_DATASET || "production";
const apiOrigin = process.env.SANITY_STUDIO_SPLITLINE_ORIGIN || "http://127.0.0.1:43123";

export default defineConfig({
  name: "northline",
  title: "Northline",
  projectId,
  dataset,
  plugins: [splitline({ apiOrigin })],
  schema: { types: [marketingPage] },
});
