// Did this visit / order come from an AI assistant? Pure functions (tested).
// Order of truth: 1) our own UTM links, 2) AI referrer or utm_source, 3) AI sales channel.

export type AiEngine = "chatgpt" | "perplexity" | "gemini" | "copilot" | "claude" | "meta_ai" | "other_ai";

export const AI_ENGINE_LABELS: Record<AiEngine | "ours" | "survey", string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot",
  claude: "Claude",
  meta_ai: "Meta AI",
  other_ai: "Other AI",
  ours: "Pages we built",
  survey: "Told us at checkout",
};

// Domain (or domain + path prefix) -> engine. Keep in sync with the honesty note in the UI.
export const AI_REFERRERS: [string, AiEngine][] = [
  ["chatgpt.com", "chatgpt"],
  ["chat.openai.com", "chatgpt"],
  ["openai.com", "chatgpt"],
  ["perplexity.ai", "perplexity"],
  ["gemini.google.com", "gemini"],
  ["bard.google.com", "gemini"],
  ["copilot.microsoft.com", "copilot"],
  ["bing.com/chat", "copilot"],
  ["claude.ai", "claude"],
  ["meta.ai", "meta_ai"],
  ["you.com", "other_ai"],
  ["poe.com", "other_ai"],
  ["chat.deepseek.com", "other_ai"],
  ["grok.com", "other_ai"],
  ["chat.mistral.ai", "other_ai"],
];

const UTM_SOURCES: [RegExp, AiEngine][] = [
  [/chatgpt|openai/i, "chatgpt"],
  [/perplexity/i, "perplexity"],
  [/gemini|bard/i, "gemini"],
  [/copilot/i, "copilot"],
  [/claude|anthropic/i, "claude"],
  [/meta\.ai/i, "meta_ai"],
];

export function engineFromReferrer(referrer: string | null | undefined): AiEngine | null {
  if (!referrer) return null;
  let host = "";
  let path = "";
  try {
    const u = new URL(referrer.includes("://") ? referrer : `https://${referrer}`);
    host = u.hostname.replace(/^www\./, "").toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {
    return null;
  }
  for (const [pattern, engine] of AI_REFERRERS) {
    const [pHost, ...rest] = pattern.split("/");
    const pPath = rest.length ? `/${rest.join("/")}` : "";
    if ((host === pHost || host.endsWith(`.${pHost}`)) && path.startsWith(pPath)) return engine;
  }
  return null;
}

export function engineFromUtm(utmSource: string | null | undefined): AiEngine | null {
  if (!utmSource) return null;
  for (const [re, engine] of UTM_SOURCES) if (re.test(utmSource)) return engine;
  return null;
}

export function utmFromUrl(url: string | null | undefined): { source?: string; medium?: string } {
  if (!url) return {};
  try {
    const u = new URL(url.includes("://") ? url : `https://x.invalid${url.startsWith("/") ? "" : "/"}${url}`);
    return {
      source: u.searchParams.get("utm_source") ?? undefined,
      medium: u.searchParams.get("utm_medium") ?? undefined,
    };
  } catch {
    return {};
  }
}

export interface Visit {
  landingPage?: string | null;
  referrerUrl?: string | null;
  source?: string | null;
  utmSource?: string | null;
}

export interface VisitResult {
  engine: AiEngine | "ours";
  reason: string;
}

export function classifyVisit(visit: Visit | null | undefined, ourUtmSource: string): VisitResult | null {
  if (!visit) return null;
  const utm = visit.utmSource || utmFromUrl(visit.landingPage).source;
  if (utm && utm.toLowerCase() === ourUtmSource.toLowerCase()) {
    return { engine: "ours", reason: "Came through a page or link this app created" };
  }
  const byRef = engineFromReferrer(visit.referrerUrl);
  if (byRef) return { engine: byRef, reason: `Arrived from ${hostOf(visit.referrerUrl)}` };
  const byUtm = engineFromUtm(utm);
  if (byUtm) return { engine: byUtm, reason: `Link was tagged utm_source=${utm}` };
  const bySource = engineFromUtm(visit.source) ?? engineFromReferrer(visit.source);
  if (bySource) return { engine: bySource, reason: `Shopify recorded the source as ${visit.source}` };
  return null;
}

export interface OrderSignals {
  firstVisit?: Visit | null;
  lastVisit?: Visit | null;
  sourceName?: string | null;
  channelName?: string | null;
  channelHandle?: string | null;
  appTitle?: string | null;
}

export interface OrderResult {
  engine: AiEngine | "ours";
  ours: boolean;
  reason: string;
}

export function classifyOrder(order: OrderSignals, ourUtmSource: string): OrderResult | null {
  const last = classifyVisit(order.lastVisit, ourUtmSource);
  const first = classifyVisit(order.firstVisit, ourUtmSource);
  if (last?.engine === "ours" || first?.engine === "ours") {
    return { engine: "ours", ours: true, reason: "Came through a page or link this app created" };
  }
  if (last) return { engine: last.engine, ours: false, reason: `${last.reason} (last visit before buying)` };
  if (first) return { engine: first.engine, ours: false, reason: `${first.reason} (first visit)` };

  // Orders placed inside an AI assistant (Shopify agentic storefronts / AI sales channels).
  const channelText = [order.channelName, order.channelHandle, order.appTitle, order.sourceName]
    .filter(Boolean)
    .join(" ");
  const byChannel = engineFromUtm(channelText);
  if (byChannel) return { engine: byChannel, ours: false, reason: `Sold through the ${channelText.trim()} channel` };
  if (/agentic|ai[ -]?(agent|assistant|channel)/i.test(channelText)) {
    return { engine: "other_ai", ours: false, reason: `Sold through an AI channel (${channelText.trim()})` };
  }
  return null;
}

function hostOf(url: string | null | undefined): string {
  try {
    return new URL(url!.includes("://") ? url! : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return String(url);
  }
}
