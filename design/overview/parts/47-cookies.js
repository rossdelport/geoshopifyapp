// Cookie notice (47-cookies.html) for the Meta pixel in the live page's head (pixel-head.js), which defines
// window.geoPixel. Shows until the visitor picks: "OK" starts the pixel (in Europe and the UK it waits for this),
// "No thanks" stops it. The choice is kept in this browser as "geo-cookies".
(function () {
  var box = document.getElementById('ck');
  if (!box || typeof window.geoPixel !== 'function') return; // the design preview has no pixel and no notice
  var KEY = 'geo-cookies', choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) { /* storage blocked: ask */ }
  if (choice === 'yes' || choice === 'no') return;
  if (window.GEO_ASK_FIRST) box.querySelector('.ck-q').textContent = 'Can we use cookies to see which of our ads work?';
  function pick(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* not saved: asks again next visit */ }
    if (value === 'yes') window.geoPixel();
    else if (typeof window.fbq === 'function') window.fbq('consent', 'revoke');
    box.hidden = true;
  }
  box.querySelector('.ck-ok').addEventListener('click', function () { pick('yes'); });
  box.querySelector('.ck-no').addEventListener('click', function () { pick('no'); });
  box.hidden = false;
})();
