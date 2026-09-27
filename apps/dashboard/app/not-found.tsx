import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-8">
      <h1 className="font-serif text-3xl">That page isn’t in this workspace</h1>
      <p className="mt-3 text-sm text-muted-foreground">The experiment may have been deleted, or the link is out of date.</p>
      <Link href="/experiments" className="mt-5 inline-block text-sm underline">
        Back to experiments
      </Link>
    </div>
  );
}
