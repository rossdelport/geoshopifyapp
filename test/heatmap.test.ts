// The free Google Maps check at rankwithross.com.au/visibility (Ross, 25 Nov 2026): the rules in app/lib/heatmap.ts (the form
// checks, finding the business, the 49 spots, reading Google's answers, the counts, the map picture) and the page
// itself. No database and no network. The saving, the limits, the 49 searches and Ross's email are in
// test/heatmap-server.test.ts.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

vi.mock("../app/db.server", () => ({ default: {} }));
vi.mock("../app/lib/heatmap.server", () => ({
  getPublicCheck: vi.fn(async (id: string | null) => (id === "abc12345" ? { id, status: "done", keyword: "plumber </script>" } : null)),
  startCheck: vi.fn(async () => ({ status: 200, result: { ok: true, state: "running", id: "abc12345" } })),
  pickBusiness: vi.fn(async () => ({ status: 200, result: { ok: true, state: "running", id: "abc12345" } })),
}));

import {
  GRID,
  HEATMAP_CONSENT,
  SPOTS,
  cleanBusiness,
  cleanFirstName,
  cleanKeyword,
  coordinate,
  gridPoints,
  headline,
  mapView,
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
  type MapItem,
  type Rank,
} from "../app/lib/heatmap";
import { pickBusiness, startCheck } from "../app/lib/heatmap.server";
import { action, loader } from "../app/routes/visibility";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// What Google's places search gave for "Perth Solar Panel Cleaners" on 25 Nov 2026 (through Serper), cut down.
const PLACES = {
  places: [
    { position: 1, title: "Perth Solar Panel Cleaners", address: "Apt 802/237 Adelaide Terrace, East Perth WA 6000", latitude: -31.958584, longitude: 115.86664, rating: 5, ratingCount: 37, category: "House cleaning service", cid: "12447810736797022616" },
    { position: 2, title: "A1 Solar Cleaning", rating: 5, ratingCount: 143, category: "Window cleaning service", cid: "4350202105133677930" },
    { position: 3, title: "Eco Solar Panel Cleaning", rating: 5, ratingCount: 34, category: "Solar energy system service", cid: "4330453862748490945" },
    { position: 4, title: "Eco Shine Solar Cleaning and Maintenance", address: "40a Glendale Ave, Hamersley WA 6022", latitude: -31.848274, longitude: 115.809105, rating: 4.9, ratingCount: 293, category: "Solar panel maintenance service", cid: "3771519751915216229" },
    { position: 5, title: "Perth Solar Panel Cleaning", address: "123 Adelaide Terrace, Perth WA 6000", latitude: -31.960388, longitude: 115.87303, rating: 4.5, ratingCount: 4, category: "Cleaning service", cid: "16414285711968569470" },
    { position: 6, title: "A sixth one", cid: "6" },
  ],
};

const item = (n: number, extra: Partial<Record<string, unknown>> = {}) => ({
  type: "maps_search",
  rank_group: n,
  title: `Business ${n}`,
  cid: `c${n}`,
  place_id: `p${n}`,
  rating: { value: 4.5, votes_count: n * 10 },
  ...extra,
});
const maps = (items: unknown[] | null, status = 20000) => ({ tasks: [{ status_code: status, status_message: status === 20000 ? "Ok." : "Error", result: [{ items }] }] });

/** Kilometres between two places. */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

describe("the form", () => {
  it("tidies a first name, a business and a search word, and refuses empty ones", () => {
    expect(cleanFirstName("  Sam  ")).toBe("Sam");
    expect(cleanFirstName("<b>Sam</b>")).toBe("b Sam /b");
    expect(cleanFirstName("12345")).toBeNull();
    expect(cleanFirstName("")).toBeNull();
    expect(cleanBusiness(" Smith   Plumbing\nJoondalup ")).toBe("Smith Plumbing Joondalup");
    expect(cleanBusiness("x")).toBeNull();
    expect(cleanBusiness("...")).toBeNull();
    expect(cleanKeyword(' "Emergency Plumber" ')).toBe("emergency plumber");
    expect(cleanKeyword("a".repeat(100))).toHaveLength(60);
    expect(cleanKeyword("  ")).toBeNull();
    expect(cleanKeyword("24/7")).toBeNull();
  });
});

describe("finding the business", () => {
  it("reads Google's places as up to 5 businesses, with no map position for one that hides its address", () => {
    const list = parsePlaces(PLACES);
    expect(list).toHaveLength(5);
    expect(list[0]).toEqual({
      cid: "12447810736797022616",
      name: "Perth Solar Panel Cleaners",
      address: "Apt 802/237 Adelaide Terrace, East Perth WA 6000",
      lat: -31.958584,
      lng: 115.86664,
      rating: 5,
      reviews: 37,
      category: "House cleaning service",
    });
    expect(list[1]).toMatchObject({ name: "A1 Solar Cleaning", address: null, lat: null, lng: null });
    expect(parsePlaces({})).toEqual([]);
    expect(parsePlaces(null)).toEqual([]);
    expect(parsePlaces({ places: [{ title: "No id" }, { cid: "1" }] })).toEqual([]);
  });

  it("is only sure when one business's whole name is in what they typed", () => {
    const list = parsePlaces(PLACES);
    // not "Perth Solar Panel Cleaning", a different business two doors down
    expect(sureMatch("Perth Solar Panel Cleaners", list)?.cid).toBe("12447810736797022616");
    expect(sureMatch("perth solar panel cleaners east perth", list)?.cid).toBe("12447810736797022616");
    expect(sureMatch("A1 Solar Cleaning Perth", list)?.name).toBe("A1 Solar Cleaning");
    expect(sureMatch("solar cleaning perth", list)).toBeNull();
    // the same words in another order aren't a name: they pick
    expect(sureMatch("solar panel cleaning perth", list)).toBeNull();
    // two with the same name: they pick
    expect(sureMatch("Smith Plumbing", [{ ...list[0], name: "Smith Plumbing", cid: "1" }, { ...list[0], name: "Smith Plumbing", cid: "2" }])).toBeNull();
    // "&" and "and", and apostrophes, don't matter
    expect(sureMatch("Bobs Pies and Cakes Midland", [{ ...list[0], name: "Bob's Pies & Cakes", cid: "9" }])?.cid).toBe("9");
    // one business that isn't the name typed is never picked for them
    expect(sureMatch("Bobs Bakery Perth", [{ ...list[0], name: "Bobby's Bake House", cid: "9" }])).toBeNull();
  });

  it("reads where a hidden-address business is, and only ever uses it rounded to about 1 km", () => {
    const info = parseInfo({ tasks: [{ status_code: 20000, result: [{ items: [{ latitude: -31.7702884, longitude: 115.9879268, place_id: "ChIJ4TwK" }] }] }] });
    expect(info).toEqual({ lat: -31.7702884, lng: 115.9879268, placeId: "ChIJ4TwK" });
    expect(parseInfo({ tasks: [{ result: [{ items: null }] }] })).toBeNull();
    expect(parseInfo(null)).toBeNull();
    const c = roundCentre(info!.lat, info!.lng);
    expect(c).toEqual({ lat: -31.77, lng: 115.99 });
    expect(km(c, info!)).toBeLessThan(1);
  });
});

describe("the 49 spots", () => {
  const spots = gridPoints(-31.958584, 115.86664);

  it("puts the business in the middle of 7 rows of 7, 2 km apart, starting in the north-west", () => {
    expect(SPOTS).toBe(49);
    expect(spots).toHaveLength(49);
    expect(spots[24].lat).toBeCloseTo(-31.958584, 9);
    expect(spots[24].lng).toBeCloseTo(115.86664, 9);
    expect(spots[0].lat).toBeGreaterThan(spots[48].lat); // further north is a bigger (less negative) latitude
    expect(spots[0].lng).toBeLessThan(spots[48].lng);
    expect(km(spots[0], spots[1])).toBeCloseTo(2, 1);
    expect(km(spots[0], spots[7])).toBeCloseTo(2, 1);
    expect(km(spots[0], spots[6])).toBeCloseTo(12, 0);
    expect(km(spots[0], spots[42])).toBeCloseTo(12, 0);
  });

  it("writes a spot the way the Google Maps search takes it", () => {
    expect(coordinate({ lat: -31.9523, lng: 115.8613 })).toBe("-31.952300,115.861300,13z");
    expect(GRID.zoom).toBe(13);
  });
});

describe("reading Google's answer at one spot", () => {
  const raw = maps([item(1), item(2), { type: "maps_paid_item", title: "An ad", cid: "ad" }, item(3, { rating: null }), ...Array.from({ length: 30 }, (_, i) => item(i + 4))]);

  it("lists the first 20 businesses in order, without ads", () => {
    const items = parseMapItems(raw);
    expect(items).toHaveLength(20);
    expect(items[0]).toEqual({ cid: "c1", placeId: "p1", name: "Business 1", rating: 4.5, reviews: 10 });
    expect(items[2]).toEqual({ cid: "c3", placeId: "p3", name: "Business 3", rating: null, reviews: null });
    expect(items.some((x) => x.cid === "ad")).toBe(false);
  });

  it("gives the business's place by Google's id, or 0 when it isn't in the first 20", () => {
    const items = parseMapItems(raw);
    expect(rankOf(items, "c1", null)).toBe(1);
    expect(rankOf(items, "nope", "p7")).toBe(7);
    expect(rankOf(items, "c20", null)).toBe(20);
    expect(rankOf(items, "c21", null)).toBe(0);
    expect(rankOf(items, null, null)).toBe(0);
    expect(parseMapItems(maps(null))).toEqual([]); // Google found nothing there: a real answer
  });

  it("throws when the search itself failed, so the spot counts as not checked", () => {
    expect(() => parseMapItems(maps([], 40501))).toThrow(/failed/);
    expect(() => parseMapItems({})).toThrow();
  });
});

describe("the counts", () => {
  const ranks: Rank[] = [1, 2, 3, 3, 4, 10, 11, 20, 0, 0, -1, null];

  it("counts top 3, 4 to 10, 11 to 20, not in the top 20, and spots it couldn't check", () => {
    expect(summarise(ranks)).toEqual({ spots: 12, checked: 10, top3: 4, mid: 2, low: 2, out: 2, failed: 1, avg: 6.8 });
    expect(summarise([0, 0]).avg).toBeNull();
  });

  it("says only what the counts say", () => {
    expect(headline(summarise([1, 2, 3]))).toBe("You’re in the top 3 in all 3 spots.");
    expect(headline(summarise(ranks))).toBe("You’re in the top 3 in 4 of 10 spots.");
    expect(headline(summarise([5, 12, 0]))).toBe("You’re not in the top 3 in any spot yet.");
    expect(headline(summarise([0, 0, 0]))).toBe("You didn’t show up in the top 20 in any spot.");
    expect(headline(summarise([-1, null]))).toBe("We couldn’t check your spots.");
    expect(resultLine(summarise(ranks))).toBe("Top 3 in 4 of 10 spots, 4 to 10 in 2, 11 to 20 in 2, not in the top 20 in 2. Average place where found: 6.8.");
    expect(resultLine(summarise([0]))).toBe("Top 3 in 0 of 1 spots, 4 to 10 in 0, 11 to 20 in 0, not in the top 20 in 1.");
  });

  it("names who Google had in the top 3 most, never the business itself", () => {
    const it2 = (cid: string, reviews = 5): MapItem => ({ cid, placeId: null, name: `Name ${cid}`, rating: 4.8, reviews });
    const lists = [
      [it2("me"), it2("a"), it2("b"), it2("c")], // c is 4th: not counted
      [it2("a"), it2("b", 50), it2("me")],
      [it2("a"), it2("d", 9), it2("e", 99), it2("me")],
      null, // a spot we couldn't check
    ];
    expect(topRivals(lists, "me", null)).toEqual([
      { name: "Name a", rating: 4.8, reviews: 5, spots: 3 },
      { name: "Name b", rating: 4.8, reviews: 5, spots: 2 },
      { name: "Name e", rating: 4.8, reviews: 99, spots: 1 },
      { name: "Name d", rating: 4.8, reviews: 9, spots: 1 },
    ]);
    expect(topRivals(lists, "me", null, 1)).toHaveLength(1);
  });
});

describe("the map picture", () => {
  const view = mapView(-31.958584, 115.86664);

  it("picks a zoom whose picture is at most 640 wide and covers it with OpenStreetMap tiles", () => {
    expect(view.zoom).toBe(12);
    expect(view.width).toBeGreaterThan(300);
    expect(view.width).toBeLessThanOrEqual(640);
    expect(view.height).toBeGreaterThan(300);
    // every corner of the picture is under a tile
    for (const [x, y] of [[0, 0], [view.width - 1, 0], [0, view.height - 1], [view.width - 1, view.height - 1]]) {
      expect(view.tiles.some((t) => t.left <= x && x < t.left + 256 && t.top <= y && y < t.top + 256)).toBe(true);
    }
    // Perth at zoom 12 is around tile 3366, 2432
    expect(view.tiles.every((t) => Math.abs(t.x - 3366) <= 2 && Math.abs(t.y - 2432) <= 2)).toBe(true);
    expect(view.tiles.length).toBeLessThanOrEqual(9);
  });

  it("puts the 49 dots in an even grid with the business in the middle", () => {
    expect(view.pins).toHaveLength(49);
    expect(view.pins[24].left).toBeCloseTo(50, 0);
    expect(view.pins[24].top).toBeCloseTo(50, 0);
    for (const p of view.pins) {
      expect(p.left).toBeGreaterThan(5);
      expect(p.left).toBeLessThan(95);
      expect(p.top).toBeGreaterThan(5);
      expect(p.top).toBeLessThan(95);
    }
    expect(view.pins[1].left - view.pins[0].left).toBeCloseTo((2 / 15.2) * 100, 0);
    expect(view.pins[7].top - view.pins[0].top).toBeCloseTo((2 / 15.2) * 100, 0);
    expect(view.pins[0].top).toBeLessThan(view.pins[42].top); // north is at the top
  });

  it("works from Darwin to Hobart", () => {
    for (const [lat, lng] of [[-12.46, 130.84], [-42.88, 147.33], [-33.87, 151.21]]) {
      const v = mapView(lat, lng);
      expect(v.width).toBeLessThanOrEqual(640);
      expect(v.width).toBeGreaterThan(300);
      expect(v.tiles.length).toBeGreaterThan(0);
      expect(v.tiles.length).toBeLessThanOrEqual(12);
    }
  });
});

describe("what the page gets", () => {
  const row = {
    id: "abc12345",
    status: "done",
    keyword: "solar panel cleaning",
    business: "Perth Solar Panel Cleaners",
    address: null,
    category: "House cleaning service",
    rating: 5,
    reviews: 37,
    lat: -31.96,
    lng: 115.87,
    points: [1, 2, 0, -1],
    rivals: [{ name: "A1 Solar Cleaning", rating: 5, reviews: 143, spots: 12 }],
    finishedAt: new Date("2026-11-25T05:20:00Z"),
    // what must never reach the page
    firstName: "Sam",
    phone: "0400 123 456",
    query: "perth solar panel cleaners",
    ipHash: "hash",
    utmCampaign: "ads",
  };

  it("has the business's public details and its ranks, never the name or phone typed", () => {
    const c = publicCheck(row);
    expect(c.business).toEqual({ name: "Perth Solar Panel Cleaners", address: null, category: "House cleaning service", rating: 5, reviews: 37 });
    expect(c.ranks).toHaveLength(49);
    expect(c.ranks.slice(0, 5)).toEqual([1, 2, 0, -1, null]);
    expect(c.summary).toMatchObject({ top3: 2, out: 1, failed: 1, checked: 3 });
    expect(c.headline).toBe("You’re in the top 3 in 2 of 3 spots.");
    expect(c.map?.pins).toHaveLength(49);
    expect(c.checkedAt).toBe("2026-11-25T05:20:00.000Z");
    const sent = JSON.stringify(c);
    for (const secret of ["Sam", "0400", "perth solar panel cleaners", "hash", "ads"]) expect(sent).not.toContain(secret);
  });

  it("has no map until Google has said where the business is", () => {
    const c = publicCheck({ ...row, status: "queued", lat: null, lng: null, points: null, rivals: null, finishedAt: null });
    expect(c.map).toBeNull();
    expect(c.ranks.every((r) => r === null)).toBe(true);
    expect(c.rivals).toEqual([]);
    expect(c.checkedAt).toBeNull();
  });
});

describe("rankwithross.com.au/visibility, the page", () => {
  const get = async (path = "/visibility") => {
    const res = (await loader({ request: new Request(`https://rankwithross.com.au${path}`), params: {}, context: {} } as unknown as LoaderFunctionArgs)) as Response;
    return { res, text: await res.text() };
  };
  const send = (body: Record<string, string>, headers: Record<string, string> = {}, method = "POST") =>
    action({
      request: new Request("https://rankwithross.com.au/visibility", { method, body: method === "POST" ? new URLSearchParams(body) : undefined, headers: { origin: "https://rankwithross.com.au", ...headers } }),
      params: {},
      context: {},
    } as unknown as ActionFunctionArgs) as Promise<Response>;

  it("is one HTML page with the four boxes, kept out of search, in the site's own words", async () => {
    const { res, text: html } = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('<link rel="canonical" href="https://rankwithross.com.au/visibility">');
    expect(html).toContain("<title>Free Google Maps check | Rank with Ross</title>");
    expect(html).toContain('Can customers near you <b>find you on Google Maps?</b>');
    // the route filled in the font, Ross's photo and the check (none on a plain visit)
    expect(html).not.toMatch(/__[A-Z_]+__/);
    expect(html).toContain('<script type="application/json" id="check">null</script>');
    for (const name of ["first", "phone", "business", "keyword", "website"]) expect(html).toContain(`name="${name}"`);
    // the words saved with every check are the words under the button
    expect(html).toContain(HEATMAP_CONSENT);
    expect(html).toContain('<a href="/privacy#maps">Privacy</a>');
    expect(html).toContain("fetch('/visibility'");
    // Ross's rules: no em dashes (or a spaced en dash standing in for one), no "Example" pills, prices nowhere
    expect(html).not.toContain("—");
    expect(html).not.toMatch(/ – /);
    expect(html).not.toMatch(/>Example</);
    // the map picture names its maker, as OpenStreetMap asks
    expect(html).toContain('href="https://www.openstreetmap.org/copyright"');
    expect(html).toContain("https://tile.openstreetmap.org/");
    // what the page says about the check matches the rules
    expect(html).toContain(`from ${SPOTS} spots around you`);
    expect(html).toContain(`The dots are ${GRID.stepKm} km apart.`);
  });

  it("loads Rank with Ross's Meta pixel and cookie notice like the home page, and tells Meta about a check without any details", async () => {
    const { text: html } = await get();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain(readFileSync(join(ROOT, "design", "overview", "pixel-head.js"), "utf8").trim());
    expect(html.match(/28710910728563304/g)).toHaveLength(1);
    expect(html).toContain('<div class="ck" id="ck" role="region" aria-label="Cookies" hidden>');
    expect(html).toContain(readFileSync(join(ROOT, "design", "overview", "parts", "47-cookies.js"), "utf8").trim());
    expect(html).toContain("window.fbq('track', 'Lead', { content_name: 'maps check' });");
  });

  it("opens a map again from its link, never cached or listed, and safe to put in the page", async () => {
    const { res, text: html } = await get("/visibility?r=abc12345");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(html).toContain('"id":"abc12345"');
    expect(html).toContain("plumber \\u003c/script>");
    expect((await get("/visibility?r=nope")).text).toContain('id="check">null</script>');
    expect((await get()).res.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("answers the page's questions about a running check as JSON", async () => {
    const { res, text } = await get("/visibility?poll=abc12345");
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(text)).toMatchObject({ id: "abc12345", status: "done" });
    expect(JSON.parse((await get("/visibility?poll=nope")).text)).toEqual({ missing: true });
  });

  it("takes the form, and a tap on one of the businesses, from our own site only", async () => {
    const ok = await send({ first: "Sam", phone: "0400 123 456", business: "Smith Plumbing Joondalup", keyword: "plumber", utm_campaign: "ads", fb: "1" }, { "x-real-ip": "1.2.3.4" });
    expect(await ok.json()).toEqual({ ok: true, state: "running", id: "abc12345" });
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(vi.mocked(startCheck).mock.calls.at(-1)![0]).toMatchObject({
      firstName: "Sam",
      phone: "0400 123 456",
      business: "Smith Plumbing Joondalup",
      keyword: "plumber",
      ip: "1.2.3.4",
      ad: { utmCampaign: "ads", fbclid: true },
    });
    await send({ intent: "pick", id: "abc12345", cid: "99" });
    expect(vi.mocked(pickBusiness).mock.calls.at(-1)).toEqual(["abc12345", "99"]);

    const other = await send({ first: "Sam" }, { origin: "https://evil.example" });
    expect(other.status).toBe(403);
    expect((await other.json()).ok).toBe(false);
    expect((await send({}, {}, "PUT")).status).toBe(405);
    const big = await send({ first: "x".repeat(9000) });
    expect(big.status).toBe(413);
  });
});

describe("the privacy page and the admin menu know about it", () => {
  it("has its own part of /privacy, where the form's Privacy link goes", () => {
    const privacy = readFileSync(join(ROOT, "app", "routes", "privacy.tsx"), "utf8");
    expect(privacy).toContain('id="maps"');
    expect(privacy).toContain("Free Google Maps check");
    expect(privacy).toContain("{heatmapMonths} months");
    expect(privacy).toContain("OpenStreetMap");
  });
  it("is a tab in Admin", () => {
    expect(readFileSync(join(ROOT, "app", "routes", "dash.admin.tsx"), "utf8")).toContain('{ to: "/dash/admin/maps", label: "Map checks" }');
  });
});
