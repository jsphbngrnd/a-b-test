import { defineMiddleware } from "astro:middleware";
import { DEMO_API_KEY, DEV_SIGNING_SECRET } from "@splitline/core";
import { sendEvent } from "@splitline/client";
import { createConfigCache, decide, httpConfigLoader, readOptionalEdgeConfig } from "@splitline/edge";

const configUrl = process.env.SPLITLINE_CONFIG_URL ?? "http://127.0.0.1:43123/api/v1/config";
const eventsUrl = process.env.SPLITLINE_EVENTS_URL ?? "http://127.0.0.1:43123/api/v1/events";
const signingSecret = process.env.SPLITLINE_SIGNING_SECRET ?? DEV_SIGNING_SECRET;
const apiKey = process.env.SPLITLINE_API_KEY ?? DEMO_API_KEY;
const allowPreview = (process.env.SPLITLINE_ALLOW_PREVIEW ?? "1") !== "0";

const loadConfig = createConfigCache(async () => {
  const fromEdge = await readOptionalEdgeConfig();
  if (fromEdge) return fromEdge;
  return httpConfigLoader(configUrl)();
}, 15_000);

const exposureByPath: Record<string, string> = {
  "/": "homepage-hero",
  "/pricing": "pricing-cta",
};

export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const config = await loadConfig();
    const decision = await decide(context.request, config, { signingSecret, allowPreview });
    for (const cookie of decision.cookies) {
      if (cookie.maxAge <= 0) {
        context.cookies.delete(cookie.name, { path: "/" });
      } else {
        context.cookies.set(cookie.name, cookie.value, {
          path: "/",
          maxAge: cookie.maxAge,
          httpOnly: true,
          sameSite: "lax",
          secure: cookie.secure,
        });
      }
    }
    context.locals.splitline = {
      visitorId: decision.visitorId,
      assignments: decision.assignments,
      track: decision.track,
      preview: decision.preview,
      config,
      error: null,
    };
    const experimentKey = exposureByPath[new URL(context.request.url).pathname];
    const variantKey = experimentKey ? decision.track[experimentKey] : undefined;
    if (experimentKey && variantKey) {
      await sendEvent({
        endpoint: eventsUrl,
        apiKey,
        event: {
          experimentKey,
          variantKey,
          visitorId: decision.visitorId,
          eventType: "exposure",
          eventName: "exposure",
        },
      });
    }
  } catch (error) {
    context.locals.splitline = {
      visitorId: "",
      assignments: {},
      track: {},
      preview: false,
      config: null,
      error: error instanceof Error ? error.message : "The experiment config could not be loaded.",
    };
  }
  return next();
});
