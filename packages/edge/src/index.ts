import { assignExperiments, createVisitorId, openAssignment, readCookie, sealAssignment } from "@splitline/core";
import {
  ASSIGNMENT_COOKIE,
  PREVIEW_COOKIE,
  VISITOR_COOKIE,
  type EdgeConfig,
  type ExperimentConfig,
} from "@splitline/core";

const NINETY_DAYS = 60 * 60 * 24 * 90;

export type CookieWrite = {
  name: string;
  value: string;
  maxAge: number;
  httpOnly: boolean;
  path: "/";
  sameSite: "lax";
  secure: boolean;
};

export type Decision = {
  visitorId: string;
  preview: boolean;
  /** Variant key to render. Missing means the visitor is not in the experiment. */
  assignments: Record<string, string>;
  /** Variant keys that should emit an exposure. Preview and holdouts are omitted. */
  track: Record<string, string>;
  cookies: CookieWrite[];
};

export type DecideOptions = {
  signingSecret: string;
  allowPreview?: boolean;
  now?: number;
  secure?: boolean;
};

export async function decide(
  request: Request,
  config: EdgeConfig,
  options: DecideOptions,
): Promise<Decision> {
  const now = options.now ?? Date.now();
  const header = request.headers.get("cookie");
  const sealed = await openAssignment(
    readCookie(header, ASSIGNMENT_COOKIE),
    options.signingSecret,
    now / 1000,
  );
  const existingVisitor = readCookie(header, VISITOR_COOKIE) ?? sealed?.vid;
  const visitorId = existingVisitor || createVisitorId();
  const sticky = sealed && sealed.vid === visitorId ? sealed.a : {};
  const preview = options.allowPreview ? readPreview(request, header) : null;
  const fresh = assignExperiments({
    visitorId,
    experiments: config.experiments as ExperimentConfig[],
  });

  const assignments: Record<string, string> = {};
  const track: Record<string, string> = {};
  const persist: Record<string, string> = {};

  for (const experiment of config.experiments) {
    const real = serveExperiment(experiment, sticky, fresh);
    const forced = previewVariant(experiment, preview);
    const variantKey = forced ?? real.variantKey;
    if (variantKey) assignments[experiment.key] = variantKey;
    if (!forced && real.track && real.variantKey) track[experiment.key] = real.variantKey;
    if (real.persist && real.variantKey) persist[experiment.key] = real.variantKey;
  }

  const cookies: CookieWrite[] = [];
  const secure = options.secure ?? false;
  if (!existingVisitor) {
    cookies.push(cookie(VISITOR_COOKIE, visitorId, NINETY_DAYS, secure));
  }

  const previous = stableJson(sticky);
  const next = stableJson(persist);
  if (!sealed || sealed.vid !== visitorId || previous !== next) {
    const token = await sealAssignment(
      { v: 1, vid: visitorId, a: persist, exp: Math.floor(now / 1000) + NINETY_DAYS },
      options.signingSecret,
    );
    cookies.push(cookie(ASSIGNMENT_COOKIE, token, NINETY_DAYS, secure));
  }

  const previewCookie = readCookie(header, PREVIEW_COOKIE);
  if (options.allowPreview && preview?.raw === "off" && previewCookie) {
    cookies.push(cookie(PREVIEW_COOKIE, "", 0, secure));
  } else if (options.allowPreview && preview && preview.raw !== "off" && preview.raw !== previewCookie) {
    cookies.push(cookie(PREVIEW_COOKIE, preview.raw, 60 * 60 * 12, secure));
  }

  return { visitorId, preview: Boolean(preview && preview.raw !== "off"), assignments, track, cookies };
}

function previewVariant(
  experiment: EdgeConfig["experiments"][number],
  preview: { experimentKey: string; variantKey: string; raw: string } | null,
): string | null {
  if (!preview || preview.experimentKey !== experiment.key) return null;
  const match = experiment.variants.some((variant) => variant.key === preview.variantKey);
  return match ? preview.variantKey : null;
}

function serveExperiment(
  experiment: EdgeConfig["experiments"][number],
  sticky: Record<string, string>,
  fresh: ReturnType<typeof assignExperiments>,
): { variantKey: string | null; track: boolean; persist: boolean } {
  if (experiment.status === "draft") return { variantKey: null, track: false, persist: false };

  if (experiment.status === "completed") {
    const winner =
      experiment.variants.find((variant) => variant.key === experiment.winnerVariantKey) ??
      experiment.variants.find((variant) => variant.key === "control") ??
      experiment.variants[0];
    return { variantKey: winner?.key ?? null, track: false, persist: false };
  }

  const remembered = sticky[experiment.key];
  const rememberedOk =
    remembered && experiment.variants.some((variant) => variant.key === remembered)
      ? remembered
      : null;

  if (experiment.status === "paused") {
    return { variantKey: rememberedOk, track: false, persist: Boolean(rememberedOk) };
  }

  if (rememberedOk) return { variantKey: rememberedOk, track: true, persist: true };
  const enrolled = fresh[experiment.key];
  if (!enrolled) return { variantKey: null, track: false, persist: false };
  return { variantKey: enrolled.variantKey, track: true, persist: true };
}

function readPreview(
  request: Request,
  cookieHeader: string | null,
): { experimentKey: string; variantKey: string; raw: string } | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("sl_preview");
  const raw = fromQuery ?? readCookie(cookieHeader, PREVIEW_COOKIE);
  if (!raw) return null;
  if (raw === "off") return { experimentKey: "", variantKey: "", raw: "off" };
  const separator = raw.indexOf(":");
  if (separator <= 0) return null;
  return {
    experimentKey: raw.slice(0, separator),
    variantKey: raw.slice(separator + 1),
    raw,
  };
}

function stableJson(record: Record<string, string>): string {
  const keys = Object.keys(record).sort();
  return JSON.stringify(Object.fromEntries(keys.map((key) => [key, record[key]])));
}

function cookie(name: string, value: string, maxAge: number, secure: boolean): CookieWrite {
  return { name, value, maxAge, httpOnly: true, path: "/", sameSite: "lax", secure };
}

export type ConfigLoader = () => Promise<EdgeConfig>;

export function createConfigCache(loader: ConfigLoader, ttlMs = 30_000): ConfigLoader {
  let cached: { at: number; value: EdgeConfig } | null = null;
  let pending: Promise<EdgeConfig> | null = null;
  return () => {
    if (cached && Date.now() - cached.at < ttlMs) return Promise.resolve(cached.value);
    if (!pending) {
      pending = loader()
        .then((value) => {
          cached = { at: Date.now(), value };
          pending = null;
          return value;
        })
        .catch((error: unknown) => {
          pending = null;
          if (cached) return cached.value;
          throw error;
        });
    }
    return pending;
  };
}

export function httpConfigLoader(url: string, apiKey?: string): ConfigLoader {
  return async () => {
    const response = await fetch(url, {
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
    });
    if (!response.ok) {
      throw new Error(`Splitline config request failed (${response.status}).`);
    }
    return (await response.json()) as EdgeConfig;
  };
}

/** Reads the `splitline` key from Vercel Edge Config when EDGE_CONFIG is set and the package is installed. */
export async function readOptionalEdgeConfig(key = "splitline"): Promise<EdgeConfig | null> {
  if (!process.env.EDGE_CONFIG) return null;
  try {
    const importer = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<{ get: <T>(key: string) => Promise<T | undefined> }>;
    const mod = await importer("@vercel/edge-config");
    const value = await mod.get<EdgeConfig>(key);
    if (!value || !Array.isArray(value.experiments)) return null;
    return value;
  } catch {
    return null;
  }
}

export async function pushEdgeConfig(config: EdgeConfig): Promise<{ ok: boolean; detail: string }> {
  const id = process.env.EDGE_CONFIG_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (!id || !token) {
    return {
      ok: false,
      detail: "EDGE_CONFIG_ID or VERCEL_API_TOKEN is not set. The config endpoint is still live.",
    };
  }
  const url = new URL(`https://api.vercel.com/v1/edge-config/${id}/items`);
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID);
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      items: [{ operation: "upsert", key: "splitline", value: config }],
    }),
  });
  if (!response.ok) {
    return { ok: false, detail: `Vercel responded ${response.status} while syncing Edge Config.` };
  }
  return { ok: true, detail: "Synced the running experiments to Vercel Edge Config." };
}
