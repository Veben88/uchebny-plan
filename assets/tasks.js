// Мини-задания «Попробуй сам»: без оценок и правильных ответов, только наглядный результат действий.
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', T = {};
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function s(tag, attrs, text) { var e = document.createElementNS(NS, tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
  function svg(w, hgt, label) { var e = s('svg', { viewBox: '0 0 ' + w + ' ' + hgt, role: 'img', 'aria-label': label || '', 'class': 'tksvg' }); return e; }
  function btn(label, fn, cls) { var b = h('button', 'tkb' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', fn); return b; }
  function group(btns, label) { var g = h('div', 'tkrow'); g.setAttribute('role', 'group'); if (label) g.setAttribute('aria-label', label); btns.forEach(function (b) { g.appendChild(b); }); return g; }
  function pressOnly(btns, on) { btns.forEach(function (b) { b.setAttribute('aria-pressed', b === on ? 'true' : 'false'); }); }
  function msg(root) { var m = h('p', 'tkmsg'); m.setAttribute('aria-live', 'polite'); root.appendChild(m); return m; }
  function f(v, d) { return v.toFixed(d == null ? 2 : d).replace('.', ','); }
  var C = { green: '#9cc23a', blue: '#4c8ddb', navy: '#3b4f86', grey: '#c9cde0', red: '#d9534f', ink: '#2e3350' };

  // 1. Метрология: годна ли деталь?
  T['b1-o-19-01-04'] = function (root) {
    var lo = 49.90, hi = 50.12, tol = [49.95, 50.05], rd = 50.06, W = 560, H = 120;
    var inst = [{ n: 'Линейка', u: 0.5, d: 'деления по 1 мм' }, { n: 'Штангенциркуль', u: 0.02, d: 'сотые доли мм' }, { n: 'Микрометр', u: 0.004, d: 'тысячные доли мм' }];
    var el = svg(W, H, 'Шкала размера с зоной допуска и полосой возможной ошибки прибора'); root.appendChild(el);
    function X(v) { return 24 + (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * (W - 48); }
    var m = msg(root), btns = [];
    function draw(sel) {
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(s('line', { x1: 24, y1: 80, x2: W - 24, y2: 80, stroke: C.ink, 'stroke-width': 2 }));
      el.appendChild(s('rect', { x: X(tol[0]), y: 50, width: X(tol[1]) - X(tol[0]), height: 30, fill: C.green, opacity: .55 }));
      el.appendChild(s('text', { x: (X(tol[0]) + X(tol[1])) / 2, y: 44, 'text-anchor': 'middle', 'font-size': 12, fill: C.ink }, 'допуск 49,95 – 50,05'));
      el.appendChild(s('line', { x1: X(rd), y1: 40, x2: X(rd), y2: 92, stroke: C.red, 'stroke-width': 3 }));
      el.appendChild(s('text', { x: X(rd) + 6, y: 104, 'font-size': 12, fill: C.red, 'font-weight': 700 }, 'прибор показал 50,06'));
      if (sel) {
        var a = Math.max(lo, rd - sel.u), b = Math.min(hi, rd + sel.u);
        el.appendChild(s('rect', { x: X(a), y: 58, width: Math.max(3, X(b) - X(a)), height: 14, rx: 7, fill: C.blue, opacity: .85 }));
        el.appendChild(s('text', { x: 24, y: 20, 'font-size': 12, fill: C.blue, 'font-weight': 700 }, 'синяя полоса: где на самом деле может быть размер'));
      }
    }
    draw(null); m.textContent = 'Деталь должна быть 50,00 мм, допустимо отклонение 0,05 мм в любую сторону. Прибор показал 50,06 мм. Выбери прибор, которым измеряли.';
    inst.forEach(function (i) {
      var b = btn(i.n + ' (' + i.d + ')', function () {
        pressOnly(btns, b); draw(i); var min = rd - i.u, max = rd + i.u;
        m.textContent = min > tol[1] ? 'Теперь всё ясно: даже с учётом ошибки прибора размер больше допуска. Деталь бракованная.'
          : max < tol[0] ? 'Деталь годная.' : 'Решить нельзя: синяя полоса задевает зелёную зону. Деталь может оказаться и годной, и бракованной. Нужен прибор поточнее.';
      }); btns.push(b);
    });
    root.insertBefore(group(btns, 'Выбор прибора'), m);
  };

  // 2. Взаимозаменяемость: вал и отверстие
  T['b1-o-19-01-09'] = function (root) {
    var Dmin = 20.000, Dmax = 21e-3 + 20.000, W = 560, H = 190, K = 450;
    var el = svg(W, H, 'Вал в отверстии'); root.appendChild(el);
    var inp = h('input'); inp.type = 'range'; inp.min = 19.940; inp.max = 20.040; inp.step = 0.001; inp.value = 20.030; inp.setAttribute('aria-label', 'Диаметр вала, мм'); inp.className = 'tkrange';
    var lab = h('p', 'tkread'), m = msg(root);
    root.insertBefore(inp, m); root.insertBefore(lab, inp);
    function draw() {
      var d = parseFloat(inp.value), r0 = 62, rh = r0, rs = r0 + (d - 20.010) * K; while (el.firstChild) el.removeChild(el.firstChild);
      var cx = W / 2, cy = 95; el.appendChild(s('circle', { cx: cx, cy: cy, r: rh + 10, fill: C.grey })); el.appendChild(s('circle', { cx: cx, cy: cy, r: rh, fill: '#fff', stroke: C.navy, 'stroke-width': 2 }));
      var over = rs > rh; el.appendChild(s('circle', { cx: cx, cy: cy, r: Math.max(8, rs), fill: over ? C.red : C.blue, opacity: .8 }));
      el.appendChild(s('text', { x: 14, y: 22, 'font-size': 12, fill: C.ink }, 'разница в размерах на картинке увеличена'));
      var gmin = Dmin - d, gmax = Dmax - d, st;
      if (d >= Dmax) st = 'Не войдёт: вал больше отверстия.';
      else if (d >= Dmin) st = 'Войдёт только с усилием: детали будут сидеть плотно.';
      else if (d >= 19.980) st = 'Войдёт, но зазор очень мал: вращается туго.';
      else if (d >= 19.959) st = 'Вращается плавно: так и задумано. Это зелёная зона посадки.';
      else st = 'Болтается: люфт слишком большой.';
      lab.textContent = 'Диаметр вала: ' + f(d, 3) + ' мм. Зазор между валом и отверстием: ' + (gmax > 0 ? 'от ' + f(Math.max(0, gmin), 3) + ' до ' + f(gmax, 3) + ' мм' : 'нет, вал больше');
      m.textContent = st; inp.style.setProperty('--ok', ((19.959 - 19.940) / 0.1 * 100) + '%'); inp.setAttribute('aria-valuetext', f(d, 3) + ' мм. ' + st);
    }
    inp.addEventListener('input', draw); draw();
  };

  // 3. Парето: что исправить первым
  T['b1-o-19-03'] = function (root) {
    var D = [['Царапины', 52], ['Вмятины', 28], ['Трещины', 11], ['Прочие', 9]], on = {}, btns = [], bars = h('div', 'tkbars'), m = msg(root);
    D.forEach(function (d, i) {
      var b = btn('', function () { on[i] = !on[i]; upd(); }), bar = h('span', 'tkbar'), fill = h('i'); fill.style.width = d[1] + '%'; bar.appendChild(fill);
      b.appendChild(h('span', 'tkn', d[0])); b.appendChild(bar); b.appendChild(h('span', 'tkv', d[1])); b.className = 'tkb tkbarbtn'; btns.push(b); bars.appendChild(b);
    });
    var tot = h('div', 'tkprog'), pf = h('i'); tot.appendChild(pf); var cap = h('p', 'tkread');
    root.insertBefore(bars, m); root.insertBefore(cap, m); root.insertBefore(tot, m);
    var reset = btn('Сбросить', function () { on = {}; upd(); }, 'tkghost'); root.appendChild(reset);
    function upd() {
      var removed = 0, n = 0; D.forEach(function (d, i) { btns[i].setAttribute('aria-pressed', on[i] ? 'true' : 'false'); if (on[i]) { removed += d[1]; n++; } });
      pf.style.width = removed + '%'; cap.textContent = 'Исправлено видов дефектов: ' + n + '. Убрано брака: ' + removed + ' из 100 (' + removed + '%).';
      m.textContent = !n ? 'За неделю на участке нашли 100 дефектов. Нажимай на виды дефектов, которые ты исправишь, и смотри, сколько брака исчезнет.'
        : removed >= 80 && n <= 2 ? 'Всего два вида дефектов дали ' + removed + '% брака. Так часто бывает: небольшая часть причин создаёт почти всю проблему.'
        : removed >= 80 ? 'Брака стало намного меньше. Попробуй сбросить и убрать как можно меньше видов дефектов.' : 'Хороший шаг. Что ещё можно исправить?';
    }
    upd();
  };

  // 4. Стандартизация: что значит M10x1,5 и какая гайка подойдёт
  T['b1-o-19-01-06'] = function (root) {
    var parts = [['M', 'M: метрическая резьба. Такой профиль витков одинаков во всех странах, где применяют метрическую систему.'], ['10', '10: наружный диаметр болта 10 мм.'], ['×1,5', '×1,5: шаг резьбы, то есть расстояние между витками 1,5 мм.']], pb = [], W = 560, H = 120;
    var el = svg(W, H, 'Болт и гайка'); root.appendChild(el);
    var m = msg(root), nutSel = null;
    function draw(hi) {
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(s('rect', { x: 20, y: 38, width: 40, height: 44, fill: C.navy })); el.appendChild(s('rect', { x: 60, y: 46, width: 300, height: 28, fill: C.grey }));
      for (var x = 70; x < 360; x += 15) el.appendChild(s('line', { x1: x, y1: 46, x2: x + 8, y2: 74, stroke: C.navy, 'stroke-width': 2 }));
      if (hi === 1) { el.appendChild(s('line', { x1: 380, y1: 46, x2: 380, y2: 74, stroke: C.red, 'stroke-width': 2 })); el.appendChild(s('text', { x: 388, y: 64, 'font-size': 13, fill: C.red, 'font-weight': 700 }, '10 мм')); }
      if (hi === 2) { el.appendChild(s('line', { x1: 100, y1: 92, x2: 115, y2: 92, stroke: C.red, 'stroke-width': 3 })); el.appendChild(s('text', { x: 124, y: 97, 'font-size': 13, fill: C.red, 'font-weight': 700 }, 'шаг 1,5 мм')); }
      if (hi === 0) el.appendChild(s('text', { x: 70, y: 28, 'font-size': 13, fill: C.red, 'font-weight': 700 }, 'метрическая резьба'));
      if (nutSel) { var ok = nutSel === 'M10×1,5', sz = nutSel.indexOf('M8') === 0 ? 20 : nutSel.indexOf('M12') === 0 ? 40 : 32; el.appendChild(s('rect', { x: ok ? 280 : 410, y: 60 - sz / 2, width: 30, height: sz, rx: 3, fill: ok ? C.green : C.red, opacity: .85 })); el.appendChild(s('text', { x: ok ? 284 : 414, y: 64, 'font-size': 10, fill: '#fff', 'font-weight': 700 }, nutSel.slice(0, 3))); }
    }
    draw(-1); m.textContent = 'На болте написано M10×1,5. Нажимай на части обозначения, потом подбери гайку.';
    parts.forEach(function (p, i) { var b = btn(p[0], function () { pressOnly(pb, b); draw(i); nutSel = null; m.textContent = p[1]; }, 'tkbig'); pb.push(b); });
    root.insertBefore(group(pb, 'Части обозначения'), m);
    var nb = [], nuts = ['M8×1,25', 'M10×1,5', 'M12×1,75'];
    nuts.forEach(function (n) {
      var b = btn('Гайка ' + n, function () { pressOnly(nb, b); nutSel = n; draw(-1);
        m.textContent = n === 'M10×1,5' ? 'Накрутилась: диаметр и шаг совпали. Такую гайку можно купить в любой мастерской, и она подойдёт. Это и есть смысл стандарта.'
          : n === 'M8×1,25' ? 'Не накручивается: гайка меньше болта (диаметр 8, а не 10).' : 'Болтается: гайка больше болта (диаметр 12, а не 10).'; }); nb.push(b); });
    root.insertBefore(group(nb, 'Выбор гайки'), m);
  };

  // 5. Сертификация: кто решает
  T['b1-o-19-01-07'] = function (root) {
    var ways = { 'Декларация': { who: 'Решает сам изготовитель', st: ['Изготовитель собирает доказательства (например, результаты испытаний)', 'Сам принимает декларацию о соответствии', 'Ставит маркировку и отвечает за свои слова'] },
                 'Сертификат': { who: 'Решает независимый орган по сертификации', st: ['Изготовитель подаёт заявку в орган по сертификации', 'Орган проверяет продукцию и документы, проводит испытания', 'Орган сам решает, выдавать сертификат или нет'] } }, bt = [], flow = h('ol', 'tkflow'), badge = h('p', 'tkbadge'), m = msg(root);
    Object.keys(ways).forEach(function (k) { var b = btn(k, function () { pressOnly(bt, b); flow.textContent = ''; ways[k].st.forEach(function (x) { flow.appendChild(h('li', '', x)); }); badge.textContent = ways[k].who; }, 'tkbig'); bt.push(b); });
    root.insertBefore(group(bt, 'Способ подтверждения'), m); root.insertBefore(badge, m); root.insertBefore(flow, m);
    var rng = h('input'); rng.type = 'range'; rng.min = 1; rng.max = 3; rng.step = 1; rng.value = 1; rng.className = 'tkrange'; rng.setAttribute('aria-label', 'Насколько продукция опасна для людей');
    var lab = h('p', 'tkread'); root.insertBefore(lab, m); root.insertBefore(rng, m);
    var L = ['Карандаш: риск для людей низкий. Часто достаточно, чтобы изготовитель сам показал доказательства.', 'Детская игрушка: риск выше, поэтому требования и проверки строже.', 'Детское автокресло: от продукции зависит жизнь. Чем выше риск, тем чаще нужна независимая проверка.'];
    function up() { var v = +rng.value; lab.textContent = 'Подвинь ползунок: что за продукция? ' + L[v - 1]; }
    rng.addEventListener('input', up); up(); m.textContent = 'Это общий принцип. Что именно требуется для конкретной продукции, определяют законы и технические регламенты.';
  };

  // 6. Вольтметр: двигай стрелку
  T['b1-o-19-05'] = function (root) {
    var W = 560, H = 200, el = svg(W, H, 'Шкала вольтметра'), needle, rng = h('input'), lab = h('p', 'tkread'), bar = h('div', 'tkprog'), bf = h('i'); bar.appendChild(bf); root.appendChild(el);
    var cx = 280, cy = 170, R = 130; el.appendChild(s('path', { d: 'M ' + (cx - R) + ' ' + cy + ' A ' + R + ' ' + R + ' 0 0 1 ' + (cx + R) + ' ' + cy, fill: 'none', stroke: C.grey, 'stroke-width': 10 }));
    for (var v = 0; v <= 100; v += 10) { var a = Math.PI * (1 - v / 100), x1 = cx + (R - 6) * Math.cos(a), y1 = cy - (R - 6) * Math.sin(a), x2 = cx + (R + 12) * Math.cos(a), y2 = cy - (R + 12) * Math.sin(a); el.appendChild(s('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: C.ink, 'stroke-width': 2 })); el.appendChild(s('text', { x: cx + (R + 28) * Math.cos(a), y: cy - (R + 28) * Math.sin(a) + 4, 'text-anchor': 'middle', 'font-size': 11, fill: C.ink }, String(v))); }
    needle = s('line', { x1: cx, y1: cy, x2: cx - R, y2: cy, stroke: C.red, 'stroke-width': 3, 'stroke-linecap': 'round' }); el.appendChild(needle); el.appendChild(s('circle', { cx: cx, cy: cy, r: 7, fill: C.ink }));
    rng.type = 'range'; rng.min = 1; rng.max = 100; rng.step = 1; rng.value = 10; rng.className = 'tkrange'; rng.setAttribute('aria-label', 'Положение стрелки, вольт');
    var m = msg(root); root.insertBefore(lab, m); root.insertBefore(rng, m); root.insertBefore(bar, m);
    function up() { var x = +rng.value, a = Math.PI * (1 - x / 100); needle.setAttribute('x2', cx + R * Math.cos(a)); needle.setAttribute('y2', cy - R * Math.sin(a));
      var rel = 1 / x * 100; bf.style.width = Math.min(100, rel * 4) + '%';
      lab.textContent = 'Стрелка показывает ' + x + ' В. Прибор может ошибаться на 1 В, значит настоящее значение от ' + (x - 1) + ' до ' + (x + 1) + ' В. Ошибка составляет ' + f(rel, rel < 10 ? 1 : 0) + '% от показания.';
      m.textContent = rel >= 10 ? 'Ошибка огромна: прибор тут почти не помогает.' : rel >= 3 ? 'Ошибка заметная.' : 'Ошибка маленькая: можно доверять.'; rng.setAttribute('aria-valuetext', x + ' вольт, ошибка ' + f(rel, 1) + ' процента'); }
    rng.addEventListener('input', up); up();
  };

  // 7. Секундомер: поймай 5 секунд
  T['b1-o-19-06'] = function (root) {
    var t0 = null, res = [], b = btn('Старт', function () {
      if (t0 === null) { t0 = performance.now(); b.textContent = 'Стоп: прошло 5 секунд?'; b.setAttribute('aria-pressed', 'true'); m.textContent = 'Считай про себя. Время на экране не показывается.'; }
      else { var d = (performance.now() - t0) / 1000; t0 = null; res.push(d); b.textContent = 'Ещё попытка'; b.setAttribute('aria-pressed', 'false'); draw(); }
    }, 'tkbig'), W = 560, H = 100, el = svg(W, H, 'Результаты попыток на шкале времени'), m = msg(root), reset = btn('Сбросить', function () { res = []; t0 = null; b.textContent = 'Старт'; b.setAttribute('aria-pressed', 'false'); draw(); }, 'tkghost');
    root.insertBefore(b, m); root.insertBefore(el, m); root.appendChild(reset);
    function X(v) { return 30 + (Math.min(8, Math.max(2, v)) - 2) / 6 * (W - 60); }
    function draw() {
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(s('line', { x1: 30, y1: 55, x2: W - 30, y2: 55, stroke: C.ink, 'stroke-width': 2 })); [2, 3, 4, 5, 6, 7, 8].forEach(function (v) { el.appendChild(s('text', { x: X(v), y: 85, 'text-anchor': 'middle', 'font-size': 12, fill: C.ink }, v + ' с')); });
      el.appendChild(s('line', { x1: X(5), y1: 20, x2: X(5), y2: 62, stroke: C.green, 'stroke-width': 3 })); el.appendChild(s('text', { x: X(5), y: 14, 'text-anchor': 'middle', 'font-size': 12, fill: C.green, 'font-weight': 700 }, 'ровно 5'));
      res.forEach(function (v, i) { el.appendChild(s('circle', { cx: X(v), cy: 48 - (i % 3) * 8, r: 7, fill: C.blue, opacity: .85 })); });
      var n = res.length; if (!n) { m.textContent = 'Нажми «Старт» и остановись, когда, по ощущениям, пройдёт ровно 5 секунд. Попробуй несколько раз.'; return; }
      var mean = res.reduce(function (a, c) { return a + c; }, 0) / n, last = res[n - 1];
      el.appendChild(s('line', { x1: X(mean), y1: 30, x2: X(mean), y2: 62, stroke: C.navy, 'stroke-width': 3, 'stroke-dasharray': '4 3' }));
      var txt = 'Попытка ' + n + ': ' + f(last) + ' с.';
      if (n >= 3) { var mx = Math.max.apply(null, res), mn = Math.min.apply(null, res); txt += ' Среднее: ' + f(mean) + ' с, разброс от ' + f(mn) + ' до ' + f(mx) + ' с (тёмная пунктирная линия: среднее).'; }
      m.textContent = txt + (n >= 3 ? ' Каждый раз немного по-разному: так бывает при любом измерении. Среднее из нескольких попыток надёжнее одной.' : '');
    }
    draw();
  };

  // 8. Подбери инструмент
  T['b1-o-19-01-03'] = function (root) {
    var items = [['Рост человека (около 170 см)', 0], ['Диаметр болта (около 10 мм)', 1], ['Толщина волоса (около 0,05–0,1 мм)', 2]], tools = ['Рулетка', 'Штангенциркуль', 'Микрометр'];
    var R = [['Подойдёт: точности до миллиметра хватает.', 'Не получится: он измеряет только небольшие предметы, до нескольких десятков сантиметров.', 'Не получится: он рассчитан на несколько сантиметров.'],
             ['Получится только примерно: точность около 1 мм для болта грубовата.', 'Хороший выбор: точность до сотых и десятых долей миллиметра.', 'Тоже можно, и даже точнее, но для обычного болта это чаще лишнее.'],
             ['Не получится: деления по 1 мм, а волос в десять и более раз тоньше.', 'Грубовато: измерение будет на пределе точности прибора.', 'Подходит: точность до сотых и тысячных долей миллиметра.']];
    var ib = [], tb = [], sel = -1, m = msg(root);
    items.forEach(function (it, i) { var b = btn(it[0], function () { pressOnly(ib, b); sel = i; tb.forEach(function (x) { x.disabled = false; x.setAttribute('aria-pressed', 'false'); }); m.textContent = 'Теперь выбери, чем будешь измерять.'; }); ib.push(b); });
    tools.forEach(function (t, j) { var b = btn(t, function () { if (sel < 0) return; pressOnly(tb, b); m.textContent = tools[j] + ' и «' + items[sel][0].split(' (')[0].toLowerCase() + '»: ' + R[sel][j]; }, 'tkbig'); b.disabled = true; tb.push(b); });
    root.insertBefore(h('p', 'tkread', '1. Что измеряем?'), m); root.insertBefore(group(ib, 'Что измеряем'), m); root.insertBefore(h('p', 'tkread', '2. Чем измеряем?'), m); root.insertBefore(group(tb, 'Чем измеряем'), m);
    m.textContent = 'Выбери предмет, а потом инструмент, и посмотри, получится ли им измерить.';
  };

  // 9. Обязательно или можно выбрать?
  T['b1-o-19-01-01'] = function (root) {
    var docs = [['Технический регламент', true, 'Обязательно. Технический регламент устанавливает требования, которые обязаны выполнять все.'], ['Национальный стандарт (ГОСТ Р)', false, 'Можно выбрать. Национальные стандарты применяют добровольно.'], ['Стандарт организации', false, 'Можно выбрать. Это правила самой организации, которые она устанавливает для себя.']];
    var db = [], opened = {}, cur = -1, m = msg(root), ans = group([], 'Твой выбор'), cnt = h('p', 'tkread'), ex = h('p', 'tkbadge'); ex.hidden = true;
    var yes = btn('Обязательно', function () { pick(true); }, 'tkbig'), no = btn('Можно выбрать самому', function () { pick(false); }, 'tkbig'); ans.appendChild(yes); ans.appendChild(no); ans.hidden = true;
    docs.forEach(function (d, i) { var b = btn(d[0], function () { cur = i; pressOnly(db, b); ans.hidden = false; yes.setAttribute('aria-pressed', 'false'); no.setAttribute('aria-pressed', 'false'); m.textContent = 'Как думаешь, «' + d[0] + '» обязателен?'; }); db.push(b); });
    function pick(v) { var d = docs[cur]; (v ? yes : no).setAttribute('aria-pressed', 'true'); (v ? no : yes).setAttribute('aria-pressed', 'false'); opened[cur] = 1; db[cur].classList.add('tkdone');
      m.textContent = 'Ты выбрал: ' + (v ? 'обязательно' : 'можно выбрать') + '. ' + d[2]; var n = Object.keys(opened).length; cnt.textContent = 'Открыто: ' + n + ' из 3.';
      if (n === 3) { ex.hidden = false; ex.textContent = 'Есть исключение: добровольный стандарт становится обязательным, если на него сослались в договоре или регламенте, или если изготовитель сам заявил, что продукция ему соответствует.'; } }
    root.insertBefore(group(db, 'Документы'), m); root.insertBefore(ans, m); root.insertBefore(cnt, m); root.insertBefore(ex, m); cnt.textContent = 'Открыто: 0 из 3.';
    m.textContent = 'Нажми на документ и угадай, обязателен ли он. Потом посмотри, как на самом деле.';
  };

  // 10. Кто чем занимается
  T['b1-o-18-08'] = function (root) {
    var jobs = ['Метролог', 'Специалист по стандартизации', 'Специалист по сертификации'];
    var tasks = [['Проверить, что весы на рынке показывают верный вес', 0, 'Это работа метролога: он отвечает за точность измерений.'], ['Написать единое правило, как обозначать и упаковывать продукцию', 1, 'Это работа специалиста по стандартизации: он разрабатывает единые правила.'], ['Подтвердить, что товар соответствует требованиям, и оформить документы', 2, 'Это работа специалиста по сертификации: он отвечает за подтверждение соответствия.']];
    var tb = [], jb = [], cur = -1, done = {}, m = msg(root), jr = group([], 'Кто этим занимается'), fin = h('div', 'tkfin'); fin.hidden = true;
    jobs.forEach(function (j, k) { var b = btn(j, function () { if (cur < 0) return; var t = tasks[cur]; pressOnly(jb, b); done[cur] = 1; tb[cur].classList.add('tkdone');
      m.textContent = (k === t[1] ? 'Верно подумал(а). ' : 'Ты выбрал: ' + j.toLowerCase() + '. ') + t[2]; if (Object.keys(done).length === 3) showFin(); }, 'tkbig'); jb.push(b); jr.appendChild(b); });
    jr.hidden = true;
    tasks.forEach(function (t, i) { var b = btn(t[0], function () { cur = i; pressOnly(tb, b); jr.hidden = false; jb.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); m.textContent = 'Кто, по-твоему, этим занимается?'; }); tb.push(b); });
    var like = ['Если тебе интереснее точность и измерения, смотри предметы «Метрология» и «Методы и средства измерений».', 'Если интереснее правила и документы, смотри «Стандартизацию» и «Разработку нормативной документации».', 'Если интереснее проверки и подтверждение качества, смотри «Сертификацию» и «Основы аккредитации».'];
    function showFin() { fin.hidden = false; fin.textContent = ''; fin.appendChild(h('p', 'tkread', 'А что из этого тебе показалось интереснее?')); var fb = [];
      jobs.forEach(function (j, k) { var b = btn(j, function () { pressOnly(fb, b); out.textContent = like[k]; }); fb.push(b); }); fin.appendChild(group(fb, 'Что интереснее')); var out = h('p', 'tkbadge'); fin.appendChild(out); }
    root.insertBefore(group(tb, 'Задачи'), m); root.insertBefore(jr, m); root.appendChild(fin);
    m.textContent = 'Нажми на задачу и выбери, кто ею занимается.';
  };

  window.taskMount = function (el, slug) { if (T[slug] && !el.getAttribute('data-ready')) { el.setAttribute('data-ready', '1'); try { T[slug](el); } catch (e) { if (window.console) console.warn('Задание не запустилось', e); } return true; } return false; };
  [].forEach.call(document.querySelectorAll('.task[data-task]'), function (el) { window.taskMount(el, el.getAttribute('data-task')); });
})();
