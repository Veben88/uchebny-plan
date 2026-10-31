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
    // строка каталога: статус ещё и словом среди меток (видно на телефоне; для скринридера уже есть текст выше)
    [].forEach.call(document.querySelectorAll('.crow'), function (c) {
      var st = api.status(c.dataset.slug), w = c.querySelector('.mkw'), ch = c.querySelector('.chips');
      if (!st || !ch) { if (w) w.remove(); return; }
      if (!w) { w = el('span', 'chip mkw'); w.setAttribute('aria-hidden', 'true'); ch.insertBefore(w, ch.firstChild); }
      w.className = 'chip mkw mkw-' + st; w.textContent = st === 'done' ? '✓ Пройдено' : '• Изучаю';
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
    var jobKeys = []; try { jobKeys = JSON.parse(document.getElementById('pjk').textContent); } catch (e) {}
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
    // Экран состояния: сверху кольцо «пройдено» по личным отметкам, семестр и факты программы из плана;
    // ниже вертикальное меню разделов (как в игровом меню) и панель выбранного. Выбранный раздел сохраняется при перерисовке, адрес — #my-…
    var pActive = (/^#(my-[a-z]+|mydata)$/.exec(location.hash) || [])[1] || '';
    var icon = function (k) { var t = document.getElementById('pico'), x = t && t.content.querySelector('[data-i="' + k + '"]'); var sp = el('span', 'pmi'); sp.setAttribute('aria-hidden', 'true'); if (x) sp.innerHTML = x.innerHTML; return sp; };
    var ring = function (p) {
      var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 120 120'); svg.setAttribute('aria-hidden', 'true');
      [['pr-b', 1], ['pr-f', p]].forEach(function (c) {
        if (!(c[1] > 0)) return;                                   // ноль — только подложка (у скруглённого конца иначе остаётся точка)
        var ci = document.createElementNS(ns, 'circle'); ci.setAttribute('cx', 60); ci.setAttribute('cy', 60); ci.setAttribute('r', 50); ci.setAttribute('pathLength', 100);
        ci.setAttribute('class', c[0]); ci.style.strokeDasharray = (Math.max(0, Math.min(1, c[1])) * 100).toFixed(1) + ' 100'; svg.appendChild(ci);
      });
      return svg;
    };
    var drawProfile = function () {
      var had = prof.contains(document.activeElement), hadTab = had && document.activeElement.classList.contains('pm') ? document.activeElement.dataset.sec : '';
      prof.hidden = false; prof.textContent = '';
      if (!avail) { prof.appendChild(el('p', 'panel', 'Этот браузер не даёт сохранять данные сайта (например, в приватном режиме), поэтому личный план недоступен. Остальные разделы работают как обычно.')); return; }
      if (locked) prof.appendChild(el('p', 'panel mywarn', 'Личные данные в этом браузере сохранены более новой версией сайта. Они показаны, но изменения здесь не сохраняются: обновите страницу, чтобы загрузить новую версию сайта.'));
      // ---- экран состояния ----
      var done = count('done'), doing = count('doing'), top = el('section', 'panel pstat'); top.setAttribute('aria-labelledby', 'pstath');
      var rg = el('div', 'pring'); rg.appendChild(ring(done / ptotal));
      var rv = el('p', 'prv'); rv.appendChild(el('b', '', Math.round(done / ptotal * 100) + '%')); rv.appendChild(el('span', '', 'пройдено')); rg.appendChild(rv); top.appendChild(rg);
      var info = el('div', 'pinfo'), h = el('h2', '', 'Моё состояние'); h.id = 'pstath'; info.appendChild(h);
      info.appendChild(el('p', 'pprog', 'Пройдено ' + done + ' из ' + ptotal + ' предметов' + (doing ? ', изучаю ' + doing : '')));
      var bar = el('div', 'pbar'), bi = el('i', 'pbd'), bj = el('i', 'pbg');
      bi.style.width = Math.min(100, done / ptotal * 100).toFixed(1) + '%'; bj.style.width = Math.min(100, doing / ptotal * 100).toFixed(1) + '%';
      bar.appendChild(bi); bar.appendChild(bj); bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', 'Пройдено ' + done + ' из ' + ptotal + ', изучаю ' + doing); info.appendChild(bar);
      var lab = el('label', 'sortl psem', 'Сейчас учусь в '), sel = el('select'); sel.id = 'mysem';
      sel.appendChild(new Option('не указано', '0')); for (var k = 1; k <= (+prof.dataset.sems || 8); k++) sel.appendChild(new Option(k + ' семестре', String(k)));
      sel.value = String(P.sem); sel.addEventListener('change', function () { focusAfter = 'mysem'; api.sem(+sel.value); });
      lab.appendChild(sel); info.appendChild(lab);
      info.appendChild(el('p', 'muted psemn', P.sem ? (Math.ceil(P.sem / 2) + ' курс. На пути студента и на карте связей подсвечен этот семестр.') : 'Укажи семестр, чтобы путь студента и карта связей показывали, где ты сейчас.'));
      info.appendChild(el('p', 'pnote', 'Личные пометки для планирования, а не оценки и не зачёты.'));
      top.appendChild(info);
      var facts = el('ul', 'pfacts'); facts.setAttribute('aria-label', 'Программа по учебному плану');
      [[prof.dataset.years, 'курса'], [prof.dataset.sems, 'семестров'], [prof.dataset.ze, 'з.е. в плане']].forEach(function (f) { if (!f[0]) return; var li = el('li'); li.appendChild(el('b', '', f[0])); li.appendChild(el('span', '', f[1])); facts.appendChild(li); });
      top.appendChild(facts);
      // счётчики по личным отметкам (на телефоне — строкой под кольцом): «Не начато» — предметы без статуса
      var pc = el('ul', 'pcnt'); pc.setAttribute('aria-label', 'Мои отметки');
      [[done, 'Пройдено', 'pc-done'], [doing, 'Изучаю', 'pc-doing'], [Math.max(0, ptotal - done - doing), 'Не начато', 'pc-none']].forEach(function (f) { var li = el('li', f[2]); li.appendChild(el('b', '', String(f[0]))); li.appendChild(el('span', '', f[1])); pc.appendChild(li); });
      top.appendChild(pc);
      var art = document.getElementById('part'); if (art) top.appendChild(art.content.cloneNode(true));
      prof.appendChild(top);
      // ---- разделы ----
      var secs = [];
      var add = function (id, title, ico, cnt, s) { s.id = id; secs.push({ id: id, t: title, i: ico, n: cnt, s: s }); };
      if (api.empty()) {
        var e = section('С чего начать'); e.appendChild(el('p', '', 'Открой любой предмет и отметь статус («Изучаю», «Пройдено») или «Избранное», напиши заметку — всё появится здесь. Интересные профессии отмечаются на странице «Профессии».'));
        var pe = el('p', 'hlinks2'); [['Путь студента', 'path.html'], ['Все дисциплины', 'catalog.html'], ['Профессии', 'jobs.html']].forEach(function (x) { var a = el('a', 'btn-o', x[0]); a.href = base + x[1]; pe.appendChild(a); });
        e.appendChild(pe); add('my-start', 'С чего начать', 'start', null, e);
      } else {
        var NX = nextSteps(INFO), sn = section('Что изучать дальше', NX.length || null);
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
        sn.appendChild(el('p', 'muted', NEXTNOTE));
        var ma = el('p', 'hlinks2'), mal = el('a', 'btn-s', 'Мой маршрут на карте связей'); mal.href = base + 'map.html#mine'; ma.appendChild(mal); sn.appendChild(ma);
        add('my-next', 'Что дальше', 'next', NX.length || null, sn);
        // «Мой маршрут»: предметы по семестрам с личными отметками (статус подписан словом, не только значком)
        var RT = {}, put = function (s, tag) { if (!INFO[s]) return; (RT[s] = RT[s] || {})[tag] = 1; };
        Object.keys(P.status).forEach(function (s) { put(s, P.status[s]); }); P.fav.forEach(function (s) { put(s, 'fav'); });
        api.jobIndexes().forEach(function (k) { (jobKeys[k] || []).forEach(function (s) { put(s, 'job'); }); });
        var rs = section('Мой маршрут'), semsR = {};
        Object.keys(RT).forEach(function (s) { var f = semList(INFO[s].sem)[0] || 0; (semsR[f] = semsR[f] || []).push(s); });
        var rkeys = Object.keys(semsR).map(Number).sort(function (a, b) { return a - b; }), TAGN = { done: 'пройдено', doing: 'изучаю', fav: 'избранное', job: 'путь к профессии' };
        if (rkeys.length) {
          var ol = el('ol', 'myroute');
          rkeys.forEach(function (n) {
            var li = el('li', 'myrs' + (P.sem === n ? ' now' : '')), hd = el('b', '', n + ' семестр' + (P.sem === n ? ' · сейчас' : '')); li.appendChild(hd);
            var ul = el('ul', 'myrl');
            semsR[n].sort(function (a, b) { return (INFO[a].idx || '').localeCompare(INFO[b].idx || ''); }).forEach(function (s) {
              var it = el('li', 'myri'), a = el('a', '', nm(s)); a.href = base + 'd/' + s + '.html'; it.appendChild(a);
              Object.keys(RT[s]).sort().forEach(function (t) { it.appendChild(el('span', 'myrt mt-' + t, TAGN[t] || t)); });
              ul.appendChild(it);
            });
            li.appendChild(ul); ol.appendChild(li);
          });
          rs.appendChild(ol);
          rs.appendChild(el('p', 'muted', 'Личные пометки и пути к выбранным профессиям: это план для себя, а не успеваемость и не требования программы.'));
          var ml = el('p', 'hlinks2'), mla = el('a', 'btn-o', 'Показать на карте связей'); mla.href = base + 'map.html#mine'; ml.appendChild(mla); rs.appendChild(ml);
        } else rs.appendChild(el('p', 'muted', 'Пока пусто: отметь предметы статусом или «Избранным», либо выбери интересную профессию — маршрут по семестрам появится здесь.'));
        add('my-route', 'Мой маршрут', 'next', rkeys.length ? Object.keys(RT).length : null, rs);

        [['doing', 'Изучаю', 'Пока ничего. Статус «Изучаю» ставится на странице предмета.'], ['done', 'Пройдено', 'Пока ничего. Статус «Пройдено» ставится на странице предмета.']].forEach(function (d) {
          var L = listOf(d[0]), s = section(d[1], L.length);
          if (L.length) {
            L.sort(function (a, b) { return (parseInt(sem(a), 10) || 99) - (parseInt(sem(b), 10) || 99); });
            var u = el('ul', 'mylist');
            L.forEach(function (x) { u.appendChild(item(x, null, d[0] === 'doing' ? [['Пройдено', function () { api.setStatus(x, 'done'); }], ['Снять', function () { api.setStatus(x, ''); }]] : [['Снять', function () { api.setStatus(x, ''); }]])); });
            s.appendChild(u);
          } else s.appendChild(el('p', 'muted', d[2]));
          add('my-' + d[0], d[1], d[0], L.length, s);
        });
        var s2 = section('Избранные предметы', P.fav.length);
        if (P.fav.length) { var u2 = el('ul', 'mylist'); P.fav.forEach(function (s) { u2.appendChild(item(s, null, [['Убрать', function () { api.toggle('fav', s); }]])); }); s2.appendChild(u2); }
        else s2.appendChild(el('p', 'muted', 'Пока ничего. Звёздочка «Избранное» есть на странице каждого предмета.'));
        add('my-fav', 'Избранное', 'fav', P.fav.length, s2);
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
        } else { var pj = el('p', 'muted'); pj.appendChild(document.createTextNode('Пока ничего. Отметить профессию можно на странице ')); var aj = el('a', '', '«Профессии»'); aj.href = base + 'jobs.html'; pj.appendChild(aj); pj.appendChild(document.createTextNode('.')); sj.appendChild(pj); }
        add('my-jobs', 'Профессии', 'jobs', JK.length, sj);
        var keys = Object.keys(P.notes), s3 = section('Заметки', keys.length);
        if (keys.length) { var u3 = el('ul', 'mylist'); keys.forEach(function (s) { u3.appendChild(item(s, el('p', 'mytext', P.notes[s]), [['Удалить заметку', function () { if (confirm('Удалить заметку к предмету «' + nm(s) + '»?')) api.note(s, ''); }]])); }); s3.appendChild(u3); }
        else s3.appendChild(el('p', 'muted', 'Заметки пишутся на странице предмета, во вкладке «Мои заметки».'));
        add('my-notes', 'Заметки', 'notes', keys.length, s3);
        if (P.recent.length) { var s4 = section('Недавно смотрел'); s4.appendChild(chips(P.recent)); add('my-recent', 'Недавно смотрел', 'recent', null, s4); }
      }
      // перенос на другое устройство и очистка
      var s6 = section('Перенести и выгрузить');
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
            pActive = 'mydata'; var n = api.importText(String(r.result)); focusAfter = 'mydata'; msg.textContent = 'Загружено записей: ' + n + '.';
          }
          catch (err) { msg.textContent = err.message === 'newer' ? 'Файл сохранён более новой версией сайта: обнови страницу и попробуй снова.' : err.message === 'save' ? 'Не удалось сохранить: браузер не даёт записывать данные.' : 'Не получилось прочитать файл: это не файл личного плана TeachMap или он повреждён.'; }
        };
        r.onerror = function () { msg.textContent = 'Не получилось прочитать файл.'; };
        r.readAsText(f);
      });
      var cs = el('button', 'btn-o', 'Таблица для Excel (CSV)'); cs.type = 'button'; cs.disabled = api.empty();
      cs.addEventListener('click', function () { download(personalCsv(INFO), 'teachmap-moy-progress-' + new Date().toISOString().slice(0, 10) + '.csv', 'text/csv;charset=utf-8'); msg.textContent = 'Таблица сохранена в загрузки. Для переноса на другое устройство используй файл JSON («Сохранить в файл»).'; });
      row.appendChild(ex); row.appendChild(im); row.appendChild(cs); s6.appendChild(row); s6.appendChild(fi); s6.appendChild(msg);
      if (!api.empty()) {
        s6.appendChild(el('h3', 'lkh mydangerh', 'Очистить'));
        s6.appendChild(el('p', '', 'Удалит статусы, избранное, профессии, семестр, заметки и историю просмотров из этого браузера. Отменить нельзя: если нужно, сначала сохрани файл.'));
        var cb = el('button', 'btn-o mydanger', 'Очистить мой план'); cb.type = 'button';
        cb.addEventListener('click', function () { if (confirm('Удалить статусы, избранное, профессии, семестр, заметки и историю просмотров из этого браузера? Это нельзя отменить.')) { pActive = 'mydata'; api.clear(); var hh = document.querySelector('main h1'); if (hh) { hh.setAttribute('tabindex', '-1'); hh.focus(); } } });
        s6.appendChild(cb);
      }
      add('mydata', 'Перенос и очистка', 'data', null, s6);
      // ---- меню разделов и панель ----
      if (!secs.some(function (x) { return x.id === pActive; })) pActive = secs[0].id;
      var body = el('div', 'pbody'), menu = el('div', 'pmenu'), panels = el('div', 'ppanels');
      menu.setAttribute('role', 'tablist'); menu.setAttribute('aria-orientation', 'vertical'); menu.setAttribute('aria-label', 'Разделы моего плана');
      var tabs = secs.map(function (x) {
        var b = el('button', 'pm'); b.type = 'button'; b.id = 'pm-' + x.id; b.dataset.sec = x.id; b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', x.id);
        b.appendChild(icon(x.i)); b.appendChild(el('span', 'pmt', x.t)); if (x.n != null) b.appendChild(el('b', 'pmn', String(x.n)));
        b.addEventListener('click', function () { pick(x.id, true); });
        menu.appendChild(b);
        x.s.setAttribute('role', 'tabpanel'); x.s.setAttribute('aria-labelledby', b.id); x.s.tabIndex = -1; panels.appendChild(x.s);
        return b;
      });
      function pick(id, user) {
        pActive = id;
        secs.forEach(function (x, i) { var on = x.id === id; x.s.hidden = !on; tabs[i].setAttribute('aria-selected', on ? 'true' : 'false'); tabs[i].tabIndex = on ? 0 : -1; });
        if (user) {
          try { history.replaceState(history.state, '', location.pathname + location.search + '#' + id); } catch (e) {}
          var sx = document.getElementById(id); if (!RMP) { sx.classList.remove('tm-scr'); void sx.offsetWidth; sx.classList.add('tm-scr'); }
          if (NARROWP) sx.scrollIntoView({ block: 'start', behavior: RMP ? 'auto' : 'smooth' });   // телефон: плитки разделов над панелью — показываем выбранный раздел
        }
      }
      menu.addEventListener('keydown', function (e) {             // ↑ / ↓ — по разделам, как курсор в меню
        var i = tabs.indexOf(document.activeElement), n = tabs.length; if (i < 0) return;
        var j = e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowUp' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
        if (j < 0) return; e.preventDefault(); tabs[j].focus(); pick(secs[j].id, true);
      });
      body.appendChild(menu); body.appendChild(panels); prof.appendChild(body);
      pick(pActive, false);
      if (focusAfter) { var fa = document.getElementById(focusAfter); focusAfter = null; if (fa) { if (fa.tagName !== 'SELECT') { var fh = fa.querySelector('h2'); fh.setAttribute('tabindex', '-1'); fh.focus({ preventScroll: true }); } else fa.focus({ preventScroll: true }); } }
      else if (hadTab) { var tb = document.getElementById('pm-' + hadTab) || tabs[0]; tb.focus({ preventScroll: true }); }
      else if (had) { var act = document.getElementById(pActive), hh2 = act && act.querySelector('h2'); if (hh2) { hh2.setAttribute('tabindex', '-1'); hh2.focus({ preventScroll: true }); } }
    };
    var RMP = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('tm-still');
    var NARROWP = !!(window.matchMedia && matchMedia('(max-width: 700px)').matches);
    window.addEventListener('hashchange', function () { var m = /^#(my-[a-z]+|mydata)$/.exec(location.hash); if (m && document.getElementById(m[1])) { pActive = m[1]; drawProfile(); } });
    drawProfile(); api.on(drawProfile);
  }
})();
