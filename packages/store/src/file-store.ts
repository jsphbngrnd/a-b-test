import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createId, PLANS } from "@splitline/core";
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
  EdgeSyncState,
  Experiment,
  ExperimentInput,
  IngestInput,
  Organization,
  PublicApiKey,
  State,
  Store,
  StoredEvent,
  Teammate,
} from "./types";

export function createFileStore(filePath: string): Store {
  const state = load(filePath);
  let queue: Promise<unknown> = Promise.resolve();

  function persist() {
    mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.tmp`;
    writeFileSync(temporary, JSON.stringify(state));
    renameSync(temporary, filePath);
  }

  function exclusive<T>(fn: () => T): Promise<T> {
    const run = queue.then(() => fn());
    queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function rollMonth(now = new Date()) {
    const month = monthKey(now);
    if (state.usageMonth !== month) {
      state.usageMonth = month;
      state.eventsThisMonth = 0;
    }
  }

  function requireExperiment(id: string): Experiment {
    const experiment = state.experiments.find((item) => item.id === id);
    if (!experiment) throw new SplitlineError("That experiment is no longer in this workspace.");
    return experiment;
  }

  function sanitizeMetadata(metadata: IngestInput["metadata"]): StoredEvent["metadata"] {
    if (!metadata || typeof metadata !== "object") return {};
    const entries = Object.entries(metadata).slice(0, 20);
    const clean: StoredEvent["metadata"] = {};
    for (const [key, value] of entries) {
      if (!/^[a-zA-Z0-9_.:-]{1,40}$/.test(key)) continue;
      if (typeof value === "string") clean[key] = value.slice(0, 200);
      else if (typeof value === "number" || typeof value === "boolean" || value === null) clean[key] = value;
    }
    return clean;
  }

  return {
    kind: "file",
    async getOrg() {
      return state.org;
    },
    updateOrg(patch) {
      return exclusive(() => {
        if (patch.name !== undefined) {
          const name = patch.name.trim();
          if (name.length < 2 || name.length > 80) {
            throw new SplitlineError("Workspace names are between 2 and 80 characters.");
          }
          state.org.name = name;
        }
        if (patch.plan !== undefined) {
          if (!PLANS[patch.plan]) throw new SplitlineError("Choose Free, Starter, or Growth.");
          const running = state.experiments.filter((experiment) => experiment.status === "running").length;
          if (running > PLANS[patch.plan].concurrentExperiments) {
            throw new SplitlineError("Pause a running experiment before moving to a plan with a lower limit.");
          }
          state.org.plan = patch.plan;
        }
        if (patch.sanityProjectId !== undefined) state.org.sanityProjectId = patch.sanityProjectId.trim();
        if (patch.vercelProjectId !== undefined) state.org.vercelProjectId = patch.vercelProjectId.trim();
        persist();
        return state.org;
      });
    },
    async listExperiments() {
      return [...state.experiments].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    async getExperiment(id) {
      return state.experiments.find((experiment) => experiment.id === id) ?? null;
    },
    createExperiment(input) {
      return exclusive(() => {
        validateExperimentInput(
          input,
          state.experiments.map((experiment) => experiment.key),
        );
        const now = new Date().toISOString();
        const experiment: Experiment = {
          id: createId("exp"),
          orgId: state.org.id,
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
        state.experiments.unshift(experiment);
        persist();
        return experiment;
      });
    },
    updateExperiment(id, input) {
      return exclusive(() => {
        const current = requireExperiment(id);
        validateExperimentInput(
          input,
          state.experiments.filter((experiment) => experiment.id !== id).map((experiment) => experiment.key),
        );
        current.key = input.key.trim();
        current.name = input.name.trim();
        current.description = input.description.trim();
        current.group = input.group?.trim() || null;
        current.trafficAllocation = input.trafficAllocation;
        current.goalEventName = input.goalEventName.trim();
        current.variants = mergeVariants(current.variants, input.variants, () => createId("var"));
        if (
          current.winnerVariantId &&
          !current.variants.some((variant) => variant.id === current.winnerVariantId)
        ) {
          current.winnerVariantId = null;
        }
        current.updatedAt = new Date().toISOString();
        persist();
        return current;
      });
    },
    deleteExperiment(id) {
      return exclusive(() => {
        if (!state.experiments.some((experiment) => experiment.id === id)) {
          throw new SplitlineError("That experiment is no longer in this workspace.");
        }
        state.experiments = state.experiments.filter((experiment) => experiment.id !== id);
        state.rollups = state.rollups.filter((row) => row.experimentId !== id);
        state.events = state.events.filter((event) => event.experimentId !== id);
        state.dedupe = state.dedupe.filter((key) => !key.includes(id));
        persist();
      });
    },
    setStatus(id, status) {
      return exclusive(() => {
        const current = requireExperiment(id);
        if (status === "running") assertCanRun(state, id);
        const next = applyStatus(current, status, new Date().toISOString());
        Object.assign(current, next);
        persist();
        return current;
      });
    },
    declareWinner(id, variantId) {
      return exclusive(() => {
        const current = requireExperiment(id);
        if (!current.variants.some((variant) => variant.id === variantId)) {
          throw new SplitlineError("That variant is not part of this experiment.");
        }
        const now = new Date().toISOString();
        current.status = "completed";
        current.winnerVariantId = variantId;
        current.endedAt = now;
        current.updatedAt = now;
        persist();
        return current;
      });
    },
    ingest(input) {
      return exclusive(() => {
        rollMonth();
        const experiment = state.experiments.find((item) => item.key === input.experimentKey);
        if (!experiment) return { accepted: false, duplicate: false, reason: "Unknown experiment." };
        if (experiment.status !== "running") {
          return { accepted: false, duplicate: false, reason: "This experiment is not running." };
        }
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
        if (dedupeKey && state.dedupe.includes(dedupeKey)) {
          return { accepted: false, duplicate: true, reason: "Already recorded for this visitor." };
        }
        const event: StoredEvent = {
          id: createId("evt"),
          orgId: state.org.id,
          experimentId: experiment.id,
          variantId: variant.id,
          visitorId: input.visitorId,
          eventType: input.eventType,
          eventName: input.eventName,
          occurredAt: new Date().toISOString(),
          metadata: sanitizeMetadata(input.metadata),
        };
        state.events.unshift(event);
        state.events = state.events.slice(0, 200);
        if (dedupeKey) {
          state.dedupe.push(dedupeKey);
          if (state.dedupe.length > 20_000) state.dedupe = state.dedupe.slice(-20_000);
        }
        const primary =
          (input.eventType === "exposure" && input.eventName === "exposure") ||
          (input.eventType === "conversion" && input.eventName === experiment.goalEventName);
        if (primary) {
          const row = state.rollups.find(
            (item) =>
              item.experimentId === experiment.id && item.variantId === variant.id && item.date === today,
          );
          if (row) {
            if (input.eventType === "exposure") row.exposures += 1;
            else row.conversions += 1;
          } else {
            state.rollups.push({
              experimentId: experiment.id,
              variantId: variant.id,
              date: today,
              exposures: input.eventType === "exposure" ? 1 : 0,
              conversions: input.eventType === "conversion" ? 1 : 0,
            });
          }
        }
        state.eventsThisMonth += 1;
        persist();
        return { accepted: true, duplicate: false, reason: "Recorded." };
      });
    },
    async recentEvents(options) {
      const limit = options?.limit ?? 40;
      return state.events
        .filter((event) => !options?.experimentId || event.experimentId === options.experimentId)
        .slice(0, limit);
    },
    async results(experimentId) {
      return computeResults(requireExperiment(experimentId), state.rollups);
    },
    async listKeys() {
      return state.apiKeys.map((key) => publicKey(key));
    },
    createKey(name, scopes) {
      return exclusive(() => {
        const trimmed = name.trim();
        if (trimmed.length < 2 || trimmed.length > 60) {
          throw new SplitlineError("Key names are between 2 and 60 characters.");
        }
        const cleanScopes = scopes.filter((scope) => (KEY_SCOPES as readonly string[]).includes(scope));
        if (cleanScopes.length === 0) throw new SplitlineError("Pick at least one scope.");
        const plaintext = generateApiKey();
        const record = {
          id: createId("key"),
          orgId: state.org.id,
          name: trimmed,
          keyHash: hashKey(plaintext),
          keyPrefix: plaintext.slice(0, 12),
          scopes: cleanScopes,
          createdAt: new Date().toISOString(),
          revokedAt: null,
        };
        state.apiKeys.unshift(record);
        persist();
        return { key: publicKey(record), plaintext };
      });
    },
    revokeKey(id) {
      return exclusive(() => {
        const key = state.apiKeys.find((item) => item.id === id);
        if (!key) throw new SplitlineError("That API key does not exist.");
        key.revokedAt = new Date().toISOString();
        persist();
      });
    },
    async authenticate(plaintext) {
      const hashed = hashKey(plaintext);
      const key = state.apiKeys.find((item) => item.keyHash === hashed && !item.revokedAt);
      return key ? { scopes: key.scopes } : null;
    },
    async listTeammates() {
      return state.teammates;
    },
    inviteTeammate(input) {
      return exclusive(() => {
        const name = input.name.trim();
        const email = input.email.trim().toLowerCase();
        if (name.length < 2) throw new SplitlineError("Add the teammate's name.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new SplitlineError("That email address does not look complete.");
        }
        if (state.teammates.some((teammate) => teammate.email === email)) {
          throw new SplitlineError("That person is already on the workspace list.");
        }
        const teammate: Teammate = { id: createId("mate"), name, email, role: input.role, status: "invited" };
        state.teammates.push(teammate);
        persist();
        return teammate;
      });
    },
    removeTeammate(id) {
      return exclusive(() => {
        const before = state.teammates.length;
        state.teammates = state.teammates.filter((teammate) => teammate.id !== id);
        if (state.teammates.length === before) throw new SplitlineError("That teammate is not on the list.");
        persist();
      });
    },
    async edgeConfig() {
      return toEdgeConfig(state);
    },
    async usage() {
      rollMonth();
      return {
        month: state.usageMonth,
        events: state.eventsThisMonth,
        limit: PLANS[state.org.plan].eventsPerMonth,
        plan: state.org.plan,
      };
    },
    async getEdgeSync() {
      return state.edgeSync;
    },
    setEdgeSync(sync: EdgeSyncState) {
      return exclusive(() => {
        state.edgeSync = sync;
        persist();
      });
    },
    async experimentsForDocument(documentId, keys) {
      const wanted = new Set(keys);
      return state.experiments.filter(
        (experiment) =>
          wanted.has(experiment.key) ||
          experiment.variants.some((variant) => variant.sanityDocumentId && variant.sanityDocumentId === documentId),
      );
    },
  };
}

function load(filePath: string): State {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as State;
    if (parsed.version !== 1 || !parsed.org || !parsed.experiments) {
      throw new SplitlineError("The local data file is not a version this app can read.");
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const seeded = seedState();
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(seeded));
      return seeded;
    }
    throw error;
  }
}

export type { Organization, PublicApiKey };
