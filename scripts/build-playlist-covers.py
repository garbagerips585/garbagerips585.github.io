#!/usr/bin/env python3
"""Draw the playlist covers for /playlists.html.

    node scripts/sync-playlist-covers.mjs     work out what each playlist opens
    python3 scripts/build-playlist-covers.py  draw it

Reads data/playlist-covers.json plus the originals that sync cached under
.cache/playlist-covers/, and writes public/assets/playlist-covers/<file>.webp
with a .jpg beside it as the fallback.

NOT IN build-all.mjs, and check-build.py's _ONE_OFF list says so. It is an asset
generator in the same bracket as build-packs.py and build-logos.py: it needs a
warm .cache/ (gitignored) and it writes files that are committed, so a nightly
that ran it would either fail on a cold cache or churn bytes for nothing.

Needs Pillow: python3 -m pip install --user Pillow

---------------------------------------------------------------- WHAT IT DRAWS

The box is small. .pl-thumb in assets-source/ui.css is `width:118px;
aspect-ratio:4/3` and it measures 118px at every viewport from 360 to 1920, so
the cover is painted 118x88 CSS px whatever the grid does. At that size
LEGIBILITY BEATS DETAIL, and a photograph alone loses: the twenty-one YouTube
covers this replaces were all a hand holding a card against a dark wall, and at
118px they were indistinguishable from each other.

So every cover is the same two-part panel:

  - the PRODUCT, on paper, filling the top three quarters. The photograph
    arrives on a white studio background, which is exactly the trick
    build-how-many-packs.mjs already uses ("Product photography arrives on a
    white background, so the tile is white"): map near-white to the site's paper
    and the background disappears into the panel with NO keying, no halo and no
    hole punched in a pale box. Prismatic Evolutions is a white box on a white
    background and it survives this, which a flood-fill knockout does not.
  - the SET LOGO, reversed out on a black band with a gold rule above it. The
    logos are already on disk at public/assets/logos/, drawn for dark
    backgrounds, and /sets/ paints them 110px wide, so 118px here is a size they
    are known to read at. The band is what makes the cover say a set name rather
    than just show a box.

That is the whole design and it is deliberately colour-independent: black band,
paper panel, one gold rule, and the only colour on the cover is the product and
its logo. Same argument as the palette note in CLAUDE.md.

HITS ONLY IS THE ODD ONE OUT ON PURPOSE. It has no single product (55 videos,
14 sets, 10 product types), so it shows THREE, one of each type this page has
photography for, and its band carries a gold wordmark instead of a set logo.
Which three is decided in sync-playlist-covers.mjs, where the data is, and all
three are genuinely in that playlist.

------------------------------------------------------------- FORMATS AND SIZE

WebP with a JPEG underneath in a <picture>, which is the pattern build-pages.mjs
already uses for the video thumbnails. AVIF was NOT used here and that is worth
saying, because CLAUDE.md is emphatic that AVIF beats WebP by ~30% on the card
scans: Pillow is the only encoder in this tree and its AVIF support is not
guaranteed on the machine that runs this, and 21 covers at ~9KB is not where
this page's weight is. If somebody adds an AVIF encoder, put it in FRONT of the
WebP source and leave the JPEG where it is.

360x270 is just over 3x the 118px box, so a DPR 3 phone gets a real pixel per
device pixel and there is no srcset to keep in step with the markup.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data" / "playlist-covers.json"
CACHE = ROOT / ".cache" / "playlist-covers"
LOGOS = ROOT / "public" / "assets" / "logos"
FONTS = ROOT / ".cache" / "fonts"
OUT = ROOT / "public" / "assets" / "playlist-covers"

# THE SAME TWO NUMBERS sync-playlist-covers.mjs STAMPS onto the data as the
# width and height attributes. They are checked against the manifest below
# rather than trusted, because a cover drawn at one size and declared at another
# is a layout bug that only shows up on a slow connection.
W, H = 360, 270
BAND = 66              # the black strip the set logo sits on
RULE = 3               # the gold keyline above it
PAD = 14               # breathing room around the product

INK = (17, 17, 17)     # --ink / --chrome-bg
PAPER = (244, 243, 239)  # --paper
GOLD = (201, 151, 0)   # --gold

WEBP_Q = 82
JPEG_Q = 84


def font(name, size):
    p = FONTS / name
    if not p.exists():
        raise SystemExit(f"Missing {p}.\nRun: bash scripts/fetch-fonts.sh")
    return ImageFont.truetype(str(p), size)


def to_paper(im):
    """Map the studio white background onto the panel's paper.

    A RAMP RATHER THAN A THRESHOLD, from 232 to 248 in luminance. A hard cutoff
    leaves a visible step wherever the background falls off towards the edge of
    the frame, and several of these photographs have a soft vignette. Interior
    whites on the product move too, by design: paper is 4 points off white, so a
    white box stays a white box and only the ground it stands on shifts.
    """
    im = im.convert("RGB")
    lum = im.convert("L")
    mask = lum.point(lambda v: 0 if v < 232 else min(255, int((v - 232) * 255 / 16)))
    return Image.composite(Image.new("RGB", im.size, PAPER), im, mask)


def trim(im, thresh=238):
    """Crop to the product, so a photograph with a wide margin is not drawn small."""
    bb = im.convert("L").point(lambda v: 255 if v < thresh else 0).getbbox()
    return im.crop(bb) if bb else im


def fit(im, bw, bh):
    r = min(bw / im.width, bh / im.height)
    return im.resize((max(1, round(im.width * r)), max(1, round(im.height * r))), Image.LANCZOS)


def panel():
    """Paper above, black band below, one gold rule between them."""
    p = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(p)
    top = H - BAND
    # A whisper of a gradient, so a white product on a white panel still has an
    # edge. Four values over 204px: any more and it reads as a photograph of a
    # backdrop rather than as a panel.
    for y in range(top):
        v = 255 - int(10 * y / top)
        d.line([(0, y), (W, y)], fill=(v, v, v - 3))
    d.rectangle([0, top, W, H], fill=INK)
    d.rectangle([0, top, W, top + RULE - 1], fill=GOLD)
    return p


def stand(p, prod, cx, cy):
    """Paste a product with a soft contact shadow under it."""
    x, y = round(cx - prod.width / 2), round(cy - prod.height / 2)
    sh = Image.new("L", (prod.width, 20), 0)
    ImageDraw.Draw(sh).ellipse([0, 0, prod.width - 1, 19], fill=96)
    sh = sh.filter(ImageFilter.GaussianBlur(7))
    p.paste((116, 114, 108), (x, y + prod.height - 9), sh)
    p.paste(prod, (x, y))


def product_of(entry):
    return trim(to_paper(Image.open(CACHE / f"{entry['productId']}.jpg")))


def draw_product(c):
    p = panel()
    top = H - BAND
    prod = fit(product_of(c), W - 2 * PAD, top - PAD - 6)
    stand(p, prod, W / 2, (top - 4) / 2)

    logo = Image.open(LOGOS / f"{c['setId']}-pokemon-tcg-set-logo.webp").convert("RGBA")
    logo = fit(logo, W - 2 * PAD, BAND - RULE - 16)
    p.paste(logo, ((W - logo.width) // 2, top + RULE + (BAND - RULE - logo.height) // 2), logo)
    return p


def draw_hits(c):
    """The one cover with no single product.

    Three real products from the run, overlapped left to right so the group
    reads as a pile rather than as three separate pictures, and a gold wordmark
    in place of a set logo. Drawn back to front, biggest box behind.
    """
    p = panel()
    top = H - BAND
    ims = [product_of(q) for q in c["products"]]
    # Heights chosen so all three read at 118px: the ETB is the widest object so
    # it goes smallest, the pack is the narrowest so it goes tallest and sits in
    # front. Nothing here is a share of anything, because these three
    # photographs have wildly different aspect ratios.
    heights = [top - 74, top - 62, top - 40]
    ims = [fit(im, 190, h) for im, h in zip(ims, heights)]
    xs = [W * 0.29, W * 0.50, W * 0.72]
    base = top - 16
    for im, x in zip(ims, xs):
        stand(p, im, x, base - im.height / 2)

    d = ImageDraw.Draw(p)
    label = c.get("label", "HITS ONLY")
    f = font("TitanOne.ttf", 34)
    tw = d.textlength(label, font=f)
    if tw > W - 2 * PAD:
        f = font("TitanOne.ttf", int(34 * (W - 2 * PAD) / tw))
        tw = d.textlength(label, font=f)
    bb = f.getbbox(label)
    d.text(((W - tw) / 2, top + RULE + (BAND - RULE - (bb[3] - bb[1])) / 2 - bb[1]),
           label, font=f, fill=GOLD)
    return p


doc = json.loads(MANIFEST.read_text(encoding="utf-8"))
size = doc.get("size") or {}
if (size.get("w"), size.get("h")) != (W, H):
    raise SystemExit(
        f"data/playlist-covers.json says covers are {size.get('w')}x{size.get('h')} and this "
        f"script draws {W}x{H}. Those two numbers become the width and height attributes on the "
        f"page, so they have to agree. Change COVER_W/COVER_H in "
        f"scripts/sync-playlist-covers.mjs and W/H here in the same edit."
    )

OUT.mkdir(parents=True, exist_ok=True)
seen = {}
for c in doc["covers"].values():
    name = c["file"]
    if name in seen:
        continue
    im = draw_hits(c) if c["art"] == "hits" else draw_product(c)
    im.save(OUT / f"{name}.webp", "WEBP", quality=WEBP_Q, method=6)
    im.save(OUT / f"{name}.jpg", "JPEG", quality=JPEG_Q, optimize=True, progressive=True)
    seen[name] = (OUT / f"{name}.webp").stat().st_size, (OUT / f"{name}.jpg").stat().st_size

wt = sum(a for a, _ in seen.values())
jt = sum(b for _, b in seen.values())
for name, (a, b) in sorted(seen.items()):
    print(f"  {name:<34} {a / 1024:6.1f}KB webp   {b / 1024:6.1f}KB jpg")
print(
    f"\n  {len(seen)} covers -> public/assets/playlist-covers/\n"
    f"  {wt / 1024:.1f}KB of WebP, which is what a browser fetches, "
    f"plus {jt / 1024:.1f}KB of JPEG fallback that only a browser without WebP ever asks for."
)
