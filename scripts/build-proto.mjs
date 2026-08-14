#!/usr/bin/env node
// Fill the homepage prototype with real data.
//
//   node scripts/build-proto.mjs
//
// Everything the page shows comes from public/data/videos.json and sets.json:
// the filter counts, the Hall of Fame, the newest rips, the most watched, and
// the Card Pokedex band. Nothing on the page is a number anyone typed, so what the
// prototype shows is what the real homepage will show.
//
// Idempotent: each region is replaced between its own pair of markers.

import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import { ripLabel } from "../shared/riplabel.mjs";
import { SITE, DOMAIN, STAGING, LIVE } from "../shared/site.mjs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDrift } from "../shared/chrome.mjs";
import { esc, MONTHS_SHORT as MONTHS, moneyCompact } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// The live home page and the prototype share one design and one generator, so
// the prototype can never drift into showing something the real page does not.
// The prototypes are gone: they were scratch pages that shipped to the deploy
// root, publicly reachable and carrying no canonical or description.
// ALL THREE HAND-MAINTAINED PAGES, not just the home page.
//
// This list was one entry, and the domain rewrite below (see OTHER) is the only
// thing that moves an absolute url off the staging host. Every other page is
// generated and takes its urls from shared/site.mjs, so flipping LIVE moves
// them automatically. videos.html and playlists.html are written by nobody, so
// they kept their github.io canonical, og:url and og:image through the flip.
//
// /videos.html is the "Every Rip" hub and the joint highest-priority entry in
// the sitemap at 0.9. After launch the sitemap would have said
// garbagerips585.com/videos.html while the page canonicalised to an abandoned
// host, which is a conflict a search engine usually resolves by dropping the
// url rather than by picking one.
const TARGETS = [
  join(ROOT, "public/index.html"),
  join(ROOT, "public/videos.html"),
  join(ROOT, "public/playlists.html"),
];

/* ------------------------------------------------------------------ data -- */

const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
// How many set guides /sets/ actually publishes: the English sets plus the
// imported ones that have a checklist. The rail used to print sets.length,
// which is only the English half, so one page carried "All 23 sets" and "All 36
// guides" pointing at the same url 2,500px apart.
// EVERY guide /sets/ links, not just the ones with a checklist. Filtering on
// hasCards gave 34 against the 36 files that page actually lists: the two
// imported guides with no checklist are published noindex but are still linked
// there, so a visitor who follows this chip finds 36 of them.
const setGuideCount = sets.length + Object.keys(
  JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {},
).length;
const rawVideos = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const descriptions = JSON.parse(await readFile(join(ROOT, "data/descriptions.json"), "utf8").catch(() => "{}"));
const videos = rawVideos.videos || rawVideos;

const setName = new Map(sets.map((s) => [s.id, s.name]));

const dirSet = async (sub, suffix) =>
  new Set(
    (await readdir(join(ROOT, "public/assets", sub)))
      .filter((f) => f.endsWith(".webp"))
      .map((f) => f.replace(suffix, ""))
  );
// Graded prices, so a Pokedex tile can say what the best card in that set is
// worth. Same precedence and same ten-sale floor as everywhere else.
let graded = {};
try {
  graded = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8"));
} catch { /* optional */ }
const gradedPrice = (setId, number) => {
  const k = `${setId}-${number}`;
  const m = graded.prices?.[k];
  const manual = typeof m?.price === "number" ? m.price : typeof m === "number" ? m : null;
  if (manual) return manual;
  const a = graded.auto?.[k];
  if (!a?.psa10 || (a.psa10Sales != null && a.psa10Sales < 10)) return null;
  return a.psa10;
};

const packs = await dirSet("packs", /-garbage-rips-585-booster-pack\.webp$/);

let wanted = { cards: [] };
try {
  wanted = JSON.parse(await readFile(join(ROOT, "public/data/wanted.json"), "utf8"));
} catch {
  /* no hunt list yet: the band renders empty and the section hides itself */
}
const logos = await dirSet("logos", /-pokemon-tcg-set-logo\.webp$/);

/* ------------------------------------------------------------- formatting - */

function shortDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`.trim() + (Number(y) < new Date().getFullYear() ? ` ${y}` : "");
}
function monthYear(iso) {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1] || ""} ${y}`.trim();
}
function clock(sec) {
  if (!sec) return "";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

// Matches niceViews() in build-pages.mjs. They disagreed above a million: this
// one divided by 1000 forever, so a video at 1.5M views read "1500K VIEWS" on
// its home page tile and "1.5M views" on its own page.
function compact(n) {
  if (!n) return "0";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  return n >= 1000 ? `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "")}K` : String(n);
}

/* ------------------------------------------------------------------ tiles - */

// The pull ladder, richest first. These are the tags shared/taxonomy.mjs
// assigns, and the label is what the card's own rarity symbol means.
const PULL_RANK = [
  ["gold", "&starf;&starf;&starf; HYPER"],
  ["sir", "&starf;&starf; SIR"],
  ["ir", "&starf; IR"],
  ["double-rare", "&starf;&starf; DOUBLE"],
  ["charizard", "CHARIZARD"],
];
const pullIndex = new Map(PULL_RANK.map(([k], i) => [k, i]));

function bestPull(v) {
  let best = null;
  for (const p of v.pulls || []) {
    const i = pullIndex.get(p);
    if (i != null && (best == null || i < best)) best = i;
  }
  return best;
}

/**
 * One video tile.
 *
 * The face is the booster wrapper for the video's set, never YouTube's poster
 * frame: the poster is almost always the pulled card, so it spoils the video
 * before you press play. A video with no set tag, or a set with no artwork
 * yet, falls back to the set logo on a plain field rather than to a broken
 * image or a spoiler.
 */
/**
 * Which set's wrapper to show for a video.
 *
 * A video can carry several sets: an ex Box or a premium collection holds packs
 * from more than one, and one video is often one of those packs. The first
 * tagged set is the one the video is really about, so it wins; but if we have
 * no artwork for it and do for another, show the one we can actually draw
 * rather than falling back to the plain tile.
 */
function faceSet(v) {
  const list = v.sets || [];
  // A tin with packs from two sets, or a box with packs from four, is not
  // honestly represented by any one of their wrappers. If the generic
  // multi-set wrapper exists, that is the truthful tile. Until the artwork is
  // drawn this falls through to the old behaviour rather than breaking.
  if (list.length > 1 && packs.has("multi")) return "multi";
  return list.find((s) => packs.has(s)) || list[0] || null;
}

/** "TODAY", "3 DAYS AGO", "2 WEEKS AGO". Short enough for a corner chip. */
function ago(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "TODAY";
  if (days === 1) return "YESTERDAY";
  if (days < 7) return `${days} DAYS AGO`;
  if (days < 30) return `${Math.round(days / 7)} WEEK${Math.round(days / 7) === 1 ? "" : "S"} AGO`;
  if (days < 365) return `${Math.round(days / 30.44)} MONTHS AGO`;
  return `${Math.floor(days / 365)}Y AGO`;
}

function tile(v, { rank = null, showSet = true, dated = false } = {}) {
  const all = v.sets || [];
  const set = faceSet(v);
  const hasPack = set && packs.has(set);
  // A tile is at most ~200 CSS px, so the 400px file covers it at 2x. srcset
  // lets a desktop browser take the big one if it ever needs it, and sizes
  // tells it how wide the tile actually is, which it cannot work out from the
  // markup alone.
  const face = hasPack
    ? `<img src="assets/packs/${set}-garbage-rips-585-booster-pack-tile.webp"
        srcset="assets/packs/${set}-garbage-rips-585-booster-pack-tile.webp 400w, assets/packs/${set}-garbage-rips-585-booster-pack.webp 810w"
        sizes="(max-width: 640px) 45vw, 200px" alt="" loading="lazy" width="400" height="711">`
    : packs.has("default")
      ? `<img src="assets/packs/default-garbage-rips-585-booster-pack.webp" alt="" loading="lazy">`
      : `<span class="art-none">${
        set && logos.has(set)
          ? `<img src="assets/logos/${set}-pokemon-tcg-set-logo.webp" alt="" loading="lazy">`
          : `<b>Garbage Rips</b>`
      }</span>`;

  const p = bestPull(v);
  const flag = p != null && rank == null ? `<span class="hit">${PULL_RANK[p][1]}</span>` : "";
  const badge = rank != null ? `<span class="rank">${rank}</span>` : "";
  // A relative date on the artwork. The Latest block is six tiles of which
  // five are usually the same wrapper, because tiles show the SET's pack
  // rather than a thumbnail that would give the pull away. That is the
  // anti-spoiler rule working, but it left a column of identical rectangles
  // separated only by two clipped lines of title. The chip differentiates them
  // with the one fact this block is about: how new it is.
  const stamp = dated ? `<span class="when">${esc(ago(v.published))}</span>` : "";

  // The meta line is one line, so it has to earn every character. In the wall
  // the wrapper already names the set, so the useful pair is popularity and
  // recency. On the Hall of Fame shelf the date is irrelevant, so the set
  // takes its place.
  // Label from the real sets, never from the face. Once the generic wrapper
  // exists faceSet returns "multi", which is an artwork choice and would read
  // here as though there were a card set called Multi.
  const extra = all.length > 1 ? ` +${all.length - 1}` : "";
  const label = all.length
    ? `${(setName.get(all[0]) || all[0]).toUpperCase()}${extra}`
    : "GARBAGE RIPS";
  const meta = showSet
    ? `${label} &bull; ${compact(v.views)} VIEWS`
    : `${compact(v.views)} VIEWS &bull; ${shortDate(v.published).toUpperCase()}`;

  // The anchor holds only artwork, a rank pip and a duration, so without a
  // label its accessible name was the duration: a screen reader read twenty
  // links on the home page as "link, 0 colon 22". The visible title was also
  // not clickable, only the thumbnail was.
  return `      <article class="v"><a class="art" href="/${esc(v.path)}" aria-label="${esc(v.siteTitle || v.title)}">${badge}${flag}${stamp}${face}<span class="play"></span>${
    v.duration ? `<span class="dur">${clock(v.duration)}</span>` : ""
  }</a>
        <h3><a href="/${esc(v.path)}">${esc(ripLabel(v, setName, descriptions[v.id]) || v.siteTitle || v.title)}</a></h3><p>${meta}</p></article>`;
}

/* ------------------------------------------------------------- selections - */

// "Feature" on the sheet pins a rip to the front of Latest, whatever its date:
// a rip worth leading with is not always the newest one.
const byNewest = [...videos].sort((a, b) =>
  (b.feature ? 1 : 0) - (a.feature ? 1 : 0) ||
  String(b.published).localeCompare(String(a.published)) ||
  (b.views || 0) - (a.views || 0)
);

// Greatest Hits: the RIPS worth watching, which is a different thing from the
// Card Hall of Fame on /hall.html. That page ranks cards; this ranks videos.
// A real pull outranks a big view count, and views break ties
// inside a tier. This is a stand-in until the Greatest Hits playlist exists on
// YouTube, which is what the production page will key off.
//
// One per set. Strict ranking put three identical Destined Rivals wrappers in
// the first three slots, which reads as a duplicate render rather than as three
// different rips. Taking each set's best pull instead keeps the order honest
// (the heading says "ranked", and it is) while making every wrapper different.
// The full ranking is one tap away behind "All hits".
//
// Needs a wrapper to show, so a hit with no set tag is skipped here rather
// than rendering the fallback tile in the most prominent row on the page. It
// still counts toward "All hits" and still has its own page.
const HALL_PER_SET = 1;
const hall = [];
const perSet = {};
for (const v of videos
  .filter((v) => bestPull(v) != null && (v.sets || []).some((s) => packs.has(s)))
  // A rank typed on the sheet wins outright; everything without one falls in
  // behind by pull tier, then views.
  .sort((a, b) =>
    (a.hofRank ?? 999) - (b.hofRank ?? 999) ||
    bestPull(a) - bestPull(b) ||
    (b.views || 0) - (a.views || 0)
  )) {
  const s = faceSet(v) || "_";
  if ((perSet[s] = (perSet[s] || 0) + 1) > HALL_PER_SET) continue;
  hall.push(v);
  // SIX, NOT EIGHT. The grid is 6 columns wide, so eight tiles filled one row
  // and left two stranded on a second, which is what made the band read as a
  // spilling wall rather than a shelf. Six is exactly one row.
  if (hall.length === 6) break;
}

// MOST WATCHED IS GONE FROM THE HOME PAGE. It was the least curated of the
// three bands: whatever the algorithm happened to reward, which is not the same
// as the best work, and on a page that should be a considered introduction it
// was three more rows of pack art earning nothing. /videos.html?sort=views
// still exists for anybody who wants it. Bring it back when there is a video
// whose view count is itself the story.

const setCounts = {};
const productCounts = {};
for (const v of videos) {
  for (const s of v.sets || []) setCounts[s] = (setCounts[s] || 0) + 1;
  for (const p of v.products || []) productCounts[p] = (productCounts[p] || 0) + 1;
}
const PRODUCT_LABELS = {
  "single-pack": "Single pack", etb: "ETB", bundle: "Booster bundle", "ex-box": "ex box",
  tin: "Tin", blister: "Blister", "collection-box": "Collection box", upc: "UPC",
};

const topSets = Object.entries(setCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
const hitCount = videos.filter((v) => bestPull(v) != null).length;

/* ------------------------------------------------------------------ logos - */

/**
 * Read a WebP's pixel dimensions from its header.
 *
 * Worth the 20 lines: these logos range from 1.3:1 (151) to 5:1 (Mega
 * Evolution), and sizing them all to one height makes the wide ones look half
 * the size of the tall ones. Sizing by area instead needs the real aspect
 * ratio, and only the file knows it.
 */
function webpSize(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const fourcc = buf.toString("ascii", 12, 16);
  if (fourcc === "VP8X") return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  if (fourcc === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (fourcc === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  return null;
}

const BOX_W = 144, TARGET_AREA = 5000, MIN_H = 34, MAX_H = 58;

async function logoHeight(id) {
  try {
    const size = webpSize(await readFile(join(ROOT, `public/assets/logos/${id}-pokemon-tcg-set-logo.webp`)));
    if (!size?.h) return null;
    const ratio = size.w / size.h;
    return Math.round(Math.min(Math.min(MAX_H, Math.max(MIN_H, Math.sqrt(TARGET_AREA / ratio))), BOX_W / ratio));
  } catch {
    return null;
  }
}

/**
 * width/height for a set logo, from the file itself.
 *
 * logoHeight() above already reads the real dimensions to compute the display
 * height; they were just never emitted as attributes, so 23 lazy logos on the
 * home page had no reserved box and the section reflowed as they landed.
 */
async function logoAttrs(id) {
  try {
    const size = webpSize(await readFile(join(ROOT, `public/assets/logos/${id}-pokemon-tcg-set-logo.webp`)));
    return size?.w ? ` width="${size.w}" height="${size.h}"` : "";
  } catch {
    return "";
  }
}

/* ----------------------------------------------------------------- regions */

const railHtml = [
  `    <a class="chip chip-lead" href="/videos.html">Latest <span class="n">${videos.length}</span></a>`,
  `    <a class="chip gold" href="/videos.html?pull=1">Hits only <span class="n">${hitCount}</span></a>`,
  ...topSets.map(([id, n]) =>
    `    <a class="chip" href="/videos.html?set=${id}">${esc(setName.get(id) || id)} <span class="n">${n}</span></a>`),
  ...topProducts.map(([id, n]) =>
    `    <a class="chip" href="/videos.html?product=${id}">${esc(PRODUCT_LABELS[id] || id)} <span class="n">${n}</span></a>`),
  // COUNTS THE PAGE IT LINKS TO, not the grid below. This read "All 23 sets"
  // while /sets/ lists 36, and the Pokedex band 2,500px down said "All 36
  // guides" to the same url. Two numbers for one destination on one page.
  `    <a class="chip" href="/sets/">All ${setGuideCount} set guides &rarr;</a>`,
].join("\n");

// THE ONE HALL OF FAME HIT, framed. Separate from the Greatest Hits shelf
// below it: the shelf is a row of six to browse, this is a single card the page
// stops on. hall is already sorted by a typed hofRank, then pull tier, then
// views, so hall[0] is the pick and Tim can override it from the sheet.
//
// Renders nothing when there is no hall, so the band cannot appear as an empty
// gold frame on a fresh clone.
const hofPick = hall[0] || null;
const hofHtml = hofPick
  ? `<a class="hofx" href="/${esc(hofPick.path)}">
        <span class="hofx-tag">Hall of Fame hit</span>
        <span class="hofx-art">
          ${(() => {
            // Same pack art the tiles use, at the larger size: this one is the
            // feature, so it is not sharing a row with five others.
            const fs = faceSet(hofPick);
            return fs && packs.has(fs)
              ? `<img src="assets/packs/${fs}-garbage-rips-585-booster-pack.webp" alt="" loading="lazy" decoding="async" width="810" height="1440">`
              : packs.has("default")
                ? `<img src="assets/packs/default-garbage-rips-585-booster-pack.webp" alt="" loading="lazy" decoding="async">`
                : `<b>Garbage Rips</b>`;
          })()}
        </span>
        <span class="hofx-b">
          <span class="hofx-t">${esc(ripLabel(hofPick, setName, descriptions[hofPick.id]) || hofPick.siteTitle || hofPick.title)}</span>
          <span class="hofx-m">${[setName.get(faceSet(hofPick)) || "", hofPick.views ? compact(hofPick.views) + " views" : ""]
            .filter(Boolean).map(esc).join(" &bull; ")}</span>
          <span class="hofx-cta">Watch the pull <span aria-hidden="true">&rarr;</span></span>
        </span>
      </a>`
  : "";

// THE SHELF SKIPS WHATEVER THE GOLD FRAME ALREADY SHOWS. hofPick is hall[0],
// so mapping the whole of `hall` printed the same rip twice within 250px: once
// as a 614px spotlight and again as shelf rank #1, wearing the same wrapper
// both times. Twelve tiles were showing ten videos. "A little more curated"
// starts with not repeating yourself.
const hallList = hall.filter((v) => !hofPick || v.id !== hofPick.id);
/**
 * The newest rip, given its own row.
 *
 * Six equal tiles made the freshest thing on the channel look like one of six,
 * and because five of them usually wear the same wrapper it read as a column
 * of repeats rather than as news. One wide tile plus four beneath it says
 * which one is new without anybody having to read a date.
 */
function heroTile(v, opts) {
  const o = opts || {};
  const set = faceSet(v);
  const face = set && packs.has(set)
    ? `<img src="assets/packs/${set}-garbage-rips-585-booster-pack-tile.webp"
           srcset="assets/packs/${set}-garbage-rips-585-booster-pack-tile.webp 400w, assets/packs/${set}-garbage-rips-585-booster-pack.webp 810w"
           sizes="(max-width:640px) 42vw, 260px" alt="" width="400" height="711" fetchpriority="high">`
    : `<img src="assets/packs/default-garbage-rips-585-booster-pack.webp" alt="" width="400" height="711" fetchpriority="high">`;
  const all = v.sets || [];
  const label = all.length ? (setName.get(all[0]) || all[0]).toUpperCase() : "GARBAGE RIPS";
  const p = bestPull(v);
  return `      <article class="hero">
        <a class="hero-art" href="/${esc(v.path)}" aria-label="${esc(v.siteTitle || v.title)}">
          ${face}<span class="play"></span>${v.duration ? `<span class="dur">${clock(v.duration)}</span>` : ""}
        </a>
        <div class="hero-body">
          <p class="hero-kicker">${
            o.dated
              ? `<span class="hero-new">Newest rip</span> ${esc(ago(v.published))}`
              : o.rankOf
                ? `<span class="hero-new">${esc(o.rankOf(v))}</span> ${esc(ago(v.published))}`
                : esc(ago(v.published))
          }</p>
          <h3><a href="/${esc(v.path)}">${esc(ripLabel(v, setName, descriptions[v.id]) || v.siteTitle || v.title)}</a></h3>
          <p class="hero-meta">${label}${p != null ? ` &bull; ${PULL_RANK[p][1]}` : ""} &bull; ${compact(v.views)} VIEWS</p>
          <span class="hero-cta">Rip it open &rarr;</span>
        </div>
      </article>`;
}

// AND LATEST SKIPS WHATEVER IS ALREADY ABOVE IT. The newest rip was also
// sitting in the Greatest Hits shelf 1,300px higher, so the page opened with
// the same video presented as two different kinds of recommendation. Filtered
// against everything already shown, then the hero is the newest of what is
// left, which is still genuinely the newest thing a visitor has not just seen.
const shownAbove = new Set([hofPick && hofPick.id, ...hall.map((v) => v.id)].filter(Boolean));
const freshest = byNewest.filter((v) => !shownAbove.has(v.id));

/**
 * A band of one large video at a time.
 *
 * The home page showed 11 tiles across two bands, which asked a casual visitor
 * to choose from a wall of near-identical pack wrappers before seeing a second
 * of anything. Worse now that a tile plays where it sits: a 158px tile gives a
 * 133px video, which is not worth playing. One slide per band makes the video
 * as large as the band allows and puts the rest a swipe away.
 *
 * Every slide uses the hero shape, so the artwork is large and the title, set
 * and view count sit beside it rather than under it.
 *
 * The track is a native scroll-snap row. Swipe, trackpad, shift+wheel and
 * keyboard all work with no JavaScript; the arrows only call scrollBy, so with
 * JS off this is still a usable horizontal scroller rather than a dead band.
 */
function carousel(list, opts) {
  const o = opts || {};
  if (!list.length) return "";
  return `<div class="vcar" data-vcar>
      <div class="vcar-track">
${list
        .map((v, i) => `        <div class="vcar-slide">${heroTile(v, {
          // "Newest rip" is true of exactly one video, so only slide one wears
          // the badge. The rest carry their date, which is the honest version
          // of the same information.
          dated: !!o.dated && i === 0,
          rankOf: o.showSet ? () => `#${i + 1} hit` : null,
        })}</div>`)
        .join("\n")}
      </div>
      ${list.length > 1 ? `<div class="vcar-bar">
        <button class="vcar-nav" type="button" data-vcar-prev aria-label="Previous rip">&larr;</button>
        <p class="vcar-count" aria-live="polite"><span data-vcar-i>1</span> / ${list.length}</p>
        <button class="vcar-nav" type="button" data-vcar-next aria-label="Next rip">&rarr;</button>
      </div>` : ""}
    </div>`;
}

// FIVE PER BAND, NOT ELEVEN ON THE PAGE. The point of one-at-a-time is that
// the landing view is short, so the slides that exist beyond the first cost
// nothing but a swipe. Five is enough to feel like there is more without
// turning the band into a scroll the length of the old grid.
const latestHtml = carousel((freshest.length ? freshest : byNewest).slice(0, 5), { dated: true });
const hallHtml = carousel(hallList.slice(0, 5), { showSet: true });

const ordered = [...sets].sort((a, b) => String(b.released).localeCompare(String(a.released)));
const setsHtml = (
  await Promise.all(
    ordered.map(async (s) => {
      const n = setCounts[s.id] || 0;
      const total = s.total || s.printedTotal;
      const bits = [total ? `${total} cards` : null, monthYear(s.released) || null].filter(Boolean);
      const h = logos.has(s.id) ? await logoHeight(s.id) : null;
      const face = h
        ? `<img${await logoAttrs(s.id)} src="assets/logos/${s.id}-pokemon-tcg-set-logo.webp" alt="" loading="lazy" style="--lh:${h}px">`
        : `<span class="set-name">${esc(s.name)}</span>`;
      // What the best card in this set is worth. PSA 10 where we have one,
      // raw otherwise, and nothing at all when we have neither.
      const top = (s.chase || [])[0];
      const topPsa = top ? gradedPrice(s.id, top.number) : null;
      const topVal = topPsa || top?.price || null;
      return `        <a class="set" href="/sets/${s.id}.html">
          <span class="set-art">${face}</span>
          <b>${esc(s.name)}</b>
          <span class="set-meta">${esc(bits.join(" · "))}</span>
          ${topVal ? `<span class="set-top">Top card ${moneyCompact(topVal)}${topPsa ? " <i>PSA 10</i>" : ""}</span>` : ""}
          ${n ? `<span class="set-rips">${n} rip${n === 1 ? "" : "s"}</span>` : ""}
        </a>`;
    })
  )
).join("\n");

// Most Wanted band. Shows a price only when there is one: the newest sets have
// no market data, and no free feed carries PSA 10 at all, so a card with
// neither simply says what it is.
const wantedHtml = (wanted.cards || [])
  .filter((c) => !c.got)
  .slice(0, 6)
  .map((c) => {
    const img = c.image || c.imageLarge;
    const price = c.psa10
      ? `PSA 10 ${moneyCompact(c.psa10)}`
      : c.raw
        ? `RAW ${moneyCompact(c.raw)}`
        : "CHASING";
    const inner = `<span class="mw-art">${
      img
        ? `<img src="${esc(img)}" alt="${esc(c.name)} ${esc(c.rarity || "")} from ${esc(c.setName)}" loading="lazy" width="245" height="342">`
        : `<span class="mw-none">${esc(c.name)}</span>`
    }</span>
        <b>${esc(c.name)}</b><p>${esc(c.setName.toUpperCase())} &bull; ${price}</p>`;
    // ALWAYS INTERNAL. These used to link out to prices.pokemontcg.io whenever
    // the card carried a url, which was 5 of the 6 cards, making the third band
    // on the home page the first thing that sends a visitor away. That already
    // contradicted the site's own rule that the only deliberate outbound links
    // are Subscribe and the socials.
    //
    // Worse than that: those urls 302 to tcgplayer.pxf.io, an affiliate
    // network. The home page was routing its visitors through somebody else's
    // affiliate link, on a band about cards Tim is still chasing. Nobody chose
    // that; it came in with the card data.
    //
    // The set guide is the honest destination: it is ours, it shows the card in
    // its checklist with the same price, and it keeps the visitor on the site.
    return `      <a class="mw" href="/sets/${esc(c.set)}.html" aria-label="${esc(c.name)} from ${esc(c.setName)}, see the ${esc(c.setName)} set guide">${inner}</a>`;
  })
  .join("\n");

// The imported set guides live in their own file and are listed on the same
// /sets/ index, so any count of "guides" has to include them.
let intlGuideCount = 0;
try {
  intlGuideCount = Object.keys(
    JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {}
  ).length;
} catch {
  /* run: node scripts/sync-intl-guides.mjs */
}

const REGIONS = {
  WANTED: wantedHtml,
  RAIL: railHtml,
  HOF: hallHtml,
  HOFPICK: hofHtml,
  LATEST: latestHtml,
  SETS101: setsHtml,
  COUNT_ALL: String(videos.length),
  COUNT_HITS: String(hitCount),
  // Every guide under /sets/, not just the English ones. The chip said "All 23
  // sets" and landed on a page listing 36, because the imported guides were
  // never counted.
  COUNT_SETS: String(sets.length + intlGuideCount),
};

// index.html carries its own copy of the bar and menu, because three other
// build scripts slice their chrome out of it. Fail loudly when that copy stops
// matching shared/chrome.mjs rather than letting six pages quietly differ.
{
  const drift = checkDrift(await readFile(TARGETS[0], "utf8"));
  if (drift.length) {
    console.error("\nindex.html has drifted from shared/chrome.mjs:");
    for (const d of drift) console.error("  " + d);
    console.error("\nMake them match, then re-run.\n");
    process.exit(1);
  }
}

// public/CNAME, generated rather than remembered.
//
// GitHub Pages deployed from an Actions workflow reads the custom domain from a
// CNAME file INSIDE the uploaded artifact. pages.yml uploads public/ only, so
// without this the custom domain setting is dropped on the next deploy and the
// site quietly reverts to the github.io host, which is the exact thing the
// canonical rewrite above exists to prevent.
//
// Written only when LIVE is true, because a CNAME naming a domain nobody owns
// yet would break the current staging deploy. So it appears at the flip, from
// the same flag, and cannot be forgotten separately.
const CNAME = join(ROOT, "public/CNAME");
if (LIVE) {
  const host = DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
  await writeFile(CNAME, host + "\n");
  console.log(`  wrote public/CNAME -> ${host}`);
} else {
  await rm(CNAME, { force: true });
}

for (const target of TARGETS) {
  let html = await readFile(target, "utf8");
  for (const [name, body] of Object.entries(REGIONS)) {
    const start = `<!-- ${name}:START -->`;
    const end = `<!-- ${name}:END -->`;
    const a = html.indexOf(start);
    const b = html.indexOf(end);
    // A MISSING MARKER IS ONLY FATAL ON THE PAGE THAT OWNS THE REGION.
    // index.html carries all of them. videos.html and playlists.html are in
    // TARGETS purely so the domain rewrite below reaches them, and they have
    // never had a content region, so treating an absent marker as an error
    // would fail the build for doing exactly what was intended.
    if (a === -1 || b === -1) {
      if (basename(target) === "index.html") {
        console.error(`Marker ${name} not found in ${target}`);
        process.exit(1);
      }
      continue;
    }
    html = html.slice(0, a + start.length) + "\n" + body + "\n" + html.slice(b);
  }
  // THESE THREE HEADS ARE HAND MAINTAINED AND WERE NOT DERIVED FROM SITE.
// index.html is the one page not generated wholesale: this script only replaces
// the marked regions, so seven absolute URLs in its head (canonical, og:url,
// og:image, twitter:image and three in the Organization JSON-LD) stayed frozen
// at whatever domain they were typed with. Flipping LIVE regenerated the other
// 396 pages onto the real domain and left the single most important URL on the
// site canonicalising to the one being abandoned. Rewriting them here means the
// homepage follows SITE like everything else.
const OTHER = SITE === DOMAIN ? STAGING : DOMAIN;
const before = (html.match(new RegExp(OTHER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
if (before) {
  html = html.split(OTHER).join(SITE);
  console.log(`  ${basename(target)}: rewrote ${before} absolute url(s) to ${SITE}`);
}

await writeFile(target, html);
}

const noArt = [...new Set(videos.flatMap((v) => v.sets || []))].filter((s) => !packs.has(s));
const untagged = videos.filter((v) => !(v.sets || []).length).length;
console.log(`index.html rebuilt from real data:
  ${videos.length} videos, ${hitCount} with a graded pull, ${sets.length} sets
  Hall of Fame: ${hall.map((v) => (v.pulls || []).join("/")).slice(0, 3).join(", ")}...
  logos: ${logos.size}/${sets.length}    pack art: ${packs.size} sets`);
if (noArt.length) console.log(`  sets ripped but with no pack art: ${noArt.join(", ")}`);
if (untagged) {
  console.log(
    `  ${untagged} videos still have no set tag and show the generic wrapper` +
      `${packs.has("default") ? "" : " (and there is no default.png yet, so they show the wordmark)"}`
  );
}

// The most valuable tagging work: a hit with no set tag cannot appear on the
// Hall of Fame shelf at all, however good the pull was.
const hiddenHits = videos.filter((v) => bestPull(v) != null && !(v.sets || []).some((s) => packs.has(s)));
if (hiddenHits.length) {
  console.log(
    `\n  ${hiddenHits.length} graded hit${hiddenHits.length === 1 ? " is" : "s are"} kept off the Hall of Fame for want of a set tag.` +
      `\n  They would all show the same generic wrapper, and a shelf of identical packs is worse than a shorter one:`
  );
  for (const v of hiddenHits.slice(0, 10)) {
    console.log(`    ${(v.pulls || []).join("/").padEnd(12)} ${v.title.slice(0, 62)}`);
  }
  if (hiddenHits.length > 10) console.log(`    ...and ${hiddenHits.length - 10} more`);
}
