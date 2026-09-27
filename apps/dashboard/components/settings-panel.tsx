"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EdgeSyncState, Organization, Teammate } from "@splitline/store";
import { PLANS, formatLimit } from "@splitline/core";
import { inviteTeammate, removeTeammate, saveWorkspace, syncNow } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsPanel({
  org,
  teammates,
  backend,
  edgeSync,
}: {
  org: Organization;
  teammates: Teammate[];
  backend: "file" | "supabase";
  edgeSync: EdgeSyncState | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-10">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setPending(true);
          setError(null);
          const result = await saveWorkspace({
            name: String(form.get("name") ?? ""),
            plan: String(form.get("plan") ?? "starter") as Organization["plan"],
            sanityProjectId: String(form.get("sanityProjectId") ?? ""),
            vercelProjectId: String(form.get("vercelProjectId") ?? ""),
          });
          setPending(false);
          if (!result.ok) setError(result.error);
          else {
            setNotice("Workspace saved.");
            router.refresh();
          }
        }}
      >
        <div className="sm:col-span-2">
          <h2 className="text-2xl font-bold">Workspace</h2>
          <p className="text-sm text-muted-foreground">
            Billing is not connected in this local build. The plan only enforces the concurrent-experiment and event
            limits described in the product spec.
          </p>
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={org.name} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="plan">Plan</Label>
          <select
            id="plan"
            name="plan"
            defaultValue={org.plan}
            className="mt-1.5 h-8 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
          >
            {(Object.keys(PLANS) as Organization["plan"][]).map((plan) => (
              <option key={plan} value={plan}>
                {PLANS[plan].label} · ${PLANS[plan].price}/mo · {formatLimit(PLANS[plan].concurrentExperiments)} experiments ·{" "}
                {formatLimit(PLANS[plan].eventsPerMonth)} events
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="sanityProjectId">Sanity project id</Label>
          <Input id="sanityProjectId" name="sanityProjectId" defaultValue={org.sanityProjectId} className="mt-1.5" placeholder="Not connected" />
        </div>
        <div>
          <Label htmlFor="vercelProjectId">Vercel project id</Label>
          <Input id="vercelProjectId" name="vercelProjectId" defaultValue={org.vercelProjectId} className="mt-1.5" placeholder="Not connected" />
        </div>
        <div className="sm:col-span-2">
          {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="mb-2 text-sm text-primary">{notice}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save workspace"}
          </Button>
        </div>
      </form>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-2xl font-bold">Data store</h2>
        <p className="text-sm text-muted-foreground">
          {backend === "supabase"
            ? "Connected to the Supabase project in SUPABASE_URL. Event and experiment rows live there."
            : "Using the local JSON file. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and apply supabase/schema.sql, to bring your own database."}
        </p>
        <p className="text-sm text-muted-foreground">
          Edge Config: {edgeSync ? `${edgeSync.ok ? "Last attempt succeeded" : "Not synced"}. ${edgeSync.detail}` : "No sync has run yet."}
        </p>
        <Button
          variant="outline"
          onClick={async () => {
            const result = await syncNow();
            setNotice(result.ok ? result.detail : result.error);
            router.refresh();
          }}
        >
          Sync config now
        </Button>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Teammates</h2>
          <p className="text-sm text-muted-foreground">
            Invites are stored for this workspace. Email delivery ships with hosted accounts, so nobody is emailed from this local build.
          </p>
        </div>
        {teammates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            No teammates yet. Invite the person who owns the marketing site.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {teammates.map((teammate) => (
              <li key={teammate.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {teammate.name} <span className="text-sm font-normal text-muted-foreground">· {teammate.role}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {teammate.email} · {teammate.status === "invited" ? "Invite stored" : "Active"}
                  </p>
                </div>
                <Button variant="ghost" onClick={async () => { await removeTeammate(teammate.id); router.refresh(); }}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const result = await inviteTeammate({
              name: String(form.get("teammateName") ?? ""),
              email: String(form.get("email") ?? ""),
              role: String(form.get("role") ?? "viewer") as Teammate["role"],
            });
            if (!result.ok) setError(result.error);
            else {
              setError(null);
              event.currentTarget.reset();
              router.refresh();
            }
          }}
        >
          <Input name="teammateName" placeholder="Name" required />
          <Input name="email" type="email" placeholder="Email" required className="sm:col-span-2" />
          <div className="flex gap-2">
            <select name="role" defaultValue="editor" className="h-8 flex-1 rounded-lg border border-input bg-card px-2 text-sm">
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button type="submit">Invite</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
