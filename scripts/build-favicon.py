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

IT IS TRUBBISH NOW AND IT WAS "GR" IN THE OLD PALETTE. Tim, 23 August 2026:
"can we update our favicon to be our little Trubbish mascot, or change the
colors to be updated to the new overall website pallete which is the colors of
trubbish". Both halves were fair. The mark was two letters where the site has
a mascot, and it was painted in navy #152638 on mustard #EFC94C -- the palette
Trubbish Deep replaced on 18 August 2026, so the one image every tab showed was
the last thing on the site still wearing the old colours.

WHAT SURVIVES THE CHANGE, because it is what makes an icon legible at 16px:

  - TWO COLOURS AT OPPOSITE ENDS OF THE VALUE RANGE. It was navy on mustard at
    about 9:1; it is now --page #1F382B on --ink #E4DCCC, MEASURED 9.29:1, so
    the legibility this file was protecting is held rather than improved. The
    eyes are 12.66:1 against the body, which is why they carry the icon. The
    other two Trubbish colours were rejected as the ground pair on exactly the
    grounds this file already argued: --ketchup is 1.94:1 against that ground
    and the light blue is 1.66:1, which is why they are specks and not shapes.

    A FIRST DRAFT OF THIS COMMENT SAID 10.9:1 AND WAS NOT MEASURED. The number
    above came out of a contrast function run on the two hexes actually used.
    Do not quote a ratio here you have not computed.
  - FLAT FILLS, NO GRADIENT, NO PHOTOGRAPHIC NOISE.
  - A SILHOUETTE THAT SURVIVES THE SHRINK. Trubbish is a rounded bag with two
    torn flaps on top; at 16px that outline plus two white eyes is the whole
    read, and it is more distinctive than two letters ever were.

The pink and the light blue are on it as two specks of trash, which is where
the rest of the mascot's palette lives without competing with the silhouette.
At 16px they are single pixels of colour and stop the tile reading as a plain
green shape; they carry NO meaning, which is what makes 1.94:1 and 1.66:1
acceptable on them and on nothing else here.

TWO DRAFTS WERE REJECTED FOR READING AS THE WRONG ANIMAL and the reasons are
kept because the next person will draw them again. Narrow flaps standing
STRAIGHT UP on a round head are ears, whatever they are meant to be, and the
icon was a cat. A lighter ellipse under the eyes, centred and rounded, is a
MUZZLE, and it was the other half of the same cat. The flaps lean out, the
left further than the right so the symmetry breaks, they overlap the bag so
they grow out of it rather than sitting beside it, and there is no belly.

The 180px Apple touch icon gets the same mark, because a home screen icon that
matches the tab icon is worth more than a prettier one that does not.

TITAN ONE IS NO LONGER NEEDED and the fetch-fonts dependency is gone with it:
nothing here sets type any more.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "public"

# Straight from ui.css.
# Straight from assets-source/ui.css, Trubbish Deep.
GROUND = (0xE4, 0xDC, 0xCC)   # --ink        the light ground
BODY = (0x1F, 0x38, 0x2B)     # --page       Trubbish's own deep green
BELLY = (0x2F, 0x4F, 0x39)    # --paper-2    the lighter bag green
WHITE = (0xFF, 0xFF, 0xFF)    # eyes and tooth, the mascot's own
PINK = (0xE8, 0x7E, 0xA1)     # --ketchup
BLUE = (0x70, 0xB5, 0xD9)     # the mascot's light blue

# Drawn big and downsampled, so the curves and the type stay clean.
SUPER = 512


def mark(px, rounded=True):
    """The icon at `px`, drawn at 512 and resampled down.

    DRAWN FOR 16px. Every proportion here is chosen so the silhouette still
    reads when the whole thing is sixteen pixels across: the bag fills most of
    the tile, the flaps break the outline at the top so it is not a circle, and
    the eyes are large enough to survive as two white dots rather than closing
    up. Nothing is outlined, because a 1px stroke at 512 is a fifth of a pixel
    at 16 and only muddies the edge.
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

    # THE FLAPS FLOP OUTWARD AND THEY ARE NOT POINTED. First attempt drew them
    # as two narrow triangles standing straight up and the icon read as a CAT:
    # vertical points on a round head are ears, whatever they are meant to be.
    # Trubbish's are torn corners of a bin bag, so they lean out, they are
    # rounded at the tip, and the left one leans further than the right, which
    # kills the symmetry that was doing most of the cat work.
    # THEY OVERLAP THE BAG RATHER THAN SITTING ON IT. At 180px a gap of even a
    # few pixels reads as two ears floating beside a head; the bag is painted
    # after them, so anything that overlaps disappears into it and what is left
    # is a torn corner growing out of the body.
    for box, ang in (((0.10, 0.06, 0.44, 0.27), 28), ((0.58, 0.08, 0.90, 0.27), -20)):
        f = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(f).ellipse([box[0] * S, box[1] * S, box[2] * S, box[3] * S], fill=BODY)
        im.alpha_composite(f.rotate(ang, resample=Image.BICUBIC, center=(S / 2, S / 2)))

    # The bag. Wider than it is tall and sitting low, which is the shape.
    d.ellipse([0.115 * S, 0.215 * S, 0.885 * S, 0.910 * S], fill=BODY)

    # NO BELLY. A lighter ellipse under the eyes was the second half of the cat:
    # centred, rounded and directly below two eyes, it reads as a MUZZLE. The
    # modelling is worth nothing at 16px and it was costing the whole silhouette.

    # THE EYES CARRY THE ICON. Big and close-set, which is Trubbish rather than
    # the wide-set pair a cat has, with small pupils so they stay white overall.
    for cx in (0.395, 0.605) :
        d.ellipse([(cx - 0.115) * S, 0.360 * S, (cx + 0.115) * S, 0.590 * S], fill=WHITE)
        d.ellipse([(cx - 0.040) * S, 0.450 * S, (cx + 0.040) * S, 0.535 * S], fill=BODY)

    # TWO TEETH, LOW AND OFF TO ONE SIDE, which is where the mascot's are. One
    # centred tooth under a muzzle was reading as a nose. At 16px this is a
    # light pixel or two along the bottom edge of the face and it is what makes
    # the shape a creature rather than a blob.
    d.polygon([(0.415 * S, 0.665 * S), (0.485 * S, 0.665 * S), (0.450 * S, 0.760 * S)], fill=WHITE)
    d.polygon([(0.505 * S, 0.665 * S), (0.560 * S, 0.665 * S), (0.532 * S, 0.735 * S)], fill=WHITE)

    # Two specks of trash, in the mascot's other two colours. They carry no
    # meaning and are the first thing to go if the tile ever needs simplifying.
    d.ellipse([0.150 * S, 0.720 * S, 0.235 * S, 0.800 * S], fill=PINK)
    d.ellipse([0.780 * S, 0.680 * S, 0.858 * S, 0.755 * S], fill=BLUE)

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
