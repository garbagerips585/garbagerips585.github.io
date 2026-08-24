#!/usr/bin/env python3
"""The footer's Made in ROC artwork, resized.

WHY THIS IS A BANNER AND NOT A BADGE. The file it replaces was 256x218 and was
DRAWN AT 88px: a small round stamp with no type in it worth reading. The owner's new
artwork is 2752x1536, 1.792:1, and carries two lines of lettering -- GARBAGE
RIPS 585 round the top and MADE IN ROC across the manhole cover. At 88px wide
that whole scene is 49px tall and both lines are gone, so swapping the file into
the old box would have thrown away the only part of the picture that changed.
It is a banner now, full width of the footer column and capped at 420px, where
MADE IN ROC draws about 18px tall.

THE LADDER STOPS AT 840 AND A DPR 3 PHONE IS DELIBERATELY SERVED 2x, NOT 3x.
420 / 840 / 1260 would be the exact ladder and 1260 costs about 230KB against
840's 120KB, on an ornament that sits in the FOOTER OF ALL 1,489 PAGES. That is
the trade /topps-card-values.html already took and wrote down: an 11% short pick
rather than a megabyte on a phone. Here it is 33% short of DPR 3 and still two
device pixels per CSS pixel, on decorative brand art below the fold, and it is
stated rather than discovered. The picture it replaced was 19KB.

WIDTH, WEIGHT AND LEGIBILITY WERE MEASURED TOGETHER BEFORE THE CAP WAS PICKED,
AVIF q60: 360w 28.0KB and MADE IN ROC about 15px, 420w 36.9KB and 18px, 480w
46.0KB and 20px, 560w 59.5KB and 23px. 420 is where the lettering is plainly
readable and the file has not yet doubled.

AVIF q60 and WebP q78, the pair sync-plate-photos.py settled on, LANCZOS down.
Run by hand; not in build-all.mjs, because the master is not in the repo.
"""
import sys
from pathlib import Path
from PIL import Image, ImageOps

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "").expanduser()
OUT = Path(__file__).resolve().parent.parent / "public" / "assets"
STEM = "made-in-roc"
WIDTHS = (420, 840)

im = ImageOps.exif_transpose(Image.open(SRC)).convert("RGB")
print(f"  master {im.size[0]}x{im.size[1]}  ratio {im.size[0]/im.size[1]:.3f}")
for w in WIDTHS:
    h = round(w * im.size[1] / im.size[0])
    r = im.resize((w, h), Image.LANCZOS)
    for ext, kw in (("avif", dict(quality=60)), ("webp", dict(quality=78, method=6))):
        p = OUT / f"{STEM}-{w}.{ext}"
        r.save(p, **kw)
        print(f"    {p.name:<24} {w}x{h}  {p.stat().st_size:>7,} bytes")
# The <img> fallback, for anything that decodes neither of the two above.
p = OUT / f"{STEM}.jpg"
im.resize((WIDTHS[0], round(WIDTHS[0] * im.size[1] / im.size[0])), Image.LANCZOS).save(
    p, quality=82, optimize=True, progressive=True)
print(f"    {p.name:<24} {WIDTHS[0]}px  {p.stat().st_size:>7,} bytes")
