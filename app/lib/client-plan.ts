// Each client's plan in the agency hub (Ross, 17 Nov 2026: "i want to be able to see each client, what has been set up or
// hasnt, like a checklist ... then also what is going to be worked on for that client for the day"; then "i click into
// the card and it will show them in the pop up ... the checklist of things to do and on the right hand side will have a
// doing today followed by whats up next and in the pipeline and WHY it is being done"). Two parts, both pure rules
// (test/client-plan.test.ts); lib/client-plan.server.ts reads the database and saves the ticks.
//
// - The checklist: the first 24 hours, then the crucial next steps, one list for local businesses and one for online
//   stores. It follows the doc "Client checklist: months 1 to 3 (local businesses)",
//   https://claude.ai/artifact/4YawCq1z8gbrvuf9SJMsXN, so the doc and the dashboard agree. Lines the dashboard can see
//   for itself (setup, the first AI check, the first guide live...) tick themselves; Ross ticks the rest.
// - The work: what runs for the client today, in the next 7 days and later, each with why, read from the real schedule
//   (AI checks, the guide calendar, Reddit looks, reports). Nothing here is made up: no schedule, no line.

import { addDays, dayLabel } from "./guide-calendar";
import { type ClientStatus, HUB_TZ, addMonths, dayOf, monthOneEnds, refundUntil } from "./clients";

// ---------- The checklist ----------

/** Who does a line: the dashboard by itself, Ross, or the client. */
export type Who = "auto" | "you" | "client";
export const WHO_LABEL: Record<Who, string> = { auto: "Auto", you: "You", client: "Client" };

/** What the dashboard can see for itself, so those lines tick themselves (and can't be unticked by hand). */
export type AutoKey = "setup" | "first-check" | "contact" | "tracking" | "crawlers" | "guide-live" | "report-sent" | "reddit" | "month-report";
export type AutoFacts = Record<AutoKey, boolean>;

/** When a line is due, counted from the day the work started. */
export type Due = "day1" | "week1" | "week2" | "week3" | "month1" | "month2";

export interface CheckItem {
  key: string; // saved with each tick: never rename one, or its ticks are lost
  text: string;
  why: string;
  who: Who;
  due: Due;
  auto?: AutoKey;
  /** Where it's done, inside the client's pages ("/questions"), when the dashboard has a page for it. */
  link?: string;
}

const SHARED = {
  firstCheck: { key: "first-check", due: "day1", who: "auto", auto: "first-check", link: "/questions", text: "First AI check done", why: "It shows who AI names today, so you can show the change later." },
  contact: { key: "contact", due: "day1", who: "you", auto: "contact", link: "/details", text: "Their email added, for the reports", why: "The weekly report goes to this address." },
  searchConsole: {
    key: "search-console",
    due: "day1",
    who: "client",
    text: "They add you to Google Search Console (Restricted is fine)",
    why: "It shows the searches where they are nearly on page one. Those are the fastest wins.",
  },
  notes: { key: "notes", due: "day1", who: "you", link: "/details", text: "Start call answers saved in their notes", why: "Then every page uses the same true facts." },
  before: { key: "before", due: "week1", who: "you", why: "Month 3 is measured against this." },
  reportSent: { key: "report-sent", due: "week1", who: "you", auto: "report-sent", link: "/reports", text: "First weekly report emailed", why: "They see the work every week." },
  nearPageOne: { key: "near-page-one", due: "week3", who: "you", text: "Improve 3 pages that sit at spots 4 to 15 in Search Console", why: "Pages that are almost on page one are the fastest win." },
  monthReport: {
    key: "month-report",
    due: "month1",
    who: "you",
    auto: "month-report",
    link: "/reports",
    text: "Monthly report emailed, with a before and now note",
    why: "Month 1 is when they can ask for the refund, so make the work easy to see.",
  },
} satisfies Record<string, Partial<CheckItem>>;

/** A business that isn't an online store: a broker, an installer, a tradie (lib/business.ts). */
export const LOCAL_CHECKLIST: CheckItem[] = [
  { key: "setup", due: "day1", who: "auto", auto: "setup", link: "/questions", text: "Their website read and buying questions written", why: "These are the questions people ask AI before they pick a business like theirs." },
  SHARED.firstCheck,
  SHARED.contact,
  { key: "start-call", due: "day1", who: "you", text: "Start call, 30 minutes, with the 8 questions", why: "Their customers’ own words become buying questions and pages." },
  {
    key: "gbp-access",
    due: "day1",
    who: "client",
    text: "They add you as a Manager on their Google Business Profile",
    why: "In our tests, ChatGPT showed Google stars and reviews next to every local business it named.",
  },
  SHARED.searchConsole,
  { key: "website-login", due: "day1", who: "client", text: "They give you a login to their website", why: "You need it to add pages and fix their details." },
  { key: "photos", due: "day1", who: "client", text: "They send 20 real photos: team, jobs, vans, office", why: "Real photos go on their Google profile and pages. No stock photos." },
  SHARED.notes,
  {
    key: "questions",
    due: "day1",
    who: "you",
    link: "/questions",
    text: "Buying questions checked: remove what doesn’t fit, add their customers’ own",
    why: "The AI checks and the guides follow these questions.",
  },

  { ...SHARED.before, text: "Write down the “before” in a private note: who AI names for their top 5 questions, and their Google stars and reviews" },
  {
    key: "gbp-fix",
    due: "week1",
    who: "you",
    text: "Fix the Google profile: exact name, best category, service areas, services, hours and 10 real photos",
    why: "Google and AI read the profile first. It matters most for a local business.",
  },
  { key: "gbp-replies", due: "week1", who: "you", text: "Reply to every Google review that has no reply yet", why: "It shows a real business that cares. The client OKs your first few replies." },
  { key: "guide-live", due: "week1", who: "you", auto: "guide-live", link: "/guides", text: "First guide live on their website", why: "One useful guide a week answers what buyers ask AI." },
  SHARED.reportSent,
  {
    key: "same-details",
    due: "week2",
    who: "you",
    text: "Same name, phone and address everywhere: their website, Bing Places, Apple Business Connect and Facebook",
    why: "When these don’t match, Google and AI can’t tell which one is right.",
  },
  { key: "about-page", due: "week2", who: "you", text: "About page with the owner’s name and photo, licence number and the suburbs they cover", why: "It shows AI a real, licensed person is behind the business." },
  {
    key: "schema",
    due: "week2",
    who: "you",
    text: "Business details code (LocalBusiness schema) on their home page, matching the Google profile",
    why: "It gives Google and AI their name, phone, area and hours in a form they read easily.",
  },
  SHARED.nearPageOne,
  {
    key: "reviews",
    due: "week3",
    who: "client",
    text: "They ask every customer for a Google review after each job (you write the text)",
    why: "Steady, honest reviews. Google bans rewards and asking only happy customers.",
  },
  SHARED.monthReport,
  {
    key: "lists",
    due: "month2",
    who: "you",
    link: "/sites",
    text: "Get them onto up to 5 lists AI quotes for their trade",
    why: "In our tests, ChatGPT built its local picks from reviews, directories and “best of” lists.",
  },
];

/** An online store (Shopify). */
export const STORE_CHECKLIST: CheckItem[] = [
  { key: "setup", due: "day1", who: "auto", auto: "setup", link: "/questions", text: "Their products read and buying questions written", why: "These are the questions shoppers ask AI before they buy." },
  SHARED.firstCheck,
  SHARED.contact,
  {
    key: "start-call",
    due: "day1",
    who: "you",
    text: "Start call, 30 minutes: best sellers, who buys, what shoppers ask, and what you may change",
    why: "Their words become buying questions and guides, and you agree up front what you can change.",
  },
  { key: "shopify-access", due: "day1", who: "client", text: "They give you staff or collaborator access in Shopify", why: "You need it to add guides and fix product pages." },
  {
    key: "tracking",
    due: "day1",
    who: "you",
    auto: "tracking",
    link: "/tracking",
    text: "Tracking code on their store and sending visits",
    why: "It counts the visits and sales that come from AI, the number that matters most.",
  },
  SHARED.searchConsole,
  SHARED.notes,
  {
    key: "questions",
    due: "day1",
    who: "you",
    link: "/questions",
    text: "Buying questions checked: remove what doesn’t fit, add what their shoppers ask",
    why: "The AI checks and the guides follow these questions.",
  },

  { ...SHARED.before, text: "Write down the “before” in a private note: who AI names for their top 5 questions" },
  { key: "crawlers", due: "week1", who: "you", auto: "crawlers", text: "AI crawlers can read their store (checked every week)", why: "If their robots.txt blocks AI bots, AI can’t read their pages." },
  {
    key: "product-pages",
    due: "week1",
    who: "you",
    text: "Fix the product pages of their 5 best sellers: who it’s for, sizes, materials and a short FAQ",
    why: "AI shopping answers read product details. Clear facts give AI a reason to pick them.",
  },
  {
    key: "guide-live",
    due: "week1",
    who: "you",
    auto: "guide-live",
    link: "/guides",
    text: "First guide live on their store",
    why: "Each guide answers a question shoppers ask AI, starting with the ones where AI names other brands.",
  },
  SHARED.reportSent,
  { key: "reddit", due: "week2", who: "client", auto: "reddit", link: "/reddit", text: "First honest Reddit reply posted by the founder", why: "AI often quotes Reddit. Every reply says who is writing." },
  SHARED.nearPageOne,
  { key: "reviews", due: "week3", who: "client", text: "They ask every customer for an honest review after delivery", why: "Shoppers check reviews before they buy. Never pay or reward anyone for one." },
  SHARED.monthReport,
  {
    key: "lists",
    due: "month2",
    who: "you",
    link: "/sites",
    text: "Get them onto up to 5 “best of” pages AI quotes for their products",
    why: "These are the pages AI quotes when it answers their buying questions.",
  },
];

export const checklistFor = (local: boolean) => (local ? LOCAL_CHECKLIST : STORE_CHECKLIST);

/** A line Ross can tick by hand for this kind of client (lines that tick themselves can't be). */
export const isTickable = (key: unknown, local: boolean) => typeof key === "string" && checklistFor(local).some((i) => i.key === key && !i.auto);

/** The day a line is due: the day after the start, the end of week 1, 2 or 3, the end of month 1 or 2. */
export function dueDay(due: Due, startedOn: string): string {
  switch (due) {
    case "day1":
      return addDays(startedOn, 1);
    case "week1":
      return addDays(startedOn, 6);
    case "week2":
      return addDays(startedOn, 13);
    case "week3":
      return addDays(startedOn, 20);
    case "month1":
      return monthOneEnds(startedOn);
    case "month2":
      return addDays(addMonths(startedOn, 2), -1);
  }
}

export interface Tick {
  key: string;
  doneAt: Date | string;
}

export interface CheckLine {
  key: string;
  due: Due;
  text: string;
  why: string;
  who: Who;
  auto: boolean; // ticks itself
  done: boolean;
  doneOn: string | null; // the day Ross ticked it (lines that tick themselves have none)
  dueDay: string;
  late: boolean; // not done, and its day has passed
  href: string | null;
}

export interface CheckGroup {
  key: "day1" | "next";
  title: string;
  lines: CheckLine[];
  done: number;
}

export const GROUP_TITLE = { day1: "First 24 hours", next: "Next, the crucial ones" } as const;

/** The checklist as the pop-up shows it: the first 24 hours, then the rest in the order they're due. */
export function checklistView(items: CheckItem[], ticks: Tick[], auto: AutoFacts, startedOn: string, today: string, base: string): { groups: CheckGroup[]; done: number; total: number } {
  const ticked = new Map(ticks.map((t) => [t.key, t]));
  const lines = items.map((i): CheckLine => {
    const tick = i.auto ? undefined : ticked.get(i.key);
    const done = i.auto ? auto[i.auto] : Boolean(tick);
    const day = dueDay(i.due, startedOn);
    return {
      key: i.key,
      due: i.due,
      text: i.text,
      why: i.why,
      who: i.who,
      auto: Boolean(i.auto),
      done,
      doneOn: tick ? dayOf(tick.doneAt) : null,
      dueDay: day,
      late: !done && today > day,
      href: i.link ? `${base}${i.link}` : null,
    };
  });
  const order: Due[] = ["day1", "week1", "week2", "week3", "month1", "month2"];
  const groups: CheckGroup[] = (["day1", "next"] as const).map((key) => {
    const mine = lines
      .filter((l) => (key === "day1" ? l.due === "day1" : l.due !== "day1"))
      .sort((a, b) => order.indexOf(a.due) - order.indexOf(b.due));
    return { key, title: GROUP_TITLE[key], lines: mine, done: mine.filter((l) => l.done).length };
  });
  const done = lines.filter((l) => l.done).length;
  return { groups, done, total: lines.length };
}

/** How far a client's checklist is, for their card on the hub: all of it, and the first 24 hours. */
export function checklistCount(local: boolean, tickKeys: Iterable<string>, auto: AutoFacts): { done: number; total: number; firstDone: number; firstTotal: number } {
  const keys = new Set(tickKeys);
  const items = checklistFor(local);
  const isDone = (i: CheckItem) => (i.auto ? auto[i.auto] : keys.has(i.key));
  const first = items.filter((i) => i.due === "day1");
  return { done: items.filter(isDone).length, total: items.length, firstDone: first.filter(isDone).length, firstTotal: first.length };
}

/** "First 24 hours: 4 of 10 done" until those are all done, then "Checklist: 14 of 22 done". */
export function checklistLine(c: { done: number; total: number; firstDone: number; firstTotal: number }): { label: string; done: number; total: number } {
  return c.firstDone < c.firstTotal ? { label: "First 24 hours", done: c.firstDone, total: c.firstTotal } : { label: "Checklist", done: c.done, total: c.total };
}

/** The crawler check's answer counts as "AI can read the store" when nothing serious is blocked (lib/robots.ts). */
export const crawlersOk = (crawlers: unknown) => {
  const status = (crawlers as { status?: string } | null)?.status;
  return status === "ok" || status === "no-file";
};

// ---------- The work: doing today, up next, in the pipeline ----------

/** Done today, running now, due today, planned for later, or waiting for Ross. */
export type FlowState = "done" | "now" | "today" | "planned" | "you";

export interface FlowItem {
  key: string;
  title: string;
  /** The guide's question or title, under the title. */
  detail?: string;
  when: string;
  why: string;
  who: Who;
  state: FlowState;
  href?: string;
  sort: string; // ISO time or day, for the order within a section
}

export interface GuideFact {
  id: string;
  day: string; // the store's day it goes live
  status: string; // planned | writing | ready | published | failed
  approvedAt: string | null;
  writtenAt: string | null;
  publishedAt: string | null;
  title: string; // the guide's title once written, else its buying question
  volume: number | null; // Google searches a month for its question
  rate: number | null; // how often AI names them for its question in the last check (null: not asked yet)
}

export interface FlowFacts {
  now: string; // ISO
  base: string; // the client's pages, "/dash/clients/<id>"
  status: ClientStatus;
  running: boolean; // the plan runs the work (Done for you): checks, guides, Reddit
  local: boolean;
  onboarding: string; // new | profiling | questions | scanning | done
  setupFailed: boolean;
  startedOn: string;
  storeToday: string; // guide days are on the store's own calendar
  connected: boolean; // guides go live through their Shopify by themselves
  scan: { kind: string; done: number; total: number } | null; // an AI check running now
  checksToday: { kind: string; at: string; score: number | null }[]; // finished today (Perth)
  nextCheckAt: string | null; // the next scheduled AI check (null: none, the plan doesn't run them)
  nextFull: boolean; // that check is the full weekly one
  nextFullAt: string | null; // about when the next full weekly check runs, when the next one is a daily one
  costCapHit: boolean;
  redditNextAt: string | null; // online stores: the next weekly Reddit look
  guides: GuideFact[];
  lastReportAt: string | null;
}

export interface PlanFlow {
  today: FlowItem[];
  next: FlowItem[];
  later: FlowItem[];
  /** Why there's nothing, when the work is stopped. */
  note: string | null;
}

/** "3:10 pm", Perth time. */
export const perthTime = (iso: string) => new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: HUB_TZ });

/** "Today", "Tomorrow" or "Thu 19 Nov". */
export function dayWord(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  return dayLabel(day);
}

const WHY = {
  daily: "AI answers change from day to day. A check every day shows the real picture, not one lucky answer.",
  full: "Asks each AI every question twice, so the weekly score is fair and you can compare week to week.",
  extra: "You pressed Check AI now.",
  reddit: "AI often quotes Reddit. Each thread gets a reply draft that says who is writing.",
  okGuide: "Nothing goes on their site without your OK.",
  report: "They see the work every week.",
  capped: "Checks stop at the month’s cost cap, so the costs never run away.",
};

const CHECK_TITLE: Record<string, string> = { daily: "Daily AI check", weekly: "Full weekly AI check", baseline: "First full AI check", manual: "Extra AI check" };
const checkTitle = (kind: string) => CHECK_TITLE[kind] ?? "AI check";
const checkWhy = (kind: string) => (kind === "daily" ? WHY.daily : kind === "manual" ? WHY.extra : WHY.full);

/** Why a guide is written: how often AI names them for its question, how many search for it, and what the page does. */
export function guideWhy(g: Pick<GuideFact, "rate" | "volume">): string {
  const parts: string[] = [];
  if (g.rate === 0) parts.push("AI doesn’t name them for this yet.");
  else if (g.rate !== null && g.rate < 0.5) parts.push(`AI names them in ${Math.round(g.rate * 100)}% of answers.`);
  if (g.volume) parts.push(`About ${g.volume.toLocaleString("en-US")} Google searches a month.`);
  parts.push("A clear page that answers it gives AI a reason to name them.");
  return parts.join(" ");
}

/** What runs for a client today, in the next 7 days and later, each with why. */
export function planFlow(f: FlowFacts): PlanFlow {
  const now = new Date(f.now);
  const today = dayOf(now);
  const week = addDays(today, 7);
  const out: PlanFlow = { today: [], next: [], later: [], note: null };
  const add = (item: FlowItem, day: string) => (day <= today ? out.today : day <= week ? out.next : out.later).push(item);
  const site = f.local ? "website" : "store";

  if (f.onboarding !== "done") {
    const at = f.onboarding === "scanning" ? 2 : f.onboarding === "questions" ? 1 : 0;
    const steps = [
      {
        title: f.local ? "Reading their website" : "Reading their products",
        why: f.local ? "So the questions and guides use their real services and town." : "So the questions and guides use their real products.",
      },
      { title: "Writing their buying questions", why: "These are what people ask AI before they choose." },
      { title: "First AI check", why: "Shows who AI names today, so the change can be measured." },
    ];
    steps.forEach((s, i) => {
      const state: FlowState = i < at ? "done" : i === at ? (f.setupFailed ? "you" : "now") : "today";
      const when =
        state === "done"
          ? "Done"
          : state === "you"
            ? "Setup stopped here. Press Try again on their page."
            : state === "now"
              ? i === 2 && f.scan
                ? `Running now · ${f.scan.done} of ${f.scan.total} answers read`
                : "Running now"
              : "Next, in a few minutes";
      out.today.push({ key: `setup-${i}`, title: s.title, when, why: s.why, who: state === "you" ? "you" : "auto", state, href: state === "you" ? f.base : undefined, sort: String(i) });
    });
  }

  if (f.status !== "active") {
    out.note = f.status === "paused" ? "The work is paused, so nothing new runs for them." : "The work has ended, so nothing new runs for them.";
    return finish(out);
  }

  if (f.onboarding === "done" && f.running) {
    // AI checks: what ran today, what runs now, and the next one.
    for (const c of f.checksToday) {
      out.today.push({
        key: `check-${c.at}`,
        title: checkTitle(c.kind),
        when: `Done ${perthTime(c.at)}${c.score !== null ? ` · score ${Math.round(c.score)}` : ""}`,
        why: checkWhy(c.kind),
        who: "auto",
        state: "done",
        href: `${f.base}/questions`,
        sort: c.at,
      });
    }
    if (f.scan) {
      out.today.push({
        key: "check-now",
        title: checkTitle(f.scan.kind),
        when: `Running now · ${f.scan.done} of ${f.scan.total} answers read`,
        why: checkWhy(f.scan.kind),
        who: "auto",
        state: "now",
        sort: f.now,
      });
    } else if (f.costCapHit) {
      out.today.push({ key: "check-cap", title: "AI checks paused", when: "This month’s cost cap is reached", why: WHY.capped, who: "you", state: "you", href: "/dash/admin/usage", sort: f.now });
    } else if (f.nextCheckAt) {
      const day = dayOf(f.nextCheckAt);
      const kind = f.nextFull ? "weekly" : "daily";
      const at = f.nextCheckAt <= f.now ? "Starting in a minute" : `About ${perthTime(f.nextCheckAt)}`;
      const when = day <= today ? at : `${dayWord(day, today)} about ${perthTime(f.nextCheckAt)}${kind === "daily" ? ", then every day" : ""}`;
      add({ key: "check-next", title: checkTitle(kind), when, why: checkWhy(kind), who: "auto", state: day <= today ? "today" : "planned", sort: f.nextCheckAt }, day);
    }
    if (!f.nextFull && f.nextFullAt) {
      const day = dayOf(f.nextFullAt);
      if (day > today) add({ key: "check-full", title: checkTitle("weekly"), when: `${dayWord(day, today)} about ${perthTime(f.nextFullAt)}`, why: WHY.full, who: "auto", state: "planned", sort: f.nextFullAt }, day);
    }

    // The guide calendar: written two days before its day, live on the day (on the store's own calendar).
    for (const g of f.guides) guideItems(g, f, today, add, out, site);

    // Reddit: a weekly look for threads (online stores only, lib/business.ts).
    if (!f.local && f.redditNextAt) {
      const day = dayOf(f.redditNextAt);
      add({
        key: "reddit",
        title: "Looking for Reddit threads",
        when: day <= today ? (f.redditNextAt <= f.now ? "Starting in a minute" : `About ${perthTime(f.redditNextAt)}`) : `${dayWord(day, today)}, then every week`,
        why: WHY.reddit,
        who: "auto",
        state: day <= today ? "today" : "planned",
        href: `${f.base}/reddit`,
        sort: f.redditNextAt,
      }, day);
    }
  }

  // Reports: weekly from day 6 (like the hub's alert), the end of month 1, and the 3 month report.
  if (f.startedOn <= today) {
    const due = f.lastReportAt ? dayOf(new Date(Date.parse(f.lastReportAt) + 7 * 86_400_000 - 12 * 3_600_000)) : addDays(f.startedOn, 6);
    const day = due < today ? today : due;
    add({
      key: "report",
      title: "Weekly report",
      when: day === today ? (due < today ? `Due since ${dayLabel(due)}` : "Due today") : dayWord(day, today),
      why: WHY.report,
      who: "you",
      state: day <= today ? "you" : "planned",
      href: `${f.base}/reports`,
      sort: `${day}T23:00`,
    }, day);
  }
  const ends = monthOneEnds(f.startedOn);
  if (ends >= today) {
    add({
      key: "month-one",
      title: "First month ends",
      when: dayWord(ends, today),
      why: `Email the monthly report with a before and now note. They can ask for the refund until ${dayLabel(refundUntil(f.startedOn))}.`,
      who: "you",
      state: ends <= today ? "you" : "planned",
      href: `${f.base}/reports`,
      sort: `${ends}T23:30`,
    }, ends);
  }
  const three = addDays(addMonths(f.startedOn, 3), -1);
  if (three > today) {
    add({
      key: "month-three",
      title: "3 month report",
      when: dayWord(three, today),
      why: f.local ? "Show the before and now: AI mentions, Google stars and reviews, calls and clicks." : "Show the before and now: AI mentions, visits and sales from AI.",
      who: "you",
      state: "planned",
      href: `${f.base}/reports`,
      sort: `${three}T23:30`,
    }, three);
  }
  return finish(out);
}

type Add = (item: FlowItem, day: string) => void;

/** One guide day's lines: being written, written today, waiting for an OK, going live, or to be added by hand. */
function guideItems(g: GuideFact, f: FlowFacts, hubToday: string, add: Add, out: PlanFlow, site: string) {
  const today = f.storeToday;
  const href = `${f.base}/guides/${g.id}`;
  const why = guideWhy(g);
  const base = { detail: g.title, href, who: "auto" as Who, why };
  const writeDay = addDays(g.day, -2);
  // A guide's day, placed on Ross's calendar by the day it falls on (the store's day and Perth's are the same or
  // a day apart, and "today" means the store's today here).
  const place = (day: string) => (day <= today ? hubToday : addDays(hubToday, Math.round((Date.parse(day) - Date.parse(today)) / 86_400_000)));

  if (g.writtenAt && dayOf(g.writtenAt) === hubToday && g.status !== "failed") {
    out.today.push({ ...base, key: `gw-${g.id}`, title: "Guide written", when: `Done ${perthTime(g.writtenAt)} · live ${dayWord(g.day, today)}`, state: "done", sort: g.writtenAt });
  }
  switch (g.status) {
    case "published":
      if (g.publishedAt && dayOf(g.publishedAt) === hubToday) out.today.push({ ...base, key: `gl-${g.id}`, title: "Guide live", when: `Done ${perthTime(g.publishedAt)}`, state: "done", sort: g.publishedAt });
      return;
    case "failed":
      if (g.day >= today) out.today.push({ ...base, key: `gf-${g.id}`, title: "A guide couldn’t be written", when: `For ${dayWord(g.day, today)}. It tries again by itself.`, why: "Open it to see what stopped it.", who: "you", state: "you", sort: g.day });
      return;
    case "writing":
      out.today.push({ ...base, key: `gx-${g.id}`, title: "Writing a guide", when: `Running now · live ${dayWord(g.day, today)}`, state: "now", sort: f.now });
      return;
    case "planned":
      if (writeDay <= today) add({ ...base, key: `gp-${g.id}`, title: "Writing a guide", when: `Today · live ${dayWord(g.day, today)}`, state: "today", sort: `${hubToday}T12:00` }, hubToday);
      else add({ ...base, key: `gp-${g.id}`, title: "Writing a guide", when: `${dayWord(writeDay, today)} · live ${dayLabel(g.day)}`, state: "planned", sort: writeDay }, place(writeDay));
      return;
    case "ready": {
      if (!g.approvedAt) {
        out.today.push({ ...base, key: `gok-${g.id}`, title: "A guide waits for your OK", when: `Live ${dayWord(g.day, today)}`, why: WHY.okGuide, who: "you", state: "you", sort: g.day });
        return;
      }
      if (g.day <= today && !f.connected) {
        out.today.push({
          ...base,
          key: `ga-${g.id}`,
          title: `Add the guide to their ${site}`,
          when: g.day < today ? `Was due ${dayLabel(g.day)}` : "Today",
          why: `Their ${site} isn’t connected, so you copy and paste it in. Then press “I’ve added it”.`,
          who: "you",
          state: "you",
          sort: g.day,
        });
        return;
      }
      add({ ...base, key: `gr-${g.id}`, title: "Guide goes live", when: g.day <= today ? "Today, from 8am their time" : dayWord(g.day, today), state: g.day <= today ? "today" : "planned", sort: g.day }, place(g.day));
      return;
    }
  }
}

const RANK: Record<FlowState, number> = { now: 0, you: 1, today: 2, planned: 3, done: 4 };

/** Today: what runs now, then what needs Ross, then what's still to come, then what's done. Later days: by date. */
function finish(out: PlanFlow): PlanFlow {
  out.today.sort((a, b) => RANK[a.state] - RANK[b.state] || a.sort.localeCompare(b.sort));
  out.next.sort((a, b) => a.sort.localeCompare(b.sort));
  out.later.sort((a, b) => a.sort.localeCompare(b.sort));
  return out;
}
