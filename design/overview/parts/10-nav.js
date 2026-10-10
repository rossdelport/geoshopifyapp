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

  // Smooth scroll for in-page links (#how, #pricing, ...), unless the viewer prefers less motion.
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

  // Highlight the nav link for the section in view (cobalt), so readers know where they are.
  var links = [].slice.call(nav.querySelectorAll('.nav-links a[href^="#"]'));
  if (!('IntersectionObserver' in window) || !links.length) return;
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var a = byId[en.target.id];
      if (!a) return;
      if (en.isIntersecting) {
        links.forEach(function (l) { l.classList.remove('is-on'); l.removeAttribute('aria-current'); });
        a.classList.add('is-on');
        a.setAttribute('aria-current', 'location');
      } else if (a.classList.contains('is-on')) {
        a.classList.remove('is-on');
        a.removeAttribute('aria-current');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
})();
