// Стартовый экран (index.html): меню как в игре. Пункты — обычные ссылки; скрипт только подсвечивает активный пункт,
// даёт ходить по меню стрелками ↑/↓, открывает подменю «Настройки» на месте меню и показывает личный прогресс
// из «Моего плана» (profile.js). Без скрипта всё остаётся ссылками, настройки видны под меню.
(function () {
  'use strict';
  var menu = document.getElementById('stmenu'); if (!menu) return;
  var root = document.documentElement, RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var items = [].slice.call(menu.querySelectorAll('.sm-i')), nav = document.getElementById('stnav'), set = document.getElementById('settings'),
      back = document.getElementById('setback'), setLink = menu.querySelector('a[href="#settings"]');
  root.classList.add('st-js');

  // ---------- активный пункт: следует за мышью и фокусом, как курсор в игровом меню ----------
  function act(a) { items.forEach(function (x) { x.classList.toggle('on', x === a); }); }
  items.forEach(function (a) { a.addEventListener('mouseenter', function () { act(a); }); a.addEventListener('focus', function () { act(a); }); });
  act(items[0]);
  menu.addEventListener('keydown', function (e) {
    var i = items.indexOf(document.activeElement), n = items.length; if (i < 0) return;
    var j = e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowUp' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (j < 0) return; e.preventDefault(); items[j].focus();
  });

  // ---------- «Настройки»: подменю встаёт на место главного меню, «Назад» возвращает ----------
  function swap(el) { if (RM) return; el.classList.remove('st-in'); void el.offsetWidth; el.classList.add('st-in'); }
  function settings(on, focus) {
    root.classList.toggle('st-setopen', on); nav.hidden = on; set.hidden = !on; back.hidden = !on;
    if (on) { swap(set); if (focus) set.querySelector('h2').focus({ preventScroll: true }); }
    else { swap(nav); if (focus) { act(setLink); setLink.focus(); } }
    try { history.replaceState(history.state, '', location.pathname + location.search + (on ? '#settings' : '')); } catch (e) {}
  }
  if (set && setLink) {
    if (location.hash === '#settings') {
      settings(true, false); window.scrollTo(0, 0);
      var st = document.querySelector('.start'); if (st) st.scrollTop = 0;   // старые браузеры без overflow:clip прокручивают к якорю сам блок экрана
      var top = function () { window.scrollTo(0, 0); };   // браузер прокручивает к якорю и после загрузки: возвращаем наверх
      if (document.readyState === 'complete') setTimeout(top, 0); else window.addEventListener('load', function () { setTimeout(top, 0); });
    } else settings(false, false);   // подменю стоит на месте меню: прокрутка к якорю не нужна
    setLink.addEventListener('click', function (e) { e.preventDefault(); settings(true, true); });
    back.addEventListener('click', function () { settings(false, true); });
    set.addEventListener('keydown', function (e) { if (e.key === 'Escape') settings(false, true); });
  }

  // ---------- дата в углу экрана и учебное полугодие ----------
  var dt = document.getElementById('stdate');
  if (dt) {
    var d = new Date(), m = d.getMonth(), wd = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][d.getDay()];
    var term = m >= 8 || m === 0 ? 'осенний семестр' : m >= 1 && m <= 5 ? 'весенний семестр' : 'каникулы';
    dt.innerHTML = '';
    var b = document.createElement('b'); b.textContent = ('0' + d.getDate()).slice(-2) + '/' + ('0' + (m + 1)).slice(-2);
    var s = document.createElement('span'); s.textContent = wd + ' · ' + term;
    dt.appendChild(b); dt.appendChild(s);
  }

  // ---------- «Продолжить путь» и прогресс из «Моего плана» ----------
  var TM = window.TMProfile, me = document.getElementById('stme');
  function draw() {
    // «Продолжить путь» — только если есть настоящие отметки (статус, семестр, избранное, профессии), а не просто просмотренные страницы
    var D = TM && TM.available ? TM.data() : null;
    if (!D || !(Object.keys(D.status).length || D.sem || D.fav.length || D.jobs.length)) {
      if (me) me.hidden = true;
      document.getElementById('stgo').href = 'path.html#journey'; document.getElementById('stgot').textContent = 'Начать путь'; document.getElementById('stgod').textContent = 'от первого семестра до профессии';
      return;
    }
    var total = 74, done = TM.count('done'), doing = TM.count('doing'), sem = TM.sem();
    var go = document.getElementById('stgo');
    go.href = 'map.html#mine';
    document.getElementById('stgot').textContent = 'Продолжить путь';
    document.getElementById('stgod').textContent = (sem ? 'сейчас ' + sem + ' семестр · ' : '') + 'пройдено ' + done + ' из ' + total;
    if (!me) return;
    me.hidden = false; me.textContent = '';
    var k = document.createElement('p'); k.className = 'st-sk'; k.textContent = 'Мой прогресс'; me.appendChild(k);
    var row = document.createElement('div'); row.className = 'st-ring';
    var p = Math.min(1, done / total), ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 44 44'); svg.setAttribute('aria-hidden', 'true');
    [['st-rb', 1], ['st-rf', p]].forEach(function (c) {
      var ci = document.createElementNS(ns, 'circle'); ci.setAttribute('cx', 22); ci.setAttribute('cy', 22); ci.setAttribute('r', 18); ci.setAttribute('pathLength', 100);
      ci.setAttribute('class', c[0]); ci.style.strokeDasharray = (c[1] * 100).toFixed(1) + ' 100'; svg.appendChild(ci);
    });
    row.appendChild(svg);
    var t = document.createElement('p'); t.innerHTML = '';
    var big = document.createElement('b'); big.textContent = done + '/' + total; t.appendChild(big);
    t.appendChild(document.createTextNode(' пройдено' + (doing ? ', изучаю ' + doing : '') + (sem ? ' · сейчас ' + sem + ' семестр' : '')));
    row.appendChild(t); me.appendChild(row);
    var links = document.createElement('p'); links.className = 'st-ml';
    [['Мой маршрут на карте', 'map.html#mine']].concat(sem ? [['Мой семестр на пути', 'path.html#sem-' + sem]] : []).concat([['Мой план', 'profile.html']]).forEach(function (x) {
      var a = document.createElement('a'); a.href = x[1]; a.textContent = x[0]; links.appendChild(a);
    });
    me.appendChild(links);
    me.appendChild(Object.assign(document.createElement('p'), { className: 'st-mn', textContent: 'Личные пометки, а не оценки и не зачёты.' }));
  }
  draw(); if (TM && TM.on) TM.on(draw);
})();
