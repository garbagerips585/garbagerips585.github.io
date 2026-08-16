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
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS } from "../shared/chrome.mjs";
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

const row = (r) => {
  const [name, slug, n, rarity, price] = r;
  const src = thumb(slug, n);
  return `<li class="cq${src ? " has-thumb" : ""}">
        ${src ? avifPicture(`<img class="cq-img" src="${esc(src)}" onerror="this.remove()" alt="" loading="lazy"${imgDims(src)}>`) : ""}
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
<title>Pokemon Card Search: Every Printing of Every Card | Garbage Rips 585</title>
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
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
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
      ${top.map(row).join("\n      ")}
    </ol>
    <p class="cq-head" id="cqHead">The 60 most valuable cards across every set we rip. Type above to search all ${nAll} printings.</p>

    <p class="price-note">TCGplayer market prices via TCGdex, read ${esc(longDate(index.checked) || index.checked)}.
      Where a card comes as a normal, holo and reverse holo at different prices, the figure is the priciest of them.
      ${n(priced.length)} of the ${n(rows.length)} cards from the sets we rip have a price.
      ${n(unpricedOurs)} do not, and they are English: TCGdex lists them with no TCGplayer entry at all, so they
      show nothing rather than a euro price converted into a guess. The remaining ${n(outside)} printings sit
      outside the ${Object.keys(setName).length} sets we price. ${n(foreign)} of those are Japanese or Chinese, which have no US market
      price to quote in the first place, and ${n(otherEnglish)} are English cards from sets we do not rip. Where a Japanese
      card could not be matched to a Pokedex number we show the name as printed and say so, because we do not
      invent translations.
      Singles move fast, so treat these as a ballpark and not a quote. We do not sell cards.</p>
  </div>
</section>

</main>
${footer("Card data from TCGdex, prices from TCGplayer. Fan made, not official.")}
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
