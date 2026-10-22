(function () {
  // режим «крупный шрифт и контраст»
  var root = document.documentElement, btn = document.getElementById('acc');
  try { if (localStorage.getItem('access') === '1') root.classList.add('access'); } catch (e) {}
  if (btn) {
    btn.setAttribute('aria-pressed', root.classList.contains('access'));
    btn.addEventListener('click', function () {
      var on = root.classList.toggle('access'); btn.setAttribute('aria-pressed', on);
      try { localStorage.setItem('access', on ? '1' : '0'); } catch (e) {}
    });
  }
  var g = document.getElementById('grid'); if (!g) return;
  var cards = [].slice.call(g.querySelectorAll('.card')), q = document.getElementById('q'),
      cnt = document.getElementById('count'), empty = document.getElementById('empty'), F = {};
  // Карточки, которые больше не подходят под фильтр, сначала уходят анимацией (класс p5-leave в style.css),
  // и только потом скрываются; оставшиеся плавно съезжают на освободившиеся места.
  // Счётчик и сообщение «Ничего не нашлось» обновляются сразу. При «уменьшении движения» всё мгновенно, как раньше.
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches, LEAVE = 180, first = true;
  function slide(change) {                       // сдвиг оставшихся карточек на новые места (приём FLIP)
    var stay = cards.filter(function (c) { return !c.hidden && !c.classList.contains('p5-leave'); }),
        was = stay.map(function (c) { return c.getBoundingClientRect(); });
    change();
    if (!stay[0] || !stay[0].animate) return;
    stay.forEach(function (c, i) {
      if (c.hidden) return;
      var r = c.getBoundingClientRect(), dx = was[i].left - r.left, dy = was[i].top - r.top;
      if ((dx || dy) && r.bottom > -200 && r.top < window.innerHeight + 200)
        c.animate([{ translate: dx + 'px ' + dy + 'px' }, { translate: '0 0' }], { duration: 260, easing: 'steps(5, end)' });
    });
  }
  function leave(list) {
    if (!list.length) return;
    list.forEach(function (c) { c.classList.add('p5-leave'); c._out = true; });
    setTimeout(function () {
      var go = list.filter(function (c) { return c._out; });   // карточку могли вернуть, пока она уходила
      slide(function () { go.forEach(function (c) { c._out = false; c.classList.remove('p5-leave'); c.hidden = true; }); });
    }, LEAVE);
  }
  function run() {
    var t = q.value.trim().toLowerCase(), n = 0, show = [], out = [], instant = RM || first;
    cards.forEach(function (c) {
      var ok = (!t || c.dataset.text.indexOf(t) >= 0) && (!F.sem || c.dataset.sem === F.sem) && (!F.group || c.dataset.group === F.group) &&
               (!F.kr || c.dataset.kr === '1') && (!F.lab || c.dataset.lab === '1');
      if (ok) n++;
      if (instant) { c.hidden = !ok; return; }
      if (ok) { if (c._out) { c._out = false; c.classList.remove('p5-leave'); } else if (c.hidden) show.push(c); }
      else if (!c.hidden && !c._out) out.push(c);
    });
    first = false;
    if (show.length) slide(function () { show.forEach(function (c) { c.hidden = false; }); });
    leave(out);
    cnt.textContent = 'Показано: ' + n + ' из ' + cards.length; empty.hidden = n > 0;
    [].forEach.call(document.querySelectorAll('[data-f]'), function (b) { b.setAttribute('aria-pressed', F[b.dataset.f] === b.dataset.v); });
  }
  [].forEach.call(document.querySelectorAll('[data-f]'), function (b) {
    b.addEventListener('click', function () {
      var f = b.dataset.f, v = b.dataset.v;
      if (F[f] === v) delete F[f]; else F[f] = v;
      run();
      if (b.classList.contains('tile')) document.getElementById('list').scrollIntoView({ behavior: 'smooth' });
    });
  });
  q.addEventListener('input', run);
  var p = new URLSearchParams(location.search); ['group', 'sem'].forEach(function (k) { if (p.get(k)) F[k] = p.get(k); }); if (p.get('q')) q.value = p.get('q');
  run();
})();
