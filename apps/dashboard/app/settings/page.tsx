import { SettingsPanel } from "@/components/settings-panel";
import { store } from "@/lib/store";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const db = store();
  const [org, teammates, edgeSync] = await Promise.all([db.getOrg(), db.listTeammates(), db.getEdgeSync()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Sanity and Vercel ids are stored with the workspace. They do not connect by themselves — Studio and Edge Config use the environment variables in .env.example.
        </p>
      </div>
      <SettingsPanel org={org} teammates={teammates} backend={db.kind} edgeSync={edgeSync} />
    </div>
  );
}
