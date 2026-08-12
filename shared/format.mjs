// Formatting helpers shared by every generator.
//
// These lived as copy-pasted constants in eight of the nine build scripts, and
// the copies had already drifted:
//
//   esc        8 copies, byte identical
//   MONTHS     8 copies in TWO variants, abbreviated in five scripts and
//              spelled out in two, so the same date rendered "Aug 11, 2026" on
//              a rip page and "August 11, 2026" on the set guide it links to
//   niceDate   4 copies, and only ONE of them carried the guard whose own
//              comment records the bug that prompted it: sync-youtube emits
//              published:"" for an upload that has been made private but is
//              still listed in the uploads playlist, and "".split("-") yields
//              MONTHS[NaN], so the page printed "undefined NaN, ". The fix was
//              applied to build-pages.mjs and never carried to the other three
//
// Both spellings are kept because both are wanted: short in dense lists, long
// in prose. They differ by name now instead of by which file you happen to be
// editing.

/** HTML-escape a value for interpolation into markup. */
export const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/**
 * Format an ISO date, returning "" for anything it cannot parse.
 *
 * Guarded on both counts: a missing date, and a present but malformed one.
 * `"2026"` has no month part, so Number(undefined) is NaN and MONTHS[NaN] is
 * undefined; without the lookup check that renders as "undefined NaN, 2026"
 * rather than as nothing.
 */
function fmt(iso, months) {
  if (!iso) return "";
  const p = String(iso).slice(0, 10).split("-");
  const m = months[+p[1] - 1];
  const d = +p[2];
  if (!m || !Number.isFinite(d) || !p[0]) return "";
  return `${m} ${d}, ${p[0]}`;
}

/** "Aug 11, 2026" */
export const shortDate = (iso) => fmt(iso, MONTHS_SHORT);

/** "August 11, 2026" */
export const longDate = (iso) => fmt(iso, MONTHS_LONG);

/** Sleep, for the rate-limited sync scripts. */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
