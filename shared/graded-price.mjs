// ONE PSA 10 FIGURE PER CARD, ACROSS EVERY PAGE THAT PRINTS ONE.
//
// This module exists because the site published two different PSA 10 prices for
// the same printing on 54 pages at once, which is the exact failure
// build-hall.mjs's own header says cannot happen ("one card can never show two
// different numbers on two different pages").
//
// WHAT WENT WRONG, and it is worth stating precisely because the fix is not
// obvious from either side of it. On 18 August 2026 the owner said "lets use
// pricecharting as the main numbers for the entire site", and build-hall.mjs
// was moved onto data/graded.json for its graded column that day. Nothing else
// was. Five builders held their own private copy of a `gradedPrice(setId,
// number)` helper that reads data/psa10.json and NOTHING ELSE, so:
//
//      Mega Greninja ex, Chaos Rising #122
//        /hall.html and /grading.html   $906   graded.json, PriceCharting
//        53 rip pages + /sets/chaos-rising.html  $838   psa10.json `auto`,
//                                                        pokemonpricetracker.com
//
// A COPIED LOOKUP IS THE BUG, NOT THE PRECEDENCE. Five copies of the chain were
// survivable while all five read one file. The moment a second source went in
// front of it in ONE copy, the five copies had to agree about a rule that only
// one of them had been told, and that is not a thing five copies can do. So the
// chain lives here and every renderer calls it, which is the same argument
// shared/graded-gate.mjs and shared/decks.mjs make about their own shared half.
//
// ---------------------------------------------------------------------------
// THE PRECEDENCE, AND WHY IT IS IN THIS ORDER.
//
//   1. data/psa10.json `prices`   A HUMAN TYPED IT. It is a deliberate override
//                                 of whatever any feed says, entered through
//                                 the spreadsheet, and a sync must never win
//                                 against a number the owner checked himself. It is
//                                 empty today (0 entries), which is exactly why
//                                 it has to be implemented rather than assumed
//                                 away: the day somebody types one, it wins.
//   2. data/graded.json           PRICECHARTING. The owner's instruction of 18 August
//                                 2026, quoted above, and the source of every
//                                 raw price on the site since the same day.
//   3. data/psa10.json `auto`     pokemonpricetracker.com, the automated
//                                 fallback. NOT deleted: PriceCharting's graded
//                                 crawl is deliberately scoped (see below) and
//                                 covers 83 cards, so this is what stands
//                                 behind the several hundred it does not reach.
//                                 A stamped fallback figure beats a dash.
//
// TIER 2 IS TWO READS OF ONE SOURCE, AND THE NEWER READ WINS. Restated 11
// November 2026 because the list above reads as if data/graded.json always
// answers first, and it has not since 23 September 2026. PriceCharting reaches
// this module twice: data/graded.json (product pages, read by
// sync-pricecharting.mjs, weekly since .github/workflows/weekly-prices.yml) and
// the per-set card files under public/data/cards/ (console listing pages, read
// nightly). For ONE printing held by both:
//
//   - the read with the NEWER date wins. A graded.json row is dated by its own
//     `checked` or `asOf` where it carries one and by the file's `checked`
//     otherwise; a card-file figure is dated by its set file's `pricesChecked`;
//   - A TIE GOES TO data/graded.json, because a product-page read carries every
//     grading company's figure and its printing was checked against `matched`;
//   - a read with NO date never beats a dated one out of its place: an undated
//     card file loses to graded.json, exactly as before the rule existed;
//   - where only one of the two holds the printing, that one answers. That is
//     every promo (no card file) and every card outside the graded sample.
//
// newerRead() below is that comparison and nothing else decides it. The date,
// source and url returned are the winner's own, never the other read's.
//
// The `auto` tier keeps its ten-sale floor. Volcarona came back at 15x its raw
// price off six recorded sales, which is an anecdote and not a market. The
// human tier skips the floor, because if the owner typed it he stands behind it, and
// PriceCharting publishes no sale count for the gate to read.
//
// ---------------------------------------------------------------------------
// THE PRINTING HAS TO AGREE AND IT IS NOT AUTOMATIC. This is the careful half
// and it is lifted from build-hall.mjs unchanged, comment and all, because the
// reason it is careful is a list of real bad matches rather than a worry.
//
// sync-pricecharting.mjs only rejects a wrong number when it was GIVEN one, and
// it was run over data/hits.json, which mostly carries no number. Four records
// came back for a different printing of the right card in the right set: Dawn
// #129 where ours is #118, Mega Gardevoir ex #178 where ours is #159, Mega
// Venusaur ex #177 where ours is #003, Cetitan ex #210 where ours is #065.
// data/graded.json's own readme records the Dawn one as a known bad match and
// says in as many words not to backfill an empty `number` from `matched`.
//
// `matched` carries the product PriceCharting actually landed on, so the number
// is re-checked HERE and a disagreement is DROPPED rather than printed. A dash
// is honest; a secret rare's price against a bulk rare is not. Preserve that.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The ten-sale floor, exported so a builder cannot quietly pick its own. */
export const MIN_SALES = 10;

/* WHICH OF TWO PRICECHARTING READS OF ONE PRINTING IS FRESHER. Pure and
 * exported so the rule can be tested without a tree on disk.
 *
 * Returns true only when `cardFileDay` is a real ISO day strictly after
 * `gradedDay`. Equal days, a missing day or an unreadable day on either side
 * all return false, which leaves data/graded.json answering: ties go to the
 * product-page read, and a figure with no date is never promoted over one that
 * has one. ISO days compare correctly as strings, so no Date is built here and
 * no timezone can move the answer. */
const isoDay = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
export function newerRead(cardFileDay, gradedDay) {
  const a = isoDay(cardFileDay);
  const b = isoDay(gradedDay);
  return Boolean(a && b && a > b);
}

/* THE BULK-CARD OUTLIER GUARD, 11 November 2026.
 *
 * WHAT IT STOPS. PriceCharting's PSA 10 column is a price guide value worked
 * out of recorded sales, and on a bulk card there can be one sale behind it.
 * The site was printing, sourced and dated like every other figure:
 *
 *      Shining Fates #29   Snom          Common     raw $1.11   PSA 10 $1,500
 *      Pokemon GO #059     Bidoof        Common     raw $1.75   PSA 10 $1,325
 *      Paradox Rift #175   Snorlax Doll  Uncommon   raw $1.50   PSA 10 $900
 *      Silver Tempest #081 Espurr        Common     raw $1.77   PSA 10 $850
 *      Pokemon GO #020     Slowbro       Uncommon   raw $1.71   PSA 10 $700
 *
 * Nobody pays $1,325 for a graded Bidoof. The Bidoof figure has already cost
 * this site once: see the note on offPrinting() below, where it became "the
 * best graded card" the channel has pulled.
 *
 * THE RULE, all four at once:
 *   - the checklist rarity is Common, Uncommon or Rare (the three non-holo
 *     tiers; "Holo Rare" and everything above it is never touched),
 *   - the raw price on the same checklist row is under $5,
 *   - the PSA 10 is more than 100 times that raw price,
 *   - the PSA 10 is $400 or more.
 *
 * WHY THE $400 FLOOR, which was not in the first draft of this rule. The first
 * three tests alone were measured against every checklist on 11 November 2026
 * and matched 1,403 of the 3,440 bulk cards that carry a PSA 10: a Caterpie
 * with a 28 cent raw price and a $170 slab is 600 times its raw price and is
 * an ordinary market, because the grading fee alone puts a floor of $20 or so
 * under any PSA 10 and a bulk card's raw price is cents. "100 times raw" is
 * the normal state of a graded common, not a sign of a bad figure. The floor
 * is what separates the absurd tail from that market: 17 figures on the day it
 * was written, the five above among them. One of the 17 is a card the channel
 * has logged, the Bidoof (rip QXS1W_L2qbs), and that row never printed the
 * figure anyway: it is the Reverse Holo's, and offPrinting() below already
 * refuses it for a pull logged with no printing named.
 *
 * A SECOND TEST WAS MEASURED AND NOT SHIPPED: "a Grade 9 exists and is under
 * 10% of the PSA 10". It matched 161 more cards outside the bulk tiers,
 * including whole runs of Black Bolt and White Flare Illustration Rares and
 * Maushold, Paldea Evolved #226, which is a real and well known market. A wide
 * gap between a 9 and a 10 is how modern chase cards actually price.
 *
 * A HUMAN-CHECKED FIGURE IS NEVER SUPPRESSED. data/psa10.json `prices` is tier
 * 1 of the chain below and resolve() returns it before this is asked.
 *
 * Pure and exported so a builder that prints a PSA 10 from somewhere other
 * than resolve() can ask the same question rather than writing its own.
 */
export const OUTLIER = { rarities: ["common", "uncommon", "rare"], rawUnder: 5, times: 100, floor: 400 };
export function psa10Outlier({ psa10, raw, rarity } = {}) {
  if (typeof psa10 !== "number" || typeof raw !== "number" || !(raw > 0)) return false;
  if (!OUTLIER.rarities.includes(String(rarity || "").trim().toLowerCase())) return false;
  return raw < OUTLIER.rawUnder && psa10 > OUTLIER.times * raw && psa10 >= OUTLIER.floor;
}

/* WHICH PRINTING A CHECKLIST FIGURE IS FOR, added 14 October 2026.
 *
 * A checklist row carries ONE price per collector number, and where the number
 * is printed more than once sync-pricecharting-cards.mjs takes the DEAREST
 * printing and names it in `variant`. Bidoof, Pokemon GO #059, is "Reverse
 * Holo": `price` 1.72 and `psa10` 1150 are the Reverse Holo's, `all.Base` is
 * 1.15. The /pokemon/ pages say so ("the figure is the priciest of them").
 * /hall.html and /luck.html did not, and turned that $1,150 into "the best
 * graded card" the channel has pulled, while the rip log row says Common with
 * no printing named and its own raw figure is $0.57.
 *
 * So a LOGGED PULL only takes a checklist figure whose printing it can stand
 * behind: a standard printing (Base, Holo, none named), or the printing the
 * row itself names in `variant`. Anything else is a different printing of the
 * right card, which is the case the load-bearing number check above exists
 * for, and the answer is the same: drop it rather than print it. */
const canonPrinting = (v) => String(v || "").toLowerCase().replace(/[^a-z]/g, "").replace(/holo$/, "");
const STANDARD_PRINTINGS = new Set(["", "base", "normal", "unlimited"]);
/** True when a checklist figure is for a printing the logged row did not name. */
export function offPrinting(cardVariant, rowVariant = null) {
  const v = canonPrinting(cardVariant);
  if (STANDARD_PRINTINGS.has(v)) return false;
  return canonPrinting(rowVariant) !== v;
}
/**
 * The raw figure a checklist row can honestly put behind a logged pull: its own
 * `price` where that is the row's printing, otherwise the standard printing's
 * figure out of `all`, otherwise null.
 */
export function rawForPull(card, hit = null) {
  if (!card || typeof card.price !== "number") return null;
  if (!offPrinting(card.variant, hit?.variant)) return card.price;
  const base = card.all?.Base ?? card.all?.Normal ?? card.all?.Holo;
  return typeof base === "number" ? base : null;
}

// Same folding sync-pricecharting.mjs uses, for the same reason: accents have
// to go before the strip or "Pokémon GO" and "Pokemon GO" never meet.
const pcNorm = (x) =>
  String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const pcNum = (x) => String(x ?? "").replace(/^0+(?=\d)/, "");
const gnum = (v) => (typeof v === "number" ? v : typeof v?.price === "number" ? v.price : null);

/**
 * Load both graded stores once and return the resolvers over them.
 *
 * Shaped like shared/price-basis.mjs: the module reads its own files off ROOT
 * rather than making five builders each remember which two they need and which
 * of them is optional. Both are optional and both fail soft, because a missing
 * graded store must render a dash and never stop a build.
 */
export async function loadGradedPrices() {
  let psa10 = {};
  try {
    psa10 = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8")) || {};
  } catch {
    /* optional: every lookup falls through to null and the pages print dashes */
  }
  let pc = { cards: {} };
  try {
    pc = JSON.parse(await readFile(join(ROOT, "data/graded.json"), "utf8"));
  } catch {
    /* no graded sample yet; the chain skips tier 2 */
  }

  /* THE SAME PRICECHARTING READ THE CHECKLISTS ALREADY CARRY, 25 August 2026.
   *
   * data/graded.json holds 153 hand-verified rows. The per-set checklists under
   * public/data/cards/ hold a PriceCharting psa10 for 5,128 of 5,181 cards, out
   * of the same crawl, and every builder that reads THOSE has been answering
   * differently from every builder that reads this module. /grading.html builds
   * its own map off the checklists; the set guides, /hall.html and /index.html
   * come through here and fell past graded.json's 153 rows straight to the
   * tracker.
   *
   * SO THE SAME CARD WAS PUBLISHED TWICE AT TWO PRICES. Maushold, Paldea
   * Evolved #226: $1,452.50 on /grading.html and $709 on the set guide, both
   * dated, both sourced, on a site whose rule is that every price says where it
   * came from. Every one of the 20 cards that appears on both pages disagreed
   * with itself.
   *
   * IT GOES BEHIND graded.json, NOT IN FRONT. That file is hand-verified and
   * drops a row whose `matched` number disagrees, so it is the better answer
   * where it has one; this only fills the fall-through. No figure graded.json
   * supplies changes.
   *
   * THE JOIN IS SAFER THAN THE ONE ABOVE IT. These are our own checklists,
   * keyed by set id and card number, so there is no name matching to get wrong
   * -- which is the failure mode the long note at the top of this file exists
   * to guard against.
   *
   * THE DATE IS THE PRICE CRAWL'S, NOT THE FILE'S. Each checklist carries
   * `checked` for its card data and `pricesChecked` for the money, and they are
   * different days. Stamping a price with the card-data date would credit a
   * reading that never happened. */
  const pcCards = {};
  // What psa10Outlier() needs to know about a card: its checklist rarity and
  // the raw price on the same row. Kept for EVERY card, not only the ones the
  // checklist carries a PSA 10 for, because the figure being judged can come
  // from another tier (data/graded.json, the tracker) for the same printing.
  const facts = {};
  let pcCardsSource = null;
  try {
    const { readdir } = await import("node:fs/promises");
    const dir = join(ROOT, "public/data/cards");
    for (const f of await readdir(dir)) {
      if (!f.endsWith(".json")) continue;
      const doc = JSON.parse(await readFile(join(dir, f), "utf8"));
      if (!doc?.set || !Array.isArray(doc.cards)) continue;
      pcCardsSource = pcCardsSource || doc.priceSource || "pricecharting.com";
      for (const c of doc.cards) {
        if (c?.n != null) {
          const fact = { rarity: c.rarity || null, raw: typeof c.price === "number" ? c.price : null, name: c.name || null, pcUrl: c.pcUrl || null };
          facts[`${doc.set}-${c.n}`] = fact;
          facts[`${doc.set}-${pcNum(c.n)}`] ??= fact;
        }
        if (typeof c?.psa10 !== "number" || !c.psa10) continue;
        const rec = {
          psa10: c.psa10,
          // Which printing the figure is for; see offPrinting() above.
          variant: c.variant || null,
          url: c.pcUrl || null,
          source: doc.priceSource || "pricecharting.com",
          asOf: doc.pricesChecked || null,
        };
        // Both spellings, for the same reason `at` above looks up both: one
        // checklist numbers a chase card "094" and another store says "94".
        pcCards[`${doc.set}-${c.n}`] = rec;
        pcCards[`${doc.set}-${pcNum(c.n)}`] ??= rec;
      }
    }
  } catch {
    /* no checklists on disk; the chain simply skips this tier */
  }

  const pcByName = new Map();
  for (const rec of Object.values(pc.cards || {})) {
    const k = pcNorm(rec.name);
    if (!pcByName.has(k)) pcByName.set(k, []);
    pcByName.get(k).push(rec);
  }

  /** The day one data/graded.json row was read: its own date, else the file's. */
  const gradedRead = (rec) => isoDay(rec?.checked) || isoDay(rec?.asOf) || isoDay(pc.checked) || pc.checked || null;

  /**
   * The PriceCharting record for one printing, or null.
   *
   * See the long note at the top of this file: the number is verified out of
   * `matched` and a disagreement is dropped rather than printed.
   */
  function pricecharting(name, setName, number) {
    for (const rec of pcByName.get(pcNorm(name)) || []) {
      if (typeof rec.psa10 !== "number") continue;
      if (!setsAgree(rec.set, setName)) continue;
      const got = /#\s*(\d+)/.exec(rec.matched || "");
      if (!got || pcNum(got[1]) !== pcNum(number)) continue;
      return rec;
    }
    return null;
  }

  /**
   * Do PriceCharting's set and ours name the same set?
   *
   * Normally a substring test, which is what this has always been. The one
   * exception is promos, and it cost five cards a graded price they already had
   * on file.
   *
   * PRICECHARTING FILES EVERY ENGLISH PROMO IN ONE CONSOLE, "Pokemon Promo".
   * We file them by the set actually printed on the card: "MEP Black Star
   * Promos", "SVP Black Star Promos". Neither string contains the other, so no
   * promo could ever join and the hall printed "No PSA 10 price for this
   * printing" over $39.50, $40, $57.13, $72.50 and $95 sitting in
   * data/graded.json. The two hand-kept promos escaped only because someone had
   * typed their figures into data/hits.json by hand years' worth of comments ago.
   *
   * WHAT MAKES THIS SAFE IS THE NUMBER CHECK ABOVE, NOT THIS FUNCTION. A promo
   * still has to agree on the card NAME and on the collector number PriceCharting
   * actually landed on, and that pair is unique: checked across all 12 promo
   * records and all 13 promo hits on the site, every match is one-to-one and
   * every non-match is a card PriceCharting holds no record for at all. The
   * loosening is only ever applied where OUR set name says "black star promos",
   * so a set card can never fall through it.
   *
   * See shared/first-partner.mjs for the case this must NOT be used to solve:
   * a bare "Rowlet" with no number is a different question, and that join is
   * keyed on the product for exactly this reason.
   */
  function setsAgree(pcSet, setName) {
    if (pcNorm(pcSet).includes(pcNorm(setName))) return true;
    return pcNorm(pcSet) === "pokemonpromo" && /black\s*star\s*promos?$/i.test(String(setName || ""));
  }

  /**
   * The records for the right card in the right set whose PRINTING disagrees.
   *
   * A dropped match must be VISIBLE. build-hall.mjs prints one line per record
   * this returns, so a run that starts dropping more of them reads as a run
   * that dropped more of them, rather than as a source that quietly went empty.
   * That reporting is the only thing standing between the number check above
   * and a column of silent dashes.
   */
  function nearMisses(name, setName) {
    return (pcByName.get(pcNorm(name)) || []).filter((r) => setsAgree(r.set, setName));
  }

  // THE KEY IS TRIED LITERALLY FIRST AND ZERO-STRIPPED SECOND, which is a
  // superset of the two shapes the five copies of this helper used between
  // them and changes no existing answer. It matters on exactly one row today:
  // data/psa10.json is keyed `perfect-order-094` and sets.json spells that
  // chase card's number "094", so the literal form is the one that hits and a
  // stripped-only lookup (build-pages.mjs's psaFor did this) missed it.
  const at = (store, setId, number) =>
    store?.[`${setId}-${number}`] ?? store?.[`${setId}-${pcNum(number)}`];

  /**
   * Everything the site knows about one card's PSA 10 price, or null.
   *
   * `name` and `setName` are required for tier 2 and are OPTIONAL only in the
   * sense that leaving them out silently skips PriceCharting: the join is on
   * the card's name and its set's name, because data/graded.json is keyed by
   * what the spreadsheet wrote rather than by a set id it does not carry.
   *
   * Returns { price, from, source, asOf, url, sales }. `sales` is non-null ONLY
   * where the tracker supplied the figure, because it is the only feed that
   * publishes a sale count and a "182 sales" note under a PriceCharting number
   * would be describing a different measurement.
   *
   * THE WINNER IS NAMED, NOT INFERRED. build-hall.mjs learned this the hard
   * way: working out afterwards who had answered, from `manual || auto`,
   * credited pokemonpricetracker.com whenever an `auto` row merely EXISTED,
   * including when the ten-sale floor had just thrown it away. The source is
   * recorded by whoever supplies the figure, in the same expression.
   */
  // `logged: true` is a pricing of a pull out of data/hits.json, and then a
  // checklist figure for a printing the row did not name is refused (see
  // offPrinting() at the top of this file). `variant` is the row's own printing.
  function resolveUnguarded(setId, number, { name = null, setName = null, logged = false, variant = null } = {}) {
    const pccFits = (rec) => rec && !(logged && offPrinting(rec.variant, variant));
    const manualRec = at(psa10.prices, setId, number) ?? at(psa10, setId, number);
    const manual = gnum(manualRec);
    if (manual) {
      return {
        price: manual,
        from: "manual",
        // A hand-entered price is the owner's own figure and carries no feed name,
        // which is the call build-hall.mjs, build-proto.mjs and
        // build-wanted.mjs all already make.
        source: manualRec?.source || null,
        asOf: manualRec?.asOf || null,
        url: null,
        sales: null,
      };
    }

    /* NO GRADED FIGURE BUT THE OWNER'S OWN, FROM 13 NOVEMBER 2026. Below this
       line the chain read PriceCharting (graded.json and the card files) and
       then pokemonpricetracker.com (psa10.json `auto`). PriceCharting requires
       a paid plan to show their prices and the owner declined; asked what graded
       values should become, he chose links only: "Graded prices on PriceCharting"
       where a figure used to be (see link() below). So nothing past a hand typed
       figure is returned. psa10.json `auto` is still on disk and untouched. */
    return null;
    const hit = name && setName ? pricecharting(name, setName, number) : null;
    /* THE NEWER OF THE TWO PRICECHARTING READS WINS, 23 September 2026. Tier 2
       is data/graded.json, one hand-run crawl stamped August 23; tier 3 is the
       nightly checklist read of the SAME product pages. Tier 2 always won, so
       104 of the Hall's 151 PSA 10s were a month old while tonight's figure sat
       one tier down (Mienshao $155 against $305, Rampardos ex $37.41 against
       $14). Same source, so the fresher read is simply the better one; tier 2
       still answers wherever the nightly has no row, which is every promo.

       ONE COMPARISON, WRITTEN ONCE, since 11 November 2026: newerRead() at the
       top of this file. The graded row is dated by gradedRead(), which takes a
       row's own date before the file's, so the day sync-pricecharting.mjs
       starts stamping each row (a partial re-read, a resumed run) this needs no
       edit. Measured that day over the 242 printings both reads hold: the
       card file was newer on all 242 (10 November against 13 October), so this
       rewrite moved no figure on any page; the weekly run is what will make the
       tie and the graded.json-is-newer branches live. */
    const pcc = at(pcCards, setId, number);
    const card = pccFits(pcc) && typeof pcc.psa10 === "number" ? pcc : null;
    const fromCard = () => ({
      price: card.psa10,
      from: "pricecharting",
      source: card.source,
      asOf: card.asOf,
      url: card.url,
      // Null for the same reason the graded.json branch is null: PriceCharting
      // publishes no sale count, and a "279 sales" note under its number would
      // be describing the other feed's measurement.
      sales: null,
    });
    if (hit && card && newerRead(card.asOf, gradedRead(hit))) return fromCard();
    if (hit) {
      return {
        price: hit.psa10,
        from: "pricecharting",
        source: pc.source || "pricecharting.com",
        // THE DATE OF THIS READ, which today is the file's: data/graded.json is
        // a snapshot taken by one crawl and stamps the whole file. A row that
        // carries its own date is dated by it. See gradedRead().
        asOf: gradedRead(hit),
        url: hit.url || null,
        sales: null,
      };
    }

    // The same PriceCharting figure /grading.html has always used, for every
    // printing data/graded.json holds no row for.
    if (card) return fromCard();

    const a = at(psa10.auto, setId, number);
    if (!a?.psa10) return null;
    if (a.psa10Sales != null && a.psa10Sales < MIN_SALES) return null;
    return {
      price: a.psa10,
      from: "tracker",
      source: a.source || null,
      asOf: a.asOf || null,
      url: null,
      sales: a.psa10Sales ?? null,
    };
  }

  /* THE ONE PLACE THE OUTLIER GUARD RUNS. Every caller reaches the chain
     through resolve(), price() or stamp(), and the last two call resolve(), so
     a figure psa10Outlier() refuses comes back null from all three and the page
     prints its ordinary "no PSA 10 price" state. A hand-entered figure is
     returned untouched: `from: "manual"` is the owner's own number.

     `suppressed` records what was refused, keyed by set and number, so a
     builder or a test can count it instead of the figures vanishing quietly. */
  const suppressed = new Map();
  function resolve(setId, number, opts = {}) {
    const r = resolveUnguarded(setId, number, opts);
    if (!r || r.from === "manual") return r;
    const f = at(facts, setId, number);
    if (f && psa10Outlier({ psa10: r.price, raw: f.raw, rarity: f.rarity })) {
      suppressed.set(`${setId}-${number}`, { set: setId, number: String(number), name: f.name, rarity: f.rarity, raw: f.raw, psa10: r.price, from: r.from });
      return null;
    }
    return r;
  }

  /**
   * PriceCharting's UNGRADED figure for one printing out of data/graded.json,
   * or null. Same join as `pricecharting()` above, number check and all; it
   * only reads the other column.
   */
  function ungraded(name, setName, number) {
    if (!name || !setName || number == null) return null;
    for (const rec of pcByName.get(pcNorm(name)) || []) {
      if (typeof rec.ungraded !== "number") continue;
      if (!setsAgree(rec.set, setName)) continue;
      const got = /#\s*(\d+)/.exec(rec.matched || "");
      if (!got || pcNum(got[1]) !== pcNum(number)) continue;
      return { price: rec.ungraded, source: pc.source || "pricecharting.com", asOf: gradedRead(rec), url: rec.url || null };
    }
    return null;
  }

  /**
   * THE RAW FIGURE FOR A PROMO HIT, ONE CHAIN FOR ALL THREE RENDERERS. Added
   * 14 October 2026.
   *
   * A promo has no checklist, so its raw price used to be the figure typed onto
   * its data/hits.json row, and each of build-pages.mjs, build-hall.mjs and
   * build-luck.mjs read that first. The Costco Mega Charizard X ex MEP 023 row
   * says $38.75 and $176.57, read 13 August; data/graded.json read the SAME
   * PriceCharting page on 13 October at $30.18 and $139.99. The rip page and
   * the hall took the fresh PSA 10 and the stale raw, /luck.html took both
   * stale, so one card printed $140 on two pages and $177 on a third.
   *
   * SO THE FRESHER READ WINS, and the hand figure is the fallback rather than
   * the override. That is the order CLAUDE.md gives for every price on the site
   * ("a frozen number should lose to a fresh one and win against nothing"). The
   * hand figure still wins where it is the NEWER read of the two, or where
   * graded.json holds no row for the printing at all. A hand figure with no
   * date loses to a dated one.
   *
   * Returns { price, source, asOf, url, from } with `from` either
   * "pricecharting" (graded.json) or "log" (the hit row), or null.
   */
  function rawForHit(h, { name = null, setName = null, number = null } = {}) {
    const fresh = ungraded(name || h?.card, setName || h?.setName, number ?? h?.number);
    const hand = typeof h?.price === "number"
      ? { price: h.price, source: h.priceSource || null, asOf: h.priceAsOf || null, url: h.priceUrl || null, from: "log" }
      : null;
    if (fresh && (!hand || !hand.asOf || (fresh.asOf && fresh.asOf >= hand.asOf))) return { ...fresh, from: "pricecharting" };
    return hand;
  }

  /** Just the figure, for the callers that only print one. */
  /* THE PRICECHARTING PAGE FOR A CARD, AS A LINK, NEVER A NUMBER. From 13
     November 2026 no PriceCharting figure is shown anywhere (they require a paid
     plan; see shared/no-pricecharting.mjs), so where a page used to print a
     graded value it prints "Graded prices on PriceCharting" pointing here. The
     card file's own pcUrl first, then the graded.json row that matched by
     name, set and number. */
  function link(setId, number, { name = null, setName = null } = {}) {
    const f = at(facts, setId, number);
    if (f?.pcUrl) return f.pcUrl;
    if (!name || !setName) return null;
    for (const rec of pcByName.get(pcNorm(name)) || []) {
      if (!rec.url || !setsAgree(rec.set, setName)) continue;
      const got = /#\s*(\d+)/.exec(rec.matched || "");
      if (!got || pcNum(got[1]) !== pcNum(number)) continue;
      return rec.url;
    }
    return null;
  }
  const price = (setId, number, opts) => resolve(setId, number, opts)?.price ?? null;

  /** Who said so and when, for the sourcing lines under a grid. */
  const stamp = (setId, number, opts) => {
    const r = resolve(setId, number, opts);
    return { asOf: r?.asOf || null, source: r?.source || null, url: r?.url || null };
  };

  return { psa10, pc, pricecharting, nearMisses, resolve, price, stamp, ungraded, rawForHit, suppressed, facts, link };
}

/* The one way a page prints the PriceCharting link that stands where a graded
   value used to be. Teal like every link on the site, leaves the site, says so. */
const escAttr = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
export function gradedLinkHtml(url, name = "", { text = "Graded prices on PriceCharting", cls = "pc-link" } = {}) {
  if (!url) return "";
  const who = name ? ` for ${name}` : "";
  return `<a class="${cls}" href="${escAttr(url)}" target="_blank" rel="noopener" aria-label="${escAttr(`Graded prices${who} on PriceCharting, opens on pricecharting.com`)}">${text}</a>`;
}
