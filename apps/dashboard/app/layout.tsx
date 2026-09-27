import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { Shell } from "@/components/shell";
import { store } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Experiments", template: "%s · Experiments" },
  description: "Edge A/B testing for Astro and Sanity sites on Vercel, with zero flicker.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const org = await store().getOrg();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <Shell orgName={org.name}>{children}</Shell>
        <Toaster />
      </body>
    </html>
  );
}
