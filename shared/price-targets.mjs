// WHICH CARDS scripts/sync-prices.mjs ASKS FOR TONIGHT. 11 November 2026.
//
// Pure, and in its own file, for one reason: sync-prices.mjs runs top to bottom
// on import and exits without a paid API key, so nothing inside it could be
// tested. This is the one decision in that script worth testing, because
// getting it wrong is invisible: the step is `continue-on-error` in the nightly
// and a wasted night prints a tidy summary.
//
// WHAT WENT WRONG. The nightly runs `--limit 50`, which is the free tier's
// whole day (100 credits, 2 a card). The script took the first 50 cards it had
// no price for and only THEN noticed that the provider does not carry some of
// their sets. Those cards print "set not on their side", get no price, and so
// are still the first cards without a price tomorrow. On 10 November 2026 that
// was 33 of the 50: Delta Reign, Crown Zenith, Silver Tempest, Celebrations and
// Chilling Reign, the same 33 every night, in front of cards the provider does
// carry. They cost no credits, because no request is made for them. They cost
// the SLOTS, which on a 50 a day budget is the same thing.
//
// THE FIX IS A DATED SKIP LIST, persisted in data/psa10.json as `notCarried`:
// set id -> the day it was last confirmed missing. A set on that list takes no
// slot for RETRY_DAYS. After that its cards are let back into the queue for one
// run, which prints "set not on their side" again and re-stamps the date, so a
// set that has been missing for a month is put in front of a person once a
// month rather than never. The provider adds sets; SET_MAP in sync-prices.mjs
// is confirmed by hand against their /v2/sets, so somebody has to be reminded
// to look.
//
// A SET THAT GAINS A MAPPING IS ASKED AT ONCE. The list is only consulted for
// a set with no entry in the map, so adding one to SET_MAP beats a stale
// `notCarried` date and the caller drops the entry.

export const RETRY_DAYS = 30;

const dayNumber = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : null;
};

/** Whole days from `from` to `to`, both YYYY-MM-DD, or null if either is not a date. */
export function daysBetween(from, to) {
  const a = dayNumber(from), b = dayNumber(to);
  return a == null || b == null ? null : b - a;
}

/**
 * Split the targets into what to ask for now and what is being skipped.
 *
 *   targets     [{ key, setId, ... }] in priority order
 *   auto        data/psa10.json `auto`: a key in here is already priced
 *   notCarried  data/psa10.json `notCarried`: { setId: "YYYY-MM-DD" }
 *   setMap      our set id -> the provider's; a set with no entry is not carried
 *   today       "YYYY-MM-DD"
 *   limit       how many cards this run may take (Infinity for all)
 *
 * Returns
 *   todo        the cards to process, at most `limit`, in the order given
 *   pending     how many unpriced cards there are in all, skipped ones included
 *   skipped     { setId: { since, cards } } for sets resting on the skip list,
 *               and for the rest of a set this run is confirming with one card
 *   left        unpriced cards NOT resting on the skip list that did not fit
 *   stale       set ids on the list that now have a mapping; the caller drops them
 */
export function selectTargets({ targets, auto = {}, notCarried = {}, setMap = {}, today, limit = Infinity, retryDays = RETRY_DAYS }) {
  const todo = [];
  const skipped = {};
  const asking = new Set();
  let pending = 0, left = 0;
  for (const t of targets || []) {
    if (auto?.[t.key]) continue;
    pending++;
    const since = notCarried?.[t.setId];
    if (!setMap[t.setId] && since) {
      const age = daysBetween(since, today);
      // A date that does not parse, or one in the future, is not a reason to
      // keep skipping: treat it as due and let the run re-stamp it.
      if (age != null && age >= 0 && age < retryDays) {
        skipped[t.setId] = skipped[t.setId] || { since, cards: 0 };
        skipped[t.setId].cards++;
        continue;
      }
    }
    // ONE CARD CONFIRMS A SET. An unmapped set that is not resting yet (first
    // sight, or its 30 days are up) gets a single slot, which is enough for the
    // run to print "set not on their side" and stamp the date; its other cards
    // would only say the same thing again, 8 slots a set, so they wait.
    if (!setMap[t.setId]) {
      if (asking.has(t.setId)) {
        skipped[t.setId] = skipped[t.setId] || { since: today, cards: 0 };
        skipped[t.setId].cards++;
        continue;
      }
      if (todo.length < limit) asking.add(t.setId);
    }
    if (todo.length < limit) todo.push(t);
    else left++;
  }
  const stale = Object.keys(notCarried || {}).filter((id) => setMap[id]);
  return { todo, pending, skipped, left, stale };
}
