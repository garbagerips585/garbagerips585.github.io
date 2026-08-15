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
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS } from "../shared/chrome.mjs";
import { labelFor } from "../shared/taxonomy.mjs";
import { ripPath } from "../shared/paths.mjs";
import { esc, longDate, moneyCompact, moneyExact, moneyRound, shortDate, rarityLabel, imgDims } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const OUT = join(ROOT, "public/rip");

// Graded prices, hand-entered first and synced second, with the same
// ten-sale floor the set guides use. One store, so a card cannot show two
// different numbers on two different pages.
// Which sets actually have wrapper art. Five (White Flare, Black Bolt,
// Shrouded Fable, Paldean Fates, Paldea Evolved) have neither art nor a color
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

const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

// Cards pulled on camera, one entry per hit, from data/hits.json.
//
// PRICES ARE LOOKED UP HERE, NOT STORED IN hits.json. The sheet records WHICH
// card was pulled; what it is worth comes from the same card data every other
// page uses, so a nightly price refresh moves these pages and no card can show
// two different numbers in two places.
//
// One hit resolves to several printings often enough to matter: Dawn in
// Phantasmal Flames has three. Where the sheet named a rarity we take the
// printing that matches, because that is the one actually pulled; otherwise the
// first, and the page claims nothing it cannot support.
let cardsChecked = null;
try {
  cardsChecked = JSON.parse(await readFile(join(ROOT, "public/data/cards/pitch-black.json"), "utf8")).checked;
} catch {}
const HITS = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")).videos || {};
const psaFor = (setId, n) => {
  const k = `${setId}-${String(n).replace(/^0+(?=\d)/, "")}`;
  const e = (psa10.prices && psa10.prices[k]) || (psa10.auto && psa10.auto[k]);
  return e && typeof e.psa10 === "number" ? e.psa10 : null;
};
const cardCache = new Map();
async function resolveHits(vid) {
  const out = [];
  for (const h of HITS[vid] || []) {
    if (!cardCache.has(h.set)) {
      try {
        cardCache.set(h.set, JSON.parse(await readFile(join(ROOT, `public/data/cards/${h.set}.json`), "utf8")).cards);
      } catch { cardCache.set(h.set, null); }
    }
    // A promo lives outside the 23 sets we price, so it never resolves against
    // the set data and used to match a SET card of the same name: that put the
    // wrong Oricorio ex on the Costco page and lost the Mega Charizard X ex
    // entirely. Promos resolve against the printings corpus instead, which
    // gives a real scan and no price, which is the truth about a promo.
    if (h.promo || !h.set) {
      const shard = String(h.card).trim()[0].toLowerCase();
      let list = [];
      try { list = JSON.parse(await readFile(join(ROOT, `public/data/printings/${/[a-z]/.test(shard) ? shard : "0"}.json`), "utf8")); } catch {}
      const norm0 = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
      const pm = list.find((c) => norm0(c.n) === norm0(h.card) && String(c.i) === String(h.number)) ||
                 list.find((c) => norm0(c.n) === norm0(h.card) && /promo/i.test(String(c.s)));
      out.push({
        name: h.card, setName: h.setName, setId: null,
        rarity: h.rarity || (pm && pm.r) || null,
        n: h.number || (pm && pm.i) || null,
        img: pm && pm.g ? `${pm.g}/low.webp` : null,
        // A promo has no price in the nightly feed, so where one is recorded on
        // the hit itself we use it, and carry its source and date so the page
        // can say where it came from rather than implying it is a live figure.
        price: typeof h.price === "number" ? h.price : null,
        psa10: typeof h.psa10 === "number" ? h.psa10 : null,
        priceSource: h.priceSource || null,
        priceAsOf: h.priceAsOf || null,
        promo: true, unresolved: !pm,
      });
      continue;
    }
    const cards = cardCache.get(h.set);
    const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
    const same = cards ? cards.filter((c) => norm(c.name) === norm(h.card)) : [];
    const want = h.rarity ? norm(h.rarity).slice(0, 8) : null;
    const m = (want && same.find((c) => norm(c.rarity).includes(want))) || same[0] || null;
    out.push({
      name: h.card, setName: h.setName, setId: h.set,
      rarity: (m && m.rarity) || h.rarity || null,
      n: m ? m.n : null,
      img: m && m.img ? `${m.img}/low.webp` : null,
      price: m && typeof m.price === "number" ? m.price : null,
      psa10: m ? psaFor(h.set, m.n) : null,
      // A promo, or a card outside the set checklist, will not resolve. Kept
      // and shown by name rather than dropped, because it WAS pulled.
      unresolved: !m,
    });
  }
  // ORDER BY RAW, NOT BY WHICHEVER NUMBER IS BIGGER. Sorting on psa10 || price
  // compared a graded figure against an ungraded one, so any card with a PSA 10
  // recorded outranked every card without: Oricorio ex at $12.03 raw sat above
  // Marshadow at $14.95 because its PSA 10 was $99.78. Raw is the number every
  // card here has, so it is the one that can be compared. PSA 10 falls back
  // only when a card has no raw price at all.
  return out.sort((a, b) => (b.price ?? b.psa10 ?? 0) - (a.price ?? a.psa10 ?? 0));
}

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

// Which sets actually have a logo file. A rip page renders the logo of whatever
// set it is tagged with, and tagging the Japanese, Korean and Chinese rips gave
// 12 pages an <img> pointing at a file that does not exist: TCGdex publishes no
// logo or symbol art for ANY non-English set, so there is nothing to download.
// The tags themselves are right and worth having, so the image is simply not
// emitted when there is no art. `onerror` would have hidden it in a browser,
// but a request that 404s on every page load is still a request, and the build
// check counts it as a broken link, correctly.
const logosOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/logos")).catch(() => []))
    .map((f) => /^(.+)-pokemon-tcg-set-logo\.webp$/.exec(f)?.[1])
    .filter(Boolean)
);
const hasLogo = (setId) => Boolean(setId) && logosOnDisk.has(setId);

// Which sets have a guide page to link to. The rip page used to reach its set
// guide only through the "what you are chasing" block, which needs chase cards
// with prices, so the imported rips had no route to their own guide at all: you
// could watch five Abyss Eye rips and never learn the page existed, let alone
// that the set is Pitch Black. Both kinds of guide count here.
const guideIds = new Set(
  JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8")).sets.map((s) => s.id)
);
try {
  const ig = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8"));
  for (const id of Object.keys(ig.sets || {})) guideIds.add(id);
} catch {
  /* run: node scripts/sync-intl-guides.mjs */
}
const hasGuide = (setId) => Boolean(setId) && guideIds.has(setId);

// `pillarboxed` is read here rather than carried through the YouTube sync,
// because it describes how a video was FILMED versus how it was uploaded, which
// no API reports and only a human can say.
const OVERRIDES = JSON.parse(await readFile(join(ROOT, "data/overrides.json"), "utf8").catch(() => "{}"));

const descriptions = JSON.parse(await readFile(join(ROOT, "data/descriptions.json"), "utf8").catch(() => "{}"));

const pathFor = (v) => v.path || ripPath(v);

function isoDuration(sec) {
  if (!sec) return null;
  const m = Math.floor(sec / 60), s = sec % 60;
  return `PT${m ? m + "M" : ""}${s}S`;
}

// A YouTube title carries hashtags because YouTube indexes them. A <title> tag
// does not, so they are pure noise in the tab, the SERP and the H1. Strip only
// a RUN OF HASHTAGS AT THE END: "#1" mid-title is a pack number, and hashtags
// that sit inside the sentence are part of how the title reads.
function cleanTitle(t) {
  return t
    .replace(/(?:\s*#\s*[\p{L}][\p{L}\p{N}_-]*)+\s*$/u, "")
    .replace(/\s*\|\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Whitespace tidy for text typed into the spreadsheet by hand.
//
// The Hit Card column is free text on purpose, so it arrives with whatever
// spacing it was typed with: "Double Rare , Mega Evolution" renders exactly
// that space before the comma, because HTML collapses runs of whitespace but
// does not move one from the wrong side of a comma. This only touches spacing,
// never words or order, so what it prints is still what was typed.
const tidy = (s) =>
  String(s || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,;:.!?])/g, "$1")
    .trim();

const tagged = videos.filter((v) => v.sets.length && v.products.length);
const taggedIds = new Set(tagged.map((v) => v.id));
const byId = new Map(videos.map((v) => [v.id, v]));

// Two different rips can carry the identical YouTube title, which gives two
// pages the identical <title> tag and makes them look like duplicates to a
// crawler. Only the repeats get a qualifier, and the qualifier is the upload
// date, which is a fact we already hold rather than something invented.
const titleCounts = new Map();
for (const v of videos) {
  const t = cleanTitle(v.siteTitle || v.title);
  titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
}
const bySet = new Map();
const HITS_RESOLVED = new Map();
for (const vid of Object.keys(HITS)) HITS_RESOLVED.set(vid, await resolveHits(vid));

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
const title = cleanTitle(v.siteTitle || v.title);
// Only a repeated title earns the date, so the other 300 stay clean.
const headTitle =
  titleCounts.get(title) > 1 && v.published
    ? `${title} (${shortDate(v.published)})`
    : title;
// The trailing hashtag wall is how YouTube indexes a video. On a web page it
// is a row of link-less tokens at the end of a paragraph, so it comes off the
// blurb, the meta description and the schema alike.
const desc = (v.blurb || descriptions[v.id] || "")
  .replace(/(?:\s*#\s*[\p{L}][\p{L}\p{N}_-]*)+\s*$/u, "")
  // Runs of spaces and tabs only, never newlines: the blank lines are what give
  // the blurb its paragraphs on the page. HTML collapses a double space so it
  // is invisible in the body, but the meta description and the JSON-LD are
  // attribute and string values where it is not collapsed and does show.
  .replace(/[ \t]{2,}/g, " ")
  .trim();
  // Google truncates the snippet around 160 characters, so the fallback shapes
  // itself around the title rather than assuming the title is short: the tail
  // is fixed, the title gets whatever room is left.
  const descTail = isTagged
    ? `: a ${prodLabel} rip from ${setLabel}, opened on Garbage Rips 585 in Rochester, NY.`
    : `: a Pokemon pack rip from Garbage Rips 585 in Rochester, NY.`;
  // YouTube descriptions often already trail off in an ellipsis, so strip any
  // trailing dots before adding ours or the page reads "and......".
  const clip = (s, n) =>
    s.length <= n
      ? s
      : s
          .slice(0, n - 3)
          .replace(/\s\S*$/, "")
          .replace(/[.…\s]+$/, "") + "...";
  // The title is cut at a word boundary with no ellipsis, because the tail that
  // follows already reads as a continuation.
  const titleRoom = Math.max(24, 160 - descTail.length);
  // `title`, NOT `v.title`. The <title> tag used the cleaned one and this used
  // the raw one, so one page shipped a <title> reading "Only Garbage Rips
  // Suicune Knock Out Collection" above a meta description reading the same
  // thing plus "#pokemon #pokemoncards #pokemontcg #PokemonShorts".
  const shortTitle =
    title.length <= titleRoom
      ? title
      : title.slice(0, titleRoom).replace(/[\s,:;.!?-]+\S*$/, "");
  const metaDesc = desc
    ? clip(desc.replace(/\s+/g, " "), 158)
    : shortTitle + descTail;
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
        ${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.name)}, ${esc(rarityLabel(c.rarity) || "card")} from ${esc(setLabel)}" loading="lazy" onerror="this.remove()"${imgDims(c.image)}>` : ""}
        <div>
          <b>${esc(c.name)}</b>
          <span class="chaser-rar">${esc(rarityLabel(c.rarity) || "")}${c.number ? ` &bull; #${esc(c.number)}` : ""}</span>
          <span class="chaser-pr">Raw ${moneyCompact(c.price)}${c.psa10 ? ` <i>PSA 10 ${moneyCompact(c.psa10)}</i>` : ""}</span>
        </div>
      </li>`).join("\n      ")}
    </ul>
  </div>
</section>`
    : "";

  // Packs opened out of the same box, which is a stronger connection than
  // "same set": #1 through #10 of one ETB are one sitting, and a viewer who
  // watched pack 3 usually wants pack 4, not another Chaos Rising rip.
  const hits = HITS_RESOLVED.get(v.id) || [];
// RESOLVED, not merely present. resolveHits keeps a hit it could not match to
// a printing and stamps it `unresolved`, because the card WAS pulled and
// dropping it would lose that. But those render with no scan and no price, so
// counting them as "we have something to show" was wrong: an audit mutated the
// data so all 14 hits failed to resolve and got a band of 14 empty cards with
// the free-text fallback suppressed, which is the worst of both.
const resolvedHits = hits.filter((h) => !h.unresolved);
  const sameBox = v.box
    ? videos.filter((x) => x.box === v.box && x.id !== v.id).slice(0, 6)
    : [];

  const related = (setId ? bySet.get(setId) || [] : []).filter((x) => x.id !== v.id).slice(0, 6);

  const ld = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: title,
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
      { "@type": "ListItem", position: setId ? 4 : 3, name: title },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(headTitle)} | Garbage Rips 585</title>
<meta name="description" content="${esc(metaDesc)}">${isTagged ? "" : '\n<meta name="robots" content="noindex,follow">'}
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(headTitle)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:type" content="video.other">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/${ogCard(v)}?v=2">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(headTitle)}">
<meta name="twitter:image" content="${SITE}/assets/${ogCard(v)}?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="preconnect" href="https://i.ytimg.com" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css">
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
    <div class="rip-grid${v.vertical === false && !(OVERRIDES[v.id] || {}).pillarboxed ? " rip-grid--wide" : ""}">
      <div class="rip-stage">
        <div class="rip-player pack-player${(OVERRIDES[v.id] || {}).pillarboxed ? " rip-player--crop" : v.vertical === false ? " rip-player--wide" : ""}" id="player" data-id="${v.id}" data-title="${esc(title)}">
          <picture>
            <source type="image/webp" srcset="${thumbWebp}">
            <img src="${thumb}" alt="" width="${v.vertical === false ? 1280 : 720}" height="${v.vertical === false ? 720 : 1280}" fetchpriority="high" decoding="async"
                 onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src='https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg'}else{this.remove()}">
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
        <noscript>
            <!--
              The pack is a button that mounts the player, so with scripting off
              it is a picture that does nothing and the visitor cannot watch the
              rip at all. This link only exists in that case: it never renders
              for anyone whose browser runs the pack.

              It is a deliberate exception to "every click stays on the site".
              That rule exists so a tile does not bounce somebody to YouTube
              when the site could have shown them the video itself. Here the
              site cannot, so a dead pack is the only other option.
            -->
            <p class="pack-nojs">The pack needs JavaScript to open.
              <a href="https://www.youtube.com/watch?v=${v.id}" rel="noopener" target="_blank">Watch this rip on YouTube</a>
              instead, or turn scripting on and click the pack.</p>
        </noscript>
        ${hasLogo(setId) ? `<img class="rip-setlogo"${logoAttrs(setId)} src="/assets/logos/${setId}-pokemon-tcg-set-logo.webp" alt="" loading="lazy" onerror="this.remove()">` : ""}
        <h1>${esc(title)}</h1>
        <div class="rip-badges">
          ${setId ? `<a class="chip" href="/videos.html?set=${setId}">${esc(setLabel)}</a>` : ""}
          ${prodId ? `<a class="chip prod" href="/videos.html?product=${prodId}">${esc(prodLabel)}</a>` : ""}
          ${hasGuide(setId) ? `<a class="chip guide" href="/sets/${setId}.html">Set guide <span aria-hidden="true">&rarr;</span></a>` : ""}
          ${v.pulls.map((p) => `<span class="chip">${esc(labelFor("pulls", p))}</span>`).join("\n          ")}
        </div>
        <p class="rip-meta">${shortDate(v.published)}${v.views ? " &bull; " + niceViews(v.views) : ""}${v.openingType ? " &bull; " + esc(v.openingType) : ""}</p>
        ${/*
          THE PARAGRAPH IS A FALLBACK, NOT A HEADING.
          The Hit Card column is free text, and on a 14-pull video it arrives as
          a 936 character comma-separated dump: "Phantasmal Flames - Trainer -
          Dawn - Double Silver Star - Ultra Rare, Phantasmal Flames - Mega
          Gengar ex - ...". Those same 14 cards render below with their scans,
          their prices and a lightbox, so printing the dump as well says nothing
          the reader is not about to see, badly.

          So it renders only when there is nothing resolved to show it with.
          One card named in the sheet and no scan for it is exactly the case
          this paragraph exists for, and it still gets it.
        */ ""}${v.hitCard && !resolvedHits.length ? `<div class="hit-panel">
          <p class="hit-label">The hit</p>
          <p class="hit-card">${esc(tidy(v.hitCard))}</p>
          ${v.hitRarity ? `<p class="hit-rarity">${esc(rarityLabel(v.hitRarity))}</p>` : ""}
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
${
  hits.length
    ? `<section class="band tight hits-band">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Below the fold</p>
    <h2>What came out of <span class="hl">this one</span></h2>
    <p class="lede" style="max-width:38em">${hits.length} card${hits.length === 1 ? "" : "s"} worth keeping${
        hits.some((h) => h.psa10) ? ", with what they go for raw and in a PSA 10" : ", with what they go for raw"
      }.</p>
    <ul class="hitcards" id="hitcards">
      ${hits
        .map(
          (h, hi) => `<li class="hitcard" style="--i:${hi}" data-name="${esc(h.name)}" data-set="${esc(h.setName)}" data-n="${esc(h.n || "")}" data-rarity="${esc(rarityLabel(h.rarity) || "")}" data-img="${esc(h.img ? h.img.replace("low.webp", "high.webp") : "")}" data-price="${typeof h.price === "number" ? moneyExact(h.price) : ""}" data-psa="${h.psa10 ? moneyRound(h.psa10) : ""}" data-src="${esc(h.priceSource || "")}">
        <button class="hitcard-open" type="button" aria-label="See ${esc(h.name)} larger"></button>
        ${
          h.img
            ? `<img class="hitcard-img" src="${esc(h.img)}" alt="${esc(h.name)}, ${esc(h.setName)}" loading="lazy" onerror="this.remove()" decoding="async"${imgDims(h.img)}>`
            : `<div class="hitcard-img is-none" aria-hidden="true"></div>`
        }
        <div class="hitcard-b">
          <p class="hitcard-n">${esc(h.name)}</p>
          <p class="hitcard-s">${esc(h.setName)}${h.n ? ` &bull; #${esc(h.n)}` : ""}</p>
          ${h.rarity ? `<p class="hitcard-r">${esc(rarityLabel(h.rarity))}</p>` : ""}
          <p class="hitcard-p">${
            typeof h.price === "number" ? `<b>${moneyExact(h.price)}</b> <span>raw NM</span>` : `<span class="hitcard-nop">No market price</span>`
          }</p>
          ${h.psa10 ? `<p class="hitcard-psa">${moneyRound(h.psa10)} <span>PSA 10</span></p>` : ""}
          ${h.priceSource ? `<p class="hitcard-src">${esc(h.priceSource)}, ${esc(shortDate(h.priceAsOf) || h.priceAsOf)}</p>` : ""}
        </div>
      </li>`,
        )
        .join("\n      ")}
    </ul>
    <p class="price-note">Raw prices are TCGplayer market via TCGdex, read ${esc(longDate(cardsChecked) || cardsChecked || "recently")}.
      PSA 10 prices come from pokemonpricetracker.com and only exist for some cards, so the line is shown where we
      have one and left off where we do not. Promos are not in that feed at all: where a promo carries a price it was
      read by hand from the source named under it, on the date shown, and it does not refresh overnight like the rest. We do not sell cards.</p>
  </div>
</section>`
    : v.hasHit === false
      ? `<section class="band tight nohits">
  <div class="wrap">
    <img class="nohits-img" src="/assets/trubbish.webp" alt="" loading="lazy" onerror="this.remove()" decoding="async" width="180" height="180">
    <h2>No hits. Just another <span class="hl">classic</span> garbage rip.</h2>
    <p class="lede">That is most of them. The good ones only mean anything because of these.</p>
    <p><a class="btn btn-sky btn-sm" href="/hall.html">See the ones that did hit</a></p>
  </div>
</section>`
      : ""
}

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
        ${hasLogo(setId) ? `<img class="setlogo"${logoAttrs(setId)} src="/assets/logos/${setId}-pokemon-tcg-set-logo.webp" alt="" loading="lazy" onerror="this.remove()">` : ""}
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
<!-- </main> CLOSES HERE, NOT ABOVE THE THREE BANDS.
     It used to close right after the player, which left "What you are chasing",
     "More from <box>" and "More <set>" as direct children of <body>: three
     content sections with their own h2, outside every landmark, on all 311 rip
     pages. That is not a tidiness point. The skip link targets #main, so a
     reader who takes it lands in a region that ends before more than half the
     page, and anyone navigating by landmark finds those sections in no region
     at all. axe reports it as "All page content should be contained by
     landmarks"; the lived version is that the skip link undersells the page.
     main{padding:var(--s4) 0 var(--s8)} now puts its 64px bottom padding below
     the last band instead of above the first, which is where it belonged. -->
</main>

${footer()}
<script>
// The player lives in /assets/packplayer.js, which shared/chrome.mjs now ships
// on EVERY page via APP_JS, so this page must not request it a second time.
// It did, and the IIFE ran twice on all 311 rip pages: two sets of document
// listeners, and window.GRPack pointing at the second instance while the
// first kept an orphaned registry of what was playing.
addEventListener('DOMContentLoaded',function(){
  var r=document.querySelector('.rip-stage');
  if(r&&window.GRPack) GRPack.attach(r);
});
</script>
<div class="hitlb" id="hitlb" role="dialog" aria-modal="true" aria-labelledby="hitlbName" hidden>
  <div class="hitlb-in">
    <button class="hitlb-x" type="button" id="hitlbX" aria-label="Close">&times;</button>
    <img id="hitlbImg" alt="">
    <div class="hitlb-b">
      <p class="hitlb-n" id="hitlbName"></p>
      <p class="hitlb-s" id="hitlbSet"></p>
      <p class="hitlb-p" id="hitlbPrice"></p>
      <p class="hitlb-psa" id="hitlbPsa"></p>
      <p class="hitlb-src" id="hitlbSrc"></p>
    </div>
  </div>
</div>
<script>
(function(){
  var list=document.getElementById('hitcards');
  if(!list) return;
  var cards=list.querySelectorAll('.hitcard');
  if(!cards.length) return;

  // Strips the hidden state at its SOURCE rather than overriding it. Adding
  // .is-in only wins if the transition then runs; dropping .is-armed removes
  // the opacity:0 rule outright, so the cards are visible even if nothing
  // animates. A failsafe that itself depends on the animation is not one.
  function revealAll(){
    list.classList.remove('is-armed');
    for(var i=0;i<cards.length;i++) cards[i].classList.add('is-in');
  }
  // ARM AND REVEAL ARE COUPLED, and they were not. Arming hides every card
  // immediately and the reveal was left entirely to the observer, so anything
  // that stopped the observer firing left all 14 cards permanently invisible.
  // That is a worse failure than no animation at all, and it is what shipped.
  if(!('IntersectionObserver' in window) ||
     (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)){
    return;   // never armed, so the cards are simply visible
  }
  list.classList.add('is-armed');

  // FAILSAFE. If the observer has not revealed everything within two seconds,
  // show it anyway. No animation is a small loss; an invisible section is not.
  var failsafe=setTimeout(revealAll, 2000);

  var io=new IntersectionObserver(function(entries){
    for(var i=0;i<entries.length;i++){
      if(!entries[i].isIntersecting) continue;
      entries[i].target.classList.add('is-in');
      io.unobserve(entries[i].target);
    }
    if(!list.querySelector('.hitcard:not(.is-in)')) clearTimeout(failsafe);
  },{rootMargin:'0px 0px -5% 0px',threshold:0});
  for(var i=0;i<cards.length;i++) io.observe(cards[i]);

  // Tap a card for a bigger scan and the full price detail.
  var lb=document.getElementById('hitlb'), lbImg=document.getElementById('hitlbImg');
  var lastFocus=null;
  function txt(id,v){ var e=document.getElementById(id); e.textContent=v||''; e.hidden=!v; }
  function open(li){
    lastFocus=document.activeElement;
    var img=li.getAttribute('data-img');
    if(img){ lbImg.src=img; lbImg.alt=li.getAttribute('data-name')+', '+li.getAttribute('data-set'); lbImg.hidden=false; }
    else lbImg.hidden=true;
    txt('hitlbName', li.getAttribute('data-name'));
    var n=li.getAttribute('data-n');
    txt('hitlbSet', li.getAttribute('data-set') + (n ? ' \u2022 #'+n : '') );
    var rar=li.getAttribute('data-rarity'), pr=li.getAttribute('data-price');
    txt('hitlbPrice', pr ? pr+' raw NM' + (rar ? '  \u2022  '+rar : '') : (rar||'No market price'));
    var psa=li.getAttribute('data-psa');
    txt('hitlbPsa', psa ? psa+' in a PSA 10' : '');
    var src=li.getAttribute('data-src');
    txt('hitlbSrc', src ? 'Price from '+src : '');
    lb.hidden=false;
    document.body.style.overflow='hidden';
    document.getElementById('hitlbX').focus();
  }
  function close(){
    lb.hidden=true; document.body.style.overflow='';
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }
  list.addEventListener('click',function(e){
    var btn=e.target.closest ? e.target.closest('.hitcard-open') : null;
    if(!btn) return;
    open(btn.parentNode);
  });
  document.getElementById('hitlbX').addEventListener('click',close);
  // Click the backdrop, but not the card itself.
  lb.addEventListener('click',function(e){ if(e.target===lb) close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape' && !lb.hidden) close(); });
})();
</script>
${APP_JS}
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

// The non-English guides live in the same folder but come from a different
// source file, so they need collecting separately or they stay out of search
// entirely. Lower priority than the English guides on purpose: they answer a
// narrower question, and most of the audience is searching the English name.
try {
  const ig = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8"));
  setPages = setPages.concat(
    Object.entries(ig.sets || {})
      // A guide with no checklist at all is published noindex by
      // build-intl-pages, so listing it here would be the sitemap asking a
      // crawler to fetch a page that tells it to go away. Two of the thirteen.
      .filter(([, g]) => g.hasCards)
      .map(([id]) => ({
        loc: `${SITE}/sets/${id}.html`, freq: "monthly", pri: "0.7", mod: ig.checked,
      }))
  );
} catch {
  /* run: node scripts/sync-intl-guides.mjs && node scripts/build-intl-pages.mjs */
}

// The per-Pokemon pages. Thirty of them, each a real page of card data, so they
// belong in the sitemap; the roster is capped deliberately (see build-pokemon)
// so this can never balloon into a thousand thin pages.
try {
  const pk = JSON.parse(await readFile(join(ROOT, "public/data/pokemon-index.json"), "utf8"));
  setPages = setPages.concat(
    (pk.pokemon || []).map((p) => ({
      loc: `${SITE}/pokemon/${p.slug}.html`, freq: "weekly", pri: "0.7", mod: pk.checked,
    }))
  );
} catch {
  /* run: node scripts/build-pokemon.mjs */
}

const urls = [
  { loc: `${SITE}/`, freq: "daily", pri: "1.0" },
  { loc: `${SITE}/videos.html`, freq: "daily", pri: "0.9" },
  { loc: `${SITE}/sets/`, freq: "weekly", pri: "0.9" },
  ...setPages,
  { loc: `${SITE}/playlists.html`, freq: "weekly", pri: "0.7" },
  // One page per playlist, generated by build-playlists.mjs, which stamps
  // `path` onto each entry. Read from the data rather than re-derived, so a
  // url can never be in the sitemap without the page existing.
  ...(JSON.parse(await readFile(join(ROOT, "public/data/playlists.json"), "utf8")).playlists || [])
    .filter((p) => p.path)
    .map((p) => ({ loc: `${SITE}/${p.path}`, freq: "weekly", pri: "0.6" })),
  // Added later than the rest and missed here: all three are indexable and
  // linked from the nav on every page, so leaving them out told search engines
  // the opposite of what the site says.
  { loc: `${SITE}/wanted.html`, freq: "weekly", pri: "0.8" },
  { loc: `${SITE}/hall.html`, freq: "weekly", pri: "0.8" },
  { loc: `${SITE}/shops.html`, freq: "monthly", pri: "0.7" },
  // Only once they have entries. Both render an honest empty state and go
  // noindex while the list is empty, so listing them in the sitemap before
  // then would contradict the page and fail check-build's noindex rule.
  ...(JSON.parse(await readFile(join(ROOT, "data/vendors.json"), "utf8")).vendors.length
    ? [{ loc: `${SITE}/vendors.html`, freq: "monthly", pri: "0.7" }]
    : []),
  ...(JSON.parse(await readFile(join(ROOT, "data/creators.json"), "utf8")).creators.length
    ? [{ loc: `${SITE}/creators.html`, freq: "monthly", pri: "0.7" }]
    : []),
  { loc: `${SITE}/about.html`, freq: "monthly", pri: "0.8" },
  // The complete set list. High priority: it is the most linkable reference
  // page on the site and the one most likely to be found cold in search.
  { loc: `${SITE}/expansions.html`, freq: "weekly", pri: "0.9" },
  // Observed hit rates. The most linkable page on the site: nobody else has
  // this data, so it is the one most likely to be cited from outside.
  // Only when it has data. An empty page in the sitemap at priority 0.9 tells
  // a crawler this is one of the most important pages on the site, and it is
  // currently a dash and a zero. check-build.py already fails a noindex page
  // that appears here, so leaving it in would break the build as well.
  ...(JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8")).videos.some(
    (v) => typeof v.hasHit === "boolean",
  )
    ? [{ loc: `${SITE}/luck.html`, freq: "weekly", pri: "0.9" }]
    : []),
  // Release dates. High priority and frequent: this is the page people search
  // for by name in the weeks before a set drops.
  { loc: `${SITE}/upcoming.html`, freq: "weekly", pri: "0.9" },
  // The beginner guide. Evergreen and the best long-tail search target on the
  // site: "pokemon card rarity symbols" is asked constantly and never expires.
  { loc: `${SITE}/rarity.html`, freq: "monthly", pri: "0.9" },
  // Local card show calendar. Weekly and high priority: it carries Event
  // structured data, the listings genuinely change, and "card shows near me" is
  // the kind of local search this site can actually win.
  { loc: `${SITE}/card-shows.html`, freq: "weekly", pri: "0.9" },
  // Card search. 4,481 cards with live prices behind one page: the deepest
  // reference on the site and the one worth crawling most often.
  { loc: `${SITE}/cards.html`, freq: "daily", pri: "0.9" },
  // The beginner hub. The natural landing page from a video description, and
  // the front door for every guide on the site.
  { loc: `${SITE}/start.html`, freq: "monthly", pri: "0.9" },
  { loc: `${SITE}/pokemon/`, freq: "weekly", pri: "0.8" },
  // Real vs fake. Evergreen and the best long-tail target on the site after the
  // rarity guide: "how to spot fake pokemon cards" is asked constantly and the
  // answer does not expire.
  { loc: `${SITE}/fake-cards.html`, freq: "monthly", pri: "0.9" },
  // Grading costs. Weekly rather than monthly because the fee table goes stale
  // fast: PSA paused two tiers in June with two weeks' notice.
  { loc: `${SITE}/grading.html`, freq: "weekly", pri: "0.9" },
  // Daily: the totals are recomputed by the nightly price sync, so this page
  // genuinely changes every night. Nothing else here does.
  { loc: `${SITE}/complete-a-set.html`, freq: "daily", pri: "0.9" },
  // Pack prices per set. Daily for the same reason as the line above: every
  // figure on it is recomputed from the product prices the nightly sync pulls,
  // so the page genuinely changes when the market does.
  { loc: `${SITE}/pack-prices.html`, freq: "daily", pri: "0.9" },
  // "What set is my card from". Monthly: the index only moves when a set ships.
  // High priority anyway, because it is the same kind of evergreen reference as
  // the rarity guide and it is the page somebody lands on holding a card.
  { loc: `${SITE}/what-set.html`, freq: "monthly", pri: "0.9" },
  // The games. Monthly rather than weekly: the pages themselves barely change,
  // it is the data behind them that moves. "who's that pokemon" and "pokemon
  // trivia" are both high volume searches this site has a real answer to, which
  // is why they are 0.8 and not an afterthought.
  { loc: `${SITE}/games/`, freq: "monthly", pri: "0.8" },
  { loc: `${SITE}/games/whos-that-pokemon.html`, freq: "monthly", pri: "0.8" },
  { loc: `${SITE}/games/guess-the-set.html`, freq: "monthly", pri: "0.8" },
  { loc: `${SITE}/games/pokemon-trivia.html`, freq: "monthly", pri: "0.8" },
  // Pokedex lore. Evergreen, and the only page on the site that is not about
  // buying, opening or valuing anything.
  { loc: `${SITE}/lore.html`, freq: "monthly", pri: "0.8" },
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
