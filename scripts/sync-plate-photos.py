#!/usr/bin/env python3
"""Mirror the freely-licensed Garbage Plate photographs and re-encode them.

    python3 scripts/sync-plate-photos.py            fetch anything not held yet
    python3 scripts/sync-plate-photos.py --force    refetch and re-encode all

WHY THIS EXISTS, AND WHAT IT REPLACES. /garbage-plate.html shipped on 20 August
2026 with zero photographs, and data/garbage-plate.json argued the case: "This
site has no licence for a photograph of a building or of a plate of food." That
sentence was true about the CANDIDATES that had been looked at, which were a
restaurant's own site, a food blog and Street View, and false as a general claim
about the subject. Wikimedia Commons holds eleven photographs of this dish and
of the restaurant it comes from, and ten of them are CC BY, CC BY-SA or public
domain. The gap was a search, not a licence.

THE RULE THIS SCRIPT ENFORCES, and it is the only reason it is a script rather
than a folder of files somebody dropped in. A photograph goes on the page only
if its own Commons file page states a free licence, and that statement is
RE-READ FROM COMMONS ON EVERY RUN and compared against what data/garbage-plate
.json records. A file whose licence has changed, whose author has changed or
that has been deleted is a hard failure: it stops the run and names the file.
The failure mode this is guarding against is silent and expensive. A licence
tag on Commons can be corrected years later when somebody notices the uploader
did not own the photograph, and nothing about the file we already hold on disk
would change. Re-reading is cheap; publishing somebody's photograph without
their licence is not.

Same discipline sync-brands.mjs keeps for the retailer marks, and the same
arrangement: NOT in build-all.mjs, because it makes network requests and a
scheduled build must not depend on a step that is not scheduled. The encoded
output under public/assets/plates/ is committed, so the site builds and deploys
without it.

MASTERS ARE NOT COMMITTED. The ten originals are 15.5MB of JPEG and they
cache under .cache/plate-photos/, which is gitignored, exactly as the brand
downloads do. What ships is the renditions.

EXIF ORIENTATION IS APPLIED AND THAT IS NOT A DETAIL. "Garbage Plates, Nick
Tahou Hots 2025.jpg" is stored 4080x3060 with an orientation tag of 6, so the
API reports it as 3060x4080 and Pillow opens it on its side. Resizing without
ImageOps.exif_transpose ships a photograph rotated a quarter turn, with correct
width and height attributes on it, and nothing in the build can see it. One of
the eleven had this and it was found by comparing Pillow's size against the
API's rather than by looking at the picture.

NOTHING IS CROPPED, AND THAT IS A LICENCE DECISION RATHER THAN A TASTE ONE.
Four of these are CC BY-SA, which asks that an ADAPTED work be released under
the same licence. Resizing and re-encoding for delivery is not an adaptation:
CC 4.0 says so in as many words, and the 2.0 and 3.0 licences grant "the right
to make such modifications as are technically necessary to exercise the rights
in other media and formats". Cropping is a different act. So every rendition
here is the whole frame at a smaller size, and where the page needs a square or
a 4:3 shape it gets it with object-fit in CSS, which is how the picture is
DISPLAYED and not what is distributed.

THE ENCODING FOLLOWS build-packs.py BECAUSE THE SITE ALREADY MEASURED IT.
WebP q78 and AVIF q60 written as a pair for every rendition, LANCZOS down, and
the pair is what makes <picture> safe: a <source> pointing at a file that is not
there paints a broken image, because the browser has committed to it before it
finds out. avifPicture() in shared/format.mjs only swaps the extension, so the
guarantee has to live here. If you add a fourth width, write both formats.
"""
import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "garbage-plate.json"
CACHE = ROOT / ".cache" / "plate-photos"
OUT = ROOT / "public" / "assets" / "plates"

# THE CONTACT URL FOLLOWS THE FLIP, read out of shared/site.mjs rather than
# duplicated here. A hardcoded host means that the day LIVE goes true this
# script keeps introducing itself with an address the site no longer serves.
def _site_url() -> str:
    src = (ROOT / "shared" / "site.mjs").read_text()
    live = re.search(r"export const LIVE\s*=\s*(true|false)", src)
    dom = re.search(r'export const DOMAIN\s*=\s*"([^"]+)"', src)
    stg = re.search(r'export const STAGING\s*=\s*"([^"]+)"', src)
    if not (live and dom and stg):
        raise SystemExit("shared/site.mjs no longer exposes LIVE/DOMAIN/STAGING")
    return dom.group(1) if live.group(1) == "true" else stg.group(1)


UA = f"garbagerips585-plate-photos/1.0 ({_site_url()}/; tim.patenaude@gmail.com)"
API = "https://commons.wikimedia.org/w/api.php"

# THE THREE WIDTHS, AND WHY THEY ARE THESE THREE. The widest box any of these
# photographs is drawn into is the hero, capped at 720 CSS px, so a DPR 2
# desktop asks for 1440 and takes the 1200 file, the largest there is. The
# restaurant card frame is 400 to 408 CSS px at 1440 and 326 at 390, so 800
# covers both at DPR 2 and 400 covers the phone at DPR 1. There is no fourth
# width because there is no box between them: the history photograph and the
# anatomy pair both land inside the card frame's range.
#
# A RENDITION WIDER THAN THE MASTER IS NOT WRITTEN. Two of these files are
# 1024px originals from 2007 and 2008 and upscaling them would ship a bigger
# file with no more picture in it, and would put a candidate in the srcset that
# a DPR 2 screen would then choose.
WIDTHS = (400, 800, 1200)
QUALITY = 78
AVIF_QUALITY = 60
AVIF_SPEED = 4


def api(params):
    q = dict(params)
    q["format"] = "json"
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(q), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf8"))


def plain(s):
    """Commons returns extmetadata as HTML fragments; the author field is a link."""
    if s is None:
        return ""
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def read_commons(titles):
    """One request for every file's licence, author and current url."""
    got = {}
    for i in range(0, len(titles), 20):
        chunk = titles[i:i + 20]
        d = api({
            "action": "query",
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|size|mime",
            "titles": "|".join(chunk),
        })
        for page in d["query"]["pages"].values():
            info = page.get("imageinfo")
            if not info:
                got[page["title"]] = None
                continue
            it = info[0]
            m = it["extmetadata"]
            got[page["title"]] = {
                "url": it["url"],
                "descurl": it["descriptionurl"],
                "w": it["width"],
                "h": it["height"],
                "bytes": it["size"],
                "license": plain(m.get("LicenseShortName", {}).get("value")),
                "licenseUrl": plain(m.get("LicenseUrl", {}).get("value")),
                "author": plain(m.get("Artist", {}).get("value")),
            }
    return got


def render(im, width, stem):
    """One rendition, written as BOTH formats. Returns (w, h, webp bytes, avif bytes)."""
    h = round(im.height * width / im.width)
    r = im.resize((width, h), Image.LANCZOS)
    webp = OUT / f"{stem}-{width}.webp"
    avif = OUT / f"{stem}-{width}.avif"
    r.save(webp, "WEBP", quality=QUALITY, method=6)
    r.save(avif, "AVIF", quality=AVIF_QUALITY, speed=AVIF_SPEED)
    return width, h, webp.stat().st_size, avif.stat().st_size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="refetch and re-encode everything")
    args = ap.parse_args()

    doc = json.loads(DATA.read_text("utf8"))
    photos = doc.get("photos", [])
    if not photos:
        print("data/garbage-plate.json holds no `photos`; nothing to do.")
        return 0

    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    live = read_commons([p["file"] for p in photos])

    # THE GUARD. Every field the page PRINTS is compared against what Commons
    # says today, and a mismatch stops the run. Printing "CC BY 4.0, Paul Lowry"
    # under a photograph whose file page now says something else is the one
    # failure this whole script exists to prevent, and it is invisible from the
    # built page.
    bad = []
    for p in photos:
        cur = live.get(p["file"])
        if cur is None:
            bad.append(f'{p["file"]}: not on Commons any more (deleted, or renamed).')
            continue
        if cur["license"] != p["license"]:
            bad.append(f'{p["file"]}: licence is now "{cur["license"]}", data says "{p["license"]}".')
        if p["licenseUrl"] and cur["licenseUrl"].rstrip("/") != p["licenseUrl"].rstrip("/"):
            bad.append(f'{p["file"]}: licence url is now {cur["licenseUrl"]}, data says {p["licenseUrl"]}.')
        if cur["author"] != p["author"]:
            bad.append(f'{p["file"]}: author is now "{cur["author"]}", data says "{p["author"]}".')
    if bad:
        print("LICENCE CHECK FAILED. Nothing was fetched or written.\n")
        for b in bad:
            print("  " + b)
        print("\nFix data/garbage-plate.json against the file's own page on Commons, or")
        print("drop the photograph. Do not edit this check to make the run pass.")
        return 1

    print(f"Licence re-read from Commons and matched on all {len(photos)} files.\n")

    total_webp = total_avif = 0
    for p in photos:
        cur = live[p["file"]]
        src = CACHE / (p["slug"] + Path(urllib.parse.urlparse(cur["url"]).path).suffix.lower())
        if args.force or not src.exists():
            req = urllib.request.Request(cur["url"], headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=300) as r:
                src.write_bytes(r.read())

        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        if (im.width, im.height) != (cur["w"], cur["h"]):
            print(f'  ! {p["slug"]}: {im.width}x{im.height} on disk, Commons says '
                  f'{cur["w"]}x{cur["h"]}. Check the orientation tag.')
        # THE RATIO THE PAGE DECLARES, CHECKED THE SAME WAY THE LICENCE IS.
        # build-garbage-plate.mjs writes width and height on every <img> out of
        # these two numbers so a photograph reserves its own box before it
        # arrives, and a re-upload that reframes the picture would leave the
        # markup describing a shape the file no longer has. Nothing renders
        # broken when that happens; the page just shifts as it loads.
        if (p.get("w"), p.get("h")) != (im.width, im.height):
            print(f'  ! {p["slug"]}: data says {p.get("w")}x{p.get("h")}, the file is '
                  f'{im.width}x{im.height}. Update `w` and `h` in data/garbage-plate.json.')
            return 1

        # `maxw` IS PER PLACEMENT AND IT IS WHY THERE ARE 42 FILES AND NOT 56.
        # A rendition wider than the box a picture is ever drawn into is a
        # candidate a high-DPR phone will pick and nothing will ever need. The
        # 1200w exterior is 206KB of AVIF, because brickwork does not compress,
        # and a DPR 3 phone was picking it for a 318px card frame.
        cap = min(p.get("maxw", max(WIDTHS)), im.width)
        rows = []
        for w in WIDTHS:
            if w > cap:
                continue
            rows.append(render(im, w, p["slug"]))
        if not rows:
            rows.append(render(im, im.width, p["slug"]))

        widest = rows[-1]
        # The intrinsic ratio the page declares width/height from. Read off the
        # file rather than off the JSON, so a re-fetch of a corrected upload
        # cannot leave the markup describing the old frame.
        p_w, p_h = im.width, im.height
        print(f'  {p["slug"]:<28} {p_w}x{p_h}  ' +
              "  ".join(f"{w}w {wb/1024:.1f}/{ab/1024:.1f}KB" for w, _h, wb, ab in rows))
        for _w, _h, wb, ab in rows:
            total_webp += wb
            total_avif += ab

    print(f"\n  {len(photos)} photographs, {total_webp/1024:.1f}KB of WebP and "
          f"{total_avif/1024:.1f}KB of AVIF on disk in public/assets/plates/.")
    print("  Masters stay in .cache/plate-photos/ and are not committed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
