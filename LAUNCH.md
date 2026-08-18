# Launch checklist

Everything that has to happen before garbagerips585.com is live, and the things
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

- [ ] **Domain: garbagerips585.com.** Every canonical, the sitemap and the Open
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
      `https://garbagerips585.com/sitemap.xml`. Without this the set guides,
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

- [ ] **DELETE THE SEVEN PALETTE SAMPLE PAGES. Do this one first.** They are the
      only files in the deploy root that are not part of the site:

          rm public/preview-midnight.html public/preview-charcoal.html \
             public/preview-charcoal-a.html public/preview-charcoal-b.html \
             public/preview-trubbish.html public/preview-trubbish-2.html \
             public/preview-tan.html
          rm scripts/gen-palette-samples.mjs
          node scripts/build-all.mjs

      Added 18 August 2026 so Tim could compare palettes on his own phone, which
      needs a real url and therefore a real deploy. **It started as two and grew
      to six in one day**, which is the reason this item is worth re-reading
      rather than skimming: Midnight and Charcoal first, then Tim picked
      Charcoal and asked for two accent variants of it, then asked for a page in
      the mascot's colours, then picked that one and asked for a version with
      the gold taken out of it. The list is:

          preview-midnight.html      A  Slushie Midnight
          preview-charcoal.html      B  Slushie Charcoal, the baseline
          preview-charcoal-a.html    C  Charcoal Aqua
          preview-charcoal-b.html    D  Charcoal Quiet
          preview-trubbish.html      E  Trubbish
          preview-trubbish-2.html    F  Trubbish Deep, the one that shipped
          preview-tan.html           G  Trubbish Deep with a TAN ink

      **AND THEN IT GREW TO SEVEN, WHICH IS THE SECOND TIME THIS COUNT HAS GONE
      STALE.** G was added 18 August 2026 and it is not the same KIND of thing
      as A to F, which is why it is worth two paragraphs rather than a row.
      Tim, looking at /msrp.html: "all the white text, can we change it from
      white to be a light tan or light beige color, that way its not stark
      bright white on a dark green ... less harsh on the eyes and even more on
      theme with our masscot". So G is not a candidate palette. It is the
      palette that ALREADY SHIPPED with one family of tokens moved, and it is a
      repaint of /msrp.html rather than the home page because that is the page
      of body copy he was reading when he asked.

      **THE THING THAT MAKES G DIFFERENT AT DELETION TIME.** A to F are dead
      weight: the palette they were choosing between is in assets-source/ui.css
      now, so deleting them loses nothing. G's `<style>` block holds EIGHT token
      values that exist nowhere else. If Tim says yes, those eight go into
      ui.css's `:root` and the ink change is done in one edit; if he says no,
      the file just goes. Either way, DECIDE BEFORE DELETING, or the answer is
      thrown away with the question. The values, and the whole derivation from
      Trubbish's own sprite, are in the G block of scripts/gen-palette-samples.mjs.

      They are six extra copies of the home page and one of /msrp.html. All are `noindex,nofollow`,
      none is in sitemap.xml, and nothing on the site links to them: they link
      to each other in a ring and to nothing else. So they are quiet rather than
      harmless. A duplicate front door in the tree on launch day is a cost, and
      the only thing keeping it out of an index is a meta tag. Once Tim has
      picked, they have no job.

      **THE COUNT IS THE THING THAT GOES STALE HERE.** It already has: this item
      said FIVE while six were on disk, and then it said SIX while seven were on
      disk, which is exactly the failure it warns about, twice. If another
      variant is added, add it to the list above in the same edit, or this
      checklist will confidently delete six of eight.
      `ls public/preview-*.html` is the check that cannot drift, and
      gen-palette-samples.mjs now prints its own count rather than a typed one.

      **AND ONE THING THE SAMPLES FOUND THAT OUTLIVES THEM.** Three rules in
      assets-source/ui.css write a SURFACE token as ink, which is correct on the
      light palette shipping today and illegible on every dark one:
      `.hero-cta{color:var(--ink)}` (nine buttons on the home page, 1.11:1 to
      1.27:1 depending on the palette), `.hofx-t{color:var(--paper)}` (the Hall
      of Fame trophy title, as low as 1.03:1) and
      `footer .soc svg{fill:var(--paper)}` (the four footer social glyphs,
      1.10:1). Sample F overrides all three in its own block. **If a dark
      palette ships, those three rules have to be fixed in ui.css itself**, or
      deleting the samples takes the fixes with them.

      Nothing else has to change with them. Each palette lives in that file's
      own `<style>` block, so assets-source/ui.css was never touched and
      deleting the five files removes every trace. **Deleting them does NOT
      apply whichever one Tim picks**: that is a separate edit to
      assets-source/ui.css, and for C, D or E it is two accent rules plus, for
      E, a token block. The rules as built are in the header of
      scripts/gen-palette-samples.mjs, so read that file before deleting it.

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

      **This has been rehearsed.** On 14 August 2026 a throwaway copy of the
      tree was flipped and fully rebuilt: every builder green, check-build clean,
      zero github.io references anywhere in public/, 1,696 urls on the real
      domain, 379 sitemap entries, robots.txt open, CNAME written. So the flip
      is known to work end to end, but run the greps anyway: they are what
      proves it on the day.

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
