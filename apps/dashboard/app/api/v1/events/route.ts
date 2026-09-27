import type { IngestInput } from "@splitline/store";
import { bearer, json, preflight } from "@/lib/http";
import { store } from "@/lib/store";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  const token = bearer(request);
  if (!token) return json(request, { error: "Missing API key." }, 401);
  const auth = await store().authenticate(token);
  if (!auth?.scopes.includes("events:write")) {
    return json(request, { error: "This key cannot write events." }, 403);
  }
  let body: IngestInput;
  try {
    body = (await request.json()) as IngestInput;
  } catch {
    return json(request, { error: "Body must be JSON." }, 400);
  }
  const result = await store().ingest(body);
  return json(request, result, result.accepted ? 201 : 202);
}
