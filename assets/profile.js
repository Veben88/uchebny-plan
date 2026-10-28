// Личный план без регистрации: статусы предметов («Не начато», «Изучаю», «Пройдено»), избранные предметы и профессии,
// текущий семестр, заметки и недавно просмотренное. Всё хранится только в этом браузере (localStorage) и никуда не отправляется.
// Статусы — личные пометки для планирования, а не оценки, зачёты или подтверждённая успеваемость.
//
// Хранилище: ключ tm-profile-v2 (имя ключа историческое), версия формата в поле v, сейчас 3.
//   v1 (ключ tm-profile-v1: fav, done, notes, recent) — переносится автоматически: «изучил» становится статусом «Пройдено»;
//      старый ключ удаляется только после того, как новые данные записаны;
//   v2 — интересные профессии хранились номерами по порядку; v3 — постоянными кодами из data/jobs.json
//      (соответствие номер → код страница передаёт в <meta name="tm-jobs">).
// Если в браузере данные более новой версии сайта (v больше текущей), скрипт их показывает, но не перезаписывает.
//
// Скрипт подключается раньше app.js, path.js и graph.js: каталог фильтрует по меткам, окно карточки и карта показывают статусы.
(function () {
  'use strict';
  var KEY = 'tm-profile-v2', OLD = 'tm-profile-v1', VER = 3, MAXR = 12, MAXN = 2000, ST = { doing: 1, done: 1 };
  var me = document.currentScript, base = '';
  try { base = new URL('..', me.src).href; } catch (e) {}   // корень сайта: скрипт лежит в assets/
  var avail = (function () { try { localStorage.setItem('__tm', '1'); localStorage.removeItem('__tm'); return true; } catch (e) { return false; } })();
  var locked = false;
  var JIDS = (function () { var m = document.querySelector('meta[name="tm-jobs"]'); return m && m.content ? m.content.split(',') : []; })();
  function jobId(x) { return typeof x === 'number' || /^\d+$/.test(x) ? JIDS[+x] : (typeof x === 'string' && /^[a-z][a-z0-9-]{1,30}$/.test(x) ? x : null); }                                         // данные новой версии сайта: читаем, но не перезаписываем

  function blank() { return { v: VER, sem: 0, status: {}, fav: [], jobs: [], notes: {}, recent: [], titles: {} }; }
  function okSlug(s) { return typeof s === 'string' && /^[\w-]{1,48}$/.test(s); }
  // приводит к формату v2 любые входные данные: v2, прежний v1 или файл экспорта; лишнее и испорченное отбрасывается
  function norm(x) {
    var d = blank(); if (!x || typeof x !== 'object') return d;
    if (x.format === 'tm-profile' && x.data) x = x.data;      // файл экспорта
    ['fav', 'recent'].forEach(function (k) { if (Array.isArray(x[k])) d[k] = x[k].filter(okSlug).filter(function (s, i, a) { return a.indexOf(s) === i; }); });
    d.recent = d.recent.slice(0, MAXR);
    if (Array.isArray(x.jobs)) d.jobs = x.jobs.map(jobId).filter(function (id, i, a) { return id && a.indexOf(id) === i; });   // v2: номера → коды
    var s = +x.sem; d.sem = s >= 1 && s <= 8 && Math.floor(s) === s ? s : 0;
    if (x.status && typeof x.status === 'object') Object.keys(x.status).forEach(function (k) { if (okSlug(k) && ST[x.status[k]]) d.status[k] = x.status[k]; });
    if (Array.isArray(x.done)) x.done.filter(okSlug).forEach(function (k) { d.status[k] = 'done'; });   // формат v1
    if (x.notes && typeof x.notes === 'object') Object.keys(x.notes).forEach(function (k) { if (okSlug(k) && typeof x.notes[k] === 'string' && x.notes[k].trim()) d.notes[k] = x.notes[k].slice(0, MAXN); });
    if (x.titles && typeof x.titles === 'object') Object.keys(x.titles).forEach(function (k) {
      if (!okSlug(k) || typeof x.titles[k] !== 'string') return;
      var m = k.match(/^job-(\d+)$/), key = m ? (JIDS[+m[1]] ? 'job-' + JIDS[+m[1]] : null) : k;   // v2: job-<номер> → job-<код>
      if (key) d.titles[key] = x.titles[k].slice(0, 200);
    });
    return d;
  }
  var migrated = false;
  function load() {
    if (!avail) return blank();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var x = JSON.parse(raw); locked = !!(x && +x.v > VER); if (x && +x.v < VER) migrated = true; return norm(x); }
      var old = localStorage.getItem(OLD);
      if (old) { migrated = true; return norm(JSON.parse(old)); }
    } catch (e) {}
    return blank();
  }
  var P = load(), subs = [];
  function save() {
    if (!avail || locked) return false;
    var used = {}; P.fav.concat(Object.keys(P.status), P.recent, Object.keys(P.notes), P.jobs.map(function (id) { return 'job-' + id; })).forEach(function (s) { used[s] = 1; });
    Object.keys(P.titles).forEach(function (s) { if (!used[s]) delete P.titles[s]; });   // названия храним только для того, что ещё отмечено
    P.v = VER;
    try {
      localStorage.setItem(KEY, JSON.stringify(P));
      if (migrated) { localStorage.removeItem(OLD); migrated = false; }               // старый ключ v1 — только после успешной записи нового
      return true;
    } catch (e) { return false; }
  }
  if (migrated) save();
  // подписчики, чей элемент уже убран со страницы (например, закрытое окно карточки), возвращают false и забываются
  function emit() { subs = subs.filter(function (f) { try { return f() !== false; } catch (e) { return false; } }); }
  function remember(key, t) { if (t) P.titles[key] = String(t).slice(0, 200); }
  function count(st) { return Object.keys(P.status).filter(function (k) { return P.status[k] === st; }).length; }
  function listOf(st) { return Object.keys(P.status).filter(function (k) { return P.status[k] === st; }); }

  var api = window.TMProfile = {
    available: avail, base: base, version: VER,
    locked: function () { return locked; },
    // совместимость: has('fav'|'done'|'doing', slug), toggle('fav'|'done', slug)
    has: function (list, slug) { return list === 'fav' ? P.fav.indexOf(slug) >= 0 : P.status[slug] === list; },
    toggle: function (list, slug, t) {
      if (list !== 'fav') return api.setStatus(slug, P.status[slug] === list ? '' : list, t);
      var i = P.fav.indexOf(slug);
      if (i >= 0) P.fav.splice(i, 1); else { P.fav.unshift(slug); remember(slug, t); }
      save(); emit(); return i < 0;
    },
    status: function (slug) { return P.status[slug] || ''; },
    setStatus: function (slug, st, t) {
      if (ST[st]) { P.status[slug] = st; remember(slug, t); } else delete P.status[slug];
      save(); emit(); return !!ST[st];
    },
    sem: function (n) {
      if (n === undefined) return P.sem;
      P.sem = n >= 1 && n <= 8 ? +n : 0; save(); emit(); return P.sem;
    },
    // профессии снаружи задаются номером по порядку (как в адресах #job-0), внутри хранятся постоянными кодами
    hasJob: function (k) { return !!JIDS[+k] && P.jobs.indexOf(JIDS[+k]) >= 0; },
    toggleJob: function (k, t) {
      var id = JIDS[+k]; if (!id) return false; var i = P.jobs.indexOf(id);
      if (i >= 0) P.jobs.splice(i, 1); else { P.jobs.push(id); remember('job-' + id, t); }
      save(); emit(); return i < 0;
    },
    jobIndexes: function () { return P.jobs.map(function (id) { return JIDS.indexOf(id); }).filter(function (k) { return k >= 0; }); },
    note: function (slug, text, t) {
      if (text === undefined) return P.notes[slug] || '';
      text = String(text).slice(0, MAXN);
      if (text.trim()) { P.notes[slug] = text; remember(slug, t); } else delete P.notes[slug];
      var ok = save(); emit(); return ok;
    },
    visit: function (slug, t) {
      if (!avail || !slug || locked) return;
      P.recent = [slug].concat(P.recent.filter(function (s) { return s !== slug; })).slice(0, MAXR);
      remember(slug, t); save(); emit();
    },
    title: function (key) { return P.titles[key] || ''; },
    data: function () { return P; },
    count: count, list: listOf,
    empty: function () { return !P.fav.length && !Object.keys(P.status).length && !P.recent.length && !Object.keys(P.notes).length && !P.jobs.length && !P.sem; },
    clear: function () { P = blank(); locked = false; migrated = false; try { localStorage.removeItem(KEY); localStorage.removeItem(OLD); } catch (e) {} emit(); },
    exportText: function () { return JSON.stringify({ app: 'TeachMap', format: 'tm-profile', v: VER, exported: new Date().toISOString(), data: P }, null, 2); },
    // файл экспорта: checkText проверяет и возвращает разобранные данные (или бросает ошибку), importText заменяет ими текущие
    checkText: function (text) {
      var x = JSON.parse(text);
      if (!x || typeof x !== 'object' || (x.format && x.format !== 'tm-profile')) throw new Error('format');
      if (+((x.data || x).v) > VER) throw new Error('newer');
      var d = norm(x), n = d.fav.length + Object.keys(d.status).length + Object.keys(d.notes).length + d.jobs.length + d.recent.length + (d.sem ? 1 : 0);
      if (!n) throw new Error('empty');
      return { data: d, n: n };
    },
    importText: function (text) {
      var c = api.checkText(text);
      P = c.data; locked = false; if (!save()) throw new Error('save'); emit(); return c.n;
    },
    on: function (f) { subs.push(f); }
  };
  // изменения из другой вкладки
  window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === null) { P = load(); emit(); } });

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  // подписка, которая сама отпишется, когда элемент уберут со страницы
  function live(node, f) { var seen = false; var g = function () { if (node.isConnected) seen = true; else if (seen) return false; f(); }; api.on(g); g(); }
  var NOSAVE = 'Этот браузер не даёт сохранять личные отметки (например, в приватном режиме).';

  // ---------- кнопки статуса и «Избранное» (страница предмета и окно карточки) ----------
  // Имя кнопки не меняется, состояние передаёт aria-pressed: так её одинаково понимают глаз и скринридер.
  var STATES = [['', 'Не начато'], ['doing', 'Изучаю'], ['done', 'Пройдено']];
  api.bar = function (box, slug, t) {
    box.textContent = ''; box.hidden = false;
    if (!avail) { box.appendChild(el('p', 'muted mynote-off', NOSAVE)); return; }
    var g = el('div', 'myst'); g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Мой статус предмета (личная пометка, не оценка)');
    STATES.forEach(function (d) {
      var b = el('button', 'mybtn my-st my-' + (d[0] || 'none'), d[1]); b.type = 'button';
      b.addEventListener('click', function () { api.setStatus(slug, d[0], t); });
      live(b, function () { b.setAttribute('aria-pressed', api.status(slug) === d[0] ? 'true' : 'false'); });
      g.appendChild(b);
    });
    box.appendChild(g);
    var f = el('button', 'mybtn my-fav'); f.type = 'button';
    var i = el('span', 'myi', '★'); i.setAttribute('aria-hidden', 'true'); f.appendChild(i); f.appendChild(document.createTextNode('Избранное'));
    f.addEventListener('click', function () { api.toggle('fav', slug, t); });
    live(f, function () { f.setAttribute('aria-pressed', api.has('fav', slug) ? 'true' : 'false'); });
    box.appendChild(f);
    var a = el('a', 'mylink', 'Мой план'); a.href = base + 'profile.html'; box.appendChild(a);
  };

  // ---------- кнопки «В избранные профессии» (карта профессий) ----------
  function jobButtons() {
    [].forEach.call(document.querySelectorAll('button.my-job'), function (b) {
      if (b._tm) return; b._tm = 1;
      if (!avail) { b.hidden = true; return; }
      b.hidden = false; var k = +b.dataset.job;
      b.addEventListener('click', function () { api.toggleJob(k, b.dataset.title); });
      live(b, function () { b.setAttribute('aria-pressed', api.hasJob(k) ? 'true' : 'false'); });
    });
  }
  jobButtons(); api.jobButtons = jobButtons;

  // ---------- метки на карточках каталога, пути студента и узлах карты связей ----------
  function slugOf(c) { if (c.dataset.slug) return c.dataset.slug; var m = (c.getAttribute('href') || '').match(/d\/([\w-]+)\.html/); return m && m[1]; }
  var LBL = { done: 'пройдено', doing: 'изучаю' };
  function mark() {
    [].forEach.call(document.querySelectorAll('.card, a.dc, a.gn'), function (c) {
      var s = slugOf(c); if (!s) return;
      var f = api.has('fav', s), st = api.status(s);
      c.dataset.fav = f ? '1' : '0'; c.dataset.done = st === 'done' ? '1' : '0'; c.dataset.doing = st === 'doing' ? '1' : '0';
      var m = c.querySelector('.mymarks');
      if (!f && !st) { if (m) m.remove(); return; }
      if (!m) { m = el('span', 'mymarks'); c.appendChild(m); }
      m.textContent = '';
      if (f) { var a = el('i', 'mk-fav', '★'); a.setAttribute('aria-hidden', 'true'); m.appendChild(a); }
      if (st) { var b = el('i', 'mk-' + st, st === 'done' ? '✓' : '•'); b.setAttribute('aria-hidden', 'true'); m.appendChild(b); }
      m.appendChild(el('span', 'vh', [f ? 'в избранном' : '', LBL[st] || ''].filter(Boolean).join(', ')));
    });
    // фильтры «Избранное», «Изучаю» и «Пройдено» в каталоге видны, только если есть что показать
    [].forEach.call(document.querySelectorAll('.mypill'), function (b) {
      var n = b.dataset.f === 'fav' ? P.fav.length : count(b.dataset.f);
      b.hidden = !avail || (!n && b.getAttribute('aria-pressed') !== 'true');
    });
  }
  // путь студента: текущий семестр из «Моего плана» помечен «Ты здесь»
  function semNow() {
    [].forEach.call(document.querySelectorAll('.station[data-sem]'), function (st) {
      var on = +st.dataset.sem === P.sem, k = st.querySelector('.mynowk'), sh = st.querySelector('.sthead');
      st.classList.toggle('mynow', on);
      if (on && !k && sh) { k = el('span', 'mynowk', 'Ты здесь'); sh.insertBefore(k, sh.firstChild); }
      else if (!on && k) k.remove();
    });
  }
  if (avail) { mark(); api.on(mark); semNow(); api.on(semNow); }

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

  // ---------- главная: блок «Мой план» (семестр, изучаю, недавние, избранное, прогресс) ----------
  function chips(list, cls) {
    var w = el('div', 'ks');
    list.forEach(function (s) {
      var a = el('a', 'kchip' + (cls ? ' ' + cls : ''), P.titles[s] || (INFO[s] && INFO[s].n) || s); a.href = base + 'd/' + s + '.html';
      if (document.getElementById('pd')) a.setAttribute('data-slug', s);   // на пути студента откроется окно карточки
      w.appendChild(a);
    });
    return w;
  }
  function jobChips() {
    var w = el('div', 'ks');
    api.jobIndexes().forEach(function (k) { var a = el('a', 'kchip', P.titles['job-' + JIDS[k]] || ('Профессия ' + (k + 1))); a.href = base + 'jobs.html#job-' + k; w.appendChild(a); });
    return w;
  }
  function progress(total) {
    var d = count('done'), g = count('doing'), p = el('div', 'myprog');
    p.appendChild(el('p', '', 'Пройдено: ' + d + ' из ' + total + (g ? ', изучаю: ' + g : '')));
    var b = el('div', 'bar'), i = el('i', 's2'), j = el('i', 's3');
    i.style.width = Math.min(100, d / total * 100).toFixed(1) + '%'; j.style.width = Math.min(100, g / total * 100).toFixed(1) + '%';
    b.appendChild(i); b.appendChild(j); b.setAttribute('role', 'img'); b.setAttribute('aria-label', 'Пройдено ' + d + ' из ' + total + ', изучаю ' + g);
    p.appendChild(b); p.appendChild(el('p', 'muted myprivnote', 'Личные пометки для планирования, а не оценки и не зачёты.'));
    return p;
  }
  // ---------- «что изучать дальше»: подсказка по связям «нужен» и текущему семестру (не требование плана) ----------
  function planInfo() {                                       // данные страницы: «Мой план» (#pnames) или путь студента (#pd)
    var out = {}, x;
    try { x = JSON.parse(document.getElementById('pnames').textContent); Object.keys(x).forEach(function (s) { out[s] = { n: x[s][0], sem: x[s][1], need: x[s][2] || [], idx: x[s][3] || '' }; }); return out; } catch (e) {}
    try { x = JSON.parse(document.getElementById('pd').textContent).items; Object.keys(x).forEach(function (s) { out[s] = { n: x[s].n, sem: String(x[s].sem), need: (x[s].up || []).filter(function (u) { return u[1] === 'need'; }).map(function (u) { return u[0]; }), idx: x[s].code || '' }; }); } catch (e) {}
    return out;
  }
  function semList(t) {
    var r = []; String(t).split(',').forEach(function (p) { var m = p.match(/(\d+)\s*[–-]\s*(\d+)/); if (m) { for (var i = +m[1]; i <= +m[2]; i++) r.push(i); } else if (/^\s*\d+\s*$/.test(p)) r.push(+p); });
    return r;
  }
  function nextSteps(I) {
    var res = [], seen = {};
    Object.keys(I).forEach(function (s) {
      var nd = I[s].need; if (P.status[s] || !nd.length) return;
      if (nd.every(function (x) { return P.status[x] === 'done'; })) { res.push({ s: s, why: 'Опоры пройдены: ' + nd.map(function (x) { return I[x] ? I[x].n : x; }).join(', ') + '.' }); seen[s] = 1; }
    });
    if (P.sem) Object.keys(I).forEach(function (s) {
      if (P.status[s] || seen[s] || semList(I[s].sem).indexOf(P.sem) < 0) return;
      var miss = I[s].need.filter(function (x) { return P.status[x] !== 'done'; });
      res.push({ s: s, why: 'Идёт в твоём семестре.' + (miss.length ? ' Ещё не отмечены как пройденные опоры: ' + miss.map(function (x) { return I[x] ? I[x].n : x; }).join(', ') + '.' : '') });
    });
    return res.sort(function (a, b) { return (semList(I[a.s].sem)[0] || 9) - (semList(I[b.s].sem)[0] || 9); });
  }
  api.nextSteps = function () { return nextSteps(planInfo()); };
  function csvCell(v) { v = String(v == null ? '' : v); return /[";\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function personalCsv(I) {                                   // для Excel: «;» и UTF-8 с BOM
    var LB = { done: 'Пройдено', doing: 'Изучаю' }, rows = [['Код', 'Дисциплина', 'Семестры', 'Мой статус', 'Избранное', 'Заметка']], keys = {};
    Object.keys(P.status).concat(P.fav, Object.keys(P.notes)).forEach(function (s) { keys[s] = 1; });
    Object.keys(keys).sort(function (a, b) { return (I[a] ? semList(I[a].sem)[0] : 99) - (I[b] ? semList(I[b].sem)[0] : 99); }).forEach(function (s) {
      rows.push([I[s] ? I[s].idx : '', I[s] ? I[s].n : (P.titles[s] || s), I[s] ? I[s].sem : '', LB[P.status[s]] || 'Не начато', P.fav.indexOf(s) >= 0 ? 'да' : '', P.notes[s] || '']);
    });
    return '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n') + '\r\n';
  }
  function download(text, name, type) {
    var blob = new Blob([text], { type: type }), url = URL.createObjectURL(blob), a = el('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  var INFO = planInfo();
  var NEXTNOTE = 'Подсказка по логическим связям «нужен» и твоему семестру, а не требование учебного плана.';

  var home = document.getElementById('mine');
  if (home && avail) {
    var hb = document.getElementById('minebody'), total = +home.dataset.total || 74;
    var drawHome = function () {
      home.hidden = api.empty(); if (home.hidden) return;
      hb.textContent = '';
      if (P.sem) { var sp = el('p', 'mysem'); sp.appendChild(document.createTextNode('Сейчас: ')); var sa = el('a', '', P.sem + ' семестр'); sa.href = '#journey'; sa.addEventListener('click', function (e) { var st_ = document.querySelector('.station[data-sem="' + P.sem + '"]'); if (st_) { e.preventDefault(); st_.scrollIntoView({ behavior: (matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('tm-still')) ? 'auto' : 'smooth', block: 'start' }); } }); sp.appendChild(sa); hb.appendChild(sp); }
      var doing = listOf('doing');
      if (doing.length) { hb.appendChild(el('p', 'lkh', 'Изучаю')); hb.appendChild(chips(doing.slice(0, 10), 'mydoing')); }
      if (P.recent.length) { hb.appendChild(el('p', 'lkh', 'Недавно смотрел')); hb.appendChild(chips(P.recent.slice(0, 6))); }
      if (P.fav.length) { hb.appendChild(el('p', 'lkh', 'Избранное')); hb.appendChild(chips(P.fav.slice(0, 10), 'myfav')); }
      if (api.jobIndexes().length) { hb.appendChild(el('p', 'lkh', 'Интересные профессии')); hb.appendChild(jobChips()); }
      var nx = api.nextSteps();
      if (nx.length) { hb.appendChild(el('p', 'lkh', 'Можно браться')); hb.appendChild(chips(nx.slice(0, 5).map(function (r) { return r.s; }))); }
      if (Object.keys(P.status).length) hb.appendChild(progress(total));
      var p = el('p', 'hlinks2 myopen'), a = el('a', 'btn-o', 'Открыть мой план'); a.href = base + 'profile.html'; p.appendChild(a);
      var m = el('a', 'btn-o', 'Мой маршрут на карте'); m.href = base + 'map.html#mine'; p.appendChild(m); hb.appendChild(p);
    };
    drawHome(); api.on(drawHome);
  }

  // ---------- страница «Мой план» ----------
  var prof = document.getElementById('profile');
  if (prof) {
    var names = {}, jobsAll = []; try { names = JSON.parse(document.getElementById('pnames').textContent); } catch (e) {}
    try { jobsAll = JSON.parse(document.getElementById('pjobs').textContent); } catch (e) {}
    var nm = function (s) { return (names[s] && names[s][0]) || P.titles[s] || s; };
    var sem = function (s) { return names[s] ? names[s][1] + ' сем.' : ''; };
    var ptotal = +prof.dataset.total || 74;
    var section = function (title, cnt, id) { var s = el('section', 'panel mysec'); if (id) s.id = id; var h = el('h2', '', title); if (cnt != null) h.appendChild(el('small', 'mycnt', ' ' + cnt)); s.appendChild(h); return s; };
    var item = function (s, extra, acts) {
      var li = el('li', 'myitem'), a = el('a', '', nm(s)); a.href = base + 'd/' + s + '.html'; li.appendChild(a);
      if (sem(s)) li.appendChild(el('span', 'muted', ' · ' + sem(s)));
      if (extra) li.appendChild(extra);
      (acts || []).forEach(function (x) { var b = el('button', 'btn-o mysmall', x[0]); b.type = 'button'; b.setAttribute('aria-label', x[0] + ': ' + nm(s)); b.addEventListener('click', x[1]); li.appendChild(b); });
      return li;
    };
    var msg = el('p', 'mymsg'); msg.setAttribute('role', 'status');
    var focusAfter = null;
    var drawProfile = function () {
      var had = prof.contains(document.activeElement);   // кнопка исчезает вместе со строкой: фокус вернём на заголовок
      prof.hidden = false; prof.textContent = '';
      if (!avail) { prof.appendChild(el('p', 'panel', 'Этот браузер не даёт сохранять данные сайта (например, в приватном режиме), поэтому личный план недоступен. Остальные разделы работают как обычно.')); return; }
      if (locked) prof.appendChild(el('p', 'panel mywarn', 'Личные данные в этом браузере сохранены более новой версией сайта. Они показаны, но изменения здесь не сохраняются: обновите страницу, чтобы загрузить новую версию сайта.'));
      // текущий семестр
      var s0 = section('Мой семестр'), lab = el('label', 'sortl', 'Сейчас учусь в '), sel = el('select'); sel.id = 'mysem';
      sel.appendChild(new Option('не указано', '0')); for (var k = 1; k <= 8; k++) sel.appendChild(new Option(k + ' семестре', String(k)));
      sel.value = String(P.sem); sel.addEventListener('change', function () { focusAfter = 'mysem'; api.sem(+sel.value); });
      lab.appendChild(sel); s0.appendChild(lab);
      s0.appendChild(el('p', 'muted', P.sem ? 'На главной и на карте связей подсвечен этот семестр.' : 'Укажи семестр, чтобы главная и карта связей показывали, где ты сейчас.'));
      prof.appendChild(s0);
      if (api.empty()) {
        var e = section('Пока пусто'); e.appendChild(el('p', '', 'Открой любой предмет и отметь статус («Изучаю», «Пройдено») или «Избранное», напиши заметку — всё появится здесь. Интересные профессии отмечаются на карте профессий.'));
        var p = el('p', 'hlinks2'); [['Путь студента', 'path.html'], ['Все дисциплины', 'catalog.html'], ['Карта профессий', 'jobs.html']].forEach(function (x) { var a = el('a', 'btn-o', x[0]); a.href = base + x[1]; p.appendChild(a); });
        e.appendChild(p); prof.appendChild(e);
      } else {
        var s1 = section('Прогресс'); s1.appendChild(progress(ptotal));
        var ma = el('p', 'hlinks2'), mal = el('a', 'btn-s', 'Мой маршрут на карте связей'); mal.href = base + 'map.html#mine'; ma.appendChild(mal); s1.appendChild(ma);
        prof.appendChild(s1);
        var NX = nextSteps(INFO);
        if (NX.length || P.sem) {
          var sn = section('Что изучать дальше', NX.length || null);
          if (NX.length) {
            var un = el('ul', 'mynext');
            NX.slice(0, 12).forEach(function (r) {
              var li = el('li'), a = el('a', '', nm(r.s)); a.href = base + 'd/' + r.s + '.html'; li.appendChild(a);
              if (sem(r.s)) li.appendChild(el('span', 'muted', sem(r.s)));
              var b = el('button', 'btn-o mysmall', 'Изучаю'); b.type = 'button'; b.setAttribute('aria-label', 'Отметить «Изучаю»: ' + nm(r.s)); b.addEventListener('click', function () { api.setStatus(r.s, 'doing'); }); li.appendChild(b);
              li.appendChild(el('small', '', r.why)); un.appendChild(li);
            });
            sn.appendChild(un);
            if (NX.length > 12) sn.appendChild(el('p', 'muted', 'И ещё ' + (NX.length - 12) + '.'));
          } else sn.appendChild(el('p', 'muted', 'Пока подсказать нечего: отметь пройденные предметы — появятся те, для которых опоры уже пройдены.'));
          sn.appendChild(el('p', 'muted', NEXTNOTE)); prof.appendChild(sn);
        }
        [['doing', 'Изучаю', 'Пока ничего. Статус «Изучаю» ставится на странице предмета.'], ['done', 'Пройдено', 'Пока ничего. Статус «Пройдено» ставится на странице предмета.']].forEach(function (d) {
          var L = listOf(d[0]), s = section(d[1], L.length);
          if (L.length) {
            L.sort(function (a, b) { return (parseInt(sem(a), 10) || 99) - (parseInt(sem(b), 10) || 99); });
            var u = el('ul', 'mylist');
            L.forEach(function (x) { u.appendChild(item(x, null, d[0] === 'doing' ? [['Пройдено', function () { api.setStatus(x, 'done'); }], ['Снять', function () { api.setStatus(x, ''); }]] : [['Снять', function () { api.setStatus(x, ''); }]])); });
            s.appendChild(u);
          } else s.appendChild(el('p', 'muted', d[2]));
          prof.appendChild(s);
        });
        var s2 = section('Избранные предметы', P.fav.length);
        if (P.fav.length) { var u2 = el('ul', 'mylist'); P.fav.forEach(function (s) { u2.appendChild(item(s, null, [['Убрать', function () { api.toggle('fav', s); }]])); }); s2.appendChild(u2); }
        else s2.appendChild(el('p', 'muted', 'Пока ничего. Звёздочка «Избранное» есть на странице каждого предмета.'));
        prof.appendChild(s2);
        var JK = api.jobIndexes(), sj = section('Интересные профессии', JK.length);
        if (JK.length) {
          var uj = el('ul', 'mylist');
          JK.forEach(function (k) {
            var li = el('li', 'myitem'), t_ = jobsAll[k] || P.titles['job-' + JIDS[k]] || ('Профессия ' + (k + 1)), a = el('a', '', t_); a.href = base + 'jobs.html#job-' + k; li.appendChild(a);
            var m = el('a', 'btn-o mysmall', 'На карте'); m.href = base + 'map.html#job=' + k; m.setAttribute('aria-label', t_ + ' на карте связей'); li.appendChild(m);
            var b = el('button', 'btn-o mysmall', 'Убрать'); b.type = 'button'; b.setAttribute('aria-label', 'Убрать: ' + t_); b.addEventListener('click', function () { api.toggleJob(k); }); li.appendChild(b);
            uj.appendChild(li);
          });
          sj.appendChild(uj);
          if (JK.length >= 2) { var cp = el('p', 'hlinks2'), ca = el('a', 'btn-o', 'Сравнить ' + (JK.length > 2 ? 'первые две' : 'эти профессии')); ca.href = base + 'jobs.html#compare=' + JK[0] + ',' + JK[1]; cp.appendChild(ca); sj.appendChild(cp); }
          sj.appendChild(el('p', 'muted', 'Предметы на пути к этим профессиям подсвечиваются как «в планах» в режиме «Мой маршрут» на карте связей.'));
        } else { var pj = el('p', 'muted'); pj.appendChild(document.createTextNode('Пока ничего. Отметить профессию можно на ')); var aj = el('a', '', 'карте профессий'); aj.href = base + 'jobs.html'; pj.appendChild(aj); pj.appendChild(document.createTextNode('.')); sj.appendChild(pj); }
        prof.appendChild(sj);
        var keys = Object.keys(P.notes);
        var s3 = section('Заметки', keys.length);
        if (keys.length) { var u3 = el('ul', 'mylist'); keys.forEach(function (s) { u3.appendChild(item(s, el('p', 'mytext', P.notes[s]), [['Удалить заметку', function () { if (confirm('Удалить заметку к предмету «' + nm(s) + '»?')) api.note(s, ''); }]])); }); s3.appendChild(u3); }
        else s3.appendChild(el('p', 'muted', 'Заметки пишутся на странице предмета, в блоке «Мои заметки».'));
        prof.appendChild(s3);
        if (P.recent.length) { var s4 = section('Недавно смотрел'); s4.appendChild(chips(P.recent)); prof.appendChild(s4); }
      }
      // перенос на другое устройство: файл с данными
      var s6 = section('Перенести и выгрузить', null, 'mydata');
      s6.appendChild(el('p', '', 'Сохрани файл с личным планом и открой его на другом устройстве кнопкой «Загрузить из файла». Таблица CSV — для просмотра в Excel или Google Таблицах (обратно не загружается). Файлы остаются у тебя: на сервер ничего не отправляется.'));
      var row = el('p', 'hlinks2'), ex = el('button', 'btn-o', 'Сохранить в файл'); ex.type = 'button'; ex.disabled = api.empty();
      ex.addEventListener('click', function () { download(api.exportText(), 'teachmap-moy-plan-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json'); msg.textContent = 'Файл сохранён в загрузки.'; });
      var fi = el('input'); fi.type = 'file'; fi.accept = '.json,application/json'; fi.id = 'myfile'; fi.className = 'vh'; fi.tabIndex = -1; fi.setAttribute('aria-label', 'Файл личного плана TeachMap'); fi.setAttribute('aria-hidden', 'true');   // выбор файла открывает кнопка «Загрузить из файла»
      var im = el('button', 'btn-o', 'Загрузить из файла'); im.type = 'button'; im.addEventListener('click', function () { fi.click(); });
      fi.addEventListener('change', function () {
        var f = fi.files && fi.files[0]; if (!f) return;
        if (f.size > 1e6) { msg.textContent = 'Файл слишком большой: это не файл личного плана TeachMap.'; fi.value = ''; return; }
        var r = new FileReader();
        r.onload = function () {
          fi.value = '';
          try {
            api.checkText(String(r.result));                 // сначала проверяем файл, потом спрашиваем о замене
            if (!api.empty() && !confirm('Заменить текущий личный план данными из файла? Текущие отметки, заметки и избранное будут удалены.')) return;
            var n = api.importText(String(r.result)); focusAfter = 'mydata'; msg.textContent = 'Загружено записей: ' + n + '.';
          }
          catch (err) { msg.textContent = err.message === 'newer' ? 'Файл сохранён более новой версией сайта: обнови страницу и попробуй снова.' : err.message === 'save' ? 'Не удалось сохранить: браузер не даёт записывать данные.' : 'Не получилось прочитать файл: это не файл личного плана TeachMap или он повреждён.'; }
        };
        r.onerror = function () { msg.textContent = 'Не получилось прочитать файл.'; };
        r.readAsText(f);
      });
      var cs = el('button', 'btn-o', 'Таблица для Excel (CSV)'); cs.type = 'button'; cs.disabled = api.empty();
      cs.addEventListener('click', function () { download(personalCsv(INFO), 'teachmap-moy-progress-' + new Date().toISOString().slice(0, 10) + '.csv', 'text/csv;charset=utf-8'); msg.textContent = 'Таблица сохранена в загрузки. Для переноса на другое устройство используй файл JSON («Сохранить в файл»).'; });
      row.appendChild(ex); row.appendChild(im); row.appendChild(cs); s6.appendChild(row); s6.appendChild(fi); s6.appendChild(msg); prof.appendChild(s6);
      if (!api.empty()) {
        var s5 = section('Очистить'); s5.appendChild(el('p', '', 'Удалит статусы, избранное, профессии, семестр, заметки и историю просмотров из этого браузера. Отменить нельзя: если нужно, сначала сохрани файл.'));
        var cb = el('button', 'btn-o mydanger', 'Очистить мой план'); cb.type = 'button';
        cb.addEventListener('click', function () { if (confirm('Удалить статусы, избранное, профессии, семестр, заметки и историю просмотров из этого браузера? Это нельзя отменить.')) { api.clear(); var h = document.querySelector('main h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); } } });
        s5.appendChild(cb); prof.appendChild(s5);
      }
      if (focusAfter) { var fa = document.getElementById(focusAfter); focusAfter = null; if (fa) { if (fa.tagName !== 'SELECT') { var fh = fa.querySelector('h2'); fh.setAttribute('tabindex', '-1'); fh.focus({ preventScroll: true }); } else fa.focus({ preventScroll: true }); } }
      else if (had) { var hh = prof.querySelector('h2'); if (hh) { hh.setAttribute('tabindex', '-1'); hh.focus({ preventScroll: true }); } }
    };
    drawProfile(); api.on(drawProfile);
  }
})();
