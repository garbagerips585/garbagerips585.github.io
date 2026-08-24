#!/usr/bin/env node
// Build /selling.html: where to sell Pokemon cards, what it costs, and who is
// holding the money when it goes wrong.
//
//   node scripts/build-selling.mjs
//
// Reads data/selling.json (venues and fees) and data/selling-safety.json
// (protections, attacks, defenses). Both carry a source url and a read date on
// every claim, the standard data/grading.json set.
//
// WHY THIS PAGE EXISTS AND WHY IT TOOK TWO PASSES. Every other page here
// answers "what is my card worth". The next question is always "so where do I
// sell it", and the site had no answer. It was deliberately not built once
// already, because fee percentages copied off blog posts are exactly the kind
// of number this site does not publish, and grading.json's readme records that
// when third-party fee figures were last checked against primary sources,
// three of four were wrong.
//
// So every fee here was read off the company's own page. Where one could not
// be, the venue still appears, with what IS known and a link to its fee page,
// and it says UNVERIFIED rather than borrowing a number from somewhere else.
// A gap stated plainly is worth more than a figure that might be wrong,
// because this page is about somebody's money.
//
// THE SAFETY HALF IS FRAMED AS MECHANISM, NOT REPUTATION, and that was a
// deliberate choice against the obvious one. The obvious page warns readers
// off Facebook Marketplace. This site cannot source "Facebook Marketplace is
// full of scammers": it is a character judgment with no publishable evidence
// and it would age badly. What IS sourceable is who stands between buyer and
// seller, what recourse exists, and who eats the loss. A reader given the
// mechanism can judge any venue, including ones that do not exist yet.
//
// And the conclusion that mechanism reaches is the opposite of the expected
// one, which is why it is worth printing: an in-person cash sale carries LESS
// risk than a shipped online sale. Nothing ships, nothing can be charged back,
// both people inspect before the value moves. The FTC says so in its own
// guidance for sellers. What it costs you is the buyer pool and probably the
// price. That is a trade, not a safety ranking, and this site can say it with
// a straight face because it already publishes six verified local shops and a
// show calendar.

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
import { esc, longDate, plateRule, PLATE_CSS, sentenceStart, clipMeta} from "../shared/format.mjs";
import { brandMark, PROT_MARK, BRAND_CREDIT, BRAND_STYLE } from "../shared/brands.mjs";
import { localDay } from "../shared/today.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const money = JSON.parse(await readFile(join(ROOT, "data/selling.json"), "utf8"));
const safe = JSON.parse(await readFile(join(ROOT, "data/selling-safety.json"), "utf8"));

let shops = 0;
let shows = 0;
try {
  shops = (JSON.parse(await readFile(join(ROOT, "data/shops.json"), "utf8")).shops || []).length;
} catch { /* the in-person section drops its count rather than guessing */ }
try {
  // THE WHOLE ARRAY IS NOT THE NUMBER THIS PAGE MEANS, and it printed "23
  // upcoming shows" twice, in the body and in a source line's aria-label, while
  // /card-shows.html rendered 22 and its own meta description said 22. The file
  // holds every show that was read; the page beside it drops the ones whose day
  // has passed. So this said "upcoming" over a count that included a show that
  // had already happened, and it drifts further every time a date rolls by.
  //
  // SAME FILTER AS THE PAGE IT LINKS TO, `date >= today` off shared/today.mjs.
  // build-shows.mjs uses it to build the list and build-start.mjs already used
  // it for the same sentence; this file was the one restating a length.
  const today = localDay();
  shows = (JSON.parse(await readFile(join(ROOT, "data/shows.json"), "utf8")).shows || [])
    .filter((s) => s.date >= today).length;
} catch { /* same */ }

const venues = money.venues || [];
if (!venues.length) throw new Error("data/selling.json has no venues");

// Group in the order somebody actually works through the question: the places
// you list it yourself, the places that buy it outright, the places that sell
// it for you, and the place you can drive to.
const GROUPS = [
  { key: "market", title: "Marketplaces", blurb: "You list it, a buyer finds it, you ship it. The most money and the most work." },
  { key: "buylist", title: "Buylists", blurb: "They buy it outright at their price. No waiting and no buyer to argue with." },
  { key: "consign", title: "Consignment and auction", blurb: "They sell it for you. Worth it on cards where the buyer pool is small and rich." },
  { key: "person", title: "In person", blurb: "Cash, face to face, done in one moment. Mechanically the safest way to sell." },
];
// READ THE FIELD, DO NOT INFER THE GROUP. This used to pattern match `type` and
// `format`, and because eBay's format mentions auctions it filed eBay, Whatnot
// and Sportlots under "they sell it for you", leaving the Marketplaces section
// holding two venues. Sportlots' own note in the data says nobody sells your
// cards for you there, so the page was contradicting its own source text.
const groupOf = (v) => {
  if (!v.group) throw new Error(`selling.json: venue "${v.id}" has no group`);
  if (!GROUPS.some((g) => g.key === v.group)) {
    throw new Error(
      `selling.json: venue "${v.id}" has group "${v.group}", which is not one of ${GROUPS.map((g) => g.key).join(", ")}`
    );
  }
  return v.group;
};

const STATUS = {
  sourced: { label: "Fees sourced", cls: "ok" },
  partial: { label: "Partly sourced", cls: "part" },
  unverified: { label: "Fees unverified", cls: "unv" },
  structural: { label: "No platform fee", cls: "ok" },
};

/* 65 OF THESE 66 LINES PRINTED A CAPITAL LETTER MID SENTENCE. Same fault, same
   fix and the same day as costRow in build-buying.mjs: this was "on" followed by
   appliesTo, and appliesTo is a sentence-cased phrase in data/selling.json, so
   the page read "on Each order, where an order is any number of items bought by
   the same buyer" and 64 more like it. The value is its own sentence now, behind
   a bolded label, which is the shape the protection and conditions lines further
   down this same file already use.
   THE ONE ROW THAT WAS RIGHT IS WHY sentenceStart EXISTS: Mercari's Buyer
   Protection fee reads "the item price and buyer-paid shipping", lowercase,
   while its 65 siblings are capitalised. Raising a lowercase letter is safe;
   lowering a capital is not, because half of these open on a proper noun. */
const feeRow = (f) => `        <li>
          <b>${esc(f.what)}</b> ${esc(f.rate)}
          ${f.appliesTo ? `<span class="se-on"><b>Applies to.</b> ${esc(sentenceStart(f.appliesTo))}</span>` : ""}
          ${f.note ? `<span class="se-nt">${esc(f.note)}</span>` : ""}
        </li>`;

// THE GUARD BELOW EXISTED ONLY ON THE OTHER HALF OF THIS FILE. The header says
// "RENDER EVERY FIELD OR THROW", and prot() does; venueCard hand-listed its keys
// and silently dropped the rest. Five researched fields never reached the page:
// `protection` on all 14 venues, `sources` with every per-figure url and read
// date on all 14, `conditions`, and `sellerLevels`. The page meanwhile told the
// reader "every figure here carries the date it was read", which it then did
// not do. Writing the rule down is not the same as applying it.
// NESTED OBJECTS NEED THEIR OWN GUARD. V_KNOWN only inspects top level venue
// keys, so a renderer that guessed at the shape INSIDE one of them passed every
// check while emitting nonsense: an earlier version of this read l.level, l.rate
// and l.note against data whose keys are level, limits and toAdvance, and every
// entry collapsed to a bare integer under a bold label promising rates.
const SL_KNOWN = new Set(["level", "limits", "toAdvance"]);
const sellerLevel = (l) => {
  if (typeof l === "string") return `<li>${esc(l)}</li>`;
  for (const k of Object.keys(l)) {
    if (!SL_KNOWN.has(k)) throw new Error(`selling.json: sellerLevels entry has unrendered key "${k}"`);
  }
  return `<li><b>Level ${esc(String(l.level))}.</b> ${esc(l.limits || "")}${
    l.toAdvance ? ` <span class="se-adv">To move up: ${esc(l.toAdvance)}</span>` : ""
  }</li>`;
};

const V_KNOWN = new Set([
  "id", "name", "url", "type", "format", "bestFor", "status", "access", "fees",
  "payout", "note", "group", "protection", "sources", "conditions", "sellerLevels",
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

/**
 * The line on the closed <details> holding a venue's note and citations.
 * Twin of srcSummary in build-buying.mjs; see the argument there. Kept as a
 * copy rather than shared because these two builders share no module today
 * and one import would be the first, which is a bigger change than it looks.
 */
const srcSummary = (v) => {
  const reads = (v.sources || [])
    .map((x) => (typeof x === "string" ? "" : x.read || ""))
    .filter(Boolean)
    .sort();
  const newest = reads[reads.length - 1];
  const n = (v.sources || []).length;
  const count = n ? `${n} source${n === 1 ? "" : "s"}` : "How we know this";
  return newest ? `${count}, read ${longDate(newest)}` : count;
};

const venueCard = (v) => {
  for (const k of Object.keys(v)) {
    if (!V_KNOWN.has(k)) throw new Error(`selling.json: venue "${v.id}" has unrendered key "${k}"`);
  }
  const st = STATUS[v.status] || STATUS.partial;
  const fees = Array.isArray(v.fees) ? v.fees : [];
  return `      <article class="se-v" id="${esc(v.id)}">
        <div class="se-vh">
          ${brandMark(v.id, v.name)}
          ${/* TWO OF THESE VENUES ARE PAGES ON THIS SITE, and the heading link
               said so out loud in the ugliest possible way. "Local card show"
               and "Card show" carry url "/shops.html" and "/card-shows.html" in
               data/selling.json, which is right, and this template assumed every
               venue was somebody else's shop: it produced target="_blank" plus
               the label "Local card shop's own fees page, where the figures on
               this card were read, OPENS ON " -- with a trailing "opens on" and
               nothing after it, because hostOf() has no host to give for a
               relative url. A screen reader read the empty promise aloud. Same
               fix and same argument as the source rows below: an internal venue
               is a plain link to our own page, in the site's own words. */ ""}
          <h3>${v.url ? (v.url.startsWith("/")
            ? `<a href="${esc(v.url)}" aria-label="${esc(v.name)}, our own page on this, where the figures on this card were read">${esc(v.name)}</a>`
            : `<a href="${esc(v.url)}" rel="noopener" target="_blank" aria-label="${esc(v.name)}'s own fees page, where the figures on this card were read, opens on ${esc(hostOf(v.url))}">${esc(v.name)}</a>`) : esc(v.name)}</h3>
          <span class="se-st ${st.cls}">${esc(st.label)}</span>
        </div>
        ${v.type || v.format ? `<p class="se-fmt">${[v.type, v.format].filter(Boolean).map(esc).join(". ")}</p>` : ""}
        ${v.bestFor ? `<p class="se-best"><b>Best for.</b> ${esc(v.bestFor)}</p>` : ""}
        ${fees.length ? `<ul class="se-fees">\n${fees.map(feeRow).join("\n")}\n        </ul>`
          : `<p class="se-none">No fee figures here. ${
              v.status === "unverified"
                ? "Nothing is published where we could read it, and a number copied from somewhere else would be a guess about your money."
                : "There is no platform fee to state."
            }${v.url ? ` Their own page is linked above.` : ""}</p>`}
        ${v.payout ? `<p class="se-pay"><b>Getting paid.</b> ${esc(v.payout)}</p>` : ""}
        ${v.access ? `<p class="se-acc"><b>To sell there.</b> ${esc(v.access)}</p>` : ""}
        ${v.protection ? `<p class="se-prot"><b>If it goes wrong.</b> ${esc(v.protection)}</p>` : ""}
        ${(v.conditions || []).length ? `<p class="se-lbl"><b>Only if.</b></p><ul class="se-cond">${
          v.conditions.map((x) => `<li>${esc(x)}</li>`).join("")
        }</ul>` : ""}
        ${(v.sellerLevels || []).length ? `<p class="se-lbl"><b>What you are allowed to list, by level.</b></p><ul class="se-cond">${
          v.sellerLevels.map(sellerLevel).join("")
        }</ul>` : ""}
        ${/* THE SOURCING COLLAPSES. Same change and same argument as
              build-buying.mjs, measured separately on this page: .se-nb and
              .se-src across the fourteen venue cards were 3,624px and 1,601
              words, 15.2% of this page's words, interleaved between venues.
              The citations stay attached to what they support and the read
              date stays visible on the closed summary. */ ""}
        ${v.note || (v.sources || []).length ? `<details class="se-srcd"><summary>${
          esc(srcSummary(v))
        }</summary>` : ""}
        ${v.note ? `<p class="se-nb">${esc(v.note)}</p>` : ""}
        ${(v.sources || []).length ? `<p class="se-src">${v.sources
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
            // ", opens on <host>" IS THE CONDITION, NOT A FLOURISH. CLAUDE.md
            // makes an aria-label saying the link leaves the site the price of
            // every outbound link on this site, and the venue heading above
            // pays it while its own source rows underneath did not: 72 of the
            // 87 outbound links on this page and 85 of the 96 on /buying.html
            // carried a label that named the source and never said it was
            // leaving. Measured on the built tree, 22 August 2026. hostOf() was
            // already here for the heading; this is the same call.
            // TWO OF THESE SOURCES ARE PAGES ON THIS SITE AND WERE BEING
            // RENDERED AS OUTBOUND LINKS. data/selling.json cites /shops.html
            // and /card-shows.html as the evidence for two rows, which is
            // correct and is the site citing its own research; the template
            // assumed every source was somebody else's and gave all four
            // anchors `target="_blank"` and `rel="noopener"`. So an internal
            // link opened a new tab with no warning anywhere, which is the
            // opposite of the outbound rule rather than a mild version of it,
            // and it was invisible until the "opens on <host>" clause above
            // came back EMPTY for a relative url and left two links that could
            // not say where they went. FOUR ANCHORS, and they were the only
            // four in the whole 1,487-page tree: measured 22 August 2026,
            // `<a target="_blank" href="/...">` appears nowhere else.
            // An internal source is a plain link. No new tab, no rel, and no
            // "opens on", because it does not leave the site.
            const internal = typeof u === "string" && u.startsWith("/");
            return u
              ? `<a href="${esc(u)}" aria-label="${esc(v.name)}${clause ? `, ${esc(clause)}` : ""}, source ${i + 1}${
                  internal ? "" : hostOf(u) ? `, opens on ${esc(hostOf(u))}` : ""
                }"${internal ? "" : ` rel="noopener" target="_blank"`}>${
                  esc(what || `Source ${i + 1}`)
                }</a>${read ? ` <span>read ${esc(longDate(read))}</span>` : ""}`
              : esc(what);
          })
          .join(" &bull; ")}</p>` : ""}
        ${v.note || (v.sources || []).length ? `</details>` : ""}
      </article>`;
};

// RENDER EVERY FIELD OR THROW. The first version of this hand-listed the keys
// it knew and quietly dropped the rest, which is the worst possible bug on a
// page like this: research that was actually done, sourced and dated would
// simply not appear, and nothing would look broken. Whatever the data carries,
// the page shows, and an unrecognised key stops the build until somebody
// decides where it goes.
const P_LABEL = {
  covers: ["Covers.", "yes"],
  doesNotCover: ["Does not cover.", "no"],
  sellerCarries: ["The seller carries.", "no"],
  sellerBilledBackFor: ["The seller is billed back for.", "no"],
  conditions: ["Only if all of these are true.", ""],
  how: ["How it works.", ""],
  clocks: ["Clocks.", ""],
  excluded: ["Excluded.", "no"],
  threshold: ["Threshold.", ""],
  signatureThreshold: ["Signature on delivery.", ""],
  highValue: ["High value items.", ""],
  packingVideo: ["Packing video.", ""],
  shipping: ["Shipping.", ""],
  counterfeits: ["Counterfeits.", ""],
  returns: ["Returns.", ""],
  cardCarveOut: ["Cards specifically.", ""],
  buyerSideDiffers: ["The buyer's side differs.", ""],
  offPlatform: ["Off platform.", "no"],
};
const P_SKIP = new Set(["venue", "note", "source", "alsoRead", "read", "verifiedTwice"]);

const prot = (p) => {
  const parts = [];
  for (const [k, v] of Object.entries(p)) {
    if (P_SKIP.has(k)) continue;
    if (Array.isArray(v) && !v.length) continue;
    const spec = P_LABEL[k];
    if (!spec) throw new Error(`selling-safety.json: protection "${p.venue}" has key "${k}" with no label in P_LABEL`);
    const [label, tone] = spec;
    const head = `<p class="se-lbl${tone ? ` se-${tone}` : ""}"><b>${esc(label)}</b></p>`;
    parts.push(
      Array.isArray(v)
        ? `${head}<ul>${v.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
        : `<p class="se-nb"><b>${esc(label)}</b> ${esc(v)}</p>`
    );
  }
  const srcs = [p.source, ...(p.alsoRead || [])].filter(Boolean);
  return `      <article class="se-p">
        <div class="se-vh">
          ${brandMark(PROT_MARK[p.venue] || "", p.venue)}
          <h3>${esc(p.venue)}</h3>
        </div>
        ${p.note ? `<p class="se-nb">${esc(p.note)}</p>` : ""}
        ${parts.join("\n        ")}
        ${srcs.length ? `<p class="se-src">${srcs
          .map((u, i) => `<a href="${esc(u)}" aria-label="Source${i ? ` ${i + 1}` : ""}, ${esc(p.venue)} policy${
            hostOf(u) ? `, opens on ${esc(hostOf(u))}` : ""
          }" rel="noopener" target="_blank">${i ? `Source ${i + 1}` : "Source"}</a>`)
          .join(", ")}${p.read ? `, read ${esc(longDate(p.read))}` : ""}</p>` : ""}
      </article>`;
};

const nSourced = venues.filter((v) => v.status === "sourced").length;

// ============================================================================
// THE TAKE-HOME CHART, and it exists because the page cannot say the thing it
// knows.
//
// FOURTEEN VENUE CARDS EACH STATE THEIR OWN RATE AND NOTHING PUTS THEM SIDE BY
// SIDE. A reader who wants to know whether Whatnot's 8% actually beats eBay's
// 13.25% has to hold four numbers in their head across four screens of scrolling
// and then do the arithmetic. That is not a job for prose, and the page never
// even attempts it: no sentence anywhere ranks the venues by what they take.
//
// AND THE ANSWER IS NOT THE ONE THE HEADLINE RATES GIVE, which is the whole
// reason this is worth drawing rather than writing. Ranked by headline
// commission the order is Whatnot 8, Mercari 10, TCGplayer 10.75, eBay 13.25.
// Ranked by what actually leaves your hands on a $100 sale it is Mercari,
// Whatnot, TCGplayer, eBay, and TCGplayer lands within ten cents of eBay
// because its 2.5% + $0.30 transaction fee sits on top of the commission while
// eBay's final value fee already includes payment processing. Two of the four
// change places. A stacked bar shows exactly where the second layer comes from
// and a paragraph cannot.
//
// EVERY NUMBER IS PARSED OUT OF THE FEE LINE IT IS DRAWN FROM, never typed in
// beside it, and the build throws rather than shipping a chart that disagrees
// with the card above it. Same discipline as the postage chart on /buying.html.
// THE ZEROES ARE ASSERTED TOO, not assumed: "eBay charges no separate payment
// processing" is a claim this chart depends on completely, so if that line ever
// stops saying so the build stops as well.
//
// WHAT THE BARS DELIBERATELY DO NOT COVER is in the caption, because a chart
// this simple about money is dishonest without the boundary written on it:
// store subscriptions, insertion fees, dispute fees, payout fees, seller-level
// discounts and anything charged on shipping or tax are all real and all
// excluded. The venue cards above carry them.
const SALE = 100;
const feeOf = (id, whatRe) => {
  const v = venues.find((x) => x.id === id);
  if (!v) throw new Error(`build-selling: the take-home chart needs venue "${id}" and data/selling.json has no such id.`);
  const f = (v.fees || []).find((x) => whatRe.test(x.what));
  if (!f) {
    throw new Error(
      `build-selling: the take-home chart needs the fee on "${id}" whose label matches ${whatRe}, and no fee ` +
        `on that venue has one. Labels present: ${(v.fees || []).map((x) => JSON.stringify(x.what)).join(", ")}.`
    );
  }
  return f;
};
// Pull one number out of a rate line, or stop the build and say which sentence
// moved. The message names the venue, the label, the pattern and the text that
// is there now, because the person reading it is not the person who wrote it.
const rateNum = (id, whatRe, rateRe, what, group = 1) => {
  const f = feeOf(id, whatRe);
  const m = rateRe.exec(f.rate);
  if (!m) {
    throw new Error(
      `build-selling: the take-home chart reads ${what} off "${f.what}" on ${id} in data/selling.json, and that ` +
        `rate no longer matches ${rateRe}. It now reads: ${JSON.stringify(f.rate)}. Do not ship a chart whose ` +
        `numbers are not the ones printed beside it: restore the line, or update the regex and the chart together.`
    );
  }
  const n = Number(m[group]);
  if (!(n >= 0)) throw new Error(`build-selling: ${what} on ${id} parsed to ${m[group]}, which is not a number.`);
  return n;
};
// A zero this chart leans on has to be checked, not believed. Every bar with no
// processing layer is a bar making a claim.
const assertRate = (id, whatRe, rateRe, why) => {
  const f = feeOf(id, whatRe);
  if (!rateRe.test(f.rate)) {
    throw new Error(
      `build-selling: the take-home chart draws no processing layer for ${id} because ${why}, and "${f.what}" ` +
        `no longer says so. It now reads: ${JSON.stringify(f.rate)}. The bar would be understating what the ` +
        `venue takes, so the build stops here.`
    );
  }
};

assertRate("ebay", /^Payment processing$/, /^None charged separately/i, "its final value fee already includes payment processing");
assertRate("mercari", /^Payment processing fee$/, /^None charged to the seller/i, "Mercari charges the seller none");
assertRate("local-shop", /^Commission, payment processing, listing, shipping, payout fee$/, /^\$0$/, "a shop charges a seller nothing");

const CUTS = [
  {
    id: "ebay",
    name: "eBay",
    note: "no Store subscription",
    pct: rateNum("ebay", /^Final value fee, Toys/, /^([\d.]+)% up to \$7,500 per item/, "eBay's final value fee"),
    // The per order fee is a flat charge rather than a rate, so it is the whole
    // of the second layer here and is drawn as such.
    flat: rateNum("ebay", /^Per order fee$/, /\$([\d.]+) on orders over \$10\.00/, "eBay's per order fee"),
    procPct: 0,
    layer2: "per order fee",
  },
  {
    id: "tcgplayer",
    name: "TCGplayer",
    note: "Marketplace Seller",
    pct: rateNum("tcgplayer", /^Marketplace commission, Marketplace Seller/, /^([\d.]+)%/, "TCGplayer's marketplace commission"),
    procPct: rateNum("tcgplayer", /^Transaction fee$/, /^([\d.]+)% \+ \$([\d.]+)/, "TCGplayer's transaction fee rate"),
    flat: rateNum("tcgplayer", /^Transaction fee$/, /^([\d.]+)% \+ \$([\d.]+)/, "TCGplayer's transaction fee minimum", 2),
    layer2: "transaction fee",
  },
  {
    id: "whatnot",
    name: "Whatnot",
    note: "TCG category, US",
    pct: rateNum("whatnot", /^Commission, TCG category/, /^([\d.]+)% on the final sale price/, "Whatnot's TCG commission"),
    procPct: rateNum("whatnot", /^Payment processing fee$/, /^([\d.]+)% \+ \$([\d.]+) per transaction/, "Whatnot's payment processing rate"),
    flat: rateNum("whatnot", /^Payment processing fee$/, /^([\d.]+)% \+ \$([\d.]+) per transaction/, "Whatnot's per transaction charge", 2),
    layer2: "payment processing",
  },
  {
    id: "mercari",
    name: "Mercari",
    note: "seller side",
    pct: rateNum("mercari", /^Selling fee$/, /^([\d.]+)%/, "Mercari's selling fee"),
    procPct: 0,
    flat: 0,
    layer2: "",
  },
].map((c) => {
  const a = +((SALE * c.pct) / 100).toFixed(2);
  const b = +((SALE * (c.procPct || 0)) / 100 + (c.flat || 0)).toFixed(2);
  return { ...c, a, b, total: +(a + b).toFixed(2) };
});
CUTS.sort((x, y) => y.total - x.total);

/**
 * One $100 sale, four platforms, two layers each.
 *
 * HTML ROWS AND NOT AN SVG, so each row can carry the company's own mark in the
 * same .bmk box the venue cards use. That was the owner's request for these two
 * pages and a chart of five named companies is where it pays most: a reader
 * scrolling for the venue they sell on finds a logo faster than a word. Reaching
 * a mark from inside an SVG means an <image href> per row, which is a request
 * each, not lazy, and outside the box every other mark on the page sits in.
 *
 * THE NUMBER IS TEXT AND THE BAR IS DECORATIVE. Every row prints its own total
 * next to its own name, so the figure still works with the bars removed and for
 * a reader who never sees them.
 *
 * THE ZERO ROW IS DRAWN AND NOT OMITTED. A bar of length nothing is the page's
 * own conclusion, which is that the in person sale is the one with no platform
 * in it, and leaving it out would make the chart argue for whichever
 * marketplace is shortest. It carries the hatch this site uses everywhere else
 * for "there is no picture of this", because the cost of selling to a shop is
 * the price they offer and no shop publishes that.
 */
const takeChart = () => {
  const MAX = Math.max(...CUTS.map((c) => c.total));
  const usd = (n) => `$${n.toFixed(2)}`;
  const pc = (v) => +((v / MAX) * 100).toFixed(1);
  // The name tile is dropped in a chart row and only here: the name is printed
  // an inch to the right already, so a tile repeating it is the word twice.
  const mark = (id, label) => {
    const m = brandMark(id, label);
    return m.includes("bmk-n") ? "" : m;
  };
  const rows = CUTS.map((c) => `          <li>
            <span class="bch-h">${mark(c.id, c.name)}<span class="bch-n">${esc(c.name)} <span class="bch-s">${esc(c.note)}</span></span><b class="bch-v">${usd(c.total)}</b></span>
            <span class="bch-t" aria-hidden="true"><span class="bch-b tk-a" style="width:${pc(c.a)}%"></span>${
              c.b ? `<span class="bch-b tk-b" style="width:${pc(c.b)}%"></span>` : ""
            }</span>
          </li>`);
  rows.push(`          <li>
            <span class="bch-h">${brandMark("local-shop", "A shop or a show")}<span class="bch-n">A shop or a show <span class="bch-s">cash, in person</span></span><b class="bch-v">$0.00</b></span>
            <span class="bch-t" aria-hidden="true"><span class="bch-b tk-z" style="width:14%"></span></span>
          </li>`);
  return `      <figure class="pg pg-tk">
        <ul class="bch">
${rows.join("\n")}
        </ul>
        <figcaption>One $100 card, sold at a fixed price, with no shipping charged to the buyer and no sales tax.
          The dark part of each bar is the platform's commission and the gold part is what it charges on top:
          ${CUTS.filter((c) => c.b).map((c) => `${esc(c.name)}'s ${esc(c.layer2)}`).join(", ")}. eBay has no gold layer
          for processing because its final value fee already includes it, and Mercari charges a seller none. That is
          why the lowest headline rate is not the cheapest place to sell: Whatnot's ${esc(
            String(CUTS.find((c) => c.id === "whatnot").pct)
          )}% ends up above
          Mercari's ${esc(String(CUTS.find((c) => c.id === "mercari").pct))}%, and TCGplayer's ${esc(
            String(CUTS.find((c) => c.id === "tcgplayer").pct)
          )}% lands within
          ${esc(
            (() => {
              const d = Math.abs(CUTS.find((c) => c.id === "ebay").total - CUTS.find((c) => c.id === "tcgplayer").total);
              return `${Math.round(d * 100)} cents`;
            })()
          )} of eBay's ${esc(String(CUTS.find((c) => c.id === "ebay").pct))}%.
          <b>The hatched bar is not a recommendation.</b> A shop or a show charges a seller no platform fee, which is
          why there is nothing to draw, and the cost there is the price they offer you instead. No shop publishes
          that, so it is hatched the way this site hatches everything it has no picture of rather than drawn as a
          win.
          <b>What these bars leave out.</b> Store subscriptions, insertion fees, dispute fees, payout and cash-out
          fees, seller-level discounts, and anything charged on shipping or tax you collect. Every one of those is on
          the venue's own card below. Figures read from each company's own fee page${
            money.checked ? ` on ${esc(longDate(money.checked))}` : ""
          }.</figcaption>
      </figure>`;
};

// ============================================================================
// THE LADDER THE CHART ABOVE COULD NOT DRAW.
//
// The take-home chart puts four marketplaces on one $100 sale. There are FIVE
// marketplaces on this page, and Sportlots is missing from it because its rate
// does not depend on the sale at all. The research file says so in as many
// words: one venue's rate depends on your month rather than your card, and
// averaging it into a single number destroys it. So the chart above is right to
// leave it off, and leaving it off is also why the single strangest fee on this
// page is invisible: a seller who moves under five dollars in a month keeps a
// quarter of it.
//
// THIS IS THE SAME MOVE THE NO-THRESHOLD ROWS MAKE ON /buying.html. A venue that
// cannot go on the shared axis gets its own picture rather than a silent
// omission or a fudged average, and the caption says which axis this one is.
//
// THE REFERENCE LINE IS COMPUTED FROM THE CHART ABOVE, not typed in. It is the
// worst total any of those four venues takes out of $100, which is the honest
// comparator: it already includes the second layer of fees, and drawing the
// headline percentage instead would flatter this ladder. Every rung is above it,
// which is the finding, and no sentence anywhere on the page says so because it
// needs all ten bands and the four totals in one place to be sayable.
//
// AND THE BANDS UNDERSTATE WHAT SPORTLOTS TAKES, which the caption has to carry
// or the picture is dishonest in the venue's favour. Payment processing is
// charged to the seller here ON TOP of the band, where eBay's final value fee
// already contains it. That line is asserted rather than remembered.
// THE LABEL IS THE BAND VERBATIM AND THE FIRST DRAFT GOT THIS WRONG IN A WAY
// THAT LOOKED FINE. It parsed the lower bound only and printed "$0.00 and up",
// which reads as "sell anything at all and they take 75%" and is false for
// every seller past five dollars. The bands are RANGES, the top one is open
// ended, and the whole point of the figure is which range you are in. So the
// segment is split off the sentence whole and only the percentage is pulled out
// of it: whatever Sportlots calls a band is what the row is called.
const SL_FEE = feeOf("sportlots", /^Fixed-price commission, by TOTAL MONTHLY SALES$/);
const SL_BANDS = String(SL_FEE.rate)
  .split(/\.\s+(?=\$)/)
  .map((seg) => {
    const m = /^(.+?):\s*([\d.]+)%\.?\s*$/.exec(seg.trim());
    return m ? { band: m[1].replace(/-/g, " to "), pct: Number(m[2]) } : null;
  })
  .filter(Boolean);
if (SL_BANDS.length < 5) {
  throw new Error(
    `build-selling: the monthly ladder reads bands off "${SL_FEE.what}" on sportlots and found ` +
      `${SL_BANDS.length}. It now reads: ${JSON.stringify(SL_FEE.rate)}. A ladder of four rungs is a ` +
      `sentence, not a picture: restore the line, or update the parse and the figure together.`
  );
}
// The whole argument is that this ladder DESCENDS as you sell more, which is the
// opposite of every other rate on the page. If it ever stops descending the
// picture is making a claim the data does not.
SL_BANDS.forEach((b, i) => {
  if (i && !(b.pct < SL_BANDS[i - 1].pct)) {
    throw new Error(
      `build-selling: the monthly ladder's band ${i} is ${b.pct}% against ${SL_BANDS[i - 1].pct}% above it, ` +
        `so the rate no longer falls as you sell more. That direction is the entire figure and the entire ` +
        `note on the fee line. Do not ship a staircase that does not go one way.`
    );
  }
});
assertRate(
  "sportlots",
  /^Payment processing$/,
  /^Paid by the seller/i,
  "the caption says the bands understate what it takes because processing sits on top of them"
);
const SL_WORST = CUTS[0];

/**
 * Ten bands on one axis of percentage taken.
 *
 * SAME .bch ROWS AS THE CHART ABOVE, deliberately. Two figures in two bar styles
 * on one page reads as two accidents, and this one sits directly under the other
 * so the difference would be at its most visible. Nothing here needs a company
 * mark, because every row is the same company.
 *
 * THE AXIS IS PERCENT TAKEN AND THE BARS RUN TO THE WORST BAND, not to 100.
 * Scaled to 100 the bottom six rungs are 15 to 27px inside a 296px track and the
 * staircase stops being one. 75 is a real number in the data rather than a
 * convenient maximum, and it is printed on its own row.
 *
 * THE REFERENCE IS A DASHED RULE INSIDE EVERY TRACK rather than a differently
 * coloured bar, and that is the colour trap being avoided rather than a style
 * choice. --ink, --navy, --ketchup and --keyline all resolve to #111111 today,
 * so a comparison carried by two fills would be one black shape. A vertical dash
 * across a horizontal bar survives the whole palette collapsing to one value.
 */
const monthChart = () => {
  const MAX = Math.max(...SL_BANDS.map((b) => b.pct));
  const pc = (v) => +((v / MAX) * 100).toFixed(1);
  const refPc = pc(SL_WORST.total);
  return `      <figure class="pg pg-ml">
        <ul class="bch bch-ml">
${SL_BANDS.map(
  (b, i) => `          <li>
            <span class="bch-h"><span class="bch-n">${esc(b.band)} <span class="bch-s">${
              i === SL_BANDS.length - 1 ? "the best rate there is" : "sold that month"
            }</span></span><b class="bch-v">${b.pct}%</b></span>
            <span class="bch-t" aria-hidden="true"><span class="bch-b ml-b" style="width:${pc(b.pct)}%"></span><span class="ml-ref" style="left:${refPc}%"></span></span>
          </li>`
).join("\n")}
        </ul>
        <figcaption>Sportlots is the fifth marketplace on this page and it is not in the chart above, because
          its rate is set by everything you sold that month rather than by the card. A month in the
          ${esc(SL_BANDS[0].band)} band costs you ${esc(String(SL_BANDS[0].pct))}% of it. A month at
          ${esc(SL_BANDS[SL_BANDS.length - 1].band)} costs ${esc(
    String(SL_BANDS[SL_BANDS.length - 1].pct)
  )}%.
          Nothing else on this page works this way, and no other rate on it moves at all.
          <b>The dashed line is the chart above.</b> It sits at $${esc(
            SL_WORST.total.toFixed(2)
          )}, which is the most any of those four venues takes out of a $100 sale, including everything they
          charge on top. Every rung here is past it, so the best month a Sportlots seller can have is still
          worse than the worst of the four, and ${esc(
            String((SL_BANDS[0].pct / SL_WORST.total).toFixed(1))
          )} times worse at the bottom.
          <b>And the bands understate it.</b> Payment processing is charged to the seller here, on top of the
          band, where eBay's final value fee already contains it. Listing is free on fixed price and auctions
          cost ${esc(
            (() => {
              const f = feeOf("sportlots", /^Auction listing fee$/);
              const m = /\$([\d.]+)/.exec(f.rate);
              return m ? `$${m[1]}` : f.rate;
            })()
          )} each. Read from Sportlots' own seller guide${money.checked ? ` on ${esc(longDate(money.checked))}` : ""}.</figcaption>
      </figure>`;
};

const desc = `Where to sell Pokemon cards and what each place takes. Fees read off each company's own page, plus who protects a seller and who does not.`;

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
.se-lede{max-width:46em}
/* THE TAKE-HOME CHART. The svg is capped at 520px rather than filling the
   panel, because its text is in viewBox units: the viewBox is 340 wide, which
   is what this panel gets inside a 390px phone, so a 12 unit label is about
   12px there and grows from that. Uncapped at 1440 the same labels rendered at
   30px, which reads as a poster rather than as a figure. The rules are a near
   copy of .pg on /buying.html and that is deliberate: the two pages are one
   page asked in both directions, and a shared module for twelve declarations
   would mean editing shared/ while other passes are live in it. */
.pg{margin:var(--s4) 0 var(--s5);border:3px solid var(--keyline);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4)}
/* THE BAR ROWS. HTML rather than SVG so each row carries the company's own mark
   in the same .bmk box the venue cards use. THE TRACK IS ON ITS OWN LINE UNDER
   THE NAME rather than in a column beside it: at 390px a three column row
   leaves the track about 150px wide next to the mark box, and a difference of
   $3.65 between two bars is not a picture at that length. Full width tracks
   also put every bar on the same baseline and the same scale, which is the only
   thing that makes them comparable. */
.bch{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--s3)}
.bch li{display:flex;flex-direction:column;gap:5px}
.bch-h{display:flex;align-items:center;gap:var(--s2);flex-wrap:wrap}
.bch-n{font:700 var(--t-sm)/1.2 var(--body);color:var(--ink)}
.bch-s{font:400 var(--t-micro)/1.2 var(--mono);color:var(--ink-2)}
.bch-v{margin-left:auto;font:700 var(--t-sm)/1 var(--mono);color:var(--ketchup-deep);white-space:nowrap}
.bch-t{display:flex;height:12px;border-radius:3px;background:var(--paper-2);overflow:hidden;
  box-shadow:inset 0 0 0 1px var(--hair)}
.bch-b{display:block;height:100%;min-width:3px}
/* The mark box shrinks in a chart row: at the venue card's 124px cap a column
   of five logos reads as a logo wall with a chart hiding behind it. */
.bch .bmk{height:30px;min-width:52px;max-width:112px;padding:3px 7px}
/* Two layers, not two hues. The dark block is the commission and the gold block
   is whatever is charged on top of it, which is the only distinction the chart
   is making, so it is made with the palette's own ink and gold rather than with
   a second colour the site does not otherwise use. The caption names both
   layers in words, so the fill is never carrying the meaning alone. */
.tk-a{background:var(--ink);border-radius:3px 0 0 3px}
.tk-b{background:var(--gold)}
.bch-b:only-child{border-radius:3px}
/* THE SITE'S OWN NO-ART HATCH, the same 45 degree one .bmk-n uses for a venue
   with no mark. Here it means the opposite of a missing figure and the same
   thing mechanically: there is no platform fee to draw, and the real cost is a
   buy price nobody publishes. */
/* THE MONTHLY LADDER. One fill and one rule, because the second figure on this
   page must not invent a second bar language. .bch-t is display:flex and
   overflow:hidden above, which is what lets the take-home chart stack two
   segments; the reference mark has to be positioned rather than flowed or it
   would push the bar along, so the track goes relative HERE ONLY and not on
   .bch-t generally. Scoping it wrong would move nothing visibly and would leave
   a positioned ancestor under the other chart's segments. */
.bch-ml .bch-t{position:relative}
.ml-b{background:var(--ink);border-radius:3px}
/* 2px and full height, so it reads over a filled bar and over an empty track
   alike. The bars are ink and the rule is gold, but the reading is vertical
   against horizontal: set both to one value and the figure still works, which
   is the requirement on this site's palette. */
.ml-ref{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:var(--gold-deep);
  box-shadow:0 0 0 1px var(--paper-2)}
/* THE TRACK STOPS CLIPPING, AND ONLY ON THIS CHART. .bch-t sets overflow:hidden
   so the take-home chart's two stacked segments cannot spill past the rounded
   ends. Inherited here it cropped the reference rule back to exactly the track
   height, which at 12px inside a black bar is a gold sliver a reader has to be
   told to look for. The rule now stands 4px proud top and bottom, which is the
   difference between a mark on one bar and a line across the chart. This chart
   has no stacked segments to spill, so nothing else wants the clip back. */
.bch-ml .bch-t{overflow:visible}
.tk-z{background:repeating-linear-gradient(45deg,var(--paper-3) 0 6px,var(--paper-2) 6px 12px);
  box-shadow:inset 0 0 0 1px var(--ink-2)}
.pg figcaption{font-size:var(--t-sm);line-height:1.55;color:var(--ink-2);margin-top:var(--s4);max-width:52ch}
.pg figcaption b{color:var(--ink);display:block;margin-top:var(--s3)}
.se-jump{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:var(--s5) 0 var(--s4)}
/* min-height 44, not 40. WCAG 2.5.5 asks for 44x44 and these chips are the
   page's primary navigation on a phone: they are the only way to reach a
   section without scrolling the whole article. Measured 40px before this, so
   they already cleared 2.5.8's 24px AA floor -- this is the AAA target, taken
   because a one-handed reader thumbing down the page hits these first.
   THE GAP IS UNTOUCHED AND HAS TO STAY THAT WAY: the parent sets gap:8px,
   which is row AND column gap, so growing the box does not close the 8px
   between two chips or between two wrapped rows. Re-measured after: 44px tall,
   still 8px apart in both axes. */
.se-jump a{display:inline-flex;align-items:center;min-height:44px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.se-jump a:hover{border-color:var(--ink);background:var(--mustard);color:var(--on-accent)}
.se-jg{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);margin-left:var(--s2)}
.se-jg:first-child{margin-left:0}
/* NO scroll-margin-top OVERRIDE HERE. ui.css already sets
   [id]{scroll-margin-top:calc(var(--bar-h) + 12px)} = 72px, which clears the
   sticky bar. This file overrode it with var(--s5), 24px, so every click in the
   jump nav parked the card top at y=24 and the bar (60px tall) cut the venue
   name in half. Verified by driving the jump. A LOWER value than the global is
   never right while the bar is sticky; if this ever needs its own figure it has
   to be LARGER, the way build-video-games.mjs uses bar-h + 64px to leave the
   heading breathing room. */

.se-key{border:3px solid var(--keyline);border-radius:12px;background:var(--band-bg);color:var(--chrome-ink);
  padding:var(--s5);margin:var(--s5) 0;box-shadow:var(--hard-lg)}
.se-key h2{color:var(--chrome-ink);margin-bottom:var(--s3)}
.se-key p{color:var(--foot-ink);line-height:1.55;max-width:44em}
.se-key p + p{margin-top:var(--s3)}
.se-grp{margin-top:var(--s6)}
.se-grp > p{color:var(--ink-2);max-width:44em;margin-bottom:var(--s4)}
.se-vs{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4)}
/* THIS 900 IS CORRECT AND IT IS THE ONE THAT LOOKS WRONG. Every other grid on
   this page and its sibling /buying.html moved to 700 on 20 August 2026 so an
   iPad in portrait stops getting the phone layout. This one did not, because
   the cards are ESSAYS: the venue comparisons run 2,463 to 6,222 characters
   each. A text card does not get shorter when you narrow it, it gets taller in
   exact proportion, so two columns of unequal essays is a WORSE band and not a
   better one. Measured at 768, forcing two columns: 13,324px to 13,983, and on
   /buying.html where the longest card is 11,042 characters the same forcing
   costs 25%, 13,404px to 16,728. The row is as tall as its tallest card, so
   pairing a long essay with a short one buys nothing and pays for it twice.
   The 1200 rule below is where this band earns three columns: by then the wrap
   is 1,392px and a column is 453px, which is a reading measure rather than a
   sliver. DO NOT "FINISH THE JOB" BY MOVING THIS TO 700 TO MATCH ITS
   NEIGHBOURS: the neighbours are short cards and this one is not. */
@media(max-width:900px){.se-vs{grid-template-columns:1fr}}
.se-v,.se-p{border:3px solid var(--keyline);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4)}
/* Centre, not baseline: the 34px mark box hung a third of its height below the
   heading on a baseline row. Same change as /buying.html's .by-vh. */
.se-vh{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2);margin-bottom:var(--s2)}
${BRAND_STYLE}
.se-vh h3{font:400 var(--t-m)/1.15 var(--display)}
/* THE CONFIDENCE LADDER, REBUILT WITHOUT HUE. Three things were wrong with it.
   THE BOTTOM RUNG WAS INVISIBLE. "FEES UNVERIFIED" was --card on a white card,
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
.se-st{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  padding:5px 8px;border-radius:5px;border:1px solid var(--hair);color:var(--ink-2)}
.se-st.ok{background:var(--chrome-bg);color:var(--chrome-ink);border-color:var(--chrome-bg)}
.se-st.part{background:var(--paper-3);color:var(--ink);border-color:var(--hair)}
.se-st.unv{background:var(--paper-2);color:var(--ink);border:1.5px dashed var(--ink-2)}
.se-fmt{color:var(--ink-2);font-size:var(--t-sm);margin-bottom:var(--s2)}
.se-best,.se-pay,.se-acc,.se-nb,.se-none{font-size:var(--t-sm);line-height:1.5;margin-top:var(--s2)}
.se-nb,.se-none{color:var(--ink-2)}
.se-fees{list-style:none;margin:var(--s3) 0 0;padding:0;display:flex;flex-direction:column;gap:var(--s2)}
.se-fees li{font-size:var(--t-sm);line-height:1.45;padding-left:var(--s3);border-left:3px solid var(--gold)}
.se-on,.se-nt{display:block;color:var(--ink-2);font-size:var(--t-micro);margin-top:2px}
/* The "Applies to." label on .se-on, matching .by-on b on /buying.html. */
.se-on b{color:var(--ink)}
.se-p ul{margin:var(--s2) 0 0 var(--s4);font-size:var(--t-sm);line-height:1.5;color:var(--ink-2)}
.se-lbl{font-size:var(--t-sm);margin-top:var(--s3)}
/* "COVERS." AGAINST "DOES NOT COVER." was green text against --ketchup-deep,
   and after the repaint --ketchup-deep is #6E5000, the palette's own deep gold.
   So the pair was green versus gold, which is the last hue distinction on
   either page and the same leftover the status ladder above just lost.
   BOTH LABELS ALREADY SAY WHAT THEY MEAN IN WORDS, at the start of the line, so
   the colour was never carrying the meaning: it was emphasis. Ink for the
   positive and deep gold for the negative keeps the emphasis, keeps them
   distinguishable by weight and hue-within-the-palette, and adds no sixth
   colour to a black, white and gold site. */
.se-yes b{color:var(--ink)}
.se-no b{color:var(--ketchup-deep)}
/* The collapsed sourcing. Twin of .by-srcd on /buying.html; the argument for
   the quiet treatment and the 44px summary is written out there. */
.se-srcd{margin-top:var(--s3);border-top:1px solid var(--hair)}
/* THE TRIANGLE IS DRAWN BECAUSE display:flex DELETES THE REAL ONE. Chrome
   removes a <summary>'s ::marker box entirely once the summary is a flex
   container, so this control shipped with NO disclosure affordance at all: it
   read as a line of small print that happened to be clickable, which is worse
   than not collapsing at all. Confirmed by reading the computed style rather
   than by looking: display "flex", list-style-type still "disclosure-closed",
   ::marker content "normal", and nothing painted.
   Flex is kept because it is what holds the 44px tap target and the baseline
   together, so the marker is drawn instead, as borders rather than a glyph so
   no font can fail to have it. */
.se-srcd > summary{cursor:pointer;list-style:none;
  min-height:44px;display:flex;align-items:center;gap:var(--s3);
  font:400 var(--t-micro)/1.4 var(--mono);letter-spacing:.04em;
  text-transform:uppercase;color:var(--ink)}
.se-srcd > summary::-webkit-details-marker{display:none}
.se-srcd > summary::before{content:"";flex:none;width:0;height:0;
  border-left:6px solid currentColor;
  border-top:4.5px solid transparent;border-bottom:4.5px solid transparent}
.se-srcd[open] > summary::before{transform:rotate(90deg)}
.se-srcd > summary:hover{text-decoration:underline}
.se-srcd > summary:focus-visible{outline:3px solid var(--sky);outline-offset:2px}
.se-srcd[open] > summary{margin-bottom:var(--s2)}
.se-srcd .se-nb{margin-top:0}
.se-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s3);line-height:1.6}
.se-prot{font-size:var(--t-sm);line-height:1.5;margin-top:var(--s2)}
.se-s1,.se-rd{font:400 var(--t-micro)/1 var(--mono);white-space:nowrap}
.se-rd{color:var(--ink-2)}
.se-cond{margin:var(--s2) 0 0 var(--s4);font-size:var(--t-sm);line-height:1.5;color:var(--ink-2)}
.se-cond li{margin-bottom:var(--s2)}
.se-adv{display:block;font-size:var(--t-micro);opacity:.85}
.se-ps{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4)}
/* 700 AND NOT 900, BECAUSE 900 PUT AN iPAD ON THE PHONE LAYOUT. 768 is an iPad
   in portrait and it is BELOW 900, so a tablet was getting the phone's single
   column with every protection card stretched across the full 720px wrap. The
   wrap is 660px inside a 700px viewport, which is two 322px cards and a 16px
   gap, and 350px at 390 where one column is still the only fit.
   .se-vs ABOVE KEEPS ITS 900 ON PURPOSE and the two are not an inconsistency:
   see the measurement written beside it. These protection cards are 260 to
   1,378 characters and the band gets SHORTER in two columns, 3,381px to 2,955,
   because each card is mostly a short labelled list rather than an essay.
   THE READING MEASURE MOVES FURTHER THAN THE HEIGHT DOES. Measured with a
   canvas on this page's own 14px face, a card in the old single column ran
   110 CHARACTERS PER LINE and in two columns it runs 51. The house standard is
   33em, which is 76 characters here, so the old layout was 34 over it and the
   new one is 25 under: 51 is inside the conventional 45 to 75 band and 110 is
   nowhere near it. Same numbers as .by-ps on /buying.html, same call.
   NOT auto-fit: the 1200 rule below sets three columns for this band and an
   auto-fit floor low enough to give two at 720 computes three at the 1152px
   wrap of a 1200 window too, which is the same answer by accident rather than
   the one that was chosen. Moving the number touches 700..999 and nothing else. */
@media(max-width:700px){.se-ps{grid-template-columns:1fr}}
.se-list{margin:var(--s4) 0 0 var(--s4);max-width:46em;line-height:1.55}
.se-list li{margin-bottom:var(--s3)}
.se-list b{color:var(--ink)}

/* DESKTOP, and it is the same block as the one on /buying.html because the two
   pages are the same page asked in the other direction. The long comment there
   is the argument; this is the short version.

   min-width only, so a phone and a tablet render what they rendered before.
   Measured identical at 390 before and after.

   MEASURED AT 1440: 9,899 words, a 15,194px page and a median reading measure
   of 81.5 characters a line, 83.3 at 1920, against a 65 to 75 target. The em
   caps are set against the font SIZE rather than the character width, so ch
   replaces them. The key panel drew its navy border the full 1,392px and then
   set its text to 44em, so every paragraph in it had about 600px of empty panel
   beside it; the heading moves into that space.

   .se-vs is deliberately untouched, for the reason written out on
   /buying.html: its measure is a type-size question, not a column-width one.

   50ch AND NOT 70ch. ch is the advance width of a "0", not of a character, and
   in Outfit a digit is about 1.43 average characters wide. The measurement and
   the trap it sets are written out on /buying.html. */
@media(min-width:1000px){
  .se-lede{max-width:50ch}
  .se-grp > p{max-width:50ch}
  .se-key p{max-width:50ch}
  /* The sourcing lines, 11px and uncapped, ran the full band. Same fault and
     the same cap as .by-src on /buying.html, and the same correction: 64ch was
     measured setting 92 REAL characters, because one ch is about 1.5 of them at
     this size. 56ch lands on 81. */
  .se-src{max-width:56ch}
}
/* The venue nav moves beside the opening paragraphs. Capping the ledes to 50ch
   is right for the reader and on its own it made the top of the page look
   emptier, not fuller: two paragraphs 578px wide with 814px of nothing beside
   them. The nav was directly underneath and it is this page's table of
   contents, so beside the introduction is where it belongs on a desktop. Same
   shape and the same 620px intro column as /buying.html. */
@media(min-width:1100px){
  .se-top{display:grid;grid-template-columns:minmax(0,620px) minmax(0,1fr);
    gap:var(--s5) var(--s6);align-items:start}
  .se-top .se-jump{margin-top:0}
  /* Two children, the heading and .se-key-body, so no row can be taller than
     the item in it and no explicit placement is needed. */
  .se-key{display:grid;grid-template-columns:300px minmax(0,1fr);
    gap:var(--s5);align-items:start}
  .se-key > h2{margin-bottom:0}
  /* The figure goes two column, bars left and caption beside them. Filling the
     1,392px wrap stretched every track to 1,340px and put the dollar figure
     1,300px from the name it belongs to, with a 45ch caption underneath and
     roughly 950px of empty panel next to it. Same fix and the same reasoning as
     /buying.html, where it is written out. */
  .pg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,380px);
    gap:var(--s4) var(--s5);align-items:start}
  .pg > figcaption{grid-column:2;grid-row:1/-1;margin-top:0}
  .pg > :not(figcaption){grid-column:1}
  .pg > figcaption{max-width:45ch}
}
@media(min-width:1200px){
  .se-list{columns:2;column-gap:var(--s6);max-width:none}
  .se-list li{break-inside:avoid}
  /* THE CARD GRIDS GO TO THREE, overturning the note above that .se-vs is a
     type-size question rather than a column-width one. It is a column-width
     one: the 81.5 characters that block quotes was not a count of characters,
     and walking every text node with a Range on 16 August 2026 put the prose
     inside these cards at 101 to 107 real characters a line at 1440, in a
     650px column. The argument and the numbers are written out at length on
     /buying.html. Measured here, 1440x900, median real characters a line:
     .se-prot 104 to 65, .se-pay 102 to 64, .se-acc 102 to 64, .se-fees li 66
     with a 140 maximum to 61 with a 92 maximum, and the whole page 92 to 66.
     Page height 15,781px to 15,380px, which is nearly flat and is the expected
     trade: three columns make each card taller and the rows fewer. Nothing
     below 1200 moves, and 390x844 re-measures identical. */
  /* align-items:start goes with the third column and is caused by it: a row is
     as tall as its tallest card and a grid item stretches to it, so three a row
     paints bigger voids than two did. Costs no page height, because the row is
     the tall card's height either way. Argued at length on /buying.html. */
  .se-vs,.se-ps{grid-template-columns:repeat(3,1fr);align-items:start}
  /* The blocks the column count could not reach, same three as /buying.html and
     the same measurements: .se-list set 86 characters in a 672px column of the
     full band, .se-src was capped at 64ch and measured 82 REAL characters, and
     the figure caption was capped at 52ch and measured 84. ch is not a
     character and at this size one is running about 1.5 of them. */
  .se-list{max-width:1100px}
}
/* The section ornament, from shared/format.mjs, exactly as on /buying.html.
   Not in ui.css: render blocking on 1,483 pages, drawn on five. */
${PLATE_CSS}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Where to Sell Pokemon Cards, and What Each Place Takes</title>
<meta name="description" content="${esc(clipMeta(desc))}">
<link rel="canonical" href="${SITE}/selling.html">
<meta property="og:title" content="Where to sell Pokemon cards">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/selling.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-selling.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-selling.jpg">
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
    { "@type": "ListItem", position: 2, name: "Where to sell" },
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
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Where to sell</span></nav>
      <!-- .se-top and .se-intro are inert wrappers until the min-width rule in
           the style block makes .se-top a grid and moves the venue nav beside
           the opening paragraphs. Same shape and reason as /buying.html. -->
      <div class="se-top">
      <div class="se-intro">
      <h1>Where to <span class="hl">sell</span> your cards</h1>
      <p class="lede se-lede">Every other page here answers what a card is worth. This one answers where you turn
        that into money, and what each place takes on the way. ${venues.length} venues, and the fee figures were
        read off each company's own page rather than off anybody's blog: ${nSourced} are fully sourced and the rest
        say so.</p>
      <p class="lede se-lede">Prices and fees move. Every figure here carries the date it was read, and if you are
        about to sell something expensive, check the company's own page before you count on a number.</p>
      </div>

      <nav class="se-jump" aria-label="Jump to a venue">
${GROUPS.map((g) => {
  const list = venues.filter((v) => groupOf(v) === g.key);
  return list.length
    ? `        <span class="se-jg">${esc(g.title)}</span>\n${list
        .map((v) => `        <a href="#${esc(v.id)}">${esc(v.name)}</a>`)
        .join("\n")}`
    : "";
}).filter(Boolean).join("\n")}
${/* THE SECOND ROW. Same change and same argument as build-buying.mjs: the nav
      indexed the fourteen venue cards and stopped, leaving 2,210 words and
      9,895px, nearly twelve phone screens, with no way to reach them or to
      know they were there. */ ""}
        <span class="se-jg">And</span>
        <a href="#fees">What a sale costs</a>
        <a href="#protection">Who protects a seller</a>
        <a href="#scams">How it goes wrong</a>
        <a href="#defenses">What defends against it</a>
      </nav>
      </div>

      <div class="se-key">
        <h2>The question that decides how much a sale can hurt you</h2>
        <!-- Wrapped so the heading sits beside ALL the paragraphs rather than
             beside the first one. Same reason as /buying.html: flat siblings in
             a two column grid share row 1, and the row is as tall as the taller
             of the two, which opens a hole under the shorter. -->
        <div class="se-key-body">
        <p>${esc(safe.framing.question)} It is not which site you are on.</p>
        ${(safe.framing.why || []).map((w) => `<p>${esc(w)}</p>`).join("\n        ")}
        </div>
      </div>

      <section class="se-grp" id="fees">
        <h2>What a $100 sale actually <span class="hl">costs</span></h2>
        <p>Every venue below states its own rate on its own card, and nothing on this page puts them next to each
          other. Here they are next to each other, on the same sale, so the ranking is visible before you read
          fourteen of them. The order is not the order the headline percentages give.</p>
${takeChart()}
${monthChart()}
      </section>
${(() => {
  // NOTHING ANYWHERE CHECKED THAT EVERY VENUE ACTUALLY REACHED THE PAGE. The
  // section loop filters by group, so a venue in no matching section is simply
  // absent, with a clean build and no error. The group value is validated above
  // and this counts the result anyway, because the two failures are different:
  // one catches a bad value, this catches a venue lost for any reason at all.
  const placed = GROUPS.reduce((n, g) => n + venues.filter((v) => groupOf(v) === g.key).length, 0);
  if (placed !== venues.length) {
    throw new Error(`selling.json: ${venues.length} venues but ${placed} rendered`);
  }
  return "";
})()}
${GROUPS.map((g) => {
  const list = venues.filter((v) => groupOf(v) === g.key);
  if (!list.length) return "";
  return `      <section class="se-grp">
        <h2>${esc(g.title)}</h2>
        <p>${esc(g.blurb)}</p>
        <div class="se-vs">
${list.map(venueCard).join("\n")}
        </div>
      </section>`;
}).filter(Boolean).join("\n")}

      <section class="se-grp" id="protection">
        <h2>Who protects a <span class="hl">seller</span></h2>
        <p>Seller protection and buyer protection are different products, and on every venue below the seller's
          version is the smaller one. This is the part people find out about afterwards.</p>
        <div class="se-ps">
${(safe.protections || []).map(prot).join("\n")}
        </div>
      </section>

      <section class="se-grp" id="scams">
        <h2>How it actually goes <span class="hl">wrong</span></h2>
        <p>Each of these is a mechanism rather than a type of person. Every one is defined by who controls the
          money at which moment.</p>
        <ol class="se-list">
${(safe.attacks || []).map((a) => `          <li><b>${esc(a.name)}.</b> ${esc(a.how)}${a.why ? ` ${esc(a.why)}` : ""}${a.note ? ` ${esc(a.note)}` : ""}${
            a.source ? ` <a class="se-s1" href="${esc(a.source)}" aria-label="Source for ${esc(a.name)}${hostOf(a.source) ? `, opens on ${esc(hostOf(a.source))}` : ""}" rel="noopener" target="_blank">Source</a>${
              a.read ? ` <span class="se-rd">read ${esc(longDate(a.read))}</span>` : ""
            }` : ""
          }</li>`).join("\n")}
        </ol>
      </section>

      <section class="se-grp" id="defenses">
        <h2>What actually <span class="hl">defends</span> against it</h2>
        <ol class="se-list">
${(safe.defenses || []).map((d) => `          <li><b>${esc(d.name)}.</b> ${esc(d.why || "")}${
            (d.thresholds || []).length ? ` ${d.thresholds.map(esc).join(" ")}` : ""
          }${
            d.source ? ` <a class="se-s1" href="${esc(d.source)}" aria-label="Source for ${esc(d.name)}${hostOf(d.source) ? `, opens on ${esc(hostOf(d.source))}` : ""}" rel="noopener" target="_blank">Source</a>${
              d.read ? ` <span class="se-rd">read ${esc(longDate(d.read))}</span>` : ""
            }` : ""
          }</li>`).join("\n")}
        </ol>
      </section>

${/* THE ONE ORNAMENT ON THIS PAGE, and it is the twin of the one on
      /buying.html rather than a second idea. Measured on the built page at
      390x844: 37,888px tall, largest picture free run 13,914px, and the tail
      this sits in is 6,832px.

      The section under it is the page's editorial turn, the argument that the
      safest sale is a local one made face to face, which is the same
      destination /buying.html's closing section reaches from the other end. A
      Rochester dish is the mark for that, and the two pages now make the same
      turn with the same mark on it.

      ONE. Ten h2s on this page. */ ""}${plateRule()}

      <section class="se-grp">
        <h2>The <span class="hl">safest</span> way to sell is the one nobody expects</h2>
        <p class="se-lede">${esc(safe.inPerson.claim)}</p>
        <ul class="se-list">
${(safe.inPerson.because || []).map((b) => `          <li>${esc(b)}</li>`).join("\n")}
        </ul>
        <p class="se-lede" style="margin-top:var(--s4)"><b>What it costs you.</b> ${esc(safe.inPerson.cost)}</p>
        <p class="se-lede" style="margin-top:var(--s3)">${esc(safe.inPerson.ftc)}${
          safe.inPerson.source ? ` <a class="se-s1" href="${esc(safe.inPerson.source)}" aria-label="Source, FTC guidance for sellers${
            hostOf(safe.inPerson.source) ? `, opens on ${esc(hostOf(safe.inPerson.source))}` : ""
          }" rel="noopener" target="_blank">Source</a>${
            safe.inPerson.read ? ` <span class="se-rd">read ${esc(longDate(safe.inPerson.read))}</span>` : ""
          }` : ""
        }</p>
        <p class="se-lede" style="margin-top:var(--s3)"><b>Where the line actually is.</b> The risk in a local
          listing is not the venue, it is three things people do inside it.</p>
        <ul class="se-list">
${(safe.inPerson.whereTheLineIs || []).map((b) => `          <li>${esc(b)}</li>`).join("\n")}
        </ul>
        <p class="se-lede" style="margin-top:var(--s4)">This site already publishes where the counter-and-table
          venues are${shops ? `: <a href="/shops.html">${shops} shops around Rochester</a>` : ""}${
            shows ? ` and <a href="/card-shows.html">${shows} upcoming shows</a>` : ""
          }. A shop or a show is a busy public room with a proprietor in it, which removes most of the reason
          people are nervous about meeting a stranger.</p>
      </section>

      <p class="se-src" style="margin-top:var(--s6)">Fees read from each company's own pages${
        money.checked ? ` on ${esc(longDate(money.checked))}` : ""
      }. Seller protection and scam mechanics read${safe.checked ? ` on ${esc(longDate(safe.checked))}` : ""} from the
        platforms' own policies and from the FTC. Nothing here came from a comparison site. This is not financial
        advice and fees change, so check before you sell.</p>
      <p class="se-src">${BRAND_CREDIT}</p>
    </div>
  </section>
</main>
${footer()}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/selling.html"), page);
console.log(`Wrote public/selling.html
  ${venues.length} venues (${nSourced} fully sourced), ${(safe.protections || []).length} protection policies,
  ${(safe.attacks || []).length} attacks, ${(safe.defenses || []).length} defenses`);
