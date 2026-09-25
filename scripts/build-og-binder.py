#!/usr/bin/env python3
"""The share card for /30th-binder.html: an open card binder, drawn.

    python3 scripts/build-og-binder.py

Writes public/assets/og-30th-binder.jpg (1200x630).

WHY A PAGE AND A PICTURE OF ITS OWN. The owner, 25 September 2026: "make a
special link share image for a link that takes you directly to the 30th
collection master set binder, and make the image look like a real card binder
with the 30th logo and have it say Virtual Master Set Binder". A link preview is
read off the page's own og tags and a #fragment is thrown away before anybody
reads them, so /30th-celebration.html#masterset can only ever preview as the
set guide. /30th-binder.html exists to carry this card, and sends a person on
to the binder the moment it opens (build-30th.mjs writes it).

THE CARDS IN THE POCKETS ARE REAL SCANS OF CARDS HE OWNS, from TCGdex, same
source the binder itself draws from. CLAUDE.md: card scans on a share card are
content, never tinted to the palette. The right hand page is the first Pikachu
page as it really stands, with the ones still to find drawn gray, exactly as the
binder draws them. No count is printed: the image is made by hand and a number on
it would go stale the first time a card went in. The page's own description,
which IS rebuilt every time, carries the count.

NOT IN build-all.mjs, same arrangement and reason as build-og.py: it fetches
eighteen card scans the first time (cached under .cache/og-binder/ after that),
and a scheduled build must not depend on a network step.
"""
import io
import json
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / ".cache" / "fonts"
CACHE = ROOT / ".cache" / "og-binder"
OUT = ROOT / "public" / "assets" / "og-30th-binder.jpg"
W, H = 1200, 630

# Token values read out of assets-source/ui.css's :root, as build-og-pages.py does.
CHROME_BG = (0x19, 0x2D, 0x22)  # --chrome-bg
PAGE = (0x1F, 0x38, 0x2B)       # --page
PAPER = (0x26, 0x42, 0x31)      # --paper, a binder page
CARD = (0x2F, 0x4F, 0x39)       # --card
PAPER_3 = (0x40, 0x5D, 0x49)    # --paper-3
KEYLINE = (0x5A, 0x74, 0x62)    # a pocket edge, between --paper-3 and --ink-2
PINK = (0xE8, 0x7E, 0xA1)       # --brand-accent
PINK_SM = (0xEE, 0xA0, 0xB9)    # --ketchup-deep
INK = (0xE4, 0xDC, 0xCC)        # --ink
INK_2 = (0xD4, 0xCC, 0xBC)      # --ink-2
TEAL = (0x60, 0x9C, 0xBB)       # --gold, which is a teal

# Left page: nine cards he owns, the best of them. Right page: the first Pikachu
# page as it is, 024 to 032, with 029 still to find.
LEFT = ["155", "151", "148", "053", "066", "102", "145", "133", "136"]
RIGHT = ["024", "025", "026", "027", "028", "029", "030", "031", "032"]


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def scan(n):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{n}.webp"
    if not f.exists():
        url = f"https://assets.tcgdex.net/en/me/30th/{n}/high.webp"
        req = urllib.request.Request(url, headers={"User-Agent": "garbagerips-og/1.0"})
        f.write_bytes(urllib.request.urlopen(req, timeout=30).read())
    return Image.open(io.BytesIO(f.read_bytes())).convert("RGBA")


def rounded(img, r):
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], r, fill=255)
    img.putalpha(m)
    return img


def page(canvas, x, y, pw, ph, nums, owned, spine_left):
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle([x, y, x + pw, y + ph], 10, fill=PAPER)
    # the curve into the spine: the page darkens where it bends toward the rings
    shade = Image.new("L", (pw, ph), 0)
    sd = ImageDraw.Draw(shade)
    for i in range(46):
        a = int(110 * (1 - i / 46) ** 2)
        xx = i if spine_left else pw - 1 - i
        sd.line([(xx, 0), (xx, ph)], fill=a)
    canvas.paste(Image.new("RGB", (pw, ph), (0, 0, 0)), (x, y), shade)
    gx, gy, gap = 26, 26, 12
    cw = (pw - gx * 2 - gap * 2) // 3
    ch = round(cw * 88 / 63)
    for i, n in enumerate(nums):
        cx = x + gx + (i % 3) * (cw + gap)
        cy = y + gy + (i // 3) * (ch + gap)
        # the pocket: a sleeve a little bigger than the card, with a lip on top
        d.rounded_rectangle([cx - 4, cy - 4, cx + cw + 4, cy + ch + 4], 7, fill=CHROME_BG,
                            outline=PINK if n in owned else KEYLINE, width=2)
        img = scan(n).resize((cw, ch), Image.LANCZOS)
        if n not in owned:
            rgb = ImageOps.grayscale(img.convert("RGB")).convert("RGBA")
            rgb.putalpha(200)
            img = rgb
        img = rounded(img, 6)
        canvas.paste(img, (cx, cy), img)
        # the sleeve's sheen, a faint diagonal band across the card
        sheen = Image.new("L", (cw, ch), 0)
        ImageDraw.Draw(sheen).polygon([(0, ch * 0.18), (cw * 0.35, 0), (cw * 0.55, 0), (0, ch * 0.5)], fill=22)
        canvas.paste(Image.new("RGB", (cw, ch), (255, 255, 255)), (cx, cy), sheen)
    return cw, ch


def main():
    binder = json.loads((ROOT / "data" / "30th-binder.json").read_text())
    owned = {o["n"].split("/")[0] for o in binder["owned"] if o.get("section") in ("pikachu", "main", "secret")}

    img = Image.new("RGB", (W, H), PAGE)
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W * 0.45, -H * 0.5, W * 1.3, H * 1.1], fill=120)
    glow = glow.filter(ImageFilter.GaussianBlur(150))
    img.paste(Image.new("RGB", (W, H), PAPER_3), (0, 0), glow)

    # THE BINDER: dark boards, two pages, rings down the middle.
    pw, ph = 372, 506
    spine = 34
    bx = W - 40 - (pw * 2 + spine) - 28
    by = (H - ph) // 2 - 4
    board = [bx - 16, by - 16, bx + pw * 2 + spine + 16, by + ph + 16]
    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle([board[0] + 10, board[1] + 16, board[2] + 10, board[3] + 18], 22, fill=150)
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    img.paste(Image.new("RGB", (W, H), (6, 12, 9)), (0, 0), shadow)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(board, 20, fill=CHROME_BG, outline=KEYLINE, width=2)
    # sheet edges peeking out on the right, like the pages still to turn
    for k in (3, 2, 1):
        d.rounded_rectangle([bx + pw + spine + 6 * k, by + 4 * k, bx + pw * 2 + spine + 6 * k, by + ph + 2 * k], 10,
                            fill=PAPER, outline=KEYLINE, width=1)
    page(img, bx, by, pw, ph, LEFT, owned, spine_left=False)
    page(img, bx + pw + spine, by, pw, ph, RIGHT, owned, spine_left=True)
    d = ImageDraw.Draw(img)
    rx = bx + pw + spine // 2
    for ry in (by + ph * 0.16, by + ph * 0.5, by + ph * 0.84):
        ry = int(ry)
        d.rounded_rectangle([rx - 24, ry - 10, rx + 24, ry + 10], 10, fill=INK_2, outline=CHROME_BG, width=2)
        d.rounded_rectangle([rx - 20, ry - 6, rx + 20, ry - 1], 3, fill=(245, 240, 230))

    # THE WORDS, in the column left of the binder.
    tx = 48
    logo = Image.open(ROOT / "assets-source" / "logos" / "30th-celebration.png").convert("RGBA")
    lw = bx - 16 - tx - 30
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    img.paste(logo, (tx, 58), logo)
    y = 58 + logo.height + 30
    f_kick = font("SpaceMono.ttf", 22)
    d.text((tx, y), "POKEMON TCG", font=f_kick, fill=PINK_SM)
    y += 40
    for size in (58, 52, 46, 42):
        f = font("TitanOne.ttf", size)
        words, lines, cur = "Virtual Master Set Binder".split(), [], ""
        for wd in words:
            t = (cur + " " + wd).strip()
            if d.textlength(t, font=f) <= lw:
                cur = t
            else:
                lines.append(cur)
                cur = wd
        lines.append(cur)
        if len(lines) <= 3:
            break
    for ln in lines:
        d.text((tx, y), ln, font=f, fill=INK)
        y += int(size * 1.08)
    y += 12
    f_sub = font("SpaceMono.ttf", 21)
    for ln in ("Flip every page.", "Every card, collected", "or still to find."):
        d.text((tx, y), ln, font=f_sub, fill=INK_2)
        y += 30

    d.rectangle([tx, H - 104, tx + 70, H - 98], fill=TEAL)
    f_brand = font("TitanOne.ttf", 27)
    x = tx
    for word, fill in (("GARBAGE ", INK), ("RIPS", PINK), (" 585", INK)):
        d.text((x, H - 86), word, font=f_brand, fill=fill)
        x += d.textlength(word, font=f_brand)
    d.text((tx + 2, H - 46), "ROCHESTER, NY", font=font("SpaceMono.ttf", 18), fill=INK_2)

    img.save(OUT, "JPEG", quality=86, optimize=True)
    print(f"Wrote {OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.0f}KB")


if __name__ == "__main__":
    main()
