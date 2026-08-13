#!/usr/bin/env node
// Every printing of every card, in every language, for the card search.
//
//   node scripts/sync-all-printings.mjs            parse the local clone
//   node scripts/sync-all-printings.mjs --pull     git pull the clone first
//
// WHY A CLONE AND NOT THE API. The set and card-list endpoints return only
// id, localId, name and image. Rarity and dexId come only from a per-card
// request, and dexId is the whole ballgame: it is the only thing that turns
// レディバ into Ledyba, which is what makes a Japanese card findable by
// somebody typing an English name. Resolving 41,694 cards that way is 41,694
// requests against a free community API with no rate limit published and a
// request to be considerate. tcgdex/cards-database is the same data, MIT
// licensed, and one shallow clone costs them a single fetch.
//
// WHAT THE CORPUS ACTUALLY IS, counted rather than assumed:
//   data/       23,639 cards, 221 sets, Western languages, 100% English named
//   data-asia/  18,055 cards, 342 sets, ja + zh-tw + zh-cn in the SAME file
//
// THE HONEST LIMIT ON THE ASIAN HALF. Only 56% of those 18,055 carry a dexId,
// so only 56% can be given an English name. The rest are Trainers, Energy and
// records the database simply has no dex number for. Those are kept, indexed
// under their printed name, and marked so the page can say the name is the
// Japanese one rather than pretending a translation exists. We do not invent
// Trainer translations: that rule was set when the set guides were built and
// it holds here.
//
// KOREAN IS EFFECTIVELY ABSENT. 376 of 18,055 cards carry a Korean name, about
// 2%. Korean sets are real and we have rip guides for four of them, but their
// card records are translations of the Japanese ones and the database does not
// hold Korean text for them. Do not "fix" this by labelling Japanese text as
// Korean, which is a bug this project has already shipped once.
//
// PRICES ARE NOT IN HERE. This index answers "which printings exist", not
// "what is it worth". public/data/cards/*.json still owns prices for the 23
// English sets we rip, and the search layers them on where the two agree. The
// TCGdex API returns tcgplayer: null for every Japanese card, so a USD price
// for a Japanese printing does not exist to be shown.

import { mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(ROOT, ".cache/cards-database");
const OUT = join(ROOT, "public/data/printings");
const PULL = process.argv.includes("--pull");

if (PULL) {
  console.log("Updating the clone...");
  await run("git", ["-C", REPO, "pull", "--depth", "1", "--ff-only"]).catch((e) =>
    console.log(`  pull failed, using the clone as-is: ${e.message.split("\n")[0]}`),
  );
}

/* ------------------------------------------------------------------ parsing */

// The card files are TypeScript modules, not JSON, so they are read with
// patterns rather than parsed. That is deliberate: evaluating them would mean a
// TS toolchain and stubbing the `import Set from "../SV7"` every file opens
// with. The shapes are machine-generated and uniform, so patterns are stable.
// Every field below is optional and simply comes back null when absent.
// BOTH QUOTE STYLES. The files are machine-generated but not uniformly: some
// write name: { ja: "ホワイトフレア" } and others name: { ja: '古代の咆哮' }.
// Matching only double quotes silently dropped ~2,000 cards and left their sets
// rendering as raw ids like SV4K, which is the kind of failure that looks like
// missing data rather than a broken pattern. Capture the opening quote and
// backreference it so the two styles cannot be mixed within one value.
// Two alternatives rather than a backreferenced quote. A single pattern like
// (['"])((?:[^'"\\]|\\.)*)\1 looks tidier but has to exclude BOTH quotes from
// the value, so it drops every name containing an apostrophe: Farfetch'd,
// Team Rocket's Mewtwo ex, Pokémon Breeder's Nurturing. Matching the two quote
// styles separately lets a double-quoted value keep its apostrophes.
// The value is whichever of the two groups matched, hence pick() below.
const QUOTED = `(?:"((?:[^"\\\\]|\\\\.)*)"|'((?:[^'\\\\]|\\\\.)*)')`;
const reBlock = (key) => new RegExp(`\\n\\t${key}:\\s*\\{([^}]*)\\}`);
const NAME_BLOCK = reBlock("name");
const reLang = (lang) => new RegExp(`['"]?${lang}['"]?:\\s*${QUOTED}`);
const reField = (key) => new RegExp(`\\n\\t${key}:\\s*${QUOTED}`);
const pick = (m) => (m ? (m[1] ?? m[2] ?? null) : null);
const RARITY = reField("rarity");
const CATEGORY = reField("category");
const DEXID = /\n\tdexId:\s*\[([0-9,\s]*)\]/;
const ILLUS = reField("illustrator");

const unesc = (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, "\\");

function parseCard(src) {
  const nb = src.match(NAME_BLOCK);
  const names = {};
  if (nb) {
    for (const lang of ["en", "ja", "zh-tw", "zh-cn", "ko", "fr", "de", "es", "it", "pt"]) {
      const m = nb[1].match(reLang(lang));
      if (m) { const v = pick(m); if (v) names[lang] = unesc(v); }
    }
  }
  const dex = src.match(DEXID);
  return {
    names,
    rarity: pick(src.match(RARITY)),
    category: pick(src.match(CATEGORY)),
    // First dex number only. A multi-species card (a Tag Team) lists several and
    // the first is the one the card is named for.
    dexId: dex && dex[1].trim() ? Number(dex[1].split(",")[0].trim()) : null,
    illustrator: pick(src.match(ILLUS)) ? unesc(pick(src.match(ILLUS))) : null,
  };
}

// Set files carry the set's own name block and release date.
// Top-level id only: one leading tab. Asia serie files carry a nested
// id: 'Scarlet & Violet' inside their name block at two tabs, and matching that
// would build image paths out of a display name with a space and an ampersand.
const TOP_ID = new RegExp(`^\\tid:\\s*${QUOTED}`, "m");
const SET_RELEASE = new RegExp(`releaseDate:\\s*(?:\\{[^}]*?(?:ja|en)['"]?:\\s*)?${QUOTED}`);
function parseSet(src) {
  const nb = src.match(/\n\tname:\s*\{([^}]*)\}/);
  const names = {};
  if (nb) {
    for (const lang of ["en", "ja", "zh-tw", "zh-cn", "ko"]) {
      const m = nb[1].match(reLang(lang));
      if (m) { const v = pick(m); if (v) names[lang] = unesc(v); }
    }
  }
  return { names, released: pick(src.match(SET_RELEASE)), id: pick(src.match(TOP_ID)) };
}

/* ------------------------------------------- English names for Asian cards */

// Same source and same method as sync-intl-guides.mjs: PokeAPI keyed by dex
// number. Cached on disk because it is 1,025 species and it never changes.
const CACHE = join(ROOT, ".cache/species-en.json");
let byDex = new Map();
try {
  byDex = new Map(Object.entries(JSON.parse(await readFile(CACHE, "utf8"))).map(([k, v]) => [Number(k), v]));
  console.log(`Species table: ${byDex.size} from cache`);
} catch {
  console.log("Building the species table from PokeAPI...");
  const idx = await (await fetch("https://pokeapi.co/api/v2/pokemon-species?limit=2000")).json();
  for (const s of idx.results) {
    const dex = Number(s.url.match(/\/(\d+)\/?$/)?.[1]);
    if (dex) byDex.set(dex, s.name.replace(/(^|-)([a-z])/g, (_, a, b) => a + b.toUpperCase()));
  }
  await writeFile(CACHE, JSON.stringify(Object.fromEntries(byDex), null, 0));
  console.log(`  ${byDex.size} species cached`);
}

/* --------------------------------------------------------------- the sweep */

const LANG_LABEL = { ja: "Japanese", "zh-tw": "Chinese", "zh-cn": "Chinese", ko: "Korean", en: "English" };
const cards = [];
const setsSeen = new Map();
// NO SILENT DROPS. 1,987 of the 41,694 card files yield no usable name and are
// excluded: as measured by this script, 1,934 produce no name at all and 53
// carry a name only in a language we do not index. Most of the excluded ones
// are single-language Western records, the French McDonald's collections
// prominent among them. A French-only name is not findable by somebody typing
// English and we hold no English name for those cards, so leaving them out is
// correct. The count is printed and stored in the manifest, because a page
// that quietly covers 39,707 of 41,694 reads as covering everything.
const skipped = { noName: 0, noUsableLang: 0 };

async function sweep(base, asian) {
  for (const serie of await readdir(base, { withFileTypes: true })) {
    if (!serie.isDirectory()) continue;
    const serieDir = join(base, serie.name);
    // Image paths use the SET and SERIE ids, never the folder names: the folder
    // for sv03.5 is literally "151".
    let serieId = null;
    try { serieId = pick((await readFile(`${serieDir}.ts`, "utf8")).match(TOP_ID)); } catch {}
    for (const set of await readdir(serieDir, { withFileTypes: true })) {
      if (!set.isDirectory()) continue;
      const setDir = join(serieDir, set.name);
      let setMeta = { names: {}, released: null };
      try {
        setMeta = parseSet(await readFile(`${setDir}.ts`, "utf8"));
      } catch {
        /* a set folder with no sibling .ts still yields its cards */
      }
      const setId = setMeta.id || set.name;
      const setName = setMeta.names.en || setMeta.names.ja || setMeta.names["zh-tw"] || setId;
      setsSeen.set(`${asian ? "a" : "w"}:${setId}`, { setName, released: setMeta.released, asian });

      for (const f of await readdir(setDir)) {
        if (!f.endsWith(".ts")) continue;
        const c = parseCard(await readFile(join(setDir, f), "utf8"));
        const localId = f.replace(/\.ts$/, "");

        // The name people will search by, and whether it is a real English name
        // or a fallback to the printed one.
        const printed = asian ? c.names.ja || c.names["zh-tw"] || c.names["zh-cn"] : c.names.en;
        const english = asian ? (c.dexId ? byDex.get(c.dexId) : null) : c.names.en;
        if (!printed && !english) {
          if (!Object.keys(c.names).length) skipped.noName += 1;
          else skipped.noUsableLang += 1;
          continue;
        }

        const lang = asian ? (c.names.ja ? "ja" : c.names["zh-tw"] || c.names["zh-cn"] ? "zh" : "ja") : "en";
        // assets.tcgdex.net/{lang}/{serie}/{set}/{localId}, then /{quality}.{ext}
        // at render time. Asian cards are served under ja even when the record
        // also carries Chinese names, because that is the printing scanned.
        const imgBase =
          serieId && setId ? `https://assets.tcgdex.net/${asian ? "ja" : "en"}/${serieId}/${setId}/${localId}` : null;
        cards.push({
          // `n` is what the search matches on; `p` is the printed name when it
          // differs, so the page can show both and never claim a translation
          // it does not have.
          n: english || printed,
          p: english && printed && english !== printed ? printed : null,
          s: setName,
          i: localId,
          r: c.rarity,
          c: c.category,
          l: lang,
          d: c.dexId,
          // Marks a card whose search name is the PRINTED one because no
          // translation was available. The page says so rather than implying
          // the Japanese text is an English name.
          u: asian && !english ? 1 : 0,
          ...(imgBase ? { g: imgBase } : {}),
        });
      }
    }
  }
}

console.log("Sweeping the clone...");
await sweep(join(REPO, "data"), false);
console.log(`  Western: ${cards.length} cards`);
const afterWestern = cards.length;
await sweep(join(REPO, "data-asia"), true);
console.log(`  Asian:   ${cards.length - afterWestern} cards`);

/* ------------------------------------------------- do the images exist? */

// RECONSTRUCTED URLS MUST BE PROVEN, NOT ASSUMED. The image path is built from
// the serie and set ids, and the first attempt was wrong for most of the
// corpus: sets whose id failed to parse fell back to their FOLDER name, giving
// ".../en/swsh/Darkness Ablaze/49" with spaces in it, and several Chinese-only
// sets have no Japanese scan at all. A 40 card spot check returned 34 failures.
// Shipping that would have been tens of thousands of broken images on pages
// whose whole job is showing people what a card looks like.
//
// So: probe ONE card per set, and drop the image base for every card in a set
// whose probe fails. 388 requests, once, against a set count that barely moves.
const bySet = new Map();
for (const c of cards) {
  if (!c.g) continue;
  if (!bySet.has(c.s)) bySet.set(c.s, []);
  bySet.get(c.s).push(c);
}
console.log(`Probing ${bySet.size} sets for real images...`);
let liveSets = 0;
const probes = [...bySet.entries()];
for (let i = 0; i < probes.length; i += 12) {
  await Promise.all(
    probes.slice(i, i + 12).map(async ([, list]) => {
      let ok = false;
      try {
        const r = await fetch(`${list[0].g}/low.webp`);
        ok = r.ok && Number(r.headers.get("content-length") || 3000) > 2000;
      } catch {}
      if (ok) liveSets += 1;
      else for (const c of list) delete c.g;
    }),
  );
}
const withImg = cards.filter((c) => c.g).length;
console.log(`  ${liveSets} of ${bySet.size} sets have images, ${withImg} cards keep one`);

/* -------------------------------------------------------------- the shards */

// SHARDED BY FIRST LETTER, and this is the reason the whole thing is viable.
// 41,694 cards is about 2.3MB as one file, which the card search would have to
// download before it could answer anything. Sharded, typing "Trubbish" fetches
// t.json alone. The manifest is small enough to ship with the page so the
// search knows what exists before it asks for anything.
const key = (n) => {
  const ch = String(n).trim().toLowerCase()[0] || "0";
  return ch >= "a" && ch <= "z" ? ch : "0";
};

const shards = new Map();
for (const c of cards) {
  const k = key(c.n);
  if (!shards.has(k)) shards.set(k, []);
  shards.get(k).push(c);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const manifest = { checked: new Date().toISOString().slice(0, 10), total: cards.length, shards: {} };
let bytes = 0;
for (const [k, list] of [...shards].sort()) {
  list.sort((a, b) => a.n.localeCompare(b.n) || a.s.localeCompare(b.s));
  const body = JSON.stringify(list);
  await writeFile(join(OUT, `${k}.json`), body);
  manifest.shards[k] = list.length;
  bytes += body.length;
}
manifest.sets = setsSeen.size;
manifest.skipped = { ...skipped, total: skipped.noName + skipped.noUsableLang };
manifest.withImage = cards.filter((c) => c.g).length;
manifest.translated = cards.filter((c) => !c.u).length;
manifest.untranslated = cards.filter((c) => c.u).length;
await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`\nWrote ${shards.size} shards to public/data/printings/`);
console.log(`  ${cards.length} printings across ${setsSeen.size} sets, ${(bytes / 1024 / 1024).toFixed(2)}MB total`);
console.log(`  ${manifest.translated} searchable by English name, ${manifest.untranslated} only by printed name`);
const biggest = [...shards].sort((a, b) => b[1].length - a[1].length)[0];
console.log(`  biggest shard: "${biggest[0]}" with ${biggest[1].length} cards`);
console.log(
  `  skipped ${skipped.noName + skipped.noUsableLang}: ${skipped.noName} with no name, ` +
    `${skipped.noUsableLang} with no English, Japanese, Chinese or Korean name`,
);
