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
# A wrong answer in the hand-filled workbook. Reported as loudly as `fail`,
# but exits 2 rather than 1 so it cannot halt the nightly. Full argument is
# beside the printing block at the foot of this file.
sheet_fail = []


# A PAGE THAT VANISHED BETWEEN THE GLOB AND THE READ IS NOT A BROKEN SITE.
#
# Every read below walks a list built by globbing public/. When something else
# is writing the tree at the same time -- an agent mid-rebuild, an interrupted
# build -- a file can be listed and then gone a moment later, and the bare
# open() ended the whole run with `FileNotFoundError: public/pokemon/
# chingling.html` and a stack trace. That is non-zero, so it does stop a
# publish, but it reads as "the site is broken" when the truth is "read it
# again". Six agents rebuilding this tree in one night hit it repeatedly.
#
# Same treatment as _read_json below, and for the same reason: every other
# failure in this file names the file and the fix, so these do too. It is
# still recorded as a failure rather than skipped, because a file that is
# genuinely missing from a finished build IS a broken site.
def _read_page(path):
    """Page source, or "" with the reason already recorded in `fail`."""
    try:
        return open(path, encoding="utf-8").read()
    except FileNotFoundError:
        fail.append(
            f"{path} was listed and then could not be read. If something is "
            f"writing the tree right now, re-run this; if not, a builder "
            f"deleted a page it had already emitted."
        )
        return ""
    except Exception as e:
        fail.append(f"{path} could not be read ({e}).")
        return ""
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
# COMMENTS STRIPPED FIRST, FOR THE SAME REASON THE _orphan GUARD 500 LINES BELOW
# STRIPS THEM. This was a plain substring search over the raw file, so a script
# whose name appears only in build-all's PROSE counted as a build step. It has a
# lot of prose: line 245 reads "scripts/sync-decks.mjs, which is NOT in this list
# and must not be", and that sentence alone put sync-decks.mjs into the set that
# gates page freshness. Measured: 14 scripts were in here that build-all never
# runs -- the sync-*, verify-*, sweep-scans and import-sheet family. Editing any
# one of them reported all 1,504 pages stale and forced exactly the no-op full
# rebuild that _OWNER_ASSETS below exists to prevent. The _orphan guard learned
# this lesson already and its comment says an audit defeated it in the way it
# existed to prevent; this half of the file never got the same treatment.
#
# Checked against the 68 quoted steps before changing it: the strip loses NO real
# builder. import-sheet.mjs is the one survivor, because its name is in a printed
# help string rather than a comment, and one stale entry is a fair price for a
# change that cannot silently drop a source.
# A QUOTED STEP, NOT A SUBSTRING, WHICH IS THE END OF THIS PARTICULAR BUG.
# Stripping // comments got 13 of the 14 false entries and left import-sheet.mjs,
# because its name is inside a QUOTED HELP STRING -- "the cell and re-run
# scripts/import-sheet.mjs; nothing here needs redoing." -- and no amount of
# comment stripping reaches prose that lives in a string literal. Matching the
# actual invocation instead ends the whole class: build-all runs a script by
# writing "node scripts/X" or "python3 scripts/X" and nothing else does.
#
# Checked before switching: 68 unique quoted steps, and moving to this test drops
# exactly import-sheet.mjs and adds nothing. fetch-fonts.sh is invoked as bash
# rather than node, which costs nothing here because _srcs globs only .mjs/.py.
_steps = {_s.split("/")[-1] for _s in
          re.findall(r'"(?:node|python3) (scripts/[A-Za-z0-9._-]+)', _ba)}
_srcs = [_f for _f in glob.glob("scripts/*.mjs") + glob.glob("scripts/*.py")
         if os.path.basename(_f) in _steps
         and os.path.basename(_f) != "check-build.py"]
# TWO DIRECTORIES UNDER assets-source ARE OUTPUTS, NOT SOURCES, and sweeping
# them in is the same bug this file already records one paragraph above for
# build-sheet.py: a thing that feeds no page gating every page's freshness.
# scripts/build-sticker.py and scripts/build-endscreen.py write ASSETS FOR THE
# OWNER -- a print sticker, a Shorts end screen -- and neither puts a byte into
# public/, so regenerating one cannot make a single page stale. Left in, running
# either builder reported all 1,504 pages as behind and the only way to clear it
# was a full rebuild that changed nothing. Caught on the end screen, 2 September
# 2026; the sticker had the same fault latent in it since the day before and
# would have fired on its first reprint.
# print-fonts IS THE THIRD ONE AND WAS MISSED WHEN THE OTHER TWO WENT IN.
# grep says it is read by exactly two files, build-sticker.py and
# build-endscreen.py, both of which are _ONE_OFF owner-asset builders that write
# nothing into public/. So nothing in the built tree derives from those four .ttf
# files, and leaving it in meant adding a font weight to the sticker would fire
# the identical false failure the other two were exempted for.
_OWNER_ASSETS = {"assets-source/stickers", "assets-source/endscreen",
                 "assets-source/print-fonts"}
_srcs += glob.glob("shared/*.mjs")
# THE SUBDIRECTORIES ARE WALKED, NOT STAT'ED, AND assets-source/js IS WHY.
# glob'ing assets-source/* yields DIRECTORIES, and a directory's mtime only moves
# when an entry is created, removed or renamed -- never when a file inside it is
# edited in place. So the whole of assets-source/js was being judged by a
# timestamp that an edit to app.js does not touch. Measured on the day this was
# written: the directory said 25 August while the newest file inside it said 1
# September, seven days newer, and that directory holds app.js, packplayer.js and
# games.js, which ship on every page of the site. An in-place edit to any of them
# advanced nothing here, so a genuinely stale tree would have reported clean.
# assets-source/shows had the same skew a day wide.
#
# This is the opposite failure from the one _OWNER_ASSETS fixes, and it is the
# worse one: that made a clean tree look stale, this made a stale tree look clean.
for _p in glob.glob("assets-source/*"):
    if _p in _OWNER_ASSETS:
        continue
    if os.path.isdir(_p):
        _srcs += [os.path.join(_r, _n) for _r, _, _ns in os.walk(_p) for _n in _ns]
    else:
        _srcs.append(_p)
_newest_src, _newest_src_t = None, 0
for _f in _srcs:
    _t = os.path.getmtime(_f)
    if _t > _newest_src_t:
        _newest_src, _newest_src_t = _f, _t

# Pages that build-all does not write cannot be stale relative to it. This set
# once exempted a palette comparison page, which was reporting the whole site
# as stale every time anything else was edited.
#
# THE SET IS EMPTY SINCE 16 AUGUST 2026 and the reason is better than the
# exemption was: that file stopped living under public/ at all. AN UNLINKED
# WORKING FILE IN THE DEPLOY ROOT IS A PUBLISHED PAGE. It was 135KB, nothing
# linked to it, and it was being served regardless, because pages.yml uploads
# public/ wholesale and only robots.txt kept it quiet. That is the rule worth
# keeping from this: not "move it to assets-source", but "public/ is the
# internet, so nothing lands there that is not part of the site".
#
# (The palette work itself, and the generators behind it, were deleted on
# 19 August 2026 once Trubbish Deep shipped.) Anything that genuinely is a page
# of the site should be built by build-all, so the right way to keep this check
# honest is to leave nothing in public/ that build-all does not write.
#
# THERE WAS AN EXEMPTION SET HERE AND IT IS GONE WITH THE FILES IT NAMED. Six,
# then seven, palette sample pages had to sit in the deploy root because the owner
# needed to open them ON HIS PHONE to pick a palette, and a phone cannot open a
# file off assets-source/ on a laptop. They were written by a gen- script that
# build-all deliberately never runs, so every builder edit reported all seven as
# stale and failed this check on a tree that was completely correct: 62 of 62
# builders ok, one problem, and the problem was seven throwaway files. The
# comment that stood here said "DELETE THIS SET WITH THE FILES", and the files
# went on 19 August 2026, so it has.
#
# If a page ever needs to live in public/ without being built again, prefer
# giving it a builder over reviving this set. An exemption is a promise that
# something is fine, and it goes on being made long after it stops being true.
_pages = glob.glob("public/**/*.html", recursive=True)
def _mtime_or_none(_f):
    try:
        return os.path.getmtime(_f)
    except FileNotFoundError:
        return None


# One stat per file rather than two, and a page that vanishes between the glob
# and the stat is skipped instead of ending the run in a stack trace. With
# several agents rebuilding this tree at once that stopped being hypothetical.
# Skipping is safe HERE because a page that is genuinely gone is caught twice
# further down, as a broken link and as a sitemap entry pointing at nothing;
# this check is only ever about mtimes.
_behind = [(_t, _f) for _t, _f in ((_mtime_or_none(_f), _f) for _f in _pages)
           if _t is not None and _t < _newest_src_t - 2]
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
    html = _read_page(f)
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
    html = _read_page(f)
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
        if re.search(r'name="robots"[^>]*noindex', _read_page(f)):
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
        _read_page(f), re.S):
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

# ---------------------------------------------------------------------------
# EVERY ASSET LINK IN THE BUILT TREE CARRIES A ?v=, AND IT MATCHES THE BYTES
# BEING SERVED.
#
# The cache-busting story has always had a hole in the middle of it and nothing
# looked at it. shared/chrome.mjs stamped ui.css and app.js and emitted
# fonts.css, packs.css and packplayer.js bare; scripts/stamp-assets.mjs swept
# public/ at the END of build-all.mjs and added the rest. That is airtight for a
# full build and open for every other kind. Run one builder by hand, which is
# the ordinary way to work on one page family, and every page it just wrote
# ships a bare /assets/fonts.css. A browser holding an older copy keeps using
# it, which is invisible for a font and is the exact failure the hits-grid bug
# was: markup shipped, rules not. The next full build repairs it silently, so
# the window opens and closes without ever being visible.
#
# chrome.mjs emits all five stamped now. THIS IS THE OTHER HALF, and it is the
# half that does not go stale: it does not care which file forgot, or whether a
# new builder writes its own head, or whether somebody hand-edits one of the
# three hand-maintained pages. It asks the only question that matters about the
# built tree, which is what a reader is actually served.
#
# IT CHECKS THE HASH, NOT JUST THE PRESENCE OF A ?v=. A stamp that does not
# match the file is worse than none: it looks correct in every review and pins
# a browser to a stale copy for as long as the wrong hash keeps being emitted.
# The value is stamp-assets.mjs's own: sha1 of the served bytes, first 8 hex.
import hashlib

_ASSET_RE = _re.compile(r'(?:href|src)="(/assets/[^"?]+\.(?:css|js))(\?v=([a-f0-9]+))?"')
_asset_hash: dict = {}


def _hash_of(rel):
    if rel not in _asset_hash:
        p = os.path.join(ROOT, "public", rel.lstrip("/"))
        try:
            with open(p, "rb") as fh:
                _asset_hash[rel] = hashlib.sha1(fh.read()).hexdigest()[:8]
        except OSError:
            _asset_hash[rel] = None
    return _asset_hash[rel]


_bare, _wrong, _missing_asset = [], [], []
for _f in pages:
    _html = _read_page(_f)
    for _m in _ASSET_RE.finditer(_html):
        _rel, _stamp = _m.group(1), _m.group(3)
        _want = _hash_of(_rel)
        if _want is None:
            _missing_asset.append((_f, _rel))
        elif _stamp is None:
            _bare.append((_f, _rel))
        elif _stamp != _want:
            _wrong.append((_f, _rel, _stamp, _want))


def _some(rows, n=3):
    return "; ".join(r[0] + " -> " + r[1] for r in rows[:n]) + (f" (+{len(rows) - n} more)" if len(rows) > n else "")


if _bare:
    fail.append(
        f"{len(_bare)} asset link(s) across the built tree carry no ?v= cache buster: "
        f"{_some(_bare)}. Run node scripts/stamp-assets.mjs (it runs LAST in "
        "build-all.mjs, so anything that regenerated a page afterwards undid it)."
    )
if _wrong:
    fail.append(
        f"{len(_wrong)} asset link(s) carry a ?v= that is NOT the sha1 of the file being "
        "served, which pins browsers to a stale copy: "
        + "; ".join(f"{r[0]} -> {r[1]}?v={r[2]} but the file hashes to {r[3]}" for r in _wrong[:3])
        + (f" (+{len(_wrong) - 3} more)" if len(_wrong) > 3 else "")
        + ". Re-run node scripts/stamp-assets.mjs."
    )
if _missing_asset:
    fail.append(
        f"{len(_missing_asset)} page(s) link an asset that is not in public/assets/: {_some(_missing_asset)}"
    )
if not (_bare or _wrong or _missing_asset):
    note(f"  every asset link stamped, {len([h for h in _asset_hash.values() if h])} distinct asset(s)")

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
        # A NON-ENGLISH `high` RENDITION IS EXEMPT, AND IT IS NOT A LOOPHOLE.
        # This check and avifPicture() shared one premise: swapping .webp for
        # .avif on a TCGdex url gives a file that exists. True of every English
        # card and of `low` in every language; FALSE of the 600px renditions of
        # the Japanese sets. Measured 2 September 2026 with curl against ja/M/M4:
        # low.avif 11 of 11 fine, high.webp 5 of 5 fine, high.avif 11 of 12 never
        # answer -- one patient request sat 60 seconds and returned 504, and the
        # retry hung again.
        #
        # A 404 would cost nothing: the <img> fires error and its onerror cleans
        # up. A HANG fires nothing. <picture> has already committed to the AVIF
        # source, so the reader gets an empty frame for a minute and then loses
        # the image when the 504 lands. Two hit cards on a rip page were blank
        # boxes exactly this way, and it was the owner who found them on the live
        # page, not this file.
        #
        # So avifPicture() declines these now, and this check has to agree or the
        # build fails on its own correct output. Six pages, all Japanese hit
        # cards. If TCGdex fixes the rendition, delete both exemptions together
        # and the bytes come back on their own.
        _intl_high = _re.compile(
            r"https://assets\.tcgdex\.net/(?!en/)[^\"'\s>]+/high\.webp"
        )
        _n = sum(
            1
            for m in _img_tag.finditer(_h)
            if _tcgdex_webp.search(m.group(0))
            and not _intl_high.search(m.group(0))
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
    "build-brand-logos.py",  # shop, vendor and creator logos, from assets-source
    "build-endscreen.py", # the Shorts end screen, an asset for the OWNER; nothing enters public/
    "build-favicon.py",   # icons, from logo-square.jpg
    "build-foot-banner.py",  # the footer Made in ROC banner, from a master outside the repo
    "build-logos.py",     # set logos
    "build-og.py",        # the site share card
    "build-packs.py",     # pack art, from assets-source
    "build-playlist-covers.py",  # playlist covers, from .cache + the set logos
    "build-show-logos.py",  # show organisers' logos and flyers, from assets-source/shows
    "build-sheet.py",     # the Excel workbook, not a web page
    "build-sticker.py",   # the giveaway sticker, a PRINT asset; writes nothing into public/
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
# The whole point of growing the dropdown is that the owner can record a pack from a
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
# video about ONE pack out of a box: The owner's own sheet says so. A video whose
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

# ---------------------------------------------------------------------------
# AND THEY HAVE TO SPELL EVERY PRODUCT THE SAME WAY TOO, WHICH THE BLOCK ABOVE
# DID NOT ASK.
#
# The set check exists because app.js and taxonomy.mjs draw one grid from two
# tables. LABELS.products is the SAME hand copy of the SAME file and had nothing
# watching it, and on 22 August 2026 it had drifted on four ids that are live in
# videos.json: japanese-pack, korean-pack and chinese-pack were missing the word
# "Booster", and knock-out was not listed at all, so it fell through labelOf()'s
# title-case fallback and rendered "Knock Out" against "Knock Out Collection".
#
# IT WAS HARMLESS ON THE DAY AND THAT IS THE ARGUMENT FOR THE CHECK, NOT AGAINST
# IT. Products only drew filter chips, so one wrong name sat on one rail with
# nothing beside it to disagree with. The moment a product name reaches a tile
# the same grid prints two names for one product, which is exactly what the set
# names did twice ("the product rail and the tiles under it disagreed" is
# already in CLAUDE.md, and build-proto.mjs's productLabel carries the note).
#
# THE COMPARISON IS `short or label`, NOT `label`. taxonomy.mjs gives ETB a
# short and app.js says "ETB", and build-proto.mjs's productLabel() picks the
# short for the tile caption precisely so the caption matches the chip. Compare
# against `label` here and this check would demand app.js say "Elite Trainer
# Box", breaking the agreement it exists to protect.
#
# ALL SIXTEEN ARE CHECKED, not just the thirteen that reach a tile. The set
# check compares only ripped ids because the Set dropdown offers 146 sets that
# legitimately fall to the fallback; PRODUCT_TYPES is a closed table of sixteen
# and app.js spells out every one of them on purpose, its own comment saying the
# unused ones are there so the fallback never prints "Spc" on a tile the day one
# is logged. That arrangement is the invariant, so the unused rungs are the ones
# most worth checking: nothing on the site would show a mistake in them.
_ptax = {}
try:
    _tsrc = open("shared/taxonomy.mjs", encoding="utf-8").read()
    _tblk = re.search(r"^export const PRODUCT_TYPES = \[(.*?)^\];", _tsrc, re.S | re.M).group(1)
    # Line comments out first. The prose in that table talks about labels and
    # ids in sentences, and a regex reading it as code would invent rungs.
    _tblk = "\n".join(_l for _l in _tblk.split("\n") if not _l.strip().startswith("//"))
    for _e in re.finditer(r'\bid:\s*"([^"]+)"(.*?)(?=\bid:\s*"|\Z)', _tblk, re.S):
        _pid, _body = _e.group(1), _e.group(2)
        _lab = re.search(r'\blabel:\s*"((?:[^"\\]|\\.)*)"', _body)
        _sho = re.search(r'\bshort:\s*"((?:[^"\\]|\\.)*)"', _body)
        if _lab:
            _ptax[_pid] = (_sho or _lab).group(1)
    if not _ptax:
        raise ValueError("PRODUCT_TYPES parsed to zero entries")
except Exception as _e:
    fail.append(f"could not read PRODUCT_TYPES out of shared/taxonomy.mjs ({_e}), so the "
                f"app.js product-name check below has no canonical names and would pass "
                f"by comparing nothing")

# READ INDEPENDENTLY OF THE SET BLOCK ABOVE. That block leaves app.js in `_src`
# and it would be a line shorter to reuse it, but `_src` is also build-sheet.py
# earlier in this file, so a failed read up there would silently hand this check
# the wrong file or a stale one. A verifier that inherits another check's input
# fails the same way the bugs in this file fail.
_plabels = {}
try:
    _asrc = open("public/assets/app.js", encoding="utf-8").read()
    _pobj = re.search(r"\bproducts:\s*\{(.*?)\n    \},", _asrc, re.S)
    _pbody = "\n".join(_l for _l in _pobj.group(1).split("\n") if not _l.strip().startswith("//"))
    # Keys are written BOTH ways in that object: bare where the id is a plain
    # word (upc, etb, tin) and quoted where it carries a hyphen. Reading only
    # the quoted form would have found 11 of 17 and called the rest missing.
    for _k, _v in re.findall(r'"?([A-Za-z][A-Za-z0-9-]*)"?:\s*"((?:[^"\\]|\\.)*)"', _pbody):
        _plabels[_k] = _v.replace('\\"', '"').replace("\\\\", "\\")
    if not _plabels:
        raise ValueError("LABELS.products parsed to zero entries")
except Exception as _e:
    fail.append(f"could not read LABELS.products out of public/assets/app.js ({_e}), so the "
                f"product-name check has nothing to compare and would pass empty. Check the "
                f"`products: {{` block is still there and still in that shape.")

if _ptax and _plabels:
    _pwrong = []
    _pcompared = 0
    for _p in sorted(_ptax):
        _pcompared += 1
        _pgot = _plabels.get(_p) or _title_case(_p)
        if _pgot != _ptax[_p]:
            _pwrong.append(f'{_p}: app.js renders "{_pgot}", taxonomy.mjs says "{_ptax[_p]}"')
    _riplive = sorted({_p for _v in _vids for _p in (_v.get("products") or [])})
    note(f"  {_pcompared} of {len(_ptax)} product names cross-checked against app.js, "
         f"{len(_riplive)} of them on a video")
    # Same guard as the set check, and the same reason: a run that compares
    # nothing looks exactly like a run that found nothing.
    if not _pcompared:
        fail.append(
            "the app.js product-name check compared 0 products, so it passed without "
            "looking at anything. PRODUCT_TYPES in shared/taxonomy.mjs parsed to entries "
            "with no id, which means that table changed shape."
        )
    # A product tag in the data that no table defines cannot be caught by the
    # loop above, because that loop walks the table rather than the data.
    _porphan = [_p for _p in _riplive if _p not in _ptax]
    if _porphan:
        fail.append(
            f"{len(_porphan)} product tag(s) in public/data/videos.json that "
            f"shared/taxonomy.mjs does not define, so nothing can name them and every tile "
            f"and chip carrying one falls to a title-cased slug: " + ", ".join(_porphan[:6])
            + ". Either add the id to PRODUCT_TYPES or fix the tag in data/manual.json."
        )
    if _pwrong:
        fail.append(
            f"{len(_pwrong)} product name(s) spelled differently by public/assets/app.js and "
            f"shared/taxonomy.mjs, so a filter chip and the tiles under it would caption one "
            f"product two ways: " + "; ".join(_pwrong[:6])
            + (f" and {len(_pwrong) - 6} more" if len(_pwrong) > 6 else "")
            + ". Fix the id in LABELS.products in public/assets/app.js; taxonomy.mjs is the "
              "source and build-proto.mjs uses `short` where a product has one."
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
# ---------------------------------------------------------------------------
# THE OWNER'S OWN ANSWERS MUST ACTUALLY REACH THE PAGES.
#
# data/overrides.json is where the sheet importer records what the owner typed while
# watching each video, and it ALWAYS wins over the title matcher. But it is not
# what the site reads: pages are built from public/data/videos.json, and a
# separate step (retag-videos.mjs --write, or a real sync) copies one into the
# other. import-sheet.mjs prints an instruction to run it and cannot enforce it.
#
# ON 19 AUGUST 2026 THAT STEP WAS SKIPPED AND NOTHING SAID SO. Two videos had
# their sets typed in, imported correctly, and sat in UNTAGGED.md under "missing
# the set" while the answer was on disk two files away. Both pages published
# noindex and stayed out of the sitemap. The import reported success, the build
# reported success, and check-build passed: every part was working and the chain
# between two of them was not connected.
#
# This is the cheapest possible check for it -- compare the two files -- and it
# is worth more than it looks, because the failure is invisible from every page
# and the cost is the one thing LAUNCH.md calls the biggest single lever on the
# site.
_ov = _read_json("data/overrides.json")
_vids = _read_json("public/data/videos.json")
if _ov and _vids:
    _by = {v.get("id"): v for v in _vids.get("videos", [])}
    _stale = []
    for _vid, _o in _ov.items():
        _v = _by.get(_vid)
        if not _v:
            continue
        for _field in ("sets", "products"):
            if _field not in _o:
                continue
            if list(_o[_field] or []) != list(_v.get(_field) or []):
                _stale.append(f"{_vid} {_field}: sheet says {_o[_field]}, the site shows {_v.get(_field)}")
    if _stale:
        fail.append(
            f"{len(_stale)} video(s) have tags in data/overrides.json that never reached "
            f"public/data/videos.json, so the owner's own answers are not on the pages. "
            f"Run `node scripts/retag-videos.mjs --write` then rebuild. "
            + "; ".join(_stale[:3])
            + (f"; and {len(_stale) - 3} more" if len(_stale) > 3 else "")
        )

# A NULL SET ID IS A LINK TO A PAGE THAT CANNOT EXIST.
#
# A promo pack legitimately has no set, and the pack tally records that as
# `set: null` so the pack still counts. That null belongs in the tally and
# never in a TAG array, where it becomes a set whose id is null. Caught once on
# the way into overrides.json and filtered there; checked here too, because the
# tally and the tags are written by different code and only one of them was
# fixed.
for _label, _doc in (("data/overrides.json", _ov), ("public/data/videos.json", _vids)):
    if not _doc:
        continue
    # overrides.json is keyed BY video id and carries no `id` field; videos.json
    # is a list and does. Naming the video is the point: a count with no id
    # sends the reader back to the file to work out which one.
    _rows = (
        _doc.items()
        if _label.endswith("overrides.json")
        else [(v.get("id", "?"), v) for v in _doc.get("videos", [])]
    )
    _bad = []
    for _vid, _r in _rows:
        if not isinstance(_r, dict):
            continue
        for _field in ("sets", "products"):
            if any(x is None or x == "" for x in (_r.get(_field) or [])):
                _bad.append(f"{_vid} {_field}")
    if _bad:
        fail.append(
            f"{_label} has {len(_bad)} empty or null tag(s): {', '.join(_bad[:4])}. "
            f"A null set id builds a link to a page that cannot exist."
        )

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
    _s = _read_page(_f)
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
# COMMENT SYNTAX AND TO-DO MARKERS THAT REACHED THE PAGE AS VISIBLE TEXT.
#
# Same shape as the NaN/undefined check above and found the same way: by reading
# a page rather than by reasoning about a builder. data/video-games.json had
# HTML comment delimiters typed INSIDE JSON string values -- somebody tried to
# comment out a field with <!-- --> in a format that has no comments -- so
# /video-games.html printed "1996<!--", "-->" and "Game Freak <!--" as release
# dates and a developer name, escaped and visible, on the 2027 Gen X row among
# others. The same file carried 13 "???" placeholders rendering as release
# dates, next to a real "N/A" convention that means something different.
#
# A JSON string cannot hold a comment. If a value needs to go, delete the key:
# regionLines() in build-video-games.mjs already skips an absent region, which
# is the correct rendering for "we do not know".
#
# "N/A" is deliberately NOT flagged: it asserts the game never came out in that
# region, which is information the page is right to print.
_marker = []
for _f in sorted(glob.glob("public/**/*.html", recursive=True)):
    _s = _read_page(_f)
    _t = _re.sub(r"(?s)<(script|style)\b.*?</\1>", " ", _s)
    _t = _re.sub(r"(?s)<!--.*?-->", " ", _t)          # real HTML comments are fine
    _t = _re.sub(r"(?s)<[^>]+>", " ", _t)
    for _m in _re.finditer(r"&lt;!--|--&gt;|\?\?\?", _t):
        _ctx = _re.sub(r"\s+", " ", _t[max(0, _m.start() - 45):_m.end() + 30]).strip()
        _marker.append(f"{_f}: {_m.group(0)!r} in visible text ... {_ctx[:95]}")
for _m in _marker[:6]:
    fail.append(_m)
if len(_marker) > 6:
    fail.append(f"...and {len(_marker) - 6} more comment/placeholder markers in visible text")


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
# never did anything. It went with the file, which left the deploy root in the
# same edit and was deleted outright once the palette it existed to compare had
# shipped. An exemption that never fires is indistinguishable from a rule that
# works, which is why it is worth saying so rather than quietly dropping it.
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
    _s = _read_page(_f)
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


# A DATE THE SITE SAYS IT READ SOMETHING ON CANNOT BE IN THE FUTURE.
#
# Thirty-eight scripts computed "today" as `new Date().toISOString().slice(0,10)`,
# which is UTC. West of Greenwich that is already tomorrow for the last hours of
# every evening, so a sync run after 8pm Eastern stamped TOMORROW onto the file
# it wrote. On 19 August 2026 data/first-partner.json carried
# `checked: 2026-08-20` and the guide published "PRICES READ AUGUST 20, 2026"
# the day before that date existed. On a site whose whole claim is that a number
# is traceable to a source AND A DATE, a date in the future is not a typo.
#
# Only the "when did we read this" fields are checked. Release dates, show dates
# and the drops window are all legitimately in the future and are not touched.
import datetime as _dt
_TODAY = _dt.date.today().isoformat()
# SIX NAMES FOR ONE CONCEPT, AND THE ALLOWLIST ONLY KNEW EIGHT OF THEM.
# Extended 24 August 2026, launch day, after an audit counted 291 read-dates in
# data/ that this guard could not see. The worst of them is `asOf`, which is
# what data/psa10.json stamps on EVERY PSA 10 row -- 154 of them -- and that
# file is rewritten nightly by sync-prices.mjs, which is the same after-dark
# shape as the incident this guard was built for. data/first-partner.json
# stamped `checked: 2026-08-20` on the 19th and the page published "PRICES READ
# AUGUST 20, 2026", a date that had not happened.
#
# THE REAL FIX IS ONE NAME, NOT NINE, and it is not being done today. A site
# whose central claim is a source plus a date should not spell the date field
# six ways. Renaming across 47 files on launch day is the wrong trade; adding
# the names is one line and gets nearly all of the value. If somebody does
# unify them later, this tuple is the list of what to unify.
_STAMPS = (
    "checked", "syncedAt", "compiled", "read", "readOn", "priceRead", "verified", "ran",
    # added 24 August 2026, counts are occurrences found in data/ that day
    "asOf",            # 154, every psa10.json row, plus tcg-live and tcg-pocket
    "readAt",          # 91, pack-counts-current.json and pack-counts-history.json
    "articleEdited",   # 29
    "articleCreated",  # 10
    "decided",         # 3
    "listingUpdated",  # 2
    "priceAsOf",       # 2
)
_future = []
for _p in sorted(glob.glob("data/*.json") + glob.glob("public/data/*.json")):
    _doc = _read_json(_p)
    if not isinstance(_doc, dict):
        continue
    for _k in _STAMPS:
        _v = _doc.get(_k)
        if isinstance(_v, str) and _re.match(r"^\d{4}-\d{2}-\d{2}$", _v) and _v > _TODAY:
            _future.append(f"{_p} {_k}={_v}")
    _src = _doc.get("source")
    if isinstance(_src, dict):
        _v = _src.get("read")
        if isinstance(_v, str) and _re.match(r"^\d{4}-\d{2}-\d{2}$", _v) and _v > _TODAY:
            _future.append(f"{_p} source.read={_v}")
if _future:
    fail.append(
        f"{len(_future)} file(s) claim to have been read in the future, so a page "
        f"publishes a date that has not happened: {', '.join(_future[:4])}. "
        f"The cause is `new Date().toISOString()` where local time was meant; "
        f"use localDay() from shared/today.mjs."
    )

# ---------------------------------------------------------------------------
# A HIT'S WRITTEN TIER MUST BE A TIER THAT CARD IS ACTUALLY PRINTED AT.
#
# THE FAULT THIS EXISTS FOR, and it is the class rather than the instance.
# data/hits.json carries two answers about one card and nothing compared them.
# The tier the owner TYPED is what /rarity.html files the card under and what
# /luck.html labels it; the tier of the printing build-pages.mjs and
# build-hall.mjs RESOLVE is what the rip page and the plaque print. Where the
# two disagree, four pages disagree with each other, every builder exits 0 and
# every other check here passes. The owner looked at his own pages for months
# and did not see it.
#
# THE ROW IT CATCHES TODAY IS THE MOST LOAD BEARING ROW IN THE SHEET. Row 4
# writes Mega Greninja ex as a Hyper Rare. Chaos Rising prints FOUR Mega
# Greninja ex -- #022 Double rare, #100 Ultra Rare, #116 Special illustration
# rare and #122 Mega Hyper Rare -- and NONE of them is a Hyper Rare. The set
# has exactly one Mega Hyper Rare card in it, this one, and zero Hyper Rares.
# It reached the right printing BY ACCIDENT: the resolver matched on the first
# eight normalised characters and "hyperrar" is a substring of
# "megahyperrare". So /hall.html #1, /about.html's "biggest pull" and 53 rip
# pages say Mega Hyper Rare while /rarity.html credits the channel's best card
# to the Hyper Rare row and leaves the Mega Hyper Rare row reading as though
# nobody has ever pulled one.
#
# WHY THE TEST IS "A TIER THIS CARD HAS" AND NOT "THE TIER IT RESOLVED TO".
# Comparing against whatever the resolver picked would pass any row the
# resolver got wrong, which is the accident above. The set's own checklist is
# the fact: if no printing of that name in that set carries the typed tier,
# the typed tier is wrong no matter what anything resolved to. It is also the
# check that survives the resolver being tightened, which it has been.
#
# ENGLISH CHECKLISTS ONLY, and that is a real limit rather than an oversight.
# public/data/cards/ holds the 28 English sets; the Japanese and Korean guides
# live in public/data/intl-guides.json and are DELIBERATELY not mapped onto the
# English ladder -- shared/rarity.mjs keeps the seven letter tiers separate and
# says why, and build-hall.mjs refuses to bend that rule to win a collector
# number. "Art Rare" against TCGdex's "Illustration rare" for the same Goldeen
# is two vocabularies, not a mistake, so an intl row would fail this check for
# being correct. A promo carries no set and has no checklist to be on.
#
# IT FAILS THE BUILD RATHER THAN WARNING. The run already printed a warning
# about a different row in this same cell and the wrong card shipped to a live
# page anyway; a line in a log is not a gate.
_hits_doc = _read_json("data/hits.json") if os.path.exists("data/hits.json") else None
_tier_bad = []
if isinstance(_hits_doc, dict):
    _norm_r = lambda x: _re.sub(r"[^a-z0-9]", "", str(x or "").lower())
    _set_cards = {}

    def _cards_for(_sid):
        if _sid not in _set_cards:
            _p = f"public/data/cards/{_sid}.json"
            _doc = _read_json(_p) if os.path.exists(_p) else None
            _set_cards[_sid] = (_doc or {}).get("cards") or None
        return _set_cards[_sid]

    for _vid, _list in sorted((_hits_doc.get("videos") or {}).items()):
        for _h in _list or []:
            _sid, _rar = _h.get("set"), _h.get("rarity")
            if not _sid or not _rar or _h.get("promo"):
                continue
            _cards = _cards_for(_sid)
            if not _cards:
                continue  # intl guide or unguided set; see above
            _same = [_c for _c in _cards if _norm_r(_c.get("name")) == _norm_r(_h.get("card"))]
            if not _same:
                continue  # a name no checklist holds is build-hall.mjs's report, not this one
            _tiers = sorted({str(_c.get("rarity") or "?") for _c in _same})
            if _norm_r(_rar) not in {_norm_r(_t) for _t in _tiers}:
                _tier_bad.append(
                    f'{_vid}: the log calls "{_h.get("card")}" a {_rar}, but {_sid} prints it '
                    f'only as {", ".join(_tiers)}'
                )
if _tier_bad:
    sheet_fail.append(
        f"{len(_tier_bad)} hit(s) carry a rarity tier the card is not printed at in the set "
        f"named beside it, so /rarity.html and /luck.html file the card under one tier while "
        f"/hall.html and the rip page print another: " + "; ".join(_tier_bad[:4])
        + (f" ...and {len(_tier_bad) - 4} more" if len(_tier_bad) > 4 else "")
        + ". Fix the Hit Info cell in the workbook and re-run scripts/import-sheet.mjs; "
          "do NOT edit data/hits.json, which that script rebuilds per video."
    )

# DEDUPE AGAIN, HERE, BECAUSE THE EARLIER ONE CANNOT SEE THE LAST THIRD OF THIS
# FILE. There is a `fail = list(dict.fromkeys(fail))` further up, added so that
# one file read by three checks reports its problem once. It sits at the point
# it was written and every check added after it slipped past: a page that could
# not be read was reported three times, once from before that line and twice
# from after. Deduping at the point of PRINTING is the version that cannot go
# stale as more checks are appended, so the count stays a count of problems
# rather than of complaints.
fail = list(dict.fromkeys(fail))

# TWO SEVERITIES, AND THE SECOND ONE EXISTS SO A TYPO CANNOT FREEZE THE NIGHTLY.
#
# `fail` is a broken BUILD: a page that did not generate, a lightbox that lost
# its source, a tag table that parsed to nothing. Nobody should publish over
# one, and the nightly must stop rather than commit it.
#
# `sheet_fail` is a wrong ANSWER in the hand-filled workbook. It is just as real
# and it is reported just as loudly, but it differs in the one way that matters
# to CI: no automated run can fix it, and the pages it produces are complete and
# publishable -- they simply say something the log got wrong.
#
# .github/workflows/refresh.yml runs check-build.py and stops the job on a
# non-zero exit, and its "Commit if anything changed" step comes AFTER. So with
# one severity, a single mistyped rarity in one spreadsheet cell would silently
# halt every nightly commit -- new uploads, prices, PSA figures, all of it --
# and pages.yml would not deploy either, because its workflow_run trigger
# requires conclusion == success. This site has already lost twelve days of
# publishing to a freeze nobody could see, and CLAUDE.md records it.
#
# So: exit 1 for a broken build, exit 2 for a workbook that needs a human, and
# the nightly tolerates 2 while still printing it. A wrong cell stays loud on
# every local build and in every CI log, and it stops nothing that can still run.
sheet_fail = list(dict.fromkeys(sheet_fail))

if sheet_fail:
    print(f"\n{len(sheet_fail)} workbook problem(s) -- the build is fine, the log is wrong:", file=sys.stderr)
    for f in sheet_fail:
        print("  " + f, file=sys.stderr)
    print("Fix the cell in Garbage-Rips-585-Video-Log.xlsx and re-run "
          "scripts/import-sheet.mjs.", file=sys.stderr)

if fail:
    print(f"\n{len(fail)} problem(s):", file=sys.stderr)
    for f in fail:
        print("  " + f, file=sys.stderr)
    print(f"{len(fail)} problem(s) found by scripts/check-build.py. "
          f"Run: python3 scripts/check-build.py", file=sys.stderr)
    sys.exit(1)
if sheet_fail:
    sys.exit(2)
print("\nall checks pass")

