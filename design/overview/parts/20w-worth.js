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
  var sum = root.querySelector('#worth-sum');
  var sumYr = root.querySelector('#worth-sum-yr');

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
    setText(month, money(m));
    setText(year, money(y));
    fill(aov);
    fill(orders);
    // Only changes when the numbers change, so the live region never repeats itself.
    // The yearly figure is shown big on screen; screen readers get it from the hidden tail.
    setText(sum, o + ' ' + word + ' × ' + money(a) + ' = ' + money(m) + ' a month');
    setText(sumYr, ', or ' + money(y) + ' a year.');
  }

  aov.addEventListener('input', update);
  orders.addEventListener('input', update);
  // The browser can restore slider positions on back/forward, so sync once on load.
  update();
})();
