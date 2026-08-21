/**
 * Today, as the local calendar reads it.
 *
 * WHY THIS FILE EXISTS AT ALL, given it is four lines. Forty-one scripts wrote
 * `new Date().toISOString().slice(0, 10)` and every one of them meant "today".
 * toISOString() is UTC. West of Greenwich the two disagree for the last hours
 * of every evening: at 8pm in Rochester it is already tomorrow in UTC. So for
 * four hours a night, five in winter, every one of those scripts stamped
 * TOMORROW'S DATE onto a file, in the owner's own timezone, on the pages that
 * exist to say when a number was read.
 *
 * IT WAS NOT THEORETICAL AND IT WAS NOT ONLY COSMETIC. Two things caught on
 * 19 August 2026:
 *   - data/first-partner.json was stamped `checked: 2026-08-20` at 8pm on the
 *     19th, and the guide published "PRICES READ AUGUST 20, 2026" the day
 *     before that date existed. On a site whose whole claim is that a number
 *     is traceable to a source and a date, a date in the future is not a typo.
 *   - The home page's own build stamp did the same, and because the drops band
 *     deletes rows whose day has passed, a Walmart drop reading "Wednesday
 *     19 August, from 9pm Eastern" was swept off the front door forty minutes
 *     before it happened. The client sweep only ever removes rows, so nothing
 *     could bring it back.
 *
 * shared/drops.mjs has said in capitals not to do this since it was written,
 * and ships the same three lines to the browser as CLIENT_DAY_JS so the reader
 * and the server answer the same question. This is the server half of that
 * pair. Keep them in step.
 *
 * DO NOT "SIMPLIFY" THIS BACK TO toISOString(). That is the exact edit that
 * caused it, and it looks like a tidy-up every time.
 */

/** @param {Date} [dt] Defaults to now. @returns {string} YYYY-MM-DD, local. */
export const localDay = (dt = new Date()) => {
  const m = dt.getMonth() + 1, d = dt.getDate();
  return `${dt.getFullYear()}-${m < 10 ? "0" : ""}${m}-${d < 10 ? "0" : ""}${d}`;
};

/**
 * Whole days from an ISO date to today, counted on the LOCAL calendar.
 *
 * THE SUBTRACTION IS THE BUG AND IT SURVIVED THE SWEEP THAT MADE THIS FILE.
 * `Math.floor((Date.now() - new Date(iso)) / 86400000)` looks timezone-free and
 * is not: `new Date("2026-07-17")` parses as UTC MIDNIGHT while `Date.now()` is
 * an absolute instant, so the gap between them crosses a whole number at UTC
 * midnight -- 8pm in Rochester, 7pm in winter.
 *
 * Two labels flipped on it, both on the front door. build-proto.mjs's badge on
 * the newest rip read "Yesterday's Rip" from 8pm on the day the video went up,
 * and build-set-pages.mjs told every set guide its release was a week older
 * than it was: Pitch Black went "4 weeks ago" to "5 weeks ago" at 20:00 EDT on
 * 20 August 2026, which is how this was found -- check-tree-drift reported two
 * stale pages and the diff was the calendar, not the source.
 *
 * Both dates are reduced to their local YYYY-MM-DD first and only then parsed,
 * so both sides are UTC midnight and the difference is exact whole days.
 */
export const daysSince = (iso, now = new Date()) => {
  if (!iso) return null;
  const a = Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${localDay(now)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
};
