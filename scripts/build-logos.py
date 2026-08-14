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

SRC.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

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
    dest = OUT / f"{m.stem}-pokemon-tcg-set-logo.webp"
    im.save(dest, "WEBP", quality=QUALITY, method=6)
    w2, h2 = im.size
    small = im.resize((max(1, round(w2 * SMALL_H / h2)), SMALL_H), Image.LANCZOS) if h2 > SMALL_H else im
    sdest = OUT / f"{m.stem}-pokemon-tcg-set-logo{SMALL_SUFFIX}.webp"
    small.save(sdest, "WEBP", quality=QUALITY, method=6)
    print(f"  {m.stem:<24} {im.size[0]}x{im.size[1]}  {dest.stat().st_size/1024:6.1f} KB"
          f"   + {small.size[0]}x{small.size[1]} {sdest.stat().st_size/1024:5.1f} KB"
          f"   (from {m.stat().st_size/1024:.0f} KB)")

print(f"\nWrote {len(masters)} logo(s) to {OUT.relative_to(ROOT)}/")
