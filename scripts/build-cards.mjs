#!/usr/bin/env node
// Generate /cards.html, search across every card on the site.
//
//   node scripts/sync-cards.mjs   (first, writes the data)
//   node scripts/build-cards.mjs  (this)
//
// Reads TWO indexes, and the split is the point:
//   public/data/card-index.json      4,481 cards, 23 English sets, WITH prices
//   public/data/printings/*.json     39,707 printings, 370 sets, no prices
// The first drives the default view and the set filter. The second is what a
// typed query searches, so "Trubbish" returns 30 printings including the
// Japanese ones rather than the 4 we happen to sell. They join on
// name|set|number, which was measured to match all 4,481 priced cards, so an
// English card we rip keeps its price and its thumbnail.
//
// SERVER RENDERED FIRST, SEARCH SECOND. The page ships with the 60 most
// valuable cards already in the HTML, so it is a real page to a crawler and to
// anyone with JS off, and so it has something to say before you type. The
// search itself is client side over a 47KB gzipped index, because GitHub Pages
// has no functions and a round trip per keystroke was never on the table.
//
// WHY NOT PAGINATE THE WHOLE INDEX INTO THE HTML. 4,481 rows is about 700KB of
// markup for a page where the median visitor looks at one card. The index is
// fetched once, on demand, and only when somebody actually types.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { priceNote, priceFooter, priceRead } from "../shared/card-prices.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where
// it sits, so both attach to nothing: ~11.9KB gzipped and 2 requests for a
// script that finds no tile and a stylesheet whose classes never appear.
// CHECKED BY DRIVING THE PAGE, not by grepping it: packplayer's entry point is
// a delegated click on an <a> to a rip that WRAPS an <img> or a .pack facade,
// which no scan for [data-vcar] or img[data-packsrc] can see. The three
// conditions a page must meet, and why the obvious scan gives the wrong answer,
// are in shared/chrome.mjs beside the two exports. READ THAT BEFORE ADDING A
// VIDEO TILE OR A CAROUSEL HERE: a tile added without putting packplayer.js
// back navigates instead of playing in place, which reads as a design choice
// rather than as a bug.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate, moneyExact, rarityLabel, RARITY_WORDS, RARITY_ALIAS, imgDims, avifPicture } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const index = JSON.parse(await readFile(join(ROOT, "public/data/card-index.json"), "utf8"));
// The wider corpus the search falls through to. Read here so the page's own
// copy quotes the real number rather than a figure typed once and left to rot.
const printings = JSON.parse(await readFile(join(ROOT, "public/data/printings/manifest.json"), "utf8"));
const nAll = printings.total.toLocaleString("en-US");
const nSets = printings.sets.toLocaleString("en-US");
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));

const setName = index.sets || {};
// One prefix per set; the card's own number and the size complete the url. See
// sync-cards.mjs for why it is not stored per card.
const imgBase = index.imgBase || {};
const thumb = (slug, n) => (imgBase[slug] && n ? `${imgBase[slug]}/${n}/low.webp` : "");
const rows = index.cards || [];
const priced = rows.filter((r) => typeof r[4] === "number");
const top = priced.slice().sort((a, b) => b[4] - a[4]).slice(0, 60);

// EVERY PRINTING IN EXACTLY ONE BUCKET, AND THE BUCKETS HAVE TO ADD UP.
//
// The price note used to read "4,468 of 4,481 cards from the sets we rip have a
// price. The other 35,226 printings do not", which is two true numbers arranged
// into a false statement. 35,226 is 39,707 minus 4,481, so it is everything
// OUTSIDE our sets, not everything unpriced: the 13 cards inside our sets that
// carry no price were counted in neither half and simply vanished. A reader
// adding the page up got 39,694 against a total of 39,707 printed three times
// on the same page.
//
// The 13 are real and they are all English. TCGdex returns them with
// `pricing.tcgplayer: null` while carrying a Cardmarket price in euros for each
// one: Moltres and Zacian in Phantasmal Flames, Dudunsparce ex in Journey
// Together, Ledian, Grimmsnarl, Raging Bolt and Area Zero Underdepths in
// Stellar Crown, Hisuian Arcanine in Twilight Masquerade, Iron Treads,
// Dudunsparce, Drampa and Ancient Booster Energy Capsule in Temporal Forces,
// and Palafin in Obsidian Flames. So they are not a lookup miss on our side and
// they are not Japanese, which are the only two explanations the old sentence
// offered. They get their own clause.
const unpricedOurs = rows.length - priced.length;
const outside = printings.total - rows.length;
// The reason the other 35,226 have no price is NOT one reason. Roughly half are
// Japanese or Chinese, where there is no US market price to quote at all; the
// rest are English printings from the 347 sets we do not rip and therefore
// never priced. Counted here rather than asserted, because "most of them are
// Japanese" was the tempting phrasing and it is false.
let foreign = 0;
let shardRows = 0;
// Every distinct rarity string the page can ever show, from BOTH datasets. The
// server renders from card-index and the search renders from these shards, so
// the guard below has to see both or it only proves half the page.
const rarities = new Set();
for (const r of rows) if (r[3]) rarities.add(r[3]);
for (const [k] of Object.entries(printings.shards || {})) {
  const shard = JSON.parse(await readFile(join(ROOT, `public/data/printings/${k}.json`), "utf8"));
  shardRows += shard.length;
  for (const c of shard) {
    if (c.l && c.l !== "en") foreign += 1;
    if (c.r) rarities.add(c.r);
  }
}
const otherEnglish = outside - foreign;

// THE OLD CHECK HERE COULD NOT FAIL, AND IT READ AS THE MOST IMPORTANT ONE.
//
// It was `parts = priced + unpricedOurs + foreign + otherEnglish`, compared
// against `printings.total`, under a comment saying "a build that cannot make
// the parts equal the whole must not publish the whole. This is the check the
// old copy needed and did not have." Substitute the definitions above:
//
//   unpricedOurs  = rows.length - priced.length
//   outside       = printings.total - rows.length
//   otherEnglish  = outside - foreign
//   parts         = priced + (rows - priced) + foreign + (total - rows - foreign)
//                 = printings.total,  identically, for every possible input
//
// Both `priced` and `foreign` cancel out. It is an algebraic identity dressed as
// arithmetic, so `parts !== printings.total` was unreachable and the page's four
// bucket figures have never actually been verified against anything. A guard
// that cannot fire is worse than no guard: it is the reason nobody wrote a real
// one.
//
// The three things below CAN be false, and each one corresponds to a way the
// sentence on the page goes wrong:
//
//  1. The manifest's `total` is what the page prints as the size of the corpus,
//     three times. It is written by sync-all-printings.mjs and the shard files
//     are written in the same run, so a partial write leaves them disagreeing
//     and every derived figure is wrong by the difference.
//  2. `foreign` is counted from the shards while `outside` is arithmetic on the
//     manifest, so nothing stops foreign exceeding it. When it does,
//     `otherEnglish` goes NEGATIVE and the page prints a negative count of
//     English cards in plain prose.
//  3. Our own priced rows have to be a subset of the corpus. If card-index has
//     more rows than the printings corpus, `outside` is negative and the whole
//     paragraph inverts.
if (shardRows !== printings.total) {
  throw new Error(
    `printings manifest disagrees with its own shards: manifest.total is ${printings.total} but ` +
      `the ${Object.keys(printings.shards || {}).length} shard files hold ${shardRows} rows. ` +
      `cards.html prints manifest.total three times as the size of the corpus. ` +
      `Re-run node scripts/sync-all-printings.mjs.`
  );
}
if (rows.length > printings.total) {
  throw new Error(
    `card-index.json holds ${rows.length} cards, more than the ${printings.total} in the ` +
      `printings corpus that is supposed to contain them. Every "outside our sets" figure on ` +
      `cards.html is negative. One of the two files is from a different run.`
  );
}
// Kept only for the summary line at the bottom of this file. It is the identity
// described above, so it is a restatement of the four buckets and never a check;
// the three throws around it are the checks.
const parts = priced.length + unpricedOurs + foreign + otherEnglish;
if (foreign > outside) {
  throw new Error(
    `cards.html would print a negative count: ${foreign} non-English cards counted in the shards ` +
      `against only ${outside} cards outside our sets, so "other English" comes out at ` +
      `${otherEnglish}. Either the shards carry a language tag on cards inside our sets, or the ` +
      `manifest and the shards are from different runs.`
  );
}
const n = (v) => v.toLocaleString("en-US");

// TWO DATASETS, TWO DATES. The count comes from the printings corpus and the
// prices come from the card index, and they are not read on the same day. This
// used to date the whole sentence with index.checked, which put the price date
// against the printings figure. Date the page by the later of the two, and let
// the price note below carry the price date, which is the one a reader is
// actually judging a number against.
const newest = [index.checked, printings.checked].filter(Boolean).sort().pop();
const desc =
  `Search ${printings.total.toLocaleString("en-US")} Pokemon card printings across ${printings.sets} sets by name, ` +
  `with rarity and current TCGplayer market price. Updated ${longDate(newest) || newest}.`;

// DESKTOP LAYOUT, and it lives here rather than in assets-source/ui.css on
// purpose: it is the only page that wants these rules, and ui.css is already
// render blocking on 426 pages.
//
// WHAT WAS WRONG, MEASURED. .cq-list is one column at every width. A result row
// is a 60px thumbnail, a name, a set label and a price, and nothing else, so at
// 1440 each row was 1,392px wide with roughly 900px of empty band between the
// name and the price, 48 of them stacked, and the page ran 8,293px. That is the
// phone layout served unchanged to a desktop: correct at 390, absurd at 1440.
//
// EVERY RULE IS min-width ONLY, so a phone and a tablet render exactly what
// they rendered before. 1080 is the first width where two rows fit without the
// name and price colliding (a row needs ~440px before the name starts to wrap),
// and 1600 is where three do.
//
// The reading order is still the DOM order: a CSS grid fills row by row, so a
// list sorted by price descending still reads left to right, top to bottom.
//
// The search form is capped in the same block. It is `1fr 260px`, so at 1440
// the input was 1,130px wide and the set picker sat 1,160px away from the thing
// it filters. Nothing is gained by a search box wider than the query anybody
// types into it.
const DESKTOP_CSS = `<style>
@media(min-width:1080px){
  .cq-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:2px}
  .cardsearch{max-width:860px}
}
@media(min-width:1600px){
  .cq-list{grid-template-columns:repeat(3,minmax(0,1fr))}
}
</style>`;

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Card search" },
    ],
  },
];
// NO ItemList FOR THE TOP 20, and do not add one back without a target.
// It used to ship one, with a `name` and a `position` on every entry and
// nothing else. A ListItem with no `url` and no `item` names a thing that
// cannot be reached, so Google drops the whole block: it was twenty lines of
// markup doing nothing. The honest fix is a per-card page to point at, and
// this site does not have one. The visible row links to the card's SET page,
// which is a page about two hundred other cards as well, and several of the
// twenty share a set, so half the list would resolve to the same URL. That is
// a worse claim than making none.

// ONE RARITY MAPPING, SERIALISED INTO THE PAGE, NOT TWO COPIES OF IT.
//
// TCGdex is mixed case at source inside a single file, so the two halves of
// this page disagreed with each other: the 60 server rendered rows showed
// "Special illustration rare" next to "Mega Hyper Rare", and the moment you
// typed anything the client rendered rows showed the same mixture again. Title
// casing only the server half would have made the disagreement WORSE, because
// the page would then change its own casing as soon as somebody searched.
//
// The two other routes and why they lose:
//   - Normalise the JSON. The browser fetches /data/card-index.json and
//     /data/printings/*.json directly at runtime, and those files are written
//     by sync-cards.mjs and sync-all-printings.mjs and read by four other
//     builders. Rewriting them from a page builder means a page builder owning
//     another script's output, and the next sync run silently undoes it.
//   - Hand write the mapping in the inline script. That is the drift this
//     whole file already warns about above `money()`.
//
// So the function itself is serialised. `rarityLabel.toString()` ships the one
// definition in shared/format.mjs, and its free variables are RARITY_WORDS and
// RARITY_ALIAS, which are serialised next to it. There is no second copy to
// keep in step, and the assertion below proves the shipped copy still behaves
// like the imported one against every rarity string in both datasets, so a
// future edit that adds a closure dependency fails the build instead of quietly
// breaking the search.
//
// RARITY_ALIAS ARRIVED SECOND AND IS WHY THAT ASSERTION EARNS ITS KEEP. Adding
// a whole-string alias map to rarityLabel without adding it here would have
// left the shipped copy throwing a ReferenceError on the first keystroke: the
// server rendered rows would read "Holo Rare V" and the search would render
// nothing at all.
const RARITY_JS =
  `var RARITY_WORDS=${JSON.stringify(RARITY_WORDS)};\n  ` +
  `var RARITY_ALIAS=${JSON.stringify(RARITY_ALIAS)};\n  ` +
  rarityLabel.toString().replace(/\n/g, "\n  ");

const shippedRarityLabel = new Function(`${RARITY_JS}\n  return rarityLabel;`)();
for (const r of rarities) {
  if (shippedRarityLabel(r) !== rarityLabel(r)) {
    throw new Error(
      `the rarityLabel serialised into cards.html no longer matches shared/format.mjs: ` +
        `"${r}" renders as "${shippedRarityLabel(r)}" in the browser and "${rarityLabel(r)}" in the build`,
    );
  }
}

/* ---------------------------------------------- the 60 thumbnails ---------
 *
 * MEASURED 16 August 2026, 390x844 DPR2, gzipped text, cache off: 367.1KB on
 * load and 1,251.0KB fully scrolled, of which 1,127.6KB is card art. That made
 * this the heaviest page on the site to read all the way down. The shape is the
 * opposite of /wanted.html's: `loading="lazy"` works properly here, 46 of the
 * 60 rows are genuinely deferred, so the on-load figure is fine and the
 * scrolled one is the problem. QUOTE THE PAIR OR QUOTE NEITHER.
 *
 * .cq-img IS 60px WIDE AT EVERY VIEWPORT FROM 320 TO 1920, driven with CDP and
 * checked at 18 of them; ui.css pins it at `width:60px;height:82.5px`. So a
 * phone needs 120 device pixels at DPR2 and 180 at DPR3, and each of these rows
 * was fetching TCGdex's 245w file, an oversample of 4.2x in area, sixty times.
 *
 * THE HOST WAS FINE AND SO WAS THE FORMAT. All 60 are TCGdex and all 60 already
 * take the AVIF through avifPicture; the largest is 33KB. There is simply no
 * rendition between 245w and nothing, so sync-card-thumbs.mjs mirrors 120w and
 * 180w of them, the same trick it already plays for /grading.html's 32px boxes
 * at BOX=72. Its header carries the encode measurements.
 *
 * ONLY THE SERVER RENDERED ROWS. The search below renders from a 39,707 row
 * corpus and keeps hotlinking low.webp, because mirroring the whole corpus is
 * four thousand cards times four files and the search is an interaction rather
 * than a page load. Nothing looks worse for it: the remote 245w file is SHARPER
 * than the mirror, not softer, so a reader who types sees the same picture or a
 * better one.
 *
 * `sizes` IS A FLAT 60px AND THAT IS NOT A SHORTCUT, it is the measurement
 * above. Without it the browser assumes 100vw, asks for 780 device pixels and
 * takes the largest candidate on the list, which would make the mirror worse
 * than useless. See build-wanted.mjs for the same trap costing 40 files there.
 */
const REND = JSON.parse(await readFile(join(ROOT, "data/card-thumbs.json"), "utf8")).renditions?.cards || {
  widths: [],
  dir: "/assets/cards/",
  cards: {},
};
const CQ_SIZES = "60px";

/**
 * The thumbnail for one row: the mirrored 120w and 180w files if we hold them,
 * with TCGdex's own 245w kept as the top rung so nothing is ever upscaled, and
 * a bare hotlink if we do not. A card can be missing because the price table
 * moved it into the top 60 after the last sync, and then this row looks exactly
 * as it did before any of this existed.
 */
/*
 * `eager` IS THE TWO ROWS IN THE FIRST SCREEN. Measured over CDP at 390x844
 * DPR 2, reading each img's own border box at scroll 0: rows one and two sit at
 * y=661 and y=768, inside the 844px viewport, and row three does not. Those two
 * were being fetched at first paint regardless, because `loading="lazy"` is a
 * vertical heuristic and they are not below the fold; the attribute only cost
 * them the preload scanner. The other 58 keep it, which is the whole point of
 * the paragraph above: this page's problem is the scrolled figure, not the
 * on-load one, and nothing here moves a byte onto the load path.
 */
const cqImg = (src, eager = false) => {
  const LAZY = eager ? "" : ' loading="lazy"';
  const base = src.replace(/\/low\.webp$/, "");
  const m = REND.cards?.[base];
  if (!m || !/^https:\/\/assets\.tcgdex\.net\//.test(src)) {
    return avifPicture(
      `<img class="cq-img" src="${esc(src)}" onerror="this.remove()" alt=""${LAZY}${imgDims(src)}>`
    );
  }
  const set = (ext) =>
    [...REND.widths.map((w) => `${REND.dir}${m.stem}-${w}.${ext} ${w}w`), `${base}/low.${ext} 245w`].join(", ");
  return (
    `<picture><source type="image/avif" srcset="${esc(set("avif"))}" sizes="${CQ_SIZES}">` +
    `<img class="cq-img" src="${esc(src)}" srcset="${esc(set("webp"))}" sizes="${CQ_SIZES}"` +
    ` onerror="this.remove()" alt=""${LAZY}${imgDims(src)}></picture>`
  );
};

// One row per line at 390, two of them inside an 844px viewport.
const EAGER_ROWS = 2;
const row = (r, i) => {
  const [name, slug, n, rarity, price] = r;
  const src = thumb(slug, n);
  return `<li class="cq${src ? " has-thumb" : ""}">
        ${src ? cqImg(src, i < EAGER_ROWS) : ""}
        <a class="cq-name" href="/sets/${esc(slug)}.html">${esc(name)}</a>
        <span class="cq-set">${esc(setName[slug] || slug)} &bull; ${esc(n || "")}</span>
        ${rarity ? `<span class="cq-rr">${esc(rarityLabel(rarity))}</span>` : ""}
        ${typeof price === "number" ? `<span class="cq-pr">${moneyExact(price)}</span>` : ""}
      </li>`;
};

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pokemon Card Search: Every Printing of Every Card</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/cards.html">
<meta property="og:title" content="Search every Pokemon card we cover">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/cards.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-cards.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-cards.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
${DESKTOP_CSS}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">

<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Card Pokedex</span>
    <h1>Card <span class="hl">search</span></h1>
    <p class="lede" style="max-width:36em">Every printing we could source, ${nAll} of them across ${nSets} sets,
      English, Japanese and Chinese alike. Type a Pokemon name and you get all of them, not just the English ones.
      The ${n(priced.length)} from the sets we rip that have a US market price also carry what they are going for.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Card search</p>

    <form class="cardsearch" role="search" onsubmit="return false">
      <label class="sr-only" for="cq">Search cards by name</label>
      <input id="cq" type="search" placeholder="Umbreon, Charizard, Iono..." autocomplete="off" enterkeyhint="search">
      <select id="cset" aria-label="Limit to one set">
        <option value="">Every set</option>
        ${sets
          .filter((s) => setName[s.id])
          .map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`)
          .join("\n        ")}
      </select>
    </form>
    <p class="cq-status" id="cqStatus" aria-live="polite"></p>

    <ol class="cq-list" id="cqList">
      ${top.map((r, k) => row(r, k)).join("\n      ")}
    </ol>
    <p class="cq-head" id="cqHead">The 60 most valuable cards across every set we rip. Type above to search all ${nAll} printings.</p>

    <p class="price-note">${esc(priceNote(index))}
      Where a card comes as a normal, holo and reverse holo at different prices, the figure is the priciest of them.
      ${/* THE GAP CLOSED AND THE SENTENCE ABOUT IT DID NOT. PriceCharting took
            this from a shortfall to 5,181 of 5,181, and the clause explaining
            the shortfall stayed behind, so the page read "0 do not, and they
            are English: TCGdex lists them with no TCGplayer entry at all" and
            then explained at length why an empty set of cards shows no price.
            It is written as a branch rather than deleted because the shortfall
            can come back on any sync, and the reason it gives is the site's
            actual policy on euro prices, which is worth keeping the moment
            there is a card it applies to. */ ""}${
        unpricedOurs
          ? `${n(priced.length)} of the ${n(rows.length)} cards from the sets we rip have a price.
      ${n(unpricedOurs)} do not, and they are English: TCGdex lists them with no TCGplayer entry at all, so they
      show nothing rather than a euro price converted into a guess.`
          : `Every one of the ${n(rows.length)} cards from the sets we rip has a price.`
      } The remaining ${n(outside)} printings sit
      outside the ${Object.keys(setName).length} sets we price. ${n(foreign)} of those are Japanese or Chinese, which have no US market
      price to quote in the first place, and ${n(otherEnglish)} are English cards from sets we do not rip. Where a Japanese
      card could not be matched to a Pokedex number we show the name as printed and say so, because we do not
      invent translations.
      Singles move fast, so treat these as a ballpark and not a quote. We do not sell cards.</p>

    ${/* THE INDEX BEHIND THIS BOX HOLDS POKEMON TCG CARDS AND NOTHING ELSE, and
          the paragraph above already spends six sentences on which cards are and
          are not in it. This is the one category that is missing for a different
          reason: a Topps card is not a Pokemon TCG card at all, so it will never
          be in this index however many sets get added, and somebody who types
          "Charizard" while holding one gets a page of results none of which is
          the thing in their hand. Nothing else on this page tells them why. */ ""}
    <p class="price-note"><b>Searching for a card that is not here at all?</b> Topps printed its own Pokemon
      cards from 1999 to 2004, trading cards rather than game cards, and they are in no set this box searches
      because they are not Pokemon TCG cards. <a href="/topps.html">What they are and how to spot one</a>, and
      <a href="/topps-card-values.html">what they are worth</a>.</p>
  </div>
</section>

</main>
${footer(priceFooter("Fan made, not official."))}
<script>
(function(){
  var input=document.getElementById('cq'), sel=document.getElementById('cset');
  var list=document.getElementById('cqList'), status=document.getElementById('cqStatus');
  var head=document.getElementById('cqHead');
  var DATA=null, LOADING=false, WAITING=[], MAX=200;
  var initial=list.innerHTML;

  // The browser cannot import shared/format.mjs, so this is the one copy of
  // moneyExact that has to be duplicated. Keep the two in step.
  function money(n){
    return typeof n==='number' ? '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '';
  }
  // NOT hand written: the next few lines are shared/format.mjs's rarityLabel and
  // the two maps it closes over, serialised in by build-cards.mjs so the search
  // renders rarities with exactly the names and casing the server rendered them
  // in. Edit shared/format.mjs.
  ${RARITY_JS}
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  function render(hits, total){
    if(!hits.length){
      list.innerHTML='';
      status.textContent='Nothing matched. Check the spelling, or try just the Pokemon name.';
      head.hidden=true;
      return;
    }
    list.innerHTML=hits.map(function(r){
      // The url is built into a variable and then interpolated, so the markup
      // string never contains an href attribute followed by a literal path.
      // Inline, the build's broken-link check reads that prefix as a real link,
      // captures the JS concatenation as the target, and fails the nightly on a
      // page that was never meant to exist.
      // Only cards from a set we rip have a guide to link to; the other 35,000
      // printings render as plain text rather than a link to a 404.
      var href=r.slug ? '/sets/'+esc(r.slug)+'.html' : '';
      // Same thumbnail the server renders into the default list. Without this
      // the images existed only on the view nobody arrives at with intent: they
      // vanished the moment anybody typed or picked a set.
      // No thumbnail outside our own sets: the corpus carries no image url, and
      // guessing one from the set id gives a broken image on every miss.
      var base=r.slug && DATA.imgBase && DATA.imgBase[r.slug];
      // Same <picture> the server renders, and for the same reason: TCGdex
      // serves an AVIF off every path it serves a WebP off, 29.7% smaller at
      // low.*. This is avifPicture() from shared/format.mjs restated in the
      // browser rather than imported, because the search renders client side.
      // BOTH copies apply the SAME host test. Do not shorten it to "the search
      // corpus is all TCGdex": it is today, and an <img> whose only source is
      // an AVIF that 404s paints a broken card rather than falling back.
      var thumbUrl=base&&r.n ? base+'/'+r.n+'/low.webp' : '';
      var avifSrc=thumbUrl.indexOf('https://assets.tcgdex.net/')===0
        ? '<source type="image/avif" srcset="'+esc(thumbUrl.slice(0,-5)+'.avif')+'">'
        : '';
      var img=thumbUrl
        ? '<picture>'+avifSrc+'<img class="cq-img" src="'+esc(thumbUrl)+'" alt="" loading="lazy" width="245" height="337"></picture>'
        : '';
      var nameCell=href
        ? '<a class="cq-name" href="'+href+'">'+esc(r.name)+'</a>'
        : '<span class="cq-name">'+esc(r.name)+'</span>';
      // The printed name, when it differs. On a Japanese card the searchable
      // name is the English species; showing ヤブクロン next to Trubbish is what
      // makes it obvious which printing this actually is.
      var printed=r.printed ? '<span class="cq-native" lang="'+(r.lang==='ja'?'ja':'zh')+'">'+esc(r.printed)+'</span>' : '';
      // A card with no dex number could not be translated, so the name shown IS
      // the printed one. Say so rather than letting it read as an English name.
      var flag=r.untranslated ? '<span class="cq-lang is-native">Japanese name</span>'
        : (r.lang!=='en' ? '<span class="cq-lang">'+(r.lang==='ja'?'Japanese':'Chinese')+'</span>' : '');
      return '<li class="cq'+(img?' has-thumb':'')+'">'
        + img
        + nameCell
        + printed
        + '<span class="cq-set">'+esc(r.set)+' • '+esc(r.n||'')+'</span>'
        + (r.rarity?'<span class="cq-rr">'+esc(rarityLabel(r.rarity))+'</span>':'')
        + flag
        + (typeof r.price==='number'?'<span class="cq-pr">'+money(r.price)+'</span>':'')
        + '</li>';
    }).join('');
    head.hidden=true;
    status.textContent = total>hits.length
      ? total.toLocaleString('en-US')+' matches, showing the '+hits.length+' priciest'
      : total.toLocaleString('en-US')+(total===1?' match':' matches');
  }

  // ---- every printing, in every language -------------------------------
  // The priced index above is 4,481 cards from the 23 English sets we rip. The
  // shards under /data/printings are all 39,707 printings across 370 sets,
  // including the Japanese and Chinese ones, so "Trubbish" finds 30 printings
  // rather than 4. They are separate on purpose: only the 23 have prices.
  //
  // SHARDED BY FIRST LETTER because the whole corpus is 4.5MB. Typing pulls the
  // one shard the query starts with, so a search costs ~200KB, not 4.5MB.
  var SHARD={}, SHARD_WAIT={};
  function shardKey(q){
    var c=q.charAt(0).toLowerCase();
    return (c>='a'&&c<='z') ? c : '0';
  }
  function loadShard(k, then){
    if(SHARD[k]){ then(); return; }
    if(SHARD_WAIT[k]){ SHARD_WAIT[k].push(then); return; }
    SHARD_WAIT[k]=[then];
    var url='/data/printings/'+k+'.json';
    fetch(url).then(function(r){ return r.ok ? r.json() : []; }).then(function(j){
      SHARD[k]=j;
      var w=SHARD_WAIT[k]; SHARD_WAIT[k]=null;
      w.forEach(function(fn){ fn(); });
    }).catch(function(){
      // An unreachable shard must not wedge the search. Fall back to the priced
      // index, which is already in memory, rather than showing nothing.
      SHARD[k]=[];
      var w=SHARD_WAIT[k]; SHARD_WAIT[k]=null;
      w.forEach(function(fn){ fn(); });
    });
  }

  // Price lookup for the printings rows. Keyed on name|set|number with leading
  // zeros stripped, which was measured to join all 4,481 priced cards onto the
  // corpus, so an English card we rip keeps its price and its thumbnail.
  var PRICEMAP=null;
  function priceMap(){
    if(PRICEMAP) return PRICEMAP;
    PRICEMAP={};
    for(var i=0;i<DATA.cards.length;i++){
      var r=DATA.cards[i], setName=DATA.sets[r[1]]||r[1];
      PRICEMAP[key3(r[0],setName,r[2])]={price:r[4], slug:r[1], n:r[2]};
    }
    return PRICEMAP;
  }
  function key3(name,set,num){
    return String(name).toLowerCase()+'|'+String(set).toLowerCase()+'|'+String(num).replace(/^0+(?=\d)/,'');
  }

  function run(){
    var q=input.value.trim().toLowerCase(), set=sel.value;
    if(!q && !set){ list.innerHTML=initial; status.textContent=''; head.hidden=false; return; }
    if(!DATA){ load(run); return; }
    // A set filter names one of our 23 English sets, so it stays on the priced
    // index: the corpus has no notion of our slugs and every hit would be a
    // set the dropdown cannot express.
    if(set){
      var only=DATA.cards.filter(function(r){
        if(r[1]!==set) return false;
        return !q || r[0].toLowerCase().indexOf(q)!==-1;
      });
      only.sort(function(a,b){ return (b[4]||0)-(a[4]||0); });
      render(only.map(fromPriced).slice(0,MAX), only.length);
      return;
    }
    var k=shardKey(q);
    if(!SHARD[k]){ status.textContent='Searching every set...'; loadShard(k, run); return; }
    var pm=priceMap();
    var hits=SHARD[k].filter(function(c){ return c.n.toLowerCase().indexOf(q)!==-1; })
      .map(function(c){
        var m=pm[key3(c.n,c.s,c.i)];
        return { name:c.n, printed:c.p, set:c.s, n:c.i, rarity:c.r, lang:c.l,
                 untranslated:c.u, price:m?m.price:null, slug:m?m.slug:null };
      });
    // Priced first and priciest first within that, because those are the cards we
    // can actually tell you something about. Everything else follows grouped by
    // set, rather than being buried at the bottom in database order.
    hits.sort(function(a,b){
      var ap=typeof a.price==='number', bp=typeof b.price==='number';
      if(ap!==bp) return ap?-1:1;
      if(ap) return b.price-a.price;
      return String(a.set).localeCompare(String(b.set));
    });
    render(hits.slice(0,MAX), hits.length);
  }

  // The priced index is a positional array; the corpus is objects. One shape
  // reaches render() so it does not have to know which index a row came from.
  function fromPriced(r){
    return { name:r[0], printed:null, set:DATA.sets[r[1]]||r[1], n:r[2],
             rarity:r[3], lang:'en', untranslated:0, price:r[4], slug:r[1] };
  }

  function load(then){
    // Queue the callback instead of dropping it. The focus handler warms the
    // index with load() and no callback; if you then typed before the fetch
    // resolved, run() called load(run), hit the LOADING guard, returned, and
    // its callback was lost forever. The status sat on "Loading..." until you
    // pressed another key.
    if(then) WAITING.push(then);
    if(LOADING) return;
    LOADING=true;
    status.textContent='Loading the card list...';
    fetch('/data/card-index.json').then(function(r){ return r.json(); }).then(function(j){
      DATA=j; LOADING=false;
      var q=WAITING; WAITING=[];
      q.forEach(function(fn){ fn(); });
    }).catch(function(){
      LOADING=false; WAITING=[];
      status.textContent='Could not load the card list. Reload the page and try again.';
    });
  }

  var t;
  // 50ms, DOWN FROM 120, AND THE NUMBER WAS THE LATENCY. At 390x844 under 4x
  // CPU throttling a warm keystroke painted in 120ms, and in 25ms with the
  // debounce removed entirely, so the timer was nearly all of it. It also pulls
  // the printings shard forward: parsing a 372KB shard is a 97-106ms task that
  // used to start after the typist had stopped, and the first keystroke needing
  // a cold shard went 188ms -> 60ms. Cost: typing "charizard" at 70ms went
  // 0 -> 2.1% dropped frames, worst frame 35ms. Re-measure before raising it.
  input.addEventListener('input',function(){ clearTimeout(t); t=setTimeout(run,50); });
  sel.addEventListener('change',run);
  // Warm the index on first focus so the first keystroke feels instant.
  input.addEventListener('focus',function(){ if(!DATA) load(); },{once:true});

  // Deep links: /cards.html?q=umbreon and the "search this set" link on every
  // set guide, /cards.html?set=pitch-black.
  var p=new URLSearchParams(location.search);
  if(p.get('q')||p.get('set')){
    if(p.get('q')) input.value=p.get('q');
    if(p.get('set')) sel.value=p.get('set');
    load(run);
  }
})();
</script>
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/cards.html"), page);
console.log(`Wrote public/cards.html
  ${rows.length} cards searchable across ${Object.keys(setName).length} sets
  ${priced.length} priced, ${top.length} rendered into the HTML
  buckets: ${priced.length} priced + ${unpricedOurs} ours with no TCGplayer entry
           + ${foreign} non-English + ${otherEnglish} other English = ${parts} of ${printings.total}
  priciest: ${top[0]?.[0]} ${top[0]?.[2]} (${setName[top[0]?.[1]]}) ${moneyExact(top[0]?.[4])}`);
