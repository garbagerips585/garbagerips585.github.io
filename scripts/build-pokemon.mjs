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
import { BAR, MENU, SPRITE, SKIP, STYLES, footer } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";

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
  .filter((p) => p.list.length >= MIN_CARDS && p.sets.size >= MIN_SETS && p.dearest)
  .sort((a, b) => b.dearest.price - a.dearest.price)
  .slice(0, TOP);

/** Rips that name this Pokemon in the title. */
const ripsFor = (name) => {
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  return videos.filter((v) => re.test(v.title));
};

const money = (n) =>
  typeof n === "number"
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "";
const money0 = (n) => (typeof n === "number" ? `$${Math.round(n).toLocaleString("en-US")}` : "");

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
<meta property="og:image" content="${SITE}/assets/og-image.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg?v=2">
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
    `prices. The dearest is ${p.dearest.name} in ${p.dearest.setName} at ${money(p.dearest.price)}.`;

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

  return head({ title: `${p.name} Cards: Every Set and What They Are Worth | Garbage Rips 585`, desc, canonical: url, ld }) + `
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
      <div class="fact"><div class="n">${money0(p.dearest.price)}</div><div class="l">Dearest one</div></div>
      ${p.cheapest ? `<div class="fact"><div class="n">${money(p.cheapest.price)}</div><div class="l">Cheapest way in</div></div>` : ""}
      ${rips.length ? `<a class="fact fact-link" href="/videos.html?q=${encodeURIComponent(p.name)}"><div class="n">${rips.length}</div><div class="l">Rips that mention one <span aria-hidden="true">&rarr;</span></div></a>` : ""}
    </div>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Dearest first</p>
    <h2>Every <span class="hl">${esc(p.name)}</span></h2>
    <ol class="cq-list">
      ${sorted
        .map(
          (c) => `<li class="cq">
        <a class="cq-name" href="/sets/${esc(c.set)}.html">${esc(c.name)}</a>
        <span class="cq-set">${esc(c.setName)} &bull; ${esc(c.n || "")}</span>
        ${c.rarity ? `<span class="cq-rr">${esc(c.rarity)}</span>` : ""}
        ${typeof c.price === "number" ? `<span class="cq-pr">${money(c.price)}</span>` : ""}
      </li>`
        )
        .join("\n      ")}
    </ol>
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

</main>
${footer("Card data from TCGdex, prices from TCGplayer. Fan made, not official.")}
<script src="/assets/app.js" defer></script>
</body>
</html>
`;
}

function indexPage() {
  const url = `${SITE}/pokemon/`;
  const desc =
    `Every card for the ${roster.length} most valuable Pokemon in the modern sets, with current market prices. ` +
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
    <div class="set-index">
      ${roster
        .map(
          (p) => `<a class="set-card" href="/pokemon/${esc(p.slug)}.html">
        <span>
          <span class="ttl">${esc(p.name)}</span><br>
          <span class="meta">${p.list.length} cards &bull; ${p.sets.size} sets &bull; top ${money0(p.dearest.price)}</span>
        </span>
      </a>`
        )
        .join("\n      ")}
    </div>
    <p class="price-note">These are the ${roster.length} with the most valuable cards in the sets we cover, picked from
      the card data rather than by hand. Anything else is on the
      <a href="/cards.html">card search</a>, which covers all 4,481.</p>
  </div>
</section>

</main>
${footer("Card data from TCGdex, prices from TCGplayer. Fan made, not official.")}
<script src="/assets/app.js" defer></script>
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
      `${String(p.list.length).padStart(3)} cards, ${p.sets.size} sets, top ${money0(p.dearest.price)}, ${ripsFor(p.name).length} rips`
  );
}
console.log(`  ... and ${roster.length - 8} more`);
