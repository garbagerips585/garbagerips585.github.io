// THE TWO PRICECHARTING PARSERS, IN ONE PLACE, BECAUSE THE WHOLE POINT IS THAT
// THEY ARE DIFFERENT FROM EACH OTHER.
//
// Every PriceCharting figure this site publishes is read TWICE, from two
// different page templates, and the second read is the only thing that catches
// the trap in data/top-graded-PLAN.md:
//
//     console listing   used_price=Ungraded  cib_price=Grade 9  new_price=PSA 10
//     product page      used_price=Ungraded  new_price=Grade 8  manual_only_price=PSA 10
//
// `new_price` is PSA 10 on one page type and Grade 8 on the other. On Base Set
// Charizard #4 that is $28,144.52 against $1,330.50, a 21x error that reads as
// a perfectly reasonable price for the card. NEITHER PARSER BELOW TRUSTS A td
// id. Both map columns from the <th> labels sitting above them, and both refuse
// a page whose headers they do not recognise rather than falling back to a
// position.
//
// WHY THIS FILE EXISTS. There were three copies of the listing parser and two
// of the product parser, in scripts/sync-graded-top.mjs,
// scripts/sync-pricecharting-cards.mjs and scripts/verify-graded-top.mjs, and a
// fourth and fifth were about to be written for the raw ranking behind
// /most-valuable-cards.html. Copies of a parser are survivable. Copies of a
// parser whose entire job is to disagree with another parser are not: the day
// somebody fixes a column bug in one copy, the second read stops being a second
// opinion and starts being a duplicate of the first. Same argument as
// shared/graded-gate.mjs being shared rather than copied.
//
// The crawler scripts cannot import each other, which is why this is a module
// and not an export from sync-graded-top.mjs: that file runs an 1,100 page
// crawl at import time, so importing it to borrow a function would start one.
//
// scripts/sync-pricecharting-cards.mjs STILL CARRIES ITS OWN INLINE COPY of the
// row loop and that is left alone deliberately. It parses the same rows into a
// different shape, keyed by collector number with the bracketed printing split
// out, and it is the file that prices all 5,181 cards in the 28 set guides.
// Rewriting it to sit on this module is a good idea and it is not this change.

/** Entities out. See below for why the ORDER matters. */
export const unent = (s) =>
  String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ");

// ENTITIES ARE DECODED BEFORE THE TRIM, NOT AFTER, and the order is the whole
// point. The blank column headers are "&nbsp;", so trimming first leaves a
// literal "&nbsp;" which only becomes a space once decoded, and the space never
// gets trimmed. That made every header compare as " " against "" and
// sync-graded-top.mjs skipped all 793 consoles as "unexpected columns" while
// fetching every one of them: 50 pages, 0 products, and a log that looked like
// progress.
export const text = (s) =>
  unent(String(s)).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** A price cell to a number. Anything that is not a positive number is null. */
export const money = (s) => {
  const n = Number(String(s ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * The column layout every Pokemon card CONSOLE LISTING page is expected to
 * have. A page that disagrees is recorded and skipped rather than read
 * positionally anyway.
 */
export const CONSOLE_HEADERS = ["", "Card", "Ungraded", "Grade 9", "PSA 10", ""];

/**
 * One page of a console listing. Returns {rows, next, headers}.
 *
 * Moved here verbatim from scripts/sync-graded-top.mjs, which now imports it.
 * The three price cells come back in column order and the caller is expected to
 * have checked `headers` against CONSOLE_HEADERS first: the names below are
 * only correct BECAUSE that check passed.
 */
export function parsePage(html) {
  const headers = [...html.matchAll(/<th[^>]*>(.*?)<\/th>/gs)].map((m) => text(m[1]));
  const rows = [];
  for (const m of html.matchAll(/<tr[^>]*id="product-(\d+)"[^>]*>(.*?)<\/tr>/gs)) {
    const tr = m[2];
    const a = /<td class="title"[^>]*>\s*<a href="([^"]+)"[^>]*>(.*?)<\/a>/s.exec(tr);
    if (!a) continue;
    const prices = [...tr.matchAll(/<td class="price[^"]*"[^>]*>(.*?)<\/td>/gs)].map((p) => {
      const v = /<span class="js-price"[^>]*>(.*?)<\/span>/s.exec(p[1]);
      return v ? money(text(v[1])) : null;
    });
    const img = /<img class="photo"[^>]*src="([^"]+)"/.exec(tr);
    rows.push({
      id: m[1],
      path: unent(a[1]),
      name: text(a[2]),
      img: img ? unent(img[1]) : null,
      ungraded: prices[0] ?? null,
      g9: prices[1] ?? null,
      psa10: prices[2] ?? null,
    });
  }
  const next = /name="cursor" value="(\d+)"/.exec(html);
  return { rows, next: next ? Number(next[1]) : null, headers };
}

/**
 * Every price column on a PRODUCT page, keyed by the <th> label above it.
 *
 * Returns { cols: { "Ungraded": 609.08, "PSA 10": 32530.59, ... }, headers, ids }
 * or { error }. A page whose price table cannot be read is an ERROR, never an
 * empty result: "we could not read it" and "it says nothing" have to stay
 * different answers, because only one of them is safe to print.
 *
 * Generalised from psa10From() in scripts/verify-graded-top.mjs, which now
 * calls this and keeps its own name for the one column it wants. Checked
 * against the 400 rows already stored in data/top-graded.json's verify block,
 * re-read out of .cache/pricecharting-product with no network: all 400 product
 * figures come back identical, so this is the same read the gate was earned by.
 */
export function productColumns(html) {
  if (/^__HTTP_(\d+)__$/.test(html)) return { error: `http ${/\d+/.exec(html)[0]}` };
  let seen = null;
  for (const m of html.matchAll(/<thead>(.*?)<\/thead>\s*<tbody>(.*?)<\/tbody>/gs)) {
    const heads = [...m[1].matchAll(/<th[^>]*>(.*?)<\/th>/gs)].map((x) => text(x[1])).filter(Boolean);
    const cells = [...m[2].matchAll(/<td id="([a-z_]+price)"[^>]*>(.*?)<\/td>/gs)];
    // A header row and a price row that are not the same length are not a pair,
    // and lining them up anyway is exactly the positional read this file exists
    // to refuse.
    if (!heads.length || heads.length !== cells.length) continue;
    seen = heads;
    const cols = {};
    const ids = {};
    for (const [i, h] of heads.entries()) {
      const v = /<span class="price js-price"[^>]*>(.*?)<\/span>/s.exec(cells[i][2]);
      cols[h] = money(text(v ? v[1] : cells[i][2]));
      ids[h] = cells[i][1];
    }
    return { cols, headers: heads, ids };
  }
  return { error: seen ? `unreadable price table (saw ${seen.join("|")})` : "no price table" };
}

/**
 * PriceCharting's own "change since last update" for one column, in dollars.
 *
 * THIS IS THE RECONCILIATION shared/graded-gate.mjs turns on. When a product
 * page and a console listing disagree, the question is whether the parse is
 * broken or the value simply moved between the two reads, and the product page
 * answers it itself: each price cell carries a `change` span titled "dollar
 * change from last update". On the one graded row that disagreed,
 * 32,530.59 - 12,030.59 = 20,500.00, the listing figure, to the cent.
 *
 * Returns a signed number, or null when the cell carries no change span. Null
 * means "this page does not say", never "it did not move".
 */
export function columnChange(html, header) {
  for (const m of html.matchAll(/<thead>(.*?)<\/thead>\s*<tbody>(.*?)<\/tbody>/gs)) {
    const heads = [...m[1].matchAll(/<th[^>]*>(.*?)<\/th>/gs)].map((x) => text(x[1])).filter(Boolean);
    const cells = [...m[2].matchAll(/<td id="([a-z_]+price)"[^>]*>(.*?)<\/td>/gs)];
    if (!heads.length || heads.length !== cells.length) continue;
    const i = heads.indexOf(header);
    if (i < 0) continue;
    // THE SIGN IS A SIBLING OF THE FIGURE, NOT PART OF IT, and a plus is
    // written as the numeric entity `&#43;`. Reading the whole span as text and
    // stripping non-digits turns "&#43;$12,030.59" into 4312030.59, which is
    // the kind of wrong that still looks like money. So the sign character is
    // matched on its own and the figure comes out of the inner js-price span.
    const span =
      /<span class="[^"]*change[^"]*"[^>]*>\s*(&#43;|\+|-|&minus;|−)?\s*<span class="js-price"[^>]*>(.*?)<\/span>/s
        .exec(cells[i][2]);
    if (!span) return null;
    const n = money(text(span[2]));
    if (n == null) return null;
    return span[1] && /-|minus|−/.test(span[1]) ? -n : n;
  }
  return null;
}

// OUR SET ID -> PRICECHARTING CONSOLE PATH, BY HAND AND ON PURPOSE.
//
// Shared because two files need it now: sync-pricecharting-cards.mjs prices the
// 28 set guides from it, and build-top100.mjs uses it in reverse, to work out
// whether a card on /most-valuable-cards.html belongs to a set this site has a
// guide for and can therefore link a row at.
//
// Not fuzzy matched. PriceCharting has 792 Pokemon consoles and several pairs
// differ by one word ("Scarlet & Violet" against "Scarlet & Violet 151", "Black
// Bolt" against "White Flare"), so a name matcher that is right 26 times out of
// 28 prices two whole guides off the wrong set and nothing about the page looks
// broken. Every line here was read off the crawled console list and checked
// against the card count the guide expects.
export const PC_CONSOLES = {
  "151": "/console/pokemon-scarlet-&-violet-151",
  "ascended-heroes": "/console/pokemon-ascended-heroes",
  "black-bolt": "/console/pokemon-black-bolt",
  "celebrations": "/console/pokemon-celebrations",
  "chaos-rising": "/console/pokemon-chaos-rising",
  "chilling-reign": "/console/pokemon-chilling-reign",
  "crown-zenith": "/console/pokemon-crown-zenith",
  "destined-rivals": "/console/pokemon-destined-rivals",
  "journey-together": "/console/pokemon-journey-together",
  "mega-evolution": "/console/pokemon-mega-evolution",
  "obsidian-flames": "/console/pokemon-obsidian-flames",
  "paldea-evolved": "/console/pokemon-paldea-evolved",
  "paldean-fates": "/console/pokemon-paldean-fates",
  "paradox-rift": "/console/pokemon-paradox-rift",
  "perfect-order": "/console/pokemon-perfect-order",
  "phantasmal-flames": "/console/pokemon-phantasmal-flames",
  "pitch-black": "/console/pokemon-pitch-black",
  "pokemon-go": "/console/pokemon-go",
  "prismatic-evolutions": "/console/pokemon-prismatic-evolutions",
  "rebel-clash": "/console/pokemon-rebel-clash",
  "scarlet-violet": "/console/pokemon-scarlet-&-violet",
  "shining-fates": "/console/pokemon-shining-fates",
  "shrouded-fable": "/console/pokemon-shrouded-fable",
  "stellar-crown": "/console/pokemon-stellar-crown",
  "surging-sparks": "/console/pokemon-surging-sparks",
  "temporal-forces": "/console/pokemon-temporal-forces",
  "twilight-masquerade": "/console/pokemon-twilight-masquerade",
  "white-flare": "/console/pokemon-white-flare",
};

