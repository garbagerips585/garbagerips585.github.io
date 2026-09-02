# Garbage Rips 585 sticker, what to send a print shop

Regenerate with `python3 scripts/build-sticker.py`. Do not edit the PNGs by hand:
every colour in them is read out of `assets-source/ui.css` at build time, so a
hand edit is the thing that drifts when the site is repainted.

## The file to upload

**`garbage-rips-sticker-print.png`** — 1376 x 963 px at 300 dpi.

- **Trim size 4.33 x 2.96 in.** That is the sticker you get.
- **Bleed 0.125 in on all four sides**, already included in the file. It is real
  artwork out there, not a coloured margin, so a mis-cut shows more picture
  rather than a stripe of the wrong green.
- **Die cut: rounded rectangle, about 0.18 in corner radius.**
  `garbage-rips-sticker-preview.png` is that shape with a transparent
  background, which is what it looks like in the hand.

## Why 4.33 inches and not bigger

The artwork is 1300 px wide and that is the largest copy anywhere in this repo.
4.33 in is exactly 300 dpi with no upscaling. **Anything larger is invented
detail.** If a bigger sticker is wanted, ask Unableplacebo, who drew it, for the
original file; do not enlarge this one.

Printing it SMALLER is fine and costs nothing. At 3 in wide the tagline drops
from 7 pt to about 4.8 pt, which is too small to read, so if you order 3 in ask
for the wordmark only, or regenerate with the tagline moved into the bottom band.

## Type sizes, checked as points rather than pixels

72 pt is one inch, so a size in pixels at 300 dpi is `px / 300 * 72`.

| element | px | printed |
|---|---|---|
| GARBAGE RIPS 585 | 58 | 13.9 pt |
| Pokemon Pack Rips from Rochester, NY | 29 | 7.0 pt |
| GARBAGERIPS.COM | 86 | 20.6 pt |

7 pt is the floor for something a stranger is meant to read across a table. The
first draft had the tagline at 4.8 pt, which is smaller than the small print on
a receipt, on the line that was specifically asked for.

## Contrast, measured

Vinyl and paper both lose a little contrast against a screen, so these are
measured on the exact colours in the file: URL 5.61:1, wordmark 10.70:1, the
pink RIPS 5.51:1. Nothing here relies on a fine distinction between two similar
colours.

## The fan content line came off, 2 September 2026

It read "FAN CONTENT • NOT AFFILIATED WITH THE POKEMON COMPANY" under the url. It
was raised as worth keeping and the owner decided otherwise, which is his call on
his own brand. Recorded here so nobody re-adds it as a bug fix, and so a future
sticker can put it back knowing what it was: 23 px, 5.5 pt, in `--keyline`, at
4.19:1 on the band.

**The website is unaffected.** That line is still in the footer of all 1,504
pages, which is where CLAUDE.md's requirement actually sits.

## If the print shop asks

- Colour: the file is RGB. Most sticker shops convert; if yours wants CMYK, let
  them convert rather than converting twice.
- The green is `#1F382B` and the teal `#70B5D9`. Both are flat, so banding is
  not a risk.
- No white ink layer is needed. The design is opaque to the trim.
