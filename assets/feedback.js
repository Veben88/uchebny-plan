// Блок «Стало ли тебе понятнее?»: анонимный ответ да/нет и необязательный комментарий.
// Отправляется в веб-приложение Google (адрес в data/config.json, поле feedback_url).
(function () {
  'use strict';
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
    var send = el('button', 'btn-s', 'Отправить'); send.type = 'button'; var msg = el('p', 'muted fbmsg'); msg.setAttribute('aria-live', 'polite');
    form.appendChild(ta); form.appendChild(trap); form.appendChild(send); form.appendChild(msg); box.appendChild(form);
    var vote = null;
    function pick(v, btn, other) { vote = v; btn.setAttribute('aria-pressed', 'true'); other.setAttribute('aria-pressed', 'false'); form.hidden = false; }
    yes.addEventListener('click', function () { pick(1, yes, no); });
    no.addEventListener('click', function () { pick(0, no, yes); });
    send.addEventListener('click', function () {
      if (vote === null) return;
      if (trap.value) { while (box.firstChild) box.removeChild(box.firstChild); box.appendChild(h); box.appendChild(el('p', 'fbok', 'Спасибо!')); return; }
      send.disabled = true; msg.textContent = 'Отправляем…';
      var body = JSON.stringify({ slug: slug, v: vote, c: ta.value.slice(0, 500), src: src, t: Date.now() });
      fetch(URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, keepalive: true })
        .then(function () { mark(slug, vote); while (box.firstChild) box.removeChild(box.firstChild); box.appendChild(h); box.appendChild(el('p', 'fbok', 'Спасибо! Твой ответ поможет сделать описание понятнее.')); var fp = document.querySelector('meta[name="feedback-page"]'); if (fp) { var a = el('a', '', 'Рассказать подробнее'); a.href = fp.content; var pp = el('p', 'muted'); pp.appendChild(a); box.appendChild(pp); } })
        .catch(function () { send.disabled = false; msg.textContent = 'Не получилось отправить. Попробуй ещё раз позже.'; });
    });
  };
  var page = document.getElementById('fb'); if (page) window.fbRender(page, page.getAttribute('data-slug'), 'page');
})();
