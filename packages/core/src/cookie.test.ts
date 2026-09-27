import { describe, expect, it } from "vitest";
import { openAssignment, sealAssignment, verifyPayload } from "./cookie";

describe("signed assignment cookies", () => {
  it("round-trips a payload", async () => {
    const token = await sealAssignment(
      { v: 1, vid: "abc", a: { "homepage-hero": "variant_b" }, exp: 4_000_000_000 },
      "secret",
    );
    const opened = await openAssignment(token, "secret", 1_700_000_000);
    expect(opened?.vid).toBe("abc");
    expect(opened?.a["homepage-hero"]).toBe("variant_b");
  });

  it("rejects a tampered signature and the wrong secret", async () => {
    const token = await sealAssignment(
      { v: 1, vid: "abc", a: {}, exp: 4_000_000_000 },
      "secret",
    );
    const [body] = token.split(".");
    expect(await verifyPayload(`${body}.not-the-signature`, "secret")).toBeNull();
    expect(await openAssignment(token, "other-secret")).toBeNull();
  });

  it("rejects an expired cookie", async () => {
    const token = await sealAssignment(
      { v: 1, vid: "abc", a: {}, exp: 100 },
      "secret",
    );
    expect(await openAssignment(token, "secret", 200)).toBeNull();
  });
});
