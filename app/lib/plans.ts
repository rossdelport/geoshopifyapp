// Plans, prices and limits. Shared by server and UI. Change limits here only.

export type PlanId = "free" | "core" | "pro";
export type Engine = "chatgpt" | "gemini" | "perplexity" | "aio" | "claude";

export const ENGINE_LABELS: Record<Engine, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  aio: "Google AI Overviews",
  claude: "Claude",
};

export interface Plan {
  id: PlanId;
  name: string;
  priceUsd: number;
  trialDays: number;
  questions: number;
  engines: Engine[];
  scanEveryDays: number | null; // null = one-time scan only
  runsPerScan: number;
  products: number;
  fixesPerMonth: number; // Infinity = unlimited
  outreachPerMonth: number;
  autopilot: boolean;
  monthlyReport: boolean;
  costCapUsd: number; // stop scheduled work above this monthly cost
  blurb: string;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free scan",
    priceUsd: 0,
    trialDays: 0,
    questions: 10,
    engines: ["chatgpt", "gemini", "perplexity"],
    scanEveryDays: null,
    runsPerScan: 2,
    products: 0,
    fixesPerMonth: 0,
    outreachPerMonth: 0,
    autopilot: false,
    monthlyReport: false,
    costCapUsd: 1,
    blurb: "See where you stand today.",
    features: [
      "One scan of 10 buyer questions",
      "ChatGPT, Gemini and Perplexity",
      "Your visibility score and top competitors",
      "AI sales from the last 60 days",
    ],
  },
  core: {
    id: "core",
    name: "Core",
    priceUsd: 49,
    trialDays: 7,
    questions: 25,
    engines: ["chatgpt", "gemini", "perplexity", "aio"],
    scanEveryDays: 7,
    runsPerScan: 2,
    products: 100,
    fixesPerMonth: 30,
    outreachPerMonth: 10,
    autopilot: false,
    monthlyReport: true,
    costCapUsd: 8,
    blurb: "Get found by AI, every week.",
    features: [
      "25 buyer questions tracked weekly",
      "ChatGPT, Gemini, Perplexity and Google AI Overviews",
      "30 ready-to-approve fixes a month",
      "100 products optimised",
      "10 outreach targets a month",
      "AI sales dashboard and monthly email report",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 149,
    trialDays: 7,
    questions: 100,
    engines: ["chatgpt", "gemini", "perplexity", "aio", "claude"],
    scanEveryDays: 1,
    runsPerScan: 2,
    products: 1000,
    fixesPerMonth: Infinity,
    outreachPerMonth: 40,
    autopilot: true,
    monthlyReport: true,
    costCapUsd: 80,
    blurb: "Daily tracking and autopilot.",
    features: [
      "100 buyer questions tracked daily",
      "Everything in Core, plus Claude",
      "Unlimited fixes and autopilot mode",
      "1,000 products optimised",
      "40 outreach targets a month",
    ],
  },
};

// Shopify Billing plan names (must match the billing config keys).
export const BILLING_PLAN_NAMES = {
  core: "GEO Core",
  pro: "GEO Pro",
} as const;

export function planFromBillingName(name: string | null | undefined): PlanId {
  if (name === BILLING_PLAN_NAMES.pro) return "pro";
  if (name === BILLING_PLAN_NAMES.core) return "core";
  return "free";
}

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : "free"];
}

/** Pro scans daily, but only the weekly scan uses 2 runs + Claude (keeps costs sane). */
export function scanSettings(
  plan: Plan,
  kind: string,
): { engines: Engine[]; runs: number } {
  if (plan.id === "pro" && kind === "daily") {
    return { engines: plan.engines.filter((e) => e !== "claude"), runs: 1 };
  }
  return { engines: plan.engines, runs: plan.runsPerScan };
}

export function limitLabel(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("en-AU") : "Unlimited";
}
