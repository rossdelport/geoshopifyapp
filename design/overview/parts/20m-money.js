// "See the sales you can trace back to AI": the clickable sample app (CSS in 20m-money.css).
// Tabs (arrow keys, Home, End), a period switch whose numbers count to the new values, questions whose
// rows and AI dots show that AI's answer (left and right arrows on a row switch AI), and a fix that can be
// approved and undone: approving also marks the question it helps in Questions. Motion starts when the app
// scrolls into view; with reduced motion every change is instant and nothing animates.
(function () {
  var root = document.getElementById('money');
  if (!root) return;
  root.classList.add('scr-js'); // the app works: show the hint, let the buttons take clicks
  var stage = root.querySelector('.scr-stage');
  var app = root.querySelector('.scr-app');
  var list = root.querySelector('.scr-tabs');
  if (!stage || !app || !list) return;
  var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
  var live = root.querySelector('#scr-live');
  var rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function still() { return !!(rm && rm.matches); }
  function $(sel, el) { return (el || root).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || root).querySelectorAll(sel)); }

  // Restart a CSS animation class (remove, force a reflow, add back).
  function play(el, cls) {
    if (!el || still()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  // Screen readers hear changes once, in plain words.
  function say(text) {
    if (!live) return;
    live.textContent = '';
    setTimeout(function () { live.textContent = text; }, 60);
  }

  // ---------- numbers ----------
  function commas(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  var fmt = {
    aud: function (n) { return 'A$' + commas(n); },
    int: function (n) { return commas(n); },
    pct: function (n) { return Math.round(n) + '%'; }
  };
  // Sample data. Sources add up to the revenue in both periods.
  var periods = {
    m: { rev: 4820, ord: 61, clk: 1940, revd: 38, ordd: 22, clkd: 51, src: [2640, 880, 760, 540], visd: '▲ 4 in 4 weeks', spark: [34, 35, 35, 37, 38], label: 'Last 4 weeks' },
    all: { rev: 17350, ord: 224, clk: 7310, revd: 29, ordd: 18, clkd: 44, src: [10960, 2740, 2190, 1460], visd: '▲ 9 since joining', spark: [29, 30, 29, 32, 33, 35, 36, 38], label: 'Since joining' }
  };
  var fields = [
    { k: 'rev', f: fmt.aud }, { k: 'ord', f: fmt.int }, { k: 'clk', f: fmt.int },
    { k: 'revd', f: fmt.pct }, { k: 'ordd', f: fmt.pct }, { k: 'clkd', f: fmt.pct },
    { k: 's0', f: fmt.aud, i: 0 }, { k: 's1', f: fmt.aud, i: 1 }, { k: 's2', f: fmt.aud, i: 2 }, { k: 's3', f: fmt.aud, i: 3 },
    { k: 'tot', f: fmt.aud, from: 'rev' }
  ];
  fields.forEach(function (d) { d.el = $('[data-k="' + d.k + '"]'); d.cur = 0; });
  function valueOf(d, p) { return d.i !== undefined ? p.src[d.i] : p[d.from || d.k]; }

  var raf = 0;
  // Count every number from where it is now to period p (instant with reduced motion).
  function countTo(p, ms, fromZero) {
    cancelAnimationFrame(raf);
    var from = fields.map(function (d) { return fromZero ? 0 : d.cur; });
    var to = fields.map(function (d) { return valueOf(d, p); });
    function paint(t) {
      fields.forEach(function (d, i) {
        d.cur = from[i] + (to[i] - from[i]) * t;
        if (d.el) d.el.textContent = d.f(d.cur);
      });
    }
    if (still() || !ms) { paint(1); return; }
    var t0 = 0;
    function step(now) {
      if (!t0) t0 = now;
      var x = Math.min(1, (now - t0) / ms);
      paint(1 - Math.pow(1 - x, 3));
      if (x < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
  }

  // Bars: --w is the share of the biggest source; --from is where the bar starts its animation.
  var bars = $$('.scr-srcbars .scr-grow');
  function setBars(p, fromOld) {
    var max = Math.max.apply(null, p.src);
    bars.forEach(function (b, i) {
      var w = (p.src[i] / max).toFixed(3);
      b.style.setProperty('--from', fromOld ? (b.style.getPropertyValue('--w') || '0') : '0');
      b.style.setProperty('--w', w);
    });
  }

  // Sparkline: same scale in both periods, so the dashed starting line (score 29) never moves.
  var spark = $('.scr-spark');
  var line = $('.scr-sp-line');
  var area = $('.scr-sp-area');
  var dots = $$('.scr-sp-dot, .scr-sp-halo');
  function y(s) { return (52.2 - (s - 29) * 4.6).toFixed(1); }
  function setSpark(p) {
    var n = p.spark.length - 1;
    var pts = p.spark.map(function (s, i) { return (i * 300 / n).toFixed(1) + ',' + y(s); });
    var d = 'M' + pts.join(' L');
    if (line) line.setAttribute('d', d);
    if (area) area.setAttribute('d', d + ' L300,72 L0,72 Z');
    dots.forEach(function (c) { c.setAttribute('cy', y(p.spark[n])); });
  }

  var seg = $('.scr-seg');
  var segBtns = $$('.scr-seg button');
  var visd = $('[data-k="visd"]');
  var period = 'm';
  function setPeriod(key) {
    if (key === period || !periods[key]) return;
    period = key;
    var p = periods[key];
    segBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-period') === key ? 'true' : 'false'); });
    if (seg) seg.setAttribute('data-p', key);
    $('#scr-p-money').classList.remove('is-enter');
    countTo(p, 700);
    setBars(p, true);
    play($('.scr-srcbars'), 'is-grow');
    setSpark(p);
    play(spark, 'is-draw');
    if (visd) visd.textContent = p.visd;
    say(p.label + ': ' + fmt.aud(p.rev) + ' from ' + p.ord + ' AI orders and ' + commas(p.clk) + ' AI clicks.');
  }
  segBtns.forEach(function (b) {
    b.addEventListener('click', function () { setPeriod(b.getAttribute('data-period')); });
  });

  // ---------- tabs ----------
  function panelOf(tab) { return document.getElementById(tab.getAttribute('aria-controls')); }
  function enter(panel) {
    if (still() || !panel) return;
    play(panel, 'is-enter');
    if (panel.id === 'scr-p-money') {
      setBars(periods[period], false);
      play($('.scr-srcbars'), 'is-grow');
      play(spark, 'is-draw');
    } else if (panel.id === 'scr-p-q') {
      play($('.scr-qs'), 'is-pop');
    } else if (panel.id === 'scr-p-riv') {
      play($('.scr-rvl'), 'is-grow');
    }
  }
  function select(tab, focus) {
    var idx = tabs.indexOf(tab);
    if (idx < 0) return;
    var changed = tab.getAttribute('aria-selected') !== 'true';
    tabs.forEach(function (t, i) {
      var on = i === idx;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var p = panelOf(t);
      if (p) p.classList.toggle('is-on', on);
    });
    list.style.setProperty('--n', idx);
    if (focus) tab.focus();
    if (changed) enter(panelOf(tab));
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { select(tab, false); });
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); select(next, true); }
    });
  });
  // The nav is a column in a wide app and a row of tabs in a narrower one (same 860px as the CSS).
  function orient() { list.setAttribute('aria-orientation', app.offsetWidth > 860 ? 'vertical' : 'horizontal'); }
  orient();
  window.addEventListener('resize', orient);

  // ---------- questions ----------
  // A row shows its first AI's answer; a dot shows that AI's answer (#scr-an-<question>-<AI>).
  var qs = $$('.scr-q');
  var answers = $$('.scr-an');
  var go = $('.scr-go');
  var curQ = 0, curE = 0;
  function showAnswer(qi, e, animate) {
    var id = 'scr-an-' + qi + '-' + e;
    qs.forEach(function (o, j) {
      o.setAttribute('aria-pressed', j === qi ? 'true' : 'false');
      $$('.scr-st', o).forEach(function (c) { c.classList.toggle('is-sel', j === qi && +c.getAttribute('data-e') === e); });
    });
    answers.forEach(function (a) { a.classList.toggle('is-on', a.id === id); });
    if (go) {
      var fixable = qs[qi].hasAttribute('data-fix');
      go.classList.toggle('is-shown', fixable);
      go.tabIndex = fixable ? 0 : -1;
      if (fixable) go.removeAttribute('aria-hidden'); else go.setAttribute('aria-hidden', 'true');
    }
    if (animate) play(document.getElementById(id), 'is-enter');
    curQ = qi; curE = e;
  }
  qs.forEach(function (q, i) {
    var first = +q.getAttribute('data-e') || 0;
    q.addEventListener('click', function (ev) {
      var dot = ev.target && ev.target.closest ? ev.target.closest('.scr-st') : null;
      var e = dot ? +dot.getAttribute('data-e') : (i === curQ ? curE : first);
      if (i !== curQ || e !== curE) showAnswer(i, e, true);
    });
    q.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      ev.preventDefault();
      var e = i === curQ ? curE : first;
      showAnswer(i, (e + (ev.key === 'ArrowRight' ? 1 : 2)) % 3, true);
    });
  });
  if (qs.length) showAnswer(0, +qs[0].getAttribute('data-e') || 0, false);
  $$('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = document.getElementById(b.getAttribute('data-go'));
      if (t) select(t, true);
    });
  });

  // ---------- fix: approve and undo ----------
  // Approving shows the fix as live, says when GEO asks AI again, takes one off the Fixes count and marks
  // the question it helps in Questions. Undo puts all of it back.
  var fix = $('.scr-fix');
  var approve = $('.scr-approve');
  var undo = $('.scr-undo');
  var badge = $('.scr-badge');
  var chip = $('.scr-q-live');
  var hideable = [undo, $('.scr-next'), $('.scr-fs-done')];
  var todo = $('.scr-fs-todo');
  function setDone(done) {
    fix.classList.toggle('is-done', done);
    approve.disabled = done;
    undo.tabIndex = done ? 0 : -1;
    hideable.forEach(function (el) { if (!el) return; if (done) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true'); });
    if (todo) { if (done) todo.setAttribute('aria-hidden', 'true'); else todo.removeAttribute('aria-hidden'); }
    if (badge) { badge.textContent = done ? '1' : '2'; play(badge, 'is-bump'); }
    if (chip) { chip.hidden = !done; if (done) play(chip, 'is-enter'); }
    (done ? undo : approve).focus();
    say(done ? 'Pushed to Shopify. GEO asks AI again on Monday. You can undo it.' : 'Undone. The old description is back.');
  }
  if (fix && approve && undo) {
    approve.addEventListener('click', function () { if (!fix.classList.contains('is-done')) setDone(true); });
    undo.addEventListener('click', function () { if (fix.classList.contains('is-done')) setDone(false); });
  }

  // ---------- first look + nudge ----------
  // Before the app is in view: frame tipped back, numbers at zero, bars empty. In view: it all plays once.
  // Then a soft ring on the Questions tab asks for a click, until anyone clicks or types in the app.
  var touched = false;
  var nudgeTimer = 0;
  function stopNudge() {
    touched = true;
    clearTimeout(nudgeTimer);
    tabs.forEach(function (t) { t.classList.remove('is-nudge'); });
  }
  app.addEventListener('pointerdown', stopNudge);
  app.addEventListener('keydown', stopNudge);

  countTo(periods.m, 0);
  // Crawlers and link previews get the finished screen straight away.
  var bot = /bot|crawl|spider|slurp|lighthouse|facebookexternalhit|embedly|preview/i.test(navigator.userAgent || '');
  if (still() || bot || !('IntersectionObserver' in window)) return;
  stage.classList.add('scr-wait');
  fields.forEach(function (d) { d.cur = 0; if (d.el) d.el.textContent = d.f(0); });

  var seen = false;
  new IntersectionObserver(function (entries) {
    var en = entries[0];
    // Only the loops (nudge ring, score ping) pause while the app is off screen; entrances play to the end.
    stage.classList.toggle('scr-off', !en.isIntersecting);
    var enough = en.intersectionRatio >= 0.3 || en.intersectionRect.height > window.innerHeight * 0.4;
    if (seen || !en.isIntersecting || !enough) return;
    seen = true;
    stage.classList.remove('scr-wait');
    stage.classList.add('scr-seen');
    play($('.scr-srcbars'), 'is-grow');
    play(spark, 'is-draw');
    countTo(periods[period], 1100, true);
    nudgeTimer = setTimeout(function () {
      if (!touched && tabs[1] && tabs[1].getAttribute('aria-selected') !== 'true') tabs[1].classList.add('is-nudge');
    }, 2600);
  }, { threshold: [0, 0.15, 0.3, 0.45, 0.6] }).observe(stage);
})();
