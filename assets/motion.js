// Движение в духе Persona 5. Скрипт не меняет логику сайта: он следит за состояниями,
// которые уже выставляют другие скрипты (aria-pressed, hidden, текст сообщений, open у <details>),
// и добавляет на короткое время классы p5-*, а сами анимации описаны в style.css.
// При «уменьшении движения» скрипт ничего не анимирует.
(function () {
  'use strict';
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  // Перезапуск CSS-анимации: снимаем класс, вызываем перерасчёт стилей, ставим снова.
  // Класс снимается по окончании анимации, поэтому эффекты не накапливаются.
  function pulse(el, cls, also) {
    if (!el || RM) return;
    (also || []).forEach(function (c) { el.classList.remove(c); });
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    var off = function (e) { if (e && e.target !== el) return; el.classList.remove(cls); el.removeEventListener('animationend', off); el.removeEventListener('animationcancel', off); clearTimeout(t); };
    var t = setTimeout(off, 900);                 // страховка, если animationend не придёт
    el.addEventListener('animationend', off); el.addEventListener('animationcancel', off);
  }

  // ---------- направление перехода между страницами (для View Transitions) ----------
  // Запоминаем, куда ведёт ссылка: вперёд или назад. Скрипт в <head> следующей страницы
  // передаёт это в переход, и красный срез приходит с нужной стороны.
  var menu = document.querySelector('.menu'), links = menu ? [].slice.call(menu.querySelectorAll('a')) : [];
  function curIndex() { for (var i = 0; i < links.length; i++) if (links[i].hasAttribute('aria-current')) return i; return -1; }
  function save(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]'); if (!a || a.target || a.hasAttribute('download')) return;
    var u; try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin || (u.pathname === location.pathname && u.hash)) return;
    var dir = 'fwd', k = links.indexOf(a), from = curIndex();
    if (k >= 0) {
      if (from >= 0 && k !== from) { dir = k > from ? 'fwd' : 'back'; save('p5nav', JSON.stringify({ from: from, to: k, t: Date.now() })); }
    } else if (a.closest('.crumbs') || (a.closest('.pager') && a === a.parentNode.firstElementChild) || a.classList.contains('brand')) dir = 'back';
    save('p5dir', dir);
  });

  if (RM) { root.classList.remove('p5-navwait', 'p5-pre'); return; }
  root.classList.add('p5m');


  // ---------- появление при прокрутке ----------
  // Блоки, которые при загрузке ниже экрана, ждут в скрытом виде (класс p5-rv) и въезжают, когда до них доходит прокрутка.
  // Те, что остались выше экрана (страницу открыли посередине или перешли по ссылке-якорю), показываются сразу и без анимации.
  // Если IntersectionObserver недоступен, ничего не скрывается. При «уменьшить движение» сюда код не доходит.
  (function reveal() {
    if (!('IntersectionObserver' in window)) return;
    var vh = window.innerHeight;
    // сигнатуры страниц: плитки каталога и вопросы «О проекте» анимируются всегда, даже если уже на первом экране
    var forced = [].slice.call(document.querySelectorAll('.tiles .tile, main .wrap > details'));
    var items = [].filter.call(document.querySelectorAll('main .panel, main .pager, main h2, #grid .card'), function (el) {
      if (el.closest('.station, .xp, .heroblock, .band, details') || (el.tagName === 'H2' && el.closest('.panel'))) return false;
      var r = el.getBoundingClientRect(); return r.height > 0 && r.top > vh * 0.92;
    }).concat(forced);
    if (!items.length) return;
    var io = new IntersectionObserver(function (entries) {
      var k = 0;
      entries.forEach(function (en) {
        var el = en.target;
        if (en.isIntersecting) {
          el.style.setProperty('--rd', Math.min(k++, 7));
          el.classList.add('p5-in');
        } else if (en.boundingClientRect.bottom < 0) el.classList.add('p5-in', 'p5-now');   // уже прокручен: без анимации
        else return;
        io.unobserve(el);
        var done = function () { el.classList.remove('p5-rv', 'p5-in', 'p5-now'); el.style.removeProperty('--rd'); };
        if (el.classList.contains('p5-now')) done();
        else {
          var end = function (ev) { if (ev && ev.target !== el) return; el.removeEventListener('animationend', end); done(); };
          el.addEventListener('animationend', end); setTimeout(done, 1200);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { el.classList.add('p5-rv'); io.observe(el); });
  })();


  // ---------- сигнатура «Развития сайта»: линия этапов дорисовывается, этапы встают на неё по очереди ----------
  (function roadSignature() {
    var road = document.querySelector('.road');
    if (!road || !('IntersectionObserver' in window)) return;
    road.classList.add('p5-sw');                                   // линия и этапы ждут, пока блок не окажется на экране
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect(); road.classList.remove('p5-sw'); road.classList.add('p5-draw');
      setTimeout(function () { road.classList.remove('p5-draw'); }, 1700);   // после рисования остаётся обычное состояние
    }, { threshold: 0.18 });
    io.observe(road);
    setTimeout(function () { road.classList.remove('p5-sw'); }, 8000);       // страховка: блок не должен остаться скрытым
  })();

  root.classList.remove('p5-pre');   // блоки сигнатур уже скрыты классами p5-rv / p5-sw, временное скрытие из <head> больше не нужно

  // ---------- навигация: индикатор активного пункта переезжает от прежнего пункта к новому ----------
  (function navGhost() {
    var raw; try { raw = sessionStorage.getItem('p5nav'); sessionStorage.removeItem('p5nav'); } catch (e) {}
    var release = function () { root.classList.remove('p5-navwait'); };   // красная подложка активного пункта снова видна
    if (!raw || !menu) { release(); return; }
    var d; try { d = JSON.parse(raw); } catch (e) { release(); return; }
    var to = curIndex();
    if (!d || to < 0 || d.to !== to || !links[d.from] || Date.now() - d.t > 8000) { release(); return; }
    var target = links[to], done = false, ghost = null;
    root.classList.add('p5-navwait');                            // обычно уже стоит: его ставит скрипт в <head>
    var finish = function () {
      if (done) return; done = true;
      if (ghost) ghost.remove(); release(); pulse(target, 'p5-stamp');
    };
    var safety = setTimeout(finish, 1000);
    var go = function () {
      if (done) return;
      var m = menu.getBoundingClientRect(), a = links[d.from].getBoundingClientRect(), b = target.getBoundingClientRect();
      if (!a.width || !b.width) { clearTimeout(safety); finish(); return; }
      ghost = document.createElement('span'); ghost.className = 'p5-navghost'; ghost.setAttribute('aria-hidden', 'true');
      ghost.style.left = (a.left - m.left) + 'px'; ghost.style.top = (a.top - m.top) + 'px';
      ghost.style.width = a.width + 'px'; ghost.style.height = a.height + 'px';
      menu.appendChild(ghost);
      var dx = b.left - a.left, dy = b.top - a.top, sx = b.width / a.width, sy = b.height / a.height;
      var anim = ghost.animate([
        { transform: 'translate(0,0) scale(1,1)' },
        { transform: 'translate(' + (dx * 1.06) + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')', offset: 0.78 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')' }
      ], { duration: 320, easing: 'steps(6, end)', fill: 'forwards' });
      anim.onfinish = function () { clearTimeout(safety); finish(); };
    };
    // ширина пунктов зависит от шрифта Oswald: если он уже загружен, стартуем сразу, иначе ждём не дольше 150 мс
    var started = false, start = function () { if (!started) { started = true; requestAnimationFrame(go); } };
    if (!document.fonts || document.fonts.status === 'loaded') start();
    else { document.fonts.ready.then(start); setTimeout(start, 150); }
  })();

  // ---------- переключатели: выбор, снятие выбора ----------
  // aria-pressed выставляют фильтры каталога, кнопки «Крупно», подсветка пути, задания и отзывы.
  var obs = new MutationObserver(function (recs) {
    var shown = [];
    recs.forEach(function (r) {
      var el = r.target;
      if (r.type === 'attributes' && r.attributeName === 'aria-pressed') {
        var now = el.getAttribute('aria-pressed');
        if (now === r.oldValue) return;
        if (now === 'true') pulse(el, el.classList.contains('tile') ? 'p5-slam' : 'p5-on', ['p5-off']);
        else if (r.oldValue === 'true') pulse(el, 'p5-off', ['p5-on', 'p5-slam']);
      } else if (r.type === 'attributes' && r.attributeName === 'hidden') {
        // карточка каталога снова видна после смены фильтра или поиска
        if (r.oldValue !== null && !el.hidden && el.classList.contains('card')) shown.push(el);
      } else if (r.type === 'childList' || r.type === 'characterData') {
        var t = el.nodeType === 1 ? el : el.parentElement;
        var box = t && t.closest && t.closest('#count, .tkmsg, .fbmsg, #hltext');
        if (box && box.textContent.trim()) pulse(box, box.id === 'count' ? 'p5-tick' : 'p5-msg');
      }
    });
    // появление карточек лесенкой: не больше 10 ступенек, чтобы длинный список не ждал
    shown.forEach(function (c, i) { c.style.setProperty('--k', Math.min(i, 10)); pulse(c, 'p5-enter'); });
  });
  obs.observe(document.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['aria-pressed', 'hidden'], childList: true, characterData: true });

  // варианты ответов в форме обратной связи — это радиокнопки и флажки, у них нет aria-pressed
  document.addEventListener('change', function (e) {
    var i = e.target; if (!i || !i.closest || !i.closest('.fo')) return;
    var span = i.nextElementSibling; if (!span) return;
    if (i.checked) pulse(span, 'p5-on', ['p5-off']);
    if (i.type === 'radio') [].forEach.call(document.querySelectorAll('input[name="' + i.name + '"]'), function (o) { if (o !== i && o.nextElementSibling) o.nextElementSibling.classList.remove('p5-on'); });
  });

  // ошибка в форме: вопрос встряхивается при каждой неудачной отправке, а не только при первой
  document.addEventListener('submit', function (e) {
    var f = e.target; if (!f || f.id !== 'fbform') return;
    setTimeout(function () { [].forEach.call(f.querySelectorAll('.fbad'), function (q) { pulse(q, 'p5-err'); }); }, 0);
  });

  // ---------- раскрывающиеся блоки <details>: закрытие тоже анимировано ----------
  document.addEventListener('click', function (e) {
    var s = e.target.closest && e.target.closest('summary'); if (!s) return;
    var d = s.parentElement; if (!d || d.tagName !== 'DETAILS' || !d.open) return;
    if (d.classList.contains('p5-closing')) { e.preventDefault(); return; }
    e.preventDefault(); d.classList.add('p5-closing');
    var body = d.querySelector(':scope > :not(summary)'), closed = false;
    var end = function () { if (closed) return; closed = true; d.open = false; d.classList.remove('p5-closing'); };
    if (body) body.addEventListener('animationend', end, { once: true });
    setTimeout(end, 260);
  });
})();
