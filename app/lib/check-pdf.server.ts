// Free product check: the full report as a PDF (emailed by the "check.email" job, see check-lead.server.ts).
// Pure JS (pdfkit), no browser. A4, 2 to 4 pages, in the site's lilac and cobalt look.
// The action plan comes from check-plan.ts; everything else is what the check saw.

import { readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { sameBrand } from "./match";
import { ENGINE_LABELS, OFFER, OFFER_PRICE } from "./plans";
import { SCORE_EXPLAINER } from "./score";
import { SOURCE_TYPE_LABELS } from "./sources";
import { countryDateStyle } from "./countries";
import type { ActionPlan, PlanStep } from "./check-plan";
import {
  CHECK_COUNTRIES,
  CHECK_ENGINES,
  type CheckAnswer,
  type CheckCountry,
  type CheckEngine,
  type CheckProduct,
  type CheckQuestion,
  type CheckReport,
} from "./check-types";

export interface PdfReportInput {
  product: CheckProduct;
  country: CheckCountry | null;
  createdAt: Date | string; // when the check ran
  finishedAt?: Date | string | null; // when it finished: the PDF's creation date, so every retry makes the same bytes
  questions: CheckQuestion[];
  answers: CheckAnswer[];
  report: CheckReport; // the full report (aiReady fixes included)
  plan: ActionPlan;
  joinUrl: string; // absolute
  checkUrl?: string | null; // absolute link to the report on the website
}

// ---------- Look ----------

const C = {
  navy: "#0b0c2b",
  indigo: "#15163c",
  text: "#30313d",
  soft: "#5c5d78",
  muted: "#7a7b90",
  lilac: "#efecfd",
  lilac2: "#e2e2fc",
  lav: "#f6f4fe",
  line: "#e4e0f8",
  peri: "#bfc9fa",
  logo: "#9faaf2",
  cobalt: "#4050b0",
  mid: "#6878d8",
  green: "#167a43",
  greenBg: "#e9f9ee",
  red: "#ab3434",
  redBg: "#fdecec",
  white: "#ffffff",
  onDark: "#c9cbe6",
};
const ENGINE_COLORS: Record<CheckEngine, string> = { chatgpt: "#10a37f", gemini: "#4f7cff", perplexity: "#20808d" };

const W = 595.28; // A4 in points
const H = 841.89;
const M = 44; // side margin
const CW = W - M * 2; // content width
const BOTTOM = H - 58; // content stops here; the footer sits below
const TOP_NEXT = 70; // content top on pages after the first

// Geist (SIL Open Font License, app/assets/fonts/OFL.txt) covers accents like ō and é and curly quotes.
// Without the files, the PDF falls back to Helvetica and plain characters.
const FONT_DIRS = [path.join(process.cwd(), "app", "assets", "fonts")];
let fontFiles: { regular: Buffer; semibold: Buffer } | null | undefined;
function loadFonts() {
  if (fontFiles !== undefined) return fontFiles;
  fontFiles = null;
  for (const dir of FONT_DIRS) {
    try {
      fontFiles = { regular: readFileSync(path.join(dir, "Geist-Regular.ttf")), semibold: readFileSync(path.join(dir, "Geist-SemiBold.ttf")) };
      break;
    } catch {
      /* try the next place */
    }
  }
  if (!fontFiles) console.warn("[check-pdf] Geist fonts not found, using Helvetica");
  return fontFiles;
}

// ---------- Text ----------

/** House style: no em dashes or spaced en dashes in anything we print (AI text included). */
export function noDashes(s: string): string {
  return s
    .replace(/\s*\u2014\s*/g, ", ")
    .replace(/\s+\u2013\s+/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/^,\s*/, "");
}

const WIN_ANSI = /[\x20-\x7e\xa0-\xff\u2018\u2019\u201c\u201d\u2013\u2026\u2022\u20ac\u2122]/;

type GlyphCheck = (codePoint: number) => boolean;

/** Text the font can draw: dashes fixed, odd spaces made plain, letters it lacks swapped for their base letter or dropped. */
export function printable(raw: string, hasGlyph: GlyphCheck): string {
  const s = noDashes(String(raw ?? ""))
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, "")
    .replace(/[\s\u00a0\u2000-\u200a\u202f\u205f\u3000]+/g, " ")
    .replace(/[\u2010\u2011\u2012\u2212]/g, "-");
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x20) continue;
    if (hasGlyph(cp)) {
      out += ch;
      continue;
    }
    const base = ch.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    out += [...base].every((b) => hasGlyph(b.codePointAt(0)!)) ? base : "";
  }
  return out.replace(/ {2,}/g, " ").trim();
}

const shortUrl = (u: string, max = 72) => {
  const s = u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  return s.length > max ? `${s.slice(0, max - 1)}\u2026` : s;
};

// The report date as a shopper in that country writes it ("October 11, 2026" in the US, Canada and the
// Philippines, "11 October 2026" elsewhere), in that country's main time zone; UTC when we don't know it.
function longDate(d: Date, country: CheckCountry | null): string {
  const { locale, timeZone } = countryDateStyle(country);
  return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone });
}

// ---------- Drawing ----------

type FontKey = "body" | "bold";

class Pdf {
  doc: PDFKit.PDFDocument;
  y = 0;
  private embedded: boolean;
  private glyphs: Record<FontKey, GlyphCheck>;
  private header: string;

  constructor(title: string, header: string, created: Date) {
    const fonts = loadFonts();
    this.embedded = Boolean(fonts);
    this.header = header;
    this.doc = new PDFDocument({
      size: "A4",
      margins: { top: M, bottom: H - BOTTOM, left: M, right: M },
      bufferPages: true,
      autoFirstPage: true,
      // A fixed creation date (pdfkit would use "now" and build the file ID from it), so the same check always
      // makes the same bytes: a retry then reuses Resend's idempotency key without a 409 (check-lead.server.ts).
      info: { Title: title, Author: "GEO", Subject: "Free product check: does AI recommend this product?", Creator: "GEO", CreationDate: created },
    });
    const winAnsi: GlyphCheck = (cp) => WIN_ANSI.test(String.fromCodePoint(cp));
    if (fonts) {
      this.doc.registerFont("body", fonts.regular);
      this.doc.registerFont("bold", fonts.semibold);
      this.glyphs = { body: this.glyphCheck("body", winAnsi), bold: this.glyphCheck("bold", winAnsi) };
    } else {
      this.doc.registerFont("body", "Helvetica");
      this.doc.registerFont("bold", "Helvetica-Bold");
      this.glyphs = { body: winAnsi, bold: winAnsi };
    }
    this.doc.font("body");
  }

  /** The embedded font's own glyph list (pdfkit keeps the parsed font on the document); WinAnsi if it can't be read. */
  private glyphCheck(key: FontKey, fallback: GlyphCheck): GlyphCheck {
    this.doc.font(key);
    const parsed = (this.doc as unknown as { _font?: { font?: { hasGlyphForCodePoint?: (cp: number) => boolean } } })._font?.font;
    const has = parsed?.hasGlyphForCodePoint?.bind(parsed);
    return has ? (cp) => cp === 0x20 || has(cp) : fallback;
  }

  t(s: string, key: FontKey = "body"): string {
    return printable(s, this.glyphs[key]);
  }

  use(key: FontKey, size: number, color: string) {
    this.doc.font(key).fontSize(size).fillColor(color);
    return this;
  }

  height(s: string, key: FontKey, size: number, width: number, lineGap = 2): number {
    this.doc.font(key).fontSize(size);
    return this.doc.heightOfString(this.t(s, key), { width, lineGap });
  }

  /** Write a block of text at (x, this.y or y). Returns its height. Does not move this.y. */
  write(s: string, x: number, y: number, opts: { key?: FontKey; size?: number; color?: string; width?: number; lineGap?: number; align?: "left" | "right" | "center"; link?: string; underline?: boolean } = {}): number {
    const key = opts.key ?? "body";
    const size = opts.size ?? 10;
    const width = opts.width ?? CW;
    const text = this.t(s, key);
    if (!text) return 0;
    this.use(key, size, opts.color ?? C.text);
    const h = this.doc.heightOfString(text, { width, lineGap: opts.lineGap ?? 2 });
    this.doc.text(text, x, y, { width, lineGap: opts.lineGap ?? 2, align: opts.align ?? "left", link: opts.link, underline: opts.underline, lineBreak: true });
    return h;
  }

  /** Room for `h` more points on this page, or a new page. */
  ensure(h: number) {
    if (this.y + h <= BOTTOM) return;
    this.doc.addPage();
    this.drawRunningHeader();
    this.y = TOP_NEXT;
  }

  logo(x: number, y: number, size: number) {
    const k = size / 40;
    this.doc.save();
    this.doc.circle(x + 13.5 * k, y + 13.5 * k, 13.5 * k).fill(C.logo);
    this.doc.circle(x + 26.5 * k, y + 26.5 * k, 13.5 * k).fill(C.cobalt);
    this.doc.restore();
  }

  private drawRunningHeader() {
    this.logo(M, 28, 16);
    this.write(this.header.length > 95 ? `${this.header.slice(0, 94).trimEnd()}\u2026` : this.header, M + 24, 30, { size: 8.5, color: C.muted, width: CW - 24 });
    this.doc.save().moveTo(M, 52).lineTo(W - M, 52).lineWidth(0.6).strokeColor(C.line).stroke().restore();
  }

  ring(cx: number, cy: number, r: number, width: number, pct: number) {
    const d = this.doc;
    d.save();
    d.lineWidth(width).strokeColor(C.lilac2).circle(cx, cy, r).stroke();
    const p = Math.max(0, Math.min(100, pct));
    if (p >= 99.5) {
      d.lineWidth(width).strokeColor(C.cobalt).circle(cx, cy, r).stroke();
    } else if (p > 0) {
      const start = -Math.PI / 2;
      const end = start + (p / 100) * Math.PI * 2;
      const sx = cx + r * Math.cos(start);
      const sy = cy + r * Math.sin(start);
      const ex = cx + r * Math.cos(end);
      const ey = cy + r * Math.sin(end);
      d.path(`M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${p > 50 ? 1 : 0} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`)
        .lineWidth(width)
        .lineCap("round")
        .strokeColor(C.cobalt)
        .stroke();
    }
    d.restore();
  }

  bar(x: number, y: number, w: number, h: number, share: number, color: string) {
    const d = this.doc;
    d.save();
    d.roundedRect(x, y, w, h, h / 2).fill(C.lilac2);
    const fill = Math.max(0, Math.min(1, share)) * w;
    if (fill > 0) d.roundedRect(x, y, Math.max(fill, h), h, h / 2).fill(color);
    d.restore();
  }

  mark(cx: number, cy: number, pass: boolean) {
    const d = this.doc;
    d.save();
    d.circle(cx, cy, 7).fill(pass ? C.greenBg : C.redBg);
    d.lineWidth(1.5).lineCap("round").lineJoin("round").strokeColor(pass ? C.green : C.red);
    if (pass) d.moveTo(cx - 3.2, cy + 0.2).lineTo(cx - 0.8, cy + 2.6).lineTo(cx + 3.4, cy - 2.4).stroke();
    else d.moveTo(cx - 2.6, cy - 2.6).lineTo(cx + 2.6, cy + 2.6).moveTo(cx + 2.6, cy - 2.6).lineTo(cx - 2.6, cy + 2.6).stroke();
    d.restore();
  }

  badge(cx: number, cy: number, n: number) {
    this.doc.save().circle(cx, cy, 9).fill(C.cobalt).restore();
    this.write(String(n), cx - 9, cy - 5.6, { key: "bold", size: 9, color: C.white, width: 18, align: "center", lineGap: 0 });
  }

  dot(cx: number, cy: number, color: string, r = 3.2) {
    this.doc.save().circle(cx, cy, r).fill(color).restore();
  }

  card(x: number, y: number, w: number, h: number, fill = C.white) {
    this.doc.save().roundedRect(x, y, w, h, 12).lineWidth(0.8).fillAndStroke(fill, C.line).restore();
  }

  /** A section heading, kept on the same page as the section's first block (`next` points tall). */
  section(title: string, intro?: string, next = 40) {
    const introH = intro ? this.height(intro, "body", 9.5, CW) + 6 : 4;
    this.ensure(6 + this.height(title, "bold", 14, CW) + 4 + introH + next);
    this.y += 6;
    this.y += this.write(title, M, this.y, { key: "bold", size: 14, color: C.navy }) + 4;
    if (intro) this.y += this.write(intro, M, this.y, { size: 9.5, color: C.soft }) + 6;
    else this.y += 4;
  }

  footers() {
    const range = this.doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);
      const keep = this.doc.page.margins.bottom;
      this.doc.page.margins.bottom = 0; // writing below the margin must not start a new page
      this.doc.save().moveTo(M, H - 42).lineTo(W - M, H - 42).lineWidth(0.6).strokeColor(C.line).stroke().restore();
      this.write("GEO, for Shopify stores worldwide", M, H - 34, { size: 8, color: C.muted, width: CW - 80 });
      this.write(`Page ${i - range.start + 1} of ${range.count}`, W - M - 80, H - 34, { size: 8, color: C.muted, width: 80, align: "right" });
      this.doc.page.margins.bottom = keep;
    }
  }

  async finish(): Promise<Buffer> {
    this.footers();
    const chunks: Buffer[] = [];
    return new Promise<Buffer>((resolve, reject) => {
      this.doc.on("data", (c: Buffer) => chunks.push(c));
      this.doc.on("end", () => resolve(Buffer.concat(chunks)));
      this.doc.on("error", reject);
      this.doc.end();
    });
  }
}

// ---------- The report ----------

function drawTop(pdf: Pdf, input: PdfReportInput) {
  const { product, country } = input;
  const titleH = pdf.height(product.title, "bold", 20, CW, 1);
  const where = country ? ` as a shopper in ${CHECK_COUNTRIES[country]}` : "";
  const checked = `Checked on ${longDate(new Date(input.createdAt), country)} on ChatGPT, Gemini and Perplexity${where}. 3 buying questions, each asked twice.`;
  const checkedH = pdf.height(checked, "body", 9.5, CW);
  const bandH = 92 + titleH + 18 + checkedH + 22;
  const d = pdf.doc;
  d.save();
  d.rect(0, 0, W, bandH).fill(d.linearGradient(0, 0, 0, bandH).stop(0, C.lilac).stop(0.6, C.lilac2).stop(1, "#d6dbfb"));
  d.restore();

  pdf.logo(M, 30, 24);
  pdf.write("GEO", M + 32, 33, { key: "bold", size: 16, color: C.navy, width: 80 });
  const pill = "Free product check";
  pdf.use("bold", 9, C.cobalt);
  const pillW = d.widthOfString(pdf.t(pill, "bold")) + 22;
  d.save().roundedRect(W - M - pillW, 31, pillW, 22, 11).fill(C.white).restore();
  pdf.write(pill, W - M - pillW, 37.5, { key: "bold", size: 9, color: C.cobalt, width: pillW, align: "center", lineGap: 0 });

  let y = 86;
  y += pdf.write(product.title, M, y, { key: "bold", size: 20, color: C.navy, lineGap: 1 }) + 4;
  pdf.write(`${product.brand}  \u00b7  ${product.domain}`, M, y, { size: 10.5, color: C.soft });
  y += 18;
  pdf.write(checked, M, y, { size: 9.5, color: C.soft });
  pdf.y = bandH + 22;
}

function drawScore(pdf: Pdf, input: PdfReportInput) {
  const { report, product } = input;
  const left = 132; // ring column
  const rx = M + left;
  const rw = CW - left - 18;
  const heading = `AI named ${product.brand} in ${report.namedCount} of ${report.answerCount} answers`;
  const headH = pdf.height(heading, "bold", 13.5, rw, 1);
  const sumH = report.summary ? pdf.height(report.summary, "body", 9.5, rw) : 0;
  const rowsH = CHECK_ENGINES.length * 20;
  const inner = Math.max(118, headH + 6 + sumH + 12 + rowsH);
  const h = inner + 36;
  pdf.ensure(h + 40);
  const top = pdf.y;
  pdf.card(M, top, CW, h);

  const cx = M + left / 2 + 4;
  const cy = top + 18 + 52;
  pdf.ring(cx, cy, 42, 10, report.score);
  pdf.write(String(report.score), cx - 40, cy - 15, { key: "bold", size: 26, color: C.navy, width: 80, align: "center", lineGap: 0 });
  pdf.write("out of 100", cx - 40, cy + 13, { size: 7.5, color: C.muted, width: 80, align: "center", lineGap: 0 });
  pdf.write(report.label, cx - 60, cy + 52, { key: "bold", size: 10, color: C.cobalt, width: 120, align: "center" });

  let y = top + 18;
  y += pdf.write(heading, rx, y, { key: "bold", size: 13.5, color: C.navy, width: rw, lineGap: 1 }) + 6;
  if (report.summary) y += pdf.write(report.summary, rx, y, { size: 9.5, color: C.soft, width: rw }) + 12;
  for (const e of CHECK_ENGINES) {
    const s = report.byEngine[e];
    pdf.dot(rx + 3, y + 6, ENGINE_COLORS[e]);
    pdf.write(ENGINE_LABELS[e], rx + 12, y, { key: "bold", size: 9.5, color: C.navy, width: 80 });
    pdf.bar(rx + 92, y + 3, rw - 92 - 110, 7, s.total ? s.named / s.total : 0, ENGINE_COLORS[e]);
    pdf.write(s.total ? `named in ${s.named} of ${s.total}` : "no answers this time", rx + rw - 104, y, { size: 9, color: C.soft, width: 104, align: "right" });
    y += 20;
  }
  pdf.y = top + h + 8;
  pdf.y += pdf.write(SCORE_EXPLAINER, M, pdf.y, { size: 8, color: C.muted }) + 4;
}

function drawRivals(pdf: Pdf, input: PdfReportInput) {
  const { report } = input;
  pdf.section("Who AI recommends instead", "The brands AI named in these answers, and how often. Each brand counts once per answer.");
  if (!report.competitors.length) {
    pdf.y += pdf.write("AI didn’t name another brand for these questions.", M, pdf.y, { size: 10, color: C.soft }) + 8;
    return;
  }
  const nameW = 170;
  for (const c of report.competitors) {
    pdf.ensure(22);
    pdf.write(c.name, M, pdf.y, { key: "bold", size: 10, color: C.navy, width: nameW - 8 });
    pdf.bar(M + nameW, pdf.y + 3.5, CW - nameW - 120, 8, report.answerCount ? c.count / report.answerCount : 0, C.mid);
    pdf.write(`in ${c.count} of ${report.answerCount} answers`, W - M - 112, pdf.y, { size: 9, color: C.soft, width: 112, align: "right" });
    pdf.y += 19;
  }
  pdf.y += 4;
}

function drawSources(pdf: Pdf, input: PdfReportInput) {
  const { report } = input;
  pdf.section("Sites AI trusts for this", "The websites AI linked to in these answers. Each site counts once per answer.");
  if (!report.sources.length) {
    pdf.y += pdf.write("AI didn’t link to any websites in these answers.", M, pdf.y, { size: 10, color: C.soft }) + 8;
    return;
  }
  for (const s of report.sources) {
    pdf.ensure(22);
    pdf.write(s.domain, M, pdf.y, { key: "bold", size: 10, color: C.navy, width: 220, link: s.exampleUrl || undefined });
    const chip = s.isOwn ? "Your site" : SOURCE_TYPE_LABELS[s.type];
    pdf.use("body", 8.5, s.isOwn ? C.green : C.cobalt);
    const chipW = pdf.doc.widthOfString(pdf.t(chip)) + 14;
    pdf.doc.save().roundedRect(M + 236, pdf.y - 1.5, chipW, 15, 7.5).fill(s.isOwn ? C.greenBg : C.lilac).restore();
    pdf.write(chip, M + 236, pdf.y + 1.5, { size: 8.5, color: s.isOwn ? C.green : C.cobalt, width: chipW, align: "center", lineGap: 0 });
    pdf.write(`cited in ${s.count} ${s.count === 1 ? "answer" : "answers"}`, W - M - 120, pdf.y, { size: 9, color: C.soft, width: 120, align: "right" });
    pdf.y += 19;
  }
  pdf.y += 4;
}

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);

function drawAiReady(pdf: Pdf, input: PdfReportInput) {
  const ready = input.report.aiReady;
  if (!ready) return;
  const tx = M + 22;
  const tw = CW - 22;
  const fixOf = (c: (typeof ready.checks)[number]) => (!c.pass && c.fix ? `How to fix: ${c.fix}` : "");
  const heights = ready.checks.map((c) => 16 + pdf.height(c.reason, "body", 9.5, tw) + (fixOf(c) ? pdf.height(fixOf(c), "body", 9.5, tw) + 3 : 0) + 10);
  pdf.section(
    `Is your page easy for AI to quote? ${ready.score} out of 100`,
    `${countWord(ready.checks.length)} quick checks on your product page. AI assistants repeat clear facts, so each one you pass makes your page easier to recommend.`,
    heights[0] ?? 40,
  );
  for (const [i, c] of ready.checks.entries()) {
    const fix = fixOf(c);
    pdf.ensure(heights[i]);
    pdf.mark(M + 7, pdf.y + 6.5, c.pass);
    pdf.write(c.label, tx, pdf.y, { key: "bold", size: 10.5, color: C.navy, width: tw - 60 });
    pdf.write(`${c.weight} points`, W - M - 60, pdf.y + 1, { size: 8.5, color: C.muted, width: 60, align: "right" });
    let y = pdf.y + 16;
    y += pdf.write(c.reason, tx, y, { size: 9.5, color: C.soft, width: tw });
    if (fix) y += 3 + pdf.write(fix, tx, y + 3, { size: 9.5, color: C.cobalt, width: tw });
    pdf.y = y + 10;
  }
}

type Item = PlanStep["items"][number];

/**
 * One plan item at (x, y): the label, then what we saw (on the same line when both fit), the fix and
 * any links. With `draw` false it only measures. Returns its height.
 */
function planItem(pdf: Pdf, it: Item, x: number, y: number, w: number, opts: { draw: boolean; hideDetail?: boolean; fullUrls?: boolean }): number {
  const detail = opts.hideDetail ? "" : (it.detail ?? "");
  let h = 0;
  pdf.use("bold", 9.5, C.navy);
  const labelW = pdf.doc.widthOfString(pdf.t(it.label, "bold"));
  pdf.use("body", 9, C.soft);
  const inline = Boolean(detail) && labelW + 10 + pdf.doc.widthOfString(pdf.t(detail)) <= w;
  if (inline) {
    if (opts.draw) {
      pdf.write(it.label, x, y, { key: "bold", size: 9.5, color: C.navy, width: labelW + 2 });
      pdf.write(detail, x + labelW + 10, y + 0.6, { size: 9, color: C.soft, width: w - labelW - 10 });
    }
    h += pdf.height(it.label, "bold", 9.5, w) + 2;
  } else {
    h += (opts.draw ? pdf.write(it.label, x, y, { key: "bold", size: 9.5, color: C.navy, width: w }) : pdf.height(it.label, "bold", 9.5, w)) + 2;
    if (detail) h += (opts.draw ? pdf.write(detail, x, y + h, { size: 9, color: C.soft, width: w }) : pdf.height(detail, "body", 9, w)) + 1;
  }
  if (it.fix) {
    const fix = `How to fix: ${it.fix}`;
    h += (opts.draw ? pdf.write(fix, x, y + h, { size: 9, color: C.cobalt, width: w }) : pdf.height(fix, "body", 9, w)) + 1;
  }
  for (const u of it.urls ?? []) {
    if (opts.draw) {
      pdf.write(opts.fullUrls ? u.replace(/^https?:\/\//, "") : shortUrl(u), x, y + h + 1, { size: 8.5, color: C.mid, width: w, link: u, underline: true, lineGap: 0 });
    }
    h += 13;
  }
  return h + 7;
}

function drawPlan(pdf: Pdf, input: PdfReportInput) {
  const steps = input.plan.steps;
  const tx = M + 28;
  const tw = CW - 28;
  const ix = tx + 12;
  const iw = tw - 12;
  // The page checks above already say what we saw, so the page step only repeats the fixes.
  const optsFor = (step: PlanStep) => ({ hideDetail: step.kind === "page" && Boolean(input.report.aiReady), fullUrls: step.kind === "geo" });
  // A step's heading and its first item stay together.
  const openingH = (step: PlanStep) =>
    pdf.height(step.title, "bold", 12, tw, 1) +
    5 +
    pdf.height(step.body, "body", 9.5, tw) +
    8 +
    (step.items.length ? planItem(pdf, step.items[0], ix, 0, iw, { ...optsFor(step), draw: false }) : 0);
  pdf.section(
    "Your action plan",
    "What to do next, in order. Every step comes from what this check saw: your page, the AI answers and the sites they cited.",
    steps.length ? openingH(steps[0]) : 40,
  );
  steps.forEach((step, i) => {
    const opts = optsFor(step);
    pdf.ensure(openingH(step));
    pdf.badge(M + 9, pdf.y + 8, i + 1);
    pdf.y += pdf.write(step.title, tx, pdf.y + 1, { key: "bold", size: 12, color: C.navy, width: tw, lineGap: 1 }) + 5;
    pdf.y += pdf.write(step.body, tx, pdf.y, { size: 9.5, color: C.text, width: tw }) + 8;
    for (const it of step.items) {
      pdf.ensure(planItem(pdf, it, ix, 0, iw, { ...opts, draw: false }));
      pdf.dot(tx + 3, pdf.y + 5.5, C.peri, 2.6);
      pdf.y += planItem(pdf, it, ix, pdf.y, iw, { ...opts, draw: true });
    }
    pdf.y += 10;
  });
}

function engineLine(answers: CheckAnswer[], brand: string): { status: string; brands: string } {
  const back = answers.filter((a) => a.ok && !a.empty);
  if (!answers.some((a) => a.ok)) return { status: "couldn’t answer", brands: "" };
  if (!back.length) return { status: "gave no answer", brands: "" };
  const named = back.filter((a) => a.named).length;
  const names: string[] = [];
  for (const a of back) {
    const mine = a.position ? a.brands[a.position - 1] : null;
    for (const b of a.brands) {
      const isYou = b === mine || sameBrand(b, brand);
      const label = isYou ? `${brand} (you)` : b;
      if (!names.some((n) => n === label || (!isYou && sameBrand(n, b)))) names.push(label);
    }
  }
  return {
    status: `named you in ${named} of ${back.length}`,
    brands: !names.length ? "named no brands" : names.length > 5 ? `${names.slice(0, 5).join(", ")} and ${names.length - 5} more` : names.join(", "),
  };
}

function drawQuestions(pdf: Pdf, input: PdfReportInput) {
  const tx = M + 30;
  const tw = CW - 30;
  const bx = tx + 196; // the brands column
  const bw = W - M - bx;
  const blocks = input.questions.map((q, qi) => {
    const lines = CHECK_ENGINES.map((e) => ({ e, ...engineLine(input.answers.filter((a) => a.question === qi && a.engine === e), input.product.brand) }));
    const lineH = (l: (typeof lines)[number]) => Math.max(13, l.brands ? pdf.height(l.brands, "body", 9, bw) : 0) + 5;
    return { q, lines, lineH, h: pdf.height(q.text, "bold", 11, tw) + 8 + lines.reduce((n, l) => n + lineH(l), 0) + 8 };
  });
  pdf.section(
    "The questions we asked",
    "Each question went to every AI twice, because answers change from run to run. Here is who each one named.",
    blocks[0]?.h ?? 40,
  );
  blocks.forEach(({ q, lines, lineH, h }, qi) => {
    pdf.ensure(h);
    pdf.doc.save().roundedRect(M, pdf.y - 1, 22, 16, 6).fill(C.lilac).restore();
    pdf.write(`Q${qi + 1}`, M, pdf.y + 2.5, { key: "bold", size: 8.5, color: C.cobalt, width: 22, align: "center", lineGap: 0 });
    pdf.y += pdf.write(q.text, tx, pdf.y, { key: "bold", size: 11, color: C.navy, width: tw }) + 8;
    for (const l of lines) {
      pdf.dot(tx + 3, pdf.y + 5.5, ENGINE_COLORS[l.e]);
      pdf.write(ENGINE_LABELS[l.e], tx + 12, pdf.y, { key: "bold", size: 9, color: C.navy, width: 74 });
      pdf.write(l.status, tx + 86, pdf.y, { size: 9, color: C.soft, width: 106 });
      if (l.brands) pdf.write(l.brands, bx, pdf.y, { size: 9, color: C.text, width: bw });
      pdf.y += lineH(l);
    }
    pdf.y += 8;
  });
  pdf.y += pdf.write(
    `This quick check used ${input.questions.length} questions. GEO tracks up to ${OFFER.questions} every day on ${OFFER.name}.`,
    M,
    pdf.y,
    { size: 8.5, color: C.muted },
  );
  pdf.y += 10;
}

function drawCta(pdf: Pdf, input: PdfReportInput) {
  const plan = OFFER;
  const heading = "Let us track this and fix it for you";
  const body = `GEO checks up to ${plan.questions} buying questions every day, our team and AI do the fixes, and you see the orders it can trace back to AI.`;
  const price = `${plan.name} is ${OFFER_PRICE}. Join the waitlist and we’ll reach out shortly.`;
  const iw = CW - 48;
  const online = input.checkUrl ? `See this report online: ${shortUrl(input.checkUrl, 90)}` : "";
  const h = 24 + pdf.height(heading, "bold", 15, iw, 1) + 6 + pdf.height(body, "body", 10, iw) + 16 + 30 + 10 + pdf.height(price, "body", 8.5, iw) + (online ? 16 : 0) + 22;
  pdf.ensure(h + 10);
  const top = pdf.y + 4;
  const d = pdf.doc;
  d.save().roundedRect(M, top, CW, h, 16).fill(d.linearGradient(0, top, 0, top + h).stop(0, "#1b1d4a").stop(1, C.indigo)).restore();
  let y = top + 24;
  y += pdf.write(heading, M + 24, y, { key: "bold", size: 15, color: C.white, width: iw, lineGap: 1 }) + 6;
  y += pdf.write(body, M + 24, y, { size: 10, color: C.onDark, width: iw }) + 16;
  const label = "Join the GEO waitlist";
  pdf.use("bold", 10.5, C.white);
  const bw = d.widthOfString(pdf.t(label, "bold")) + 36;
  d.save().roundedRect(M + 24, y, bw, 30, 15).fill(C.mid).restore();
  pdf.write(label, M + 24, y + 9, { key: "bold", size: 10.5, color: C.white, width: bw, align: "center", lineGap: 0 });
  d.link(M + 24, y, bw, 30, input.joinUrl);
  y += 30 + 10;
  y += pdf.write(price, M + 24, y, { size: 8.5, color: C.onDark, width: iw });
  if (online && input.checkUrl) {
    pdf.write(online, M + 24, y + 6, { size: 8.5, color: C.onDark, width: iw, link: input.checkUrl, underline: true });
  }
  pdf.y = top + h + 10;
}

/** The PDF report. Returns the file's bytes. */
export async function buildCheckPdf(input: PdfReportInput): Promise<Buffer> {
  const title = `GEO free product check: ${input.product.title}`;
  const created = new Date(input.finishedAt ?? input.createdAt);
  const pdf = new Pdf(noDashes(title), `Free product check: ${input.product.title}`, Number.isFinite(created.getTime()) ? created : new Date(0));
  drawTop(pdf, input);
  drawScore(pdf, input);
  drawRivals(pdf, input);
  drawSources(pdf, input);
  drawAiReady(pdf, input);
  drawPlan(pdf, input);
  drawQuestions(pdf, input);
  drawCta(pdf, input);
  return pdf.finish();
}

/** "GEO-report-Coolabah-Grooming-Co.pdf": a safe file name from the brand. */
export function reportFileName(brand: string): string {
  const slug = brand
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `GEO-report-${slug || "product"}.pdf`;
}
