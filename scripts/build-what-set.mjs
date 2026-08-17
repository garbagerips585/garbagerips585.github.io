#!/usr/bin/env node
// Generate /what-set.html: which set a card came from, looked up by the number
// printed on it.
//
//   node scripts/build-what-set.mjs
//
// Reads public/data/expansions.json and public/data/sets.json. No new data and
// no new source: the whole page is an index over the set list the site already
// syncs from the Pokemon TCG API.
//
// WHY THIS PAGE EXISTS. /rarity.html teaches somebody to read the symbol in the
// corner and tells them how rare the card is. /expansions.html lists all 174
// English sets in release order. Between them the site could not answer the
// question people actually ask while holding a card, which is "what set is
// this". The card carries the answer twice, in the number after the slash and
// in the symbol beside it, and neither was indexed anywhere.
//
// THE INDEX IS BY THE DENOMINATOR, and that is the only reason this is not a
// second copy of /expansions.html. Chronological order is the wrong access path
// for somebody holding a card: they do not know the year, they know the number.
// Sorted by that number the same 174 rows become a lookup table.
//
// AND IT IS HONEST ABOUT NOT BEING UNIQUE. Only a minority of set sizes belong
// to exactly one set, so most lookups return several candidates. The page says
// so, prints every candidate with its symbol, and sends the reader to the
// symbol to finish the job rather than picking one and sounding confident.
//
// NOTHING HERE IS TYPED IN. Every count in the copy is computed from the same
// array the table is built from, so the page cannot claim 48 unique sizes while
// listing a different number of them.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
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
import { esc, longDate, shortDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const expansions = JSON.parse(await readFile(join(ROOT, "public/data/expansions.json"), "utf8"));
const all = expansions.sets || [];
const { sets: guides } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));

// THE SET SYMBOLS ARE MIRRORED LOCALLY, which matters more here than anywhere
// else: they are the point of the page. Measured over CDP at 390x844 DPR2 with
// the cache disabled and every lazy image forced to load, this page transferred
// 1,769.9 KB of images and 1,472 KB of that was 141 symbol pngs drawn into a
// 24px box. The API ships most of the legacy sets at 500x500 and base1 at
// 884x452, so the reader paid roughly 25x linear oversample per symbol.
//
// scripts/sync-symbols.mjs fits each one inside a 48px box as lossless WebP,
// which covers the 24px box at DPR2, and records its real size in
// data/symbol-dims.json. A set missing from the manifest keeps its remote url,
// so a symbol that would not download degrades to the behaviour this page had
// before rather than to a hole in the row.
let SYMBOL_DIMS = {};
try {
  SYMBOL_DIMS = JSON.parse(await readFile(join(ROOT, "data/symbol-dims.json"), "utf8")).symbols || {};
} catch {
  /* not synced yet: every symbol falls back to its remote url */
}
let remoteSymbols = 0;

/**
 * The <img> for one set symbol.
 *
 * These carried no width or height at all, on either branch. `.ws-set img` pins
 * a 24px square with object-fit:contain so nothing actually moved, but the
 * attributes are free and they are the only thing holding the row if that rule
 * ever loses. They are the file's REAL shape, not a flat 48x48: the box is a
 * bound and base1 comes out 48x25.
 */
function symbolImg(s) {
  const d = SYMBOL_DIMS[s.apiId];
  if (d) {
    return `<img src="/assets/symbols/${esc(s.apiId)}-pokemon-tcg-set-symbol.webp" alt="" width="${d[0]}" height="${d[1]}" loading="lazy" decoding="async">`;
  }
  remoteSymbols += 1;
  return `<img src="${esc(s.symbol)}" alt="" width="20" height="20" loading="lazy" decoding="async" onerror="this.remove()">`;
}

if (all.length < 150) {
  throw new Error(`expansions.json holds ${all.length} sets, expected 150+. The index would be missing eras.`);
}

// Promo and tie-in sets are flagged by sync-expansions.mjs and they are a
// different kind of object: their cards are numbered inside a running promo
// series rather than out of a set total, so a card reading "SWSH123" has no
// denominator to look up at all. They stay in the table, marked, because a
// reader who does not know that needs to be told rather than to find nothing.
const main = all.filter((s) => !s.promo);
const promo = all.filter((s) => s.promo);

for (const s of all) {
  if (!Number.isInteger(s.printedTotal) || s.printedTotal < 1) {
    throw new Error(`${s.name} has printedTotal ${s.printedTotal}; the index is keyed on that number.`);
  }
}

/** number printed after the slash -> the sets that use it. */
const byTotal = new Map();
for (const s of main) {
  if (!byTotal.has(s.printedTotal)) byTotal.set(s.printedTotal, []);
  byTotal.get(s.printedTotal).push(s);
}
for (const list of byTotal.values()) list.sort((a, b) => String(a.released).localeCompare(String(b.released)));

const totals = [...byTotal.keys()].sort((a, b) => a - b);
const unique = totals.filter((n) => byTotal.get(n).length === 1);
const shared = totals.filter((n) => byTotal.get(n).length > 1);
// The busiest set size, used as the worked example of why the number alone is
// not enough. Ties are broken on the LARGER size deliberately: six different
// sizes are shared by the same number of sets, and the smallest of them is /30,
// a handful of tiny promo-adjacent expansions nobody is holding. The largest is
// a size a modern card actually reads, which is what makes the example land.
const busiest = Math.max(...totals.map((n) => byTotal.get(n).length));
const worst = totals.filter((n) => byTotal.get(n).length === busiest).sort((a, b) => b - a)[0];
const worstSets = byTotal.get(worst);

// A cross-check on the arithmetic in the copy below. If these ever stop adding
// up the page would be describing an index it is not printing.
const indexed = totals.reduce((n, t) => n + byTotal.get(t).length, 0);
if (indexed !== main.length || unique.length + shared.length !== totals.length) {
  throw new Error(
    `Index does not add up: ${indexed} rows over ${totals.length} numbers against ${main.length} sets, ` +
      `${unique.length} unique plus ${shared.length} shared.`,
  );
}

// Secret rares, from the checklists the site actually holds. This is the answer
// to "my card is 199/198", and it is a counted fact rather than a description:
// every one of these is a real card numbered above its own set's printed total.
const withSecrets = guides.filter((g) => (g.secretCount || 0) > 0);
const secretTotal = withSecrets.reduce((n, g) => n + g.secretCount, 0);
const mostSecrets = withSecrets.slice().sort((a, b) => b.secretCount - a.secretCount)[0];
if (secretTotal < 1 || !mostSecrets) {
  throw new Error("No secret rares found in sets.json, but the page has a section about them.");
}

const guideFor = new Map(all.filter((s) => s.slug).map((s) => [s.apiId, s.slug]));
const withGuide = all.filter((s) => s.slug);

// INDEXED IS `main`, NOT `all`. Both this line and the kicker below said
// "All 174 English sets indexed by size" while the index printed 141 of them,
// because the 33 promo runs are deliberately excluded and the page says so in
// its own "Three cards this will not find" list. The stat block right under the
// kicker has always read "86 set sizes, 141 sets", so the page contradicted
// itself twice over in the two lines a reader sees first, and the meta
// description carried the wrong number into search results.
const desc =
  `Look up which Pokemon set a card is from by the number after the slash. ` +
  `All ${main.length} main English expansions indexed by size, with set symbols and release years.`;
if (desc.length > 160) throw new Error(`meta description is ${desc.length} characters, over 160:\n${desc}`);

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "What set is my card from?", item: `${SITE}/what-set.html` },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What does the number on the bottom of a Pokemon card mean?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            `It is two numbers with a slash between them. The left one is that card's place in the set and the right one is ` +
            `how many cards the set was printed with, so 45/102 is the forty-fifth card of a 102 card set. The right number ` +
            `is the one that identifies the set: across the ${main.length} main English expansions there are ${totals.length} ` +
            `different set sizes, and ${unique.length} of them belong to exactly one set.`,
        },
      },
      {
        "@type": "Question",
        name: "How do I tell which set a Pokemon card is from?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            `Start with the number after the slash and narrow it with the symbol printed next to it. The number alone lands ` +
            `on a single set ${unique.length} times out of ${totals.length}; the rest are shared by two or more, with ` +
            `${worst} used by ${worstSets.length} different sets. The symbol tells those apart. It sits in the bottom right ` +
            `corner on cards up to the XY era and moved to the bottom left in 2017 at Sun and Moon.`,
        },
      },
      {
        "@type": "Question",
        name: "Why is my card numbered higher than the set total?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            `Because it is a secret rare: a card numbered above the printed set size, so a card reading 199/198 is real and ` +
            `is the kind of card people are hoping for. Across the ${withSecrets.length} sets this site holds full checklists ` +
            `for there are ${secretTotal.toLocaleString("en-US")} cards numbered above their own set total, ` +
            `${mostSecrets.secretCount} of them in ${mostSecrets.name} alone.`,
        },
      },
    ],
  },
];

/**
 * Page-scoped CSS.
 *
 * The index is a definition list in disguise: one number, then the sets that
 * use it. A table would be the obvious choice and is the wrong one, because the
 * left column is the thing being looked up rather than a row label, and at
 * 390px a two column table of "number, three set names" collapses into a mess
 * that has to scroll sideways. Grid rows that reflow to stacked on a phone read
 * the same either way.
 *
 * The symbol images are the load-bearing part of the whole page, so they are
 * given a fixed 24px box with a light plate behind them: several era symbols
 * are near-black line art and vanish against the navy the site uses for keylines.
 */
const style = `
.ws-tool{background:var(--card);border:2px solid var(--navy);border-radius:var(--r);
  padding:var(--s5);box-shadow:var(--hard-lg);margin-top:var(--s5)}
.ws-tool label{display:block;font:700 var(--t-label)/1 var(--mono);letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink-soft);margin-bottom:var(--s2)}
.ws-tool input{width:100%;box-sizing:border-box;min-height:52px;padding:0 var(--s4);
  border:2px solid var(--navy);border-radius:var(--r);background:var(--paper-2);
  font:700 1.25rem/1 var(--mono);color:var(--ink)}
.ws-tool input:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.ws-hint{font:400 var(--t-sm)/1.5 var(--body);color:var(--ink-soft);margin:var(--s3) 0 0}
.ws-count{font-family:var(--mono);font-size:var(--t-sm);color:var(--ink-soft);margin:var(--s4) 0 0}

.ws-list{list-style:none;margin:var(--s4) 0 0;padding:0;
  border-top:1px solid var(--hair)}
.ws-row{display:grid;grid-template-columns:1fr;gap:var(--s2);
  padding:var(--s3) 0;border-bottom:1px solid var(--hair)}
.ws-n{font:400 1.5rem/1 var(--display);color:var(--ketchup-deep);
  display:flex;align-items:baseline;gap:var(--s2)}
.ws-n span{font:400 var(--t-micro)/1 var(--mono);color:var(--ink-soft);text-transform:uppercase;
  letter-spacing:.06em}
.ws-sets{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
/* WRAPS, and it has to. The longest row here is a 24px symbol, "Team Magma vs
   Team Aqua ex", the year and era, and a "+16 secret" badge. Held on one line
   that is 387px inside a 366px column at 390px wide, so the whole page picked
   up 9px of horizontal scroll from four rows out of 141. min-width:0 as well,
   or the name is a flex item that refuses to shrink below its longest word. */
.ws-set{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2);
  font-size:var(--t-sm);line-height:1.35;min-width:0}
.ws-set a,.ws-set>span{min-width:0}
.ws-set img{width:24px;height:24px;object-fit:contain;flex:0 0 24px;
  background:var(--paper-3);border-radius:4px;padding:2px;box-sizing:border-box}
.ws-set a{color:var(--navy);text-decoration:underline;text-underline-offset:2px;font-weight:700}
.ws-yr{font-family:var(--mono);font-size:.68rem;color:var(--ink-soft);white-space:nowrap}
.ws-badge{font-family:var(--mono);font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;
  background:var(--mustard);border:1px solid var(--navy);border-radius:var(--r-pill);
  padding:1px 7px;white-space:nowrap}
.ws-empty{padding:var(--s5) 0;font-size:var(--t-sm);color:var(--ink-soft)}
@media(min-width:640px){
  .ws-row{grid-template-columns:120px 1fr;gap:var(--s4);align-items:start}
  .ws-n{justify-content:flex-end;flex-direction:column;align-items:flex-end;gap:2px}
}
`;

const setLine = (s) => {
  const slug = guideFor.get(s.apiId);
  const name = slug
    ? `<a href="/sets/${esc(slug)}.html">${esc(s.name)}</a>`
    : `<span>${esc(s.name)}</span>`;
  return `<li class="ws-set">${symbolImg(s)}
        ${name} <span class="ws-yr">${esc(String(s.released).slice(0, 4))} &bull; ${esc(s.series)}</span>${
          s.total > s.printedTotal
            ? ` <span class="ws-badge">+${s.total - s.printedTotal} secret</span>`
            : ""
        }</li>`;
};

const indexRows = totals
  .map(
    (n) => `      <li class="ws-row" data-n="${n}" data-names="${esc(
      byTotal
        .get(n)
        .map((s) => `${s.name} ${s.series}`)
        .join(" ")
        .toLowerCase(),
    )}">
      <p class="ws-n">/${n}<span>${byTotal.get(n).length} set${byTotal.get(n).length === 1 ? "" : "s"}</span></p>
      <ul class="ws-sets">
${byTotal.get(n).map(setLine).join("\n")}
      </ul>
    </li>`,
  )
  .join("\n");

/**
 * The filter.
 *
 * Progressive enhancement, and it matters here more than usual: without script
 * the page is still the whole index, sorted by the number you are looking up,
 * so it works by scrolling. The script only hides rows.
 *
 * Digits match the SET SIZE and nothing else. Typing "151" should not return
 * every set whose name contains 151, because a person typing digits into a box
 * labelled "the number after the slash" is holding a card, and a name match
 * would bury the answer they asked for. Letters match names and eras.
 */
const script = `
(function(){
  var box=document.getElementById('wsq'), rows=[].slice.call(document.querySelectorAll('.ws-row')),
      out=document.getElementById('wscount'), none=document.getElementById('wsnone');
  if(!box||!rows.length) return;
  function run(){
    var q=box.value.trim().toLowerCase(), shown=0, digits=/^[0-9]+$/.test(q);
    for(var i=0;i<rows.length;i++){
      var r=rows[i], hit;
      if(!q) hit=true;
      else if(digits) hit=r.getAttribute('data-n').indexOf(q)===0;
      else hit=r.getAttribute('data-names').indexOf(q)!==-1;
      r.hidden=!hit; if(hit) shown++;
    }
    out.textContent = q ? (shown+(shown===1?' set size matches "':' set sizes match "')+box.value.trim()+'"')
                        : ('${totals.length} set sizes, ${main.length} sets');
    none.hidden = shown>0;
  }
  box.addEventListener('input',run);
  var p=new URLSearchParams(location.search).get('n');
  if(p){ box.value=p; }
  run();
})();
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>What Set Is My Pokemon Card From? Look Up the Number</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/what-set.html">
<meta property="og:title" content="What set is my Pokemon card from?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/what-set.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-what-set.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-what-set.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${
  remoteSymbols
    ? `<!-- ${remoteSymbols} set symbol(s) still come from the API host because
     sync-symbols.mjs holds no local copy of them, so the connection is opened
     before the HTML has finished parsing. Emitted only when that is true: with
     every symbol mirrored this hint opens a connection nothing uses.
     /expansions.html carries the same conditional hint for the same reason. -->
<link rel="preconnect" href="https://images.pokemontcg.io" crossorigin>`
    : `<!-- No preconnect to images.pokemontcg.io: every set symbol on this page is
     mirrored locally by scripts/sync-symbols.mjs and served from this origin. -->`
}
${FONTS}
${STYLES}
<style>${style}</style>
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
    <span class="kicker">Pokemon TCG &bull; ${main.length} English sets indexed</span>
    <h1>What set is my <span class="hl">card</span> from?</h1>
    <p class="lede" style="max-width:38em">The card already tells you, twice. There is a number at the bottom that reads
      something like 45/102, and a small symbol next to it. Type the number after the slash and this page will tell you
      which sets were printed at that size, with the symbol for each one so you can finish the job by eye.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / What set is my card from?</p>

    <div class="ws-tool">
      <label for="wsq">The number after the slash</label>
      <input id="wsq" type="search" inputmode="numeric" autocomplete="off" placeholder="102"
             aria-describedby="wshint wscount">
      <p class="ws-hint" id="wshint">Digits look up the set size. Letters search set and era names, so
        "neo" or "sword" works too. Leave it empty to see the whole index.</p>
      <p class="ws-count" id="wscount">${totals.length} set sizes, ${main.length} sets</p>
    </div>

    <ol class="ws-list" id="wslist">
${indexRows}
    </ol>
    <p class="ws-empty" id="wsnone" hidden>No English set was printed at that size. Two things it is usually:
      a promo card, which is numbered inside a running promo series rather than out of a set, or a Japanese card, whose
      sets are sized differently and are not in this index. Try the
      <a href="/expansions.html">full set list</a> or the <a href="/cards.html">card search</a>.</p>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Where to look</p>
    <h2>The corner <span class="hl">moved</span> in 2017</h2>
    <p class="lede" style="max-width:40em">Both the number and the symbol sit in the same bottom corner, and which corner
      that is depends on how old the card is. This trips people up because most guides get the date wrong.</p>
    <ul class="facts-list">
      <li><strong>Bottom right on cards up to the XY era.</strong> If the number and the symbol are on the right, you are
        holding something from 2016 or earlier.</li>
      <li><strong>Bottom left from Sun and Moon onward.</strong> The move happened in 2017, not at Scarlet and Violet,
        which is what you will usually be told. Our <a href="/rarity.html">rarity guide</a> shows both corners magnified
        on real cards.</li>
      <li><strong>The symbol is the tiebreaker, not the number.</strong> Of the ${totals.length} different set sizes in
        this index, ${unique.length} belong to exactly one set and ${shared.length} are shared by two or more. Every card
        printed at ${worst} could be from ${worstSets.length} different sets: ${worstSets
          .map((s) => `${esc(s.name)} (${esc(String(s.released).slice(0, 4))})`)
          .join(", ")}. The symbols are not alike, so once the number has narrowed it the picture finishes it.</li>
    </ul>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>199 out of 198</p>
    <h2>If the left number is <span class="hl">bigger</span></h2>
    <p class="lede" style="max-width:40em">A card numbered above its own set total is not a misprint and it is not fake.
      It is a secret rare, printed deliberately past the end of the checklist, and it is usually the reason anybody was
      opening the packs.</p>
    <div class="facts">
      ${/* withSecrets IS NOT HOW MANY CHECKLISTS WE HOLD. This label read "in the
            27 sets we hold full checklists for" while the same page, six
            paragraphs down, says the set guides "include 28 full guides".
            withSecrets counts guides with at least one secret rare; Celebrations
            has none, so the two numbers will always differ by however many sets
            stop at their printed total. Both are printed now, which is also the
            more interesting fact. */ ""}
      <div class="fact"><div class="n">${secretTotal.toLocaleString("en-US")}</div><div class="l">Cards numbered above their set total, across ${withSecrets.length} of the ${withGuide.length} sets we hold full checklists for</div></div>
      <div class="fact"><div class="n">${mostSecrets.secretCount}</div><div class="l">In ${esc(mostSecrets.name)} alone, the most of any set here</div></div>
      <div class="fact"><div class="n">${mostSecrets.printedTotal}</div><div class="l">Where ${esc(mostSecrets.name)} officially stops</div></div>
      <div class="fact"><div class="n">${mostSecrets.total}</div><div class="l">Where it actually stops</div></div>
    </div>
    <p style="max-width:40em;margin-top:16px">So the number after the slash still identifies the set even on a secret
      rare: ${esc(mostSecrets.name)} cards all read out of ${mostSecrets.printedTotal} whether they are card 12 or card
      ${mostSecrets.total}. Rows in the index above carry a badge saying how far past the printed total each set runs.
      What those cards are actually called is on the <a href="/rarity.html">rarity guide</a>, and what they are worth is
      on <a href="/cards.html">card search</a>.</p>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>When the number will not do it</p>
    <h2>Three cards this <span class="hl">will not</span> find</h2>
    <ul class="facts-list">
      <li><strong>Promo cards.</strong> ${promo.length} of the ${all.length} English sets in our data are promo runs,
        Black Star series, tins, trainer kits and tie-ins. Their cards are numbered inside the promo series rather than
        out of a set size, so there is often no slash at all. They are not in the index above for that reason. The
        <a href="/expansions.html">full set list</a> has all ${all.length}, promos included.</li>
      <li><strong>Japanese, Korean and Chinese cards.</strong> Different sets, different sizes, and a number that will
        either miss or match an English set it has nothing to do with. If the text is not in English, start from
        <a href="/sets/">the set guides</a>, which include ${withGuide.length} full guides and several imported sets.</li>
      <li><strong>Cards with the number rubbed off.</strong> It happens on played vintage. The symbol survives longer
        than the print does, so work from that and from the copyright line instead. If you are checking a card because
        something about it feels wrong, the <a href="/fake-cards.html">real or fake checks</a> are the better page.</li>
    </ul>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <h2>Where this <span class="hl">came from</span></h2>
    <ul class="facts-list">
      <li><strong>Set names, sizes, symbols and release dates.</strong> The Pokemon TCG API, synced
        ${esc(longDate(expansions.syncedAt) || expansions.syncedAt)}. The size used here is the API's printed total,
        which is the number printed on the card, not the number of cards that exist.</li>
      <li><strong>Secret rare counts.</strong> Counted from the full checklists this site holds for
        ${withSecrets.length} sets, as the difference between how many cards a set has and the total printed on them.</li>
      <li><strong>The symbols.</strong> The API's own artwork, copied here and shrunk to the size this page draws them
        at. They are small on the card too: a phone camera and a pinch zoom is the normal way to read one.</li>
      <li><strong>Nothing here is estimated.</strong> Every number on this page is counted from that list when the page
        is built, so it cannot drift from the index printed above it.</li>
    </ul>
    <p class="price-note">Fan made reference. Not affiliated with The Pokemon Company or Nintendo. Newest set in the
      index: ${esc(
        all
          .slice()
          .sort((a, b) => String(b.released).localeCompare(String(a.released)))[0].name,
      )}, ${esc(
        shortDate(all.slice().sort((a, b) => String(b.released).localeCompare(String(a.released)))[0].released),
      )}.</p>
  </div>
</section>

</main>
${footer(`Set list from the Pokemon TCG API, synced ${esc(longDate(expansions.syncedAt) || expansions.syncedAt)}.`)}
${APP_JS}
<script>${script}</script>
</body>
</html>
`;

await writeFile(join(ROOT, "public/what-set.html"), page);
console.log(`Wrote public/what-set.html
  ${all.length} sets indexed, ${main.length} main and ${promo.length} promo
  ${totals.length} distinct set sizes, ${unique.length} pointing at one set, ${shared.length} shared
  busiest size /${worst}, used by ${worstSets.length} sets
  ${secretTotal} cards above their set total across ${withSecrets.length} checklists`);
