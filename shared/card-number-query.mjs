/**
 * A CARD NUMBER TYPED INTO A SEARCH BOX, 2 October 2026.
 *
 * The owner: "have the site match the cards exactly as thats how people will
 * look things up". Until today /cards.html matched a query against the card's
 * NAME and nothing else, so "113", "113/088" and "#113" all answered "Nothing
 * matched" for a Perfect Order card whose own corner reads 113/088, and the set
 * guides link to that search as "Search every card".
 *
 * TWO FUNCTIONS, AND BOTH SHIP TO THE BROWSER AS SOURCE. /cards.html and
 * /search.html have no module loader: their matchers are inline scripts written
 * by build-cards.mjs and build-search.mjs. So these are written in the same
 * plain style as rarityLabel and serialized with toString(), and each builder
 * proves the shipped copy against the imported one before it writes a page.
 * There is no second copy to keep in step.
 *
 * WHAT COUNTS AS A NUMBER. One token of up to four letters, one to four digits
 * and at most one trailing letter, optionally led by "#", optionally followed
 * by "/" and a total: 113, #113, 113/088, 18/72, SV107, SV107/SV122, GG44/GG70,
 * TG05, 79a, 4/102. The letter cap is what keeps "porygon2" a name: no card
 * number in the 39,707 printings has more than four letters in front (SWSH and
 * HGSS are the longest). A name token that does parse ("e4") costs nothing,
 * because both pages still run the plain name match beside the number match.
 *
 * ZEROS DO NOT MATTER, IN EITHER HALF. The key is cardNumKey's: one digit run,
 * its leading zeros dropped, letters kept and upper cased, so "018", "18" and
 * "0018" are one card and "TG05" is "TG5" whichever way the feed spells it.
 * build-cards.mjs asserts that, row by row, against every number in the corpus.
 */

/**
 * cardNumKey from shared/format.mjs, restated without the lookbehind. That
 * regex is a SyntaxError in Safari before 16.4, and one SyntaxError in an
 * inline script kills the whole search, not just the number half. Each digit
 * run loses its leading zeros and keeps its last digit, which is what the
 * lookbehind does; build-cards.mjs checks the two agree on every number in the
 * corpus before it writes the page.
 */
export function numKey(v) {
  return String(v == null ? "" : v).trim().toUpperCase().replace(/\d+/g, function (d) {
    return String(Number(d));
  });
}

/**
 * Pull the first card number out of a query. Returns null when there is none.
 *
 *   key    cardNumKey of the number ("113", "SV107", "79A")
 *   pre    its letter prefix, upper cased ("" for a plain number)
 *   n      its digits as a number (113)
 *   den    the total after a slash, as a number, 0 when none was typed
 *   denPre the total's own prefix ("SV" in SV107/SV122); a bare "/122" after
 *          a prefixed number takes the number's prefix, which is how the card
 *          prints it
 *   word   the number as typed, folded, for matching a set NAME ("151")
 *   denWord the total as typed ("088"), for saying it back to the reader
 *   text   everything else in the query, still to be matched as words
 */
export function parseCardNumber(raw) {
  var q = String(raw == null ? "" : raw).toLowerCase();
  // The total's digits are optional so that "113/" and "SV107/SV", which every
  // reader types on the way to "113/088", still read as 113 and SV107. Without
  // that the half-typed number falls through to the name search, and a query
  // starting with a digit sends it to the 872KB shard of Japanese names.
  var re = /(^|\s)#?([a-z]{0,4})(\d{1,4})([a-z]?)(?:\s*\/\s*#?([a-z]{0,4})(\d{0,4}))?(?=\s|$)/;
  var m = re.exec(q);
  if (!m) return null;
  var pre = m[2].toUpperCase(), suf = m[4].toUpperCase(), n = Number(m[3]);
  var start = m.index + m[1].length;
  var denPre = (m[5] || "").toUpperCase();
  if (m[6] && !denPre && pre) denPre = pre;
  return {
    key: pre + String(n) + suf,
    pre: pre,
    n: n,
    den: Number(m[6] || 0),
    denPre: denPre,
    word: m[2] + m[3] + m[4],
    denWord: Number(m[6] || 0) ? (m[5] || "") + m[6] : "",
    text: (q.slice(0, start) + " " + q.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim(),
  };
}

/**
 * The number the way the card prints it, given what we know about its set.
 *
 * `meta` is [released, printedTotal, promo, subsetTotals] from
 * public/data/card-numbers/sets.json, or nothing. With nothing, or for a
 * promo (which prints no total at all), the feed's own string comes back
 * untouched: a number we cannot complete is shown as we hold it, never guessed.
 *
 *   modern (Sword & Shield on, 7 February 2020): 018/072, 113/088, TG05/TG30,
 *     GG44/GG70, SV107/SV122. Three digits, because that is what those cards
 *     print and what printedNo() in shared/format.mjs does for the set guides.
 *   older: 4/102, unpadded, because that is what those cards print. A
 *     subset number on an older card (Hidden Fates SV49, Skyridge H01) is
 *     left without a total, because the feed's padding there is not the
 *     card's and the honest answer is the part we can vouch for.
 */
export function printedForm(num, meta) {
  var s = String(num == null ? "" : num);
  if (!meta || meta[2]) return s;
  var x = /^([A-Za-z]*)(\d+)$/.exec(s);
  if (!x) return s;
  var modern = String(meta[0] || "") >= "2020-02-07";
  if (!x[1]) {
    if (!meta[1]) return s;
    if (!modern) return s + "/" + meta[1];
    var w = Math.max(3, x[2].length);
    var pad = function (v) { v = String(v); while (v.length < w) v = "0" + v; return v; };
    return pad(x[2]) + "/" + pad(meta[1]);
  }
  var sub = meta[3] && meta[3][x[1].toUpperCase()];
  if (!modern || !sub) return s;
  var t = String(sub);
  while (t.length < x[2].length) t = "0" + t;
  return s + "/" + x[1] + t;
}

/** Source for the two inline scripts. */
export const CARD_NUMBER_SRC =
  `var numKey = ${numKey.toString()};\n` +
  `var parseCardNumber = ${parseCardNumber.toString()};\n` +
  `var printedForm = ${printedForm.toString()};`;
