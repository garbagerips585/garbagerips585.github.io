// THE ONE PLACE THAT ANSWERS "WHICH DATED SHOP LISTINGS DOES THIS SITE HOLD?"
//
// Three pages make a claim about that set and until 17 August 2026 all three
// counted it themselves:
//
//   /msrp.html        printed 4 and said, in those words, that they were "every
//                     dated, sourced shop listing this site holds". It read only
//                     data/pack-counts-current.json.
//   /retailers.html   printed 13. It read both files.
//   /what-to-buy.html printed a range across 13. It read both files, in a third
//                     copy of the same join.
//
// The 4 was FALSE and it was false in the one way this site cannot afford,
// because the sentence around it was a completeness claim. Nothing errored: each
// builder derived its own count honestly from whatever it had opened, and the
// three answers were only comparable to a reader holding two pages at once.
//
// So the merge lives here now and the three pages import it. A page may still
// choose to print a SUBSET, but it can no longer be unaware of the rest, and any
// page that says "every" has one array to say it about.
//
// -------------------------------------------------------------- IT THROWS
//
// Both files already threw rather than warned on a bad join, and this keeps
// that, with one change of policy that is the whole point of the module: a
// listing that cannot be resolved is a HARD FAILURE rather than a silent skip.
// build-retailers.mjs used to `continue` past a pack-counts listing whose shop
// was not in the directory, and build-what-to-buy.mjs used to return null for
// one with no suggested figure. Both are reasonable on their own and together
// they are how two pages end up counting the same set differently. There is no
// correct page to ship while one of these does not resolve, so the build stops
// and says which row and which file.
//
// ------------------------------------------------------------ WHAT A ROW IS
//
// A ROW IS ONE LISTING, OF ONE PRODUCT, ON ONE DAY, AT ONE ADDRESS. It is not a
// statement about the company, it is not an average and it is not current. Both
// source files say so in their own _readme and every page that prints one has to
// say it too. Nothing here sorts by the multiple: that is argued in
// data/over-msrp.json's _readme and again in both builders, and a helper that
// handed back a league table would undo all of it.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { longDate } from "./format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const COUNTS_FILE = "data/pack-counts-current.json";
const PRICES_FILE = "data/retailer-prices.json";

// `seller` is mandatory and has exactly two legal values. The argument is in
// data/retailer-prices.json's _readme: on Target, Walmart, Best Buy and Amazon a
// price on the site may be the chain's or an independent reseller's, and the two
// are different claims about different parties.
const SELLERS = new Set(["first-party", "marketplace"]);

const readJson = async (rel) => JSON.parse(await readFile(join(ROOT, rel), "utf8"));

/**
 * Every dated, sourced shop listing this repo holds, as one shape.
 *
 * Returns { listings, files, readDates, shops }. `listings` is ordered by
 * retailer name then by what the product costs, which is deliberately NOT by the
 * multiple; a caller that wants a different order sorts a copy.
 */
export async function loadListings() {
  const counts = await readJson(COUNTS_FILE);
  const prices = await readJson(PRICES_FILE);
  const msrp = await readJson("data/msrp.json");
  const R = await readJson("data/retailers.json");

  const retailers = R.retailers || [];
  const byId = new Map(retailers.map((r) => [r.id, r]));
  const byName = new Map(retailers.map((r) => [r.name, r]));

  // THE SUGGESTED FIGURE IS NEVER TYPED INTO EITHER DATA FILE. A reading names a
  // row in data/msrp.json by its exact label and this resolves it, the same way
  // resolvePC in build-msrp.mjs resolves a Pokemon Center reading by exact
  // product name. A join that misses, or lands on the wrong row, prints a
  // plausible multiple for the wrong pair of objects and looks completely fine.
  const byLabel = new Map();
  for (const row of msrp.products || []) {
    if (!byLabel.has(row.label)) byLabel.set(row.label, []);
    byLabel.get(row.label).push(row);
  }

  function suggested(label, who) {
    const rows = byLabel.get(label);
    if (!rows) {
      throw new Error(
        `shared/listings.mjs: ${who} names the suggested-price row ${JSON.stringify(label)} and\n` +
          `  data/msrp.json has no product with that exact label. Do NOT fix this by typing a\n` +
          `  figure in: name a row that exists, or drop the reading.`
      );
    }
    if (rows.length > 1) {
      throw new Error(
        `shared/listings.mjs: ${who} names ${JSON.stringify(label)} and data/msrp.json holds ` +
          `${rows.length}\n  rows with that label, so the name does not identify one figure. Name a different row.`
      );
    }
    const row = rows[0];
    if (typeof row.price !== "number") {
      throw new Error(
        `shared/listings.mjs: ${who} divides by ${JSON.stringify(label)} and that row in\n` +
          `  data/msrp.json carries no price, because the bar for printing one was not cleared. A\n` +
          `  comparison against a figure this site refuses to state is not a comparison. Drop the reading.`
      );
    }
    return row;
  }

  const listings = [];

  // ---- the readings gathered on retailers' own product pages -----------------
  for (const x of prices.readings || []) {
    const who = `${PRICES_FILE} reading "${x.product}"`;
    if (!SELLERS.has(x.seller)) {
      throw new Error(
        `shared/listings.mjs: ${who} has seller ${JSON.stringify(x.seller || null)}. It must be\n` +
          `  "first-party" or "marketplace". A price with no seller on it is a claim about\n` +
          `  whichever company owns the website, and on Target, Walmart, Best Buy and Amazon\n` +
          `  that company is very often not the seller. Establish it or delete the reading.`
      );
    }
    const r = byId.get(x.retailer);
    if (!r) {
      throw new Error(
        `shared/listings.mjs: ${who} is filed under retailer id ${JSON.stringify(x.retailer)} and\n` +
          `  data/retailers.json has: ${retailers.map((v) => v.id).join(", ")}.`
      );
    }
    const row = suggested(x.msrpLabel, who);
    listings.push({
      source: PRICES_FILE,
      retailer: r,
      retailerId: r.id,
      retailerName: r.name,
      product: x.product,
      amount: x.amount,
      base: row.price,
      baseLabel: row.label,
      seller: x.seller,
      sellerHow: x.sellerHow || "",
      on: x.on || "",
      url: x.url || "",
      read: x.read,
    });
  }

  // ---- the listings pack-counts already carried ------------------------------
  //
  // Read OUT OF data/pack-counts-current.json rather than copied into the other
  // file, so each of those figures is still stated in exactly one place in this
  // repo. ONLY `kind: "retailer listed price"` qualifies: that file also holds
  // Pokemon Center store prices, and those are the MSRP benchmark rather than an
  // example of a shop charging over one. Printing one here would have /msrp.html
  // comparing a number against itself.
  for (const p of counts.products || []) {
    const price = p.price;
    if (!price || price.isMsrp || price.kind !== "retailer listed price") continue;
    if (typeof price.amount !== "number") continue;
    const name = price.retailer || "";
    const who = `${COUNTS_FILE} listing "${price.product || p.productName}"`;
    const r = byName.get(name);
    if (!r) {
      throw new Error(
        `shared/listings.mjs: ${who} is at ${JSON.stringify(name)} and data/retailers.json holds\n` +
          `  no shop with that exact name. This used to be a silent skip in build-retailers.mjs, and a\n` +
          `  silent skip is how /msrp.html and /retailers.html came to publish different counts of the\n` +
          `  same set. Add the shop to the directory, or take the price off the pack-counts row.`
      );
    }
    const how = (R.legacySellers || {})[name];
    if (!how) {
      throw new Error(
        `shared/listings.mjs: ${who} is at ${JSON.stringify(name)} and data/retailers.json's\n` +
          `  legacySellers has no attribution for it. Nothing here may print a price without saying\n` +
          `  who was selling. Add the entry, with what on the page establishes it.`
      );
    }
    // The row this divides by is joined on the pack-counts product NAME, which is
    // what msrp.json's `packsFrom` points at, rather than on a label.
    const row = (msrp.products || []).find(
      (x) => x.packsFrom === p.productName && typeof x.price === "number"
    );
    if (!row) {
      throw new Error(
        `shared/listings.mjs: ${who} has no row in data/msrp.json whose packsFrom is\n` +
          `  ${JSON.stringify(p.productName)} and which carries a price, so there is nothing to divide\n` +
          `  it by. Point a priced row at that product, or drop the price from the pack-counts row.`
      );
    }
    // The url and the date come off the SOURCE that supports the price, not off
    // the record's own readAt: these records carry several sources and only one
    // of them is the page that saw a price.
    const s = (p.sources || []).find((x) => (x.supports || []).includes("price"));
    listings.push({
      source: COUNTS_FILE,
      retailer: r,
      retailerId: r.id,
      retailerName: r.name,
      product: price.product || p.productName,
      amount: price.amount,
      base: row.price,
      baseLabel: row.label,
      seller: "first-party",
      sellerHow: how,
      on: "the product page",
      url: s ? s.url : "",
      read: s ? s.readAt : counts.readAt,
    });
  }

  for (const l of listings) l.mult = l.amount / l.base;

  // ORDERED BY RETAILER NAME, THEN BY WHAT THE PRODUCT COSTS. Never by the
  // multiple. Sorting by the multiple builds a league table out of a handful of
  // readings and puts the worst number at the top.
  listings.sort(
    (a, b) => a.retailerName.localeCompare(b.retailerName) || a.base - b.base || a.amount - b.amount
  );

  return {
    listings,
    files: [COUNTS_FILE, PRICES_FILE],
    readDates: [...new Set(listings.map((l) => l.read))].sort(),
    shops: new Set(listings.map((l) => l.retailerId)).size,
  };
}

/**
 * A multiple printed the way /msrp.html prints one: two decimals with trailing
 * zeros trimmed, so 2.00 reads 2 and 1.20 reads 1.2. Shared so the pages that
 * divide the same listing by the same figure cannot disagree by a rounding.
 */
export const multStr = (n) => n.toFixed(2).replace(/\.?0+$/, "");

/**
 * "August 15, 2026", or "August 15 to August 17, 2026" when a group of listings
 * was not all read on one day.
 *
 * THIS EXISTS BECAUSE ONE `rs[0].read` PRINTED THREE DATES WRONG. /retailers.html
 * summarised each shop with the read date of the FIRST row in the group, after
 * sorting that group by price. GameStop is the only shop here with listings from
 * both source files, so it is the only shop whose rows carry two different dates,
 * and it summarised 5 listings as "read August 15, 2026" directly above a table
 * dating three of them August 17. The same sentence is inside that page's FAQ
 * JSON-LD, where Google can quote it with no table beside it to contradict it.
 *
 * A read date is the thing that makes a price checkable, so a group either states
 * the range or the caller prints each row's own date. Nothing may state one date
 * for a group that does not have one.
 */
export function readDatePhrase(dates) {
  const uniq = [...new Set((dates || []).filter(Boolean))].sort();
  if (!uniq.length) return "";
  if (uniq.length === 1) return longDate(uniq[0]);
  const first = longDate(uniq[0]);
  const last = longDate(uniq[uniq.length - 1]);
  // "August 15 to August 17, 2026" rather than repeating the year on both ends.
  const y = first.match(/,\s*(\d{4})$/);
  const y2 = last.match(/,\s*(\d{4})$/);
  if (y && y2 && y[1] === y2[1]) return `${first.replace(/,\s*\d{4}$/, "")} to ${last}`;
  return `${first} to ${last}`;
}
