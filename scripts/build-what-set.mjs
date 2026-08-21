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
import { faqBlock, FAQ_CSS } from "../shared/faq.mjs";
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
// THE FIRST SYMBOL ON THE PAGE IS IN THE FIRST SCREEN. Measured over CDP at
// 390x844 DPR 2, reading each img's own border box at scroll 0: exactly one of
// these 24px squares is inside the 844px viewport, at y=816, and every other
// image on the page is below it. `loading="lazy"` is a vertical heuristic, so
// that one was fetched at first paint anyway and the attribute only cost it the
// preload scanner. Counted on emission rather than passed in, because the list
// is emitted group by group and the caller has no index across the whole page.
const EAGER_SYMBOLS = 1;
let symbolsEmitted = 0;
function symbolImg(s) {
  const lazy = symbolsEmitted++ < EAGER_SYMBOLS ? "" : ` loading="lazy"`;
  const d = SYMBOL_DIMS[s.apiId];
  if (d) {
    return `<img src="/assets/symbols/${esc(s.apiId)}-pokemon-tcg-set-symbol.webp" alt="" width="${d[0]}" height="${d[1]}"${lazy} decoding="async">`;
  }
  remoteSymbols += 1;
  return `<img src="${esc(s.symbol)}" alt="" width="20" height="20"${lazy} decoding="async" onerror="this.remove()">`;
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

/**
 * The secret rares, drawn, one bar per set.
 *
 * WHY THIS SECTION EARNED A PICTURE. It carried four big numbers and 1,536
 * characters with no figure at all, between a section holding 141 set symbols
 * and one holding none. But the reason to draw it is that the section's claim
 * is about a GAP: a card numbered above its set total is normal, and the four
 * facts state that gap for exactly one set (Paldean Fates, 91 printed, 245
 * actual) while asserting it holds across 27. A reader has no way to see the
 * other 26 from the prose.
 *
 * THE GAP IS THE SUBJECT, SO THE GAP IS THE INK. Each bar runs to the set's
 * printed total in a pale fill and then keeps going, in solid ink, for exactly
 * as many cards as are numbered past it. The dark tail IS the secret rares, so
 * the thing the section is about is the thing the eye lands on, and the two
 * halves are separated by fill weight rather than by hue: it reads with colour
 * removed entirely, which is the property a two-part bar most needs.
 *
 * ALL 27 ARE DRAWN AND THAT IS THE ARGUMENT, NOT A COMPLETENESS TIC. Showing a
 * top ten would illustrate "some sets run past their total"; showing every set
 * that does it, next to the one that does not, is what shows a reader it is the
 * normal case. Sorted by how far past each set runs, so the page's headline
 * example is the top bar rather than something to hunt for.
 */
// "secret rares" rather than "numbered past it", and it is shorter AND better:
// it is the term the section's own lede introduces, so the legend names the
// thing the paragraph named instead of paraphrasing it.
const LEG_A = "printed checklist";
const LEG_B = "secret rares";

function secretChart(rows, noneCount) {
  if (rows.length < 5) return "";
  const list = rows.slice().sort((a, b) => b.secretCount - a.secretCount);
  const maxTotal = Math.max(...list.map((g) => g.total));
  // A round domain so the ticks are whole hundreds.
  const dom = Math.ceil(maxTotal / 100) * 100;

  const W = 360, NAMEX = 122, X0 = 130, X1 = 326;
  const TOP = 40, BH = 10, BG = 3.5;
  const x = (n) => X0 + (n / dom) * (X1 - X0);

  // SPACE MONO ADVANCES 0.6em. SVG neither wraps nor clips, so a set name
  // longer than its gutter paints straight over the bars and renders clean.
  const NAME_PX = 10;
  const longest = Math.max(...list.map((g) => g.name.length));
  if (longest * NAME_PX * 0.6 > NAMEX - 2) {
    throw new Error(
      `secretChart: "${list.find((g) => g.name.length === longest).name}" is ${(longest * NAME_PX * 0.6).toFixed(1)}px ` +
        `at ${NAME_PX}px but the name gutter is ${NAMEX - 2}px`,
    );
  }

  let y = TOP;
  let body = "";
  for (const g of list) {
    const xp = x(g.printedTotal);
    const xt = x(g.total);
    const val = `+${g.secretCount}`;
    if (val.length * 10 * 0.6 > W - (xt + 4)) {
      throw new Error(`secretChart: the "${val}" label does not fit past ${g.name}'s bar`);
    }
    body += `<text x="${NAMEX}" y="${(y + BH - 1.5).toFixed(1)}" text-anchor="end" class="ws-cname">${esc(g.name)}</text>
      <rect x="${X0}" y="${y.toFixed(1)}" width="${(xp - X0).toFixed(1)}" height="${BH}" class="ws-bar-a"/>
      <rect x="${xp.toFixed(1)}" y="${y.toFixed(1)}" width="${(xt - xp).toFixed(1)}" height="${BH}" class="ws-bar-b"/>
      <text x="${(xt + 4).toFixed(1)}" y="${(y + BH - 1.5).toFixed(1)}" class="ws-cval">${esc(val)}</text>`;
    y += BH + BG;
  }

  const AX = y + 2;
  let ticks = "";
  for (let t = 0; t <= dom; t += 100) {
    ticks += `<line x1="${x(t).toFixed(1)}" y1="${TOP - 6}" x2="${x(t).toFixed(1)}" y2="${AX.toFixed(1)}" class="ws-cgrid" stroke-width="1"/>
    <text x="${x(t).toFixed(1)}" y="${(AX + 14).toFixed(1)}" text-anchor="middle" class="ws-ctick">${t}</text>`;
  }
  const H = AX + 24;
  const total = list.reduce((n, g) => n + g.secretCount, 0);

  // THE LEGEND NEEDS THE SAME GUARD THE NAMES AND THE VALUES GOT, and it did
  // not have one. "numbered past it" set at x=274 is 96 units in a 360 unit
  // box, so it ran to 370 and the last word was simply outside the picture.
  // The markup was valid, the CSS was right, both other budgets passed, and
  // the only place it appeared was a screenshot. Hence: everything that lands
  // a string in this svg goes through a budget, not just the loops.
  const leg = (label, sx, px) => {
    if (label.length * px * 0.6 > W - (sx + 18)) {
      throw new Error(
        `secretChart: legend "${label}" is ${(label.length * px * 0.6).toFixed(1)}px at x=${sx + 18}, past the ${W} unit box`,
      );
    }
    return `<rect x="${sx}" y="14" width="14" height="9" class="${label === LEG_A ? "ws-bar-a" : "ws-bar-b"}"/>
    <text x="${sx + 18}" y="22" class="ws-cleg">${esc(label)}</text>`;
  };

  return `<figure class="ws-fig">
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="One bar per set, ${list.length} of them, sorted by how far each runs past its own printed checklist. Each bar is pale up to the set's printed total and solid for every card numbered above it. ${esc(list[0].name)} is the longest tail, ${list[0].secretCount} cards past a printed total of ${list[0].printedTotal}. Across all ${list.length} sets it is ${total.toLocaleString("en-US")} cards.">
    ${ticks}
    ${leg(LEG_A, X0, 10)}
    ${leg(LEG_B, X0 + 126, 10)}
    ${body}
    <line x1="${X0}" y1="${AX.toFixed(1)}" x2="${X1}" y2="${AX.toFixed(1)}" class="ws-caxis" stroke-width="1.2"/>
  </svg>
  <figcaption>Every set on this page that prints cards past the end of its own checklist, longest tail first. The
    dark part of each bar is the secret rares, so a card numbered inside it still reads out of the pale part: that is
    why ${esc(list[0].name)} cards all say ${list[0].printedTotal} on the right of the slash whatever the left says.
    ${noneCount === 1 ? "One set here does not do it at all." : `${noneCount} sets here do not do it at all.`}</figcaption>
</figure>`;
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

const FAQ = faqBlock(
  [
    [
      "What does the number on the bottom of a Pokemon card mean?",
      `It is two numbers with a slash between them. The left one is that card's place in the set and the right one is ` +
        `how many cards the set was printed with, so 45/102 is the forty-fifth card of a 102 card set. The right number ` +
        `is the one that identifies the set: across the ${main.length} main English expansions there are ${totals.length} ` +
        `different set sizes, and ${unique.length} of them belong to exactly one set.`,
    ],
    [
      "How do I tell which set a Pokemon card is from?",
      `Start with the number after the slash and narrow it with the symbol printed next to it. The number alone lands ` +
        `on a single set ${unique.length} times out of ${totals.length}; the rest are shared by two or more, with ` +
        `${worst} used by ${worstSets.length} different sets. The symbol tells those apart. It sits in the bottom right ` +
        `corner on cards up to the XY era and moved to the bottom left in 2017 at Sun and Moon.`,
    ],
    [
      "Why is my card numbered higher than the set total?",
      `Because it is a secret rare: a card numbered above the printed set size, so a card reading 199/198 is real and ` +
        `is the kind of card people are hoping for. Across the ${withSecrets.length} sets this site holds full checklists ` +
        `for there are ${secretTotal.toLocaleString("en-US")} cards numbered above their own set total, ` +
        `${mostSecrets.secretCount} of them in ${mostSecrets.name} alone.`,
    ],
  ],
  {
    heading: "The card number questions, answered short",
    path: "/what-set.html",
    site: SITE,
  }
);


const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "What set is my card from?", item: `${SITE}/what-set.html` },
    ],
  },
  FAQ.ld,
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
// COMMENTS OUT OF THE SHIPPED PAGE, ARGUMENT KEPT IN THIS FILE. Same trade
// build-css.mjs makes for ui.css, and the same helper and the same regex ten
// other builders on this site already use: build-buying.mjs and
// build-complete.mjs both carry it with the argument written out, and it is
// theirs rather than a new idea. Comments, plus the indentation between rules.
// Nothing else.
//
// It is here because this block is inline in a render blocking <head> and
// because the desktop rules added below on 21 August 2026 came with the
// measurements that justify them written alongside, which is the site's own
// convention and is not negotiable. Measured on the built page, in BYTES rather
// than characters, because this page carries an accented Pokemon and a hundred
// bullet glyphs and the two counts differ by 19:
//
//      style block   13,573 bytes, of which 9,930 are comment
//      page          103,243 raw / 20,699 gzipped  unstripped
//      page           93,243 raw / 16,214 gzipped  stripped
//
// The page was 96,251 / 17,852 before this pass. So the two-column index and
// the two-up facts lists cost the reader NOTHING and give back 1,638 gzipped
// bytes, and the whole argument for them is still in this file where the next
// editor will read it.
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const style = `
.ws-tool{background:var(--card);border:2px solid var(--keyline);border-radius:var(--r);
  padding:var(--s5);box-shadow:var(--hard-lg);margin-top:var(--s5)}
.ws-tool label{display:block;font:700 var(--t-label)/1 var(--mono);letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink-soft);margin-bottom:var(--s2)}
.ws-tool input{width:100%;box-sizing:border-box;min-height:52px;padding:0 var(--s4);
  border:2px solid var(--keyline);border-radius:var(--r);background:var(--paper-2);
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
/* --sky-deep, not --navy. --navy is an INK now (#EEF1EF) and an ink-coloured
   link inside ink-coloured prose is not a link, it is underlined text. The
   accent reads 6.24:1 on the page and 4.50:1 on a card, both past AA. */
.ws-set a{color:var(--sky-deep);text-decoration:underline;text-underline-offset:2px;font-weight:700}
.ws-yr{font-family:var(--mono);font-size:.68rem;color:var(--ink-soft);white-space:nowrap}
.ws-badge{font-family:var(--mono);font-size:.6rem;text-transform:uppercase;letter-spacing:.06em;
  background:var(--mustard);color:var(--on-accent);border:1px solid var(--keyline);border-radius:var(--r-pill);
  padding:1px 7px;white-space:nowrap}
/* THE COLOUR ON THAT LINE IS NOT DECORATION. --mustard is a light teal fill
   now, so the inherited --ink wrote #EEF1EF on #70B5D9 at 1.99:1 and the badge
   read as an empty pill. --on-accent is the token for exactly this and
   measures 7.22:1 on the same fill. */
.ws-empty{padding:var(--s5) 0;font-size:var(--t-sm);color:var(--ink-soft)}
/* The secret-rare chart.
   IT USED TO SAY "EVERY FILL IS A LITERAL HEX ON PURPOSE", and the reason was
   sound: --navy and --ketchup were both #111111, so a two-part bar written
   against the tokens was one solid black bar with an invisible join and
   nothing errored. THE FILLS ARE CLASSES NOW, WHICH KEEPS THAT GUARANTEE AND
   ALSO SURVIVES A PALETTE MOVE. The trap was writing var() into a
   presentation ATTRIBUTE, which paints nothing; a fill: declaration in a
   stylesheet honours var() perfectly well, so the two bar parts get .ws-bar-a
   and .ws-bar-b here and the svg carries no colour at all. Two named tokens
   that cannot collide is the same protection the literals bought.

   THE SPLIT IS STILL A WEIGHT DIFFERENCE AND IT IS NOW THE OTHER WAY UP. On
   the white card the pale part was --paper-3 #E6E4DD and the solid part was
   #111111. The card is #2F4F39 now, so the pale part is the one nearer the
   ground: --keyline #86998C at 3.02:1 on the card, and the solid part is
   --ink #EEF1EF at 8.03:1. Colour removed, it is still light-vs-lighter.

   THE JOIN IS 2.66:1 AND THAT IS THE BEST ANY TWO-TONE SPLIT CAN DO HERE, not
   a value somebody eyeballed. A middle tone has to clear the card ground on
   one side and the solid part on the other, and the two demands pull opposite
   ways: solving for the tone that balances them gives 2.83:1 in both
   directions and nothing beats it, so 3:1 at the join AND 3:1 against the
   ground is arithmetically impossible while the solid part is --ink. The join
   is not the only carrier: every bar prints its own +N beside it and the
   legend names both parts.
   max-width 520px matches the drawn figures on /base-set.html.
   NOTHING HERE IS UNDER 10px AND THE VALUE LABELS USED TO BE 9. A 360 unit box
   renders 332px wide at 390, so a unit is 0.922px and 9px lands at 8.30, under
   the point a label stops being readable on a phone. It was justified in this
   comment as "a repeat of the bar beside it", which was wrong twice over: the
   bar shows the LENGTH and only the label carries the count, and it was the
   one measured number in the figure that failed its own test. 10px lands at
   9.22 and every budget still passes with room. */
.ws-fig{margin:var(--s5) 0 0;background:var(--card);border:1px solid var(--hair);
  border-radius:10px;padding:var(--s4) var(--s4) var(--s3);max-width:620px}
.ws-fig svg{display:block;width:100%;height:auto;max-width:520px;margin-inline:auto}
.ws-fig text{font-family:var(--mono)}
/* Measured on the .ws-fig ground, --card #2F4F39: the names and the legend
   8.03:1, the values and the ticks 5.86:1, all past the 4.5:1 AA needs at
   10px. The grid rungs are 1.44:1 and stay that way on purpose, exactly as
   they were 1.35:1 on the white card: they are a ruled ground for the bars
   and every one of them carries its own number underneath. */
.ws-cname{font-size:10px;font-weight:400;fill:var(--ink)}
.ws-cval{font-size:10px;font-weight:700;fill:var(--ink-2)}
.ws-ctick{font-size:10px;font-weight:400;fill:var(--ink-2)}
.ws-cleg{font-size:10px;font-weight:700;fill:var(--ink)}
.ws-bar-a{fill:var(--keyline)}
.ws-bar-b{fill:var(--ink)}
.ws-cgrid{stroke:var(--ink);stroke-opacity:.14}
.ws-caxis{stroke:var(--ink)}
.ws-fig figcaption{font-size:var(--t-sm);color:var(--ink-2);line-height:1.5;
  margin-top:var(--s3);max-width:46em}
@media(min-width:640px){
  .ws-row{grid-template-columns:120px 1fr;gap:var(--s4);align-items:start}
  .ws-n{justify-content:flex-end;flex-direction:column;align-items:flex-end;gap:2px}
}

/* ==========================================================================
   THE INDEX IS 62% OF THIS PAGE AND IT WAS ONE 592px COLUMN IN A 1,392px BAND,
   fixed 21 August 2026. Measured at 1440x900, box against the rightmost PAINTED
   pixel inside it, which is the test that matters here because the box was
   never the problem: every .ws-row spans 24..1416 and none of them paints past
   the middle of it.

       ol.ws-list      6,489px of a 10,401px main
       li.ws-row  x86  box 24..1416   ink 420..592   avg fill 34%
       ul.facts-list   box 24..1416   ink 571        x3, 1,221px of page

   AND THE ROW RULES ARE WHAT MADE IT READ AS BROKEN RATHER THAN AS NARROW.
   .ws-row carries a border-bottom, so 86 hairlines were being drawn the full
   1,392px under content that stopped at 500. A rule under nothing is not a
   quiet defect the way a short paragraph is: it draws the empty half.

   THE ANSWER IS LAYOUT AND NOT DECORATION, which is the precedent CLAUDE.md
   sets for the home page, and this page is the same shape as the carousel that
   set it: at 1440 that page showed two videos in its first 3,307px with 872px
   of empty band either side of every card, and the sentence the fix is written
   under is "the desktop fix is not a wider card, it is more of them". An index
   row cannot be made wider. There are 86 of them, so there is more of them.

   592px IS MEASURED AND IT IS THE SAME AT EVERY DESKTOP WIDTH, which is the
   whole reason auto-fill is right here and a breakpoint is not. A row is a
   120px number gutter and a set line that does not wrap, so its ink does not
   move when the band does: p50 482, p90 528, p99 592, max 592, identical at
   1000, 1100, 1200, 1280, 1440, 1600 and 1920. Every pixel past 592 was empty
   BY CONSTRUCTION and no width was ever going to fill it. The widest row is
   /123, which is Mysterious Treasures and HeartGold and SoulSilver with a
   secret badge on each.

   So the track minimum is that measured 592 rather than a share of the band,
   and repeat(auto-fill) works out how many fit. THE THRESHOLD IS 1256px AND IT
   WAS READ OFF THE PAGE RATHER THAN PREDICTED, because the first version of this
   comment said 1280 and was wrong by 24 pixels: .wrap is border-box, so the
   two gutters come out of it before the tracks are laid, and 1256 less
   var(--gut) either side is 1,208, which is 592 + 24 + 592 to the pixel.
   Stepped one pixel at a time on the built page, tracks read off
   getComputedStyle and the list height beside them:

       1255   1207px                    one column    list 6,489px
       1256   592px 592px               two columns   list 3,669px
       1257   592.5px 592.5px           two columns   list 3,644px
       1280   604px 604px               two columns   list 3,644px
       1440   684px 684px               two columns   list 3,644px

   so nothing is ever squeezed: the narrowest column this rule can produce is
   the widest row that exists, which is what a picked breakpoint could not
   promise. The 25px between 3,669 and 3,644 is one row wrapping at exactly
   592.0 and unwrapping at 592.5, which is the headroom being spent and is the
   only width where it is.

   THE FAILURE MODE IS GRACEFUL AND WAS CHECKED RATHER THAN ASSUMED, because
   the data grows: .ws-set is flex-wrap with min-width:0 already, for the reason
   its own comment gives about 390px, so a future set name past 592 wraps to a
   second line and makes ONE row taller. It cannot overflow and it cannot
   scroll the page sideways.
   A 560px minimum would buy two columns from about 1192 as well, at the price
   of wrapping the handful of rows between 560 and 592. That is a real trade and
   it was rejected in favour of the measured number, which promises that no row
   wraps that did not wrap before. If a later editor wants 1200, that is the
   knob, and the rows it costs are the ones above p90.

   align-items IS LEFT AT stretch, DELIBERATELY, AND IT COSTS HEIGHT. A row
   stretches to its neighbour so the two border-bottoms land on one line and the
   index reads as a ruled table across the whole band. Letting them sit at their
   own heights is tighter and gives two ragged ladders of hairlines, which is
   the defect above wearing a different hat.

   min-width:1000 like every desktop rule on this site, so 320, 390 and 768 are
   byte-identical. It is a no-op from 1000 to 1279, where auto-fill resolves to
   one track, and that is correct rather than wasteful: one column IS the right
   answer until two of them fit.
   ========================================================================== */
@media(min-width:1000px){
  .ws-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(592px,1fr));
    column-gap:var(--s5)}
}

/* THE QUICK FACTS GO TWO UP AT 1200, and this is the site's existing rule
   rather than a new idea: build-complete.mjs, build-set-pages.mjs and
   build-pack-prices.mjs all do exactly this to .facts-list at exactly this
   breakpoint with the same max-width:none on the item. Read the long comment in
   build-complete.mjs before changing it; the half worth repeating is that
   capping the item instead made that page 446px TALLER and still left 873px of
   empty band, because a cap fixes the measure by throwing the width away.
   Three lists here, 1,221px of page, items inking to 525 of 1,392. */
@media(min-width:1200px){
  .facts-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
    gap:11px;align-items:start}
  .facts-list li{max-width:none}
}

/* THE CHART GETS THE PARAGRAPH THAT IS ABOUT IT, rather than being centred or
   left where it was. 620x748 at x=24..644 with 772px of empty band beside it,
   and the very next element is the paragraph explaining what the chart means,
   680px wide and 105px tall, stacked underneath. That is a companion the page
   already owned and was not using, which is the /retailers/ case rather than
   the /tcg-pocket.html one: centring is for a page with nothing to put beside
   the text, and this is not that page.

   THE TRACK IS THE FIGURE'S OWN WIDTH. .ws-fig is max-width:620px, so the first
   track is 620 flat and the paragraph takes what is left. At 1100 that is 400px
   and the paragraph grows from 105px to about 180, still well inside the
   figure's 748, so the row costs NO height and gives back the 121px the stacked
   paragraph was spending. Below 1100 the second track would be under 300px,
   which is too narrow for prose, so that is where it starts.

   IT IS ONE WRAPPER AND IT IS ONLY EMITTED WHEN THERE IS A CHART, because
   secretChart returns an empty string under five rows and a grid whose first
   track is a 620px figure that does not exist would pin the paragraph into
   column two. */
@media(min-width:1100px){
  .ws-figrow{display:grid;grid-template-columns:620px minmax(0,1fr);
    gap:var(--s6);align-items:start}
  .ws-figrow > .ws-fig{margin-top:0}
  .ws-figrow > p{margin-top:0}
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

// Built once rather than inline in the page, because the .ws-figrow wrapper
// below has to know whether there IS a figure before it opens a grid whose
// first track is one. secretChart returns an empty string under five rows.
const chart = secretChart(withSecrets, withGuide.length - withSecrets.length);

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
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-what-set.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
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
<style>${miniCSS(style)}
${FAQ_CSS}</style>
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
    ${chart ? `<div class="ws-figrow">` : ""}${chart}
    <p style="max-width:40em;margin-top:16px">So the number after the slash still identifies the set even on a secret
      rare: ${esc(mostSecrets.name)} cards all read out of ${mostSecrets.printedTotal} whether they are card 12 or card
      ${mostSecrets.total}. Rows in the index above carry a badge saying how far past the printed total each set runs.
      What those cards are actually called is on the <a href="/rarity.html">rarity guide</a>, and what they are worth is
      on <a href="/cards.html">card search</a>.</p>${chart ? `</div>` : ""}
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

${FAQ.html}

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
