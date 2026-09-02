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
    want = ["ink", "ink-2", "page", "chrome-bg", "band-bg", "paper-2", "keyline",
            "mustard", "brand-accent", "ketchup-deep", "on-accent", "trubbish"]
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


def bell(size, fill):
    """A notification bell, built from primitives the same way heart() is.

    The owner: "can you also add a little bell icon in the subscribe button,
    thats meant for subscribe and turn on notifications ... same way you added
    the heart to the like button."

    IT IS THE BELL AND NOT THE SUBSCRIBED-BELL. YouTube's own control is a bell
    that only appears AFTER somebody subscribes, so this is an invitation rather
    than a picture of a button on screen -- which is the same reason the heart is
    a heart: it points at the control the viewer actually has.

    Drawn at 4x and downsampled, because a shape assembled from ellipses and a
    polygon has hard edges that alias badly at icon size.
    """
    S = 4
    d_ = size * S
    im = Image.new("RGBA", (d_, d_), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    dr.ellipse([d_ * .44, d_ * .04, d_ * .56, d_ * .16], fill=fill)   # the handle
    dr.pieslice([d_ * .24, d_ * .10, d_ * .76, d_ * .62], 180, 360, fill=fill)
    dr.polygon([(d_ * .24, d_ * .36), (d_ * .76, d_ * .36),
                (d_ * .90, d_ * .70), (d_ * .10, d_ * .70)], fill=fill)
    dr.rounded_rectangle([d_ * .06, d_ * .66, d_ * .94, d_ * .78], d_ * .06, fill=fill)
    dr.ellipse([d_ * .41, d_ * .81, d_ * .59, d_ * .99], fill=fill)   # the clapper
    return im.resize((size, size), Image.LANCZOS)


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
        "rips": len(glob.glob(str(ROOT / "public/rip/*.html"))),
        "dex": len(glob.glob(str(ROOT / "public/pokemon/*.html"))),
        "sets": len(glob.glob(str(ROOT / "public/sets/*.html"))),
    }
    # THE DROPS PAGE IS THE ONE CLAIM ON THIS CARD WITH AN EXPIRY DATE. Every
    # other line is true whenever it is read; "weekly retailer drops" is only true
    # while somebody is still compiling them. data/drops.json carries the week it
    # covers, so the card refuses to make the claim once that week is well past
    # rather than promising a stranger a page that has quietly stopped.
    import json, datetime
    dj = json.loads((ROOT / "data/drops.json").read_text(encoding="utf-8"))
    week = datetime.date.fromisoformat(dj["weekEnds"])
    stale = (datetime.date.today() - week).days
    if stale > 14:
        raise SystemExit(
            f"data/drops.json covers the week ending {week}, {stale} days ago, and "
            f"the card claims WEEKLY retailer drops. Refresh the drops data, or "
            f"take that bullet out before regenerating.")
    c["retailers"] = len(dj.get("retailers") or [])

    m = re.search(r"([\d,]{5,})\s+Pokemon card printings",
                  (ROOT / "public/cards.html").read_text(encoding="utf-8"))
    if not m:
        raise SystemExit("cards.html no longer prints an 'N Pokemon card printings' "
                         "total; read that page and update this before shipping a number")
    c["printings"] = m.group(1)
    for k in ("rips", "dex", "sets"):
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
    y = SAFE_TOP + 24
    # GARBAGE and 585 are ink, RIPS is --brand-accent. That split is not a
    # flourish: it is how .brand b i renders the wordmark in the site header, so
    # the last frame of a Short and the top of garbagerips.com carry one mark.
    parts = [("GARBAGE ", C["ink"]), ("RIPS", C["brand-accent"]), (" 585", C["ink"])]
    mw = sum(d.textlength(t, font=f_mark) for t, _ in parts)
    x = (W - mw) / 2
    for t, col in parts:
        d.text((x, y), t, font=f_mark, fill=col)
        x += d.textlength(t, font=f_mark)
    y += 112
    centre(d, "POKEMON PACK RIPS FROM ROCHESTER, NY", f_tag, y + 14, C["ink-2"])
    y += 54

    # ----------------------------------------------------------- the mascot
    # CROPPED, not letterboxed. The source is 1300x725 and dropping it in whole
    # would put Trubbish at a third of the width on a frame that has to read in
    # about two seconds. The crop keeps him, the plate, both Garbage Rips packs
    # and enough skyline to still say Rochester, and drops the empty bench on
    # the far left. 920px of source into 960px of panel is a 4% upscale.
    #
    # THE PANEL STAYS THE FULL CONTENT WIDTH, and the sign-off was paid for out of
    # the gaps instead. Narrowing it to 860 was the first attempt and it looked
    # wrong for a reason worth writing down: the pills and the url band below are
    # 960, so the picture became the NARROWEST thing in a stack it is supposed to
    # lead, and the bullets -- which cannot move right without running into the
    # action rail -- then started outside its left edge. One content width, and
    # the 63px came off the spacing between things rather than out of Trubbish.
    #
    # Adding room by moving the safe-area line was the other option and was
    # refused: that line is an allowance for phones I cannot measure, and
    # spending it to fit more copy is how a guard quietly stops meaning anything.
    CW = 960
    CH = round(CW * 575 / 920)
    crop = art.crop((260, 96, 1180, 671)).resize((CW, CH), Image.LANCZOS)
    px, py = (W - CW) // 2, y
    shadowed(card, (px - 6, py - 6, px + CW + 6, py + CH + 6), 26,
             C["paper-2"], C["keyline"], C["trubbish"], drop=12)
    card.paste(crop, (px, py))
    d.rounded_rectangle([px - 6, py - 6, px + CW + 6, py + CH + 6], 26,
                        outline=C["keyline"], width=5)
    y = py + CH + 38

    # ------------------------------------------------------------- the asks
    # LIKE takes --mustard (a TEAL) because CLAUDE.md's accent rule is that teal
    # is every button fill on this site. SUBSCRIBE is the borrowed red above,
    # matching the pill in the site header. Two pills and no more: at a median
    # 22 seconds a Short's end card is read in a glance, and the previous one
    # asked for a like, a subscribe, a bell and a channel name at once.
    f_pill = font("TitanOne.ttf", 56)
    PH, GAP = 124, 30
    # 0.39, NOT 0.42, BECAUSE THE SECOND PILL GREW AN ICON. At the old split the
    # two pills had 95px and 69px of internal padding, so the wider one looked
    # more crowded than the narrow one sitting next to it. 0.39 puts them at 81
    # and 83. The pills are still different widths, which is right -- SUBSCRIBE
    # is the longer word and the more important ask.
    lw = (W - MARGIN * 2 - GAP) * 0.39
    sw = (W - MARGIN * 2 - GAP) - lw
    lx = MARGIN
    shadowed(card, (lx, y, lx + lw, y + PH), PH // 2, C["mustard"], C["trubbish"], C["trubbish"])
    # The heart and the word are centred AS A GROUP, not each in its own half:
    # centring them separately leaves a hole down the middle of a pill this wide.
    HS, HG = 58, 20

    def pill(x0, width, ink, word, icon, dy=2):
        """Icon and word centred AS A GROUP, not each in its own half: centring
        them separately leaves a hole down the middle of a pill this wide."""
        tw_ = d.textlength(word, font=f_pill)
        gx = x0 + (width - (HS + HG + tw_)) / 2
        gl = icon(HS, ink)
        card.paste(gl, (round(gx), round(y + (PH - HS) / 2 + dy)), gl)
        centre(d, word, f_pill, y + PH / 2 - 4, ink, cx=gx + HS + HG + tw_ / 2)

    pill(lx, lw, C["on-accent"], "LIKE", heart)
    sx = lx + lw + GAP
    shadowed(card, (sx, y, sx + sw, y + PH), PH // 2, YT_RED, C["trubbish"], C["trubbish"])
    pill(sx, sw, (255, 255, 255), "SUBSCRIBE", bell, dy=0)
    y += PH + 38

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
    # THE GARBAGE PLATE LINE IS NOW THE ACCURATE ONE, and he corrected it rather
    # than me. It read "Garbage Plate directory"; when that went in I checked the
    # page and noted that the directory is the "Where to eat one" SECTION of an
    # explainer -- eleven named places from Nick Tahou Hots to Rohrbach, plus the
    # ones checked and left off -- rather than a page of its own. He came back
    # with "Garbage Plate 101 & Directory", which describes both halves of that
    # page instead of only the smaller one. Do not shorten it back.
    # THE HIT RATE LINE, ADDED 2 SEPTEMBER 2026: "should we change one of the
    # bullet points to be something about the stats from my rips, like view my hit
    # rates per set or something like that?"
    #
    # IT POINTS AT A PAGE THAT REALLY DOES THIS, WHICH WAS CHECKED FIRST.
    # /luck.html is "Luck, measured: What Came Out of 331 Rips" and its third
    # section is literally "Which sets have been kind", a per-set hit rate table.
    # Worth knowing if the wording is ever tightened: that page does NOT rate
    # every set. It withholds a number below 12 answered rips, in its own words
    # because "at that size it would be noise dressed up as a fact". "Hit rates by
    # set" is a fair name for the table; it is not a promise of a row per set.
    #
    # THE NUMBER IS COUNTED OFF DISK AND NOT LIFTED OFF THAT PAGE, unlike the
    # printings figure. The obvious regex finds "104 answered rips" first, which
    # is a sub-count inside one of its sections and not the total, and a bullet
    # built on it would have shipped a confidently wrong 104.
    #
    # IT REPLACES "1,026 Pokemon card pages", which he had already offered up:
    # "we can remove one of the bullets about the 1,026 pokemon card pages or the
    # amount of listings maybe?". Of those two the printings line is the stronger
    # keep, since a search over 39,707 is the less replaceable claim.
    #
    # AND IT IS SECOND RATHER THAN LAST, WHICH IS A CHANGE TO HIS ORDER. His list
    # ran rips, local, plate, then three card-database lines in a row. Hit rates
    # are about HIS RIPS, so it sits with the daily-rip line, and the three card
    # lines stop being a block. One line move if he wants it back at the end.
    # THE DROPS LINE, ADDED 2 SEPTEMBER 2026: "we should also add something about
    # the weekly drop info or weekly retailer drop info or something like that".
    #
    # CHECKED THAT IT IS ACTUALLY WEEKLY BEFORE CALLING IT WEEKLY. /drops.html is
    # "Pokemon Card Drops and Restocks This Week", data/drops.json was covering
    # the week of 31 August when this went in, and its history shows it edited
    # every few days rather than left standing. There is a hard freshness gate in
    # counts() so this stays true without anybody remembering to check.
    #
    # THIRD, BECAUSE IT IS THE THING WITH A CLOCK ON IT. His home page opens with
    # "Drops to watch this week", so it is the section he leads with there too.
    bullets = [
        "A new pack rip video every day",
        f"Hit rates by set, over {N['rips']:,} rips",
        "Weekly retailer drops and restocks",
        "Rochester, NY card shops + card show calendar",
        "Garbage Plate 101 & Directory",
        f"{N['sets']:,} Pokemon card set guides",
        f"Search {N['printings']} Pokemon card printings",
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
    bx, by, STEP = MARGIN + 34, round(bottom) + 36, 44
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
    # -------------------------------------------------------------- the sign-off
    # The owner: "maybe at the bottom where ever youtube won't cut off we add the
    # tag line 'Let's Go!' or the full tag line 'Garbage Rips Only! Let's Go!'".
    # The full one, because this is the last thing on the last frame and a bare
    # "Let's Go!" does not say whose it is.
    #
    # PINK, AND THAT IS THE RULE RATHER THAN A PREFERENCE. CLAUDE.md's accent rule
    # is that teal is every ROUTE and pink is every mark that GOES NOWHERE, so the
    # url above is teal and a catchphrase is pink.
    #
    # BUT THE LIGHTER PINK, AND THAT WAS MEASURED RATHER THAN EYEBALLED. In
    # --brand-accent this line came out at 4.68:1 on the ground actually painted
    # under it, falling to 3.50:1 once YouTube's scrim is modelled over it. That
    # PASSES -- it is large text and the gate is 3.0 -- and it was still wrong:
    # every other line on the card sits between 6.0 and 7.5, so the sign-off was
    # the faintest thing on the frame, which is the opposite of what a sign-off is
    # for. --ketchup-deep is the palette's own answer to a pink that is short of
    # contrast and takes it to 6.11:1, or 4.47:1 under the scrim, without leaving
    # the accent rule. The size gate is what CLAUDE.md ties this token to; the
    # reason underneath it is contrast, and that reason applies here too.
    # 48 AND NOT 54, WHICH THE RAIL CHECK BELOW DECIDED. At 54 the line is 862px
    # wide and its right edge lands at x=971, 29px inside the action rail: the
    # "LET'S GO!" would have sat under the Share icon on every phone. 48 puts the
    # edge at 924 against a limit of 926. The margin is small because the line is
    # his and shrinking his words further to buy slack is the wrong trade.
    f_sign = font("TitanOne.ttf", 48)
    # 36 RATHER THAN THE LIST'S OWN 46 STEP. At the same rhythm as the bullets it
    # read as a seventh one; further away it drifts toward YouTube's chrome. The
    # separation it actually needs is done by weight and colour, not distance.
    sy = listbottom + 30
    # One space, as he wrote it. Two looked like a typographic beat and was mine.
    sign = "GARBAGE RIPS ONLY! LET'S GO!"
    sl, st, sr, sb = d.textbbox((0, 0), sign, font=f_sign)
    # IT IS CENTRED, SO THE RAIL CHECK IS ON ITS RIGHT EDGE AND NOT ITS WIDTH.
    # The bullets are left aligned and grow rightward; this grows BOTH ways from
    # the middle, so the same guard written the same way would have passed a line
    # that runs under the Share icon.
    if sy + (sb - st) > RAIL_T and (W + (sr - sl)) / 2 > RAIL_X - 16:
        raise SystemExit(
            f'the sign-off reaches x={(W + (sr - sl)) / 2:.0f}, into YouTube\'s '
            f"action rail at x={RAIL_X}. Shorten it or drop the type size.")
    centre(d, sign, f_sign, sy + (sb - st) / 2, C["ketchup-deep"])
    signbottom = sy + (sb - st) + 8

    bottom = max(bottom, listbottom, signbottom)
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
