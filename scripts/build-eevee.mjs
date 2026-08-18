#!/usr/bin/env node
// Build /eevee-evolutions.html: the eight, one at a time, with the artwork.
//
//   node scripts/build-eevee.mjs
//
// WHY THIS IS ITS OWN PAGE AND NOT A SECTION OF /evolution.html. Eevee is not a
// hard line, it is eight lines that happen to share a first box, and it is the
// only entry in the whole dataset where the answer to "how does it evolve" is
// eight different mechanics: three stones, two friendship-and-time-of-day, two
// that were a place and became a stone, and one that wants a move of a
// particular type. It also carries 19 of the 553 routes in the file, because
// Leafeon and Glaceon changed method five times each between Diamond and Pearl
// and Sword and Shield. On the chart page that is one card six times the height
// of its neighbours; here it is the page.
//
// It is also, by a distance, the most searched evolution question there is, and
// it is asked as its own question ("how do I get Umbreon") rather than as part
// of a browse. A reader arriving on that query should land on a page about
// Eevee, not on a chart with 340 cards on it and Eevee somewhere down it.
//
// EVERY CONDITION ON THIS PAGE COMES THROUGH shared/evolution.mjs, exactly as
// the chart page does, so the two cannot say different things about the same
// arrow. The only thing written here is the framing paragraph under each one,
// and the guard below fails the build if a branch has no paragraph, so a ninth
// Eeveelution stops the build rather than shipping with a blank.
//
// THE PARAGRAPHS SAY NOTHING THE DATA DOES NOT. That rule is enforced by
// reading rather than by code, so it needs stating: no paragraph below claims a
// method works in a game the source did not file it under, and none of them
// says "since" or "still" about a version group, because a version group is
// where a condition is filed and not a claim about later games.
//
// ============================================================================
// WHAT CHANGED 17 AUGUST 2026, AND WHY. Three problems, all found rather than
// guessed at.
//
// ONE: IT WAS AN ORPHAN. A technical SEO audit found nothing on the site
// linking to it. 1,849 indexable words sat in the sitemap and were invisible to
// a crawler that follows links. shared/chrome.mjs now carries a nav line, which
// fixes the inbound half from every page on the site. This file owns the
// OUTBOUND half and now spends it deliberately: every one of the nine species
// is linked to its own page under /pokemon/ from three different places (the
// drawn chain, the picture grid at the top, and its own section), and the chart
// at /evolution.html is linked from the breadcrumb, the body and the closing
// band. NOTHING HERE EDITS build-pokemon.mjs OR build-evolution.mjs: the
// contextual inbound links from those two pages are theirs to add, and the nav
// and footer already carry the structural ones.
//
// TWO: IT SKIPPED A HEADING LEVEL. h1, then eight h3 with no h2 above them,
// then two h2 at the foot. The eight now sit under a real h2 and every band on
// the page is an h2, so the outline is h1 > h2 > h3 with nothing missing. The
// label above each condition is a styled <p>, NOT a heading, on purpose: it
// would be a fourth level carrying no outline meaning.
//
// THREE: NO PICTURES. Tim asked to see all of them and there was not one image
// on the page. There are nine now, all LOCAL: public/assets/species/<dex>.webp,
// mirrored by scripts/sync-species-art.mjs, listed in data/species-art.json,
// 10.1KB to 16.5KB each and 121KB for all nine. No card scans and nothing
// hotlinked, so this page makes no cross-origin image request at all.
//
// THE DRAWN BOXES STAY UNDER data/species-art.json's 256px, which is the same
// constraint build-pokemon.mjs writes up beside its own portraits: a mirrored
// portrait has exactly one rendition and the browser will happily upscale it.
// The section portrait is 128 (exactly 2x at DPR 2), the grid tile is 88 and
// the value row thumbnail is 48. If any of them grows past 128, change BOX in
// sync-species-art.mjs and re-run it with --force in the same commit.
//
// NO avifPicture() HERE, and that is not an oversight. sync-species-art.mjs
// writes one .webp per species and no .avif, so a <picture> would carry a
// <source> pointing at a file that does not exist. imgDims() is not called
// either: it holds the intrinsic sizes of the four CARD hosts and knows nothing
// about /assets/species/. The manifest carries w and h for every portrait,
// which is the same thing measured at the source, and that is what is emitted.
// ============================================================================
//
// FOUR SOURCES, FOUR READ DATES, AND EVERY BAND NAMES ITS OWN. They genuinely
// differ, so a single date at the foot of the page would be wrong for three of
// the four. The conditions are PokeAPI on the evolution endpoint; the species
// facts are PokeAPI's National Pokedex; the artwork is the PokeAPI sprite
// repository; the card counts and prices are the TCGdex database and TCGplayer
// market prices. Each is read from the file that holds it and printed with the
// date that file records.
//
// THE CARD NUMBERS ARE NOT RE-DERIVED HERE. build-pokemon.mjs owns the join
// from a species to its priced cards, which is a hundred lines of dex-number
// matching, and it PUBLISHES the result as public/data/pokemon-index.json.
// This page reads that file. Doing the join a second time would be a second
// answer to the same question, which is the exact failure shared/evolution.mjs
// exists to prevent for conditions, and it would drift the first time either
// copy was touched.
//
// NO BACKTICKS IN COMMENTS IN THIS FILE. The page is one template literal.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { priceNote, priceFooter } from "../shared/card-prices.mjs";
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate, moneyRound, moneyExact } from "../shared/format.mjs";
import {
  loadEvolutions, groupRoutes, condsFor, dexNo, methodTags, METHOD_LABELS,
  EVO_MARKS, EVO_CSS, renderChain,
} from "../shared/evolution.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = await loadEvolutions();

const readJson = async (p, fallback) => {
  try {
    return JSON.parse(await readFile(join(ROOT, p), "utf8"));
  } catch {
    return fallback;
  }
};

// Found by walking rather than by chain id, so a re-sync that renumbers the
// chains cannot silently build this page about something else.
let eevee = null;
for (const c of d.chains) if (c.root.slug === "eevee") eevee = c.root;
if (!eevee) throw new Error("build-eevee.mjs: no eevee chain in data/evolutions.json");
if (eevee.to.length < 8) {
  throw new Error(`build-eevee.mjs: eevee has ${eevee.to.length} branches, expected 8 or more`);
}

/* ------------------------------------------------------------- the sources */

const dexDoc = await readJson("data/pokedex.json", null);
if (!dexDoc) throw new Error("data/pokedex.json is missing. Run: node scripts/sync-pokedex.mjs");
const DEX = dexDoc.pokemon;
const dexById = new Map(DEX.map((p) => [p.id, p]));
const genSize = {};
for (const p of DEX) genSize[p.gen] = (genSize[p.gen] || 0) + 1;

// The mirrored official artwork. Optional in the same way build-pokemon.mjs
// treats it: a missing portrait drops the picture rather than printing a hole.
const artDoc = await readJson("data/species-art.json", null);
const artFor = (id) => artDoc?.art?.[id] || artDoc?.art?.[String(id)] || null;

// build-pokemon.mjs's own output. `index` here is which species pages exist and
// are indexable; `cards`, `sets` and `top` are the card numbers, already joined.
const pokeIndex = await readJson("public/data/pokemon-index.json", null);
const pokeById = new Map((pokeIndex?.pokemon || []).map((p) => [p.id, p]));
const hasPage = new Set((pokeIndex?.pokemon || []).map((p) => p.slug));

// Which of the eleven CARD types a video game type is printed as, inverted from
// data/types.json exactly as build-pokemon.mjs does it, so /types.html, a
// species page and this page cannot disagree. That file records the mapping as
// checked against Bulbapedia's table AND against 628 real cards.
const tcgTypes = await readJson("data/types.json", null);
const gameTypeToCard = new Map();
for (const t of tcgTypes?.types || []) {
  for (const g of t.gameTypes || []) gameTypeToCard.set(String(g).toLowerCase(), t.name);
}

/* ------------------------------------------------------------- small print */

const n = (v) => Number(v).toLocaleString("en-US");
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

// A SMALL COUNT AT THE HEAD OF A SENTENCE IS SPELLED OUT. The note band opened
// "3 of the eight carry more than one condition", which reads as a table cell
// rather than a sentence, and the heading two lines above it already says
// "three" in words. Screenshotted at 390 before changing.
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (v) => (Number.isInteger(v) && v >= 0 && v <= 10 ? WORDS[v] : n(v));

const REGION = {
  1: "Kanto", 2: "Johto", 3: "Hoenn", 4: "Sinnoh", 5: "Unova",
  6: "Kalos", 7: "Alola", 8: "Galar", 9: "Paldea",
};

// Feet and inches, and pounds, alongside the metric. PokeAPI ships decimetres
// and hectograms and data/pokedex.json keeps them in those units precisely so
// the conversion happens once and nothing rounds twice. Same arithmetic as
// build-pokemon.mjs, which is a unit conversion rather than a data join.
const height = (p) => {
  const m = p.hDm / 10;
  const inches = Math.round(m * 39.3701);
  return `${m.toFixed(1)}m (${Math.floor(inches / 12)}ft ${inches % 12}in)`;
};
const weight = (p) => {
  const kg = p.wHg / 10;
  const lb = kg * 2.20462;
  return `${kg.toFixed(1)}kg (${lb < 10 ? lb.toFixed(1) : Math.round(lb)}lb)`;
};

// NOTHING RATHER THAN A ZERO, which is the rule wanted.html states in its own
// footnote and which build-pokemon.mjs repeats: a card whose market price is
// missing renders "$0", and a zero reads as "worthless", which is a claim about
// the card rather than about our data. The guard is on what will be PRINTED,
// not on the underlying number, because moneyRound turns $0.32 into "$0" too.
const topPrice = (v) => (!v ? null : v < 1 ? moneyExact(v) : moneyRound(v));

/* ------------------------------------------------------------ the branches */

// In dex order, which is also the order they were introduced.
const branches = eevee.to.slice().sort((a, b) => (a.id ?? 9999) - (b.id ?? 9999));

// ---------------------------------------------------------------------------
// THE FRAMING, one per branch. Restatement and emphasis only: every fact in
// here is already in the condition printed beside it. The guard under this map
// fails the build on a branch with no entry, which is the same discipline
// build-types.mjs keeps over its COPY block, and for the same reason: a page
// that quietly ships a blank where an explanation should be reads as finished.
const COPY = {
  vaporeon: "A Water Stone, and nothing else. No level, no friendship, no time of day. The three stone ones are the easy three, and they are easy in exactly the same way: hold the stone, use it on the Eevee, done.",
  jolteon: "A Thunder Stone. Same shape as Vaporeon, different stone. Nothing about the Eevee matters, which is why these three are the ones you can plan around.",
  flareon: "A Fire Stone. That is the last of the three that are one item and no conditions. Between them, Vaporeon, Jolteon and Flareon are the reason people assume every Eeveelution is a stone, and five of the eight are not.",
  espeon: "The first one that is not an item. Friendship 160 or higher, then a level up, and it has to happen in the daytime. Friendship is not a stat printed anywhere you can read it, which is what makes this the one people get wrong: it is built up by carrying the Pokemon around rather than bought at a counter.",
  umbreon: "Exactly Espeon's condition with the clock moved. Friendship 160 or higher, a level up, at night. The pair is deliberate and it is the reason both are famous: one Eevee, one number, and the only difference is what time you press the button. Get the hour wrong and you get the other one.",
  leafeon: "The one that changed the most. Our source files six different answers for Leafeon, and five of them are a place: a particular rock in a particular forest, in a different forest in every generation. The sixth is a Leaf Stone. Every one of them is listed above with the games it belongs to, because there is no single true answer to give.",
  glaceon: "Leafeon's twin, and it changed the same way at the same times. Five different cold places across five sets of games, then an Ice Stone. Both are above with their games. If you have been told one answer for Glaceon and it did not work, this is why.",
  sylveon: "The only one with a move condition. It wants a Fairy type move known, and the other half of the condition changed: affection in one set of games, friendship in another. Both are printed above, and the move requirement is in both of them.",
};
for (const b of eevee.to) {
  if (!COPY[b.slug]) {
    throw new Error(
      `build-eevee.mjs: ${b.name} has no paragraph in COPY. Write one before this ships. ` +
        `A branch with a blank under it reads as a finished page that forgot one.`
    );
  }
}

// Eevee's own entry is written separately because it is a different sentence:
// it is the only one of the nine with no condition into it at all.
const EEVEE_SAY =
  "Eevee is the one you start with and the only one of the nine with nothing above it. Our source records no " +
  "route into Eevee at all: nothing evolves into it, so every one of the eight below starts from a plain Eevee " +
  "and the whole question is what you do next.";

/* -------------------------------------------------------------- one entry */

/**
 * Everything the page prints about one of the nine, gathered in one place so a
 * section, a grid tile and a value row cannot describe the same Pokemon
 * differently. Card numbers come from pokemon-index.json, dex facts from
 * pokedex.json, the picture from species-art.json, the condition from the
 * evolution data through shared/evolution.mjs. Anything missing is dropped
 * rather than filled in.
 */
function entry(node, say) {
  const p = dexById.get(node.id) || null;
  const pk = pokeById.get(node.id) || null;
  const art = artFor(node.id);
  const types = (p?.types || node.types || []).map(cap);
  const cardTypes = [...new Set((p?.types || node.types || []).map((t) => gameTypeToCard.get(t)).filter(Boolean))];
  const groups = groupRoutes(node.routes);
  const tags = [...new Set((node.routes || []).flatMap(methodTags))];
  return {
    node,
    slug: node.slug,
    name: node.name,
    id: node.id,
    p,
    pk,
    art,
    types,
    cardType: cardTypes.length === 1 ? cardTypes[0] : null,
    answers: groups.length,
    tags,
    say,
    linked: hasPage.has(node.slug),
  };
}

const all = [entry(eevee, EEVEE_SAY), ...branches.map((b) => entry(b, COPY[b.slug]))];
const eight = all.slice(1);

const missingArt = all.filter((e) => !e.art).map((e) => e.name);
const missingCards = all.filter((e) => !e.pk).map((e) => e.name);

// How many distinct answers each branch has, which is the whole reason three of
// them need more room than the other five.
const changed = eight.filter((e) => e.answers > 1);
const mostAnswers = Math.max(...eight.map((e) => e.answers));

/* ------------------------------------------------------------- the writing */

/** The facts under one entry. Every one of them is a field, not a paraphrase. */
function facts(e) {
  const out = [];
  const p = e.p;
  if (!p) return out;

  if (p.genus) {
    out.push(`<b>The ${esc(p.genus)} Pokemon.</b> ${esc(e.name)} is #${p.id} in the National Pokedex.`);
  }

  // THE CARD TYPE IS THE FACT WORTH HAVING HERE and four of the nine surprise
  // people. Every one of the nine has exactly ONE video game type, which is the
  // condition data/types.json's mapping was measured under, so the sentence is
  // safe to make on all of them. Where the two names differ, the page says the
  // card game has no such type rather than implying the card is mislabelled.
  const t = e.types[0] || "";
  // A CARD TYPE OF THE SAME NAME MAY EXIST AND BE RETIRED, and saying "there is
  // no Fairy type in the card game" under Sylveon flatly contradicted the
  // paragraph directly above it, which gives that type's dates. Read from
  // data/types.json's own `status` rather than special-cased on the name, so a
  // second retirement gets the right sentence without an edit here.
  const retiredSameName = (tcgTypes?.types || []).some((x) => x.name === t && x.status === "retired");
  if (t && e.cardType) {
    out.push(
      e.cardType === t
        ? `<b>${esc(t)} type.</b> ${esc(t)} in the video games and ${esc(t)} on a card too. ` +
          `<a href="/types.html">The eleven card types</a>.`
        : retiredSameName
          ? `<b>${esc(t)} type.</b> ${esc(t)} in the video games. The card game had a ${esc(t)} type of its own ` +
            `and retired it, so ${esc(e.name)} cards are printed as ${esc(e.cardType)} now. ` +
            `<a href="/types.html">The eleven card types</a>.`
          // NO ARTICLE IN FRONT OF THE NAME HERE. It read "so a Umbreon is
          // printed as a Darkness card" for two of the four that differ,
          // because the sentence had a hardcoded "a" and Umbreon, Espeon and
          // Eevee all start with a vowel. The plural sidesteps the whole problem
          // and reads better anyway: it is a statement about the cards, not
          // about one card.
          : `<b>${esc(t)} type.</b> ${esc(t)} in the video games. There is no ${esc(t)} type in the card game, ` +
            `so ${esc(e.name)} cards are printed as ${esc(e.cardType)}. <a href="/types.html">The eleven card types</a>.`,
    );
  } else if (t) {
    out.push(`<b>${esc(t)} type.</b> ${esc(t)} in the video games. <a href="/types.html">The eleven card types</a>.`);
  }

  out.push(
    `<b>Generation ${p.gen}${REGION[p.gen] ? `, ${REGION[p.gen]}` : ""}.</b> ` +
      `One of the ${n(genSize[p.gen] || 0)} species that generation introduced.`,
  );
  out.push(`<b>Size.</b> ${height(p)} and ${weight(p)}.`);

  if (e.pk) {
    const top = topPrice(e.pk.top);
    out.push(
      `<b>${n(e.pk.cards)} printings across ${n(e.pk.sets)} sets.</b> ` +
        (top
          ? `The priciest single ${esc(e.name)} card we hold a price for is ${top}. `
          : `We hold no market price for a ${esc(e.name)} card yet. `) +
        `<a href="/pokemon/${esc(e.slug)}.html">Every ${esc(e.name)} card, priced</a>.`,
    );
  }
  return out;
}

/** SYLVEON GETS ONE EXTRA SENTENCE, because its card type has a history that
 *  the generic sentence above cannot carry and that a collector holding an
 *  older card genuinely needs. Every clause is from data/types.json's Fairy
 *  entry: status retired, ran from the Kalos Starter Set in 2013 until Sword
 *  and Shield in February 2020, Fairy Pokemon printed as Psychic afterwards,
 *  and the explicit instruction in that file never to call an existing Fairy
 *  card a fake or a misprint. */
const EXTRA = {
  sylveon:
    "The card game had a Fairy type of its own from the Kalos Starter Set in 2013 until Sword and Shield in " +
    "February 2020, then retired it. That is why a Sylveon card from the middle of that window is a Fairy card " +
    "and a new one is a Psychic card. The old ones are ordinary cards, not fakes and not misprints.",
};

// EVERY PICTURE ON THIS PAGE IS LAZY, AND THAT IS MEASURED RATHER THAN
// CAUTIOUS. build-pokemon.mjs makes the opposite call for the first tile of its
// featured band and is right to: that tile IS the Largest Contentful Paint
// element, and telling the browser an element on the first screen is not needed
// for the first screen costs 100 to 120ms. Nothing here is in that position.
// At 390x844 the first screen is the bar, the breadcrumb, the h1 and two lede
// paragraphs, then the drawn chain, which is inline SVG and text and carries no
// image at all: the chain box alone is 1,806px tall, so the first picture on the
// page sits about 2,400px down. There is no image above the fold to be the LCP
// element at any width measured. Marking them eager would put 128KB of portrait
// on the load path for a reader who has not scrolled past a wall of text.
const section = (e) => {
  const tags = e.tags
    .map((t) => METHOD_LABELS[t])
    .filter(Boolean)
    .map((l) => `<li>${esc(l)}</li>`)
    .join("");
  const f = facts(e);
  const cond = condsFor(e.node, d);
  return `        <article class="ee-t" id="${esc(e.slug)}">
          <div class="ee-th">
            <h3>${esc(e.name)}</h3>
            <span class="ee-no">${esc(dexNo(e.node))}</span>
            <!-- NO "n answers" BADGE HERE. condsFor already prints that heading
                 immediately below, so the badge repeated it two lines apart and
                 read like a stutter. Screenshotted at 390 before removing. -->
          </div>
          <div class="ee-row">
            ${
              e.art
                ? `<img class="ee-art" src="${esc(e.art.file)}" width="${e.art.w}" height="${e.art.h}"
              alt="${esc(e.name)}, official artwork" loading="lazy" decoding="async">`
                : ""
            }
            <div class="ee-body">
              <div class="ee-what">
              ${
                cond
                  ? `<p class="ee-lab">What it takes</p>
              ${cond}`
                  : `<p class="ee-lab">Where it comes from</p>
              <div class="ev-cond"><b>Nothing evolves into ${esc(e.name)}</b></div>`
              }
              ${tags ? `<ul class="ee-tags">${tags}</ul>` : ""}
              <p class="ee-say">${esc(e.say)}</p>
              ${EXTRA[e.slug] ? `<p class="ee-say">${esc(EXTRA[e.slug])}</p>` : ""}
              </div>
              ${f.length ? `<ul class="facts-list ee-facts">\n                ${f.map((x) => `<li>${x}</li>`).join("\n                ")}\n              </ul>` : ""}
            </div>
          </div>
        </article>`;
};

const sections = all.map(section).join("\n");

// The picture grid at the top, which is also the jump nav. It is a nav rather
// than a decorative band because that is what it does: nine links to nine
// anchors on this page. IT CARRIES THE PICTURES ON PURPOSE. The ask was to see
// all of them, and a reader who arrived on "eevee evolutions" wants the set of
// nine faces before they want any sentence.
//
// THE FIRST TWO TILES ARE EAGER AND EVERY OTHER PICTURE ON THE PAGE IS LAZY.
// The grid sits directly under the lede, so at 390x844 the first row, Eevee and
// Vaporeon, is inside the first screen and one of the two is the Largest
// Contentful Paint element. build-pokemon.mjs writes up at length what marking
// that element lazy costs: it tells the browser an element on the first screen
// is not needed for the first screen, which is the opposite of true, and it
// measured at 100 to 120ms there. Four, not nine.
//
// THIS SAID "TWO, NOT NINE: ON THE NARROWEST PHONE ONLY THE FIRST ROW IS ABOVE
// THE FOLD" AND THE SECOND ROW WAS ALSO ABOVE IT. Re-measured over CDP at
// 390x844 DPR 2 by reading each img's own border box at scroll 0: row one sits
// at y=594 and row two at y=750, both inside the 844px viewport. The count was
// right about the rule and wrong about the geometry, which is the failure this
// whole family of attributes keeps producing, so it is derived from the two
// tiles per row rather than typed: EAGER_ROWS rows of the grid go eager.
//
// THE lazy ON THE OTHER SEVEN BUYS NOTHING AT 390 AND IS KEPT ANYWAY, which is
// worth writing down rather than discovering again. Measured from the request
// log, gzipped, cache off: with the grid BELOW the drawn chain the page loaded
// 126.5KB and grew to 250.2KB fully scrolled; with the grid ABOVE it the page
// loads 250.5KB and grows by nothing, because the whole grid ends about 1,270px
// down and Chrome's lazy threshold reaches further than that. So the move cost
// 124KB on the load path and it is the right trade: the pictures are what the
// page was asked for and a reader should not scroll 1,806px of diagram to reach
// the first one. The attribute stays because it is honest markup and it is what
// keeps a narrower or shorter viewport from paying the same bill.
// Two tiles per row at 390, and the first two rows are in the first screen.
const EAGER_ROWS = 2;
const GLANCE_PER_ROW = 2;
const glance = all
  .map(
    (e, i) => `        <a class="ee-gt" href="#${esc(e.slug)}">
          ${
            e.art
              ? `<img src="${esc(e.art.file)}" width="${e.art.w}" height="${e.art.h}" alt=""${i < EAGER_ROWS * GLANCE_PER_ROW ? "" : ` loading="lazy"`} decoding="async">`
              : ""
          }
          <b>${esc(e.name)}</b>
          <span>${esc(e.types.join(" / "))}</span>
        </a>`,
  )
  .join("\n");

// THE VALUE BAND, and it is the only thing on this page no other Eevee page can
// print. Ranked by the priciest single card we hold a market price for, which
// is what pokemon-index.json's `top` is. Anything with no price is listed with
// its printing count and no figure rather than dropped or zeroed.
const valued = all
  .filter((e) => e.pk)
  .slice()
  .sort((a, b) => (b.pk.top ?? -1) - (a.pk.top ?? -1));
const valueRows = valued
  .map((e) => {
    const top = topPrice(e.pk.top);
    return `        <li>
          ${e.art ? `<img src="${esc(e.art.file)}" width="${e.art.w}" height="${e.art.h}" alt="" loading="lazy" decoding="async">` : ""}
          <a class="ee-vn" href="/pokemon/${esc(e.slug)}.html">${esc(e.name)}</a>
          <span class="ee-vp">${top || "no price yet"}</span>
          <span class="ee-vm">${n(e.pk.cards)} printings across ${n(e.pk.sets)} sets</span>
        </li>`;
  })
  .join("\n");

const dearest = valued[0];
const mostPrinted = all.filter((e) => e.pk).sort((a, b) => b.pk.cards - a.pk.cards)[0];

const desc =
  "All eight Eevee evolutions, pictured, and exactly what each takes: which stone, which " +
  "friendship level, which time of day, and where the answer changes by game.";
if (desc.length > 160) throw new Error(`meta description is ${desc.length} characters, over 160:\n${desc}`);

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Evolution chart", item: `${SITE}/evolution.html` },
      { "@type": "ListItem", position: 3, name: "Eevee evolutions" },
    ],
  },
  // EVERY ITEM HAS A url, which is the whole reason this block is allowed to
  // exist. build-pokemon.mjs deleted an ItemList of its own precisely because
  // its entries had nothing to point at, and Google will not render one whose
  // items carry no url. These nine all point at a real species page.
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "The eight Eevee evolutions",
    itemListElement: eight.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.name,
      url: `${SITE}/pokemon/${e.slug}.html`,
    })),
  },
];

const style = `
.ee-lede{max-width:46em}
.ee-fan{border:3px solid var(--keyline);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4);margin:var(--s5) 0}
/* THE PICTURE GRID. auto-fill with a 140px floor, so a 390px phone gets two
   columns of about 157px and a desktop gets as many as fit. NOT a flex row:
   the failure this page has already had once is a flex row that would not wrap,
   which pushed the document to 964px against a 390px viewport. A grid cannot
   do that, because a track that does not fit becomes a new row. */
.ee-glance{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:var(--s2);
  margin:var(--s4) 0 0;padding:0;list-style:none}
.ee-gt{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;
  min-height:44px;padding:var(--s3) var(--s2);border:1px solid var(--hair);border-radius:10px;
  background:var(--card);color:inherit;text-decoration:none;text-align:center}
.ee-gt img{width:88px;height:88px;object-fit:contain;max-width:100%}
.ee-gt b{font:700 var(--t-sm)/1.2 var(--body)}
.ee-gt span{font:400 var(--t-micro)/1.2 var(--mono);color:var(--ink-2)}
.ee-gt:hover{border-color:var(--ink);background:var(--mustard);color:var(--on-accent)}
.ee-gt:hover span{color:var(--on-accent)}
.ee-list{display:flex;flex-direction:column;gap:var(--s4);margin-top:var(--s4)}
.ee-t{border:2px solid var(--hair);border-radius:12px;background:var(--card);padding:var(--s4);
  scroll-margin-top:var(--s5)}
.ee-th{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--s2);margin-bottom:var(--s3)}
.ee-th h3{font:400 var(--t-m)/1.15 var(--display)}
.ee-no{font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2)}
/* THE PORTRAIT BESIDE THE CONDITION, and both halves wrap. flex-wrap plus
   min-width:0 on the body is the pair that keeps this off the phone's right
   edge; the body's flex-basis is 260px, so below about 400px of content box it
   drops under the picture instead of squeezing beside it. */
.ee-row{display:flex;flex-wrap:wrap;gap:var(--s4);align-items:flex-start}
.ee-art{width:128px;height:128px;object-fit:contain;flex:none;background:var(--paper-2);
  border:1px solid var(--hair);border-radius:var(--r);padding:4px}
.ee-body{flex:1 1 260px;min-width:0}
.ee-lab{font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);margin-bottom:4px}
.ee-tags{display:flex;flex-wrap:wrap;gap:5px;margin:var(--s3) 0 0;padding:0;list-style:none}
.ee-tags li{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  border:1px solid var(--hair);border-radius:var(--r-pill);padding:6px 9px;color:var(--ink-2)}
.ee-say{font-size:var(--t-sm);line-height:1.55;max-width:44em;margin-top:var(--s3)}
.ee-facts{margin-top:var(--s3)}
.ee-facts li{max-width:44em}
/* THE LINKS IN A FACT WERE INVISIBLE. .facts-list has no rule for a nested <a>,
   so "The eleven card types" and "Every Umbreon card, priced" rendered in body
   ink with no underline and read as ordinary sentence text. Screenshotted at
   390 before believing it. Nine fact lists on this page carry two links each,
   which is eighteen links a reader could not see. Underlined here rather than
   in ui.css, which another pass is rewriting. */
.ee-facts a{text-decoration:underline;text-underline-offset:2px}
/* THE VALUE LIST. Rows rather than a table: four columns of numbers inside a
   326px content box is either a horizontal scroller or 9px type, and the third
   line here wraps to its own full-width row instead. */
.ee-val{display:flex;flex-direction:column;gap:var(--s2);margin:var(--s4) 0 0;padding:0;list-style:none}
.ee-val li{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s3);padding:6px 12px;
  border:1px solid var(--hair);border-radius:var(--r);background:var(--card)}
.ee-val img{width:48px;height:48px;object-fit:contain;flex:none}
.ee-vn{flex:1 1 7em;min-width:0;display:inline-flex;align-items:center;min-height:44px;
  font:700 var(--t-body)/1.3 var(--body);color:inherit}
.ee-vp{font:400 var(--t-m)/1 var(--display);color:var(--ink)}
.ee-vm{flex:1 0 100%;font:400 var(--t-micro)/1.4 var(--mono);color:var(--ink-2)}
.ee-note{border:3px solid var(--keyline);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4);margin:var(--s5) 0}
.ee-note p{font-size:var(--t-sm);line-height:1.55;max-width:46em}
.ee-note p + p{margin-top:var(--s3)}
.ee-links{display:flex;flex-wrap:wrap;gap:6px;margin:var(--s3) 0 0;padding:0;list-style:none}
.ee-links a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.ee-links a:hover{border-color:var(--ink);background:var(--mustard);color:var(--on-accent)}
.ee-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s4);line-height:1.6;max-width:46em}
/* The source list carries .ee-src on the <ul> ITSELF, so a descendant selector
   for it would never match. This is the rule that spaces its rows. */
.ee-src li{margin-top:8px}
/* DESKTOP READING MEASURE, the same block build-evolution.mjs and
   build-types.mjs both end with. --measure is ui.css's own cap and it has to be
   named on every loose paragraph class, because nothing else reaches them:
   .ee-facts li was running to 95 real characters at 1440, measured with a
   canvas against the actual face rather than guessed from ems, because its 44em
   cap is 669px at that element's 15.2px. */
@media(min-width:1000px){
  .ee-lede,.ee-src,.ee-note p,.ee-say,.ee-facts li,.ev-p{max-width:var(--measure)}
  /* AND THE VALUE ROWS STOP GROWING. Left at full width a 1,392px row put the
     name at the far left and the price at the far right with 1,100px of nothing
     between them, which is a row you have to track across rather than read. */
  .ee-val{max-width:38em}
}
/* THE CARD BECOMES TWO COLUMNS AT 1100, and it is the failure ui.css already
   documents for the home page and build-evolution.mjs for the chart: a column
   of prose in a 1,392px band leaves 550px of empty card beside it, measured at
   1440. The condition and its paragraph go left, the facts go right, and the
   nine cards roughly halve in height. 1100 rather than 1000 because the facts
   need about 480px before they start wrapping every line. */
@media(min-width:1100px){
  .ee-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);
    gap:var(--s4) var(--s5);align-items:start}
  .ee-facts{margin-top:0}
}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>All 8 Eevee Evolutions and How to Get Each One | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/eevee-evolutions.html">
<meta property="og:title" content="How do you get every Eeveelution?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/eevee-evolutions.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-eevee.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-eevee.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
<style>${EVO_CSS}${style}</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${EVO_MARKS}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> /
        <a href="/evolution.html">Evolution chart</a> / <span>Eevee evolutions</span></nav>
      <h1>How do you get every <span class="hl">Eeveelution</span>?</h1>
      <p class="lede ee-lede">Eight of them, and no two work the same way. Three want a stone. Two want friendship
        and a clock. Two used to want a specific rock in a specific forest and now want a stone instead. One wants
        a move. <b>Eevee is the only Pokemon whose answer is eight answers</b>, which is why it gets a page.</p>
      <p class="lede ee-lede">All nine of them are here, with the artwork, what each one takes, when it was
        introduced and what its cards are worth. Tap a face to jump straight to it.</p>

      <!-- THE PICTURES COME BEFORE THE DIAGRAM, and they used to come after it.
           The drawn chain is 1,806px tall at 390px, so a reader who arrived on
           "eevee evolutions" had to scroll past nearly two phone screens of it
           before seeing a single Pokemon. A jump nav that far down the page is
           also not a jump nav. The chain is still the better answer to "how does
           this fork" and it keeps its place directly under, where the reader has
           already seen who the nine are. -->
      <nav aria-label="Jump to an Eeveelution">
        <div class="ee-glance">
${glance}
        </div>
      </nav>

      <div class="ee-fan">
${renderChain(eevee, d, hasPage)}
      </div>

      <section>
        <h2>Eevee, and the <span class="hl">eight</span> it becomes</h2>
        <p class="ev-p">One species, ${eight.length} branches, ${n(eight.reduce((t, e) => t + e.node.routes.length, 0))}
          separate conditions recorded between them. Each one below carries the condition exactly as our source files
          it, then the plain English version, then what the Pokemon is and what its cards do.</p>

        <div class="ee-list">
${sections}
        </div>
        <p class="price-note">Conditions, dex numbers and game names from PokeAPI (pokeapi.co), read
          ${esc(longDate(d.checked) || d.checked)}. Genus, type, generation and size from the National Pokedex,
          also pokeapi.co, read ${esc(longDate(dexDoc.checked) || dexDoc.checked)}. Which of the eleven card types
          each is printed as comes from our own type research, checked against Bulbapedia's table and against
          628 real cards${tcgTypes?.checked ? `, ${esc(longDate(tcgTypes.checked) || tcgTypes.checked)}` : ""}.
          Card counts and prices are named under the band below.</p>
      </section>

      <div class="ee-note">
        <!-- THE COUNT IN THE HEADING IS DERIVED, not typed. It read "Why three
             of them" beside a paragraph that computed the same number from the
             data, so a re-sync that moved one would have left the heading
             lying while the sentence under it told the truth. -->
        <h2>Why ${word(changed.length)} of them have <span class="hl">more than one answer</span></h2>
        <p>${cap(word(changed.length))} of the eight carry more than one condition, and that is not us hedging. The
          method genuinely changed between games, and every version of it is printed with the games it belongs to.
          Leafeon and Glaceon are the extreme case at ${word(mostAnswers)} apiece: for five sets of games
          the answer was a particular rock in a particular place, and the place was different every time.</p>
        <p>A page that gives you one of those has given most of its readers the wrong instruction. So this one
          gives you all of them and tells you which games each belongs to.</p>
        <p>Where a condition carries no game tag at all, our source records only one method for it. That means the
          source files one answer, not that the answer is guaranteed identical in every game ever made. The same
          rule is what stops <a href="/evolution.html">the full chart</a> writing "Level 16, in Red and Blue"
          under Charmeleon.</p>
      </div>

      <section>
        <h2>What an Eeveelution <span class="hl">card</span> is worth</h2>
        <p class="ev-p">This is the part no other Eevee page can tell you. Every one of the nine has its own page
          here with every printing we could find on it, and the figure below is the priciest single card of that
          Pokemon we hold a market price for. It is one card, not a set and not an average.</p>
        <ol class="ee-val">
${valueRows}
        </ol>
        ${
          dearest && topPrice(dearest.pk.top)
            ? `<p class="ev-p">${esc(dearest.name)} tops it at ${topPrice(dearest.pk.top)}, and
          ${esc(mostPrinted.name)} is the most printed of the nine at ${n(mostPrinted.pk.cards)} cards across
          ${n(mostPrinted.pk.sets)} sets. Tap a name for the whole wall of scans.</p>`
            : ""
        }
        <p class="price-note">Card counts come from the TCGdex card database.
          ${esc(priceNote(pokeIndex || {}))} They are joined to
          each species by build-pokemon.mjs and read here from its published index so this page and the species
          pages cannot print different numbers. Prices move daily, so treat these as a ballpark rather than a
          quote. Where a card comes as a normal, holo and reverse holo at different prices, the figure is the
          priciest of them.</p>
      </section>

      <section>
        <h2>Keep <span class="hl">going</span></h2>
        <p class="ev-p">Eevee is the hardest line to draw and far from the only interesting one.
          <a href="/evolution.html">The full evolution chart</a> has all ${n(d.counts.chains)} chains with the
          condition on every arrow, filterable by what it takes: every trade evolution, every held item, every one
          that needs a time of day.</p>
        <p class="ev-p">On the card side, <a href="/types.html">the card types page</a> explains why Sylveon is not
          a Fairy card any more and why the card game has no type chart at all.
          <a href="/pokemon/">Browse by Pokemon</a> has every Umbreon and Vaporeon card we cover, priced. And
          <a href="/lore.html">Pokemon lore</a> is the rest of the Pokedex, counted rather than repeated.</p>
        <p class="ev-p">Straight to one of the nine:</p>
        <ul class="ee-links">
${all
  .filter((e) => e.linked)
  .map((e) => `          <li><a href="/pokemon/${esc(e.slug)}.html">${esc(e.name)} cards</a></li>`)
  .join("\n")}
        </ul>
      </section>

      <section>
        <h2>Where this comes <span class="hl">from</span></h2>
        <p class="ee-src">Four sources with four different read dates, so each is named with its own rather than
          under one date that would be wrong for three of them. Nothing on this page is remembered from playing the
          games and nothing is typed in by hand.</p>
        <ul class="ee-src">
          <li><b>The conditions.</b> PokeAPI (pokeapi.co), read ${esc(longDate(d.checked) || d.checked)}.
            ${n(d.counts.routes)} routes across ${n(d.counts.chains)} chains, of which
            ${n(eight.reduce((t, e) => t + e.node.routes.length, 0))} are Eevee's. The item, move, place and game
            names are the source's own English names.</li>
          <li><b>The species facts.</b> The National Pokedex, also pokeapi.co, read
            ${esc(longDate(dexDoc.checked) || dexDoc.checked)}. Genus, type, generation, height and weight are
            structured fields. <b>No Pokedex entry is quoted anywhere on this page</b>: that text is copyrighted and
            our copy of the Pokedex deliberately does not store it, so every sentence here is written from the
            fields.</li>
          <li><b>The artwork.</b> Official artwork from the PokeAPI sprite repository, mirrored to this site at
            ${artDoc?.box || 256}px and served from here rather than hotlinked, read
            ${esc(longDate(artDoc?.checked) || artDoc?.checked || "an unrecorded date")}.</li>
          <li><b>The cards.</b> The TCGdex card database for the printing and set counts, TCGplayer market prices
            via TCGdex for the money, read
            ${esc(longDate(pokeIndex?.checked) || pokeIndex?.checked || "an unrecorded date")}.</li>
        </ul>
        <p class="ee-src">The framing paragraphs are ours and say nothing the conditions above them do not.
          Pokemon and Pokemon names are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc. This is a fan
          site and nothing on it is affiliated with or endorsed by them. The arrows and fork marks are our own
          drawings.</p>
      </section>
    </div>
  </section>
</main>
${footer("Evolution data and artwork from PokeAPI. Card data from TCGdex. Arrows drawn by us.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/eevee-evolutions.html"), page);

const words = page
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .split(/\s+/)
  .filter(Boolean).length;

console.log(`Wrote public/eevee-evolutions.html
  ${eight.length} branches plus Eevee, ${changed.length} with more than one answer
  ${branches.reduce((t, b) => t + b.routes.length, 0)} routes in total, read ${d.checked}
  ${all.filter((e) => e.art).length} of ${all.length} portraits, local, from data/species-art.json
  ${all.filter((e) => e.pk).length} of ${all.length} carry card counts from public/data/pokemon-index.json
  roughly ${words} words`);
if (missingArt.length) console.log(`  no artwork for ${missingArt.join(", ")}: run node scripts/sync-species-art.mjs`);
if (missingCards.length) console.log(`  no card numbers for ${missingCards.join(", ")}: run node scripts/build-pokemon.mjs`);
