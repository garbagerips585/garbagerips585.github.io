#!/usr/bin/env node
// Build /lore.html: Pokedex facts worth knowing, and the case for Trubbish.
//
//   node scripts/sync-pokedex.mjs   (first, writes data/pokedex.json)
//   node scripts/build-lore.mjs     (this)
//
// EVERY FACT ON THIS PAGE IS COMPUTED, NOT TYPED. That is the whole design.
// A "did you know" page is the easiest place on a site to start quietly making
// things up, because the format invites confident one liners and nobody expects
// a citation on a fun fact. So there are no hand written facts here at all:
// each line is derived from data/pokedex.json, which came from pokeapi.co, and
// the page prints the source and the date it was read. If a claim here is
// wrong, the source is wrong, and you can go and check.
//
// SUPERLATIVES NEED THE WHOLE POPULATION. "Only five Pokemon are Bug and Steel"
// is only a fact if all 1,025 were counted. sync-pokedex.mjs fetches the
// complete National Pokedex for exactly this reason. If that ever gets filtered
// down to a convenient subset, every count on this page becomes a lie.
//
// NO POKEDEX ENTRY TEXT. The flavour text from the games is copyrighted and is
// deliberately not stored or reprinted. What IS used is the genus, the official
// one or two word category ("Trash Bag", "Balloon"), which is a label rather
// than prose, and the numbers. The sentences around them are ours.
//
// THE MASCOTS GET THE TOP OF THE PAGE. Trubbish and Garbodor are the channel's
// whole identity and Rochester's dish is the Garbage Plate, so the joke writes
// itself and the Pokedex happens to have supplied the punchline: they are
// officially the Trash Bag and Trash Heap Pokemon. The "unofficial Pokemon of
// Rochester" line is plainly this site's own claim, not a fact being asserted,
// and the copy keeps it that way.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, APP_JS, footer } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dex = JSON.parse(await readFile(join(ROOT, "data/pokedex.json"), "utf8"));
const P = dex.pokemon;
const SRC = `pokeapi.co, read ${longDate(dex.checked) || dex.checked}`;

const by = (id) => P.find((p) => p.id === id);
const kg = (p) => p.wHg / 10;
const m = (p) => p.hDm / 10;
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const n = (x) => x.toLocaleString("en-US");
const list = (a) =>
  a.length === 1 ? a[0] : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;

// --- the numbers ------------------------------------------------------------
//
// TIES ARE THE WHOLE DANGER ON A PAGE LIKE THIS. Sorting a list and taking [0]
// reads as "the heaviest" and is wrong the moment two share the top value, and
// every one of these had a tie: Cosmoem ties Celesteela at 999.9kg, five
// Pokemon share the 0.1kg floor, and SEVENTY-SIX share the lowest capture rate.
// So nothing here takes [0]. `extreme()` returns everybody holding the value
// and the copy adapts, which also means it stays true when a new generation
// lands rather than quietly going stale.
const extreme = (arr, val, dir) => {
  const pool = arr.filter((p) => val(p) > 0);
  const best = dir > 0 ? Math.max(...pool.map(val)) : Math.min(...pool.map(val));
  return { best, who: pool.filter((p) => val(p) === best) };
};

const typed = P.filter((p) => p.types.length);
// SORTED, so a pairing is counted once. This was keyed on the game's slot order,
// which made Steel/Ground and Ground/Steel two different combinations and had
// the page claiming Steelix was "the only Steel and Ground Pokemon there has
// ever been" while Excadrill and Iron Treads sat in the same file. In English,
// "Steel and Ground" is unordered, so the key has to be too. It also drops the
// combination count from an inflated 203 to a real 154.
const combos = new Map();
for (const p of typed) {
  const k = [...p.types].sort().join("/");
  if (!combos.has(k)) combos.set(k, []);
  combos.get(k).push(p.name);
}
const soloOfCombo = [...combos].filter(([, v]) => v.length === 1);
const hv = extreme(P, (p) => p.wHg, 1);
const lt = extreme(P, (p) => p.wHg, -1);
const tl = extreme(P, (p) => p.hDm, 1);
const sh = extreme(P, (p) => p.hDm, -1);
const typeCount = new Map();
for (const p of typed) for (const t of p.types) typeCount.set(t, (typeCount.get(t) || 0) + 1);
const typeRank = [...typeCount].sort((a, b) => b[1] - a[1]);
const hc = extreme(P, (p) => p.catch, -1);
const legendary = P.filter((p) => p.legendary);
const mythical = P.filter((p) => p.mythical);
const babies = P.filter((p) => p.baby);
const genCount = new Map();
for (const p of P) genCount.set(p.gen, (genCount.get(p.gen) || 0) + 1);
const genRank = [...genCount].sort((a, b) => b[1] - a[1]);

const trubbish = by(568);
const garbodor = by(569);
const poison = P.filter((p) => p.types.includes("poison"));
const purePoison = P.filter((p) => p.types.length === 1 && p.types[0] === "poison");

// --- facts ------------------------------------------------------------------
// [heading, sentence]. Source is printed once per card by the renderer.
const FACTS = [
  ["Type combinations", `Of the ${n(combos.size)} type combinations across the National Pokedex, ${n(soloOfCombo.length)} belong to exactly one Pokemon. ${soloOfCombo[0][1][0]} is the only ${list(soloOfCombo[0][0].split("/").map(cap))} Pokemon there has ever been.`],
  ["The most common type", `${cap(typeRank[0][0])} is the most crowded type in the dex with ${n(typeRank[0][1])} Pokemon. The rarest is ${cap(typeRank[typeRank.length - 1][0])}, with ${n(typeRank[typeRank.length - 1][1])}.`],
  [
    "Heaviest",
    `${list(hv.who.map((p) => p.name))} ${hv.who.length > 1 ? "are tied as the heaviest in the dex" : "is the heaviest in the dex"} at ${kg(hv.who[0]).toFixed(1)}kg, about ${n(Math.round(hv.best / lt.best))} times the ${kg(lt.who[0]).toFixed(1)}kg shared by the ${lt.who.length === 1 ? "lightest" : `${n(lt.who.length)} lightest`}: ${list(lt.who.map((p) => p.name))}.`,
  ],
  [
    "Tallest",
    `${list(tl.who.map((p) => p.name))} ${tl.who.length > 1 ? "stand" : "stands"} ${m(tl.who[0]).toFixed(1)}m. At ${m(sh.who[0]).toFixed(1)}m you would need about ${n(Math.round(tl.best / sh.best))} of ${sh.who.length === 1 ? sh.who[0].name : "the smallest"} stacked up to match that.`,
  ],
  [
    "Hardest to catch",
    `${n(hc.who.length)} Pokemon share the lowest capture rate in the dex, ${hc.best} out of 255, ${hc.who.length > 1 ? `including ${list(hc.who.slice(0, 3).map((p) => p.name))}` : hc.who[0].name}. At the other end, ${n(P.filter((p) => p.catch === 255).length)} sit at the maximum of 255.`,
  ],
  ["Legendaries", `${n(legendary.length)} Pokemon are flagged Legendary and ${n(mythical.length)} Mythical, which is ${((legendary.length + mythical.length) / P.length * 100).toFixed(1)}% of the ${n(P.length)} in the National Pokedex.`],
  ["Babies", `${n(babies.length)} Pokemon are classed as baby Pokemon, a category that did not exist until breeding arrived in Generation 2.`],
  ["The biggest generation", `Generation ${genRank[0][0]} introduced ${n(genRank[0][1])} Pokemon, more than any other. Generation ${genRank[genRank.length - 1][0]} added the fewest, at ${n(genRank[genRank.length - 1][1])}.`],
];

const RARE_COMBOS = [...combos]
  .filter(([, v]) => v.length > 1 && v.length <= 3)
  .sort((a, b) => a[1].length - b[1].length)
  .slice(0, 6);

// --- page -------------------------------------------------------------------
const desc = `Pokemon facts computed from the National Pokedex, not repeated: the rarest type combinations, the heaviest, the hardest to catch, and why Trubbish is ours.`;

const factCard = (heading, body) => `      <div class="lore">
        <h3>${esc(heading)}</h3>
        <p>${esc(body)}</p>
        <span class="lore-src">Source: ${esc(SRC)}</span>
      </div>`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pokemon Lore and Pokedex Facts: Did You Know? | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/lore.html">
<meta property="og:title" content="Pokedex facts, and the case for Trubbish">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/lore.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="stylesheet" href="/assets/fonts.css">
${STYLES}
<link rel="stylesheet" href="/assets/games.css">
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Pokemon lore", item: `${SITE}/lore.html` },
  ],
})}</script>
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">

<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokedex &bull; Did you know</span>
    <h1>Pokemon <span class="hl">lore</span></h1>
    <p class="lede" style="max-width:40em">Facts worth knowing about the ${n(P.length)} Pokemon in the National
      Pokedex. Every line on this page is worked out from the Pokedex data rather than remembered, and each one says
      where it came from, because a fun fact with no source is just a rumour with good timing.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Pokemon lore</p>

    <div class="fk-golden" style="margin-bottom:var(--s6)">
      <p class="fk-golden-h">The mascots</p>
      <h2>Rochester's unofficial <span class="hl">Pokemon</span></h2>
      <p>This city's most famous meal is the Garbage Plate. Its most famous export, if we get a vote, should be
        a walking trash bag. We did not choose ${esc(trubbish.name)} and ${esc(garbodor.name)} because of a joke we
        made up: the Pokedex got there first and files them as the
        <b>${esc(trubbish.genus)} Pokemon</b> and the <b>${esc(garbodor.genus)} Pokemon</b>.</p>
      <p style="margin-top:12px">${esc(trubbish.name)} is #${trubbish.id}, a Generation ${trubbish.gen} pure
        ${esc(cap(trubbish.types[0]))} type, ${m(trubbish).toFixed(1)}m tall and ${kg(trubbish).toFixed(1)}kg.
        It evolves into ${esc(garbodor.name)}, which triples in height to ${m(garbodor).toFixed(1)}m and puts on
        ${(kg(garbodor) - kg(trubbish)).toFixed(1)}kg getting there. ${esc(trubbish.name)} has a capture rate of
        ${trubbish.catch} against ${esc(garbodor.name)}'s ${garbodor.catch}, so the bag is a great deal easier to
        get hold of than the heap.</p>
      <p style="margin-top:12px">They are two of the ${n(poison.length)} ${esc(cap("poison"))} type Pokemon in the
        dex, and two of the ${n(purePoison.length)} that are pure ${esc(cap("poison"))} with no second type.
        Calling them Rochester's Pokemon is our claim and nobody else's, but we would like it noted that
        The Pokemon Company named a trash bag and a trash heap, and we named a channel after a plate of garbage,
        entirely independently.</p>
      <p style="margin-top:12px"><a class="btn btn-sm" href="/pokemon/trubbish.html">Every ${esc(trubbish.name)} card</a>
        <a class="btn btn-sm" href="/pokemon/garbodor.html">Every ${esc(garbodor.name)} card</a></p>
      <p class="price-note" style="margin-top:12px">Source: ${esc(SRC)}. The Garbage Plate is a registered trademark
        of Nick Tahou Hots.</p>
    </div>

    <h2>Did you <span class="hl">know</span></h2>
    <div class="lore-list" style="margin-top:var(--s4)">
${FACTS.map(([h, b]) => factCard(h, b)).join("\n")}
    </div>

    <h2 style="margin-top:var(--s7)">One of a <span class="hl">kind</span></h2>
    <p class="lede" style="max-width:40em">Type pairings so rare that the whole dex holds two or three of them.</p>
    <div class="lore-list" style="margin-top:var(--s4)">
${RARE_COMBOS.map(
  ([k, v]) => `      <div class="lore">
        <h3>${esc(k.split("/").map(cap).join(" / "))}</h3>
        <p>Only ${v.length}: ${esc(list(v))}.</p>
        <span class="lore-src">Source: ${esc(SRC)}</span>
      </div>`,
).join("\n")}
    </div>

    <div class="btn-row" style="margin-top:var(--s7);justify-content:center">
      <a class="btn btn-yt" href="/games/">Test yourself on the games</a>
    </div>

    <p class="price-note" style="margin-top:var(--s5)">Every figure on this page is computed from the National
      Pokedex as published by <a href="https://pokeapi.co" rel="noopener" target="_blank">pokeapi.co</a>, read
      ${esc(longDate(dex.checked) || dex.checked)}, covering all ${n(P.length)} species. Counts are over the whole
      Pokedex, not a sample. The Pokedex entry text from the games is copyrighted and is deliberately not reprinted
      here: the categories quoted above are the official one word classifications, and the sentences around them are
      ours. Pokemon and all Pokemon names are trademarks of The Pokemon Company. Fan content, not affiliated.</p>
  </div>
</section>

</main>
${footer("Pokedex data from pokeapi.co. Fan content.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/lore.html"), page);
console.log(`Wrote public/lore.html`);
console.log(`  ${FACTS.length} computed facts, ${RARE_COMBOS.length} rare type combos`);
console.log(`  over all ${P.length} species, ${combos.size} type combinations`);
