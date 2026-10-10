// Hero check form. The live site (window.GEO_LIVE) posts it to /check; the design preview has no
// server, so it shows a note pointing to the live site instead.
(function () {
  var form = document.getElementById('check');
  if (!form) return;
  var input = form.querySelector('.hero-check-input');
  var note = form.querySelector('.hero-check-note');
  var btn = form.querySelector('.hero-check-btn');

  form.addEventListener('submit', function (e) {
    if (window.GEO_LIVE !== true) {
      e.preventDefault();
      note.hidden = false;
      return;
    }
    form.classList.add('is-busy');
    btn.textContent = 'Starting your check…';
  });
  // Coming back with the browser's back button: make the button usable again.
  window.addEventListener('pageshow', function () {
    form.classList.remove('is-busy');
    btn.textContent = 'Check my product';
  });

  // A shorter placeholder on phones so it isn't cut off.
  var long = input.getAttribute('placeholder');
  var narrow = window.matchMedia ? window.matchMedia('(max-width: 480px)') : null;
  function fit() { input.setAttribute('placeholder', narrow && narrow.matches ? 'Paste your product link' : long); }
  if (narrow) { fit(); if (narrow.addEventListener) narrow.addEventListener('change', fit); }

  // "Check a product free" links scroll here; put the cursor in the box on desktop.
  var desktop = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  function focusSoon() { if (desktop) setTimeout(function () { input.focus({ preventScroll: true }); }, 450); }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href="#check"]') : null;
    if (a) focusSoon();
  });
  if (location.hash === '#check') focusSoon();
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
