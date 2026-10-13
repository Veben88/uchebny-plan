#!/usr/bin/env python3
"""Сводка оценок из Google Формы -> data/ratings.json.
Использование:
  python aggregate_survey.py ответы.csv
  python aggregate_survey.py ответы.csv --scope "студенты смежных программ" --filter "направлении=27.03.01"
Скачать ответы: Google Форма -> Ответы -> значок таблицы -> Файл -> Скачать -> CSV."""
import csv, json, re, sys, argparse, difflib, statistics
from pathlib import Path
ROOT = Path(__file__).parent
ap = argparse.ArgumentParser(); ap.add_argument("csv"); ap.add_argument("--scope", default="")
ap.add_argument("--filter", default="", help="часть названия колонки=значение, оставить только такие строки")
a = ap.parse_args()
plan = json.loads((ROOT/"data/plan.json").read_text(encoding="utf-8"))["disciplines"]
def norm(t): return re.sub(r"\s+", " ", t.lower().replace("ё","е").replace("ДВ:","").replace("по выбору:","")).strip(" .:")
def strip_hint(t): return re.sub(r"\s*\([^()]*\)\s*$", "", t)
cands = []  # (нормализованное название, slug)
for d in plan:
    cands.append((norm(d["name"]), d["slug"]))
    if d["type"] == "По выбору":
        for part in re.sub(r"^ДВ:\s*", "", d["name"]).split(" / "): cands.append((norm(part), d["slug"]))
def match(label):
    if "включая основы" in label.lower():
        return {s for n, s in cands if n in ("основы проектной деятельности", "проектная деятельность")}, False
    for variant in (label, strip_hint(label)):
        v = norm(variant)
        exact = [s for n, s in cands if n == v]
        if exact: return set(exact), False
    v = norm(strip_hint(label))
    best = max(((difflib.SequenceMatcher(None, v, n).ratio(), s) for n, s in cands), default=(0, None))
    if best[0] >= 0.8: return {best[1]}, False
    if "проектная деятельность" in v: return {s for n, s in cands if n.startswith("основы проектной") or n == "проектная деятельность"}, False
    return set(), True
raw = list(csv.reader(open(a.csv, encoding="utf-8-sig")))
head, rows = raw[0], raw[1:]
def col_idx(part): return next((i for i, h in enumerate(head) if part.lower() in h.lower()), None)
# 1) исключаем тех, кто не разрешил использовать ответы
ci = col_idx("можно ли использовать твои ответы")
if ci is not None:
    before = len(rows); rows = [r for r in rows if not (len(r) > ci and r[ci].strip().lower().startswith("нет"))]
    print("Исключено по отказу от использования ответов:", before - len(rows))
# 2) необязательный фильтр по колонке, например --filter "направлении=27.03.01"
if a.filter:
    key, val = a.filter.split("=", 1); fi = col_idx(key)
    if fi is None: sys.exit("Колонка для фильтра не найдена: " + key)
    rows = [r for r in rows if len(r) > fi and val.lower() in r[fi].lower()]
print("Строк в обработке:", len(rows))
hard, use, interest, unmatched = {}, {}, {}, set()
topnames = sorted({(norm(d["name"]), d["slug"]) for d in plan}, key=lambda x: -len(x[0]))
for i, col in enumerate(head):   # по индексам: в таблице бывают колонки с одинаковым названием
    m = re.match(r"^(.*?)\s*\[(.*)\]\s*$", col, re.S)
    if m:
        q, label = m.group(1).lower(), m.group(2)
        target = hard if "сложным" in q else use if "пригодился" in q else None
        if target is None: continue
        slugs, bad = match(label)
        if bad: unmatched.add(label); continue
        for r in rows:
            v = (r[i] if len(r) > i else "").strip()
            if v[:1] in ("1","2","3","4","5"):
                for s_ in slugs: target.setdefault(s_, []).append(int(v[0]))
    elif "самыми" in col.lower() and "интересн" in col.lower():
        for r in rows:
            text = norm(r[i] if len(r) > i else "")
            for n, s_ in topnames:
                if n and n in text: interest[s_] = interest.get(s_, 0) + 1; text = text.replace(n, "", 1)
res = {}
for s in set(hard) | set(use) | set(interest):
    h, u = hard.get(s, []), use.get(s, [])
    res[s] = {"n": max(len(h), len(u)), "hard": statistics.median(h) if h else None, "useful": statistics.median(u) if u else None, "interest": interest.get(s, 0), "scope": a.scope}
(ROOT/"data/ratings.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
shown = sum(1 for v in res.values() if v["n"] >= 5)
print(f"Предметов с оценками: {len(res)}, из них на сайте будут показаны (минимум 5 ответов): {shown}")
if unmatched: print("Не удалось сопоставить строки (проверьте названия):", *sorted(unmatched), sep="\n  - ")
