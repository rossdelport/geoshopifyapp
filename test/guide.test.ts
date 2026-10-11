import { describe, expect, it } from "vitest";
import {
  applyClaimsText,
  buildAllowlist,
  buildGuideHtml,
  faqFromGuideHtml,
  filterSourceLinks,
  guideClaimsText,
  guideProblems,
  linkKey,
  sentences,
  tidyDashes,
  tidyGuide,
  type GuideDraft,
} from "../app/lib/guide";
import { parseFaq } from "../app/lib/faq";

// Fictional store.
const STORE = "https://coolabahgrooming.com.au";
const products = [
  { title: "Sandalwood Beard Oil", url: `${STORE}/products/sandalwood-beard-oil?utm_source=geo&utm_medium=ai-guide&utm_campaign=best-beard-oil` },
  { title: "Cedar Beard Balm", url: `${STORE}/products/cedar-beard-balm?utm_source=geo&utm_medium=ai-guide&utm_campaign=best-beard-oil` },
];

const draft = (over: Partial<GuideDraft> = {}): GuideDraft => ({
  question: "What is the best beard oil for dry skin in Australia",
  shortAnswer: "Choose a light oil that soaks in fast. A 30 ml bottle lasts about a month. Use a few drops daily.  Extra sentence here.",
  sections: [
    { question: "What should it contain", answer: "Light plant oils like jojoba suit dry skin." },
    { question: "How often should you use it?", answer: "Once a day after a shower works for most beards." },
    { question: "Does it help short stubble?", answer: "Yes, a few drops soften stubble — and the skin under it." },
    { question: "How much do you need?", answer: "Three to five drops cover a short beard." },
    { question: "Is a balm better?", answer: "A balm adds hold, an oil is lighter." },
    { question: "Does scent matter?", answer: "Pick a light scent if you wear fragrance." },
    { question: "One too many?", answer: "Dropped: guides have at most six sections." },
  ],
  picks: [
    { productIndex: 0, why: "Light jojoba oil for daily use." },
    { productIndex: 0, why: "Repeat." },
    { productIndex: 7, why: "No such product." },
    { productIndex: 1, why: "Adds light hold." },
  ],
  sources: [],
  ...over,
});

describe("guide structure", () => {
  it("tidies questions, trims the short answer to 3 sentences, caps sections and drops bad picks", () => {
    const g = tidyGuide(draft(), products.length);
    expect(g.question).toBe("What is the best beard oil for dry skin in Australia?");
    expect(sentences(g.shortAnswer)).toHaveLength(3);
    expect(g.sections).toHaveLength(6);
    expect(g.sections[0].question).toBe("What should it contain?");
    expect(g.sections[2].answer).toBe("Yes, a few drops soften stubble, and the skin under it.");
    expect(g.picks.map((p) => p.productIndex)).toEqual([0, 1]);
    expect(guideProblems(g)).toEqual({ blocking: [], notes: [] });
  });

  it("blocks guides with too few sections, no short answer or no products, and flags answers that lean on others", () => {
    const thin = tidyGuide(draft({ shortAnswer: "", sections: draft().sections.slice(0, 3), picks: [] }), products.length);
    const { blocking } = guideProblems(thin);
    expect(blocking).toHaveLength(3);
    expect(blocking.join(" ")).toMatch(/short answer.*3 question sections.*products/);

    const leaning = tidyGuide(
      draft({ shortAnswer: "Pick a light oil.", sections: draft().sections.map((s, i) => (i === 1 ? { ...s, answer: "As mentioned above, light oils win." } : s)) }),
      products.length,
    );
    const p = guideProblems(leaning);
    expect(p.blocking).toEqual([]);
    expect(p.notes.join(" ")).toMatch(/only one sentence/);
    expect(p.notes.join(" ")).toMatch(/as mentioned above/);
  });

  it("never keeps an em dash or a spaced en dash, and turns number ranges into words", () => {
    expect(tidyDashes("Light — fast")).toBe("Light, fast");
    expect(tidyDashes("Light – fast")).toBe("Light, fast");
    expect(tidyDashes("30–50 ml")).toBe("30 to 50 ml");
    expect(tidyDashes("non-greasy")).toBe("non-greasy");
  });
});

describe("source links: only store URLs we know", () => {
  const allow = buildAllowlist([
    { url: `${STORE}/`, label: "Coolabah home page" },
    { url: `${STORE}/products/sandalwood-beard-oil`, label: "Sandalwood Beard Oil" },
    { url: `${STORE}/policies/shipping-policy`, label: "Shipping policy" },
  ]);

  it("keeps allowlisted links (www, case, trailing slash, query and fragment don't matter) once each", () => {
    const out = filterSourceLinks(
      [
        "https://www.CoolabahGrooming.com.au/products/sandalwood-beard-oil/?utm_source=x#top",
        `${STORE}/products/sandalwood-beard-oil`,
        "http://coolabahgrooming.com.au",
        `${STORE}/policies/shipping-policy`,
      ],
      allow,
    );
    expect(out).toEqual([
      { url: `${STORE}/products/sandalwood-beard-oil`, label: "Sandalwood Beard Oil" },
      { url: `${STORE}/`, label: "Coolabah home page" },
      { url: `${STORE}/policies/shipping-policy`, label: "Shipping policy" },
    ]);
  });

  it("drops anything not on the list: invented pages, other sites, look-alike hosts and odd schemes", () => {
    const out = filterSourceLinks(
      [
        `${STORE}/products/made-up-product`,
        `${STORE}/blogs/news/beard-study`,
        "https://stuga.com.au/best-beard-oil",
        "https://coolabahgrooming.com.au.evil.example/products/sandalwood-beard-oil",
        "javascript:alert(1)",
        "not a url",
        "https://user:pass@coolabahgrooming.com.au/",
      ],
      allow,
    );
    expect(out).toEqual([]);
  });

  it("publishes our own copy of the URL, never the model's text", () => {
    const [hit] = filterSourceLinks([`HTTPS://WWW.coolabahgrooming.com.au/Products/Sandalwood-Beard-Oil?x="><script>`], allow);
    expect(hit.url).toBe(`${STORE}/products/sandalwood-beard-oil`);
  });

  it("linkKey normalises hosts and paths", () => {
    expect(linkKey("https://WWW.Shop.com/products/x/?a=1#b")).toBe("shop.com/products/x");
    expect(linkKey("ftp://shop.com/x")).toBeNull();
  });
});

describe("guide HTML", () => {
  const g = tidyGuide(draft(), products.length);

  it("has a short answer, H2 questions, products with our UTM and sources only when real", () => {
    const html = buildGuideHtml(g, products, []);
    expect(html.startsWith("<p><strong>Short answer:</strong>")).toBe(true);
    expect(html.match(/<h2>/g)).toHaveLength(7); // 6 questions + "Products that fit"
    expect(html).toContain("<h2>Products that fit</h2>");
    expect(html).toContain(`href="${products[0].url.replace(/&/g, "&amp;")}"`);
    expect(html).not.toContain("Sources");
    expect(html).not.toMatch(/<h1/);
    const withSources = buildGuideHtml(g, products, [{ url: `${STORE}/`, label: "Coolabah home page" }]);
    expect(withSources).toContain(`<p><em>Sources:</em> <a href="${STORE}/">Coolabah home page</a></p>`);
  });

  it("escapes every piece of text", () => {
    const html = buildGuideHtml({ ...g, sections: [{ question: "<script>x</script>?", answer: "a & b" }, ...g.sections.slice(1)] }, products, []);
    expect(html).toContain("<h2>&lt;script&gt;x&lt;/script&gt;?</h2>");
    expect(html).toContain("<p>a &amp; b</p>");
  });

  it("reads the questions and answers back out for FAQPage data", () => {
    const html = buildGuideHtml(g, products, []);
    const faq = faqFromGuideHtml(g.question, html);
    expect(faq).toHaveLength(7); // the title with the short answer, then 6 sections ("Products that fit" isn't a question)
    expect(faq[0]).toEqual({ q: g.question, a: g.shortAnswer });
    expect(faq[1]).toEqual({ q: "What should it contain?", a: "Light plant oils like jojoba suit dry skin." });
  });

  it("maps the claims check's softened text back, or gives up when the shape changed", () => {
    const text = guideClaimsText(g);
    const softened = parseFaq(text.replace("Light jojoba oil for daily use.", "Light oil for daily use."));
    const back = applyClaimsText(g, softened)!;
    expect(back.picks[0].why).toBe("Light oil for daily use.");
    expect(back.sections).toEqual(g.sections);
    expect(applyClaimsText(g, softened!.slice(1))).toBeNull();
  });
});
