(function () {
  var root = document.getElementById('screens');
  if (!root) return;
  var list = root.querySelector('.scr-tabs');
  var scroller = root.querySelector('.scr-tabs-sc');
  if (!list) return;
  var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
  if (!tabs.length) return;

  function reveal(tab, smooth) {
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    var left = tab.offsetLeft - (scroller.clientWidth - tab.offsetWidth) / 2;
    try { scroller.scrollTo({ left: left, behavior: smooth ? 'smooth' : 'auto' }); }
    catch (e) { scroller.scrollLeft = left; }
  }

  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.classList.toggle('scr-off', !on);
    });
    if (focus) tab.focus({ preventScroll: true });
    reveal(tab, true);
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { select(tab, false); });
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); select(next, true); }
    });
  });

  var current = list.querySelector('[aria-selected="true"]');
  if (current) reveal(current, false);
})();
