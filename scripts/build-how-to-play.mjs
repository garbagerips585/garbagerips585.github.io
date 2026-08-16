#!/usr/bin/env node
// Build /how-to-play.html: Pokemon TCG 101, for somebody who opens packs and
// has never played a game.
//
//   node scripts/build-how-to-play.mjs
//
// Reads data/how-to-play.json, where every rule carries the source it came from
// and the page of the PDF it is printed on. The primary is the current official
// web rulebook (ME05 Pitch Black, printed LAST UPDATED: JULY 2026), which was
// diffed line by line against the March 2026 printing: nothing in setup, the
// turn, winning, prizes or the printed card numbers moved.
//
// THE FAILURE MODE HERE IS NOT BEING WRONG, IT IS BEING COMPLETE. The research
// file holds a 44 page rulebook. A faithful summary of it is a page nobody
// finishes, and the reader is not looking for rules, they are deciding whether
// this is a thing they want to try. So the whole job is subtraction and
// data/how-to-play-PLAN.md's leave-out list is the more important half of the
// plan. Under 1,500 words of body copy, asserted at the bottom of this file so
// it is a rule rather than an aspiration.
//
// WHAT IS DELIBERATELY NOT HERE, all of it real, current and in the JSON:
// Special Conditions (five states, each with its own flip, marker or rotation,
// plus a resolution order) get ONE sentence; Pokemon Checkup exists only to
// hold what that sentence cut; all 28 appendix mechanics get one line; the 11
// Energy types get a link instead of a list, because listing them invites a
// type chart, which is the exact idea section 5 exists to deny; the six step
// damage calculation, deck-building ratios, the Unlimited format, tiebreakers
// and the mulligan's full timing are all out.
//
// TWO SOURCE TRAPS, both already decided in the plan and both easy to walk back
// into.
//
// ONE. The rulebook's own "go and learn" page tells a new player to ask for a
// League Battle Deck. The official Product Guide files League Battle Decks
// under "FOR EXPERIENCED TRAINERS!" and puts ex Battle Decks and Battle Academy
// under "START HERE!". Both documents are official and both are current; the
// rulebook line reads like a product name search-and-replaced in July 2026 (it
// said "Mega Battle Deck" in March) without the tiering being rechecked. THIS
// PAGE FOLLOWS THE PRODUCT GUIDE and does not repeat the rulebook's line.
//
// TWO. The official Quick Start Rules PDF opens with "The first player to Knock
// Out 6 Pokemon wins the game!". That stops being true the moment a Pokemon ex
// is on the table, which is most of the time now, so the three ways to win here
// are the rulebook's and the Quick Start phrasing is not used.
//
// NO PRICES, ANYWHERE. pokemoncenter.com answers a bot-detection page to every
// automated request tried, so no official price could be read, and a number off
// a reseller is not an MSRP and would be stale in a fortnight. The page says
// ask the counter and links /shops.html.
//
// NO ODDS, ANYWHERE. The TCG Live page carries a "Card Drop Rate Information"
// link and it is deliberately absent from the research file. Do not link it,
// quote it or summarise it.
//
// FOUR OUTBOUND LINKS, WHICH IS AN EXCEPTION TO A RULE IN CLAUDE.md, and the
// exception is recorded in that file rather than made quietly here. A 101 page
// that refuses to name the official free way to learn is worse for the reader
// than one that does, and we cannot host the rulebook. They sit in ONE labelled
// block at the very end, after every internal link, each saying it leaves the
// site, exactly as the playlist cards do.
//
// NO BACKTICKS IN COMMENTS IN THIS FILE. The page below is one template literal
// and a backtick inside a comment closes it. That has broken this build three
// times, which is why check-build.py now runs node --check over every .mjs.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS } from "../shared/chrome.mjs";
import { esc, longDate, imgDims, avifPicture } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(await readFile(join(ROOT, "data/how-to-play.json"), "utf8"));

// LIFT THE `plain` FIELDS, NEVER THE NOTES. The research file says so itself:
// `plain` is "the beginner-facing sentence a builder can lift", while `note`,
// `confidence`, `why` and `recommendation` are memos addressed to this file.
// The types page next door printed its research notes verbatim once and shipped
// an instruction to the reader, so this is a rule with a scar behind it.
const plain = (path) => {
  const v = path.split(".").reduce((o, k) => (o == null ? o : o[k]), d);
  if (typeof v !== "string" || !v) throw new Error(`how-to-play.json: no plain string at ${path}`);
  return esc(v);
};

const setup = d.setup || {};
const turn = d.turn || {};
const win = d.howToWin || {};
const combat = d.combat || {};
const ko = d.knockOut || {};
const cards = d.cardTypes || {};
const start = d.gettingStarted || {};
const lc = d.labelledCard;
if (!lc) throw new Error("how-to-play.json has no labelledCard");

// The once-per-turn split as a TWO COLUMN TABLE, not prose, and read off the
// `limit` field rather than pattern matched out of the sentence. Prose about
// limits is how a beginner loses track of them.
const once = (turn.actions || []).filter((a) => /ONCE PER TURN/.test(a.limit || ""));
const many = (turn.actions || []).filter((a) => !/ONCE PER TURN/.test(a.limit || ""));
if (!once.length || !many.length) throw new Error("how-to-play.json: the turn actions no longer split by limit");

// Trainer cards are their own once-per-turn question, so the Supporter and the
// Stadium go in the left column by hand: their limit lives on the subtype, not
// on the single "trainers" action that covers all four.
const ONCE_EXTRA = ["Play a Supporter card", "Play a Stadium card"];
const MANY_EXTRA = ["Play Item and Pokemon Tool cards"];

// The prize table. Rows are collapsed from the JSON's seven, because the reader
// needs the SHAPE (ordinary 1, big 2, biggest 3) and not a lookup table of
// seven card families, four of which are out of the current format.
const PRIZES = [
  ["An ordinary Pokemon", 1],
  ["A Pokemon ex, V, VSTAR or GX", 2],
  ["A Mega Evolution Pokemon ex, or a VMAX", 3],
];
// Checked against the researched table rather than typed and trusted, because
// this is the one number on the page a player would actually get wrong mid-game.
{
  const byKind = new Map((ko.extraPrizes?.table || []).map((r) => [r.kind, r.prizes]));
  const expect = [
    ["ordinary Pokemon", 1], ["Pokemon ex", 2], ["Pokemon V and VSTAR", 2],
    ["Pokemon-GX", 2], ["Mega Evolution Pokemon ex", 3], ["Pokemon VMAX", 3],
  ];
  for (const [kind, n] of expect) {
    if (byKind.get(kind) !== n) {
      throw new Error(`how-to-play.json: prize count for "${kind}" is ${byKind.get(kind)}, this page says ${n}`);
    }
  }
}

// ---------------------------------------------------------------------------
// THE BOARD DIAGRAM.
//
// The single highest value picture on the page: the reader has never seen a
// table laid out and every section after the setup refers to positions on it.
// Inline SVG rather than an image, so it is one request that is already paid
// for, scales to any width and stays legible at 390px.
//
// COLOURS COME FROM THE STYLESHEET'S OWN TOKENS via currentColor and CSS
// variables rather than being baked into the markup, so it cannot drift from
// the site the way a hardcoded hex would. There is only one theme on this site
// today; doing it this way means the diagram does not have to be found and
// fixed if that ever stops being true.
//
// THE PRIZE CARDS ARE LABELLED LOUDEST, because the Knock Outs section depends
// on the reader knowing they are their own six and not the opponent's.
const slot = (x, y, w, h, label, cls = "") =>
  `<g class="bd-s ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>` +
  `<text x="${x + w / 2}" y="${y + h / 2 + 3.5}" text-anchor="middle">${label}</text></g>`;

const BOARD = `<svg class="bd" viewBox="0 0 300 214" role="img"
  aria-label="A Pokemon card game table. Each player has an Active Pokemon in the middle, a Bench of up to five Pokemon behind it, their own deck and discard pile to one side, and their own six Prize cards to the other.">
  <text class="bd-h" x="150" y="10" text-anchor="middle">YOUR OPPONENT</text>
  ${[0, 1, 2, 3, 4].map((i) => slot(64 + i * 35, 16, 30, 22, "Bench")).join("")}
  ${slot(6, 16, 52, 22, "Prizes x6", "bd-p")}
  ${slot(242, 16, 52, 22, "Deck", "bd-d")}
  ${slot(132, 44, 36, 26, "ACTIVE", "bd-a")}
  ${slot(242, 44, 52, 22, "Discard", "bd-d")}
  <line class="bd-net" x1="6" y1="86" x2="294" y2="86"/>
  <text class="bd-net-t" x="150" y="83" text-anchor="middle">the two players face each other</text>
  ${slot(132, 100, 36, 26, "ACTIVE", "bd-a")}
  ${slot(242, 100, 52, 22, "Discard", "bd-d")}
  ${[0, 1, 2, 3, 4].map((i) => slot(64 + i * 35, 132, 30, 22, "Bench")).join("")}
  ${slot(6, 132, 52, 22, "Prizes x6", "bd-p")}
  ${slot(242, 132, 52, 22, "Deck", "bd-d")}
  <text class="bd-h" x="150" y="170" text-anchor="middle">YOU</text>
  <text class="bd-k" x="150" y="186" text-anchor="middle">Only the Active Pokemon can attack. The Bench waits.</text>
  <text class="bd-k" x="150" y="199" text-anchor="middle">The Prize cards you take are your OWN six,</text>
  <text class="bd-k" x="150" y="209" text-anchor="middle">and you do not know what they are until you take them.</text>
</svg>`;

// The labelled card. Real scan, never a drawing: the whole point is that the
// reader can find these numbers on a card in their own hand. imgDims decides
// the attributes, avifPicture adds the AVIF with the WebP left underneath, and
// it is an <img loading="lazy"> rather than a CSS background because a
// background cannot be lazy. rarity.html went 2,536KB to 388KB on exactly that
// change.
const cardImg = (() => {
  const low = `${lc.img}/low.webp`;
  const high = `${lc.img}/high.webp`;
  return avifPicture(
    `<img src="${esc(low)}" srcset="${esc(low)} 245w, ${esc(high)} 600w" sizes="190px"` +
      ` alt="${esc(lc.card)}, ${esc(lc.set)} number ${esc(lc.number)}, a Basic Pokemon card"` +
      ` loading="lazy" decoding="async" onerror="this.remove()"${imgDims(low)}>`
  );
})();

const LABELS = [
  ["HP, top right", `${lc.hp}. The damage it takes to knock this one out.`],
  ["Attack cost, left of the attack", `Two Colorless symbols, so any two Energy cards pay it.`],
  ["Damage, right of the attack", `${lc.attack.damage}, which is ${lc.attack.damage / 10} counters.`],
  ["Weakness, bottom left", `${lc.printedWeakness}. A Lightning attacker does double.`],
  ["Resistance, next to it", `${lc.printedResistance}. A Fighting attacker does 30 less. Most cards print nothing here.`],
  ["Retreat Cost, bottom right", `${lc.retreat}. Discard that much Energy to swap it out.`],
];

const desc =
  "How to play the Pokemon card game, for somebody who has only ever opened packs. " +
  "How a game is set up, what a turn looks like, and the three ways to win.";
// Google truncates the snippet around 160 characters, so this is measured
// rather than hoped for. Same guard build-pack-prices.mjs carries.
if (desc.length > 160) throw new Error(`meta description is ${desc.length} characters, over 160:\n${desc}`);

// FAQPage, because the section headings here really are questions. HowTo schema
// was considered and rejected: it describes a procedure with a completed
// outcome, and this page is an explanation rather than a set of steps to finish.
const QA = [
  ["What even is the Pokemon card game?", d.whatIsTheGame?.oneLine || ""],
  ["How do you set up a game of Pokemon cards?",
    "Flip a coin and the winner chooses who goes first. Shuffle, draw seven, put a Basic Pokemon face down in the Active spot and up to five more on the Bench, then count the top six cards of your deck aside as your Prize cards. Both players turn everything face up and start."],
  ["What happens on a turn?",
    "Draw a card. Then do as much or as little as you like: attach one Energy, play Trainer cards, put Basics on your Bench, evolve, retreat, use Abilities. Then attack, and your turn is over."],
  ["How do you win a game of Pokemon cards?",
    "Three ways. Take all six of your own Prize cards, leave your opponent with no Pokemon in play, or have them unable to draw a card at the start of their turn."],
  ["Do I need to build a deck to play?",
    "No. A preconstructed deck is a legal 60 card deck out of the box. Two people need two decks, or one Battle Academy box."],
];

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "How to play" },
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
.hp-lede{max-width:44em}
.hp-s{margin-top:var(--s6);scroll-margin-top:var(--s5)}
.hp-s > p{max-width:44em;line-height:1.6}
.hp-s > p + p{margin-top:var(--s3)}
.hp-jump{display:flex;flex-wrap:wrap;gap:8px;margin:var(--s5) 0 0}
.hp-jump a{display:inline-flex;align-items:center;min-height:40px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.hp-jump a:hover{border-color:var(--ink);background:var(--mustard)}
.hp-box{border:3px solid var(--navy);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4);margin-top:var(--s4)}
.hp-box h3{font:400 var(--t-m)/1.2 var(--display);margin-bottom:var(--s2)}
.hp-box p,.hp-box li{font-size:var(--t-sm);line-height:1.55}
.hp-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4);margin-top:var(--s4)}
@media(max-width:760px){.hp-cards{grid-template-columns:1fr}}
.hp-cards h3{display:flex;align-items:baseline;gap:8px}
.hp-cards .hp-t{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.hp-sub{list-style:none;margin:var(--s3) 0 0;padding:0}
.hp-sub li{border-left:3px solid var(--gold);padding-left:var(--s3);margin-bottom:var(--s2)}
.hp-sub b{display:block}
.hp-steps{counter-reset:hp;list-style:none;margin:var(--s4) 0 0;padding:0;max-width:44em}
.hp-steps li{counter-increment:hp;position:relative;padding-left:38px;margin-bottom:var(--s3);line-height:1.55}
.hp-steps li::before{content:counter(hp);position:absolute;left:0;top:0;width:26px;height:26px;
  display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--navy);
  color:var(--chrome-ink);font:700 var(--t-micro)/1 var(--mono)}
.hp-call{border-left:5px solid var(--ketchup);background:var(--card);border:1px solid var(--hair);
  border-left:5px solid var(--ketchup);border-radius:8px;padding:var(--s3) var(--s4);margin-top:var(--s4);max-width:44em}
.hp-call b{display:block;font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.06em;
  text-transform:uppercase;color:var(--ketchup-deep);margin-bottom:4px}
.hp-call p{font-size:var(--t-sm);line-height:1.55}
.hp-shout{border:3px solid var(--navy);border-radius:12px;background:var(--navy);color:var(--chrome-ink);
  padding:var(--s4) var(--s5);margin:var(--s4) 0;box-shadow:var(--hard-lg);max-width:44em}
.hp-shout p{font:400 var(--t-m)/1.3 var(--display);color:var(--chrome-ink)}
.hp-shout span{display:block;margin-top:var(--s2);font-size:var(--t-sm);color:var(--foot-ink);line-height:1.5}
.hp-tbl-w{overflow-x:auto;margin-top:var(--s4);border:3px solid var(--navy);border-radius:12px;
  background:var(--card);box-shadow:var(--hard-lg);max-width:44em}
.hp-tbl{width:100%;border-collapse:collapse;font-size:var(--t-sm)}
.hp-tbl th,.hp-tbl td{text-align:left;padding:10px var(--s3);border-bottom:1px solid var(--hair);vertical-align:top}
.hp-tbl thead th{font:700 var(--t-micro)/1.2 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.hp-tbl tr:last-child td{border-bottom:0}
.hp-tbl td.hp-num{font:700 var(--t-m)/1 var(--display);width:64px;text-align:center}
@media(max-width:640px){.hp-tbl{font-size:var(--t-micro)}.hp-tbl th,.hp-tbl td{padding:8px 6px}}
.hp-fig{margin:var(--s4) 0 0;max-width:44em}
.hp-fig figcaption{margin-top:var(--s2);font-size:var(--t-micro);color:var(--ink-2);line-height:1.5}
.bd{width:100%;height:auto;display:block;background:var(--paper-2);border-radius:8px;padding:6px 0}
.bd-s rect{fill:var(--card);stroke:var(--ink);stroke-width:1}
.bd-s text{font:700 5px var(--mono);fill:var(--ink-2);letter-spacing:.04em}
.bd-a rect{fill:var(--mustard);stroke-width:1.6}
.bd-a text{fill:var(--ink)}
.bd-p rect{fill:var(--gold);stroke-width:1.6}
.bd-p text{fill:#2A2005}
.bd-d rect{stroke-dasharray:3 2}
.bd-h{font:700 6px var(--mono);fill:var(--ink);letter-spacing:.1em}
.bd-net{stroke:var(--ink);stroke-width:1;stroke-dasharray:4 3;opacity:.5}
.bd-net-t{font:400 4.6px var(--mono);fill:var(--ink-2)}
.bd-k{font:400 5px var(--mono);fill:var(--ink-2)}
.hp-anat{display:grid;grid-template-columns:190px 1fr;gap:var(--s4);align-items:start;margin-top:var(--s4)}
@media(max-width:640px){.hp-anat{grid-template-columns:1fr}}
.hp-anat img{width:100%;height:auto;display:block;border-radius:6px}
.hp-anat figcaption{margin-top:6px;font-size:var(--t-micro);color:var(--ink-2);line-height:1.5}
.hp-lbl{list-style:none;margin:0;padding:0}
.hp-lbl li{border-left:4px solid var(--gold);padding-left:var(--s3);margin-bottom:var(--s3);
  font-size:var(--t-sm);line-height:1.5}
.hp-lbl b{display:block;font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink-2);margin-bottom:3px}
.hp-wins{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4);margin-top:var(--s4)}
@media(max-width:760px){.hp-wins{grid-template-columns:1fr}}
.hp-win{border:3px solid var(--navy);border-radius:12px;background:var(--card);box-shadow:var(--hard-lg);
  padding:var(--s4)}
.hp-win span{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;color:var(--ink-2)}
.hp-win h3{font:400 var(--t-m)/1.15 var(--display);margin:6px 0 var(--s2)}
.hp-win p{font-size:var(--t-sm);line-height:1.5}
.hp-go{list-style:none;margin:var(--s4) 0 0;padding:0;max-width:44em}
.hp-go li{border-left:4px solid var(--gold);padding-left:var(--s3);margin-bottom:var(--s4);line-height:1.55}
.hp-go b{display:block;font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink-2);margin-bottom:4px}
.hp-out{border:3px dashed var(--navy);border-radius:12px;background:var(--card);padding:var(--s4);
  margin-top:var(--s6);max-width:44em}
.hp-out h2{margin-bottom:var(--s2)}
.hp-out > p{font-size:var(--t-sm);line-height:1.55;color:var(--ink-2)}
.hp-out ul{list-style:none;margin:var(--s3) 0 0;padding:0}
.hp-out li{margin-bottom:var(--s3);font-size:var(--t-sm);line-height:1.5}
.hp-out a{font-weight:700}
.hp-out .hp-off{display:inline-block;font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2);margin-left:6px}
.hp-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s6);line-height:1.6;max-width:46em}
`;

const body = `
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>How to play</span></nav>
      <h1>How do you actually <span class="hl">play</span>?</h1>
      <p class="lede hp-lede">You have the cards. Here is the game they are for. This is the short version:
        how a game is set up, what you do on a turn, and how somebody wins. Not the rulebook, and not everything.
        Enough to sit down opposite a friend and have a real game, and enough to decide whether you want to.</p>

      <nav class="hp-jump" aria-label="Jump to a section">
        <a href="#what">What is it</a>
        <a href="#cards">The cards</a>
        <a href="#setup">Setting up</a>
        <a href="#turn">Your turn</a>
        <a href="#attack">Attacking</a>
        <a href="#prizes">Prize cards</a>
        <a href="#win">Winning</a>
        <a href="#play">Can I play?</a>
      </nav>

      <section class="hp-s" id="what">
        <h2>What even <span class="hl">is</span> this?</h2>
        <p>Two players. Each brings a deck of 60 cards. You put Pokemon down on the table in front of you, attach
          Energy to them, and attack each other's Pokemon. ${plain("whatIsTheGame.facts.0.plain")}</p>
        <p>That is the whole shape of it. Everything below is a detail hanging off that picture, and you already
          own the hard part: the cards.</p>
      </section>

      <section class="hp-s" id="cards">
        <h2>The three kinds of <span class="hl">card</span></h2>
        <p>Everything in the game is one of three things.</p>
        <div class="hp-cards">
          <div class="hp-box">
            <h3>Pokemon <span class="hp-t">the fighters</span></h3>
            <p>The stage is in the top left corner, with whatever it evolves from. Basics play straight from your
              hand. A Stage 1 goes on top of the Basic it names and a Stage 2 on top of that, keeping the Energy
              and damage already there.</p>
          </div>
          <div class="hp-box">
            <h3>Energy <span class="hp-t">the fuel</span></h3>
            <p>${plain("cardTypes.energy.plain")} Basic Energy does nothing else; a few do more, and those are
              Special Energy. <a href="/types.html">There are 11 types</a>, and they are not the 18 from the
              video games.</p>
          </div>
          <div class="hp-box">
            <h3>Trainer <span class="hp-t">everything else</span></h3>
            <p>The subtype is in the top left and its rule is printed along the bottom. Item: as many as you like.
              Supporter: one a turn. Stadium: one a turn, and it stays out for both players. Tool: sticks to a
              Pokemon.</p>
          </div>
        </div>
        <p style="margin-top:var(--s4)">The ex, V and VMAX cards you keep pulling are Pokemon too: they hit
          harder, last longer, and cost you more when they fall. The stars in the corner are
          <a href="/rarity.html">rarity, not power</a>.</p>
      </section>

      <section class="hp-s" id="setup">
        <h2>Setting <span class="hl">up</span></h2>
        <p>Seven steps, done at the same time as your opponent.</p>
        <ol class="hp-steps">
${(setup.steps || []).map((s) => `          <li>${esc(s.plain)}</li>`).join("\n")}
        </ol>
        <figure class="hp-fig">
          ${BOARD}
          <figcaption>The table once both players have set up. Five is the hard limit on the Bench, and you always
            have exactly one Active Pokemon.</figcaption>
        </figure>
        <div class="hp-call">
          <b>No Basic Pokemon in your seven?</b>
          <p>Show your hand, shuffle it back, and draw seven new cards. Repeat until you have one. That is a
            mulligan, and your opponent may draw an extra card for the trouble.</p>
        </div>
        ${/* The two first-turn restrictions are two separate `plain` sentences in the
             data file and both start "The player who goes first", which reads as a
             stutter side by side. Merged into one sentence for length; the rule is
             unchanged and it is triple-sourced (current rulebook, official Quick
             Start book, Bulbapedia). */ ""}
        <div class="hp-call">
          <b>Going first is not automatically better</b>
          <p>The player who goes first cannot attack on their first turn, and cannot play a Supporter card either.
            They do still draw. That is why the coin flip is a real decision, and a lot of writing online still
            describes an older version of this rule.</p>
        </div>
      </section>

      <section class="hp-s" id="turn">
        <h2>Your <span class="hl">turn</span></h2>
        <p>Three beats. ${plain("turn.shape.plain")}</p>
        <p>${plain("turn.draw.plain")}</p>
        <div class="hp-tbl-w">
          <table class="hp-tbl">
            <caption class="sr-only">What you can do once per turn and what you can do as often as you like</caption>
            <thead><tr><th scope="col">Once per turn</th><th scope="col">As often as you like</th></tr></thead>
            <tbody>
${(() => {
  const left = [...once.map((a) => a.label), ...ONCE_EXTRA];
  const right = [...many.filter((a) => a.id !== "trainers").map((a) => a.label), ...MANY_EXTRA];
  const rows = Math.max(left.length, right.length);
  return Array.from({ length: rows }, (_, i) =>
    `              <tr><td>${left[i] ? esc(left[i]) : ""}</td><td>${right[i] ? esc(right[i]) : ""}</td></tr>`
  ).join("\n");
})()}
            </tbody>
          </table>
        </div>
        <p style="margin-top:var(--s4)">You do not have to do any of it, and you do not have to attack.
          ${plain("turn.actions.5.plain")}</p>
        <div class="hp-shout">
          <p>Attacking ends your turn.</p>
          ${/* The plain sentence opens with the same words as the heading above it,
                so the box read "Attacking ends your turn. Attacking ends your turn.
                Do everything else first". Only the second half goes in the body. */ ""}
          <span>${esc((turn.attackEndsTurn?.plain || "").replace(/^[^.]*\.\s*/, ""))}</span>
        </div>
      </section>

      <section class="hp-s" id="attack">
        <h2>Attacking, and the numbers on the <span class="hl">card</span></h2>
        <p>Only your Active Pokemon can attack; the Bench waits. Check it has the Energy the attack costs. A
          colourless symbol in a cost means any Energy pays it. Damage is tracked with counters, one counter per
          10 damage, and it stays on the Pokemon.</p>
        <p>Some attacks also put the other Pokemon to sleep or poison it; the card tells you what happens.</p>
        <div class="hp-shout">
          <p>There is no type chart in this game.</p>
          <span>Weakness, Resistance and Retreat Cost are printed on each individual card. What that card says is
            the answer for that card, and the same Pokemon in a different set can say something else.
            <a href="/types.html" style="color:#EFC94C">All 11 types, and what their cards print</a>.</span>
        </div>
        <figure class="hp-anat">
          <div>
            ${cardImg}
            <figcaption>${esc(lc.card)}, ${esc(lc.set)} #${esc(lc.number)}. A plain Basic that prints every number
              named here, including a Resistance.</figcaption>
          </div>
          <ul class="hp-lbl">
${LABELS.map(([where, what]) => `            <li><b>${esc(where)}</b>${esc(what)}</li>`).join("\n")}
          </ul>
        </figure>
        <p style="margin-top:var(--s4)">Weakness and Resistance are never applied to a Benched Pokemon. And how
          much each is worth is printed there too: today x2 and -30, but older cards print other numbers, so read
          the card.</p>
        <p>Retreat Cost is what it costs to swap your Active Pokemon for a Benched one: discard that much Energy,
          then switch. Once per turn, and any Energy pays it.</p>
      </section>

      <section class="hp-s" id="prizes">
        <h2>Knock Outs and <span class="hl">Prize cards</span></h2>
        <p>${plain("knockOut.plain")} ${plain("knockOut.replacement.plain")}</p>
        <div class="hp-call">
          <b>The Prize card you take is one of your own</b>
          <p>${esc(ko.prizeIsYourOwn?.plain || "")} Beginners routinely assume they take one of the opponent's.
            Those six are a countdown and a hand you get to use.</p>
        </div>
        <div class="hp-tbl-w">
          <table class="hp-tbl">
            <caption class="sr-only">How many Prize cards each kind of knocked out Pokemon gives up</caption>
            <thead><tr><th scope="col">Knocked out</th><th scope="col">Prize cards taken</th></tr></thead>
            <tbody>
${PRIZES.map(([kind, n]) => `              <tr><td>${esc(kind)}</td><td class="hp-num">${n}</td></tr>`).join("\n")}
            </tbody>
          </table>
        </div>
        <p style="margin-top:var(--s4)">That is the trade the game runs on: the big card hits harder and lives
          longer, and losing it hands your opponent half the game in one turn.</p>
      </section>

      <section class="hp-s" id="win">
        <h2>The three ways to <span class="hl">win</span></h2>
        <div class="hp-wins">
${(win.ways || [])
  .map(
    (w) => `          <div class="hp-win">
            <span>WAY ${w.n}</span>
            <h3>${esc(w.label)}</h3>
            <p>${esc(w.plain)}</p>
          </div>`
  )
  .join("\n")}
        </div>
      </section>

      <section class="hp-s" id="play">
        <h2>So can I <span class="hl">actually</span> play?</h2>
        <ul class="hp-go">
          <li><b>You do not have to build anything</b>A preconstructed deck is a legal 60 card deck out of the
            box, and the official product guide says so. It files ex Battle Decks and Battle Academy under "start
            here", and a Battle Academy box holds more than one deck, so two people can play without buying twice.
            We print no prices: no official one could be read anywhere that was not a reseller.</li>
          ${/* THE LINK GOES TO OUR PAGE FIRST and Pokemon's own download page stays
                in the outbound block at the foot, which is the shape CLAUDE.md's
                outbound exception argues for. This bullet used to send a beginner
                straight off the site mid-explanation. Deliberately recommends
                LIVE ONLY: /tcg-pocket.html exists now and plays by a reduced
                ruleset, so it is the wrong recommendation for somebody learning
                the real rules, and two apps in one beginner paragraph is one too
                many. The replacement is five words SHORTER than the sentence it
                replaced, because this page sits at its 1,500 word ceiling and the
                builder rejects a link that costs the page a paragraph. */ ""}
          <li><b>The free way in is Pokemon TCG Live</b>The official digital version, on Windows, Mac, iOS and
            Android. It enforces the rules for you, and the code card in every pack you open is for it:
            <a href="/tcg-live.html">what the code gets you</a>.</li>
          <li><b>Then go and play with people</b>Hobby shops run leagues, and the rulebook tells new players to
            find one: ask whether your shop is a Play! Pokemon Store.
            <a href="/shops.html">We list the shops around Rochester</a> and which of them run league nights,
            prereleases and a learn to play session. The <a href="/card-shows.html">card show calendar</a> is for
            buying, not playing.</li>
          <li><b>Is my card even legal?</b>Standard is the normal format and uses cards with regulation mark H,
            I or J, one letter along the bottom. Expanded goes back much further and never rotates; almost nobody
            starts there. Standard rotates yearly, so those letters have a shelf life: read from the official
            tournament handbook on ${esc(longDate(d.checked))}.</li>
        </ul>
        <p style="margin-top:var(--s4)">A legal deck is exactly 60 cards, at most four with the same name except
          basic Energy, and at least one Basic Pokemon. A preconstructed deck already obeys all three, and older
          or special cards carry extra rules printed on the card.
          <a href="/start.html">Start here</a> is the site's other front door: what a card is and what it is
          worth. This page is the one about the game.</p>
      </section>

      <div class="hp-out">
        <h2>Where to learn more, on Pokemon's own sites</h2>
        <p>Four links, and all four leave this site. We cannot host the rules and a page teaching them should say
          where the real ones are.</p>
        <ul>
          <li><a href="https://tcg.pokemon.com/en-us/learn/" rel="noopener" target="_blank"
            aria-label="Learn to Play, on tcg.pokemon.com, opens on Pokemon's site">Learn to Play</a>
            <span class="hp-off">pokemon.com</span><br>Card anatomy, the field layout, a tutorial video and an FAQ
            series. The friendliest starting point.</li>
          <li><a href="https://tcg.pokemon.com/assets/img/learn-to-play/getting-started/quick-start-rules/en-us/quick_start_rulebook.pdf"
            rel="noopener" target="_blank"
            aria-label="Quick Start Rules PDF, on tcg.pokemon.com, opens on Pokemon's site">Quick Start Rules, PDF</a>
            <span class="hp-off">19 pages</span><br>Pictures, made for a first game. The best thing to read after
            this page. One warning: it opens by saying the first player to knock out six Pokemon wins, which stops
            being true the moment a Pokemon ex is on the table.</li>
          <li><a href="https://tcg.pokemon.com/en-us/tcgl/" rel="noopener" target="_blank"
            aria-label="Pokemon TCG Live, on tcg.pokemon.com, opens on Pokemon's site">Pokemon TCG Live</a>
            <span class="hp-off">free, four platforms</span><br>The official digital version. It teaches the rules
            and then enforces them, and everything you learn transfers to cards on a table.</li>
          <li><a href="https://d1i787aglh9bmb.cloudfront.net/assets/img/global/tcg-rulebook/ME05_Web_Rulebook_en.pdf"
            rel="noopener" target="_blank"
            aria-label="The full official rulebook PDF, 44 pages and around 50MB, opens on Pokemon's site">The full rulebook, PDF</a>
            <span class="hp-off">44 pages, around 50MB</span><br>Every rule, including all the ones this page left
            out. It is a big download, so think twice on mobile data. This is the last word, not the starting
            point.</li>
        </ul>
      </div>

      <p class="hp-src">Every rule on this page comes from the official Pokemon Trading Card Game rulebook, the
        ME05 Pitch Black printing stamped July 2026, read on ${esc(longDate(d.checked))} and diffed against the
        March 2026 printing: nothing in setup, the turn, winning, prizes or the printed card numbers had moved.
        The beginner product advice comes from Pokemon's own product guide, the formats from the Play! Pokemon
        tournament handbook, and the Pidgey scan and its printed values from TCGdex. One claim here rests on a
        secondary source rather than an official one: the rulebook defines basic Energy and never defines Special
        Energy, so that sentence is Bulbapedia's. Rules and rotations change. This page carries the date it was
        checked so you can see how old the answer is, and if it disagrees with the rulebook, the rulebook is
        right.</p>
`;

// UNDER 1,500 WORDS OF BODY COPY, CHECKED RATHER THAN INTENDED. The brief was
// "not too overwhelming" and the one thing that can quietly undo this page is a
// later edit adding one more useful paragraph, six times. Tags, entities and
// the SVG's own labels are stripped first so this counts prose and not markup.
//
// It counts the EIGHT SECTIONS, which is what the plan budgeted: the lede, the
// jump nav, the outbound block and the small print at the bottom are chrome
// rather than the explanation, and folding them in would either inflate the
// number or tempt somebody to raise the ceiling. The SVG's own labels come out
// too, since they are a picture rather than prose.
const prose = (html) =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    // .sr-only text is for a screen reader landing on a table with no visible
    // caption. It is not body copy and counting it would push a page towards
    // dropping the captions to make the budget, which is the wrong trade.
    .replace(/<(\w+) class="sr-only"[^>]*>[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const sections = body.match(/<section class="hp-s"[\s\S]*?<\/section>/g) || [];
if (sections.length !== 8) throw new Error(`expected 8 body sections, found ${sections.length}`);
const perSection = sections.map((s) => prose(s).length);
const words = perSection.reduce((a, b) => a + b, 0);
if (process.env.WORDS) {
  console.log(perSection.map((n, i) => `  section ${i + 1}: ${n}`).join("\n"));
  console.log(`  whole page including chrome: ${prose(body).length}`);
}
// AND NO SECTION MAY OUTGROW ITS OWN BUDGET, which is the other half of the
// rule in the plan and the half a single total cannot enforce: one section can
// double while another is quietly gutted and the sum still passes.
//
// The plan writes these as approximations ("~100 words"), so they are ceilings
// with a stated allowance rather than exact counts. The allowance is 40% and it
// is deliberately generous: the point is to catch a section drifting into an
// essay, not to make somebody count adjectives. The 1,500 total above is the
// hard rule.
const BUDGET = [100, 150, 180, 220, 220, 140, 100, 250];
perSection.forEach((n, i) => {
  const cap = Math.round(BUDGET[i] * 1.4);
  if (n > cap) {
    throw new Error(
      `section ${i + 1} is ${n} words against a budget of ${BUDGET[i]} in data/how-to-play-PLAN.md ` +
        `(ceiling ${cap}). Cut it rather than moving the number.`
    );
  }
});

if (words > 1500) {
  throw new Error(
    `body copy is ${words} words, over the 1,500 budget in data/how-to-play-PLAN.md. ` +
      `Cut something rather than raising this number: the brief was "not too overwhelming".`
  );
}

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>How to Play the Pokemon Card Game: Setup, a Turn, and How to Win | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/how-to-play.html">
<meta property="og:title" content="How do you actually play?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/how-to-play.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-how-to-play.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-how-to-play.jpg">
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
${footer("Rules from the official Pokemon Trading Card Game rulebook. Card scan from TCGdex.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/how-to-play.html"), page);
console.log(`Wrote public/how-to-play.html
  ${words} words of body copy (budget 1,500)
  ${(setup.steps || []).length} setup steps, ${(turn.actions || []).length} turn actions, ${(win.ways || []).length} ways to win
  labelled card: ${lc.card} ${lc.set} #${lc.number}`);
