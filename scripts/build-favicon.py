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
and scaling it down. That reasoning is unchanged and is why the answer to "can
we make the favicon Trubbish" is a DRAWN Trubbish and not a crop of one.

IT IS "GR" AGAIN, 24 AUGUST 2026, IN TRUBBISH DEEP. The owner: "i do not like that
new favicon at all, lets go back to just doing GR but lets do the colors of the
site pallet so dark green background and then a blue and pink letter for GR".

SO THIS HAS NOW BEEN BOTH THINGS, AND THE HISTORY IS WORTH KEEPING because the
next person will propose the drawn Trubbish again. The mark was "GR" on mustard
until 23 August, became a drawn Trubbish that day, and came back to "GR" the
next. What changed on the second move is the PALETTE, not the argument: the
Trubbish version existed because the old letters were painted in the colours
Trubbish Deep replaced, and that complaint is answered by repainting the letters
rather than by drawing a mascot.

THE ONE THING THAT DID NOT SURVIVE IS THE 9.29:1. The Trubbish tile was
--page on --ink, two colours at opposite ends of the value range, and this file
spent a paragraph explaining that that ratio is what makes an icon read at
16px. Two ACCENT letters on a dark ground cannot reach it, because both accents
sit in the middle of the range by construction. Measured on the hexes actually
used, and computed rather than guessed, which is this file's own standing rule:

    G  --lilac  #70B5D9 on --page #1F382B    5.61:1
    R  --ketchup #E87EA1 on --page #1F382B   4.78:1

Both clear 4.5:1, so both are legible; neither is the 9.29:1 the mascot had.

AND THE TWO LETTERS ARE 1.17:1 AGAINST EACH OTHER, which sounds alarming and is
not, for one reason that has to hold: THEY DO NOT TOUCH. Both accents sit at
almost the same lightness, so in greyscale the pair is one flat tone, and if a
letter ever overlapped its neighbour the two would merge into a single blob. It
is the GROUND each is read against, and the space between them, that does the
work. Checked by rendering icon-512.png through a greyscale convert and
resampling to 16, 32 and 48: the pair still reads as two letterforms at every
size. IF ANYBODY TIGHTENS THE TRACKING HERE, re-run that check first.
That is the real cost of the change and it is stated rather than buried. It is
also the reason the two letters are the WHOLE tile: there is no third element
competing with them, the counters are open, and the ground is the darkest green
in the palette so the accents have as much room as the palette allows.

WHY G IS THE BLUE AND R IS THE PINK, since the owner said "a blue and pink letter"
and did not assign them. It follows the site's own accent rule, which says pink
is what the site is SAYING: the wordmark on every page is GARBAGE **RIPS** 585
with RIPS in pink, so the R being pink makes the icon a two-letter compression
of the wordmark rather than an unrelated pairing. Swapping them would put the
teal on the half the wordmark paints pink.

WHAT SURVIVES FROM THE TRUBBISH VERSION, because it is what makes any icon
legible at 16px and none of it is about the subject:

  - FLAT FILLS, NO GRADIENT, NO OUTLINE. A 1px stroke at 512 is a fifth of a
    pixel at 16 and only muddies the edge.
  - DRAWN AT 512 AND RESAMPLED DOWN, so the curves stay clean.
  - EVERY SIZE IN THE .ico IS ITS OWN RENDER, never an upscaled 16.
  - THE CONTACT SHEET IS THE CHECK. Nothing ships from this file until the
    16px tile has been looked at at real size, on light AND on a dark tab bar.

TITAN ONE IS NEEDED AGAIN and so is the fetch-fonts dependency: this sets type.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "public"

# Straight from assets-source/ui.css, Trubbish Deep.
GROUND = (0x1F, 0x38, 0x2B)   # --page       the darkest green the palette has
G_INK = (0x70, 0xB5, 0xD9)    # --lilac      the light blue, 5.61:1 on GROUND
R_INK = (0xE8, 0x7E, 0xA1)    # --ketchup    the pink,       4.78:1 on GROUND

FONTS = ROOT / ".cache" / "fonts"


def font(size):
    p = FONTS / "TitanOne.ttf"
    if not p.exists():
        raise SystemExit(f"Missing {p}.\nRun: bash scripts/fetch-fonts.sh")
    return ImageFont.truetype(str(p), size)


# Drawn big and downsampled, so the curves and the type stay clean.
SUPER = 512


def mark(px, rounded=True):
    """The icon at `px`, drawn at 512 and resampled down.

    DRAWN FOR 16px. The two letters are the whole tile: they are set as large
    as the counters allow and optically centred, because at sixteen pixels
    anything else on the ground is a smudge competing with the only thing that
    carries meaning. The G's bowl and the R's counter are what make this read
    as letters rather than as two blobs, so nothing is allowed to close them.
    """
    im = Image.new("RGBA", (SUPER, SUPER), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    S = SUPER

    # The tile. Rounded for the tab icon, square for Apple, which applies its
    # own corner radius and would otherwise round an already round shape.
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=GROUND)
    else:
        d.rectangle([0, 0, S - 1, S - 1], fill=GROUND)

    # TWO LETTERS, TWO COLOURS, ONE OPTICAL CENTRE. They have to be measured as
    # the PAIR and then drawn separately, because each needs its own fill:
    # centring "G" and "R" independently would space them by their own widths
    # rather than by the kerned advance and the mark would read as two initials
    # with a gap rather than as a monogram.
    f = font(int(S * 0.56))
    box = d.textbbox((0, 0), "GR", font=f)
    x = (S - (box[2] - box[0])) / 2 - box[0]
    # Optical rather than metric: Titan One's cap height sits high in its em, so
    # centring on the bounding box leaves the pair looking low on the tile.
    y = (S - (box[3] - box[1])) / 2 - box[1] - S * 0.015

    d.text((x, y), "G", font=f, fill=G_INK)
    d.text((x + d.textlength("G", font=f), y), "R", font=f, fill=R_INK)

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
