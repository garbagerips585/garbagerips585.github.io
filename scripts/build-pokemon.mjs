#!/usr/bin/env node
// Generate /pokemon/<name>.html, one page per chase Pokemon, plus an index.
//
//   node scripts/sync-cards.mjs    (first, writes the card data)
//   node scripts/build-pokemon.mjs (this)
//
// Every card of one Pokemon across all 23 sets, cheapest way in, dearest chase,
// and the rips that pulled one. Assembly, not new data: it all comes from
// public/data/cards/*.json.
//
// THE ROSTER IS PICKED BY THE DATA, NOT BY ME. Hand-picking "the popular ones"
// is how you end up with a page for something nobody searches and none for the
// card everyone wants. A Pokemon qualifies on having enough cards across enough
// sets to fill a page, and the roster is then ranked by its dearest card.
//
// THE TITLE SAYS "EVERY PRINTING WE PRICE", not "every set", and the
// difference is the point. These pages cover the 23 English sets the site
// holds prices for, so Flareon shows 4 cards from 2 sets while the printings
// corpus knows of far more. Promising every set and delivering two is the kind
// of over-claim that costs a page its credibility with the one reader who
// checks.
//
// AND IT IS DELIBERATELY SHORT. There are 457 species that clear the bar and
// 1,025 in the Pokedex. Generating all of them would be a thousand near-empty
// pages, which is the definition of thin content and the fastest way to teach
// a search engine to ignore the whole site. The cap is ${TOP}.
//
// Forms are folded into their species: Mega Charizard ex, Charizard ex and
// Charizard are all Charizard, and a Trainer's Pokemon (Team Rocket's Mewtwo,
// Iono's Bellibolt) files under the Pokemon, because that is what somebody
// searching the name is looking for.

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS } from "../shared/chrome.mjs";
import { esc, longDate, moneyExact, moneyRound, moneyCompact } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/pokemon");
const TOP = 30;
const MIN_CARDS = 4;
const MIN_SETS = 2;

const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

const cards = [];
let checked = null;
for (const f of await readdir(join(ROOT, "public/data/cards"))) {
  if (!f.endsWith(".json")) continue;
  const doc = JSON.parse(await readFile(join(ROOT, "public/data/cards", f), "utf8"));
  checked = checked || doc.checked;
  for (const c of doc.cards) cards.push({ ...c, set: doc.set, setName: doc.name });
}

/** "Mega Charizard ex" and "Team Rocket's Mewtwo" both come back "Charizard"/"Mewtwo". */
function speciesOf(name) {
  let n = String(name || "").trim();
  // A Trainer's Pokemon files under the Pokemon. Split on the LAST possessive so
  // two-word owners work too: "Team Rocket's Mewtwo" is one owner, not two.
  if (n.includes("'s ")) n = n.split("'s ").pop();
  n = n.replace(/\s+(ex|EX|V|VMAX|VSTAR|GX)$/, "");
  n = n.replace(/^Mega\s+/, "");
  return n.trim();
}

const slugify = (s) =>
  s.toLowerCase().replace(/['.:]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// EVERY PRINTING, not just the 23 sets we price.
//
// These pages used to show only cards from public/data/cards, which is the 23
// English sets the site holds prices for. Charizard came out at 21 cards; the
// printings corpus knows 133 across 71 sets, 107 of them with a verified scan.
// A page called "every printing" has to mean it.
//
// The join is dexId, which is why the corpus was built with it: a Japanese
// レックウザ and an English Rayquaza are the same species to PokeAPI, so a
// dex number gathers every language without matching on names at all.
//
// Prices still come from public/data/cards where we have them. A printing from
// a set we do not price shows its picture and no price, which is the truth.
// Keyed by SPECIES NAME, not by dex number, because our own card data carries
// no dex id to join on. The corpus already used dexId to turn レックウザ into
// Rayquaza, so by the time a printing lands here its `n` is the English name
// and speciesOf() reduces both sides the same way.
// The corpus carries its own read date, and the band below prints it. Without
// this the "Everywhere else" band was the one block on the page citing neither
// a source nor a date, while the priced band above it cited both.
const pChecked = JSON.parse(
  await readFile(join(ROOT, "public/data/printings/manifest.json"), "utf8"),
).checked;
const printings = new Map();
for (const f of await readdir(join(ROOT, "public/data/printings"))) {
  if (!f.endsWith(".json") || f === "manifest.json") continue;
  for (const c of JSON.parse(await readFile(join(ROOT, "public/data/printings", f), "utf8"))) {
    if (c.c !== "Pokemon" || c.u) continue; // skip Trainers, and untranslated names
    const sp = speciesOf(c.n);
    if (!sp) continue;
    if (!printings.has(sp)) printings.set(sp, []);
    printings.get(sp).push(c);
  }
}

const byName = new Map();
for (const c of cards) {
  if (c.cat !== "Pokemon") continue;
  const sp = speciesOf(c.name);
  if (!sp) continue;
  if (!byName.has(sp)) byName.set(sp, []);
  byName.get(sp).push(c);
}

const roster = [...byName.entries()]
  .map(([name, list]) => {
    const sets = new Set(list.map((c) => c.set));
    const priced = list.filter((c) => typeof c.price === "number");
    const dearest = priced.slice().sort((a, b) => b.price - a.price)[0] || null;
    const cheapest = priced.slice().sort((a, b) => a.price - b.price)[0] || null;
    return { name, slug: slugify(name), list, sets, dearest, cheapest, priced };
  })
  .filter((p) => p.list.length >= MIN_CARDS && p.sets.size >= MIN_SETS && p.dearest);

// MOST VALUABLE **AND** MOST POPULAR, which are not the same list.
//
// Ranking by dearest card alone is a value list: it surfaces whatever happens
// to carry an expensive chase card and misses species that are printed
// constantly and cheaply. Pikachu has 250 printings across the corpus and Eevee
// 153; both are obviously "popular Pokemon" and neither is guaranteed a slot by
// price.
//
// Printing count is the popularity signal, and it is a real one rather than a
// guess: it is how often The Pokemon Company has chosen to print that species
// across 388 sets. The two lists are taken separately and unioned, so the page
// set is genuinely "the most valuable and the most popular" rather than a
// blended score that satisfies neither description.
const printCount = (name) => (printings.get(name) || []).length;
const byValue = [...roster].sort((a, b) => b.dearest.price - a.dearest.price).slice(0, TOP);
const byPopularity = [...roster].sort((a, b) => printCount(b.name) - printCount(a.name)).slice(0, TOP);
const seen = new Set();
const chosen = [];
for (const p of [...byValue, ...byPopularity]) {
  if (seen.has(p.name)) continue;
  seen.add(p.name);
  chosen.push(p);
}
roster.length = 0;
roster.push(...chosen);

// THE MASCOTS ARE PINNED. The roster ranks by dearest card, which is the right
// default and would never surface either of these: Trubbish and Garbodor are
// commons worth pennies. They are also the channel's whole identity, the reason
// the site is called Garbage Rips, and the corpus gives them real pages rather
// than thin ones: Trubbish is 30 printings across 25 sets with 24 scans,
// Garbodor 39 across 28 with 33. Ranking by price would drop the two Pokemon
// the site is named after, which is the wrong answer however defensible the
// sort is.
const PINNED = ["Trubbish", "Garbodor"];
for (const name of PINNED) {
  if (roster.some((p) => p.name === name)) continue;
  const list = byName.get(name) || [];
  const priced = list.filter((c) => typeof c.price === "number");
  const bySets = new Set(list.map((c) => c.set));
  // A pinned Pokemon may have few or no cards in the 23 sets we price. That is
  // fine: the printings corpus carries the page, and the priced band simply
  // renders empty rather than the page not existing.
  roster.push({
    name,
    slug: slugify(name),
    list,
    sets: bySets,
    dearest: priced.slice().sort((a, b) => b.price - a.price)[0] || null,
    cheapest: priced.slice().sort((a, b) => a.price - b.price)[0] || null,
    priced,
    pinned: true,
  });
}

/** Rips that name this Pokemon in the title. */
const ripsFor = (name) => {
  // Both anchors. With only a leading \\b, /\\bMew/ matched every Mewtwo rip, and
  // Mew and Mewtwo are both on the roster. The trailing (?![a-z]) allows
  // "Charizard's" and "Charizards" while refusing "Mewtwo".
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`, "i");
  return videos.filter((v) => re.test(v.title));
};

const head = ({ title, desc, canonical, ld }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-pokemon.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-pokemon.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="preconnect" href="https://assets.tcgdex.net" crossorigin>
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
`;

function pokePage(p) {
  const url = `${SITE}/pokemon/${p.slug}.html`;
  const rips = ripsFor(p.name);
  const sorted = p.list
    .slice()
    .sort((a, b) => (b.price ?? -1) - (a.price ?? -1) || String(a.n).localeCompare(String(b.n)));
  const setCount = p.sets.size;

  const desc =
    `Every ${p.name} card across ${setCount} Pokemon TCG sets, ${p.list.length} in total, with current market ` +
    `prices. The dearest is ${p.dearest.name} in ${p.dearest.setName} at ${moneyExact(p.dearest.price)}.`;

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Pokemon", item: `${SITE}/pokemon/` },
        { "@type": "ListItem", position: 3, name: p.name },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${p.name} cards by value`,
      numberOfItems: sorted.length,
      itemListElement: sorted.slice(0, 20).map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${c.name} ${c.n} (${c.setName})`,
      })),
    },
  ];

  return head({ title: `${p.name} Cards and Prices: Every Printing We Price | Garbage Rips 585`, desc, canonical: url, ld }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Card Pokedex</span>
    <h1>${esc(p.name)} <span class="hl">cards</span></h1>
    <p class="lede" style="max-width:34em">Every ${esc(p.name)} card in the sets we rip, what each one is worth, and
      the cheapest way to get one.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / <a href="/pokemon/">Pokemon</a> / ${esc(p.name)}</p>
    <div class="facts">
      <div class="fact"><div class="n">${p.list.length}</div><div class="l">${esc(p.name)} cards</div></div>
      <div class="fact"><div class="n">${setCount}</div><div class="l">Sets they appear in</div></div>
      <div class="fact"><div class="n">${moneyRound(p.dearest.price)}</div><div class="l">Dearest one</div></div>
      ${p.cheapest ? `<div class="fact"><div class="n">${moneyExact(p.cheapest.price)}</div><div class="l">Cheapest way in</div></div>` : ""}
      ${rips.length ? `<a class="fact fact-link" href="/videos.html?q=${encodeURIComponent(p.name)}"><div class="n">${rips.length}</div><div class="l">Rips that mention one <span aria-hidden="true">&rarr;</span></div></a>` : ""}
    </div>
  </div>
</section>

${(() => {
  // Printings we do NOT price: every other set the card appears in, English or
  // Japanese. Deduped against what is already shown above by set and number so
  // a card we price is never listed twice.
  const have = new Set(sorted.map((c) => `${c.setName}|${String(c.n).replace(/^0+/, "")}`));
  const extra = (printings.get(p.name) || [])
    .filter((c) => !have.has(`${c.s}|${String(c.i).replace(/^0+/, "")}`))
    .sort((a, b) => String(a.s).localeCompare(String(b.s)) || String(a.i).localeCompare(String(b.i)));
  if (!extra.length) return "";
  const withArt = extra.filter((c) => c.g).length;
  return `<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Everywhere else</p>
    <h2>Every other <span class="hl">${esc(p.name)}</span> printing we could name</h2>
    <p class="lede" style="max-width:40em">${extra.length} more from sets we do not price, English and Japanese,
      ${withArt} with a scan. No price on these: we only quote what we can source. Printings whose name we could
      not translate are left out rather than shown under a name we guessed at.</p>
    <div class="chase-grid">
      ${extra
        .map(
          (c) => `<div class="chase-card is-flat">
        ${c.g ? `<img src="${esc(c.g)}/low.webp" onerror="this.remove()" alt="${esc(c.n)} ${esc(c.i)}, ${esc(c.s)}" loading="lazy" decoding="async" width="245" height="342">` : ""}
        <div class="nm">${esc(c.n)}</div>
        <div class="rr">${esc(c.s)} &bull; ${esc(c.i)}</div>
        ${c.r ? `<div class="rr">${esc(c.r)}</div>` : ""}
        ${c.l !== "en" ? `<div class="rr">${c.l === "ja" ? "Japanese" : "Chinese"}</div>` : ""}
      </div>`,
        )
        .join("\n      ")}
    </div>
    <p class="price-note">Card list from the TCGdex card database, read ${esc(longDate(pChecked) || pChecked)}.
      A snapshot, not a live feed.</p>
  </div>
</section>

`;
})()}<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Dearest first</p>
    <h2>Every <span class="hl">${esc(p.name)}</span></h2>
    <div class="chase-grid">
      ${sorted
        .map(
          (c) => `<button class="chase-card" type="button"
        data-img="${esc(c.img ? c.img + "/high.webp" : "")}"
        data-name="${esc(c.name)}" data-rarity="${esc(c.rarity || "")}"
        data-number="${esc(c.n || "")}" data-price="${esc(moneyCompact(c.price))}"
        data-set="${esc(c.setName)}"
        aria-label="Enlarge ${esc(c.name)}">
        ${c.img ? `<img src="${esc(c.img)}/low.webp" onerror="this.remove()" alt="${esc(c.name)} ${esc(c.n || "")}, ${esc(c.setName)}" loading="lazy" width="245" height="342">` : ""}
        <div class="nm">${esc(c.name)}</div>
        <div class="rr">${esc(c.setName)} &bull; ${esc(c.n || "")}</div>
        ${c.rarity ? `<div class="rr">${esc(c.rarity)}</div>` : ""}
        ${typeof c.price === "number" ? `<div class="pr">${moneyCompact(c.price)}</div>` : ""}
      </button>`
        )
        .join("\n      ")}
    </div>
    <p class="price-note">TCGplayer market prices via TCGdex, read ${esc(longDate(checked) || checked)}. Where a card
      comes as a normal, holo and reverse holo at different prices, the figure is the dearest of them. Prices move
      daily, so treat these as a ballpark. <a href="/cards.html?q=${encodeURIComponent(p.name)}">Search every card</a>.</p>
  </div>
</section>
${rips.length ? `
<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>See it opened</p>
    <h2>We went hunting <span class="hl">${rips.length}</span> times</h2>
    <ul class="poke-rips">
      ${rips.slice(0, 8).map((v) => `<li><a href="/${esc(v.path)}">${esc(v.title)}</a></li>`).join("\n      ")}
    </ul>
    ${rips.length > 8 ? `<p class="price-note"><a href="/videos.html?q=${encodeURIComponent(p.name)}">All ${rips.length} rips mentioning ${esc(p.name)}</a>.</p>` : ""}
  </div>
</section>` : ""}

<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Card image">
  <div class="lb-inner">
    <button class="lb-close" type="button" aria-label="Close">&times;</button>
    <img id="lbImg" src="" alt="">
    <p class="lb-nm" id="lbNm"></p>
    <p class="lb-rr" id="lbRr"></p>
    <p class="lb-pr" id="lbPr"></p>
  </div>
</div>

</main>
${footer("Card data from TCGdex, prices from TCGplayer. Fan made, not official.")}
<script>
(function(){
  var lb=document.getElementById('lb'), img=document.getElementById('lbImg'), last=null;
  function open(b){
    last=b;
    img.src=b.dataset.img; img.alt=b.dataset.name+' '+b.dataset.number;
    document.getElementById('lbNm').textContent=b.dataset.name;
    document.getElementById('lbRr').textContent=[b.dataset.set,b.dataset.rarity,b.dataset.number].filter(Boolean).join(' \u2022 ');
    document.getElementById('lbPr').textContent=b.dataset.price||'';
    lb.classList.add('on'); document.body.style.overflow='hidden';
    lb.querySelector('.lb-close').focus();
  }
  function close(){ lb.classList.remove('on'); document.body.style.overflow=''; if(last) last.focus(); }
  document.querySelectorAll('.chase-card').forEach(function(b){
    b.addEventListener('click',function(){ if(b.dataset.img) open(b); });
  });
  lb.addEventListener('click',function(e){ if(e.target===lb||e.target.closest('.lb-close')) close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&lb.classList.contains('on')) close(); });
})();
</script>
${APP_JS}
</body>
</html>
`;
}

function indexPage() {
  const url = `${SITE}/pokemon/`;
  const desc =
    `Every card for the ${roster.length} most valuable and most printed Pokemon in the modern sets, with current market prices. ` +
    `Charizard, Umbreon, Pikachu, Eevee and more.`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Pokemon" },
      ],
    },
  ];
  return head({ title: `Pokemon Card Values by Pokemon: Charizard, Umbreon, Pikachu | Garbage Rips 585`, desc, canonical: url, ld }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Card Pokedex</span>
    <h1>By <span class="hl">Pokemon</span></h1>
    <p class="lede" style="max-width:34em">Chasing one in particular? Every card of it across every set we rip, with
      what it is worth and the cheapest way to get one.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Pokemon</p>
    <div class="poke-grid">
      ${roster
        .map(
          (p) => `<a class="poke-card" href="/pokemon/${esc(p.slug)}.html">
        ${p.dearest.img ? `<img src="${esc(p.dearest.img)}/low.webp" onerror="this.remove()" alt="${esc(p.dearest.name)}, the most valuable ${esc(p.name)} card" loading="lazy" width="245" height="342">` : ""}
        <span class="poke-nm">${esc(p.name)}</span>
        <span class="poke-meta">${p.list.length} cards &bull; ${p.sets.size} sets</span>
        <span class="poke-pr">top ${moneyRound(p.dearest.price)}</span>
      </a>`
        )
        .join("\n      ")}
    </div>
    <p class="price-note">The ${roster.length} with the most valuable cards and the most printings in the sets we cover,
      ranked from the card data, plus the two the channel is named after. Anything else is on the
      <a href="/cards.html">card search</a>, which covers all ${cards.length.toLocaleString("en-US")}.</p>
  </div>
</section>

</main>
${footer("Card data from TCGdex, prices from TCGplayer. Fan made, not official.")}
${APP_JS}
</body>
</html>
`;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const p of roster) await writeFile(join(OUT, `${p.slug}.html`), pokePage(p));
await writeFile(join(OUT, "index.html"), indexPage());

// The search index the site-wide search reads for these pages.
await writeFile(
  join(ROOT, "public/data/pokemon-index.json"),
  JSON.stringify({
    checked,
    pokemon: roster.map((p) => ({
      name: p.name,
      slug: p.slug,
      cards: p.list.length,
      sets: p.sets.size,
      top: p.dearest.price,
    })),
  }) + "\n"
);

console.log(`Wrote ${roster.length} Pokemon pages + index to public/pokemon/`);
for (const p of roster.slice(0, 8)) {
  console.log(
    `  /pokemon/${p.slug}.html`.padEnd(34) +
      `${String(p.list.length).padStart(3)} cards, ${p.sets.size} sets, top ${moneyRound(p.dearest.price)}, ${ripsFor(p.name).length} rips`
  );
}
console.log(`  ... and ${roster.length - 8} more`);
