#!/usr/bin/env node
// Generate /search.html and the index behind it.
//
//   node scripts/build-search.mjs   (run AFTER the pages it indexes)
//
// The bar search used to post to /videos.html, so it searched 310 rips and
// nothing else. That was right when rips were the whole site. It now sits above
// 4,481 cards, 36 set guides, 30 Pokemon pages and a dozen reference pages, and
// typing "umbreon" into it and getting only videos undersold everything else.
//
// TWO INDEXES, LOADED SEPARATELY, ON PURPOSE. The site index (rips, guides,
// sets, Pokemon) is small and loads immediately. The card index is 47KB gzipped
// and only loads when the query looks like it might be a card, or when the
// visitor asks for card results. Most searches never need it.
//
// Results are grouped rather than blended into one relevance-ranked list,
// because a card, a video and a guide are not competing answers to the same
// question. Somebody searching "charizard" may want any of the three, and a
// blended list buries two of them under whichever matched a string better.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer } from "../shared/chrome.mjs";
import { esc } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));

let intl = {};
try {
  intl = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {};
} catch {
  /* optional */
}
let pokemon = [];
try {
  pokemon = JSON.parse(await readFile(join(ROOT, "public/data/pokemon-index.json"), "utf8")).pokemon || [];
} catch {
  /* optional */
}

// The reference pages, named here because a page has no other machine-readable
// title. Kept in one list so a new page is one line rather than a grep.
const PAGES = [
  ["/start.html", "Start here", "New to Pokemon cards, the six questions in order"],
  ["/cards.html", "Card search", "Every card by name with current prices"],
  ["/pokemon/", "Browse by Pokemon", "Every card of one Pokemon across every set"],
  ["/sets/", "Set guides", "Card counts, rarities and chase cards per set"],
  ["/rarity.html", "Rarity guide", "What the symbols mean and what is actually rare"],
  ["/fake-cards.html", "Real or fake?", "Seven checks for spotting a counterfeit"],
  ["/grading.html", "Worth grading?", "What grading costs and whether it pays"],
  ["/luck.html", "Luck and pull rates", "What actually comes out of the packs"],
  ["/upcoming.html", "Coming next", "Upcoming sets and preorder prices"],
  ["/expansions.html", "Every set ever", "The complete expansion list"],
  ["/hall.html", "Hall of Fame", "The best pulls on the channel"],
  ["/collection.html", "The collection", "The personal collection and portfolio"],
  ["/wanted.html", "Most wanted", "The cards still being chased"],
  ["/card-shows.html", "Card shows", "Shows around Rochester, Buffalo and Syracuse"],
  ["/shops.html", "Card shops and where to play", "Local shops and league nights"],
  ["/videos.html", "All rips", "The full video library"],
  ["/playlists.html", "Playlists", "Rips grouped into playlists"],
  ["/about.html", "About", "Who this is and why"],
];

// [title, url, sub] for everything except cards.
const index = {
  pages: PAGES.map(([url, title, sub]) => [title, url, sub]),
  sets: [
    ...sets.map((s) => [s.name, `/sets/${s.id}.html`, `${s.total || "?"} cards${s.released ? ` • ${s.released.slice(0, 4)}` : ""}`]),
    ...Object.entries(intl).map(([id, g]) => [
      g.english,
      `/sets/${id}.html`,
      `${g.langName}${g.native ? ` • ${g.native}` : ""}`,
    ]),
  ],
  pokemon: pokemon.map((p) => [p.name, `/pokemon/${p.slug}.html`, `${p.cards} cards across ${p.sets} sets`]),
  rips: videos.map((v) => [v.title, `/${v.path}`, v.published]),
};

await writeFile(join(ROOT, "public/data/site-index.json"), JSON.stringify(index) + "\n");

const total =
  index.pages.length + index.sets.length + index.pokemon.length + index.rips.length;

const desc = `Search everything on Garbage Rips 585: ${index.rips.length} pack openings, 4,481 cards, ${index.sets.length} set guides and every reference page.`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Search | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/search.html">
<meta name="robots" content="noindex,follow">
<meta property="og:title" content="Search Garbage Rips 585">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/search.html">
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
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Search</p>
    <h1 class="sr-h1">Search</h1>
    <form class="cardsearch" role="search" onsubmit="return false">
      <label class="sr-only" for="sq">Search the site</label>
      <input id="sq" type="search" placeholder="Umbreon, Pitch Black, grading, card shows..." autocomplete="off" enterkeyhint="search" autofocus>
    </form>
    <p class="cq-status" id="sqStatus" aria-live="polite"></p>
    <div id="sqOut"></div>
    <div id="sqEmpty">
      <p class="cq-head">Searches ${index.rips.length} pack openings, 4,481 cards, ${index.sets.length} set guides,
        ${index.pokemon.length} Pokemon and every guide on the site.</p>
      <div class="set-index" style="margin-top:var(--s5)">
        ${PAGES.slice(0, 8)
          .map(
            ([url, title, sub]) => `<a class="set-card" href="${esc(url)}">
          <span><span class="ttl">${esc(title)}</span><br><span class="meta">${esc(sub)}</span></span>
        </a>`
          )
          .join("\n        ")}
      </div>
    </div>
  </div>
</section>

</main>
${footer()}
<script>
(function(){
  var input=document.getElementById('sq');
  var out=document.getElementById('sqOut'), status=document.getElementById('sqStatus');
  var empty=document.getElementById('sqEmpty');
  var SITE=null, CARDS=null, cardsTried=false;

  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function money(n){
    return typeof n==='number' ? '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '';
  }

  function group(title, rows, more){
    if(!rows.length) return '';
    return '<section class="sg"><h2>'+esc(title)+'</h2><ol class="cq-list">'
      + rows.join('')
      + '</ol>'+(more?'<p class="price-note">'+esc(more)+'</p>':'')+'</section>';
  }
  function row(title, url, sub, right){
    return '<li class="cq">'
      + '<a class="cq-name" href="'+esc(url)+'">'+esc(title)+'</a>'
      + (sub?'<span class="cq-set">'+esc(sub)+'</span>':'')
      + (right?'<span class="cq-pr">'+right+'</span>':'')
      + '</li>';
  }

  function hits(list, q, limit){
    var out=[];
    for(var i=0;i<list.length && out.length<limit;i++){
      if(list[i][0].toLowerCase().indexOf(q)!==-1) out.push(list[i]);
    }
    return out;
  }

  function render(){
    var q=input.value.trim().toLowerCase();
    if(!q){ out.innerHTML=''; status.textContent=''; empty.hidden=false; return; }
    empty.hidden=true;
    if(!SITE){ status.textContent='Loading...'; return; }

    var html='';
    var n=0;

    var p=hits(SITE.pages,q,6); n+=p.length;
    html+=group('Guides and pages', p.map(function(r){ return row(r[0],r[1],r[2]); }));

    var s=hits(SITE.sets,q,8); n+=s.length;
    html+=group('Set guides', s.map(function(r){ return row(r[0],r[1],r[2]); }));

    var k=hits(SITE.pokemon,q,8); n+=k.length;
    html+=group('Pokemon', k.map(function(r){ return row(r[0],r[1],r[2]); }));

    if(CARDS){
      var c=[];
      for(var i=0;i<CARDS.cards.length;i++){
        var r=CARDS.cards[i];
        if(r[0].toLowerCase().indexOf(q)!==-1) c.push(r);
      }
      c.sort(function(a,b){ return (b[4]||0)-(a[4]||0); });
      n+=c.length;
      html+=group('Cards', c.slice(0,10).map(function(r){
        return row(r[0], '/sets/'+r[1]+'.html', (CARDS.sets[r[1]]||r[1])+' • '+r[2], money(r[4]));
      }), c.length>10 ? c.length+' cards matched, showing the 10 dearest. Search them all on the card search page.' : '');
    }

    var v=hits(SITE.rips,q,10); n+=v.length;
    html+=group('Pack openings', v.map(function(r){ return row(r[0],r[1],r[2]); }));

    out.innerHTML = html || '<p class="cq-head">Nothing matched. Try a Pokemon name, a set name, or a word from a video title.</p>';
    status.textContent = n ? n.toLocaleString('en-US')+' result'+(n===1?'':'s') : '';
  }

  function load(url, then){
    return fetch(url).then(function(r){ return r.json(); }).then(then).catch(function(){});
  }

  load('/data/site-index.json', function(j){ SITE=j; render(); });
  // The card index is the big one, so it only loads once somebody has typed
  // enough to plausibly mean a card. Most searches never pull it.
  input.addEventListener('input', function(){
    if(!cardsTried && input.value.trim().length>=3){
      cardsTried=true;
      load('/data/card-index.json', function(j){ CARDS=j; render(); });
    }
  });

  var t;
  input.addEventListener('input', function(){ clearTimeout(t); t=setTimeout(render,120); });

  var p=new URLSearchParams(location.search).get('q');
  if(p){
    input.value=p;
    if(p.trim().length>=3){ cardsTried=true; load('/data/card-index.json', function(j){ CARDS=j; render(); }); }
  }
})();
</script>
<script src="/assets/app.js" defer></script>
</body>
</html>
`;

await writeFile(join(ROOT, "public/search.html"), page);
console.log(`Wrote public/search.html and public/data/site-index.json
  ${index.rips.length} rips, ${index.sets.length} set guides, ${index.pokemon.length} Pokemon, ${index.pages.length} pages
  ${total} entries in the site index, plus 4,481 cards loaded on demand`);
