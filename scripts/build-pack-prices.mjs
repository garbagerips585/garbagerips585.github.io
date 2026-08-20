#!/usr/bin/env node
// Generate /pack-prices.html: what one pack actually costs, across every set.
//
//   node scripts/build-pack-prices.mjs
//
// Reads public/data/products.json and public/data/sets.json. No new data and no
// new source: this is division over the sealed-product prices the site already
// pulls nightly, so it re-prices itself every time sync-products.mjs runs.
//
// WHY THIS PAGE EXISTS. Every set guide answers "what does a pack of THIS set
// cost". Nothing on the site answered "what does a pack cost", which is the
// question somebody types after watching a rip and before deciding whether to
// buy anything, and it is a question you cannot answer from one set page
// because the whole content of the answer is the comparison. The spread across
// the sets on the table is nearly six to one for the same object. (That number
// of sets is NOT written here on purpose: it read "these 23 sets" while
// products.json had gone five sets stale behind sets.json, and a count written
// into a comment is a count nobody re-checks.)
//
// AND THE ANSWER IS NOT THE ONE EVERY ARTICLE GIVES. The received wisdom is
// "the bigger the box, the cheaper the pack". Measured over the sets we hold
// prices for, a single pack is the cheapest pack in the majority of them. That
// is a real, checkable finding, it changes what somebody buys, and it is the
// page.
//
// PACK COUNTS COME OFF THE BLURB, NOT OFF THE PRODUCT KIND, and this is the one
// place this page could have published a number that is wrong by half. This
// logic is deliberately the same as packsIn()/perPack() in build-set-pages.mjs,
// whose own comment records why: seventeen of the products in this file carry a
// size word in the NAME ("Half Booster Box", "Enhanced Booster Box", "Mini
// Tin"), and a table keyed on `kind` would divide a half box by 36 and print a
// per-pack price around half the real one. A product whose pack count is not
// stated is left out of every figure here rather than estimated.
//
// It is duplicated rather than imported because build-set-pages.mjs does not
// export it. If you change one, change the other: the two pages print per-pack
// figures for the same products and a reader will compare them.
//
// NO EXPECTED VALUE, EVER. "Is this box worth it" in the sense people usually
// mean needs pull rates, and The Pokemon Company does not publish them. This
// page costs the packs and stops. Everything on it is a price divided by a
// printed pack count.

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
import { esc, longDate, moneyExact, noValue } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const products = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const meta = new Map(sets.map((s) => [s.id, s]));

let expansions = [];
try {
  expansions = JSON.parse(await readFile(join(ROOT, "public/data/expansions.json"), "utf8")).sets || [];
} catch {
  /* run: node scripts/sync-expansions.mjs */
}
// rips-per-set, so a row can offer the thing this site has and a price tracker
// does not: the set being opened on camera. Keyed on the guide slug the
// expansion sync already stamps, never re-derived from the name.
//
// COUNTED FROM videos.json, NOT READ OFF expansions.json. The `rips` field in
// that snapshot is written when the expansion sync last ran and goes stale the
// moment another rip is tagged, which is nightly. This page was publishing "19
// rips on the channel" for Pitch Black while the home page, /sets/ and
// /expansions.html all said 21, and "50" for Chaos Rising against their 52.
// build-expansions.mjs hit this first and fixed it the same way; this was the
// last reader of the stale field.
const { videos: allVideos } = JSON.parse(
  await readFile(join(ROOT, "public/data/videos.json"), "utf8")
);
const ripsFor = new Map(expansions.filter((s) => s.slug).map((s) => [s.slug, 0]));
for (const v of allVideos) {
  for (const sid of v.sets || []) if (ripsFor.has(sid)) ripsFor.set(sid, ripsFor.get(sid) + 1);
}

/* ------------------------------------------------- "N rips" WAS NOT A LINK
 *
 * Every row on this page prices one pack of one set and then said, in plain
 * unlinked text, that the channel has opened it N times. That is the single
 * most relevant thing this site can offer somebody looking at a pack price,
 * and it was a caption. A price tracker can print the number; only this site
 * can show the pack coming open.
 *
 * WHERE IT GOES DEPENDS ON WHAT THE TEXT SAYS, which is the same rule
 * build-expansions.mjs applies to the same sentence. "54 rips" goes to
 * /videos.html filtered by the set, because a plural asks for a list. "1 rip"
 * goes STRAIGHT TO THAT RIP, because sending somebody to an index holding a
 * single tile is a tap spent on nothing. Two or more never resolves to one
 * video: picking one would be choosing a favourite and hiding the rest, and
 * there is no honest label for that.
 */
const soleRipFor = new Map();
for (const [sid, n] of ripsFor) {
  if (n !== 1) continue;
  const v = allVideos.find((x) => (x.sets || []).includes(sid));
  if (v?.path) soleRipFor.set(sid, v);
}

/**
 * The product kinds this page will divide, in the order the table shows them.
 *
 * A kind is listed here only when every product of that kind carries a pack
 * count in its blurb. Blisters, tins and collection boxes are deliberately
 * absent: sync-products.mjs writes them "Packs plus a promo" with no number
 * because the number varies by product and is not in our data, so there is
 * nothing to divide and nothing to guess.
 */
const COLUMNS = ["Booster Box", "Elite Trainer Box", "Booster Bundle", "Build & Battle Box", "Single Pack"];

/** See the header note. Same rule as build-set-pages.mjs, on purpose. */
const SIZE_WORD = /\b(half|enhanced|mini|jumbo|premium|double)\b/i;

/**
 * THE BLURB IS ONLY SOURCED FOR THE ERA IT WAS WRITTEN ABOUT, and this page
 * divided by it outside that era for as long as it existed.
 *
 * Every blurb here is a per-KIND constant hardcoded in sync-products.mjs, not a
 * string read off any particular product. "9 packs plus sleeves and dice" is
 * carried by all 23 Elite Trainer Box entries. Nine is right for a main
 * expansion from the Scarlet & Violet era onward, confirmed on four pokemon.com
 * product pages and three official expansion pages (see
 * data/pack-counts-current.json and /how-many-packs.html). It is NOT a fact
 * about Elite Trainer Boxes: the first one held seven, it was eight for nine
 * years, and most special expansions from Generations to Crown Zenith held ten.
 *
 * SIX sets in this table predate that window and every one of them was being
 * divided by the current constants: Rebel Clash, Shining Fates, Chilling Reign,
 * Celebrations, Pokemon GO and Crown Zenith. The Celebrations row was the worst
 * of them. That Elite Trainer Box held ten Celebrations packs plus five from
 * other Sword & Shield sets, and Celebrations packs are four cards each, so the
 * page was dividing a fifteen-pack box by nine and calling the result the price
 * of a pack. We hold no source for any of those six counts, so the honest output
 * is an empty cell rather than a plausible one, which is the rule the SIZE_WORD
 * gate above already applies to half and enhanced boxes.
 *
 * The date is the Scarlet & Violet base set release, which is also when the
 * Booster Bundle was invented, so it is the boundary for these generics rather
 * than an arbitrary cutoff. "Single Pack" is exempt because one pack is one
 * pack in every era.
 */
const GENERIC_FROM = "2023-03-31";

function packsIn(p, released) {
  if (SIZE_WORD.test(p.name || "")) return null;
  if (p.kind !== "Single Pack" && String(released || "") < GENERIC_FROM) return null;
  const blurb = String(p.blurb || "");
  const m = /^(\d+)\s+packs?\b/i.exec(blurb);
  const n = m ? Number(m[1]) : /^one pack\b/i.test(blurb) ? 1 : null;
  if (n === null) return null;
  if (!Number.isInteger(n) || n < 1 || n > 40) {
    throw new Error(`packsIn: "${p.name}" parsed ${n} packs out of "${blurb}", which cannot be right.`);
  }
  if (p.kind === "Single Pack" && n !== 1) {
    throw new Error(`packsIn: "${p.name}" is a Single Pack but its blurb says ${n} packs.`);
  }
  return n;
}

/** Market price per pack, or null where the pack count is not knowable. */
function perPack(p, released) {
  const packs = packsIn(p, released);
  const market = typeof p.market === "number" && p.market > 0 ? p.market : null;
  if (!packs || market === null) return null;
  const each = market / packs;
  // A per-pack figure above the price of the whole product means the division
  // went the wrong way round. Cheaper to throw than to print it.
  if (!Number.isFinite(each) || each <= 0 || each > market + 0.005) {
    throw new Error(`perPack: "${p.name}" gives ${each} per pack from ${market} over ${packs} packs.`);
  }
  return { packs, each, market };
}

const rows = [];
for (const [id, entry] of Object.entries(products.sets || {})) {
  const set = meta.get(id);
  if (!set || !entry?.products?.length) continue;

  // One figure per KIND. Where a set lists several products of one kind, the
  // cheapest per pack wins, because that is the one somebody would buy.
  const byKind = new Map();
  for (const p of entry.products) {
    if (!COLUMNS.includes(p.kind)) continue;
    const e = perPack(p, set.released);
    if (!e) continue;
    const prev = byKind.get(p.kind);
    if (!prev || e.each < prev.each) byKind.set(p.kind, { ...e, name: p.name, url: p.url });
  }
  if (!byKind.size) continue;

  let best = null;
  for (const [kind, e] of byKind) if (!best || e.each < best.each) best = { kind, ...e };
  // The headline of every row is "cheapest per pack, and which product it is
  // inside". If those two ever disagree the row is lying about the one thing it
  // is for, so it is checked rather than assumed.
  const lowest = Math.min(...[...byKind.values()].map((e) => e.each));
  if (Math.abs(best.each - lowest) > 1e-9 || byKind.get(best.kind)?.each !== best.each) {
    throw new Error(`${set.name}: cheapest-per-pack row disagrees with its own columns`);
  }

  rows.push({
    id,
    name: set.name,
    released: set.released,
    kinds: Object.fromEntries(byKind),
    best,
    rips: ripsFor.get(id) ?? 0,
    checked: entry.checked || products.checked,
  });
}

rows.sort((a, b) => a.best.each - b.best.each);

if (rows.length < 20) {
  throw new Error(
    `Only ${rows.length} sets produced a per-pack figure. products.json covers ` +
      `${Object.keys(products.sets || {}).length}; something has emptied out.`,
  );
}

const cheapest = rows[0];
const priciest = rows[rows.length - 1];
const spread = priciest.best.each / cheapest.best.each;

// THE FINDING. A single pack, bought one at a time, is the cheapest pack in the
// set. Counted only where the set offers something else to lose to, or it would
// be counting sets that sell nothing but packs.
const packWins = rows.filter(
  (r) => r.best.kind === "Single Pack" && Object.keys(r.kinds).length > 1,
);
const boxWins = rows.filter((r) => r.best.kind !== "Single Pack" && r.kinds["Single Pack"]);
// Sets where a booster box exists in our data AND its pack count is known.
const withBox = rows.filter((r) => r.kinds["Booster Box"]);
const noBox = rows.filter((r) => !r.kinds["Booster Box"]);

const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// What an Elite Trainer Box costs per pack against the cheapest pack in the SAME
// set. Compared to the set's own floor rather than to a booster box, because
// only a handful of these sets have a booster box we can divide.
const etbRatios = rows.filter((r) => r.kinds["Elite Trainer Box"]).map((r) => ({
  set: r,
  x: r.kinds["Elite Trainer Box"].each / r.best.each,
}));
const etbMedian = median(etbRatios.map((r) => r.x));
const etbWorst = etbRatios.slice().sort((a, b) => b.x - a.x)[0];
const etbBest = etbRatios.slice().sort((a, b) => a.x - b.x)[0];
// Two different claims, and the first draft of this page made the stronger one
// without checking it. The ETB is NOT the dearest pack in every set: on some it
// loses to a loose pack or a bundle. It has never once been the cheapest, which
// is the claim that survives.
const etbSets = rows.filter((r) => r.kinds["Elite Trainer Box"]);
const etbDearest = etbSets.filter((r) => {
  const vals = Object.values(r.kinds).map((e) => e.each);
  return r.kinds["Elite Trainer Box"].each >= Math.max(...vals);
});
const etbCheapest = etbSets.filter((r) => r.best.kind === "Elite Trainer Box");
if (etbCheapest.length) {
  // Not a failure, but the copy below says "never the cheapest" and would
  // become false. Better to stop the build than to print it.
  throw new Error(
    `The Elite Trainer Box is now the cheapest pack in ${etbCheapest.length} set(s) ` +
      `(${etbCheapest.map((r) => r.name).join(", ")}). Rewrite the ETB section: it says never.`,
  );
}

// The two ends of the table, checked rather than described. Both clauses below
// are only written if the data still says them, because "the cheapest sets are
// the ones where the box wins" is the kind of sentence that is true on the day
// it is typed and silently false three price syncs later.
const headEnd = rows.slice(0, 3);
const tailEnd = rows.slice(-2);
const headAllBoxed = headEnd.every((r) => r.best.kind !== "Single Pack");
const tailAllLoose = tailEnd.every((r) => r.best.kind === "Single Pack");
// EACH CLAUSE HAS TO STAND ON ITS OWN, because either can be dropped. The tail
// clause used to read "on the 2 priciest the loose pack does", which borrowed
// its verb from the head clause: the day the head clause stopped being true
// (Chaos Rising, the second cheapest set, is cheapest bought loose) the page
// printed "It is not a rule that can be applied from the outside, on the 2
// priciest the loose pack does, so the only way to know...", where "does" has
// nothing to do. With both clauses false it printed a doubled comma instead.
const endsClause = [
  headAllBoxed
    ? `on the ${headEnd.length} cheapest sets here the cheapest pack comes inside a box or a bundle`
    : "",
  tailAllLoose ? `on the ${tailEnd.length} priciest the cheapest pack is bought loose` : "",
]
  .filter(Boolean)
  .join(", and ");

/**
 * THE PAGE'S OWN HEADLINE, DRAWN.
 *
 * WHAT THIS SECTION SAID AND COULD NOT SHOW. "The bigger box is not the cheaper
 * pack. Of the 22 sets that sell a pack both ways, that holds 9 times and fails
 * 13." That is the most useful sentence on the page and it is a sentence about
 * a shape, delivered as two numbers. The evidence for it was the table below,
 * which is 28 rows by 5 columns and, measured at 390px, shows the set name, the
 * cheapest pack and part of one more column before it runs off the right hand
 * edge. A reader standing in a shop holding an Elite Trainer Box cannot see the
 * five prices at once, which is precisely the comparison the whole page exists
 * to make. So the claim gets a picture and the table stays where it is for the
 * reader who wants the actual dollars.
 *
 * IT PLOTS A RATIO, NOT A PRICE, AND THAT WAS THE SECOND DESIGN. Plotting the
 * two dollar figures on one axis was tried first and is nearly useless here:
 * the axis has to run to $30 to hold 151, so Phantasmal Flames' 27 cent gap is
 * three pixels and 22 sets read as 22 identical dots. The interesting quantity
 * is not how much a pack costs, which the table already prints, it is how much
 * the box costs you AGAINST buying loose in the same set. As a multiple of the
 * loose price that runs 0.6x to 1.34x and every bar is legible.
 *
 * ZERO IS AT 1.00 AND THE DIRECTION IS THE WHOLE POINT. A bar to the left is a
 * set where the bigger box really is cheaper per pack; a bar to the right is a
 * set where buying one pack at a time beats every box in it. Thirteen bars go
 * right. The received wisdom is visibly a coin flip, which is a thing a reader
 * takes in before they have read a word of the paragraph beside it.
 *
 * ONLY THE SETS THAT CAN LOSE ARE ON IT, the same filter boxWins and packWins
 * already use: a set that sells nothing but loose packs has no comparison to
 * draw and would sit on the line looking like a tie. The count under the chart
 * is drawn from the chart's own rows rather than restated, so it cannot drift
 * from the paragraph above it.
 */
function boxVsLoose() {
  const pts = rows
    .filter((r) => r.kinds["Single Pack"] && Object.keys(r.kinds).length > 1)
    .map((r) => {
      const loose = r.kinds["Single Pack"].each;
      let bigKind = null, big = Infinity;
      for (const [kind, e] of Object.entries(r.kinds)) {
        if (kind !== "Single Pack" && e.each < big) { big = e.each; bigKind = kind; }
      }
      return { name: r.name, loose, big, bigKind, x: big / loose };
    });
  if (pts.length < 5) return "";
  // The chart is the same claim as the prose, so it is checked against it
  // rather than trusted to agree: a bar drawn on the wrong side of the line
  // while the paragraph says the opposite is the failure mode here.
  const right = pts.filter((p) => p.x > 1).length;
  if (right !== packWins.length || pts.length - right !== boxWins.length) {
    throw new Error(
      `box-vs-loose chart has ${right} sets where loose wins and ${pts.length - right} where a box does, ` +
        `against ${packWins.length} and ${boxWins.length} in the paragraph above it.`,
    );
  }

  // 430 UNITS WIDE AND NOT 660, AND THAT IS ABOUT THE PHONE. This figure sits
  // inside .fk-golden, which has its own padding inside the wrap's, so at 390px
  // it renders 318px wide. At a 660 unit viewBox that is a scale of 0.48 and a
  // 13 unit set name comes out at 6.3px, which is a smudge. Measured, not
  // guessed: .bv svg is 318px at 390 and 1344 before the max-width caps it. At
  // 430 the same name is 9.6px on a phone and 17px on a desktop.
  const W = 430, LBL = 142, ROW = 22, HEAD = 30, FOOT = 26;
  const H = HEAD + pts.length * ROW + FOOT;
  const PLOT = W - LBL - 40; // 40 for the multiple printed at the end of a bar
  const lo = Math.min(0.95, Math.floor(Math.min(...pts.map((p) => p.x)) * 10) / 10);
  const hi = Math.max(1.05, Math.ceil(Math.max(...pts.map((p) => p.x)) * 10) / 10);
  const px = (v) => LBL + ((v - lo) / (hi - lo)) * PLOT;
  const zero = px(1);

  const grid = [];
  for (let v = Math.ceil(lo * 5) / 5; v <= hi + 1e-9; v += 0.2) {
    const vr = Math.round(v * 10) / 10;
    if (Math.abs(vr - 1) < 1e-9) continue;
    grid.push(`<line class="bv-grid" x1="${px(vr).toFixed(1)}" y1="${HEAD - 6}" x2="${px(vr).toFixed(1)}" y2="${(H - FOOT).toFixed(1)}"/>`);
    grid.push(`<text class="bv-tick" x="${px(vr).toFixed(1)}" y="${(H - FOOT + 14).toFixed(1)}">${vr.toFixed(1)}x</text>`);
  }

  // THE MULTIPLE GOES INSIDE THE BAR WHEN THERE IS NO ROOM OUTSIDE IT, and the
  // set that forced this is Shrouded Fable at 0.60x. That is the longest bar on
  // the chart, so it reaches the left edge of the plot, and its label, hung off
  // the bar's outer end, landed on top of the set name. A label printed over
  // the name of the row it belongs to is the one collision that makes a chart
  // unreadable rather than untidy. VAL_W is the width of "0.00x" at 12 units,
  // and the rule is checked at both ends even though only the left one can fire
  // on today's data: the right end is one price sync away from a 1.5x.
  const VAL_W = 32;
  const bars = pts.map((p, i) => {
    const y = HEAD + i * ROW;
    const x1 = Math.min(zero, px(p.x)), x2 = Math.max(zero, px(p.x));
    const right = p.x > 1;
    const cls = right ? "bv-loose" : "bv-box";
    let at = right ? x2 + 5 : x1 - 5;
    let anchor = right ? "start" : "end";
    let vc = "bv-val";
    const fitsOut = right ? at + VAL_W <= W : at - VAL_W >= LBL;
    if (!fitsOut && x2 - x1 >= VAL_W + 10) {
      at = right ? x2 - 5 : x1 + 5;
      anchor = right ? "end" : "start";
      vc = "bv-val bv-val-in"; // dark, because it is now sitting on the bar
    }
    return `<g><text class="bv-name" x="${(LBL - 12).toFixed(1)}" y="${(y + 12).toFixed(1)}">${esc(p.name)}</text>` +
      `<rect class="${cls}" x="${x1.toFixed(1)}" y="${(y + 4).toFixed(1)}" width="${Math.max(1.5, x2 - x1).toFixed(1)}" height="14" rx="2"/>` +
      `<text class="${vc}" style="text-anchor:${anchor}" x="${at.toFixed(1)}" y="${(y + 13).toFixed(1)}">${p.x.toFixed(2)}x</text></g>`;
  }).join("");

  return `<figure class="bv">
      <svg viewBox="0 0 ${W} ${H}" role="img"
        aria-label="One bar per set showing what the cheapest bigger box costs per pack as a multiple of a single loose pack in the same set. ${
          pts.length - right
        } of ${pts.length} sets are cheaper by the box and ${right} are cheaper bought loose. Every figure is in the table below.">
        ${grid.join("")}
        <text class="bv-head" style="text-anchor:end" x="${(zero - 8).toFixed(1)}" y="${HEAD - 12}">box wins &larr;</text>
        <text class="bv-head" style="text-anchor:start" x="${(zero + 8).toFixed(1)}" y="${HEAD - 12}">&rarr; loose wins</text>
        ${bars}
        <line class="bv-zero" x1="${zero.toFixed(1)}" y1="${HEAD - 6}" x2="${zero.toFixed(1)}" y2="${(H - FOOT).toFixed(1)}"/>
        <text class="bv-tick" x="${zero.toFixed(1)}" y="${(H - FOOT + 14).toFixed(1)}">same</text>
      </svg>
      <figcaption>Each bar is the cheapest box, bundle or Build &amp; Battle in that set, priced per pack, against
        one loose pack of the same set. ${right} of the ${pts.length} sets that sell a pack both ways are cheapest
        bought one pack at a time. The dollars behind every bar are in the table below.</figcaption>
    </figure>`;
}

/**
 * How many packs each column divides by, hoisted out of the cells.
 *
 * The count is constant down a column BY CONSTRUCTION: a kind only reaches
 * COLUMNS when every product of that kind states a pack count, and those counts
 * come from per-kind blurbs. Printing "36 packs" in 23 cells to say one thing
 * was also what made the table 962px wide inside a 360px phone, which is nearly
 * three screens of sideways scrolling.
 *
 * Constant by construction is not constant by guarantee, so it is checked. If a
 * future product ever puts two different counts under one kind, the header
 * would be quietly wrong for some of the rows under it, and that is exactly the
 * class of error this table exists to avoid.
 */
// --------------------------------------------------------------- photography
//
// THE FIVE COLUMN HEADINGS ARE THE ONE THING ON THIS PAGE A BEGINNER CANNOT
// PICTURE. The table is arithmetic and the arithmetic is explained, but
// "Build & Battle Box" and "Booster Bundle" are trade names for two cardboard
// objects that look nothing alike, and a reader who has only ever bought a
// single pack off a shelf is being asked to compare five things they have not
// seen. So the strip above the table shows them, once, at the size the column
// headings are read at.
//
// ALL FIVE ARE THE SAME SET AND THAT IS THE POINT. Pitch Black is the only set
// in products.json that lists every one of the five COLUMNS kinds, so the strip
// is one set's shelf rather than five sets' worth of near-misses, and the
// caption can name it once and be true of every picture. If Pitch Black ever
// drops out of the pull, the strip renders whatever it can find and drops the
// rest rather than swapping in a lookalike from another set: a photo of a
// Prismatic Evolutions bundle under a heading sourced from Pitch Black's would
// be a different object with a different pack count.
//
// NO WIDTH OR HEIGHT. imgDims() returns nothing for tcgplayer-cdn on purpose,
// because those files run 200x268 to 200x417 and a declaration would be wrong
// by up to 34%. sizes is 88px, not a viewport unit, because the box is a fixed
// 88x88. Both rules are lifted from build-how-many-packs.mjs, which measured
// them; do not "improve" either one here without re-reading that file.
const SHOT_SET = "pitch-black";
const DEAD = new Set(
  JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).deadUrls || []
);
const shotFor = (kind) => {
  const hit = (products.sets?.[SHOT_SET]?.products || []).find((p) => p.kind === kind);
  if (!hit || !hit.thumb || DEAD.has(hit.thumb)) return null;
  return { src: hit.thumb, name: hit.name };
};

const packsByKind = new Map();
for (const r of rows) {
  for (const [kind, e] of Object.entries(r.kinds)) {
    const seen = packsByKind.get(kind);
    if (seen === undefined) packsByKind.set(kind, e.packs);
    else if (seen !== e.packs) {
      throw new Error(
        `"${kind}" holds ${seen} packs on one set and ${e.packs} on ${r.name}. ` +
          `The column header states one number for the whole column, so it cannot vary.`,
      );
    }
  }
}

const totalRips = rows.reduce((n, r) => n + r.rips, 0);
const checked = products.checked;

const price = (n) => moneyExact(n);
const x = (n) => `${n.toFixed(2)}x`;

// Google truncates the snippet around 160 characters, and set names are long
// enough that this has to be measured rather than hoped for.
const desc =
  `What one Pokemon booster pack costs across ${rows.length} sets, priced nightly. ` +
  `Cheapest is ${cheapest.name} at ${price(cheapest.best.each)}, priciest ${priciest.name} at ${price(priciest.best.each)}.`;
if (desc.length > 160) throw new Error(`meta description is ${desc.length} characters, over 160:\n${desc}`);

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Pack prices by set", item: `${SITE}/pack-prices.html` },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much does a Pokemon booster pack cost?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            `It depends far more on the set than on where you buy it. Across the ${rows.length} sets priced on this page a ` +
            `pack runs from ${price(cheapest.best.each)} for ${cheapest.name} to ${price(priciest.best.each)} for ${priciest.name}, ` +
            `a spread of ${x(spread)} for the same object. Those are TCGplayer market prices read on ` +
            `${longDate(checked) || checked}, divided by the pack count printed on the product.`,
        },
      },
      {
        "@type": "Question",
        name: "Is a booster box cheaper per pack than buying single packs?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            // THE LAST CLAUSE WAS TYPED, AND IT WAS FALSE. It read "on the three
            // cheapest sets on this page the booster box wins, and on the two
            // priciest the loose pack does" while the visible page, thirty lines
            // down, refuses to print the first half of exactly that sentence
            // because headAllBoxed is false: Chaos Rising is the second cheapest
            // set here and its cheapest pack is bought loose. A guard that stops
            // the page saying something is worth nothing if the schema block
            // says it anyway, and this one is the copy Google quotes.
            `Not reliably. A single pack bought on its own is the cheapest pack in ${packWins.length} of the ${rows.length} sets ` +
            `priced here, and a box or bundle is cheaper in ${boxWins.length}. It has to be checked set by set rather than assumed` +
            `${endsClause ? `: ${endsClause}` : ""}.`,
        },
      },
      {
        "@type": "Question",
        name: "Is an Elite Trainer Box worth it?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            `Purely as packs, no. Across the ${etbSets.length} sets priced here the Elite Trainer Box is never the cheapest pack in its ` +
            `set, it is the priciest option on the row in ${etbDearest.length} of them, and it runs a median of ${x(etbMedian)} the cheapest ` +
            `pack in the same set. It also comes with sleeves, dice, a promo card and the box itself, and we put no price on those, so ` +
            `whether that gap is worth paying is a question about the accessories rather than about the cards.`,
        },
      },
    ],
  },
];

/**
 * Page-scoped CSS.
 *
 * The table borrows .cc-table wholesale from the cost-to-complete page, which
 * already solves the hard part: a sticky first column and a scroll container
 * with edge shadows. Only two things differ. It has seven columns instead of
 * five, so it needs a wider min-width or the numbers crush together at 390px,
 * and the "cheapest" cell wants to be findable at a glance down a column of
 * near-identical dollar figures.
 */
// COMMENTS OUT OF THE SHIPPED PAGE, ARGUMENT KEPT IN THIS FILE. Same trade
// build-css.mjs makes for ui.css and miniCSS makes in build-set-pages.mjs, and
// the same regex: comments, plus the indentation between rules. Nothing else.
//
// It is here because this block is inline in a render blocking <head> and the
// desktop rules added on 16 August 2026 came with the measurements that justify
// them written alongside. Measured on this page set, those comments were 17.1KB
// raw and 7.1KB gzipped across eight pages, up to 13% of one of them. Stripped,
// every one of these pages is smaller than it was before the rules were added.
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const style = `
/* The five product photographs above the table. A row on a phone that wraps to
   two lines rather than a horizontal track, because five 88px tiles plus their
   labels is 520px and this page already asks the reader to scroll one table
   sideways. Two sideways things on one screen is one too many. */
.pp-shots{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));
  gap:var(--s3);margin:var(--s4) 0 var(--s2);padding:0}
.pp-shots li{display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px}
/* Product photography arrives on a white background, so the tile is white and
   carries a hairline rather than floating. Fixed 88x88 with contain, because
   sizes="88px" is measured against exactly this box and these files run 200x268
   to 200x417. */
.pp-shots img,.pp-noshot{width:88px;height:88px;object-fit:contain;display:block;
  background:var(--paper-2);border:1px solid var(--hair);border-radius:var(--r-sm)}
.pp-noshot{background:repeating-linear-gradient(45deg,var(--paper-3) 0 8px,var(--paper-2) 8px 16px)}
.pp-shots b{font:700 var(--t-micro)/1.25 var(--mono);letter-spacing:.03em;text-transform:uppercase;
  color:var(--ink)}
.pp-shots span{font:400 var(--t-micro)/1.3 var(--body);color:var(--ink-2)}
.pp-table{min-width:660px}
.pp-table td.num{font-variant-numeric:tabular-nums}
/* .cc-table sets white-space:nowrap on .num cells and on every header cell,
   which is right for a five column table of bare money and wrong for this one.
   Seven columns, and the two longest strings on the row are words rather than
   figures: "Build & Battle Box" and "in the build & battle box". Held on one
   line they alone pushed the table to 949px inside a 360px phone, which is
   nearly three screens of sideways scrolling for a table whose job is to be
   compared across. Wrapping the words and keeping the numbers on one line takes
   it under 700. */
.cc-table.pp-table thead th{white-space:normal}
.pp-via,.pp-packs{white-space:normal}
/* The pack count each column divides by, said once in the header rather than in
   every cell under it. .cc-table thead is white-space:nowrap, so this has to be
   a block or the two lines run on and the header row gets wider than the body. */
.pp-packs{display:block;font-weight:400;text-transform:none;letter-spacing:0;
  font-size:.62rem;color:var(--chrome-dim);margin-top:2px}
/* The winning cell in each row. A tinted cell rather than a coloured number:
   .cc-table already tints whole rows on hover and on even rows, and a third
   colour on the text would be a fourth thing competing in the same cell. */
/* THE WHOLE CELL, not just its own text: .pp-via and .pp-rips inside it set
   their own colours, and a near-white .pp-via on the teal fill was 1.99:1. */
.pp-best{background:var(--mustard) !important;color:var(--on-accent);font-weight:700}
/* 0,2,0 ON PURPOSE. .pp-via and .pp-rips are declared BELOW this rule and set
   their own colour, so a .pp-best descendant rule at 0,1,0 lost to them on
   source order and the near-white .pp-via stayed at 1.99:1 on the teal fill.
   NOTE: this CSS lives inside a JS template literal. A BACKTICK in a comment
   here ends the literal and the build dies with a ReferenceError naming a word
   out of your prose. Do not quote CSS with backticks in this file. */
.pp-best .pp-via,.pp-best .pp-rips,.pp-best .pp-none{color:var(--on-accent)}
.pp-via{display:block;font-family:var(--mono);font-size:.64rem;color:var(--ink);font-weight:400;margin-top:2px}
.pp-none{color:var(--ink-soft)}
.pp-rips{display:block;font-family:var(--mono);font-size:.64rem;color:var(--ink-soft);font-weight:400}
/* THE RIP COUNT IS A ROUTE NOW, so it takes the route colour. --sky-deep and
   not --sky because .64rem is about as small as type on this site gets:
   --sky-deep measures 4.50:1 on --card #2F4F39 where --sky is 4.05:1 and
   fails. UNDERLINED as well as coloured, because this sits inside a row header
   directly under another link (the set name) that the table already styles,
   and a bare colour change on 10px mono is not a strong enough signal that
   this second thing is clickable. min-height is NOT set here: it is a caption
   line inside a table row whose own tap target is the set-name link above it,
   and forcing 44px onto it would open a hole in every one of 28 rows. */
.pp-rips a{color:var(--sky-deep);text-decoration:underline}
.pp-best .pp-rips a{color:var(--on-accent)}
.pp-key{display:flex;flex-wrap:wrap;gap:var(--s3);align-items:center;
  font-family:var(--mono);font-size:.72rem;color:var(--ink-soft);margin-top:var(--s3)}
.pp-key i{display:inline-block;width:14px;height:14px;background:var(--mustard);
  border:1px solid var(--keyline);vertical-align:-2px;margin-right:6px;font-style:normal}

/* The prose caps that used to be inline style="max-width:38em" attributes on
   the ledes. They are classes now for one reason: an inline style beats every
   stylesheet rule that is not !important, so a media query could not reach
   them, and this page needed to change what they do above 1000px without
   changing what they do below it. These four declarations reproduce the inline
   values EXACTLY, so every width under the breakpoint renders what it rendered
   before, and the media query below is the only behaviour change. */
.w34{max-width:34em}
.w38{max-width:38em}
.w40{max-width:40em}
.w42{max-width:42em}

/* DESKTOP. min-width only. Measured identical at 390 before and after.

   MEASURED AT 1440. Nothing on this page is short of width: the seven column
   table is genuinely dense and fills the band properly, which is why the table
   is untouched. What was wrong was the reading measure around it. The quick
   facts cards ran 973px and set 99.7 characters a line with one at 114, and the
   golden-rule callout ran 728px at 14px type for 99.8. The ledes sat at 78.8.

   50ch AND NOT 70ch, because ch is one DIGIT wide and a digit is one of the
   widest glyphs in Outfit: a character averages about 0.7 of a ch, so 50ch sets
   around 70 and 70ch would set 100. The full measurement is in
   build-buying.mjs. */
@media(min-width:1000px){
  .w34,.w38,.w40,.w42{max-width:50ch}
  .fk-golden p{max-width:52ch}
}
/* The box-against-loose chart. IT SITS INSIDE .fk-golden, WHICH IS #111111, so
   every colour in here is picked against a near-black ground rather than
   against the page.
   THE TWO BAR COLOURS ARE GOLD AND PAPER AND THE FIRST PAIR WAS INVISIBLE.
   CLAUDE.md's palette section still describes the commissioned art's colours,
   ketchup #D9482B and navy #22384F, and ui.css does not: this stylesheet has
   been through a black/white/gold pass and BOTH --ketchup and --navy now
   resolve to #111111. So a bar filled var(--ketchup) drew thirteen black bars on a
   black box, which is not a missing rule and not a typo, it is a live variable
   whose meaning moved. Nothing errored and the markup looked right; it was
   caught by screenshotting. Do not reach for a colour name out of CLAUDE.md
   without checking what ui.css currently has it resolving to.
   Gold is the LOOSE-WINS half, which is the surprising majority the section is
   arguing for, and paper is the other. They also point opposite ways, so the
   chart still reads with no colour at all.
   THE max-width IS LOAD BEARING IN BOTH DIRECTIONS. A width:100% svg with a
   viewBox scales without limit, so the 430 unit box that makes the type legible
   at 390px would draw 40px set names at 1440. Capped at 560 the same chart is
   1.3x on a desktop and 0.74x on a phone, which is the whole range it has to
   survive. The 22 rows are 22 units each, so the figure is 540 units tall and
   lands at 400px on a phone: shorter than one screen, which is the reason a
   chart is worth adding to a page that already scrolls 10,000px. */
.bv{margin:18px 0 0}
.bv svg{display:block;width:100%;height:auto;max-width:560px}
.bv figcaption{font:400 var(--t-micro)/1.6 var(--body);color:var(--foot-ink);margin-top:10px;max-width:60ch}
/* WAS fill:var(--paper). --paper was the light cream and is a dark SURFACE
   now, so every mark on this chart was about to be drawn in a background
   colour on a dark ground: the same bug as .hofx-t and footer .soc svg. */
.bv-name{font:600 13px var(--body);fill:var(--chrome-ink);text-anchor:end}
.bv-head{font:700 12px var(--mono);fill:var(--gold);letter-spacing:.04em}
.bv-val{font:700 12px var(--mono);fill:var(--foot-ink)}
.bv-val-in{fill:var(--on-accent)}
.bv-tick{font:400 11px var(--mono);fill:var(--foot-ink);text-anchor:middle;opacity:.8}
.bv-grid{stroke:var(--chrome-ink);stroke-width:1;opacity:.16}
.bv-zero{stroke:var(--chrome-ink);stroke-width:1.6;opacity:.75}
.bv-box{fill:var(--chrome-ink)}
.bv-loose{fill:var(--gold)}
/* THE QUICK FACTS GO TWO UP RATHER THAN GETTING A NARROWER CAP. A first pass
   capped .facts-list li to 52ch, which brought the measure from 99.7
   characters a line to 58 and made the page 631px TALLER while leaving 873px of
   empty band beside every card: a cap fixes the measure by throwing the width
   away. Two columns fills the band, halves the section and lands the measure
   near 86, which is accepted on two line cards rather than chased. The full
   argument is in build-complete.mjs and the same rule is on the set guides. */
@media(min-width:1200px){
  .facts-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
    gap:11px;align-items:start}
  .facts-list li{max-width:none}
}
`;

const cell = (r, kind) => {
  const e = r.kinds[kind];
  if (!e) {
    // Never "0" and never a bare dash. The reason a cell is empty is a real
    // piece of information here (see the method note), so it is said out loud
    // to a screen reader rather than drawn as punctuation.
    // noValue() from shared/format.mjs rather than the same markup written
    // again here. It exists so an empty cell always carries a REASON a screen
    // reader can hear, and a second copy of the pattern is how that guarantee
    // quietly stops being one.
    return `<td class="num">${noValue(`No ${kind.toLowerCase()} we can price per pack`, "pp-none")}</td>`;
  }
  const best = r.best.kind === kind;
  return `<td class="num${best ? " pp-best" : ""}">${price(e.each)}${
    e.packs > 1 ? `<span class="pp-via">${price(e.market)} total</span>` : ""
  }</td>`;
};

const row = (r) => `<tr>
  <th scope="row"><a href="/sets/${esc(r.id)}.html">${esc(r.name)}</a><span class="cc-yr">${esc(
    String(r.released).slice(0, 4),
  )}</span>${r.rips ? `<span class="pp-rips"><a href="${
    soleRipFor.has(r.id) ? `/${esc(soleRipFor.get(r.id).path)}` : `/videos.html?set=${esc(r.id)}`
  }">${r.rips} rip${r.rips === 1 ? "" : "s"} on the channel</a></span>` : ""}</th>
  <td class="num"><strong>${price(r.best.each)}</strong><span class="pp-via">${
    r.best.kind === "Single Pack" ? "bought loose" : `in the ${esc(r.best.kind.toLowerCase())}`
  }</span></td>
  ${COLUMNS.map((k) => cell(r, k)).join("\n  ")}
</tr>`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pokemon Pack Prices by Set: What One Pack Costs</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/pack-prices.html">
<meta property="og:title" content="What does a Pokemon pack actually cost?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/pack-prices.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-pack-prices.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-pack-prices.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
<style>${miniCSS(style)}</style>
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
    <span class="kicker">Pokemon TCG &bull; Priced ${esc(longDate(checked) || "recently")}</span>
    <h1>What does a pack <span class="hl">actually</span> cost?</h1>
    <p class="lede w38">Every sealed product we track, divided by how many packs are inside it,
      so a booster box and a single pack can finally be compared. Prices are TCGplayer market, read on
      ${esc(longDate(checked) || "the date at the bottom of this page")}, and read again each time the product sync runs.
      Where the counts come from, and what they were in other years, is on
      <a href="/how-many-packs.html">how many packs are in it</a>.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Pack prices by set</p>

    <div class="facts">
      <div class="fact"><div class="n">${price(cheapest.best.each)}</div><div class="l">Cheapest pack (${esc(cheapest.name)})</div></div>
      <div class="fact"><div class="n">${price(priciest.best.each)}</div><div class="l">Priciest pack (${esc(priciest.name)})</div></div>
      <div class="fact"><div class="n">${x(spread)}</div><div class="l">Between the two, for the same object</div></div>
      <div class="fact"><div class="n">${rows.length}</div><div class="l">Sets priced per pack</div></div>
    </div>

    <div class="fk-golden" style="margin-top:22px">
      <p class="fk-golden-h">Read this first</p>
      <h2>The bigger box is <span class="hl">not</span> the cheaper pack</h2>
      ${/* THE DENOMINATOR IS NOT rows.length AND A READER CAN DO THE SUM. This
            read "On these 28 sets that holds 9 times and fails 13 times", and
            9 + 13 is 22. The received wisdom can only be tested where a set
            sells a pack BOTH loose and inside something bigger, which is what
            boxWins and packWins already require; the other 6 sell nothing but
            loose packs and are neither a win nor a loss. Printing the count
            those two are actually drawn from makes the arithmetic close. */ ""}
      <p>The received wisdom is that the bigger the box the cheaper the pack. Of the
        ${boxWins.length + packWins.length} sets here that sell a pack both loose and inside something bigger, that holds
        ${boxWins.length} times and fails ${packWins.length} times: buying single packs one at a time is the cheapest pack
        in ${esc(packWins[0]?.name || "")}${packWins.length > 1 ? `, ${esc(packWins[1].name)}` : ""}${
          packWins.length > 2 ? ` and ${packWins.length - 2} more` : ""
        }. It is not a rule that can be applied from the outside${endsClause ? `: ${endsClause}` : ""}. The only way to
        know is to look at the set you are actually buying, and that is what the table below is.</p>
      ${boxVsLoose()}
    </div>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <!-- SAY WHICH SETS, NOT "ALL". This label read "All 23 sets" while the rest of
         the site said 41 set guides, so the one page whose whole job is a
         complete price table implied the site had 23 sets in it. Two separate
         things were wrong: products.json had gone stale and was five sets short
         of sets.json, and the word "All" claimed a scope this page has never
         had. The count is fixed by re-running sync-products.mjs; the word is
         fixed here, because the imported Japanese and Korean guides are real
         guides with no TCGplayer sealed listing to divide and never will be on
         this table. -->
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>${rows.length} English sets</p>
    <h2>Cheapest pack to <span class="hl">priciest</span></h2>
    <p class="lede w40">Every English set we can price sealed, sorted by the cheapest pack available
      in each one, whatever it is inside. The imported Japanese and Korean sets have guides of their own but no sealed
      listing to divide, so they are not on this table. Every
      figure is that product's market price divided by the number of packs in it, before tax and shipping. The counts
      under the column headings are sourced for the Scarlet &amp; Violet era onward and are not permanent properties of
      those products, so a set from an earlier era gets an empty cell rather than a figure divided by the wrong number.
      <a href="/how-many-packs.html">What each one has held over the years</a> is its own page.</p>
    <ul class="pp-shots">
${COLUMNS.map((k) => {
  const shot = shotFor(k);
  const n = packsByKind.get(k);
  return `      <li>
        ${shot
          ? `<img src="${esc(shot.src)}" sizes="88px" alt="${esc(shot.name)}, sealed" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
          // NOT A HOLE AND NOT A SUBSTITUTE. The site's 45 degree no-art hatch,
          // the same one /sets/ uses for a set with no logo, at the identical
          // 88px footprint so the row keeps its shape.
          : `<span class="pp-noshot" aria-hidden="true"></span>`}
        <b>${esc(k)}</b>
        <span>${n ? `${n} pack${n === 1 ? "" : "s"}` : "pack count not held"}</span>
      </li>`;
}).join("\n")}
    </ul>
    <p class="price-note">All five are ${esc(products.sets?.[SHOT_SET]?.tcgSet || SHOT_SET)}, so they are
      the same set's shelf rather than five sets' worth of lookalikes. Photography is TCGplayer's.</p>
    <div class="cc-scroll" tabindex="0" role="region" aria-label="Pack prices by set, scrollable table">
      <table class="cc-table pp-table">
        <caption class="sr-only">Market price per pack for each sealed product, by set, cheapest set first</caption>
        <thead>
          <tr>
            <th scope="col">Set</th>
            <th scope="col" class="num">Cheapest pack</th>
${COLUMNS.map(
  (k) =>
    `            <th scope="col" class="num">${esc(k)}<span class="pp-packs">${packsByKind.get(k)} pack${
      packsByKind.get(k) === 1 ? "" : "s"
    }</span></th>`,
).join("\n")}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row).join("\n          ")}
        </tbody>
      </table>
    </div>
    <p class="pp-key"><span><i aria-hidden="true"></i>Cheapest pack in that set</span>
      <span>Set name goes to its full guide</span></p>
    <p class="price-note">A dash means there is no product of that kind in our nightly pull whose pack count we hold.
      ${noBox.length} of these ${rows.length} sets have no full booster box we can divide: some never had one in English,
      and for others TCGplayer lists only a half or enhanced box, whose pack count is not in our data. Either way we leave
      the cell empty rather than guess at it. See the method note at the bottom.</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The pack that wins</p>
    <h2>Where buying <span class="hl">one pack</span> is the cheap way</h2>
    <p class="lede w40">${packWins.length} of these ${rows.length} sets sell a pack more cheaply on its
      own than inside anything bigger, which is the opposite of how sealed product is usually described. We do not hold a
      record of which sets are still being printed, so we are not going to tell you why. The figures are what they are on
      ${esc(longDate(checked) || checked || "the date at the bottom of this page")}, and the multiple in each line is what
      the bigger box costs you per pack against buying loose.</p>
    <ul class="facts-list">
      ${packWins
        .map((r) => {
          const others = Object.entries(r.kinds)
            .filter(([k]) => k !== "Single Pack")
            .sort((a, b) => a[1].each - b[1].each)[0];
          return `<li><strong>${esc(r.name)}.</strong> ${price(r.kinds["Single Pack"].each)} a pack on its own. The next
        cheapest way in is the ${esc(others[0].toLowerCase())} at ${price(others[1].each)} a pack, which is
        ${x(others[1].each / r.kinds["Single Pack"].each)} the loose price.</li>`;
        })
        .join("\n      ")}
    </ul>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The Elite Trainer Box</p>
    <h2>What the <span class="hl">ETB</span> premium looks like</h2>
    <p class="lede w40">All ${etbSets.length} sets on this page sell an Elite Trainer Box, and in not
      one of them is it the cheapest pack. In ${etbDearest.length} of the ${etbSets.length} it is the priciest thing on the
      row. Measured against the cheapest pack in its own set it runs a median of ${x(etbMedian)}.</p>
    <div class="facts">
      <div class="fact"><div class="n">${x(etbMedian)}</div><div class="l">Median ETB pack against the cheapest pack in the same set</div></div>
      <div class="fact"><div class="n">${x(etbBest.x)}</div><div class="l">Closest it gets (${esc(etbBest.set.name)})</div></div>
      <div class="fact"><div class="n">${x(etbWorst.x)}</div><div class="l">Furthest apart (${esc(etbWorst.set.name)})</div></div>
      <div class="fact"><div class="n">${etbDearest.length} of ${etbSets.length}</div><div class="l">Sets where the ETB is the priciest pack on the row</div></div>
    </div>
    <p class="w40" style="margin-top:16px">That gap is not the whole story and this page will not pretend it is. An
      Elite Trainer Box also carries sleeves, dice, a promo card, dividers and the box itself, and we have no source for
      what any of that is worth, so we do not subtract a made up number from the price to make the comparison look
      better. If you want the sleeves, the premium may be the cheapest sleeves you will buy. If you want packs, there is
      a cheaper way to get them in every set on this page.</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Before you buy anything</p>
    <h2>What this page will <span class="hl">not</span> tell you</h2>
    <ul class="facts-list">
      <li><strong>Whether the cards inside are worth the price.</strong> That calculation needs pull rates, and The
        Pokemon Company does not publish them, so nobody quoting you one has them either. What we do have is
        ${totalRips} openings of these sets on camera with the results written down, which is
        <a href="/luck.html">observed and not the same thing</a>.</li>
      <li><strong>What you will pay at a shop.</strong> Market price is what copies have been selling for online. A
        counter in <a href="/shops.html">Rochester</a> or a table at a <a href="/card-shows.html">card show</a> is its
        own market, sometimes under this and sometimes over, and there is no feed for either.</li>
      <li><strong>Anything about half boxes, blisters, tins or collection boxes.</strong> They are in the sync and on the
        set guides with their full prices, but their pack counts are either variable or not in our data, so they are not
        divided here. A per-pack figure over a guessed pack count is worse than no figure.</li>
      <li><strong>Which set to open.</strong> Cheapest is not best and this is not a recommendation. It is a price list.</li>
    </ul>
    <p class="price-note">Prices are TCGplayer market prices, pulled by <code>scripts/sync-products.mjs</code> and read
      ${esc(longDate(checked) || checked || "recently")}. The pack counts are our own per-kind figures for the current
      era, sourced on <a href="/how-many-packs.html">how many packs are in it</a> and applied only to sets from the
      Scarlet &amp; Violet era onward, because they are not what those products held in earlier ones. Every per-pack
      figure on this page is one of those prices divided by one of those counts, computed when the page was built. No affiliate links, and nothing here is a
      recommendation to buy anything. Set guides for all ${rows.length} of these are under <a href="/sets/">set guides</a>,
      and what it costs to buy the cards instead of the packs is on
      <a href="/complete-a-set.html">cost to complete a set</a>. The same sum for one small 2026
      product, singles against boxes, is on the
      <a href="/first-partner-illustration-collection.html">First Partner Illustration Collection</a>
      guide, which also has the suggested price beside the shelf price.</p>
  </div>
</section>

</main>
${footer("Prices move daily. These are market prices with a read date, not a quote.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/pack-prices.html"), page);
console.log(`Wrote public/pack-prices.html
  ${rows.length} sets priced per pack, ${withBox.length} with a divisible booster box
  cheapest ${cheapest.name} ${price(cheapest.best.each)} in the ${cheapest.best.kind.toLowerCase()}
  priciest ${priciest.name} ${price(priciest.best.each)} in the ${priciest.best.kind.toLowerCase()}
  single packs cheapest on ${packWins.length} sets, a box or bundle on ${boxWins.length}
  ETB median ${x(etbMedian)} the cheapest pack in its own set`);
