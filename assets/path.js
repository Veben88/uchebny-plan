// Интерактивный путь студента: раскрытие карточек на месте, прогресс по семестрам, подсветка пути к профессии.
(function () {
  'use strict';
  var pd = document.getElementById('pd'); if (!pd) return;
  document.documentElement.classList.add('js');
  var D = JSON.parse(pd.textContent), I = D.items;
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('tm-still'), DUR = RM ? 0 : 380, EASE = 'steps(12, end)';
  var track = document.getElementById('track'), journey = document.getElementById('journey');
  var COL = ['#A8DBFF', '#D2EBFF', '#DCE6F0', '#9BEDF0'];   // цвета групп на глубоком синем (шапка карточки), как --gd0…--gd3 в style.css
  var GLAB = ['Профильный предмет', 'Политехнический предмет', 'Общий предмет', 'Практика или итоговая аттестация'];
  var CTL = { 'Эк': 'экзамен', 'За': 'зачёт', 'ЗаО': 'зачёт с оценкой', 'КР': 'курсовая работа', 'КП': 'курсовой проект', 'К': 'контрольные', 'Оц': 'оценка', 'РГР': 'расчётно-графическая работа' };
  var order = [];
  [].forEach.call(document.querySelectorAll('.dc'), function (a) { if (order.indexOf(a.dataset.slug) < 0) order.push(a.dataset.slug); });

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function short(t) { return t.length > 34 ? t.slice(0, 33).replace(/\s+\S*$/, '') + '…' : t; }
  function ctlText(c) {
    return c.split(/\s+/).filter(Boolean).map(function (w) {
      var m = w.match(/^([^(]+)(?:\((\d+)\))?$/); if (!m) return w;
      return (CTL[m[1]] || m[1]) + (m[2] ? ' ×' + m[2] : '');
    }).join(', ');
  }
  function jobsFor(slug) { var r = []; D.jobs.forEach(function (j, k) { if (j.s.indexOf(slug) >= 0) r.push(k); }); return r; }

  // ---------- содержимое раскрытой карточки ----------
  function build(slug) {
    var it = I[slug], f = document.createDocumentFragment();
    var h = el('header', 'xh'); h.style.setProperty('--gc', COL[it.g]);
    h.appendChild(el('div', 'xk', GLAB[it.g] + ' · ' + it.sem + ' семестр' + (it.pick ? ' · на выбор' : '')));
    var t = el('h2', '', (it.pick ? 'По выбору: ' : '') + it.n); t.id = 'xpt'; h.appendChild(t);
    var meta = el('div', 'xm');
    [[it.ze || 'вне', 'з.е.'], [it.h, 'часов всего'], [it.c, 'на парах']].forEach(function (p) {
      var s = el('span'); s.appendChild(el('b', '', String(p[0]))); s.appendChild(document.createTextNode(' ' + p[1])); meta.appendChild(s);
    });
    h.appendChild(meta);
    var st = D.status[it.st]; h.appendChild(el('span', 'badge ' + st[1], st[0]));
    var b = el('div', 'xb');
    if (window.TMProfile) { var mb = el('div', 'mybar'); window.TMProfile.bar(mb, slug, it.n); b.appendChild(mb); }   // «Избранное» и «Изучил» (profile.js)
    function sec(title, text, muted) { if (!text) return; var s = el('section', 'xs'); s.appendChild(el('h3', '', title)); s.appendChild(el('p', muted ? 'muted' : '', text)); b.appendChild(s); }
    sec('Что это', it.what || it.brief || 'Описание этой дисциплины готовится.', !(it.what || it.brief));
    sec('Зачем нужно в профессии', it.why);
    function list(title, arr) { if (!arr || !arr.length) return; var s = el('section', 'xs'); s.appendChild(el('h3', '', title)); var ul = el('ul', 'bl'); arr.forEach(function (x) { ul.appendChild(el('li', '', x)); }); s.appendChild(ul); b.appendChild(s); }
    list('Чему научишься', it.learn); list('Темы курса', it.themes); sec('Что делаешь на занятиях', it.acts);
    if (it.ex) {
      var ts = el('section', 'xs'); ts.appendChild(el('h3', '', 'Попробуй сам')); ts.appendChild(el('p', '', it.ex));
      var tk = el('div', 'task'); tk.setAttribute('data-task', slug); ts.appendChild(tk);
      if (it.ans) { var dt = el('details', 'ans'); dt.appendChild(el('summary', '', 'Что это показывает')); dt.appendChild(el('p', '', it.ans)); ts.appendChild(dt); }
      if (it.st !== 'проверено') ts.appendChild(el('p', 'muted', 'Черновик задания: формулировку проверит преподаватель.'));
      b.appendChild(ts); if (window.taskMount) window.taskMount(tk, slug);
    }
    sec('Совет студента', it.tip);
    // связи с другими предметами: короткие ссылки, открываются тут же в окне; обоснование каждой связи — на странице предмета
    if ((it.up && it.up.length) || (it.dn && it.dn.length)) {
      var ls = el('section', 'xs'); ls.appendChild(el('h3', '', 'Связи с другими предметами'));
      [['Опирается на', it.up], ['Пригодится для', it.dn]].forEach(function (gr) {
        if (!gr[1] || !gr[1].length) return;
        ls.appendChild(el('p', 'lkh', gr[0])); var w = el('div', 'ks');
        gr[1].forEach(function (x) {
          if (!I[x[0]]) return;
          var a = el('a', 'kchip' + (x[1] === 'need' ? ' need' : ''), short(I[x[0]].n) + (x[1] === 'need' ? ' · нужен' : ''));
          a.href = 'd/' + x[0] + '.html'; a.setAttribute('data-slug', x[0]); a.title = I[x[0]].n; w.appendChild(a);
        });
        ls.appendChild(w);
      });
      ls.appendChild(el('p', 'muted', 'Логические связи по содержанию предметов, а не официальные требования плана. Почему связаны — на странице предмета.'));
      var rb = el('button', 'btn-s', 'Показать маршрут на пути'); rb.type = 'button';
      rb.addEventListener('click', function () { history.replaceState(null, '', location.pathname + location.search); pushed = false; close(function () { window.tmShowRoute(slug, true); }); });
      var ma = el('a', 'btn-o', 'На карте связей'); ma.href = 'map.html#node=' + slug;
      var acts = el('div', 'hlinks2'); acts.appendChild(rb); acts.appendChild(ma); ls.appendChild(acts); b.appendChild(ls);
    }
    var tot = it.h || 0;
    if (tot) {
      var s = el('section', 'xs'); s.appendChild(el('h3', '', 'Нагрузка по плану'));
      var sr = Math.max(tot - (it.c || 0), 0);
      var segs = (it.lec || it.lab || it.pr) ? [['Лекции', it.lec, 's1'], ['Лабораторные', it.lab, 's2'], ['Практика', it.pr, 's3'], ['Самостоятельно и контроль', sr, 's4']]
                                              : [['Контактная работа', it.c || 0, 's1'], ['Самостоятельно и контроль', sr, 's4']];
      var bar = el('div', 'bar'), leg = el('ul', 'leg');
      segs.forEach(function (g) {
        if (!g[1]) return;
        var i = el('i', g[2]); i.style.width = '0%'; i.setAttribute('data-w', (g[1] / tot * 100).toFixed(1) + '%'); bar.appendChild(i);
        var li = el('li', '', g[0] + ' ' + g[1] + ' ч'); li.insertBefore(el('i', g[2]), li.firstChild); leg.appendChild(li);
      });
      s.appendChild(bar); s.appendChild(leg);
      if (it.ctl) s.appendChild(el('p', 'muted', 'Формы контроля: ' + ctlText(it.ctl) + '.'));
      b.appendChild(s);
    }
    list('Инструменты и оборудование', it.tools); sec('Как проверяют', it.assess);
    var rs = el('section', 'xs'); rs.appendChild(el('h3', '', 'Оценки студентов'));
    if (it.r) {
      var ms = el('div', 'meters');
      var add = function (v, l) { if (v == null) return; var d = el('div', 'meter'); d.appendChild(el('b', '', String(v))); d.appendChild(el('span', '', l)); ms.appendChild(d); };
      add(it.r.hard, 'Сложность, 1–5'); add(it.r.useful, 'Польза для профессии, 1–5'); if (it.r.int) add(it.r.int, 'раз отмечен среди интересных');
      rs.appendChild(ms); rs.appendChild(el('p', 'muted', 'Ответили: ' + it.r.n + '. Оценили: ' + (it.r.scope || 'студенты, прошедшие предмет') + '. Медианные значения.'));
    } else rs.appendChild(el('p', 'muted', 'Оценок пока недостаточно: нужно не меньше ' + D.min_n + ' ответов. Опрос продолжается.'));
    b.appendChild(rs);
    if (window.fbRender) { var fbs = el('section', 'xs'); window.fbRender(fbs, slug, 'card'); b.appendChild(fbs); }
    var js = jobsFor(slug);
    if (js.length) {
      var j = el('section', 'xs'); j.appendChild(el('h3', '', 'Ведёт к профессиям')); var w = el('div', 'ks');
      js.forEach(function (k) {
        var bt = el('button', 'kchip', D.jobs[k].t); bt.type = 'button';
        bt.addEventListener('click', function () { history.replaceState(null, '', location.pathname + location.search); pushed = false; close(function () { showJob(k, true); }); });
        w.appendChild(bt);
      });
      j.appendChild(w); b.appendChild(j);
    }
    var more = el('a', 'xl', 'Открыть отдельной страницей'); more.href = 'd/' + slug + '.html'; b.appendChild(more);
    var k = order.indexOf(slug), nav = el('footer', 'xn');
    [-1, 1].forEach(function (dir) {
      var to = order[k + dir], bt = el('button', 'xnb'); bt.type = 'button';
      if (!to) { bt.disabled = true; bt.textContent = dir < 0 ? 'Это первый предмет' : 'Это последний предмет'; }
      else { bt.textContent = (dir < 0 ? '← ' : '') + short(I[to].n) + (dir > 0 ? ' →' : ''); bt.addEventListener('click', function () { swap(to, dir); }); }
      nav.appendChild(bt);
    });
    f.appendChild(h); f.appendChild(b); f.appendChild(nav);
    return f;
  }
  function growBars(root) {
    setTimeout(function () { [].forEach.call(root.querySelectorAll('.bar i'), function (i) { i.style.width = i.getAttribute('data-w'); }); }, DUR ? DUR * 0.7 : 0);
  }

  // ---------- раскрытие и закрытие ----------
  var ov = null, xp = null, src = null, cur = null, pushed = false, lastFocus = null;
  function geom() {
    var w = window.innerWidth, h = window.innerHeight;
    if (w < 700) return { left: 0, top: 0, width: w, height: h, r: 0 };
    var W = Math.min(820, w - 48); return { left: (w - W) / 2, width: W, r: 26 };
  }
  // sb — ширина полосы прокрутки. Её нужно измерить до того, как окно вставлено в страницу: измерение после вставки
  // заставляло браузер синхронно раскладывать всю страницу вместе с окном (самая долгая часть клика).
  function lock(on, sb) {
    if (sb == null) sb = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = on ? 'hidden' : '';
    document.body.style.paddingRight = on && sb > 0 ? sb + 'px' : '';
  }
  // Окно «вырастает» из карточки и «сжимается» обратно в неё. Раньше анимировались left/top/width/height, и браузер
  // на каждом шаге заново раскладывал и перерисовывал всё окно с большой тенью (на слабых устройствах — по 50–200 мс на кадр).
  // Теперь окно один раз рисуется в итоговом размере, а рост из карточки — это сдвиг и масштаб (их двигает видеокарта).
  // Содержимое и кнопка «×» на каждом шаге получают обратный масштаб, поэтому текст не растягивается.
  // Ступени те же, что у EASE: каждая ключевая точка держится до следующей (steps(1, end)).
  function morph(box, r, closing, dur) {
    var N = 12, sx0 = Math.max(r.width / box.width, 0.05), sy0 = Math.max(r.height / box.height, 0.05), dx0 = r.left - box.left, dy0 = r.top - box.top;
    var outer = [], counter = [];
    for (var k = 0; k <= N; k++) {
      var p = closing ? 1 - k / N : k / N, sx = sx0 + (1 - sx0) * p, sy = sy0 + (1 - sy0) * p;
      var o = k / N, e = k < N ? 'steps(1, end)' : 'linear';
      outer.push({ offset: o, easing: e, transform: 'translate(' + (dx0 * (1 - p)) + 'px,' + (dy0 * (1 - p)) + 'px) scale(' + sx + ',' + sy + ')' });
      counter.push({ offset: o, easing: e, transform: 'scale(' + (1 / sx) + ',' + (1 / sy) + ')' });
    }
    var opt = { duration: dur, fill: closing ? 'forwards' : 'none' }, box0 = closing ? closingEl : xp, inn = box0.querySelector('.xin');
    box0.style.transformOrigin = inn.style.transformOrigin = '0 0';   // кнопка «×» масштабируется вокруг своего центра: так её поворот при появлении остаётся прежним
    [].forEach.call(box0.children, function (c) { c.animate(counter, opt); });
    var a = box0.animate(outer, opt);
    if (!closing) a.onfinish = function () { box0.style.transformOrigin = inn.style.transformOrigin = ''; };
    return a;
  }
  var closingEl = null;   // закрываемое окно: в close() ссылка xp уже обнулена
  function cardFor(slug) { return document.querySelector('.dc[data-slug="' + slug + '"]'); }
  function visible(r) { return r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight; }
  function open(slug, from, viaHistory) {
    if (!I[slug]) return;
    if (xp) { swap(slug, 1, viaHistory); return; }
    // Порядок важен для скорости: всё, что нужно измерить на странице (полоса прокрутки, положение карточки), читается
    // до изменений; окно измеряется отдельно; блокировка прокрутки — последней. Так за клик страница раскладывается один раз.
    src = from || cardFor(slug); cur = slug; lastFocus = document.activeElement;
    var sb = window.innerWidth - document.documentElement.clientWidth, r = src && src.getBoundingClientRect();
    ov = el('div', 'ov'); xp = el('div', 'xp');
    xp.setAttribute('role', 'dialog'); xp.setAttribute('aria-modal', 'true'); xp.setAttribute('aria-labelledby', 'xpt');
    var x = el('button', 'xclose'); x.type = 'button'; x.setAttribute('aria-label', 'Закрыть'); x.textContent = '×';
    x.addEventListener('click', requestClose); ov.addEventListener('click', requestClose);
    var inner = el('div', 'xin'); inner.appendChild(build(slug));
    xp.appendChild(x); xp.appendChild(inner);
    var T = geom(); xp.style.left = T.left + 'px'; xp.style.width = T.width + 'px'; xp.style.top = '0px';
    document.body.appendChild(ov); document.body.appendChild(xp);
    var hh = T.height || Math.min(xp.scrollHeight, window.innerHeight - 48);
    var top = T.top != null ? T.top : (window.innerHeight - hh) / 2;
    xp.style.top = top + 'px'; xp.style.height = hh + 'px'; xp.style.borderRadius = T.r + 'px';
    lock(true, sb);
    if (src) src.classList.add('ghost');
    if (DUR && visible(r)) {
      morph({ left: T.left, top: top, width: T.width, height: hh }, r, false, DUR);
    } else if (DUR) xp.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: DUR * 0.6, easing: EASE });
    if (DUR) {
      inner.animate([{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }], { duration: 320, delay: DUR * 0.45, easing: EASE, fill: 'backwards' });
      ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR });
    }
    growBars(inner);
    setTimeout(function () { if (xp) x.focus({ preventScroll: true }); }, DUR);
    if (!viaHistory) { history.pushState({ xp: slug }, '', '#d=' + slug); pushed = true; }
    if (window.TMProfile) window.TMProfile.visit(slug, I[slug].n);
  }
  function swap(slug, dir, viaHistory) {
    if (!xp || !I[slug]) return;
    var inner = xp.querySelector('.xin'), nu = el('div', 'xin'); nu.appendChild(build(slug));
    var old = src; src = cardFor(slug); cur = slug;
    xp.setAttribute('data-dir', dir < 0 ? 'b' : 'f');   // направление для анимации шапки (style.css, блок движения)
    if (old) old.classList.remove('ghost'); if (src) { src.classList.add('ghost'); src.scrollIntoView({ block: 'center' }); }
    var go = function () {
      if (!xp || !inner.isConnected) return;      // карточку успели закрыть, пока шла анимация
      inner.replaceWith(nu); growBars(nu);
      var hh = geom().height || Math.min(nu.scrollHeight + 2, window.innerHeight - 48);
      if (!geom().height) { xp.style.height = hh + 'px'; xp.style.top = (window.innerHeight - hh) / 2 + 'px'; }
      if (DUR) nu.animate([{ opacity: 0, transform: 'translateX(' + (dir * 40) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
      var nb = nu.querySelectorAll('.xnb'); if (nb.length) (dir > 0 ? nb[1] : nb[0]).focus({ preventScroll: true });
    };
    if (DUR) inner.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-dir * 40) + 'px)' }], { duration: 160, easing: 'ease-in' }).onfinish = go; else go();
    if (!viaHistory) history.replaceState({ xp: slug }, '', '#d=' + slug);
    if (window.TMProfile) window.TMProfile.visit(slug, I[slug].n);
  }
  function requestClose() {
    if (pushed && history.state && history.state.xp) history.back();
    else { history.replaceState(null, '', location.pathname + location.search); close(); }
  }
  function close(then) {
    if (!xp) { if (then) then(); return; }
    var X = xp, O = ov, S = src, fired = false;
    var done = function () {
      if (fired) return; fired = true; X.remove(); O.remove(); if (S) S.classList.remove('ghost'); lock(false);
      if (then) then(); else if (S) S.focus({ preventScroll: true }); else if (lastFocus) lastFocus.focus();
    };
    xp = ov = null; cur = null; pushed = false;
    if (!DUR) { done(); return; }
    var r = S && S.getBoundingClientRect();
    X.querySelector('.xin').animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR * 0.35, fill: 'forwards' });
    O.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR, fill: 'forwards' });
    var a = visible(r)
      ? (closingEl = X, morph({ left: parseFloat(X.style.left), top: parseFloat(X.style.top), width: X.offsetWidth, height: X.offsetHeight }, r, true, DUR * 0.85))
      : X.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }], { duration: DUR * 0.5, fill: 'forwards' });
    a.onfinish = done; setTimeout(done, DUR + 200);
  }
  window.addEventListener('popstate', function (e) {
    var st = e.state;
    if (xp && !(st && st.xp)) close();
    else if (st && st.xp && !xp) { var c = cardFor(st.xp); if (c) c.scrollIntoView({ block: 'center' }); open(st.xp, c, true); }
    else if (st && st.xp && xp && st.xp !== cur) swap(st.xp, 1, true);
  });
  document.addEventListener('keydown', function (e) {
    if (!xp) return;
    if (e.key === 'Escape') { e.preventDefault(); requestClose(); return; }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      var k = order.indexOf(cur) + (e.key === 'ArrowRight' ? 1 : -1); if (order[k]) swap(order[k], e.key === 'ArrowRight' ? 1 : -1); return;
    }
    if (e.key === 'Tab') {
      var f = xp.querySelectorAll('button:not([disabled]),a[href]'); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-slug]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault(); open(a.dataset.slug, a);
  });

  // ---------- подсветка: разделы плана и путь к профессии ----------
  var pill = document.getElementById('hlpill'), pillText = document.getElementById('hltext');
  function clearHl() {
    journey.classList.remove('dimmed'); [].forEach.call(document.querySelectorAll('.dc.hl'), function (c) { c.classList.remove('hl', 'rt-self', 'rt-need', 'rt-help', 'rt-down'); });
    if (routeSvg) { routeSvg.remove(); routeSvg = null; } if (routeBox) routeBox.hidden = true; curRoute = null;
    [].forEach.call(document.querySelectorAll('[data-g],[data-job]'), function (b) { b.setAttribute('aria-pressed', 'false'); });
    pill.hidden = true;
  }
  function hl(test, label, btn) {
    clearHl(); journey.classList.add('dimmed'); var first = null;
    [].forEach.call(document.querySelectorAll('.dc'), function (c) { if (test(c)) { c.classList.add('hl'); if (!first) first = c; } });
    if (btn) btn.setAttribute('aria-pressed', 'true'); pillText.textContent = label; pill.hidden = false; return first;
  }
  function showJob(k, toJob) {
    var j = D.jobs[k], btn = document.querySelector('[data-job="' + k + '"]');
    var first = hl(function (c) { return j.s.indexOf(c.dataset.slug) >= 0; }, 'Путь к профессии: ' + j.t, btn);
    var target = toJob ? document.getElementById('job-' + k) : first;
    if (target) target.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
  }
  // ---------- маршрут к предмету: что к нему ведёт и что после него ----------
  // Роли: self — выбранный предмет; need — всё, без чего его трудно начать (цепочки связей «нужен» на любую глубину);
  // help — прямые связи «помогает»; down — для чего он пригодится. Связи логические (data/links.json), не официальные.
  var routeBox = document.getElementById('route'), routeSvg = null, curRoute = null, NS = 'http://www.w3.org/2000/svg';
  var ROLE = { need: 'Без этого трудно начать', help: 'Помогает', down: 'Пригодится для' };
  function routeOf(slug) {
    var role = {}, stack = [slug];
    while (stack.length) (I[stack.pop()].up || []).forEach(function (u) { if (u[1] === 'need' && !role[u[0]] && u[0] !== slug && I[u[0]]) { role[u[0]] = 'need'; stack.push(u[0]); } });
    (I[slug].up || []).forEach(function (u) { if (u[1] === 'helps' && !role[u[0]] && I[u[0]]) role[u[0]] = 'help'; });
    (I[slug].dn || []).forEach(function (d) { if (!role[d[0]] && I[d[0]]) role[d[0]] = 'down'; });
    role[slug] = 'self';
    var edges = [];   // линии — только то, что ведёт к предмету; продолжения подсвечены рамкой и перечислены в панели (веер линий вниз перечёркивал карту)
    Object.keys(role).forEach(function (s) {
      (I[s].up || []).forEach(function (u) {
        if (!role[u[0]] || role[u[0]] === 'down') return;
        if (role[s] === 'need' && u[1] === 'need' && role[u[0]] === 'need') edges.push([u[0], s, 'need']);
        else if (role[s] === 'self') edges.push([u[0], s, u[1] === 'need' ? 'need' : 'help']);
      });
    });
    return { role: role, edges: edges };
  }
  function posIn(el, box) { var x = 0, y = 0; while (el && el !== box) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return { x: x, y: y }; }   // без учёта transform: на результат не влияют анимации карточек
  function drawRoute(edges, animate) {
    if (routeSvg) routeSvg.remove();
    var svg = routeSvg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'rtsvg'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', track.offsetWidth); svg.setAttribute('height', track.offsetHeight);
    var defs = document.createElementNS(NS, 'defs');
    ['need', 'help', 'down'].forEach(function (t) {
      var m = document.createElementNS(NS, 'marker'); m.setAttribute('id', 'rt-a-' + t); m.setAttribute('viewBox', '0 0 10 10'); m.setAttribute('refX', '9'); m.setAttribute('refY', '5');
      m.setAttribute('markerWidth', '7'); m.setAttribute('markerHeight', '7'); m.setAttribute('orient', 'auto-start-reverse');
      var p = document.createElementNS(NS, 'path'); p.setAttribute('d', 'M0 0 L10 5 L0 10 z'); p.setAttribute('class', 'rta ' + t); m.appendChild(p); defs.appendChild(m);
    });
    svg.appendChild(defs);
    edges.forEach(function (e, i) {
      var a = cardFor(e[0]), b = cardFor(e[1]); if (!a || !b) return;
      var pa = posIn(a, track), pb = posIn(b, track), d;
      if (Math.abs(pa.y - pb.y) < 4) {   // в одном ряду: от края к краю
        var l = pa.x < pb.x, x1 = l ? pa.x + a.offsetWidth : pa.x, x2 = l ? pb.x : pb.x + b.offsetWidth, y1 = pa.y + a.offsetHeight / 2;
        d = 'M' + x1 + ' ' + y1 + ' C' + (x1 + (x2 - x1) / 2) + ' ' + (y1 - 26) + ',' + (x1 + (x2 - x1) / 2) + ' ' + (y1 - 26) + ',' + x2 + ' ' + y1;
      } else {
        var up = pa.y < pb.y, sx = pa.x + a.offsetWidth / 2, sy = up ? pa.y + a.offsetHeight : pa.y, tx = pb.x + b.offsetWidth / 2, ty = up ? pb.y : pb.y + b.offsetHeight, k = Math.min(Math.abs(ty - sy) / 2, 160) * (up ? 1 : -1);
        d = 'M' + sx + ' ' + sy + ' C' + sx + ' ' + (sy + k) + ',' + tx + ' ' + (ty - k) + ',' + tx + ' ' + ty;
      }
      var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', e[2]); p.setAttribute('marker-end', 'url(#rt-a-' + e[2] + ')');
      svg.appendChild(p);
      if (animate) { var len = p.getTotalLength(); p.style.setProperty('--len', len); p.style.setProperty('--i', i); p.classList.add('draw'); }
    });
    track.appendChild(svg);
  }
  function chipList(list) {
    var w = el('div', 'ks');
    list.sort(function (x, y) { return order.indexOf(x) - order.indexOf(y); }).forEach(function (s) { var a = el('a', 'kchip', short(I[s].n) + ' · ' + I[s].sem + ' сем.'); a.href = 'd/' + s + '.html'; a.setAttribute('data-slug', s); a.title = I[s].n; w.appendChild(a); });
    return w;
  }
  function showRoute(slug, focusBox, jump) {   // jump: сразу на место, без плавной прокрутки (переход по ссылке #route=)
    if (!I[slug]) return;
    var R = routeOf(slug), lines = !NARROW.matches;   // на узком экране линии скрыты (style.css), поэтому их и не считаем
    hl(function (c) { var r = R.role[c.dataset.slug]; if (r) c.classList.add('rt-' + r); return !!r; }, 'Маршрут: ' + short(I[slug].n), null);
    var self = cardFor(slug);
    curRoute = slug;
    if (routeBox) {
      // панель собирается целиком вне страницы и вставляется одним действием: так motion.js получает одно изменение, а не десятки
      var box = document.createDocumentFragment();
      var h = el('h2', '', 'Маршрут к предмету «' + I[slug].n + '»'); h.setAttribute('tabindex', '-1'); box.appendChild(h);
      var lg = el('p', 'rtlegend'); [['self', 'выбранный предмет'], ['need', 'нужен: без него трудно начать'], ['help', 'помогает'], ['down', 'пригодится для']].forEach(function (x) { var s = el('span', 'rtk ' + x[0], x[1]); lg.appendChild(s); }); box.appendChild(lg);
      var any = false;
      ['need', 'help', 'down'].forEach(function (r) {
        var list = Object.keys(R.role).filter(function (s) { return R.role[s] === r; }); if (!list.length) return; any = true;
        box.appendChild(el('p', 'lkh', ROLE[r] + (r === 'need' ? ' (по цепочке)' : '') + ': ' + list.length)); box.appendChild(chipList(list));
      });
      if (!any) box.appendChild(el('p', 'muted', 'Связей с другими предметами для этого предмета пока не отмечено.'));
      box.appendChild(el('p', 'muted', 'Связи составлены командой проекта по содержанию предметов: это логические предположения, а не официальные требования учебного плана.'));
      var acts = el('div', 'acts'), ob = el('button', 'btn-s', 'Открыть карточку'); ob.type = 'button'; ob.addEventListener('click', function () { open(slug, cardFor(slug)); });
      var cb = el('button', 'btn-o', 'Снять подсветку'); cb.type = 'button'; cb.addEventListener('click', function () { clearHl(); });
      acts.appendChild(ob); acts.appendChild(cb); box.appendChild(acts);
      routeBox.replaceChildren(box); routeBox.hidden = false;
      if (focusBox) h.focus({ preventScroll: true });
    }
    // линии и прокрутка — через кадр: замеры позиций сразу после смены подсветки заставляли браузер
    // пересчитать стили всей страницы в той же задаче (на слабых телефонах — до 200 мс без отклика), а прыжок
    // в том же кадре, где появилась панель маршрута над картой, засчитывался как сдвиг всей карты (CLS)
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      if (curRoute !== slug) return;
      if (lines) {
        [].forEach.call(track.querySelectorAll('.station'), function (st) { st.classList.add('vis'); });   // все карточки видны сразу, иначе линии упрутся в ещё не появившиеся
        drawRoute(R.edges, !RM);
      }
      if (self) self.scrollIntoView({ behavior: RM || jump ? 'auto' : 'smooth', block: 'center' });
    }); });
  }
  var NARROW = window.matchMedia('(max-width: 700px)');
  window.addEventListener('resize', function () { if (curRoute) { clearTimeout(window.__rt); window.__rt = setTimeout(function () { if (!curRoute) return; if (NARROW.matches) { if (routeSvg) { routeSvg.remove(); routeSvg = null; } return; } [].forEach.call(track.querySelectorAll('.station'), function (st) { st.classList.add('vis'); }); drawRoute(routeOf(curRoute).edges, false); }, 150); } });
  window.tmShowRoute = showRoute;   // для кнопки в окне карточки

  [].forEach.call(document.querySelectorAll('[data-job]'), function (b) {
    b.addEventListener('click', function () { if (b.getAttribute('aria-pressed') === 'true') clearHl(); else showJob(+b.dataset.job, false); });
  });
  [].forEach.call(document.querySelectorAll('[data-g]'), function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('aria-pressed') === 'true') { clearHl(); return; }
      hl(function (c) { return c.classList.contains('c-' + b.dataset.g); }, 'Подсвечено: ' + b.textContent.trim(), b);
    });
  });
  document.getElementById('hlclear').addEventListener('click', clearHl);

  // ---------- прогресс по пути и появление карточек ----------
  var stations = [].slice.call(track.querySelectorAll('.station')), jpos = document.getElementById('jpos'),
      jfill = document.getElementById('jfill'), jpct = document.getElementById('jpct'), lastTxt = '';
  stations.forEach(function (s) { [].forEach.call(s.querySelectorAll('.dc'), function (c, i) { c.style.setProperty('--i', Math.min(i, 12)); }); });
  if ('IntersectionObserver' in window && !RM) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('vis'); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -10% 0px' });
    stations.forEach(function (s) { io.observe(s); });
  } else stations.forEach(function (s) { s.classList.add('vis'); });
  // Сначала все чтения геометрии, потом все записи: раньше чтение после записи на каждом кадре прокрутки
  // заставляло браузер заново считать раскладку всей страницы. Записи, которые ничего не меняют, пропускаются.
  var lastPct = '';
  function prog() {
    var tr = track.getBoundingClientRect(), mid = window.innerHeight * 0.45,
        tops = stations.map(function (s) { return s.getBoundingClientRect().top; });
    var p = Math.min(1, Math.max(0, (mid - tr.top) / tr.height)), curIdx = -1;
    tops.forEach(function (t, i) { if (t < mid) curIdx = i; });
    track.style.setProperty('--fill', (p * tr.height) + 'px'); jfill.style.width = (p * 100) + '%';
    var pct = Math.round(p * 100) + '%'; if (pct !== lastPct) { jpct.textContent = pct; lastPct = pct; }
    stations.forEach(function (s, i) { s.classList.toggle('passed', tops[i] < mid); s.classList.toggle('current', i === curIdx); });
    var curSt = curIdx < 0 ? null : stations[curIdx];
    var txt = !curSt ? 'Старт: 1 курс' : curSt.classList.contains('finale') ? 'Финиш: диплом и работа' : curSt.dataset.course + ' курс · ' + curSt.dataset.sem + ' семестр';
    if (txt !== lastTxt) { jpos.textContent = txt; lastTxt = txt; }
  }
  var tick = false;
  function schedule() { if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; prog(); }); } }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule); prog();

  // ---------- ссылка на раскрытую карточку: path.html#d=код (старые index.html#d=… перенаправляются сюда) ----------
  window.addEventListener('hashchange', function () {
    var rt = location.hash.match(/^#route=([\w-]+)$/), jb = location.hash.match(/^#path=(\d+)$/);
    if (rt && I[rt[1]]) { if (xp) close(function () { showRoute(rt[1], true, true); }); else showRoute(rt[1], true, true); return; }
    if (jb && D.jobs[+jb[1]]) { if (xp) close(function () { showJob(+jb[1], false); }); else showJob(+jb[1], false); return; }
    var h = location.hash.match(/^#d=([\w-]+)/);
    if (h && I[h[1]] && cur !== h[1]) { var c = cardFor(h[1]); if (xp) swap(h[1], 1, true); else { if (c) c.scrollIntoView({ block: 'center' }); open(h[1], c, true); } }
  });
  var m = location.hash.match(/^#d=([\w-]+)/);
  if (m && I[m[1]]) { var c = cardFor(m[1]); if (c) { c.scrollIntoView({ block: 'center' }); prog(); } setTimeout(function () { open(m[1], c, true); }, 60); }
  // ссылка с карты профессий: path.html#path=N сразу подсвечивает путь к профессии N
  var mr = location.hash.match(/^#route=([\w-]+)$/);
  if (mr && I[mr[1]]) setTimeout(function () { showRoute(mr[1], true, true); }, 60);
  var mj = location.hash.match(/^#path=(\d+)$/);
  if (mj && D.jobs[+mj[1]]) setTimeout(function () { showJob(+mj[1], false); }, 60);
})();
