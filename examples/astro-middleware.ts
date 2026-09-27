import { defineMiddleware } from "astro:middleware";
import { DEMO_API_KEY, DEV_SIGNING_SECRET } from "@splitline/core";
import { createConfigCache, decide, httpConfigLoader } from "@splitline/edge";

const loadConfig = createConfigCache(
  httpConfigLoader(process.env.SPLITLINE_CONFIG_URL ?? "http://127.0.0.1:43123/api/v1/config"),
);

export const onRequest = defineMiddleware(async (context, next) => {
  const config = await loadConfig();
  const request = new Request(context.url, context.request);
  const decision = await decide(request, config, {
    signingSecret: process.env.SPLITLINE_SIGNING_SECRET ?? DEV_SIGNING_SECRET,
    allowPreview: process.env.SPLITLINE_ALLOW_PREVIEW === "1",
  });
  for (const cookie of decision.cookies) {
    if (cookie.maxAge <= 0) context.cookies.delete(cookie.name, { path: "/" });
    else context.cookies.set(cookie.name, cookie.value, { path: "/", maxAge: cookie.maxAge, httpOnly: true, sameSite: "lax" });
  }
  context.locals.visitorId = decision.visitorId;
  context.locals.assignments = decision.assignments;
  void DEMO_API_KEY;
  return next();
});
