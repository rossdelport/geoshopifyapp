// The free Google Maps check at rankwithross.com.au/visibility (Ross, 25 Nov 2026: "people type in their first name,
// phone number and business, google grabs their business profile, runs a heat map and gives it to them there on the
// screen. i will then call anyone that uses it"). These are the rules with no database or network in them: the form
// checks, the 49 spots, reading Google's answers, the counts, and where everything sits on the map picture.
// The server side is lib/heatmap.server.ts, the page app/home/visibility.html.

export const GRID = {
  /** 7 across and 7 down: 49 spots. */
  size: 7,
  /** The spots are 2 km apart, so the map covers 12 km by 12 km around the business. */
  stepKm: 2,
  /** How wide each Google Maps search looks. 13 is what paid rank trackers use unless told otherwise. */
  zoom: 13,
  /** We read the first 20 results at each spot. */
  depth: 20,
  /** How much map shows past the outer spots. */
  marginKm: 1.6,
};
export const SPOTS = GRID.size * GRID.size;

/** The Treg endpoints the check pays for. Their spend has its own daily cap (GEO_HEATMAP_USD_PER_DAY). */
export const FIND_ENDPOINT = "serper.google.serp.places";
export const MAPS_ENDPOINT = "dataforseo.x.serp-google-maps-live-advanced";
export const INFO_ENDPOINT = "dataforseo.x.business-data-google-my-business-info-live";
export const HEATMAP_ENDPOINTS = [FIND_ENDPOINT, MAPS_ENDPOINT, INFO_ENDPOINT];

/** The exact words shown under the form, saved with every check. */
export const HEATMAP_CONSENT = "Ross will call or text you about your result. By pressing the button you agree to that.";

export const HEATMAP_ERRORS = {
  generic: "Something went wrong. Please try again, or text Ross on 0400 369 865.",
  crossSite: "Please run the check from rankwithross.com.au/visibility.",
  name: "Please type your first name.",
  phone: "Please type a phone number we can call, like 0400 123 456.",
  business: "Please type your business name and suburb.",
  keyword: "Please type what customers search for, like emergency plumber.",
  notFound: "We couldn’t find that business on Google Maps. Check the spelling and add your suburb. Not on Google Maps yet? Text Ross on 0400 369 865.",
  google: "Google Maps didn’t answer. Please try again in a minute.",
  tooMany: "That’s a lot of checks for one day. Please come back tomorrow, or text Ross on 0400 369 865.",
  gone: "We couldn’t find that check. Please start again.",
};

// ---------- The form ----------

/** Plain text from a form field: no control characters or angle brackets, single spaces, at most `max` long. */
function tidy(raw: unknown, max: number): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function cleanFirstName(raw: unknown): string | null {
  const s = tidy(raw, 40);
  return /\p{L}/u.test(s) ? s : null;
}

export function cleanBusiness(raw: unknown): string | null {
  const s = tidy(raw, 120);
  return s.length >= 2 && /[\p{L}\p{N}]/u.test(s) ? s : null;
}

/** What customers search for, e.g. "emergency plumber": lower case, no quotes. */
export function cleanKeyword(raw: unknown): string | null {
  const s = tidy(raw, 60).replace(/["“”]/g, "").trim().toLowerCase();
  return s.length >= 2 && /\p{L}/u.test(s) ? s : null;
}

// ---------- Finding the business ----------

/** One business Google Maps found for the name typed. */
export interface Candidate {
  cid: string;
  name: string;
  /** Null when the business hides its address on Google (it visits its customers). */
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviews: number | null;
  category: string | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
// A star rating to one decimal place (4.8, never 4.800000000000001).
const stars = (v: unknown): number | null => {
  const n = num(v);
  return n == null ? null : Math.round(n * 10) / 10;
};
const text = (v: unknown, max = 200): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Serper's Google places answer, as up to 5 businesses. */
export function parsePlaces(raw: unknown): Candidate[] {
  const places = (raw as { places?: unknown })?.places;
  if (!Array.isArray(places)) return [];
  const out: Candidate[] = [];
  for (const p of places as Record<string, unknown>[]) {
    const cid = text(p?.cid, 40);
    const name = text(p?.title, 160);
    if (!cid || !name || out.some((c) => c.cid === cid)) continue;
    const lat = num(p.latitude);
    const lng = num(p.longitude);
    out.push({
      cid,
      name,
      address: text(p.address),
      lat: lat !== null && lng !== null ? lat : null,
      lng: lat !== null && lng !== null ? lng : null,
      rating: stars(p.rating),
      reviews: num(p.ratingCount),
      category: text(p.category, 80),
    });
    if (out.length === 5) break;
  }
  return out;
}

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * The business we can be sure they meant: the only one whose whole name, word for word and in order, is in what they
 * typed ("Smith Plumbing Joondalup" names "Smith Plumbing"). Two with that name, or none, and the page asks "Which
 * one is yours?".
 */
export function sureMatch(typed: string, list: Candidate[]): Candidate | null {
  const have = ` ${words(typed).join(" ")} `;
  const hits = list.filter((c) => {
    const w = words(c.name);
    return w.length > 0 && have.includes(` ${w.join(" ")} `);
  });
  return hits.length === 1 ? hits[0] : null;
}

/** The business's own spot from Google's profile answer (DataForSEO), for a business that hides its address. */
export function parseInfo(raw: unknown): { lat: number; lng: number; placeId: string | null } | null {
  const task = (raw as { tasks?: { status_code?: number; result?: { items?: Record<string, unknown>[] | null }[] | null }[] })?.tasks?.[0];
  const item = task?.result?.[0]?.items?.[0];
  const lat = num(item?.latitude);
  const lng = num(item?.longitude);
  if (lat === null || lng === null) return null;
  return { lat, lng, placeId: text(item?.place_id, 80) };
}

/**
 * Where the map is centred. A business that hides its address gets the nearest point on a grid about 1 km wide, so
 * the map never shows where a home-based business really is.
 */
export function roundCentre(lat: number, lng: number): { lat: number; lng: number } {
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}

// ---------- The 49 spots ----------

export interface Spot {
  lat: number;
  lng: number;
}

const KM_PER_DEG_LAT = 110.574;
const kmPerDegLng = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

/** The spots, row by row from the north-west corner. The business is the middle one. */
export function gridPoints(lat: number, lng: number, size = GRID.size, stepKm = GRID.stepKm): Spot[] {
  const half = (size - 1) / 2;
  const out: Spot[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      out.push({
        lat: lat + ((half - row) * stepKm) / KM_PER_DEG_LAT,
        lng: lng + ((col - half) * stepKm) / kmPerDegLng(lat),
      });
    }
  }
  return out;
}

/** A spot the way DataForSEO's Google Maps search takes it: "lat,lng,13z". */
export const coordinate = (p: Spot, zoom = GRID.zoom) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)},${zoom}z`;

// ---------- Reading Google's answer at one spot ----------

export interface MapItem {
  cid: string | null;
  placeId: string | null;
  name: string;
  rating: number | null;
  reviews: number | null;
}

/** The businesses Google Maps listed at one spot, in order. Throws when the search itself failed. */
export function parseMapItems(raw: unknown): MapItem[] {
  const task = (raw as { tasks?: { status_code?: number; status_message?: string; result?: { items?: Record<string, unknown>[] | null }[] | null }[] })?.tasks?.[0];
  if (!task || task.status_code !== 20000) throw new Error(`Google Maps search failed: ${task?.status_message ?? "no answer"}`);
  const items = task.result?.[0]?.items ?? [];
  const out: MapItem[] = [];
  for (const it of items) {
    const name = text(it?.title, 160);
    if (!name || it.type !== "maps_search") continue;
    const rating = it.rating as { value?: unknown; votes_count?: unknown } | null;
    out.push({ cid: text(it.cid, 40), placeId: text(it.place_id, 80), name, rating: stars(rating?.value), reviews: num(rating?.votes_count) });
  }
  return out.slice(0, GRID.depth);
}

/** Where the business came up in the list: 1 to 20, or 0 when it wasn't in the first 20. */
export function rankOf(items: MapItem[], cid: string | null, placeId: string | null): number {
  const i = items.findIndex((it) => (cid && it.cid === cid) || (placeId && it.placeId === placeId));
  return i + 1;
}

// ---------- The counts ----------

/** One spot's result: 1 to 20, 0 = not in the first 20, -1 = we couldn't check it, null = not checked yet. */
export type Rank = number | null;

export interface Summary {
  spots: number;
  checked: number;
  top3: number;
  /** 4 to 10 */
  mid: number;
  /** 11 to 20 */
  low: number;
  /** Not in the first 20. */
  out: number;
  /** Spots we couldn't check. */
  failed: number;
  /** The average place in the spots where the business showed up, or null when it showed up nowhere. */
  avg: number | null;
}

export function summarise(ranks: Rank[]): Summary {
  const found = ranks.filter((r): r is number => typeof r === "number" && r >= 1);
  return {
    spots: ranks.length,
    checked: ranks.filter((r) => typeof r === "number" && r >= 0).length,
    top3: found.filter((r) => r <= 3).length,
    mid: found.filter((r) => r >= 4 && r <= 10).length,
    low: found.filter((r) => r >= 11).length,
    out: ranks.filter((r) => r === 0).length,
    failed: ranks.filter((r) => r === -1).length,
    avg: found.length ? Math.round((found.reduce((a, b) => a + b, 0) / found.length) * 10) / 10 : null,
  };
}

/** The one line at the top of the result. Only says what the counts say. */
export function headline(s: Summary): string {
  if (!s.checked) return "We couldn’t check your spots.";
  if (s.top3 === s.checked) return `You’re in the top 3 in all ${s.checked} spots.`;
  if (s.top3 > 0) return `You’re in the top 3 in ${s.top3} of ${s.checked} spots.`;
  if (s.mid + s.low > 0) return "You’re not in the top 3 in any spot yet.";
  return "You didn’t show up in the top 20 in any spot.";
}

export interface Rival {
  name: string;
  rating: number | null;
  reviews: number | null;
  /** In how many spots Google had them in the top 3. */
  spots: number;
}

/** The other businesses Google put in the top 3 most often, most spots first. */
export function topRivals(lists: (MapItem[] | null)[], cid: string | null, placeId: string | null, max = 5): Rival[] {
  const tally = new Map<string, Rival>();
  for (const list of lists) {
    if (!list) continue;
    for (const it of list.slice(0, 3)) {
      if ((cid && it.cid === cid) || (placeId && it.placeId === placeId)) continue;
      const key = it.cid || it.placeId || it.name;
      const seen = tally.get(key);
      if (seen) seen.spots++;
      else tally.set(key, { name: it.name, rating: it.rating, reviews: it.reviews, spots: 1 });
    }
  }
  return [...tally.values()].sort((a, b) => b.spots - a.spots || (b.reviews ?? 0) - (a.reviews ?? 0) || a.name.localeCompare(b.name)).slice(0, max);
}

// ---------- The map picture ----------

const TILE = 256;
/** The map picture is at most this wide before the page scales it to fit. */
const MAX_MAP_PX = 640;

/** A place on the whole-world picture at a zoom level (the "Web Mercator" the map tiles use). */
function worldPx(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const world = TILE * 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * world,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * world,
  };
}

export interface MapView {
  zoom: number;
  /** The picture's size in map pixels. The page scales it to fit the screen. */
  width: number;
  height: number;
  /** The OpenStreetMap tiles that cover it, and where each one sits (pixels from the top left). */
  tiles: { x: number; y: number; left: number; top: number }[];
  /** Where each of the 49 spots sits, as a share of the picture (0 to 100). */
  pins: { left: number; top: number }[];
}

/** The map picture for a check centred on a place: which tiles, and where the 49 dots go. */
export function mapView(lat: number, lng: number): MapView {
  const halfKm = ((GRID.size - 1) / 2) * GRID.stepKm + GRID.marginKm;
  const north = lat + halfKm / KM_PER_DEG_LAT;
  const south = lat - halfKm / KM_PER_DEG_LAT;
  const west = lng - halfKm / kmPerDegLng(lat);
  const east = lng + halfKm / kmPerDegLng(lat);
  // The closest zoom whose picture is no wider than MAX_MAP_PX.
  let zoom = 15;
  while (zoom > 3 && worldPx(south, east, zoom).x - worldPx(north, west, zoom).x > MAX_MAP_PX) zoom--;
  const a = worldPx(north, west, zoom);
  const b = worldPx(south, east, zoom);
  const width = b.x - a.x;
  const height = b.y - a.y;
  const tiles: MapView["tiles"] = [];
  for (let ty = Math.floor(a.y / TILE); ty <= Math.floor((b.y - 0.001) / TILE); ty++) {
    for (let tx = Math.floor(a.x / TILE); tx <= Math.floor((b.x - 0.001) / TILE); tx++) {
      tiles.push({ x: tx, y: ty, left: Math.round((tx * TILE - a.x) * 10) / 10, top: Math.round((ty * TILE - a.y) * 10) / 10 });
    }
  }
  const pins = gridPoints(lat, lng).map((p) => {
    const w = worldPx(p.lat, p.lng, zoom);
    return { left: Math.round(((w.x - a.x) / width) * 1000) / 10, top: Math.round(((w.y - a.y) / height) * 1000) / 10 };
  });
  return { zoom, width: Math.round(width * 10) / 10, height: Math.round(height * 10) / 10, tiles, pins };
}

// ---------- What the page gets ----------

/** A saved check, as far as the page needs it. */
export interface CheckRow {
  id: string;
  status: string;
  keyword: string;
  business: string | null;
  address: string | null;
  category: string | null;
  rating: number | null;
  reviews: number | null;
  lat: number | null;
  lng: number | null;
  points: unknown;
  rivals: unknown;
  finishedAt: Date | null;
}

export interface PublicCheck {
  id: string;
  /** queued | running | done | failed | capped (anything else is "not started" to the page) */
  status: string;
  keyword: string;
  business: { name: string; address: string | null; category: string | null; rating: number | null; reviews: number | null } | null;
  spots: number;
  stepKm: number;
  ranks: Rank[];
  map: MapView | null;
  summary: Summary;
  headline: string;
  rivals: Rival[];
  checkedAt: string | null;
}

/** What anyone with a check's link may see: the business's public Google details and its ranks. Never the name or phone typed. */
export function publicCheck(row: CheckRow): PublicCheck {
  const saved = Array.isArray(row.points) ? (row.points as unknown[]) : [];
  const ranks: Rank[] = Array.from({ length: SPOTS }, (_, i) => (typeof saved[i] === "number" ? (saved[i] as number) : null));
  const summary = summarise(ranks);
  return {
    id: row.id,
    status: row.status,
    keyword: row.keyword,
    business: row.business ? { name: row.business, address: row.address, category: row.category, rating: row.rating, reviews: row.reviews } : null,
    spots: SPOTS,
    stepKm: GRID.stepKm,
    ranks,
    map: row.lat !== null && row.lng !== null ? mapView(row.lat, row.lng) : null,
    summary,
    headline: headline(summary),
    rivals: Array.isArray(row.rivals) ? (row.rivals as Rival[]) : [],
    checkedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

/** The line Ross reads in his email and the admin list, e.g. "Top 3 in 12 of 49 spots. Not in the top 20 in 9." */
export function resultLine(s: Summary): string {
  if (!s.checked) return "No spots checked.";
  const parts = [`Top 3 in ${s.top3} of ${s.checked} spots`, `4 to 10 in ${s.mid}`, `11 to 20 in ${s.low}`, `not in the top 20 in ${s.out}`];
  return `${parts.join(", ")}.${s.avg !== null ? ` Average place where found: ${s.avg}.` : ""}`;
}
