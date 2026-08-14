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
import { esc, shortDate, longDate, moneyCompact, moneyExact, rarityLabel } from "../shared/format.mjs";
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

function checklistBand(s) {
  const doc = checklists[s.id];
  if (!doc?.cards?.length) return "";
  const priced = doc.cards.filter((c) => c.price != null);
  const priciest = priced.slice().sort((a, b) => b.price - a.price)[0];

  return `<section class="tight">
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

function intlBand(s) {
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

  return `<section class="tight">
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
function productBand(s) {
  const entry = productsBySet[s.id];
  if (!entry?.products?.length) return "";

  const items = [...entry.products].sort((a, b) => a.market - b.market);
  const cheapest = items[0];

  const cards = items
    .map(
      (p) => `      <li class="prod">
        <a class="prod-shot" href="${esc(affLink(p.url))}" rel="noopener" target="_blank" tabindex="-1" aria-hidden="true">
          <img src="${esc(p.thumb)}" srcset="${esc(p.thumb)} 200w, ${esc(p.image)} 1000w"
               sizes="(max-width:640px) 40vw, 200px" alt="" loading="lazy" onerror="this.remove()" decoding="async"
               width="200" height="200" referrerpolicy="no-referrer">
        </a>
        <div class="prod-body">
          <h3><a href="${esc(affLink(p.url))}" rel="noopener" target="_blank">${esc(p.kind)}</a></h3>
          <p class="prod-what">${esc(p.blurb)}</p>
          <p class="prod-price"><b>${priceUSD(p.market)}</b> <span>market</span></p>
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

  return `<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What you can buy</p>
    <h2>Ways to open <span class="hl">${esc(s.name)}</span></h2>
    <p class="lede prod-lede">Every sealed ${esc(s.name)} product still being sold, cheapest first.
      The cheapest way in is ${esc(cheapest.kind.toLowerCase())} at ${priceUSD(cheapest.market)}.</p>
    <ul class="prod-grid">
${cards}
    </ul>
    <p class="prod-note">Prices are TCGplayer market and lowest-listing prices, read on
      ${esc(longDate(entry.checked))}. They move every day, so treat them as a rough idea and not a quote.
      Product photos are TCGplayer's. We are not a shop and we do not sell any of this.</p>
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

const head = ({ title, desc, canonical, image, ld }) => `<!DOCTYPE html>
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
${STYLES}
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

  return head({ title: setTitle(s.name), desc, canonical: url, image: `${SITE}/assets/${ogCards.has(s.id) ? `og-${s.id}` : "og-image"}.jpg?v=2`, ld }) + `
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

${(() => {
  // Newest twelve. All of them on a 90-rip set would be a wall, and the link at
  // the end covers the rest.
  const all = ripsList.get(s.id) || [];
  const show = all.slice(0, 12);
  if (!show.length) return "";
  return `<section class="band tight">
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
</section>

`;
})()}${(() => {
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
  if (!mine.length) return "";
  return `<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Pulled on camera</p>
    <h2>What we have <span class="hl">hit</span> from this set</h2>
    <p class="lede" style="max-width:38em">${mine.length} card${mine.length === 1 ? "" : "s"} out of our own packs, priciest first.
      Every one of them is in a video you can watch.</p>
    <ul class="mine-grid">
      ${mine
        .map(
          (h) => `<li class="mine">
        ${h.img ? `<img class="mine-img" src="${esc(h.img)}" alt="${esc(h.name)}" loading="lazy" onerror="this.remove()" decoding="async" width="245" height="337">` : `<div class="mine-img is-none" aria-hidden="true"></div>`}
        <p class="mine-n">${esc(h.name)}</p>
        <p class="mine-r">${esc(rarityLabel(h.rarity) || "")}${h.n ? ` &bull; #${esc(h.n)}` : ""}</p>
        <p class="mine-p">${typeof h.price === "number" ? moneyExact(h.price) : "No market price"}</p>
        ${h.path ? `<a class="mine-w" href="/${esc(h.path)}">${esc(h.label)} &rarr;</a>` : ""}
      </li>`,
        )
        .join("\n      ")}
    </ul>
  </div>
</section>

`;
})()}<section class="band tight">
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
        ${c.image ? `<img src="${c.image}" alt="${esc(c.name)} ${esc(c.number)}, ${esc(rarityLabel(c.rarity) || "card")}" loading="lazy" onerror="this.remove()" width="245" height="342">` : ""}
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
</section>

<section class="band-sky tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Quick facts</p>
    <h2>${esc(s.name)} <span class="hl">101</span></h2>
    <ul class="facts-list">
      ${derivedFacts(s).map((f) => `<li>${f}</li>`).join("\n      ")}
      ${(s.notes?.funFacts || []).map((f) => `<li>${esc(f)}</li>`).join("\n      ")}
    </ul>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What is actually rare</p>
    <h2>Rarity <span class="hl">breakdown</span></h2>
    ${ordered.length ? `<div class="rarity-list">
      ${ordered.map(([r, n]) => `<div class="rar${CHASE.has(r) ? " chase" : ""}">
        <span class="rar-name">${esc(rarityLabel(r) || r)}</span>
        <span class="rar-n">${n}</span>
        <span class="rar-bar"><i style="width:${Math.max(4, Math.round((n / maxN) * 100))}%"></i></span>
      </div>`).join("\n      ")}
    </div>` : `<p class="lede">Card list not available for this set yet.</p>`}
  </div>
</section>

${checklistBand(s)}

${intlBand(s)}

${productBand(s)}

${rips ? `<section class="tight">
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
</section>` : ""}

<section class="band tight">
  <div class="wrap">
    <h2>Other <span class="hl">sets</span></h2>
    <div class="set-index">
      ${sets.filter((o) => o.id !== s.id).slice(0, 6).map((o) => `<a class="set-card" href="/sets/${o.id}.html">
        <img${logoAttrs(o.id)} src="/assets/logos/${o.id}-pokemon-tcg-set-logo.webp" alt="" loading="lazy" onerror="this.remove()">
        <span><span class="ttl">${esc(o.name)}</span><br><span class="meta">${o.total ?? "?"} cards</span></span>
      </a>`).join("\n      ")}
    </div>
    <div style="text-align:center;margin-top:22px"><a class="btn btn-ghost" href="/sets/">Every set &rarr;</a></div>
  </div>
</section>

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
    <p class="lede" style="max-width:34em">Every set we rip, boiled down to the facts that matter. Card counts, what is genuinely rare, and what the chase cards cost.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Card sets</p>
    <div class="set-index">
      ${sets.map((s) => `<a class="set-card" href="/sets/${s.id}.html">
        <img${logoAttrs(s.id)} src="/assets/logos/${s.id}-pokemon-tcg-set-logo.webp" alt="${esc(s.name)} logo" loading="lazy" onerror="this.remove()">
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
