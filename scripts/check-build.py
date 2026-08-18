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

# Pages that build-all does not write cannot be stale relative to it. The
# palette comparison is generated by scripts/gen-palette-preview.mjs, which is
# deliberately named gen- rather than build- so the nightly never runs it, and
# it was reporting the whole site as stale every time anything else was edited.
#
# THE SET IS EMPTY SINCE 16 AUGUST 2026 and the reason is better than the
# exemption was: that file no longer lives under public/ at all. It was a
# 135KB unlinked working file sitting in the deploy root, which pages.yml
# uploads wholesale, so it was already being served and only robots.txt kept
# it quiet. It writes to assets-source/ now. Anything that genuinely is a page
# of the site should be built by build-all, so the right way to use this set is
# to leave it empty and move the file instead.
# AND IT IS NOT EMPTY ANY MORE, 18 August 2026, for the six palette samples.
# They are the one case the paragraph above cannot answer, because "move the
# file" is exactly what they cannot do: scripts/gen-palette-samples.mjs writes
# six copies of the home page so TIM CAN OPEN THEM ON HIS PHONE, and a phone
# cannot open a file off assets-source/ on a laptop. They must sit in the
# deploy root to be reachable at a url, which is argued in that file's header
# and bought with four guards (noindex, no canonical, not in the sitemap,
# nothing links to them).
#
# They are written by a gen- script that build-all deliberately never runs, so
# EVERY builder edit reports all six as stale and fails this check on a tree
# that is completely correct. That happened on the Trubbish repaint: 62 of 62
# builders ok, one problem, and the problem was six throwaway files.
#
# THE ALTERNATIVE WAS WORSE. Re-running the generator to refresh their mtimes
# would rewrite the six pages Tim is using as a reference, and touching them to
# silence a verifier is the "edit the expectation until it passes" move this
# repo warns about everywhere else.
#
# DELETE THIS SET WITH THE FILES. LAUNCH.md already schedules that, and the
# comment above is right that the set should be empty: it is empty again the
# moment the six previews go.
_NOT_BUILT = set(glob.glob("public/preview-*.html"))
_pages = [p for p in glob.glob("public/**/*.html", recursive=True) if p not in _NOT_BUILT]
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
#
# LOUD IS NOT THE SAME AS USEFUL. These reads were bare json.load(), so a
# half-written card-index.json (an interrupted sync leaves exactly that) ended
# the run with a raw JSONDecodeError traceback. It is non-zero, so it does stop
# a publish, but the message is "Unterminated string starting at: line 1 column
# 888" and it does not name a file: build-all.mjs shows the last four lines of
# stderr, which is the middle of a stack trace through json/decoder.py. Every
# other failure in this script names the file and the fix, so these do too.
def _read_json(path):
    """Parsed document, or None with the reason already recorded in `fail`."""
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception as e:
        fail.append(f"{path} does not parse as JSON ({e}). Re-run the sync that writes it.")
        return None


DATA = [
    ("public/data/card-index.json", "cards", 4000),
    ("public/data/site-index.json", "rips", 300),
    ("public/data/videos.json", "videos", 300),
]
for path, key, floor in DATA:
    if not os.path.exists(path):
        fail.append(f"{path} is missing")
        continue
    doc = _read_json(path)
    if doc is None:
        continue
    rows = doc.get(key) or []
    if len(rows) < floor:
        fail.append(f"{path}: {len(rows)} {key}, expected at least {floor}")
    else:
        note(f"  {len(rows):>4} {key} in {os.path.basename(path)}")

# Prices are the thing most likely to silently go null.
ci = "public/data/card-index.json"
_ci_doc = _read_json(ci) if os.path.exists(ci) else None
if _ci_doc is not None:
    cards = _ci_doc.get("cards") or []
    # A row shorter than five columns is an IndexError here, and the traceback
    # says "list index out of range" without saying which file grew a new shape.
    _short = [c for c in cards if not isinstance(c, list) or len(c) < 5]
    if _short:
        fail.append(f"{ci}: {len(_short)} card row(s) have fewer than 5 columns, so the "
                    f"price column c[4] does not exist. build-cards.mjs and "
                    f"sync-cards.mjs disagree about the row shape.")
    priced = sum(1 for c in cards if isinstance(c, list) and len(c) > 4 and isinstance(c[4], (int, float)))
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
    _pi_doc = _read_json(pi)
    if _pi_doc is not None:
        n = len(_pi_doc.get("pokemon") or [])
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
# THE `except: continue` HERE USED TO SWALLOW A CORRUPT FILE ENTIRELY. Every
# file in this glob is SERVED to the browser: card-index.json and site-index.json
# are what /search.html reads, and public/data/cards/*.json is the price on every
# set guide. A half-written one from an interrupted sync fails json.load, and the
# only thing that happened was that this loop moved on to the next file. Nothing
# else in this script parses most of them, so a broken published feed shipped
# green. A file that does not parse is a worse problem than a bad date in it.
for path in glob.glob("public/data/*.json") + glob.glob("public/data/cards/*.json"):
    try:
        doc = json.load(open(path, encoding="utf-8"))
    except Exception as _e:
        fail.append(f"{path} does not parse as JSON ({_e}). It is served to the browser, "
                    f"so re-run the sync that writes it.")
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
# SCOPED ON PURPOSE, and the scope is a to-do list rather than a judgement.
# games/guess-the-set.html still emits bare TCGdex <img>; widen _AVIF_PAGES as
# each builder is converted, and delete the glob list entirely once the last one
# is. A guard that fails on pages nobody has converted yet gets commented out on
# the first red build, which is worse.
#
# hall.html joined the list on 2026-08-16: build-hall.mjs now wraps its 15
# plaque scans and fills #lbAvif for the lightbox. Measured at 390x844, the page
# went from 301.0KB to 246.4KB transferred, images 172.3KB to 117.7KB.
#
# THE 313 RIP PAGES joined on 2026-08-16 and they are the big one: 811 bare
# TCGdex scans across three sites in build-pages.mjs, the .chaser list, the
# .hitcard grid, plus the #hitlbImg lightbox, which loads high.webp from a
# data-img attribute and so needs the #hitlbAvif <source> rather than the
# wrapper.
#
# 265 of the 313 pages carry scans at all. Measured by content-length over the
# 99 distinct urls those pages emit, weighted by how many pages emit each: the
# scans go from 22.19MB to 15.64MB across the whole rip section, 6.55MB saved,
# 29.5% off, 25.3KB a page. Driven in headless Chrome at 390x844 with the cache
# off, /rip/mega-meganium-box-2-where-are-the-hits-blSCuSk5nb0.html, which
# carries the median three scans, went from 583.5KB to 561.5KB transferred and
# its TCGdex bytes from 79.3KB to 56.9KB.
_AVIF_PAGES = ["public/cards.html", "public/index.html", "public/sets/*.html", "public/hall.html", "public/rip/*.html"]
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
        # A lightbox loads high.webp from a data-img attribute on click, so no
        # <img> in the file names it and the loop above is blind to it. The page
        # script fills a <source>; if that element is gone the lightbox is back
        # to serving WebP at 100-135KB a card.
        #
        # TWO IDS, because they are two lightboxes in two builders: the set
        # guides' chase-card one is #lbAvif (build-set-pages.mjs) and the rip
        # pages' hit-card one is #hitlbAvif (build-pages.mjs), which sits in a
        # dialog whose every id is already prefixed hitlb. Either satisfies this,
        # because no page has both.
        if "data-img=\"https://assets.tcgdex.net" in _h and not (
            'id="lbAvif"' in _h or 'id="hitlbAvif"' in _h
        ):
            fail.append(f"{_p}: card lightbox lost its AVIF <source>")
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
    "build-playlist-covers.py",  # playlist covers, from .cache + the set logos
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
# A SET WE HAVE RIPPED AND HAVE NO GUIDE FOR IS A TODO, NOT A BUILD FAILURE.
#
# THIS CHECK USED TO FAIL THE BUILD AND THE STANCE WAS WRONG. It was written the
# day before the Set dropdown grew, in anticipation of it, and it said: a set
# opened on camera with no guide page breaks the site's own promise, so refuse
# to publish until somebody writes the guide.
#
# The whole point of growing the dropdown is that Tim can record a pack from a
# 2019 set that came out of a 2023 tin. Writing that set's guide means running
# sync-sets.mjs and sync-cards.mjs, which are network jobs against an API that
# rate-limits hard and answers 500 rather than 429, and a cold run takes several
# minutes. Failing the build turns "log the pack you just opened" into "log the
# pack, then fetch a full checklist before the site can deploy again", which is
# exactly the wall the non-strict dropdowns exist to avoid. The nightly would
# have started failing on the first tin.
#
# The worry underneath it was real and is answered somewhere better: nothing may
# LINK to a guide that does not exist. Every /sets/ url on a rip page now goes
# through hasGuide() in build-pages.mjs, and check 2 above fails the build on a
# broken internal link, so a missing guide cannot become a 404. What is left is
# a page that names its set, filters by it and simply has no guide chip, which
# is the honest rendering of "we have not written that one yet".
#
# So it prints. The list is worth having in front of you, because a set with
# several rips probably HAS earned a guide, and this is where you would notice.
_guides = {os.path.basename(p)[:-5] for p in glob.glob("public/sets/*.html")} - {"index"}
# THIS `except` USED TO WRITE `_vids = []` AND THAT EMPTIED TWO CHECKS AT ONCE.
# `_ripped` feeds the no-guide report below AND the app.js spelling check at the
# bottom of this file, and both of them walk it with a `for`. An empty dict
# means zero iterations, zero findings and a green run: the verifier reports
# success precisely because it lost its input. Same shape as every bug this file
# exists to catch, sitting inside the file that catches them.
try:
    _vids = json.load(open("public/data/videos.json", encoding="utf-8"))["videos"]
except Exception as _e:
    _vids = []
    fail.append(f"could not read videos from public/data/videos.json ({_e}), so the "
                f"no-guide report and the app.js set-name check below both have "
                f"nothing to walk and would pass empty")
_ripped = {}
for _v in _vids:
    for _s in (_v.get("sets") or []):
        _ripped[_s] = _ripped.get(_s, 0) + 1
if _vids and not _ripped:
    fail.append(f"{len(_vids)} videos in videos.json and not one carries a `sets` tag. "
                f"Either every tag was dropped on sync or the field was renamed; "
                f"the app.js set-name check below compares nothing when this is empty")
_noguide = sorted(((n, s) for s, n in _ripped.items() if s not in _guides), reverse=True)
if _noguide:
    note(
        f"\n  {len(_noguide)} set(s) ripped on camera with no guide page yet. Their rip "
        f"pages name the set and filter by it, they just carry no guide chip:"
    )
    for _n, _s in _noguide[:8]:
        note(f"    {_s:<34} {_n} rip{'' if _n == 1 else 's'}")
    if len(_noguide) > 8:
        note(f"    ...and {len(_noguide) - 8} more")
    note("  To promote one: add it to sync-sets.mjs and sync-cards.mjs, then rebuild.")

# ---------------------------------------------------------------------------
# NO LAUNDERED PACK COUNT MAY REACH public/data/videos.json.
#
# data/manual.json holds 244 `packs` values that nobody typed. build-sheet.py
# prefilled the sheet's Packs column from PRODUCT_TO_PACKS, which is how many
# packs a product CONTAINS, while the column asks how many the VIDEO opened.
# The prefill was blue text and colour does not survive export to CSV, so
# import-sheet.mjs read every suggestion back as an answer. It shipped once:
# 21 Chaos Rising ETB rips carrying 9 each, and /luck.html printing
# "232 packs counted" where 21 packs were opened.
#
# The suppression lives entirely in nine lines at the end of sync-youtube.mjs.
# Reverting one of them republishes all 244, and NOTHING WOULD LOOK WRONG: the
# data file is untouched, the JSON is valid, every page renders, and the numbers
# are individually plausible. That is one line of one script standing between
# this site and the exact figure it has already had to retract.
#
# THE SIGNATURE IS A CONTRADICTION THE DATA STATES ABOUT ITSELF, which is why
# this can be checked rather than merely commented. A video with a Pack # is a
# video about ONE pack out of a box: Tim's own sheet says so. A video whose
# `packs` equals the whole product's capacity did not open one pack out of it.
# Both claims cannot be true, and the prefill is the only thing that produces
# the pair. The single legitimately published count today, iIgTusrqVtg, is an
# ETB carrying packs=1 against a capacity of 9, so it passes.
#
# Capacity is READ OUT OF build-sheet.py rather than retyped here. That table is
# the thing that caused the bug and a second copy of it in the verifier is how a
# verifier comes to agree with a bug. If the parse stops finding it, that is a
# failure and not a skip: a guard that quietly checks nothing is worse than none.
_cap = {}
try:
    _src = open("scripts/build-sheet.py", encoding="utf-8").read()
    _blk = re.search(r"^PRODUCT_TO_PACKS = \{(.*?)^\}", _src, re.S | re.M).group(1)
    _cap = {k: int(v) for k, v in re.findall(r'"([^"]+)"\s*:\s*(\d+)', _blk)}
    if not _cap:
        raise ValueError("PRODUCT_TO_PACKS parsed to an empty table")
except Exception as _e:
    fail.append(f"could not read PRODUCT_TO_PACKS out of scripts/build-sheet.py ({_e}), "
                f"so the laundered-pack-count guard below has no capacities and "
                f"would pass every video by checking nothing")

if _cap:
    _laundered = []
    for _v in _vids:
        _p = _v.get("packs")
        if _p is None or not _v.get("packNumber"):
            continue
        for _prod in (_v.get("products") or []):
            # Capacity 1 is exempt: a single booster pack whose row says Pack #1
            # legitimately opened 1 of 1, so the contradiction does not exist.
            if _cap.get(_prod, 0) > 1 and _p == _cap[_prod]:
                _laundered.append((_v.get("id"), _prod, _p, _v.get("packNumber")))
    for _id, _prod, _p, _pn in _laundered:
        fail.append(
            f"videos.json {_id}: packs={_p} is the whole capacity of a '{_prod}' and the "
            f"video also states Pack #{_pn}, so it opened one pack out of the box. That is the "
            f"signature of the PRODUCT_TO_PACKS prefill in data/manual.json, not a counted "
            f"figure. See the suppression block at the end of scripts/sync-youtube.mjs and the "
            f"_WARNING at the top of data/manual.json"
        )
    note(f"  {len(_vids)} videos checked for laundered pack counts, "
         f"{sum(1 for _v in _vids if _v.get('packs') is not None)} carry one")

# ---------------------------------------------------------------------------
# app.js AND shared/taxonomy.mjs HAVE TO SPELL EVERY SET THE SAME WAY.
#
# app.js renders every tile after a filter and build-proto.mjs renders the first
# 48 into the HTML from taxonomy.mjs, so the two are drawing the same grid from
# two tables. They have disagreed twice: "Pokemon GO" against "Pokémon GO", and
# 21 tiles reading "Ja Abyss Eye" because app.js fell through to its title-case
# fallback. Both were found by a human diffing grids, which is not a plan.
#
# It matters more now. The Set dropdown offers 146 sets with no guide page, so
# app.js can be handed an id it has never seen, and title-casing gets 51 of them
# wrong in ways that read as a rendering fault ("Mcdonald S Collection 2011").
# app.js lists exactly those 51 and leans on the fallback for the other 95, and
# THAT is the arrangement this check exists to hold: it recomputes labelOf() and
# compares it against the canonical name for every set id actually in use.
#
# Only ids in videos.json are checked, because those are the only ones that can
# reach a tile, and it fails rather than warns because the fix is one line.
_labels = {}
try:
    _src = open("public/assets/app.js", encoding="utf-8").read()
    _sets_obj = re.search(r"\bsets:\s*\{(.*?)\n    \},", _src, re.S)
    for _k, _v in re.findall(r'"([^"]+)":\s*"((?:[^"\\]|\\.)*)"', _sets_obj.group(1)):
        # Only the two escapes a set name could plausibly carry. NOT
        # unicode_escape, which would mangle the é in "Pokémon GO" back into
        # mojibake and report a mismatch that is not there.
        _labels[_k] = _v.replace('\\"', '"').replace("\\\\", "\\")
except Exception as e:
    fail.append(f"could not read LABELS.sets out of public/assets/app.js: {e}")


def _title_case(_id):
    """app.js labelOf()'s fallback, restated."""
    return " ".join(w[:1].upper() + w[1:] for w in str(_id).split("-"))


# EVERY ONE OF THESE READS WAS `except Exception: pass`, AND THE COMPARISON
# BELOW SKIPS ANY SET IT HAS NO CANONICAL NAME FOR. Those two facts together are
# the failure this file keeps finding elsewhere: lose all three files and
# `_canon` is empty, every `_want` is None, every set hits the `continue`, and
# the check reports no disagreements because it made no comparisons.
#
# It is not hypothetical arithmetic. Measured on 16 August 2026: expansions.json
# and sets.json between them name 28 of the 35 set ids that reach a tile, and
# intl-guides.json names the other 13 (there is overlap). Drop intl-guides
# alone and 13 sets stop being checked in silence. So each source says so when
# it cannot be read, and the comparison counts what it actually compared.
_canon = {}
for _f, _key in (("public/data/expansions.json", "sets"), ("public/data/sets.json", "sets")):
    try:
        for _s in json.load(open(_f, encoding="utf-8"))[_key]:
            _canon[_s.get("slug") or _s.get("id") or ""] = _s["name"]
    except Exception as _e:
        fail.append(f"could not read {_key} out of {_f} ({_e}), so the app.js set-name "
                    f"check below silently stops checking the sets it names")
_canon.pop("", None)
try:
    _LANG = {"ja": "JP", "ko": "KR", "zh-cn": "CN", "zh-tw": "CN"}
    for _id, _g in json.load(open("public/data/intl-guides.json", encoding="utf-8"))["sets"].items():
        _canon[_id] = f"{_g['english']} ({_LANG.get(_g.get('lang'), '??')})"
except Exception as _e:
    fail.append(f"could not read sets out of public/data/intl-guides.json ({_e}), so the "
                f"app.js set-name check below silently stops checking the 13 "
                f"non-English sets it is the only source for")

# An empty LABELS.sets is not "nothing to check", it is a lost input: app.js
# would be title-casing all 87 names it currently spells out by hand.
if not _labels:
    fail.append("LABELS.sets in public/assets/app.js parsed to zero entries, so the "
                "set-name check has nothing to compare and would pass empty. Check the "
                "`sets: {` block is still there and still in that shape.")
if _labels:
    _wrong = []
    _compared = 0
    for _s in sorted(_ripped):
        _want = _canon.get(_s)
        if not _want:
            continue          # not an English set or an imported guide; nothing to compare
        _compared += 1
        _got = _labels.get(_s) or _title_case(_s)
        if _got != _want:
            _wrong.append(f'{_s}: app.js renders "{_got}", the site says "{_want}"')
    note(f"  {_compared} of {len(_ripped)} ripped set names cross-checked against app.js")
    # THE COUNT IS THE GUARD. A run that compares nothing is indistinguishable
    # from a run that compares everything and finds nothing, which is exactly
    # how the checks this file replaced stayed green while the tree was broken.
    if _ripped and not _compared:
        fail.append(
            f"the app.js set-name check compared 0 of {len(_ripped)} ripped sets, so it "
            f"passed without looking at anything. Nothing in expansions.json, sets.json "
            f"or intl-guides.json names any set id that videos.json uses, which means one "
            f"of those feeds changed its id shape."
        )
    if _wrong:
        fail.append(
            f"{len(_wrong)} set name(s) spelled differently by public/assets/app.js and the "
            f"rest of the site, so the same set appears twice over inside one grid: "
            + "; ".join(_wrong[:6])
            + (f" and {len(_wrong) - 6} more" if len(_wrong) > 6 else "")
            + ". Add the id to LABELS.sets in public/assets/app.js."
        )

# THE VERDICT GOES TO STDERR AND THE REASON WAS INVISIBLE UNTIL IT DID.
#
# build-all.mjs runs this file as its LAST step with stdio ["ignore","ignore",
# "pipe"]: it throws stdout away and prints the last four lines of STDERR when a
# step exits non-zero. Every line below used to be a plain print(), so a failing
# safety net rendered as exactly this and nothing else:
#
#     FAIL  python3 scripts/check-build.py
#
# The one check that exists to stop a broken site shipping could not say what
# was wrong through the one command that runs it. Whoever saw that line had to
# know to re-run the script by hand to find out, and the failure mode if they
# did not is the whole point of this file.
#
# The LAST line is a one-line summary on purpose, because four lines is all
# build-all shows: whatever the tail happens to be, the final line always names
# the count and the command that prints the full list.
# One file read by three checks reports its parse failure three times. Deduped
# in order, so the count is a count of problems rather than of complaints.
fail = list(dict.fromkeys(fail))
# ---------------------------------------------------------------------------
# NaN, undefined AND null MUST NEVER REACH A READER.
#
# Added the day a one line change shipped "it is in getting NaN of them into one
# envelope" to a live page. Every builder ran, every existing check passed, and
# the sentence was nonsense: a mean was computed from an array before the loop
# that fills it, so it divided by zero. A template literal prints whatever it is
# handed, and NaN is a perfectly good string.
#
# The same shape has bitten twice before. hall.html printed the literal word
# "null" as the set name on its two most valuable cards, and a builder asked a
# JSON file for a key that does not exist and got undefined.
#
# Scoped to VISIBLE TEXT, with script and style stripped, because "null" is
# ordinary inside JSON-LD and inside the data blocks these pages carry.
_bad = []
for _f in sorted(glob.glob("public/**/*.html", recursive=True)):
    _s = open(_f, encoding="utf-8").read()
    _t = _re.sub(r"(?s)<(script|style)\b.*?</\1>", " ", _s)
    _t = _re.sub(r"(?s)<[^>]+>", " ", _t)
    for _m in _re.finditer(r"(?<![\w-])(NaN|undefined)(?![\w-])", _t):
        _ctx = _re.sub(r"\s+", " ", _t[max(0, _m.start() - 45):_m.end() + 30]).strip()
        _bad.append(f"{_f}: {_m.group(1)} in visible text ... {_ctx[:95]}")
for _m in _bad[:6]:
    fail.append(_m)
if len(_bad) > 6:
    fail.append(f"...and {len(_bad) - 6} more NaN/undefined in visible text")


# ---------------------------------------------------------------------------
# IMAGE COVERAGE, REPORTED EVERY BUILD.
#
# The owner's standard is that this is a visual site and every page that can
# carry pictures should. That is easy to achieve once and lose quietly, because
# a page losing its images looks like a page, and nothing errors.
#
# So the density is printed rather than asserted, per section, as visuals per
# thousand words of body text. The number that started this was the openings
# pages at 1.9 against the Pokemon pages at 83.9, which is what a ranking makes
# obvious and reading never would.
#
# **IT COUNTED `<img>` AND `<svg>` ONLY UNTIL 17 AUGUST 2026 AND IT STEERED A
# DAY OF IMAGERY WORK WHILE PARTLY BLIND.** A chart drawn in HTML and CSS scored
# ZERO. /buying.html's three bar charts are `.bch` rows of divs and spans, so
# the number that called that page thin was counting 26 brand logos and 2 chrome
# sprites and none of its three actual arguments. /selling.html's density went
# DOWN, 2.0 to 1.9, on the day it gained a figure, because its ladder's labels
# count as words and its bars count as nothing. A page could be flagged as thin
# while being the most illustrated page on the site, and adding a real chart
# could lower its score.
#
# **WHAT COUNTS NOW, and it is a convention rather than a guess about markup
# shape**, because "a div with a percentage width" would have swept in the
# carousel's progress bar on /index.html and the toolbar on /videos.html, both
# of which are chrome, and a rule that inflates every page using divs would be
# worse than the undercount it replaced. A FIGURE is:
#
#   1. a `<figure>` element. The builders already share this one and it covers
#      almost everything: /buying.html and /selling.html's charts, `bars()` on
#      the retailer pages, and the drawn charts on /pack-prices.html,
#      /complete-a-set.html, /shops.html and /card-shows.html are all inside one
#      already, so most of this fix cost no page edit at all.
#   2. any element carrying `data-figure`. Added 17 August 2026 to the two
#      charts on a set guide, `.rarity-list` and `.svc`, which are the only
#      figures on the site drawn in markup and NOT wrapped in a `<figure>`.
#      The attribute selects nothing anywhere and changes no rendering.
#   3. an `<svg role="img">` that is not already inside one of those. The site
#      writes `role="img"` with an aria-label on a diagram and `aria-hidden` on
#      decoration, so this is the builders' own distinction, and it is what
#      picks up the 19 `rt-fig-svg` shop diagrams and /fake-cards.html's eight.
#
# Nested matches count ONCE, so a figure holding six pictures is one figure.
#
# THE DENSITY COLUMN ADDS A FIGURE ONLY WHEN IT CONTAINS NO `<img>` AND NO
# `<svg>`, which is the conservative half: the correction can add at most one
# per drawn figure and can never double count artwork that already counted
# itself. So the number can only go UP, which is also why the hard rule below
# cannot start firing on a page it used to pass.
#
# THE SECOND COLUMN IS THE USEFUL ONE and it is why this is not just an
# arithmetic fix. A raw count scores a decorative divider glyph the same as a
# 22 bar chart: /evolution.html carries 484 inline SVGs, almost all of them type
# pips, and reads as one of the best illustrated pages on the site with not one
# figure on it. The figure count separates "this page has pictures that carry
# arguments" from "this page has 26 brand logos".
#
# It names one thing outright: a page with real body copy and nothing visual at
# all. Everything else is a judgement call about whether a picture would help,
# and a build is the wrong place to have that argument.
#
# IT IS A REAL GUARD SINCE 16 AUGUST 2026. This block used to say "reported
# rather than failed, for now", because eight pages had body copy and nothing
# visual and failing would have blocked every unrelated push while the imagery
# pass landed. That pass is finished. Checked two ways before the swap: the
# rule below re-run standalone over all 485 pages carrying a <main> returned
# zero hits, and a full run printed no line from it. So the promise the old
# comment made is kept here rather than left as a note nobody has to act on,
# which is what it warned against becoming.
#
# If this fires on a page you are adding, the fix is an image or an inline
# diagram, not an entry in the exemption set below. That set is for pages with
# no pictures BY DESIGN, and it is deliberately three lines long.
_shout = fail.append
# 404 and search are utility pages, not articles. Neither would trip the rule
# today anyway (404 has an inline svg and 35 words, search has 149, both under
# the 250 word floor), but they are named so that growing one past the floor is
# a decision rather than a surprise failure.
#
# palette-preview.html WAS THE THIRD ENTRY AND IT WAS ALWAYS DEAD. The rule
# only looks at pages with a <main> and that file has none, so the exemption
# never did anything. It is gone along with the file, which moved out of the
# deploy root to assets-source/ in the same edit; see gen-palette-preview.mjs.
_TEXT_ONLY_OK = {"public/404.html", "public/search.html"}

# The three ways of starting a figure, in the order they are cheapest to test.
_FIG_STARTS = (
    _re.compile(r"<figure\b"),
    _re.compile(r"<[a-zA-Z][\w-]*\b[^>]*\sdata-figure="),
    _re.compile(r'<svg\b[^>]*\srole="img"'),
)
_TAG = _re.compile(r"<(/?)([a-zA-Z][\w-]*)\b")


def _el_span(_h, _i):
    """Span of the element whose opening tag starts at _i, by tag matching.

    Counted rather than matched with a lazy `.*?` regex, because a lazy match
    stops at the FIRST closing tag and would end a `<figure>` at the `</figure>`
    of a figure nested inside it, cutting the outer one short. Nothing on the
    site nests figures today; the point is that the count does not quietly
    change meaning the day something does.
    """
    _name = _TAG.match(_h, _i).group(2).lower()
    _depth = 0
    for _m in _TAG.finditer(_h, _i):
        if _m.group(2).lower() != _name:
            continue
        if _m.group(1):
            _depth -= 1
            if _depth <= 0:
                _end = _h.find(">", _m.end())
                return (_i, len(_h) if _end < 0 else _end + 1)
        else:
            _depth += 1
    return (_i, len(_h))


def _figures(_h):
    """Outermost figure spans in the given markup, in document order."""
    _starts = sorted({_m.start() for _p in _FIG_STARTS for _m in _p.finditer(_h)})
    _out = []
    for _p in _starts:
        if _out and _p < _out[-1][1]:
            continue                      # nested inside the figure before it
        _out.append(_el_span(_h, _p))
    return _out


_cov = {}
for _f in sorted(glob.glob("public/**/*.html", recursive=True)):
    _s = open(_f, encoding="utf-8").read()
    _m = _re.search(r"(?s)<main\b.*?</main>", _s)
    if not _m:
        continue
    _body = _m.group(0)
    _art = len(_re.findall(r"<img\b", _body)) + len(_re.findall(r"<svg\b", _body))
    _figs = _figures(_body)
    # A figure holding no artwork is drawn in HTML and CSS, so it is the one
    # this count used to miss entirely. One apiece, never more.
    _drawn = sum(1 for _a, _b in _figs if not _re.search(r"<(img|svg)\b", _body[_a:_b]))
    _imgs = _art + _drawn
    _txt = _re.sub(r"(?s)<(script|style)\b.*?</\1>", " ", _body)
    _words = len(_re.sub(r"(?s)<[^>]+>", " ", _txt).split())
    _sec = _f.split("/")[1] if _f.count("/") > 1 else "root"
    _a, _b, _c, _d, _e = _cov.get(_sec, (0, 0, 0, 0, 0))
    _cov[_sec] = (_a + _imgs, _b + _words, _c + 1, _d + len(_figs), _e + (1 if _figs else 0))
    if _words >= 250 and _imgs == 0 and _f not in _TEXT_ONLY_OK:
        _shout(f"{_f}: {_words} words and nothing visual in <main>. Add an image or an inline diagram.")
if _cov:
    note("")
    note("  visuals per 1,000 words of body copy, and how many of them are figures")
    note("  visual: an <img>, an <svg>, or a figure drawn in markup")
    note("  figure: a <figure>, a [data-figure] or an <svg role=img>, counted once,")
    note("          so a chart or a captioned picture counts and a loose logo does not")
    for _sec, (_i, _w, _n, _g, _p) in sorted(_cov.items(), key=lambda kv: -(kv[1][0] * 1000 / max(1, kv[1][1]))):
        _paren = f"({_n} pages, {_i} visuals)"
        note(f"    {_sec:<12} {_i * 1000 / max(1, _w):>7.1f}   {_paren:<28}"
             f"{_g:>6} figures on {_p} of {_n} pages")


if fail:
    print(f"\n{len(fail)} problem(s):", file=sys.stderr)
    for f in fail:
        print("  " + f, file=sys.stderr)
    print(f"{len(fail)} problem(s) found by scripts/check-build.py. "
          f"Run: python3 scripts/check-build.py", file=sys.stderr)
    sys.exit(1)
print("\nall checks pass")

