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

// ---------- Search engines (SEO traffic), Ross 2026-10-15 ----------
// A visit that came from a search engine's results page: Google, Bing and co. Counted beside AI on the dashboard
// so a store can see both. Google AI Overviews can't be told apart from a normal Google result here (the referrer
// is the same), which the dashboard says.

export type SearchEngine = "google" | "bing" | "duckduckgo" | "yahoo" | "ecosia" | "brave" | "yandex" | "baidu" | "naver" | "other_search";

export const SEARCH_ENGINE_LABELS: Record<SearchEngine, string> = {
  google: "Google",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
  yahoo: "Yahoo",
  ecosia: "Ecosia",
  brave: "Brave Search",
  yandex: "Yandex",
  baidu: "Baidu",
  naver: "Naver",
  other_search: "Other search",
};

// Referrer domain -> search engine. Google's many country domains (google.com.au, google.co.uk) all match "google.".
const SEARCH_REFERRERS: [RegExp, SearchEngine][] = [
  [/^(?:[a-z0-9-]+\.)*google\.(?:[a-z]{2,3})(?:\.[a-z]{2})?$/, "google"],
  [/^(?:[a-z0-9-]+\.)*bing\.com$/, "bing"],
  [/^(?:[a-z0-9-]+\.)*duckduckgo\.com$/, "duckduckgo"],
  [/^(?:[a-z0-9-]+\.)*search\.yahoo\.(?:[a-z.]+)$/, "yahoo"],
  [/^(?:[a-z0-9-]+\.)*ecosia\.org$/, "ecosia"],
  [/^(?:[a-z0-9-]+\.)*search\.brave\.com$/, "brave"],
  [/^(?:[a-z0-9-]+\.)*yandex\.(?:[a-z.]+)$/, "yandex"],
  [/^(?:[a-z0-9-]+\.)*baidu\.com$/, "baidu"],
  [/^(?:[a-z0-9-]+\.)*search\.naver\.com$/, "naver"],
  [/^(?:[a-z0-9-]+\.)*(?:qwant\.com|startpage\.com|ask\.com|seznam\.cz|sogou\.com)$/, "other_search"],
];

/** Which search engine a referrer is from, or null. An AI assistant's address (bing.com/chat, gemini.google.com) is never a search engine. */
export function searchEngineFromReferrer(referrer: string | null | undefined): SearchEngine | null {
  if (!referrer || engineFromReferrer(referrer)) return null;
  let host = "";
  try {
    host = new URL(referrer.includes("://") ? referrer : `https://${referrer}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  for (const [re, engine] of SEARCH_REFERRERS) if (re.test(host)) return engine;
  return null;
}

/** A visit from a search engine (the referrer, or a link tagged utm_medium=organic by a search engine), or null. Checked after classifyVisit says it's not AI. */
export function classifySearchVisit(visit: Visit | null | undefined): { engine: SearchEngine; reason: string } | null {
  if (!visit) return null;
  const byRef = searchEngineFromReferrer(visit.referrerUrl);
  if (byRef) return { engine: byRef, reason: `Arrived from ${hostOf(visit.referrerUrl)}` };
  const utm = utmFromUrl(visit.landingPage);
  const source = (visit.utmSource || utm.source || "").toLowerCase();
  if (source && (utm.medium || "").toLowerCase() === "organic") {
    const engine = (Object.keys(SEARCH_ENGINE_LABELS) as SearchEngine[]).find((e) => source.includes(e)) ?? "other_search";
    return { engine, reason: `Link was tagged utm_source=${source}` };
  }
  return null;
}

/** An order whose last (else first) visit came from a search engine, when it didn't come from AI. */
export function classifySearchOrder(order: OrderSignals, ourUtmSource: string): { engine: SearchEngine; reason: string } | null {
  if (classifyOrder(order, ourUtmSource)) return null;
  const last = classifySearchVisit(order.lastVisit);
  if (last) return { engine: last.engine, reason: `${last.reason} (last visit before buying)` };
  const first = classifySearchVisit(order.firstVisit);
  if (first) return { engine: first.engine, reason: `${first.reason} (first visit)` };
  return null;
}

function hostOf(url: string | null | undefined): string {
  try {
    return new URL(url!.includes("://") ? url! : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return String(url);
  }
}
