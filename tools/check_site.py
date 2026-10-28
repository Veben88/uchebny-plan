#!/usr/bin/env python3
"""Проверка собранного сайта (папка site/) перед публикацией. Только стандартная библиотека.

Запуск из корня репозитория:  python build.py && python tools/check_site.py
Проверяет: есть все служебные страницы и страница каждой дисциплины из data/plan.json;
локальные ссылки и ресурсы ведут на существующие файлы; якоря #… существуют на целевой странице
(кроме адресов, которые разбирает скрипт: #d=, #path=, #route=, #node=, #job=, #compare=, #cmp=); нет абсолютных ссылок «/…»,
которые сломались бы на GitHub Pages по адресу /uchebny-plan/; у страниц есть lang="ru",
заголовок <title> и ровно один <h1>; нет повторяющихся id; встроенный JSON разбирается.
Код выхода 1, если найдена хотя бы одна ошибка.
"""
import json, sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parent.parent
SITE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "site"
PAGES = ["index", "path", "catalog", "map", "plan", "jobs", "profile", "settings", "roadmap", "about", "feedback", "404"]
SCRIPT_HASHES = ("d=", "path=", "route=", "node=", "job=", "compare=", "cmp=")


class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.refs, self.ids, self.json, self.title, self.h1, self.lang = [], [], [], "", 0, None
        self._in_title = self._in_json = False; self._buf = ""
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html": self.lang = a.get("lang")
        if "id" in a: self.ids.append(a["id"])
        if tag in ("a", "link") and a.get("href"): self.refs.append(a["href"])
        if tag in ("script", "img", "source") and a.get("src"): self.refs.append(a["src"])
        if tag == "h1": self.h1 += 1
        if tag == "title": self._in_title = True
        if tag == "script" and a.get("type") == "application/json": self._in_json, self._buf = True, ""
    def handle_endtag(self, tag):
        if tag == "title": self._in_title = False
        if tag == "script" and self._in_json: self._in_json = False; self.json.append(self._buf)
    def handle_data(self, data):
        if self._in_title: self.title += data
        if self._in_json: self._buf += data


def parse(p):
    x = Page(); x.feed(p.read_text(encoding="utf-8")); return x


def main():
    if not SITE.exists(): print(f"Нет папки {SITE}: сначала выполните python build.py"); return 1
    plan = json.loads((ROOT / "data/plan.json").read_text(encoding="utf-8"))["disciplines"]
    errs, ids_cache, n_refs = [], {}, 0
    for name in PAGES:
        if not (SITE / f"{name}.html").exists(): errs.append(f"нет страницы {name}.html")
    for it in plan:
        if not (SITE / "d" / f'{it["slug"]}.html').exists(): errs.append(f'нет страницы дисциплины d/{it["slug"]}.html')
    pages = sorted(SITE.rglob("*.html"))
    for pg in pages:
        p, rel = parse(pg), pg.relative_to(SITE)
        if p.lang != "ru": errs.append(f"{rel}: нет lang=ru")
        if not p.title.strip(): errs.append(f"{rel}: пустой <title>")
        if p.h1 != 1: errs.append(f"{rel}: заголовков h1 — {p.h1}, нужен один")
        if len(p.ids) != len(set(p.ids)): errs.append(f"{rel}: повторяющиеся id")
        for j in p.json:
            try: json.loads(j)
            except ValueError as e: errs.append(f"{rel}: встроенный JSON не разбирается ({e})")
        for ref in p.refs:
            u = urlparse(ref)
            if u.scheme in ("http", "https", "mailto", "tel", "data") or ref.startswith("//"): continue
            n_refs += 1
            if ref.startswith("/"): errs.append(f"{rel}: абсолютная ссылка {ref} (сломается на /uchebny-plan/)"); continue
            target = (pg.parent / unquote(u.path)).resolve() if u.path else pg
            if not target.exists(): errs.append(f"{rel}: битая ссылка {ref}"); continue
            if u.fragment and target.suffix == ".html" and not u.fragment.startswith(SCRIPT_HASHES):
                if target not in ids_cache: ids_cache[target] = set(parse(target).ids)
                if u.fragment not in ids_cache[target]: errs.append(f"{rel}: на {target.name} нет якоря #{u.fragment}")
    for f in SITE.rglob("*"):
        if f.suffix in (".css", ".js") and f.stat().st_size == 0: errs.append(f"пустой файл {f.relative_to(SITE)}")
    print(f"Страниц: {len(pages)}, локальных ссылок и ресурсов: {n_refs}, ошибок: {len(errs)}")
    for e in errs[:50]: print("  " + e)
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
