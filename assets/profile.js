// Личный план без регистрации: избранные предметы, отметки «изучил», заметки и недавно просмотренное.
// Всё хранится только в этом браузере (localStorage, ключ tm-profile-v1) и никуда не отправляется.
// Скрипт подключается раньше app.js и path.js: каталог фильтрует по отметкам, а окно карточки показывает кнопки.
(function () {
  'use strict';
  var KEY = 'tm-profile-v1', MAXR = 12, MAXN = 2000;
  var me = document.currentScript, base = '';
  try { base = new URL('..', me.src).href; } catch (e) {}   // корень сайта: скрипт лежит в assets/
  var avail = (function () { try { localStorage.setItem('__tm', '1'); localStorage.removeItem('__tm'); return true; } catch (e) { return false; } })();

  function blank() { return { fav: [], done: [], notes: {}, recent: [], titles: {} }; }
  function load() {
    var d = blank(); if (!avail) return d;
    try {
      var x = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!x || typeof x !== 'object') return d;
      ['fav', 'done', 'recent'].forEach(function (k) { if (Array.isArray(x[k])) d[k] = x[k].filter(function (v) { return typeof v === 'string'; }); });
      if (x.notes && typeof x.notes === 'object') Object.keys(x.notes).forEach(function (k) { if (typeof x.notes[k] === 'string' && x.notes[k].trim()) d.notes[k] = x.notes[k].slice(0, MAXN); });
      if (x.titles && typeof x.titles === 'object') Object.keys(x.titles).forEach(function (k) { if (typeof x.titles[k] === 'string') d.titles[k] = x.titles[k]; });
    } catch (e) {}
    return d;
  }
  var P = load(), subs = [];
  function save() {
    if (!avail) return false;
    var used = {}; P.fav.concat(P.done, P.recent, Object.keys(P.notes)).forEach(function (s) { used[s] = 1; });
    Object.keys(P.titles).forEach(function (s) { if (!used[s]) delete P.titles[s]; });   // названия храним только для того, что ещё в плане
    try { localStorage.setItem(KEY, JSON.stringify(P)); return true; } catch (e) { return false; }
  }
  // подписчики, чей элемент уже убран со страницы (например, закрытое окно карточки), возвращают false и забываются
  function emit() { subs = subs.filter(function (f) { try { return f() !== false; } catch (e) { return false; } }); }
  function remember(slug, t) { if (t) P.titles[slug] = t; }

  var api = window.TMProfile = {
    available: avail, base: base,
    has: function (list, slug) { return P[list].indexOf(slug) >= 0; },
    toggle: function (list, slug, t) {
      var i = P[list].indexOf(slug);
      if (i >= 0) P[list].splice(i, 1); else { P[list].unshift(slug); remember(slug, t); }
      save(); emit(); return i < 0;
    },
    note: function (slug, text, t) {
      if (text === undefined) return P.notes[slug] || '';
      text = String(text).slice(0, MAXN);
      if (text.trim()) { P.notes[slug] = text; remember(slug, t); } else delete P.notes[slug];
      var ok = save(); emit(); return ok;
    },
    visit: function (slug, t) {
      if (!avail || !slug) return;
      P.recent = [slug].concat(P.recent.filter(function (s) { return s !== slug; })).slice(0, MAXR);
      remember(slug, t); save(); emit();
    },
    title: function (slug) { return P.titles[slug] || ''; },
    data: function () { return P; },
    empty: function () { return !P.fav.length && !P.done.length && !P.recent.length && !Object.keys(P.notes).length; },
    clear: function () { P = blank(); try { localStorage.removeItem(KEY); } catch (e) {} emit(); },
    on: function (f) { subs.push(f); }
  };
  // изменения из другой вкладки
  window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === null) { P = load(); emit(); } });

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  // подписка, которая сама отпишется, когда элемент уберут со страницы
  function live(node, f) { var seen = false; var g = function () { if (node.isConnected) seen = true; else if (seen) return false; f(); }; api.on(g); g(); }

  // ---------- кнопки «Избранное» и «Изучил» (страница предмета и окно карточки) ----------
  // Имя кнопки не меняется, состояние передаёт aria-pressed: так её одинаково понимают глаз и скринридер.
  api.bar = function (box, slug, t) {
    box.textContent = ''; box.hidden = false;
    if (!avail) { box.appendChild(el('p', 'muted mynote-off', 'Этот браузер не даёт сохранять личные отметки (например, в приватном режиме).')); return; }
    [['fav', '★', 'Избранное'], ['done', '✓', 'Изучил']].forEach(function (d) {
      var b = el('button', 'mybtn my-' + d[0]); b.type = 'button';
      var i = el('span', 'myi', d[1]); i.setAttribute('aria-hidden', 'true'); b.appendChild(i); b.appendChild(document.createTextNode(d[2]));
      b.addEventListener('click', function () { api.toggle(d[0], slug, t); });
      live(b, function () { b.setAttribute('aria-pressed', api.has(d[0], slug)); });
      box.appendChild(b);
    });
    var a = el('a', 'mylink', 'Мой план'); a.href = base + 'profile.html'; box.appendChild(a);
  };

  // ---------- метки на карточках каталога, пути студента и узлах карты связей ----------
  function slugOf(c) { if (c.dataset.slug) return c.dataset.slug; var m = (c.getAttribute('href') || '').match(/d\/([\w-]+)\.html/); return m && m[1]; }
  function mark() {
    [].forEach.call(document.querySelectorAll('a.card, a.dc, a.gn'), function (c) {
      var s = slugOf(c); if (!s) return;
      var f = api.has('fav', s), d = api.has('done', s);
      c.dataset.fav = f ? '1' : '0'; c.dataset.done = d ? '1' : '0';
      var m = c.querySelector('.mymarks');
      if (!f && !d) { if (m) m.remove(); return; }
      if (!m) { m = el('span', 'mymarks'); c.appendChild(m); }
      m.textContent = '';
      if (f) { var a = el('i', 'mk-fav', '★'); a.setAttribute('aria-hidden', 'true'); m.appendChild(a); }
      if (d) { var b = el('i', 'mk-done', '✓'); b.setAttribute('aria-hidden', 'true'); m.appendChild(b); }
      m.appendChild(el('span', 'vh', [f ? 'в избранном' : '', d ? 'изучено' : ''].filter(Boolean).join(', ')));
    });
    // фильтры «Избранное» и «Изученные» в каталоге видны, только если есть что показать
    [].forEach.call(document.querySelectorAll('.mypill'), function (b) { b.hidden = !avail || (!P[b.dataset.f].length && b.getAttribute('aria-pressed') !== 'true'); });
  }
  if (avail) { mark(); api.on(mark); }

  // ---------- страница предмета: кнопки в шапке, заметки, история просмотров ----------
  var bar = document.getElementById('mybar');
  if (bar) {
    var slug = bar.dataset.slug, h1 = document.querySelector('.band h1'), t = h1 ? h1.textContent.replace(/^По выбору:\s*/, '') : slug;
    api.bar(bar, slug, t); api.visit(slug, t);
    var nb = document.getElementById('mynotes'), ta = document.getElementById('mynote'), st = nb && nb.querySelector('.mystat');
    if (nb && ta && avail) {
      nb.hidden = false; ta.value = api.note(slug); var timer = null, typing = false;
      ta.addEventListener('input', function () {
        typing = true; clearTimeout(timer); st.textContent = 'Сохраняю…';
        timer = setTimeout(function () { typing = false; st.textContent = api.note(slug, ta.value, t) ? 'Сохранено в этом браузере.' : 'Не удалось сохранить: браузер не даёт записывать данные.'; }, 400);
      });
      api.on(function () { if (!typing && document.activeElement !== ta) ta.value = api.note(slug); });
    }
  }

  // ---------- главная: блок «Мой план» (недавние, избранное, сколько изучено) ----------
  function chips(list, cls) {
    var w = el('div', 'ks');
    list.forEach(function (s) {
      var a = el('a', 'kchip' + (cls ? ' ' + cls : ''), P.titles[s] || s); a.href = base + 'd/' + s + '.html';
      if (document.getElementById('pd')) a.setAttribute('data-slug', s);   // на пути студента откроется окно карточки
      w.appendChild(a);
    });
    return w;
  }
  function progress(total) {
    var n = P.done.length, p = el('div', 'myprog');
    p.appendChild(el('p', '', 'Отмечено как изученное: ' + n + ' из ' + total));
    var b = el('div', 'bar'), i = el('i', 's2'); i.style.width = Math.min(100, n / total * 100).toFixed(1) + '%'; b.appendChild(i); b.setAttribute('role', 'img'); b.setAttribute('aria-label', 'Изучено ' + n + ' из ' + total);
    p.appendChild(b); return p;
  }
  var home = document.getElementById('mine');
  if (home && avail) {
    var hb = document.getElementById('minebody'), total = +home.dataset.total || 74;
    var drawHome = function () {
      home.hidden = api.empty(); if (home.hidden) return;
      hb.textContent = '';
      if (P.recent.length) { hb.appendChild(el('p', 'lkh', 'Недавно смотрел')); hb.appendChild(chips(P.recent.slice(0, 6))); }
      if (P.fav.length) { hb.appendChild(el('p', 'lkh', 'Избранное')); hb.appendChild(chips(P.fav.slice(0, 10), 'myfav')); }
      if (P.done.length) hb.appendChild(progress(total));
      var a = el('a', 'btn-o', 'Открыть мой план'); a.href = base + 'profile.html'; var p = el('p', 'myopen'); p.appendChild(a); hb.appendChild(p);
    };
    drawHome(); api.on(drawHome);
  }

  // ---------- страница «Мой план» ----------
  var prof = document.getElementById('profile');
  if (prof) {
    var names = {}; try { names = JSON.parse(document.getElementById('pnames').textContent); } catch (e) {}
    var nm = function (s) { return (names[s] && names[s][0]) || P.titles[s] || s; };
    var sem = function (s) { return names[s] ? names[s][1] + ' сем.' : ''; };
    var ptotal = +prof.dataset.total || 74;
    var section = function (title, cnt) { var s = el('section', 'panel mysec'); var h = el('h2', '', title); if (cnt != null) h.appendChild(el('small', 'mycnt', ' ' + cnt)); s.appendChild(h); return s; };
    var item = function (s, extra, actLabel, act) {
      var li = el('li', 'myitem'), a = el('a', '', nm(s)); a.href = base + 'd/' + s + '.html'; li.appendChild(a);
      if (sem(s)) li.appendChild(el('span', 'muted', ' · ' + sem(s)));
      if (extra) li.appendChild(extra);
      if (act) { var b = el('button', 'btn-o mysmall', actLabel); b.type = 'button'; b.setAttribute('aria-label', actLabel + ': ' + nm(s)); b.addEventListener('click', act); li.appendChild(b); }
      return li;
    };
    var drawProfile = function () {
      var had = prof.contains(document.activeElement);   // кнопка «Убрать» исчезает вместе со строкой: фокус вернём на заголовок
      prof.hidden = false; prof.textContent = '';
      if (!avail) { prof.appendChild(el('p', 'panel', 'Этот браузер не даёт сохранять данные сайта (например, в приватном режиме), поэтому личный план недоступен. Остальные разделы работают как обычно.')); return; }
      if (api.empty()) {
        var e = section('Пока пусто'); e.appendChild(el('p', '', 'Открой любой предмет и нажми «Избранное» или «Изучил», напиши заметку — всё появится здесь.'));
        var p = el('p', 'hlinks2'); [['Путь студента', 'index.html'], ['Все дисциплины', 'catalog.html']].forEach(function (x) { var a = el('a', 'btn-o', x[0]); a.href = base + x[1]; p.appendChild(a); });
        e.appendChild(p); prof.appendChild(e); return;
      }
      var s1 = section('Изучено', P.done.length + ' из ' + ptotal); s1.appendChild(progress(ptotal));
      if (P.done.length) { var u1 = el('ul', 'mylist'); P.done.forEach(function (s) { u1.appendChild(item(s, null, 'Снять отметку', function () { api.toggle('done', s); })); }); s1.appendChild(u1); }
      s1.appendChild(el('p', 'muted', 'Это твои личные пометки для планирования, а не оценки и не зачёты.'));
      prof.appendChild(s1);
      var s2 = section('Избранное', P.fav.length);
      if (P.fav.length) { var u2 = el('ul', 'mylist'); P.fav.forEach(function (s) { u2.appendChild(item(s, null, 'Убрать', function () { api.toggle('fav', s); })); }); s2.appendChild(u2); }
      else s2.appendChild(el('p', 'muted', 'Пока ничего. Звёздочка «Избранное» есть на странице каждого предмета.'));
      prof.appendChild(s2);
      var keys = Object.keys(P.notes);
      var s3 = section('Заметки', keys.length);
      if (keys.length) { var u3 = el('ul', 'mylist'); keys.forEach(function (s) { u3.appendChild(item(s, el('p', 'mytext', P.notes[s]), 'Удалить заметку', function () { if (confirm('Удалить заметку к предмету «' + nm(s) + '»?')) api.note(s, ''); })); }); s3.appendChild(u3); }
      else s3.appendChild(el('p', 'muted', 'Заметки пишутся на странице предмета, в блоке «Мои заметки».'));
      prof.appendChild(s3);
      if (P.recent.length) { var s4 = section('Недавно смотрел'); s4.appendChild(chips(P.recent)); prof.appendChild(s4); }
      var s5 = section('Очистить'); s5.appendChild(el('p', '', 'Удалит избранное, отметки, заметки и историю просмотров из этого браузера. Отменить нельзя.'));
      var cb = el('button', 'btn-o mydanger', 'Очистить мой план'); cb.type = 'button';
      cb.addEventListener('click', function () { if (confirm('Удалить избранное, отметки «изучил», заметки и историю просмотров из этого браузера? Это нельзя отменить.')) { api.clear(); var h = document.querySelector('main h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); } } });
      s5.appendChild(cb); prof.appendChild(s5);
      if (had) { var hh = prof.querySelector('h2'); if (hh) { hh.setAttribute('tabindex', '-1'); hh.focus({ preventScroll: true }); } }
    };
    drawProfile(); api.on(drawProfile);
  }
})();
