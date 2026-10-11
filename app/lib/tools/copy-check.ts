// AI Bot Checker (docs/tools/spec.md T6): does a product description read like generic, bot-style copy?
// Pure and browser-safe: the page runs it live as people type, and the server runs the same code for the
// on-load sample and for posts without JavaScript. It never guesses who wrote a text (no tool can prove
// that) and never gives a percentage. It finds filler phrases (our own list), hype words with no fact in
// the same sentence, which of 7 facts shoppers ask about are missing, and a few readability notes.
// Strangers paste this text, so every pattern is bounded: the input is cut to 20,000 characters first,
// the wildcards match at most 40 characters inside one sentence, and nothing rescans the text from many
// starting points (house rule, like check-read.ts).

import { AUDIENCE, MATERIAL, SIZE, looksEnglish } from "../ai-ready";
import { htmlToText } from "../check-read";
import {
  FACTS,
  FILLER_COPY,
  HYPE_COPY,
  MAX_TEXT,
  NOTES,
  TIPS,
  VERDICT,
  verdictLine,
  type FactId,
  type FillerGroup,
  type HypeGroup,
  type VerdictId,
} from "./copy/ai-bot-checker";

// ---------- filler phrases (our own list) ----------

const APOS = "['\u2019]"; // a straight or a curly apostrophe
/** A wildcard: at most 40 characters, and never past the end of a sentence or a line. */
const GAP = "[^.!?\\n]{0,40}?";

interface FillerPattern {
  id: string;
  /** How the list names it ("whether you're ... or"). */
  label: string;
  group: FillerGroup;
  /** Has a wildcard: the list shows the label, not the (long) matched text. */
  wild: boolean;
  re: RegExp;
}

const filler = (id: string, label: string, group: FillerGroup, source: string): FillerPattern => ({
  id,
  label,
  group,
  wild: source.includes(GAP),
  re: new RegExp(source, "gi"),
});

/** Phrases common in generic product copy. Our own judgement (the page says so), not anyone's rule. */
export const FILLER: FillerPattern[] = [
  filler("elevate-your", "elevate your", "opener", "\\belevate your\\b"),
  filler("next-level", "take your ... to the next level", "opener", `\\btake (?:your|you)\\b${GAP}\\bto the next level\\b`),
  filler("unleash", "unleash", "opener", "\\bunleash(?:es|ed|ing)?\\b"),
  filler("game-changer", "game-changer", "opener", "\\bgame[- ]?chang(?:ers?|ing)\\b"),
  filler("look-no-further", "look no further", "push", "\\blook no further\\b"),
  filler("whether", "whether you're ... or", "audience", `\\bwhether (?:you${APOS}re|you are)\\b${GAP}\\bor\\b`),
  filler("fast-paced", "in today's fast-paced world", "opener", `\\bin today${APOS}?s fast[- ]paced world\\b`),
  filler("in-mind", "designed with you in mind", "audience", "\\b(?:designed|made|crafted|created) with you in mind\\b"),
  filler("with-care", "crafted with care", "quality", "\\b(?:crafted|made) with (?:care|love)\\b"),
  filler("finest", "the finest ingredients", "quality", "\\bthe finest (?:ingredients|materials|quality)\\b"),
  filler("perfect-blend", "the perfect blend of", "quality", "\\bthe perfect (?:blend|balance|combination) of\\b"),
  filler("any-occasion", "perfect for any occasion", "audience", "\\bperfect for (?:any|every) occasion\\b"),
  filler("must-have", "must-have", "push", "\\bmust[- ]haves?\\b"),
  filler("level-up", "level up", "opener", "\\blevel(?:s|led|ed)? up\\b"),
  filler("difference", "experience the difference", "push", "\\bexperience the difference\\b"),
  filler("goodbye", "say goodbye to", "push", "\\bsay goodbye to\\b"),
  filler("hello", "say hello to", "push", "\\bsay hello to\\b"),
  filler("transform", "transform your", "opener", "\\btransform (?:your|you)\\b"),
  filler("redefine", "redefine", "opener", "\\bredefin(?:e|es|ed|ing)\\b"),
  filler("embark", "embark on", "opener", "\\bembark(?:s|ed|ing)? on\\b"),
  filler("journey", "journey", "opener", "\\bjourneys?\\b"),
  filler("seamless", "seamless", "filler", "\\bseamless(?:ly)?\\b"),
  filler("indulge", "indulge in", "push", "\\bindulge in\\b"),
  filler("treat", "treat yourself", "push", "\\btreat yourself\\b"),
  filler("boasts", "boasts", "filler", "\\bboast(?:s|ing)\\b"),
  filler("unlock", "unlock", "opener", "\\bunlock(?:s|ed|ing)?\\b"),
  filler("harness", "harness the power of", "opener", "\\bharness(?:es|ing)? the power of\\b"),
  filler("potential", "full potential", "opener", "\\bfull potential\\b"),
];

// ---------- hype words ----------

// FLUFF from ai-ready.ts (private there; copied as is, keep the two in step).
const FLUFF_WORDS =
  "amazing|incredible|ultimate|luxurious|luxury|premium|revolutionary|game[- ]?changer|elevate[sd]?|indulge|unleash|transform(?:s|ative)?|experience|best[- ]ever|world[- ]class|next[- ]level|must[- ]have|iconic|perfect|stunning|epic|magic(?:al)?|unique|innovative|exceptional|unparalleled|superior|exquisite|irresistible";
// Microsoft Bing's own examples (innovative is already above, eco, next-gen, cutting-edge; Microsoft
// Advertising blog, 8 Oct 2025), then a few more of ours.
const MORE_HYPE = "eco(?:[- ]friendly)?|next[- ]gen|cutting[- ]edge|high[- ]quality|top[- ]quality|best[- ]in[- ]class|state[- ]of[- ]the[- ]art|finest";
/** Global: only ever used with matchAll (never .test, whose lastIndex would carry over between calls). */
const HYPE = new RegExp(`\\b(?:${FLUFF_WORDS}|${MORE_HYPE})\\b`, "gi");

const QUALITY_WORDS = new Set(["luxurious", "luxury", "premium", "superior", "exquisite", "exceptional", "world-class", "high-quality", "top-quality", "best-in-class", "finest"]);
const NEW_WORDS = new Set(["innovative", "revolutionary", "next-gen", "cutting-edge", "state-of-the-art", "next-level", "game-changer", "gamechanger", "transformative"]);
const VERB_WORDS = new Set(["elevate", "elevates", "elevated", "indulge", "unleash", "transform", "transforms", "experience"]);

/** "Game changer" and "game-changer" are one word for the list. */
const hypeKey = (word: string) => word.toLowerCase().replace(/[\s-]+/g, "-");

export function hypeGroup(word: string): HypeGroup {
  const w = hypeKey(word);
  if (QUALITY_WORDS.has(w)) return "quality";
  if (NEW_WORDS.has(w)) return "new";
  if (w.startsWith("eco")) return "eco";
  if (VERB_WORDS.has(w)) return "verb";
  return "praise";
}

// ---------- facts ----------

// A number with a unit that SIZE (ai-ready.ts) doesn't list: "180 gsm", "42 dB", "8 hours", "SPF 50", "100%".
const UNIT =
  /\b\d+(?:[.,]\d+)?\s?(?:%|gsm|db|watts?|w|kw|v|mah|hz|hours?|hrs?|minutes?|mins?|days?|weeks?|months?|years?|ft|feet|yards?|kcal|calories|cups?|tbsp|tsp)(?![\p{L}\p{N}])|\bspf\s?\d+/iu;
// The spec's patterns for the other facts (docs/tools/spec.md T6).
const USE = /\b(?:how to use|directions|apply|use (?:\d+|one|two|three|a few)|massage|rinse|wash|wear|pour|mix|spray|\d+\s?drops?)\b/i;
const CARE = /\b(?:care|machine wash|hand wash|wipe clean|dishwasher[- ]safe|store (?:in|at|away)|keep (?:out of|away from)|shelf life)\b/i;
const INCLUDED = /\b(?:includes?|in the box|comes with|set of|pack of|kit contains)\b/i;
// PLACES, PLACE and MADE_IN from ai-ready.ts (private there; copied as is, keep them in step).
const PLACES =
  "united states|usa|america|north america|canada|canadian|mexico|united kingdom|uk|britain|england|scotland|wales|ireland|" +
  "europe|european union|eu|germany|france|italy|spain|portugal|netherlands|belgium|switzerland|austria|sweden|denmark|norway|finland|" +
  "australia|australian|new zealand|aotearoa|nz|japan|korea|south korea|singapore|malaysia|hong kong|india|south africa|uae|dubai|" +
  "worldwide|international|internationally|globally|nationwide";
const PLACE = new RegExp(`\\b(?:${PLACES})\\b`, "i");
const MADE_IN = /\b(?:[Mm]ade|[Dd]esigned|[Pp]roduced|[Mm]anufactured|[Cc]rafted|[Gg]rown|[Bb]ottled|[Pp]rinted|[Ss]ewn) in (?:the )?[A-Z][a-z]+/;

// The bare nouns name no ingredient or material ("the finest ingredients" names none), so they're blanked
// before MATERIAL runs. Same length, so positions still line up with the text.
const BARE_NOUNS = /\b(?:ingredients?|materials?|fabrics?)\b/gi;
const withoutBareNouns = (s: string) => s.replace(BARE_NOUNS, (m) => " ".repeat(m.length));
// Product names that hold a fact word but state no fact: "skin care" and "beard care" say nothing about care,
// "face wash" and "hair spray" nothing about how to use it, "a mix of" nothing at all (our list). Blanked
// before the fact patterns run, like the bare nouns. "Hand wash" stays: it's usually a care line. Only the fact
// word is blanked, so "for dry skin care" still says who it's for.
const PRODUCT_NOUNS =
  /\b(?:(?:skin|hair|beard|body|face|facial|foot|nail|lip|self|personal|baby|pet|oral|sun|scalp)[- ]?care|(?:face|facial|body|beard|mouth|hair)[- ]?wash(?:es)?|(?:hair|body|face|facial|room|setting|sea salt)[- ]?sprays?|(?:a|the) mix of)\b/gi;
const FACT_WORD = /care|wash(?:es)?|sprays?|mix/i;
const withoutProductNouns = (s: string) => s.replace(PRODUCT_NOUNS, (m) => m.replace(FACT_WORD, (w) => " ".repeat(w.length)));

const FACT_PATTERNS: Record<FactId, RegExp[]> = {
  who: [AUDIENCE],
  size: [SIZE],
  materials: [MATERIAL],
  use: [USE],
  care: [CARE],
  included: [INCLUDED],
  origin: [MADE_IN, PLACE],
};

/**
 * Does this sentence state a concrete fact: a number with a unit, a material or ingredient, or who it's
 * for? A hype word next to one is anchored (Microsoft: "anchor claims in measurable facts").
 */
function hasFact(sentence: string): boolean {
  return SIZE.test(sentence) || UNIT.test(sentence) || AUDIENCE.test(sentence) || MATERIAL.test(withoutBareNouns(sentence));
}

// ---------- reading the text ----------

// A "<" that can't start a tag ("5 < 6", "<3"): written as &lt; before the tags are taken out, so the text
// up to the next ">" isn't dropped with it. decodeEntities turns it back into "<".
const LONE_LT = /<(?![a-z/!])/gi;
// A tag like <p>, </li> or <br/>. "Size <50 ml" isn't one (a letter must follow the "<").
const HTML_TAG = /<\/?[a-z][a-z0-9]{0,10}\b[^<>]{0,500}>/i;
// Tags that start a new line on a page: each becomes a line break, so paragraphs and lists still count.
const BLOCK_TAG = /<\/?(?:p|div|br|li|ul|ol|h[1-6]|tr|table|section|article|blockquote|hr)\b[^<>]{0,500}>/gi;
// A private-use character: not whitespace, so htmlToText keeps it, and it marks where the lines break.
const BREAK = "\ue000";

/** Pasted HTML as plain text with its line breaks (htmlToText from check-read.ts walks the tags in linear time). */
function fromHtml(html: string): string {
  const marked = html.split(BREAK).join("").replace(LONE_LT, "&lt;").replace(BLOCK_TAG, (tag) => `${tag}${BREAK}`);
  return htmlToText(marked, marked.length)
    .split(BREAK)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export interface Span {
  start: number;
  end: number;
}

const END_MARKS = new Set([".", "!", "?", "\u2026"]);
const CLOSERS = new Set([".", "!", "?", "\u2026", '"', "'", "\u201d", "\u2019", ")", "]"]);
const SPACE = /\s/;

/**
 * Sentences as [start, end) in the text, trimmed. One pass: a sentence ends at a line break, or at ".", "!",
 * "?" or "…" (with any closing quotes) followed by a space or the end. "3.5 ml" stays one sentence.
 */
export function sentenceSpans(text: string): Span[] {
  const out: Span[] = [];
  let start = 0;
  const push = (end: number) => {
    let s = start;
    let e = end;
    while (s < e && SPACE.test(text[s])) s++;
    while (e > s && SPACE.test(text[e - 1])) e--;
    if (e > s) out.push({ start: s, end: e });
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\n") {
      push(i);
      start = i + 1;
    } else if (END_MARKS.has(c)) {
      let j = i;
      while (j + 1 < text.length && CLOSERS.has(text[j + 1])) j++;
      if (j + 1 >= text.length || SPACE.test(text[j + 1])) {
        push(j + 1);
        start = j + 1;
      }
      i = j;
    }
  }
  push(text.length);
  return out;
}

/** The sentence that holds position `at` (binary search), or -1. */
function sentenceAt(spans: Span[], at: number): number {
  let lo = 0;
  let hi = spans.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (at < spans[mid].start) hi = mid - 1;
    else if (at >= spans[mid].end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

const WORD = /[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu;
const wordsIn = (s: string) => s.match(WORD) ?? [];

/** The text with these spans replaced by spaces (same length, so positions still line up). */
function blankOut(text: string, spans: Span[]): string {
  if (!spans.length) return text;
  const chars = text.split("");
  for (const s of spans) for (let i = s.start; i < s.end; i++) chars[i] = " ";
  return chars.join("");
}

/** A fact's words as found in the text, widened to whole words ("100% o" becomes "100% organic"). Short. */
function snippet(text: string, start: number, end: number): string {
  let e = end;
  while (e < text.length && e - start < 60 && /[\p{L}\p{N}]/u.test(text[e])) e++;
  return text.slice(start, e).replace(/\s+/g, " ").trim();
}

// ---------- the report ----------

export type FlagKind = "filler" | "hype";

export interface CopyFlag {
  kind: FlagKind;
  /** One key per listed phrase or hype word, so repeats group together. */
  key: string;
  /** What the list shows: the words as in the text, or the label for a phrase with a wildcard. */
  display: string;
  text: string;
  start: number;
  end: number;
  why: string;
  how: string;
}

export interface CopyPhrase {
  key: string;
  kind: FlagKind;
  display: string;
  count: number;
  why: string;
  how: string;
}

/** Plain text, or a marked phrase with its reason (shown on hover). Joined, the segments are the text. */
export interface CopySegment {
  text: string;
  mark: { kind: FlagKind; why: string } | null;
}

export interface CopyFact {
  id: FactId;
  label: string;
  found: boolean;
  /** The words that count as the fact, as in the text. */
  match: string | null;
  question: string;
}

export interface CopyNumbers {
  words: number;
  sentences: number;
  /** Words per sentence, rounded. */
  averageSentence: number;
  facts: number;
  vague: number;
}

export interface CopyReport {
  /** The text that was checked: the first 20,000 characters, HTML tags taken out, line breaks as "\n". */
  text: string;
  empty: boolean;
  english: boolean;
  /** Null when there's nothing to judge (empty, or not English). */
  verdict: { id: VerdictId; label: string; line: string } | null;
  flags: CopyFlag[];
  segments: CopySegment[];
  phrases: CopyPhrase[];
  facts: CopyFact[];
  numbers: CopyNumbers;
  tips: string[];
  /** What we did to the text before checking it (cut it short, took out HTML). */
  notes: string[];
}

/**
 * docs/tools/spec.md T6, also written out in "How this tool works". `minWords`: a text under 100 words counts
 * as 100, so one hype word in a 20-word description isn't "5 per 100 words" (that marked short, factual
 * descriptions "Sounds generic").
 */
export const THRESHOLDS = { specificFacts: 4, specificPer100: 1, genericFacts: 1, genericPer100: 4, minWords: 100 } as const;

export function verdictFor(facts: number, vague: number, words: number): VerdictId {
  const per100 = (vague * 100) / Math.max(words, THRESHOLDS.minWords);
  if (facts >= THRESHOLDS.specificFacts && per100 <= THRESHOLDS.specificPer100) return "specific";
  if (facts <= THRESHOLDS.genericFacts || per100 >= THRESHOLDS.genericPer100) return "generic";
  return "mixed";
}

/** Keep flags that don't overlap: the earliest first, a filler phrase before a hype word inside it. */
function pickFlags(all: CopyFlag[]): CopyFlag[] {
  const sorted = [...all].sort((a, b) => a.start - b.start || (a.kind === b.kind ? 0 : a.kind === "filler" ? -1 : 1) || b.end - a.end);
  const out: CopyFlag[] = [];
  let last = 0;
  for (const f of sorted) {
    if (f.start < last) continue;
    out.push(f);
    last = f.end;
  }
  return out;
}

function segmentsOf(text: string, flags: CopyFlag[]): CopySegment[] {
  const out: CopySegment[] = [];
  let last = 0;
  for (const f of flags) {
    if (f.start > last) out.push({ text: text.slice(last, f.start), mark: null });
    out.push({ text: text.slice(f.start, f.end), mark: { kind: f.kind, why: f.why } });
    last = f.end;
  }
  if (last < text.length || !out.length) out.push({ text: text.slice(last), mark: null });
  return out;
}

function phrasesOf(flags: CopyFlag[]): CopyPhrase[] {
  const byKey = new Map<string, CopyPhrase>();
  for (const f of flags) {
    const seen = byKey.get(f.key);
    if (seen) seen.count++;
    else byKey.set(f.key, { key: f.key, kind: f.kind, display: f.display, count: 1, why: f.why, how: f.how });
  }
  return [...byKey.values()];
}

const STOP_WORDS = new Set("a an and are as at be by for from in is it its of on or our the this that to with you your".split(" "));

/** 3-word phrases used 3 or more times (within sentences), most used first, at most 2 that don't overlap. */
function repeatedPhrases(sentences: string[][]): { phrase: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const words of sentences) {
    const lower = words.map((w) => w.toLowerCase());
    for (let i = 0; i + 2 < lower.length; i++) {
      const three = lower.slice(i, i + 3);
      if (!three.some((w) => w.length >= 3 && !STOP_WORDS.has(w))) continue;
      const k = three.join(" ");
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const out: { phrase: string; count: number }[] = [];
  const pairs = new Set<string>();
  for (const [phrase, count] of [...counts].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])) {
    const w = phrase.split(" ");
    const mine = [`${w[0]} ${w[1]}`, `${w[1]} ${w[2]}`];
    if (mine.some((p) => pairs.has(p))) continue; // the same repeat, one word along
    mine.forEach((p) => pairs.add(p));
    out.push({ phrase, count });
    if (out.length === 2) break;
  }
  return out;
}

// Arrows, stars, ticks, hearts and sparkles, and runs of 3 or more "!" (Microsoft's "decorative symbols").
const SYMBOLS = /[\u2190-\u21ff\u2794\u279c\u27a1\u27a4\u25b6\u25ba\u2605\u2606\u2728\u2713\u2714\u2705\u2764\u2665]|!{3,}/g;
const EM_DASH = "\u2014";

function decorativeSymbols(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(SYMBOLS)) {
    found.add(m[0].startsWith("!") ? "!!!" : m[0]);
    if (found.size === 5) break;
  }
  return [...found];
}

function tipsFor(text: string, sentences: string[][], words: number, flat: boolean): string[] {
  const tips: string[] = [];
  if (words < 50) tips.push(TIPS.short);
  // A flat text lost its line breaks before it reached us, so a list reads as one long sentence: no tips on length.
  if (!flat && text.split("\n").some((para) => wordsIn(para).length > 120)) tips.push(TIPS.wall);
  const long = flat ? 0 : sentences.filter((s) => s.length > 35).length;
  if (long) tips.push(TIPS.longSentences(long));
  for (const r of repeatedPhrases(sentences)) tips.push(TIPS.repeat(r.phrase, r.count));
  const symbols = decorativeSymbols(text);
  if (symbols.length) tips.push(TIPS.symbols(symbols.join(" ")));
  if (text.includes(EM_DASH)) tips.push(TIPS.dashes);
  return tips;
}

// Latin letters, and letters of any script. looksEnglish (ai-ready.ts) calls a text of under 12 words English,
// and a whole line of Chinese or Japanese is one "word" to it, so a short text in another script would get
// English advice. Bounded like looksEnglish: the first 5,000 characters.
const LETTER = /\p{L}/gu;
const LATIN = /\p{Script=Latin}/gu;

/** Could this be English: looksEnglish, and mostly Latin letters? */
function readsEnglish(text: string): boolean {
  if (!looksEnglish(text)) return false;
  const sample = text.slice(0, 5_000);
  const letters = (sample.match(LETTER) ?? []).length;
  return !letters || (sample.match(LATIN) ?? []).length / letters >= 0.5;
}

/** How the text reached us. */
export interface CheckOptions {
  /**
   * The text lost its line breaks on the way: a product link's description (readProduct turns the page's HTML
   * into one line). The paragraph and sentence length tips are skipped, because we can't see where its
   * paragraphs and list items end.
   */
  flat?: boolean;
}

const ZERO: CopyNumbers = { words: 0, sentences: 0, averageSentence: 0, facts: 0, vague: 0 };

/** First letter in the same case as the text's, for a wildcard phrase's label ("Whether you're ... or"). */
const likeText = (label: string, text: string) => (/^[A-Z]/.test(text) ? label[0].toUpperCase() + label.slice(1) : label);

/**
 * Check a product description. Plain text or HTML in (HTML tags are taken out first); only the first
 * 20,000 characters are read. Linear time: every pattern is bounded.
 */
export function checkCopy(input: string, opts: CheckOptions = {}): CopyReport {
  const raw = String(input ?? "").replace(/\r\n?/g, "\n");
  const notes: string[] = [];
  let text = raw.length > MAX_TEXT ? raw.slice(0, MAX_TEXT) : raw;
  if (raw.length > MAX_TEXT) notes.push(NOTES.cut);
  if (HTML_TAG.test(text)) {
    text = fromHtml(text);
    notes.push(NOTES.html);
  }
  const base = { text, flags: [], phrases: [], facts: [], tips: [], notes, verdict: null };
  if (!text.trim()) return { ...base, empty: true, english: true, segments: text ? [{ text, mark: null }] : [], numbers: ZERO };

  const spans = sentenceSpans(text);
  const sentences = spans.map((s) => wordsIn(text.slice(s.start, s.end))).filter((w) => w.length);
  const words = sentences.reduce((n, s) => n + s.length, 0);
  const counted = { words, sentences: sentences.length, averageSentence: sentences.length ? Math.round(words / sentences.length) : 0 };

  // Not English: our phrase lists and fact patterns are English, so only the counts are shown.
  if (!readsEnglish(text)) return { ...base, empty: false, english: false, segments: [{ text, mark: null }], numbers: { ...counted, facts: 0, vague: 0 } };

  const fillers: CopyFlag[] = [];
  for (const p of FILLER) {
    for (const m of text.matchAll(p.re)) {
      const start = m.index ?? 0;
      fillers.push({
        kind: "filler",
        key: `filler:${p.id}`,
        display: p.wild ? likeText(p.label, m[0]) : m[0],
        text: m[0],
        start,
        end: start + m[0].length,
        ...FILLER_COPY[p.group],
      });
    }
  }
  // Facts never come from inside a filler phrase ("perfect for any occasion" says nothing about who), or from
  // a product name ("beard care" says nothing about care).
  const factText = withoutProductNouns(blankOut(text, fillers));

  const anchored = new Map<number, boolean>();
  const hypes: CopyFlag[] = [];
  for (const m of text.matchAll(HYPE)) {
    const start = m.index ?? 0;
    const at = sentenceAt(spans, start);
    if (at < 0) continue;
    let fact = anchored.get(at);
    if (fact === undefined) {
      fact = hasFact(factText.slice(spans[at].start, spans[at].end));
      anchored.set(at, fact);
    }
    if (fact) continue; // a hype word next to a fact is fine
    hypes.push({ kind: "hype", key: `hype:${hypeKey(m[0])}`, display: m[0], text: m[0], start, end: start + m[0].length, ...HYPE_COPY[hypeGroup(m[0])] });
  }

  const flags = pickFlags([...fillers, ...hypes]);

  const materialsText = withoutBareNouns(factText);
  const facts: CopyFact[] = FACTS.map((f) => {
    const source = f.id === "materials" ? materialsText : factText;
    let match: string | null = null;
    for (const re of FACT_PATTERNS[f.id]) {
      const m = re.exec(source); // none of these is global, so exec always starts at the beginning
      if (m) {
        match = snippet(text, m.index, m.index + m[0].length);
        break;
      }
    }
    return { id: f.id, label: f.label, found: match !== null, match, question: f.question };
  });

  const found = facts.filter((f) => f.found).length;
  const id = verdictFor(found, flags.length, words);
  return {
    ...base,
    empty: false,
    english: true,
    verdict: { id, label: VERDICT[id], line: verdictLine(flags.length, found) },
    flags,
    segments: segmentsOf(text, flags),
    phrases: phrasesOf(flags),
    facts,
    numbers: { ...counted, facts: found, vague: flags.length },
    tips: tipsFor(text, sentences, words, Boolean(opts.flat)),
  };
}
