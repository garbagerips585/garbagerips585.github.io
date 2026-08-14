#!/usr/bin/env node
// Generate /grading.html: what grading costs, and whether it pays.
//
//   node scripts/build-grading.mjs
//
// Reads data/grading.json for fees and data/psa10.json for the maths.
//
// THE POINT OF THIS PAGE IS THE SECOND HALF. Fee tables exist on twenty other
// sites. What almost nobody shows is the subtraction: this card is worth X raw
// and Y in a PSA 10, the cheapest slab costs Z, so grading it makes or loses
// this much. We happen to have both numbers for 76 cards out of the sets this
// channel rips, so the page can do that arithmetic on real cards instead of
// explaining it in the abstract.
//
// IT IS ALSO WHY THE PAGE CAN SAY NO. PSA paused its two cheap tiers in June
// 2026 and the entry price went from $24.99 to $79.99 overnight, which quietly
// killed the case for grading most modern cards. A page that only listed fees
// would not show that. A page that subtracts them does.
//
// The verdict deliberately uses the PSA 10 price as the UPSIDE and says out
// loud that most cards come back a 9. Presenting the best case as the expected
// case is how this kind of page misleads people into spending $80 on a $12 card.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS } from "../shared/chrome.mjs";
import { esc, longDate, moneyExact, moneyRound, moneyCompact } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const g = JSON.parse(await readFile(join(ROOT, "data/grading.json"), "utf8"));
const psa = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8"));
// WHAT EACH COMPANY'S SLAB IS ACTUALLY WORTH, from real sold prices rather
// than from the fee table. This is the half of the grading question nobody
// publishes: the fee tells you what it costs, and only the resale tells you
// whether it was worth it.
//
// Sample is data/graded.json: every card we pulled plus the top three chase
// cards from each set, read from PriceCharting. Small and openly stated, and
// the page prints the n against every row.
let graded = { cards: {} };
try {
  graded = JSON.parse(await readFile(join(ROOT, "data/graded.json"), "utf8"));
} catch {
  /* no graded sample yet; the section simply does not render */
}
const gRows = Object.values(graded.cards || {}).filter((c) => c.psa10 && c.ungraded);
const median = (a) => {
  const x = a.slice().sort((p, q) => p - q);
  return x.length ? x[x.length >> 1] : null;
};
const COMPANIES = [
  ["psa10", "PSA 10"],
  ["bgs10", "BGS 10"],
  ["tag10", "TAG 10"],
  ["ace10", "ACE 10"],
  ["sgc10", "SGC 10"],
  ["cgc10", "CGC 10"],
];
const slabValue = COMPANIES.map(([key, label]) => {
  const rows = gRows.filter((c) => c[key]);
  return {
    label,
    n: rows.length,
    med: median(rows.map((c) => c[key])),
    vsRaw: median(rows.map((c) => c[key] / c.ungraded)),
    vsPsa: median(rows.filter((c) => c.psa10).map((c) => c[key] / c.psa10)),
  };
}).filter((r) => r.n >= 20).sort((a, b) => b.vsRaw - a.vsRaw);

const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));

const setName = new Map(sets.map((s) => [s.id, s.name]));
const by = Object.fromEntries(g.companies.map((c) => [c.id, c]));

// Card names AND raw prices. psa10.json carries its own rawNm from
// pokemonpricetracker, but the rest of the site quotes TCGdex, and a grading
// page that says a card is worth $1,480.32 raw while the card search one click
// away says $1,470.58 is the exact inconsistency this build set out to remove.
// The graded price still comes from psa10.json, because nothing else on the
// site supplies one, and the page says so.
const names = new Map();
const rawPrice = new Map();
let cardsChecked = null;
try {
  const dir = join(ROOT, "public/data/cards");
  const { readdir } = await import("node:fs/promises");
  const norm = (n) => String(n ?? "").replace(/^0+(?=\d)/, "");
  for (const f of await readdir(dir)) {
    if (!f.endsWith(".json")) continue;
    const doc = JSON.parse(await readFile(join(dir, f), "utf8"));
    cardsChecked = cardsChecked || doc.checked;
    for (const c of doc.cards) {
      names.set(`${doc.set}-${norm(c.n)}`, c.name);
      if (typeof c.price === "number") rawPrice.set(`${doc.set}-${norm(c.n)}`, c.price);
    }
  }
} catch {
  /* run: node scripts/sync-cards.mjs */
}
const keyOf = (slug, num) => `${slug}-${String(num ?? "").replace(/^0+(?=\d)/, "")}`;

const cheapest = g.companies.slice().sort((a, b) => a.cheapest - b.cheapest)[0];
const psaCo = g.companies.find((c) => c.id === "psa");
const SHIP = g.assumedShippingPerCard ?? 15;

// Sign BEFORE the currency, matching the calculator's own formatter further down
// this file. They disagreed, so the same loss rendered "$-68.57" in the table and
// "-$68.57" in the calculator directly above it.

// Every card where we hold BOTH a raw and a PSA 10 price. `auto` is synced,
// `prices` is hand-entered and wins, same rule as everywhere else on the site.
const rows = [];
for (const [key, a] of Object.entries(psa.auto || {})) {
  const manual = psa.prices?.[key];
  const psa10 = (typeof manual === "number" ? manual : manual?.price) ?? a.psa10;
  const mk = /^(.*)-([^-]+)$/.exec(key);
  // TCGdex first, the graded feed's own raw as the fallback.
  const raw = rawPrice.get(keyOf(mk?.[1] || "", mk?.[2] || "")) ?? a.rawNm;
  if (typeof psa10 !== "number" || typeof raw !== "number" || raw <= 0) continue;
  // Enough recorded sales to mean something. Six sales is an anecdote.
  if (a.psa10Sales != null && a.psa10Sales < 10) continue;

  const m = /^(.*)-([^-]+)$/.exec(key);
  const slug = m?.[1] || "";
  const num = m?.[2] || "";
  const feePsa = psaCo.cheapest + SHIP;
  const feeCheap = cheapest.cheapest + SHIP;
  rows.push({
    key,
    name: names.get(keyOf(slug, num)) || key,
    set: setName.get(slug) || slug,
    slug,
    num,
    raw,
    psa10,
    multiple: psa10 / raw,
    netPsa: psa10 - raw - feePsa,
    netCheap: psa10 - raw - feeCheap,
    sales: a.psa10Sales ?? null,
  });
}
rows.sort((a, b) => b.netPsa - a.netPsa);

const worth = rows.filter((r) => r.netPsa > 0);
const notWorth = rows.filter((r) => r.netPsa <= 0);
const feePsa = psaCo.cheapest + SHIP;
const feeCheap = cheapest.cheapest + SHIP;

const verdictRow = (r) => `        <li class="gr">
          <span class="gr-name">${esc(r.name)}</span>
          <span class="gr-set">${esc(r.set)} &bull; ${esc(r.num)}</span>
          <span class="gr-raw">${moneyExact(r.raw)}<em>raw</em></span>
          <span class="gr-psa">${moneyExact(r.psa10)}<em>PSA 10</em></span>
          <span class="gr-net ${r.netPsa > 0 ? "up" : "down"}">${r.netPsa > 0 ? "+" : ""}${moneyExact(r.netPsa)}<em>after fees</em></span>
        </li>`;

const desc =
  `What Pokemon card grading actually costs in ${new Date(g.checked).getFullYear()}, PSA against CGC, BGS and TAG, ` +
  `and the break even maths on ${rows.length} real cards. PSA's cheapest tier is now ${moneyRound(psaCo.cheapest)}.`;

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Grading" },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much does it cost to grade a Pokemon card?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `PSA's cheapest active tier is ${moneyRound(psaCo.cheapest)} per card as of ${longDate(g.checked)}, after it paused its Value and Value Bulk tiers in June 2026. CGC and TAG start around ${moneyRound(cheapest.cheapest)}. Add roughly ${moneyRound(SHIP)} a card for shipping and insurance.`,
        },
      },
      {
        "@type": "Question",
        name: "Is it worth grading my Pokemon card?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Only if the gap between the raw price and the PSA 10 price is bigger than the fee, and only if the card is genuinely mint. Of ${rows.length} cards we hold both prices for, ${worth.length} would clear PSA's current fee and ${notWorth.length} would not. Those figures are all for a 10, and a 9 is worth far less, so treat them as the best case.`,
        },
      },
    ],
  },
];

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Is It Worth Grading? Pokemon Card Grading Costs and Break Even | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/grading.html">
<meta property="og:title" content="Is it worth grading? The actual maths">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/grading.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-grading.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-grading.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="stylesheet" href="/assets/fonts.css">
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
    <span class="kicker">Pokemon TCG &bull; Do the maths first</span>
    <h1>Is it worth <span class="hl">grading</span>?</h1>
    <p class="lede" style="max-width:36em">What it costs, how the four companies compare, and the subtraction almost
      nobody shows you: what a card is worth raw, what it is worth in a 10, and whether the difference covers the fee.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Grading</p>

    <div class="fk-golden">
      <p class="fk-golden-h">Read this first</p>
      <h2>PSA got a lot <span class="hl">dearer</span> this summer</h2>
      <p>${esc(psaCo.note)}</p>
    </div>

    <div class="facts" style="margin-top:20px">
      <div class="fact"><div class="n">${moneyCompact(psaCo.cheapest)}</div><div class="l">Cheapest PSA tier</div></div>
      <div class="fact"><div class="n">${moneyCompact(cheapest.cheapest)}</div><div class="l">Cheapest anywhere (${esc(cheapest.name)})</div></div>
      <div class="fact"><div class="n">${worth.length}/${rows.length}</div><div class="l">Cards that clear the PSA fee</div></div>
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${esc(longDate(g.checked) || g.checked)}</div><div class="l">Fees last checked</div></div>
    </div>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The four</p>
    <h2>What each one <span class="hl">costs</span></h2>
    <div class="gc-grid">
      ${g.companies
        .slice()
        .sort((a, b) => a.cheapest - b.cheapest)
        .map(
          (c) => `<article class="gc">
        <h3>${esc(c.name)}</h3>
        <p class="gc-price">${moneyCompact(c.cheapest)}<span> per card, ${esc(c.cheapestTier)}</span></p>
        <p class="gc-turn">${esc(c.turnaround)}</p>
        <p class="gc-note">${esc(c.note)}</p>
        <p class="gc-resale"><strong>Resale.</strong> ${esc(c.resale)}</p>
        <a class="intl-link" href="${esc(c.url)}" rel="noopener" target="_blank">Their current prices &rarr;</a>
      </article>`
        )
        .join("\n      ")}
    </div>
    <h3 class="gc-sub">And the bits nobody quotes you</h3>
    <ul class="facts-list">
      ${g.extras.map((e) => `<li><strong>${esc(e.what)}, ${esc(e.cost)}.</strong> ${esc(e.note)}</li>`).join("\n      ")}
    </ul>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Work it out</p>
    <h2>Your <span class="hl">card</span></h2>
    <p class="lede">Put in what your card sells for raw and what it sells for in a PSA 10. Both numbers are on the
      <a href="/cards.html">card search</a> and on any set guide.</p>
    <form class="gcalc" onsubmit="return false">
      <label>Raw price
        <input id="gRaw" type="number" min="0" step="0.01" inputmode="decimal" placeholder="25.00">
      </label>
      <label>PSA 10 price
        <input id="gTen" type="number" min="0" step="0.01" inputmode="decimal" placeholder="180.00">
      </label>
      <label>Grading fee
        <select id="gFee">
          ${g.companies
            .slice()
            .sort((a, b) => a.cheapest - b.cheapest)
            .map((c) => `<option value="${c.cheapest}">${esc(c.name)} ${esc(c.cheapestTier)}, ${moneyCompact(c.cheapest)}</option>`)
            .join("\n          ")}
        </select>
      </label>
    </form>
    <div class="gcalc-out" id="gOut" aria-live="polite">
      <p class="gcalc-hint">Fill both boxes and the answer appears here.</p>
    </div>
  </div>
</section>

<section class="band-sky tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Real cards</p>
    <h2>${worth.length} of ${rows.length} cards <span class="hl">clear the fee</span></h2>
    <p class="lede">Every card from our sets where we hold both a raw price and a PSA 10 price, with
      ${moneyRound(psaCo.cheapest)} plus about ${moneyRound(SHIP)} shipping subtracted. This is the upside, not the
      expectation: it assumes the card comes back a 10, and most do not.</p>

    <h3 class="gc-sub">Worth it, best first</h3>
    <ol class="gr-list">
${worth.slice(0, 20).map(verdictRow).join("\n")}
    </ol>
    ${worth.length > 20 ? `<p class="price-note">Showing the top 20 of ${worth.length}.</p>` : ""}

    ${notWorth.length ? `<h3 class="gc-sub">Not worth it at PSA's current price</h3>
    <ol class="gr-list">
${notWorth.slice(-12).reverse().map(verdictRow).join("\n")}
    </ol>
    <p class="price-note">These are cards where the PSA 10 sells for less than the raw card plus the fee. At the old
      ${moneyRound(24.99)} Value tier several of them worked. That is what a fee change does.</p>` : ""}
  </div>
</section>

<section class="tight">
  <div class="wrap">
    ${
      slabValue.length
        ? `<h2 style="margin-bottom:var(--s3)">What the slab is actually <span class="hl">worth</span></h2>
    <p class="lede" style="max-width:42em">The fee tells you what grading costs. This tells you what you get back.
      Same cards, every company's 10, from real sold prices. It reorders the question completely: the cheapest
      company to grade with returns the least, and the dearest returns the most.
      Median of ${Object.keys(graded.cards || {}).length} cards read from ${esc(graded.source || "PriceCharting")} on
      ${esc(longDate(graded.checked) || graded.checked)}. A snapshot, not a live feed, and a different source from the
      PSA 10 prices in the fee table above.</p>
    <div class="cc-scroll" style="margin-bottom:var(--s5)">
      <table class="cc-table">
        <caption class="sr-only">Median value of each grading company's 10, against the raw card and against a PSA 10</caption>
        <thead><tr>
          <th scope="col">A 10 from</th>
          <th scope="col" class="num">Median value</th>
          <th scope="col" class="num">vs the raw card</th>
          <th scope="col" class="num">vs a PSA 10</th>
        </tr></thead>
        <tbody>
          ${slabValue
            .map(
              (r) => `<tr>
            <th scope="row">${esc(r.label)}<span class="cc-yr">${r.n} cards</span></th>
            <td class="num"><strong>${moneyRound(r.med)}</strong></td>
            <td class="num">${r.vsRaw.toFixed(1)}x<span class="cc-n">the ungraded price</span></td>
            <td class="num">${r.vsPsa.toFixed(2)}x<span class="cc-n">${r.label === "PSA 10" ? "the benchmark" : r.vsPsa < 1 ? "less than PSA" : "more than PSA"}</span></td>
          </tr>`,
            )
            .join("\n          ")}
        </tbody>
      </table>
    </div>
    <div class="fk-golden" style="margin-bottom:var(--s5)">
      <p class="fk-golden-h">The part that changes the maths</p>
      <h2>Cheap to grade is not <span class="hl">cheap</span></h2>
      <p>CGC is the cheapest slab you can buy at ${moneyRound(by.cgc ? by.cgc.cheapest : 17)}, and a CGC 10 sells for
        about ${(slabValue.find((r) => r.label === "CGC 10") || {}).vsPsa?.toFixed(2)}x what the same card makes in a
        PSA 10. A BGS 10 sells for ${(slabValue.find((r) => r.label === "BGS 10") || {}).vsPsa?.toFixed(2)}x. So the
        fee is the smaller half of the decision: paying less to grade can cost you more than it saves, and the gap is
        far bigger than the difference in fees.</p>
      <p style="margin-top:10px">And every figure above is the price of a 10. You do not find out which grade you are
        getting until the card is already back, so treat the whole table as the best case rather than the expected
        one. We do not have grade distribution data and will not guess at it.</p>
    </div>
    `
        : ""
    }
    <h2>Five things worth <span class="hl">knowing</span></h2>
    <ul class="facts-list">
      ${g.rules.map((r) => `<li>${esc(r)}</li>`).join("\n      ")}
    </ul>
    <p class="price-note">Fees and turnarounds read on ${esc(longDate(g.checked) || g.checked)} and they change often,
      sometimes with a fortnight's notice, so click through before you send anything. Card prices are TCGplayer market
      and PSA 10 sale data. Raw prices are TCGplayer market via TCGdex, read ${esc(longDate(cardsChecked) || cardsChecked || "recently")},
      the same figures the rest of this site quotes. PSA 10 prices come from pokemonpricetracker.com, because no free
      feed carries graded sales; only cards with at least ten recorded sales are used. Both move daily. No affiliate
      links and no recommendation: we are not paid by any grading company and which one is right depends on your card
      and your patience. Not financial advice, just subtraction.</p>
  </div>
</section>

</main>
${footer("Grading fees change constantly. Always check the company's own page before submitting.")}
<script>
(function(){
  var raw=document.getElementById('gRaw'), ten=document.getElementById('gTen');
  var fee=document.getElementById('gFee'), out=document.getElementById('gOut');
  var SHIP=${SHIP};
  // The browser cannot import shared/format.mjs, so this is the one copy of
  // moneyExact that has to be duplicated. Keep the two in step.
  function money(n){
    return (n<0?'-$':'$')+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function run(){
    var r=parseFloat(raw.value), t=parseFloat(ten.value), f=parseFloat(fee.value);
    if(!isFinite(r)||!isFinite(t)||r<0||t<0){
      out.innerHTML='<p class="gcalc-hint">Fill both boxes and the answer appears here.</p>';
      return;
    }
    var cost=f+SHIP, net=t-r-cost;
    var good=net>0;
    var lines=''
      + '<p class="gcalc-verdict '+(good?'up':'down')+'">'+(good?'Worth a look':'Do not bother')+'</p>'
      + '<p class="gcalc-sum">'+money(t)+' in a 10, minus '+money(r)+' raw, minus '+money(cost)
      + ' to grade and ship, leaves <strong>'+money(net)+'</strong>.</p>';
    if(good){
      lines+='<p class="gcalc-note">That is the best case. It assumes a 10. A 9 on this card is usually worth a '
        + 'fraction of the 10, so you would be down the '+money(cost)+' and then some. Only send it if the card is '
        + 'genuinely mint: centred, sharp corners, clean surface.</p>';
    } else {
      lines+='<p class="gcalc-note">The gap between raw and graded does not cover the fee, so even a perfect 10 '
        + 'loses money. Keep it raw, sleeve it, and put the '+money(cost)+' towards more packs.</p>';
    }
    out.innerHTML=lines;
  }
  [raw,ten,fee].forEach(function(el){ el.addEventListener('input',run); el.addEventListener('change',run); });
})();
</script>
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/grading.html"), page);
console.log(`Wrote public/grading.html
  ${g.companies.length} companies, cheapest ${cheapest.name} at ${moneyRound(cheapest.cheapest)}, PSA at ${moneyRound(psaCo.cheapest)}
  ${rows.length} cards with both prices: ${worth.length} clear the PSA fee, ${notWorth.length} do not
  best: ${worth[0]?.name} ${moneyRound(worth[0]?.netPsa)} net`);
