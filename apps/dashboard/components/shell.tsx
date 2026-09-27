"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "cn";

const links = [
  { href: "/", label: "Overview" },
  { href: "/experiments", label: "Experiments" },
  { href: "/events", label: "Events" },
  { href: "/keys", label: "API keys" },
  { href: "/settings", label: "Settings" },
];

function active(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ orgName, children }: { orgName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden bg-sidebar text-sidebar-foreground md:flex md:flex-col md:border-r md:border-sidebar-border">
        <div className="px-5 py-6">
          <p className="font-serif text-2xl tracking-tight">Splitline</p>
          <p className="mt-1 text-sm text-sidebar-foreground/70">{orgName}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                active(pathname, link.href)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="px-5 py-6 text-xs leading-5 text-sidebar-foreground/60">
          Edge assignment for Astro and Sanity. No flicker, because the variant is chosen before HTML is sent.
        </p>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <div>
            <p className="font-serif text-xl leading-none">Splitline</p>
            <p className="text-xs text-muted-foreground">{orgName}</p>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
              <SheetHeader>
                <SheetTitle className="font-serif text-sidebar-foreground">Splitline</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm",
                      active(pathname, link.href) ? "bg-sidebar-accent" : "text-sidebar-foreground/80",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
