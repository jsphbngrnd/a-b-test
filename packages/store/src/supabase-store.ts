import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createId, PLANS, type EdgeConfig } from "@splitline/core";
import {
  applyStatus,
  assertCanRun,
  computeResults,
  dayKey,
  generateApiKey,
  hashKey,
  KEY_SCOPES,
  mergeVariants,
  monthKey,
  publicKey,
  seedState,
  SplitlineError,
  toEdgeConfig,
  validateExperimentInput,
} from "./model";
import type {
  ApiKeyRecord,
  EdgeSyncState,
  Experiment,
  ExperimentInput,
  IngestInput,
  Organization,
  Rollup,
  State,
  Store,
  StoredEvent,
  Teammate,
  Variant,
} from "./types";

type OrgRow = {
  id: string;
  name: string;
  plan: Organization["plan"];
  sanity_project_id: string;
  vercel_project_id: string;
  usage_month: string;
  events_this_month: number;
  edge_sync: EdgeSyncState | null;
};

export function createSupabaseStore(options: { url: string; serviceRoleKey: string }): Store {
  const supabase = createClient(options.url, options.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function orgRow(): Promise<OrgRow> {
    const { data, error } = await supabase.from("organizations").select("*").limit(1).maybeSingle();
    if (error) throw new SplitlineError(error.message);
    if (!data) {
      throw new SplitlineError(
        "Supabase is connected, but there is no organization row. Run supabase/schema.sql, then insert an organization.",
      );
    }
    return data as OrgRow;
  }

  function mapOrg(row: OrgRow): Organization {
    return {
      id: row.id,
      name: row.name,
      plan: row.plan,
      sanityProjectId: row.sanity_project_id ?? "",
      vercelProjectId: row.vercel_project_id ?? "",
    };
  }

  async function loadExperiments(orgId: string): Promise<Experiment[]> {
    const { data, error } = await supabase
      .from("experiments")
      .select("*")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false });
    if (error) throw new SplitlineError(error.message);
    const rows = data ?? [];
    const ids = rows.map((row) => row.id as string);
    const variants =
      ids.length === 0
        ? []
        : await supabase.from("variants").select("*").in("experiment_id", ids).then((result) => {
            if (result.error) throw new SplitlineError(result.error.message);
            return result.data ?? [];
          });
    return rows.map((row) => mapExperiment(row, variants.filter((variant) => variant.experiment_id === row.id)));
  }

  async function snapshot(): Promise<State> {
    const org = await orgRow();
    const experiments = await loadExperiments(org.id);
    const { data: keys, error: keyError } = await supabase.from("api_keys").select("*").eq("org_id", org.id);
    if (keyError) throw new SplitlineError(keyError.message);
    const { data: teammates, error: teammateError } = await supabase.from("teammates").select("*").eq("org_id", org.id);
    if (teammateError) throw new SplitlineError(teammateError.message);
    const base = seedState();
    return {
      ...base,
      org: mapOrg(org),
      experiments,
      rollups: [],
      events: [],
      dedupe: [],
      apiKeys: (keys ?? []).map(mapKey),
      teammates: (teammates ?? []).map(mapTeammate),
      usageMonth: org.usage_month,
      eventsThisMonth: org.events_this_month,
      edgeSync: org.edge_sync,
    };
  }

  return {
    kind: "supabase",
    async getOrg() {
      return mapOrg(await orgRow());
    },
    async updateOrg(patch) {
      const current = await orgRow();
      const state = await snapshot();
      const next = { ...state.org };
      if (patch.name !== undefined) {
        const name = patch.name.trim();
        if (name.length < 2 || name.length > 80) throw new SplitlineError("Workspace names are between 2 and 80 characters.");
        next.name = name;
      }
      if (patch.plan !== undefined) {
        if (!PLANS[patch.plan]) throw new SplitlineError("Choose Free, Starter, or Growth.");
        const running = state.experiments.filter((experiment) => experiment.status === "running").length;
        if (running > PLANS[patch.plan].concurrentExperiments) {
          throw new SplitlineError("Pause a running experiment before moving to a plan with a lower limit.");
        }
        next.plan = patch.plan;
      }
      if (patch.sanityProjectId !== undefined) next.sanityProjectId = patch.sanityProjectId.trim();
      if (patch.vercelProjectId !== undefined) next.vercelProjectId = patch.vercelProjectId.trim();
      const { error } = await supabase
        .from("organizations")
        .update({
          name: next.name,
          plan: next.plan,
          sanity_project_id: next.sanityProjectId,
          vercel_project_id: next.vercelProjectId,
        })
        .eq("id", current.id);
      if (error) throw new SplitlineError(error.message);
      return next;
    },
    async listExperiments() {
      return loadExperiments((await orgRow()).id);
    },
    async getExperiment(id) {
      const experiments = await loadExperiments((await orgRow()).id);
      return experiments.find((experiment) => experiment.id === id) ?? null;
    },
    async createExperiment(input) {
      const org = await orgRow();
      const existing = await loadExperiments(org.id);
      validateExperimentInput(input, existing.map((experiment) => experiment.key));
      const now = new Date().toISOString();
      const experiment: Experiment = {
        id: createId("exp"),
        orgId: org.id,
        key: input.key.trim(),
        name: input.name.trim(),
        description: input.description.trim(),
        status: "draft",
        group: input.group?.trim() || null,
        trafficAllocation: input.trafficAllocation,
        goalEventName: input.goalEventName.trim(),
        startedAt: null,
        endedAt: null,
        winnerVariantId: null,
        variants: mergeVariants([], input.variants, () => createId("var")),
        createdAt: now,
        updatedAt: now,
      };
      await writeExperiment(supabase, experiment);
      return experiment;
    },
    async updateExperiment(id, input) {
      const org = await orgRow();
      const existing = await loadExperiments(org.id);
      const current = existing.find((experiment) => experiment.id === id);
      if (!current) throw new SplitlineError("That experiment is no longer in this workspace.");
      validateExperimentInput(
        input,
        existing.filter((experiment) => experiment.id !== id).map((experiment) => experiment.key),
      );
      const next: Experiment = {
        ...current,
        key: input.key.trim(),
        name: input.name.trim(),
        description: input.description.trim(),
        group: input.group?.trim() || null,
        trafficAllocation: input.trafficAllocation,
        goalEventName: input.goalEventName.trim(),
        variants: mergeVariants(current.variants, input.variants, () => createId("var")),
        updatedAt: new Date().toISOString(),
      };
      if (next.winnerVariantId && !next.variants.some((variant) => variant.id === next.winnerVariantId)) {
        next.winnerVariantId = null;
      }
      await supabase.from("variants").delete().eq("experiment_id", id);
      await writeExperiment(supabase, next);
      return next;
    },
    async deleteExperiment(id) {
      const { error } = await supabase.from("experiments").delete().eq("id", id);
      if (error) throw new SplitlineError(error.message);
    },
    async setStatus(id, status) {
      const state = await snapshot();
      const current = state.experiments.find((experiment) => experiment.id === id);
      if (!current) throw new SplitlineError("That experiment is no longer in this workspace.");
      if (status === "running") assertCanRun(state, id);
      const next = applyStatus(current, status, new Date().toISOString());
      const { error } = await supabase
        .from("experiments")
        .update({
          status: next.status,
          started_at: next.startedAt,
          ended_at: next.endedAt,
          winner_variant_id: next.winnerVariantId,
          updated_at: next.updatedAt,
        })
        .eq("id", id);
      if (error) throw new SplitlineError(error.message);
      return next;
    },
    async declareWinner(id, variantId) {
      const experiment = (await loadExperiments((await orgRow()).id)).find((item) => item.id === id);
      if (!experiment) throw new SplitlineError("That experiment is no longer in this workspace.");
      if (!experiment.variants.some((variant) => variant.id === variantId)) {
        throw new SplitlineError("That variant is not part of this experiment.");
      }
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("experiments")
        .update({ status: "completed", winner_variant_id: variantId, ended_at: now, updated_at: now })
        .eq("id", id);
      if (error) throw new SplitlineError(error.message);
      return { ...experiment, status: "completed", winnerVariantId: variantId, endedAt: now, updatedAt: now };
    },
    async ingest(input) {
      const org = await orgRow();
      await rollSupabaseMonth(supabase, org);
      const experiments = await loadExperiments(org.id);
      const experiment = experiments.find((item) => item.key === input.experimentKey);
      if (!experiment) return { accepted: false, duplicate: false, reason: "Unknown experiment." };
      if (experiment.status !== "running") return { accepted: false, duplicate: false, reason: "This experiment is not running." };
      const variant = experiment.variants.find((item) => item.key === input.variantKey);
      if (!variant) return { accepted: false, duplicate: false, reason: "Unknown variant." };
      if (!/^[a-zA-Z0-9_-]{8,128}$/.test(input.visitorId)) {
        return { accepted: false, duplicate: false, reason: "Visitor id is not valid." };
      }
      if (!["exposure", "conversion", "custom"].includes(input.eventType)) {
        return { accepted: false, duplicate: false, reason: "Unknown event type." };
      }
      if (!/^[a-z0-9_.:-]{1,80}$/.test(input.eventName)) {
        return { accepted: false, duplicate: false, reason: "Event name is not valid." };
      }
      const today = dayKey();
      const dedupeKey =
        input.eventType === "exposure"
          ? `exposure:${experiment.id}:${input.visitorId}:${today}`
          : input.eventType === "conversion"
            ? `conversion:${experiment.id}:${input.visitorId}:${input.eventName}`
            : null;
      if (dedupeKey) {
        const inserted = await supabase.from("event_dedupe").insert({ dedupe_key: dedupeKey });
        if (inserted.error?.code === "23505") {
          return { accepted: false, duplicate: true, reason: "Already recorded for this visitor." };
        }
        if (inserted.error) throw new SplitlineError(inserted.error.message);
      }
      const event: StoredEvent = {
        id: createId("evt"),
        orgId: org.id,
        experimentId: experiment.id,
        variantId: variant.id,
        visitorId: input.visitorId,
        eventType: input.eventType,
        eventName: input.eventName,
        occurredAt: new Date().toISOString(),
        metadata: input.metadata ?? {},
      };
      const { error } = await supabase.from("events").insert({
        id: event.id,
        org_id: event.orgId,
        experiment_id: event.experimentId,
        variant_id: event.variantId,
        visitor_id: event.visitorId,
        event_type: event.eventType,
        event_name: event.eventName,
        occurred_at: event.occurredAt,
        metadata: event.metadata,
      });
      if (error) throw new SplitlineError(error.message);
      const primary =
        (input.eventType === "exposure" && input.eventName === "exposure") ||
        (input.eventType === "conversion" && input.eventName === experiment.goalEventName);
      if (primary) await bumpRollup(supabase, experiment.id, variant.id, today, input.eventType);
      await supabase
        .from("organizations")
        .update({ events_this_month: org.events_this_month + 1 })
        .eq("id", org.id);
      return { accepted: true, duplicate: false, reason: "Recorded." };
    },
    async recentEvents(options) {
      const org = await orgRow();
      let query = supabase
        .from("events")
        .select("*")
        .eq("org_id", org.id)
        .order("occurred_at", { ascending: false })
        .limit(options?.limit ?? 40);
      if (options?.experimentId) query = query.eq("experiment_id", options.experimentId);
      const { data, error } = await query;
      if (error) throw new SplitlineError(error.message);
      return (data ?? []).map(mapEvent);
    },
    async results(experimentId) {
      const experiment = (await loadExperiments((await orgRow()).id)).find((item) => item.id === experimentId);
      if (!experiment) throw new SplitlineError("That experiment is no longer in this workspace.");
      const { data, error } = await supabase.from("results_daily").select("*").eq("experiment_id", experimentId);
      if (error) throw new SplitlineError(error.message);
      const rollups: Rollup[] = (data ?? []).map((row) => ({
        experimentId: row.experiment_id,
        variantId: row.variant_id,
        date: row.date,
        exposures: row.exposures,
        conversions: row.conversions,
      }));
      return computeResults(experiment, rollups);
    },
    async listKeys() {
      const org = await orgRow();
      const { data, error } = await supabase.from("api_keys").select("*").eq("org_id", org.id);
      if (error) throw new SplitlineError(error.message);
      return (data ?? []).map((row) => publicKey(mapKey(row)));
    },
    async createKey(name, scopes) {
      const org = await orgRow();
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 60) throw new SplitlineError("Key names are between 2 and 60 characters.");
      const cleanScopes = scopes.filter((scope) => (KEY_SCOPES as readonly string[]).includes(scope));
      if (cleanScopes.length === 0) throw new SplitlineError("Pick at least one scope.");
      const plaintext = generateApiKey();
      const record: ApiKeyRecord = {
        id: createId("key"),
        orgId: org.id,
        name: trimmed,
        keyHash: hashKey(plaintext),
        keyPrefix: plaintext.slice(0, 12),
        scopes: cleanScopes,
        createdAt: new Date().toISOString(),
        revokedAt: null,
      };
      const { error } = await supabase.from("api_keys").insert({
        id: record.id,
        org_id: record.orgId,
        name: record.name,
        key_hash: record.keyHash,
        key_prefix: record.keyPrefix,
        scopes: record.scopes,
        created_at: record.createdAt,
        revoked_at: null,
      });
      if (error) throw new SplitlineError(error.message);
      return { key: publicKey(record), plaintext };
    },
    async revokeKey(id) {
      const { error } = await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new SplitlineError(error.message);
    },
    async authenticate(plaintext) {
      const { data, error } = await supabase
        .from("api_keys")
        .select("scopes, revoked_at")
        .eq("key_hash", hashKey(plaintext))
        .maybeSingle();
      if (error) throw new SplitlineError(error.message);
      if (!data || data.revoked_at) return null;
      return { scopes: data.scopes as string[] };
    },
    async listTeammates() {
      const org = await orgRow();
      const { data, error } = await supabase.from("teammates").select("*").eq("org_id", org.id);
      if (error) throw new SplitlineError(error.message);
      return (data ?? []).map(mapTeammate);
    },
    async inviteTeammate(input) {
      const org = await orgRow();
      const name = input.name.trim();
      const email = input.email.trim().toLowerCase();
      if (name.length < 2) throw new SplitlineError("Add the teammate's name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SplitlineError("That email address does not look complete.");
      const teammate: Teammate = { id: createId("mate"), name, email, role: input.role, status: "invited" };
      const { error } = await supabase.from("teammates").insert({
        id: teammate.id,
        org_id: org.id,
        name,
        email,
        role: input.role,
        status: "invited",
      });
      if (error) throw new SplitlineError(error.message);
      return teammate;
    },
    async removeTeammate(id) {
      const { error } = await supabase.from("teammates").delete().eq("id", id);
      if (error) throw new SplitlineError(error.message);
    },
    async edgeConfig() {
      return toEdgeConfig({ experiments: await loadExperiments((await orgRow()).id) });
    },
    async usage() {
      const org = await rollSupabaseMonth(supabase, await orgRow());
      return {
        month: org.usage_month,
        events: org.events_this_month,
        limit: PLANS[org.plan].eventsPerMonth,
        plan: org.plan,
      };
    },
    async getEdgeSync() {
      return (await orgRow()).edge_sync;
    },
    async setEdgeSync(sync) {
      const org = await orgRow();
      const { error } = await supabase.from("organizations").update({ edge_sync: sync }).eq("id", org.id);
      if (error) throw new SplitlineError(error.message);
    },
    async experimentsForDocument(documentId, keys) {
      const experiments = await loadExperiments((await orgRow()).id);
      const wanted = new Set(keys);
      return experiments.filter(
        (experiment) =>
          wanted.has(experiment.key) ||
          experiment.variants.some((variant) => variant.sanityDocumentId === documentId && documentId !== ""),
      );
    },
  };
}

async function writeExperiment(supabase: SupabaseClient, experiment: Experiment) {
  const { error } = await supabase.from("experiments").upsert({
    id: experiment.id,
    org_id: experiment.orgId,
    key: experiment.key,
    name: experiment.name,
    description: experiment.description,
    status: experiment.status,
    traffic_allocation: experiment.trafficAllocation,
    experiment_group: experiment.group,
    goal_event_name: experiment.goalEventName,
    started_at: experiment.startedAt,
    ended_at: experiment.endedAt,
    winner_variant_id: experiment.winnerVariantId,
    created_at: experiment.createdAt,
    updated_at: experiment.updatedAt,
  });
  if (error) throw new SplitlineError(error.message);
  if (experiment.variants.length === 0) return;
  const { error: variantError } = await supabase.from("variants").insert(
    experiment.variants.map((variant) => ({
      id: variant.id,
      experiment_id: experiment.id,
      key: variant.key,
      name: variant.name,
      weight: variant.weight,
      sanity_document_id: variant.sanityDocumentId,
      payload: variant.payload,
    })),
  );
  if (variantError) throw new SplitlineError(variantError.message);
}

async function bumpRollup(
  supabase: SupabaseClient,
  experimentId: string,
  variantId: string,
  date: string,
  eventType: IngestInput["eventType"],
) {
  const { data, error } = await supabase
    .from("results_daily")
    .select("exposures, conversions")
    .eq("experiment_id", experimentId)
    .eq("variant_id", variantId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw new SplitlineError(error.message);
  const exposures = (data?.exposures ?? 0) + (eventType === "exposure" ? 1 : 0);
  const conversions = (data?.conversions ?? 0) + (eventType === "conversion" ? 1 : 0);
  const { error: upsertError } = await supabase.from("results_daily").upsert({
    experiment_id: experimentId,
    variant_id: variantId,
    date,
    exposures,
    conversions,
  });
  if (upsertError) throw new SplitlineError(upsertError.message);
}

async function rollSupabaseMonth(supabase: SupabaseClient, org: OrgRow): Promise<OrgRow> {
  const month = monthKey();
  if (org.usage_month === month) return org;
  const { error } = await supabase
    .from("organizations")
    .update({ usage_month: month, events_this_month: 0 })
    .eq("id", org.id);
  if (error) throw new SplitlineError(error.message);
  return { ...org, usage_month: month, events_this_month: 0 };
}

function mapExperiment(row: Record<string, unknown>, variants: Record<string, unknown>[]): Experiment {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    key: String(row.key),
    name: String(row.name),
    description: String(row.description ?? ""),
    status: row.status as Experiment["status"],
    group: (row.experiment_group as string | null) ?? null,
    trafficAllocation: Number(row.traffic_allocation),
    goalEventName: String(row.goal_event_name ?? "cta_click"),
    startedAt: (row.started_at as string | null) ?? null,
    endedAt: (row.ended_at as string | null) ?? null,
    winnerVariantId: (row.winner_variant_id as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    variants: variants.map(mapVariant),
  };
}

function mapVariant(row: Record<string, unknown>): Variant {
  const payload = (row.payload ?? {}) as Variant["payload"];
  return {
    id: String(row.id),
    key: String(row.key),
    name: String(row.name),
    weight: Number(row.weight),
    sanityDocumentId: String(row.sanity_document_id ?? ""),
    payload: {
      headline: payload.headline ?? "",
      subhead: payload.subhead ?? "",
      cta: payload.cta ?? "",
    },
  };
}

function mapKey(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    name: String(row.name),
    keyHash: String(row.key_hash),
    keyPrefix: String(row.key_prefix),
    scopes: (row.scopes as string[]) ?? [],
    createdAt: String(row.created_at),
    revokedAt: (row.revoked_at as string | null) ?? null,
  };
}

function mapEvent(row: Record<string, unknown>): StoredEvent {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    experimentId: String(row.experiment_id),
    variantId: String(row.variant_id),
    visitorId: String(row.visitor_id),
    eventType: row.event_type as StoredEvent["eventType"],
    eventName: String(row.event_name),
    occurredAt: String(row.occurred_at),
    metadata: (row.metadata as StoredEvent["metadata"]) ?? {},
  };
}

function mapTeammate(row: Record<string, unknown>): Teammate {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as Teammate["role"],
    status: row.status as Teammate["status"],
  };
}

export type { EdgeConfig };
