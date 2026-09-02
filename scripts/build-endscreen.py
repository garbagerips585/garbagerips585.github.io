#!/usr/bin/env python3
"""Lay out the Garbage Rips 585 end screen for the Shorts.

    python3 scripts/build-endscreen.py

Writes assets-source/endscreen/, which is NOT deployed. Like the sticker beside
it this is an asset for the OWNER, not for the site, and it never enters public/.

WHAT THIS IS AND IS NOT. YouTube's End Screen FEATURE -- the clickable subscribe
bubble and video cards you add in Studio -- does not exist on Shorts, and 319 of
the 331 videos on this channel are Shorts. So an end screen here is a FRAME OF
THE VIDEO, dropped into the edit for the last few seconds, and nothing on it is
clickable. That is why the url is set as large as it is: reading it and typing
it later is the only route it has.

THE BOTTOM THIRD OF A SHORT BELONGS TO YOUTUBE, AND THAT IS THE WHOLE REASON
THIS FILE EXISTS. The previous end card was measured in situ on 2 September 2026
-- the real Short W1FHYQ8cWlU, paused at 50.0s of 50.5s, on m.youtube.com at
375x812 -- and its channel wordmark, the words "Garbage Rips 585", came out
BISECTED by YouTube's own @GarbageRips585 row and Subscribe pill. The four
reaction mascots along the bottom were half covered by the same bar. Every
element's box was then read out of the page and expressed as a percentage of the
video, because a percentage is the only form of this measurement that survives a
change of phone:

    right action rail, three white circles       left 87.2%, 74.2% -> 95.0% down
    Subscribe pill, opaque rgb(241,241,241)      98.2% down
    channel row @GarbageRips585                  99.9% down
    title                                        below the video entirely

TWO LINES, NOT ONE, BECAUSE THE SCRIM AND THE CHROME ARE NOT THE SAME THING.
The first pass of this file used a single 68.8% line, which is where YouTube's
bottom GRADIENT begins, and it was too cautious by a third of the frame. That
gradient is a dark translucent wash, and everything on this card is light type
on a dark ground: a dark wash over light-on-dark costs nothing. What actually
destroyed the old end card was the OPAQUE chrome -- a white Subscribe pill and
white channel text sitting on his artwork -- and that starts at 98.2%. So the
rule is opacity, not the scrim, and re-measuring for the opaque boxes above is
what freed the room the bullet list now sits in.

THE 85% LINE IS THE APP ALLOWANCE AND IS NOT MEASURED. All of the above is
mobile WEB, which parks the channel row just below the video; the iOS and
Android apps overlay it ON the video and stack the title onto a second line, and
I cannot measure those from here. 85% leaves the bottom 288px of a 1920 frame
for a block that occupies roughly 10% on web. It is a judgement, it is labelled
as one, and it is deliberately generous.

And a Short is also watched on DESKTOP, where none of this chrome overlaps the
video at all. A design that clears the mobile band is correct in both places.

NOTHING THAT MATTERS IS PLACED BELOW IT, and the assertion at the bottom of this
file fails the build rather than trusting me to have kept to it.

THE DEAD ZONE IS SPENT ON ARTWORK, WHICH IS THE ONE THING IT IS GOOD FOR. The
bottom 620px cannot hold a word, so it holds Trubbish's own background, zoomed
and dimmed. YouTube's chrome then sits on a dark wash rather than over type.
"""
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "public/assets/banner-trubbish.jpg"
OUT = ROOT / "assets-source/endscreen"
FONTS = ROOT / "assets-source/print-fonts"

W, H = 1080, 1920                     # what a Short is

# ------------------------------------------------- the measured Shorts chrome
SCRIM_TOP = round(H * 0.688)          # 1322. The gradient. Harmless to light type.
CRIT = round(H * 0.85)                # 1632. Opaque chrome, with the app allowance.
RAIL_X = round(W * 0.872)             # 942. Left edge of the like/comment/share rail.
RAIL_T = round(H * 0.742)             # 1424
RAIL_B = round(H * 0.950)             # 1824
SAFE_TOP = 96                         # the app's own top row
MARGIN = 60

# ---------------------------------------------------------------- the palette
# Read out of ui.css BY NAME, never typed in, exactly as build-sticker.py and
# build-og.py do. CLAUDE.md is emphatic about why: the token names on this site
# do not mean their colours (every "mustard" is a teal, "trubbish" is a near
# black) and a hex copied by hand stops tracking the site at the next repaint.
def tokens():
    css = (ROOT / "assets-source/ui.css").read_text(encoding="utf-8")
    want = ["ink", "ink-2", "page", "chrome-bg", "band-bg", "paper-2",
            "keyline", "mustard", "brand-accent", "on-accent", "trubbish"]
    out = {}
    for name in want:
        m = re.search(rf"--{name}:\s*(#[0-9A-Fa-f]{{6}})", css)
        if not m:
            raise SystemExit(f"ui.css has no --{name}; read the stylesheet before editing this list")
        out[name] = tuple(int(m.group(1)[i:i + 2], 16) for i in (1, 3, 5))
    return out

# THE ONE COLOUR NOT TAKEN FROM A TOKEN, and it is deliberate. ui.css fixes the
# Subscribe red at #EE0000 rather than YouTube's #FF0000, because white on
# #FF0000 is 4.00:1 and fails AA for normal text while #EE0000 clears it at
# 4.53:1. It is a literal there and a literal here for the same reason: it is a
# borrowed brand colour that must not follow this site's palette anywhere.
YT_RED = (0xEE, 0x00, 0x00)


def counts():
    """WHAT THE SITE ACTUALLY HAS, COUNTED, so the list cannot go stale.

    The owner asked for "a little breakdown of the top things on the site". Every
    line below is a number this repo can produce on demand rather than a number I
    typed once: he publishes a rip a DAY, so a hand written "331 rips" is wrong by
    tomorrow, and a wrong count on a card that goes out to every viewer is worse
    than no count. Regenerating the end screen re-reads them.

    The printings total is the exception and is quoted, not counted: it is the
    figure build-cards.mjs prints on /cards.html, so this card and that page
    cannot disagree. If the regex stops matching, that is a real change and this
    stops rather than guessing.
    """
    import glob, re
    c = {
        "dex": len(glob.glob(str(ROOT / "public/pokemon/*.html"))),
        "sets": len(glob.glob(str(ROOT / "public/sets/*.html"))),
    }
    m = re.search(r"([\d,]{5,})\s+Pokemon card printings",
                  (ROOT / "public/cards.html").read_text(encoding="utf-8"))
    if not m:
        raise SystemExit("cards.html no longer prints an 'N Pokemon card printings' "
                         "total; read that page and update this before shipping a number")
    c["printings"] = m.group(1)
    for k in ("dex", "sets"):
        if not c[k]:
            raise SystemExit(f"counted zero {k} in public/; build the site first")
    return c


def heart(size, fill):
    """A heart, drawn rather than found, at 4x and downsampled for clean edges.

    IT IS A HEART AND NOT A THUMB BECAUSE THAT IS WHAT THE VIEWER IS LOOKING AT.
    YouTube's like control on a Short is a HEART -- it was measured on the rail
    above, the first of the three white circles -- so a thumbs up would be
    pointing at a button that does not exist on this surface. The old card had a
    thumb, which is Facebook's.
    """
    S = 4
    d_ = size * S
    im = Image.new("RGBA", (d_, d_), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    r = d_ * 0.27
    dr.ellipse([d_ * .5 - r * 2, d_ * .10, d_ * .5, d_ * .10 + r * 2], fill=fill)
    dr.ellipse([d_ * .5, d_ * .10, d_ * .5 + r * 2, d_ * .10 + r * 2], fill=fill)
    dr.polygon([(d_ * .5 - r * 2, d_ * .40), (d_ * .5 + r * 2, d_ * .40),
                (d_ * .5, d_ * .93)], fill=fill)
    return im.resize((size, size), Image.LANCZOS)


def font(name, size, weight=None):
    """Load a print font, and NAME THE WEIGHT when the file is a variable font.

    OUTFIT.TTF IS VARIABLE AND ITS DEFAULT AXIS VALUE IS 100, WHICH IS THIN.
    ImageFont.truetype() applies no instance of its own, so asking for "Outfit"
    and drawing with it silently gives the lightest weight the family has --
    hairline type that looks like a rendering fault rather than a choice. It is
    not a broken font and there is no error to catch; the only tell is that the
    result looks wrong, which is a poor way to find out. Every other font in this
    directory is static, so this bites exactly one caller today.
    """
    from PIL import ImageFont
    f = ImageFont.truetype(str(FONTS / name), size)
    if weight is not None:
        f.set_variation_by_axes([weight])
    return f


def shadowed(card, box, radius, fill, outline, shadow, drop=10):
    """A panel with the site's flat drop shadow. ui.css draws every card as
    `0 6px 0 var(--trubbish)` -- an offset solid, never a blur -- so the same
    shape is used here and the end screen reads as the same object family as
    the pages."""
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(card)
    d.rounded_rectangle([x0, y0 + drop, x1, y1 + drop], radius, fill=shadow)
    d.rounded_rectangle([x0, y0, x1, y1], radius, fill=fill,
                        outline=outline, width=4)


def centre(d, text, f, cy, fill, cx=W // 2):
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    d.text((cx - (r - l) / 2 - l, cy - (b - t) / 2 - t), text, font=f, fill=fill)
    return b - t


def build():
    C = tokens()
    art = Image.open(ART).convert("RGB")

    # ------------------------------------------------------------ the ground
    # The art zoomed to COVER 1080x1920 rather than fit it, then blurred and
    # dimmed hard. It is the same drawing as the panel above it, which is the
    # point: the frame is all Trubbish, and the half YouTube covers costs
    # nothing because it never held a word.
    s = max(W / art.width, H / art.height)
    bg = art.resize((round(art.width * s), round(art.height * s)), Image.LANCZOS)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2,
                  (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
    bg = bg.filter(ImageFilter.GaussianBlur(26))

    # THE WASH IS A RAMP, NOT ONE VALUE, AND BOTH ENDS ARE DOING A JOB. A flat
    # 74% green over the whole frame was the first pass and the bottom third
    # came out a dead grey slab -- which is the opposite of the intent, since
    # that zone exists to be artwork. So the green is 62% at the top, where the
    # wordmark needs a calm ground to sit on, and 88% at the bottom, where
    # YouTube paints its own white channel name and title. Darkening the ground
    # under someone else's text is the one thing this frame can do for it.
    veil = Image.new("RGB", (W, H), C["page"])
    ramp = Image.linear_gradient("L").resize((W, H))          # 0 at top, 255 at foot
    ramp = ramp.point(lambda v: round(158 + v * (224 - 158) / 255))
    card = Image.composite(veil, bg, ramp)   # 255 in the mask means all veil
    d = ImageDraw.Draw(card)

    # ------------------------------------------------------------- the wordmark
    f_mark = font("TitanOne.ttf", 92)
    f_tag = font("SpaceMono-b.ttf", 31)
    y = SAFE_TOP + 46
    # GARBAGE and 585 are ink, RIPS is --brand-accent. That split is not a
    # flourish: it is how .brand b i renders the wordmark in the site header, so
    # the last frame of a Short and the top of garbagerips.com carry one mark.
    parts = [("GARBAGE ", C["ink"]), ("RIPS", C["brand-accent"]), (" 585", C["ink"])]
    mw = sum(d.textlength(t, font=f_mark) for t, _ in parts)
    x = (W - mw) / 2
    for t, col in parts:
        d.text((x, y), t, font=f_mark, fill=col)
        x += d.textlength(t, font=f_mark)
    y += 118
    centre(d, "POKEMON PACK RIPS FROM ROCHESTER, NY", f_tag, y + 14, C["ink-2"])
    y += 62

    # ----------------------------------------------------------- the mascot
    # CROPPED, not letterboxed. The source is 1300x725 and dropping it in whole
    # would put Trubbish at a third of the width on a frame that has to read in
    # about two seconds. The crop keeps him, the plate, both Garbage Rips packs
    # and enough skyline to still say Rochester, and drops the empty bench on
    # the far left. 920px of source into 960px of panel is a 4% upscale.
    #
    # 600 TALL AND NOT 663, WHICH THE GUARD BELOW DECIDED RATHER THAN I DID. The
    # first pass ran the stack to y=1343, 44px into YouTube's channel row, and
    # the panel is the one element with slack to give.
    CW, CH = 960, 600
    crop = art.crop((260, 96, 1180, 671)).resize((CW, CH), Image.LANCZOS)
    px, py = (W - CW) // 2, y
    shadowed(card, (px - 6, py - 6, px + CW + 6, py + CH + 6), 26,
             C["paper-2"], C["keyline"], C["trubbish"], drop=12)
    card.paste(crop, (px, py))
    d.rounded_rectangle([px - 6, py - 6, px + CW + 6, py + CH + 6], 26,
                        outline=C["keyline"], width=5)
    y = py + CH + 58

    # ------------------------------------------------------------- the asks
    # LIKE takes --mustard (a TEAL) because CLAUDE.md's accent rule is that teal
    # is every button fill on this site. SUBSCRIBE is the borrowed red above,
    # matching the pill in the site header. Two pills and no more: at a median
    # 22 seconds a Short's end card is read in a glance, and the previous one
    # asked for a like, a subscribe, a bell and a channel name at once.
    f_pill = font("TitanOne.ttf", 56)
    PH, GAP = 124, 30
    lw = (W - MARGIN * 2 - GAP) * 0.42
    sw = (W - MARGIN * 2 - GAP) - lw
    lx = MARGIN
    shadowed(card, (lx, y, lx + lw, y + PH), PH // 2, C["mustard"], C["trubbish"], C["trubbish"])
    # The heart and the word are centred AS A GROUP, not each in its own half:
    # centring them separately leaves a hole down the middle of a pill this wide.
    HS, HG = 58, 20
    tw_ = d.textlength("LIKE", font=f_pill)
    gx = lx + (lw - (HS + HG + tw_)) / 2
    hi = heart(HS, C["on-accent"])
    card.paste(hi, (round(gx), round(y + (PH - HS) / 2 + 2)), hi)
    centre(d, "LIKE", f_pill, y + PH / 2 - 4, C["on-accent"], cx=gx + HS + HG + tw_ / 2)
    sx = lx + lw + GAP
    shadowed(card, (sx, y, sx + sw, y + PH), PH // 2, YT_RED, C["trubbish"], C["trubbish"])
    centre(d, "SUBSCRIBE", f_pill, y + PH / 2 - 4, (255, 255, 255), cx=sx + sw / 2)
    y += PH + 54

    # --------------------------------------------------------------- the url
    # The biggest single line on the frame, and the reason the layout is as
    # spare as it is. Teal, because the accent rule holds that teal is every
    # ROUTE, and a url is the most route-like thing there is.
    f_url = font("SpaceMono-b.ttf", 74)
    UH = 122
    shadowed(card, (MARGIN, y, W - MARGIN, y + UH), 22,
             C["band-bg"], C["mustard"], C["trubbish"])
    centre(d, "GARBAGERIPS.COM", f_url, y + UH / 2, C["mustard"])
    bottom = y + UH

    # ----------------------------------------------------------- the breakdown
    # The owner: "under the GarbageRips.com button can you add a little breakdown
    # of the top things on the site little bullet points, just so people know
    # what the site has? Only need to list the top 5-6 things, one of them can be
    # the New Pack Rip Everyday which you already have."
    #
    # SIX LINES, AND EVERY NUMBER IN THEM IS COUNTED AT BUILD TIME. See counts().
    # The order is the site's own primary nav -- Rips, Best pulls, Local scene,
    # Card search, Start here -- because that ordering is already an answer to
    # "what does this site have", decided once and not re-litigated on a sticker.
    #
    # THIS BLOCK IS THE REASON THE 68.8% LINE HAD TO BE RE-EXAMINED rather than
    # worked around. Squeezed above it, the list would have cost the mascot
    # roughly 180px of height, and he is the thing the owner asked to build this
    # around. Measuring what is actually opaque put the list in clear air with
    # the artwork untouched.
    N = counts()
    # HIS WORDING AND HIS ORDER, 2 September 2026, typed out in full and not
    # paraphrased. He rewrote the list I had proposed: the rip COUNT came out and
    # "a new pack rip video every day" went in, the Garbage Plate went in, and
    # Rochester moved to second. The only thing done to his lines is that the
    # three numbers are substituted rather than typed -- all three of his figures
    # matched what counts() reads today, so nothing on screen changes, but the
    # card can no longer drift from the site as pages are added.
    #
    # "GARBAGE PLATE DIRECTORY" IS A FAIR NAME FOR IT AND WAS CHECKED. It is the
    # "Where to eat one" section of /garbage-plate.html, eleven named places from
    # Nick Tahou Hots to Rohrbach, with a further list of the ones checked and
    # left off. It is a section of an explainer rather than a page of its own,
    # which is worth knowing if the wording is ever revisited.
    bullets = [
        "A new pack rip video every day",
        "Rochester, NY card shops + card show calendar",
        "Garbage Plate directory",
        f"{N['sets']:,} Pokemon card set guides",
        f"Search {N['printings']} Pokemon card printings",
        f"{N['dex']:,} Pokemon card pages",
    ]
    # OUTFIT AND NOT SPACE MONO, AND THE NEW LIST IS WHY. CLAUDE.md assigns Space
    # Mono to labels and tickers and Outfit to body, and six sentences in mixed
    # case are body copy, not labels. It is also the only way they FIT: Space
    # Mono is monospaced, so his longest line ("Rochester, NY card shops + card
    # show calendar", 44 characters) measures 1035px at the old 37px and would
    # have to drop to 30px to clear the action rail. Outfit sets the same line in
    # 805px at 38px, so the list got bigger by changing typeface rather than
    # smaller by keeping one.
    # 600, which is the weight ui.css sets body copy in.
    f_b = font("Outfit.ttf", 38, weight=600)
    bx, by, STEP = MARGIN + 34, 1338, 50
    for i, line in enumerate(bullets):
        cy = by + i * STEP
        # The marker is PINK because CLAUDE.md's accent rule is that pink is every
        # mark that GOES NOWHERE and teal is every route. A bullet goes nowhere.
        d.ellipse([bx - 34, cy - 7, bx - 20, cy + 7], fill=C["brand-accent"])
        l, t, r, b = d.textbbox((0, 0), line, font=f_b)
        d.text((bx, cy - (b - t) / 2 - t), line, font=f_b, fill=C["ink-2"])
        # NOTHING MAY REACH THE ACTION RAIL. The three like/comment/share circles
        # occupy the right 12.8% from 74.2% to 95.0% down, which every one of
        # these lines is level with. A long line would run under the Share icon.
        if cy > RAIL_T and bx + (r - l) > RAIL_X - 16:
            raise SystemExit(
                f'"{line}" is {bx + (r - l):.0f}px wide and reaches YouTube\'s '
                f"action rail at x={RAIL_X}. Shorten it or drop the type size.")
    listbottom = by + (len(bullets) - 1) * STEP + 22

    # THE GUARD, and it is the point of the whole file. A future edit that grows
    # the art, the type or a pill pushes the url under YouTube's channel row and
    # nothing about the PNG would look wrong -- it only fails on a phone, which
    # is where nobody is looking. So it fails here instead.
    bottom = max(bottom, listbottom)
    if bottom > CRIT:
        raise SystemExit(
            f"the stack ends at y={bottom:.0f}, past the {CRIT}px line ({CRIT/H:.0%} "
            f"of {H}) where YouTube's opaque chrome is allowed for. Shrink something.")

    OUT.mkdir(parents=True, exist_ok=True)
    card.save(OUT / "garbage-rips-endscreen.png")

    # A SECOND FILE WITH THE CHROME DRAWN ON IT, because the owner has to be able
    # to check this himself rather than take my word for where the bar is. It
    # shows BOTH zones, because they are not the same and conflating them is the
    # mistake the first version of this file made:
    #   amber  the gradient scrim. Dark, translucent. Light type survives it.
    #   red    the opaque chrome and the action rail. Nothing may go here.
    # It is a proof, not a deliverable. Do not upload this one.
    g = card.copy()
    gd = ImageDraw.Draw(g, "RGBA")
    gd.rectangle([0, SCRIM_TOP, W, H], fill=(255, 176, 0, 46))
    gd.rectangle([0, CRIT, W, H], fill=(238, 0, 0, 92))
    gd.rectangle([RAIL_X, RAIL_T, W, RAIL_B], fill=(238, 0, 0, 92))
    f_g = font("SpaceMono-b.ttf", 27)
    for yy, lab in ((SCRIM_TOP, "SCRIM STARTS. A DARK WASH, LIGHT TYPE SURVIVES IT"),
                    (CRIT, "OPAQUE CHROME ALLOWANCE. NOTHING BELOW THIS LINE")):
        gd.line([0, yy, W, yy], fill=(255, 255, 255), width=4)
        gd.text((MARGIN, yy + 14), lab, font=f_g, fill=(255, 255, 255))
    gd.text((RAIL_X - 316, RAIL_T + 14), "ACTION RAIL ->", font=f_g, fill=(255, 255, 255))
    g.save(OUT / "garbage-rips-endscreen-safe-area.png")

    print(f"  canvas   {W}x{H}")
    print(f"  content  ends y={bottom:.0f}, {CRIT - bottom:.0f}px of clearance")
    print(f"  wrote    {OUT}/garbage-rips-endscreen.png and -safe-area.png")


if __name__ == "__main__":
    build()
