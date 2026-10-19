/**
 * Приём ответов TeachMap: виджет «Стало ли тебе понятнее?» и анкета «Обратная связь».
 * Скрипт живёт в отдельной Google Таблице и записывает анонимные ответы. Один адрес обслуживает обе формы.
 *
 * Как подключить:
 * 1. Создайте новую Google Таблицу «Отзывы TeachMap». Расширения -> Apps Script.
 * 2. Вставьте этот файл целиком, сохраните.
 * 3. Выберите функцию setup и нажмите «Выполнить» (разрешите доступ). Появятся листы «Отзывы», «Анкета» и две сводки.
 * 4. Развернуть -> Новое развёртывание -> «Веб-приложение». Выполнять как: Я. Доступ: Все. Скопируйте адрес на /exec.
 * 5. Вставьте адрес в data/config.json репозитория сайта, поле "feedback_url". Блоки и страница формы появятся после сборки.
 * При изменении кода каждый раз делайте «Управление развёртываниями -> изменить -> новая версия».
 */
const CFG = { SHEET: 'Отзывы', SUMMARY: 'Сводка', FORM: 'Анкета', FSUMMARY: 'Сводка анкеты', MAX_COMMENT: 500, MAX_LONG: 800, MAX_PER_MIN: 60, MIN_FILL_MS: 2000 };
const ROLES = ['Школьник 8–9 класса', 'Школьник 10–11 класса', 'Выпускник школы или колледжа', 'Студент', 'Родитель', 'Учитель или педагог-профориентатор', 'Преподаватель или сотрудник вуза', 'Другое'];
const CLARITY = ['Да', 'Скорее да', 'Не очень', 'Нет'];
const FORM_HEADERS = ['Время', 'Роль', 'Понятнее ли', 'Что стало понятнее', 'Что осталось непонятным', 'Доверие 1-5', 'Причины сомнений', 'Чем пользовались', 'Удобство 1-5', 'Что мешало', 'Чего не хватает', 'Своё предложение', 'Интерес к специальности', 'Хватает ли для обсуждения (родитель)', 'Что важно родителю', 'Классный час (учитель)', 'Нужный материал (учитель)', 'Предмет с ошибкой', 'Описание ошибки', 'Интерес вуза', 'Формат для вуза', 'Готовность к пилоту', 'Контакт', 'Можно цитировать', 'Источник'];

function neutral_(c) { return /^[=+\-@]/.test(c) ? "'" + c : c; }
function text_(s, max) { return neutral_(String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)); }
function list_(a, maxItems, maxLen) { return (Array.isArray(a) ? a : []).slice(0, maxItems).map(function (x) { return text_(x, maxLen); }).filter(String).join('; '); }
function scale_(v) { const n = parseInt(v, 10); return n >= 1 && n <= 5 ? n : ''; }
function enum_(v, allowed) { return allowed.indexOf(v) >= 0 ? v : ''; }

/** Проверка ответа виджета «Стало ли понятнее»: возвращает {ok, row} или {ok:false, why} */
function validate_(o, now) {
  if (!o || typeof o !== 'object') return { ok: false, why: 'формат' };
  const slug = String(o.slug || '');
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return { ok: false, why: 'предмет' };
  if (o.v !== 0 && o.v !== 1) return { ok: false, why: 'ответ' };
  const c = text_(o.c, CFG.MAX_COMMENT), src = (o.src === 'card' || o.src === 'page') ? o.src : 'page';
  return { ok: true, row: [new Date(now || Date.now()), slug, o.v, c, src] };
}
/** Проверка анкеты «Обратная связь» */
function validateForm_(o, now) {
  if (!o || typeof o !== 'object') return { ok: false, why: 'формат' };
  if (o.hp) return { ok: false, why: 'бот' };
  if (typeof o.dt === 'number' && o.dt < CFG.MIN_FILL_MS) return { ok: false, why: 'быстро' };
  const role = enum_(o.role, ROLES), clarity = enum_(o.clarity, CLARITY);
  if (!role) return { ok: false, why: 'роль' };
  if (!clarity) return { ok: false, why: 'понятнее' };
  const contact = o.consent === true ? text_(o.contact, 120) : '';           // контакт сохраняется только при согласии
  const minor = role === ROLES[0] || role === ROLES[1];                       // у школьников 8–11 классов контакт не принимается
  const err = o.err_d ? text_(o.err_d, 160) : '';
  return { ok: true, row: [
    new Date(now || Date.now()), role, clarity, list_(o.clearer, 8, 80), text_(o.unclear, CFG.MAX_COMMENT),
    scale_(o.trust), list_(o.trustwhy, 8, 80), list_(o.used, 10, 60), scale_(o.ux), list_(o.uxwhy, 8, 80),
    list_(o.missing, 10, 80), text_(o.missing_other, 200),
    text_(o.interest, 60), text_(o.enough, 40), list_(o.parent_imp, 8, 80), text_(o.class_use, 40), list_(o.class_fmt, 8, 60),
    err, err ? text_(o.err_text, CFG.MAX_LONG) : '', text_(o.uni_interest, 40), list_(o.uni_fmt, 6, 60), text_(o.uni_pilot, 40),
    minor ? '' : contact, o.quote === true ? 'да' : 'нет', 'form'] };
}
function tooMany_(cache, minuteKey) {
  const n = parseInt(cache.get(minuteKey) || '0', 10) + 1;
  cache.put(minuteKey, String(n), 90);
  return n > CFG.MAX_PER_MIN;
}
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const cache = CacheService.getScriptCache();
    if (tooMany_(cache, 'm' + Math.floor(Date.now() / 60000))) return ContentService.createTextOutput('busy');
    let o = null; try { o = JSON.parse((e && e.postData && e.postData.contents) || ''); } catch (err) {}
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (o && o.type === 'form') {
      const f = validateForm_(o);
      if (!f.ok) return ContentService.createTextOutput('bad:' + f.why);
      ss.getSheetByName(CFG.FORM).appendRow(f.row);
      return ContentService.createTextOutput('ok');
    }
    const r = validate_(o);
    if (!r.ok) return ContentService.createTextOutput('bad:' + r.why);
    ss.getSheetByName(CFG.SHEET).appendRow(r.row);
    return ContentService.createTextOutput('ok');
  } finally { try { lock.releaseLock(); } catch (err) {} }
}
function doGet() { return ContentService.createTextOutput('feedback endpoint is alive'); }

/** Запустите один раз: создаёт листы и сводки с формулами */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CFG.SHEET) || ss.insertSheet(CFG.SHEET);
  sh.getRange(1, 1, 1, 5).setValues([['Время', 'Предмет (код)', 'Понятнее (1 да, 0 нет)', 'Комментарий', 'Откуда']]).setFontWeight('bold');
  sh.setFrozenRows(1); sh.setColumnWidths(1, 5, 140); sh.setColumnWidth(4, 420);
  let sm = ss.getSheetByName(CFG.SUMMARY) || ss.insertSheet(CFG.SUMMARY); sm.clear();
  const q = "'" + CFG.SHEET + "'!";
  sm.getRange('A1:B1').setValues([['Показатель', 'Значение']]).setFontWeight('bold');
  sm.getRange('A2:A6').setValues([['Всего ответов'], ['Ответили «стало понятнее»'], ['Доля «стало понятнее»'], ['Цель проекта'], ['Цель достигнута?']]);
  sm.getRange('B2').setFormula('=COUNT(' + q + 'C2:C)'); sm.getRange('B3').setFormula('=COUNTIF(' + q + 'C2:C,1)');
  sm.getRange('B4').setFormula('=IFERROR(B3/B2,0)').setNumberFormat('0%'); sm.getRange('B5').setValue(0.7).setNumberFormat('0%');
  sm.getRange('B6').setFormula('=IF(B2<30,"мало ответов (нужно 30)",IF(B4>=B5,"да","нет"))');
  sm.getRange('A8').setValue('По предметам').setFontWeight('bold');
  sm.getRange('A9').setFormula('=IFERROR(QUERY(' + q + 'B2:C,"select B, count(B), sum(C) where B is not null group by B label B \'Предмет\', count(B) \'Ответов\', sum(C) \'Понятнее\'",1),"пока нет ответов")');
  sm.setColumnWidth(1, 260); sm.setColumnWidth(2, 120);
  // анкета
  let fs = ss.getSheetByName(CFG.FORM) || ss.insertSheet(CFG.FORM);
  fs.getRange(1, 1, 1, FORM_HEADERS.length).setValues([FORM_HEADERS]).setFontWeight('bold'); fs.setFrozenRows(1);
  fs.setColumnWidths(1, FORM_HEADERS.length, 150);
  let fm = ss.getSheetByName(CFG.FSUMMARY) || ss.insertSheet(CFG.FSUMMARY); fm.clear();
  const a = "'" + CFG.FORM + "'!";
  fm.getRange('A1:B1').setValues([['Показатель', 'Значение']]).setFontWeight('bold');
  fm.getRange('A2:A8').setValues([['Всего анкет'], ['«Да» и «Скорее да» на вопрос «стало ли понятнее»'], ['Доля «стало понятнее»'], ['Цель проекта'], ['Цель достигнута?'], ['Среднее доверие (1-5)'], ['Среднее удобство (1-5)']]);
  fm.getRange('B2').setFormula('=COUNTA(' + a + 'B2:B)');
  fm.getRange('B3').setFormula('=COUNTIF(' + a + 'C2:C,"Да")+COUNTIF(' + a + 'C2:C,"Скорее да")');
  fm.getRange('B4').setFormula('=IFERROR(B3/B2,0)').setNumberFormat('0%'); fm.getRange('B5').setValue(0.7).setNumberFormat('0%');
  fm.getRange('B6').setFormula('=IF(B2<30,"мало ответов (нужно 30)",IF(B4>=B5,"да","нет"))');
  fm.getRange('B7').setFormula('=IFERROR(AVERAGE(' + a + 'F2:F),"нет данных")'); fm.getRange('B8').setFormula('=IFERROR(AVERAGE(' + a + 'I2:I),"нет данных")');
  fm.getRange('A10').setValue('По ролям: сколько ответили каждым вариантом').setFontWeight('bold');
  fm.getRange('A11').setFormula('=IFERROR(QUERY(' + a + 'B1:C,"select B, count(C) where B is not null group by B pivot C",1),"пока нет ответов")');
  fm.getRange('A20').setValue('Чего чаще всего не хватает').setFontWeight('bold');
  fm.getRange('A21').setFormula('=IFERROR(QUERY(ARRAYFORMULA(FLATTEN(SPLIT(' + a + 'K2:K,"; "))),"select Col1, count(Col1) where Col1 <> \'\' group by Col1 order by count(Col1) desc label count(Col1) \'Раз\'",0),"пока нет ответов")');
  fm.getRange('D20').setValue('Что осталось непонятным (последние ответы)').setFontWeight('bold');
  fm.getRange('D21').setFormula('=IFERROR(QUERY(' + a + 'A1:E,"select A, B, E where E is not null order by A desc limit 15",1),"пока нет ответов")');
  fm.getRange('A34').setValue('Вузы: интерес и готовность к пилоту').setFontWeight('bold');
  fm.getRange('A35').setFormula('=IFERROR(QUERY(' + a + 'A1:W,"select A, T, U, V, W where B = \'Преподаватель или сотрудник вуза\'",1),"пока нет ответов вузов")');
  fm.getRange('A44').setValue('Сообщения об ошибках в предметах').setFontWeight('bold');
  fm.getRange('A45').setFormula('=IFERROR(QUERY(' + a + 'A1:S,"select A, R, S where R is not null",1),"об ошибках пока не сообщали")');
  fm.setColumnWidth(1, 280); fm.setColumnWidth(2, 160);
}
