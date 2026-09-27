import { json } from "@/lib/http";
import { store } from "@/lib/store";

export async function GET(request: Request) {
  const db = store();
  return json(request, { ok: true, store: db.kind });
}
