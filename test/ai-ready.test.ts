import { describe, expect, it } from "vitest";
import { scoreAiReady, AI_READY_NOTE, AI_READY_WEIGHTS, aiReadyNote, keyFactsNearTop, leadText, looksEnglish, type AiReadyInput } from "../app/lib/ai-ready";
import { mergeProduct, parseAiSignals, parseProductHtml, parseShopifyJs } from "../app/lib/check-read";
import { buildReport } from "../app/lib/check-report";
import type { CheckAnswer } from "../app/lib/check-types";

const URL = "https://coolabahgrooming.com.au/products/sandalwood-beard-oil";

/** What check.server passes to the scorer, from a Shopify product JSON and the page HTML. */
function inputFrom(js: object | null, html: string | null): AiReadyInput {
  const p = mergeProduct(URL, js ? parseShopifyJs(js, URL) : null, html ? parseProductHtml(html, URL) : null)!;
  return {
    title: p.title,
    description: p.description,
    descriptionSource: p.descriptionSource,
    tags: p.tags,
    productType: p.productType,
    price: p.price,
    ldFacts: p.ldFacts,
    signals: p.aiSignals,
  };
}

const ids = (r: ReturnType<typeof scoreAiReady>, pass: boolean) => r!.checks.filter((c) => c.pass === pass).map((c) => c.id);

// Fictional brand and product.
const STRONG_DESCRIPTION =
  "<p>A light, non-greasy beard oil for men with dry skin under the beard. Ideal for short to medium beards.</p>" +
  "<p>Ingredients: jojoba oil, argan oil, sandalwood essential oil and vitamin E. 50ml amber glass bottle with a dropper.</p>" +
  "<p>How to use: after a shower, rub three to five drops between your palms and work through the beard down to the skin. " +
  "One bottle lasts about two months with daily use.</p><p>Made in Melbourne, Australia. Ships Australia-wide from our studio.</p>";

const STRONG_JS = {
  title: "Sandalwood Beard Oil 50ml",
  vendor: "Coolabah Grooming Co",
  type: "Beard Oil",
  tags: ["beard", "dry skin"],
  price: 3400,
  description: STRONG_DESCRIPTION,
};

const STRONG_HTML = `<!doctype html><html lang="en-AU"><head>
<title>Sandalwood Beard Oil | Coolabah Grooming Co</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Sandalwood Beard Oil",
"brand":{"@type":"Brand","name":"Coolabah Grooming Co"},
"offers":{"@type":"Offer","price":"34.00","priceCurrency":"AUD","availability":"https://schema.org/InStock"}}</script>
</head><body><header><nav>Shop Beard Oil Balm</nav></header><main>
<h1>Sandalwood Beard Oil</h1>
<h2>Frequently asked questions</h2>
<details><summary>Is it greasy?</summary><p>No, it soaks in within a minute.</p></details>
</main></body></html>`;

const THIN_HTML = `<!doctype html><html><head><title>Beard Oil</title>
<meta property="og:description" content="Our amazing premium oil.">
</head><body><main><h1>Beard Oil</h1><p>Our amazing premium oil.</p></main></body></html>`;

const FAQ_LD_HTML = `<!doctype html><html><head><title>Beard Balm</title>
<script type="application/ld+json">[{"@context":"https://schema.org","@type":"Product","name":"Beard Balm","offers":{"price":"29"}},
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Does it smell?","acceptedAnswer":{"@type":"Answer","text":"Lightly of cedar."}}]}]</script>
</head><body><main><h1>Beard Balm</h1><p>Short note.</p></main></body></html>`;

describe("AI-ready score", () => {
  it("gives a strong page 100 with every check passed", () => {
    const r = scoreAiReady(inputFrom(STRONG_JS, STRONG_HTML))!;
    expect(ids(r, false)).toEqual([]);
    expect(r.score).toBe(100);
    expect(r.checks.map((c) => c.id)).toEqual(["audience", "facts", "top", "description", "faq", "schema", "origin"]);
    for (const c of r.checks) {
      expect(c.reason).toBeTruthy();
      expect(c.fix).toBeTruthy();
      expect(`${c.label} ${c.reason} ${c.fix}`).not.toMatch(/—|\s–\s/);
    }
  });

  it("checks the key facts are near the top: who it's for and a size or material in the first lines", () => {
    const base = inputFrom(STRONG_JS, STRONG_HTML);
    const top = (description: string) => scoreAiReady({ ...base, description })!.checks.find((c) => c.id === "top")!;
    const story =
      "Our founder started this brand in a tiny kitchen, dreaming of something better. Years of late nights and countless batches later, we finally found it. " +
      "We believe grooming should feel like a ritual, not a chore, and that every bottle should tell a story worth sharing with friends and family. " +
      "Every batch is still poured by hand in our little workshop. " +
      "For men with dry skin. 30ml bottle made with argan and jojoba oil.";
    expect(top(story).pass).toBe(false);
    expect(top(story).reason).toMatch(/don’t say who it’s for or give key facts/);
    expect(top("For men with dry skin: a 30ml beard oil made with argan and jojoba. It softens the beard.").pass).toBe(true);
    expect(top("<p><strong>Ideal for</strong> sensitive skin.</p><p>Made with shea butter and 50 ml in every tin.</p>").pass).toBe(true);
    // The price doesn't count: the page shows it anyway.
    expect(keyFactsNearTop("For men with beards. Only $29.").pass).toBe(false);
    expect(top("").reason).toMatch(/couldn’t find a description/);
    // The top is the first two sentences, or the first 300 characters when they're shorter (never past 450).
    expect(leadText("One. Two. Three.")).toBe("One. Two. Three.");
    expect(leadText(`${"a".repeat(200)}. ${"b".repeat(200)}. Third sentence for men.`)).not.toContain("for men");
    expect(leadText("x".repeat(1000))).toHaveLength(450);
  });

  it("weights add up to 100", () => {
    expect(Object.values(AI_READY_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("fails a thin page on almost everything, with plain reasons", () => {
    const r = scoreAiReady(inputFrom(null, THIN_HTML))!;
    expect(ids(r, true)).toEqual([]);
    expect(r.score).toBe(0);
    const by = Object.fromEntries(r.checks.map((c) => [c.id, c]));
    expect(by.description.reason).toMatch(/short summary/);
    expect(by.schema.reason).toMatch(/didn’t find structured product data/);
    expect(by.facts.reason).toMatch(/couldn’t find the size/);
  });

  it("counts FAQPage data as questions and answers, and names what the product data is missing", () => {
    const r = scoreAiReady(inputFrom(null, FAQ_LD_HTML))!;
    const by = Object.fromEntries(r.checks.map((c) => [c.id, c]));
    expect(by.faq.pass).toBe(true);
    expect(by.faq.reason).toMatch(/FAQ data/);
    expect(by.schema.pass).toBe(false);
    expect(by.schema.reason).toBe("The page’s product data is missing the brand and stock status.");
    expect(r.score).toBe(AI_READY_WEIGHTS.faq);
  });

  it("marks a long description that is mostly praise words as not specific", () => {
    const fluff = "Amazing premium luxurious oil. ".repeat(15) + "An incredible, iconic, unique experience.";
    const r = scoreAiReady({ ...inputFrom(STRONG_JS, STRONG_HTML), description: fluff })!;
    const d = r.checks.find((c) => c.id === "description")!;
    expect(d.pass).toBe(false);
    expect(d.reason).toMatch(/praise words/);
  });

  it("finds where it ships from a banner on the page, but not from a country alone without shipping words", () => {
    const base = { ...inputFrom(STRONG_JS, STRONG_HTML), title: "Oil", tags: [], productType: null, description: "A light oil." };
    const banner = { ...base.signals!, text: "Free shipping Australia-wide on orders over $50" };
    expect(scoreAiReady({ ...base, signals: banner })!.checks.find((c) => c.id === "origin")!.pass).toBe(true);
    const nav = { ...base.signals!, text: "Shop Australia New arrivals" };
    expect(scoreAiReady({ ...base, signals: nav })!.checks.find((c) => c.id === "origin")!.pass).toBe(false);
  });

  it("works for stores anywhere, not only the countries the check asks from", () => {
    const base = { ...inputFrom(STRONG_JS, STRONG_HTML), title: "Oil", tags: [], productType: null, description: "A light oil." };
    const origin = (text: string) => scoreAiReady({ ...base, signals: { ...base.signals!, text } })!.checks.find((c) => c.id === "origin")!;
    for (const text of ["Free delivery across Germany", "Ships from Singapore to all of Asia", "We ship worldwide", "Free shipping nationwide"]) {
      expect(origin(text).pass, text).toBe(true);
    }
    // Ingredient names and product words are not places.
    for (const text of ["German chamomile and French lavender. Fast shipping.", "Fine china plates, quick delivery", "Contact us about delivery"]) {
      expect(origin(text).pass, text).toBe(false);
    }
    // The fix names no country or city of ours: the store fills in its own.
    expect(origin("").fix).toBe("Add one true line on where it’s made and where you ship, like “Made in [your town], ships worldwide”.");
    // "for moms" says who it's for, as "for mums" does.
    const who = (description: string) => scoreAiReady({ ...base, description })!.checks.find((c) => c.id === "audience")!.pass;
    expect(who("A gentle balm for moms.")).toBe(true);
    expect(who("A gentle balm for mums.")).toBe(true);
  });

  it("is skipped when we couldn't read the page itself", () => {
    expect(scoreAiReady(inputFrom(STRONG_JS, null))).toBeNull();
  });
});

describe("parseAiSignals (bounded reading of the page)", () => {
  it("finds FAQ headings, question headings and accordion titles", () => {
    const s = parseAiSignals(
      `<body><h2>FAQ</h2><h3>How big is it?</h3><h4>Is it vegan?</h4><summary>Does it ship to NZ?</summary><h1>Title?</h1></body>`,
    );
    expect(s.faqHeading).toBe(true);
    expect(s.questionHeadings).toBe(3); // h1 doesn't count
    expect(s.faqSchema).toBe(false);
  });

  it("reads the text from <main> and skips scripts", () => {
    const s = parseAiSignals(`<body><nav>Menu</nav><main><p>Made in Hobart</p><script>var x = "<h2>Q?</h2>";</script></main></body>`);
    expect(s.text).toContain("Made in Hobart");
    expect(s.text).not.toContain("Menu");
    expect(s.text).not.toContain("var x");
  });

  it("stays fast on a 2 MB page full of tags that never close", () => {
    const evil = `<html><body>${"<h2 class='x'>".repeat(150_000)}${"<summary>".repeat(20_000)}`;
    const t = Date.now();
    const s = parseAiSignals(evil);
    expect(Date.now() - t).toBeLessThan(1500);
    expect(s.questionHeadings).toBe(0);
  });
});

describe("AI-ready checks in the report", () => {
  const answers: CheckAnswer[] = [
    { question: 0, engine: "chatgpt", run: 1, ok: true, empty: false, named: false, position: null, brands: ["Milkman"], sources: [], snippet: "" },
  ];
  const product = { brand: "Coolabah", domain: "coolabah.com.au", description: "x".repeat(400), hasProductSchema: true };

  it("is saved in the report, and failed checks become one tip (not repeating the description or data tips)", () => {
    const ready = scoreAiReady(inputFrom(null, THIN_HTML))!;
    const r = buildReport(answers, { ...product, description: "Short.", hasProductSchema: false }, [], { aiReady: ready });
    expect(r.aiReady).toEqual(ready);
    const titles = r.tips.map((t) => t.title);
    expect(titles).toContain("Write a fuller product description");
    expect(titles).toContain("Add product data AI can read");
    expect(titles).toContain("Make your page easier for AI to quote");
    expect(titles.filter((t) => /description/i.test(t))).toHaveLength(1);
    const combined = r.tips.find((t) => t.title === "Make your page easier for AI to quote")!;
    expect(combined.body).toMatch(/who it suits/);
    expect(combined.body).not.toMatch(/structured|theme or app/);
  });

  it("gives a single failed check its own tip", () => {
    const ready = scoreAiReady(inputFrom(STRONG_JS, STRONG_HTML))!;
    ready.checks = ready.checks.map((c) => (c.id === "faq" ? { ...c, pass: false } : c));
    const r = buildReport(answers, product, [], { aiReady: ready });
    expect(r.tips.map((t) => t.title)).toContain("Add questions and answers");
  });

  it("old reports without the field still build the same tips", () => {
    const r = buildReport(answers, product);
    expect(r.aiReady).toBeUndefined();
    expect(r.tips.some((t) => /quote|questions and answers/.test(t.title))).toBe(false);
  });
});

describe("the points line under the AI-ready card", () => {
  it("explains a report's own checks: today's seven, or an older report's six", () => {
    const now = (Object.entries(AI_READY_WEIGHTS) as [string, number][]).map(([id, weight]) => ({ id, weight }));
    expect(aiReadyNote(now)).toBe(AI_READY_NOTE);
    const old = [
      { id: "audience", weight: 20 },
      { id: "facts", weight: 20 },
      { id: "description", weight: 20 },
      { id: "faq", weight: 15 },
      { id: "schema", weight: 15 },
      { id: "origin", weight: 10 },
    ];
    expect(aiReadyNote(old)).toBe(
      "Points for each check passed: who it’s for, key facts and the description are worth 20 each, an FAQ and product data 15 each, and where it ships or is made 10.",
    );
    expect(aiReadyNote(old)).not.toContain("near the top");
    expect(aiReadyNote([{ id: "mystery", weight: 5 }])).toBe(AI_READY_NOTE);
  });
});

describe("telling English product data from other languages", () => {
  it("runs the English answer-first check only on English text", () => {
    expect(looksEnglish("For men with dry skin: a 30ml beard oil made with argan and jojoba oil. It softens your beard and stops itch from the first use.")).toBe(true);
    expect(looksEnglish("Unser Bartöl mit Arganöl und Jojobaöl für trockene Haut. Es macht den Bart weich und pflegt die Haut darunter, jeden Tag.")).toBe(false);
    expect(looksEnglish("Une huile à barbe à l'argan et au jojoba pour les peaux sèches. Elle adoucit la barbe et nourrit la peau chaque jour.")).toBe(false);
    expect(looksEnglish("Beard oil 30ml")).toBe(true); // too little to tell
    // HTML tags don't count as words.
    expect(looksEnglish("<p>Für Männer mit trockener Haut: 30 ml Bartöl mit Arganöl und Jojobaöl. Es macht den Bart weich und pflegt.</p><ul><li><strong>Inhalt</strong></li></ul>")).toBe(false);
    expect(looksEnglish("<p>For men with dry skin: a 30 ml beard oil made with argan and jojoba. It softens the beard and calms the skin.</p><ul><li><strong>Size</strong>: 30 ml</li></ul>")).toBe(true);
  });
});
