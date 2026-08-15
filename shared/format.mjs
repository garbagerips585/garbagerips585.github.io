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

/**
 * The site's "this cell has no value" placeholder.
 *
 * A bare em dash is fine to LOOK at and useless to LISTEN to. VoiceOver and NVDA
 * both announce U+2014 as "dash" or "em dash" when a cell holds nothing else, so
 * /expansions.html was reading a punctuation mark out 156 times to anybody going
 * through those tables cell by cell, and even then it never said what was
 * missing. Deleting the cell is not the fix either: a row with fewer cells than
 * its header breaks the column association for every cell after it.
 *
 * So the dash stays for the eye and is hidden from the accessibility tree, and
 * the real answer goes next to it in `.sr-only` text. `reason` is required
 * rather than defaulted, because "None" and "Not recorded" are different claims
 * and picking one silently is how the dash got here in the first place.
 *
 * `cls` is only for the visible half. `.sr-only` is defined in ui.css, which
 * every generated page already loads through shared/chrome.mjs.
 */
export const noValue = (reason, cls = "none") =>
  `<span class="${cls}" aria-hidden="true">&mdash;</span>` +
  `<span class="sr-only">${esc(reason)}</span>`;

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

/**
 * A rarity written the way the rest of the site writes it, which is Title Case.
 *
 * TCGdex is inconsistent at source and the inconsistency is inside a single
 * checklist: the same file carries "Ultra Rare" and "Double rare", so any page
 * that prints the field verbatim shows both shapes in one list. Every hand
 * written place already agrees on Title Case, so there is a form to match and
 * no need to invent one: the ladder in sync-sets.mjs and sync-intl-guides.mjs,
 * the rarity guide, and the rarities the sheet records in data/hits.json.
 *
 * Words that are not ordinary words keep the shape they are printed in. ACE
 * SPEC is an initialism, and V, VMAX and VSTAR are capitals on the card.
 *
 * A word that arrives ALREADY in full capitals is left alone, which is a rule
 * rather than a longer list because the list would never be finished. The
 * printings corpus carries "LEGEND", "Rare PRIME" and "Rare Holo LV.X", and
 * title casing those blind gives "Legend", "Rare Prime" and the plainly wrong
 * "Rare Holo Lv.x". Any word with a capital in it and no lower case letter is
 * an initialism or a name printed that way on the card, so passing it through
 * is the safe reading; the lookup above still exists for the inputs that
 * arrive lower case ("ace spec rare"), where there is nothing to preserve.
 *
 * Exported because the browser cannot import this module: build-cards.mjs
 * serialises the map and this function into /cards.html so its client side
 * search renders the same casing the server rendered. See the note there.
 */
export const RARITY_WORDS = { ace: "ACE", spec: "SPEC", v: "V", vmax: "VMAX", vstar: "VSTAR" };

export function rarityLabel(r) {
  if (!r) return null;
  return String(r)
    .trim()
    .split(/\s+/)
    .map((w) => {
      if (w === w.toUpperCase() && w !== w.toLowerCase()) return w;
      const k = w.toLowerCase();
      return RARITY_WORDS[k] || k.charAt(0).toUpperCase() + k.slice(1);
    })
    .join(" ");
}

/** Whole dollars, no cents at any size. Used by the grading fee tables. */
export function moneyRound(v) {
  const n = nOrNull(v);
  if (n === null) return "";
  return `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
}

/**
 * The width and height attributes for a remote card image, chosen by host.
 *
 * These attributes exist to reserve the right SHAPE before the image arrives.
 * A blanket rewrite once assumed every card scan on the site was a TCGdex
 * low.webp and declared 245x337 everywhere, which was right for 3,947 images
 * and wrong for 173: it gave low dimensions to TCGdex high scans, card
 * dimensions to TCGplayer product photos, and introduced a 1.46% error on the
 * Scrydex and Pokemon TCG API images, which really are 245x342. The commit
 * that did it was fixing a 1.5% error.
 *
 * So the size is decided from the url rather than assumed, and every figure
 * here was measured by fetching the files:
 *
 *   assets.tcgdex.net      low.webp 245x337, high.webp 600x825
 *   images.pokemontcg.io   245x342, _hires 733x1024, symbol 20x20
 *   images.scrydex.com     small 245x342, large 733x1024, symbol 20x20
 *   tcgplayer-cdn          VARIABLE, 200x268 through 200x417
 *
 * TCGplayer product photos get NO attributes. Their height depends on the
 * product, we do not hold it, and a fixed guess is wrong by up to 34%. They
 * sit in a CSS box of a fixed size with object-fit:contain, so nothing is
 * reserved by the attributes anyway.
 *
 * Returns a string ready to drop into a tag, with a leading space, or "".
 */
export function imgDims(url) {
  const u = String(url || "");
  if (!u) return "";
  const wh = (w, h) => ` width="${w}" height="${h}"`;
  if (/tcgplayer-cdn\.tcgplayer\.com/.test(u)) return "";
  if (/assets\.tcgdex\.net/.test(u)) return /\/high\.webp/.test(u) ? wh(600, 825) : wh(245, 337);
  if (/images\.pokemontcg\.io/.test(u)) {
    if (/symbol|logo/.test(u)) return "";
    return /_hires/.test(u) ? wh(733, 1024) : wh(245, 342);
  }
  if (/images\.scrydex\.com/.test(u)) {
    if (/symbol|logo/.test(u)) return "";
    return /\/large|\/hires/.test(u) ? wh(733, 1024) : wh(245, 342);
  }
  return "";
}

/**
 * Offer the same TCGdex art as AVIF, keeping the WebP as the fallback.
 *
 * TCGdex serves every scan at four extensions off one path, and nothing on this
 * site was asking for the smallest one. Measured over the 107 distinct TCGdex
 * urls on /wanted.html, /rarity.html and /pokemon/, fetched back to back:
 *
 *   all      webp 5,578KB   avif 3,622KB   -35.1%
 *   high.*   webp 3,850KB   avif 2,407KB   -37.5%
 *   low.*    webp 1,728KB   avif 1,216KB   -29.7%
 *
 * THE PIXELS ARE THE SAME AND THAT WAS CHECKED, not assumed, because a codec
 * swap that quietly softens card art would break the one thing this site is
 * for. Both files decode to identical dimensions (600x825 high, 245x337 low).
 * Decoded and diffed against each other over the exact window /rarity.html's
 * magnified corner paints, the crop-region PSNR is 30.4-32.2 dB across a holo
 * IR, a gold Mega Hyper Rare and a 1999 Base Set Charizard, and at 3x nearest
 * neighbour the rarity symbol, the regulation mark, the set code and the
 * illustrator credit are equally legible in both. TCGdex's own high.png is NOT
 * a usable reference for this, by the way: it is a PALETTED png, so both lossy
 * encodes score badly against it and the number says nothing.
 *
 * Support is the reason this is a <picture> and not a url swap. AVIF misses
 * Safari 16.0-16.3, and a card scan that fails to paint is a broken page, so
 * the <img> keeps the WebP untouched and non-AVIF browsers never see the
 * source. Everything already on the tag - srcset, sizes, loading, onerror,
 * width/height - stays on the <img> where it was.
 *
 * `picture{display:contents}` is in ui.css and is load bearing: without it the
 * <picture> is an inline box between the styled parent and the <img>, and every
 * `height:100%` and `width:100%` rule aimed at the img resolves against it
 * instead of against the box that was meant.
 *
 * Takes a rendered <img ...> tag and returns it wrapped, or unchanged when
 * there is no TCGdex WebP in it to convert.
 */
export function avifPicture(img) {
  const cand = /\ssrcset="([^"]*)"/.exec(img)?.[1] || /\ssrc="([^"]*)"/.exec(img)?.[1] || "";
  if (!/assets\.tcgdex\.net/.test(cand) || !/\.webp/.test(cand)) return img;
  const sizes = /\ssizes="([^"]*)"/.exec(img)?.[1];
  // Only TCGdex urls are rewritten. A srcset mixing hosts (Scrydex publishes no
  // AVIF at all) would otherwise get a source pointing at files that 400.
  if (/https?:\/\/(?!assets\.tcgdex\.net)/.test(cand)) return img;
  const avif = cand.replace(/\.webp/g, ".avif");
  return `<picture><source type="image/avif" srcset="${avif}"${
    sizes ? ` sizes="${sizes}"` : ""
  }>${img}</picture>`;
}
