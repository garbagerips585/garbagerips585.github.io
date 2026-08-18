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
site's darkest green with the surface bloom the rest of the brand uses. It was
navy with a gold bloom until 18 August 2026; see the colour block below.

Fonts come from .cache/fonts, which is gitignored: run scripts/fetch-fonts.sh
first if it is empty. Both faces are SIL Open Font License.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / ".cache" / "fonts"
OUT = ROOT / "public" / "assets"

W, H = 1200, 630

# SHIPPED TOKEN VALUES, read out of assets-source/ui.css's :root, same block and
# same reasoning as build-og.py: gold is semantic now and a share card is not one
# of the three places it survives, so none of these is gold. Keep the two files
# agreeing; a set card and a guide card sit next to each other in a feed.
CHROME_BG = (0x19, 0x2D, 0x22)  # --chrome-bg, the deepest of the five steps
PAPER_3 = (0x40, 0x5D, 0x49)    # --paper-3, the lightest painted surface
PINK = (0xE8, 0x7E, 0xA1)       # --brand-accent, the wordmark's RIPS
PINK_SM = (0xEE, 0xA0, 0xB9)    # --ketchup-deep, pink where the type is small
TEAL = (0x60, 0x9C, 0xBB)       # --gold. READ THE VALUE, NOT THE NAME: teal.
INK = (0xEE, 0xF1, 0xEF)        # --ink, the off-white
INK_2 = (0xC9, 0xD1, 0xCC)      # --ink-2, the quieter off-white

# slug -> (kicker, headline, one-line answer)
# The headline is the page's own H1 question wherever it has one, because that
# is the text somebody is deciding whether to click.
PAGES = {
    "start": ("NEW TO POKEMON CARDS", "Start here", "Six questions in the order they actually come up"),
    # The kicker names the reader rather than the topic. Somebody sharing this
    # link is handing it to a person who opens packs and has never played, and
    # the headline is the page's own H1 because that is the text being clicked.
    "how-to-play": ("NEVER PLAYED A GAME?", "How do you actually play?", "Setup, a turn, and the three ways to win"),
    # The two free official apps. Both headlines are the pages' own H1 questions,
    # per the note above, and both kickers name the reader's situation rather
    # than the app: somebody sharing the first one is handing it to a person with
    # a pile of code cards, and the second to a person deciding whether an app
    # can teach them the game. The app names live in the answer line, which is
    # where somebody scanning for "TCG Live" or "Pocket" will still find them.
    "tcg-live": ("EVERY PACK HAS ONE", "What is the code card?", "Pokemon TCG Live, and what the code really gets you"),
    "tcg-pocket": ("FREE, ON YOUR PHONE", "Can you learn from an app?", "What Pokemon TCG Pocket teaches you, and what it does not"),
    # The two deck pages. Both answer lines carry the measurement rather than a
    # boast, because "most played" is the only claim either page makes and a
    # share card is not the place to quietly upgrade it to "best".
    "decks": ("PASTE IT STRAIGHT IN", "Deck builds you can download", "The most played Standard decks, in TCG Live's own import format"),
    "top-100-playable": ("NOT THE PRICEY ONES", "The 100 most played cards", "Counted across hundreds of real tournament decklists"),
    # THE ANSWER LINE NAMES THE MEASUREMENT AND THE SHARE CARD IS WHERE THAT
    # MATTERS MOST. "The most valuable graded cards" is the phrase everybody
    # expects and it is the one claim this page refuses to make, because the
    # auction-record version of the list could not be sourced (PSA and Heritage
    # answer 403, Goldin serves a JS shell). A preview that overstated it would
    # undo the whole reason the page is titled the way it is.
    "top-graded": ("PRICE GUIDE, NOT HAMMER PRICE", "The highest PSA 10 values", "Ranked across 793 sets, every figure read twice"),
    "cards": ("CARD POKEDEX", "Card search", "Every card we cover, and what it is worth today"),
    "pokemon": ("CARD POKEDEX", "By Pokemon", "Every Charizard, every Umbreon, priced"),
    "fake-cards": ("DON'T GET DONE", "Real or fake?", "Eight checks, and how much each one really proves"),
    "grading": ("DO THE MATH FIRST", "Is it worth grading?", "What it costs, and whether the card clears the fee"),
    "card-shows": ("585 AND NEARBY", "Card shows", "Rochester, Buffalo and Syracuse, dates and tickets"),
    "shops": ("585", "Shops & where to play", "Local counters, league nights and prereleases"),
    "luck": ("MEASURED, NOT GUESSED", "Luck, measured", "What actually came out of the packs, counted"),
    "upcoming": ("WHAT IS NEXT", "Coming next", "The next sets, with live preorder prices"),
    "expansions": ("THE WHOLE LIST", "Every set ever", "Oldest to newest, all in one place"),
    # The two ranked price lists. Both kickers carry the honesty the pages are
    # built around, because the share card is the only part of the page most
    # people see: "ungraded" and "on TCGplayer" are the two qualifiers that stop
    # the headline being a claim the data cannot support.
    "most-valuable-cards": ("UNGRADED, EVERY LANGUAGE", "The 100 priciest cards", "PriceCharting guide values, read and dated"),
    # The two Topps pages. The kicker on the first is the whole pitch: somebody
    # sharing it is handing it to a collector who does not know these exist, and
    # the headline is the page's own H1. The second names the measurement rather
    # than the superlative, exactly as top-graded does above, because two price
    # guide columns read on one day is what it holds.
    "topps": ("NOT POKEMON TCG CARDS", "Topps made Pokemon cards too", "Eleven sets, 1999 to 2004, and some are worth thousands"),
    "topps-card-values": ("PRICE GUIDE, NOT HAMMER PRICE", "Topps card values", "Two top 100s, raw and PSA 10, every figure read twice"),
    "most-expensive-sealed": ("NOBODY OPENED THESE", "The 100 priciest sealed", "Boxes, cases and 1999 packs, dated"),
    "complete": ("PRICED LAST NIGHT", "Cost to complete a set", "Every set, three tiers, live prices"),
    "pack-prices": ("PRICED NIGHTLY", "What does a pack cost?", "Every set, box against bundle against loose pack"),
    # The other half of that question, and the answer line names the shape of
    # the page rather than the topic: "how many packs in a booster box" has a
    # thousand blog answers, and the thing nobody else prints is the ordering
    # from the 36-pack display down to the single blister with a source on each.
    "how-many-packs": ("COUNTED, NOT GUESSED", "How many packs?", "Biggest box to smallest blister, every count sourced"),
    "what-set": ("HOLDING A CARD?", "What set is this?", "Look up the number printed after the slash"),
    # The kicker does the correcting, because the misconception is the reason to
    # click: almost every "pokemon types" result is the 18-type video game chart,
    # and somebody sharing this link is usually settling exactly that argument.
    "types": ("11 ON CARDS, NOT 18", "What are the card types?", "All 11, and why there is no type chart"),
    "collection": ("THE BINDER", "The collection", "What is in it, and what it is worth"),
    "hall": ("THE GOOD ONES", "Hall of Fame", "The pulls that actually went somewhere"),
    "will-it-grade": ("BEFORE YOU PAY THE FEE", "Will it grade?", "What each company publishes, and what costs you a 10"),
    "selling": ("WHERE THE MONEY GOES", "Where to sell", "What every venue takes, and who protects a seller"),
    # The other half of the same question. The answer line names the mechanic the
    # page exists to explain rather than the topic, because "where to buy Pokemon
    # cards" is a phrase every content farm has already used and the shipping
    # arithmetic is the part nobody else prints.
    "buying": ("WHAT IT REALLY COSTS", "Where to buy", "Shipping, buyer fees, and who eats it when it is wrong"),
    # The other half of the same question. Its headline is the page's own H1 and
    # the answer line names the mechanic the page exists to explain, because
    # "where to buy Pokemon cards" is a phrase every SEO farm has already used
    # and the shipping arithmetic is the part nobody else prints.
    "buying": ("WHAT IT REALLY COSTS", "Where to buy", "Shipping, buyer fees, and who eats it when it is wrong"),
    "drops": ("NOBODY ANNOUNCES THESE", "Drops this week", "What retailers are expected to have, in store and online"),
    # The kicker is the count because the count IS the pitch: every other "all
    # the Pokemon games" list on the web is the two dozen core titles, and the
    # arcade cabinets, the Pokemon mini library and the dead phone games are
    # what this one has that they do not. The headline is the page's own H1.
    "video-games": ("EVERY SINGLE ONE", "Every Pokemon game, in order", "Covers, dates and scores, Red and Green to now"),
    # The kicker is the correction, the way the types one is. Almost every
    # evolution chart online prints a single condition per arrow, and the thing
    # this page has that they do not is that where the games disagree it says so
    # and prints all of them. The headline is the page's own H1.
    "evolution": ("THE ARROW, NOT JUST THE CHAIN", "How does it evolve?", "Every line drawn, and what each step really takes"),
    # Its own card because it is its own question. The answer line is the count,
    # because "eight, all different" is the entire pitch and it is the thing a
    # single shared chart card cannot say.
    "eevee": ("EIGHT, ALL DIFFERENT", "Every Eeveelution", "Which stone, which friendship, which time of day"),
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
    card = Image.new("RGB", (W, H), CHROME_BG)
    draw = ImageDraw.Draw(card)

    # THE BLOOM IS A SURFACE NOW, NOT AN ACCENT. It was gold, which is the
    # general-palette use Tim asked to drop; it lifts toward --paper-3 instead,
    # the same move .hof made in ui.css when its gold bloom went to the card
    # green. Still top right so the type sits on the darker half, and the
    # headline can run into it, which is why the measurement below is taken on
    # the lit ground rather than on the flat one. Blurred ellipse because Pillow
    # has no gradient and a blur is closer to how the CSS actually renders.
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W * 0.55, -H * 0.45, W * 1.25, H * 0.85], fill=140)
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    card.paste(Image.new("RGB", (W, H), PAPER_3), (0, 0), glow)

    pad = 84
    y = 96

    # The kicker is a flag rather than a route, so it is pink, and it is 26px so
    # it is the SMALL pink: #E87EA1 measures 3.45:1 on a card and the site holds
    # it to type over 24px. Same rule as .hl in ui.css.
    f_kick = font("SpaceMono.ttf", 26)
    draw.text((pad, y), kicker, font=f_kick, fill=PINK_SM)
    y += 54

    # Headline size steps down until it fits two lines. A fixed size either
    # clipped "Shops & where to play" or wasted half the card on "Start here".
    for size in (108, 96, 84, 72, 64):
        f_head = font("TitanOne.ttf", size)
        lines = wrap(draw, headline, f_head, W - pad * 2)
        if len(lines) <= 2:
            break
    # The headline is a heading, so per the accent rule it is NEITHER accent: it
    # stays off-white and lets the pink kicker above it be the only pink.
    for line in lines:
        draw.text((pad, y), line, font=f_head, fill=INK)
        y += int(size * 1.06)

    y += 18
    f_ans = font("SpaceMono.ttf", 30)
    for line in wrap(draw, answer, f_ans, W - pad * 2):
        draw.text((pad, y), line, font=f_ans, fill=INK_2)
        y += 44

    # The brand, bottom left, with the rule the site uses above section breaks so
    # the card is recognisable as ours at thumbnail size. The rule takes --gold,
    # a teal, exactly as .hof's bottom border does.
    draw.rectangle([pad, H - 128, pad + 96, H - 120], fill=TEAL)
    # DRAWN IN THREE PIECES SO RIPS IS PINK, which is what the live bar does
    # (ui.css:337). It was one cream string, so the one place a reader could
    # recognise the wordmark on these cards did not match the wordmark.
    f_brand = font("TitanOne.ttf", 38)
    bx = pad
    for word, fill in (("GARBAGE ", INK), ("RIPS", PINK), (" 585", INK)):
        draw.text((bx, H - 104), word, font=f_brand, fill=fill)
        bx += draw.textlength(word, font=f_brand)
    f_where = font("SpaceMono.ttf", 22)
    draw.text((pad + 6, H - 56), "ROCHESTER, NY", font=f_where, fill=INK_2)

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
