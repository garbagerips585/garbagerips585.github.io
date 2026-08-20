#!/usr/bin/env python3
"""Turn pack artwork masters into web-sized files plus the CSS that uses them.

    python3 scripts/build-packs.py

Drop masters in assets-source/packs/ named by set id (pitch-black.png,
chaos-rising.png, default.png ...). This writes optimised WebP AND AVIF to
public/assets/packs/ and generates public/assets/packs.css, which is what
actually swaps a set's gradient for its artwork. A set with no master keeps
its colour design, so this is safe to run with one file or twenty.

Every rendition is written in both formats and the pair is what makes the
<picture> in build-proto.mjs safe; see the note on AVIF_QUALITY below. packs.css
gets both too, as a plain url() followed by an image-set(), because a background
image cannot be a <picture> and the pack wrapper on every rip page is one.

Needs Pillow with AVIF support (11.x has it built in):
    python3 -m pip install --user Pillow
"""
import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-source" / "packs"
OUT = ROOT / "public" / "assets" / "packs"
CSS = ROOT / "public" / "assets" / "packs.css"

# 810x1440 covers both places the pack renders: the rip page player needs
# 760px across at 2x, tiles need 534. One file, no srcset gymnastics.
TARGET = (810, 1440)
# A tile is never wider than about 200 CSS px, so 400 covers it at 2x. The full
# size exists for one place only: the rip page player, which is ~380 CSS px and
# needs 760. Serving 810x1440 into a 197px tile was a 4x linear oversample and
# put 1.6 MB of pack art on the home page.
TILE = (400, 711)
# THE MIDDLE RENDITION, ADDED 16 AUGUST 2026, AND IT EXISTS FOR ONE MEASUREMENT.
# With only 400 and 810 to choose from, EVERY pack request on the home page took
# the 810 file at every width and every DPR: logged from the network with cache
# off, 5 packs at 1280, 1440 and 1920, none of them ever landing on the tile.
#
# The home page's carousel art measures 328px at 1280, 373 to 378 at 1440 and
# 391 to 408 at 1920, and the Hall of Fame frame 404 to 464. On a DPR 1 desktop
# every one of those boxes is over 400 and under 560, so 400w cannot satisfy it
# and 810w is the only thing left. 560 is the width that sits in that gap, and
# it wins at all three desktop widths WITHOUT anybody writing ui.css's
# 1000/1200/1400 slide-count breakpoints a second time into a `sizes` attribute
# in build-proto.mjs. See the "NO MEDIA QUERY IN HERE" note in heroTile.
#
# IT IS A DPR 1 FIX AND ONLY A DPR 1 FIX, which is the honest way to sell it. At
# DPR 2 a 402px box needs 804 device pixels and 810w is already the smallest
# candidate that satisfies it, so a retina laptop and every modern phone fetch
# exactly what they fetched before, byte for byte. That is also why it is safe:
# it cannot make the phone worse. Measured: 681.6KB of pack art on the home page
# becomes 375.5KB at DPR 1, and stays 681.6KB at DPR 2 and DPR 3.
#
# 700w WAS DELIBERATELY NOT ADDED. It was measured with the files generated and
# was picked in exactly one case, a DPR 2 phone, for 19 more files and 2MB.
MID = (560, 996)
QUALITY = 78
# EVERY RENDITION IS ALSO WRITTEN AS AVIF, ADDED 16 AUGUST 2026, AND IT IS THE
# ONLY LEVER HERE THAT PAYS AT EVERY DEVICE PIXEL RATIO. 560w fixed the DPR 1
# desktop and, by design, moved nothing at DPR 2 or 3: a 402px box at DPR 2 asks
# for 804 device pixels and 810w is already the smallest candidate that answers
# it, so a retina laptop and every modern phone fetched exactly what they always
# had. A smaller CODEC is orthogonal to that: it shrinks whichever candidate the
# browser picks, so it lands on the phone and on the MacBook as well as on the
# 1x desktop.
#
# THE QUALITY NUMBER IS NOT A TRADE HERE AND THAT WAS MEASURED RATHER THAN
# HOPED. AVIF q60 is SMALLER AND CLOSER TO THE SOURCE than WebP q78, against the
# same LANCZOS-resized master, PSNR over the opaque pixels only (the pack sits in
# a transparent margin, and scoring the empty corners inflates every figure):
#
#     paradox-rift 810w   webp q78 150.6KB 33.03 dB    avif q60 123.1KB 34.21 dB
#     default      810w   webp q78 129.6KB 33.41 dB    avif q60  96.9KB 34.46 dB
#
# So this is -18.2% and -25.3% for +1.2 and +1.1 dB. There is no sharpness cost
# to report because the AVIF is the LESS lossy of the two files. Do not read that
# as headroom to drop the number: q55 is another 13 points off and lands BELOW
# the WebP's fidelity, which is where the trade starts and where the pack art,
# which is the brand and is commissioned, stops being free to shrink.
#
# speed=4 rather than Pillow's default 6, for the same reason WebP gets method=6:
# this runs by hand when a master changes, so 29s of encoding buys 2.6% off every
# file for ever. At speed 6 the 810w paradox-rift is 126.4KB instead of 123.1KB.
#
# THE AVIF ALWAYS EXISTS BECAUSE THIS LOOP WRITES BOTH, which is what makes the
# <picture> safe: a <source> pointing at a 404 is worse than no source, since the
# browser has already committed to it by the time it fails. avifPicture() in
# shared/format.mjs only rewrites the extension, so the guarantee has to live
# here. If you ever add a fourth rendition, write both files or write neither.
AVIF_QUALITY = 60
AVIF_SPEED = 4
BACKDROP = "#161D26"  # shows through the transparent margin around the pack

SRC.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

masters = sorted(
    p for p in SRC.iterdir()
    if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp") and not p.name.startswith(".")
)

if not masters:
    print(f"No masters found in {SRC.relative_to(ROOT)}/")
    print("Drop 1080x1920 artwork named by set id, e.g. pitch-black.png")
    raise SystemExit(0)

rules = [
    "/* Generated by scripts/build-packs.py. Do not edit by hand. */",
    "/* A set listed here shows its artwork; every other set keeps the",
    "   colour design in site.css. */",
    "",
]
def render(im, box, dest):
    """One rendition, written as BOTH formats. Returns (size, webp KB, avif KB).

    The pair is written together on purpose: the <picture> in build-proto.mjs
    names the AVIF in a <source> and the WebP on the <img>, and a source whose
    file is missing paints a broken image rather than falling back.
    """
    r = im.copy()
    r.thumbnail(box, Image.LANCZOS)
    r.save(dest, "WEBP", quality=QUALITY, method=6)
    avif = dest.with_suffix(".avif")
    r.save(avif, "AVIF", quality=AVIF_QUALITY, speed=AVIF_SPEED)
    return r.size, dest.stat().st_size / 1024, avif.stat().st_size / 1024


done = []
for m in masters:
    set_id = m.stem
    im = Image.open(m)
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    stem = OUT / f"{set_id}-garbage-rips-585-booster-pack"
    size, kb, akb = render(im, TARGET, stem.with_suffix(".webp"))
    tsize, tkb, atkb = render(im, TILE, Path(f"{stem}-tile.webp"))
    msize, mkb, amkb = render(im, MID, Path(f"{stem}-mid.webp"))
    done.append((set_id, size, kb, akb, m.stat().st_size / 1024,
                 tsize, tkb, atkb, msize, mkb, amkb))

    sel = f".pack--{set_id}"
    base = f"packs/{set_id}-garbage-rips-585-booster-pack"
    rules += [
        f"{sel} .pack-art{{",
        f"  background-color:{BACKDROP};",
        f"  background-image:url('{base}.webp');",
        # THE SECOND background-image IS NOT A DUPLICATE AND THE PLAIN url()
        # ABOVE IT IS THE FALLBACK. A background cannot be a <picture>, so the
        # rip page's pack wrapper and the facade playInTile builds were still
        # fetching WebP after the <img> tags moved to AVIF. On the home page that
        # turned a CACHE HIT INTO A DOWNLOAD: the tile fetched
        # pitch-black-...pack.avif, then clicking it mounted a facade whose
        # background asked for pitch-black-...pack.webp, 124KB that used to be
        # free. Logged from the network with the cache ON, before and after the
        # click, which is the only way that shows up at all.
        #
        # image-set() with type() lands in Chrome 113, Safari 17 and Firefox 118.
        # Older browsers cannot parse the value, drop THIS declaration only, and
        # keep the url() above, which is the whole reason the two are written as
        # separate declarations rather than one. Getting that backwards would
        # leave the pack a flat #161D26 rectangle on those browsers, because
        # `.pack-art::before` and `.pack-brand` are switched off just below.
        f"  background-image:image-set(url('{base}.avif') type('image/avif'),"
        f"url('{base}.webp') type('image/webp'));",
        "  background-size:cover;",
        "  background-position:center;",
        "}",
        # The artwork carries its own wordmark and mascot, so the generated
        # ones would sit on top of it.
        f"{sel} .pack-art::before,{sel} .pack-art::after{{content:none}}",
        f"{sel} .pack-brand,{sel} .pack-mascot{{display:none}}",
        # A tile is never wider than about 200 CSS px. Pointing it at the 810px
        # file was a 4x oversample, and the library draws 48 of them at once.
        f"{sel}.pack--tile .pack-art{{",
        f"  background-image:url('{base}-tile.webp');",
        f"  background-image:image-set(url('{base}-tile.avif') type('image/avif'),"
        f"url('{base}-tile.webp') type('image/webp'));",
        "}",
        # AND OFF AGAIN WHERE THE TILE CARRIES ITS ARTWORK AS AN <img>.
        #
        # A CSS background can never be lazy: Chrome fetches one for any element
        # in the render tree, scrolled to or not. Measured 20 August 2026 with
        # NO scroll and the network left to go quiet, cache off, /videos.html
        # pulled all seven of its distinct tile files, 279.7KB, with four of its
        # 48 tiles above the fold at 390x844. So the server-rendered tiles put a
        # <picture> inside .pack-art and add .pack--img, and this rule takes the
        # background away from exactly those.
        #
        # THE THIRD CLASS IS WHAT MAKES IT SAFE RATHER THAN A SPECIFICITY BET.
        # At (0,4,0) it beats the tile rule directly above it at (0,3,0) and the
        # per-set rule further up at (0,2,0), whatever order a stylesheet ends up
        # in. And it is opt IN: a tile with no .pack--img keeps its background,
        # which is what the facade app.js builds in the browser relies on, so
        # that file did not have to change and cannot drift from this one.
        f"{sel}.pack--tile.pack--img .pack-art{{background-image:none}}",
        "",
    ]

# The Hall of Fame recolours every pack gold, which artwork would override.
#
# SCOPED TO THE HALL PAGE'S OWN CONTAINER, NOT TO ".hall".
# This was written as `.hall .pack ...` when the Hall of Fame page's wrapper was
# called .hall. build-hall.mjs now emits .chofpage, so the only markup left
# carrying a `hall` class is <main class="rip tight hall"> on the two rip pages
# whose video is flagged `greatest` in build-pages.mjs. That meant these three
# rules hit nothing they were written for and exactly two things they were not:
# at (0,3,0) they outrank `.pack--<set> .pack-art` at (0,2,0), so both of those
# rip pages threw away the commissioned pack photo, fell back to the generic
# gradient, and switched the "GARBAGE RIPS 585" text overlay back on. Silent,
# because a losing background-image is not an error, and invisible from the
# generator, which cannot see what class the page builders emit.
#
# Keep the selector pointing at the Hall of Fame page itself. hall.html renders
# no packs today, so these are inert; they cost nothing and they are the guard
# that has to exist the moment it does render one.
rules += [
    "/* Hall of Fame stays gold even for sets that have artwork. The gold is",
    "   painted with gradients, so simply clearing background-image blanked",
    "   these to a flat dark rectangle. Restore the gradients explicitly.",
    "   Scoped to .chofpage, the Hall of Fame page's own wrapper. It used to say",
    "   .hall, which no longer matches that page and DID match the two rip pages",
    "   for a `greatest` video, blanking their pack artwork. */",
    ".chofpage .pack .pack-art{",
    "  background-color:transparent;",
    "  background-image:",
    "    radial-gradient(120% 70% at 50% 12%,rgba(255,255,255,.22),transparent 60%),",
    "    linear-gradient(160deg,var(--pk-a) 0%,var(--pk-b) 38%,var(--pk-c) 72%,var(--pk-d) 100%);",
    "}",
    ".chofpage .pack .pack-art::before{content:\"\"}",
    ".chofpage .pack .pack-brand{display:block}",
    "",
]

CSS.write_text("\n".join(rules))

print(f"Wrote {len(done)} pack set(s), three renditions each in WebP and AVIF, "
      f"to {OUT.relative_to(ROOT)}/")
print(f"  {'set':<24} {'810w webp / avif':>22}  {'560w webp / avif':>22}  {'400w webp / avif':>22}")
_w = _a = 0.0
for set_id, size, kb, akb, src_kb, tsize, tkb, atkb, msize, mkb, amkb in done:
    _w += kb + mkb + tkb
    _a += akb + amkb + atkb
    print(f"  {set_id:<24} {kb:8.1f} /{akb:7.1f} KB  {mkb:8.1f} /{amkb:7.1f} KB  "
          f"{tkb:8.1f} /{atkb:7.1f} KB  (from {src_kb:.0f} KB)")
print(f"  {'TOTAL ON DISK':<24} {_w:8.1f} KB webp, {_a:.1f} KB avif "
      f"({100 * (_a - _w) / _w:+.1f}% per rendition, and the browser fetches ONE of them)")
print(f"\nWrote {CSS.relative_to(ROOT)}")

# ---------------------------------------------------------------- packshots
# Photos of the REAL retail booster packs, for the set pages. These have to be
# pictures you took yourself of packs you own: official product photography is
# not ours to copy. Any set without one just hides that panel.
SHOT_SRC = ROOT / "assets-source" / "packshots"
SHOT_OUT = ROOT / "public" / "assets" / "packshots"
SHOT_SRC.mkdir(parents=True, exist_ok=True)
SHOT_OUT.mkdir(parents=True, exist_ok=True)

shots = sorted(
    p for p in SHOT_SRC.iterdir()
    if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp") and not p.name.startswith(".")
)
if shots:
    print()
    for m in shots:
        im = Image.open(m)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA")
        im.thumbnail((720, 1080), Image.LANCZOS)
        dest = SHOT_OUT / f"{m.stem}-booster-pack.webp"
        im.save(dest, "WEBP", quality=80, method=6)
        print(f"  packshot {m.stem:<22} {im.size[0]}x{im.size[1]}  {dest.stat().st_size/1024:6.1f} KB")
    print(f"\nWrote {len(shots)} packshot(s) to {SHOT_OUT.relative_to(ROOT)}/")
else:
    print(f"\nNo packshots in {SHOT_SRC.relative_to(ROOT)}/ yet.")
    print("Drop photos of real booster packs named by set id (pitch-black.jpg).")
