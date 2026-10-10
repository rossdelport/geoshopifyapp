// Free product check (public, no install). See docs/free-check.md. STUB: being built.

import type { CheckView, CreateCheckResult } from "./check-types";

export async function createCheck(input: {
  url: string;
  country: string;
  ip: string | null;
  honeypot?: string | null;
}): Promise<CreateCheckResult> {
  void input;
  throw new Error("not built yet");
}

export async function getCheckView(id: string): Promise<CheckView | null> {
  void id;
  throw new Error("not built yet");
}
