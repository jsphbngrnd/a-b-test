import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFileStore } from "./file-store";

function store() {
  const dir = mkdtempSync(path.join(tmpdir(), "splitline-"));
  return createFileStore(path.join(dir, "store.json"));
}

describe("file store", () => {
  it("seeds a running homepage experiment with a sequential winner signal", async () => {
    const db = store();
    const results = await db.results("exp_homepage_hero");
    const challenger = results.comparisons.find((item) => item.variantKey === "variant_b");
    const control = results.variants.find((item) => item.variantKey === "control");
    const variant = results.variants.find((item) => item.variantKey === "variant_b");
    expect(control?.exposures).toBe(4200);
    expect(variant?.conversions).toBe(228);
    expect(challenger?.call).toBe("winner");
    expect((await db.results("exp_docs_banner")).variants.every((item) => item.exposures === 0)).toBe(true);
  });

  it("counts an exposure once per visitor per day", async () => {
    const db = store();
    const first = await db.ingest({
      experimentKey: "homepage-hero",
      variantKey: "control",
      visitorId: "visitor-demo-1",
      eventType: "exposure",
      eventName: "exposure",
    });
    const second = await db.ingest({
      experimentKey: "homepage-hero",
      variantKey: "control",
      visitorId: "visitor-demo-1",
      eventType: "exposure",
      eventName: "exposure",
    });
    expect(first.accepted).toBe(true);
    expect(second.duplicate).toBe(true);
    const results = await db.results("exp_homepage_hero");
    expect(results.variants.find((item) => item.variantKey === "control")?.exposures).toBe(4201);
  });

  it("blocks a second running experiment on the free plan", async () => {
    const db = store();
    await db.updateOrg({ plan: "free" });
    const created = await db.createExperiment({
      name: "Footer link",
      key: "footer-link",
      description: "A second test.",
      group: null,
      trafficAllocation: 100,
      goalEventName: "cta_click",
      variants: [
        {
          key: "control",
          name: "Control",
          weight: 50,
          sanityDocumentId: "footer",
          payload: { headline: "One", subhead: "A calm footer.", cta: "Read" },
        },
        {
          key: "variant_b",
          name: "Challenger",
          weight: 50,
          sanityDocumentId: "footer",
          payload: { headline: "Two", subhead: "A louder footer.", cta: "Look" },
        },
      ],
    });
    await expect(db.setStatus(created.id, "running")).rejects.toThrow(/Free plan/);
  });

  it("authenticates the seeded demo key and not a revoked key", async () => {
    const db = store();
    expect((await db.authenticate("sl_test_northline_demo"))?.scopes).toContain("events:write");
    await db.revokeKey("key_demo");
    expect(await db.authenticate("sl_test_northline_demo")).toBeNull();
  });
});
