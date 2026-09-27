"use server";

import { revalidatePath } from "next/cache";
import type { ExperimentStatus } from "@splitline/core";
import { SplitlineError, type ExperimentInput, type Teammate } from "@splitline/store";
import { syncEdgeConfig } from "./edge-sync";
import { store } from "./store";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return { ok: false as const, error: message };
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function saveExperiment(id: string | null, input: ExperimentInput) {
  try {
    const db = store();
    const experiment = id ? await db.updateExperiment(id, input) : await db.createExperiment(input);
    await syncEdgeConfig();
    refresh();
    return { ok: true as const, id: experiment.id };
  } catch (error) {
    return failure(error);
  }
}

export async function changeStatus(id: string, status: ExperimentStatus) {
  try {
    await store().setStatus(id, status);
    await syncEdgeConfig();
    refresh();
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function declareWinner(id: string, variantId: string) {
  try {
    await store().declareWinner(id, variantId);
    await syncEdgeConfig();
    refresh();
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function removeExperiment(id: string) {
  try {
    await store().deleteExperiment(id);
    await syncEdgeConfig();
    refresh();
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function createApiKey(name: string, scopes: string[]) {
  try {
    const created = await store().createKey(name, scopes);
    refresh();
    return { ok: true as const, plaintext: created.plaintext, prefix: created.key.keyPrefix };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeApiKey(id: string) {
  try {
    await store().revokeKey(id);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function saveWorkspace(input: {
  name: string;
  plan: "free" | "starter" | "growth";
  sanityProjectId: string;
  vercelProjectId: string;
}) {
  try {
    await store().updateOrg(input);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function inviteTeammate(input: { name: string; email: string; role: Teammate["role"] }) {
  try {
    await store().inviteTeammate(input);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function removeTeammate(id: string) {
  try {
    await store().removeTeammate(id);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function syncNow() {
  try {
    const result = await syncEdgeConfig();
    refresh();
    return { ok: true as const, detail: result.detail, synced: result.ok };
  } catch (error) {
    if (error instanceof SplitlineError) return failure(error);
    return failure(error);
  }
}
