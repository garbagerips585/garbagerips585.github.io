# Facts that only the owner can supply

Covers the handful of data points no script and no assistant may produce: MSRP, pack numbers, hits, and card shows.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Written on 2026-11-11 from the code at HEAD.

## MSRP comes from Pokemon Center, read by a person

Every multiple on the site divides an asked price by the SUGGESTED price, and Pokemon Center is the source for
all MSRP (docs/set-pages.md, "THREE THINGS STAY WHERE THEY WERE"). pokemoncenter.com is bot gated: every url
answers an automated request with a challenge page. scripts/build-msrp.mjs says so in capitals: it must be left
alone by every script, do not try to get around it, do not hotlink its images. The readings in
data/pokemon-center-prices.json were taken by a person in a real browser, each with its product path and date.
A new MSRP means the owner reading it again by hand. Never estimate one, and never take one from a retailer or
a marketplace.

## Pack numbers and hits come from the owner's words

- A pack number, a box number, a hit card, its rarity and "no hit" are the owner's data. They come from his
  workbook (Garbage-Rips-585-Video-Log.xlsx through scripts/import-sheet.mjs), from what he tells you directly,
  or from a video description when he has said to use it. Never infer one from a title or a thumbnail.
- When the fact arrives outside the workbook, write it to data/overrides.json (pack number, box number, hasHit,
  blurb, tags) and data/hits.json (the card) BEFORE running scripts/sync-youtube.mjs, which reads both when it
  writes public/data/videos.json. overrides.json is loaded and mutated rather than rebuilt, which is what makes
  it durable; an entry typed into the sheet-derived manual file is dropped on the next import.
- data/hits.json rows that came from the workbook are rebuilt per video by import-sheet.mjs. A wrong workbook
  row is fixed in the workbook and re-imported (docs/video.md, "FIX THESE IN THE SHEET").
- Which printing a hit is follows the rarity he typed: docs/set-pages.md.

## Card shows and shops

The owner confirms every show. Never guess an address, a ZIP, a date or an hour. See docs/shows-shops.md.
