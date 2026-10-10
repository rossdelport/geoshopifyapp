// Decorative loops (the logo marquee, the scan pulse and spinner, the hub's lines and tiles, the floating
// clay pieces) pause while their part of the page is off screen, so an idle page does no animation work.
// The CSS for .is-off is in 05-shared.css. The hero cards and the FAQ manage their own motion as well.
(function () {
  if (!('IntersectionObserver' in window)) return;
  var els = document.querySelectorAll('.eng-marquee, .how-grid, .hub-map, .hw-wrap, .faq-main');
  if (!els.length) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { en.target.classList.toggle('is-off', !en.isIntersecting); });
  }, { rootMargin: '120px 0px' });
  Array.prototype.forEach.call(els, function (el) { io.observe(el); });
})();
