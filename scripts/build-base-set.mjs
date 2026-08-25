#!/usr/bin/env node
// Generate /base-set.html: telling the 1999 English Base Set print runs apart.
//
//   node scripts/build-base-set.mjs
//
// Reads data/base-set.json for the words, data/top-graded.json for every price,
// data/top100.json for the sealed pack, and public/data/expansions.json for the
// dates and card counts. Nothing on this page is typed twice.
//
// THE SHADOW IS DRAWN AND THE STAMP IS PHOTOGRAPHED, and that split is the whole
// design of this page.
//
// The stamp is a high contrast black mark about 78 by 96 pixels in a 600px scan,
// so it survives magnification and a reader can hold their own card up against
// it. TCGdex's Base Set scans carry it: all 16 Holofoil scans it serves were
// checked on 17 August 2026 and every one is a 1st Edition copy, which makes it
// the one printing this site can show a reader for free.
//
// The shadow cannot be photographed usefully from anything we can reach. It is a
// band a couple of millimetres wide on a card whose face colour changes behind
// it, and the only scans of an Unlimited or Shadowless Base Set card available
// here are PriceCharting product photographs at 325 by 450, shot at slightly
// different crops and angles. A two pixel difference read off two photographs
// that do not line up is not evidence, it is a suggestion, so the shadow is a
// DIAGRAM and the figcaption says the band is exaggerated. That is the same call
// build-fakes.mjs makes for colour registration and for the card cross-section.
//
// NO PRICE IS TYPED ANYWHERE. See priceRow() below: an entry in data/base-set.json
// names a card and this reads the figure out of data/top-graded.json, so this page
// and /top-graded.html cannot disagree. It also refuses any row that PriceCharting
// was only read ONCE for, which is what verify-graded-top.mjs supplies.
//
// THAT PARAGRAPH USED TO END "verify-graded-top.mjs checks the top 120 ranks, and
// a Base Set printing below that has one read behind it. Shadowless Blastoise
// (rank 177) and Shadowless Mewtwo (rank 366) are in the file and are
// deliberately not on the page." IT IS NO LONGER TRUE AND THE PAGE HAS CHANGED
// UNDER IT. `verify-graded-top.mjs --all` was run on 17 August 2026 and re-read
// ALL 400 rows: 399 agree, 1 disagree, 0 unreadable, 0 missing a scan. Every one
// of the 22 Base Set and Base Set 2 rows in the file is now double-read, so the
// 120 ceiling is gone as a reason for leaving a printing off.
//
// What that unlocked, and what it did NOT, is worth writing down because the
// second half is the surprising half:
//
//   UNLOCKED  Charizard [1999-2000] #4 (rank 124), which is the fourth print run
//             and now carries a figure instead of a sentence saying it does not.
//             Also the whole 1st Edition ladder below rank 120, and the two
//             Shadowless rows named above, which feed the second price table.
//
//   NOT       Shadowless against Unlimited on any card except Charizard, and no
//             amount of further verification can fix it. This file is ranked by
//             PSA 10 VALUE and its floor is $12,000 at rank 400. The Unlimited
//             printings of Blastoise #2, Venusaur #15 and Mewtwo #10 are worth
//             far less than that, so they are not in data/top-graded.json at all
//             and were never excluded by verification. Widening the verification
//             can only ever add the SCARCE printings. Getting the common one
//             needs a different crawl, not a wider check.
//
// So the second table on this page compares 1st Edition against Shadowless,
// which is the one printing pair that exists on more than one card: Charizard
// (ranks 6 and 96), Blastoise (27 and 177) and Mewtwo (42 and 366), all six rows
// double-read. See the comment above stampTable() for the argument.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { faqBlock, FAQ_CSS } from "../shared/faq.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where
// it sits, so both attach to nothing: ~11.9KB gzipped and 2 requests for a
// script that finds no tile and a stylesheet whose classes never appear. The
// three conditions a page must meet before it needs them are written out in
// shared/chrome.mjs beside the two exports; read that before adding a video
// tile or a carousel here.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate, shortDate, moneyCompact, imgDims, avifPicture, clipMeta} from "../shared/format.mjs";
import { gradedGate } from "../shared/graded-gate.mjs";
// WHY THE OTHER PAGE SAYS $10,000 FOR THE CARD THIS ONE PRICES AT $988. Read the
// header of that file before touching any figure in the money section here.
import { loadPriceBasis, basisSentence } from "../shared/price-basis.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(await readFile(join(ROOT, "data/base-set.json"), "utf8"));
const tg = JSON.parse(await readFile(join(ROOT, "data/top-graded.json"), "utf8"));
const t100 = JSON.parse(await readFile(join(ROOT, "data/top100.json"), "utf8"));
const exp = JSON.parse(await readFile(join(ROOT, "public/data/expansions.json"), "utf8"));

/* ---------------------------------------------------------------- prices --
 *
 * THE SAME GATES build-top-graded.mjs USES, and for the same reason: a figure
 * nobody read twice is not publishable, and a page that quietly falls back to
 * one read is worse than a page with no figure. Hard failures rather than
 * warnings, because both of the alternatives are silent.
 *
 * THEY USED TO BE COPIED INTO THIS FILE AND ARE NOW IMPORTED, which is the
 * change that matters more than it looks. Three identical throws are safe to
 * duplicate. A rule with an EXCEPTION in it is not, because the two copies then
 * have to agree about which rows are excluded and why, and the failure mode is
 * this page printing a figure /top-graded.html refuses to print. The rule, the
 * one exclusion currently in force and the evidence behind it are all written
 * out in shared/graded-gate.mjs.
 */
const { verified } = gradedGate(tg);
const missingPrice = [];

/**
 * One PriceCharting row, by set and printing name, or null with the reason
 * recorded. Matched on the exact strings PriceCharting publishes, never on a
 * fuzzy name: "Charizard #4", "Charizard [Shadowless] #4" and "Charizard
 * [1st Edition] #4" are three products and a loose match would land on whichever
 * came first in the file. data/graded.json already records what name-only
 * lookups cost: 4 of 12 landed on a different printing of the right card.
 */
function priceRow(ref) {
  if (!ref?.set || !ref?.name) return null;
  const c = tg.cards.find((x) => x.set === ref.set && x.name === ref.name);
  if (!c) {
    missingPrice.push(`${ref.set} / ${ref.name}: not in data/top-graded.json`);
    return null;
  }
  const v = verified.get(c.rank);
  if (v?.status !== "agree") {
    missingPrice.push(
      `${ref.set} / ${ref.name}: rank ${c.rank} was not double-read (${v?.status || "outside the verified range"})`,
    );
    return null;
  }
  return { ...c, imgOk: v.imgOk };
}

for (const r of d.runs) r.price = priceRow(r.pcRow);

/* THE SECOND TABLE'S PAIRS, and the rule is stricter than for a single row.
 *
 * A COMPARISON WITH ONE VERIFIED SIDE IS WORSE THAN NO COMPARISON, because the
 * unverified half is not visibly missing: it is a number in a column next to a
 * number that was read twice, and the multiple printed beside them inherits the
 * weaker of the two without saying so. So a card is dropped from this table
 * unless BOTH of its printings came back "agree", and priceRow records why in
 * `missingPrice` either way, which the build log prints.
 *
 * All three currently survive. Charizard is ranks 6 and 96, Blastoise 27 and
 * 177, Mewtwo 42 and 366, and the 17 August 2026 run of verify-graded-top.mjs
 * --all double-read every one of them.
 */
const stampPairs = (d.stampPairs?.cards || [])
  .map((p) => ({ ...p, a: priceRow(p.first), b: priceRow(p.shadowless) }))
  .filter((p) => p.a && p.b);

// The sealed pack, from the other price file. Corroborated against TCGplayer's
// own pricepoints endpoint on the crawl (see data/top100.json `sealed.method`),
// which is that file's equivalent of the second read above.
const sealedPack =
  (t100.sealed?.items || []).find((x) => /Base Set \(Shadowless\) \[1st Edition\] Booster Pack/.test(x.name || "")) ||
  null;

// Dates and counts from our own copy of the API, never typed here. `base1` is
// Base Set and `base4` is Base Set 2, which is the trap the page names.
const setOf = (apiId) => (exp.sets || []).find((s) => s.apiId === apiId) || {};
const baseSet = setOf("base1");
const baseSet2 = setOf("base4");
const year = (iso) => (iso || "").slice(0, 4);

/* ----------------------------------------------------------- the pictures --
 *
 * ONE SCAN, MAGNIFIED TWICE, AND IT IS A 1ST EDITION. TCGdex's Base Set
 * Charizard is base1/4, and it is a 1st Edition copy: the EDITION 1 stamp is
 * plainly in the scan, and so is it on all sixteen Base Set Holofoil scans
 * TCGdex serves, checked one by one on 17 August 2026. Since the whole page is
 * about which printing you are holding, saying WHICH printing the picture is of
 * is not a nicety, it is the caption's main job.
 *
 * THE CROP MATHS, and it is an identity rather than an approximation.
 *
 * The scan is 600 wide. A window showing the source rectangle (x0, y0, rw, rh)
 * puts the image at width 600/rw of the box, and then the source pixel x0 has to
 * land on the box's left edge:
 *
 *   left  = -x0 * boxW / rw            as a per cent of boxW   = -x0/rw
 *   top   = -y0 * boxW / rw            as a per cent of boxH, and
 *           boxH = boxW * rh/rw, so this is                    = -y0/rh
 *
 * Both are scale free, so the window frames the same part of the card at every
 * viewport, which is what the fluid caps below need.
 *
 * CAPPED AT THE REGION'S OWN WIDTH, never wider. Past that the browser is
 * upscaling a scan that has no more detail in it, which is the exact bug
 * rarity.html's magnified corners had when they were sized in per cent: a
 * bigger screen painted a blurrier card. See the SRC_W note in build-rarity.mjs.
 *
 * max-width:none IS LOAD BEARING. ui.css sets img{max-width:100%} globally, and
 * without an override at higher specificity the 600px scan is squeezed back into
 * the box and you get the whole card, small, instead of the magnified detail.
 * It fails by looking almost right.
 */
const SCAN_W = 600;
const CARD = "https://assets.tcgdex.net/en/base/base1/4/high.webp";

function zoom({ x, y, w, h, cap, alt, caption }) {
  const img = `<img src="${esc(CARD)}" alt="${esc(alt)}" loading="lazy" decoding="async"
        onerror="this.closest('figure').remove()"${imgDims(CARD)}
        style="width:${((SCAN_W / w) * 100).toFixed(3)}%;left:${((-x / w) * 100).toFixed(3)}%;top:${((-y / h) * 100).toFixed(3)}%">`;
  return `<figure class="bz" style="max-width:${cap}px">
      <div class="bz-win" style="aspect-ratio:${w}/${h}">${avifPicture(img)}</div>
      <figcaption>${caption}</figcaption>
    </figure>`;
}

/**
 * The whole card, at the size it is actually painted.
 *
 * high.webp rather than low.webp on purpose, and it is the same call
 * build-fakes.mjs makes for its one scan: the url is ALSO the source of the two
 * magnified crops above, so asking for low.webp here would make the browser
 * fetch the small file for this figure and the big one for the crops. Two
 * requests where there was one, which is the trap the CROP_CARDS set in
 * build-rarity.mjs exists to avoid.
 */
const wholeCard = () => `<figure class="bs-card">
      ${avifPicture(
        `<img src="${esc(CARD)}" sizes="200px" alt="Base Set Charizard, card 4 of 102, scanned front on, with the EDITION 1 stamp visible under the left of the artwork" loading="lazy" decoding="async" onerror="this.closest('figure').remove()"${imgDims(CARD)}>`,
      )}
      <figcaption>A <b>1st Edition</b> Base Set Charizard, 4/102, scanned by TCGdex. Every magnified picture on
        this page is a crop of this one file, so you can check any of it against the whole card.</figcaption>
    </figure>`;

/* ------------------------------------------------------------- diagrams --
 *
 * ALL LITERAL HEX IN HERE AND IT HAS TO BE. These are SVG presentation
 * attributes and var() is not honoured in one: a fill written as
 * fill="var(--ink)" is not a fallback to something, it paints nothing. Same
 * trap, same fix, as the slab diagram in build-rarity.mjs. The values are
 * ui.css's --mustard, --on-accent, --paper, --paper-3, --keyline, --gold and a
 * mid grey, and they have to be updated here by hand if the palette moves.
 * (The CHART further down is a different case: it already had .bs-c* classes
 * for its type, so its marks went into classes and carry no hex at all.)
 *
 * THE CARD PAINTS ITS OWN PLATE AND THAT IS THE WHOLE KEY TO REPAINTING IT.
 * When the page was white, the card's body was --mustard at 1.76:1 against it
 * and the black outline was what separated card from page. On "Trubbish Deep"
 * the .bs-fig ground is --card #2F4F39 and the body is #70B5D9, which is
 * 4.05:1 against it: THE FILL CARRIES THE SILHOUETTE NOW AND THE OUTLINE DOES
 * NOT. So every mark drawn on the card is measured against #70B5D9, which is a
 * LIGHT plate, and stayed dark; only the marks drawn on the figure ground went
 * light. Deciding that per mark is the job. A blanket light-for-dark swap
 * erases the entire card face.
 *
 * THE CARD STAYS YELLOW AND THAT IS DELIBERATE. A first pass took it teal on
 * the reasoning that the palette has no yellow left. THE PALETTE RULE IS ABOUT
 * THE SITE'S CHROME, NOT ABOUT WHAT A PICTURE OF A THING LOOKS LIKE. The owner's
 * words were "just not use that color in the general pallet of the site
 * colors", and ui.css already carves out exactly this case for .pack-mascot and
 * the eighteen .pack skins: "the pack skins are photographs of real products:
 * they do not take a palette." A Base Set card's yellow border is the single
 * most recognisable thing about the object, and this whole page exists to help
 * somebody identify one they are holding. A teal-bordered card captioned "Base
 * Set" teaches the reader something false about the card in their hand, which
 * costs more than a hue does.
 * IT ALSO MEASURES BETTER. #E8B93A is 5.11:1 against the .bs-fig ground where
 * the teal was 4.05:1, so the silhouette is stronger, and every interior mark
 * below clears its gate on the yellow body as well as it did on the teal one:
 * outline 7.60, drop shadow 4.64, window frame 4.33, art placeholder 5.99.
 * The two aria-labels naming the PARTS rather than the colours are kept: that
 * was an improvement on its own terms and is true either way.
 *
 * NO TEAL READS ON THE CARD BODY, so the interior marks are not teal. --gold
 * is 1.57:1 on the yellow, --gold-deep 1.26.
 * The interior takes --on-accent for ink and --paper / --paper-3 for panels,
 * which is what ui.css already means by "on the accent fill".
 *
 * AND NO BACKTICK MAY APPEAR IN ANY COMMENT INSIDE THESE FUNCTIONS: the markup
 * is a JS template literal and one backtick ends the string.
 *
 * EVERY viewBox IS 360 WIDE, WHICH IS A LEGIBILITY DECISION AND NOT A HABIT. A
 * phone at 390 CSS px leaves about 366px inside .wrap's padding, so a 360 unit
 * box renders at roughly 1.02x and a 12 unit label is 12 real pixels. Draw the
 * same picture in a 560 unit box and the same label is 7.8px on the device the
 * page is mostly read on, which is how a correct diagram becomes an unreadable
 * one. On a desktop these scale up, which costs a vector nothing.
 */

/** A Base Set card face, schematic. Returns markup, positioned by the caller. */
function cardFace(x, y, w, { shadow = false, stamp = false, detail = true } = {}) {
  const h = w * 1.395; // 63 x 88mm, the card's real proportion
  const p = w * 0.085; // border
  const aw = w - p * 2;
  const ay = y + h * 0.12;
  const ah = h * 0.42;
  const sh = w * 0.045; // the drop shadow band, exaggerated. See the caption.
  // EVERY MARK BELOW IS MEASURED AGAINST THE CARD BODY #E8B93A, NOT AGAINST
  // THE FIGURE GROUND, because the body is painted first and everything else
  // sits on top of it. Old ratio on #E8B93A, then new ratio on #70B5D9:
  //   outline        #111111 10.28  ->  #231F20  7.22   --on-accent
  //   top band .5    #111111  3.04  ->  #231F20  2.55
  //   drop shadow    #767676  2.47  ->  #4A4A4A  3.92   see below
  //   art window     #E6E4DD  1.44  ->  #86998C  1.34   --keyline
  //   window frame   #6E5000  4.07  ->  #405D49  3.23   --paper-3
  //   art placeholder on the window, #B9B7B0 1.58 -> #264231 3.65
  //   name bar       #C9A227  1.32  ->  #609CBB  1.33   --gold
  //   copy lines .38 #111111  2.26  ->  #231F20  1.99
  //   footer line .45#111111  2.69  ->  #231F20  2.29
  //   stamp disc     #111111 10.28  ->  #231F20  7.22
  // THE ONES UNDER 3:1 ARE THE ONES THAT WERE UNDER 3:1 BEFORE, and that is
  // deliberate rather than a shortfall left lying about: they are the texture
  // of a card (a tonal art window, a name bar, four rules standing in for body
  // copy), none of them carries a fact, and drawing them at full contrast
  // would make an illustration of a card louder than the two marks the figure
  // exists to point at. Those two DID have to clear the gate and now do: the
  // stamp at 7.22:1 and the drop shadow at 3.92:1, which is the one mark that
  // got BETTER, because 2.47:1 was always too quiet for the thing a whole
  // section is about. It is still a grey, deliberately: it depicts a grey
  // printing artifact and the aria-label calls it a gray band.
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.05}" fill="#E8B93A" stroke="#231F20" stroke-width="1.6"/>
    <rect x="${x + p * 0.9}" y="${y + h * 0.045}" width="${aw * 0.62}" height="${h * 0.05}" rx="1.5" fill="#231F20" opacity=".5"/>
    ${shadow ? `<rect x="${x + p + sh}" y="${ay + sh}" width="${aw}" height="${ah}" rx="2" fill="#4A4A4A"/>` : ""}
    <rect x="${x + p}" y="${ay}" width="${aw}" height="${ah}" rx="2" fill="#86998C" stroke="#405D49" stroke-width="1.6"/>
    ${
      detail
        ? `<rect x="${x + p + aw * 0.18}" y="${ay + ah * 0.3}" width="${aw * 0.5}" height="${ah * 0.46}" rx="${aw * 0.08}" fill="#264231"/>`
        : ""
    }
    <rect x="${x + p + w * 0.09}" y="${ay + ah + h * 0.035}" width="${aw - w * 0.09}" height="${h * 0.045}" rx="1.5" fill="#609CBB" stroke="#405D49" stroke-width="1"/>
    <g fill="#231F20" opacity=".38">
      <rect x="${x + p}" y="${ay + ah + h * 0.115}" width="${aw}" height="${h * 0.018}" rx="1"/>
      <rect x="${x + p}" y="${ay + ah + h * 0.155}" width="${aw * 0.88}" height="${h * 0.018}" rx="1"/>
      <rect x="${x + p}" y="${ay + ah + h * 0.24}" width="${aw}" height="${h * 0.018}" rx="1"/>
      <rect x="${x + p}" y="${ay + ah + h * 0.28}" width="${aw * 0.64}" height="${h * 0.018}" rx="1"/>
    </g>
    <rect x="${x + p}" y="${y + h - h * 0.075}" width="${aw * 0.72}" height="${h * 0.016}" rx="1" fill="#231F20" opacity=".45"/>
    ${
      stamp
        ? // NO "1" DRAWN INSIDE IT, ON PURPOSE. The stamp sits in the card's
          // border strip and is about as wide as that strip is, so at this scale
          // the disc is nine units across and a glyph inside it would be six real
          // pixels on a phone: present in the markup, unreadable on the device the
          // page is read on, and therefore a claim the picture cannot keep. What
          // the mark actually says is shown at 1:1 in the magnified crop of the
          // real scan further down, which is the right place for it. Here it is a
          // black round mark in the border, which is exactly what you see across a
          // table.
          // THE INNER RING IS THE ONE MARK IN THIS FUNCTION DRAWN ON A DARK
          // GROUND, because the ground it is on is the disc itself. It was
          // --paper #F4F3EF, which is a DARK green now (#264231) and would
          // have vanished into the disc it sits inside. --chrome-ink #F7F8F7
          // is the token for light-on-dark and measures 15.31:1 there.
          `<circle cx="${x + p * 0.62}" cy="${ay + ah + h * 0.05}" r="${p * 0.62}" fill="#231F20"/>
           <circle cx="${x + p * 0.62}" cy="${ay + ah + h * 0.05}" r="${p * 0.3}" fill="none" stroke="#F7F8F7" stroke-width="1"/>`
        : ""
    }`;
}

/**
 * The three runs, side by side, with the two marks drawn where they really sit.
 *
 * The stamp and the shadow are the only two differences drawn, because they are
 * the only two a reader can act on. Everything else about these cards is
 * identical and drawing more of it would suggest otherwise.
 */
function runsDiagram() {
  // 92 WIDE AND 30 APART, WHICH IS ARITHMETIC RATHER THAN TASTE. The two rings
  // below sit ON the marks they point at, and a mark is at the very edge of its
  // card: the stamp overhangs the left edge of card one and the shadow overhangs
  // the right edge of card three. At 104 wide with the cards pushed to the box
  // edges, both rings were clipped by the viewBox. The gap is what gives them
  // somewhere to be.
  const W = 92;
  const H = W * 1.395;
  const xs = [16, 138, 260];
  const names = ["1st Edition", "Shadowless", "Unlimited"];
  const marks = [
    { stamp: true, shadow: false },
    { stamp: false, shadow: false },
    { stamp: false, shadow: true },
  ];
  const cards = xs
    .map(
      (x, i) => `<g>${cardFace(x, 34, W, marks[i])}
      <text x="${x + W / 2}" y="24" text-anchor="middle" class="bs-hd">${names[i].toUpperCase()}</text>
      <text x="${x + W / 2}" y="${34 + H + 20}" text-anchor="middle" class="bs-cap">${
        marks[i].stamp ? "stamp" : "no stamp"
      }</text>
      <text x="${x + W / 2}" y="${34 + H + 34}" text-anchor="middle" class="bs-cap">${
        marks[i].shadow ? "shadow" : "no shadow"
      }</text></g>`,
    )
    .join("\n    ");
  // The two rings point at the two marks on the cards that have them, so the
  // words underneath are never the only thing carrying the difference. A reader
  // who cannot see the ring still has the words; a reader who skips the words
  // still has the ring. Neither is load bearing alone.
  // EACH RING IS DRAWN TWICE AND THAT IS NOT A FLOURISH EITHER. A ring is
  // centred on a mark at the very EDGE of a card, so roughly two thirds of it
  // crosses the card body and the rest crosses the figure ground, and those
  // two grounds now sit on opposite sides of the palette: #70B5D9 and #2F4F39.
  // NO SINGLE COLOUR CLEARS 3:1 AGAINST BOTH, and that is arithmetic rather
  // than a failure to look hard enough. Clearing the body needs a relative
  // luminance of at least 1.345, which is off the top of the scale, and
  // clearing the ground from below needs a negative one. It used to be one
  // gold stroke because the card was yellow and the page was white, so a
  // single mid tone sat between them; nothing sits between them any more.
  // So: a dark casing at 4.5 wide, which reads 7.22:1 where it crosses the
  // card, and a light core at 2.5 on top of it, which reads 8.03:1 on the
  // ground. The ring is the same 2.5 wide mark it always was with an edge
  // around it. The words under each card still carry the difference on their
  // own, exactly as the note above says.
  const ring = (cx, cy) =>
    `<circle cx="${cx}" cy="${cy}" r="13" fill="none" stroke="#231F20" stroke-width="4.5"/>
    <circle cx="${cx}" cy="${cy}" r="13" fill="none" stroke="#EEF1EF" stroke-width="2.5"/>`;
  const ringStamp = ring(xs[0] + W * 0.0527, 34 + H * 0.59);
  const ringShadow = ring(xs[2] + W * 0.955, 34 + H * 0.3);
  return `<figure class="bs-fig bs-fig-wide">
  <svg viewBox="0 0 360 226" role="img" aria-label="The three Base Set print runs drawn side by side. The 1st Edition card carries a round stamp below the left of its artwork. The Shadowless card carries neither a stamp nor a shadow. The Unlimited card has a gray band down the right and bottom edges of its artwork window.">
    ${cards}
    ${ringStamp}
    ${ringShadow}
  </svg>
  <figcaption>A schematic, not three real cards. The stamp and the shadow are the only two differences drawn,
    because they are the only two you can act on. Both are drawn larger than life; the shadow on a real card is
    about the width of the yellow border stripe next to it.</figcaption>
</figure>`;
}

/**
 * The shadow, magnified, with and without.
 *
 * THE ONE PICTURE ON THE PAGE, and it is drawn rather than photographed for the
 * reason set out at the top of this file: the difference is a band a couple of
 * millimetres wide, and the only Unlimited and Shadowless scans available here
 * are 325 by 450 product photographs at different crops. What is drawn is the
 * geometry, which is the part that is documented.
 */
function shadowDiagram() {
  // HEAD IS AN ARRAY OF LINES AND THAT IS NOT A FLOURISH. "1ST EDITION &
  // SHADOWLESS" is 24 characters, which at 12 units a line in Space Mono is 173
  // units centred inside a 158 unit panel: it painted straight out of its own
  // half of the picture. SVG neither wraps nor clips, so the fix has to be here
  // rather than in CSS.
  const panel = (x, withShadow, head, note) => {
    const W = 158;
    const artW = 74;
    const frameW = 11;
    const bandW = withShadow ? 15 : 0;
    return `<g>
      ${head
        .map(
          (line, i) =>
            `<text x="${x + W / 2}" y="${14 + i * 13}" text-anchor="middle" class="bs-hd">${line}</text>`,
        )
        .join("")}
      ${/* THE ARTWORK BLOCK IS --keyline AND IT WAS --paper FIRST, WHICH IS THE
           MISTAKE WORTH RECORDING. --paper #264231 measured 7.07:1 under the
           label and 4.88:1 against the card body, so on paper it was the better
           number in both places. Then the page was screenshotted: --paper is
           1.21:1 against the figure ground #2F4F39, the block covers the LEFT
           HALF OF THE PANEL, and the left half of both cards had simply
           dissolved into the page. Every ratio that was checked passed, and the
           one pairing that mattered was the one nobody had thought to check,
           because the block is INSIDE the card and it never occurred to anyone
           that it was also up against the ground.
           --keyline #86998C is 3.02:1 on the figure ground, so the panel reads
           as an object again, and 1.34:1 against the body, which is the same
           whisper of separation the old #B9B7B0 had against the old #E8B93A at
           1.09:1. It is also the same fill the art window in cardFace takes, so
           the two drawings agree about what a card's artwork looks like.
           THE LABEL NEEDED ITS OWN CLASS BECAUSE OF THAT, AND IT FIXES A BUG
           THAT PREDATES THE REPAINT. The word "artwork" sits on this block in
           .bs-cap, which is --ink-2: that was #5B5B5B on #B9B7B0, 3.38:1, under
           the 4.5:1 an 11px label needs, and it had been wrong since the figure
           was drawn. --ink-2 is light now and would be 2.38:1 here, so it takes
           .bs-capd and --on-accent instead: 5.40:1, the first time this label
           has passed.
           The frame beside it is the same pair of swaps as everywhere else in
           this file: --gold for the fill at 1.33:1, which is what the old
           #C9A227 measured on the old body to a hundredth, and --paper-3 for
           its outline at 3.23:1. */ ""}
      <rect x="${x}" y="30" width="${W}" height="150" rx="4" fill="#E8B93A" stroke="#231F20" stroke-width="2"/>
      <rect x="${x}" y="30" width="${artW}" height="150" fill="#86998C"/>
      <rect x="${x + artW}" y="30" width="${frameW}" height="150" fill="#609CBB" stroke="#405D49" stroke-width="1.4"/>
      ${
        withShadow
          ? `<rect x="${x + artW + frameW}" y="30" width="${bandW}" height="150" fill="url(#bs-shadowfade)"/>`
          : ""
      }
      <text x="${x + 34}" y="108" text-anchor="middle" class="bs-capd">artwork</text>
      ${/* THE POINTER SITS IN THE SAME PLACE IN BOTH PANELS, which is the whole
           argument of the figure: one spot on the card, something in it on the
           right and nothing in it on the left. It used to be drawn at the middle
           of the band, so with no band it collapsed onto the frame's outer edge
           and the left panel appeared to be pointing at the frame rather than at
           the empty strip beside it. The label is centred on the pointer for the
           same reason. AND IT STRADDLES TWO GROUNDS, so it is cased exactly
           like the two rings on the runs diagram: the card ends at y=180 and
           the pointer runs 172 to 186, so 8 of its 14 units are on the card
           body and 6 are on the figure ground. Dark casing 3.2 wide reading
           7.22:1 on the body, light core 1.6 wide reading 8.03:1 on the
           ground. One solid colour cannot do both; the proof is beside the
           rings. */ ""}
      <line x1="${x + artW + frameW + 7}" y1="186" x2="${x + artW + frameW + 7}" y2="172" stroke="#231F20" stroke-width="3.2"/>
      <line x1="${x + artW + frameW + 7}" y1="186" x2="${x + artW + frameW + 7}" y2="172" stroke="#EEF1EF" stroke-width="1.6"/>
      <text x="${x + artW + frameW + 7}" y="200" text-anchor="middle" class="bs-lbl">${note}</text>
    </g>`;
  };
  return `<figure class="bs-fig bs-fig-wide">
  <svg viewBox="0 0 360 236" role="img" aria-label="The right edge of the artwork window, magnified twice. On a 1st Edition or Shadowless card the border runs straight up to the inner frame. On an Unlimited card a gray band sits outside the frame.">
    <defs>
      ${/* THE ONE COLOUR IN THIS FILE THE REPAINT DID NOT TOUCH, and it was
           checked rather than skipped. The band depicts a grey printing
           artifact, it is what the aria-label calls it, and it happens to land
           in almost the same place against the new card body as against the
           old one: 4.82:1 on #E8B93A, 3.92:1 on #70B5D9, still past the 3:1 a
           graphical mark needs. Repainting it would have been repainting the
           subject of the figure to match the frame around it. */ ""}
      <linearGradient id="bs-shadowfade" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#4A4A4A" stop-opacity=".95"/>
        <stop offset="1" stop-color="#4A4A4A" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${panel(8, false, ["1ST EDITION", "&amp; SHADOWLESS"], "nothing here")}
    ${panel(194, true, ["UNLIMITED"], "gray band here")}
    <text x="180" y="224" text-anchor="middle" class="bs-cap">the right edge of the artwork window, magnified</text>
  </svg>
  <figcaption>Exaggerated so it survives a phone screen. On a real card the band is a couple of millimeters and it
    runs down the right side of the window and along the bottom, never the top or the left. Tilt the card under a
    light: a real shadow has a soft outer edge, which is what tells it apart from a scuff.</figcaption>
</figure>`;
}

/**
 * Where the four checks happen, on one card.
 *
 * Same job as the anatomy diagram on /fake-cards.html: the checks below are
 * described in words and nothing else on the page says WHERE on the card each
 * one is. The numbers match the list under it, and the count is passed in rather
 * than written into the aria-label, because a literal there is the one figure a
 * sighted reader never sees and so the one that goes stale in silence.
 */
function cardMapDiagram(nTells) {
  const X = 128;
  const Y = 26;
  const W = 104;
  const H = W * 1.395;
  // ONE WORD A LABEL, AND THE BUBBLES ARE AT 86 AND 274 RATHER THAN 74 AND 286.
  // Space Mono at 11 units runs about 6.6 units a character in this box, so
  // "number, no symbol" set from 301 ran to 413 in a 360 unit viewBox: the label
  // was simply off the right of the picture, and an SVG does not clip or wrap, it
  // just paints outside itself and the figure looks fine until you read it. The
  // budget is 360 minus the bubble edge, so a right-hand label gets 71 units,
  // which is ten characters. Count before adding a word here.
  // THE LEADERS ARE CASED, THE BUBBLES ARE NOT, AND THE DIFFERENCE IS WHERE
  // EACH ONE IS. Both bubbles sit at x=86 and x=274 and the card runs 128 to
  // 232, so a bubble is entirely on the figure ground: --ink fills it at
  // 8.03:1 and .bs-num, which is already --paper-2, writes the numeral back on
  // top at 8.03:1. That pair inverted for free and needed no new colour. The
  // LEADERS start on the card and end off it, and call 3 is close to an even
  // split: from x=169.6 to x=86 is 42 units on the card body and 42 on the
  // ground. So they take the same casing as the rings on the runs diagram,
  // dark under light, for the same reason and with the same proof: 7.22:1 on
  // the body from the casing, 8.03:1 on the ground from the core.
  const call = (n, px, py, tx, ty, label, anchor) => `
    <line x1="${px}" y1="${py}" x2="${tx}" y2="${ty}" stroke="#231F20" stroke-width="3" stroke-dasharray="3 3"/>
    <line x1="${px}" y1="${py}" x2="${tx}" y2="${ty}" stroke="#EEF1EF" stroke-width="1.4" stroke-dasharray="3 3"/>
    <circle cx="${tx}" cy="${ty}" r="10" fill="#EEF1EF"/>
    <text x="${tx}" y="${ty + 4}" text-anchor="middle" class="bs-num">${n}</text>
    <text x="${anchor === "end" ? tx - 15 : tx + 15}" y="${ty + 4}" text-anchor="${anchor}" class="bs-lbl">${label}</text>`;
  return `<figure class="bs-fig bs-fig-wide">
  <svg viewBox="0 0 360 240" role="img" aria-label="A Base Set card with the ${nTells} places to look marked and numbered, matching the list below it: the 1st Edition stamp under the left of the artwork, the drop shadow at the right edge of the artwork window, the copyright line along the bottom, and the card number in the bottom right with no set symbol beside it.">
    ${cardFace(X, Y, W, { shadow: true, stamp: true })}
    ${call(1, X + W * 0.055, Y + H * 0.62, 86, Y + H * 0.62, "stamp", "end")}
    ${call(2, X + W * 0.96, Y + H * 0.3, 274, Y + H * 0.3, "shadow", "start")}
    ${call(3, X + W * 0.4, Y + H * 0.93, 86, Y + H * 0.99, "copyright", "end")}
    ${call(4, X + W * 0.86, Y + H * 0.93, 274, Y + H * 0.99, "number", "start")}
  </svg>
  <figcaption>Every check and where it happens. Mark 4 is the card number, and what matters there is the
    <b>empty space</b> beside it: Base Set prints no expansion symbol. A schematic, not a real card, and it is
    drawn with the stamp and the shadow both showing so all four marks can be pointed at. No real card carries
    both.</figcaption>
</figure>`;
}

/* --------------------------------------------------------------- markup -- */

const CONF_CLASS = {
  "Decides it outright": "hi",
  "Second opinion, and the only one for Trainers": "mid",
  "Supporting evidence only": "lo",
  "Tells you it is Base Set, not which run": "mid",
};

const SOURCE_WORDS = {
  // DAY-FIRST IS THE BRITISH ORDER AND THESE SHIP. The house format for a
  // date a reader sees is "August 17, 2026", which is what longDate() writes
  // everywhere else on this page; only these three hand-typed source words were
  // the other way round, so one page carried both orders.
  scan: "Read off a card scan here, August 17, 2026",
  "scan-partial": "Half read off a card scan here, half Bulbapedia's, August 17, 2026",
  bulbapedia: "Bulbapedia, 1st Edition (TCG), read August 17, 2026",
  data: "api.pokemontcg.io, through this site's own expansion list",
  "cross-link": "Covered in full on the pages linked below",
};

const tellCard = (t, i) => `      <article class="bs-t" id="${esc(t.id)}">
        <div class="bs-t-head">
          <span class="bs-t-no">${i + 1}</span>
          <h3>${esc(t.name)}</h3>
          <span class="bs-conf ${CONF_CLASS[t.confidence] || "mid"}">${esc(t.confidence)}</span>
        </div>
        <p class="bs-where">${esc(t.where)}</p>
        <p>${esc(t.how)}</p>
        ${t.why ? `<p class="bs-why"><b>Why it works.</b> ${esc(t.why)}</p>` : ""}
        ${t.caveat ? `<p class="bs-caveat"><b>But.</b> ${esc(t.caveat)}</p>` : ""}
        <p class="bs-src">${esc(SOURCE_WORDS[t.source] || t.source)}</p>
      </article>`;

/**
 * A price row for one printing.
 *
 * Three figures, not one, and the order is deliberate: ungraded first, because
 * that is the column a reader holding a loose card is actually in. The PSA 10
 * headline is the one everybody quotes and it is the one with the fewest sales
 * behind it, which the note under the table says in words.
 *
 * The picture comes from the same PriceCharting product record as the price, for
 * the reason build-top-graded.mjs sets out at length: half of these products are
 * separate PRINTINGS of one card, which is exactly where a name-based image
 * lookup lands on the wrong one, and a picture of the wrong printing next to a
 * six figure number is a worse page than a plainer photo.
 */
function priceCard(r) {
  const p = r.price;
  const src = p?.pcImg ? p.pcImg.replace(/\/\d+\.jpg$/, "/240.jpg") : null;
  const art =
    p && p.imgOk && src
      ? `<img class="bs-p-scan" src="${esc(src)}" alt="${esc(p.name)}, ${esc(p.set)}"${imgDims(src)} loading="lazy" decoding="async">`
      : `<span class="bs-p-noscan">No scan<span class="sr-only"> available for this printing</span></span>`;
  return `<li class="bs-p">
      <span class="bs-p-art">${art}</span>
      <span class="bs-p-body">
        <span class="bs-p-name">${esc(r.name)}</span>
        <span class="bs-p-when">${esc(r.order)}</span>
        ${
          p
            ? `<span class="bs-p-nums">
          <span class="bs-p-n"><b>${moneyCompact(p.ungraded)}</b> <span class="bs-u">Ungraded</span></span>
          <span class="bs-p-n">${moneyCompact(p.g9)} <span class="bs-u">Grade 9</span></span>
          <span class="bs-p-n">${moneyCompact(p.psa10)} <span class="bs-u">PSA 10</span></span>
        </span>`
            : `<span class="bs-p-none">No double-read figure for this printing, so none is printed.</span>`
        }
      </span>
    </li>`;
}

/**
 * The 1st Edition against Shadowless table, or nothing at all.
 *
 * WHY THIS PAIR AND NOT SHADOWLESS AGAINST UNLIMITED, which is the comparison
 * the money section really wants and the one this table was started as. The
 * Unlimited printing of every Base Set card except Charizard is missing from
 * data/top-graded.json, and it is missing for a reason no amount of verifying
 * will change: that file is ranked BY PSA 10 VALUE and its floor is $12,000 at
 * rank 400, while an Unlimited Blastoise or Mewtwo is worth a long way under
 * that. The scarce printings are the ones a value ranking keeps. So the pair
 * that exists on more than one card is the stamp, and the stamp is what this
 * table measures. The reader is told all of that in `stampPairs.missing`
 * rather than left to notice the hole.
 *
 * THREE IS THE FLOOR AND IT IS ENFORCED HERE RATHER THAN ASSUMED. The whole
 * argument for a second table is that one card is an anecdote; two is not much
 * better. Below three verified pairs this returns "" and the section does not
 * render, which leaves the page exactly as it was rather than shipping a weaker
 * version of the claim.
 *
 * NO FIGURE IS TYPED AND NEITHER IS THE SUMMARY. The range under the table is
 * computed from the multiples actually printed above it, so it cannot drift
 * away from them the way a sentence written once does.
 */
/**
 * The same table, drawn, so the SPREAD is visible.
 *
 * WHY THIS SECTION NEEDED A PICTURE. It was 2,259 characters with no figure at
 * all, sitting between a section carrying three real card scans and one
 * carrying four. But the reason is not symmetry, it is that the section makes a
 * claim the numbers alone do not deliver: "it is not one famous card behaving
 * strangely". A reader proves that by holding six multiples in their head at
 * once and noticing that all six clear 1x by a distance. Six bars against a 1x
 * line is that same check, done by the eye in one go.
 *
 * IT DRAWS THE MULTIPLE AND NOT THE MONEY, and that is the whole design
 * decision. The prices run from $81.80 to $343,098, four orders of magnitude,
 * so a bar chart of them is one enormous Charizard bar and five slivers, which
 * argues the opposite of what the section says. A log axis would fix the
 * geometry and lose the reader. The multiple is already the comparable number,
 * it is what the table's last column prints, and it is dimensionless.
 *
 * NOTHING HERE IS TYPED. The bars, the range and the axis all come off the same
 * `ratios` the table computes, so the picture cannot drift from the rows.
 */
function fitsBS(text, px, budget, what) {
  // Space Mono advances 0.6em a character. SVG neither wraps nor clips, so a
  // label that does not fit paints through its neighbour and renders clean.
  const w = String(text).length * px * 0.6;
  if (w > budget) throw new Error(`stampChart: "${text}" needs ${w.toFixed(1)}px, ${what} has ${budget.toFixed(1)}px`);
  return text;
}

function stampChart(pairs) {
  const rows = [];
  for (const p of pairs) {
    if (p.a.ungraded && p.b.ungraded) rows.push({ card: p.card, cond: "Ungraded", m: p.a.ungraded / p.b.ungraded });
    if (p.a.psa10 && p.b.psa10) rows.push({ card: p.card, cond: "PSA 10", m: p.a.psa10 / p.b.psa10 });
  }
  if (rows.length < 4) return ""; // too few bars to read as a spread

  const max = Math.max(...rows.map((r) => r.m));
  // An even domain so the ticks land on whole even multiples.
  const dom = Math.max(2, Math.ceil(max / 2) * 2);

  const W = 360, X0 = 74, X1 = 300;
  const TOP = 26, BH = 13, BG = 5, HEAD = 16, GAP = 12;
  const x = (m) => X0 + (m / dom) * (X1 - X0);

  // Group the bars back under their card so each name is written once.
  const byCard = [];
  for (const r of rows) {
    let g = byCard.find((c) => c.card === r.card);
    if (!g) byCard.push((g = { card: r.card, bars: [] }));
    g.bars.push(r);
  }

  let y = TOP;
  let body = "";
  for (const g of byCard) {
    fitsBS(g.card, 11, W - 4, "the card name row");
    // A KNOCKOUT UNDER THE NAME, AND IT WAS FOUND IN A SCREENSHOT RATHER THAN
    // IN THE MARKUP. The names start at x=0 and the plot starts at 74, so any
    // name over 74 units long runs INTO the grid: "Charizard 4/102" is 99 units
    // and had both the 0x gridline and the dashed 1x line painted through the
    // "0" of "4/102". The geometry was right, the CSS was right, every label
    // passed its width budget, and it was only wrong to look at.
    //
    // IT WAS fill="#FFFFFF" AND THAT WAS THE FIGURE'S BACKGROUND SPELLED OUT
    // BY HAND, which is exactly the kind of literal that goes wrong the moment
    // a palette moves: on a #2F4F39 card it would have painted a white bar
    // under every set name and the knockout would have become the loudest mark
    // in the chart. It is .bs-cknock now and it takes --card, so it is the
    // figure's own background by reference and cannot drift from it again. A
    // knockout has no contrast requirement of its own: its whole job is to be
    // indistinguishable from what it sits on.
    const nw = g.card.length * 11 * 0.6;
    body += `<rect x="-2" y="${y - 1}" width="${(nw + 7).toFixed(1)}" height="15" class="bs-cknock"/>
      <text x="0" y="${y + 11}" class="bs-cname">${esc(g.card)}</text>`;
    y += HEAD;
    for (const b of g.bars) {
      const w = x(b.m) - X0;
      fitsBS(b.cond, 10, X0 - 8, "the condition gutter");
      const val = `${b.m.toFixed(1)}x`;
      fitsBS(val, 10, W - (X0 + w + 5), "the value label");
      body += `<text x="${X0 - 8}" y="${y + BH - 3}" text-anchor="end" class="bs-ccond">${esc(b.cond)}</text>
      <rect x="${X0}" y="${y}" width="${w.toFixed(1)}" height="${BH}" class="bs-cbar"/>
      <text x="${(X0 + w + 5).toFixed(1)}" y="${y + BH - 3}" class="bs-cval">${esc(val)}</text>`;
      y += BH + BG;
    }
    y += GAP - BG;
  }

  const AX = y + 2;
  let ticks = "";
  for (let t = 0; t <= dom; t += 2) {
    ticks += `<line x1="${x(t).toFixed(1)}" y1="${TOP - 4}" x2="${x(t).toFixed(1)}" y2="${AX}" class="bs-cgrid" stroke-width="1"/>
    <text x="${x(t).toFixed(1)}" y="${AX + 14}" text-anchor="middle" class="bs-ctick">${t}x</text>`;
  }
  // THE 1x LINE IS THE ONE THAT MATTERS and it is dashed rather than coloured,
  // so it survives the page being read in greyscale or by somebody who cannot
  // separate two hues. Everything to the right of it is the stamp being worth
  // something; a bar landing ON it would mean the stamp was worth nothing.
  const one = x(1);
  const lbl = fitsBS("1x, the same price", 10, W - one, "the 1x note");
  const H = AX + 24;

  const lo = Math.min(...rows.map((r) => r.m));
  return `<figure class="bs-fig bs-fig-wide">
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="A bar chart of ${rows.length} multiples: what the 1st Edition printing is worth against the Shadowless printing of the same card, ungraded and in a PSA 10, for ${byCard.length} cards. Every bar clears 1x, and they run from ${lo.toFixed(1)} times to ${max.toFixed(1)} times.">
    ${ticks}
    <line x1="${one.toFixed(1)}" y1="${TOP - 4}" x2="${one.toFixed(1)}" y2="${AX}" class="bs-caxis" stroke-width="1.4" stroke-dasharray="4 3"/>
    <text x="${one.toFixed(1)}" y="${TOP - 10}" class="bs-cnote">${esc(lbl)}</text>
    ${body}
    <line x1="${X0}" y1="${AX}" x2="${X1}" y2="${AX}" class="bs-caxis" stroke-width="1.2"/>
  </svg>
  ${/* THE CAPTION USED TO ADD "and no bar is close to the next one either",
        WHICH THE CHART ITSELF DISPROVES: Blastoise ungraded is 5.8x and
        Charizard ungraded is 5.6x, two tenths apart and visibly the same
        length. It was written to sound like the section's argument and was not
        checked against the six numbers directly above it. The honest version
        is the SPREAD, which is wide, and both ends of it are derived. */ ""}
  <figcaption>How many times the 1st Edition printing is worth what the Shadowless one is, on the same card, on the
    same day. The dashed line is where the two printings would be worth the same. Every bar clears it by a distance,
    and they spread from ${lo.toFixed(1)}x to ${max.toFixed(1)}x, which is why one card on its own would have been
    an anecdote.</figcaption>
</figure>`;
}

const MIN_PAIRS = 3;
function stampTable() {
  const s = d.stampPairs;
  if (!s || stampPairs.length < MIN_PAIRS) return "";

  const ratios = [];
  const line = (label, a, b) => {
    const m = a && b ? a / b : null;
    if (m) ratios.push(m);
    return `<span class="bs-cmp-cell">
          <span class="bs-cmp-lbl">${esc(label)}</span>
          <span class="bs-cmp-n"><b>${moneyCompact(a)}</b> <span class="bs-u">1st Edition</span></span>
          <span class="bs-cmp-n">${moneyCompact(b)} <span class="bs-u">Shadowless</span></span>
          <span class="bs-cmp-x">${m ? `${m.toFixed(1)}x` : ""}<span class="bs-u">for the stamp</span></span>
        </span>`;
  };

  const rows = stampPairs
    .map(
      (p) => `      <li class="bs-cmp-row">
        <span class="bs-cmp-card">${esc(p.card)}</span>
        ${line("Ungraded", p.a.ungraded, p.b.ungraded)}
        ${line("PSA 10", p.a.psa10, p.b.psa10)}
      </li>`,
    )
    .join("\n");

  const lo = Math.min(...ratios);
  const hi = Math.max(...ratios);
  // Spelled out in prose, digits in the table. "Both printings of all 3 cards"
  // is the kind of sentence that reads like a log line; the count is still
  // derived, so it cannot drift from the rows above it.
  const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const n = WORDS[stampPairs.length] || String(stampPairs.length);

  return `<section class="band bs-sec">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The stamp, priced</p>
    <h2>${esc(s.title)}</h2>
    <p class="bs-p2">${esc(s.lede)}</p>
    ${stampChart(stampPairs)}
    <ul class="bs-cmp">
${rows}
    </ul>
    <p class="bs-p2" style="margin-top:var(--s4)">Every figure above is PriceCharting's price guide, read on
      ${esc(read)} and read a second time from each card's own product page before it was published here. Both
      printings of all ${n} cards came back agreeing, which is the only reason they are on the page:
      a comparison with one checked side and one unchecked side is worse than no comparison. It is a guide value
      computed from completed sales, not a record of any single sale.</p>
    <p class="bs-p2">Across ${n} cards and both columns the 1st Edition printing runs between
      <b>${lo.toFixed(1)}x</b> and <b>${hi.toFixed(1)}x</b> the Shadowless one. That is the point of the table: it
      is not one famous card behaving strangely. ${esc(s.note)}</p>
    ${/* UPPERCASED BEFORE esc(), NEVER AFTER. esc() emits entities, and
          "&amp;".toUpperCase() is "&AMP;", which browsers do not decode. Same
          order as the two longDate() footers further down this file. */ ""}
    <p class="bs-foot">${esc(s.missing.toUpperCase())}</p>
  </div>
</section>`;
}

const priced = d.runs.filter((r) => r.price);
const first = d.runs.find((r) => r.id === "first")?.price;
const shad = d.runs.find((r) => r.id === "shadowless")?.price;
const unl = d.runs.find((r) => r.id === "unlimited")?.price;
const mult = (a, b) => (a && b ? `${(a / b).toFixed(1)}x` : null);

const read = longDate(tg.checked);
const readShort = shortDate(tg.checked);

// The other feed's figure for the same cards. Resolved by TCGplayer productId
// and by exact PriceCharting row name, never by a fuzzy match on either side.
const basis = await loadPriceBasis();
const BASIS_TEXT = basisSentence(basis);

const desc =
  "1st Edition, Shadowless or Unlimited? The stamp and the drop shadow that tell 1999 Base Set " +
  "cards apart, drawn and magnified on a real card, with what the gap is actually worth.";

/* ------------------------------------------------------------- structured -- */

/* THESE SIX WERE IN THE SCHEMA AND NOWHERE ELSE UNTIL 21 AUGUST 2026, and they
 * are the reason this page was the second worst on the site for it: 0 of 6
 * questions and 0 of 6 answers appeared in the rendered text. faqBlock renders
 * them and builds the FAQPage from the same array, and it throws if the two
 * ever come apart. shared/faq.mjs carries the argument.
 *
 * RENDERING RATHER THAN DELETING, because the answers are not on this page in
 * any other words. Measured in 6-word runs against the page's own text: 12%
 * already said, and the two that matter most were 8% and 0%. The shadowless
 * price comparison below is 95 words of sourced, two-feed reasoning that no
 * reader could reach, on the page most likely to be searched for it, and the
 * 1999-2000 copyright answer is the only place on the site that explains the
 * 4th print at all. That is content, not markup.
 *
 * THE HowTo ON THIS PAGE WAS ALREADY COMPLIANT AND WAS LEFT ALONE. An audit
 * reported 1 of 5 steps visible; re-measured, all 5 are, because each step's
 * `where` and `how` render as prose in its own section and the audit's
 * normaliser did not join two adjacent elements. Do not "fix" it.
 */
const FAQ = faqBlock(
  [
    [
      "How do I know if my Base Set card is 1st Edition?",
      "Look under the left edge of the artwork for a small black circle with a 1 in it and the word EDITION curved over the top. If it is there the card is 1st Edition. It is not the expansion symbol: Base Set does not have one.",
    ],
    [
      "What does shadowless mean on a Pokemon card?",
      "It means the artwork window has no drop shadow around it. On an Unlimited Base Set card a soft gray band runs down the right side of the artwork window and along its bottom. On a Shadowless card there is nothing there, and there is no 1st Edition stamp either. Shadowless was the second English print run of Base Set, between the 1st Edition run and Unlimited.",
    ],
    // THIS ANSWER CARRIES THE OTHER FEED'S FIGURE AND IT IS THE MOST IMPORTANT
    // PLACE ON THE SITE THAT IT DOES. Google can lift a FAQPage answer and show
    // it on its own, with no page around it: this one said "an ungraded
    // Shadowless Base Set Charizard at $988" while /most-valuable-cards.html
    // ranked the same card at $10,000, and a reader who saw only the snippet had
    // nothing to tell them the two were measuring different things. The
    // qualifying clause is inside the answer text for that reason, not beside it.
    [
      "Is shadowless worth more than unlimited?",
      `Yes, and the gap is clearest on ungraded copies. PriceCharting's price guide, read ${readShort}, put an ungraded Shadowless Base Set Charizard at ${moneyCompact(
        shad?.ungraded,
      )} against ${moneyCompact(unl?.ungraded)} for the Unlimited printing of the same card. ` +
        `Those are price guide values. A marketplace measures something different: TCGplayer's market price for the same ungraded Shadowless Charizard, read ${
          basis.tcgRead
        }, was ${
          basis.both[0] ? `$${basis.both[0].market.toLocaleString("en-US")}` : ""
        }, because Market Price is what recently sold on that one marketplace while a guide value is computed across the wider set of sales PriceCharting tracks. Neither figure is the other's correction.`,
    ],
    [
      "Are 1st Edition cards shadowless?",
      "Yes. Every 1st Edition Base Set card is also shadowless, because the shadow was added later. That is why the stamp is checked first: a card with the stamp is 1st Edition, and a card with no stamp and no shadow is what collectors call Shadowless.",
    ],
    [
      "What does the 1999-2000 copyright mean on a Pokemon card?",
      "It is the fourth Base Set print run, sometimes called the 4th print. It looks like an Unlimited card in every other way. Every earlier run reads 1999 Wizards along the bottom edge; this one reads 1999-2000 Wizards. It is not rarer than Unlimited.",
    ],
    [
      "Does Base Set have a set symbol?",
      "No. The bottom right of a Base Set card is the card number and a rarity mark with an empty space between them. Every set after it prints an expansion symbol in that gap, which is the quickest way to tell a Base Set card from a Base Set 2 reprint of the same artwork.",
    ],
  ],
  {
    heading: "The questions this page gets asked",
    path: "/base-set.html",
    site: SITE,
  }
);


const ld = [
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to tell a 1st Edition, Shadowless and Unlimited Base Set Pokemon card apart",
    description: desc,
    totalTime: "PT2M",
    step: d.tells.map((t, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: t.name,
      text: `${t.where}. ${t.how}`,
      url: `${SITE}/base-set.html#${t.id}`,
    })),
  },
  FAQ.ld,
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Base Set prints" },
    ],
  },
];

/* ------------------------------------------------------------------ CSS -- */

const style = `
.bs-lede{font-size:var(--t-lede);color:var(--ink-2);max-width:42em}
.bs-sec{padding:var(--s6) 0}
.bs-sec h2{font:400 var(--t-l)/1.15 var(--display);margin-bottom:var(--s3)}
.bs-p2{color:var(--ink-2);max-width:46em;margin-bottom:var(--s4)}

/* The drawn figures. Centred, capped, and the caption is the honest part of
   every one of them: each says what it is a drawing OF and what has been
   exaggerated to survive a phone screen. */
.bs-fig{margin:var(--s5) 0;background:var(--card);border:1px solid var(--hair);
  border-radius:var(--r);padding:var(--s4);box-shadow:var(--lift)}
.bs-fig svg{display:block;width:100%;height:auto;max-width:520px;margin-inline:auto}
.bs-fig figcaption{font-size:var(--t-sm);color:var(--ink-2);line-height:1.5;margin-top:var(--s3)}
.bs-fig-wide{max-width:620px}
.bs-hd{font:700 12px/1 var(--mono);letter-spacing:.05em;fill:var(--ink)}
.bs-cap{font:400 11px/1 var(--mono);fill:var(--ink-2)}
/* .bs-cap for a label on the FIGURE GROUND, .bs-capd for one drawn on a card's
   own plate. Same size, same face, opposite ink, because they are on opposite
   grounds: 5.86:1 and 5.40:1 respectively. There is exactly one of the second
   kind, the word "artwork" inside the magnified panels, and the long note in
   shadowDiagram is why it needed splitting out. */
.bs-capd{font:400 11px/1 var(--mono);fill:var(--on-accent)}
.bs-lbl{font:700 11px/1 var(--mono);fill:var(--ink)}
/* --paper-2 SURVIVED THE REPAINT BY BEING RIGHT FOR THE OPPOSITE REASON. It
   was #FFFFFF, a white numeral on a black callout bubble; it is #2F4F39 now,
   a dark numeral on the near-white bubble the same repaint gave the callout.
   The pair inverted together and it measures 8.03:1 either way round. Do not
   "fix" this to an ink token: it is the numeral INSIDE a filled disc, so it
   has to be the disc's opposite, and --paper-2 is the token that tracks it. */
.bs-num{font:700 11px/1 var(--mono);fill:var(--paper-2)}
/* The stamp-multiple chart. Same 400/700 Space Mono the figures above already
   pull, so it adds no font file. 10px and 11px inside a 360 unit box render at
   9.2 and 10.1 real pixels at 390, which is the floor for a phone; 9px would
   land at 8.3 and stop being readable. */
.bs-cname{font:700 11px/1 var(--mono);fill:var(--ink)}
.bs-ccond{font:400 10px/1 var(--mono);fill:var(--ink-2)}
.bs-cval{font:700 10px/1 var(--mono);fill:var(--ink)}
.bs-ctick{font:400 10px/1 var(--mono);fill:var(--ink-2)}
.bs-cnote{font:400 10px/1 var(--mono);fill:var(--ink-2)}
/* THE CHART'S MARKS ARE CLASSES, THE DRAWN FIGURES' MARKS ARE LITERALS, and
   the split is not inconsistency. A fill: or stroke: declaration in a
   stylesheet honours var() perfectly well; only a presentation ATTRIBUTE does
   not, which is what the long note above cardFace is about. This chart's type
   was already in classes, so its bars, rules and knockout joined them and the
   svg now carries no colour at all. The illustrations cannot follow, because
   their marks are per-shape and most of them are drawn on the card's own plate
   rather than on a token surface.
   Measured on the .bs-fig ground, --card #2F4F39: bars, the 1x line and the
   axis 8.03:1, names and values 8.03:1, conditions and ticks 5.86:1. The
   gridlines are 1.36:1, which is what the same rule measured at 1.30:1 on the
   white card, and every one of them is labelled underneath. */
.bs-cbar{fill:var(--ink)}
.bs-cknock{fill:var(--card)}
.bs-cgrid{stroke:var(--ink);stroke-opacity:.12}
.bs-caxis{stroke:var(--ink)}

/* The magnified crops. See zoom() in build-base-set.mjs for the geometry.

   .bz .bz-win img RATHER THAN .bz-win img, AND THAT IS NOT TIDINESS. ui.css
   sets img{max-width:100%} and this page also sets .bs-card img{max-width:200px},
   both of which would squeeze the 600px scan back into the window and paint a
   whole shrunken card where the magnified detail should be. The extra class
   takes this to (0,2,1) so it beats any single-class img rule here or added
   later. That exact bug shipped on /rarity.html when its corners moved from a
   CSS background onto an img, and it looks almost right, which is why it
   survived: a card in a box, just the wrong picture, under a caption still
   promising the detail. */
.bz{border:2px solid var(--ink);border-radius:var(--r);overflow:hidden;background:var(--card);
  margin:var(--s4) 0}
.bz-win{position:relative;overflow:hidden;background:var(--card)}
.bz .bz-win img{position:absolute;max-width:none;border:0;border-radius:0;background:none;display:block}
/* max-width:none, AND IT IS FIXING A VISIBLE HOLE RATHER THAN A MEASURE.
   ui.css caps every figcaption in main at var(--measure) from 1000px up. That is
   right for a caption under a picture and wrong for this one, because this
   caption is a BAR across the bottom of a bordered window: 36em of 11px mono is
   396px, the window is 430px, so from 1000px up the caption's fill stopped 34px
   short of the frame and a white notch appeared in the bottom right corner of
   the figure. It reads as a rendering fault, not as a measure. The bar can never
   be too long to track back from anyway, since the box it is inside is capped at
   the width of the card region it magnifies. */
.bz figcaption{font:700 var(--t-micro)/1.5 var(--mono);letter-spacing:.05em;color:var(--ink-2);
  padding:8px var(--s3);border-top:1px solid var(--hair);background:var(--page);max-width:none}

.bs-card{margin:var(--s4) 0}
.bs-card img{width:100%;max-width:200px;height:auto;border-radius:6px;border:1px solid var(--hair);
  background:var(--page)}
.bs-card figcaption{font-size:var(--t-sm);color:var(--ink-2);line-height:1.5;margin-top:var(--s3)}
.bs-card figcaption b{color:var(--ink)}

/* Card and crops side by side once there is room for both. Below that they
   stack, which is right: on a phone the crop IS the figure and the whole card
   is context you scroll past. */
.bs-shots{display:grid;gap:var(--s4)}
/* THE SECOND COLUMN IS 440px AND NOT 1fr, WHICH IS THE WHOLE FIX. Both crops in
   it are capped at their own source region's width, 280px and 430px, because
   past that the browser is upscaling a scan that has no more detail in it. A 1fr
   track therefore grew to 1,130px at 1440 and held a 430px picture with 700px of
   empty page beside it, which reads as a layout that failed rather than as a
   figure that is deliberately the size of its evidence. justify-content pins the
   pair to the left of the wrap instead of centring a half empty row. */
@media(min-width:760px){.bs-shots{grid-template-columns:220px minmax(0,440px);
  justify-content:start;align-items:start;gap:var(--s5)}}

/* The three checks, as steps. Same shape as the rarity guide's, deliberately:
   it is the same reader doing the same thing, holding one card and working
   through it in a fixed order. */
.bs-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4);margin:var(--s5) 0}
@media(max-width:760px){.bs-steps{grid-template-columns:1fr}}
.bs-step{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);
  box-shadow:var(--lift)}
.bs-step b{display:block;font:400 var(--t-l)/1 var(--display);color:var(--ketchup-deep);margin-bottom:6px}
.bs-step h3{font:700 var(--t-body)/1.3 var(--body);margin-bottom:6px}
.bs-step p{color:var(--ink-2);font-size:var(--t-sm)}

/* The run cards. */
.bs-runs{list-style:none;display:grid;gap:var(--s4);
  grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.bs-run{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s4);
  box-shadow:var(--lift);display:flex;flex-direction:column}
.bs-run h3{font:400 var(--t-m)/1.15 var(--display);margin-bottom:2px}
.bs-run .bs-when{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  color:var(--ink-2);margin-bottom:var(--s3)}
.bs-run p{color:var(--ink-2);font-size:var(--t-sm);margin-bottom:var(--s2)}
.bs-marks{display:flex;flex-wrap:wrap;gap:6px;margin:var(--s3) 0 0}
/* WEIGHT, NOT HUE. The palette is one accent and two greys, so a green yes and
   a red no would be the same colour twice. Present is the dark slab with an
   accent rule; absent is the page with a hairline. The words carry it on their
   own for anybody who cannot see either.
   THE YES CHIP SAID background:var(--ink) AND HAD TO STOP. --ink is #EEF1EF
   now, so that rule painted a near-white pill and then wrote --chrome-ink
   #F7F8F7 across it: 1.06:1, a chip with nothing legible in it, and nothing
   errored because both halves resolved to real colours. --band-bg #192D22 is
   the dark slab the chip was always meant to be and --chrome-ink reads
   13.70:1 on it. The accent rule is 4.84:1 on the chip and 3.03:1 against the
   card behind it, so the pill's own edge clears the graphical gate too. */
.bs-mark{font:700 9px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  padding:5px 8px;border-radius:var(--r-pill);white-space:nowrap}
.bs-mark.yes{background:var(--band-bg);color:var(--chrome-ink);border:1px solid var(--gold)}
.bs-mark.no{background:var(--page);color:var(--ink-2);border:1px solid var(--hair)}

/* The checks. */
.bs-t{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);
  box-shadow:var(--lift);margin-bottom:var(--s4)}
.bs-t-head{display:flex;align-items:baseline;gap:var(--s3);flex-wrap:wrap;margin-bottom:var(--s2)}
.bs-t-no{font:400 var(--t-l)/1 var(--display);color:var(--ink-2)}
.bs-t-head h3{font:400 var(--t-m)/1.2 var(--display)}
.bs-conf{font:700 9px/1 var(--mono);letter-spacing:.07em;text-transform:uppercase;padding:5px 8px;
  border-radius:var(--r-pill)}
/* --band-bg, not --ink, and the whole argument is beside .bs-mark.yes above:
   an ink token used as a fill under light text is an invisible chip. 13.70:1
   now. The mid and lo chips were already surface tokens and measure 11.12:1
   and 8.12:1 on their own fills, so neither moved. */
.bs-conf.hi{background:var(--band-bg);color:var(--chrome-ink);border:1px solid var(--gold)}
.bs-conf.mid{background:var(--chip-gold-bg);color:var(--ink);border:1px solid var(--gold-deep)}
.bs-conf.lo{background:var(--page);color:var(--ink-2);border:1px solid var(--hair)}
.bs-where{font:700 var(--t-micro)/1.5 var(--mono);letter-spacing:.04em;text-transform:uppercase;
  color:var(--ink-2);margin-bottom:var(--s3)}
.bs-t p{margin-bottom:var(--s3)}
.bs-why{background:var(--page);border-left:4px solid var(--ink-2);padding:10px var(--s3);
  border-radius:0 var(--r-sm) var(--r-sm) 0;font-size:var(--t-sm)}
/* Third instance of the same fault, same fix: --ink is an ink and --band-bg
   is the panel. 13.70:1 for the body copy, 4.84:1 for the bolded lead-in. */
.bs-caveat{background:var(--band-bg);color:var(--chrome-ink);border-left:4px solid var(--gold);
  padding:10px var(--s3);border-radius:0 var(--r-sm) var(--r-sm) 0;font-size:var(--t-sm)}
.bs-caveat b{color:var(--gold)}
.bs-src{font:700 var(--t-micro)/1.5 var(--mono);color:var(--ink-2);margin:0}

/* The copyright line, as TEXT rather than as a picture, which is the whole
   point of it. It is a string, so a reader can select it, a screen reader can
   read it and it costs no bytes; a screenshot of a string is a worse version of
   a string. The magnified crop underneath is the proof that it really says
   this. .bs-mk is the differing run of characters. */
.bs-cr{list-style:none;display:flex;flex-direction:column;gap:var(--s3);margin:var(--s4) 0}
.bs-cr li{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s4)}
.bs-cr .who{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);margin-bottom:6px}
.bs-cr code{font:400 var(--t-sm)/1.7 var(--mono);color:var(--ink);word-break:break-word;
  display:block}
.bs-mk{background:var(--mustard);color:var(--on-accent);padding:1px 4px;border-radius:3px;font-weight:700}
.bs-gone{color:var(--ink-2);text-decoration:line-through}

/* Prices. */
.bs-prices{list-style:none;margin:var(--s4) 0 0;padding:0;border-top:1px solid var(--hair)}
.bs-p{display:grid;grid-template-columns:64px 1fr;gap:var(--s3);align-items:start;
  padding:14px 0;border-bottom:1px solid var(--hair)}
.bs-p-art{width:64px;height:90px;display:flex;align-items:center;justify-content:center;
  background:var(--paper-3);border:1px solid var(--hair);border-radius:3px;overflow:hidden}
/* NO width/height attribute on these and no AVIF source either. PriceCharting
   serves a fixed 240 HIGH and a variable width, so a declared width is wrong for
   most of them, and there is no AVIF at that host, so a source pointing at one
   would be worse than none. imgDims() and avifPicture() both correctly decline
   for this host, which is why neither is called on the way in. */
.bs-p-scan{max-width:100%;max-height:100%;width:auto;height:auto;display:block}
.bs-p-noscan{font:400 10px/1.3 var(--mono);color:var(--ink-2);text-align:center;padding:4px}
.bs-p-body{min-width:0}
.bs-p-name{display:block;font-weight:700;line-height:1.25}
.bs-p-when{display:block;color:var(--ink-2);font-size:var(--t-sm);margin-top:1px}
.bs-p-nums{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px;align-items:baseline}
.bs-p-n{color:var(--ink-2);font-size:var(--t-sm);font-variant-numeric:tabular-nums}
.bs-p-n b{color:var(--ink);font-size:19px}
.bs-u{font:400 10px/1 var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--ink-2)}
.bs-p-none{display:block;margin-top:8px;font:700 var(--t-micro)/1.5 var(--mono);color:var(--ink-2)}
@media(min-width:560px){
  .bs-p{grid-template-columns:84px 1fr;gap:var(--s4)}
  .bs-p-art{width:84px;height:118px}
  .bs-p-name{font-size:18px}
}

/* The 1st Edition against Shadowless comparison.

   A LIST OF CARDS, NOT A <table>, and it is the same call .bs-prices and
   /top-graded.html's .tg-list both made. The natural table here is card by
   printing by tier, which is six figures on a row: at 390px the widest figure
   this table prints is "$343,098", eight characters, and six of those plus their
   labels do not go into 366px of usable width at any font size worth reading.
   MEASURED IN REAL CHARACTERS rather than in ch, per the note in
   build-top-graded.mjs: a ch is the advance of a "0" and measures nothing here.

   So the CARD is the row and the two tiers are cells inside it. On a phone the
   cells stack and each one is four short lines, none over about 22 characters.
   From 560 the two tiers sit side by side, and from 900 the card name takes its
   own column so the eye can run down three cards and compare the same tier.

   THE MULTIPLE IS THE LAST LINE OF ITS OWN CELL rather than a column of its own,
   because it is derived from the two figures directly above it and belongs with
   them. Given a column it would read as a third independent measurement. */
.bs-cmp{list-style:none;margin:var(--s4) 0 0;padding:0;border-top:1px solid var(--hair)}
.bs-cmp-row{display:grid;gap:var(--s3);padding:14px 0;border-bottom:1px solid var(--hair)}
.bs-cmp-card{font-weight:700;line-height:1.25;font-size:18px}
.bs-cmp-cell{display:flex;flex-direction:column;gap:3px;min-width:0}
.bs-cmp-lbl{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2)}
.bs-cmp-n{color:var(--ink-2);font-size:var(--t-sm);font-variant-numeric:tabular-nums}
.bs-cmp-n b{color:var(--ink);font-size:19px}
/* The printing name needs its own air. A single markup space between a 19px
   figure and a 10px mono label is about 4px and reads as one token: at 390 the
   worst pair is "$343,098 1ST EDITION" and the label looked stuck to the
   comma. Checked in the rendered page, not in the markup, where it looked fine. */
.bs-cmp-n .bs-u{margin-left:5px}
/* The gold rule is the only mark that separates the derived number from the two
   read ones. WEIGHT AND POSITION, NOT HUE, exactly like .bs-mark above: the
   palette is one accent and two greys, so a coloured multiple would be the same
   colour as something else on the page and would carry nothing on its own. The
   label under it says what it is in words either way. */
.bs-cmp-x{font-weight:700;font-size:var(--t-sm);font-variant-numeric:tabular-nums;
  border-left:3px solid var(--gold-deep);padding-left:8px;margin-top:4px;
  display:flex;align-items:baseline;gap:6px}
@media(min-width:560px){
  .bs-cmp-row{grid-template-columns:1fr 1fr;column-gap:var(--s4)}
  .bs-cmp-card{grid-column:1/-1}
}
@media(min-width:900px){
  .bs-cmp{max-width:820px}
  .bs-cmp-row{grid-template-columns:1fr minmax(150px,auto) minmax(150px,auto);align-items:center}
  .bs-cmp-card{grid-column:auto}
}

/* Traps and the honesty block. */
.bs-traps{list-style:none;display:grid;gap:var(--s4);
  grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.bs-trap{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s4);
  box-shadow:var(--lift)}
.bs-trap h3{font:400 var(--t-m)/1.2 var(--display);margin-bottom:6px}
.bs-trap p{color:var(--ink-2);font-size:var(--t-sm)}
.bs-out{list-style:none;display:flex;flex-direction:column;gap:var(--s3);margin-top:var(--s4)}
.bs-out li{border-left:3px solid var(--gold-deep);padding-left:var(--s3);color:var(--ink-2);
  font-size:var(--t-sm)}

/* MEASURED AT 11 PIXELS OF SPACE MONO RATHER THAN GUESSED IN em. 56em looked
   like the rarity guide's .rg-foot and is not the same number in this box: at
   616px it came out at 92 real characters a line at 1440, past the 90 nobody
   should be asked to track back from. 50em is 550px and lands at about 82, which
   is where .rg-foot sits. It stays out of the shared var(--measure) below for
   the reason that file gives: mono buys roughly 1.7 characters an em against
   Outfit's 2.3, so joining the shared cap would take this to about 55 and make
   it worse. */
.bs-foot{font:700 var(--t-micro)/1.7 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--hair);padding-left:var(--s3);margin:var(--s6) 0;max-width:50em}

/* DESKTOP READING MEASURE. The em caps above are not character counts: Outfit
   runs about 2.31 characters to the em on this site, so 46em buys .bs-p2 about
   106 real characters a line at 1440. ui.css already caps main prose at
   var(--measure) and these rules only outrank it by landing after the
   stylesheet. All min-width:1000, which is ui.css's own desktop breakpoint, so
   the phone and the tablet range keep exactly the rules they had. .bs-foot is
   deliberately not in here: it is Space Mono, which runs about 1.77 characters
   to the em, so its 56em box measures in the eighties rather than over ninety
   and capping it would make it worse. Same exemption, same reason, as .rg-foot
   on the rarity guide. */
@media(min-width:1000px){
.bs-lede,.bs-p2,.bs-out li{max-width:var(--measure)}
}

/* ==========================================================================
   AND THREE BLOCKS THEN HELD A MEASURE-WIDE COLUMN INSIDE A BAND-WIDE BOX,
   fixed 21 August 2026. The rule above decides how wide a LINE is. It does not
   decide where the line sits, and on this page that left five bordered cards
   and two lists painting under half of their own boxes. Measured at 1440x900,
   box against the rightmost PAINTED pixel inside it, which is the test that
   matters because a box spanning the band and inking a third of it is the same
   defect one level down:

       article.bs-t   x5   box 24..1416   ink to 627..661   slack 755-789
       ul.facts-list       box 24..1416   ink to 552        slack 864
       ul.bs-out           box 24..1416   ink to 526        slack 890

   THE PAGE AROUND THEM IS NOT LIKE THAT and was measured before anything moved,
   which is why this is three rules and not a page-wide centring: div.bs-steps
   inks to 1,389 of 1,416, ul.bs-traps to 1,394, div.facts to 1,364 and
   ul.ms-list to 1,397. Those bands are full. So is every bs-fig, which is a
   620px drawing in a 620px box. This page is composed nearly everywhere and
   these blocks are the exception, so they get the treatment and nothing else
   does. CLAUDE.md's home page precedent is the model: the answer to an empty
   half is layout, never a mark parked in the margin.

   .bs-t GETS THE COMPANION RATHER THAN A CENTRE, because it already had one and
   was stacking it. Each card is a place to look, a description of the mark, a
   WHY IT WORKS note and a BUT note. The two notes are commentary ON the
   description, they are the same length as it, and they were sitting under it
   in the same 612px column with 780px of card to the right of them. Beside it
   is where they belong and they carry real content, which is the test.
   The tracks are two measures, so neither column can run long, and
   space-between opens the 1,342px of card interior to hold both: 612 + 118 +
   612. .bs-src spans the foot because a source line under one column would read
   as sourcing that column alone.
   THE ROW MATH IS THE AUTO PLACEMENT and it is worth knowing before editing
   the markup: head spans, .bs-where takes row 2 left, the description row 3
   left, .bs-why lands row 3 right beside it, .bs-caveat row 4 right, and the
   source spans row 5. One of the five cards has no .bs-caveat and simply ends a
   row earlier. If a card ever gains a second description paragraph it will push
   the notes down with it, which is correct, but look at it.

   THE TWO LISTS TAKE TWO COLUMNS AT 1200, which is not a new idea on this site:
   build-set-pages.mjs, build-complete.mjs and build-pack-prices.mjs all do
   exactly this to .facts-list at exactly this breakpoint, with the same
   max-width:none on the item, and their own note says the measure then lands
   near 86 characters, which is accepted. .bs-out is the same shape, a short
   list of long sentences, so it takes the same rule and drops its 612px cap
   with it. Both are near the foot of a 14,589px page where nothing else is
   competing for the width.
   ========================================================================== */
@media(min-width:1000px){
  .bs-t{display:grid;grid-template-columns:repeat(2,minmax(0,var(--measure)));
    column-gap:var(--s6);justify-content:space-between;align-items:start}
  .bs-t > .bs-t-head{grid-column:1/-1}
  .bs-t > :is(.bs-where,p:not([class])){grid-column:1}
  .bs-t > :is(.bs-why,.bs-caveat){grid-column:2}
  .bs-t > .bs-src{grid-column:1/-1}
}
@media(min-width:1200px){
  .facts-list,.bs-out{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
    gap:11px var(--s6);align-items:start}
  .facts-list li,.bs-out li{max-width:none}
}

/* ==========================================================================
   AND THE READING COLUMN ITSELF SAT ON THE LEFT EDGE OF EVERY BAND, which is
   the last of it and the part the block-by-block measurement above nearly
   hid. Comparing a box to the ink inside it finds a wide box painting a third
   of itself; it says nothing at all about a NARROW box parked at x=24 with 770
   empty pixels beside it, and on this page that was most of the reading matter:
   19 .bs-p2 paragraphs ending at 636, four bs-fig drawings at 644, three
   .bs-foot notes at 574 and the section labels at 456, every one of them
   against the left rail of a 1,392px wrap. Both shapes read the same to a
   reader and both are the same defect. Measured at 1440x900, 21 August 2026.

   THIS IS THE /how-to-play.html TREATMENT AND NOT THE /tcg-pocket.html ONE, and
   the difference is that this page has bands that genuinely fill their width.
   Measured, ink right edge against a wrap ending at 1,416: div.bs-steps 1,389,
   ul.bs-traps 1,394, div.facts 1,364, and after the rule above ul.facts-list
   1,396, ul.bs-out 1,415 and the five article.bs-t cards 1,245 to 1,271.
   Capping the whole wrap to a measure would have shrunk all of those. So the
   wrap keeps a band, those keep it, and only the reading column moves.

   ONE SHARED LEFT EDGE, WHICH IS WHY THIS IS A margin AND NOT
   margin-inline:auto ON EACH BLOCK. The column holds 17px body copy, an 11px
   mono section label, a Space Mono footnote at its own 50em and two price grids
   at 820, so a per-element auto centre gives each of them a different left edge
   and the column reads as ragged. One indent computed from the band puts them
   all on 366px.
   660 IS THE COLUMN AND IT IS THE DRAWINGS THAT SET IT: .bs-fig-wide is 620px
   and .bs-p2 is var(--measure) at 612, so 660 holds the widest of them with the
   figure's own border. .bs-prices and .bs-cmp are 844 and deliberately so, and
   they overhang to the RIGHT, which costs nothing: an overhang on the closed
   side of a column is invisible, an overhang on the left edge is the ragged
   rail this rule exists to remove.

   .fk-golden IS CAPPED AS WELL AS INDENTED, and it is the only box here that
   is. It is a slab of prose, one heading and one paragraph, and it was 1,392px
   wide with ink stopping at 545. Nothing goes beside it: the drawing under it
   is the three print runs side by side, which is a wide object in its own
   right and is the next thing the reader looks at. So it becomes a callout the
   width of the column it opens rather than a band it cannot fill.

   THE HERO IS UNTOUCHED BY THE INDENT ON PURPOSE. .set-hero .wrap is a centred
   flex column in ui.css, so its kicker, h1 and lede are already centred on the
   band and an indent would push them off it. It takes the band cap and nothing
   else.
   ========================================================================== */
@media(min-width:1000px){
  .bs-page .wrap{max-width:calc(1152px + var(--gut) * 2)}
  /* .faq-list IS IN THIS LIST BECAUSE h2 ALREADY WAS, and half a block in the
     column is worse than none of it. The FAQ section added 21 August 2026 opens
     with an h2 inside its own .wrap, so the bare h2 selector above already
     caught the heading and indented it while the questions and answers under it
     stayed on the band at 144. That is precisely the ragged left edge the long
     note above this rule exists to remove, reintroduced by a new block rather
     than by an old one. Measured at 1440: 390 against 144 before, both 390
     after. */
  .bs-page .wrap > :is(.crumbs,.sec-label,h2,.bs-p2,.bs-foot,.bs-fig,
    .bs-prices,.bs-cmp,.bs-cr,.bs-shots,.fk-golden,.faq-list){
    margin-left:calc((100% - 660px) / 2)}
  .bs-page .wrap > .fk-golden{max-width:660px}
}

/* THE TWO LISTS THAT ARE NOT PROSE AND STILL HAD TO BE CAPPED, and neither is
   covered by the rule above because neither is a paragraph.

   .bs-cr is three copyright strings that differ by a few characters, and the
   whole job of the block is that a reader can hold them against each other. At
   1392px each one sat on a single line 1,358px long with the differing run of
   characters somewhere out in the middle of it, so the comparison the block
   exists for was three eye journeys instead of three glances. 640px stacks them
   near enough to see at once.

   .bs-prices is a grid rather than a paragraph, so it has no measure to speak
   of, but at 1392px the three figures sat in the left third of the page with
   900px of nothing beside them. The desktop rule below moves them into their own
   right-aligned column instead, which is what /top-graded.html does with the
   same data and what lets an eye run down the money without the printing names
   in the way. Grid AREAS rather than reordered markup, so the DOM order stays
   name, run, prices, which is the right reading order on a phone and for a
   screen reader at every width. */
@media(min-width:900px){
  .bs-cr li{max-width:640px}
  .bs-prices{max-width:820px}
  .bs-p{grid-template-columns:100px 1fr;align-items:center}
  .bs-p-art{width:100px;height:140px}
  .bs-p-body{display:grid;column-gap:24px;grid-template-columns:1fr minmax(230px,auto);
    grid-template-areas:"name prices" "when prices"}
  .bs-p-name{grid-area:name}
  .bs-p-when{grid-area:when}
  .bs-p-none{grid-area:prices}
  .bs-p-nums{grid-area:prices;margin-top:0;align-self:center;flex-direction:column;
    align-items:flex-end;gap:2px;text-align:right}
}
${FAQ_CSS}
`;

/* ----------------------------------------------------------------- page -- */

const runCard = (r) => `<li class="bs-run">
      <h3>${esc(r.name)}</h3>
      <p class="bs-when">${esc(r.order)} &bull; ${esc(r.when)}</p>
      <p>${esc(r.look)}</p>
      <p>${esc(r.note)}</p>
      <div class="bs-marks">
        <span class="bs-mark ${r.stamp ? "yes" : "no"}">${r.stamp ? "Has the stamp" : "No stamp"}</span>
        <span class="bs-mark ${r.shadow ? "yes" : "no"}">${r.shadow ? "Has the shadow" : "No shadow"}</span>
      </div>
    </li>`;

// NO " | Garbage Rips 585" IN <title>, for the reason CLAUDE.md records under
// "Page titles carry no suffix". Measured in headless Chrome, canvas
// measureText at 20px Arial, which is what Google's desktop result draws:
// with the suffix 702.2px against the ~580px cut, without it 523.6px.
// The suffix is 178.6px and it was never being drawn, so it cost the tail of
// the title it sat behind and returned nothing. og:site_name carries the brand
// beside the result, and og:title below has always been the bare title, so
// dropping it also stops <title> and og:title disagreeing.
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>1st Edition, Shadowless or Unlimited? Base Set, Told Apart</title>
<meta name="description" content="${esc(clipMeta(desc))}">
<link rel="canonical" href="${SITE}/base-set.html">
<meta property="og:title" content="1st Edition, Shadowless or Unlimited?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/base-set.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
<style>${style}</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SKIP}
${SPRITE}
${BAR}
${MENU}
<main id="main" tabindex="-1" class="bs-page">

<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Base Set, ${esc(year(baseSet.released) || "1999")}</span>
    <h1>1st Edition, Shadowless or <span class="hl">Unlimited</span>?</h1>
    ${/* 34em RATHER THAN ui.css's 38, AND IT IS A CHARACTER COUNT RATHER THAN A
          preference. Outfit at this size runs about 2.3 characters an em, so
          38em measured 87 real characters a line at 1440 in a centred hero,
          which is where a long line is hardest to track back from. 34em lands at
          about 78. */ ""}
    <p class="lede" style="max-width:34em">${esc(d.intro)}</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / Base Set prints</nav>

    <div class="fk-golden">
      <p class="fk-golden-h">Start here</p>
      <h2>${esc(d.goldenRule.title)}</h2>
      <p>${esc(d.goldenRule.body)}</p>
    </div>

    ${runsDiagram()}

    <div class="bs-steps">
      <div class="bs-step"><b>1</b><h3>Is there a stamp?</h3><p>A black circle with a 1 in it, under the left
        edge of the artwork. Yes means 1st Edition and you can stop.</p></div>
      <div class="bs-step"><b>2</b><h3>Is there a shadow?</h3><p>A gray band down the outside of the artwork
        window's right edge. Yes means Unlimited.</p></div>
      <div class="bs-step"><b>3</b><h3>Neither?</h3><p>No stamp and no shadow is a Shadowless. It is the one
        with nothing printed on it to say so, which is exactly why people miss it.</p></div>
    </div>
  </div>
</section>

<section class="band bs-sec">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The four runs</p>
    <h2>Four printings, <span class="hl">two marks</span></h2>
    <p class="bs-p2">English Base Set came out on ${esc(longDate(baseSet.released) || "January 9, 1999")} with
      ${esc(String(baseSet.printedTotal || 102))} cards in it, and it was printed more than once. These are the
      runs, oldest first, and the market prices them in that order.</p>
    <ul class="bs-runs">
${d.runs.map(runCard).join("\n")}
    </ul>
  </div>
</section>

<section class="bs-sec">
  <div class="wrap">
    <h2>The shadow, <span class="hl">up close</span></h2>
    <p class="bs-p2">This is the difference between a card worth a few hundred dollars and the same card worth a
      few thousand, and it is a band of gray ink about two millimeters wide. It is the tell most people holding a
      1999 card have never heard of, because nothing on the card names it.</p>
    ${shadowDiagram()}
    <p class="bs-p2">It is drawn rather than photographed on purpose. We can reach a good scan of a 1st Edition
      card and we cannot reach one of an Unlimited: the only Unlimited and Shadowless pictures available here are
      product photographs 325 pixels wide, shot at slightly different crops. Two millimeters read off two
      photographs that do not line up is a suggestion, not evidence, so the geometry is drawn and the caption says
      what has been exaggerated.</p>
  </div>
</section>

<section class="band bs-sec">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>On a real card</p>
    <h2>The stamp, on an <span class="hl">actual scan</span></h2>
    ${/* THE 16 IS A HAND COUNT AND IT IS DELIBERATELY A LITERAL. Base Set's
          Holofoil rares are cards 1 to 16 and every one of TCGdex's scans of them
          was opened and looked at on the date below; there is no file in this repo
          that holds the answer, so there is nothing to read it from and pretending
          otherwise would be worse. If TCGdex rescans the set, this sentence is
          wrong and only somebody repeating the check will know. */ ""}
    <p class="bs-p2">Not a drawing. This is TCGdex's scan of Base Set Charizard, and it happens to be a 1st
      Edition copy: all 16 Base Set Holofoil scans TCGdex serves carry the stamp, checked one by one on
      ${esc(longDate(d.checked))}. Hold your own card next to it.</p>
    <div class="bs-shots">
      ${wholeCard()}
      <div>
        ${zoom({
          x: 6,
          y: 296,
          w: 280,
          h: 250,
          cap: 280,
          alt: "The bottom left of the artwork on a 1st Edition Base Set Charizard, magnified, showing a small black circular stamp reading EDITION 1",
          caption:
            "The stamp, magnified. A black circle, a 1, and EDITION curved over the top",
        })}
        ${zoom({
          x: 170,
          y: 776,
          w: 430,
          h: 46,
          cap: 430,
          alt: "The bottom edge of a 1st Edition Base Set Charizard, magnified, reading 1995, 96, 98, 99 Nintendo, Creatures, GAMEFREAK, copyright 1999 Wizards, then 4 slash 102 and a star",
          caption:
            "The bottom edge. Four years, then 1999 Wizards, then 4/102 and a star with no set symbol between them",
        })}
      </div>
    </div>
  </div>
</section>

<section class="bs-sec">
  <div class="wrap">
    <h2>Where each check <span class="hl">happens</span></h2>
    ${cardMapDiagram(d.tells.length)}
${d.tells.map(tellCard).join("\n")}
  </div>
</section>

<section class="band bs-sec">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The small print</p>
    <h2>The copyright line, <span class="hl">character by character</span></h2>
    <p class="bs-p2">It runs along the very bottom of the card, to the right of the illustrator credit. Two
      halves, and each half answers a different question. This is the only check that works on Trainer and Energy
      cards, which have no artwork window and therefore no shadow either way.</p>
    <ul class="bs-cr">
      <li>
        <p class="who">1st Edition and Shadowless</p>
        <code>&copy; 1995, 96, 98<span class="bs-mk">, 99</span> Nintendo, Creatures, GAMEFREAK.
          &copy; <span class="bs-mk">1999</span> Wizards.</code>
      </li>
      <li>
        <p class="who">Unlimited</p>
        <code>&copy; 1995, 96, 98<span class="bs-gone">, 99</span> Nintendo, Creatures, GAMEFREAK.
          &copy; <span class="bs-mk">1999</span> Wizards.</code>
      </li>
      <li>
        <p class="who">The 1999-2000 reprint, the 4th print</p>
        <code>&copy; 1995, 96, 98<span class="bs-gone">, 99</span> Nintendo, Creatures, GAMEFREAK.
          &copy; <span class="bs-mk">1999-2000</span> Wizards.</code>
      </li>
    </ul>
    <p class="bs-p2">The second half is ours: we read <b>1999-2000 Wizards</b> off a photograph of that printing
      and <b>1999 Wizards</b> off the scan magnified above, on ${esc(longDate(d.checked))}. The first half, the
      missing <b>, 99</b> on Unlimited, is Bulbapedia's, because the plain Unlimited scan we can reach is too soft
      to read it. It is marked here rather than smoothed over.</p>
  </div>
</section>

<section class="bs-sec">
  <div class="wrap">
    <h2>${esc(d.why.title)}</h2>
    ${d.why.body.map((p) => `<p class="bs-p2">${esc(p)}</p>`).join("\n    ")}
    <p class="bs-foot">PRINT RUN ORDER, THE LAYOUT CHANGE AND THE FACT THAT SHADOWLESS WAS ENGLISH ONLY:
      BULBAPEDIA'S 1ST EDITION (TCG) ARTICLE, READ ${esc(longDate(d.checked).toUpperCase())}. NAMED IN PLAIN TEXT
      RATHER THAN LINKED, WHICH IS HOW THIS SITE CREDITS AN OUTSIDE SOURCE.</p>
  </div>
</section>

<section class="band bs-sec">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The money</p>
    <h2>${esc(d.worth.title)}</h2>
    <p class="bs-p2">${esc(d.worth.lede)}</p>
    <ul class="bs-prices">
${d.runs.map(priceCard).join("\n")}
    </ul>
    <p class="bs-p2" style="margin-top:var(--s4)">Every figure above is PriceCharting's price guide for
      <b>Charizard 4/102</b>, one line per printing, read on ${esc(read)} and read a second time from each card's
      own product page before it was published here. It is a guide value computed from completed sales, not a
      record of any single sale. Prices move and this page does not.</p>
    ${/* THE OTHER MEASUREMENT, NAMED HERE RATHER THAN LEFT TO BE DISCOVERED.
          A marketplace prices the same ungraded Shadowless Charizard at ten
          times the figure printed above. Both numbers are real and they measure
          different things, and a reader who checks ours against the shop they
          are about to buy from, without being told that, concludes this page is
          simply wrong.
          THIS USED TO SAY "another page on this site" AND POINT AT
          /most-valuable-cards.html, which ranked by TCGplayer market price until
          18 August 2026. That page now reads the same price guide as this one,
          so there is no longer a page here to send anybody to and the sentence
          would have been false. The wording still comes out of
          shared/price-basis.mjs, which is where the figures are resolved. */ ""}
    <p class="bs-p2 bs-basis"><b>Why a marketplace says ${esc(
      `$${basis.both[0] ? basis.both[0].market.toLocaleString("en-US") : ""}`
    )} for this card.</b>
      ${esc(BASIS_TEXT)} Every raw price on this site is the guide value, including
      <a href="/most-valuable-cards.html">the 100 most valuable raw cards</a>, so the two never disagree
      from one of our pages to the next.</p>
    ${
      first && unl
        ? `<div class="facts" style="margin-top:20px">
      <div class="fact"><div class="n">${esc(mult(first.ungraded, unl.ungraded) || "")}</div><div class="l">1st Edition over Unlimited, ungraded</div></div>
      <div class="fact"><div class="n">${esc(mult(shad?.ungraded, unl.ungraded) || "")}</div><div class="l">Shadowless over Unlimited, ungraded</div></div>
      <div class="fact"><div class="n">${esc(mult(first.psa10, unl.psa10) || "")}</div><div class="l">1st Edition over Unlimited, PSA 10</div></div>
      <div class="fact"><div class="n">${esc(mult(shad?.psa10, unl.psa10) || "")}</div><div class="l">Shadowless over Unlimited, PSA 10</div></div>
    </div>`
        : ""
    }
    <p class="bs-p2" style="margin-top:20px">${esc(d.worth.note)} Look at those four numbers together rather than
      at the biggest one: the print run shows up hard in the ungraded column and almost vanishes in PSA 10, where
      a handful of sales is doing all the work.</p>
    ${
      sealedPack
        ? `<p class="bs-p2">And the packs themselves are their own market. TCGplayer's market price for a single
      sealed <b>Base Set (Shadowless) 1st Edition booster pack</b> was ${moneyCompact(sealedPack.market)} when the
      sealed list was read on ${esc(shortDate(t100.sealed?.checked || t100.checked))}, which made it the second
      most expensive sealed Pokemon product on that whole list. Note what TCGplayer calls it: the 1st Edition packs are
      filed under a set named Base Set (Shadowless), because 1st Edition cards ARE shadowless. The stamp is the
      extra thing, not a different card.</p>`
        : ""
    }
  </div>
</section>

${/* IMMEDIATELY AFTER THE MONEY SECTION AND BEFORE THE TRAPS, because it is the
      same argument continued: the table above prices four printings of ONE card,
      and the reader's fair objection at that point is that one card proves
      nothing. This answers it while the objection is still fresh.

      IT IS A SECOND `band` RUNNING STRAIGHT INTO THE FIRST ONE, which is the one
      place on this page where two tinted sections touch, and it is deliberate.
      ui.css gives section.band a 3px rule top AND bottom, so the join paints a
      6px rule rather than merging: the boundary is if anything louder than the
      alternating one. The pair shares a tint because it is one topic, the money,
      and the alternation picks up correctly again at the traps section below.
      The alternative, an untinted section here, puts two untinted sections
      against each other instead and those really do merge, since there is no
      rule between them at all. */ ""}
${stampTable()}

<section class="bs-sec">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Do not get caught</p>
    <h2>Four ways this <span class="hl">goes wrong</span></h2>
    <ul class="bs-traps">
${d.traps
  .map(
    (t) => `      <li class="bs-trap"><h3>${esc(t.name)}</h3><p>${esc(t.body)}</p></li>`,
  )
  .join("\n")}
    </ul>
    <p class="bs-p2" style="margin-top:var(--s5)">Base Set 2 came out on
      ${esc(longDate(baseSet2.released) || "24 February 2000")} with ${esc(String(baseSet2.printedTotal || 130))}
      cards, against Base Set's ${esc(String(baseSet.printedTotal || 102))}. Both counts are from
      <a href="/expansions.html">the full expansion list</a>, which is where to check any set on this page.</p>
    <p class="bs-p2">If the question is whether the card is real at all rather than which run it is, that is a
      different page and a longer one: <a href="/fake-cards.html">the real or fake checks</a> cover the black core
      at the edge, the print pattern under a loupe and the back color. If it is real and you want to know what it
      is worth in the hand, condition decides most of it, so start with
      <a href="/will-it-grade.html">will it grade</a> and then
      <a href="/grading.html">what grading costs</a>. For the symbol in the corner of anything newer than this,
      the <a href="/rarity.html">rarity guide</a> shows every one of them magnified on a real card, and
      <a href="/what-set.html">the set finder</a> reads the number after the slash.</p>
  </div>
</section>

${FAQ.html}

<section class="band bs-sec">
  <div class="wrap">
    <h2>Where all of this <span class="hl">came from</span></h2>
    <ul class="facts-list">
${d.sources.map((s) => `      <li>${esc(s)}</li>`).join("\n")}
    </ul>

    <h2 style="margin-top:var(--s6)">What we could not check, <span class="hl">and left in the open</span></h2>
    <p class="bs-p2">A guide that quietly drops what it could not confirm teaches you nothing about how much to
      trust the rest of it. So here is the list.</p>
    <ul class="bs-out">
${d.unverified.map((s) => `      <li>${esc(s)}</li>`).join("\n")}
    </ul>

    <p class="bs-foot">NO PULL RATES, NO ODDS AND NO PRINT RUN SIZES ANYWHERE ON THIS PAGE. NOBODY HAS EVER
      PUBLISHED HOW MANY 1ST EDITION BASE SET CARDS WERE MADE, SO EVERY FIGURE IN CIRCULATION IS SOMEBODY'S
      ESTIMATE. THIS PAGE DESCRIBES THE ORDER OF SCARCITY, WHICH THE MARKET PRICES, AND STATES NO QUANTITY AT
      ALL. FAN MADE GUIDE, NOT AN AUTHENTICATION OR VALUATION SERVICE. IF A CARD IS WORTH ENOUGH FOR THE ANSWER TO
      MATTER, SEND IT TO A GRADING COMPANY AND LET THEM PUT THEIR NAME ON IT. LAST REVIEWED
      ${esc(longDate(d.checked).toUpperCase())}.</p>
  </div>
</section>

</main>
${footer("Print run checks are properties of the printed card. Not an authentication service.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/base-set.html"), html);

console.log(`Wrote public/base-set.html
  ${d.runs.length} print runs, ${priced.length} with a double-read price
  ${stampPairs.length} of ${(d.stampPairs?.cards || []).length} stamp pairs double-read on BOTH printings${
    stampPairs.length < MIN_PAIRS ? `, under the floor of ${MIN_PAIRS}, so that table is NOT on the page` : ""
  }
  ${d.tells.length} checks, 3 drawn diagrams, 2 magnified crops of one real scan
  ${d.unverified.length} claims listed as unverified
  prices from data/top-graded.json, crawled ${tg.checked}, verified ${tg.verify.ran}`);
if (missingPrice.length) {
  console.log(`\n${missingPrice.length} price row(s) left off, on purpose or otherwise:`);
  for (const m of missingPrice) console.log("  " + m);
}
