/* eslint-disable @typescript-eslint/no-explicit-any -- reads the JSON-LD graph and fakes readProduct */
// The AI Bot Checker (/tools/ai-bot-checker): the pattern check (filler phrases, hype words with no fact in
// the same sentence, the 7 facts, readability tips, the verdict), its bounds (wildcards stay inside one
// sentence, a 20,000-character adversarial text finishes fast), the honesty guard (never detector-style
// copy), link mode (readProduct faked), the action's guards, the page (head, JSON-LD, copy, one button)
// and the copy rules. Every text here is made up.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type ActionFunctionArgs, type MetaDescriptor } from "react-router";

vi.mock("../app/lib/check.server", () => ({ safeFetch: vi.fn(), readProduct: vi.fn() }));

const { readProduct } = await import("../app/lib/check.server");
const { checkCopy, sentenceSpans, verdictFor, hypeGroup, FILLER } = await import("../app/lib/tools/copy-check");
const { readLinkedDescription, clearCopyCache } = await import("../app/lib/tools/copy-check.server");
const copy = await import("../app/lib/tools/copy/ai-bot-checker");
const { CopyReportView } = await import("../app/components/tools/copy-result");
const { SAMPLE_TEXT, REWRITE_TEXT } = await import("../app/lib/tools/samples/copy-sample");
const { toolBySlug, TOOLS } = await import("../app/lib/tools/registry");
const { toolJsonLd } = await import("../app/lib/tools/seo");
const { CROSS_SITE_COPY, TOO_BIG_COPY } = await import("../app/lib/tools/guard.server");
const { HOUR_COPY, resetToolLimits } = await import("../app/lib/tools/limits.server");
const { toolHeaders } = await import("../app/lib/tools/http");
const { NOT_YOUR_STORE } = await import("../app/lib/check-read");
const route = await import("../app/routes/tools.ai-bot-checker");
const layout = await import("../app/routes/tools");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const TOOL = toolBySlug("ai-bot-checker");
const text = (h: string) =>
  h
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
type Report = ReturnType<typeof checkCopy>;
const fact = (r: Report, id: string) => r.facts.find((f) => f.id === id)!;
const flagTexts = (r: Report) => r.flags.map((f) => f.text);
const joined = (r: Report) => r.segments.map((s) => s.text).join("");

// ---------- the on-load sample and the rewrite ----------

describe("the made-up sample", () => {
  const r = checkCopy(SAMPLE_TEXT);

  it("sounds generic: 12 vague phrases and none of the 7 facts", () => {
    expect(r.verdict).toEqual({ id: "generic", label: "Sounds generic", chip: "Needs work", line: "12 vague phrases, 0 of 7 key facts found." });
    expect(r.numbers).toEqual({ words: 44, sentences: 4, averageSentence: 11, facts: 0, vague: 12 });
    expect(r.facts.every((f) => !f.found)).toBe(true);
  });

  it("counts no materials or ingredients: 'the finest ingredients' names none (the bare word rule)", () => {
    expect(fact(r, "materials")).toMatchObject({ label: "Materials or ingredients", found: false, question: "What is it made of, or what's in it?" });
  });

  it("flags the filler phrases and the hype words with no fact nearby", () => {
    for (const t of ["Elevate your", "premium", "game-changer", "unleash", "journey", "innovative", "unparalleled", "Experience the difference", "the finest ingredients", "full potential"]) {
      expect(flagTexts(r), t).toContain(t);
    }
    expect(r.flags.map((f) => f.display)).toContain("Whether you're ... or");
    expect(r.flags.find((f) => f.display === "Whether you're ... or")?.text).toBe("Whether you're a seasoned beard veteran or");
    // a filler phrase wins over the hype word inside it: "Elevate" and "game-changer" are listed once
    expect(r.flags.filter((f) => /elevate/i.test(f.text))).toHaveLength(1);
    expect(r.flags.filter((f) => f.text === "game-changer").map((f) => f.kind)).toEqual(["filler"]);
  });

  it("explains each phrase with why and how (the spec's example for 'premium')", () => {
    const premium = r.phrases.find((p) => p.display === "premium")!;
    expect(premium).toMatchObject({ kind: "hype", count: 1 });
    expect(`“${premium.display}”: ${premium.why} ${premium.how}`).toBe(
      "“premium”: Says nothing a shopper can check. Say what makes it better, like the material or where it's made.",
    );
    expect(r.phrases.find((p) => p.display === "innovative")?.why).toBe(copy.HYPE_COPY.new.why);
    expect(r.phrases.find((p) => p.display === "Whether you're ... or")?.how).toBe(copy.FILLER_COPY.audience.how);
  });

  it("only tips that it's short", () => {
    expect(r.tips).toEqual([copy.TIPS.short]);
    expect(r.notes).toEqual([]);
  });
});

describe("the made-up rewrite", () => {
  const r = checkCopy(REWRITE_TEXT);

  it("is specific and clear, with who, size, materials, how to use and origin", () => {
    expect(r.verdict?.label).toBe("Specific and clear");
    expect(r.verdict?.line).toBe("0 vague phrases, 5 of 7 key facts found.");
    expect(r.facts.filter((f) => f.found).map((f) => f.id)).toEqual(["who", "size", "materials", "use", "origin"]);
    expect(fact(r, "who").match).toBe("for dry skin");
    expect(fact(r, "size").match).toBe("30 ml");
    expect(fact(r, "origin").match).toBe("Made in Melbourne");
    expect(fact(r, "care")).toMatchObject({ found: false, question: "How do you care for it or store it?" });
    expect(fact(r, "included")).toMatchObject({ found: false, question: "What comes in the box?" });
    expect(r.flags).toEqual([]);
    expect(r.tips).toEqual([]);
  });
});

// ---------- the rules ----------

describe("hype words need a fact in the same sentence", () => {
  it("doesn't count 'premium cotton' next to '100% organic cotton, 180 gsm'", () => {
    const r = checkCopy("A premium cotton tee in 100% organic cotton, 180 gsm.");
    expect(r.flags.filter((f) => f.kind === "hype")).toEqual([]);
  });

  it("counts a hype word whose sentence has no number with a unit, material or 'for {who}'", () => {
    expect(flagTexts(checkCopy("A premium tee. It is 100% organic cotton."))).toEqual(["premium"]);
    expect(flagTexts(checkCopy("A premium tee for runners."))).toEqual([]); // "for runners" says who
    expect(flagTexts(checkCopy("A quiet dishwasher with innovative design."))).toEqual(["innovative"]);
    expect(flagTexts(checkCopy("An innovative 42 dB dishwasher."))).toEqual([]); // Microsoft's example
  });

  it("groups hype words by what they claim", () => {
    expect(hypeGroup("Premium")).toBe("quality");
    expect(hypeGroup("cutting edge")).toBe("new");
    expect(hypeGroup("Eco-friendly")).toBe("eco");
    expect(hypeGroup("elevated")).toBe("verb");
    expect(hypeGroup("stunning")).toBe("praise");
  });

  it("lists a repeated phrase once, with its count", () => {
    const r = checkCopy("A premium oil. A premium balm. A premium wax.");
    expect(r.phrases).toHaveLength(1);
    expect(r.phrases[0]).toMatchObject({ display: "premium", count: 3 });
    expect(r.numbers.vague).toBe(3);
  });
});

describe("wildcards stay inside one sentence", () => {
  const ids = (t: string) => checkCopy(t).flags.map((f) => f.key);

  it("matches within a sentence, up to 40 characters", () => {
    expect(ids("Take your beard to the next level with this oil.")).toContain("filler:next-level");
    expect(ids("Whether you're new or not, it works.")).toContain("filler:whether");
    expect(ids("Whether you\u2019re new or not, it works.")).toContain("filler:whether"); // curly apostrophe
  });

  it("never crosses a full stop, a question mark or a line break", () => {
    expect(ids("Take your time. This oil gets you to the next level.")).not.toContain("filler:next-level");
    expect(ids("Whether you're new? Or not.")).not.toContain("filler:whether");
    expect(ids("Whether you're new\nor not.")).not.toContain("filler:whether");
  });

  it("gives up after 40 characters", () => {
    expect(ids(`Whether you're ${"x".repeat(45)} or not.`)).not.toContain("filler:whether");
  });

  it("every filler pattern is global and bounded", () => {
    for (const p of FILLER) {
      expect(p.re.flags, p.id).toContain("g");
      expect(p.re.source, p.id).not.toMatch(/\.\*|\.\+|\[\^[^\]]*\][*+]/); // no unbounded wildcard
    }
  });
});

describe("the 7 facts", () => {
  it("doesn't count the bare words ingredients, materials and fabric", () => {
    expect(fact(checkCopy("Our ingredients are carefully chosen. Every material is tested. Soft fabric."), "materials").found).toBe(false);
    expect(fact(checkCopy("Made with jojoba and argan."), "materials").found).toBe(true);
  });

  it("never takes a fact from inside a filler phrase", () => {
    const r = checkCopy("Perfect for any occasion. Crafted with care.");
    expect(fact(r, "who").found).toBe(false); // "perfect for" is a who phrase on its own
    expect(fact(r, "care").found).toBe(false); // "care" counts, but not in "crafted with care"
    expect(fact(checkCopy("Perfect for dry skin."), "who").found).toBe(true);
  });

  it("doesn't take a fact from a product name: skin care, beard care, face wash, hair spray, a mix of", () => {
    const r = checkCopy("Our skin care range. A beard care kit. A gentle face wash. A strong hair spray. A mix of oils. Self-care for him.");
    expect(fact(r, "care").found).toBe(false);
    expect(fact(r, "use").found).toBe(false);
    // the same words as real facts still count
    expect(fact(checkCopy("Hand wash only."), "care").match).toBe("Hand wash");
    expect(fact(checkCopy("Care: wipe clean with a damp cloth."), "care").found).toBe(true);
    expect(fact(checkCopy("Spray onto damp hair."), "use").match).toBe("Spray");
    expect(fact(checkCopy("Wash your face with warm water."), "use").match).toBe("Wash");
    // only the fact word is blanked: "for oily skin care" still says who it's for
    expect(fact(checkCopy("A serum for oily skin care."), "who").match).toBe("for oily skin");
  });

  it("finds care, what's included and where it ships", () => {
    const r = checkCopy("Machine wash cold. Comes with a travel pouch. Ships worldwide.");
    expect(fact(r, "care").match).toBe("Machine wash");
    expect(fact(r, "included").match).toBe("Comes with");
    expect(fact(r, "origin").match).toBe("worldwide");
  });

  it("widens a fact to whole words", () => {
    expect(fact(checkCopy("A tee in 100% organic cotton."), "materials").match).toBe("100% organic");
  });
});

// Real descriptions from four Shopify stores (fetched 11 Oct 2026, the file says where from).
const REAL: { id: string; source: string; html: string }[] = JSON.parse(read("test/fixtures/tools/small-copy-descriptions.json")).descriptions;
const real = (id: string) => checkCopy(REAL.find((d) => d.id === id)!.html);
const foundFacts = (r: Report) => Object.fromEntries(r.facts.filter((f) => f.found).map((f) => [f.id, f.match]));

describe("the fact matchers on real product descriptions", () => {
  it("finds what each one really says, and no noun counted as an instruction", () => {
    // Allbirds: "perfect for everyday casual wear" was "how to use it" (the noun "wear")
    expect(foundFacts(real("allbirds-tree-runner"))).toEqual({ who: "perfect for", materials: "made with" });
    // Brooklinen: "it gets better with every wash" was "how to use it"
    expect(foundFacts(real("brooklinen-sheet-set"))).toEqual({ who: "ideal for", materials: "cotton", included: "includes" });
    // Beardbrand: "Use it to add waves, volume, texture" is how to use it, and was missed
    expect(foundFacts(real("beardbrand-sea-salt-spray"))).toEqual({ size: "SIZE", materials: "Infused with", use: "Use it to" });
    expect(foundFacts(real("beardbrand-oversized-tee"))).toEqual({ who: "designed for" });
    expect(foundFacts(real("rhode-lip-tint"))).toEqual({ size: "Size" });
    expect(foundFacts(real("deathwish-light-roast"))).toEqual({ size: "155mg", materials: "contains" });
    for (const d of REAL) expect(fact(checkCopy(d.html), "care").found, d.id).toBe(false); // none has a care line
  });

  it("doesn't count a use word that's a noun or another sense", () => {
    for (const t of [
      "Perfect for everyday casual wear.",
      "Soft, and it gets better with every wash.",
      "A massage gun for sore muscles.",
      "Free returns. Terms and conditions apply.",
      "Shipping fees may apply to some orders.",
      "We use 100% recycled polyester.",
      "Comes in a spray bottle.",
      "Mix and match the colours.",
      "Machine wash cold with like colours.",
    ]) {
      expect(fact(checkCopy(t), "use").found, t).toBe(false);
    }
  });

  it("still finds real directions", () => {
    const cases: [string, string][] = [
      ["Apply to damp skin after a shower.", "Apply"],
      ["Wear it with jeans or shorts.", "Wear"],
      ["Massage into the scalp for a minute.", "Massage"],
      ["Leave for 5 minutes, then rinse off.", "rinse"],
      ["Use 2 to 3 drops.", "Use 2 to 3 drops"],
      ["Directions: shake before use.", "Directions"],
      ["Mix with water or milk.", "Mix"],
      ["Shake well before use.", "Shake well"],
      ["Designed to be worn all day.", "to be worn"],
      ["How to use: one pump on clean hands.", "How to use"],
    ];
    for (const [t, match] of cases) expect(fact(checkCopy(t), "use").match, t).toBe(match);
  });

  it("counts care only as a care line, not 'we care' or 'customer care'", () => {
    for (const t of ["We care about the planet.", "Contact customer care: hello@shop.example.", "Taking care of your skin is simple."]) {
      expect(fact(checkCopy(t), "care").found, t).toBe(false);
    }
    for (const [t, match] of [
      ["Machine washable.", "Machine washable"],
      ["Care instructions: wash cold, dry flat.", "Care instructions"],
      ["Tumble dry low.", "Tumble dry"],
      ["Store in a cool, dry place.", "Store in"],
    ] as [string, string][]) {
      expect(fact(checkCopy(t), "care").match, t).toBe(match);
    }
  });

  it("doesn't read 'ingredients include' as what's in the box", () => {
    const r = checkCopy("Key ingredients include shea butter and jojoba.");
    expect(fact(r, "included").found).toBe(false);
    expect(fact(r, "materials").found).toBe(true);
    expect(fact(checkCopy("Includes a travel pouch."), "included").match).toBe("Includes");
  });

  it("doesn't read a discount as a material, or a country's sizing as where it's from", () => {
    expect(fact(checkCopy("Save 30% off your first order."), "materials").found).toBe(false);
    expect(fact(checkCopy("A tee in 100% organic cotton."), "materials").found).toBe(true);
    expect(fact(checkCopy("Fits true to size: a UK 8 is a US 10."), "origin").found).toBe(false);
    expect(fact(checkCopy("Available in EU sizes 36 to 46."), "origin").found).toBe(false);
    expect(fact(checkCopy("Ships to the UK and Ireland."), "origin").match).toBe("UK");
  });
});

describe("the verdict", () => {
  it("uses the thresholds written in 'How this tool works'", () => {
    expect(verdictFor(4, 1, 100)).toBe("specific");
    expect(verdictFor(4, 2, 100)).toBe("mixed");
    expect(verdictFor(7, 0, 0)).toBe("specific");
    expect(verdictFor(1, 0, 100)).toBe("generic");
    expect(verdictFor(3, 4, 100)).toBe("generic");
    expect(verdictFor(3, 3, 100)).toBe("mixed");
    expect(copy.HOW_IT_WORKS.map((h) => h.text).join(" ")).toContain(
      "'Specific and clear' means at least 4 of the 7 facts and no more than 1 vague phrase per 100 words. 'Sounds generic' means 1 fact or fewer, or 4 or more vague phrases per 100 words.",
    );
  });

  it("counts a text under 100 words as 100, so one hype word doesn't sink a short, factual description", () => {
    expect(verdictFor(3, 1, 11)).toBe("mixed"); // was "generic": 1 in 11 words read as 9 per 100
    expect(verdictFor(5, 2, 38)).toBe("mixed"); // the builder's example, was "generic"
    expect(verdictFor(4, 1, 20)).toBe("specific");
    expect(verdictFor(3, 4, 30)).toBe("generic");
    expect(verdictFor(4, 2, 200)).toBe("specific");
    const r = checkCopy("Beard oil for dry skin. 30 ml glass bottle. Premium quality.");
    expect(r.verdict).toEqual({ id: "mixed", label: "Some specifics, some filler", chip: "Could be clearer", line: "1 vague phrase, 3 of 7 key facts found." });
    expect(copy.HOW_IT_WORKS.map((h) => h.text).join(" ")).toContain("A text under 100 words counts as 100 words, so one vague phrase doesn't outweigh the facts in a short description.");
  });

  it("calls a generic text 'Needs work', not 'Needs facts' (it may have facts and too much filler)", () => {
    expect(copy.VERDICT_CHIP.generic).toBe("Needs work");
  });

  it("words the headline from what was found: no filler named when there are no vague phrases", () => {
    // The real Allbirds description: 0 vague phrases and 2 facts was "Some specifics, some filler"
    expect(real("allbirds-tree-runner").verdict).toEqual({
      id: "mixed",
      label: "Clear, but missing key facts",
      chip: "Add facts",
      line: "0 vague phrases, 2 of 7 key facts found.",
    });
    // The real rhode description: 0 vague phrases and 1 fact was "Sounds generic"
    expect(real("rhode-lip-tint").verdict).toEqual({ id: "generic", label: "Missing most key facts", chip: "Needs facts", line: "0 vague phrases, 1 of 7 key facts found." });
    // with filler, the words stay
    expect(real("brooklinen-sheet-set").verdict).toMatchObject({ id: "mixed", label: "Some specifics, some filler", line: "1 vague phrase, 3 of 7 key facts found." });
    expect(copy.verdictWords("specific", 0)).toEqual({ label: "Specific and clear", chip: "Clear" });
    expect(copy.verdictWords("generic", 3)).toEqual({ label: "Sounds generic", chip: "Needs work" });
    expect(copy.HOW_IT_WORKS.map((h) => h.text).join(" ")).toContain(
      "With no vague phrases at all, the headline says what's missing instead: 'Clear, but missing key facts' for 2 or 3 facts, 'Missing most key facts' for 1 or none.",
    );
  });

  it("shows the worded headline and chip on the result", () => {
    const html = renderToStaticMarkup(createElement(CopyReportView, { report: real("allbirds-tree-runner") }));
    expect(text(html)).toContain("Add facts");
    expect(text(html)).toContain("Clear, but missing key facts");
    expect(text(html)).not.toContain("filler");
  });

  it("says '1 vague phrase' for one", () => {
    expect(checkCopy("A premium oil.").verdict?.line).toBe("1 vague phrase, 0 of 7 key facts found.");
  });
});

describe("tips and notes", () => {
  it("notes a wall of text, long sentences, repeats, symbols and long dashes", () => {
    const long = `This beard oil ${"is soft and light and ".repeat(9)}done.`; // one 40-word sentence
    const wall = Array.from({ length: 13 }, (_, i) => `Sentence ${i} has some words in it.`).join(" "); // 91 words
    const r = checkCopy(`${long} ${wall} Beard oil here. Beard oil there. Beard oil everywhere. Smooth \u2192 soft \u2605 now!!! Light\u2014fast.`);
    expect(r.tips).toContain(copy.TIPS.wall);
    expect(r.tips).toContain(copy.TIPS.longSentences(1));
    expect(r.tips.some((t) => t.startsWith("Your text uses decorative symbols (\u2192 \u2605 !!!)"))).toBe(true);
    expect(r.tips).toContain(copy.TIPS.dashes);
    expect(r.tips).not.toContain(copy.TIPS.short);
    expect(checkCopy("Beard oil is good for you. Beard oil is light. Beard oil is soft.").tips).toContain(copy.TIPS.repeat("beard oil is", 3));
  });

  it("skips the paragraph and sentence length tips for a product link's one-line description (flat)", () => {
    // readProduct turns the page into one line: its paragraphs and list items run together
    const flatText = `${Array.from({ length: 14 }, () => "This oil is light and soft on skin.").join(" ")} Key facts 30 ml glass bottle jojoba and argan no added fragrance made in Melbourne ships worldwide use three drops after a shower and comb it through your beard every day and night for best results`;
    const asPasted = checkCopy(flatText);
    expect(asPasted.tips).toContain(copy.TIPS.wall);
    expect(asPasted.tips).toContain(copy.TIPS.longSentences(1));
    const asLinked = checkCopy(flatText, { flat: true });
    expect(asLinked.tips).not.toContain(copy.TIPS.wall);
    expect(asLinked.tips.some((t) => t.includes("over 35 words"))).toBe(false);
    expect(asLinked.verdict).toEqual(asPasted.verdict); // only the tips change
  });

  it("doesn't call text split into short paragraphs a wall", () => {
    const para = Array.from({ length: 10 }, () => "This oil is light and soft on skin.").join(" "); // 80 words
    expect(checkCopy(`${para}\n${para}`).tips).not.toContain(copy.TIPS.wall);
  });

  it("strips pasted HTML, keeps its paragraphs and lists as lines, and says so", () => {
    const r = checkCopy("<p>Beard oil for <b>dry skin</b>.</p><ul><li>30 ml</li><li>Made with jojoba &amp; argan</li></ul><script>var x = 'premium';</script>");
    expect(r.text).toBe("Beard oil for dry skin .\n30 ml\nMade with jojoba & argan");
    expect(r.notes).toEqual([copy.NOTES.html]);
    expect(fact(r, "size").found).toBe(true);
    expect(r.flags).toEqual([]); // the script is skipped
    expect(joined(r)).toBe(r.text);
  });

  it("keeps a '<' that can't start a tag when it takes out HTML", () => {
    expect(checkCopy("<b>Bold</b> claim: 5 < 6 and 7 > 3. <3").text).toBe("Bold claim: 5 < 6 and 7 > 3. <3");
    expect(checkCopy("<p>Size <50 ml</p><p>For men.</p>").text).toBe("Size <50 ml\nFor men.");
  });

  it("checks the first 20,000 characters of a very long text, and says so", () => {
    const r = checkCopy(`${REWRITE_TEXT} `.repeat(100));
    expect(r.text).toHaveLength(20_000);
    expect(r.notes).toEqual([copy.NOTES.cut]);
  });

  it("hides the verdict for empty text", () => {
    for (const t of ["", "   \n  "]) {
      const r = checkCopy(t);
      expect(r.empty).toBe(true);
      expect(r.verdict).toBeNull();
      expect(r.facts).toEqual([]);
    }
  });

  it("only counts text that isn't English: no phrase lists, no facts, no verdict", () => {
    const r = checkCopy(
      "Huile à barbe pour peau sèche. Flacon de 30 ml en verre avec compte-gouttes. Fabriquée avec du jojoba, de l'argan et de l'huile d'amande douce. Appliquer quatre gouttes après la douche.",
    );
    expect(r.english).toBe(false);
    expect(r.verdict).toBeNull();
    expect(r.flags).toEqual([]);
    expect(r.facts).toEqual([]);
    expect(r.numbers.words).toBeGreaterThan(20);
    expect(r.numbers.sentences).toBe(4);
    expect(joined(r)).toBe(r.text);
  });
});

describe("text in another script", () => {
  it("isn't given English advice, even when it's short", () => {
    for (const t of ["日本製のビアードオイル。乾燥肌の方におすすめです。30mlのガラス瓶入り。", "Масло для бороды для сухой кожи.", "زيت اللحية للبشرة الجافة"]) {
      const r = checkCopy(t);
      expect(r.english, t).toBe(false);
      expect(r.verdict, t).toBeNull();
      expect(r.tips, t).toEqual([]);
    }
    // a few non-Latin letters in English copy are fine
    expect(checkCopy("Beard oil for dry skin, with Japanese camellia (椿) oil. 30 ml.").english).toBe(true);
  });
});

describe("segments", () => {
  it("rebuild the checked text exactly", () => {
    for (const t of [SAMPLE_TEXT, REWRITE_TEXT, "premium", "Premium premium. Unleash! Journey?", "A\r\nB premium.\n\nC", "Elevate your\nday."]) {
      const r = checkCopy(t);
      expect(joined(r), t).toBe(r.text);
      expect(r.text, t).toBe(t.replace(/\r\n?/g, "\n"));
    }
    const r = checkCopy(SAMPLE_TEXT);
    expect(r.segments.filter((s) => s.mark).map((s) => s.text)).toEqual(r.flags.map((f) => f.text));
    expect(r.segments.find((s) => s.text === "premium")?.mark).toEqual({ kind: "hype", why: copy.HYPE_COPY.quality.why });
  });

  it("split sentences at end marks followed by a space, never inside '3.5 ml'", () => {
    const t = "Holds 3.5 ml. Really?! Yes\u2026 “No.” Next\nline";
    expect(sentenceSpans(t).map((s) => t.slice(s.start, s.end))).toEqual(["Holds 3.5 ml.", "Really?!", "Yes\u2026", "“No.”", "Next", "line"]);
  });
});

describe("bounded work", () => {
  const nasty = [
    "take your ".repeat(2_000),
    "whether you're ".repeat(1_400),
    "1,".repeat(10_000),
    "9".repeat(20_000),
    "a".repeat(20_000),
    "premium. ".repeat(2_300),
    "premium ".repeat(2_500),
    "<a ".repeat(6_700),
    "<p>".repeat(6_700),
    "!".repeat(20_000),
    "\u2192".repeat(20_000),
    "for dry skin ".repeat(1_540),
    SAMPLE_TEXT.replace(/[.!?]/g, "").repeat(70),
    "x ".repeat(10_000),
    "beard oil ".repeat(2_000),
    "made in ".repeat(2_500),
    "1.1.".repeat(5_000),
    "skin care ".repeat(2_000),
    "a mix of ".repeat(2_300),
    "<".repeat(20_000),
    "< b".repeat(6_700),
    "<p>5 < 6 ".repeat(2_000),
    "日本".repeat(10_000),
  ];

  it("checks a 20,000-character adversarial text in under 100 ms", () => {
    checkCopy(SAMPLE_TEXT); // warm up
    for (const t of nasty) {
      const input = t.slice(0, 20_000);
      const start = performance.now();
      const r = checkCopy(input);
      const ms = performance.now() - start;
      expect(ms, t.slice(0, 20)).toBeLessThan(100);
      expect(joined(r), t.slice(0, 20)).toBe(r.text);
    }
  });

  it("handles a 2 MB adversarial paste quickly (cut to 20,000 characters first)", () => {
    for (const t of ["<p>premium ".repeat(200_000), "Whether you're ".repeat(140_000), "a\r\n".repeat(700_000)]) {
      const start = performance.now();
      const r = checkCopy(t);
      expect(performance.now() - start, t.slice(0, 12)).toBeLessThan(200);
      expect(r.text.length).toBeLessThanOrEqual(20_000);
    }
  });

  it("reads no more than 20,000 characters, however much is pasted", () => {
    const start = performance.now();
    const r = checkCopy("premium ".repeat(200_000));
    expect(performance.now() - start).toBeLessThan(200);
    expect(r.text.length).toBe(20_000);
  });
});

// ---------- honesty: never detector-style copy ----------

describe("never sounds like an AI detector", () => {
  /** Every string the checker or its copy can put in a result (not the visitor's own words). */
  function copyStrings(r: Report): string[] {
    return [
      r.verdict?.label ?? "",
      r.verdict?.line ?? "",
      ...r.phrases.flatMap((p) => [p.why, p.how]),
      ...r.facts.flatMap((f) => [f.label, f.question]),
      ...r.tips,
      ...r.notes,
    ];
  }
  const resultCopy = [
    ...Object.values(copy.VERDICT),
    ...Object.values(copy.VERDICT_CHIP),
    ...Object.values(copy.NOTES),
    ...Object.values(copy.FILLER_COPY).flatMap((c) => [c.why, c.how]),
    ...Object.values(copy.HYPE_COPY).flatMap((c) => [c.why, c.how]),
    ...copy.FACTS.flatMap((f) => [f.label, f.question]),
    copy.SAMPLE_LABEL,
    copy.HONESTY.lead,
    copy.HONESTY.rest,
    copy.INTRO,
    ...Object.values(copy.RESULT).flatMap((v) => (typeof v === "string" ? [v] : typeof v === "function" ? [String((v as (...a: unknown[]) => string)(2, false, false))] : Object.values(v))),
    copy.TIPS.wall,
    copy.TIPS.short,
    copy.TIPS.dashes,
    copy.TIPS.longSentences(2),
    copy.TIPS.symbols("\u2192"),
    copy.ANNOUNCE.link("Sounds generic"),
  ];
  const DETECTOR = [/\d\s?%\s*(?:AI|human)/i, /(?:AI|human)[^.]{0,20}\d\s?%/i, /AI-written/i, /\bhuman\b/i, /\bdetected\b/i, /written by (?:AI|a bot|a person)/i];

  it("has no percentage next to 'AI', no 'AI-written', 'human' or 'detected' in any result", () => {
    const strings = [...resultCopy, ...[SAMPLE_TEXT, REWRITE_TEXT, "A premium oil.", "Huile à barbe pour peau sèche, flacon en verre, fabriquée en France avec soin et amour pour vous."].flatMap((t) => copyStrings(checkCopy(t)))];
    for (const s of strings) for (const re of DETECTOR) expect(s, s).not.toMatch(re);
  });

  it("says plainly it isn't an AI detector, right under the form", () => {
    expect(`${copy.HONESTY.lead} ${copy.HONESTY.rest}`).toBe(
      "Not an AI detector. No tool can prove who wrote a piece of text. This check looks for vague patterns and missing facts, whoever wrote it.",
    );
  });
});

// ---------- link mode (readProduct faked) ----------

const readMock = vi.mocked(readProduct);
const PAGE_URL = "https://shop.example/products/cedar-beard-oil";
const product = (over: Record<string, unknown> = {}) => ({ url: PAGE_URL, domain: "shop.example", description: REWRITE_TEXT, descriptionSource: "shopify", ...over }) as any;

describe("readLinkedDescription", () => {
  beforeEach(() => {
    clearCopyCache();
    readMock.mockReset();
  });

  it("reads the description, without the store country lookup", async () => {
    readMock.mockResolvedValue(product());
    expect(await readLinkedDescription(PAGE_URL)).toEqual({
      ok: true,
      product: { url: PAGE_URL, domain: "shop.example", text: REWRITE_TEXT, clipped: false, summaryOnly: false },
    });
    expect(readMock).toHaveBeenCalledWith(PAGE_URL);
  });

  it("knows when readProduct cut the description, or found only the short summary", async () => {
    readMock.mockResolvedValue(product({ description: `${"word ".repeat(296)}more\u2026` }));
    const cut = await readLinkedDescription(PAGE_URL);
    expect(cut.ok && cut.product.clipped).toBe(true);
    clearCopyCache();
    readMock.mockResolvedValue(product({ description: "A short summary.", descriptionSource: "meta" }));
    const meta = await readLinkedDescription(PAGE_URL);
    expect(meta.ok && meta.product).toMatchObject({ clipped: false, summaryOnly: true });
  });

  it("gives one plain sentence when the page can't be read or has no description, never the error", async () => {
    readMock.mockRejectedValue(new Error("getaddrinfo ENOTFOUND shop.example"));
    const gone = await readLinkedDescription(PAGE_URL);
    expect(gone).toEqual({ ok: false, status: 502, error: "We couldn't find a product description on that page. Paste the text instead." });
    expect(JSON.stringify(gone)).not.toContain("ENOTFOUND");
    readMock.mockResolvedValue(product({ description: "  " }));
    expect(await readLinkedDescription(PAGE_URL)).toEqual({ ok: false, status: 400, error: copy.URL_COPY.noDescription });
  });

  it("answers a double submit from its one-minute cache", async () => {
    readMock.mockResolvedValue(product());
    await readLinkedDescription(PAGE_URL);
    await readLinkedDescription(PAGE_URL);
    expect(readMock).toHaveBeenCalledTimes(1);
  });
});

// ---------- the action ----------

function post(fields: Record<string, string>, headers: Record<string, string> = {}, body?: string) {
  const request = new Request("https://usegeo.app/tools/ai-bot-checker", {
    method: "POST",
    body: body ?? new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded", "x-real-ip": "203.0.113.9", ...headers },
  });
  return route.action({ request, params: {}, context: {} } as unknown as ActionFunctionArgs) as unknown as Promise<{
    data: { ok: boolean; intent: string; error?: string; text?: string | null; cut?: boolean; url?: string; product?: any };
    init: ResponseInit | null;
  }>;
}
const headersOf = (r: { init: ResponseInit | null }) => new Headers(r.init?.headers);

describe("the action", () => {
  beforeEach(() => {
    clearCopyCache();
    resetToolLimits();
    readMock.mockReset();
  });
  afterEach(() => resetToolLimits());

  it("reads a product link and sends its description back, with no-store and noindex headers", async () => {
    readMock.mockResolvedValue(product());
    const res = await post({ intent: "fetch", url: "Shop.Example/products/cedar-beard-oil?utm_source=x" });
    expect(res.init?.status ?? 200).toBe(200);
    expect(res.data).toEqual({ ok: true, intent: "fetch", url: "Shop.Example/products/cedar-beard-oil?utm_source=x", product: expect.objectContaining({ text: REWRITE_TEXT, domain: "shop.example" }) });
    expect(readMock).toHaveBeenCalledWith(PAGE_URL); // normalised: https, lower case, tracking dropped
    expect(headersOf(res).get("Cache-Control")).toBe("no-store");
    expect(headersOf(res).get("X-Robots-Tag")).toBe("noindex");
  });

  it("says when there's no description to read (502 when the page can't be read)", async () => {
    readMock.mockRejectedValue(new Error("boom"));
    const res = await post({ intent: "fetch", url: PAGE_URL });
    expect(res.init?.status).toBe(502);
    expect(res.data.error).toBe(copy.URL_COPY.noDescription);
  });

  it("refuses a post from another site (403) and a body that's too big (413)", async () => {
    const cross = await post({ intent: "fetch", url: PAGE_URL }, { "sec-fetch-site": "cross-site" });
    expect(cross.init?.status).toBe(403);
    expect(cross.data.error).toBe(CROSS_SITE_COPY);
    const evil = await post({ intent: "paste", text: "x" }, { origin: "https://evil.example" });
    expect(evil.init?.status).toBe(403);
    const big = await post({}, {}, `intent=paste&text=${"a".repeat(1_100_000)}`);
    expect(big.init?.status).toBe(413);
    expect(big.data.error).toBe(TOO_BIG_COPY);
    expect(readMock).not.toHaveBeenCalled();
  });

  it("gives a filled-in honeypot the normal empty result, with no fetch", async () => {
    expect((await post({ intent: "fetch", url: PAGE_URL, website: "spam.example" })).data).toEqual({ ok: true, intent: "fetch", url: PAGE_URL, product: null });
    expect((await post({ intent: "paste", text: "hello", website: "x" })).data).toEqual({ ok: true, intent: "paste", text: null, cut: false });
    expect(readMock).not.toHaveBeenCalled();
  });

  it("refuses bad links (400): empty, an IP address, localhost, a marketplace", async () => {
    for (const [url, error] of [
      ["", "Please paste a product link, like https://yourstore.com/products/your-product."],
      ["10.0.0.1/products/x", "Please paste a product link, like https://yourstore.com/products/your-product."],
      ["http://localhost/products/x", "Please paste a product link, like https://yourstore.com/products/your-product."],
      ["https://www.amazon.com/dp/B000000000", NOT_YOUR_STORE],
    ] as const) {
      const res = await post({ intent: "fetch", url });
      expect(res.init?.status, url).toBe(400);
      expect(res.data.error, url).toBe(error);
    }
    expect(readMock).not.toHaveBeenCalled();
  });

  it("limits link checks to 20 an hour per visitor (429)", async () => {
    readMock.mockResolvedValue(product({ description: "" }));
    for (let i = 0; i < 20; i++) expect((await post({ intent: "fetch", url: `shop${i}.example/products/x` })).init?.status).toBe(400);
    const over = await post({ intent: "fetch", url: "shop99.example/products/x" });
    expect(over.init?.status).toBe(429);
    expect(over.data.error).toBe(HOUR_COPY);
    expect((await post({ intent: "fetch", url: "shop99.example/products/x" }, { "x-real-ip": "198.51.100.7" })).init?.status).toBe(400);
  });

  it("answers a no-JavaScript paste with the text (the page checks it), up to 20,000 characters", async () => {
    const res = await post({ intent: "paste", text: SAMPLE_TEXT });
    expect(res.data).toEqual({ ok: true, intent: "paste", text: SAMPLE_TEXT, cut: false });
    expect(headersOf(res).get("X-Robots-Tag")).toBe("noindex");
    const long = await post({ intent: "paste", text: "a".repeat(25_000) });
    expect(long.data.text).toHaveLength(20_000);
    expect(long.data.cut).toBe(true);
    expect(readMock).not.toHaveBeenCalled();
  });

  it("limits no-JavaScript pastes to 60 an hour per visitor (429), keeping the text", async () => {
    for (let i = 0; i < 60; i++) expect((await post({ intent: "paste", text: `t${i}` })).data.ok).toBe(true);
    const over = await post({ intent: "paste", text: "mine" });
    expect(over.init?.status).toBe(429);
    expect(over.data).toEqual({ ok: false, intent: "paste", text: "mine", error: HOUR_COPY });
  });
});

// ---------- the page ----------

const callMeta = () => (route.meta as unknown as (a: unknown) => MetaDescriptor[])({ params: {}, location: {}, matches: [], data: undefined, error: undefined });

describe("the page head", () => {
  const list = callMeta();
  const find = (k: string, v: string) => list.find((m) => (m as Record<string, unknown>)[k] === v) as Record<string, string> | undefined;

  it("has the registry title and description, one canonical, Open Graph and Twitter tags, no robots meta", () => {
    expect(list.filter((m) => "title" in m)).toEqual([{ title: "AI Bot Checker for Product Descriptions | GEO" }]);
    expect(TOOL.title.length).toBeLessThan(60);
    expect(find("name", "description")?.content).toBe(TOOL.description);
    expect(TOOL.description.length).toBeLessThan(155);
    const canonicals = list.filter((m) => (m as { rel?: string }).rel === "canonical") as { href: string }[];
    expect(canonicals.map((c) => c.href)).toEqual(["https://usegeo.app/tools/ai-bot-checker"]);
    expect(find("property", "og:url")?.content).toBe("https://usegeo.app/tools/ai-bot-checker");
    expect(find("property", "og:image")?.content).toBe("https://usegeo.app/og/ai-bot-checker.png");
    expect(find("property", "og:image:width")?.content).toBe("1200");
    expect(find("property", "og:image:height")?.content).toBe("630");
    expect(find("name", "twitter:card")?.content).toBe("summary_large_image");
    expect(find("name", "robots")).toBeUndefined();
  });

  it("has one JSON-LD graph with the app (free, no ratings), the page, breadcrumbs, the company and the same FAQs", () => {
    const ld = (list.find((m) => "script:ld+json" in m) as Record<string, unknown>)["script:ld+json"] as { "@graph": Record<string, any>[] };
    expect(ld).toEqual(toolJsonLd(TOOL, copy.FAQS));
    const json = JSON.stringify(ld);
    expect(JSON.parse(json)).toBeTruthy();
    expect(json.length).toBeLessThan(8_000);
    expect(json).not.toMatch(/aggregateRating|"review"/);
    const byType = (t: string) => ld["@graph"].find((n) => n["@type"] === t)!;
    expect(byType("WebApplication").offers.price).toBe("0");
    expect(byType("WebPage").dateModified).toBe(TOOL.updated);
    expect(byType("BreadcrumbList").itemListElement).toHaveLength(3);
    expect(byType("Organization").name).toBe("GEO");
    expect(byType("FAQPage").mainEntity.map((q: any) => [q.name, q.acceptedAnswer.text])).toEqual(copy.FAQS.map((f) => [f.q, f.a]));
  });

  it("links its own stylesheet and uses the shared headers", () => {
    expect(route.links()).toHaveLength(1);
    expect(route.headers).toBe(toolHeaders);
  });
});

function renderPage(actionData?: unknown) {
  const Stub = createRoutesStub([
    {
      id: "tools",
      path: "/tools",
      Component: layout.default as ComponentType,
      children: [{ id: "bot", path: "ai-bot-checker", Component: route.default as ComponentType, action: () => null }],
    },
  ]);
  return renderToStaticMarkup(
    createElement(Stub, {
      initialEntries: ["/tools/ai-bot-checker"],
      ...(actionData ? { hydrationData: { loaderData: {}, actionData: { bot: actionData } } } : {}),
    }),
  );
}

/** The HTML of the result area (between the result section and the button card). */
const resultArea = (out: string) => out.slice(out.indexOf('id="result"'), out.indexOf("tl-cta-card"));
const faqSection = (out: string) => out.slice(out.indexOf('id="faq"'), out.indexOf('id="more-tools"'));

describe("the page (server render, no JavaScript)", () => {
  const out = renderPage();
  const plain = text(out);

  it("has one H1 with the search term, the intro, both forms, the honesty line and the trust line", () => {
    expect(out.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(out).toContain('<h1 class="ck-h1">AI Bot Checker for product descriptions</h1>');
    expect(plain).toContain(copy.INTRO);
    expect(plain.match(/The AI Bot Checker is a free tool/g)).toHaveLength(1);
    expect(out.match(/<form[^>]*method="post"/g)).toHaveLength(2);
    expect(out).toContain('name="text"');
    expect(out).toContain('value="paste"');
    expect(out).toContain('value="fetch"');
    expect(out).toContain('name="url"');
    expect(out).toContain('inputMode="url"');
    expect(out.match(/name="website"/g)).toHaveLength(2); // a honeypot in each form
    expect(plain).toContain(copy.FORM.textLabel);
    expect(plain).toContain(copy.FORM.urlLabel);
    expect(plain).toContain("Check my copy");
    expect(plain).toContain("Not an AI detector. No tool can prove who wrote a piece of text. This check looks for vague patterns and missing facts, whoever wrote it.");
    expect(plain).toContain("Free · No sign-up · Runs in your browser");
    // the form comes before the honesty line, and both before the result
    expect(out.indexOf('name="url"')).toBeLessThan(out.indexOf("Not an AI detector."));
    expect(out.indexOf("Not an AI detector.")).toBeLessThan(out.indexOf('id="result"'));
  });

  it("checks the labelled made-up sample on load: the verdict, the marks, the phrases, the facts, the numbers", () => {
    expect(out).toContain(`>${esc(SAMPLE_TEXT)}</textarea>`);
    const result = resultArea(out);
    const shown = text(result);
    expect(result).toContain(`<span class="ck-chip is-grey">Example</span><span>${esc(copy.SAMPLE_LABEL)}</span>`);
    expect(shown).toContain("Example description (made up)");
    expect(shown).toContain("Sounds generic");
    expect(shown).toContain("Needs work");
    expect(shown).toContain("12 vague phrases, 0 of 7 key facts found.");
    expect(result).toContain(`<mark class="tl-bot-mark is-hype" title="${esc(copy.HYPE_COPY.quality.why)}">premium</mark>`);
    expect(result).toContain('<mark class="tl-bot-mark is-filler"');
    expect(shown).toContain(copy.RESULT.phrasesHeading);
    expect(shown).toContain(copy.HYPE_COPY.quality.how);
    // phrases with the same reason share one row, so the advice shows once
    const heads = [...result.matchAll(/<p class="tl-bot-phrase-head">(.*?)<\/p>/g)].map((m) => [...m[1].matchAll(/<mark[^>]*>([^<]*)<\/mark>|<span class="tl-bot-kind">([^<]*)<\/span>/g)].map((x) => text(x[1] ?? x[2])));
    expect(heads[0]).toEqual(["Elevate your", "game-changer", "unleash", "full potential", "journey", copy.RESULT.kindMany.filler]);
    expect(heads.find((h) => h[0] === "premium")).toEqual(["premium", copy.RESULT.kind.hype]);
    expect(heads).toHaveLength(8);
    expect(shown.split(copy.FILLER_COPY.opener.why)).toHaveLength(2);
    expect(shown).toContain(copy.RESULT.factsHeading);
    for (const f of copy.FACTS) {
      expect(shown).toContain(f.label);
      expect(shown).toContain(f.question);
    }
    expect(shown).toContain("In numbers");
    expect(shown).toContain(copy.TIPS.short);
    expect(shown).toContain("Example rewrite (made up)");
    expect(shown).toContain(REWRITE_TEXT);
    expect(result).not.toContain("dangerouslySetInnerHTML");
  });

  it("never shows detector-style words in the result", () => {
    const shown = text(resultArea(out));
    expect(shown).not.toMatch(/\d\s?%|AI-written|\bhuman\b|\bdetected\b/i);
  });

  it("has exactly one button under the result, with the spec's words and link", () => {
    expect(out.match(/tl-cta"/g)).toHaveLength(1);
    expect(out).toMatch(/<a class="ck-btn ck-btn-dark tl-cta" href="\/\?ref=tool-ai-bot-checker#how">See how GEO rewrites product pages with your facts/);
    expect(out.indexOf('id="result"')).toBeLessThan(out.indexOf("tl-cta-card"));
    expect(out.indexOf("tl-cta-card")).toBeLessThan(out.indexOf('id="what-it-checks"'));
  });

  it("has what it checks, how it works, visible FAQs, more tools, the date and the footer", () => {
    for (const item of copy.WHAT_IT_CHECKS) expect(plain).toContain(item);
    for (const item of copy.HOW_IT_WORKS) expect(plain).toContain(item.text);
    expect(out).toContain('href="https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers"');
    expect(plain).toContain("Maintained by GEO. Updated 11 October 2026.");
    for (const f of copy.FAQS) {
      expect(out).toContain(`<h3 class="ck-h3">${esc(f.q)}</h3>`);
      expect(plain).toContain(f.a);
    }
    expect(faqSection(out)).not.toMatch(/<details|\shidden[\s>=]/);
    for (const s of TOOL.related) expect(out).toContain(`<a href="${toolBySlug(s).path}">${toolBySlug(s).name}</a>`);
    expect(plain).toContain("Updated 11 October 2026 · Made by GEO");
    expect(out).toContain('class="tl-foot"');
    expect(out).toContain('href="/tools"');
    for (const t of TOOLS) expect(out).toContain(`href="${t.path}"`);
  });

  it("shows a no-JavaScript paste result in place of the sample", () => {
    const page = renderPage({ ok: true, intent: "paste", text: REWRITE_TEXT, cut: false });
    const shown = text(resultArea(page));
    expect(page).toContain(`>${esc(REWRITE_TEXT)}</textarea>`);
    expect(shown).not.toContain(copy.SAMPLE_LABEL);
    expect(shown).toContain("Specific and clear");
    expect(shown).toContain("0 vague phrases, 5 of 7 key facts found.");
    expect(shown).toContain(copy.RESULT.textNone);
    expect(shown).toContain("We found: “30 ml”");
    const cut = text(resultArea(renderPage({ ok: true, intent: "paste", text: "a premium oil", cut: true })));
    expect(cut).toContain(copy.NOTES.cut);
    const empty = text(resultArea(renderPage({ ok: true, intent: "paste", text: "", cut: false })));
    expect(empty).toContain(copy.RESULT.empty);
    expect(empty).not.toContain("Sounds generic");
  });

  it("shows a product link's description in the box, with where it came from", () => {
    const linked = { url: PAGE_URL, domain: "shop.example", text: REWRITE_TEXT, clipped: true, summaryOnly: false };
    const page = renderPage({ ok: true, intent: "fetch", url: "shop.example/products/cedar-beard-oil", product: linked });
    expect(page).toContain(`>${esc(REWRITE_TEXT)}</textarea>`);
    expect(page).toContain('value="shop.example/products/cedar-beard-oil"');
    const shown = text(resultArea(page));
    expect(shown).toContain("We checked the first 1,500 characters of the description on shop.example.");
    expect(shown).toContain("Specific and clear");
    const longLine = `${"This oil is light and soft on skin. ".repeat(20)}Made in Melbourne.`;
    const flatPage = text(resultArea(renderPage({ ok: true, intent: "fetch", url: "x", product: { ...linked, text: longLine } })));
    expect(flatPage).toContain("We checked the first 1,500 characters");
    expect(flatPage).not.toContain(copy.TIPS.wall); // the page's paragraphs were lost on the way, not missing
    expect(text(resultArea(renderPage({ ok: true, intent: "paste", text: longLine, cut: false })))).toContain(copy.TIPS.wall);
    const summary = text(resultArea(renderPage({ ok: true, intent: "fetch", url: "x", product: { ...linked, clipped: false, summaryOnly: true } })));
    expect(summary).toContain("We only found the short summary on shop.example, not the full description.");
  });

  it("shows errors next to their form, and no result for a paste that hit the limit", () => {
    const bad = renderPage({ ok: false, intent: "fetch", url: "amazon.com/dp/x", error: NOT_YOUR_STORE });
    expect(bad).toContain('role="alert"');
    expect(text(bad)).toContain(NOT_YOUR_STORE);
    expect(bad).toContain('value="amazon.com/dp/x"');
    expect(text(resultArea(bad))).toContain("Sounds generic"); // the sample stays

    const limited = renderPage({ ok: false, intent: "paste", text: "my own text", error: HOUR_COPY });
    expect(limited).toContain('role="alert"');
    expect(text(limited)).toContain(HOUR_COPY);
    expect(limited).toContain(">my own text</textarea>");
    expect(text(resultArea(limited))).toContain(copy.RESULT.blocked);
    expect(text(resultArea(limited))).not.toContain("In numbers");
  });
});

// ---------- copy rules ----------

describe("copy rules", () => {
  const files = [
    "app/lib/tools/copy/ai-bot-checker.ts",
    "app/lib/tools/copy-check.ts",
    "app/lib/tools/copy-check.server.ts",
    "app/lib/tools/samples/copy-sample.ts",
    "app/components/tools/copy-result.tsx",
    "app/routes/tools.ai-bot-checker.tsx",
    "app/styles/tool-copy.css",
  ];

  it("has 4 to 6 FAQs, each with a source except our own advice", () => {
    expect(copy.FAQS.length).toBeGreaterThanOrEqual(4);
    expect(copy.FAQS.length).toBeLessThanOrEqual(6);
    expect(copy.FAQS.filter((f) => !f.sources?.length).map((f) => f.q)).toEqual(["What should a good product description include?"]);
  });

  it("has no em dash (the pattern list writes it as \\u2014), no spaced en dash and no jargon", () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(/\u2014/);
      expect(src, f).not.toMatch(/\s\u2013\s/);
      expect(src, f).not.toMatch(/AEO| LLM|generative engine optimization/i);
    }
    expect(read("app/lib/tools/copy-check.ts")).toContain("\\u2014");
    for (const page of [renderPage(), renderPage({ ok: true, intent: "paste", text: REWRITE_TEXT, cut: false })]) {
      const shown = text(page);
      expect(shown).not.toMatch(/\u2014|\s\u2013\s/);
      expect(shown).not.toMatch(/\bAEO\b| LLM|generative engine optimization/);
      expect(shown.match(/\bGEO\b/g)?.length).toBeGreaterThan(0);
    }
  });

  it("never promises that better copy gets anyone recommended", () => {
    const all = JSON.stringify(copy);
    expect(all).not.toMatch(/guarantee|will get you recommended|boost your ranking|rank higher/i);
  });
});
