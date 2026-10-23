// Интерактивный путь студента: раскрытие карточек на месте, прогресс по семестрам, подсветка пути к профессии.
(function () {
  'use strict';
  var pd = document.getElementById('pd'); if (!pd) return;
  document.documentElement.classList.add('js');
  var D = JSON.parse(pd.textContent), I = D.items;
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches, DUR = RM ? 0 : 380, EASE = 'steps(12, end)';
  var track = document.getElementById('track'), journey = document.getElementById('journey');
  var COL = ['#E60023', '#101010', '#5E5E5E', '#FFFFFF'];   // цвета групп, как .c-0….c-3 в style.css
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
  function lock(on) {
    var sb = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = on ? 'hidden' : '';
    document.body.style.paddingRight = on && sb > 0 ? sb + 'px' : '';
  }
  function cardFor(slug) { return document.querySelector('.dc[data-slug="' + slug + '"]'); }
  function visible(r) { return r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight; }
  function open(slug, from, viaHistory) {
    if (!I[slug]) return;
    if (xp) { swap(slug, 1, viaHistory); return; }
    src = from || cardFor(slug); cur = slug; lastFocus = document.activeElement;
    ov = el('div', 'ov'); xp = el('div', 'xp');
    xp.setAttribute('role', 'dialog'); xp.setAttribute('aria-modal', 'true'); xp.setAttribute('aria-labelledby', 'xpt');
    var x = el('button', 'xclose'); x.type = 'button'; x.setAttribute('aria-label', 'Закрыть'); x.textContent = '×';
    x.addEventListener('click', requestClose); ov.addEventListener('click', requestClose);
    var inner = el('div', 'xin'); inner.appendChild(build(slug));
    xp.appendChild(x); xp.appendChild(inner);
    document.body.appendChild(ov); document.body.appendChild(xp); lock(true);
    var T = geom(); xp.style.left = T.left + 'px'; xp.style.width = T.width + 'px'; xp.style.top = '0px';
    var hh = T.height || Math.min(xp.scrollHeight, window.innerHeight - 48);
    var top = T.top != null ? T.top : (window.innerHeight - hh) / 2;
    xp.style.top = top + 'px'; xp.style.height = hh + 'px'; xp.style.borderRadius = T.r + 'px';
    var r = src && src.getBoundingClientRect();
    if (src) src.classList.add('ghost');
    if (DUR && visible(r)) {
      xp.animate([{ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: '16px' },
                  { left: T.left + 'px', top: top + 'px', width: T.width + 'px', height: hh + 'px', borderRadius: T.r + 'px' }], { duration: DUR, easing: EASE });
    } else if (DUR) xp.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: DUR * 0.6, easing: EASE });
    if (DUR) {
      inner.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: DUR * 0.45, easing: EASE, fill: 'backwards' });
      ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DUR });
    }
    growBars(inner);
    setTimeout(function () { if (xp) x.focus({ preventScroll: true }); }, DUR);
    if (!viaHistory) { history.pushState({ xp: slug }, '', '#d=' + slug); pushed = true; }
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
      ? X.animate([{ left: X.style.left, top: X.style.top, width: X.style.width, height: X.style.height, borderRadius: X.style.borderRadius },
                   { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: '16px' }], { duration: DUR * 0.85, easing: EASE, fill: 'forwards' })
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
    journey.classList.remove('dimmed'); [].forEach.call(document.querySelectorAll('.dc.hl'), function (c) { c.classList.remove('hl'); });
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

  // ---------- ссылка на раскрытую карточку: index.html#d=код ----------
  window.addEventListener('hashchange', function () {
    var h = location.hash.match(/^#d=([\w-]+)/);
    if (h && I[h[1]] && cur !== h[1]) { var c = cardFor(h[1]); if (xp) swap(h[1], 1, true); else { if (c) c.scrollIntoView({ block: 'center' }); open(h[1], c, true); } }
  });
  var m = location.hash.match(/^#d=([\w-]+)/);
  if (m && I[m[1]]) { var c = cardFor(m[1]); if (c) { c.scrollIntoView({ block: 'center' }); prog(); } setTimeout(function () { open(m[1], c, true); }, 60); }
})();
