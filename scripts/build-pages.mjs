#!/usr/bin/env node
// Generate one page per rip, plus the sitemap.
//
//   node scripts/build-pages.mjs
//
// Needs no API key: it reads what sync-youtube.mjs already wrote. EVERY video
// gets a page, so clicking a tile anywhere on the site never bounces the
// visitor out to youtube.com. Videos missing a set or product tag are marked
// noindex and kept out of the sitemap, since they are too thin to rank.
// Tag them (see UNTAGGED.md) and re-run to promote them.

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { labelFor } from "../shared/taxonomy.mjs";
import { ripPath } from "../shared/paths.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://garbagerips585.com";
const OUT = join(ROOT, "public/rip");

const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const descriptions = JSON.parse(await readFile(join(ROOT, "data/descriptions.json"), "utf8").catch(() => "{}"));

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pathFor = (v) => v.path || ripPath(v);

function isoDuration(sec) {
  if (!sec) return null;
  const m = Math.floor(sec / 60), s = sec % 60;
  return `PT${m ? m + "M" : ""}${s}S`;
}

const tagged = videos.filter((v) => v.sets.length && v.products.length);
const taggedIds = new Set(tagged.map((v) => v.id));
const byId = new Map(videos.map((v) => [v.id, v]));
const bySet = new Map();
for (const v of tagged) {
  for (const s of v.sets) {
    if (!bySet.has(s)) bySet.set(s, []);
    bySet.get(s).push(v);
  }
}

const NAV = `<nav class="site" aria-label="Main">
  <div class="nav-in">
    <a class="logo" href="/">GARBAGE <span>RIPS</span> 585</a>
    <form class="search" data-route role="search">
      <svg aria-hidden="true"><use href="#i-search"/></svg>
      <label class="sr-only" for="navSearch">Search every rip</label>
      <input id="navSearch" type="search" placeholder="Search rips, sets, boxes...">
    </form>
    <button class="nav-toggle" aria-expanded="false" aria-label="Menu"><svg aria-hidden="true"><use href="#i-menu"/></svg></button>
    <ul class="nav-links">
      <li><a href="/">Home</a></li>
      <li><a href="/videos.html">All Rips</a></li>
      <li><a href="/playlists.html">Playlists</a></li>
      <li><a href="/#plate">The Plate</a></li>
      <li><a href="/#five85">The 585</a></li>
    </ul>
    <div class="nav-social">
      <a href="https://www.youtube.com/@GarbageRips585" aria-label="YouTube"><svg aria-hidden="true"><use href="#i-yt"/></svg></a>
      <a href="https://www.instagram.com/garbagerips585/" aria-label="Instagram"><svg aria-hidden="true"><use href="#i-ig"/></svg></a>
      <a href="https://www.tiktok.com/@garbagerips585" aria-label="TikTok"><svg aria-hidden="true"><use href="#i-tt"/></svg></a>
      <a href="https://www.facebook.com/GarbageRips585" aria-label="Facebook"><svg aria-hidden="true"><use href="#i-fb"/></svg></a>
    </div>
  </div>
</nav>`;

const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-yt" viewBox="0 0 24 24"><path d="M23 12s0-3.8-.5-5.6a2.9 2.9 0 0 0-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.5a2.9 2.9 0 0 0-2 2C1 8.2 1 12 1 12s0 3.8.5 5.6a2.9 2.9 0 0 0 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.5a2.9 2.9 0 0 0 2-2C23 15.8 23 12 23 12zM9.8 15.4V8.6l5.8 3.4z"/></symbol>
  <symbol id="i-ig" viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.2A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4zm0 10.9A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3zm8.4-11.2a1.5 1.5 0 1 1-1.5-1.5 1.5 1.5 0 0 1 1.5 1.5z"/></symbol>
  <symbol id="i-tt" viewBox="0 0 24 24"><path d="M16.6 2h-3.1v13.2a2.6 2.6 0 1 1-2.2-2.6V9.4a5.9 5.9 0 1 0 5.3 5.9V8.7a7 7 0 0 0 4.1 1.3V6.9a3.9 3.9 0 0 1-4.1-3.9z"/></symbol>
  <symbol id="i-fb" viewBox="0 0 24 24"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><path d="M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z"/></symbol>
  <symbol id="i-menu" viewBox="0 0 24 24"><path d="M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z"/></symbol>
</svg>`;

const FOOTER = `<footer>
  <div class="wrap">
    <p class="foot-tag">Grab a fork. Let's rip.</p>
    <div class="foot-social">
      <a class="soc yt" href="https://www.youtube.com/@GarbageRips585" aria-label="YouTube"><svg aria-hidden="true"><use href="#i-yt"/></svg></a>
      <a class="soc ig" href="https://www.instagram.com/garbagerips585/" aria-label="Instagram"><svg aria-hidden="true"><use href="#i-ig"/></svg></a>
      <a class="soc tt" href="https://www.tiktok.com/@garbagerips585" aria-label="TikTok"><svg aria-hidden="true"><use href="#i-tt"/></svg></a>
      <a class="soc fb" href="https://www.facebook.com/GarbageRips585" aria-label="Facebook"><svg aria-hidden="true"><use href="#i-fb"/></svg></a>
    </div>
    <p>&copy; <span id="year">2026</span> Garbage Rips 585 &bull; Made in the Flower City &bull; Rochester, NY<br>
    Card and sticker art by Unableplacebo. Fan content. Not affiliated with The Pokemon Company or Nintendo.</p>
  </div>
</footer>`;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const niceDate = (iso) => {
  const p = iso.split("-");
  return `${MONTHS[+p[1] - 1]} ${+p[2]}, ${p[0]}`;
};
const niceViews = (n) =>
  n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M views"
  : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K views"
  : n + " views";

function page(v, prev, next) {
  const setId = v.sets[0], prodId = v.products[0];
  // Every video gets a page so that clicking a tile never leaves the site.
  // Untagged ones are noindex: useful to a visitor, too thin for search.
  const isTagged = Boolean(setId && prodId);
  const setLabel = setId ? labelFor("sets", setId) : null;
  const prodLabel = prodId ? labelFor("products", prodId) : null;
  const desc = (descriptions[v.id] || "").trim();
  const metaDesc = desc
    ? desc.replace(/\s+/g, " ").slice(0, 155).replace(/\s\S*$/, "") + "..."
    : isTagged
    ? `${v.title} — a ${prodLabel} rip from ${setLabel}, opened on Garbage Rips 585 in Rochester, NY.`
    : `${v.title} — a Pokemon pack rip from Garbage Rips 585 in Rochester, NY.`;
  const thumb = `https://i.ytimg.com/vi/${v.id}/oardefault.jpg`;
  const url = `${SITE}/${pathFor(v)}`;

  const related = (setId ? bySet.get(setId) || [] : []).filter((x) => x.id !== v.id).slice(0, 6);

  const ld = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: v.title,
    description: desc || metaDesc,
    thumbnailUrl: [thumb],
    uploadDate: v.published,
    embedUrl: `https://www.youtube.com/embed/${v.id}`,
    url,
    ...(isoDuration(v.duration) ? { duration: isoDuration(v.duration) } : {}),
    ...(v.views ? { interactionStatistic: { "@type": "InteractionCounter", interactionType: { "@type": "WatchAction" }, userInteractionCount: v.views } } : {}),
    publisher: {
      "@type": "Organization",
      name: "Garbage Rips 585",
      url: SITE + "/",
      logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-square.jpg` },
    },
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Every rip", item: `${SITE}/videos.html` },
      ...(setId ? [{ "@type": "ListItem", position: 3, name: setLabel, item: `${SITE}/videos.html?set=${setId}` }] : []),
      { "@type": "ListItem", position: setId ? 4 : 3, name: v.title },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(v.title)} | Garbage Rips 585</title>
<meta name="description" content="${esc(metaDesc)}">${isTagged ? "" : '\n<meta name="robots" content="noindex,follow">'}
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(v.title)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:type" content="video.other">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${thumb}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(v.title)}">
<meta name="twitter:image" content="${thumb}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#1E3A54">
<link rel="preconnect" href="https://i.ytimg.com" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Titan+One&family=Outfit:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
</head>
<body>
${SPRITE}
${NAV}

<section class="rip tight${v.greatest ? " hall" : ""}">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / <a href="/videos.html">Every rip</a>${setId ? ` / <a href="/videos.html?set=${setId}">${esc(setLabel)}</a>` : ""}</p>
    <div class="rip-grid">
      <div>
        <div class="rip-player" id="player" data-id="${v.id}">
          <img src="${thumb}" alt="" width="720" height="1280" fetchpriority="high">
          <button class="pack${setId ? ` pack--${setId}` : ""}" id="pack" type="button" aria-label="Rip open: ${esc(v.title)}">
            <span class="pack-face pack-l" aria-hidden="true">
              <span class="pack-art"></span>
              <span class="pack-brand">${esc(setLabel || "GARBAGE RIPS")}<small>${setLabel ? "GARBAGE RIPS 585" : "585"}</small></span>
              <span class="pack-mascot"><img src="/apple-touch-icon.png" alt="" width="180" height="180"></span>
            </span>
            <span class="pack-face pack-r" aria-hidden="true">
              <span class="pack-art"></span>
              <span class="pack-brand">${esc(setLabel || "GARBAGE RIPS")}<small>${setLabel ? "GARBAGE RIPS 585" : "585"}</small></span>
              <span class="pack-mascot"><img src="/apple-touch-icon.png" alt="" width="180" height="180"></span>
            </span>
            <span class="pack-flash" aria-hidden="true"></span>
            <span class="pack-hint">RIP IT OPEN</span>
          </button>
        </div>
      </div>
      <div>
        <h1>${esc(v.title)}</h1>
        <div class="rip-badges">
          ${setId ? `<a class="chip" href="/videos.html?set=${setId}">${esc(setLabel)}</a>` : ""}
          ${prodId ? `<a class="chip prod" href="/videos.html?product=${prodId}">${esc(prodLabel)}</a>` : ""}
          ${v.pulls.map((p) => `<span class="chip">${esc(labelFor("pulls", p))}</span>`).join("\n          ")}
        </div>
        <p class="rip-meta">${niceDate(v.published)}${v.views ? " &bull; " + niceViews(v.views) : ""}${v.openingType ? " &bull; " + esc(v.openingType) : ""}</p>
        ${v.hitCard ? `<div class="hit-panel">
          <p class="hit-label">The hit</p>
          <p class="hit-card">${esc(v.hitCard)}</p>
          ${v.hitRarity ? `<p class="hit-rarity">${esc(v.hitRarity)}</p>` : ""}
        </div>` : v.hasHit === false ? `<p class="hit-none">No hit in this one. Certified Garbage Rip.</p>` : ""}
        ${desc ? `<div class="rip-desc">${esc(desc)}</div>` : ""}
        <div class="rip-nav">
          <a class="btn btn-yt btn-sm" href="https://www.youtube.com/channel/UCnpEGJ2G_0af1YRyW2euIZQ?sub_confirmation=1">Subscribe</a>
          ${v.affiliate ? `<a class="btn btn-sky btn-sm" href="${esc(v.affiliate)}" rel="nofollow sponsored noopener">Rip one yourself</a>` : ""}
          ${prev ? `<a class="btn btn-ghost btn-sm" href="/${pathFor(prev)}">&larr; Previous rip</a>` : ""}
          ${next ? `<a class="btn btn-ghost btn-sm" href="/${pathFor(next)}">Next rip &rarr;</a>` : ""}
        </div>
      </div>
    </div>
  </div>
</section>

${related.length ? `<section class="band tight">
  <div class="wrap">
    <div class="sec-head">
      <div><h2>More <span class="hl">${esc(setLabel)}</span></h2></div>
      <a class="btn btn-ghost btn-sm" href="/videos.html?set=${setId}">See all &rarr;</a>
    </div>
    <div class="vid-grid">
      ${related.map((r) => `<article class="vid">
        <a class="vid-shell" href="/${pathFor(r)}" aria-label="${esc(r.title)}">
          <span class="pack pack--tile${r.sets[0] ? ` pack--${r.sets[0]}` : ""}" aria-hidden="true">
            <span class="pack-face pack-l">
              <span class="pack-art"></span>
              <span class="pack-brand">${esc(r.sets[0] ? labelFor("sets", r.sets[0]) : "GARBAGE RIPS")}<small>${r.sets[0] ? "GARBAGE RIPS 585" : "585"}</small></span>
              <span class="pack-seal"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
            </span>
          </span>
          <span class="vid-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
        </a>
        <h3 class="vid-title"><a href="/${pathFor(r)}">${esc(r.title)}</a></h3>
        <p class="vid-meta">${niceDate(r.published)}</p>
      </article>`).join("\n      ")}
    </div>
  </div>
</section>` : ""}

${FOOTER}
<script>
// One embed, loaded on click: keeps the page light and makes the play count
// as a real view rather than an autoplaying one that does not.
(function(){
  var p=document.getElementById('player'), pack=document.getElementById('pack');
  if(!p||!pack) return;
  var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var opened=false;

  function mount(){
    var f=document.createElement('iframe');
    f.src='https://www.youtube-nocookie.com/embed/'+p.dataset.id+'?autoplay=1&playsinline=1&rel=0';
    f.title=${JSON.stringify(v.title)};
    f.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    f.allowFullscreen=true;
    f.referrerPolicy='strict-origin-when-cross-origin';
    p.textContent=''; p.appendChild(f);
  }

  // Driven off animationend rather than timers that guess the CSS durations:
  // background tabs clamp setTimeout, which would desync the reveal from the
  // tear. Each step keeps a generous fallback timer in case the animation
  // never fires at all.
  function once(fn){ var done=false; return function(){ if(done) return; done=true; fn(); }; }

  pack.addEventListener('click',function(){
    if(opened) return; opened=true;
    if(reduced){ mount(); return; }
    var face=pack.querySelector('.pack-l');
    var reveal=once(mount);
    var tear=once(function(){
      pack.classList.remove('shaking');
      pack.classList.add('tearing');
      if(face) face.addEventListener('animationend',reveal,{once:true});
      setTimeout(reveal,1600);
    });
    pack.classList.add('shaking');
    if(face) face.addEventListener('animationend',tear,{once:true});
    setTimeout(tear,600);
  });
})();
</script>
<script src="/assets/app.js"></script>
</body>
</html>
`;
}

// Newest first, so "previous" walks backwards in time.
const ordered = videos.slice().sort((a, b) => (a.published < b.published ? 1 : -1));

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (let i = 0; i < ordered.length; i++) {
  const v = ordered[i];
  await writeFile(join(ROOT, "public", pathFor(v)), page(v, ordered[i + 1], ordered[i - 1]));
}

// Sitemap: the three hubs plus every generated page.
const today = videos[0]?.published || "2026-08-10";
const urls = [
  { loc: `${SITE}/`, freq: "daily", pri: "1.0" },
  { loc: `${SITE}/videos.html`, freq: "daily", pri: "0.9" },
  { loc: `${SITE}/playlists.html`, freq: "weekly", pri: "0.7" },
  ...ordered.filter((v) => taggedIds.has(v.id)).map((v) => ({ loc: `${SITE}/${pathFor(v)}`, freq: "monthly", pri: "0.6", mod: v.published })),
];
await writeFile(
  join(ROOT, "public/sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.mod || today}</lastmod>\n` +
          `    <changefreq>${u.freq}</changefreq>\n    <priority>${u.pri}</priority>\n  </url>`
      )
      .join("\n") +
    `\n</urlset>\n`
);

console.log(`
Wrote ${ordered.length} rip pages to public/rip/
Wrote public/sitemap.xml with ${urls.length} urls

  ${tagged.length} fully tagged, indexed and in the sitemap
  ${videos.length - tagged.length} untagged: page still exists so a click never
  leaves the site, but marked noindex so they are not thin pages in search
  (see UNTAGGED.md; tag them and re-run this)
`);
