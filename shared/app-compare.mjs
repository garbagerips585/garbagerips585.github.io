// The Live against Pocket comparison, defined ONCE and rendered on both pages.
//
// data/tcg-live-PLAN.md and data/tcg-pocket-PLAN.md both call for this table and
// both say the same thing about it: a reader landing on either page has to get
// the same answer. Two hand-written copies of a table is two tables that drift,
// and the drift is invisible because nobody reads both pages in one sitting.
// So build-tcg-live.mjs and build-tcg-pocket.mjs import this module and neither
// one owns the wording.
//
// EVERY CELL TRACES TO A RESEARCH FILE. The Live column comes from
// data/tcg-live.json and the Pocket column from data/tcg-pocket.json, whose
// vsLive block records the key inside the Live file for each row so the two
// research files cannot disagree either. Fix a cell here and both pages change;
// fix it on a page and you have made the bug this file exists to prevent.
//
// COLUMN ORDER IS LIVE THEN POCKET, on both pages, including the Pocket one.
// The Pocket plan drew it the other way round. The order matters less than the
// identity, and this site's readers are holding physical cards: Live is the one
// that matches what is in their hands, so it reads first. Changing it is fine.
// Changing it on one page only is not.
//
// EIGHT ROWS, not the eleven the research offers. The cut ones are "what is it",
// which the sentence above the table already says, "free packs without spending
// anything", which needs a paragraph of caveat on the Live side to not read as
// if Live hands out daily packs, and "match length", which cannot be said
// precisely without wiki-sourced turn caps.
//
// NO ODDS ANYWHERE, in either column. Neither app's published rates are quoted,
// summarised, characterised or linked. See the forbidden blocks in both
// research files: the rule has no digital exception.

/** The paragraph that answers the question the table only lays out. */
export const COMPARE_ANSWER =
  "Live is the card game itself, digitally: the same rules, the same 60 card decks, and a use for the code " +
  "cards out of your packs. Pocket is a smaller, faster game of its own on a phone, with free packs every day " +
  "and nothing at all to do with those codes. The sharpest practical difference is the third row. Live wants a " +
  "free Pokemon account before you play; Pocket never asks you for one. Both are official, both are free, and " +
  "installing both costs nothing.";

/** [question, Live, Pocket]. Order is deliberate: platform, money, then rules. */
export const COMPARE_ROWS = [
  [
    "Where it runs",
    "iPhone, iPad, Android, Windows and Mac",
    "iPhone, iPad and Android. Phones and tablets only.",
  ],
  [
    "What it costs",
    "Free, with optional in-app purchases",
    "Free, with optional in-app purchases",
  ],
  [
    "Account needed",
    "Yes. A free Pokemon account, now called Pokemon Trainer Central and older material calls it Pokemon Trainer Club.",
    "No Pokemon account. You pick a region, confirm your age and play. Linking a Nintendo, Google or Apple account is optional and protects your save.",
  ],
  [
    "Deck size",
    "60 cards, the card game's own deck rules, checked for you",
    "20 cards, at most two copies of a name, and no Energy cards at all",
  ],
  [
    "Same rules as the cards on your table",
    "Yes",
    "No, and Pokemon says so outright",
  ],
  [
    "The code card in your pack",
    "Yes. A booster pack code gives a digital pack from the same set.",
    "Not used. The code in your pack is not for this app.",
  ],
  [
    "Trading",
    "None. Pokemon says players cannot trade cards in Live.",
    "With friends, once you are two weeks in, and both cards have to match on rarity",
  ],
  [
    "Playing the computer",
    "Guided lessons in the Learning Lab, plus a mode for trying a deck out",
    "Solo battles, step-up battles and solo events, and it can take your turns for you while you watch",
  ],
];

/**
 * The table itself.
 *
 * WRAPPED IN ITS OWN SCROLLER. Three columns do not fit at 390px and a table
 * that overflows its wrapper makes the whole PAGE scroll sideways, which is the
 * one layout failure that is obvious to every reader and invisible in a desktop
 * screenshot. .cmp-w is overflow-x:auto for exactly that reason.
 *
 * AND THEREFORE tabindex="0" + role="region" + aria-label, the same affordance
 * .xp-scroll, .cc-scroll, .gc-tw and .op-tw carry, for the reason set out at
 * length in scripts/build-expansions.mjs: a box that scrolls sideways and that a
 * keyboard cannot focus is content a keyboard cannot read.
 *
 * THIS IS THE WORST CASE OF THE FOUR AND IT WAS THE ONE LEFT OUT. Every cell in
 * this table is plain text: there is not one link, button or input inside it, so
 * there is nothing to tab to and no way to move it. Chrome 127 grants implicit
 * focus to a scroller with no focusable children and hides the failure; Firefox
 * and Safari do not, and on those the third column was simply unreachable
 * without a mouse. Measured at 390x844: scrollWidth 374 against clientWidth 360,
 * so 14px hidden -- and 84px at 320x568, which is most of the "Pokemon TCG
 * Pocket" column heading. A comparison table missing one of the two things it
 * compares is not a small loss.
 */
export const compareTable = (esc) => `        <div class="cmp-w" tabindex="0" role="region" aria-label="Pokemon TCG Live compared with Pokemon TCG Pocket, scrollable table">
          <table class="cmp">
            <caption class="sr-only">Pokemon TCG Live compared with Pokemon TCG Pocket, row by row.</caption>
            <thead>
              <tr><th scope="col">&nbsp;</th><th scope="col">Pokemon TCG Live</th><th scope="col">Pokemon TCG Pocket</th></tr>
            </thead>
            <tbody>
${COMPARE_ROWS.map(
  ([q, live, pocket]) =>
    `              <tr><th scope="row">${esc(q)}</th><td>${esc(live)}</td><td>${esc(pocket)}</td></tr>`
).join("\n")}
            </tbody>
          </table>
        </div>`;

/** Styles for the table above. Both builders paste this into their own style block. */
export const COMPARE_CSS = `
/* .cmp is min-width:34em, which is 374px at the 11px the max-width:640 rule
   below drops it to, so on a phone it does not fit and scrolls. Measured on
   /tcg-live.html: clientWidth 360, scrollWidth 374 at 390x844 and 84px hidden
   at 320x568. Small, but the third column is the whole point of a comparison
   table and there was nothing on the page saying it was there.
   Same four layer affordance as ui.css's .cc-scroll: covers ride the content,
   shadows stay on the box, so it disappears the moment the table fits.
   background-COLOR, not the shorthand, which resets background-image. */
/* --navy WAS #111111 AND IS AN INK NOW. It used to be the same value as --ink,
   --keyline and --chrome-bg all at once, which is how one token came to be a
   3px FRAME, a dark PANEL FILL and an INK in the same stylesheet without
   anybody noticing. On a dark ground those three want opposite values, so each
   usage moved to the token that names its job: a frame is --keyline, a panel is
   --band-bg, and --navy stays an ink. See CLAUDE.md, "Palette". */
.cmp-w{overflow-x:auto;margin-top:var(--s4);border:3px solid var(--keyline);border-radius:12px;
  background-color:var(--card);box-shadow:var(--hard-lg);max-width:46em;
  background-image:
    linear-gradient(to right,var(--card) 40%,rgba(255,255,255,0)),
    linear-gradient(to left,var(--card) 40%,rgba(255,255,255,0)),
    /* WAS rgba(17,17,17,.30): a near-black shadow, which is the "there is more
       to the right" cue and which is invisible on a dark card. Same geometry,
       opaque black, so the cue survives the repaint. */
    radial-gradient(farthest-side at 0 50%,rgba(0,0,0,.55),rgba(0,0,0,0)),
    radial-gradient(farthest-side at 100% 50%,rgba(0,0,0,.55),rgba(0,0,0,0));
  background-position:left center,right center,left center,right center;
  background-repeat:no-repeat;
  background-size:44px 100%,44px 100%,15px 100%,15px 100%;
  background-attachment:local,local,scroll,scroll}
.cmp{width:100%;border-collapse:collapse;font-size:var(--t-sm);min-width:34em}
.cmp th,.cmp td{text-align:left;padding:10px var(--s3);border-bottom:1px solid var(--hair);vertical-align:top;
  line-height:1.45}
.cmp thead th{font:700 var(--t-micro)/1.2 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.cmp tbody th{font-weight:700;width:11em}
.cmp tr:last-child td,.cmp tr:last-child th{border-bottom:0}
@media(max-width:640px){.cmp{font-size:var(--t-micro)}.cmp th,.cmp td{padding:8px 8px}}
`;
