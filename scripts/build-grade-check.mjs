#!/usr/bin/env node
// Build /will-it-grade.html: will this card actually come back a 10.
//
//   node scripts/build-grade-check.mjs
//
// Reads data/grade-check.json. Sibling of /grading.html, which answers what
// grading COSTS. The two cross-link in body prose, the same way /what-set.html
// and /rarity.html do.
//
// WHY THIS IS ITS OWN PAGE RATHER THAN A SECTION ON /grading.html, since that
// was the obvious alternative and it is wrong for four reasons.
//
// It is a different search with a different answer shape. /grading.html targets
// the cost query and its title and meta description both commit to that. "Will
// my card get a 10" and "PSA 10 centering" are condition queries. One page
// cannot carry two title tags, and retitling the money page to cover both would
// weaken the one it already ranks for.
//
// The site's own pattern says sibling. shared/chrome.mjs describes the
// what-set and rarity pair as answering "the two halves of the same question
// somebody asks holding one card". This is the same shape exactly.
//
// It would swamp the host. /grading.html is about 1,880 words and its whole
// reason to exist is the break-even tables. Bolting a five-company centering
// table, four sets of grade definitions, subgrade arithmetic and a dozen defect
// definitions on top pushes those tables under a wall of standards.
//
// And the two pages want opposite conclusions, which is a feature. The money
// page says the fee only clears on a 10. This one says here is why you are
// probably not holding one. In sequence that is an argument. Merged it is a
// mood.
//
// THE PAGE LEADS WITH DISAGREEMENT ON PURPOSE. The tempting version prints one
// tidy centering tolerance. There isn't one: five companies publish five
// different numbers, TAG is the only one that publishes a separate figure for
// trading cards at all, CGC stops publishing a TCG number below grade 10, and
// SGC never publishes a back tolerance. A single clean table would be inventing
// a consensus that does not exist, on a page where being wrong costs the reader
// a $79.99 submission.
//
// EVERY CLAIM CARRIES ITS COMPANY AND ITS LINK, because on this subject the
// hobby repeats things nobody published. The clearest example is in the data:
// no grading company uses the word "whitening" anywhere in its standards.

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
import { esc, longDate, clipMeta} from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(await readFile(join(ROOT, "data/grade-check.json"), "utf8"));

// Read the sibling page's data rather than restating its shape. This sentence
// promised "the fee table for all four companies" and a fifth had just been
// added next door.
const NUM_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];
const nGrading = JSON.parse(await readFile(join(ROOT, "data/grading.json"), "utf8")).companies.length;
const GRADING_CO = NUM_WORD[nGrading] || String(nGrading);

const CO = ["psa", "cgc", "beckett", "sgc", "tag"];
const CO_NAME = { psa: "PSA", cgc: "CGC", beckett: "Beckett (BGS)", sgc: "SGC", tag: "TAG" };

// A blank cell is a FINDING, not a gap, so it is drawn as one and explained in
// the caption rather than left looking like missing data.
const cell = (v) =>
  v ? `<td>${esc(v)}</td>` : `<td class="gc-none"><span>not published</span></td>`;

// tabindex + role + label, because an overflowing box a keyboard cannot reach
// is content a keyboard cannot read. These tables are min-width:640px inside a
// 360px box: 280px, about 44% of every row, is off to the right, and there is
// NOTHING focusable inside one to tab to. build-expansions.mjs worked this out
// and wrote it down; this page shipped without it anyway, which is the whole
// value of an audit that reads other files.
/* THE CAPTION USED TO BE THE ONE THING ON THIS PAGE A PHONE COULD NOT READ, and
   the note under .gc-tw below already recorded the symptom ("NOTE HOW MUCH
   WIDER THE TOLERA") without fixing the cause. A <caption> is laid out at its
   TABLE's width, and .gc-t is min-width:640px inside a 352px .gc-tw scroller, so
   288px of the line sat off screen at 390x844 and the reader had to drag the
   table sideways to finish a heading. The scroll cues that note added tell you
   there is more table to the right; they do not put the title back on screen.
   Out of the scroller, then, exactly as
   /first-partner-illustration-collection.html does it and as build-openings.mjs
   now does: the visible line is a <p> that wraps to the viewport and the
   <caption> stays .sr-only so the table keeps its accessible name. */
const table = (rows, cap) => `      <p class="gc-tcap">${cap}</p>
      <div class="gc-tw" tabindex="0" role="region" aria-label="${esc(
  String(cap).replace(/<[^>]+>/g, "")
)}, scrollable table">
        <table class="gc-t">
          <caption class="sr-only">${cap}</caption>
          <thead><tr><th scope="col">Grade</th>${CO.map((c) => `<th scope="col">${CO_NAME[c]}</th>`).join("")}</tr></thead>
          <tbody>
${rows.map((r) => `            <tr><th scope="row">${esc(r.grade)}</th>${CO.map((c) => cell(r[c])).join("")}</tr>`).join("\n")}
          </tbody>
        </table>
      </div>`;

// A SCREEN READER'S LINK LIST IS JUST THE LINK TEXT. This page had 23 links all
// reading "Source", each going somewhere different, which reads out as 23
// identical rows with no way to tell them apart. The visible word stays
// "Source" because in context that is exactly right and anything longer clutters
// a sentence; `what` supplies the accessible name instead.
const src = (url, what) =>
  url
    ? ` <a class="gc-s" href="${esc(url)}"${what ? ` aria-label="Source: ${esc(what)}"` : ""} rel="noopener" target="_blank">Source</a>`
    : "";

const c = d.centering;

// ============================================================================
// THE CENTERING DIAGRAM.
//
// This section is the one place on a 3,758 word page where the subject is a
// SHAPE. "A card described as 50/50 top to bottom and 60/40 left to right has 60
// percent of the border on one side of the photo and 40 percent on the other" is
// a correct sentence that most readers have to re-read, and the whole page hangs
// off understanding it: every row of both tables underneath is a pair of those
// numbers. A drawn rectangle inside another rectangle says it at a glance.
//
// IT IS DRAWN, NOT PHOTOGRAPHED, AND THAT IS THE POINT rather than a compromise.
// A photograph of a real off-centre card would be a claim about that card's
// grade, which is exactly what this site does not do, and we have no such photo
// we are allowed to publish anyway. A diagram makes no claim about any object:
// it is the definition, rendered. Same reasoning as rarityMark() in
// shared/rarity.mjs, and the same cost, which is nothing.
//
// THE GEOMETRY IS READ OUT OF THE SENTENCE, NOT TYPED IN BESIDE IT. The ratios
// are parsed from c.howMeasured.example, so a diagram that disagreed with the
// prose it illustrates cannot be built: it throws instead. That matters more
// here than usual because the numbers in that sentence are PSA's, sourced, and a
// picture quietly showing a different split would be this page inventing a
// tolerance.
const RATIO = /(\d{2})\/(\d{2})\s+top to bottom and\s+(\d{2})\/(\d{2})\s+left to right/i.exec(
  c.howMeasured.example
);
if (!RATIO) {
  throw new Error(
    `The centering diagram derives its geometry from centering.howMeasured.example, and that ` +
      `sentence no longer parses as "NN/NN top to bottom and NN/NN left to right":\n  ` +
      `"${c.howMeasured.example}"\n` +
      `Either restore the shape of the sentence or update the regex AND the diagram together. ` +
      `Do not ship a picture showing a split the copy beside it does not state.`
  );
}
const [, TOP, BOT, LEFT, RIGHT] = RATIO.map(Number);
if (TOP + BOT !== 100 || LEFT + RIGHT !== 100) {
  throw new Error(`Centering example does not sum to 100: ${TOP}/${BOT} and ${LEFT}/${RIGHT}`);
}

/**
 * The card, its photo window, and the four borders labelled.
 *
 * Coordinates are a 200x280 card, which is the 245x337 proportion every scan on
 * this site uses, rounded to numbers a reader could check. BORDER is the total
 * border on each axis; the split moves the window inside it. At 60/40 the left
 * border is 1.5x the right, which is visible without being cartoonish, and that
 * is the honest look of a card PSA would still call a 9.
 *
 * aria-hidden with a <figcaption> doing the talking: the shape carries no
 * information the sentence above it does not already state, so announcing a
 * dozen SVG labels to a screen reader is a dozen interruptions to repeat it.
 */
function centeringDiagram() {
  const W = 200, H = 280, BORDER_X = 44, BORDER_Y = 52;
  const lx = (BORDER_X * LEFT) / 50 / 2; // left border width at this split
  const ty = (BORDER_Y * TOP) / 50 / 2;
  const win = { x: lx, y: ty, w: W - BORDER_X, h: H - BORDER_Y };
  const mid = win.y + win.h / 2;
  // THE TWO BORDERS ARE SHADED, not just ticked. At the real proportions of a
  // card a 60/40 split is a 26px gap against a 17px one, which two thin
  // dimension lines make the reader measure by eye. Filling both strips turns it
  // into an area comparison, which is read rather than measured, and the strips
  // are the literal thing the number describes.
  const dim = (x1, x2, y, label) => `
    <rect x="${x1}" y="${win.y}" width="${x2 - x1}" height="${win.h}" class="ct-band"/>
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="ct-dim"/>
    <line x1="${x1}" y1="${y - 6}" x2="${x1}" y2="${y + 6}" class="ct-dim"/>
    <line x1="${x2}" y1="${y - 6}" x2="${x2}" y2="${y + 6}" class="ct-dim"/>
    <text x="${(x1 + x2) / 2}" y="${y - 11}" class="ct-lab">${label}</text>`;
  return `<figure class="ct-fig">
        <svg viewBox="-6 -24 ${W + 12} ${H + 36}" class="ct-svg" role="img"
             aria-label="A card with ${LEFT} percent of its left-to-right border on the left of the picture and ${RIGHT} percent on the right, which is what ${LEFT}/${RIGHT} centering means.">
          <rect x="0" y="0" width="${W}" height="${H}" rx="9" class="ct-card"/>
          ${dim(0, win.x, mid, `${LEFT}`)}
          ${dim(win.x + win.w, W, mid, `${RIGHT}`)}
          <rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" rx="3" class="ct-win"/>
          <text x="${W / 2}" y="${win.y + win.h / 2 + 5}" class="ct-in">the picture</text>
          <text x="${W / 2}" y="-9" class="ct-lab">${TOP} / ${BOT} top to bottom</text>
        </svg>
        <figcaption>What <b>${LEFT}/${RIGHT}</b> looks like. The border left of the picture is
          ${(LEFT / RIGHT).toFixed(1)} times the border right of it. Every pair of numbers in the two
          tables below is this same measurement, on one axis or the other.</figcaption>
      </figure>`;
}

// ============================================================================
// THE FRONT AND BACK LADDER, and it is the same argument as the diagram above
// made four grades wide.
//
// The two tables print eight PSA numbers: 55/45, 60/40, 65/35 and 70/30 on the
// front, 75/25 and three 90/10s on the back. The back table's own caption tells
// the reader to "note how much wider the tolerances are", which is a table
// asking to be looked at as a picture. So here is the picture: the same card
// drawn at each of those eight splits, front beside back, one row per grade.
//
// WHAT IT ADDS THAT THE TABLE DOES NOT. "90/10" is a pair of digits. Drawn, it
// is a card whose picture is nearly touching one edge, sitting beside a front at
// 60/40 that still looks roughly straight, on the SAME grade row. The gap
// between the front and back standard is the finding of that whole section and
// it is invisible in a table of numbers because both halves read as numbers.
//
// DRAWN, NOT PHOTOGRAPHED, for the reason the diagram above already records: a
// photograph of a real card would be a claim about that card's grade. A diagram
// is the published standard rendered, and it makes no claim about any object.
//
// PSA ONLY, AND THE CAPTION SAYS SO, because the row has to be one company's or
// it is a consensus this page spends its opening arguing does not exist. PSA is
// the one with a published number in every cell of both tables; Beckett is
// stricter on the front at 9 and CGC stops publishing a TCG number below 10,
// which is what the tables beside this are for.
//
// THE GEOMETRY IS PARSED OUT OF THE DATA, never typed in, exactly as the
// diagram above parses its example sentence. A picture showing a split the table
// beside it does not state would be this page inventing a tolerance, so an
// unparseable or non-summing value throws the build.
const splitOf = (v) => {
  const m = /(\d{2})\s*\/\s*(\d{1,2})/.exec(String(v || ""));
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]);
  if (a + b !== 100) {
    throw new Error(
      `build-grade-check: centering value "${v}" parses as ${a}/${b}, which does not sum to 100. ` +
        `The front/back ladder draws these as real proportions, so a pair that is not a percentage ` +
        `split would be a picture of nothing. Fix the data or the parse, not the drawing.`
    );
  }
  return [a, b];
};

const LADDER = c.front
  .map((row, i) => {
    const front = splitOf(row.psa);
    const back = splitOf(c.back[i]?.psa);
    return front && back && c.back[i]?.grade === row.grade
      ? { grade: row.grade, front, back, frontText: row.psa, backText: c.back[i].psa }
      : null;
  })
  .filter(Boolean);

if (!LADDER.length) {
  throw new Error(
    "build-grade-check: no grade has a PSA number in BOTH the front and the back centering table, " +
      "so the front-and-back ladder would render empty. Either the data changed shape or PSA's " +
      "column emptied out; do not ship the figure with a silent zero rows."
  );
}

/**
 * One small card drawn at a given left/right split.
 *
 * 100x140 is the 245x337 proportion every scan on this site uses, halved from
 * the 200x280 the big diagram uses so the two are the same object at two sizes.
 * BORDER is the total left-plus-right border; lx = BORDER * left / 100 puts the
 * window where the number says, and at 50/50 that is exactly half.
 *
 * THE TWO BORDER STRIPS ARE SHADED and that is the difference between this
 * reading and not reading. Drawn as an outline and a window only, a 90/10 card
 * at this size is a rectangle sitting 19px from one edge and 2px from the
 * other, and the eye compares it to the card outline rather than to itself: the
 * first build of this figure was four rows of cards that all looked much the
 * same. Filling both strips makes it an area comparison, which is read rather
 * than measured. It is the same fix, and the same `.ct-band`, the big diagram
 * above already carries; that comment says so and this one repeated the mistake
 * anyway, which is why it is written down twice now.
 *
 * aria-hidden, because the ratio is printed in text directly under every one of
 * them and the figure has a figcaption. Eight SVG labels announced to a screen
 * reader would be the same eight numbers a third time.
 */
const miniCard = (left) => {
  const W = 100, H = 140, BX = 24, BY = 30;
  const lx = (BX * left) / 100;
  const win = { x: lx, y: BY / 2, w: W - BX, h: H - BY };
  return `<svg viewBox="0 0 ${W} ${H}" class="lad-svg" aria-hidden="true" focusable="false">
              <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="6" class="ct-card"/>
              <rect x="2" y="${win.y}" width="${Math.max(0, win.x - 2)}" height="${win.h}" class="ct-band"/>
              <rect x="${win.x + win.w}" y="${win.y}" width="${Math.max(0, W - 2 - win.x - win.w)}" height="${win.h}" class="ct-band"/>
              <rect x="${win.x}" y="${win.y}" width="${win.w}" height="${win.h}" rx="2" class="ct-win"/>
            </svg>`;
};

// ---------------------------------------------------------------------------
// THIS SITS IN JS AND NOT BESIDE THE DECLARATIONS IT DESCRIBES, because the
// style block below ships to the browser verbatim: nothing strips comments out
// of a page-level <style> the way build-css.mjs strips them out of ui.css, so
// prose written in there is render-blocking page weight. Measured when these
// notes were first written into the CSS: +1,411 bytes gzipped on /rarity.html,
// +634 on /will-it-grade.html, +519 on /index.html and +459 on /start.html.
//
// THE LADDER'S TRACKS ARE FIXED AND THE PANEL IS NOT, so on the narrowest
// phones the row is wider than the box it sits in and paints out through it.
// The tracks do not shrink: col 1 has a 104px floor and cols 2 and 3 are auto
// against a 56px drawing with a 56px caption under it, so the row is
// 104 + 24 + 56 + 24 + 56 = 264px at every width. At 320 the panel's content
// box is 242px (320 less two 20px gutters, less the 3px border and 16px
// padding either side), so 22px of row hangs out of a 242px box and 3px of it
// lands past the page gutter. The grid's own rect measures 242 and reports
// nothing wrong, which is why only a paint-edge measurement finds this.
// IT CLEARED BY 1px AT THE OLD 16px GUTTER and that is the whole reason it was
// never seen: the row ended at 299 against a 304 limit. A layout held together
// by four pixels of luck is not held together, so this fixes the row rather
// than the four pixels, and it buys real headroom instead of just enough.
// TWO CHANGES, PHONE ONLY, and 88px is not a guess: "Near Mint-Mint 8" is the
// longest grade name and measures exactly 104.00px on one line, which is what
// pins the first column. It carries a hyphen, so at 88 it breaks after "Near
// Mint-" instead of pinning the track, and the row becomes
// 88 + 12 + 56 + 12 + 56 = 224px inside 242: 18px spare rather than -22.
// Above 700px nothing here applies and the desktop flex layout is untouched.
// ---------------------------------------------------------------------------
const ladder = () => `      <figure class="lad">
        <div class="lad-grid">
          <span class="lad-h"></span>
          <span class="lad-h">Front</span>
          <span class="lad-h">Back</span>
${LADDER.map(
  (r) => `          <span class="lad-g">${esc(r.grade)}</span>
          <span class="lad-c">${miniCard(r.front[0])}<b>${esc(r.frontText)}</b></span>
          <span class="lad-c">${miniCard(r.back[0])}<b>${esc(r.backText)}</b></span>`
).join("\n")}
        </div>
        <figcaption>PSA's published centering, drawn to scale, left to right. Every one of these is a
          card PSA would still give that grade on centering alone. The back column is the same grade as
          the front beside it: at Mint 9 the front has to be within ${esc(LADDER.find((r) => /9/.test(r.grade))?.frontText || "")}
          and the back may be ${esc(LADDER.find((r) => /9/.test(r.grade))?.backText || "")}, which is why the
          section above says almost nobody checks the back. Numbers are PSA's own, from the table above;
          the drawing adds nothing to them except scale.</figcaption>
      </figure>`;

// ============================================================================
// THE SUBGRADE ARITHMETIC, and it is the one figure on this page that draws an
// argument rather than a shape.
//
// The panel at the top of the page is the most useful thing on it: your WORST
// component decides the grade, and the final number is not an average. It says
// that in five rules and then prints three worked examples as text, which is
// the strongest evidence on the page and the least visible. "Centering 9.5,
// Corners 9.5, Edges 9, Surface 8 = 8.5" is a sentence a reader has to do
// arithmetic on to disbelieve their own assumption.
//
// WHAT THE PICTURE ADDS, and it is a real finding rather than a restatement.
// The three examples average 9.000, 9.125 and 9.000. They come back 8.5, 9 and
// 7. Drawn on one axis the dashed average lines form an almost straight column
// while the solid grade lines step away to the left, and the third row's grade
// lands beside its lowest component with three 10s sitting untouched above it.
// The claim "the overall grade is not an average" stops being something the
// reader takes on trust and becomes something they can see in one look. Nothing
// on the page states that the three averages are nearly identical, because it
// is only visible once somebody works all three out.
//
// THE AVERAGE IS DRAWN EVEN THOUGH IT IS THE WRONG METHOD, and that is the
// point of drawing it. It is the sum every reader does in their head, and a
// figure that omitted it would be answering a question nobody asked. The
// caption says in as many words that the dashed line is the guess and the solid
// line is the answer.
//
// EVERY NUMBER IS PARSED OUT OF THE EXAMPLES IT DRAWS. The four component
// scores come out of `sub`, the grade out of `final`, and the build throws with
// the row and the text that is there now if either stops parsing. The two
// derived numbers are the minimum and the mean, both plain arithmetic over the
// four parsed scores and both shown in the caption so a reader can check them.
// Same discipline as centeringDiagram above and the postage chart in
// build-buying.mjs: this site does not publish a figure it cannot trace, and a
// picture is a figure.
//
// THE ASSERTION THAT IS DELIBERATELY NOT MADE. `rules` contains both "the final
// grade is at most about half a grade above the lowest subgrade" and "it rarely
// if ever exceeds two levels above the lowest of the four", and the two
// disagree. The third example is min 6 and final 7, which is a whole grade, so
// asserting the half-grade rule would fail the build on Beckett's own worked
// example. Only `final < mean` is asserted, which is the rule the figure is
// about and the one all three rows keep.
const CRIT = ["Centering", "Corners", "Edges", "Surface"];
const SUBS = (d.subgrades.math.examples || []).map((e, i) => {
  const pairs = [...String(e.sub || "").matchAll(/([A-Za-z]+)\s+(\d+(?:\.\d)?)/g)];
  if (pairs.length !== CRIT.length) {
    throw new Error(
      `build-grade-check: the subgrade figure reads four "name score" pairs off ` +
        `subgrades.math.examples[${i}].sub and found ${pairs.length}. It now reads: ` +
        `${JSON.stringify(e.sub)}. Do not ship a picture drawing fewer components than the ` +
        `sentence beside it lists: restore the sentence, or update the parse and the figure together.`
    );
  }
  const names = pairs.map((p) => p[1]);
  if (names.join(",") !== CRIT.join(",")) {
    throw new Error(
      `build-grade-check: subgrades.math.examples[${i}].sub names ${JSON.stringify(names)} and the ` +
        `figure draws ${JSON.stringify(CRIT)}, which are the four Beckett publishes. A figure whose ` +
        `axis is a different set of criteria from the data is not the same claim.`
    );
  }
  const vals = pairs.map((p) => Number(p[2]));
  const final = Number(e.final);
  if (!vals.every((v) => v > 0 && v <= 10) || !(final > 0 && final <= 10)) {
    throw new Error(
      `build-grade-check: subgrades.math.examples[${i}] parsed to scores ${JSON.stringify(vals)} and ` +
        `a grade of ${JSON.stringify(e.final)}. Everything here has to land on the 1 to 10 scale the ` +
        `figure's axis draws.`
    );
  }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min(...vals);
  if (!(min <= final && final < mean)) {
    throw new Error(
      `build-grade-check: subgrades.math.examples[${i}] has a final grade of ${final} against a ` +
        `lowest component of ${min} and an average of ${mean}. The figure's caption states that every ` +
        `grade lands at or above the lowest component and below the average, which is rules[0] and ` +
        `rules[1] together, and this row breaks it. Either the example changed or the rules did; do ` +
        `not ship a picture making a claim its own rows disprove.`
    );
  }
  return { vals, final, mean, min, text: e.sub };
});
if (SUBS.length < 2) {
  throw new Error(
    `build-grade-check: the subgrade figure needs at least two worked examples to compare and ` +
      `subgrades.math.examples has ${SUBS.length}. One row is an anecdote, not a picture.`
  );
}

/**
 * Three examples on one grade axis: the four components, their average, the
 * grade that came back.
 *
 * THE AXIS RUNS 6 TO 10 AND EVERY WHOLE GRADE ON IT IS TICKED AND NUMBERED.
 * Every value in the data sits in that range, and drawn 1 to 10 the whole figure
 * crushes into the right-hand third: half a grade, which is the difference the
 * page is arguing about, becomes 12px. A truncated axis is a distortion only
 * when the reader cannot see where it starts, so the start is drawn, labelled
 * and repeated in the caption.
 *
 * THE MARKS ARE THREE SHAPES, NOT THREE COLOURS, and that is not a preference.
 * --ketchup and --navy both resolve to #111111 in ui.css today, and this figure
 * sits inside .gc-key, which is filled with --navy. A mark distinguished by hue
 * would be a black mark on a black panel, which is the exact failure recorded at
 * the top of CLAUDE.md. A stacked dot, a dashed rule and a solid rule with a
 * flag under it stay legible with every fill in the file set to one value.
 *
 * DOTS STACK RATHER THAN OVERPRINT. Two of the three examples hold the same
 * score twice and the third holds 10 three times, so a single mark per value
 * would draw the third row as two components instead of four and quietly delete
 * the "three perfect attributes" the paragraph under it depends on.
 */
const sgFig = () => {
  // THE FRAME WAS 300 AND THE DRAWING ENDS AT 274, SO A PHONE WAS SCALING 26
  // UNITS OF NOTHING. The drawing ends at the "10" tick, centred on X1=268 and
  // so reaching 274 at
  // the current type size; the viewBox ran to 300, so 26 units of every phone's
  // width were empty. Cropping the frame to the ink is the one lever here that
  // costs nothing: not a single coordinate below moves, no label changes its
  // position relative to any other, and the whole drawing including its type
  // scales up by 300/276. At 320 that is 7.53px -> 8.19px on .sg-key.
  //
  // IT IS NOT ENOUGH ON ITS OWN AND THE REST IS NOT AVAILABLE HERE. The floor
  // is 12px (see .gd-fig below), which needs .sg-key at 14.7 units, and the KEY
  // ROW caps it at 10.6: "One component" starts at x=13 and the average marker
  // is a line at x=96, so 13 characters of Space Mono at 0.6em collide with it
  // past 10.6 units. That is a SIBLING collision, not a frame one, so measuring
  // labels against the viewBox edge does not see it -- the edge says 20.3.
  // Raising .sg-key in a media query paints the key over the marker it is
  // labelling and nothing errors. Fixing it means re-spacing the three key
  // groups, which moves them at every width including the desktop, so it is a
  // redraw and is left for one.
  //
  // 276 AND NOT 274: the two spare units are the headroom the "10" tick needs
  // if anybody ever moves X1. Re-measure the ink before cropping further.
  const VB_W = 276, X0 = 44, X1 = 268, G0 = 6, G1 = 10;
  const ROW_H = 58, TOP = 34;
  const H = TOP + SUBS.length * ROW_H + 4;
  const x = (g) => X0 + ((g - G0) / (G1 - G0)) * (X1 - X0);
  const ticks = [];
  for (let g = G0; g <= G1; g++) ticks.push(g);
  const rows = SUBS.map((s, i) => {
    const top = TOP + i * ROW_H;
    const base = top + 34;
    // One stack per distinct score, in the order the sentence lists them.
    const seen = new Map();
    const dots = s.vals
      .map((v) => {
        const n = seen.get(v) || 0;
        seen.set(v, n + 1);
        const worst = v === s.min;
        return `<circle cx="${x(v).toFixed(1)}" cy="${(base - 9 - n * 9).toFixed(1)}" r="${
          worst ? 4.6 : 3.6
        }" class="${worst ? "sg-worst" : "sg-dot"}"/>`;
      })
      .join("");
    return `
      <line x1="${X0}" y1="${base}" x2="${X1}" y2="${base}" class="sg-base"/>
      ${dots}
      <line x1="${x(s.mean).toFixed(1)}" y1="${top + 2}" x2="${x(s.mean).toFixed(1)}" y2="${base + 4}" class="sg-mean"/>
      <line x1="${x(s.final).toFixed(1)}" y1="${top + 2}" x2="${x(s.final).toFixed(1)}" y2="${base + 9}" class="sg-final"/>
      <text x="${x(s.final).toFixed(1)}" y="${base + 21}" class="sg-num">${s.final}</text>`;
  }).join("");
  return `        <figure class="sg">
          ${/* aria-hidden, and that is this file's own rule rather than an
                oversight. The three examples are printed as text in the .gc-ex
                list directly above, the averages and the minimum are stated in
                the figcaption below, and the rule is: hide the shape when the
                caption and the prose already carry the facts, give it a
                role="img" and a SENTENCE only when the shape is the only place
                a fact appears. An aria-label enumerating twelve component
                scores would read the list out a second time. */ ""}
          <svg viewBox="0 0 ${VB_W} ${H}" class="sg-svg" aria-hidden="true" focusable="false">
            ${/* THE KEY IS LAID OUT BY HAND IN VIEWBOX UNITS AND THE NUMBERS
                  BELOW ARE MEASURED, NOT GUESSED. SVG text neither wraps nor
                  clips, so a label that outgrows its slot paints straight over
                  the next marker and nothing errors. Space Mono advances 0.6em,
                  so at 10px every character is 6.0px: "One component" is 78,
                  "The average" 66, "The grade" 54, and the three groups end at
                  85, 173 and 245 inside a 300 unit box. Re-measure if you
                  reword one. */ ""}
            <circle cx="5" cy="5.5" r="3.6" class="sg-dot"/>
            <text x="13" y="9" class="sg-key">One component</text>
            <line x1="96" y1="0" x2="96" y2="11" class="sg-mean"/>
            <text x="104" y="9" class="sg-key">The average</text>
            <line x1="180" y1="0" x2="180" y2="11" class="sg-final"/>
            <text x="188" y="9" class="sg-key">The grade</text>
            ${ticks
              .map(
                (g) =>
                  `<line x1="${x(g).toFixed(1)}" y1="26" x2="${x(g).toFixed(1)}" y2="${H - 4}" class="sg-grid"/>
            <text x="${x(g).toFixed(1)}" y="22" class="sg-ax">${g}</text>`
              )
              .join("\n            ")}${rows}
          </svg>
          <figcaption>The three examples above, in the same order, on one axis running 6 to 10. The dashed
            line is the average of the four components, which is the sum a reader does in their head and is
            not how the grade is worked out. The solid line is the grade Beckett's own example says comes
            back. The averages are ${SUBS.map((s) => (+s.mean.toFixed(3)).toString()).join(", ")}, which is
            nearly the same card three times. The grades are ${SUBS.map((s) => s.final).join(", ")}. In every
            row the grade sits at or above the ringed dot, which is the lowest of the four, and below the
            dashed line.${
              /* THE LAST SENTENCE IS CONDITIONAL AND COUNTS ITS OWN TENS rather than asserting
                 "three are perfect", which was typed in and would have gone quietly wrong the day
                 the example changed. It is the sentence soWhat makes in prose directly below, so
                 it is only worth drawing attention to while the row still supports it. */
              (() => {
                const last = SUBS[SUBS.length - 1];
                const tens = last.vals.filter((v) => v === 10).length;
                return tens >= 2
                  ? ` The bottom row is the one to look at: ${NUM_WORD[tens] || tens} of its four
            components are a perfect 10 and it still comes back a ${last.final}.`
                  : "";
              })()
            }</figcaption>
        </figure>`;
};

// ============================================================================
// WHERE THE FIVE COMPANIES ACTUALLY PART COMPANY.
//
// The two tables hold fifty cells and a phone shows about half of one row at a
// time: the comment above `table` records that they are 640px wide inside a
// 360px box, so 280px of every row is off to the right. Everything a reader
// could learn by looking at all fifty at once is therefore unavailable to most
// of the people reading this page, and there are two things to learn.
//
// THE FIRST IS THE ONE THE SECTION ALREADY ARGUES. The front and the back are
// different standards, and drawn on one axis the back rows sit bodily to the
// right of the front rows above them. findings[0] says almost nobody checks the
// back; this is why it matters.
//
// THE SECOND IS NOT STATED ANYWHERE AND IT IS THE REASON THIS FIGURE EXISTS. On
// the FRONT these companies mostly agree. At Gem Mint 10 all five publish
// 55/45, the same number; at the three grades below it four agree and Beckett
// alone is one step stricter. It is the BACK where they scatter, three different
// numbers at three grades, and it is the back where six of ten cells below Gem
// Mint are not published at all. "The companies disagree" is true, and the
// useful version is that they disagree about the face nobody looks at.
//
// SO THE DOT IS SIZED BY HOW MANY COMPANIES SHARE IT rather than stacked one
// per company, and that choice is the whole figure. Stacked, the Gem Mint front
// row is a column of five dots 40 units tall and every row has to be that tall.
// Sized, agreement is ONE BIG MARK and disagreement is a spread of small ones,
// which is the reading, not a decoration of it.
//
// THE ABSENCES ARE COUNTED IN THEIR OWN COLUMN rather than left as a gap,
// because a row with two dots and a row with five dots that happen to overlap
// look alike otherwise, and "how many published anything" is half of what this
// picture is for. Same policy as the "not published" cells in the tables and the
// no-threshold rows on /buying.html: a stated absence, drawn.
//
// EVERY VALUE COMES THROUGH splitOf, the same parse the ladder above uses, so a
// cell that stops being a percentage split throws instead of drawing wrong.
const SPREAD = ["front", "back"].flatMap((face) =>
  c[face].map((row, i) => {
    const vals = CO.map((co) => splitOf(row[co])).map((s) => (s ? s[0] : null));
    const counts = new Map();
    vals.filter((v) => v != null).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    return {
      face,
      i,
      grade: row.grade,
      published: vals.filter((v) => v != null).length,
      groups: [...counts.entries()].map(([v, n]) => ({ v, n })).sort((a, b) => a.v - b.v),
    };
  })
);
// Front and back are printed as two tables with the same grade rows, and the
// figure pairs them by INDEX. If the two ever stop lining up, every back row in
// this drawing is quietly attached to the wrong grade, which is invisible.
c.front.forEach((row, i) => {
  if (c.back[i]?.grade !== row.grade) {
    throw new Error(
      `build-grade-check: the front table's row ${i} is ${JSON.stringify(row.grade)} and the back ` +
        `table's is ${JSON.stringify(c.back[i]?.grade)}. The spread figure draws them as one grade with ` +
        `two faces and would label the back row with the front row's grade. Realign the two tables.`
    );
  }
});
// THE CAPTION'S TWO CLAIMS ARE COMPUTED, NOT TYPED. The first draft said "all
// five publish 55/45 at Gem Mint 10, and below it four agree with Beckett one
// step stricter", which is true today and is exactly the kind of sentence that
// survives the data changing under it. Both are worked out here, and the
// sentence is dropped rather than made wrong if the shape stops holding.
const UNANIMOUS = SPREAD.filter(
  (r) => r.face === "front" && r.groups.length === 1 && r.groups[0].n === CO.length
);
// A row where every company but one lands on the same number. `odd` is the
// company holding out and `strict` says whether it is the tighter tolerance,
// which is the only version of this sentence worth printing.
const ODD_OUT = SPREAD.filter((r) => r.face === "front")
  .map((r) => {
    if (r.groups.length !== 2) return null;
    const big = r.groups.find((g) => g.n === CO.length - 1);
    const one = r.groups.find((g) => g.n === 1);
    if (!big || !one) return null;
    const co = CO.find((k) => (splitOf(c.front[r.i][k]) || [])[0] === one.v);
    return co ? { co, strict: one.v < big.v } : null;
  })
  .filter(Boolean);
const ODD_CO =
  ODD_OUT.length >= 2 && ODD_OUT.every((o) => o.co === ODD_OUT[0].co && o.strict === ODD_OUT[0].strict)
    ? ODD_OUT[0]
    : null;
const BACK_MISSING = SPREAD.filter((r) => r.face === "back").reduce(
  (n, r) => n + (CO.length - r.published),
  0
);

const SPREAD_MIN = Math.min(...SPREAD.flatMap((r) => r.groups.map((g) => g.v)));
const SPREAD_MAX = Math.max(...SPREAD.flatMap((r) => r.groups.map((g) => g.v)));
if (!(SPREAD_MAX > SPREAD_MIN)) {
  throw new Error(
    `build-grade-check: every published centering value is ${SPREAD_MIN}, so the spread figure has no ` +
      `axis to draw. Either the data collapsed or the parse did.`
  );
}

/**
 * Ten rows, one per grade per face, on one axis of published tolerance.
 *
 * THE AXIS IS THE BIGGER HALF OF THE SPLIT, which is the number that gets worse
 * as you go right: 55/45 is a card PSA calls Gem Mint and 90/10 is a back it
 * calls Mint 9. It runs from the smallest published value to the largest, both
 * read out of the data rather than rounded to a tidy 50 and 100, because
 * rounding to 100 would push every mark on the figure into the left half.
 *
 * NOTHING IS CARRIED BY COLOUR. The front row and the back row of a pair are
 * told apart by the word beside them and by which is above the other, the size
 * of a dot carries agreement, and a hollow square carries absence. --ink,
 * --navy, --ketchup and --keyline are all #111111 in ui.css today; this figure
 * would read identically if the rest went the same way.
 */
// SVG TEXT NEITHER WRAPS NOR CLIPS, AND ALL THREE LABEL COLUMNS HERE OVERRAN
// THEIR SLOTS ON THE FIRST BUILD. "Near Mint-Mint 8" painted straight through
// the word "front" beside it and the axis heading painted through the word
// above the count column, and both looked like a rendering fault rather than a
// layout mistake. Nothing errors when it happens, and it was found by
// screenshotting, which is the only way it can be found.
//
// So the widths are checked instead of eyeballed. Space Mono advances 0.6em, so
// a label is characters x 0.6 x its size in viewBox units, which is exact for
// this face and near enough for any monospace. If a grade name grows past its
// gutter the build stops and names it, rather than shipping two words on top of
// each other.
const MONO_ADV = 0.6;
const monoW = (s, px) => String(s).length * MONO_ADV * px;
const fits = (s, px, room, what) => {
  const w = monoW(s, px);
  if (w > room) {
    throw new Error(
      `build-grade-check: the spread figure's ${what} is ${JSON.stringify(s)}, which is ${w.toFixed(
        1
      )} viewBox units at ${px} and the slot is ${room}. SVG text does not wrap and does not clip, so ` +
        `this would paint over the column beside it and nothing would error. Widen the gutter and move ` +
        `the axis, or shorten the label.`
    );
  }
  return s;
};

const spreadFig = () => {
  // THE GUTTERS ARE MEASURED OFF THE DATA, NOT PICKED. Hand-set to 86 units
  // this threw on "Near Mint-Mint 8", which is 86.4, and moving it to 88 would
  // just have deferred the same failure to the next grade name Beckett invents.
  // The grade column is as wide as the longest grade the file holds, the face
  // column as wide as the longer of the two words, and the axis starts after
  // both. The guard below is still worth keeping: it is what catches a label
  // that is not a grade name.
  const W = 300, X1 = 262, TOP = 26, ROW = 19, PAIR = 6;
  const GRADE_W = Math.ceil(Math.max(...c.front.map((r) => monoW(r.grade, 9)))) + 4;
  const FACE_W = Math.ceil(Math.max(monoW("front", 9), monoW("back", 9))) + 4;
  const FACE_X = GRADE_W;
  const X0 = FACE_X + FACE_W + 4;
  const H = TOP + SPREAD.length * ROW + (c.front.length - 1) * PAIR + 6;
  const x = (v) => X0 + ((v - SPREAD_MIN) / (SPREAD_MAX - SPREAD_MIN)) * (X1 - X0);
  const ticks = [];
  for (let v = Math.ceil(SPREAD_MIN / 10) * 10; v <= SPREAD_MAX; v += 10) ticks.push(v);
  // Grade order, front row then back row, with a gap between grades so the two
  // faces of one grade read as a pair rather than as ten unrelated rows.
  const order = c.front.flatMap((row, i) => [
    SPREAD.find((r) => r.face === "front" && r.i === i),
    SPREAD.find((r) => r.face === "back" && r.i === i),
  ]);
  let y = TOP;
  const rows = order
    .map((r, k) => {
      if (k && r.face === "front") y += PAIR;
      const top = y;
      y += ROW;
      const mid = top + ROW / 2;
      const marks = r.groups
        .map(
          (g) =>
            `<circle cx="${x(g.v).toFixed(1)}" cy="${mid}" r="${(2.5 + g.n * 0.9).toFixed(
              1
            )}" class="sp-d"/>`
        )
        .join("");
      return `            ${
        r.face === "front"
          ? `<text class="sp-g" x="0" y="${mid + 3}">${esc(
              fits(r.grade, 9, GRADE_W, `grade label on the ${r.grade} row`)
            )}</text>`
          : ""
      }
            <text class="sp-f" x="${FACE_X}" y="${mid + 3}">${fits(
        r.face,
        9,
        X0 - FACE_X - 4,
        "face label"
      )}</text>
            <line class="sp-r" x1="${X0}" y1="${mid}" x2="${X1}" y2="${mid}"/>
            ${marks}
            <text class="sp-p" x="${W}" y="${mid + 3}" text-anchor="end">${r.published}/${CO.length}</text>`;
    })
    .join("\n");
  return `      <figure class="sp">
        ${/* aria-hidden, and here the rule bites hardest. Every one of these
              fifty cells is already in the two tables above, which are real
              <table> markup a screen reader can navigate by row and column, and
              the finding is in the figcaption. The first draft's aria-label
              enumerated all fifty as one unbroken sentence, which is the whole
              dataset read out a second time in the worst available order. */ ""}
        <svg viewBox="0 0 ${W} ${H}" class="sp-svg" aria-hidden="true" focusable="false">
          ${/* TWO HEADINGS ON ONE LINE, and the first draft's "off centre, worse to
                the right" ran 139 units from x=118 into the second at 252. Both
                are measured against the room they actually have now. */ ""}
          <text class="sp-h" x="${X0}" y="9">${fits(
            "worse to the right",
            9,
            W - X0 - monoW("publishing", 9) - 8,
            "axis heading"
          )}</text>
          <text class="sp-h" x="${W}" y="9" text-anchor="end">publishing</text>
          ${ticks
            .map(
              (v) =>
                `<line class="sp-t" x1="${x(v).toFixed(1)}" y1="16" x2="${x(v).toFixed(1)}" y2="${H - 4}"/>
          <text class="sp-a" x="${x(v).toFixed(1)}" y="22" text-anchor="middle">${v}/${100 - v}</text>`
            )
            .join("\n          ")}
${rows}
        </svg>
        <figcaption>The same ${esc(
          String((c.front.length + c.back.length) * CO.length)
        )} cells as the two tables, on one axis, so they can be seen at once. A bigger dot is more
          companies landing on the same number, and a back row sits to the right of the front row above
          it because the back standard is looser.${
            UNANIMOUS.length
              ? ` On the <b>front</b> they mostly agree: at ${esc(UNANIMOUS[0].grade)} all
          ${CO.length} publish ${UNANIMOUS[0].groups[0].v}/${100 - UNANIMOUS[0].groups[0].v}, the same
          number.`
              : ""
          }${
            ODD_CO
              ? ` At ${esc(String(ODD_OUT.length))} more grades ${CO.length - 1} agree and ${esc(
                  CO_NAME[ODD_CO.co]
                )} alone is ${ODD_CO.strict ? "one step stricter" : "one step looser"}.`
              : ""
          } The <b>back</b> is where they scatter, and the right-hand column is how many published a
          number at all: ${esc(String(BACK_MISSING))} of the ${esc(
            String(c.back.length * CO.length)
          )} back cells are not published by anybody.</figcaption>
      </figure>`;
};

// ============================================================================
// THE DEFECT DIAGRAMS, and this is the largest thing this page was missing.
//
// A visual QA pass measured the picture-free run through <main> and found
// 13,589px of it at 390, 72% of the page, running from the end of the spread
// figure to the bottom. The whole of it is a page ABOUT PHYSICAL DAMAGE TO A
// CARD with no picture of any damage in it: nine to eleven named defects, two
// sentences of prose each, illustrated by nothing. "A rounded indentation from
// the printing process" is a correct definition and it is not a thing you can
// hold your card next to.
//
// THE IDIOM IS /fake-cards.html's AND IT WAS COPIED RATHER THAN INVENTED.
// scripts/build-fakes.mjs ships nine of these for exactly this job and the
// shape of them is: an inline <svg role="img"> with a viewBox and a one
// SENTENCE aria-label, no binary asset, no request, all the ink set from
// CLASSES rather than from fill=/stroke= presentation attributes because a
// custom property in a presentation attribute is not reliable across browsers.
// Two things were changed on the way over and both are this page rather than
// that one:
//
//   - THE CARD IS PAINTED IN THE PAGE'S OWN GREEN, NOT IN CREAM. /fake-cards
//     draws a card as #F1EDD2 stock with #22384F ink on it, because half its
//     figures are about what ink does on paper. This page already draws a card,
//     twice, in centeringDiagram() and miniCard(), and it draws it as .ct-card:
//     fill var(--card), stroke var(--keyline). A third card in a different
//     colour on the same page would read as a different object. So these reuse
//     .ct-card and .ct-win outright, with the stroke weights turned down for
//     the smaller size exactly as .lad-svg turns down .ct-band's opacity.
//   - NO TEXT SITS ON A DRAWN SHAPE. /fake-cards needed .fk-cap-in because a
//     light label landed on its pale blue art window at 1.06:1, and the same
//     trap is one <circle> away on any figure like this. Every label here is
//     drawn on the FIGURE GROUND, which is the page: these figures are not in a
//     panel, so the ground is var(--page) #1F382B and nothing else.
//
// WHAT GROUND EVERY MARK IS ON, measured, because that is the one thing about a
// figure that cannot be checked by looking at the source:
//
//     on var(--page) #1F382B   --ink-2 #D4CCBC  7.92:1   every neutral label
//                              --ketchup-deep   6.23:1   every defect label
//     on var(--card) #2F4F39   --ink #E4DCCC    6.70:1   exposed cardboard
//                              --ketchup-deep   4.51:1   every defect mark
//                              --sky-deep       4.54:1   foil
//                              --keyline        3.02:1   the card's own outline
//
// so every label clears AA as small text and every mark clears the 3:1
// graphical gate with room. The card body itself is 1.38:1 on the page and is
// carried entirely by its keyline, which is what .ct-card has always done here.
//
// PINK IS THE DAMAGE AND THAT IS THE ACCENT RULE RATHER THAN A PREFERENCE.
// CLAUDE.md: teal is how you get around, pink is what the site is saying. A
// defect mark goes nowhere, so it is pink. Nothing in these figures is teal
// except foil, which is a description of a material and not an accent.
//
// DRAWN, NOT PHOTOGRAPHED, and that is the third time this file says it.
// centeringDiagram() and ladder() both argue it: a photograph of a real damaged
// card would be a claim about that card's grade, we hold no such photograph we
// are allowed to publish, and every photograph of a graded card on the internet
// belongs to somebody. A diagram makes no claim about any object.
//
// THE MARKS ARE EXAGGERATED AND EVERY FIGURE THAT EXAGGERATES SAYS SO, in its
// own note line and in its aria-label, the same way registrationDiagram() in
// build-fakes.mjs does. A real print line is a hair. Drawn at a hair it is one
// device pixel and it is not there at all.
//
// NOTHING HERE ANIMATES. They are static drawings, so prefers-reduced-motion
// has nothing to gate.
//
// TYPE SIZE IS THE CONSTRAINT THAT SET THE VIEWBOX, not the other way round.
// The figure box is 240px on a wide screen and up to 260px on a phone. At a
// 180 unit viewBox that is 1.33px a unit, so an 8 unit label renders 10.7px and
// a 7 unit note renders 9.3px, which is the floor this file already records
// beside .sp-svg. DO NOT WIDEN THE VIEWBOX WITHOUT RE-CHECKING THAT: at 240
// units the same 8 unit label renders 8px and the figures quietly stop being
// readable on the device most of the traffic is on. SVG text neither wraps nor
// clips, so every line below was counted: Space Mono advances 0.6em, so at 8
// units a character is 4.8 units and 37 characters is the widest line that fits
// the 180 unit box. Re-count if you reword one.
// ----------------------------------------------------------------------------

// A card, at the size these figures draw one. rx is 3 rather than .ct-card's 9
// because the corner radius is a real proportion of a real card and these cards
// are a third of the size the big diagram's is.
const gdCard = (x, y, w, h) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="ct-card"/>`;

// The art window, the same .ct-win the centering diagram fills. Inset by a
// tenth of the width, which is roughly where a Pokemon card's border ends.
const gdWin = (x, y, w, h) =>
  `<rect x="${x + w * 0.1}" y="${y + h * 0.09}" width="${w * 0.8}" height="${h * 0.46}" rx="2" class="ct-win"/>`;

// The text box under the art, drawn as two faint rules. It is here so that the
// print line figure has something to cross: the whole tell is that a plate line
// ignores what is printed under it.
const gdText = (x, y, w, h) => {
  const ty = y + h * 0.62;
  return `<g class="gd-hair"><path d="M${x + w * 0.12} ${ty} H${x + w * 0.88}"/><path d="M${x + w * 0.12} ${
    ty + h * 0.08
  } H${x + w * 0.7}"/><path d="M${x + w * 0.12} ${ty + h * 0.16} H${x + w * 0.82}"/></g>`;
};

// Deterministic noise, the same LCG build-fakes.mjs uses for its rosette. A
// Math.random() here would give a different page on every build and make the
// built tree differ from itself, which check-tree-drift.mjs would report as a
// change nobody made.
const gdRnd = (seed) => {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
};

const gdFig = (id, vb, label, body) =>
  `<figure class="gd-fig">
            <svg viewBox="0 0 180 ${vb}" class="gd-svg" role="img" aria-label="${esc(label)}">${body}
            </svg>
          </figure>`;

/* 1. CHIPPING ON THE EDGES, which the hobby calls whitening.
   Two whole cards, clean beside chipped, because chipping is a thing you find
   by comparing an edge to an edge you trust. The chips are var(--ink), which is
   the site's off-white and is also literally the subject: PSA's own definition,
   quoted in the headline above this list, says the contrast is between the
   coloured border and the lighter cardboard underneath the thin layer of ink.
   They are clipped to the card outline so a chip cannot float off the edge into
   the page, which is what happened on the first build of this. */
function gdChipping() {
  // ONE <path> OF 44 CHIPS, NOT 44 <rect>s, AND EVERY NUMBER IS AN INTEGER.
  // This was the heaviest figure on the page by a factor of three, 4,645 bytes
  // raw against a 1,300 byte median, because it emitted sixty `<rect x="12.4"
  // y="83.7" width="2.1" height="3.4" rx="0.5"/>`. The picture is identical as
  // a single path of `Mx yhVvHZ` subpaths and the tenths were never visible: at
  // 240px a tenth of a viewBox unit is a seventh of a device pixel. Count is 44
  // rather than 60 for the same reason, and it still reads as a wrecked border;
  // check the screenshot rather than the number if you change it.
  const chips = (x, y, w, h, seed) => {
    const r = gdRnd(seed);
    let d = "";
    const put = (cx, cy, cw, ch) =>
      (d += `M${Math.round(cx)} ${Math.round(cy)}h${Math.round(cw)}v${Math.round(ch)}h-${Math.round(cw)}Z`);
    for (let i = 0; i < 9; i++) {
      put(x + 1 + r() * (w - 4), y, 2 + r() * 3, 1 + r() * 2);
      put(x + 1 + r() * (w - 4), y + h - (1 + r() * 2), 2 + r() * 3, 1 + r() * 2);
    }
    for (let i = 0; i < 11; i++) {
      put(x, y + 2 + r() * (h - 6), 1 + r() * 2, 2 + r() * 3);
      put(x + w - (1 + r() * 2), y + 2 + r() * (h - 6), 1 + r() * 2, 2 + r() * 3);
    }
    // The corners take the worst of it, which is where a grader looks first.
    for (const [cx, cy] of [[x, y], [x + w - 4, y], [x, y + h - 4], [x + w - 4, y + h - 4]]) put(cx, cy, 4, 4);
    return `<path d="${d}"/>`;
  };
  const B = { x: 100, y: 20, w: 62, h: 84 };
  return gdFig(
    "chip",
    130,
    "Two cards side by side. The left one has a clean unbroken border. The right one has ragged white flecks of bare cardboard all along its edges and at all four corners, worst at the corners.",
    `
              <text x="47" y="12" class="gd-l">CLEAN</text>
              <text x="131" y="12" class="gd-bad">CHIPPED</text>
              ${gdCard(16, 20, 62, 84)}${gdWin(16, 20, 62, 84)}
              ${gdCard(B.x, B.y, B.w, B.h)}${gdWin(B.x, B.y, B.w, B.h)}
              <clipPath id="gdChip"><rect x="${B.x}" y="${B.y}" width="${B.w}" height="${B.h}" rx="3"/></clipPath>
              <g class="gd-white" clip-path="url(#gdChip)">${chips(B.x, B.y, B.w, B.h, 17)}</g>
              <text x="90" y="120" class="gd-n">white is the cardboard under the ink</text>`
  );
}

/* 2. PRINT LINE.
   One card, and the whole diagnosis is a property of the LINE rather than of
   the card: it is dead straight, it runs off both edges, and it does not care
   what is printed underneath it. That last part is why the card is drawn with
   an art window and a text box at all. The bottom note is the test a reader can
   actually apply, and it is the contrast with the scratch three figures down:
   a scratch starts and stops, a plate line cannot. */
function gdPrintLine() {
  return gdFig(
    "pl",
    124,
    "A card with one perfectly straight line running from the top edge to the bottom edge, passing through the artwork, the border and the text box without stopping or bending.",
    `
              ${gdCard(14, 14, 66, 92)}${gdWin(14, 14, 66, 92)}${gdText(14, 14, 66, 92)}
              <path d="M45 14 V106" class="gd-mark"/>
              <path d="M45 58 H90" class="gd-lead"/>
              <text x="94" y="34" class="gd-la">dead straight</text>
              <text x="94" y="45" class="gd-la">and off both</text>
              <text x="94" y="56" class="gd-la">edges</text>
              <text x="94" y="74" class="gd-la">it crosses the</text>
              <text x="94" y="85" class="gd-la">art, the border</text>
              <text x="94" y="96" class="gd-la">and the text</text>
              <text x="90" y="118" class="gd-n">a scratch stops somewhere. this cannot</text>`
  );
}

/* 3. METALLIC PRINT LINES, the flaw only foil gets.
   THE DIAGRAM IS THE TEST, not the flaw. Beckett and SGC both publish a
   tolerance for these at every level, which is the finding in the prose; what
   the prose cannot do is tell you how to see one, and the answer is that you
   cannot, flat on, under a ceiling light. You tilt it. So the figure is the same
   card twice, flat and tilted, and the lines are absent from the first. Drawing
   both states is the only way to show a change of angle without animating
   anything. */
function gdMetallic() {
  const foil = (x, y, w, h, lit) => {
    let o = "";
    for (let i = 1; i < 7; i++) {
      const lx = x + (w * i) / 7;
      o += `<path d="M${lx.toFixed(1)} ${y} V${y + h}"${lit ? "" : ' opacity=".08"'}/>`;
    }
    return `<g class="gd-foil">${o}</g>`;
  };
  const A = { x: 16, y: 22, w: 58, h: 78 };
  return gdFig(
    "met",
    126,
    "The same foil card twice. Seen flat on, the foil panel looks clean. Seen tilted to a light, a set of fine parallel lines appears across the foil.",
    `
              <text x="45" y="13" class="gd-l">FLAT ON</text>
              <text x="134" y="13" class="gd-bad">TILTED</text>
              ${gdCard(A.x, A.y, A.w, A.h)}
              <rect x="${A.x + 6}" y="${A.y + 7}" width="${A.w - 12}" height="${A.h * 0.5}" rx="2" class="ct-win"/>
              ${/* THE FLAT PANEL'S LINES ARE AT .08 AND WERE AT .14, which was
                    visible enough on a screenshot to undercut the whole figure:
                    the message is that you cannot see these flat on, so a panel
                    that shows them faintly is arguing against its own label.
                    They are not deleted, because the lines ARE on the card
                    either way and drawing nothing would say they appear when
                    you tilt it, which is not what happens. */ ""}
              ${foil(A.x + 6, A.y + 7, A.w - 12, A.h * 0.5, false)}
              <g transform="translate(112,0) skewX(-9)">
                ${gdCard(0, 22, 58, 78)}
                <rect x="6" y="29" width="46" height="39" rx="2" class="ct-win"/>
                ${foil(6, 29, 46, 39, true)}
              </g>
              <text x="90" y="120" class="gd-n">exaggerated. a real one is a hair</text>`
  );
}

/* 4. ROLLER MARK.
   "A rounded indentation from the printing process" is TAG's whole definition
   and it is a sentence about a SHAPE, which is the one thing a drawing is for.
   The figure is a profile, because the difference between this and the two
   defects it gets confused with is entirely in the profile: a roller mark is
   broad, shallow and rounded, a crease is a sharp fold, a dent is local. The
   card beside it is what the same thing looks like from the front, which is how
   the reader will actually meet it. */
function gdRoller() {
  return gdFig(
    "rm",
    118,
    "A card with a broad shallow oval depression across it, and beside it the same card seen edge on, showing a wide rounded dip in the surface with no break in it.",
    `
              <text x="42" y="12" class="gd-l">FROM THE FRONT</text>
              <text x="132" y="12" class="gd-l">EDGE ON</text>
              ${gdCard(12, 18, 58, 78)}${gdWin(12, 18, 58, 78)}
              <ellipse cx="41" cy="60" rx="21" ry="9" class="gd-mark"/>
              <ellipse cx="41" cy="60" rx="13" ry="5" class="gd-mark" opacity=".75"/>
              ${/* THE PROFILE IS A CLOSED BAND AND THE FIRST BUILD OF IT WAS NOT.
                    It was written as one curved top edge closed back along a
                    STRAIGHT bottom, so the dip crossed the bottom line and the
                    shape self-intersected: it rendered as a flat bar with a
                    wave passing through it, which is a picture of nothing.
                    Both surfaces follow the dip now, which is also the true
                    thing, because a roller compresses the card rather than
                    scooping the front off it. The dashed rule is the flat the
                    dip is measured against; without it the dip reads as a bend
                    in the whole card. */ ""}
              <path d="M88 42 H176" class="gd-ref"/>
              <path d="M88 46 C108 46 114 58 132 58 C150 58 156 46 176 46 L176 53 C156 53 150 65 132 65 C114 65 108 53 88 53 Z" class="ct-card"/>
              <path d="M88 46 C108 46 114 58 132 58 C150 58 156 46 176 46" class="gd-mark"/>
              <text x="132" y="82" class="gd-n">wide, rounded,</text>
              <text x="132" y="92" class="gd-n">nothing broken</text>
              <text x="90" y="112" class="gd-n">a dish, not a fold and not a pit</text>`
  );
}

/* 5. ROLLER DAMAGE FROM THE PACK, and this is the most useful figure of the
   set because it is the only one that answers a question rather than defining a
   word. CGC's tell, which is in the prose above it: packaging roller damage
   shows on BOTH faces, a pinched layer from manufacturing shows only on the
   holo side. So the figure is four card faces in two rows, and reading DOWN a
   column is the test.
   THE TWO INDENTATIONS ARE SYMMETRIC ABOUT THE CARD'S CENTRE LINE ON PURPOSE.
   A mark that is off centre appears mirrored when you turn the card over, which
   is true and is a second thing to explain in a figure whose entire message is
   "turn the card over". Symmetric, the mirroring is a no-op and the picture is
   honest either way. The crease figure below does mirror, and says so, because
   there the mirroring is the interesting part. */
function gdPackRoller() {
  // A TROUGH RATHER THAN A LINE, and the difference matters two figures after
  // the print line: drawn as a single crisp stroke these were the same mark as
  // a plate line, on a page whose whole job is telling those apart. A wide soft
  // stroke under a narrow solid one reads as a channel pressed into the card.
  const bars = (x, y, w, h) => {
    const one = (cx) =>
      `<path d="M${cx} ${y + 5} V${y + h - 5}" stroke-width="4" opacity=".3"/><path d="M${cx} ${y + 5} V${
        y + h - 5
      }" stroke-width="1.2"/>`;
    return `<g class="gd-mark">${one(x + w * 0.3)}${one(x + w * 0.7)}</g>`;
  };
  return gdFig(
    "pr",
    212,
    "Four card faces in two rows. In the top row both the front and the back carry the same pair of vertical indentations, which is roller damage from the pack. In the bottom row only the front carries them and the back is clean, which is a pinch from manufacturing.",
    `
              <text x="46" y="12" class="gd-l">FRONT</text>
              <text x="134" y="12" class="gd-l">BACK</text>
              ${gdCard(18, 18, 56, 76)}${gdWin(18, 18, 56, 76)}${bars(18, 18, 56, 76)}
              ${gdCard(106, 18, 56, 76)}${bars(106, 18, 56, 76)}
              <text x="90" y="108" class="gd-bad">BOTH FACES: FROM THE PACK</text>
              ${gdCard(18, 120, 56, 76)}${gdWin(18, 120, 56, 76)}${bars(18, 120, 56, 76)}
              ${gdCard(106, 120, 56, 76)}
              <text x="90" y="210" class="gd-l">FRONT ONLY: FROM THE PRESS</text>`
  );
}

/* 6. PRINT SNOW, PRINT DOTS AND FISH EYES.
   Three named things in one sentence of prose, and a reader holding a card with
   one of them cannot tell from that sentence which of the three they have. So
   all three are drawn on one card and labelled, which is the only figure here
   whose job is to SEPARATE things rather than to define one. */
function gdPrintSnow() {
  // Same trim as the chipping figure: 26 specks rather than 34, one decimal on
  // the radius because a speck IS a fraction of a unit, integers on the
  // positions because a tenth of a unit is a seventh of a device pixel here.
  const r = gdRnd(29);
  let snow = "";
  for (let i = 0; i < 26; i++) {
    snow += `<circle cx="${Math.round(20 + r() * 26)}" cy="${Math.round(24 + r() * 20)}" r="${(
      0.6 + r() * 0.8
    ).toFixed(1)}"/>`;
  }
  return gdFig(
    "ps",
    124,
    "One card carrying all three print marks: a haze of tiny white specks near the top, three separate round white dots below it, and two circular spots with a pale ring and a darker center.",
    `
              ${gdCard(10, 14, 62, 88)}${gdWin(10, 14, 62, 88)}
              <g class="gd-white">${snow}</g>
              <g class="gd-white"><circle cx="26" cy="60" r="2.2"/><circle cx="40" cy="68" r="2"/><circle cx="52" cy="58" r="1.8"/></g>
              ${/* A FISH EYE IS A RING WITH A DISCOLORED MIDDLE and the first
                    build drew only the ring, so the label named a thing that
                    was not in the picture. The middle is a wash of the same
                    off-white the snow and the dots use, at .4, which is what
                    "discolored" looks like against a printed ground. */ ""}
              <g class="gd-white" opacity=".6"><circle cx="28" cy="84" r="3.4"/><circle cx="46" cy="90" r="2.7"/></g>
              <g class="gd-mark"><circle cx="28" cy="84" r="4.4"/><circle cx="46" cy="90" r="3.6"/></g>
              <path d="M46 30 H84" class="gd-lead"/>
              <path d="M56 62 H84" class="gd-lead"/>
              <path d="M52 86 H84" class="gd-lead"/>
              <text x="87" y="27" class="gd-la">print snow</text>
              <text x="87" y="37" class="gd-lb">a haze of specks</text>
              <text x="87" y="59" class="gd-la">print dots</text>
              <text x="87" y="69" class="gd-lb">separate and round</text>
              <text x="87" y="83" class="gd-la">fish eyes</text>
              <text x="87" y="93" class="gd-lb">a ring with a</text>
              <text x="87" y="102" class="gd-lb">discolored middle</text>
              <text x="90" y="118" class="gd-n">PSA files all three as a print defect</text>`
  );
}

/* 7. WRINKLE VERSUS CREASE, and the prose is already making the right
   distinction: a wrinkle shows on one side, a crease is usually visible on
   both, and PSA says a crease can drop a card up to five grades. That is a
   FRONT AND BACK test, so the figure is a column per defect and a row per face,
   and reading down a column is the whole thing.
   THE CREASE IS MIRRORED ON THE BACK because that is what happens when you turn
   a card over, and a figure that drew it in the same place would be teaching a
   reader to reject a real crease as "the wrong side". The note line says so. */
function gdWrinkle() {
  return gdFig(
    "wc",
    180,
    "Two columns, each showing the front and then the back of one card. The wrinkle column has soft ripples on the front and a clean back. The crease column has one hard line on the front and the same line, mirrored, on the back.",
    `
              <text x="44" y="12" class="gd-bad">WRINKLE</text>
              <text x="136" y="12" class="gd-bad">CREASE</text>
              ${gdCard(22, 18, 44, 60)}
              <g class="gd-soft"><path d="M28 40 Q38 32 44 40 Q50 48 60 40"/><path d="M28 47 Q38 39 44 47 Q50 55 60 47"/><path d="M28 54 Q38 46 44 54 Q50 62 60 54"/></g>
              ${gdCard(22, 96, 44, 60)}
              ${gdCard(114, 18, 44, 60)}
              <path d="M120 28 L152 68" class="gd-mark"/>
              ${gdCard(114, 96, 44, 60)}
              <path d="M152 106 L120 146" class="gd-mark"/>
              <text x="44" y="88" class="gd-n">front</text>
              <text x="136" y="88" class="gd-n">front</text>
              <text x="44" y="166" class="gd-n">back: clean</text>
              <text x="136" y="166" class="gd-n">back: there too</text>
              <text x="90" y="178" class="gd-n">on the back it appears mirrored</text>`
  );
}

/* 8. NOTCHING.
   PSA's definition names the rubber band, so the band is drawn: the notches are
   where it sat, which is the thing that makes them findable. The card is drawn
   with the bites cut OUT of its outline rather than painted on top of it,
   because that is the difference between this and the first figure in the list
   and the note line says it in six words. Chipping takes ink off an edge that
   is still there. A notch takes the edge. */
function gdNotching() {
  // The bites are page-coloured arcs sitting on the card's own edge, so the
  // outline still reads as the outline. The figure ground is var(--page) and
  // nothing else, which is why this works and why it would not work inside a
  // panel: see the note at the top of this block.
  const biteL = (x, y) => `<path d="M${x} ${y} A4.5 4.5 0 0 1 ${x} ${y + 9} Z" class="gd-bite"/>`;
  const biteR = (x, y) => `<path d="M${x} ${y} A4.5 4.5 0 0 0 ${x} ${y + 9} Z" class="gd-bite"/>`;
  // THE FIRST BUILD OF THIS FIGURE PAINTED OUT OF ITS OWN BOX, TWICE, and it is
  // the trap the note at the top of this block already names: SVG text neither
  // wraps nor clips, so a label that outgrows its slot paints straight over the
  // next one and nothing errors. "A BAND SAT HERE" and "THE EDGE, CLOSE UP" ran
  // into each other at the top, and the four-line annotation ran off the right
  // edge of the 180 unit box entirely. Both were only visible on a screenshot.
  // Every line here is counted at 0.6em: at 8 units a character is 4.8 units, at
  // 7 units it is 4.2, and the widest line below is 38 characters at 7 units,
  // which is 160 of the 180.
  return gdFig(
    "nt",
    140,
    "A card with a rubber band lying across it and a bite taken out of the card edge at each of the two places the band crosses it. Beside it the edge is magnified, showing the notches as missing edge rather than as white marks on an edge that is still there.",
    `
              <text x="43" y="12" class="gd-l">WHERE IT SAT</text>
              <text x="115" y="12" class="gd-l">CLOSE UP</text>
              ${gdCard(12, 18, 62, 88)}${gdWin(12, 18, 62, 88)}
              <g class="gd-band"><path d="M2 48 H84"/><path d="M2 60 H84"/></g>
              ${biteL(12, 44)}${biteL(12, 56)}${biteR(74, 44)}${biteR(74, 56)}
              <rect x="104" y="22" width="22" height="80" rx="1" class="ct-card"/>
              <path d="M104 38 A8 8 0 0 1 104 54 Z" class="gd-bite"/>
              <path d="M104 62 A8 8 0 0 1 104 78 Z" class="gd-bite"/>
              <text x="132" y="50" class="gd-la">the edge</text>
              <text x="132" y="60" class="gd-la">itself is</text>
              <text x="132" y="70" class="gd-la">gone</text>
              <text x="90" y="120" class="gd-n">a band leaves them where it crossed</text>
              <text x="90" y="132" class="gd-n">chipping takes ink. a notch takes edge</text>`
  );
}

/* 9. PIT, DENT AND SCRATCH.
   TAG defines all three in one sentence and they are three different shapes, so
   the figure separates them the way the print marks figure does. The note is
   the reusable half: two of the three are DEPTH, which you find by tilting the
   card until the light rakes across it, and one is a LINE, which you find by
   looking straight at it. */
function gdPitDent() {
  return gdFig(
    "pd",
    126,
    "One card carrying all three surface marks: a small round well near the top, a soft oval depression in the middle, and a straight line and a curved line near the bottom.",
    `
              ${gdCard(10, 14, 62, 88)}${gdWin(10, 14, 62, 88)}
              ${/* THE PIT'S WELL WAS A DARK DISC AND IT MEASURED 1.60:1 ON THE
                    CARD, which is to say the label read "a round well" beside a
                    picture of a ring. A dark fill cannot work here: the card is
                    already dark, which is a thing /fake-cards.html never has to
                    deal with because its cards are cream. Two concentric rings
                    at full strength read as a crater and measure 4.51:1. */ ""}
              <circle cx="26" cy="32" r="3.4" class="gd-mark"/><circle cx="26" cy="32" r="1.5" class="gd-mark" stroke-width="1"/>
              <ellipse cx="42" cy="60" rx="12" ry="7" class="gd-mark"/>
              <path d="M34 60 A12 7 0 0 0 50 64" class="gd-mark" opacity=".75"/>
              ${/* THE TWO SCRATCHES CROSSED IN THE FIRST BUILD and read as one
                    X-shaped mark rather than as "straight or curved", which is
                    what the label beside them claims. Separated. */ ""}
              <g class="gd-mark"><path d="M18 78 L44 88"/><path d="M22 98 Q40 90 60 96"/></g>
              <path d="M30 32 H84" class="gd-lead"/>
              <path d="M54 60 H84" class="gd-lead"/>
              <path d="M60 92 H84" class="gd-lead"/>
              <text x="87" y="29" class="gd-la">pit</text>
              <text x="87" y="39" class="gd-lb">a round well</text>
              <text x="87" y="57" class="gd-la">dent</text>
              <text x="87" y="67" class="gd-lb">a soft depression</text>
              <text x="87" y="89" class="gd-la">scratch</text>
              <text x="87" y="99" class="gd-lb">straight or curved</text>
              <text x="90" y="120" class="gd-n">two are depth. one is a line</text>`
  );
}

/* 10. DIAMOND CUT.
   The only defect on the list that is a property of the card's OUTLINE rather
   than of anything printed on it.

   THE FIRST BUILD OF THIS FIGURE FAILED THE ONLY TEST THAT MATTERS and it was
   thrown away rather than nudged. It drew a dashed true rectangle with the card
   laid over it out of square, and on the screenshot the card covered the
   reference almost completely, so what survived was a picture of a card lying
   at an ANGLE. A rotated card is not a diamond cut. A diamond cut is a card
   whose corners are not right angles, which no amount of rotating produces, and
   a reader who took that picture to their own card would have gone looking for
   the wrong thing.

   WHAT REPLACED IT IS THE TEST RATHER THAN THE DEFINITION. You find this at
   home by laying a straight edge, usually another card, along one side. Square,
   and it lies flat against it. Diamond cut, and a wedge of light opens up. So
   the figure is two cards against the same dashed straight edge, and the wedge
   is drawn. THE SKEW IS EXAGGERATED at roughly four degrees against the one
   that actually gets a card knocked down, which the aria-label says, because at
   one degree the wedge is a device pixel. */
function gdDiamond() {
  return gdFig(
    "dc",
    134,
    "Two cards each laid against a dashed straight edge. The square one sits flush along the whole length of it. The diamond cut one touches at the bottom and leans away at the top, leaving a wedge of daylight between the card and the straight edge. The lean is exaggerated to be visible.",
    `
              ${/* THE STRAIGHT EDGE IS DRAWN LAST AND ON THE RIGHT, and both
                    halves of that were fixed after looking at a screenshot. On
                    the left of the card and drawn first it was painted over by
                    the card on the square side and by the wedge on the cut
                    side, so the one line the note calls out by name was the one
                    thing not visible in the figure. Drawn last it sits on top
                    of both, which is also the true picture: the straight edge
                    is a second card laid ON the first. */ ""}
              <text x="44" y="13" class="gd-l">SQUARE</text>
              <text x="137" y="13" class="gd-bad">DIAMOND CUT</text>
              ${gdCard(14, 22, 60, 84)}${gdWin(14, 22, 60, 84)}
              <path d="M104 22 L164 22 L170 106 L110 106 Z" class="ct-card"/>
              <path d="M110 30 L158 30 L161 70 L113 70 Z" class="ct-win"/>
              <path d="M164 22 L170 22 L170 106 Z" class="gd-gap"/>
              <path d="M164 22 L170 106" class="gd-mark"/>
              <path d="M74 18 V110" class="gd-ref"/>
              <path d="M170 18 V110" class="gd-ref"/>
              <text x="90" y="126" class="gd-n">dashed = another card's straight edge</text>`
  );
}

/* 11. HOLO BLEED.
   The only entry on the list where the two companies named disagree about
   whether the thing exists, which is the prose's finding and is not drawable.
   What IS drawable is the thing itself, and it is a containment question: foil
   where the design puts it, against foil in the border and the text box where
   the design does not. Teal is the foil here and that is a description of a
   material rather than an accent; nothing in these figures routes anywhere. */
function gdHoloBleed() {
  // BLEED IS A CONTAINMENT FAULT AND THE FIRST BUILD DREW A FLOOD. The whole of
  // the second card was hatched, which is a picture of a FULL ART card, a thing
  // Pokemon prints on purpose and which nobody should send in worried. What
  // makes it bleed is that the foil is somewhere the design does not put it, in
  // patches, escaping past the edge of the window. So the second card's hatch
  // is clipped to the window PLUS one irregular spill over the border and the
  // text box, and the first card's is clipped to the window and nothing else.
  // ONE <pattern>, NOT FIFTY-FOUR <path>s, AND THE FIRST BUILD WAS THE SECOND.
  // Foil was drawn as a loop emitting an individual diagonal every 5 units into
  // each of the two cards, which is 54 elements and made this the second
  // heaviest figure on the page at 3,246 bytes raw. A pattern is the same
  // picture in one definition and two fills.
  //
  // IT ALSO FIXED AN OVERFLOW THAT WAS NOT VISIBLE AND WAS STILL REAL. A
  // clip-path hides paint; it does not shrink geometry, and
  // getBoundingClientRect reports geometry. The loop's last strokes ran up to
  // 90px past the right edge of their own <svg>, so an overflow sweep at 320
  // reported TEN elements painting off the page on a page whose scrollWidth was
  // exactly 320 and where nothing was visible outside anything. A pattern fill
  // has the bounding box of the shape it fills and cannot do that at all.
  const hatch = (d) => `<path d="${d}" fill="url(#gdFoil)"/>`;
  return gdFig(
    "hb",
    126,
    "Two cards. On the first the foil is contained inside the artwork window, which is where the design puts it. On the second the same foil escapes past the window in a ragged patch, out over the border and across the text box, where the design puts none.",
    `
              ${/* THE TILE'S LINE IS AT 2.5 AND NOT AT 0, and the class is
                    .gd-foil rather than a stroke= attribute. A stroke at x=0 is
                    half outside its own tile and patterns do not wrap paint, so
                    every diagonal renders at half width. And a custom property
                    in a presentation attribute is not reliable across browsers,
                    which is build-fakes.mjs's rule and is why every mark in
                    these figures takes its paint from a rule. */ ""}
              <defs><pattern id="gdFoil" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <path d="M2.5 0 V5" class="gd-foil" opacity=".85"/>
              </pattern></defs>
              <text x="45" y="12" class="gd-l">AS PRINTED</text>
              <text x="134" y="12" class="gd-bad">HOLO BLEED</text>
              ${gdCard(16, 20, 58, 82)}${gdWin(16, 20, 58, 82)}${gdText(16, 20, 58, 82)}
              ${hatch("M21.8 27.4 H68.2 V65.1 H21.8 Z")}
              ${gdCard(106, 20, 58, 82)}${gdWin(106, 20, 58, 82)}${gdText(106, 20, 58, 82)}
              ${/* TWO <path>s AND NOT TWO SUBPATHS OF ONE, and the difference
                    was a hole in the middle of the figure. The window rect and
                    the spill blob overlap, they wind in opposite directions,
                    and under the default nonzero fill rule the overlap CANCELS:
                    the built page showed foil above the window and below it and
                    bare card exactly where the two met, which is the one place
                    the foil has to be. Separate elements each fill on their
                    own. It costs about thirty bytes. */ ""}
              ${hatch("M111.8 27.4 H158.2 V65.1 H111.8 Z")}
              ${hatch("M110 44 Q107 66 120 78 Q142 90 154 74 Q163 60 156 48 Q140 40 128 46 Z")}
              <text x="90" y="120" class="gd-n">PSA notes it. CGC says it is not a thing</text>`
  );
}

// THE MAP IS KEYED ON THE DEFECT'S OWN NAME AND THE BUILD FAILS IF A KEY STOPS
// MATCHING. That is the discipline centeringDiagram() and the subgrade figure
// already hold this file to: a picture that has drifted from the sentence it
// illustrates is worse than no picture, and an index would go quietly wrong the
// first time somebody reorders data/grade-check.json. An item with NO diagram
// is allowed and is reported on the build line; a diagram with no item throws.
const GD = {
  "Chipping on the edges": gdChipping,
  "Print line": gdPrintLine,
  "Metallic print lines, and why foil is its own problem": gdMetallic,
  "Roller mark": gdRoller,
  "Roller damage from the pack": gdPackRoller,
  "Print snow, print dots and fish eyes": gdPrintSnow,
  "Wrinkle versus crease": gdWrinkle,
  Notching: gdNotching,
  "Pit, dent and scratch": gdPitDent,
  "Diamond cut": gdDiamond,
  "Holo bleed, where the company you pick changes the answer": gdHoloBleed,
};
{
  const names = new Set(d.defects.items.map((i) => i.name));
  const orphans = Object.keys(GD).filter((k) => !names.has(k));
  if (orphans.length) {
    throw new Error(
      `build-grade-check: ${orphans.length} defect diagram(s) no longer match any entry in ` +
        `data/grade-check.json defects.items: ${JSON.stringify(orphans)}. The drawing and the two ` +
        `sentences beside it are one thing. Rename the key AND check the picture still illustrates ` +
        `what the copy now says; do not ship a diagram pointing at a defect the page stopped naming.`
    );
  }
  const undrawn = d.defects.items.filter((i) => !GD[i.name]).map((i) => i.name);
  if (undrawn.length) console.log(`  build-grade-check: ${undrawn.length} defect(s) with no diagram: ${undrawn.join("; ")}`);
}

const desc =
  "Will your Pokemon card grade a 10? Centering tolerances from PSA, CGC, Beckett, SGC and TAG, the flaws that cost grades, and how to check a card at home.";

// ---------------------------------------------------------------------------
// STYLE_GD: WHY THE DEFECT DIAGRAM RULES IN THE BLOCK BELOW CARRY NO COMMENTS.
//
// This is the note that used to live inside the <style> block, and moving it
// here is not tidying. The comment forty lines above `ladder()` says it: a
// page-level <style> ships to the browser VERBATIM, nothing strips comments out
// of it the way build-css.mjs strips them out of ui.css, so prose written in
// there is render-blocking page weight on the one page that carries it. That
// note even records the price the last time somebody did it, +634 bytes gzipped
// on this page, and this pass wrote 4KB of CSS prose anyway before measuring.
// Measured on the built page: moving these words out of the <style> and into
// here took 3,984 bytes off the raw HTML. Write the reasoning in JS.
//
// THE RULES THEMSELVES ARE IN THE BUILDER AND NOT IN ui.css, deliberately.
// ui.css is one render-blocking request on 1,486 pages and exactly one page on
// this site draws a chipped edge, so 26 declarations there would be paid for by
// 1,485 pages that will never use one.
//
// LAYOUT. .gd-row is figure beside prose, stacking to figure-first under 700px,
// which is .ct-wrap's rule on this same page and for the reason written there:
// on a phone "above" is the only version of "beside" there is. 240px is not a
// taste decision, it is what sets the rendered type size; the viewBox note above
// gdCard() has the arithmetic and you have to re-read it before changing this.
// Every <svg> carries a viewBox and its box is pinned, so the height comes off
// the intrinsic ratio before paint: measured CLS is 0.000 with 0 layout-shift
// entries at 390 and at 1440, and this must not be the thing that changes that.
//
// THE CARD IS .ct-card AND .ct-win, the same two the centering diagram and the
// ladder draw, so a card is ONE object on this page rather than three. Only the
// stroke weights are overridden: at 4 and 2 in a 180 unit box they render 5.3px
// and 2.7px, which is a picture frame round a postage stamp. Same move and same
// reason as .lad-svg turning .ct-band's opacity up for the small size.
//
// PINK IS THE DAMAGE, which is CLAUDE.md's accent rule and not a preference: a
// defect mark goes nowhere, and pink is every mark that goes nowhere.
// --ketchup-deep rather than --ketchup, because on var(--card) the two measure
// 4.51:1 and 3.45:1 and the second only just clears the graphical gate. --ink is
// the exposed cardboard, which is the subject rather than a colour choice.
// --sky-deep is foil, a material rather than an accent.
//
// EVERY MARK CLEARS THE 3:1 GRAPHICAL GATE ON THE GROUND IT IS ACTUALLY PAINTED
// ON, MEASURED, WITH ONE DELIBERATE EXCEPTION. Three did not, and all three were
// found by measuring rather than by reading, because an INLINE opacity attribute
// is invisible to a pass that reads class names: the roller mark's inner ellipse
// and the dent's crescent sat at .7, which is 2.99:1 on var(--card) and misses
// by one hundredth, and the fish eye's discolored middle sat at .4, which is
// 2.41:1. They are .75, .75 and .6 now: 3.21:1, 3.21:1 and 3.53:1. THE EXCEPTION
// IS THE PACK ROLLER'S HALO, the 4-unit stroke at .3 that makes its two
// indentations read as troughs pressed into the card rather than as lines drawn
// on it. It is 1.61:1 and it stays, because the mark it sits behind is a
// 1.2-unit line at 4.51:1 and the gate asks for the parts needed to UNDERSTAND
// the graphic. Raising it would swallow the line it exists to sit behind.
//
// .gd-gap IS .8 AND NOT .7 FOR A REASON ONLY A MEASUREMENT SHOWS. The wedge in
// the diamond cut figure is painted on var(--page), where .7 is 3.82:1 and
// clears the gate. But it lies inside the BOUNDING BOX of a card whose real
// outline is a leaning quadrilateral, so any check asking "which card is this
// inside" resolves it against var(--card), where .7 is 2.99:1. At .8 it is
// 4.51:1 on the page and 3.26:1 on the card, so the answer is the same whichever
// ground you decide it is on and there is nothing left to argue about.
//
// .gd-bite IS THE PAGE COLOUR because a notch is the EDGE being gone, so it is
// cut out of the card in the ground's own colour rather than painted on top of
// it. That works because these figures sit on the page and nowhere else: dropped
// into a .gc-key panel that fill would be a light hole in a dark box.
// ---------------------------------------------------------------------------
const style = `
.gc-lede{max-width:46em}
.gc-sec{margin-top:var(--s6)}
.gc-sec > p.gc-in{color:var(--ink-2);max-width:44em;line-height:1.55;margin-bottom:var(--s4)}
/* The four column tables are 640px wide inside a 360px box on a phone, so 280px
   of every one of them is off screen. Measured at 390x844: .gc-tw clientWidth
   360, scrollWidth 640. At 320x568 it is 350px hidden. The page said nothing
   about it: the right edge was a hard cut at the container border and even the
   caption was truncated mid-word ("NOTE HOW MUCH WIDER THE TOLERA").

   This is ui.css's "there is more to the right" trick, the same four layers it
   already gives .cc-scroll, .xp-scroll and .luck-scroll. The two COVER layers
   are background-attachment:local so they ride with the content; the two SHADOW
   layers are scroll so they stay pinned to the box. At scroll 0 the cover hides
   the shadow, and scrolling slides it away to reveal one. It switches itself off
   when the table fits, so nothing shows at 1440.

   background-COLOR, not the background shorthand: the shorthand resets
   background-image and would silently wipe all four layers. That is the exact
   trap ui.css records for the two builders that hit it before this one. */
.gc-tw{overflow-x:auto;border:3px solid var(--keyline);border-radius:12px;box-shadow:var(--hard-lg);
  background-color:var(--card);margin-bottom:var(--s4);
  background-image:
    linear-gradient(to right,var(--card) 40%,rgba(255,255,255,0)),
    linear-gradient(to left,var(--card) 40%,rgba(255,255,255,0)),
    /* WAS rgba(17,17,17,.30): a near-black shadow, which is the "there is more
       to the right" cue and which is invisible on a dark card. Same geometry,
       opaque black, so the cue survives the repaint. */
    radial-gradient(farthest-side at 0 50%,rgba(0,0,0,.55),rgba(0,0,0,0)),
    radial-gradient(farthest-side at 100% 50%,rgba(0,0,0,.55),rgba(0,0,0,0));
  background-position:left center,right center,left center,right center;
  background-repeat:no-repeat;
  background-size:44px 100%,44px 100%,15px 100%,15px 100%;
  background-attachment:local,local,scroll,scroll}
.gc-t{border-collapse:collapse;width:100%;min-width:640px;font-size:var(--t-sm)}
/* The table's title, outside the scroller. See the note on table() above for
   why it is not a <caption> any more. Same type as the old one, so the only
   thing a wide screen sees change is that the line sits above the box's border
   rather than inside it. */
.gc-tcap{margin:var(--s4) 0 var(--s2);font:700 var(--t-label)/1.35 var(--body);
  letter-spacing:.04em;text-transform:uppercase;color:var(--ink-2);max-width:56ch}
.gc-t th,.gc-t td{padding:10px var(--s3);text-align:left;border-bottom:1px solid var(--hair);vertical-align:top}
.gc-t thead th{font:700 var(--t-label)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  background:var(--band-bg);color:var(--chrome-ink);border-bottom:none}
.gc-t tbody th{font-weight:700;white-space:nowrap}
.gc-t tbody tr:first-child{background:var(--sky-tint)}
.gc-none span{font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2);opacity:.7}
/* The centering diagram beside the sentence it draws. The picture is useless
   above the paragraph and useless below it; the whole value is that a reader
   stuck on "60/40" can glance left mid-sentence. Under 700px it stacks, diagram
   first, because on a phone "above" is the only version of "beside" there is. */
.ct-wrap{display:flex;gap:var(--s5);align-items:flex-start;margin-bottom:var(--s4)}
.ct-txt{margin-bottom:0 !important}
@media(max-width:700px){.ct-wrap{flex-direction:column;gap:var(--s4)}}
/* 280 RATHER THAN 210, WHICH IS THE PHONE'S OWN CAP, for the reason written out
   above .gd-fig: this viewBox is 212 units wide, so the 10-unit dimension
   labels drew at 9.91 CSS px on a desktop against 13.21 on a phone. Setting the
   desktop width to the phone cap is the whole fix -- both are 13.21px now and
   the two cannot drift apart, since neither is a number the other does not
   have. Clears the 12px floor with room, which .gd-fig at 310 does not. */
.ct-fig{flex:none;width:280px;margin:0}
@media(max-width:700px){.ct-fig{width:100%;max-width:280px;align-self:center}}
.ct-svg{width:100%;height:auto;display:block;overflow:visible}
.ct-card{fill:var(--card);stroke:var(--keyline);stroke-width:4}
/* The two border strips, which are the measurement. Faint enough that the card
   still reads as a card, strong enough that the wider one is obvious. */
.ct-band{fill:var(--ketchup);opacity:.15}
/* The window is filled, not outlined, so the two BORDERS either side of it read
   as the measured thing. An outlined window makes the reader compare two lines
   instead of two gaps, which is the wrong comparison. */
.ct-win{fill:var(--navy);opacity:.14;stroke:var(--navy);stroke-width:2;stroke-opacity:.5}
.ct-dim{stroke:var(--ketchup);stroke-width:2}
.ct-lab{fill:var(--ketchup-deep);font:700 10px/1 var(--mono);text-anchor:middle}
.ct-in{fill:var(--ink-2);font:400 11px/1 var(--body);text-anchor:middle}
.ct-fig figcaption{font-size:var(--t-sm);line-height:1.5;color:var(--ink-2);margin-top:var(--s3)}
.ct-fig figcaption b{font-family:var(--mono);color:var(--ketchup-deep)}
/* THE FRONT AND BACK LADDER. Three columns, grade then two cards, so the front
   and the back of one grade are on one line: the whole point is the comparison
   ACROSS a row, and any layout that stacks them loses it. The card width is
   clamped rather than fixed because at 390 the row has about 350px to spend on
   a label and two cards, and at 1280 the same grid would leave two postage
   stamps in a 1,232px band. */
.lad{margin:var(--s5) 0;border:3px solid var(--keyline);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4)}
/* THE LABEL COLUMN IS CAPPED AND THE GRID HUGS THE LEFT. As minmax(0,1fr) it
   ate every spare pixel: at 1280 the grade names sat in a 1,000px column with
   the eight cards pushed against the right edge of the panel, half a metre from
   the label they belong to. The comparison is ACROSS a row, so the row has to
   stay short however wide the page gets. */
.lad-grid{display:grid;grid-template-columns:minmax(104px,220px) auto auto;
  gap:var(--s3) var(--s5);align-items:center;justify-items:center;justify-content:start}
.lad-h{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.lad-g{justify-self:start;font-weight:700;font-size:var(--t-sm);line-height:1.25}
.lad-c{display:block;text-align:center}
.lad-c b{display:block;margin-top:6px;font:700 var(--t-micro)/1 var(--mono);color:var(--ketchup-deep)}
.lad-svg{display:block;width:clamp(56px,17vw,104px);height:auto}
/* Phone tracks: see the note above ladder() for the arithmetic. */
@media(max-width:700px){
  .lad-grid{grid-template-columns:minmax(88px,220px) auto auto;column-gap:var(--s3)}
}
/* Desktop puts the caption beside the cards rather than under them. The grid is
   a fixed ~430px however wide the page is, so stacked it left roughly 800px of
   empty panel at 1280 with the explanation below the fold of the figure. */
@media(min-width:1000px){
  .lad-svg{width:104px}
  .lad{display:flex;gap:var(--s6);align-items:flex-start}
  .lad figcaption{margin-top:0;flex:1;min-width:0}
}
/* THE BAND AND WINDOW OPACITIES ARE NOT THE BIG DIAGRAM'S AND THAT IS MEASURED.
   Inherited unchanged (band .15, window .14) the two tones are within one
   percent of each other, and at a quarter of the size that is one grey block
   with a faint seam: the second build of this figure was eight cards nobody
   could tell apart. The big diagram gets away with it at 210px wide with
   dimension lines and numbers inside it. This one is 56 to 104px with nothing
   in it but the shape, so the strip has to carry the whole reading. */
.lad-svg .ct-band{opacity:.5}
.lad-svg .ct-win{opacity:.09}
.lad figcaption{font-size:var(--t-sm);line-height:1.55;color:var(--ink-2);margin-top:var(--s4);max-width:52ch}
/* THE SPREAD FIGURE, and it is on the page background rather than inside a
   panel, so its tokens are the page ones and not the chrome ones .sg uses.
   Getting that backwards paints --chrome-ink, which is #F5F4F0, onto near
   white. Read which background a figure lands on before picking a token.

   TYPE IS 9 VIEWBOX UNITS. The figure box is 312px at 390x844 against a 300
   unit box, so 9 lands at about 9.4 rendered pixels, which is the floor. Do not
   go below it here: the row labels are the only way to tell a front row from a
   back one. */
.sp{margin:var(--s5) 0;border:3px solid var(--keyline);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4)}
.sp-svg{display:block;width:100%;max-width:560px;height:auto}
.sp-g{font:700 9px var(--mono);fill:var(--ink)}
.sp-f{font:400 9px var(--mono);fill:var(--ink-2)}
/* 9 and not 8. At 8 these two headings rendered 8.7px on a phone, under the
   floor, and they are the only thing saying which way the axis runs. */
.sp-h{font:700 9px var(--mono);fill:var(--ink-2)}
.sp-a{font:700 9px var(--mono);fill:var(--ink-2)}
.sp-p{font:700 9px var(--mono);fill:var(--ketchup-deep)}
.sp-t{stroke:var(--ink);stroke-width:1;opacity:.12}
/* The row rule runs the full axis whether or not anything is on it, so a row
   with nothing published is visibly a row with nothing on it rather than a gap
   in the figure. */
.sp-r{stroke:var(--hair);stroke-width:1}
.sp-d{fill:var(--ink)}
.sp figcaption{font-size:var(--t-sm);line-height:1.55;color:var(--ink-2);margin-top:var(--s4);max-width:52ch}
.sp figcaption b{color:var(--ink)}
/* Caption beside the drawing on desktop, the same move .lad and .sg make and
   for the same reason: the svg is capped at 560px however wide the page gets. */
@media(min-width:1000px){
  .sp{display:flex;gap:var(--s6);align-items:flex-start}
  .sp-svg{flex:0 0 auto;width:560px}
  .sp figcaption{margin-top:0;flex:1;min-width:0}
}
.gc-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4)}
@media(max-width:880px){.gc-cards{grid-template-columns:1fr}}
.gc-c{border:3px solid var(--keyline);border-radius:12px;background:var(--card);box-shadow:var(--hard-lg);
  padding:var(--s4)}
.gc-c h3{font:400 var(--t-m)/1.2 var(--display);margin-bottom:var(--s2)}
.gc-c p{font-size:var(--t-sm);line-height:1.55}
.gc-co{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2);
  display:block;margin-bottom:var(--s2)}
.gc-s{font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2);white-space:nowrap}
.gc-note{font:400 var(--t-micro)/1.5 var(--mono);color:#B8C9D6;display:block;white-space:normal;max-width:44em}
.gc-key{border:3px solid var(--keyline);border-radius:12px;background:var(--band-bg);color:var(--chrome-ink);
  padding:var(--s5);margin:var(--s5) 0;box-shadow:var(--hard-lg)}
.gc-key h2,.gc-key h3{color:var(--chrome-ink)}
.gc-key p,.gc-key li{color:var(--foot-ink);line-height:1.55;max-width:44em}
.gc-key p+p,.gc-key ul{margin-top:var(--s3)}
.gc-key ul{margin-left:var(--s4)}
.gc-key .gc-s{color:#B8C9D6}
.gc-ex{list-style:none;margin:var(--s4) 0 0;padding:0;display:flex;flex-direction:column;gap:var(--s2)}
.gc-ex li{display:flex;flex-wrap:wrap;gap:var(--s2);align-items:baseline;font-size:var(--t-sm);
  padding:10px var(--s3);background:rgba(255,255,255,.07);border-radius:8px}
.gc-ex b{font:700 var(--t-m)/1 var(--body);color:var(--mustard)}
/* THE SUBGRADE FIGURE, and every colour in here is a chrome token because it is
   the only drawing on this site that sits INSIDE a filled dark panel. .gc-key is
   background:var(--band-bg), and --navy resolves to #111111. So do --ketchup,
   --keyline and --ink. Reaching for any of the four the other figures on this
   page use, or for --ink-2 at #5B5B5B, paints a mark that is either invisible or
   nearly so, and nothing errors. The argument is carried by three SHAPES, a
   filled dot, a dashed rule and a solid rule, so the figure still reads with
   every fill in this block set to one value. */
.sg{margin:var(--s4) 0 0}
.sg-svg{display:block;width:100%;max-width:520px;height:auto}
.sg-base{stroke:var(--chrome-dim);stroke-width:1;opacity:.6}
.sg-grid{stroke:var(--chrome-ink);stroke-width:1;opacity:.12}
.sg-ax{fill:var(--chrome-dim);font:700 10px/1 var(--mono);text-anchor:middle}
.sg-key{fill:var(--chrome-dim);font:400 10px/1 var(--mono)}
.sg-dot{fill:var(--chrome-ink)}
/* The lowest component is a RING rather than a brighter dot. It is the one mark
   the heading above the panel is about, it has to survive a reader who cannot
   tell two greys apart, and a ring reads as "this one" at 4px where a tint does
   not. */
.sg-worst{fill:none;stroke:var(--chrome-ink);stroke-width:2}
.sg-mean{stroke:var(--chrome-dim);stroke-width:1.5;stroke-dasharray:5 3}
.sg-final{stroke:var(--mustard);stroke-width:2.5}
.sg-num{fill:var(--mustard);font:700 12px/1 var(--mono);text-anchor:middle}
.sg figcaption{font-size:var(--t-sm);line-height:1.55;color:var(--foot-ink);margin-top:var(--s3);max-width:52ch}
/* Same move as .lad below: the drawing is a fixed 520px however wide the page
   gets, so stacked it leaves most of the panel empty with the explanation under
   the fold of the figure. */
@media(min-width:1000px){
  .sg{display:flex;gap:var(--s6);align-items:flex-start}
  .sg-svg{flex:0 0 auto;width:520px}
  .sg figcaption{margin-top:0;flex:1;min-width:0}
}
.gc-list{margin:0 0 0 var(--s4);max-width:46em;line-height:1.55}
.gc-list li{margin-bottom:var(--s3)}
.gc-def{margin:0;max-width:48em}
.gc-def dt{font-weight:700;margin-top:var(--s4);line-height:1.3}
.gc-def dd{margin:var(--s2) 0 0;color:var(--ink-2);font-size:var(--t-sm);line-height:1.55}
.gc-aka{font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.06em}
/* Defect diagrams. EVERY WORD OF THE REASONING IS IN THE JS, in the block above
   gdCard() and in the one above STYLE_GD. Do not write prose in here. */
.gd-row{display:flex;gap:var(--s5);align-items:flex-start;margin-top:var(--s2)}
/* 310, NOT 240, AND THE PHONE CAP MOVES WITH IT. The viewBox is 180 units wide
   and the whole drawing scales to the box, so the smallest label (7 units) was
   rendering at 7 x 240/180 = 9.33 CSS px on a desktop against 10.11 on a phone:
   the desktop drew the picture 20px NARROWER than the phone did, so every drawn
   word shrank with it, and 9.33px was the smallest type measured anywhere on
   this site. 310/180 puts that label at 12.06px and the 8-unit ones at 13.78.
   The floor is the one build-shops.mjs argues for its map and it is the same
   argument: --t-micro (11px) is what this figure's own caption is set in, and
   nothing drawn ON a picture may be smaller than the prose explaining it, so
   the floor is the next token up, --t-label at 12px. The two widths are equal
   now, so the inversion cannot come back by one of them being edited alone.
   MEASURED WITH getBoundingClientRect AND WITH font-size x the real
   viewBox-to-viewport scale, which agree. getComputedStyle on SVG text reports
   USER UNITS: it reads 7 at every width and always will. */
.gd-fig{flex:none;width:310px;margin:0}
.gd-p{margin:0;min-width:0}
.gd-svg{display:block;width:100%;height:auto}
@media(max-width:700px){
  .gd-row{flex-direction:column;gap:var(--s3)}
  .gd-fig{width:100%;max-width:310px;align-self:center}
}
.gd-svg .ct-card{stroke-width:2}
.gd-svg .ct-win{stroke-width:1}
.gd-l{fill:var(--ink-2);font:700 8px/1 var(--mono);letter-spacing:.05em;text-anchor:middle}
.gd-bad{fill:var(--ketchup-deep);font:700 8px/1 var(--mono);letter-spacing:.05em;text-anchor:middle}
.gd-n{fill:var(--ink-2);font:400 7px/1 var(--mono);text-anchor:middle}
.gd-la{fill:var(--ink);font:700 7px/1 var(--mono)}
.gd-lb{fill:var(--ink-2);font:400 7px/1 var(--mono)}
.gd-mark{fill:none;stroke:var(--ketchup-deep);stroke-width:1.6;stroke-linecap:round}
.gd-soft{fill:none;stroke:var(--ketchup-deep);stroke-width:1.2;opacity:.8;stroke-linecap:round}
.gd-white{fill:var(--ink)}
.gd-foil{fill:none;stroke:var(--sky-deep);stroke-width:1}
.gd-hair{fill:none;stroke:var(--ink-2);stroke-width:1;opacity:.7;stroke-linecap:round}
.gd-band{fill:none;stroke:var(--ink-2);stroke-width:1.2;opacity:.8}
.gd-lead{fill:none;stroke:var(--ink-2);stroke-width:.8;stroke-dasharray:2 2}
.gd-ref{fill:none;stroke:var(--ink-2);stroke-width:1;stroke-dasharray:4 3}
.gd-gap{fill:var(--ketchup-deep);opacity:.8}
.gd-bite{fill:var(--page);stroke:var(--keyline);stroke-width:1.2}
.gc-unv{border:3px dashed var(--hair);border-radius:12px;padding:var(--s4);background:var(--card)}
.gc-foot{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s6);line-height:1.6;max-width:46em}

/* DESKTOP READING MEASURE. The caps above were written in em as if 1em were
   one character. It is not: these faces run 2.31 to 2.47 characters per em, so
   44 to 46em bought 105 to 108 real characters a line at 1440. ui.css already
   caps main prose at var(--measure) and these rules only outranked it by
   landing after the stylesheet. All min-width:1000, ui.css's own desktop
   breakpoint, so the phone and the tablet range keep exactly the rules
   they had.

   IT IS .gc-key p AND NOT .gc-key li, AND THAT IS THE WHOLE CARE IN THIS
   BLOCK. The 44em above covers both, but .gc-ex li is a display:flex row of a
   subgrade line and its total, not a sentence, and .gc-ex sits inside .gc-key.
   A cap on the li would have rescaled those rows. Paragraphs only; the lists
   here were read and left alone.

   AND :not(.gc-note) IS THE SECOND HALF OF THAT CARE, CAUGHT BY MEASURING
   AFTERWARDS RATHER THAN BY READING THE SELECTOR. .gc-note is a p, it sits
   inside .gc-key, and it is the only Space Mono block on the page. Mono runs
   about 1.77 characters per em against Outfit's 2.31, so its 44em box was
   already only about 70 real characters and the shared cap took it to 57,
   which is too narrow rather than too wide. Same reason .rg-foot in
   build-rarity.mjs and .up-foot in build-upcoming.mjs are not capped and
   ui.css keeps .price-note on its own 52em: a mono block does not join the
   shared number. A pass that only reads class names will re-add it. */
@media(min-width:1000px){
.gc-lede,.gc-foot{max-width:var(--measure)}
.gc-sec > p.gc-in,.gc-in,.gc-key p:not(.gc-note){max-width:var(--measure)}
/* AND THE ONE dd THAT IS NOT PROSE HAS TO BE LET OUT OF THE MEASURE, WHICH IS
   A DEFECT THE WIDER .gd-fig ABOVE MADE VISIBLE RATHER THAN ONE IT INVENTED.
   ui.css caps main :is(p,dd,blockquote,figcaption) at var(--measure), which
   is 36em of this dd's own var(--t-sm): 504px. A dd holding a .gd-row is not a
   line of text, it is a PICTURE BESIDE a line of text, so the figure was being
   taken out of the paragraph's reading measure rather than sitting next to it,
   and the paragraph got whatever was left:

        .gd-fig    .gd-p at 1440   chars a line
          240px        240px           35.3      before the fix above
          310px        170px           25.0      after it, and worse
          310px        504px           61.3      with this rule

   which is the same shape of defect as the games hub blurbs and was found the
   same way, by measuring the thing next to the thing that changed. 25 is
   unreadable and 35 was already poor, on a 1,440px screen with 888px of empty
   band to the right of it. The cap is now the measure PLUS the figure, so the
   prose gets its own 504px whatever the drawing does and the two numbers can
   never be taken out of each other again.

   :has(.gd-row) SCOPES IT TO THE ELEVEN dds THAT HOLD A DIAGRAM. The other
   dds in this list are prose and keep the shared cap. Specificity is (0,2,1)
   against ui.css's (0,0,2), so it wins on weight and not merely on order.
   min-width:1000 for the same reason as everything else in this block: below
   it the row is 720px wide and the paragraph already had 386px and 56.8
   characters, and at 700 the row stacks entirely. */
.gc-def dd:has(.gd-row){max-width:calc(var(--measure) + 310px + var(--s5))}
}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Will It Grade? How to Tell a PSA 10 From a 9 Before You Pay</title>
<meta name="description" content="${esc(clipMeta(desc))}">
<link rel="canonical" href="${SITE}/will-it-grade.html">
<meta property="og:title" content="Will it grade? How to read your own card first">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/will-it-grade.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-will-it-grade.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-will-it-grade.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
<style>${style}</style>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Will it grade" },
  ],
})}</script>
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Will it grade</span></nav>
      <h1>Will it <span class="hl">grade</span>?</h1>
      <p class="lede gc-lede"><a href="/grading.html">The other page</a> works out whether grading pays, and the
        answer there is almost always that it only pays on a 10. This page is the part that was missing: how to
        tell whether you are holding one, before you spend the fee finding out.</p>
      <p class="lede gc-lede">Everything below was read off a grading company's own published standard on
        ${esc(longDate(d.checked))}. Where the hobby says one thing and no company published it, that is said
        plainly instead of repeated.</p>

      <div class="gc-key">
        <h2>Start with the worst thing on the card</h2>
        <p>Beckett is the only company that still publishes both the four component scores and how they combine,
          and its rules are the most useful thing on this page.${src(d.subgrades.math.source, "Beckett on how subgrades combine")}</p>
        <ul>
${d.subgrades.math.rules.map((r) => `          <li>${esc(r)}</li>`).join("\n")}
        </ul>
        <ul class="gc-ex">
${d.subgrades.math.examples.map((e) => `          <li>${esc(e.sub)} <b>= ${esc(e.final)}</b></li>`).join("\n")}
        </ul>
${sgFig()}
        ${/* THE FIGURE SITS BETWEEN THE EXAMPLES AND soWhat, which is the only
              place it can go. It draws those three rows and nothing else, so
              above the list it would be a picture of numbers the reader has not
              met; below soWhat it would arrive after the sentence that reads the
              answer off it. In between, "that third example" in the next
              paragraph now points at a row the reader can see. */ ""}
        ${/* soWhat GOES AFTER THE EXAMPLES AND HAS TO. Its second sentence is
              "That third example is a card that is perfect on three of four
              criteria and comes back a 7", which pointed at nothing when this
              paragraph was rendered above the list: the reader met "that third
              example" before any example existed. If the copy is rewritten so
              it stops naming a row, it can move back up. */ ""}
        ${/* The inline margin is the same one the note below carries, and for the
              same reason: `.gc-key p+p` only fires between two paragraphs, and
              `.gc-ex` sets margin-bottom to 0, so a <p> following the examples
              list would otherwise sit flush against the last row. Spacing token
              only, no colour. */ ""}
        <p style="margin-top:var(--s3)">${esc(d.subgrades.math.soWhat)}</p>
        <p class="gc-note" style="margin-top:var(--s3)">${esc(d.subgrades.math.sourceNote)}</p>
      </div>

      <section class="gc-sec">
        <h2>Centering, the only part you can <span class="hl">measure</span></h2>
        <p class="gc-in">${esc(c.lead)}</p>
        <div class="ct-wrap">
${centeringDiagram()}
          <p class="gc-in ct-txt"><b>How it is measured.</b> ${esc(c.howMeasured.text)} ${esc(c.howMeasured.example)}
            ${c.howMeasured.company} says so.${src(c.howMeasured.source, "PSA on how centering is measured")}</p>
        </div>
${table(c.front, "Front centering, as each company publishes it")}
${table(c.back, "Back centering. Note how much wider the tolerances are, and how many are simply absent")}
${ladder()}
${spreadFig()}
        <p class="gc-in"><b>PSA gives itself room, and tells you so.</b> ${esc(c.leeway.text)}
          ${esc(c.leeway.worked)}${src(c.leeway.source, "PSA centering standards and leeway")}</p>
        <div class="gc-cards">
${c.findings.map((f) => `          <article class="gc-c"><h3>${esc(f.head)}</h3><p>${esc(f.body)}</p></article>`).join("\n")}
        </div>
      </section>

      <section class="gc-sec">
        <h2>What separates a <span class="hl">10</span> from a 9</h2>
        <p class="gc-in">${esc(d.tenVsNine.lead)}</p>
        <div class="gc-cards">
${d.tenVsNine.items.map((i) => `          <article class="gc-c"><span class="gc-co">${esc(i.company)}</span>
            <h3>${esc(i.head)}</h3><p>${esc(i.body)}${src(i.source, `${i.company} grade definitions`)}</p></article>`).join("\n")}
        </div>
      </section>

      <section class="gc-sec">
        <h2>Which companies show their <span class="hl">work</span></h2>
        <p class="gc-in">${esc(d.subgrades.lead)}</p>
        <div class="gc-cards">
${d.subgrades.who.map((w) => `          <article class="gc-c"><span class="gc-co">${esc(w.kind || (w.has ? "Subgrades" : "No subgrades"))}</span>
            <h3>${esc(w.company)}</h3><p>${esc(w.note)}</p></article>`).join("\n")}
        </div>
      </section>

      <section class="gc-sec">
        <h2>The flaws that cost you <span class="hl">grades</span></h2>
        <p class="gc-in">${esc(d.defects.lead)}</p>
        <div class="gc-key">
          <h3>${esc(d.defects.headline.head)}</h3>
          <p>${esc(d.defects.headline.body)}${src(d.defects.headline.source, "PSA on chipping")}</p>
        </div>
        <dl class="gc-def">
${d.defects.items
  .map((i) => {
    const body = `${esc(i.what)} <span class="gc-aka">${esc(i.co)}</span>`;
    // THE FIGURE GOES INSIDE THE <dd>, BESIDE THE DEFINITION IT DRAWS, which is
    // the same call .ct-wrap makes further up this page: a picture above the
    // paragraph or below it is a picture the reader has to hold in their head,
    // and the whole value here is glancing left mid-sentence. A <figure> is
    // valid inside a <dd> and the <dd> is still the caption, which is why none
    // of these carry a <figcaption>: the definition IS the caption and printing
    // it twice would be the same two sentences twice.
    const fig = GD[i.name] ? GD[i.name]() : "";
    return `          <dt>${esc(i.name)}${i.aka ? ` <span class="gc-aka">the hobby calls it ${esc(i.aka)}</span>` : ""}</dt>
          <dd>${fig ? `<div class="gd-row">${fig}
            <p class="gd-p">${body}</p>
          </div>` : body}</dd>`;
  })
  .join("\n")}
        </dl>
      </section>

      <section class="gc-sec">
        <h2>What is different about modern <span class="hl">Pokemon</span></h2>
        <p class="gc-in">${esc(d.pokemon.lead)}</p>
        <div class="gc-cards">
${d.pokemon.items.map((i) => `          <article class="gc-c"><h3>${esc(i.head)}</h3><p>${esc(i.body)}${src(i.source, i.head)}${
            i.seeAlso ? ` <a href="${esc(i.seeAlso)}">Spotting fakes</a>` : ""
          }</p></article>`).join("\n")}
        </div>
      </section>

      <section class="gc-sec">
        <h2>Checking it <span class="hl">yourself</span></h2>
        <p class="gc-in">${esc(d.selfCheck.lead)}</p>
        <div class="gc-cards">
${d.selfCheck.items.map((i) => `          <article class="gc-c"><h3>${esc(i.head)}</h3><p>${esc(i.body)}${src(i.source, i.head)}${
            i.note ? `<br><span class="gc-aka">${esc(i.note)}</span>` : ""
          }</p></article>`).join("\n")}
        </div>
        <div class="gc-key">
          <h3>${esc(d.selfCheck.limit.head)}</h3>
          <p>${esc(d.selfCheck.limit.body)}${src(d.selfCheck.limit.source, "PSA on eye appeal and subjectivity")}</p>
          ${d.selfCheck.limit.also ? `<p>${esc(d.selfCheck.limit.also)}${src(d.selfCheck.limit.alsoSource, "CGC on judging surface at home")}</p>` : ""}
          <h3 style="margin-top:var(--s4)">${esc(d.selfCheck.notesCost.head)}</h3>
          <p>${esc(d.selfCheck.notesCost.body)}${src(d.selfCheck.notesCost.source, "PSA grading service tiers")}</p>
        </div>
      </section>

      <section class="gc-sec">
        <h2>What the <span class="hl">numbers</span> say about your odds</h2>
        <p class="gc-in">${esc(d.population.lead)}</p>
        <div class="gc-cards">
          <article class="gc-c"><span class="gc-co">PSA</span>
            <h3>Read this one against yourself</h3>
            <p>${esc(d.population.psa.text)}${src(d.population.psa.source, "PSA grade distribution")}</p>
            <p style="margin-top:var(--s3)"><b>${esc(d.population.psa.trap)}</b></p></article>
          <article class="gc-c"><span class="gc-co">TAG</span>
            <h3>The top grade is rare and one company says how rare</h3>
            <p>${esc(d.population.tag.text)}${src(d.population.tag.source, "TAG on how rare Pristine is")}</p></article>
        </div>
        <p class="gc-in" style="margin-top:var(--s4)"><b>Go and look up your exact card.</b>
          ${esc(d.population.lookup.text)}${src(d.population.lookup.source, "CGC population report")} ${esc(d.population.lookup.gap)}</p>
      </section>

      <section class="gc-sec">
        <h2>What nobody actually <span class="hl">publishes</span></h2>
        <p class="gc-in">${esc(d.unverified.lead)}</p>
        <div class="gc-unv">
          <ul class="gc-list">
${d.unverified.items.map((i) => `            <li>${esc(i)}</li>`).join("\n")}
          </ul>
        </div>
      </section>

      <section class="gc-sec">
        <h2>Now go and do the <span class="hl">math</span></h2>
        <p class="gc-in">If the card survived all of that, the next question is whether the fee clears.
          <a href="/grading.html">What grading costs and whether it pays</a> has the current fee table for all
          ${GRADING_CO} companies and works the break-even out against each card's own price. If it did not survive,
          it is still a card: <a href="/selling.html">where to sell it raw</a> is next door, and a raw card sells
          fine.</p>
        <!-- THE 1999 CARDS, WHICH ARE THE ONES MOST LIKELY TO BE SUBMITTED BLIND.
             Everything above is about condition, and condition is the bigger half
             of what a Base Set card is worth. The smaller half is which of the
             three print runs it is, and that is a different check with a different
             page: sending a card off without knowing whether it is a 1st Edition
             is how somebody pays a fee they should not have and how somebody else
             misses one they should. -->
        <p class="gc-in">And if the card is from 1999, work out <b>which printing</b> before you decide anything.
          <a href="/base-set.html">1st Edition, Shadowless or Unlimited</a> is a two mark check on the card in
          front of you, and the three runs are priced a long way apart.</p>
      </section>

      <p class="gc-foot">Read from each company's own published standards and error guides on
        ${esc(longDate(d.checked))}. Standards change and the companies do not announce it, so check before you
        submit anything expensive. Where two pages of the same company disagreed, the standards page was used:
${d.conflicts.map((x) => `        ${esc(x.what)}`).join("<br>\n")}
        <br>Nothing here is a pull rate and nothing here is a promise about your card. The final call is a human
        being's judgment, and every company says so.</p>
    </div>
  </section>
</main>
${footer()}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/will-it-grade.html"), page);
console.log(`Wrote public/will-it-grade.html
  ${c.front.length} front and ${c.back.length} back centering rows across ${CO.length} companies
  ${d.defects.items.length} defects, ${d.pokemon.items.length} Pokemon notes, ${d.unverified.items.length} unpublished claims named`);
