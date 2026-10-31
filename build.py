#!/usr/bin/env python3
"""Сборка сайта: data/plan.json + content/*.md + data/ratings.json -> папка site/"""
import json, re, shutil, html, hashlib
from pathlib import Path
ROOT = Path(__file__).parent; OUT = ROOT / "site"; E = html.escape
plan = json.loads((ROOT/"data/plan.json").read_text(encoding="utf-8")); meta, items = plan["meta"], plan["disciplines"]
def jload(p, d): return json.loads(p.read_text(encoding="utf-8")) if p.exists() else d
ratings = jload(ROOT/"data/ratings.json", {}); CONFIG = jload(ROOT/"data/config.json", {})
RATINGS_URL = (CONFIG.get("ratings_url") or "").strip(); SURVEY_URL = (CONFIG.get("survey_url") or "").strip(); CONTACT = (CONFIG.get("contact") or "").strip(); FEEDBACK_URL = (CONFIG.get("feedback_url") or "").strip(); FB_ON = bool(FEEDBACK_URL)
ICONS = jload(ROOT/"assets/icons.json", {}); MIN_N = 5
LINKS = jload(ROOT/"data/links.json", {"links": []})["links"]          # логические связи «нужен / помогает», согласованы автором проекта
_RPA = jload(ROOT/"data/rp_analysis.json", {"disciplines": []}); RP_SRC = _RPA.get("source", "рабочие программы дисциплин")
RP = {}                                                                  # разбор рабочих программ по позициям плана (у предмета по выбору — по программе на вариант)
_IDX = {i["idx"]: i["slug"] for i in items}
for _d in _RPA["disciplines"]:
    _s = _d.get("slug") or _IDX.get(_d.get("plan_idx"))   # у части записей разбора slug пуст, но код позиции плана есть
    if _s: RP.setdefault(_s, []).append(_d)
def ic(n): return ICONS.get(n, "")
# отпечаток версии файлов сайта: меняется при любой правке стилей и скриптов, поэтому браузер не показывает старое из кэша
ASSET_V = hashlib.md5(b"".join((ROOT/"assets"/f).read_bytes() for f in ("style.css","app.js","live.js","path.js","feedback.js","tasks.js","form.js","motion.js","profile.js","graph.js","jobs.js","plan.js","start.js") if (ROOT/"assets"/f).exists())).hexdigest()[:8]

# ---- сжатие ресурсов при сборке (только стандартная библиотека; исходники в assets/ не меняются) ----
_STR = re.compile(r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')')
def min_css(src):
    """Убирает комментарии и лишние пробелы. Строки в кавычках не трогает; пробелы вокруг + - * / (calc) сохраняются."""
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    out = []
    for i, part in enumerate(_STR.split(src)):
        if i % 2: out.append(part); continue
        part = re.sub(r'\s+', ' ', part)
        part = re.sub(r'\s*([{};,>])\s*', r'\1', part)
        part = re.sub(r':\s+', ':', part)
        out.append(part.replace(';}', '}'))
    return ''.join(out).strip()
def min_js(src):
    """Убирает комментарии на отдельных строках, отступы и пустые строки. Остальной код не трогает
    (внутри файлов есть регулярные выражения с кавычками, поэтому разбор строк и «хвостовых» комментариев был бы небезопасен)."""
    lines = [l.strip() for l in src.splitlines()]
    return '\n'.join(l for l in lines if l and not l.startswith('//')) + '\n'
def minify_assets(out_assets):
    for f in out_assets.glob('*.css'): f.write_text(min_css(f.read_text(encoding='utf-8')), encoding='utf-8')
    for f in out_assets.glob('*.js'): f.write_text(min_js(f.read_text(encoding='utf-8')), encoding='utf-8')
GROUPS = {
 "Профильные": (("Профессиональный блок","Вариативная часть","По выбору"), "FaRulerCombined", "Предметы специальности"),
 "Политехнические": (("Политехнический модуль",), "FaCog", "Математика, физика, механика"),
 "Общие": (("Общая часть","Факультатив"), "FaBookOpen", "История, языки, право"),
 "Практики и ГИА": (("Практика","ГИА"), "FaBriefcase", "Практики и диплом")}
GKEYS = list(GROUPS)
def group_of(t):
    for g, (ts, _, _) in GROUPS.items():
        if t in ts: return g
    return "Общие"
def gi(it): return GKEYS.index(group_of(it["type"]))
KEYS = {"Статус":"status","Кратко":"brief","Что это":"what","Зачем нужно":"why","Чему научишься":"learn","Темы":"themes","На занятиях":"acts","Инструменты":"tools","Как проверяют":"assess","Пример задания":"example","Ответ к заданию":"answer","Совет студента":"tip"}
def read_card(slug):
    d = {v: "" for v in KEYS.values()}; d["status"] = "готовится"; p = ROOT/"content"/f"{slug}.md"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                if k.strip() in KEYS: d[KEYS[k.strip()]] = v.strip()
    return d
def n(x): return "" if x is None else x
def blist(s): return [x.strip() for x in (s or "").split(" | ") if x.strip()]
def tlist(s):
    """темы: одна группа — список через «; », несколько групп (предметы по выбору) — по группе на строку"""
    g = blist(s)
    return [x.strip() for x in g[0].split("; ")] if len(g) == 1 else g
def ze_num(it): return str(it["ze"]) if it["ze"] else "—"
def start_sem(s):
    m = re.search(r"\d", str(s)); return int(m.group()) if m else 0
def chips(it):
    c = it["controls"] or ""; out = []
    if "КП" in c: out.append(("курсовой проект", 1))
    if "КР" in c: out.append(("курсовая работа", 1))
    if it["lab"]: out.append(("лабораторные", 0))
    if "Эк" in c: out.append(("экзамен", 0))
    return out
STATUS = {"проверено": ("Проверено преподавателем","ok"), "черновик": ("Черновик команды","draft"), "готовится": ("Описание готовится","wip")}
def cut(t, k=38):
    t = re.sub(r"^ДВ:\s*", "", t); return t if len(t) <= k else t[:k].rsplit(" ", 1)[0] + "…"
def clean(name): return re.sub(r"^ДВ:\s*", "", name).replace(" / ", " или ")
def load_bar(it):
    tot = it["hours"] or 0
    if not tot: return ""
    lec, lab, pr, contact = (it[k] or 0 for k in ("lec","lab","pr","contact")); sr = max(tot - contact, 0)
    segs = [("Лекции",lec,"s1"),("Лабораторные",lab,"s2"),("Практика",pr,"s3"),("Самостоятельно и контроль",sr,"s4")]
    if not (lec or lab or pr): segs = [("Контактная работа",contact,"s1"),("Самостоятельно и контроль",sr,"s4")]
    bar = "".join(f'<i class="{c}" style="width:{v/tot*100:.1f}%" title="{l}: {v} ч"></i>' for l,v,c in segs if v)
    leg = "".join(f'<li><i class="{c}"></i>{l} {v} ч</li>' for l,v,c in segs if v)
    return f'<div class="bar" role="img" aria-label="Распределение часов">{bar}</div><ul class="leg">{leg}</ul>'
def rating_block(slug):
    r = ratings.get(slug); nn = (r or {}).get("n", 0)
    if not r or nn < MIN_N:
        return f'<p class="muted">Оценок студентов пока недостаточно ({nn} из {MIN_N} нужных для показа). Опрос продолжается.</p>'
    def m(t, v): return f'<div class="meter"><b>{v}</b><span>{t}</span></div>' if v is not None else ""
    scope = E(r.get("scope","")) or "студенты, прошедшие предмет"
    inter = f'<div class="meter"><b>{r["interest"]}</b><span>раз отмечен среди самых интересных</span></div>' if r.get("interest") else ""
    return f'<div class="meters">{m("Сложность, 1–5",r.get("hard"))}{m("Польза для профессии, 1–5",r.get("useful"))}{inter}</div><p class="muted" style="margin-top:10px">Ответили: {nn}. Оценили: {scope}. Медианные значения.</p>'
ICON_BODY = '<rect x="2" y="2" width="60" height="60" rx="14" fill="#3B86D4" stroke="#174A82" stroke-width="3"/><path d="M15 48.5 C 24 48.5, 20 34, 30 34 S 40 30, 46 27" fill="none" stroke="#174A82" stroke-width="8" stroke-linecap="round"/><path d="M15 48.5 C 24 48.5, 20 34, 30 34 S 40 30, 46 27" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="15" cy="48.5" r="8.6" fill="#fff" stroke="#174A82" stroke-width="2.4"/><circle cx="30" cy="34" r="8.2" fill="#fff" stroke="#174A82" stroke-width="2.4"/><g transform="translate(15 48.5)" fill="none" stroke="#174A82" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M-4.6 -3.4 H4.6"/><path d="M-2.1 -3.4 V3.6"/><path d="M2.1 -3.4 V1.7 Q2.1 3.7 4.1 3.7"/></g><g transform="translate(30 34)" fill="none" stroke="#174A82" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M0 -2.5 C-1.6 -3.8 -3.6 -3.9 -5.1 -3.1 V3.1 C-3.6 2.4 -1.6 2.5 0 3.7 C1.6 2.5 3.6 2.4 5.1 3.1 V-3.1 C3.6 -3.9 1.6 -3.8 0 -2.5 Z"/><path d="M0 -2.5 V3.7"/></g><path d="M47 8 c-6.3 0-11 4.6-11 10.6 0 7.4 11 18.4 11 18.4 s11-11 11-18.4 C58 12.6 53.3 8 47 8 z" fill="#174A82" stroke="#174A82" stroke-width="2.4" stroke-linejoin="round"/><circle cx="47" cy="18.6" r="4" fill="#fff" stroke="#174A82" stroke-width="2"/>'
LOGO_SVG = '<svg class="tmlogo" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + ICON_BODY + '</svg>'
HERO3D = ('<div class="hero3d" aria-hidden="true"><span class="g3 ring"></span><span class="g3 plate"></span><span class="g3 cube">'
          '<svg viewBox="0 0 64 64">' + ICON_BODY + '</svg></span></div>')

SITE = "TeachMap"; SITE_URL = "https://veben88.github.io/uchebny-plan/"
# Разделы верхнего меню (компьютер): логотип ведёт на стартовый экран; путь по семестрам — часть «Карты»,
# план таблицей и страницы предметов — часть «Дисциплин», служебные страницы — часть «Настроек».
NAV = (("map", "map.html", "Карта", "FaCompass"), ("cat", "catalog.html", "Дисциплины", "FaBookOpen"), ("jobs", "jobs.html", "Профессии", "FaBriefcase"),
       ("profile", "profile.html", "Профиль", "FaUserGraduate"), ("settings", "settings.html", "Настройки", "FaCog"))
NAV_OF = {"home": "map", "map": "map", "cat": "cat", "plan": "cat", "jobs": "jobs", "profile": "profile", "settings": "settings", "road": "settings", "about": "settings", "fb": "settings"}
def head_nav(depth, active, band=False):
    b = "../"*depth; cur = NAV_OF.get(active, "")
    links = "".join(f'<a href="{b}{h}"{" aria-current=page" if k == cur else ""}{" class=nset" if k == "settings" else ""}><span class="ni" aria-hidden="true">{ic(i)}</span><span class="nt">{t}</span><span class="ns" aria-hidden="true">{t}</span></a>' for k, h, t, i in NAV)
    return (f'<header class="top wrap"><a class="brand" href="{b}index.html">{LOGO_SVG}<span class="bw"><b>Teach<em>Map</em></b><small>учебный план простым языком</small></span><span class="vh">, стартовый экран</span></a>'
            f'<nav class="menu" aria-label="Разделы">{links}</nav></header>' + app_bar(depth, active))
# ---- мобильная версия как приложение: верхняя панель (назад, раздел, поиск, настройки) и нижние вкладки ----
# На экранах шире 700 px не показываются (style.css), там остаётся обычное верхнее меню.
APP = {  # раздел: (заголовок панели, куда ведёт «назад» без истории, вкладка)
 "home": ("Путь по семестрам", "map.html", "map"), "map": ("Образовательная карта", "index.html", "map"),
 "cat": ("Дисциплины", "index.html", "cat"), "jobs": ("Профессии", "index.html", "jobs"), "profile": ("Мой план", "index.html", "profile"),
 "plan": ("План таблицей", "catalog.html", "cat"), "road": ("Развитие сайта", "index.html#settings", ""), "about": ("О проекте", "index.html#settings", ""),
 "fb": ("Обратная связь", "index.html#settings", ""), "settings": ("Настройки", "index.html", ""), "": ("TeachMap", "index.html", "")}
TABS = (("start", "index.html", "Главная", "FaUniversity"), ("map", "map.html", "Карта", "FaCompass"), ("cat", "catalog.html", "Дисциплины", "FaBookOpen"),
        ("jobs", "jobs.html", "Профессии", "FaBriefcase"), ("profile", "profile.html", "Профиль", "FaUserGraduate"))
MENU_X = (("path.html#journey", "Путь по семестрам", "FaMapMarkedAlt"), ("plan.html", "План таблицей и CSV", "FaChartBar"), ("settings.html", "Настройки", "FaCog"),
          ("about.html", "О проекте", "FaLightbulb"), ("roadmap.html", "Развитие сайта", "FaRocket"), ("feedback.html", "Обратная связь", "FaCommentDots"))
def app_menu(depth):
    """Мобильное меню ☰ (полноэкранное, как пауза в игре): основные разделы и «Дополнительно». Разметка при сборке — без сдвига страницы."""
    b = "../" * depth
    main_ = "".join(f'<li><a class="am-i" href="{b}{h}"><span class="am-ic" aria-hidden="true">{ic(i)}</span>{t}</a></li>'
                    for k, h, t, i in TABS)
    extra = "".join(f'<li><a class="am-x" href="{b}{h}"><span class="am-ic" aria-hidden="true">{ic(i)}</span>{t}</a></li>' for h, t, i in MENU_X)
    return (f'<div class="appmenu" id="appmenu" role="dialog" aria-modal="true" aria-label="Меню" hidden><div class="am-top"><span class="am-logo">{LOGO_SVG}<span>Teach<em>Map</em></span></span>'
            '<button type="button" class="am-close" data-am-close aria-label="Закрыть меню"><span aria-hidden="true">×</span></button></div>'
            f'<nav aria-label="Разделы"><ul class="am-l">{main_}</ul><p class="am-h">Дополнительно</p><ul class="am-l am-lx">{extra}</ul></nav>'
            '<p class="am-note">Справочный студенческий проект, не официальный сайт ДВФУ.</p></div>')
def tab_bar(depth, tab):
    b = "../" * depth
    return ('<nav class="tabbar" aria-label="Разделы приложения">' + "".join(
        f'<a href="{b}{h}"{" aria-current=page" if k == tab else ""}><span class="ti" aria-hidden="true">{ic(i)}</span><span class="tt">{t}</span></a>' for k, h, t, i in TABS) + '</nav>')
def app_bar(depth, active):
    b = "../" * depth; title, up, tab = APP.get(active, APP[""])
    if depth and active == "cat": title, up = "Дисциплина", "catalog.html"     # страница предмета: «назад» к списку
    search = "" if active == "cat" and not depth else f'<a class="ab-i" href="{b}catalog.html" aria-label="Найти предмет">{ic("FaSearch")}</a>'
    return (f'<header class="appbar"><a class="ab-back" href="{b}{up}" data-back aria-label="Назад"><span aria-hidden="true">‹</span></a>'
            f'<p class="ab-t">{E(title)}</p>{search}<button type="button" class="ab-i ab-menu" data-am-open aria-controls="appmenu" aria-expanded="false" aria-label="Меню"><span class="am-burger" aria-hidden="true"><i></i><i></i><i></i></span></button></header>' + tab_bar(depth, tab))
def footer_html(b=""):
    contact = f'<p>Контакты: {E(CONTACT)}</p>' if CONTACT else ""
    contact += (f'<p class="flinks"><a href="{b}plan.html">Учебный план таблицей и CSV</a> · <a href="{b}about.html">О проекте</a> · <a href="{b}roadmap.html">Развитие сайта</a>'
                + (f' · <a href="{b}feedback.html">Обратная связь</a>' if FB_ON else "") + f' · <a href="{b}settings.html">Настройки</a></p>')
    return (f'<footer><div class="wrap"><p><b>TeachMap: проект студентов ДВФУ.</b> Это не официальный сайт вуза: информация справочная и не заменяет рабочий учебный план и консультацию приёмной комиссии.</p>'
            f'<p>Источник данных: {E(meta["plan"])}, {E(meta["approved"])}. Данные сверены {E(meta["checked"])}.</p>{contact}</div></footer>')
def page(title, desc, body, depth=0, live=False, path=False, form=False, graph=False, jobs=False, plan=False, start=False, head=""):
    b = "../"*depth
    lm = f'<meta name="ratings-url" content="{E(RATINGS_URL)}">' if (live and RATINGS_URL) else ""
    lj = f'<script src="{b}assets/live.js?v={ASSET_V}" defer></script>' if (live and RATINGS_URL) else ""
    fm = f'<meta name="feedback-url" content="{E(FEEDBACK_URL)}">' if (FEEDBACK_URL and (live or path or form)) else ""
    if FEEDBACK_URL and (live or path): fm += f'<meta name="feedback-page" content="{b}feedback.html">'
    if form and not FEEDBACK_URL: fm += '<meta name="robots" content="noindex">'
    if FEEDBACK_URL and (live or path): lj += f'<script src="{b}assets/feedback.js?v={ASSET_V}" defer></script>'
    if live or path: lj += f'<script src="{b}assets/tasks.js?v={ASSET_V}" defer></script>'
    if form: lj += f'<script src="{b}assets/form.js?v={ASSET_V}" defer></script>'
    if path: lj += f'<script src="{b}assets/path.js?v={ASSET_V}" defer></script>'
    if graph: lj += f'<script src="{b}assets/graph.js?v={ASSET_V}" defer></script>'
    if jobs: lj += f'<script src="{b}assets/jobs.js?v={ASSET_V}" defer></script>'
    if plan: lj += f'<script src="{b}assets/plan.js?v={ASSET_V}" defer></script>'
    if start: lj += f'<script src="{b}assets/start.js?v={ASSET_V}" defer></script>'
    return f'''<!doctype html><html lang="ru"><head><meta charset="utf-8">{head}<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{E(title)}</title><meta name="description" content="{E(desc)}"><meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}"><meta name="theme-color" content="#173B70"><link rel="manifest" href="{b}manifest.webmanifest"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="TeachMap"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="tm-jobs" content="{",".join(JOB_IDS)}">{lm}{fm}
<link rel="icon" type="image/svg+xml" href="{b}assets/logo-icon.svg"><link rel="apple-touch-icon" href="{b}assets/apple-touch-icon.png"><meta property="og:site_name" content="TeachMap"><meta property="og:image" content="{SITE_URL}assets/og.png"><meta property="og:type" content="website">
<link rel="preload" href="{b}assets/fonts/montserrat-core.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="{b}assets/fonts/oswald-cyrillic.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="{b}assets/fonts/oswald-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="{b}assets/style.css?v={ASSET_V}"><script>document.documentElement.classList.add("tm-js");try{{if(localStorage.getItem("tm-motion")==="off")document.documentElement.classList.add("tm-still")}}catch(x){{}}try{{if(sessionStorage.getItem("tmFocus")){{sessionStorage.removeItem("tmFocus");document.documentElement.classList.add("tm-focus");addEventListener("load",function(){{setTimeout(function(){{document.documentElement.classList.remove("tm-focus")}},900)}})}}}}catch(x){{}}try{{var n=navigator,c=n.connection||{{}};if(c.saveData||n.deviceMemory&&n.deviceMemory<=2||n.hardwareConcurrency&&n.hardwareConcurrency<=2||/^(slow-2g|2g)$/.test(c.effectiveType||""))document.documentElement.classList.add("tm-lite")}}catch(x){{}}var tmS=document.documentElement.classList.contains("tm-still");try{{if(!tmS&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("tm-pre")}}catch(x){{}}try{{if(!tmS&&sessionStorage.getItem("tmNav")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("tm-navwait")}}catch(x){{}}addEventListener("pagereveal",function(e){{var d;try{{d=sessionStorage.getItem("tmDir");sessionStorage.removeItem("tmDir")}}catch(x){{}}var a=window.navigation&&navigation.activation;if(a&&a.navigationType==="traverse"&&a.from&&a.entry)d=a.entry.index<a.from.index?"back":"fwd";if(e.viewTransition&&/tm-lite|tm-still/.test(document.documentElement.className)){{try{{e.viewTransition.skipTransition()}}catch(x){{}}return}}if(d&&e.viewTransition&&e.viewTransition.types)try{{e.viewTransition.types.add(d)}}catch(x){{}}}})</script></head><body>
<a class="skip" href="#main">К содержимому</a>{body.replace('<div class="heroblock">', '<div class="heroblock">' + HERO3D)}{footer_html(b)}{app_menu(depth)}<script src="{b}assets/profile.js?v={ASSET_V}" defer></script><script src="{b}assets/app.js?v={ASSET_V}" defer></script>{lj}<script src="{b}assets/motion.js?v={ASSET_V}" defer></script></body></html>'''
def job_roles():
    """для каталога: профессии, где предмет ключевой, и где он нужен для ключевых (те же данные, что на карте профессий)"""
    key, anc = {}, {}
    for k, j in enumerate(JOBS):
        for s in j[3]: key.setdefault(s, []).append(k)
        for s in need_ancestors(j[3]): anc.setdefault(s, []).append(k)
    return key, anc
KIND = (("o", "Обязательные", "FaClipboardCheck"), ("v", "По выбору", "FaLayerGroup"), ("f", "Факультативы", "FaLightbulb"))
def kind_of(it): return "v" if it["type"] == "По выбору" else "f" if it["type"] == "Факультатив" else "o"
def courses_of(it): return sorted({(x + 1) // 2 for x in sem_list(it["sem"])})
def course_line(it):
    """«1 курс · 1 семестр», «1 курс · 1–2 семестры», «2–3 курс · 4, 6 семестры» — из семестров плана"""
    cs, ss = courses_of(it), sem_list(it["sem"])
    if not cs: return f'{E(str(it["sem"]))} семестр'
    c = str(cs[0]) if len(cs) == 1 else f"{cs[0]}–{cs[-1]}"
    return f'{c} курс · {E(str(it["sem"]))} {"семестр" if len(ss) == 1 else "семестры"}'
def card_html(it, c, jk=None, ja=None):
    """строка каталога: миниатюра раздела, название, курс и семестр, нагрузка, метки; данные для фильтров — в data-атрибутах"""
    st = c["status"] if c["status"] in STATUS else "готовится"; g = gi(it); s = it["slug"]
    ch = "".join(f'<span class="chip{" hot" if h else ""}">{t}</span>' for t,h in chips(it))
    label = ("По выбору: " if it["type"] == "По выбору" else "") + clean(it["name"])
    keys, ancs = (jk or {}).get(s, []), (ja or {}).get(s, [])
    comps = sorted({x for r in RP.get(s, []) for x in (r.get("competencies") or [])})
    kd = kind_of(it); kname = {"o": "Обязательная", "v": "По выбору", "f": "Факультатив"}[kd]
    # поиск: текст карточки, профессии, для которых предмет ключевой, и коды компетенций по рабочей программе
    hay = E((it["name"]+" "+c["what"]+" "+c["brief"]+" "+c["learn"]+" "+c["themes"]+" "+c["tools"]+" "+" ".join(JOBS[k][1] for k in keys)+" "+" ".join(comps)).lower().replace("ё","е"))
    return (f'<article class="card crow" data-slug="{s}" data-sems=" {" ".join(map(str, sem_list(it["sem"])))} " data-courses=" {" ".join(map(str, courses_of(it)))} " data-kind="{kd}" data-ze="{it["ze"] or 0}" data-name="{E(clean(it["name"]).lower().replace("ё","е"))}" data-group="{GKEYS[g]}" data-kr="{1 if re.search("К[РП]",it["controls"] or "") else 0}" data-lab="{1 if it["lab"] else 0}" '
            f'data-jk=" {" ".join(map(str, keys))} " data-ja=" {" ".join(map(str, ancs))} " data-text="{hay}">'
            f'<span class="cth g-{g}" aria-hidden="true"></span>'
            f'<div class="cbody"><h3><a class="cl" href="d/{s}.html">{E(label)}</a></h3><p class="cmeta">{course_line(it)}</p><p class="cmeta">{ze_num(it)} з.е. · {n(it["hours"])} ч</p>'
            f'<div class="chips"><span class="chip cg">{E(GKEYS[g])}</span><span class="chip ck k-{kd}">{kname}</span>{ch}<span class="chip jr" hidden></span></div></div>'
            f'<div class="cside"><span class="badge {STATUS[st][1]}">{STATUS[st][0]}</span><a class="cmap" href="map.html#node={s}" aria-label="{E(label)} на карте связей">На карте</a></div>'
            f'<span class="cgo" aria-hidden="true">›</span></article>')
SORT = lambda x: (start_sem(x["sem"]) or 99, gi(x), x["idx"])
def cat_preview_data(cards):
    """данные панели предпросмотра каталога: что это, формы контроля, контактные часы, связи и профессии (имена — из строк списка)"""
    out = {}
    for it in items:
        s = it["slug"]; c = cards[s]; up, down, _ = links_of(s)
        w = c["what"] or c["brief"] or ""
        out[s] = {"w": cut(w, 300) if len(w) > 300 else w, "k": it["controls"] or "", "c": it["contact"], "st": c["status"] if c["status"] in STATUS else "готовится",
                  "up": [[a, t] for a, t, _ in up], "dn": [[a, t] for a, t, _ in down], "j": [k for k, j in enumerate(JOBS) if s in j[3]]}
    return json.dumps(out, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
def home_page(cards):
    """«Дисциплины» (catalog.html): экран выбора как в игровом меню — слева фильтры со счётчиками, в центре список,
    справа (на широком экране) предпросмотр предмета под курсором. Адрес хранит состояние: ?q=&course=&kind=&sem=&group=&kr=&lab=&fav=&doing=&done=&job=&sort="""
    order = sorted(items, key=SORT); n_ready = sum(1 for c in cards.values() if c["what"])
    jk, ja = job_roles()
    jopt = '<option value="">любая</option>' + "".join(f'<option value="{k}">{E(j[1])}</option>' for k, j in enumerate(JOBS))
    def cf(f, v, icon, text, num, cls=""):
        return (f'<li><button type="button" class="cf{cls}" data-f="{f}" data-v="{v}" aria-pressed="false"><span class="cfi" aria-hidden="true">{icon}</span>'
                f'<span class="cft">{text}</span><b class="cfn" data-n>{num}</b></button></li>')
    ncourse = lambda k: sum(1 for i in items if k in courses_of(i))
    side = ('<nav class="catside" id="catside" aria-label="Фильтры дисциплин"><ul class="cfl">'
            f'<li><button type="button" class="cf cfall" data-f="all" data-v="" aria-pressed="true"><span class="cfi" aria-hidden="true">{ic("FaLayerGroup")}</span><span class="cft">Все</span><b class="cfn" data-n>{len(items)}</b></button></li>'
            + "".join(cf("course", k, f'<i class="cfnum">{k}</i>', f"{k} курс", ncourse(k)) for k in range(1, 5))
            + '</ul><ul class="cfl">' + "".join(cf("kind", k, ic(i_), t, sum(1 for i in items if kind_of(i) == k)) for k, t, i_ in KIND)
            + '</ul><p class="cfh">Разделы плана</p><ul class="cfl">' + "".join(cf("group", g, ic(GROUPS[g][1]), g, sum(1 for i in items if group_of(i["type"]) == g), f" g-{n_}") for n_, g in enumerate(GKEYS))
            + '</ul><p class="cfh cfmy" hidden>Мои отметки</p><ul class="cfl">'
            + cf("fav", "1", "★", "Избранное", "", " mypill") + cf("doing", "1", "•", "Изучаю", "", " mypill") + cf("done", "1", "✓", "Пройдено", "", " mypill")
            + '</ul></nav>')
    sems = sorted({x for i in items for x in sem_list(i["sem"])})
    pills = "".join(f'<button type="button" class="pill" data-f="sem" data-v="{x}" aria-pressed="false">{x}<small>сем.</small></button>' for x in sems)
    survey = f' <a href="{E(SURVEY_URL)}">Пройти опрос студентов</a>' if SURVEY_URL else ""
    head = (f'<div class="cathead"><div class="wrap"><nav class="crumbs" aria-label="Путь"><a href="index.html">TeachMap</a> › Дисциплины</nav><h1>Дисциплины</h1>'
            f'<p class="lead">Учебный план 27.03.01 «Стандартизация и метрология» простым языком: {len(items)} позиций плана, описания готовы для {n_ready}. '
            f'У остальных пока только нагрузка из плана.{survey}</p>'
            f'<div class="catq"><input id="q" type="search" placeholder="Предмет, тема, профессия или код компетенции" aria-label="Поиск по предметам, темам, профессиям и кодам компетенций"></div></div></div>')
    tools = (f'<div class="ctools"><div class="sems" role="group" aria-label="Семестр">{pills}</div>'
             '<div class="tools"><button type="button" class="pill" data-f="kr" data-v="1" aria-pressed="false">Есть курсовая</button><button type="button" class="pill" data-f="lab" data-v="1" aria-pressed="false">С лабораторными</button>'
             f'<label class="sortl">Профессия <select id="fjob">{jopt}</select></label><label class="sortl">Порядок <select id="sort"><option value="">как в плане</option><option value="name">по названию</option><option value="ze">по трудоёмкости</option></select></label>'
             '<button type="button" class="btn-o" id="reset" hidden>Сбросить всё</button></div></div>')
    cview = ('<div class="cview" id="cview" role="group" aria-label="Представление списка">'
             + "".join(f'<button type="button" class="cvb" data-view="{v}" aria-pressed="{"true" if not v else "false"}">{t}</button>' for v, t in (("", "Список"), ("sem", "По семестрам"), ("group", "По разделам"))) + '</div>')
    lst = (f'<section class="catlist" id="list" aria-labelledby="listh"><h2 class="vh" id="listh">Список дисциплин</h2>{tools}'
           f'{cview}<p class="cntrow"><button type="button" class="btn-o cfbtn" id="cfbtn" aria-controls="cfsheet" aria-expanded="false">Фильтры <b hidden></b></button><span id="count" class="muted" aria-live="polite">Показано: {len(items)} из {len(items)}</span><a class="btn-o" href="plan.html">План таблицей и CSV</a><a class="btn-o" id="jobmap" href="map.html" hidden>{ic("FaCompass")} Этот путь на карте связей</a></p>'
           '<p class="muted jobnote" id="jobnote" hidden>Показан путь к профессии: <b>ключевые</b> предметы и те, что <b>нужны для ключевых</b>. Это оценка команды проекта по задачам профессии, а не официальный перечень и не гарантия трудоустройства.</p>'
           f'<div class="grid clist" id="grid">{"".join(card_html(i, cards[i["slug"]], jk, ja) for i in order)}</div>'
           '<div id="empty" hidden><p class="muted">Ничего не нашлось. Попробуй другое слово или сбрось фильтры.</p><button type="button" class="btn-o" id="reset2">Сбросить поиск и фильтры</button></div></section>')
    prev = ('<aside class="cprev" id="cprev" aria-label="Выбранный предмет" hidden><div id="cpv"></div></aside>'
            f'<script type="application/json" id="cpd">{cat_preview_data(cards)}</script>')
    body = head_nav(0, "cat") + f'<main id="main" class="catpage">{head}<div class="wrap catgrid">{side}{lst}{prev}</div></main>'
    return page("Все дисциплины 27.03.01 Стандартизация и метрология ДВФУ · TeachMap","Понятное описание дисциплин направления 27.03.01 ДВФУ: что изучают, нагрузка и оценки студентов", body)
LINK_T = {"need": ("нужен", "Без этого предмета трудно начать"), "helps": ("помогает", "Полезная опора")}
COMP = {"УК": "универсальные", "ОПК": "общепрофессиональные", "ПК": "профессиональные"}
def links_of(slug):
    """связи предмета: на что опирается (up) и для чего пригодится (down); сначала «нужен», затем по семестру"""
    by = {i["slug"]: i for i in items}
    key = lambda s_t: (s_t[1] != "need", start_sem(by[s_t[0]]["sem"]), by[s_t[0]]["idx"])
    up = sorted(((l["from"], l["type"], l["why"]) for l in LINKS if l["to"] == slug), key=key)
    down = sorted(((l["to"], l["type"], l["why"]) for l in LINKS if l["from"] == slug), key=key)
    return up, down, by
def links_panel(slug):
    up, down, by = links_of(slug)
    if not up and not down: return ""
    def col(title, lst, empty):
        if not lst: return f'<div><h3 class="lkh">{title}</h3><p class="muted">{empty}</p></div>'
        li = "".join(f'<li><a href="{s}.html">{E(clean(by[s]["name"]))}</a> <span class="lkt {t}" title="{LINK_T[t][1]}">{LINK_T[t][0]}</span>'
                     f'<small>{E(str(by[s]["sem"]))} сем. · {E(w)}</small></li>' for s, t, w in lst)
        return f'<div><h3 class="lkh">{title}</h3><ul class="lk">{li}</ul></div>'
    return (f'<section class="panel" id="links"><h2><span class="ci">{ic("FaCompass")}</span>Связи с другими предметами</h2><div class="lk2">'
            + col("Опирается на", up, "Связей пока не отмечено.")
            + col("Пригодится для", down, "Связей пока не отмечено.")
            + '</div><p class="muted lknote"><span class="lkt need">нужен</span> без этого предмета трудно начать, <span class="lkt helps">помогает</span> полезная опора. '
              'Связи составлены командой проекта по содержанию предметов: это логические предположения, а не официальные требования учебного плана.</p>'
            f'<p class="hlinks2"><a class="btn-s" href="../path.html#route={slug}">{ic("FaMapMarkedAlt")} Показать маршрут на пути студента</a><a class="btn-o" href="../map.html#node={slug}">{ic("FaCompass")} На карте связей</a></p></section>')
def jobs_panel(slug):
    js = [(k, j) for k, j in enumerate(JOBS) if slug in j[3]]
    if not js: return ""
    ch = "".join(f'<a class="kchip" href="../jobs.html#job-{k}">{E(j[1])}</a>' for k, j in js)
    return (f'<section class="panel"><h2><span class="ci">{ic("FaUserGraduate")}</span>Ведёт к профессиям</h2><div class="ks">{ch}</div>'
            '<p class="muted" style="margin-top:10px">Это оценка команды проекта по задачам профессии, а не гарантия трудоустройства: требования работодателей смотри в вакансиях.</p></section>')
def rp_panel(it):
    """Компетенции из рабочих программ. Цель дисциплины не выводится: при извлечении текста из документов
    в части целей перепутан порядок слов, и показывать их как цитату нельзя. Коды компетенций — структурные данные."""
    rs = RP.get(it["slug"]) or []
    order = lambda c: (list(COMP).index(c.split("-")[0]) if c.split("-")[0] in COMP else 9, c)
    sets = [sorted(set(r.get("competencies") or []), key=order) for r in rs]
    if not any(sets): return ""
    def chips(cs): return '<div class="ks">' + "".join(f'<span class="kchip ccode">{E(c)}</span>' for c in cs) + '</div>'
    same = all(s_ == sets[0] for s_ in sets)
    if len(rs) > 1 and not same:   # у вариантов предмета по выбору разные компетенции — показываем по вариантам
        body = "".join(f'<p class="lkh">{E(r["title"])}</p>{chips(s_)}' for r, s_ in zip(rs, sets) if s_)
    else: body = chips(next(s_ for s_ in sets if s_))
    allc = {c for s_ in sets for c in s_}
    kinds = sorted({c.split("-")[0] for c in allc if c.split("-")[0] in COMP}, key=list(COMP).index)
    note = " У обоих вариантов предмета по выбору компетенции одинаковые." if len(rs) > 1 and same else ""
    progs = "; ".join(f'{E(r["code"].replace("_", "."))}' + (f' от {E(r["date"])}' if r.get("date") else "") for r in rs if r.get("code"))
    return (f'<section class="panel" id="rp"><h2><span class="ci">{ic("FaBullseye")}</span>Компетенции по рабочей программе</h2>{body}'
            f'<p class="muted" style="margin-top:10px">Коды индикаторов компетенций из образовательного стандарта'
            + (f' ({"; ".join(k + " — " + COMP[k] for k in kinds)})' if kinds else "") + f'.{note} Источник: {E(RP_SRC)}' + (f', {"программы" if len(rs) > 1 else "программа"} {progs}' if progs else "") + '.</p></section>')
def task_panel(c, slug):
    if not c["example"]: return ""
    note = '' if c["status"] == "проверено" else '<p class="muted" style="margin-top:8px">Черновик задания: формулировку проверит преподаватель.</p>'
    ans = f'<details class="ans"><summary>Что это показывает</summary><p>{E(c["answer"])}</p></details>' if c["answer"] else ""
    return (f'<section class="panel"><h2><span class="ci">{ic("FaChalkboardTeacher")}</span>Попробуй сам</h2><p>{E(c["example"])}</p>'
            f'<div class="task" data-task="{E(slug)}"></div>{ans}{note}</section>')
def disc_art(slug, g, icon=None):
    """иллюстрация шапки предмета: свои грани, осколки света и созвездие (как фон карты), значок раздела плана; у каждого предмета свой узор"""
    import random
    rnd = random.Random(int(hashlib.md5(slug.encode()).hexdigest()[:8], 16))
    W, H, C, R = 600, 360, 5, 3
    pts = [[(c * W / C + (rnd.uniform(-40, 40) if 0 < c < C else 0), r * H / R + (rnd.uniform(-30, 30) if 0 < r < R else 0)) for c in range(C + 1)] for r in range(R + 1)]
    out = []
    for r in range(R):
        for c in range(C):
            a, b, d, e = pts[r][c], pts[r][c + 1], pts[r + 1][c], pts[r + 1][c + 1]
            for t in ((a, b, e), (a, e, d)) if (r + c) % 2 else ((a, b, d), (b, e, d)):
                cls, op = ("f1", rnd.uniform(.04, .16)) if rnd.random() < .5 else ("f0", rnd.uniform(.06, .24))
                out.append(f'<path class="{cls}" d="M{" ".join(f"{x:.0f},{y:.0f}" for x, y in t)}Z" opacity="{op:.2f}"/>')
    stars = [(rnd.uniform(20, W - 20), rnd.uniform(20, H - 20)) for _ in range(12)]
    lines = " ".join(f"M{stars[i][0]:.0f},{stars[i][1]:.0f}L{stars[i + 1][0]:.0f},{stars[i + 1][1]:.0f}" for i in range(0, len(stars) - 1, 2))
    dots = "".join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{2.6 if n % 4 == 0 else 1.6}"/>' for n, (x, y) in enumerate(stars))
    return (f'<div class="dart g-{g}" aria-hidden="true"><svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice"><g>{"".join(out)}</g>'
            f'<path class="dl" d="M600,0 L330,360 H420 L600,110Z" opacity=".12"/><path class="ln" d="{lines}"/><g class="st">{dots}</g></svg><span class="dicon">{ic(icon or GROUPS[GKEYS[g]][1])}</span></div>')
def disc_page(it, c, order, k):
    """страница предмета: шапка как в референсе (крошки, название, курс и семестр, нагрузка, описание, «Мой статус» и «Избранное»,
    своя иллюстрация со срезом) и вкладки. Без скрипта все разделы идут подряд; вкладки строит app.js из секций .dtab."""
    st = c["status"] if c["status"] in STATUS else "готовится"; name = clean(it["name"]); g = gi(it); s = it["slug"]
    def panel(icon, t, v): return f'<section class="panel"><h2><span class="ci">{ic(icon)}</span>{t}</h2><p>{E(v)}</p></section>' if v else ""
    def panel_ul(icon, t, items): return f'<section class="panel"><h2><span class="ci">{ic(icon)}</span>{t}</h2><ul class="bl">' + "".join(f"<li>{E(x)}</li>" for x in items) + "</ul></section>" if items else ""
    lead = c["what"] or c["brief"]
    kd = kind_of(it); kname = {"o": "Обязательная", "v": "По выбору", "f": "Факультатив"}[kd]
    cs = courses_of(it); cq = f'<a href="../catalog.html?course={cs[0]}">{cs[0]} курс</a> › ' if len(cs) == 1 else ""
    # «О дисциплине»: зачем, чему научишься, совет студента; справа — коротко о связях и профессиях; внизу оценки и отзыв
    up, down, by = links_of(s)
    rel = up + down
    side_l = "".join(f'<li><a href="{x}.html">{E(clean(by[x]["name"]))}</a><span class="lkt {t}">{LINK_T[t][0]}</span></li>' for x, t, _ in rel[:5])
    js = [(kk, j) for kk, j in enumerate(JOBS) if s in j[3]]
    side = ('<aside class="dside">'
            + (f'<section class="panel dsum"><h2><span class="ci">{ic("FaCompass")}</span>Связанные дисциплины</h2><ul class="dsl">{side_l}</ul>'
               + (f'<p class="muted">и ещё {len(rel) - 5}</p>' if len(rel) > 5 else "") + '<p><a class="dmore" href="#t-links">Все связи и маршрут →</a></p></section>' if rel else "")
            + (f'<section class="panel dsum"><h2><span class="ci">{ic("FaUserGraduate")}</span>Ключевой для профессий</h2><div class="ks">'
               + "".join(f'<a class="kchip" href="../jobs.html#job-{kk}">{E(j[1])}</a>' for kk, j in js) + '</div></section>' if js else "")
            + '</aside>')
    about_main = panel("FaLightbulb", "Зачем нужно в профессии", c["why"]) + panel_ul("FaStar", "Чему научишься", blist(c["learn"])) + panel("FaUsers", "Совет студента", c["tip"])
    if not about_main.strip():
        about_main = f'<section class="panel"><h2><span class="ci">{ic("FaBookOpen")}</span>О дисциплине</h2><p class="muted">Подробное описание этой дисциплины готовится. Пока есть нагрузка и формы контроля из учебного плана и связи с другими предметами.</p></section>'
    fb = f'<section class="panel" id="fb" data-slug="{s}"></section>' if FEEDBACK_URL else ""
    about = (f'<div class="dgrid"><div class="dcol">{about_main}</div>{side}</div>'
             f'<section class="panel" id="ratings" data-slug="{s}"><h2><span class="ci">{ic("FaStar")}</span>Оценки студентов</h2>{rating_block(s)}</section>{fb}')
    topics = (panel_ul("FaBookOpen", "Темы курса", tlist(c["themes"])) + panel("FaChalkboardTeacher", "Что делаешь на занятиях", c["acts"])
              + panel_ul("FaTools", "Инструменты и оборудование", blist(c["tools"])) + panel("FaClipboardCheck", "Как проверяют", c["assess"]) + task_panel(c, s))
    comp = jobs_panel(s) + rp_panel(it)
    load = (f'<section class="panel"><h2><span class="ci">{ic("FaChartBar")}</span>Нагрузка по плану</h2>{load_bar(it)}<p>Контактных часов: <b>{n(it["contact"])}</b> из {n(it["hours"])}. Формы контроля: <b>{E(it["controls"] or "—")}</b> <span class="muted">(Эк — экзамен, За — зачёт, ЗаО — зачёт с оценкой, КР — курсовая работа, КП — курсовой проект, К — контрольная, Оц — оценка, РГР — расчётно-графическая работа)</span></p>'
            f'<p class="hlinks2"><a class="btn-o" href="../plan.html#cmp={s},{order[k+1]["slug"] if k+1 < len(order) else order[k-1]["slug"]}">Сравнить с другой дисциплиной</a><a class="btn-o" href="../plan.html">Весь план таблицей</a></p></section>')
    notes = (f'<section class="panel" id="mynotes" hidden><h2><span class="ci">{ic("FaCommentDots")}</span>Мои заметки</h2><label class="vh" for="mynote">Заметка к предмету</label><textarea id="mynote" class="mynote" rows="4" maxlength="2000" placeholder="Например: что повторить перед экзаменом, вопросы преподавателю"></textarea>'
             '<p class="muted mystat" aria-live="polite">Заметка хранится только в этом браузере и никуда не отправляется.</p></section>')
    tabs = [("about", "О дисциплине", about), ("topics", "Темы и занятия", topics), ("links", "Связанные дисциплины", links_panel(s)),
            ("comp", "Компетенции и профессии", comp), ("load", "Нагрузка", load), ("notes", "Мои заметки", notes)]
    tabs_html = "".join(f'<section class="dtab" id="t-{tid}" data-tab="{tt}" aria-label="{tt}">{body}</section>' for tid, tt, body in tabs if body.strip())
    prev = f'<a href="{order[k-1]["slug"]}.html">← {E(cut(order[k-1]["name"]))}</a>' if k else "<span></span>"
    nxt = f'<a href="{order[k+1]["slug"]}.html">{E(cut(order[k+1]["name"]))} →</a>' if k+1 < len(order) else ""
    body = f'''<div class="band dband">{head_nav(1,"cat")}<div class="wrap"><nav class="crumbs" aria-label="Путь"><a class="dback" href="../catalog.html" aria-label="К списку дисциплин">‹</a><a href="../catalog.html">Дисциплины</a> › {cq}<span aria-current="page">{E(cut(name, 60))}</span></nav>
<div class="dhero"><div class="dhtext"><p class="dkick">{E(GKEYS[g])} · {kname}</p><h1>{E(("По выбору: " if it["type"]=="По выбору" else "")+name)}</h1>
<p class="dmeta">{course_line(it)}</p><p class="dmeta">{ze_num(it)} з.е. · {n(it["hours"])} ч</p>
<p class="dlead{"" if lead else " muted"}">{E(lead) if lead else "Описание этой дисциплины готовится."}</p>
<p class="meta">{E(it["idx"])} · {E(it["type"])} · {n(it["ze"]) or "вне"} з.е. · {n(it["hours"])} ч · {E(str(it["sem"]))} семестр</p><span class="badge {STATUS[st][1]}">{STATUS[st][0]}</span><div class="mybar" id="mybar" data-slug="{s}"></div></div>{disc_art(s, g)}</div></div></div>
<main id="main" class="wrap dmain"><div class="dtabs" id="dtabs" role="tablist" aria-label="Разделы страницы предмета" hidden></div>{tabs_html}
{f'<p class="muted fberr">Нашли ошибку в описании? <a href="../feedback.html?d={s}">Сообщить об ошибке</a></p>' if FB_ON else ""}
<nav class="pager" aria-label="Соседние предметы">{prev}{nxt}</nav></main>'''
    return page(f"{name}: что изучают и какая нагрузка · TeachMap", c["what"] or c["brief"] or name, body, 1, live=True)
# числа берутся из данных при сборке, чтобы не расходиться с сайтом
_N_TEXT = sum(1 for i in items if read_card(i["slug"])["what"])
STAGES = [
 ("1","Осень 2026","Запуск","now",[("done",f"Сайт со всеми {len(items)} позициями учебного плана"),("done","Поиск и фильтры: семестр, раздел, курсовые, лабораторные, сортировка"),("done","Связи между предметами и маршрут к предмету на пути студента"),("done","Карта профессий: маршрут к каждой профессии по семестрам"),("done","«Мой план»: избранное, отметки и заметки без регистрации"),("done","Экраны в духе игрового меню: стартовый экран, карта связей, «Дисциплины», «Профессии», «Профиль» и страница предмета с вкладками"),("done","Мобильная версия как приложение: нижняя панель и экраны на телефоне"),("done","Учебный план таблицей с печатью и выгрузкой CSV, сравнение двух дисциплин и двух профессий"),("done","Режим «Крупно» и «Меньше анимаций» в настройках"),("done","Оценки из опроса подгружаются в сайт автоматически раз в час (процесс сборки работает; число ответов зависит от опроса)"),("doing","Опрос студентов: минимум 5 ответов на предмет"),("doing",f"Описания карточек: готово {_N_TEXT} из {len(items)}"),("doing","Отправка отзывов: форма показывает результат по ответу сервиса; реальный приём проверяет автор проекта на опубликованном сайте"),("plan","Проверка описаний преподавателями"),("plan","Тест сайта на абитуриентах")]),
 ("2","2027","Пилот в ДВФУ","",[("plan","Кабинет института: правка и подтверждение описаний"),("plan","Право ответа кафедры на оценки"),("plan","Админка: правка текстов прямо на сайте"),("plan","Оценки по направлению и году поступления"),("plan","ИИ-анализ отзывов с проверкой человеком")]),
 ("3","2028","Вузы Владивостока","",[("plan","Поиск по всем программам вуза"),("plan","Сравнение двух направлений рядом"),("plan","Уроки для школ на базе карточек"),("plan","Сопоставление оценок с показателями дисциплин")]),
 ("4","2029–2031","Регион и Россия","",[("plan","Тест «подходит ли мне специальность»"),("plan","Поиск «от профессии к предметам»"),("plan","Версии на китайском и корейском"),("plan","Карта освоения компетенций"),("plan","Другие специальности и вузы")])]
ICON_OF = {"done":"FaCheck","doing":"FaSyncAlt","plan":"FaRegClock"}
def dark_head(body, crumb):
    """Шапка раздела в системе экранов (как у «Дисциплин»): тёмная полоса, крошки, заголовок, пояснение и, если были, кнопки.
    Заменяет прежнюю синюю обложку heroblock на служебных страницах; содержимое страницы не трогает."""
    m = re.search(r'<div class="heroblock"><div class="wrap"><section class="hero"><span class="line"></span><h1>(.*?)</h1>\s*(<p class="lead">.*?</p>)?\s*(<p class="hlinks">.*?</p>)?\s*(?:<div class="dots"[^>]*>.*?</div>)?\s*</section></div></div>', body, re.S)
    if not m: return body
    h1, lead, links = m.group(1), m.group(2) or "", m.group(3) or ""
    new = (f'<div class="cathead sechead"><div class="wrap"><nav class="crumbs" aria-label="Путь"><a href="index.html">TeachMap</a> › {crumb}</nav><h1>{h1}</h1>{lead}{links}</div></div>')
    return body[:m.start()] + new + body[m.end():]
def road_page():
    pr = "".join(f'<div class="pr"><span class="ci">{ic(i)}</span><h3>{t}</h3><p>{d}</p></div>' for i,t,d in (
        ("FaLightbulb","Понятно","Язык школьника вместо канцелярита: что изучают и зачем."),("FaClipboardCheck","Честно","У каждой карточки есть источник, дата и статус проверки. Оценки видны от 5 ответов."),
        ("FaUserLock","Безопасно","Опрос анонимный, на сайт попадает только сводка, личные данные не собираются."),("FaEye","Доступно","Работает на телефоне, без регистрации, есть крупный шрифт и высокий контраст.")))
    who = "".join(f'<div class="pr"><span class="ci">{ic(i)}</span><h3>{t}</h3><p>{d}</p></div>' for i,t,d in (
        ("FaUserGraduate","Абитуриенты","Бесплатно видят, что их ждёт на специальности, ещё до подачи документов."),("FaUsers","Студенты","Анонимно оценивают предметы и дают советы тем, кто придёт после."),("FaUniversity","Вузы и школы","Публикуют проверенные описания, получают обратную связь и материалы для профориентации.")))
    st = "".join(f'<div class="stage {s[3]}"><div class="num">{s[0]}</div><div class="box"><div class="when">{s[1]}{" · сейчас" if s[3] else ""}</div><h3>{s[2]}</h3><p class="stprog">Сделано {sum(1 for x in s[4] if x[0]=="done")} из {len(s[4])}</p><ul>'+"".join(f'<li class="{k}">{ic(ICON_OF[k])}<span>{E(t)}</span></li>' for k,t in s[4])+'</ul></div></div>' for s in STAGES)
    body = head_nav(0, "road") + f'''<main id="main"><div class="heroblock"><div class="wrap"><section class="hero"><span class="line"></span><h1>Как будет развиваться сайт</h1>
<p class="lead">Как сайт будет расти: от справочника по одной специальности до платформы, которая объясняет программы вузов региона.</p><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div></section></div></div><div class="wrap">
<h2 style="color:var(--pri)">Концепция</h2><p class="muted" style="max-width:70ch">Сайт переводит официальный учебный план на язык абитуриента и добавляет то, чего нет в документе: оценки студентов и примеры заданий. Четыре принципа:</p><div class="principles">{pr}</div>
<h2 style="color:var(--pri)">Для кого</h2><div class="principles">{who}</div>
<h2 style="color:var(--pri)">Этапы развития</h2><div class="legend"><span>{ic("FaCheck")}сделано</span><span>{ic("FaSyncAlt")}в работе</span><span>{ic("FaRegClock")}планируется</span></div><div class="road">{st}</div></div></main>'''
    body = dark_head(body, "Развитие сайта")
    return page("Развитие сайта · TeachMap","Концепция сайта и этапы развития: запуск, пилот в ДВФУ, вузы Владивостока, регион и Россия", body)

ROLES = [("school89","Школьник 8–9 класса"),("school1011","Школьник 10–11 класса"),("graduate","Выпускник школы или колледжа"),("student","Студент"),("parent","Родитель"),("teacher","Учитель или педагог-профориентатор"),("uni","Преподаватель или сотрудник вуза"),("other","Другое")]
def f_opts(name, opts, typ="radio"):
    return '<div class="fopts">' + "".join(f'<label class="fo"><input type="{typ}" name="{name}" value="{E(v)}"><span>{E(v)}</span></label>' for v in opts) + '</div>'
def f_scale(name, lo, hi):
    return ('<div class="fscale">' + "".join(f'<label class="fo fn"><input type="radio" name="{name}" value="{i}"><span>{i}</span></label>' for i in range(1, 6)) + f'</div><div class="fends"><span>{E(lo)}</span><span>{E(hi)}</span></div>')
def f_q(title, inner, roles=None, qid=None, hint="", req=False, hidden=False, name=None):
    a = (f' id="{qid}"' if qid else "") + (f' data-roles="{roles}"' if roles else "") + (' hidden' if (roles or hidden) else "") + (f' data-q="{name}"' if name else "")
    return f'<fieldset class="fq"{a}><legend>{E(title)}{" <b class=req aria-hidden=true>*</b>" if req else ""}</legend>' + (f'<p class="fhint">{E(hint)}</p>' if hint else "") + inner + '</fieldset>'
def feedback_page():
    sel = '<option value="">Выберите предмет</option>' + "".join(f'<option value="{E(i["idx"] + " " + clean(i["name"]))}" data-slug="{i["slug"]}">{E(i["idx"])} · {E(clean(i["name"]))}</option>' for i in sorted(items, key=SORT))
    roles = "".join(f'<label class="fo fr"><input type="radio" name="role" value="{c}" data-label="{E(l)}"><span>{E(l)}</span></label>' for c, l in ROLES)
    ALL = " ".join(c for c, _ in ROLES); ADULT = "graduate student parent teacher uni other"
    q = []
    q.append(f_q("Кто вы?", f'<div class="fopts">{roles}</div>', req=True, name="role"))
    inner = []
    inner.append(f_q("Стало ли вам понятнее, чем занимаются на специальности «Стандартизация и метрология»?", f_opts("clarity", ["Да", "Скорее да", "Не очень", "Нет"]), req=True, name="clarity"))
    inner.append(f_q("Что стало понятнее больше всего?", f_opts("clearer", ["Что изучают по семестрам", "Какая нагрузка", "Чему учат на каждом предмете", "Как проверяют знания", "Кем можно работать", "Ничего из этого"], "checkbox"), hint="Можно выбрать несколько."))
    inner.append(f_q("Что осталось непонятным?", '<textarea name="unclear" rows="3" maxlength="500" placeholder="Необязательно. Не пишите личные данные."></textarea>'))
    inner.append(f_q("Стали ли вы больше или меньше рассматривать эту специальность?", f_opts("interest", ["Больше", "Так же", "Меньше", "Я не выбираю эту специальность"]), roles="school89 school1011 graduate", hint="Это только впечатление, а не обязательство поступать."))
    inner.append(f_q("Хватает ли информации на сайте, чтобы обсудить выбор с ребёнком?", f_opts("enough", ["Да", "Частично", "Нет"]), roles="parent"))
    inner.append(f_q("Что для вас важнее всего при выборе вуза?", f_opts("parent_imp", ["Трудоустройство после выпуска", "Нагрузка и сложность", "Стоимость обучения", "Расстояние и общежитие", "Репутация вуза", "Перспективы и профессии"], "checkbox"), roles="parent", hint="Можно выбрать несколько."))
    inner.append(f_q("Использовали бы вы TeachMap на классном часе или уроке?", f_opts("class_use", ["Да", "Возможно", "Нет"]), roles="teacher"))
    inner.append(f_q("Какой материал вам нужен?", f_opts("class_fmt", ["Презентация", "Сценарий классного часа", "Памятка для учеников", "Видео о профессиях"], "checkbox"), roles="teacher"))
    inner.append(f_q("Интересен ли такой сервис для вашей программы или института?", f_opts("uni_interest", ["Да", "Возможно", "Нет"]), roles="uni"))
    inner.append(f_q("Какой формат сотрудничества вам подходит?", f_opts("uni_fmt", ["Бесплатный пилот", "Подписка", "Разовый отчёт по программе", "Другое"], "checkbox"), roles="uni"))
    inner.append(f_q("Готовы обсудить пилот?", f_opts("uni_pilot", ["Да", "Позже", "Нет"]), roles="uni", hint="Если «Да», оставьте контакт в конце формы."))
    inner.append(f_q("Насколько вы доверяете информации на сайте?", f_scale("trust", "1: совсем не доверяю", "5: полностью доверяю")))
    inner.append(f_q("Что вызывает сомнения?", f_opts("trustwhy", ["Нет проверки преподавателем", "Не указан источник", "Слишком упрощено", "Данные могут устареть", "Другое"], "checkbox"), qid="trustwhy", hidden=True))
    inner.append(f_q("Чем вы пользовались?", f_opts("used", ["Путь студента", "Карточки предметов", "Задания «Попробуй сам»", "Каталог и поиск", "Профессии на финише", "Оценки студентов", "Блок «Стало ли понятнее»"], "checkbox")))
    inner.append(f_q("Удобно ли пользоваться сайтом?", f_scale("ux", "1: очень неудобно", "5: очень удобно")))
    inner.append(f_q("Что мешало?", f_opts("uxwhy", ["На телефоне неудобно", "Мелкий шрифт", "Трудно найти нужное", "Медленно загружается", "Непонятная навигация", "Другое"], "checkbox"), qid="uxwhy", hidden=True))
    inner.append(f_q("Чего не хватает на сайте?", f_opts("missing", ["Фото и видео лабораторий", "Истории выпускников", "Вакансии и зарплаты", "Правила приёма и проходные баллы", "Сравнение направлений", "Тест «подходит ли мне специальность»", "Другое"], "checkbox") + '<input type="text" name="missing_other" maxlength="200" placeholder="Своё предложение (необязательно)" aria-label="Своё предложение">'))
    inner.append(f_q("Нашли ошибку?", '<label class="fo fc"><input type="checkbox" id="errchk" name="errchk"><span>Хочу сообщить об ошибке в описании предмета</span></label>'
                    f'<div id="errbox" hidden><select name="err_d" aria-label="Предмет">{sel}</select><textarea name="err_text" rows="3" maxlength="800" placeholder="Что именно неверно и как должно быть"></textarea></div>'))
    inner.append(f_q("Контакт для ответа (необязательно)", '<input type="text" name="contact" maxlength="120" placeholder="Почта или Telegram" autocomplete="off" aria-label="Контакт для ответа">'
                    '<label class="fo fc"><input type="checkbox" name="consent"><span>Согласен(на) на обработку контакта, чтобы команда проекта могла ответить</span></label>', roles=ADULT, hint="Нужен только если вы хотите получить ответ. Контакт не публикуется."))
    inner.append(f_q("Публикация", '<label class="fo fc"><input type="checkbox" name="quote"><span>Можно анонимно процитировать мой комментарий на сайте или в презентации проекта</span></label>'))
    body = head_nav(0, "fb") + f'''<main id="main"><div class="heroblock"><div class="wrap"><section class="hero"><span class="line"></span><h1>Обратная связь</h1>
<p class="lead">Расскажите, что получилось, а что нет. Это займёт около двух минут. Обязательны только два вопроса: кто вы и стало ли вам понятнее.</p></section></div></div>
<div class="wrap"><div class="fdemo" id="fbdemo" hidden role="note"><b>Демонстрационный режим.</b> Приём ответов ещё не подключён, поэтому форма работает как образец и ничего не отправляет.</div>
<form id="fbform" class="panel ff" novalidate><p class="fhint ffpriv">Форма анонимная: мы не спрашиваем имя и не сохраняем IP-адрес. Контакт нужен только тем, кто хочет получить ответ, и у школьников 8–11 классов он не принимается. Комментарии не публикуются без вашего согласия.</p>
<noscript><p class="muted">Для работы формы нужен включённый JavaScript.</p></noscript>
{q[0]}<div id="rest" hidden>{"".join(inner)}
<div class="ffsend"><button type="submit" class="btn" id="fbsend">Отправить</button><p id="fbmsg" class="tkmsg" role="alert" aria-live="assertive"></p></div></div>
<input class="fbtrap" type="text" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true"></form></div></main>'''
    body = dark_head(body, "Обратная связь")
    return page("Обратная связь · TeachMap", "Расскажите, что получилось, а что нет: короткая анонимная форма", body, 0, form=True)
def about_page():
    survey = f'<p><a class="btn" href="{E(SURVEY_URL)}">Пройти опрос студентов</a></p>' if SURVEY_URL else ""
    contact = f'<h2>Контакты</h2><p>{E(CONTACT)}</p>' if CONTACT else ""
    faq = [("Это официальный сайт ДВФУ?","Нет. Это студенческий проект. Сайт справочный и не заменяет рабочий учебный план и консультацию приёмной комиссии."),
     ("Откуда данные?",f"Часы, зачётные единицы и формы контроля взяты из документа: {meta['plan']}, {meta['approved']}."),
     ("Кто пишет описания и кто их проверяет?","Описания пишут студенты, проверяют преподаватели. Статус каждой карточки виден на её странице: «Описание готовится», «Черновик команды» или «Проверено преподавателем»."),
     ("Как считаются оценки студентов?",f"Студенты анонимно ставят оценки от 1 до 5. Оценка показывается, если ответили не меньше {MIN_N} человек, это медиана. Ответы тех, кто не разрешил их использовать, не учитываются. Если оценили студенты смежных программ, это указано на странице."),
     ("Почему у предмета нет оценок?",f"Либо ответов пока меньше {MIN_N}, либо предмета нет в опросе (например, практики)."),
     *([("Что происходит с моим ответом «Стало ли понятнее»?","Ответ анонимный: мы не собираем имя и почту. Мы считаем долю ответов «да» и читаем комментарии, чтобы переписать то, что осталось непонятным. Не пишите в комментарии личные данные.")] if FEEDBACK_URL else []),
     ("Как предложить правку?",("Заполните форму на странице «Обратная связь» и отметьте «Хочу сообщить об ошибке в описании предмета». " if FB_ON else "") + "Напишите нам по контактам внизу страницы, и мы поправим карточку. Планы могут меняться, поэтому в подвале указана дата сверки.")]
    fq = "".join(f'<details><summary>{E(q)}</summary><p>{E(a)}</p></details>' for q,a in faq)
    cnt = {k: 0 for k in STATUS}
    for it in items:
        st_ = read_card(it["slug"])["status"]; cnt[st_ if st_ in STATUS else "готовится"] += 1
    has_text = sum(1 for it in items if read_card(it["slug"])["what"])
    facts = [("Источник плана", f'{E(meta["plan"])}, {E(meta["approved"])}'), ("Данные сверены", E(meta["checked"])),
             ("Описания", f"готовы для {has_text} из {len(items)} позиций; у остальных показана только нагрузка из плана"),
             ("Проверено преподавателем", f'{cnt["проверено"]} карточек'), ("Черновик команды", f'{cnt["черновик"]} карточек'), ("Описание готовится", f'{cnt["готовится"]} карточек'),
             ("Связи между предметами", f"{len(LINKS)}: логические предположения команды, не официальные пререквизиты"),
             ("Профессии и их предметы", f"{len(JOBS)}: оценка команды проекта, не требования работодателей и не профессиональный стандарт"),
             ("Компетенции", f"коды индикаторов из рабочих программ ({E(RP_SRC)})"),
             ("Оценки студентов", f"анонимный опрос; показываются, если ответили не меньше {MIN_N} человек")]
    srcs = ('<section class="panel aboutsrc" id="sources"><h2>Источники и статус проверки</h2><dl class="srcl">' + "".join(f'<div><dt>{k}</dt><dd>{v}</dd></div>' for k, v in facts) + '</dl>'
            '<p class="muted">Числа считаются при каждой сборке сайта из данных проекта, а не вводятся вручную.</p></section>')
    body = head_nav(0, "about") + f'''<main id="main"><div class="heroblock"><div class="wrap"><section class="hero"><span class="line"></span><h1>О проекте TeachMap</h1><p class="lead">Официальный учебный план написан для проверяющих. TeachMap объясняет его абитуриентам простым языком: чем придётся заниматься и насколько будет трудно.</p></section></div></div><div class="wrap">
<div class="doc"><h2>Что важно знать</h2><p>Сайт показывает данные плана 27.03.01 «Стандартизация и метрология» ДВФУ и оценки студентов. Мы не собираем имена и почту, цитаты публикуем только с согласия студента.</p>{survey}{contact}</div>
{srcs}<h2 style="color:var(--pri)">Частые вопросы</h2>{fq}</div></main>'''
    body = dark_head(body, "О проекте")
    return page("О проекте · TeachMap","Что это за сайт, откуда данные и как считаются оценки студентов", body)

def sem_list(s):
    out = []
    for part in str(s).split(","):
        part = part.strip()
        m = re.match(r"(\d+)\s*[–-]\s*(\d+)", part)
        if m: out += list(range(int(m.group(1)), int(m.group(2)) + 1))
        elif part.isdigit(): out.append(int(part))
    return out
SEM_NOTE = {1:"Фундамент: математика, химия, графика и знакомство с профессией.",2:"Первые профильные предметы: техническое регулирование и документы. Летом учебные практики.",
 3:"Метрология и статистика: больше расчётов и лабораторных.",4:"Управление качеством и измерения. Летом технологическая практика.",
 5:"Ядро профессии: стандарты, сертификация, статистические методы.",6:"Квалиметрия, эталоны и испытания. Вторая технологическая практика.",
 7:"Точность, проекты, экономика качества. Больше предметов по выбору.",8:"Финиш: практики, госэкзамен и выпускная работа."}
# профессии и их ключевые предметы — data/jobs.json (оценка команды проекта, см. meta.basis); порядок задаёт номер профессии в адресах
_JD = jload(ROOT/"data/jobs.json", {"meta": {}, "jobs": []}); JOB_BASIS = _JD["meta"].get("basis", "")
JOBS = [(j["icon"], j["title"], j["desc"], j["key"], j["hh_query"]) for j in _JD["jobs"]]
JOB_IDS = [j["id"] for j in _JD["jobs"]]
def path_data(cards):
    known = {i["slug"] for i in items}
    for j in JOBS:
        for sl in j[3]: assert sl in known, sl
    out = {}
    for it in items:
        c = cards[it["slug"]]; r = ratings.get(it["slug"]) or {}
        out[it["slug"]] = {"n": clean(it["name"]), "pick": it["type"] == "По выбору", "code": it["idx"], "type": it["type"], "g": gi(it), "gn": GKEYS[gi(it)],
            "sem": it["sem"], "ze": it["ze"], "h": it["hours"], "c": it["contact"], "lec": it["lec"] or 0, "lab": it["lab"] or 0, "pr": it["pr"] or 0, "ctl": it["controls"] or "",
            "st": c["status"] if c["status"] in STATUS else "готовится", "what": c["what"], "why": c["why"], "brief": c["brief"], "ex": c["example"], "ans": c["answer"], "tip": c["tip"],
            "learn": blist(c["learn"]), "themes": tlist(c["themes"]), "acts": c["acts"], "tools": blist(c["tools"]), "assess": c["assess"],
            "up": [[s, t] for s, t, _ in links_of(it["slug"])[0]], "dn": [[s, t] for s, t, _ in links_of(it["slug"])[1]],
            "r": ({"n": r.get("n",0), "hard": r.get("hard"), "useful": r.get("useful"), "int": r.get("interest"), "scope": r.get("scope","")} if r.get("n",0) >= MIN_N else None)}
    return {"items": out, "jobs": [{"i": j[0], "t": j[1], "d": j[2], "s": j[3]} for j in JOBS], "status": STATUS, "min_n": MIN_N}
def need_ancestors(keys):
    """всё, без чего трудно начать ключевые предметы: цепочки связей «нужен» в обратную сторону"""
    need = {}
    for l in LINKS:
        if l["type"] == "need": need.setdefault(l["to"], []).append(l["from"])
    seen = set(); stack = list(keys)
    while stack:
        for f_ in need.get(stack.pop(), []):
            if f_ not in seen: seen.add(f_); stack.append(f_)
    return seen - set(keys)
def jobs_page():
    by = {i["slug"]: i for i in items}
    routes = [(set(j[3]), need_ancestors(j[3])) for j in JOBS]
    from collections import Counter
    common = Counter(s for keys, anc in routes for s in keys | anc)
    base = sorted((s for s, n_ in common.items() if n_ >= 4), key=lambda s: (start_sem(by[s]["sem"]), by[s]["idx"]))
    def chip(s, key):
        return (f'<a class="rch{" key" if key else ""}" href="d/{s}.html" title="{E(clean(by[s]["name"]))}">'
                f'{E(cut(clean(by[s]["name"]), 44))}<span class="vh"> — {"ключевой предмет" if key else "нужен для ключевого"}</span></a>')
    arts = ""
    for k, (j, (keys, anc)) in enumerate(zip(JOBS, routes)):
        cols = ""
        for s_ in range(1, 9):
            here = sorted((x for x in keys | anc if start_sem(by[x]["sem"]) == s_), key=lambda x: (x not in keys, by[x]["idx"]))
            cols += f'<li class="rc{"" if here else " empty"}"><b>{s_} сем.</b>{"".join(chip(x, x in keys) for x in here)}</li>'
        cc = Counter(c for s_ in keys for r in RP.get(s_, []) for c in set(r.get("competencies") or []))
        order = lambda c: (list(COMP).index(c.split("-")[0]) if c.split("-")[0] in COMP else 9, c)
        comps = "".join(f'<span class="kchip ccode" title="формируют ключевых предметов: {n_}">{E(c)}{f" ×{n_}" if n_ > 1 else ""}</span>' for c, n_ in sorted(cc.items(), key=lambda x: order(x[0])))
        q = j[4].replace(" ", "+")
        klist = "".join(f'<li><a href="d/{x}.html">{E(clean(by[x]["name"]))}</a><span class="muted">{course_line(by[x])}</span></li>'
                        for x in sorted(keys, key=lambda x: (start_sem(by[x]["sem"]), by[x]["idx"])))
        other = (k + 1) % len(JOBS)
        arts += (f'<article class="panel jm" id="job-{k}" aria-labelledby="jh-{k}"><div class="jmhead"><div class="jmtext"><p class="dkick">Профессия · оценка команды проекта</p>'
                 f'<h2 id="jh-{k}">{E(j[1])}</h2><p class="jdesc">{E(j[2])}</p>'
                 f'<p class="jtags"><span>{len(keys)} ключевых предметов</span>{f"<span>{len(anc)} нужны для ключевых</span>" if anc else ""}{f"<span>{len(cc)} кодов компетенций</span>" if cc else ""}</p>'
                 f'<div class="acts"><a class="btn-s jgo" href="map.html#job={k}">Построить маршрут на карте {ic("FaArrowRight")}</a>'
                 f'<button type="button" class="mybtn my-job" data-job="{k}" data-title="{E(j[1])}" aria-pressed="false" hidden><span class="myi" aria-hidden="true">★</span>Интересная профессия</button></div></div>'
                 f'{disc_art(_JD["jobs"][k]["id"], k % 4, j[0])}</div>'
                 f'<div class="jmbody"><section class="jsec"><h3 class="lkh">Ключевые предметы</h3><ul class="jkl">{klist}</ul></section>'
                 + (f'<section class="jsec"><h3 class="lkh">Ключевые предметы формируют компетенции</h3><div class="ks">{comps}</div><p class="muted jcn">Коды индикаторов из рабочих программ; «×2» — компетенцию формируют два ключевых предмета.</p></section>' if comps else "")
                 + f'<section class="jsec jroute"><h3 class="lkh">Маршрут по семестрам: {len(keys)} ключевых предметов и {len(anc)} — без которых их трудно начать</h3><ol class="route">{cols}</ol></section>'
                 f'<div class="acts"><a class="btn-o" href="path.html#path={k}">{ic("FaMapMarkedAlt")} Показать на пути студента</a><a class="btn-o" href="catalog.html?job={k}">Предметы в каталоге</a>'
                 f'<a class="btn-o" href="#compare={k},{other}">Сравнить с другой профессией</a>'
                 f'<a class="btn-o" href="https://hh.ru/search/vacancy?text={E(q)}" target="_blank" rel="noopener">Вакансии на hh.ru</a></div></div></article>')
    toc = ('<nav class="jlist" id="jlist" aria-label="Профессии"><ul>'
           + "".join(f'<li><a class="jli" href="#job-{k}"><span class="jli-i" aria-hidden="true">{ic(j[0])}</span><span class="jli-t">{E(j[1])}<small>{len(routes[k][0])} ключевых{f" · {len(routes[k][1])} нужны для них" if routes[k][1] else ""}</small></span></a></li>' for k, j in enumerate(JOBS))
           + f'</ul><ul class="jlx"><li><a class="jli" href="#compare"><span class="jli-i" aria-hidden="true">{ic("FaLayerGroup")}</span><span class="jli-t">Сравнить две профессии</span></a></li>'
           f'<li><a class="jli" href="#basis"><span class="jli-i" aria-hidden="true">{ic("FaClipboardCheck")}</span><span class="jli-t">На чём основана карта</span></a></li></ul></nav>')
    # сравнение: те же данные, что в маршрутах ниже — ключевые предметы, нужные для них и коды компетенций ключевых предметов
    used = sorted({x for keys, anc in routes for x in keys | anc}, key=lambda x: (start_sem(by[x]["sem"]), by[x]["idx"]))
    cdata = {"n": {x: [clean(by[x]["name"]), str(by[x]["sem"])] for x in used},
             "j": [{"t": j[1], "k": [x for x in used if x in keys], "a": [x for x in used if x in anc],
                    "c": sorted({c for x in keys for r in RP.get(x, []) for c in set(r.get("competencies") or [])}, key=lambda c: (list(COMP).index(c.split("-")[0]) if c.split("-")[0] in COMP else 9, c))}
                   for j, (keys, anc) in zip(JOBS, routes)]}
    cdata = json.dumps(cdata, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    sel = lambda i, v: f'<select id="{i}">' + "".join(f'<option value="{k}"{" selected" if k == v else ""}>{E(j[1])}</option>' for k, j in enumerate(JOBS)) + '</select>'
    compare = (f'<section class="panel jcompare" id="compare" aria-labelledby="cmph"><h2 id="cmph"><span class="ci">{ic("FaLayerGroup")}</span>Сравнить две профессии</h2>'
               f'<div class="cmpsel"><label class="sortl">Первая {sel("cmpa", 0)}</label><label class="sortl">Вторая {sel("cmpb", 1)}</label></div>'
               '<div id="cmpout" aria-live="polite"><noscript><p class="muted">Для сравнения нужен включённый JavaScript. Маршруты всех профессий — ниже на странице.</p></noscript></div>'
               '<p class="muted cmpnote">Сравнение построено на тех же данных, что и маршруты ниже: ключевые предметы — оценка команды проекта, «нужные для ключевых» — по логическим связям, '
               'компетенции — коды из рабочих программ ключевых предметов. Это не требования работодателей и не профессиональный стандарт.</p></section>')
    base_chips = "".join(f'<a class="kchip" href="d/{s_}.html">{E(clean(by[s_]["name"]))}</a>' for s_ in base)
    basis = (f'<section class="panel jbasis" id="basis" aria-labelledby="basish"><h2 id="basish"><span class="ci">{ic("FaClipboardCheck")}</span>На чём основана карта</h2><ul class="bl">'
             '<li><span class="rch key sample">ключевой предмет</span> — оценка команды проекта по задачам профессии; это не официальный перечень и не гарантия трудоустройства.</li>'
             '<li><span class="rch sample">нужен для ключевого</span> — предметы, без которых ключевые трудно начать, по согласованным логическим связям (не официальные пререквизиты).</li>'
             '<li>Компетенции — коды индикаторов из рабочих программ ключевых предметов; «×2» значит, что компетенцию формируют два ключевых предмета.</li>'
             '<li>Профессии и их ключевые предметы хранятся в файле <code>data/jobs.json</code> с пометкой «оценка команды проекта». Предложить правку можно через <a href="feedback.html">обратную связь</a>.</li></ul>'
             f'<h3 class="lkh jbase">Общая основа</h3><p>Эти предметы входят в маршрут к четырём и более профессиям из шести.</p><div class="ks" style="margin-top:10px">{base_chips}</div></section>')
    head = ('<div class="cathead jhead"><div class="wrap"><nav class="crumbs" aria-label="Путь"><a href="index.html">TeachMap</a> › Профессии</nav><h1>Профессии</h1>'
            f'<p class="lead">Кем можно работать после направления 27.03.01 и какие предметы к этому ведут: от первого семестра до диплома. Это оценка команды проекта, а не официальный перечень и не гарантия трудоустройства.</p></div></div>')
    body = head_nav(0, "jobs") + f'''<main id="main" class="jobpage">{head}<div class="wrap jgrid">{toc}<div class="jmain" id="jmain">{arts}{compare}{basis}</div></div></main><script type="application/json" id="cmpd">{cdata}</script>'''
    return page("Карта профессий: предметы, которые ведут к профессии · TeachMap", "Шесть профессий выпускников 27.03.01 ДВФУ и маршрут к каждой по семестрам: ключевые предметы, опоры, компетенции и сравнение двух профессий", body, jobs=True)
# ---- карта связей (map.html): раскладка считается здесь, при сборке; браузер только показывает, подсвечивает и масштабирует ----
GNW, GNH, GCW, GRH, GTOP, GPAD = 168, 54, 206, 64, 46, 18   # узел: ширина, высота; шаг столбца и строки; место под подписи семестров; поля
GT = {"need": "нужен", "helps": "помогает", "job": "ведёт к профессии"}
def graph_model():
    """Столбец — семестр, в котором предмет начинается; профессии — отдельный столбец справа.
    Внутри столбца предметы со связями идут сверху: их порядок несколько раз подравнивается по среднему месту соседей
    в других столбцах (так меньше пересечений линий). Предметы без связей собраны внизу столбца по разделам плана."""
    by = {i["slug"]: i for i in items}
    nb = {}
    for l in LINKS: nb.setdefault(l["from"], set()).add(l["to"]); nb.setdefault(l["to"], set()).add(l["from"])
    col = {s: start_sem(by[s]["sem"]) or 1 for s in by}
    cols = {c: sorted((s for s in by if col[s] == c), key=lambda s: (not nb.get(s), gi(by[s]), by[s]["idx"])) for c in range(1, 9)}
    pos = {}
    def renum():
        for lst in cols.values():
            for k, s in enumerate(lst): pos[s] = k
    renum()
    for _ in range(6):
        for c in list(range(2, 9)) + list(range(7, 0, -1)):
            def key(s, c=c):
                ns = [pos[t] for t in nb.get(s, ()) if col[t] != c]
                return (not nb.get(s), sum(ns) / len(ns) if ns else pos[s], gi(by[s]), by[s]["idx"])
            cols[c].sort(key=key); renum()
    rows = max(len(v) for v in cols.values())
    P = {s: (GPAD + (col[s] - 1) * GCW, GTOP + pos[s] * GRH) for s in by}
    j0 = GTOP + max(0, (rows - len(JOBS)) * GRH // 2)
    for k in range(len(JOBS)): P[f"job-{k}"] = (GPAD + 8 * GCW, j0 + k * GRH)
    W, H = GPAD * 2 + 8 * GCW + GNW, GTOP + rows * GRH + GPAD
    edges = [(l["from"], l["to"], l["type"], l["why"]) for l in LINKS if l["type"] in ("need", "helps")]
    edges += [(s, f"job-{k}", "job", "") for k, j in enumerate(JOBS) for s in j[3]]
    return by, cols, nb, P, W, H, edges
def edge_d(P, a, b):
    (x1, y1), (x2, y2) = P[a], P[b]; sx, sy, ey = x1 + GNW, y1 + GNH // 2, y2 + GNH // 2
    if x2 > x1:                                     # вперёд по семестрам: плавная S-кривая от правого края к левому
        dx = max(36, (x2 - sx) * 0.42)
        return f"M{sx},{sy} C{sx + dx:.0f},{sy} {x2 - dx:.0f},{ey} {x2},{ey}"
    return f"M{sx},{sy} C{sx + 30},{sy} {sx + 30},{ey} {sx},{ey}"   # в том же семестре: дуга справа
GCR = 22   # круглый узел на тёмном экране карты: центр круга — (x + GCR, y + GNH/2)
def edge_dc(P, a, b):
    """Линия «как в референсе»: от центра круга к центру круга; конец не доходит до круга на его радиус (место для стрелки)."""
    (x1, y1), (x2, y2) = P[a], P[b]; sx, sy, ex, ey = x1 + GCR, y1 + GNH // 2, x2 + GCR, y2 + GNH // 2
    if x2 > x1:
        dx = max(40, (ex - sx) * 0.42)
        return f"M{sx + GCR},{sy} C{sx + dx:.0f},{sy} {ex - dx:.0f},{ey} {ex - GCR - 2},{ey}"
    side = -1 if ey > sy else 1                      # тот же столбец: дуга слева от кругов
    return f"M{sx - GCR},{sy} C{sx - 70},{sy} {sx - 70},{ey} {ex - GCR - 2},{ey + side * 4}"
def map_bg():
    """Фон экрана карты: собственная «кристаллическая» сцена — треугольные грани поверх градиента,
    крупные осколки света и созвездие из точек и тонких линий. Случайность с постоянным зерном: сборка всегда одинаковая."""
    import random
    rnd = random.Random(27031)
    W, H, C, R = 1600, 900, 8, 5
    pts = [[(c * W / C + (rnd.uniform(-70, 70) if 0 < c < C else 0), r * H / R + (rnd.uniform(-60, 60) if 0 < r < R else 0)) for c in range(C + 1)] for r in range(R + 1)]
    tri = []
    for r in range(R):
        for c in range(C):
            a, b, d, e = pts[r][c], pts[r][c + 1], pts[r + 1][c], pts[r + 1][c + 1]
            tri += [(a, b, e), (a, e, d)] if (r + c) % 2 else [(a, b, d), (b, e, d)]
    def P(t): return " ".join(f"{x:.0f},{y:.0f}" for x, y in t)
    faces = []
    for t in tri:
        cx, cy = sum(x for x, _ in t) / 3 / W, sum(y for _, y in t) / 3 / H
        light = 0.55 * cx + 0.45 * cy                       # светлее к низу и вправо, как в сцене референса
        if rnd.random() < 0.35 + 0.4 * light: faces.append(f'<path class="gf1" d="M{P(t)}Z" opacity="{rnd.uniform(.03, .05 + .1 * light):.2f}"/>')
        else: faces.append(f'<path class="gf0" d="M{P(t)}Z" opacity="{rnd.uniform(.05, .22 - .12 * light):.2f}"/>')
    shards = ('<path class="gf1" d="M1080,0 L1010,330 L1160,0Z" opacity=".10"/><path class="gf1" d="M1600,120 L980,900 H1240 L1600,420Z" opacity=".08"/>'
              '<path class="gf1" d="M640,900 L860,420 L940,900Z" opacity=".07"/><path class="gf0" d="M0,0 H520 L0,460Z" opacity=".18"/>')
    stars = [(rnd.uniform(30, W - 30), rnd.uniform(40, H - 30)) for _ in range(46)]
    seen, lines = set(), []
    for i, (x, y) in enumerate(stars):
        near = sorted(range(len(stars)), key=lambda j: (stars[j][0] - x) ** 2 + (stars[j][1] - y) ** 2)[1:3]
        for j in near:
            k2 = (min(i, j), max(i, j))
            if k2 in seen: continue
            seen.add(k2); lines.append(f'M{x:.0f},{y:.0f}L{stars[j][0]:.0f},{stars[j][1]:.0f}')
    GSB = ' class="gsb"'
    dots = "".join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{(3.2 if n % 7 == 0 else rnd.uniform(1.4, 2.4)):.1f}"{GSB if n % 7 == 0 else ""}/>' for n, (x, y) in enumerate(stars))
    return (f'<div class="gbg" aria-hidden="true"><svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">'
            f'<g class="gbg-f">{"".join(faces)}{shards}</g><path class="gbg-l" d="{" ".join(lines)}"/><g class="gbg-s">{dots}</g></svg></div>')
def map_page(cards):
    by, cols, nb, P, W, H, edges = graph_model()
    lab = lambda s: ("По выбору: " if by[s]["type"] == "По выбору" else "") + clean(by[s]["name"])
    heads = "".join(f'<span class="gch" data-c="{c}" style="left:{GPAD + (c - 1) * GCW}px">{c} семестр</span>' for c in range(1, 9)) + f'<span class="gch gchj" style="left:{GPAD + 8 * GCW}px">Профессии</span>'
    nodes = ""
    for c in range(1, 9):
        for k, s in enumerate(cols[c]):
            it = by[s]; g = gi(it); x, y = P[s]
            nodes += (f'<a class="gn c-{g}" href="d/{s}.html" data-id="{s}" data-g="{g}" data-l="{1 if nb.get(s) else 0}" data-sems=" {" ".join(map(str, sem_list(it["sem"])))} " '
                      f'style="left:{x}px;top:{y}px;--c:{c - 1};--r:{min(k, 12)}" title="{E(lab(s))}"><span class="gni" aria-hidden="true"></span><b>{E(cut(lab(s), 50))}</b><small>{E(str(it["sem"]))} сем. · {ze_num(it)} з.е.</small></a>')
    for k, j in enumerate(JOBS):
        x, y = P[f"job-{k}"]
        nodes += (f'<a class="gn gj" href="jobs.html#job-{k}" data-id="job-{k}" data-l="1" style="left:{x}px;top:{y}px;--c:8;--r:{k}">'
                  f'<span class="gji" aria-hidden="true">{ic(j[0])}</span><b>{E(j[1])}</b><small>профессия</small></a>')
    marks = "".join(f'<marker id="ga-{t}" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path class="gm {t}" d="M0,0L10,5L0,10z"/></marker>' for t in GT)
    paths = "".join(f'<path class="ge {t}" data-f="{a}" data-t="{b}" d="{edge_d(P, a, b)}" data-dc="{edge_dc(P, a, b)}" marker-end="url(#ga-{t})"/>' for a, b, t, _ in edges)
    pick = '<option value="">Выбери предмет из списка</option>' + "".join(
        f'<optgroup label="{c} семестр">' + "".join(f'<option value="{s}">{E(lab(s))}</option>' for s in sorted(cols[c], key=lambda s: by[s]["idx"])) + '</optgroup>' for c in range(1, 9))
    jopt = '<option value="">Путь к профессии…</option>' + "".join(f'<option value="{k}">{E(j[1])}</option>' for k, j in enumerate(JOBS))
    sems = "".join(f'<button type="button" class="pill gfp" data-gf="sem" data-v="{c}" aria-pressed="true">{c}</button>' for c in range(1, 9))
    grs = "".join(f'<button type="button" class="gf c-{k}" data-gf="g" data-v="{k}" aria-pressed="true"><i></i>{g}</button>' for k, g in enumerate(GKEYS))
    tys = "".join(f'<button type="button" class="pill gft" data-gf="t" data-v="{t}" aria-pressed="true"><svg class="gls" viewBox="0 0 30 10" aria-hidden="true"><path class="ge {t}" d="M1,5H29"/></svg>{GT[t]}</button>' for t in GT)
    n_iso = sum(1 for s in by if not nb.get(s))
    data = {"n": {s: [lab(s), str(by[s]["sem"]), by[s]["ze"], by[s]["hours"], by[s]["controls"] or "", gi(by[s]), cut(cards[s]["what"] or cards[s]["brief"], 260)] for s in by},
            "e": [[a, b, t, w] for a, b, t, w in edges if t != "job"], "j": [[j[1], j[2], j[3], sorted(need_ancestors(j[3]))] for j in JOBS], "g": GKEYS}
    data = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    hero = ('<div class="heroblock"><div class="wrap"><section class="hero"><span class="line"></span><h1>Карта связей между предметами</h1>'
            '<p class="lead">Все предметы плана на одной схеме: на что опирается каждый, к чему ведёт и какие предметы нужны для профессии. Выбери предмет на карте или в списке.</p>'
            f'<nav class="gtabs" aria-label="Режимы образовательной карты"><a href="path.html#journey">{ic("FaMapMarkedAlt")}Учебный план</a><a href="map.html" aria-current="page">{ic("FaCompass")}Граф связей</a><a href="jobs.html">{ic("FaUserGraduate")}Путь к профессии</a></nav></section></div></div>')
    courses = "".join(f'<button type="button" class="pill gcb" data-course="{k}" aria-pressed="{"true" if k == 0 else "false"}">{"Все" if k == 0 else f"{k} курс"}</button>' for k in range(0, 5))
    tools = (f'<div class="gtools" id="gtools"><div class="gcourse" role="group" aria-label="Курс и семестры"><span class="gfl">Курс</span>{courses}<span class="gfl gfl2">Семестры</span><span class="gsems">{sems}</span></div>'
             f'<details class="gfil" open><summary>Фильтры</summary><div class="gfrows">'
             f'<div class="gfrow" role="group" aria-label="Показывать разделы плана"><span class="gfl">Разделы</span>{grs}</div>'
             f'<div class="gfrow" role="group" aria-label="Показывать связи"><span class="gfl">Связи</span>{tys}<button type="button" class="pill" id="giso" aria-pressed="false">Скрыть предметы без связей ({n_iso})</button></div>'
             f'<div class="gfrow"><label class="sortl">Профессия <select id="gjob">{jopt}</select></label><button type="button" class="pill gmine-b" id="gmine" aria-pressed="false" hidden>Мой маршрут</button><button type="button" class="btn-o" id="greset" hidden>Сбросить фильтры</button></div></div></details>'
             f'<p class="muted gcount" id="gcount" aria-live="polite"></p></div>')
    view = (f'<div class="gview" id="gview" tabindex="-1" role="group" aria-label="Граф связей: {len(by)} предметов и {len(JOBS)} профессий. Выбор предмета показывает его связи в панели рядом.">'
            f'<div class="gcanvas" id="gcanvas" style="width:{W}px;height:{H}px">{heads}<svg class="gedges" width="{W}" height="{H}" viewBox="0 0 {W} {H}" aria-hidden="true"><defs>{marks}</defs>{paths}</svg><svg class="gorbit" width="{W}" height="{H}" viewBox="0 0 {W} {H}" aria-hidden="true"></svg>{nodes}</div>'
            f'<div class="gzoom" role="group" aria-label="Масштаб"><button type="button" data-z="out" aria-label="Мельче">−</button><span class="gzv" id="gzv" aria-hidden="true">100%</span><button type="button" data-z="in" aria-label="Крупнее">+</button></div>'
            f'<button type="button" class="gcomp" data-z="fit" aria-label="Вся карта" title="Вся карта">{ic("FaCompass")}</button>'
            f'<p class="ghint" aria-hidden="true"><span>{ic("FaSearch")}Ctrl + колесо — масштаб</span><span>{ic("FaArrowRight")}Перетаскивай — перемещение</span><span>{ic("FaSyncAlt")}Esc — сброс выбора</span></p>'
            '<details class="glegd"><summary>Типы связей</summary><ul>'
            + "".join(f'<li><svg class="gls" viewBox="0 0 30 10" aria-hidden="true"><path class="ge {t}" d="M1,5H29"/></svg>{d}</li>' for t, d in (("need", "нужен: без него трудно начать"), ("helps", "помогает: полезная опора"), ("job", "ведёт к профессии")))
            + '<li><span class="glsw self"></span>выбранный</li><li><span class="glsw need"></span>опора</li><li><span class="glsw down"></span>продолжение</li></ul>'
            '<p>Связи — логические предположения команды, не официальные требования плана.</p></details></div>')
    jfly = "".join(f'<li><button type="button" class="gjp" data-jobpick="{k}" aria-pressed="false"><span aria-hidden="true">{ic(j[0])}</span>{E(j[1])}</button></li>' for k, j in enumerate(JOBS))
    bg = map_bg()
    rail = (f'<nav class="grail" aria-label="Режимы образовательной карты">'
            f'<button type="button" class="grm" data-mode="graph" aria-pressed="true">{ic("FaCompass")}<span>Граф связей</span></button>'
            f'<a class="grm" href="path.html#journey">{ic("FaBookOpen")}<span>Путь по семестрам</span></a>'
            f'<button type="button" class="grm" data-mode="mine" aria-pressed="false" hidden>{ic("FaUserGraduate")}<span>Мой маршрут</span></button>'
            f'<button type="button" class="grm" data-mode="job" aria-pressed="false" aria-expanded="false" aria-controls="gjobfly">{ic("FaBriefcase")}<span>Маршрут к профессии</span></button>'
            f'<div class="gjobfly" id="gjobfly" hidden><p class="gjft">Маршрут к профессии</p><ul>{jfly}</ul></div></nav>')
    side = (f'<aside class="panel gside" id="gside" aria-labelledby="gsideh"><h2 class="vh" id="gsideh">Выбранный предмет</h2><label class="gpickl" for="gpick">Предмет</label><select id="gpick">{pick}</select>'
            '<button type="button" class="btn-s gfull" id="gfull" aria-expanded="false" aria-controls="gmain">Показать всю карту</button>'
            '<div id="gp"><p class="muted">Выбери предмет на карте или в списке: появится, на что он опирается, к чему ведёт и с какими профессиями связан.</p></div></aside>')
    legend = ('<p class="muted gnote"><b>Как читать карту.</b> Сплошная стрелка «нужен»: без этого предмета трудно начать следующий. Пунктир «помогает»: полезная опора, но начать можно и без неё. '
              'Точки «ведёт к профессии»: ключевые предметы направления. Связи составлены командой проекта по содержанию предметов и согласованы автором: это логические предположения, '
              'а не официальные требования учебного плана; связи с профессиями — оценка команды, не гарантия трудоустройства. Тот же план списком — в <a href="catalog.html">каталоге</a> и на <a href="path.html#journey">пути по семестрам</a>.</p>')
    body = (head_nav(0, "map") + f'<main id="main">{hero}<div class="wrap"><div class="gwrap gscreen">{bg}{rail}<div class="gmain" id="gmain"><div class="gbar"><a class="gback" href="index.html" aria-label="На стартовый экран" title="На стартовый экран"><span aria-hidden="true">‹</span></a><span class="gbl" aria-hidden="true">{LOGO_SVG}TeachMap</span><span class="gbt" aria-hidden="true">Образовательная карта</span><span class="gbsp"></span>'
            f'<button type="button" class="gbi" id="gsearch" aria-label="Найти предмет" title="Найти предмет">{ic("FaSearch")}</button>'
            f'<button type="button" class="gbi" id="gfiltb" aria-expanded="false" aria-controls="gtools" aria-label="Курс, семестры и фильтры" title="Курс, семестры и фильтры">{ic("FaLayerGroup")}</button>'
            f'<button type="button" class="gbi gfav" id="gfav" aria-pressed="false" disabled aria-label="В избранное" title="Выбери предмет, чтобы добавить его в избранное">{ic("FaStar")}</button></div>{tools}{view}</div>{side}</div>{legend}</div></main>'
            f'<p class="vh" id="glive" aria-live="polite"></p><script type="application/json" id="gd">{data}</script>')
    return page("Карта связей между предметами 27.03.01 · TeachMap", "Граф учебного плана: на что опирается каждый предмет, к чему ведёт и какие предметы нужны для профессии", body, graph=True)
def job_chip(sl):
    nm = next(i["name"] for i in items if i["slug"] == sl)
    return f'<a class="kchip" href="d/{sl}.html" data-slug="{sl}" aria-haspopup="dialog">{E(cut(clean(nm),34))}</a>'
def path_page(cards):
    by = {}
    for it in sorted(items, key=SORT):
        for k, s in enumerate(sem_list(it["sem"])): by.setdefault(s, []).append((it, k > 0))
    sts = []
    for s in range(1, 9):
        lst = sorted(by.get(s, []), key=lambda t: (t[1], gi(t[0]), t[0]["idx"]))
        cs = ""
        for it, cont in lst:
            g = gi(it); prac = " prac" if GKEYS[g] == "Практики и ГИА" else ""
            label = ("По выбору: " if it["type"] == "По выбору" else "") + cut(clean(it["name"]), 70)
            cs += (f'<a class="dc c-{g}{prac}" href="d/{it["slug"]}.html" data-slug="{it["slug"]}" aria-haspopup="dialog">'
                   f'<span class="dci" aria-hidden="true">{ic(GROUPS[GKEYS[g]][1])}</span><b>{E(label)}</b>'
                   f'<small>{ze_num(it)} з.е. · {n(it["hours"])} ч{" · продолжение" if cont else ""}</small></a>')
        new = sum(1 for _, c in lst if not c)
        sts.append(f'<li class="station" id="sem-{s}" data-sem="{s}" data-course="{(s+1)//2}"><div class="node"><b>{s}</b><span>семестр</span></div><div class="stbody">'
                   f'<div class="sthead"><span class="kicker">{(s+1)//2} курс · {"осень" if s % 2 else "весна"}</span><h2>Семестр {s}</h2>'
                   f'<p>{SEM_NOTE[s]} <span class="muted">Новых предметов: {new}, всего в семестре: {len(lst)}.</span></p></div><div class="dcs">{cs}</div></div></li>')
    jobs = ""
    for k, j in enumerate(JOBS):
        chips_ = "".join(job_chip(sl) for sl in j[3])
        q = j[4].replace(" ", "+")
        jobs += (f'<article class="job" id="job-{k}"><span class="ci">{ic(j[0])}</span><h3>{E(j[1])}</h3><p>{E(j[2])}</p>'
                 f'<div class="ks" aria-label="Ключевые предметы">{chips_}</div><div class="acts">'
                 f'<button type="button" class="btn-s" data-job="{k}">{ic("FaMapMarkedAlt")} Показать путь к профессии</button>'
                 f'<a class="btn-o" href="https://hh.ru/search/vacancy?text={E(q)}" target="_blank" rel="noopener">Вакансии на hh.ru</a></div></article>')
    legend = "".join(f'<button type="button" class="gf c-{k}" data-g="{k}" aria-pressed="false"><i></i>{g}</button>' for k, g in enumerate(GKEYS))
    data = json.dumps(path_data(cards), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    hero = ('<div class="heroblock"><div class="wrap"><section class="hero"><span class="line"></span><h1>Путь студента: от первого семестра до профессии</h1>'
            '<p class="lead">Пройди специальность 27.03.01 «Стандартизация и метрология» за пару минут: листай семестры, открывай карточки предметов и смотри, кем сможешь работать в конце.</p>'
            f'<form class="hsearch" action="catalog.html" role="search"><span class="hs-i">{ic("FaSearch")}</span><input name="q" type="search" placeholder="Найти предмет, например «метрология»" aria-label="Поиск по предметам"><button type="submit" aria-label="Найти">{ic("FaArrowRight")}</button></form><p class="hlinks"><a class="btn" href="#journey">Начать путь {ic("FaArrowRight")}</a><a class="btn-o" href="catalog.html">Все дисциплины</a><a class="btn-o" href="jobs.html">Карта профессий</a></p><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>'
            f'<div class="facts"><span><i>{ic("FaRegClock")}</i><b>4</b> года</span><span><i>{ic("FaLayerGroup")}</i><b>8</b> семестров</span><span><i>{ic("FaChartBar")}</i><b>240</b> з.е.</span><span><i>{ic("FaUserGraduate")}</i><b>{len(JOBS)}</b> профессий на финише</span></div></section></div></div>')
    finale = (f'<li class="station finale" id="jobs" data-sem="9"><div class="node">{ic("FaUserGraduate")}</div><div class="stbody"><div class="sthead"><span class="kicker">Финиш</span><h2>Диплом и работа</h2>'
              '<p>Типичные должности выпускников направления. Нажми «Показать путь к профессии», чтобы подсветить на карте предметы, которые к ней ведут. '
              '<span class="muted">Список и привязка предметов — оценка команды проекта по задачам профессий; требования и зарплаты смотри в вакансиях. Маршрут к каждой профессии по семестрам — на <a href="jobs.html">карте профессий</a>.</span></p></div>'
              f'<div class="jobs">{jobs}</div></div></li>')
    journey = (f'<div class="wrap"><div class="journey" id="journey"><div class="jbar"><span class="jpos" id="jpos" aria-live="polite">Старт: 1 курс</span>'
               f'<div class="jprog" aria-hidden="true"><i id="jfill"></i></div><span id="jpct">0%</span></div>'
               f'<div class="gfs" role="group" aria-label="Подсветить раздел плана">{legend}</div><section class="panel routebox" id="route" hidden aria-live="polite"></section><ol class="track" id="track">{"".join(sts)}{finale}</ol></div></div>')
    pill = f'<div class="hlpill" id="hlpill" hidden><span id="hltext"></span><button type="button" id="hlclear">Снять подсветку</button></div>'
    mine = f'<section class="wrap mine" id="mine" data-total="{len(items)}" hidden aria-labelledby="mineh"><div class="panel"><h2 id="mineh"><span class="ci">{ic("FaStar")}</span>Мой план</h2><div id="minebody"></div></div></section>'
    body = head_nav(0, "home") + f'<main id="main">{hero}{mine}{journey}</main>{pill}<script type="application/json" id="pd">{data}</script>'
    return page("TeachMap: путь студента по направлению 27.03.01 Стандартизация и метрология ДВФУ", "Интерактивный путь по специальности: семестры, предметы и профессии выпускников", body, path=True)

# ---- план таблицей (plan.html) и выгрузка plan.csv: те же данные plan.json, без пересчётов ----
CSV_COLS = ["Код", "Дисциплина", "Тип", "Раздел", "Семестры", "З.е.", "Часы всего", "Контактные", "Лекции", "Лабораторные", "Практические", "Формы контроля", "Страница на сайте"]
def plan_csv():
    """CSV для Excel и таблиц: разделитель «;», кодировка UTF-8 с BOM (иначе Excel покажет кракозябры)."""
    import csv, io
    buf = io.StringIO(); w = csv.writer(buf, delimiter=";", lineterminator="\r\n")
    w.writerow(CSV_COLS)
    for it in sorted(items, key=SORT):
        w.writerow([it["idx"], clean(it["name"]), it["type"], group_of(it["type"]), it["sem"], n(it["ze"]), n(it["hours"]), n(it["contact"]), n(it["lec"]), n(it["lab"]), n(it["pr"]), it["controls"] or "", f'{SITE_URL}d/{it["slug"]}.html'])
    return "\ufeff" + buf.getvalue()
def plan_page(cards):
    by = {i["slug"]: i for i in items}; order = sorted(items, key=SORT)
    rows = ""
    for s in range(1, 9):
        lst = [it for it in order if start_sem(it["sem"]) == s]
        if not lst: continue
        rows += f'<tr class="psem"><th colspan="10" scope="colgroup" id="ps{s}">Начинаются в {s} семестре</th></tr>'
        for it in lst:
            rows += (f'<tr><td>{E(it["idx"])}</td><th scope="row" headers="ps{s}"><a href="d/{it["slug"]}.html">{E(("По выбору: " if it["type"] == "По выбору" else "") + clean(it["name"]))}</a></th>'
                     f'<td>{E(group_of(it["type"]))}</td><td class="pn">{E(str(it["sem"]))}</td><td class="pn">{ze_num(it)}</td><td class="pn">{n(it["hours"])}</td>'
                     f'<td class="pn">{n(it["lec"]) or 0}</td><td class="pn">{n(it["lab"]) or 0}</td><td class="pn">{n(it["pr"]) or 0}</td><td>{E(it["controls"] or "—")}</td></tr>')
    jobs_of = {}
    for k, j in enumerate(JOBS):
        for x in j[3]: jobs_of.setdefault(x, []).append(j[1])
    order_c = lambda c: (list(COMP).index(c.split("-")[0]) if c.split("-")[0] in COMP else 9, c)
    cdata = {}
    for it in order:
        sl = it["slug"]; up, dn, _ = links_of(sl)
        cdata[sl] = {"n": clean(it["name"]), "s": str(it["sem"]), "g": group_of(it["type"]), "ze": it["ze"], "h": it["hours"], "c": it["contact"], "l": it["lec"] or 0, "b": it["lab"] or 0, "p": it["pr"] or 0,
                     "k": it["controls"] or "", "up": [[x, t] for x, t, _ in up], "dn": [[x, t] for x, t, _ in dn], "j": jobs_of.get(sl, []),
                     "cp": sorted({c for r in RP.get(sl, []) for c in (r.get("competencies") or [])}, key=order_c), "w": cut(cards[sl]["what"] or cards[sl]["brief"], 200)}
    cdata = json.dumps(cdata, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    opts = lambda v: "".join(f'<option value="{it["slug"]}"{" selected" if it["slug"] == v else ""}>{E(it["idx"])} · {E(clean(it["name"]))}</option>' for it in order)
    body = head_nav(0, "plan") + f'''<main id="main"><div class="heroblock"><div class="wrap"><section class="hero"><span class="line"></span><h1>Учебный план таблицей</h1>
<p class="lead">Все {len(items)} позиций плана на одной странице: семестры, зачётные единицы, часы и формы контроля. Всего по плану {meta.get("total_ze", 240)} з.е.</p>
<p class="hlinks"><a class="btn" href="plan.csv" download>Скачать таблицу (CSV) {ic("FaArrowRight")}</a><button type="button" class="btn-o" data-print hidden>Распечатать или сохранить в PDF</button><a class="btn-o" href="#cmp">Сравнить две дисциплины</a></p></section></div></div>
<div class="wrap"><p class="muted pnote">Источник: {E(meta["plan"])}, {E(meta["approved"])}. Данные сверены {E(meta["checked"])}. Часы — всего за дисциплину по плану, у предметов на несколько семестров указан их диапазон. Таблица справочная и не заменяет официальный документ.</p>
<div class="ptable"><table><caption class="vh">Учебный план по семестрам</caption><thead><tr><th scope="col">Код</th><th scope="col">Дисциплина</th><th scope="col">Раздел</th><th scope="col" class="pn">Семестры</th><th scope="col" class="pn">З.е.</th><th scope="col" class="pn">Часы</th><th scope="col" class="pn" title="Лекции">Лек.</th><th scope="col" class="pn" title="Лабораторные">Лаб.</th><th scope="col" class="pn" title="Практические">Пр.</th><th scope="col">Контроль</th></tr></thead><tbody>{rows}</tbody></table></div>
<p class="muted">Формы контроля: Эк — экзамен, За — зачёт, ЗаО — зачёт с оценкой, КР — курсовая работа, КП — курсовой проект, К — контрольная, Оц — оценка, РГР — расчётно-графическая работа; число в скобках — сколько раз.</p>
<section class="panel pcmp" id="cmp" aria-labelledby="cmph2"><h2 id="cmph2"><span class="ci">{ic("FaLayerGroup")}</span>Сравнить две дисциплины</h2>
<div class="cmpsel"><label class="sortl">Первая <select id="pca">{opts(order[0]["slug"])}</select></label><label class="sortl">Вторая <select id="pcb">{opts(order[1]["slug"])}</select></label></div>
<div id="pcout" aria-live="polite"><noscript><p class="muted">Для сравнения нужен включённый JavaScript.</p></noscript></div>
<p class="muted cmpnote">Нагрузка и формы контроля — по учебному плану; связи — логические предположения команды проекта (не официальные пререквизиты); профессии — оценка команды; компетенции — коды из рабочих программ.</p></section></div></main>
<script type="application/json" id="pcd">{cdata}</script>'''
    body = dark_head(body, "План таблицей")
    return page("Учебный план 27.03.01 таблицей: часы, з.е., контроль · TeachMap", "Все позиции учебного плана 27.03.01 ДВФУ таблицей: семестры, зачётные единицы, часы и формы контроля; выгрузка CSV и сравнение дисциплин", body, plan=True)
# ---- стартовый экран (index.html): игровое меню; дорога по семестрам — на path.html ----
def start_art():
    """Собственная SVG-композиция (без персонажей и чужой графики): лучи, кольцо, силуэт города из прямоугольников
    и «созвездие» пути — 8 семестров от нижнего левого угла к звезде профессии. Город детерминирован (без случайных чисел)."""
    W, H, base = 900, 700, 700
    city_b = city_f = win = ""
    x = 300
    k = 0
    while x < W:                                       # задний ряд: выше и светлее
        w = 34 + (k * 37) % 42; h = 150 + (k * 71) % 170
        city_b += f'<rect x="{x}" y="{base - h}" width="{w}" height="{h}"/>'
        x += w + 4; k += 1
    x = 250; k = 0
    while x < W:                                       # передний ряд и окна
        w = 40 + (k * 53) % 50; h = 70 + (k * 89) % 150
        if k == 7: w, h = 46, 330                      # башня
        city_f += f'<rect x="{x}" y="{base - h}" width="{w}" height="{h}"/>'
        if k == 7: city_f += f'<path d="M{x + 23},{base - h - 70}L{x + 33},{base - h}H{x + 13}Z"/><rect x="{x + 21}" y="{base - h - 110}" width="4" height="44"/>'
        for r in range(base - h + 14, base - 16, 22):
            for c in range(x + 8, x + w - 8, 14):
                if (r * 7 + c * 3 + k) % 5 == 0: win += f'<rect x="{c}" y="{r}" width="6" height="9"/>'
        x += w + 6; k += 1
    pts = [(120, 560), (210, 488), (300, 520), (390, 420), (470, 450), (560, 330), (640, 352), (720, 236)]
    line = "M" + " L".join(f"{a},{b}" for a, b in pts) + " L812,128"
    nodes = "".join(f'<g class="sv-node" style="--i:{i}"><circle cx="{a}" cy="{b}" r="12"/><text x="{a}" y="{b + 4.5}">{i + 1}</text></g>' for i, (a, b) in enumerate(pts))
    star = "M812,96 L820,118 L844,118 L825,132 L832,156 L812,142 L792,156 L799,132 L780,118 L804,118Z"
    return (f'<svg class="st-art" viewBox="0 0 {W} {H}" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">'
            '<g class="sv-ray"><path d="M900,0 L520,700 H610 L900,150Z"/><path d="M900,210 L700,700 H760 L900,330Z"/><path d="M760,0 L470,700 H500 L800,0Z"/></g>'
            '<circle class="sv-ring" cx="660" cy="250" r="190"/><circle class="sv-ring2" cx="660" cy="250" r="236"/>'
            f'<g class="sv-city-b">{city_b}</g><g class="sv-city-f">{city_f}</g><g class="sv-win">{win}</g>'
            f'<path class="sv-line" d="{line}" pathLength="1"/>{nodes}<path class="sv-star" d="{star}"/><text class="sv-stl" x="812" y="186">профессия</text></svg>')
def start_page():
    menu = [("map.html", "Образовательная карта", "Граф связей, путь по семестрам и маршруты к профессиям"),
            ("catalog.html", "Дисциплины", f"Все {len(items)} позиций плана: поиск, фильтры, страницы предметов"),
            ("jobs.html", "Профессии", f"{len(JOBS)} направлений: полезные дисциплины, компетенции, сравнение"),
            ("profile.html", "Профиль", "Мой план: статусы, избранное, заметки — только в этом браузере"),
            ("#settings", "Настройки", "Крупный шрифт и контраст, о проекте, обратная связь")]
    lis = "".join(f'<li><a class="sm-i{" on" if k == 0 else ""}" href="{h}" style="--k:{k}"><span class="sm-n" aria-hidden="true">{k + 1:02d}</span><span class="sm-t">{t}</span><span class="sm-d">{d}</span></a></li>'
                  for k, (h, t, d) in enumerate(menu))
    fb = '<li><a class="sm-s" href="feedback.html">Обратная связь</a></li>' if FB_ON else ""
    settings = ('<section class="st-set" id="settings" aria-labelledby="seth"><h2 id="seth" tabindex="-1">Настройки</h2><ul class="sm-sl">'
                f'<li><button type="button" class="sm-s acc" id="acc" aria-pressed="false"><span class="ni" aria-hidden="true">{ic("FaEye")}</span>Крупный шрифт и высокий контраст</button></li>'
                '<li><button type="button" class="sm-s" data-tm-still aria-pressed="false">Меньше анимаций</button></li>'
                '<li><a class="sm-s" href="profile.html">Мои данные: перенос, выгрузка, очистка</a></li>'
                '<li><a class="sm-s" href="plan.html">Учебный план таблицей и CSV</a></li>'
                '<li><a class="sm-s" href="about.html">О проекте</a></li><li><a class="sm-s" href="roadmap.html">Развитие сайта</a></li>'
                f'{fb}</ul><button type="button" class="st-back" id="setback" hidden>← Назад к меню</button></section>')
    total_ze = meta.get("total_ze", 240)
    facts = (f'<ul class="st-facts"><li><b>4</b><span>года</span></li><li><b>8</b><span>семестров</span></li>'
             f'<li><b>{total_ze}</b><span>з.е.</span></li><li><b>{len(items)}</b><span>позиции плана</span></li></ul>')
    body = f'''<main id="main" class="start"><div class="st-bg" aria-hidden="true">{start_art()}</div>
<div class="st-wrap"><div class="st-top"><a class="st-logo" href="index.html">{LOGO_SVG}<span class="st-lw">Teach<em>Map</em></span><span class="vh">: стартовый экран</span></a><p class="st-date" id="stdate" aria-hidden="true"></p><button type="button" class="st-menubtn" data-am-open aria-controls="appmenu" aria-expanded="false" aria-label="Меню"><span class="am-burger" aria-hidden="true"><i></i><i></i><i></i></span></button></div>
<div class="st-left"><h1 class="st-h1"><span class="st-k">{E(meta.get("program", "27.03.01"))} · ДВФУ</span><span class="st-ht">Учебный план простым языком</span></h1>
<p class="st-lead">От первого семестра до выбранной профессии: что изучают, как предметы связаны и куда ведут.</p><p class="st-mapgo"><a class="st-map" href="map.html">Открыть образовательную карту <span aria-hidden="true">→</span></a></p><p class="st-cta"><a class="st-go" id="stgo" href="path.html#journey"><span class="st-gi" aria-hidden="true"></span><span class="st-gt" id="stgot">Начать путь</span><span class="st-gd" id="stgod">от первого семестра до профессии</span></a></p>
<nav class="st-menu" id="stnav" aria-label="Главное меню"><ol id="stmenu">{lis}</ol></nav>{settings}
<form class="st-find" action="catalog.html" role="search"><label class="vh" for="stq">Найти предмет</label><input id="stq" name="q" type="search" placeholder="Найти предмет, например «метрология»"><button type="submit" aria-label="Найти">{ic("FaSearch")}</button></form></div>
<aside class="st-stat" aria-labelledby="stath"><h2 class="vh" id="stath">Программа и мой прогресс</h2><p class="st-sk">Программа</p>{facts}
<div class="st-me" id="stme" hidden></div><p class="st-note">Справочный студенческий проект, не официальный сайт ДВФУ. Данные плана сверены {E(meta["checked"])}.</p></aside></div></main>{tab_bar(0, "start")}'''
    # старые ссылки на путь студента (index.html#d=…, #route=…, #path=…, #journey) ведут на path.html — до отрисовки страницы
    # st-js ставится до отрисовки: подменю «Настройки» скрыто сразу, без сдвига экрана, когда скрипт загрузится позже
    head = ('<script>if(/^#(d|route|path)=|^#journey$/.test(location.hash))location.replace("path.html"+location.hash);'
            'document.documentElement.classList.add("st-js");if(location.hash==="#settings")document.documentElement.classList.add("st-setopen")</script>')
    return page("TeachMap: учебный план 27.03.01 «Стандартизация и метрология» ДВФУ простым языком", "Интерактивная карта учебного плана: дисциплины, связи между ними, путь по семестрам и профессии выпускников", body, start=True, head=head)
def settings_page():
    """Настройки: отображение и движение (хранятся в этом браузере), мои данные, служебные разделы."""
    row = lambda h, t, d: f'<li><a class="setrow" href="{h}"><b>{t}</b><span>{d}</span></a></li>'
    body = head_nav(0, "settings") + f'''<main id="main"><div class="heroblock"><div class="wrap"><section class="hero"><span class="line"></span><h1>Настройки</h1>
<p class="lead">Как сайт выглядит и двигается на этом устройстве, твои данные и всё о проекте.</p></section></div></div><div class="wrap setwrap">
<section class="panel setsec" aria-labelledby="set1"><h2 id="set1"><span class="ci">{ic("FaEye")}</span>Внешний вид</h2><ul class="setlist">
<li><button type="button" class="setrow settog" id="acc" aria-pressed="false"><b>Крупный шрифт и высокий контраст</b><span>Текст крупнее, рамки и подписи контрастнее, без наклонов и срезов</span></button></li>
</ul></section>
<section class="panel setsec" aria-labelledby="set1m"><h2 id="set1m"><span class="ci">{ic("FaSyncAlt")}</span>Движение</h2><ul class="setlist">
<li><button type="button" class="setrow settog" data-tm-still aria-pressed="false"><b>Меньше анимаций</b><span>Без появлений, срезов и переходов между страницами. Если в системе включено «уменьшение движения», анимаций нет и так</span></button></li></ul>
<p class="muted setnote" id="sysmot" aria-live="polite">Настройки сохраняются только в этом браузере.</p></section>
<section class="panel setsec" aria-labelledby="set2"><h2 id="set2"><span class="ci">{ic("FaUserLock")}</span>Мои данные</h2><ul class="setlist">
{row("profile.html", "Мой план", "Статусы, избранное, заметки; перенос на другое устройство файлом, таблица CSV, очистка")}</ul></section>
<section class="panel setsec" aria-labelledby="set3"><h2 id="set3"><span class="ci">{ic("FaLightbulb")}</span>О сайте</h2><ul class="setlist">
{row("plan.html", "Учебный план таблицей", "Все позиции плана, печать в PDF и выгрузка CSV")}{row("about.html", "О проекте", "Откуда данные, кто пишет описания, как считаются оценки")}
{row("roadmap.html", "Развитие сайта", "Концепция и этапы развития")}{row("feedback.html", "Обратная связь", "Расскажите, что получилось, а что нет") if FB_ON else ""}</ul></section></div></main>'''
    body = dark_head(body, "Настройки")
    return page("Настройки · TeachMap", "Крупный шрифт и контраст, меньше анимаций, мои данные и сведения о проекте", body)
def profile_page():
    # для «Моего плана»: название, семестры, предметы «нужен» (для подсказок «что дальше»), код позиции плана (для CSV)
    names = json.dumps({i["slug"]: [clean(i["name"]), str(i["sem"]), [x for x, t, _ in links_of(i["slug"])[0] if t == "need"], i["idx"]] for i in items}, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    jn = json.dumps([j[1] for j in JOBS], ensure_ascii=False).replace("</", "<\\/")
    jk = json.dumps([list(j[3]) for j in JOBS], ensure_ascii=False).replace("</", "<\\/")   # ключевые предметы профессий (для «Моего маршрута»)
    icons = "".join(f'<span data-i="{k}">{ic(v)}</span>' for k, v in (("next", "FaMapMarkedAlt"), ("doing", "FaBookOpen"), ("done", "FaCheck"), ("fav", "FaStar"), ("jobs", "FaBriefcase"),
                                                                         ("notes", "FaCommentDots"), ("recent", "FaRegClock"), ("data", "FaUserLock"), ("start", "FaRocket")))
    head = ('<div class="cathead phead"><div class="wrap"><nav class="crumbs" aria-label="Путь"><a href="index.html">TeachMap</a> › Профиль</nav><h1>Мой план</h1>'
            '<p class="lead">Статусы предметов, избранное, интересные профессии, текущий семестр и заметки — без регистрации. Всё хранится только в этом браузере.</p></div></div>')
    body = head_nav(0, "profile") + f'''<main id="main" class="profpage">{head}<div class="wrap pgrid">
<noscript><p class="panel">Для личного плана нужен включённый JavaScript.</p></noscript>
<div id="profile" data-total="{len(items)}" data-ze="{meta.get("total_ze") or ""}" data-years="{(max(x for i in items for x in sem_list(i["sem"])) + 1) // 2}" data-sems="{max(x for i in items for x in sem_list(i["sem"]))}"></div>
<section class="panel mypriv"><h2><span class="ci">{ic("FaUserLock")}</span>Где хранятся данные</h2><p>Только в этом браузере на этом устройстве. Сами на другой телефон или компьютер они не переносятся и пропадут, если очистить данные сайта в браузере; перенести их можно файлом (раздел «Перенос и очистка»). На сервер ничего не отправляется. Статусы — личные пометки для планирования, а не оценки, зачёты или подтверждённая успеваемость.</p></section>
</div></main><template id="part">{disc_art("my-profile", 1, "FaUserGraduate")}</template><template id="pico">{icons}</template><script type="application/json" id="pnames">{names}</script><script type="application/json" id="pjobs">{jn}</script><script type="application/json" id="pjk">{jk}</script>'''
    return page("Мой план · TeachMap", "Статусы предметов, избранное, профессии и заметки: хранятся только в вашем браузере", body)
def build():
    if OUT.exists(): shutil.rmtree(OUT)
    (OUT/"d").mkdir(parents=True); shutil.copytree(ROOT/"assets", OUT/"assets", ignore=shutil.ignore_patterns("icons.json")); minify_assets(OUT/"assets")
    cards = {it["slug"]: read_card(it["slug"]) for it in items}; order = sorted(items, key=SORT)
    (OUT/"index.html").write_text(start_page(), encoding="utf-8"); (OUT/"path.html").write_text(path_page(cards), encoding="utf-8"); (OUT/"catalog.html").write_text(home_page(cards), encoding="utf-8")
    for k, it in enumerate(order): (OUT/"d"/f'{it["slug"]}.html').write_text(disc_page(it, cards[it["slug"]], order, k), encoding="utf-8")
    (OUT/"roadmap.html").write_text(road_page(), encoding="utf-8"); (OUT/"jobs.html").write_text(jobs_page(), encoding="utf-8"); (OUT/"map.html").write_text(map_page(cards), encoding="utf-8"); (OUT/"plan.html").write_text(plan_page(cards), encoding="utf-8"); (OUT/"plan.csv").write_text(plan_csv(), encoding="utf-8", newline=""); (OUT/"profile.html").write_text(profile_page(), encoding="utf-8"); (OUT/"settings.html").write_text(settings_page(), encoding="utf-8"); (OUT/"about.html").write_text(about_page(), encoding="utf-8"); (OUT/"feedback.html").write_text(feedback_page(), encoding="utf-8")
    (OUT/"404.html").write_text(page("Страница не найдена · TeachMap","Такой страницы на TeachMap нет: вернитесь на стартовый экран или откройте список дисциплин учебного плана 27.03.01.",head_nav(0,"")+'<main id="main" class="wrap"><section class="hero"><h1>Страница не найдена</h1><p><a href="index.html">Вернуться на главную</a></p></section></main>'), encoding="utf-8")
    # манифест: сайт можно добавить на главный экран телефона и открывать без адресной строки, как приложение
    (OUT/"manifest.webmanifest").write_text(json.dumps({"name": "TeachMap — учебный план простым языком", "short_name": "TeachMap", "lang": "ru",
        "description": "Учебный план 27.03.01 ДВФУ: дисциплины, связи, путь по семестрам и профессии", "start_url": "./index.html", "scope": "./",
        "display": "standalone", "orientation": "portrait", "background_color": "#0E2550", "theme_color": "#173B70",
        "icons": [{"src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png"},
                  {"src": "assets/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT/".nojekyll").write_text("")
    print(f"Готово: {len(items)} страниц дисциплин, {sum(1 for c in cards.values() if c['what'])} с текстами. Папка: {OUT}")
if __name__ == "__main__": build()
