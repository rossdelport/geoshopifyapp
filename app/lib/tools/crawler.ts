// AI Crawler Checker (/tools/ai-crawler-checker): which AI bots a robots.txt lets in, the exact line that
// blocks each one, and the lines to delete. Pure and browser-safe: the page runs it live as people type
// (paste mode), and the server runs it on a fetched robots.txt (crawler.server.ts).
//
// Reading the file: parseRobots and isAllowed from app/lib/robots.ts (RFC 9309) decide allowed or
// blocked. They are imported, never copied or edited: robots.ts and AI_BOTS drive the in-app check.
// explainBlock re-reads the file line by line with the same rules (trim, "#" comments, case-insensitive
// keys, runs of user-agent lines, the run-together split) but keeps line numbers, so it can say which
// line blocks a bot. test/tools-crawler.test.ts checks that it always agrees with isAllowed.
//
// The bot list (TOOL_BOTS) is longer than AI_BOTS: every token comes from its company's own crawler page,
// checked BOTS_CHECKED (docs/tools/research/facts-2026.md 1.2). No Bytespider or xAI token: no official
// docs were found. Google-Agent is not a robots.txt token, so it only appears in the page copy.
//
// Bounded work: anyone can paste a robots.txt or point us at a site that serves one, and patternMatches'
// cost grows with the pattern's length times the path's length on patterns full of "*". So every rule is
// first screened with a cheap test that never drops a rule that could match (screenRule), each decision is
// worked out once per set of groups and page (bots that fall back to "*" share it), the lines-to-delete plan
// is capped, and one check has a work budget. Past the budget the report says the file is too complex to
// check here, never "all clear".

import { isAllowed, parseRobots, patternMatches, rulesFor, type RobotsGroup } from "../robots";
import { plural } from "./format";

/** The date the bot list was last checked against each company's own pages. Review every 3 months. */
export const BOTS_CHECKED = "2026-10-11";

/** recommend: can show or cite your pages in AI answers. fetch: opens a page when a person asks. training: AI training only. */
export type BotGroup = "recommend" | "fetch" | "training";
/** high and medium blocks are problems, low is a tip, info is a note (never a problem). */
export type BotLevel = "high" | "medium" | "low" | "info";

export interface ToolBot {
  /** The robots.txt product token, as the company writes it. */
  token: string;
  owner: string;
  group: BotGroup;
  level: BotLevel;
  /** One plain sentence: what the bot does (exact copy, docs/tools/spec.md T2). */
  what: string;
  /** The company's own page about it. */
  docs: string;
  /** The company says robots.txt rules may not apply to it (some fetchers that open a page for a person). */
  mayIgnore?: true;
}

const GOOGLE_DOCS = "https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers";
const OPENAI_DOCS = "https://developers.openai.com/api/docs/bots";
const ANTHROPIC_DOCS =
  "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler";
const PERPLEXITY_DOCS = "https://docs.perplexity.ai/guides/bots";
const APPLE_DOCS = "https://support.apple.com/en-us/119829";
const META_DOCS = "https://developers.facebook.com/documentation/sharing/webmasters/web-crawlers.md";
const AMAZON_DOCS = "https://developer.amazon.com/amazonbot";
const MISTRAL_DOCS = "https://docs.mistral.ai/robots";

// Facts: docs/tools/research/facts-2026.md 1.2, each company's own docs, checked 11 Oct 2026.
export const TOOL_BOTS: ToolBot[] = [
  // ---- can recommend or cite you ----
  { token: "Googlebot", owner: "Google", group: "recommend", level: "high", what: "Google Search's crawler. Google AI Overviews and AI Mode answer from what it reads.", docs: GOOGLE_DOCS },
  { token: "OAI-SearchBot", owner: "OpenAI", group: "recommend", level: "high", what: "Decides whether your pages can show up in ChatGPT search answers. OpenAI says changes take about 24 hours.", docs: OPENAI_DOCS },
  { token: "PerplexityBot", owner: "Perplexity", group: "recommend", level: "high", what: "Decides whether your pages can show up in Perplexity's answers.", docs: PERPLEXITY_DOCS },
  {
    token: "Bingbot",
    owner: "Microsoft",
    group: "recommend",
    level: "high",
    what: "Bing's crawler. Microsoft Copilot answers come from Bing, and ChatGPT search also uses Microsoft as a search provider.",
    docs: "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0",
  },
  { token: "Claude-SearchBot", owner: "Anthropic", group: "recommend", level: "medium", what: "Reads pages for Claude's search results. Anthropic says blocking it may reduce your visibility in Claude.", docs: ANTHROPIC_DOCS },
  {
    token: "Google-Extended",
    owner: "Google",
    group: "recommend",
    level: "medium",
    what: "A robots.txt setting, not a crawler. It lets Gemini use your pages for training and to ground answers in the Gemini app. It doesn't affect Google Search or AI Overviews.",
    docs: GOOGLE_DOCS,
  },
  {
    token: "Applebot",
    owner: "Apple",
    group: "recommend",
    level: "medium",
    what: "Apple's crawler for Siri, Spotlight and Safari, including Apple's AI answers with links. If your file doesn't name Applebot, Apple follows your Googlebot rules.",
    docs: APPLE_DOCS,
  },
  { token: "Meta-WebIndexer", owner: "Meta", group: "recommend", level: "medium", what: "Helps Meta AI cite and link to your pages in its answers.", docs: META_DOCS },
  { token: "Amzn-SearchBot", owner: "Amazon", group: "recommend", level: "medium", what: "Lets your pages appear in Amazon search experiences such as Alexa. Amazon says it isn't used for AI training.", docs: AMAZON_DOCS },
  {
    token: "DuckAssistBot",
    owner: "DuckDuckGo",
    group: "recommend",
    level: "medium",
    what: "Reads pages for DuckDuckGo's AI-assisted answers. It doesn't affect normal DuckDuckGo results.",
    docs: "https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot",
  },
  { token: "Storebot-Google", owner: "Google", group: "recommend", level: "medium", what: "Google Shopping's crawler. It affects all Google Shopping surfaces, like the Shopping tab.", docs: GOOGLE_DOCS },
  { token: "MistralAI-Index", owner: "Mistral", group: "recommend", level: "low", what: "Indexes pages for Mistral's search, which answers questions in Mistral's assistant.", docs: MISTRAL_DOCS },
  // ---- fetch a page when someone asks ----
  { token: "ChatGPT-User", owner: "OpenAI", group: "fetch", level: "info", what: "Fetches a page when someone asks ChatGPT about it. OpenAI says robots.txt rules may not apply to it.", docs: OPENAI_DOCS, mayIgnore: true },
  {
    token: "Claude-User",
    owner: "Anthropic",
    group: "fetch",
    level: "medium",
    what: "Fetches a page when someone asks Claude about it. Anthropic says it follows robots.txt, so a block stops Claude reading your page for that person.",
    docs: ANTHROPIC_DOCS,
  },
  { token: "Perplexity-User", owner: "Perplexity", group: "fetch", level: "info", what: "Fetches a page when someone asks Perplexity about it. Perplexity says it generally ignores robots.txt.", docs: PERPLEXITY_DOCS, mayIgnore: true },
  { token: "meta-externalfetcher", owner: "Meta", group: "fetch", level: "info", what: "Fetches a page when someone asks Meta AI to. Meta says it may bypass robots.txt.", docs: META_DOCS, mayIgnore: true },
  { token: "Amzn-User", owner: "Amazon", group: "fetch", level: "info", what: "Fetches a page live when someone asks Alexa a question. Amazon says it may not follow every robots.txt rule.", docs: AMAZON_DOCS, mayIgnore: true },
  { token: "MistralAI-User", owner: "Mistral", group: "fetch", level: "info", what: "Fetches a page when someone asks Mistral's assistant to.", docs: MISTRAL_DOCS },
  // ---- training only ----
  { token: "GPTBot", owner: "OpenAI", group: "training", level: "info", what: "Collects pages to train OpenAI's models. Blocking it stops training use, not ChatGPT search.", docs: OPENAI_DOCS },
  { token: "ClaudeBot", owner: "Anthropic", group: "training", level: "info", what: "Collects pages to train Anthropic's models. Blocking it stops training use, not Claude's answers.", docs: ANTHROPIC_DOCS },
  {
    token: "Applebot-Extended",
    owner: "Apple",
    group: "training",
    level: "info",
    what: "A robots.txt setting for training Apple's AI models. Apple says blocking it doesn't remove you from its search results.",
    docs: APPLE_DOCS,
  },
  {
    token: "meta-externalagent",
    owner: "Meta",
    group: "training",
    level: "info",
    what: "Collects pages to train Meta's AI models or improve its products. Meta doesn't say blocking it hides you from Meta AI.",
    docs: META_DOCS,
  },
  {
    token: "Amazonbot",
    owner: "Amazon",
    group: "training",
    level: "info",
    what: "Collects pages to improve Amazon's products and may train its AI models. Blocking it doesn't block Amzn-SearchBot.",
    docs: AMAZON_DOCS,
  },
  { token: "CCBot", owner: "Common Crawl", group: "training", level: "info", what: "Builds Common Crawl's open web archive, which many AI training sets are built from.", docs: "https://commoncrawl.org/faq" },
  { token: "MistralAI-Training", owner: "Mistral", group: "training", level: "info", what: "Collects pages to train Mistral's models. Mistral says it isn't used for search or live answers.", docs: MISTRAL_DOCS },
];

/** The result's three groups, in page order (exact headings). */
export const BOT_GROUPS: { id: BotGroup; heading: string }[] = [
  { id: "recommend", heading: "Can recommend or cite you" },
  { id: "fetch", heading: "Fetch a page when someone asks" },
  { id: "training", heading: "Training only: blocking these doesn't hide you from answers" },
];

/**
 * A bot that follows another bot's rules when the file doesn't name it. Apple: "If robots instructions
 * don't mention Applebot but mention Googlebot, the Apple robot will follow Googlebot instructions."
 * Amazon's "the rules for other search bots" (Amzn-SearchBot) is too vague to code, so it isn't here.
 */
export const FALLBACKS: Record<string, string[]> = { Applebot: ["Googlebot"] };

const BY_TOKEN = new Map(TOOL_BOTS.map((b) => [b.token, b]));
export const botByToken = (token: string) => BY_TOKEN.get(token);
const TOOL_TOKENS = new Set(TOOL_BOTS.map((b) => b.token.toLowerCase()));

/** A block that hurts: the bot can show or cite you (or read a page a person asked about) and says it obeys robots.txt. */
export const isImportant = (b: Pick<ToolBot, "level">) => b.level === "high" || b.level === "medium";

/** The token whose rules a bot follows: its own when the file names it, else its first named fallback, else its own (which means the "*" group). */
export function effectiveToken(groups: RobotsGroup[], token: string): string {
  const named = (t: string) => groups.some((g) => g.agents.includes(t.toLowerCase()));
  return [token, ...(FALLBACKS[token] ?? [])].find(named) ?? token;
}

// ---------- reading the file with line numbers (the same rules as parseRobots in robots.ts) ----------

const MAX_LINES = 20_000;
const MAX_LINE = 4_000;
const MAX_PATTERN = 1_000;
// The same split as robots.ts: a directive run straight into the previous one when a copy lost its line breaks.
const RUN_TOGETHER = /(?<=\S)(?<!dis)(?=(?:user-agent|disallow|allow|sitemap|crawl-delay)\s*:)/gi;

/** One directive as written: its 1-based line number and its trimmed text, like "Disallow: /products/". */
export interface RobotsLine {
  line: number;
  text: string;
}

interface Entry extends RobotsLine {
  id: number;
  key: string; // lowercased field name
  value: string; // trimmed value
  token: string; // user-agent lines: the lowercased product token; "" otherwise
}

interface LineGroup {
  agents: Entry[];
  rules: Entry[];
}

/** Every directive in the file, in order (comments and blank lines dropped). Linear in the file's length. */
function readEntries(text: string): Entry[] {
  const out: Entry[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/, MAX_LINES);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].length > MAX_LINE ? lines[i].slice(0, MAX_LINE) : lines[i];
    const hash = raw.indexOf("#");
    const body = (hash === -1 ? raw : raw.slice(0, hash)).trim();
    if (!body) continue;
    for (const piece of body.split(RUN_TOGETHER)) {
      const colon = piece.indexOf(":");
      if (colon === -1) continue;
      const key = piece.slice(0, colon).trim().toLowerCase();
      const value = piece.slice(colon + 1).trim();
      const token = key === "user-agent" ? value.split(/[\s/]/)[0].toLowerCase() : "";
      out.push({ id: out.length, line: i + 1, text: piece.trim(), key, value, token });
    }
  }
  return out;
}

/** Groups from the directives, exactly as parseRobots builds them, plus rules that sit under no user-agent line. */
function groupEntries(entries: Entry[]): { groups: LineGroup[]; orphans: Entry[] } {
  const groups: LineGroup[] = [];
  const orphans: Entry[] = [];
  let current: LineGroup | null = null;
  let lastWasAgent = false;
  for (const e of entries) {
    if (e.key === "user-agent") {
      if (!lastWasAgent || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      if (e.token) current.agents.push(e);
      lastWasAgent = true;
    } else if (e.key === "allow" || e.key === "disallow") {
      lastWasAgent = false;
      if (!current) {
        if (e.value) orphans.push(e);
        continue;
      }
      if (!e.value) continue; // an empty Disallow allows everything
      current.rules.push(e);
    }
    // Sitemap, crawl-delay and others don't end a run of user-agent lines.
  }
  return { groups, orphans };
}

const rulePath = (e: Entry) => e.value.slice(0, MAX_PATTERN);

// ---------- bounded matching ----------

/** Thrown when one check runs out of its work budget (a file built to be slow, or simply too complex). */
class TooComplex extends Error {}

/** About 40 million matcher steps: a fraction of a second, and far more than any real robots.txt needs. */
const WORK_BUDGET = 40_000_000;

/** The same percent-decoding as robots.ts (RFC 9309 2.2.2), so the screen sees what patternMatches sees. */
function normalisePath(p: string): string {
  try {
    return decodeURIComponent(p.replace(/%(?![0-9a-f]{2})/gi, "%25"));
  } catch {
    return p;
  }
}

interface RuleShape {
  /** The literal pieces between the "*"s, after decoding (a final "$" dropped). */
  pieces: string[];
  /** The longest piece after a "*": the matcher retries at most this many characters per position. */
  longest: number;
  length: number;
}

/**
 * Screens rules before the real matcher, and counts the work. `fits` answers exactly like patternMatches
 * (it calls it), but first drops rules that can't match: a pattern matches only when its literal pieces
 * appear in the path in order, the first one at the very start. That test uses native string search, so a
 * hostile file costs little; rules that pass it are charged to the budget at the matcher's worst case.
 */
class Matcher {
  private used = 0;
  private readonly shapes = new Map<string, RuleShape>();
  private readonly paths = new Map<string, string>();
  constructor(private readonly budget: number) {}

  private shape(pattern: string): RuleShape {
    let s = this.shapes.get(pattern);
    if (!s) {
      const body = normalisePath(pattern.endsWith("$") ? pattern.slice(0, -1) : pattern);
      const pieces = body.split("*");
      s = { pieces, longest: pieces.slice(1).reduce((n, p) => Math.max(n, p.length), 0), length: body.length };
      if (this.shapes.size < 100_000) this.shapes.set(pattern, s);
    }
    return s;
  }

  private norm(path: string): string {
    let n = this.paths.get(path);
    if (n === undefined) {
      n = normalisePath(path);
      this.paths.set(path, n);
    }
    return n;
  }

  /** False when `pattern` can't match `path` (never false when patternMatches would say true). */
  screen(pattern: string, path: string): boolean {
    const { pieces } = this.shape(pattern);
    const str = this.norm(path);
    if (!str.startsWith(pieces[0])) return false;
    let from = pieces[0].length;
    for (let i = 1; i < pieces.length; i++) {
      if (!pieces[i]) continue;
      const at = str.indexOf(pieces[i], from);
      if (at === -1) return false;
      from = at + pieces[i].length;
    }
    return true;
  }

  /**
   * Count the matcher's worst case for this rule on this path; past the budget, give up. Without a "*" it
   * compares at most the shorter of the two; with one, each position of the path may retry the longest
   * piece after a "*".
   */
  charge(pattern: string, path: string): void {
    const s = this.shape(pattern);
    const n = this.norm(path).length;
    this.used += s.pieces.length === 1 ? Math.min(s.length, n) + 1 : (n + 1) * (s.longest + 1) + s.length + n;
    if (this.used > this.budget) throw new TooComplex();
  }

  /** patternMatches, screened and counted. */
  fits(pattern: string, path: string): boolean {
    if (!this.screen(pattern, path)) return false;
    this.charge(pattern, path);
    return patternMatches(pattern, path);
  }

  /** The groups with only the rules that could match `path`, so isAllowed has little to do. */
  screenGroups(groups: RobotsGroup[], path: string): RobotsGroup[] {
    return groups.map((g) => ({ agents: g.agents, rules: g.rules.filter((r) => this.screen(r.path, path)) }));
  }

  /** isAllowed from robots.ts on screened groups (the same answer: dropped rules can't match), counted. */
  allowed(screened: RobotsGroup[], token: string, path: string): boolean {
    if (path !== "/robots.txt") for (const r of rulesFor(screened, token)) this.charge(r.path, path);
    return isAllowed(screened, token, path);
  }
}

/** Why a bot is allowed or blocked on a path: the matching user-agent line of the group, and the rule that wins. */
export interface BlockReason {
  agent: RobotsLine;
  rule: RobotsLine;
  allow: boolean;
}

/** The winning rule for a bot on a path (longest match, Allow wins a tie), or null when no rule matches (allowed). */
function explainIn(groups: LineGroup[], token: string, path: string, m: Matcher): { group: LineGroup; rule: Entry; matched: string } | null {
  if (path === "/robots.txt") return null;
  const t = token.toLowerCase();
  let matched = t;
  let use = groups.filter((g) => g.agents.some((a) => a.token === t));
  if (!use.length) {
    matched = "*";
    use = groups.filter((g) => g.agents.some((a) => a.token === "*"));
  }
  let best: { group: LineGroup; rule: Entry } | null = null;
  for (const g of use) {
    for (const r of g.rules) {
      const p = rulePath(r);
      if (!m.fits(p, path)) continue;
      const bp = best ? rulePath(best.rule) : "";
      const allow = r.key === "allow";
      if (!best || p.length > bp.length || (p.length === bp.length && allow && best.rule.key !== "allow")) best = { group: g, rule: r };
    }
  }
  return best ? { ...best, matched } : null;
}

function reasonOf(hit: { group: LineGroup; rule: Entry; matched: string }): BlockReason {
  const agent = hit.group.agents.find((a) => a.token === hit.matched) ?? hit.group.agents[0];
  return { agent: { line: agent.line, text: agent.text }, rule: { line: hit.rule.line, text: hit.rule.text }, allow: hit.rule.key === "allow" };
}

/**
 * The line that decides whether `token` may read `path`: the user-agent line of its group and the rule
 * that wins. Null when no rule matches (the bot is allowed). Agrees with isAllowed from robots.ts:
 * allowed exactly when the result is null or an Allow rule.
 */
export function explainBlock(text: string, token: string, path: string): BlockReason | null {
  const hit = explainIn(groupEntries(readEntries(text)).groups, token, path, new Matcher(Infinity));
  return hit ? reasonOf(hit) : null;
}

// ---------- the lines to delete ----------

/** The file without the given directives (each one is a line, or a piece of a run-together line). */
function rebuild(entries: Entry[], gone: Set<number>): string {
  return entries
    .filter((e) => !gone.has(e.id))
    .map((e) => e.text)
    .join("\n");
}

/**
 * Directives to delete so `token` can read every path, never adding a rule. For the group that blocks
 * it (the bot's own, or "*"): when the group names other bots too, only the bot's own user-agent line
 * (or the "*" line), so the others keep their rules; else the blocking rule, when the group has other
 * rules; else the whole group. Deleting the last rule of a group takes its user-agent lines too: a run
 * of user-agent lines with no rules would join the next group and pick up its rules. Repeats until the
 * bot can read every path (a bot taken out of its own group falls back to "*"), at most `rounds.left`
 * times for the whole check.
 */
function planFor(entries: Entry[], token: string, paths: string[], gone: Set<number>, m: Matcher, rounds: { left: number }): void {
  const t = token.toLowerCase();
  while (rounds.left-- > 0) {
    const { groups } = groupEntries(entries.filter((e) => !gone.has(e.id)));
    let blocked: { group: LineGroup; rule: Entry; matched: string } | null = null;
    for (const p of paths) {
      const hit = explainIn(groups, t, p, m);
      if (hit && hit.rule.key === "disallow") {
        blocked = hit;
        break;
      }
    }
    if (!blocked) return;
    const { group, rule, matched } = blocked;
    const others = group.agents.some((a) => a.token !== matched);
    if (others) {
      // The group names other bots too: drop only this bot's line (or the "*" line), so they keep the rule.
      for (const a of group.agents) if (a.token === matched) gone.add(a.id);
    } else if (group.rules.length > 1) {
      gone.add(rule.id);
    } else {
      // Its only rule: the whole group goes, user-agent lines included.
      for (const a of group.agents) gone.add(a.id);
      gone.add(rule.id);
    }
  }
}

// ---------- the check ----------

export interface TestedPath {
  /** "your home page", "a product page" */
  label: string;
  path: string;
}

export interface BotPage {
  label: string;
  path: string;
  allowed: boolean;
  /** Why it is blocked (null when allowed). */
  reason: BlockReason | null;
}

export interface BotRow {
  token: string;
  /** The bot whose rules it follows, when that isn't its own (Applebot following Googlebot). */
  rulesFrom: string | null;
  pages: BotPage[];
  blocked: boolean;
}

export type RobotsKind = "shopify-new-default" | "shopify-old-default" | "shopify-custom" | "other";

export interface ReportNote {
  id: "no-rules" | "orphan" | "crawl-delay" | "large" | "no-sitemap" | "low-blocked";
  tone: "info" | "tip" | "warn";
  text: string;
}

export interface CrawlerReport {
  kind: RobotsKind;
  paths: TestedPath[];
  /** Every bot in TOOL_BOTS order. */
  bots: BotRow[];
  notes: ReportNote[];
  /** Sitemap lines in the file (at most 10). */
  sitemaps: string[];
  hasRules: boolean;
  /** Directives to delete so every bot that affects AI answers can read every tested page, in file order. */
  deletions: RobotsLine[];
  /** The file was too complex to check within the work budget: no bots, no verdict either way. */
  tooComplex?: true;
}

/** Google reads the first 500 KiB of a robots.txt. */
const GOOGLE_MAX_BYTES = 500 * 1024;
const MAX_ORPHAN_NOTES = 3;
const MAX_SITEMAPS = 10;
/** Files with more rules than this get the blocking lines listed instead of a worked-out plan. */
const MAX_PLAN_RULES = 2_000;
/** Rounds of the lines-to-delete plan in one check, all bots together. */
const MAX_PLAN_ROUNDS = 60;

/** Which robots.txt this is: Shopify's standard file (new or old), a Shopify file that names bots, or another site's. */
export function robotsKind(text: string): RobotsKind {
  return kindOf(text, parseRobots(text));
}

function kindOf(text: string, groups: RobotsGroup[]): RobotsKind {
  const first = text.replace(/^\uFEFF/, "").trimStart().slice(0, 200);
  // Shopify's 2026 default starts with this comment (facts-2026.md 1.3, Shopify's Horizon demo store).
  const newHeader = first.startsWith("# Shopify storefront.");
  const rules = groups.flatMap((g) => g.rules);
  const has = (s: string) => rules.some((r) => r.path.includes(s));
  // Shopify's layout, old or new: checkout blocks plus one of its own paths. Structural markers only:
  // the old default's header comment isn't verified, so it isn't matched.
  const markers = rules.some((r) => !r.allow && r.path === "/checkouts/") && (has("-remote") || has("/recommendations/products") || has("preview_theme_id"));
  if (!newHeader && !markers) return "other";
  const namesBot = groups.some((g) => g.agents.some((a) => TOOL_TOKENS.has(a)));
  if (namesBot) return "shopify-custom";
  return newHeader ? "shopify-new-default" : "shopify-old-default";
}

export const isShopifyKind = (k: RobotsKind) => k !== "other";
export const isShopifyDefault = (k: RobotsKind) => k === "shopify-new-default" || k === "shopify-old-default";

const byteLength = (s: string) => (s.length * 3 < GOOGLE_MAX_BYTES ? s.length : new TextEncoder().encode(s).length);

/** Every bot in TOOL_BOTS against every path: allowed or blocked, the line that blocks it, notes, and the lines to delete. */
export function checkBots(text: string, paths: TestedPath[]): CrawlerReport {
  try {
    return runCheck(text, paths, new Matcher(WORK_BUDGET));
  } catch (err) {
    if (!(err instanceof TooComplex)) throw err;
    // Never a guess: no bots and no verdict, just "too complex to check here".
    return { kind: kindOf(text, parseRobots(text)), paths, bots: [], notes: [], sitemaps: [], hasRules: true, deletions: [], tooComplex: true };
  }
}

/**
 * Decisions for one parsed file: isAllowed on the groups screened for each page, worked out once per set
 * of groups and page (every bot that falls back to "*" shares one), with the winning line when blocked.
 */
function decider(groups: RobotsGroup[], lineGroups: LineGroup[] | null, m: Matcher) {
  const screened = new Map<string, RobotsGroup[]>();
  const keys = new Map<string, string>();
  const memo = new Map<string, { allowed: boolean; hit: { group: LineGroup; rule: Entry } | null; star: boolean }>();
  const keyOf = (t: string) => {
    let k = keys.get(t);
    if (k === undefined) {
      const named: number[] = [];
      groups.forEach((g, i) => {
        if (g.agents.includes(t)) named.push(i);
      });
      k = named.length ? named.join(",") : "*";
      keys.set(t, k);
    }
    return k;
  };
  return (token: string, path: string): { allowed: boolean; reason: BlockReason | null } => {
    const t = token.toLowerCase();
    const key = `${keyOf(t)}|${path}`;
    let d = memo.get(key);
    if (!d) {
      let s = screened.get(path);
      if (!s) {
        s = m.screenGroups(groups, path);
        screened.set(path, s);
      }
      const allowed = m.allowed(s, token, path);
      const hit = allowed || !lineGroups ? null : explainIn(lineGroups, token, path, m);
      d = { allowed, hit: hit ? { group: hit.group, rule: hit.rule } : null, star: hit?.matched === "*" };
      memo.set(key, d);
    }
    // Bots that share a group share the rule, but each is named by its own user-agent line.
    return { allowed: d.allowed, reason: d.hit ? reasonOf({ ...d.hit, matched: d.star ? "*" : t }) : null };
  };
}

function runCheck(text: string, paths: TestedPath[], m: Matcher): CrawlerReport {
  const groups = parseRobots(text);
  const entries = readEntries(text);
  const { groups: lineGroups, orphans } = groupEntries(entries);
  const decide = decider(groups, lineGroups, m);

  const bots: BotRow[] = TOOL_BOTS.map((bot) => {
    const token = effectiveToken(groups, bot.token);
    const pages = paths.map((p) => ({ label: p.label, path: p.path, ...decide(token, p.path) }));
    return { token: bot.token, rulesFrom: token === bot.token ? null : token, pages, blocked: pages.some((p) => !p.allowed) };
  });

  // Lines to delete, for the bots whose blocks hurt. A bot that follows another bot's rules (Applebot
  // following Googlebot) is fixed by fixing that bot, so it's skipped here. Big files skip the plan.
  const gone = new Set<number>();
  const pathList = paths.map((p) => p.path);
  const ruleCount = lineGroups.reduce((n, g) => n + g.rules.length, 0);
  const rounds = { left: MAX_PLAN_ROUNDS };
  if (ruleCount <= MAX_PLAN_RULES) {
    for (const row of bots) {
      if (!row.blocked || row.rulesFrom || !isImportant(BY_TOKEN.get(row.token)!)) continue;
      planFor(entries, row.token, pathList, gone, m, rounds);
    }
  }
  // Check the plan with the real parser; keep it only if it opens every page for those bots.
  if (gone.size) {
    const after = parseRobots(rebuild(entries, gone));
    const decideAfter = decider(after, null, m);
    const works = bots.every(
      (row) => !row.blocked || !isImportant(BY_TOKEN.get(row.token)!) || pathList.every((p) => decideAfter(effectiveToken(after, row.token), p).allowed),
    );
    if (!works) gone.clear();
  }
  const deletions = entries.filter((e) => gone.has(e.id)).map((e) => ({ line: e.line, text: e.text }));
  if (!gone.size) {
    // Fallback: the blocking rule lines themselves.
    const seen = new Set<string>();
    for (const row of bots) {
      if (!isImportant(BY_TOKEN.get(row.token)!)) continue;
      for (const p of row.pages) {
        if (!p.reason) continue;
        const key = `${p.reason.rule.line}:${p.reason.rule.text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deletions.push(p.reason.rule);
      }
    }
    deletions.sort((a, b) => a.line - b.line);
  }

  const hasRules = groups.some((g) => g.rules.length > 0);
  const sitemaps = entries
    .filter((e) => e.key === "sitemap" && e.value)
    .slice(0, MAX_SITEMAPS)
    .map((e) => (e.value.length > 300 ? `${e.value.slice(0, 300)}…` : e.value));
  const notes: ReportNote[] = [];
  if (!hasRules) notes.push({ id: "no-rules", tone: "info", text: NOTE_COPY.noRules });
  for (const o of orphans.slice(0, MAX_ORPHAN_NOTES)) notes.push({ id: "orphan", tone: "info", text: NOTE_COPY.orphan(o.line) });
  if (entries.some((e) => e.key === "crawl-delay")) notes.push({ id: "crawl-delay", tone: "info", text: NOTE_COPY.crawlDelay });
  if (byteLength(text) >= GOOGLE_MAX_BYTES) notes.push({ id: "large", tone: "warn", text: NOTE_COPY.large });
  for (const row of bots) {
    const bot = BY_TOKEN.get(row.token)!;
    if (row.blocked && bot.level === "low") notes.push({ id: "low-blocked", tone: "tip", text: NOTE_COPY.lowBlocked(bot) });
  }
  if (text.trim() && !sitemaps.length) notes.push({ id: "no-sitemap", tone: "tip", text: NOTE_COPY.noSitemap });

  return { kind: kindOf(text, groups), paths, bots, notes, sitemaps, hasRules, deletions };
}

/** What we found at a site's /robots.txt. */
export type RobotsStatus = "file" | "no-file" | "turned-away" | "server-error";

/** A fetched site's result (crawler.server.ts checkSite), as the page shows it. */
export interface SiteCheck {
  host: string;
  robotsUrl: string;
  status: RobotsStatus;
  /** The status code when it wasn't a file (404, 403, 503), or when the address showed a web page. */
  httpStatus?: number;
  /** The address answered with a web page, not a robots.txt (treated as no file). */
  html?: boolean;
  /** The home page or the robots.txt looks like Shopify's. */
  shopify: boolean;
  /** Every bot on every tested page. Null when we couldn't read the file (turned away, server error). */
  report: CrawlerReport | null;
  /** "We couldn't find product links on your home page, so we tested your home page." */
  pathNote: string | null;
}

// ---------- the verdict ----------

export const NOTE_COPY = {
  noRules: "Your robots.txt has no rules, so every bot is allowed.",
  orphan: (line: number) => `Line ${line} isn't under a User-agent line, so bots ignore it.`,
  crawlDelay: "Google ignores Crawl-delay. Some other bots follow it.",
  large: "Your robots.txt is very large. Google reads only the first 500 KB.",
  noSitemap: "Add a Sitemap line so bots can find all your pages.",
  lowBlocked: (b: ToolBot) => `${b.token} (${b.owner}) is blocked as well. What it does: ${b.what}`,
};

export interface Verdict {
  /** warn: the file was too complex to check, so there's no verdict either way. */
  tone: "good" | "bad" | "warn";
  /** "1 bot that affects AI answers is blocked" or "All the bots that affect AI answers can read your pages". */
  headline: string;
  /** The line about training bots. */
  training: string;
  /** The file is Shopify's standard robots.txt and nothing that matters is blocked. */
  shopifyStandard: boolean;
  blocked: number;
  trainingBlocked: number;
}

export const VERDICT_COPY = {
  allClear: "All the bots that affect AI answers can read your pages",
  blocked: (n: number) => `${plural(n, "bot")} that ${n === 1 ? "affects" : "affect"} AI answers ${n === 1 ? "is" : "are"} blocked`,
  trainingBlocked: (n: number) => `${plural(n, "training bot")} ${n === 1 ? "is" : "are"} blocked. That only stops AI training.`,
  trainingAllowed: "Training bots are allowed too.",
  shopifyStandard: "You have Shopify's standard robots.txt. It blocks no AI bot.",
  tooComplex: "We couldn't check this robots.txt",
  tooComplexLead:
    "It has too many complicated rules (lots of `*` wildcards) for this free check to work through, so we can't say which bots it lets in.",
};

/** The one-line verdict: blocks that hurt (high and medium, in any group), then training bots. */
export function verdict(report: CrawlerReport): Verdict {
  if (report.tooComplex) {
    return { tone: "warn", headline: VERDICT_COPY.tooComplex, training: VERDICT_COPY.tooComplexLead, shopifyStandard: false, blocked: 0, trainingBlocked: 0 };
  }
  const blocked = report.bots.filter((r) => r.blocked && isImportant(BY_TOKEN.get(r.token)!)).length;
  const trainingBlocked = report.bots.filter((r) => r.blocked && BY_TOKEN.get(r.token)!.group === "training").length;
  return {
    tone: blocked ? "bad" : "good",
    headline: blocked ? VERDICT_COPY.blocked(blocked) : VERDICT_COPY.allClear,
    training: trainingBlocked ? VERDICT_COPY.trainingBlocked(trainingBlocked) : VERDICT_COPY.trainingAllowed,
    shopifyStandard: isShopifyDefault(report.kind) && !blocked,
    blocked,
    trainingBlocked,
  };
}

/** Rows in a group, blocked first, then in TOOL_BOTS order. */
export function rowsIn(report: CrawlerReport, group: BotGroup): BotRow[] {
  const order = new Map(TOOL_BOTS.map((b, i) => [b.token, i]));
  return report.bots
    .filter((r) => BY_TOKEN.get(r.token)?.group === group)
    .sort((a, b) => Number(b.blocked) - Number(a.blocked) || order.get(a.token)! - order.get(b.token)!);
}

/** The text without the given directives (tests use it to check that a deletion plan works). */
export function withoutLines(text: string, lines: RobotsLine[]): string {
  const entries = readEntries(text);
  const drop = new Set(lines.map((l) => `${l.line}:${l.text}`));
  return rebuild(
    entries,
    new Set(entries.filter((e) => drop.has(`${e.line}:${e.text}`)).map((e) => e.id)),
  );
}
