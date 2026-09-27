import { describe, expect, it } from "vitest";
import { DEV_SIGNING_SECRET, type EdgeConfig } from "@splitline/core";
import { decide } from "./index";

const config: EdgeConfig = {
  generatedAt: "2026-09-27T00:00:00.000Z",
  experiments: [
    {
      id: "exp_hero",
      key: "homepage-hero",
      status: "running",
      group: null,
      trafficAllocation: 100,
      winnerVariantKey: null,
      variants: [
        {
          id: "var_control",
          key: "control",
          weight: 50,
          payload: { headline: "A", subhead: "", cta: "A" },
        },
        {
          id: "var_b",
          key: "variant_b",
          weight: 50,
          payload: { headline: "B", subhead: "", cta: "B" },
        },
      ],
    },
  ],
};

const secret = DEV_SIGNING_SECRET;

describe("decide", () => {
  it("keeps a signed assignment when the request comes back", async () => {
    const first = await decide(new Request("https://example.com/"), config, {
      signingSecret: secret,
    });
    const cookie = first.cookies.map((item) => `${item.name}=${item.value}`).join("; ");
    const second = await decide(new Request("https://example.com/", { headers: { cookie } }), config, {
      signingSecret: secret,
    });
    expect(second.visitorId).toBe(first.visitorId);
    expect(second.assignments["homepage-hero"]).toBe(first.assignments["homepage-hero"]);
    expect(second.cookies.some((item) => item.name === "sl_asg")).toBe(false);
    expect(second.track["homepage-hero"]).toBe(first.assignments["homepage-hero"]);
  });

  it("serves a preview without tracking it", async () => {
    const decision = await decide(
      new Request("https://example.com/?sl_preview=homepage-hero:variant_b"),
      config,
      { signingSecret: secret, allowPreview: true },
    );
    expect(decision.assignments["homepage-hero"]).toBe("variant_b");
    expect(decision.track["homepage-hero"]).toBeUndefined();
    expect(decision.preview).toBe(true);
  });

  it("serves the declared winner after an experiment completes", async () => {
    const completed: EdgeConfig = {
      ...config,
      experiments: [
        {
          ...config.experiments[0],
          status: "completed",
          winnerVariantKey: "variant_b",
        },
      ],
    };
    const decision = await decide(new Request("https://example.com/"), completed, {
      signingSecret: secret,
    });
    expect(decision.assignments["homepage-hero"]).toBe("variant_b");
    expect(decision.track["homepage-hero"]).toBeUndefined();
  });
});
