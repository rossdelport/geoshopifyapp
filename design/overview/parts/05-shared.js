// Decorative loops (the logo marquee, the hero cards and floating clay pieces, the FAQ chat) pause while
// their part of the page is off screen, so an idle page does no animation work. Missing parts are skipped.
// The CSS for .is-off is in 05-shared.css. The hero cards and the FAQ manage their own motion as well.
(function () {
  if (!('IntersectionObserver' in window)) return;
  var els = document.querySelectorAll('.eng-marquee, .hw-wrap, .faq-main');
  if (!els.length) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { en.target.classList.toggle('is-off', !en.isIntersecting); });
  }, { rootMargin: '120px 0px' });
  Array.prototype.forEach.call(els, function (el) { io.observe(el); });
})();
