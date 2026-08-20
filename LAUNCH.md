# Launch checklist

Everything that has to happen before garbagerips.com is live, and the things
worth doing soon after. Nothing here is code: the site builds and runs locally
today. These are the accounts, the money, and the content only Tim can supply.

Every count in this file was checked against the data on 14 August 2026 rather
than carried forward. The previous version had drifted badly enough to be
misleading: it asked for 61 videos to be tagged when 43 were left, said
hall.html was empty when it carries 15 cards, and asked for an About page that
already exists.

---

## 1. Accounts and money

- [x] **GitHub account and repo.** Done. `main` pushes to
      `garbagerips585/garbagerips585.github.io`, and `.github/workflows/pages.yml`
      publishes `public/` on every push. The laptop is no longer the only copy.
      **Free is genuinely enough**: GitHub free includes unlimited public and
      private repos, Pages, and Actions minutes well past what the nightly
      refresh uses. Nothing here needs a paid plan.

- [x] **Domain: garbagerips.com. BOUGHT 20 August 2026, along with
      garbagerips585.com.** Both at GoDaddy, one year each.

      **Nothing is needed at the registrar to keep working, and the site is NOT
      to go live on either yet.** Tim, 20 August: "I don't want to take the
      website live on those pages yet ... once everything is perfect then we
      flip the switch". The repo is already in exactly that state: LIVE is
      false, no CNAME file exists, robots.txt is closed, and every canonical
      points at the github.io address.

      Two things to know when the day comes, both written up in DEPLOY.md:
      the four A records can be set at GoDaddy EARLY, because DNS takes up to
      24 hours and cannot put the site live on its own; and the SETTINGS →
      PAGES custom domain is the actual switch and belongs last. The 585 domain
      is a 301 redirect set at GoDaddy, not a second address, because GitHub
      Pages serves exactly one custom domain per site.

- [ ] ~~**Domain: garbagerips.com.**~~ Every canonical, the sitemap and the Open
      Graph tags switch to it from one flag, so nothing resolves until it
      exists. Buy it anywhere. Point the apex at GitHub's four A records and
      `www` at `garbagerips585.github.io`; the records are in DEPLOY.md.

      Not needed: a separate DNS or CDN provider. GitHub Pages serves the site,
      issues the certificate and handles HTTPS.

- [ ] **pokemonpricetracker.com paid plan, $9.99/mo.** The free tier is 100
      credits a day and a card costs 2, so a full refresh of every chase card
      takes four days. That is fine while building and wrong once live, because
      prices move and the site would always be showing last week's. One month of
      the paid tier also backfills everything in a single run.

- [ ] **Decide about TCGplayer affiliate links.** Plumbing is built and switched
      off in `data/affiliate.json`. This is a real decision, not a formality:
      five pages currently tell readers "Not affiliate links", so turning it on
      means changing that copy as well. The FTC disclosure renders by itself
      once enabled. The application asks for a live site, so it cannot happen
      before launch anyway.

- [ ] **Google Search Console.** Verify the domain, submit
      `https://garbagerips.com/sitemap.xml`. Without this the set guides,
      which are the SEO half of the site, are invisible for months.

---

## 2. Content only Tim can supply

- [ ] **Tag the 17 remaining videos.** The biggest single lever on the site. An
      untagged video is published `noindex` and kept out of the sitemap, so it
      cannot rank, cannot be filtered, and cannot reach the Hall of Fame. 301 of
      318 are tagged today.

      THESE NUMBERS ROT AND THIS FILE IS READ ON LAUNCH DAY. They said "43
      remaining, 269 of 312" until 20 August 2026, when the real figures were 17
      and 301 of 318 -- a checklist item three times its actual size, on the page
      somebody follows when they are least inclined to re-derive it. `UNTAGGED.md`
      is regenerated on every build and is the number to trust; this line is a
      snapshot and should be re-read against it rather than quoted.

      `UNTAGGED.md` is regenerated on every build and lists all 17 with the
      playlist each one is already in. Renaming one playlist can tag twenty at
      once, because the sync reads playlist titles.

- [ ] **Log the hits in the spreadsheet.** Two videos have their pulled cards
      recorded. Every one that does feeds the Card Hall of Fame, the Most Wanted
      band and /luck.html, which is empty until there is enough logged to say
      anything honest about hit rate.

- [ ] **Fill in the Set Notes tab: whether each set is still in print.**
      `data/set-notes.json` holds nothing but its readme today, so all 23
      English set guides omit that line. Nothing we can reach knows whether a
      set is still being printed, so this one does need a person.

      The pack price no longer does. It was on this list too, and it turned out
      TCGplayer already gives us a Single Pack market price for all 23 sets
      through the nightly product sync, printed further down the same page. All
      23 guides show it now. A hand-written note still wins if you want to put
      the price you actually see in a shop.

- [ ] **Create the Greatest Hits playlist on YouTube.** Until it exists the home
      page ranks by pull tier then views, which is a decent stand-in but not
      Tim's own pick.

- [ ] **Add more Rochester card shops.** Six are listed: Just Games, Millennium
      Games, LingSter Games, Legacy Games, WeTheHobby and Great Lakes Gaming. `pokemon card shop rochester ny` is a
      real search with real intent, and that page is the best local-SEO asset on
      the site.

---

## 3. Before flipping it on

- [x] **THE SEVEN PALETTE SAMPLE PAGES ARE DELETED.** Done 19 August 2026,
      along with `scripts/gen-palette-samples.mjs` that generated them.
      `ls public/preview-*.html` now returns nothing, and that is the check
      that cannot drift: this item said FIVE while six were on disk, then SIX
      while seven were, so the deletion was driven off `ls` rather than off the
      typed list.

      They were six extra copies of the home page and one of /msrp.html, added
      18 and 19 August so Tim could compare palettes on his own phone, which
      needs a real url and therefore a real deploy. Trubbish Deep with tan ink
      won. Nothing linked to them, none was in sitemap.xml, and all were
      `noindex` -- but a duplicate front door in the deploy root on launch day
      is a cost whose only defence is a meta tag.

      **WHAT WAS CHECKED BEFORE DELETING, because the old version of this item
      warned that deleting could throw away the answer along with the question.**
      Sample G's `<style>` block held eight ink tokens that existed nowhere
      else. They are in `assets-source/ui.css` now -- `--ink:#E4DCCC`,
      `--ink-2:#D4CCBC`, `--ink-soft:#E0D8C8` and the rest, with the whole
      derivation from the `#A8A090` sampled off Trubbish's sprite preserved in
      the comment above them. Nothing was lost.

      **AND THE THREE CONTRAST RULES THE SAMPLES FOUND, WHICH WERE THE REAL
      REASON NOT TO DELETE CARELESSLY.** Three rules wrote a SURFACE token
      where a foreground belonged: fine on the light palette shipping at the
      time, illegible on every dark one, from 1.03:1 to 1.27:1. A dark palette
      then DID ship, so all three were live bugs waiting to happen. All three
      are fixed in ui.css itself rather than in a sample that was about to be
      deleted: `.hofx-t` and `footer .soc svg` now take `var(--chrome-ink)`,
      and `.hero-cta` went away entirely with the "Rip it open" CTA. Verified
      before deletion, 19 August 2026.

- [x] **THE THREE RIP BUTTON SAMPLE PAGES ARE DELETED AND THE ANSWER IS
      SHIPPED.** Done 19 August 2026, so `ls public/preview-*.html` returns
      SEVEN again and the item above is the whole list once more.

      Tim asked for the play buttons to be re-thought "as a click to rip pack
      button", was shown A (Rip strip), B (Pull tab) and C (Open bar), and
      picked none of them: "I dont really like any of the verisons you did for
      the play button change, but I do like the 'Click To Open Pack' banner on
      the video pages themselves, can we carry that accross to the home page,
      and remove the 'Rip it open' ctas all together not needed just that one
      banner acorss the bottom".

      So the control on every video artwork on this site is now the banner the
      RIP PAGES ALREADY HAD, `.pack-hint`, reading CLICK TO RIP THE PACK. It is
      the same class and the same string re-used rather than a fourth design:
      `RIP_BANNER` in shared/format.mjs holds the markup, `.pack-hint` in
      assets-source/ui.css holds the rules, and all seven emitters that used to
      write `<span class="play"></span>` write the banner instead. `.play` and
      `.hero-cta` no longer exist anywhere in the tree.

      **THE SIX, for the next person who has to change this element.** It was
      seven until 19 August 2026, and the seventh is the lesson:

          scripts/build-proto.mjs     the Hall of Fame trophy, with a duration
          scripts/build-proto.mjs     the Hall of Fame trophy, without one
          scripts/build-proto.mjs     heroTile, every carousel slide
          scripts/build-proto.mjs     libCard, /videos.html's server render
          scripts/build-playlists.mjs tile(),     the 22 playlist pages
          public/assets/app.js        makeCard(), /videos.html, in the browser

      **build-proto.mjs's own tile() was on this list and had no callers.** It
      returned the `<article class="v">` grid tile, nothing in the repo invoked
      it, and no built page has ever contained its markup. It was edited in step
      during the rip-banner change anyway, because this list said to, and its
      `.v .when` chip was even repositioned to clear a banner it could never
      have collided with. Deleted, along with that rule. A list of emitters is
      a maintenance contract, so an entry that renders nothing is worse than no
      entry: it recruits work forever and looks correct while doing it.

      The last one is still the one that gets missed, because it is the only
      emitter that is not a builder: /videos.html renders its grid from JSON
      after load and re-renders on every filter change. Six of the seven now
      import one constant; the seventh cannot and carries a comment saying so.
      Verified after the change by filtering /videos.html in headless Chrome and
      diffing the re-rendered tile against the server-rendered one: same
      children, same classes, same words, 48 banners, 0 discs.

      **AND ONE THING THESE FOUND THAT OUTLIVED THEM.** Measured against all
      nineteen pack wrappers at every real art width on the site: the play disc
      was one edge colour, white, so at its worst point on its own perimeter it
      cleared **1.00:1** against the artwork under it, and up to 48% of that
      perimeter sat under 3:1. The banner replaces that with two edge colours, a
      near-white 2px ring outside a near-black 3px keyline, which are 14.6x
      apart in luminance, so whatever pixel they land on the better of the two
      clears **3.82:1** and the floor stops depending on the artwork at all.
      The label is 7.22:1 at rest and 8.04:1 on hover, everywhere, because the
      bar is opaque. The rip pages' own banner gained the ring in the same edit
      and went 2.50:1 to 3.35:1 at its worst (ascended-heroes); nothing else
      about it moved.

      **THE SEVEN SAMPLE PAGES AND THEIR GENERATOR ARE DELETED**, 19 August
      2026, and the contrast numbers above are the part that outlived them.
      They had already gone stale before they went: the generator transformed
      the BUILT home page, so every copy on disk still showed white play discs
      and "Rip it open" pills on a home page that has neither. There is nothing
      left to re-run and nothing depends on them. The palette itself, and the
      derivation of every value in it, is in assets-source/ui.css.

- [ ] **Run the build and let it check itself.**

      node scripts/build-all.mjs

      That is the whole chain, ending in check-build.py. Do not run
      builders by hand instead: an earlier version of this file listed seven
      commands, which missed most of the site, and the nightly workflow made the
      same mistake in a different way by keeping its own copy of the list.

- [ ] **Flip the flag, in the same commit as the build.**

      shared/site.mjs -> export const LIVE = true;

      Then rebuild. See DEPLOY.md for the full sequence and the checks that
      prove it landed. The important one:

      grep -rl "github.io" public/ | grep -v assets    # must return nothing

      **This has been rehearsed twice, and the second one is the one that
      counts.** The 14 August rehearsal was against a DIFFERENT domain string,
      because the domain was still garbagerips585.com then; it proved the
      mechanism but not the address. So it was run again on 19 August 2026, from
      `git archive HEAD` rather than from the working tree, so no half-written
      file could make a failure ambiguous. Flipped, fully rebuilt: build-all
      exit 0, check-build exit 0, `public/CNAME` -> `garbagerips.com`,
      robots.txt open with the sitemap line, 1,268 sitemap entries every one on
      the real domain, zero on github.io, and the canonical correct on all three
      hand-maintained pages. The `grep -rl github.io` proof returns nothing --
      it did NOT before the palette samples were deleted, which is the whole
      reason they went first.

      Run the greps anyway on the day: they are what proves it, and a rehearsal
      is not the thing itself. The sitemap count moves as videos are tagged, so
      treat 1,268 as a floor and not as a target to match.

- [ ] **Check the pages nobody generates.** index.html, videos.html and
      playlists.html are hand maintained. They are in build-proto.mjs's rewrite
      list so the flip reaches them, but they are also the three most likely to
      drift, so open them and look at the canonical.

- [ ] **Search Console after the flip, never before.** robots.txt says
      Disallow: / until LIVE is true, and submitting a sitemap while it does
      teaches Google the site is closed.

## 3b. What only Tim can do, from the overnight sweep of 19 to 20 August

Everything an agent could fix is fixed and deployed. These four need him.

- [ ] **211 of 317 rip pages cannot say whether the pack hit**, because `hasHit`
      is filled on 106 videos in the sheet. "Unknown" and "nothing came out"
      currently look identical, which is the one place that family is not honest
      by construction. It is data entry, and it would also take /luck.html from
      a 33% sample to a complete one.

- [ ] **About 200 playlist tiles read as dates instead of pack numbers**, e.g.
      "Perfect Order ETB (May 3, 2026)" nine times in a row. Tim's own YouTube
      titles carry the number, but `shared/riplabel.mjs` records his standing
      instruction of 18 August not to publish a PARSED pack number, so it prints
      one only from a typed `Product #` and `Pack #`. Four Chaos Rising videos
      already have them and render "Chaos Rising ETB 3 - Pack 1" correctly.
      Filling those two columns converts the rest.

- [ ] **/vendors.html and /creators.html hold three distinct people between
      them**, and both sit in the primary nav on all 1,478 pages. Toak Pulls is
      on both. Every other list page on the site states its count up front; these
      two are the only ones that do not, which reads as the page knowing it is
      thin. A content-supply problem, not a writing one.

- [ ] **Three playlists hold one or two videos each** and promise a hunt. They
      are cheap and harmless and they are index padding until there is more in
      them.

## 4. Upkeep, and the one item with a date on it

- [ ] **THE DROPS BAND ON THE HOME PAGE COMES OFF ON 24 AUGUST 2026 UNLESS
      data/drops.json IS REFRESHED.** This is the only thing on the site with a
      fixed expiry, and it lands three days after launch.

      `data/drops.json` was compiled 17 August for the week ending 23 August.
      Launch day, 21 August, is inside that window, so the front door is correct
      on the day. From the 24th the home page's sweep removes the whole band
      rather than showing a passed week, and /drops.html bands itself as stale
      and switches its heading to the past tense. **Both behaviours are correct
      and neither is a bug**: a restock page showing last week is worse than no
      restock page, because it sends somebody to a shop for nothing. Nothing
      breaks, nothing looks broken, and the front door just quietly has one
      section fewer.

      The fix is a weekly hand edit: re-read the restock trackers, update
      `weekOf`, `weekEnds`, `compiled`, `source.read` and the rows, rebuild.
      data/drops.json's own `_readme` is long and worth re-reading before the
      first refresh, particularly the rule about keeping the hedges the original
      post was written in.

      **Nothing reminds you.** The nightly refresh syncs YouTube and prices; it
      cannot read a private community's week-ahead post, and the file explains
      at length why no part of this can be automated. If a weekly edit is not
      realistic, the honest alternative is to drop the band from the home page
      and leave /drops.html to carry it, rather than to let the front door
      depend on an edit that may not happen.

- [x] **THE BIGGEST REMAINING SPEED WIN. Taken on 20 August 2026, and it was
      HALF the size this item claimed.** A grid tile's pack artwork is an
      `<img loading="lazy">` inside the same facade now, and packs.css takes the
      background off exactly those tiles at `.pack--<set>.pack--tile.pack--img`.
      Cache off, no scroll, network left to go quiet, gzipped:

          /videos.html    390x844 DPR2   435.2 -> 231.7KB   20 -> 15 requests
          /videos.html    1440x900       435.2 -> 312.2KB   20 -> 17 requests
          /playlists.html 390x844 DPR2   606.8 -> 408.5KB   24 -> 19 requests

      Fully scrolled is unchanged to within 1.3KB, which is the markup. It is a
      deferral, not a saving, exactly as the /rarity.html entry in CLAUDE.md
      insists about its own numbers.

      **THE RIP PAGES WERE THE HALF THAT WAS WRONG AND THEY GAINED NOTHING.**
      This item said 38.8KB on each of 317 of them. The tile is real, but it
      sits at y=1774 at 390 and y=1296 at 1440, which is 930 and 396 pixels
      below the fold against Chrome's 1250px lazy threshold on a 4G connection,
      so it is fetched immediately whatever the attribute says. And 248 of the
      279 rip pages that carry rails draw every tile in the hero's own set, so
      the rails cost ONE file either way. Measured after the change: 315.1 ->
      317.4KB, the markup and nothing else. The tiles are images anyway, so the
      component has one behaviour, but do not quote a saving for that family.

      **THE SECOND THING THIS ITEM DID NOT KNOW is that /playlists.html was the
      heaviest page in the whole change**: 477.2KB of pack art on a 606.8KB
      page, twelve distinct tile files, four of 22 tiles above the fold.

      **AND THE MEASUREMENT WINDOW IS THE TRAP.** An off-screen background
      arrives SECONDS after the load event, so a 2.5 second window catches two
      or three of the seven and reads exactly like a browser that is already
      deferring the rest. Wait for the network to go quiet.

      **EVERY TILE IS LAZY, THE ABOVE-FOLD ONES INCLUDED, AND THAT IS THE
      OPPOSITE OF WHAT THE OBVIOUS RULE SAYS.** Marking the first four eager
      moved ZERO bytes, to a tenth of a kilobyte, on every page and both
      viewports, and cost 592ms of LCP on /videos.html and 748ms of first paint
      on /playlists.html, on Slow 4G with a 4x CPU slowdown over HTTP/2. An
      eager tile is found by the preload scanner during the HTML parse and
      spends the pipe the render-blocking stylesheet is still waiting on. The
      full argument is in `packTileImg` in shared/format.mjs.

      **WHAT WAS DELIBERATELY NOT CONVERTED**, because none of it is on a load
      path this helps and all of it is risk: the rip page's own hero pack (above
      the fold, its page's LCP element, preloaded by name), the packshots on the
      set guides and the imported guides, the 404 pack, the facade
      `playInTile` mounts in packplayer.js on a click, and the tiles app.js
      renders in the browser. The last two are why `.pack--img` is opt IN: a
      tile without it keeps its background, so app.js did not have to change and
      cannot drift from the server render.

- [ ] **/upcoming.html's product thumbs are soft and that is a quality call,
      not a speed one.** TCGplayer `_200w.jpg` goes into a 152px box, which
      needs 304 at DPR 2. The full rendition is 14.0x the bytes, +1,448KB
      across 17 images on a page that loads in 205KB today. `_400w.jpg` is the
      honest middle at +218KB, still a 64% heavier page. Sharpness against
      weight, on a page whose job is telling you what is coming.

- [ ] **ONE PRICE FEED FOR GRADED CARDS, WHICH THE SITE CURRENTLY HAS TWO OF.**
      Mega Greninja ex reads $906 on /hall.html and $838 on its set guide. Both
      are sourced and dated: the hall moved to PriceCharting on 18 August and
      nothing else did. Every page now names whose figure it is printing, so
      the gap is legible rather than contradictory, but it is still two answers
      to one question.

      **Do not fix it by picking a feed.** `data/graded.json` is deliberately
      scoped to cards Tim has actually pulled, 83 records, because a
      PriceCharting product page is about 1MB and crawling their index would be
      4.4GB. The guides need 99 figures across 28 sets, so switching them to
      PriceCharting would strand most of them: a worse inconsistency than the
      one it fixes.

      The fix is coverage, and it is small. Extend `sync-pricecharting.mjs`'s
      scope from "cards we pulled" to "cards we pulled PLUS each guide's eight
      chase rows": about 99 more product pages, roughly 99MB, three orders of
      magnitude inside the budget that script's own comment rejects. Then
      PriceCharting covers the hall and the guides alike, the site's stated
      policy of PriceCharting for raw and graded singles holds for the first
      time, and `data/psa10.json` becomes the fallback for what the crawl
      misses rather than the primary source.

      **The two feeds are not far apart, which is why this is upkeep and not a
      launch blocker.** Measured across all 39 cards both price above the
      ten-sale floor the guides apply: median disagreement 2.3%, 35 of 39
      within 10%, worst 16.2%. The four largest gaps in the whole overlap sit
      BELOW the floor and never render, one of them on a single recorded sale.

- [ ] Blog posts for search traffic: set reviews, "is this box worth it",
      the Rochester local angle. Each embeds a video.
- [ ] Monthly price refresh, so the set guides and the Card Hall of Fame do not
      quietly go stale.
- [ ] A per-set wrapper for Paldea Evolved is the only pack artwork still
      missing. `default` and `multi` are in.
- [ ] Decide on one spelling of the name. The sticker says GarbageRips585, the
      channel says Garbage Rips 585, and search engines treat them as two things.
