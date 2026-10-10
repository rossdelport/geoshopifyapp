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

// Hero cards: start each card's animation when it scrolls into view, pause it when it leaves, and
// replay it from the start on hover or keyboard focus. With reduced motion the CSS shows the finished
// state and nothing here runs.
(function () {
  var row = document.querySelector('.hw');
  if (!row) return;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm) return;
  var cards = [].slice.call(row.querySelectorAll('.hw-card'));
  row.classList.add('hw-ready');

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-on', en.isIntersecting); });
    }, { threshold: 0.3 });
    cards.forEach(function (c) { io.observe(c); });
  } else {
    cards.forEach(function (c) { c.classList.add('is-on'); });
  }

  function replay(card) {
    var now = Date.now();
    if (now - (card._hwAt || 0) < 1200) return; // ignore quick in-and-out
    card._hwAt = now;
    card.classList.add('is-on');
    var art = card.querySelector('.hw-art');
    if (art && art.getAnimations) {
      // Only rewind: calling play() would stop the CSS from pausing it when it scrolls away.
      art.getAnimations({ subtree: true }).forEach(function (a) { a.currentTime = 0; });
    }
  }
  cards.forEach(function (c) {
    c.addEventListener('mouseenter', function () { replay(c); });
    c.addEventListener('focusin', function () { replay(c); });
  });
})();
