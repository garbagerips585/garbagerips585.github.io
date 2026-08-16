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
# ---------------------------------------------------------------------------
# TWO GUARDS AGAINST THE SAME PAIR OF MISTAKES, both of which shipped today.
#
# ONE: a page that was not regenerated. build-all.mjs exits non-zero when a
# builder throws, but if anybody runs this script separately, or pipes the build
# through grep and misses the failure, every check below happily passes against
# the LAST GOOD copy still sitting on disk. It reads green while the tree is
# broken. That happened three times in one day.
#
# TWO: a backtick inside a JavaScript comment. Several builders emit their page
# as one big template literal, so a stray backtick in an inline comment closes
# it and the file stops parsing. Cheap to scan for, impossible to see by eye.
import subprocess as _sp

_stale = []
for _b in sorted(glob.glob("scripts/build-*.mjs")):
    _bt = os.path.getmtime(_b)
    for _out in _sp.run(["grep", "-oE", r'public/[A-Za-z0-9_./-]+\.html', _b],
                        capture_output=True, text=True).stdout.split():
        if os.path.exists(_out) and os.path.getmtime(_out) < _bt - 2:
            # A builder naming the same page twice reported it twice.
            _msg = f"{_out} is older than {_b}, so it was not rebuilt"
            if _msg not in _stale:
                _stale.append(_msg)
# THE ABOVE ONLY SEES LITERAL PATHS, and most of this site is not literal. It
# greps each builder for a hardcoded "public/x.html", which covers the 28 root
# pages and nothing else: the 313 rip pages, 37 set guides and 51 Pokemon pages
# are all written to paths built at runtime, so the guard was blind to 441 of
# the 469 pages it exists to protect.
#
# It also never looked at shared/ at all, which is worse, because a one-line
# change to shared/chrome.mjs changes the head of EVERY page. That is the single
# most dangerous edit in the tree and it was the least guarded.
#
# So: after a full build every generated page is newer than every source that
# feeds it. Any page older than the newest source means the build did not run,
# or did not finish. Compare the newest source against the oldest page and say
# how far apart they are.
# ONLY WHAT BUILD-ALL ACTUALLY RUNS. Globbing all of scripts/ swept in
# build-sheet.py, which generates the spreadsheet rather than any page, so
# editing the workbook falsely reported all 469 pages as stale. A script gates
# page freshness only if build-all runs it. shared/ and assets-source/ are
# always in scope: every page's head and CSS come from there.
_ba = open("scripts/build-all.mjs", encoding="utf-8").read()
# ...except this file. check-build.py is the LAST step in build-all, so it
# matched its own name and every edit to the verifier reported the whole site
# as stale. A verifier cannot be its own trigger.
_srcs = [_f for _f in glob.glob("scripts/*.mjs") + glob.glob("scripts/*.py")
         if os.path.basename(_f) in _ba
         and os.path.basename(_f) != "check-build.py"]
_srcs += glob.glob("shared/*.mjs") + glob.glob("assets-source/*")
_newest_src, _newest_src_t = None, 0
for _f in _srcs:
    _t = os.path.getmtime(_f)
    if _t > _newest_src_t:
        _newest_src, _newest_src_t = _f, _t

_pages = glob.glob("public/**/*.html", recursive=True)
_behind = [(os.path.getmtime(_f), _f) for _f in _pages
           if os.path.getmtime(_f) < _newest_src_t - 2]
if _behind and _newest_src:
    _behind.sort()
    _mins = int((_newest_src_t - _behind[0][0]) / 60)
    _stale.append(
        f"{len(_behind)} of {len(_pages)} pages are older than {_newest_src} "
        f"(oldest is {_behind[0][1]}, {_mins} min behind). Either the build did "
        f"not run after that edit, or a builder failed partway. If an agent is "
        f"editing the tree right now this is expected: check mtimes before you "
        f"rebuild over their work.")

for _m in _stale[:8]:
    fail.append(_m)

# A REAL PARSE beats a heuristic. The first version of this grepped for a
# backtick inside a comment, which is the specific way these files have broken
# three times, and it flagged every harmless backtick in a file-level docstring
# too. node --check answers the actual question: does this file still parse.
#
# It is safe to use here because these are .mjs. On a .js file node --check
# parses as CommonJS and silently passes broken ES module syntax, which is a
# trap worth remembering rather than rediscovering.
_broken = []
for _b in sorted(glob.glob("scripts/*.mjs") + glob.glob("shared/*.mjs")):
    _r = _sp.run(["node", "--check", _b], capture_output=True, text=True)
    if _r.returncode != 0:
        _first = (_r.stderr.strip().split("\n") or [""])[0]
        _broken.append(f"{_b} does not parse: {_first[:110]}")
for _t in _broken[:8]:
    fail.append(_t)
# ---------------------------------------------------------------------------

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
#
# COMPARED IN UTC, BECAUSE THE STAMPS ARE WRITTEN IN UTC. Every sync script
# stamps `new Date().toISOString().slice(0, 10)`, which is the UTC date, and
# this read the LOCAL one. Rochester is UTC-4 in summer, so from 8pm every
# evening the two disagree by a day and a sync run in that window wrote seven
# files this check then called "in the future". It is a false failure with a
# real cost: build-all.mjs stops on it, and the honest reading of "a clock or a
# stamp is wrong" is that somebody starts hunting a corruption that is not
# there. Found by running a sync at 20:15 EDT.
#
# A stamp from toISOString() can never exceed the current UTC date, so this
# still catches the thing it is for: a genuinely wrong clock or a hand-edited
# date. The nightly workflow runs in UTC and never saw it, which is exactly why
# it survived.
import datetime
today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
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

# TCGdex scans must keep their AVIF <source>, ON THE PAGES THAT ALREADY HAVE IT.
#
# TCGdex serves the same scan at four extensions off one path and AVIF is 29.7%
# smaller than WebP at low.*, 37.2% at high.*, measured over all 533 distinct
# TCGdex urls the built site emits (all 533 answer 200 as .avif, re-checked
# 2026-08-15). avifPicture() in shared/format.mjs wraps the <img> so the WebP
# stays as the fallback for Safari 16.0-16.3.
#
# THIS EXISTS BECAUSE THE WRAPPER WAS APPLIED UNEVENLY AND NOBODY NOTICED. It
# went in with /pokemon/, /rarity.html and /wanted.html and was simply absent
# from /cards.html, /index.html and all 37 set guides, which is a builder-shaped
# hole no page-level check could see: every one of those pages rendered
# perfectly, just 30% heavier. cards.html alone was leaving 450KB on the table.
#
# SCOPED ON PURPOSE, and the scope is a to-do list rather than a judgement. The
# rip pages, hall.html and games/guess-the-set.html still emit bare TCGdex
# <img>; widen _AVIF_PAGES as each builder is converted, and delete the glob
# list entirely once the last one is. A guard that fails on pages nobody has
# converted yet gets commented out on the first red build, which is worse.
_AVIF_PAGES = ["public/cards.html", "public/index.html", "public/sets/*.html"]
_pic = _re.compile(r"<picture\b[^>]*>.*?</picture>", _re.S)
_img_tag = _re.compile(r"<img\b[^>]*>")
# <script> is blanked first: build-cards.mjs and build-set-pages.mjs both build
# an <img> string in browser JS, and those have no literal url in the file to
# read. They are covered by the data-img check below instead.
_script = _re.compile(r"<script\b[^>]*>.*?</script>", _re.S)
_tcgdex_webp = _re.compile(r"https://assets\.tcgdex\.net/[^\"'\s>]+\.webp")
_avif_source = _re.compile(r'<source[^>]+type="image/avif"')
_bare = {}
for _pat in _AVIF_PAGES:
    for _p in sorted(glob.glob(_pat)):
        _h = open(_p, encoding="utf-8").read()
        _h = _script.sub(lambda m: " " * len(m.group(0)), _h)
        _spans = [
            (m.start(), m.end()) for m in _pic.finditer(_h) if _avif_source.search(m.group(0))
        ]
        _n = sum(
            1
            for m in _img_tag.finditer(_h)
            if _tcgdex_webp.search(m.group(0))
            and not any(s <= m.start() and m.end() <= e for s, e in _spans)
        )
        if _n:
            _bare[_p] = _n
        # The chase-card lightbox loads high.webp from a data-img attribute on
        # click, so no <img> in the file names it and the loop above is blind to
        # it. The page script fills #lbAvif; if that element is gone the lightbox
        # is back to serving WebP at 100-135KB a card.
        if "data-img=\"https://assets.tcgdex.net" in _h and 'id="lbAvif"' not in _h:
            fail.append(f"{_p}: chase-card lightbox lost its #lbAvif <source>")
if _bare:
    fail.append(
        "TCGdex scans rendered without their AVIF <source>, so these pages ship "
        "~30% more image bytes than they need to: "
        + ", ".join(f"{k} ({v})" for k, v in sorted(_bare.items())[:8])
        + (f" and {len(_bare) - 8} more" if len(_bare) > 8 else "")
        + ". Wrap the <img> in avifPicture() from shared/format.mjs."
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

# ---------------------------------------------------------------------------
# EVERY SET WE HAVE RIPPED NEEDS A GUIDE.
#
# The site's own promise: a rip page for a set links to that set's guide, the
# set index lists it, and the homepage tile points at it. A set that has been
# opened on camera but has no guide breaks that quietly. The rip page simply
# drops its guide link, so nothing looks broken and nobody notices the page was
# never built.
#
# This became reachable the day the spreadsheet's Set dropdown grew from the 28
# sets with guides to every English set ever printed, which is what Tim asked
# for: a tin can hold a pack from a set we have no guide for, and he needs to be
# able to record that. The tag is now possible, so the gap is now possible.
#
# It fails rather than warns because the fix is short and the alternative is
# shipping a set the site half knows about. The message names the sets and the
# rip counts so it is actionable without going looking.
_guides = {os.path.basename(p)[:-5] for p in glob.glob("public/sets/*.html")} - {"index"}
try:
    _vids = json.load(open("public/data/videos.json", encoding="utf-8"))["videos"]
except Exception:
    _vids = []
_ripped = {}
for _v in _vids:
    for _s in (_v.get("sets") or []):
        _ripped[_s] = _ripped.get(_s, 0) + 1
_nogUide = sorted(((n, s) for s, n in _ripped.items() if s not in _guides), reverse=True)
if _nogUide:
    _list = ", ".join(f"{s} ({n} rip{'' if n == 1 else 's'})" for n, s in _nogUide[:8])
    _more = "" if len(_nogUide) <= 8 else f" and {len(_nogUide) - 8} more"
    fail.append(
        f"{len(_nogUide)} set(s) have been ripped on camera but have no guide page: "
        f"{_list}{_more}. A rip page for one of these silently drops its guide "
        f"link, so it looks fine and is not. Add the set to sync-sets.mjs, "
        f"sync-cards.mjs and shared/taxonomy.mjs, then rebuild."
    )

if fail:
    print(f"\n{len(fail)} problem(s):")
    for f in fail:
        print("  " + f)
    sys.exit(1)
print("\nall checks pass")

