// "What you get when you join" (11v-video.html): the member tour video only loads once it is near the screen,
// then plays muted and looped, and pauses while it is off screen. Our one small button (play / pause) replaces
// the browser's controls. With reduced motion it never starts by itself: the poster shows with the big play
// button. Phones get the poster of the phone version (the <source media> picks the phone video itself).
(function () {
  var frame = document.querySelector('.vid-frame');
  var v = frame && frame.querySelector('.vid');
  var btn = frame && frame.querySelector('.vid-btn');
  if (!v || !btn) return;
  var mm = window.matchMedia ? function (q) { return window.matchMedia(q).matches; } : function () { return false; };
  if (mm('(max-width: 600px)')) v.setAttribute('poster', v.getAttribute('poster').replace('member-tour-poster', 'member-tour-phone-poster'));
  v.controls = false;
  v.removeAttribute('controls');
  btn.hidden = false;

  var wanted = !mm('(prefers-reduced-motion: reduce)'); // play when on screen, until the visitor pauses it
  function sync() {
    var playing = !v.paused;
    frame.classList.toggle('is-playing', playing);
    btn.setAttribute('aria-label', playing ? 'Pause the example tour' : 'Play the example tour');
  }
  function start() {
    v.preload = 'auto';
    var p = v.play();
    if (p && p.catch) p.catch(sync);
  }
  function toggle() {
    if (v.paused) { wanted = true; start(); } else { wanted = false; v.pause(); }
  }
  v.addEventListener('play', sync);
  v.addEventListener('pause', sync);
  btn.addEventListener('click', toggle);
  v.addEventListener('click', toggle);
  sync();

  if (!('IntersectionObserver' in window)) { if (wanted) start(); return; }
  new IntersectionObserver(function (entries) {
    var near = entries[0].isIntersecting;
    if (near && wanted && v.paused) start();
    else if (!near && !v.paused) v.pause();
  }, { rootMargin: '200px 0px' }).observe(frame);
})();
