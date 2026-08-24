// THE EXPIRY MODEL FOR data/drops.json, SHARED BY /drops.html AND THE HOME PAGE.
//
// Everything about the drops forecast that decides WHEN A CLAIM STOPS BEING
// TRUE lives here, because two pages now print the same rows and a reader who
// sees "dropping today" on the home page three days after it was true is not
// helped by /drops.html having got it right. The two pages must not be able to
// disagree about which rows are alive, so neither of them owns the answer.
//
// THE MODEL HAS TWO LAYERS AND BOTH ARE LOAD BEARING. It is written up at
// length in data/drops.json's _readme and in the comments in
// scripts/build-drops.mjs; the short version:
//
//   1. THE WEEK. `weekEnds` is the last day the whole list describes. Past it,
//      /drops.html keeps its rows behind a staleness banner, because last
//      week's expectations are still worth reading as a pattern. The home page
//      band does NOT: see homeBandRows below for why the two differ.
//   2. THE ROW. A row may carry `expires`, the last day IT can be true. A row
//      whose `expires` is earlier than `weekEnds` is PERISHABLE: it is one
//      afternoon rather than a week of shelf watching, so the day after, it is
//      not a record of anything, it is simply wrong. Perishable rows are
//      dropped by the builder when the build clock is past them AND swept out
//      of the page again on the READER'S clock, which is the half that survives
//      a deploy that has stopped moving.
//
// The second layer is the one that matters most and it is the easiest to leave
// out, because a page that is rebuilt nightly never visibly needs it. This
// site's nightly has failed three nights running before now.

/**
 * The build clock for the drops data.
 *
 * The later of the newest upload in the catalogue and the compiled date in
 * drops.json, both of which only a human moves. That is deliberate: it makes a
 * rebuild reproducible and stops a stale checkout silently making an old week
 * look current. It is NOT the wall clock, so it can lag reality; the client
 * sweeps below are what cover that.
 */
export function dropsClock(doc, videos) {
  return [
    (videos || []).map((v) => v.published).filter(Boolean).sort().pop(),
    doc.compiled,
  ]
    .filter(Boolean)
    .sort()
    .pop()
    .slice(0, 10);
}

/** The last day a row can be true. Absent `expires` inherits the week. */
export const expiresOn = (doc, d) => d.expires || doc.weekEnds || "";

/**
 * Does this row die BEFORE the week does?
 *
 * Only those rows are swept. A row with no `expires` of its own lives or dies
 * with the week like everything else, which is what keeps last week's ordinary
 * rows readable as a record on /drops.html.
 */
export const isPerishable = (doc, d) =>
  Boolean(doc.weekEnds && d.expires && d.expires < doc.weekEnds);

/** Split rows into the ones still standing on `today` and the ones past it. */
export function splitByExpiry(doc, rows, today) {
  const expired = rows.filter((d) => isPerishable(doc, d) && expiresOn(doc, d) < today);
  return { live: rows.filter((d) => !expired.includes(d)), expired };
}

/** Has the whole week passed? */
export const isStale = (doc, today) => Boolean(doc.weekEnds && doc.weekEnds < today);

/** How far past the week we are, in days. Zero when the week is current. */
export const daysStale = (doc, today) =>
  doc.weekEnds ? Math.round((new Date(today) - new Date(doc.weekEnds)) / 86400000) : 0;

/**
 * WHAT EACH CONFIDENCE TIER IS CALLED, IN WORDS, AND BOTH PAGES SAY THE SAME ONES.
 *
 * The tiers themselves are documented in data/drops.json's _readme. The reason
 * the LABELS are shared rather than typed twice is narrower and it is the whole
 * point of the band: `pattern` is the weakest tier on the site, it exists
 * because no retailer publishes a restock schedule, and a compact band is
 * exactly the place somebody would round it up to "Expected" to save a word.
 * Two tables cannot round differently if there is one table.
 *
 * The CSS class, the tooltip note and the ladder of ink weights stay with
 * /drops.html, which has room to spell all four out under the list.
 */
export const CONF_LABEL = {
  confirmed: "Confirmed",
  window: "Usual window",
  expected: "Expected",
  pattern: "Pattern only",
};

/* --------------------------------------------------------------- the band -- */

/**
 * Pick the few rows the HOME PAGE band shows, out of the whole week's list.
 *
 * The band is a pointer, not a copy of /drops.html, and the home page is a
 * video channel's hub before it is a restock tracker, so this is deliberately
 * a handful of rows. Five rules, and each one is answering a specific way a
 * compact band could lie or die:
 *
 * 1. LIVE ROWS ONLY. Anything the build clock has already passed never makes
 *    it in. (The reader's clock takes a second pass in the browser.)
 *
 * 2. NOTHING IS TRUNCATED, SO A ROW TOO LONG TO PRINT WHOLE IS LEFT OUT.
 *    This is the rule that keeps the hedges attached. Every row on
 *    /drops.html is written in the words the trackers hedged it with, and the
 *    hedge is usually the END of the sentence: "the trackers expect Tuesday
 *    around 3am Eastern based on recent patterns, WHICH IS A GUESS RATHER THAN
 *    A TIME". Any band that shortens its rows to fit turns that into a
 *    timetable, and it reads as tidying up rather than as lying. So the band
 *    prints `what` and `when` verbatim or not at all, and a row whose own text
 *    does not fit a compact card is simply not band material. It stays one tap
 *    away on /drops.html with its notes intact.
 *
 * 3. ONE ROW PER RETAILER. Two Pokemon Center rows in a three row band reads
 *    as a page about Pokemon Center. The band's job is breadth: which shops to
 *    watch at all.
 *
 * 4. AT MOST `maxPerish` PERISHABLE ROWS. A band made entirely of one
 *    afternoon alerts empties itself by Thursday on a page that has stopped
 *    being rebuilt, and then the home page silently loses the feature in the
 *    middle of a week whose other six rows are still perfectly good. Keeping
 *    at least one row that runs to the end of the week is what makes the band
 *    survive its own sweep.
 *
 * 5. SOONEST FIRST. A row that names today or tomorrow is the reason somebody
 *    came back to the page; a row that says "ongoing, select stores" is not.
 *    Perishable rows sort by the day they die, then rows with a named window,
 *    then the order the human wrote them in.
 *
 * The length budgets are in characters against the ORIGINAL text, which is
 * crude, and crude is the point: it is checked against what the writer wrote
 * rather than against what a renderer produced, so it cannot be satisfied by
 * making the type smaller. The numbers come from the rendered row: at 390px
 * the band's text column measures 326px, and 14px Outfit fits about 46
 * characters to a line there, so 130 characters is three lines of `what` and
 * 80 is under two of `when`.
 */
export function homeBandRows(doc, rows, {
  limit = 3,
  maxPerish = 2,
  maxWhat = 130,
  maxWhen = 80,
} = {}) {
  const fits = (d) =>
    String(d.what || "").length <= maxWhat && String(d.when || "").length <= maxWhen;

  const tier = (d) => (isPerishable(doc, d) ? 0 : d.window?.from ? 1 : 2);
  const ranked = rows
    .map((d, i) => ({ d, i }))
    .sort((a, b) =>
      tier(a.d) - tier(b.d) ||
      String(expiresOn(doc, a.d)).localeCompare(String(expiresOn(doc, b.d))) ||
      a.i - b.i
    )
    .map((x) => x.d);

  const picked = [];
  const seen = new Set();
  const skipped = { long: [], dupe: [], perishCap: [] };
  for (const d of ranked) {
    if (picked.length >= limit) break;
    if (!fits(d)) { skipped.long.push(d); continue; }
    if (seen.has(d.retailer)) { skipped.dupe.push(d); continue; }
    if (isPerishable(doc, d) && picked.filter((p) => isPerishable(doc, p)).length >= maxPerish) {
      skipped.perishCap.push(d);
      continue;
    }
    seen.add(d.retailer);
    picked.push(d);
  }
  return { picked, skipped };
}

/**
 * The home band grouped BY RETAILER rather than by drop.
 *
 * The owner, 23 August 2026: "can you also add in the expected online drops too, can
 * make it super simple to read/see what retailers are planning online and in
 * store". homeBandRows above answers a different question -- it picks the three
 * most urgent DROPS and dedupes by retailer, so Target's online drop and
 * Walmart's Walmart Wednesday were thrown away as duplicates of their in-store
 * rows. Six of the nine rows in the file never reached the front door.
 *
 * WHY A SECOND FUNCTION RATHER THAN A FLAG. The old one is still the right
 * answer to "what are the three most urgent things this week" and nothing about
 * its ranking is wrong; this is a different unit of display. Both are exported
 * and neither guesses which the caller wanted.
 *
 * ONE ROW PER CHANNEL, STORE BEFORE ONLINE. A retailer with two in-store rows
 * keeps the more urgent one and the rest are reported as skipped rather than
 * vanishing -- the caller prints that list at the end of a run. Store comes
 * first because it is the one a reader cannot check from where they are
 * sitting, so it is the one worth knowing before leaving the house.
 *
 * NO TRUNCATION OF WHAT THE TRACKERS SAID. maxWhat here is deliberately loose
 * where homeBandRows keeps it tight, because that function was fighting for
 * space above the fold and this band is inside a collapsed <details> that costs
 * nothing until somebody opens it. A hedge clipped mid-sentence is the one
 * thing this band must never do.
 */
// maxWhen is 200 because Target's online row writes 168 characters of it --
// which backend loadouts have appeared and what that has meant on past
// weeks -- and at 120 the ONE online row this week still had was the one
// row left off the band. In this layout `when` is a full-width micro line
// under the chips rather than a bold line competing with the card's name,
// so it has the room the old row did not.
export function homeBandByRetailer(doc, rows, { limit = 8, maxWhat = 220, maxWhen = 200 } = {}) {
  const fits = (d) =>
    String(d.what || "").length <= maxWhat && String(d.when || "").length <= maxWhen;
  const tier = (d) => (isPerishable(doc, d) ? 0 : d.window?.from ? 1 : 2);
  const rank = (a, b) =>
    tier(a.d) - tier(b.d) ||
    String(expiresOn(doc, a.d)).localeCompare(String(expiresOn(doc, b.d))) ||
    a.i - b.i;

  const skipped = { long: [], dupe: [] };
  const byRetailer = new Map();
  for (const x of rows.map((d, i) => ({ d, i })).sort(rank)) {
    const { d } = x;
    if (!fits(d)) { skipped.long.push(d); continue; }
    if (!byRetailer.has(d.retailer)) byRetailer.set(d.retailer, { retailer: d.retailer, order: x.i, lines: [] });
    const g = byRetailer.get(d.retailer);
    if (g.lines.some((l) => l.channel === d.channel)) { skipped.dupe.push(d); continue; }
    g.lines.push(d);
  }
  const groups = [...byRetailer.values()]
    .map((g) => ({
      ...g,
      lines: g.lines.sort((a, b) => (a.channel === "store" ? 0 : 1) - (b.channel === "store" ? 0 : 1)),
    }))
    .sort((a, b) => rank({ d: a.lines[0], i: a.order }, { d: b.lines[0], i: b.order }));
  const picked = groups.slice(0, limit);
  for (const g of groups.slice(limit)) skipped.dupe.push(...g.lines);
  return { picked, skipped };
}

/* ------------------------------------------------------- the client sweeps - */

// TWO PAGES RUN THE SAME DATE ARITHMETIC IN THE BROWSER and they used to hold
// two copies of it. These are the source of both.
//
// AN ESCAPING TRAP DIES HERE. Both call sites paste this into a page through a
// TEMPLATE LITERAL, where a lone backslash never survives: `\d` inside a
// template literal in a builder ships as `d`, so a date guard written the
// obvious way becomes /^d{4}-d{2}-d{2}$/, matches no date on earth, and the
// sweep is present, correct looking and permanently asleep. Interpolating a
// string built HERE does not re-process escapes, so the pattern below reaches
// the page exactly as written. Do not inline this regex at a call site.

/**
 * The two the home page band needs: is this an ISO day, and what day is it.
 *
 * LOCAL MIDNIGHT, NOT UTC, AND THAT IS WHY todayIso IS HAND ROLLED. Reading
 * "today" from toISOString() gives the UTC date while every published date on
 * these pages is a local one. West of Greenwich the two disagree for the last
 * hours of every evening: at 9pm in Rochester it is already tomorrow in UTC, so
 * every date on the page ages by a day. Four hours a night, five in winter, in
 * the owner's own timezone. Do not "simplify" this to toISOString().slice(0,10).
 *
 * THE COMMENT LIVES HERE AND NOT IN THE STRING. Both call sites paste this into
 * a page, and the home page is the most visited document on the site with this
 * block in its critical path. Same trade homeCss makes in build-proto.mjs: the
 * argument stays in the source, only the code ships.
 */
export const CLIENT_DAY_JS = `
  function isIsoDay(s) { return /^\\d{4}-\\d{2}-\\d{2}$/.test(s || ""); }
  function todayIso() {
    var n = new Date();
    var m = n.getMonth() + 1, d = n.getDate();
    return n.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
  }`;

/** Those plus the two /drops.html needs for its "how many days out of date" sum. */
export const CLIENT_DATE_JS = `${CLIENT_DAY_JS}
  function localDay(iso) {
    var p = String(iso || "").split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]).getTime();
  }
  function todayLocal() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  }`;
