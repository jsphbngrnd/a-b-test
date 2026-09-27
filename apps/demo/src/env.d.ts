/// <reference types="astro/client" />

type SplitlineLocals = {
  visitorId: string;
  assignments: Record<string, string>;
  track: Record<string, string>;
  preview: boolean;
  config: import("@splitline/core").EdgeConfig | null;
  error: string | null;
};

declare namespace App {
  interface Locals {
    splitline: SplitlineLocals;
  }
}
