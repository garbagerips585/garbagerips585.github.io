#!/usr/bin/env node
// Generate /complete-a-set.html: what it actually costs to finish each set.
//
//   node scripts/build-complete.mjs
//
// Reads public/data/cards/*.json and public/data/sets.json. No new data, no new
// source: this is arithmetic over the checklist and prices the site already
// carries, so it re-costs itself every time the nightly price sync runs.
//
// WHY THIS PAGE EXISTS. "How much to complete <set>" is a question people ask
// constantly and nobody answers with live numbers. The pages that rank for it
// quote a price read once, on one set, and then sit there going stale: the best
// of them is still quoting December 2023 for 151. Ours is a table over every
// set we cover, recomputed nightly, which is a thing a hand-written article
// structurally cannot be.
//
// THE CHEAPEST PRINTING IS THE HONEST PRICE. A card can exist as a normal, a
// reverse holo and a holo at three different prices. Somebody completing a set
// needs one copy of that number and will buy whichever is cheapest, so every
// total here uses min(all variants), not the card's headline price. That makes
// these totals LOWER than the site's card pages quote, on purpose, and the
// method note says so.
//
// WHY THE TOTALS ARE A FLOOR, TWICE OVER. Singles are bought one at a time from
// different sellers, so a real completion pays shipping many times and pays a
// spread over market on the cards nobody has listed. Neither is knowable from
// this data. The page says "before shipping" everywhere rather than pretending
// the market price is the checkout price.
//
// UNPRICED CARDS ARE SUBTRACTED, NOT ZEROED. A handful of cards in four sets
// have no market price yet. Counting them as $0 would silently understate those
// sets and make them look like bargains next to sets that happen to be fully
// priced. Each row carries its own coverage count and any row missing cards is
// marked, so the reader can see which totals are complete.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS } from "../shared/chrome.mjs";
import { esc, longDate, moneyExact, moneyRound, moneyCompact } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const meta = new Map(sets.map((s) => [s.id, s]));

// The rarities that come out of packs in quantity. Everything above these is
// the part of a set that costs money, which is the split the page is built on.
const BULK = new Set(["Common", "Uncommon"]);

/** Cheapest way to own this card at MARKET. See the header note on variants. */
function floorPrice(c) {
  const vals = Object.values(c.all || {}).filter((v) => typeof v === "number" && v > 0);
  if (vals.length) return Math.min(...vals);
  return typeof c.price === "number" && c.price > 0 ? c.price : null;
}

/** Cheapest listing on the shelf right now, across variants.
 *
 * A DIFFERENT NUMBER ANSWERING A DIFFERENT QUESTION, and the page keeps them
 * apart. Market is what copies have been selling for. `low` is one listing,
 * condition unstated, from one seller, and 200 of them are 200 separate orders
 * with 200 postage charges. Summed it is a floor nobody can actually reach, so
 * it is never presented as what a set costs. Falls back to market so a card
 * without a listing does not silently drop out of the floor and make it look
 * lower than it is. */
function listedFloor(c) {
  return typeof c.low === "number" && c.low > 0 ? c.low : floorPrice(c);
}

const rows = [];
let checked = null;

for (const f of (await readdir(join(ROOT, "public/data/cards"))).sort()) {
  if (!f.endsWith(".json")) continue;
  const doc = JSON.parse(await readFile(join(ROOT, "public/data/cards", f), "utf8"));
  const set = meta.get(doc.set);
  if (!set) continue;
  checked = checked || doc.checked;

  // printedTotal is the number on the card ("131/131"), so anything numbered
  // above it is a secret rare and sits outside the base set by definition.
  const official = Number(set.printedTotal) || 0;
  const tiers = { bulk: 0, base: 0, master: 0 };
  const counts = { bulk: 0, base: 0, master: 0 };
  const floors = { base: 0, master: 0 };
  let missing = 0;
  let top = null;

  for (const c of doc.cards) {
    const p = floorPrice(c);
    if (p === null) {
      missing += 1;
      continue;
    }
    const lo = listedFloor(c);
    const n = Number(String(c.n).replace(/^0+(?=\d)/, ""));
    const inBase = official > 0 && Number.isFinite(n) && n <= official;
    tiers.master += p;
    floors.master += lo;
    counts.master += 1;
    if (inBase) {
      tiers.base += p;
      floors.base += lo;
      counts.base += 1;
      if (BULK.has(c.rarity)) {
        tiers.bulk += p;
        counts.bulk += 1;
      }
    }
    if (!top || p > top.price) top = { name: c.name, n: c.n, rarity: c.rarity, price: p };
  }

  rows.push({
    id: doc.set,
    name: set.name,
    released: set.released,
    total: doc.cards.length,
    official,
    ...tiers,
    counts,
    floors,
    // How far market sits above the cheapest listings on the shelf. Big on a
    // commons-heavy tier, near 1 on a tier the chase cards dominate.
    baseSpread: floors.base > 0 ? tiers.base / floors.base : 1,
    masterSpread: floors.master > 0 ? tiers.master / floors.master : 1,
    missing,
    top,
    // The single most useful derived number on the page: how much of the whole
    // bill is one card. Above about a third, "completing the set" is really
    // "buying one card", and the reader should know that before they start.
    topShare: top && tiers.master > 0 ? top.price / tiers.master : 0,
  });
}

rows.sort((a, b) => a.base - b.base);

const complete = rows.filter((r) => r.missing === 0);
const cheapest = rows[0];
const dearest = rows[rows.length - 1];
const dearestMaster = rows.slice().sort((a, b) => b.master - a.master)[0];
// Sets where one card is at least a quarter of the master-set bill.
const lopsided = rows
  .filter((r) => r.topShare >= 0.25)
  .sort((a, b) => b.topShare - a.topShare);
const totalBase = rows.reduce((n, r) => n + r.base, 0);
const totalMissing = rows.reduce((n, r) => n + r.missing, 0);
const totalBaseFloor = rows.reduce((n, r) => n + r.floors.base, 0);
const totalMasterFloor = rows.reduce((n, r) => n + r.floors.master, 0);
const totalMaster = rows.reduce((n, r) => n + r.master, 0);
// The headline of the shipping section: market runs well above the cheapest
// listings on a commons-heavy base set and barely above them on a master set,
// because the master set's bill is chase cards whose cheap copies are not cheap.
//
// MEDIAN OF THE PER-SET RATIOS, not the ratio of the totals. Summing every set
// first lets the two or three dearest sets set the answer for all 23: done that
// way the base-set figure comes out 2.4x, when the per-set spreads actually run
// from 1.3x to 7.6x and the middle set is well above 2.4. The label says
// "typical set", so the number has to be the typical set.
const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const baseSpread = median(rows.map((r) => r.baseSpread));
const masterSpread = median(rows.map((r) => r.masterSpread));
const widest = rows.slice().sort((a, b) => b.baseSpread - a.baseSpread)[0];

const pct = (x) => `${Math.round(x * 100)}%`;
const desc =
  `What it costs to complete every Pokemon set we cover, priced nightly. ` +
  `${cheapest.name} is the cheapest base set at ${moneyRound(cheapest.base)}, ` +
  `${dearest.name} the dearest at ${moneyRound(dearest.base)}. ` +
  `Commons run, base set and master set, all at cheapest printing, before shipping.`;

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Cost to complete a set", item: `${SITE}/complete-a-set.html` },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much does it cost to complete a Pokemon set?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `It depends enormously on the set. Across the ${rows.length} sets on this page the base set ranges from ${moneyRound(cheapest.base)} for ${cheapest.name} to ${moneyRound(dearest.base)} for ${dearest.name}, buying every card as a single at the cheapest printing and before shipping. The master set, which adds the secret rares, is several times more: ${dearestMaster.name} is ${moneyRound(dearestMaster.master)}.`,
        },
      },
      {
        "@type": "Question",
        name: "Is it cheaper to buy singles or open packs to complete a set?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Singles, almost always, and it is not close. A base set here averages ${moneyRound(totalBase / rows.length)} bought as singles. Opening enough packs to see every card in a set costs many times that, because packs repeat commons long before they finish the checklist. Packs are for the fun of opening them; singles are for finishing a set.`,
        },
      },
      {
        "@type": "Question",
        name: "What is the difference between a base set and a master set?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `The base set is every card numbered up to the printed total, so a card that reads 131/131 is the last one. A master set adds everything numbered above that total, which is where the secret rares and most of the expensive chase cards live. That is why the two numbers are so far apart: in ${lopsided[0]?.name || "several sets"} a single card is ${pct(lopsided[0]?.topShare || 0)} of the whole master-set bill.`,
        },
      },
    ],
  },
];

const row = (r) => `<tr${r.missing ? ' class="cc-part"' : ""}>
  <th scope="row"><a href="/sets/${esc(r.id)}.html">${esc(r.name)}</a><span class="cc-yr">${esc(String(r.released).slice(0, 4))}</span></th>
  <td class="num">${moneyRound(r.bulk)}<span class="cc-n">${r.counts.bulk} cards</span></td>
  <td class="num"><strong>${moneyRound(r.base)}</strong><span class="cc-n">${r.counts.base} cards</span></td>
  <td class="num">${moneyRound(r.master)}<span class="cc-n">${r.counts.master} cards</span></td>
  <td class="cc-top">${esc(r.top?.name || "")}<span class="cc-n">${moneyRound(r.top?.price)}, ${pct(r.topShare)} of the master set</span></td>
</tr>`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>What Does It Cost to Complete a Pokemon Set? Priced Nightly | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/complete-a-set.html">
<meta property="og:title" content="What does it cost to complete a set?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/complete-a-set.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-complete.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-complete.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Titan+One&family=Outfit:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
${STYLES}
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
    <span class="kicker">Pokemon TCG &bull; Priced last night</span>
    <h1>What does it cost to <span class="hl">complete</span> a set?</h1>
    <p class="lede" style="max-width:38em">Every set we cover, costed three ways, from the commons run to the full
      master set. These are live prices, not a number somebody typed into an article two years ago, so they move
      every night with the market.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Cost to complete a set</p>

    <div class="facts">
      <div class="fact"><div class="n">${moneyCompact(cheapest.base)}</div><div class="l">Cheapest base set (${esc(cheapest.name)})</div></div>
      <div class="fact"><div class="n">${moneyCompact(dearest.base)}</div><div class="l">Dearest base set (${esc(dearest.name)})</div></div>
      <div class="fact"><div class="n">${moneyCompact(dearestMaster.master)}</div><div class="l">Dearest master set (${esc(dearestMaster.name)})</div></div>
      <div class="fact"><div class="n">${rows.length}</div><div class="l">Sets costed</div></div>
    </div>

    <div class="fk-golden" style="margin-top:22px">
      <p class="fk-golden-h">Read this first</p>
      <h2>The base set is the <span class="hl">cheap</span> part</h2>
      <p>Every card numbered up to the printed total, the ones that read 131/131 and below, is usually a small bill:
        ${moneyRound(cheapest.base)} to ${moneyRound(dearest.base)} across these ${rows.length} sets. The money is
        all above that line, in the secret rares. ${esc(dearestMaster.name)} is ${moneyRound(dearestMaster.base)}
        as a base set and ${moneyRound(dearestMaster.master)} as a master set. If you have been putting off
        completing a set because you assumed it ran to thousands, it is worth checking which half you actually want.</p>
    </div>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Three ways to finish</p>
    <h2>What counts as <span class="hl">complete</span>?</h2>
    <p class="lede" style="max-width:40em">The word means three different things depending who is saying it, and the
      gap between them is most of the cost. Pick the one you actually want before you start buying.</p>
    <div class="gc-grid">
      <article class="gc">
        <h3>The commons run</h3>
        <p class="gc-price">${moneyCompact(rows.reduce((n, r) => n + r.bulk, 0) / rows.length)}<span> average per set</span></p>
        <p class="gc-note">Every Common and Uncommon in the numbered set. This is the part that falls out of packs by
          the hundred, so it is nearly free to buy and nearly worthless to sell. A good first target: it is most of the
          card count and almost none of the money, and it teaches you how a checklist works.</p>
      </article>
      <article class="gc">
        <h3>The base set</h3>
        <p class="gc-price">${moneyCompact(totalBase / rows.length)}<span> average per set</span></p>
        <p class="gc-note">Every card numbered up to the printed total. This is what most people mean by completing a
          set, and it is the tier this page sorts by. It includes the rares and the double rares but stops before the
          secret rares, which is exactly where the price cliff is.</p>
      </article>
      <article class="gc">
        <h3>The master set</h3>
        <p class="gc-price">${moneyCompact(rows.reduce((n, r) => n + r.master, 0) / rows.length)}<span> average per set</span></p>
        <p class="gc-note">Everything, secret rares included. Several times the base set in every case, and in some
          sets a single card is more than a quarter of the bill on its own. Worth knowing that most master-set
          collectors also chase every reverse holo, which is a further tier again and not costed here.</p>
      </article>
    </div>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>All ${rows.length} sets</p>
    <h2>Cheapest to <span class="hl">dearest</span></h2>
    <p class="lede" style="max-width:40em">Sorted by base set, which is the tier most people are asking about. Every
      figure buys one copy of each card at its cheapest printing, at market, before shipping.</p>
    <div class="cc-scroll">
      <table class="cc-table">
        <caption class="sr-only">Cost to complete each set at three tiers, with the most expensive single card</caption>
        <thead>
          <tr>
            <th scope="col">Set</th>
            <th scope="col" class="num">Commons run</th>
            <th scope="col" class="num">Base set</th>
            <th scope="col" class="num">Master set</th>
            <th scope="col">Dearest single card</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row).join("\n          ")}
        </tbody>
      </table>
    </div>
    ${
      totalMissing
        ? `<p class="price-note">Rows marked with a dotted rule are missing prices on ${totalMissing} card${totalMissing === 1 ? "" : "s"} between them, so those totals are a little low. ${complete.length} of the ${rows.length} sets are priced in full.</p>`
        : ""
    }
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The one card problem</p>
    <h2>When the set <span class="hl">is</span> one card</h2>
    <p class="lede" style="max-width:40em">In ${lopsided.length} of these ${rows.length} sets, a single card is at least
      a quarter of the entire master-set bill. Completing those sets is not really a grind, it is one purchase with a
      long tail attached, and it is worth seeing that number before you decide the set is out of reach.</p>
    <ul class="facts-list">
      ${lopsided
        .map(
          (r) =>
            `<li><strong>${esc(r.name)}.</strong> ${esc(r.top.name)} is ${moneyRound(r.top.price)} of a
        ${moneyRound(r.master)} master set, which is ${pct(r.topShare)} of it. The other ${r.counts.master - 1} cards
        come to ${moneyRound(r.master - r.top.price)} between them.</li>`,
        )
        .join("\n      ")}
    </ul>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Two different prices</p>
    <h2>The cards are nearly free. The <span class="hl">postage</span> is not.</h2>
    <p class="lede" style="max-width:40em">Every figure above is market price, meaning what copies have actually been
      selling for. There is a second number worth knowing: the cheapest copy listed right now. On the cards that make
      up a base set those two are miles apart, and on the cards that make up a master set they are almost the same.</p>
    <div class="facts">
      <div class="fact"><div class="n">${baseSpread.toFixed(1)}x</div><div class="l">Typical set: market above cheapest listings, base set</div></div>
      <div class="fact"><div class="n">${masterSpread.toFixed(1)}x</div><div class="l">Typical set: the same comparison, master set</div></div>
      <div class="fact wide"><div class="n">${moneyRound(totalBaseFloor / rows.length)}</div><div class="l">Average base set at cheapest listings, before postage</div></div>
    </div>
    <p style="max-width:40em;margin-top:16px">The reason is that a three cent common's cheapest copy is a penny, while
      a ${moneyRound(dearestMaster.top.price)} chase card's cheapest copy is close to what it sells for. So the money in
      a base set is not really in the cards, it is in getting ${cheapest.counts.base} of them into one envelope.
      ${esc(widest.name)} is the extreme case: ${moneyRound(widest.base)} at market against
      ${moneyRound(widest.floors.base)} in cheapest listings, a ${widest.baseSpread.toFixed(1)}x gap.</p>
    <p class="price-note">We do not publish the cheapest-listing total as a set price, because it is not one. Those are
      single listings from ${cheapest.counts.base} different sellers in unstated condition, so nobody can actually buy a
      set at that number. It is here to show you where the real cost sits, which is postage and patience rather than
      the cards.</p>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <h2>How this was <span class="hl">worked out</span></h2>
    <ul class="facts-list">
      <li><strong>Cheapest printing, every time.</strong> A card that exists as a normal and a reverse holo is counted
        at whichever is cheaper, because that is what somebody finishing a set would buy. It makes these totals lower
        than the price the same card shows on our card pages, which quote a specific printing.</li>
      <li><strong>Before shipping, and on a base set that is the whole bill.</strong> Singles come from many sellers, so
        a real completion pays postage over and over. Add up the cheapest listing for every card in a base set and it
        comes to ${moneyRound(totalBaseFloor / rows.length)} on average, against ${moneyRound(totalBase / rows.length)}
        at market. The cards are close to free. What you are actually buying is ${cheapest.counts.base} separate
        envelopes, which is why people do this in bulk lots from one seller and not one card at a time.</li>
      <li><strong>Market price, not the price you will pay, and it cuts both ways.</strong> Market is what copies have
        been selling for. Some cards can be had below it right now from somebody clearing stock, and some cannot be had
        at all, because the cheap commons in any set are often listed by nobody. So this is a middle estimate rather
        than a floor or a ceiling: expect to beat it on the cards everyone has and to pay over it on the last few.</li>
      <li><strong>Reverse holos are not costed.</strong> A full reverse-holo run is a separate tier again, and it is
        a big one. The master-set figures here are one copy of each card number, not one of each printing.</li>
      <li><strong>No pull rates, no pack maths.</strong> We have not costed "how many packs to complete this", because
        it would need pull rates we do not have. Anyone quoting you that number is estimating.</li>
    </ul>
    <p class="price-note">Prices are TCGplayer market via TCGdex, read ${esc(longDate(checked) || checked || "recently")},
      and refresh on their own overnight. Card counts are the published checklists. Totals are computed from those two
      things and nothing else: no estimates, no rounding up to a nicer number. No affiliate links, and nothing here is
      a recommendation to buy anything.</p>
  </div>
</section>

</main>
${footer("Prices move daily. These totals are a floor, not a quote.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/complete-a-set.html"), page);
console.log(`Wrote public/complete-a-set.html
  ${rows.length} sets costed, ${complete.length} priced in full, ${totalMissing} cards unpriced
  cheapest base ${cheapest.name} ${moneyExact(cheapest.base)}, dearest ${dearest.name} ${moneyExact(dearest.base)}
  dearest master ${dearestMaster.name} ${moneyExact(dearestMaster.master)}
  ${lopsided.length} sets where one card is 25%+ of the master set`);
