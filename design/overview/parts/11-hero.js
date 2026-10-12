// Glow round the waitlist box (CSS in 11-hero.css): the travelling light runs once this adds .hc-live, and
// pauses while the box is off screen (.hc-off). Reduced motion: the CSS keeps the still halo, so
// nothing here runs.
(function () {
  var form = document.getElementById('waitlist');
  if (!form || !window.matchMedia) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  form.classList.add('hc-live');
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (entries) {
    form.classList.toggle('hc-off', !entries[0].isIntersecting);
  }, { rootMargin: '60px 0px' }).observe(form);
})();

// Hero cards: their CSS stories start on the finished picture and wait (paused) until they're in view.
// Wide screens (3 cards in a row): one shared timeline, so the whole row starts and pauses together and
// the story runs left to right. 1023px and below (stacked on tablets, a sideways row on phones): each card
// starts when it's in view, including when it is swiped into view.
// Each story plays twice, then rests on the finished picture (see 11-hero.css). Hover and focus do nothing:
// the cards aren't controls. With reduced motion the CSS shows the finished state and nothing here runs.
(function () {
  var row = document.querySelector('.hw');
  if (!row || !window.matchMedia) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cards = [].slice.call(row.querySelectorAll('.hw-card'));
  var wide = window.matchMedia('(min-width: 1024px)');
  row.classList.add('hw-ready');

  if (!('IntersectionObserver' in window)) {
    cards.forEach(function (c) { c.classList.add('is-on'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var on = en.isIntersecting;
      if (en.target === row) cards.forEach(function (c) { c.classList.toggle('is-on', on); });
      else en.target.classList.toggle('is-on', on);
    });
  }, { threshold: 0.3 });

  function watch() {
    io.disconnect();
    cards.forEach(function (c) { c.classList.remove('is-on'); });
    if (wide.matches) io.observe(row);
    else cards.forEach(function (c) { io.observe(c); });
  }
  watch();
  // Crossing 1024px swaps some keyframes, so start every story again from the finished picture.
  function restart() {
    row.classList.remove('hw-ready');
    void row.offsetWidth;
    row.classList.add('hw-ready');
    watch();
  }
  if (wide.addEventListener) wide.addEventListener('change', restart);
  else if (wide.addListener) wide.addListener(restart);
})();
