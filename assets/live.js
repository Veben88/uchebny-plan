// Подгружает свежие оценки студентов из веб-приложения Google (адрес в data/config.json).
// Если загрузка не удалась, остаётся то, что было вставлено при сборке сайта.
(function () {
  var box = document.getElementById('ratings'), meta = document.querySelector('meta[name="ratings-url"]');
  if (!box || !meta || !meta.content) return;
  var slug = box.getAttribute('data-slug'), ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 8000);
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function meter(value, label) { var m = el('div', 'meter'); m.appendChild(el('b', '', String(value))); m.appendChild(el('span', '', label)); return m; }
  fetch(meta.content, { signal: ctl.signal })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      clearTimeout(t);
      var r = d && d.ratings && d.ratings[slug];
      if (!r || r.n < (d.min_n || 5)) return;
      while (box.children.length > 1) box.removeChild(box.lastChild);
      var ms = el('div', 'meters');
      if (r.hard != null) ms.appendChild(meter(r.hard, 'Сложность, 1–5'));
      if (r.useful != null) ms.appendChild(meter(r.useful, 'Польза для профессии, 1–5'));
      if (r.interest) ms.appendChild(meter(r.interest, 'раз отмечен среди самых интересных'));
      box.appendChild(ms);
      var when = d.updated ? new Date(d.updated).toLocaleDateString('ru-RU') : '';
      box.appendChild(el('p', 'muted', 'Ответили: ' + r.n + '. Оценили: ' + (d.scope || 'студенты, прошедшие предмет') + '. Медианные значения.' + (when ? ' Обновлено: ' + when + '.' : '')));
    })
    .catch(function (e) { clearTimeout(t); if (window.console) console.warn('Оценки не загружены:', e); });
})();
