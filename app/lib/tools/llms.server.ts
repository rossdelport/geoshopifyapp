// llms.txt Checker, server side: find where the site really lives (resolveSiteHome: a bare domain that lands
// on a checkout domain's redirect page is read at its www address), fetch that site's /llms.txt,
// /llms-full.txt and /agents.md and its home page, check /llms.txt (llms.ts), and build a starter file from
// the home page. The three files are asked for at the typed address while the home page loads, and kept when
// they came from the site we settle on. Free: four plain page reads per check in the usual case, eight at most,
// no paid calls. Every read goes through the guarded fetch (no private addresses, redirects checked hop by
// hop, 4 at most) and waits for a slot in toolFetchGate. Double submits within a minute get the same answer
// from a small cache.

import { CHECK_COPY } from "./copy/llms-txt-checker";
import { fetchSiteFile, HTML_ACCEPT, movedNote, outcomeMessage, resolveSiteHome, type FetchOutcome } from "./fetch.server";
import { TtlCache } from "./limits.server";
import {
  buildStarter,
  homeIsShopify,
  isShopifyDefault,
  isWebPage,
  llmsReport,
  missingReport,
  readHome,
  starterLinks,
  withChecks,
  type Check,
  type FileState,
  type LlmsSite,
} from "./llms";

export type { FileState, LlmsSite };

export type LlmsOutcome = { ok: true; site: LlmsSite } | { ok: false; error: string };

/** The text files: 512 KB and 6 s each (fetchSiteFile's defaults for text). */
const TEXT_OPTS = { timeoutMs: 6_000 };
/** The home page: 1 MB is plenty for its title, description and menus. */
const HOME_OPTS = { timeoutMs: 6_000, maxBytes: 1_000_000, accept: HTML_ACCEPT };

const recent = new TtlCache<LlmsSite>(500);
const CACHE_MS = 60_000;

/** Forget cached checks (tests only). */
export function clearLlmsCache() {
  recent.clear();
}

/** A web page instead of a file: fetchSiteFile's own test, plus pages that open with a comment or an XML line. */
const isPage = (o: Extract<FetchOutcome, { kind: "ok" }>) => o.html || isWebPage(o.text);

function stateOf(o: FetchOutcome): FileState {
  if (o.kind === "ok") return isPage(o) ? "html" : "found";
  if (o.kind === "missing") return "missing";
  return "unchecked";
}

const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, "");

/** "Your /llms.txt redirects to /agents.md." when the file came from another path (not just www or https). */
function redirectNote(asked: string, got: string): Check | null {
  try {
    const a = new URL(asked);
    const b = new URL(got);
    if (a.pathname === b.pathname) return null;
    const to = bareHost(a.hostname) === bareHost(b.hostname) ? b.pathname : `${b.origin}${b.pathname}`;
    return { id: "redirect", tone: "info", text: CHECK_COPY.redirect(to) };
  } catch {
    return null;
  }
}

const FILE_PATHS = ["/llms.txt", "/llms-full.txt", "/agents.md"] as const;

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

/**
 * Check a site. `input` comes from normalizeSiteInput (origin like "https://yourstore.com"); only the
 * site's main address is used, read where the site really lives (resolveSiteHome). Never throws: when
 * /llms.txt can't be read, the answer is the shared copy for that outcome (couldn't reach, turned away,
 * server error).
 */
export async function checkLlmsSite(input: { origin: string; host: string }): Promise<LlmsOutcome> {
  const cached = recent.get(input.origin);
  if (cached) return { ok: true, site: cached };

  const read = (url: string, opts: Parameters<typeof fetchSiteFile>[1]) => fetchSiteFile(url, opts).catch((): FetchOutcome => ({ kind: "unreachable" }));
  const [where, typedFiles] = await Promise.all([
    resolveSiteHome(input, (url) => read(url, HOME_OPTS)),
    Promise.all(FILE_PATHS.map((p) => read(`${input.origin}${p}`, TEXT_OPTS))),
  ]);
  // A file read at the typed address counts when it came from the site we settled on; else read it there.
  const kept = (o: FetchOutcome) => where.origin === input.origin || (o.kind === "ok" && originOf(o.url) === where.origin);
  const [llms, full, agents] = await Promise.all(FILE_PATHS.map((p, i) => (kept(typedFiles[i]) ? typedFiles[i] : read(`${where.origin}${p}`, TEXT_OPTS))));
  const home = where.home;
  const llmsUrl = `${where.origin}/llms.txt`;
  const problem = outcomeMessage(llms);
  if (problem) return { ok: false, error: problem };

  const files = { llms: stateOf(llms), full: stateOf(full), agents: stateOf(agents) };
  const notes: Check[] = [];
  if (llms.kind === "ok") {
    const moved = redirectNote(llmsUrl, llms.url);
    if (moved) notes.push(moved);
  }
  if (files.full === "found") notes.push({ id: "full", tone: "info", text: CHECK_COPY.fullFound });
  else if (files.full === "missing") notes.push({ id: "full", tone: "info", text: CHECK_COPY.fullMissing });
  if (files.agents === "found") notes.push({ id: "agents", tone: "info", text: CHECK_COPY.agentsFound });
  else if (files.agents === "missing") notes.push({ id: "agents", tone: "info", text: CHECK_COPY.agentsMissing });
  const report = withChecks(llms.kind === "ok" ? llmsReport(llms.text) : missingReport(), notes);

  let starter: string | null = null;
  let starterNote: LlmsSite["starterNote"] = null;
  let shopifyHome = false;
  if (home.kind === "ok") {
    const facts = readHome(home.text, home.url, where.host);
    starter = buildStarter(facts);
    if (!starterLinks(facts.links).main.length) starterNote = "no-links";
    shopifyHome = homeIsShopify(home.text);
  } else {
    starterNote = "no-home";
  }
  const shopify = shopifyHome || report.shopify || (agents.kind === "ok" && !isPage(agents) && isShopifyDefault(agents.text));

  const hostNote = movedNote(input.host, where);
  const site: LlmsSite = { host: where.host, llmsUrl, files, report, shopify, starter, starterNote, ...(hostNote ? { hostNote } : {}) };
  recent.set(input.origin, site, CACHE_MS);
  return { ok: true, site };
}
