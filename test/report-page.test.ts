// The public store report page (/report/<slug>, app/routes/report.$slug.tsx) with a made-up store, Sample Dish Co
// (test/fixtures/store-report.json). Ross films this page, tags the brand and DMs them the link: no button but
// Share, no price or booking link, no em dashes, and Ross's script, tags and notes never leave the server.

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type HeadersArgs, type LoaderFunctionArgs } from "react-router";
import fixtureJson from "./fixtures/store-report.json";
import { EASY_DIFFICULTY, SHOWN_MOVES, lockedCount, type StoreReportData } from "../app/lib/store-report";

vi.mock("../app/lib/store-report.server", () => ({ getReport: vi.fn() }));

const { getReport } = await import("../app/lib/store-report.server");
const route = await import("../app/routes/report.$slug");

const fixture = () => structuredClone(fixtureJson) as unknown as StoreReportData;
// The words a reader sees: tags out, React's escapes back to plain characters.
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

const load = (slug = "sample-dish-co") =>
  route.loader({ request: new Request(`https://firstpicked.com.au/report/${slug}`), params: { slug }, context: {} } as unknown as LoaderFunctionArgs);

/** The page's HTML for a report, the way the route renders it from its loader's data. */
async function render(data: StoreReportData = fixture()): Promise<string> {
  vi.mocked(getReport).mockResolvedValue({ slug: "sample-dish-co", data });
  const loaded = await load();
  const Stub = createRoutesStub([{ id: "report", path: "/report/:slug", Component: route.default as ComponentType, loader: () => loaded }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: ["/report/sample-dish-co"], hydrationData: { loaderData: { report: loaded } } }));
}

beforeEach(() => vi.mocked(getReport).mockReset());

describe("report page loader", () => {
  it("is a 404 for a missing report", async () => {
    vi.mocked(getReport).mockResolvedValue(null);
    const thrown = await load("nope").catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(404);
  });

  it("sends only what the page shows: never Ross's script, tags or notes, nor the locked moves' words", async () => {
    vi.mocked(getReport).mockResolvedValue({ slug: "sample-dish-co", data: fixture() });
    const { report, checked } = await load();
    expect(Object.keys(report).sort()).toEqual(
      ["answers", "checkedAt", "locked", "months", "moves", "named", "picks", "questions", "rivalCount", "rivals", "searchWords", "searches", "siteCount", "sites", "store"].sort(),
    );
    const sent = JSON.stringify(report);
    for (const line of [...fixture().script, ...fixture().tags, ...fixture().notes]) expect(sent).not.toContain(line);
    // The moves on show, then only the places of the locked ones.
    expect(report.moves).toEqual(fixture().moves.slice(0, SHOWN_MOVES));
    expect(report.locked).toEqual(fixture().moves.slice(SHOWN_MOVES).map((m) => m.place));
    for (const m of fixture().moves.slice(SHOWN_MOVES)) expect(sent).not.toContain(m.text);
    expect(checked).toBe("3 Nov 2026"); // 02:30 UTC is 10:30 am in Perth
  });

  it("dates the report in Perth time", async () => {
    vi.mocked(getReport).mockResolvedValue({ slug: "sample-dish-co", data: { ...fixture(), checkedAt: "2026-09-30T17:00:00.000Z" } });
    expect((await load()).checked).toBe("1 Oct 2026"); // 1 am the next day in Perth, and "Sep" style months, never "Sept"
  });
});

describe("report page headers and meta", () => {
  it("is cached briefly, never indexed, and a missing report is never kept", () => {
    const page = route.headers({ errorHeaders: undefined } as unknown as HeadersArgs) as Headers;
    expect(page.get("Cache-Control")).toBe("public, max-age=300");
    expect(page.get("X-Robots-Tag")).toBe("noindex");
    const missing = route.headers({ errorHeaders: new Headers() } as unknown as HeadersArgs) as Headers;
    expect(missing.get("Cache-Control")).toBe("no-store");
    expect(missing.get("X-Robots-Tag")).toBe("noindex");
  });

  it("names the brand in the title and keeps the page out of search", async () => {
    vi.mocked(getReport).mockResolvedValue({ slug: "sample-dish-co", data: fixture() });
    const data = await load();
    const tags = route.meta({ data } as unknown as Parameters<typeof route.meta>[0]);
    expect(tags).toContainEqual({ title: "Sample Dish Co: how to get picked by AI | GEO" });
    expect(tags).toContainEqual({ name: "robots", content: "noindex" });
  });
});

describe("report page", () => {
  it("shows the store, its numbers and the sections in order", async () => {
    const html = await render();
    const words = text(html);
    expect(html).toContain('<h1 class="rp-h1">Sample Dish Co</h1>');
    expect(words).toContain("Made with GEO · Checked 3 Nov 2026");
    expect(words).toContain("sampledishco.example · Australia");
    expect(words).toContain("Plant based dish soap and refills for home kitchens.");
    expect(words).toContain("They named Sample Dish Co 2 times out of 24.");
    expect(words).toContain("11,970"); // searches, with commas
    const order = ["Where you stand", "What shoppers search", "Who AI picks now", "Sites AI trusts", "Your next 3 moves", "+9 more moves", "Month by month", "Checked on 3 Nov 2026"];
    const at = order.map((h) => words.indexOf(h));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("has no em dashes, no spaced en dashes, no price, no booking link and no button but Share", async () => {
    const html = await render();
    expect(html).not.toMatch(/—|\s–\s/);
    expect(html).not.toMatch(/book/i);
    expect(html).not.toContain("A$");
    expect(html).not.toContain("$");
    const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
    expect(buttons).toHaveLength(1);
    expect(text(buttons[0] ?? "")).toContain("Share");
    expect(html).not.toMatch(/Example/); // no "Example" pills (the made-up sites end in .example, lower case)
  });

  it("never shows the script, tags or notes", async () => {
    const html = await render();
    const f = fixture();
    expect(html).not.toContain("Episode");
    for (const line of [...f.script, ...f.notes]) expect(html).not.toContain(line);
    for (const tag of f.tags) expect(text(html)).not.toContain(tag);
  });

  it("shows 3 moves and locks the rest, blurred, with their places visible and their words never in the page", async () => {
    const f = fixture();
    const html = await render(f);
    const locked = lockedCount(f.moves);
    expect(locked).toBe(f.moves.length - SHOWN_MOVES);
    expect(text(html)).toContain(`+${locked} more moves`);
    expect(html.match(/class="rp-blur"/g)).toHaveLength(locked);
    expect(html.match(/Hidden in the full plan/g)).toHaveLength(locked);
    expect(html).toContain("These are in the full plan.");
    const shown = html.slice(html.indexOf('class="rp-moves"'), html.indexOf('id="rp-more"'));
    expect(shown.match(/<li>/g)).toHaveLength(SHOWN_MOVES);
    expect(text(shown)).toContain('Product page: Put "natural dish soap" in your main product');
    // "View source" shows made-up words under the blur, never the locked moves.
    const lockedList = html.slice(html.indexOf('class="rp-locked"'));
    for (const m of f.moves.slice(SHOWN_MOVES)) {
      expect(text(html)).not.toContain(m.text);
      expect(lockedList).toContain(`<b>${m.place}</b>`);
    }
    expect(lockedList).toContain("Lorem ipsum");
  });

  it("names the heading by how many moves there are, and drops the locked list when there's nothing locked", async () => {
    const two = await render({ ...fixture(), moves: fixture().moves.slice(0, 2) });
    expect(text(two)).toContain("Your next 2 moves");
    expect(two).not.toContain("more moves");
    expect(two).not.toContain("rp-blur");
    const one = await render({ ...fixture(), moves: fixture().moves.slice(0, 1) });
    expect(text(one)).toContain("Your next move");
    const four = await render({ ...fixture(), moves: fixture().moves.slice(0, 4) });
    expect(text(four)).toContain("+1 more move");
    expect(text(four)).not.toContain("+1 more moves");
  });

  it("marks the store in the pick list, and colours the score by how often AI named it", async () => {
    const html = await render();
    expect(html).toContain("We asked ChatGPT");
    expect(html).toContain("&ldquo;What&#x27;s the best natural dish soap in Australia?&rdquo;".replace(/&ldquo;|&rdquo;/g, (m) => (m === "&ldquo;" ? "“" : "”")));
    expect(html).toMatch(/<li class="is-you"><span class="rp-rank">4<\/span><span class="rp-brand">Sample Dish Co<\/span><span class="rp-tag is-good">You<\/span><\/li>/);
    expect(html).not.toContain("not named");
    expect(html).toContain("rp-tile is-warn"); // 2 of 24 is under a third
    expect(text(html)).toContain("Named most across all 24 answers:");
    expect(text(html)).toContain("Fern & Suds · 11");
    expect(html.match(/<ul class="rp-chips">([\s\S]*?)<\/ul>/)?.[1].match(/<li>/g)).toHaveLength(5);
  });

  it("shows the store's real place when AI named it after the 8th, with a row for the brands between", async () => {
    const f = fixture();
    const brands = ["Fern & Suds", "Little Kettle", "Clearwater Home", "Bright Basin", "Pebble Lane", "Greenleaf Kitchen", "Tidy Gum Co", "Sample Dish Co"];
    f.picks = { ...f.picks!, brands, named: true, position: 11 };
    const html = await render(f);
    const rows = text(html.match(/<ol class="rp-picks">([\s\S]*?)<\/ol>/)?.[1] ?? "");
    expect(rows).toContain("7 Tidy Gum Co");
    expect(rows).toContain("3 more brands");
    expect(rows).toContain("11 Sample Dish Co You");
    expect(rows).not.toMatch(/\b8 Sample Dish Co/);
    expect(html.match(/class="is-you"/g)).toHaveLength(1);
    expect(rows.indexOf("3 more brands")).toBeLessThan(rows.indexOf("11 Sample Dish Co"));
  });

  it("says 'other brands' when the store was named as often as the top rival", async () => {
    const f = fixture();
    f.named = 11;
    const html = await render(f);
    expect(text(html)).toContain("Other brands named most across all 24 answers:");
    expect(text(await render())).not.toContain("Other brands named most");
  });

  it("adds a red 'not named' row when the answer left the store out", async () => {
    const f = fixture();
    f.named = 0;
    f.picks = { ...f.picks!, named: false, position: null, brands: f.picks!.brands.filter((b) => b !== "Sample Dish Co") };
    const html = await render(f);
    expect(text(html)).toContain("Sample Dish Co: not named");
    expect(html).not.toContain("is-you");
    expect(html).toContain("rp-tile is-bad");
    expect(text(html)).toContain("They named Sample Dish Co 0 times out of 24.");
  });

  it("tags easy search words and explains how hard", async () => {
    const f = fixture();
    const html = await render(f);
    const easy = f.searchWords.filter((w) => w.difficulty !== null && w.difficulty <= EASY_DIFFICULTY).length;
    expect(html.match(/class="rp-easy"/g)).toHaveLength(easy);
    expect(text(html)).toContain(`How hard is 0 to 100. ${EASY_DIFFICULTY} or less is easy to rank for. Search numbers are estimates from Serpstat for Google in Australia.`);
    for (const h of ["Search words", "A month", "How hard", "Put it on"]) expect(text(html)).toContain(h);
  });

  it("drops the how hard column and Serpstat's name when the backup gave the numbers", async () => {
    const f = fixture();
    f.searchWords = f.searchWords.map((w) => ({ ...w, difficulty: null }));
    const html = await render(f);
    expect(html).not.toContain("How hard");
    expect(html).not.toContain("Serpstat");
    expect(html).not.toContain("rp-easy");
    expect(text(html)).toContain("Search numbers are estimates for Google in Australia.");
  });

  it("leaves out empty sections and the searches tile when there's nothing to show", async () => {
    const f = fixture();
    Object.assign(f, { searchWords: [], searches: 0, picks: null, sites: [] });
    f.store = { ...f.store, sells: "", countryName: "the US" };
    const html = await render(f);
    const words = text(html);
    for (const gone of ["What shoppers search", "Who AI picks now", "Plant based"]) expect(words).not.toContain(gone);
    expect(html).not.toContain("<dt>Google searches a month</dt>");
    for (const id of ["rp-search", "rp-picks", "rp-sites"]) expect(html).not.toContain(`id="${id}"`); // "Sites AI trusts" is still a move's place
    expect(html).toContain("rp-tiles is-odd"); // three tiles: the last one spans the row
    expect(words).toContain("sampledishco.example · The US");
    expect(words).toContain("as a shopper in the US, twice each");
  });

  it("lists the sites AI trusts with their counts", async () => {
    const html = await render();
    expect(text(html)).toContain("greenhomereview.example The best natural dish soaps we tested this year 9 answers");
    expect(text(html)).toContain("shopsmall.example 1 answer");
    expect(text(html)).toContain("AI read these sites to decide. Getting onto them helps you get picked.");
  });

  it("shows the month by month plan and the small print", async () => {
    const f = fixture();
    const html = await render(f);
    for (const m of f.months) {
      expect(text(html)).toContain(`Month ${m.month} ${m.title}`);
      for (const item of m.items) expect(text(html)).toContain(item);
    }
    expect(text(html)).toContain("GEO isn't linked to Sample Dish Co. Want this report taken down? Email ross@firstpicked.com.au .");
    expect(html).toContain('<a href="mailto:ross@firstpicked.com.au">ross@firstpicked.com.au</a>');
    expect(html).toContain('<a href="https://firstpicked.com.au/">firstpicked.com.au</a>');
    expect(text(html)).toContain("Every store is different, so we can't promise exact results.");
  });

  it("shows a plain not found page", () => {
    const Stub = createRoutesStub([{ id: "report", path: "/report/:slug", Component: route.default as ComponentType, ErrorBoundary: route.ErrorBoundary }]);
    const html = renderToStaticMarkup(
      createElement(Stub, {
        initialEntries: ["/report/nope"],
        hydrationData: { errors: { report: { status: 404, statusText: "Not Found", internal: false, data: "Not found" } } },
      }),
    );
    expect(text(html)).toContain("We couldn't find that report.");
    expect(html).not.toContain("<button");
  });
});

describe("report page source", () => {
  it("has no em dashes in its copy or styles", () => {
    for (const file of ["app/routes/report.$slug.tsx", "app/styles/report.css"]) {
      expect(readFileSync(new URL(`../${file}`, import.meta.url), "utf8")).not.toMatch(/—|\s–\s/);
    }
  });

  it("only uses the one purple, and keeps motion off for people who ask", () => {
    const css = readFileSync(new URL("../app/styles/report.css", import.meta.url), "utf8");
    expect(css).toContain("--accent: #6c5cf2");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
