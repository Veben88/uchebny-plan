// Обучающие задания «Попробуй сам»: посетитель делает то же, что специалист, и по ходу получает пояснения.
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', T = {};
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function s(tag, a, text) { var e = document.createElementNS(NS, tag); for (var k in (a || {})) e.setAttribute(k, a[k]); if (text != null) e.textContent = text; return e; }
  function svg(w, ht, label) { return s('svg', { viewBox: '0 0 ' + w + ' ' + ht, role: 'img', 'aria-label': label || '', 'class': 'tksvg' }); }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function btn(label, fn, cls) { var b = h('button', 'tkb' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); if (fn) b.addEventListener('click', fn); return b; }
  function row(btns, label, cls) { var g = h('div', 'tkrow' + (cls ? ' ' + cls : '')); g.setAttribute('role', 'group'); if (label) g.setAttribute('aria-label', label); btns.forEach(function (b) { g.appendChild(b); }); return g; }
  function only(btns, on) { btns.forEach(function (b) { b.setAttribute('aria-pressed', b === on ? 'true' : 'false'); }); }
  function say(root) { var m = h('p', 'tkmsg'); m.setAttribute('aria-live', 'polite'); root.appendChild(m); return m; }
  function info(title, lines) { var d = h('div', 'tkinfo'); if (title) d.appendChild(h('b', '', title)); var ul = h('ul'); lines.forEach(function (l) { ul.appendChild(h('li', '', l)); }); d.appendChild(ul); return d; }
  function f(v, d) { return v.toFixed(d == null ? 1 : d).replace('.', ','); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var C = { green: '#1E7A4C', blue: '#3F95DA', navy: '#22609F', grey: '#CBDDEE', red: '#B3261E', ink: '#1F2B3D', metal: '#9AA3B2', light: '#F0F7FE' };

  // ===== 1. Метрология: измерь деталь штангенциркулем и прочитай нониус =====
  T['b1-o-19-01-04'] = function (root) {
    var parts = [23.7, 12.4, 31.6, 18.3, 40.9], pi = 0, Wd = parts[0], pos = 52, S = 8, X0 = 46, hints = false, done = false;
    root.appendChild(info('Как читать нониус', ['Целые миллиметры: найди на основной шкале последний штрих левее нуля нониуса.', 'Десятые доли: найди штрих нониуса, который точно совпадает со штрихом основной шкалы. Его номер и есть десятые.', 'Сложи: целые + десятые. Например, 23 мм и 7-й штрих нониуса дают 23,7 мм.']));
    var main = svg(620, 170, 'Штангенциркуль: двигай подвижную губку к детали'); root.appendChild(main);
    root.appendChild(h('p', 'tkread', 'Увеличенная шкала (основная сверху, нониус снизу):'));
    var zoom = svg(620, 130, 'Увеличенная шкала с нониусом'); root.appendChild(zoom);
    var hb = btn('Показать подсказки', function () { hints = !hints; hb.setAttribute('aria-pressed', hints ? 'true' : 'false'); hb.textContent = hints ? 'Скрыть подсказки' : 'Показать подсказки'; draw(); }, 'tkghost');
    var nb = btn('Новая деталь', function () { pi = (pi + 1) % parts.length; Wd = parts[pi]; pos = Math.min(58, Wd + 8); done = false; inp.value = ''; draw(); m.textContent = 'Новая деталь. Подведи губку до касания и прочитай размер.'; }, 'tkghost');
    root.appendChild(row([hb, nb], 'Управление'));
    var form = h('div', 'tkform'), inp = h('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.placeholder = 'например, 23,7'; inp.setAttribute('aria-label', 'Твой результат измерения, мм');
    var cb = btn('Проверить', check, 'tkbig'); form.appendChild(h('span', 'tkread', 'Сколько показывает? ')); form.appendChild(inp); form.appendChild(h('span', 'tkread', ' мм ')); form.appendChild(cb); root.appendChild(form);
    var m = say(root); m.textContent = 'Перетащи подвижную губку (красную) влево, пока она не коснётся детали. Можно стрелками на клавиатуре.';
    var jaw;
    function draw() {
      clear(main); var touch = Math.abs(pos - Wd) < 1e-6;
      main.appendChild(s('rect', { x: X0 - 26, y: 28, width: 62 * S + 40, height: 26, rx: 4, fill: C.light, stroke: C.grey }));
      for (var i = 0; i <= 60; i++) { var x = X0 + i * S, L = i % 10 === 0 ? 12 : i % 5 === 0 ? 9 : 6; main.appendChild(s('line', { x1: x, y1: 54, x2: x, y2: 54 - L, stroke: C.ink, 'stroke-width': 1 })); if (i % 10 === 0) main.appendChild(s('text', { x: x, y: 24, 'text-anchor': 'middle', 'font-size': 11 }, String(i))); }
      main.appendChild(s('rect', { x: X0 - 18, y: 28, width: 18, height: 112, fill: C.navy }));
      main.appendChild(s('rect', { x: X0, y: 84, width: Wd * S, height: 40, rx: 3, fill: C.metal, stroke: '#7b859c' }));
      main.appendChild(s('text', { x: X0 + Wd * S / 2, y: 109, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 }, 'деталь'));
      jaw = s('g', { tabindex: 0, role: 'slider', 'aria-label': 'Подвижная губка штангенциркуля', 'aria-valuemin': Wd, 'aria-valuemax': 60, 'aria-valuenow': pos.toFixed(1), 'aria-valuetext': (touch ? 'касается детали' : 'не касается детали'), 'class': 'tkjaw' });
      var jx = X0 + pos * S; jaw.appendChild(s('rect', { x: jx, y: 24, width: 10 * S, height: 34, rx: 3, fill: C.blue, opacity: .35 }));
      jaw.appendChild(s('rect', { x: jx, y: 28, width: 18, height: 112, fill: touch ? C.green : C.blue }));
      for (var k = 0; k <= 10; k++) jaw.appendChild(s('line', { x1: jx + k * 0.9 * S, y1: 58, x2: jx + k * 0.9 * S, y2: 64 + (k % 5 === 0 ? 4 : 0), stroke: C.ink }));
      jaw.appendChild(s('text', { x: jx + 26, y: 154, 'font-size': 12, fill: touch ? '#4d6e10' : C.ink, 'font-weight': 700 }, touch ? 'губки касаются детали' : 'тяни губку к детали ←'));
      main.appendChild(jaw); bindJaw(); drawZoom();
    }
    function drawZoom() {
      clear(zoom); var a = Math.floor(pos) - 2, Z = 40, X = function (mm) { return 10 + (mm - a) * Z; }, fl = Math.floor(pos + 1e-9), kk = Math.round((pos - fl) * 10);
      zoom.appendChild(s('line', { x1: 0, y1: 60, x2: 620, y2: 60, stroke: C.grey }));
      for (var i = a; i <= a + 15; i++) { if (i < 0) continue; var x = X(i), hi = hints && (i === fl || (kk > 0 && i === fl + kk)); zoom.appendChild(s('line', { x1: x, y1: 60, x2: x, y2: i % 5 === 0 ? 30 : 40, stroke: hi ? (i === fl ? C.red : '#4d6e10') : C.ink, 'stroke-width': hi ? 3 : 1.4 })); if (i % 5 === 0 || hi) zoom.appendChild(s('text', { x: x, y: 24, 'text-anchor': 'middle', 'font-size': 12, fill: hi && i === fl ? C.red : C.ink, 'font-weight': hi ? 700 : 400 }, String(i))); }
      for (var k = 0; k <= 10; k++) { var vx = X(pos + 0.9 * k), on = hints && k === kk; zoom.appendChild(s('line', { x1: vx, y1: 62, x2: vx, y2: k % 5 === 0 ? 92 : 82, stroke: on ? '#4d6e10' : C.blue, 'stroke-width': on ? 3 : 1.6 })); zoom.appendChild(s('text', { x: vx, y: 108, 'text-anchor': 'middle', 'font-size': 11, fill: on ? '#4d6e10' : C.blue, 'font-weight': on ? 700 : 400 }, String(k))); }
      zoom.appendChild(s('text', { x: X(pos) + 4, y: 124, 'font-size': 11, fill: C.blue }, '← ноль нониуса'));
      if (hints) zoom.appendChild(s('text', { x: 612, y: 124, 'text-anchor': 'end', 'font-size': 11, fill: C.ink }, 'красный: целые мм, зелёный: совпавший штрих'));
    }
    function setPos(v) { pos = Math.max(Wd, Math.min(60, Math.round(v * 10) / 10)); draw(); jaw.focus({ preventScroll: true }); }
    function bindJaw() {
      jaw.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var move = function (ev) { var p = main.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; var q = p.matrixTransform(main.getScreenCTM().inverse()); var np = Math.max(Wd, Math.min(60, Math.round((q.x - X0 - 4) / S * 10) / 10)); if (np !== pos) { pos = np; draw(); } };
        var up = function () { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (jaw) jaw.focus({ preventScroll: true }); };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      });
      jaw.addEventListener('keydown', function (e) { var st = e.shiftKey ? 1 : 0.1; if (e.key === 'ArrowLeft') { e.preventDefault(); setPos(pos - st); } else if (e.key === 'ArrowRight') { e.preventDefault(); setPos(pos + st); } else if (e.key === 'Home') { e.preventDefault(); setPos(Wd); } });
    }
    function check() {
      var v = parseFloat(String(inp.value).replace(',', '.')), touch = Math.abs(pos - Wd) < 1e-6, fl = Math.floor(pos + 1e-9), kk = Math.round((pos - fl) * 10);
      if (!touch) { m.textContent = 'Сначала сведи губку до касания с деталью: иначе прибор показывает расстояние между губками, а не размер детали.'; return; }
      if (isNaN(v)) { m.textContent = 'Впиши число, например 23,7.'; return; }
      if (Math.abs(v - pos) < 0.05) { done = true; m.textContent = 'Точно: ' + f(pos) + ' мм. Целые: ' + fl + ' мм (последний штрих левее нуля нониуса), десятые: ' + kk + ' (совпал ' + kk + '-й штрих нониуса). Попробуй «Новую деталь».'; }
      else { hints = true; hb.setAttribute('aria-pressed', 'true'); hb.textContent = 'Скрыть подсказки'; draw(); m.textContent = 'Пока не так. Подсказки включены: красный штрих сверху даёт целые миллиметры, зелёный штрих нониуса снизу даёт десятые.'; }
    }
    draw();
  };

  // ===== 2. Стандартизация: собери папку документов на продукт =====
  T['b1-o-19-01-06'] = function (root) {
    var K = { tr: 'Технический регламент (ТР ТС или ТР ЕАЭС): обязательные требования безопасности. Действует во всех странах ЕАЭС, без него продукцию нельзя выпустить в продажу.', gost: 'Межгосударственный стандарт (ГОСТ) на продукцию: требования к качеству, сырью, упаковке и методам контроля. Применяется добровольно, но если изготовитель указал его на этикетке, он обязан его выполнять.', eskd: 'Стандарт ЕСКД: правила оформления чертежей и технических документов. Нужен конструкторам, но не устанавливает требований к самой продукции.' };
    var D = [['ТР ЕАЭС 040/2016', 'О безопасности рыбы и рыбной продукции', 'tr', 1, 'Главный регламент для рыбы: требования к безопасности рыбной продукции, в том числе натуральных консервов.'],
             ['ТР ТС 021/2011', 'О безопасности пищевой продукции', 'tr', 1, 'Общий регламент для всей еды: микробиология, вредные вещества, процессы производства.'],
             ['ТР ТС 022/2011', 'Пищевая продукция в части её маркировки', 'tr', 1, 'Что обязательно написать на этикетке: состав, массу, сроки, изготовителя.'],
             ['ТР ТС 005/2011', 'О безопасности упаковки', 'tr', 1, 'Требования к банке: из чего она сделана и что не попадёт из неё в продукт.'],
             ['ГОСТ 7452-2014', 'Консервы из рыбы натуральные. Технические условия', 'gost', 1, 'Стандарт именно на натуральные рыбные консервы: сырьё, рецептура, показатели качества. Добровольный, но помогает выполнить требования регламента.'],
             ['ТР ТС 008/2011', 'О безопасности игрушек', 'tr', 0, 'Регламент для игрушек. К консервам не относится.'],
             ['ТР ТС 017/2011', 'О безопасности продукции лёгкой промышленности', 'tr', 0, 'Одежда, ткани, обувь. К консервам не относится.'],
             ['ГОСТ 2.105-2019', 'ЕСКД. Общие требования к текстовым документам', 'eskd', 0, 'Правила оформления технических документов. Требований к самим консервам не содержит.']];
    root.appendChild(h('div', 'tkprod', 'Продукт: консервы «Горбуша натуральная» в жестяной банке. Собери папку документов, по которым нужно её выпускать.'));
    var bs = [], sel = {}, inf = h('div', 'tkinfo'), m;
    D.forEach(function (d, i) { var b = btn('', function () { sel[i] = !sel[i]; b.setAttribute('aria-pressed', sel[i] ? 'true' : 'false'); show(i); }, 'tkdoc'); b.appendChild(h('b', '', d[0])); b.appendChild(h('span', '', d[1])); bs.push(b); });
    root.appendChild(row(shuffle(bs), 'Стопки документов', 'tkdocs'));
    root.appendChild(inf); inf.appendChild(h('b', '', 'Нажимай на стопки: документ попадает в папку, а здесь появится, что это за тип документа.'));
    function show(i) { clear(inf); var d = D[i]; inf.appendChild(h('b', '', d[0] + ' ' + (sel[i] ? '(в папке)' : '(убран из папки)'))); inf.appendChild(h('p', '', K[d[2]])); }
    var go = btn('Проверить папку', function () {
      var miss = [], extra = []; D.forEach(function (d, i) { if (d[3] && !sel[i]) miss.push(d); if (!d[3] && sel[i]) extra.push(d); });
      clear(inf); inf.appendChild(h('b', '', 'Разбор папки'));
      var ul = h('ul'); D.forEach(function (d, i) { if (d[3] || sel[i]) { var li = h('li', d[3] ? (sel[i] ? 'tkok' : 'tkmiss') : 'tkextra', (d[3] ? (sel[i] ? 'Нужен: ' : 'Не хватает: ') : 'Лишний: ') + d[0] + '. ' + d[4]); ul.appendChild(li); } }); inf.appendChild(ul);
      m.textContent = !miss.length && !extra.length ? 'Папка собрана полностью: четыре обязательных регламента и стандарт на сам продукт. Так и выглядит работа специалиста по стандартизации.' : 'Почти. Не хватает: ' + miss.length + ', лишних: ' + extra.length + '. Посмотри разбор и поправь папку.';
    }, 'tkbig'); root.appendChild(go); m = say(root); m.textContent = 'Подсказка: обязательные требования задают технические регламенты, а стандарт подбирают на конкретный продукт.';
  };

  // ===== 3. Взаимозаменяемость: проверь валы калибром ПР и НЕ =====
  T['b1-o-19-01-09'] = function (root) {
    var PR = 19.980, NE = 19.959, V = [19.975, 19.985, 19.962, 19.950, 19.970, 19.991], st = V.map(function () { return { pr: null, ne: null, verdict: null }; }), cur = 0;
    root.appendChild(info('Как работает калибр-скоба для вала Ø20 f7 (19,959–19,980 мм)', ['Сторона ПР (проходная) сделана по наибольшему допустимому размеру. Годный вал через неё проходит.', 'Сторона НЕ (непроходная) сделана по наименьшему размеру. Годный вал через неё не проходит.', 'Годен вал, который прошёл ПР и не прошёл НЕ. Размер мерить не нужно: калибр сразу говорит «годен» или «брак».']));
    var vb = V.map(function (v, i) { return btn('Вал ' + (i + 1), function () { cur = i; only(vb, vb[i]); draw(); upd(); }); }); root.appendChild(row(vb, 'Валы'));
    var pic = svg(620, 140, 'Калибр-скоба и вал'); root.appendChild(pic);
    var pb = btn('Проверить стороной ПР', function () { st[cur].pr = V[cur] <= PR; draw('pr'); upd(); }, 'tkbig'), nb = btn('Проверить стороной НЕ', function () { st[cur].ne = V[cur] < NE; draw('ne'); upd(); }, 'tkbig');
    root.appendChild(row([pb, nb], 'Проверка калибром'));
    var gb = btn('Годен', function () { decide(true); }), bb = btn('Брак', function () { decide(false); }); root.appendChild(row([gb, bb], 'Решение'));
    var m = say(root), sum = h('p', 'tkread'); root.appendChild(sum);
    function draw(side) {
      clear(pic); var s0 = st[cur];
      [['ПР', 150, s0.pr], ['НЕ', 430, s0.ne]].forEach(function (c) { pic.appendChild(s('rect', { x: c[1] - 60, y: 20, width: 120, height: 26, rx: 4, fill: C.navy })); pic.appendChild(s('rect', { x: c[1] - 60, y: 46, width: 22, height: 70, fill: C.navy })); pic.appendChild(s('rect', { x: c[1] + 38, y: 46, width: 22, height: 70, fill: C.navy })); pic.appendChild(s('text', { x: c[1], y: 38, 'text-anchor': 'middle', 'font-size': 13, fill: '#fff', 'font-weight': 700 }, c[0]));
        if (c[2] !== null) { var through = c[2]; pic.appendChild(s('circle', { cx: c[1], cy: through ? 104 : 60, r: 30, fill: through ? C.green : C.red, opacity: .85 })); pic.appendChild(s('text', { x: c[1], y: 134, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: through ? '#4d6e10' : C.red }, through ? 'проходит' : 'не проходит')); } });
    }
    function upd() { var s0 = st[cur], ready = s0.pr !== null && s0.ne !== null; gb.disabled = bb.disabled = !ready;
      m.textContent = s0.verdict !== null ? m.textContent : !ready ? 'Вал ' + (cur + 1) + ': проверь его обеими сторонами калибра, потом реши, годен ли он.' : 'ПР: ' + (s0.pr ? 'проходит' : 'не проходит') + ', НЕ: ' + (s0.ne ? 'проходит' : 'не проходит') + '. Годен вал или брак?';
      var n = st.filter(function (x) { return x.verdict !== null; }).length; sum.textContent = 'Рассортировано валов: ' + n + ' из ' + V.length + '.'; }
    function decide(g) { var s0 = st[cur], ok = s0.pr && !s0.ne; s0.verdict = g; only([gb, bb], g ? gb : bb); vb[cur].classList.add('tkdone');
      var why = ok ? 'Вал годен: прошёл ПР и не прошёл НЕ.' : !s0.pr ? 'Вал брак: не прошёл ПР, значит он толще допустимого. Это исправимый брак: вал можно доточить.' : 'Вал брак: прошёл через НЕ, значит он тоньше допустимого. Это неисправимый брак: металл уже не вернуть.';
      m.textContent = (g === ok ? 'Верно. ' : 'Не совсем. ') + why + ' Настоящий диаметр: ' + f(V[cur], 3) + ' мм.'; upd(); }
    only(vb, vb[0]); draw(); upd();
  };

  // ===== 4. Статистические методы: диаграмма Исикавы =====
  T['b1-o-19-03'] = function (root) {
    var Cat = [['Люди', 'опыт, обучение, внимательность персонала'], ['Оборудование', 'станки, инструмент, их износ'], ['Метод', 'технология и инструкции'], ['Материал', 'сырьё и заготовки'], ['Измерение', 'приборы и способы контроля'], ['Среда', 'температура, влажность, освещение']];
    var Q = [['Новый оператор не прошёл обучение', 0], ['Резец станка затупился', 1], ['В инструкции не указана скорость резания', 2], ['В партии заготовок встречаются трещины', 3], ['Штангенциркуль давно не поверяли', 4], ['Зимой в цехе холодно, металл сжимается', 5], ['Оператор торопится к концу смены', 0], ['Станок вибрирует из-за изношенных подшипников', 1]];
    root.appendChild(h('div', 'tkprod', 'Проблема: диаметр валов часто выходит за допуск. Разложи возможные причины по группам, чтобы понять, где искать.'));
    var fish = h('div', 'tkfish'), boxes = Cat.map(function (c) { var b = h('div', 'tkbone'); b.appendChild(h('b', '', c[0])); b.appendChild(h('small', '', c[1])); b.appendChild(h('ul')); fish.appendChild(b); return b; });
    var head = h('div', 'tkhead', 'Брак: диаметр не в допуске'); fish.appendChild(head); root.appendChild(fish);
    var cur = -1, placed = {}, qb = [], cb = [], m;
    Q.forEach(function (q, i) { var b = btn(q[0], function () { if (placed[i]) return; cur = i; only(qb, b); cb.forEach(function (x) { x.disabled = false; }); m.textContent = 'К какой группе относится причина «' + q[0] + '»?'; }); qb.push(b); });
    root.appendChild(row(qb, 'Причины')); root.appendChild(h('p', 'tkread', 'Группа:'));
    Cat.forEach(function (c, k) { var b = btn(c[0], function () { if (cur < 0) return; var q = Q[cur];
      if (q[1] === k) { placed[cur] = 1; qb[cur].classList.add('tkdone'); qb[cur].disabled = true; boxes[k].querySelector('ul').appendChild(h('li', '', q[0])); cur = -1; cb.forEach(function (x) { x.disabled = true; });
        var n = Object.keys(placed).length; m.textContent = n === Q.length ? 'Готово: это диаграмма Исикавы («рыбья кость»). Она помогает не гадать, а проверить все группы причин по очереди: люди, оборудование, метод, материал, измерения, среда.' : 'Верно, это «' + c[0] + '». Разложено ' + n + ' из ' + Q.length + '.'; }
      else m.textContent = 'Не совсем: группа «' + c[0] + '» про ' + c[1] + '. Подумай, о чём причина «' + q[0] + '».'; }); b.disabled = true; cb.push(b); });
    root.appendChild(row(cb, 'Группы')); m = say(root); m.textContent = 'Выбери причину, а потом группу, к которой она относится.';
  };

  // ===== 5. Сертификация: собери путь по порядку =====
  T['b1-o-19-01-07'] = function (root) {
    var P = [['Заявка в орган по сертификации', 'Изготовитель выбирает аккредитованный орган и подаёт заявку.'], ['Отбор образцов продукции', 'Образцы отбирают так, чтобы они представляли всю партию или производство.'], ['Испытания в аккредитованной лаборатории', 'Лаборатория проверяет образцы на соответствие требованиям регламента.'], ['Проверка производства (для некоторых схем)', 'Орган смотрит, стабильно ли завод выпускает такую продукцию.'], ['Решение и выдача сертификата', 'Орган анализирует результаты и решает, выдавать ли сертификат.'], ['Маркировка знаком ЕАС', 'Знак ЕАС означает, что продукция прошла оценку соответствия регламентам ЕАЭС.'], ['Инспекционный контроль', 'Орган периодически проверяет, что продукция остаётся такой же, как при сертификации.']];
    root.appendChild(h('div', 'tkprod', 'Новую продукцию нужно сертифицировать. Собери шаги по порядку: нажимай на шаг, который, по-твоему, идёт следующим.'));
    var path = h('ol', 'tkflow'), next = 0, bs = [], m;
    P.forEach(function (p, i) { var b = btn(p[0], function () {
      if (i === next) { b.disabled = true; b.classList.add('tkdone'); var li = h('li'); li.appendChild(h('b', '', p[0])); li.appendChild(h('span', '', ' ' + p[1])); path.appendChild(li); next++;
        m.textContent = next === P.length ? 'Путь собран. Это общая схема: какие именно шаги нужны, определяет технический регламент на конкретную продукцию.' : 'Верно. Что дальше?'; }
      else m.textContent = 'Этот шаг ' + (i > next ? 'позже' : 'уже был') + '. ' + p[1] + ' Подумай, что нужно сделать до него.'; }); bs.push(b); });
    root.appendChild(row(shuffle(bs), 'Шаги сертификации')); root.appendChild(path); m = say(root); m.textContent = 'С чего всё начинается?';
  };

  // ===== 6. Методы и средства измерений: выбери предел мультиметра =====
  T['b1-o-19-05'] = function (root) {
    var O = [['Батарейка АА', 1.53], ['Батарейка «Крона»', 9.47], ['Лабораторный блок питания', 12.6]], R = [2, 20, 200], o = -1, r = -1;
    root.appendChild(info('Предел измерения', ['Предел: наибольшее значение, которое прибор может показать в этом режиме.', 'Если значение больше предела, прибор покажет OL (перегрузка).', 'Чем меньше предел, тем больше знаков после запятой: лучший выбор — наименьший предел, который больше измеряемого значения.']));
    var lcd = h('div', 'tklcd', '----'), ob = O.map(function (x, i) { return btn(x[0], function () { o = i; only(ob, ob[i]); upd(); }); }), rb = R.map(function (x, i) { return btn('Предел ' + x + ' В', function () { r = i; only(rb, rb[i]); upd(); }, 'tkbig'); });
    root.appendChild(h('p', 'tkread', 'Что измеряем:')); root.appendChild(row(ob, 'Что измеряем')); root.appendChild(h('p', 'tkread', 'Предел мультиметра:')); root.appendChild(row(rb, 'Предел')); root.appendChild(lcd);
    var m = say(root); m.textContent = 'Выбери, что измеряем, и предел мультиметра.';
    function upd() { if (o < 0 || r < 0) { lcd.textContent = '----'; return; } var v = O[o][1], lim = R[r], d = lim === 2 ? 3 : lim === 20 ? 2 : 1, best = R.filter(function (x) { return x > v; })[0];
      lcd.textContent = v >= lim ? 'OL' : f(v, d) + ' В'; lcd.classList.toggle('tkol', v >= lim);
      m.textContent = v >= lim ? 'Перегрузка: ' + f(v, 2) + ' В больше предела ' + lim + ' В. Выбери предел побольше.' : lim === best ? 'Лучший выбор: самый точный предел для этого значения (' + d + ' знак' + (d === 1 ? '' : 'а') + ' после запятой).' : 'Показания есть, но грубовато: на пределе ' + best + ' В было бы больше знаков после запятой.'; }
  };

  // ===== 7. Физические основы измерений и эталоны: поверь весы гирями =====
  T['b1-o-19-06'] = function (root) {
    var M = [0, 200, 500, 1000], rd = function (m) { return Math.round(m * 1.012 + 3); }, tol = 10, pts = {};
    root.appendChild(info('Что такое поверка', ['Эталонные гири: их масса известна гораздо точнее, чем могут ошибаться весы.', 'Ставим гирю, сравниваем показание весов с её массой. Разница и есть погрешность весов.', 'Здесь весы годны, если везде ошибка не больше ±10 г.']));
    var lcd = h('div', 'tklcd', '0 г'), mb = M.map(function (x, i) { return btn(x ? 'Гиря ' + x + ' г' : 'Пустые весы', function () { only(mb, mb[i]); var r = rd(x); pts[x] = r; lcd.textContent = r + ' г'; draw(); upd(x, r); }, 'tkbig'); });
    root.appendChild(row(mb, 'Эталонные гири')); root.appendChild(lcd);
    var g = svg(620, 170, 'Погрешность весов при разной массе'); root.appendChild(g); var m = say(root); m.textContent = 'Ставь гири по очереди и смотри, как ошибаются весы.';
    function X(v) { return 50 + v / 1000 * 520; } function Y(e) { return 85 - e * 4.2; }
    function draw() { clear(g); g.appendChild(s('rect', { x: 50, y: Y(tol), width: 520, height: Y(-tol) - Y(tol), fill: C.green, opacity: .25 })); g.appendChild(s('text', { x: 56, y: Y(tol) - 4, 'font-size': 11 }, 'допуск ±10 г'));
      g.appendChild(s('line', { x1: 50, y1: Y(0), x2: 570, y2: Y(0), stroke: C.ink })); [0, 200, 500, 1000].forEach(function (v) { g.appendChild(s('text', { x: X(v), y: 162, 'text-anchor': 'middle', 'font-size': 11 }, v + ' г')); });
      Object.keys(pts).forEach(function (k) { var e = pts[k] - k; g.appendChild(s('circle', { cx: X(+k), cy: Y(e), r: 7, fill: Math.abs(e) > tol ? C.red : C.blue })); g.appendChild(s('text', { x: X(+k), y: Y(e) - 11, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700 }, (e > 0 ? '+' : '') + e + ' г')); }); }
    function upd(x, r) { var e = r - x, n = Object.keys(pts).length, base = 'Эталон ' + x + ' г, весы показали ' + r + ' г: ошибка ' + (e > 0 ? '+' : '') + e + ' г' + (Math.abs(e) > tol ? ', это больше допуска.' : ', в пределах допуска.');
      m.textContent = n >= 3 ? base + ' Заметь: ошибка растёт с массой. Значит, у весов неверная чувствительность, и при 1000 г они выходят за допуск. Вывод поверки: весы не годны, их нужно настроить (откалибровать) и проверить снова.' : base + ' Поставь ещё гири.'; }
    draw();
  };

  // ===== 8. МСС и контроль качества: выборочный контроль партии =====
  T['b1-o-19-01-03'] = function (root) {
    var B = [['Партия А', 2], ['Партия Б', 10], ['Партия В', 30]], N = 100, n = 10, c = 1, cur = -1, stat = B.map(function () { return { t: 0, a: 0 }; });
    root.appendChild(info('Правило контроля', ['В партии 100 деталей, проверять все долго и дорого.', 'Берём наугад 10 деталей. Если бракованных 0 или 1, партию принимаем, если больше — возвращаем поставщику.', 'Сколько брака в каждой партии на самом деле, ты не знаешь, как и настоящий контролёр.']));
    var bb = B.map(function (x, i) { return btn(x[0], function () { cur = i; only(bb, bb[i]); take.disabled = false; clear(grid); m.textContent = 'Возьми 10 деталей из партии.'; }); });
    root.appendChild(row(bb, 'Партии')); var take = btn('Взять 10 деталей наугад', sample, 'tkbig'); take.disabled = true; root.appendChild(take);
    var grid = h('div', 'tkgrid'), m, tbl = h('p', 'tkread'); root.appendChild(grid); m = say(root); root.appendChild(tbl);
    function sample() { var bad = B[cur][1], idx = shuffle(Array.apply(null, { length: N }).map(function (_, i) { return i; })).slice(0, n), k = idx.filter(function (i) { return i < bad; }).length; clear(grid);
      idx.forEach(function (i) { grid.appendChild(h('span', i < bad ? 'tkbad' : 'tkgood', i < bad ? '✕' : '✓')); });
      var acc = k <= c, sx = stat[cur]; sx.t++; if (acc) sx.a++;
      m.textContent = 'Бракованных в выборке: ' + k + '. Решение: ' + (acc ? 'партию принять.' : 'вернуть поставщику.') + (sx.t >= 5 ? ' ' + B[cur][0] + ' принята в ' + sx.a + ' из ' + sx.t + ' проверок. На самом деле в ней ' + B[cur][1] + ' бракованных из 100: выборка иногда ошибается, поэтому план контроля рассчитывают по вероятностям.' : ' Повтори несколько раз.');
      tbl.textContent = B.map(function (x, i) { return x[0] + ': принята ' + stat[i].a + ' из ' + stat[i].t; }).join(' · '); }
    m.textContent = 'Выбери партию и проверь её выборкой.';
  };

  // ===== 9. Основы технического регулирования: прочитай этикетку =====
  T['b1-o-19-01-01'] = function (root) {
    var H = [['name', 'Горбуша натуральная', 'Наименование продукта. Обязательно по регламенту о маркировке (ТР ТС 022/2011).'], ['gost', 'ГОСТ 7452-2014', 'Документ, по которому изготовлены консервы. Если изготовитель его указал, он обязан его выполнять.'], ['comp', 'Состав: горбуша, соль', 'Состав. Обязателен по ТР ТС 022/2011.'], ['mass', 'Масса нетто 245 г', 'Количество продукта. Обязательно по ТР ТС 022/2011.'], ['date', 'Изготовлено и годен до: на крышке', 'Дата изготовления и срок годности. Обязательны по ТР ТС 022/2011.'], ['maker', 'Изготовитель: ООО «Пример», г. Владивосток', 'Изготовитель и его адрес (условный пример). Обязательны по ТР ТС 022/2011.'], ['eac', 'EAC', 'Единый знак обращения продукции ЕАЭС: продукция прошла оценку соответствия техническим регламентам.'], ['bar', '|||| ||| 4 600000 000000', 'Штрихкод нужен магазину для учёта товара. Знаком соответствия он не является.']];
    var Ms = [['Найди знак, который показывает, что продукция прошла оценку соответствия регламентам.', ['eac']], ['Найди документ, по которому сделаны консервы.', ['gost']], ['Найди любые три сведения, которые регламент о маркировке требует указать на этикетке.', ['name', 'comp', 'mass', 'date', 'maker']]];
    var lab = h('div', 'tklabel'), hb = {}, mi = 0, found = {}, m;
    H.forEach(function (x) { var b = btn(x[1], function () { tap(x[0]); }, 'tkspot tk-' + x[0]); hb[x[0]] = b; lab.appendChild(b); });
    root.appendChild(lab); var exp = h('div', 'tkinfo'); root.appendChild(exp); m = say(root);
    function tap(id) { var x = H.filter(function (y) { return y[0] === id; })[0]; clear(exp); exp.appendChild(h('b', '', x[1])); exp.appendChild(h('p', '', x[2]));
      if (mi >= Ms.length) return; var need = Ms[mi][1];
      if (need.indexOf(id) >= 0) { hb[id].classList.add('tkdone'); found[mi] = (found[mi] || 0) + 1; var goal = mi === 2 ? 3 : 1;
        if (found[mi] >= goal) { mi++; m.textContent = mi < Ms.length ? 'Есть! Следующее задание: ' + Ms[mi][0] : 'Все задания выполнены. Так специалист по техническому регулированию проверяет этикетку: что обязательно по регламенту, что добровольно, а что нужно магазину.'; }
        else m.textContent = 'Есть ' + found[mi] + ' из ' + goal + '. Ищи дальше.'; }
      else m.textContent = 'Это не то, что ищем сейчас, но прочитай пояснение. Задание: ' + Ms[mi][0]; }
    m.textContent = 'Задание: ' + Ms[0][0];
  };

  // ===== 10. Введение в специальность: путь продукта и кто на каком шаге =====
  T['b1-o-18-08'] = function (root) {
    var J = ['Специалист по стандартизации', 'Метролог', 'Инженер-испытатель', 'Специалист по сертификации', 'Инженер по качеству'];
    var S = [['Разработать технические условия на новые консервы', 0], ['Проверить весы и термометры на линии', 1], ['Испытать образцы в лаборатории', 2], ['Подтвердить соответствие и оформить декларацию', 3], ['Наладить систему качества на заводе', 4]];
    root.appendChild(h('div', 'tkprod', 'Путь консервов от идеи до полки магазина. Кто отвечает за каждый шаг?'));
    var chain = h('ol', 'tkchain'), slots = S.map(function (x, i) { var li = h('li'); li.appendChild(h('span', '', x[0])); var who = h('b', '', '?'); li.appendChild(who); chain.appendChild(li); return who; });
    root.appendChild(chain); var cur = -1, done = {}, sb = [], jb = [], m;
    S.forEach(function (x, i) { var b = btn('Шаг ' + (i + 1), function () { cur = i; only(sb, b); jb.forEach(function (y) { y.disabled = false; }); m.textContent = 'Кто отвечает за шаг «' + x[0] + '»?'; }); sb.push(b); });
    root.appendChild(row(sb, 'Шаги'));
    J.forEach(function (j, k) { var b = btn(j, function () { if (cur < 0) return; var x = S[cur];
      if (k === x[1]) { slots[cur].textContent = j; done[cur] = 1; sb[cur].classList.add('tkdone'); jb.forEach(function (y) { y.disabled = true; }); var n = Object.keys(done).length;
        m.textContent = n === S.length ? 'Все на местах: пять профессий работают в одной цепочке, и всем им учат на специальности 27.03.01.' : 'Верно. Осталось шагов: ' + (S.length - n) + '.'; }
      else m.textContent = j + ' здесь не главный. Подсказка: ' + ['кто пишет правила и документы?', 'кто отвечает за точность приборов?', 'кто проводит опыты с образцами?', 'кто оформляет документы о соответствии?', 'кто строит систему, чтобы брака не было?'][x[1]]; }, 'tkbig'); b.disabled = true; jb.push(b); });
    root.appendChild(row(jb, 'Профессии')); m = say(root); m.textContent = 'Выбери шаг, а потом профессию.';
  };

  window.taskMount = function (el, slug) { if (T[slug] && !el.getAttribute('data-ready')) { el.setAttribute('data-ready', '1'); try { T[slug](el); } catch (e) { if (window.console) console.warn('Задание не запустилось', e); } return true; } return false; };
  [].forEach.call(document.querySelectorAll('.task[data-task]'), function (el) { window.taskMount(el, el.getAttribute('data-task')); });
})();
