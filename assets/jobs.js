// Карта профессий: сравнение двух профессий. Данные (ключевые предметы, нужные для них, коды компетенций)
// встроены в страницу при сборке (#cmpd) — те же, что в маршрутах на этой странице.
// Адрес: #compare=A,B (номера профессий по порядку); ссылку можно отправить.
(function () {
  'use strict';
  // ---------- экран выбора: слева список профессий, справа выбранная (как в игровом меню) ----------
  // Экраны — статьи профессий (#job-N), сравнение (#compare, #compare=A,B) и «На чём основана карта» (#basis).
  // Без скрипта все экраны идут подряд; до запуска скрипта CSS показывает экран из адреса (:target) или первый.
  (function () {
    var list = document.getElementById('jlist'), main = document.getElementById('jmain'); if (!list || !main) return;
    var root = document.documentElement, RMs = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('tm-still');
    var scr = [].filter.call(main.children, function (x) { return !!x.id; }), links = [].slice.call(list.querySelectorAll('.jli')), cur = null;
    function idOf(h) { var m = /^#(job-\d+|compare|basis)\b/.exec(h || ''); var id = m ? m[1] : ''; return document.getElementById(id) && main.contains(document.getElementById(id)) ? id : scr[0].id; }
    function show(id, user) {
      if (id === cur) return; cur = id;
      scr.forEach(function (x) { x.hidden = x.id !== id; });
      links.forEach(function (a) { if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      var el = document.getElementById(id);
      if (user) {
        if (!RMs) { el.classList.remove('tm-scr'); void el.offsetWidth; el.classList.add('tm-scr'); }
        var h = el.querySelector('h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
        var r = main.getBoundingClientRect(); if (r.top < 0) main.scrollIntoView({ block: 'start', behavior: RMs ? 'auto' : 'smooth' });
      }
    }
    root.classList.add('jscreens');
    list.addEventListener('click', function (e) {
      var a = e.target.closest('.jli'); if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault(); var id = a.getAttribute('href').slice(1);
      try { history.replaceState(history.state, '', location.pathname + location.search + '#' + id); } catch (x) {}
      show(id, true);
    });
    list.addEventListener('keydown', function (e) {                // ↑ / ↓ — по списку, как курсор в меню
      var i = links.indexOf(document.activeElement); if (i < 0 || !/^(ArrowUp|ArrowDown|Home|End)$/.test(e.key)) return;
      var j = e.key === 'Home' ? 0 : e.key === 'End' ? links.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      e.preventDefault(); links[j].focus();
    });
    show(idOf(location.hash), false);
    window.addEventListener('hashchange', function () { show(idOf(location.hash), true); });
  })();

  var box = document.getElementById('cmpout'), dEl = document.getElementById('cmpd'), sa = document.getElementById('cmpa'), sb = document.getElementById('cmpb');
  if (!box || !dEl || !sa || !sb) return;
  var D; try { D = JSON.parse(dEl.textContent); } catch (e) { return; }
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('tm-still');
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function diff(a, b) { return a.filter(function (x) { return b.indexOf(x) < 0; }); }
  function both(a, b) { return a.filter(function (x) { return b.indexOf(x) >= 0; }); }
  function subj(list, J) {                                   // предметы: ключевые для профессии выделены
    var w = el('div', 'ks');
    if (!list.length) { w.appendChild(el('span', 'muted', 'нет')); return w; }
    list.forEach(function (s) {
      var key = J.some(function (j) { return j.k.indexOf(s) >= 0; });
      var a = el('a', 'kchip' + (key ? ' cmpkey' : ''), D.n[s][0]); a.href = 'd/' + s + '.html'; a.title = D.n[s][1] + ' сем.' + (key ? ' · ключевой' : ' · нужен для ключевых');
      if (key) a.appendChild(el('span', 'vh', ' — ключевой'));
      w.appendChild(a);
    });
    return w;
  }
  function codes(list) {
    var w = el('div', 'ks');
    if (!list.length) { w.appendChild(el('span', 'muted', 'нет')); return w; }
    list.forEach(function (c) { w.appendChild(el('span', 'kchip ccode', c)); }); return w;
  }
  function col(title, cls, parts) {
    var c = el('div', 'cmpcol ' + cls); c.appendChild(el('h3', 'cmph', title));
    parts.forEach(function (p) { c.appendChild(el('p', 'lkh', p[0])); c.appendChild(p[1]); }); return c;
  }
  function draw(fromUser) {
    var a = +sa.value, b = +sb.value, A = D.j[a], B = D.j[b];
    box.textContent = '';
    if (!A || !B) return;
    if (a === b) { box.appendChild(el('p', 'muted', 'Выбери две разные профессии.')); return; }
    var ra = A.k.concat(A.a), rb = B.k.concat(B.a), order = Object.keys(D.n);
    var sort = function (l) { return l.sort(function (x, y) { return order.indexOf(x) - order.indexOf(y); }); };
    var common = sort(both(ra, rb)), onlyA = sort(diff(ra, rb)), onlyB = sort(diff(rb, ra)), ck = both(A.k, B.k);
    var sum = el('p', 'cmpsum');
    sum.textContent = 'Общих предметов в маршрутах: ' + common.length + ' (из них ключевых для обеих профессий: ' + ck.length + '). '
      + 'Только у первой: ' + onlyA.length + ', только у второй: ' + onlyB.length + '. Общих кодов компетенций: ' + both(A.c, B.c).length + '.';
    box.appendChild(sum);
    // маршруты рядом по семестрам: общий предмет отмечен словом «общий», ключевой — жирным (и подписью для чтения с экрана)
    var tb = el('div', 'cmpsem'); tb.setAttribute('role', 'table'); tb.setAttribute('aria-label', 'Маршруты по семестрам рядом');
    var hr = el('div', 'cmprow cmphead'); hr.setAttribute('role', 'row'); ['Семестр', A.t, B.t].forEach(function (t) { var c = el('b', '', t); c.setAttribute('role', 'columnheader'); hr.appendChild(c); }); tb.appendChild(hr);
    var st0 = function (x) { var m = /\d/.exec(D.n[x][1]); return m ? +m[0] : 0; };
    for (var sm = 1; sm <= 8; sm++) {
      var la = ra.filter(function (x) { return st0(x) === sm; }), lb = rb.filter(function (x) { return st0(x) === sm; });
      if (!la.length && !lb.length) continue;
      var row = el('div', 'cmprow'); row.setAttribute('role', 'row'); var h = el('b', 'cmpsn', sm + ' сем.'); h.setAttribute('role', 'rowheader'); row.appendChild(h);
      [[la, A, rb], [lb, B, ra]].forEach(function (cx) {
        var cell = el('div', 'cmpcell'); cell.setAttribute('role', 'cell');
        cx[0].forEach(function (x) {
          var key = cx[1].k.indexOf(x) >= 0, shared = cx[2].indexOf(x) >= 0, a = el('a', 'cmpsub' + (key ? ' key' : '') + (shared ? ' same' : ''), D.n[x][0]); a.href = 'd/' + x + '.html';
          if (key || shared) a.appendChild(el('span', 'cmpt', (key ? ' · ключевой' : '') + (shared ? ' · общий' : '')));
          cell.appendChild(a);
        });
        if (!cx[0].length) cell.appendChild(el('span', 'muted', '—'));
        row.appendChild(cell);
      });
      tb.appendChild(row);
    }
    box.appendChild(tb);
    var g = el('div', 'cmpgrid');
    g.appendChild(col('Только «' + A.t + '»', 'cmpa', [['Предметы', subj(onlyA, [A])], ['Компетенции', codes(diff(A.c, B.c))]]));
    g.appendChild(col('Общее', 'cmpboth', [['Предметы', subj(common, [A, B])], ['Компетенции', codes(both(A.c, B.c))]]));
    g.appendChild(col('Только «' + B.t + '»', 'cmpb', [['Предметы', subj(onlyB, [B])], ['Компетенции', codes(diff(B.c, A.c))]]));
    box.appendChild(g);
    var leg = el('p', 'muted cmpleg'); leg.appendChild(el('span', 'kchip cmpkey sample', 'ключевой')); leg.appendChild(document.createTextNode(' ключевой предмет профессии (в колонке «Общее» — хотя бы для одной из двух), без выделения — нужен для ключевых.'));
    box.appendChild(leg);
    var acts = el('p', 'hlinks2');
    [[A, a], [B, b]].forEach(function (x) { var l = el('a', 'btn-o', x[0].t + ' на карте связей'); l.href = 'map.html#job=' + x[1]; acts.appendChild(l); });
    box.appendChild(acts);
    if (!RM) { box.classList.remove('tm-cmp'); void box.offsetWidth; box.classList.add('tm-cmp'); }
    if (fromUser) try { history.replaceState(history.state, '', location.pathname + location.search + '#compare=' + a + ',' + b); } catch (e) {}
  }
  function fromHash() {
    var m = location.hash.match(/^#compare=(\d+),(\d+)$/);
    if (m && D.j[+m[1]] && D.j[+m[2]]) { sa.value = m[1]; sb.value = m[2]; draw(false); return true; }
    return false;
  }
  sa.addEventListener('change', function () { draw(true); });
  sb.addEventListener('change', function () { draw(true); });
  window.addEventListener('hashchange', function () { if (fromHash()) document.getElementById('compare').scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' }); });
  if (fromHash()) { var c = document.getElementById('compare'); if (c) setTimeout(function () { c.scrollIntoView({ block: 'start' }); }, 0); }
  else draw(false);
})();
