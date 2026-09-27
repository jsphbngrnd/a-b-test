import { store } from "@/lib/store";
import { json, preflight } from "@/lib/http";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  const config = await store().edgeConfig();
  return json(request, config);
}
