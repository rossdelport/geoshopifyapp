// Meta Pixel for GEO's own ads, added to the live home page's <head> only
// (assemble.mjs; the design preview never loads it). Meta's base code, with one change: visitors in Europe and
// the UK (guessed from the browser's time zone) are asked first, so it waits for "OK" on the cookie notice
// (parts/47-cookies.*). Everyone else gets it at once unless they said "No thanks" before. The choice is kept in
// this browser as "geo-cookies" (yes or no). There is no <noscript> image: without JavaScript nobody can say no.
// The waitlist popup (parts/46-waitlist.js) sends "Lead" when someone joins; no name or email goes to Meta.
(function () {
  var choice = null, zone = '';
  try { choice = localStorage.getItem('geo-cookies'); } catch (e) { /* storage blocked: ask again */ }
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* no time zone: not asked first */ }
  window.GEO_ASK_FIRST = /^(Europe\/|Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe))/.test(zone);
  window.geoPixel = function () {
    if (window.fbq) return;
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', '28710910728563304');
    window.fbq('track', 'PageView');
  };
  if (choice === 'yes' || (choice !== 'no' && !window.GEO_ASK_FIRST)) window.geoPixel();
})();
