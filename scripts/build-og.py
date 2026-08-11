#!/usr/bin/env python3
"""Build the link-preview image.

    python3 scripts/build-og.py

Writes public/assets/og-image.jpg at 1200x630, the size iMessage, Slack,
Discord, Facebook, X and LinkedIn all crop from.

The generic booster wrapper is the subject, because it already carries the
wordmark and the mascot: the artwork is the brand, so the type around it only
has to say what the site is and where it is from.

Fonts come from .cache/fonts (Titan One and Space Mono, the site's own faces,
both SIL Open Font License). Run scripts/fetch-fonts.sh if that folder is
empty.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / ".cache" / "fonts"
OUT = ROOT / "public" / "assets" / "og-image.jpg"

W, H = 1200, 630

# Straight from ui.css.
INK = (21, 38, 58)
INK_DEEP = (14, 27, 42)
MUSTARD = (239, 201, 76)
GOLD = (224, 162, 31)
CREAM = (244, 241, 226)
STEEL = (159, 176, 192)


def font(name, size):
    p = FONTS / name
    if not p.exists():
        raise SystemExit(
            f"Missing {p}.\nRun: bash scripts/fetch-fonts.sh"
        )
    return ImageFont.truetype(str(p), size)


SETS = ROOT / "public" / "data" / "sets.json"


def build(pack_path, label, out_path):
    """One share card: the wrapper on the left, the brand on the right."""
    card = Image.new("RGB", (W, H), INK)
    draw = ImageDraw.Draw(card)

    # Gold bloom behind the pack, the same light the Greatest Hits band uses.
    # Drawn as a blurred ellipse because Pillow has no gradient primitive and a
    # blur is closer to how the CSS actually renders.
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W * 0.02, -H * 0.55, W * 0.62, H * 0.95], fill=150)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    card.paste(Image.new("RGB", (W, H), GOLD), (0, 0), glow)

    # Faint dot field, so the flat navy has some texture at full size.
    dots = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dots)
    for y in range(0, H, 26):
        for x in range((y // 26 % 2) * 13, W, 26):
            dd.ellipse([x, y, x + 2, y + 2], fill=(255, 255, 255, 16))
    card = Image.alpha_composite(card.convert("RGBA"), dots).convert("RGB")
    draw = ImageDraw.Draw(card)

    pack = Image.open(pack_path).convert("RGBA")
    pack.thumbnail((470, 470 * 1920 // 1080), Image.LANCZOS)
    pack = pack.rotate(-7, resample=Image.BICUBIC, expand=True)

    # Its own silhouette, blurred and offset, so it sits on the background
    # rather than floating in front of it.
    shadow = Image.new("RGBA", pack.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 165), (0, 0), pack.split()[-1])
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))

    px, py = 74, (H - pack.height) // 2
    card.paste(shadow, (px + 16, py + 22), shadow)
    card.paste(pack, (px, py), pack)

    TX = px + pack.width + 62
    title = font("TitanOne.ttf", 78)
    mono = font("SpaceMono.ttf", 25)

    def tracked(d, xy, text, f, fill, extra=0):
        """Draw with letter-spacing, which Pillow does not support natively."""
        x, y = xy
        for ch in text:
            d.text((x, y), ch, font=f, fill=fill)
            x += d.textlength(ch, font=f) + extra
        return x

    y = 176
    draw.text((TX, y), "GARBAGE", font=title, fill=CREAM)
    y += 84
    draw.text((TX, y), "RIPS", font=title, fill=MUSTARD)
    rips_w = draw.textlength("RIPS", font=title)
    draw.text((TX + rips_w + 22, y), "585", font=title, fill=CREAM)

    y += 108
    draw.line([TX, y, TX + 300, y], fill=GOLD, width=5)

    y += 32
    # The set name where we have one, so a shared rip page says which set it is
    # without ever showing the card that came out of the pack.
    tracked(draw, (TX, y), label.upper()[:26], mono, MUSTARD, 2.5)
    y += 38
    tracked(draw, (TX, y), "ROCHESTER, NY", mono, STEEL, 2.5)

    card.save(out_path, "JPEG", quality=88, optimize=True, progressive=True)
    return out_path.stat().st_size / 1024


import json

packs_dir = ROOT / "public" / "assets" / "packs"
src_dir = ROOT / "assets-source" / "packs"
names = {}
try:
    for st in json.loads(SETS.read_text())["sets"]:
        names[st["id"]] = st["name"]
except Exception:
    pass

made = []
# the site-wide card
made.append(("default", build(src_dir / "multi.png", "Pokemon pack rips", OUT)))

# one per set that has artwork, so a shared rip page shows its own wrapper
for master in sorted(src_dir.glob("*.png")):
    sid = master.stem
    if sid in ("multi",):
        continue
    dest = ROOT / "public" / "assets" / f"og-{sid}.jpg"
    made.append((sid, build(master, names.get(sid, sid.replace("-", " ")), dest)))

total = sum(k for _, k in made)
print(f"Wrote {len(made)} share cards, {total:.0f} KB total")
print(f"  site-wide: public/assets/og-image.jpg")
print(f"  per set:   public/assets/og-<set>.jpg  ({len(made) - 1} sets)")
print()
print("Rip pages used YouTube's poster frame, which is nearly always the pulled")
print("card, so sharing a rip gave the hit away. They use their set's card now.")
print()
print("Link previews cache hard. To see a change:")
print("  iMessage  quit Messages, then share the url with a ?v=N on the end")
print("  Facebook  https://developers.facebook.com/tools/debug/")
