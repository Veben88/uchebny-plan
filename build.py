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
def ic(n): return ICONS.get(n, "")
# отпечаток версии файлов сайта: меняется при любой правке стилей и скриптов, поэтому браузер не показывает старое из кэша
ASSET_V = hashlib.md5(b"".join((ROOT/"assets"/f).read_bytes() for f in ("style.css","app.js","live.js","path.js","feedback.js","tasks.js","form.js") if (ROOT/"assets"/f).exists())).hexdigest()[:8]
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
ICON_BODY = '<rect x="2" y="2" width="60" height="60" rx="14" fill="#E60023" stroke="#101010" stroke-width="3"/><path d="M15 48.5 C 24 48.5, 20 34, 30 34 S 40 30, 46 27" fill="none" stroke="#101010" stroke-width="8" stroke-linecap="round"/><path d="M15 48.5 C 24 48.5, 20 34, 30 34 S 40 30, 46 27" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="15" cy="48.5" r="8.6" fill="#fff" stroke="#101010" stroke-width="2.4"/><circle cx="30" cy="34" r="8.2" fill="#fff" stroke="#101010" stroke-width="2.4"/><g transform="translate(15 48.5)" fill="none" stroke="#101010" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M-4.6 -3.4 H4.6"/><path d="M-2.1 -3.4 V3.6"/><path d="M2.1 -3.4 V1.7 Q2.1 3.7 4.1 3.7"/></g><g transform="translate(30 34)" fill="none" stroke="#101010" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M0 -2.5 C-1.6 -3.8 -3.6 -3.9 -5.1 -3.1 V3.1 C-3.6 2.4 -1.6 2.5 0 3.7 C1.6 2.5 3.6 2.4 5.1 3.1 V-3.1 C3.6 -3.9 1.6 -3.8 0 -2.5 Z"/><path d="M0 -2.5 V3.7"/></g><path d="M47 8 c-6.3 0-11 4.6-11 10.6 0 7.4 11 18.4 11 18.4 s11-11 11-18.4 C58 12.6 53.3 8 47 8 z" fill="#101010" stroke="#101010" stroke-width="2.4" stroke-linejoin="round"/><circle cx="47" cy="18.6" r="4" fill="#fff" stroke="#101010" stroke-width="2"/>'
LOGO_SVG = '<svg class="tmlogo" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + ICON_BODY + '</svg>'
HERO3D = ('<div class="hero3d" aria-hidden="true"><span class="g3 ring"></span><span class="g3 plate"></span><span class="g3 cube">'
          '<svg viewBox="0 0 64 64">' + ICON_BODY + '</svg></span></div>')

SITE = "TeachMap"; SITE_URL = "https://veben88.github.io/uchebny-plan/"
def head_nav(depth, active, band=False):
    b = "../"*depth
    NAV = (("home","index.html","Путь студента","Путь","FaMapMarkedAlt"),("cat","catalog.html","Все дисциплины","Каталог","FaBookOpen"),("road","roadmap.html","Развитие сайта","Планы","FaRocket"),("about","about.html","О проекте","Проект","FaLightbulb")) + ((("fb","feedback.html","Обратная связь","Отзыв","FaCommentDots"),) if FB_ON else ())
    links = "".join(f'<a href="{b}{h}"{" aria-current=page" if k==active else ""}><span class="ni" aria-hidden="true">{ic(i)}</span><span class="nt">{t}</span><span class="ns" aria-hidden="true">{sh}</span></a>' for k,h,t,sh,i in NAV)
    return (f'<header class="top wrap"><a class="brand" href="{b}index.html" aria-label="TeachMap, на главную">{LOGO_SVG}<span class="bw"><b>Teach<em>Map</em></b><small>учебный план простым языком</small></span></a>'
            f'<nav class="menu" aria-label="Разделы">{links}<button type="button" class="acc" id="acc" aria-pressed="false" title="Крупный шрифт и высокий контраст"><span class="ni" aria-hidden="true">{ic("FaEye")}</span><span>Крупно</span></button></nav></header>')
def footer_html(b=""):
    contact = f'<p>Контакты: {E(CONTACT)}</p>' if CONTACT else ""
    if FB_ON: contact += f'<p><a href="{b}feedback.html">Обратная связь: расскажите, что улучшить</a></p>'
    return (f'<footer><div class="wrap"><p><b>TeachMap: проект студентов ДВФУ.</b> Это не официальный сайт вуза: информация справочная и не заменяет рабочий учебный план и консультацию приёмной комиссии.</p>'
            f'<p>Источник данных: {E(meta["plan"])}, {E(meta["approved"])}. Данные сверены {E(meta["checked"])}.</p>{contact}</div></footer>')
def page(title, desc, body, depth=0, live=False, path=False, form=False):
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
    return f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)}</title><meta name="description" content="{E(desc)}"><meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}"><meta name="theme-color" content="#3b4f86">{lm}{fm}
<link rel="icon" type="image/svg+xml" href="{b}assets/logo-icon.svg"><link rel="apple-touch-icon" href="{b}assets/apple-touch-icon.png"><meta property="og:site_name" content="TeachMap"><meta property="og:image" content="{SITE_URL}assets/og.png"><meta property="og:type" content="website">
<link rel="preload" href="{b}assets/fonts/montserrat.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="{b}assets/style.css?v={ASSET_V}"></head><body>
<a class="skip" href="#main">К содержимому</a>{body.replace('<div class="heroblock">', '<div class="heroblock">' + HERO3D)}{footer_html(b)}<script src="{b}assets/app.js?v={ASSET_V}" defer></script>{lj}</body></html>'''
def card_html(it, c):
    st = c["status"] if c["status"] in STATUS else "готовится"; g = gi(it)
    ch = "".join(f'<span class="chip{" hot" if h else ""}">{t}</span>' for t,h in chips(it))
    blurb = c["what"] or c["brief"] or "Описание готовится."
    if len(blurb) > 120: blurb = blurb[:117].rsplit(" ",1)[0] + "…"
    label = ("По выбору: " if it["type"] == "По выбору" else "") + clean(it["name"])
    hay = E((it["name"]+" "+c["what"]+" "+c["brief"]+" "+c["learn"]+" "+c["themes"]+" "+c["tools"]).lower())
    return (f'<a class="card" href="d/{it["slug"]}.html" data-sem="{start_sem(it["sem"])}" data-group="{GKEYS[g]}" data-kr="{1 if re.search("К[РП]",it["controls"] or "") else 0}" data-lab="{1 if it["lab"] else 0}" data-text="{hay}">'
            f'<span class="gi g-{g}" aria-hidden="true">{ic(GROUPS[GKEYS[g]][1])}</span>'
            f'<div class="row"><div class="ze"><b>{ze_num(it)}</b><span>з.е.</span></div><div><div class="sem">{E(str(it["sem"]))} сем. · {n(it["hours"])} ч</div><h3>{E(label)}</h3></div></div>'
            f'<p>{E(blurb)}</p><div class="chips">{ch}</div><span class="badge {STATUS[st][1]}">{STATUS[st][0]}</span></a>')
SORT = lambda x: (start_sem(x["sem"]) or 99, gi(x), x["idx"])
def home_page(cards):
    order = sorted(items, key=SORT); n_ready = sum(1 for c in cards.values() if c["what"])
    tiles = "".join(f'<button type="button" class="tile" data-f="group" data-v="{g}" aria-pressed="false"><span class="big" aria-hidden="true">{ic(GROUPS[g][1])}</span><b>{g}</b><span>{GROUPS[g][2]}</span><em>{sum(1 for i in items if group_of(i["type"])==g)}</em></button>' for g in GKEYS)
    sems = sorted({start_sem(i["sem"]) for i in items if start_sem(i["sem"])})
    pills = "".join(f'<button type="button" class="pill" data-f="sem" data-v="{s}" aria-pressed="false">{s} семестр<small>{sum(1 for i in items if start_sem(i["sem"])==s)}</small></button>' for s in sems)
    survey = f'<p><a class="btn" href="{E(SURVEY_URL)}">Пройти опрос студентов</a></p>' if SURVEY_URL else ""
    body = head_nav(0, "cat") + f'''<main id="main"><div class="heroblock"><div class="wrap"><section class="hero"><span class="line"></span><h1>Что тебя ждёт на «Стандартизации и метрологии»</h1>
<p class="lead">Учебный план ДВФУ простым языком: что изучают, зачем это нужно в профессии, насколько большая нагрузка и что говорят студенты.</p>{survey}
<p class="muted">{len(items)} позиций плана, описания готовы для {n_ready}. У остальных карточек пока только нагрузка из плана.</p><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
<div class="tiles" role="group" aria-label="Раздел плана">{tiles}</div></section></div></div>
<section class="wrap" id="list"><div class="sems" role="group" aria-label="Семестр">{pills}</div>
<div class="tools"><input id="q" type="search" placeholder="Найти предмет, например «метрология»" aria-label="Поиск по предметам"><button type="button" class="pill" data-f="kr" data-v="1" aria-pressed="false">Есть курсовая</button><button type="button" class="pill" data-f="lab" data-v="1" aria-pressed="false">С лабораторными</button></div>
<p id="count" class="muted" aria-live="polite"></p><div class="grid" id="grid">{"".join(card_html(i, cards[i["slug"]]) for i in order)}</div>
<p id="empty" class="muted" hidden>Ничего не нашлось. Попробуй другое слово или сбрось фильтры.</p></section></main>'''
    return page("Все дисциплины 27.03.01 Стандартизация и метрология ДВФУ · TeachMap","Понятное описание дисциплин направления 27.03.01 ДВФУ: что изучают, нагрузка и оценки студентов", body)
def task_panel(c, slug):
    if not c["example"]: return ""
    note = '' if c["status"] == "проверено" else '<p class="muted" style="margin-top:8px">Черновик задания: формулировку проверит преподаватель.</p>'
    ans = f'<details class="ans"><summary>Что это показывает</summary><p>{E(c["answer"])}</p></details>' if c["answer"] else ""
    return (f'<section class="panel"><h2><span class="ci">{ic("FaChalkboardTeacher")}</span>Попробуй сам</h2><p>{E(c["example"])}</p>'
            f'<div class="task" data-task="{E(slug)}"></div>{ans}{note}</section>')
def disc_page(it, c, order, k):
    st = c["status"] if c["status"] in STATUS else "готовится"; name = clean(it["name"]); g = gi(it)
    def panel(icon, t, v): return f'<section class="panel"><h2><span class="ci">{ic(icon)}</span>{t}</h2><p>{E(v)}</p></section>' if v else ""
    what = panel("FaBookOpen","Что это", c["what"] or c["brief"]) or '<section class="panel"><h2><span class="ci">'+ic("FaBookOpen")+'</span>Что это</h2><p class="muted">Описание этой дисциплины готовится.</p></section>'
    why = panel("FaLightbulb","Зачем нужно в профессии", c["why"])
    row = f'<div class="two">{what}{why}</div>' if why else what
    def panel_ul(icon, t, items): return f'<section class="panel"><h2><span class="ci">{ic(icon)}</span>{t}</h2><ul class="bl">' + "".join(f"<li>{E(x)}</li>" for x in items) + "</ul></section>" if items else ""
    extra_top = panel_ul("FaStar", "Чему научишься", blist(c["learn"])) + panel_ul("FaBookOpen", "Темы курса", tlist(c["themes"])) + panel("FaChalkboardTeacher", "Что делаешь на занятиях", c["acts"])
    extra_bot = panel_ul("FaTools", "Инструменты и оборудование", blist(c["tools"])) + panel("FaClipboardCheck", "Как проверяют", c["assess"])
    prev = f'<a href="{order[k-1]["slug"]}.html">← {E(cut(order[k-1]["name"]))}</a>' if k else "<span></span>"
    nxt = f'<a href="{order[k+1]["slug"]}.html">{E(cut(order[k+1]["name"]))} →</a>' if k+1 < len(order) else ""
    body = f'''<div class="band">{head_nav(1,"cat")}<div class="wrap"><nav class="crumbs" aria-label="Путь"><a href="../catalog.html">Все дисциплины</a> › {E(str(it["sem"]))} семестр</nav>
<h1>{E(("По выбору: " if it["type"]=="По выбору" else "")+name)}</h1><p class="meta">{E(it["idx"])} · {E(it["type"])} · {n(it["ze"]) or "вне"} з.е. · {n(it["hours"])} ч · {E(str(it["sem"]))} семестр</p><span class="badge {STATUS[st][1]}">{STATUS[st][0]}</span></div></div>
<main id="main" class="wrap">{row}{extra_top}{task_panel(c, it["slug"])}{panel("FaUsers","Совет студента", c["tip"])}
<section class="panel"><h2><span class="ci">{ic("FaChartBar")}</span>Нагрузка по плану</h2>{load_bar(it)}<p>Контактных часов: <b>{n(it["contact"])}</b> из {n(it["hours"])}. Формы контроля: <b>{E(it["controls"] or "—")}</b> <span class="muted">(Эк — экзамен, За — зачёт, ЗаО — зачёт с оценкой, КР — курсовая работа, КП — курсовой проект, К — контрольная, Оц — оценка, РГР — расчётно-графическая работа)</span></p></section>
{extra_bot}<section class="panel" id="ratings" data-slug="{it["slug"]}"><h2><span class="ci">{ic("FaStar")}</span>Оценки студентов</h2>{rating_block(it["slug"])}</section>
{f'<section class="panel" id="fb" data-slug="{it["slug"]}"></section>' if FEEDBACK_URL else ""}
{f'<p class="muted fberr">Нашли ошибку в описании? <a href="../feedback.html?d={it["slug"]}">Сообщить об ошибке</a></p>' if FB_ON else ""}
<nav class="pager" aria-label="Соседние предметы">{prev}{nxt}</nav></main>'''
    return page(f"{name}: что изучают и какая нагрузка · TeachMap", c["what"] or c["brief"] or name, body, 1, live=True)
STAGES = [
 ("1","Осень 2026","Запуск","now",[("done","Сайт со всеми 74 позициями учебного плана"),("done","Поиск и фильтры: семестр, раздел, курсовые, лабораторные"),("done","Оценки из опроса подгружаются сами, раз в час"),("doing","Опрос студентов: минимум 5 ответов на предмет"),("doing","Описания карточек: готово 18 из 74"),("plan","Проверка описаний преподавателями"),("plan","Тест сайта на абитуриентах")]),
 ("2","2027","Пилот в ДВФУ","",[("plan","Кабинет института: правка и подтверждение описаний"),("plan","Право ответа кафедры на оценки"),("plan","Админка: правка текстов прямо на сайте"),("plan","Оценки по направлению и году поступления"),("plan","ИИ-анализ отзывов с проверкой человеком")]),
 ("3","2028","Вузы Владивостока","",[("plan","Поиск по всем программам вуза"),("plan","Сравнение двух направлений рядом"),("plan","Уроки для школ на базе карточек"),("plan","Сопоставление оценок с показателями дисциплин")]),
 ("4","2029–2031","Регион и Россия","",[("plan","Тест «подходит ли мне специальность»"),("plan","Поиск «от профессии к предметам»"),("plan","Версии на китайском и корейском"),("plan","Карта освоения компетенций"),("plan","Другие специальности и вузы")])]
ICON_OF = {"done":"FaCheck","doing":"FaSyncAlt","plan":"FaRegClock"}
def road_page():
    pr = "".join(f'<div class="pr"><span class="ci">{ic(i)}</span><h3>{t}</h3><p>{d}</p></div>' for i,t,d in (
        ("FaLightbulb","Понятно","Язык школьника вместо канцелярита: что изучают и зачем."),("FaClipboardCheck","Честно","У каждой карточки есть источник, дата и статус проверки. Оценки видны от 5 ответов."),
        ("FaUserLock","Безопасно","Опрос анонимный, на сайт попадает только сводка, личные данные не собираются."),("FaEye","Доступно","Работает на телефоне, без регистрации, есть крупный шрифт и высокий контраст.")))
    who = "".join(f'<div class="pr"><span class="ci">{ic(i)}</span><h3>{t}</h3><p>{d}</p></div>' for i,t,d in (
        ("FaUserGraduate","Абитуриенты","Бесплатно видят, что их ждёт на специальности, ещё до подачи документов."),("FaUsers","Студенты","Анонимно оценивают предметы и дают советы тем, кто придёт после."),("FaUniversity","Вузы и школы","Публикуют проверенные описания, получают обратную связь и материалы для профориентации.")))
    st = "".join(f'<div class="stage {s[3]}"><div class="num">{s[0]}</div><div class="box"><div class="when">{s[1]}{" · сейчас" if s[3] else ""}</div><h3>{s[2]}</h3><ul>'+"".join(f'<li class="{k}">{ic(ICON_OF[k])}<span>{E(t)}</span></li>' for k,t in s[4])+'</ul></div></div>' for s in STAGES)
    body = head_nav(0, "road") + f'''<main id="main"><div class="heroblock"><div class="wrap"><section class="hero"><span class="line"></span><h1>Как будет развиваться сайт</h1>
<p class="lead">Как сайт будет расти: от справочника по одной специальности до платформы, которая объясняет программы вузов региона.</p><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div></section></div></div><div class="wrap">
<h2 style="color:var(--pri)">Концепция</h2><p class="muted" style="max-width:70ch">Сайт переводит официальный учебный план на язык абитуриента и добавляет то, чего нет в документе: оценки студентов и примеры заданий. Четыре принципа:</p><div class="principles">{pr}</div>
<h2 style="color:var(--pri)">Для кого</h2><div class="principles">{who}</div>
<h2 style="color:var(--pri)">Этапы развития</h2><div class="legend"><span>{ic("FaCheck")}сделано</span><span>{ic("FaSyncAlt")}в работе</span><span>{ic("FaRegClock")}планируется</span></div><div class="road">{st}</div></div></main>'''
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
    body = head_nav(0, "about") + f'''<main id="main"><div class="heroblock"><div class="wrap"><section class="hero"><span class="line"></span><h1>О проекте TeachMap</h1><p class="lead">Официальный учебный план написан для проверяющих. TeachMap объясняет его абитуриентам простым языком: чем придётся заниматься и насколько будет трудно.</p></section></div></div><div class="wrap">
<div class="doc"><h2>Что важно знать</h2><p>Сайт показывает данные плана 27.03.01 «Стандартизация и метрология» ДВФУ и оценки студентов. Мы не собираем имена и почту, цитаты публикуем только с согласия студента.</p>{survey}{contact}</div>
<h2 style="color:var(--pri)">Частые вопросы</h2>{fq}</div></main>'''
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
JOBS = [
 ("FaRulerCombined","Инженер-метролог","Отвечает за точность измерений: выбирает приборы, организует поверку и калибровку, проверяет методики.",["b1-o-19-01-04","b1-o-19-05","b1-o-19-06","b1-v-14","b1-v-17","b1-o-18-02"],"инженер-метролог"),
 ("FaBookOpen","Инженер по стандартизации","Разрабатывает и проверяет стандарты предприятия и техническую документацию, следит за их соответствием требованиям.",["b1-o-19-01-06","b1-o-19-08","b1-o-19-01-02","b1-o-18-10","b1-o-19-01-01"],"инженер по стандартизации"),
 ("FaShieldAlt","Специалист по сертификации","Подтверждает, что продукция и услуги соответствуют требованиям: готовит документы, работает с органами по сертификации и лабораториями.",["b1-o-19-01-07","b1-v-16","b1-v-10","b1-o-19-01-01"],"специалист по сертификации"),
 ("FaChartBar","Инженер по качеству","Строит и поддерживает систему качества, анализирует данные и ищет причины брака на производстве.",["b1-o-19-01-05","b1-v-06","b1-o-19-03","b1-v-11","b1-v-03","b1-o-19-01-08"],"инженер по качеству"),
 ("FaClipboardCheck","Аудитор систем качества","Проверяет, как работает система менеджмента качества в организации, и предлагает улучшения.",["b1-v-15","b1-o-19-01-05","b1-v-05","b1-v-04"],"аудитор систем менеджмента качества"),
 ("FaTools","Инженер-испытатель","Проводит испытания продукции по методикам, обрабатывает результаты и оформляет протоколы.",["b1-v-10","b1-o-19-07","b1-o-19-05","b1-o-19-01-09","b1-o-18-06"],"инженер-испытатель")]
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
            "r": ({"n": r.get("n",0), "hard": r.get("hard"), "useful": r.get("useful"), "int": r.get("interest"), "scope": r.get("scope","")} if r.get("n",0) >= MIN_N else None)}
    return {"items": out, "jobs": [{"i": j[0], "t": j[1], "d": j[2], "s": j[3]} for j in JOBS], "status": STATUS, "min_n": MIN_N}
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
        sts.append(f'<li class="station" data-sem="{s}" data-course="{(s+1)//2}"><div class="node"><b>{s}</b><span>семестр</span></div><div class="stbody">'
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
    data = json.dumps(path_data(cards), ensure_ascii=False).replace("</", "<\\/")
    hero = ('<div class="heroblock"><div class="wrap"><section class="hero"><span class="line"></span><h1>Путь студента: от первого семестра до профессии</h1>'
            '<p class="lead">Пройди специальность 27.03.01 «Стандартизация и метрология» за пару минут: листай семестры, открывай карточки предметов и смотри, кем сможешь работать в конце.</p>'
            f'<form class="hsearch" action="catalog.html" role="search"><span class="hs-i">{ic("FaSearch")}</span><input name="q" type="search" placeholder="Найти предмет, например «метрология»" aria-label="Поиск по предметам"><button type="submit" aria-label="Найти">{ic("FaArrowRight")}</button></form><p><a class="btn" href="#journey">Начать путь {ic("FaArrowRight")}</a></p><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>'
            f'<div class="facts"><span><i>{ic("FaRegClock")}</i><b>4</b> года</span><span><i>{ic("FaLayerGroup")}</i><b>8</b> семестров</span><span><i>{ic("FaChartBar")}</i><b>240</b> з.е.</span><span><i>{ic("FaUserGraduate")}</i><b>{len(JOBS)}</b> профессий на финише</span></div></section></div></div>')
    finale = (f'<li class="station finale" data-sem="9"><div class="node">{ic("FaUserGraduate")}</div><div class="stbody"><div class="sthead"><span class="kicker">Финиш</span><h2>Диплом и работа</h2>'
              '<p>Типичные должности выпускников направления. Нажми «Показать путь к профессии», чтобы подсветить на карте предметы, которые к ней ведут. '
              '<span class="muted">Список составлен по профессиональным задачам из учебного плана; требования и зарплаты смотри в вакансиях.</span></p></div>'
              f'<div class="jobs">{jobs}</div></div></li>')
    journey = (f'<div class="wrap"><div class="journey" id="journey"><div class="jbar"><span class="jpos" id="jpos" aria-live="polite">Старт: 1 курс</span>'
               f'<div class="jprog" aria-hidden="true"><i id="jfill"></i></div><span id="jpct">0%</span></div>'
               f'<div class="gfs" role="group" aria-label="Подсветить раздел плана">{legend}</div><ol class="track" id="track">{"".join(sts)}{finale}</ol></div></div>')
    pill = f'<div class="hlpill" id="hlpill" hidden><span id="hltext"></span><button type="button" id="hlclear">Снять подсветку</button></div>'
    body = head_nav(0, "home") + f'<main id="main">{hero}{journey}</main>{pill}<script type="application/json" id="pd">{data}</script>'
    return page("TeachMap: путь студента по направлению 27.03.01 Стандартизация и метрология ДВФУ", "Интерактивный путь по специальности: семестры, предметы и профессии выпускников", body, path=True)

def build():
    if OUT.exists(): shutil.rmtree(OUT)
    (OUT/"d").mkdir(parents=True); shutil.copytree(ROOT/"assets", OUT/"assets", ignore=shutil.ignore_patterns("icons.json"))
    cards = {it["slug"]: read_card(it["slug"]) for it in items}; order = sorted(items, key=SORT)
    (OUT/"index.html").write_text(path_page(cards), encoding="utf-8"); (OUT/"catalog.html").write_text(home_page(cards), encoding="utf-8")
    for k, it in enumerate(order): (OUT/"d"/f'{it["slug"]}.html').write_text(disc_page(it, cards[it["slug"]], order, k), encoding="utf-8")
    (OUT/"roadmap.html").write_text(road_page(), encoding="utf-8"); (OUT/"about.html").write_text(about_page(), encoding="utf-8"); (OUT/"feedback.html").write_text(feedback_page(), encoding="utf-8")
    (OUT/"404.html").write_text(page("Страница не найдена · TeachMap","",head_nav(0,"")+'<main id="main" class="wrap"><section class="hero"><h1>Страница не найдена</h1><p><a href="index.html">Вернуться на главную</a></p></section></main>'), encoding="utf-8")
    (OUT/".nojekyll").write_text("")
    print(f"Готово: {len(items)} страниц дисциплин, {sum(1 for c in cards.values() if c['what'])} с текстами. Папка: {OUT}")
if __name__ == "__main__": build()
