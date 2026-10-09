/* eslint-disable @typescript-eslint/no-explicit-any -- reads raw third-party JSON of many shapes */
// Turns each provider's raw response into one simple shape. Pure functions (tested).

export interface Source {
  url: string;
  title?: string;
}
export interface ShoppingProduct {
  title: string;
  brand?: string;
  store?: string;
}
export interface EngineAnswer {
  text: string;
  sources: Source[];
  products: ShoppingProduct[];
  provider: string;
  /** true when the engine showed no AI answer at all (e.g. no AI Overview for this search). */
  empty?: boolean;
}

const MAX_TEXT = 12_000;

/** ChatGPT answers from cloro contain UI tags (<Entity/>, <Cite/>, <box> ...). Keep the words. */
export function cleanAnswerMarkup(md: string): string {
  return md
    .replace(/<Entity\b[^>]*?\bvalue="([^"]+)"[^>]*\/>/g, "$1")
    .replace(/<Entity\b[^>]*\/>/g, "")
    .replace(/<Link\b[^>]*?\burl="([^"]+)"[^>]*?\btitle="([^"]*)"[^>]*\/>/g, "[$2]($1)")
    .replace(/<Link\b[^>]*\/>/g, "")
    .replace(/<(Cite|AsyncImage|divider|Image)\b[^>]*\/>/g, "")
    .replace(/\{turn\w+\.[\w.]+\}/g, "")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function dedupeSources(list: Source[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const s of list) {
    if (!s?.url || !/^https?:\/\//.test(s.url)) continue;
    const key = s.url.split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: key, title: s.title || undefined });
  }
  return out;
}

function fromCloro(raw: any): Omit<EngineAnswer, "provider"> {
  const r = raw?.result ?? {};
  const text = cleanAnswerMarkup(String(r.markdown || r.text || ""));
  const sources = dedupeSources(
    [...(r.sources ?? []), ...(r.citationPills ?? [])].map((s: any) => ({
      url: s.url,
      title: s.label || s.title,
    })),
  );
  const products: ShoppingProduct[] = [...(r.shoppingCards ?? []), ...(r.inlineProducts ?? [])]
    .filter((p: any) => p?.title)
    .map((p: any) => ({ title: p.title, brand: p.brand || undefined, store: p.store || p.merchant || undefined }));
  return { text, sources, products };
}

function fromDataForSeoResponses(raw: any): Omit<EngineAnswer, "provider"> {
  const task = raw?.tasks?.[0];
  if (task && task.status_code && task.status_code !== 20000) {
    throw new Error(`DataForSEO ${task.status_code}: ${task.status_message}`);
  }
  const items = task?.result?.[0]?.items ?? [];
  const texts: string[] = [];
  const sources: Source[] = [];
  for (const item of items) {
    for (const section of item?.sections ?? []) {
      if (section?.text) texts.push(section.text);
      for (const a of section?.annotations ?? []) sources.push({ url: a.url, title: a.title });
    }
    if (item?.markdown) texts.push(item.markdown);
    for (const s of item?.sources ?? []) sources.push({ url: s.url, title: s.title });
  }
  if (!texts.length) return generic(raw);
  return { text: cleanAnswerMarkup(texts.join("\n\n")), sources: dedupeSources(sources), products: [] };
}

function fromLitescrapeAio(raw: any): Omit<EngineAnswer, "provider"> {
  const aio = raw?.ai_overview;
  if (!aio) return { text: "", sources: [], products: [], empty: true };
  const lines: string[] = [];
  for (const block of aio.text_blocks ?? []) {
    if (block.type === "heading" && block.snippet) lines.push(`## ${block.snippet}`);
    else if (block.snippet) lines.push(block.snippet);
    for (const li of block.list ?? []) lines.push(`- ${[li.title, li.snippet].filter(Boolean).join(" ")}`);
  }
  const sources = dedupeSources(
    (aio.references ?? []).map((r: any) => ({ url: r.link, title: r.title || r.source })),
  );
  // Google often names products in references without a link; keep them as text context.
  for (const r of aio.references ?? []) {
    if (!r.link && r.title) lines.push(`(Product shown: ${r.title})`);
  }
  return { text: lines.join("\n"), sources, products: [] };
}

function fromAnyApiAio(raw: any): Omit<EngineAnswer, "provider"> {
  const data = raw?.output?.data;
  if (!raw?.output?.found || !data) return { text: "", sources: [], products: [], empty: true };
  return {
    text: cleanAnswerMarkup(String(data.answerMarkdown || data.answer || "").replace(/\\([*#[\]()])/g, "$1")),
    sources: dedupeSources((data.citations ?? []).map((c: any) => ({ url: c.url, title: c.title }))),
    products: [],
  };
}

/** Last resort: find the longest text field and every URL in an unknown response. */
function generic(raw: any): Omit<EngineAnswer, "provider"> {
  let best = "";
  const sources: Source[] = [];
  const walk = (v: any, key = "", depth = 0) => {
    if (depth > 12 || v == null) return;
    if (typeof v === "string") {
      if (["markdown", "text", "answer", "answer_markdown"].includes(key) && v.length > best.length) best = v;
      return;
    }
    if (Array.isArray(v)) return v.forEach((x) => walk(x, key, depth + 1));
    if (typeof v === "object") {
      if (typeof v.url === "string") sources.push({ url: v.url, title: v.title || v.label });
      for (const [k, x] of Object.entries(v)) walk(x, k, depth + 1);
    }
  };
  walk(raw);
  return { text: cleanAnswerMarkup(best), sources: dedupeSources(sources), products: [] };
}

export function normalizeAnswer(endpoint: string, raw: any): EngineAnswer {
  let out: Omit<EngineAnswer, "provider">;
  if (endpoint.startsWith("cloro.")) {
    if (raw?.success === false) throw new Error(`cloro: ${raw?.error?.message ?? "failed"}`);
    out = fromCloro(raw);
  } else if (endpoint.includes("llm-responses")) out = fromDataForSeoResponses(raw);
  else if (endpoint.startsWith("dataforseo.")) out = fromDataForSeoResponses(raw);
  else if (endpoint.startsWith("litescrape.")) out = fromLitescrapeAio(raw);
  else if (endpoint.startsWith("anyapi.")) out = fromAnyApiAio(raw);
  else out = generic(raw);
  return { ...out, text: out.text.slice(0, MAX_TEXT), provider: endpoint };
}

// ---------- URL helpers ----------

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Strip tracking params so the same page counts once. */
export function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|srsltid|gclid|fbclid|ref$)/i.test(k)) u.searchParams.delete(k);
    }
    u.hash = "";
    return u.toString().replace(/\?$/, "");
  } catch {
    return url;
  }
}
