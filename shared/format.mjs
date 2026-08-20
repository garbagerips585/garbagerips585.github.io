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
 * A view count, abbreviated: "1", "896", "1.5K", "15K", "1.5M".
 *
 * THERE WERE FIVE COPIES OF THIS and no two agreed on everything. `niceViews`
 * in build-pages.mjs, `compact` in build-proto.mjs, `compactViews` in
 * build-playlists.mjs, `fmtViews` in build-proto.mjs (serialised into the page
 * for the client renderer) and `fmtViews` in public/assets/app.js. Two of them
 * carried a comment saying they matched a third; both comments were written
 * after a drift was found by hand, and both were wrong again by the time this
 * was written:
 *
 *   n >= 1e6    fixed once already, and it held. All copies said "1.5M".
 *   n >= 10000  STILL DISAGREED. build-pages and the two fmtViews rounded to
 *               one decimal forever; build-proto's compact and
 *               build-playlists' compactViews dropped the decimal above ten
 *               thousand. A video at 15,500 would read "15.5K views" on its own
 *               page and "16K VIEWS" on every tile linking to it.
 *   n === 1     ALL FIVE were wrong, and this one is live rather than latent.
 *               See viewCount below.
 *
 * One decimal below ten thousand and none above it is what two of the five did
 * and it is the better rule: "15.5K" is false precision at that size, "1.5K"
 * is not.
 *
 * public/assets/app.js cannot import this module, so it keeps its own copy and
 * a comment pointing here. That copy and this one have to stay in step: the
 * server renders the first tiles and app.js renders every tile after a filter,
 * so a difference shows up as two spellings in one grid.
 */
export function compactCount(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(v < 1e4 ? 1 : 0).replace(/\.0$/, "")}K`;
  return String(v);
}

/**
 * A view count with its noun, agreeing in number: "1 view", "896 views".
 *
 * Every copy wrote `n + " views"`, and the channel has a video sitting at
 * exactly one view, so its own page read "1 views" and its tiles on the home
 * page, /videos.html and a playlist page read "1 VIEWS". It is the newest
 * upload that lands on 1, which is the tile at the top of Latest rips, so this
 * is the most visible cell on the site rather than an obscure one. Only the
 * bare integers can be 1: "1.5K" and "1.5M" are already plural.
 *
 * Returns "" for a missing or zero count rather than "0 views", which is what
 * three of the five callers already did by guarding at the call site. A tile
 * reading "0 VIEWS" under a video uploaded ten minutes ago is worse than a
 * tile that simply shows its date.
 *
 * Callers that want capitals uppercase the whole string. That is why the noun
 * is not a parameter: one caller per casing is exactly how five copies of a
 * six line function came to exist.
 */
export const viewCount = (n) =>
  Number(n) > 0 ? `${compactCount(n)} view${Number(n) === 1 ? "" : "s"}` : "";

/**
 * A noun that agrees with the number in front of it.
 *
 * `viewCount` above fixed exactly one instance of this bug in five copies. The
 * bug itself is not about views: it is about every count on this site that is
 * DERIVED, because a derived count sits at 1 exactly as easily as it sits at 57,
 * and nobody previews the page on the day it does. A QA sweep of the live site on
 * 18 August 2026 found five more, all in stat tiles, and all on pages whose PROSE
 * was already correct because a human wrote the prose and a template wrote the
 * tile:
 *
 *     /openings/                  "13 kinds, 316 openings, 1 packs counted"
 *     /openings/etb.html          "1 Packs counted, across 1 of them"
 *     /openings/chinese-pack.html "1 Different sets"
 *     /sets/celebrations.html     "What those 1 are worth", "Cards holding half
 *     /sets/phantasmal-flames.html  the value" over a 1
 *
 * THE PACK COUNTS ARE WHY THEY ALL APPEARED AT ONCE. 244 inferred pack counts
 * were withheld on 18 August 2026 pending Tim's filled sheet, so a site-wide
 * total that had been in the hundreds became 1 overnight and four tiles started
 * reading as broken. Nothing about those tiles changed. Assume every count you
 * print can be 1 tomorrow.
 *
 * `plural(1, "pack")` -> "pack". `plural(0, "pack")` -> "packs", because zero
 * takes the plural in English and "0 pack" is the same bug pointing the other
 * way. Irregulars pass their own plural: `plural(n, "is", "are")`.
 *
 * It returns the NOUN ONLY and never the number, so a caller can put the count in
 * its own element, which is exactly what a stat tile does: the count is in `.n`
 * and the label is in `.l`, and a helper that returned "1 pack" could not be used
 * by any of the five callers that needed it. `count()` below is for the callers
 * that do want both words in one string.
 */
export const plural = (n, one, many) => (Number(n) === 1 ? one : many ?? `${one}s`);

/** The number and its noun, agreeing: "1 pack", "9 packs", "0 packs". */
export const count = (n, one, many) => `${n} ${plural(n, one, many)}`;

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

/**
 * THE CONTROL ON EVERY VIDEO ARTWORK ON THIS SITE, in one string.
 *
 * It is the banner the rip pages have always carried across the foot of the
 * sealed pack, and since 19 August 2026 it is the only affordance any video
 * artwork gets: Tim asked for "just that one banner acorss the bottom" and for
 * the "Rip it open" pills under the carousel slides to go entirely. The rules
 * are `.pack-hint` in assets-source/ui.css, written once for the rip page and
 * re-used here rather than reimplemented.
 *
 * THE WORDS ARE NOT A CHOICE MADE HERE. They are what build-pages.mjs already
 * prints on 316 rip pages, and they are what Tim pointed at. If they ever
 * change they change in both places, which is most of the reason this constant
 * exists rather than four literals in two builders.
 *
 * aria-hidden BECAUSE THE LINK ALREADY HAS A NAME. Every tile is one anchor
 * whose accessible name is the video's full title; the Hall of Fame trophy has
 * no aria-label and takes its name from its contents, so an unhidden banner
 * there would prepend "CLICK TO RIP THE PACK" to the name of the card the
 * page is about. Hidden, the accessible name of every video link on the site is
 * byte for byte what it was before this change.
 *
 * THE SEVENTH COPY IS NOT HERE AND CANNOT BE. public/assets/app.js draws
 * /videos.html's grid in the browser and is a plain script with no imports, so
 * it builds the same element by hand. It is the emitter that gets missed; if
 * you edit this string, edit that one in the same commit.
 */
export const RIP_BANNER =
  `<span class="pack-hint" aria-hidden="true">CLICK TO RIP THE PACK</span>`;

/**
 * THE GARBAGE PLATE, DRAWN RATHER THAN PHOTOGRAPHED, and the only picture on
 * this site that is not a card, a pack, a logo or a Pokemon.
 *
 * Tim asked for "little Garbage Plates and little Trubbish and Garbador images
 * to the sites pages ... to add charm and give the site its identity". The
 * channel is named after this dish, the commissioned banner has one sitting
 * beside Trubbish, /lore.html opens its mascot section by naming it and
 * /about.html says the city is "home of the Garbage Plate", and there was no
 * picture of one anywhere in the tree.
 *
 * IT IS AN INLINE SVG AND THAT IS THE WHOLE REASON IT IS AFFORDABLE. A file
 * would be a request per page and a fixed rendition; this is 1,771 bytes of
 * markup, it is sharp at any size, and it needs no round trip. The site already
 * draws 492 evolution chains, a set of rarity symbols and a 5x7 bitmap alphabet,
 * so the muscle was there.
 *
 * WHAT IT ACTUALLY COST, measured on the built pages against the same four
 * files at HEAD, gzip -9 because that is roughly what the host serves:
 *
 *                       raw                     gzipped
 *     /buying.html    159,771 -> 161,843       40,912 -> 41,649    +737
 *     /selling.html   135,624 -> 137,696       34,293 -> 35,023    +730
 *     /grading.html    53,679 ->  55,754       13,602 -> 14,458    +856
 *     /shops.html      53,819 ->  55,890       14,222 -> 14,907    +685
 *
 * So +2,072 raw on every one of them, which is the ornament plus PLATE_CSS,
 * and between 685 and 856 gzipped. Nothing else on the site moved a byte:
 * these are the only four pages that call it, and ui.css is untouched.
 *
 * THE SHAPE IS THE REAL DISH AND IT WAS TRACED OFF OUR OWN BANNER. Open
 * public/assets/banner-trubbish.jpg and look at the bottom right corner: a
 * wide shallow plate seen from just above the table, macaroni salad heaped on
 * one side, potato on the other, meat hot sauce poured over the top of the
 * seam, chopped onions on the sauce, a stripe of mustard over the lot, and
 * some of it on the rim. Five layers, because a Garbage Plate that reads as
 * one tidy portion is not a Garbage Plate. The banner draws shoestring fries
 * and this draws chunky home fries, which is the half of the dish the banner
 * takes a liberty with. It is deliberately not a bin and not a generic dinner.
 *
 * THE CHINA IS THE PALETTE AND THE FOOD IS NOT, which is the rule CLAUDE.md
 * already applies to the eighteen pack skins and the Base Set schematic: a
 * drawing of a real product keeps its own colours. So the plate itself takes
 * var(--ink) and moves with any repaint, and the mac, the potato, the sauce
 * and the mustard are literal and stay food coloured. The fallback in the
 * var() is there because this string is also readable outside a page.
 *
 * aria-hidden BECAUSE IT SAYS NOTHING THE COPY DOES NOT. Every placement sits
 * beside a heading or a paragraph that already names Rochester or the dish,
 * so a label here would be read out twice. Same call as .flower and RIP_BANNER.
 *
 * NOTHING IN IT MOVES, at any setting, so prefers-reduced-motion has nothing to
 * honour. Do not give it a hover transform: two of the placements sit inside
 * running prose where a moving ornament would pull the eye off the sentence.
 */
export function plateMark(px = 84) {
  return (
    `<svg class="gplate" width="${px}" height="${Math.round(px * 0.58)}" viewBox="0 0 200 116" aria-hidden="true" focusable="false">` +
    `<g stroke="#231F20" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">` +
    `<ellipse cx="100" cy="88" rx="92" ry="22" fill="var(--ink,#E4DCCC)"/>` +
    `<path d="M22 92c-2-20 10-36 32-38 22-2 42 12 44 30 1 8 0 8 0 8z" fill="#F2E9CD"/>` +
    `<g stroke="#AC9D71" stroke-width="3.4" fill="none">` +
    `<path d="M30 84a8 8 0 0 1 13-3"/><path d="M48 78a8 8 0 0 1 13-3"/>` +
    `<path d="M66 84a8 8 0 0 1 13-3"/><path d="M38 68a8 8 0 0 1 13-3"/>` +
    `<path d="M58 62a8 8 0 0 1 13-3"/><path d="M76 72a8 8 0 0 1 13-3"/></g>` +
    `<g fill="#DFA93C" stroke-width="3.4">` +
    `<path d="M98 90l18-6 5 12-18 6z"/><path d="M120 84l20-5 4 13-20 5z"/>` +
    `<path d="M144 86l18-7 5 12-18 7z"/><path d="M110 72l19-6 5 12-19 6z"/>` +
    `<path d="M134 68l19-5 4 13-19 5z"/><path d="M156 74l14-7 6 11-14 7z"/></g>` +
    `<path d="M44 58c-4-14 6-24 18-24 6-12 26-16 36-8 12-10 32-4 34 8 14 0 22 12 16 22 2 10-8 16-16 12-6 8-20 8-26 2-8 8-22 8-28 0-10 6-22 2-26-6z" fill="#7A4526"/>` +
    `<g fill="#5C3318" stroke="none">` +
    `<ellipse cx="70" cy="48" rx="7" ry="4.5"/><ellipse cx="126" cy="40" rx="6" ry="4"/>` +
    `<ellipse cx="100" cy="58" rx="8" ry="4.5"/></g>` +
    `<g stroke="#F8F3E4" stroke-width="3.4" fill="none">` +
    `<path d="M78 34a9 5 0 0 1 15 1"/><path d="M108 28a9 5 0 0 1 15 1"/>` +
    `<path d="M132 50a9 5 0 0 1 14 1"/><path d="M60 60a9 5 0 0 1 14 1"/>` +
    `<path d="M94 48a9 5 0 0 1 14 1"/></g>` +
    `<path d="M56 52c12-10 20 6 32-4s22 10 34-2 18 6 24 0" fill="none" stroke="#EFBB25" stroke-width="4.5"/>` +
    `<path d="M8 88a92 22 0 0 0 184 0" fill="var(--ink,#E4DCCC)"/>` +
    `<path d="M30 86a70 13 0 0 0 140 0" fill="none" stroke-width="3"/>` +
    `<path d="M148 98l13-5 4 9-13 5z" fill="#DFA93C" stroke-width="3.4"/>` +
    `<path d="M40 100a7 7 0 0 1 12-3" stroke="#AC9D71" stroke-width="3.4" fill="none"/>` +
    `</g></svg>`
  );
}

/**
 * The plate as a SECTION ORNAMENT, which is the form three of the five
 * placements take: a fleuron centred on a hairline between two topics.
 *
 * A fleuron is a typographic device rather than a sticker, and that is the
 * whole argument for it here. /buying.html is 48,825px tall at 390x844 with
 * TWO 22px glyphs on it, because the 26 retailer marks on that page are
 * display:none below 545px, so a phone reader gets 36,525px of unbroken prose
 * before the first picture. A mascot dropped into the middle of that would
 * read as pasted on; a rule with a mark on it reads as the page taking a
 * breath, and it lands on a seam the writing already made.
 *
 * ONE PER PAGE. Six of these down a long page is a pattern fill and stops
 * being charm about four screens in, which is the failure this whole pass was
 * briefed to avoid.
 *
 * THE HAIRLINES ARE PSEUDO ELEMENTS so the ornament is one element in the
 * markup and cannot be half copied into a page that then styles it itself.
 *
 * AND IT IS CAPPED AT 560px AND LEFT ALIGNED, WHICH IS THE FIX FOR THE ONLY
 * THING THAT LOOKED WRONG WHEN THIS WAS FIRST BUILT, AND THE FIX FOR THE FIRST
 * FIX. Uncapped it takes the whole band, which is 1,392px at 1440x900, and an
 * 84px mark in the middle of 1,392px of hairline is a rule with a speck on it
 * rather than an ornament. Capping it and CENTRING it was worse in a different
 * way: every heading and every paragraph on all four of these pages is left
 * aligned, so a centred 560px ornament in a 1,280px band sat 350px right of
 * the column it was meant to be punctuating. Left aligned it starts on the
 * same vertical as the h2 under it.
 *
 * NOTHING ABOUT THE PHONE MOVED THROUGH ANY OF THAT. The wrap at 390 is
 * narrower than the cap, so the ornament fills the column exactly as it did.
 */
export const plateRule = (px = 84) =>
  `<div class="plate-rule">${plateMark(px)}</div>`;

/**
 * The rules plateRule needs, for a page's own style block.
 *
 * DELIBERATELY NOT IN ui.css. That file is render blocking on all 1,483 pages
 * and this ornament is on five, so a shared rule would charge 1,478 pages for
 * something they never draw. Interpolated per page instead, which is the same
 * trade build-buying.mjs's miniCSS note already argues for that page's own CSS.
 */
export const PLATE_CSS = `.plate-rule{display:flex;align-items:center;gap:var(--s4);max-width:560px;margin:var(--s7) 0 var(--s6)}
.plate-rule::before,.plate-rule::after{content:"";flex:1;height:2px;border-radius:2px;background:var(--keyline);opacity:.5}
.plate-rule svg{flex:none;display:block}`;

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
 * ONE CARD NUMBER, COMPARABLE ACROSS FEEDS THAT PAD IT DIFFERENTLY.
 *
 * TCGdex writes Pokemon GO's Mewtwo VSTAR as "079" and api.pokemontcg.io writes
 * the same card as "79", so `String(a) === String(b)` between the two is false
 * for every card numbered 1 to 99. 24 of the 28 English checklists are padded to
 * three digits and the API pads none of them, so the join that gives a chase
 * card the checklist's word for its rarity fired on 2,816 of 5,181 cards and
 * missed the rest in silence. What a reader saw was three Pokemon GO cards
 * labelled "Rainbow Rare" on twelve rip pages while /sets/pokemon-go.html, which
 * reads the checklist directly, called the same three cards "Secret Rare".
 *
 * WHY NOT parseInt, AND WHY NOT A BLANKET ZERO STRIP. A card number is not an
 * integer. Promos and secret rares are printed "TG05", "SV001", "H12" and
 * "079a", and both shortcuts destroy at least one of those:
 *
 *   parseInt("079a")     -> 79, which is a DIFFERENT card in the same set
 *   parseInt("TG05")     -> NaN, so every TG card collapses onto one key
 *   "SV001".replace(/^0+/) -> unchanged, because the zeros are not leading
 *
 * So the zeros are stripped per digit RUN, in place, and everything around them
 * is kept: letters stay, suffixes stay, position stays.
 *
 *   079 -> 79    79 -> 79     TG05 -> TG5   SV001 -> SV1
 *   H12 -> H12   079a -> 79A  000 -> 0      "" -> ""
 *
 * "079a" keeps its A, so it cannot collide with 79. "TG5" keeps its TG, so it
 * cannot collide with 5. The lookbehind is what makes it per-run rather than
 * leading-only: without it "TG05" is untouched because the 0 is not at the
 * start, which is the case a leading-zero strip quietly gets wrong.
 *
 * Upper cased so a suffix letter is not the thing two feeds disagree about.
 * Checked against the data on 15 August 2026: no two cards in any of the 28
 * checklists collapse onto one key, and no two in any API set either.
 *
 * ONE UPSTREAM COLLISION EXISTS AND IT IS NOT THIS FUNCTION'S DOING.
 * api.pokemontcg.io ships Black Bolt twice-numbered: zsv10pt5-60 (Escavalier)
 * and zsv10pt5-80 (Antique Cover Fossil) both carry number "60". Neither is
 * priced anywhere near the top eight, so neither reaches a chase list today, but
 * a `find` on that number answers Escavalier for both.
 */
export const cardNumKey = (v) =>
  String(v ?? "").trim().toUpperCase().replace(/(?<![0-9])0+(?=[0-9])/g, "");

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
 * Casing is only half the job. The last step is a whole-string lookup in
 * RARITY_ALIAS below, which is what stops three feeds naming one tier three
 * ways; the reasoning is with the map.
 *
 * Exported because the browser cannot import this module: build-cards.mjs
 * serialises BOTH maps and this function into /cards.html so its client side
 * search renders the same names the server rendered. See the note there.
 */
export const RARITY_WORDS = { ace: "ACE", spec: "SPEC", v: "V", vmax: "VMAX", vstar: "VSTAR" };

/**
 * ONE NAME PER TIER, WHOLE STRING IN AND WHOLE STRING OUT.
 *
 * Three feeds describe the same ladder and none of them agree. TCGdex, which
 * writes public/data/cards/*.json and is therefore the checklist a reader can
 * count down the page, says "Holo Rare V" and "Secret Rare". api.pokemontcg.io,
 * which fills a set that has no checklist yet, says "Rare Holo V", "Rare Ultra",
 * "Rare Secret" and "Rare Rainbow" for the same four things. So /sets/ once
 * printed "Rare Holo V" on Crown Zenith and "Holo Rare V" on Pokemon GO, two
 * adjacent Sword and Shield guides naming one tier two ways, and every name in
 * the right hand column above was missing from the sort order and fell BELOW
 * Common with its chase highlight stripped.
 *
 * THE OBVIOUS FIX IS THE WRONG ONE. A rule that moves a leading "Rare" to the
 * end fixes all four of those and destroys others in the same pass: the
 * printings corpus carries "Rare Holo LV.X" on 59 cards and "Rare PRIME" on 26,
 * which would come out as "Holo LV.X Rare" and "PRIME Rare". Nobody says those.
 * The same rule is waiting for "Rare Holo Star", which is a real rarity on
 * older cards and is not in this site's data today, so nothing catches it until
 * a set that has it arrives. A whole-string map cannot reach a name it was not
 * told about, so all of them are untouched by construction rather than by a
 * guard somebody has to remember.
 *
 * THE RIGHT HAND SIDE IS NOT A NEW VOCABULARY. Every one of these is a name
 * the site already prints. /rarity.html carries "Holo Rare" as an offLadder
 * entry and says in so many words that some checklists print the same tier the
 * other way round as "Rare Holo"; data/rarity.json's readme names "Holo Rare V,
 * VMAX and VSTAR" and "Secret Rare" as the strings this site's own checklists
 * use; and the retired-mechanics list calls the rainbow tier "Rainbow rares",
 * which is where "Rainbow Rare" comes from. The API's word order is not the
 * site's voice and is the only thing being dropped.
 *
 * NOTHING IS MERGED THAT THE SOURCES CARVE UP DIFFERENTLY. TCGdex files the
 * Sword and Shield rainbow cards under Secret Rare and the API gives them a
 * tier of their own; aliasing "Rare Rainbow" onto "Secret Rare" would silently
 * fold two API tiers into one and change a count. It gets its own rung instead.
 *
 * Keyed on the Title Cased form, because that is what rarityLabel has already
 * produced by the time the lookup happens.
 */
export const RARITY_ALIAS = {
  "Rare Holo": "Holo Rare",
  "Rare Holo V": "Holo Rare V",
  "Rare Holo VMAX": "Holo Rare VMAX",
  "Rare Holo VSTAR": "Holo Rare VSTAR",
  "Rare Ultra": "Ultra Rare",
  "Rare Secret": "Secret Rare",
  "Rare Rainbow": "Rainbow Rare",
};

/**
 * The rungs, most chase-worthy first. sync-sets.mjs copies this into
 * sets.json as `rarityOrder` and the set guides sort their ladders by it.
 *
 * EVERY NAME A SET GUIDE CAN PRINT HAS TO BE HERE. build-set-pages.mjs used to
 * give an unknown name index 99, which put it BELOW Common and took its chase
 * highlight away, and did so in silence: Black Bolt sorted its two Black White
 * Rares, the $604 and $602 cards that are the whole reason to open the set,
 * under 39 commons, and Paldean Fates did the same to 120 of its 245 cards. It
 * is a hard failure now, checked in build-set-pages.mjs against both
 * public/data/sets.json and public/data/cards/*.json, so the next set cannot
 * reintroduce it quietly.
 *
 * WHERE THE NEW RUNGS SIT, and the evidence, all read out of the checklists in
 * public/data/cards on 15 August 2026. These are checklist composition and
 * prices, which the site publishes everywhere. They are not odds and say
 * nothing about what a pack contains.
 *
 * A "median" below is the median of the per-set medians, so one enormous set
 * cannot outvote the rest, and it is only ever compared against another figure
 * worked out the same way.
 *
 *   Black White Rare   only Black Bolt and White Flare print it, and in both it
 *                      is the top of the set by a distance: median $604 and
 *                      $560 against $48 and $54 for the Special Illustration
 *                      Rares beneath. It never appears beside Mega Hyper Rare,
 *                      Hyper Rare or Secret Rare, so it is at the top of the
 *                      list without that ordering ever being exercised.
 *   Rainbow Rare       Sword and Shield secret tiers, above Ultra Rare, which
 *   Secret Rare        the numbers agree with: $9.88 for Secret Rare against
 *                      $2.53 for Ultra Rare, and they share six sets, in five
 *                      of which Secret Rare is the higher of the two. No set
 *                      here prints both Rainbow Rare and Secret Rare under the
 *                      checklist vocabulary, so their order relative to each
 *                      other is not exercised. Rainbow Rare has no rung earned
 *                      by evidence, only a name and a place beside its cousin;
 *                      it is here so the API's "Rare Rainbow" has somewhere to
 *                      land on the day a set arrives before its checklist does.
 *   Shiny Rare         Paldean Fates only, and this pair is deliberately the
 *   Shiny Ultra Rare   opposite way round from what the names suggest, because
 *                      the set's own prices say so at every quartile: Shiny
 *                      Rare runs $1.90 / $2.85 / $4.52 / $8.94 / $80.87 and
 *                      Shiny Ultra Rare $1.04 / $1.32 / $2.52 / $6.01 / $31.99.
 *                      One set is thin evidence, so if a second set ever prints
 *                      them, check this again rather than trusting it.
 *   Holo Rare VSTAR    medians $4.17, $3.30 and $0.99 across the six Sword and
 *   Holo Rare VMAX     Shield sets, in that order, which is also the order the
 *   Holo Rare V        mechanic escalated in. None of them appears beside
 *                      Double Rare, which is the Scarlet and Violet tier that
 *                      replaced them.
 *   Holo Rare          takes the slot "Rare Holo" already held, one above Rare,
 *                      which its $0.43 median against Rare's $0.27 supports.
 */
export const RARITY_ORDER = [
  "Black White Rare", "Mega Hyper Rare", "Hyper Rare", "Rainbow Rare", "Secret Rare",
  "Special Illustration Rare", "Illustration Rare", "Shiny Rare", "Shiny Ultra Rare",
  "Ultra Rare", "Holo Rare VSTAR", "Holo Rare VMAX", "Holo Rare V", "Double Rare",
  "ACE SPEC Rare", "Radiant Rare", "Amazing Rare", "Holo Rare", "Rare", "Uncommon", "Common",
];

export function rarityLabel(r) {
  if (!r) return null;
  const t = String(r)
    .trim()
    .split(/\s+/)
    .map((w) => {
      if (w === w.toUpperCase() && w !== w.toLowerCase()) return w;
      const k = w.toLowerCase();
      return RARITY_WORDS[k] || k.charAt(0).toUpperCase() + k.slice(1);
    })
    .join(" ");
  return Object.prototype.hasOwnProperty.call(RARITY_ALIAS, t) ? RARITY_ALIAS[t] : t;
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
 *   images.pokemontcg.io   245x342, _hires 733x1024
 *   images.scrydex.com     small 245x342, large 733x1024
 *   tcgplayer-cdn          VARIABLE, 200x268 through 200x417
 *
 * TCGplayer product photos get NO attributes. Their height depends on the
 * product, we do not hold it, and a fixed guess is wrong by up to 34%. They
 * sit in a CSS box of a fixed size with object-fit:contain, so nothing is
 * reserved by the attributes anyway.
 *
 * SET SYMBOLS AND SET LOGOS ARE NOT CARD SCANS and get nothing from here. This
 * comment used to claim both hosts publish symbols at 20x20, which is the size
 * they are DRAWN at and not the size they are served at: base1 is 884x452 and
 * most of the legacy sets are 500x500. The number was never used, because the
 * guards below return "" for symbol and logo urls, but it read as a measured
 * fact next to a column of genuinely measured ones. The real sizes now live in
 * data/symbol-dims.json, written by scripts/sync-symbols.mjs, which mirrors
 * them locally at the size they are actually painted.
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
 * THE AVIF ALWAYS EXISTS, and that is checked rather than assumed, because a
 * <source> pointing at a 404 is worse than no source at all: the browser has
 * already committed to that source by the time it fails, so several render a
 * broken image rather than falling back to the <img>. On 2026-08-15 all 533
 * distinct TCGdex urls the built site emits were fetched as both extensions:
 * 533 of 533 webp answered 200 and 533 of 533 avif answered 200, at -29.7% for
 * low.* and -37.2% for high.*, which is the 2026-08-14 measurement below
 * reproduced on a four times larger sample. The guarantee is structural, not
 * lucky: TCGdex encodes all four extensions off one path, so the only way to
 * ask for an AVIF that does not exist is to ask for a scan that does not
 * exist, and those are already skipped from data/no-scan.json.
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
 * OUR OWN PACK ART GOES THROUGH THE SAME HELPER, added 16 August 2026, and it
 * is the second of exactly two url shapes this function will touch. Everything
 * above is about a third party's CDN; the packs are files build-packs.py wrote,
 * and it writes .webp and .avif together for every rendition, so the same
 * "the AVIF always exists" guarantee holds for a different reason. Measured on
 * the generated files, AVIF q60 against WebP q78: 810w paradox-rift 150.6 ->
 * 123.1KB and default 129.6 -> 96.9KB, at a HIGHER PSNR than the WebP, so this
 * is 18 to 25% off with no sharpness to trade. Unlike the 560w rendition, which
 * only a DPR 1 desktop can pick, a smaller codec shrinks whichever candidate the
 * browser was already going to choose, so it pays on a retina laptop and on a
 * phone too.
 *
 * `opts.defer` IS FOR THE CAROUSEL AND IT IS THE HALF THAT IS EASY TO GET
 * WRONG. Slides past the first carry their art as data-packsrc/data-packsrcset
 * so a slide parked sideways does not fetch it (loading="lazy" is a vertical
 * heuristic and cannot see that; see the note in heroTile). A <source> with a
 * real `srcset` DEFEATS THAT COMPLETELY: a <picture> whose source matches loads
 * that source even when the <img> has no src at all, so the deferred slide would
 * fetch its AVIF at first paint and the whole mechanism would be back to
 * fetching every slide, in a new format. So under `defer` the source's
 * candidates are deferred with the image's, under the SAME data- names, and
 * hydrateSlides in packplayer.js promotes the source before the img.
 *
 * Takes a rendered <img ...> tag and returns it wrapped, or unchanged when
 * there is no convertible WebP in it.
 */
export function avifPicture(img, opts) {
  const o = opts || {};
  // Which attributes carry the candidates. Under `defer` both the <img> and the
  // <source> hold theirs under data- names and neither is live yet.
  const A = o.defer
    ? { srcset: "data-packsrcset", src: "data-packsrc", sizes: "data-packsizes" }
    : { srcset: "srcset", src: "src", sizes: "sizes" };
  const attr = (n) => new RegExp(`\\s${n}="([^"]*)"`).exec(img)?.[1];
  const cand = attr(A.srcset) || attr(A.src) || "";
  if (!/\.webp/.test(cand)) return img;
  const tcgdex = /assets\.tcgdex\.net/.test(cand);
  // Our own pack renditions, relative to the page. build-packs.py guarantees the
  // .avif sibling of every .webp it writes.
  const packs = /(^|[\s,])assets\/packs\/[^\s,"]+\.webp/.test(cand);
  if (!tcgdex && !packs) return img;
  // Only TCGdex urls are rewritten. A srcset mixing hosts (Scrydex publishes no
  // AVIF at all) would otherwise get a source pointing at files that 400. A pack
  // srcset must be entirely local for the same reason.
  if (tcgdex && /https?:\/\/(?!assets\.tcgdex\.net)/.test(cand)) return img;
  if (packs && (tcgdex || /https?:\/\//.test(cand))) return img;
  const sizes = attr(A.sizes);
  const avif = cand.replace(/\.webp/g, ".avif");
  return `<picture><source type="image/avif" ${A.srcset}="${avif}"${
    sizes ? ` ${A.sizes}="${sizes}"` : ""
  }>${img}</picture>`;
}

/**
 * The artwork inside a GRID TILE'S pack facade, as a <picture>.
 *
 * A CSS BACKGROUND CAN NEVER BE LAZY, which is the whole reason this exists.
 * The pack facade is built from .pack-face halves whose .pack-art carried the
 * artwork as a background-image in packs.css, and Chrome fetches a background
 * for any element in the render tree whether or not the reader ever scrolls to
 * it. Measured on 20 August 2026 with no scroll at all and a 15 second wait,
 * cache off: /videos.html pulled all SEVEN of its distinct tile files, 279.7KB,
 * with 4 of its 48 tiles above the fold at 390x844; /playlists.html pulled all
 * TWELVE, 477.2KB, with 4 of 22 above the fold. A 2.5 second window shows only
 * two or three of them and reads like the browser is already deferring the
 * rest. It is not. Wait for the network to go quiet before believing that.
 *
 * This is the same move /rarity.html's magnified corners made when they went
 * from 2,536KB to 388KB on load: the facade stays exactly as it was and the
 * picture underneath it becomes an element the browser can defer.
 *
 * TILE RENDITION ONLY. build-packs.py writes a 400x711 -tile file next to the
 * 810x1440 master, and a grid tile is never wider than about 220 CSS px, so the
 * master would be a 4x oversample. The rip page's own hero pack is NOT this
 * element and is deliberately left as a background: it is above the fold on
 * every rip page, it is that page's LCP element, and it is preloaded by name.
 *
 * EVERY ONE OF THEM IS LAZY, INCLUDING THE ONES IN THE FIRST VIEWPORT, AND
 * THAT IS THE OPPOSITE OF WHAT THIS WAS FIRST BUILT TO DO. CLAUDE.md records
 * that a lazy image inside the first screen is a timing bug: the browser
 * fetches it immediately anyway because it can see it, so the attribute moves
 * no bytes and costs the preload scanner. Both halves of that are true here.
 * What it leaves out is that the preload scanner is not always the thing you
 * want, and a decorative thumbnail is the case where it is not.
 *
 * MEASURED BOTH WAYS, 20 August 2026, Slow 4G plus a 4x CPU slowdown at 390x844
 * DPR 2, cache off, five runs, medians, over HTTP/2 because that is what the
 * host serves and an HTTP/1.1 preview has a six connection ceiling that flatters
 * this the wrong way:
 *
 *                              /videos.html LCP     /playlists.html FCP and LCP
 *     backgrounds, as it was        4,112ms                  2,732ms
 *     first four tiles eager        4,704ms                  3,480ms
 *     every tile lazy               4,112ms                  2,732ms
 *
 * The on-load byte figures for the middle row and the bottom row are IDENTICAL,
 * to a tenth of a kilobyte, on every page and both viewports. So eager bought
 * nothing and cost between 588 and 748ms of first paint on a phone. The reason
 * is that an eager tile is discovered during the HTML parse and spends the
 * pipe the render-blocking stylesheet and the fonts are still waiting on, while
 * a lazy one the browser can see is fetched at LAYOUT, which is after them.
 * That is the same moment the CSS background used to be fetched at, since the
 * url did not exist until packs.css had parsed, so this keeps the old ordering
 * and drops the bytes nobody scrolls to.
 *
 * THE LCP ELEMENT IS NOT LEFT TO THIS. /videos.html's first tile is that page's
 * LCP element and its AVIF is named in a <link rel=preload> in the head, which
 * is why the top and bottom rows above are the same number rather than the
 * bottom one being worse. A page that makes a tile its LCP element and does NOT
 * preload it would need one; nothing does today.
 *
 * `packs` is the set of set ids that actually have artwork on disk. A set
 * without one keeps the generated colour design in ui.css and gets NO img at
 * all: emitting one would be a dead round trip to a file that does not exist.
 * The caller is what holds that set, so the caller does the check.
 */
export function packTileImg(setId) {
  const base = `/assets/packs/${setId}-garbage-rips-585-booster-pack-tile`;
  return `<picture><source type="image/avif" srcset="${base}.avif">` +
    `<img class="pack-img" src="${base}.webp" alt="" width="400" height="711"` +
    ` loading="lazy" decoding="async"></picture>`;
}
