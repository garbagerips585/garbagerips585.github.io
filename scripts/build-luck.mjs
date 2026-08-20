#!/usr/bin/env node
// Build public/luck.html: what 300+ rips actually produced.
//
//   node scripts/build-luck.mjs
//
// This is the one page on the site nobody else can write. Every other Pokemon
// site quotes the same official rarity distributions; this one reports what
// came out of packs that were actually opened on camera, which is a different
// and more interesting thing.
//
// HONESTY IS THE WHOLE VALUE HERE, so the rules are strict:
//
// 1. Only rips Tim has explicitly marked count toward a rate. The `pulls` tags
//    are derived from video titles, and titles are biased: one that says "NO
//    HITS" gets no pull tag and would silently read as an untested rip, while
//    one that says "SIR!!" does. Computing a rate over those would not measure
//    luck, it would measure how he writes titles. `hasHit` is a deliberate
//    yes/no from the spreadsheet, so that is the denominator.
//
// 2. Every rate carries its sample size, and rates below MIN_SAMPLE are shown
//    as "not enough yet" rather than as a number. Three rips of a set is an
//    anecdote and printing "33% hit rate" next to it would be a lie told with
//    real data.
//
// 3. These are OBSERVED rates from one person's openings, never presented as
//    official pull rates. The Pokemon Company does not publish those and we do
//    not have them. The page says so in its own words, not in fine print.
//
// The page therefore starts mostly empty and fills in as the log is tagged.
// That is correct behaviour, not a bug: it shows what is known and says how
// much is still unknown.

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
import { esc, shortDate } from "../shared/format.mjs";
import { labelFor } from "../shared/taxonomy.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Below this many tagged rips, a rate is noise and is not shown as a number. */
const MIN_SAMPLE = 12;

// LUCK_DATA points the build at a different videos.json. Used to preview how
// this page will look once the rip log is tagged, without writing test values
// over the real catalogue.
const DATA = process.env.LUCK_DATA || join(ROOT, "public/data/videos.json");
const OUT = process.env.LUCK_OUT || join(ROOT, "public/luck.html");
const { videos } = JSON.parse(await readFile(DATA, "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const setName = Object.fromEntries(sets.map((s) => [s.id, s.name]));

// A rip counts toward a rate only once its outcome is known either way.
const judged = videos.filter((v) => typeof v.hasHit === "boolean");
const hits = judged.filter((v) => v.hasHit);
const coverage = videos.length ? judged.length / videos.length : 0;

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const packsIn = (v) => (Number.isFinite(v.packs) && v.packs > 0 ? v.packs : null);

/** Group the judged rips by a key, and rate each group. */
function rateBy(keyFn, labelFn) {
  const g = new Map();
  for (const v of judged) {
    for (const k of keyFn(v)) {
      if (!g.has(k)) g.set(k, { rips: 0, hits: 0, packs: 0, hitPacks: 0 });
      const e = g.get(k);
      e.rips++;
      if (v.hasHit) e.hits++;
      const p = packsIn(v);
      if (p) {
        e.packs += p;
        if (v.hasHit) e.hitPacks += p;
      }
    }
  }
  return [...g.entries()]
    .map(([k, e]) => ({ key: k, label: labelFn(k), ...e, rate: pct(e.hits, e.rips) }))
    .filter((r) => r.rips > 0)
    .sort((a, b) => (b.rips >= MIN_SAMPLE) - (a.rips >= MIN_SAMPLE) || b.rate - a.rate || b.rips - a.rips);
}

const bySet = rateBy((v) => v.sets || [], (k) => setName[k] || labelFor("sets", k) || k);
const byProduct = rateBy((v) => v.products || [], (k) => labelFor("products", k) || k);

// What actually came out, from the rarity Tim recorded. Falls back to the
// derived pull tags only for the count of each kind, never for a rate.
//
// "MORE THAN ONE" IS NOT A RARITY, and it was rendered in a row of rarities.
// It is what the rip log's rarity column says when a single rip produced
// several hits, and on the page it came out as a tile reading "2 / MORE THAN
// ONE" between "8 / ILLUSTRATION RARE" and "6 / CHARIZARD", which reads as a
// label with its noun missing. Saying "hit" restores the sentence the other
// tiles are all making: N rips produced <this>.
const RARITY_ALIAS = { "More than one": "More than one hit" };
const rarityCount = new Map();
for (const v of videos) {
  if (!v.hitRarity) continue;
  const k = RARITY_ALIAS[v.hitRarity] || v.hitRarity;
  rarityCount.set(k, (rarityCount.get(k) || 0) + 1);
}
const rarities = [...rarityCount.entries()].sort((a, b) => b[1] - a[1]);

const pullCount = new Map();
for (const v of videos) for (const p of v.pulls || []) pullCount.set(p, (pullCount.get(p) || 0) + 1);
const pulls = [...pullCount.entries()].sort((a, b) => b[1] - a[1]);

/**
 * WHICH TALLY THE "WHAT HAS ACTUALLY COME OUT" BAND SHOWS, AND WHY IT IS NOT
 * SIMPLY `rarities.length`.
 *
 * The band used to read `rarities.length ? rarities : pulls`, which is the
 * ordinary "prefer the better source" shape and reads as obviously right. On
 * this data it publishes almost nothing. The rip log's rarity column is filled
 * in for exactly TWO rips and both of them say the same thing, "More than one",
 * so `rarities` is one entry covering 2 rips. Being non-empty, it wins, and the
 * pull tags, which cover 14 rips across six categories (Double Rare 5,
 * Illustration Rare 4, Ultra 2, Super 1, ACE SPEC 1, Charizard 1), are dropped
 * without a word. A whole band headed "What has actually come out" renders as a
 * single tile reading "2 / More than one hit".
 *
 * Non-empty is not the same as better. The comparison that matters is how many
 * RIPS each tally describes, because that is what both of them are counting, so
 * that is what is compared. The rarity column still wins on a tie, which keeps
 * the original intent: it is the more precise source the moment somebody fills
 * it in for as many rips as the tags cover.
 *
 * Printed either way, so a run where the choice flips is visible rather than
 * being a band that quietly changed what it is about.
 */
const rarityRips = [...rarityCount.values()].reduce((n, x) => n + x, 0);
const pullRips = videos.filter((v) => (v.pulls || []).length).length;
const useRarities = rarities.length > 0 && rarityRips >= pullRips;
const tally = useRarities ? rarities : pulls.map(([k, n]) => [labelFor("pulls", k) || k, n]);
console.log(
  `  "what has come out" band: rarity column covers ${rarityRips} rip(s) in ${rarities.length} ` +
    `categor${rarities.length === 1 ? "y" : "ies"}, pull tags cover ${pullRips} rip(s) in ` +
    `${pulls.length} categories, showing the ${useRarities ? "rarity column" : "pull tags"}`
);

/**
 * The longest run of consecutive judged rips with no hit, in upload order.
 *
 * The most human number on the page: everyone who opens packs knows the
 * feeling of a cold streak, and this one is real rather than remembered.
 */
const chrono = [...judged].sort((a, b) => String(a.published).localeCompare(String(b.published)));
let worst = { len: 0, from: null, to: null };
let run = 0, runFrom = null;
for (const v of chrono) {
  if (!v.hasHit) {
    if (!run) runFrom = v;
    run++;
    if (run > worst.len) worst = { len: run, from: runFrom, to: v };
  } else run = 0;
}
let bestRun = { len: 0, from: null, to: null };
run = 0; runFrom = null;
for (const v of chrono) {
  if (v.hasHit) {
    if (!run) runFrom = v;
    run++;
    if (run > bestRun.len) bestRun = { len: run, from: runFrom, to: v };
  } else run = 0;
}

/**
 * THE RIP THAT ENDED THE DROUGHT, which is a fact this page already had and
 * would not name.
 *
 * `worst.to` is the LAST rip of the cold streak, so it is still a miss. The
 * one that broke it is whatever judged rip comes next in upload order, and it
 * only exists if the streak ended rather than running to the newest video.
 * Where it does not exist the page says the drought is still open, which is
 * the truth and a better sentence than an omission.
 *
 * WHY THIS PAGE GETS LINKS AT ALL, since the test is relevance and not volume.
 * Every number on /luck.html is counted out of the channel's own videos, and
 * the two streaks are the only figures on it that are ABOUT four specific
 * rips rather than about a rate. A reader who has just been told the longest
 * drought ran N rips has exactly one next question, and it is "which ones".
 * Nothing else on the page has an answer that is a single video, which is why
 * nothing else on it gets a link.
 */
const droughtBreaker = (() => {
  if (!worst.len || !worst.to) return null;
  const i = chrono.indexOf(worst.to);
  return i >= 0 ? chrono[i + 1] || null : null;
})();

const totalPacks = judged.reduce((n, v) => n + (packsIn(v) || 0), 0);
const packsKnown = judged.filter(packsIn).length;

// ---------------------------------------------------------------------------

// ------------------------------------------------------- product photography
//
// THE PRODUCT TABLE NAMES ELEVEN THINGS AND SHOWED NONE OF THEM. "ex Premium
// Collection", "Knock Out Collection" and "UPC" are trade names for boxes of
// wildly different size and price, and the whole point of that table is the gap
// between similar products. A reader who cannot picture two of them cannot see
// the gap.
//
// EVERY PHOTO NAMES THE SET IT IS OF, IN VISIBLE TEXT, not just in the alt.
// products.json is per SET, never per product type, so each of these is one
// specific set's box standing in for a kind, and a row that showed it without
// saying so would be quietly claiming the picture is "an ETB" rather than "Pitch
// Black's ETB". The set line under each label is the whole licence for using
// them here. Same rule build-how-many-packs.mjs states at length.
//
// THE SETS ARE PINNED AND THE NAME IS CHECKED. sync-products.mjs picks the
// cheapest variant per kind, so the product behind "pitch-black / Tin" can
// change under us; if the name that comes back does not still start with the set
// we expect, the photo is dropped rather than captioned wrong.
//
// FOUR ROWS GET NO PHOTO AND THAT IS THE ANSWER, not a gap to close later.
// Japanese, Korean and Chinese booster packs are not in the TCGplayer pull at
// all, and the Poke Ball Tin and Knock Out Collection listings that do exist
// belong to sets we did not open. An English Prismatic Evolutions tin captioned
// as a Japanese pack is worse than a hatched box.
const PRODUCT_SHOT = {
  etb: ["pitch-black", "Elite Trainer Box", "Pitch Black", "Pitch Black Elite Trainer Box"],
  "single-pack": ["pitch-black", "Single Pack", "Pitch Black", "Pitch Black Booster Pack"],
  bundle: ["pitch-black", "Booster Bundle", "Pitch Black", "Pitch Black Booster Bundle"],
  blister: ["pitch-black", "Blister Pack", "Pitch Black", "Pitch Black Single Pack Blister"],
  tin: ["prismatic-evolutions", "Tin", "Prismatic Evolutions", "Prismatic Evolutions Mini Tin"],
  "collection-box": ["prismatic-evolutions", "Collection Box", "Prismatic Evolutions", "Prismatic Evolutions Poster Collection"],
  upc: ["151", "Ultra-Premium Collection", "151", "151 Ultra-Premium Collection"],
};

let PRODUCTS = {};
try {
  PRODUCTS = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8")).sets || {};
} catch { /* run: node scripts/sync-products.mjs. The table renders without photos. */ }
const DEAD_URLS = new Set(
  await readFile(join(ROOT, "data/no-scan.json"), "utf8")
    .then((t) => JSON.parse(t).deadUrls || [])
    .catch(() => [])
);

const shotFor = (key) => {
  const spec = PRODUCT_SHOT[key];
  if (!spec) return null;
  const [sid, kind, setLabel, expect] = spec;
  const hit = (PRODUCTS[sid]?.products || []).find((p) => p.kind === kind);
  if (!hit || !hit.thumb || DEAD_URLS.has(hit.thumb)) return null;
  if (!String(hit.name || "").toLowerCase().startsWith(expect.toLowerCase())) return null;
  return { src: hit.thumb, name: hit.name, set: setLabel };
};

const row = (r, hrefBase, withShot = false) => {
  const enough = r.rips >= MIN_SAMPLE;
  const shot = withShot ? shotFor(r.key) : null;
  const name = hrefBase ? `<a href="${hrefBase}${esc(r.key)}">${esc(r.label)}</a>` : esc(r.label);
  return `        <tr${enough ? "" : ' class="thin"'}>
          <th scope="row">${
            withShot
              ? `<span class="luck-prod">${
                  shot
                    ? `<img src="${esc(shot.src)}" sizes="56px" alt="${esc(shot.name)}, sealed" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
                    : `<span class="luck-noshot" aria-hidden="true"></span>`
                }<span class="luck-prodn">${name}${
                  shot ? `<em>${esc(shot.set)} shown</em>` : `<em>no photo we can publish</em>`
                }</span></span>`
              : name
          }</th>
          <td class="num">${r.rips}</td>
          <td class="num">${r.hits}</td>
          <td class="rate">${
            enough
              ? `<span class="lbar" style="--w:${Math.max(2, r.rate)}%"><b>${r.rate}%</b></span>`
              : `<span class="thin-note">need ${MIN_SAMPLE - r.rips} more</span>`
          }</td>
        </tr>`;
};

// tabindex="0" AND role/aria-label, the same affordance .xp-scroll, .cc-scroll,
// .gc-tw and .op-tw already carry, and for the reason written out in full in
// scripts/build-expansions.mjs: an overflowing box a keyboard cannot reach is
// content a keyboard cannot read.
//
// MEASURED HERE RATHER THAN ASSUMED, because this table is NOT the easy case
// build-expansions describes. Its rows do contain links (18 in the first table,
// 11 in the second), so Chrome, Firefox and Safari all let you tab INTO it and
// the box scrolls as focus moves. That is not the same thing as being able to
// read it. At 390x844 the table is 96px wider than its box, and the column that
// falls off the right is "Hit rate" -- the one number the whole page exists to
// report. Reading it by tabbing means moving focus through set links you did not
// want to follow, and a reader who only wants to LOOK has no way to scroll at
// all. The other four scrollers on this site take the affordance whether or not
// they have focusable children (.cc-scroll has 28 and still carries it), so the
// convention is already "every table scroller", and this was the one that missed.
// 166px hidden at 320.
const table = (rows, what, hrefBase, withShot = false) =>
  rows.length
    ? `    <div class="luck-scroll" tabindex="0" role="region" aria-label="Hit rate by ${what}, scrollable table">
      <table class="luck-table">
        <caption class="sr-only">Hit rate by ${what}</caption>
        <thead><tr><th scope="col">${what}</th><th scope="col">Rips</th><th scope="col">Hits</th><th scope="col">Hit rate</th></tr></thead>
        <tbody>
${rows.map((r) => row(r, hrefBase, withShot)).join("\n")}
        </tbody>
      </table>
    </div>`
    : `    <p class="luck-empty">Nothing tagged yet. This fills in as the rip log gets marked up.</p>`;

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
.luck{padding:var(--s7) 0 var(--s5)}
.luck-lede{font-size:var(--t-lede);color:var(--ink-2);max-width:42em;margin-bottom:var(--s5)}
.luck-head{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3);margin-bottom:var(--s5)}
@media(max-width:700px){.luck-head{grid-template-columns:repeat(2,1fr)}}
.luck-stat{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);box-shadow:var(--lift)}
.luck-stat b{display:block;font:400 var(--t-xl)/1 var(--display);color:var(--ink);margin-bottom:4px}
.luck-stat span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);
  letter-spacing:.06em;text-transform:uppercase}

/* How much of the log is actually tagged. Shown at the top rather than buried,
   because every number under it is only as good as this bar. */
.luck-cov{background:var(--lilac-pale);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);margin-bottom:var(--s6)}
.luck-cov p{font:700 var(--t-micro)/1.6 var(--mono);color:var(--plum);letter-spacing:.04em;
  text-transform:uppercase;margin-bottom:8px}
/* rgba(78,47,72,...) is a plum left over from the old palette, on a site whose
   stated palette is black, white and gold. The track is the palette's own
   --paper-3 and the fill is the accent, which is what every other bar on the
   site uses. Nothing about the reading changes; it just stops being purple. */
.luck-covbar{height:10px;border-radius:99px;background:var(--paper-3);overflow:hidden;
  border:1px solid var(--hair)}
.luck-covbar i{display:block;height:100%;background:var(--gold);border-radius:99px}
/* Only rendered when every logged rip is a hit. A 100% headline with nothing
   next to it reads as a broken number, so the page says why before you ask. */
.luck-caveat{font:400 var(--t-sm)/1.6 var(--body)!important;color:var(--plum)!important;
  letter-spacing:0!important;text-transform:none!important;margin:10px 0 0!important;max-width:52em}

.luck-sec{padding:var(--s6) 0}
.luck-sec h2{font:400 var(--t-l)/1.15 var(--display);margin-bottom:var(--s2)}
.luck-note{color:var(--ink-2);max-width:44em;margin-bottom:var(--s4)}
.luck-scroll{overflow-x:auto;border:1px solid var(--hair);border-radius:var(--r);background-color:var(--card)}
/* background-COLOR, not the shorthand: ui.css paints a four layer scroll
   affordance on this class, and the background shorthand resets
   background-image, which would silently wipe all four layers. */
/* THE PRODUCT TABLE IS WIDER THAN THE SET TABLE NOW. min-width goes to 460px
   because the first column carries a 56px photograph plus two lines of label,
   and at 400px the hit-rate bar was squeezed to nothing. Both tables sit in
   .luck-scroll, so this widens the scroll rather than the page. */
.luck-table{border-collapse:collapse;width:100%;min-width:460px;font-size:var(--t-sm)}
/* Photo, then the product name with the set it is a photo OF underneath. The
   second line is not decoration: products.json is per set, so without it the
   picture is claiming to be "an ETB" rather than "Pitch Black's ETB". */
.luck-prod{display:flex;align-items:center;gap:var(--s3)}
.luck-prod img,.luck-noshot{flex:none;width:56px;height:56px;object-fit:contain;display:block;
  background:var(--paper-2);border:1px solid var(--hair);border-radius:var(--r-sm)}
/* No photograph exists that we can publish. The site's 45 degree no-art hatch,
   at the identical footprint so the column keeps its width. */
.luck-noshot{background:repeating-linear-gradient(45deg,var(--paper-3) 0 6px,var(--paper-2) 6px 12px)}
.luck-prodn{display:block;min-width:0}
.luck-prodn em{display:block;font:400 var(--t-micro)/1.3 var(--body);color:var(--ink-2);
  font-style:normal;margin-top:2px}
.luck-table th,.luck-table td{text-align:left;padding:10px var(--s3);border-bottom:1px solid var(--hair)}
.luck-table tbody tr:last-child th,.luck-table tbody tr:last-child td{border-bottom:0}
.luck-table thead th{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink-2);background:var(--page)}
.luck-table tbody th{font-weight:600}
.luck-table tbody th a:hover{text-decoration:underline}
.luck-table .num{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink-2);width:1%}
.luck-table .rate{width:40%;min-width:120px}
.luck-table tr.thin{opacity:.62}
.thin-note{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);letter-spacing:.04em;text-transform:uppercase}
/* Number first, bar second. With the bar leading, the percentage was pushed
   past the right edge of a 375px viewport and the one value the row exists to
   communicate was the one you had to scroll sideways to see. */
.lbar{display:flex;align-items:center;gap:8px}
.lbar b{flex:none;min-width:3.4em;font:700 var(--t-sm)/1 var(--body);font-variant-numeric:tabular-nums}
.lbar::after{content:"";height:10px;width:var(--w);min-width:3px;max-width:100%;flex:0 1 auto;
  background:var(--mustard);border:1px solid var(--gold-deep);border-radius:99px}

.pull-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--s3)}
.pull{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s4);
  text-align:center;box-shadow:var(--lift)}
.pull b{display:block;font:400 var(--t-l)/1 var(--display);color:var(--ketchup-deep)}
.pull span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);letter-spacing:.05em;text-transform:uppercase}

.streaks{display:grid;grid-template-columns:1fr 1fr;gap:var(--s4)}
@media(max-width:640px){.streaks{grid-template-columns:1fr}}
.streak{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s5);box-shadow:var(--lift)}
.streak b{display:block;font:400 var(--t-xl)/1 var(--display);margin-bottom:4px}
.streak .k{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)}
.streak p{color:var(--ink-2);font-size:var(--t-sm);margin-top:8px}
.streak.cold b{color:var(--plum)}
.streak.hot b{color:var(--ketchup-deep)}
/* The streak's own rips. TEAL, because teal is how you get around, and
   --sky-deep #81BEDE rather than --sky, because this type is small: it measures
   4.50:1 on --card #2F4F39, exactly the AA line and the same deliberate pairing
   CLAUDE.md records as one of the two tightest on the site. --sky is 4.05:1 on
   the same ground and would fail. Read both values from ui.css, do not re-pick
   one. The kicker above each title is --ink-2 at 5.73:1, a caption and not a
   route, so the two accents never sit on each other.
   BLOCK anchors with a 44px minimum, so the tap target is the whole two-line
   row rather than the title's text run: same shape rule as every other link on
   the site. The list sits at the FOOT of the card, after the sentence that
   explains what the streak was, so nothing sends a reader away mid figure. */
.streak-rips{list-style:none;margin-top:var(--s4);padding:0;
  border-top:1px dashed var(--hair);display:grid;gap:2px}
.streak-rips li{padding-top:var(--s3)}
.streak-rips a{display:block;min-height:44px;font:600 var(--t-sm)/1.35 var(--body);color:var(--sky-deep)}
.streak-rips a:hover,.streak-rips a:focus-visible{text-decoration:underline}
.streak-rips a span{display:block;font:700 var(--t-micro)/1.5 var(--mono);
  letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.streak-open{padding-top:var(--s3);color:var(--ink-2);font-size:var(--t-sm)}

.luck-method{font:700 var(--t-micro)/1.7 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin:var(--s6) 0;max-width:56em}
.luck-empty{color:var(--ink-2);background:var(--card);border:1px dashed var(--hair);
  border-radius:var(--r);padding:var(--s5);text-align:center}

/* DESKTOP. min-width only, so a phone and a tablet render what they rendered
   before. Measured identical at 390 before and after.

   WHAT WAS WRONG, MEASURED AT 1440. Both hit-rate tables ran the full 1,392px
   with four columns in them: a set name, two counts and a bar. The name column
   took the remainder, 730px, to hold "Pitch Black", and the bar took 480px of
   the rest, so the two numbers a reader is comparing sat half a screen apart.
   Prose measured 87 characters a line against a 65 to 75 target.

   The heading and its note move beside the table rather than above it, which
   narrows the table to about 1,030px and pulls the columns back together, and
   takes roughly 130px off the page per section.

   The three children are placed by hand rather than left to auto-placement,
   which fills row major and would put the note next to the heading instead of
   under it. .luck-empty is placed with .luck-scroll because table() renders one
   or the other: with nothing logged there is no table, and an unplaced child
   would auto-flow into the hole the explicit rules leave. */
@media(min-width:1200px){
  /* THE THIRD ROW IS A SPACER AND IT IS LOAD BEARING. The table is far taller
     than the heading and the note put together, and a grid distributes a
     spanning item's leftover height across the rows it spans. With two rows,
     row 2 grew to soak up the difference and the note was pushed 380px down the
     page, marooned in the middle of the rail with a hole above it. A third row
     at 1fr takes all the slack instead, so rows 1 and 2 stay at their content
     height and the heading and note sit together at the top where they read. */
  .luck-rail > .wrap{display:grid;grid-template-columns:320px minmax(0,1fr);
    grid-template-rows:auto auto 1fr;gap:0 var(--s6);align-items:start}
  .luck-rail > .wrap > h2{grid-column:1;grid-row:1;margin-bottom:var(--s2)}
  .luck-rail > .wrap > .luck-note{grid-column:1;grid-row:2;margin-bottom:0}
  .luck-rail > .wrap > .luck-scroll,
  .luck-rail > .wrap > .luck-empty{grid-column:2;grid-row:1 / span 3}
}
/* Reading measure. The em based caps above were set against the body face and
   .luck-lede is set in the larger --t-lede, so 42em came out at 748px and 87
   characters a line. ch is the width of a "0" in the element's OWN font, which
   is the unit that tracks the count rather than the type size.

   50ch AND NOT 70ch. ch is one DIGIT wide, and a digit is one of the widest
   glyphs in Outfit: measured across these pages the average character is about
   0.7 of a ch, so 50ch sets around 70 characters and 70ch would set 100. The
   full measurement is written out in build-buying.mjs.

   Capped only from 1000px up, because below that the caps never bind. */
@media(min-width:1000px){
  .luck-lede{max-width:52ch}
  .luck-note,.luck-caveat{max-width:50ch}
  /* The method note was the widest measure left on the page after the rest was
     capped: 616px of 11px mono setting 87 characters a line, on the paragraph
     that explains how every number above it was counted. Capped wider than the
     prose because mono at 11px is reference type, but not left running. */
  .luck-method{max-width:72ch}
}
`;

const headline = judged.length
  ? `${pct(hits.length, judged.length)}%`
  : "-";

const body = `
<main id="main">
  <section class="luck">
    <div class="wrap">
      <div class="brk"><h1>Luck, <span class="hl">measured</span></h1><span class="ln"></span></div>
      <p class="luck-lede">Nobody publishes real pull rates, so this page does the next best thing:
        it counts what actually came out of packs opened on camera, one rip at a time. It is one
        person's luck, not the odds, and it is counted rather than remembered.</p>

      <div class="luck-head">
        <div class="luck-stat"><b>${videos.length}</b><span>rips filmed</span></div>
        <div class="luck-stat"><b>${judged.length}</b><span>logged either way</span></div>
        <div class="luck-stat"><b>${hits.length}</b><span>had a hit</span></div>
        <div class="luck-stat"><b>${headline}</b><span>hit rate so far</span></div>
      </div>

      <div class="luck-cov">
        <p>${judged.length} of ${videos.length} rips logged &bull; ${Math.round(coverage * 100)}% of the catalog${
          packsKnown ? ` &bull; ${totalPacks.toLocaleString("en-US")} packs counted` : ""
        }</p>
        <div class="luck-covbar"><i style="width:${Math.max(1, Math.round(coverage * 100))}%"></i></div>
${
  judged.length && hits.length === judged.length
    ? `        <p class="luck-caveat">Yes, that says ${headline}. The rips marked up so far are the ones
        that had something in them, so read this as "the log is ${Math.round(coverage * 100)}% filled in"
        rather than "the packs are ${headline} good". It will drop as the duds get logged.</p>`
    : ""
}
      </div>
    </div>
  </section>

  <section class="band luck-sec luck-rail">
    <div class="wrap">
      <h2>Which sets have been <span class="hl">kind</span></h2>
      <p class="luck-note">Hit rate is the share of logged rips from that set that produced something
        worth keeping. Sets with fewer than ${MIN_SAMPLE} logged rips do not get a number: at that
        size it would be noise dressed up as a fact.</p>
${table(bySet, "Set", "/videos.html?set=")}
    </div>
  </section>

  <section class="luck-sec luck-rail">
    <div class="wrap">
      <h2>Which products have been <span class="hl">worth it</span></h2>
      <p class="luck-note">The same question asked of what was opened rather than what was in it.
        A booster box holds far more packs than a single blister, so a higher rate here is expected
        rather than surprising: what is worth reading is the gap between similar products.</p>
${table(byProduct, "Product", "/videos.html?product=", true)}
    </div>
  </section>

  ${
    rarities.length || pulls.length
      ? `<section class="band luck-sec">
    <div class="wrap">
      <h2>What has actually <span class="hl">come out</span></h2>
      <p class="luck-note">${
        useRarities
          ? `Counted from the rarity column of the rip log, which is filled in for a different set of rips
      than the hit or no hit column, so this is a separate tally from the hit rates above and the two will
      not line up.`
          : `Counted from what the titles say rather than from the rip log, so this is a separate tally from
      the hit rates above and the two will not line up.`
      } They are totals, not rates: a set
      that gets opened more will show more of everything. A fuller log makes these counts more complete, not more predictive: they say what
      came out of the packs we opened, never what will come out of yours.</p>
      <div class="pull-grid">
${tally
  .map(([k, n]) => `        <div class="pull"><b>${n}</b><span>${esc(k)}</span></div>`)
  .join("\n")}
      </div>
    </div>
  </section>`
      : ""
  }

  ${
    worst.len || bestRun.len
      ? `<section class="luck-sec">
    <div class="wrap">
      <h2>Cold streaks and <span class="hl">hot ones</span></h2>
      <p class="luck-note">Consecutive logged rips, in upload order.</p>
      <div class="streaks">
        <div class="streak cold">
          <span class="k">Longest drought</span>
          <b>${worst.len} rip${worst.len === 1 ? "" : "s"}</b>
          <p>${
            worst.len === 0
              ? "None yet. Every rip marked up in the log so far has produced something worth keeping, which says as much about how much of the log is filled in as it does about the luck."
              : worst.from
                ? `${shortDate(worst.from.published)} to ${shortDate(worst.to.published)}, nothing worth keeping.`
                : ""
          }</p>
          ${/* THE STREAK'S OWN VIDEOS. See `droughtBreaker` above for why these
                four links and no others. Both ends of the run, then the rip
                that broke it, in the order somebody would watch them.
                `worst.from === worst.to` on a one-rip drought, so the second
                row is dropped rather than printing the same video twice under
                two different labels. */ ""}
          ${worst.from ? `<ul class="streak-rips">
            <li><a href="/${esc(worst.from.path)}"><span>Where it started</span>${esc(worst.from.siteTitle || worst.from.title)}</a></li>
            ${worst.to && worst.to !== worst.from ? `<li><a href="/${esc(worst.to.path)}"><span>Where it ended</span>${esc(worst.to.siteTitle || worst.to.title)}</a></li>` : ""}
            ${droughtBreaker
              ? `<li><a href="/${esc(droughtBreaker.path)}"><span>The rip that broke it</span>${esc(droughtBreaker.siteTitle || droughtBreaker.title)}</a></li>`
              : `<li class="streak-open">Still open: nothing logged after it yet.</li>`}
          </ul>` : ""}
        </div>
        <div class="streak hot">
          <span class="k">Best run</span>
          <b>${bestRun.len} rip${bestRun.len === 1 ? "" : "s"}</b>
          <p>${bestRun.from ? `${shortDate(bestRun.from.published)} to ${shortDate(bestRun.to.published)}, a hit every time.` : ""}</p>
          ${bestRun.from ? `<ul class="streak-rips">
            <li><a href="/${esc(bestRun.from.path)}"><span>Where it started</span>${esc(bestRun.from.siteTitle || bestRun.from.title)}</a></li>
            ${bestRun.to && bestRun.to !== bestRun.from ? `<li><a href="/${esc(bestRun.to.path)}"><span>Where it ended</span>${esc(bestRun.to.siteTitle || bestRun.to.title)}</a></li>` : ""}
          </ul>` : ""}
        </div>
      </div>
    </div>
  </section>`
      : ""
  }

  <section class="luck-sec">
    <div class="wrap">
      <p class="luck-method">HOW THIS IS COUNTED. A rip counts only once it has been marked as a hit
        or not a hit in the rip log, so an untagged video is absent rather than assumed. "Hit" means
        a card worth keeping, judged by eye, not a fixed rarity threshold. These are observed results
        from one person opening packs on camera, not official pull rates: The Pokemon Company does not
        publish those, and anyone who tells you they know them is guessing. Small samples are labeled
        rather than rounded into confidence. Numbers move as more rips are logged.</p>
      ${/* WHO "ONE PERSON OPENING PACKS ON CAMERA" IS. This page's whole claim
            rests on first-hand observation, and it named no observer: /about
            .html had ZERO in-body inbound links from anywhere on the site on 18
            August 2026, so the page that says the strongest first-party thing
            on the site had no link to the page that says who is saying it. That
            is a plain provenance gap before it is an SEO one. */ ""}
      <p class="luck-method" style="margin-top:var(--s4)">THE PERSON DOING THE OPENING, AND WHY THERE
        IS A LOG OF IT AT ALL, IS ON <a href="/about.html">THE ABOUT PAGE</a>. EVERY RIP COUNTED HERE
        HAS ITS OWN PAGE IN <a href="/videos.html">THE FULL LIBRARY</a>, AND THE CARDS THAT CAME OUT
        OF THEM ARE IN <a href="/hall.html">THE HALL OF FAME</a>.</p>
    </div>
  </section>
</main>`;

// NO Dataset MARKUP UNTIL THERE IS A DATASET. With nothing logged this
// declared a dataset of "0 logged pack openings" to search engines, which is
// structured data asserting something the page does not have. The page itself
// was already honest, showing a dash and "0 of 311 rips logged"; the markup was
// not. Same reason the page is dropped from the sitemap below.
const ld =
  judged.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: "Observed Pokemon card hit rates from Garbage Rips 585",
        description: `Hit rates observed across ${judged.length} logged pack openings, by set and by product type.`,
        url: `${SITE}/luck.html`,
        creator: { "@type": "Organization", name: "Garbage Rips 585", url: `${SITE}/` },
        isAccessibleForFree: true,
      }
    : null;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pokemon Pack Luck, Measured: What Actually Came Out of ${judged.length} Rips</title>
<meta name="description" content="${
  judged.length
    ? `Observed hit rates from ${judged.length} logged Pokemon pack openings, broken down by set and product. Not official pull rates: what actually came out on camera.`
    : `What actually came out of ${videos.length} pack openings on camera, counted from our own rip log rather than estimated.`
}">
${judged.length ? "" : '<meta name="robots" content="noindex,follow">\n'}<link rel="canonical" href="${SITE}/luck.html">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="Pokemon Pack Luck, Measured">
<meta property="og:description" content="Hit rates observed across ${judged.length} real pack openings, by set and by product.">
<meta property="og:url" content="${SITE}/luck.html">
<meta property="og:image" content="${SITE}/assets/og-luck.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-luck.jpg">
${FONTS}
${STYLES}
<style>${miniCSS(style)}</style>
${ld ? `<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>` : "<!-- No Dataset markup: there are no judged rips yet, so there is nothing to describe. -->"}
</head>
<body>
${SKIP}
${SPRITE}

${BAR}
${MENU}
${body}

${footer()}

${APP_JS}
</body>
</html>
`;

await writeFile(OUT, html);

console.log(`Wrote public/luck.html
  ${judged.length} of ${videos.length} rips logged either way (${Math.round(coverage * 100)}%)
  ${hits.length} hits, ${headline} overall
  ${bySet.filter((r) => r.rips >= MIN_SAMPLE).length} of ${bySet.length} sets have a big enough sample to show a rate
  ${packsKnown} rips have a pack count, ${totalPacks} packs counted`);
if (!judged.length) {
  console.log(`
  Nothing is marked "Has Hit" in the rip log yet, so every rate is empty.
  Fill that column in the spreadsheet, run import-sheet.mjs, and this fills in.`);
}
