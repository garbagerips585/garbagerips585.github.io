# The start page: /start.html

Covers the buying card added on 11 November 2026.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Written on 2026-11-11 from scripts/build-start.mjs at HEAD.

## The buying card

"Buying for someone? Start here." is a card ABOVE the six-step list, linking to /what-to-buy.html with a
full-size teal button. From the comment above `BUY` in scripts/build-start.mjs:

- It is still not one of the owner's six questions and is not numbered. Every step in the list is about a card
  somebody is already holding; this one is about the wallet in the other hand. Renumbering to seven would change
  what the page claims about itself.
- What changed is where it sits. It was an inline text link in a paragraph after step six, about 3,000px down a
  phone. It is now the first thing after the breadcrumb, inside the first screen at 390x844.
- It uses the step card's own classes (`.st`, `.st-body`, `.st-links`, `.btn-sky`) less the number disc;
  `.st-buy` only drops the grid's first column.
- The paragraph it replaced is gone rather than shortened, so the page says it once.
- Step five's button reads "Luck, measured", not "Luck and pull rates", and that is deliberate: see the pull
  rate rule in docs/set-pages.md.
