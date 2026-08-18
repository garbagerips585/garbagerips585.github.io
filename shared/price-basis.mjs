// TWO PRICE FEEDS PRICE THE SAME CARDS AND THEY DO NOT AGREE. THIS IS WHERE THE
// SITE SAYS SO.
//
// IT USED TO BE A DISAGREEMENT BETWEEN TWO PAGES OF THIS SITE AND IT NO LONGER
// IS. /most-valuable-cards.html ranked by TCGplayer MARKET PRICE until 18
// August 2026, when it moved to PriceCharting's guide like everything else that
// prices a raw card here, so the two pages cannot contradict each other any
// more. What is left is still worth printing and is why this file survived the
// change: a reader who trusts the guide value on /base-set.html and then clicks
// through to buy meets a MARKETPLACE, where the number is different. Explaining
// that on the page they leave from is the whole job.
//
// /base-set.html prices printings from PriceCharting's PRICE GUIDE, out of
// data/top-graded.json. TCGplayer's market price for the same cards is in
// data/top100.json, still written nightly by sync-top100.mjs for the sealed
// list. On the Shadowless Base Set Charizard, read on the same day, they said
// $988 and $10,000. Blastoise said $223 and $1,300.
//
// NEITHER NUMBER IS WRONG. They measure different things:
//
//   MARKET PRICE is TCGplayer's figure for recent completed sales of that
//   product ON TCGplayer. It is one marketplace's own trade, and on a card with
//   33 listings and very few sales it moves a long way on very little.
//
//   A PRICE GUIDE VALUE is PriceCharting's computed figure across the sales it
//   tracks, which is a different and wider set of venues.
//
// AND THAT IS EXACTLY WHY THE PAGE HAS TO ACKNOWLEDGE THE OTHER MEASUREMENT.
// The $988 is inside /base-set.html's FAQPage JSON-LD, where Google can surface
// it as a standalone answer with no page around it to qualify it, and anybody
// checking it against the marketplace the same page links to for buying will
// find a figure ten times larger. A site whose whole claim is that its numbers
// are sourced cannot leave that to be discovered.
//
// DELETING ONE OF THEM WAS NOT AN OPTION AND NEITHER WAS AVERAGING THEM. An
// average of two measurements of different things is a measurement of nothing,
// and it would carry no source at all, which is the one thing this site never
// publishes.
//
// ------------------------------------------------------------------ THE PAIRS
//
// NAMED EXACTLY, ON BOTH SIDES, AND NEVER MATCHED BY NAME. The TCGplayer side is
// keyed on `productId`, which is that marketplace's own stable id for one
// printing of one card. The PriceCharting side is keyed on the exact `set` and
// `name` strings that file publishes, the same discipline priceRow() in
// build-base-set.mjs keeps: "Charizard #4", "Charizard [Shadowless] #4" and
// "Charizard [1st Edition] #4" are three products and a fuzzy match lands on
// whichever came first. data/graded.json already records what name-only lookups
// cost here, 4 of 12 landing on a different printing of the right card.
//
// A PAIR WITH ONLY ONE SIDE IS KEPT AND SAYS SO. Venusaur is the case: TCGplayer
// prices the Shadowless printing and data/top-graded.json does not hold it at
// all, because that file is ranked by PSA 10 value with a floor at rank 400.
// Printing "and PriceCharting says nothing" is the honest half of the same
// point, and dropping the row would quietly make the disagreement look tidier
// than it is.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gradedGate } from "./graded-gate.mjs";
import { longDate } from "./format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const CROSS_PRICED = [
  {
    card: "Charizard",
    printing: "Base Set (Shadowless)",
    number: "4/102",
    tcgProductId: 106999,
    pc: { set: "Base Set", name: "Charizard [Shadowless] #4" },
  },
  {
    card: "Blastoise",
    printing: "Base Set (Shadowless)",
    number: "2/102",
    tcgProductId: 106997,
    pc: { set: "Base Set", name: "Blastoise [Shadowless] #2" },
  },
  {
    card: "Venusaur",
    printing: "Base Set (Shadowless)",
    number: "15/102",
    tcgProductId: 107010,
    pc: { set: "Base Set", name: "Venusaur [Shadowless] #15" },
  },
];

/**
 * Resolve every pair against both files.
 *
 * Returns { pairs, tcgRead, pcRead, both, tcgOnly }. A pair carries `market`
 * (TCGplayer, always present or the build stops) and `guide` (PriceCharting, or
 * null with `guideWhy` saying which file does not hold it).
 *
 * THE TCG SIDE THROWS AND THE PC SIDE DOES NOT, and the asymmetry is deliberate.
 * A productId that stops resolving means the top-100 crawl no longer holds a
 * card this comparison is written about, and the comparison would silently lose
 * a row. A missing PriceCharting row is an expected outcome of a ranked file
 * with a floor, and it is printed rather than hidden.
 */
export async function loadPriceBasis() {
  const t100 = JSON.parse(await readFile(join(ROOT, "data/top100.json"), "utf8"));
  const tg = JSON.parse(await readFile(join(ROOT, "data/top-graded.json"), "utf8"));
  const { verified } = gradedGate(tg);

  const byProduct = new Map((t100.cards?.items || []).map((x) => [x.productId, x]));

  const pairs = CROSS_PRICED.map((p) => {
    const m = byProduct.get(p.tcgProductId);
    if (!m || typeof m.market !== "number") {
      throw new Error(
        `shared/price-basis.mjs: TCGplayer product ${p.tcgProductId} (${p.card}, ${p.printing})\n` +
          `  is not in data/top100.json's card list with a market price. This module exists so that\n` +
          `  /most-valuable-cards.html and /base-set.html explain why they print different figures\n` +
          `  for the same card, and a pair that quietly stops resolving takes one of those\n` +
          `  explanations off a page while the other number stays on the other page. Re-run\n` +
          `  scripts/sync-top100.mjs, or take the pair out of CROSS_PRICED and say why here.`
      );
    }
    const row = (tg.cards || []).find((x) => x.set === p.pc.set && x.name === p.pc.name);
    let guide = null;
    let guideWhy = "";
    if (!row) {
      guideWhy = `data/top-graded.json does not hold ${p.pc.name}`;
    } else if (verified.get(row.rank)?.status !== "agree") {
      guideWhy = `${p.pc.name} was not double-read, so no figure of ours is publishable for it`;
    } else if (typeof row.ungraded !== "number") {
      guideWhy = `${p.pc.name} carries no ungraded value`;
    } else {
      guide = row.ungraded;
    }
    return {
      ...p,
      market: m.market,
      low: m.low,
      listings: m.listings,
      rank: m.rank,
      guide,
      guideWhy,
      // The ratio only means anything where both sides exist.
      ratio: guide ? m.market / guide : null,
    };
  });

  return {
    pairs,
    both: pairs.filter((p) => p.guide !== null),
    tcgOnly: pairs.filter((p) => p.guide === null),
    tcgRead: longDate(t100.cards?.checked || t100.checked),
    pcRead: longDate(tg.checked),
  };
}

/**
 * The paragraph /base-set.html prints, in the words that page already uses for
 * its own sourcing.
 *
 * THERE USED TO BE TWO VOICES, "market" and "guide", because two pages printed
 * this from opposite sides. The market voice was deleted on 18 August 2026 when
 * /most-valuable-cards.html moved onto the guide: a branch no page calls is a
 * branch nobody maintains, and the next person would have had to work out which
 * of the two the site actually used. The facts are unchanged and still come out
 * of the same resolved pairs.
 */
export function basisSentence(basis) {
  const lead = basis.both[0];
  if (!lead) return "";
  const money = (n) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const others = basis.both.slice(1);
  const alsoList = others.length
    ? ` The same split runs through ${others
        .map((p) => `${p.card} (${money(p.market)} against ${money(p.guide)})`)
        .join(" and ")}.`
    : "";
  const gap = basis.tcgOnly.length
    ? ` ${basis.tcgOnly
        .map((p) => `${p.card}'s Shadowless printing has a market price and no guide value at all`)
        .join(", ")}, because the guide file is ranked by PSA 10 value and stops before it.`
    : "";

  return (
    `A marketplace will tell you something different, and both figures are real. ` +
    `TCGplayer's market price for the same ungraded ${lead.card}, read ${basis.tcgRead}, is ` +
    `${money(lead.market)} against the ${money(lead.guide)} guide value here.${alsoList}` +
    `${gap} A guide value is computed across the sales PriceCharting tracks; Market Price is what ` +
    `recently sold on one marketplace, and on a card that trades a handful of times a year the two ` +
    `can sit a long way apart. Neither is the other's correction.`
  );
}
