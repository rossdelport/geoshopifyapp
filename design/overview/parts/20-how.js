// How it works screens (CSS in 20-how.css): once a small screen is well in view, its parts play in once (the
// sites appear, the ticks pop, the opening line gets its highlight, the "Updated" line lands, the next steps slide
// in). Only for screens below the fold at load, so nothing on screen ever blinks. Never with reduced motion, for
// crawlers or without IntersectionObserver: the screens then simply show their finished picture.
(function () {
  if (!window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (/bot|crawl|spider|slurp|lighthouse|facebookexternalhit|embedly|preview/i.test(navigator.userAgent || '')) return;
  if (!('IntersectionObserver' in window)) return;
  var vh = window.innerHeight || document.documentElement.clientHeight;
  var screens = Array.prototype.filter.call(document.querySelectorAll('.how-vis'), function (el) {
    return el.getBoundingClientRect().top > vh - 8;
  });
  if (!screens.length) return;
  screens.forEach(function (el) { el.classList.add('hv-wait'); });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      io.unobserve(el);
      el.classList.add('hv-go');
      el.classList.remove('hv-wait');
      // the longest part ends about 1.1s in; then the screen goes back to its own styles
      setTimeout(function () { el.classList.remove('hv-go'); }, 1800);
    });
  }, { threshold: 0.6 });
  screens.forEach(function (el) { io.observe(el); });
  // Printing or saving the page shows every screen finished.
  window.addEventListener('beforeprint', function () { screens.forEach(function (el) { el.classList.remove('hv-wait'); }); });
})();
