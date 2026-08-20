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
import { esc, longDate, plateRule, PLATE_CSS } from "../shared/format.mjs";
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
    blurb: "Thousands of sellers, one catalog. The best prices and the most moving parts, because the card belongs to a stranger and the venue only arbitrates after it arrives.",
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

// The bare host, for the "opens on <host>" half of an outbound aria-label.
// Falls back to the empty string rather than throwing: a malformed url in the
// data should cost a label, not the build. Same helper as build-shows.mjs.
//
// THE VENUE HEADING WAS THE ONE OUTBOUND LINK ON A CARD WITH NO aria-label,
// which CLAUDE.md makes the condition of every outbound link on the site, and
// its every-row-a-source siblings underneath it all had one. It is the link that
// makes the card checkable: it goes to the venue's own fees page, which is where
// every figure on the card was read from, so a reader who wants to know whether
// a fee has moved has nowhere else to go. Naming that inside the label is worth
// more than the outbound warning on its own.
const hostOf = (u) => {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const venueCard = (v) => {
  for (const k of Object.keys(v)) {
    if (!V_KNOWN.has(k)) throw new Error(`buying.json: venue "${v.id}" has unrendered key "${k}"`);
  }
  const st = STATUS[v.status] || STATUS.partial;
  const costs = Array.isArray(v.costs) ? v.costs : [];
  return `      <article class="by-v" id="${esc(v.id)}">
        <div class="by-vh">
          ${brandMark(v.id, v.name)}
          <h3>${v.url ? `<a href="${esc(v.url)}" rel="noopener" target="_blank" aria-label="${esc(v.name)}'s own shipping and fees page, where the figures on this card were read, opens on ${esc(hostOf(v.url))}">${esc(v.name)}</a>` : esc(v.name)}</h3>
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
            // The label is a LIST, so its parts are comma separated, and half
            // of these what-clauses are full sentences ending in a period.
            // That produced "shows edits on 17 June 2026., source 1" in 22
            // aria-labels across this page and its sibling. Trim the stop off
            // the clause, never off the visible link text below, which is a
            // sentence and keeps its punctuation.
            const clause = what.replace(/\.\s*$/, "");
            return u
              ? `<a href="${esc(u)}" aria-label="${esc(v.name)}${clause ? `, ${esc(clause)}` : ""}, source ${i + 1}" rel="noopener" target="_blank">${
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

// ============================================================================
// TWO MORE CHARTS, AND THE SAME TEST WAS APPLIED TO BOTH: does the picture say
// something no sentence on the page says. A figure that repeats the paragraph
// beside it is weight.
//
// THE SHARED MACHINERY. Every number either chart draws is parsed out of the
// exact string the page prints, and the build throws with the venue, the label,
// the pattern and the text that is there now when a sentence moves. Zeroes and
// absences are asserted the same way, because "Amazon does not publish a
// number" is the flagship claim of this entire page and a chart drawing it as a
// blank is making that claim in a picture.
const costOf = (id, whatRe) => {
  const v = venues.find((x) => x.id === id);
  if (!v) throw new Error(`build-buying: a chart needs venue "${id}" and data/buying.json has no such id.`);
  const c = (v.costs || []).find((x) => whatRe.test(x.what));
  if (!c) {
    throw new Error(
      `build-buying: a chart needs the cost on "${id}" whose label matches ${whatRe}, and none has one. ` +
        `Labels present: ${(v.costs || []).map((x) => JSON.stringify(x.what)).join(", ")}.`
    );
  }
  return c;
};
const costNum = (id, whatRe, rateRe, what) => {
  const c = costOf(id, whatRe);
  const m = rateRe.exec(c.rate);
  if (!m) {
    throw new Error(
      `build-buying: the free shipping chart reads ${what} off "${c.what}" on ${id} in data/buying.json, and that ` +
        `line no longer matches ${rateRe}. It now reads: ${JSON.stringify(c.rate)}. Do not ship a chart whose ` +
        `numbers are not the ones printed beside it: restore the line, or update the regex and the chart together.`
    );
  }
  const n = Number(m[1]);
  if (!(n > 0)) throw new Error(`build-buying: ${what} on ${id} parsed to ${m[1]}, which is not a threshold.`);
  return n;
};
const assertCost = (id, whatRe, rateRe, why) => {
  const c = costOf(id, whatRe);
  if (!rateRe.test(c.rate)) {
    throw new Error(
      `build-buying: the free shipping chart draws ${id} as having no threshold because ${why}, and "${c.what}" ` +
        `no longer says so. It now reads: ${JSON.stringify(c.rate)}. A stated absence that stopped being true is ` +
        `worse than a missing chart, so the build stops here.`
    );
  }
};

// ============================================================================
// THE FREE SHIPPING LADDER.
//
// WHY THIS IS THE PAGE'S OWN PICTURE AND NOT A GENERIC COMPARISON TABLE. The
// lede promises two things: that every figure was read off the company's own
// page, and that where no figure could be read the page says so instead of
// borrowing one. Ten venue cards each carry their own threshold and nothing
// anywhere lines them up, so the reader cannot see either promise being kept.
// Drawn on one axis, the ladder runs from $20 to $199 and the four venues with
// no rung sit underneath in the site's own no-art hatch with the reason
// written where the money would be. That second group is the honesty policy as
// a picture, which is the only reason a chart of eight numbers earns its space
// on a page this long.
//
// THE BIG BOX ROW IS THE ONE FINDING NOBODY WROTE DOWN: Target, Walmart and
// Best Buy have all landed on exactly $35 and the page never says so, because
// the three sentences that contain it are three bullets inside one venue card.
// Three identical bars say it instantly.
//
// SINGLES ORDERS ONLY, and the caption says so. Two of these shops charge a
// different and much higher threshold on anything containing sealed product,
// which is a real number and a different question; mixing the two would draw
// Card Cavern at both $20 and $100 in one column and mean neither.
//
// AND THE ROWS CARRY THE COMPANY'S MARK, WHICH IS WHY THIS IS HTML AND NOT AN
// SVG. It was an SVG first and it read fine, but a chart whose rows are twelve
// named retailers is the exact place the owner asked for their logos: "for the
// buying and selling pages, lets add in the brands logos though, like best buy,
// amazon, target". Reaching them from inside an SVG means <image href> per row,
// which is a request each, not lazy, and outside the mark box every other row on
// this page uses. In HTML the rows reuse brandMark() unchanged, so the ladder is
// the same component as the venue cards and a name with no Commons mark gets the
// same hatched name tile it gets everywhere else. The bars are divs with a width
// percentage, which also drops the viewBox scaling problem the SVG had.
//
// NINE OF THE TWELVE ROWS RESOLVE TO A REAL MARK. Target, Walmart, Best Buy,
// Costco, TCGplayer, Amazon, eBay, Whatnot and The Pokemon Company all have one;
// Card Cavern, CoolStuffInc and Dave and Adam's do not exist on Commons and get
// the name tile, which is the finding rather than a gap. brandMark decides that,
// not this file, so there is one place to change it.
const FREE = [
  { id: "card-cavern", label: "Card Cavern", v: costNum("card-cavern", /^Shipping, singles, packs and supplies$/, /FREE if the order total exceeds \$(\d+)\b/, "Card Cavern's singles threshold") },
  { id: "pokemon-center", label: "Pokemon Center", v: costNum("pokemon-center", /^Shipping$/, /FREE standard shipping at \$(\d+) or more/, "Pokemon Center's threshold") },
  { id: "coolstuffinc", label: "CoolStuffInc", v: costNum("coolstuffinc", /^Shipping, singles-only orders$/, /FREE at \$(\d+) or more/, "CoolStuffInc's singles threshold") },
  { id: "target", label: "Target", v: costNum("big-box", /^Target shipping$/, /FREE at \$(\d+) or more/, "Target's threshold") },
  { id: "walmart", label: "Walmart", v: costNum("big-box", /^Walmart shipping$/, /below-order-minimum fee of \$6\.99 under \$(\d+)/, "Walmart's order minimum") },
  { id: "bestbuy", label: "Best Buy", v: costNum("big-box", /^Best Buy shipping$/, /orders of \$(\d+) and up/, "Best Buy's threshold") },
  { id: "tcgplayer", label: "TCGplayer Direct", v: costNum("tcgplayer", /^Direct shipping$/, /FREE on US Direct orders over \$(\d+)/, "TCGplayer Direct's threshold") },
  { id: "dave-and-adams", label: "Dave and Adam's", v: costNum("dave-and-adams", /^Shipping$/, /Over \$(\d+): FREE/, "Dave and Adam's threshold") },
].sort((a, b) => a.v - b.v);

const NOFREE = [
  { label: "Amazon", why: "not published", id: "amazon" },
  { label: "Costco", why: "priced per item", id: "costco" },
  { label: "eBay", why: "set by the seller", id: "ebay" },
  { label: "Whatnot", why: "priced by weight", id: "whatnot" },
];
assertCost("amazon", /^Free shipping threshold$/, /NOT PUBLISHED AS A NUMBER/, "Amazon states a threshold exists and never states the number");
assertCost("big-box", /^Costco shipping$/, /No order-total threshold exists/, "Costco prices shipping per item instead");
assertCost("ebay", /^Shipping$/, /^Set by the seller/, "every eBay listing sets its own");
assertCost("whatnot", /^Shipping, USPS Ground Advantage$/, /^Up to 4oz \$/, "Whatnot prices by weight rather than by order total");

/**
 * One chart row: the company's mark, its name, a track, and the number.
 *
 * THE NUMBER IS TEXT IN THE ROW AND THE BAR IS DECORATIVE. A bar chart whose
 * value exists only as a length is unreadable to a screen reader and unreadable
 * to anybody at a glance, so the figure works with the bars removed: every row
 * prints its own figure next to its own name. That is also why the track sits on
 * its own line under the name rather than in a column beside it, which is what
 * lets the marks be marks instead of 20px thumbnails.
 */
// THE NAME TILE IS DROPPED IN A CHART ROW, and only here. brandMark falls back
// to the venue's name set in the site's mono for the nine venues Commons holds
// nothing for, which is right on a venue card, where the tile is the only thing
// occupying the slot every other card fills with a logo. In a chart row the
// name is already printed an inch to the right, so the tile is the word twice
// and once at a size that broke "CoolStuffInc" over two lines inside a 96px box.
// A row with no mark simply starts with its name. The bar tracks are full width
// and start at the same x either way, so nothing goes out of alignment.
const chartMark = (id, label) => {
  const m = brandMark(id, label);
  return m.includes("bmk-n") ? "" : m;
};
const chartRow = (id, label, valueHtml, pct, barCls, sub = "") => `          <li>
            <span class="bch-h">${chartMark(id, label)}<span class="bch-n">${esc(label)}${
              sub ? ` <span class="bch-s">${esc(sub)}</span>` : ""
            }</span><b class="bch-v">${valueHtml}</b></span>
            <span class="bch-t" aria-hidden="true"><span class="bch-b ${barCls}" style="width:${pct}%"></span></span>
          </li>`;

const freeChart = () => {
  const MAX = Math.max(...FREE.map((r) => r.v));
  return `      <figure class="pg pg-fs">
        <ul class="bch">
${FREE.map((r) => chartRow(r.id, r.label, `$${r.v}`, +((r.v / MAX) * 100).toFixed(1), "fs-b")).join("\n")}
        </ul>
        <p class="bch-head">No threshold to draw, and why</p>
        <ul class="bch bch-z">
${NOFREE.map((r) => chartRow(r.id, r.label, `<span class="bch-none">${esc(r.why)}</span>`, 14, "fs-z")).join("\n")}
        </ul>
        <figcaption>What an order of singles has to reach before shipping stops costing anything, read off each
          company's own shipping or help page${money.checked ? ` on ${esc(longDate(money.checked))}` : ""}.
          Three chains have landed on the same ${esc(
            String(FREE.filter((r) => ["Target", "Walmart", "Best Buy"].includes(r.label))[0].v)
          )} dollar number and none of them says so out loud.
          Walmart's is the same threshold stated backwards, as a fee under it rather than free shipping over it, and
          both Target and Best Buy waive theirs entirely for members. Sealed product is a different and much higher
          number at two of these shops, on their own cards below.
          <b>The bottom four are the point of this page.</b> Amazon's own free shipping help page says "the stated
          minimum threshold of eligible items" six times and never states it, which is why this site sends you to
          your own cart instead of printing the $35 that every comparison site quotes.</figcaption>
      </figure>`;
};

// ============================================================================
// THE CLOCK.
//
// The protections section opens by saying that what varies most is not whether
// you are covered but how long you have, and that cards get a shorter clock
// than almost anything else where a carve-out is published. That sentence is
// the strongest claim on the safety half of the page and it is supported by
// three numbers buried in three different policy cards, one of which is inside
// a 290 word paragraph. Two bars per venue and the claim is simply visible:
// eBay's general window is 30 days and its trading card window is 3, so the
// card bar is a tenth of the length of the one beside it.
//
// THE TCGPLAYER ROW IS DRAWN EVEN THOUGH ITS TWO BARS ARE IDENTICAL, and that
// is the honest half of the chart rather than a wasted row. A venue with no
// carve-out is the control: without it the picture reads as "cards are always
// treated worse" instead of "these two venues treat cards worse and this one
// does not".
const protOf = (name) => {
  const p = (safe.protections || []).find((x) => x.venue === name);
  if (!p) {
    throw new Error(
      `build-buying: the claim window chart needs the protection called ${JSON.stringify(name)} and ` +
        `data/buying-safety.json has: ${(safe.protections || []).map((x) => JSON.stringify(x.venue)).join(", ")}.`
    );
  }
  return p;
};
const days = (name, field, re, what, idx = 0) => {
  const p = protOf(name);
  const hay = Array.isArray(p[field]) ? p[field][idx] : p[field];
  const m = re.exec(hay || "");
  if (!m) {
    throw new Error(
      `build-buying: the claim window chart reads ${what} off ${JSON.stringify(name)}'s ${field} in ` +
        `data/buying-safety.json, and that sentence no longer matches ${re}. It now reads: ` +
        `${JSON.stringify(hay || null)}. Restore the sentence, or update the regex and the chart together.`
    );
  }
  const n = Number(m[1]);
  if (!(n > 0)) throw new Error(`build-buying: ${what} parsed to ${m[1]}, which is not a number of days.`);
  return n;
};

const CLOCKS = [
  {
    id: "ebay",
    name: "eBay",
    general: days("eBay Money Back Guarantee", "cardCarveOut", /Every other category gets (\d+)/, "eBay's general return window"),
    cards: days("eBay Money Back Guarantee", "cardCarveOut", /no later than (\d+) CALENDAR DAYS after/, "eBay's trading card return window"),
    note: "if the seller offers no returns",
  },
  {
    id: "whatnot",
    name: "Whatnot",
    general: days("Whatnot", "cardCarveOut", /(\d+) days from delivery, so cards lose/, "Whatnot's general delivery-side window"),
    cards: days("Whatnot", "cardCarveOut", /(\d+) DAYS FROM DELIVERY/, "Whatnot's trading card window"),
    note: "counted from delivery",
  },
  {
    id: "tcgplayer",
    name: "TCGplayer",
    general: days("TCGplayer", "clocks", /^(\d+) calendar days after the ESTIMATED delivery date/, "TCGplayer's claim window"),
    cards: days("TCGplayer", "clocks", /^(\d+) calendar days after the ESTIMATED delivery date/, "TCGplayer's claim window"),
    note: "no card carve-out",
  },
];

/**
 * Two bars per venue: what everything else gets, and what a card gets.
 *
 * Same HTML rows and the same mark box as the ladder above, for the same reason.
 * All three venues here have a real Commons mark, so this figure is a logo wall
 * that happens to be a chart, which is what makes it findable when a reader is
 * scrolling for the one venue they bought from.
 */
const clockChart = () => {
  const MAX = Math.max(...CLOCKS.flatMap((c) => [c.general, c.cards]));
  const pc = (d) => +((d / MAX) * 100).toFixed(1);
  return `      <figure class="pg pg-ck">
        <ul class="bch bch-2">
${CLOCKS.map((c) => `          <li>
            <span class="bch-h">${chartMark(c.id, c.name)}<span class="bch-n">${esc(c.name)} <span class="bch-s">${esc(c.note)}</span></span></span>
            <span class="bch-r"><span class="bch-t" aria-hidden="true"><span class="bch-b ck-g" style="width:${pc(c.general)}%"></span></span><b class="bch-v ck-gv">${c.general} days, other items</b></span>
            <span class="bch-r"><span class="bch-t" aria-hidden="true"><span class="bch-b ck-c" style="width:${pc(c.cards)}%"></span></span><b class="bch-v">${c.cards} days, a card</b></span>
          </li>`).join("\n")}
        </ul>
        <figcaption>The delivery-side clock, in days, on the venues that publish one. The dark bar is what a trading
          card gets and the light bar is what the same venue gives everything else.
          ${esc(CLOCKS[0].name)}'s card window applies when the seller offers no returns, and it is
          ${esc(String(Math.round(CLOCKS[0].general / CLOCKS[0].cards)))} times shorter than the window on anything
          in any other category. ${esc(CLOCKS[2].name)} publishes no card carve-out at all, which is why its two bars
          are the same length. These are the windows to OPEN a claim, not how long a case then takes. Read from each
          platform's own policy${safe.checked ? ` on ${esc(longDate(safe.checked))}` : ""}, and the full wording is on
          the cards below.</figcaption>
      </figure>`;
};

// ============================================================================
// THE POSTAGE CHART, on the one section of a 13,700 word page whose subject is
// a QUANTITY rather than a rule.
//
// "The cheapest card is not the cheapest order" is the page's own headline and
// the six bullets under it are correct and completely unpicturable, with one
// exception: they contain a worked example. Twelve cards from twelve stores,
// TCGplayer's $1.49 floor, and Direct's $3.99 for the whole package. Three
// numbers that are only an argument once you see them next to each other, and
// prose can only put them one after another.
//
// EVERY NUMBER IS PARSED OUT OF THE SENTENCES IT DRAWS, never typed in beside
// them, and the build throws rather than shipping a chart that disagrees with
// the copy above it. Same discipline as the centering diagram in
// build-grade-check.mjs and for the same reason: this site does not publish a
// figure it cannot trace, and a picture is a figure.
//
// THE MULTIPLICATION IS THE ONLY DERIVED NUMBER and the caption shows its
// working, "12 x $1.49", so a reader can check it in their head. That is the
// same standard the set guides' checklist arithmetic is held to. It is not a
// prediction: TCGplayer publishes the floor and the claim above states the cart.
//
// NOT A RECOMMENDATION. The bullets are careful that Direct has real trade-offs
// (sub-$0.40 cards round up, damaged cards are not eligible) and the chart would
// be dishonest if it read as "use Direct". The caption says so and points at the
// bullet rather than repeating it.
const ARITH_TEXT = [arith.claim, ...(arith.because || [])].join("  ");
const WORDNUM = { twelve: 12, eleven: 11, ten: 10, nine: 9, eight: 8 };
const grab = (re, what) => {
  const m = re.exec(ARITH_TEXT);
  if (!m) {
    throw new Error(
      `build-buying: the postage chart takes ${what} out of theArithmetic in data/buying.json and ` +
        `that sentence no longer matches ${re}. Do not ship a chart whose numbers are not the ones ` +
        `printed beside it: either restore the sentence or update the regex and the chart together.`
    );
  }
  return m[1];
};
const CART = WORDNUM[grab(/cart of ([a-z]+) cheap commons/i, "the size of the example cart").toLowerCase()];
const FLOOR = Number(grab(/floor for an order under \$5 from a seller is \$(\d+(?:\.\d{2})?)/i, "TCGplayer's per seller shipping floor"));
const DIRECT = Number(grab(/ship as one package however many sellers are involved, at \$(\d+\.\d{2})/i, "the TCGplayer Direct shipping rate"));
if (!CART || !(FLOOR > 0) || !(DIRECT > 0)) {
  throw new Error(
    `build-buying: postage chart parsed cart=${CART}, floor=${FLOOR}, direct=${DIRECT}. All three have ` +
      `to be real numbers or the bars are drawn against nothing.`
  );
}

/**
 * Three bars: the same twelve cards bought three ways.
 *
 * REBUILT ON THE SAME .bch ROWS AS THE OTHER TWO CHARTS on 16 August 2026. It
 * was an inline SVG with its text in viewBox units and it read fine on its own,
 * but two more figures landed on this page and the three no longer looked like
 * one set: the SVG drew a 20 unit bar with no track and a 13 unit label, which
 * at the 328px this panel gets on a phone renders chunkier and larger than the
 * 12px tracked bars above it. Three charts in three bar styles on one page reads
 * as three accidents. Nothing about the numbers or their guards changed.
 *
 * NO MARK ON THESE ROWS, unlike the other two charts. All three rows are the
 * same company in three configurations, so the same logo three times would be
 * decoration rather than a way of telling the rows apart.
 */
const postageChart = () => {
  const rows = [
    { label: `${CART} cards, ${CART} different sellers`, v: +(CART * FLOOR).toFixed(2), cls: "pg-bad" },
    { label: `${CART} cards, all from one seller`, v: FLOOR, cls: "pg-ok" },
    { label: "TCGplayer Direct, one package", v: DIRECT, cls: "pg-good" },
  ];
  const MAX = Math.max(...rows.map((r) => r.v));
  // NOT named `money`: that is the whole of data/buying.json two scopes up, and
  // shadowing it here is how the caption below lost its source date.
  const usd = (n) => `$${n.toFixed(2)}`;
  return `      <figure class="pg">
        <ul class="bch">
${rows
  .map(
    (r) => `          <li>
            <span class="bch-h"><span class="bch-n">${esc(r.label)}</span><b class="bch-v">${usd(r.v)}</b></span>
            <span class="bch-t" aria-hidden="true"><span class="bch-b ${r.cls}" style="width:${
              +((r.v / MAX) * 100).toFixed(1)
            }%"></span></span>
          </li>`
  )
  .join("\n")}
        </ul>
        <figcaption>Postage only, on one order of ${CART} cheap cards. The top bar is
          ${CART} &times; ${usd(FLOOR)}, TCGplayer's published floor for an order under $5 from a seller,
          because a flat fee per store is ${CART} fees when the cards come from ${CART} stores. The bottom
          one is Direct's ${usd(DIRECT)} for the whole package. Both figures are TCGplayer's own, from the
          shipping page linked in its card above, read ${esc(longDate(money.checked) || "")}. Direct is not
          free of trade-offs and the list above says which; this only draws the postage.</figcaption>
      </figure>`;
};

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
/* THE FIGURE PANEL, shared by all three charts on this page. */
.pg{margin:var(--s4) 0 var(--s5);border:3px solid var(--keyline);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4)}
/* Three fills on the postage chart, darkest for the worst outcome. They are
   tones of the site's own palette rather than a red/green pair: the list under
   that chart is careful that the cheapest bar has real trade-offs, and a green
   bar would argue with it. */
.pg-bad{background:var(--ink)}
.pg-ok{background:var(--trubbish)}
.pg-good{background:var(--gold)}
/* THE BAR ROWS. Used by the free shipping ladder and the claim window chart,
   which are HTML rather than SVG so that every row can carry the company's own
   mark in the same .bmk box the venue cards use. The argument is written out
   above freeChart in this file.

   THE TRACK IS ON ITS OWN LINE UNDER THE NAME, not in a column beside it. A
   three column row (mark, name, track) at 390px leaves the track about 150px
   wide with a 124px mark box beside it, and a 20px difference between two bars
   is not a picture. Full width tracks also mean every bar on the page starts at
   the same x and is measured against the same length, which is the only thing
   making them comparable. */
.bch{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--s3)}
.bch li{display:flex;flex-direction:column;gap:5px}
.bch-h{display:flex;align-items:center;gap:var(--s2);flex-wrap:wrap}
.bch-n{font:700 var(--t-sm)/1.2 var(--body);color:var(--ink)}
.bch-s{font:400 var(--t-micro)/1.2 var(--mono);color:var(--ink-2)}
.bch-v{margin-left:auto;font:700 var(--t-sm)/1 var(--mono);color:var(--ketchup-deep);white-space:nowrap}
.bch-none{font-weight:400;color:var(--ink-2)}
.bch-t{display:block;height:12px;border-radius:3px;background:var(--paper-2);
  box-shadow:inset 0 0 0 1px var(--hair)}
.bch-b{display:block;height:100%;border-radius:3px;min-width:3px}
.bch-head{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);margin:var(--s4) 0 var(--s3);padding-top:var(--s3);border-top:1px solid var(--hair)}
/* The mark box shrinks a little in a chart row: at the venue card's 124px cap a
   twelve row ladder is a column of logos with a chart hiding behind it. */
.bch .bmk{height:30px;min-width:52px;max-width:112px;padding:3px 7px}
.fs-b{background:var(--gold)}
/* THE SITE'S OWN NO-ART HATCH, the same 45 degree one .bmk-n gives a venue with
   no mark and .set-noart gives a set with no logo. A reader who has seen it
   elsewhere already knows it means "there is no picture of this", so four
   hatched stubs read as a stated absence rather than as four broken bars. */
.fs-z{background:repeating-linear-gradient(45deg,var(--paper-3) 0 6px,var(--paper-2) 6px 12px);
  box-shadow:inset 0 0 0 1px var(--ink-2)}
/* Two tracks per venue on the clock chart, each with its own number. */
.bch-2 li{gap:6px}
.bch-r{display:flex;align-items:center;gap:var(--s2)}
.bch-r .bch-t{flex:1 1 auto}
.bch-r .bch-v{margin-left:0;flex:none;font-weight:700}
.ck-gv{color:var(--ink-2);font-weight:400}
/* Weight, not hue: the card window is solid ink and the general one is the
   page's paper tone with a hairline, which is the same ranking-by-ink the
   status chips use. Both bars print their own number in words beside them, so
   nothing here is carried by fill alone. */
.ck-g{background:var(--paper-3);box-shadow:inset 0 0 0 1px var(--hair)}
.ck-c{background:var(--ink)}
.pg figcaption{font-size:var(--t-sm);line-height:1.55;color:var(--ink-2);margin-top:var(--s4);max-width:52ch}
.pg figcaption b{color:var(--ink);display:block;margin-top:var(--s3)}
.by-jump{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:var(--s5) 0 var(--s4)}
/* min-height 44, not 40. WCAG 2.5.5 asks for 44x44 and these chips are the
   page's primary navigation on a phone: they are the only way to reach a
   section without scrolling the whole article. Measured 40px before this, so
   they already cleared 2.5.8's 24px AA floor -- this is the AAA target, taken
   because a one-handed reader thumbing down the page hits these first.
   THE GAP IS UNTOUCHED AND HAS TO STAY THAT WAY: the parent sets gap:8px,
   which is row AND column gap, so growing the box does not close the 8px
   between two chips or between two wrapped rows. Re-measured after: 44px tall,
   still 8px apart in both axes. */
.by-jump a{display:inline-flex;align-items:center;min-height:44px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.by-jump a:hover{border-color:var(--ink);background:var(--mustard);color:var(--on-accent)}
.by-jg{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);margin-left:var(--s2)}
.by-jg:first-child{margin-left:0}
.by-v{scroll-margin-top:var(--s5)}
.by-key{border:3px solid var(--keyline);border-radius:12px;background:var(--band-bg);color:var(--chrome-ink);
  padding:var(--s5);margin:var(--s5) 0;box-shadow:var(--hard-lg)}
.by-key h2{color:var(--chrome-ink);margin-bottom:var(--s3)}
.by-key p{color:var(--foot-ink);line-height:1.55;max-width:44em}
.by-key p + p{margin-top:var(--s3)}
.by-grp{margin-top:var(--s6)}
.by-grp > p{color:var(--ink-2);max-width:44em;margin-bottom:var(--s4)}
.by-vs{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4)}
@media(max-width:900px){.by-vs{grid-template-columns:1fr}}
.by-v,.by-p{border:3px solid var(--keyline);border-radius:12px;background:var(--card);
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
     but 90 characters instead of 204. MEASURED AGAIN 16 August 2026 by walking
     the text nodes with a Range: 64ch was setting 93 REAL characters, because
     one ch is running about 1.5 of them at this size. 56ch lands on 80. */
  .by-src{max-width:56ch}
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
  /* THE FIGURES GO TWO COLUMN, bars on the left and the caption beside them.
     Measured at 1440, a figure filling the 1,392px wrap stretched every bar
     track to 1,340px and parked its dollar figure 1,300px from the label it
     belongs to, with the 45ch caption underneath leaving about 950px of empty
     panel beside it. That is the key panel's old fault in a smaller box, and it
     has the same answer: put the thing that was underneath beside it. The
     caption spans every row so it does not stripe against the bar groups, and
     the ladder's three blocks (bars, rule, absences) all stay in column one. */
  .pg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,380px);
    gap:var(--s4) var(--s5);align-items:start}
  .pg > figcaption{grid-column:2;grid-row:1/-1;margin-top:0}
  .pg > :not(figcaption){grid-column:1}
  .pg .bch-head{margin-top:var(--s3)}
  .pg > figcaption{max-width:45ch}
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
  /* THE CARD GRIDS GO TO THREE, AND THIS OVERTURNS THE PARAGRAPH ABOVE.
     That block says the venue cards are "deliberately NOT touched" because
     "their 86 character measure comes from the type being --t-sm rather than
     from the column being wide". THE 86 WAS NOT A MEASUREMENT OF CHARACTERS.
     Measured for real on 16 August 2026, by walking every text node with a
     Range and counting the characters that share a line box, the prose inside
     these cards sets 102 to 107 characters a line at 1440 and up to 137 in
     .by-fees. That is the worst measure on the page and the widest block on it
     is 650px, which is a column-width question after all.

     THREE COLUMNS AND NOT A CAP INSIDE THE CARD. A max-width on .by-v's own
     paragraphs would leave 200px of empty card to the right of every line
     inside a 3px navy border, which is the exact fault the comment above this
     one identifies in the key panel and fixes by filling the space rather than
     by narrowing the box. The honest fix for a column that is too wide is more
     columns.

     MEASURED, 1440x900, median REAL characters a line:
                        2 columns      3 columns
       .by-prot            103             65
       .by-auth            103             63
       .by-nb              102             65
       .by-cond-l li        98             62
       .by-grades li        97             62
       .by-fees li          89             69
       whole page           95             66
       page height      20,988px       19,236px
     Nothing below 1200 moves, and 390x844 was re-measured after: median 50,
     identical to the pixel. */
  /* align-items:start GOES WITH THE THIRD COLUMN AND IS CAUSED BY IT. A grid
     item stretches to its row by default, and a row is as tall as its tallest
     card, so going from two cards a row to three makes every void bigger: at
     1440 the TCGplayer card is five times the height of eBay's, and stretched
     that paints roughly 500px of empty card inside a 3px navy border. Empty
     bordered space is the same fault the key panel above was fixed for. It
     costs no page height either way, because the row is the tall card's height
     regardless; this only stops the short ones drawing a box around nothing. */
  .by-vs,.by-ps{grid-template-columns:repeat(3,1fr);align-items:start}
  /* THE THREE BLOCKS THE COLUMN COUNT COULD NOT REACH, all measured in the same
     pass and all fixed by narrowing rather than by splitting, because none of
     them is inside a bordered panel and prose with space beside it is just
     prose.
       .by-list and .by-chain set 88 characters in a 672px column, because
         columns:2 divides the full 1,392px band. Capping the whole block at
         1100px puts them at 70.
       .by-src, 11px, was capped at 64ch and measured 83 REAL characters. ch is
         not a character: at this size one ch is running about 1.5 characters,
         so 56ch is the honest way to ask for 80.
       The figure captions were capped at 52ch and measured 84. 45ch. */
  .by-list,.by-chain{max-width:1100px}
}
/* The section ornament, from shared/format.mjs so the five pages that draw a
   Garbage Plate cannot disagree about how it sits. It is here rather than in
   ui.css because ui.css is render blocking on all 1,483 pages and this is on
   five, which is the same trade miniCSS above is arguing about. */
${PLATE_CSS}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Where to Buy Pokemon Cards Online, and What Each Place Costs</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/buying.html">
<meta property="og:title" content="Where to buy Pokemon cards online">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/buying.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-buying.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-buying.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
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

      <section class="by-grp">
        <h2>What an order has to reach before shipping is <span class="hl">free</span></h2>
        <p>Every venue below states its own threshold on its own card, twelve screens apart, and the number is the
          first thing a buyer wants. Here they are on one axis, with the four that publish no number at all
          underneath, because that group is the reason this page exists.</p>
${freeChart()}
      </section>
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
${postageChart()}
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
${clockChart()}
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

${/* THE ONE ORNAMENT ON THIS PAGE, AND IT IS HERE BECAUSE OF WHAT IS UNDER IT
      RATHER THAN BECAUSE THE PAGE NEEDED BREAKING UP SOMEWHERE.

      Measured on the built page at 390x844: 48,825px tall, and the largest run
      with no picture in it is 36,525px, from the top to the first thing a phone
      renders. That is not the page being lazy, it is the 26 retailer marks
      being display:none below 545px, so a desktop reader gets a mark every few
      hundred pixels and a phone reader gets two 22px glyphs in 48,825. The tail
      this sits in is the second largest at 11,171px.

      The section below is the page's closing turn, from "every venue above ends
      with a package" to a counter in Rochester, and it is the one paragraph on
      the page that points at /shops.html. A Rochester dish is the mark for
      that, which is why the ornament is here and not at the arithmetic seam
      13,000px up, where it would have been decoration on a fee table.

      ONE. Eleven h2s on this page and ten of them get nothing. */ ""}${plateRule()}

      <section class="by-grp">
        <h2>The chain with no links in it at <span class="hl">all</span></h2>
        <p class="by-lede">Every venue above ends with a package. A counter does not. You look at the card, you hand
          over money, and the transaction is finished before you leave: nothing to ship, no claim window, nobody to
          wait on and no clock to miss.${
            shops ? ` This site already publishes <a href="/shops.html">${shops} shops around Rochester</a> and a
            <a href="/card-shows.html">card show calendar</a>.` : ""
          } What it costs is selection, which is the same trade as everything else on this page.</p>
        <p class="by-lede" style="margin-top:var(--s3)">A counter does not have to be a card shop, either.
          Which chains sell Pokemon cards, what each one actually keeps on the shelf and which department
          they file them under is <a href="/retailers.html">the shop list</a>, which covers GameStop, Target,
          Walmart, CVS and the rest, and names the ones whose sites would not let us read them.</p>
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
