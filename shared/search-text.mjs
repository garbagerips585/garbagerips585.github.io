/**
 * ONE TEXT-FOLDING RULE FOR EVERY SEARCH ON THIS SITE.
 *
 * WHY THIS FILE EXISTS. /videos.html and /cards.html have had a real matcher
 * since they were written: norm() folds accents, "&" and punctuation, parseQuery
 * ANDs the terms, and score() ranks an exact title over a substring. It lives
 * inside a closure in public/assets/app.js and is unreachable from anywhere
 * else.
 *
 * /search.html -- the page the magnifier and the mobile menu BOTH point at, and
 * the only site search that exists on a phone -- did not use any of it. Its
 * matcher was one line:
 *
 *     if (list[i][0].toLowerCase().indexOf(q) !== -1)
 *
 * Measured against real queries on 24 August 2026, that returned ZERO results
 * for: "Pokemon GO" (the way essentially everyone types it, because the set is
 * spelled Pokemon with an accent), "erikas invitation" (419 indexed cards carry
 * an apostrophe), "farfetchd", "scarlet and violet", "pitch-black" pasted out of
 * a url, and "charizard mega" -- which works in the other order. Each of those
 * is a thing norm() already fixed on the other two pages.
 *
 * THE SOURCE IS EXPORTED AS A STRING, WHICH LOOKS ODD AND IS THE POINT.
 * /search.html has no module loader: its matcher is an inline <script> written
 * by build-search.mjs. So the choice was to hand-copy the rules into a third
 * place, or to keep one copy and inline it. Hand-copying is how the two halves
 * drift, and this file's whole job is that they cannot: build-search.mjs inlines
 * NORM_SRC verbatim, and any change here reaches the page on the next build.
 *
 * IF YOU CHANGE THE FOLDING, IT MUST STAY SYMMETRIC. The query and the index
 * both go through it. The VMAX / VSTAR / V-UNION collapse is the worked example:
 * applying it to one side only re-creates the miss in the opposite direction,
 * and the note in app.js explains why at length.
 */

/** The folding rule, as source, for inlining into a page with no imports. */
export const NORM_SRC = `function norm(str){
  return String(str==null?"":str)
    .normalize("NFD").replace(/[\\u0300-\\u036f]/g,"")
    .toLowerCase()
    .replace(/['\u2019]/g,"")
    .replace(/&/g," and ")
    .replace(/[^a-z0-9]+/g," ")
    .replace(/\\s+/g," ")
    .trim()
    .replace(/\\bv (max|star|union)\\b/g,"v$1");
}`;

/**
 * Split a query into AND-ed terms, honouring "quoted phrases".
 * A term that matches nothing is still a term: every one has to hit.
 */
export const PARSE_SRC = `function parseQuery(raw){
  var q=norm(raw), out=[], m, re=/"([^"]+)"|(\\S+)/g;
  while((m=re.exec(q))) out.push(m[1]||m[2]);
  return out;
}`;

/**
 * Score one row against one term.
 *
 * THE TIERS ARE THE WHOLE FIX FOR THE NOISE. Substring-anywhere with no
 * weighting is what made "ir" return 335 rows and "psa" return Capsakid seven
 * times, and what buried Charizard under Charmander and Charmeleon for the query
 * "char" -- because the results came out in dex order and nothing said the
 * shorter, exactly-prefixed name was the better answer.
 *
 * `sub` is the row's third field, already shipped to the browser on every entry
 * and never previously consulted. Searching it costs zero extra bytes and is
 * what makes "does gamestop sell" find the page whose own subtitle is "Does
 * GameStop sell Pokemon cards?".
 */
export const SCORE_SRC = `function scoreRow(title,sub,term){
  var t=norm(title), s=sub?norm(sub):"";
  if(t===term) return 100;
  if(t.indexOf(term+" ")===0) return 40;
  if((" "+t).indexOf(" "+term)!==-1) return 25;
  if(t.indexOf(term)!==-1) return 12;
  if(s&&(" "+s).indexOf(" "+term)!==-1) return 4;
  if(s&&s.indexOf(term)!==-1) return 2;
  return 0;
}`;

/** A live copy for Node, so a builder can fold the same way it will be searched. */
export const norm = (str) =>
  String(str == null ? "" : str)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    // AN APOSTROPHE IS DELETED, NOT TURNED INTO A SPACE, and the difference is
    // two whole classes of query. Folding it to a space made "Erika's" into
    // "erika s", so a reader typing the natural "erikas invitation" matched
    // nothing -- and 419 indexed cards carry an apostrophe. Same for the species
    // page "Farfetch'd" against "farfetchd". Deleting it makes both spellings
    // land on one token from either side, which is the symmetry this whole file
    // exists to keep.
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bv (max|star|union)\b/g, "v$1");
