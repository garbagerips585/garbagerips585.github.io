#!/usr/bin/env node
// Build /tcg-live.html: what the code card in every booster pack is for, and
// the free official app it opens.
//
//   node scripts/build-tcg-live.mjs
//
// Reads data/tcg-live.json, where every claim carries a source key into that
// file's own sources block and the date the source was read. The plan and the
// argument for what is on the page and what is deliberately left off it are in
// data/tcg-live-PLAN.md.
//
// WHY THIS PAGE EXISTS AND WHY IT IS SHAPED THIS WAY. Tim scans the code cards
// out of the packs he opens on camera. The rest of this site prices the cards,
// grades them, checks them for fakes and says where to sell them; the code card
// is the one thing in a booster pack the site had never said a word about. So
// the reader is easy to picture: they have just opened packs, they are holding a
// stack of code cards, and they have not decided whether to install anything.
//
// THE CODE SECTION GOES SECOND, BEFORE THE DOWNLOAD SECTION, and that is the
// structural argument of the whole page. Every other guide to this app opens
// with installation because that is chronological order. Chronological is wrong
// here: the page has to answer "what is this bit of cardboard for" before it has
// earned the right to ask anybody to download 3GB. Section one exists only to
// give them the frame that makes section two parse.
//
// THREE SENTENCES THAT CARRY THE PAGE, all official and all quotable:
//   1. A booster code gives a digital pack from the same set, and it will not
//      necessarily contain the same cards as the pack the code came out of.
//   2. A PRECONSTRUCTED DECK code gives that same deck, with the same cards.
//      The contrast is the point and it kills the common misconception.
//   3. The app names the reward, and your running count for that product,
//      BEFORE you claim. That is more durable than any table this page could
//      print, and Pokemon changed what non-booster codes give once already.
//
// THE ONE SECTION NOBODY ELSE CAN WRITE, and the reason this page was extended
// past the plan's original budget. Section 3 counts the code cards that have
// come out of the packs on this channel. Pokemon states that every booster pack
// holds one and public/data/videos.json holds a counted `packs` figure per rip,
// so the two together give a number that is ours and that no general guide to
// this app can print. Every figure in it comes from shared/packtally.mjs at
// build time, so it grows with the catalogue instead of going stale, and that
// file's header carries the argument for what is and is not in the count.
//
// IT IS ENGLISH PACKS ONLY AND THE SECTION SAYS SO. Nothing official was found
// in either direction on whether a Japanese, Korean or Chinese pack carries a
// code the English client takes, so those rips are held out of the figure and
// the page says they are held out and why. The narrower number is the one this
// site can stand behind, which is the whole habit of this page.
//
// FOUR THINGS THE RESEARCH IS NOT FIRM ON, and each is worded to stay true
// either way. Code expiry is established by the absence of any statement, so
// this page says Pokemon publishes no expiry date and never says codes never
// expire. In-app redemption on iOS is unresolved, so the page says to use the
// website if the option is not there rather than adjudicating. The starter deck
// count is App Store marketing copy, so it says "a handful". The whole ranked
// ladder is a community wiki, so it gets three sentences and no numbers.
//
// NO PULL RATES, NO DROP RATES, NO ODDS, DIGITAL OR PHYSICAL. Pokemon publishes
// drop rates for Live's digital packs and the url is deliberately absent from
// the research file. The official sentence quoted in section two continues into
// an offer to go and read them; the quote stops before that. If a later editor
// finds themselves thinking "but this is the digital version, the odds are
// published, it is different", that is the argument the rule exists to refuse.
//
// NO LIST OF PROMOTIONAL CODES. They rot in weeks, they are not from Pokemon,
// and a code list turns an evergreen page into one that lies.
//
// NO PHOTOGRAPH OF A CODE CARD, EVER, and that half of the old rule stands: a
// photo of a real one either burns a live code or publishes a dead one.
//
// THE REST OF THIS ENTRY USED TO READ "NO IMAGERY", on the grounds that the
// site does not use other people's pictures and there are no in-house
// screenshots of the app. The owner has since said that official Pokemon
// imagery may be used here, which retires the first half; the second half was
// never a reason to have no pictures, because the publisher ships its own. So
// the page now carries the app icon and three screenshots off the app's own App
// Store listing, mirrored by scripts/sync-app-shots.mjs at the size they are
// drawn and credited in the small print. That script asserts on every run that
// the listing is still published by The Pokemon Company International.
//
// A SCREENSHOT IS SUBJECT TO THE ODDS BAN LIKE ANY OTHER CLAIM. Alt text and
// captions are prose, and so is a button caught in a picture: Pocket's first
// listed screenshot has a visible "Offering Rates" control and is excluded on
// the sibling page for exactly that reason. Look at a shot before pinning it.
//
// The other picture worth having is ours, and it is the inline SVG below.
//
// NO BACKTICKS IN COMMENTS IN THIS FILE. The page is one template literal and a
// backtick in a comment closes it. That has broken this build three times.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where
// it sits, so both attach to nothing: ~11.9KB gzipped and 2 requests for a
// script that finds no tile and a stylesheet whose classes never appear.
// CHECKED BY DRIVING THE PAGE, not by grepping it: packplayer's entry point is
// a delegated click on an <a> to a rip that WRAPS an <img> or a .pack facade,
// which no scan for [data-vcar] or img[data-packsrc] can see. The three
// conditions a page must meet, and why the obvious scan gives the wrong answer,
// are in shared/chrome.mjs beside the two exports. READ THAT BEFORE ADDING A
// VIDEO TILE OR A CAROUSEL HERE: a tile added without putting packplayer.js
// back navigates instead of playing in place, which reads as a design choice
// rather than as a bug.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";
import { COMPARE_ANSWER, COMPARE_CSS, compareTable } from "../shared/app-compare.mjs";
import { APP_SHOT_CSS, appCredit, appIcon, appStrip } from "../shared/appshots.mjs";
import { PACKS } from "../shared/packtally.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(await readFile(join(ROOT, "data/tcg-live.json"), "utf8"));

if (!d.checked) throw new Error("tcg-live.json has no checked date");

// PULL THE FACTS OUT OF THE FILE RATHER THAN RETYPING THEM, so a research
// refresh that changes a number changes the page. Each of these throws rather
// than falling back, because a silent fallback is how a page ends up asserting
// something nobody checked.
const at = (path) => {
  const v = path.split(".").reduce((o, k) => (o == null ? o : o[k]), d);
  if (v == null) throw new Error(`tcg-live.json: nothing at ${path}`);
  return v;
};

// The soft limit on booster codes, read off the researched table rather than
// typed into the prose. It is official, it is quoted in the file, and it is not
// an odds figure.
const boosterLimit = (() => {
  const row = at("codeCards.howManyYouCanRedeem.limits").find((l) => /booster pack/i.test(l.product));
  if (!row) throw new Error("tcg-live.json: no booster pack row in the soft redemption limits");
  const m = /(\d+)/.exec(row.limit);
  if (!m) throw new Error(`tcg-live.json: cannot read a number out of the booster limit "${row.limit}"`);
  return m[1];
})();

// The channel's own count, formatted once. Thousands separators because these
// cross 1,000 and a bare "1007" in the middle of a sentence reads as a typo.
const n = (x) => x.toLocaleString("en-US");

// The soft limit is a number and the top set's pile is a number, and the whole
// point of putting them in the same sentence is that the second is under the
// first. If a future catalogue passes it, that sentence becomes false while
// still being grammatical, which is the worst kind of stale. So it is asserted
// here rather than trusted: cross the limit and the build stops and asks for the
// sentence to be rewritten, instead of shipping a claim the data contradicts.
if (PACKS.top.packs >= Number(boosterLimit)) {
  throw new Error(
    `${PACKS.top.label} is now ${PACKS.top.packs} counted packs, at or past the ${boosterLimit} soft ` +
      "redemption limit. The sentence in the code card count section says the channel is not close to it. " +
      "Rewrite that sentence before this builds again."
  );
}

// The system requirement floors, assembled from the researched table so the
// page cannot drift from it. The date beside them on the page is the date the
// requirements were last raised, not the date of this build.
const minimums = at("howToGet.systemRequirements.table")
  .map((r) => r.minimum)
  .join(", ");
const sysAsOf = at("howToGet.systemRequirements.asOf");

// The two launch dates, read off the history rather than remembered.
const dateOf = (what) => {
  const row = at("howToGet.history.dates").find((x) => new RegExp(what, "i").test(x.what));
  if (!row) throw new Error(`tcg-live.json: no history entry matching ${what}`);
  return longDate(row.when);
};
const tcgoOff = dateOf("servers shut down");
const liveLaunch = dateOf("global launch");
const cardDexOff = dateOf("Card Dex");

// ---------------------------------------------------------------------------
// THE ONE-WAY DIAGRAM.
//
// The single most useful picture available to this page, and the only one it can
// legitimately have. It carries the whole argument of the last section in a
// glance: a physical pack produces a code card, the code card produces a digital
// pack inside the app, and nothing travels back the other way. The return arrow
// is DRAWN AND CROSSED OUT rather than omitted, because the absence of an arrow
// is not a statement and a crossed out one is.
//
// Inline SVG, like the board diagram on /how-to-play.html: one request that is
// already paid for, scales to any width, legible at 390px, and ours.
const step = (x, label, sub) =>
  `<g class="ow-b"><rect x="${x}" y="18" width="82" height="34" rx="5"/>` +
  `<text x="${x + 41}" y="34" text-anchor="middle">${label}</text>` +
  `<text class="ow-sub" x="${x + 41}" y="44" text-anchor="middle">${sub}</text></g>`;

const ARROW = `<svg class="ow" viewBox="0 0 300 108" role="img"
  aria-label="A physical booster pack gives a code card, and the code card gives a digital pack inside Pokemon TCG Live. The arrow back from the app to your physical cards is drawn crossed out: nothing comes back the other way.">
  <defs><marker id="ow-a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
    <path d="M0 0 L8 4 L0 8 z"/></marker></defs>
  ${step(6, "BOOSTER PACK", "the one in your hands")}
  ${/* Sub-labels are capped at about 21 characters. SVG text does not wrap and
        does not clip to its box, so a longer one silently runs out over the
        arrows on both sides at 390px. "the one you throw in a pile" did exactly
        that and looked like a rendering bug. */ ""}
  ${step(109, "CODE CARD", "the one nobody keeps")}
  ${step(212, "DIGITAL PACK", "opened in the app")}
  <line class="ow-l" x1="90" y1="35" x2="105" y2="35" marker-end="url(#ow-a)"/>
  <line class="ow-l" x1="193" y1="35" x2="208" y2="35" marker-end="url(#ow-a)"/>
  <line class="ow-back" x1="248" y1="66" x2="56" y2="66" marker-end="url(#ow-a)"/>
  <line class="ow-x" x1="140" y1="58" x2="164" y2="74"/>
  <line class="ow-x" x1="164" y1="58" x2="140" y2="74"/>
  <text class="ow-k" x="150" y="88" text-anchor="middle">Nothing goes back the other way. There is no path from</text>
  <text class="ow-k" x="150" y="99" text-anchor="middle">a digital collection to a card you can hold.</text>
</svg>`;

// ---------------------------------------------------------------------------
// THE PILE AGAINST THE LIMIT.
//
// The count section's last bullet is the one claim on this page that is a
// QUANTITY rather than a rule, and it is the one the reader has no way to
// judge: "the biggest single pile counted here is 264 packs of Chaos Rising,
// against the 400 above. If a channel that opens this much is not close, you are
// not close." Two numbers in one sentence, and the whole force of it is the gap
// between them, which prose can only put one after the other.
//
// IT DRAWS THE INVARIANT THE BUILD ALREADY ASSERTS. The guard above this file's
// body stops the build the day PACKS.top.packs reaches the soft limit, because
// that sentence would become false while staying grammatical. The figure draws
// the same comparison, so the prose, the picture and the guard are now one
// claim with one failure mode instead of three things that could drift.
//
// EVERY NUMBER IS BUILD TIME AND OURS. The piles come from shared/packtally.mjs,
// derived from the pack counts on the channel's own rips, and the limit is the
// one already parsed out of the researched table into `boosterLimit`. Nothing
// here is typed in.
//
// THE THRESHOLD FOR BEING DRAWN IS A STATED RULE, NOT A TOP N. "The six biggest"
// is a number somebody picked; "every expansion whose pile has reached a tenth
// of the limit" is a rule the caption states and a reader can check, and it
// keeps meaning the same thing as the catalogue grows. The expansions under it
// are counted in the caption rather than dropped silently.
//
// SVG AND NOT THE .bch BAR ROWS THE BUYING PAGE USES, and the reason is the word
// budget rather than taste. prose() below strips <svg>, <table> and <figcaption>
// and nothing else, so a dozen HTML rows of set name and number would cost about
// sixty words against a ceiling this page sits thirteen words under. Inline SVG
// costs none. It is also what the other diagram here already is.
//
// AND THE TEXT IS SIZED IN RENDERED PIXELS RATHER THAN IN VIEWBOX UNITS. The
// figure box measures 366px at 390x844 against a 300 unit viewBox, so everything
// here is scaled by 1.22 on the phone this page is mostly read on: 9 units is
// 11 rendered pixels and 5 units, which is what the diagram above uses for its
// sub-labels, is 6. Check the scale before picking a size.
const DRAWN_MIN = Math.round(Number(boosterLimit) / 10);
const PILES = PACKS.bySet.filter((s) => s.packs >= DRAWN_MIN);
const REST = PACKS.bySet.filter((s) => s.packs < DRAWN_MIN);
// ZERO IS NOW A LEGITIMATE STATE AND IT MEANS "NOBODY HAS SAID YET".
//
// This used to throw on an empty PILES, on the reasoning that under one pile
// there is no picture to draw. That was right while every video carried a pack
// count. Tim, 18 August 2026: "make sure you aren't tagging any videos with
// what type of product it is and what packs are in the video until you get my
// execl sheet thats filled out with all that exact data". Those counts were the
// old prefill rather than his answers, so they are withheld until the filled
// sheet lands, and PILES is legitimately empty in the meantime.
//
// An empty PILES now takes the WHOLE section rather than drawing an empty
// frame, because every claim in it ("the biggest single pile counted here is N
// packs") is a pack count and none of them can be made without the data. Over
// nine still throws: that is a legibility limit at 390px and it is unchanged.
if (PILES.length > 9) {
  throw new Error(
    `tcg-live: the pile figure draws every expansion at or over ${DRAWN_MIN} counted packs and that is ` +
      `${PILES.length} of them. Over nine the rows stop being legible at 390px. Change the rule and the ` +
      `caption together, not the drawing alone.`
  );
}
const COUNTED = PILES.length > 0 && PACKS.top != null;
const pileFig = () => {
  const W = 300, X0 = 4, XMAX = 272, ROW = 26, TOP = 20;
  const LIM = Number(boosterLimit);
  const H = TOP + PILES.length * ROW + 4;
  const x = (v) => X0 + (v / LIM) * (XMAX - X0);
  return `        <figure class="tl-fig">
          <svg class="pl" viewBox="0 0 ${W} ${H}" role="img"
            aria-label="Counted packs per expansion against the soft redemption limit of ${esc(
              boosterLimit
            )} per expansion. ${PILES.map((s) => `${s.label} ${s.packs}`).join(", ")}. The biggest is ${esc(
    n(PACKS.top.packs)
  )}, which is ${Math.round((PACKS.top.packs / LIM) * 100)} percent of the way to the limit.">
            <text class="pl-cap" x="${XMAX}" y="9" text-anchor="end">${esc(boosterLimit)} per expansion</text>
            <line class="pl-lim" x1="${XMAX}" y1="12" x2="${XMAX}" y2="${H - 2}"/>
${PILES.map((s, i) => {
  const top = TOP + i * ROW;
  return `            <text class="pl-n" x="${X0}" y="${top + 8}">${esc(s.label)}</text>
            ${/* Right-aligned SEVEN UNITS INSIDE the limit rule, not on it. Flush
                  to XMAX the last digit of every number sat under the dashed
                  line, which read as a rendering fault rather than as a column.
                  The value stays a column rather than riding the end of its own
                  bar so that six numbers can be compared without the eye
                  hunting for them. */ ""}
            <text class="pl-v" x="${XMAX - 7}" y="${top + 8}" text-anchor="end">${s.packs}</text>
            <rect class="pl-t" x="${X0}" y="${top + 12}" width="${XMAX - X0}" height="9" rx="2"/>
            <rect class="pl-b" x="${X0}" y="${top + 12}" width="${(x(s.packs) - X0).toFixed(1)}" height="9" rx="2"/>`;
}).join("\n")}
          </svg>
          <figcaption>Counted packs per expansion against that limit, for every expansion whose pile has
            reached a tenth of it. The other ${esc(String(REST.length))} sit under ${esc(
    String(DRAWN_MIN)
  )} packs each, and ${esc(
    n(PACKS.unattributed)
  )} more came out of rips that opened two expansions at once, so no bar can claim them.</figcaption>
        </figure>`;
};

const desc =
  "What the code card in every Pokemon booster pack is for, what a code actually gives you, " +
  "and how to redeem it in the free official app.";
// Google truncates the snippet around 160 characters, so this is measured rather
// than hoped for. Same guard build-pack-prices.mjs carries.
if (desc.length > 160) throw new Error(`meta description is ${desc.length} characters, over 160:\n${desc}`);

// FAQPage, because the headings here really are questions people type. NOT
// SoftwareApplication: it is Pokemon's app, not ours, and marking it up as if it
// were our product would be a misrepresentation.
const QA = [
  [
    "What is the code card in a Pokemon booster pack?",
    "It is the card in the pack that is not a Pokemon card. It carries a code for Pokemon TCG Live, the free official digital version of the card game, and the code gives you a digital booster pack from the same set.",
  ],
  [
    "Does the code give me the cards I just pulled?",
    "No. Pokemon says the digital booster pack will not necessarily contain the same cards as the physical pack the code came from. It is its own pack from the same set. A preconstructed deck code is different: that one gives you the same deck with the same cards.",
  ],
  [
    "How do I redeem a Pokemon TCG Live code?",
    "Two ways. In the app, go to the Shop, choose Redeem, type the code or scan the QR square, check each item and select Claim Now. Or go to Pokemon's redemption site, log in to the account you use for TCG Live, enter the code and claim it there.",
  ],
  [
    "Do Pokemon code cards expire?",
    "Pokemon publishes no expiry date for booster pack codes and nothing official says they run out, so an old code card is worth trying. Promotional codes from campaigns are a different thing and those do have end dates.",
  ],
  [
    "Is Pokemon TCG Live free?",
    "Yes. It is free on iPhone, iPad, Android, Windows and Mac, and you need a free Pokemon account to play. There are optional purchases and they are cosmetics and shortcuts rather than a way in.",
  ],
];

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "The code card in the pack" },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: QA.map(([name, text]) => ({
      "@type": "Question",
      name,
      acceptedAnswer: { "@type": "Answer", text },
    })),
  },
];

const style = `
.tl-lede{max-width:44em}
.tl-chk{font:400 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);margin-top:var(--s3)}
.tl-s{margin-top:var(--s6);scroll-margin-top:var(--s5)}
.tl-s > p{max-width:44em;line-height:1.6}
.tl-s > p + p{margin-top:var(--s3)}
.tl-jump{display:flex;flex-wrap:wrap;gap:8px;margin:var(--s5) 0 0}
.tl-jump a{display:inline-flex;align-items:center;min-height:40px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.tl-jump a:hover{border-color:var(--ink);background:var(--mustard)}
.tl-shout{border:3px solid var(--navy);border-radius:12px;background:var(--navy);color:var(--chrome-ink);
  padding:var(--s4) var(--s5);margin:var(--s4) 0;box-shadow:var(--hard-lg);max-width:44em}
.tl-shout p{font:400 var(--t-m)/1.3 var(--display);color:var(--chrome-ink)}
.tl-shout span{display:block;margin-top:var(--s3);font-size:var(--t-sm);color:var(--foot-ink);line-height:1.5}
.tl-go{list-style:none;margin:var(--s4) 0 0;padding:0;max-width:44em}
.tl-go li{border-left:4px solid var(--gold);padding-left:var(--s3);margin-bottom:var(--s4);line-height:1.55}
.tl-go b{display:block;font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink-2);margin-bottom:4px}
.tl-two{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4);margin-top:var(--s4);max-width:46em}
@media(max-width:760px){.tl-two{grid-template-columns:1fr}}
.tl-box{border:3px solid var(--navy);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4)}
.tl-box h3{font:400 var(--t-m)/1.2 var(--display);margin-bottom:var(--s2)}
.tl-box ol{margin:0 0 0 var(--s4);font-size:var(--t-sm);line-height:1.55}
.tl-box li{margin-bottom:6px}
.tl-steps{counter-reset:tl;list-style:none;margin:var(--s4) 0 0;padding:0;max-width:44em}
.tl-steps li{counter-increment:tl;position:relative;padding-left:38px;margin-bottom:var(--s3);line-height:1.55}
.tl-steps li::before{content:counter(tl);position:absolute;left:0;top:0;width:26px;height:26px;
  display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--navy);
  color:var(--chrome-ink);font:700 var(--t-micro)/1 var(--mono)}
.tl-fig{margin:var(--s4) 0 0;max-width:44em}
.tl-fig figcaption{margin-top:var(--s2);font-size:var(--t-micro);color:var(--ink-2);line-height:1.5}
.ow{width:100%;height:auto;display:block;background:var(--paper-2);border-radius:8px;padding:6px 0}
.ow-b rect{fill:var(--card);stroke:var(--ink);stroke-width:1.2}
.ow-b text{font:700 6px var(--mono);fill:var(--ink);letter-spacing:.04em}
.ow-b .ow-sub{font:400 5px var(--mono);fill:var(--ink-2);letter-spacing:0}
.ow-l{stroke:var(--ink);stroke-width:1.6}
.ow-back{stroke:var(--ketchup);stroke-width:1.4;stroke-dasharray:4 3}
.ow-x{stroke:var(--ketchup);stroke-width:2.4;stroke-linecap:round}
.ow marker path{fill:var(--ink)}
.ow-k{font:400 5px var(--mono);fill:var(--ink-2)}
/* THE PILE FIGURE. Type is 9 and 10 viewBox units because the box measures
   366px against a 300 unit viewBox at 390x844, so those land at 11 and 12
   rendered pixels on a phone. The sizes in .ow-b above are 5 and 6 units, which
   is 6 and 7 rendered pixels, and that is under the readable floor; it is
   recorded here rather than changed because raising them overruns the 82 unit
   boxes those sub-labels sit in and that diagram's layout is argued in place.

   THE LIMIT IS A DASHED VERTICAL RULE AND THE PILES ARE FILLED HORIZONTAL BARS,
   which is the whole reason this reads with no colour at all. --gold is a real
   hue today, but --ink, --navy, --ketchup and --keyline are all #111111, so a
   figure separating "the ceiling" from "the pile" by fill alone would be one
   black shape. Orientation and dash do the work; the gold is a bonus. */
.pl{width:100%;height:auto;display:block;background:var(--paper-2);border-radius:8px;padding:6px 0}
.pl-n{font:700 9px var(--mono);fill:var(--ink)}
.pl-v{font:700 9px var(--mono);fill:var(--ink)}
.pl-cap{font:700 9px var(--mono);fill:var(--gold-deep);letter-spacing:.04em}
.pl-lim{stroke:var(--gold-deep);stroke-width:2;stroke-dasharray:5 3}
/* The track runs the full width to the limit, so the empty part of every row is
   the argument: it is how much room is left, drawn. */
.pl-t{fill:var(--paper-3)}
.pl-b{fill:var(--ink)}
.tl-out{border:3px dashed var(--navy);border-radius:12px;background:var(--card);padding:var(--s4);
  margin-top:var(--s6);max-width:44em}
.tl-out h2{margin-bottom:var(--s2)}
.tl-out > p{font-size:var(--t-sm);line-height:1.55;color:var(--ink-2)}
.tl-out ul{list-style:none;margin:var(--s3) 0 0;padding:0}
.tl-out li{margin-bottom:var(--s3);font-size:var(--t-sm);line-height:1.5}
.tl-out a{font-weight:700}
.tl-out .tl-off{display:inline-block;font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2);margin-left:6px}
.tl-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s6);line-height:1.6;max-width:46em}
${APP_SHOT_CSS}
${COMPARE_CSS}

/* DESKTOP READING MEASURE, AND THIS PAGE WAS THE WORST ON THE SITE FOR IT.
   The 44em caps above were written as if 1em were one character. It is not:
   Outfit at 17px runs about 2.47 characters per em, so 44em is a 748px box and
   it measured 105 real characters a line at 1440, with 71% of every line on
   the page over 90. ui.css already caps main prose at var(--measure) and these
   rules only outranked it by landing after the stylesheet, so this block is
   letting the site-wide decision through rather than making a new one.
   All min-width:1000, ui.css's own desktop breakpoint, so the phone and the
   tablet range keep exactly the rules they had.

   .tl-go li IS CAPPED AND IT WAS READ FIRST. It is a display-block b label
   followed by a sentence, which is prose with a bullet, not a layout row. See
   the measure block in ui.css for why there is no general li rule and why
   every list has to be looked at one at a time: a tag-based test reads this
   site's span-and-a layout rows as prose and rescaled a bar chart.
   The ul's own 44em stays, so the list box does not move, only its text.
   Measured, 1440x900, 16 August 2026. */
@media(min-width:1000px){
.tl-lede,.tl-src{max-width:var(--measure)}
.tl-s > p{max-width:var(--measure)}
.tl-go li{max-width:var(--measure)}
}`;

const body = `
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>The code card</span></nav>
      <h1>What is the <span class="hl">code card</span> in the pack?</h1>
      <p class="lede tl-lede">You get one in every booster pack, and it is the only card in there nobody keeps.
        Here is the free official game it opens, Pokemon TCG Live, what the code actually gets you, and the part
        almost everybody has wrong about it.</p>
      <p class="tl-chk">Checked against Pokemon's own pages on ${esc(longDate(d.checked))}.</p>

      <nav class="tl-jump" aria-label="Jump to a section">
        <a href="#what">What is it</a>
        <a href="#gets">What the code gives</a>
        <a href="#ours">Our own count</a>
        <a href="#redeem">Redeeming it</a>
        <a href="#get">Getting the app</a>
        <a href="#different">What is different</a>
        <a href="#which">Live or Pocket</a>
        <a href="#tips">First week</a>
        <a href="#worth">Is it worth anything</a>
      </nav>

      <section class="tl-s" id="what">
        <h2>So what <span class="hl">is</span> this thing?</h2>
        <p>Pokemon TCG Live is the official video game version of the Pokemon card game. It is free, it plays by
          the same rules as the cards on your table, and every booster pack you open comes with a code for it. It
          replaced Pokemon TCG Online, which was switched off on ${esc(tcgoOff)}; Live launched worldwide on
          ${esc(liveLaunch)}.</p>
        <p>None of which is why you are here. You are here because there is a card in the pack that is not a
          Pokemon card, it has a long code and a QR square on it, and it goes straight in a pile. This page is
          about what that pile is for.</p>
      </section>

      <section class="tl-s" id="gets">
        <h2>What the code actually <span class="hl">gets</span> you</h2>
        <p>Start with the thing almost everybody has wrong, in Pokemon's own words.</p>
        <div class="tl-shout">
          <p>The digital booster pack will not necessarily contain the same cards as the physical booster pack
            from which you received the code.</p>
          <span>Pokemon's own Code Card Redemption FAQ, read ${esc(longDate(d.checked))}.</span>
        </div>
        <p>So the digital pack is not a copy of the pack you just opened. It is its own pack from the same set,
          and pulling a hit does not hand you a second one.</p>
        <ul class="tl-go">
          <li><b>A deck code is the exception</b>A code from a preconstructed deck gives you that same deck
            digitally, containing the same cards. That contrast is the thing to remember: a deck code gives you
            the same cards, a pack code does not.</li>
          <li><b>Bigger boxes vary, and they changed in 2025</b>The packs inside an Elite Trainer Box each carry
            their own code, and the box's own code might be packs, a promo card, currency or cosmetics. Pokemon
            widened that list in July 2025 and said plainly that contents vary by product, which is why there is
            no product-by-product table here.</li>
          <li><b>You never have to guess</b>Enter a code and the app names what you are about to receive before
            you claim it, and how many codes you have already redeemed for that product. Read the screen first.</li>
          <li><b>One code, one time, one account</b>A code works once, ever, and it stays on the account you
            entered it into. Pokemon allows one account per person and says it cannot transfer cards or decks
            between them.</li>
          <li><b>Old code cards are worth trying</b>Pokemon publishes no expiry date for pack codes and nothing
            official says they run out. That is not a promise that they never will, but a shoebox of old ones is
            worth an evening. Campaign codes are a different thing and do carry end dates.</li>
          <li><b>There is a soft limit, and it is high</b>Past ${esc(boosterLimit)} booster codes from one
            expansion, further codes from it pay out a little in-game currency instead of a pack. Most people
            never get near it; if you open cases on camera, it is closer than it sounds.</li>
        </ul>
      </section>

      <section class="tl-s" id="ours">
        <h2>How many have come out of <span class="hl">our</span> packs?</h2>
        ${COUNTED ? `<p>Every rip here gets its packs counted, and a code card comes in every one, so counting packs
          counts code cards. The answer is <b>${esc(n(PACKS.english))}</b>, across
          ${esc(n(PACKS.englishRips))} filmed openings. The counting is not for this page: it is where
          <a href="/openings/">every kind of sealed product we have opened</a> gets its numbers.</p>` : `<p>A code card comes in every pack, so counting packs counts code cards. We are not printing a total
          yet, because the only honest source for it is the opening log and that is still being filled in.
          The same count is what gives <a href="/openings/">every kind of sealed product we have opened</a>
          its numbers.</p>`}
${COUNTED ? `<ul class="tl-go">
          <li><b>English packs only</b>The ${esc(n(PACKS.nonEnglish))} Japanese, Korean and Chinese packs
            opened here are held out. Pokemon says nothing either way about whether a non-English pack
            carries a code the English app takes, and the smaller honest number beats one that quietly
            picked an answer.</li>
          <li><b>It is a floor, not a total</b>Only the openings where somebody wrote the count down are
            in it, so the real figure is higher.</li>
          <li><b>Not one set, ${esc(String(PACKS.englishSets))} of them</b>A booster code gives a digital
            pack of the expansion it came out of, and these came from ${esc(
              String(PACKS.englishSets)
            )} different English expansions.</li>
          <li><b>Still nowhere near that soft limit</b>The biggest single pile counted here is
            ${esc(n(PACKS.top.packs))} packs of ${esc(PACKS.top.label)}, against the
            ${esc(boosterLimit)} above. If a channel that opens this much is not close, you are not
            close.</li>
        </ul>
${pileFig()}` : `
        <p class="tl-soon">We are counting this properly rather than quickly. Every pack opened on
          camera is being logged one video at a time, and the figure will appear here once that log is
          finished rather than before. What is already true is the part above: a code card is one
          digital pack, and the soft limit is ${esc(boosterLimit)} per expansion.</p>`}
      </section>
      <section class="tl-s" id="redeem">
        <h2>How to <span class="hl">redeem</span> one</h2>
        <p>Two routes, and they do the same job. Use whichever is in front of you.</p>
        <div class="tl-two">
          <div class="tl-box">
            <h3>In the app</h3>
            <ol>
              <li>Open the Shop.</li>
              <li>Select Redeem.</li>
              <li>Type the code, or scan the QR square with a webcam.</li>
              <li>Check each item, then select Claim Now.</li>
            </ol>
          </div>
          <div class="tl-box">
            <h3>On the web, faster for a stack</h3>
            <ol>
              <li>Go to <a href="https://redeem.tcg.pokemon.com/en-us/" rel="noopener" target="_blank"
                aria-label="Pokemon's code redemption site, redeem.tcg.pokemon.com, opens on Pokemon's site">redeem.tcg.pokemon.com</a>.</li>
              <li>Log in to the account you use for TCG Live.</li>
              <li>Enter the code and select Submit Code.</li>
              <li>Select Claim Now.</li>
            </ol>
          </div>
        </div>
        <ul class="tl-go">
          <li><b>It did not fail, it went to your Inbox</b>Some rewards land straight in your collection. Others,
            booster packs included, go to the Inbox under the Menu. That is where people decide a code did not
            work.</li>
          <li><b>Check whose account you are in first</b>Being logged in on pokemon.com is not the same as being
            logged in here, and Pokemon says you may have to log in again on the TCG Live site.</li>
          <li><b>If Redeem is not in the app on your phone, use the website</b>It works from any browser on any
            device and does exactly the same job.</li>
          <li><b>Do not bin the card until the reward has landed</b>Support asks for the code number, the screen
            name you redeemed to, and where you tried it, and says a claim without that information may be
            dismissed. If you are filming an opening, that is a floor covered in little cards and no way to prove
            anything about them.</li>
        </ul>
      </section>

      <section class="tl-s" id="get">
        <h2>Getting the <span class="hl">app</span></h2>
        <p>Four platforms: iPhone and iPad, Android, Windows and Mac. There is no play-in-a-browser version, so
          you are downloading an app. The only thing you do on the web is redeem codes.</p>
        ${appIcon("live", " is the one you want, and it is free.")}
        <p>Two things most guides skip. The Windows and Mac versions are direct downloads from Pokemon's own site
          rather than store apps, so hunting the Microsoft Store or the Mac App Store will not turn them up. And
          you need a free Pokemon account: the support site now calls it a Pokemon Trainer Central account and
          older material calls it a Pokemon Trainer Club account. Same account.</p>
        <p>For a younger player, a parent makes the account first and creates a child account under it, which
          strips out the ads and the links off to other sites and ages up on its own.</p>
        <p>You want a broadband connection and around 3GB free. The floors are ${esc(minimums)}, as of
          ${esc(longDate(sysAsOf))}, when Pokemon last raised the iPhone and Mac ones. They go up over time, so an
          old phone can stop being supported. It runs across most of the world: if your app store has it, you can
          play.</p>
      </section>

      <section class="tl-s" id="different">
        <h2>Same rules. Everything <span class="hl">around</span> them is different.</h2>
        <p>The rules are the rules. If you have never played at all,
          <a href="/how-to-play.html">read those first</a>. Everything below is only what changes when the game is
          software instead of cardboard.</p>
        ${appStrip("live", "The same game, as software.")}
        <ul class="tl-go">
          <li><b>It teaches you, then it enforces the rules</b>The Learn tab holds the Learning Lab: guided
            lessons against the computer, replayable in any order. Conceding one costs you nothing, not your level
            and not your ranked win streak.</li>
          <li><b>You start with decks already built</b>A handful of ready-made decks come with the account, so
            your first real game is five minutes away.</li>
          <li><b>You do not need luck to own a card</b>The one nobody expects. You spend Trade Credits in the deck
            editor, pick the card and the version you want, and it is yours. It is final and not refundable, so
            spend them on what a deck actually needs.</li>
          <li><b>Duplicates are not waste</b>Past the four copies you may hold, extras turn themselves into Trade
            Credits. A fifth copy is not a dud, it is progress towards the card you want, the opposite of how
            opening cardboard feels. Trainer Points, the other currency, come from quests and levelling and buy
            packs.</li>
          <li><b>Rarity is cosmetic here</b>The same card exists in several finishes and you pick one. The fancy
            print plays identically, which is the point <a href="/rarity.html">our rarity guide</a> makes about
            cardboard.</li>
          <li><b>A free Battle Pass every set</b>Each expansion brings one, unlocked by playing, paying out packs,
            decks and cosmetics at no cost.</li>
          <li><b>No chat</b>No text or voice chat at all. A few preset reactions during a game and nothing
            else.</li>
          <li><b>Standard, and Expanded with gaps</b>Expanded reaches further back and never rotates, but Live
            does not support every Expanded card: in an article last edited in July 2026, Pokemon said phased
            support for more was expected during 2026.</li>
        </ul>
      </section>

      <section class="tl-s" id="which">
        <h2>There are two free official <span class="hl">apps</span></h2>
        <p>${esc(COMPARE_ANSWER)}</p>
${compareTable(esc)}
        <p>The other one has its own page here:
          <a href="/tcg-pocket.html">what Pokemon TCG Pocket teaches you and what it does not</a>. For somebody
          holding a code card, the short version is that Pocket does not take it.</p>
      </section>

      <section class="tl-s" id="tips">
        <h2>Tips for your first <span class="hl">week</span></h2>
        <ol class="tl-steps">
          <li><b>Redeem your codes before you spend anything.</b> They cost nothing and they are the fastest
            collection you will ever build.</li>
          <li><b>Check which account you are in before you start typing.</b> Scattering codes across two accounts
            is the one mistake nobody can undo for you.</li>
          ${/* THE TWO LINKS IN THIS LIST ADD NO WORDS, and that is why they are links on existing
               text rather than a sentence of their own. This page's body copy is capped at 2,000
               words by data/tcg-live-PLAN.md and it sits within about ten of the ceiling, so the
               cross-links to the deck pages could not be a new paragraph without either blowing the
               budget or quietly moving it. Wrapping words that were already here costs nothing and
               the anchor text is better than a bolt-on sentence would have been: "Building" is
               exactly what /decks.html is for, and "what a deck needs" is exactly what
               /top-100-playable.html lists. If a later editor rewrites either tip, keep the link. */ ""}
          <li><b>Play the starter decks first.</b> They are complete, legal decks.
            <a href="/decks.html">Building</a> can wait a week.</li>
          <li><b>Spend Trade Credits on <a href="/top-100-playable.html">what a deck needs</a>, not on the pretty version.</b> Pokemon's own warning is
            that exchanging is final and not refundable, and the special version plays the same.</li>
          <li><b>Let the duplicates pile up.</b> They convert themselves and they are paying for your next
            card.</li>
          <li><b>Use the Learning Lab even if you know the rules.</b> It is the cheapest way to find out where the
            buttons are, and quitting one costs you nothing.</li>
          <li><b>Read the screen before you claim.</b> It tells you what the code gives you and how many of that
            product you have redeemed already.</li>
        </ol>
        <p>Ranked play exists. It runs in monthly seasons through a set of leagues, and the top of it is the
          Arceus League. Pokemon documents almost none of the rest publicly, so this page is not going to print
          point values it cannot stand behind.</p>
      </section>

      <section class="tl-s" id="worth">
        <h2>Does any of it actually <span class="hl">mean</span> anything?</h2>
        <figure class="tl-fig">
          ${ARROW}
          <figcaption>The code card is the only bridge between the two, and it runs one way.</figcaption>
        </figure>
        <p>Nothing comes back. There is no path from a digital collection to a card you can hold, and no trading
          in Live at all: Pokemon says players cannot trade cards with each other. It is not a catalog of what
          you own in real life either. Pokemon had an app for that, Card Dex, and shut it down on
          ${esc(cardDexOff)} with no way to export the data.</p>
        <p>And nothing in it is worth money. Pokemon's terms say virtual content has no monetary value and may not
          be redeemed for currency or anything of value outside the game. Take that at face value.</p>
        <p>Which leaves the question this audience asks, about selling unused code cards. What is verifiable: a
          redeemed code is dead, so the only sellable one is a code nobody has entered, and Pokemon's terms
          restrict transferring or reselling virtual content in ways they have not permitted. Whether that covers
          cardboard in your hand is a legal question, and we are a Pokemon channel rather than a law firm.</p>
        <p>So the honest pitch is the one at the top. The code card is the only thing in a booster pack with no
          collector value at all, and this is what it is for. When you would rather play a person than a screen,
          <a href="/shops.html">the shops around Rochester</a> run league nights.</p>
      </section>

      <div class="tl-out">
        <h2>Two links, both on Pokemon's own sites</h2>
        <p>Everything above is free and both of these are the official versions. Nothing else on this subject
          earns a slot.</p>
        <ul>
          <li><a href="https://tcg.pokemon.com/en-us/tcgl/" rel="noopener" target="_blank"
            aria-label="Pokemon TCG Live, on tcg.pokemon.com, opens on Pokemon's site">Pokemon TCG Live</a>
            <span class="tl-off">the download page</span><br>The official page, carrying all four downloads:
            iPhone and iPad, Android, Windows and Mac.</li>
          <li><a href="https://redeem.tcg.pokemon.com/en-us/" rel="noopener" target="_blank"
            aria-label="Redeem a Pokemon TCG Live code, on redeem.tcg.pokemon.com, opens on Pokemon's site">Redeem a code</a>
            <span class="tl-off">log in first</span><br>The official redemption site, and the one to use when the
            app on your phone has no Redeem option.</li>
        </ul>
      </div>

      <p class="tl-src">Everything on this page comes from Pokemon's own material, read on
        ${esc(longDate(d.checked))}: the Code Card Redemption FAQ and the support articles on installing, on
        currencies, on Trade Credits, on the Learning Lab, on deck validity, on trading and on child accounts, plus
        the official Pokemon TCG Live site, the App Store listing, Pokemon's July 2025 announcement about code
        cards and the Pokemon Terms of Use. Two things here do not rest on Pokemon. The description of how ranked
        seasons work is documented publicly only on a community wiki, which is why this page names the Arceus
        League and no numbers. And nothing official says whether pack codes expire, so the page says Pokemon
        publishes no expiry date rather than saying they never do. This is software and it moves: system
        requirements have been raised twice in eighteen months and what non-booster codes give changed in July
        2025. If the app disagrees with this page, the app is right. ${appCredit("live")}</p>
`;

// UNDER THE PLAN'S BUDGET, CHECKED RATHER THAN INTENDED, the same guard
// /how-to-play.html carries. The failure mode for a page like this is not being
// wrong, it is being complete: one more useful paragraph, eight times, and
// nobody finishes it. data/tcg-live-PLAN.md budgets 1,400 to 2,000 words of body
// copy, and both ends matter. Under it means a section got gutted.
//
// THE CEILING WAS 1,800 AND WAS RAISED ONCE, DELIBERATELY, for the code card
// count section and for nothing else. The plan's budget was written before the
// page had anything in it that was not a restatement of Pokemon's own material,
// and a ceiling exists to stop a page padding itself with more of the same. A
// section built out of this channel's own counted packs is the opposite of
// padding: it is the only part of the page that could not be written by
// somebody else. The rest of the budget did not move, and the per-section
// ceilings below still hold every other section exactly where it was, so this
// is one argued exception rather than a loosened rule. Do not raise it again
// for a section that is merely useful.
//
// The SVG and the comparison TABLE come out before counting. The diagram is a
// picture and the table is shared markup this page does not own, so counting
// either would tempt somebody to cut prose to make room for something that is
// not prose.
//
// FIGCAPTIONS COME OUT TOO, ADDED 16 AUGUST 2026 WHEN THE PAGE GAINED PICTURES,
// and it is the same argument one step further rather than a new one. This page
// was at 1,994 words against a 2,000 ceiling, so the first screenshot strip cost
// it more than it had: a caption that counts means adding a picture is paid for
// in paragraphs, which is exactly the pressure the paragraph above identifies. A
// caption exists only because a picture does.
//
// IT IS NOT A HOLE TO POUR PROSE INTO, and that is asserted below rather than
// trusted, because "put it in a caption" is the obvious way to game this. No
// single figcaption may run past 45 words, which is enough to name three files
// and not enough to hold an argument. Alt text was never counted, being an
// attribute, and it is where the long description belongs anyway.
const CAPTION = /<figcaption[^>]*>[\s\S]*?<\/figcaption>/g;
const prose = (html) =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<table[\s\S]*?<\/table>/g, " ")
    .replace(CAPTION, " ")
    .replace(/<(\w+) class="sr-only"[^>]*>[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .split(/\s+/)
    .filter(Boolean);

for (const cap of body.match(CAPTION) || []) {
  const words = cap.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean);
  if (words.length > 45) {
    throw new Error(
      `a figcaption on this page is ${words.length} words, over the 45 word cap. ` +
        "Captions do not count towards the section budgets, so they do not get to hold prose. " +
        "Move the detail into the alt text.\n  " + words.join(" ")
    );
  }
}

const sections = body.match(/<section class="tl-s"[\s\S]*?<\/section>/g) || [];
// 9 with the counted-packs section, 8 without it. That section is dropped while
// pack counts are withheld pending Tim's filled sheet (see the COUNTED note
// above), so both are correct states and only a third number is a bug.
const WANT_SECTIONS = 9;
if (sections.length !== WANT_SECTIONS)
  throw new Error(`expected ${WANT_SECTIONS} body sections, found ${sections.length}`);
const perSection = sections.map((s) => prose(s).length);
const words = perSection.reduce((a, b) => a + b, 0);
if (process.env.WORDS) {
  console.log(perSection.map((n, i) => `  section ${i + 1}: ${n}`).join("\n"));
  console.log(`  whole page including chrome: ${prose(body).length}`);
}

// Per-section ceilings as well as the total, because a total cannot see one
// section doubling while another is quietly gutted. These are the plan's own
// section budgets with a 40% allowance: they are ceilings with slack, not exact
// counts. The comparison section's budget is small because its table does not
// count towards it.
const BUDGET = [120, 350, 210, 250, 200, 300, 120, 250, 200];
perSection.forEach((n, i) => {
  const cap = Math.round(BUDGET[i] * 1.4);
  if (n > cap) {
    throw new Error(
      `section ${i + 1} is ${n} words against a budget of ${BUDGET[i]} in data/tcg-live-PLAN.md ` +
        `(ceiling ${cap}). Cut it rather than moving the number.`
    );
  }
});
if (words > 2000 || words < 1400) {
  throw new Error(
    `body copy is ${words} words, outside the 1,400 to 2,000 budget in data/tcg-live-PLAN.md.`
  );
}

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>What Is the Code Card in a Pokemon Pack? Pokemon TCG Live</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/tcg-live.html">
<meta property="og:title" content="What is the code card in the pack?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/tcg-live.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-tcg-live.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-tcg-live.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
<style>${style}</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap">
${body}
    </div>
  </section>
</main>
${footer("App facts from Pokemon's own support articles and official site, with the date they were read.")}
${APP_JS}
</body>
</html>
`;

// THE RESEARCH FILE IS FULL OF MEMOS TO THIS BUILDER and none of them are for a
// reader. /types.html shipped one verbatim once and put "Do NOT let the page
// round this to" in front of visitors, because a builder lifted a note field
// straight into copy. Every string above is either written here or pulled from a
// named field, but a later edit is one careless line away from the same bug, so
// the finished page is scanned for the voice rather than trusted.
const LEAKS = [
  /\bDO NOT\b/,
  /\bdo not print\b/i,
  /single[- ]sourced/i,
  /\bconfidence\b/i,
  /\brecommendation\b/i,
  /\bresearch file\b/i,
  /\bthe page must\b/i,
  /\bbelongs on the page\b/i,
  /\bworth putting on the page\b/i,
  /\bestablished by absence\b/i,
  /\bnot for publication\b/i,
  /couldNotVerify|singleSourced|willGoStale|wasFetched/,
];
for (const re of LEAKS) {
  const m = re.exec(page);
  if (m) throw new Error(`research-note voice reached the page: "${m[0]}". Rewrite it as reader-facing copy.`);
}
// The site rule, enforced rather than remembered: no em dashes in copy.
if (page.includes("—")) throw new Error("em dash on the page; CLAUDE.md says no em dashes in site copy");

await writeFile(join(ROOT, "public/tcg-live.html"), page);
console.log(`Wrote public/tcg-live.html
  ${words} words of body copy (budget 1,400 to 2,000)
  ${perSection.join(" / ")} per section
  code cards counted: ${PACKS.english} English packs across ${PACKS.englishRips} rips
    (${PACKS.nonEnglish} non-English packs held out, ${PACKS.englishSets} expansions,
     biggest pile ${PACKS.top.packs} ${PACKS.top.label} against the ${boosterLimit} soft limit)
  research checked ${d.checked}`);
