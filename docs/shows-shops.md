# Card shows, shops and the /shows/ pages

Covers the card show calendar, the series and area pages added on 11 November 2026, and where the shop and show map decisions are recorded.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Written on 2026-11-11 from the code and data at HEAD.

## The owner confirms every show

data/shows.json is hand maintained on purpose (its `_readme` says why: there is no free API for local card
shows and the aggregators disagree with each other). Every event was read off a real listing and carries the url
it came from and the date it was checked. Nothing is inferred. So:

- Never add a show, an address, a ZIP, a date, an hour, a price or an organizer that the owner has not
  confirmed. If the data file does not hold it, the page does not print it.
- The same policy governs data/shops.json: hours are published only where the business states them about
  itself, with the source and the read date. build-shops.mjs fails the build over it.
- Which shows belong on the calendar is a measured rule (45 miles from Rochester, NY, Buffalo or Syracuse, the
  two-hour drive rule, and a confirmed local vendor), kept in `showGeo()` in shared/show-pages.mjs with its
  comments. An out-of-area city stops the build rather than sending somebody to another state.

## The /shows/ pages (11 November 2026)

`shared/show-pages.mjs` decides which card show pages exist and where each show is filed. It is one derivation
with four readers: scripts/build-shows.mjs writes the calendar and the pages under /shows/, build-pages.mjs
puts them in the sitemap, build-search.mjs in the site search and build-llms.mjs in llms.txt. build-pages.mjs
runs BEFORE build-shows.mjs in build-all, so the rule is a pure function of data/shows.json and the day, and
nobody keeps a copy.

- **Nothing in that file adds a fact.** A series page and an area page only re-sort rows the owner already
  confirmed.
- **Series pages.** A series is keyed on show name plus town. It gets a page when it holds two or more rows
  dated on or after `SHOW_PAGES_SINCE` ("2026-11-11"). The count is over rows that STAY in the file, which is
  what makes the page permanent: when the dates pass the page is still built and a bookmark does not 404.
- **`indexable`.** With a date still ahead the page is normal. With none it is built in its empty state, marked
  noindex and left out of the sitemap, the search index and llms.txt. It comes back by itself when a new date
  is added.
- **Do not move `SHOW_PAGES_SINCE` forward.** It is the day these pages first existed, not a freshness stamp;
  moving it un-builds pages people have saved.
- **Area pages** are the three in `SHOW_AREAS`: Rochester, NY, Buffalo, NY and Syracuse, NY.

## Where the map and listing decisions are written down

These live in docs/links.md because they were argued as outbound-link questions:

- the map came off /shops.html on 27 August 2026 (search "THAT MAP CAME OFF /shops.html");
- /card-shows.html draws a real map from OpenStreetMap data, with the ODbL credit that is not optional, and no
  raster tiles (search "/card-shows.html GAINED THE SAME TWO LINKS" and "NO RASTER TILES");
- the calendar under the show map was deleted in the same edit;
- the source card on rip pages that names the shop or vendor the packs came from (search "THE SOURCE CARD ON A
  RIP PAGE").
