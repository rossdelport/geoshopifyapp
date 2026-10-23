// Free product check: the full action plan. Only sent by email (in the PDF), never shown on the page:
// the page gets the counts (CheckPlanTeaser) for its locked teaser.
// Pure (tested). Built only from what the check saw: the report, the AI answers and the questions.
// It never adds a fact the check didn't find.

import { domainStem } from "./check-read";
import { sameBrand } from "./match";
import { ENGINE_LABELS, OFFER, PLANS } from "./plans";
import {
  CHECK_ENGINES,
  type CheckAnswer,
  type CheckPlanTeaser,
  type CheckProduct,
  type CheckQuestion,
  type CheckReport,
} from "./check-types";

export type PlanStepKind = "page" | "tip" | "questions" | "sites" | "rivals" | "geo";

export interface PlanItem {
  label: string; // a check, a question, a site or a brand
  detail?: string; // one or two plain sentences: what we saw
  fix?: string; // how to fix it (page fixes)
  urls?: string[]; // the articles AI linked to (sites), or the install link
}

export interface PlanStep {
  kind: PlanStepKind;
  title: string;
  body: string;
  items: PlanItem[];
}

export interface ActionPlan {
  steps: PlanStep[]; // numbered in this order
  teaser: CheckPlanTeaser;
}

export interface PlanInput {
  product: Pick<CheckProduct, "brand">;
  questions: CheckQuestion[];
  answers: CheckAnswer[];
  report: CheckReport; // the full report, tips and fixes included
  joinUrl: string; // absolute link to the waitlist
}

export const MAX_PLAN_SITES = 8;
const MAX_URLS_PER_SITE = 2;
const MAX_WINNERS = 3;

const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
const times = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Tips (check-report.ts) that a step below already covers, so the plan never says the same thing twice.
const OBSERVATION = /\b(?:doesn’t|don’t) mention\b/; // "AI doesn’t mention X yet", "Gemini doesn’t mention you yet"
const SITES_TIP = /^Get featured on /;
const RIVALS_TIP = /^See why AI picks /;
const AI_READY_TIPS = new Set([
  "Say who it’s for",
  "Spell out the key facts",
  "Put the key facts first",
  "Add questions and answers",
  "Make the description more specific",
  "Complete your product data",
  "Say where it ships or is made",
  "Make your page easier for AI to quote",
]);
const DESCRIPTION_TIPS = new Set(["Add a product description", "Add a full product description", "Write a fuller product description"]);
const SCHEMA_TIPS = new Set(["Add product data AI can read"]);
const GEO_TIPS = new Set(["Keep an eye on it every week", "Check more of the questions shoppers ask"]);

/** A link we can print: http(s) only, no fragment, not absurdly long. */
function cleanUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.hash = "";
    const s = u.toString();
    return s.length <= 400 ? s : null;
  } catch {
    return null;
  }
}

function pageStep(report: CheckReport): PlanStep | null {
  const failed = (report.aiReady?.checks ?? []).filter((c) => !c.pass && c.fix.trim()).sort((a, b) => b.weight - a.weight);
  if (!failed.length) return null;
  return {
    kind: "page",
    title: "Fix these on your product page",
    body: `Your page scored ${report.aiReady!.score} out of 100 for how easy it is for AI to quote. ${
      failed.length === 1 ? "This change is" : `These ${failed.length} changes are`
    } in your hands and quick to make. Only add facts that are true.`,
    items: failed.map((c) => ({ label: c.label, detail: c.reason, fix: c.fix })),
  };
}

function questionsStep(input: PlanInput): PlanStep | null {
  const { product, questions, answers, report } = input;
  // Only brands the report lists, so a misread name never turns up here.
  const known = report.competitors.map((c) => c.name);
  const items: PlanItem[] = [];
  questions.forEach((q, qi) => {
    const back = answers.filter((a) => a.question === qi && a.ok && !a.empty);
    if (!back.length) return;
    const named = back.filter((a) => a.named).length;
    if (named === back.length) return;
    const counts = new Map<string, number>();
    for (const a of back) {
      const mine = a.position ? a.brands[a.position - 1] : null;
      const seen = new Set<string>();
      for (const b of a.brands) {
        if (b === mine || sameBrand(b, product.brand)) continue;
        const name = known.find((k) => sameBrand(k, b));
        if (!name || seen.has(name)) continue;
        seen.add(name);
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    const winners = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || known.indexOf(a[0]) - known.indexOf(b[0]))
      .slice(0, MAX_WINNERS);
    const missingOn = CHECK_ENGINES.filter((e) => {
      const mine = back.filter((a) => a.engine === e);
      return mine.length > 0 && !mine.some((a) => a.named);
    }).map((e) => ENGINE_LABELS[e]);
    const seenLine = named ? `Named in ${named} of ${back.length} answers.` : `Not named in any of the ${back.length} answers.`;
    const whereLine = named && missingOn.length ? ` Missing on ${list(missingOn)}.` : "";
    const winnersLine = winners.length
      ? ` AI picked ${list(winners.map(([name, n], i) => (i === 0 ? `${name} in ${times(n, "answer", "answers")}` : `${name} in ${n}`)))}.`
      : " AI didn’t name another brand for it either.";
    items.push({ label: q.text, detail: `${seenLine}${whereLine}${winnersLine}` });
  });
  if (!items.length) return null;
  return {
    kind: "questions",
    title: "Win the questions you’re missing from",
    body: `AI left ${product.brand} out of these answers. Answer each question in plain words on your product page, and see what the brands it picked say on theirs.`,
    items,
  };
}

/** Review and roundup articles AI cited (not your site, not a rival brand's own blog), most cited first. */
export function sitesToPitch(input: Pick<PlanInput, "product" | "answers" | "report">): { domain: string; count: number; urls: string[] }[] {
  const { product, answers, report } = input;
  const rivals = report.competitors.map((c) => c.name);
  const blocked = (domain: string) => {
    const stem = domainStem(domain);
    return sameBrand(stem, product.brand) || rivals.some((n) => sameBrand(stem, n));
  };
  const sites = new Map<string, { domain: string; count: number; first: number; urls: Map<string, number> }>();
  answers
    .filter((a) => a.ok && !a.empty)
    .forEach((a, i) => {
      const seen = new Set<string>();
      for (const s of a.sources) {
        if (s.type !== "editorial" || s.isOwn || !s.domain || blocked(s.domain)) continue;
        const url = cleanUrl(s.url);
        let site = sites.get(s.domain);
        if (!site) {
          site = { domain: s.domain, count: 0, first: i, urls: new Map() };
          sites.set(s.domain, site);
        }
        if (!seen.has(s.domain)) {
          seen.add(s.domain);
          site.count++;
        }
        if (url) site.urls.set(url, (site.urls.get(url) ?? 0) + 1);
      }
    });
  // Older checks may have no answers saved: fall back to the report's sites and their example links.
  if (!sites.size) {
    report.sources
      .filter((s) => s.type === "editorial" && !s.isOwn && !blocked(s.domain))
      .forEach((s, i) => {
        const url = cleanUrl(s.exampleUrl);
        sites.set(s.domain, { domain: s.domain, count: s.count, first: i, urls: new Map(url ? [[url, 1]] : []) });
      });
  }
  return [...sites.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .slice(0, MAX_PLAN_SITES)
    .map((s) => ({
      domain: s.domain,
      count: s.count,
      urls: [...s.urls.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_URLS_PER_SITE)
        .map(([u]) => u),
    }));
}

function sitesStep(input: PlanInput): PlanStep | null {
  const sites = sitesToPitch(input);
  if (!sites.length) return null;
  return {
    kind: "sites",
    title: "Get featured on the sites AI trusts",
    body: `AI cited these review and roundup articles in its answers. Email the writer: say what ${input.product.brand} is and who it suits, and ask them to consider it next time they update the article. Keep it short and honest.`,
    items: sites.map((s) => ({ label: s.domain, detail: `Cited in ${times(s.count, "answer", "answers")}.`, urls: s.urls })),
  };
}

function rivalsStep(report: CheckReport): PlanStep | null {
  if (!report.competitors.length) return null;
  return {
    kind: "rivals",
    title: "Study the brands AI picks instead",
    body: "Compare their product pages with yours. AI often repeats what they spell out: who it’s for, sizes, ingredients or materials, and where it’s sold.",
    items: report.competitors.map((c) => ({ label: c.name, detail: `Named in ${c.count} of ${report.answerCount} answers.` })),
  };
}

function geoStep(joinUrl: string): PlanStep {
  const plan = PLANS.pro;
  return {
    kind: "geo",
    title: "Let GEO do this for you",
    body: `GEO checks up to ${plan.questions} buying questions every day on ChatGPT, Gemini, Perplexity and Google AI Overviews, writes buying guides and Reddit replies for you, and our team pitches the sites AI quotes most.`,
    items: [
      {
        label: "Join the GEO waitlist",
        detail: `${OFFER.line} We’ll reach out shortly.`,
        urls: [joinUrl],
      },
    ],
  };
}

/** The full plan, in the order a store should work through it. */
export function buildActionPlan(input: PlanInput): ActionPlan {
  const { report } = input;
  const page = pageStep(report);
  const questions = questionsStep(input);
  const sites = sitesStep(input);
  const rivals = rivalsStep(report);
  const pageIds = new Set((report.aiReady?.checks ?? []).filter((c) => !c.pass && c.fix.trim()).map((c) => c.id));

  const tips: PlanStep[] = (report.tips ?? [])
    .filter((t) => {
      if (GEO_TIPS.has(t.title)) return false;
      if (questions && OBSERVATION.test(t.title)) return false;
      if (sites && SITES_TIP.test(t.title)) return false;
      if (rivals && RIVALS_TIP.test(t.title)) return false;
      if (page && AI_READY_TIPS.has(t.title)) return false;
      if (pageIds.has("description") && DESCRIPTION_TIPS.has(t.title)) return false;
      if (pageIds.has("schema") && SCHEMA_TIPS.has(t.title)) return false;
      return true;
    })
    .map((t) => ({ kind: "tip", title: t.title, body: t.body, items: [] }));

  const steps = [page, ...tips, questions, sites, rivals, geoStep(input.joinUrl)].filter((s): s is PlanStep => Boolean(s));
  return {
    steps,
    teaser: {
      steps: steps.length,
      pageFixes: page?.items.length ?? 0,
      sitesToPitch: sites?.items.length ?? 0,
      rivalsToStudy: rivals?.items.length ?? 0,
    },
  };
}
