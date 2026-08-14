# Launch checklist

Everything that has to happen before garbagerips585.com is live, and the things
worth doing soon after. Nothing here is code: the site builds and runs locally
today. These are the accounts, the money, and the content only Tim can supply.

Ticked items are done. Run `node scripts/build-proto.mjs` after any data change
and everything regenerates.

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
      issues the certificate and handles HTTPS. The site used to be documented
      as a Cloudflare Pages deploy, which it never was, and `functions/` and
      `/api/latest` have been deleted because only Cloudflare could run them.

- [ ] **pokemonpricetracker.com paid plan, $9.99/mo.** The free tier is 100
      credits a day and a card costs 2, so a full refresh of all 155 chase cards
      takes four days. That is fine while building and wrong once live, because
      prices move and the site would always be showing last week's. One month of
      the paid tier also backfills everything in a single run.

- [ ] **TCGplayer affiliate via Impact.** Plumbing is built and switched off in
      `data/affiliate.json`. Turn `enabled` on and set the link template; the FTC
      disclosure then renders by itself. Worth doing after launch, not before:
      the application asks for a live site.

- [ ] **Google Search Console.** Verify the domain, submit
      `https://garbagerips585.com/sitemap.xml`. Without this the set guides,
      which are the SEO half of the site, are invisible for months.

---

## 2. Content only Tim can supply

- [ ] **Tag the 61 untagged videos.** The biggest single lever on the site. An
      untagged video cannot be filtered and cannot reach Greatest Hits. Eight of
      them are graded hits currently locked out of the home page; every build
      prints the list.

- [ ] **Fill in the Chase Cards tab.** Marks cards for the Card Hall of Fame
      (/hall.html is empty until then) and for Most Wanted.

- [ ] **Fill in the Set Notes tab.** Whether each set is still in print and what
      a pack costs. The card database carries neither, so 23 set guides are
      leaving those lines out.

- [ ] **Create the Greatest Hits playlist on YouTube.** Until it exists the home
      page ranks by pull tier then views, which is a decent stand-in but not
      Tim's own pick.

- [ ] **Add the rest of the Rochester card shops.** Two are listed.
      `pokemon card shop rochester ny` is a real search with real intent, and
      that page is the best local-SEO asset on the site.

- [ ] **Write the About page.** Referenced in the original plan, still missing.
      It is what search engines read to work out who this site belongs to.

---

## 3. Before flipping it on

- [ ] **Run the build and let it check itself.**

      node scripts/build-all.mjs

      That is the whole chain, 31 steps, ending in check-build.py. The old
      version of this file listed seven commands by hand, which missed most of
      the site: following it after the flip would have left roughly 380 of 425
      pages canonicalising to the staging host.

- [ ] **Flip the flag, in the same commit as the build.**

      shared/site.mjs -> export const LIVE = true;

      Then rebuild. See DEPLOY.md for the full sequence and the four checks
      that prove it landed. The important one:

      grep -rl "github.io" public/ | grep -v assets    # must return nothing

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
- [ ] `default.png` and `multi.png` are in. A per-set wrapper for Paldea Evolved
      is the only artwork still missing.
- [ ] Decide on one spelling of the name. The sticker says GarbageRips585, the
      channel says Garbage Rips 585, and search engines treat them as two things.
