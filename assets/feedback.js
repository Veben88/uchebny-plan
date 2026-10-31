// Блок «Стало ли тебе понятнее?»: анонимный ответ да/нет и необязательный комментарий.
// Отправляется в веб-приложение Google (адрес в data/config.json, поле feedback_url).
(function () {
  'use strict';
  // Отправка с честным результатом: ответ сервиса читается (ok / bad:причина / busy). Если браузер не отдал ответ
  // (сервис не прислал разрешение на чтение или нет сети), результат — «unconfirmed»: повторно не отправляем, чтобы не задвоить запись.
  function send(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, redirect: 'follow' })
      .then(function (r) { return r.text(); })
      .then(function (t) { t = String(t).trim(); return t === 'ok' ? { s: 'ok' } : t === 'busy' ? { s: 'busy' } : { s: 'bad', why: t.replace(/^bad:/, '') }; })
      .catch(function () {                       // ответ не прочитан: сервис доступен (запрос дошёл) или сети нет (запрос не ушёл)
        if (navigator.onLine === false) return { s: 'offline' };
        return fetch(url, { mode: 'no-cors', cache: 'no-store' }).then(function () { return { s: 'unconfirmed' }; }, function () { return { s: 'offline' }; });
      });
  }

  var meta = document.querySelector('meta[name="feedback-url"]'), URL = meta && meta.content;
  if (!URL) return;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function key(slug) { return 'fb:' + slug; }
  function done(slug) { try { return localStorage.getItem(key(slug)) !== null; } catch (e) { return false; } }
  function mark(slug, v) { try { localStorage.setItem(key(slug), String(v)); } catch (e) {} }
  window.fbRender = function (box, slug, src) {
    while (box.firstChild) box.removeChild(box.firstChild);
    var h = el(src === 'card' ? 'h3' : 'h2', '', 'Стало ли тебе понятнее?'); box.appendChild(h);
    if (done(slug)) { box.appendChild(el('p', 'muted fbok', 'Спасибо, ты уже ответил(а) по этому предмету.')); return; }
    box.appendChild(el('p', 'muted', 'Стало ли тебе яснее, что это за предмет и чему на нём учат? Ответ анонимный.'));
    var row = el('div', 'fbrow'), yes = el('button', 'fbb', 'Да, понятнее'), no = el('button', 'fbb', 'Нет, не очень');
    [yes, no].forEach(function (b) { b.type = 'button'; b.setAttribute('aria-pressed', 'false'); row.appendChild(b); });
    box.appendChild(row);
    var form = el('div', 'fbform'); form.hidden = true;
    var ta = el('textarea'); ta.maxLength = 500; ta.rows = 3; ta.setAttribute('aria-label', 'Комментарий, необязательно');
    ta.placeholder = 'Что осталось непонятным или что добавить? Необязательно. Не пиши личные данные.';
    var trap = el('input'); trap.type = 'text'; trap.name = 'website'; trap.tabIndex = -1; trap.setAttribute('aria-hidden', 'true'); trap.autocomplete = 'off'; trap.className = 'fbtrap';
    var send_ = el('button', 'btn-s', 'Отправить'); send_.type = 'button'; var msg = el('p', 'muted fbmsg'); msg.setAttribute('aria-live', 'polite');
    form.appendChild(ta); form.appendChild(trap); form.appendChild(send_); form.appendChild(msg); box.appendChild(form);
    var vote = null;
    function pick(v, btn, other) { vote = v; btn.setAttribute('aria-pressed', 'true'); other.setAttribute('aria-pressed', 'false'); form.hidden = false; }
    yes.addEventListener('click', function () { pick(1, yes, no); });
    no.addEventListener('click', function () { pick(0, no, yes); });
    send_.addEventListener('click', function () {
      if (vote === null) return;
      if (trap.value) { while (box.firstChild) box.removeChild(box.firstChild); box.appendChild(h); box.appendChild(el('p', 'fbok', 'Спасибо!')); return; }
      send_.disabled = true; msg.textContent = 'Отправляем…';
      var body = JSON.stringify({ slug: slug, v: vote, c: ta.value.slice(0, 500), src: src, t: Date.now() });
      send(URL, body).then(function (r) {
        if (r.s !== 'ok' && r.s !== 'unconfirmed') { send_.disabled = false; msg.textContent = r.s === 'offline' ? 'Нет соединения: ответ не отправлен.' : r.s === 'busy' ? 'Сервис занят, ответ не сохранён. Попробуй через минуту.' : 'Сервис не принял ответ, ничего не сохранено. Попробуй ещё раз позже.'; return; }
        mark(slug, vote); while (box.firstChild) box.removeChild(box.firstChild); box.appendChild(h);
        box.appendChild(el('p', 'fbok', r.s === 'ok' ? 'Спасибо, ответ принят! Он поможет сделать описание понятнее.' : 'Ответ отправлен, но сервис не подтвердил приём — мы не можем сказать наверняка, что он сохранился.'));
        var fp = document.querySelector('meta[name="feedback-page"]'); if (fp) { var a = el('a', '', 'Рассказать подробнее'); a.href = fp.content; var pp = el('p', 'muted'); pp.appendChild(a); box.appendChild(pp); }
      });
    });
  };
  var page = document.getElementById('fb'); if (page) window.fbRender(page, page.getAttribute('data-slug'), 'page');
})();
