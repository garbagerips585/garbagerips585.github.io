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
// NO POKEDEX ENTRY TEXT. The flavor text from the games is copyrighted and is
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
import { esc, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dex = JSON.parse(await readFile(join(ROOT, "data/pokedex.json"), "utf8"));
const P = dex.pokemon;
const SRC = `pokeapi.co, read ${longDate(dex.checked) || dex.checked}`;

// The mirrored official artwork, written by scripts/sync-dex-art.mjs. Missing is
// a supported state: every portrait falls back to the site's hatched no-art box
// in the same footprint, so the page never grows a hole and never substitutes a
// different Pokemon for one it does not hold.
let ART = {};
try {
  ART = JSON.parse(await readFile(join(ROOT, "data/dex-art.json"), "utf8")).art || {};
} catch { /* run: node scripts/sync-dex-art.mjs */ }
const missingArt = new Set();

/**
 * One Pokemon portrait, or the hatched box.
 *
 * LOOKED UP BY DEX ID, NEVER BY POSITION IN A LIST. The facts on this page are
 * computed, so who "the heaviest" is can change under the mirror; asking for
 * art by the id of the Pokemon the sentence is about means the worst case is a
 * hatched box next to a correct sentence, rather than Celesteela's name over
 * somebody else's picture. The alt is the Pokemon's own name for the same
 * reason: it is read off the same record the sentence is.
 */
// `eager` IS FOR A PORTRAIT IN THE FIRST SCREEN. Measured over CDP at 390x844
// DPR 2, reading each img's own border box at scroll 0: the Trubbish and
// Garbodor pair at 132px sit at y=752, inside the 844px viewport, and they are
// the only two artworks a reader sees without scrolling. `loading="lazy"` is a
// vertical heuristic, so both were fetched at first paint anyway; the attribute
// only cost them the preload scanner. Every other portrait on the page keeps it.
const portrait = (p, px = 64, eager = false) => {
  const a = ART[String(p.id)];
  if (!a) {
    missingArt.add(`${p.id} ${p.name}`);
    return `<span class="dexart dexart-none" style="--px:${px}px" role="img" aria-label="No artwork held for ${esc(p.name)}"></span>`;
  }
  // alt="" AND IT IS SAFE AT EVERY CALL SITE: all three of them wrap this in a
  // <figure> whose <figcaption> is the Pokemon's name, so the alt was the same
  // word twice in a row. On /lore.html that was 18 portraits reading e.g.
  // "Tyranitar" (image) then "Tyranitar" (caption). The dexart-none branch
  // above keeps its aria-label, because "No artwork held for X" tells a
  // listener something the caption does not.
  return `<img class="dexart" style="--px:${px}px" src="${esc(a.file)}" width="${a.w}" height="${a.h}"` +
    ` alt=""${eager ? "" : ` loading="lazy"`} decoding="async">`;
};

/** A row of portraits with the Pokemon's name under each. */
const portraits = (arr, px = 64) =>
  `<div class="dexrow">${arr
    .map((p) => `<figure class="dexfig">${portrait(p, px)}<figcaption>${esc(p.name)}</figcaption></figure>`)
    .join("")}</div>`;

const by = (id) => P.find((p) => p.id === id);
// The combination and solo-type maps hold NAMES, because that is what their
// sentences print. The portraits need the whole record, so this reads it back.
const byName = (nm) => P.find((p) => p.name === nm);
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


/**
 * An exact height comparison between two Pokemon, drawn rather than photographed.
 *
 * The copy above it says Garbodor "triples in height". This is that sentence as
 * a picture, and it is honest in a way scaling the artwork is not: the bars are
 * geometry drawn straight from hDm, so the ratio on screen IS the ratio in the
 * data. A metre rule sits behind them because "one bar is three times another"
 * means nothing without a unit, and the tallest bar sets the scale so the figure
 * stays correct if a future dex entry changes either height.
 *
 * currentColor and the site's tokens throughout, no fills that assume a light or
 * a dark ground, and aria-hidden with the numbers already in the prose above:
 * a screen reader gets the sentence, not a description of a rectangle.
 */
function heightBars(a, b) {
  const H = 132, W = 300, PAD = 26, base = H - 16;
  const top = Math.max(m(a), m(b));
  const ceil = Math.ceil(top);                 // whole metres, so the rule is readable
  const y = (v) => base - (v / ceil) * (base - 10);
  // EVERY STROKE AND EVERY LABEL IS currentColor, NOT var(--ink). This figure
  // sits inside .fk-golden, which is the site's dark band, and the first version
  // drew the two value labels in --ink on near-black: the numbers the whole
  // picture exists to state were invisible, and the bars still looked fine, so
  // nothing about the page said it was broken. currentColor inherits from
  // whatever the figure is dropped into, so moving this block to a light section
  // later cannot reintroduce it. Only the bar fill is a fixed token, because
  // gold is legible on both grounds and is the site's accent.
  const rules = [];
  for (let i = 1; i <= ceil; i++) {
    rules.push(
      `<line x1="${PAD - 6}" y1="${y(i)}" x2="${W}" y2="${y(i)}" stroke="currentColor" stroke-width="1" opacity=".28"/>` +
      `<text x="0" y="${y(i) + 4}" font-size="10" fill="currentColor" opacity=".75" font-family="var(--mono)">${i}m</text>`
    );
  }
  // THE CLASS IS lore-bar AND NOT bar, WHICH THE PROTOTYPE USED. `.bar` is this
  // site's sticky navigation header in assets-source/ui.css, at (0,1,0) with a
  // position, a z-index, a background and a colour on it. Nothing it declares
  // paints on an SVG rect, so this would have looked correct forever and been a
  // trap for whoever next read either rule. Name a class for the page it is on.
  const bar = (p, x) => {
    const h = base - y(m(p));
    return `<rect class="lore-bar" x="${x}" y="${y(m(p))}" width="66" height="${h}" rx="3" fill="var(--gold)"/>` +
      `<text x="${x + 33}" y="${y(m(p)) - 7}" text-anchor="middle" font-size="12" font-weight="700"` +
      ` fill="currentColor" font-family="var(--mono)">${m(p).toFixed(1)}m</text>` +
      `<text x="${x + 33}" y="${base + 13}" text-anchor="middle" font-size="10"` +
      ` fill="currentColor" opacity=".75" font-family="var(--mono)">${esc(p.name.toUpperCase())}</text>`;
  };
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true" focusable="false">
      ${rules.join("")}
      <line x1="${PAD - 6}" y1="${base}" x2="${W}" y2="${base}" stroke="currentColor" stroke-width="1.5"/>
      ${bar(a, PAD + 30)}${bar(b, PAD + 130)}
    </svg>`;
}

// --- facts ------------------------------------------------------------------
// [heading, sentence]. Source is printed once per card by the renderer.
// [heading, sentence, the Pokemon the sentence NAMES].
//
// THE THIRD FIELD IS DERIVED FROM THE SAME VARIABLES THE SENTENCE IS, never
// typed out beside it. That is the only thing stopping a portrait and a name
// drifting apart: if a new generation makes somebody else the tallest, the
// sentence and the picture change together because both read `tl.who`.
//
// FOUR FACTS NAME NOBODY and get no portrait, which is correct rather than a
// gap. "Water is the most crowded type with 154" is about a set of 154 Pokemon,
// and any one of them stood next to that sentence would be an illustration of a
// different claim. Same for the legendary share, the baby count and the
// generation sizes. A picture that is only decoration is the thing this pass is
// supposed to be removing, not adding.
const FACTS = [
  ["Type combinations", `Of the ${n(combos.size)} type combinations across the National Pokedex, ${n(soloOfCombo.length)} belong to exactly one Pokemon. ${soloOfCombo[0][1][0]} is the only ${list(soloOfCombo[0][0].split("/").map(cap))} Pokemon there has ever been.`, [byName(soloOfCombo[0][1][0])]],
  ["The most common type", `${cap(typeRank[0][0])} is the most crowded type in the dex with ${n(typeRank[0][1])} Pokemon. The rarest is ${cap(typeRank[typeRank.length - 1][0])}, with ${n(typeRank[typeRank.length - 1][1])}.`],
  [
    "Heaviest",
    `${list(hv.who.map((p) => p.name))} ${hv.who.length > 1 ? "are tied as the heaviest in the dex" : "is the heaviest in the dex"} at ${kg(hv.who[0]).toFixed(1)}kg, about ${n(Math.round(hv.best / lt.best))} times the ${kg(lt.who[0]).toFixed(1)}kg shared by the ${lt.who.length === 1 ? "lightest" : `${n(lt.who.length)} lightest`}: ${list(lt.who.map((p) => p.name))}.`,
    [...hv.who, ...lt.who],
  ],
  [
    "Tallest",
    `${list(tl.who.map((p) => p.name))} ${tl.who.length > 1 ? "stand" : "stands"} ${m(tl.who[0]).toFixed(1)}m. At ${m(sh.who[0]).toFixed(1)}m you would need about ${n(Math.round(tl.best / sh.best))} of ${sh.who.length === 1 ? sh.who[0].name : "the smallest"} stacked up to match that.`,
    tl.who,
  ],
  [
    "Hardest to catch",
    `${n(hc.who.length)} Pokemon share the lowest capture rate in the dex, ${hc.best} out of 255, ${hc.who.length > 1 ? `including ${list(hc.who.slice(0, 3).map((p) => p.name))}` : hc.who[0].name}. At the other end, ${n(P.filter((p) => p.catch === 255).length)} sit at the maximum of 255.`,
    hc.who.slice(0, 3),
  ],
  ["Legendaries", `${n(legendary.length)} Pokemon are flagged Legendary and ${n(mythical.length)} Mythical, which is ${((legendary.length + mythical.length) / P.length * 100).toFixed(1)}% of the ${n(P.length)} in the National Pokedex.`],
  ["Babies", `${n(babies.length)} Pokemon are classed as baby Pokemon, a category that did not exist until breeding arrived in Generation 2.`],
  ["The biggest generation", `Generation ${genRank[0][0]} introduced ${n(genRank[0][1])} Pokemon, more than any other. Generation ${genRank[genRank.length - 1][0]} added the fewest, at ${n(genRank[genRank.length - 1][1])}.`],
];

const RARE_COMBOS = [...combos]
  .filter(([, v]) => v.length > 1 && v.length <= 3)
  .sort((a, b) => a[1].length - b[1].length)
  .slice(0, 6);

// --- the height bars grow ---------------------------------------------------
//
// THE ONE CHART ON THIS SITE WHOSE POINT IS A SIZE DIFFERENCE, and the figure's
// own caption says so: "the bars are to scale, the two pictures beside them are
// not." Growing them from the baseline as they scroll into view is the reader
// FEELING 1.9m against 0.6m instead of reading it. Garbodor starts 90ms behind
// Trubbish so the two are seen as two rather than as one shape widening.
//
// **THIS IS THE SITE'S SECOND SCROLL REVEAL AND IT MUST STAY THE LAST ONE.**
// The first is .hitcards on the rip pages. A general scroll-reveal primitive was
// proposed and REJECTED, and the reason is the whole point: two reveals on a
// site of 1,486 pages are two moments, and a scroll-reveal on every band is a
// tic that makes the reader wait for content that had already arrived. If you
// are here because you want a third, the answer is no; the lever is a better
// picture, not a later one. Anything that turns this into a helper others can
// call has already lost the argument.
//
// THE BASE STATE IS THE FINISHED BAR. .is-armed is added by JS only once it has
// confirmed it will reveal, exactly like .hitcards.is-armed in build-pages.mjs,
// so a killed transition, a missing IntersectionObserver, a thrown script or a
// failed observer all leave a complete chart and never an empty one. NEVER ARM
// UNDER REDUCED MOTION: ui.css sets transition:none!important for those
// readers, which kills the movement and does NOT kill a transform:scaleY(0), so
// arming under it is how a chart ships as two invisible rectangles.
//
// scaleY about the baseline is compositor only: no layout, no paint of anything
// underneath, and CLS cannot move because an SVG rect's transform does not
// change the box the figure reserves.
//
// transform-box:fill-box IS LOAD BEARING AND transform-origin:50% 100% ALONE IS
// A BUG. On an SVG element transform-box defaults to view-box, so "100%" is the
// bottom of the 300x132 VIEWBOX and not the bottom of the rect. The baseline is
// at y=116, sixteen units above that, so the bars grew from sixteen units BELOW
// the line they are measured against and passed straight through the TRUBBISH
// and GARBODOR labels on the way up. Caught by reading the computed
// transform-origin off the shipped page (it said "150px 132px") and then by
// looking at the 140ms frame, where the bar is plainly sitting on the words.
// fill-box makes the origin each rect's OWN bottom edge, which for both bars IS
// y=116. The finished state is transform:none either way, so the settled figure
// is unchanged and only the movement is.
const LORE_ANIM_CSS = `
/* The height bars grow as they scroll in, once. BASE STATE IS THE FINISHED BAR:
   scaleY(0) exists only under .is-armed, which JS adds only when it has
   confirmed it will reveal. transform-box:fill-box is NOT optional here, see
   scripts/build-lore.mjs. Second scroll reveal on this site and the LAST one. */
.lore-scale .lore-bar{transform-box:fill-box;transform-origin:50% 100%;
  transition:transform .5s cubic-bezier(.2,.7,.3,1)}
.lore-scale.is-armed .lore-bar{transform:scaleY(0)}
.lore-scale.is-armed .lore-bar:nth-of-type(2){transition-delay:90ms}
.lore-scale.is-armed.is-in .lore-bar{transform:none}
@media(prefers-reduced-motion:reduce){.lore-scale.is-armed .lore-bar{transform:none}}`;

const LORE_ANIM_JS = `<script>
(function(){
  var fig=document.querySelector('.lore-scale');
  if(!fig) return;
  var bars=fig.querySelectorAll('.lore-bar');
  if(bars.length!==2) return;
  /* RETURN WITHOUT ARMING: arming here is how a chart ships as empty air. */
  if(!('IntersectionObserver' in window)||
     (window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  fig.classList.add('is-armed');
  /* Strips .is-armed at its SOURCE rather than adding .is-in over the top. */
  var fs=setTimeout(function(){ fig.classList.remove('is-armed'); },2000);
  var io=new IntersectionObserver(function(es){
    for(var i=0;i<es.length;i++){
      if(!es[i].isIntersecting) continue;
      clearTimeout(fs); fig.classList.add('is-in'); io.disconnect();
    }
  },{rootMargin:'0px 0px -10% 0px',threshold:0});
  io.observe(fig);
})();
<\/script>`;

// --- page -------------------------------------------------------------------
const desc = `Pokemon facts computed from the National Pokedex, not repeated: the rarest type combinations, the heaviest, the hardest to catch, and why Trubbish is ours.`;

const factCard = (heading, body, who = []) => `      <div class="lore">
        <h3>${esc(heading)}</h3>
        <p>${esc(body)}</p>
        ${who.length ? portraits(who) : ""}
        <span class="lore-src">Source: ${esc(SRC)}</span>
      </div>`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pokemon Lore and Pokedex Facts: Did You Know?</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/lore.html">
<meta property="og:title" content="Pokedex facts, and the case for Trubbish">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/lore.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg?v=2">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
<link rel="stylesheet" href="/assets/games.css">
<style>
/* THIS PAGE'S OWN IMAGERY. It lives here rather than in assets-source/ui.css
   because it is used on exactly one page, and rather than in games.css because
   that file belongs to the games. Same reason the guide builders keep theirs. */

/* One portrait. --px is the DRAWN box and every file is mirrored at twice it by
   scripts/sync-dex-art.mjs, so nothing here is upscaling. width/height on the
   tag are the file's real pixels, so the box is reserved before it loads and
   the fact cards do not reflow underneath the reader. */
.dexart{display:block;width:var(--px);height:var(--px);object-fit:contain}
/* No artwork held. The site's 45 degree no-art hatch, the one /sets/ uses for a
   set with no logo, at the identical footprint so the row keeps its shape. */
.dexart-none{border-radius:var(--r-sm);border:1px solid var(--hair);
  background:repeating-linear-gradient(45deg,var(--paper-3) 0 6px,var(--paper-2) 6px 12px)}
.dexrow{display:flex;flex-wrap:wrap;gap:var(--s3);margin-top:var(--s3)}
.dexfig{margin:0;text-align:center}
.dexfig figcaption{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);margin-top:4px;
  max-width:76px;overflow-wrap:anywhere}

/* The mascot pair. Portraits at a COMMON size, with the height comparison drawn
   separately below them as an SVG.
   THE PORTRAITS ARE DELIBERATELY NOT SCALED TO 0.6m AND 1.9m, and that was the
   first idea. Official artwork is a posed illustration inset in a square canvas
   by a different margin for every Pokemon, so scaling the FILES by the ratio of
   the two heights does not scale the two creatures by it. It would look right
   and be false, which is the worst kind of picture to put on a page whose whole
   claim is that every number on it was computed. The drawn bars underneath are
   exact, because they are drawn from the numbers rather than from the art. */
/* Two across on a phone, not two down. At 390px the portraits are 132px each,
   so a row of two plus the gap is 288px and fits with room; letting them wrap
   one per line pushed the height chart 900px below the sentence it illustrates,
   which is the same as not having it. */
.lore-mascots{display:flex;flex-wrap:wrap;gap:var(--s4) var(--s5);align-items:flex-start;margin:var(--s4) 0}
/* WIDTH PINNED TO THE PORTRAIT, so two fit across a 390px phone. Without it the
   figure is as wide as its caption, "#569 - TRASH HEAP POKEMON" is about 250px,
   and the pair wrapped one per row: the height chart the copy is describing
   ended up 900px below the sentence, which is the same as not drawing it. */
.lore-mascot{margin:0;text-align:center;flex:none;width:132px}
.lore-mascot img,.lore-mascot .dexart-none{width:132px;height:132px}
/* INHERIT, do not name a token. This whole block lives inside .fk-golden, which
   sets color:var(--paper) on a near-black ground. Naming --ink or --ink-2 here
   painted the two Pokemon names in black on black: they were simply absent, and
   the layout looked deliberate. */
.lore-mascot figcaption{font:700 var(--t-micro)/1.4 var(--mono);color:inherit;opacity:.75;
  letter-spacing:.04em;text-transform:uppercase;margin-top:6px}
.lore-mascot b{display:block;font:400 var(--t-m)/1.1 var(--display);color:inherit;opacity:1;
  text-transform:none;letter-spacing:0;margin-bottom:2px}
.lore-scale{flex:1 1 260px;min-width:0;align-self:flex-end}
.lore-scale svg{width:100%;height:auto;max-width:420px;display:block}
.lore-scale figcaption{font:400 var(--t-micro)/1.5 var(--body);color:inherit;opacity:.72;margin-top:6px}
${LORE_ANIM_CSS}
</style>
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
      where it came from, because a fun fact with no source is just a rumor with good timing.</p>
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
      <div class="lore-mascots">
        <figure class="lore-mascot">
          ${portrait(trubbish, 132, true)}
          <figcaption><b>${esc(trubbish.name)}</b>#${trubbish.id} &bull; ${esc(trubbish.genus)} Pokemon</figcaption>
        </figure>
        <figure class="lore-mascot">
          ${portrait(garbodor, 132, true)}
          <figcaption><b>${esc(garbodor.name)}</b>#${garbodor.id} &bull; ${esc(garbodor.genus)} Pokemon</figcaption>
        </figure>
        <figure class="lore-scale">
          ${heightBars(trubbish, garbodor)}
          <figcaption>Drawn from the Pokedex heights, not from the artwork: the bars are to scale, the
            two pictures beside them are not.</figcaption>
        </figure>
      </div>
      <p style="margin-top:12px">${esc(trubbish.name)} is #${trubbish.id}, a Generation ${trubbish.gen} pure
        ${esc(cap(trubbish.types[0]))} type, ${m(trubbish).toFixed(1)}m tall and ${kg(trubbish).toFixed(1)}kg.${/* TWO FIXES IN ONE SENTENCE. "triples in height" was a word typed over
             two computed numbers and it does not survive them: 0.6m to 1.9m is
             3.2x, and the page prints both figures inches away from the claim.
             The multiple is derived now, so it cannot go stale the next time
             pokeapi is read. And "easier to get hold of" is British; the stat
             being described is the capture rate, so the American word is also
             the exact one. */ ""}
        It evolves into ${esc(garbodor.name)}, which is ${(m(garbodor) / m(trubbish)).toFixed(1)} times its height at
        ${m(garbodor).toFixed(1)}m and puts on
        ${(kg(garbodor) - kg(trubbish)).toFixed(1)}kg getting there. ${esc(trubbish.name)} has a capture rate of
        ${trubbish.catch} against ${esc(garbodor.name)}'s ${garbodor.catch}, so the bag is a great deal easier to
        catch than the heap.</p>
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
${FACTS.map(([h, b, who]) => factCard(h, b, who)).join("\n")}
    </div>

    <h2 style="margin-top:var(--s7)">One of a <span class="hl">kind</span></h2>
    <p class="lede" style="max-width:40em">Type pairings so rare that the whole dex holds two or three of them.</p>
    <div class="lore-list" style="margin-top:var(--s4)">
${RARE_COMBOS.map(
  ([k, v]) => `      <div class="lore">
        <h3>${esc(k.split("/").map(cap).join(" / "))}</h3>
        <p>Only ${v.length}: ${esc(list(v))}.</p>
        ${portraits(v.map(byName), 56)}
        <span class="lore-src">Source: ${esc(SRC)}</span>
      </div>`,
).join("\n")}
    </div>

    <div class="btn-row" style="margin-top:var(--s7);justify-content:center">
      <a class="btn btn-yt" href="/games/">Test yourself on the games</a>
    </div>

    <p class="price-note" style="margin-top:var(--s5)">Every figure on this page is computed from the National
      Pokedex as published by <a href="https://pokeapi.co" rel="noopener" target="_blank" aria-label="pokeapi.co, the source of every figure and every picture on this page, opens on pokeapi.co">pokeapi.co</a>, read
      ${esc(longDate(dex.checked) || dex.checked)}, covering all ${n(P.length)} species. Counts are over the whole
      Pokedex, not a sample. The Pokedex entry text from the games is copyrighted and is deliberately not reprinted
      here: the categories quoted above are the official one word classifications, and the sentences around them are
      ours. Official artwork is mirrored from the same PokeAPI project the numbers come from, at the size it is
      drawn here. Pokemon and all Pokemon names are trademarks of The Pokemon Company. Fan content, not
      affiliated.</p>
  </div>
</section>

</main>
${/* No "Fan content." here: footer() adds that clause itself, so this printed
      it twice in one sentence. */ ""}
${footer("Pokedex data from pokeapi.co, read fresh rather than remembered.")}
${LORE_ANIM_JS}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/lore.html"), page);
console.log(`Wrote public/lore.html`);
console.log(`  ${FACTS.length} computed facts, ${RARE_COMBOS.length} rare type combos`);
console.log(`  over all ${P.length} species, ${combos.size} type combinations`);
const drawn = Object.keys(ART).length;
console.log(`  ${drawn} portraits held${
  missingArt.size ? `, ${missingArt.size} drawn as the no-art hatch: ${[...missingArt].join(", ")}` : ", none missing"
}`);
if (missingArt.size) console.log(`  fix with: node scripts/sync-dex-art.mjs`);
