"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-8">
      <h1 className="font-serif text-3xl">This page didn’t load</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{error.message}</p>
      <Button className="mt-5" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
