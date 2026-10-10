// Decorative loops (the logo marquee, the hero cards and floating clay pieces, the FAQ chat, the how-it-works
// renders, the coins, the Core card's border light (hover only), the closing shop front) pause while their part of the page
// is off screen, so an idle page does no animation work. Missing parts are skipped.
// The CSS for .is-off is in 05-shared.css. The hero cards and the FAQ manage their own motion as well.
(function () {
  if (!('IntersectionObserver' in window)) return;
  var els = document.querySelectorAll('.eng-marquee, .hw-wrap, .faq-main, .how-steps, .worth-art, .price-card-dark, .foot-cta-art');
  if (!els.length) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { en.target.classList.toggle('is-off', !en.isIntersecting); });
  }, { rootMargin: '120px 0px' });
  Array.prototype.forEach.call(els, function (el) { io.observe(el); });
})();

// Rise on scroll: headings and cards below the fold fade in and rise 12px the first time they come into view,
// a few at a time with a small stagger. Content is never hidden without JavaScript, for reduced motion, for
// crawlers, or when it is already on screen as the page loads (so nothing flashes). The hidden state only
// exists on elements this script marks with .rise, and the marks come off once the motion is done, so each
// element goes back to its own styles (hover lifts and so on). Other parts can opt in with data-rise.
(function () {
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var bot = /bot|crawl|spider|slurp|lighthouse|facebookexternalhit|embedly|preview/i.test(navigator.userAgent || '');
  if (calm || bot || !('IntersectionObserver' in window)) return;

  // [selector, stagger in ms between items that come into view together]
  var groups = [
    ['.eng-title, .eng-marquee', 90],
    ['.why .sec-head, .how .sec-head, .faq-head', 0],
    ['.why-stat', 110],
    ['.how-step', 120],
    ['.how-chips li', 140],
    ['.worth-head, .worth-art, .worth-card', 120],
    ['.price-head', 0],
    ['.price-card', 110],
    ['.faq-main', 0],
    ['.foot-cta-tx > *', 90],
    ['.foot-cta-art', 0],
    ['[data-rise]', 90]
  ];
  var vh = window.innerHeight || document.documentElement.clientHeight;
  var step = new Map();
  var marked = [];
  groups.forEach(function (g) {
    Array.prototype.forEach.call(document.querySelectorAll(g[0]), function (el) {
      if (step.has(el)) return;
      step.set(el, g[1]);
      marked.push(el);
    });
  });
  // One layout read for all of them, then the writes.
  var below = marked.filter(function (el) { return el.getBoundingClientRect().top > vh - 8; });
  if (!below.length) return;
  below.forEach(function (el) { el.classList.add('rise'); });

  function done(el) { el.classList.remove('rise', 'rise-go'); el.style.removeProperty('--rise-d'); }
  function go(el, delay) {
    el.style.setProperty('--rise-d', delay + 'ms');
    el.classList.add('rise-go');
    // the longest motion inside (a step number or a tick popping in) ends about 1.1s after the delay
    setTimeout(function () { done(el); }, delay + 1300);
  }

  var io = new IntersectionObserver(function (entries) {
    var hits = entries.filter(function (en) { return en.isIntersecting; });
    if (!hits.length) return;
    // stagger in reading order: top to bottom (rows within 40px count as one), then left to right
    hits.sort(function (a, b) {
      var ra = a.boundingClientRect, rb = b.boundingClientRect;
      return Math.round(ra.top / 40) - Math.round(rb.top / 40) || ra.left - rb.left;
    });
    hits.forEach(function (en, n) {
      io.unobserve(en.target);
      go(en.target, Math.min(n, 5) * (step.get(en.target) || 0));
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
  below.forEach(function (el) { io.observe(el); });

  // Printing or saving the page shows everything at once.
  window.addEventListener('beforeprint', function () { below.forEach(done); });
})();
