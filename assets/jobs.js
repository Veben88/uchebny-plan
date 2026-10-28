// Карта профессий: сравнение двух профессий. Данные (ключевые предметы, нужные для них, коды компетенций)
// встроены в страницу при сборке (#cmpd) — те же, что в маршрутах на этой странице.
// Адрес: #compare=A,B (номера профессий по порядку); ссылку можно отправить.
(function () {
  'use strict';
  var box = document.getElementById('cmpout'), dEl = document.getElementById('cmpd'), sa = document.getElementById('cmpa'), sb = document.getElementById('cmpb');
  if (!box || !dEl || !sa || !sb) return;
  var D; try { D = JSON.parse(dEl.textContent); } catch (e) { return; }
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
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
