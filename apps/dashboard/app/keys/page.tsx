import { KeysManager } from "@/components/keys-manager";
import { store } from "@/lib/store";

export const metadata = { title: "API keys" };

export default async function KeysPage() {
  const keys = await store().listKeys();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">API keys</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          The demo site uses a write-only key to record exposures and conversions. Config reads are open in this local build because the variant copy is already in the HTML.
        </p>
      </div>
      <KeysManager keys={keys} />
    </div>
  );
}
