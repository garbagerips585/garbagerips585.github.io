#!/usr/bin/env python3
"""Read the head of every built page and report what search engines will see.

    python3 scripts/seo-sweep.py            the 50 root pages
    python3 scripts/seo-sweep.py --all      all 1,491

WHY IT IS NOT A REGEX OVER content="...". The obvious pattern, content=["'](.*?)["'],
matches either quote at BOTH ends, so a double-quoted description containing an
apostrophe stops dead at the apostrophe. "The 100 most valuable ungraded Pokemon
cards by PriceCharting's price guide, read ..." got measured as 61 characters and
reported as too short, and the page was fine. Every quoted value here is read with
a backreference to whichever quote opened it, so the value ends where it actually
ends. A checker that cries wolf about correct pages is worse than no checker.
"""
import re, sys, json, pathlib, collections, html as _html

PUB = pathlib.Path(__file__).resolve().parent.parent / "public"
ALL = "--all" in sys.argv

# (?P<q>["']) opens, (?P=q) closes. Nothing else terminates the value.
def attr(s, pat):
    m = re.search(pat, s, re.S | re.I)
    # ENTITIES DECODED BEFORE ANYTHING IS MEASURED. A title reading
    # &quot;First Pack Magic&quot; is 4 characters of quotation mark in the
    # source and 2 on screen, and a description with three &amp;quot; pairs
    # measured 170 against a 165 ceiling while actually being well inside it.
    # Search engines count what they render, so this has to as well.
    return _html.unescape(m.group("v")).strip() if m else None

def meta_by(s, kind, key):
    v = attr(s, rf'<meta[^>]+{kind}=(?P<k>["\']){key}(?P=k)[^>]+content=(?P<q>["\'])(?P<v>.*?)(?P=q)')
    if v is None:
        v = attr(s, rf'<meta[^>]+content=(?P<q>["\'])(?P<v>.*?)(?P=q)[^>]+{kind}=(?P<k>["\']){key}(?P=k)')
    return v

files = sorted(PUB.rglob("*.html")) if ALL else sorted(PUB.glob("*.html"))
rows = []
for f in files:
    s = f.read_text(encoding="utf8", errors="replace")
    head = s[: s.find("</head>") + 7] if "</head>" in s else s
    title = attr(head, r"<title[^>]*>(?P<v>.*?)</title>")
    rows.append(dict(
        page=str(f.relative_to(PUB)),
        title=title, tlen=len(title or ""),
        desc=(d := meta_by(head, "name", "description")), dlen=len(d or ""),
        canon=attr(head, r'<link[^>]+rel=(?P<k>["\'])canonical(?P=k)[^>]+href=(?P<q>["\'])(?P<v>.*?)(?P=q)'),
        ogimg=meta_by(head, "property", "og:image"),
        ogtitle=meta_by(head, "property", "og:title"),
        robots=meta_by(head, "name", "robots"),
        h1=len(re.findall(r"<h1[^>]*>", s, re.I)),
        ld=len(re.findall(r"application/ld\+json", s)),
    ))

print(f"\nSEO SWEEP: {len(rows)} pages\n")

def flag(label, test, show=lambda r: r["title"]):
    bad = [r for r in rows if test(r)]
    print(f"{label}: {'clean' if not bad else f'{len(bad)} pages'}")
    for r in bad[:14]:
        print(f"   {r['page'][:48]:50} {str(show(r))[:78]}")
    if len(bad) > 14:
        print(f"   ... and {len(bad)-14} more")
    print()

idx = lambda r: not (r["robots"] and "noindex" in r["robots"].lower())

flag("MISSING TITLE",        lambda r: not r["title"])
flag("TITLE OVER 60 CHARS",  lambda r: r["tlen"] > 60, lambda r: f"{r['tlen']}  {r['title']}")
flag("MISSING DESCRIPTION",  lambda r: not r["desc"] and idx(r))
flag("DESC OUTSIDE 70-165",  lambda r: r["desc"] and not (70 <= r["dlen"] <= 165),
     lambda r: f"{r['dlen']}  {r['desc']}")
flag("MISSING CANONICAL",    lambda r: not r["canon"] and idx(r))
flag("MISSING OG:IMAGE",     lambda r: not r["ogimg"] and idx(r))
flag("NOT EXACTLY ONE H1",   lambda r: r["h1"] != 1, lambda r: f"{r['h1']} h1s")
flag("NO STRUCTURED DATA",   lambda r: r["ld"] == 0 and idx(r))

for field in ("title", "desc", "canon"):
    c = collections.Counter(r[field] for r in rows if r[field])
    dup = {k: v for k, v in c.items() if v > 1}
    print(f"DUPLICATE {field.upper()}: {'clean' if not dup else f'{len(dup)} repeated'}")
    for k, v in list(dup.items())[:8]:
        pages = [r["page"] for r in rows if r[field] == k]
        print(f"   x{v}  {str(k)[:70]}")
        print(f"        {pages[:5]}")
    print()

noidx = [r["page"] for r in rows if not idx(r)]
print(f"NOINDEX (deliberate): {len(noidx)}  {noidx[:10]}")
