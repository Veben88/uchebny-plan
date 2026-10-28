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
  // мобильная панель: «назад» — по истории, если пришли с этого же сайта; иначе ссылка ведёт в родительский раздел
  [].forEach.call(document.querySelectorAll('[data-back]'), function (a) {
    a.addEventListener('click', function (e) {
      var same = false; try { same = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (x) {}
      if (same && history.length > 1) { e.preventDefault(); history.back(); }
    });
  });
  // «Меньше анимаций»: сохраняется в этом браузере; класс tm-still на <html> ставит скрипт в <head> на каждой странице
  [].forEach.call(document.querySelectorAll('[data-tm-still]'), function (b) {
    b.setAttribute('aria-pressed', root.classList.contains('tm-still'));
    b.addEventListener('click', function () {
      var on = root.classList.toggle('tm-still');
      try { localStorage.setItem('tm-motion', on ? 'off' : 'on'); } catch (e) {}
      [].forEach.call(document.querySelectorAll('[data-tm-still]'), function (x) { x.setAttribute('aria-pressed', on); });
    });
  });
  // ---------- страница предмета: вкладки из секций .dtab (без скрипта все разделы идут подряд) ----------
  (function () {
    var bar = document.getElementById('dtabs'); if (!bar) return;
    var RMt = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('tm-still');
    var secs = [].filter.call(document.querySelectorAll('.dtab'), function (x) {
      // «Мои заметки» — только если «Мой план» работает в этом браузере (profile.js открывает секцию заметок)
      var real = [].filter.call(x.children, function (c) { return !c.hidden; });
      if (!real.length) { x.hidden = true; return false; }
      return true;
    });
    if (secs.length < 2) return;
    var btns = secs.map(function (x, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'dtb'; b.id = 'tb-' + x.id; b.textContent = x.dataset.tab;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', x.id);
      x.setAttribute('role', 'tabpanel'); x.setAttribute('aria-labelledby', b.id); x.removeAttribute('aria-label'); x.tabIndex = -1;
      b.addEventListener('click', function () { show(i, false, true); });
      bar.appendChild(b); return b;
    });
    bar.hidden = false; root.classList.add('dtabs-on');
    var cur = -1;
    function show(i, focus, user) {
      if (i === cur) return;
      secs.forEach(function (x, j) { x.hidden = j !== i; btns[j].setAttribute('aria-selected', j === i ? 'true' : 'false'); btns[j].tabIndex = j === i ? 0 : -1; });
      cur = i;
      if (focus) btns[i].focus();
      if (user) {
        try { history.replaceState(history.state, '', location.pathname + location.search + (i ? '#' + secs[i].id : '')); } catch (e) {}
        if (!RMt) { secs[i].classList.remove('tm-tab'); void secs[i].offsetWidth; secs[i].classList.add('tm-tab'); }
        var r = bar.getBoundingClientRect(); if (r.top < 0) bar.scrollIntoView({ block: 'start', behavior: RMt ? 'auto' : 'smooth' });
      }
    }
    bar.addEventListener('keydown', function (e) {
      var k = e.key, n = secs.length, j = k === 'ArrowRight' ? (cur + 1) % n : k === 'ArrowLeft' ? (cur - 1 + n) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : -1;
      if (j < 0) return; e.preventDefault(); show(j, true, true);
    });
    // адрес: #t-<вкладка> или якорь раздела внутри неё (#links, #rp, #ratings, #fb, #mynotes) открывает нужную вкладку
    function fromHash(scroll) {
      var h = decodeURIComponent(location.hash.slice(1)), t = h && document.getElementById(h), i = 0;
      if (t) secs.forEach(function (x, j) { if (x === t || x.contains(t)) i = j; });
      cur = -1; show(i, false, false);
      if (scroll && t && t !== secs[i]) t.scrollIntoView({ block: 'start' });
      else if (scroll && t) bar.scrollIntoView({ block: 'start' });
    }
    fromHash(!!location.hash);
    window.addEventListener('hashchange', function () { fromHash(true); });
  })();
  var g = document.getElementById('grid'); if (!g) return;
  // ---------- «Дисциплины» (catalog.html): экран выбора ----------
  // Слева фильтры со счётчиками (курс, обязательные / по выбору, разделы плана, мои отметки), в центре список строк,
  // справа на широком экране — предпросмотр предмета под «курсором» (наведение или фокус, как в игровом меню).
  var cards = [].slice.call(g.querySelectorAll('.card')), q = document.getElementById('q'),
      cnt = document.getElementById('count'), empty = document.getElementById('empty'), F = {};
  // Строки, которые больше не подходят под фильтр, сначала уходят анимацией (класс tm-leave в style.css),
  // и только потом скрываются; оставшиеся плавно съезжают на освободившиеся места.
  // Счётчик и сообщение «Ничего не нашлось» обновляются сразу. При «уменьшении движения» всё мгновенно.
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('tm-still'), LEAVE = 180, first = true;
  function slide(change) {                       // сдвиг оставшихся строк на новые места (приём FLIP)
    var stay = cards.filter(function (c) { return !c.hidden && !c.classList.contains('tm-leave'); }),
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
    list.forEach(function (c) { c.classList.add('tm-leave'); c._out = true; });
    setTimeout(function () {
      var go = list.filter(function (c) { return c._out; });   // строку могли вернуть, пока она уходила
      slide(function () { go.forEach(function (c) { c._out = false; c.classList.remove('tm-leave'); c.hidden = true; }); });
      pickVisible();
    }, LEAVE);
  }
  // Поиск: каждое слово запроса должно встретиться в тексте строки (порядок не важен), ё и е не различаются.
  // Семестр и курс: строка подходит, если дисциплина идёт в этом семестре или курсе, а не только начинается в нём («1–2» видна и во 2-м).
  var sortSel = document.getElementById('sort'), reset = document.getElementById('reset'), grid = g,
      jobSel = document.getElementById('fjob'), jobMap = document.getElementById('jobmap'), jobNote = document.getElementById('jobnote');
  // Профессия: виден путь к ней — ключевые предметы (data-jk) и те, без которых их трудно начать (data-ja); роль подписана в строке.
  function jobRole(c, job) { var k = ' ' + job + ' '; return c.dataset.jk.indexOf(k) >= 0 ? 'key' : c.dataset.ja.indexOf(k) >= 0 ? 'need' : ''; }
  cards.forEach(function (c, i) { c._ord = i; });
  var SORTS = {
    '': function (a, b) { return a._ord - b._ord; },
    name: function (a, b) { return a.dataset.name.localeCompare(b.dataset.name, 'ru') || a._ord - b._ord; },
    ze: function (a, b) { return (+b.dataset.ze) - (+a.dataset.ze) || a._ord - b._ord; }
  };
  var KEYS = ['q', 'course', 'kind', 'sem', 'group', 'kr', 'lab', 'fav', 'doing', 'done', 'job'], SIDE = ['course', 'kind', 'group'];
  function norm(s) { return s.toLowerCase().replace(/ё/g, 'е').trim(); }
  function sortCards(animate) {
    var cmp = SORTS[sortSel.value] || SORTS[''], sorted = cards.slice().sort(cmp);
    var apply = function () { sorted.forEach(function (c) { grid.appendChild(c); }); };
    if (animate && !RM) slide(apply); else apply();
  }
  // Состояние фильтров хранится в адресе страницы: ссылку можно отправить, а «Назад» со страницы предмета возвращает тот же список.
  function saveUrl() {
    var p = new URLSearchParams();
    if (q.value.trim()) p.set('q', q.value.trim());
    KEYS.slice(1).forEach(function (k) { if (F[k]) p.set(k, F[k]); });
    if (sortSel.value) p.set('sort', sortSel.value);
    var s = p.toString();
    try { history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash); } catch (e) {}
  }
  function fits(c, f, words) {
    return words.every(function (w) { return c.dataset.text.indexOf(w) >= 0; }) && (!f.sem || c.dataset.sems.indexOf(' ' + f.sem + ' ') >= 0) &&
      (!f.course || c.dataset.courses.indexOf(' ' + f.course + ' ') >= 0) && (!f.kind || c.dataset.kind === f.kind) &&
      (!f.group || c.dataset.group === f.group) && (!f.kr || c.dataset.kr === '1') && (!f.lab || c.dataset.lab === '1') &&
      (!f.fav || c.dataset.fav === '1') && (!f.done || c.dataset.done === '1') && (!f.doing || c.dataset.doing === '1') &&   // отметки ставит profile.js
      (!f.job || !!jobRole(c, f.job));
  }
  var cfs = [].slice.call(document.querySelectorAll('.cf')), myHead = document.querySelector('.cfmy');
  function counts(words) {                     // счётчик у фильтра — сколько строк будет, если выбрать его (остальные условия те же)
    cfs.forEach(function (b) {
      var f = {}, k; for (k in F) f[k] = F[k];
      if (b.dataset.f === 'all') SIDE.forEach(function (x) { delete f[x]; }); else f[b.dataset.f] = b.dataset.v;
      if (b.dataset.f === 'course' && f.sem && !semInCourse(f.sem, b.dataset.v)) delete f.sem;
      var n = 0; cards.forEach(function (c) { if (fits(c, f, words)) n++; });
      var o = b.querySelector('[data-n]'); if (o) o.textContent = n;
      b.classList.toggle('cf0', !n && b.getAttribute('aria-pressed') !== 'true');
    });
    if (myHead) myHead.hidden = ![].some.call(document.querySelectorAll('.cf.mypill'), function (b) { return !b.hidden; });
  }
  function semInCourse(sem, course) { return Math.ceil(+sem / 2) === +course; }
  function run() {
    var words = norm(q.value).split(/\s+/).filter(Boolean), n = 0, show = [], out = [], instant = RM || first;
    cards.forEach(function (c) {
      var ok = fits(c, F, words);
      var jr = c.querySelector('.jr'), role = F.job ? jobRole(c, F.job) : '';
      if (jr) { jr.hidden = !role; jr.textContent = role === 'key' ? 'ключевой' : role === 'need' ? 'нужен для ключевых' : ''; jr.className = 'chip jr' + (role ? ' ' + role : ''); }
      if (ok) n++;
      if (instant) { c.hidden = !ok; return; }
      if (ok) { if (c._out) { c._out = false; c.classList.remove('tm-leave'); } else if (c.hidden) show.push(c); }
      else if (!c.hidden && !c._out) out.push(c);
    });
    first = false;
    if (show.length) slide(function () { show.forEach(function (c) { c.hidden = false; }); });
    leave(out);
    cnt.textContent = 'Показано: ' + n + ' из ' + cards.length; empty.hidden = n > 0;
    [].forEach.call(document.querySelectorAll('[data-f]'), function (b) {
      var on = b.dataset.f === 'all' ? !SIDE.some(function (x) { return F[x]; }) : F[b.dataset.f] === b.dataset.v;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // семестры — только выбранного курса
    [].forEach.call(document.querySelectorAll('.sems [data-f="sem"]'), function (b) { b.hidden = !!F.course && !semInCourse(b.dataset.v, F.course); });
    counts(words);
    reset.hidden = !(words.length || Object.keys(F).length || sortSel.value);
    jobSel.value = F.job || ''; jobMap.hidden = jobNote.hidden = !F.job; if (F.job) jobMap.href = 'map.html#job=' + F.job;
    saveUrl(); pickVisible();
  }
  function clearAll() {
    F = {}; q.value = ''; var sorted = sortSel.value; sortSel.value = '';
    if (sorted) sortCards(true);
    run(); q.focus();
  }
  [].forEach.call(document.querySelectorAll('[data-f]'), function (b) {
    b.addEventListener('click', function () {
      var f = b.dataset.f, v = b.dataset.v;
      if (f === 'all') SIDE.forEach(function (x) { delete F[x]; });
      else if (F[f] === v) delete F[f];
      else { F[f] = v; if (f === 'course' && F.sem && !semInCourse(F.sem, v)) delete F.sem; }
      run();
    });
  });
  q.addEventListener('input', run);
  // нажатие по любому месту строки — как по ссылке на названии; ссылки внутри строки и выделение текста работают как обычно
  grid.addEventListener('click', function (e) {
    var c = e.target.closest('.card'); if (!c || e.target.closest('a') || e.button) return;
    var sel = window.getSelection && String(window.getSelection()); if (sel) return;
    var a = c.querySelector('.cl'); if (!a) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) window.open(a.href, '_blank', 'noopener'); else a.click();
  });
  // ↑ / ↓ — к соседней строке списка, Home / End — к первой и последней (как курсор в меню)
  grid.addEventListener('keydown', function (e) {
    var c = e.target.closest('.card'); if (!c || !/^(ArrowUp|ArrowDown|Home|End)$/.test(e.key)) return;
    var vis = [].filter.call(grid.children, function (x) { return x.classList.contains('card') && !x.hidden && !x._out; }), i = vis.indexOf(c);
    var j = e.key === 'Home' ? 0 : e.key === 'End' ? vis.length - 1 : i + (e.key === 'ArrowDown' ? 1 : -1);
    if (j < 0 || j >= vis.length || j === i) return;
    e.preventDefault(); vis[j].querySelector('.cl').focus();
  });
  jobSel.addEventListener('change', function () { if (jobSel.value) F.job = jobSel.value; else delete F.job; run(); });
  sortSel.addEventListener('change', function () { sortCards(true); run(); });
  reset.addEventListener('click', clearAll);
  document.getElementById('reset2').addEventListener('click', clearAll);

  // ---------- предпросмотр: предмет под курсором ----------
  var prev = document.getElementById('cprev'), pv = document.getElementById('cpv'), PD = {}, cur = null;
  try { PD = JSON.parse(document.getElementById('cpd').textContent); } catch (e) {}
  var NAME = {}; cards.forEach(function (c) { NAME[c.dataset.slug] = c.querySelector('.cl').textContent; });
  var JOBN = [].slice.call(jobSel.options, 1).map(function (o) { return o.textContent; });
  function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }
  function linkList(title, list) {
    var w = el('section', 'cps'); w.appendChild(el('h3', 'cpsh', title + (list.length ? ' · ' + list.length : '')));
    if (!list.length) { w.appendChild(el('p', 'muted', 'Связей не отмечено.')); return w; }
    var ul = el('ul', 'cpl');
    list.slice(0, 5).forEach(function (x) {
      var li = el('li'), a = el('a', '', NAME[x[0]] || x[0]); a.href = 'd/' + x[0] + '.html'; li.appendChild(a);
      li.appendChild(el('span', 'lkt ' + x[1], x[1] === 'need' ? 'нужен' : 'помогает')); ul.appendChild(li);
    });
    if (list.length > 5) ul.appendChild(el('li', 'muted', 'и ещё ' + (list.length - 5)));
    w.appendChild(ul); return w;
  }
  function draw(c) {
    if (!pv || !c || c === cur) return; cur = c;
    cards.forEach(function (x) { x.classList.toggle('on', x === c); });
    var s = c.dataset.slug, d = PD[s] || {}, m = c.querySelectorAll('.cmeta'), f = document.createDocumentFragment();
    var art = el('span', 'cpart ' + c.querySelector('.cth').className); art.setAttribute('aria-hidden', 'true'); f.appendChild(art);
    f.appendChild(el('p', 'cpk', c.querySelector('.cg').textContent + ' · ' + c.querySelector('.ck').textContent));
    var h = el('h2', 'cph'); h.appendChild(document.createTextNode(NAME[s])); f.appendChild(h);
    f.appendChild(el('p', 'cpm', m[0].textContent));
    f.appendChild(el('p', 'cpm', m[1].textContent + (d.c ? ' · контактных ' + d.c + ' ч' : '')));
    if (d.k) f.appendChild(el('p', 'cpm', 'Формы контроля: ' + d.k));
    f.appendChild(el('p', 'cpw' + (d.w ? '' : ' muted'), d.w || 'Описание готовится: пока есть только нагрузка из учебного плана.'));
    f.appendChild(linkList('Опирается на', d.up || [])); f.appendChild(linkList('Ведёт к', d.dn || []));
    if (d.j && d.j.length) {
      var js = el('section', 'cps'), ks = el('div', 'ks'); js.appendChild(el('h3', 'cpsh', 'Ключевой для профессий'));
      d.j.forEach(function (k) { var a = el('a', 'kchip', JOBN[k] || ''); a.href = 'jobs.html#job-' + k; ks.appendChild(a); });
      js.appendChild(ks); f.appendChild(js);
    }
    var row = el('p', 'hlinks2 cpb'), go = el('a', 'btn-s', 'Открыть страницу'), mp = el('a', 'btn-o', 'На карте'), rt = el('a', 'btn-o', 'Маршрут на пути');
    go.href = 'd/' + s + '.html'; mp.href = 'map.html#node=' + s; rt.href = 'path.html#route=' + s;
    row.appendChild(go); row.appendChild(mp); row.appendChild(rt); f.appendChild(row);
    var b = c.querySelector('.badge'); if (b) f.appendChild(el('p', 'cpst muted', b.textContent + '. Связи — логические предположения команды, не официальные требования плана.'));
    pv.textContent = ''; pv.appendChild(f);
    if (!RM) { pv.classList.remove('tm-cp'); void pv.offsetWidth; pv.classList.add('tm-cp'); }
  }
  function pickVisible() {                       // курсор на скрытой строке — переходит на первую видимую
    if (!pv) return;
    if (cur && !cur.hidden && !cur._out) return;
    var c = [].filter.call(grid.children, function (x) { return x.classList.contains('card') && !x.hidden && !x._out; })[0];
    cur = null; if (c) draw(c); else { pv.textContent = ''; cards.forEach(function (x) { x.classList.remove('on'); }); }
  }
  if (prev && pv) {
    prev.hidden = false;
    grid.addEventListener('mouseover', function (e) { var c = e.target.closest('.card'); if (c) draw(c); });
    grid.addEventListener('focusin', function (e) { var c = e.target.closest('.card'); if (c) draw(c); });
  }

  var p = new URLSearchParams(location.search);
  ['group', 'sem', 'kr', 'lab', 'fav', 'doing', 'done'].forEach(function (k) { if (p.get(k)) F[k] = p.get(k); });
  if (/^[1-4]$/.test(p.get('course') || '')) F.course = p.get('course');
  if (/^[ovf]$/.test(p.get('kind') || '')) F.kind = p.get('kind');
  if (p.get('job') && jobSel.querySelector('option[value="' + p.get('job').replace(/\D/g, '') + '"]')) F.job = p.get('job').replace(/\D/g, '');
  if (p.get('q')) q.value = p.get('q');
  if (p.get('sort') && SORTS[p.get('sort')]) { sortSel.value = p.get('sort'); sortCards(false); }
  run();
  // отметки «Моего плана» меняются (в том числе в другой вкладке) — пересчитать фильтры и счётчики
  if (window.TMProfile && window.TMProfile.on) window.TMProfile.on(function () { setTimeout(run, 0); });
})();
