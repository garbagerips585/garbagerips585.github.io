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
# GOLD IS GONE FROM THIS FILE AND THAT IS THE POINT OF THE EDIT. The owner: "its cool
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
INK = (0xE4, 0xDC, 0xCC)        # --ink, Trubbish body tan (was off-white)
INK_2 = (0xD4, 0xCC, 0xBC)      # --ink-2, the quieter off-white


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
    # took in ui.css: it used to be rgba(201,151,0,.18) gold, which over the owner's
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
    # It was gold here, which is the one use of gold the owner asked to remove.
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

    # A THIRD LINE WAS ADDED HERE ON 24 AUGUST 2026 AND TAKEN BACK OUT THE SAME
    # DAY. The owner had asked "should we add just a bit more text to it describing
    # the site more? or at least add in a Garbage plate on there?", saw
    # "EVERY PULL LOGGED" sitting between the label and Rochester, and said:
    # "lets actually keep the share link image exactly how you had it".
    #
    # SO THE CARD IS TWO MONO LINES AND THAT IS A DECISION NOW RATHER THAN AN
    # ABSENCE. Worth keeping because the idea is an obvious one to have again:
    # a link preview is rendered around 500px wide in a phone feed, where this
    # 25px type is about 10px, and the third line pushed the block far enough
    # down that the wordmark stopped being the thing the eye lands on. The card
    # is there to be RECOGNISED, not read. Anything that needs reading belongs
    # in the og:description, which is already carrying it.
    #
    # AND THE PLATE HALF OF THAT ASK NEVER NEEDED DOING: the pack Trubbish sits
    # on IS a plate of Garbage Plate, drawn by Unableplacebo, filling the whole
    # left half of the card.
    y += 38
    tracked(draw, (TX, y), "ROCHESTER, NY", mono, INK_2, 2.5)

    card.save(out_path, "JPEG", quality=88, optimize=True, progressive=True)
    return out_path.stat().st_size / 1024


import importlib.util
import json
import re
import unicodedata

# =========================================================================
# THE 46 PAGES WITH NO ARTWORK TO DRAW, added 21 August 2026
# =========================================================================
#
# WHAT WAS WRONG. An audit measured the whole built tree: 52 share cards, every
# one 1200x630, every one resolving, and ZERO naming the wrong set -- and 46 of
# the site's most shareable pages still falling back to assets/og-image.jpg.
# /sets/white-flare.html and /sets/celebrations.html previewed identically, and
# so did all 22 playlist pages. A set guide is the page most likely to be pasted
# into a Discord or a Reddit thread and a preview that does not say what it is
# wastes the click.
#
# WHY THEY WERE MISSED, and it is not an oversight in the loop below: the loop
# is driven by `assets-source/packs/*.png`, and a card is only illustrated
# because the SET HAS ARTWORK. There are 18 wrappers and 42 set guides. The 24
# without one, and every playlist page, have no picture to put on a card.
#
# SO THEY GET THE TYPOGRAPHIC CARD, WHICH IS build-og-pages.py's DESIGN AND IS
# IMPORTED FROM IT RATHER THAN COPIED. That file already argues this exact case
# for the 34 guide cards: "The set cards earn their artwork because a set HAS
# artwork; 'Is it worth grading?' does not, and inventing a picture for it would
# say less than the words do." A set with no wrapper is the same situation. The
# palette block at the top of this file is ALREADY a second copy of that one,
# with a note saying the two have to move together because a set card and a
# guide card sit side by side in a feed; a third copy of the whole LAYOUT would
# be that hazard again and worse, so the layout is imported. Importing it runs
# nothing: everything that writes a file over there is under `__main__`.
#
# EVERY HEADLINE IS THE PAGE'S OWN <h1>, AND THAT IS CHECKED RATHER THAN
# INTENDED. `verify()` at the foot re-opens each built page and refuses to leave
# a card whose headline is not in that page's own heading. It is the same rule
# the FAQ work of the same day is about: do not put something on a card that the
# page does not say. It is also what keeps "zero name the wrong set" true as the
# set list grows, which the audit measured and which nothing was enforcing.
#
# THE COST IN COMMITTED BINARIES WAS MEASURED BEFORE THIS WAS WRITTEN. The 52
# existing cards are 3,697KB, and they split by design: an illustrated set card
# is 115-126KB and a typographic guide card is 36-45KB, because a photograph of
# a foil wrapper does not compress and 200 words of flat type does. 46 more
# illustrated cards would have been about 5.4MB; 46 typographic ones are about
# 1.8MB. NOTHING IS ON A READER'S LOAD PATH EITHER WAY -- an og:image is fetched
# by a crawler and a chat client, never by the page -- so the whole cost is the
# repository, and it is the smaller of the two numbers.
#
# NOT IN build-all.mjs, deliberately, exactly as the rest of this file is not:
# see the note in CLAUDE.md about how a palette change here went out a day late.
# Run it by hand and look at the output before committing.


def _sibling(name):
    """Import a hyphenated sibling script. `import build-og-pages` is a syntax
    error, so the module has to be loaded by path."""
    spec = importlib.util.spec_from_file_location(
        name.replace("-", "_"), Path(__file__).resolve().parent / f"{name}.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


pages_card = _sibling("build-og-pages")

PUBLIC = ROOT / "public"
ASSETS = PUBLIC / "assets"

# TITAN ONE AND SPACE MONO HAVE NO CJK AND NO EMOJI, and both would ship as
# tofu boxes rather than as an error. Two families need this and for different
# reasons: the Japanese, Korean and Chinese guides, whose native names are the
# whole subject, and the playlist titles, which are the owner's own and carry emoji.
#
# THE INTL CARDS THEREFORE CARRY THE ENGLISH NAME, WHICH IS NOT A COMPROMISE:
# CLAUDE.md records that the one thing Google's title cut was eating on those
# pages was "English Equivalent", "which is the whole reason somebody lands on a
# Japanese or Korean set guide". The English name and the English equivalent are
# what the card is for. The native name stays on the page, where a font that can
# draw it is doing the drawing.
SPACES = "\u00a0\u2009\u202f\t\n"
QUOTES = {"\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
          "\u2013": "-", "\u2014": "-", "\u2026": "..."}


def drawable(s):
    """Drop anything the two faces cannot render, then tidy the spacing.

    Titan One and Space Mono cover Latin-1 and common punctuation and nothing
    else, and Pillow draws a missing glyph as a TOFU BOX rather than raising, so
    an unfiltered playlist title ships a card with a rectangle in the middle of
    it and nothing anywhere says so. Six of the 22 playlist titles carry emoji
    and all 13 intl guides carry a native name in a script with no glyph here."""
    out = []
    for ch in str(s):
        if ch in SPACES:
            out.append(" ")
            continue
        if ch in QUOTES:
            out.append(QUOTES[ch])
            continue
        if unicodedata.category(ch) in ("So", "Sk", "Cf", "Cs", "Co", "Cn"):
            continue                              # emoji, flags, joiners
        if ord(ch) > 0x00FF:
            continue                              # past Latin-1, no glyph
        out.append(ch)
    return re.sub(r"\s+", " ", "".join(out)).strip(" |-")


def year(iso):
    return str(iso or "")[:4]


def load(rel):
    return json.loads((PUBLIC / "data" / rel).read_text())


packs_dir = PUBLIC / "assets" / "packs"
src_dir = ROOT / "assets-source" / "packs"
names = {}
released = {}
try:
    for st in json.loads(SETS.read_text())["sets"]:
        names[st["id"]] = st["name"]
        released[st["id"]] = st.get("released")
except Exception:
    pass

made = []
# the site-wide card
made.append(("default", build(src_dir / "multi.png", "Pokemon pack rips", OUT)))

illustrated = set()
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
    illustrated.add(sid)
    made.append((sid, build(master, names.get(sid, sid.replace("-", " ")), dest)))


# ---------------------------------------------------------------- typographic

# slug -> (built page it belongs to, kicker, headline, answer)
plan = {}

# ENGLISH SET GUIDES WITH NO WRAPPER. The headline is the set's own name out of
# sets.json, which is the same string build-set-pages.mjs puts in the <h1>, and
# the card count is that file's `total` -- the two figures the page's own meta
# description leads with. No price on a card: a price is read on a day and a
# share card is cached by every chat client for months.
for st in json.loads(SETS.read_text())["sets"]:
    sid = st["id"]
    if sid in illustrated:
        continue
    page = PUBLIC / "sets" / f"{sid}.html"
    if not page.exists():
        continue                                   # no page, no card. See og-default.
    total = st.get("total")
    yr = year(st.get("released"))
    plan[sid] = (
        page,
        f"SET GUIDE, {yr}" if yr else "SET GUIDE",
        drawable(st["name"]),
        drawable(
            f"All {total} cards, every rarity, and what each one is worth"
            if total
            else "Every card in the set, and what each one is worth"
        ),
    )

# THE 13 JAPANESE, KOREAN AND CHINESE GUIDES. The answer line is the page's own
# claim and nothing more: `equivalent` names the English set only where
# `confidence` is "confirmed", which is the same gate build-intl-pages.mjs holds
# its own copy to, so a card can never assert an equivalence the page hedges.
for gid, g in load("intl-guides.json")["sets"].items():
    page = PUBLIC / "sets" / f"{gid}.html"
    if not page.exists():
        continue
    en = names.get(g.get("equivalent") or "")
    plan[gid] = (
        page,
        drawable(f"{g['langName'].upper()} SET"),
        drawable(g["english"]),
        drawable(
            f"The {g['langName']} print of English {en}"
            if en and g.get("confidence") == "confirmed"
            else f"A {g['langName']} set, every card with its English name"
        ),
    )

# THE 22 PLAYLIST PAGES. The slug is prefixed `pl-` so a playlist can never
# collide with a set id or with one of build-og-pages.py's own guide slugs, and
# the filename otherwise tracks the page's, which slugify() in shared/paths.mjs
# already produced from this same title.
# shared/paths.mjs's slugify, in Python, expression for expression. It is
# restated rather than shared because that file is ES modules and this is a
# python script, and the pair is exactly the hazard CLAUDE.md names about the
# browser, the generator and the sync agreeing on a URL: if these two disagreed
# the card would be written under a name no page ever asks for, and nothing
# would 404, because the page would quietly keep the generic card. The `verify`
# gate below catches that too, by opening the page this slug names.
_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️]")


def slugify(title):
    s = str(title).lower()
    s = _EMOJI.sub("", s)
    s = re.sub("['’]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")[:60].rstrip("-")
    return s


for pl in load("playlists.json")["playlists"]:
    slug = slugify(pl["title"])
    page = PUBLIC / "playlists" / f"{slug}.html"
    if not page.exists():
        continue
    n = pl.get("count") or len(pl.get("videoIds") or [])
    plan[f"pl-{slug}"] = (
        page,
        drawable(f"PLAYLIST • {n} RIP{'' if n == 1 else 'S'}"),
        drawable(pl["title"]),
        "Every rip in the run, in order, without leaving the site",
    )


def h1_of(html):
    m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S)
    if not m:
        return ""
    t = re.sub(r"<[^>]*>", " ", m.group(1))
    t = t.replace("&amp;", "&").replace("&nbsp;", " ").replace("&#39;", "'")
    return re.sub(r"\s+", " ", t).strip()


def verify(slug, page, headline):
    """A card must name what the page is actually about, and that is checked
    against the page rather than trusted. The comparison is the DRAWN headline
    against the page's own <h1> with the same characters dropped, because the
    h1 keeps the emoji and the accents the card cannot draw."""
    h1 = drawable(h1_of(page.read_text()))
    a = re.sub(r"[^a-z0-9]+", " ", headline.lower()).strip()
    b = re.sub(r"[^a-z0-9]+", " ", h1.lower()).strip()
    if not a or a not in b:
        raise SystemExit(
            f"build-og: og-{slug}.jpg would say {headline!r} and "
            f"{page.relative_to(PUBLIC)} is headed {h1!r}. Fix one of them."
        )


typographic = []
for slug, (page, kicker, headline, answer) in sorted(plan.items()):
    verify(slug, page, headline)
    out = pages_card.build(slug, kicker, headline, answer)
    typographic.append((slug, out.stat().st_size / 1024))

made += typographic

total = sum(k for _, k in made)
print(f"Wrote {len(made)} share cards, {total:.0f} KB total")
print(f"  site-wide:    public/assets/og-image.jpg")
print(f"  per set, art: public/assets/og-<set>.jpg  ({len(illustrated)} sets with a wrapper)")
print(f"  typographic:  {len(typographic)} more, every headline checked against the page's own h1")
print(f"                {sum(k for _, k in typographic):.0f} KB of that total")
print()
print("Rip pages used YouTube's poster frame, which is nearly always the pulled")
print("card, so sharing a rip gave the hit away. They use their set's card now.")
print()
print("Link previews cache hard. To see a change:")
print("  iMessage  quit Messages, then share the url with a ?v=N on the end")
print("  Facebook  https://developers.facebook.com/tools/debug/")
