#!/usr/bin/env node
// Generate a page per YouTube playlist, under public/playlists/.
//
//   node scripts/build-playlists.mjs
//
// WHY THIS EXISTS. /playlists.html rendered 22 cards whose only action was a
// link to youtube.com, on a site whose first rule is that every click stays
// here. That was a real exception, not an oversight, and the argument for it
// was that a playlist is a YouTube object: an ordered, curated run, and
// watching one in order is something YouTube does and this site did not.
//
// It does now. Every video in every playlist already has a page here, so the
// run can be shown in its own order, with the packs, and each one plays in
// place exactly as it does on the home page. The only outbound link left on
// the site is Subscribe.
//
// THE TILES ARE THE SAME COMPONENT the library and the home page use: the same
// `.v` / `.art` / `.pack` markup app.js builds in makeCard, written server side
// here. That matters twice over. It means these pages need no JavaScript to
// show their content, and it means packplayer.js picks the tiles up for free,
// because it binds to any anchor pointing at /rip/ that contains a pack.
//
// ORDER IS THE PLAYLIST'S OWN. videoIds arrives in the order Tim arranged on
// YouTube, and that order is the whole point of a playlist, so it is not
// re-sorted by date or by anything else.

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS } from "../shared/chrome.mjs";
import { labelFor } from "../shared/taxonomy.mjs";
import { slugify } from "../shared/paths.mjs";
import { esc, longDate, shortDate, viewCount, imgDims } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/playlists");

const doc = JSON.parse(await readFile(join(ROOT, "public/data/playlists.json"), "utf8"));
const { playlists } = doc;
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const byId = new Map(videos.map((v) => [v.id, v]));

// ============================================================================
// WHAT A PLAYLIST PAGE IS A PICTURE OF.
//
// These were the only pages on the site with no <img> at all. Twenty-one of
// them, 340 to 1,270 words each, and the identity of every one is carried by a
// title and nothing else: "Pokemon Chaos Rising ETB Opening Series" over a grid
// of wrappers the site drew itself. The tiles are lovely and they are the same
// green-and-gold shape on every page, so a reader landing here from search sees
// a page that could be about any set and any product.
//
// A playlist is a RUN OF ONE THING, and that is exactly what makes the two
// pictures possible. Nineteen of the twenty-one cover a single set, and twelve
// of those cover a single product type as well, so the page can show the set's
// own logo and a photograph of the actual product being opened. Between them
// they answer "what is this" and "what is being opened" without a sentence.
//
// BOTH ARE GATED ON BEING SURE, and where it is not sure the page shows nothing
// rather than something close enough. A playlist spanning two sets gets no logo. A
// playlist spanning two product types gets no photo. And the photo is only ever
// the product whose NAME is printed under it, looked up in the same
// public/data/products.json the set guides price from, never a stand-in from
// another set: "a photo of one set's product standing in for a product type
// names that set" is the one caption error that would matter here.
// ============================================================================

let LOGO_DIMS = {};
try {
  LOGO_DIMS = JSON.parse(await readFile(join(ROOT, "data/logo-dims.json"), "utf8"));
} catch {
  /* run: python3 scripts/measure-logos.py */
}
const logosOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/logos")).catch(() => []))
    .map((f) => /^(.+)-pokemon-tcg-set-logo\.webp$/.exec(f)?.[1])
    .filter(Boolean)
);
/**
 * The set logo, drawn 132px wide inside a 132x50 box.
 *
 * Offers the -sm.webp (100px tall, 5-17KB) FIRST with its own real width from
 * data/logo-dims.json, then the 300px master, so a dense screen can still take
 * the big one and nobody else pays for it. That is the same pair build-set-
 * pages.mjs offers its 110px set cards; the box here is a little wider because
 * this one is the page's identity rather than a row item.
 *
 * NOT emitted for a set with no file on disk. onerror hides a 404 in the
 * browser and the page still pays for the round trip, which is the trap
 * CLAUDE.md already records for the card scans.
 */
const LOGO_BOX_W = 132;
const LOGO_BOX_H = 50;
function setLogo(setId, alt) {
  if (!logosOnDisk.has(setId)) return "";
  const d = LOGO_DIMS[`${setId}-pokemon-tcg-set-logo.webp`];
  if (!d) return "";
  const base = `/assets/logos/${setId}-pokemon-tcg-set-logo`;
  const smW = Math.round((d[0] * 100) / d[1]);
  // SIZES IS THE RENDERED WIDTH, WHICH object-fit:contain DECIDES, NOT THE BOX.
  // Written as a flat "132px" this fetched the 300px-tall MASTER for every logo
  // narrower than 2.64:1, which is most of them: Pokemon GO is 479x300, renders
  // 80x50 inside the box, and took 31.3KB where its own -sm.webp is 8KB and
  // 160x100, an exact DPR2 fit. Chrome was right and the markup was lying to it,
  // because 132 CSS px at DPR2 asks for 264 and the -sm is 160 wide.
  // contain scales by min(boxW/w, boxH/h), so the drawn width is the smaller of
  // the box width and the height-limited width. Same arithmetic the browser
  // does; it just has to be told.
  const drawnW = Math.round(Math.min(LOGO_BOX_W, (LOGO_BOX_H * d[0]) / d[1]));
  return `<img class="plid-logo" src="${base}-sm.webp"
            srcset="${base}-sm.webp ${smW}w, ${base}.webp ${d[0]}w" sizes="${drawnW}px"
            width="${smW}" height="100" alt="${esc(alt)}" decoding="async">`;
}

// The product photos the CDN refuses, recorded beside the missing card scans.
// Same reason as build-set-pages.mjs: they carried onerror and vanished, and the
// page paid for a 403 to find out.
let deadUrls = new Set();
try {
  deadUrls = new Set(
    JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).deadUrls || [],
  );
} catch {
  /* optional */
}

let productsBySet = {};
let productsChecked = null;
try {
  const p = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8"));
  productsBySet = p.sets || {};
  productsChecked = p.checked || null;
} catch {
  /* run: node scripts/sync-products.mjs */
}

/**
 * Taxonomy product id -> the `kind` string products.json uses.
 *
 * DELIBERATELY PARTIAL. Only the ids whose meaning is one specific sealed
 * product with one photograph are here. `blister`, `tin`, `collection-box` and
 * `ex-premium` each cover several different products in a set (three different
 * blisters, four different tins), so "the" photo for them does not exist and a
 * page showing one of the four under a name covering all four would be the
 * caption error this whole block is written to avoid. Those playlists get a
 * logo and no photo, which is the correct amount of certainty.
 *
 * The Japanese, Korean and Chinese pack ids are absent for a different reason:
 * products.json is TCGplayer's US catalogue and holds no imported product.
 */
const PRODUCT_KIND = {
  etb: "Elite Trainer Box",
  bundle: "Booster Bundle",
  "single-pack": "Single Pack",
  "booster-box": "Booster Box",
  upc: "Ultra-Premium Collection",
  spc: "Super-Premium Collection",
};

/**
 * The one product this playlist opens, or null.
 *
 * Requires: every video in the run tags the same single set, every video tags
 * the same single product type, that type maps to a named product above, and
 * that exact product exists in this set's own list. Anything less returns null.
 */
function theProduct(setId, prodId) {
  const kind = PRODUCT_KIND[prodId];
  if (!setId || !kind) return null;
  const p = (productsBySet[setId]?.products || []).find((x) => x.kind === kind);
  if (!p || !p.thumb || deadUrls.has(p.thumb)) return null;
  return p;
}

/**
 * The slug for a playlist page.
 *
 * The YouTube id is NOT in the url. Playlist titles are long and descriptive
 * and the slug reads well on its own, and unlike a video title a playlist
 * title is not one of hundreds that might collide. Collisions are still
 * checked below rather than assumed away.
 */
const slugFor = (p) => slugify(p.title) || p.id.toLowerCase();

// A playlist with nothing in it is not a page. Two exist on the channel: they
// were created and never filled. They come back on their own once a video
// goes in, and until then there is nothing here to show.
const live = playlists.filter((p) => (p.videoIds || []).length > 0);

const seen = new Map();
for (const p of live) {
  const s = slugFor(p);
  if (seen.has(s)) {
    // Two playlists whose titles slugify the same would silently overwrite one
    // another's page, which is the sort of thing that is noticed months later
    // by a missing url in the sitemap. Fail instead.
    console.error(
      `Two playlists produce the slug "${s}":\n  ${seen.get(s)}\n  ${p.title}\n` +
        `Rename one on YouTube, or add the id to slugFor in this file.`,
    );
    process.exit(1);
  }
  seen.set(s, p.title);
}

/**
 * The playlist's own description, cleaned the same way a rip page cleans a
 * video description: the trailing hashtag wall is a YouTube indexing device
 * and reads as a row of link-less tokens on a web page.
 */
const cleanDesc = (s) => {
  let t = String(s || "");
  // CUT AT THE FIRST HASHTAG, not just the trailing run. A rip page's
  // description ends in a hashtag wall, so stripping the tail is enough there.
  // A playlist description does something else: three of the twenty run
  // "#pokemon #pokemoncards #pokemontcg" mid-text and then continue with a
  // block of untagged search terms ("chaos rising elite trainer box pokemon
  // etb opening series pokemon chaos rising openings..."), which is 279
  // characters of keyword stuffing on the longest one. All of it is written
  // for YouTube's index and none of it is written for a reader, and the human
  // sentences always come first.
  const tag = t.search(/#[A-Za-z]/);
  if (tag > 0) t = t.slice(0, tag);

  // TWO PLAYLISTS OFFERED TO TEST PULL RATES, and this site does not have them.
  // Destined Rivals and Paradox Rift both list "We're testing: Pack luck, Pull
  // rates, Promo value", syndicated straight from YouTube, so the one thing the
  // site refuses to publish was being published as a bullet in its own copy and
  // shipped to Google in the meta description. The line is dropped from the
  // bullet, not the whole sentence: everything else in it is true and is the
  // owner's own writing.
  t = t.replace(/[\u2022*\-]?\s*pull\s+rates?\s*(?=[\u2022*\-\n]|$)/gi, "");

  // THE KEYWORD TAIL IS NOT COPY. Cutting at the first hashtag leaves the
  // untagged version of the same thing: nineteen of twenty two descriptions end
  // in a comma-separated run of search terms ("Pokemon, Pokemon TCG, Pitch
  // Black, ETB, Elite Trainer Box, Pack Opening") set in the same type as the
  // human sentences above it, and eleven close with a bare "garbage rips 585".
  // It is written for an index rather than a reader, and on a site whose whole
  // job is entity SEO it reads as stuffing. The human sentences always come
  // first, so the tail is what is cut.
  t = t.replace(/\n\s*garbage rips 585\s*$/i, "");
  const lines = t.split(/\n+/);
  while (lines.length > 1) {
    const last = lines[lines.length - 1].trim();
    // A keyword run: several comma separated fragments, none of them a
    // sentence. Requires 3+ commas and no terminal punctuation, so an ordinary
    // sentence containing a comma is never mistaken for one.
    const commas = (last.match(/,/g) || []).length;
    if (commas >= 3 && !/[.!?]$/.test(last) && last.length < 400) lines.pop();
    else break;
  }
  t = lines.join("\n");

  return t.replace(/[ \t]{2,}/g, " ").replace(/\s+$/, "").replace(/[\s\u2022|,;:-]+$/, "").trim();
};

/** First sentence or so, for the meta description. */
const clip = (s, n) =>
  s.length <= n ? s : s.slice(0, n - 3).replace(/\s\S*$/, "").replace(/[.,;:\s]+$/, "") + "...";

/**
 * Which pack skin a tile wears. Identical to the rule in app.js makeCard: a
 * video carrying several sets wears the generic multi-set wrapper rather than
 * implying the rip was only one of them.
 */
function faceSet(v) {
  const sets = v.sets || [];
  if (sets.length > 1) return "multi";
  return sets[0] || "default";
}

const packMarkup = (setId) => `<span class="pack pack--${esc(setId)} pack--tile" aria-hidden="true">
            <span class="pack-face pack-l">
              <span class="pack-art"></span>
              <span class="pack-brand">${esc(setId === "default" ? "GARBAGE RIPS" : labelFor("sets", setId) || "GARBAGE RIPS")}<small>${
                setId === "default" ? "585" : "GARBAGE RIPS 585"
              }</small></span>
              <span class="pack-seal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>
            </span>
          </span>`;

/**
 * The rules the strip needs, inlined here rather than added to
 * assets-source/ui.css, which is render blocking on all 426 pages and would be
 * carrying them for the twenty-one that use them. Same pattern as
 * build-intl-pages.mjs and build-expansions.mjs. Emitted only on the pages that
 * actually draw a strip.
 */
const PAGE_CSS = `
/* One column on a phone, two once there is room. The two halves are different
   shapes (a wide logo, a tall box) so they are not forced into a grid: each is
   a flex row that sizes to its own picture. */
.plid{display:flex;flex-wrap:wrap;gap:var(--s4);margin-top:var(--s4);max-width:46em}
.plid-set,.plid-prod{display:flex;align-items:center;gap:var(--s4);flex:1 1 15em;
  padding:var(--s3) var(--s4);border:1px solid var(--hair);border-radius:var(--r);
  background-color:var(--card);box-shadow:var(--lift);
  font-size:var(--t-sm);line-height:1.5}
.plid-set{text-decoration:none;color:inherit}
.plid-set:hover span,.plid-set:focus-visible span{color:var(--ketchup-deep)}
/* FIXED BOXES, both of them, and for the same reason in two different shapes.
   The logos are normalised by height at the source and every one is a different
   width; the TCGplayer product photos are all 200 wide and 268 to 417 tall. So
   neither file's own shape can set the row height without the strip changing
   size from playlist to playlist. object-fit:contain does the fitting. */
.plid-logo{flex:0 0 132px;width:132px;height:50px;object-fit:contain;object-position:center}
.plid-shot{flex:0 0 84px;width:84px;height:84px;object-fit:contain}
.plid small{display:block;margin-top:3px;font-size:var(--t-micro);color:var(--ink-2)}
`;

/**
 * The same trade build-css.mjs makes for ui.css: the comments are the point of
 * the source and pure weight in a render blocking <head>. Comments only.
 */
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

/**
 * The identity strip: what set, and what was opened, as pictures.
 *
 * Neither half is decoration. The logo is the thing printed across the box on
 * the shelf, so it is what a reader arriving from a search recognises before
 * reading a word, and it doubles as the route into the set guide. The product
 * photo is the object in every video on the page: "ETB Opening Series" is nine
 * words for a picture of an Elite Trainer Box.
 *
 * WEIGHT. The logo is the -sm.webp, 5 to 17KB, in a 132px box. The product is
 * TCGplayer's 200w thumb in an 84px box, which covers DPR2 with 32px to spare
 * and is the size build-set-pages.mjs settled on after measuring the 1000x1000
 * being fetched for the same box. Both are EAGER: the strip sits under the h1
 * and its description, which measured 550 CSS px down the longest of the
 * twenty-one at 390 wide, so it is inside the first viewport on every page here
 * and `loading="lazy"` would only delay the two pictures the page is identified
 * by. 22KB together on the heaviest playlist.
 *
 * NO width/height ON THE TCGPLAYER IMG, via imgDims, which returns nothing for
 * that host on purpose: those files are 200x268 through 200x417 depending on
 * the product and a fixed guess is wrong by up to 34%. The 84px box with
 * object-fit:contain is what reserves the space.
 */
function idStrip(p, vids) {
  const sets = new Set();
  const prods = new Set();
  for (const v of vids) {
    for (const s of v.sets || []) sets.add(s);
    for (const q of v.products || []) prods.add(q);
  }
  const setId = sets.size === 1 ? [...sets][0] : null;
  const prodId = prods.size === 1 ? [...prods][0] : null;
  const setName = setId ? labelFor("sets", setId) : null;
  const logo = setId && setName ? setLogo(setId, `${setName} set logo`) : "";
  const prod = setId ? theProduct(setId, prodId) : null;

  if (!logo && !prod) return "";

  return `      <div class="plid">
        ${logo ? `<a class="plid-set" href="/sets/${esc(setId)}.html">
          ${logo}
          <span>Every rip here opens <b>${esc(setName)}</b><br>Read the set guide &rarr;</span>
        </a>` : ""}
        ${prod ? `<div class="plid-prod">
          <img class="plid-shot" src="${esc(prod.thumb)}" srcset="${esc(prod.thumb)} 200w, ${esc(prod.image)} 1000w"
               sizes="84px" alt="${esc(prod.name)}" decoding="async"${imgDims(prod.thumb)} referrerpolicy="no-referrer">
          <span>Opened here: the <b>${esc(prod.name)}</b>${
            // The blurb is written to stand alone on the set guides, where it is
            // its own line, so it arrives sentence-cased: "One pack", "36 packs".
            // Here it is a clause, and "the Pitch Black Booster Pack, One pack"
            // reads like two sentences collided. Lowercased only when the first
            // word is ordinary capitalised English, so an acronym is left alone.
            prod.blurb ? `, ${esc(/^[A-Z][a-z]/.test(prod.blurb) ? prod.blurb[0].toLowerCase() + prod.blurb.slice(1) : prod.blurb)}` : ""
          }.<br><small>Photo: TCGplayer.</small></span>
        </div>` : ""}
      </div>`;
}

const clock = (sec) =>
  sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "";

// Was a fourth hand-rolled copy of the view formatter, and the one that read
// "1 VIEWS" on the single-pack-hunt playlist. Capitals are this page's own
// styling, so they go on here rather than into the shared helper.
const compactViews = (n) => viewCount(n).toUpperCase();

/**
 * The visible label for a tile, disambiguated within THIS page.
 *
 * ripLabel reduces a title to set plus product plus pack number, which is
 * exactly right in a mixed grid and collides badly inside a playlist: Tim
 * opened nine Chaos Rising ETBs, so nine tiles on that one page all read
 * "Chaos Rising ETB #2", each linking to a different video. Nine identical
 * links is a usability problem for everyone and an accessibility one for a
 * screen reader working from a link list.
 *
 * The upload date is the differentiator, because it is a fact already held and
 * it is the thing that actually separates the runs. Only repeats get it, so
 * the pages where every label is already distinct stay clean.
 */
// EIGHT OF THE TWENTY-ONE PLAYLIST NAMES ALREADY END IN THE BRAND, because
// that is how they were typed on YouTube. Appending it again shipped titles
// reading "... | Garbage Rips 585 | Garbage Rips 585" in the browser tab and in
// search results.
// THE STRIP STAYS AND THE APPEND IS GONE, 17 August 2026. Measured in headless
// Chrome at 20px Arial, 16 of the 21 ran 597-724px with the brand appended,
// against Google's ~580px desktop cut, so it was drawn on 5 of them and
// truncated on the rest. Bare they run 285-545px and all 21 render whole.
// The strip is still doing the job the comment above describes: without it the
// eight names that already end in the brand would keep it while the other
// thirteen lost it, which is the inconsistency this rule exists to prevent.
// og:site_name carries the brand for the search result's site-name line.
const titleFor = (p) =>
  String(p.title || "").trim().replace(/\s*\|\s*Garbage\s*Rips\s*585\s*$/i, "").trim();

function labelsFor(vids) {
  const count = new Map();
  for (const v of vids) {
    const l = v.label || v.siteTitle || v.title;
    count.set(l, (count.get(l) || 0) + 1);
  }
  // The date is not always enough. Two Perfect Order videos went up on the same
  // day and label the same, so the date left them still identical. Where that
  // happens the tile falls back to the video's own full title, which is the
  // real name and is always distinct. Longer, and correct beats tidy.
  const dated = new Map(
    vids.map((v) => {
      const l = v.label || v.siteTitle || v.title;
      return [v.id, count.get(l) > 1 && v.published ? `${l} (${shortDate(v.published)})` : l];
    }),
  );
  const after = new Map();
  for (const t of dated.values()) after.set(t, (after.get(t) || 0) + 1);
  return new Map(
    vids.map((v) => [
      v.id,
      after.get(dated.get(v.id)) > 1 ? v.siteTitle || v.title : dated.get(v.id),
    ]),
  );
}

function tile(v, labels) {
  const sets = v.sets || [];
  const meta = [
    sets.length > 1
      ? `${String(labelFor("sets", sets[0]) || sets[0]).toUpperCase()} +${sets.length - 1}`
      : sets.length
        ? String(labelFor("sets", sets[0]) || sets[0]).toUpperCase()
        : null,
    compactViews(v.views),
  ].filter(Boolean);
  const pull = (v.pulls || [])[0];
  return `        <article class="v">
          <a class="art" href="/${esc(v.path)}" aria-label="${esc(v.siteTitle || v.title)}">
            ${packMarkup(faceSet(v))}
            ${pull ? `<span class="hit">${esc(labelFor("pulls", pull))}</span>` : ""}
            ${v.duration ? `<span class="dur">${clock(v.duration)}</span>` : ""}
            <span class="play"></span>
          </a>
          <h3><a href="/${esc(v.path)}">${esc((labels && labels.get(v.id)) || v.label || v.siteTitle || v.title)}</a></h3>
          ${meta.length ? `<p>${esc(meta.join("  \u2022  "))}</p>` : ""}
        </article>`;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

let written = 0;
let missing = 0;

for (const p of live) {
  const slug = slugFor(p);
  const vids = (p.videoIds || []).map((id) => byId.get(id)).filter(Boolean);
  missing += (p.videoIds || []).length - vids.length;
  if (!vids.length) continue;

  const desc = cleanDesc(p.description);
  const strip = idStrip(p, vids);
  const url = `${SITE}/playlists/${slug}.html`;
  const newest = vids.map((v) => v.published).filter(Boolean).sort().pop();
  const metaDesc = clip(
    desc || `${vids.length} rip${vids.length === 1 ? "" : "s"} from Garbage Rips 585, in the order they were opened.`,
    158,
  );

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Playlists", item: `${SITE}/playlists.html` },
        { "@type": "ListItem", position: 3, name: p.title },
      ],
    },
    // Every entry has a real url on this site, which is the whole reason this
    // page exists. An ItemList whose entries point nowhere is not eligible for
    // anything and 76 of them were deleted from this site for exactly that.
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: p.title,
      numberOfItems: vids.length,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement: vids.map((v, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: v.siteTitle || v.title,
        url: `${SITE}/${v.path}`,
      })),
    },
  ];

  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titleFor(p))}</title>
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}${strip ? `\n<style>${miniCSS(PAGE_CSS)}</style>` : ""}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> / <a href="/playlists.html">Playlists</a> / <span>${esc(p.title)}</span>
      </nav>
      <h1>${esc(p.title)}</h1>
      <p class="lede" style="max-width:44em">${
        desc ? esc(desc) : `${vids.length} rip${vids.length === 1 ? "" : "s"}, in playlist order.`
      }</p>
${strip}
      <!-- THE WALL NEEDED A HEADING AND THIS IS IT. Every tile title in .wall is
           an h3, and with nothing between it and the page h1 all 21 playlist
           pages read h1 -> h3. Same defect and same fix as .loc h2 in ui.css
           and .op-sh in build-openings.mjs, except that the tile heading here
           CANNOT be promoted instead: .v h3 in ui.css is a tag selector used
           by every video tile on the site, and ui.css is not this builder's to
           edit. So the level goes in above the wall rather than under it.
           The style is inline and copied from .op-sh rather than added to
           PAGE_CSS because PAGE_CSS is only emitted when the strip is
           non-empty and this heading is on every playlist page.
           NOTE FOR THE NEXT EDITOR: this comment is inside a JS template
           literal. A backtick in here ends the string and the build dies with
           a syntax error a hundred lines away. That happened writing it. -->
      <h2 style="font:400 var(--t-m)/1.2 var(--display);margin:var(--s5) 0 var(--s3)">In this playlist</h2>
      <p class="pl-stat">${vids.length} video${vids.length === 1 ? "" : "s"}${
        newest ? ` &bull; newest ${esc(shortDate(newest))}` : ""
      } &bull; click a pack to rip it open here</p>
      <div class="wall">
${(() => { const labels = labelsFor(vids); return vids.map((v) => tile(v, labels)).join("\n"); })()}
      </div>
      <p style="margin-top:var(--s5)">
        <a class="btn btn-ghost btn-sm" href="/playlists.html">All playlists</a>
        <a class="btn btn-ghost btn-sm" href="/videos.html">Every rip</a>
      </p>
    </div>
  </section>
</main>
${footer()}
${APP_JS}
</body>
</html>
`;

  await writeFile(join(OUT, `${slug}.html`), page);
  written += 1;
}

// STAMP THE PATH ONTO THE DATA, the same way sync-youtube.mjs stamps `path`
// onto every video. CLAUDE.md's reason for that applies here word for word:
// shared/paths.mjs owns the URL shape, and if the browser recomputed the slug
// from the title it would be a second implementation free to drift from this
// one, and the drift would show up as a card linking to a 404. The browser
// reads the path it is given and computes nothing.
const stamped = { ...doc, playlists: playlists.map((p) => {
  const has = (p.videoIds || []).length > 0;
  return has ? { ...p, path: `playlists/${slugFor(p)}.html` } : { ...p };
}) };
await writeFile(join(ROOT, "public/data/playlists.json"), JSON.stringify(stamped, null, 1));

console.log(`Wrote ${written} playlist pages to public/playlists/
  ${live.length} playlists with videos, ${playlists.length - live.length} empty and skipped${
    missing ? `\n  ${missing} playlist entries point at videos not in the catalogue (deleted or private), skipped` : ""
  }`);
