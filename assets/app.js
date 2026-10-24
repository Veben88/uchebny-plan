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
        c.animate([{ translate: dx + 'px ' + dy + 'px' }, { translate: '0 0' }], { duration: 220, easing: 'steps(8, end)' });
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
  // Поиск: каждое слово запроса должно встретиться в тексте карточки (порядок не важен), ё и е не различаются.
  // Семестр: карточка подходит, если дисциплина идёт в этом семестре, а не только начинается в нём («1–2» видна и во 2-м).
  var sortSel = document.getElementById('sort'), reset = document.getElementById('reset'), grid = g;
  cards.forEach(function (c, i) { c._ord = i; });
  var SORTS = {
    '': function (a, b) { return a._ord - b._ord; },
    name: function (a, b) { return a.dataset.name.localeCompare(b.dataset.name, 'ru') || a._ord - b._ord; },
    ze: function (a, b) { return (+b.dataset.ze) - (+a.dataset.ze) || a._ord - b._ord; }
  };
  function norm(s) { return s.toLowerCase().replace(/ё/g, 'е').trim(); }
  function sortCards(animate) {
    var cmp = SORTS[sortSel.value] || SORTS[''], sorted = cards.slice().sort(cmp);
    var apply = function () { sorted.forEach(function (c) { grid.appendChild(c); }); };
    if (animate && !RM) slide(apply); else apply();
  }
  // Состояние фильтров хранится в адресе страницы: ссылку можно отправить, а «Назад» с карточки предмета возвращает тот же список.
  function saveUrl() {
    var p = new URLSearchParams();
    if (q.value.trim()) p.set('q', q.value.trim());
    ['sem', 'group', 'kr', 'lab'].forEach(function (k) { if (F[k]) p.set(k, F[k]); });
    if (sortSel.value) p.set('sort', sortSel.value);
    var s = p.toString();
    try { history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash); } catch (e) {}
  }
  function run() {
    var words = norm(q.value).split(/\s+/).filter(Boolean), n = 0, show = [], out = [], instant = RM || first;
    cards.forEach(function (c) {
      var ok = words.every(function (w) { return c.dataset.text.indexOf(w) >= 0; }) && (!F.sem || c.dataset.sems.indexOf(' ' + F.sem + ' ') >= 0) &&
               (!F.group || c.dataset.group === F.group) && (!F.kr || c.dataset.kr === '1') && (!F.lab || c.dataset.lab === '1');
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
    reset.hidden = !(words.length || Object.keys(F).length || sortSel.value);
    saveUrl();
  }
  function clearAll() {
    F = {}; q.value = ''; var sorted = sortSel.value; sortSel.value = '';
    if (sorted) sortCards(true);
    run(); q.focus();
  }
  [].forEach.call(document.querySelectorAll('[data-f]'), function (b) {
    b.addEventListener('click', function () {
      var f = b.dataset.f, v = b.dataset.v;
      if (F[f] === v) delete F[f]; else F[f] = v;
      run();
      if (b.classList.contains('tile')) document.getElementById('list').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
    });
  });
  q.addEventListener('input', run);
  sortSel.addEventListener('change', function () { sortCards(true); run(); });
  reset.addEventListener('click', clearAll);
  document.getElementById('reset2').addEventListener('click', clearAll);
  var p = new URLSearchParams(location.search);
  ['group', 'sem', 'kr', 'lab'].forEach(function (k) { if (p.get(k)) F[k] = p.get(k); });
  if (p.get('q')) q.value = p.get('q');
  if (p.get('sort') && SORTS[p.get('sort')]) { sortSel.value = p.get('sort'); sortCards(false); }
  run();
})();
