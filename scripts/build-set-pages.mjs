#!/usr/bin/env node
// Generate a "Card Pokedex" page per card set, plus the /sets/ index.
//
//   node scripts/build-set-pages.mjs
//
// Reads public/data/sets.json (written by sync-sets.mjs) and videos.json.
// Everything on these pages is either a fact from the API or something a
// human wrote in data/set-notes.json. Nothing is invented: a set with no
// price data says so rather than showing zeros, and the "fun facts" are
// derived from the checklist, never from pull odds we do not have.

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS } from "../shared/chrome.mjs";
import { labelFor } from "../shared/taxonomy.mjs";
import { esc, shortDate, longDate, moneyCompact, moneyExact, rarityLabel, imgDims } from "../shared/format.mjs";
import { ripLabel } from "../shared/riplabel.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Intrinsic size of each set logo, measured from the files themselves. These
// are lazy and sit below the fold, so without a reserved box the section
// reflows as each one lands.
let LOGO_DIMS = {};
try {
  LOGO_DIMS = JSON.parse(await readFile(join(ROOT, "data/logo-dims.json"), "utf8"));
} catch {
  /* run: python3 scripts/measure-logos.py */
}
const logoAttrs = (setId) => {
  const d = LOGO_DIMS[`${setId}-pokemon-tcg-set-logo.webp`];
  return d ? ` width="${d[0]}" height="${d[1]}"` : "";
};

/**
 * THE 110px LOGO BOX. `.set-card img` is `height:42px; max-width:110px` and
 * measures 110px wide at every viewport from 360 to 1920, but the file it
 * loaded is the 300px-tall master: 480 to 1489px across and 19 to 69KB each.
 * /sets/ shows 23 of them, so it transferred 937KB of logo at 1440x900 to fill
 * boxes 110 CSS px wide. That was the worst intrinsic-to-box ratio measured
 * anywhere on the site, between 7x and 13.5x.
 *
 * build-logos.py now writes a -sm.webp beside each master at 100px tall
 * (5-17KB), which covers the 42px box at 2.4x, and this offers both so a denser
 * screen can still take the big one. The width descriptors are the real widths
 * from data/logo-dims.json rather than a guess, because the logos are
 * normalised by HEIGHT and every one is a different width.
 *
 * Only the .set-card grids use this. `.logo-big` on a set page renders at 296px
 * and `.rip-setlogo` at up to 197px, and both should keep taking the master.
 */
const SM_H = 100;
const setCardLogo = (setId, alt) => {
  const base = `/assets/logos/${setId}-pokemon-tcg-set-logo`;
  const d = LOGO_DIMS[`${setId}-pokemon-tcg-set-logo.webp`];
  const srcset = d
    ? ` srcset="${base}-sm.webp ${Math.round((d[0] * SM_H) / d[1])}w, ${base}.webp ${d[0]}w" sizes="110px"`
    : "";
  return `<img${logoAttrs(setId)} src="${base}${d ? "-sm" : ""}.webp"${srcset} alt="${alt}" loading="lazy" onerror="this.remove()">`;
};

const OUT = join(ROOT, "public/sets");

const { sets, rarityOrder, syncedAt } = JSON.parse(
  await readFile(join(ROOT, "public/data/sets.json"), "utf8")
);
// PSA 10 prices are hand-checked and live in one file, because no free price
// feed carries graded sales. A card with no entry shows its raw price alone.
// Which sets have wrapper art. Five have neither art nor a color skin, and
// naming them rendered the base Garbage Rips green: a green booster pack as
// the hero of a page titled "Black Bolt". Fall back to the generic wrapper.
const packsOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/packs")))
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.replace(/-garbage-rips-585-booster-pack\.webp$/, ""))
);
const packClass = (id) => (packsOnDisk.has(id) ? id : "default");

// Which sets have their own share card, for the Article schema's image.
const ogCards = new Set(
  (await readdir(join(ROOT, "public/assets")))
    .map((f) => /^og-(.+)\.jpg$/.exec(f)?.[1])
    .filter(Boolean)
);

let psa10 = {};
try {
  psa10 = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8")) || {};
} catch {
  /* optional */
}
// Two sources, and the person always wins. `prices` is what Tim typed through
// the spreadsheet; `auto` is what sync-prices.mjs fetched and owns. A sync must
// never overwrite a number he checked himself, so it is read second.
const gnum = (v) => (typeof v === "number" ? v : typeof v?.price === "number" ? v.price : null);
// A synced price needs enough sales behind it to mean anything. Volcarona came
// back at 15x its raw price off six recorded sales, which is an anecdote, not a
// market. Hand-entered prices skip this test: if Tim typed it, he stands
// behind it.
const MIN_SALES = 10;
const gradedPrice = (setId, number) => {
  const k = `${setId}-${number}`;
  const manual = gnum(psa10.prices?.[k]) ?? gnum(psa10[k]);
  if (manual) return manual;
  const a = psa10.auto?.[k];
  if (!a?.psa10) return null;
  if (a.psa10Sales != null && a.psa10Sales < MIN_SALES) return null;
  return a.psa10;
};
const gradedAsOf = (setId, number) => {
  const k = `${setId}-${number}`;
  return psa10.prices?.[k]?.asOf || psa10[k]?.asOf || psa10.auto?.[k]?.asOf || null;
};

/**
 * Chase cards for the sets the Pokemon TCG API has no prices for.
 *
 * The four newest sets had full checklists but no market data, so the price
 * sort had nothing to sort and "Top chase cards" rendered an apology on
 * exactly the sets people are opening right now. scripts/sync-chase.mjs joins
 * the cached checklist to TCGplayer's prices; this merges the result in.
 *
 * Only ever fills a gap. A set that has its own priced chase list keeps it, so
 * the Pokemon TCG API stays the primary source and this cannot quietly
 * overwrite it. `priceSource` is stamped so the page can say where the number
 * came from rather than implying both came from the same place.
 */
/**
 * Hand written set notes, merged straight from data/set-notes.json.
 *
 * sync-sets.mjs also folds these into sets.json, but that script pulls the full
 * checklist for every set from an API that rate-limits hard, so requiring a run
 * of it to publish a one-line fun fact meant the note either waited for the
 * next sync or never appeared. Read here as well, so the loop is import then
 * build, and whatever the file says wins over whatever sets.json was carrying.
 */
let setNotes = {};
try {
  setNotes = JSON.parse(await readFile(join(ROOT, "data/set-notes.json"), "utf8"));
} catch {
  /* optional */
}
for (const st of sets) {
  const n = setNotes[st.id];
  if (!n) continue;
  st.notes = { ...(st.notes || {}), ...n };
}

/**
 * The foreign set an English release came from, for the "Also known as" panel.
 *
 * Worth a panel rather than a footnote because the relationship is not one to
 * one and almost nobody knows it: Mega Evolution is TWO Japanese sets merged,
 * and every English set trails its Japanese parent by weeks, which is why the
 * cards turn up in Japanese first and why people ask about them.
 */
let intlSets = {};
try {
  intlSets = JSON.parse(await readFile(join(ROOT, "public/data/intl-sets.json"), "utf8")).sets || {};
} catch {
  /* run: node scripts/sync-intl.mjs */
}

// The non-English sets that have a guide of their own, keyed by the English set
// they map to. The panel above names the foreign set a guide is built from;
// where we have also opened packs of it, that name should be a link rather than
// a dead end. Written by sync-intl-guides.mjs.
let intlGuides = {};
const guideForForeign = new Map(); // tcgdex id + language -> our page id
try {
  intlGuides = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {};
  for (const [id, g] of Object.entries(intlGuides)) guideForForeign.set(`${g.lang}:${g.tcgdexId}`, { id, ...g });
} catch {
  /* run: node scripts/sync-intl-guides.mjs */
}

// The full card list per set, written by sync-cards.mjs. Until this existed the
// English guides showed rarity totals and eight chase cards and nothing else,
// while the imported guides listed every card, which was exactly backwards: the
// sets Tim actually rips had less detail than the ones he does not.
let checklists = {};
try {
  const dir = join(ROOT, "public/data/cards");
  for (const f of await readdir(dir)) {
    if (!f.endsWith(".json")) continue;
    const doc = JSON.parse(await readFile(join(dir, f), "utf8"));
    checklists[doc.set] = doc;
  }
} catch {
  /* run: node scripts/sync-cards.mjs */
}

/**
 * WHERE A SET'S VALUE ACTUALLY SITS, from the checklist and nothing else.
 *
 * The guides could already tell you the eight priciest cards and the total card
 * count and never the relationship between them, which is the thing a person
 * deciding whether to open a set is actually asking. It is pure arithmetic over
 * prices this page already prints, so it costs no new source and can be checked
 * by hand against the checklist band directly below it.
 *
 * Everything here is a sum, a sort or a count. NONE of it is a pull rate, an
 * expected value or a claim about what is in a pack: it is what buying one copy
 * of every card would cost and how that total is distributed, which is a
 * different question and the only one the data can answer.
 *
 * Returns null rather than a half-filled object when there is not enough priced
 * data to say anything, and THROWS when the arithmetic does not close, because
 * a concentration figure that does not add up is worse than no band at all.
 */
function setValue(s) {
  const doc = checklists[s.id];
  if (!doc?.cards?.length) return null;

  const prices = doc.cards
    .filter((c) => typeof c.price === "number" && c.price > 0)
    .map((c) => c.price)
    .sort((a, b) => b - a);
  // Under twenty priced cards there is no distribution to describe: "half the
  // value is in 2 cards" out of 9 is a sentence about a rounding error.
  if (prices.length < 20) return null;

  const sum = prices.reduce((a, b) => a + b, 0);
  // Smallest number of cards from the top whose prices reach half the total.
  let acc = 0;
  let half = 0;
  for (const p of prices) {
    acc += p;
    half += 1;
    if (acc >= sum / 2) break;
  }
  const topN = Math.min(10, prices.length);
  const topSum = prices.slice(0, topN).reduce((a, b) => a + b, 0);
  const median = prices[Math.floor(prices.length / 2)];
  const rest = sum - acc;
  const restCount = prices.length - half;
  const topShare = Math.round((topSum / sum) * 100);

  const bad = [];
  if (!(sum > 0) || !Number.isFinite(sum)) bad.push(`total is ${sum}`);
  if (acc < sum / 2 - 0.005) bad.push(`top ${half} cards sum to ${acc}, under half of ${sum}`);
  if (acc > sum + 0.005) bad.push(`top ${half} cards sum to ${acc}, over the total ${sum}`);
  if (half < 1 || half > prices.length) bad.push(`half-of-value count is ${half} of ${prices.length}`);
  if (restCount < 0 || half + restCount !== prices.length) bad.push(`${half} + ${restCount} is not ${prices.length}`);
  if (rest < -0.005) bad.push(`remainder is ${rest}`);
  if (topSum > sum + 0.005) bad.push(`top ${topN} sum ${topSum} exceeds total ${sum}`);
  if (topShare < 0 || topShare > 100) bad.push(`top ${topN} share is ${topShare}%`);
  if (median > prices[0] || median < prices[prices.length - 1]) bad.push(`middle price ${median} is outside the range`);
  if (bad.length) {
    throw new Error(
      `setValue(${s.id}): the checklist arithmetic does not close, so the band would print a wrong figure.\n  ` +
        bad.join("\n  ") +
        `\nCheck public/data/cards/${s.id}.json, then re-run scripts/sync-cards.mjs.`
    );
  }

  return {
    checked: doc.checked,
    counted: prices.length,
    total: doc.cards.length,
    sum,
    half,
    rest,
    restCount,
    restEach: restCount > 0 ? rest / restCount : null,
    topN,
    topShare,
    median,
  };
}

/**
 * "Where the money is": the concentration band.
 *
 * Sits above the Quick Facts because it reframes everything under it. The
 * rarity ladder and the checklist both read differently once you know that four
 * cards hold half the set.
 */
function valueBand(s, cls) {
  const v = setValue(s);
  if (!v) return "";
  const some = v.counted === v.total ? "every card" : `each of the ${v.counted} cards that has a price`;
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Where the value sits</p>
    <h2>Where the <span class="hl">money</span> is</h2>
    <p class="lede" style="max-width:42em">Buy one copy of ${some} in ${esc(s.name)} at market price and you would spend
      ${moneyExact(v.sum)}. ${
        v.half === 1
          ? `More than half of that is a single card.`
          : `Half of it sits in ${v.half} cards.`
      } The other ${v.restCount} come to ${moneyExact(v.rest)} between them${
        v.restEach ? `, which is ${moneyExact(v.restEach)} a card` : ""
      }.</p>
    <div class="facts">
      <div class="fact"><div class="n">${moneyCompact(v.sum)}</div><div class="l">One of every card</div></div>
      <div class="fact"><div class="n">${v.half}</div><div class="l">Cards holding half the value</div></div>
      <div class="fact"><div class="n">${v.topShare}%</div><div class="l">Held by the ${v.topN} priciest</div></div>
      <div class="fact"><div class="n">${moneyExact(v.median)}</div><div class="l">The middle card</div></div>
    </div>
    <p class="lede sv-say">In plain terms: a handful of cards carry the set and everything else is bulk. That is normal,
      it is true of nearly every modern set, and it is worth knowing before you buy a box hoping to "get your money
      back".</p>
    <p class="price-note">Added up from the ${v.counted} market prices in the checklist below, read
      ${esc(longDate(v.checked) || v.checked)}. This is what buying one of each card would cost. It is not what a booster
      box is worth, and it is not the chance of pulling anything: nobody outside The Pokemon Company has pull rates, so
      you will not find any on this site.</p>
  </div>
</section>`;
}

/**
 * Median and top price per rarity, keyed by the Title Case rarity label.
 *
 * ONLY returned for a rarity where the checklist and the set's own rarity
 * counts agree AND every card at that rarity carries a price, because the line
 * says "half are worth more, half less" and that is only true of a complete
 * set of prices. Four sets disagree with their own checklists on at least one
 * tier (sets.json calls seven Ascended Heroes cards "Mega Attack Rare" where
 * the checklist calls them Ultra Rare, and Pokemon GO uses an entirely
 * different vocabulary), so those tiers get no price line rather than a figure
 * describing a different number of cards than the one printed next to it.
 */
function rarityPrices(s) {
  const out = new Map();
  const doc = checklists[s.id];
  if (!doc?.cards?.length) return out;

  const by = new Map();
  for (const c of doc.cards) {
    const k = rarityLabel(c.rarity);
    if (!k) continue;
    if (!by.has(k)) by.set(k, { n: 0, prices: [] });
    const e = by.get(k);
    e.n += 1;
    if (typeof c.price === "number" && c.price > 0) e.prices.push(c.price);
  }

  for (const [r, n] of Object.entries(s.rarities || {})) {
    const key = rarityLabel(r) || r;
    const e = by.get(key);
    if (!e || e.n !== n || e.prices.length !== n) continue;
    const asc = e.prices.slice().sort((a, b) => a - b);
    const mid = asc[Math.floor(asc.length / 2)];
    const top = asc[asc.length - 1];
    if (!(mid > 0) || !(top > 0) || mid > top) {
      throw new Error(
        `rarityPrices(${s.id}): ${key} produced mid ${mid} and top ${top} from ${asc.length} prices, ` +
          `which cannot both be right. Check public/data/cards/${s.id}.json.`
      );
    }
    out.set(key, { n, mid, top });
  }
  return out;
}

function checklistBand(s, cls) {
  const doc = checklists[s.id];
  if (!doc?.cards?.length) return "";
  const priced = doc.cards.filter((c) => c.price != null);
  const priciest = priced.slice().sort((a, b) => b.price - a.price)[0];

  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Every card</p>
    <h2>Full <span class="hl">checklist</span></h2>
    <p class="lede">All ${doc.cards.length} cards in ${esc(s.name)}, with what each one is worth.${
      priciest ? ` The most expensive card in the set is ${esc(priciest.name)} at ${moneyExact(priciest.price)}.` : ""
    }</p>
    <details class="ig-list">
      <summary>Show the full ${esc(s.name)} checklist</summary>
      <ol class="ig-cards en">
        ${doc.cards
          .map(
            (c) => `<li><span class="ig-no">${esc(c.n || "")}</span>
          <span class="ig-nm">${esc(c.name)}</span>
          ${c.price != null ? `<span class="ig-pr">${moneyExact(c.price)}</span>` : ""}
          ${c.rarity ? `<span class="ig-rr2">${esc(rarityLabel(c.rarity))}</span>` : ""}</li>`
          )
          .join("\n        ")}
      </ol>
    </details>
    <p class="price-note">TCGplayer market prices via TCGdex, read ${esc(longDate(doc.checked) || doc.checked)}.
      Where a card exists as a normal, holo and reverse holo at different prices, the figure shown is the priciest of
      them, because that is the one people mean. ${priced.length} of ${doc.cards.length} cards have a price.
      Looking for one card in particular? <a href="/cards.html?set=${esc(s.id)}">Search every card on the site</a>.</p>
  </div>
</section>`;
}

/** "8 weeks earlier", from two ISO dates. */
function leadTime(earlier, later) {
  if (!earlier || !later) return null;
  const days = Math.round((new Date(later) - new Date(earlier)) / 86400000);
  if (days < 7) return null;
  if (days < 60) return `${Math.round(days / 7)} weeks earlier`;
  return `${Math.round(days / 30.44)} months earlier`;
}

function intlBand(s, cls) {
  const e = intlSets[s.id];
  if (!e?.sources?.length) return "";
  const many = e.sources.length > 1;
  const rows = e.sources
    .map((src) => {
      const lead = leadTime(src.released, s.released);
      // Where we have opened packs of this exact set, it has a guide here and
      // the link should stay on the site. Sending someone to TCGdex when we
      // have our own page for it is the one thing this panel should not do.
      const own = guideForForeign.get(`${src.lang}:${src.id}`);
      return `      <li class="intl">
        <p class="intl-lang">${esc(src.langName)}${src.id ? ` &bull; ${esc(src.id)}` : ""}</p>
        <h3 lang="${src.lang}">${esc(src.name)}</h3>
        ${own ? `<p class="intl-romaji">${esc(own.english)}</p>` : src.romaji ? `<p class="intl-romaji">${esc(src.romaji)}</p>` : ""}
        <p class="intl-meta">${[
          src.total ? `${src.total} cards` : null,
          src.released ? longDate(src.released) : null,
        ].filter(Boolean).map(esc).join(" &bull; ")}</p>
        ${lead ? `<p class="intl-lead">Out ${esc(lead)} than the English set</p>` : ""}
        ${own
          ? `<a class="intl-link" href="/sets/${esc(own.id)}.html">Read the ${esc(own.english)} guide &rarr;</a>`
          : // The fallback used to link to www.tcgdex.net/<lang>/sets/<id>, which
            // 404s: TCGdex publishes api., assets. and tcgdex.dev and has no
            // consumer site. Rather than send people to a dead page, the card
            // says plainly that we have not written this one up.
            `<p class="intl-lead is-none">No guide for this one yet</p>`}
      </li>`;
    })
    .join("\n");

  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Same set, other language</p>
    <h2>${esc(s.name)} is also <span class="hl">${esc(e.sources.map((x) => x.name).join(" + "))}</span></h2>
    <p class="lede intl-lede">${
      many
        ? `Two Japanese sets were merged into one English release, which is why ${esc(s.name)} is bigger than either of them.`
        : `The Japanese release came first. Same cards, different printing and a different set symbol.`
    }${e.note ? ` ${esc(e.note)}` : ""}</p>
    <ul class="intl-grid">
      <li class="intl is-en">
        <p class="intl-lang">English${s.apiId ? ` &bull; ${esc(String(s.apiId).toUpperCase())}` : ""}</p>
        <h3>${esc(s.name)}</h3>
        <p class="intl-meta">${[
          s.total ? `${s.total} cards` : null,
          s.released ? longDate(s.released) : null,
        ].filter(Boolean).map(esc).join(" &bull; ")}</p>
        <p class="intl-lead">The one on this page</p>
      </li>
${rows}
    </ul>
    ${
      e.confidence !== "confirmed"
        ? `<p class="intl-warn">Matched on set numbering and card counts rather than an official statement. If that is wrong, say so on any of the socials.</p>`
        : ""
    }
  </div>
</section>`;
}

let chaseFallback = {};
try {
  chaseFallback = JSON.parse(await readFile(join(ROOT, "data/chase-tcg.json"), "utf8")).sets || {};
} catch {
  /* run: node scripts/sync-chase.mjs */
}
for (const st of sets) {
  const mine = st.chase || [];
  if (mine.length && mine.some((c) => c.price)) continue;
  const fill = chaseFallback[st.id];
  if (!fill?.cards?.length) continue;
  st.chase = fill.cards;
  st.chasePriceSource = "TCGplayer";
  st.chasePricesAsOf = fill.checked;
}

const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

// CARDS WE ACTUALLY PULLED FROM THIS SET, which is a different question from
// the chase list above it. The chase list is what the set is worth hunting;
// this is what came out of the packs on camera, so it is the only part of a set
// guide that no other site can write.
//
// Prices are looked up from the set's own card data, never stored here, so a
// nightly refresh moves this section like everything else. A promo carries its
// own price because it is not in any set checklist.
const HITS = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")).videos || {};
const hitsBySet = new Map();
for (const [vid, list] of Object.entries(HITS)) {
  for (const h of list) {
    if (!h.set) continue;
    if (!hitsBySet.has(h.set)) hitsBySet.set(h.set, []);
    hitsBySet.get(h.set).push({ ...h, vid });
  }
}
const videoById = new Map(videos.map((v) => [v.id, v]));
const setNameById = new Map(sets.map((x) => [x.id, x.name]));
// Every rip of this set, newest first. The guide previously linked only to
// /videos.html?set=<id>, which is a static file: every variant serves a
// canonical pointing at the bare url, so 888 internal links across the site
// funnelled into one page and not one of the rips was reachable from a guide.
// 115 rip pages sat more than three clicks from the home page as a result.
const ripsList = new Map();
for (const v of videos) {
  for (const id of v.sets || []) {
    if (!ripsList.has(id)) ripsList.set(id, []);
    ripsList.get(id).push(v);
  }
}
for (const list of ripsList.values()) {
  list.sort((a, b) => String(b.published).localeCompare(String(a.published)));
}
const descriptions = JSON.parse(await readFile(join(ROOT, "data/descriptions.json"), "utf8").catch(() => "{}"));

function yearsSince(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 0) return "not out yet";
  if (days < 1) return "today";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months ago`;
  return `${Math.floor(months / 12)} years ago`;
}

// Sealed product prices keep their cents at every size. moneyCompact() rounds above
// $100, which is right for a card worth "about $400" and wrong for a shelf
// price: it turned a $149.76 Elite Trainer Box into "$150", which is a number
// that appears on no listing anywhere.
const priceUSD = (n) =>
  `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Rarities worth chasing, for highlighting in the ladder.
const CHASE = new Set([
  "Mega Hyper Rare", "Hyper Rare", "Special Illustration Rare",
  "Illustration Rare", "Ultra Rare", "ACE SPEC Rare", "Radiant Rare",
]);

// Affiliate config. Off by default; flip enabled in data/affiliate.json once
// the Impact application is approved and every TCGplayer link is rewritten.
let aff = { tcgplayer: { enabled: false } };
try {
  aff = JSON.parse(await readFile(join(ROOT, "data/affiliate.json"), "utf8"));
} catch {
  /* optional */
}
const affOn = Boolean(aff.tcgplayer?.enabled && aff.tcgplayer?.linkTemplate);
/**
 * A set guide's <title>, brand appended only when it fits.
 *
 * The fixed part was "Set Guide: Cards, Rarities & Chase Card Values | Garbage
 * Rips 585", which is 65 characters BEFORE the set name. Every one of the 23
 * guides therefore blew past the ~60 characters Google shows, and the two
 * longest reached 90: the brand and half the description were cut off in the
 * result, on the pages doing most of the site's SEO work.
 *
 * The descriptor is shorter now, and the brand is appended only if the whole
 * thing still fits. Dropping the brand on a long set name is the better trade:
 * the set name is what somebody searched for, and a truncated brand helps
 * nobody. Short names keep it.
 */
const MAX_TITLE = 60;
const BRAND = " | Garbage Rips 585";
const setTitle = (name) => {
  // The brand is kept in EVERY case and the descriptor gives way instead.
  // Dropping it saved characters but cost the thing these pages are for: the
  // site is trying to become a recognized entity, and 22 of 23 guides losing
  // the name was the wrong half to sacrifice. "Set Guide" is the phrase people
  // actually search next to a set name, so it is the part that stays; the
  // rarities and values wording lives on in the H1 and the meta description,
  // which is where it was doing the work anyway.
  const rich = `${name} Set Guide: Cards & Values${BRAND}`;
  return rich.length <= MAX_TITLE ? rich : `${name} Set Guide${BRAND}`;
};

const affLink = (url) =>
  affOn ? aff.tcgplayer.linkTemplate.replace("{url}", encodeURIComponent(url)) : url;

const ripsBySet = {};
for (const v of videos) for (const s of v.sets || []) ripsBySet[s] = (ripsBySet[s] || 0) + 1;

// Sealed products and their TCGplayer market prices, from sync-products.mjs.
// Optional: a set with no entry simply renders no band rather than an empty one.
let productsBySet = {};
try {
  productsBySet = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8")).sets || {};
} catch {
  /* run: node scripts/sync-products.mjs */
}

/**
 * "What you can buy": the sealed products for this set, cheapest first.
 *
 * Two prices per product, because they answer different questions and people
 * conflate them constantly. Market is what it actually sells for, which is the
 * honest number for "is this worth it". Low is the cheapest listing right now,
 * which is what you would pay today. Showing only one of them would mislead in
 * one direction or the other, and on some products they are wildly apart: the
 * Phantasmal Flames booster box reads $391 market against an $87 low.
 *
 * Images are hotlinked to TCGplayer's CDN. Every card links back to the
 * listing, and the band says out loud where the numbers came from and when,
 * because these move daily and a stale price presented as current is the one
 * way this section could actually cost somebody money.
 */
/**
 * How many packs are in a sealed product, READ OFF THE BLURB ON THE SAME CARD.
 *
 * Deliberately not a lookup table keyed by product kind. The blurb is printed
 * two lines above the price on the page, so a reader can check the division
 * themselves, and a kind-keyed table is exactly what would have got this wrong:
 * eight of the fifteen "Booster Box" entries are a HALF booster box, which is a
 * different number of packs from the "36 packs" the kind carries. Dividing
 * those by 36 would have published a per-pack price roughly half the real one
 * on a third of the guides.
 *
 * So: a count only when the blurb states one, and never when the product name
 * carries a size word whose real pack count is not in our data. No count means
 * no per-pack figure on that card. Blisters, tins and collection boxes say
 * "packs plus a promo" with no number and are left alone for the same reason.
 */
const SIZE_WORD = /\b(half|enhanced|mini|jumbo|premium|double)\b/i;
function packsIn(p) {
  if (SIZE_WORD.test(p.name || "")) return null;
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

/**
 * What to CALL a product, and what to say is inside it.
 *
 * `kind` and `blurb` are per-kind generics written by sync-products.mjs, and on
 * eight of the twenty-three guides they are wrong about the same product:
 * TCGplayer sells a "Half Booster Box" and the card was labelling it "Booster
 * Box" with "36 packs" underneath. The guide was already printing a pack count
 * for a product that does not hold that many; adding a price per pack on top of
 * it would have doubled the error rather than introduced it.
 *
 * Where the product NAME ends in "<size word> <kind>" the size word is real and
 * the generic blurb is not, so the name wins and the blurb is DROPPED rather
 * than corrected. How many packs a half box or an enhanced box holds is not in
 * our data, and a plausible guess in a slot people read as a fact is exactly
 * the thing this site does not do.
 */
function productLabel(p) {
  const q = SIZE_WORD.exec(p.name || "")?.[1];
  if (!q) return { kind: p.kind, blurb: p.blurb };
  const full = `${q} ${p.kind}`;
  if (!String(p.name).toLowerCase().endsWith(full.toLowerCase())) return { kind: p.kind, blurb: p.blurb };
  return { kind: full.charAt(0).toUpperCase() + full.slice(1), blurb: "Pack count not in our data" };
}

/** Market price per pack, or null where the pack count is not knowable. */
function perPack(p) {
  const packs = packsIn(p);
  if (!packs || typeof p.market !== "number" || !(p.market > 0)) return null;
  const each = p.market / packs;
  if (!Number.isFinite(each) || each <= 0 || each > p.market + 0.005) {
    throw new Error(`perPack: "${p.name}" gives ${each} per pack from ${p.market} over ${packs} packs.`);
  }
  return { packs, each };
}

function productBand(s, cls) {
  const entry = productsBySet[s.id];
  if (!entry?.products?.length) return "";

  const items = [...entry.products].sort((a, b) => a.market - b.market);
  const cheapest = items[0];

  // THE QUESTION THE OLD BAND DID NOT ANSWER. It listed six prices for six
  // differently sized things, cheapest total first, which tells you what you can
  // afford and not what anything costs. A booster box at $179 next to a pack at
  // $6.55 is not a comparison until both are per pack.
  const perPacks = items
    .map((p) => ({ p, ...(perPack(p) || {}) }))
    .filter((x) => x.each)
    .sort((a, b) => a.each - b.each);
  const bestPack = perPacks[0] || null;
  const singly = perPacks.find((x) => x.packs === 1) || null;
  const next = perPacks[1] || null;
  // Two different questions, and the lede answers whichever ones apply without
  // saying the same dollar figure twice. "Cheapest way in" is the smallest
  // amount of money that gets you playing. "Cheapest per pack" is what a pack
  // costs, which is the one that decides between a box and a handful of packs.
  const name = (x) => esc(productLabel(x).kind.toLowerCase());
  let lede = `Every sealed ${esc(s.name)} product still being sold, cheapest first.`;
  const cheaperBox = bestPack && singly && bestPack.p !== singly.p;
  const off = cheaperBox ? Math.round(((singly.each - bestPack.each) / singly.each) * 100) : 0;

  if (singly && cheapest === singly.p) {
    // A single pack is both the smallest outlay and, on 13 of the 23 sets, the
    // cheapest pack there is. Saying "$6.55" twice in two sentences is what the
    // first draft did, so the two claims share one figure here.
    lede += cheaperBox
      ? ` The cheapest way in is one pack at ${priceUSD(singly.each)}, but the cheapest pack in the set is inside the
      ${name(bestPack.p)} at ${priceUSD(bestPack.each)}${off >= 1 ? `, which is ${off}% less` : ""}.`
      : ` The cheapest way in is also the cheapest pack: one pack at ${priceUSD(singly.each)}.${
          next ? ` The ${name(next.p)} works out at ${priceUSD(next.each)} a pack, so on this set the bigger boxes cost
      more per pack, not less.` : ""
        }`;
  } else {
    lede += ` The cheapest way in is ${name(cheapest)} at ${priceUSD(cheapest.market)}.`;
    if (cheaperBox) {
      lede += ` Packs bought one at a time are ${priceUSD(singly.each)} each; the cheapest pack in the set is inside the
      ${name(bestPack.p)} at ${priceUSD(bestPack.each)}${off >= 1 ? `, which is ${off}% less` : ""}.`;
    } else if (bestPack && singly) {
      lede += ` No box here beats a single pack per pack, at ${priceUSD(singly.each)}${
        next ? `: the ${name(next.p)} works out at ${priceUSD(next.each)}` : ""
      }.`;
    } else if (bestPack) {
      lede += ` The cheapest pack here is inside the ${name(bestPack.p)} at ${priceUSD(bestPack.each)}.`;
    }
  }

  // imgDims(), not a literal, and on TCGplayer's host it deliberately returns
  // NOTHING. These 139 photos carried width="245" height="337", which is a card
  // scan's shape: the real files are 200x268, 200x294, 200x360 and 200x417
  // depending on the product, so the declaration was wrong by up to 34%. It
  // reserved nothing anyway, because .prod-shot is a fixed 88x88 box with
  // object-fit:contain. Use the helper for every remote image so the site
  // cannot drift back into guessing at somebody else's file.
  const cards = items
    .map(
      (p) => `      <li class="prod">
        <a class="prod-shot" href="${esc(affLink(p.url))}" rel="noopener" target="_blank" tabindex="-1" aria-hidden="true">
          <img src="${esc(p.thumb)}" srcset="${esc(p.thumb)} 200w, ${esc(p.image)} 1000w"
               sizes="(max-width:640px) 40vw, 200px" alt="" loading="lazy" onerror="this.remove()" decoding="async"${imgDims(p.thumb)} referrerpolicy="no-referrer">
        </a>
        <div class="prod-body">
          <h3><a href="${esc(affLink(p.url))}" rel="noopener" target="_blank">${esc(productLabel(p).kind)}</a></h3>
          <p class="prod-what">${esc(productLabel(p).blurb)}</p>
          <p class="prod-price"><b>${priceUSD(p.market)}</b> <span>market</span></p>
          ${(() => {
            const e = perPack(p);
            if (!e || e.packs === 1) return "";
            return `<p class="prod-per">${priceUSD(e.each)} a pack${
              bestPack && bestPack.p === p ? ` <b>cheapest</b>` : ""
            }</p>`;
          })()}
          ${
            p.low
              ? `<p class="prod-low">Cheapest listing ${priceUSD(p.low)}${
                  p.listings ? ` &bull; ${p.listings} seller${p.listings === 1 ? "" : "s"}` : ""
                }</p>`
              : ""
          }
        </div>
      </li>`
    )
    .join("\n");

  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What you can buy</p>
    <h2>Ways to open <span class="hl">${esc(s.name)}</span></h2>
    <p class="lede prod-lede">${lede}</p>
    <ul class="prod-grid">
${cards}
    </ul>
    <p class="prod-note">Prices are TCGplayer market and lowest-listing prices, read on
      ${esc(longDate(entry.checked))}. They move every day, so treat them as a rough idea and not a quote.
      Product photos are TCGplayer's. We are not a shop and we do not sell any of this.</p>
    ${perPacks.length ? `<p class="prod-note">Cost per pack is the market price divided by the pack count printed on
      each card above, so you can check it. Sleeves, dice, decks and promo cards are counted as worth nothing, which
      flatters every box that includes them. Anything whose pack count is not in our data gets no per-pack figure
      rather than a guessed one, which is why blisters, tins and collection boxes have none.</p>` : ""}
  </div>
</section>`;
}

/** Facts pulled straight out of the checklist. No pull rates: we do not have them. */
function derivedFacts(s) {
  const out = [];
  const rar = s.rarities || {};
  const total = s.cardsSeen || 0;

  if (s.released) {
    out.push(`<b>Released ${longDate(s.released)}</b>, which was ${yearsSince(s.released)}.`);
  }
  if (s.printedTotal && s.secretCount) {
    out.push(
      `The set is <b>${s.printedTotal} cards</b> on paper, but there are <b>${s.total}</b> in total. ` +
      `The extra ${s.secretCount} are secret rares numbered past the printed count.`
    );
  }
  const chaseCount = Object.entries(rar)
    .filter(([r]) => CHASE.has(r))
    .reduce((a, [, n]) => a + n, 0);
  if (chaseCount && total) {
    out.push(
      `<b>${chaseCount} of the ${total} cards</b> are Ultra Rare or better. ` +
      `That is the slice of the checklist worth pulling.`
    );
  }
  for (const r of ["Mega Hyper Rare", "Hyper Rare", "Special Illustration Rare"]) {
    if (rar[r]) {
      const n = rar[r];
      out.push(
        `Only <b>${n} ${r}${n === 1 ? "" : "s"}</b> ${n === 1 ? "exists" : "exist"} in the entire set.`
      );
      break;
    }
  }
  if (s.chase?.length) {
    const top = s.chase[0];
    out.push(
      `The chase card is <b>${esc(top.name)}</b>${top.rarity ? ` (${esc(rarityLabel(top.rarity))})` : ""}, ` +
      `sitting around <b>${moneyCompact(top.price)}</b> raw` +
      (gradedPrice(s.id, top.number)
        ? `, and <b>${moneyCompact(gradedPrice(s.id, top.number))}</b> in a PSA 10.`
        : `.`)
    );
  }
  const rips = ripsBySet[s.id];
  if (rips) {
    out.push(`We have ripped <b>${rips} ${rips === 1 ? "video" : "videos"}</b> worth of this set on the channel.`);
  }
  return out;
}

/**
 * The handful of rules only a set guide needs, inlined here rather than added
 * to assets-source/ui.css, which is render blocking on all 426 pages. Same
 * pattern as build-expansions.mjs and build-luck.mjs. Everything else on these
 * pages is a class ui.css already carries.
 */
const PAGE_CSS = `
/* The money-per-rarity line under each bar. .rar is a two column grid whose
   .rar-bar already spans both, so this sits between the count and the bar and
   spans the full width too. Mono, because it is a figure. */
.rar-pr{grid-column:1 / -1;font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);
  letter-spacing:.02em}
.rar-pr b{color:var(--ketchup-deep);font-weight:700}
.band-sky .rar-pr{color:var(--navy)}
/* The plain-English read of the value band. Same size as a lede, set apart so
   it does not read as a third paragraph of numbers. */
.sv-say{max-width:42em;margin-top:var(--s5);border-left:4px solid var(--gold);
  padding-left:var(--s4);font-size:var(--t-body)}
/* Cost per pack. Sits directly under the total price it is derived from. */
.prod-per{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);
  letter-spacing:.04em;text-transform:uppercase;margin-top:3px}
.prod-per b{display:inline-block;background:var(--mustard);color:var(--ink);
  border-radius:var(--r-pill);padding:1px 7px;margin-left:4px;font-weight:700}
`;

/**
 * The same trade build-css.mjs makes for ui.css, for the same reason: the
 * comments are the point of the SOURCE and pure weight in the shipped page, and
 * this block is inline in a render blocking <head>. Comments only, plus the
 * indentation between rules. Nothing else is touched.
 */
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const head = ({ title, desc, canonical, image, ld, css = "" }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="preconnect" href="https://images.pokemontcg.io" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css">
${STYLES}${css ? `\n<style>${miniCSS(css)}</style>` : ""}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
`;

// ------------------------------------------------------------------ a set
function setPage(s) {
  const url = `${SITE}/sets/${s.id}.html`;
  const logo = `/assets/logos/${s.id}-pokemon-tcg-set-logo.webp`;
  const rips = ripsBySet[s.id] || 0;
  const label = labelFor("sets", s.id);
  const desc =
    `${s.name} Pokemon TCG set guide: ${s.total || "?"} cards, released ` +
    `${longDate(s.released) || "recently"}, full rarity breakdown` +
    (s.chase?.length ? `, and the top chase cards with current market values.` : `.`);

  const ordered = Object.entries(s.rarities || {}).sort((a, b) => {
    const ia = rarityOrder.indexOf(a[0]), ib = rarityOrder.indexOf(b[0]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const maxN = Math.max(1, ...ordered.map(([, n]) => n));

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${s.name} Pokemon TCG Set Guide`,
      description: desc,
      // Required for the Article rich result. All 23 guides were omitting it,
      // which made every one of them structurally ineligible. Prefer the set's
      // own share card where we generated one.
      image: [ogCards.has(s.id) ? `${SITE}/assets/og-${s.id}.jpg` : `${SITE}/assets/og-image.jpg`],
      about: { "@type": "Thing", name: `${s.name} (Pokemon Trading Card Game)` },
      url,
      datePublished: syncedAt,
      dateModified: syncedAt,
      author: { "@type": "Organization", name: "Garbage Rips 585", url: SITE + "/" },
      publisher: {
        "@type": "Organization",
        name: "Garbage Rips 585",
        logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-square.jpg` },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Card Sets", item: `${SITE}/sets/` },
        { "@type": "ListItem", position: 3, name: s.name },
      ],
    },
  ];
  // NO "top chase cards" ItemList. Every set page used to push one whose
  // entries carried a `name` and a `position` and nothing else, which names a
  // card the crawler cannot follow, so the whole block was ignored.
  //
  // Nothing on this site can stand in as the target. The chase cards render as
  // `<button class="chase-card">` with no id to anchor to, and their only real
  // link is the TCGplayer url behind the lightbox, which is a shop listing and
  // not a page about the card. The /sets/ index ItemList further down is the
  // one that stays, because a set genuinely has a page of its own.

  const rarPr = rarityPrices(s);

  // ---------------------------------------------------------------- the bands
  //
  // Each section is a function of ONE argument: the class that paints it. They
  // were hard coded, and the result was three identical sky bands stacked on
  // Surging Sparks (rips, pulled on camera, chase cards) and three identical
  // cream ones on Pitch Black (rarity, checklist, also-known-as). A guide read
  // as one long scroll rather than as sections, which is a real cost on a page
  // whose whole job is to be skimmed.
  //
  // It cannot be fixed by hard coding a better order either, because which
  // sections exist varies per set: eight guides have no rips, most have nothing
  // in "pulled on camera", and only some have a foreign twin. The tone has to
  // be assigned after the list of present sections is known.
  const bands = [
    (() => {
      // Newest twelve. All of them on a 90-rip set would be a wall, and the link at
      // the end covers the rest.
      const all = ripsList.get(s.id) || [];
      const show = all.slice(0, 12);
      if (!show.length) return null;
      return (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>On the channel</p>
    <h2>Every ${esc(s.name)} <span class="hl">rip</span></h2>
    <p class="lede" style="max-width:38em">${all.length} video${all.length === 1 ? "" : "s"} opening this set${
        all.length > show.length ? `, newest ${show.length} below` : ""
      }.</p>
    <ul class="riplist">
      ${show
        .map(
          (v) => `<li><a href="/${esc(v.path)}">${esc(v.label || v.siteTitle || v.title)}</a>
        <span>${esc(shortDate(v.published))}</span></li>`,
        )
        .join("\n      ")}
    </ul>
    ${all.length > show.length ? `<p style="margin-top:var(--s3)"><a class="btn btn-ghost btn-sm" href="/videos.html?set=${esc(s.id)}">All ${all.length} ${esc(s.name)} rips</a></p>` : ""}
  </div>
</section>`;
    })(),

    (() => {
      const mine = (hitsBySet.get(s.id) || [])
        .map((h) => {
          const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
          const same = ((checklists[s.id] || {}).cards || []).filter((c) => norm(c.name) === norm(h.card));
          const want = h.rarity ? norm(h.rarity).slice(0, 8) : null;
          const m = (want && same.find((c) => norm(c.rarity).includes(want))) || same[0] || null;
          const v = videoById.get(h.vid);
          return {
            name: h.card,
            n: m ? m.n : h.number || null,
            rarity: (m && m.rarity) || h.rarity || null,
            img: m && m.img ? `${m.img}/low.webp` : null,
            price: m && typeof m.price === "number" ? m.price : typeof h.price === "number" ? h.price : null,
            path: v ? v.path : null,
            label: v ? ripLabel(v, setNameById, descriptions[v.id]) || v.title : null,
          };
        })
        .sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      if (!mine.length) return null;
      return (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Pulled on camera</p>
    <h2>What we have <span class="hl">hit</span> from this set</h2>
    <p class="lede" style="max-width:38em">${mine.length} card${mine.length === 1 ? "" : "s"} out of our own packs, priciest first.
      Every one of them is in a video you can watch.</p>
    <ul class="mine-grid">
      ${mine
        .map(
          (h) => `<li class="mine">
        ${h.img ? `<img class="mine-img" src="${esc(h.img)}" alt="${esc(h.name)}" loading="lazy" onerror="this.remove()" decoding="async"${imgDims(h.img)}>` : `<div class="mine-img is-none" aria-hidden="true"></div>`}
        <p class="mine-n">${esc(h.name)}</p>
        <p class="mine-r">${esc(rarityLabel(h.rarity) || "")}${h.n ? ` &bull; #${esc(h.n)}` : ""}</p>
        <p class="mine-p">${typeof h.price === "number" ? moneyExact(h.price) : "No market price"}</p>
        ${h.path ? `<a class="mine-w" href="/${esc(h.path)}">${esc(h.label)} &rarr;</a>` : ""}
      </li>`,
        )
        .join("\n      ")}
    </ul>
  </div>
</section>`;
    })(),

    (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The ones you want</p>
    <h2>Top <span class="hl">chase cards</span></h2>
    ${s.chase?.length ? `
    <div class="chase-grid">
      ${s.chase.map((c) => `<button class="chase-card" type="button"
        data-img="${esc(c.imageLarge || c.image || "")}"
        data-name="${esc(c.name)}" data-rarity="${esc(rarityLabel(c.rarity) || "")}"
        data-number="${esc(c.number)}" data-price="${esc(moneyCompact(c.price))}"
        data-psa10="${esc(gradedPrice(s.id, c.number) ? moneyCompact(gradedPrice(s.id, c.number)) : "")}"
        data-url="${esc(c.url ? affLink(c.url) : "")}"
        aria-label="Enlarge ${esc(c.name)}">
        ${c.image ? `<img src="${c.image}" alt="${esc(c.name)} ${esc(c.number)}, ${esc(rarityLabel(c.rarity) || "card")}" loading="lazy" onerror="this.remove()"${imgDims(c.image)}>` : ""}
        <div class="nm">${esc(c.name)}</div>
        <div class="rr">${esc(rarityLabel(c.rarity) || "")} &bull; ${esc(c.number)}</div>
        <div class="pr">${moneyCompact(c.price)}</div>
        ${gradedPrice(s.id, c.number)
          ? `<div class="pr10">PSA 10 ${moneyCompact(gradedPrice(s.id, c.number))}${
              // longDate, not the raw ISO string the price file stores. Every other date
              // on this page is long form, including the "last updated" line directly
              // under this grid, so a bare 2026-08-12 here read as a different site.
              gradedAsOf(s.id, c.number) ? `<span> &bull; ${esc(longDate(gradedAsOf(s.id, c.number)))}</span>` : ""
            }</div>`
          : ""}
      </button>`).join("\n      ")}
    </div>
    <p class="price-note">Prices are TCGplayer market estimates${longDate(s.pricesAsOf || s.chasePricesAsOf) ? `, last updated ${longDate(s.pricesAsOf || s.chasePricesAsOf)}` : ""}. Singles move fast, so treat these as a ballpark rather than a quote.${affOn ? ` ${esc(aff.tcgplayer.disclosure)}` : ""}</p>
    ` : `
    <div class="no-prices">
      <strong>No market prices yet.</strong> ${esc(s.name)} is recent enough that pricing data has not landed in the card database. The card list and rarity counts above are accurate; the values will fill in as the market settles.
    </div>`}
  </div>
</section>`,

    setValue(s) ? (cls) => valueBand(s, cls) : null,

    // PINNED to the sky gradient, and the tone of everything else is worked out
    // by alternating outward from here. Alternating outward from a fixed point
    // can never produce two neighbours the same; alternating from the top and
    // then forcing one section into place can.
    { pin: true, html: (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Quick facts</p>
    <h2>${esc(s.name)} <span class="hl">101</span></h2>
    <ul class="facts-list">
      ${derivedFacts(s).map((f) => `<li>${f}</li>`).join("\n      ")}
      ${(s.notes?.funFacts || []).map((f) => `<li>${esc(f)}</li>`).join("\n      ")}
    </ul>
  </div>
</section>` },

    (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What is actually rare</p>
    <h2>Rarity <span class="hl">breakdown</span></h2>
    ${ordered.length ? `${rarPr.size ? `<p class="lede" style="max-width:42em">How many cards sit at each rarity, and what those
      cards are worth. <b>Mid</b> is the middle card at that rarity: half of them cost more than that and half cost
      less, which is a far better guide to what you will actually see than the one famous card at the top.</p>` : ""}
    <div class="rarity-list">
      ${ordered.map(([r, n]) => {
        const key = rarityLabel(r) || r;
        const pr = rarPr.get(key);
        return `<div class="rar${CHASE.has(r) ? " chase" : ""}">
        <span class="rar-name">${esc(key)}</span>
        <span class="rar-n">${n}</span>
        ${pr
          ? `<span class="rar-pr">${
              n === 1
                ? `<b>${moneyExact(pr.top)}</b>`
                : `Mid <b>${moneyExact(pr.mid)}</b> &bull; top <b>${moneyExact(pr.top)}</b>`
            }</span>`
          : ""}
        <span class="rar-bar"><i style="width:${Math.max(4, Math.round((n / maxN) * 100))}%"></i></span>
      </div>`;
      }).join("\n      ")}
    </div>${rarPr.size ? `
    <p class="price-note">Prices worked out from the ${esc(s.name)} checklist below, read ${esc(
      longDate(checklists[s.id]?.checked) || checklists[s.id]?.checked || ""
    )}. A rarity only gets a figure where every card at that rarity has a price and the checklist agrees with the set's
      own count, so a few tiers show a count and no money rather than a number covering a different set of cards than
      the one beside it.</p>` : ""}` : `<p class="lede">Card list not available for this set yet.</p>`}
  </div>
</section>`,

    checklists[s.id]?.cards?.length ? (cls) => checklistBand(s, cls) : null,
    intlSets[s.id]?.sources?.length ? (cls) => intlBand(s, cls) : null,
    productsBySet[s.id]?.products?.length ? (cls) => productBand(s, cls) : null,

    rips ? (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>See it opened</p>
    <h2>We ripped <span class="hl">${rips}</span> of these</h2>
    <div class="set-watch">
      <div class="packshot pack pack--${packClass(s.id)}"><span class="pack-face pack-l"><span class="pack-art"></span></span></div>
      <div>
        <p class="lede">Want to see what actually comes out of ${esc(s.name)} instead of reading about it? Every ${esc(s.name)} rip on the channel is one tap away.</p>
        <div class="btn-row" style="margin-top:16px">
          <a class="btn btn-yt" href="/videos.html?set=${s.id}">Watch the ${esc(label)} rips</a>
        </div>
      </div>
    </div>
  </div>
</section>` : null,

    (cls) => `<section class="${cls}">
  <div class="wrap">
    <h2>Other <span class="hl">sets</span></h2>
    <div class="set-index">
      ${sets.filter((o) => o.id !== s.id).slice(0, 6).map((o) => `<a class="set-card" href="/sets/${o.id}.html">
        ${setCardLogo(o.id, "")}
        <span><span class="ttl">${esc(o.name)}</span><br><span class="meta">${o.total ?? "?"} cards</span></span>
      </a>`).join("\n      ")}
    </div>
    <div style="text-align:center;margin-top:22px"><a class="btn btn-ghost" href="/sets/">Every set &rarr;</a></div>
  </div>
</section>`,
  ].filter(Boolean);

  const pin = bands.findIndex((b) => b.pin);
  if (pin === -1) throw new Error(`setPage(${s.id}): no pinned band, so the section tones have nothing to alternate from.`);
  const body = bands
    .map((b, i) => {
      const isBand = Math.abs(i - pin) % 2 === 0;
      const cls = b.pin ? "band-sky tight" : isBand ? "band tight" : "tight";
      return (b.pin ? b.html : b)(cls);
    })
    .join("\n\n");

  return head({ title: setTitle(s.name), desc, canonical: url, image: `${SITE}/assets/${ogCards.has(s.id) ? `og-${s.id}` : "og-image"}.jpg?v=2`, ld, css: PAGE_CSS }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Card Pokedex</span>
    <img class="logo-big"${logoAttrs(s.id)} src="${logo}" alt="" onerror="this.remove()">
    <h1>${esc(s.name)}</h1>
    <p class="lede" style="max-width:34em">Everything worth knowing about ${esc(s.name)} in one screen. Card counts, what is actually rare, and what the chase cards are going for.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / <a href="/sets/">Card sets</a> / ${esc(s.name)}</p>

    <div class="facts">
      <div class="fact"><div class="n">${s.total ?? "?"}</div><div class="l">Cards total</div></div>
      <div class="fact"><div class="n">${s.printedTotal ?? "?"}</div><div class="l">In the printed set</div></div>
      <div class="fact"><div class="n">${s.secretCount ?? "?"}</div><div class="l">Secret rares</div></div>
      ${rips
        ? `<a class="fact fact-link" href="/videos.html?set=${s.id}"><div class="n">${rips}</div><div class="l">Rip${rips === 1 ? "" : "s"} on this channel <span aria-hidden="true">&rarr;</span></div></a>`
        : `<div class="fact"><div class="n">-</div><div class="l">Rips on this channel</div></div>`}
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${longDate(s.released) || "Unknown"}</div><div class="l">Release date${s.released ? ` &bull; ${yearsSince(s.released)}` : ""}</div></div>
    </div>
${(() => {
  // The pack price was waiting on a human and did not need to be. Every one of
  // the 23 sets already carries a live TCGplayer "Single Pack" market price
  // through sync-products.mjs, and the SAME figure is already printed further
  // down this page in the "What you can buy" band, so surfacing it up here adds
  // no claim the page was not already making. data/set-notes.json held nothing
  // but its readme, so this tile was hidden on all 23 sets while the number sat
  // in the data.
  //
  // A hand-written note still wins: someone who has actually stood in a shop
  // knows something TCGplayer does not.
  const live = (productsBySet[s.id]?.products || []).find((p) => p.kind === "Single Pack");
  const packPrice = s.notes?.packPrice || (typeof live?.market === "number" ? moneyExact(live.market) : null);
  // The two are different claims and the label says which. "Typical" is a
  // person who has stood in a shop; "market price" is TCGplayer.
  //
  // The source and the date are NOT repeated here. This page already carries
  // "Prices are TCGplayer market and lowest-listing prices, read on <date>"
  // under the products band, and spelling it out again in a fact tile ran the
  // label to three lines on a phone for information the reader already has.
  const packFrom = s.notes?.packPrice ? "Single pack, typical" : "Single pack, market price";
  if (!s.notes?.inPrint && !packPrice) return "";
  return `
    <div class="facts" style="margin-top:12px">
      ${s.notes?.inPrint ? `<div class="fact"><div class="n" style="font-size:1.1rem">${esc(s.notes.inPrint)}</div><div class="l">Still in print?</div></div>` : ""}
      ${packPrice ? `<div class="fact"><div class="n">${esc(packPrice)}</div><div class="l">${esc(packFrom)}</div></div>` : ""}
    </div>`;
})()}
  </div>
</section>

${body}

<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Card image">
  <div class="lb-inner">
    <button class="lb-close" type="button" aria-label="Close">&times;</button>
    <img id="lbImg" src="" alt="">
    <p class="lb-nm" id="lbNm"></p>
    <p class="lb-rr" id="lbRr"></p>
    <p class="lb-pr" id="lbPr"></p>
    <div class="lb-actions"><a class="btn btn-sky btn-sm" id="lbUrl" href="#" rel="nofollow noopener" hidden>Check current price</a></div>
  </div>
</div>

</main>
${footer("Card data from TCGdex, prices from TCGplayer. Prices are estimates and move constantly.")}
<script>
(function(){
  var lb=document.getElementById('lb'), img=document.getElementById('lbImg');
  var last=null;
  function open(b){
    last=b;
    img.src=b.dataset.img; img.alt=b.dataset.name+' '+b.dataset.number;
    document.getElementById('lbNm').textContent=b.dataset.name;
    document.getElementById('lbRr').textContent=[b.dataset.rarity,b.dataset.number].filter(Boolean).join(' \u2022 ');
    document.getElementById('lbPr').textContent=b.dataset.price
      + (b.dataset.psa10 ? '  \u2022  PSA 10 ' + b.dataset.psa10 : '');
    var u=document.getElementById('lbUrl');
    if(b.dataset.url){u.href=b.dataset.url;u.hidden=false;}else{u.hidden=true;}
    lb.classList.add('on');
    document.body.style.overflow='hidden';
    lb.querySelector('.lb-close').focus();
  }
  function close(){
    lb.classList.remove('on'); document.body.style.overflow='';
    if(last) last.focus();      // return focus where it came from
  }
  document.querySelectorAll('.chase-card').forEach(function(b){
    b.addEventListener('click',function(){ if(b.dataset.img) open(b); });
  });
  lb.addEventListener('click',function(e){ if(e.target===lb||e.target.closest('.lb-close')) close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&lb.classList.contains('on')) close(); });
})();
</script>
${APP_JS}
</body>
</html>
`;
}

// ---------------------------------------------------------------- the index
function indexPage() {
  const url = `${SITE}/sets/`;
  const desc =
    `Pokemon TCG set guides: card counts, rarity breakdowns and chase card values for ` +
    `${sets.length + Object.keys(intlGuides).length} sets, from ${sets[sets.length - 1]?.name} to ${sets[0]?.name}.`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Card Sets" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Pokemon TCG set guides",
      itemListElement: sets.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: s.name,
        url: `${SITE}/sets/${s.id}.html`,
      })),
    },
  ];
  return head({ title: `Pokemon TCG Set Guides: Cards, Rarities & Chase Values | Garbage Rips 585`, desc, canonical: url, image: `${SITE}/assets/og-image.jpg?v=2`, ld }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Card Pokedex</span>
    <h1>Card <span class="hl">sets</span></h1>
    ${/* "we cover", not "we rip". Eight of the sets listed below have a guide
          and no rip on them, which the "N rips" line on each card says out
          loud, so the lede was contradicted by the grid under it. */ ""}
    <p class="lede" style="max-width:34em">Every set we cover, boiled down to the facts that matter. Card counts, what is genuinely rare, and what the chase cards cost.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Card sets</p>
    <div class="set-index">
      ${sets.map((s) => `<a class="set-card" href="/sets/${s.id}.html">
        ${setCardLogo(s.id, `${esc(s.name)} logo`)}
        <span>
          <span class="ttl">${esc(s.name)}</span><br>
          <span class="meta">${s.total ?? "?"} cards${s.released ? ` &bull; ${s.released.slice(0, 4)}` : ""}${ripsBySet[s.id] ? ` &bull; ${ripsBySet[s.id]} rip${ripsBySet[s.id] === 1 ? "" : "s"}` : ""}${(s.chase || [])[0]?.price ? ` &bull; top ${moneyCompact(s.chase[0].price)}${gradedPrice(s.id, s.chase[0].number) ? ` / ${moneyCompact(gradedPrice(s.id, s.chase[0].number))} PSA 10` : ""}` : ""}</span>
        </span>
      </a>`).join("\n      ")}
    </div>
  </div>
</section>
${Object.keys(intlGuides).length ? `
<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Imported packs</p>
    <h2>Japanese, Korean and <span class="hl">Chinese</span> sets</h2>
    <p class="lede intl-lede">Most of these are a set you already know under a different name: Abyss Eye is Pitch Black,
      Clay Burst is half of Paldea Evolved. Each guide says which English set it becomes, so you can work out what you
      are actually looking at. Names are in English, with the native name kept alongside.</p>
    <div class="set-index">
      ${Object.entries(intlGuides)
        .sort((a, b) => String(b[1].released || "").localeCompare(String(a[1].released || "")))
        .map(([id, g]) => {
          const en = sets.find((x) => x.id === g.equivalent);
          return `<a class="set-card" href="/sets/${id}.html">
        <span>
          <span class="ttl">${esc(g.english)}${g.langFlag ? ` ${g.langFlag}` : ""}</span><br>
          <span class="meta">${[
            g.native || null,
            g.cardCount?.total ? `${g.cardCount.total} cards` : null,
            g.released ? g.released.slice(0, 4) : null,
            ripsBySet[id] ? `${ripsBySet[id]} rip${ripsBySet[id] === 1 ? "" : "s"}` : null,
            en ? `= ${en.name}` : g.exclusive ? "no English version" : null,
          ].filter(Boolean).map(esc).join(" &bull; ")}</span>
        </span>
      </a>`;
        })
        .join("\n      ")}
    </div>
  </div>
</section>` : ""}

</main>
${footer("Card data from TCGdex, prices from TCGplayer. Prices are estimates and move constantly.")}
${APP_JS}
</body>
</html>
`;
}

// Clears the whole folder so a renamed or dropped set cannot leave a stale page
// behind. NOTE: the 13 non-English guides live in here too and are written by
// scripts/build-intl-pages.mjs, so that ALWAYS runs after this one. Reverse the
// order and they are deleted immediately after being built.
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const s of sets) await writeFile(join(OUT, `${s.id}.html`), setPage(s));
await writeFile(join(OUT, "index.html"), indexPage());

console.log(`
Wrote ${sets.length} set pages + index to public/sets/

  with prices:  ${sets.filter((s) => s.chase?.length).length}
  no prices:    ${sets.filter((s) => !s.chase?.length).map((s) => s.id).join(", ") || "none"}

Remember to re-run build-pages.mjs so the sitemap picks these up.
`);
