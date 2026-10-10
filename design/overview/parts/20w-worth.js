(function () {
  var root = document.getElementById('worth');
  if (!root) return;
  var aov = root.querySelector('#worth-aov');
  var orders = root.querySelector('#worth-orders');
  if (!aov || !orders) return;
  var aovOut = root.querySelector('#worth-aov-out');
  var ordersOut = root.querySelector('#worth-orders-out');
  var month = root.querySelector('#worth-month');
  var year = root.querySelector('#worth-year');
  var out = root.querySelector('.worth-out');
  var sum = root.querySelector('#worth-sum');
  var sumYr = root.querySelector('#worth-sum-yr');
  var calm = !window.requestAnimationFrame || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Plain "$" with thousands commas ($12,000). No currency conversion.
  function money(n) {
    return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }
  // Filled part of the track follows the thumb (0 to 1, read by CSS as --p).
  function fill(input) {
    var min = Number(input.min), max = Number(input.max), v = Number(input.value);
    var p = max > min ? (v - min) / (max - min) : 0;
    input.parentNode.style.setProperty('--p', p.toFixed(4));
  }

  // The big monthly and yearly numbers glide to their new values (about 0.4s) instead of jumping.
  // Screen readers get the final sum straight away from the live region below.
  var shown = null, from = null, to = null, t0 = 0, raf = 0;
  function draw(v) { setText(month, money(v.m)); setText(year, money(v.y)); }
  function frame(now) {
    if (!t0) t0 = now;
    var k = Math.min(1, (now - t0) / 420);
    var e = 1 - Math.pow(1 - k, 3);
    shown = { m: from.m + (to.m - from.m) * e, y: from.y + (to.y - from.y) * e };
    draw(k < 1 ? shown : to);
    raf = k < 1 ? requestAnimationFrame(frame) : 0;
  }
  function show(m, y) {
    to = { m: m, y: y };
    if (calm || !shown) { shown = to; draw(to); return; }
    from = shown;
    t0 = 0;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function update() {
    var a = Number(aov.value);
    var o = Number(orders.value);
    var m = a * o;
    var y = m * 12;
    var word = o === 1 ? 'order' : 'orders';
    aov.setAttribute('aria-valuetext', money(a));
    orders.setAttribute('aria-valuetext', o + ' ' + word + ' a month');
    setText(aovOut, money(a));
    setText(ordersOut, String(o));
    show(m, y);
    fill(aov);
    fill(orders);
    // Only changes when the numbers change, so the live region never repeats itself.
    // The yearly figure is shown big on screen; screen readers get it from the hidden tail.
    setText(sum, o + ' ' + word + ' × ' + money(a) + ' = ' + money(m) + ' a month');
    setText(sumYr, ', or ' + money(y) + ' a year.');
  }

  // When a slider is let go (or stepped with the keyboard), the result swells a touch and its ring glows.
  function bump() {
    if (calm || !out || typeof out.animate !== 'function') return;
    var ease = 'cubic-bezier(.3, .7, .3, 1)';
    [month, year].forEach(function (el) {
      if (el) el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.035)' }, { transform: 'scale(1)' }], { duration: 480, easing: ease });
    });
    try { out.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 720, easing: 'ease-out', pseudoElement: '::after' }); } catch (e) { /* older browsers: no ring */ }
  }

  aov.addEventListener('input', update);
  orders.addEventListener('input', update);
  aov.addEventListener('change', bump);
  orders.addEventListener('change', bump);
  // The browser can restore slider positions on back/forward, so sync once on load.
  update();
})();
