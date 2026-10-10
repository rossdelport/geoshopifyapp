(function () {
  var root = document.getElementById('faq');
  if (!root) return;
  var items = root.querySelectorAll('.faq-item');
  function setOpen(item, open) {
    item.classList.toggle('faq-open', open);
    var btn = item.querySelector('.faq-btn');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  items.forEach(function (item) {
    var btn = item.querySelector('.faq-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var willOpen = !item.classList.contains('faq-open');
      items.forEach(function (other) { if (other !== item) setOpen(other, false); });
      setOpen(item, willOpen);
    });
  });
})();
