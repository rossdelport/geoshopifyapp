import { describe, expect, it } from "vitest";
import { buildActionPlan } from "../app/lib/check-plan";
import { buildCheckPdf, noDashes, printable, reportFileName, type PdfReportInput } from "../app/lib/check-pdf.server";
import { sampleAnswers, sampleProduct, sampleQuestions, sampleReport } from "./fixtures/check-sample";

const INSTALL = "https://geo.test/auth/login?shop=kowhai-and-co.myshopify.com";
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

function pdfInput(o: Partial<PdfReportInput> = {}): PdfReportInput {
  const product = o.product ?? sampleProduct;
  const report = o.report ?? sampleReport;
  return {
    product,
    country: "NZ",
    createdAt: "2026-10-11T00:00:00.000Z",
    questions: sampleQuestions,
    answers: sampleAnswers,
    report,
    plan: buildActionPlan({ product, questions: sampleQuestions, answers: sampleAnswers, report, installUrl: INSTALL }),
    installUrl: INSTALL,
    checkUrl: "https://geo.test/check/abc",
    ...o,
  };
}

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page\b(?!s)/g) ?? []).length;

describe("buildCheckPdf", () => {
  it("makes the same bytes every time for the same check (so a retry reuses Resend's idempotency key)", async () => {
    const input = pdfInput({ finishedAt: "2026-10-11T00:05:00.000Z" });
    const a = await buildCheckPdf(input);
    await new Promise((r) => setTimeout(r, 1100)); // a second later: "now" would differ
    const b = await buildCheckPdf(input);
    expect(a.equals(b)).toBe(true);
    expect(a.toString("latin1")).toContain("D:20261011000500Z"); // the check's finish time, not "now"
  });

  it("builds a 2 to 4 page PDF named after the product, with Geist embedded", async () => {
    const pdf = await buildCheckPdf(pdfInput({ product: { ...sampleProduct, title: "Manuka Honey Lip Balm 15g" } }));
    const raw = pdf.toString("latin1");
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(pdf.length).toBeGreaterThan(10_000);
    expect(raw).toContain("GEO free product check: Manuka Honey Lip Balm 15g"); // the document title
    expect(raw).toContain("Geist"); // the embedded font (accents and curly quotes)
    expect(raw).toContain("/FontFile2");
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(2);
    expect(pageCount(pdf)).toBeLessThanOrEqual(4);
    expect(raw).toContain("/URI (https://geo.test/auth/login?shop=kowhai-and-co.myshopify.com)"); // the trial button is a link
  });

  it("copes with accents, curly quotes, dashes and an older report with no page checks", async () => {
    const { aiReady: _drop, ...older } = sampleReport;
    void _drop;
    const report = { ...older, summary: `Café Lip Co ${EM_DASH} a rival ${EM_DASH} came up most. “Quoted” ‘text’.` };
    const pdf = await buildCheckPdf(pdfInput({ report, country: null }));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("PDF text", () => {
  it("drops em dashes and spaced en dashes", () => {
    expect(noDashes(`Milkman ${EM_DASH} light and easy`)).toBe("Milkman, light and easy");
    expect(noDashes(`Milkman${EM_DASH}light`)).toBe("Milkman, light");
    expect(noDashes(`Best oils ${EN_DASH} 2026`)).toBe("Best oils, 2026");
    expect(noDashes("Ages 3–5")).toBe("Ages 3–5"); // an unspaced en dash in a range stays
  });

  it("swaps characters the font lacks for their plain letter, and drops the rest", () => {
    const latin1 = (cp: number) => cp >= 0x20 && cp <= 0xff;
    const nbsp = String.fromCharCode(0xa0);
    const zwsp = String.fromCharCode(0x200b);
    const honey = String.fromCodePoint(0x1f36f);
    expect(printable(`K\u014dwhai${nbsp}&${zwsp} Co`, latin1)).toBe("Kowhai & Co");
    expect(printable(`Caf\u00e9 ${honey} balm`, latin1)).toBe("Caf\u00e9 balm");
  });

  it("makes a safe file name from the brand", () => {
    expect(reportFileName("Kōwhai & Co")).toBe("GEO-report-Kowhai-Co.pdf");
    expect(reportFileName("***")).toBe("GEO-report-product.pdf");
  });
});
