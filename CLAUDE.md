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

## Current state
Single static index.html + assets/. Sections: hero (flippable GMAX card,
normal -> rainbow on click, 3D tilt + holo shine), Rochester skyline SVG,
ROC ticker marquee, watch (uploads player + Shorts feed + HITS ONLY block),
"Anatomy of a Rip" plate diagram, socials-as-diner-menu, banner strip,
585 hometown section (oval sticker), footer. Organization JSON-LD with
sameAs is in <head>.

## TODO (rough priority)
1. Hits Only playlist embed: search index.html for "HITS ONLY PLAYER" —
   a comment shows the swap. Need the playlist ID from Tim (list=PL...).
2. Domain + deploy: garbagerips585.com target; Cloudflare Pages or
   Netlify drag-and-drop. Then Search Console + sitemap.xml + robots.txt.
3. og:image (use assets/banner-trubbish.jpg or a 1200x630 crop) + favicon
   (Trubbish from logo-square.jpg works).
4. About page: Rochester story, E-E-A-T, link everything.
5. Blog for actual search traffic: set reviews, pull rates, "Pokemon card
   shops Rochester NY" local angle. Each post embeds a video.
6. Consider migrating to Astro if the blog grows (keep it static).
7. Naming consistency: "GarbageRips585" (one word, on sticker) vs
   "Garbage Rips 585" (spaced, on YouTube). Tim to pick one for H1/metadata.

## Gotchas
- Shorts playlist embed plays in a normal player, not the Shorts UI.
- prefers-reduced-motion: ticker and card tilt must stay disabled; card
  flip stays enabled.
- Keep page weight low; images are pre-compressed in assets/.
