#!/usr/bin/env node
// Build /types.html: the 11 Pokemon TCG Energy types, what each one is, and
// what most cards of that type actually print in the bottom-left corner.
//
//   node scripts/build-types.mjs
//
// Reads data/types.json, which is source data in the same spirit as
// data/rarity.json: a human-maintained file where every claim carries a source
// and a read date, plus a doNotSay list and an openQuestions list.
//
// THE ONE THING THIS PAGE EXISTS TO GET RIGHT. The card game is not the video
// games. The TCG has 11 Energy types and the video games have 18, several game
// types collapse into one TCG type, and there is NO universal type chart in the
// card game at all. Weakness and Resistance are printed on each individual
// card, in the lower-left corner, and plenty of cards print neither.
//
// SO THIS PAGE NEVER DRAWS A CHART. The owner asked what each type is strong
// and weak against, which is a fair question with an honest answer, and the
// honest answer is a MEASURED TENDENCY WITH ITS COUNT rather than a rule. Every
// percentage here comes with its n and the ten sets it was measured over, and
// the rule is enforced below rather than trusted: renderTendency throws if a
// count is rendered without its n. If a future edit is tempted to drop the n to
// tidy the layout, the tendency has to come off the page with it.
//
// FIVE TYPES GENUINELY SPLIT and Darkness's top answer is under half its cards,
// so a grid could not represent it even if we wanted one. All 36 modern Dragon
// cards sampled print no Weakness and no Resistance at all: the corner is
// empty, which is the single best proof that no chart governs this game.
//
// AND THE EXHIBIT THAT ENDS THE ARGUMENT is two cards side by side under
// Darkness: Muk (151 #089) prints Fighting x2 and Hydreigon ex (Surging Sparks
// #119) prints Grass x2. Same type, different printed Weakness. exampleAlt in
// the data file exists for exactly that pair.
//
// FAIRY HAS NO NUMBER AND THAT IS DELIBERATE. None of the ten sampled sets is
// old enough to hold a Fairy card, so no tendency was measured. The data file
// carries a top value with a null n and a note saying not to publish it. The
// renderer refuses a tendency with a null n rather than relying on anybody
// reading that note.
//
// TYPE MARKS ARE DRAWN HERE, not hotlinked. assets.tcgdex.net/univ/energy/*
// 404s, and Pokemon's own Energy symbol art is not ours to embed. rarityMark()
// in shared/rarity.mjs set the precedent for the site drawing its own marks,
// and this follows it. The shapes are our drawings, described from the card
// scans, and the page says so: an official-looking wrong symbol would be worse
// than none on a page whose job is correcting a misconception.
//
// CARD SCANS come from assets.tcgdex.net, the host the set guides and the
// rarity guide already use. Nothing new is fetched or hosted. imgDims() decides
// width and height (a blanket 245x337 once made 173 images wrong) and
// avifPicture() adds the AVIF source with the WebP left underneath. Every scan
// is an <img loading="lazy">, never a CSS background, because a background
// cannot be lazy: that change alone took rarity.html from 2,536KB to 388KB.
//
// NO BACKTICKS IN COMMENTS IN THIS FILE. The page below is one template literal
// and a backtick inside a comment closes it. That has broken this build three
// times, which is why check-build.py now runs node --check over every .mjs.

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
import { esc, longDate, imgDims, avifPicture } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(await readFile(join(ROOT, "data/types.json"), "utf8"));

const types = d.types || [];
if (types.length !== 11) throw new Error(`data/types.json has ${types.length} types, expected 11`);

// Set ids to their published names, read from the site's own set data rather
// than typed here, so the measurement note cannot name a set the site does not
// hold. Falls back to the id, which is ugly and honest.
let setName = (id) => id;
let setHref = () => null;
try {
  const s = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
  const byId = new Map((s.sets || []).map((x) => [x.id, x.name]));
  setName = (id) => byId.get(id) || id;
  setHref = (id) => (byId.has(id) ? `/sets/${id}.html` : null);
} catch {
  /* run: node scripts/sync-sets.mjs */
}

// Scans that 404, recorded by the fetch-everything pass. None of the twelve
// bases on this page is in there today, and this is here so that stays true
// without anybody rechecking by hand.
let noScan = new Set();
try {
  const ns = JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8"));
  noScan = new Set(ns.bases || []);
} catch {
  /* optional */
}

// ---------------------------------------------------------------------------
// THE MARKS.
//
// Drawn, following rarityMark() in shared/rarity.mjs. The `symbol` field in
// data/types.json describes what each mark looks like and its own note says it
// is "a plain description of what the mark looks like, written from the card
// scans", NOT an official name, so the page presents these as our drawings.
//
// The COLOURS are ours too and carry no meaning on their own: every mark is
// accompanied by the type's name in text, everywhere it appears.
const MARK = {
  grass: ["#4C8B3F", `<path d="M11 1C4.6 1 1 4.4 1 8.2c0 1.2.4 2.2 1 2.9C3.4 8 5.9 5.8 8.9 4.6 6.4 6.3 4.4 8.6 3.4 11.4c.6.4 1.4.6 2.2.6C9.2 12 11 8.6 11 1Z"/>`],
  fire: ["#D9482B", `<path d="M6 0C6 3.4 2.1 4.1 2.1 7.5A3.9 3.9 0 0 0 9.9 7.5C9.9 4.9 7.4 4.5 7.4 2.1 7.4 4 6 3.4 6 0Z"/>`],
  water: ["#2E7FB8", `<path d="M6 .6C6 .6 1.9 5.4 1.9 7.9a4.1 4.1 0 0 0 8.2 0C10.1 5.4 6 .6 6 .6Z"/>`],
  lightning: ["#E0A21F", `<path d="M7.6 0 2.4 6.9h2.9L4.6 12 9.9 4.8H6.6Z"/>`],
  psychic: ["#8A5BA6", `<circle cx="6" cy="6" r="2.6"/><ellipse cx="6" cy="6" rx="5.4" ry="2.2" fill="none" stroke-width="1" stroke="currentColor"/><ellipse cx="6" cy="6" rx="2.2" ry="5.4" fill="none" stroke-width="1" stroke="currentColor"/>`],
  fighting: ["#B0552A", `<path d="M2.2 6.1a1.2 1.2 0 0 1 1.2-1.2h4.3a3.1 3.1 0 0 1 3.1 3.1 3.1 3.1 0 0 1-3.1 3.1H3.4A1.2 1.2 0 0 1 2.2 9.9Z"/><path d="M3.6 4.9V3.3a1 1 0 0 1 2 0v1.6ZM6.2 4.9V2.6a1 1 0 0 1 2 0v2.3Z"/>`],
  darkness: ["#39394A", `<circle cx="6" cy="6" r="5.4"/><ellipse cx="6" cy="6" rx="3.6" ry="2" fill="#F1EDD2"/><circle cx="6" cy="6" r="1.1" fill="#39394A"/>`],
  metal: ["#7E8C99", `<path d="M6 0 7.3 3.1 10.5 1.5 8.9 4.7 12 6 8.9 7.3 10.5 10.5 7.3 8.9 6 12 4.7 8.9 1.5 10.5 3.1 7.3 0 6 3.1 4.7 1.5 1.5 4.7 3.1Z"/>`],
  colorless: ["#B9B08A", `<path d="M6 .6 7.6 4.3 11.6 4.6 8.5 7.2 9.5 11.1 6 9 2.5 11.1 3.5 7.2 .4 4.6 4.4 4.3Z"/>`],
  dragon: ["#A98B2E", `<path d="M6 2c3.2 0 5.6 2.6 5.6 4S9.2 10 6 10 .4 7.4 .4 6 2.8 2 6 2Z"/><path d="M6 3.4c.7 0 1.2 1.2 1.2 2.6S6.7 8.6 6 8.6 4.8 7.4 4.8 6 5.3 3.4 6 3.4Z" fill="#F1EDD2"/>`],
  fairy: ["#C86A9A", `<ellipse cx="6" cy="2.9" rx="1.7" ry="2.5"/><ellipse cx="6" cy="2.9" rx="1.7" ry="2.5" transform="rotate(72 6 6)"/><ellipse cx="6" cy="2.9" rx="1.7" ry="2.5" transform="rotate(144 6 6)"/><ellipse cx="6" cy="2.9" rx="1.7" ry="2.5" transform="rotate(216 6 6)"/><ellipse cx="6" cy="2.9" rx="1.7" ry="2.5" transform="rotate(288 6 6)"/>`],
};

const typeMark = (t) => {
  const m = MARK[t.id];
  if (!m) throw new Error(`types.json: type "${t.id}" has no drawn mark in MARK`);
  return `<span class="ty-m ty-m-${esc(t.id)}" aria-hidden="true"><svg viewBox="0 0 12 12" focusable="false">${m[1]}</svg></span>`;
};

// ---------------------------------------------------------------------------
// THE NOTES IN data/types.json ARE RESEARCH MEMOS ADDRESSED TO THIS FILE, NOT
// COPY, AND PRINTING THEM VERBATIM SHIPPED INSTRUCTIONS TO READERS.
//
// The first build of this page rendered every `weaknessNote`, `sets_note` and
// `openQuestions` entry straight through, so the live page carried sentences
// like "Do NOT let the page round this to Darkness is weak to Grass", "Say so
// on the page" and "THE BEST TEACHING CARD ON THE WHOLE PAGE". Those are notes
// to a builder. They read as an editor talking to themselves in public, and one
// of them literally instructs the reader not to say something.
//
// So the FACTS stay in the data file and the SENTENCES live here. Every entry
// below is a rewrite of the note with the same content, and the guard under it
// fails the build if the research file grows a note this file has no copy for.
// That is the point: a new note should stop the build until somebody writes the
// reader-facing version, rather than leaking the memo.
const COPY = {
  "water:weakness": "The quarter that print Metal instead are the Ice Pokemon. Ice is a Water card here, but it keeps the fear of Steel it has in the video games, and the cards call Steel Metal. Psychic, Fighting, Darkness and Colorless all split the same way, for the same kind of reason.",
  "psychic:weakness": "The Metal third are the Pokemon that are Fairy in the video games. Fairy fears Steel in the games, the cards call Steel Metal, and the weakness came along when the type was folded in.",
  // NOT "the only current type where printing a Resistance is the majority
  // case". The Metal section, six blocks down this same page, reports 83 of 90
  // Metal cards printing Grass -30, which is 92% against Psychic's 69%, and its
  // own copy line calls Metal "the only current type where essentially every
  // card prints a Resistance". Two exclusive claims about the same statistic,
  // both on one page, and the Psychic one is the one the page's own numbers
  // disprove. Psychic is still the interesting case because of WHY it splits.
  "psychic:resistance": "Printing a Resistance is the majority case here, and it splits the same way as the Weakness. The Ghost and Psychic ones carry Fighting -30 and the former Fairy ones carry nothing.",
  "fighting:weakness": "It splits by where the Pokemon came from. The Ground and Rock ones print Grass, the actual Fighting ones print Psychic. Both track the video games through the card game's own names, because Grass covers Bug as well as Grass and Ground and Rock fear both.",
  "fighting:resistance": "Not one of the 175 Fighting cards sampled printed a Resistance at all. That is a striking number, and it is exactly the sort of thing that could stop being true next set, which is why the count and the set list stay next to it.",
  "darkness:weakness": "This is the most split type on the page and the only one where the top answer is under half, which is why there is no honest way to round it to one answer. It splits by origin and both halves make sense. The Dark Pokemon print Grass, because Dark fears Bug in the games and Bug is a Grass card here. The Poison Pokemon print Fighting, because Poison fears Ground in the games and Ground is a Fighting card here.",
  "colorless:weakness": "Splits by origin again. The Normal Pokemon print Fighting, and the Flying ones print Lightning and carry Fighting -30, which is exactly the Flying profile from the games.",
  "colorless:special": "Two separate facts share this name and they are easy to merge. A Colorless Pokemon is a card with the star type. A Colorless symbol in an attack cost is a slot that any Energy card can fill. There is no basic Colorless Energy card, which is only confusing until you notice that the symbol means anything rather than a thing.",
  "dragon:weakness": "All 36 modern Dragon cards sampled print no Weakness and no Resistance at all. The bottom-left corner is simply empty. A universal type chart cannot describe a Pokemon that has no Weakness, so one Dragonite settles the question faster than a paragraph does. Bulbapedia dates the change to Evolving Skies.",
  "metal:resistance": "Metal is the only current type where essentially every card prints a Resistance.",
};

// The provenance line under each history block, same treatment. The data file's
// own `historySource` names its internal source keys and carries a FLAG in
// capitals, which is right for a research memo and wrong under a paragraph
// somebody is reading. What survives the rewrite is the part that matters: which
// half of each claim is measured here and which half rests on one source.
const HISTORY_SOURCE = {
  dragon:
    "Where this comes from: Bulbapedia. The dates of the two absences rest on Bulbapedia alone. The current state, " +
    "no Weakness and no Resistance printed, was counted here over 36 cards.",
  fairy:
    "Where this comes from: The Pokemon Company's January 2020 announcement, Bulbapedia, and the current official " +
    "rulebook, which still lists Fairy and notes that no Fairy cards appear in the Scarlet and Violet series while " +
    "they do exist in older expansions. The announcement itself could only be reached as a mirror, so every claim " +
    "taken from it was confirmed against the rulebook or against the cards before it went on this page.",
};

// The gaps, rewritten the same way. data/types.json lists six openQuestions and
// every one of them is phrased as an instruction to a researcher ("Either
// measure XY-era sets or say nothing"), which is the right shape for a memo and
// the wrong shape for a reader. Same six gaps, told to the person reading.
//
// This block is not decoration. Two of these are the reason a number is ABSENT
// from the page above, and a reader who cannot see why a row is empty will
// assume the page forgot.
const OPEN = [
  "Fairy's Weakness and Resistance are not measured here. None of the ten sets counted is old enough to hold a Fairy card, so this page publishes no figure for Fairy at all.",
  "Whether a Fairy card is legal in any sanctioned format today was not checked against the current Play Pokemon rotation, so this page says nothing about it either way.",
  "Bulbapedia dates the Dragon change, no Weakness and no Resistance printed, to Evolving Skies. The current state is confirmed here over 36 cards. The date is not.",
  "The Kalos Starter Set's release date is known only to the year, 2013, so no month is printed above.",
  "The original announcement of the Sword and Shield type changes could only be reached as a mirror. Everything it says is confirmed by the rulebook or by the cards, but the primary source is missing.",
  "The rulebook draws each type's symbol as a picture and no official name for each shape was established. The marks on this page are our own drawings and the descriptions of them are ours.",
];

// Every note in the data file must have a rewrite above. A note with no entry
// is a memo about to be published, so the build stops instead.
for (const t of types) {
  for (const [field, key] of [
    ["weaknessNote", "weakness"],
    ["resistanceNote", "resistance"],
    ["specialNote", "special"],
  ]) {
    if (t[field] && !COPY[`${t.id}:${key}`]) {
      throw new Error(
        `types.json: ${t.id} has a ${field} with no reader-facing rewrite in COPY in this file. ` +
          `Write one. Do not print the research note.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// A MEASURED TENDENCY, WITH ITS N, OR NOTHING.
//
// This is the honest replacement for a type chart and the whole reason the page
// can answer "what is it strong and weak against" at all. The rule from the
// plan, enforced here rather than trusted to a reader of a comment: render `n`,
// `count` and `pct` together or render none of them.
//
// Fairy is the case that makes this a guard rather than a style note. Its entry
// carries a `top` value with a null n, because none of the ten sampled sets is
// old enough to contain a Fairy card, and its own note says to publish no
// tendency. Pattern-matching the other ten rows into a number there is the
// exact failure this page exists to prevent, so a null n returns the note and
// never the value.
function tendency(t, kind) {
  const w = t[kind];
  if (!w) return "";
  const label = kind === "weakness" ? "Weakness" : "Resistance";
  // A null n means no tendency was measured, and the `top` value sitting beside
  // it is NOT publishable. Fairy is the only case today: none of the ten
  // sampled sets is old enough to hold a Fairy card. The value is never read
  // here, deliberately, so a future edit cannot reach it by accident.
  if (w.n == null) return "";
  if (typeof w.count !== "number" || typeof w.pct !== "number") {
    throw new Error(`types.json: ${t.id} ${kind} has an n but no count/pct, so it cannot be rendered honestly`);
  }
  // The data file writes an absence as "none printed", "no Weakness printed" or
  // "no Resistance printed", which are right in a data file and produce "print
  // none printed" in a sentence. The absence is a real and frequently the
  // MAJORITY answer here (every Fighting card, every Dragon card), so it has to
  // read as English rather than be dropped.
  const noun = kind === "weakness" ? "Weakness" : "Resistance";
  const value = (v) =>
    /^(none printed|no (Weakness|Resistance) printed)$/.test(v) ? `no ${noun} at all` : esc(v);
  const rest = (w.rest || [])
    .map(([lbl, c, p]) => `${value(lbl)} on ${c} (${p}%)`)
    .join(", ");
  const note = COPY[`${t.id}:${kind}`];
  return `<p class="ty-tend"><b>${label}.</b> Of the ${w.n} ${esc(t.name)} Pokemon cards measured,
        <b>${w.count} (${w.pct}%) print ${value(w.top)}</b>${rest ? `. The rest: ${rest}` : ""}.</p>${
    note ? `\n        <p class="ty-note">${esc(note)}</p>` : ""
  }`;
}

// The block that replaces the two tendency lines when nothing was measured.
// Fairy gets this instead of a number, and it says why rather than leaving a
// silent hole where every other type has a figure.
const UNMEASURED = `<p class="ty-tend ty-unmeasured"><b>Weakness and Resistance.</b> Not measured, and this page
                  publishes no figure for Fairy. None of the ten sets counted below is old enough to contain a
                  Fairy card, and filling the gap by pattern-matching the other ten types would be a guess wearing
                  a percentage sign. The card below prints Metal x2 and Darkness -20, and that is a statement about
                  that one card. Note the -20: it is a pre-Sword-and-Shield card, from back when Resistance was
                  -20 rather than -30, which is a second unforced demonstration that these values are printed
                  rather than fixed.</p>`;

// A card scan. TCGdex publishes exactly two widths off one path, low.webp at
// 245x337 and high.webp at 600x825, so the srcset has two candidates and no
// more: there is no middle width at any host and medium.webp, mid.webp and
// 600.webp all 404. imgDims decides the attributes rather than a hand-written
// pair; avifPicture adds the AVIF and leaves the WebP as the fallback.
function cardArt(ex, size) {
  const base = ex.img;
  if (noScan.has(base)) return "";
  const low = `${base}/low.webp`;
  const high = `${base}/high.webp`;
  return avifPicture(
    `<img src="${esc(low)}" srcset="${esc(low)} 245w, ${esc(high)} 600w" sizes="${size}px"` +
      ` alt="${esc(ex.card)}, ${esc(ex.set)} number ${esc(ex.number)}, a ${esc(ex.printedType)} card"` +
      ` loading="lazy" decoding="async" onerror="this.remove()"${imgDims(low)}>`
  );
}

// What ONE card prints, labelled as its own. This single caption is what stops
// the tendency above it reading as a law: the reader can see where the number
// comes from.
const printed = (ex) => {
  const bits = [];
  if (ex.printedWeakness) bits.push(`Weakness ${esc(ex.printedWeakness)}`);
  if (ex.printedResistance) bits.push(`Resistance ${esc(ex.printedResistance)}`);
  return bits.length
    ? `This card prints ${bits.join(" and ")}.`
    : `This card prints no Weakness and no Resistance at all.`;
};

function cardFig(ex, size, extraClass = "") {
  const art = cardArt(ex, size);
  if (!art) return "";
  const href = setHref(ex.set === "XY" ? "" : ex.set);
  const name = `${esc(ex.card)}`;
  return `<figure class="ty-fig ${extraClass}">
          ${art}
          <figcaption>
            <b>${name}</b>
            <span class="ty-cs">${href ? `<a href="${esc(href)}">${esc(setName(ex.set))}</a>` : esc(setName(ex.set))} #${esc(ex.number)}</span>
            <span class="ty-cp">${printed(ex)}</span>
            ${ex.verified ? `<span class="ty-cv">Type, Weakness and Resistance read off ${esc(ex.verified)}</span>` : ""}
          </figcaption>
        </figure>`;
}

// ---------------------------------------------------------------------------
// THE MAPPING TABLE, grouped by TCG type rather than listed alphabetically.
//
// Alphabetical would be easier to look one game type up in; grouped is the only
// arrangement that shows the COLLAPSE, which is the thing the reader has come
// here not knowing. Three video game types land on Fighting, two on Grass, two
// on Water, three on Psychic, two on Darkness and two on Colorless, and seeing
// them stacked is the argument.
const mapTable = d.mapping?.table || {};
const GAME_LABEL = { electric: "Electric", dark: "Dark", steel: "Steel", normal: "Normal" };
const gameLabel = (k) => GAME_LABEL[k] || k.charAt(0).toUpperCase() + k.slice(1);

const mappingRows = types
  .filter((t) => t.status === "current")
  .map((t) => {
    const rows = Object.entries(mapTable).filter(([, v]) => v.tcg === t.name);
    if (!rows.length) return "";
    return rows
      .map(
        ([k, v], i) => `        <tr>
          <th scope="row">${esc(gameLabel(k))}</th>
          <td>${i === 0 ? `${typeMark(t)}<b>${esc(t.name)}</b>` : `<span class="ty-same">${esc(t.name)}</span>`}</td>
          <td class="ty-n">${v.agree} of ${v.n} (${v.pct}%)</td>
          <td class="ty-x">${v.exception ? esc(v.exception) : ""}${v.note ? `${v.exception ? " " : ""}${esc(v.note)}` : ""}</td>
        </tr>`
      )
      .join("\n");
  })
  .filter(Boolean)
  .join("\n");

// ---------------------------------------------------------------------------
const meas = d.measurement || {};
const setList = (meas.sets || [])
  .map((id) => {
    const h = setHref(id);
    return h ? `<a href="${esc(h)}">${esc(setName(id))}</a>` : esc(setName(id));
  })
  .join(", ");

const corner = types.find((t) => t.id === "psychic");

const desc =
  "The Pokemon card game has 11 types, not the 18 from the video games. What each one is, " +
  "and why Weakness is printed on the card rather than on a chart.";
// Google truncates the snippet around 160 characters, so this is measured
// rather than hoped for. Same guard build-pack-prices.mjs carries.
if (desc.length > 160) throw new Error(`meta description is ${desc.length} characters, over 160:\n${desc}`);

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Card types" },
    ],
  },
];

const style = `
.ty-lede{max-width:46em}
.ty-key{display:flex;flex-wrap:wrap;gap:8px;margin:var(--s5) 0 var(--s4)}
.ty-key a{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.ty-key a:hover{border-color:var(--ink);background:var(--mustard)}
.ty-m{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex:0 0 18px}
.ty-m svg{width:15px;height:15px;display:block}
.ty-m-grass svg{fill:#4C8B3F;color:#4C8B3F}
.ty-m-fire svg{fill:#D9482B;color:#D9482B}
.ty-m-water svg{fill:#2E7FB8;color:#2E7FB8}
.ty-m-lightning svg{fill:#E0A21F;color:#E0A21F}
.ty-m-psychic svg{fill:#8A5BA6;color:#8A5BA6}
.ty-m-fighting svg{fill:#B0552A;color:#B0552A}
.ty-m-darkness svg{fill:#39394A;color:#39394A}
.ty-m-metal svg{fill:#7E8C99;color:#7E8C99}
.ty-m-colorless svg{fill:#B9B08A;color:#B9B08A}
.ty-m-dragon svg{fill:#A98B2E;color:#A98B2E}
.ty-m-fairy svg{fill:#C86A9A;color:#C86A9A}
.ty-key .ty-m svg{width:14px;height:14px}
.ty-grp{margin-top:var(--s6)}
.ty-grp > p{color:var(--ink-2);max-width:44em;margin-bottom:var(--s4)}
.ty-key-blk,.ty-t,.ty-meas{border:3px solid var(--navy);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4)}
.ty-key-blk{background:var(--navy);color:var(--chrome-ink);padding:var(--s5);margin:var(--s5) 0}
.ty-key-blk h2{color:var(--chrome-ink);margin-bottom:var(--s3)}
.ty-key-blk p{color:var(--foot-ink);line-height:1.55;max-width:44em}
.ty-key-blk p + p{margin-top:var(--s3)}
.ty-corner{display:grid;grid-template-columns:1fr 160px;gap:var(--s4);align-items:start;margin-top:var(--s4)}
@media(max-width:640px){.ty-corner{grid-template-columns:1fr}}
.ty-corner .ty-fig figcaption b,.ty-corner .ty-fig figcaption span{color:var(--foot-ink)}
/* The set link inside the caption is the one link on the page sitting on navy,
   so it needs its own colour: ui.css's link colour is the site's dark ink and
   would be invisible there. */
.ty-corner .ty-fig figcaption a{color:#EFC94C}
.ty-rules{list-style:none;margin:0;padding:0}
.ty-rules li{border-left:4px solid var(--gold);padding-left:var(--s3);margin-bottom:var(--s3);line-height:1.55}
.ty-rules b{display:block;font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.06em;
  text-transform:uppercase;margin-bottom:4px}
.ty-key-blk .ty-rules b{color:#EFC94C}
.ty-tbl-w{overflow-x:auto;margin-top:var(--s4);border:3px solid var(--navy);border-radius:12px;
  background:var(--card);box-shadow:var(--hard-lg)}
/* NO min-width ON THE TABLE. It had one, and at 390px that turned the highest
   search-value block on the page into a thing you have to drag sideways. Four
   short columns fit if nothing inside them is told not to wrap, which is why
   .ty-n lost its white-space:nowrap below. The overflow-x wrapper stays as the
   safety net: a long set name in a future note should scroll inside its own
   box rather than push the document sideways. */
.ty-tbl{width:100%;border-collapse:collapse;font-size:var(--t-sm)}
.ty-tbl th,.ty-tbl td{text-align:left;padding:10px var(--s3);border-bottom:1px solid var(--hair);vertical-align:top}
/* Four columns at 390px are 55px too wide on the site's normal cell padding
   alone, measured. Tightening the padding and dropping to the micro size is
   what brings the whole table inside the viewport instead of behind a sideways
   drag, and this is the one block on the page a phone reader is most likely to
   have come for. */
/* table-layout:fixed, so the columns are decided by these percentages and never
   by the longest word in a note. Without it the Flying and Poison notes, which
   are the two longest cells in the table, set the column widths for all 18
   rows and push the whole thing past 390px. */
@media(max-width:640px){
  .ty-tbl{font-size:var(--t-micro);table-layout:fixed}
  .ty-tbl th,.ty-tbl td{padding:8px 4px}
  .ty-x,.ty-n{word-break:break-word}
  .ty-tbl col.c1{width:19%}
  .ty-tbl col.c2{width:23%}
  .ty-tbl col.c3{width:22%}
  .ty-tbl col.c4{width:36%}
}
/* NO white-space:nowrap ON EITHER HEADER. Both carried it and both overlapped
   the moment the columns became fixed percentages at 390px: the four column
   labels ran together into one unreadable string. The media query below could
   not undo it either, because it sits earlier in this stylesheet and a media
   query adds no specificity, so the later rule won. Fixed at the source rather
   than with an override. */
.ty-tbl thead th{font:700 var(--t-micro)/1.2 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2)}
.ty-tbl tbody th{font-weight:700}
.ty-tbl td b{display:inline-flex;align-items:center;gap:6px}
.ty-same{color:var(--ink-2)}
.ty-n{color:var(--ink-2);font-size:var(--t-micro);line-height:1.5}
.ty-x{color:var(--ink-2);font-size:var(--t-micro);line-height:1.5}
.ty-list{display:flex;flex-direction:column;gap:var(--s4);margin-top:var(--s4)}
.ty-t{scroll-margin-top:var(--s5)}
.ty-th{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--s2);margin-bottom:var(--s2)}
.ty-th h3{font:400 var(--t-m)/1.15 var(--display);display:inline-flex;align-items:center;gap:8px}
.ty-th .ty-m{width:22px;height:22px;flex:0 0 22px}
.ty-th .ty-m svg{width:20px;height:20px}
.ty-badge{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  padding:5px 8px;border-radius:5px;border:1px solid var(--hair);color:var(--ink-2)}
.ty-badge.ret{border-style:dashed}
.ty-folds{font-size:var(--t-sm);color:var(--ink-2);margin-bottom:var(--s2)}
.ty-body{display:grid;grid-template-columns:1fr 150px;gap:var(--s4);align-items:start}
@media(max-width:640px){.ty-body{grid-template-columns:1fr}}
.ty-blurb{line-height:1.55;margin-bottom:var(--s3)}
.ty-tend,.ty-note,.ty-extra{font-size:var(--t-sm);line-height:1.5;margin-top:var(--s2)}
.ty-note,.ty-extra{color:var(--ink-2)}
.ty-unmeasured{border-left:4px solid var(--ketchup);padding-left:var(--s3)}
.ty-figs{display:flex;flex-wrap:wrap;gap:var(--s4)}
.ty-fig{margin:0;max-width:150px}
.ty-fig img{width:100%;height:auto;display:block;border-radius:6px}
.ty-fig figcaption{margin-top:6px;font-size:var(--t-micro);line-height:1.45}
.ty-fig figcaption b{display:block}
.ty-cs,.ty-cp,.ty-cv{display:block;color:var(--ink-2)}
.ty-cp{margin-top:3px;color:var(--ink)}
.ty-cv{margin-top:3px;font-size:10px;word-break:break-word}
.ty-split{border:3px solid var(--ketchup);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4);margin-top:var(--s4)}
.ty-split h4{font:400 var(--t-body)/1.25 var(--display);margin-bottom:var(--s2)}
.ty-split p{font-size:var(--t-sm);line-height:1.5;max-width:44em}
.ty-split .ty-figs{margin-top:var(--s3)}
.ty-meas{margin-top:var(--s6)}
.ty-meas p{font-size:var(--t-sm);line-height:1.55;max-width:46em}
.ty-meas p + p{margin-top:var(--s3)}
.ty-open{margin:var(--s4) 0 0 var(--s4);font-size:var(--t-sm);line-height:1.55;color:var(--ink-2);max-width:46em}
.ty-open li{margin-bottom:var(--s2)}
.ty-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s6);line-height:1.6;max-width:46em}

/* DESKTOP READING MEASURE. The caps above were written in em as if 1em were
   one character. It is not: these faces run 2.31 to 2.47 characters per em, so
   44 to 46em bought 100 to 106 real characters a line at 1440. ui.css already
   caps main prose at var(--measure) and these rules only outranked it by
   landing after the stylesheet. Everything here is min-width:1000, ui.css's
   own desktop breakpoint, so the phone and the tablet range keep exactly the
   rules they had. Each selector below was read on the page first: all six are
   ordinary paragraphs, no layout rows. */
@media(min-width:1000px){
.ty-lede,.ty-src{max-width:var(--measure)}
.ty-grp > p,.ty-key-blk p,.ty-split p,.ty-meas p{max-width:var(--measure)}
}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>What Are the Pokemon Card Types? All 11, Explained</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/types.html">
<meta property="og:title" content="What are the Pokemon card types?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/types.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-types.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-types.jpg">
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
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Card types</span></nav>
      <h1>What are the Pokemon <span class="hl">card types</span>?</h1>
      <p class="lede ty-lede">There are <b>11 of them on cards</b>, and the official rulebook says so in as many
        words. The video games have 18. That gap is not a mistake in either place: Bug is a Grass card, Ice is a
        Water card, Ground and Rock are both Fighting cards, Ghost is a Psychic card, and Poison has moved twice.
        If you learned types from the games, some of your cards are going to look wrong and they are not.</p>
      <p class="lede ty-lede">The other half of this page is the part nobody expects. <b>The card game has no type
        chart.</b> Weakness and Resistance are printed on each individual card, in the bottom-left corner, and
        plenty of cards print neither. So instead of a chart, every type below carries what its cards actually
        print, counted over ${meas.unique_pokemon_cards_with_a_type ? meas.unique_pokemon_cards_with_a_type.toLocaleString("en-US") : "1,446"}
        real cards, with the count next to it. The card in your hand is the authority.</p>

      <nav class="ty-key" aria-label="Jump to a type">
${types.map((t) => `        <a href="#${esc(t.id)}">${typeMark(t)}${esc(t.name)}</a>`).join("\n")}
      </nav>

      <section class="ty-grp">
        <h2>Your card's type is not its <span class="hl">video game</span> type</h2>
        <p>Which video game type lands on which card type, as things stand today. Checked twice: against
          Bulbapedia's table, and against the cards themselves. All 18 game types matched, with two individual
          exceptions out of the 628 cards that could be compared.</p>
        <div class="ty-tbl-w">
          <table class="ty-tbl">
            <caption class="sr-only">Video game types and the card type they are printed as</caption>
            <colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"></colgroup>
            <thead>
              <tr><th scope="col">In the games</th><th scope="col">On the card</th><th scope="col">Cards checked</th><th scope="col">Notes</th></tr>
            </thead>
            <tbody>
${mappingRows}
            </tbody>
          </table>
        </div>
        <p class="ty-note" style="margin-top:var(--s3)">${esc(d.mapping?.caveat_for_the_page || "")}</p>
      </section>

      <div class="ty-key-blk">
        <h2>There is no type chart in the card game</h2>
        <p>This is the sentence the rest of the page hangs off, so here it is on its own. The rulebook's own
          wording is "Some Pokemon have Weakness or Resistance to Pokemon of certain types", and its glossary
          entries for both end with the words "if any". Nothing in the game says Fire beats Grass. What a card is
          weak to is whatever that one card has printed on it, and the same Pokemon printed in a different set can
          say something else.</p>
        <div class="ty-corner">
          <ul class="ty-rules">
            <li><b>Where to look</b>The bottom-left corner of the card. Weakness first, Resistance after it, and a
              lot of cards carry one or neither.</li>
            <li><b>What Weakness does</b>The attack does more damage, and how much more is printed next to the
              symbol. On current cards that is x2, which doubles it. Older cards printed +10, +20 and +30 instead,
              so this is what today's cards print rather than a rule of the game.</li>
            <li><b>What Resistance does</b>The attack does less. Cards from the Sword and Shield series onward
              print -30. Before that it was -20 for over a decade, which you can see on the Fairy card further
              down this page.</li>
            <li><b>When neither applies</b>Never on a Benched Pokemon. Weakness and Resistance only touch the
              Active Pokemon.</li>
          </ul>
${corner ? cardFig(corner.example, 150) : ""}
        </div>
        <p>That card is doing two jobs at once. Gengar is a Ghost and Poison Pokemon in the video games and it is
          printed as a Psychic card, which is the shortest proof that the two systems are not the same one. It is
          also one of the few cards that prints both a Weakness and a Resistance, so its corner shows you both
          marks together.</p>
      </div>

      <section class="ty-grp">
        <h2>The <span class="hl">11 types</span>, and what their cards actually print</h2>
        <p>In the order The Pokemon Company numbers them on basic Energy cards, 001 Grass through 008 Metal, so a
          stack of Energy is already sorted this way. Colorless and Dragon follow because neither has a basic
          Energy card of its own. Fairy is last because it is retired. Every percentage below is a count of what
          is printed on cards, never a chance of pulling anything.</p>
        <div class="ty-list">
${types
  .map((t) => {
    const alt = t.exampleAlt;
    return `          <article class="ty-t" id="${esc(t.id)}">
            <div class="ty-th">
              <h3>${typeMark(t)}${esc(t.name)}</h3>
              ${t.status === "retired" ? `<span class="ty-badge ret">Retired${t.until ? `, ${esc(t.until)}` : ""}</span>` : ""}
              ${t.hasBasicEnergy === false ? `<span class="ty-badge">No basic Energy card</span>` : ""}
            </div>
            ${
              (t.gameTypes || []).length
                ? `<p class="ty-folds">In the video games: ${t.gameTypes.map(esc).join(", ")}.</p>`
                : `<p class="ty-folds">No video game type maps here any more.</p>`
            }
            <div class="ty-body">
              <div>
                <p class="ty-blurb">${esc(t.blurb)}</p>
                ${t.gameTypesNote ? `<p class="ty-note">${esc(t.gameTypesNote)}</p>` : ""}
                ${t.specialNote ? `<p class="ty-extra">${COPY[`${t.id}:special`]}</p>` : ""}
                ${t.weakness && t.weakness.n == null ? UNMEASURED : `${tendency(t, "weakness")}
                ${tendency(t, "resistance")}`}
              </div>
              <div class="ty-figs">
${alt ? "" : cardFig(t.example, 150)}
              </div>
            </div>
${
  alt
    ? `            <div class="ty-split">
              <h4>Same type, different printed Weakness</h4>
              <p>Here is the whole argument in two cards. Muk is a pure Poison Pokemon, Hydreigon ex is a Dark
                one, and both are printed as Darkness cards. One prints Fighting x2 and the other prints Grass x2.
                No chart can hold both, and no chart has to: the answer is printed on the card in your hand. Muk is
                a common out of a set we rip constantly, so this is a thing you can go and check.</p>
              <div class="ty-figs">
${cardFig(t.example, 150)}
${cardFig(alt, 150)}
              </div>
            </div>`
    : ""
}
          </article>`;
  })
  .join("\n")}
        </div>
      </section>

      <section class="ty-grp">
        <h2>Types that came and <span class="hl">went</span></h2>
        <p>Two types have a history worth knowing, because both explain a card that looks wrong and is not.</p>
        <div class="ty-list">
${types
  .filter((t) => t.history)
  .map(
    (t) => `          <article class="ty-t">
            <div class="ty-th"><h3>${typeMark(t)}${esc(t.name)}</h3>${
      t.since ? `<span class="ty-badge">Since ${esc(t.since)}</span>` : ""
    }</div>
            <p class="ty-blurb">${esc(t.history)}</p>
            ${HISTORY_SOURCE[t.id] ? `<p class="ty-note">${HISTORY_SOURCE[t.id]}</p>` : ""}
          </article>`
  )
  .join("\n")}
        </div>
        <p class="ty-note" style="margin-top:var(--s4)">This page says nothing about which tournament formats a
          Fairy card is legal in today, because that was not checked against the current Play Pokemon rotation. In
          a game at the kitchen table a Fairy card works exactly as printed. It is not a fake, not a misprint and
          not worthless.</p>
      </section>

      <div class="ty-meas">
        <h2>How the numbers on this page were <span class="hl">measured</span></h2>
        <p>${esc(meas.method || "")}</p>
        <p>Ten sets, run on ${esc(longDate(meas.run || d.checked))}: ${setList}. They run from Rebel Clash in 2020
          to Mega Evolution in 2025, so these numbers describe the modern game and not the whole history of the
          card game. A card from 2003 can and does say something different.</p>
        <p>${meas.cards_fetched ? `${meas.cards_fetched.toLocaleString("en-US")} cards were fetched and ` : ""}${
          meas.unique_pokemon_cards_with_a_type
            ? `${meas.unique_pokemon_cards_with_a_type.toLocaleString("en-US")} unique Pokemon cards with a printed type were counted. `
            : ""
        }Every percentage on this page is about what is <b>printed on cards</b>. None of it is about what comes out
          of a pack. We do not publish pull rates, because The Pokemon Company does not publish them either.</p>
        <h3 style="margin-top:var(--s5)">What this page does not know</h3>
        <ul class="ty-open">
${OPEN.map((q) => `          <li>${q}</li>`).join("\n")}
        </ul>
      </div>

      <section class="ty-grp">
        <h2>Still holding the card?</h2>
        <p>Three more pages read the same card from a different corner.
          <a href="/rarity.html">The rarity guide</a> reads the symbol next to the card number and tells you what
          is actually rare. <a href="/what-set.html">The set finder</a> takes the number printed after the slash
          and tells you which set it came from. And <a href="/start.html">Start here</a> is the whole run of
          questions in the order they come up.</p>
        <p>Or, since Weakness and Resistance only ever matter in a game:
          <a href="/how-to-play.html">how do you actually play?</a> Setup, a turn, and the three ways to win, for
          somebody who has only ever opened packs.</p>
      </section>

      <p class="ty-src">The count of 11 Energy types, the Weakness and Resistance wording and the Bench exemption
        come from the official Pokemon Trading Card Game rulebook. The video game mapping and the type histories
        come from Bulbapedia and were checked against real cards. Every percentage was measured from card records
        on ${esc(longDate(meas.run || d.checked))} and describes what is printed on cards, never what comes out of
        a pack. The type marks above are our own drawings, described from the card scans, and are not the official
        Energy symbols. Card scans and card data from TCGdex.</p>
    </div>
  </section>
</main>
${footer("Card scans and card data from TCGdex. Type marks drawn by us.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/types.html"), page);

const measured = types.filter((t) => t.weakness && t.weakness.n != null).length;
console.log(`Wrote public/types.html
  ${types.length} types (${measured} with a measured Weakness tendency, ${types.length - measured} without)
  ${types.reduce((n, t) => n + 1 + (t.exampleAlt ? 1 : 0), 0)} example cards, ${Object.keys(mapTable).length} game types mapped`);
