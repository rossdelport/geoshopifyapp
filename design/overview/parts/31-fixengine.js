(function () {
  var root = document.querySelector('.fx');
  if (!root) return;
  var tabs = Array.prototype.slice.call(root.querySelectorAll('.fx-row'));
  var panes = Array.prototype.slice.call(root.querySelectorAll('.fx-pane'));
  function show(i, focus) {
    tabs.forEach(function (t, j) {
      var on = j === i;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    panes.forEach(function (p, j) { p.hidden = j !== i; });
    if (focus) tabs[i].focus();
  }
  // Links elsewhere on the page (guide cards) can open a pane: <a href="#fixes" data-fx-pane="3">
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-fx-pane]') : null;
    if (!a) return;
    var n = parseInt(a.getAttribute('data-fx-pane'), 10) - 1;
    if (n >= 0 && n < tabs.length) show(n, false);
  });
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { show(i, false); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, n = tabs.length;
      if (k === 'ArrowDown' || k === 'ArrowRight') { e.preventDefault(); show((i + 1) % n, true); }
      else if (k === 'ArrowUp' || k === 'ArrowLeft') { e.preventDefault(); show((i - 1 + n) % n, true); }
      else if (k === 'Home') { e.preventDefault(); show(0, true); }
      else if (k === 'End') { e.preventDefault(); show(n - 1, true); }
    });
  });
})();
