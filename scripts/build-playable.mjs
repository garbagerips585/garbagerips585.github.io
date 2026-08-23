#!/usr/bin/env node
// Build /top-100-playable.html: the 100 cards played most in the current
// Standard format.
//
//   node scripts/build-playable.mjs
//
// Reads data/decks.json through shared/decks.mjs, the same corpus and the same
// resolver /decks.html uses, so the two pages cannot disagree about what a card
// is or which format this is.
//
// THIS IS THE PLAYABILITY LIST AND IT IS NOT A VALUE LIST. A separate page
// ranks cards by what they are worth. This one ranks them by how often people
// actually put them in a deck, and the two answers are almost unrelated: the
// card at the top of this page is a two dollar Supporter and the expensive
// chase cards mostly are not on it at all. Do not merge them and do not add a
// price column here, because a price column is how a page about playing quietly
// turns into a page about money.
//
// THE METRIC IS DECK INCLUSION, STATED ON THE PAGE IN THOSE WORDS: the number
// of collected decklists that play at least one copy. Total copies is the tie
// break and is shown beside it, never instead of it. "Best card" is not a claim
// this site can source and is not made anywhere here.
//
// THE CORPUS HAS A KNOWN BIAS AND THE PAGE DISCLOSES IT. sync-decks.mjs takes
// every top-finishing list Limitless publishes for EACH of the 18 most played
// archetypes, which is up to 20 apiece, so every deck contributes about the
// same number of lists whatever its share of the field. That deliberately stops
// one popular deck's pet card outranking a genuine staple, and it equally means
// this is NOT a measure of how often you will meet a card across the whole
// metagame. Both halves of that are said out loud on the page rather than left
// for a reader to work out.
//
// THE BOTTOM OF THE LIST IS A PLATEAU AND THE PAGE SAYS SO. Because each
// archetype contributes at most 20 lists, a card that is a 4-of staple in
// exactly one deck lands on almost exactly 20, and cards pile up there. The cut
// at 100 is therefore arbitrary among whichever cards share the boundary value,
// so the page counts them and prints the number rather than pretending rank 100
// beat rank 101 at something. THIS IS WHY LISTS_PER IS 20 AND NOT 12: at 12 the
// pile-up landed 53 cards on the boundary, at 20 it is a handful, and the
// effect shrinks but never disappears because the cap is what causes it. A
// ranking that hides its own ties is the sort of number CLAUDE.md means when it
// says never publish one that cannot be traced.
//
// LEGALITY IS BY CONSTRUCTION. Every card here was played in a list drawn
// through Limitless's Standard / 2026 rotation filter, so this builder never
// adjudicates legality. The rotation is an official Pokemon fact and is printed
// with its dates and the date we read it.
//
// NO PULL RATES, NO DROP RATES, NO ODDS. See CLAUDE.md.
//
// NO OUTBOUND LINKS. Sources are named in plain text at the foot.
//
// NO BACKTICKS IN COMMENTS IN THIS FILE. The page is one template literal.

import { writeFile } from "node:fs/promises";
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
import { esc, longDate, imgDims, avifPicture, clipMeta} from "../shared/format.mjs";
import { loadDecks, checkSetMap, rankCards } from "../shared/decks.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { d, resolve, byKey } = await loadDecks();
const map = checkSetMap(d, byKey);
const { ranked, lists } = rankCards(d, resolve);

const fmt = d.format;
const src = d.source;
const corpus = d.corpus;

const TOP = 100;
if (ranked.length < TOP) {
  throw new Error(
    `only ${ranked.length} distinct cards in the corpus, cannot publish a top ${TOP}`
  );
}
const top = ranked.slice(0, TOP);

// The tie plateau at the cut. Printed on the page rather than smoothed over.
const cutValue = top[TOP - 1].lists;
const tied = ranked.filter((r) => r.lists === cutValue).length;
const tiedIn = top.filter((r) => r.lists === cutValue).length;
// THE PARAGRAPH BELOW USED TO ASSERT AN IMPOSSIBLE NUMBER AND THEN REASON FROM
// IT. It said "each deck contributes at most 20 lists, so a card that is a
// staple of exactly one deck lands on 21", over a corpus of 18 archetypes: a
// card cannot be in 21 decks when 21 decks do not exist. The unit was lists,
// not decks, because `rankCards` incremented a field called `decks` once per
// decklist. Both are renamed now.
//
// Two more things that sentence got wrong and are worth not repeating. The 7
// cards on the cut value appear in 2 to 5 archetypes each, not one, and the
// page prints those archetype counts on the rows directly above. And it
// disclosed a cut between equals that never happened: `tied` equalled `tiedIn`,
// so nothing was excluded, while the real bunch below the line went unmentioned.
//
// So the copy states only what is computed here, and the branches below mean it
// cannot claim a cut that did not occur.
const plateau = (() => {
  const below = ranked.slice(TOP);
  if (!below.length) return { n: 0 };
  const counts = new Map();
  for (const r of below) counts.set(r.lists, (counts.get(r.lists) || 0) + 1);
  let at = null;
  for (const [v, n] of counts) if (at === null || n > counts.get(at)) at = v;
  const idx = ranked.map((r, i) => (r.lists === at ? i : -1)).filter((i) => i >= 0);
  return { n: counts.get(at), at, from: idx[0] + 1, to: idx[idx.length - 1] + 1 };
})();

const pct = (n) => Math.round((n / lists) * 100);

// ---------------------------------------------------------------------------
// Rows.
// ---------------------------------------------------------------------------

const SECTION_LABEL = { "Pokémon": "Pokemon", Trainer: "Trainer", Energy: "Energy" };

const rows = top
  .map((r, i) => {
    const c = r.card;
    const art = c.img
      ? avifPicture(
          `<img class="pl-art" src="${c.img}" alt="${esc(`${r.name}, ${c.setName || c.set} ${c.number}`)}"` +
            ` loading="lazy" decoding="async"${imgDims(c.img)} onerror="this.remove()">`
        )
      : // Basic Energy from a set this site holds no guide for. A drawn tile is
        // honest; borrowing another set's printing would show a card that is
        // not the one being counted.
        `<span class="pl-noart" aria-hidden="true">${esc(r.name.replace(/ Energy$/, ""))}</span>`;

    const setLine = c.slug
      ? `<a class="pl-set" href="/sets/${c.slug}.html">${esc(c.setName)} ${esc(c.number)}</a>`
      : `<span class="pl-set pl-set-plain">${esc(c.set)} ${esc(c.number)}</span>`;

    return `<li class="pl">
  <span class="pl-rank">${i + 1}</span>
  <span class="pl-pic">${art}</span>
  <span class="pl-body">
    <b class="pl-name">${esc(r.name)}</b>
    <span class="pl-meta"><span class="pl-kind">${esc(SECTION_LABEL[r.section] || r.section)}</span>${setLine}</span>
    ${/* "LISTS" FOR DECKLISTS, "DECKS" FOR ARCHETYPES, and never the other way
         round. This line read "319 of 357 decks (89%) / 810 copies / 17 decks"
         and used the word "decks" for two different things three words apart:
         the 357 are individual registered decklists, the 17 are distinct
         archetypes out of the 18 collected. Same word, two denominators, on one
         line. Every other mention of the corpus on this page says "lists" for
         the same reason. */ ""}
    <span class="pl-nums">
      <b>${r.lists}</b> of ${lists} lists <span class="pl-pctv">(${pct(r.lists)}%)</span>
      <span class="pl-sep">/</span> ${r.copies} copies
      <span class="pl-sep">/</span> ${r.archetypes} of ${corpus.archetypes} decks
    </span>
  </span>
</li>`;
  })
  .join("\n");

// ---------------------------------------------------------------------------
// Page.
// ---------------------------------------------------------------------------

const desc =
  `The 100 Pokemon cards played most in the current Standard format, counted across ` +
  `${lists} tournament decklists. Ranked by how many decks play them, not by price.`;

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "The 100 most played Pokemon cards in Standard",
    description: desc,
    // Same fix as build-decks.mjs and for the same reason: Article without an
    // image or a publisher logo cannot produce the rich result. This page's own
    // share card, not the generic one, so it matches the og:image below.
    image: [`${SITE}/assets/og-top-100-playable.jpg`],
    datePublished: d.checked,
    dateModified: d.checked,
    author: { "@type": "Organization", name: "Garbage Rips 585" },
    publisher: {
      "@type": "Organization",
      name: "Garbage Rips 585",
      logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-square.jpg` },
    },
    mainEntityOfPage: `${SITE}/top-100-playable.html`,
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Top 100 playable cards",
        item: `${SITE}/top-100-playable.html`,
      },
    ],
  },
];

const style = `
.pl-fmt{border:2px solid var(--keyline);border-radius:var(--r);background:var(--card);
  padding:var(--s4);margin:var(--s5) 0;box-shadow:var(--hard-lg)}
.pl-fmt h2{font-size:var(--t-m);margin:0 0 var(--s2)}
.pl-fmt dl{display:grid;grid-template-columns:1fr;gap:var(--s2) var(--s4);margin:0}
.pl-fmt dt{font-family:var(--mono);font-size:var(--t-micro);letter-spacing:.04em;
  text-transform:uppercase;color:var(--ink-2)}
.pl-fmt dd{margin:0 0 var(--s3);font-size:var(--t-sm);max-width:46em}
/* MEASURED IN REAL CHARACTERS, NOT IN ch. At 1440 the wrap is 1,392px and none
   of the prose on this page was constrained, so .pl-note ran 293 characters per
   line at 11px and the plain body paragraph ran 188. Both are two to four times
   a readable measure. The caps were set by measuring rendered line boxes and
   dividing real text length by real line count, which is the only way to get
   this right: "ch" is the advance width of a "0" and about 1.43 average
   characters in Outfit, so a 75ch rule would have produced a 107 character line.

   MEASURED AFTER, at 1440: .pl-note 83 to 98, .pl-p 75, .lede 67. The 46em on
   the micro text is the site's existing convention for a source note (.ty-src
   on /types.html and .dk-src next door both use it) and it lands near 100
   characters at 11px rather than under 90, which is the trade that comes with
   matching the neighbours instead of inventing a width for one page. At 390 the
   same rules measure 67 to 73, because the wrap is narrower than the cap and
   nothing below 1000px is affected at all. */
.pl-p{max-width:38em}
.pl-mark{display:inline-block;font-family:var(--mono);font-weight:700;
  background:var(--chip-gold-bg);border:1px solid var(--gold-deep);color:var(--gold-deep);
  border-radius:var(--r-sm);padding:1px 7px;margin-right:4px}
.pl-note{font-size:var(--t-micro);color:var(--ink-2);margin:var(--s3) 0 0;line-height:1.7;max-width:46em}

.pl-list{list-style:none;padding:0;margin:var(--s5) 0 0;display:grid;
  grid-template-columns:1fr;gap:var(--s2)}
.pl{display:grid;grid-template-columns:2.2em 56px 1fr;gap:var(--s3);align-items:center;
  border:2px solid var(--keyline);border-radius:var(--r);background:var(--card);
  padding:var(--s2) var(--s3);box-shadow:var(--hard-lg)}
.pl-rank{font-family:var(--display);font-size:1.05rem;color:var(--gold-deep);
  text-align:right;line-height:1}
.pl-pic{display:block}
/* The scans are 245x337 intrinsic. The box is what decides the transfer. */
.pl-art{width:56px;height:auto;border-radius:4px;display:block}
.pl-noart{display:grid;place-items:center;width:56px;height:77px;border-radius:4px;
  background:var(--paper-3);border:1px dashed var(--hair);font-family:var(--mono);
  font-size:var(--t-micro);color:var(--ink-2);text-align:center;line-height:1.2;padding:2px}
.pl-body{min-width:0}
.pl-name{display:block;font-size:var(--t-sm);line-height:1.25}
.pl-meta{display:flex;gap:var(--s2);align-items:baseline;flex-wrap:wrap;margin-top:1px}
.pl-kind{font-family:var(--mono);font-size:var(--t-micro);text-transform:uppercase;
  letter-spacing:.04em;color:var(--ink-2)}
.pl-set{font-family:var(--mono);font-size:var(--t-micro);color:var(--ink-2)}
/* THE SET LINK IS THE ONLY LINK IN THE ROW AND IT WAS 17px TALL.
   The card name beside it is a bold span, not an anchor, so a.pl-set is the sole
   way out of any of these 100 rows, and a hit test at 390px measured 121x18. The
   same fix .crumbs a already uses in ui.css: keep the text where it is and grow
   the TARGET with an absolutely positioned pseudo-element, so nothing about the
   layout, the line height or the wrap point changes. 44px is the WCAG 2.5.5 AAA
   figure and the one the rest of this site's chrome already meets. .pl-meta gets
   the containing block and .pl-kind stays above the overlay so the two do not
   fight for the same pixels.
   NO BACKTICKS IN HERE. This comment lives inside a template literal, and a
   backtick closes it: see the note in CLAUDE.md. It cost one build. */
a.pl-set{position:relative}
a.pl-set::after{content:"";position:absolute;left:0;right:0;top:50%;
  transform:translateY(-50%);height:44px;z-index:1}
.pl-meta{position:relative}
.pl-kind{position:relative;z-index:2}
a.pl-set:hover,a.pl-set:focus{color:var(--ink)}
.pl-set-plain{opacity:.85}
.pl-nums{display:block;font-size:var(--t-micro);color:var(--ink-2);margin-top:2px;
  line-height:1.5}
.pl-nums b{color:var(--ink)}
.pl-pctv{white-space:nowrap}
/* var(--hair) is an 18% alpha: 1.58:1, and never legible on either palette.
   This is a character in running text, not a border. Twin of .dk-sep. */
.pl-sep{color:var(--ink-2)}

.pl-more{display:grid;grid-template-columns:1fr;gap:var(--s3);margin:var(--s5) 0 0;
  list-style:none;padding:0}
.pl-more a{display:block;border:2px solid var(--keyline);border-radius:var(--r);
  background:var(--card);padding:var(--s3);text-decoration:none;color:var(--ink);
  box-shadow:var(--hard-lg)}
.pl-more b{display:block;font-size:var(--t-sm)}
.pl-more span{font-size:var(--t-micro);color:var(--ink-2);line-height:1.5;display:block;
  margin-top:2px}
.pl-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s6);line-height:1.7;
  max-width:46em}

@media(min-width:700px){
  .pl-fmt dl{grid-template-columns:auto 1fr}
  .pl-fmt dt{text-align:right;padding-top:2px}
  .pl-list{grid-template-columns:1fr 1fr}
  .pl-more{grid-template-columns:1fr 1fr}
}
@media(min-width:1100px){
  .pl{grid-template-columns:2.4em 64px 1fr}
  .pl-art,.pl-noart{width:64px}
  .pl-noart{height:88px}
  .pl-more{grid-template-columns:repeat(4,1fr)}
}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The 100 Most Played Pokemon Cards in Standard</title>
<meta name="description" content="${esc(clipMeta(desc))}">
<link rel="canonical" href="${SITE}/top-100-playable.html">
<meta property="og:title" content="The 100 most played cards in Standard">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/top-100-playable.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-top-100-playable.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-top-100-playable.jpg">
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
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Top 100 playable cards</span></nav>
      <h1>The 100 most <span class="hl">played</span> cards in Standard</h1>
      <p class="lede">Not the most expensive cards. The ones that actually go in decks. Counted one by one
        across <b>${lists} tournament decklists</b>, so the order comes from arithmetic you can check rather
        than from anybody's opinion.</p>

      <div class="pl-fmt">
        <h2>The format being counted</h2>
        <dl>
          <dt>Format</dt>
          <dd><b>${esc(fmt.name)}</b></dd>
          <dt>Legal marks</dt>
          <dd>${fmt.legalMarks.map((m) => `<span class="pl-mark">${esc(m)}</span>`).join("")}
            and any newer ones. The mark is in the bottom corner of the card.</dd>
          <dt>Rotated out</dt>
          <dd>${fmt.rotatedOut.map((m) => `<span class="pl-mark">${esc(m)}</span>`).join("")}
            no longer legal.</dd>
          <dt>In force since</dt>
          <dd>${esc(longDate(fmt.liveEffective))} in Pokemon TCG Live,
            ${esc(longDate(fmt.paperEffective))} at in-person events.</dd>
        </dl>
        <p class="pl-note">Source: ${esc(fmt.source)}, read ${esc(longDate(fmt.read))}. Rotation is
          announced by Pokemon and it changes, so this is correct as of that date rather than forever.
          Every card here was played in a list drawn through Limitless's own Standard filter for this
          rotation, so these cards are format legal because of where the lists came from, not because we
          checked them one at a time.</p>
      </div>

      <h2>What is being measured</h2>
      <p class="pl-p">Cards are ranked by <b>how many of the ${lists} decklists play at least one copy</b>. Total copies
        is shown next to it and breaks ties, and so is the number of the ${corpus.archetypes} different
        decks a card turns up in. That is the whole method. There is no scoring, no weighting and no
        judgment in the order. On each row, <b>lists</b> means individual registered decklists and
        <b>decks</b> means distinct archetypes.</p>
      <p class="pl-note">The lists are ${corpus.lists} decklists collected from <b>${esc(src.name)}</b> on
        ${esc(longDate(d.checked))}, dated ${esc(longDate(corpus.earliest))} to
        ${esc(longDate(corpus.latest))}: up to ${corpus.listsPerArchetype} of the highest placing lists
        from each of the ${corpus.archetypes} most played decks.
        <b>These are online tournaments played in Pokemon TCG Live</b> on Limitless's own play platform,
        not Regionals and not the World Championships.</p>
      <p class="pl-note"><b>Two things this count is not.</b> Every deck contributes about the same number
        of lists whatever its share of the field, which is deliberate, because it stops one popular deck's
        pet card outranking a real staple. It also means this is not a measure of how often you will run
        into a card across the whole metagame. And because each deck contributes at most
        ${corpus.listsPerArchetype} lists, cards bunch up near multiples of that number, so the order near
        any tie is arbitrary: <b>${tied} cards sit on ${cutValue} lists</b>${
          tiedIn === tied
            ? `, and all ${tiedIn} of them are inside the hundred, so nothing was cut between equals here`
            : `, of which ${tiedIn} fit inside the hundred and ${tied - tiedIn} did not`
        }. ${
          plateau.n > 0
            ? `The largest bunch below the cut is <b>${plateau.n} cards on ${plateau.at} lists</b>, at ranks ${plateau.from} to ${plateau.to}.`
            : ""
        } Read the bottom of this list as a group and not as an order.</p>

      <ol class="pl-list">
        ${rows}
      </ol>

      <h2>Where to go next</h2>
      <ul class="pl-more">
        <li><a href="/decks.html"><b>Deck builds you can download</b>
          <span>The ${corpus.archetypes} most played decks, with lists that paste into TCG Live</span></a></li>
        <li><a href="/tcg-live.html"><b>Pokemon TCG Live</b>
          <span>The free official client, and the code card in every pack</span></a></li>
        <li><a href="/how-to-play.html"><b>How to play</b>
          <span>Setup, a turn, and the three ways to win</span></a></li>
        <li><a href="/cards.html"><b>Card search</b>
          <span>Every card we cover, and what it is worth today</span></a></li>
      </ul>

      <p class="pl-src">Decklists and deck usage come from <b>${esc(src.name)}</b>, read
        ${esc(longDate(d.checked))}: ${esc(src.what)}, filtered to ${esc(src.filter)}. The counts on this
        page are our own arithmetic over those ${lists} lists and are reproducible from them. Regulation
        marks and both rotation dates come from ${esc(fmt.source)}, read ${esc(longDate(fmt.read))}. Card
        scans and card data from TCGdex. Card names and pictures were checked against this site's own card
        records: ${map.matched} of ${map.printings} distinct printings matched exactly, and the
        ${map.printings - map.matched} that did not are basic Energy and a promo from sets this site has no
        guide for, which is why those rows carry a drawn tile instead of a scan. Where a card has been
        printed in more than one legal set, the printing shown is the one the most players registered.
        This page ranks cards by play, never by price, and states no pull rates and no pack odds.</p>
    </div>
  </section>
</main>
${footer("Deck data from Limitless TCG. Card scans from TCGdex.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/top-100-playable.html"), page);

const noArt = top.filter((r) => !r.card.img).length;
console.log(`Wrote public/top-100-playable.html`);
console.log(
  `  top ${TOP} of ${ranked.length} distinct cards over ${lists} lists; ` +
    `${noArt} without a scan; tie at the cut: ${tied} cards on ${cutValue} lists`
);
console.log(`  #1 ${top[0].name} (${top[0].lists} lists, ${top[0].copies} copies)`);
