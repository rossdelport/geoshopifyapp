// The free Google Maps check at rankwithross.com.au/visibility (Ross, 25 Nov 2026). Someone types their first name, phone
// and business. As they type the business, the matching Google profiles show under the box and they tap theirs
// (`suggestBusinesses`). We save them (Ross calls everyone who uses it), pick the search word a customer would use
// (`pickKeyword`; they can type their own with "Try another search word"), search Google Maps from 49 spots around the
// business (the `heatmap.run` job, about 30 seconds and US$0.10), show the map on the page, and email Ross. The rules
// with no database in them are in lib/heatmap.ts.
//
// Limits, so it can't be abused or run up a bill: 8 tries a day per visitor, 80 look-ups an hour per visitor while
// typing (GEO_HEATMAP_LOOKUPS_PER_DAY for everyone, default 5,000, about US$5), 4 maps a day per phone number, and for
// everyone together GEO_HEATMAPS_PER_DAY maps (default 200) and GEO_HEATMAP_USD_PER_DAY dollars (default US$20) in
// 24 hours. Past those the person is still saved and Ross is told, so he can run their map himself (Admin > Map checks).

import { Prisma, type HeatmapCheck } from "@prisma/client";
import { z } from "zod";
import db from "../db.server";
import { aiConfigured, askJson } from "./ai.server";
import { env } from "./env.server";
import { MAX_ATTEMPTS, enqueue, registerJob } from "./jobs.server";
import { emailConfigured, sendEmail } from "./email.server";
import { tregCall } from "./treg.server";
import { hashIp } from "./public-form.server";
import { cleanPhone } from "./giveaway";
import { adName, type AdTags } from "./book-stats";
import { SITE } from "./tools/site";
import {
  FIND_ENDPOINT,
  GRID,
  HEATMAP_CONSENT,
  HEATMAP_ENDPOINTS,
  HEATMAP_ERRORS,
  INFO_ENDPOINT,
  MAPS_ENDPOINT,
  SPOTS,
  cleanBusiness,
  cleanFirstName,
  cleanKeyword,
  cleanPickedKeyword,
  coordinate,
  fallbackKeyword,
  gridPoints,
  parseInfo,
  parseMapItems,
  parsePlaces,
  publicCheck,
  rankOf,
  resultLine,
  roundCentre,
  summarise,
  sureMatch,
  topRivals,
  type Candidate,
  type MapItem,
  type PublicCheck,
  type Rank,
  type Rival,
  type Spot,
} from "./heatmap";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MAX_SUGGESTS_PER_IP = 80; // look-ups while typing, per visitor per hour (kept in memory)
const FIND_KEEP_MS = 10 * 60_000; // how long one look-up's answer is reused
const MAX_PER_IP = 8; // people saved per visitor per 24 h
const MAX_FINDS_PER_IP = 20; // business lookups per visitor per 24 h (kept in memory)
const MAX_PER_PHONE = 4; // maps per phone number per 24 h
const CONCURRENCY = 12; // Google Maps searches at once, per map
const SAVE_EVERY = 6; // spots between progress saves, so the dots fill in on the page
const MAX_FAILED_SPOTS = 12; // more spots than this unanswered and the map isn't worth showing
const NOTICE_AFTER_MS = 10 * 60_000; // Ross hears about someone who didn't finish after this long
const AUSTRALIA = 2036; // DataForSEO's code

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw?.trim() ? Number(raw) : fallback;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

type Field = "name" | "phone" | "business";
/** A business to choose from, as the page shows it (no map position). */
export type PublicCandidate = Pick<Candidate, "cid" | "name" | "address" | "rating" | "reviews" | "category">;
export type StartResult =
  | { ok: true; state: "running" | "capped"; id: string }
  | { ok: true; state: "pick"; id: string; candidates: PublicCandidate[] }
  | { ok: false; error: string; field?: Field };
type Out = { status: number; result: StartResult };

const bad = (error: string, status = 422, field?: Field): Out => ({ status, result: { ok: false, error, ...(field ? { field } : {}) } });

export interface StartInput {
  firstName: unknown;
  phone: unknown;
  business: unknown;
  /** The search word, only when they chose their own ("Try another search word"). Empty: we pick it. */
  keyword?: unknown;
  /** The Google profile they tapped in the list under the box, and the words that brought that list up. */
  cid?: unknown;
  asked?: unknown;
  honeypot?: string | null;
  ad: AdTags;
  ip: string | null;
}

// Business lookups per visitor in the last day, in memory (a deploy starts again; the saved-people limit is in the database).
const finds = new Map<string, number[]>();
function tooManyFinds(key: string, now: number): boolean {
  const times = (finds.get(key) ?? []).filter((t) => now - t < DAY);
  if (times.length >= MAX_FINDS_PER_IP) return true;
  finds.set(key, [...times, now]);
  if (finds.size > 5000) finds.clear(); // never grows without end
  return false;
}

// ---------- Finding the business on Google Maps ----------

const found = new Map<string, { at: number; list: Candidate[] }>();
const kept = (typed: string, now: number) => {
  const hit = found.get(typed.toLowerCase());
  return hit && now - hit.at < FIND_KEEP_MS ? hit.list : null;
};

/** Google Maps' businesses for the words typed. An answer is reused for 10 minutes, so typing and then pressing the button pays once. */
async function findBusinesses(typed: string, now: number): Promise<Candidate[]> {
  const have = kept(typed, now);
  if (have) return have;
  const list = parsePlaces(await tregCall(FIND_ENDPOINT, { body: { q: typed, gl: "au", hl: "en" }, timeoutMs: 15_000, shopId: null }));
  if (found.size > 2000) found.clear(); // never grows without end
  found.set(typed.toLowerCase(), { at: now, list });
  return list;
}

// Look-ups while typing: per visitor in the last hour, and for everyone in the last day (in memory; a deploy starts again).
const suggests = new Map<string, number[]>();
let suggestDay = { start: 0, n: 0 };
function tooManySuggests(key: string, now: number): boolean {
  if (now - suggestDay.start > DAY) suggestDay = { start: now, n: 0 };
  if (suggestDay.n >= envNumber("GEO_HEATMAP_LOOKUPS_PER_DAY", 5000)) return true;
  const times = (suggests.get(key) ?? []).filter((t) => now - t < HOUR);
  if (times.length >= MAX_SUGGESTS_PER_IP) return true;
  suggests.set(key, [...times, now]);
  if (suggests.size > 5000) suggests.clear();
  suggestDay.n++;
  return false;
}

/** Forget every look-up and count kept in memory (the tests start clean with this). */
export function forgetLookups() {
  found.clear();
  finds.clear();
  suggests.clear();
  suggestDay = { start: 0, n: 0 };
}

const toPublic = ({ cid, name, address, rating, reviews, category }: Candidate): PublicCandidate => ({ cid, name, address, rating, reviews, category });

/** The list under the business box: the Google profiles that match what they have typed so far. Empty when unsure or over a limit. */
export async function suggestBusinesses(typed: unknown, ip: string | null, now = Date.now()): Promise<PublicCandidate[]> {
  const q = typeof typed === "string" ? cleanBusiness(typed) : null;
  if (!q || q.length < 3) return [];
  if (!kept(q, now) && tooManySuggests(hashIp(ip), now)) return [];
  try {
    return (await findBusinesses(q, now)).map(toPublic);
  } catch (err) {
    console.warn("[heatmap] a look-up while typing failed:", (err as Error).message);
    return [];
  }
}

/** The form: save the person, find their business on Google Maps, and start the map (or ask which business is theirs). */
export async function startCheck(input: StartInput, now = new Date()): Promise<Out> {
  if (input.honeypot?.trim()) return bad(HEATMAP_ERRORS.generic);
  const firstName = cleanFirstName(input.firstName);
  if (!firstName) return bad(HEATMAP_ERRORS.name, 422, "name");
  const phone = cleanPhone(input.phone);
  if (!phone) return bad(HEATMAP_ERRORS.phone, 422, "phone");
  const query = cleanBusiness(input.business);
  if (!query) return bad(HEATMAP_ERRORS.business, 422, "business");
  const keyword = cleanKeyword(input.keyword) ?? ""; // empty: picked for them when the map starts
  const cid = typeof input.cid === "string" && /^[\w-]{1,40}$/.test(input.cid) ? input.cid : null;
  const asked = cid ? cleanBusiness(input.asked) : null;

  const since = new Date(now.getTime() - DAY);
  const ipHash = hashIp(input.ip);
  const [fromIp, open] = await Promise.all([
    db.heatmapCheck.count({ where: { ipHash, createdAt: { gte: since } } }),
    // Someone fixing a spelling, or who didn't pick their business the first time, keeps the one row.
    db.heatmapCheck.findFirst({ where: { phone, createdAt: { gte: since }, status: { in: ["finding", "nomatch", "pick"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  if ((!open && fromIp >= MAX_PER_IP) || tooManyFinds(ipHash, now.getTime())) return bad(HEATMAP_ERRORS.tooMany, 429);

  const data = {
    firstName,
    phone,
    query,
    keyword,
    status: "finding",
    candidates: Prisma.DbNull,
    error: null,
    emailedAt: null,
    consentText: HEATMAP_CONSENT,
    utmSource: input.ad.utmSource,
    utmMedium: input.ad.utmMedium,
    utmCampaign: input.ad.utmCampaign,
    utmContent: input.ad.utmContent,
    utmTerm: input.ad.utmTerm,
    fbclid: input.ad.fbclid,
    referrer: input.ad.referrer,
    ipHash,
  };
  const row = open ? await db.heatmapCheck.update({ where: { id: open.id }, data }) : await db.heatmapCheck.create({ data });
  // Ross hears about everyone: straight away when their map is done, or after 10 minutes if they never finished.
  await enqueue("heatmap.notice", { id: row.id }, { runAfter: new Date(now.getTime() + NOTICE_AFTER_MS), dedupeKey: `heatmap-notice:${row.id}` });

  let list: Candidate[];
  let chosen: Candidate | undefined;
  try {
    // The profile they tapped comes from the list their own typing brought up. We only ever trust our own look-up.
    list = await findBusinesses(asked ?? query, now.getTime());
    chosen = cid ? list.find((c) => c.cid === cid) : undefined;
    if (cid && !chosen && asked && asked !== query) {
      list = await findBusinesses(query, now.getTime());
      chosen = list.find((c) => c.cid === cid);
    }
  } catch (err) {
    console.error("[heatmap] could not look up a business:", (err as Error).message);
    await db.heatmapCheck.update({ where: { id: row.id }, data: { status: "nomatch", error: "The Google Maps lookup failed." } });
    return bad(HEATMAP_ERRORS.google, 502);
  }
  if (!list.length) {
    await db.heatmapCheck.update({ where: { id: row.id }, data: { status: "nomatch", error: "Google Maps found no business for what they typed." } });
    return bad(HEATMAP_ERRORS.notFound, 422, "business");
  }
  const sure = chosen ?? sureMatch(query, list);
  if (sure) return launch(row.id, sure, phone, now);
  await db.heatmapCheck.update({ where: { id: row.id }, data: { status: "pick", candidates: list as unknown as Prisma.InputJsonValue } });
  return {
    status: 200,
    result: { ok: true, state: "pick", id: row.id, candidates: list.map(toPublic) },
  };
}

/** "Which one is yours?": they picked one of the businesses Google found. */
export async function pickBusiness(id: unknown, cid: unknown, now = new Date()): Promise<Out> {
  const row = typeof id === "string" && /^[a-z0-9]{8,40}$/.test(id) ? await db.heatmapCheck.findUnique({ where: { id } }) : null;
  if (!row || row.status !== "pick" || now.getTime() - row.updatedAt.getTime() > 2 * 3_600_000) return bad(HEATMAP_ERRORS.gone, 404);
  const chosen = (Array.isArray(row.candidates) ? (row.candidates as unknown as Candidate[]) : []).find((c) => c.cid === cid);
  if (!chosen) return bad(HEATMAP_ERRORS.gone, 404);
  return launch(row.id, chosen, row.phone, now);
}

/** Queue the 49 searches for a business, unless a limit says no. */
async function launch(id: string, c: Candidate, phone: string, now: Date): Promise<Out> {
  const since = new Date(now.getTime() - DAY);
  const [mine, runs, spend] = await Promise.all([
    db.heatmapCheck.count({ where: { phone, startedAt: { gte: since } } }),
    db.heatmapCheck.count({ where: { startedAt: { gte: since } } }),
    db.apiCost.aggregate({ _sum: { usd: true }, where: { shopId: null, endpoint: { in: HEATMAP_ENDPOINTS }, createdAt: { gte: since } } }),
  ]);
  if (mine >= MAX_PER_PHONE) return bad(HEATMAP_ERRORS.tooMany, 429);
  const business = {
    cid: c.cid,
    placeId: null,
    business: c.name,
    address: c.address,
    category: c.category,
    rating: c.rating,
    reviews: c.reviews === null ? null : Math.round(c.reviews),
    lat: c.lat,
    lng: c.lng,
    candidates: Prisma.DbNull,
    error: null,
  };
  if (runs >= envNumber("GEO_HEATMAPS_PER_DAY", 200) || (spend._sum.usd ?? 0) >= envNumber("GEO_HEATMAP_USD_PER_DAY", 20)) {
    console.warn(`[heatmap] today's limit is reached (${runs} maps, US$${(spend._sum.usd ?? 0).toFixed(2)}): ${id} waits for Ross`);
    await db.heatmapCheck.update({ where: { id }, data: { ...business, status: "capped", error: "Today's limit for free map checks was reached." } });
    void sendNotice(id).catch((err) => console.error("[heatmap] could not email Ross:", (err as Error).message));
    return { status: 200, result: { ok: true, state: "capped", id } };
  }
  await queueRun(id, business, now);
  return { status: 200, result: { ok: true, state: "running", id } };
}

async function queueRun(id: string, business: Prisma.HeatmapCheckUpdateInput, now: Date) {
  await db.heatmapCheck.update({
    where: { id },
    data: { ...business, status: "queued", startedAt: now, finishedAt: null, points: Prisma.DbNull, done: 0, top3: null, found: null, avgRank: null, rivals: Prisma.DbNull },
  });
  await enqueue("heatmap.run", { id }, { dedupeKey: `heatmap:${id}` });
}

/** Admin > Map checks, "Run it": for a map that failed or hit the day's limit. No limits apply (Ross pressed it). */
export async function rerunCheck(id: string, now = new Date()): Promise<boolean> {
  const row = await db.heatmapCheck.findUnique({ where: { id }, select: { cid: true, status: true } });
  if (!row?.cid || row.status === "queued" || row.status === "running") return false;
  await queueRun(id, { error: null, emailedAt: null }, now);
  return true;
}

/** What the page may show for a check: the business's public details and its ranks. */
export async function getPublicCheck(id: string | null): Promise<PublicCheck | null> {
  if (!id || !/^[a-z0-9]{8,40}$/.test(id)) return null;
  const row = await db.heatmapCheck.findUnique({ where: { id } });
  return row ? publicCheck(row) : null;
}

// ---------- The 49 searches ----------

/** One Google Maps search from one spot. Tried twice; null when Google didn't answer. */
async function searchSpot(keyword: string, spot: Spot): Promise<MapItem[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await tregCall(MAPS_ENDPOINT, {
        body: [{ keyword, location_coordinate: coordinate(spot), language_code: "en", depth: GRID.depth }],
        timeoutMs: 40_000,
        shopId: null,
      });
      return parseMapItems(raw);
    } catch (err) {
      if (attempt) console.warn("[heatmap] a spot got no answer:", (err as Error).message);
    }
  }
  return null;
}

async function fail(id: string, why: string) {
  await db.heatmapCheck.update({ where: { id }, data: { status: "failed", error: why, finishedAt: new Date() } });
  await sendNotice(id).catch((err) => console.error("[heatmap] could not email Ross:", (err as Error).message));
}

/**
 * The Google Maps search a customer would type to find this business, for when the person didn't type one. Claude
 * reads the business name and Google's category (the name often says the trade better: Perth Solar Panel Cleaners is
 * filed under "House cleaning service"). With no AI, or an answer that won't do: the category, else the name.
 */
async function pickKeyword(row: Pick<HeatmapCheck, "business" | "query" | "category" | "address">): Promise<string> {
  const name = row.business ?? row.query;
  if (aiConfigured()) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const out = await Promise.race([
        askJson({
          tier: "fast",
          label: "heatmap.keyword",
          shopId: null,
          maxTokens: 1000,
          style: false,
          system:
            "You pick the words a customer types into Google Maps to find a business like this one. Give the service or trade only: 1 to 4 everyday words, lower case, Australian spelling. Never a business name, a place name, \"near me\" or \"best\". " +
            "Examples: Perth Solar Panel Cleaners (House cleaning service): solar panel cleaning. Smith & Sons (Plumber): plumber. Bright Smiles Joondalup (Dental clinic): dentist. Loan Market Subiaco (Mortgage broker): mortgage broker.",
          prompt: `Business name: ${name}\nGoogle's category for it: ${row.category ?? "none"}\n\nThe name often says the real trade better than Google's category does.`,
          schema: z.object({ search: z.string() }),
        }),
        // The person is watching the page: past 20 seconds the map starts with Google's category instead.
        new Promise<never>((_, no) => {
          timer = setTimeout(() => no(new Error("took too long")), 20_000);
        }),
      ]);
      const picked = cleanPickedKeyword(out.search, name);
      if (picked) return picked;
    } catch (err) {
      console.warn("[heatmap] the AI could not pick a search word:", (err as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }
  return fallbackKeyword(name, row.category, row.address);
}

export async function runCheck(id: string): Promise<void> {
  const row = await db.heatmapCheck.findUnique({ where: { id } });
  if (!row?.cid || (row.status !== "queued" && row.status !== "running")) return;
  let { lat, lng, placeId } = row;
  const hidden = lat === null || lng === null;
  const [keyword, info] = await Promise.all([
    row.keyword || pickKeyword(row),
    // A business that hides its address: Google's profile still says roughly where it is.
    hidden
      ? tregCall(INFO_ENDPOINT, { body: [{ keyword: `cid:${row.cid}`, location_code: AUSTRALIA, language_code: "en" }], timeoutMs: 60_000, shopId: null })
          .then(parseInfo)
          .catch(() => null)
      : null,
  ]);
  if (keyword !== row.keyword) await db.heatmapCheck.update({ where: { id }, data: { keyword } });
  if (hidden) {
    if (!info) return fail(id, "Google didn't say where this business is (it hides its address).");
    ({ lat, lng } = roundCentre(info.lat, info.lng));
    placeId = info.placeId;
  }
  if (lat === null || lng === null) return;
  await db.heatmapCheck.update({ where: { id }, data: { status: "running", lat, lng, placeId, done: 0, points: Prisma.DbNull } });

  const spots = gridPoints(lat, lng);
  const ranks: Rank[] = spots.map(() => null);
  const lists: (MapItem[] | null)[] = spots.map(() => null);
  let done = 0;
  let saved = 0;
  let next = 0;
  // Progress saves go one after another, so an older save never lands on top of a newer one.
  let saving: Promise<unknown> = Promise.resolve();
  const worker = async () => {
    while (next < spots.length) {
      const i = next++;
      const items = await searchSpot(keyword, spots[i]);
      lists[i] = items;
      ranks[i] = items ? rankOf(items, row.cid, placeId) : -1;
      done++;
      if (done - saved >= SAVE_EVERY) {
        saved = done;
        const snapshot = [...ranks];
        const n = done;
        saving = saving
          .then(() => db.heatmapCheck.update({ where: { id }, data: { points: snapshot as Prisma.InputJsonValue, done: n } }))
          .catch((err) => console.error("[heatmap] could not save progress:", (err as Error).message));
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await saving;

  const s = summarise(ranks);
  if (s.failed > MAX_FAILED_SPOTS) {
    await db.heatmapCheck.update({ where: { id }, data: { points: ranks as Prisma.InputJsonValue, done } });
    return fail(id, `Google Maps didn't answer in ${s.failed} of ${SPOTS} spots.`);
  }
  await db.heatmapCheck.update({
    where: { id },
    data: {
      status: "done",
      points: ranks as Prisma.InputJsonValue,
      done,
      top3: s.top3,
      found: s.top3 + s.mid + s.low,
      avgRank: s.avg,
      rivals: topRivals(lists, row.cid, placeId) as unknown as Prisma.InputJsonValue,
      error: null,
      finishedAt: new Date(),
    },
  });
  await sendNotice(id).catch((err) => console.error("[heatmap] could not email Ross:", (err as Error).message));
}

registerJob("heatmap.run", async (job) => {
  const id = String((job.payload as { id?: unknown } | null)?.id ?? "");
  try {
    await runCheck(id);
  } catch (err) {
    // The last try: say so on the page and to Ross, instead of leaving the map "running" for ever.
    if (job.attempts >= MAX_ATTEMPTS) return fail(id, `The map could not be finished: ${(err as Error).message}`.slice(0, 300));
    throw err;
  }
});

// ---------- Ross's email ----------

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const perth = (d: Date) => d.toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Perth" });

/** The email Ross gets about one check. Exported for the tests. */
export function heatmapNoticeEmail(row: HeatmapCheck): { subject: string; html: string } {
  const who = row.business ?? `“${row.query}”`;
  const s = summarise(publicCheck(row).ranks);
  const subject =
    row.status === "done"
      ? `Map check: ${row.firstName} from ${who}, top 3 in ${s.top3} of ${s.checked} spots`
      : row.status === "failed"
        ? `Map check failed: ${row.firstName}, ${who}`
        : row.status === "capped"
          ? `Map check waiting for you: ${row.firstName}, ${who}`
          : row.status === "nomatch"
            ? `Map check: ${row.firstName} couldn't find “${row.query}” on Google Maps`
            : row.status === "queued" || row.status === "running"
              ? `Map check still running: ${row.firstName}, ${who}`
              : `Map check not finished: ${row.firstName}, “${row.query}”`;
  const note =
    row.status === "done"
      ? resultLine(s)
      : row.status === "failed"
        ? `The map failed. ${row.error ?? ""} You can run it again in Admin, Map checks.`
        : row.status === "capped"
          ? "Today's limit for free map checks was reached, so their map was not made. They were told you will send it. Press Run it in Admin, Map checks."
          : row.status === "nomatch"
            ? "Google Maps found no business for what they typed. They may not have a Google profile yet."
            : row.status === "queued" || row.status === "running"
              ? "Their map is still being made. Look in Admin, Map checks."
              : "They typed their details but did not pick their business from the list.";
  const rivals = Array.isArray(row.rivals) ? (row.rivals as unknown as Rival[]) : [];
  const stars = row.rating !== null ? `, ${row.rating} stars from ${row.reviews ?? 0} reviews` : "";
  const lines = [
    `<p><b>Call:</b> ${esc(row.firstName)}, <a href="tel:${esc(row.phone.replace(/[^\d+]/g, ""))}">${esc(row.phone)}</a></p>`,
    row.business ? `<p><b>Business:</b> ${esc(row.business)}${row.address ? `, ${esc(row.address)}` : " (no street address on Google)"}${esc(stars)}${row.category ? `, ${esc(row.category)}` : ""}</p>` : "",
    `<p><b>They typed:</b> ${esc(row.query)}</p>`,
    row.keyword ? `<p><b>Search word:</b> ${esc(row.keyword)}</p>` : "",
    `<p><b>Result:</b> ${esc(note)}</p>`,
    rivals.length ? `<p><b>In the top 3 most:</b> ${rivals.map((r) => `${esc(r.name)} (${r.spots} ${r.spots === 1 ? "spot" : "spots"})`).join(", ")}</p>` : "",
    row.business && row.status !== "capped" ? `<p><a href="${SITE}/visibility?r=${row.id}">Open their map</a></p>` : "",
    `<p><b>Came from:</b> ${esc(adName(row))}</p>`,
    `<p style="color:#666">${esc(perth(row.createdAt))}, Perth time. Everyone who used the check is in <a href="${SITE}/dash/admin/maps">Admin, Map checks</a>.</p>`,
  ];
  return { subject, html: lines.filter(Boolean).join("\n") };
}

/** Email Ross about a check. Throws when the email could not be sent. */
export async function sendNotice(id: string): Promise<void> {
  const row = await db.heatmapCheck.findUnique({ where: { id } });
  if (!row) return;
  if (!env.alertEmail || !emailConfigured()) {
    console.warn(`[heatmap] no email sent about ${id}: GEO_ALERT_EMAIL or the email sender isn't set`);
    return;
  }
  const { subject, html } = heatmapNoticeEmail(row);
  await sendEmail([env.alertEmail], subject, html, undefined, `heatmap:${row.id}:${row.status}:${row.startedAt?.getTime() ?? 0}`);
  await db.heatmapCheck.update({ where: { id }, data: { emailedAt: new Date() } });
}

// Ten minutes after someone started: if Ross hasn't heard about them yet (no business found, none picked, or a map
// that never finished), he hears now.
registerJob("heatmap.notice", async (job) => {
  const id = String((job.payload as { id?: unknown } | null)?.id ?? "");
  const row = await db.heatmapCheck.findUnique({ where: { id }, select: { emailedAt: true } });
  if (!row || row.emailedAt) return;
  await sendNotice(id);
});
