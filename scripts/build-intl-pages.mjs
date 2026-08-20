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

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// NO packplayer.js, BUT packs.css STAYS. These pages wear a .pack facade as
// decoration, so the stylesheet is doing real work; the script is not.
// THE "On the channel" LIST IS PLAIN TEXT LINKS, which is the whole reason this
// is safe and is the opposite of what shared/chrome.mjs's note assumed: it says
// every set guide plays a tile in place. Driven in headless Chrome with a real
// dispatched click, no set guide ever did. packplayer only claims an <a> to a
// rip that WRAPS an <img> or a .pack facade, and a bare <li><a>title</a> has
// neither, so those links navigated before this change and navigate after it.
// If a set guide ever grows a picture tile, put APP_JS back in the same edit.
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, FONTS,
  APP_JS_NO_PACKPLAYER as APP_JS } from "../shared/chrome.mjs";
import { labelFor, CARD_SETS } from "../shared/taxonomy.mjs";
import { parseHits, rarityLabelOf, rarityMark, RARITY_CSS } from "../shared/rarity.mjs";
import { esc, longDate, shortDate, rarityLabel, imgDims, avifPicture, moneyCompact } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/sets");

/**
 * THE ENGLISH SET, SHOWN RATHER THAN NAMED.
 *
 * These pages exist to answer one question: "I watched the Abyss Eye rips, what
 * do I buy in a US shop?" They answered it in words and the words are the weak
 * form of the answer, because the two things a person matches in a shop are
 * both pictures. The logo is what is printed across the box and the pack. The
 * symbol is what is printed on the card, and it is the only way to check a
 * loose single.
 *
 * BOTH BELONG TO THE ENGLISH SET AND ARE LABELLED AS THE ENGLISH SET'S. There
 * is no Japanese or Korean logo on this site and TCGdex publishes none for
 * these sets (M1 through M5 return no logo, no symbol and no card images at
 * all), so the native column stays text. An asymmetric panel is the honest
 * shape here: putting the English artwork on the Japanese side, or captioning
 * it loosely enough to read as either, is exactly the swap the brief forbids.
 */
let LOGO_DIMS = {};
try {
  LOGO_DIMS = JSON.parse(await readFile(join(ROOT, "data/logo-dims.json"), "utf8"));
} catch {
  /* written by scripts/build-logos.py, which measures as it resizes.
     There is no measure-logos.py: it was named in five comments and had
     never been in the tree, which is how five logos came to have no
     dimensions and therefore no srcset at all. */
}
const logosOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/logos")).catch(() => []))
    .map((f) => /^(.+)-pokemon-tcg-set-logo\.webp$/.exec(f)?.[1])
    .filter(Boolean)
);
/**
 * Drawn at 150px wide inside the panel. The masters are normalised by HEIGHT to
 * 300px and every one is a different width, so the -sm.webp (100px tall, 5-17KB)
 * is offered first with its own real width descriptor and the master second,
 * exactly as setCardLogo does in build-set-pages.mjs. Never emitted for a set
 * with no file: onerror hides a 404 in the browser and still pays for it.
 */
const LOGO_BOX_W = 150;
const LOGO_BOX_H = 56;
const enLogo = (setId, alt) => {
  if (!logosOnDisk.has(setId)) return "";
  const base = `/assets/logos/${setId}-pokemon-tcg-set-logo`;
  const d = LOGO_DIMS[`${setId}-pokemon-tcg-set-logo.webp`];
  if (!d) return "";
  const smW = Math.round((d[0] * 100) / d[1]);
  // SIZES IS THE DRAWN WIDTH, WHICH object-fit:contain DECIDES, NOT THE BOX
  // WIDTH. A flat "150px" claims 300 device px at DPR2, which no -sm.webp is
  // wide enough to satisfy, so Chrome correctly reached past it for the 300px
  // tall master on every guide. contain scales by min(boxW/w, boxH/h), so the
  // drawn width is the smaller of the box width and the height-limited width,
  // and that is the number the browser needs.
  const drawnW = Math.round(Math.min(LOGO_BOX_W, (LOGO_BOX_H * d[0]) / d[1]));
  return `<img class="intl-logo" src="${base}-sm.webp"
          srcset="${base}-sm.webp ${smW}w, ${base}.webp ${d[0]}w" sizes="${drawnW}px"
          width="${smW}" height="100" alt="${esc(alt)}" loading="lazy" decoding="async">`;
};

// The TCGdex bases that answer 404, found by fetching all 4,655 image urls the
// site emits. Same file the English guides read for the same reason.
let NO_SCAN = new Set();
try {
  NO_SCAN = new Set(JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).bases || []);
} catch {
  /* optional: a missing base then renders as an img that removes itself */
}

let SYMBOL_DIMS = {};
try {
  SYMBOL_DIMS = JSON.parse(await readFile(join(ROOT, "data/symbol-dims.json"), "utf8")).symbols || {};
} catch {
  /* run: node scripts/sync-symbols.mjs */
}
/** 32px box here rather than the 40px the English guides use: it sits in a caption line. */
const enSymbol = (en) => {
  const d = SYMBOL_DIMS[en?.apiId];
  if (!d) return "";
  const k = Math.min(32 / d[0], 32 / d[1], 1);
  return `<img class="intl-sym" src="/assets/symbols/${esc(en.apiId)}-pokemon-tcg-set-symbol.webp"
          width="${Math.round(d[0] * k)}" height="${Math.round(d[1] * k)}"
          alt="The ${esc(en.name)} set symbol" loading="lazy" decoding="async">`;
};

const guides = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8"));
const { sets: enSets, rarityOrder } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

const enById = new Map(enSets.map((s) => [s.id, s]));

/* ------------------------------------------- who priced the English chase --
 *
 * THESE TWELVE PAGES CREDITED THE WRONG FEED FOR FOUR MONTHS' WORTH OF DOLLARS,
 * found 19 August 2026. The English chase band's note read "English <set> card
 * scans from TCGdex, TCGplayer market prices, read August 16, 2026" while every
 * figure in it is PriceCharting's ungraded price guide value: Gastly #177 on
 * /sets/ja-cyber-judge.html is $92.67, which is exactly what
 * public/data/cards/temporal-forces.json holds under priceSource
 * pricecharting.com. The date was right the whole time; only the name was
 * wrong, which is the version of this bug nobody catches by looking.
 *
 * IT IS READ FROM THE CARD FILE AND NOT FROM sets.json, and that is the point
 * of doing it at all rather than typing "PriceCharting" here. sets.json still
 * carries priceSource "TCGdex" on every record, written by
 * scripts/reconcile-cards.mjs, which is a second stale stamp sitting one field
 * away from the prices this band prints. public/data/cards/<id>.json is the
 * file shared/card-prices.mjs calls the one source for a card price, so it is
 * the one to ask. A set with no card file falls back to the site-wide default
 * that module already uses.
 */
const enPriceDocs = new Map();
for (const s of enSets) {
  try {
    const doc = JSON.parse(await readFile(join(ROOT, `public/data/cards/${s.id}.json`), "utf8"));
    enPriceDocs.set(s.id, { priceSource: doc.priceSource, pricesChecked: doc.pricesChecked, checked: doc.checked });
  } catch {
    /* no checklist for this set; the caller falls back */
  }
}

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
    ${/* The second sentence agrees as well as the first. An imported guide that
          has hit exactly one card read "1 card out of our own packs. Every one
          of them is in a video you can watch." build-set-pages.mjs carries the
          same lede and got the same fix. */ ""}<p class="lede" style="max-width:38em">${hits.length} card${
      hits.length === 1 ? "" : "s"
    } out of our own packs.
      ${hits.length === 1 ? "It is" : "Every one of them is"} in a video you can watch.</p>
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
/**
 * The rules the pictures need, and they are ALWAYS emitted rather than gated on
 * a section, because the elements they paint are on every guide that has an
 * English twin, which is twelve of the thirteen. Same trade as PAGE_CSS below:
 * inline here rather than in ui.css, which is render blocking on all 426 pages.
 */
const ART_CSS = `
/* The English set logo, in the English half of the twin panel. 150px wide with
   a FIXED 56px-tall box, because the logos are normalised by height at the
   source but not all the same width: without the box the two columns of the
   panel end up different heights and the grid rows jump between guides. */
.intl-logo{display:block;width:auto;max-width:150px;height:56px;object-fit:contain;
  object-position:left center;margin:6px 0 10px}
/* The symbol line under the panel. 32px box, object-fit:contain, same reasoning
   as .setsym-i on the English guides: the files are not one shape. */
.intl-spot{display:flex;align-items:center;gap:var(--s3);margin-top:var(--s4);
  max-width:44em;font-size:var(--t-sm);line-height:1.5}
.intl-sym{flex:0 0 32px;width:32px;height:32px;object-fit:contain}
/* The borrowed English chase grid. The heading has to sit apart from the native
   grid above it or the two read as one list of cards, which is the single thing
   this block must not do. */
.intl-enh{margin-top:var(--s6);font-size:var(--t-h3)}
.intl-ensay{max-width:42em;margin-top:6px;font-size:var(--t-sm);line-height:1.55;color:var(--ink-2)}
/* .chase-card is a <button> in ui.css and these are anchors, so the two type
   rules a button does not inherit are restated. Nothing else changes. */
.intl-enchase .chase-card{display:block;text-align:left;text-decoration:none;color:inherit;font:inherit}
`;

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
.rcmp tr.is-same{background:var(--sky-tint)}
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
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
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
        ${/* AND IT ONLY PROMISES THE CHECKLIST WHERE THERE IS ONE. Two of these
              guides have no card records at all and render a "No checklist yet"
              band further down, so this line was sending a reader past the whole
              page to find something the page says it does not have. Found while
              re-reading every directional phrase on these guides after the
              sections moved; it predates that move. */ ""}
        <p class="intl-lead">The one on this page${g.cards?.length ? `, checklist below` : ""}</p>
      </li>
      <li class="intl is-en">
        <p class="intl-lang">English${en.apiId ? ` &bull; ${esc(String(en.apiId).toUpperCase())}` : ""}</p>
        <h3>${esc(en.name)}</h3>
        ${enLogo(g.equivalent, `The English ${en.name} set logo`)}
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
    ${enSymbol(en) ? `<p class="intl-spot">${enSymbol(en)}<span>That is the symbol on an English ${esc(en.name)} card,
      printed at the bottom beside the collector number. It is not the mark on the ${esc(g.langName)} cards in these
      rips: the two printings carry their own.</span></p>` : ""}
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

/**
 * A CARD-SHAPED BUTTON WITH NO CARD IN IT IS THE WORST OF BOTH THINGS, and this
 * grid was drawing twelve of them on five of the thirteen guides.
 *
 * TCGdex publishes no card images for the current Japanese sets, so Abyss Eye,
 * Ninja Spinner, Nihil Zero, Mega Brave and Mega Symphonia each rendered
 * `notable` as twelve `<button class="chase-card">` tiles holding three lines of
 * text apiece. Measured at 390x844 that is 1,786px, more than two full screens,
 * of a grid whose row height is set by a 245x342 scan that never arrives. Every
 * one of those buttons also carried `aria-label="Enlarge <card>"` and did
 * nothing at all when pressed: the lightbox handler is gated on `data-img`,
 * which is empty on every one of them. A control that announces an action it
 * cannot perform is a worse failure than a missing picture.
 *
 * SPLIT BY WHETHER THERE IS A SCAN, which is exactly what build-pokemon.mjs
 * already does for the identical problem, down to the `.flat-list` classes: they
 * are in ui.css already and the argument for them is written above them there.
 * A card with a scan keeps the grid. A card without one becomes a named row in a
 * list that is sized by its text, so it says out loud that it is an index of
 * names rather than pretending to be a wall of cards.
 *
 * IT IS NOT A PLACEHOLDER AND MUST NEVER BECOME ONE. The rule these pages work
 * under is that a row with no scan says so; borrowing the English card's
 * artwork for a Japanese entry was measured and rejected long before this, for
 * the reason written above enChase below.
 */
function chaseBand(g, en, cls) {
  const withScan = g.notable.filter((c) => c.image);
  const noScan = g.notable.filter((c) => !c.image);
  /**
   * WHERE THE NATIVE SIDE HAS NOT ONE SCAN, THE ENGLISH GRID GOES FIRST.
   *
   * Splitting the imageless tiles into a list was the honest fix and it bought
   * no scrolling at all: measured at 390x844 the band went 1,786px to 1,838px,
   * because twelve text items sit in two columns whichever element they are, and
   * the new lede is a paragraph. So on those five guides the four English scans
   * were still 3,726px down, which is worse than the 3,674px they started at.
   *
   * Putting them above the name list moves the only pictures on the page up by
   * about a screen. It is only done when the native side has NOTHING, because
   * that is the only case where the section's own cards are not being pushed
   * under somebody else's: with even one native scan the grid leads, as it
   * always has.
   */
  const enFirst = !withScan.length && Boolean(enChase(g, en));
  const enBlock = enChase(g, en, { nativeBelow: enFirst });
  // NO LEDE WHERE THERE IS NOTHING TO EXPLAIN. This band carried none before and
  // the six guides whose grid is complete still carry none: a sentence counting
  // the tiles under a heading that already says what they are is the "picture
  // that repeats the sentence beside it" failure in prose form. `notable` is also
  // capped at twelve out of however many qualify, so "the 12 cards worth hunting"
  // would have been a claim about the set that the cap, not the set, decided.
  const say = !noScan.length
    ? ""
    : !withScan.length
      ? `TCGdex publishes no card scans for ${esc(g.english)}, so this page can name the cards worth hunting but cannot show them.${
          enBlock ? " What it can show is the same cards in English." : ""
        }`
      : `${withScan.length} of these have a scan and are pictured. The other ${noScan.length} we can name but not show.`;
  // The name list needs a heading of its own wherever something else sits above
  // it, and the two cases want different words: beside a grid of this set's own
  // scans it is the remainder, under the English grid it is this set's list.
  const flatHead = withScan.length
    ? `<h3 class="flat-h">Named, with no scan to show</h3>`
    : enFirst
      ? `<h3 class="flat-h">The ${esc(g.english)} chase list</h3>`
      : "";

  const tile = (c) => `<button class="chase-card" type="button"
        data-img="${esc(c.imageLarge || c.image || "")}"
        data-name="${esc(cardName(c))}" data-rarity="${esc(rarityLabel(c.rarity) || (c.secret ? "Numbered past the set" : ""))}"
        data-number="${esc(c.localId || "")}" data-price=""
        aria-label="Enlarge ${esc(cardName(c))}">
        ${/* alt="" : the button is aria-labelled "Enlarge <name>" and the .nm
              and .rr lines below repeat the name and number, so an alt made a
              screen reader say the card three times over on one tile. */ ""}${avifPicture(`<img src="${esc(c.image)}" alt="" loading="lazy" onerror="this.remove()"${imgDims(c.image)}>`)}
        <div class="nm">${esc(cardName(c))}</div>
        ${cardSub(c) ? `<div class="ig-native" lang="${esc(g.dataSource?.lang || g.lang)}">${esc(cardSub(c))}</div>` : ""}
        <div class="rr">${esc(rarityLabel(c.rarity) || (c.secret ? "Secret" : kindOf(c) || "Card"))} &bull; ${esc(c.localId || "")}</div>
      </button>`;

  const row = (c) => `<li class="flat-item">
        <b>${esc(cardName(c))}</b>
        ${cardSub(c) ? `<span lang="${esc(g.dataSource?.lang || g.lang)}">${esc(cardSub(c))}</span>` : ""}
        <span>${esc(rarityLabel(c.rarity) || (c.secret ? "Secret" : kindOf(c) || "Card"))} &bull; ${esc(c.localId || "")}</span>
      </li>`;

  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The ones you want</p>
    <h2>Top <span class="hl">chase cards</span></h2>
    ${say ? `<p class="lede" style="max-width:42em">${say}</p>` : ""}
${enFirst ? enBlock : ""}    ${withScan.length ? `<div class="chase-grid">
      ${withScan.map(tile).join("\n      ")}
    </div>` : ""}
    ${noScan.length ? `${flatHead}
    <ul class="flat-list">
      ${noScan.map(row).join("\n      ")}
    </ul>` : ""}
    <p class="price-note">No prices here on purpose. Imported singles are priced in euro or yen by the
      databases that carry them at all, and a converted half-filled price table is worse than none. The English
      ${en ? `<a href="/sets/${esc(g.equivalent)}.html">${esc(en.name)} guide</a> carries` : "guides carry"} live USD
      values for the same cards.</p>
${enFirst ? "" : enBlock}  </div>
</section>`;
}

/**
 * THE ENGLISH CHASE GRID WAS TRAPPED INSIDE A BAND THAT DOES NOT ALWAYS RENDER.
 *
 * enChase is the one honest picture of a card these pages have, and it was only
 * ever reached through chaseBand, which the band list gates on `g.notable`.
 * Two guides carry no notable list at all, so /sets/ja-cyber-judge.html and
 * /sets/ko-mask-of-change.html showed THREE images each across a 5,198px and a
 * 5,534px page, with the first one 1,304px down, while the English set they are
 * both about had eight priced, pictured chase cards sitting in sets.json the
 * whole time. Nothing was missing from the data; the grid was simply behind a
 * door that never opened.
 *
 * The band says whose cards these are in its own heading and in the paragraph
 * under it, which is the same guard the in-chaseBand version carries: they are
 * the English set's cards, numbers and prices, and they are not presented as the
 * imported printing's.
 */
function enOnlyBand(g, en, cls) {
  // TWO GUIDES REACH THIS AND THEY ARE EMPTY FOR TWO DIFFERENT REASONS, so the
  // sentence is worked out from the data rather than written once and reused.
  // ja-cyber-judge has no card records at all. ko-mask-of-change has 101 of
  // them, none labelled above Double Rare and none numbered past the printed
  // set, which is the condition sync-intl-guides.mjs already warns about at
  // build time. Saying "TCGdex has no cards for this set" on the second one
  // would be plainly false to anybody who scrolled to the checklist.
  const why = g.cards?.length
    ? `No card in the ${esc(g.langName)} printing is labeled at a chase rarity, so there is nothing of its own to picture here. Its full checklist is further down.`
    : `TCGdex has not published a card list for the ${esc(g.langName)} printing yet, so there is nothing of its own to picture here.`;
  const block = enChase(g, en, { standalone: true, why });
  if (!block) return "";
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The ones you want</p>
    <h2>What to <span class="hl">chase</span> in English</h2>
${block}  </div>
</section>`;
}

/**
 * THE FOUR PRICIEST CARDS IN THE ENGLISH SET, WITH THEIR SCANS.
 *
 * TCGdex publishes no card images for the newest Japanese sets, so six of the
 * thirteen guides render this grid as twelve captioned boxes with nothing in
 * them: a wall that looks like cards and shows none. Abyss Eye is 1,555 words
 * with one picture on it, and that picture is the empty lightbox.
 *
 * THE ONE THING THAT CANNOT BE DONE IS THE OBVIOUS ONE. Borrowing the English
 * scan for each Japanese chase card was measured before it was rejected: not a
 * single one of the sixty chase cards across those five guides resolves to
 * exactly one English card. Mega Darkrai ex exists in English Pitch Black four
 * times, at Double Rare, Ultra Rare, Special Illustration Rare and Mega Hyper
 * Rare, and the Japanese entry carries no rarity at all to choose between them,
 * because TCGdex leaves it null on every card numbered past the set. Picking one
 * would put a specific card's artwork under another card's name, which is the
 * error a reader cannot see.
 *
 * WHAT IS SAFE is the English set's OWN chase list, shown as the English set's
 * own and nothing else. Each row is a card, a number, a rarity and a price that
 * all come from the same record in public/data/sets.json, and the heading says
 * whose they are. It is also the paragraph directly above it, made real: that
 * paragraph says the English guide carries USD values for these cards, and four
 * priced cards say it better than a sentence pointing somewhere else.
 *
 * FOUR, NOT EIGHT. Two rows on a phone. The English guide holds all eight and is
 * one tap away, and this band is a signpost rather than a second copy of it.
 * IT STAYS FOUR EVEN WHERE IT IS THE ONLY PICTURE ON THE PAGE. Raising it to six
 * or eight on the imageless guides was considered and is exactly the wrong
 * reason to change an argued number: the four are a signpost wherever they sit,
 * and adding borrowed scans to lift a density figure is not the same thing as
 * answering a reader's question.
 *
 * `standalone` drops the <h3> and the "not the ones above" clause, for the case
 * where enOnlyBand carries this block as a section of its own and there is no
 * native grid above it for the sentence to point at. `why` is the caller's
 * one-clause statement of what is absent, and it is passed in rather than
 * written here because the two guides that need it are absent for two different
 * reasons and a single sentence covering both would be false about one of them.
 */
function enChase(g, en, { standalone = false, why = "", nativeBelow = false } = {}) {
  // Skip the 101 TCGdex bases that 404, up front. onerror hides the gap in the
  // browser and the page still pays for the round trip to find out, which is
  // the reason data/no-scan.json exists. None of the current chase cards is on
  // that list; this is here so a future set's is not the way it gets noticed.
  const chase = (en?.chase || [])
    .filter((c) => c.image && !NO_SCAN.has(String(c.image).replace(/\/(low|high)\.(webp|avif|png|jpg)$/, "")))
    .slice(0, 4);
  if (chase.length < 2) return "";
  return `${standalone ? "" : `    <h3 class="intl-enh">The same cards in English</h3>\n`}    <p class="intl-ensay">The priciest cards in English ${esc(en.name)}, which is the set on the shelf in a US shop.
      These are that set's own cards, numbers and prices${
        // THE PREPOSITION HAS TO FOLLOW THE LAYOUT. This block sits under the
        // native grid in the ordinary case, above the native NAME LIST where
        // that list has no scans, and alone on the two guides with no chase list
        // at all. "Not the Japanese ones above" printed over the top of a page
        // whose Japanese cards are below it is a small lie that a reader
        // scrolling in a shop will notice before anything else on the section.
        standalone ? `` : nativeBelow ? `, not the ${esc(g.langName)} ones listed below` : `, not the ${esc(g.langName)} ones above`
      }.${standalone && why ? ` ${why}` : ""}</p>
    <div class="chase-grid intl-enchase">
      ${chase
        .map(
          // alt="" HERE MATTERS MORE THAN ON THE BUTTONS. This tile is an <a>,
          // so its accessible name is COMPUTED FROM ITS CONTENTS: the alt was
          // being concatenated with the .nm/.rr/.pr text into one link name
          // reading "Bulbasaur 001, English Base Set Bulbasaur Rare • 001
          // $1.23". Emptying the alt leaves the link named by the words that
          // are actually on the screen, which is also what WCAG 2.5.3 wants.
          (c) => `<a class="chase-card" href="/sets/${esc(g.equivalent)}.html">
        ${avifPicture(`<img src="${esc(c.image)}" alt="" loading="lazy" decoding="async" onerror="this.remove()"${imgDims(c.image)}>`)}
        <div class="nm">${esc(c.name)}</div>
        <div class="rr">${esc(rarityLabel(c.rarity) || "")} &bull; ${esc(c.number)}</div>
        <div class="pr">${moneyCompact(c.price)}</div>
      </a>`
        )
        .join("\n      ")}
    </div>
    <p class="price-note">English ${esc(en.name)} card scans from TCGdex, ${
      esc(enPriceDocs.get(en.id)?.priceSource || "pricecharting.com")
    } price guide values for an ungraded copy${
      // The card file's own price date first, because that is the day the money
      // was read; the set record's stamp is the fallback and says the same
      // thing today. Both beat the checklist date, which is a different read.
      longDate(enPriceDocs.get(en.id)?.pricesChecked || en.pricesAsOf || en.chasePricesAsOf)
        ? `, read ${esc(longDate(enPriceDocs.get(en.id)?.pricesChecked || en.pricesAsOf || en.chasePricesAsOf))}`
        : ""
    }. Every one of them links through to the ${esc(en.name)} guide, which prices the whole checklist.</p>
`;
}

function rarityBand(g, rarities, maxN, secretCount, cls) {
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What is actually rare</p>
    <h2>Rarity <span class="hl">breakdown</span></h2>
    ${/* THE LADDER WAS DRAWING EVERY BAR FULL, on all thirteen guides.
          ui.css styles `.rar-name`, `.rar-n` and `.rar-bar i`, which is the
          markup build-set-pages.mjs emits. This file emitted `.rar-n` for the
          NAME, `.rar-c` for the count and a `<span>` inside the bar, so the fill
          matched no rule at all: the width was on an unstyled inline element
          inside an overflow:hidden track, and 38 Commons and 1 Mega Hyper Rare
          rendered as identical empty full-width pills.
          A chart cannot be wrong quietly, which is what this was: the numbers
          beside it were right the whole time, so nothing read as broken.

          data-figure marks a figure drawn in markup rather than fetched, so
          check-build.py's image-coverage report can see it. It selects nothing
          and matches build-set-pages.mjs, which puts it on the same ladder.
          Note where this comment sits: a second `${...  ""}` block of its own
          would have added a blank line and an indent to all thirteen pages,
          which is a rendered change made by a comment. */ ""}
    <div class="rarity-list" data-figure="chart">
      ${rarities.map(([r, n]) => `<div class="rar">
        <span class="rar-name">${esc(rarityLabel(r) || r)}</span>
        <span class="rar-n">${n}</span>
        <span class="rar-bar"><i style="width:${Math.max(4, Math.round((n / maxN) * 100))}%"></i></span>
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
      ${/* THE TILE FILE, NOT THE MASTER. `.packshot .pack-art` measures 172x262
            CSS px at every width, so 344x524 at DPR2, and packs.css hands it the
            810x1440 master: 129.8KB to paint a box a 400x711 file covers at
            1.16x for 45.3KB. Taken as an inline background rather than by adding
            `.pack--tile`, because that class also carries position:absolute in
            ui.css and would tear this element out of its row. The url is
            absolute because packs.css's own is relative to /assets/. Same change
            and same reasoning as packTile() in build-set-pages.mjs.
            The wrapper stays the GENERIC one. This is a page about a Japanese or
            Korean set and the site has drawn no wrapper for one; putting the
            English twin's skin here would be a picture of the wrong pack. */ ""}
      <div class="packshot pack pack--default"><span class="pack-face pack-l"><span class="pack-art" style="background-image:url('/assets/packs/default-garbage-rips-585-booster-pack-tile.webp')"></span></span></div>
      <div>
        <p class="lede">Imported packs, opened on camera in Rochester. No idea what any of the text says, which is half
          the fun. Every ${esc(g.english)} rip on the channel is one tap away.</p>
        <div class="btn-row" style="margin-top:16px">
          <a class="btn btn-yt" href="/videos.html?set=${g.id}">Watch the ${esc(label)} rips</a>
        </div>
      </div>
    </div>
    ${/* THE SENTENCE ABOVE PROMISED "one tap away" AND CHARGED TWO.
          Twelve of these pages had the rips tagged and joined correctly and
          still linked no rip: the band printed a count and a button to
          /videos.html filtered by this set, so watching the video the page is
          about meant landing on a filtered index first. The join was never
          broken, the list was simply never written. Same `.riplist` shape as
          build-set-pages.mjs's English "Every <set> rip" band, same twelve-row
          cap and same "all N" fallback, so a reader who has seen one set guide
          has seen this one.

          THE CAP IS INERT TODAY AND STAYS ANYWAY. The busiest imported set is
          Abyss Eye at 5, so nothing is currently truncated; the day one of
          these gets ripped forty times, a wall of rows should not be the way
          anybody finds out. */ ""}
    <ul class="riplist">
${rips
  .slice()
  .sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")))
  .slice(0, 12)
  .map(
    (v) => `      <li><a href="/${esc(v.path)}">${esc(v.siteTitle || v.title)}</a>${
      v.published ? `\n        <span>${esc(shortDate(v.published))}</span>` : ""
    }</li>`,
  )
  .join("\n")}
    </ul>
    ${rips.length > 12
      ? `<p style="margin-top:var(--s3)"><a class="btn btn-ghost btn-sm" href="/videos.html?set=${esc(g.id)}">All ${rips.length} ${esc(label)} rips</a></p>`
      : ""}
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
      // See the matching note in build-set-pages.mjs: `url` is not a substitute
      // for mainEntityOfPage, which is the property Google's Article
      // documentation actually names. Both English and imported guides were
      // emitting only the first.
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
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
        { "@type": "ListItem", position: 2, name: "Set guides", item: `${SITE}/sets/` },
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
    // NOT `: null`. A guide with no chase list of its own still has an English
    // twin whose chase cards are priced and pictured, and hiding the only card
    // art on the page behind an empty native list is what left two of these
    // guides with three images apiece. enOnlyBand returns "" where there is
    // genuinely nothing to show, and the empty-band filter below drops it.
    g.notable?.length ? (cls) => chaseBand(g, en, cls) : (cls) => enOnlyBand(g, en, cls),
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
    // No " | Garbage Rips 585". These are the longest titles in /sets/, because
    // the name carries a language in brackets before the descriptor even starts.
    // Measured 17 August 2026 at 20px Arial, all 12 ran 702-788px against
    // Google's ~580px cut, and what the cut ate was "English Equivalent", which
    // is the whole reason somebody lands on a Japanese or Korean set guide.
    // Bare they run 523-609px. The sibling English guides in build-set-pages.mjs
    // KEEP their brand and should: setTitle drops the descriptor instead and 26
    // of 27 already fit, so there is nothing there for this change to buy.
    title: g.equivalent
      ? `${g.english} (${g.langName}) Set Guide: Cards & English Equivalent`
      : `${g.english} (${g.langName}) Set Guide`,
    desc, canonical: url, image: `${SITE}/assets/og-image.jpg?v=2`, ld, noindex: thin,
    // Three blocks, each carried only where its markup exists. ART_CSS is the
    // pictures, PAGE_CSS is the card-for-card table, and RARITY_CSS is the
    // shared key's own stylesheet, which these pages were emitting `.rk` markup
    // without: the SR badge on /sets/ja-cyber-judge.html rendered as bare text
    // because nothing on the page defined the class.
    css: [en ? ART_CSS : "", rarityCompare(g, en) ? PAGE_CSS : "", HITS_BY_SET.has(g.id) ? RARITY_CSS : ""]
      .filter(Boolean).join("\n"),
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
    <p class="crumbs"><a href="/">Home</a> / <a href="/sets/">Set guides</a> / ${esc(g.english)}</p>

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
    <picture><source id="lbAvif" type="image/avif"><img id="lbImg" src="" alt=""></picture>
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
    // Same AVIF <source> the English guides fill in, and for the same reason:
    // the lightbox is the only place either page loads high.webp, 600x825, and
    // AVIF is 37% smaller at that size. avifPicture() cannot reach it because
    // the url only becomes an image url on click. The host test is the one
    // avifPicture applies: only assets.tcgdex.net publishes an AVIF beside its
    // WebP, and a <source> aimed at a 404 paints a broken card in some browsers
    // rather than falling back. srcset FIRST so the webp is never requested.
    var big=b.dataset.img, avif=document.getElementById('lbAvif');
    if(big.indexOf('https://assets.tcgdex.net/')===0 && big.slice(-5)==='.webp')
      avif.setAttribute('srcset', big.slice(0,-5)+'.avif');
    else avif.removeAttribute('srcset');
    img.src=big; img.alt=b.dataset.name+' '+b.dataset.number;
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
