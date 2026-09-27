import { pushEdgeConfig } from "@splitline/edge";
import { store } from "./store";

export async function syncEdgeConfig() {
  const db = store();
  const result = await pushEdgeConfig(await db.edgeConfig());
  await db.setEdgeSync({
    at: new Date().toISOString(),
    ok: result.ok,
    detail: result.detail,
  });
  return result;
}
