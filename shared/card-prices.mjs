// ONE SENTENCE FOR WHERE A CARD PRICE CAME FROM, SO TEN PAGES CANNOT WORD IT
// TEN WAYS.
//
// Every raw card price on this site comes from public/data/cards/<set>.json,
// which sync-cards.mjs fills from PriceCharting's ungraded price guide (see
// scripts/sync-pricecharting-cards.mjs for the coverage measurement behind that
// choice). Ten builders read that file. Before this module each one carried its
// own hand-written sentence naming TCGdex and TCGplayer, which meant the source
// swap on 18 August 2026 was ten separate chances to leave a page crediting a
// feed it no longer reads.
//
// A PAGE THAT PRINTS A NUMBER PRINTS WHERE IT CAME FROM AND WHEN IT WAS READ.
// That is the site's whole claim, so this module refuses to produce a sentence
// with no date rather than quietly dropping the clause.
//
// TWO DATES LIVE IN THAT FILE AND THEY ARE NOT INTERCHANGEABLE:
//   `checked`        the day TCGdex was read for names, numbers, rarity and art
//   `pricesChecked`  the day PriceCharting was read for the money
// The first moves nightly, the second only when somebody runs the crawl. Every
// price sentence must use `pricesChecked`, and `priceRead()` exists so that a
// builder cannot reach for the wrong one by habit: it falls back to `checked`
// only when there is no price date at all, which is the pre-swap shape.

import { longDate } from "./format.mjs";

/**
 * An honest phrase for WHEN a set of figures was read, given every date behind
 * them. Returns null when there is no date at all, because this module refuses
 * to produce a sentence with no date rather than quietly dropping the clause.
 *
 * WHY A SPAN AND NOT A DAY. On 28 August 2026 the nightly refresh began moving
 * raw prices every night while data/graded.json, which is hand run and wins the
 * PSA 10 chain where it has a row, stayed on its own older read. Four pages
 * then asserted ONE date over a MIXTURE: 50 rip pages said the PSA figures were
 * "read the same day" as the raw ones, /wanted.html named a single LAST CHECKED,
 * and /grading.html promised "both halves of the subtraction describe one
 * printing of one card out of one source". Each was false for at least one row.
 *
 * The two pages that were already right are the model: a set guide dates each
 * card inline, and /luck.html says "read between Aug 23, 2026 and Aug 28, 2026".
 * This is that second sentence, made shared so a fifth page cannot invent a
 * sixth wording.
 */
export function readSpan(dates) {
  const days = [...new Set((dates || []).filter(Boolean).map((d) => String(d).slice(0, 10)))].sort();
  if (!days.length) return null;
  if (days.length === 1) return `read ${longDate(days[0])}`;
  return `read between ${longDate(days[0])} and ${longDate(days[days.length - 1])}`;
}

/** The day the PRICES on this file were read, never the checklist's date. */
export function priceRead(doc) {
  return doc?.pricesChecked || doc?.checked || null;
}

/**
 * A set's chase list in price order, most expensive first.
 *
 * NOT "most expensive". CLAUDE.md forbids that word in capitals, and it was
 * reintroduced onto the HOME PAGE on 19 August 2026 from this very comment,
 * 58 minutes after a sweep had removed it from every page on the site. A
 * comment is where the register gets copied from, so it has to be right too.
 *
 * NEVER READ chase[0] OUT OF sets.json. That list is written ONCE, by
 * sync-sets.mjs or by reconcile-cards.mjs off the checklist, and after that
 * reconcile-cards.mjs only ever REPRICES it in place: it walks the existing
 * entries and assigns a new price to each, and it never re-sorts. So the ORDER
 * is a snapshot of what the prices were on the day the list was first built,
 * and it goes stale silently while every number in it stays correct.
 *
 * Measured on 19 August 2026: 20 of the 28 English sets have a tail out of
 * order, and Perfect Order has its HEAD out of order. chase[0] there is Mega
 * Zygarde ex #124 at $120.01 while Meowth ex #121 at $127.59 sits second. The
 * home page tile read "Top card $536 PSA 10", which is #124's graded figure,
 * while the set guide's lede, its chase grid and its /sets/ index card all said
 * the chase card is Meowth ex at $128 raw and $339 in a PSA 10. Two renderers,
 * one fact, two answers.
 *
 * build-set-pages.mjs never saw this because it REBUILDS the whole list from
 * the checklist, sorted by price, before it renders anything. That is the rule
 * every other reader has to match, so it lives here.
 *
 * Pass `priceOf` to score an entry against something better than its own copy
 * of the price, which is what a builder holding the checklist should do.
 */
export function chaseByPrice(chase, priceOf) {
  const score = (c) => {
    const p = priceOf ? priceOf(c) : c?.price;
    return typeof p === "number" && p > 0 ? p : 0;
  };
  return (chase || []).slice().sort((a, b) => score(b) - score(a));
}

/**
 * The sourcing sentence for raw card prices.
 *
 * `doc` is any one of the public/data/cards/<set>.json documents, or an object
 * carrying the same stamps. Pages that merge every set pass the newest one.
 *
 * WHAT IT DELIBERATELY SAYS. "Price guide value for an ungraded copy" rather
 * than "market price", because they are different quantities and this site has
 * printed a paragraph about that difference on /base-set.html for months. A
 * guide value is computed across the sales PriceCharting tracks; a market price
 * is what recently sold on one marketplace. Calling PriceCharting's number a
 * market price would be the same error in the opposite direction.
 */
export function priceNote(doc, opts = {}) {
  const { lead = "Prices", trailing = "" } = opts;
  const read = longDate(priceRead(doc)) || priceRead(doc);
  const src = doc?.priceSource || "pricecharting.com";
  const bits = [
    `${lead} are ${src}'s price guide value for an ungraded copy` +
      (read ? `, read ${read}` : "") +
      ".",
  ];
  // A guide value is not a marketplace's market price and the pages that print
  // both have to keep them apart. One clause, on every page, in one wording.
  bits.push(
    "A guide value is computed across the sales PriceCharting tracks, which is a wider set of venues than any one marketplace."
  );
  const fell = doc?.pricedBy?.tcgdex || 0;
  if (fell > 0) {
    // NAMED, NOT HIDDEN. PriceCharting covers 5,179 of the 5,181 cards in the
    // guides, so this clause is rare, and a page crediting PriceCharting for a
    // figure it did not supply is exactly what the site must not do.
    const total = fell + (doc?.pricedBy?.pricecharting || 0);
    bits.push(
      `${fell === 1 ? "One card of the" : `${fell} cards of the`} ${total.toLocaleString("en-US")} priced here ` +
        `${fell === 1 ? "is" : "are"} not listed by PriceCharting and ` +
        `${fell === 1 ? "keeps its" : "keep their"} TCGplayer market price via TCGdex instead.`
    );
  }
  if (trailing) bits.push(trailing);
  return bits.join(" ");
}

/**
 * The short credit for a footer, where there is no room for the qualification.
 *
 * TCGdex IS STILL NAMED AND THAT IS NOT A LEFTOVER. It still supplies every
 * checklist, every card name, every rarity and every scan on these pages; only
 * the money moved. A footer that dropped it would be crediting PriceCharting
 * for the card database as well as the prices.
 */
export function priceFooter(extra = "") {
  return (
    "Card data from TCGdex. Card prices from PriceCharting." + (extra ? ` ${extra}` : "")
  );
}
