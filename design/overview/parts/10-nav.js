(function () {
  var nav = document.querySelector('.nav-wrap');
  if (!nav) return;
  var on = false;
  function check() {
    var next = (window.scrollY || window.pageYOffset || 0) > 8;
    if (next !== on) { on = next; nav.classList.toggle('nav-scrolled', on); }
  }
  window.addEventListener('scroll', check, { passive: true });
  check();

  // Smooth scroll for in-page links (#screens, #pricing, ...), unless the viewer prefers less motion.
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  });
})();
