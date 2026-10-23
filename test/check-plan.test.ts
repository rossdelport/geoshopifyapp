import { describe, expect, it } from "vitest";
import { buildActionPlan, sitesToPitch, type PlanInput } from "../app/lib/check-plan";
import { buildReport } from "../app/lib/check-report";
import type { CheckAnswer } from "../app/lib/check-types";
import { sampleAnswers, sampleProduct, sampleQuestions, sampleReport } from "./fixtures/check-sample";

const INSTALL = "https://geo.test/#waitlist";
const input = (o: Partial<PlanInput> = {}): PlanInput => ({
  product: sampleProduct,
  questions: sampleQuestions,
  answers: sampleAnswers,
  report: sampleReport,
  joinUrl: INSTALL,
  ...o,
});
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

describe("buildActionPlan", () => {
  const plan = buildActionPlan(input());

  it("orders the steps: page fixes, lost questions, sites, rivals, then GEO", () => {
    expect(plan.steps.map((s) => s.kind)).toEqual(["page", "questions", "sites", "rivals", "geo"]);
  });

  it("lists each failed page check with its fix, the heaviest first", () => {
    const page = plan.steps[0];
    expect(page.body).toContain("40 out of 100");
    expect(page.items.map((i) => i.label)).toEqual(["Says who it’s for", "Key facts near the top", "Description is specific", "Has questions and answers"]);
    expect(page.items[0].fix).toMatch(/^Add one plain line on who it suits/);
    expect(page.items[1].fix).toMatch(/^Start the description with one or two sentences/);
    expect(page.items[2].detail).toBe("The description is only 24 characters.");
  });

  it("lists the questions AI left the brand out of, with the brands it picked instead", () => {
    const q = plan.steps.find((s) => s.kind === "questions")!;
    expect(q.items.map((i) => i.label)).toEqual([sampleQuestions[0].text, sampleQuestions[1].text]); // Q3 was a win
    expect(q.items[0].detail).toBe(
      "Not named in any of the 6 answers. AI picked Tūī Botanicals in 6 answers, Café Lip Co in 4 and Harbour & Fern in 2.",
    );
    // Named on ChatGPT only; the empty Perplexity answer doesn't count.
    expect(q.items[1].detail).toBe(
      "Named in 2 of 5 answers. Missing on Gemini and Perplexity. AI picked Café Lip Co in 5 answers, Tūī Botanicals in 2 and Harbour & Fern in 2.",
    );
  });

  it("lists the review sites AI cited with the articles it linked, most cited first, never a rival's blog or your own site", () => {
    const sites = plan.steps.find((s) => s.kind === "sites")!;
    expect(sites.items.map((i) => i.label)).toEqual(["bestpicks.co.nz", "glowjournal.co.nz"]);
    expect(sites.items[0].detail).toBe("Cited in 8 answers.");
    expect(sites.items[0].urls).toEqual([
      "https://www.bestpicks.co.nz/beauty/best-lip-balm-nz",
      "https://www.bestpicks.co.nz/beauty/manuka-skincare-guide",
    ]);
    expect(JSON.stringify(sites)).not.toContain("tuibotanicals");
    expect(JSON.stringify(sites)).not.toContain("kowhaiandco");
    expect(JSON.stringify(sites)).not.toContain("reddit"); // forums are not pitch targets
  });

  it("lists every rival the report names, with counts", () => {
    const rivals = plan.steps.find((s) => s.kind === "rivals")!;
    expect(rivals.items).toEqual(sampleReport.competitors.map((c) => ({ label: c.name, detail: `Named in ${c.count} of ${sampleReport.answerCount} answers.` })));
  });

  it("ends with GEO: the waitlist link and the price", () => {
    const geo = plan.steps.at(-1)!;
    expect(geo.title).toBe("Let GEO do this for you");
    expect(geo.items[0]).toEqual({ label: "Join the GEO waitlist", detail: "Done for you is A$1,000 a month. We’ll reach out shortly.", urls: [INSTALL] });
  });

  it("says what the plan holds, for the page's locked teaser", () => {
    expect(plan.teaser).toEqual({ steps: 5, pageFixes: 4, sitesToPitch: 2, rivalsToStudy: sampleReport.competitors.length });
  });

  it("never repeats a tip a step already covers", () => {
    expect(sampleReport.tips.length).toBeGreaterThan(1); // the report had tips; the steps cover all of them
    expect(plan.steps.filter((s) => s.kind === "tip")).toEqual([]);
  });

  it("keeps the report's tips when there is no page check (older reports)", () => {
    const older = buildReport(sampleAnswers, { ...sampleProduct, hasProductSchema: false }, ["Kōwhai & Co"], { descriptionSource: "shopify", pageRead: true });
    const p = buildActionPlan(input({ report: older }));
    expect(p.steps[0].kind).toBe("tip");
    expect(p.steps.filter((s) => s.kind === "tip").map((s) => s.title)).toEqual(["Write a fuller product description", "Add product data AI can read"]);
    expect(p.teaser.pageFixes).toBe(0);
    expect(p.teaser.steps).toBe(p.steps.length);
  });

  it("only names brands the report lists", () => {
    const answers: CheckAnswer[] = sampleAnswers.map((a) => (a.question === 0 ? { ...a, brands: ["Made In NZ", ...a.brands] } : a));
    const p = buildActionPlan(input({ answers }));
    expect(JSON.stringify(p)).not.toContain("Made In NZ");
  });

  it("skips the questions step when every answer named the brand", () => {
    const answers = sampleAnswers.map((a) => ({ ...a, named: true, position: 1, brands: ["Kōwhai & Co", ...a.brands] }));
    const report = buildReport(answers, sampleProduct, ["Kōwhai & Co"], {});
    expect(buildActionPlan(input({ answers, report })).steps.map((s) => s.kind)).not.toContain("questions");
  });

  it("uses the report's sites and example links when the answers are gone", () => {
    const sites = sitesToPitch({ product: sampleProduct, answers: [], report: sampleReport });
    expect(sites.map((s) => s.domain)).toEqual(["bestpicks.co.nz", "glowjournal.co.nz"]);
    expect(sites[0].urls).toEqual([sampleReport.sources.find((s) => s.domain === "bestpicks.co.nz")!.exampleUrl]);
  });

  it("caps the sites at 8 and the links at 2 per site", () => {
    const many: CheckAnswer[] = Array.from({ length: 6 }, (_, run) => ({
      ...sampleAnswers[0],
      run,
      sources: Array.from({ length: 10 }, (_, i) => ({
        url: `https://site${i}.com/best-lip-balm-${run}`,
        domain: `site${i}.com`,
        title: null,
        type: "editorial" as const,
        isOwn: false,
      })),
    }));
    const sites = sitesToPitch({ product: sampleProduct, answers: many, report: sampleReport });
    expect(sites).toHaveLength(8);
    expect(sites.every((s) => s.urls.length === 2)).toBe(true);
  });

  it("never uses an em dash or a spaced en dash", () => {
    const text = JSON.stringify(plan);
    expect(text).not.toContain(EM_DASH);
    expect(text).not.toContain(` ${EN_DASH} `);
  });
});
