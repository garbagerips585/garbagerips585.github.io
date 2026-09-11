#!/usr/bin/env python3
"""The owner's own photographs of his 30th Celebration cards.

    python3 scripts/build-30th-cards.py

Reads assets-source/30th-cards/*.png and writes two widths in .webp and .avif
into public/assets/30th-cards/, plus data/30th-card-dims.json so the page can
declare real width and height and cause no layout shift.

WHY THE BINDER USES HIS PHOTOGRAPHS AND NOT CARD SCANS. It wants scans, and on
11 September 2026 there were none: TCGdex has no 2026 anniversary set, so the
source the other 59,758 card images on this site come from cannot answer, and
PokeBeach's English gallery is pictures with no card names attached. He got
three cards early and photographed them, and a photograph of the actual card in
his hand is the better picture for a page about HIS binder anyway.

AND IT SIDESTEPS THE ONE CLAUSE THAT MATTERS. TPCi's asset license grants
editorial use and then says "you may not modify, alter or create derivative
works of the Content". This pipeline resizes and re-encodes everything it
hosts, which is exactly that. His own photograph is his own work, so resizing it
is not a derivative of anybody's Content; the card design in the frame is
TPCi's and is being used editorially, which the same license allows. That is
the same footing the eleven Garbage Plate photographs stand on, minus the
attribution clause, because the photographer is the site owner.

WHEN TCGDEX GETS THE SET, THESE STAY. A photograph of the copy he actually owns
is a stronger statement on a master set page than a stock scan, and the two
render identically: build-30th.mjs prefers a `shot` on the card record and falls
back to the TCGdex url. Nothing has to be deleted.

NAMING IS <set code>-<number>-<card>.png, lowercase, read off the card itself:
the Energy is MEE 016 and the two Pokemon are 30C 099 and 30C 120. The set code
is part of the name because this set's Energy is numbered in a DIFFERENT set
from its Pokemon, which is the kind of thing a filename should not hide.
"""
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-source" / "30th-cards"
OUT = ROOT / "public" / "assets" / "30th-cards"
DIMS = ROOT / "data" / "30th-card-dims.json"

# TWO WIDTHS, AND THEY ARE TCGDEX'S TWO ON PURPOSE. build-30th.mjs offers the
# same 245w/600w ladder for a scan, so a photograph and a scan resolve through
# identical arithmetic and a pocket cannot pick a different rung depending on
# which kind of picture it holds. A pocket is ~104px at 375 and 163px at the
# grid's cap, so 245 covers DPR 1 and 2 and 600 covers DPR 3.
WIDTHS = [("", 600), ("-sm", 245)]
QUALITY = 82
AVIF_QUALITY = 62


def main() -> int:
    if os.environ.get("GR_SKIP_IMAGE_BUILDERS") == "1":
        print("GR_SKIP_IMAGE_BUILDERS=1, skipping 30th card photographs")
        return 0
    if not SRC.is_dir():
        print(f"no {SRC.relative_to(ROOT)}, nothing to do")
        return 0

    masters = sorted(
        p for p in SRC.iterdir()
        if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp") and not p.name.startswith(".")
    )
    if not masters:
        print(f"no masters in {SRC.relative_to(ROOT)}, nothing to do")
        return 0

    OUT.mkdir(parents=True, exist_ok=True)
    dims: dict[str, list[int]] = {}
    for m in masters:
        # EXIF ORIENTATION IS APPLIED. A phone photograph can be stored sideways
        # with an orientation tag, and resizing without this ships it rotated a
        # quarter turn with correct width and height attributes on it, which
        # nothing in the build can see. Same trap sync-plate-photos.py records.
        im = ImageOps.exif_transpose(Image.open(m)).convert("RGB")
        base = m.stem
        for suffix, w in WIDTHS:
            if im.width < w:
                # Never upscale: a 600w rendition of a 400px master is bigger
                # bytes for no more detail.
                continue
            h = round(im.height * w / im.width)
            r = im.resize((w, h), Image.LANCZOS)
            wp = OUT / f"{base}{suffix}.webp"
            av = OUT / f"{base}{suffix}.avif"
            r.save(wp, "WEBP", quality=QUALITY, method=6)
            r.save(av, "AVIF", quality=AVIF_QUALITY)
            if not suffix:
                dims[f"{base}.webp"] = [w, h]
            print(f"  {base}{suffix}  {w}x{h}  {wp.stat().st_size/1024:.1f}KB webp / "
                  f"{av.stat().st_size/1024:.1f}KB avif")

    # NEVER WRITE AN EMPTY MANIFEST OVER A GOOD ONE. This is sync-dex-art.mjs's
    # recorded fault: a script that rebuilds a manifest by measuring images
    # wrote an EMPTY one on a runner where the measuring failed, and still
    # exited 0, so a page rendered "no artwork held" and only --diff caught it.
    # Masters present but nothing measured means something is wrong upstream,
    # and the committed manifest is better than the truth being lost.
    if masters and not dims:
        print(f"REFUSING to write an empty {DIMS.name}: {len(masters)} master(s) "
              f"present and none produced a rendition. Keeping the committed one.",
              file=sys.stderr)
        return 1
    DIMS.write_text(json.dumps(dims, indent=2, sort_keys=True) + "\n")
    print(f"{len(masters)} card photograph(s) -> {OUT.relative_to(ROOT)}, dims -> {DIMS.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
