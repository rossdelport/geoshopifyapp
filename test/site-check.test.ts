import { describe, expect, it } from "vitest";
import { businessSchema, fixFits, hasBusinessData, pageKey, pageProblems, pagesToRead, readPage } from "../app/lib/site-check";

const HOME = `<!doctype html><html><head><title>Home</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"X"}</script></head>
<body><nav><a href="/services.html">Services</a><a href="https://www.pspc.com/about.html">About</a><a href="/about.html">About again</a>
<a href="https://other.com/x">Other</a><a href="/logo.png">Logo</a><a href="/privacy-policy.html">Privacy</a><a href="tel:0400 000 000">Call</a>
<a href="/contact.html?x=1">Contact</a><a href="#top">Top</a></nav>
<h2>Solar panel cleaning</h2><p>We clean solar panels in Perth.</p></body></html>`;

describe("reading a page", () => {
  const p = readPage(HOME, "https://www.pspc.com/");
  it("finds its title, headings, structured data, phone and words", () => {
    expect(p.title).toBe("Home");
    expect(p.description).toBeNull();
    expect(p.h1s).toEqual([]);
    expect(p.types).toEqual(["WebSite"]);
    expect(p.hasFaq).toBe(false);
    expect(p.phone).toBe("0400 000 000");
    expect(p.text).toContain("We clean solar panels in Perth.");
    expect(p.text).not.toContain("Services"); // menus left out
  });

  it("knows business data and FAQs when they're there", () => {
    const page = readPage(`<script type="application/ld+json">{"@graph":[{"@type":["Plumber","LocalBusiness"]},{"@type":"FAQPage"}]}</script><h1>Plumber</h1>`, "https://x.com/");
    expect(hasBusinessData(page.types)).toBe(true);
    expect(page.hasFaq).toBe(true);
  });
});

describe("what to fix", () => {
  it("asks the home page for a title with the town, a description, a heading, business details and questions", () => {
    const kinds = pageProblems(readPage(HOME, "https://www.pspc.com/"), { home: true, area: "Perth" }).map((p) => p.kind);
    expect(kinds).toEqual(["title", "description", "h1", "schema", "faq"]);
  });

  it("only checks titles, descriptions and headings on other pages", () => {
    const page = readPage(`<title>About Perth Solar Panel Cleaners, East Perth</title><meta name="description" content="${"a".repeat(120)}"><h1>About us</h1>`, "https://x.com/about");
    expect(pageProblems(page, { home: false, area: "Perth" })).toEqual([]);
  });

  it("says why a title is too long", () => {
    const page = readPage(`<title>${"Solar panel cleaning ".repeat(5)}</title>`, "https://x.com/");
    expect(pageProblems(page, { home: false, area: null })[0]).toMatchObject({ kind: "title", why: expect.stringContaining("cuts it off") });
  });

  it("keeps fixes that fit the rules, never with dashes", () => {
    expect(fixFits("title", "Solar Panel Cleaning in Perth | Perth Solar Panel Cleaners")).toBe(true);
    expect(fixFits("title", "Solar Panel Cleaning in Perth — Perth Solar Panel Cleaners")).toBe(false);
    expect(fixFits("description", "Too short")).toBe(false);
    expect(fixFits("faq", "No questions here at all, just words that go on and on without a single question mark in them, which is not what we asked for here.")).toBe(false);
  });
});

describe("the website's own pages", () => {
  it("picks pages on the same website, once each, skipping files, other sites, privacy and addresses with questions", () => {
    expect(pagesToRead(HOME, "https://www.pspc.com/")).toEqual(["https://www.pspc.com/services.html", "https://www.pspc.com/about.html"]);
  });

  it("matches a page whatever its ending", () => {
    expect(pageKey("https://www.x.com/about/")).toBe(pageKey("https://x.com/about"));
    expect(pageKey("https://x.com/index.html")).toBe(pageKey("https://x.com/"));
  });
});

describe("the business details code", () => {
  it("uses only the facts we have", () => {
    const code = businessSchema({ name: "PSPC", url: "https://www.pspc.com", phone: "0400 000 000", area: "Perth", description: null });
    const data = JSON.parse(code.replace(/^<script[^>]*>|<\/script>$/g, ""));
    expect(data).toEqual({ "@context": "https://schema.org", "@type": "LocalBusiness", name: "PSPC", url: "https://www.pspc.com", telephone: "0400 000 000", areaServed: { "@type": "City", name: "Perth" } });
  });
});
