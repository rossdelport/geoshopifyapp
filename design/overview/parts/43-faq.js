(function () {
  // FAQ chat: the first question starts open; the others wait as question chips under the chat (up to
  // SHOW unanswered at a time; answering one adds the next to the end of the row). Choosing one adds it to
  // the conversation, shows the assistant typing for a moment, then the answer. The chip stays where it
  // was, marked as answered, so nothing moves under the pointer. Every pair is real text in the HTML: this
  // only hides, moves and shows it. Waiting pairs use hidden="until-found", so find in page still reaches
  // them (and opens them).
  var root = document.getElementById('faq');
  if (!root) return;
  var chat = root.querySelector('.faq-chat');
  var log = root.querySelector('.faq-log');
  var thread = root.querySelector('.faq-thread');
  var sugg = root.querySelector('.faq-sugg');
  var list = root.querySelector('.faq-sugg-list');
  var reset = root.querySelector('.faq-reset');
  var title = root.querySelector('.faq-sugg-title');
  var titleText = title ? title.textContent : '';
  if (!chat || !log || !thread || !sugg || !list) return;
  var pairs = Array.prototype.slice.call(thread.querySelectorAll('.faq-pair'));
  if (pairs.length < 2) return;

  var SHOW = 5; // unanswered chips on show at once (all five, so skimmers see every question)
  var motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(motion && motion.matches); }

  var SEND_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';
  var DONE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  var asked = 0;
  var pending = null;
  var chips = []; // { pair, li, btn }

  // the "typing" row reuses the avatar; screen readers skip it (the answer itself is announced)
  var typing = document.createElement('div');
  typing.className = 'faq-msg faq-msg-a faq-typing';
  typing.setAttribute('aria-hidden', 'true');
  typing.innerHTML = '<span class="faq-av"><i></i><i></i></span><div class="faq-bub"><span></span><span></span><span></span></div>';

  function questionText(pair) {
    var q = pair.querySelector('.faq-q');
    return q ? q.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function scrollLog(top) {
    var max = log.scrollHeight - log.clientHeight;
    var y = Math.max(0, Math.min(top, max));
    if (typeof log.scrollTo === 'function') log.scrollTo({ top: y, behavior: reduced() ? 'auto' : 'smooth' });
    else log.scrollTop = y;
  }

  // If the conversation isn't fully on screen (a phone, with the question list below it), bring the
  // page to it first, so the answer appears where the person is looking. The floating nav is measured.
  function revealChat() {
    var bar = document.querySelector('.nav-bar');
    var top = (bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 84) + 12;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var lr = log.getBoundingClientRect();
    if (lr.top >= top - 1 && lr.bottom <= vh + 1) return;
    var cr = chat.getBoundingClientRect();
    // The whole chat fits: line its bottom up with the bottom of the screen. Else put the conversation's top under the nav.
    var dy = cr.height <= vh - top - 12 ? cr.bottom - (vh - 12) : lr.top - top;
    if (Math.abs(dy) < 2) return;
    try { window.scrollBy({ top: dy, behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { window.scrollBy(0, dy); }
  }

  function makeChip(pair) {
    var li = document.createElement('li');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'faq-chip';
    btn.setAttribute('aria-controls', pair.id);
    var tx = document.createElement('span');
    tx.className = 'faq-chip-tx';
    tx.textContent = questionText(pair);
    var ic = document.createElement('span');
    ic.className = 'faq-chip-ic';
    ic.innerHTML = SEND_ICON;
    btn.appendChild(tx);
    btn.appendChild(ic);
    var chip = { pair: pair, li: li, btn: btn, ic: ic, done: false };
    btn.addEventListener('click', function () { ask(chip, false); });
    li.appendChild(btn);
    return chip;
  }

  function markDone(chip, done) {
    chip.done = done;
    chip.li.classList.toggle('is-done', done);
    chip.btn.disabled = done;
    chip.ic.innerHTML = done ? DONE_ICON : SEND_ICON;
    var note = chip.btn.querySelector('.faq-sr');
    if (done && !note) {
      note = document.createElement('span');
      note.className = 'faq-sr';
      note.textContent = ' (answered above)';
      chip.btn.insertBefore(note, chip.ic);
    } else if (!done && note) {
      chip.btn.removeChild(note);
    }
  }

  // answered chips stay put; of the unanswered ones, the first SHOW are on show. A chip that appears is
  // always after the visible ones, so it joins the end of the row and nothing shifts.
  function layout() {
    var open = 0;
    chips.forEach(function (c) {
      if (c.done) { c.li.hidden = false; return; }
      c.li.hidden = open >= SHOW;
      open += 1;
    });
  }

  function syncState() {
    var left = chips.filter(function (c) { return !c.done; }).length;
    if (reset) reset.hidden = asked === 0;
    if (title) title.textContent = left ? titleText : 'That’s every question';
  }

  // the next question to focus after `chip`: the next unanswered visible chip, else an earlier one, else "Start over"
  function nextTarget(chip) {
    var at = chips.indexOf(chip);
    var open = function (c) { return !c.done && !c.li.hidden; };
    for (var i = at + 1; i < chips.length; i++) if (open(chips[i])) return chips[i].btn;
    for (var j = at - 1; j >= 0; j--) if (open(chips[j])) return chips[j].btn;
    return reset && !reset.hidden ? reset : log;
  }

  // in the sideways row on phones, make sure a chip focused from the keyboard isn't cut off (after a tap
  // the row stays put, so nothing moves under the finger)
  function showInRow(el) {
    if (!el || el.parentNode.parentNode !== list || list.scrollWidth <= list.clientWidth + 1) return;
    var keyboard = false;
    try { keyboard = el.matches(':focus-visible'); } catch (e) { keyboard = false; }
    if (!keyboard) return;
    var li = el.parentNode;
    var left = li.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft || left + li.offsetWidth > list.scrollLeft + list.clientWidth) {
      try { list.scrollTo({ left: Math.max(0, left - 12), behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { list.scrollLeft = Math.max(0, left - 12); }
    }
  }

  // show the waiting answer now (after the typing delay, or at once when another question is chosen)
  function finish() {
    if (!pending) return;
    var p = pending;
    pending = null;
    clearTimeout(p.timer);
    if (typing.parentNode) typing.parentNode.removeChild(typing);
    p.pair.appendChild(p.answer);
    // bring the new question to the top of the chat when the answer is long, else show the whole pair
    scrollLog(p.pair.offsetTop - 16);
  }

  // found: opened by find in page, so show it at once and leave focus and scrolling to the browser
  function ask(chip, found) {
    finish();
    var pair = chip.pair;
    if (chip.done && !found) return;
    var wasFocused = document.activeElement === chip.btn;
    markDone(chip, true);
    layout();
    asked += 1;

    // the question joins the end of the conversation; the answer waits off the page until it is "typed"
    var answer = found ? null : pair.querySelector('.faq-msg-a');
    if (answer) pair.removeChild(answer);
    pair.hidden = false;
    pair.classList.toggle('is-new', !found);
    thread.appendChild(pair);
    syncState();
    if (found) return;

    // keep keyboard focus in the list: the next question, else "Start over"
    if (wasFocused || chip.btn.contains(document.activeElement) || document.activeElement === document.body) {
      var target = nextTarget(chip);
      if (target) {
        try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
        showInRow(target);
      }
    }

    revealChat();
    if (!answer) { scrollLog(pair.offsetTop - 16); return; }
    var wait = reduced() ? 0 : 600 + Math.min(300, Math.round(answer.textContent.length * 0.6));
    pending = { pair: pair, answer: answer, timer: 0 };
    if (!wait) { finish(); return; }
    thread.appendChild(typing);
    scrollLog(log.scrollHeight);
    pending.timer = setTimeout(finish, wait);
  }

  function hideWaiting(pair) {
    pair.setAttribute('hidden', 'until-found'); // plain hidden in browsers without find-in-page support
  }

  // start: first pair open, the rest waiting (still in the page) and listed as chips
  chat.classList.add('is-live');
  log.tabIndex = 0; // the conversation now scrolls on its own, so keyboard users can focus and scroll it
  pairs.forEach(function (pair, i) {
    pair.classList.remove('is-new');
    if (i === 0) return;
    hideWaiting(pair);
    var chip = makeChip(pair);
    chips.push(chip);
    list.appendChild(chip.li);
    pair.addEventListener('beforematch', function () { ask(chip, true); });
  });
  layout();
  sugg.hidden = false;
  syncState();
  log.scrollTop = log.scrollHeight;

  // "Start over": back to the first question only, every chip unanswered
  if (reset) {
    reset.addEventListener('click', function () {
      finish();
      asked = 0;
      pairs.forEach(function (pair, i) {
        pair.classList.remove('is-new');
        thread.appendChild(pair); // first-to-last: back in the page's own order
        if (i > 0) hideWaiting(pair);
      });
      chips.forEach(function (c) { markDone(c, false); });
      layout();
      syncState();
      list.scrollLeft = 0;
      log.scrollTop = log.scrollHeight;
      var first = chips[0] && chips[0].btn;
      if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
    });
  }
})();
