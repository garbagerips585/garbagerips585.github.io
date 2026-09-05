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

WHY THE TITLE CHECK MEASURES PIXELS AND NOT CHARACTERS, which is the same
mistake in a second costume. Google truncates a SERP title on WIDTH, and
characters are a poor proxy for it: "Pokemon TCG Pocket: Can You Learn the Card
Game From an App?" is exactly 60 characters, renders 622px, and is cut -- while
41 titles longer than 60 characters render well inside the cut and are fine. A
60-character rule therefore reported 27 correct pages and stayed silent about 8
broken ones, which is both failure modes at once.
"""
import re, sys, json, pathlib, collections, html as _html

PUB = pathlib.Path(__file__).resolve().parent.parent / "public"
ALL = "--all" in sys.argv

# THE CUT IS 580px AND THAT NUMBER IS NOT NEW HERE. scripts/build-pokemon.mjs
# already argues this, and dropped the " | Garbage Rips 585" suffix off 844
# pages because of it: "Measured 17 August 2026 in headless Chrome at 20px
# Arial: with the suffix all 844 of these ran 648-736px against Google's ~580px
# desktop cut". Picking a different number here would leave the site holding two
# standards, so this reuses that one.
#
# PIL IS CALIBRATED AGAINST THAT CHROME RUN RATHER THAN TRUSTED. A font library
# and a browser can disagree about the same face, and a threshold inherited
# across a disagreement is worthless. Measuring the 1,025 /pokemon/ titles here
# gives 470-559px against the 468-558px that comment records from Chrome: the
# two methods agree within 2px over a thousand pages, so 580 carries over intact.
#
# 600px IS THE SAME BOUNDARY ESTIMATED LOOSER, not a rival to it -- Google's cut
# is a soft edge that moves with the SERP layout, not a constant. Rather than
# pick one and pretend, anything past 580 is reported with its width and the
# ones past 600 are marked, so a title at 585 reads as near the edge and one at
# 622 reads as over it. Nothing under 580 is ever mentioned.
SERP_PX, SURE_PX = 580, 600

# Google strips emoji out of SERP titles, so measuring them overstates every
# title carrying one -- 352 of the indexable pages here, mostly /playlists,
# where the flag glyph is worth about 21px that will never be drawn.
EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U00002B00-\U00002BFF"
    "\U0001F1E6-\U0001F1FF\U00002190-\U000021FF\U00002300-\U000023FF]"
    "|[\U0000FE00-\U0000FE0F\U0000200D\U000020E3]")

def _load_font():
    """20px Arial, or None. A missing font degrades this one check to the old
    character rule and says so -- it does not take the other eight down with
    it, and it does not silently report a pixel figure it did not measure."""
    try:
        from PIL import ImageFont
        return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 20)
    except Exception:
        return None

FONT = _load_font()

def title_px(t):
    """Rendered width in px of what Google will actually draw, or None."""
    if not t or FONT is None:
        return None
    # Collapsed after stripping, or a title reading "Flare 🔥 Rips" measures a
    # double space that no longer has anything between it.
    return round(FONT.getlength(" ".join(EMOJI.sub("", t).split())))

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
        title=title, tlen=len(title or ""), tpx=title_px(title),
        desc=(d := meta_by(head, "name", "description")), dlen=len(d or ""),
        canon=attr(head, r'<link[^>]+rel=(?P<k>["\'])canonical(?P=k)[^>]+href=(?P<q>["\'])(?P<v>.*?)(?P=q)'),
        ogimg=meta_by(head, "property", "og:image"),
        ogtitle=meta_by(head, "property", "og:title"),
        robots=meta_by(head, "name", "robots"),
        h1=len(re.findall(r"<h1[^>]*>", s, re.I)),
        ld=len(re.findall(r"application/ld\+json", s)),
    ))

# WITHOUT --all THIS SCANS public/*.html ONLY -- about 50 of 1,492 pages -- and
# every section then prints "clean" for a sweep that never opened /rip, /sets,
# /pokemon or /openings. That reads as a clean site and is a clean SAMPLE. On
# 25 August 2026 it told me the site had 2 noindex pages and no long titles; the
# full run found 190 and 57. The scope line was always printed and I tailed past
# it, so it says so twice now and refuses to be quiet about being partial.
if not ALL:
    print(f"\n!! PARTIAL SWEEP: top-level pages only ({len(rows)} of "
          f"{len(list(PUB.rglob('*.html')))}). Re-run with --all for the whole site.")
print(f"\nSEO SWEEP: {len(rows)} pages{'' if ALL else '  [PARTIAL -- top level only]'}\n")

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
# NOINDEX PAGES ARE NOT ASKED. A title is truncated in a search result, and
# these 182 pages do not appear in one, so measuring them is the same crying
# wolf in a third costume.
if FONT is None:
    print("!! PIL or Arial.ttf unavailable: falling back to the 60-character rule,")
    print("   which reports correct pages and misses truncated ones. Install Pillow.\n")
    flag("TITLE OVER 60 CHARS (no font)", lambda r: r["tlen"] > 60 and idx(r),
         lambda r: f"{r['tlen']}ch  {r['title']}")
else:
    flag(f"TITLE TRUNCATED IN SEARCH (over {SERP_PX}px)",
         lambda r: r["tpx"] and r["tpx"] > SERP_PX and idx(r),
         lambda r: f"{r['tpx']}px {r['tlen']}ch {'CUT ' if r['tpx'] > SURE_PX else 'edge'}  {r['title']}")
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
