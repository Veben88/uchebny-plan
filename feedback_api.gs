/**
 * Приём ответов «Стало ли тебе понятнее?» с сайта «Учебный план простым языком».
 * Скрипт живёт в отдельной Google Таблице и записывает анонимные ответы: предмет, да или нет, комментарий.
 *
 * Как подключить:
 * 1. Создайте новую Google Таблицу «Отзывы о понятности». Расширения -> Apps Script.
 * 2. Вставьте этот файл целиком, сохраните.
 * 3. Выберите функцию setup и нажмите «Выполнить» (разрешите доступ). Появятся листы «Отзывы» и «Сводка».
 * 4. Развернуть -> Новое развёртывание -> «Веб-приложение». Выполнять как: Я. Доступ: Все. Скопируйте адрес на /exec.
 * 5. Вставьте адрес в data/config.json репозитория сайта, поле "feedback_url". Блок на сайте появится после сборки.
 * При изменении кода каждый раз делайте «Управление развёртываниями -> изменить -> новая версия».
 */
const CFG = { SHEET: 'Отзывы', SUMMARY: 'Сводка', MAX_COMMENT: 500, MAX_PER_MIN: 60 };

/** Чистая функция проверки: возвращает {ok, row} или {ok:false, why} */
function validate_(o, now) {
  if (!o || typeof o !== 'object') return { ok: false, why: 'формат' };
  const slug = String(o.slug || '');
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return { ok: false, why: 'предмет' };
  if (o.v !== 0 && o.v !== 1) return { ok: false, why: 'ответ' };
  let c = String(o.c == null ? '' : o.c).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, CFG.MAX_COMMENT);
  if (/^[=+\-@]/.test(c)) c = "'" + c;                    // защита от формул в таблице
  const src = (o.src === 'card' || o.src === 'page') ? o.src : 'page';
  return { ok: true, row: [new Date(now || Date.now()), slug, o.v, c, src] };
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
    const r = validate_(o);
    if (!r.ok) return ContentService.createTextOutput('bad:' + r.why);
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.SHEET).appendRow(r.row);
    return ContentService.createTextOutput('ok');
  } finally { try { lock.releaseLock(); } catch (err) {} }
}
function doGet() { return ContentService.createTextOutput('feedback endpoint is alive'); }

/** Запустите один раз: создаёт листы «Отзывы» и «Сводка» с формулами */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CFG.SHEET) || ss.insertSheet(CFG.SHEET);
  sh.getRange(1, 1, 1, 5).setValues([['Время', 'Предмет (код)', 'Понятнее (1 да, 0 нет)', 'Комментарий', 'Откуда']]).setFontWeight('bold');
  sh.setFrozenRows(1); sh.setColumnWidths(1, 5, 140); sh.setColumnWidth(4, 420);
  let sm = ss.getSheetByName(CFG.SUMMARY) || ss.insertSheet(CFG.SUMMARY);
  sm.clear();
  const q = "'" + CFG.SHEET + "'!";
  sm.getRange('A1:B1').setValues([['Показатель', 'Значение']]).setFontWeight('bold');
  sm.getRange('A2:A6').setValues([['Всего ответов'], ['Ответили «стало понятнее»'], ['Доля «стало понятнее»'], ['Цель проекта'], ['Цель достигнута?']]);
  sm.getRange('B2').setFormula('=COUNT(' + q + 'C2:C)');
  sm.getRange('B3').setFormula('=COUNTIF(' + q + 'C2:C,1)');
  sm.getRange('B4').setFormula('=IFERROR(B3/B2,0)').setNumberFormat('0%');
  sm.getRange('B5').setValue(0.7).setNumberFormat('0%');
  sm.getRange('B6').setFormula('=IF(B2<30,"мало ответов (нужно 30)",IF(B4>=B5,"да","нет"))');
  sm.getRange('A8').setValue('По предметам').setFontWeight('bold');
  sm.getRange('A9').setFormula('=IFERROR(QUERY(' + q + 'B2:C,"select B, count(B), sum(C) where B is not null group by B label B \'Предмет\', count(B) \'Ответов\', sum(C) \'Понятнее\'",1),"пока нет ответов")');
  sm.setColumnWidth(1, 260); sm.setColumnWidth(2, 120);
}
