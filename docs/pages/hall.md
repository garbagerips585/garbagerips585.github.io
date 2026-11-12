# The Hall of Fame page: /hall.html

Covers the filter bar added on 11 November 2026 and points at where the page's other rules are recorded.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Written on 2026-11-11 from scripts/build-hall.mjs at HEAD.

## The filter bar (11 November 2026)

The page was 59,048px tall on a 390px phone, about 70 screens, with no way to ask it for one set. It now has a
filter bar: Top 10, Top 25 or all, plus one set and one rarity. The rules that came with it, from the comment above
`keySlug` in scripts/build-hall.mjs:

- **Every plaque stays in the document.** The page's promise is completeness, so nothing is paginated out of the
  HTML. A filter is a `display:none` rule keyed to a class on `<html>` or to two data attributes. With scripting
  off neither exists and the page is exactly the full list it was.
- **The order never changes.** Filters are views of the one raw ranking, so the medallion still counts 1 to N
  and a filtered plaque keeps the rank it has on the whole page.
- The state lives in the url hash (`#view=top10`, `#view=top25`, `#view=all`, `#set=<key>` and so on), so a view
  can be shared.
- Filters are keyed on the set's PRINTED NAME, not on the set id: it is what the plaque shows, promos carry no
  set id, and the slug has to be readable in a shared link. Diacritics are folded first.
- The last-row spans that even out the grid are switched off whenever a view is narrower than everything.

## Elsewhere

- Which video a plaque came out of, the completeness fix, the intl rows, and "a plaque with no scan is not a
  button": docs/video.md, under "Which pages have something to watch".
- Which printing a logged hit is: docs/set-pages.md.
- Gold is semantic and survives only on this page's badge, frame and medallion: docs/brand.md.
- The `sizes` on its scans (120px box, checked at DPR 3): docs/card-images.md.
