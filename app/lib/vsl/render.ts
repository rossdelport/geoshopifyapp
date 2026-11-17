// Draws one niche page (./pages.ts) as the inside of app/home/vsl.html. The flow (Ross, 17 Nov 2026, from the sketch
// inspired by forgoodprofits.com): a dark top with Ross's hello and the heading, Ross's video overlapping onto the white
// page with the "Book a call" button right under it, Eduardo's review (every page), "Sound familiar?" (3 problems
// with line drawings), the honest table against agencies, one big line on a dark band,
// the 3 steps and the price, the questions and the sources. Pure: app/routes/for.$niche.tsx passes in the file
// addresses. Every piece of text is escaped here, so pages.ts stays plain text. The drawings are our own.

import { AGENCY_PRICE, VSL_PRICE, vslBookHref, type Drawing, type VslPage, type VslRow } from "./pages";

export interface VslAssets {
  /** Ross's face, small and square. */
  rossPhoto: string;
  /** A wide photo of Ross for the video frame while his video isn't ready. */
  cover: string;
  /** Ross's video for this page, once he has filmed it. Without one, the frame says it's coming. */
  video?: { src: string; poster: string; captions?: string; width: number; height: number; seconds: number };
  /** Eduardo's review (every page has it since 17 Nov 2026; left out, the page has no review). */
  review?: { src: string; poster: string; captions: string };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const TICK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PLAY = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>`;
const SMS = `<a href="sms:+61400369865">0400 369 865</a>`;
const CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`;
// The hand-drawn arrow from "Watch this first!" down to the video
const ARROW = `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M70 6C92 30 70 64 22 82" stroke-dasharray="6 7"/><path d="M34 70L20 83l17 7"/></svg>`;

// Our own simple line drawings (Ross, 17 Nov 2026: "super simple illustrations to match the text"), one per row, in ink
// with a touch of purple, drawn through a slight wobble (the #rr-rough filter) so they look hand drawn. Each one shows
// its row's words: as many names as AI gave, and the row's own number on the price tag. viewBox 320 x 200.
const INK = `fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const P = "#6c5cf2";
const SOFT = "#efecff";
const SERIF = `font-family="Georgia,serif" font-weight="700" stroke="none"`;

/** A number on a little purple price tag, centred on (x, y). Drawn without the wobble, so the number stays easy to read. */
function priceTag(text: string, x: number, y: number, tilt = -8): string {
  const w = Math.max(64, 26 + text.length * 13);
  const size = text.length > 6 ? 17 : 21;
  return `<g transform="rotate(${tilt} ${x} ${y})"><path d="M${x - w / 2 + 14} ${y - 23}h${w - 14}a6 6 0 0 1 6 6v34a6 6 0 0 1-6 6h${-(w - 14)}l-14-23z" fill="${SOFT}" stroke="${P}"/><circle cx="${x - w / 2 + 12}" cy="${y}" r="3.5" stroke="${P}"/><text x="${x + 6}" y="${y + 7}" text-anchor="middle" font-size="${size}" fill="${P}" ${SERIF}>${esc(text)}</text></g>`;
}

/** Each drawing: its lines (drawn with the wobble), then anything with words or numbers in it (drawn without). */
const DRAWINGS: Record<Drawing, (r: VslRow) => [lines: string, clean?: string]> = {
  // ChatGPT's answer: the question, then as many names as it gave. A shop outside the list wonders why it isn't there.
  chat: (r) => {
    const n = Math.min(Math.max(r.names ?? 3, 1), 5);
    const lens = [96, 78, 108, 70, 88];
    const lines = Array.from({ length: n }, (_, i) => `<path d="M60 ${92 + i * 19}h${lens[i]}"/>`).join("");
    const numbers = Array.from({ length: n }, (_, i) => `<text x="44" y="${97 + i * 19}" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="currentColor" stroke="none">${i + 1}</text>`).join("");
    return [`<rect x="22" y="12" width="210" height="178" rx="16" fill="#fff"/><path d="M22 38h210"/>
      <circle cx="40" cy="25" r="3" fill="currentColor"/><circle cx="52" cy="25" r="3" fill="currentColor"/><circle cx="64" cy="25" r="3" fill="currentColor"/>
      <rect x="100" y="50" width="118" height="24" rx="12" fill="${SOFT}" stroke="${P}"/><path d="M114 62h78" stroke="${P}"/>${lines}
      <path d="M248 140h56v46h-56z" fill="#fff"/><path d="M242 140l10-16h48l10 16"/><path d="M268 186v-20h16v20"/>
      <path d="M266 76c5-10 18-10 18 2s-11 9-11 20" stroke="${P}"/><circle cx="273" cy="110" r="2.5" fill="${P}" stroke="${P}"/>`, numbers];
  },
  // a search, a pointer clicking it, and the price of that one click
  click: (r) => [`<rect x="20" y="84" width="176" height="48" rx="24" fill="#fff"/><path d="M44 108h96"/><circle cx="168" cy="106" r="9"/><path d="M175 113l8 8"/>
    <path d="M140 126l14 58 13-19 21 24 11-9-21-24 22-6z" fill="#fff"/><path d="M194 86l10-10M204 102h12M190 70l2-12" stroke="${P}"/>`, priceTag(r.tag ?? "$", 258, 60)],
  // one lead (a customer's name and number on a card) and what it costs
  lead: (r) => [`<rect x="24" y="44" width="186" height="118" rx="14" fill="#fff"/><circle cx="66" cy="88" r="20" fill="${SOFT}" stroke="${P}"/>
    <path d="M44 140c4-16 14-24 22-24s18 8 22 24"/><path d="M104 82h80M104 102h56M104 132h64"/>
    <path d="M184 128c-2 2-2 6 0 10l3 3c3 3 7 4 9 2l2-2-4-3-3 1c-2-1-4-3-4-5l1-3z" fill="currentColor"/>`, priceTag(r.tag ?? "$", 258, 60)],
  // a long bill, with the total on a tag
  bill: (r) => [`<path d="M78 14h96v176l-12-9-12 9-12-9-12 9-12-9-12 9-12-9-12 9z" fill="#fff"/>
    <path d="M96 42h58M96 64h40M96 86h52M96 108h36"/><path d="M96 140h58" stroke-width="4"/>`, priceTag(r.tag ?? "$$$", 236, 132, -10)],
  // a search box, and the searches a month as bars, the number on a tag
  search: (r) => [`<rect x="20" y="22" width="184" height="44" rx="22" fill="#fff"/><path d="M44 44h104"/><circle cx="178" cy="42" r="9"/><path d="M185 49l8 8"/>
    <path d="M24 186h170"/><rect x="34" y="150" width="28" height="36" fill="#fff"/><rect x="76" y="128" width="28" height="58" fill="#fff"/>
    <rect x="118" y="104" width="28" height="82" fill="#fff"/><rect x="160" y="80" width="28" height="106" fill="${SOFT}" stroke="${P}"/>`, priceTag(r.tag ?? "", 258, 112, -6)],
};

/** The drawings for the 3 steps: Ross's video, a 15 minute call, and the work with a weekly report. viewBox 160 x 100. */
const STEP_DRAWINGS = [
  `<rect x="22" y="10" width="116" height="72" rx="10" fill="#fff"/><circle cx="80" cy="46" r="17" fill="${P}" stroke="${P}"/><path d="M75 37v18l14-9z" fill="#fff" stroke="#fff" stroke-width="2"/><path d="M60 92h40M80 82v10"/>`,
  `<rect x="20" y="16" width="70" height="74" rx="8" fill="#fff"/><path d="M20 34h70" /><path d="M38 10v12M72 10v12"/>
    <path d="M108 30c-6 6-6 18 0 30l8 10c10 10 22 14 30 8l4-6-12-10-8 4c-6-2-12-10-12-16l4-8-10-12z" fill="${SOFT}" stroke="${P}"/>`,
  `<rect x="18" y="12" width="74" height="80" rx="8" fill="#fff"/><path d="M42 8h26v12H42z" fill="#fff"/>
    <path d="M30 40l5 5 9-10M30 60l5 5 9-10" stroke="#15803d"/><path d="M52 40h28M52 60h28M52 80h20"/>
    <rect x="104" y="44" width="46" height="32" rx="4" fill="${SOFT}" stroke="${P}"/><path d="M104 46l23 17 23-17" stroke="${P}"/>`,
];

/** The wobble that makes the drawings look hand drawn (defined once, used by every drawing). */
const ROUGH = `<svg class="sr" aria-hidden="true" focusable="false"><filter id="rr-rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter></svg>`;

function drawing(r: VslRow): string {
  const [lines, clean = ""] = DRAWINGS[r.draw](r);
  return `<div class="doodle" aria-hidden="true"><svg viewBox="0 0 320 200" ${INK}><g filter="url(#rr-rough)">${lines}</g>${clean}</svg></div>`;
}

function stepDrawing(n: number): string {
  const clean = n === 1 ? `<text x="55" y="74" text-anchor="middle" font-size="28" fill="${P}" ${SERIF}>15</text>` : "";
  return `<svg class="step-pic" viewBox="0 0 160 100" ${INK} aria-hidden="true"><g filter="url(#rr-rough)">${STEP_DRAWINGS[n]}</g>${clean}</svg>`;
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The video frame: Ross's video (loads nothing until played), or his photo with a note that the video is coming. */
function videoFrame(page: VslPage, a: VslAssets): string {
  const v = a.video;
  if (!v) {
    return `<div class="vsl vsl-soon">
      <img class="vsl-cover" src="${esc(a.cover)}" alt="Ross Delport, founder of Rank with Ross" width="1280" height="720" decoding="async" fetchpriority="high">
      <p class="vsl-pill"><span class="vsl-play vsl-clock">${CLOCK}</span><span><b>My video for you is coming soon.</b><small>Until then, the short version is below.</small></span></p>
    </div>`;
  }
  const track = v.captions ? `<track kind="captions" src="${esc(v.captions)}" srclang="en" label="English" default>` : "";
  return `<div class="vsl${v.height > v.width ? " vsl-tall" : ""}" style="aspect-ratio:${v.width} / ${v.height}">
      <video class="vsl-video" data-video src="${esc(v.src)}" poster="${esc(v.poster)}" width="${v.width}" height="${v.height}" preload="none" playsinline controls tabindex="-1" aria-label="Ross’s video for ${esc(page.label.toLowerCase())}s">${track}</video>
      <button class="vsl-btn" type="button" data-video-play aria-label="Watch Ross’s video, ${clock(v.seconds)}" hidden><span class="vsl-pill"><span class="vsl-play">${PLAY}</span><span><b>Hi, I’m Ross. Watch this first.</b><small>${clock(v.seconds)} · Captions on</small></span></span></button>
    </div>`;
}

/** The "Book a call" button with Ross's number under it. */
function cta(book: string): string {
  return `<div class="cta">
      <a class="btn btn-pri btn-lg" href="${esc(book)}" data-book>Book a free 15 minute call</a>
      <p class="cta-sub">15 minutes with me. No obligation. Or text me: ${SMS}</p>
    </div>`;
}

/** A section's small handwritten line and its heading. */
function head(kick: string, h: string, id: string): string {
  return `<div class="sec-head"><p class="kick">${esc(kick)}</p><h2 class="h2" id="${id}">${esc(h)}</h2></div>`;
}

function rows(list: VslRow[]): string {
  return `<div class="rows">${list
    .map(
      (r) => `<div class="row">${drawing(r)}<div class="row-tx fade"><h3>${esc(r.h)}</h3><p>${esc(r.p)}</p>${
        r.note ? `<p class="note">${esc(r.note)}</p>` : ""
      }</div></div>`,
    )
    .join("")}</div>`;
}

function reviewBlock(a: VslAssets, store: boolean): string {
  if (!a.review) return "";
  const r = a.review;
  return `<section class="proof" aria-labelledby="review-h">
  <div class="wrap proof-in">
    <div class="rv-frame">
      <video class="rv-video" data-video src="${esc(r.src)}" poster="${esc(r.poster)}" width="540" height="960" preload="none" playsinline controls tabindex="-1" aria-label="Eduardo from Terra Tanks talks about working with Rank with Ross">
        <track kind="captions" src="${esc(r.captions)}" srclang="en" label="English" default>
      </video>
      <button class="vsl-btn rv-btn" type="button" data-video-play aria-label="Watch Eduardo’s review, 33 seconds" hidden><span class="vsl-play">${PLAY}</span></button>
    </div>
    <div>
      <p class="kick">Don’t take my word for it</p>
      <h2 class="h2" id="review-h">Hear it from Eduardo.</h2>
      <blockquote class="rv-q"><p>“We met Ross and he was able to help us understand what we needed to do to rank highly in AI and Google AI.”</p></blockquote>
      <p class="rv-who"><b>Eduardo</b>, <a href="https://terratanks.com.au/" target="_blank" rel="noopener">Terra Tanks</a>. Stock tank pools in Australia.</p>
      <p class="rv-note">A real client, in his own words. Results are different for every ${store ? "store" : "business"}.</p>
    </div>
  </div>
</section>`;
}

/** Eduardo's second line, big, after the table. */
function pullQuote(a: VslAssets): string {
  if (!a.review) return "";
  return `<section class="pull" aria-label="What Eduardo said">
  <div class="wrap">
    <blockquote class="pull-q"><p>“It’s really helped our brand. We highly recommend it.”</p></blockquote>
    <p class="pull-who"><img src="${esc(a.review.poster)}" alt="" width="56" height="56" loading="lazy" decoding="async"><span><b>Eduardo</b>, Terra Tanks</span></p>
  </div>
</section>`;
}

/** The inside of <body> for one page. */
export function renderVsl(page: VslPage, a: VslAssets): string {
  const book = vslBookHref(page);
  const store = Boolean(page.shopify);
  const faq = page.faq.map((f, n) => `<details class="qa"${n === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  const sources = page.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("");

  return `${ROUGH}
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="/" aria-label="Rank with Ross home page"><span class="mark" aria-hidden="true"></span>Rank with Ross</a>
    <div class="top-r"><span class="top-txt">Text me: ${SMS}</span><a class="btn btn-pri btn-sm" href="${esc(book)}" data-book>Book a call</a></div>
  </div>
</header>
<main>
<section class="hero" aria-labelledby="hero-h">
  <div class="wrap hero-in">
    <p class="hi">${esc(page.hi)}</p>
    <h1 class="h1" id="hero-h">${esc(page.h1[0])} <em>${esc(page.h1[1])}</em></h1>
    <p class="lead">${esc(page.lead)}</p>
    <p class="hero-note" aria-hidden="true">Watch this first!${ARROW}</p>
  </div>
</section>
<section class="video" aria-label="Ross’s video">
  <div class="wrap">
    ${videoFrame(page, a)}
    ${cta(book)}
  </div>
</section>

${reviewBlock(a, store)}

<section class="sec" aria-labelledby="problems-h">
  <div class="wrap">
    ${head("Sound familiar?", store ? "Your shoppers ask AI now." : "Your customers ask AI now.", "problems-h")}
    ${rows(page.problems)}
  </div>
</section>

<section class="sec sec-soft" aria-labelledby="table-h">
  <div class="wrap">
    ${head("The honest comparison", "Agency work. Not agency prices.", "table-h")}
    <div class="tbl"><table>
      <thead><tr><th><span class="sr">What</span></th><th class="me"><span class="mark" aria-hidden="true"></span>Me</th><th>A big agency</th></tr></thead>
      <tbody>
        <tr><th scope="row">Price a month</th><td class="me">${VSL_PRICE}</td><td>${AGENCY_PRICE}</td></tr>
        <tr><th scope="row">Lock-in contract</th><td class="me"><b class="ok">None.</b> Stop any time</td><td>Check their contract</td></tr>
        <tr><th scope="row">Not happy after month 1?</th><td class="me"><b class="ok">Full refund</b></td><td>Check their terms</td></tr>
        <tr><th scope="row">Who you talk to</th><td class="me">Me, Ross. Text me any time</td><td>Whoever is assigned to you</td></tr>
      </tbody>
    </table></div>
    <p class="tbl-src">Agency prices: Optimising’s price guide for Australia.</p>
  </div>
</section>

${pullQuote(a)}

<section class="band" aria-label="What it’s worth">
  <div class="wrap">
    <p class="band-line">${esc(page.big.line)}</p>
    <p class="band-note">${esc(page.big.note)}</p>
    <p class="sig" aria-hidden="true">Ross</p>
  </div>
</section>

<section class="sec" aria-labelledby="start-h">
  <div class="wrap">
    ${head("Want to work with me?", "Here’s how we start.", "start-h")}
    <ol class="steps">
      <li><span class="n">1</span>${stepDrawing(0)}<h3>Watch my video</h3><p>See how AI picks who to name, and how I help.</p></li>
      <li><span class="n">2</span>${stepDrawing(1)}<h3>Book a free call</h3><p>15 minutes with me. No obligation. I’ll tell you straight if I can help.</p></li>
      <li><span class="n">3</span>${stepDrawing(2)}<h3>I do the work</h3><p>One short call to start. I do the rest and send you a report each week.</p></li>
    </ol>
    <div class="price">
      <p class="price-note" aria-hidden="true">I only take 5 clients at a time</p>
      <h2 class="price-h"><span class="price-v">${VSL_PRICE}</span> a month</h2>
      <ul class="price-ticks">
        <li>${TICK}Done for you, start to finish</li>
        <li>${TICK}Full refund if you’re not happy after month 1</li>
        <li>${TICK}No lock-in contract. Stop any time</li>
      </ul>
      <a class="btn btn-pri btn-lg" href="${esc(book)}" data-book>Book a free 15 minute call</a>
      <p class="price-me"><img src="${esc(a.rossPhoto)}" alt="" width="44" height="44" loading="lazy" decoding="async"><span>Or text me: ${SMS}</span></p>
    </div>
  </div>
</section>

<section class="sec sec-soft" aria-labelledby="faq-h">
  <div class="wrap narrow">
    ${head("Questions?", "Straight answers.", "faq-h")}
    <div class="faq">${faq}</div>
  </div>
</section>
</main>
<footer class="foot">
  <div class="wrap">
    <div class="foot-top">
      <a class="logo" href="/" aria-label="Rank with Ross home page"><span class="mark" aria-hidden="true"></span>Rank with Ross</a>
      <p>Perth, Western Australia · Text me: ${SMS}</p>
    </div>
    <div class="src">
      <p><b>Where these numbers come from.</b> Google click prices and searches: Google Ads figures from DataForSEO, Australia, November 2025 to October 2026, changed at $1.42 per US$1. All prices on this page are in Australian dollars. ChatGPT answers: asked once each on 17 November 2026, in Australia. Answers change from one ask to the next.</p>
      <ul>${sources}</ul>
      <p>Rank with Ross is not part of OpenAI, Google or any business named on this page. Nobody can promise what AI says, and I don’t.</p>
    </div>
    <p class="foot-links"><span>© 2026 Rank with Ross</span><a href="/">Home</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></p>
  </div>
</footer>`;
}
