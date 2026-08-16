#!/usr/bin/env node
// Generate a set guide for every non-English set the channel has ripped.
//
//   node scripts/sync-intl-guides.mjs   (first, writes the data)
//   node scripts/build-intl-pages.mjs   (this, writes public/sets/<id>.html)
//
// These live in /sets/ alongside the English guides and share their markup, so
// the two never drift into looking like different websites.
//
// ENGLISH LEADS, NATIVE STAYS. Roughly 95% of the audience is in the US, so the
// H1 is the English name and the native name sits under it. The native name is
// never dropped: it is the verifiable one, and it is what is printed on the pack
// somebody is holding.
//
// THE POINT OF THESE PAGES is the "same set, different name" band. Somebody who
// watched the Abyss Eye rips and then went looking for Pitch Black had no way to
// learn they are the same cards. That comparison is the reason to build them,
// so it sits above everything except the quick facts.
//
// WHAT IS NOT ON THEM. No prices: TCGdex carries Cardmarket euro figures for
// some of these and nothing at all for the newest, and half a price table is
// worse than none. No pull rates, same rule as the English guides. Trainer and
// Supporter names stay in their native script because no keyless source
// translates them and guessing at 35 of them would be exactly the sort of
// confident error a reference page must not make.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS } from "../shared/chrome.mjs";
import { labelFor, CARD_SETS } from "../shared/taxonomy.mjs";
import { parseHits, rarityLabelOf, rarityMark } from "../shared/rarity.mjs";
import { esc, longDate, rarityLabel, imgDims } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/sets");

const guides = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8"));
const { sets: enSets, rarityOrder } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

const enById = new Map(enSets.map((s) => [s.id, s]));
const ripsBySet = {};
for (const v of videos) for (const s of v.sets || []) (ripsBySet[s] ||= []).push(v);

// THE JAPANESE AND KOREAN PAGES HAD NO HITS SECTION AT ALL, so a pull logged
// against Cyber Judge appeared on its rip page and nowhere else. Same parse as
// build-set-pages.mjs, same conservative rule: a fragment only counts when its
// first segment names a set we know, and doubles are one row with a count.
const SET_BY_NAME = new Map();
for (const cs of CARD_SETS) {
  const n = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  SET_BY_NAME.set(n(cs.label), cs.id);
  SET_BY_NAME.set(n(String(cs.label).replace(/\s*\((?:JP|KR|CN|TW)\)\s*$/i, "")), cs.id);
}
const cardKey = (x) =>
  String(x || "").toLowerCase().replace(/\b(trainer|supporter|item|stadium)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();

const HITS_BY_SET = new Map();
for (const v of videos) {
  if (!v.hitCard) continue;
  for (const h of parseHits(v.hitCard, SET_BY_NAME).hits) {
    if (!HITS_BY_SET.has(h.set)) HITS_BY_SET.set(h.set, new Map());
    const g = HITS_BY_SET.get(h.set);
    const k = cardKey(h.card);
    if (!k) continue;
    if (!g.has(k)) g.set(k, { card: h.card, rarity: h.rarity, promo: h.promo, count: 0, rips: [] });
    const e = g.get(k);
    e.count += 1;
    if (!e.rarity && h.rarity) e.rarity = h.rarity;
    if (!e.rips.some((r) => r.path === v.path)) e.rips.push({ path: v.path, label: v.siteTitle || v.title });
  }
}

function hitsBand(g, cls) {
  const hits = [...(HITS_BY_SET.get(g.id) || new Map()).values()].sort((a, b) => b.count - a.count);
  if (!hits.length) return "";
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Pulled on camera</p>
    <h2>What we have <span class="hl">hit</span> from this set</h2>
    <p class="lede" style="max-width:38em">${hits.length} card${hits.length === 1 ? "" : "s"} out of our own packs.
      Every one of them is in a video you can watch.</p>
    <ul class="mine-list">
      ${hits
        .map(
          (h) => `<li><b>${esc(h.card)}</b>${h.count > 1 ? ` <span class="mine-x">x${h.count}</span>` : ""}${
            h.rarity ? ` <span class="mine-rk">${rarityMark(h.rarity)}${esc(rarityLabelOf(h.rarity))}</span>` : ""
          }
        ${h.rips.map((r) => `<a href="/${esc(r.path)}">${esc(r.label)} &rarr;</a>`).join("\n        ")}</li>`
        )
        .join("\n      ")}
    </ul>
    <p class="mine-note">Those came out of the rip log as written. They do not have a card number or a price
      against them yet, so they are listed rather than priced.</p>
  </div>
</section>`;
}

const yearsSince = (iso) => {
  if (!iso) return "";
  const y = (Date.now() - new Date(iso).getTime()) / 31557600000;
  if (y < 1) return `${Math.max(1, Math.round(y * 12))} months ago`;
  return `${y < 2 ? "1 year" : `${Math.floor(y)} years`} ago`;
};

/**
 * The rules only the comparison table needs, inlined rather than added to
 * assets-source/ui.css, which is render blocking on all 426 pages and would be
 * carrying them for the four guides that use them. Same pattern as
 * build-expansions.mjs.
 */
const PAGE_CSS = `
/* Three columns fit 320px without help (1fr plus two 4em numerics), but the
   wrapper scrolls anyway rather than trusting that: a long rarity name is the
   one thing here that could grow and the page must never scroll sideways. */
.rcmp-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:var(--s4);
  border:1px solid var(--hair);border-radius:var(--r);background-color:var(--card);
  box-shadow:var(--lift)}
.rcmp{width:100%;border-collapse:collapse;font-size:var(--t-sm)}
.rcmp th,.rcmp td{padding:9px var(--s4);text-align:right;border-bottom:1px solid var(--hair)}
.rcmp thead th{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);letter-spacing:.05em;
  text-transform:uppercase;vertical-align:bottom}
.rcmp th[scope=row],.rcmp thead th:first-child{text-align:left;font-weight:600}
.rcmp td{font:700 var(--t-sm)/1.4 var(--mono);white-space:nowrap}
.rcmp tbody tr:last-child th,.rcmp tbody tr:last-child td{border-bottom:0}
/* Gold marks a tier that holds the same number of cards in both printings,
   which is the thing the table is for. --mustard at 16% keeps the row text at
   its normal contrast rather than tinting it. */
.rcmp tr.is-same{background:rgba(239,201,76,.18)}
.rcmp tr.is-same th[scope=row]{color:var(--gold-deep)}
.rcmp tr.is-total th,.rcmp tr.is-total td{border-top:2px solid var(--ink);font-weight:700}
.rcmp-say{max-width:42em;margin-top:var(--s4);border-left:4px solid var(--gold);
  padding-left:var(--s4);font-size:var(--t-body)}
`;

/**
 * The same trade build-css.mjs makes for ui.css, for the same reason: the
 * comments are the point of the SOURCE and pure weight in the shipped page, and
 * this block is inline in a render blocking <head>. Comments only, plus the
 * indentation between rules. Nothing else is touched.
 */
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const head = ({ title, desc, canonical, image, ld, noindex = false, css = "" }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">${
  noindex
    ? '\n<meta name="robots" content="noindex,follow">'
    : ""
}
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
<link rel="preconnect" href="https://assets.tcgdex.net" crossorigin>
${FONTS}
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

/** The card name a US reader can actually read, with the native name kept alongside. */
const cardName = (c) => c.en || c.native || "";
const cardSub = (c) => (c.en && c.native && c.en !== c.native ? c.native : "");

/** Human label for what kind of card this is, used where no English name exists. */
const kindOf = (c) => (c.category === "Pokemon" ? "" : c.category === "Trainer" ? "Trainer" : c.category === "Energy" ? "Energy" : "");

// --------------------------------------------------------- the comparison band

/**
 * The reason these pages exist: this set next to the English set it became.
 * Reuses the .intl-* markup the English guides already use for the mirror of
 * this panel, so the two read as two views of one fact rather than two designs.
 */
function twinBand(g, cls) {
  const en = g.equivalent ? enById.get(g.equivalent) : null;

  if (g.exclusive || !g.equivalent) {
    return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>No English version</p>
    <h2>This one <span class="hl">never left</span></h2>
    <p class="lede intl-lede">${esc(g.english)} looks to be a regional exclusive. There is no English set to compare it
      to and no Japanese one either: its set code returns nothing under Japanese, Korean or Traditional Chinese on
      TCGdex, which is where we checked. If you want these cards, imported ${esc(g.langName)} packs are the way.</p>
  </div>
</section>`;
  }

  if (!en) return "";

  const enTotal = en.total || en.printedTotal || 0;
  const merged = g.siblingName || (g.sibling ? guides.sets[g.sibling]?.english : null);

  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Same cards, different name</p>
    <h2>${esc(g.english)} is <span class="hl">${esc(en.name)}</span></h2>
    <p class="lede intl-lede">If you have watched these rips and then gone looking for the set in a US shop, this is the
      one you want. ${esc(g.english)} is the ${esc(g.langName)} printing behind English ${esc(en.name)}${
        merged ? `, which English built by merging it with ${esc(merged)}` : ""
      }.</p>
    <ul class="intl-grid">
      <li class="intl">
        <p class="intl-lang">${g.langFlag ? `${g.langFlag} ` : ""}${esc(g.langName)}${g.tcgdexId ? ` &bull; ${esc(g.tcgdexId)}` : ""}</p>
        <h3>${esc(g.english)}</h3>
        ${g.native ? `<p class="intl-native" lang="${esc(g.lang)}">${esc(g.native)}</p>` : ""}
        <p class="intl-meta">${[
          g.cardCount?.total ? `${g.cardCount.total} cards` : null,
          longDate(g.released) || null,
        ].filter(Boolean).join(" &bull; ")}</p>
        <!--
          There was a "Full checklist on TCGdex" link here, pointing at
          www.tcgdex.net/<lang>/sets/<id>. All 15 URLs it built are 404s, and so
          is the root: TCGdex publishes api., assets. and tcgdex.dev and has no
          consumer site, so the link could never have worked. It was redundant
          as well, because the checklist is further down THIS page and the
          source line at the foot already credits TCGdex.
        -->
        <p class="intl-lead">The one on this page, checklist below</p>
      </li>
      <li class="intl is-en">
        <p class="intl-lang">English${en.apiId ? ` &bull; ${esc(String(en.apiId).toUpperCase())}` : ""}</p>
        <h3>${esc(en.name)}</h3>
        <p class="intl-meta">${[
          enTotal ? `${enTotal} cards` : null,
          longDate(en.released) || null,
        ].filter(Boolean).join(" &bull; ")}</p>
        ${g.released && en.released && g.released < en.released
          ? `<p class="intl-lead">Out ${esc(gap(g.released, en.released))} later</p>`
          : `<p class="intl-lead">The English release</p>`}
        <a class="intl-link" href="/sets/${esc(g.equivalent)}.html">Read the ${esc(en.name)} guide</a>
      </li>
    </ul>
    ${g.confidence === "partial"
      ? `<p class="intl-warn">A partial match. ${esc(g.note || "")}</p>`
      : g.note ? `<p class="price-note">${esc(g.note)}</p>` : ""}
  </div>
</section>`;
}

/**
 * THE SAME CHECKLIST IN BOTH LANGUAGES, TIER BY TIER.
 *
 * The twin band above asserts "same cards, different name" and then prints two
 * different card counts underneath it, 118 against 120, and never says where
 * the difference went. That is the one question these pages exist to answer and
 * it was the one thing they left hanging.
 *
 * Both ladders come from TCGdex and both are counts of the checklists further
 * down each page, so the comparison is arithmetic over data we already publish.
 *
 * IT IS GATED HARD, and only four of the thirteen guides pass. TCGdex labels
 * the rarity on every card in the current Japanese sets and on almost none of
 * the Korean ones, where the higher tiers are simply absent from the data. A
 * side by side there would print "Illustration Rare 0 / 36", which reads as
 * "the Korean set has none" and is false. So the band renders only when:
 *
 *   - both sides name exactly the same set of rarities, and
 *   - each ladder accounts for every card in its own set.
 *
 * Anything less and the page shows nothing rather than a table that invites a
 * wrong conclusion. Mega Symphonia fails on the first test and is the reason it
 * exists: TCGdex files its top tier as "Secret Rare" where the English set says
 * "Ultra Rare", so the two ladders would have lined up 11 real cards against a
 * column of zeroes.
 */
function rarityCompare(g, en) {
  if (!en) return null;
  const norm = (obj) => {
    const out = new Map();
    for (const [k, v] of Object.entries(obj || {})) {
      const key = rarityLabel(k);
      if (!key || typeof v !== "number") return null;
      out.set(key, (out.get(key) || 0) + v);
    }
    return out.size ? out : null;
  };
  const mine = norm(g.rarities);
  const theirs = norm(en.rarities);
  if (!mine || !theirs) return null;

  const sum = (m) => [...m.values()].reduce((a, b) => a + b, 0);
  const myTotal = g.cardCount?.total;
  const enTotal = en.total || en.printedTotal;
  if (!myTotal || !enTotal) return null;
  if (sum(mine) !== myTotal || sum(theirs) !== enTotal) return null;
  if (mine.size !== theirs.size) return null;
  for (const k of mine.keys()) if (!theirs.has(k)) return null;

  // Rarest first, in the ladder sets.json already ranks rarities in, so the
  // chase tiers are the first thing read rather than 38 commons. Anything the
  // ladder does not name falls to the bottom in count order.
  const rows = [...mine.keys()]
    .map((r) => ({ r, mine: mine.get(r), theirs: theirs.get(r) }))
    .sort((a, b) => {
      const ia = rarityOrder.indexOf(a.r);
      const ib = rarityOrder.indexOf(b.r);
      if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.mine + a.theirs - (b.mine + b.theirs);
    });

  const same = rows.filter((x) => x.mine === x.theirs);
  const check = rows.reduce((a, x) => a + x.mine, 0);
  if (check !== myTotal) {
    throw new Error(
      `rarityCompare(${g.id}): the rows add to ${check} against a stated ${myTotal} cards. ` +
        `Check public/data/intl-guides.json.`
    );
  }
  return { rows, same, myTotal, enTotal, diff: enTotal - myTotal };
}

/** A list read out in prose: "a, b and c". */
const andList = (xs) =>
  xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

function compareBand(g, en, cls) {
  const c = rarityCompare(g, en);
  if (!c) return "";
  const merged = g.siblingName || (g.sibling ? guides.sets[g.sibling]?.english : null);
  const say = [];
  if (c.same.length) {
    say.push(
      `${c.same.length} of the ${c.rows.length} rarities hold exactly the same number of cards in both printings: ` +
        `${andList(c.same.map((x) => `${x.mine} ${esc(x.r)}${x.mine === 1 ? "" : "s"}`))}.`
    );
  } else {
    say.push(`No rarity holds the same number of cards in both printings.`);
  }
  say.push(
    c.diff === 0
      ? `The two sets are the same size.`
      : `English ${esc(en.name)} is ${Math.abs(c.diff)} card${Math.abs(c.diff) === 1 ? "" : "s"} ${
          c.diff > 0 ? "bigger" : "smaller"
        }, ${c.enTotal} against ${c.myTotal}.` +
        (merged && c.diff > 0 ? ` It was built by merging this set with ${esc(merged)}, which is where the extra came from.` : "")
  );

  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Card for card</p>
    <h2>How close is it to <span class="hl">${esc(en.name)}</span>?</h2>
    <p class="lede" style="max-width:42em">"Same set" is nearly true and worth checking rather than taking on trust.
      Here is every rarity in both printings, side by side.${
        c.same.length ? ` The gold rows are the ones that match.` : ""
      }</p>
    <div class="rcmp-wrap">
      <table class="rcmp">
        <thead>
          <tr><th scope="col">Rarity</th><th scope="col">${g.langFlag ? `${g.langFlag} ` : ""}${esc(g.english)}</th><th scope="col">${esc(en.name)}</th></tr>
        </thead>
        <tbody>
          ${c.rows
            .map(
              (x) => `<tr${x.mine === x.theirs ? ` class="is-same"` : ""}>
            <th scope="row">${esc(x.r)}</th><td>${x.mine}</td><td>${x.theirs}</td>
          </tr>`
            )
            .join("\n          ")}
          <tr class="is-total"><th scope="row">Every card</th><td>${c.myTotal}</td><td>${c.enTotal}</td></tr>
        </tbody>
      </table>
    </div>
    <p class="lede rcmp-say">${say.join(" ")}</p>
    <p class="price-note">Both counts are the rarities on the two checklists, from TCGdex, read
      ${esc(longDate(guides.checked) || guides.checked)}. A rarity is only counted where TCGdex labels it, so this table
      appears on a guide only when both sides label every card. It says nothing about how often any of them turn up in a
      pack, because nobody outside The Pokemon Company knows that.</p>
  </div>
</section>`;
}

// ------------------------------------------------------- the rest of the page
//
// One function per section, each taking the class that paints it, so guidePage
// can decide the tones once it knows which sections exist. The markup inside is
// unchanged from when these were inlined in the page template.

function chaseBand(g, en, cls) {
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The ones you want</p>
    <h2>Top <span class="hl">chase cards</span></h2>
    <div class="chase-grid">
      ${g.notable.map((c) => `<button class="chase-card" type="button"
        data-img="${esc(c.imageLarge || c.image || "")}"
        data-name="${esc(cardName(c))}" data-rarity="${esc(rarityLabel(c.rarity) || (c.secret ? "Numbered past the set" : ""))}"
        data-number="${esc(c.localId || "")}" data-price=""
        aria-label="Enlarge ${esc(cardName(c))}">
        ${c.image ? `<img src="${esc(c.image)}" alt="${esc(cardName(c))} ${esc(c.localId || "")}, ${esc(g.english)}" loading="lazy" onerror="this.remove()"${imgDims(c.image)}>` : ""}
        <div class="nm">${esc(cardName(c))}</div>
        ${cardSub(c) ? `<div class="ig-native" lang="${esc(g.dataSource?.lang || g.lang)}">${esc(cardSub(c))}</div>` : ""}
        <div class="rr">${esc(rarityLabel(c.rarity) || (c.secret ? "Secret" : kindOf(c) || "Card"))} &bull; ${esc(c.localId || "")}</div>
      </button>`).join("\n      ")}
    </div>
    <p class="price-note">No prices here on purpose. Imported singles are priced in euro or yen by the
      databases that carry them at all, and a converted half-filled price table is worse than none. The English
      ${en ? `<a href="/sets/${esc(g.equivalent)}.html">${esc(en.name)} guide</a> carries` : "guides carry"} live USD
      values for the same cards.</p>
  </div>
</section>`;
}

function rarityBand(g, rarities, maxN, secretCount, cls) {
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What is actually rare</p>
    <h2>Rarity <span class="hl">breakdown</span></h2>
    <div class="rarity-list">
      ${rarities.map(([r, n]) => `<div class="rar">
        <div class="rar-n">${esc(rarityLabel(r) || r)}</div>
        <div class="rar-bar"><span style="width:${Math.round((n / maxN) * 100)}%"></span></div>
        <div class="rar-c">${n}</div>
      </div>`).join("\n      ")}
    </div>
    ${secretCount ? `<p class="price-note">${secretCount} more cards are numbered past card ${g.cardCount?.official}, which is
      how ${esc(g.dataSource?.langName || g.langName)} sets carry their secret rares. TCGdex does not label the rarity on every
      one of them, so they are counted here rather than guessed at.</p>` : ""}
  </div>
</section>`;
}

function checklistBand(g, cls) {
  if (!g.cards?.length) {
    return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Every card</p>
    <h2>No <span class="hl">checklist</span> yet</h2>
    <p class="lede">TCGdex knows this set exists, when it landed and how big it is, but has not published its card list.
      As soon as it does, this page fills in on the next nightly build.</p>
  </div>
</section>`;
  }
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Every card</p>
    <h2>Full <span class="hl">checklist</span></h2>
    <p class="lede">All ${g.cards.length} cards, English names where the card is a Pokemon.${
      g.dataSource?.borrowed
        ? ` This list is the ${esc(g.dataSource.langName)} printing's, because TCGdex has no ${esc(g.langName)} card records for this set.`
        : ""
    }</p>
    <details class="ig-list">
      <summary>Show the full ${esc(g.english)} checklist</summary>
      <ol class="ig-cards">
        ${g.cards.map((c) => `<li><span class="ig-no">${esc(c.localId || "")}</span>
          <span class="ig-nm">${esc(cardName(c))}</span>
          ${cardSub(c) ? `<span class="ig-native" lang="${esc(g.dataSource?.lang || g.lang)}">${esc(cardSub(c))}</span>` : ""}
          ${c.rarity ? `<span class="ig-rr">${esc(rarityLabel(c.rarity))}</span>` : c.secret ? `<span class="ig-rr">Secret</span>` : kindOf(c) ? `<span class="ig-rr">${esc(kindOf(c))}</span>` : ""}</li>`).join("\n        ")}
      </ol>
    </details>
    <p class="price-note">Pokemon names come from the National Pokedex number on each card, so they are looked up rather
      than transliterated. Trainer and Supporter cards keep their ${esc(g.dataSource?.langName || g.langName)} names: no
      free source translates them, and a guessed name on a reference page is worse than an honest one you can paste into
      a search.</p>
  </div>
</section>`;
}

function ripsBand(g, rips, label, cls) {
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>See it opened</p>
    <h2>We ripped <span class="hl">${rips.length}</span> of these</h2>
    <div class="set-watch">
      <div class="packshot pack pack--default"><span class="pack-face pack-l"><span class="pack-art"></span></span></div>
      <div>
        <p class="lede">Imported packs, opened on camera in Rochester. No idea what any of the text says, which is half
          the fun. Every ${esc(g.english)} rip on the channel is one tap away.</p>
        <div class="btn-row" style="margin-top:16px">
          <a class="btn btn-yt" href="/videos.html?set=${g.id}">Watch the ${esc(label)} rips</a>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function sourceBand(g, cls) {
  return `<section class="${cls}">
  <div class="wrap">
    <h2>Where this <span class="hl">came from</span></h2>
    <ul class="facts-list">
      <li>Set details, checklist and rarities from <a href="https://tcgdex.dev/" rel="noopener" target="_blank">TCGdex</a>, read ${esc(longDate(guides.checked) || guides.checked)}.</li>
      ${/* "on this page", not "below": this band is the LAST section, so it was
            pointing at a checklist that sits above it. */ ""}
      ${g.dataSource?.borrowed ? `<li><strong>The checklist on this page is the ${esc(g.dataSource.langName)} one.</strong> ${
        g.dataNote
          ? esc(g.dataNote)
          : `TCGdex lists this set in ${esc(g.langName)} but carries no cards for it, so the checklist comes from ${esc(g.dataSource.langName)} ${esc(g.dataSource.id)}, the printing it was translated from.`
      }${g.declaredCount && g.cardCount?.total && g.declaredCount !== g.cardCount.total
          ? ` Its own entry claims ${g.declaredCount} cards against ${g.cardCount.total} in the ${esc(g.dataSource.langName)} set; that figure has no cards behind it to check, so the verifiable number is the one shown above.`
          : ""}</li>` : ""}
      ${g.nameNote ? `<li><strong>On the name.</strong> ${esc(g.nameNote)}</li>` : ""}
      <li>Pokemon card names in English via the National Pokedex number, through <a href="https://pokeapi.co" rel="noopener" target="_blank">PokeAPI</a>.</li>
      <li>This is a fan page. Nothing here is sold by us and none of it is official.</li>
    </ul>
  </div>
</section>`;
}

/** "about three months" style gap between two dates. */
function gap(a, b) {
  const days = Math.round(Math.abs(new Date(b) - new Date(a)) / 86400000);
  if (days < 45) return `${days} days`;
  const months = Math.round(days / 30.4);
  return months < 18 ? `${months} months` : `${(months / 12).toFixed(1)} years`;
}

// ------------------------------------------------------------------ the page

function guidePage(g) {
  const url = `${SITE}/sets/${g.id}.html`;
  const en = g.equivalent ? enById.get(g.equivalent) : null;
  const rips = ripsBySet[g.id] || [];
  const label = labelFor("sets", g.id);
  const total = g.cardCount?.total;

  const desc =
    `${g.english} (${g.native || g.langName}) Pokemon TCG set guide: ` +
    `${total ? `${total} cards, ` : ""}released ${longDate(g.released) || "recently"}` +
    (en ? `, and why it is the same set as English ${en.name}.` : `, a ${g.langName} exclusive.`);

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${g.english} Pokemon TCG Set Guide`,
      description: desc,
      image: [`${SITE}/assets/og-image.jpg`],
      about: { "@type": "Thing", name: `${g.english} (Pokemon Trading Card Game, ${g.langName})` },
      url,
      // datePublished is when the guide first appeared and never moves;
      // dateModified is when its data was last re-read. Setting both to the
      // sync date made one false and the other meaningless.
      datePublished: g.published || guides.checked,
      dateModified: guides.checked,
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
        { "@type": "ListItem", position: 3, name: g.english },
      ],
    },
  ];

  const rarities = Object.entries(g.rarities || {}).sort((a, b) => b[1] - a[1]);
  const maxN = Math.max(1, ...rarities.map(([, n]) => n));
  const secretCount = (g.cards || []).filter((c) => c.secret).length;

  // A guide with no checklist, no rarities and no chase cards is a stub, and the
  // site already noindexes thin rip pages for exactly this reason. It stays
  // reachable and in the nav; it just does not go to search until TCGdex
  // publishes the cards.
  const thin = !g.hasCards;

  // ---------------------------------------------------------------- the bands
  //
  // Each section is a function of the class that paints it, and the tones are
  // assigned only once the list of sections that actually render is known.
  // Which ones render varies a lot here: four guides have a card-for-card
  // table, two have no checklist at all, one has no English twin. Hard coded
  // classes therefore stacked two cream sections on Abyss Eye the moment the
  // comparison band was added between the twin panel and the chase grid.
  //
  // The rarity ladder is PINNED to the sky gradient it has always had and the
  // rest alternate outward from it, which cannot produce two neighbours the
  // same. See the matching note in build-set-pages.mjs.
  const bands = [
    (cls) => twinBand(g, cls),
    (cls) => compareBand(g, en, cls),
    g.notable?.length ? (cls) => chaseBand(g, en, cls) : null,
    rarities.length ? { pin: true, html: (cls) => rarityBand(g, rarities, maxN, secretCount, cls) } : null,
    (cls) => checklistBand(g, cls),
    rips.length ? (cls) => ripsBand(g, rips, label, cls) : null,
    HITS_BY_SET.has(g.id) ? (cls) => hitsBand(g, cls) : null,
    (cls) => sourceBand(g, cls),
  ].filter(Boolean);

  // twinBand and compareBand both return "" on some guides, and an empty string
  // still occupies a slot in the alternation, which would leave a visible gap
  // in the zebra. Render first, then drop the empties, then tone what is left.
  const drawn = bands.map((b) => ({ b, html: (b.pin ? b.html : b)("") })).filter((x) => x.html.trim());
  const pin = Math.max(0, drawn.findIndex((x) => x.b.pin));
  const body = drawn
    .map((x, i) => {
      const cls = x.b.pin ? "band-sky tight" : Math.abs(i - pin) % 2 === 0 ? "band tight" : "tight";
      return (x.b.pin ? x.b.html : x.b)(cls);
    })
    .join("\n\n");

  return head({
    title: g.equivalent
      ? `${g.english} (${g.langName}) Set Guide: Cards & English Equivalent | Garbage Rips 585`
      : `${g.english} (${g.langName}) Set Guide | Garbage Rips 585`,
    desc, canonical: url, image: `${SITE}/assets/og-image.jpg?v=2`, ld, noindex: thin, css: rarityCompare(g, en) ? PAGE_CSS : "",
  }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; ${g.langFlag ? `${g.langFlag} ` : ""}${esc(g.langName)} set</span>
    <h1>${esc(g.english)}</h1>
    ${g.native ? `<p class="intl-hero-native cjk" lang="${esc(g.lang)}">${esc(g.native)}</p>` : ""}
    <p class="lede" style="max-width:34em">${
      en
        ? `The ${esc(g.langName)} printing of the set English calls ${esc(en.name)}. Same cards, different name.` +
          (g.released && en.released && g.released < en.released ? " And out first." : "")
        : `A ${esc(g.langName)} set that never got an English release.`
    }</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / <a href="/sets/">Card sets</a> / ${esc(g.english)}</p>

    <div class="facts">
      <div class="fact"><div class="n">${total ?? "?"}</div><div class="l">Cards total</div></div>
      ${g.cardCount?.official ? `<div class="fact"><div class="n">${g.cardCount.official}</div><div class="l">In the printed set</div></div>` : ""}
      ${secretCount ? `<div class="fact"><div class="n">${secretCount}</div><div class="l">Numbered past the set</div></div>` : ""}
      ${rips.length
        ? `<a class="fact fact-link" href="/videos.html?set=${g.id}"><div class="n">${rips.length}</div><div class="l">Rip${rips.length === 1 ? "" : "s"} on this channel <span aria-hidden="true">&rarr;</span></div></a>`
        : `<div class="fact"><div class="n">-</div><div class="l">Rips on this channel</div></div>`}
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${longDate(g.released) || "Unknown"}</div><div class="l">Release date${g.released ? ` &bull; ${yearsSince(g.released)}` : ""}</div></div>
    </div>
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
  </div>
</div>

</main>
${footer("Set data from TCGdex, card names via PokeAPI. Fan made, not official.")}
<script>
(function(){
  var lb=document.getElementById('lb'), img=document.getElementById('lbImg'), last=null;
  function open(b){
    last=b;
    img.src=b.dataset.img; img.alt=b.dataset.name+' '+b.dataset.number;
    document.getElementById('lbNm').textContent=b.dataset.name;
    document.getElementById('lbRr').textContent=[b.dataset.rarity,b.dataset.number].filter(Boolean).join(' • ');
    document.getElementById('lbPr').textContent='';
    lb.classList.add('on');
    document.body.style.overflow='hidden';
    lb.querySelector('.lb-close').focus();
  }
  function close(){
    lb.classList.remove('on'); document.body.style.overflow='';
    if(last) last.focus();
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

// ------------------------------------------------------------------------ run

await mkdir(OUT, { recursive: true });
const written = [];
for (const [id, g] of Object.entries(guides.sets || {})) {
  const page = guidePage({ ...g, id });
  await writeFile(join(OUT, `${id}.html`), page);
  written.push({ id, english: g.english, rips: (ripsBySet[id] || []).length, cards: g.cards?.length || 0 });
}

console.log(`Wrote ${written.length} non-English set guides to public/sets/`);
for (const w of written) {
  console.log(`  /sets/${w.id}.html`.padEnd(34) + `${w.english.padEnd(18)} ${String(w.cards).padStart(3)} cards, ${w.rips} rip${w.rips === 1 ? "" : "s"}`);
}
