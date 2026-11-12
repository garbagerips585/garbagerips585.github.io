# TODO list carried over from CLAUDE.md

Covers the rough-priority list that sat at the foot of CLAUDE.md, with a status line for each item.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

## TODO (rough priority)
1. Greatest Hits playlist. The band ranks by pull tier then views as a
   stand-in; The owner's own playlist would replace it. (The old note here pointed
   at a "HITS ONLY PLAYER" comment in index.html that no longer exists.)
2. Buy garbagerips.com, set it in Settings > Pages, then verify in
   Google Search Console and submit sitemap.xml. See DEPLOY.md.
3. ~~About page~~ done: /about.html is written, linked and in the sitemap.
4. Blog for actual search traffic: set reviews, "Pokemon card shops
   Rochester NY" local angle. Each post embeds a video, and each new page
   goes in build-pages.mjs's sitemap list, not into sitemap.xml by hand.
   THIS LINE USED TO SAY "pull rates", THEN SAID IT SHOULD NEVER HAVE, AND
   BOTH ARE NOW OUT OF DATE. The owner lifted the ban on 11 September 2026 and it
   is a sourcing rule now: see "Pull rates: a SOURCING rule" above for what
   counts as confirmed and what does not. Pull rate content is a legitimate
   plan again; a page of unsourced odds still is not, and a single box
   opening is a sample rather than a rate.
5. Consider migrating to Astro if the blog grows (keep it static).
6. Naming consistency: "GarbageRips585" (one word, on sticker) vs
   "Garbage Rips 585" (spaced, on YouTube). The owner to pick one for H1/metadata.

## Status on 11 November 2026 (added in the restructure; the list above is as it was written)

1. Greatest Hits playlist: still open as far as the code shows.
2. DONE. The domain is live: `LIVE = true` in shared/site.mjs and public/CNAME reads garbagerips.com. Search
   Console and the sitemap submission are the owner's account and cannot be checked from the repo.
3. Done, as the list already says.
4. Open. The pull-rate wording in it is current: see docs/set-pages.md, "Pull rates".
5. Open.
6. Open, and the owner's call.
