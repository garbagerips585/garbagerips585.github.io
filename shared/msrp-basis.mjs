// WHAT AN MSRP IS ON THIS SITE, AND WHY THAT SENTENCE LIVES IN ONE FILE NOW.
//
// Two pages sitting next to each other in the Prices nav contradicted each
// other flatly, and a QA sweep of the live site found it on 18 August 2026:
//
//   /msrp.html            h1 "Pokemon sealed MSRP: what it should cost", 26 rows
//                         reading "$59.99 MSRP, Pokemon's own shop", and a
//                         standfirst saying Pokemon Center's price IS the MSRP.
//   /how-many-packs.html  "There is no manufacturer price. The Pokemon Company
//                         does not publish an MSRP, so every price on this page
//                         is one shop's or one retailer's price on one day.
//                         Anybody quoting you 'the MSRP' is quoting a shelf
//                         price."
//
// /msrp.html is right. data/msrp.json's own _readme has recorded the correction
// since 17 August 2026 and the page was rewritten off it; /how-many-packs.html
// was not, and carried the retired over-hedge for a day with a link between the
// two pages in both directions.
//
// TIM SETTLED IT IN AS MANY WORDS, and this file exists so nobody has to
// reconstruct it from two pages again:
//
//   "yeah I just take PokemonCenter.com prices as MSRP as that is what they sell
//    it for, and then retailers are then able to sell it for whatever they want,
//    so store prices are usually slightly higher than MSRP but some are much
//    higher than MSRP so you just have to know otherwise you over pay for
//    products very easy, people do it daily not even knowing what price they
//    should be paying"
//
// That is a FOUR PART MODEL and a page that keeps three of the four parts is
// still wrong. `MSRP_FACTS` below is the four parts, in order, as short
// statements rather than as a paragraph.
//
// -------------------------------------------------- FACTS SHARED, PROSE NOT
//
// This module deliberately exports FACTS AND NUMBERS, not a finished paragraph,
// and that was a judgement rather than an oversight. Five pages touch this idea
// (/msrp.html, /how-many-packs.html, /pack-prices.html, /retailers.html,
// /what-to-buy.html) and they are aimed at five different readers: one is a
// reference table, one is answering "how many packs", one is a gift guide. The
// same three sentences pasted into all five would read as boilerplate by the
// third one, and the site's own house style is that every page argues in its own
// voice. What must NOT differ between them is the claim, so the claim is here
// and the phrasing is theirs.
//
// The precedent is shared/price-basis.mjs and shared/graded-gate.mjs, which do
// the same thing for the two-price-feeds problem and the read-it-twice rule.
//
// -------------------------------------------------- NO INVENTED THRESHOLD
//
// The useful thing to tell a parent in an aisle is where "a bit over" becomes
// "walk away", and the tempting thing is to write "more than 20% over is a bad
// deal". THAT NUMBER DOES NOT EXIST and this site does not publish numbers it
// cannot trace. Two real figures do exist and both are already on the site:
//
//   THE MEASURED ONE. `spread()` below reads every dated shop listing this repo
//   holds through shared/listings.mjs and divides each by the suggested price for
//   the same product. It is a real distribution with real sources, and it is
//   SMALL: 13 listings on 18 August 2026. Print the n with it, always. It is a
//   description of what has actually been written down, not an estimate of what
//   American retail does, and a page that implies the second is lying with true
//   numbers.
//
//   THE STATED ONE. data/over-msrp.json's `bands` are this site's rule of thumb,
//   labelled as a judgement on /msrp.html in those words, and /what-to-buy.html
//   already prints "walk away" at the 2x edge and reads that 2 out of the same
//   file. Quoting a band is quoting a stated opinion, which is honest as long as
//   the page says that is what it is.
//
// Anything else describes the SHAPE without a number: usually a little over,
// occasionally a lot over, and the only defence is knowing the suggested price
// before you are standing in front of the shelf.
//
// -------------------------------------------------- SAY WHO IS SELLING
//
// Walmart.com and Target.com list third-party marketplace sellers alongside
// their own stock, and those listings run far above MSRP once the retailer's own
// stock sells out. A marketplace listing attributed to the retailer is a false
// statement about a named company. shared/listings.mjs already enforces this:
// every listing carries `seller` ("first-party" or "marketplace") and `sellerHow`
// saying what on the page established it, and it THROWS rather than guessing.
// All 13 listings held today are first-party. If that ever stops being true, the
// page copy has to name the seller, not the shop.

import { loadListings, multStr } from "./listings.mjs";

/**
 * Tim's four part model, in his order. Short claims, not prose: a page states
 * them in its own words and this is the checklist for whether it has.
 *
 * A PAGE MAY GO SHORTER THAN FOUR, and dropping one is a decision rather than an
 * edit. Dropping (1) is what /how-many-packs.html did and it produced the
 * contradiction this file exists for. Dropping (4) is worse in a different way:
 * it is the only part that helps anybody, and it is the reason Tim gives for the
 * site existing at all ("parents trying to figure out what to buy their kids and
 * how much it should cost is a nightmare, i end up helping people in stores all
 * the time").
 */
export const MSRP_FACTS = [
  {
    id: "exists",
    claim: "Pokemon Center's price IS the MSRP, because that is the manufacturer's own shop selling its own product.",
    why: "There is no separate document titled MSRP and two research passes confirmed that, which is a true finding that got written up as something much bigger. The number exists. It is on Pokemon's own shop.",
  },
  {
    id: "free",
    claim: "A retailer can charge whatever it likes, and that is how retail works rather than a scandal.",
    why: "A suggested price is a suggestion. No law makes a shop honour it. A page that reads as an accusation is wrong about the mechanism and will be ignored.",
  },
  {
    id: "usually",
    claim: "Shop prices are usually slightly above the suggested one.",
    why: "The normal case, and worth saying, because a reader who treats any markup as a rip-off will be wrong most of the time and stop trusting the page.",
  },
  {
    id: "sometimes",
    claim: "Some are far above it, and the only defence is knowing the suggested price before you are standing in the shop.",
    why: "This is the part that helps. People overpay daily without knowing what the number should have been.",
  },
];

/**
 * What this site's own dated shop listings actually came to, against the
 * suggested price for the same product.
 *
 * EVERY FIELD IS COUNTED, NOTHING IS TYPED, and `n` is returned so no caller can
 * print the distribution without printing how thin it is. Sorted copies only:
 * shared/listings.mjs argues at length that its own order must never be the
 * multiple, because sorting shops by markup builds a league table out of a
 * handful of afternoons.
 */
export async function spread() {
  const { listings } = await loadListings();
  const xs = listings.map((l) => l.mult).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
  return {
    n: xs.length,
    shops: new Set(listings.map((l) => l.retailerName)).size,
    median: mid,
    medianStr: multStr(mid),
    lowStr: multStr(xs[0]),
    highStr: multStr(xs.at(-1)),
    atOrUnder: xs.filter((x) => x <= 1.0001).length,
    under: (edge) => xs.filter((x) => x < edge).length,
    atOrOver: (edge) => xs.filter((x) => x >= edge).length,
    // Nothing here may print a shop price without saying who was selling. If
    // this ever comes back non-empty, the copy names the seller, not the shop.
    marketplace: listings.filter((l) => l.seller !== "first-party").length,
  };
}
