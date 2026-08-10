# Garbage Rips 585 — brand hub site

Content hub + SEO home for Garbage Rips 585, a Pokemon card pack-ripping
channel from Rochester, NY (owner: Tim). Not an ecommerce site — the job is
brand entity SEO and funneling visitors to the channel and socials.

## Brand
- Voice: fun, chaotic, zero gatekeeping. Rochester references everywhere:
  Garbage Plate, 585 area code, Flower City, High Falls, Public Market,
  Wegmans, lake-effect weather, Trubbish/Garbodor as unofficial city Pokemon.
- Palette (sampled from commissioned art): sludge bg #1E2419 / #2A331F,
  trubbish olive #616A4F / #7C8A5F, gold #F5A62B, navy #22384F,
  ketchup #D9482B, mustard #EFC94C, paper cream #F1EDD2.
- Fonts: Titan One (display), Outfit (body), Space Mono (labels/ticker).
- Copy style: no em dashes in written copy. Natural, human tone.
- Art credit: card + sticker illustrations by Unableplacebo (commissioned).
  Footer must keep: "Fan content. Not affiliated with The Pokemon Company".

## Channels
- YouTube: https://www.youtube.com/@GarbageRips585
  (channel ID UCnpEGJ2G_0af1YRyW2euIZQ)
- Instagram: https://www.instagram.com/garbagerips585/
- TikTok: https://www.tiktok.com/@garbagerips585
- Facebook: https://www.facebook.com/GarbageRips585

## How the feeds work (no API keys)
YouTube auto-playlists derived from the channel ID:
- All uploads: UUnpEGJ2G_0af1YRyW2euIZQ
- Shorts only: UUSHnpEGJ2G_0af1YRyW2euIZQ
- Long-form only: UULFnpEGJ2G_0af1YRyW2euIZQ
Embedded via /embed/videoseries?list=... so they self-update.
RSS is also available: youtube.com/feeds/videos.xml?channel_id=UC...

## Layout
```
public/     deployed static root (index, videos, playlists, assets/, data/)
functions/  Cloudflare Pages Functions. MUST stay outside public/
scripts/    sync-youtube.mjs, local only, needs YT_API_KEY in the environment
shared/     taxonomy.mjs, the set/product tag rules, imported by both
```
Cloudflare settings: build command `exit 0`, output directory `public`.

## Video data
- `public/data/videos.json` is the whole catalogue, `playlists.json` the
  playlists. Both are written by `scripts/sync-youtube.mjs`.
- Tags (card set, product type, pull grade) are derived from title plus
  description by `shared/taxonomy.mjs`. Coverage is roughly 90% when the
  description is available, about 50% from titles alone. Hand corrections go
  in `data/overrides.json` and always win.
- `/api/latest` proxies the YouTube RSS feed (no key) and layers the newest
  uploads over the committed JSON. The feed sends no CORS headers, which is
  why the proxy has to exist. Production only; locally it 404s and the site
  falls back, which is intended.

## Video display rules (these were measured, do not "fix" them)
- Thumbnails come from `i.ytimg.com/vi_webp/<id>/oardefault.webp`, falling
  back to `oardefault.jpg` then `maxresdefault.jpg`. "oar" is the only
  variant at the video's true vertical shape; hqdefault and maxresdefault are
  4:3 and 16:9 crops that letterbox a Short.
- Grid tiles are **2:3**, not 9:16. YouTube, Instagram and TikTok all crop
  vertical video for grids; a true 9:16 tile is 1.78x tall and turns the page
  into a wall of skinny rectangles. The player opens to 9:16 on click so
  playback has no bars.
- Columns: 6 / 4 / 3 / 2, matching YouTube's own Shorts grid.
- Never put live iframes in a grid. One player is ~540KB, so the grid is a
  click-to-load facade and only one player is ever live at a time.
- `modestbranding` is deprecated and does nothing. `rel=0` still scopes end
  screens to this channel.
- 261 of 262 videos are vertical. The one exception is `kj7532tb0_I`.

## Current state
Single static index.html + assets/. Sections: hero (flippable GMAX card,
normal -> rainbow on click, 3D tilt + holo shine), Rochester skyline SVG,
ROC ticker marquee, watch (uploads player + Shorts feed + HITS ONLY block),
"Anatomy of a Rip" plate diagram, socials-as-diner-menu, banner strip,
585 hometown section (oval sticker), footer. Organization JSON-LD with
sameAs is in <head>.

Also at root: favicon.ico / favicon-32.png / apple-touch-icon.png (all
cropped from Trubbish's face in logo-square.jpg), robots.txt, sitemap.xml.
assets/og-image.jpg is a 1200x630 crop of banner-trubbish.jpg, wired up as
og:image and twitter:image. Absolute URLs throughout point at
https://garbagerips585.com, so social previews only resolve once the domain
is live.

## Local preview
`node .claude/server.js` (port 4585), or the "grips" entry in the parent
Codex .claude/launch.json. .claude/ is gitignored, so it never deploys.

## Deploy
Git repo, main branch. Target is Cloudflare Pages with build command blank
and output directory `/`. Full walkthrough in DEPLOY.md.

## TODO (rough priority)
1. Hits Only playlist embed: search index.html for "HITS ONLY PLAYER" —
   a comment shows the swap. Need the playlist ID from Tim (list=PL...).
2. Buy garbagerips585.com, attach it in Cloudflare Pages, then verify in
   Google Search Console and submit sitemap.xml. See DEPLOY.md.
3. About page: Rochester story, E-E-A-T, link everything.
4. Blog for actual search traffic: set reviews, pull rates, "Pokemon card
   shops Rochester NY" local angle. Each post embeds a video.
   Add each new page to sitemap.xml.
5. Consider migrating to Astro if the blog grows (keep it static).
6. Naming consistency: "GarbageRips585" (one word, on sticker) vs
   "Garbage Rips 585" (spaced, on YouTube). Tim to pick one for H1/metadata.

## Gotchas
- Shorts playlist embed plays in a normal player, not the Shorts UI.
- prefers-reduced-motion: ticker and card tilt must stay disabled; card
  flip stays enabled.
- Keep page weight low; images are pre-compressed in assets/.
