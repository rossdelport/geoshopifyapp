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

  // "Get your free scan" buttons scroll here; put the cursor in the box on desktop.
  var desktop = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  function focusSoon() { if (desktop) setTimeout(function () { input.focus({ preventScroll: true }); }, 450); }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href="#check"]') : null;
    if (a) focusSoon();
  });
  if (location.hash === '#check') focusSoon();
})();
