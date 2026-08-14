#!/usr/bin/env node
// Build public/rarity.html: how to tell what a card is by looking at it.
//
//   node scripts/build-rarity.mjs
//
// For two audiences at once: someone who just opened their first pack, and
// someone who collected in 1999 or 2005 and has come back to a game with
// eleven rarities instead of three.
//
// EVERY SYMBOL ON THIS PAGE IS A REAL CARD, magnified at its printed corner,
// rather than an illustration of a symbol. That matters more than it sounds:
// the research behind this page checked actual card scans and found two things
// that widely-read guides state incorrectly.
//
//   1. The rarity symbol moved to the bottom LEFT at Sun & Moon in 2017, not
//      at Scarlet & Violet in 2023. Several guides say SV; one says modern
//      cards are bottom-right, which is backwards. Verified across Base Set,
//      EX, Diamond & Pearl, Black & White, XY (all bottom-right) and Sun &
//      Moon onward (all bottom-left), on Pokemon and Trainer cards both.
//   2. The Mega Hyper Rare symbol is a single four-pointed gold sparkle with a
//      heavy black outline, NOT three gold stars. At least one popular guide
//      says three stars. The cards say otherwise.
//
// Because those are checkable by anyone holding a card, the page shows the
// corner rather than asserting the fact.
//
// Things deliberately left off are listed in data/rarity.json. The short
// version: nothing goes on this page that could not be verified, because the
// entire value of a beginner's guide is that a beginner cannot tell when it is
// wrong.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, FONTS, footer, APP_JS } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(await readFile(join(ROOT, "data/rarity.json"), "utf8"));

// COUNTED, NOT TYPED. The intro said "stars for five different rarities" while
// the ladder below it lists six: Rare, Double Rare, Ultra Rare, Illustration
// Rare, Special Illustration Rare and Hyper Rare. Mega Hyper Rare is the one
// that is NOT a star, it is a sparkle, which is presumably where five came
// from. Counting the ladder means the sentence follows the data.
const starRarities = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"][
  d.ladder.filter((x) => /star/i.test(x.symbol || "")).length
];

/**
 * A magnified crop of a card's bottom corner.
 *
 * The card is a background image scaled up and pinned to the corner the symbol
 * actually sits in, so what you see is the real printing.
 *
 * The two sides need different framing. On a bottom-RIGHT card the symbol is
 * the last thing on the row, so pinning hard right catches it. On a bottom-LEFT
 * card the symbol sits at the END of the left-hand group, after the illustrator
 * credit, regulation mark, set code and number, so pinning hard left cuts the
 * symbol off at the edge: the one thing the crop exists to show. Framed at 22%
 * instead, which lands the whole group in view.
 */
const CROP = {
  right: { size: "340%", pos: "100% 100%" },
  left: { size: "280%", pos: "22% 100%" },
};
const corner = (card, side, label) => `<figure class="crop">
        <div class="crop-img" style="background-image:url('${esc(card)}');background-size:${
          CROP[side].size
        };background-position:${CROP[side].pos}"></div>
        <figcaption>${esc(label)}</figcaption>
      </figure>`;

/**
 * One glossary term, with a real card where an honest one exists.
 *
 * `show` picks the treatment: "card" for the whole card, "crop" for the
 * magnified bottom-left corner where the thing being described is a number or
 * a letter too small to read at card size, absent where no honest picture
 * exists. Three terms have none on purpose and rarity.json says why; the point
 * is that a missing image here is a decision, so do not "fix" one by reaching
 * for a stock photo.
 *
 * The caption names the card and set every time. It is what makes the example
 * checkable rather than decorative, and it is the same reason the ladder above
 * carries `example`.
 */

/**
 * A slab, drawn rather than photographed.
 *
 * We own no graded cards and will not use a grading company's product shot, so
 * this is a schematic and is captioned as one. It can do something a photo
 * cannot anyway: point at the three parts that matter, the grade, the cert
 * number and the seal, instead of leaving a reader to work out which bit of a
 * glossy product image is the point.
 *
 * Colours come from the site palette, not from any company's branding, and it
 * carries no company name. It is a slab, not a PSA slab.
 */
const slabDiagram = () => `<figure class="gloss-fig is-diagram">
            <svg viewBox="0 0 220 300" role="img" aria-label="Diagram of a graded card in a sealed holder, showing the grade, the certification number and the sealed edge">
              <rect x="6" y="6" width="208" height="288" rx="10" fill="#EDE6CB" stroke="#15263A" stroke-width="3"/>
              <rect x="14" y="14" width="192" height="272" rx="7" fill="none" stroke="#9FB0C0" stroke-width="1.5" stroke-dasharray="4 4"/>
              <rect x="24" y="26" width="172" height="58" rx="4" fill="#F7F2DE" stroke="#15263A" stroke-width="2"/>
              <text x="34" y="46" font-family="monospace" font-size="9" fill="#5A6150">CARD NAME &amp; SET</text>
              <text x="34" y="72" font-family="monospace" font-size="22" font-weight="bold" fill="#15263A">MINT 10</text>
              <text x="150" y="72" font-family="monospace" font-size="8" fill="#5A6150">GRADE</text>
              <text x="34" y="82" font-family="monospace" font-size="7" fill="#5A6150">CERT 000000000</text>
              <rect x="34" y="96" width="152" height="176" rx="4" fill="#DCF2FB" stroke="#0E6E96" stroke-width="2"/>
              <text x="110" y="190" font-family="monospace" font-size="9" fill="#0E6E96" text-anchor="middle">the card, sealed inside</text>
              <path d="M6 150 L14 150 M206 150 L214 150" stroke="#D9482B" stroke-width="3"/>
              <text x="110" y="292" font-family="monospace" font-size="7" fill="#5A6150" text-anchor="middle">sealed edge: opening it voids the grade</text>
            </svg>
            <figcaption>A schematic, not a photo of a real slab</figcaption>
          </figure>`;

const slangCard = (s) => {
  const art = s.show === "diagram"
    ? slabDiagram()
    : !s.card
    ? ""
    : s.show === "crop"
      ? `<div class="gloss-fig is-crop">${corner(s.card, "left", s.example)}</div>`
      : `<figure class="gloss-fig">
            <img src="${esc(s.card)}" alt="${esc(s.example)}" loading="lazy" decoding="async" width="600" height="825">
            <figcaption>${esc(s.example)}</figcaption>
          </figure>`;
  return `        <li${s.card ? "" : ' class="no-fig"'}>
          <b>${esc(s.term)}</b>
          <p>${esc(s.meaning)}</p>
          ${art}
        </li>`;
};


const ladderRow = (r, i) => `      <li class="rr${r.chase ? " is-chase" : ""}">
        <div class="rr-n">${i + 1}</div>
        <div class="rr-card">
          <img src="${esc(r.card)}" alt="${esc(r.example)}" loading="lazy" decoding="async" width="600" height="825">
        </div>
        <div class="rr-body">
          <h3>${esc(r.name)}${r.chase ? ` <span class="rr-chase">worth chasing</span>` : ""}</h3>
          <p class="rr-sym"><b>${esc(r.symbol)}</b></p>
          <p class="rr-look">${esc(r.look)}</p>
          ${r.note ? `<p class="rr-note">${esc(r.note)}</p>` : ""}
          <p class="rr-eg">${esc(r.example)}</p>
        </div>
        <div class="rr-zoom">
          ${corner(r.card, "left", "the corner, magnified")}
        </div>
      </li>`;

const style = `
.rg{padding:var(--s7) 0 var(--s5)}
.rg-lede{font-size:var(--t-lede);color:var(--ink-2);max-width:42em;margin-bottom:var(--s5)}
.rg h2{font:400 var(--t-l)/1.15 var(--display);margin-bottom:var(--s3)}
.rg-sec{padding:var(--s6) 0}
.rg-sec h2{font:400 var(--t-l)/1.15 var(--display);margin-bottom:var(--s3)}
.rg-p{color:var(--ink-2);max-width:46em;margin-bottom:var(--s4)}

/* The magnified corner. A background image blown up and pinned to the corner
   the symbol is actually printed in, so it is the real card rather than a
   drawing of one. */
.crop{border:2px solid var(--ink);border-radius:var(--r);overflow:hidden;background:var(--card)}
.crop-img{aspect-ratio:16/7;background-repeat:no-repeat;image-rendering:auto}
.crop figcaption{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);padding:8px var(--s3);border-top:1px solid var(--hair);background:var(--page)}

/* Where is it? Two eras side by side. */
.era{display:grid;grid-template-columns:1fr 1fr;gap:var(--s4)}
@media(max-width:640px){.era{grid-template-columns:1fr}}
.era-one{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);box-shadow:var(--lift)}
.era-one h3{font:400 var(--t-m)/1.15 var(--display);margin-bottom:4px}
.era-one .who{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.05em;
  text-transform:uppercase;margin-bottom:var(--s3)}
.era-one .crop{margin-bottom:var(--s3)}

/* The two-step rule, as a thing you can actually follow. */
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4);margin:var(--s5) 0}
@media(max-width:760px){.steps{grid-template-columns:1fr}}
.step{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);
  box-shadow:var(--lift)}
.step b{display:block;font:400 var(--t-l)/1 var(--display);color:var(--ketchup-deep);margin-bottom:6px}
.step h3{font:700 var(--t-body)/1.3 var(--body);margin-bottom:6px}
.step p{color:var(--ink-2);font-size:var(--t-sm)}

.tip{background:var(--mustard);border:2px solid var(--gold-deep);border-radius:var(--r);
  padding:var(--s5);margin:var(--s5) 0}
.tip h3{font:400 var(--t-m)/1.15 var(--display);margin-bottom:6px}
.tip p{color:var(--ink);max-width:48em}
.tip code{font:700 var(--t-sm)/1 var(--mono);background:rgba(0,0,0,.12);padding:2px 6px;border-radius:4px}

/* The ladder. */
.ladder{list-style:none;display:flex;flex-direction:column;gap:var(--s4)}
.rr{display:grid;grid-template-columns:34px 96px 1fr;gap:var(--s4);align-items:start;
  background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);box-shadow:var(--lift)}
@media(min-width:820px){.rr{grid-template-columns:34px 120px 1fr 220px}}
.rr.is-chase{border-color:var(--gold-deep);box-shadow:0 4px 0 var(--gold-deep),var(--lift)}
.rr-n{font:400 var(--t-m)/1 var(--display);color:var(--ink-2);text-align:center;padding-top:4px}
.rr-card img{width:100%;height:auto;border-radius:6px;display:block}
.rr-body h3{font:400 var(--t-m)/1.15 var(--display);margin-bottom:4px}
.rr-chase{font:700 9px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  background:var(--mustard);border:1px solid var(--gold-deep);color:var(--ink);
  padding:4px 7px;border-radius:var(--r-pill);vertical-align:middle}
.rr-sym{font:700 var(--t-sm)/1.4 var(--mono);color:var(--plum);margin-bottom:6px;letter-spacing:.03em}
.rr-look{color:var(--ink-2);font-size:var(--t-sm)}
.rr-note{font:700 var(--t-micro)/1.6 var(--mono);color:var(--plum);background:var(--lilac-pale);
  border-radius:calc(var(--r) - 8px);padding:8px var(--s3);margin-top:8px}
.rr-eg{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.04em;
  text-transform:uppercase;margin-top:8px}
.rr-zoom{grid-column:1/-1}
@media(min-width:820px){.rr-zoom{grid-column:auto}}

/* Returning collectors. */
/* The card sits under the years and above the prose: you see the three
   Charizards side by side first, which is the comparison, and read why after. */
.ex-fig{margin:var(--s3) 0}
.ex-fig img{display:block;width:100%;max-width:150px;height:auto;border-radius:6px;
  border:1px solid var(--hair);background:var(--page)}
.ex-fig figcaption{font:400 var(--t-micro)/1.45 var(--mono);color:var(--ink-2);margin-top:6px;min-height:2.9em}
.exs{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4);margin-bottom:var(--s5)}
@media(max-width:760px){.exs{grid-template-columns:1fr}}
.ex1{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);
  box-shadow:var(--lift)}
.ex1 b{display:block;font:400 var(--t-l)/1 var(--display);margin-bottom:4px}
.ex1 .yrs{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ketchup-deep);letter-spacing:.05em;
  text-transform:uppercase;margin-bottom:8px}
.ex1 p{color:var(--ink-2);font-size:var(--t-sm)}

.gone{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--s3)}
.gone li{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s4)}
.gone b{display:block;font-weight:700}
.gone .yrs{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.05em;margin:2px 0 6px}
.gone p{color:var(--ink-2);font-size:var(--t-sm)}
/* Same treatment as the glossary: flex column, figure pushed to the bottom, two
   caption lines reserved, so the cards land on a line across each row instead
   of stepping up and down with the length of the prose above them. */
.gone li{display:flex;flex-direction:column}
.gone-fig{margin:var(--s4) 0 0;padding-top:var(--s3);border-top:1px solid var(--hair);margin-top:auto}
.gone-fig img{display:block;width:100%;max-width:132px;height:auto;border-radius:6px;
  border:1px solid var(--hair);background:var(--page)}
.gone-fig figcaption{font:400 var(--t-micro)/1.45 var(--mono);color:var(--ink-2);margin-top:6px;min-height:2.9em}

.gloss{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s3)}
/* Flex column with the figure pushed to the bottom by margin-top:auto. Tiles in
   a row stretch to the tallest, and three terms carry no image at all, so
   without this the pictures sit at whatever height their own text ended at and
   the row of cards reads as ragged rather than as a row. */
.gloss li{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s4);
  display:flex;flex-direction:column}
.gloss b{font:700 var(--t-body)/1.3 var(--body);color:var(--ketchup-deep)}
.gloss p{color:var(--ink-2);font-size:var(--t-sm);margin-top:4px}
/* Every figure bottom-anchored, crops included. A crop is a wide short strip
   and a card is tall, so the two can never line up on their tops when they land
   in the same row; anchoring the bottoms is the alignment that holds for both. */
.gloss-fig{margin:var(--s4) 0 0;padding-top:var(--s3);border-top:1px solid var(--hair);margin-top:auto}
/* Capped rather than full width: a 600x825 scan at tile width makes every entry
   a foot tall and buries the definitions, which are still the point. */
.gloss-fig img{display:block;width:100%;max-width:132px;height:auto;border-radius:6px;
  border:1px solid var(--hair);background:var(--page)}
/* Two lines reserved whether the caption fills them or not. The figures are
   bottom-anchored, so a caption that wraps to two lines where its neighbor
   used one lifts that card 16px above the rest of the row. Reserving the space
   keeps the cards on a line across the row regardless of caption length. */
.gloss-fig figcaption{font:400 var(--t-micro)/1.45 var(--mono);color:var(--ink-2);margin-top:6px;
  min-height:2.9em}
/* The crop wants the tile's full width: it is a magnified corner, and shrinking
   it defeats the reason it is a crop. */
.gloss-fig.is-crop .crop{margin-top:0}
.gloss-fig.is-crop .crop-img{aspect-ratio:16/6}

.rg-foot{font:700 var(--t-micro)/1.7 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin:var(--s6) 0;max-width:56em}
`;

const body = `
<main id="main">
  <section class="rg">
    <div class="wrap">
      <div class="brk"><h1>What have I <span class="hl">actually got</span></h1><span class="ln"></span></div>
      <p class="rg-lede">Every Pokemon card tells you how rare it is, in one corner, with one small
        symbol. Once you know where to look it takes about a second. Here is the corner, magnified,
        on real cards.</p>
    </div>
  </section>

  <section class="band rg-sec">
    <div class="wrap">
      <h2>First: <span class="hl">which corner</span></h2>
      <p class="rg-p">This is the bit almost every guide online gets wrong, and it is easy to check
        yourself. The symbol moved from the bottom right to the bottom left in 2017, at Sun and Moon.
        Not at Scarlet and Violet, which is what you will usually be told.</p>
      <div class="era">
        <div class="era-one">
          <h3>Bottom right</h3>
          <p class="who">${esc(d.eras.old.set)} &bull; XY era and older</p>
          ${corner(d.eras.old.card, "right", `${d.eras.old.name}, bottom right corner`)}
          <p class="rg-p" style="margin:0">If the number and symbol are on the right, you are holding
            something from 2016 or earlier.</p>
        </div>
        <div class="era-one">
          <h3>Bottom left</h3>
          <p class="who">${esc(d.eras.new.set)} &bull; Sun and Moon onward</p>
          ${corner(d.eras.new.card, "left", `${d.eras.new.name}, bottom left corner`)}
          <p class="rg-p" style="margin:0">On the left, and it is 2017 or newer. Everything below is
            about these.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="rg-sec">
    <div class="wrap">
      <h2>Then: <span class="hl">count, then color</span></h2>
      <p class="rg-p">Modern sets use stars for ${starRarities} different rarities, which sounds impossible
        until you know the trick. It is two questions, in this order.</p>
      <div class="steps">
        <div class="step"><b>1</b><h3>How many?</h3><p>One, two or three. Count them before you look
          at anything else.</p></div>
        <div class="step"><b>2</b><h3>What color?</h3><p>Black, silvery white, or gold. Black is the
          ordinary game rarities, silver is a full art ex, gold is the collector tiers.</p></div>
        <div class="step"><b>3</b><h3>That is it</h3><p>Two black stars is a Double Rare. Two gold
          stars is a Special Illustration Rare. Same count, completely different card.</p></div>
      </div>

      <div class="tip">
        <h3>The shortcut that skips all of it</h3>
        <p>Look at the card number instead. If the left number is <b>bigger</b> than the right one,
          like <code>199/198</code>, it is a secret rare and it is one of the good ones. Cards inside
          the set total are the ordinary tiers. You can do this across a table without squinting.</p>
      </div>
    </div>
  </section>

  <section class="band rg-sec">
    <div class="wrap">
      <h2>The whole <span class="hl">ladder</span></h2>
      <p class="rg-p">Lowest to highest, as the modern sets print them. One thing worth knowing
        straight away: this is not a price order. Illustration Rares usually sell for less than Ultra
        Rares, and Special Illustration Rares often beat everything except gold. Rarity ladder and
        value ladder are two different things.</p>
      <ul class="ladder">
${d.ladder.map(ladderRow).join("\n")}
      </ul>
    </div>
  </section>

  <section class="rg-sec">
    <div class="wrap">
      <h2>Shiny, but <span class="hl">not rare</span></h2>
      <p class="rg-p"><b>Reverse holo</b> is the one that catches everybody. The foil is on everything
        <em>except</em> the artwork, and you get one or two in most packs. It does not change the
        card's rarity at all: a reverse holo Common still prints a black circle and is still a Common.
        A regular <b>holo</b> is the opposite, foil on the artwork window only.</p>
      <p class="rg-p"><b>"Alt art" is not a rarity.</b> It is not printed on any card and it is not in
        Pokemon's rarity list. It is collector slang, and on a modern card it almost always means an
        Illustration Rare or a Special Illustration Rare. Check the star color.</p>
      <p class="rg-p"><b>Texture</b> is felt rather than printed. Tilt the card under a light and run a
        fingernail across the art: modern top tier full arts are usually embossed, with the texture
        following the artwork. It is a good signal, not a rule.</p>
    </div>
  </section>

  <section class="band rg-sec">
    <div class="wrap">
      <h2>Coming back after a <span class="hl">few years</span></h2>
      <p class="rg-p">If you collected once and stopped, the single most confusing thing is that
        <b>"ex" has meant three different things</b>. All three give up two prizes, and they are not
        the same card.</p>
      <div class="exs">
        <div class="ex1"><b>Pokemon-ex</b><p class="yrs">2003 to 2007, lowercase</p>
          <figure class="ex-fig"><img src="https://assets.tcgdex.net/en/ex/ex6/105/high.webp" alt="Charizard ex, FireRed &amp; LeafGreen, 2004" loading="lazy" decoding="async" width="600" height="825"><figcaption>Charizard ex, FireRed &amp; LeafGreen, 2004</figcaption></figure>
          <p>The original. No rule box: the rule is plain italic text along the bottom, and abilities
            are called Poke-POWER or Poke-BODY.</p></div>
        <div class="ex1"><b>Pokemon-EX</b><p class="yrs">2012 to 2016, uppercase</p>
          <figure class="ex-fig"><img src="https://assets.tcgdex.net/en/xy/xy2/11/high.webp" alt="Charizard EX, Flashfire, 2014" loading="lazy" decoding="async" width="600" height="825"><figcaption>Charizard EX, Flashfire, 2014</figcaption></figure>
          <p>Black and White through XY. Almost always Basic, whatever the Pokemon's real stage.
            Mega EX ended your turn unless you played a Spirit Link.</p></div>
        <div class="ex1"><b>Pokemon ex</b><p class="yrs">2023 to now, lowercase again</p>
          <figure class="ex-fig"><img src="https://assets.tcgdex.net/en/sv/sv03/125/high.webp" alt="Charizard ex, Obsidian Flames, 2023" loading="lazy" decoding="async" width="600" height="825"><figcaption>Charizard ex, Obsidian Flames, 2023</figcaption></figure>
          <p>Current. Has a bordered rule box in the bottom corner where the Pokedex entry would sit.
            That box is the quickest way to tell it from a 2003 one.</p></div>
      </div>

      <h2 style="margin-top:var(--s6)">Everything that came and <span class="hl">went</span></h2>
      <p class="rg-p">If you remember any of these, they are all out of print. None of them are coming
        out of a pack you buy today.</p>
      <ul class="gone">
${d.gone
  .map(
    (g) => `        <li>
          <b>${esc(g.name)}</b><p class="yrs">${esc(g.years)}</p><p>${esc(g.note)}</p>
          ${
            g.card
              ? `<figure class="gone-fig">
            <img src="${esc(g.card)}" alt="${esc(g.example)}" loading="lazy" decoding="async" width="600" height="825">
            <figcaption>${esc(g.example)}</figcaption>
          </figure>`
              : ""
          }
        </li>`,
  )
  .join("\n")}
      </ul>
    </div>
  </section>

  <section class="rg-sec">
    <div class="wrap">
      <h2>What everyone is <span class="hl">saying</span></h2>
      <p class="rg-p">The words you will hit in the first five minutes of any card video, including
        ours.</p>
      <ul class="gloss">
${d.slang.map(slangCard).join("\n")}
      </ul>
    </div>
  </section>

  <section class="rg-sec">
    <div class="wrap">
      <p class="rg-foot">CHECKED ${esc(longDate(d.checked).toUpperCase())} AGAINST REAL CARD SCANS,
        NOT AGAINST OTHER GUIDES. THE CORNER IMAGES ON THIS PAGE ARE MAGNIFIED CROPS OF ACTUAL CARDS,
        SO YOU CAN CHECK ANY OF IT AGAINST SOMETHING IN YOUR OWN BINDER. A COUPLE OF CLAIMS THAT
        CIRCULATE WIDELY ARE LEFT OFF BECAUSE THEY COULD NOT BE VERIFIED. IF YOU SPOT SOMETHING WRONG
        HERE, SAY SO ON ANY OF THE SOCIALS AND IT GETS FIXED. FAN MADE GUIDE, NOT AFFILIATED WITH THE
        POKEMON COMPANY.</p>
    </div>
  </section>
</main>`;

const faq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    [
      "Where is the rarity symbol on a Pokemon card?",
      "In the bottom corner, next to the card number. On cards from Sun and Moon (2017) onward it is in the bottom left. On XY era cards and older it is in the bottom right.",
    ],
    [
      "What do the stars on a Pokemon card mean?",
      "Count them, then check the color. One black star is a Rare, two black stars a Double Rare, two silver stars an Ultra Rare, one gold star an Illustration Rare, two gold stars a Special Illustration Rare and three gold stars a Hyper Rare.",
    ],
    [
      "Does a reverse holo make a card rare?",
      "No. Reverse holo is a finish, not a rarity. The foil sits on everything except the artwork, and the card keeps whatever rarity symbol it was printed with. A reverse holo Common is still a Common.",
    ],
    [
      "What is an alt art Pokemon card?",
      "Alt art is collector slang rather than a printed rarity. It appears on no card and in no official rarity list. On a modern card it usually means an Illustration Rare or a Special Illustration Rare.",
    ],
    [
      "How do I know if a card is a secret rare?",
      "Its collector number is higher than the set total, for example 199/198. Secret rares are the Illustration Rare, Ultra Rare, Special Illustration Rare and Hyper Rare tiers.",
    ],
  ].map(([q, a]) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pokemon Card Rarity Symbols Explained, With Real Cards | Garbage Rips 585</title>
<meta name="description" content="How to tell what a Pokemon card is by the symbol in its corner, shown magnified on real cards. Every rarity from Common to Mega Hyper Rare, plus what changed if you collected years ago.">
<link rel="canonical" href="${SITE}/rarity.html">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#15263A">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="Pokemon Card Rarity Symbols, Explained With Real Cards">
<meta property="og:description" content="The corner of the card, magnified. Every rarity from Common to Mega Hyper Rare.">
<meta property="og:url" content="${SITE}/rarity.html">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
${STYLES}
<style>${style}</style>
<script type="application/ld+json">
${JSON.stringify(faq, null, 2)}
</script>
</head>
<body>
${SKIP}
${SPRITE}

${BAR}
${MENU}
${body}

${footer("Card images from the Pokemon TCG API. Fan made guide, not affiliated with The Pokemon Company.")}

${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/rarity.html"), html);

console.log(`Wrote public/rarity.html
  ${d.ladder.length} rarities, each with a real card and a magnified corner
  ${d.gone.length} retired mechanics, ${d.slang.length} glossary terms
  ${faq.mainEntity.length} FAQ entries in schema`);
