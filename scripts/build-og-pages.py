#!/usr/bin/env python3
"""Share cards for the guide and tool pages.

    python3 scripts/build-og-pages.py

Writes public/assets/og-<page>.jpg, one per entry in PAGES.

WHY. Eight pages all shared assets/og-image.jpg, so a link to the grading maths,
a link to the card search and a link to the show calendar all previewed as the
same picture of a booster pack. Sharing a link is how most of this site will
ever be found, and a preview that does not say what it is wastes the click.

These are typographic rather than illustrated. The set cards earn their artwork
because a set HAS artwork; "Is it worth grading?" does not, and inventing a
picture for it would say less than the words do. So each card is the page's own
question in the site's display face, with a one line answer under it, on the
site's navy with the gold bloom the rest of the brand uses.

Fonts come from .cache/fonts, which is gitignored: run scripts/fetch-fonts.sh
first if it is empty. Both faces are SIL Open Font License.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / ".cache" / "fonts"
OUT = ROOT / "public" / "assets"

W, H = 1200, 630

# Straight from ui.css, same as build-og.py.
INK = (21, 38, 58)
MUSTARD = (239, 201, 76)
GOLD = (224, 162, 31)
CREAM = (244, 241, 226)
STEEL = (159, 176, 192)

# slug -> (kicker, headline, one-line answer)
# The headline is the page's own H1 question wherever it has one, because that
# is the text somebody is deciding whether to click.
PAGES = {
    "start": ("NEW TO POKEMON CARDS", "Start here", "Six questions in the order they actually come up"),
    "cards": ("CARD POKEDEX", "Card search", "Every card we cover, and what it is worth today"),
    "pokemon": ("CARD POKEDEX", "By Pokemon", "Every Charizard, every Umbreon, priced"),
    "fake-cards": ("DON'T GET DONE", "Real or fake?", "Eight checks, and how much each one really proves"),
    "grading": ("DO THE MATHS FIRST", "Is it worth grading?", "What it costs, and whether the card clears the fee"),
    "card-shows": ("585 AND NEARBY", "Card shows", "Rochester, Buffalo and Syracuse, dates and tickets"),
    "shops": ("585", "Shops & where to play", "Local counters, league nights and prereleases"),
    "luck": ("MEASURED, NOT GUESSED", "Luck, measured", "What actually came out of the packs, counted"),
    "upcoming": ("WHAT IS NEXT", "Coming next", "The next sets, with live preorder prices"),
    "expansions": ("THE WHOLE LIST", "Every set ever", "Oldest to newest, all in one place"),
    "complete": ("PRICED LAST NIGHT", "Cost to complete a set", "Every set, three tiers, live prices"),
    "pack-prices": ("PRICED NIGHTLY", "What does a pack cost?", "Every set, box against bundle against loose pack"),
    "what-set": ("HOLDING A CARD?", "What set is this?", "Look up the number printed after the slash"),
    "collection": ("THE BINDER", "The collection", "What is in it, and what it is worth"),
    "hall": ("THE GOOD ONES", "Hall of Fame", "The pulls that actually went somewhere"),
    "will-it-grade": ("BEFORE YOU PAY THE FEE", "Will it grade?", "What each company publishes, and what costs you a 10"),
    "selling": ("WHERE THE MONEY GOES", "Where to sell", "What every venue takes, and who protects a seller"),
    # The other half of the same question. Its headline is the page's own H1 and
    # the answer line names the mechanic the page exists to explain, because
    # "where to buy Pokemon cards" is a phrase every SEO farm has already used
    # and the shipping arithmetic is the part nobody else prints.
    "buying": ("WHAT IT REALLY COSTS", "Where to buy", "Shipping, buyer fees, and who eats it when it is wrong"),
    "drops": ("NOBODY ANNOUNCES THESE", "Drops this week", "What retailers are expected to have, in store and online"),
}


def font(name, size):
    p = FONTS / name
    if not p.exists():
        raise SystemExit(f"Missing {p}.\nRun: bash scripts/fetch-fonts.sh")
    return ImageFont.truetype(str(p), size)


def wrap(draw, text, fnt, max_w):
    """Greedy wrap. Pillow has no text layout, so the headline is measured word
    by word; without this a long title runs off the right edge silently."""
    words, lines, cur = text.split(), [], ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=fnt) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def build(slug, kicker, headline, answer):
    card = Image.new("RGB", (W, H), INK)
    draw = ImageDraw.Draw(card)

    # The same gold bloom the Greatest Hits band uses, top right so the type
    # sits on the darker half. Blurred ellipse because Pillow has no gradient
    # and a blur is closer to how the CSS actually renders.
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W * 0.55, -H * 0.45, W * 1.25, H * 0.85], fill=140)
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    card.paste(Image.new("RGB", (W, H), GOLD), (0, 0), glow)

    pad = 84
    y = 96

    f_kick = font("SpaceMono.ttf", 26)
    draw.text((pad, y), kicker, font=f_kick, fill=MUSTARD)
    y += 54

    # Headline size steps down until it fits two lines. A fixed size either
    # clipped "Shops & where to play" or wasted half the card on "Start here".
    for size in (108, 96, 84, 72, 64):
        f_head = font("TitanOne.ttf", size)
        lines = wrap(draw, headline, f_head, W - pad * 2)
        if len(lines) <= 2:
            break
    for line in lines:
        draw.text((pad, y), line, font=f_head, fill=CREAM)
        y += int(size * 1.06)

    y += 18
    f_ans = font("SpaceMono.ttf", 30)
    for line in wrap(draw, answer, f_ans, W - pad * 2):
        draw.text((pad, y), line, font=f_ans, fill=STEEL)
        y += 44

    # The brand, bottom left, with the gold rule the site uses above section
    # breaks so the card is recognisable as ours at thumbnail size.
    draw.rectangle([pad, H - 128, pad + 96, H - 120], fill=GOLD)
    f_brand = font("TitanOne.ttf", 38)
    draw.text((pad, H - 104), "GARBAGE RIPS 585", font=f_brand, fill=CREAM)
    f_where = font("SpaceMono.ttf", 22)
    draw.text((pad + 6, H - 56), "ROCHESTER, NY", font=f_where, fill=STEEL)

    out = OUT / f"og-{slug}.jpg"
    card.save(out, "JPEG", quality=86, optimize=True)
    return out


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    made = []
    for slug, (kicker, headline, answer) in PAGES.items():
        p = build(slug, kicker, headline, answer)
        made.append((p.name, p.stat().st_size))
    print(f"Wrote {len(made)} share cards to public/assets/")
    for name, size in made:
        print(f"  {name:<26} {size / 1024:5.0f}KB")
