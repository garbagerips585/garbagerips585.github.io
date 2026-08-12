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
// decide what counts as a hit; anything unrecognised sorts to the end of the
// commons rather than being promoted.
const RARITY_ORDER = [
  "None", "Common", "Uncommon", "Rare", "Rare Holo", "Double rare", "Rare Holo V",
  "ACE SPEC Rare", "Ultra Rare", "Illustration rare", "Shiny rare", "Hyper rare",
  "Special illustration rare", "Shiny Ultra Rare", "Crown Rare",
];
const rarityRank = (r) => {
  const i = RARITY_ORDER.findIndex((x) => x.toLowerCase() === String(r || "").toLowerCase());
  return i === -1 ? 3 : i;
};
// What we are willing to call a hit on the page.
const CHASE_MIN = RARITY_ORDER.indexOf("ACE SPEC Rare");

// ------------------------------------------------------------------------ main

const map = JSON.parse(await readFile(join(ROOT, "data/intl-rips.json"), "utf8"));
const entries = Object.entries(map.sets || {});

await loadSpecies();

const warnings = [];
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
  const list = from?.cards || [];

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
  const notable = cards
    .filter((c) => rarityRank(c.rarity) >= CHASE_MIN || c.secret)
    .sort(
      (a, b) =>
        rarityRank(b.rarity) - rarityRank(a.rarity) ||
        score(b) - score(a) ||
        (Number(b.localId) || 0) - (Number(a.localId) || 0)
    )
    .slice(0, 12);

  const translated = cards.filter((c) => c.en).length;
  const pokemon = cards.filter((c) => c.category === "Pokemon").length;
  if (pokemon && translated / pokemon < 0.9) {
    warnings.push(`${id}: only ${translated} of ${pokemon} Pokemon cards resolved an English name`);
  }

  guides[id] = {
    ...e,
    langName: LANG_NAME[e.lang] || e.lang,
    langFlag: LANG_FLAG[e.lang] || "",
    script: LANG_SCRIPT[e.lang] || null,
    native: e.native || meta?.name || null,
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
    tcgdexUrl: `https://www.tcgdex.net/${e.lang}/sets/${e.tcgdexId}`,
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
