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
})();
