#!/usr/bin/env python3
"""Сборка сайта: data/plan.json + content/*.md + data/ratings.json -> папка site/"""
import json, re, shutil, html, sys
from pathlib import Path
ROOT = Path(__file__).parent; OUT = ROOT / "site"
E = html.escape
plan = json.loads((ROOT/"data/plan.json").read_text(encoding="utf-8"))
meta, items = plan["meta"], plan["disciplines"]
cfg_p = ROOT/"data/config.json"
cfg = json.loads(cfg_p.read_text(encoding="utf-8")) if cfg_p.exists() else {}
def fetch_csv(url):
    """Скачивает опубликованный CSV из Google Таблицы. При любой ошибке возвращает None, и сайт собирается из локальных файлов."""
    if not url: return None
    import urllib.request, csv, io
    try:
        with urllib.request.urlopen(url, timeout=30) as r: text = r.read().decode("utf-8-sig")
        return list(csv.DictReader(io.StringIO(text)))
    except Exception as e:
        print(f"ВНИМАНИЕ: не удалось загрузить таблицу ({e}). Используются локальные файлы.", file=sys.stderr); return None
def num(v):
    v = (v or "").strip().replace(",", ".")
    try: return float(v) if "." in v else int(v)
    except ValueError: return None
rp = ROOT/"data/ratings.json"
ratings = json.loads(rp.read_text(encoding="utf-8")) if rp.exists() else {}
_rr = fetch_csv(cfg.get("ratings_csv"))
if _rr is not None:
    ratings = {}
    for r in _rr:
        code = (r.get("Код") or "").strip()
        if code: ratings[code] = {"n": num(r.get("Ответов")) or 0, "hard": num(r.get("Сложность")), "useful": num(r.get("Польза")), "interest": num(r.get("Интерес")), "scope": (r.get("Охват") or "").strip()}
    print(f"Оценки: из таблицы, предметов {len(ratings)}")
_tr = fetch_csv(cfg.get("texts_csv"))
SHEET = None
if _tr is not None:
    SHEET = {(r.get("Код") or "").strip(): r for r in _tr if (r.get("Код") or "").strip()}
    print(f"Тексты: из таблицы, строк {len(SHEET)}")
MIN_N = 5
cfgp = ROOT/"data/config.json"
CONFIG = json.loads(cfgp.read_text(encoding="utf-8")) if cfgp.exists() else {}
RATINGS_URL = (CONFIG.get("ratings_url") or "").strip()
GROUPS = {"Профильные": ("Профессиональный блок","Вариативная часть","По выбору"), "Политехнические": ("Политехнический модуль",), "Общие": ("Общая часть","Факультатив"), "Практики и ГИА": ("Практика","ГИА")}
def group_of(t):
    for g, ts in GROUPS.items():
        if t in ts: return g
    return "Общие"
KEYS = {"Статус":"status","Кратко":"brief","Что это":"what","Зачем нужно":"why","Пример задания":"example","Совет студента":"tip"}
def read_card(slug):
    d = {v: "" for v in KEYS.values()}; d["status"] = "готовится"
    if SHEET is not None and slug in SHEET:
        row = SHEET[slug]
        for k, v in KEYS.items(): d[v] = (row.get(k) or "").strip()
        if d["status"].lower() not in STATUS:
            if d["status"]: print(f"ВНИМАНИЕ: у {slug} неизвестный статус «{d['status']}», поставлено «готовится»", file=sys.stderr)
            d["status"] = "готовится"
        else: d["status"] = d["status"].lower()
        return d
    p = ROOT/"content"/f"{slug}.md"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                if k.strip() in KEYS: d[KEYS[k.strip()]] = v.strip()
    return d
def n(x): return "" if x is None else x
def ze_txt(it): return f'{it["ze"]} з.е.' if it["ze"] else "вне з.е."
def cut(t, k=38):
    t = re.sub(r"^ДВ:\s*", "", t)
    return t if len(t) <= k else t[:k].rsplit(" ", 1)[0] + "…"
def start_sem(s):
    m = re.search(r"\d", str(s)); return int(m.group()) if m else 0
def chips(it):
    c = it["controls"] or ""; out = []
    if re.search(r"КП", c): out.append(("курсовой проект", 1))
    if re.search(r"КР", c): out.append(("курсовая работа", 1))
    if it["lab"]: out.append(("лабораторные", 0))
    if "Эк" in c: out.append(("экзамен", 0))
    return out
STATUS = {"проверено": ("Проверено преподавателем","ok"), "черновик": ("Черновик команды","draft"), "готовится": ("Описание готовится","wip")}
def load_bar(it):
    tot = it["hours"] or 0
    if not tot: return ""
    lec, lab, pr, contact = (it[k] or 0 for k in ("lec","lab","pr","contact"))
    sr = max(tot - contact, 0)
    segs = [("Лекции",lec,"s1"),("Лабораторные",lab,"s2"),("Практика",pr,"s3"),("Самостоятельно и контроль",sr,"s4")]
    if not (lec or lab or pr): segs = [("Контактная работа",contact,"s1"),("Самостоятельно и контроль",sr,"s4")]
    bar = "".join(f'<i class="{c}" style="width:{v/tot*100:.1f}%" title="{l}: {v} ч"></i>' for l,v,c in segs if v)
    leg = "".join(f'<li><i class="{c}"></i>{l} {v} ч</li>' for l,v,c in segs if v)
    return f'<div class="bar" role="img" aria-label="Распределение часов">{bar}</div><ul class="leg">{leg}</ul>'
def rating_block(slug):
    r = ratings.get(slug); nn = (r or {}).get("n", 0)
    if not r or nn < MIN_N:
        return f'<p class="muted">Оценок студентов пока недостаточно ({nn} из {MIN_N} нужных для показа). Опрос продолжается.</p>'
    def cell(t, v): return f'<div class="meter"><b>{v if v is not None else "—"}</b><span>{t}</span></div>' if v is not None else ""
    scope = E(r.get("scope","")) or "студенты, прошедшие предмет"
    return ('<div class="meters">'+cell("Сложность, 1–5",r.get("hard"))+cell("Польза для профессии, 1–5",r.get("useful"))+
            (f'<div class="meter"><b>{r["interest"]}</b><span>раз отмечен среди самых интересных</span></div>' if r.get("interest") else "")+
            f'</div><p class="muted">Ответили: {nn}. Оценили: {scope}. Медианные значения.</p>')
BASE = lambda p: "../" if p else ""
def page(title, desc, body, depth=0, active="", live=False):
    b = "../"*depth
    live_meta = f'<meta name="ratings-url" content="{E(RATINGS_URL)}">' if (live and RATINGS_URL) else ""
    live_js = f'<script src="{b}assets/live.js" defer></script>' if (live and RATINGS_URL) else ""
    nav = "".join(f'<a href="{b}{h}"{" aria-current=page" if k==active else ""}>{t}</a>' for k,h,t in (("home","index.html","Дисциплины"),("about","about.html","О проекте")))
    return f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)}</title><meta name="description" content="{E(desc)}"><meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}"><meta name="theme-color" content="#4a5378">{live_meta}
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E📐%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="{b}assets/style.css"></head><body>
<header class="top"><a class="brand" href="{b}index.html">Учебный план <span>простым языком</span></a><nav>{nav}</nav></header>
<main>{body}</main>
<footer><p>Проект студентов ДВФУ. Это не официальный сайт вуза: информация справочная и не заменяет рабочий учебный план и консультацию приёмной комиссии.</p>
<p>Источник данных: {E(meta["plan"])}, {E(meta["approved"])}. Данные сверены {E(meta["checked"])}.</p></footer>
<script src="{b}assets/app.js" defer></script>{live_js}</body></html>'''
def card_html(it, c):
    st = c["status"] if c["status"] in STATUS else "готовится"
    ch = "".join(f'<span class="chip{" hot" if h else ""}">{t}</span>' for t,h in chips(it))
    blurb = c["what"] or c["brief"] or "Описание готовится."
    if len(blurb) > 130: blurb = blurb[:127].rsplit(" ",1)[0] + "…"
    name = re.sub(r"^ДВ:\s*", "", it["name"]); label = "По выбору: " + name if it["type"] == "По выбору" else name
    hay = E((it["name"]+" "+c["what"]+" "+c["brief"]).lower())
    return (f'<a class="card" href="d/{it["slug"]}.html" data-sem="{start_sem(it["sem"])}" data-group="{group_of(it["type"])}" data-kr="{1 if re.search("К[РП]",it["controls"] or "") else 0}" data-lab="{1 if it["lab"] else 0}" data-text="{hay}">'
            f'<span class="sem">{E(str(it["sem"]))} сем.</span><h3>{E(label)}</h3><p>{E(blurb)}</p>'
            f'<div class="meta"><b>{ze_txt(it)}</b> · {n(it["hours"])} ч</div><div class="chips">{ch}</div><span class="badge {STATUS[st][1]}">{STATUS[st][0]}</span></a>')
RANK = {g: k for k, g in enumerate(GROUPS)}
def sort_key(x): return (start_sem(x["sem"]) or 99, RANK.get(group_of(x["type"]), 9), x["idx"])
def build():
    if OUT.exists(): shutil.rmtree(OUT)
    (OUT/"d").mkdir(parents=True); (OUT/"assets").mkdir()
    for f in ("style.css","app.js","live.js"): shutil.copy(ROOT/"assets"/f, OUT/"assets"/f)
    cards = {it["slug"]: read_card(it["slug"]) for it in items}
    sems = sorted({start_sem(i["sem"]) for i in items if start_sem(i["sem"])})
    chips_sem = "".join(f'<button type="button" data-f="sem" data-v="{s}" aria-pressed="false">{s} сем.</button>' for s in sems)
    chips_grp = "".join(f'<button type="button" data-f="group" data-v="{g}" aria-pressed="false">{g}</button>' for g in GROUPS)
    SORTED = sorted(items, key=sort_key)
    cards_html = "".join(card_html(i, cards[i["slug"]]) for i in SORTED)
    n_ready = sum(1 for c in cards.values() if c["what"])
    home = f'''<section class="hero"><h1>Что тебя ждёт на «Стандартизации и метрологии»</h1>
<p class="lead">Учебный план ДВФУ простым языком: что изучают, зачем это нужно в профессии, насколько большая нагрузка и что говорят студенты.</p>
<p class="muted">{len(items)} позиций плана, описания готовы для {n_ready}. Остальные карточки показывают нагрузку из плана, тексты добавляются.</p></section>
<section class="tools" aria-label="Поиск и фильтры"><input id="q" type="search" placeholder="Найти предмет, например «метрология»" aria-label="Поиск по предметам">
<div class="chipbar" role="group" aria-label="Семестр">{chips_sem}</div><div class="chipbar" role="group" aria-label="Тип предметов">{chips_grp}
<button type="button" data-f="kr" data-v="1" aria-pressed="false">Есть курсовая</button><button type="button" data-f="lab" data-v="1" aria-pressed="false">С лабораторными</button></div>
<p id="count" class="muted" aria-live="polite"></p></section><section class="grid" id="grid">{cards_html}</section><p id="empty" class="muted" hidden>Ничего не нашлось. Попробуй другое слово или сбрось фильтры.</p>'''
    (OUT/"index.html").write_text(page("Учебный план простым языком: 27.03.01 Стандартизация и метрология ДВФУ","Понятное описание дисциплин направления 27.03.01 ДВФУ: что изучают, нагрузка и оценки студентов",home,0,"home"),encoding="utf-8")
    order = SORTED
    for k, it in enumerate(order):
        c = cards[it["slug"]]; st = c["status"] if c["status"] in STATUS else "готовится"
        name = re.sub(r"^ДВ:\s*", "", it["name"]).replace(" / ", " или ")
        def sec(t, v): return f'<section><h2>{t}</h2><p>{E(v)}</p></section>' if v else ""
        what = sec("Что это", c["what"]) or (sec("Кратко", c["brief"]) or '<p class="muted">Описание этой дисциплины готовится.</p>')
        body = f'''<nav class="crumbs"><a href="../index.html">Все дисциплины</a> › {E(str(it["sem"]))} семестр</nav>
<article class="disc"><span class="badge {STATUS[st][1]}">{STATUS[st][0]}</span><h1>{E(("По выбору: " if it["type"]=="По выбору" else "")+name)}</h1>
<p class="muted">{E(it["idx"])} · {E(it["type"])} · {ze_txt(it)} · {n(it["hours"])} ч · {E(str(it["sem"]))} семестр</p>
{what}{sec("Зачем нужно в профессии", c["why"])}{sec("Пример задания", c["example"])}{sec("Совет студента", c["tip"])}
<section><h2>Нагрузка по плану</h2>{load_bar(it)}<p>Контактных часов: <b>{n(it["contact"])}</b> из {n(it["hours"])}. Формы контроля: <b>{E(it["controls"] or "—")}</b> (Эк — экзамен, За — зачёт, ЗаО — зачёт с оценкой, КР — курсовая работа, КП — курсовой проект, К — контрольная, Оц — оценка, РГР — расчётно-графическая работа).</p></section>
<section id="ratings" data-slug="{it["slug"]}"><h2>Оценки студентов</h2>{rating_block(it["slug"])}</section></article>
<nav class="pager">{"<a href=%s.html>← %s</a>" % (order[k-1]["slug"], E(cut(order[k-1]["name"]))) if k else "<span></span>"}{"<a href=%s.html>%s →</a>" % (order[k+1]["slug"], E(cut(order[k+1]["name"]))) if k+1 < len(order) else ""}</nav>'''
        (OUT/"d"/f'{it["slug"]}.html').write_text(page(f"{name}: что изучают и какая нагрузка",c["what"] or c["brief"] or name,body,1,live=True),encoding="utf-8")
    about = f'''<article class="disc"><h1>О проекте</h1><p>«Учебный план простым языком» объясняет абитуриентам, что их ждёт на специальности: официальный учебный план написан для проверяющих, а школьнику нужно понять, чем он будет заниматься и насколько будет трудно.</p>
<h2>Откуда данные</h2><p>Часы, зачётные единицы и формы контроля взяты из документа: {E(meta["plan"])}, {E(meta["approved"])}. Тексты описаний пишут студенты и проверяют преподаватели. Статус каждой карточки показан на её странице.</p>
<h2>Как считаются оценки студентов</h2><p>Студенты анонимно оценивают предметы по шкале от 1 до 5. Оценка показывается, только если ответили не менее {MIN_N} человек, и это медиана. Оценки подгружаются автоматически из сводки по ответам анкеты. Мы не собираем имена и почту, цитаты публикуем только с согласия студента. Если оценили студенты смежных программ, это указано на странице предмета.</p>
<h2>Что важно знать</h2><p>Сайт не является официальным ресурсом вуза и не заменяет рабочий учебный план. Планы могут меняться: смотрите дату сверки внизу страницы и уточняйте у приёмной комиссии.</p>
<h2>Контакты</h2><p>[почта или Telegram команды]</p></article>'''
    (OUT/"about.html").write_text(page("О проекте: Учебный план простым языком","Как устроен проект, откуда данные и как считаются оценки",about,0,"about"),encoding="utf-8")
    (OUT/"404.html").write_text(page("Страница не найдена","",'<article class="disc"><h1>Страница не найдена</h1><p><a href="index.html">Вернуться к списку дисциплин</a></p></article>',0),encoding="utf-8")
    (OUT/".nojekyll").write_text("")
    print(f"Готово: {len(items)} страниц дисциплин, {n_ready} с текстами. Папка: {OUT}")
if __name__ == "__main__": build()
