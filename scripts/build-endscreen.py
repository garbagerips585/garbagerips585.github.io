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

    right action rail (like / comment / share)   left 87.2%, 68.8% -> 95.8% down
    bottom scrim, channel row, title, progress   68.8% down -> past the bottom

So the honest safe area is the top 68% of the frame, and that is measured rather
than guessed. Two cautions in both directions. It was taken on mobile WEB; the
iOS and Android apps stack the title onto a second line and can add a sound row,
so the app's bottom band is TALLER than this, never shorter -- 68% is a floor.
And a Short is also watched on desktop, where none of this chrome overlaps the
video at all. A design that clears the mobile band is correct in both places,
which is why the number is applied and not averaged.

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
SAFE_BOTTOM = round(H * 0.688)        # 1322. Where YouTube's scrim begins.
CRIT = SAFE_BOTTOM - 22               # 1300, a little air above the boundary
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


def font(name, size):
    from PIL import ImageFont
    return ImageFont.truetype(str(FONTS / name), size)


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
    centre(d, "LIKE", f_pill, y + PH / 2 - 4, C["on-accent"], cx=lx + lw / 2)
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

    # ------------------------------------------------------------ the ticker
    # THE DEAD ZONE IS ONLY DEAD ON A PHONE, which is the half of this I had
    # wrong at first. A Short played on DESKTOP keeps its chrome beside the
    # video rather than over it, so nothing covers the bottom third there and an
    # empty third looks like a file that failed to finish. So one quiet line
    # goes in it: on mobile it sits under YouTube's scrim as texture, on desktop
    # it closes the frame. It is the site's own ticker voice, in --keyline at a
    # size that is deliberately NOT competing with the url above it, and it
    # carries nothing a viewer would be sorry to miss -- which is the test for
    # anything placed below the line.
    f_tick = font("SpaceMono-b.ttf", 34)
    centre(d, "A NEW PACK RIP EVERY DAY  //  ROCHESTER, NY",
           f_tick, 1516, C["keyline"])

    # THE GUARD, and it is the point of the whole file. A future edit that grows
    # the art, the type or a pill pushes the url under YouTube's channel row and
    # nothing about the PNG would look wrong -- it only fails on a phone, which
    # is where nobody is looking. So it fails here instead.
    if bottom > CRIT:
        raise SystemExit(
            f"the stack ends at y={bottom:.0f}, below the {CRIT}px line where "
            f"YouTube's Shorts chrome starts (68.8% of {H}). Shrink something.")

    OUT.mkdir(parents=True, exist_ok=True)
    card.save(OUT / "garbage-rips-endscreen.png")

    # A SECOND FILE WITH THE CHROME DRAWN ON IT, because the owner has to be able
    # to check this claim himself rather than take my word for where the bar is.
    # The red is the measured rail and scrim; anything of his under it would be
    # covered on a phone. It is a proof, not a deliverable.
    g = card.copy()
    gd = ImageDraw.Draw(g, "RGBA")
    gd.rectangle([0, SAFE_BOTTOM, W, H], fill=(238, 0, 0, 92))
    gd.rectangle([round(W * .872), round(H * .688), W, round(H * .958)], fill=(238, 0, 0, 92))
    gd.line([0, SAFE_BOTTOM, W, SAFE_BOTTOM], fill=(255, 255, 255), width=4)
    gd.text((MARGIN, SAFE_BOTTOM + 18), "YOUTUBE COVERS EVERYTHING BELOW THIS LINE",
            font=font("SpaceMono-b.ttf", 30), fill=(255, 255, 255))
    g.save(OUT / "garbage-rips-endscreen-safe-area.png")

    print(f"  canvas   {W}x{H}")
    print(f"  content  ends y={bottom:.0f}, {CRIT - bottom:.0f}px of clearance")
    print(f"  wrote    {OUT}/garbage-rips-endscreen.png and -safe-area.png")


if __name__ == "__main__":
    build()
