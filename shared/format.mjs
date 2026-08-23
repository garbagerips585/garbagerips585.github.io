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
 * Keep a trailing emoji from landing on a line of its own.
 *
 * TIM'S PLAYLIST TITLES END IN EMOJI AND THE EMOJI ARE HIS, so the fix is never
 * to drop one. "Pitch Black ETB Opening Marathon 🛡️💎" wrapped at 390px into
 * "...Marathon 🛡️" and then a second line holding "💎" and nothing else, on two
 * of the first three cards on /playlists.html. There is a line break
 * OPPORTUNITY between two adjacent emoji as well as at the space before them,
 * so a run of two can split from its title AND from itself.
 *
 * This binds every emoji run to the word in front of it with a non-breaking
 * space and makes the run itself unbreakable. The cost is that the last word
 * travels with the emoji, which is the standard widow fix and is what you want:
 * "Marathon 🛡️💎" moving down together reads as a title, "💎" alone reads as a
 * rendering fault.
 *
 * TAKES AND RETURNS ESCAPED HTML, and does NOT escape for you. It runs over
 * text that has already been through esc(), so `&amp;` and `&#39;` are just
 * characters in a word to it; escaping again here would double-encode them.
 * Give it esc(title) and put the result somewhere that takes markup. NEVER give
 * the result to an aria-label or a <title>, which are text and would print the
 * span.
 */
const EMOJI_RUN = /(\S+)\s+((?:\p{Extended_Pictographic}|️|‍|[\u{1F3FB}-\u{1F3FF}])+)/gu;

export const noWidowEmoji = (escaped) =>
  String(escaped ?? "").replace(
    EMOJI_RUN,
    (_, word, run) => `<span class="nowid">${word}&nbsp;${run}</span>`
  );

/**
 * A researched string, made safe to START a sentence.
 *
 * THE DIRECTION IS THE WHOLE POINT AND IT IS ONE WAY ONLY. Every page on this
 * site splices values out of the research JSON into prose, and those values are
 * written by whoever read the source, so half of them are sentence-cased and half
 * are not. Two pages tried to fix that by LOWERCASING a leading capital and both
 * were wrong: build-retailers.mjs records that lowercasing a product label turned
 * "Poke Ball Tin" into "poke ball tin", and the retailer sources this was written
 * for include "Walmart's own category links" and "Dollar General, Toys & Games,
 * Pokemon". A first-letter test cannot tell a sentence capital from a proper
 * noun, so nothing here may ever remove one.
 *
 * Raising a leading LOWERCASE letter is safe in the other direction, because a
 * lowercase first letter is never a proper noun. So the rule is: put the value
 * where a sentence begins (after a bolded label that ends in a full stop, which
 * is build-selling.mjs's shape) and call this. Never splice it mid sentence and
 * never lowercase it.
 *
 * Deliberately leaves anything that is not an ASCII lowercase letter alone: a
 * value opening with a digit, a dollar sign or a quotation mark is already
 * correct and "capitalising" it is a no-op the caller should not have to think
 * about.
 */
export const sentenceStart = (s) => {
  const v = String(s ?? "");
  return /^[a-z]/.test(v) ? v[0].toUpperCase() + v.slice(1) : v;
};

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
 * NOTHING IN THE DRAWING ITSELF MOVES, at any setting: there is no animation
 * and no transition inside this string, so a caller that does not ship
 * PLATE_CSS gets a still picture and prefers-reduced-motion has nothing to
 * honour. Do not give it a hover transform: two of the placements sit inside
 * running prose where a moving ornament would pull the eye off the sentence.
 *
 * THAT SENTENCE SAID "NOTHING IN IT MOVES" UNTIL 22 AUGUST 2026 AND IT IS
 * NARROWER THAN IT LOOKS. PLATE_CSS now gives the mark a press response, and
 * the no-hover half of this rule is untouched and still correct; the argument
 * for why a press is a different act from a hover is written out in full above
 * PLATE_CSS. The reason this line is edited rather than deleted is that a
 * caller can use plateMark WITHOUT PLATE_CSS, and build-games.mjs does exactly
 * that, so "the drawing holds no motion of its own" is still a true and useful
 * thing to know about this function.
 *
 * THERE IS A SIZE FLOOR AND IT IS 64px, WHICH IS ARITHMETIC RATHER THAN TASTE.
 * The viewBox is 200x116 and almost every stroke in it is 3 to 4.5 units, so
 * the drawn scale is px/200 and the thinnest line on screen is 3 * px/200.
 * At 64px that is 0.96 CSS px, which is the last size at which the macaroni
 * curls and the mustard stripe are still separate marks at DPR 1; at 84 (the
 * default, and the fleuron) it is 1.26px, and at 132 (the games title screen)
 * 1.98px. Below 64 the strokes fall under a device pixel, the six food colours
 * merge and the whole thing reads as a smudge with a rim.
 *
 * SO THE PLATE IS NOT AVAILABLE AS A BULLET OR A LIST MARKER, and that is the
 * question this note exists to close. A bullet is 16 to 24px, which puts the
 * strokes at 0.24 to 0.36px, and the site already learned this the expensive
 * way in a different medium: build-garbage-plate.mjs's diagram draws at 0.56
 * on a phone and had to move every one of its labels out of the SVG and into
 * HTML because 16 units came out at 9px. If a later pass wants a repeating
 * small mark, it needs a DIFFERENT drawing with two or three shapes in it,
 * not this one shrunk.
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
 *
 * ---------------------------------------------------------------------------
 * TWO THINGS WERE ADDED HERE ON 22 AUGUST 2026 AND BOTH ARE ANSWERS TO
 * SOMETHING ALREADY WRITTEN DOWN, so read the answer rather than the diff.
 * ---------------------------------------------------------------------------
 *
 * ONE. THE HAIRLINE IS STAINED NOW, and it is the only accent this ornament
 * has ever carried. It was var(--keyline) flat, #86998C, which is a grey-green
 * and is the drabbest thing in a motif whose entire subject is a plate of food.
 * It is now a gradient that runs from transparent at the outer end into
 * var(--ketchup-deep) where it meets the mark, on both sides, so the colour
 * pools at the plate and dies away before it reaches the margin.
 *
 * PINK IS NOT A TASTE CHOICE HERE, IT IS THE ONLY LEGAL ACCENT. CLAUDE.md:
 * "teal is how you get around, pink is what the site is saying". Teal is
 * every route and is never a mark that goes nowhere, and this hairline is the
 * definition of a mark that goes nowhere, so teal is forbidden on it and pink
 * is what the rule leaves. The 3:1 text gate does not reach a 2px decorative
 * rule that is aria-hidden and carries no information, and --ketchup-deep is
 * the lighter of the two pinks, so this is the more visible one either way.
 *
 * AND IT STAYS UNDER opacity:.5 AND OFF THE HEADING. The fleuron sits a
 * var(--s6) margin above an h2, and CLAUDE.md is emphatic that a section
 * heading is never pink because it would swallow its own .hl. Half opacity on
 * a 2px line that fades out at both ends cannot be mistaken for a heading
 * treatment; a solid pink bar butted against the h2 could be. If a later
 * editor thickens this or removes the fade, that is the rule to re-check.
 *
 * TWO. THE PLATE ANSWERS A PRESS, and the comment above plateMark says in as
 * many words: "Do not give it a hover transform: two of the placements sit
 * inside running prose where a moving ornament would pull the eye off the
 * sentence." THAT RULE IS RIGHT AND IT STANDS. There is still no :hover here.
 *
 * A PRESS IS NOT A HOVER AND THE DIFFERENCE IS THE WHOLE ARGUMENT. A hover
 * fires when a pointer crosses the ornament on its way somewhere else: the
 * reader did not ask for it, it happens in their peripheral vision, and it
 * moves while they are reading the sentence beside it. That is exactly the
 * failure the older rule describes. A press cannot happen in passing. The
 * reader has put a finger or a button down ON the plate, which means their eye
 * is already on the plate, so there is no sentence for it to pull them off.
 *
 * IT IS DELIBERATELY NOT A CONTROL AND CARRIES NO cursor:pointer. A mascot or
 * an ornament that moves under a press implies it does something, and if it
 * does nothing the reader taps it twice and feels misled, which is the same
 * fault as a cursor:zoom-in that never zoomed. The defence is that this makes
 * no promise: no pointer cursor, no focus ring, no href, no aria-anything, and
 * it returns to exactly where it started. It is a plate you can nudge on the
 * table, not a button that failed. Nobody who does not poke it will ever know
 * it is there, and that is the correct amount of discoverability for a toy.
 *
 * SHAPE COPIED FROM .btn:active AND .pack:active IN ui.css rather than
 * invented: a transition on a state change, never a @keyframes (a CSS
 * animation naming missing keyframes never runs and never fires animationend,
 * and this repo has shipped that twice), and the house curve
 * cubic-bezier(.2,.7,.3,1). The press is faster than the release on purpose,
 * .09s down and .2s back, which is what makes it read as give rather than as
 * a slide. transform-origin sits at 50% 78%, which is the plate's own footprint
 * in the 200x116 viewBox, so it rocks on the table instead of pivoting in air.
 *
 * IT INHERITS THE IOS CAVEAT THAT .btn ALREADY HAS: mobile Safari does not
 * apply :active without a touch listener somewhere on the page. That is the
 * existing behaviour of every pressable thing on this site rather than a new
 * gap, and the failure mode is that the plate simply does not move.
 *
 * CLS IS UNMOVED BECAUSE NOTHING HERE IS LAYOUT. Both additions are a
 * background and a transform; no size, no margin and no display changes under
 * any state.
 *
 * REDUCED MOTION REMOVES THE MOVEMENT AND NOTHING ELSE. ui.css's blanket rule
 * kills transitions but cannot undo a transform, so the transform is nulled
 * explicitly. There is no persistent hidden state anywhere in this ornament to
 * be left stuck: it has no opacity:0 base, so the reduced-motion reader gets a
 * plate that is fully drawn and simply does not move.
 */
export const PLATE_CSS = `.plate-rule{display:flex;align-items:center;gap:var(--s4);max-width:560px;margin:var(--s7) 0 var(--s6)}
.plate-rule::before,.plate-rule::after{content:"";flex:1;height:2px;border-radius:2px;opacity:.5}
.plate-rule::before{background:linear-gradient(90deg,transparent,var(--ketchup-deep))}
.plate-rule::after{background:linear-gradient(90deg,var(--ketchup-deep),transparent)}
.plate-rule svg{flex:none;display:block;transform-origin:50% 78%;transition:transform .2s cubic-bezier(.2,.7,.3,1)}
.plate-rule:active svg{transform:translateY(2px) scale(.94) rotate(-3deg);transition-duration:.09s}
@media(prefers-reduced-motion:reduce){.plate-rule:active svg{transform:none}}`;

/**
 * ===========================================================================
 * THE MASCOT GRAMMAR, WRITTEN DOWN IN ONE PLACE FOR THE FIRST TIME.
 * ===========================================================================
 *
 * It existed and it was correct, but it was recorded in a comment inside
 * scripts/build-search.mjs beside one of its uses, which is a rule written
 * where nobody looks for it. CLAUDE.md has a whole section about that exact
 * failure (the Collectr footer link: "an argument written where nobody looks
 * for the rule"). This file already owns the plate, so it owns the marks.
 *
 * THREE MARKS, THREE MEANINGS, AND THE MEANINGS ARE THE POINT. A mark with no
 * meaning behind it is wallpaper within a month, and eleven identical marks is
 * the repetition that kills the motif. So:
 *
 *   TRUBBISH  = "there is nothing in this one."
 *               The empty state, and ONLY the empty state. He is the thing in
 *               an empty room, so a Trubbish on a page that has something on
 *               it is a lie. Five places today: the two grid states in
 *               public/assets/app.js, a rip with no hits, /404.html, and
 *               /openings/chinese-pack.html, which earns him by rendering no
 *               picture at all (build-openings.mjs measures that rather than
 *               naming the page). A sixth was added 22 August 2026, and it is
 *               the grammar being applied where it had been missed rather than
 *               extended: /upcoming.html's up-none box was the one empty state
 *               on this site with no mascot in it.
 *
 *   GARBODOR  = "we went through the whole heap."
 *               EXHAUSTIVENESS, not emptiness. This is the distinction the
 *               build-search.mjs comment turns on and it is easy to lose: site
 *               search draws Garbodor rather than Trubbish because what that
 *               state says is not "nothing here" but "we read 316 openings,
 *               5,181 cards, every set guide and 1,025 species, and that was
 *               all of them". The heap is the evolved one.
 *
 *   THE PLATE = the ornament. plateMark is the drawing, plateRule is the
 *               fleuron, and neither of them says anything: they are
 *               aria-hidden furniture. See those two functions.
 *
 * WHAT WAS EXTENDED ON 22 AUGUST 2026, AND THE NEW RULE, so the next pass has
 * something to work against:
 *
 * GARBODOR MAY NOW CLOSE A LIST AS WELL AS END A SEARCH, AND THAT IS THE SAME
 * MEANING AND NOT A SECOND ONE. His documented sense is exhaustiveness. Until
 * now the only exhaustive thing on the site that had a mark on it was a search
 * that came back with nothing, which made him look like a failure mascot and
 * made "Garbodor" read as a synonym for "sorry". He is not. He stands at the
 * end of anything the site went all the way through, and that thing is usually
 * full rather than empty.
 *
 * THE CONDITION, AND IT IS THE WHOLE OF THE RULE:
 *
 *     A HEAP MARK MAY ONLY RESTATE A COMPLETENESS CLAIM THE PAGE ALREADY
 *     MAKES IN ITS OWN COPY, IN ITS OWN NUMBERS. It may never be the first
 *     thing on the page to claim the list is complete.
 *
 * This site sources every figure it prints and an ornament must not read as
 * data, so a mascot asserting "that is all of them" over a list that has not
 * said so is a claim made by a picture, which is the worst place to make one.
 * The line beside him therefore has to be derived from the same array the page
 * counted in its lede, so it cannot go stale in one place and not the other.
 *
 * THE RULE IMMEDIATELY DISQUALIFIED THE BEST-LOOKING CANDIDATE, which is how
 * you can tell it does some work. /video-games.html is 174 games over
 * 41,714px, the densest catalogue on the site, and it is the obvious place for
 * a heap mark. Its lede reads "Every official Pokemon game WE COULD FIND A
 * RECORD OF", which is a deliberate hedge, and CLAUDE.md records that page
 * hedging again at the foot about Metacritic's robots file. The page refuses
 * to claim completeness, so a Garbodor claiming it for the page would have
 * been the ornament overruling the copy. It got none.
 *
 * ONE PER PAGE, AT THE END OF THE RUN HE IS CLOSING, AND NOT AGAINST THE
 * FOOTER. Every page on this site already ends in a drawn medallion and the
 * "Garbage Rips Only! Let's Go!" sign-off, so a mark dropped just above the footer
 * is a second closer 200px from the first. He closes a LIST, in the middle of
 * the page, where the list actually stops.
 *
 * HE IS NOT AN EMPTY STATE AND MUST NOT REUSE .empty / .empty-mascot. Those
 * classes carry app.js's landMascot arming in ui.css and, more importantly,
 * they mean the other thing. Own class, own CSS, in the page's style block.
 *
 * THE BOX IS 96px ON A PHONE AND 128px ABOVE 700px, AND 128 IS THE ASSET'S OWN
 * DESIGN POINT rather than a number picked here. scripts/sync-species-art.mjs
 * says why it emits 256: "ONE SIZE, 256px, AND IT IS THE LARGEST DRAWN BOX
 * DOUBLED. The portrait beside the H1 is drawn at 128 CSS pixels, so 256 is
 * exactly sharp at DPR 2."
 *
 * SO THERE IS A SRCSET HERE WHERE build-search.mjs CORRECTLY WROTE NONE, and
 * the difference is the box rather than a change of mind. That state clamps to
 * 116px, so even DPR 1 wants 116 device pixels and the 96px sm/ rendition
 * loses at every density it can be asked for. This box is 96 at 390, so DPR 1
 * asks for exactly 96 and sm/569.webp wins outright at 4,746 bytes against
 * 15,582. Two rungs, and the rung decides the bytes, not the CSS box:
 *
 *       390px  DPR 1   asks  96   -> sm/569.webp        4,746 bytes
 *       390px  DPR 2   asks 192   ->    569.webp       15,582 bytes
 *       390px  DPR 3   asks 288   ->    569.webp       15,582 bytes
 *      1440px  DPR 1   asks 128   ->    569.webp       15,582 bytes
 *      1440px  DPR 2   asks 256   ->    569.webp       15,582 bytes  (exact)
 *
 * THE lg/ RUNG WAS CONSIDERED AND REFUSED. At DPR 3 the 256 file is a 12.5%
 * upscale on a phone and a 50% upscale on a 1440 desktop that does not
 * commercially exist. lg/569.webp is 25,098 bytes, +61%, and
 * sync-species-art.mjs is explicit that lg/ "exists for exactly one caller" and
 * that a second one should ask first. A soft illustration held 12.5% under its
 * natural size is not a visible defect; 9,516 extra bytes on every DPR 2 phone
 * would be.
 *
 * LAZY, DECODING ASYNC, AND width/height ON THE ELEMENT so the 1:1 box is
 * reserved from the attributes before a byte of image arrives. CLS is 0 and
 * stays 0. onerror removes the node, exactly as every other mascot on the site
 * does, so a missing file leaves the sentence standing on its own.
 *
 * HE ANSWERS A PRESS, for the reasons argued in full above PLATE_CSS, and the
 * "is it pretending to be a control" question is sharper for a mascot than for
 * an ornament because a character looks more like a thing you can use. Same
 * defence and it is deliberate: no cursor:pointer, no href, no focus ring, and
 * he returns to exactly where he was. He is a pile of rubbish you can prod.
 *
 * @param {string} line  Already-escaped label. Must be derived from the page's
 *                       own count, never typed as a literal number.
 */
export const heapMark = (line) =>
  `<p class="heap-mark"><img src="/assets/species/569.webp"` +
  ` srcset="/assets/species/sm/569.webp 96w, /assets/species/569.webp 256w"` +
  ` sizes="(min-width:700px) 128px, 96px"` +
  ` alt="" width="256" height="256" loading="lazy" decoding="async"` +
  ` onerror="this.remove()"><span>${line}</span></p>`;

/**
 * The rules heapMark needs, for a page's own style block. Same trade as
 * PLATE_CSS: one page draws this today, and ui.css is render blocking on all
 * of them.
 *
 * THE LINE IS THE MONO LABEL VOICE AND var(--ink-2), NOT AN ACCENT. It sits
 * beside a picture and says something the page has already said in its lede,
 * so it is a caption rather than a mark: pink would make it look like one of
 * the flags, and teal would make it look like a link to somewhere.
 */
export const HEAP_CSS = `.heap-mark{display:flex;align-items:center;gap:var(--s4);margin:var(--s6) 0 0;
  font:700 var(--t-micro)/1.5 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.heap-mark img{flex:none;width:96px;height:auto;display:block;transform-origin:50% 92%;
  transition:transform .2s cubic-bezier(.2,.7,.3,1)}
.heap-mark img:active{transform:scale(.94) rotate(-3deg);transition-duration:.09s}
@media(min-width:700px){.heap-mark img{width:128px}}
@media(prefers-reduced-motion:reduce){.heap-mark img:active{transform:none}}`;

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
 * The srcset for ONE TCGplayer product photograph in a fixed CSS box.
 *
 * ===========================================================================
 * SIZES IS DECLARED AGAINST THE CSS BOX, SO AT DPR 3 THE BROWSER ASKS FOR 3x IT
 * ===========================================================================
 *
 * Seven builders each wrote this srcset by hand and all seven wrote the same
 * bug, which is the whole reason it is one function now. Every one offered the
 * small file and then jumped straight to _in_1000x1000.jpg, so:
 *
 *     box    DPR 1      DPR 2       DPR 3          what DPR 3 landed on
 *     48px   150w ok    150w ok     144 <= 150 ok  the only safe one
 *     64px   150w ok    128 ok      192 > 150 ->   _in_1000x1000, 547x1000
 *     72px   150w ok    144 ok      216 > 150 ->   _in_1000x1000, 547x1000
 *     84px   200w ok    168 ok      252 > 200 ->   _in_1000x1000, 547x1000
 *     88px   200w ok    176 ok      264 > 200 ->   _in_1000x1000, 547x1000
 *
 * A 547x1000 JPEG is 101 to 135KB and it was landing in an 88 pixel box, 261
 * times across 56 pages. /msrp.html is the worst of them: 32 pins at 64px, and
 * measured at 390x844 DPR 3 that page transferred 3,837.4KB fully scrolled, of
 * which 3.6MB is those 32 photographs.
 *
 * THE 64px ROW IS THE ONE THAT WAS BEING READ AS SAFE and it is not. Its box is
 * the smallest that carries a srcset, so it reads like the 48px row, but its
 * small rung is _150w and not _200w: 64 x 3 = 192 clears 150 and fires. Check
 * the RUNG, never the box.
 *
 * _400w.jpg IS A REAL FILE AND IT IS EXACTLY 400 WIDE, which is what makes it
 * the right top rung. Probed on three product ids on 2026-08-20, all 200:
 *
 *     _150w.jpg              150 x 223-274      11.2 to 19.2KB
 *     _200w.jpg              200 x 297-366      17.5 to 30.3KB
 *     _400w.jpg              400 x 594-731      50.6 to 93.8KB
 *     _in_1000x1000.jpg      547-673 x 1000    102.0 to 135.5KB
 *
 * 250w, 300w, 320w, 500w, 600w and 800w all answer 403, so this ladder is the
 * whole of what the CDN has and a candidate that is not on it is a broken
 * image rather than a fallback: the browser has already committed to it.
 *
 * THE 1000w DESCRIPTOR WAS ALSO A LIE AND THERE IS NO RIGHT NUMBER TO PUT
 * THERE. _in_1000x1000 fits the photograph inside a 1000x1000 square, so its
 * WIDTH is whatever the product's aspect ratio makes it: 547, 673 and 642 on
 * the three ids above. One literal cannot be right for all of them. It comes
 * off the ladder rather than getting a better number, because once _400w is
 * there no box on this site can reach it: the widest of them is 88px, which
 * asks 264 device pixels at DPR 3 and 352 at DPR 4.
 *
 * WHAT THIS DOES NOT DO IS PICK THE SMALLEST FILE. An 88px box on a DPR 3
 * phone genuinely wants 264 device pixels and _400w is the smallest rung that
 * covers it; handing it _200w would be 24% short and the fix would be a
 * downgrade wearing a saving. DPR 1 and DPR 2 are deliberately untouched: the
 * small rung is left exactly as each caller had it, so the only pick that
 * moves is the one that was wrong.
 *
 * THE 48px TABLES KEEP THEIR PICK AT EVERY DPR THIS SITE IS READ AT and still
 * get the new rung, which is not a contradiction. 48 x 3 = 144 and the small
 * rung is 150w, so DPR 1, 2 and 3 all take the same file they took before.
 * What changes is what a DENSER screen falls to: past DPR 3.13 those 121
 * pictures used to reach the 547x1000 file and now reach _400w. The rung is
 * offered unconditionally for that reason, and because a ladder whose top
 * depends on the caller's box is a ladder each caller can get wrong again.
 *
 * ===========================================================================
 * AND THE MIDDLE RUNG WAS MISSING, WHICH COST /msrp.html 985KB ON A DPR 3 PHONE
 * ===========================================================================
 *
 * Fixed 21 August 2026. The entry above probed the CDN, wrote down that 150w,
 * 200w and 400w are the three real widths, and then handed the browser only TWO
 * of them: the caller's own small rung and 400w. A 150w caller therefore got a
 * ladder with a 2.67x step in it, and every box that needs between 151 and 200
 * device pixels fell off the top of that step. /msrp.html is a 64px box, so it
 * asks for 192 at DPR 3: 42 pixels past 150, 8 short of a file the CDN has been
 * serving all along, and all 32 pins took _400w. It reads as correct because
 * 400w IS the smallest candidate ON THE LADDER that covers 192; the ladder was
 * the thing that was wrong.
 *
 * Re-probed on three product ids on 2026-08-21 before changing anything, and
 * the widths between the rungs are still 403: 220, 240, 250, 260, 270, 280,
 * 300, 320, 350 and 360 all refuse. So 150/200/400 is the whole ladder and it
 * is now offered whole, from the caller's small rung upward.
 *
 * NOTHING ELSE ON THE SITE MOVES, and that was measured with `currentSrc` at
 * DPR 1, 2 and 3 rather than reasoned from the boxes: the 200w callers (72 to
 * 88px) already had 200w as their small rung and their ladders are unchanged,
 * the 48px tables still take 150w at all three densities, and /what-to-buy.html
 * keeps _400w because a 72px box asks 216 and 200w is 7.4% SHORT of that. This
 * function still does not pick the smallest file; it picks the smallest file
 * that covers the box, which it could not do while a rung was missing.
 *
 * `box` is the CSS px the photograph is painted into, which for every caller is
 * a fixed width in that builder's own style block, not a viewport unit.
 * Returns the srcset value with no attribute around it, or "" when the url is
 * not a TCGplayer product photo.
 */
// The whole of what tcgplayer-cdn publishes. Anything between these answers 403,
// and a candidate that 403s is a broken image rather than a fallback, because
// the browser has already committed to it.
const TCG_RUNGS = [150, 200, 400];
const TCG_PRODUCT = /^(https:\/\/tcgplayer-cdn\.tcgplayer\.com\/product\/\d+)_(150|200|400)w\.jpg$/;
export function productSrcset(thumb, box) {
  const m = TCG_PRODUCT.exec(String(thumb || ""));
  if (!m) return "";
  const [, base, w] = m;
  const small = Number(w);
  // THE GUARD IS THE POINT OF PASSING THE BOX IN. 400w is the top of the CDN's
  // ladder, so a placement wider than 133 CSS px cannot be served honestly from
  // this host at DPR 3 and needs a decision rather than a silent soft picture.
  // Every caller today is 48 to 88px. Fail the build instead of shipping mush.
  if (!(box > 0) || box * 3 > 400) {
    throw new Error(`productSrcset: a ${box}px box needs ${box * 3}px at DPR 3 and tcgplayer-cdn stops at 400w`);
  }
  // From the caller's small rung UP, not just the two ends of it. Starting at
  // the caller's own rung rather than at 150 is what keeps DPR 1 and DPR 2
  // exactly where the entry above left them for the 200w callers.
  return TCG_RUNGS.filter((r) => r >= small)
    .map((r) => `${base}_${r}w.jpg ${r}w`)
    .join(", ");
}

/**
 * The same thing as an ATTRIBUTE, with a leading space, or "" when there is
 * none to write. Same convention as imgDims() above and for the same reason:
 * three of the eight call sites used to gate the whole attribute on a second
 * url being present, and an empty srcset="" is not the same as no srcset. Every
 * caller takes this rather than the bare value so none of them can reinvent
 * that gate and get it wrong the way all seven got the ladder wrong.
 */
export function productSrcsetAttr(thumb, box) {
  const v = productSrcset(thumb, box);
  return v ? ` srcset="${esc(v)}"` : "";
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

/**
 * A meta description clipped to what a search result will actually show.
 *
 * WHY THIS EXISTS AS A SHARED HELPER. build-pages.mjs has clipped its own at
 * 158 characters since the rip pages were written, and all 321 of them land
 * inside the limit. Every other builder hand-writes its description with no
 * length budget, and 74 of them ran over -- the worst at 270 characters, which
 * is a description Google truncates by more than a third. The set guides had
 * one clear cause: an optional companion-set clause appended after the sentence
 * was already at its limit.
 *
 * CUT AT A WORD BOUNDARY AND SAY SO WITH AN ELLIPSIS, which is the rule the rip
 * pages already follow. A description that stops mid-word reads as broken; one
 * that stops mid-sentence with an ellipsis reads as a summary. Sentences are
 * preferred over the ellipsis: if trimming whole sentences gets under the limit,
 * that is a cleaner cut and no ellipsis is needed.
 *
 * @param {string} s the description as written
 * @param {number} [n=158] the budget
 */
export function clipMeta(s, n = 158) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  // FIRST TRY DROPPING WHOLE TRAILING SENTENCES. A complete thought that fits
  // beats a truncated one, and it is what fixes the real cause of the overflow
  // here: an optional clause appended after the sentence was already at budget.
  //
  // A SENTENCE ENDS AT A STOP FOLLOWED BY A SPACE AND A CAPITAL, not at any
  // stop, because a decimal point is neither. `[^.!?]+[.!?]+` split "$4.99"
  // into "$4." and "99" and shipped /sets/crown-zenith.html reading "released
  // January 20, 2023. 00; Crown Zenith Galarian Gallery is...".
  //
  // AND THE CUT IS TAKEN BY INDEX, NEVER BY JOINING MATCHES. String.match with
  // /g returns NON-OVERLAPPING matches from wherever the engine can start, so
  // when the opening sentence contains a price and therefore cannot match, the
  // first "sentence" returned begins in the MIDDLE of the text.
  // /first-partner-illustration-collection.html came out starting at "99 on
  // shelves" with the whole opening silently dropped. Slicing t from 0 to a
  // terminator's index cannot do that: the result is a prefix by construction.
  const ends = [];
  const re = /[.!?]+(?=\s+[A-Z(\u201C"']|$)/g;
  for (let m; (m = re.exec(t)); ) ends.push(m.index + m[0].length);
  let whole = "";
  for (const e of ends) {
    if (e > n) break;
    whole = t.slice(0, e);
  }
  // ONLY IF THE CLEAN SENTENCE STILL FILLS THE SPACE. A result shows about 155
  // characters whether or not we use them, so a tidy 73-character sentence that
  // throws away half the budget is a worse description than a 153-character one
  // ending in an ellipsis. /sets/crown-zenith.html is the case: cut at the first
  // stop it loses the Galarian Gallery clause entirely, which is the single most
  // useful thing that page's description says.
  if (whole.length >= Math.max(96, n * 0.62)) return whole;
  return t.slice(0, n - 3).replace(/\s\S*$/, "").replace(/[.…\s]+$/, "") + "...";
}

