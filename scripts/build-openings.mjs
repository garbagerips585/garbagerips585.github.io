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
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS } from "../shared/chrome.mjs";
import { esc, longDate, shortDate, moneyExact } from "../shared/format.mjs";
import { PRODUCT_TYPES, CARD_SETS } from "../shared/taxonomy.mjs";
import { ripLabel } from "../shared/riplabel.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/openings");
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const prod = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8"));

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

// What each kind usually contains, in our own words, stated ONCE and never as
// a fact about a particular set. See the blurb trap above.
const USUALLY = {
  etb: "An Elite Trainer Box is the big one: a stack of packs, a card box to keep them in, sleeves, dice, damage counters and a status marker. The pack count has changed over the years, so check the box you are actually buying.",
  "single-pack": "One booster pack, bought loose off a shelf or a peg.",
  bundle: "A Booster Bundle is a sleeve of packs and nothing else. No sleeves, no dice, no promo. It is usually the cheapest way to buy several packs at once.",
  "ex-premium": "A collection box built around one ex card, with a promo, an oversize card and a few packs.",
  "ex-box": "A smaller box built around one ex card, with a promo and a couple of packs.",
  upc: "An Ultra Premium Collection is the largest sealed product of a set: a big box with a lot of packs, a metal or oversize card and usually a full art promo.",
  tin: "A metal tin with a promo card and a few packs.",
  "poke-ball-tin": "A ball-shaped tin, usually with one or two packs and a coin or promo.",
  blister: "A hanging card with one to three packs and a promo, sold on a peg rather than a shelf.",
  "collection-box": "A themed box with promos and packs.",
  "japanese-pack": "A Japanese booster pack. Japanese sets are smaller and print differently from the English ones.",
  "korean-pack": "A Korean booster pack.",
  "chinese-pack": "A Chinese booster pack.",
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
  "collection-box": "What is in a collection box?",
  "japanese-pack": "What is in a Japanese booster pack?",
  "korean-pack": "What is in a Korean booster pack?",
  "chinese-pack": "What is in a Chinese booster pack?",
};

const LABEL = new Map(PRODUCT_TYPES.map((p) => [p.id, p.label]));

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
const pricesFor = (id) => {
  const kind = KIND[id];
  if (!kind) return [];
  const rows = [];
  for (const [sid, s] of Object.entries(prod.sets || {})) {
    const hit = (s.products || []).find((x) => x.kind === kind);
    if (hit && typeof hit.market === "number") {
      rows.push({ sid, name: s.tcgSet || sid, market: hit.market, low: hit.low, listings: hit.listings, url: hit.url });
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
function labelsFor(vids) {
  const base = new Map(
    vids.map((v) => {
      const setId = (v.sets || [])[0];
      return [v.id, ripLabel(v, SET_NAME, v.description) || v.siteTitle || v.title];
    })
  );
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
  return `        <li><a href="/${esc(v.path)}">${esc(label)}</a>
          <span>${bits.join(" &bull; ")}</span></li>`;
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
  }</td><td>${typeof r.listings === "number" ? r.listings : ""}</td></tr>`).join("\n")}
          </tbody>
        </table>
      </div>`;
};

const STYLE = `
.op-lede{max-width:46em}
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
  background:var(--navy);color:#F4F1E2;border-bottom:none}
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
<meta name="theme-color" content="#1E3A54">
<link rel="stylesheet" href="/assets/fonts.css">
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
  const desc =
    `${ask} What it holds, what it costs across ${e.prices.length || nSets} sets, and ${e.vids.length} of them opened on camera.`.slice(0, 158);

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
      <p class="op-note">That is what this kind of box usually holds. It is deliberately not stated per set,
        because the contents have changed between releases and we do not have a per set count we can stand
        behind. What we do have is what came out of the ones opened here, counted below.</p>

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
        e.packs ? `, ${e.packs} packs counted` : ""
      }. Each one plays on its own page.</p>
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
          <p>${esc((USUALLY[e.id] || "").split(". ")[0])}.</p>
          <span class="op-n">${e.vids.length} opened${e.packs ? ` &bull; ${e.packs} packs` : ""}</span>
        </a>`
  )
  .join("\n")}
      </div>
      <p class="op-note" style="margin-top:var(--s5)">Pack counts are what we counted in our own videos, not a
        figure off a box. Where a product's contents are not in our data, the page says so rather than guess.
        Prices come from TCGplayer, read ${esc(longDate(prod.checked))}.</p>
    </div>
  </section>
` +
  tail;

await writeFile(join(OUT, "index.html"), idx);

console.log(`Wrote public/openings/ with ${entries.length + 1} pages
  ${entries.length} product types, ${totalRips} openings, ${totalPacks} packs counted
  ${entries.filter((e) => e.prices.length).length} have a price table`);
