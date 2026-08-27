#!/usr/bin/env python3
"""Cut show-organiser logos out of their background and size them for the web.

    python3 scripts/build-show-logos.py [--preview]

Drop masters in assets-source/shows/ named by the `logo` field in
data/shows.json (cold-front-cards.png ...). Writes transparent AVIF and WebP at
200 and 400 wide to public/assets/shows/, which is the ladder build-shows.mjs
already emits a <picture> for.

WHY A FLOOD FILL AND NOT A THRESHOLD. Organisers send logos as opaque squares
on white, and the obvious cut is "every near-white pixel becomes transparent".
That destroys this kind of art. The Cold Front logo is an ice theme: the letters
carry white highlights, the icicles are white, and there are white sparkles. A
threshold punches holes through all three and leaves the letters looking eaten.
Only the white REACHING THE BORDER is background, so the fill starts at the edge
and stops wherever the art does. White locked inside the art is never reached.

THE HEIGHT IS PRINTED, NOT ASSUMED. Cutting the background changes the aspect
ratio, because the master is padded and the art inside it is not square. The
logoW/logoH in shows.json set the <img> height attribute, so a stale pair there
reserves the wrong box and shifts the row as the logo loads. This prints the
trimmed size for each file; put those numbers in the data.

A LOGO GOES UP ONLY WHEN ITS OWNER SENDS IT FOR THIS USE. Cold Front's came by
text from the organiser on 26 August 2026, with the flyer, for the calendar.

Needs Pillow: python3 -m pip install --user Pillow
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-source" / "shows"
FLYERS = SRC / "flyers"
OUT = ROOT / "public" / "assets" / "shows"

# The card paints a flyer into a 220px box and the lightbox opens it to 900px.
# One file cannot serve both: see the note over flyerSrc in build-shows.mjs.
THUMB_W = 440          # 220px box at DPR 2
FULL_W = 1024          # the lightbox cap is 900; masters so far are 1024 wide
FLYER_Q = 78
# Matched per flyer against the shipped JPEG's own SSIM: the three masters needed
# q50, q55 and q60 to meet or beat it, so 60 covers all three with headroom.
FLYER_AVIF_Q = 60

# Rendered into a 56px box, so 200w already covers DPR 3 (168 device px) and
# 400w is only ever picked past DPR 3.57. Both are emitted because the page's
# <picture> declares both and a candidate nobody takes costs only its markup.
WIDTHS = (200, 400)

# AND ONE BIG ONE FOR THE LIGHTBOX, added 27 August 2026 when the owner asked for
# every logo on the site to open larger on a click, the way the flyers below
# already do. The reasoning, the 800 and the 500 floor are all written out once
# in build-brand-logos.py, which does the same job for the shop and creator
# logos; this is the same ladder on the same kind of file and the two must not
# drift. NEVER UPSCALES: the width is min(800, whatever this master really is),
# and Cold Front's trims to 880, which is where the 800 came from.
LARGE_W = 800
LARGE_MIN = 500
# Looked AT rather than glanced at, so it does not run at the 56px box's q50.
LARGE_Q = 72
# 50 AND NOT 82, AND THE ORDER OF THE TWO FORMATS IS WHY. The page puts AVIF
# first, so a quality where AVIF is the LARGER file serves the worse one to
# every modern browser. On art this dense, 200w: avif 10,706 / webp 12,578 at
# q45, avif 21,304 / webp 17,522 at q82. AVIF only wins below about q55. It is
# painted at 56px, so 200w is already 3.5x oversampled and the detail this
# spends bytes on (sparkles, ice texture) is invisible at that size.
QUALITY = 50

# How close to the background colour a pixel must be to be walked through.
# Generous on purpose: the halo around this art fades to white over ~150px, and
# a tight threshold strands a grey ring that reads as a box on a dark page.
TOL = 46

# The page paints these on --card. Only used by --preview.
CARD = (0x2F, 0x4F, 0x39)


def deletterbox(im: Image.Image) -> Image.Image:
    """Trim the black bars off a phone screenshot.

    Organisers send logos as screenshots, so the file is the whole phone screen:
    585Cardz's arrived 1170x2532 with the logo occupying rows 708 to 1737 and
    black everywhere else. THAT BREAKS THE CUT BELOW RATHER THAN JUST WASTING
    PIXELS, because background_mask takes the background colour FROM THE CORNERS.
    All four corners are black, so it would flood the BARS away and leave the
    white the logo actually sits on, producing a white box on a dark green page.

    A BAR IS ONLY A BAR IF IT DIFFERS FROM WHAT IS UNDER IT. Trimming every
    uniform edge row would eat the plain background of a normal logo (Cold
    Front's top rows are uniform white, and they ARE the background the flood
    fill needs to start from). So an edge run is only removed when it is uniform
    AND its colour is far from the colour just inside it.
    """
    a = np.asarray(im).astype(np.int16)
    h, w, _ = a.shape

    def run(line_at, n):
        i = 0
        while i < n and line_at(i).std() < 3.0:
            i += 1
        return i

    top = run(lambda i: a[i], h)
    bot = run(lambda i: a[h - 1 - i], h)
    left = run(lambda i: a[:, i], w)
    right = run(lambda i: a[:, w - 1 - i], w)

    def far(bar_colour, inside_colour):
        return float(np.sqrt(((bar_colour - inside_colour) ** 2).sum())) > 60

    if top and top < h - 1 and not far(a[0].mean(axis=0), a[min(top + 2, h - 1)].mean(axis=0)):
        top = 0
    if bot and bot < h - 1 and not far(a[h - 1].mean(axis=0), a[max(h - 3 - bot, 0)].mean(axis=0)):
        bot = 0
    if left and left < w - 1 and not far(a[:, 0].mean(axis=0), a[:, min(left + 2, w - 1)].mean(axis=0)):
        left = 0
    if right and right < w - 1 and not far(a[:, w - 1].mean(axis=0), a[:, max(w - 3 - right, 0)].mean(axis=0)):
        right = 0

    if top or bot or left or right:
        im = im.crop((left, top, w - right, h - bot))
        print(f"  letterbox trimmed: top {top}, bottom {bot}, left {left}, right {right}"
              f" -> {im.size}")
    return im


def background_mask(rgb: np.ndarray, tol: int) -> np.ndarray:
    """True where a pixel is background: near the corner colour AND reachable
    from the border without crossing the art."""
    h, w, _ = rgb.shape
    corners = np.array(
        [rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]], dtype=np.int16
    )
    # Organisers do send logos on off-white and on black, so take the colour
    # from the master rather than assuming white.
    bg = corners.mean(axis=0)
    dist = np.sqrt(((rgb.astype(np.int16) - bg) ** 2).sum(axis=2))
    cand = dist <= tol

    seen = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if cand[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if cand[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def cut(path: Path) -> Image.Image:
    im = deletterbox(ImageOps.exif_transpose(Image.open(path)).convert("RGB"))
    arr = np.asarray(im)
    bg = background_mask(arr, TOL)

    alpha = np.where(bg, 0, 255).astype(np.uint8)
    out = np.dstack([arr, alpha])
    img = Image.fromarray(out)

    # The cut leaves a one-pixel rim of art-blended-with-white all round the
    # edge. It survives as a pale outline on a dark page at full size; it does
    # not survive the downscale, but the trim below is measured from alpha and
    # a fringe would widen the box, so drop the weakest rim first.
    box = img.getbbox()
    return img.crop(box) if box else img


def flyers() -> None:
    """A flyer is a photograph of a poster: JPEG, no alpha, no background cut.

    EXIF ORIENTATION IS APPLIED. A phone photograph of a flyer is stored
    sideways with a rotation tag, and resizing without reading it ships the
    poster on its side with correct width and height attributes on it, which
    nothing in the build can see. Same trap as sync-plate-photos.py.
    """
    masters = sorted(p for p in FLYERS.glob("*") if p.suffix.lower() in
                     (".png", ".jpg", ".jpeg", ".webp") and not p.name.startswith("."))
    if not masters:
        return
    OUT.mkdir(parents=True, exist_ok=True)
    for m in masters:
        im = ImageOps.exif_transpose(Image.open(m)).convert("RGB")
        w, h = im.size
        for label, tw in (("", THUMB_W), ("-full", FULL_W)):
            tw = min(tw, w)
            th = max(1, round(tw * h / w))
            small = im.resize((tw, th), Image.LANCZOS)
            dest = OUT / f"{m.stem}{label}.jpg"
            small.save(dest, "JPEG", quality=FLYER_Q, optimize=True, progressive=True)
            # AND AN AVIF BESIDE IT. The flyers were the only images on the shows
            # page not served AVIF-first: every logo and the footer mark already
            # were. A codec shrinks whichever candidate the browser had ALREADY
            # chosen, so unlike a width this pays at DPR 1, 2 and 3 alike. The JPEG
            # stays as the fallback and is what the lightbox and the <img> point at.
            avif = OUT / f"{m.stem}{label}.avif"
            small.save(avif, "AVIF", quality=FLYER_AVIF_Q)
            jb, ab = dest.stat().st_size, avif.stat().st_size
            print(f"  {dest.relative_to(ROOT)}  {tw}x{th}  {jb:,} bytes")
            print(f"  {avif.relative_to(ROOT)}  {tw}x{th}  {ab:,} bytes"
                  f"  ({100 * (jb - ab) / jb:.1f}% smaller than the jpeg)")
            # A LOUD REFUSAL RATHER THAN A SILENT REGRESSION: the page puts the
            # AVIF first, so an AVIF that is BIGGER means every modern browser
            # takes the worse file. Same trap the logo quality note records.
            if ab >= jb:
                # NOT A BUILD FAILURE, A SKIP, and the difference matters. This
                # fired for real on the first tiny flyer: a 310x161 screenshot,
                # already heavily JPEG-compressed, encoded to 44,598 bytes of AVIF
                # against the JPEG's 16,583. AVIF is not universally smaller, and
                # it loses on small already-lossy sources. Killing the build would
                # mean one bad flyer blocks the whole site; the honest answer is to
                # not emit the file, so build-shows.mjs serves the JPEG alone.
                avif.unlink()
                print(f"    skipped: avif was {ab:,} against the jpeg's {jb:,}, "
                      f"so this one is served as jpeg only")
            if not label:
                print(f'  data/shows.json: "flyerW": {tw}, "flyerH": {th}')


def main() -> int:
    preview = "--preview" in sys.argv
    masters = sorted(p for p in SRC.glob("*.png") if not p.name.startswith("."))
    if not masters and not FLYERS.exists():
        print(f"No masters in {SRC.relative_to(ROOT)}/ - nothing to do.")
        return 0

    OUT.mkdir(parents=True, exist_ok=True)
    for m in masters:
        img = cut(m)
        w, h = img.size
        print(f"{m.name}: {Image.open(m).size} master -> {w}x{h} trimmed")
        print(f'  data/shows.json: "logoW": {w}, "logoH": {h}')

        if preview:
            flat = Image.new("RGB", img.size, CARD)
            flat.paste(img, mask=img.split()[3])
            # NOT into public/: a preview is a decision aid, and the deploy
            # root is not a scratch directory. It shipped once.
            p = ROOT / ".cache" / f"{m.stem}-on-card.png"
            p.parent.mkdir(parents=True, exist_ok=True)
            flat.resize((420, round(420 * h / w)), Image.LANCZOS).save(p)
            print(f"  preview: {p}")
            continue

        ladder = [(tw, f"-{tw}", QUALITY) for tw in WIDTHS]
        if w >= LARGE_MIN:
            ladder.append((min(LARGE_W, w), "-lg", LARGE_Q))
        for tw, tag, q in ladder:
            th = max(1, round(tw * h / w))
            # A PLAIN RESIZE, NOT A PREMULTIPLIED ONE, and that was measured
            # rather than assumed. Transparent pixels here still carry the
            # background's white, so resizing colour and alpha independently is
            # the textbook halo bug. Against ground truth (composite at full
            # size, then downscale) the plain resize is RMSE 1.29 and the
            # premultiply round trip is 4.78: un-premultiplying divides by a
            # small alpha in uint8 and loses more than the bleed costs.
            small = img.resize((tw, th), Image.LANCZOS)
            for ext in ("avif", "webp"):
                dest = OUT / f"{m.stem}{tag}.{ext}"
                small.save(dest, quality=q)
                print(f"  {dest.relative_to(ROOT)}  {tw}x{th}  {dest.stat().st_size:,} bytes")
            # THE SAME GUARD THE FLYERS BELOW HAVE CARRIED SINCE DAY ONE, and
            # this ladder went without it until 27 August 2026 because none of
            # its renditions had ever lost. The -lg one does: Cold Front's mark
            # is 103,889 bytes as AVIF against 97,250 as WebP at 800px. A
            # <picture> takes the first source it can decode, so shipping that
            # is not a harmless fallback, it is 6.6KB handed to every browser
            # that supports AVIF, on the one image here somebody opened on
            # purpose.
            avif, webp = OUT / f"{m.stem}{tag}.avif", OUT / f"{m.stem}{tag}.webp"
            ab, wb = avif.stat().st_size, webp.stat().st_size
            if ab >= wb:
                avif.unlink()
                print(f"    dropped {avif.name}: {ab:,} bytes against the webp's "
                      f"{wb:,}, so this one is served as webp only")

    if not preview:
        flyers()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
