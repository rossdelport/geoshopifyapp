(function () {
  // FAQ chat: the first question starts open, the rest become suggestion bubbles. Tapping one moves its
  // question into the conversation, shows the assistant typing for a moment, then reveals the answer.
  // Every pair is already real text in the HTML, so this only hides, moves and shows it.
  var root = document.getElementById('faq');
  if (!root) return;
  var chat = root.querySelector('.faq-chat');
  var log = root.querySelector('.faq-log');
  var thread = root.querySelector('.faq-thread');
  var hello = root.querySelector('.faq-hello');
  var sugg = root.querySelector('.faq-sugg');
  var list = root.querySelector('.faq-sugg-list');
  var reset = root.querySelector('.faq-reset');
  var title = root.querySelector('.faq-sugg-title');
  var titleText = title ? title.textContent : '';
  if (!chat || !log || !thread || !sugg || !list) return;
  var pairs = Array.prototype.slice.call(thread.querySelectorAll('.faq-pair'));
  if (pairs.length < 2) return;

  var motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(motion && motion.matches); }

  var SEND_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';
  var asked = 0;
  var pending = null;

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

  function makeChip(pair) {
    var li = document.createElement('li');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'faq-chip';
    btn.setAttribute('aria-controls', pair.id);
    var tx = document.createElement('span');
    tx.textContent = questionText(pair);
    var ic = document.createElement('span');
    ic.className = 'faq-chip-ic';
    ic.innerHTML = SEND_ICON;
    btn.appendChild(tx);
    btn.appendChild(ic);
    btn.addEventListener('click', function () { ask(pair, li); });
    li.appendChild(btn);
    return li;
  }

  function fillList(skip) {
    list.textContent = '';
    pairs.forEach(function (pair) { if (pair !== skip) list.appendChild(makeChip(pair)); });
  }

  function syncState() {
    var left = list.children.length;
    if (reset) reset.hidden = asked === 0;
    if (title) title.textContent = left ? titleText : 'That\u2019s every question';
    list.hidden = left === 0;
  }

  // show the waiting answer now (after the typing delay, or at once when another question is tapped)
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

  function ask(pair, li) {
    finish();
    var items = Array.prototype.slice.call(list.children);
    var at = items.indexOf(li);
    if (li.parentNode) li.parentNode.removeChild(li);
    asked += 1;

    // the question joins the end of the conversation; the answer waits off the page until it is "typed"
    var answer = pair.querySelector('.faq-msg-a');
    if (answer) pair.removeChild(answer);
    pair.hidden = false;
    pair.classList.add('is-new');
    thread.appendChild(pair);
    syncState();

    // keep keyboard focus in the list: the next question, else the reset button
    var next = list.children[at] || list.children[at - 1];
    var target = next ? next.querySelector('button') : (reset && !reset.hidden ? reset : log);
    if (target) { try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); } }

    if (!answer) { scrollLog(pair.offsetTop - 16); return; }
    var wait = reduced() ? 0 : 600 + Math.min(300, Math.round(answer.textContent.length * 0.6));
    pending = { pair: pair, answer: answer, timer: 0 };
    if (!wait) { finish(); return; }
    thread.appendChild(typing);
    scrollLog(log.scrollHeight);
    pending.timer = setTimeout(finish, wait);
  }

  // start: first pair open, the rest hidden (still in the page) and listed as suggestions
  chat.classList.add('is-live');
  log.tabIndex = 0; // the conversation now scrolls on its own, so keyboard users can focus and scroll it
  if (hello) hello.hidden = false;
  pairs.forEach(function (pair, i) { pair.hidden = i > 0; });
  fillList(pairs[0]);
  sugg.hidden = false;
  syncState();
  log.scrollTop = log.scrollHeight;

  if (reset) {
    reset.addEventListener('click', function () {
      finish();
      asked = 0;
      fillList(null);
      syncState();
      var first = list.querySelector('button');
      if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
    });
  }
})();
