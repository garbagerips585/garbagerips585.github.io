#!/usr/bin/env python3
"""Size the logos that shops, vendors and creators send us.

    python3 scripts/build-brand-logos.py [--force]

Masters go in assets-source/shop-logos/ or assets-source/creator-logos/, named
by the `logo` value in data/shops.json, data/vendors.json or data/creators.json
(lingster-games.jpg, toak-pulls.png). Renditions land in public/assets/shops/
and public/assets/creators/ at 200w and 400w, AVIF and WebP, which is exactly
what the <picture> in build-shops.mjs and build-locals.mjs asks for.

WHY THIS EXISTS AT ALL: the first two logos were sized by hand at the terminal
and the recipe lived only in a commit message. Two more arrived and the recipe
had to be reconstructed from the file names. It is written down now.

A LOGO GOES UP ONLY WHERE ITS OWNER SENT IT FOR THIS USE. This script sizes
what we already hold; it does not go and fetch one, and nothing here should
grow the ability to. `logoNote` in the data records who sent it and when.

NOT PART OF build-all. Same as build-logos.py and build-show-logos.py: image
bytes do not reproduce across machines, so re-encoding on every build is how a
two-line copy edit turns into a thousand drifted files. Run it when a logo
arrives, commit what it writes.

AND IT SKIPS WHAT IS ALREADY BUILT, for the same reason. Re-encoding
lingster-games with a newer Pillow would rewrite four committed files that
nobody asked to change. --force overrides, deliberately.

Needs Pillow: python3 -m pip install --user Pillow
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
# (masters, renditions) -- the two directories are the only difference between
# a shop logo and a creator logo. Vendors share the creators' output directory
# because build-locals.mjs builds both pages from one card template.
PAIRS = (
    (ROOT / "assets-source" / "shop-logos", ROOT / "public" / "assets" / "shops"),
    (ROOT / "assets-source" / "creator-logos", ROOT / "public" / "assets" / "creators"),
)
EXTS = (".png", ".jpg", ".jpeg", ".webp")

# The box is 56 CSS px in both templates, so 200 covers it to 3.5x and 400 to
# 7x. Kept at the widths the first two logos were cut to rather than retuned:
# changing them would orphan the srcset entries already in the builders.
WIDTHS = (200, 400)
# Matching build-show-logos.py, where the tradeoff was measured on art of this
# kind: AVIF only beats WebP below about q55 on dense illustration.
QUALITY = 50


def prepared(path: Path) -> Image.Image:
    """Load a master and trim the empty margin around the artwork.

    TRIMMING IS NOT RETOUCHING. A transparent border is nothing, and it is
    charged at full price in a 56px box: TOAK Pulls' master is 4500x5485 with
    616x661 of blank edge, which would have painted their mark 13% smaller
    than the box can hold, for nothing. Only fully transparent pixels go. An
    opaque master (LingSter's black plate, Elliot's JPEG) has no such border
    and comes through untouched, which is the correct answer for both.
    """
    img = Image.open(path).convert("RGBA")
    box = img.getchannel("A").getbbox()
    return img.crop(box) if box else img


def main() -> int:
    force = "--force" in sys.argv
    wrote = skipped = 0

    for src, out in PAIRS:
        if not src.is_dir():
            continue
        masters = sorted(p for p in src.iterdir()
                         if p.suffix.lower() in EXTS and not p.name.startswith("."))
        for m in masters:
            img = prepared(m)
            w, h = img.size
            todo = [(tw, ext, out / f"{m.stem}-{tw}.{ext}")
                    for tw in WIDTHS for ext in ("avif", "webp")]
            if not force and all(d.exists() for _, _, d in todo):
                skipped += 1
                continue

            out.mkdir(parents=True, exist_ok=True)
            print(f"{m.name}: {Image.open(m).size} master -> {w}x{h} trimmed")
            # The data needs the real aspect ratio: both templates compute the
            # img height from logoW/logoH, and a hardcoded square squashed
            # Elliot's 1024x856 the first time round.
            print(f'  "logoW": {w}, "logoH": {h}')

            for tw, ext, dest in todo:
                th = max(1, round(tw * h / w))
                # A plain resize, not a premultiplied one. The measurement
                # behind that is in build-show-logos.py: against ground truth
                # the plain resize is RMSE 1.29 and the premultiply round trip
                # 4.78, because un-premultiplying divides by a small alpha in
                # uint8 and loses more than the colour bleed costs.
                img.resize((tw, th), Image.LANCZOS).save(dest, quality=QUALITY)
                print(f"  {dest.relative_to(ROOT)}  {tw}x{th}  {dest.stat().st_size:,} bytes")
                wrote += 1

            # AVIF DOES NOT ALWAYS WIN AND A <picture> TAKES THE FIRST SOURCE
            # IT CAN DECODE, so a losing AVIF is not a harmless fallback, it is
            # a guaranteed regression on every browser that supports it. Same
            # guard build-show-logos.py and build-logos.py carry, and it has
            # already fired once on a small flyer.
            for tw in WIDTHS:
                avif, webp = out / f"{m.stem}-{tw}.avif", out / f"{m.stem}-{tw}.webp"
                if avif.exists() and webp.exists() and avif.stat().st_size >= webp.stat().st_size:
                    ab, wb = avif.stat().st_size, webp.stat().st_size
                    avif.unlink()
                    wrote -= 1
                    print(f"    dropped {avif.name}: {ab:,} bytes against the webp's "
                          f"{wb:,}, so this width is served as webp only")

    if skipped:
        print(f"{skipped} master(s) already built, left alone. --force to re-encode.")
    if not wrote and not skipped:
        print("No masters found. Drop one in assets-source/shop-logos/ or "
              "assets-source/creator-logos/.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
