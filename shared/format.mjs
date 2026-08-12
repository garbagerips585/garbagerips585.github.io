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
  // The Pokemon TCG API dates with slashes ("2026/08/11") and everything else
  // here uses dashes, so accept both rather than making every caller remember.
  const p = String(iso).slice(0, 10).split(/[-/]/);
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

/**
 * Money, in the two shapes this site actually uses.
 *
 * There were seven copies across the build scripts in two INCOMPATIBLE
 * variants, and the difference is not cosmetic:
 *
 *   compact  $1,471   rounds above $100. Right on a tile or in a list, where
 *                     the cents are noise and the column has to stay narrow.
 *   exact    $1,470.58  always two places. Right anywhere the number is the
 *                     point: a checklist row, a break-even calculation.
 *
 * Both are correct and both are wanted, so they are two named functions rather
 * than one merged guess. What was NOT correct is that four of the seven copies
 * had no type guard at all, so `money(undefined)` threw a TypeError rather than
 * rendering nothing, and one page shipped "$-68.57" while the calculator
 * directly above it said "-$68.57".
 *
 * A null, an undefined or a NaN returns "" here. A missing price is a thing
 * that happens (the four newest sets ship with no prices for weeks) and it
 * should render as absent, not take the build down.
 */
const nOrNull = (n) => (typeof n === "number" && Number.isFinite(n) ? n : null);

export function moneyCompact(v) {
  const n = nOrNull(v);
  if (n === null) return "";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  return abs >= 100
    ? `${sign}$${Math.round(abs).toLocaleString("en-US")}`
    : `${sign}$${abs.toFixed(2)}`;
}

export function moneyExact(v) {
  const n = nOrNull(v);
  if (n === null) return "";
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Whole dollars, no cents at any size. Used by the grading fee tables. */
export function moneyRound(v) {
  const n = nOrNull(v);
  if (n === null) return "";
  return `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
}
