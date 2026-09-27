import { json, preflight } from "@/lib/http";
import { store } from "@/lib/store";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId") ?? "";
  const keys = (url.searchParams.get("keys") ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const experiments = await store().experimentsForDocument(documentId, keys);
  return json(request, {
    experiments: experiments.map((experiment) => ({
      id: experiment.id,
      name: experiment.name,
      key: experiment.key,
      status: experiment.status,
      variants: experiment.variants.map((variant) => ({ key: variant.key, name: variant.name })),
    })),
  });
}
