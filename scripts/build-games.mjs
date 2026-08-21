#!/usr/bin/env node
// Build /games/ : the hub, Who's That Pokemon, Guess the Set and the trivia.
//
//   node scripts/sync-pokedex.mjs   (first, writes data/pokedex.json)
//   node scripts/build-games.mjs    (this)
//
// Writes the pages AND the data they fetch, from one script on purpose: the
// question shapes and the JSON that feeds them have to agree, and splitting
// them means a change to one silently breaks the other.
//
// WHY GAMES ON A CARD SITE AT ALL. The specific brief is somebody waiting in line to
// buy cards, which is a real and very common few minutes of dead time, on a
// phone, one handed, on venue wifi. That is a genuinely different target from
// "a game page", and it is why the engine offers no typing, no forced timer in
// the default mode, and preloads the next image. See games.js and games.css,
// which both carry the same note, because the constraint is easy to design away
// by accident.
//
// EVERY ANSWER IS TRACEABLE. The trivia does not contain a single hand typed
// fact. Questions are GENERATED from data/pokedex.json (pokeapi.co) and from
// the card corpus this site already publishes, so an answer is wrong only if
// the source is wrong, and the source and its read date are printed on the
// page. Writing a few hundred questions by hand would have been faster and
// there would be no way for a reader to check any of them.
//
// SHIPPING WEIGHT IS THE OTHER CONSTRAINT. These are fetched over the same bad
// wifi, so the JSON is arrays-of-arrays rather than objects: naming every field
// on every one of 1,025 rows costs more than the rows do.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/games");
const DATA = join(ROOT, "public/data/games");
await mkdir(OUT, { recursive: true });
await mkdir(DATA, { recursive: true });

// ---------------------------------------------------------------------------
// PICTURES OF THE GAMES, which took some working out because there is no file
// in this tree that is one. Every other page here illustrates itself with a
// card scan, a set logo or a drawn figure; four <canvas> and live-DOM games
// have nothing to borrow, and the hub was the last page check-build.py named
// outright: 305 words and nothing visual in <main>.
//
// So the hub cards carry a screenshot of the game actually running, captured by
// scripts/sync-game-shots.mjs, and the two official app cards carry the app
// icon off that app's own store listing, which sync-app-shots.mjs already
// mirrors for /tcg-live.html and /tcg-pocket.html.
//
// BOTH MANIFESTS ARE OPTIONAL AND THE PAGE IS COMPLETE WITHOUT EITHER. A shot
// that has not been captured yet simply does not render, rather than emitting a
// broken box, because sync-game-shots.mjs needs a running preview server and a
// browser and is therefore NOT in build-all.mjs. A builder that fails when
// Chrome is missing would make the whole site unbuildable on a machine that
// only wants to fix a typo.
let gameShots = {};
try {
  gameShots = JSON.parse(await readFile(join(ROOT, "data/game-shots.json"), "utf8")).shots || {};
} catch {
  /* run: node scripts/sync-game-shots.mjs */
}
let appShots = {};
try {
  appShots = JSON.parse(await readFile(join(ROOT, "data/app-shots.json"), "utf8")).apps || {};
} catch {
  /* run: node scripts/sync-app-shots.mjs */
}

/**
 * One game screenshot, sized from the manifest.
 *
 * `eager` is the first TWO cards. This is a plain vertical list, so
 * `loading="lazy"` means what it says here, unlike the carousels on the home
 * page, and the cards below the second are genuinely a scroll away.
 *
 * IT SAID "THE FIRST CARD ONLY ... ABOUT 250px DOWN" AND BOTH HALVES WERE OUT
 * OF DATE. Re-measured over CDP at 390x844 DPR 2, reading each img's own border
 * box at scroll 0: card one starts at y=460 and card two at y=762, so TWO are
 * inside the 844px viewport. The second was being fetched at first paint anyway,
 * since lazy is a vertical heuristic and it is not below the fold; what the
 * attribute cost it was the preload scanner.
 *
 * fetchpriority="high" STAYS ON THE FIRST ONE ONLY. It is a ranking against the
 * other requests on the page and handing it to two elements ranks neither.
 */
const EAGER_GAME_CARDS = 2;
function gameShot(key, eager, lead = false) {
  const s = gameShots[key];
  if (!s) return "";
  // The alt comes out of the manifest rather than being written here, so there
  // is ONE description of each file and it lives next to the assertion that
  // keeps the file honest. Two copies is how a picture and its description
  // drift after somebody bumps the seed.
  return `<span class="g-shot"><img src="/assets/games/${esc(s.file)}" width="${s.w}" height="${s.h}"
          alt="${esc(s.shows)}" decoding="async"${eager ? (lead ? ' fetchpriority="high"' : "") : ' loading="lazy"'}></span>`;
}

/** The app's own store icon. The thing a reader is about to go and look for. */
function appIconTile(key) {
  const app = appShots[key];
  const icon = app && app.icon;
  if (!icon || !icon.file) return "";
  return `<span class="g-icon"><img src="/assets/apps/${esc(icon.file)}"${
    icon.w && icon.h ? ` width="${icon.w}" height="${icon.h}"` : ""
  } alt="The ${esc(app.name)} app icon" loading="lazy" decoding="async"></span>`;
}

const dex = JSON.parse(await readFile(join(ROOT, "data/pokedex.json"), "utf8"));
const pokemon = dex.pokemon;
// The mirrored official artwork /lore.html uses. OPTIONAL, exactly like the two
// screenshot manifests above: a page here that wants a picture of Trubbish and
// cannot find one prints the sentence without it rather than emitting a broken
// box, because sync-dex-art.mjs is another script that is not in build-all.mjs.
let dexArt = {};
try {
  dexArt = JSON.parse(await readFile(join(ROOT, "data/dex-art.json"), "utf8")).art || {};
} catch {
  /* run: node scripts/sync-dex-art.mjs */
}
const printings = JSON.parse(await readFile(join(ROOT, "public/data/printings/manifest.json"), "utf8"));

// ---------------------------------------------------------------------------
// Who's That Pokemon: id, name, generation. The artwork url is derived from the
// id in the browser rather than stored, because it is the same 80 character
// string 1,025 times and that is 80KB of nothing.
// ---------------------------------------------------------------------------
const whos = pokemon.map((p) => [p.id, p.name, p.gen]);
await writeFile(join(DATA, "dex.json"), JSON.stringify({ checked: dex.checked, pokemon: whos }));

// EVERY SPECIES IN THAT FILE MUST HAVE A 475px ARTWORK ON DISK, because
// whos-that-pokemon.html draws one per round out of /assets/species/lg/ and a
// missing file is a round with no picture in it: the silhouette never appears,
// the reveal reveals nothing, and nothing errors. Checked here rather than in
// the browser, and it throws rather than warning, because a game that is broken
// one round in a thousand is a game nobody can report.
//
// THE 256px RENDITION IS NOW UNDER THE SAME RULE, because pokemon-trivia.html
// draws one of those every round for the same reason and with the same silent
// failure. Two renditions, one loop, one error: a miss in either is fixed by
// running the same sync, and finding out about the second one on a later build
// would just be this check written twice.
const ART_DIRS = ["lg", ""];
for (const rend of ART_DIRS) {
  const dir = rend ? `public/assets/species/${rend}` : "public/assets/species";
  const missingArt = whos.map(([id]) => id).filter((id) => !existsSync(join(ROOT, `${dir}/${id}.webp`)));
  if (missingArt.length)
    throw new Error(
      `${missingArt.length} of ${whos.length} species have no ${dir}/<id>.webp ` +
        `(${missingArt.slice(0, 8).join(", ")}${missingArt.length > 8 ? ", ..." : ""}). ` +
        `Run: node scripts/sync-species-art.mjs`
    );
}

// ---------------------------------------------------------------------------
// Guess the Set: real card scans out of the corpus.
//
// ENGLISH ONLY, AND ONLY SETS WITH ENOUGH CARDS. A Japanese scan asks a
// different question (can you read the set symbol) and a set contributing three
// cards makes an unfair distractor, because the right answer would be a set the
// player has never been shown. 40 is the floor and each set is capped so one
// enormous set does not become the answer to a third of the questions.
// ---------------------------------------------------------------------------
const bySet = new Map();
for (const f of await readdir(join(ROOT, "public/data/printings"))) {
  if (!f.endsWith(".json") || f === "manifest.json") continue;
  for (const c of JSON.parse(await readFile(join(ROOT, "public/data/printings", f), "utf8"))) {
    if (c.l !== "en" || !c.g || !c.s || c.c !== "Pokemon") continue;
    // NO POKEMON TCG POCKET. The corpus includes 13 sets from the digital only
    // mobile game, which is 338 cards here, and they are the wrong answer to
    // this question twice over: nobody has ever seen one in a pack, and the
    // page's own pitch is that this teaches you to sort a bulk box. A quiz that
    // offers Eevee Grove against Neo Revelation is not hard, it is unfair.
    // The series id sits in the image path: .../en/tcgp/A1/023.
    if (/\/tcgp\//.test(c.g)) continue;
    if (!bySet.has(c.s)) bySet.set(c.s, []);
    bySet.get(c.s).push(c);
  }
}
const MIN_PER_SET = 40;
const CAP_PER_SET = 26;
const setNames = [];
const quizCards = [];
// The TCGdex series code, read straight out of the image url the card already
// carries: https://assets.tcgdex.net/en/<series>/<set>/<number>. Used below as
// the era key. It is taken from the path rather than matched on a set NAME
// because it covers all 131 sets with nothing to look up and nothing to guess,
// where matching names against the site's set list leaves 7 unmatched.
const setSeriesCode = [];
for (const [name, list] of [...bySet].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (list.length < MIN_PER_SET) continue;
  const idx = setNames.push(name) - 1;
  setSeriesCode[idx] = String(list[0].g).split("/")[4] || null;
  // Spread the sample across the set's numbering rather than taking the first
  // 26, so a set is not represented only by its commons.
  const step = Math.max(1, Math.floor(list.length / CAP_PER_SET));
  for (let i = 0, n = 0; i < list.length && n < CAP_PER_SET; i += step, n++) {
    quizCards.push([list[i].g, idx, list[i].n]);
  }
}

// ---------------------------------------------------------------------------
// ERAS, AND WHY THE QUIZ NEEDED THEM.
//
// Measured on 16 August 2026 over 20,000 generated questions: with distractors
// drawn uniformly from all 131 sets, THE CORRECT SET WAS THE ONLY ONE OF THE
// FOUR FROM ITS OWN ERA 76.4% OF THE TIME, and the mean gap between the oldest
// and newest of the four options was 16.9 years. So three questions in four
// could be won without looking at the set symbol at all: a 2024 card against
// three sets from 1999, 2007 and 2013 is answerable by anyone who can tell a
// modern card frame from a Base Set one, which takes about five minutes to
// learn. The page's own pitch is that it teaches you to read the SYMBOL, and it
// measurably was not asking.
//
// The fix is a second mode rather than a change to the only one, because the
// easy version is the right default for the brief this whole section is built
// around: somebody in a queue with a couple of minutes who has never sorted a
// bulk box. Same shape as the 151 / all 1,025 pair on Who's That Pokemon.
//
// Same era draws all three distractors from the answer's own series, widening
// to the neighbouring series only when its own holds fewer than MIN_ERA_POOL
// sets, which is what keeps Gym (2 sets) and Call of Legends (1) playable.
// Measured the same way: only-option-from-its-era falls 76.4% -> 4.8% and the
// mean year span 16.9 -> 1.8. At that spread the frame and the era tell you
// nothing and the symbol is all that is left, which is the point.
const EXP_ALIAS = {
  // The card corpus and the site's set list spell seven sets differently. Six
  // are one obvious string apart. MEP Black Star Promos has no entry at all,
  // which costs it a release year and nothing else: its era comes from the `me`
  // series code in its own image path, and the other Mega Evolution sets date
  // that era. Nothing is invented for it and no year is printed for it.
  "Base Set": "Base",
  "HeartGold SoulSilver": "HeartGold & SoulSilver",
  Triumphant: "HS—Triumphant",
  Undaunted: "HS—Undaunted",
  Unleashed: "HS—Unleashed",
  "SVP Black Star Promos": "Scarlet & Violet Black Star Promos",
};
const expansions = JSON.parse(await readFile(join(ROOT, "public/data/expansions.json"), "utf8"));
const expByName = new Map(expansions.sets.map((s) => [s.name, s]));
let SYMBOL_DIMS = {};
try {
  SYMBOL_DIMS = JSON.parse(await readFile(join(ROOT, "data/symbol-dims.json"), "utf8")).symbols || {};
} catch {
  /* not synced yet: the era table prints without symbols rather than breaking */
}
const setMeta = setNames.map((name, i) => {
  const e = expByName.get(name) || expByName.get(EXP_ALIAS[name]) || null;
  return {
    name,
    code: setSeriesCode[i],
    apiId: e ? e.apiId : null,
    series: e ? e.series : null,
    released: e ? e.released : null,
    year: e && e.released ? +String(e.released).slice(0, 4) : null,
  };
});
const cardsPerSet = new Array(setNames.length).fill(0);
for (const c of quizCards) cardsPerSet[c[1]]++;

const eraOf = new Map();
setMeta.forEach((m, i) => {
  if (!eraOf.has(m.code)) eraOf.set(m.code, []);
  eraOf.get(m.code).push(i);
});
// Oldest first, by the earliest traceable release inside the era. Ordering is
// what makes "widen to the neighbouring era" mean the adjacent years rather
// than an arbitrary alphabetical neighbour.
const eraCodes = [...eraOf.keys()].sort((a, b) => {
  const y = (k) => Math.min(...eraOf.get(k).map((i) => setMeta[i].year || 9999));
  return y(a) - y(b) || String(a).localeCompare(String(b));
});
const eras = eraCodes.map((code) => {
  const members = eraOf.get(code);
  const years = members.map((i) => setMeta[i].year).filter(Boolean);
  // The era's name is the one the site's own set list gives its members, by
  // majority, rather than a label typed here from the two-letter code.
  // AN ERA OF ONE SET IS CALLED AFTER THAT SET. The site's expansion list files
  // Legendary Collection under "Other" and Call of Legends under "HeartGold &
  // SoulSilver", both of which are what the source says and neither of which is
  // any use in this list: it produced a row labelled "Other" and a second row
  // labelled "HeartGold & SoulSilver" sitting nine years apart from the first
  // one. TCGdex gives them their own series code, so they are their own era
  // here, and the honest name for an era holding one set is that set's name.
  const names = {};
  for (const i of members) if (setMeta[i].series) names[setMeta[i].series] = (names[setMeta[i].series] || 0) + 1;
  const label =
    members.length === 1
      ? setMeta[members[0]].name
      : Object.keys(names).sort((a, b) => names[b] - names[a])[0] || code;
  // The mark that opens the era: its oldest set that has a mirrored symbol.
  const withSymbol = members
    .filter((i) => setMeta[i].apiId && SYMBOL_DIMS[setMeta[i].apiId])
    .sort((a, b) => String(setMeta[a].released).localeCompare(String(setMeta[b].released)));
  return {
    code,
    label,
    sets: members.length,
    cards: members.reduce((n, i) => n + cardsPerSet[i], 0),
    from: years.length ? Math.min(...years) : null,
    to: years.length ? Math.max(...years) : null,
    symbolOf: withSymbol.length ? withSymbol[0] : null,
  };
});
const setEra = setMeta.map((m) => eraCodes.indexOf(m.code));
const MIN_ERA_POOL = 6;

await writeFile(
  join(DATA, "setquiz.json"),
  JSON.stringify({
    checked: printings.checked,
    sets: setNames,
    // Era index per set, and the era order, oldest first. Two small arrays
    // rather than a field on every one of the 3,406 card rows, for the same
    // reason the rows are arrays: this file is fetched over a venue's wifi.
    eras: eraCodes,
    setEra,
    minEraPool: MIN_ERA_POOL,
    cards: quizCards,
  }),
);

// ---------------------------------------------------------------------------
// Trivia. Generated, never typed. Each row is
//   [question, correct, wrong1, wrong2, wrong3, note, askArt, tellArt]
// and `note` is what makes it worth getting wrong.
//
// THE LAST TWO ARE DEX IDS AND THEY ARE NOT INTERCHANGEABLE. 0 means no picture.
//   askArt  a portrait drawn WITH the question, from the first frame.
//   tellArt a portrait drawn ONLY once the answer is in.
// Which slot a category uses is decided by one test and nothing else: IS THE
// POKEMON IN THE PICTURE THE THING BEING ASKED FOR? If it is, the portrait is
// the answer and it can only go in tellArt; if the question already names it,
// the portrait is the question drawn instead of spelled, and it goes in askArt.
//
//   type       askArt   "What type is Braixen?" already says Braixen.
//   evolution  askArt   "Which Pokemon evolves into Jumpluff?" names Jumpluff;
//                       the answer is Skiploom, a different Pokemon.
//   genus      tellArt  the answer IS the Pokemon.
//   legendary  tellArt  the four Pokemon are the four CHOICES, so a portrait
//                       with the question would be the answer, in a picture.
//   weight     tellArt  same shape as legendary. This one was proposed as an
//                       askArt category and it cannot be: "Which of these is
//                       the heaviest?" names nobody, and the four candidates
//                       are the buttons.
//
// So every question carries exactly one portrait, which is what keeps the
// per-question fetch at one image, and 56.0% of the bank does not fetch it
// until the player has already committed to an answer.
// ---------------------------------------------------------------------------
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
/*
 * ONE SEEDED SOURCE OF RANDOMNESS FOR THIS FILE, and seeding it is the point.
 *
 * Math.random was used in two places: choosing the wrong answers for every
 * question, and shuffling the bank before trimming it to 1,400 of the 2,247
 * generated. Between them, identical input data produced different questions
 * AND different wrong answers on every build, rewrote a 300KB file each time,
 * and left the tree dirty after any build. Churn that size is where a real
 * change hides.
 *
 * Seeded off the Pokedex's own read date, so the output is stable for a given
 * input and moves when the data moves. Same reasoning as build-upcoming.mjs
 * taking "today" from the newest upload rather than from the clock.
 */
const seedFrom = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
let seed = seedFrom(`trivia:${dex.checked || "0"}`);
/** mulberry32. Small, fast, long enough period for a quiz bank. */
const nextRandom = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const rnd = (a) => a[Math.floor(nextRandom() * a.length)];
const sample = (pool, n, exclude) => {
  const seen = new Set(exclude);
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < pool.length * 10) {
    const v = rnd(pool);
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.length === n ? out : null;
};

const trivia = [];
// WHICH GENERATOR MADE EACH QUESTION, kept alongside rather than inside the row.
// The page needs the mix to be able to state it, and the row is a 6 element
// array replicated 1,400 times in a file fetched over a venue's wifi, so a
// seventh field costs the reader for something only the builder uses. Tagged at
// the point of generation rather than recovered afterwards by matching on the
// question text: two of the five categories produce a single identical stem, so
// text matching would work today and quietly stop the day a stem is reworded.
const triviaCat = [];
const push = (cat, row) => {
  trivia.push(row);
  triviaCat.push(cat);
};
const named = pokemon.filter((p) => p.genus);
const allNames = pokemon.map((p) => p.name);
const allTypes = [...new Set(pokemon.flatMap((p) => p.types))];
/** Name to National Pokedex number. evolvesFrom is stored as a NAME, so this is
 *  what lets the evolution note print the ANSWER's own number. */
const idByName = new Map(pokemon.map((p) => [p.name, p.id]));

// 1. Genus. The single best category: the answers are official, they are short,
// and they are frequently absurd. Trubbish is the Trash Bag Pokemon.
// A GENUS IS NOT UNIQUE, which makes the naive version of this question unfair.
// Parasect and Amoonguss are both officially the Mushroom Pokemon; Prinplup and
// Piplup are both the Penguin Pokemon. Drawing distractors at random produced
// five questions where a "wrong" answer was every bit as correct as the right
// one, and the player was marked down for knowing more. Everything sharing the
// genus is excluded from the distractors, so exactly one of the four on screen
// can be right.
const byGenus = new Map();
for (const p of named) {
  if (!byGenus.has(p.genus)) byGenus.set(p.genus, []);
  byGenus.get(p.genus).push(p.name);
}
for (const p of named) {
  const wrong = sample(named.map((x) => x.name), 3, byGenus.get(p.genus));
  if (!wrong) continue;
  push("genus", [`Which Pokemon is the ${p.genus} Pokemon?`, p.name, ...wrong, `#${p.id}, introduced in Generation ${p.gen}.`, 0, p.id]);
}

// 2. Type. Single typed only: a dual type has two right answers unless the
// question spells out the order, and a question that needs a rules lawyer is a
// bad question.
for (const p of pokemon.filter((x) => x.types.length === 1)) {
  const wrong = sample(allTypes, 3, p.types);
  if (!wrong) continue;
  push("type", [`What type is ${p.name}?`, cap(p.types[0]), ...wrong.map(cap), `${p.name} is pure ${cap(p.types[0])}.`, p.id, 0]);
}

// 3. Evolution, asked backwards. "What does X evolve into" has more than one
// answer for the branching lines; "what evolves INTO X" has exactly one.
for (const p of pokemon.filter((x) => x.evolvesFrom)) {
  const wrong = sample(allNames, 3, [p.name, p.evolvesFrom]);
  if (!wrong) continue;
  // THE NOTE USED TO PRINT THE WRONG POKEMON'S NUMBER, and it did it through a
  // ternary whose two branches were both the empty string:
  //     p.evolvesFrom + " is #" + (p.id - 1 > 0 ? "" : "") + p.id + "'s pre-evolution."
  // which read "Skiploom is #189's pre-evolution." #189 is Jumpluff, the
  // Pokemon the question had ALREADY named, so the one number on screen
  // belonged to the half of the pair the player did not have to work out, and
  // the answer they had just been given went unnumbered. A pre-evolution is
  // also not reliably id - 1, which is what the dead ternary was reaching for:
  // Pikachu is #25 and Pichu is #172. Looked up by name instead.
  const fromId = idByName.get(p.evolvesFrom);
  const note = fromId
    ? `${p.evolvesFrom} is #${fromId}. It evolves into ${p.name}, #${p.id}.`
    : `${p.evolvesFrom} evolves into ${p.name}, #${p.id}.`;
  push("evolution", [`Which Pokemon evolves into ${p.name}?`, p.evolvesFrom, ...wrong, note, p.id, 0]);
}

// 4. Legendary. One real legendary against three ordinary Pokemon.
// Iterated over the POKEMON rather than over their names, which is the only
// change here: the portrait needs the id and mapping the names back would be
// throwing it away and looking it up again.
const legends = pokemon.filter((p) => p.legendary);
const ordinary = pokemon.filter((p) => !p.legendary && !p.mythical).map((p) => p.name);
for (const p of legends) {
  const wrong = sample(ordinary, 3, [p.name]);
  if (!wrong) continue;
  push("legendary", [`Which of these is a Legendary Pokemon?`, p.name, ...wrong, `${p.name} is flagged Legendary in the National Pokedex.`, 0, p.id]);
}

// 5. Which is heavier. Four real Pokemon, pick the heaviest, with a wide enough
// gap that it is a fair question rather than a coin flip.
const weighed = pokemon.filter((p) => p.wHg > 0);
for (let i = 0; i < 220; i++) {
  const four = sample(weighed, 4, []);
  if (!four) continue;
  const sorted = [...four].sort((a, b) => b.wHg - a.wHg);
  if (sorted[0].wHg < sorted[1].wHg * 1.5) continue; // too close to be fair
  push("weight", [
    "Which of these is the heaviest?",
    sorted[0].name,
    sorted[1].name,
    sorted[2].name,
    sorted[3].name,
    `${sorted[0].name} weighs ${(sorted[0].wHg / 10).toFixed(1)}kg.`,
    0,
    sorted[0].id,
  ]);
}

// Interleave the categories so a run does not serve six genus questions in a
// row, then trim. The engine picks at random, but a lopsided bank still skews
// what a short session feels like.
// Fisher-Yates, which is an actual shuffle. The old one was
// `sort(() => Math.random() - 0.5)`: an inconsistent comparator, so the result
// was neither uniform nor defined across engines. It only ever looked random.
// Shuffle the INDICES, so the category tags follow their questions through the
// trim. Shuffling the rows on their own left triviaCat pointing at whatever
// happened to land in that slot, which is worse than having no tags at all: the
// mix printed on the page would have been wrong rather than missing.
const order = trivia.map((_, i) => i);
for (let i = order.length - 1; i > 0; i--) {
  const j = Math.floor(nextRandom() * (i + 1));
  [order[i], order[j]] = [order[j], order[i]];
}
order.length = Math.min(1400, order.length);
const shuffled = order.map((i) => trivia[i]);
const shuffledCat = order.map((i) => triviaCat[i]);
await writeFile(join(DATA, "trivia.json"), JSON.stringify({ checked: dex.checked, q: shuffled }));

// ---------------------------------------------------------------------------
// WHAT A RUN ACTUALLY FEELS LIKE, counted from the shipped bank rather than from
// the generators, because the bank is what a player is served and the trim is
// what decides the mix.
//
// It is lopsided, and the page says so. The comment above the shuffle claims the
// interleave stops "six genus questions in a row"; it does not, and cannot. A
// shuffle followed by a trim preserves the proportions of the pool exactly, and
// the engine then picks uniformly at random from what is left, so the mix below
// IS the mix a run gets. Measured on the shipped bank: genus 45.9%, evolution
// 22.1%, type 21.8%, weight 6.9%, legendary 3.2%.
//
// Printed rather than corrected. Flattening the five to 20% each would mean
// throwing away most of the genus bank, which is the best category on the page
// by a distance: the answers are official, they are short, and a third of them
// are funny. A reader is better served by being told what the mix is than by a
// mix chosen to look tidy in a table.
const CAT_LABEL = {
  genus: "The official category",
  type: "Type",
  evolution: "Evolution, backwards",
  legendary: "Legendary or not",
  weight: "Which is heaviest",
};
/** The field in data/pokedex.json the whole category is generated out of. */
const CAT_FIELD = {
  genus: "genus",
  type: "types",
  evolution: "evolvesFrom",
  legendary: "legendary",
  weight: "wHg",
};
const CAT_WHY = {
  genus:
    "Every Pokemon has an official one word category and most people have never read one. Anything sharing a category " +
    "is kept out of the wrong answers, so exactly one of the four on screen can be right.",
  type: "Single typed Pokemon only. A dual type has two right answers unless the question spells out the order.",
  evolution:
    "Asked backwards on purpose. What does this evolve into has more than one answer on the branching lines; what " +
    "evolves into this has exactly one.",
  legendary: "One Pokemon flagged Legendary in the National Pokedex against three that are not.",
  weight:
    "Four real Pokemon, pick the heaviest, and only when the top two are far enough apart that it is a question " +
    "rather than a coin flip.",
};
const catCount = {};
for (const c of shuffledCat) catCount[c] = (catCount[c] || 0) + 1;
/** The first question of each category in the shipped bank, quoted as the example. */
const catExample = {};
shuffledCat.forEach((c, i) => {
  if (!catExample[c]) catExample[c] = shuffled[i];
});
const catOrder = Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a]);
/** The mix, as one bar. Widths are the counts, so the picture cannot disagree.
 *
 * THE GROUND IS #2F4F39, NOT WHITE, SINCE 18 August 2026. This bar lives inside
 * .tq-fig, which is painted var(--paper-2), and under Trubbish Deep that token
 * is the card green. Four of the five tones were sampled for a cream figure and
 * measured 1.60, 1.32, 2.14 and 2.46 against it, all under the 3:1 gate WCAG
 * 1.4.11 sets for a chart mark; only #F5A62B survived, at 4.51. Each of the four
 * was raised in HSL with its HUE AND SATURATION HELD, to the lowest lightness
 * that clears 3.2, so the bar is the same five-colour idea at a legible weight
 * rather than a new palette:
 *     #616A4F -> #929E7C  1.60 -> 3.22   olive
 *     #F5A62B    unchanged       4.51    amber
 *     #22384F -> #779DC4  1.32 -> 3.22   the old navy
 *     #D9482B -> #E47C67  2.14 -> 3.21   red
 *     #7C8A5F -> #919F73  2.46 -> 3.22   sage
 *
 * AND LIFTING THEM ALL TO THE SAME GATE MAKES THEM THE SAME LUMINANCE, which is
 * the trap in doing this by ratio: neighbouring segments came out at 1.00:1
 * against EACH OTHER, so the bar would have read as one block with hue changes
 * a colour-blind reader could not see at all. There is no legend to lose (the
 * caption lists the categories in order, not by colour), so the boundaries are
 * what carry the picture, and they are drawn rather than implied: every segment
 * takes a 1.5 unit stroke in the figure's own background colour. Do not remove
 * that stroke to "clean up" the bar.
 */
const MIX_TONES = ["#929E7C", "#F5A62B", "#779DC4", "#E47C67", "#919F73"];
/** The .tq-fig background, repeated here because an SVG presentation attribute
 *  cannot take a custom property reliably. Keep in step with --paper-2. */
const FIG_BG = "#2F4F39";
const mixBar = (() => {
  let x = 0;
  const total = shuffled.length;
  const segs = catOrder.map((c, i) => {
    const w = (catCount[c] / total) * 480;
    const seg = `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="34" fill="${MIX_TONES[i % MIX_TONES.length]}" stroke="${FIG_BG}" stroke-width="1.5"/>`;
    x += w;
    return seg;
  });
  return `<svg viewBox="0 0 480 34" role="img" aria-label="${esc(
    catOrder.map((c) => `${CAT_LABEL[c]}, ${((catCount[c] / total) * 100).toFixed(1)} per cent`).join("; "),
  )}"><g>${segs.join("")}</g><rect x="0" y="0" width="480" height="34" rx="4" fill="none" stroke="#EEF1EF" stroke-width="3"/></svg>`;
})();

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
const GAMES_CSS = `<link rel="stylesheet" href="/assets/games.css">`;
const GAMES_JS = `<script src="/assets/games.js" defer></script>`;

// `compact` moves the explanatory copy BELOW the game and shrinks the header.
//
// MEASURED, NOT PREFERRED. With the site's standard hero the answer buttons
// landed at y=937 on a 375x812 phone, which is 125px below the fold: you had to
// scroll to play, every question. The hero was 319px of that on its own. A page
// whose entire premise is one thumb in a line cannot open below the fold, so
// the game goes first and the prose goes after it, where prose belongs on a
// page nobody came to read.
// THE H1 IS MARKUP AND og:title IS NOT. Every game h1 carries a `<span
// class="hl">` around the highlighted word, and escaping it into the meta tag
// published the tag itself: sharing /games/guess-the-set.html put
// `Guess the <span class="hl">set</span>` in the link preview on all four game
// pages. Strip the tags first, then escape the text that is left.
const plain = (html) => String(html).replace(/<[^>]+>/g, "");

// `extraCss` is an inline block in the head, NOT a rule added to games.css or
// ui.css. games.css is fetched by all five pages here and ui.css is render
// blocking on all 426, and the only page that wants these rules is the hub, so
// putting them anywhere shared would cost every other page in the site to save
// this one a few hundred bytes it does not save.
// `extra` is everything a game page says AFTER the game and after the one
// paragraph about it. It exists because the three quiz pages were 74, 87 and 91
// words with nothing visual in <main>, on a site whose owner's standard is that
// every page that can carry pictures should, and the honest reason they had
// none is harder than it looks: the obvious picture of a game is a screenshot of
// it, and a screenshot of a game directly above that same game, playable, is the
// one picture on this site worth least. The hub is where a screenshot earns its
// place, because there the game is not on the screen.
//
// So what goes here is not a picture OF the game, it is the material the game is
// made of: the set symbols Guess the Set is asking you to tell apart, the shape
// of the Pokedex Who's That Pokemon draws from, the five Pokedex fields every
// trivia question is generated out of. All of it is computed from the same JSON
// the game itself fetches, so a section here cannot describe a game that has
// moved on without it.
function shell({ slug, title, desc, h1, kicker, lede, body, extra = "", ld = [], extraJs = "", extraCss = "", compact = false }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/games/${slug}">
<meta property="og:title" content="${esc(plain(h1))}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/games/${slug}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg?v=2">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
${GAMES_CSS}
${extraCss ? `<style>${extraCss}</style>` : ""}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">

<header class="set-hero${compact ? " g-hero" : ""}">
  <div class="wrap">
    <span class="kicker">${kicker}</span>
    <h1>${h1}</h1>
    ${compact ? "" : `<p class="lede" style="max-width:38em">${lede}</p>`}
  </div>
</header>

${body}

${
  compact
    ? `<section class="band tight">
  <div class="wrap">
    <h2>About this <span class="hl">game</span></h2>
    <p class="lede" style="max-width:40em">${lede}</p>
  </div>
</section>`
    : ""
}
${extra}
</main>
${footer("Fan made games. Card data and Pokedex data credited on each page.")}
${APP_JS}
${GAMES_JS}
${extraJs}
</body>
</html>
`;
}

const crumb = (name) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Games", item: `${SITE}/games/` },
    ...(name ? [{ "@type": "ListItem", position: 3, name }] : []),
  ],
});

// ---------------------------------------------------------------------------
// THE SHARED STYLES FOR EVERYTHING IN AN `extra` BLOCK.
//
// Inline in each page's head, per the note on `extraCss` above, and NOT in
// games.css: games.css is also fetched by /lore.html, and ui.css is render
// blocking on all 426 pages. These rules are wanted by three pages, so a shared
// file would charge 423 pages for them.
//
// One string used by all three, so the three teaching sections cannot drift into
// three different looks. It is emitted verbatim, and it is small enough that the
// duplication across three pages is cheaper than a fourth request.
const TEACH_CSS = `
/* THE MODE BUTTONS HAD NO PRESSED STATE AND HAVE NEVER HAD ONE.
   ui.css styles .chip[aria-pressed=true] in three places and .btn in none, so
   Who's That Pokemon has shipped since it was written with two identical
   looking buttons, "The original 151" and "All 1,025", and no way to see which
   pool you were playing. Screen readers got it right the whole time, which is
   why it was easy to miss: the state was announced and never drawn.
   Guess the Set's new Any era / Same era pair is the same control, so this is
   fixed for both rather than added for one.
   Scoped to .btn-row so it cannot reach a .btn anywhere else on the site if
   these rules ever move out of a page's own head. */
.btn-row .btn[aria-pressed="true"]{background:var(--gold);border-color:var(--ink);
  color:var(--on-accent);box-shadow:0 3px 0 var(--ink)}
.btn-row .btn[aria-pressed="false"]{background:var(--card);color:var(--ink-2)}

.tq-grid{display:grid;gap:var(--s4);grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
  width:100%;min-width:0;margin-top:var(--s4)}
.tq-card{padding:var(--s4);background:var(--card);border:2px solid var(--ink);border-radius:var(--r)}
.tq-card h3{font:700 var(--t-sm)/1.3 var(--body);text-transform:uppercase;letter-spacing:.06em;
  color:var(--ink-2);margin-bottom:6px}
.tq-card p{font:400 var(--t-body)/1.5 var(--body);color:var(--ink)}
.tq-eg{display:block;margin-top:8px;font:400 var(--t-micro)/1.5 var(--mono);color:var(--ink-2)}

/* THE FIGURES CARRY THEIR OWN CAPTION AND THE CAPTION IS THE SOURCE. Every
   drawing in these blocks is generated from a file in this repo, so the caption
   says which one. A picture on this site that cannot name where its numbers came
   from is the thing check-build.py's density table is trying to get rid of, and
   adding an unsourced one to fix the count would be worse than the empty page. */
.tq-fig{margin:var(--s4) 0 0;padding:var(--s4);background:var(--paper-2,#2F4F39);
  border:2px solid var(--ink);border-radius:var(--r)}
.tq-fig svg{display:block;width:100%;height:auto;max-width:520px;margin:0 auto}
/* THE INK OF THE TWO GENERATED DIAGRAMS INSIDE .tq-fig. They are inline SVG, so
   a fill= attribute cannot hold a custom property reliably and the ink lives
   here instead. The ground is .tq-fig's own background, var(--paper-2): --ink
   measures 8.03:1 on it, which clears 4.5:1 for the labels and 3:1 for the
   outlines. FALLBACK VALUES: the two above were #F7F2DE, a cream sampled from
   the old palette, and a fallback is exactly where a repaint fails silently,
   because it only shows up if the token is ever missing. Keep them in step with
   --paper-2 whenever the palette moves. */
.tq-d{fill:none;stroke:var(--ink)}
.tq-df{fill:var(--ink)}
.tq-dt{fill:var(--ink);font-family:ui-monospace,monospace;font-weight:700}
.tq-don{stroke:var(--on-accent)}
.tq-fig figcaption{margin-top:var(--s3);font:400 var(--t-micro)/1.5 var(--mono);color:var(--ink-2);
  text-align:center}

/* The era table. A LIST, not a table element: every row is symbol, name, years,
   counts, and on a 390px phone the years and the counts have to drop under the
   name rather than squeeze a fourth column to nothing. */
.tq-eras{display:grid;gap:8px;margin-top:var(--s4);list-style:none;padding:0}
.tq-era{display:grid;grid-template-columns:34px 1fr auto;gap:var(--s3);align-items:center;
  padding:8px 10px;background:var(--card);border:1px solid var(--hair);border-radius:10px}
.tq-era img{width:26px;height:26px;object-fit:contain;display:block;margin:0 auto;
  background:var(--paper-2,#2F4F39);border-radius:5px}
.tq-era .tq-noimg{width:26px;height:26px;display:block;margin:0 auto;border-radius:5px;
  border:1px dashed var(--hair)}
.tq-era b{font:700 var(--t-sm)/1.25 var(--body);color:var(--ink);display:block}
.tq-era span{font:400 var(--t-micro)/1.4 var(--mono);color:var(--ink-2)}
.tq-era em{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);font-style:normal;
  text-align:right;white-space:nowrap}

/* Pokemon with their official category. The artwork is the mirrored 128px file
   /lore.html already ships, not the 475px PokeAPI png the game itself pulls: at
   72px on a phone the big one is a 6x oversample of a picture nobody is playing
   with. */
.tq-dex{display:grid;gap:var(--s3);grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
  margin-top:var(--s4);list-style:none;padding:0}
.tq-dexi{display:flex;gap:var(--s3);align-items:center;padding:8px 10px;background:var(--card);
  border:1px solid var(--hair);border-radius:10px}
.tq-dexi img{width:56px;height:56px;object-fit:contain;flex:none}
.tq-dexi b{display:block;font:700 var(--t-sm)/1.2 var(--body);color:var(--ink)}
.tq-dexi span{display:block;font:400 var(--t-micro)/1.4 var(--mono);color:var(--ink-2)}

.tq-links{display:flex;flex-wrap:wrap;gap:var(--s2);margin-top:var(--s4);padding:0;list-style:none}
.tq-links a{display:inline-block;padding:9px 14px;background:var(--card);border:2px solid var(--ink);
  border-radius:var(--r-pill);box-shadow:0 3px 0 var(--ink);text-decoration:none;color:var(--ink);
  font:700 var(--t-sm)/1.2 var(--body)}
.tq-links a:hover{background:var(--mustard);color:var(--on-accent)}

/* The one file drawn twice. The FIRST of the pair carries the filter, which is
   the same brightness(0) games.css puts on the live game, written here rather
   than reused from .gq-sil because that class is the game's and this figure is
   not the game. */
.tq-silpair{display:flex;gap:var(--s5);align-items:flex-end;justify-content:center}
.tq-silpair span{display:block;text-align:center}
.tq-silpair img{display:block;width:112px;height:112px;object-fit:contain}
.tq-silpair span:first-child img{filter:brightness(0)}
.tq-silpair b{display:block;margin-top:6px;font:700 var(--t-micro)/1.4 var(--mono);
  letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
`;

/**
 * One mirrored set symbol, at its real size. Same manifest and the same
 * degrade-to-nothing rule as /what-set.html: a set with no local file gets a
 * dashed placeholder box rather than a hole, so the row keeps its shape and no
 * request is opened to a host we do not control from a page about a game.
 */
function symbolCell(setIndex) {
  const m = setIndex === null || setIndex === undefined ? null : setMeta[setIndex];
  const d = m && m.apiId ? SYMBOL_DIMS[m.apiId] : null;
  if (!d) return `<span class="tq-noimg" aria-hidden="true"></span>`;
  return `<img src="/assets/symbols/${esc(m.apiId)}-pokemon-tcg-set-symbol.webp" width="${d[0]}" height="${d[1]}"
    alt="The set symbol printed on ${esc(m.name)} cards" loading="lazy" decoding="async">`;
}

/**
 * ONE FILE, DRAWN TWICE, which is the whole claim the sentence beside it makes.
 *
 * This is NOT a screenshot of Who's That Pokemon and the difference is the point:
 * there is no question, no four answers and no score, because a picture of the
 * game sitting directly above the same game, playable, is the least useful
 * picture this site could carry. What it shows is the MECHANISM, and the
 * mechanism is the surprising part. The claim "there is no second set of images"
 * is not one a reader has any reason to take on trust, and this is the evidence:
 * the same src twice, with one CSS filter between them.
 *
 * The mirrored 128px artwork /lore.html already ships, not the 475px PokeAPI png
 * the game pulls at runtime, so this costs the page one small local file rather
 * than a request to a host we do not control.
 */
function silhouetteDemo(id) {
  const p = pokemon.find((x) => x.id === id);
  const a = dexArt[String(id)];
  if (!p || !a) return "";
  return `<figure class="tq-fig tq-sil">
      <div class="tq-silpair">
        <span><img src="${esc(a.file)}" width="${a.w}" height="${a.h}" alt="The same artwork blacked out to a silhouette"
          loading="lazy" decoding="async"><b>filtered</b></span>
        <span><img src="${esc(a.file)}" width="${a.w}" height="${a.h}" alt="Official artwork of ${esc(p.name)}"
          loading="lazy" decoding="async"><b>as it ships</b></span>
      </div>
      <figcaption>Both of those are ${esc(a.file)}, the same file, requested once. The left one has
        brightness(0) on it and nothing else.</figcaption>
    </figure>`;
}

/** A row of Pokemon with the official category the trivia asks about. */
function dexRow(ids) {
  const byId = new Map(pokemon.map((p) => [p.id, p]));
  return ids
    .map((id) => {
      const p = byId.get(id);
      const a = dexArt[String(id)];
      if (!p || !a) return "";
      return `<li class="tq-dexi"><img src="${esc(a.file)}" width="${a.w}" height="${a.h}"
        alt="Official artwork of ${esc(p.name)}" loading="lazy" decoding="async">
        <span><b>${esc(p.name)}</b><span>the ${esc(p.genus)} Pokemon</span></span></li>`;
    })
    .filter(Boolean)
    .join("\n      ");
}

// --- Hub -------------------------------------------------------------------
// The fifth field is the screenshot key in data/game-shots.json. Its alt text
// is NOT here: it comes from that manifest, written by the script that took the
// picture, because a description in one file and a picture in another drift.
//
// THAT ALT DESCRIBES THE SHAPE OF THE SCREEN, NOT WHAT IS ON IT, deliberately.
// "A Pinsir silhouette" is true of today's capture and false the moment anybody
// reruns the sync with a different seed, and a description that only stays true
// by luck is exactly what this site's image rule exists to stop. What does not
// change is that the screen is a picture above four answer buttons, so that is
// what it says. sync-game-shots.mjs asserts that much before it keeps a file.
const CARDS = [
  // FIRST ON PURPOSE. Three of the other four are quizzes, which are things you
  // finish. This hub is called "Games for the wait" and the longest wait wants
  // the game you can keep playing and hand to somebody else.
  ["garbage-run.html", "Arcade", "Garbage Run", "One thumb, no rules to read. Flip Trubbish between the floor and the ceiling and eat everything on the street. A hundred pieces of trash and he evolves.",
    "garbage-run"],
  // SECOND, ABOVE THE QUIZZES, FOR THE SAME REASON GARBAGE RUN IS FIRST: it is
  // a game rather than a test, so it is the other one somebody can start
  // without deciding whether they know enough to enjoy it. It is also the only
  // one on this hub whose pool is a page the site already publishes, which is
  // the sentence the blurb spends its length on.
  ["chase-match.html", "Memory", "Chase Match", "Cards face down, tap two, keep the pairs. The deck is the 100 most valuable ungraded cards in Pokemon, so every match is a card you will probably never hold.",
    "chase-match"],
  ["whos-that-pokemon.html", "Silhouettes", "Who's That Pokemon?", `Name the shape. All ${whos.length.toLocaleString("en-US")} of them, or just the original 151.`,
    "whos-that-pokemon"],
  ["guess-the-set.html", "Card scans", "Guess the Set", `A real card, four sets, one right answer. ${setNames.length} sets in the pot.`,
    "guess-the-set"],
  ["pokemon-trivia.html", "Quiz", "Pokemon Trivia", `${shuffled.length.toLocaleString("en-US")} questions, all generated from real Pokedex and card data.`,
    "pokemon-trivia"],
];

/**
 * Styles for the hub's pictures only. Inline, per the note on `extraCss`.
 *
 * THE SHOTS KEEP THEIR OWN SHAPE rather than being cropped to a common box.
 * They are between 0.61 and 0.73 wide-to-tall because that is what a game built
 * for one thumb on a phone looks like, and forcing them all through an
 * `object-fit: cover` window would cut the answer buttons off three of the four
 * and turn the picture into a detail shot of the thing you are supposed to be
 * choosing between. Width and height are on every img, so nothing reflows while
 * they load even though the four heights differ.
 */
// A CARD WITH A SHOT IS TWO COLUMNS, not a picture stacked over the text, and
// that is a measured decision rather than a taste one. Full width was tried
// first and it is the better looking of the two: the shot draws 312px on a
// phone and every one of them is properly legible. It also took the hub from
// 2,996px tall to 6,383px at 390x844, which is six screens to choose between
// four games, on the one page whose entire premise is somebody standing in a
// queue with a couple of minutes. At 143px the shots still say what each game
// looks like, which is all the reader is here for, and the page comes back to
// roughly what it was.
const HUB_CSS = `
.g-shot{display:block;margin:0;border:2px solid var(--ink);border-radius:10px;
  overflow:hidden;background:var(--page);line-height:0}
.g-shot img{display:block;width:100%;height:auto}
.g-card.has-shot{display:grid;grid-template-columns:min(46%,190px) 1fr;
  column-gap:var(--s4);align-items:start}
/* The shot sits beside all three text rows. Named lines would be tidier, but
   a span survives a fourth line being added to the card and a fixed 1 / 4
   does not. */
.g-card.has-shot .g-shot{grid-column:1;grid-row:1 / span 3}
.g-card.has-shot .g-tag,.g-card.has-shot h2,.g-card.has-shot p{grid-column:2}
/* A grid item stretches its cell, so the tag pill ran the full width of the
   text column and stopped reading as a pill. It is inline-block everywhere
   else on the site and this puts it back. */
.g-card.has-shot .g-tag{justify-self:start}
.g-icon{display:block;margin:0 0 12px}
.g-icon img{display:block;width:56px;height:56px;border-radius:13px;
  border:1px solid var(--hair);background:var(--card)}`;

const hub = shell({
  slug: "",
  title: "Pokemon Games to Play in Line | Garbage Rips 585",
  // NAME ALL FIVE, IN THE ORDER THE PAGE LEADS WITH THEM. This listed three of
  // five for as long as the hub had five: Garbage Run and Chase Match, the two
  // cards at the top of the page, were both missing from the copy Google shows.
  // Same failure as "The four pictures above" below -- a sentence written when
  // the count was three and never recounted. Kept to ~175 characters, which is
  // long-normal for this site (median 141, longest 270) and short enough that
  // the arcade run and the memory board both land ahead of the cut.
  desc: `Quick Pokemon games for your phone: a Trubbish arcade run, a memory board dealt from the 100 most valuable cards, silhouettes, card scans, and ${shuffled.length.toLocaleString("en-US")} trivia questions. No sign up, no app.`,
  h1: `Games for the <span class="hl">wait</span>`,
  kicker: "585 &bull; Something to do in line",
  lede:
    "Built for the twenty minutes you spend waiting to get to the counter. One thumb, no sign up, nothing to install, " +
    "and nothing lost if the line moves and you have to stop.",
  ld: [crumb(null)],
  extraCss: HUB_CSS,
  body: `<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Games</p>
    <div class="g-list">
      ${CARDS.map(
        // h2, NOT h3. The three game names are the only headings on this hub
        // under the h1, so an h3 announced a level 3 heading with no level 2
        // above it and left a screen reader user looking for the section that
        // was skipped. The individual game pages already open their body copy
        // with an h2, so the hub was the odd one out.
        // `.g-card h2` in public/assets/games.css carries the same declaration
        // `.g-card h3` did, so this renders identically.
        ([href, tag, name, blurb, shotKey], i) => `<a class="g-card${
          gameShots[shotKey] ? " has-shot" : ""
        }" href="/games/${href}">
        ${gameShot(shotKey, i < EAGER_GAME_CARDS, i === 0)}
        <span class="g-tag">${esc(tag)}</span>
        <h2>${esc(name)}</h2>
        <p>${esc(blurb)}</p>
      </a>`,
      ).join("\n      ")}
    </div>
    <h2 style="margin-top:var(--s6)">The two official <span class="hl">apps</span></h2>${/* "in the queue" is British and this page says "line" three other times:
         "waiting to get to the counter", "nothing lost if the line moves", and
         /games/garbage-run.html is subtitled "for the restock line". American
         English only, and the page was already disagreeing with itself. */ ""}
    <p class="lede" style="max-width:46em">Ours are for the twenty minutes in line. These two are the real card
      game, both free, both from Pokemon, and both tied to the packs on this channel. The code card in every booster
      goes into one of them.</p>
    <div class="g-list">
      <a class="g-card" href="/tcg-live.html">
        ${appIconTile("live")}
        <span class="g-tag">Official</span>
        <h2>Pokemon TCG Live</h2>
        <p>The full card game, same rules as the cards in your hand. It is where the code card from a booster pack
          gets redeemed, and what that code actually gives you is not what most people assume.</p>
      </a>
      <a class="g-card" href="/tcg-pocket.html">
        ${appIconTile("pocket")}
        <span class="g-tag">Official</span>
        <h2>Pokemon TCG Pocket</h2>
        <p>The casual one, and the easier place to learn: shorter matches on a deliberately simplified ruleset, so what
          it teaches you carries over only so far. Your pack codes do not work here.</p>
      </a>
    </div>
    <p class="price-note" style="margin-top:var(--s5)">${
      /* THE COUNT IS COUNTED. This read "The four pictures above" and a fifth
         game went in under it, which is exactly the kind of sentence this
         file's own alt-text rule exists to stop: true on the day it was written
         and quietly false afterwards. It also no longer says "the question in
         each one", because one of these games does not ask a question. */
      Object.keys(gameShots).length === 1
        ? `The picture above is a screenshot of that game running in a browser at phone width, taken from its own
      page, not a mock up. What is on the screen is whatever came up. `
        : Object.keys(gameShots).length
          ? `The ${
              ["", "one", "two", "three", "four", "five", "six", "seven", "eight"][
                Object.keys(gameShots).length
              ] || Object.keys(gameShots).length
            } pictures above are screenshots of these games running in a browser at phone width, taken from these
      pages, not mock ups. What is on each screen is whatever came up. `
          : ""
    }${
      appShots.live && appShots.pocket
        ? `The two app icons are from each app's own App Store listing. `
        : ""
    }Your best scores are saved on this device only. There is no
      account and no leaderboard, because the site is a set of static files with nowhere to store one.
      Pokedex data from pokeapi.co, read ${esc(longDate(dex.checked) || dex.checked)}. Card scans from TCGdex.
      Pokemon and all Pokemon names are trademarks of The Pokemon Company. This is fan content.</p>
  </div>
</section>`,
});
await writeFile(join(OUT, "index.html"), hub);

// --- Who's That Pokemon ----------------------------------------------------
//
// THE LADDER IS WHAT THE TWO MODE BUTTONS MEAN. The page offers "the original
// 151" and "all 1,025" and never says what the difference is beyond the count,
// which makes the second button a number rather than a decision. Nine
// generations is the actual answer, and the shape of them is not what most
// people expect: generation 5 is bigger than generation 1, and generation 6 is
// less than half of it.
//
// Counted here, from the same data/pokedex.json the game itself is built from,
// so the bars cannot disagree with the pool.
const genCounts = [];
for (const p of pokemon) genCounts[p.gen] = (genCounts[p.gen] || 0) + 1;
const gens = genCounts.map((n, i) => ({ gen: i, n })).filter((g) => g.gen > 0);
const genMax = Math.max(...gens.map((g) => g.n));
/**
 * The ladder, drawn. One bar per generation, labelled with its own count, and
 * generation 1 marked because it is the other button.
 *
 * A viewBox and no width, so it scales to the column: the figure's CSS caps it
 * at 520px and lets it shrink to a 350px phone without a media query. Every
 * number in it is `gens`, so nothing here is typed.
 *
 * REPAINTED 18 August 2026 FOR THE SAME REASON THE MIX BAR WAS: .tq-fig is
 * var(--paper-2), which is #2F4F39 now. #1E2419 was the outline AND both label
 * inks and measured 1.74:1 on it, and the plain bars' #616A4F was 1.60. The
 * inks go to the page's own: #EEF1EF (--ink) is 8.03:1 for the counts and the
 * outlines, #C9D1CC (--ink-2) is 5.86:1 for the axis word, which keeps the
 * strong/muted pair #1E2419 and #4A5140 were drawing. The plain bars take the
 * mix bar's lifted olive #929E7C at 3.22:1. Gen 1 keeps #F5A62B at 4.51:1: it
 * is a CHART TONE and not the retired --gold token, and it is the one colour
 * here that already cleared the gate. Literals rather than var(), because these
 * are SVG presentation attributes.
 */
const BAR_W = 46;
const BAR_GAP = 6;
const LADDER_H = 150;
const genLadder = `<svg viewBox="0 0 ${gens.length * (BAR_W + BAR_GAP)} 218" role="img"
  aria-label="Bar chart of Pokemon species per generation: ${gens
    .map((g) => `generation ${g.gen}, ${g.n}`)
    .join("; ")}. Generation 1 is the 151 pool.">
  ${gens
    .map((g, i) => {
      const h = Math.round((g.n / genMax) * LADDER_H);
      const x = i * (BAR_W + BAR_GAP);
      const y = 24 + (LADDER_H - h);
      return `<rect x="${x}" y="${y}" width="${BAR_W}" height="${h}" rx="4" fill="${
        g.gen === 1 ? "#F5A62B" : "#929E7C"
      }" stroke="#EEF1EF" stroke-width="2"/>
  <text x="${x + BAR_W / 2}" y="${y - 6}" text-anchor="middle" font-family="ui-monospace,monospace"
    font-size="13" font-weight="700" fill="#EEF1EF">${g.n}</text>
  <text x="${x + BAR_W / 2}" y="${24 + LADDER_H + 18}" text-anchor="middle" font-family="ui-monospace,monospace"
    font-size="12" font-weight="700" fill="#EEF1EF">${g.gen}</text>`;
    })
    .join("\n  ")}
  <!-- The axis word sat at x=0 y=196, level with the tick labels, and ran
       straight through the "2" under the second bar. It gets its own line. -->
  <text x="${(gens.length * (BAR_W + BAR_GAP) - BAR_GAP) / 2}" y="212" text-anchor="middle"
    font-family="ui-monospace,monospace" font-size="12" font-weight="700" fill="#C9D1CC">generation</text>
</svg>`;

const whosPage = shell({
  slug: "whos-that-pokemon.html",
  compact: true,
  title: "Who's That Pokemon? Silhouette Quiz | Garbage Rips 585",
  desc: `Name the Pokemon from its silhouette. Play the original 151 or all ${whos.length.toLocaleString("en-US")}, free, on your phone, no sign up.`,
  h1: `Who's that <span class="hl">Pokemon?</span>`,
  kicker: "Silhouettes &bull; 151 or all of them",
  lede: "Four answers, one shape. Get it wrong and the name comes up so you learn it. Your streak is saved on this device.",
  ld: [crumb("Who's That Pokemon?")],
  extraCss: TEACH_CSS,
  extra: `<section class="band tight">
  <div class="wrap">
    <h2>What the two buttons actually <span class="hl">change</span></h2>
    <p class="lede" style="max-width:44em">The original 151 is generation 1, all of it and nothing else. The other
      button opens the pool to nine generations, and they are not the same size as each other. Generation 5 is the
      biggest one there has ever been, bigger than the 151 everybody knows, and generation 6 is less than half of it.
      Turn it on and most of what you are shown will be a shape you have never had to name.</p>

    <figure class="tq-fig">
      ${genLadder}
      <figcaption>Species per generation, counted from the National Pokedex read
        ${esc(longDate(dex.checked) || dex.checked)} at pokeapi.co. Amber is the 151 pool.
        ${(dex.count || whos.length).toLocaleString("en-US")} species in total.</figcaption>
    </figure>

    ${silhouetteDemo(145)}

    <div class="tq-grid">
      <div class="tq-card">
        <h3>How the shape is made</h3>
        <p>There is no second set of images. The game takes the official artwork, which has a transparent background,
          and crushes every pixel in it to black while leaving the transparency alone. That is exactly a silhouette,
          and getting the answer is what lifts it back off.</p>
        <span class="tq-eg">brightness(0), one CSS filter, one file</span>
      </div>
      <div class="tq-card">
        <h3>Why a card scan would not work</h3>
        <p>A card is a rectangle with a border, so the silhouette of a card is a rectangle. This is the one game here
          that cannot use the card corpus the rest of the site runs on, which is why it borrows the Pokedex instead.</p>
        <span class="tq-eg">artwork from pokeapi.co, credited below the game</span>
      </div>
      <div class="tq-card">
        <h3>What it is training</h3>
        <p>Outline only: no color, no pattern, no type. Most of what makes a Pokemon recognizable on a card is thrown
          away, which is why a shape you would know instantly in color can take a moment here.</p>
        <span class="tq-eg">wrong answers show the name, so a miss still teaches you one</span>
      </div>
    </div>

    <h2 style="margin-top:var(--s6)">Once you know the <span class="hl">name</span></h2>
    <p class="lede" style="max-width:44em">Naming it is the easy half. These pages are what the name is worth once
      a card with that Pokemon on it turns up in a pack.</p>
    <ul class="tq-links">
      <li><a href="/pokemon/">The card Pokedex by Pokemon</a></li>
      <li><a href="/cards.html">Every card the channel has pulled</a></li>
      <li><a href="/lore.html">Where these Pokemon come from</a></li>
      <li><a href="/games/pokemon-trivia.html">Trivia, same Pokedex</a></li>
    </ul>
  </div>
</section>`,
  body: `<section class="tight">
  <div class="wrap">
    <div id="game"></div>
    <div class="btn-row" style="justify-content:center;margin-bottom:var(--s5)">
      <button class="btn btn-sm" type="button" id="mGen1" aria-pressed="true">The original 151</button>
      <button class="btn btn-sm" type="button" id="mAll" aria-pressed="false">All ${whos.length.toLocaleString("en-US")}</button>
    </div>

    <p class="crumbs"><a href="/">Home</a> / <a href="/games/">Games</a> / Who's That Pokemon?</p>
    <p class="price-note" style="margin-top:var(--s5)">Artwork and Pokedex data from
      <a href="https://pokeapi.co" rel="noopener" target="_blank" aria-label="pokeapi.co, the source of the artwork and the Pokedex data this game is built from, opens on pokeapi.co">pokeapi.co</a>, read
      ${esc(longDate(dex.checked) || dex.checked)}. Pokemon and all Pokemon names are trademarks of
      The Pokemon Company. Fan content, not affiliated.</p>
  </div>
</section>`,
  // THE ARTWORK IS OURS AND IT USED TO BE GITHUB'S.
  //
  // The stage read raw.githubusercontent.com/PokeAPI/sprites/.../<id>.png,
  // which is the same file scripts/sync-species-art.mjs downloads, re-encodes
  // and stores under /assets/species/. So the game was hotlinking a raw git
  // object for a picture the site already served, and raw.githubusercontent.com
  // is a source host with a rate limit rather than a CDN: it has no business in
  // the critical path of a game that fetches a new picture every round.
  //
  // WHAT IT COST, read off the request log at 390x844 DPR 2, cache off: 255 to
  // 268KB of this page's ~407KB came from that host, 63% of the weight, and it
  // recurred EVERY ROUND rather than once. #132 Ditto is 129,274 bytes as
  // PokeAPI's png against 9,718 as our lg webp, a 13.3x cut, and the pixels are
  // the same 475x475: sync-species-art.mjs never upscales and re-codes at q82.
  //
  // WHY lg/ AND NOT /assets/species/<id>.webp. That file is 256px, sized for the
  // 128px portrait beside a Pokedex h1. This stage draws the artwork at 249 CSS
  // px, so 256 is a 1.95x upscale at DPR 2 on the one screen where the picture
  // IS the page. The reasoning and the PSNR figures are in sync-species-art.mjs
  // beside BIG.
  //
  // ALL 1,025 SPECIES IN dex.json HAVE AN lg FILE. Checked below rather than
  // assumed, and the build throws if that stops being true, because the failure
  // mode is a round whose sprite silently never arrives. The fix for a miss is
  // to run sync-species-art.mjs, never to fall back to the remote host.
  extraJs: `<script>
(function(){
  /* Local artwork, 475px, from /assets/species/lg/. See build-games.mjs for
     why this is not raw.githubusercontent.com any more and not the 256px file
     either. */
  var ART='/assets/species/lg/';
  var all=[], pool=[], quiz=null, gen1=true;
  var art=function(id){return ART+id+'.webp';};

  function build(){
    var p=GR.pick(pool);
    var wrong=GR.distractors(pool,3,p,function(x){return x[0];});
    var choices=GR.shuffle([p].concat(wrong)).map(function(x){return {label:x[1],id:x[0]};});
    var answer=0;
    for(var i=0;i<choices.length;i++) if(choices[i].id===p[0]) answer=i;
    return {
      stage:'<div class="gq-sil" data-sil><img src="'+art(p[0])+'" alt="A Pokemon silhouette to identify" width="475" height="475"></div>',
      choices:choices, answer:answer,
      note:'#'+p[0]+', Generation '+p[2]+'.',
      // Lifting the filter IS the reveal, so it uses the same element and the
      // full color artwork is already decoded and in cache.
      reveal:function(stage){var s=stage.querySelector('[data-sil]'); if(s) s.className='gq-sil is-shown';},
      _art:art(p[0])
    };
  }

  function setMode(g){
    gen1=g;
    document.getElementById('mGen1').setAttribute('aria-pressed',String(g));
    document.getElementById('mAll').setAttribute('aria-pressed',String(!g));
    pool=g?all.filter(function(x){return x[0]<=151;}):all;
    start();
  }
  function start(){
    /* TEAR THE OLD ONE DOWN. This called GR.Quiz over the top of the running
       game, which left the previous one alive: measured over CDP, five presses
       of these two buttons left five document keydown listeners, and pressing
       one 40 seconds into a sprint threw the run away with the clock, the score
       and the interval still running. See destroy() in games.js. */
    if(quiz) quiz.destroy();
    quiz=GR.Quiz({key:'gr.whos'+(gen1?'.151':'.all'),mount:document.getElementById('game'),
      next:build, preload:function(q){return q._art;}});
  }

  fetch('/data/games/dex.json').then(function(r){return r.json();}).then(function(d){
    all=d.pokemon;
    document.getElementById('mGen1').addEventListener('click',function(){setMode(true);});
    document.getElementById('mAll').addEventListener('click',function(){setMode(false);});
    setMode(true);
  }).catch(function(){
    document.getElementById('game').innerHTML='<p class="price-note">Could not load the Pokedex. Check your connection and reload.</p>';
  });
})();
</script>`,
});
await writeFile(join(OUT, "whos-that-pokemon.html"), whosPage);

// --- Guess the Set ---------------------------------------------------------
const setPage = shell({
  slug: "guess-the-set.html",
  compact: true,
  title: "Guess the Set: Pokemon Card Quiz | Garbage Rips 585",
  desc: `A real Pokemon card scan, four sets, one right answer. ${setNames.length} English sets and ${quizCards.length.toLocaleString("en-US")} cards.`,
  h1: `Guess the <span class="hl">set</span>`,
  kicker: `Card scans &bull; ${setNames.length} sets`,
  lede:
    "A real card off the shelf. Work it out from the frame, the symbol and the era. This is the skill that makes you " +
    "quick at sorting a bulk box, and it is the one people are surprised they can learn.",
  ld: [crumb("Guess the Set")],
  extraCss: TEACH_CSS,
  body: `<section class="tight">
  <div class="wrap">
    <div id="game" class="g-cards"></div>
    <div class="btn-row" style="justify-content:center;margin-bottom:var(--s5)">
      <button class="btn btn-sm" type="button" id="mAny" aria-pressed="true">Any era</button>
      <button class="btn btn-sm" type="button" id="mEra" aria-pressed="false">Same era</button>
    </div>
    <p class="crumbs"><a href="/">Home</a> / <a href="/games/">Games</a> / Guess the Set</p>
    <p class="price-note" style="margin-top:var(--s5)">${quizCards.length.toLocaleString("en-US")} cards from
      ${setNames.length} English sets, sampled across each set's numbering so it is not all commons.
      Scans from TCGdex, read ${esc(longDate(printings.checked) || printings.checked)}.
      Fan content, not affiliated with The Pokemon Company.</p>
  </div>
</section>`,
  extra: `<section class="band tight">
  <div class="wrap">
    <h2>Where the answer is <span class="hl">printed</span></h2>
    <p class="lede" style="max-width:44em">Every card tells you its set twice, in two marks the size of a fingernail.
      One is the number after the slash. The other is the symbol beside it, and that is the one this game is really
      asking about. Both live along the bottom edge, and the corner they live in changed once.</p>

    <figure class="tq-fig">
      <!-- PORTRAIT, AND THAT IS NOT A DETAIL. The first draft drew two 180x152
           boxes, which is a landscape card, in a diagram whose entire subject is
           where on a card two marks sit. 130x182 is 0.714, against a real card's
           63x88mm, or 0.716.
           The two marks: a disc for the symbol and a slash number beside it.
           THE LEFT CARD IS BOTTOM RIGHT AND THE RIGHT CARD IS BOTTOM LEFT. Both
           sat inside the left card on the first draft, so the drawing showed one
           card wearing the mark twice and one wearing it nowhere, which is the
           exact opposite of what the caption underneath it said. A diagram is
           worth having only if somebody checks it against its own claim. -->
      <svg viewBox="0 0 480 232" role="img"
        aria-label="Two card outlines, both portrait. On the left, a card up to the XY era, with the collector number and the set symbol together in the bottom right corner. On the right, a card from Sun and Moon onward, with the number and symbol moved to the bottom left.">
        <!-- THE INK IS A CLASS, NOT A fill= ATTRIBUTE, and that is deliberate:
             this figure sits on .tq-fig, which is var(--paper-2), so its ink has
             to move with the token rather than be re-sampled by hand the next
             time the palette moves. It was #1E2419 throughout and that measured
             1.74:1 on the new #2F4F39, so every mark here was invisible. The
             classes are in TEACH_CSS below. --ink is 8.03:1 on the figure.
             THE TWO FAINT GROUPS FLIPPED SENSE and that is the point of them:
             they are the greeked artwork box and the greeked text lines, drawn
             at 10% and 18%, and on a light figure that means "slightly darker
             than the card". On a dark one it has to mean slightly LIGHTER, so
             they are --ink at the same opacities rather than the old near-black
             at the same opacities, which would have been no mark at all. -->
        <g class="tq-d" stroke-width="3">
          <rect x="60" y="10" width="130" height="182" rx="8"/>
          <rect x="290" y="10" width="130" height="182" rx="8"/>
        </g>
        <g class="tq-df" opacity=".1">
          <rect x="70" y="20" width="110" height="96" rx="5"/>
          <rect x="300" y="20" width="110" height="96" rx="5"/>
        </g>
        <g class="tq-df" opacity=".18">
          <rect x="70" y="126" width="110" height="7" rx="3.5"/>
          <rect x="70" y="140" width="86" height="7" rx="3.5"/>
          <rect x="300" y="126" width="110" height="7" rx="3.5"/>
          <rect x="300" y="140" width="86" height="7" rx="3.5"/>
        </g>
        <!-- The set-symbol disc keeps the amber, which is 4.51:1 on the figure,
             and its ring goes to var(--on-accent) rather than to --ink: a
             near-white ring on amber is 1.78:1 and would have vanished into the
             disc it is meant to draw, where the dark ring is 8.05:1 on it. -->
        <g>
          <circle cx="174" cy="174" r="8" fill="#F5A62B" class="tq-don" stroke-width="2.5"/>
          <text x="158" y="178" text-anchor="end" class="tq-dt" font-size="11">25/198</text>
          <circle cx="306" cy="174" r="8" fill="#F5A62B" class="tq-don" stroke-width="2.5"/>
          <text x="322" y="178" class="tq-dt" font-size="11">25/198</text>
        </g>
        <g class="tq-dt" font-size="12">
          <text x="125" y="220" text-anchor="middle">up to XY, 2016</text>
          <text x="355" y="220" text-anchor="middle">Sun &amp; Moon on, 2017</text>
        </g>
      </svg>
      <figcaption>Drawn, not a scan. The corner is the only thing that moved: the number and the symbol have always
        sat together along the bottom edge. See <a href="/what-set.html">what set is my card from</a> for the full
        index by number.</figcaption>
    </figure>

    <h2 style="margin-top:var(--s6)">The ${eras.length} eras in the <span class="hl">pot</span></h2>
    <p class="lede" style="max-width:44em">These are the symbols you are being asked to tell apart, one per era, oldest
      first. The mark shown is the one the era opened with. Set the game to <b>Same era</b> and all four answers come
      from the same block below, which takes the card frame out of it and leaves you nothing but the symbol.</p>
    <ul class="tq-eras">
      ${eras
        .map(
          (e) => `<li class="tq-era">${symbolCell(e.symbolOf)}
        <span><b>${esc(e.label)}</b><span>${e.from ? (e.from === e.to ? e.from : `${e.from} to ${e.to}`) : "date not in the set list"}</span></span>
        <em>${e.sets} ${e.sets === 1 ? "set" : "sets"}<br>${e.cards.toLocaleString("en-US")} cards</em></li>`,
        )
        .join("\n      ")}
    </ul>
    <p class="price-note" style="margin-top:var(--s4)">Symbols mirrored from the Pokemon TCG API.
      Era names, dates and set counts are read from the same expansion list
      <a href="/expansions.html">/expansions.html</a> is built from, and the card counts are this quiz's own pot.${
        eras.some((e) => !e.from)
          ? " An era with no dates is one the expansion list holds no entry for, so none are printed rather than guessed."
          : ""
      }${
        setMeta.some((m) => !m.year)
          ? (() => {
              const n = setMeta.filter((m) => !m.year).length;
              return ` ${n} of the ${setNames.length} sets in the pot ${n === 1 ? "is" : "are"} not in that list at all,
      so ${n === 1 ? "it takes its" : "they take their"} era from the series code in ${n === 1 ? "its" : "their"} own
      image path and carr${n === 1 ? "ies" : "y"} no year.`;
            })()
          : ""
      }</p>

    <h2 style="margin-top:var(--s6)">Once you can do <span class="hl">this</span></h2>
    <p class="lede" style="max-width:44em">Reading a set off a card is the first half of sorting a box. These are the
      pages that pick it up from there.</p>
    <ul class="tq-links">
      <li><a href="/what-set.html">What set is my card from</a></li>
      <li><a href="/rarity.html">Reading the rarity symbol</a></li>
      <li><a href="/expansions.html">Every English set in order</a></li>
      <li><a href="/sets/">The set guides</a></li>
      <li><a href="/cards.html">The card Pokedex</a></li>
    </ul>
  </div>
</section>`,
  extraJs: `<script>
(function(){
  var sets=[], cards=[], setEra=[], eras=[], byEra=[], minPool=6, quiz=null, sameEra=false;

  /* THE DISTRACTOR POOL FOR ONE SET IN SAME ERA MODE.
     Its own era first, widened one era outward at a time until there are at
     least minPool candidates. Widening is what keeps the two-set and one-set
     eras playable: without it, Gym could only ever offer its own two sets and
     the question would have three slots and two answers to fill them with. */
  function poolFor(a){
    if(!sameEra) return sets;
    var at=setEra[a], lo=at, hi=at, out=byEra[at].slice();
    while(out.length<minPool+1 && (lo>0 || hi<byEra.length-1)){
      if(lo>0){ lo--; out=out.concat(byEra[lo]); }
      if(out.length<minPool+1 && hi<byEra.length-1){ hi++; out=out.concat(byEra[hi]); }
    }
    return out.map(function(i){return sets[i];});
  }

  function build(){
    var c=GR.pick(cards);
    var name=sets[c[1]];
    var wrong=GR.distractors(poolFor(c[1]),3,name,function(x){return x;});
    var choices=GR.shuffle([name].concat(wrong)).map(function(s){return {label:s};});
    var answer=0;
    for(var i=0;i<choices.length;i++) if(choices[i].label===name) answer=i;
    // high.webp, not low: the set symbol is the whole point and it is
    // unreadable at the 245px thumbnail size used elsewhere on the site.
    var src=c[0]+'/high.webp';
    return {stage:'<div class="gq-card"><img src="'+src+'" alt="A Pokemon card. Name its set." width="600" height="825"></div>',
      choices:choices,answer:answer,note:c[2]+'.',_art:src};
  }

  function setMode(era){
    sameEra=era;
    document.getElementById('mAny').setAttribute('aria-pressed',String(!era));
    document.getElementById('mEra').setAttribute('aria-pressed',String(era));
    // Tear the old game down first. It holds a document keydown listener and,
    // if a sprint is running, an interval and an unbanked score. See the note
    // on destroy() in games.js.
    if(quiz) quiz.destroy();
    quiz=GR.Quiz({key:'gr.setquiz'+(era?'.era':''),mount:document.getElementById('game'),
      next:build, preload:function(q){return q._art;}});
  }

  fetch('/data/games/setquiz.json').then(function(r){return r.json();}).then(function(d){
    sets=d.sets; cards=d.cards; setEra=d.setEra||[]; eras=d.eras||[]; minPool=d.minEraPool||6;
    byEra=eras.map(function(){return [];});
    for(var i=0;i<setEra.length;i++) if(byEra[setEra[i]]) byEra[setEra[i]].push(i);
    document.getElementById('mAny').addEventListener('click',function(){setMode(false);});
    document.getElementById('mEra').addEventListener('click',function(){setMode(true);});
    setMode(false);
  }).catch(function(){
    document.getElementById('game').innerHTML='<p class="price-note">Could not load the card list. Check your connection and reload.</p>';
  });
})();
</script>`,
});
await writeFile(join(OUT, "guess-the-set.html"), setPage);

// --- Trivia ----------------------------------------------------------------
const triviaPage = shell({
  slug: "pokemon-trivia.html",
  compact: true,
  // Counted, not typed. Every OTHER figure on this page already comes from
  // shuffled.length (the kicker, the lede note); the title alone said 1,400 as
  // a literal, and it is a literal that only stays true by coincidence.
  // `shuffled` is trivia.q capped by slice(0, 1400), so the day the generator
  // yields fewer than 1,400 questions the cap stops binding and the count drops
  // while the title, which is what search results and the browser tab show,
  // keeps promising 1,400.
  title: `Pokemon Trivia Quiz: ${shuffled.length.toLocaleString("en-US")} Questions | Garbage Rips 585`,
  desc: `Pokemon trivia generated from real Pokedex data: types, evolutions, Legendaries and the official Pokemon categories. Free, no sign up.`,
  h1: `Pokemon <span class="hl">trivia</span>`,
  kicker: `Quiz &bull; ${shuffled.length.toLocaleString("en-US")} questions`,
  lede:
    "Types, evolutions, Legendaries and the official categories, which are stranger than you remember. Every question " +
    "is generated from the National Pokedex rather than written from memory, so none of it is somebody's half remembered fact.",
  ld: [crumb("Pokemon Trivia")],
  extraCss: TEACH_CSS,
  extra: `<section class="band tight">
  <div class="wrap">
    <h2>Where the questions come <span class="hl">from</span></h2>
    <p class="lede" style="max-width:44em">There are five generators and no typed facts. Each one reads a single field
      off the National Pokedex and turns every Pokemon that has that field into a question, which is how
      ${shuffled.length.toLocaleString("en-US")} of them exist without anybody writing any. It also means an answer here
      is wrong only if the Pokedex is wrong, and you can go and check.</p>

    <figure class="tq-fig">
      ${mixBar}
      <figcaption>${catOrder
        .map((c) => `${esc(CAT_LABEL[c])} ${((catCount[c] / shuffled.length) * 100).toFixed(1)}%`)
        .join(" &middot; ")}<br>The mix of the ${shuffled.length.toLocaleString("en-US")} questions in the bank, and
        the mix a run gets: the game picks from it at random.</figcaption>
    </figure>

    <div class="tq-grid">
      ${catOrder
        .map(
          (c) => `<div class="tq-card">
        <h3>${esc(CAT_LABEL[c])}</h3>
        <p>${CAT_WHY[c]}</p>
        <span class="tq-eg">${catCount[c].toLocaleString("en-US")} questions, from the
          <b>${esc(CAT_FIELD[c])}</b> field<br>&ldquo;${esc(catExample[c][0])}&rdquo;</span>
      </div>`,
        )
        .join("\n      ")}
    </div>
${/* "the good bit" is British for "the good part", and it is not a word a
         -our/-ise sweep looks for, which is how it survived three of them. */ ""}
    <h2 style="margin-top:var(--s6)">The categories are the <span class="hl">good</span> part</h2>
    <p class="lede" style="max-width:44em">Nearly half the bank is the official one word category, because it is the
      one nobody knows and it is frequently ridiculous. These four are real, and two of them are why this channel is
      called what it is.</p>
    <ul class="tq-dex">
      ${dexRow([568, 569, 225, 442])}
    </ul>
    <p class="price-note" style="margin-top:var(--s4)">Categories, types, evolutions, Legendary flags and weights all
      read from pokeapi.co on ${esc(longDate(dex.checked) || dex.checked)}. Artwork mirrored from the PokeAPI sprite
      repository. There is nothing here about how rare anything is, because the Pokedex does not say and neither
      does this site.</p>

    <h2 style="margin-top:var(--s6)">Same data, other <span class="hl">pages</span></h2>
    <ul class="tq-links">
      <li><a href="/games/whos-that-pokemon.html">Who's That Pokemon</a></li>
      <li><a href="/pokemon/">The card Pokedex by Pokemon</a></li>
      <li><a href="/types.html">Type matchups</a></li>
      <li><a href="/lore.html">Pokemon lore</a></li>
    </ul>
  </div>
</section>`,
  body: `<section class="tight">
  <div class="wrap">
    <div id="game" class="g-quiz"></div>
    <p class="crumbs"><a href="/">Home</a> / <a href="/games/">Games</a> / Trivia</p>
    <p class="price-note" style="margin-top:var(--s5)">${shuffled.length.toLocaleString("en-US")} questions, every one
      generated from <a href="https://pokeapi.co" rel="noopener" target="_blank" aria-label="pokeapi.co, the source of the artwork and of every question here, opens on pokeapi.co">pokeapi.co</a> data read
      ${esc(longDate(dex.checked) || dex.checked)}, and the official artwork mirrored from the same place. Nothing here
      was typed from memory, which is why there is no question about which Pokemon is best. Pokemon and all Pokemon
      names are trademarks of The Pokemon Company. Fan content, not affiliated with The Pokemon Company.</p>
  </div>
</section>`,
  // THE PORTRAIT SLOT IS ALWAYS IN THE MARKUP, EMPTY OR NOT, and that is the
  // whole no-layout-shift story. .gq-stage keeps the fixed square box it always
  // had, and inside it row 1 takes whatever the question text does not, so the
  // question sits in the same place whether a picture is there yet or not. The
  // 56.0% of the bank whose portrait IS the answer draws nothing in that row
  // until the answer is in, and the reveal fills a box that was already there.
  //
  // WHY /assets/species/ AND NOT /assets/species/sm/. Measured at 390x844: the
  // stage's inner box is 249px and the tallest question in the bank is 84px, so
  // the portrait is drawn at 128px. The sm rendition is 96px, a 2.7x upscale at
  // DPR 2 and 4x at DPR 3, which is a blur where the picture is the point. The
  // 256px file is 1:1 at DPR 2 and a 1.5x upscale at DPR 3, which is the same
  // trade /pokemon/ makes for the same portrait at the same drawn size. The lg
  // rendition Who's That Pokemon uses is 475px and 19.6KB median against
  // 11.9KB, and it is right there because that game draws it at 249px.
  //
  // ALT TEXT IS THE TRAP HERE, AND THE TWO SLOTS WANT OPPOSITE ANSWERS.
  //
  // A tellArt portrait is new information. It is the first time a player has
  // been shown what the thing they just named looks like, so it is named:
  // alt is the correct answer's own label, taken from the row rather than
  // parsed back out of anything.
  //
  // An askArt portrait is alt="", which is deliberate and is NOT laziness.
  // The Pokemon in that picture is named in the question sitting directly under
  // it, so a name in alt is a duplicate announcement of a word the screen
  // reader is about to read anyway, and the picture carries nothing a
  // non-sighted player can act on: seeing Braixen does not tell you its type.
  // WCAG treats an image that duplicates adjacent text as decorative, and
  // alt="" takes it out of the accessibility tree completely, which is also the
  // one form of this that CANNOT leak: there is no string to get wrong.
  //
  // The tellArt slot holds no img at all before the reveal, for the same
  // reason. An alt="" image sitting there would be harmless, but a later editor
  // filling it in early is a bug that only a screen reader can see.
  extraJs: `<script>
(function(){
  var ART='/assets/species/';
  var qs=[];
  function art(id){return ART+id+'.webp';}
  function portrait(id,alt){
    return '<img src="'+art(id)+'" alt="'+alt+'" width="256" height="256" decoding="async">';
  }
  function build(){
    var r=GR.pick(qs);
    var opts=GR.shuffle([{label:r[1],ok:1},{label:r[2]},{label:r[3]},{label:r[4]}]);
    var answer=0;
    for(var i=0;i<opts.length;i++) if(opts[i].ok) answer=i;
    var ask=r[6]||0, tell=r[7]||0;
    /* aria-hidden: a mark that says a picture is coming. A screen reader being
       told there is a question mark here helps nobody. */
    var slot=ask?portrait(ask,'')
                :'<span class="gq-pending" aria-hidden="true">?</span>';
    ${/* ask: THE QUESTION, IN WORDS, FOR THE ENGINE'S LIVE REGION, and it is
          the reason this page is the only one of the three that passes one. The
          other two ask in a picture, a silhouette and a set symbol, so there is
          no sentence that would let a blind player answer and they pass nothing;
          the engine then says nothing on a new question rather than inventing
          "Which Pokemon is this?" every ten seconds.

          MEASURED BEFORE IT WAS PASSED, with a MutationObserver on this page:
          answering announced the verdict once, correctly, and then render()
          replaced the question and all four choice labels in silence. A screen
          reader said "1 Swellow, button" and stopped, so the one game here a
          blind player can genuinely play never said what it was asking.

          r[0] is the SAME string the visible <p class="gq-q"> gets, read from
          the row rather than back out of the markup, so the spoken question and
          the printed one cannot drift apart. See the note beside data-live in
          games.js for why the question is allowed to appear twice in the tree,
          and this comment is interpolated away rather than shipped because it
          is three times the size of the line it explains. */ ""}
    var q={
      stage:'<div class="gq-art" data-art>'+slot+'</div><p class="gq-q">'+r[0]+'</p>',
      choices:opts,answer:answer,note:r[5]||'',ask:r[0],
      _art:art(ask||tell)
    };
    if(tell) q.reveal=function(stage){
      var box=stage.querySelector('[data-art]');
      if(box) box.innerHTML=portrait(tell,r[1]);
    };
    return q;
  }
  fetch('/data/games/trivia.json').then(function(r){return r.json();}).then(function(d){
    qs=d.q;
    GR.Quiz({key:'gr.trivia',mount:document.getElementById('game'),next:build,
      preload:function(q){return q._art;}});
  }).catch(function(){
    document.getElementById('game').innerHTML='<p class="price-note">Could not load the questions. Check your connection and reload.</p>';
  });
})();
</script>`,
});
await writeFile(join(OUT, "pokemon-trivia.html"), triviaPage);

console.log(`Wrote public/games/ (4 pages)`);
console.log(`  Who's That Pokemon: ${whos.length} species, ${whos.filter((w) => w[0] <= 151).length} in the 151 pool`);
console.log(`  Guess the Set: ${quizCards.length} cards across ${setNames.length} sets (min ${MIN_PER_SET} per set)`);
// The era table, printed because it is the one thing here nothing else checks.
// A set whose symbol never mirrored, or an era the expansion list has no dates
// for, shows up as a gap in this list and nowhere else.
console.log(`    ${eras.length} eras, oldest first (Same era mode widens to >= ${MIN_ERA_POOL} sets):`);
for (const e of eras) {
  console.log(
    `      ${String(e.code).padEnd(6)} ${String(e.sets).padStart(2)} sets  ${String(e.cards).padStart(4)} cards  ` +
      `${e.from ? `${e.from}-${e.to}` : "NO DATE".padEnd(9)}  ${e.symbolOf === null ? "NO SYMBOL  " : "           "}${e.label}`,
  );
}
console.log(`  Trivia: ${shuffled.length} questions from ${trivia.length} generated`);
for (const c of catOrder) {
  console.log(`      ${c.padEnd(10)} ${String(catCount[c]).padStart(4)}  ${((catCount[c] * 100) / shuffled.length).toFixed(1)}%`);
}
