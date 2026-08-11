#!/usr/bin/env python3
"""Build the favicon set.

    python3 scripts/build-favicon.py

Writes public/favicon.ico (16/32/48), public/favicon-32.png,
public/apple-touch-icon.png (180) and public/icon-512.png.

WHY THIS IS DRAWN AND NOT CROPPED
The old icons were a crop of Trubbish's face out of logo-square.jpg. At 180px
that is charming; at 16px, which is the only size a browser tab ever shows, it
is a dark olive shape on a mid brown ground. Two muddy colours at similar
value, no outline, no silhouette. It does not read as anything, and an icon
that does not read is indistinguishable from a missing one, which is exactly
what it got mistaken for.

So this draws a mark FOR 16px and scales it up, rather than shooting a photo
and scaling it down:

  - two colours, taken as far apart in value as the palette allows
    (navy #152638 against mustard #EFC94C, about 9:1)
  - flat fills, no gradient, no photographic noise
  - "GR" set in Titan One, the display face already on the site, which is
    heavy enough to survive at 16px where a lighter face closes up

The 180px Apple touch icon gets the same mark, because a home screen icon that
matches the tab icon is worth more than a prettier one that does not.

Fonts come from .cache/fonts. Run scripts/fetch-fonts.sh if that is empty.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / ".cache" / "fonts"
PUB = ROOT / "public"

# Straight from ui.css.
INK = (21, 38, 58)
MUSTARD = (239, 201, 76)
GOLD = (224, 162, 31)

# Drawn big and downsampled, so the curves and the type stay clean.
SUPER = 512


def font(size):
    p = FONTS / "TitanOne.ttf"
    if not p.exists():
        raise SystemExit(f"Missing {p}.\nRun: bash scripts/fetch-fonts.sh")
    return ImageFont.truetype(str(p), size)


def mark(px, rounded=True):
    """The icon at `px`, drawn at 512 and resampled down."""
    im = Image.new("RGBA", (SUPER, SUPER), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # Mustard tile. Rounded for the tab icon, square for Apple, which applies
    # its own corner radius and would otherwise round an already round shape.
    if rounded:
        d.rounded_rectangle([0, 0, SUPER - 1, SUPER - 1], radius=int(SUPER * 0.22), fill=MUSTARD)
    else:
        d.rectangle([0, 0, SUPER - 1, SUPER - 1], fill=MUSTARD)

    # A gold band along the bottom, the one bit of brand texture that survives
    # the shrink: at 16px it reads as a shadow under the letters and stops the
    # tile looking like a plain yellow square.
    band = int(SUPER * 0.135)
    if rounded:
        d.rounded_rectangle(
            [0, SUPER - band - int(SUPER * 0.22), SUPER - 1, SUPER - 1],
            radius=int(SUPER * 0.22),
            fill=GOLD,
        )
        d.rectangle([0, SUPER - band - int(SUPER * 0.22), SUPER - 1, SUPER - band], fill=MUSTARD)
    else:
        d.rectangle([0, SUPER - band, SUPER - 1, SUPER - 1], fill=GOLD)

    # "GR", optically centred in the space above the band.
    f = font(int(SUPER * 0.52))
    box = d.textbbox((0, 0), "GR", font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    x = (SUPER - w) / 2 - box[0]
    y = (SUPER - band - h) / 2 - box[1]
    d.text((x, y), "GR", font=f, fill=INK)

    return im.resize((px, px), Image.LANCZOS)


def write_ico(path, images):
    """Pack PNG-compressed images into an .ico.

    Written by hand because Pillow's ICO writer takes ONE image and resizes it
    to whatever `sizes` asks for, ignoring `append_images` and silently
    dropping any size larger than the source. Handing it a 16px base and asking
    for 16/32/48 produced a one-image icon containing only the 16, which looks
    fine in every check that does not open the container and count.

    Each image here is its own 512px render resampled down, so the 48 is not an
    upscaled 16.
    """
    import io
    import struct

    blobs = []
    for im in images:
        buf = io.BytesIO()
        im.save(buf, format="PNG", optimize=True)
        blobs.append(buf.getvalue())

    header = struct.pack("<HHH", 0, 1, len(blobs))
    offset = 6 + 16 * len(blobs)
    entries, body = b"", b""
    for im, blob in zip(images, blobs):
        w = 0 if im.width >= 256 else im.width
        h = 0 if im.height >= 256 else im.height
        entries += struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(blob), offset)
        body += blob
        offset += len(blob)

    path.write_bytes(header + entries + body)


sizes = [16, 32, 48]
write_ico(PUB / "favicon.ico", [mark(s) for s in sizes])

mark(32).save(PUB / "favicon-32.png", optimize=True)
mark(180, rounded=False).convert("RGB").save(PUB / "apple-touch-icon.png", optimize=True)
mark(512, rounded=False).convert("RGB").save(PUB / "icon-512.png", optimize=True)

# A contact sheet at real size, to check the 16px actually reads before shipping.
sheet = Image.new("RGB", (330, 90), (250, 250, 250))
x = 12
for s in (16, 32, 48):
    sheet.paste(mark(s), (x, 12), mark(s))
    x += s + 12
sheet.paste(mark(16).resize((64, 64), Image.NEAREST), (x + 8, 12))
# and on a dark tab bar, since half of browsers are in dark mode
dark = Image.new("RGB", (110, 66), (32, 33, 36))
dark.paste(mark(16), (22, 25), mark(16))
sheet.paste(dark, (210, 12))
sheet.save("/tmp/favicon-preview.png")

for f in ("favicon.ico", "favicon-32.png", "apple-touch-icon.png", "icon-512.png"):
    print(f"  {f:<22} {(PUB / f).stat().st_size / 1024:>6.1f} KB")
print("\nPreview at real size: /tmp/favicon-preview.png")
