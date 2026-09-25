#!/usr/bin/env python3
"""
Сборка статического сайта tdzz.ru.

    python3 build.py            # собрать в dist/
    python3 build.py --images   # дополнительно пересоздать уменьшенные копии фото (srcset)

Структура:
    src/pages/{ru,en}/*.html   — контент страниц (<main>…</main>) с JSON-«шапкой» (title, description)
    src/templates/             — базовый шаблон, шапка, подвал, карты (SVG)
    src/data/site.json         — общие строки: телефоны, навигация, подвал, ID Метрики
    src/data/prices.json       — закупочные цены (редактируются через /admin/ на сервере)
    src/css/site.css           — единый файл стилей
    src/js/*.js                — скрипты сайта
    static/                    — всё, что копируется в dist как есть (картинки, документы, api/, admin/)
    dist/                      — результат: содержимое папки загружается в корень сайта
"""
import json, os, re, shutil, hashlib, sys, datetime
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).resolve().parent
SRC, STATIC, DIST = ROOT / "src", ROOT / "static", ROOT / "dist"
PAGES = ["index", "about", "export", "contacts", "privacy", "404"]
PAGE_CLASS = {"index": "page-home", "about": "page-about", "export": "page-export",
              "contacts": "page-contacts", "privacy": "page-about page-privacy", "404": "page-about page-404"}

site = json.loads((SRC / "data/site.json").read_text(encoding="utf-8"))
map_labels = json.loads((SRC / "data/map-labels.json").read_text(encoding="utf-8"))
env = Environment(loader=FileSystemLoader(str(SRC / "templates")), autoescape=False, trim_blocks=True, lstrip_blocks=True)


# ---------- images: sizes, lazy-loading, srcset ----------
try:
    from PIL import Image
except ImportError:
    Image = None

SRCSET_WIDTHS = [480, 800, 1200, 1600]


def make_variants():
    """Создаёт уменьшенные копии больших фото в static/assets/r/ (для srcset)."""
    out = STATIC / "assets/r"
    out.mkdir(exist_ok=True)
    for p in (STATIC / "assets").glob("*.webp"):
        im = Image.open(p)
        for w in SRCSET_WIDTHS:
            if im.width <= w:
                continue
            dst = out / f"{p.stem}-{w}.webp"
            if dst.exists():
                continue
            r = im.copy()
            r.thumbnail((w, 100000))
            r.save(dst, "WEBP", quality=80, method=6)
            print("  ", dst.relative_to(STATIC), r.size)


_img_cache = {}


def img_size(rel):
    if rel in _img_cache:
        return _img_cache[rel]
    p = STATIC / rel
    size = None
    if Image and p.exists() and p.suffix.lower() in (".webp", ".png", ".jpg", ".jpeg"):
        try:
            with Image.open(p) as im:
                size = im.size
        except Exception:
            pass
    _img_cache[rel] = size
    return size


def enrich_images(html, root):
    """Добавляет loading=lazy и srcset локальным картинкам."""
    def fix(m):
        tag = m.group(0)
        src = re.search(r'\ssrc="([^"]+)"', tag)
        if not src:
            return tag
        s = src.group(1)
        if s.startswith(("http", "data:")):
            return tag
        rel = s[len(root):] if root and s.startswith(root) else s
        size = img_size(rel)
        # width/height не проставляем: размеры картинок заданы в CSS (aspect-ratio / height),
        # а атрибуты ломают вёрстку карточек с height:100%.
        if "loading=" not in tag and "fetchpriority" not in tag:
            tag = tag.replace("<img", '<img loading="lazy" decoding="async"', 1)
        if size and size[0] > 900 and "srcset=" not in tag and rel.endswith(".webp"):
            stem = Path(rel).stem
            cands = [(w, f"{root}assets/r/{stem}-{w}.webp") for w in SRCSET_WIDTHS if (STATIC / f"assets/r/{stem}-{w}.webp").exists()]
            if cands:
                srcset = ", ".join(f"{u} {w}w" for w, u in cands) + f", {s} {size[0]}w"
                sizes = "100vw" if "hero" in tag else "(max-width: 760px) 100vw, 50vw"
                tag = tag.replace("<img", f'<img srcset="{srcset}" sizes="{sizes}"', 1)
        return tag
    return re.sub(r"<img\b[^>]*>", fix, html)


# ---------- pages ----------
def read_page(lang, name):
    p = SRC / f"pages/{lang}/{name}.html"
    if not p.exists():
        return None
    txt = p.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n(.*)$", txt, re.S)
    meta, body = (json.loads(m.group(1)), m.group(2)) if m else ({}, txt)
    return meta, body


def jsonld(lang, T):
    a = site["address"][lang]
    return json.dumps({
        "@context": "https://schema.org", "@type": "Organization",
        "name": T["org_name"], "url": site["domain"] + "/", "logo": site["domain"] + "/logo-mark.png",
        "description": T["org_desc"], "telephone": site["phone"].replace(" ", "").replace("(", "").replace(")", "").replace("-", ""),
        "email": site["email"],
        "address": {"@type": "PostalAddress", "streetAddress": a, "addressLocality": "Волгоград" if lang == "ru" else "Volgograd", "addressCountry": "RU"},
        "geo": {"@type": "GeoCoordinates", "latitude": site["geo"]["lat"], "longitude": site["geo"]["lon"]},
    }, ensure_ascii=False)


def build():
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(STATIC, DIST)
    (DIST / "data").mkdir(exist_ok=True)
    shutil.copy(SRC / "data/prices.json", DIST / "data/prices.json")
    # css + js
    css = (SRC / "css/site.css").read_text(encoding="utf-8")
    (DIST / "assets/site.css").write_text(css, encoding="utf-8")
    for js in (SRC / "js").glob("*.js"):
        shutil.copy(js, DIST / "assets" / js.name)
    build_hash = hashlib.md5((css + "".join(p.read_text(encoding="utf-8") for p in sorted((SRC / "js").glob("*.js")))).encode()).hexdigest()[:8]
    year = str(datetime.date.today().year)
    prices_data = json.loads((SRC / "data/prices.json").read_text(encoding="utf-8"))
    prices_json = json.dumps(prices_data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    quiz_json = json.dumps(json.loads((SRC / "data/quiz.json").read_text(encoding="utf-8")), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    passport_json = json.dumps(json.loads((SRC / "data/passport.json").read_text(encoding="utf-8")), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    home_mode = prices_data.get("home_mode", "quiz")
    urls = []
    for lang in ("ru", "en"):
        T = site["strings"][lang]
        root = "../" if lang == "en" else ""
        for name in PAGES:
            pg = read_page(lang, name)
            if not pg:
                continue
            meta, body = pg
            fname = f"{name}.html"
            url = ("" if name == "index" else fname)
            page = dict(meta, name=name, url=("en/" + url if lang == "en" else url),
                        url_ru=url, url_en="en/" + url)
            ctx = dict(site=site, T=T, lang=lang, root=root, page=page, year=year, build_hash=build_hash,
                       page_class=PAGE_CLASS[name], jsonld=jsonld(lang, T),
                       maps={k: v[lang] for k, v in map_labels.items()}, prices_json=prices_json, quiz_json=quiz_json, passport_json=passport_json, home_mode=home_mode)
            # content is itself a template (map includes)
            content = env.from_string(body).render(**ctx)
            html = env.get_template("base.html").render(**ctx, content=content)
            html = enrich_images(html, root)
            out = DIST / ("en" if lang == "en" else "") / fname
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(html, encoding="utf-8")
            if name != "404" and not meta.get("robots"):
                urls.append(site["domain"] + "/" + page["url"])
    # sitemap / robots
    today = datetime.date.today().isoformat()
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schema/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for u in urls:
        ru = u.replace("/en/", "/")
        en = ru.replace(site["domain"] + "/", site["domain"] + "/en/")
        sm.append(f'<url><loc>{u}</loc><lastmod>{today}</lastmod><xhtml:link rel="alternate" hreflang="ru" href="{ru}"/><xhtml:link rel="alternate" hreflang="en" href="{en}"/></url>')
    sm.append("</urlset>")
    (DIST / "sitemap.xml").write_text("\n".join(sm), encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: {site['domain']}/sitemap.xml\n", encoding="utf-8")
    print(f"built {len(urls)} pages -> {DIST}")


if __name__ == "__main__":
    if "--images" in sys.argv:
        if not Image:
            sys.exit("Pillow не установлен: pip install pillow")
        make_variants()
    build()
