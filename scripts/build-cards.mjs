#!/usr/bin/env node
// Generate /cards.html, search across every card on the site.
//
//   node scripts/sync-cards.mjs   (first, writes the data)
//   node scripts/build-cards.mjs  (this)
//
// Reads public/data/card-index.json. 4,481 cards across 23 English sets.
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
import { BAR, MENU, SPRITE, SKIP, STYLES, footer } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const index = JSON.parse(await readFile(join(ROOT, "public/data/card-index.json"), "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));

const setName = index.sets || {};
const rows = index.cards || [];
const priced = rows.filter((r) => typeof r[4] === "number");
const top = priced.slice().sort((a, b) => b[4] - a[4]).slice(0, 60);

const money = (n) =>
  typeof n === "number"
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "";

const desc =
  `Search ${rows.length.toLocaleString("en-US")} Pokemon cards across ${Object.keys(setName).length} sets by name, ` +
  `with rarity and current TCGplayer market price. Updated ${longDate(index.checked) || index.checked}.`;

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Card search" },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Most valuable Pokemon cards across the sets we rip",
    itemListElement: top.slice(0, 20).map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${r[0]} ${r[2]} (${setName[r[1]] || r[1]})`,
    })),
  },
];

const row = (r) => {
  const [name, slug, n, rarity, price] = r;
  return `<li class="cq">
        <a class="cq-name" href="/sets/${esc(slug)}.html">${esc(name)}</a>
        <span class="cq-set">${esc(setName[slug] || slug)} &bull; ${esc(n || "")}</span>
        ${rarity ? `<span class="cq-rr">${esc(rarity)}</span>` : ""}
        ${typeof price === "number" ? `<span class="cq-pr">${money(price)}</span>` : ""}
      </li>`;
};

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pokemon Card Search: Prices for ${rows.length.toLocaleString("en-US")} Cards | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/cards.html">
<meta property="og:title" content="Search every Pokemon card we cover">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/cards.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Titan+One&family=Outfit:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
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
    <p class="lede" style="max-width:34em">Every card in every set we rip, ${rows.length.toLocaleString("en-US")} of them,
      with what they are actually going for. Type a name.</p>
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
    <p class="cq-head" id="cqHead">The 60 most valuable cards across every set we rip. Type above to search all ${rows.length.toLocaleString("en-US")}.</p>

    <p class="price-note">TCGplayer market prices via TCGdex, read ${esc(longDate(index.checked) || index.checked)}.
      Where a card comes as a normal, holo and reverse holo at different prices, the figure is the dearest of them.
      ${priced.length.toLocaleString("en-US")} of ${rows.length.toLocaleString("en-US")} cards have a price. Singles move
      fast, so treat these as a ballpark and not a quote. We do not sell cards.</p>
  </div>
</section>

</main>
${footer("Card data from TCGdex, prices from TCGplayer. Fan made, not official.")}
<script>
(function(){
  var input=document.getElementById('cq'), sel=document.getElementById('cset');
  var list=document.getElementById('cqList'), status=document.getElementById('cqStatus');
  var head=document.getElementById('cqHead');
  var DATA=null, LOADING=false, MAX=200;
  var initial=list.innerHTML;

  function money(n){
    return typeof n==='number' ? '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '';
  }
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
      var name=r[0], slug=r[1], n=r[2], rarity=r[3], price=r[4];
      // The url is built into a variable and then interpolated, so the markup
      // string never contains an href attribute followed by a literal path.
      // Inline, the build's broken-link check reads that prefix as a real link,
      // captures the JS concatenation as the target, and fails the nightly on a
      // page that was never meant to exist.
      var href='/sets/'+esc(slug)+'.html';
      return '<li class="cq">'
        + '<a class="cq-name" href="'+href+'">'+esc(name)+'</a>'
        + '<span class="cq-set">'+esc(DATA.sets[slug]||slug)+' • '+esc(n||'')+'</span>'
        + (rarity?'<span class="cq-rr">'+esc(rarity)+'</span>':'')
        + (typeof price==='number'?'<span class="cq-pr">'+money(price)+'</span>':'')
        + '</li>';
    }).join('');
    head.hidden=true;
    status.textContent = total>hits.length
      ? total.toLocaleString('en-US')+' matches, showing the '+hits.length+' dearest'
      : total.toLocaleString('en-US')+(total===1?' match':' matches');
  }

  function run(){
    var q=input.value.trim().toLowerCase(), set=sel.value;
    if(!q && !set){ list.innerHTML=initial; status.textContent=''; head.hidden=false; return; }
    if(!DATA){ load(run); return; }
    var hits=DATA.cards.filter(function(r){
      if(set && r[1]!==set) return false;
      return !q || r[0].toLowerCase().indexOf(q)!==-1;
    });
    // Dearest first: on a price list that is the order people want, and it also
    // makes the cap predictable rather than cutting off at whatever set is first.
    hits.sort(function(a,b){ return (b[4]||0)-(a[4]||0); });
    render(hits.slice(0,MAX), hits.length);
  }

  function load(then){
    if(LOADING) return;
    LOADING=true;
    status.textContent='Loading the card list...';
    fetch('/data/card-index.json').then(function(r){ return r.json(); }).then(function(j){
      DATA=j; LOADING=false; then&&then();
    }).catch(function(){
      LOADING=false;
      status.textContent='Could not load the card list. Reload the page and try again.';
    });
  }

  var t;
  input.addEventListener('input',function(){ clearTimeout(t); t=setTimeout(run,120); });
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
<script src="/assets/app.js" defer></script>
</body>
</html>
`;

await writeFile(join(ROOT, "public/cards.html"), page);
console.log(`Wrote public/cards.html
  ${rows.length} cards searchable across ${Object.keys(setName).length} sets
  ${priced.length} priced, ${top.length} rendered into the HTML
  dearest: ${top[0]?.[0]} ${top[0]?.[2]} (${setName[top[0]?.[1]]}) ${money(top[0]?.[4])}`);
