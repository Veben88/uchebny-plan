// Карта связей (map.html). Расположение узлов и линии считает build.py, здесь — выбор узла, панель со связями,
// фильтры, масштаб и перетаскивание. Без скрипта карта остаётся прокручиваемой схемой со ссылками на страницы предметов.
// Адрес: #node=<slug> — выбранный предмет, #job=<номер> — путь к профессии (ссылки с других страниц ведут сюда).
(function () {
  'use strict';
  var view = document.getElementById('gview'), cv = document.getElementById('gcanvas'), dataEl = document.getElementById('gd');
  if (!view || !cv || !dataEl) return;
  var D; try { D = JSON.parse(dataEl.textContent); } catch (e) { return; }
  var N = D.n, RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('tm-still'),
      NARROW = window.matchMedia ? matchMedia('(max-width: 700px)') : { matches: false };
  var $ = function (id) { return document.getElementById(id); };
  var side = $('gside'), gp = $('gp'), pick = $('gpick'), jobSel = $('gjob'), cnt = $('gcount'), live = $('glive'),
      reset = $('greset'), iso = $('giso'), full = $('gfull'), main = $('gmain');
  var nodes = {}, edges = [].slice.call(cv.querySelectorAll('path.ge'));
  [].forEach.call(cv.querySelectorAll('.gn'), function (a) { nodes[a.dataset.id] = a; });
  edges.forEach(function (p) { p._f = p.getAttribute('data-f'); p._t = p.getAttribute('data-t'); p._ty = p.getAttribute('class').split(' ')[1]; });
  var W = parseFloat(cv.style.width), H = parseFloat(cv.style.height), TOTAL = Object.keys(N).length;
  // Компьютер (тёмный экран карты): круглые узлы, линии от центра круга к центру круга (вторая геометрия из build.py, data-dc)
  var dirMode = 'all';   // режим связей выбранного предмета: all / up (предшествующие) / down (последующие)
  var ORB = !NARROW.matches && !!document.querySelector('.gscreen'), orbOn = true, orbSvg = cv.querySelector('.gorbit');
  if (ORB) edges.forEach(function (p) { var d = p.getAttribute('data-dc'); if (d) p.setAttribute('d', d); });
  view.classList.add('gjs');

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function semText(id) { return N[id][1] + ' сем.'; }

  // ---------- масштаб и перемещение ----------
  var T = { s: 1, x: 0, y: 0 }, ready = false; var zv = document.getElementById('gzv');
  // PL, PT — поле перекрыто плавающими панелями (тёмный экран на компьютере): слева — режимы и масштаб,
  // сверху справа — заголовок «Типов связей»; схема начинается правее и ниже них
  var PL = 0, PT = 0, railEl = document.querySelector('.gscreen .grail'), legS = view.querySelector('.glegd summary');
  function measurePL() {
    if (!ORB) return; var vr = view.getBoundingClientRect();
    PL = railEl && railEl.offsetWidth ? Math.max(0, Math.round(railEl.getBoundingClientRect().right - vr.left + 10)) : 0;
    PT = legS && legS.offsetHeight ? Math.max(0, Math.round(legS.getBoundingClientRect().bottom - vr.top + 4)) : 0;
  }
  function fitS() { return Math.min((view.clientWidth - PL) / W, (view.clientHeight - PT) / H); }
  function minS() { return Math.min(fitS(), 0.35); }
  function clampT() {
    var vw = view.clientWidth, vh = view.clientHeight, w = W * T.s, h = H * T.s;
    T.x = w <= vw - PL ? PL + (vw - PL - w) / 2 : Math.min(PL + 20, Math.max(vw - w - 40, T.x));
    T.y = h <= vh - PT ? PT + (vh - PT - h) / 2 : Math.min(PT + 20, Math.max(vh - h - 40, T.y));
  }
  var moveT;
  function apply(anim) {
    clampT();
    if (anim && !RM) { cv.classList.add('gmove'); clearTimeout(moveT); moveT = setTimeout(function () { cv.classList.remove('gmove'); }, 320); }
    cv.style.transform = 'translate(' + T.x.toFixed(1) + 'px,' + T.y.toFixed(1) + 'px) scale(' + T.s.toFixed(4) + ')';
    view.classList.toggle('gsmall', T.s < 0.62);       // мелкий масштаб: вторая строка узла скрыта, остаются названия
    if (zv) zv.textContent = Math.round(T.s * 100) + '%';
    if (typeof placeCard === 'function') placeCard(anim && !RM);
  }
  function zoomAt(f, px, py, anim) {
    view.classList.add('gused');
    var ns = Math.max(minS(), Math.min(1.6, T.s * f));
    T.x = px - (px - T.x) * (ns / T.s); T.y = py - (py - T.y) * (ns / T.s); T.s = ns; apply(anim);
  }
  function fit(anim) { T.s = fitS(); apply(anim); }
  function init() {                                      // первый показ: читаемый масштаб, начало плана слева сверху
    if (ready || !view.clientWidth) return;
    ready = true; measurePL(); T.s = Math.min(1, Math.max(fitS(), 0.86)); T.x = PL; T.y = PT; apply(false);
  }
  function inView(a) {
    var x = T.x + a.offsetLeft * T.s, y = T.y + a.offsetTop * T.s;
    return x > PL + 8 && y > 8 && x + a.offsetWidth * T.s < view.clientWidth - 8 && y + a.offsetHeight * T.s < view.clientHeight - 8;
  }
  function panTo(id, anim) {
    var a = nodes[id]; if (!a || !ready || inView(a)) return;
    T.x = view.clientWidth / 2 - (a.offsetLeft + a.offsetWidth / 2) * T.s;
    T.y = view.clientHeight / 2 - (a.offsetTop + a.offsetHeight / 2) * T.s; apply(anim !== false);
  }
  [].forEach.call(view.querySelectorAll('[data-z]'), function (b) {
    b.addEventListener('click', function () {
      var z = b.dataset.z, cx = view.clientWidth / 2, cy = view.clientHeight / 2;
      if (z === 'fit') fit(true); else zoomAt(z === 'in' ? 1.25 : 0.8, cx, cy, true);
    });
  });
  // колесо без Ctrl прокручивает страницу как обычно; Ctrl + колесо и щипок на тачпаде меняют масштаб карты
  view.addEventListener('wheel', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); var r = view.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top, false);
  }, { passive: false });
  var ptrs = {}, drag = null, pinch = null, moved = false;
  function pts() { return Object.keys(ptrs).map(function (k) { return ptrs[k]; }); }
  view.addEventListener('pointerdown', function (e) {
    if ((e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('.gzoom,.gcard,.gcomp,.glegd')) return;
    view.classList.add('gused');
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; var p = pts();
    if (p.length === 1) { drag = { x: e.clientX, y: e.clientY, tx: T.x, ty: T.y }; moved = false; }
    if (p.length === 2) {
      var r = view.getBoundingClientRect();
      pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, s: T.s, cx: (p[0].x + p[1].x) / 2 - r.left, cy: (p[0].y + p[1].y) / 2 - r.top };
      moved = true;
    }
  });
  view.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; var p = pts();
    if (pinch && p.length >= 2) { var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); zoomAt(pinch.s * d / pinch.d / T.s, pinch.cx, pinch.cy, false); return; }
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) > 6) { moved = true; view.classList.add('gdrag'); try { view.setPointerCapture(e.pointerId); } catch (err) {} }
    if (moved) { T.x = drag.tx + dx; T.y = drag.ty + dy; apply(false); }
  });
  function up(e) {
    delete ptrs[e.pointerId]; var n = pts().length;
    if (n < 2) pinch = null;
    if (n === 1 && moved) { var p = pts()[0]; drag = { x: p.x, y: p.y, tx: T.x, ty: T.y }; }   // после щипка продолжаем двигать одним пальцем
    if (!n) { drag = null; view.classList.remove('gdrag'); }
  }
  view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
  view.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);   // перетаскивание — не нажатие
  view.addEventListener('keydown', function (e) {
    var cx = view.clientWidth / 2, cy = view.clientHeight / 2, k = e.key;
    if (k === '+' || k === '=') zoomAt(1.25, cx, cy, true);
    else if (k === '-' || k === '_') zoomAt(0.8, cx, cy, true);
    else if (k === '0') fit(true);
    else if (k === 'Escape' && closePanels()) { /* сначала закрываются выдвижные панели */ }
    else if (k === 'Escape' && sel) clear();
    else if (e.target === view && /^Arrow/.test(k)) { T.x += k === 'ArrowLeft' ? 80 : k === 'ArrowRight' ? -80 : 0; T.y += k === 'ArrowUp' ? 80 : k === 'ArrowDown' ? -80 : 0; apply(true); }
    else return;
    e.preventDefault();
  });
  view.addEventListener('focusin', function (e) { var a = e.target.closest && e.target.closest('.gn'); if (a && !moved && !cv.classList.contains('gorb')) panTo(a.dataset.id); });

  // ---------- выбор узла ----------
  var sel = null, ROLES = ['r-self', 'r-need', 'r-help', 'r-down', 'r-job', 'r-key'], selT;
  function paint(roles, isOn) {
    cv.classList.add('gsel');
    var k = 0;
    Object.keys(nodes).forEach(function (id) {
      var a = nodes[id], r = roles[id]; a.classList.remove.apply(a.classList, ROLES);
      if (r) { a.classList.add('r-' + r); a.style.setProperty('--i', r === 'self' ? 0 : Math.min(++k, 14)); }
    });
    var j = 0;
    edges.forEach(function (p) {
      var on = !!isOn(p); p.classList.toggle('on', on);
      if (on && !RM) { p.style.setProperty('--len', Math.ceil(p.getTotalLength())); p.style.setProperty('--i', Math.min(j++, 14)); }
    });
    if (RM) return;
    cv.classList.remove('tm-gsel'); void cv.offsetWidth; cv.classList.add('tm-gsel');   // перезапуск: штамп на узле, соседи, линии дорисовываются
    clearTimeout(selT); selT = setTimeout(function () { cv.classList.remove('tm-gsel'); }, 1400);
  }
  function setHash(h) { try { history.replaceState(history.state, '', location.pathname + location.search + (h ? '#' + h : '')); } catch (e) {} }
  function head(kicker, title, meta) {
    var f = document.createDocumentFragment();
    f.appendChild(el('p', 'gk', kicker));
    var h = el('h3', 'gh3', title); h.tabIndex = -1; f.appendChild(h);
    if (meta) f.appendChild(el('p', 'gmeta', meta));
    return f;
  }
  function item(id, tag, tcls, why) {
    var li = el('li'), b = el('button', 'gnb'); b.type = 'button'; b.dataset.id = id;
    b.appendChild(el('b', '', N[id][0])); if (tag) b.appendChild(el('span', 'lkt ' + tcls, tag));
    li.appendChild(b); li.appendChild(el('small', '', semText(id) + (why ? ' · ' + why : ''))); return li;
  }
  function group(title, list, empty) {
    var s = el('section', 'gsec'); s.appendChild(el('h4', 'lkh', title + (list.length ? ' · ' + list.length : '')));
    if (!list.length) { s.appendChild(el('p', 'muted', empty)); return s; }
    var ul = el('ul', 'glist'); list.forEach(function (li) { ul.appendChild(li); }); s.appendChild(ul); return s;
  }
  function acts(links) {
    var d = el('div', 'hlinks2');
    links.forEach(function (l) { var a = el('a', l[2], l[0]); a.href = l[1]; d.appendChild(a); });
    var c = el('button', 'btn-o gclear', 'Снять выбор'); c.type = 'button'; c.addEventListener('click', function () { clear(); }); d.appendChild(c);
    return d;
  }
  function show(frag) {
    gp.textContent = ''; gp.appendChild(frag);
    if (!RM) { gp.classList.remove('tm-gp'); void gp.offsetWidth; gp.classList.add('tm-gp'); }
  }
  function byPlan(a, b) { return (parseInt(N[a][1], 10) || 0) - (parseInt(N[b][1], 10) || 0) || (N[a][0] < N[b][0] ? -1 : 1); }
  function selectNode(s, opt) {
    if (!N[s]) return;
    var upL = D.e.filter(function (e) { return e[1] === s; }), dnL = D.e.filter(function (e) { return e[0] === s; }), js = [], roles = {};
    var upV = dirMode === 'down' ? [] : upL, dnV = dirMode === 'up' ? [] : dnL;   // режим «связи»: на карте только опоры или только продолжения (панель показывает всё)
    upL.sort(function (a, b) { return (a[2] !== 'need') - (b[2] !== 'need') || byPlan(a[0], b[0]); }); dnL.sort(function (a, b) { return byPlan(a[1], b[1]); });
    D.j.forEach(function (j, i) { if (j[2].indexOf(s) >= 0) js.push(i); });
    upV.forEach(function (e) { roles[e[0]] = e[2] === 'need' ? 'need' : 'help'; });
    dnV.forEach(function (e) { roles[e[1]] = 'down'; });
    if (dirMode !== 'up') js.forEach(function (i) { roles['job-' + i] = 'job'; });
    roles[s] = 'self'; sel = { k: 'n', id: s };
    paint(roles, function (p) { return (p._f === s && dirMode !== 'up') || (p._t === s && dirMode !== 'down'); });
    var n = N[s], f = document.createDocumentFragment();
    f.appendChild(head(n[1] + ' семестр · ' + D.g[n[5]], n[0], [n[2] ? n[2] + ' з.е.' : '', n[3] ? n[3] + ' ч' : '', n[4]].filter(Boolean).join(' · ')));
    if (n[6]) f.appendChild(el('p', 'gwhat', n[6]));
    f.appendChild(group('Опирается на', upL.map(function (e) { return item(e[0], e[2] === 'need' ? 'нужен' : 'помогает', e[2], e[3]); }), 'Связей с более ранними предметами не отмечено.'));
    f.appendChild(group('Ведёт к', dnL.map(function (e) { return item(e[1], e[2] === 'need' ? 'нужен' : 'помогает', e[2], e[3]); }), 'Связей с более поздними предметами не отмечено.'));
    if (js.length) {
      var ps = el('section', 'gsec'); ps.appendChild(el('h4', 'lkh', 'Ключевой для профессий'));
      var w = el('div', 'ks'); js.forEach(function (i) { var b = el('button', 'kchip gnb', D.j[i][0]); b.type = 'button'; b.dataset.id = 'job-' + i; w.appendChild(b); });
      ps.appendChild(w); f.appendChild(ps);
    }
    var ac2 = acts([['Открыть страницу предмета', 'd/' + s + '.html', 'btn-s'], ['Маршрут на пути студента', 'path.html#route=' + s, 'btn-o']]);
    if (ORB) {                                              // «орбита»: связи вокруг предмета или обычная схема по семестрам
      var ob = el('button', 'btn-o gorbt', orbOn ? 'Показать на схеме семестров' : 'Связи вокруг предмета'); ob.type = 'button';
      ob.addEventListener('click', function () { orbOn = !orbOn; selectNode(s, { focus: true }); });
      ac2.insertBefore(ob, ac2.querySelector('.gclear'));
    }
    f.appendChild(ac2);
    f.appendChild(el('p', 'muted gtip', 'Повторное нажатие на выбранный узел тоже открывает страницу предмета.'));
    show(f); pick.value = s; jobSel.value = ''; setHash('node=' + s); cardAt = null; cardFor(s); after(opt); updRail();
    if (ORB) { if (orbOn) orbit(s, upV.map(function (e) { return { id: e[0], ty: e[2], dir: 'up' }; }).concat(dnV.map(function (e) { return { id: e[1], ty: e[2], dir: 'down' }; }), (dirMode === 'up' ? [] : js).map(function (i) { return { id: 'job-' + i, ty: 'job', dir: 'job' }; }))); else orbitClear(); placeCard(); }
    say('Выбран предмет «' + n[0] + '»: опирается на ' + upL.length + ', ведёт к ' + dnL.length + (js.length ? ', ключевой для профессий: ' + js.length : '') + '.');
  }
  function selectJob(i, opt) {
    var j = D.j[i]; if (!j) return;
    var roles = {}, set = {}; j[3].forEach(function (s) { roles[s] = 'need'; set[s] = 1; }); j[2].forEach(function (s) { roles[s] = 'key'; set[s] = 1; });
    roles['job-' + i] = 'self'; sel = { k: 'j', id: 'job-' + i }; orbitClear();
    paint(roles, function (p) { return p._t === 'job-' + i || (set[p._f] && set[p._t] && p._ty === 'need'); });
    var f = document.createDocumentFragment();
    f.appendChild(head('Путь к профессии', j[0], j[2].length + ' ключевых предметов и ' + j[3].length + ' — без которых их трудно начать'));
    f.appendChild(el('p', 'gwhat', j[1]));
    f.appendChild(group('Ключевые предметы', j[2].slice().sort(byPlan).map(function (s) { return item(s, 'ключевой', 'key', ''); }), ''));
    f.appendChild(group('Нужны для ключевых', j[3].slice().sort(byPlan).map(function (s) { return item(s, 'нужен', 'need', ''); }), 'Таких предметов не отмечено.'));
    var ac = acts([['Маршрут по семестрам', 'jobs.html#job-' + i, 'btn-s'], ['Показать на пути студента', 'path.html#path=' + i, 'btn-o']]);
    if (TM) {                                                  // «Интересная профессия»: кнопку оживляет profile.js
      var fb = el('button', 'mybtn my-job'); fb.type = 'button'; fb.dataset.job = i; fb.dataset.title = j[0]; fb.hidden = true;
      var fi = el('span', 'myi', '★'); fi.setAttribute('aria-hidden', 'true'); fb.appendChild(fi); fb.appendChild(document.createTextNode('Интересная профессия'));
      ac.insertBefore(fb, ac.firstChild);
    }
    f.appendChild(ac);
    f.appendChild(el('p', 'muted gtip', 'Ключевые предметы — оценка команды проекта по задачам профессии, а не официальный перечень и не гарантия трудоустройства.'));
    show(f); if (TM && TM.jobButtons) TM.jobButtons(); pick.value = ''; jobSel.value = String(i); setHash('job=' + i); cardAt = null; cardFor('job-' + i); after(opt); updRail(); placeCard();
    say('Путь к профессии «' + j[0] + '»: ключевых предметов ' + j[2].length + ', нужных для них ' + j[3].length + '.');
  }
  function after(opt) {
    opt = opt || {}; filt();
    if (opt.pan && !cv.classList.contains('gorb')) panTo(sel.id, opt.anim);
    if (opt.focus) { var h = gp.querySelector('.gh3'); if (h) h.focus({ preventScroll: true }); }
    if (opt.reveal && NARROW.matches) side.scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' });
  }
  function selectId(id, opt) { if (/^job-/.test(id)) selectJob(+id.slice(4), opt); else selectNode(id, opt); }
  function clear() {
    sel = null; cv.classList.remove('gsel', 'tm-gsel'); orbitClear();
    Object.keys(nodes).forEach(function (id) { nodes[id].classList.remove.apply(nodes[id].classList, ROLES); });
    edges.forEach(function (p) { p.classList.remove('on'); });
    idle(); pick.value = ''; jobSel.value = ''; setHash(mine ? 'mine' : ''); filt(); updRail(); cardFor(null); say('Выбор снят.');
  }
  function idle() {                                          // панель без выбора: подсказка или сводка «Мой маршрут»
    if (mine) { showMine(); return; }
    var f = document.createDocumentFragment(); f.appendChild(el('p', 'muted', 'Выбери предмет на карте или в списке: появится, на что он опирается, к чему ведёт и с какими профессиями связан.'));
    show(f);
  }

  // ---------- «Мой маршрут»: личные статусы, избранное и интересные профессии из «Моего плана» (profile.js) ----------
  // Пройдено и «Изучаю» — по статусам; «в планах» — избранные предметы и путь к интересным профессиям (ключевые и нужные для них).
  // Это личные пометки для планирования, а не оценки и не официальная успеваемость.
  var TM = window.TMProfile && window.TMProfile.available ? window.TMProfile : null, mineB = $('gmine'), mine = false, MCL = ['m-done', 'm-doing', 'm-plan'], mineN = {};
  function paintMine() {
    var pl = {}, n = { done: 0, doing: 0, plan: 0 }, now = TM ? TM.sem() : 0;
    if (TM) {
      TM.data().fav.forEach(function (s) { pl[s] = 1; });
      TM.jobIndexes().forEach(function (k) { var j = D.j[k]; if (j) j[2].concat(j[3]).forEach(function (s) { pl[s] = 1; }); });
    }
    Object.keys(nodes).forEach(function (id) {
      var a = nodes[id], c = ''; a.classList.remove.apply(a.classList, MCL);
      if (!mine) return;
      if (/^job-/.test(id)) c = TM.hasJob(+id.slice(4)) ? 'm-plan' : '';
      else { var st = TM.status(id); c = st ? 'm-' + st : pl[id] ? 'm-plan' : ''; if (c) n[c.slice(2)]++; }
      if (c) a.classList.add(c);
    });
    [].forEach.call(cv.querySelectorAll('.gch'), function (h) { h.classList.toggle('mnow', mine && +h.getAttribute('data-c') === now); });
    cv.classList.toggle('gmine', mine); mineN = n;
  }
  function showMine() {
    var n = mineN, now = TM.sem(), f = document.createDocumentFragment();
    f.appendChild(head('По личному плану', 'Мой маршрут', 'Пройдено: ' + n.done + ' · изучаю: ' + n.doing + ' · в планах: ' + n.plan + (now ? ' · сейчас ' + now + ' семестр' : '')));
    var ul = el('ul', 'glegend');
    [['m-done', 'Пройдено', 'по твоим статусам'], ['m-doing', 'Изучаю', 'по твоим статусам'], ['m-plan', 'В планах', 'избранные предметы и путь к интересным профессиям']].forEach(function (x) {
      var li = el('li'); li.appendChild(el('span', 'gsw ' + x[0])); li.appendChild(el('b', '', x[1])); li.appendChild(el('small', '', ' — ' + x[2])); ul.appendChild(li);
    });
    f.appendChild(ul);
    if (!n.done && !n.doing && !n.plan) f.appendChild(el('p', 'gwhat', 'Пока нет отметок. Статус «Изучаю» или «Пройдено» ставится на странице предмета, интересные профессии отмечаются на карте профессий.'));
    var d = el('div', 'hlinks2'), a = el('a', 'btn-s', 'Мой план'); a.href = 'profile.html'; d.appendChild(a);
    var b = el('a', 'btn-o', 'Карта профессий'); b.href = 'jobs.html'; d.appendChild(b); f.appendChild(d);
    f.appendChild(el('p', 'muted gtip', 'Личные пометки хранятся только в этом браузере. Это не оценки, не зачёты и не официальная успеваемость. Выбери предмет, чтобы увидеть его связи; маршрут останется подсвеченным.'));
    show(f);
  }
  function setMine(on) {
    if (!TM) return;
    mine = on; mineB.setAttribute('aria-pressed', on ? 'true' : 'false'); paintMine(); updRail();
    if (!sel) { idle(); setHash(on ? 'mine' : ''); }
    if (on && !RM) { cv.classList.remove('tm-gmine'); void cv.offsetWidth; cv.classList.add('tm-gmine'); setTimeout(function () { cv.classList.remove('tm-gmine'); }, 1200); }
    say(on ? 'Мой маршрут: пройдено ' + mineN.done + ', изучаю ' + mineN.doing + ', в планах ' + mineN.plan + '.' : 'Мой маршрут выключен.');
  }
  if (TM) {
    mineB.hidden = false;
    mineB.addEventListener('click', function () { setMine(!mine); });
    TM.on(function () { if (mine) { paintMine(); if (!sel) showMine(); } });
  }
  var sayT;
  function say(t) { clearTimeout(sayT); sayT = setTimeout(function () { live.textContent = t; }, 60); }
  cv.addEventListener('click', function (e) {
    var a = e.target.closest('.gn'); if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button) return;
    if (sel && sel.id === a.dataset.id) return;            // повторное нажатие — обычный переход по ссылке
    e.preventDefault(); selectId(a.dataset.id, { reveal: true });
  });
  gp.addEventListener('click', function (e) {
    var b = e.target.closest('.gnb'); if (!b) return;
    selectId(b.dataset.id, { pan: true, focus: true });
  });
  pick.addEventListener('change', function () { if (pick.value) selectNode(pick.value, { pan: true }); else if (sel) clear(); });
  jobSel.addEventListener('change', function () { if (jobSel.value !== '') { selectJob(+jobSel.value); if (ready) fit(true); } else if (sel) clear(); });

  // ---------- «орбита»: выбранный предмет в центре экрана, опоры по дуге слева, продолжения справа, профессии снизу ----------
  // Узлы двигаются сдвигом (transform), исходные позиции не меняются: «Снять выбор» возвращает схему по семестрам.
  var CR = 22, NH = 54;                                       // радиус круга узла и высота узла (как в build.py)
  function circleAt(a) { return [a.offsetLeft + (a.classList.contains('gl') ? a.offsetWidth - CR : CR), a.offsetTop + NH / 2]; }
  function orbitClear() {
    if (!ORB) return;
    cv.classList.remove('gorb');
    Object.keys(nodes).forEach(function (k) { var a = nodes[k]; a.style.transform = ''; a.classList.remove('gl'); });
    if (orbSvg) orbSvg.textContent = '';
  }
  function orbit(center, list) {
    if (!ORB || !ready || !nodes[center]) return;
    orbitClear();
    var vw = view.clientWidth, vh = view.clientHeight, LBL = 175;   // LBL — ширина подписи рядом с кругом
    var vr = view.getBoundingClientRect(), occ = 0;
    if (DESK && scr2.classList.contains('gd-open')) occ = side.offsetWidth + 12;   // панель «Подробнее» (по классу: она ещё может выезжать)
    [DESK ? null : side, view.querySelector('.glegd[open]')].forEach(function (o) {   // «Типы связей» справа: орбита — в свободной части
      if (!o) return; var r = o.getBoundingClientRect();
      if (r.width && r.left < vr.right - 4 && r.right > vr.left && r.left > vr.left + vr.width / 2) occ = Math.max(occ, vr.right - r.left + 12);
    });
    vw = vw - occ - PL;   // свободная часть поля: правее панели режимов, левее открытых панелей справа
    var up = list.filter(function (x) { return x.dir === 'up'; }), dn = list.filter(function (x) { return x.dir === 'down'; }), jb = list.filter(function (x) { return x.dir === 'job'; });
    var R = Math.max(DESK ? 230 : 190, Math.min(270, 150 + Math.max(up.length, dn.length) * 14));
    // масштаб, при котором круги вместе с подписями помещаются в поле (не крупнее 1,05, не мельче 0,55)
    var fitS = Math.min(1.05, (vw / 2 - 12) / (R + CR + LBL), (vh / 2 - 16) / (R * 0.78 + NH));
    fitS = Math.max(0.55, fitS);
    var lift = DESK ? 46 : 0, nMax = Math.max(up.length, dn.length), below, above, KYu, KYd, RYu, RYd, jobY, yTop, yBot;
    function geo(s) {                                          // свободное место над и под центром при масштабе s (в координатах карты)
      below = (vh / 2 - lift - (DESK ? 70 : 16)) / s - NH / 2; above = (vh / 2 + lift - 16) / s - NH / 2;
      // овал орбиты: верхняя половина выше (над центром — карточка предмета), нижняя — до нижнего края и ряда профессий
      KYu = Math.min(1.4, Math.max(0.78, above / R)); KYd = Math.min(1.35, Math.max(0.55, below / (R * (jb.length ? 1.02 : 1))));
      RYu = R * KYu; RYd = R * KYd; jobY = Math.min(below, R * 1.02 * KYd);
      yTop = -Math.min(above, RYu * 0.94); yBot = jb.length ? jobY * 0.9 - NH - 6 : Math.min(below, RYd * 0.94);
      return nMax > 1 ? (yBot - yTop) / (nMax - 1) : 99;
    }
    while (fitS > 0.62 && geo(fitS) < 60) fitS -= 0.03;      // много связей: мельче, чтобы подписи стояли с шагом не меньше 60
    geo(fitS);
    var mx = (PL + vw / 2 - T.x) / T.s, my = (vh / 2 - T.y) / T.s;      // центр свободной части в координатах карты — остаётся на месте
    T.s = fitS; T.x = PL + vw / 2 - mx * T.s; T.y = vh / 2 - my * T.s; apply(false);
    var s = T.s, cx = mx, cy = my + lift / s, pos = {};   // место над центром — для карточки предмета
    // карточка над центром (в координатах карты): узлы рядом с ней отодвигаются вбок
    var cw = card && !card.hidden ? card.offsetWidth : 0, ch = card && !card.hidden ? card.offsetHeight : 0, ab = 30 * Math.max(s, .7);
    var hw = (cw / 2 + 8) / s + CR, cTop = (ab + ch + 8) / s + NH / 2, cBot = ab / s - NH / 2;
    // узлы дуги — с равным шагом по высоте (подписи не налезают друг на друга), по горизонтали — на овале
    function arc(arr, left) {
      var n = arr.length; if (!n) return;
      var sp = n > 1 ? Math.min(96, Math.max(0, (yBot - yTop) / (n - 1))) : 0, len = sp * (n - 1);
      var y0 = Math.max(yTop, Math.min(yBot - len, NH / 3 - len / 2));   // середина дуги — чуть ниже центра
      arr.forEach(function (x, i) {
        var y = y0 + sp * i, ry = y < 0 ? RYu : RYd, dx = R * Math.sqrt(Math.max(0.12, 1 - (y / ry) * (y / ry)));
        if (cw && -y > cBot && -y < cTop) dx = Math.max(dx, hw);
        pos[x.id] = [cx + (left ? -dx : dx), cy + y];
      });
    }
    arc(up, true); arc(dn, false);
    (function () {                                             // профессии — внизу, в ряд по дуге
      var n = jb.length, span = Math.min(50, 30 * (n - 1));
      jb.forEach(function (x, i) { var t = (n === 1 ? 90 : 90 - span / 2 + span * i / (n - 1)) * Math.PI / 180; pos[x.id] = [cx + R * 1.02 * Math.cos(t), cy + jobY * Math.sin(t)]; });
    })();
    pos[center] = [cx, cy]; cardAt = [cx, cy];
    cv.classList.add('gorb');
    Object.keys(pos).forEach(function (id) {
      var a = nodes[id]; if (!a) return;
      if (pos[id][0] < cx - 20) a.classList.add('gl');          // слева от центра подпись — слева от круга
      var o = circleAt(a); a.style.transform = 'translate(' + (pos[id][0] - o[0]).toFixed(1) + 'px,' + (pos[id][1] - o[1]).toFixed(1) + 'px)';
    });
    // линии орбиты: изогнутые, от круга к кругу; «нужен» дорисовывается, остальные проявляются (как на схеме)
    var ns = 'http://www.w3.org/2000/svg', k = 0;
    list.forEach(function (x) {
      if (!pos[x.id]) return;
      var a = x.dir === 'up' ? pos[x.id] : pos[center], b = x.dir === 'up' ? pos[center] : pos[x.id];
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, off = (CR + 6);
      var sx = a[0] + ux * off, sy = a[1] + uy * off, ex = b[0] - ux * (off + 2), ey = b[1] - uy * (off + 2);
      var qx = (sx + ex) / 2 - uy * L * 0.12, qy = (sy + ey) / 2 + ux * L * 0.12;
      var p = document.createElementNS(ns, 'path'); p.setAttribute('class', 'ge on ' + x.ty); p.setAttribute('d', 'M' + sx.toFixed(1) + ',' + sy.toFixed(1) + ' Q' + qx.toFixed(1) + ',' + qy.toFixed(1) + ' ' + ex.toFixed(1) + ',' + ey.toFixed(1));
      p.setAttribute('marker-end', 'url(#ga-' + x.ty + ')'); orbSvg.appendChild(p);
      if (!RM) { p.style.setProperty('--len', Math.ceil(p.getTotalLength())); p.style.setProperty('--i', Math.min(k++, 14)); }
    });
  }
  function reorbit() { if (sel && sel.k === 'n' && cv.classList.contains('gorb')) selectNode(sel.id, {}); }

  // ---------- экран карты на компьютере: карточка рядом с выбранным, панель «Подробнее», фильтры, звезда ----------
  var DESK = ORB, scr2 = document.querySelector('.gscreen'), card = null, glow = null, cardId = null, cardAt = null,
      tools = $('gtools'), filtB = $('gfiltb'), searchB = $('gsearch'), favB = $('gfav');
  function semCourse(sem) {                                    // «1–2» → «1 курс · 1–2 семестры», «3» → «2 курс · 3 семестр»
    var m = String(sem).split(/[–-]/), a = parseInt(m[0], 10) || 1, z = parseInt(m[m.length - 1], 10) || a, ca = Math.ceil(a / 2), cz = Math.ceil(z / 2);
    return (ca === cz ? ca : ca + '–' + cz) + ' курс · ' + sem + (a === z ? ' семестр' : ' семестры');
  }
  function cardFor(id) {                                      // компактная карточка выбранного: как в референсе, рядом с узлом
    if (!DESK) return;
    if (!card) {
      card = el('div', 'gcard'); card.setAttribute('role', 'group'); card.setAttribute('aria-label', 'Выбранный узел');
      view.appendChild(card);
      card.addEventListener('click', function (e) {
        if (e.target.closest('.gcmore')) { drawer(true, false); return; }
        var a = e.target.closest('a[href^="d/"]'); if (a && sel && sel.k === 'n') focusTo(sel.id);
      });
    }
    var back = card.contains(document.activeElement) && nodes[cardId];   // фокус был в карточке — возвращается на узел
    cardId = id; card.textContent = ''; card.hidden = !id; scr2.classList.toggle('gcarded', !!id);
    if (!glow) { glow = el('span', 'gglow'); glow.setAttribute('aria-hidden', 'true'); cv.insertBefore(glow, cv.firstChild); }   // лучи света за выбранным
    glow.hidden = !id;
    if (id && !RM) { glow.classList.remove('tm-gl'); void glow.offsetWidth; glow.classList.add('tm-gl'); }
    if (back && !id) back.focus({ preventScroll: true });
    if (!id) { updFav(); return; }
    var job = /^job-/.test(id), i = job ? +id.slice(4) : -1, n = job ? null : N[id];
    card.appendChild(el('b', 'gct', job ? D.j[i][0] : n[0]));
    card.appendChild(el('span', 'gcm', job ? 'Профессия · ключевых предметов: ' + D.j[i][2].length : semCourse(n[1])));
    if (!job) card.appendChild(el('span', 'gcm', [n[2] ? n[2] + ' з.е.' : '', n[3] ? n[3] + ' ч' : ''].filter(Boolean).join(' · ')));
    if (!job) {                                                // режим связей: все · предшествующие · последующие
      var seg = el('span', 'gseg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Какие связи показывать');
      [['all', 'Все связи'], ['up', 'До'], ['down', 'После']].forEach(function (m) {
        var b = el('button', 'gsb', m[1]); b.type = 'button'; b.setAttribute('aria-pressed', dirMode === m[0] ? 'true' : 'false');
        b.title = { all: 'Опоры и продолжения', up: 'Только предшествующие предметы (на что опирается)', down: 'Только последующие предметы (к чему ведёт)' }[m[0]];
        b.addEventListener('click', function (e) { e.stopPropagation(); if (dirMode === m[0]) return; dirMode = m[0]; selectNode(id, {}); var nb = card.querySelector('.gsb[aria-pressed="true"]'); if (nb) nb.focus({ preventScroll: true }); });
        seg.appendChild(b);
      });
      card.appendChild(seg);
    }
    var row = el('span', 'gcrow'), more = el('button', 'gcmore', 'Подробнее'); more.type = 'button'; more.setAttribute('aria-controls', 'gside');
    var go = el('a', 'gcgo', job ? 'Маршрут по семестрам' : 'Открыть страницу'); go.href = job ? 'jobs.html#job-' + i : 'd/' + id + '.html';
    row.appendChild(more); row.appendChild(go); card.appendChild(row);
    if (!RM) { card.classList.remove('tm-gc'); void card.offsetWidth; card.classList.add('tm-gc'); }
    updFav();
  }
  function placeCard(anim) {                                  // над узлом; координаты карты → экран, размер карточки не масштабируется
    if (!card || card.hidden || !cardId || !nodes[cardId]) return;
    var p = cardAt;                                            // в «орбите» — центр орбиты, иначе — круг узла на схеме
    if (!p) p = circleAt(nodes[cardId]);
    glow.style.left = p[0] + 'px'; glow.style.top = p[1] + 'px';
    card.classList.toggle('gcmove', !!anim);
    var x = T.x + p[0] * T.s, y = T.y + p[1] * T.s, w = card.offsetWidth, h = card.offsetHeight;
    x = Math.max(8, Math.min(view.clientWidth - w - 8, x - w / 2)); y = y - 30 * Math.max(T.s, .7) - h;
    if (y < 8) y = T.y + p[1] * T.s + 34;                    // наверху не помещается — под узлом
    card.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }
  function updFav() {                                          // звезда в шапке: избранный предмет или интересная профессия
    if (!favB) return;
    if (!TM) { favB.hidden = true; return; }
    var id = cardId, job = id && /^job-/.test(id), on = !!id && (job ? TM.hasJob(+id.slice(4)) : TM.has('fav', id));
    favB.disabled = !id; favB.setAttribute('aria-pressed', on ? 'true' : 'false');
    var t = !id ? 'Выбери предмет, чтобы добавить его в избранное' : job ? (on ? 'Убрать из интересных профессий' : 'В интересные профессии') : (on ? 'Убрать из избранного' : 'В избранное');
    favB.title = t; favB.setAttribute('aria-label', t);
  }
  if (favB) favB.addEventListener('click', function () {
    if (!TM || !cardId) return;
    if (/^job-/.test(cardId)) TM.toggleJob(+cardId.slice(4), D.j[+cardId.slice(4)][0]); else TM.toggle('fav', cardId, N[cardId][0]);
    updFav(); say(favB.getAttribute('aria-pressed') === 'true' ? 'Добавлено.' : 'Убрано.');
  });
  if (TM) TM.on(updFav);
  // выдвижные панели: «Подробнее» справа и «Курс, семестры и фильтры» под кнопкой в шапке; закрытые — недоступны с клавиатуры
  function drawer(on, pickFocus) {
    if (!DESK) return; scr2.classList.toggle('gd-open', on); side.inert = !on;
    if (sel && sel.k === 'n' && cv.classList.contains('gorb')) reorbit();   // орбита — в свободной части поля (панель перерисовывается)
    if (on) { var t = pickFocus ? pick : (gp.querySelector('.gh3') || pick); setTimeout(function () { t.focus({ preventScroll: true }); }, 30); }
  }
  function filters(on) {
    if (!DESK || !tools) return; scr2.classList.toggle('gf-open', on); tools.inert = !on; filtB.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) { var d0 = tools.querySelector('.gfil'); if (d0) d0.open = true; var f0 = tools.querySelector('[data-course][aria-pressed="true"]') || tools.querySelector('button'); if (f0) f0.focus(); }
  }
  function closePanels() {
    if (!DESK) return false;
    if (scr2.classList.contains('gf-open')) { filters(false); filtB.focus(); return true; }
    if (scr2.classList.contains('gd-open')) { drawer(false); (card && !card.hidden ? card.querySelector('.gcmore') : searchB).focus(); return true; }
    return false;
  }
  if (DESK) {
    scr2.classList.add('gdesk'); side.inert = true; if (tools) tools.inert = true;
    var xb = el('button', 'gdx', '×'); xb.type = 'button'; xb.setAttribute('aria-label', 'Закрыть панель'); xb.addEventListener('click', function () { drawer(false); }); side.insertBefore(xb, side.firstChild);
    searchB.addEventListener('click', function () { drawer(!scr2.classList.contains('gd-open'), true); });
    filtB.addEventListener('click', function () { filters(!scr2.classList.contains('gf-open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !view.contains(document.activeElement) && closePanels()) e.preventDefault(); });
    document.addEventListener('click', function (e) { if (scr2.classList.contains('gf-open') && !e.target.closest('#gtools') && !e.target.closest('#gfiltb')) filters(false); });
    pick.addEventListener('change', function () { if (pick.value) drawer(true); });
    // Tab с выбранного узла ведёт в его карточку, Shift+Tab из карточки — обратно на узел
    cv.addEventListener('keydown', function (e) {
      var a = e.target.closest && e.target.closest('.gn');
      if (e.key !== 'Tab' || e.shiftKey || !a || !card || card.hidden || a.dataset.id !== cardId) return;
      e.preventDefault(); card.querySelector('button,a').focus({ preventScroll: true });
    });
    view.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !e.shiftKey || !card || card.hidden || e.target !== card.querySelector('button,a') || !nodes[cardId]) return;
      e.preventDefault(); nodes[cardId].focus({ preventScroll: true });
    });
  }

  // ---------- фильтры ----------
  var F;
  function blank() { return { sem: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 }, g: { 0: 1, 1: 1, 2: 1, 3: 1 }, t: { need: 1, helps: 1, job: 1 }, iso: false }; }
  F = blank();
  function vis(id) {
    var a = nodes[id];
    if (/^job-/.test(id)) return !!F.t.job;
    if (!F.g[a.dataset.g] || (F.iso && a.dataset.l === '0')) return false;
    return a.dataset.sems.trim().split(' ').some(function (x) { return F.sem[x]; });
  }
  function filt() {
    var shown = 0, hid = {}, ne = 0, nv = 0;
    Object.keys(nodes).forEach(function (id) {
      var v = vis(id); nodes[id].classList.toggle('ghide', !v); if (!v) hid[id] = 1;
      if (v && !/^job-/.test(id)) shown++;
      nodes[id].tabIndex = v ? 0 : -1;
    });
    edges.forEach(function (p) { var v = !!(F.t[p._ty] && !hid[p._f] && !hid[p._t]); p.classList.toggle('ghide', !v); ne++; if (v) nv++; });
    var changed = JSON.stringify(F) !== JSON.stringify(blank());
    reset.hidden = !changed;
    cnt.textContent = 'На карте предметов: ' + shown + ' из ' + TOTAL + ', связей: ' + nv + ' из ' + ne + '.' +
      (changed && shown < TOTAL ? ' Остальные скрыты фильтрами.' : '') + (sel && hid[sel.id] ? ' Выбранный узел скрыт фильтром.' : '');
  }
  [].forEach.call(document.querySelectorAll('[data-gf]'), function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.gf, v = b.dataset.v; F[k][v] = F[k][v] ? 0 : 1;
      b.setAttribute('aria-pressed', F[k][v] ? 'true' : 'false'); filt();
    });
  });
  iso.addEventListener('click', function () { F.iso = !F.iso; iso.setAttribute('aria-pressed', F.iso ? 'true' : 'false'); filt(); });
  reset.addEventListener('click', function () {
    F = blank(); iso.setAttribute('aria-pressed', 'false');
    [].forEach.call(document.querySelectorAll('[data-gf]'), function (b) { b.setAttribute('aria-pressed', 'true'); });
    filt(); syncCourse(); var f0 = document.querySelector('[data-course]') || document.querySelector('[data-gf]'); if (f0) f0.focus();
  });

  // ---------- курс → семестры: вкладка курса оставляет на карте два его семестра, кнопки семестров уточняют выбор ----------
  var courseB = [].slice.call(document.querySelectorAll('[data-course]'));
  function syncCourse() {                                  // какая вкладка нажата: курс, если видны ровно его семестры; «Все» — если все
    var on = Object.keys(F.sem).filter(function (k) { return F.sem[k]; }).map(Number), cur = -1;
    if (on.length === 8) cur = 0; else if (on.length === 2 && on[0] % 2 === 1 && on[1] === on[0] + 1) cur = (on[0] + 1) / 2;
    courseB.forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.course === cur ? 'true' : 'false'); });
  }
  courseB.forEach(function (b) {
    b.addEventListener('click', function () {
      var c = +b.dataset.course;
      Object.keys(F.sem).forEach(function (k) { F.sem[k] = !c || Math.ceil(k / 2) === c ? 1 : 0; });
      [].forEach.call(document.querySelectorAll('[data-gf="sem"]'), function (x) { x.setAttribute('aria-pressed', F.sem[x.dataset.v] ? 'true' : 'false'); });
      filt(); syncCourse();
      if (c && ready) {                                    // показываем семестры курса: сдвигаем карту к их столбцам
        var h = cv.querySelector('.gch[data-c="' + (c * 2 - 1) + '"]'); if (h) { T.x = 24 - h.offsetLeft * T.s; apply(true); }
      }
    });
  });
  [].forEach.call(document.querySelectorAll('[data-gf="sem"]'), function (b) { b.addEventListener('click', syncCourse); });

  // ---------- панель режимов: граф · путь по семестрам (ссылка) · маршрут к профессии · мой маршрут ----------
  var rail = document.querySelector('.grail'), fly = $('gjobfly'), railB = {};
  [].forEach.call(document.querySelectorAll('.grm[data-mode]'), function (b) { railB[b.dataset.mode] = b; });
  function updRail() {
    if (!rail) return;
    var job = sel && sel.k === 'j' ? +sel.id.slice(4) : -1;
    railB.graph.setAttribute('aria-pressed', job < 0 && !mine ? 'true' : 'false');
    railB.job.setAttribute('aria-pressed', job >= 0 ? 'true' : 'false');
    if (railB.mine) railB.mine.setAttribute('aria-pressed', mine ? 'true' : 'false');
    [].forEach.call(document.querySelectorAll('[data-jobpick]'), function (x) { x.setAttribute('aria-pressed', +x.dataset.jobpick === job ? 'true' : 'false'); });
  }
  function flyOpen(on, focus) {
    if (!fly) return; fly.hidden = !on; railB.job.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on && focus) { var f0 = fly.querySelector('[aria-pressed="true"]') || fly.querySelector('button'); if (f0) f0.focus(); }
  }
  if (rail) {
    railB.graph.addEventListener('click', function () { flyOpen(false); if (mine) setMine(false); if (sel) clear(); else updRail(); });
    railB.job.addEventListener('click', function () { flyOpen(fly.hidden, true); });
    fly.addEventListener('click', function (e) {
      var b = e.target.closest('[data-jobpick]'); if (!b) return;
      selectJob(+b.dataset.jobpick, { focus: false }); if (ready) fit(true); flyOpen(false); railB.job.focus();
    });
    fly.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); flyOpen(false); railB.job.focus(); } });
    document.addEventListener('click', function (e) { if (fly && !fly.hidden && !e.target.closest('.gjobfly') && !e.target.closest('.grm[data-mode="job"]')) flyOpen(false); });
    if (TM && railB.mine) { railB.mine.hidden = false; railB.mine.addEventListener('click', function () { setMine(!mine); if (DESK && !sel) drawer(mine, false); }); }   // сводка «Мой маршрут» — в панели справа
  }

  // ---------- телефон: по умолчанию панель и список, вся карта — по кнопке ----------
  function setFull(on) {
    main.classList.toggle('gopen', on); full.setAttribute('aria-expanded', on ? 'true' : 'false');
    full.textContent = on ? 'Скрыть карту' : 'Показать всю карту';
    if (on) { init(); apply(false); if (sel) panTo(sel.id, false); }
  }
  full.addEventListener('click', function () { setFull(!main.classList.contains('gopen')); if (main.classList.contains('gopen')) main.scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' }); });
  // карточка выбранного — сразу под «Типами связей» (их высота зависит от ширины окна и от того, свёрнуты ли они)
  var leg = view.querySelector('.glegd'), scr = document.querySelector('.gscreen');
  function placeSide() {
    if (!ORB || !leg || !scr) return;
    var l = leg.getBoundingClientRect(), g = scr.getBoundingClientRect(); if (!l.height) return;
    scr.style.setProperty('--side-top', Math.round(l.bottom - g.top + 12) + 'px');
    scr.style.setProperty('--side-max', Math.max(140, Math.round(g.bottom - l.bottom - 84)) + 'px');
  }
  if (ORB && leg) leg.open = false;   // «Типы связей» свёрнуты до заголовка: схема не закрыта, раскрываются по нажатию
  placeSide(); if (leg) leg.addEventListener('toggle', function () { placeSide(); if (ORB) reorbit(); });   // раскрытые «Типы связей» — орбита левее
  window.addEventListener('resize', placeSide);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeSide);
  var det = document.querySelector('.gfil');
  if (det) det.open = DESK;   // фильтры раскрываются по нажатию (без скрипта видны сразу); на компьютере — в панели под кнопкой в шапке
  document.addEventListener('click', function (e) { if (det && det.open && !NARROW.matches && !DESK && !e.target.closest('.gfil')) det.open = false; });
  if (det && !DESK) det.addEventListener('keydown', function (e) { if (e.key === 'Escape' && det.open) { det.open = false; det.querySelector('summary').focus(); } });
  var rsT;
  window.addEventListener('resize', function () { clearTimeout(rsT); rsT = setTimeout(function () { if (!ready) init(); else if (view.clientWidth) { measurePL(); apply(false); } }, 120); });

  // ---------- переход к предмету: узел «раскрывается» в шапку страницы предмета (View Transitions между страницами) ----------
  function focusTo(id) {
    if (RM || !nodes[id]) return;
    Object.keys(nodes).forEach(function (k) { nodes[k].style.viewTransitionName = ''; });
    nodes[id].style.viewTransitionName = 'tm-focus';
    try { sessionStorage.setItem('tmFocus', '1'); } catch (e) {}
  }
  cv.addEventListener('click', function (e) {                // повторное нажатие на выбранный узел ведёт на страницу предмета
    var a = e.target.closest('.gn'); if (a && sel && sel.id === a.dataset.id && !/^job-/.test(a.dataset.id) && !e.defaultPrevented) focusTo(a.dataset.id);
  });
  gp.addEventListener('click', function (e) { var a = e.target.closest('a[href^="d/"]'); if (a && sel && sel.k === 'n') focusTo(sel.id); });
  // ---------- состояние карты при возврате («Назад» со страницы предмета): масштаб, сдвиг, фильтры, «Мой маршрут» ----------
  window.addEventListener('pageshow', function (e) { if (e.persisted) Object.keys(nodes).forEach(function (k) { nodes[k].style.viewTransitionName = ''; }); });
  var SKEY = 'tm-map-v1';
  function saveState() { try { sessionStorage.setItem(SKEY, JSON.stringify({ T: ready ? T : null, F: F, mine: mine, hash: location.hash })); } catch (e) {} }
  window.addEventListener('pagehide', saveState);
  function restoreState() {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0], st;
    if (!nav || nav.type !== 'back_forward') return false;
    try { st = JSON.parse(sessionStorage.getItem(SKEY) || 'null'); } catch (e) { st = null; }
    if (!st || st.hash !== location.hash) return false;
    if (st.F && st.F.sem) {
      F = st.F;
      [].forEach.call(document.querySelectorAll('[data-gf]'), function (b) { b.setAttribute('aria-pressed', F[b.dataset.gf] && F[b.dataset.gf][b.dataset.v] ? 'true' : 'false'); });
      iso.setAttribute('aria-pressed', F.iso ? 'true' : 'false'); syncCourse(); filt();
    }
    if (st.mine && TM && !mine) setMine(true);
    if (st.T && ready) { T = st.T; apply(false); }
    return !!st.T;
  }

  // ---------- адрес ----------
  function fromHash(first) {
    var h = location.hash.slice(1), m;
    if ((m = h.match(/^node=([\w-]+)$/)) && N[m[1]]) selectNode(m[1], { pan: true, anim: !first });
    else if ((m = h.match(/^job=(\d+)$/)) && D.j[+m[1]]) { selectJob(+m[1]); if (ready) fit(!first); }
    else if (h === 'mine' && TM) { if (sel) clear(); if (!mine) setMine(true); }
    else if (!first && sel) clear();
  }
  window.addEventListener('hashchange', function () { fromHash(false); });

  init(); filt();
  if (!RM && !document.documentElement.classList.contains('tm-lite')) {   // карта собирается по семестрам слева направо
    cv.classList.add('tm-gin'); setTimeout(function () { cv.classList.remove('tm-gin'); }, 1600);
  }
  var restored = false;
  fromHash(true);
  restored = restoreState();                                   // после выбора по адресу: вернуть масштаб и положение, как было
  if (restored) reorbit();
  updRail();
})();
