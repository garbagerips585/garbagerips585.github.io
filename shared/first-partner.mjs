// THE FIRST PARTNER PROMOS, JOINED TO THE RIP LOG.
//
// /first-partner-illustration-collection.html has published all 27 of these
// cards with a picture, a number and two prices on each since 19 August 2026.
// data/hits.json records that the owner pulled three of them, twice, and joined them
// to NOTHING: those rows carry a `printing` string, no `set`, no `number` and
// no price, and nothing in the build ever read `printing` as a key. So six rows
// across two rip pages printed "No market price" for cards this site was
// publishing a price for on another page, and they were 6 of only 7 such rows
// in the whole built tree.
//
// THE KEY IS `printing`, NOT `card`, AND THAT IS THE PART THAT IS EASY TO GET
// WRONG. The owner writes one spreadsheet cell reading "First Partner Illustration
// Collection (Series 1) Alola Region Promo : Rowlet, Litten, Popplio".
// scripts/import-sheet.mjs splits it: the card is called "Rowlet" and the
// product name is kept in `printing`. build-first-partner.mjs's own comment
// records what happened when an earlier importer glued the two together
// instead, which was three card names no catalogue has ever held.
//
// A NAME ALONE IS NOT ENOUGH TO MATCH ON, and this is the whole reason
// `namesProduct` is a separate gate rather than an implementation detail.
// "Rowlet" appears in several sets and PriceCharting files every English promo
// in ONE console with no set code, so SVP collides with MEP on four of these
// numbers (see the header of scripts/sync-first-partner.mjs). A bare "Rowlet"
// on some other rip is a different card, and pricing it off this file would put
// one promo's money on another promo's row. So a hit only resolves here when
// the row ITSELF names the product.
//
// NEVER PUBLISH A FIGURE WHOSE STATUS IS NOT 'agree'. That is data/first-
// partner.json's own instruction and it is enforced here rather than trusted:
// every price in that file was read twice through two different parsers, and a
// column only carries a `value` when the two reads agree within 15%. Both
// readings stay on the record so a refusal is visible rather than blank.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The product's own name, as it is printed on a row that has no set. */
export const FP_PRODUCT = "First Partner Illustration Collection";

// Both fields are read: `card` so an older data file still matches, `printing`
// because that is where the product name lives today. Same pair
// build-first-partner.mjs's timsPulls() reads, and it is the same regex now
// rather than a second one that can drift away from it.
const said = (h) => `${String(h?.card || "")} ${String(h?.printing || "")}`;

/** Does this hit row name the First Partner Illustration Collection at all? */
export function namesProduct(h) {
  return /first partner illustration collection/i.test(said(h));
}

/** A price column only counts when its two independent reads agreed. */
const agreed = (col) =>
  col && col.status === "agree" && typeof col.value === "number" ? col.value : null;

export async function loadFirstPartner() {
  let doc = null;
  try {
    doc = JSON.parse(await readFile(join(ROOT, "data/first-partner.json"), "utf8"));
  } catch {
    /* optional: every lookup returns null and the rows render as they did */
  }
  const cards = doc?.cards || [];
  const byName = new Map(cards.map((c) => [String(c.name).toLowerCase(), c]));

  /**
   * The card record one hit row resolves to, or null.
   *
   * ONE NAME PER ROW. The importer writes one card per row today, so a row
   * naming two of these is a row this cannot honestly resolve and it returns
   * null rather than guessing which one was meant. build-first-partner.mjs
   * deliberately does the opposite on its own band, collecting EVERY name a
   * row mentions, because that band is answering "which of these did that video
   * show" and an old glued cell is still good evidence there. Pricing a single
   * row is a different question and takes the stricter rule.
   */
  function cardForHit(h) {
    if (!namesProduct(h)) return null;
    const name = String(h?.card || "").trim().toLowerCase();
    if (!name) return null;
    const card = byName.get(name);
    if (!card) return null;
    if (h?.number && String(h.number) !== String(card.number)) return null;
    return card;
  }

  /**
   * What a rip page or a hall plaque needs about one of these pulls, or null.
   *
   * The DATE and the SOURCE are the file's own, not the card's, because
   * data/first-partner.json is one hand-run crawl stamped at the top level.
   * They travel with the figures for the reason shared/card-prices.mjs exists:
   * a page that prints a number prints where it came from and when it was read.
   */
  function priceForHit(h) {
    const card = cardForHit(h);
    if (!card) return null;
    const raw = agreed(card.pc?.cols?.raw);
    const psa10 = agreed(card.pc?.cols?.psa10);
    return {
      card,
      number: card.number,
      setName: FP_PRODUCT,
      price: raw,
      psa10,
      url: card.pc?.url || null,
      // "pricecharting.com", NOT data/first-partner.json's "PriceCharting".
      // The same company, spelled two ways, and a hall plaque priced from this
      // file sits beside plaques priced from data/graded.json in one sentence:
      // /hall.html's credit line came out reading "PSA 10 FROM PRICECHARTING.COM
      // AND POKEMONPRICETRACKER.COM AND PRICECHARTING", which reads as three
      // feeds. The domain form is what every other price source on this site
      // records, so it is the one that survives here. The First Partner page
      // itself still prints the file's own wording, because it reads the file
      // directly and nothing on that page sits beside another feed.
      source: /^pricecharting$/i.test(String(doc?.priceSource || "").trim())
        ? "pricecharting.com"
        : doc?.priceSource || null,
      asOf: doc?.checked || null,
      img: card.img || null,
      imgLarge: card.imgLarge || card.img || null,
    };
  }

  return { doc, cards, cardForHit, priceForHit };
}
