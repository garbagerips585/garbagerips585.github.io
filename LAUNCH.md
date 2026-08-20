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

- [ ] **Domain: garbagerips.com.** Every canonical, the sitemap and the Open
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

- [ ] **Tag the 43 remaining videos.** The biggest single lever on the site. An
      untagged video is published `noindex` and kept out of the sitemap, so it
      cannot rank, cannot be filtered, and cannot reach the Hall of Fame. 269 of
      312 are tagged today. Seven of the 43 carry a pull tag, so they are hits
      being held back.

      `UNTAGGED.md` is regenerated on every build and lists all 43 with the
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

- [ ] **Add more Rochester card shops.** Three are listed: Just Games,
      Millennium Games and LingSter Games. `pokemon card shop rochester ny` is a
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

## 4. Soon after launch

- [ ] Blog posts for search traffic: set reviews, "is this box worth it",
      the Rochester local angle. Each embeds a video.
- [ ] Monthly price refresh, so the set guides and the Card Hall of Fame do not
      quietly go stale.
- [ ] A per-set wrapper for Paldea Evolved is the only pack artwork still
      missing. `default` and `multi` are in.
- [ ] Decide on one spelling of the name. The sticker says GarbageRips585, the
      channel says Garbage Rips 585, and search engines treat them as two things.
