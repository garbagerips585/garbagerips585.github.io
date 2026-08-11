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
    print(f"  {m.stem:<24} {im.size[0]}x{im.size[1]}  {dest.stat().st_size/1024:6.1f} KB   (from {m.stat().st_size/1024:.0f} KB)")

print(f"\nWrote {len(masters)} logo(s) to {OUT.relative_to(ROOT)}/")
