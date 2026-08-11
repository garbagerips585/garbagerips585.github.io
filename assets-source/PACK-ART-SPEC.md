# Pack art spec

One image per card set. Drop finished files in `public/assets/packs/` and tell
me, and I will wire the skin system to use the artwork where it exists and fall
back to the current colour design where it does not.

`pack-template.png` in this folder is a 1080x1920 guide with every zone marked.
Drop it in as a top layer at low opacity while you work, then hide it.

---

## Size and format

**1080 x 1920 px, 9:16.** JPG or PNG, sRGB.

That is comfortably above the largest place it renders. Measured from the live
site at 2x pixel density:

| Where | CSS size | Actual pixels needed |
| --- | --- | --- |
| Rip page player | 380 x 676 | 760 x 1352 |
| Grid tile, widest | 267 x 400 | 534 x 800 |
| Grid tile, phone | 156 x 234 | 312 x 468 |

Do not worry about file size. Export at full quality and I will generate the
smaller versions the tiles need, so nobody downloads a 1080px image for a
170px tile.

---

## The one thing that actually matters: two shapes, one image

The rip page shows the **full 9:16** image. Grid tiles show a **2:3** crop,
because a true 9:16 tile is nearly twice as tall as it is wide and turns the
grid into a wall of skinny rectangles (this is what YouTube, Instagram and
TikTok all do with vertical video).

So the same artwork gets cropped two ways:

- **Full canvas, y 0 to 1920** — the rip page
- **Safe area, y 150 to 1770** — what survives on grid tiles

**Keep the set name, logo and any key art inside y 150 to 1770.** The top and
bottom 150px are decorative bleed: background, foil texture, the crimped seal.
Anything you would be annoyed to lose, keep out of them.

---

## Things drawn on top of your art

Leave these areas readable. They do not need to be empty, just not carrying
detail you care about.

| Zone | Where, in 1080x1920 coords | Appears on |
| --- | --- | --- |
| Play button, ~220px circle | centred, x 540 y 960 | everywhere |
| Product chip ("ETB", "BUNDLE") | top-left, x 0-560, y 150-300 | grid tiles |
| Rank number ("#1") | bottom-left, x 0-230, y 1640-1770 | Hits Only shelf |
| "RIP IT OPEN" strip, full width | y 1580-1725 | rip page only |

The card set's own name is currently printed on the pack by CSS. **Once you
supply artwork I will turn that off**, along with the Trubbish badge, so your
design is not competing with generated text. Put the set name in the art
itself if you want it there.

---

## The tear

Clicking the pack on a rip page splits it **down the vertical centre** with a
jagged edge, and the two halves rotate away in opposite directions. Nothing to
design around, but worth knowing: whatever sits at x=540 gets torn in half.
A logo dead centre reads well when it splits. Small text dead centre does not.

Corners get a ~12px radius and sit inside a 4px border, so keep art about 40px
off the extreme corners.

---

## Filenames

Exact lowercase names, in `public/assets/packs/`. Ordered by how many videos
use each, so the top of the list buys you the most.

| File | Set | Videos |
| --- | --- | --- |
| `chaos-rising.jpg` | Chaos Rising | 50 |
| `ascended-heroes.jpg` | Ascended Heroes | 49 |
| `perfect-order.jpg` | Perfect Order | 44 |
| `pitch-black.jpg` | Pitch Black | 18 |
| `phantasmal-flames.jpg` | Phantasmal Flames | 16 |
| `journey-together.jpg` | Journey Together | 14 |
| `prismatic-evolutions.jpg` | Prismatic Evolutions | 13 |
| `destined-rivals.jpg` | Destined Rivals | 12 |
| `pokemon-go.jpg` | Pokemon GO | 12 |
| `surging-sparks.jpg` | Surging Sparks | 6 |
| `151.jpg` | 151 | 5 |
| `scarlet-violet.jpg` | Scarlet & Violet | 5 |
| `twilight-masquerade.jpg` | Twilight Masquerade | 3 |
| `mega-evolution.jpg` | Mega Evolution | 3 |
| `paradox-rift.jpg` | Paradox Rift | 3 |
| `temporal-forces.jpg` | Temporal Forces | 2 |
| `obsidian-flames.jpg` | Obsidian Flames | 1 |
| `paldea-evolved.jpg` | Paldea Evolved | 1 |

Plus **`default.jpg`**, used by the 61 videos with no set tag yet and by any
future set you have not drawn. Worth doing early: it covers the most videos of
any single file.

You do not have to do all of them. Anything missing keeps its current colour
design, so you can ship the top three and the rest still look fine.

---

## Suggestion

The first four files cover 161 of 308 videos. `default.jpg` covers another 61.
Five images gets you 72% of the site.
