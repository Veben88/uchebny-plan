#!/usr/bin/env python3
"""Скачивает сводку оценок из веб-приложения Google (адрес в data/config.json)
и сохраняет её в data/ratings.json, который использует build.py.
Ошибки не ломают публикацию: при сбое остаётся прежний файл (если он был)."""
import json, sys, urllib.request
from pathlib import Path
ROOT = Path(__file__).parent
cfg = ROOT / "data/config.json"
url = (json.loads(cfg.read_text(encoding="utf-8")).get("ratings_url") or "").strip() if cfg.exists() else ""
if not url:
    print("ratings_url не задан, пропускаю"); sys.exit(0)
try:
    req = urllib.request.Request(url, headers={"User-Agent": "uchebny-plan-build"})
    with urllib.request.urlopen(req, timeout=45) as r:
        data = json.loads(r.read().decode("utf-8"))
    ratings = data.get("ratings") or {}
    scope = data.get("scope", "")
    out = {slug: {"n": v.get("n", 0), "hard": v.get("hard"), "useful": v.get("useful"),
                  "interest": v.get("interest"), "scope": scope} for slug, v in ratings.items()}
    (ROOT / "data/ratings.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Оценки загружены: {len(out)} предметов (обновлено {data.get('updated')})")
    print(f"::notice title=Оценки::Загружено предметов: {len(out)}")
except Exception as e:
    print("Не удалось загрузить оценки:", e, "- сайт соберётся с прежними данными")
    print(f"::warning title=Оценки::Не удалось загрузить: {e}")
