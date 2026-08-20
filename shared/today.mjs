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
