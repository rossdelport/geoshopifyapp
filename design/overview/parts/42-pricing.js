(function () {
  // Pricing: the Monthly / Yearly switch. Every text that changes carries both versions, data-m (monthly)
  // and data-y (yearly); the page itself holds the monthly one. Without JavaScript the switch stays hidden
  // and each card shows its monthly price with the yearly price as a small line under it.
  var root = document.getElementById('pricing');
  if (!root) return;
  var bar = root.querySelector('.price-toggle');
  if (!bar) return;
  var btns = Array.prototype.slice.call(bar.querySelectorAll('.price-tg[data-period]'));
  var swaps = Array.prototype.slice.call(root.querySelectorAll('[data-m][data-y]'));
  var status = root.querySelector('.price-status');
  if (btns.length < 2 || !swaps.length) return;
  var period = 'm';

  // replay the small fade on the amounts and the line under them (CSS: .is-swap; off for reduced motion)
  function replay(el) {
    el.classList.remove('is-swap');
    void el.offsetWidth;
    el.classList.add('is-swap');
  }

  function set(next) {
    if (next === period) return;
    period = next;
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-period') === period)); });
    swaps.forEach(function (el) { el.textContent = el.getAttribute(period === 'y' ? 'data-y' : 'data-m'); });
    Array.prototype.forEach.call(root.querySelectorAll('.price-amt, .price-alt'), replay);
    // The live page's trial buttons go to /auth/login?plan=..&cycle=..: keep the cycle in step with the toggle.
    Array.prototype.forEach.call(root.querySelectorAll('a.price-btn[data-plan]'), function (a) {
      var href = a.getAttribute('href') || '';
      if (href.indexOf('cycle=') > -1) a.setAttribute('href', href.replace(/cycle=(monthly|yearly)/, 'cycle=' + (period === 'y' ? 'yearly' : 'monthly')));
    });
    if (status) status.textContent = period === 'y' ? 'Yearly prices shown.' : 'Monthly prices shown.';
  }

  btns.forEach(function (b) {
    b.addEventListener('click', function () { set(b.getAttribute('data-period')); });
  });
  root.addEventListener('animationend', function (e) {
    if (e.target.classList && e.target.classList.contains('is-swap')) e.target.classList.remove('is-swap');
  });
  bar.hidden = false;
})();
