#!/usr/bin/env node
// Build /buying.html: where to buy Pokemon cards online, and what each place
// actually costs a buyer.
//
//   node scripts/build-buying.mjs
//
// Reads data/buying.json (venues and buyer-side costs) and data/buying-safety.json
// (who touched the card, who holds the money, what recourse exists). Both carry a
// source url and a read date on every claim, the standard data/grading.json set.
//
// WHY THIS PAGE EXISTS. /start.html asks "Where do I buy, and who do I buy
// from?" and answered it only with Rochester shops and a show calendar, on a
// site whose selling, grading and drops pages all assume an online answer
// exists. Somebody reading the beginner guide in order got six questions deep
// and was told to drive somewhere. This is the missing half.
//
// IT IS /selling.html POINTED THE OTHER WAY, and deliberately so. That page
// records what a venue takes from a SELLER. This one records what a venue costs
// a BUYER, which is a different set of numbers read off the same companies'
// pages: shipping thresholds instead of commissions, buyer fees instead of
// payout fees, buyer protection instead of seller protection.
//
// THE SOURCING RULE IS THE WHOLE JOB, and two figures prove why. The "$35 free
// shipping on Amazon" that every comparison site quotes appears nowhere on
// Amazon's own free shipping help page, which says "the stated minimum
// threshold of eligible items" six times and never states it. Card Kingdom's
// widely cited "$35" traces to a 2022 blog post while the company's current
// support article says $75 and Magic singles only. Both numbers are believable,
// both are repeated everywhere, and a page printing either would be wrong about
// somebody's money. So every figure here was read on the company's own
// shipping, help, policy or terms page, with the url and the read date recorded
// against it, and where a number could not be read that way it is ABSENT and
// the venue says so.
//
// THE SAFETY HALF IS MECHANISM, NOT REPUTATION, the same choice selling-safety
// made. The obvious buying page warns readers off a site. This one cannot
// source a character judgment and would not age well if it tried. What IS
// sourceable is who touched the card before you did, who is holding the money
// if it is wrong, and how many days you have.
//
// The buying side needs TWO questions where selling needed one, and that is the
// structural difference between the pages. A seller only has to ask who holds
// the money. A buyer has to ask that AND who handled the card, because the two
// have different answers at the same venue: TCGplayer holds the money on every
// order, but only on Direct did TCGplayer ever have the card in its hands. That
// is what the closing chain-of-custody section is for.
//
// NO BACKTICKS IN COMMENTS IN THIS FILE. The page below is one template literal
// and a backtick inside a comment closes it. That has broken this build three
// times in one day, which is why check-build.py now runs node --check over
// every .mjs rather than trusting anybody to remember.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";
import { brandMark, PROT_MARK, BRAND_CREDIT, BRAND_STYLE } from "../shared/brands.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const money = JSON.parse(await readFile(join(ROOT, "data/buying.json"), "utf8"));
const safe = JSON.parse(await readFile(join(ROOT, "data/buying-safety.json"), "utf8"));

let shops = 0;
try {
  shops = (JSON.parse(await readFile(join(ROOT, "data/shops.json"), "utf8")).shops || []).length;
} catch { /* the local section drops its count rather than guessing */ }

const venues = money.venues || [];
if (!venues.length) throw new Error("data/buying.json has no venues");

// Grouped by WHO OWNS THE CARD, which is the distinction that decides every
// other answer on the page. On a marketplace the card belongs to a stranger and
// the venue arbitrates afterwards. At a shop the company owns its own stock and
// answers for it directly. At retail the box is sealed and the only question
// left is whether it is still sealed.
const GROUPS = [
  {
    key: "market",
    title: "Marketplaces",
    blurb: "Thousands of sellers, one catalogue. The best prices and the most moving parts, because the card belongs to a stranger and the venue only arbitrates after it arrives.",
  },
  {
    key: "shop",
    title: "Online card shops",
    blurb: "One company owns the stock, packs it and answers for it. Fewer listings and usually a higher price, and exactly one party to argue with.",
  },
  {
    key: "retail",
    title: "Sealed product at retail",
    blurb: "Packs, boxes and tins at something near list price, from the people who make them or the chains that stock them. The hard part here is stock rather than price.",
  },
];

// READ THE FIELD, DO NOT INFER THE GROUP. build-selling.mjs learned this the
// hard way: it pattern matched on prose, and because eBay's format mentions
// auctions it filed three marketplaces under consignment. A one word field
// cannot drift like that.
const groupOf = (v) => {
  if (!v.group) throw new Error(`buying.json: venue "${v.id}" has no group`);
  if (!GROUPS.some((g) => g.key === v.group)) {
    throw new Error(
      `buying.json: venue "${v.id}" has group "${v.group}", which is not one of ${GROUPS.map((g) => g.key).join(", ")}`
    );
  }
  return v.group;
};

const STATUS = {
  sourced: { label: "Costs sourced", cls: "ok" },
  partial: { label: "Partly sourced", cls: "part" },
  unverified: { label: "Costs unverified", cls: "unv" },
};

const costRow = (f) => `        <li>
          <b>${esc(f.what)}</b> ${esc(f.rate)}
          ${f.appliesTo ? `<span class="by-on">on ${esc(f.appliesTo)}</span>` : ""}
          ${f.note ? `<span class="by-nt">${esc(f.note)}</span>` : ""}
        </li>`;

// NESTED OBJECTS NEED THEIR OWN GUARD. The top level V_KNOWN check below only
// inspects venue keys, so a renderer that guessed at the shape INSIDE one of
// them would pass every check while emitting nonsense. build-selling.mjs shipped
// exactly that bug: it read three keys that did not exist on the objects it was
// handed, and every entry collapsed to a bare integer under a bold label.
const CG_KNOWN = new Set(["grade", "definition"]);
const conditionGrade = (c) => {
  if (typeof c === "string") return `<li>${esc(c)}</li>`;
  for (const k of Object.keys(c)) {
    if (!CG_KNOWN.has(k)) throw new Error(`buying.json: conditionGrades entry has unrendered key "${k}"`);
  }
  return `<li><b>${esc(c.grade)}.</b> ${esc(c.definition || "")}</li>`;
};

// RENDER EVERY FIELD OR THROW. Research that was actually done, sourced and
// dated must not vanish because a renderer hand-listed the keys it knew about.
// That is the worst possible bug on a page like this, because nothing looks
// broken: the reader simply never sees it, while the lede promises they will.
// It has already happened once on the selling page, where five researched
// fields never reached the page on any of fourteen venues.
const V_KNOWN = new Set([
  "id", "name", "url", "type", "format", "bestFor", "status", "group", "costs",
  "stacking", "recourse", "conditionStandard", "conditionGrades", "authenticity",
  "limits", "note", "sources",
]);

const venueCard = (v) => {
  for (const k of Object.keys(v)) {
    if (!V_KNOWN.has(k)) throw new Error(`buying.json: venue "${v.id}" has unrendered key "${k}"`);
  }
  const st = STATUS[v.status] || STATUS.partial;
  const costs = Array.isArray(v.costs) ? v.costs : [];
  return `      <article class="by-v" id="${esc(v.id)}">
        <div class="by-vh">
          ${brandMark(v.id, v.name)}
          <h3>${v.url ? `<a href="${esc(v.url)}" rel="noopener" target="_blank">${esc(v.name)}</a>` : esc(v.name)}</h3>
          <span class="by-st ${st.cls}">${esc(st.label)}</span>
        </div>
        ${v.type || v.format ? `<p class="by-fmt">${[v.type, v.format].filter(Boolean).map(esc).join(". ")}</p>` : ""}
        ${v.bestFor ? `<p class="by-best"><b>Best for.</b> ${esc(v.bestFor)}</p>` : ""}
        ${costs.length ? `<ul class="by-fees">\n${costs.map(costRow).join("\n")}\n        </ul>`
          : `<p class="by-none">No cost figures here, and that is the finding rather than a gap in the research. Nothing could be read on their own pages, and a number copied from somewhere else would be a guess about your money.${
              v.url ? ` Their own site is linked above.` : ""
            }</p>`}
        ${v.stacking ? `<p class="by-stack"><b>How shipping stacks.</b> ${esc(v.stacking)}</p>` : ""}
        ${v.recourse ? `<p class="by-prot"><b>If it goes wrong.</b> ${esc(v.recourse)}</p>` : ""}
        ${v.authenticity ? `<p class="by-auth"><b>Is it real.</b> ${esc(v.authenticity)}</p>` : ""}
        ${v.conditionStandard ? `<p class="by-cond"><b>How it defines condition.</b> ${esc(v.conditionStandard)}</p>` : ""}
        ${(v.conditionGrades || []).length ? `<ul class="by-grades">${
          v.conditionGrades.map(conditionGrade).join("")
        }</ul>` : ""}
        ${(v.limits || []).length ? `<p class="by-lbl"><b>Limits and gates.</b></p><ul class="by-cond-l">${
          v.limits.map((x) => `<li>${esc(x)}</li>`).join("")
        }</ul>` : ""}
        ${v.note ? `<p class="by-nb">${esc(v.note)}</p>` : ""}
        ${(v.sources || []).length ? `<p class="by-src">${v.sources
          .map((x, i) => {
            const u = typeof x === "string" ? x : x.url;
            const what = typeof x === "string" ? "" : x.what || "";
            const read = typeof x === "string" ? "" : x.read || "";
            return u
              ? `<a href="${esc(u)}" aria-label="${esc(v.name)}${what ? `, ${esc(what)}` : ""}, source ${i + 1}" rel="noopener" target="_blank">${
                  esc(what || `Source ${i + 1}`)
                }</a>${read ? ` <span>read ${esc(longDate(read))}</span>` : ""}`
              : esc(what);
          })
          .join(" &bull; ")}</p>` : ""}
      </article>`;
};

// Same rule on the safety half, and the same failure mode if it is skipped: an
// unrecognised key stops the build until somebody decides where it goes, rather
// than being silently dropped.
const P_LABEL = {
  covers: ["Covers.", "yes"],
  doesNotCover: ["Does not cover.", "no"],
  buyerCarries: ["The buyer carries.", "no"],
  conditions: ["Only if all of these are true.", ""],
  how: ["How it works.", ""],
  clocks: ["Clocks.", ""],
  excluded: ["Excluded.", "no"],
  threshold: ["Threshold.", ""],
  cardCarveOut: ["Trading cards specifically.", ""],
  returnShipping: ["Who pays return postage.", ""],
  counterfeits: ["Counterfeits.", ""],
  returns: ["Returns.", ""],
  whoInspects: ["Who inspects the card.", ""],
};
const P_SKIP = new Set(["venue", "note", "source", "alsoRead", "read", "verifiedTwice"]);

const prot = (p) => {
  const parts = [];
  for (const [k, v] of Object.entries(p)) {
    if (P_SKIP.has(k)) continue;
    if (Array.isArray(v) && !v.length) continue;
    const spec = P_LABEL[k];
    if (!spec) throw new Error(`buying-safety.json: protection "${p.venue}" has key "${k}" with no label in P_LABEL`);
    const [label, tone] = spec;
    const head = `<p class="by-lbl${tone ? ` by-${tone}` : ""}"><b>${esc(label)}</b></p>`;
    parts.push(
      Array.isArray(v)
        ? `${head}<ul>${v.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
        : `<p class="by-nb"><b>${esc(label)}</b> ${esc(v)}</p>`
    );
  }
  const srcs = [p.source, ...(p.alsoRead || [])].filter(Boolean);
  return `      <article class="by-p">
        <div class="by-vh">
          ${brandMark(PROT_MARK[p.venue] || "", p.venue)}
          <h3>${esc(p.venue)}</h3>
        </div>
        ${p.note ? `<p class="by-nb">${esc(p.note)}</p>` : ""}
        ${parts.join("\n        ")}
        ${srcs.length ? `<p class="by-src">${srcs
          .map((u, i) => `<a href="${esc(u)}" aria-label="${esc(p.venue)} policy, source ${i + 1}" rel="noopener" target="_blank">${i ? `Source ${i + 1}` : "Source"}</a>`)
          .join(", ")}${p.read ? `, read ${esc(longDate(p.read))}` : ""}</p>` : ""}
      </article>`;
};

const nSourced = venues.filter((v) => v.status === "sourced").length;
const arith = money.theArithmetic || {};
const custody = safe.custody || {};

const desc = `Where to buy Pokemon cards online and what each place really costs. Shipping thresholds and buyer fees read off each company's own page, plus what recourse you have when a card arrives wrong.`;

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
.by-lede{max-width:46em}
.by-jump{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:var(--s5) 0 var(--s4)}
.by-jump a{display:inline-flex;align-items:center;min-height:40px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.by-jump a:hover{border-color:var(--ink);background:var(--mustard)}
.by-jg{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);margin-left:var(--s2)}
.by-jg:first-child{margin-left:0}
.by-v{scroll-margin-top:var(--s5)}
.by-key{border:3px solid var(--navy);border-radius:12px;background:var(--navy);color:var(--chrome-ink);
  padding:var(--s5);margin:var(--s5) 0;box-shadow:var(--hard-lg)}
.by-key h2{color:var(--chrome-ink);margin-bottom:var(--s3)}
.by-key p{color:var(--foot-ink);line-height:1.55;max-width:44em}
.by-key p + p{margin-top:var(--s3)}
.by-grp{margin-top:var(--s6)}
.by-grp > p{color:var(--ink-2);max-width:44em;margin-bottom:var(--s4)}
.by-vs{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4)}
@media(max-width:900px){.by-vs{grid-template-columns:1fr}}
.by-v,.by-p{border:3px solid var(--navy);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4)}
/* align-items moved from baseline to centre. The mark box is 34px tall and a
   baseline row hung it off the h3's text baseline, which dropped the tile a
   third of its own height below the heading on every card. Centre is what the
   status chip wanted anyway. */
.by-vh{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2);margin-bottom:var(--s2)}
.by-vh h3{font:400 var(--t-m)/1.15 var(--display)}
/* The four-mark box is the width of the card, so it takes its own line above
   the heading rather than trying to sit beside it. */
.by-vh .bmk-multi{flex-basis:100%}
${BRAND_STYLE}
/* THE CONFIDENCE LADDER, REBUILT WITHOUT HUE. Three things were wrong with it.
   THE BOTTOM RUNG WAS INVISIBLE. "COSTS UNVERIFIED" was --card on a white card,
   1.00:1, carried entirely by a dashed hairline. On /drops.html it was worse
   than that: "PATTERN ONLY" and "EXPECTED" differed ONLY by border-style dashed
   against solid, so two confidence levels were one border apart.
   THE TOP RUNG WAS THE ONLY GREEN ON THE SITE. #1E5B34 with an #EAF6EE label
   passes contrast at 7.73:1, so this is not a legibility fix; it is that the
   palette's stated idea is one accent hue and a green pill at the top of every
   card is a second one. Green as a deliberate semantic exception for "verified"
   would have been defensible. It was not deliberate, it was left over.
   SO THE LADDER RANKS BY WEIGHT INSTEAD OF BY COLOUR, which is what a mono
   palette has to do: solid ink, then a filled chip, then an outline. Those are
   three genuinely different amounts of ink on the page and they survive at any
   zoom, in print, and for a reader who cannot tell green from grey.
   NONE OF IT CARRIES MEANING ALONE. Every chip prints its own state in words
   next to the weight, which is why the labels are spelled out rather than
   abbreviated. */
.by-st{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  padding:5px 8px;border-radius:5px;border:1px solid var(--hair);color:var(--ink-2)}
.by-st.ok{background:var(--chrome-bg);color:var(--chrome-ink);border-color:var(--chrome-bg)}
.by-st.part{background:var(--paper-3);color:var(--ink);border-color:var(--hair)}
.by-st.unv{background:var(--paper-2);color:var(--ink);border:1.5px dashed var(--ink-2)}
.by-fmt{color:var(--ink-2);font-size:var(--t-sm);margin-bottom:var(--s2)}
.by-best,.by-stack,.by-prot,.by-auth,.by-cond,.by-nb,.by-none{font-size:var(--t-sm);line-height:1.5;margin-top:var(--s2)}
.by-nb,.by-none{color:var(--ink-2)}
.by-fees{list-style:none;margin:var(--s3) 0 0;padding:0;display:flex;flex-direction:column;gap:var(--s2)}
.by-fees li{font-size:var(--t-sm);line-height:1.45;padding-left:var(--s3);border-left:3px solid var(--gold)}
/* The FIRST cost on every venue is its shipping line, which is the number most
   readers came for, so it gets the ketchup rule instead of the gold one. The
   colour is not carrying the meaning on its own: the bold label still names it,
   which is the only reason a colour-only cue is acceptable here at all. */
.by-fees li:first-child{border-left-color:var(--ketchup)}
.by-on,.by-nt{display:block;color:var(--ink-2);font-size:var(--t-micro);margin-top:2px}
.by-p ul{margin:var(--s2) 0 0 var(--s4);font-size:var(--t-sm);line-height:1.5;color:var(--ink-2)}
.by-lbl{font-size:var(--t-sm);margin-top:var(--s3)}
/* "COVERS." AGAINST "DOES NOT COVER." was green text against --ketchup-deep,
   and after the repaint --ketchup-deep is #6E5000, the palette's own deep gold.
   So the pair was green versus gold, which is the last hue distinction on
   either page and the same leftover the status ladder above just lost.
   BOTH LABELS ALREADY SAY WHAT THEY MEAN IN WORDS, at the start of the line, so
   the colour was never carrying the meaning: it was emphasis. Ink for the
   positive and deep gold for the negative keeps the emphasis, keeps them
   distinguishable by weight and hue-within-the-palette, and adds no sixth
   colour to a black, white and gold site. */
.by-yes b{color:var(--ink)}
.by-no b{color:var(--ketchup-deep)}
.by-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s3);line-height:1.6}
.by-s1,.by-rd{font:400 var(--t-micro)/1 var(--mono);white-space:nowrap}
.by-rd{color:var(--ink-2)}
.by-grades,.by-cond-l{margin:var(--s2) 0 0 var(--s4);font-size:var(--t-sm);line-height:1.5;color:var(--ink-2)}
.by-grades li,.by-cond-l li{margin-bottom:var(--s2)}
.by-ps{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4)}
@media(max-width:900px){.by-ps{grid-template-columns:1fr}}
.by-list{margin:var(--s4) 0 0 var(--s4);max-width:46em;line-height:1.55}
.by-list li{margin-bottom:var(--s3)}
.by-list b{color:var(--ink)}
.by-chain{list-style:none;margin:var(--s4) 0 0;padding:0;max-width:46em}
.by-chain li{border-left:4px solid var(--gold);padding:0 0 0 var(--s3);margin-bottom:var(--s4);line-height:1.55}
.by-chain b{display:block;font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink-2);margin-bottom:4px}

/* DESKTOP. Every rule below is min-width only, so a phone and a tablet render
   what they rendered before. Measured identical at 390 before and after.

   This is a 13,705 word page and it was measured rather than eyeballed. At 1440
   it ran 19,602px with a median reading measure of 86 characters a line against
   a 65 to 75 target, and at 1920 it was 87.5.

   TWO SEPARATE FAULTS, and only one of them is about width.

   1. THE STANDALONE PROSE IS CAPPED IN em AND THE CAP IS TOO LOOSE. 46em and
      44em were set against the body face, and em is the FONT size, not the
      character width, so the same number gives a different count in a different
      face. Measured, 46em came out at 810px and 96 characters. ch is the width
      of a "0" in the element's own font, which is the unit that tracks the
      count. Below 1000px these caps never bind, so they are min-width gated and
      a phone cannot see them.

      50ch AND NOT 70ch, AND THE NUMBER IS MEASURED RATHER THAN ASSUMED. "1ch is
      one character" is the folk reading of the unit and it is wrong by nearly
      half in Outfit: ch is the advance width of a "0", and a digit is one of
      the widest glyphs in the face, so the average character is about 0.7 of
      it. Measured on this page, .by-key p at 72ch came out 803px wide and set
      100 characters a line, which is 1.43 characters per ch. 50ch lands around
      70. A first pass here used ch as if it were characters and left every cap
      wider than the em cap it replaced, which is worth knowing before somebody
      "corrects" 50 back up to 70.

   2. THE BLOCKS THAT ARE NOT PROSE WERE LEFT ALIGNED IN A 1,392px BAND AND JUST
      STOPPED. The key panel painted its border the full width and then set its
      text to 44em, leaving about 600px of empty navy on the right of every
      paragraph. The heading moves beside the text instead, which is the same
      rail the era sections on /expansions.html use, and the panel is then full
      of the thing it is a panel for.

   The venue cards in .by-vs are deliberately NOT touched. They are two columns
   already, they fill the band, and their 86 character measure comes from the
   type being --t-sm rather than from the column being wide: narrowing them
   would lengthen a page that is already 19,602px to fix a number that a type
   size sets. That is a call about the type scale, which belongs to whoever owns
   ui.css, and it is written up rather than made quietly here. */
@media(min-width:1000px){
  .by-lede{max-width:50ch}
  .by-grp > p{max-width:50ch}
  .by-key p{max-width:50ch}
  /* THE WORST MEASURE ON THE PAGE AND IT WAS NOT PROSE, WHICH IS WHY IT WAS
     MISSED: .by-src is the sourcing line, 11px, and it had no cap at all. Two
     of them sit directly in the wrap rather than inside a venue card, so they
     ran the full 1,392px and set 173 characters a line, peaking at 204. That is
     the highest count measured anywhere in this pass, on the one block of text
     that is the page's evidence. Capped wider than the prose because it is
     small type doing reference work rather than something read start to finish,
     but 90 characters instead of 204. */
  .by-src{max-width:64ch}
}
/* THE VOID THE CAP ABOVE MADE BIGGER, AND THE THING THAT BELONGS IN IT.
   Capping the ledes to 50ch is right for the reader and made the top of the
   page LOOK worse on its own: three paragraphs 578px wide, left aligned in a
   1,392px band, with 814px of nothing beside them. A narrower measure with
   nothing in the space it frees is half a fix.

   The venue nav goes there. It was directly underneath, thirteen chips over two
   rows, and it is the page's table of contents on a page 13,705 words long, so
   beside the introduction is where a desktop reader wants it. The intro column
   is 620px because the ledes cap at 578 and a track narrower than its content
   would just move the ragged edge. */
@media(min-width:1100px){
  .by-top{display:grid;grid-template-columns:minmax(0,620px) minmax(0,1fr);
    gap:var(--s5) var(--s6);align-items:start}
  .by-top .by-jump{margin-top:0}
  /* Two children, the heading and .by-key-body, so no explicit placement is
     needed and no row can be taller than the item in it. */
  .by-key{display:grid;grid-template-columns:300px minmax(0,1fr);
    gap:var(--s5);align-items:start}
  .by-key > h2{margin-bottom:0}
}
/* The step lists are short items, not paragraphs, so they set in two columns
   without hurting the measure and take roughly their own height off the page.
   break-inside:avoid keeps an item whole: a list item split across a column
   break reads as two items, which on a list of numbered steps is a bug.
   max-width has to go with it, or the two columns would be capped as if they
   were one. */
@media(min-width:1200px){
  .by-list,.by-chain{columns:2;column-gap:var(--s6);max-width:none}
  .by-list li,.by-chain li{break-inside:avoid}
}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Where to Buy Pokemon Cards Online, and What Each Place Costs | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/buying.html">
<meta property="og:title" content="Where to buy Pokemon cards online">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/buying.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-buying.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-buying.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
<style>${miniCSS(style)}</style>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Where to buy" },
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
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Where to buy</span></nav>
      <!-- .by-top and .by-intro are wrappers with no effect until the min-width
           rule in the style block turns .by-top into a grid, which puts the
           venue jump nav BESIDE the opening paragraphs instead of under them.
           They exist as elements because the h1, three ledes and the nav are
           otherwise flat siblings of everything else in this wrap, and a grid
           over the wrap would have to place the whole page. -->
      <div class="by-top">
      <div class="by-intro">
      <h1>Where to <span class="hl">buy</span> cards online</h1>
      <p class="lede by-lede">${venues.length} places to buy Pokemon cards, and what each one actually costs once
        shipping and buyer fees are counted. Every figure was read off the company's own shipping, help or policy
        page rather than off a comparison site: ${nSourced} are fully sourced and the rest say which number is
        missing and where to go and look.</p>
      <p class="lede by-lede">One example of why that matters, and it is the reason this page exists in the shape it
        does. Everybody quotes a $35 free shipping threshold for Amazon. Amazon's own free shipping help page says
        "the stated minimum threshold of eligible items" six times and never states the number. So this page tells
        you the rule and sends you to your own cart for the figure, which is annoying and true, rather than
        confident and possibly wrong.</p>
      <p class="lede by-lede">This is <a href="/selling.html">where to sell</a> pointed the other way. Same
        companies, different set of numbers, and the buyer's protection is usually the bigger one. Prices and
        policies move: every figure here carries the date it was read.</p>
      </div>

      <nav class="by-jump" aria-label="Jump to a venue">
${GROUPS.map((g) => {
  const list = venues.filter((v) => groupOf(v) === g.key);
  return list.length
    ? `        <span class="by-jg">${esc(g.title)}</span>\n${list
        .map((v) => `        <a href="#${esc(v.id)}">${esc(v.name)}</a>`)
        .join("\n")}`
    : "";
}).filter(Boolean).join("\n")}
      </nav>
      </div>

      <div class="by-key">
        <h2>The two questions that decide how a purchase can go wrong</h2>
        <!-- The paragraphs are wrapped so the heading can sit beside ALL of
             them rather than beside the first one. Left as flat siblings in a
             two column grid, the heading takes row 1 column 1 and paragraph one
             takes row 1 column 2, so the row is as tall as the taller of the
             two and a gap opens under whichever is shorter. Measured, the three
             line heading left a 40px hole under the first paragraph. One
             wrapper is one grid item and the problem does not exist. -->
        <div class="by-key-body">
        <p>${esc(safe.framing.question)} Neither one is answered by how well known the site is.</p>
        ${(safe.framing.why || []).map((w) => `<p>${esc(w)}</p>`).join("\n        ")}
        </div>
      </div>
${(() => {
  // NOTHING ANYWHERE CHECKED THAT EVERY VENUE ACTUALLY REACHED THE PAGE. The
  // section loop filters by group, so a venue in no matching section is simply
  // absent, with a clean build and no error. groupOf validates the value above
  // and this counts the result anyway, because the two failures are different:
  // one catches a bad value, this catches a venue lost for any reason at all.
  const placed = GROUPS.reduce((n, g) => n + venues.filter((v) => groupOf(v) === g.key).length, 0);
  if (placed !== venues.length) {
    throw new Error(`buying.json: ${venues.length} venues but ${placed} rendered`);
  }
  return "";
})()}
${GROUPS.map((g) => {
  const list = venues.filter((v) => groupOf(v) === g.key);
  if (!list.length) return "";
  return `      <section class="by-grp">
        <h2>${esc(g.title)}</h2>
        <p>${esc(g.blurb)}</p>
        <div class="by-vs">
${list.map(venueCard).join("\n")}
        </div>
      </section>`;
}).filter(Boolean).join("\n")}

${arith.claim ? `      <section class="by-grp">
        <h2>The cheapest card is not the cheapest <span class="hl">order</span></h2>
        <p class="by-lede">${esc(arith.claim)}</p>
        <ul class="by-list">
${(arith.because || []).map((b) => `          <li>${esc(b)}</li>`).join("\n")}
        </ul>
        ${arith.note ? `<p class="by-lede" style="margin-top:var(--s4)">${esc(arith.note)}</p>` : ""}
      </section>` : ""}

      <section class="by-grp">
        <h2>Who protects a <span class="hl">buyer</span></h2>
        <p>Buyer protection and seller protection are different products, and the buyer's version is generally the
          bigger one. What varies most is not whether you are covered, it is how long you have, and trading cards
          get a shorter clock than almost anything else at the venues that publish a carve-out.</p>
        <div class="by-ps">
${(safe.protections || []).map(prot).join("\n")}
        </div>
      </section>

      <section class="by-grp">
        <h2>How it actually goes <span class="hl">wrong</span></h2>
        <p>Each of these is a mechanism rather than a type of person, and the first one is not a scam at all. Every
          one is defined by who had the card and who had the money at which moment.</p>
        <ol class="by-list">
${(safe.attacks || []).map((a) => `          <li><b>${esc(a.name)}.</b> ${esc(a.how)}${a.why ? ` ${esc(a.why)}` : ""}${a.note ? ` ${esc(a.note)}` : ""}${
            a.source ? ` <a class="by-s1" href="${esc(a.source)}" aria-label="Source for ${esc(a.name)}" rel="noopener" target="_blank">Source</a>${
              a.read ? ` <span class="by-rd">read ${esc(longDate(a.read))}</span>` : ""
            }` : ""
          }</li>`).join("\n")}
        </ol>
      </section>

      <section class="by-grp">
        <h2>What actually <span class="hl">defends</span> against it</h2>
        <ol class="by-list">
${(safe.defences || []).map((d) => `          <li><b>${esc(d.name)}.</b> ${esc(d.why || "")}${
            (d.thresholds || []).length ? ` ${d.thresholds.map(esc).join(" ")}` : ""
          }${
            d.source ? ` <a class="by-s1" href="${esc(d.source)}" aria-label="Source for ${esc(d.name)}" rel="noopener" target="_blank">Source</a>${
              d.read ? ` <span class="by-rd">read ${esc(longDate(d.read))}</span>` : ""
            }` : ""
          }</li>`).join("\n")}
        </ol>
      </section>

${custody.claim ? `      <section class="by-grp">
        <h2>Who <span class="hl">touched</span> the card before you did</h2>
        <p class="by-lede">${esc(custody.claim)}</p>
        <ul class="by-chain">
${(custody.chain || []).map((c) => `          <li><b>${esc(c.who)}</b> ${esc(c.what)}</li>`).join("\n")}
        </ul>
        ${custody.cost ? `<p class="by-lede" style="margin-top:var(--s4)"><b>What the short chain costs you.</b> ${esc(custody.cost)}</p>` : ""}
        ${custody.note ? `<p class="by-lede" style="margin-top:var(--s3)">${esc(custody.note)}</p>` : ""}
      </section>` : ""}

      <section class="by-grp">
        <h2>The chain with no links in it at <span class="hl">all</span></h2>
        <p class="by-lede">Every venue above ends with a package. A counter does not. You look at the card, you hand
          over money, and the transaction is finished before you leave: nothing to ship, no claim window, nobody to
          wait on and no clock to miss.${
            shops ? ` This site already publishes <a href="/shops.html">${shops} shops around Rochester</a> and a
            <a href="/card-shows.html">card show calendar</a>.` : ""
          } What it costs is selection, which is the same trade as everything else on this page.</p>
        <p class="by-lede" style="margin-top:var(--s3)">Two companion pages rather than repeats of them here. For
          sealed product the question this page does not answer is <em>when</em> the chains have stock, and that is
          <a href="/drops.html">what is dropping this week</a>. And before you pay for anything raw and expensive
          from a stranger, or open a box whose seal looks tired, the checks on
          <a href="/fake-cards.html">real or fake</a> are the ones you can do with the thing in your hands. Resealed
          packs live there, because a return policy cannot answer a physical question.</p>
      </section>

      <p class="by-src" style="margin-top:var(--s6)">Shipping thresholds, buyer fees and return policies read from
        each company's own pages${money.checked ? ` on ${esc(longDate(money.checked))}` : ""}. Buyer protection and
        the failure mechanics read${safe.checked ? ` on ${esc(longDate(safe.checked))}` : ""} from the platforms' own
        policies. Nothing here came from a comparison site or a coupon site. This is not financial advice, policies
        change, and every number on this page is worth ten seconds of checking before you spend anything on it.</p>
      <p class="by-src">${BRAND_CREDIT}</p>
    </div>
  </section>
</main>
${footer()}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/buying.html"), page);
console.log(`Wrote public/buying.html
  ${venues.length} venues (${nSourced} fully sourced), ${(safe.protections || []).length} buyer protection policies,
  ${(safe.attacks || []).length} mechanisms, ${(safe.defences || []).length} defences`);
