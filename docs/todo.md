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

## For the owner, when he has time (added 12 November 2026)

He said on 12 November 2026: "ill have to look back at these not going to do this now add to a list for later".

**Second and third boxes of the same product share pack labels.** The same pack number appears on more than
one rip under one label because a later box of the same product was not given a box number. Which run is box 1,
box 2 or box 3 is his to say; once he does, set `boxNumber` in data/overrides.json (with a `packNumberWhy` in
that file's style) and the acknowledged entries in data/check-allow.json can come out.

- 30th Celebration Tech Sticker Collection (labeled Blister): three runs. tD8klCySHn8, AOdqwSZFsGw, AebP2_eyvGI (Sep 16 to 20); kAuIvKbEYw8, 7SV1GE23CGA, heFRq2yODvQ (Nov 1 to 4); klo7rTgTJkE (Nov 10, pack 1 so far).
- 30th Celebration Knock Out Collection: three runs. ZqGxmY2mc90, MUTiE4hsMsM (Oct 2 to 4); tgqmJLdrK70, H-u3HvtEFuI (Oct 28 to 30); jCOfh3__6-U, Y8F071922WQ (Nov 6 to 8).
- 30th Celebration ex Premium Collection, packs 1 to 4 twice: sioMdPu-izo, DCQKbd_q0tA, BvnrfvDoaZ0, B-zVdn5vjso (Oct 6 to 12) and 1mUXNOw1GJ8, sMPnsTcOXc0, JrrgpXdSoq8, BXRHCA7aDkg (Oct 20 to 26, the Sylveon ex Box).
- Ascended Heroes Booster Bundle, packs 1 to 6 twice: Qf2PmYHL8Xw to 8d2a5b_BmYQ (May 2 to 15) and W2eIV9tya84 to vW8lkXEx3Ao (May 28 to Jun 4).
- Ascended Heroes ex Premium Collection 1, packs 1 to 4 twice with interleaved dates (Jun 21 to 26): qKiLbaLhdp8 / r4WG2IWWyKc, zhE5GzB2Dns / n4iGQVPBtfE, na2bRZxxTHU / w3dQBhumsug, 7nGg08wavGM / czBVJAWDB8U. Two different boxes (Mega Emboar ex Box and Mega Feraligatr ex Box) share the label.
- Ascended Heroes ex Premium Collection 2, packs 1 to 4 three times: Fgj5afnnXVk to _Bu9zCfLI4c (Jun 17 to 20); blSCuSk5nb0 to gFZ_jiV7DEY (Jul 6 to 11); WhfY82RrS4w to xqV7AYXoVJs (Jul 8 to 13).
- Chaos Rising Booster Bundle, packs 1 to 6 twice: APS_RnpORC8 to 23RED_g8uOE (May 30 to Jun 5) and BiBdyozoD_Q to R4TUGTf0Eb4 (Jun 7 to 14).
- Journey Together Booster Bundle, packs 1 to 6 twice: DljCIsO2zkU to LGzHC-k4vh0 (Apr 12 to 24) and C4IPzbJZlHw to CP7sMGF3p3M (May 8 to 25).
- Perfect Order Booster Bundle, packs 1 to 6 twice: OTKn4mNzQ7I to 7PBrXPgt9kU (Apr 10 to 20) and JPzh3KWw084 to l_vpvsLXG50 (May 31 to Jun 6).
- Poke Ball Tins, two tins: Perfect Order pack 1 EJ0AKqX2a_Q (Jul 3) and O1hNutypTR8 (Jul 14); Surging Sparks pack 2 lrl5v4z317s (Jul 4) and RtJn1UOi2S8 (Jul 16); Twilight Masquerade pack 3 UpdeUMc-6ys (Jul 5) and 2S4poqmGKWE (Jul 19).
- Surging Sparks ex Premium Collection pack 1: ac3pK3zh0DE (Apr 9) and 4wt9xuZ-VV0 (Nov 5, the Archaludon ex Box).
- Paradox Rift Pack has packs 1 and 4 and no 2 or 3.

**Other open questions for him**

- Pokemon Center listed only two Delta Reign products on 12 November 2026 (display box $161.64, booster bundle $26.94, both sold out). No Elite Trainer Box or single pack was listed, so those have no shelf price yet.
- MSRP, grading fee and selling fee reads are from August 2026 and are due for a re-read (RUNBOOK.md lists each).
- PokemonPriceTracker: staying on the free tier (his call, 12 November 2026).
- PriceCharting answered 13 November 2026: paid plan required. Declined; their figures are off the site. Possible later: refresh data/top100.json (TCGplayer) on a schedule, and TCGplayer prices for the three subsets (Shining Fates Shiny Vault and the others) which show no price now.
