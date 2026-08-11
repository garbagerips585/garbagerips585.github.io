# Launch checklist

Everything that has to happen before garbagerips585.com is live, and the things
worth doing soon after. Nothing here is code: the site builds and runs locally
today. These are the accounts, the money, and the content only Tim can supply.

Ticked items are done. Run `node scripts/build-proto.mjs` after any data change
and everything regenerates.

---

## 1. Accounts and money

- [ ] **GitHub account and repo.** The repo has 60-odd commits on `main` and no
      remote, so nothing is backed up anywhere but this laptop. That is the
      single biggest risk right now: a dead disk loses everything. Create the
      repo, then decide public or private. Cloudflare Pages works with either.
      Private is the safer default until launch.

- [ ] **Domain: garbagerips585.com.** Every canonical URL, the sitemap, and the
      Open Graph tags already point at it, so social previews and search will
      only resolve once it exists. Buy it anywhere; Cloudflare Registrar sells
      at cost and keeps DNS in one place.

- [ ] **Cloudflare Pages.** Connect the repo. Build command `exit 0`, output
      directory `public`. The `exit 0` matters: a blank build command disables
      Functions, and `/api/latest` is a Function. Full walkthrough in DEPLOY.md.

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

- [ ] **Roll the new design across the rest of the site.** The home page,
      /wanted.html, /shops.html and /hall.html use the current design. The
      library, the playlists page, the 23 set guides and all 308 rip pages still
      use the older `site.css` look, so clicking any tile leaves the new site
      and lands in the old one. This is the most visible unfinished thing.

- [ ] **Re-run the whole build chain and check nothing 404s.**

      node --env-file=.env scripts/sync-youtube.mjs
      node scripts/build-pages.mjs
      node scripts/sync-sets.mjs && node scripts/build-set-pages.mjs
      node --env-file=.env scripts/sync-prices.mjs
      node scripts/sync-wanted.mjs && node scripts/build-wanted.mjs
      node scripts/build-hall.mjs && node scripts/build-shops.mjs
      node scripts/build-proto.mjs

- [ ] **Check `.env` never leaves the laptop.** It holds `YT_API_KEY` and
      `PPT_API_KEY` and is gitignored. Confirm with `git status` before the
      first push that neither appears.

- [ ] **Test on a real phone**, not the desktop browser at a narrow width. Most
      of the audience arrives from a YouTube link on a phone.

---

## 4. Soon after launch

- [ ] Blog posts for search traffic: set reviews, "is this box worth it",
      the Rochester local angle. Each embeds a video.
- [ ] Monthly price refresh, so the set guides and the Card Hall of Fame do not
      quietly go stale.
- [ ] `default.png` and `multi.png` are in. A per-set wrapper for Paldea Evolved
      is the only artwork still missing.
- [ ] Decide on one spelling of the name. The sticker says GarbageRips585, the
      channel says Garbage Rips 585, and search engines treat them as two things.
