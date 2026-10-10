(function () {
  // Why now: each big number rolls up like a counter the first time its card comes into view. The digits
  // stay real text in the page (they hold the width, and copy and find in page use them); the rolling strips
  // are a visual layer on top, hidden from screen readers, which get a plain copy of the number instead.
  // Skipped without IntersectionObserver, for reduced motion, for crawlers, and for numbers already on screen
  // at load. The strips' digits are drawn by CSS (::before), so the page text stays just the real numbers.
  var root = document.getElementById('why');
  if (!root || !('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (/bot|crawl|spider|slurp|lighthouse|facebookexternalhit|embedly|preview/i.test(navigator.userAgent || '')) return;
  var vh = window.innerHeight || document.documentElement.clientHeight;
  var nums = Array.prototype.slice.call(root.querySelectorAll('.why-num'));
  var todo = nums.filter(function (p) { return p.getBoundingClientRect().top > vh - 8; });
  if (!todo.length) return;

  function digitsNode(el) {
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.parentNode.closest && n.parentNode.closest('.why-sr')) return NodeFilter.FILTER_REJECT;
        return /^\s*\d+\s*$/.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    return w.nextNode();
  }
  // "nearly 60×", "60%": the words before the number get a space, the unit sits on it.
  function plain(p) {
    return Array.prototype.map.call(p.childNodes, function (n) {
      var t = n.textContent.trim();
      return n.nodeType === 1 && n.classList.contains('why-pre') ? t + ' ' : t;
    }).join('').replace(/\s+/g, ' ').trim();
  }

  var cards = [];
  todo.forEach(function (p) {
    var t = digitsNode(p);
    if (!t) return;
    var digits = t.data.trim();
    if (!p.querySelector('.why-sr')) {
      var sr = document.createElement('span');
      sr.className = 'why-sr';
      sr.textContent = plain(p);
      var vis = document.createElement('span');
      vis.setAttribute('aria-hidden', 'true');
      while (p.firstChild) vis.appendChild(p.firstChild);
      p.appendChild(vis);
      p.appendChild(sr);
    }
    var frag = document.createDocumentFragment();
    var cols = [];
    digits.split('').forEach(function (d, i) {
      var last = i === digits.length - 1;
      var seq = last ? '01234567890123456789' : '0123456789';
      var col = document.createElement('span');
      col.className = 'why-dg';
      var hold = document.createElement('span');
      hold.className = 'why-dg-hold';
      hold.textContent = d;
      var strip = document.createElement('span');
      strip.className = 'why-dg-strip';
      strip.setAttribute('data-seq', seq.split('').join('\n'));
      col.appendChild(hold);
      col.appendChild(strip);
      frag.appendChild(col);
      // the last digit spins one full turn before it lands; the others count straight up
      cols.push({ strip: strip, to: (last ? 10 : 0) + Number(d), i: i });
    });
    t.parentNode.replaceChild(frag, t);
    p.classList.add('why-roll');
    cards.push({ el: p.closest('.why-stat') || p, cols: cols });
  });
  if (!cards.length) return;

  var io = new IntersectionObserver(function (entries) {
    var n = 0;
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      cards.forEach(function (c) {
        if (c.el !== en.target) return;
        var base = 250 + n++ * 120; // just after the card has risen in
        c.cols.forEach(function (col) {
          col.strip.style.transitionDelay = (base + col.i * 70) + 'ms';
          col.strip.style.transform = 'translate3d(0, ' + -col.to + 'em, 0)';
        });
      });
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.45 });
  cards.forEach(function (c) { io.observe(c.el); });
})();
