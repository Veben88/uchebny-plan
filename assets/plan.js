// План таблицей (plan.html): кнопка печати и сравнение двух дисциплин.
// Данные сравнения встроены при сборке (#pcd): нагрузка из плана, связи, профессии, коды компетенций.
// Адрес: #cmp=код1,код2 (slug дисциплин); ссылку можно отправить.
(function () {
  'use strict';
  [].forEach.call(document.querySelectorAll('[data-print]'), function (b) { b.hidden = false; b.addEventListener('click', function () { window.print(); }); });
  var box = document.getElementById('pcout'), dEl = document.getElementById('pcd'), sa = document.getElementById('pca'), sb = document.getElementById('pcb');
  if (!box || !dEl || !sa || !sb) return;
  var D; try { D = JSON.parse(dEl.textContent); } catch (e) { return; }
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('tm-still');
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function links(list) {
    var w = el('div', 'ks');
    if (!list.length) { w.appendChild(el('span', 'muted', 'не отмечено')); return w; }
    list.forEach(function (x) { var a = el('a', 'kchip' + (x[1] === 'need' ? ' need' : ''), (D[x[0]] ? D[x[0]].n : x[0]) + (x[1] === 'need' ? ' · нужен' : '')); a.href = 'd/' + x[0] + '.html'; w.appendChild(a); });
    return w;
  }
  function chips(list, mark) {
    var w = el('div', 'ks');
    if (!list.length) { w.appendChild(el('span', 'muted', 'нет')); return w; }
    list.forEach(function (c) { var k = el('span', 'kchip ccode' + (mark && mark.indexOf(c) >= 0 ? ' pcsame' : ''), c); if (mark && mark.indexOf(c) >= 0) k.appendChild(el('span', 'vh', ' — общая')); w.appendChild(k); });
    return w;
  }
  function both(a, b) { return a.filter(function (x) { return b.indexOf(x) >= 0; }); }
  function draw(fromUser) {
    var a = sa.value, b = sb.value, A = D[a], B = D[b];
    box.textContent = '';
    if (!A || !B) return;
    if (a === b) { box.appendChild(el('p', 'muted', 'Выбери две разные дисциплины.')); return; }
    var t = el('table', 'pctab'), cap = el('caption', 'vh', 'Сравнение дисциплин'), th = el('thead'), hr = el('tr');
    t.appendChild(cap); hr.appendChild(el('th', '', 'Показатель'));
    [[A, a], [B, b]].forEach(function (x) { var h = el('th'); h.scope = 'col'; var l = el('a', '', x[0].n); l.href = 'd/' + x[1] + '.html'; h.appendChild(l); hr.appendChild(h); });
    th.appendChild(hr); t.appendChild(th);
    var tb = el('tbody');
    var num = function (v) { return v == null || v === '' ? '—' : String(v); };
    var cc = both(A.cp, B.cp), jj = both(A.j, B.j);
    [['Что это', function (x) { return x.w || 'Описание готовится.'; }],
     ['Раздел плана', function (x) { return x.g; }], ['Семестры', function (x) { return x.s; }],
     ['Зачётные единицы', function (x) { return num(x.ze); }], ['Часы всего', function (x) { return num(x.h); }],
     ['Контактные часы', function (x) { return num(x.c); }], ['Лекции / лабораторные / практика', function (x) { return x.l + ' / ' + x.b + ' / ' + x.p; }],
     ['Формы контроля', function (x) { return x.k || '—'; }],
     ['Опирается на', function (x) { return links(x.up); }], ['Пригодится для', function (x) { return links(x.dn); }],
     ['Ключевой для профессий', function (x) { return chips(x.j, jj); }],
     ['Компетенции по рабочей программе', function (x) { return chips(x.cp, cc); }]].forEach(function (r) {
      var tr = el('tr'), h = el('th', '', r[0]); h.scope = 'row'; tr.appendChild(h);
      [A, B].forEach(function (x) { var td = el('td'), v = r[1](x); if (typeof v === 'string') td.textContent = v; else td.appendChild(v); tr.appendChild(td); });
      tb.appendChild(tr);
    });
    t.appendChild(tb); var wrap = el('div', 'ptable'); wrap.appendChild(t); box.appendChild(wrap);
    var sum = el('p', 'muted pcsum', 'Общих компетенций: ' + cc.length + (jj.length ? ', общих профессий: ' + jj.length : '') + '. Общие выделены.');
    box.appendChild(sum);
    if (!RM) { box.classList.remove('tm-cmp'); void box.offsetWidth; box.classList.add('tm-cmp'); }
    if (fromUser) try { history.replaceState(history.state, '', location.pathname + location.search + '#cmp=' + a + ',' + b); } catch (e) {}
  }
  function fromHash() {
    var m = location.hash.match(/^#cmp=([\w-]+),([\w-]+)$/);
    if (m && D[m[1]] && D[m[2]]) { sa.value = m[1]; sb.value = m[2]; draw(false); return true; }
    return false;
  }
  sa.addEventListener('change', function () { draw(true); });
  sb.addEventListener('change', function () { draw(true); });
  window.addEventListener('hashchange', function () { if (fromHash()) document.getElementById('cmp').scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' }); });
  if (fromHash()) setTimeout(function () { document.getElementById('cmp').scrollIntoView({ block: 'start' }); }, 0);
  else draw(false);
})();
