// How it works screens (CSS in 20-how.css): once a screen is well in view, step 2's Approve turns into
// "Pushed to Shopify" (once, after a short pause) and step 3's bars grow. Never with reduced motion: the
// screens then stay as they are in the page (Approve waiting, the bars full).
(function () {
  if (!window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  var fix = document.querySelector('.hs-fix');
  var money = document.querySelector('.hs-money');
  if (!fix && !money) return;
  if (money) money.classList.add('hs-wait');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      if (en.target === money) {
        money.classList.add('hs-grow');
        money.classList.remove('hs-wait');
      } else {
        setTimeout(function () { fix.classList.add('is-done'); }, 1400);
      }
    });
  }, { threshold: 0.6 });
  if (fix) io.observe(fix);
  if (money) io.observe(money);
})();
