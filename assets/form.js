// Форма «Обратная связь»: вопросы по роли, проверка, отправка в Google Таблицу (адрес в data/config.json, поле feedback_url).
(function () {
  'use strict';
  var form = document.getElementById('fbform'); if (!form) return;
  var meta = document.querySelector('meta[name="feedback-url"]'), URL = meta && meta.content, T0 = Date.now();
  var rest = document.getElementById('rest'), msg = document.getElementById('fbmsg'), demo = document.getElementById('fbdemo'), sendBtn = document.getElementById('fbsend');
  if (!URL) demo.hidden = false;
  function vis(e) { return !e.closest('[hidden]'); }
  function one(n) { return [].filter.call(form.querySelectorAll('input[name="' + n + '"]:checked'), vis)[0] || null; }
  function val(n) { var e = one(n); return e ? e.value : ''; }
  function many(n) { return [].filter.call(form.querySelectorAll('input[name="' + n + '"]:checked'), vis).map(function (e) { return e.value; }); }
  function txt(n) { var e = form.querySelector('[name="' + n + '"]'); return e && vis(e) ? e.value.trim() : ''; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function sync() {
    var r = val('role'); rest.hidden = !r;
    [].forEach.call(form.querySelectorAll('[data-roles]'), function (b) { b.hidden = !(r && b.getAttribute('data-roles').split(' ').indexOf(r) >= 0); });
    var t = +val('trust'); document.getElementById('trustwhy').hidden = !(t && t <= 3);
    var u = +val('ux'); document.getElementById('uxwhy').hidden = !(u && u <= 3);
    document.getElementById('errbox').hidden = !document.getElementById('errchk').checked;
  }
  function bad(name, on) { var q = form.querySelector('[data-q="' + name + '"]'); if (q) q.classList.toggle('fbad', on); }
  form.addEventListener('change', function () { sync(); bad('role', false); bad('clarity', false); });
  sync();
  // предзаполнение: feedback.html?d=код-предмета (ссылка «Сообщить об ошибке»)
  var qp = new URLSearchParams(location.search), d = qp.get('d');
  if (d) { var opt = form.querySelector('select[name="err_d"] option[data-slug="' + d.replace(/[^a-z0-9-]/g, '') + '"]'); if (opt) { document.getElementById('errchk').checked = true; opt.selected = true; sync(); } }
  var pr = qp.get('role'); if (pr) { var pe = form.querySelector('input[name="role"][value="' + pr.replace(/[^a-z0-9]/g, '') + '"]'); if (pe) { pe.checked = true; sync(); } }

  form.addEventListener('submit', function (e) {
    e.preventDefault(); ['role', 'clarity'].forEach(function (n) { bad(n, false); });
    var role = one('role'), clar = val('clarity'), errs = [], focus = null;
    if (!role) { errs.push('Выберите, кто вы.'); bad('role', true); focus = form.querySelector('input[name="role"]'); }
    else if (!clar) { errs.push('Ответьте, стало ли вам понятнее.'); bad('clarity', true); focus = form.querySelector('input[name="clarity"]'); }
    var contact = txt('contact'), consent = !!one('consent');
    if (!errs.length && contact && !consent) { errs.push('Чтобы мы могли использовать контакт, отметьте согласие или удалите контакт.'); focus = form.querySelector('input[name="contact"]'); }
    var errD = form.querySelector('select[name="err_d"]'), errText = txt('err_text');
    if (!errs.length && document.getElementById('errchk').checked && (!errD.value || !errText)) { errs.push('Для сообщения об ошибке выберите предмет и опишите, что неверно.'); focus = errD.value ? form.querySelector('textarea[name="err_text"]') : errD; }
    if (errs.length) { msg.textContent = errs.join(' '); if (focus) focus.focus(); return; }
    var chk = document.getElementById('errchk').checked && vis(errD);
    var P = { type: 'form', role: role.getAttribute('data-label'), clarity: clar, clearer: many('clearer'), unclear: txt('unclear'), trust: +val('trust') || '', trustwhy: many('trustwhy'),
      used: many('used'), ux: +val('ux') || '', uxwhy: many('uxwhy'), missing: many('missing'), missing_other: txt('missing_other'), interest: val('interest'), enough: val('enough'),
      parent_imp: many('parent_imp'), class_use: val('class_use'), class_fmt: many('class_fmt'), uni_interest: val('uni_interest'), uni_fmt: many('uni_fmt'), uni_pilot: val('uni_pilot'),
      err_d: chk ? errD.value : '', err_text: chk ? errText : '', contact: contact && consent ? contact : '', consent: !!(contact && consent), quote: !!one('quote'), src: 'form', hp: form.querySelector('input[name="hp"]').value };
    sendBtn.disabled = true; msg.textContent = 'Отправляем…';
    setTimeout(function () {
      P.dt = Date.now() - T0;
      if (!URL) { thanks(true, P); return; }
      fetch(URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(P), keepalive: true })
        .then(function () { thanks(false, P); })
        .catch(function () { sendBtn.disabled = false; msg.textContent = 'Не получилось отправить. Проверьте интернет и попробуйте ещё раз.'; });
    }, Math.max(0, 2600 - (Date.now() - T0)));   // защита от ботов: слишком быстрые отправки сервер отбрасывает
  });
  function thanks(isDemo, P) {
    while (form.firstChild) form.removeChild(form.firstChild);
    var h = el('h2', '', isDemo ? 'Демонстрация: ответ не отправлен' : 'Спасибо за ответ!'); h.tabIndex = -1; form.appendChild(h);
    form.appendChild(el('p', '', isDemo ? 'Приём ответов ещё не подключён, поэтому данные остались только на вашем устройстве. Ниже то, что отправилось бы.' : 'Мы читаем каждый ответ и используем его, чтобы сделать описание специальности понятнее.'));
    if (isDemo) { var dt = el('details', 'ans'); dt.appendChild(el('summary', '', 'Показать данные ответа')); dt.appendChild(el('pre', 'fpre', JSON.stringify(P, null, 1))); form.appendChild(dt); }
    var a = el('a', 'btn', 'На главную'); a.href = 'index.html'; form.appendChild(a); h.focus(); window.scrollTo({ top: 0 });
  }
})();
