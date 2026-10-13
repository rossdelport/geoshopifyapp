// AI logo coins (12-engines.html, CSS in 12-engines.css): turns the ring once every 14 seconds, the front coin
// moving right. Each frame only sets each coin's --s and --c (and which coin sits in front); the CSS does the
// rest. Only runs while the ring is on screen. With reduced motion, or without IntersectionObserver, the coins
// stay where the CSS puts them, ChatGPT in front.
(function () {
  var orbit = document.querySelector('.eng-orbit');
  if (!orbit || !window.matchMedia || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var coins = [].slice.call(orbit.querySelectorAll('.eng-coin'));
  var n = coins.length;
  if (!n) return;
  var PERIOD = 14000;
  var raf = 0, start = null, elapsed = 0, running = false;

  function place(t) {
    var base = (t / PERIOD) * Math.PI * 2;
    coins.forEach(function (el, i) {
      var a = base + (i * Math.PI * 2) / n;
      var s = Math.sin(a), c = Math.cos(a);
      el.style.setProperty('--s', s.toFixed(4));
      el.style.setProperty('--c', c.toFixed(4));
      el.style.zIndex = String(Math.round(100 + c * 50));
    });
  }
  function frame(now) {
    if (start === null) start = now - elapsed;
    elapsed = now - start;
    place(elapsed);
    raf = requestAnimationFrame(frame);
  }
  function play() {
    if (running) return;
    running = true;
    start = null;
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  }
  new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) play();
    else pause();
  }, { rootMargin: '80px 0px' }).observe(orbit);
})();
