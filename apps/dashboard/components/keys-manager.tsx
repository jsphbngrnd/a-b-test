"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicApiKey } from "@splitline/store";
import { DEMO_API_KEY } from "@splitline/core";
import { createApiKey, revokeApiKey } from "@/lib/actions";
import { when } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function KeysManager({ keys }: { keys: PublicApiKey[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const scopes = ["events:write", "config:read"].filter((scope) => form.get(scope) === "on");
    setPending(true);
    setError(null);
    const result = await createApiKey(String(form.get("name") ?? ""), scopes);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPlaintext(result.plaintext);
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div>
          <Label htmlFor="key-name">Key name</Label>
          <Input id="key-name" name="name" required placeholder="Production middleware" className="mt-1.5" />
        </div>
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 font-medium">Scopes</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="events:write" defaultChecked /> events:write
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="config:read" /> config:read
          </label>
        </fieldset>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create key"}
        </Button>
      </form>

      {keys.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
          No API keys yet. The edge middleware and the Sanity plugin authenticate with a key.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{key.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {key.keyPrefix}… · {key.scopes.join(", ") || "no scopes"} · {when(key.createdAt)}
                </p>
                {key.id === "key_demo" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Local demo key: <span className="font-mono">{DEMO_API_KEY}</span>
                  </p>
                ) : null}
                {key.revokedAt ? <p className="text-xs text-destructive">Revoked {when(key.revokedAt)}</p> : null}
              </div>
              {!key.revokedAt ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    const result = await revokeApiKey(key.id);
                    if (!result.ok) setError(result.error);
                    else router.refresh();
                  }}
                >
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={plaintext !== null} onOpenChange={(open) => !open && setPlaintext(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Copy this key now</DialogTitle>
            <DialogDescription>
              Only a hash is stored. This is the only time the full key is shown.
            </DialogDescription>
          </DialogHeader>
          <Input readOnly value={plaintext ?? ""} className="font-mono text-xs" />
          <Button
            type="button"
            onClick={async () => {
              if (!plaintext) return;
              await navigator.clipboard.writeText(plaintext);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy key"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
