#!/usr/bin/env node
// Build /evolution.html: every evolution line, drawn, with what each arrow
// actually takes.
//
//   node scripts/build-evolution.mjs
//
// Reads data/evolutions.json (scripts/sync-evolution.mjs writes it) through
// shared/evolution.mjs, which owns every sentence on this page so that a
// species page under /pokemon/ can print the same condition and cannot phrase
// it differently. THE SPECIES PAGES ARE A SECOND CONSUMER BY DESIGN: this
// builder never touches build-pokemon.mjs or data/pokedex.json.
//
// THE QUESTION THIS PAGE ANSWERS is two words long and the layout is built
// around it: what does this become, and what do I have to do. So the chain is
// DRAWN rather than described, because a three-stage line is a picture, and the
// trigger sits ON the arrow rather than in a paragraph underneath, because the
// trigger is the actual question. "Level 16" is easy. "Trade it holding a Metal
// Coat" and "Level up with friendship 160 or higher, at night" are why anybody
// searches this.
//
// WHY DRAWN AND NOT PICTURED. There are 340 lines and 1,025 species on this
// page. One sprite each would be a thousand image requests and several
// megabytes, and it would not answer the question any better than the name
// does: nobody searching how Gible evolves is unsure what a Gible looks like.
// The arrows and the branch elbows are inline SVG from one sprite, so the whole
// page costs zero image requests and scales to any width.
//
// THE VERSION GROUP RULE, AND IT IS THE ONE THING NOT TO BREAK. Every route
// PokeAPI serves is filed under a version group, and that is NOT a claim that
// the method only works in those games: Charmeleon's "Level 16" is filed under
// Red and Blue and is true in every game since. So a species with ONE condition
// prints it with no games attached, and a species whose conditions genuinely
// DIFFER prints every one of them with its games named and picks none.
// groupRoutes in shared/evolution.mjs is what decides which case a species is
// in; the guard below refuses to render a chip for the first case at all, so a
// later edit cannot quietly turn "Level 16" into "Level 16 in Red and Blue".
//
// NO CARD SCANS, NO PRICES AND NO PULL RATES. This is a general Pokemon
// reference, not a card page. It links to the card side of the site rather than
// importing it.
//
// NO BACKTICKS IN COMMENTS IN THIS FILE. The page below is one template literal
// and a backtick inside a comment closes it. That has broken three builds.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// NEITHER packplayer.js NOR packs.css, for the reason build-types.mjs sets out
// at length: nothing on this page plays a rip where it sits, so both would
// attach to nothing and cost ~11.9KB gzipped and two requests. If a video tile
// or a carousel is ever added here, packplayer.js has to come back with it or
// the tile navigates instead of playing in place.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";
import {
  loadEvolutions, walkChain, chainNames, methodTags, METHOD_LABELS,
  EVO_MARKS, EVO_CSS, renderChain, groupRoutes, gameLabels,
} from "../shared/evolution.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = await loadEvolutions();

const chains = d.chains || [];
if (chains.length < 400) {
  throw new Error(`data/evolutions.json holds ${chains.length} chains, expected 500+. Run scripts/sync-evolution.mjs.`);
}

// The species pages that actually exist. Read rather than assumed: the roster
// is capped deliberately in build-pokemon.mjs, so linking every name would be
// 1,025 links to 30 pages and 995 404s.
let hasPage = new Set();
try {
  const pk = JSON.parse(await readFile(join(ROOT, "public/data/pokemon-index.json"), "utf8"));
  hasPage = new Set((pk.pokemon || []).map((p) => p.slug));
} catch {
  /* run: node scripts/build-pokemon.mjs */
}

/* ------------------------------------------- a portrait on every line -----
 *
 * THIS PAGE WAS 94,547px OF NAME BOXES WITH NOTHING TO LOOK AT, measured at
 * 390x844 in headless Chrome: 112 screens, 340 line cards, and not one picture
 * anywhere in main. It counted 484 inline SVGs and read as one of the better
 * illustrated pages on the site, because every one of them is a 30px arrow or
 * a fork elbow. Those draw the RELATIONSHIP, which is the page's argument, and
 * none of them draws a POKEMON, which is what a reader is scanning for.
 *
 * THE ART WAS ALREADY IN THE TREE AND THIS PAGE WAS THE ONE FAMILY NOT SHOWING
 * IT. /pokemon/ has drawn the official artwork beside every stage of the same
 * chains, off the same data, since the species art landed.
 *
 * ONE PORTRAIT PER LINE CARD AND NOT ONE PER NODE, which is a weight decision
 * and a design one. There are 824 nodes and 340 cards: a portrait in every node
 * is 3.2MB and turns a three stage chain into a strip of pictures competing
 * with the arrows and the conditions that are the actual content. On the
 * heading it says one thing, WHOSE LINE THIS IS, which is what the heading
 * already says in words, and it breaks the wall roughly every 280px.
 *
 * NO PORTRAIT WHERE THERE IS NO FILE. A species with no entry in the manifest
 * gets a heading with no img rather than a frame with nothing in it.
 */
const speciesArt = JSON.parse(
  await readFile(join(ROOT, "data/species-art.json"), "utf8"),
).art || {};
let portraits = 0;
const portrait = (n) => {
  const a = n && n.id && speciesArt[n.id] && speciesArt[n.id].sm;
  if (!a) return "";
  portraits += 1;
  // 48px drawn, and the file is that box doubled. EVERY ONE OF THESE IS BELOW
  // THE FOLD: the first card sits far below 844 at 390 behind the hero, the
  // find box and the forks nav, so lazy is right on all of them and is checked
  // after the build rather than assumed.
  return `<img class="ev-sp" src="${esc(a.file)}" width="${a.w}" height="${a.h}" alt="" loading="lazy" decoding="async">`;
};

// ---------------------------------------------------------------------------
// THE CARDS, IN NATIONAL DEX ORDER OF THE FIRST STAGE.
//
// Dex order and not alphabetical, because the generation filter is only
// coherent if the page is already in that order, and because a reader scanning
// for a line they half remember is scanning by era. The filter box is what
// answers "get me to Gible", not the ordering.
const evolving = chains.filter((c) => (c.root.to || []).length);
const still = chains.filter((c) => !(c.root.to || []).length);

// ------------------------------------------- how many game tags this page names
//
// COUNTED OFF WHAT RENDERS, NOT OFF THE LOOKUP TABLE. The page said
// "16 sets of games are named on this page" from Object.keys(d.games).length,
// which is every version group our source has a LABEL for. A tag is only printed
// where a node carries more than one condition, because a sole condition must
// never print its version group (condBlock throws if it tries), so two of those
// sixteen, The Indigo Disk and Ultra Sun and Ultra Moon, are in the table and on
// no line of the chart. This walks the chains the same way condsFor does and
// counts the labels that actually reach a reader.
const shownGameLabels = new Set();
for (const c of chains) {
  walkChain(c.root, (node) => {
    const groups = groupRoutes(node.routes);
    if (groups.length < 2) return;
    for (const g of groups) for (const l of gameLabels(g.games, d.games)) shownGameLabels.add(l);
  });
}
const byDex = (a, b) => (a.root.id ?? 99999) - (b.root.id ?? 99999);
evolving.sort(byDex);
still.sort(byDex);

let branchCount = 0;
let speciesInLines = 0;

const cardFor = (c) => {
  const names = chainNames(c.root);
  speciesInLines += names.length;
  const methods = new Set();
  let branches = false;
  walkChain(c.root, (nd) => {
    if ((nd.to || []).length > 1) branches = true;
    for (const r of nd.routes || []) for (const m of methodTags(r)) methods.add(m);
  });
  if (branches) branchCount++;
  const gen = c.root.gen || 0;
  return `<article class="ev-card${branches ? " ev-branchy" : ""}" id="line-${esc(c.root.slug)}"
    data-n="${esc(names.join(" ").toLowerCase())}" data-g="${gen}" data-m="${esc([...methods].join(" "))}">
    <h3 class="ev-h">${portrait(c.root)}${esc(names[0])}${names.length > 1 ? ` <span>line</span>` : ""}</h3>
    ${renderChain(c.root, d, hasPage)}
  </article>`;
};

const cards = evolving.map(cardFor).join("\n");

// The forks, listed at the top. These are the most searched and the hardest to
// lay out, and a reader who came for one of them should not have to scroll 340
// cards or know the first stage's name to find it.
const forks = evolving
  .filter((c) => {
    let b = false;
    walkChain(c.root, (n) => {
      if ((n.to || []).length > 1) b = true;
    });
    return b;
  })
  .map((c) => {
    let n = 0;
    walkChain(c.root, (x) => {
      if ((x.to || []).length > 1) n = Math.max(n, x.to.length);
    });
    return { c, n };
  })
  .sort((a, b) => b.n - a.n || byDex(a.c, b.c));

const forkLinks = forks
  .map(
    ({ c, n }) =>
      `<a href="#line-${esc(c.root.slug)}"><b>${esc(c.root.name)}</b><span>${n} ways</span></a>`
  )
  .join("\n        ");

// "Does Lapras evolve?" is a real search with a one word answer, and a page
// that simply has no Lapras on it looks broken rather than answering. The same
// filter box searches this list, so typing a name always lands somewhere.
const stillList = still
  .map((c) => `<li data-n="${esc(c.root.name.toLowerCase())}" data-g="${c.root.gen || 0}">${esc(c.root.name)}</li>`)
  .join("");

// ---------------------------------------------------------------------------
const genCounts = {};
for (const c of evolving) genCounts[c.root.gen || 0] = (genCounts[c.root.gen || 0] || 0) + 1;
const gens = Object.keys(genCounts).map(Number).filter(Boolean).sort((a, b) => a - b);

const methodCounts = {};
for (const c of evolving) {
  const seen = new Set();
  walkChain(c.root, (nd) => {
    for (const r of nd.routes || []) for (const m of methodTags(r)) seen.add(m);
  });
  for (const m of seen) methodCounts[m] = (methodCounts[m] || 0) + 1;
}
const methodOrder = ["level", "item", "trade", "held", "friendship", "time", "place", "move", "odd"];

// ---------------------------------------------------------------------------
// WHAT AN EVOLUTION STEP ACTUALLY TAKES, COUNTED BY STEP, AND DRAWN.
//
// THE LEDE MAKES A CLAIM ABOUT PROPORTION AND NOTHING ON THE PAGE SHOWS IT.
// "Levels are the easy half. The reason anybody looks this up is the other
// half." That is the argument for the whole page and it is true: of the 483
// arrows drawn below, most are a number and nothing else, and the rest are the
// stone, the trade, the friendship at night, the walk. A reader cannot get that
// from the chart underneath, because seeing it means holding three hundred
// cards in your head at once. One axis is where a proportion lives.
//
// THIS IS COUNTED BY STEP AND THE FILTER CHIPS COUNT LINES, WHICH ARE
// DELIBERATELY DIFFERENT NUMBERS AND SIT ON THE SAME SCREEN. A chip answers
// "show me every line with a trade in it somewhere", so a four stage line with
// one trade in it counts once. A bar here answers "what does an arrow take",
// which is the question the lede asks. Level up is 259 lines and 340 steps and
// both are right. The unit is printed on every row and named again in the
// caption, because two numbers under one word with no unit on either is how a
// page starts contradicting itself.
//
// LEVEL IS EXCLUSIVE AND THE OTHER EIGHT ARE NOT. methodTags in
// shared/evolution.mjs only tags a step "level" when nothing else applies, so
// the first bar is "a level and nothing else" and is exact. A step CAN carry
// two of the other eight, because a trade holding a Metal Coat is both, so
// those eight add to more than the number of steps they describe. The caption
// says so and the arithmetic below is asserted rather than hoped for.
let evSteps = 0;
let evMultiTag = 0;
const stepCounts = {};
for (const c of evolving) {
  walkChain(c.root, (nd) => {
    if (!(nd.routes || []).length) return;
    evSteps++;
    const tags = new Set();
    for (const r of nd.routes) for (const m of methodTags(r)) tags.add(m);
    if (tags.size > 1) evMultiTag++;
    for (const t of tags) stepCounts[t] = (stepCounts[t] || 0) + 1;
  });
}

const EV_PLAIN = stepCounts.level || 0;
const EV_REST = evSteps - EV_PLAIN;
const EV_BARS = Object.entries(stepCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

// The three things the picture asserts, each of which is a RELATIONSHIP rather
// than a value, and a relationship is what goes quietly false when the source
// is re-synced. Same discipline as build-grade-check.mjs and build-buying.mjs:
// a chart drawing an argument its own data stopped supporting is worse than no
// chart, so the build stops and says which one went.
if (!evSteps || !EV_BARS.length) {
  throw new Error(
    "build-evolution: no evolution step carries a method tag, so the figure would be an empty box " +
      "under a lede promising the opposite. Run scripts/sync-evolution.mjs, or take the figure out."
  );
}
if (EV_BARS[0][0] !== "level") {
  throw new Error(
    "build-evolution: the step figure draws the lede's claim that levels are the easy half and the " +
      `biggest bar is now ${JSON.stringify(EV_BARS[0][0])} at ${EV_BARS[0][1]} steps, against ` +
      `${EV_PLAIN} that are a level and nothing else. The picture and the lede above it no longer ` +
      "agree. Rewrite the lede from the data, or drop the figure."
  );
}
if (EV_PLAIN <= EV_REST) {
  throw new Error(
    `build-evolution: ${EV_PLAIN} of ${evSteps} steps are a plain level and ${EV_REST} need something ` +
      "else, so a level is no longer the majority and the lede's \"levels are the easy half\" is " +
      "false. Both the sentence and the caption under the figure have to be rewritten from the data."
  );
}
{
  const tail = EV_BARS.filter(([k]) => k !== "level").reduce((a, [, v]) => a + v, 0);
  if (tail < EV_REST) {
    throw new Error(
      `build-evolution: the eight tail bars add to ${tail} across ${EV_REST} steps that are not a ` +
        "plain level, which is fewer tags than steps. Every step that is not a plain level carries at " +
        "least one of those eight by construction, so this means a tag has gone missing from " +
        "methodTags in shared/evolution.mjs and the figure is under-drawing the tail."
    );
  }
}

// A count is never printed inside a bar, only beside it, so nothing here needs a
// width check. The label column is real text in the document and wraps.
const stepRow = ([key, n]) => `          <li>
            <span class="ev-fn">${esc(METHOD_LABELS[key] || key)}</span><b class="ev-fv">${n}<span> steps</span></b>
            <span class="ev-ft" aria-hidden="true"><span class="ev-fb" style="width:${(
              (n / EV_BARS[0][1]) *
              100
            ).toFixed(1)}%"></span></span>
          </li>`;

const stepFig = () => `        <figure class="ev-fig" data-evintro>
          <h2 class="ev-figh">What a step actually <span class="hl">takes</span></h2>
          <ul class="ev-figl">
${EV_BARS.map(stepRow).join("\n")}
          </ul>
          <figcaption>Every one of the ${evSteps} arrows drawn below, counted by what it asks for.
            <b>${EV_PLAIN} of them are a level and nothing else.</b> The other ${EV_REST} are the ones
            people come here for, and ${evMultiTag} of those want more than one thing at once, a trade
            while holding an item, a level at a particular time, so the eight small bars add to more
            than ${EV_REST}. Counted by STEP, one arrow at a time. The filters above count LINES
            instead, which is why the same words carry smaller numbers up there: a line with four
            arrows in it is one line however many of them are a level.</figcaption>
        </figure>`;

const chips = (id, items) =>
  items
    .map(
      ([val, label, n]) =>
        `<button type="button" class="ev-chip" data-${id}="${esc(val)}">${esc(label)}<span>${n}</span></button>`
    )
    .join("");

const desc =
  "Every Pokemon evolution line drawn as a chain, with what each step takes: the level, " +
  "the stone, the trade, the friendship, the time of day.";
if (desc.length > 160) throw new Error(`meta description is ${desc.length} characters, over 160:\n${desc}`);

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Evolution chart" },
    ],
  },
];

const style = `
.ev-lede{max-width:46em}
/* THE FINDER. Sticky, because the whole page is one long list and a reader who
   has scrolled to Gible's neighbourhood and typed the wrong thing should not
   have to scroll back up to fix it. 44px minimum on the input and every chip:
   measured, not assumed, at 390x844.
   top:var(--bar-h) and not 0. The site bar is itself sticky at top:0 with
   z-index 60, so a second sticky element at 0 slides underneath it and the
   input is hidden by the search box in the chrome. Same value .rail in ui.css
   and .vg-rail in build-video-games.mjs use, for the same reason.
   THE CHIPS ARE DELIBERATELY OUTSIDE THIS BOX. They were inside it, and
   measured at 390x844 the eighteen of them wrapped to seven rows: the sticky
   bar was 420px tall, half the phone viewport, and the chart it was meant to
   help you search was reduced to a 300px slot underneath it. Screenshotted, not
   reasoned about. The input is the thing worth pinning; a chip is set once. */
.ev-find{position:sticky;top:var(--bar-h);z-index:40;background:var(--page);
  padding:var(--s3) 0 var(--s2);margin:var(--s3) 0;border-bottom:1px solid var(--hair)}
.ev-filters{margin-top:var(--s5)}
.ev-flabel{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);margin-top:var(--s3)}
.ev-find input{width:100%;min-height:48px;padding:0 var(--s3);border:3px solid var(--keyline);
  border-radius:10px;background:var(--card);color:var(--ink);font:400 var(--t-body)/1 var(--body);
  -webkit-appearance:none}
.ev-find input:focus{outline:3px solid var(--gold);outline-offset:2px}
.ev-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--s2)}
.ev-chip{min-height:44px;padding:0 12px;border:1px solid var(--hair);border-radius:var(--r-pill);
  background:var(--card);color:var(--ink);cursor:pointer;
  font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  display:inline-flex;align-items:center;gap:6px}
.ev-chip span{color:var(--ink-2);font-weight:400}
.ev-chip[aria-pressed="true"]{background:var(--mustard);border-color:var(--keyline);color:var(--on-accent)}
.ev-chip[aria-pressed="true"] span{color:var(--on-accent)}
.ev-count{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  color:var(--ink-2);margin-top:var(--s2)}
/* THE STEP FIGURE. Same box as .ev-read, which is the card this page already
   uses for a block that is prose about the chart rather than part of it, so a
   reader meets one visual language and not two.
   NOTHING IS CARRIED BY COLOUR. One fill, on the page's own paper tone, with a
   hairline round the track and the count printed beside every bar. The scale is
   set by the biggest bar and starts at zero, so the level bar being five times
   the next one is the real ratio and not a stretched one.
   THE SMALLEST BAR IS ABOUT 2% OF THE TRACK, roughly 7px at 390px, and that is
   deliberate rather than an oversight: the whole finding is that eight of the
   nine are small. No count is drawn INSIDE a bar, so nothing here can become
   unreadable at that size; the number sits in real text on the line above,
   where it wraps and where a screen reader gets it. */
.ev-fig{border:3px solid var(--keyline);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4);margin:var(--s5) 0}
.ev-figh{margin-bottom:var(--s4)}
.ev-figl{list-style:none;margin:0;padding:0;display:grid;gap:var(--s3)}
.ev-figl li{display:grid;grid-template-columns:1fr auto;gap:var(--s2);align-items:baseline;
  padding-top:var(--s3);border-top:1px solid var(--hair)}
.ev-figl li:first-child{padding-top:0;border-top:0}
.ev-fn{font:400 var(--t-sm)/1.35 var(--body);color:var(--ink)}
.ev-fv{font:700 var(--t-sm)/1 var(--mono);white-space:nowrap}
.ev-fv span{font-weight:400;color:var(--ink-2)}
.ev-ft{grid-column:1/-1;display:block;height:14px;margin-top:6px;border-radius:3px;
  background:var(--paper-2);box-shadow:inset 0 0 0 1px var(--hair)}
.ev-fb{display:block;height:100%;min-width:3px;border-radius:3px;background:var(--ink)}
.ev-fig figcaption{margin-top:var(--s4);padding-top:var(--s3);border-top:1px solid var(--hair);
  font-size:var(--t-sm);line-height:1.55;color:var(--ink-2)}
.ev-fig figcaption b{color:var(--ink);font-weight:700}

.ev-forks{display:flex;flex-wrap:wrap;gap:8px;margin:var(--s4) 0 0}
.ev-forks a{display:inline-flex;flex-direction:column;justify-content:center;min-height:48px;
  padding:6px 12px;border:1px solid var(--hair);border-radius:10px;background:var(--card);
  color:inherit;text-decoration:none}
.ev-forks a:hover{border-color:var(--ink);background:var(--mustard);color:var(--on-accent)}
.ev-forks b{font:700 var(--t-sm)/1.2 var(--body)}
.ev-forks span{font:400 var(--t-micro)/1.2 var(--mono);color:var(--ink-2)}
.ev-forks a:hover span{color:var(--on-accent)}
.ev-read{border:3px solid var(--keyline);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4);margin:var(--s5) 0}
.ev-read h2{margin-bottom:var(--s2)}
.ev-read p{font-size:var(--t-sm);line-height:1.55;max-width:46em}
.ev-read p + p{margin-top:var(--s3)}
.ev-list{display:flex;flex-direction:column;gap:var(--s4);margin-top:var(--s4)}
/* ONE CARD PER LINE. The border is what tells two adjacent chains apart on a
   phone, where they are both a vertical stack and would otherwise run together
   into one long column of boxes. */
.ev-card{border:2px solid var(--hair);border-radius:12px;background:var(--card);
  padding:var(--s3);scroll-margin-top:96px}
.ev-branchy{border-color:var(--keyline);border-width:3px;box-shadow:var(--hard-lg)}
.ev-h{font:400 var(--t-body)/1.2 var(--display);margin-bottom:var(--s3)}
.ev-h span{font:400 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);vertical-align:middle}
/* The line's own portrait. INLINE-BLOCK AND NOT A FLEX ITEM, deliberately: the
   heading is already an inline run of a display face and a mono chip that
   aligns itself with vertical-align, and turning the h3 into a flex row would
   make that chip a flex item and drop the single space in front of it. This
   way the existing two elements lay out exactly as they did.
   THE display IS NOT OPTIONAL AND IT IS WHY THIS SHIPPED WRONG ONCE. ui.css
   sets img{display:block} on every image on the site, so a rule here that only
   set vertical-align left the portrait on its own line above the name and made
   the heading 67px instead of 48. Measured, not guessed: read the img's own
   computed display before believing an inline image is inline.
   The file is 96px for this 48px box, so it is exact at DPR 2. */
.ev-sp{display:inline-block;width:48px;height:48px;vertical-align:middle;margin-right:8px}
.ev-still{margin-top:var(--s4)}
.ev-still ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.ev-still li{font:400 var(--t-micro)/1 var(--mono);border:1px solid var(--hair);
  border-radius:var(--r-pill);padding:8px 10px;color:var(--ink-2)}
.ev-empty{padding:var(--s5) 0;color:var(--ink-2);font-size:var(--t-sm)}
.ev-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s6);line-height:1.6;max-width:46em}
.ev-open{margin:var(--s4) 0 0 var(--s4);font-size:var(--t-sm);line-height:1.55;color:var(--ink-2);max-width:46em}
.ev-open li{margin-bottom:var(--s2)}

/* FROM 720px THE CHAIN TURNS. Below it, a chain is a column and the arrow
   points down; above it there is room for three boxes and two arrows across.
   720 rather than 640 because the longest real line, Wurmple's, is four boxes
   and three conditions and it wraps below that. */
@media(min-width:720px){
  .ev-list{display:grid;grid-template-columns:1fr;gap:var(--s3)}
}
/* TWO COLUMNS FROM 1100px, and the reason is the failure ui.css already
   documents for the home page: a linear chain drawn as a row is about 560px
   wide, so at 1440 every one of 340 cards left 800px of empty band beside it
   and the page ran to 53,086px. Measured. Two columns fills the width and
   roughly halves the scroll.
   THE FORKS SPAN BOTH. Eevee is eight arms and Magnemite is seven conditions;
   squeezed into a 700px column they wrap into a wall, and they are the cards
   people came for. .ev-branchy is set by the builder from the data rather than
   by hand, so a new branching line gets the full width without an edit here. */
@media(min-width:1100px){
  .ev-list{grid-template-columns:1fr 1fr;align-items:start}
  .ev-branchy{grid-column:1 / -1}
}
/* DESKTOP READING MEASURE, and the class on the four loose paragraphs is why
   this needs saying. --measure is ui.css's own cap and lands at 85 to 87 real
   characters on this page's face, measured with a canvas rather than assumed
   from ems. The four section paragraphs outside .ev-read and .ev-lede were
   running to 88 and 90 at 1440 because nothing in this block reached them, so
   they carry .ev-p and are named here. Same shape as the block at the foot of
   build-types.mjs. */
@media(min-width:1000px){
  .ev-lede,.ev-src,.ev-read p,.ev-p{max-width:var(--measure)}
  /* THE FIGURE IS CAPPED AND ITS CAPTION IS CAPPED INSIDE IT. A nine row bar
     chart stretched across a 1,180px wrap turns the eight small bars into eight
     slightly different slivers and the level bar into a black stripe, which is
     the same "a fixed cap does not move" failure the home page's desktop pass
     was about, one direction along. 46em holds the level bar at about 700px,
     which is enough for a 2% bar to still be a mark. */
  .ev-fig{max-width:46em}
  .ev-fig figcaption{max-width:var(--measure)}
}
`;

const js = `
(function(){
  var box=document.getElementById('evq'), cards=[].slice.call(document.querySelectorAll('.ev-card'));
  var still=[].slice.call(document.querySelectorAll('#evStill li'));
  var count=document.getElementById('evCount'), empty=document.getElementById('evEmpty');
  var stillWrap=document.getElementById('evStillWrap');
  var q='', gen='', meth='';
  // THE TWO BLOCKS BETWEEN THE FINDER AND THE CHART. Measured at 390x844:
  // typing "gible" left the one matching card 1,994px below the top of the
  // viewport, because the fork list and the how-to-read block still sat between
  // the search box and the results. A filter that finds the answer and leaves it
  // two thousand pixels away has not found it. They are hidden while a filter is
  // on and come back the moment it is cleared.
  var intro=[].slice.call(document.querySelectorAll('[data-evintro]'));
  var find=document.querySelector('.ev-find');
  var wasFiltered=false;
  // And the page is scrolled so the search box sits under the site bar, ONCE,
  // on the transition into a filtered state. Doing it on every keystroke fights
  // the reader; doing it never leaves them typing into a box with the results
  // off screen below.
  function jump(){
    if(!find) return;
    var bar=document.querySelector('.bar');
    var h=bar?bar.getBoundingClientRect().height:0;
    var y=find.getBoundingClientRect().top+window.pageYOffset-h;
    if(window.pageYOffset<y-4) window.scrollTo(0,y);
  }
  function apply(){
    var shown=0, s=q.trim().toLowerCase();
    for(var i=0;i<cards.length;i++){
      var c=cards[i], ok=true;
      if(s && c.getAttribute('data-n').indexOf(s)<0) ok=false;
      if(ok && gen && c.getAttribute('data-g')!==gen) ok=false;
      if(ok && meth && (' '+c.getAttribute('data-m')+' ').indexOf(' '+meth+' ')<0) ok=false;
      c.hidden=!ok; if(ok) shown++;
    }
    var sShown=0;
    for(var j=0;j<still.length;j++){
      var li=still[j], ok2=!meth;
      if(ok2 && s && li.getAttribute('data-n').indexOf(s)<0) ok2=false;
      if(ok2 && gen && li.getAttribute('data-g')!==gen) ok2=false;
      li.hidden=!ok2; if(ok2) sShown++;
    }
    if(stillWrap) stillWrap.hidden = sShown===0;
    // THE COUNT NAMES THE ACTIVE FILTER. The chips live above this bar and
    // scroll away, so a reader 40,000px down the page has no other way to see
    // that they set one twenty minutes ago and are looking at a fifth of the
    // chart.
    var f=[];
    if(meth) f.push(document.querySelector('[data-meth="'+meth+'"]').firstChild.nodeValue.trim());
    if(gen) f.push('Gen '+gen);
    count.textContent = shown+' line'+(shown===1?'':'s')+(sShown?', '+sShown+' that do not evolve':'')
      + (f.length?'  \u2022  '+f.join(' + '):'');
    empty.hidden = shown>0 || sShown>0;
    var filtered=!!(s||gen||meth);
    for(var k=0;k<intro.length;k++) intro[k].hidden=filtered;
    if(filtered && !wasFiltered) jump();
    wasFiltered=filtered;
  }
  if(box) box.addEventListener('input',function(){ q=box.value; apply(); });
  [].slice.call(document.querySelectorAll('[data-gen]')).forEach(function(b){
    b.setAttribute('aria-pressed','false');
    b.addEventListener('click',function(){
      var v=b.getAttribute('data-gen'); var on=gen!==v; gen=on?v:'';
      [].slice.call(document.querySelectorAll('[data-gen]')).forEach(function(x){
        x.setAttribute('aria-pressed', String(x===b && on)); });
      apply();
    });
  });
  [].slice.call(document.querySelectorAll('[data-meth]')).forEach(function(b){
    b.setAttribute('aria-pressed','false');
    b.addEventListener('click',function(){
      var v=b.getAttribute('data-meth'); var on=meth!==v; meth=on?v:'';
      [].slice.call(document.querySelectorAll('[data-meth]')).forEach(function(x){
        x.setAttribute('aria-pressed', String(x===b && on)); });
      apply();
    });
  });
  apply();
})();
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pokemon Evolution Chart: Every Line, and What Each One Takes</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/evolution.html">
<meta property="og:title" content="How does it evolve?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/evolution.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-evolution.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-evolution.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
<style>${EVO_CSS}${style}</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${EVO_MARKS}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Evolution chart</span></nav>
      <h1>How does it <span class="hl">evolve</span>?</h1>
      <p class="lede ev-lede">Every line drawn as a chain, with the condition written on the arrow, because the
        condition is the actual question. <b>${evolving.length} lines</b> covering ${speciesInLines.toLocaleString("en-US")}
        Pokemon, plus the ${still.length} that do not evolve at all. Type a name to find one.</p>
      <p class="lede ev-lede">Levels are the easy half. The reason anybody looks this up is the other half: the
        trade holding a Metal Coat, the friendship at night, the stone, the walk, the console turned upside down.
        Those are all here, and where the answer changes from game to game, <b>every answer is here</b> rather than
        whichever one happened to be first.</p>

      <div class="ev-filters">
        <p class="ev-flabel" id="evMethLabel">Show only lines that need</p>
        <div class="ev-chips" role="group" aria-labelledby="evMethLabel">
${chips("meth", methodOrder.filter((m) => methodCounts[m]).map((m) => [m, METHOD_LABELS[m], methodCounts[m]]))}
        </div>
        <p class="ev-flabel" id="evGenLabel">Or only one generation</p>
        <div class="ev-chips" role="group" aria-labelledby="evGenLabel">
${chips("gen", gens.map((g) => [String(g), `Gen ${g}`, genCounts[g]]))}
        </div>
      </div>

      <div class="ev-find">
        <label class="sr-only" for="evq">Find a Pokemon</label>
        <input id="evq" type="search" placeholder="Gible, Eevee, Magikarp..." autocomplete="off" enterkeyhint="search">
        <p class="ev-count" id="evCount"></p>
      </div>

${stepFig()}

      <section data-evintro>
        <h2>The ones that <span class="hl">fork</span></h2>
        <p class="ev-p">${forks.length} lines split, and these are the ones people actually come here for. Eevee is eight
          different jobs wearing one name.</p>
        <nav class="ev-forks" aria-label="Branching lines">
        ${forkLinks}
        </nav>
      </section>

      <div class="ev-read" data-evintro>
        <h2>How to read the <span class="hl">game tags</span></h2>
        <p>Most Pokemon evolve the same way in every game, and those lines carry no game tag at all. A tag only
          appears where the answer genuinely <b>changes between games</b>, and then every answer is listed with the
          games it belongs to and none of them is picked as the real one.</p>
        <p>Feebas is the clearest case. In Ruby and Sapphire it becomes Milotic by leveling up with maximum
          Beauty. In Black and White it becomes Milotic by being traded holding a Prism Scale. Both are true, in
          different games, and any page that gives you one of them has given half its readers the wrong answer.</p>
        <p>A tag names the games our source files that condition under. It is not a claim that the method stops
          working afterwards.</p>
      </div>

      <div class="ev-list" id="evList">
${cards}
      </div>

      <p class="ev-empty" id="evEmpty" hidden>Nothing matches that. Check the spelling, or clear the filters above.</p>

      <section class="ev-still" id="evStillWrap">
        <h2>These do not <span class="hl">evolve</span></h2>
        <p class="ev-p">${still.length} species have no evolution at all, in either direction. That is a real answer to a real
          question, so they are listed rather than left off the page.</p>
        <ul id="evStill">${stillList}</ul>
      </section>

      <div class="ev-read">
        <h2>Where this comes <span class="hl">from</span></h2>
        <p>Every level, item, place and condition on this page is read from <b>PokeAPI</b>, the free open Pokemon
          data project, on ${esc(longDate(d.checked))}. Nothing here is typed in by hand and nothing is remembered
          from playing the games. ${d.counts.routes} routes across ${d.counts.chains} chains.</p>
        <p>It describes the mainline Pokemon games from Red and Blue to Scarlet and Violet, including Legends:
          Arceus and Legends: Z-A and the Sword and Shield and Scarlet and Violet expansions.
          ${shownGameLabels.size} sets of games are named on this page and every one of them is a game tag
          our source attached to the condition itself. Our source labels ${Object.keys(d.games).length} version
          groups in all; the other ${Object.keys(d.games).length - shownGameLabels.size} carry no condition that
          differs between games, so no line on this page has a reason to print them.</p>
        <p>The phrasing is ours. The names of the items, moves, places and games are the source's own English
          names, and so is the wording of the unusual triggers: "Land three critical hits in a battle" and "Defeat
          three Bisharp that hold a Leader's Crest" are how PokeAPI itself labels them, not our summary of them.</p>
        <h3 style="margin-top:var(--s5)">What this page does not know</h3>
        <ul class="ev-open">
          <li>Regional forms are only half represented. Our source keys a chain on the species, so Alolan Raichu
            and ordinary Raichu are one box on this page. Where a route leads to a named form the form is printed
            on it; where it does not, the box is the species and nothing more.</li>
          <li>A game tag is where our source files a condition, which is usually the games it first appeared in.
            It is not a statement about which later games it still works in, and this page never treats it as one.</li>
          <li>Two conditions are marked as incomplete on the page itself, because the source says so: it records a
            number and a trigger and states that the rest does not fit its data model.</li>
          <li>Nothing here is about the card game. Evolution on a Pokemon card works by its own printed rules,
            which have nothing to do with levels, stones or friendship.</li>
          <li>Trade evolutions in the newest games can also be done with an item instead of a real trade. Our
            source labels that trigger "Trade or Linking Cord" and does not say which games accept which, so this
            page does not say either.</li>
        </ul>
      </div>

      <section>
        <h2>Keep going</h2>
        <p class="ev-p">Evolution is the video game side of Pokemon. The card side reads the same creature differently:
          <a href="/types.html">the card types page</a> explains why a card has 11 types where the games have 18,
          and why there is no type chart on a card at all. <a href="/pokemon/">Browse by Pokemon</a> takes a name
          and shows every card of it we cover. And <a href="/lore.html">Pokemon lore</a> is the rest of the
          Pokedex, counted rather than repeated.</p>
      </section>

      <p class="ev-src">Evolution data and the official artwork on each line from PokeAPI (pokeapi.co), read
        ${esc(longDate(d.checked))}. Item, move,
        location, form and game names are PokeAPI's own English names. Pokemon and Pokemon names are trademarks of
        Nintendo, Creatures Inc. and GAME FREAK inc. This is a fan site and nothing on it is affiliated with or
        endorsed by them. The arrows and fork marks above are our own drawings.</p>
    </div>
  </section>
</main>
${footer("Evolution data from PokeAPI. Arrows drawn by us.")}
<script>${js}</script>
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/evolution.html"), page);

console.log(`Wrote public/evolution.html
  ${evolving.length} lines drawn, ${still.length} species that do not evolve
  ${branchCount} lines fork, ${forks.length} listed at the top
  ${portraits} of ${evolving.length} lines carry a portrait${portraits < evolving.length ? `, ${evolving.length - portraits} have no sm file and correctly show none` : ""}
  ${d.counts.routes} routes from ${shownGameLabels.size} sets of games named on the page, read ${d.checked}
  reconciled against data/pokedex.json: ${d.reconciled.length ? d.reconciled.map((m) => `${m.slug} ${m.from || "(none)"} -> ${m.to || "(none)"}`).join(", ") : "nothing moved"}`);
