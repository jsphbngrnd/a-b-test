# Splitline

Edge A/B testing for Astro and Sanity sites on Vercel. Middleware assigns each visitor a variant and sets a signed cookie before any HTML is sent, so the page does not flicker between versions.

This repo is a local, runnable slice of that product:

- `@splitline/edge` decides the variant (consistent hash, weights, traffic allocation, mutually exclusive groups, sticky cookies, optional preview).
- `@splitline/astro` exposes `getVariant()`, `getVariantPayload()`, and `<Experiment>`.
- `@splitline/sanity` adds an experiment-variants field and a document inspector for Sanity Studio.
- `@splitline/client` sends exposure and conversion events.
- The Next.js dashboard creates and pauses experiments, shows a two-proportion z-test with an O’Brien–Fleming boundary, and stores API keys.
- The Astro demo is a Northline marketing site whose homepage hero is the running experiment. Pages are server-rendered so the variant is chosen on each request.

Stats are frequentist. A multi-armed bandit is out of scope.

## Run it

Node.js 22 or newer, and pnpm 10.

```bash
pnpm install
pnpm dev
```

- Dashboard: http://127.0.0.1:43123
- Demo site: http://127.0.0.1:43124

`pnpm dev` starts both. `pnpm dev:dashboard` and `pnpm dev:demo` start one. No accounts or API keys are required. The dashboard seeds a Northline workspace on first launch (Starter plan, one running hero test, one paused pricing test, one draft). Data is written to `apps/dashboard/data/splitline.json`.

Open the demo, then refresh the homepage experiment in the dashboard. The middleware records an exposure. The hero button records a `cta_click` conversion, which is the experiment’s goal. The walkthrough form records `form_submit`, which is stored but not used in the significance test.

The bar on the demo can preview control or variant B without polluting results. “New visitor” clears the assignment cookie. “My assignment” returns to the hashed variant.

## Tests

```bash
pnpm test
```

Covers bucketing, signed cookies, the z-test and sample-size helper, sticky assignment, and the local store.

## Environment

Defaults are enough for the demo. Copy `.env.example` when you want to point at real services.

| Variable | Used by | Default |
| --- | --- | --- |
| `SPLITLINE_SIGNING_SECRET` | middleware and dashboard | `splitline-dev-secret` |
| `SPLITLINE_DATA_PATH` | dashboard | `apps/dashboard/data/splitline.json` |
| `SPLITLINE_CONFIG_URL` | demo middleware | `http://127.0.0.1:43123/api/v1/config` |
| `SPLITLINE_EVENTS_URL` | demo | `http://127.0.0.1:43123/api/v1/events` |
| `SPLITLINE_API_KEY` | demo event writes | `sl_test_northline_demo` |
| `SPLITLINE_ALLOW_PREVIEW` | demo | `1` |
| `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` | dashboard | unset, so the JSON file is used |
| `EDGE_CONFIG`, `EDGE_CONFIG_ID`, `VERCEL_API_TOKEN` | dashboard sync | unset; the config endpoint still serves |
| `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET` | Studio | unset; Studio will not log in without a project |

Change the signing secret before any public deploy. The demo key is a local write-only key and is documented on the API keys page.

## Packages

Install the workspace packages into an Astro app (or copy `examples/astro-middleware.ts`).

```ts
import { getVariant } from "@splitline/astro";

const variant = getVariant(Astro.locals, "homepage-hero");
```

```astro
---
import Experiment from "@splitline/astro/Experiment.astro";
---
<Experiment experiment="homepage-hero" locals={Astro.locals}>
  <h1 slot="control">Control headline</h1>
  <h1 slot="variant_b">Challenger headline</h1>
</Experiment>
```

The edge helper reads a config URL, or Vercel Edge Config when `EDGE_CONFIG` is set and `@vercel/edge-config` is installed. Saving an experiment in the dashboard tries to push that config when `EDGE_CONFIG_ID` and `VERCEL_API_TOKEN` are present. Otherwise it keeps serving `GET /api/v1/config`.

`examples/next-proxy.ts` shows the same decision inside a Next.js 16 `proxy` function. Pass the variant on a request header so the page can render it on the server.

## Sanity

`apps/studio` is a Northline Studio with the plugin installed. The hero field is built with `experimentVariants()`. The document inspector lists experiments whose variant Sanity document id matches the open document, or whose key appears in the document.

```bash
# requires SANITY_STUDIO_PROJECT_ID
pnpm dev:studio
```

Without a Sanity project id, use the dashboard’s preview copy. That is what the demo renders.

## Supabase

Apply `supabase/schema.sql` in your project, insert an `organizations` row, then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The dashboard uses that database instead of the JSON file. Row level security is enabled with no anon policies; the service role is the only client.

## Assignment

A first-party visitor id is created at the edge. It is random, not derived from personal data. The variant is `hash(visitorId + experimentId)` walked across the variant weights. Experiments that share a group are mutually exclusive. `trafficAllocation` is the percent of visitors enrolled; everyone else sees the control and is not counted. Existing assignments stick for running and paused tests. A completed test with a declared winner is served to everyone and is not tracked.

## What this build does not include

- A Vercel Marketplace listing. That needs Vercel’s review, which is outside this repo. Edge Config sync is the integration point.
- Hosted login, billing, or outbound invite email. Teammates are stored locally. Plans enforce the spec’s concurrent-experiment limits only.
- Visual editing, bandits, heatmaps, or hosts other than Vercel.
