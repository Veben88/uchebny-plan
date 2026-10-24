#!/usr/bin/env python3
"""Проверка данных связей перед сборкой. Только стандартная библиотека.

Запуск из корня репозитория:  python tools/check_data.py
Ошибки (код выхода 1):
  * связь или профессия ссылается на предмет, которого нет в data/plan.json;
  * связь предмета с самим собой, повтор одной и той же пары, неизвестный тип, пустое пояснение why;
  * цикл в связях «нужен»: A нужен для B, B — для A (прямо или через цепочку). Для «нужен» цикл бессмыслен:
    нельзя начинать каждый из двух предметов только после другого.
Предупреждения (не мешают сборке):
  * «нужен» ведёт к предмету, который начинается раньше или в том же семестре: стоит перепроверить;
  * пара предметов связана в обе стороны связями разного типа.
Циклы в связях «помогает» допустимы: два предмета могут помогать друг другу.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TYPES = {"need", "helps"}
ACYCLIC = {"need"}


def start_sem(s):
    m = re.search(r"\d", str(s)); return int(m.group()) if m else 0


def jobs_slugs():
    """Профессии пока хранятся в build.py (JOBS): берём их оттуда, не выполняя сборку."""
    sys.path.insert(0, str(ROOT)); sys.dont_write_bytecode = True
    import build  # noqa: E402  (модуль только читает данные; сборка запускается лишь при прямом вызове build.py)
    return [(j[1], j[3]) for j in build.JOBS]


def cycles(edges):
    g = {}
    for a, b in edges: g.setdefault(a, []).append(b)
    found, state = [], {}
    def dfs(v, path):
        state[v] = 1; path.append(v)
        for w in g.get(v, []):
            if state.get(w) == 1: found.append(path[path.index(w):] + [w])
            elif not state.get(w): dfs(w, path)
        path.pop(); state[v] = 2
    for v in list(g):
        if not state.get(v): dfs(v, [])
    return found


def main():
    plan = {i["slug"]: i for i in json.loads((ROOT / "data/plan.json").read_text(encoding="utf-8"))["disciplines"]}
    links = json.loads((ROOT / "data/links.json").read_text(encoding="utf-8"))["links"]
    errs, warns, seen = [], [], {}
    for k, l in enumerate(links):
        a, b, t = l.get("from"), l.get("to"), l.get("type")
        where = f"связь №{k + 1} ({a} → {b})"
        for s in (a, b):
            if s not in plan: errs.append(f"{where}: нет предмета {s} в plan.json")
        if t not in TYPES: errs.append(f"{where}: неизвестный тип «{t}»")
        if a == b: errs.append(f"{where}: связь предмета с самим собой")
        if not (l.get("why") or "").strip(): errs.append(f"{where}: пустое пояснение why")
        if (a, b) in seen: errs.append(f"{where}: повтор связи №{seen[(a, b)] + 1}")
        seen.setdefault((a, b), k)
        if t == "need" and a in plan and b in plan and start_sem(plan[a]["sem"]) >= start_sem(plan[b]["sem"]):
            warns.append(f"{where}: «нужен», но {plan[b]['name']} начинается не позже ({plan[a]['sem']} → {plan[b]['sem']} сем.)")
    for (a, b), k in seen.items():
        if (b, a) in seen and a < b and links[k]["type"] != links[seen[(b, a)]]["type"]:
            warns.append(f"{a} и {b} связаны в обе стороны разными типами")
    for t in ACYCLIC:
        for c in cycles([(l["from"], l["to"]) for l in links if l.get("type") == t]):
            errs.append(f"цикл в связях «{t}»: " + " → ".join(c))
    for name, slugs in jobs_slugs():
        for s in slugs:
            if s not in plan: errs.append(f"профессия «{name}»: нет предмета {s} в plan.json")
    print(f"Связей: {len(links)}, ошибок: {len(errs)}, предупреждений: {len(warns)}")
    for e in errs: print("  ОШИБКА " + e)
    for w in warns: print("  внимание: " + w)
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
