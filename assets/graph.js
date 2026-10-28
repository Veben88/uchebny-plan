// Карта связей (map.html). Расположение узлов и линии считает build.py, здесь — выбор узла, панель со связями,
// фильтры, масштаб и перетаскивание. Без скрипта карта остаётся прокручиваемой схемой со ссылками на страницы предметов.
// Адрес: #node=<slug> — выбранный предмет, #job=<номер> — путь к профессии (ссылки с других страниц ведут сюда).
(function () {
  'use strict';
  var view = document.getElementById('gview'), cv = document.getElementById('gcanvas'), dataEl = document.getElementById('gd');
  if (!view || !cv || !dataEl) return;
  var D; try { D = JSON.parse(dataEl.textContent); } catch (e) { return; }
  var N = D.n, RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches,
      NARROW = window.matchMedia ? matchMedia('(max-width: 700px)') : { matches: false };
  var $ = function (id) { return document.getElementById(id); };
  var side = $('gside'), gp = $('gp'), pick = $('gpick'), jobSel = $('gjob'), cnt = $('gcount'), live = $('glive'),
      reset = $('greset'), iso = $('giso'), full = $('gfull'), main = $('gmain');
  var nodes = {}, edges = [].slice.call(cv.querySelectorAll('path.ge'));
  [].forEach.call(cv.querySelectorAll('.gn'), function (a) { nodes[a.dataset.id] = a; });
  edges.forEach(function (p) { p._f = p.getAttribute('data-f'); p._t = p.getAttribute('data-t'); p._ty = p.getAttribute('class').split(' ')[1]; });
  var W = parseFloat(cv.style.width), H = parseFloat(cv.style.height), TOTAL = Object.keys(N).length;
  view.classList.add('gjs');

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function semText(id) { return N[id][1] + ' сем.'; }

  // ---------- масштаб и перемещение ----------
  var T = { s: 1, x: 0, y: 0 }, ready = false;
  function fitS() { return Math.min(view.clientWidth / W, view.clientHeight / H); }
  function minS() { return Math.min(fitS(), 0.35); }
  function clampT() {
    var vw = view.clientWidth, vh = view.clientHeight, w = W * T.s, h = H * T.s;
    T.x = w <= vw ? (vw - w) / 2 : Math.min(40, Math.max(vw - w - 40, T.x));
    T.y = h <= vh ? (vh - h) / 2 : Math.min(40, Math.max(vh - h - 40, T.y));
  }
  var moveT;
  function apply(anim) {
    clampT();
    if (anim && !RM) { cv.classList.add('gmove'); clearTimeout(moveT); moveT = setTimeout(function () { cv.classList.remove('gmove'); }, 320); }
    cv.style.transform = 'translate(' + T.x.toFixed(1) + 'px,' + T.y.toFixed(1) + 'px) scale(' + T.s.toFixed(4) + ')';
    view.classList.toggle('gsmall', T.s < 0.62);       // мелкий масштаб: вторая строка узла скрыта, остаются названия
  }
  function zoomAt(f, px, py, anim) {
    view.classList.add('gused');
    var ns = Math.max(minS(), Math.min(1.6, T.s * f));
    T.x = px - (px - T.x) * (ns / T.s); T.y = py - (py - T.y) * (ns / T.s); T.s = ns; apply(anim);
  }
  function fit(anim) { T.s = fitS(); apply(anim); }
  function init() {                                      // первый показ: читаемый масштаб, начало плана слева сверху
    if (ready || !view.clientWidth) return;
    ready = true; T.s = Math.min(1, Math.max(fitS(), 0.86)); T.x = 0; T.y = 0; apply(false);
  }
  function inView(a) {
    var x = T.x + a.offsetLeft * T.s, y = T.y + a.offsetTop * T.s;
    return x > 8 && y > 8 && x + a.offsetWidth * T.s < view.clientWidth - 8 && y + a.offsetHeight * T.s < view.clientHeight - 8;
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
    if ((e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('.gzoom')) return;
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
    else if (k === 'Escape' && sel) clear();
    else if (e.target === view && /^Arrow/.test(k)) { T.x += k === 'ArrowLeft' ? 80 : k === 'ArrowRight' ? -80 : 0; T.y += k === 'ArrowUp' ? 80 : k === 'ArrowDown' ? -80 : 0; apply(true); }
    else return;
    e.preventDefault();
  });
  view.addEventListener('focusin', function (e) { var a = e.target.closest && e.target.closest('.gn'); if (a && !moved) panTo(a.dataset.id); });

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
    upL.sort(function (a, b) { return (a[2] !== 'need') - (b[2] !== 'need') || byPlan(a[0], b[0]); }); dnL.sort(function (a, b) { return byPlan(a[1], b[1]); });
    D.j.forEach(function (j, i) { if (j[2].indexOf(s) >= 0) js.push(i); });
    upL.forEach(function (e) { roles[e[0]] = e[2] === 'need' ? 'need' : 'help'; });
    dnL.forEach(function (e) { roles[e[1]] = 'down'; });
    js.forEach(function (i) { roles['job-' + i] = 'job'; });
    roles[s] = 'self'; sel = { k: 'n', id: s };
    paint(roles, function (p) { return p._f === s || p._t === s; });
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
    f.appendChild(acts([['Открыть страницу предмета', 'd/' + s + '.html', 'btn-s'], ['Маршрут на пути студента', 'path.html#route=' + s, 'btn-o']]));
    f.appendChild(el('p', 'muted gtip', 'Повторное нажатие на выбранный узел тоже открывает страницу предмета.'));
    show(f); pick.value = s; jobSel.value = ''; setHash('node=' + s); after(opt);
    say('Выбран предмет «' + n[0] + '»: опирается на ' + upL.length + ', ведёт к ' + dnL.length + (js.length ? ', ключевой для профессий: ' + js.length : '') + '.');
  }
  function selectJob(i, opt) {
    var j = D.j[i]; if (!j) return;
    var roles = {}, set = {}; j[3].forEach(function (s) { roles[s] = 'need'; set[s] = 1; }); j[2].forEach(function (s) { roles[s] = 'key'; set[s] = 1; });
    roles['job-' + i] = 'self'; sel = { k: 'j', id: 'job-' + i };
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
    show(f); if (TM && TM.jobButtons) TM.jobButtons(); pick.value = ''; jobSel.value = String(i); setHash('job=' + i); after(opt);
    say('Путь к профессии «' + j[0] + '»: ключевых предметов ' + j[2].length + ', нужных для них ' + j[3].length + '.');
  }
  function after(opt) {
    opt = opt || {}; filt();
    if (opt.pan) panTo(sel.id, opt.anim);
    if (opt.focus) { var h = gp.querySelector('.gh3'); if (h) h.focus({ preventScroll: true }); }
    if (opt.reveal && NARROW.matches) side.scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' });
  }
  function selectId(id, opt) { if (/^job-/.test(id)) selectJob(+id.slice(4), opt); else selectNode(id, opt); }
  function clear() {
    sel = null; cv.classList.remove('gsel', 'tm-gsel');
    Object.keys(nodes).forEach(function (id) { nodes[id].classList.remove.apply(nodes[id].classList, ROLES); });
    edges.forEach(function (p) { p.classList.remove('on'); });
    idle(); pick.value = ''; jobSel.value = ''; setHash(mine ? 'mine' : ''); filt(); say('Выбор снят.');
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
    mine = on; mineB.setAttribute('aria-pressed', on ? 'true' : 'false'); paintMine();
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
    filt(); var f0 = document.querySelector('[data-gf]'); if (f0) f0.focus();
  });

  // ---------- телефон: по умолчанию панель и список, вся карта — по кнопке ----------
  function setFull(on) {
    main.classList.toggle('gopen', on); full.setAttribute('aria-expanded', on ? 'true' : 'false');
    full.textContent = on ? 'Скрыть карту' : 'Показать всю карту';
    if (on) { init(); apply(false); if (sel) panTo(sel.id, false); }
  }
  full.addEventListener('click', function () { setFull(!main.classList.contains('gopen')); if (main.classList.contains('gopen')) main.scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' }); });
  if (NARROW.matches) { var det = document.querySelector('.gfil'); if (det) det.open = false; }
  var rsT;
  window.addEventListener('resize', function () { clearTimeout(rsT); rsT = setTimeout(function () { if (!ready) init(); else if (view.clientWidth) apply(false); }, 120); });

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
  fromHash(true);
})();
