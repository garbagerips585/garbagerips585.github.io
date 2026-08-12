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

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, robots, LIVE, DOMAIN } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer } from "../shared/chrome.mjs";
import { labelFor } from "../shared/taxonomy.mjs";
import { ripPath } from "../shared/paths.mjs";
import { esc, shortDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const OUT = join(ROOT, "public/rip");

// Graded prices, hand-entered first and synced second, with the same
// ten-sale floor the set guides use. One store, so a card cannot show two
// different numbers on two different pages.
// Which sets actually have wrapper art. Five (White Flare, Black Bolt,
// Shrouded Fable, Paldean Fates, Paldea Evolved) have neither art nor a colour
// skin, so naming them here would render the plain Garbage Rips green rather
// than the generic wrapper we drew for exactly this case.
/**
 * The share card for a rip.
 *
 * This used to be the YouTube poster frame, which is nearly always the pulled
 * card: sharing a rip page in a message showed the hit before anyone opened
 * it, the one thing the pack wrappers exist to prevent. Each set has its own
 * card now, showing its wrapper and nothing else.
 */
const ogCard = (v) => {
  const s = (v.sets || [])[0];
  return s && ogCards.has(s) ? `og-${s}.jpg` : "og-image.jpg";
};

const ogCards = new Set(
  (await readdir(join(ROOT, "public/assets")))
    .filter((f) => f.startsWith("og-") && f.endsWith(".jpg"))
    .map((f) => f.slice(3, -4))
);

const packsOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/packs")))
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.replace(/-garbage-rips-585-booster-pack\.webp$/, ""))
);

const setData = new Map(
  JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8")).sets.map((x) => [x.id, x])
);
let psa10 = {};
try {
  psa10 = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8"));
} catch { /* optional */ }
const MIN_SALES = 10;
const gradedPrice = (setId, number) => {
  const k = `${setId}-${number}`;
  const m = psa10.prices?.[k];
  const manual = typeof m?.price === "number" ? m.price : typeof m === "number" ? m : null;
  if (manual) return manual;
  const a = psa10.auto?.[k];
  if (!a?.psa10 || (a.psa10Sales != null && a.psa10Sales < MIN_SALES)) return null;
  return a.psa10;
};
const money = (n) =>
  n >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(2)}`;

const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

// Intrinsic size of each set logo, measured from the files by
// scripts/build-packs.py and stored in data/logo-dims.json. Emitting
// width/height reserves the box before the image lands: these are lazy and
// sit low on the page, so without them every rip page reflows as you scroll.
let LOGO_DIMS = {};
try {
  LOGO_DIMS = JSON.parse(await readFile(join(ROOT, "data/logo-dims.json"), "utf8"));
} catch {
  /* run: python3 scripts/measure-logos.py */
}
const logoAttrs = (setId) => {
  const d = LOGO_DIMS[`${setId}-pokemon-tcg-set-logo.webp`];
  return d ? ` width="${d[0]}" height="${d[1]}"` : "";
};

const descriptions = JSON.parse(await readFile(join(ROOT, "data/descriptions.json"), "utf8").catch(() => "{}"));


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

// Matches compact() in build-proto.mjs. They disagreed above a million: one
// had an M branch and the other divided by 1000 forever, so the same video
// would read "1.5M views" on its page and "1500K VIEWS" on its home page tile.
const niceViews = (n) =>
  n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M views"
  : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K views"
  : n + " views";

function page(v, prev, next) {
  // Same rule as the home page and the library: a rip holding packs from
// several sets wears the generic wrapper rather than one set's, and an
// untagged rip wears it too instead of the unskinned placeholder.
//
// TWO SEPARATE THINGS, and conflating them broke three others. packSet picks
// the ARTWORK and may be "multi" or "default", which are not sets. setId is the
// real first set and stays null when there is none, because it drives the set
// guide link, the set logo, the related-videos band, the breadcrumb, and
// isTagged. Reusing one variable for both pointed multi-set pages at
// /sets/multi.html and, worse, made isTagged true for every untagged video, so
// 39 thin pages lost their noindex and entered the sitemap.
const packSet =
    v.sets.length > 1 ? "multi" : packsOnDisk.has(v.sets[0]) ? v.sets[0] : "default";
const setId = v.sets[0] || null;
const prodId = v.products[0];
  // Every video gets a page so that clicking a tile never leaves the site.
  // Untagged ones are noindex: useful to a visitor, too thin for search.
  const isTagged = Boolean(setId && prodId);
  const setLabel = setId ? labelFor("sets", setId) : null;
  const prodLabel = prodId ? labelFor("products", prodId) : null;
  // The sheet can override both. A YouTube title is written for the algorithm
// and a YouTube description is written for YouTube; the site can say something
// better without changing either.
const title = v.siteTitle || v.title;
const desc = (v.blurb || descriptions[v.id] || "").trim();
  const metaDesc = desc
    ? desc.replace(/\s+/g, " ").slice(0, 155).replace(/\s\S*$/, "") + "..."
    : isTagged
    ? `${v.title} — a ${prodLabel} rip from ${setLabel}, opened on Garbage Rips 585 in Rochester, NY.`
    : `${v.title} — a Pokemon pack rip from Garbage Rips 585 in Rochester, NY.`;
  // Still YouTube's frame for the VideoObject schema and the poster behind the
  // pack, where it is correct. It is NOT the share image: see ogCard().
  // The player poster is the LCP image of every rip page, and it was being
  // fetched as a ~178KB JPEG when the same frame is ~81KB as WebP: a 54% cut on
  // the one image that decides how fast the page feels. app.js already had a
  // thumbUrl() helper written to do exactly this, with the saving measured in
  // its comment, and nothing ever called it.
  //
  // "oar" is the original-aspect-ratio frame, the only variant at the video's
  // true vertical shape; hqdefault and maxresdefault are 4:3 and 16:9 crops
  // that letterbox a Short. But oardefault does NOT exist for horizontal
  // uploads (it 404s for kj7532tb0_I), and maxresdefault is already the right
  // shape for those, so each gets the variant that actually exists.
  const frame = v.vertical === false ? "maxresdefault" : "oardefault";
  const thumbWebp = `https://i.ytimg.com/vi_webp/${v.id}/${frame}.webp`;
  const thumb = `https://i.ytimg.com/vi/${v.id}/${frame}.jpg`;
  const url = `${SITE}/${pathFor(v)}`;

  // What the viewer is actually hoping falls out of this pack. Every chase card
  // has a raw price; a PSA 10 shows only where we have one worth standing
  // behind. Three is enough to be useful without turning a video page into a
  // price list.
  const chaseCards = (setData.get(setId)?.chase || []).slice(0, 3).map((c) => ({
    ...c,
    psa10: gradedPrice(setId, c.number),
  }));
  const chaseBlock = chaseCards.length
    ? `<section class="band tight chasers">
  <div class="wrap">
    <div class="sec-head">
      <div><h2>What you are <span class="hl">chasing</span></h2></div>
      <a class="btn btn-ghost btn-sm" href="/sets/${setId}.html">${esc(setLabel)} guide &rarr;</a>
    </div>
    <ul class="chaser-list">
      ${chaseCards.map((c) => `<li class="chaser">
        ${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.name)}, ${esc(c.rarity || "card")} from ${esc(setLabel)}" loading="lazy" width="245" height="342">` : ""}
        <div>
          <b>${esc(c.name)}</b>
          <span class="chaser-rar">${esc(c.rarity || "")}${c.number ? ` &bull; #${esc(c.number)}` : ""}</span>
          <span class="chaser-pr">Raw ${money(c.price)}${c.psa10 ? ` <i>PSA 10 ${money(c.psa10)}</i>` : ""}</span>
        </div>
      </li>`).join("\n      ")}
    </ul>
  </div>
</section>`
    : "";

  // Packs opened out of the same box, which is a stronger connection than
  // "same set": #1 through #10 of one ETB are one sitting, and a viewer who
  // watched pack 3 usually wants pack 4, not another Chaos Rising rip.
  const sameBox = v.box
    ? videos.filter((x) => x.box === v.box && x.id !== v.id).slice(0, 6)
    : [];

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
<title>${esc(title)} | Garbage Rips 585</title>
<meta name="description" content="${esc(metaDesc)}">${isTagged ? "" : '\n<meta name="robots" content="noindex,follow">'}
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:type" content="video.other">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/${ogCard(v)}?v=2">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:image" content="${SITE}/assets/${ogCard(v)}?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="preconnect" href="https://i.ytimg.com" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Titan+One&family=Outfit:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
${STYLES}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}

<main id="main" class="rip tight${v.greatest ? " hall" : ""}">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / <a href="/videos.html">Every rip</a>${setId ? ` / <a href="/videos.html?set=${setId}">${esc(setLabel)}</a>` : ""}</p>
    <div class="rip-grid">
      <div>
        <div class="rip-player${v.vertical === false ? " rip-player--wide" : ""}" id="player" data-id="${v.id}">
          <picture>
            <source type="image/webp" srcset="${thumbWebp}">
            <img src="${thumb}" alt="" width="${v.vertical === false ? 1280 : 720}" height="${v.vertical === false ? 720 : 1280}" fetchpriority="high" decoding="async">
          </picture>
          <button class="pack pack--${packSet}" id="pack" type="button" aria-label="Rip open: ${esc(title)}">
            <span class="pack-face pack-l" aria-hidden="true">
              <span class="pack-art"></span>
              <span class="pack-brand">${esc(setLabel || "GARBAGE RIPS")}<small>${setLabel ? "GARBAGE RIPS 585" : "585"}</small></span>
            </span>
            <span class="pack-face pack-r" aria-hidden="true">
              <span class="pack-art"></span>
              <span class="pack-brand">${esc(setLabel || "GARBAGE RIPS")}<small>${setLabel ? "GARBAGE RIPS 585" : "585"}</small></span>
            </span>
            <span class="pack-flash" aria-hidden="true"></span>
            <span class="pack-hint">CLICK TO RIP THE PACK</span>
          </button>
          <button class="sound-on" id="soundOn" type="button" hidden>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>
            <span class="sound-on-label">Tap for sound</span>
          </button>
        </div>
      </div>
      <div>
        ${setId ? `<img class="rip-setlogo"${logoAttrs(setId)} src="/assets/logos/${setId}-pokemon-tcg-set-logo.webp" alt="${esc(setLabel)} Pokemon TCG set logo" loading="lazy" onerror="this.remove()">` : ""}
        <h1>${esc(title)}</h1>
        <div class="rip-badges">
          ${setId ? `<a class="chip" href="/videos.html?set=${setId}">${esc(setLabel)}</a>` : ""}
          ${prodId ? `<a class="chip prod" href="/videos.html?product=${prodId}">${esc(prodLabel)}</a>` : ""}
          ${v.pulls.map((p) => `<span class="chip">${esc(labelFor("pulls", p))}</span>`).join("\n          ")}
        </div>
        <p class="rip-meta">${shortDate(v.published)}${v.views ? " &bull; " + niceViews(v.views) : ""}${v.openingType ? " &bull; " + esc(v.openingType) : ""}</p>
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
        ${v.affiliate ? `<p class="aff-note">Affiliate link. If you buy through it we may earn a small commission at no extra cost to you.</p>` : ""}
      </div>
    </div>
  </div>
</main>

${sameBox.length ? `<section class="band tight">
  <div class="wrap">
    <div class="sec-head">
      <div><h2>More from <span class="hl">${esc(v.box)}</span></h2></div>
    </div>
    <div class="vid-grid">
      ${sameBox.map((r) => `<article class="vid"><a class="vid-shell" href="/${pathFor(r)}" aria-label="${esc(r.siteTitle || r.title)}">
        <span class="pack pack--tile pack--${r.sets.length > 1 ? "multi" : packsOnDisk.has(r.sets[0]) ? r.sets[0] : "default"}" aria-hidden="true">
          <span class="pack-face pack-l"><span class="pack-art"></span></span></span>
      </a><h3 class="vid-title"><a href="/${pathFor(r)}">${esc(r.siteTitle || r.title)}</a></h3></article>`).join("\n      ")}
    </div>
  </div>
</section>` : ""}

${chaseBlock}

${related.length ? `<section class="band tight">
  <div class="wrap">
    <div class="sec-head">
      <div>
        <img class="setlogo"${logoAttrs(setId)} src="/assets/logos/${setId}-pokemon-tcg-set-logo.webp" alt="${esc(setLabel)} Pokemon TCG set logo" loading="lazy" onerror="this.remove()">
        <h2>More <span class="hl">${esc(setLabel)}</span></h2>
      </div>
      <a class="btn btn-ghost btn-sm" href="/videos.html?set=${setId}">See all &rarr;</a>
    </div>
    <div class="vid-grid">
      ${related.map((r) => `<article class="vid">
        <a class="vid-shell" href="/${pathFor(r)}" aria-label="${esc(r.title)}">
          <span class="pack pack--tile pack--${r.sets.length > 1 ? "multi" : packsOnDisk.has(r.sets[0]) ? r.sets[0] : "default"}" aria-hidden="true">
            <span class="pack-face pack-l">
              <span class="pack-art"></span>
              <span class="pack-brand">${esc(r.sets[0] ? labelFor("sets", r.sets[0]) : "GARBAGE RIPS")}<small>${r.sets[0] ? "GARBAGE RIPS 585" : "585"}</small></span>
              <span class="pack-seal"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
            </span>
          </span>
          <span class="vid-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
        </a>
        <h3 class="vid-title"><a href="/${pathFor(r)}">${esc(r.title)}</a></h3>
        <p class="vid-meta">${shortDate(r.published)}</p>
      </article>`).join("\n      ")}
    </div>
  </div>
</section>` : ""}

${footer()}
<script>
// One embed, loaded on click: keeps the page light and makes the play count
// as a real view rather than an autoplaying one that does not.
(function(){
  var p=document.getElementById('player'), pack=document.getElementById('pack');
  if(!p||!pack) return;
  var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var opened=false;

  // AUTOPLAY, WITH SOUND.
  //
  // The goal is that ripping the pack starts the video with audio, every time.
  // Getting there is not one decision, it is an order of operations.
  //
  // WHAT IS ACTUALLY GOING ON
  // A muted media element is exempt from the user-gesture check. An unmuted one
  // is not, and a cross-origin iframe created during a click does not reliably
  // inherit that click: Chrome and Firefox usually honour an ancestor frame's
  // gesture through allow="autoplay", WebKit does not. That is why this was
  // intermittent rather than broken. It was never per-video and never per-page;
  // all 310 videos are public, embeddable and unrestricted, and every rip page
  // is byte-for-byte identical. It varied by browser and by visit.
  //
  // The trap: unmuting BEFORE playback begins throws away the exemption that
  // mute=1 just bought, so the player makes its autoplay attempt as an unmuted
  // element, gets refused, and paints YouTube's own play button. Asking for
  // sound too eagerly is what causes the very symptom it was meant to fix.
  //
  // SO, IN ORDER
  //   1. Mount MUTED. Muted autoplay is never refused, so the rip always
  //      starts, immediately, under the tear.
  //   2. Wait for the player to actually report PLAYING.
  //   3. Only then unmute. By that point it is a live element being changed,
  //      not an autoplay attempt being judged, and the page has the user's
  //      click behind it, so it is normally granted. Sound arrives a few
  //      hundred milliseconds in, while the pack is still coming apart.
  //   4. If unmuting stops it anyway, which is WebKit's documented behaviour,
  //      retreat: re-mute, resume, and offer one tap. That tap is a real
  //      gesture, so it always works.
  //
  // Do not "simplify" this to unmuted-from-the-start. That was tried and is
  // what produced the play button on some opens and not others.
  var EMBED='https://www.youtube-nocookie.com';
  var player=null, feedTimer=null, gotFeed=false, mounted=false;
  var phase='idle', muted=true, soundBtn=null, startWatch=null, unmuteWatch=null;

  function post(msg){
    if(!player||!player.contentWindow) return;
    try{ player.contentWindow.postMessage(JSON.stringify(msg),EMBED); }catch(e){}
  }
  function cmd(func,args){ post({event:'command',func:func,args:args||[],id:1,channel:'widget'}); }
  function listen(){ post({event:'listening',id:1,channel:'widget'}); }

  function mount(){
    if(mounted) return;
    mounted=true;
    var f=document.createElement('iframe');
    f.src=EMBED+'/embed/'+p.dataset.id
      +'?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1&widgetid=1&origin='
      +encodeURIComponent(location.origin);
    f.title=${JSON.stringify(v.title)};
    f.allow='autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    f.allowFullscreen=true;
    f.referrerPolicy='strict-origin-when-cross-origin';
    // The poster is a <picture> since the WebP change. Removing only the <img>
    // inside it left the poster sitting on top of the player.
    var poster=p.querySelector('picture')||p.querySelector('img');
    if(poster) poster.remove();
    p.insertBefore(f,p.firstChild);   // behind the pack, which tears away over it
    player=f;
    phase='waiting';

    // The player installs its message handler well after the iframe fires
    // load, and silently drops anything that arrives before it. Sending the
    // handshake once on load therefore loses it, and then no state ever
    // arrives and every decision below is made blind. Repeat until it answers.
    listen();
    feedTimer=setInterval(function(){
      if(gotFeed||!player){ clearInterval(feedTimer); feedTimer=null; return; }
      listen();
    },200);

    // Muted autoplay should be immediate. If it has not reported playing by
    // now, something outside autoplay policy is in the way: iOS Low Power
    // Mode, a blocked domain, a background tab. All of those need a tap.
    startWatch=setTimeout(function(){ if(phase==='waiting') retreat('play'); },2600);
  }

  // Called only once the player has REPORTED playing. See the note above.
  function askForSound(){
    phase='unmuting';
    cmd('setVolume',[100]);
    cmd('unMute');
    clearTimeout(unmuteWatch);
    unmuteWatch=setTimeout(function(){
      if(phase!=='unmuting') return;
      if(muted===false) phase='done';        // sound is on, nothing to offer
      else retreat('sound');
    },900);
  }

  // Unmuting was refused, or stopped playback. Put it back the way that always
  // works and let the visitor turn sound on with a tap.
  function retreat(kind){
    if(phase==='gesture') return;
    phase='gesture';
    clearTimeout(unmuteWatch); clearTimeout(startWatch);
    cmd('mute');
    cmd('playVideo');
    showBtn(true,kind);
  }

  function showBtn(on,kind){
    soundBtn=soundBtn||document.getElementById('soundOn');
    if(!soundBtn) return;
    soundBtn.hidden=!on;
    if(on&&kind){
      var l=soundBtn.querySelector('.sound-on-label');
      if(l) l.textContent=(kind==='play'?'Tap to play':'Tap for sound');
    }
  }

  function onState(st){
    // 1 playing, 3 buffering. Buffering mid-unmute is normal, not a refusal.
    if(phase==='waiting'&&st===1){ clearTimeout(startWatch); askForSound(); return; }
    if(phase==='unmuting'&&st!==1&&st!==3){ retreat('sound'); return; }
    if(phase==='done'&&st!==1&&st!==3&&muted===false){ retreat('sound'); }
  }

  window.addEventListener('message',function(e){
    // Exact origin, and the message must come from OUR iframe. An indexOf on
    // "youtube" matches any host containing it and lets any frame drive this.
    if(e.origin!==EMBED&&e.origin!=='https://www.youtube.com') return;
    if(!player||e.source!==player.contentWindow) return;
    var d=e.data;
    if(typeof d==='string'){ try{ d=JSON.parse(d); }catch(_){ return; } }
    if(!d||typeof d!=='object') return;
    gotFeed=true;
    if(d.event==='onAutoplayBlocked'){ retreat(phase==='unmuting'?'sound':'play'); return; }
    // onStateChange carries info as a NUMBER; infoDelivery carries an object.
    // Reading only the object shape missed every onStateChange.
    var info=d.info, st=null;
    if(typeof info==='number') st=info;
    else if(info&&typeof info.playerState==='number') st=info.playerState;
    if(info&&typeof info.muted==='boolean') muted=info.muted;
    if(st!==null) onState(st);
  });

  document.addEventListener('click',function(e){
    if(!e.target.closest||!e.target.closest('#soundOn')) return;
    // A real gesture, so this is always permitted.
    showBtn(false);
    phase='unmuting';
    cmd('unMute'); cmd('setVolume',[100]); cmd('playVideo');
    clearTimeout(unmuteWatch);
  });

  // Driven off animationend rather than timers that guess the CSS durations:
  // background tabs clamp setTimeout, which would desync the reveal from the
  // tear. Each step keeps a generous fallback timer in case the animation
  // never fires at all.
  function once(fn){ var done=false; return function(){ if(done) return; done=true; fn(); }; }

  // Wait for ONE named animation on an element. Without the name check any
  // animationend bubbling up from a child would advance the sequence early;
  // nothing does today, but adding a single animation anywhere inside the pack
  // would silently start the tear mid-shake.
  function after(el,name,fn){
    if(!el) return;
    el.addEventListener('animationend',function h(e){
      if(e.animationName!==name) return;
      el.removeEventListener('animationend',h);
      fn();
    });
  }

  pack.addEventListener('click',function(){
    if(opened) return; opened=true;
    // Was this a keyboard activation? Checked BEFORE the pack is torn away,
    // because removing the focused element drops focus to <body> and a
    // keyboard visitor is dumped back at the top of the document.
    var byKeyboard=document.activeElement===pack;
    mount();                                 // first, while the gesture is live
    if(reduced){ pack.remove(); focusPlayer(byKeyboard); return; }

    // Then tear the pack away over the top of the already-playing video.
    var face=pack.querySelector('.pack-l');
    var clear=once(function(){ pack.remove(); focusPlayer(byKeyboard); });
    var tear=once(function(){
      pack.classList.remove('shaking');
      pack.classList.add('tearing');
      after(face,'tearL',clear);
      setTimeout(clear,1600);
    });
    pack.classList.add('shaking');
    after(face,'packShake',tear);
    setTimeout(tear,600);
  });

  // Hand focus to the player so the next Tab continues from the video rather
  // than from the top of the page. Mouse users are left alone: focusing an
  // iframe can scroll it into view, which is jarring when you already clicked it.
  function focusPlayer(yes){
    if(!yes) return;
    var f=p.querySelector('iframe');
    if(f) f.focus({preventScroll:true});
  }
})();
</script>
<script src="/assets/app.js" defer></script>
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
let setPages = [];
try {
  const sd = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
  setPages = (sd.sets || []).map((s) => ({
    loc: `${SITE}/sets/${s.id}.html`, freq: "weekly", pri: "0.8", mod: sd.syncedAt,
  }));
} catch {
  /* set pages not generated yet */
}

const urls = [
  { loc: `${SITE}/`, freq: "daily", pri: "1.0" },
  { loc: `${SITE}/videos.html`, freq: "daily", pri: "0.9" },
  { loc: `${SITE}/sets/`, freq: "weekly", pri: "0.9" },
  ...setPages,
  { loc: `${SITE}/playlists.html`, freq: "weekly", pri: "0.7" },
  // Added later than the rest and missed here: all three are indexable and
  // linked from the nav on every page, so leaving them out told search engines
  // the opposite of what the site says.
  { loc: `${SITE}/wanted.html`, freq: "weekly", pri: "0.8" },
  { loc: `${SITE}/hall.html`, freq: "weekly", pri: "0.8" },
  { loc: `${SITE}/shops.html`, freq: "monthly", pri: "0.7" },
  { loc: `${SITE}/about.html`, freq: "monthly", pri: "0.8" },
  // The complete set list. High priority: it is the most linkable reference
  // page on the site and the one most likely to be found cold in search.
  { loc: `${SITE}/expansions.html`, freq: "weekly", pri: "0.9" },
  // Observed hit rates. The most linkable page on the site: nobody else has
  // this data, so it is the one most likely to be cited from outside.
  { loc: `${SITE}/luck.html`, freq: "weekly", pri: "0.9" },
  // Release dates. High priority and frequent: this is the page people search
  // for by name in the weeks before a set drops.
  { loc: `${SITE}/upcoming.html`, freq: "weekly", pri: "0.9" },
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

// robots.txt comes from the same source as the canonicals, so the two can
// never disagree about which address this site lives at.
await writeFile(join(ROOT, "public/robots.txt"), robots());

console.log(`
Wrote public/robots.txt  (${LIVE ? "live: crawling allowed" : `staging: crawling disallowed, real domain will be ${DOMAIN}`})
Wrote ${ordered.length} rip pages to public/rip/
Wrote public/sitemap.xml with ${urls.length} urls

  ${tagged.length} fully tagged, indexed and in the sitemap
  ${videos.length - tagged.length} untagged: page still exists so a click never
  leaves the site, but marked noindex so they are not thin pages in search
  (see UNTAGGED.md; tag them and re-run this)
`);
