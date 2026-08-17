#!/usr/bin/env node
// Build /tcg-pocket.html: can you learn the card game from an app, and what
// Pokemon TCG Pocket teaches you that is not true at a table.
//
//   node scripts/build-tcg-pocket.mjs
//
// Reads data/tcg-pocket.json for everything about the app, data/how-to-play.json
// for every physical-game number it quotes, and shared/app-compare.mjs for the
// comparison table it shares with /tcg-live.html. The plan, and the argument for
// what is on the page and what is deliberately off it, is in
// data/tcg-pocket-PLAN.md.
//
// WHY THIS PAGE EXISTS. Tim plays Pocket and says it is how HE learned the card
// game: he watched the app play matches until it made sense. That is a
// first-person claim from the person whose name is on the site, and it answers a
// question a beginner actually has, which is how to learn this without somebody
// sighing at them across a table.
//
// THE HOOK HAS A SOURCING SEAM AND THE COPY IS BUILT AROUND IT. Solo battles
// against the computer, rental decks, the level 3 battle unlock, the in-app Tips
// section and the guided tutorial are all documented by Pokemon. The option that
// plays YOUR side of a solo battle for you is not, anywhere on any Pokemon
// property that could be reached. It is real and well corroborated elsewhere, so
// the page describes it in plain present tense as a thing the app does, in one
// sentence, and never dresses it up as a sourced claim or cites a wiki for it.
// The argument the page actually carries is solo battles, which are official and
// make the same watch-and-learn point: in any solo battle you are watching a
// competent computer take its turns. If the seam ever closes, this comment is
// where to start.
//
// THE ANCHOR IS THAT POCKET'S RULES ARE NOT THE CARD GAME'S RULES, and Pokemon
// says so themselves in one quotable sentence. This site's readers play with
// physical cards. A page that sells Pocket as a way to learn without that caveat
// sends somebody to a table with the wrong rules in their head, and then
// /how-to-play.html reads as if it contradicts us.
//
// EVERY PHYSICAL NUMBER IS READ OUT OF data/how-to-play.json, not typed here.
// The deck size, the Bench limit, the Prize count and the four-copy rule are
// pulled from the quotes that page already prints, with the regexes asserting
// they still say what they said. Two pages disagreeing about the rules of the
// game is the worst bug available to this pair, and it cannot happen this way.
//
// WHAT IS DELIBERATELY ABSENT, all of it in the research file:
// the Bench limit of three, the turn caps, points per Knock Out by Pokemon type,
// the first-turn Energy restriction and the premium pass price, all of which
// rest on a community wiki or on a two year old article; the current expansion
// name, which is wrong within weeks; and any claim about chat, which Pokemon
// states for Live and does not state for Pocket.
//
// NO PULL RATES, DROP RATES, ODDS OR "CHANCE OF" ANYTHING. Pocket publishes
// offering rates for its digital packs prominently. They were deliberately never
// read and no url leading to them is recorded anywhere in this repo. This also
// rules out the soft forms: no "rare", no "hard to pull", no "you will usually
// get". If a later editor finds themselves thinking "but this one publishes its
// own rates openly, quoting them is just reporting a published fact", that is
// the argument the rule exists to refuse.
//
// NO GIFT CODE LIST. They expire in weeks and they are not from Pokemon.
//
// THE ONE NUMBER THIS PAGE OWNS comes from shared/packtally.mjs: the English
// booster packs counted across the channel's own rips, which is the same figure
// /tcg-live.html builds a whole section out of. It is here in one sentence and
// no more, because on this page it is a supporting fact for "your pack codes do
// not work here" rather than the subject. It is derived at build time so the two
// pages cannot print different numbers, and it is English packs only for the
// reason set out in that file's header.
//
// THIS ENTRY USED TO READ "NO IMAGERY", on the grounds that the site does not
// use other people's pictures and there are no in-house screenshots. The owner
// has since said official Pokemon imagery may be used here, which retires the
// first half, and the second half was never a reason to have none: the
// publisher ships its own. The page now carries the app icon and three
// screenshots from the app's own App Store listing, mirrored at the size they
// are drawn by scripts/sync-app-shots.mjs and credited in the small print.
//
// ONE OF POCKET'S OWN SCREENSHOTS IS EXCLUDED AND IT IS THE FIRST ONE. It
// carries a visible "Offering Rates" button. The forbidden block in
// data/tcg-pocket.json bans stating, quoting, summarising, paraphrasing OR
// linking those, and a picture of the control is the same claim at one remove,
// so the sync pins shot indexes by hand rather than taking the first three. Do
// not "simplify" that list. Look at a shot before you pin it.
//
// The picture that is ours is still the best one on the page: the two boards
// side by side, below, which carries the whole argument of section two and lets
// the Bench be drawn as smaller without committing to a number nobody official
// has published. NOTHING IN A CAPTION OR AN ALT MAY COMMIT TO THAT NUMBER
// EITHER, which is why the strip's caption describes the file and stops.
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
const d = JSON.parse(await readFile(join(ROOT, "data/tcg-pocket.json"), "utf8"));
const hp = JSON.parse(await readFile(join(ROOT, "data/how-to-play.json"), "utf8"));

if (!d.checked) throw new Error("tcg-pocket.json has no checked date");

// THE PHYSICAL SIDE COMES OUT OF THE RULES PAGE'S OWN SOURCE FILE, quote by
// quote, so this page cannot contradict /how-to-play.html. Each of these reads
// the rulebook quote that page prints and pulls the number back out of it: if
// somebody edits the rule, the regex stops matching and the build stops rather
// than quietly shipping two different games.
const fromQuote = (quote, re, what) => {
  const m = re.exec(quote || "");
  if (!m) throw new Error(`how-to-play.json: cannot read ${what} out of "${quote}"`);
  return m[1];
};
const hpStep = (id) => {
  const s = (hp.setup?.steps || []).find((x) => x.id === id);
  if (!s) throw new Error(`how-to-play.json: no setup step "${id}"`);
  return s;
};
const hpRule = (id) => {
  const r = (hp.deckBuilding?.rules || []).find((x) => x.id === id);
  if (!r) throw new Error(`how-to-play.json: no deck rule "${id}"`);
  return r;
};
const DECK = fromQuote(hpStep("deck-60").quote, /deck of (\d+) cards/i, "the physical deck size");
const PRIZES = fromQuote(hpStep("prizes-6").quote, /top (\d+) cards/i, "the Prize card count");
const BENCH = fromQuote(
  hp.setup?.benchLimit?.quote,
  /up to (\d+) Pokemon on the Bench/i,
  "the physical Bench limit"
);
const COPIES = fromQuote(
  hpRule("four-copies").quote,
  /only have (\d+) cards with the same name/i,
  "the copies-per-name limit"
);

// The Pocket side, read off the researched differences rather than retyped. Only
// the rows whose Pocket cell is officially sourced are touched here; the Bench
// row is deliberately used for its physical half only.
const diff = (what) => {
  const row = (d.reducedRuleset?.differences || []).find((x) => x.what === what);
  if (!row) throw new Error(`tcg-pocket.json: no difference row "${what}"`);
  return row;
};
const POCKET_DECK = fromQuote(diff("Deck size").pocket, /^(\d+) cards$/i, "the Pocket deck size");
const rulesDiffer = d.reducedRuleset?.pokemonSaysSoThemselves;
if (!rulesDiffer?.quote) throw new Error("tcg-pocket.json: no quote for the rules being different");
const releaseDate = (() => {
  const row = (d.howToGet?.history?.dates || []).find((x) => /worldwide release/i.test(x.what));
  if (!row) throw new Error("tcg-pocket.json: no worldwide release date");
  return longDate(row.when);
})();
const downloadSize = (() => {
  const m = /About ([\d.]+ MB)/i.exec(d.howToGet?.deviceRequirements?.downloadSize || "");
  if (!m) throw new Error("tcg-pocket.json: cannot read the download size");
  return m[1];
})();

// ---------------------------------------------------------------------------
// THE TWO BOARDS, SIDE BY SIDE.
//
// The best picture available to either of these pages, and it carries section
// two's entire argument in one glance: the same game shape, different furniture.
// The physical side is drawn from the numbers above, so the diagram cannot drift
// from /how-to-play.html either.
//
// THE POCKET BENCH IS ONE WIDE BOX RATHER THAN A COUNT OF SLOTS, and that is the
// whole reason this drawing works. No official Pokemon page states Pocket's
// Bench limit; only a community wiki does. Drawing three slots would assert the
// number in a picture, which is exactly the assertion the copy declines to make.
// A single box labelled "smaller" is honest and reads faster anyway.
const box = (x, y, w, h, label, cls = "") =>
  `<g class="tb-s ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>` +
  `<text x="${x + w / 2}" y="${y + h / 2 + 2.2}" text-anchor="middle">${label}</text></g>`;

const BOARDS = `<svg class="tb" viewBox="0 0 300 148" role="img"
  aria-label="The two games side by side. With physical cards you have one Active Pokemon, a Bench of up to ${esc(BENCH)}, ${esc(PRIZES)} Prize cards set aside and Energy cards in your ${esc(DECK)} card deck. In Pokemon TCG Pocket you have one Active Pokemon, a smaller Bench, three points to win instead of Prize cards, and an Energy Zone that hands you one Energy a turn instead of Energy cards.">
  <text class="tb-h" x="74" y="9" text-anchor="middle">WITH YOUR CARDS</text>
  ${[0, 1, 2, 3, 4].map((i) => box(8 + i * 27, 14, 24, 16, "Bench")).join("")}
  ${box(52, 36, 44, 20, "ACTIVE", "tb-a")}
  ${box(8, 62, 60, 16, `Prizes x${PRIZES}`, "tb-p")}
  ${box(76, 62, 64, 16, "Deck + Energy", "tb-d")}
  <text class="tb-k" x="74" y="94" text-anchor="middle">${esc(DECK)} cards. Energy cards live in the deck.</text>
  <text class="tb-k" x="74" y="105" text-anchor="middle">Take all ${esc(PRIZES)} of your Prizes to win.</text>
  <text class="tb-k" x="74" y="116" text-anchor="middle">Up to ${esc(BENCH)} on the Bench.</text>
  <line class="tb-div" x1="150" y1="4" x2="150" y2="126"/>
  <text class="tb-h" x="226" y="9" text-anchor="middle">IN POCKET</text>
  ${box(160, 14, 132, 16, "Bench, smaller")}
  ${box(204, 36, 44, 20, "ACTIVE", "tb-a")}
  ${box(160, 62, 60, 16, "3 points", "tb-p")}
  ${box(228, 62, 64, 16, "Energy Zone", "tb-d")}
  <text class="tb-k" x="226" y="94" text-anchor="middle">${esc(POCKET_DECK)} cards. No Energy cards at all.</text>
  <text class="tb-k" x="226" y="105" text-anchor="middle">Three points to win. No Prize cards.</text>
  <text class="tb-k" x="226" y="116" text-anchor="middle">The Bench holds fewer.</text>
</svg>`;
// The diagram used to caption itself here, one line above the <figcaption> that
// says the same thing again in different words ("Same shape, different numbers.
// The left one is the game your cards play." over "The same game shape with
// different furniture. The left half is the one your cards play."). A reader
// gets the sentence twice. The sibling diagram on /tcg-live.html carries a
// figcaption and no in-image footer, so that is the shape both pages now use.
// Nothing is lost for a screen reader either: the <svg> is role="img" with its
// own aria-label, which makes everything inside it presentational.

const desc =
  "Pokemon TCG Pocket is free, and its rules are not the card game's rules. " +
  "What it teaches you, what it does not, and why your pack codes are for Live.";
// Google truncates the snippet around 160 characters, so this is measured rather
// than hoped for. Same guard build-pack-prices.mjs carries.
if (desc.length > 160) throw new Error(`meta description is ${desc.length} characters, over 160:\n${desc}`);

const QA = [
  [
    "Can you learn the Pokemon card game from Pokemon TCG Pocket?",
    "Partly. Evolution, Energy costs, Weakness, Retreat, Abilities, the Active spot and the Bench all work the way they do with real cards, and watching solo battles against the computer teaches you the shape of a game. The numbers are different, and Pokemon says outright that Pocket's rules are not the card game's rules.",
  ],
  [
    "How is Pokemon TCG Pocket different from the real card game?",
    `A Pocket deck is ${POCKET_DECK} cards rather than ${DECK}, with at most two copies of a name. There are no Energy cards at all: an Energy Zone gives you one Energy a turn. There are no Prize cards, and you win by scoring three points instead. The Bench is smaller than the ${BENCH} you get with physical cards.`,
  ],
  [
    "Can I use my booster pack code card in Pokemon TCG Pocket?",
    "No. The code card in a physical booster pack is for Pokemon TCG Live. Pocket has no pack code redemption at all. Its own gift codes come from campaigns and are entered on a web page rather than in the app.",
  ],
  [
    "Is Pokemon TCG Pocket free?",
    "Yes, with optional in-app purchases. You do not need a Pokemon account to play, and you open two free booster packs a day.",
  ],
  [
    "Which should I install, Pokemon TCG Live or Pokemon TCG Pocket?",
    "Live is the card game itself with the same rules and a use for your pack codes. Pocket is a smaller, faster game of its own on a phone. Live needs a free Pokemon account and Pocket does not. Both are free and installing both costs nothing.",
  ],
];

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Learning from an app" },
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
.tp-lede{max-width:44em}
.tp-chk{font:400 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);margin-top:var(--s3)}
.tp-s{margin-top:var(--s6);scroll-margin-top:var(--s5)}
.tp-s > p{max-width:44em;line-height:1.6}
.tp-s > p + p{margin-top:var(--s3)}
.tp-jump{display:flex;flex-wrap:wrap;gap:8px;margin:var(--s5) 0 0}
.tp-jump a{display:inline-flex;align-items:center;min-height:40px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.tp-jump a:hover{border-color:var(--ink);background:var(--mustard)}
.tp-shout{border:3px solid var(--navy);border-radius:12px;background:var(--navy);color:var(--chrome-ink);
  padding:var(--s4) var(--s5);margin:var(--s4) 0;box-shadow:var(--hard-lg);max-width:44em}
.tp-shout p{font:400 var(--t-m)/1.3 var(--display);color:var(--chrome-ink)}
.tp-shout span{display:block;margin-top:var(--s3);font-size:var(--t-sm);color:var(--foot-ink);line-height:1.5}
.tp-go{list-style:none;margin:var(--s4) 0 0;padding:0;max-width:44em}
.tp-go li{border-left:4px solid var(--gold);padding-left:var(--s3);margin-bottom:var(--s4);line-height:1.55}
.tp-go b{display:block;font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink-2);margin-bottom:4px}
.tp-diff li{border-left-color:var(--ketchup)}
.tp-steps{counter-reset:tp;list-style:none;margin:var(--s4) 0 0;padding:0;max-width:44em}
.tp-steps li{counter-increment:tp;position:relative;padding-left:38px;margin-bottom:var(--s3);line-height:1.55}
.tp-steps li::before{content:counter(tp);position:absolute;left:0;top:0;width:26px;height:26px;
  display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--navy);
  color:var(--chrome-ink);font:700 var(--t-micro)/1 var(--mono)}
.tp-fig{margin:var(--s4) 0 0;max-width:44em}
.tp-fig figcaption{margin-top:var(--s2);font-size:var(--t-micro);color:var(--ink-2);line-height:1.5}
.tb{width:100%;height:auto;display:block;background:var(--paper-2);border-radius:8px;padding:6px 0}
.tb-s rect{fill:var(--card);stroke:var(--ink);stroke-width:1}
.tb-s text{font:700 4.6px var(--mono);fill:var(--ink-2);letter-spacing:.03em}
.tb-a rect{fill:var(--mustard);stroke-width:1.6}
.tb-a text{fill:var(--ink)}
.tb-p rect{fill:var(--gold);stroke-width:1.6}
.tb-p text{fill:#2A2005}
.tb-d rect{stroke-dasharray:3 2}
.tb-h{font:700 6px var(--mono);fill:var(--ink);letter-spacing:.1em}
.tb-div{stroke:var(--ink);stroke-width:1;stroke-dasharray:4 3;opacity:.5}
.tb-k{font:400 5px var(--mono);fill:var(--ink-2)}
.tb-f{font-size:5.2px;fill:var(--ink)}
.tp-out{border:3px dashed var(--navy);border-radius:12px;background:var(--card);padding:var(--s4);
  margin-top:var(--s6);max-width:44em}
.tp-out h2{margin-bottom:var(--s2)}
.tp-out > p{font-size:var(--t-sm);line-height:1.55;color:var(--ink-2)}
.tp-out ul{list-style:none;margin:var(--s3) 0 0;padding:0}
.tp-out li{margin-bottom:var(--s3);font-size:var(--t-sm);line-height:1.5}
.tp-out a{font-weight:700}
.tp-out .tp-off{display:inline-block;font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2);margin-left:6px}
.tp-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s6);line-height:1.6;max-width:46em}
${APP_SHOT_CSS}
${COMPARE_CSS}

/* DESKTOP READING MEASURE. The 44em caps above were written as if 1em were one
   character. It is not: Outfit at 17px runs about 2.47 characters per em, so
   44em is a 748px box and it measured 108 real characters a line at 1440, with
   75% of every line on the page over 90, the highest share on the site.
   ui.css already caps main prose at var(--measure) and these rules only
   outranked it by landing after the stylesheet, so this block is letting the
   site-wide decision through rather than making a new one. All min-width:1000,
   ui.css's own desktop breakpoint, so the phone and the tablet range keep
   exactly the rules they had.

   .tp-go li IS CAPPED AND IT WAS READ FIRST. It is a display-block b label
   followed by a sentence, which is prose with a bullet, not a layout row. See
   the measure block in ui.css for why there is no general li rule: a tag-based
   test reads this site's span-and-a layout rows as prose and rescaled a bar
   chart. The ul's own 44em stays, so the list box does not move, only its
   text. Measured, 1440x900, 16 August 2026. */
@media(min-width:1000px){
.tp-lede,.tp-src{max-width:var(--measure)}
.tp-s > p{max-width:var(--measure)}
.tp-go li{max-width:var(--measure)}
}`;

const body = `
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Learning from an app</span></nav>
      <h1>Can you learn the card game from an <span class="hl">app</span>?</h1>
      <p class="lede tp-lede">Pokemon TCG Pocket is free, it is on your phone, and it is how Tim learned to play.
        Here is what it teaches you, what it quietly does not, and why the code cards from your packs have nothing
        to do with it.</p>
      <p class="tp-chk">Checked against Pokemon's own pages on ${esc(longDate(d.checked))}.</p>

      <nav class="tp-jump" aria-label="Jump to a section">
        <a href="#what">What it is</a>
        <a href="#teaches">What it teaches</a>
        <a href="#codes">Your pack codes</a>
        <a href="#which">Which one</a>
        <a href="#get">Getting it</a>
        <a href="#inside">What is in it</a>
        <a href="#tips">First week</a>
      </nav>

      <section class="tp-s" id="what">
        <h2>What it <span class="hl">is</span></h2>
        <p>Pokemon Trading Card Game Pocket is the official free Pokemon card game for phones. It is made by
          Creatures Inc., who made the physical card game, along with DeNA, and it came out on
          ${esc(releaseDate)}. You open two free booster packs a day and you can battle.</p>
        <p>Tim learned to play from it. Not from a rulebook and not across a table from somebody sighing at him.
          The app has solo battles against the computer, and in a solo battle you can switch on an auto option and
          let the app take your turns while you watch. Watch enough turns and the game starts to make sense.</p>
        <p>That works, which is why this page exists. It also comes with a catch big enough that Pokemon spell it
          out themselves, and that is the next section.</p>
      </section>

      <section class="tp-s" id="teaches">
        <h2>What it teaches you, and what it <span class="hl">does not</span></h2>
        <div class="tp-shout">
          <p>${esc(rulesDiffer.quote.split(" Please check")[0])}</p>
          <span>Pokemon's own Pokemon TCG Pocket Gameplay FAQ, last edited
            ${esc(longDate(rulesDiffer.articleEdited))}, read ${esc(longDate(d.checked))}.</span>
        </div>
        <p><b>Start with what carries over, because it is most of it.</b> Basic, Stage 1 and Stage 2 Pokemon, and
          evolving one onto another. Attacks that cost Energy. Weakness. Retreat. Abilities. Trainer and Supporter
          cards. One Active Pokemon facing your opponent's with the rest on the Bench. Drawing a card at the start
          of your turn. Knock Outs. That is the shape of the card game, and it is why watching this thing play
          teaches you something real.</p>
        ${appStrip("pocket", "The app, on its own terms.")}
        <p><b>Then four things that do not carry over</b>, each of which would trip you up at a table.</p>
        <ul class="tp-go tp-diff">
          <li><b>The deck is ${esc(POCKET_DECK)} cards, not ${esc(DECK)}</b>And at most two copies of a name,
            where the game your cards play allows up to ${esc(COPIES)} copies of a card, basic Energy
            excepted.</li>
          <li><b>There are no Energy cards</b>This is the one that matters. An Energy Zone hands you one Energy a
            turn and you attach it wherever you like. Nothing in the deck, nothing to draw. Somebody who learned
            here builds a real deck with no Energy in it and then cannot attack.</li>
          <li><b>There are no Prize cards</b>You score three points by knocking Pokemon out instead. There is no
            row of ${esc(PRIZES)} cards counted off to the side, nothing to take, and none of the tension that
            gives a real game.</li>
          <li><b>The Bench is smaller</b>Smaller than the ${esc(BENCH)} you get with physical cards.</li>
        </ul>
        <p>The cards themselves are their own thing too. Pocket's expansions carry their own codes, many of its
          cards have never been printed on cardboard, and none of them are in our set guides.</p>
        <figure class="tp-fig">
          ${BOARDS}
          <figcaption>The same game shape with different furniture. The left half is the one your cards play.</figcaption>
        </figure>
        <p>So it teaches you the shape and not the numbers, and the numbers are what somebody corrects you on.
          When you want the real ones, <a href="/how-to-play.html">the rules of the game you play with actual
          cards</a> are the ones to have in your head at a table.</p>
      </section>

      <section class="tp-s" id="codes">
        <h2>Your pack codes do not <span class="hl">work</span> here</h2>
        <p>The code card in a physical booster pack is not for this app. Pokemon's own description of what is in a
          booster pack says the code in it is redeemed in Pokemon TCG Live, and Pocket has no pack code redemption
          at all: it does not appear anywhere in the app's own documentation.</p>
        <p>Pocket does have codes, which is where the confusion starts. They are gift codes from campaigns and
          events, they are entered on a separate web page using your in-game Support ID rather than inside the
          app, and they have nothing to do with anything you bought in a shop. We do not publish lists of them,
          because they expire in weeks and a page full of dead codes helps nobody.</p>
        <p>This is not a small pile to be wrong about. ${esc(
          PACKS.english.toLocaleString("en-US")
        )} English booster packs have been counted on this channel, every one of them with a code card
          in it, and not one of those codes does anything here. If you are sitting on a stack of them,
          <a href="/tcg-live.html">the other page explains what they are actually worth</a>.</p>
      </section>

      <section class="tp-s" id="which">
        <h2>So which one should you <span class="hl">install</span>?</h2>
        <p>${esc(COMPARE_ANSWER)}</p>
${compareTable(esc)}
        <p>Neither one is better. They are two different games with the same artwork on the front.</p>
      </section>

      <section class="tp-s" id="get">
        <h2>Getting <span class="hl">it</span></h2>
        <p>Two platforms and both are mobile: the App Store and Google Play. No Windows version, no Mac version
          and nothing in a browser, which is the row in that table most likely to catch you out. It is free with
          optional in-app purchases and it is about ${esc(downloadSize)} to download, so check the phone has
          room.</p>
        ${appIcon("pocket", " is the one to search for. The other app's icon is a different colour.")}
        <p>You are not asked for a Pokemon account. You pick a country and region, confirm your age, accept the
          terms and you are in. Link a Nintendo, Google or Apple account on the first day anyway: Pokemon says
          that if you reinstall without linking, you will not be able to recover your save data yourself. Under a
          certain age only a Nintendo account can be linked, and Pokemon does not print the age because it differs
          by country.</p>
        <p>As of July 2026 Pokemon asks for a phone from the last several years with 3GB of memory, running iOS
          15 or Android 7 or later, and says even that is not a guarantee on every device. If your app store has
          it, you can play.</p>
      </section>

      <section class="tp-s" id="inside">
        <h2>What is actually <span class="hl">in</span> it</h2>
        <ul class="tp-go">
          <li><b>Two free packs a day</b>On a twelve-hour timer. That is the whole pitch and it costs nothing:
            pack opening, every day, forever. For anybody who watches this channel it is the cheap version of the
            same feeling.</li>
          <li><b>Pack points, which is the good one</b>Opening packs from an expansion earns pack points for that
            expansion, and those points buy one specific card from it. They do not expire. If the card you want
            never turns up, you go and get it. Nothing in the physical hobby works like that, and it is the thing
            most worth knowing about the app.</li>
          <li><b>Wonder Pick</b>You take one card from a set of face-down cards out of a pack somebody else
            opened. It runs on its own timer, and adding friends puts their openings into yours.</li>
          <li><b>Trading, which Live does not have</b>Friends only, unlocked two weeks after you start, and both
            cards have to match on rarity. The app carries the current list of what is eligible and shows what a
            trade costs before you confirm. The app called Trading Card Game Live does not trade. The casual one
            does.</li>
          <li><b>Solo and versus</b>Solo battles, step-up battles that ladder up in difficulty, and limited-time
            solo events, all against the computer. Versus is against people and there is a ranked ladder running
            in seasons. Battles are not there the moment you install: they unlock at player level 3.</li>
          <li><b>The paid parts</b>Poke gold is a currency you buy and it mostly buys speed, shortening the waits.
            The premium pass is a monthly subscription and the app shows what it costs. Neither is required and
            the free packs are the game.</li>
        </ul>
        <p>There is a collecting half as well: a card dex, binders and display boards you arrange and can show
          other players, and cosmetic flair on cards. It runs its own ladder of rarity marks, and they are not the
          ones printed on your cards, which is what <a href="/rarity.html">our rarity guide</a> is about.</p>
      </section>

      <section class="tp-s" id="tips">
        <h2>Tips for your first <span class="hl">week</span></h2>
        <ol class="tp-steps">
          <li><b>Link an account on day one.</b> Without one, a reinstall or a lost phone takes everything with
            it, and Pokemon says you will not be able to recover it yourself.</li>
          <li><b>Open both free packs every day,</b> and claim your daily rewards before the day rolls over.
            Pokemon resets it at 6:00 a.m. UTC, which is 2:00 a.m. in Rochester in the summer and 1:00 a.m. in the
            winter.</li>
          <li><b>Do not panic when there is no Battle button.</b> Battles unlock at player level 3, and you get
            there by opening packs and playing with the collecting side first.</li>
          <li><b>Use a rental deck for your first matches.</b> The app lends you complete decks, they work in solo
            battles, and each one has a limited number of uses, so spend them learning rather than hoarding
            them.</li>
          <li><b>Play the solo battles before you play people,</b> and watch what the computer does with its turn.
            That is the whole trick, and it is how Tim learned.</li>
          <li><b>Buy the card you want with pack points</b> rather than waiting for it to turn up.</li>
          <li><b>Add friends early.</b> Trading and sharing both unlock two weeks in and both need them, and
            friends' pack openings feed your Wonder Pick.</li>
        </ol>
        <p>That is the lot. It is free, it is two minutes a day, and it is how the guy who runs this channel
          learned to play. When you want the real thing, <a href="/how-to-play.html">the rules are here</a> and
          <a href="/shops.html">the shops around Rochester</a> will have somebody to play against.</p>
      </section>

      <div class="tp-out">
        <h2>One link, on Pokemon's own site</h2>
        <p>The official site, which is where both store buttons live. It is a download page rather than a guide,
          so do not go there looking for the rules.</p>
        <ul>
          <li><a href="https://tcgpocket.pokemon.com/en-us/" rel="noopener" target="_blank"
            aria-label="Download Pokemon TCG Pocket, on tcgpocket.pokemon.com, opens on Pokemon's site">Download Pokemon TCG Pocket</a>
            <span class="tp-off">App Store and Google Play</span><br>The official page for the app, carrying both
            store links.</li>
        </ul>
      </div>

      <p class="tp-src">Everything about the app on this page comes from Pokemon's own material, read on
        ${esc(longDate(d.checked))}: the Pocket Gameplay, Battle Rules, Trading, Sharing, Purchase, Account Link,
        Gift Code and Technical support articles, Pokemon's own guides to building a deck and to collecting, the
        official Pokemon TCG Pocket site and both store listings. Every number about the physical card game is
        taken from the same rulebook quotes that <a href="/how-to-play.html">our rules page</a> prints, so the two
        pages cannot disagree. Two things are worth saying plainly. Pokemon publishes no Bench limit for Pocket,
        which is why this page says the Bench is smaller and gives no number. And Pokemon documents the solo
        battles, the rental decks and the level 3 unlock but not the option that plays your side for you, so that
        one sentence describes how the app behaves rather than repeating a Pokemon page. The app updates roughly
        monthly and several things named here were added after launch, so if you find something missing this page
        is behind rather than wrong. If the app disagrees with this page, the app is right. ${appCredit("pocket")}</p>
`;

// THE PLAN BUDGETS 1,300 TO 1,600 WORDS, and both ends are checked. Less than
// the Live page, because this one has no multi-step instruction in it: no
// redemption process, no account creation, no desktop installer. Pages like this
// go wrong by padding. Under the floor means a section got gutted.
//
// The SVG and the shared comparison TABLE come out before counting: one is a
// picture, the other is markup this page does not own, and counting either would
// tempt somebody to cut prose to make room for something that is not prose.
//
// FIGCAPTIONS COME OUT TOO, and it is the same argument one step further. A
// caption exists only because a picture does, so counting it means adding a
// picture is paid for in paragraphs, which is the pressure the line above is
// about. The sibling page hit exactly that on the day it gained screenshots.
// The cap below is what stops it becoming a hole to pour prose into.
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
  const capWords = cap.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean);
  if (capWords.length > 45) {
    throw new Error(
      `a figcaption on this page is ${capWords.length} words, over the 45 word cap. ` +
        "Captions do not count towards the section budgets, so they do not get to hold prose. " +
        "Move the detail into the alt text.\n  " + capWords.join(" ")
    );
  }
}

const sections = body.match(/<section class="tp-s"[\s\S]*?<\/section>/g) || [];
if (sections.length !== 7) throw new Error(`expected 7 body sections, found ${sections.length}`);
const perSection = sections.map((s) => prose(s).length);
const words = perSection.reduce((a, b) => a + b, 0);
if (process.env.WORDS) {
  console.log(perSection.map((n, i) => `  section ${i + 1}: ${n}`).join("\n"));
  console.log(`  whole page including chrome: ${prose(body).length}`);
}

const BUDGET = [150, 350, 150, 120, 150, 300, 250];
perSection.forEach((n, i) => {
  const cap = Math.round(BUDGET[i] * 1.4);
  if (n > cap) {
    throw new Error(
      `section ${i + 1} is ${n} words against a budget of ${BUDGET[i]} in data/tcg-pocket-PLAN.md ` +
        `(ceiling ${cap}). Cut it rather than moving the number.`
    );
  }
});
if (words > 1600 || words < 1300) {
  throw new Error(
    `body copy is ${words} words, outside the 1,300 to 1,600 budget in data/tcg-pocket-PLAN.md.`
  );
}

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pokemon TCG Pocket: Can You Learn the Card Game From an App?</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/tcg-pocket.html">
<meta property="og:title" content="Can you learn the card game from an app?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/tcg-pocket.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-tcg-pocket.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-tcg-pocket.jpg">
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
${footer("App facts from Pokemon's own support articles and guides, with the date they were read.")}
${APP_JS}
</body>
</html>
`;

// THE RESEARCH FILE IS FULL OF MEMOS TO THIS BUILDER and none of them are for a
// reader. /types.html shipped one verbatim once and put "Do NOT let the page
// round this to" in front of visitors, because a builder lifted a note field
// straight into copy. The one field this page quotes wholesale is a Pokemon
// sentence, but a later edit is one careless line from the same bug, so the
// finished page is scanned for the voice rather than trusted.
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
  /couldNotVerify|singleSourced|willGoStale|wasFetched|theHook/,
];
for (const re of LEAKS) {
  const m = re.exec(page);
  if (m) throw new Error(`research-note voice reached the page: "${m[0]}". Rewrite it as reader-facing copy.`);
}
// The site rule, enforced rather than remembered: no em dashes in copy.
if (page.includes("—")) throw new Error("em dash on the page; CLAUDE.md says no em dashes in site copy");

await writeFile(join(ROOT, "public/tcg-pocket.html"), page);
console.log(`Wrote public/tcg-pocket.html
  ${words} words of body copy (budget 1,300 to 1,600)
  ${perSection.join(" / ")} per section
  physical numbers from data/how-to-play.json: ${DECK} card deck, Bench ${BENCH}, ${PRIZES} Prizes, ${COPIES} copies
  research checked ${d.checked}`);
