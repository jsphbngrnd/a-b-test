import { DEV_SIGNING_SECRET } from "@splitline/core";
import { decide } from "@splitline/edge";
import type { EdgeConfig } from "@splitline/core";

/**
 * Next.js 16 proxy (the successor to middleware.ts).
 * Install @splitline/edge and @splitline/core, then adapt this file.
 * Variant resolution happens before the response, so Astro or Next SSR
 * can render the assigned content with no client-side swap.
 */
export async function proxy(request: Request) {
  const config: EdgeConfig = { generatedAt: new Date().toISOString(), experiments: [] };
  const decision = await decide(request, config, {
    signingSecret: process.env.SPLITLINE_SIGNING_SECRET ?? DEV_SIGNING_SECRET,
  });
  const headers = new Headers(request.headers);
  headers.set("x-splitline-visitor", decision.visitorId);
  headers.set("x-splitline-assignments", JSON.stringify(decision.assignments));
  return { headers, cookies: decision.cookies };
}
