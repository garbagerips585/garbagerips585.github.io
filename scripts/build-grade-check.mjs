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
import { esc, longDate } from "../shared/format.mjs";

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
const table = (rows, cap) => `      <div class="gc-tw" tabindex="0" role="region" aria-label="${esc(
  String(cap).replace(/<[^>]+>/g, "")
)}, scrollable table">
        <table class="gc-t">
          <caption>${cap}</caption>
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
  const W = 300, X0 = 44, X1 = 268, G0 = 6, G1 = 10;
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
          <svg viewBox="0 0 ${W} ${H}" class="sg-svg" aria-hidden="true" focusable="false">
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

const desc =
  "Will your Pokemon card grade a 10? Centering tolerances from PSA, CGC, Beckett, SGC and TAG, the flaws that cost grades, and how to check a card at home.";

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
.gc-tw{overflow-x:auto;border:3px solid var(--navy);border-radius:12px;box-shadow:var(--hard-lg);
  background-color:var(--card);margin-bottom:var(--s4);
  background-image:
    linear-gradient(to right,var(--card) 40%,rgba(255,255,255,0)),
    linear-gradient(to left,var(--card) 40%,rgba(255,255,255,0)),
    radial-gradient(farthest-side at 0 50%,rgba(17,17,17,.30),rgba(17,17,17,0)),
    radial-gradient(farthest-side at 100% 50%,rgba(17,17,17,.30),rgba(17,17,17,0));
  background-position:left center,right center,left center,right center;
  background-repeat:no-repeat;
  background-size:44px 100%,44px 100%,15px 100%,15px 100%;
  background-attachment:local,local,scroll,scroll}
.gc-t{border-collapse:collapse;width:100%;min-width:640px;font-size:var(--t-sm)}
.gc-t caption{caption-side:top;text-align:left;padding:var(--s3) var(--s4);font:700 var(--t-label)/1.3 var(--body);
  letter-spacing:.04em;text-transform:uppercase;color:var(--ink-2);border-bottom:2px solid var(--hair)}
.gc-t th,.gc-t td{padding:10px var(--s3);text-align:left;border-bottom:1px solid var(--hair);vertical-align:top}
.gc-t thead th{font:700 var(--t-label)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  background:var(--navy);color:var(--chrome-ink);border-bottom:none}
.gc-t tbody th{font-weight:700;white-space:nowrap}
.gc-t tbody tr:first-child{background:rgba(245,166,43,.09)}
.gc-none span{font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2);opacity:.7}
/* The centering diagram beside the sentence it draws. The picture is useless
   above the paragraph and useless below it; the whole value is that a reader
   stuck on "60/40" can glance left mid-sentence. Under 700px it stacks, diagram
   first, because on a phone "above" is the only version of "beside" there is. */
.ct-wrap{display:flex;gap:var(--s5);align-items:flex-start;margin-bottom:var(--s4)}
.ct-txt{margin-bottom:0 !important}
@media(max-width:700px){.ct-wrap{flex-direction:column;gap:var(--s4)}}
.ct-fig{flex:none;width:210px;margin:0}
@media(max-width:700px){.ct-fig{width:100%;max-width:280px;align-self:center}}
.ct-svg{width:100%;height:auto;display:block;overflow:visible}
.ct-card{fill:var(--card);stroke:var(--navy);stroke-width:4}
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
.lad{margin:var(--s5) 0;border:3px solid var(--navy);border-radius:12px;background:var(--card);
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
.sp{margin:var(--s5) 0;border:3px solid var(--navy);border-radius:12px;background:var(--card);
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
.gc-c{border:3px solid var(--navy);border-radius:12px;background:var(--card);box-shadow:var(--hard-lg);
  padding:var(--s4)}
.gc-c h3{font:400 var(--t-m)/1.2 var(--display);margin-bottom:var(--s2)}
.gc-c p{font-size:var(--t-sm);line-height:1.55}
.gc-co{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2);
  display:block;margin-bottom:var(--s2)}
.gc-s{font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2);white-space:nowrap}
.gc-note{font:400 var(--t-micro)/1.5 var(--mono);color:#B8C9D6;display:block;white-space:normal;max-width:44em}
.gc-key{border:3px solid var(--navy);border-radius:12px;background:var(--navy);color:var(--chrome-ink);
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
   background:var(--navy), and --navy resolves to #111111. So do --ketchup,
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
}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Will It Grade? How to Tell a PSA 10 From a 9 Before You Pay</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/will-it-grade.html">
<meta property="og:title" content="Will it grade? How to read your own card first">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/will-it-grade.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-will-it-grade.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-will-it-grade.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
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
        <h2>Which companies show their <span class="hl">working</span></h2>
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
${d.defects.items.map((i) => `          <dt>${esc(i.name)}${i.aka ? ` <span class="gc-aka">the hobby calls it ${esc(i.aka)}</span>` : ""}</dt>
          <dd>${esc(i.what)} <span class="gc-aka">${esc(i.co)}</span></dd>`).join("\n")}
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
