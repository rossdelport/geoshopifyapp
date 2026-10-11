// AI crawler check: does the store's robots.txt stop the bots that AI assistants use from reading its
// product pages? Pure (tested), safe for the browser. The fetch, the database and the weekly job are in
// robots.server.ts.
//
// The parser follows RFC 9309 (the Robots Exclusion Protocol):
// - each line is trimmed; "#" starts a comment; keys are case-insensitive ("Disallow", "disallow");
// - a group is one or more user-agent lines followed by rules; a user-agent line after a rule starts a
//   new group (no blank lines needed between groups);
// - the bot's product token is matched without case; the most specific group wins (a group naming the
//   bot means "*" is ignored), and several groups for the same bot are merged;
// - the longest matching rule wins, and Allow wins a tie; "*" (any characters) and "$" (end) are the
//   only special characters, so brackets and the rest are literal; /robots.txt is always allowed.
// Shopify's default robots.txt blocks no AI bot. Its "Disallow: /products/*-[a-f0-9]...-remote" lines
// only match odd product URLs ending in "-remote", never a normal /products/<handle>.

export type CrawlerLevel = "critical" | "medium" | "info";

export interface AiBot {
  token: string; // the robots.txt product token
  name: string; // what we call it on screen
  owner: string;
  level: CrawlerLevel; // how much a block hurts being recommended
  what: string; // one plain sentence: what the bot does
}

// Checked against each company's own crawler pages (October 2026). Never say a training-only bot
// (GPTBot, ClaudeBot) hides a store from answers: it doesn't.
export const AI_BOTS: AiBot[] = [
  { token: "Googlebot", name: "Googlebot", owner: "Google", level: "critical", what: "Google Search's crawler. Google AI Overviews and AI Mode answer from what it reads." },
  { token: "OAI-SearchBot", name: "OAI-SearchBot", owner: "OpenAI", level: "critical", what: "Decides whether your pages can show up in ChatGPT search answers." },
  { token: "PerplexityBot", name: "PerplexityBot", owner: "Perplexity", level: "critical", what: "Decides whether your pages can show up in Perplexity's answers." },
  { token: "Claude-SearchBot", name: "Claude-SearchBot", owner: "Anthropic", level: "medium", what: "Reads pages for Claude's search results." },
  { token: "Claude-User", name: "Claude-User", owner: "Anthropic", level: "medium", what: "Fetches a page when someone asks Claude about it." },
  { token: "Google-Extended", name: "Google-Extended", owner: "Google", level: "medium", what: "Lets Gemini use your pages for training and for grounding its answers. It doesn't affect Google Search or AI Overviews." },
  { token: "Bingbot", name: "Bingbot", owner: "Microsoft", level: "medium", what: "Bing's crawler. Microsoft Copilot answers come from Bing." },
  { token: "ChatGPT-User", name: "ChatGPT-User", owner: "OpenAI", level: "info", what: "Fetches a page when someone asks ChatGPT about it. OpenAI says robots.txt may not apply to it." },
  { token: "Perplexity-User", name: "Perplexity-User", owner: "Perplexity", level: "info", what: "Fetches a page when someone asks Perplexity about it. Perplexity says it generally ignores robots.txt." },
  { token: "GPTBot", name: "GPTBot", owner: "OpenAI", level: "info", what: "Collects pages to train OpenAI's models. Blocking it only stops AI training, not ChatGPT answers." },
  { token: "ClaudeBot", name: "ClaudeBot", owner: "Anthropic", level: "info", what: "Collects pages to train Anthropic's models. Blocking it only stops AI training, not Claude's answers." },
];

export interface RobotsRule {
  allow: boolean;
  path: string; // the pattern as written (trimmed)
}

export interface RobotsGroup {
  agents: string[]; // lowercased product tokens ("*" for all)
  rules: RobotsRule[];
}

const MAX_LINES = 20_000;
const MAX_PATTERN = 1_000;
// A directive run straight into the previous one ("...-remoteDisallow: /collections/*-loop") when a copy
// lost its line breaks: split it back onto its own line.
const RUN_TOGETHER = /(?<=\S)(?<!dis)(?=(?:user-agent|disallow|allow|sitemap|crawl-delay)\s*:)/gi;

/** Parse robots.txt into groups (RFC 9309). Linear in the file's length; caps lines and pattern length. */
export function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/, MAX_LINES);
  for (const raw of lines) {
    const noComment = raw.length > 4_000 ? raw.slice(0, 4_000) : raw;
    const hash = noComment.indexOf("#");
    const body = (hash === -1 ? noComment : noComment.slice(0, hash)).trim();
    if (!body) continue;
    for (const line of body.split(RUN_TOGETHER)) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const key = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();
      if (key === "user-agent") {
        const token = value.split(/[\s/]/)[0].toLowerCase();
        if (!lastWasAgent || !current) {
          current = { agents: [], rules: [] };
          groups.push(current);
        }
        if (token) current.agents.push(token);
        lastWasAgent = true;
      } else if (key === "allow" || key === "disallow") {
        lastWasAgent = false;
        // Rules before any user-agent line belong to no group; an empty Disallow allows everything.
        if (!current || !value) continue;
        current.rules.push({ allow: key === "allow", path: value.slice(0, MAX_PATTERN) });
      } else {
        // Sitemap, crawl-delay and others don't end a run of user-agent lines (RFC 9309 2.2.4).
      }
    }
  }
  return groups;
}

/** The rules that apply to a bot: every group naming it, merged; else every "*" group, merged. */
export function rulesFor(groups: RobotsGroup[], token: string): RobotsRule[] {
  const t = token.toLowerCase();
  const named = groups.filter((g) => g.agents.includes(t));
  const use = named.length ? named : groups.filter((g) => g.agents.includes("*"));
  return use.flatMap((g) => g.rules);
}

/** Normalise percent-encoding so "/caf%C3%A9" and "/café" compare the same (RFC 9309 2.2.2). */
function normalisePath(p: string): string {
  try {
    return decodeURIComponent(p.replace(/%(?![0-9a-f]{2})/gi, "%25"));
  } catch {
    return p;
  }
}

/**
 * Does `pattern` match the start of `path`? "*" matches any characters and a final "$" anchors the end;
 * everything else is literal. A simple matcher (no regex), so odd patterns can't make it slow.
 */
export function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const pat = normalisePath(anchored ? pattern.slice(0, -1) : pattern);
  const str = normalisePath(path);
  let p = 0;
  let s = 0;
  let star = -1;
  let mark = 0;
  while (s < str.length) {
    if (p < pat.length && pat[p] === "*") {
      star = p++;
      mark = s;
    } else if (p < pat.length && pat[p] === str[s]) {
      p++;
      s++;
    } else if (p >= pat.length && !anchored) {
      return true; // the pattern is a prefix of the path
    } else if (star !== -1) {
      p = star + 1;
      s = ++mark;
    } else {
      return false;
    }
  }
  while (p < pat.length && pat[p] === "*") p++;
  return p >= pat.length;
}

/** Is `path` allowed for `token`? Longest matching rule wins; Allow wins a tie; no rule means allowed. */
export function isAllowed(groups: RobotsGroup[], token: string, path: string): boolean {
  if (path === "/robots.txt") return true;
  let best: RobotsRule | null = null;
  for (const r of rulesFor(groups, token)) {
    if (!patternMatches(r.path, path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow && !best.allow)) best = r;
  }
  return best ? best.allow : true;
}

// ---------- The check ----------

export interface CrawlerPath {
  label: string; // "product pages", "your home page", "guide pages"
  path: string;
}

export interface BotResult {
  token: string;
  name: string;
  owner: string;
  level: CrawlerLevel;
  what: string;
  blocked: string[]; // labels of the paths it can't read
}

export type CrawlerStatus = "ok" | "blocked" | "no-file" | "unreachable";

export interface CrawlerCheck {
  checkedAt: string; // ISO date
  robotsUrl: string;
  status: CrawlerStatus; // blocked = at least one critical or medium bot is blocked somewhere we test
  httpStatus?: number; // what the store answered, when it wasn't a robots.txt (403 = turned away, 503 = down)
  paths: CrawlerPath[];
  bots: BotResult[]; // every bot we check, blocked or not
}

/** The store answered, but turned our check away (a firewall or bot protection, not a missing file). */
export const turnedAway = (check: Pick<CrawlerCheck, "status" | "httpStatus"> | null | undefined) =>
  check?.status === "unreachable" && (check.httpStatus === 401 || check.httpStatus === 403);

/** Check every AI bot against the paths that matter (a real product page, the home page, a guide page). */
export function checkRobots(text: string, paths: CrawlerPath[]): Pick<CrawlerCheck, "status" | "bots"> {
  const groups = parseRobots(text);
  const bots = AI_BOTS.map((b) => ({
    token: b.token,
    name: b.name,
    owner: b.owner,
    level: b.level,
    what: b.what,
    blocked: paths.filter((p) => !isAllowed(groups, b.token, p.path)).map((p) => p.label),
  }));
  const serious = bots.some((b) => b.blocked.length && b.level !== "info");
  return { status: serious ? "blocked" : "ok", bots };
}

/** The bots worth telling the store about, worst first: blocked critical, then medium, then training-only. */
export function crawlerIssues(check: CrawlerCheck | null | undefined): BotResult[] {
  if (!check?.bots) return [];
  const rank: Record<CrawlerLevel, number> = { critical: 0, medium: 1, info: 2 };
  return check.bots.filter((b) => b.blocked.length).sort((a, b) => rank[a.level] - rank[b.level]);
}

/** How to remove a block, in plain words (the app can't edit themes: it has no theme access). */
export const ROBOTS_FIX =
  "In Shopify admin, go to Online Store, then Themes. On your live theme, open the menu and choose Edit code. Open robots.txt.liquid and remove the lines that block this bot, then save. If there's no robots.txt.liquid file, the block may come from an app, a developer or a service in front of your store (such as Cloudflare's managed robots.txt): ask them to remove it.";

/** What robots.txt can't show. */
export const ROBOTS_LIMIT =
  "A firewall or bot protection (for example Cloudflare's setting to block AI bots) can also stop these bots, and that doesn't show in robots.txt. If you use one, check its settings too.";

/** "product pages and your home page" */
export function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/** One plain line about a blocked bot. Training-only bots say so, so nobody thinks they hide the store. */
export function botLine(b: BotResult): string {
  const where = joinLabels(b.blocked);
  if (b.level === "info") return `${b.name} (${b.owner}) is blocked from ${where}. ${b.what}`;
  return `${b.name} (${b.owner}) can't read ${where}. ${b.what}`;
}
