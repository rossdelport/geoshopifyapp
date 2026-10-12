// Stories row: the cards drift from right to left in a loop (the CSS animation on .stories-track), but only once
// this script says motion is fine (.is-live), so without JavaScript or with reduced motion the row stays still
// and scrolls sideways. Hover and keyboard focus stop it (CSS); the Pause button stops it until pressed again.
// A card reached with the keyboard is moved into view, because the moving track may have carried it off screen.
(function () {
  var sec = document.querySelector('.stories');
  if (!sec) return;
  var view = sec.querySelector('.stories-view');
  var track = sec.querySelector('.stories-track');
  var btn = sec.querySelector('.stories-toggle');
  var txt = btn && btn.querySelector('.stories-toggle-tx');
  if (!view || !track) return;
  var calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function setLive(on) {
    sec.classList.toggle('is-live', on);
    if (btn) btn.hidden = !on;
    if (!on) view.scrollLeft = 0;
  }
  setLive(!(calm && calm.matches));
  if (calm && calm.addEventListener) calm.addEventListener('change', function () { setLive(!calm.matches); });

  if (btn) {
    btn.addEventListener('click', function () {
      var paused = sec.classList.toggle('is-paused');
      if (txt) txt.textContent = paused ? 'Play' : 'Pause';
    });
  }

  // Keyboard focus on a card: move the track so that card sits in the middle of the row (or at the start).
  // Only the first copy's links take focus, so the card is always within the first loop. Mouse clicks are left
  // alone (the card must stay under the pointer).
  view.addEventListener('focusin', function (e) {
    if (!sec.classList.contains('is-live')) return;
    var card = e.target.closest && e.target.closest('li');
    var visible = false;
    try { visible = e.target.matches(':focus-visible'); } catch (err) { visible = true; }
    if (!card || !visible || !track.getAnimations) return;
    var anim = track.getAnimations()[0];
    var copy = track.firstElementChild ? track.firstElementChild.offsetWidth : 0;
    if (!anim || !copy) return;
    var duration = Number(anim.effect && anim.effect.getTiming().duration) || 0;
    var at = Math.max(0, card.offsetLeft - Math.max(16, (view.clientWidth - card.offsetWidth) / 2));
    anim.currentTime = (Math.min(at, copy) / copy) * duration;
    // the browser may have scrolled the row to reach the card; the track's position does that job instead
    view.scrollLeft = 0;
    requestAnimationFrame(function () { view.scrollLeft = 0; });
  });
})();
