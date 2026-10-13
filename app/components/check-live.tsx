// Free product check: the live "AI at work" view while a check runs (queued, reading, asking, writing).
// The page (routes/check.$id.tsx) polls every 3 s, so `view` moves on as the job does (check.server.ts):
// reading with no product -> reading with the product (Claude writes the questions) -> asking (the
// questions are in, `done` counts answers up to `total`) -> writing -> done (the page shows the report).
// Everything shown is real: the page we read, its price, the questions, the count of answers in. The
// motion only shows that work is happening; it never invents a brand, an answer or a result.
// Styles: app/styles/check-live.css (cl-*). Motion is CSS (transform and opacity); JS only types and cycles text.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { MailIcon, useLead } from "./check-lead";
import {
  CHECK_COUNTRIES,
  CHECK_ENGINES,
  CHECK_QUESTIONS,
  CHECK_RUNS,
  type CheckEngine,
  type CheckProduct,
  type CheckView,
} from "../lib/check-types";
import { domainOf, formatPrice } from "./check-ui";

export const STEPS = ["Reading your page", "Writing buying questions", "Asking ChatGPT, Gemini and Perplexity", "Writing your report"];
/** The same steps, short enough for the slim step strip on a phone. */
const STEPS_SHORT = ["Reading your page", "Writing questions", "Asking ChatGPT & co", "Writing your report"];
/** ...and on the smallest phones (360px and below), so the done steps keep their wires. */
const STEPS_TINY = ["Reading your page", "Writing questions", "Asking the AIs", "Writing your report"];
type Stage = 0 | 1 | 2 | 3;

/** Which step is happening now: the same steps the job goes through in check.server.ts. */
export function stageOf(view: Pick<CheckView, "status" | "product" | "questions">): Stage {
  if (view.status === "writing" || view.status === "done") return 3;
  if (view.status === "asking" || view.questions.length) return 2;
  return view.product ? 1 : 0;
}

/** What a screen reader hears as the check moves on (the page's live region, in CheckShell). */
export function liveAnnouncement(view: Pick<CheckView, "status" | "product" | "questions">): string {
  const stage = stageOf(view);
  return `Step ${stage + 1} of ${STEPS.length}: ${STEPS[stage]}`;
}

/** A check usually takes 3 to 6 minutes; after 6 the page says it's taking longer and offers the email. */
const USUAL_MAX_MS = 6 * 60_000;

const ENGINE_NAMES: Record<CheckEngine, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity" };
const SLOTS = CHECK_ENGINES.length * CHECK_QUESTIONS * CHECK_RUNS; // 18

/** Sourced facts (docs/facts.md). Each one names where it comes from and links to it. */
const FACTS = [
  {
    text: "Visitors who arrive from AI convert 60% better than other visitors.",
    source: "Adobe, US retail, July 2026",
    url: "https://www.digitalcommerce360.com/2026/08/19/adobe-ai-referral-traffic-data-july-2026/",
  },
  {
    text: "1.2 billion people use ChatGPT every week.",
    source: "OpenAI, September 2026",
    url: "https://openai.com/index/devday-2026-recap/",
  },
  {
    text: "In a survey of 1,009 US shoppers, 77% had used AI to help them shop in the last six months.",
    source: "Exploding Topics, April 2026",
    url: "https://searchengineland.com/new-data-77-use-ai-to-shop-nearly-1-in-3-wont-let-it-spend-475614",
  },
  {
    text: "Shopify’s president says orders coming from AI search are 15 times higher than in January 2025.",
    source: "Shopify, February 2026",
    url: "https://www.cp24.com/news/canada/2026/02/11/shopify-reports-us743m-q4-profit-revenue-up-31-per-cent-from-year-ago/",
  },
];

// ---------- small helpers ----------

/**
 * True once a CheckLive has mounted in this browser. Text that shows up after that (a new step, the
 * questions arriving) types itself in; text in the first render (server HTML, hydration) is shown whole,
 * so the page reads fine without JS and never flashes empty.
 */
let hydrated = false;

/** Type text in? Only after hydration, and never when the visitor asked for less motion. */
function canType(): boolean {
  if (typeof window === "undefined" || !hydrated) return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** An index that moves on every `ms` (wraps at `length`). Restarts from 0 when the component remounts. */
function useCycle(length: number, ms: number, paused = false): number {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (length < 2 || paused) return;
    const timer = window.setInterval(() => setI((n) => n + 1), ms);
    return () => window.clearInterval(timer);
  }, [length, ms, paused]);
  return length ? i % length : 0;
}

/** The start of the page's description, cut at a word (the card shows 2 lines of it). */
function excerpt(text: string | null | undefined, max = 170): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, "")}…`;
}

const safeImage = (url: string | null | undefined) => (url && /^https:\/\//i.test(url) ? url : null);
const vars = (v: Record<string, string | number>) => v as CSSProperties;

// ---------- icons (decorative) ----------

const Svg = ({ children, className = "cl-ic", width = 1.9 }: { children: ReactNode; className?: string; width?: number }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const Tick = () => (
  <Svg width={2.6}>
    <path d="m5 12 5 5 9-10" />
  </Svg>
);
const Lock = () => (
  <Svg>
    <rect x="5" y="11" width="14" height="10" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);
const ImageGlyph = () => (
  <Svg width={1.6}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m21 16-5-5-9 9" />
  </Svg>
);
const Bulb = () => (
  <Svg>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z" />
  </Svg>
);
const LinkIcon = () => (
  <Svg>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Svg>
);
// The same plain marks as the home page's engine strip (no brand logos).
const ENGINE_ICONS: Record<CheckEngine, ReactNode> = {
  chatgpt: (
    <Svg width={1.8}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" />
    </Svg>
  ),
  gemini: (
    <Svg width={1.8}>
      <path d="M6 3h12l4 6-10 13L2 9Z" />
      <path d="M2 9h20" />
      <path d="m12 22-4-13 3-6" />
      <path d="m12 22 4-13-3-6" />
    </Svg>
  ),
  perplexity: (
    <Svg width={1.8}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5Z" />
    </Svg>
  ),
};

const Dots = () => (
  <span className="cl-dots" aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);

/** The GEO mark (two circles), slowly turning: the "AI at work" sign. */
const Orb = ({ big = false }: { big?: boolean }) => (
  <span className={`cl-orb${big ? " is-big" : ""}`} aria-hidden="true">
    <span className="cl-orb-spin">
      <i />
      <i />
    </span>
  </span>
);

// ---------- typed text ----------

const TYPE_MS = 24;

/**
 * Text that types itself in, one letter at a time, when it mounts after hydration (key it by its text to
 * type a new line). `delay` waits first (typing dots show meanwhile). Screen readers get the whole text.
 */
function Typed({ text, delay = 0, caret = false }: { text: string; delay?: number; caret?: boolean }) {
  const [n, setN] = useState(() => (canType() ? 0 : text.length));
  useEffect(() => {
    if (n >= text.length) return;
    const timer = window.setTimeout(() => setN((v) => v + 1), n === 0 && delay ? delay : TYPE_MS);
    return () => window.clearTimeout(timer);
  }, [n, text.length, delay]);
  const typing = n < text.length;
  return (
    <>
      <span className="ck-sr">{text}</span>
      <span className="cl-typed" aria-hidden="true">
        {n === 0 && typing && delay ? <Dots /> : text.slice(0, n)}
        {caret || (typing && n > 0) ? <span className={`cl-caret${typing ? " is-typing" : ""}`} /> : null}
      </span>
    </>
  );
}

/** The narrator line at the top of the stage: what the AI is doing, typed in, line after line. */
function Say({ lines, index, lead }: { lines: string[]; index?: number; lead?: ReactNode }) {
  const own = useCycle(index === undefined ? lines.length : 0, 3400);
  const i = index ?? own;
  const line = lines[i % Math.max(1, lines.length)] ?? "";
  return (
    <div className="cl-say">
      <Orb />
      <p className="cl-say-tx" aria-hidden="true">
        {lead}
        <Typed key={`${i}:${line}`} text={line} caret />
      </p>
    </div>
  );
}

// ---------- stage 0 and 1: reading the page ----------

function foundChips(product: CheckProduct): { label: string; value: string | null }[] {
  const chips: { label: string; value: string | null }[] = [];
  if (product.brand) chips.push({ label: "Brand", value: product.brand });
  const price = formatPrice(product.price, product.currency);
  if (price) chips.push({ label: "Price", value: price });
  const category = product.category && product.category !== "product" ? product.category : product.productType;
  if (category) chips.push({ label: "Category", value: category });
  if (product.isShopify) chips.push({ label: "Shopify store", value: null });
  return chips;
}

/** A small browser window opening their page: skeleton lines being read, then what we found. */
function Browser({ product, domain }: { product: CheckProduct | null; domain: string | null }) {
  const address = product?.domain ?? domain;
  const image = safeImage(product?.image);
  const description = product ? excerpt(product.description) : "";
  return (
    <div className={`cl-win${product ? " is-found" : ""}`}>
      <div className="cl-win-bar" aria-hidden="true">
        <span className="cl-win-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="cl-win-url">
          <Lock />
          <span>{address ?? "Opening your page"}</span>
        </span>
      </div>
      <span className="cl-win-load" aria-hidden="true">
        <i />
      </span>
      <div className="cl-win-body">
        <div className={`cl-shot${product ? "" : " is-empty"}`} aria-hidden="true">
          {product ? (
            image ? (
              <img src={image} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="cl-shot-ph">{(product.brand || product.title).slice(0, 1).toUpperCase()}</span>
            )
          ) : (
            <ImageGlyph />
          )}
          <span className="cl-shot-scan" />
          <span className="cl-shot-corners">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        {product ? (
          <div className="cl-found">
            <p className="cl-k">Found on the page</p>
            <p className="cl-found-title">{product.title}</p>
            {description ? (
              <p className="cl-desc">
                {description}
                <span className="cl-desc-scan" aria-hidden="true" />
              </p>
            ) : null}
          </div>
        ) : (
          <div className="cl-read" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <i key={i}>
                <b />
              </i>
            ))}
            <span className="cl-read-run">
              <span className="cl-read-cursor" />
            </span>
          </div>
        )}
        {product ? (
          <ul className="cl-chips">
            {foundChips(product).map((c, i) => (
              <li key={c.label} style={vars({ "--i": i })}>
                <span className="cl-chip-tick">
                  <Tick />
                </span>
                {c.value ? (
                  <>
                    <span className="cl-chip-k">{c.label}</span>
                    <span className="cl-chip-v">{c.value}</span>
                  </>
                ) : (
                  <span className="cl-chip-v">{c.label}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="cl-chips is-skel" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        )}
      </div>
    </div>
  );
}

/** A small card listing what this step works through, with the item in focus moving down the list. */
function FocusCard({ title, meta, items, active, note }: { title: string; meta?: ReactNode; items: string[]; active: number; note?: string }) {
  return (
    <div className="cl-card">
      <div className="cl-card-h">
        <span>{title}</span>
        {meta}
      </div>
      <ul className="cl-focus" style={vars({ "--a": Math.max(0, active) })}>
        {active >= 0 ? <li className="cl-focus-hl" aria-hidden="true" /> : null}
        {items.map((item, i) => (
          <li key={item} className={i === active ? "is-on" : undefined}>
            <span className="cl-focus-dot" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {note ? <p className="cl-card-note">{note}</p> : null}
    </div>
  );
}

const READS = ["Product name and brand", "Price and currency", "Description and key facts", "Product details AI can read", "Where the store sells"];

function Reading({ view, domain }: { view: CheckView; domain: string | null }) {
  const queued = view.status === "queued";
  const active = useCycle(queued ? 0 : READS.length, 1700);
  const lines = queued
    ? ["Starting your check"]
    : [
        domain ? `Opening ${domain}` : "Opening your product page",
        "Reading the title, price and description",
        "Looking for the facts AI likes to quote",
        "Working out where the store sells",
      ];
  return (
    <>
      <Say lines={lines} />
      <div className="cl-cols">
        <Browser product={null} domain={domain} />
        <FocusCard
          title="What we read, like AI does"
          meta={<span className="cl-pill">{queued ? "Starting" : "Reading"}</span>}
          items={READS}
          active={queued ? -1 : active}
          note="We only read what’s public, like an AI assistant."
        />
      </div>
    </>
  );
}

function Writing({ view }: { view: CheckView }) {
  const product = view.product;
  const country = view.country ? CHECK_COUNTRIES[view.country] : null;
  const category = product?.category && product.category !== "product" ? product.category : null;
  const lines = [
    country ? `Thinking like a shopper in ${country}` : "Thinking like a shopper",
    "Writing 3 questions a buyer might ask AI",
    ...(category ? [`Using the words people use for ${category}`] : []),
  ];
  return (
    <>
      <Say lines={lines} />
      <div className="cl-cols">
        <Browser product={product} domain={product?.domain ?? null} />
        <div className="cl-card cl-compose">
          <div className="cl-card-h">
            <span>Buying questions</span>
            <span className="cl-pill">
              <Dots />
              Writing
            </span>
          </div>
          <ol className="cl-compose-rows" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} style={vars({ "--i": i })}>
                <span className="cl-num">{i + 1}</span>
                <span className={`cl-bubble${i === 0 ? " is-typing" : ""}`}>
                  {i === 0 ? (
                    <Dots />
                  ) : (
                    <>
                      <i />
                      <i />
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className="cl-card-note">Shoppers ask AI in full sentences, so we write the questions that way too.</p>
        </div>
      </div>
    </>
  );
}

// ---------- stage 2: asking ----------

/** Slot k (0-17) fills when k answers are in: run 1 first, then question, then engine (a fixed order). */
const slotIndex = (run: number, question: number, engine: number) =>
  run * CHECK_QUESTIONS * CHECK_ENGINES.length + question * CHECK_ENGINES.length + engine;

function Asking({ view }: { view: CheckView }) {
  const questions = view.questions.map((q) => q.text).filter(Boolean);
  // The ticker: an opening line, then every engine with every question, in turn.
  const pairs = questions.flatMap((q) => CHECK_ENGINES.map((e) => ({ engine: e, question: q })));
  const tick = useCycle(pairs.length + 1, 3600);
  const pair = tick > 0 ? pairs[tick - 1] : null;
  const activeQ = pair ? questions.indexOf(pair.question) : -1;
  // Typing the questions in one after the other (only when they arrive while the page is open).
  const [fresh] = useState(canType);
  const delays = questions.map((_, i) => questions.slice(0, i).reduce((sum, q) => sum + q.length * TYPE_MS + 450, 250));
  const total = view.total || SLOTS;
  const filled = Math.round((Math.min(view.done, total) / total) * SLOTS);

  return (
    <>
      <Say
        lines={pair ? [`“${pair.question}”`] : ["Sending your questions to ChatGPT, Gemini and Perplexity"]}
        index={0}
        lead={
          pair ? (
            <span className={`cl-say-lead cl-e-${pair.engine}`} key={tick}>
              Asking {ENGINE_NAMES[pair.engine]}:{" "}
            </span>
          ) : null
        }
      />
      <div className="cl-cols is-ask">
        <div className="cl-card cl-qs">
          <div className="cl-card-h">
            <span>The questions</span>
            <span className="cl-card-meta">Each asked twice</span>
          </div>
          <ol>
            {questions.map((q, i) => (
              <li key={`${i}:${q}`} className={i === activeQ ? "is-on" : undefined}>
                <span className="cl-num">{i + 1}</span>
                <span className="cl-q">{fresh ? <Typed text={q} delay={delays[i]} /> : q}</span>
              </li>
            ))}
          </ol>
          <div className="cl-notes">
            <span className="cl-notes-k">In every answer we note</span>
            <span className="cl-notes-chips">
              <span>Brands named</span>
              <span>Their order</span>
              <span>Sites it links to</span>
            </span>
          </div>
        </div>
        <div className={`cl-net${pair ? "" : " is-all"}`} aria-hidden="true">
          <div className="cl-net-node">
            <Orb big />
          </div>
          <div className="cl-net-wires">
            <svg viewBox="0 0 300 60" preserveAspectRatio="none">
              {CHECK_ENGINES.map((e, i) => (
                <path key={e} d={`M150 0 L${50 + i * 100} 60`} className={!pair || pair.engine === e ? "is-on" : undefined} />
              ))}
            </svg>
            {/* One pulse per question sent, along the wire to the AI the narrator names (all three at the start). */}
            {CHECK_ENGINES.map((e, i) =>
              !pair || pair.engine === e ? (
                <span key={`${e}:${tick}`} className={`cl-pulse is-${i}`}>
                  <i className={`cl-e-${e}`} />
                </span>
              ) : null,
            )}
          </div>
          <ul className="cl-lanes">
            {CHECK_ENGINES.map((e, ei) => (
              <li key={e} className={`cl-lane cl-e-${e}${pair?.engine === e ? " is-on" : ""}`}>
                <span className="cl-lane-ic">{ENGINE_ICONS[e]}</span>
                <span className="cl-lane-n">{ENGINE_NAMES[e]}</span>
                <span className="cl-slots">
                  {Array.from({ length: CHECK_RUNS }, (_, r) =>
                    Array.from({ length: CHECK_QUESTIONS }, (_, q) => {
                      const k = slotIndex(r, q, ei);
                      return <i key={k} className={k < filled ? "is-in" : undefined} style={vars({ "--k": k })} />;
                    }),
                  )}
                </span>
                <span className="cl-lane-s">
                  {filled >= SLOTS ? "Done" : "Asking"}
                  {filled >= SLOTS ? null : <Dots />}
                </span>
              </li>
            ))}
          </ul>
          <p className="cl-net-note">Each question is asked twice, because AI answers change from one ask to the next. One dot for every answer we get back ({SLOTS} in all).</p>
        </div>
      </div>
    </>
  );
}

// ---------- stage 3: writing the report ----------

const COUNTS = ["Who AI recommends instead", "Sites AI trusts for this", "How easy your page is to quote", "Your AI visibility score"];

function Report() {
  const active = useCycle(COUNTS.length, 1700);
  return (
    <>
      <Say lines={["Counting who AI recommends", "Sorting the sites AI linked to", "Checking how easy your page is for AI to quote", "Working out your score"]} />
      <div className="cl-cols">
        <FocusCard
          title="Putting your report together"
          meta={<span className="cl-pill">Writing</span>}
          items={COUNTS}
          active={active}
          note="Only what we saw goes in, from the AI answers and your page. Nothing is made up."
        />
        <div className="cl-card cl-rep" aria-hidden="true">
          <div className="cl-rep-top">
            <span className="cl-rep-ring">
              <svg viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" className="cl-rep-track" />
                <circle cx="32" cy="32" r="26" className="cl-rep-arc" pathLength={100} />
              </svg>
            </span>
            <span className="cl-rep-lines">
              <i />
              <i />
              <i />
            </span>
          </div>
          <ul className="cl-rep-bars">
            {CHECK_ENGINES.map((e, i) => (
              <li key={e} style={vars({ "--i": i })}>
                <span className={`cl-rep-dot cl-e-${e}`} />
                <span className="cl-rep-bar">
                  <i />
                </span>
              </li>
            ))}
          </ul>
          <div className="cl-rep-cards">
            {[0, 1].map((c) => (
              <span key={c} style={vars({ "--i": c })}>
                <i />
                <i />
                <i />
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- frame: progress, steps, facts ----------

/** Time since the check started, m:ss. Empty in the server HTML (the clocks differ); its box keeps its width. */
function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = window.setTimeout(() => setNow(Date.now()), 0); // straight after hydration, not a second later
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  const start = Date.parse(since);
  const s = now === null || !Number.isFinite(start) ? null : Math.max(0, Math.floor((now - start) / 1000));
  return (
    <span className="cl-live-t" aria-hidden="true">
      {s === null ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`}
    </span>
  );
}

/** True once the check has run longer than usual (flips once, client only). */
function useLate(since: string): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const start = Date.parse(since);
    if (!Number.isFinite(start)) return;
    const timer = window.setTimeout(() => setLate(true), Math.max(0, start + USUAL_MAX_MS - Date.now()));
    return () => window.clearTimeout(timer);
  }, [since]);
  return late;
}

function Facts() {
  const [paused, setPaused] = useState(false);
  const i = useCycle(FACTS.length, 8000, paused);
  const fact = FACTS[i];
  return (
    <aside
      className="cl-fact"
      aria-label="Did you know?"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="cl-fact-ic">
        <Bulb />
      </span>
      <div className="cl-fact-in" key={i}>
        <p className="cl-fact-k">Did you know?</p>
        <p className="cl-fact-tx">{fact.text}</p>
        <a className="cl-fact-src" href={fact.url} target="_blank" rel="noopener noreferrer">
          {fact.source}
        </a>
      </div>
      <span className="cl-fact-dots" aria-hidden="true">
        {FACTS.map((f, j) => (
          <i key={f.url} className={j === i ? "is-on" : undefined} />
        ))}
      </span>
    </aside>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = () => {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => setCopied(true))
      .catch(() => {});
  };
  return (
    <button type="button" className={`cl-copy${copied ? " is-done" : ""}`} onClick={copy}>
      {copied ? <Tick /> : <LinkIcon />}
      {copied ? "Link copied" : "Or copy this page’s link"}
    </button>
  );
}

/**
 * Next to the slow step: "No need to wait here", with the email popup one click away (or, once this
 * browser left its email, where the report will go). After 6 minutes it says the check is running long.
 */
function WaitNote({ late }: { late: boolean }) {
  const { lead, open } = useLead();
  if (lead.status !== "none") {
    return (
      <div className="cl-note is-set">
        <p className="cl-note-set" role="status">
          <span className="cl-note-tick">
            <Tick />
          </span>
          <span>
            We’ll email your full report and action plan to {lead.maskedEmail ? <b>{lead.maskedEmail}</b> : "you"} when it’s
            ready. You can close this page.
          </span>
        </p>
        <CopyLink />
      </div>
    );
  }
  return (
    <div className={`cl-note${late ? " is-late" : ""}`}>
      <p className="cl-note-h">{late ? "Taking a little longer than usual" : "No need to wait here"}</p>
      <p>
        {late
          ? "Leave your email and we’ll send your full report and action plan the moment it’s done."
          : "We’ll email your full report and action plan the moment it’s ready."}
      </p>
      <button type="button" className="ck-btn ck-btn-dark cl-note-btn" onClick={() => open("ask")}>
        <MailIcon className="cl-note-btn-ic" />
        Email me the report
      </button>
      <CopyLink />
    </div>
  );
}

/** The 4 steps as a slim strip: done steps are ticks, the current one a pill with its name, the rest dots. */
function StepStrip({ stage }: { stage: Stage }) {
  return (
    <ol className="cl-track" aria-label="Steps">
      {STEPS.map((step, i) => {
        const state = i < stage ? "is-done" : i === stage ? "is-now" : "is-next";
        return (
          <li key={step} className={`cl-step ${state}`} aria-current={i === stage ? "step" : undefined}>
            <span className="cl-node" aria-hidden="true">
              {i < stage ? <Tick /> : i + 1}
            </span>
            {i === stage ? (
              <span className="cl-step-l" aria-hidden="true">
                <span className="cl-step-full">{step}</span>
                <span className="cl-step-short">{STEPS_SHORT[i]}</span>
                <span className="cl-step-tiny">{STEPS_TINY[i]}</span>
              </span>
            ) : null}
            <span className="ck-sr">
              {step}
              {i < stage ? " (done)" : i === stage ? " (now)" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The running check: one slim row (live, which product, answers in), the 4 steps as a strip, a stage that
 * shows the AI at work, and a footer with a sourced fact and the email ask. About the same height in every
 * step, so nothing jumps as the check moves on. Step changes are announced by CheckShell's live region.
 * `url` (optional) is the pasted link: its domain shows in the little browser before the page is read.
 */
export function CheckLive({ view, url = null }: { view: CheckView; url?: string | null }) {
  useEffect(() => {
    hydrated = true;
  }, []);
  const stage = stageOf(view);
  const total = view.total || SLOTS;
  const done = stage === 3 ? total : stage === 2 ? Math.min(view.done, total) : 0;
  const share = total ? done / total : 0;
  const domain = view.product?.domain ?? domainOf(url);
  const brand = view.product?.brand;
  const late = useLate(view.createdAt);

  return (
    <section className="ck-card cl" aria-labelledby="cl-title">
      <div className="cl-head">
        <p className="cl-live">
          <span className="cl-live-dot" aria-hidden="true" />
          Live
          <Elapsed since={view.createdAt} />
          <span className="cl-live-hint">{late ? "taking longer than usual" : "usually 3 to 6 min"}</span>
        </p>
        <h2 className="ck-h2 cl-h" id="cl-title">
          {brand ? `Checking ${brand}` : "Checking your product"}
        </h2>
        <div className="cl-prog">
          <p className="cl-prog-tx">
            <b>{done}</b> of {total} answers in
          </p>
          <div
            className={`cl-bar${stage === 2 ? " is-live" : ""}`}
            role="progressbar"
            aria-label="AI answers in"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            aria-valuetext={`${done} of ${total} answers in`}
          >
            <i style={{ transform: `scaleX(${share})` }} />
          </div>
        </div>
      </div>

      <StepStrip stage={stage} />

      <div className={`cl-stage is-s${stage}`}>
        {stage === 0 ? (
          <Reading key={view.status} view={view} domain={domain} />
        ) : stage === 1 ? (
          <Writing view={view} />
        ) : stage === 2 ? (
          <Asking view={view} />
        ) : (
          <Report />
        )}
      </div>

      <div className="cl-foot">
        <Facts />
        <WaitNote late={late} />
      </div>
    </section>
  );
}
