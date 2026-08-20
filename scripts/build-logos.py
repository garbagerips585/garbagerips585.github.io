#!/usr/bin/env python3
"""Optimise set logos for the web.

    python3 scripts/build-logos.py

Drop masters in assets-source/logos/ named by set id (pitch-black.png,
chaos-rising.png ...). Writes transparent WebP to public/assets/logos/.

Logos are wide and vary a lot in aspect ratio, so they are normalised by
HEIGHT and left to size themselves horizontally. Nothing references a manifest:
the site tries to load a logo per set and quietly falls back to a text chip
when there is not one, so adding a set is just dropping a file in here.

Needs Pillow: python3 -m pip install --user Pillow
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-source" / "logos"
OUT = ROOT / "public" / "assets" / "logos"

# Rendered at up to ~150 CSS px tall, so 300 covers 2x screens.
TARGET_H = 300
QUALITY = 82

# AND A SECOND, SMALL ONE, because /sets/ paints 23 of these into a 110x42 box.
#
# `.set-card img` is `height:42px; max-width:110px`, measured at 110px wide at
# every viewport from 360 to 1920. The 300px-tall master is 480 to 1489px wide
# and 19 to 69KB each, so the set index transferred 937KB of logo at 1440x900 to
# fill boxes 110 CSS px across: between 7x and 13.5x oversized in each direction,
# the worst ratio measured anywhere on the site.
#
# This one IS a resample rather than an srcset alone, because there was no
# smaller file to point an srcset at, and because 300px tall is larger than
# EVERY use on the site: the biggest is `.logo-big` on a set page at 110px tall
# and `.rip-setlogo` at 54px, so nothing renders the master at its own size.
# 100px tall covers the 42px box at 2.4x and the 110px `.logo-big` at 1x, and
# the srcset in build-set-pages.mjs still offers the 300 for anything denser.
SMALL_H = 100
SMALL_SUFFIX = "-sm"

# AND A THIRD, IN THE MIDDLE, BECAUSE THE TWO ABOVE STRADDLE THE ONE BOX THAT IS
# ABOVE THE FOLD. `.logo-big` on a set guide is `height:clamp(56px,17vw,110px)`,
# which is 66.3 CSS px tall on a 390 phone, so a DPR 2 screen wants 133px of
# logo. -sm is 100 and the master is 300: the browser correctly takes the
# master and paints 1092x300 into a 483x133 box, 2.26x oversized in each
# direction. Measured over CDP at 390x844 DPR 2 on 19 August 2026, it was the
# LARGEST SINGLE RESOURCE on the whole set-guide template at 51.2KB of a 332KB
# load, and the only oversized thing on that page above the fold.
#
# 150 is not a taste pick: it is the smallest height that covers 133 with
# nothing to spare, and it doubles as the DPR 1 desktop candidate (110 CSS px).
# Same move, and the same reasoning, as the 560w pack rendition in
# build-packs.py, which was added because 400 and 810 straddled the real box.
MID_H = 150
MID_SUFFIX = "-md"

# EVERY RENDITION IS WRITTEN TWICE, .webp AND .avif, exactly as build-packs.py
# already does for the pack art. AVIF is 23-39% smaller than WebP for these
# files (measured over all 28 logos, worst 23%, best 39%), and a codec shrinks
# whichever candidate the browser had already chosen, so unlike a width it pays
# at every DPR. The <picture> in build-set-pages.mjs puts the AVIF in front and
# leaves the WebP underneath as the fallback, so a browser without AVIF loses
# nothing.
#
# **AVIF DOES NOT ALWAYS WIN HERE AND THAT WAS MEASURED RATHER THAN ASSUMED.**
# CLAUDE.md's "35% smaller than webp" is true of the pack art, which is 810px of
# painted illustration. A set logo at 100px tall is 5 to 17KB, and at that size
# AVIF's container overhead eats the coding gain: 151-sm goes 5.1KB to 6.9KB,
# destined-rivals-sm 9.4 to 10.4, obsidian-flames-sm 8.6 to 9.9, white-flare-sm
# 8.0 to 9.5. Eleven of the 84 renditions come out BIGGER as AVIF.
#
# A <picture> always takes the first source it can decode, so shipping a losing
# AVIF is not a neutral fallback, it is a guaranteed regression on exactly the
# pages that paint the small logos: /sets/index.html and all 317 rip pages.
#
# So an AVIF is written ONLY when it is smaller than the WebP beside it, and a
# stale one is deleted when it stops winning. The emitters read the directory
# rather than a manifest and only wrap an <img> in a <picture> when EVERY
# candidate in its srcset has an AVIF, which is the check that keeps a <source>
# from ever pointing at a file that is not there.
AVIF_QUALITY = 60

# THIS SCRIPT WRITES data/logo-dims.json ITSELF NOW, and that fixed five set
# guides rather than tidying anything. The manifest is what gives every logo its
# width/height attributes (so the box is reserved and the section does not
# reflow) and its per-logo `sizes` (so the browser can pick a rendition at all).
# It was maintained by a separate scripts/measure-logos.py, which THREE comments
# in this repo tell you to run and which IS NOT IN THE TREE. So it had gone
# stale in the only direction it could: 23 entries against 28 logos on disk, and
# celebrations, chilling-reign, crown-zenith, rebel-clash and shining-fates
# silently fell back to "no srcset, no dimensions, always the master".
#
# This script already opens every master and already knows the exact post-crop,
# post-resize size, so measuring here is a lookup rather than a second pass over
# the same files, and it cannot drift from what was actually written.
DIMS = ROOT / "data" / "logo-dims.json"

SRC.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
dims = {}

masters = sorted(
    p for p in SRC.iterdir()
    if p.suffix.lower() in (".png", ".webp") and not p.name.startswith(".")
)
if not masters:
    print(f"No logos in {SRC.relative_to(ROOT)}/ — drop files named by set id.")
    raise SystemExit(0)

for m in masters:
    im = Image.open(m)
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    # Trim the transparent margin so every logo optically fills its box.
    bbox = im.getchannel("A").getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    if h > TARGET_H:
        im = im.resize((round(w * TARGET_H / h), TARGET_H), Image.LANCZOS)
    # Descriptive filename: image search reads these, and "pitch-black.webp"
    # says nothing on its own. The suffix is fixed so the site can build the
    # URL from a set id without a manifest.
    base = f"{m.stem}-pokemon-tcg-set-logo"
    w2, h2 = im.size

    def scaled(target_h):
        """The logo at target_h, or the image itself when it is already smaller.

        Never UPSCALE: a handful of masters (celebrations, paradox-rift,
        white-flare) are under 300 tall already, and blowing one up to fill a
        rendition slot spends bytes on invented pixels. Returning the original
        means the srcset simply offers the same file twice at the same width,
        which the browser de-duplicates by url.
        """
        if h2 <= target_h:
            return im
        return im.resize((max(1, round(w2 * target_h / h2)), target_h), Image.LANCZOS)

    written = []
    for suffix, img in ((("", im)), (MID_SUFFIX, scaled(MID_H)), (SMALL_SUFFIX, scaled(SMALL_H))):
        wp = OUT / f"{base}{suffix}.webp"
        av = OUT / f"{base}{suffix}.avif"
        # A rendition that came back the same size as the master is a master
        # that was already shorter than this step. Writing it again under a
        # second name ships the same bytes twice and offers the browser two
        # candidates at one width; skip it and let the emitter read the
        # directory to see which renditions this logo actually has.
        if suffix and img.size == im.size:
            wp.unlink(missing_ok=True)
            av.unlink(missing_ok=True)
            written.append((suffix or "-lg", img.size, None, None))
            continue
        img.save(wp, "WEBP", quality=QUALITY, method=6)
        img.save(av, "AVIF", quality=AVIF_QUALITY)
        wb, ab = wp.stat().st_size, av.stat().st_size
        if ab >= wb:
            av.unlink()  # see the note on AVIF_QUALITY: a losing AVIF is a regression, not a fallback
            ab = None
        written.append((suffix or "-lg", img.size, wb, ab))

    parts = "  ".join(
        f"{s}:skipped" if wb is None else
        f"{s}:{sz[0]}x{sz[1]} {wb/1024:.1f}KB" + (f"/{ab/1024:.1f}av" if ab else "/webp-wins")
        for s, sz, wb, ab in written
    )
    dims[f"{base}.webp"] = [im.size[0], im.size[1]]
    print(f"  {m.stem:<24} {parts}")

# Sorted, and with the same 2-space indent the file already had, so a re-run
# with nothing changed produces a byte-identical file and shows up as no diff.
DIMS.write_text(json.dumps(dict(sorted(dims.items())), indent=2) + "\n")
print(f"\nWrote {DIMS.relative_to(ROOT)} ({len(dims)} logos)")
print(f"Wrote {len(masters)} logo(s) x 3 heights x 2 formats to {OUT.relative_to(ROOT)}/")
print("webp/avif shown per rendition. Dimensions are written above; there is no")
print("separate measure step to remember any more.")
