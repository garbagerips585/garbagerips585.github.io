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
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS } from "../shared/chrome.mjs";
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

const desc =
  "Will your Pokemon card grade a 10? Centering tolerances from PSA, CGC, Beckett, SGC and TAG, the flaws that cost grades, and how to check a card at home.";

const style = `
.gc-lede{max-width:46em}
.gc-sec{margin-top:var(--s6)}
.gc-sec > p.gc-in{color:var(--ink-2);max-width:44em;line-height:1.55;margin-bottom:var(--s4)}
.gc-tw{overflow-x:auto;border:3px solid var(--navy);border-radius:12px;box-shadow:var(--hard-lg);
  background:var(--card);margin-bottom:var(--s4)}
.gc-t{border-collapse:collapse;width:100%;min-width:640px;font-size:var(--t-sm)}
.gc-t caption{caption-side:top;text-align:left;padding:var(--s3) var(--s4);font:700 var(--t-label)/1.3 var(--body);
  letter-spacing:.04em;text-transform:uppercase;color:var(--ink-2);border-bottom:2px solid var(--hair)}
.gc-t th,.gc-t td{padding:10px var(--s3);text-align:left;border-bottom:1px solid var(--hair);vertical-align:top}
.gc-t thead th{font:700 var(--t-label)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  background:var(--navy);color:#F4F1E2;border-bottom:none}
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
.gc-key{border:3px solid var(--navy);border-radius:12px;background:var(--navy);color:#F4F1E2;
  padding:var(--s5);margin:var(--s5) 0;box-shadow:var(--hard-lg)}
.gc-key h2,.gc-key h3{color:#F4F1E2}
.gc-key p,.gc-key li{color:#DDE6EC;line-height:1.55;max-width:44em}
.gc-key p+p,.gc-key ul{margin-top:var(--s3)}
.gc-key ul{margin-left:var(--s4)}
.gc-key .gc-s{color:#B8C9D6}
.gc-ex{list-style:none;margin:var(--s4) 0 0;padding:0;display:flex;flex-direction:column;gap:var(--s2)}
.gc-ex li{display:flex;flex-wrap:wrap;gap:var(--s2);align-items:baseline;font-size:var(--t-sm);
  padding:10px var(--s3);background:rgba(255,255,255,.07);border-radius:8px}
.gc-ex b{font:700 var(--t-m)/1 var(--body);color:var(--mustard)}
.gc-list{margin:0 0 0 var(--s4);max-width:46em;line-height:1.55}
.gc-list li{margin-bottom:var(--s3)}
.gc-def{margin:0;max-width:48em}
.gc-def dt{font-weight:700;margin-top:var(--s4);line-height:1.3}
.gc-def dd{margin:var(--s2) 0 0;color:var(--ink-2);font-size:var(--t-sm);line-height:1.55}
.gc-aka{font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.06em}
.gc-unv{border:3px dashed var(--hair);border-radius:12px;padding:var(--s4);background:var(--card)}
.gc-foot{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s6);line-height:1.6;max-width:46em}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Will It Grade? How to Tell a PSA 10 From a 9 Before You Pay | Garbage Rips 585</title>
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
<meta name="theme-color" content="#1E3A54">
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
        <p>${esc(d.subgrades.math.soWhat)}</p>
        <p>Beckett is the only company that still publishes both the four component scores and how they combine,
          and its rules are the most useful thing on this page.${src(d.subgrades.math.source, "Beckett on how subgrades combine")}</p>
        <ul>
${d.subgrades.math.rules.map((r) => `          <li>${esc(r)}</li>`).join("\n")}
        </ul>
        <ul class="gc-ex">
${d.subgrades.math.examples.map((e) => `          <li>${esc(e.sub)} <b>= ${esc(e.final)}</b></li>`).join("\n")}
        </ul>
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
