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

# SHIPPED TOKEN VALUES, read out of assets-source/ui.css's :root on 18 August
# 2026 rather than re-derived here. Every name below is the token it copies, so
# a later palette move is a re-read of that block and nothing else. The site was
# repainted "Trubbish Deep" in d2b31551 and these cards were not, so a link
# preview was navy while the page it opened was green.
#
# GOLD IS GONE FROM THIS FILE AND THAT IS THE POINT OF THE EDIT. Tim: "its cool
# to keep the hall of fame gold, but just not use that color in the general
# pallet of the site colors." The old card spent gold three times, on the bloom,
# on the rule and on the wordmark's RIPS, and all three are exactly the general
# -palette use he pulled back. Gold now means one thing on this site, "the best
# card this channel has ever pulled", and it survives only on the Hall of Fame
# badge, the trophy frame and /hall.html's medallion. A share card is none of
# those, so it carries none of it.
CHROME_BG = (0x19, 0x2D, 0x22)  # --chrome-bg, the deepest of the five steps
PAPER_3 = (0x40, 0x5D, 0x49)    # --paper-3, the lightest painted surface
PINK = (0xE8, 0x7E, 0xA1)       # --brand-accent, and it is what RIPS wears live
PINK_SM = (0xEE, 0xA0, 0xB9)    # --ketchup-deep, pink where the type is small
TEAL = (0x60, 0x9C, 0xBB)       # --gold. READ THE VALUE, NOT THE NAME: teal.
INK = (0xEE, 0xF1, 0xEF)        # --ink, the off-white
INK_2 = (0xC9, 0xD1, 0xCC)      # --ink-2, the quieter off-white


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
    card = Image.new("RGB", (W, H), CHROME_BG)
    draw = ImageDraw.Draw(card)

    # THE BLOOM IS A SURFACE NOW, NOT AN ACCENT, and that is the same fix .hof
    # took in ui.css: it used to be rgba(201,151,0,.18) gold, which over Tim's
    # green reads olive, and it is now the CARD colour lifting out of the chrome.
    # Here it is --paper-3, one step lighter still, because it has to separate a
    # dark pack wrapper from a dark ground rather than just tint a band. Painting
    # an accent across a third of the card is decoration, which is the job the
    # accents no longer do. Drawn as a blurred ellipse because Pillow has no
    # gradient primitive and a blur is closer to how the CSS actually renders.
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W * 0.02, -H * 0.55, W * 0.62, H * 0.95], fill=150)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    card.paste(Image.new("RGB", (W, H), PAPER_3), (0, 0), glow)

    # Faint dot field, so the flat green has some texture at full size.
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
    draw.text((TX, y), "GARBAGE", font=title, fill=INK)
    y += 84
    # RIPS IS PINK BECAUSE THE LIVE WORDMARK IS PINK. ui.css:337 is
    # `.brand b i{color:var(--brand-accent)}` and --brand-accent is #E87EA1, so
    # the bar a reader lands on and the card they clicked now say the same thing.
    # It was gold here, which is the one use of gold Tim asked to remove.
    draw.text((TX, y), "RIPS", font=title, fill=PINK)
    rips_w = draw.textlength("RIPS", font=title)
    draw.text((TX + rips_w + 22, y), "585", font=title, fill=INK)

    y += 108
    # A rule is a keyline, not a heading and not a route, so it takes the same
    # token .hof's bottom border does: --gold, which resolves to a teal.
    draw.line([TX, y, TX + 300, y], fill=TEAL, width=5)

    y += 32
    # The set name where we have one, so a shared rip page says which set it is
    # without ever showing the card that came out of the pack. Pink because it is
    # a mark that goes nowhere, and the SMALL pink at 25px: #E87EA1 is 3.45:1 on
    # a card and the site reserves it for type over 24px.
    tracked(draw, (TX, y), label.upper()[:26], mono, PINK_SM, 2.5)
    y += 38
    tracked(draw, (TX, y), "ROCHESTER, NY", mono, INK_2, 2.5)

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
    # default.png is a second copy of the generic wrapper, not a set, so it used
    # to write an og-default.jpg that no page has ever pointed at. The launch QA
    # pass (8ee92f88) deleted that file without stopping the script from writing
    # it again, so the next run quietly put the orphan back. Skipped here now.
    if sid in ("multi", "default"):
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
