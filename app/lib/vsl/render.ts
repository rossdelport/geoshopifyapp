// Draws one niche page (./pages.ts) as the inside of app/home/vsl.html: the top bar, the hero with Ross's video and
// the "Book a call" button right under it, then what they pay now, what ChatGPT said, what we do, the maths, the price,
// questions, a last button and the sources. Pure: app/routes/for.$niche.tsx passes in the file addresses.
// Every piece of text is escaped here, so pages.ts stays plain text.

import { VSL_PRICE, vslBookHref, type Heading, type VslPage } from "./pages";

export interface VslAssets {
  rossPhoto: string;
  /** Ross's video for this page, once he has filmed it. Without one, the frame says it's coming. */
  video?: { src: string; poster: string; captions?: string; width: number; height: number; seconds: number };
  /** Eduardo's review (only drawn on a page with `review`). */
  review?: { src: string; poster: string; captions: string };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const heading = ([grey, dark]: Heading) => `${esc(grey)} <b>${esc(dark)}</b>`;
const TICK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PLAY = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>`;
const SMS = `<a href="sms:+61400369865">0400 369 865</a>`;

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The video frame: Ross's video (loads nothing until played), or a card saying it's coming. */
function videoFrame(page: VslPage, a: VslAssets): string {
  const v = a.video;
  if (!v) {
    return `<div class="vsl vsl-soon" role="img" aria-label="Ross’s video for this page is coming soon">
      <img class="vsl-ross" src="${esc(a.rossPhoto)}" alt="" width="84" height="84" decoding="async">
      <p class="vsl-note"><b>Ross’s video is coming soon.</b>Until then, the short version is below.</p>
    </div>`;
  }
  const track = v.captions ? `<track kind="captions" src="${esc(v.captions)}" srclang="en" label="English" default>` : "";
  return `<div class="vsl${v.height > v.width ? " vsl-tall" : ""}" style="aspect-ratio:${v.width} / ${v.height}">
      <video class="vsl-video" data-video src="${esc(v.src)}" poster="${esc(v.poster)}" width="${v.width}" height="${v.height}" preload="none" playsinline controls tabindex="-1" aria-label="Ross’s video for ${esc(page.eyebrow.replace(/^For /, ""))}">${track}</video>
      <button class="vsl-btn" type="button" data-video-play aria-label="Watch Ross’s video, ${clock(v.seconds)}" hidden><span class="vsl-pill"><span class="vsl-play">${PLAY}</span>Watch Ross <span class="vsl-len">${clock(v.seconds)}</span></span></button>
    </div>`;
}

/** The "Book a call" button with Ross's face and number under it. */
function cta(book: string, label = "Book a free 15 minute call"): string {
  return `<div class="cta">
      <a class="btn btn-pri btn-lg" href="${esc(book)}" data-book>${esc(label)}</a>
      <p class="cta-sub">With Ross, the founder. No obligation. Or text Ross on ${SMS}.</p>
    </div>`;
}

function reviewBlock(a: VslAssets): string {
  if (!a.review) return "";
  const r = a.review;
  return `<section class="sec" aria-labelledby="review-h">
  <div class="wrap narrow">
    <h2 class="h2" id="review-h">Don’t take our word for it. <b>Hear it from Eduardo.</b></h2>
    <div class="rv">
      <div class="rv-frame">
        <video class="rv-video" data-video src="${esc(r.src)}" poster="${esc(r.poster)}" width="540" height="960" preload="none" playsinline controls tabindex="-1" aria-label="Eduardo from Terra Tanks talks about working with Rank with Ross">
          <track kind="captions" src="${esc(r.captions)}" srclang="en" label="English" default>
        </video>
        <button class="vsl-btn" type="button" data-video-play aria-label="Watch Eduardo’s review, 33 seconds" hidden><span class="vsl-pill"><span class="vsl-play">${PLAY}</span>Watch Eduardo <span class="vsl-len">0:33</span></span></button>
      </div>
      <div class="rv-tx">
        <blockquote class="rv-q">
          <p>“We met Ross and he was able to help us understand what we needed to do to rank highly in AI and Google AI.”</p>
          <p>“It’s really helped our brand. We highly recommend it.”</p>
        </blockquote>
        <p class="rv-who"><b>Eduardo</b>, <a href="https://terratanks.com.au/" target="_blank" rel="noopener">Terra Tanks</a>. Stock tank pools in Australia.</p>
        <p class="rv-note">A real client, in his own words. Results are different for every store.</p>
      </div>
    </div>
  </div>
</section>`;
}

/** The inside of <body> for one page. */
export function renderVsl(page: VslPage, a: VslAssets): string {
  const book = vslBookHref(page);
  const costs = page.spend.costs
    .map((c) => `<li class="cost"><b class="cost-v">${esc(c.value)}</b><span class="cost-t">${esc(c.text)}</span></li>`)
    .join("");
  const ours = `<li class="cost cost-ours"><b class="cost-v">${VSL_PRICE}</b><span class="cost-t">Rank with Ross, a month. Done for you.</span></li>`;
  const points = (list: string[]) => list.map((p) => `<li>${TICK}<span>${esc(p)}</span></li>`).join("");
  const help = page.help.items.map((i) => `<li class="hp-it"><i aria-hidden="true"></i><h3>${esc(i.h)}</h3><p>${esc(i.p)}</p></li>`).join("");
  const faq = page.faq.map((f, n) => `<details class="qa"${n === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  const sources = page.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("");
  const maths = page.maths
    ? `<section class="sec" aria-labelledby="maths-h">
  <div class="wrap narrow">
    <h2 class="h2" id="maths-h">${heading(page.maths.h)}</h2>
    <ul class="pts">${points(page.maths.points)}</ul>
  </div>
</section>`
    : "";

  return `<header class="wrap top">
  <a class="logo" href="/" aria-label="Rank with Ross home page"><span class="mark" aria-hidden="true"></span>Rank with Ross</a>
  <a class="btn btn-pri btn-sm" href="${esc(book)}" data-book>Book a call</a>
</header>
<main>
<section class="hero" aria-labelledby="hero-h">
  <div class="wrap narrow">
    <p class="eyebrow">${esc(page.eyebrow)}</p>
    <h1 class="h1" id="hero-h">${heading(page.h1)}</h1>
    <p class="lead">${esc(page.lead)}</p>
    ${videoFrame(page, a)}
    ${cta(book)}
  </div>
</section>

<section class="sec sec-soft" aria-labelledby="spend-h">
  <div class="wrap narrow">
    <h2 class="h2" id="spend-h">${heading(page.spend.h)}</h2>
    <ul class="costs">${costs}${ours}</ul>
    <p class="big-line">${esc(page.spend.line)}</p>
  </div>
</section>

<section class="sec" aria-labelledby="ai-h">
  <div class="wrap narrow">
    <h2 class="h2" id="ai-h">${heading(page.ai.h)}</h2>
    <div class="ask">
      <p class="ask-q"><span class="ask-who">We asked ChatGPT</span>${esc(page.ai.question)}</p>
      <ul class="pts">${points(page.ai.points)}</ul>
    </div>
  </div>
</section>

${reviewBlock(a)}

<section class="sec sec-soft" aria-labelledby="help-h">
  <div class="wrap">
    <h2 class="h2 center" id="help-h">${heading(page.help.h)}</h2>
    <ul class="hp-grid">${help}</ul>
  </div>
</section>

${maths}

<section class="sec" aria-labelledby="price-h">
  <div class="wrap narrow">
    <div class="price">
      <h2 class="price-h" id="price-h"><span class="price-v">${VSL_PRICE}</span> a month</h2>
      <ul class="price-ticks">
        <li>${TICK}We do the work. You run your business.</li>
        <li>${TICK}No lock-in contract. Stop any time.</li>
        <li>${TICK}Full refund if you’re not happy after month 1. You keep the work.</li>
        <li>${TICK}A free 15 minute call with Ross first.</li>
      </ul>
      <a class="btn btn-white btn-lg" href="${esc(book)}" data-book>Book a free 15 minute call</a>
    </div>
  </div>
</section>

<section class="sec sec-soft" aria-labelledby="faq-h">
  <div class="wrap narrow">
    <h2 class="h2" id="faq-h">Questions. <b>Straight answers.</b></h2>
    <div class="faq">${faq}</div>
  </div>
</section>

<section class="sec close" aria-labelledby="close-h">
  <div class="wrap narrow">
    <img class="close-ross" src="${esc(a.rossPhoto)}" alt="Ross Delport, founder of Rank with Ross" width="84" height="84" decoding="async">
    <h2 class="h2" id="close-h">${heading(page.close)}</h2>
    ${cta(book)}
  </div>
</section>
</main>
<footer class="foot">
  <div class="wrap">
    <div class="src">
      <p><b>Where these numbers come from.</b> Google click prices and searches: Google Ads figures from DataForSEO, Australia, November 2025 to October 2026, changed at $1.42 per US$1. All prices on this page are in Australian dollars. ChatGPT answers: asked once each on 17 November 2026, in Australia. Answers change from one ask to the next.</p>
      <ul>${sources}</ul>
      <p>Rank with Ross is not part of OpenAI, Google or any business named on this page. Nobody can promise what AI says, and we don’t.</p>
    </div>
    <p class="foot-links"><span>© 2026 Rank with Ross</span><a href="/">Home</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></p>
  </div>
</footer>`;
}
