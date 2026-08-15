#!/usr/bin/env python3
"""The nightly's safety net.

    python3 scripts/check-build.py

Exits non-zero on anything that would publish a quietly broken site. Lives in a
file rather than inline in the workflow so it can be run locally before pushing,
and so the checks are reviewable.

WHY EACH CHECK EXISTS. The original guard was "300+ pages and no broken internal
links", and an audit showed what that misses: the 310 rip pages alone clear the
floor, so every set guide, every Pokemon page and all 19 root pages could vanish
and it would still pass. Corrupting pokemon-index.json dropped 30 pages from the
sitemap and 30 from search, and both old guards stayed green.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
fail = []
note = print


def count(pattern):
    return len(glob.glob(pattern, recursive=True))


pages = sorted(glob.glob("public/**/*.html", recursive=True))
note(f"{len(pages)} pages built")

# 1. Per-section floors. A total is not enough: one section can empty out
#    entirely while the total still clears.
SECTIONS = [
    ("public/rip/*.html", 300, "rip pages"),
    ("public/sets/*.html", 35, "set guides"),
    ("public/pokemon/*.html", 25, "Pokemon pages"),
    ("public/*.html", 18, "root pages"),
]
for pattern, floor, label in SECTIONS:
    n = count(pattern)
    if n < floor:
        fail.append(f"only {n} {label}, expected at least {floor}")
    else:
        note(f"  {n:>4} {label}")

# 2. Internal links. The old regex was (?:href|src)="(/[^"#?]*)" which REFUSED
#    to match any url carrying a query or a fragment, so every /cards.html?q=...
#    link on the site was silently unchecked rather than checked and passed.
missing = {}
links = 0
for f in pages:
    html = open(f, encoding="utf-8").read()
    # RELATIVE HREFS WERE A BLIND SPOT AND TWO 404s WALKED THROUGH IT. This
    # pattern was anchored to a leading slash, so every site-absolute link was
    # checked and anything relative was invisible. A builder started rendering
    # provenance strings like "data/shops.json" as real hrefs; those files live
    # in the repo root and are never deployed, so both were dead on the live
    # site and this script reported all links fine.
    # Two things this has to avoid now that it looks at relative urls as well.
    # A <script> block builds hrefs by string concatenation at RUNTIME, so
    # href="'+esc(url)+'" is not a link and cannot be resolved on disk. And
    # data-src="pricecharting.com" is an attribute name ending in "src", not a
    # source: without a boundary the pattern matches its tail. Both showed up as
    # false failures the moment the leading-slash anchor came off.
    scanned = re.sub(r"(?is)<script\b.*?</script>", "", html)
    for m in re.finditer(r'(?<![\w-])(?:href|src)="([^"]*)"', scanned):
        raw = m.group(1).split("#")[0].split("?")[0]
        if not raw:
            continue
        # Off-site and non-http schemes are somebody else's problem.
        if re.match(r"^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|//)", raw):
            continue
        links += 1
        if raw.startswith("/"):
            url = raw
            path = os.path.join("public", url.lstrip("/"))
        else:
            # Resolve against the page's own directory, the way a browser would.
            url = raw
            path = os.path.normpath(os.path.join(os.path.dirname(f), raw))
        if url.endswith("/"):
            path = os.path.join(path, "index.html")
        if not os.path.exists(path):
            missing.setdefault(f"{url} (from {f})" if not raw.startswith("/") else url, []).append(f)
note(f"  {links} internal links")
for url, srcs in list(missing.items())[:10]:
    fail.append(f"broken link {url}  <- {srcs[0]}")

# 3. Share cards are content="https://..." absolutes, so the link check above
#    never saw them. A missing one is an empty preview on every share.
for f in pages:
    html = open(f, encoding="utf-8").read()
    for m in re.finditer(r'content="https://[^"]*/assets/(og-[\w.-]+\.jpg)', html):
        if not os.path.exists(os.path.join("public/assets", m.group(1))):
            fail.append(f"missing share card assets/{m.group(1)}  <- {f}")

# 4. The sitemap. Nothing checked it at all: 30 urls disappeared in testing and
#    both old guards passed. For a site whose job is entity SEO that is a
#    total-loss failure that is completely invisible.
sm = "public/sitemap.xml"
if not os.path.exists(sm):
    fail.append("no sitemap.xml")
else:
    locs = re.findall(r"<loc>https://[^/]+(/[^<]*)</loc>", open(sm, encoding="utf-8").read())
    note(f"  {len(locs)} sitemap urls")
    if len(locs) < 330:
        fail.append(f"sitemap has only {len(locs)} urls, expected 330+")
    if len(locs) != len(set(locs)):
        fail.append("sitemap contains duplicate urls")
    for u in locs:
        p = os.path.join("public", u.lstrip("/"))
        if u.endswith("/"):
            p = os.path.join(p, "index.html")
        if not os.path.exists(p):
            fail.append(f"sitemap points at a missing page: {u}")
            break
    # A page cannot both be in the sitemap and tell crawlers to go away.
    for f in pages:
        if re.search(r'name="robots"[^>]*noindex', open(f, encoding="utf-8").read()):
            u = "/" + os.path.relpath(f, "public")
            if u in locs:
                fail.append(f"noindex page is in the sitemap: {u}")

# 5. Volume inside the JSON. This is the check that catches a sync blanking
#    real data, which no count of pages ever will.
DATA = [
    ("public/data/card-index.json", "cards", 4000),
    ("public/data/site-index.json", "rips", 300),
    ("public/data/videos.json", "videos", 300),
]
for path, key, floor in DATA:
    if not os.path.exists(path):
        fail.append(f"{path} is missing")
        continue
    doc = json.load(open(path, encoding="utf-8"))
    rows = doc.get(key) or []
    if len(rows) < floor:
        fail.append(f"{path}: {len(rows)} {key}, expected at least {floor}")
    else:
        note(f"  {len(rows):>4} {key} in {os.path.basename(path)}")

# Prices are the thing most likely to silently go null.
ci = "public/data/card-index.json"
if os.path.exists(ci):
    cards = json.load(open(ci, encoding="utf-8")).get("cards") or []
    priced = sum(1 for c in cards if isinstance(c[4], (int, float)))
    pct = priced / len(cards) * 100 if cards else 0
    note(f"  {pct:.1f}% of cards carry a price")
    if pct < 90:
        fail.append(f"only {pct:.1f}% of cards have a price, expected 90%+")

# 6. The Pokemon index, whose loss is silent by construction: it is read behind
#    a catch in two places and its absence just drops 30 pages from search and
#    from the sitemap.
pi = "public/data/pokemon-index.json"
if not os.path.exists(pi):
    fail.append("pokemon-index.json is missing, so 30 pages are out of search and the sitemap")
else:
    n = len(json.load(open(pi, encoding="utf-8")).get("pokemon") or [])
    if n < 25:
        fail.append(f"pokemon-index.json has {n} entries, expected 25+")

# 7. Structured data has to parse or the rich result is simply not eligible.
bad = 0
for f in pages:
    for block in re.findall(
        r'<script type="application/ld\+json">(.*?)</script>',
        open(f, encoding="utf-8").read(), re.S):
        try:
            doc = json.loads(block)
        except Exception:
            bad += 1
            if bad < 4:
                fail.append(f"malformed JSON-LD in {f}")
            continue
        # PARSING IS NOT ENOUGH. json.loads("null") returns None and raises
        # nothing, so a page emitting a literal `null` inside the script tag
        # passed this check for as long as it existed. luck.html shipped exactly
        # that: a guard correctly declined to invent a Dataset, then printed the
        # absence of one as markup. A block has to be an object or a list of
        # them to describe anything at all.
        if not isinstance(doc, (dict, list)) or doc == [] or doc == {}:
            bad += 1
            if bad < 4:
                fail.append(f"empty or non-object JSON-LD in {f}: {block.strip()[:40]!r}")
if not bad:
    note("  all JSON-LD parses")

# 8. Dates that have not happened yet mean a clock or a stamp is wrong.
import datetime
today = datetime.date.today().isoformat()
for path in glob.glob("public/data/*.json") + glob.glob("public/data/cards/*.json"):
    try:
        doc = json.load(open(path, encoding="utf-8"))
    except Exception:
        continue
    for key in ("checked", "syncedAt", "updated"):
        v = doc.get(key)
        if isinstance(v, str) and v[:10] > today:
            fail.append(f"{path}: {key} is in the future ({v})")

# ---------------------------------------------------------------------------
# CSS BRACE BALANCE. Twice now an edit has left a stray closing brace in
# ui.css, and both times the symptom looked like a layout bug: an unexpected }
# makes the parser discard the rule that FOLLOWS it, so the damage lands on
# whatever happens to be next in the file rather than where the typo is. The
# first one silently killed the hit card grid and shipped. It costs
# milliseconds to check and it is checkable, so it is checked.
#
# It reads the SOURCE, assets-source/ui.css, not the built copy: that is the
# file a human edits, so it is the file whose line numbers are worth printing.
import re as _re
_css = open(os.path.join(ROOT, "assets-source/ui.css"), encoding="utf-8").read()
_noc = _re.sub(r"/\*.*?\*/", lambda m: _re.sub(r"[^\n]", " ", m.group(0)), _css, flags=_re.S)
_depth = 0
_stray = None
for _ln, _text in enumerate(_noc.split("\n"), 1):
    for _ch in _text:
        if _ch == "{":
            _depth += 1
        elif _ch == "}":
            _depth -= 1
            if _depth < 0 and _stray is None:
                _stray = _ln
                _depth = 0
if _stray:
    fail.append(f"ui.css: stray closing brace at line {_stray}; the rule after it is being discarded")
elif _depth:
    fail.append(f"ui.css: {_depth} unclosed rule(s); everything after the last one is swallowed")

# CSS SOURCE IN SYNC WITH WHAT SHIPS. public/assets/ui.css is generated from
# assets-source/ui.css by scripts/build-css.mjs, and it is the generated one
# that 425 pages link. Two ways that silently goes wrong: editing the built
# copy (the next build discards the edit) or editing the source and not
# building (the edit never ships). Both look like "my CSS change did nothing",
# which is a bad afternoon, so compare them here.
_built = open(os.path.join(ROOT, "public/assets/ui.css"), encoding="utf-8").read()
_squash = lambda t: _re.sub(r"\s+", "", _re.sub(r"/\*.*?\*/", "", t, flags=_re.S))
if _squash(_css) != _squash(_built):
    fail.append(
        "ui.css: assets-source/ui.css and public/assets/ui.css differ by more "
        "than comments. Run node scripts/build-css.mjs (and check you did not "
        "edit the generated public/assets/ui.css by hand)."
    )

# A builder nobody runs. build-all.mjs is the one running order, and the
# nightly workflow now calls it rather than keeping a hand-copied list, because
# the two lists drifted: the workflow was missing stamp-assets.mjs and three
# page builders, so every nightly commit shipped mismatched cache busters and
# six pages frozen at the last manual build. Nothing caught it, because every
# other check here asks whether the pages present are sound, never whether a
# builder ran at all.
#
# Assets are generated once from originals and are deliberately outside the
# nightly loop; anything else that writes into public/ belongs in build-all.
_ONE_OFF = {
    "build-favicon.py",   # icons, from logo-square.jpg
    "build-logos.py",     # set logos
    "build-og.py",        # the site share card
    "build-packs.py",     # pack art, from assets-source
    "build-sheet.py",     # the Excel workbook, not a web page
}
#
# Covers stamp-* as well as build-*, because the step that went missing was
# stamp-assets.mjs. A guard that would not have caught the bug it was written
# for is worse than none: it reads as coverage.
# COMMENTS STRIPPED FIRST. This was a plain substring search over the whole
# file, so a builder whose name appeared only inside a `//` comment counted as
# wired up: an audit defeated the guard in exactly the way the guard exists to
# prevent. Only the quoted step strings count now.
_all_raw = open(os.path.join(ROOT, "scripts/build-all.mjs"), encoding="utf-8").read()
_all_src = "\n".join(
    _re.sub(r"//.*$", "", ln) for ln in _all_raw.split("\n")
)
_orphan = sorted(
    f for f in os.listdir(os.path.join(ROOT, "scripts"))
    if (f.startswith("build-") or f.startswith("stamp-"))
    and f not in _ONE_OFF
    and f != "build-all.mjs" and f"scripts/{f}" not in _all_src
)
if _orphan:
    fail.append(
        "builders missing from scripts/build-all.mjs, so nothing ever runs them: "
        + ", ".join(_orphan)
        + ". Add them in the right order, or list them in _ONE_OFF here if they "
        "generate assets rather than pages."
    )

_refresh = os.path.join(ROOT, ".github/workflows/refresh.yml")
if os.path.exists(_refresh):
    # Comment lines only, stripped out: the block above this step EXPLAINS the
    # rule and names the file, so a substring search over the whole yaml passes
    # even when the run line has been changed to something else.
    # Inline trailing comments too, not just whole-line ones. Stripping only
    # lines that START with # let `run: node scripts/build-pages.mjs  # replaces
    # node scripts/build-all.mjs` pass, which is the same hole in a second place.
    _rf = "\n".join(
        _re.sub(r"#.*$", "", l) for l in open(_refresh, encoding="utf-8").read().split("\n")
    )
    if "scripts/build-all.mjs" not in _rf:
        fail.append(
            "refresh.yml no longer calls scripts/build-all.mjs. Do not enumerate "
            "the builders there: that copy drifted once already and left six "
            "pages stale every night."
        )

if fail:
    print(f"\n{len(fail)} problem(s):")
    for f in fail:
        print("  " + f)
    sys.exit(1)
print("\nall checks pass")

