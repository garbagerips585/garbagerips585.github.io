#!/usr/bin/env node
// Build /openings/: one page per kind of sealed product, plus an index.
//
//   node scripts/build-openings.mjs
//
// Reads public/data/videos.json (what was opened), public/data/products.json
// (what each one costs), shared/taxonomy.mjs (the product vocabulary) and
// shared/riplabel.mjs (how a rip is named).
//
// THE GAP THIS FILLS IS STRUCTURAL, NOT EDITORIAL. /videos.html can already
// filter the catalogue by product type, and that filter is a JavaScript state,
// not a url. So "elite trainer box" and "booster bundle", which are among the
// most asked questions in the hobby, had no page on a site holding 62 filmed
// ETB openings. Thirteen product types, zero indexable homes.
//
// WHAT MAKES THESE PAGES DEFENSIBLE rather than another thin category stub:
// nobody else can put the price of the product across every set NEXT TO
// dozens of that exact product being opened on camera. The price half is
// commodity. The footage half is not, and it is already in the repo.
//
// ============================================================================
// THE BLURB TRAP, and it nearly went out as fact.
//
// products.json carries a `blurb` per product, and it reads like a per-set
// contents description: "9 packs plus sleeves and dice". It is not. It is a
// CONSTANT PER KIND, written once and repeated across every set: all 23 Elite
// Trainer Box entries carry that identical string, and real ETB pack counts
// have varied by era. Printing it as a fact about a named set would have been
// this site stating an unsourced number, which is the one thing it does not do.
//
// So the contents line is presented as what the kind USUALLY holds, once, in
// the page's own voice, and never per set. The numbers that ARE stated per
// set come from somewhere the site can actually stand behind: the packs
// counted in its own videos. "549 packs across 62 openings" is a fact about
// this channel's catalogue, and this channel is the source.
//
// Where the count is not in the data, the pages say so rather than estimate,
// which is why several read "count not in our data".
// ============================================================================
//
// PRODUCTS WITH NO FOOTAGE DO NOT GET A PAGE. Booster Box and Build & Battle
// Box are priced in products.json but have never been opened on camera here.
// A page for them would be a price table with the unique half missing, which
// is the thin category stub this is trying not to build.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS } from "../shared/chrome.mjs";
import { esc, longDate, shortDate, moneyExact, imgDims } from "../shared/format.mjs";
import { PRODUCT_TYPES, CARD_SETS } from "../shared/taxonomy.mjs";
import { ripLabel } from "../shared/riplabel.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/openings");
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const prod = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8"));

// The 4 TCGplayer urls that answer 403, from the fetch of every image url the
// site emits. Skipped up front rather than emitted behind an onerror that hides
// the gap while every page load still pays for a request that fails.
const DEAD = new Set(
  JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).deadUrls || []
);

const SET_NAME = new Map(CARD_SETS.map((s) => [s.id, s.label]));

// taxonomy id -> the `kind` string products.json uses. Only the ones that
// genuinely match; a wrong join here would price the wrong box.
const KIND = {
  etb: "Elite Trainer Box",
  "single-pack": "Single Pack",
  bundle: "Booster Bundle",
  blister: "Blister Pack",
  tin: "Tin",
  "collection-box": "Collection Box",
};

// ---------------------------------------------------------------- photography
//
// A PAGE ASKING "WHAT IS IN AN ELITE TRAINER BOX?" HAD NO PICTURE OF ONE. All
// thirteen of these pages were prose, a stat row and a table, which is the one
// place on this site where a photograph does work a sentence cannot: the reader
// asking the question does not yet know what the object looks like on a shelf.
//
// THE ONLY PRODUCT PHOTOGRAPHY THIS SITE HAS IS TCGPLAYER'S AND IT IS PER SET,
// never per type, which is the same constraint /how-many-packs.html hit and the
// rule it set is followed here exactly: the shot is one specific set's product
// standing in for the type, so the caption NAMES THE SET IT ACTUALLY IS and the
// line beside it says out loud that it is one example of the kind. Anything
// looser would be a picture quietly claiming to be a category.
//
// The set choices deliberately match /how-many-packs.html's where the two pages
// show the same kind, so a reader moving between them sees the same box.
//
// SIX OF THE THIRTEEN KINDS GET NOTHING, and that is the honest answer rather
// than a gap to fill later. products.json carries no `kind` matching ex Premium
// Collection, Knock Out Collection or Poke Ball Tin, and no Japanese, Korean or
// Chinese product at all. Substituting a nearby box would caption a photo with a
// claim that is not true of that file, so those pages stay prose.
//
// [set id, products.json kind, the name we expect to find there]
const PHOTOS = {
  etb: ["pitch-black", "Elite Trainer Box", "Pitch Black Elite Trainer Box"],
  "single-pack": ["pitch-black", "Single Pack", "Pitch Black Booster Pack"],
  bundle: ["pitch-black", "Booster Bundle", "Pitch Black Booster Bundle"],
  blister: ["pitch-black", "Blister Pack", "Pitch Black Single Pack Blister"],
  tin: ["prismatic-evolutions", "Tin", "Prismatic Evolutions Mini Tin"],
  // Not the cheapest Collection Box in the data, and chosen rather than left to
  // the sync. sync-products.mjs picks the cheapest per set, which on most sets
  // is a Poster Collection: a poster and some packs, which is not what the lede
  // above describes. The Kingambit Illustration Collection is a themed box built
  // around one character, which is.
  "collection-box": ["shrouded-fable", "Collection Box", "Kingambit Illustration Collection"],
  upc: ["151", "Ultra-Premium Collection", "151 Ultra-Premium Collection"],
};

/**
 * The photo for a product type, or null.
 *
 * Matched on set id AND kind, then checked against the NAME expected there,
 * exactly as build-how-many-packs.mjs does and for the same reason:
 * sync-products.mjs picks the cheapest variant per kind, so the product behind
 * "prismatic-evolutions / Tin" can change under us. If it does, the caption
 * would name a product that is not in the picture. Drop the photo instead.
 */
function photoFor(id) {
  const spec = PHOTOS[id];
  if (!spec) return null;
  const [sid, kind, expect] = spec;
  const hit = (prod.sets?.[sid]?.products || []).find((p) => p.kind === kind);
  if (!hit || !hit.thumb || DEAD.has(hit.thumb)) return null;
  if (!String(hit.name || "").toLowerCase().startsWith(expect.toLowerCase())) return null;
  return { src: hit.thumb, large: hit.image, name: hit.name };
}

// NO WIDTH OR HEIGHT. imgDims() returns nothing for tcgplayer-cdn on purpose:
// those files run 200x268 to 200x417 and a declaration would be wrong by up to
// 34%. sizes is 88px, not a viewport unit, because .op-shot is a fixed 88x88
// box; that is a measured fix worth 4x the bytes on the set guides and it is
// not a placeholder to be improved.
const shot = (e) => {
  const p = photoFor(e.id);
  if (!p) return "";
  return `      <figure class="op-shot">
        <img src="${esc(p.src)}" srcset="${esc(p.src)} 200w, ${esc(p.large)} 1000w"
             sizes="88px" alt="${esc(p.name)}, sealed" loading="lazy" decoding="async"${imgDims(p.src)}
             referrerpolicy="no-referrer" onerror="this.closest('figure').remove()">
        <figcaption>One example: the <b>${esc(p.name)}</b>. Photo TCGplayer's. Every set sells
          its own, and the art on the box changes with the set.</figcaption>
      </figure>`;
};

// What each kind usually contains, in our own words, stated ONCE and never as
// a fact about a particular set. See the blurb trap above.
const USUALLY = {
  etb: "An Elite Trainer Box is the big one: a stack of packs, a card box to keep them in, sleeves, dice, damage counters and a status marker. The pack count has changed over the years, so check the box you are actually buying.",
  // ^ That sentence stays exactly as it is. It was written when nothing in the
  // repo held a sourced count and it is still true. What changed is that
  // /how-many-packs.html now holds the sourced version, so the note under the
  // lede sends people there rather than leaving them with a warning and no
  // number. See THE BLURB TRAP above: this page still states nothing per set.
  "single-pack": "One booster pack, bought loose off a shelf or a peg.",
  bundle: "A Booster Bundle is a sleeve of packs and nothing else. No sleeves, no dice, no promo. It is usually the cheapest way to buy several packs at once.",
  "ex-premium": "A collection box built around one ex card, with a promo, an oversize card and a few packs.",
  "ex-box": "A smaller box built around one ex card, with a promo and a couple of packs.",
  upc: "An Ultra Premium Collection is the largest sealed product of a set: a big box with a lot of packs, a metal or oversize card and usually a full art promo.",
  tin: "A metal tin with a promo card and a few packs. The tin outlives the cards and is the reason a lot of people buy them.",
  "poke-ball-tin": "A ball-shaped tin, usually with one or two packs and a coin or promo.",
  blister: "A hanging card with one to three packs and a promo, sold on a peg rather than a shelf.",
  "knock-out": "A Knock Out Collection is built around one big ex card: the promo, a playmat or a set of dice depending on the release, and a few packs. They turn up at Target and Walmart more than anywhere else.",
  "collection-box": "A themed box built around a character or a pair of them, with promo cards, sometimes an oversize card, and a few packs. The contents vary more than any other product here.",
  "japanese-pack": "A Japanese booster pack. Japanese sets are smaller and print differently from the English ones.",
  "korean-pack": "A Korean booster pack. Korea gets its own print run and its own set numbering, so a Korean card is not just an English card in another language.",
  "chinese-pack": "A Chinese booster pack. Simplified Chinese sets run on their own schedule and are the hardest of the languages here to find in the US.",
};

// The question somebody types, which becomes the H1.
const ASKS = {
  etb: "What is in an Elite Trainer Box?",
  "single-pack": "What is in a single booster pack?",
  bundle: "What is in a Booster Bundle?",
  "ex-premium": "What is in an ex Premium Collection?",
  "ex-box": "What is in an ex Box?",
  upc: "What is in an Ultra Premium Collection?",
  tin: "What is in a Pokemon tin?",
  "poke-ball-tin": "What is in a Poke Ball Tin?",
  blister: "What is in a blister pack?",
  "knock-out": "What is in a Knock Out Collection?",
  "collection-box": "What is in a collection box?",
  "japanese-pack": "What is in a Japanese booster pack?",
  "korean-pack": "What is in a Korean booster pack?",
  "chinese-pack": "What is in a Chinese booster pack?",
};

const LABEL = new Map(PRODUCT_TYPES.map((p) => [p.id, p.label]));

// THE CODE CARD LINE, and the reason it is not on every page here.
//
// Every pack counted on this site also produced a code card, which is the one
// thing in a booster these pages never mention. It is one sentence and a link,
// deliberately: a reader on an ETB page is mid-question and does not need a
// second pitch.
//
// IT IS ONLY ON THE ENGLISH PRODUCT PAGES. data/tcg-live.json records that
// nothing was found in either direction on whether a Japanese, Korean or Chinese
// pack carries a code the English client takes, so the three foreign pack pages
// get nothing rather than a hedge. The index says "English booster pack" out
// loud for the same reason, because its total covers all of them.
const FOREIGN_PACKS = new Set(["japanese-pack", "korean-pack", "chinese-pack"]);
const CODE_LINE =
  ' Every one of those packs had a code card in it as well: <a href="/tcg-live.html">what the code' +
  " card actually gets you</a>.";

// Splitting on ". " returns the WHOLE string when there is only one sentence,
// full stop included, so appending another gave ten cards a doubled period.
const firstSentence = (t) => {
  const i = t.indexOf(". ");
  return i === -1 ? t : `${t.slice(0, i)}.`;
};

// Which product ids take "an". Deliberately a list and not a first-letter
// test: "UPC" begins with a vowel and takes "a", because it is read out as
// letters. Thirteen labels is few enough to just be right about.
const AN = new Set(["etb", "ex-premium", "ex-box"]);
const article = (id) => (AN.has(id) ? "an" : "a");

// ---------------------------------------------------------------- gather
const byProduct = new Map();
for (const v of videos) {
  for (const p of v.products || []) {
    if (!byProduct.has(p)) byProduct.set(p, []);
    byProduct.get(p).push(v);
  }
}

// Prices for a kind, one row per set that sells it.
//
// THE SET COLUMN SAYS WHAT THIS SITE CALLS THE SET, NOT WHAT TCGPLAYER CALLS IT.
//
// `s.tcgSet` is TCGplayer's own catalogue string and it exists for exactly one
// reason: shared/tcgplayer.mjs maps our ids onto it so the sync can find the
// right products, because their fuzzy search is confidently wrong (the comment
// at the top of that file has the details). It is a lookup key. It was never
// meant to be printed, and printing it put "SV: Scarlet & Violet 151",
// "SV01: Scarlet & Violet Base Set", "ME05: Pitch Black" and "Pokemon GO" into
// a table sitting a few hundred pixels above a rip list on the SAME PAGE that
// says "151", "Scarlet & Violet", "Pitch Black" and "Pokémon GO". /pack-prices
// and /expansions.html both name the same sets the site's way off sets.json.
//
// SET_NAME is the same taxonomy label the rip list below already uses, so the
// two halves of this page cannot drift. Note that it carries "Pokémon GO" with
// the accent: that is the official proper name and is deliberate, and the
// accent is dropped only in the site's own prose. Do not flatten it.
//
// `s.tcgSet` remains the fallback because a set present in products.json but
// absent from the taxonomy still has to render as something, and TCGplayer's
// string is at least a name rather than a slug.
const pricesFor = (id) => {
  const kind = KIND[id];
  if (!kind) return [];
  const rows = [];
  for (const [sid, s] of Object.entries(prod.sets || {})) {
    const hit = (s.products || []).find((x) => x.kind === kind);
    if (hit && typeof hit.market === "number") {
      rows.push({
        sid,
        name: SET_NAME.get(sid) || s.tcgSet || sid,
        market: hit.market, low: hit.low, listings: hit.listings, url: hit.url,
      });
    }
  }
  return rows.sort((a, b) => b.market - a.market);
};

const entries = [...byProduct.entries()]
  .map(([id, vids]) => {
    const packs = vids.reduce((n, v) => n + (v.packs || 0), 0);
    const withPacks = vids.filter((v) => v.packs).length;
    const sets = new Set(vids.flatMap((v) => v.sets || []));
    return { id, vids, packs, withPacks, sets, prices: pricesFor(id), label: LABEL.get(id) || id };
  })
  .filter((e) => e.vids.length)
  .sort((a, b) => b.vids.length - a.vids.length);

// ---------------------------------------------------------------- render
// EVERY LINK ON A PAGE HAS TO SAY WHERE IT GOES ON ITS OWN. ripLabel numbers a
// rip only when the title or description happens to carry a "#n", so on a page
// listing 62 Elite Trainer Boxes a lot of them come out as the same string.
// Sixty identical "Chaos Rising ETB" links is bad for a reader scanning and
// worse for anybody tabbing through with a screen reader, which announces link
// text with no surrounding context.
//
// So: take the derived label, and where two rips share one, add the date. Where
// that STILL collides, which happens when two of the same product from the same
// set went up on one day, fall back to the video's own full title, which is
// unique by construction. Same escalation build-playlists.mjs uses.
// `v.description` DOES NOT EXIST AND HAS NEVER EXISTED ON A VIDEO RECORD.
//
// This line used to read `ripLabel(v, SET_NAME, v.description)`. None of the 313
// records in public/data/videos.json carries a `description` key: the
// descriptions live in data/descriptions.json, which this builder does not open.
// So the third argument was `undefined` on every call, and `undefined` is
// exactly what ripLabel treats as "no description available". Same shape as the
// no-scan `.tcgdex` read: a key that is not there, a fallback that looks like a
// legitimate empty, and a silence.
//
// It cost real text. The pack number in a label comes from the title OR the
// description, and 41 of the 286 stamped labels get their #N from the
// description alone. Those 41 rips read "Pitch Black ETB #7" on the home page,
// /videos.html and their playlist page, all of which use the stamped `v.label`,
// and "Pitch Black ETB" here. One rip, two names, on one site.
//
// It also made the page worse in a second way. labelsFor escalates to a date
// and then to the full YouTube title whenever two rips share a label, so losing
// the numbers created collisions that were not there: 95 colliding rows became
// 124.
//
// stamp-labels.mjs is the ONE writer of `v.label` and it runs before every page
// builder in build-all.mjs, which is why it exists. Read the stamp, the way
// build-playlists.mjs and build-proto.mjs already do, rather than re-deriving it
// here from an argument this file cannot supply.
function labelsFor(vids) {
  const base = new Map(vids.map((v) => [v.id, v.label || v.siteTitle || v.title]));
  // A rip with a set and a product tag always gets a stamped label. If none of
  // them has one, stamp-labels.mjs did not run, and every tile on these pages is
  // about to fall back to its YouTube title: "This ETB is BREAKING me! 🌑💀" on a
  // grid of twenty, which is the thing ripLabel exists to prevent.
  if (vids.length && !vids.some((v) => v.label)) {
    throw new Error(
      `build-openings: not one of ${vids.length} rips carries a stamped \`label\`, so every ` +
        `tile would fall back to its raw YouTube title. Run node scripts/stamp-labels.mjs ` +
        `first; build-all.mjs runs it before every page builder for this reason.`
    );
  }
  const seen = new Map();
  for (const l of base.values()) seen.set(l, (seen.get(l) || 0) + 1);

  const dated = new Map(
    vids.map((v) => {
      const l = base.get(v.id);
      return [v.id, seen.get(l) > 1 && v.published ? `${l}, ${shortDate(v.published)}` : l];
    })
  );
  const after = new Map();
  for (const l of dated.values()) after.set(l, (after.get(l) || 0) + 1);

  return new Map(
    vids.map((v) => [v.id, after.get(dated.get(v.id)) > 1 ? v.siteTitle || v.title : dated.get(v.id)])
  );
}

const ripRow = (labels) => (v) => {
  const label = labels.get(v.id);
  const dateInLabel = Boolean(v.published && label.includes(shortDate(v.published)));
  const bits = [
    dateInLabel ? "" : v.published ? esc(shortDate(v.published)) : "",
    v.packs ? `${v.packs} pack${v.packs === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return `        <li><a href="/${esc(v.path)}">${esc(label)}</a>${
    bits.length ? `\n          <span>${bits.join(" &bull; ")}</span>` : ""
  }</li>`;
};

const priceTable = (e) => {
  if (!e.prices.length) return "";
  const cap = `What ${article(e.id)} ${e.label} costs, by set. TCGplayer market price, read ${longDate(prod.checked)}`;
  // Same reasoning as build-expansions.mjs: a 520px table in a 360px box with
  // no focusable content is unreachable without a mouse.
  return `      <div class="op-tw" tabindex="0" role="region" aria-label="${esc(cap)}, scrollable table">
        <table class="op-t">
          <caption>${esc(cap)}</caption>
          <thead><tr><th scope="col">Set</th><th scope="col">Market</th><th scope="col">Lowest</th><th scope="col">Listings</th></tr></thead>
          <tbody>
${e.prices.map((r) => `            <tr><th scope="row">${
    r.url ? `<a href="${esc(r.url)}" rel="noopener" target="_blank">${esc(r.name)}</a>` : esc(r.name)
  }</th><td>${esc(moneyExact(r.market))}</td><td>${
    typeof r.low === "number" ? esc(moneyExact(r.low)) : "<span class=\"op-no\">not listed</span>"
  }</td><td>${typeof r.listings === "number" ? r.listings : `<span class="op-no">not listed</span>`}</td></tr>`).join("\n")}
          </tbody>
        </table>
      </div>`;
};

const STYLE = `
.op-lede{max-width:46em}
/* The product shot is a HORIZONTAL strip under the lede, not a column beside it.
   Both alternatives were built and looked wrong. Beside the lede, the caption is
   stuck in an 88px column and sets as eleven lines of mono running far below a
   three line paragraph. Above the lede, an 88px box pushes the sentence that
   answers the h1 down the screen on a phone. As a strip it keeps the question
   and its answer adjacent and gives the caption a readable measure, and the
   caption has real work to do here: it names the set the box actually is, which
   is the condition of using one set's product to illustrate a type at all. */
.op-shot{display:flex;gap:var(--s4);align-items:center;margin:0 0 var(--s5);
  max-width:46em;border:3px solid var(--navy);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s3) var(--s4)}
/* Product photography arrives on a white background, so the tile is white
   rather than the page cream. Same reasoning and the same 88px box as
   .prod-shot on the set guides and .hp-shot on /how-many-packs.html, because
   sizes="88px" is measured against exactly this box. */
.op-shot img{flex:none;width:88px;height:88px;object-fit:contain;display:block;background:#fff;
  border:1px solid var(--hair);border-radius:6px}
.op-shot figcaption{font-size:var(--t-sm);line-height:1.5;color:var(--ink-2);min-width:0}
.op-shot figcaption b{font-weight:700;color:var(--ink)}
.op-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3);margin:var(--s5) 0}
@media(max-width:700px){.op-facts{grid-template-columns:1fr}}
.op-f{border:3px solid var(--navy);border-radius:12px;background:var(--card);box-shadow:var(--hard-lg);
  padding:var(--s4);text-align:center}
.op-f .n{font:400 var(--t-xl)/1 var(--display);color:var(--ketchup)}
.op-f .l{font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);margin-top:var(--s2);display:block}
.op-tw{overflow-x:auto;border:3px solid var(--navy);border-radius:12px;box-shadow:var(--hard-lg);
  background:var(--card);margin:var(--s4) 0}
.op-t{border-collapse:collapse;width:100%;min-width:520px;font-size:var(--t-sm)}
.op-t caption{caption-side:top;text-align:left;padding:var(--s3) var(--s4);font:700 var(--t-label)/1.3 var(--body);
  letter-spacing:.04em;text-transform:uppercase;color:var(--ink-2);border-bottom:2px solid var(--hair)}
.op-t th,.op-t td{padding:10px var(--s3);text-align:left;border-bottom:1px solid var(--hair)}
.op-t thead th{font:700 var(--t-label)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  background:var(--navy);color:var(--chrome-ink);border-bottom:none}
.op-t tbody th{font-weight:700}
.op-no{font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2);opacity:.7}
.op-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4)}
@media(max-width:900px){.op-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.op-grid{grid-template-columns:1fr}}
.op-c{border:3px solid var(--navy);border-radius:12px;background:var(--card);box-shadow:var(--hard-lg);
  padding:var(--s4);display:block;color:inherit;text-decoration:none}
.op-c h2,.op-c h3{font:400 var(--t-m)/1.2 var(--display);margin-bottom:var(--s2)}
.op-c p{font-size:var(--t-sm);line-height:1.5;color:var(--ink-2)}
.op-c .op-n{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);display:block;margin-top:var(--s3)}
.op-note{color:var(--ink-2);font-size:var(--t-sm);line-height:1.55;max-width:44em}
`;

const head = (title, desc, path, extraLd = null) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(title.split(" | ")[0])}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}${path}">
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
${STYLES}
<style>${STYLE}</style>
${extraLd ? `<script type="application/ld+json">${JSON.stringify(extraLd)}</script>` : ""}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">`;

const tail = `</main>
${footer()}
${APP_JS}
</body>
</html>
`;

await mkdir(OUT, { recursive: true });

// ---------------------------------------------------------------- per product
for (const e of entries) {
  const path = `/openings/${e.id}.html`;
  const ask = ASKS[e.id] || `What is in a ${e.label}?`;
  const nSets = e.sets.size;
  // THE DESCRIPTION USED TO PROMISE A PRICE THE PAGE THEN REFUSES TO GIVE.
  // `e.prices.length || nSets` fell back to the set count for every product we
  // do not track prices for, so seven pages advertised "what it costs across N
  // sets" in the search result while their body says "no price table here,
  // this product is not one of the kinds we track prices for". The snippet IS
  // the promise, so it now describes what the page actually has.
  const desc = (
    e.prices.length
      ? `${ask} What it holds, what it costs across ${e.prices.length} set${
          e.prices.length === 1 ? "" : "s"
        }, and ${e.vids.length} of them opened on camera.`
      : `${ask} What it holds, and ${e.vids.length} of them opened on camera${
          nSets ? `, across ${nSets} set${nSets === 1 ? "" : "s"}` : ""
        }.`
  ).slice(0, 158);

  const page =
    head(`${ask} Price and ${e.vids.length} Openings | Garbage Rips 585`, desc, path, {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Openings", item: `${SITE}/openings/` },
        { "@type": "ListItem", position: 3, name: e.label },
      ],
    }) +
    `
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/openings/">Openings</a> / <span>${esc(e.label)}</span></nav>
      <h1>${esc(ask.replace(/\?$/, ""))}<span class="hl">?</span></h1>
      <p class="lede op-lede">${esc(USUALLY[e.id] || `A sealed ${e.label}.`)}</p>
${shot(e)}
      <p class="op-note">That is what this kind of box usually holds. It is deliberately not stated per set,
        because the contents have changed between releases and we do not have a per set count we can stand
        behind. What we do have is what came out of the ones opened here, counted below, and
        <a href="/how-many-packs.html">how many packs each kind of product holds</a>, which is read off the
        manufacturer's and the sellers' own pages with the source on every number.</p>

      <div class="op-facts">
        <div class="op-f"><span class="n">${e.vids.length}</span><span class="l">Opened on camera</span></div>
        <div class="op-f"><span class="n">${e.packs || "&mdash;"}</span><span class="l">${
          e.packs ? `Packs counted, across ${e.withPacks} of them` : "Pack count not in our data"
        }</span></div>
        <div class="op-f"><span class="n">${nSets || "&mdash;"}</span><span class="l">${
          nSets ? "Different sets" : "Set not tagged"
        }</span></div>
      </div>
${priceTable(e)}
${e.prices.length
        ? `      <p class="op-note">Prices are TCGplayer market and lowest listing, read ${esc(longDate(prod.checked))},
        the same figures the rest of this site quotes. They move. <a href="/pack-prices.html">Pack prices</a>
        works out what that comes to per pack.</p>`
        : `      <p class="op-note">No price table here: this product is not one of the kinds we track prices for,
        so there is nothing sourced to show. <a href="/pack-prices.html">Pack prices</a> covers the ones we do.</p>`}
    </div>
  </section>

  <section class="band tight">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>On the channel</p>
      <h2>Every ${esc(e.label)} <span class="hl">opened</span> here</h2>
      <p class="lede" style="max-width:38em">${e.vids.length} of them${
        e.packs ? `, ${e.packs} pack${e.packs === 1 ? "" : "s"} counted` : ""
      }. Each one plays on its own page.${e.packs && !FOREIGN_PACKS.has(e.id) ? CODE_LINE : ""}</p>
      <ul class="riplist">
${e.vids
  .slice()
  .sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")))
  .map(ripRow(labelsFor(e.vids)))
  .join("\n")}
      </ul>
      <p class="op-note" style="margin-top:var(--s4)">Other kinds of sealed product are on the
        <a href="/openings/">openings index</a>, and the whole catalogue is on
        <a href="/videos.html">every rip</a>.</p>
    </div>
  </section>
` +
    tail;

  await writeFile(join(OUT, `${e.id}.html`), page);
}

// ---------------------------------------------------------------- index
const totalRips = new Set(entries.flatMap((e) => e.vids.map((v) => v.id))).size;
const totalPacks = videos.reduce((n, v) => n + (v.packs || 0), 0);

const idx =
  head(
    "Every Kind of Pokemon Sealed Product, Opened | Garbage Rips 585",
    `Elite Trainer Boxes, Booster Bundles, blisters, tins and more: what each one holds, what it costs, and ${totalRips} of them opened on camera.`,
    "/openings/",
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Openings" },
      ],
    }
  ) +
  `
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Openings</span></nav>
      <h1>Every kind of <span class="hl">sealed</span> product</h1>
      <p class="lede op-lede">What is actually inside each kind of box, what it costs across the sets that
        sell it, and every one of them opened on this channel. ${entries.length} kinds, ${totalRips} openings,
        ${totalPacks} packs counted.</p>
      <div class="op-grid">
${entries
  .map(
    (e) => `        <a class="op-c" href="/openings/${esc(e.id)}.html">
          <h2>${esc(e.label)}</h2>
          <p>${esc(firstSentence(USUALLY[e.id] || ""))}</p>
          <span class="op-n">${e.vids.length} opened${
            e.packs ? ` &bull; ${e.packs} pack${e.packs === 1 ? "" : "s"} counted in ${e.withPacks} of them` : ""
          }</span>
        </a>`
  )
  .join("\n")}
      </div>
      <p class="op-note" style="margin-top:var(--s5)">Pack counts are what we counted in our own videos, not a
        figure off a box. Where a product's contents are not in our data, the page says so rather than guess.
        The counts printed on the products themselves, biggest box to smallest blister with a source on each,
        are on <a href="/how-many-packs.html">how many packs are in it</a>.
        Prices come from TCGplayer, read ${esc(longDate(prod.checked))}.
        Every English booster pack in that count also held a code card, and
        <a href="/tcg-live.html">what the code card gets you</a> counts them.</p>
    </div>
  </section>
` +
  tail;

await writeFile(join(OUT, "index.html"), idx);

console.log(`Wrote public/openings/ with ${entries.length + 1} pages
  ${entries.length} product types, ${totalRips} openings, ${totalPacks} packs counted
  ${entries.filter((e) => e.prices.length).length} have a price table`);
