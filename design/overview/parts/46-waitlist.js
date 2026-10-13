// Join the waitlist popup (46-waitlist.html). Opens from any [data-waitlist] button, any #waitlist link and an
// address ending in #waitlist (or the old #check). Sends name + email, which button it was, the plan picked
// on a pricing card and where the visit came from (utm_*, fbclid, the referring site) to /waitlist. The design
// preview (no window.GEO_LIVE) shows the done screen without saving. Then: "You're on the waitlist", confetti
// from the top of the screen (not with reduced motion), and a Meta "Lead" event when the Meta pixel is on the page.
(function () {
  var dlg = document.getElementById('waitlist-dialog');
  if (!dlg) return;
  var form = dlg.querySelector('.wl-form');
  var done = dlg.querySelector('.wl-done');
  var err = dlg.querySelector('.wl-err');
  var btn = form.querySelector('.wl-btn');
  var nameIn = form.elements.name;
  var emailIn = form.elements.email;
  var canvas = dlg.querySelector('.wl-confetti');
  var modal = typeof dlg.showModal === 'function';
  var picked = { source: 'link', plan: '' };
  var busy = false;

  // Where the visit came from, kept for this visit (the address loses its ?utm_ part when people move around).
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
  var from = {};
  try { from = JSON.parse(sessionStorage.getItem('geo-wl-from') || '{}') || {}; } catch (e) { from = {}; }
  var q = new URLSearchParams(location.search);
  if (KEYS.some(function (k) { return q.get(k); })) {
    from = {};
    KEYS.forEach(function (k) { if (q.get(k)) from[k] = q.get(k).slice(0, 500); });
  }
  if (!from.referrer && document.referrer && document.referrer.indexOf(location.origin) !== 0) from.referrer = document.referrer.slice(0, 500);
  try { sessionStorage.setItem('geo-wl-from', JSON.stringify(from)); } catch (e) { /* private mode: fine */ }

  function showForm() {
    form.hidden = false;
    done.hidden = true;
    err.hidden = true;
    [nameIn, emailIn].forEach(function (i) { i.removeAttribute('aria-invalid'); });
  }

  function open(source, plan) {
    if (dlg.open) return;
    picked = { source: source || 'link', plan: plan || '' };
    if (!busy) showForm();
    document.documentElement.classList.add('wl-lock');
    if (modal) dlg.showModal(); else dlg.setAttribute('open', '');
    setTimeout(function () { (form.hidden ? done.querySelector('.wl-btn') : nameIn).focus(); }, 30);
  }
  function close() {
    if (modal) dlg.close(); else { dlg.removeAttribute('open'); onClose(); }
  }
  function onClose() {
    document.documentElement.classList.remove('wl-lock');
    stopConfetti();
    if (!form.hidden || busy) return;
    form.reset();
    showForm();
  }
  dlg.addEventListener('close', onClose);
  // A click on the dim area round the card closes it.
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
  Array.prototype.forEach.call(dlg.querySelectorAll('[data-wl-close]'), function (b) { b.addEventListener('click', close); });

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-waitlist], a[href="#waitlist"]') : null;
    if (!el || dlg.contains(el)) return;
    e.preventDefault();
    open(el.getAttribute('data-waitlist'), el.getAttribute('data-plan'));
  });
  function fromHash() {
    if (location.hash !== '#waitlist' && location.hash !== '#check') return;
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    open('link');
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();

  function fail(msg, field) {
    err.textContent = msg;
    err.hidden = false;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    err.hidden = true;
    [nameIn, emailIn].forEach(function (i) { i.removeAttribute('aria-invalid'); });
    var name = nameIn.value.trim();
    var email = emailIn.value.trim();
    if (!name) return fail('Please enter your name.', nameIn);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('Please enter a valid email address.', emailIn);

    var body = new URLSearchParams();
    body.set('name', name);
    body.set('email', email);
    body.set('website', form.elements.website.value);
    body.set('source', picked.source);
    if (picked.plan) {
      body.set('plan', picked.plan);
      var on = document.querySelector('.price-tg[aria-pressed="true"]');
      body.set('cycle', on && on.getAttribute('data-period') === 'y' ? 'yearly' : 'monthly');
    }
    Object.keys(from).forEach(function (k) { body.set(k, from[k]); });

    busy = true;
    btn.disabled = true;
    btn.textContent = 'Joining…';
    var send = window.GEO_LIVE === true
      ? fetch('/waitlist', { method: 'POST', body: body, headers: { Accept: 'application/json' }, credentials: 'same-origin' })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      : new Promise(function (resolve) { setTimeout(function () { resolve({ ok: true }); }, 500); });
    send.then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || 'Something went wrong. Please try again.');
      joined(name, res.isNew === true);
    }).catch(function (x) {
      fail(x && x.message && x.message.indexOf('Failed to fetch') < 0 ? x.message : 'Something went wrong. Please try again.');
    }).then(function () {
      busy = false;
      btn.disabled = false;
      btn.textContent = 'Join the waitlist';
    });
  });

  // The sign-up worked: show "You're on the waitlist!" with confetti, and at that same moment tell Meta "Lead"
  // (the event the ads optimise for: "find more people like this"). Only for a new person, so someone joining
  // twice counts once, like the founder's new sign-up email. No name or email goes to Meta.
  function joined(name, isNew) {
    var first = name.split(' ')[0];
    done.querySelector('.wl-p').textContent = 'Thanks, ' + first + '. We’ll reach out shortly.';
    form.hidden = true;
    done.hidden = false;
    done.querySelector('.wl-h').focus();
    if (!dlg.open) open(picked.source, picked.plan);
    confetti();
    if (isNew && typeof window.fbq === 'function') window.fbq('track', 'Lead', { content_name: 'waitlist' });
  }

  // Confetti: brand-coloured paper falling from the top of the screen for about 4 seconds.
  var raf = 0;
  function stopConfetti() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    var c = canvas.getContext && canvas.getContext('2d');
    if (c) c.clearRect(0, 0, canvas.width, canvas.height);
  }
  function confetti() {
    if (!canvas.getContext || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    stopConfetti();
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = canvas.clientWidth || window.innerWidth;
    var H = canvas.clientHeight || window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var colors = ['#8a5cd8', '#4050b0', '#b5a8e0', '#6878d8', '#e1ccf7', '#6cd68c', '#f0b150', '#0b0c2b'];
    var bits = [];
    var n = W < 600 ? 120 : 200;
    for (var i = 0; i < n; i++) {
      bits.push({
        x: Math.random() * W, y: -10 - Math.random() * H * 0.45,
        w: 6 + Math.random() * 6, h: 9 + Math.random() * 8,
        vx: -1.2 + Math.random() * 2.4, vy: 3 + Math.random() * 3.5,
        r: Math.random() * Math.PI * 2, vr: -0.18 + Math.random() * 0.36,
        sway: Math.random() * Math.PI * 2, color: colors[i % colors.length], round: i % 5 === 0,
      });
    }
    var start = performance.now();
    function frame(t) {
      var age = t - start;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = age > 3400 ? Math.max(0, 1 - (age - 3400) / 700) : 1;
      var falling = false;
      bits.forEach(function (b) {
        b.sway += 0.05;
        b.x += b.vx + Math.sin(b.sway) * 0.9;
        b.y += b.vy;
        b.vy = Math.min(b.vy + 0.035, 6.5);
        b.r += b.vr;
        if (b.y < H + 20) falling = true;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        ctx.fillStyle = b.color;
        if (b.round) { ctx.beginPath(); ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 0.7)) + 2);
        ctx.restore();
      });
      if (falling && age < 4100) raf = requestAnimationFrame(frame);
      else stopConfetti();
    }
    raf = requestAnimationFrame(frame);
  }
})();
