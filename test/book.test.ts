// firstpicked.com.au/book, the book-a-call page (Ross, 3 Nov 2026): the free times (Ross's hours in Perth, minus his busy
// times), the page with and without his Google Calendar connected, and booking a call (checks, the Google Calendar
// event with a Meet link, a time someone just took, the per-IP limit, Ross's email). Google and the database are
// stand-ins: no network, no database.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

const h = vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = "client-id";
  process.env.GOOGLE_CLIENT_SECRET = "client-secret";
  process.env.GEO_ALERT_EMAIL = "ross@geo.test";
  process.env.CHECK_IP_SECRET = "test-secret";
  return {
    link: null as null | { id: string; email: string; refreshToken: string; updatedAt: Date },
    busy: [] as { start: string; end: string }[],
    events: [] as { url: string; body: Record<string, unknown> }[],
    emails: [] as unknown[][],
  };
});

vi.mock("../app/db.server", () => ({
  default: {
    calendarLink: {
      findUnique: vi.fn(async () => h.link),
      upsert: vi.fn(async ({ create }: { create: { id: string; email: string; refreshToken: string } }) => (h.link = { ...create, updatedAt: new Date() })),
    },
  },
}));
vi.mock("../app/lib/email.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/email.server")>()),
  emailConfigured: () => true,
  sendEmail: vi.fn(async (...args: unknown[]) => {
    h.emails.push(args);
  }),
}));

import { CALL, openSlots, rossTime } from "../app/lib/booking";
import { bookCall, connectCalendar, consentUrl, freeSlots } from "../app/lib/booking.server";
import { env } from "../app/lib/env.server";
import { action, loader } from "../app/routes/book";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const NOW = new Date("2026-11-03T00:00:00Z"); // Tuesday 3 November, 8:00 am in Perth

vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u === "https://oauth2.googleapis.com/token") {
      const form = new URLSearchParams(String(init?.body));
      if (form.get("grant_type") === "authorization_code") {
        const idToken = `x.${Buffer.from(JSON.stringify({ email: "ross@gmail.test" })).toString("base64url")}.y`;
        return Response.json({ access_token: "at", refresh_token: "rt-new", expires_in: 3600, id_token: idToken });
      }
      return Response.json({ access_token: "at", expires_in: 3600 });
    }
    if (u === "https://www.googleapis.com/calendar/v3/freeBusy") return Response.json({ calendars: { primary: { busy: h.busy } } });
    if (u.startsWith("https://www.googleapis.com/calendar/v3/calendars/primary/events")) {
      h.events.push({ url: u, body: JSON.parse(String(init?.body)) });
      return Response.json({ id: "ev1", hangoutLink: "https://meet.google.com/abc-defg-hij" });
    }
    return new Response("not found", { status: 404 });
  }),
);

beforeEach(() => {
  h.link = { id: "booking", email: "ross@gmail.test", refreshToken: "rt", updatedAt: new Date() };
  h.busy = [];
  h.events = [];
  h.emails = [];
  env.googleClientId = "client-id";
});

describe("free times", () => {
  it("are 15-minute calls starting every half hour, Monday to Friday, 9 am to 5 pm Perth, from 4 hours ahead to 2 weeks out", () => {
    const slots = openSlots(NOW, []);
    // Tuesday: from 12:00 pm (8 am + 4 hours) to the 4:30 pm call; then 9 more weekdays of 16 calls each
    expect(slots).toHaveLength(10 + 9 * 16);
    expect(slots[0]).toBe("2026-11-03T04:00:00.000Z"); // 12:00 pm Perth
    expect(slots.at(-1)).toBe("2026-11-16T08:30:00.000Z"); // Monday 16 November, 4:30 pm Perth
    const perth = (iso: string) => new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Perth", weekday: "short", hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
    for (const s of slots) {
      expect(perth(s)).toMatch(/^(Mon|Tue|Wed|Thu|Fri) (09|1[0-6]):(00|30)$/);
    }
    expect(CALL.minutes).toBe(15);
    expect(CALL.every).toBe(30);
  });

  it("skip anything that touches a busy time in Ross's calendar", () => {
    h.busy = [];
    const slots = openSlots(NOW, [
      { start: Date.parse("2026-11-03T05:00:00Z"), end: Date.parse("2026-11-03T06:00:00Z") }, // 1 to 2 pm Perth
      { start: Date.parse("2026-11-03T06:05:00Z"), end: Date.parse("2026-11-03T06:10:00Z") }, // inside the 2 pm call
    ]);
    expect(slots).not.toContain("2026-11-03T05:00:00.000Z");
    expect(slots).not.toContain("2026-11-03T05:30:00.000Z");
    expect(slots).not.toContain("2026-11-03T06:00:00.000Z");
    expect(slots).toContain("2026-11-03T04:30:00.000Z"); // 12:30 pm ends as the busy time starts
    expect(slots).toContain("2026-11-03T06:30:00.000Z");
  });

  it("follow the clocks where they change (Sydney's daylight saving starts 4 October 2026)", () => {
    const sydney = { ...CALL, timeZone: "Australia/Sydney" };
    const slots = openSlots(new Date("2026-10-02T00:00:00Z"), [], sydney); // Friday 10 am in Sydney
    expect(slots[0]).toBe("2026-10-02T04:00:00.000Z"); // Friday 2 pm (UTC+10)
    expect(slots).toContain("2026-10-04T22:00:00.000Z"); // Monday 9 am (UTC+11)
  });

  it("read in Ross's own time for his email", () => {
    expect(rossTime("2026-11-03T04:00:00.000Z")).toBe("Tuesday 3 November, 12:00 pm");
  });
});

describe("the page", () => {
  const call = (url = "https://geo.test/book") => loader({ request: new Request(url), params: {}, context: {} } as unknown as LoaderFunctionArgs) as Promise<Response>;

  it("asks people to text Ross while his calendar isn't connected", async () => {
    h.link = null;
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain('<script type="application/json" id="slots">null</script>');
    expect(html).toContain("<h2>Text Ross to pick a time</h2>");
    expect(html).toContain('href="sms:+61400369865"');
  });

  it("is one page with one job: book a call, in the home page's look, kept out of search", async () => {
    const html = await (await call()).text();
    expect(html).toContain("<title>Book a call with Ross · FirstPicked</title>");
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain('<h1 class="h1">Book a call <b>with Ross.</b></h1>');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('<link rel="canonical" href="https://firstpicked.com.au/book">');
    // no menu: the only links are home, privacy, terms and texting Ross
    const links = [...new Set([...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]))].sort();
    expect(links).toEqual(["/", "/privacy", "/privacy#cookies", "/terms", "sms:+61400369865"]);
    // Ross (3 Nov 2026): next to his name, "Want to txt Ross instead?" with the number in purple
    expect(html).toContain('<span class="who-txt">Want to txt Ross instead? <a href="sms:+61400369865">0400 369 865</a></span>');
    expect(html).toContain(".who-txt a{color:var(--accent-ink);");
    // the route filled everything in
    expect(html).not.toMatch(/__[A-Z_]+__|<!-- (META_PIXEL|COOKIE_SCRIPT) -->/);
    expect(html).toMatch(/<img src="[^"]*ross[^"]*\.webp" alt=""/);
    // the true promises from the home page, and Ross's rules: no em dashes
    expect(html).toContain("Full refund if you’re not happy after month 1");
    expect(html).toContain("</svg>No lock-in contract</li>");
    // Ross (3 Nov 2026): the line under the calendar, and a 15-minute call to match it
    expect(html).toContain('<p class="intro" hidden>15 minute <b>FREE</b> introduction call. No obligation.</p>');
    expect(html).toContain("</svg>15 minutes</span>");
    expect(html).not.toContain("30 minutes");
    expect(html).not.toContain("Can’t find a time");
    expect(html).toContain("A$1,000 a month, and we do the work");
    expect(html).not.toContain("—");
    expect(html).not.toMatch(/ – /);
  });

  it("has the home page's Meta pixel and cookie notice, and tells Meta Lead when a call is booked", async () => {
    const html = await (await call()).text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain(readFileSync(join(ROOT, "design", "overview", "pixel-head.js"), "utf8").trim());
    expect(html).toContain('<div class="ck" id="ck" role="region" aria-label="Cookies" hidden>');
    expect(html).toContain(readFileSync(join(ROOT, "design", "overview", "parts", "47-cookies.js"), "utf8").trim());
    expect(html).toContain("window.fbq('track', 'Lead', { content_name: 'book a call' });");
    expect(html).not.toContain("facebook.com/tr?");
  });

  it("lists Ross's free times once his calendar is connected", async () => {
    const html = await (await call()).text();
    const json = /<script type="application\/json" id="slots">([^<]*)<\/script>/.exec(html)?.[1];
    const slots = JSON.parse(json!) as string[];
    expect(Array.isArray(slots)).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
    expect(await freeSlots(NOW)).toHaveLength(154);
  });

  it("falls back to texting Ross when Google can't be reached", async () => {
    h.link = { id: "booking", email: "", refreshToken: "rt-broken", updatedAt: new Date() };
    vi.mocked(fetch).mockImplementationOnce(async () => Response.json({ error: "invalid_grant" }, { status: 400 }));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await freeSlots(NOW)).toBeNull();
  });
});

describe("booking a call", () => {
  const good = { start: "2026-11-04T01:00:00.000Z", name: "Jane Smith", email: "Jane@ShopJane.com.au", store: "shopjane.com.au", ip: "203.0.113.1" };

  it("adds it to Ross's calendar with a Meet link, invites the person and emails Ross", async () => {
    const out = await bookCall({ ...good, from: { utm_source: "facebook", utm_campaign: "waitlist" } }, NOW);
    expect(out).toEqual({ status: 200, result: { ok: true, start: good.start, email: "jane@shopjane.com.au" } });
    expect(h.events).toHaveLength(1);
    const { url, body } = h.events[0];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all");
    expect(body).toMatchObject({
      summary: "FirstPicked call: Ross and Jane Smith",
      start: { dateTime: "2026-11-04T01:00:00.000Z" },
      end: { dateTime: "2026-11-04T01:15:00.000Z" }, // a 15-minute call
      attendees: [{ email: "jane@shopjane.com.au", displayName: "Jane Smith" }],
      conferenceData: { createRequest: { conferenceSolutionKey: { type: "hangoutsMeet" } } },
    });
    expect(String(body.description)).toContain("Store: shopjane.com.au");
    // the ad tags go to Ross only, not into the invite the person sees
    expect(String(body.description)).not.toContain("facebook");
    expect(h.emails).toHaveLength(1);
    const [to, subject, html] = h.emails[0] as [string[], string, string];
    expect(to).toEqual(["ross@geo.test"]);
    expect(subject).toBe("New call booked: Jane Smith, Wednesday 4 November, 9:00 am");
    expect(html).toContain("utm_source=facebook, utm_campaign=waitlist");
  });

  it("checks the name, email and store website first", async () => {
    expect((await bookCall({ ...good, name: " " }, NOW)).result).toMatchObject({ ok: false, error: "Please enter your name." });
    expect((await bookCall({ ...good, email: "jane@" }, NOW)).result).toMatchObject({ ok: false, error: expect.stringContaining("real email") });
    expect((await bookCall({ ...good, store: "my store" }, NOW)).result).toMatchObject({ ok: false, error: expect.stringContaining("store’s website") });
    expect(h.events).toHaveLength(0);
  });

  it("says yes to a bot that filled the hidden field, and books nothing", async () => {
    expect((await bookCall({ ...good, honeypot: "spam.com", ip: "203.0.113.9" }, NOW)).result).toMatchObject({ ok: true });
    expect(h.events).toHaveLength(0);
  });

  it("refuses a time someone just took, or that was never free, and sends the new free times", async () => {
    h.busy = [{ start: "2026-11-04T01:00:00Z", end: "2026-11-04T01:30:00Z" }];
    const taken = await bookCall({ ...good, ip: "203.0.113.2" }, NOW);
    expect(taken.status).toBe(409);
    expect(taken.result).toMatchObject({ ok: false, error: expect.stringContaining("just taken") });
    expect((taken.result as { slots: string[] }).slots).not.toContain(good.start);
    expect((await bookCall({ ...good, start: "2026-11-07T01:00:00.000Z", ip: "203.0.113.2" }, NOW)).status).toBe(409); // a Saturday
    expect(h.events).toHaveLength(0);
  });

  it("takes at most 3 bookings a day from one IP", async () => {
    const ip = "203.0.113.50";
    const slots = openSlots(NOW, []);
    for (let i = 0; i < 3; i++) expect((await bookCall({ ...good, start: slots[i], ip }, NOW)).status).toBe(200);
    expect((await bookCall({ ...good, start: slots[3], ip }, NOW)).status).toBe(429);
  });

  it("says text Ross when his calendar isn't connected", async () => {
    h.link = null;
    expect((await bookCall({ ...good, ip: "203.0.113.3" }, NOW)).result).toMatchObject({ ok: false, error: expect.stringContaining("text Ross") });
  });

  it("refuses posts from other websites", async () => {
    const request = new Request("https://geo.test/book", { method: "POST", headers: { "sec-fetch-site": "cross-site", "content-type": "application/x-www-form-urlencoded" }, body: "name=x" });
    const res = (await action({ request, params: {}, context: {} } as unknown as ActionFunctionArgs)) as Response;
    expect(res.status).toBe(403);
  });
});

describe("connecting Ross's Google Calendar", () => {
  it("asks Google for a refresh token to see free times and add events, coming back to the admin page", () => {
    const u = new URL(consentUrl("state123"));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("redirect_uri")).toBe("https://firstpicked.com.au/dash/admin/calendar");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("state")).toBe("state123");
    expect(u.searchParams.get("scope")?.split(" ")).toEqual(["openid", "email", "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"]);
  });

  it("saves the refresh token and the Google address it belongs to", async () => {
    h.link = null;
    expect(await connectCalendar("code-from-google")).toBe("ross@gmail.test");
    expect(h.link).toMatchObject({ id: "booking", email: "ross@gmail.test", refreshToken: "rt-new" });
  });
});
