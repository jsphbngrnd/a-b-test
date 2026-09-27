// @ts-check
import node from "@astrojs/node";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Assignment and ?sl_preview= are per request. Static output strips the query
  // before middleware, so the demo is rendered on demand.
  output: "server",
  adapter: node({ mode: "standalone" }),
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ["@splitline/core", "@splitline/edge", "@splitline/client", "@splitline/astro"],
    },
  },
  server: {
    port: 43124,
    host: true,
  },
});
