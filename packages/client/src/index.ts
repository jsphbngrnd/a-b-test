export type TrackEvent = {
  experimentKey: string;
  variantKey: string;
  visitorId: string;
  eventType: "exposure" | "conversion" | "custom";
  eventName: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function sendEvent(options: {
  endpoint: string;
  apiKey: string;
  event: TrackEvent;
  timeoutMs?: number;
}): Promise<{ ok: boolean; detail: string }> {
  const timeoutMs = options.timeoutMs ?? 800;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(options.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(options.event),
      signal: controller.signal,
      keepalive: true,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, detail: body?.error ?? `Event request failed (${response.status}).` };
    }
    return { ok: true, detail: "accepted" };
  } catch {
    return { ok: false, detail: "Event request did not finish." };
  } finally {
    clearTimeout(timer);
  }
}
