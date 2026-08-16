#!/usr/bin/env node
// Build the data behind the non-English set guides.
//
//   node scripts/sync-intl-guides.mjs           cached, near instant
//   node scripts/sync-intl-guides.mjs --force   refetch everything
//
// Reads data/intl-rips.json (the hand-verified map of foreign sets Tim has
// ripped) and writes public/data/intl-guides.json, which build-intl-pages.mjs
// renders.
//
// TWO SOURCES, BOTH FREE AND KEYLESS
// TCGdex for sets, checklists and rarities. PokeAPI for card names in English.
//
// WHY THE SECOND ONE EXISTS. About 95% of the audience is in the US, and a
// checklist reading トロピウス helps none of them. TCGdex tags each Pokemon card
// with its Pokedex number, so トロピウス carries dexId 357, and PokeAPI answers
// 357 with "Tropius" in every language it ships. That is a looked-up translation
// with a source, not a transliteration, which is the whole reason it is safe to
// print. Trainer and Energy cards have no dex number and are NOT guessed at:
// they keep their native name and get labelled by category.
//
// THE EXPENSIVE PART, AND WHY IT IS WORTH IT
// TCGdex's set endpoint returns a checklist of id/localId/name only. Rarity and
// dex number live on the individual card, so a set costs one request per card.
// That is roughly 780 requests across the seven sets that have checklists, and
// the reason everything is cached under .cache/tcgdex. A cold run takes a few
// minutes; every run after it, including the nightly, reads the cache and does
// no network work at all.
//
// WHAT IS DELIBERATELY NOT PUBLISHED
// Korean and Chinese sets carry a cardCount but zero card records, and the count
// disagrees with the Japanese set they were translated from (Korean Clay Burst
// claims 71 against Japan's 99). An unverifiable number is worse than no number,
// so those entries fall back to the Japanese checklist via `dataFrom` and the
// page states where its data came from.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "tcgdex");
const OUT = join(ROOT, "public/data/intl-guides.json");
const FORCE = process.argv.includes("--force");

const TCGDEX = "https://api.tcgdex.net/v2";
const POKEAPI = "https://pokeapi.co/api/v2";

const LANG_NAME = { ja: "Japanese", ko: "Korean", "zh-cn": "Chinese", "zh-tw": "Chinese" };
const LANG_FLAG = { ja: "\u{1F1EF}\u{1F1F5}", ko: "\u{1F1F0}\u{1F1F7}", "zh-cn": "\u{1F1E8}\u{1F1F3}", "zh-tw": "\u{1F1F9}\u{1F1FC}" };
const LANG_SCRIPT = { ja: "Japanese", ko: "Korean", "zh-cn": "Simplified Chinese", "zh-tw": "Traditional Chinese" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let fetched = 0;
let served = 0;

/** Cached GET. Returns null on a real 404 so a missing set is not an error. */
async function getJson(url, key) {
  const file = join(CACHE, key.replace(/[^\w.-]/g, "_") + ".json");
  if (!FORCE && existsSync(file)) {
    served++;
    const raw = await readFile(file, "utf8");
    return raw === "null" ? null : JSON.parse(raw);
  }
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "garbagerips585-build" } });
      if (res.ok) {
        const j = await res.json();
        await mkdir(CACHE, { recursive: true });
        await writeFile(file, JSON.stringify(j));
        fetched++;
        return j;
      }
      if (res.status === 404) {
        await mkdir(CACHE, { recursive: true });
        await writeFile(file, "null");
        fetched++;
        return null;
      }
    } catch {
      /* fall through to the backoff */
    }
    await sleep(attempt * 1200);
  }
  throw new Error(`gave up on ${url}`);
}

/** Run tasks with a small concurrency cap so neither API gets hammered. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

// ---------------------------------------------------------------- English names

// TCGdex tags ordinary Pokemon cards with a dex number but OMITS IT ON ex CARDS,
// which are precisely the ones anyone opening packs cares about: ラプラスex comes
// back with no dexId at all. So a number-only lookup translated the commons and
// left every chase card in Japanese.
//
// The fix is to index PokeAPI by name as well as by number. Each species carries
// its own name in every language it ships, so ラプラス resolves to Lapras from the
// Japanese side with no transliteration involved. That costs one pass over all
// 1025 species, cached, after which both lookups are free.
const byDex = new Map();
const byName = new Map();

async function loadSpecies() {
  const index = await getJson(`${POKEAPI}/pokemon-species?limit=2000`, "pokeapi-species-index");
  const ids = (index?.results || [])
    .map((r) => Number(/\/(\d+)\/?$/.exec(r.url)?.[1]))
    .filter(Boolean);
  await pool(ids, 8, async (dex) => {
    let s = null;
    try {
      s = await getJson(`${POKEAPI}/pokemon-species/${dex}`, `pokeapi-species-${dex}`);
    } catch {
      return;
    }
    // The localised English name, which keeps the real punctuation (Farfetch'd,
    // Mr. Mime, Nidoran female) that the url slug throws away.
    const en = s?.names?.find((n) => n.language?.name === "en")?.name;
    if (!en) return;
    byDex.set(dex, en);
    for (const n of s.names || []) {
      if (["ja", "ja-Hrkt", "ko", "zh-Hant", "zh-Hans", "roomaji"].includes(n.language?.name)) {
        byName.set(n.name, en);
      }
    }
  });
  console.log(`  species table: ${byDex.size} by number, ${byName.size} by native name`);
}

// Card-name decorations that sit outside the species name. Longest first, so
// "VMAX" is stripped before "V" and never leaves a stray "MAX" behind.
const SUFFIXES = [
  ["VMAX", "VMAX"], ["VSTAR", "VSTAR"], ["ex", "ex"], ["EX", "EX"],
  ["GX", "GX"], ["V", "V"],
];

/**
 * English name for one card. Tries the dex number, then the native species name
 * with any ex/V/GX decoration peeled off and re-attached in English. Returns
 * null rather than a guess, which is what keeps Trainer and Energy cards honest.
 */
function englishName({ dexId, native, category }) {
  if (category !== "Pokemon") return null;
  const raw = String(native || "").trim();
  if (!raw) return null;

  // Peel the decorations off the PRINTED name first, then translate what is
  // left. Doing it the other way round loses them: メガダークライex carries dex
  // number 491, so a number-first lookup answers "Darkrai" and quietly drops
  // both the Mega and the ex, which are the entire reason the card is worth
  // pulling. The decoration is on the card, so it has to survive the lookup.
  let core = raw;
  let suffix = "";
  for (const [token, label] of SUFFIXES) {
    if (core.length > token.length && core.endsWith(token)) {
      core = core.slice(0, -token.length).trim();
      suffix = label;
      break;
    }
  }
  const mega = core.startsWith("メガ");
  if (mega) core = core.slice(2).trim();

  const species = (dexId && byDex.get(dexId)) || byName.get(core) || byName.get(raw) || null;
  if (!species) return null;

  return [mega ? "Mega" : null, species, suffix || null].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------- rarity

// Roughly worst to best. Used only to order the "worth chasing" grid and to
// decide what counts as a hit.
//
// "ANYTHING UNRECOGNISED SORTS TO THE END OF THE COMMONS" IS WHAT THIS COMMENT
// USED TO SAY, AND IT WAS THE BUG. `findIndex` answers -1 for a rarity that is
// not on the list and the fallback turned that into 3, the rank of "Rare", which
// is below CHASE_MIN. So an unknown rarity was not sorted to the end of the
// commons, it was DECLARED to be a common, and the grid it was then excluded
// from is the one thing anybody looks at on these pages.
//
// Two real tiers were missing and both are the best card in their set:
//   Mega Hyper Rare   5 cards, incl. ja-mega-symphonia #092 Mega Gardevoir ex
//   Secret Rare      11 cards, all of ja-mega-symphonia #076-#086
// ja-abyss-eye #118 Mega Darkrai ex is a Mega Hyper Rare AND numbered past the
// printed set, so `c.secret` did qualify it, and then it sorted at rank 3
// beneath twelve Special Illustration Rares and fell off the .slice(0, 12).
// The set's chase grid showed twelve cards and not the one card in it.
//
// Placed to agree with the site's own ladder in shared/format.mjs, which runs
// best-first and reads: Mega Hyper Rare > Hyper Rare > Rainbow Rare >
// Secret Rare > Special Illustration Rare. THE TWO LISTS STILL DISAGREE about
// where Hyper Rare sits relative to Special Illustration Rare, and about Crown
// Rare, which is Japanese-only and absent from the shared one. That is a real
// drift worth closing, but closing it reorders published grids, so it is named
// here rather than done quietly in a patch about something else.
const RARITY_ORDER = [
  "None", "Common", "Uncommon", "Rare", "Rare Holo", "Double rare", "Rare Holo V",
  "ACE SPEC Rare", "Ultra Rare", "Illustration rare", "Shiny rare", "Hyper rare",
  "Special illustration rare", "Secret Rare", "Shiny Ultra Rare", "Crown Rare",
  "Mega Hyper Rare",
];
// Every rarity string this run met that is not on the ladder above. Collected
// rather than defaulted, and it stops the run at the end: a tier nobody has
// placed cannot be ranked, and guessing "Rare" is how the two above hid.
const unknownRarities = new Map();
const rarityRank = (r, setId) => {
  // NO RARITY AT ALL IS NOT AN UNKNOWN TIER. The card mapper above writes
  // `rarity: null` for TCGdex's "None", which is most of an older set, so
  // treating null as unrecognised both floods the report with one useless entry
  // and, worse, promoted 162 unrarified cards to the top of the chase grid the
  // first time this fallback existed: ko-mask-of-change went from 0 chase cards
  // to 3 commons. "None" is rung 0 and is on the ladder on purpose.
  if (r == null || r === "" || String(r).toLowerCase() === "none") return 0;
  const want = String(r).toLowerCase();
  const i = RARITY_ORDER.findIndex((x) => x.toLowerCase() === want);
  if (i === -1) {
    const k = String(r);
    if (!unknownRarities.has(k)) unknownRarities.set(k, new Set());
    unknownRarities.get(k).add(setId || "?");
    // Ranked at the TOP while the run finishes, not the bottom, so the card is
    // visible in the grid rather than hidden by the very fallback being
    // reported. The run fails either way; this only decides what you look at.
    return RARITY_ORDER.length;
  }
  return i;
};
// What we are willing to call a hit on the page.
const CHASE_MIN = RARITY_ORDER.indexOf("ACE SPEC Rare");

// ------------------------------------------------------------------------ main

const map = JSON.parse(await readFile(join(ROOT, "data/intl-rips.json"), "utf8"));
const entries = Object.entries(map.sets || {});

await loadSpecies();

const warnings = [];
// Guides whose checklist came back empty. Kept apart from `warnings` because
// these set the exit code: a guide that states a card count and shows no cards
// is a page making a confident claim about a set it has no data for.
const emptySets = [];
const guides = {};

for (const [id, e] of entries) {
  // Where the checklist is read from. Korean and Chinese sets have none of their
  // own, so `dataFrom` points at the Japanese set they were translated from.
  const src = e.dataFrom || { lang: e.lang, id: e.tcgdexId };
  const borrowed = Boolean(e.dataFrom);

  const own = await getJson(`${TCGDEX}/${e.lang}/sets/${e.tcgdexId}`, `${e.lang}-${e.tcgdexId}`);
  const from = borrowed ? await getJson(`${TCGDEX}/${src.lang}/sets/${src.id}`, `${src.lang}-${src.id}`) : own;

  if (!own && !from) {
    warnings.push(`${id}: TCGdex has nothing for ${e.lang}/${e.tcgdexId} and no fallback resolved`);
    continue;
  }
  if (!own) warnings.push(`${id}: no ${e.lang} record, running entirely on ${src.lang}/${src.id}`);

  const meta = own || from;
  // `|| []` HERE PUBLISHED TWO SET GUIDES WITH NO SET IN THEM. TCGdex answering
  // the set endpoint without a `cards` array is not the same event as a set with
  // no cards, and this line could not tell them apart: the guard above only
  // fires when NEITHER record resolves, and both of these resolved fine. The
  // result on disk right now is ja-cyber-judge published with cardCount 71 and
  // an empty checklist, and zh-gem-pack-2 with cardCount 15 and an empty
  // checklist. Both render as complete guides that state a card count and then
  // show nothing, which is the most confident way to be wrong.
  const list = from?.cards || [];
  if (!list.length) {
    const declared = (borrowed ? from : meta)?.cardCount?.total ?? null;
    // NOT skipped. Dropping the guide here would delete its page on the next
    // build and 404 every link to it, which trades a wrong page for a broken
    // one. The entry is written as it always was and the RUN fails instead, so
    // the tree on disk is unchanged and a human is told exactly which cache
    // file to delete.
    emptySets.push(
      `${id}: TCGdex returned no card list for ${src.lang}/${src.id}` +
        (declared ? `, though the same response declares ${declared} cards` : "") +
        `. Delete .cache/tcgdex/${src.lang}-${src.id}.json and re-run.`
    );
  }

  // One request per card for rarity and dex number. Cached, so this only costs
  // anything on the very first run or under --force.
  const detailed = await pool(list, 6, async (c) => {
    try {
      return await getJson(`${TCGDEX}/${src.lang}/cards/${c.id}`, `${src.lang}-card-${c.id}`);
    } catch {
      return null;
    }
  });

  // Anything numbered past the printed set is a secret rare. This is arithmetic
  // on the set's own card counts, the same rule the English guides use, and it
  // matters here because TCGdex records the rarity of older sets' secrets as
  // "None" rather than naming them. Deriving the fact beats printing "None".
  const official = (borrowed ? from : meta)?.cardCount?.official ?? null;

  const cards = list.map((brief, i) => {
    const full = detailed[i];
    const dex = Array.isArray(full?.dexId) ? full.dexId[0] : full?.dexId || null;
    const native = brief.name || full?.name || "";
    const num = Number(brief.localId);
    return {
      localId: brief.localId || null,
      native,
      en: englishName({ dexId: dex, native, category: full?.category }),
      rarity: full?.rarity && full.rarity !== "None" ? full.rarity : null,
      category: full?.category || null,
      secret: Boolean(official && Number.isFinite(num) && num > official),
      // Two sizes on purpose. TCGdex serves high.webp at about 170KB and
      // low.webp at 26KB for the same card, and the grid renders it at 245px
      // wide, so twelve chase tiles at full size would have been 2MB of image
      // to show thumbnails. The big one is only fetched if somebody taps to
      // enlarge it.
      image: full?.image ? `${full.image}/low.webp` : null,
      imageLarge: full?.image ? `${full.image}/high.webp` : null,
      illustrator: full?.illustrator || null,
    };
  });

  const rarities = {};
  for (const c of cards) if (c.rarity) rarities[c.rarity] = (rarities[c.rarity] || 0) + 1;

  // The grid at the top of the page. A card qualifies on a named high rarity OR
  // on being numbered past the printed set, because the older sets have real
  // secret rares that TCGdex simply never labelled. Sorting by rarity first and
  // number second keeps the best card in the top-left on every set.
  // Rarity decides the tier and nothing else may reorder across tiers, because
  // that would misrepresent which card is the better pull. WITHIN a tier the
  // order was previously just the card number, which is arbitrary, so it is
  // used instead to lead with the cards a US reader can actually read and see:
  // a picture first, then a name in English. A tiebreak, not a ranking.
  const score = (c) => (c.image ? 2 : 0) + (c.en ? 1 : 0);
  const qualifying = cards.filter((c) => rarityRank(c.rarity, id) >= CHASE_MIN || c.secret);
  const notable = qualifying
    .sort(
      (a, b) =>
        rarityRank(b.rarity, id) - rarityRank(a.rarity, id) ||
        score(b) - score(a) ||
        (Number(b.localId) || 0) - (Number(a.localId) || 0)
    )
    .slice(0, 12);
  // THE CAP BINDS ON MOST SETS AND THAT IS FINE; SAY SO ANYWAY. Twelve tiles is
  // a layout decision, not a claim about the set, but a reader cannot tell a
  // grid that shows everything from a grid that shows the first twelve of
  // thirty-seven. Printed per set so the size of what is hidden is visible, and
  // so a run where the number jumps is noticeable.
  if (qualifying.length > notable.length) {
    console.log(`  ${id.padEnd(22)} chase grid shows ${notable.length} of ${qualifying.length} qualifying cards`);
  }
  // A guide with a checklist and no chase grid renders a page whose whole top
  // band is missing, which reads as a set with nothing worth pulling rather
  // than as a rule that did not fire. ko-mask-of-change did exactly this: 101
  // cards, top rarity "Double rare", `official` equal to the card count so
  // nothing is secret, and an empty grid with no warning anywhere.
  if (cards.length && !notable.length) {
    warnings.push(
      `${id}: ${cards.length} cards and NOT ONE qualifies for the chase grid, so the page ` +
        `renders with no grid at all. Top rarity present is ` +
        `"${[...new Set(cards.map((c) => c.rarity).filter(Boolean))].sort((a, b) => rarityRank(b, id) - rarityRank(a, id))[0] || "none"}", ` +
        `and CHASE_MIN is "${RARITY_ORDER[CHASE_MIN]}". Either the set genuinely has no hits, ` +
        `or its rarities are spelled differently from RARITY_ORDER in this file.`
    );
  }

  const translated = cards.filter((c) => c.en).length;
  const pokemon = cards.filter((c) => c.category === "Pokemon").length;
  if (pokemon && translated / pokemon < 0.9) {
    warnings.push(`${id}: only ${translated} of ${pokemon} Pokemon cards resolved an English name`);
  }

  guides[id] = {
    ...e,
    published: e.published || null,
    langName: LANG_NAME[e.lang] || e.lang,
    langFlag: LANG_FLAG[e.lang] || "",
    script: LANG_SCRIPT[e.lang] || null,
    // ONLY from the set's own record. Falling back to `meta` took the name from
    // whichever record resolved, and for a set with no record of its own that is
    // the Japanese one: Korean Battle Partners published バトルパートナーズ as
    // its "Korean" name, in the page heading and in the meta description.
    native: e.native || own?.name || null,
    released: meta?.releaseDate || null,
    serie: meta?.serie?.name || null,
    // Only publish a count we can stand behind. A borrowed checklist reports the
    // source set's numbers and the page says so.
    cardCount: {
      total: (borrowed ? from : meta)?.cardCount?.total ?? null,
      official: (borrowed ? from : meta)?.cardCount?.official ?? null,
    },
    declaredCount: own?.cardCount?.total ?? null,
    dataSource: { lang: src.lang, id: src.id, borrowed, langName: LANG_NAME[src.lang] || src.lang },
    hasCards: cards.length > 0,
    hasImages: cards.some((c) => c.image),
    cards,
    rarities,
    notable,
    // NO tcgdexUrl. www.tcgdex.net does not exist: the root, and every
    // /<lang>/sets/<id> path this used to build, answer 404. TCGdex publishes
    // api.tcgdex.net, assets.tcgdex.net and tcgdex.dev and has no consumer
    // site, so there is nothing here to link a reader to.
  };

  const c = guides[id];
  console.log(
    `  ${id.padEnd(20)} ${String(c.english).padEnd(17)} ${String(c.cards.length).padStart(3)} cards` +
      `${c.hasImages ? ", images" : ""}${borrowed ? `, from ${src.lang}/${src.id}` : ""}` +
      `${c.notable.length ? `, ${c.notable.length} chase` : ""}`
  );
}

const doc = {
  checked: new Date().toISOString().slice(0, 10),
  source: map.source || "TCGdex + PokeAPI",
  sets: guides,
};
await writeFile(OUT, JSON.stringify(doc, null, 2) + "\n");

console.log(
  `\nWrote public/data/intl-guides.json` +
    `\n  ${Object.keys(guides).length} guides, ${fetched} fetched, ${served} from cache`
);
if (warnings.length) {
  console.log(`\n${warnings.length} thing(s) to look at:`);
  for (const w of warnings) console.log("  " + w);
}

// EXIT CODE, BECAUSE EVERYTHING ABOVE IS PROSE ON STDOUT. Both of these are
// failures that publish something wrong rather than nothing, so neither may end
// a run at 0.
let _bad = 0;
if (emptySets.length) {
  _bad += emptySets.length;
  console.error(
    `\n${emptySets.length} guide(s) published a card count with an EMPTY checklist:\n  ` +
      emptySets.join("\n  ")
  );
}
if (unknownRarities.size) {
  _bad += unknownRarities.size;
  console.error(
    `\n${unknownRarities.size} rarity name(s) are not on RARITY_ORDER in this file, so nothing ` +
      `can rank them:\n  ` +
      [...unknownRarities].map(([r, sets]) => `"${r}"  (${[...sets].join(", ")})`).join("\n  ") +
      `\nAdd each one to RARITY_ORDER at the tier it belongs to. Do not leave them off: the ` +
      `old fallback ranked an unknown rarity as "Rare", which dropped every Mega Hyper Rare ` +
      `and every Secret Rare out of the chase grid without a word.`
  );
}
if (_bad) process.exit(1);
