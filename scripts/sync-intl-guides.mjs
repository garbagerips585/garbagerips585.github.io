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
// THREE SOURCES, ALL FREE AND KEYLESS
// TCGdex for sets, checklists, rarities and every card scan. PokeAPI for card
// names in English. TCGplayer for the checklist of a set TCGdex declares and
// then publishes no cards for, which is one guide of the thirteen.
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
//
// A THIRD SOURCE, FOR THE CHECKLIST ONLY, AND IT IS NOT A SECOND SCAN HOST.
// See THE TCGPLAYER FALLBACK below. TCGplayer supplies names, collector numbers
// and rarities for a set TCGdex declares and then publishes no cards for. The
// PICTURES still come from TCGdex, read out of public/data/printings, so
// avifPicture(), imgDims() and data/no-scan.json keep working unchanged and no
// url on this site points at a card scan on a host it did not point at before.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TCG_SET_INTL } from "../shared/tcgplayer.mjs";
import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "tcgdex");
const TCG_CACHE = join(ROOT, ".cache", "tcg-cards");
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

// ============================================================================
// THE TCGPLAYER FALLBACK: A CHECKLIST FOR A SET TCGDEX DECLARES AND NEVER FILLS
// ============================================================================
//
// THE PROBLEM IT SOLVES IS NOT MISSING ART. api.tcgdex.net answers
// /ja/sets/SV5M with a name, a release date and cardCount 71, and `cards: []`,
// and /ja/cards/SV5M-085 with a 404. The empty-checklist guard above therefore
// fired every night and /sets/ja-cyber-judge.html has been a 32,572-byte
// noindex stub with no card of its own on it. Meanwhile all 100 of that set's
// cards, every one with a TCGdex scan, are sitting in public/data/printings,
// which sync-all-printings.mjs builds from the tcgdex/cards-database CLONE
// rather than from the API. The two disagree; the clone is right.
//
// SO WHY NOT JUST READ THE CORPUS AND STOP THERE. Because of the rarity
// vocabulary, and that is the whole reason this block exists.
//
// **TCGPLAYER FILES JAPANESE CARDS UNDER THE JAPANESE LADDER AND TCGDEX DOES
// NOT.** Measured on this set, 2026-08-22, joining the two catalogues on
// collector number, 100 rows against 100 rows, and it is a clean bijection:
//
//       TCGplayer            TCGdex                     cards
//       Common               Common                       33
//       Uncommon             Uncommon                     22
//       Rare                 Rare                          7
//       Double Rare          Double rare                   6
//       ACE Rare             ACE SPEC Rare                 3
//       Art Rare             Illustration rare            12
//       Super Rare           Ultra Rare                    9
//       Special Art Rare     Special illustration rare     5
//       Ultra Rare           Mega Hyper Rare               3
//
// The left column is what is printed on the Japanese wrapper, and it is the
// vocabulary data/hits.json is written in, because Tim reads the tier off the
// wrapper: all thirteen non-English hit rows in that file say "Art Rare",
// "Super Rare" or "Double Rare". The right column is an anglicisation that
// shared/rarity.mjs deliberately refuses to map onto, and pickIntlPrinting
// therefore cannot match a log tier against it.
//
// **THAT IS WHY Incineroar ex RESOLVES NOW AND COULD NOT BEFORE.** Cyber Judge
// prints it twice, #022 and #085. The log says "Super Rare". Against TCGdex's
// words the candidates are "Double rare" and "Ultra Rare", so branch 1 finds no
// exact tier, branch 2 finds nothing unstated, and the rule correctly refuses.
// Against TCGplayer's they are "Double Rare" and "Super Rare", exactly one
// candidate carries the log's own word, and branch 1 answers #085.
// **NOTHING IN shared/intl-printing.mjs CHANGED.** The rule was always able to
// answer this; it was being asked in the wrong language.
//
// AND IT FIXES THE NAME AT THE SAME TIME, WHICH IS A SECOND INDEPENDENT MISS.
// The printings corpus stores the PokeAPI dex-number translation, which loses
// the decoration: both printings are filed under "Incineroar", so a match on
// "Incineroar ex" would have found zero candidates whatever the tier said.
// TCGplayer carries the English product name of the same card, decoration and
// all, and carries one for the Trainers and the Energy as well, which no
// keyless source this repo has ever reached does.
//
// ---------------------------------------------------------------------------
// THE ART STAYS ON TCGDEX AND THAT IS A CONTRACT, NOT A PREFERENCE.
// ---------------------------------------------------------------------------
//
// Every `image` written below is the `g` field of a public/data/printings
// record, which is an assets.tcgdex.net base you append /low.webp to. Four
// builders depend on that shape and one of them, build-games.mjs:213, derives a
// SERIES CODE by splitting that url on "/" and taking index 4. A tcgplayer-cdn
// url there produces a silently wrong code rather than an error. So no image
// url on this site moves host, avifPicture() and imgDims() keep working, and
// data/no-scan.json still applies. TCGplayer supplies WORDS here and nothing
// else.
//
// ---------------------------------------------------------------------------
// WHAT IS CHECKED BEFORE A SINGLE ROW IS PUBLISHED, AND WHY IT IS THIS STRICT.
// ---------------------------------------------------------------------------
//
// **AN UNKNOWN setName IS DROPPED RATHER THAN REJECTED**, which sync-products
// .mjs has said for months and which was re-proved here before this was
// written. Four queries against the Japanese card catalogue, 2026-08-22:
//
//       setName "SV5M: Cyber Judge"     totalResults    100   all 100 agree
//       setName "SV5M: Cybre Judge"     totalResults 30,071   0 agree
//       setName "SV99: Does Not Exist"  totalResults 30,071   0 agree
//       no setName filter at all        totalResults 30,071   0 agree
//
// The misspelling and the invented set return the SAME number as no filter at
// all, led by a set nobody asked for. A count proves nothing; the rows have to
// be read. (The filter is also case-INSENSITIVE while the rows come back in
// canonical case, so "sv5m: cyber judge" matches 100 products and then agrees
// with none of them. Pin the exact string, which TCG_SET_INTL already does.)
//
// So the whole pull is refused unless all seven of these hold:
//
//   1. every row agrees on setName AND productLineName, and the count of
//      agreeing rows equals the count fetched: no foreign row at all
//   2. setCode is single-valued and equals the guide's own tcgdexId
//   3. customAttributes.releaseDate is single-valued and equals the guide's
//      released date to the day
//   4. the set name after the colon equals the guide's `english`
//   5. the collector numbers are 1..N, contiguous, no duplicates, N equal to
//      the number of rows the search said existed
//   6. every number's DENOMINATOR is the same and equals TCGdex's own
//      cardCount.official. Two catalogues agreeing that the printed set is 71
//      cards long is what makes the 29 secrets above it derivable rather than
//      guessed.
//   7. every row joins to a public/data/printings record for the same set and
//      number, and the two agree on the CATEGORY, and on the SPECIES NAME where
//      the card is a Pokemon. That is 100 of 100 and 84 of 84 today.
//
// **A FAILURE ANYWHERE REFUSES THE WHOLE CHECKLIST RATHER THAN DROPPING A ROW**,
// and that is deliberate. The join is on collector number and nothing else, so
// one row landing on the wrong record is evidence the alignment slipped, not
// evidence about one card. Refusing costs us the page we already do not have;
// publishing a checklist off by one puts the wrong picture beside the wrong name
// on a reference page, which is the failure this repo spends the most words on.
//
// IT IS A RULE RATHER THAN A SPECIAL CASE. It fires for any guide whose TCGdex
// checklist is empty AND which is already pinned in TCG_SET_INTL. Today that is
// ja-cyber-judge alone: zh-gem-pack-2 is also empty and is deliberately NOT
// pinned there, because TCGplayer has no Chinese Pokemon catalogue, so it stays
// a stub and still fails this run. See the long note over TCG_SET_INTL.

const TCG_SEARCH = "https://mp-search-api.tcgplayer.com/v1/search/request?q=&isList=false&mpfev=1";
const TCG_HEADERS = {
  "content-type": "application/json",
  origin: "https://www.tcgplayer.com",
  referer: "https://www.tcgplayer.com/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};
/** url form of the product line in, display form on the rows out. */
const TCG_LINE_NAME = { pokemon: "Pokemon", "pokemon-japan": "Pokemon Japan" };

/** One page of singles. 50 is the size sync-products.mjs settled on. */
async function tcgPage(setName, line, from) {
  const body = {
    algorithm: "sales_dismax",
    from,
    size: 50,
    filters: {
      term: {
        productLineName: [line],
        // "Cards" rather than "Sealed Products", which is the only difference
        // between this query and sync-products.mjs's.
        productTypeName: ["Cards"],
        setName: [setName],
      },
      range: {},
      match: {},
    },
    listingSearch: {
      context: { cart: {} },
      filters: { term: {}, range: { quantity: { gte: 1 } }, exclude: { channelExclusion: 0 } },
    },
    context: { cart: {}, shippingCountry: "US" },
    settings: { useFuzzySearch: false, didYouMean: {} },
    sort: {},
  };
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(TCG_SEARCH, { method: "POST", headers: TCG_HEADERS, body: JSON.stringify(body) });
      if (res.ok) {
        const r = (await res.json()).results?.[0] || {};
        return { total: Number(r.totalResults) || 0, rows: r.results || [] };
      }
      if (res.status === 404) return { total: 0, rows: [] };
    } catch {
      /* fall through to the backoff */
    }
    await sleep(attempt * 2500);
  }
  throw new Error(`TCGplayer would not answer for "${setName}"`);
}

/**
 * Every single in one set, cached on disk with the day it was read.
 *
 * THE LISTINGS ARE THROWN AWAY BEFORE THE CACHE IS WRITTEN. Each row carries
 * every live seller listing for that product, which is 90% of the response and
 * is a price feed we are not allowed to publish here anyway: these pages carry
 * no prices, by this file family's own standing rule. Keeping them would put a
 * multi-megabyte file of other people's inventory in .cache for nothing.
 */
async function tcgCards(id, setName, line) {
  const file = join(TCG_CACHE, `${id}.json`);
  if (!FORCE && existsSync(file)) {
    const c = JSON.parse(await readFile(file, "utf8"));
    served++;
    return { rows: c.results, total: c.total, checked: c.fetched };
  }
  let rows = [];
  let total = 0;
  for (let from = 0; from < 2000; from += 50) {
    const page = await tcgPage(setName, line, from);
    total = page.total;
    rows = rows.concat(page.rows.map(({ listings, ...keep }) => keep));
    if (!page.rows.length || rows.length >= total) break;
    await sleep(700);
  }
  await mkdir(TCG_CACHE, { recursive: true });
  const doc = { fetched: localDay(), total, results: rows };
  await writeFile(file, JSON.stringify(doc));
  fetched++;
  return { rows, total, checked: doc.fetched };
}

/** "Litten - 075/071" -> "Litten". A name with no printed number keeps it all. */
const tcgCardName = (r) =>
  String(r.productName || "").replace(/\s+-\s+[A-Za-z0-9]+\/[A-Za-z0-9]+\s*$/, "").trim();

/**
 * Pokemon, Trainer or Energy, in TCGdex's own three words so the two records
 * can be compared. Read off customAttributes rather than off the name: a
 * Trainer carries a cardType of "Trainer - Item" and no hp, an Energy carries
 * "Special Energy" or "Basic Energy", and a Pokemon carries an energy type and
 * an hp. 100 of 100 agree with the corpus on this set.
 */
function tcgCategory(r) {
  const t = String((r.customAttributes?.cardType || [])[0] || "");
  if (/^Trainer\b/i.test(t)) return "Trainer";
  if (/\bEnergy$/i.test(t)) return "Energy";
  return r.customAttributes?.hp ? "Pokemon" : null;
}

/**
 * The species, with the decoration peeled off BOTH sides so the two catalogues
 * can be compared without asserting anything about the decoration itself. The
 * corpus writes "Iron-Leaves" and "Mr-Mime" where TCGplayer writes "Iron Leaves
 * ex" and "Mr. Mime"; stripping punctuation and one trailing suffix token from
 * each makes those "ironleaves" and "mrmime" on both sides. Applied
 * symmetrically, so a species whose name really did end in one of these tokens
 * would still match itself.
 */
const speciesKey = (s) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(vmax|vstar|gx|ex|v)$/, "");

/**
 * THE JAPANESE LADDER, ORDERED WITHIN ITSELF AND MAPPED ONTO NOTHING.
 *
 * RARITY_ORDER above is TCGdex's vocabulary. This is TCGplayer's Japanese one,
 * and the two are kept apart for the same reason shared/rarity.mjs keeps the
 * jp- tiers apart from the English ones: "asserting an equivalence the two
 * companies do not publish would be this site inventing a fact." Nothing here
 * says Art Rare IS Illustration Rare. It says Art Rare outranks Double Rare,
 * which is a statement made entirely inside one vocabulary.
 *
 * THE ORDER IS READ OFF THE SET'S OWN NUMBERING RATHER THAN CHOSEN. A Japanese
 * set numbers its secret block in ascending rarity, and Cyber Judge's runs
 * 072-083 Art Rare, 084-092 Super Rare, 093-097 Special Art Rare, 098-100 Ultra
 * Rare. So AR < SR < SAR < UR is the set telling us, in its own numbering, and
 * every one of those sits above the Double Rares at 016-044 in the printed set.
 * C < U < R < RR and the position of ACE follow RARITY_ORDER's own arrangement
 * of the same four rungs, which is where CHASE_MIN already cuts.
 *
 * **"Ultra Rare" IS ON BOTH LADDERS AND MEANS DIFFERENT TIERS ON EACH**, which
 * is exactly why they are two arrays and not one. On TCGdex's it is the rung
 * the Japanese wrapper calls SR; here it is the top of the set. That collision
 * is real and it is visible to a reader who opens two of these guides side by
 * side, so build-intl-pages.mjs says out loud which vocabulary a page is in.
 * **This is not the only guide with the gap** -- all seven Japanese guides carry
 * TCGdex's anglicised words against a rip log written in the wrapper's, which is
 * why 6 of the 13 intl hit rows that fail to resolve are "Art Rare" rows whose
 * only Art Rare printing TCGdex files as "Illustration rare".
 *
 * ==========================================================================
 * "Mega Ultra Rare" WAS THE PREDICTED LINE AND IT ARRIVED, 2026-08-22.
 * ==========================================================================
 *
 * The comment under this array said the M-series sets would need one, and all
 * FIVE of them do: exactly one card each, and it is the last card in the set.
 * Read off the same numbering evidence as the rest of this ladder, five sets
 * agreeing, secret block only:
 *
 *   M5  Abyss Eye       082-093 AR  094-111 SR  112-117 SAR  118-118 MUR
 *   M4  Ninja Spinner   084-095 AR  096-113 SR  114-119 SAR  120-120 MUR
 *   M3  Nihil Zero      081-092 AR  093-110 SR  111-116 SAR  117-117 MUR
 *   m1L Mega Brave      064-075 AR  076-086 SR  087-091 SAR  092-092 MUR
 *   m1S Mega Symphonia  064-075 AR  076-086 SR  087-091 SAR  092-092 MUR
 *
 * So AR < SR < SAR < Mega Ultra Rare is five sets telling us in their own
 * numbering, exactly as Cyber Judge's 072/084/093/098 told us AR < SR < SAR <
 * Ultra Rare. **THE ONE THING THE NUMBERING DOES NOT SETTLE is where Mega Ultra
 * Rare sits against "Ultra Rare", because no set prints both**: SV5M ends in
 * Ultra Rare and these five end in Mega Ultra Rare. It goes on top, and the
 * reason is stated rather than assumed -- each is the last and best card of its
 * own set, and the newer word is the newer generation's name for that slot. If
 * a set ever prints both, that set's numbering settles it and this line changes.
 *
 * ==========================================================================
 * WIDENING THIS LADDER ONTO THOSE FIVE GUIDES WAS CONSIDERED AND REFUSED.
 * ==========================================================================
 *
 * This comment used to end by saying that giving the five guides that DO have a
 * TCGdex checklist their TCGplayer words was "a bigger change than un-stubbing a
 * page and is deliberately not made here". It was measured on 2026-08-22 and it
 * is not made now either, because **it resolves FEWER of the six rows than the
 * narrow fix does, and on two guides the checklist it would import is wrong.**
 * See jpRarityWords below for what was done instead, and for the numbers.
 */
const JP_RARITY_ORDER = [
  "Common", "Uncommon", "Rare", "Double Rare", "ACE Rare",
  "Art Rare", "Super Rare", "Special Art Rare", "Ultra Rare",
  "Mega Ultra Rare",
];
const JP_CHASE_MIN = JP_RARITY_ORDER.indexOf("ACE Rare");
// Same shape and same reason as rarityRank: an unplaced tier stops the run
// rather than being guessed at. EVERY Japanese word this repo writes down goes
// through here, including the ones jpRarityWords stamps onto a guide whose
// checklist is TCGdex's, so a tier nobody has placed fails the run even though
// nothing ranks a chase grid by it.
const jpRarityRank = (r, setId) => {
  if (r == null || r === "") return 0;
  const want = String(r).toLowerCase();
  const i = JP_RARITY_ORDER.findIndex((x) => x.toLowerCase() === want);
  if (i === -1) {
    const k = String(r);
    if (!unknownRarities.has(k)) unknownRarities.set(k, new Set());
    unknownRarities.get(k).add(`${setId || "?"}, TCGplayer ladder`);
    return JP_RARITY_ORDER.length;
  }
  return i;
};

/**
 * The TCGdex scans for one set, keyed by collector number, out of the corpus
 * that already holds them. Keyed on the guide's NATIVE set name because that is
 * what public/data/printings files a Japanese set under, exactly as
 * shared/card-scan.mjs does.
 */
let printingShards = null;
async function printingsFor(setNative) {
  if (!printingShards) {
    printingShards = [];
    const dir = join(ROOT, "public/data/printings");
    for (const key of ["0", ..."abcdefghijklmnopqrstuvwxyz"]) {
      try {
        printingShards.push(JSON.parse(await readFile(join(dir, `${key}.json`), "utf8")));
      } catch {
        /* a shard that is not on disk simply holds nothing */
      }
    }
  }
  const out = new Map();
  for (const shard of printingShards) {
    for (const bucket of Object.values(shard)) {
      for (const rec of Array.isArray(bucket) ? bucket : [bucket]) {
        if (rec.s === setNative) out.set(String(Number(rec.i)), rec);
      }
    }
  }
  return out;
}

/**
 * The whole fallback, as one call that either hands back a checklist or hands
 * back the reason it refused.
 *
 * @returns {Promise<{cards:Array, meta:object}|{refused:string}>}
 */
async function tcgChecklist(id, guide, official, setNative) {
  const pin = TCG_SET_INTL[id];
  if (!pin) return { refused: `no TCGplayer set pinned in shared/tcgplayer.mjs` };
  if (!setNative) return { refused: `no native set name, so the scans cannot be joined` };

  const { rows: raw, total, checked } = await tcgCards(id, pin.setName, pin.line);
  if (!raw.length) return { refused: `TCGplayer lists no singles under "${pin.setName}"` };

  // 1. Every row is ours, and no foreign row came back at all. A dropped filter
  //    answers with the whole product line, so this is where that lands.
  const want = TCG_LINE_NAME[pin.line];
  const mine = raw.filter((r) => r.setName === pin.setName && r.productLineName === want);
  if (mine.length !== raw.length) {
    return {
      refused:
        `${raw.length - mine.length} of ${raw.length} rows are not "${pin.setName}" on ${want}. ` +
        `An unknown setName is DROPPED rather than rejected and answers with the whole line; ` +
        `re-probe and re-pin in shared/tcgplayer.mjs rather than filtering the strays out.`,
    };
  }
  if (total && mine.length !== total) {
    return { refused: `the search said ${total} products and ${mine.length} came back` };
  }

  // 2-4. The set we asked for is the set this guide is about. Same three axes
  //      sync-products.mjs checks before it puts a photograph on one of these
  //      pages, read off ALL the rows rather than off the first one.
  const codes = [...new Set(mine.map((r) => String(r.setCode || "").toLowerCase()))];
  const rels = [...new Set(mine.map((r) => String(r.customAttributes?.releaseDate || "").slice(0, 10)))];
  const tcgEnglish = pin.setName.includes(": ") ? pin.setName.slice(pin.setName.indexOf(": ") + 2) : pin.setName;
  const fail = [];
  if (codes.length !== 1 || codes[0] !== String(guide.tcgdexId || "").toLowerCase())
    fail.push(`setCode ${JSON.stringify(codes)} against tcgdexId ${JSON.stringify(guide.tcgdexId)}`);
  if (rels.length !== 1 || rels[0] !== (guide.released || null))
    fail.push(`releaseDate ${JSON.stringify(rels)} against released ${JSON.stringify(guide.released)}`);
  if (tcgEnglish !== guide.english)
    fail.push(`set name ${JSON.stringify(tcgEnglish)} against english ${JSON.stringify(guide.english)}`);

  // 5-6. The numbers, and the denominator that confirms the printed set size.
  const denoms = [...new Set(mine.map((r) => String(r.customAttributes?.number || "").split("/")[1] || ""))];
  const nums = mine.map((r) => Number(String(r.customAttributes?.number || "").split("/")[0]));
  const sorted = [...nums].sort((a, b) => a - b);
  const contiguous =
    sorted.length && sorted.every((n, i) => Number.isFinite(n) && n === i + 1);
  if (!contiguous)
    fail.push(`collector numbers are not 1..${sorted.length}: ${JSON.stringify(sorted.slice(0, 6))}...`);
  if (denoms.length !== 1) fail.push(`more than one denominator: ${JSON.stringify(denoms)}`);
  else if (official != null && Number(denoms[0]) !== Number(official))
    fail.push(`denominator /${denoms[0]} against TCGdex cardCount.official ${official}`);
  if (fail.length) return { refused: fail.join("; ") };

  // 7. The join to the scans, and the two cross-checks on every row.
  const corpus = await printingsFor(setNative);
  const cards = [];
  for (const r of mine.sort((a, b) => Number(String(a.customAttributes.number).split("/")[0]) - Number(String(b.customAttributes.number).split("/")[0]))) {
    const num = String(Number(String(r.customAttributes.number).split("/")[0]));
    const rec = corpus.get(num);
    if (!rec) return { refused: `no ${setNative} printing in public/data/printings for #${num}` };
    const cat = tcgCategory(r);
    if (cat !== rec.c)
      return { refused: `#${num} is a ${cat} on TCGplayer and a ${rec.c} in the printings corpus` };
    const en = tcgCardName(r);
    if (cat === "Pokemon" && speciesKey(en) !== speciesKey(rec.n))
      return { refused: `#${num} is "${en}" on TCGplayer and "${rec.n}" in the printings corpus` };
    const base = rec.g ? String(rec.g).replace(/\/(low|high)\.(webp|avif|png|jpg)$/, "") : null;
    cards.push({
      localId: rec.i || null,
      native: (rec.u ? rec.n : rec.p) || null,
      en: en || null,
      rarity: r.rarityName || null,
      category: rec.c || null,
      secret: Boolean(official && Number(num) > official),
      image: base ? `${base}/low.webp` : null,
      imageLarge: base ? `${base}/high.webp` : null,
      // The corpus does not carry one and TCGplayer does not publish one, so
      // this is null rather than absent: intl-printing.mjs's header points at
      // this field for a by-hand illustrator cross-check and a missing key
      // would read as a card with no artist rather than as a field we do not
      // have for this set.
      illustrator: null,
    });
  }
  return {
    cards,
    meta: {
      source: "TCGplayer",
      line: want,
      setName: pin.setName,
      setCode: mine[0].setCode,
      released: rels[0],
      denominator: Number(denoms[0]),
      checked,
      // The one field a page has to read before it writes a rarity word down.
      rarityVocab: "jp",
      art: "TCGdex, via public/data/printings",
    },
  };
}

// ============================================================================
// THE SAME VOCABULARY GAP ON A GUIDE THAT ALREADY HAS A CHECKLIST
// ============================================================================
//
// tcgChecklist above fires ONLY where TCGdex returns nothing, which is why it
// was safe: there was no checklist to overwrite. Six intl hit rows fail for the
// same vocabulary reason on five guides that DO have one, and this is the
// narrow answer to those six.
//
//   ja-abyss-eye      Goldeen   "Art Rare"  012 Common,   084 "Illustration rare"
//   ja-abyss-eye      Manectric "Art Rare"  023 Uncommon, 086 "Illustration rare"
//   ja-nihil-zero     Raticate  "Art Rare"  060 Uncommon, 092 "Illustration rare"
//   ja-nihil-zero     Aurorus   "Art Rare"  023 Uncommon, 084 "Illustration rare"
//   ja-mega-brave     Spearow   "Art Rare"  052 Common,   074 "Illustration rare"
//   ja-ninja-spinner  Frogadier "Art Rare"  021 Common,   087 "Illustration rare"
//
// ---------------------------------------------------------------------------
// WHY THE WORDS GO INTO THE QUESTION AND NOT ONTO THE PAGE. MEASURED, NOT FELT.
// ---------------------------------------------------------------------------
//
// The obvious move is the wide one: let tcgChecklist run on a guide that
// already has a TCGdex checklist and take TCGplayer's list instead, words and
// all, exactly as ja-cyber-judge does. It was measured on 2026-08-22 against
// all seven pinned Japanese guides and it is the WORSE fix on every axis.
//
// **IT RESOLVES FOUR OF THE SIX, NOT SIX.** Run honestly, with the seven axes
// left as strict as they are, ja-ninja-spinner and ja-mega-brave are REFUSED,
// so Frogadier and Spearow stay exactly as they are today.
//
// **AND THEY ARE REFUSED FOR A GOOD REASON: TCGPLAYER'S JAPANESE CATALOGUE IS
// WRONG ON BOTH OF THEM.** This is the part worth keeping, whatever anybody
// does next:
//
//   M4: Ninja Spinner   #044 Phanpy is MISSING; #032 Deoxys appears TWICE; and
//                       #037 Meowstic is stamped 037/080, which is M3's
//                       denominator on an M4 card.
//   m1L: Mega Brave     carries a foreign row, "Mew ex - 002/043", numbered
//                       151/165, filed under m1L by TCGplayer.
//
// **M4 RETURNS 120 ROWS AGAINST TCGDEX'S 120 CARDS**, because the missing card
// and the duplicate cancel each other out exactly. That is this file's own
// "a count proves nothing" happening again on a new set, and a wide fix that
// trusted the total would have published a Ninja Spinner guide with no Phanpy
// on it and two Deoxys at #32.
//
// **WHAT THE THREE SURVIVING GUIDES WOULD HAVE LOST IS NOT ONLY WORDS.**
// Counted per guide rather than assumed:
//
//                        chase tiles swapped   rows renamed   illustrators lost
//   ja-abyss-eye              5 of 12            24 of 118        116 of 118
//   ja-nihil-zero             5 of 12            26 of 117        114 of 117
//   ja-mega-symphonia         5 of 12            16 of 92          92 of 92
//
// All twelve tiles reorder on all three. The illustrator column is the one that
// decided it: shared/intl-printing.mjs's own header names the illustrator join
// as the repeatable, independent, by-hand confirmation that a chosen printing
// is the right card, and TCGplayer publishes no illustrator, so the wide fix
// pays for six hit rows by deleting the check that proves the six are right.
// (It would also have GAINED English names -- 94 to 118, 91 to 117, 77 to 92 --
// which is real and is the one argument on its side. It is not worth the rest.)
//
// **SO THE WORDS ARE USED TO ASK THE QUESTION AND NEVER TO ANSWER IT.** Nothing
// this function writes is published as a rarity, ranked in a ladder, counted in
// a histogram or shown in a chase grid. `rarity` stays TCGdex's on every card of
// all five guides. The one new field, `rarityJp`, is read by exactly one thing:
// the three builders that ask shared/intl-printing.mjs which printing a hit is.
// See shared/intl-vocab.mjs, which is the only caller.
//
// **AND THAT IS NOT MERELY THE CAUTIOUS CHOICE, IT IS THE ONLY WORKING ONE.**
// corpusScan in shared/card-scan.mjs cross-checks the chosen printing's rarity
// against the printings corpus before it hands back a scan, and that corpus is
// TCGdex's. Putting "Art Rare" on the row would have made every one of these
// six resolve and then lose its picture on the rip page and the plaque, which
// is a worse bug than the one being fixed and would have looked like a win.
//
// ---------------------------------------------------------------------------
// WHAT IS CHECKED, AND WHY IT IS PER-ROW HERE AND WHOLE-SET UP THERE.
// ---------------------------------------------------------------------------
//
// tcgChecklist refuses a whole set if one row is wrong, and its comment gives
// the reason: it is building the checklist OUT OF the TCGplayer rows, joining
// on collector number and nothing else, so a bad row is evidence the alignment
// slipped rather than evidence about one card.
//
// **HERE THE ROW IS ALREADY IDENTIFIED BY AN INDEPENDENT CATALOGUE.** TCGdex
// supplies the number, the name and the category; TCGplayer is being asked for
// one field on a row we can already name. So a row can be checked against its
// own counterpart instead of against an offset, and a disagreement is a fact
// about that card rather than about the alignment. A misalignment cannot hide:
// it would disagree on the species name almost everywhere, which is what the
// coverage figure below is for.
//
// The set-identity axes are NOT relaxed. 1 to 4 hold exactly as above, and a
// failure refuses the guide outright, because those say we fetched the right
// set at all. Then every row must ALSO clear, on its own:
//
//   - its denominator equals TCGdex's cardCount.official  (this is axis 6 made
//     per-row, and it is what catches Meowstic 037/080 and Mew ex 151/165)
//   - its number has not already been taken  (the duplicate Deoxys)
//   - TCGdex holds a card at that number
//   - the two agree on category, and on species where it is a Pokemon
//   - TCGdex already states a rarity for it, so this REPLACES a word rather
//     than inventing one. That is what keeps ja-stellar-miracle's 36 unstated
//     rows unstated and leaves pickIntlPrinting's unstated-survivor branch --
//     the thing that resolves Crabominable, Meditite and Raboot -- untouched.
//   - the word is on JP_RARITY_ORDER, so nothing unplaceable is ever stamped
//
// Measured on 2026-08-22, agreed rows over rows where BOTH catalogues state a
// tier: abyss-eye 118/118, nihil-zero 117/117, mega-brave 92/92, mega-symphonia
// 91/92, ninja-spinner 118/120, stellar-miracle 97/99, violet-ex 77/78.
//
// COVERAGE_MIN IS THE ALARM AND IT IS DELIBERATELY NOT 100%. Four of the rows
// above are the two catalogue faults; the rest are name disagreements, and both
// kinds are reported by name on every run. A slipped alignment would not cost
// two rows, it would cost nearly all of them.

/** Below this share of the contestable rows agreeing, the guide is refused. */
const JP_COVERAGE_MIN = 0.95;

/**
 * TCGplayer's Japanese rarity word for each card of a guide whose checklist is
 * TCGdex's, keyed by collector number.
 *
 * @returns {Promise<{words:Map<string,string>, notTaken:string[], pairs:Map,
 *                    agreed:number, contested:number}|{refused:string}>}
 */
async function jpRarityWords(id, guide, official, cards) {
  const pin = TCG_SET_INTL[id];
  if (!pin) return { refused: `no TCGplayer set pinned in shared/tcgplayer.mjs` };
  if (official == null) return { refused: `no TCGdex cardCount.official to check a denominator against` };
  if (!cards.length) return { refused: `no TCGdex checklist to put words on` };

  const { rows: raw, total } = await tcgCards(id, pin.setName, pin.line);
  if (!raw.length) return { refused: `TCGplayer lists no singles under "${pin.setName}"` };

  // Axes 1-4, unchanged and un-relaxed: is this the set we meant to ask about.
  const want = TCG_LINE_NAME[pin.line];
  const mine = raw.filter((r) => r.setName === pin.setName && r.productLineName === want);
  if (mine.length !== raw.length) {
    return {
      refused:
        `${raw.length - mine.length} of ${raw.length} rows are not "${pin.setName}" on ${want}. ` +
        `An unknown setName is DROPPED rather than rejected and answers with the whole line; ` +
        `re-probe and re-pin in shared/tcgplayer.mjs rather than filtering the strays out.`,
    };
  }
  if (total && mine.length !== total) {
    return { refused: `the search said ${total} products and ${mine.length} came back` };
  }
  const codes = [...new Set(mine.map((r) => String(r.setCode || "").toLowerCase()))];
  const rels = [...new Set(mine.map((r) => String(r.customAttributes?.releaseDate || "").slice(0, 10)))];
  const tcgEnglish = pin.setName.includes(": ") ? pin.setName.slice(pin.setName.indexOf(": ") + 2) : pin.setName;
  const fail = [];
  if (codes.length !== 1 || codes[0] !== String(guide.tcgdexId || "").toLowerCase())
    fail.push(`setCode ${JSON.stringify(codes)} against tcgdexId ${JSON.stringify(guide.tcgdexId)}`);
  if (rels.length !== 1 || rels[0] !== (guide.released || null))
    fail.push(`releaseDate ${JSON.stringify(rels)} against released ${JSON.stringify(guide.released)}`);
  if (tcgEnglish !== guide.english)
    fail.push(`set name ${JSON.stringify(tcgEnglish)} against english ${JSON.stringify(guide.english)}`);
  if (fail.length) return { refused: fail.join("; ") };

  // Then one row at a time, against its own counterpart.
  const byNum = new Map(cards.map((c) => [String(Number(c.localId)), c]));
  const words = new Map();
  const notTaken = [];
  const pairs = new Map();
  // THE DENOMINATOR IS COUNTED ON OUR SIDE AND THAT IS THE WHOLE POINT OF IT.
  // Counting only the rows that got far enough to be compared made the alarm
  // toothless in the one case it exists for: a pull where EVERY row carried the
  // wrong denominator would have been rejected row by row, left this count at
  // zero, and passed with a coverage of 1.0 and no words at all. Asking instead
  // how much of the checklist WE hold came back agreed cannot be gamed by the
  // rows failing earlier, and it falls the moment an alignment slips.
  const contested = cards.filter((c) => c.rarity).length;
  for (const r of mine) {
    const parts = String(r.customAttributes?.number || "").split("/");
    const num = String(Number(parts[0]));
    const label = tcgCardName(r) || r.productName;
    if (!Number.isFinite(Number(parts[0]))) {
      notTaken.push(`"${label}" has an unreadable number ${JSON.stringify(r.customAttributes?.number)}`);
      continue;
    }
    if (Number(parts[1]) !== Number(official)) {
      notTaken.push(
        `#${num} "${label}" is numbered /${parts[1]} against the printed set /${String(official).padStart(3, "0")}`
      );
      continue;
    }
    if (words.has(num)) {
      notTaken.push(`#${num} "${label}" is a SECOND TCGplayer row for that number`);
      continue;
    }
    const c = byNum.get(num);
    if (!c) {
      notTaken.push(`#${num} "${label}" has no row on the TCGdex checklist`);
      continue;
    }
    if (!c.rarity) continue; // TCGdex states no tier: left unstated, on purpose.
    const cat = tcgCategory(r);
    if (cat !== c.category) {
      notTaken.push(`#${num} is a ${cat} on TCGplayer and a ${c.category} on TCGdex`);
      continue;
    }
    if (cat === "Pokemon" && speciesKey(label) !== speciesKey(c.en || c.native)) {
      notTaken.push(`#${num} is "${label}" on TCGplayer and "${c.en || c.native}" on TCGdex`);
      continue;
    }
    if (!r.rarityName) {
      notTaken.push(`#${num} "${label}" carries no TCGplayer rarity`);
      continue;
    }
    // Every word gets a rung or the run fails. jpRarityRank reports it itself.
    if (jpRarityRank(r.rarityName, id) >= JP_RARITY_ORDER.length) {
      notTaken.push(`#${num} "${label}" is a "${r.rarityName}", which is not on JP_RARITY_ORDER`);
      continue;
    }
    words.set(num, r.rarityName);
    const k = r.rarityName;
    if (!pairs.has(k)) pairs.set(k, new Map());
    const m = pairs.get(k);
    m.set(c.rarity, (m.get(c.rarity) || 0) + 1);
  }
  const cover = contested ? words.size / contested : 0;
  if (cover < JP_COVERAGE_MIN) {
    return {
      refused:
        `only ${words.size} of the ${contested} TCGdex rows that state a tier agreed ` +
        `(${(cover * 100).toFixed(1)}%, ` +
        `floor ${(JP_COVERAGE_MIN * 100).toFixed(0)}%), which is what a slipped alignment looks like:\n      ` +
        notTaken.slice(0, 8).join("\n      "),
    };
  }
  return { words, notTaken, pairs, agreed: words.size, contested };
}

// ------------------------------------------------------------------------ main

const map = JSON.parse(await readFile(join(ROOT, "data/intl-rips.json"), "utf8"));
const entries = Object.entries(map.sets || {});

await loadSpecies();

const warnings = [];
// Guides whose checklist came back empty. Kept apart from `warnings` because
// these set the exit code: a guide that states a card count and shows no cards
// is a page making a confident claim about a set it has no data for.
const emptySets = [];
// Every reason the TCGplayer fallback declined a guide TCGdex left empty, and
// every guide it filled. Reported apart from `warnings` because a refusal here
// is not a new failure: it leaves the page exactly as it already is, and the
// emptySets line above still fails the run.
const tcgRefused = [];
const tcgFilled = [];
// The narrow vocabulary pass, reported apart from both of the above for the
// same reason: a refusal here changes nothing that is on the page today, it
// only leaves a hit row unresolved exactly as it already is.
const jpStamped = [];
const jpRefused = [];
const jpNotTaken = [];
const jpOutliers = [];
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

  // Anything numbered past the printed set is a secret rare. This is arithmetic
  // on the set's own card counts, the same rule the English guides use, and it
  // matters here because TCGdex records the rarity of older sets' secrets as
  // "None" rather than naming them. Deriving the fact beats printing "None".
  // READ BEFORE THE EMPTY BRANCH, because the TCGplayer fallback checks the
  // printed set size against the denominator on every collector number and
  // derives the same `secret` flag from it.
  const official = (borrowed ? from : meta)?.cardCount?.official ?? null;
  const setNative = e.native || own?.name || null;

  // THE TCGPLAYER FALLBACK. See the long note over TCG_SEARCH. It only ever
  // runs on a guide TCGdex has left with no cards at all, so it cannot change
  // what any of the other twelve publish.
  let tcgCards_ = null;
  let tcgMeta = null;
  if (!list.length) {
    // `released` is TCGdex's, off the set record rather than off intl-rips.json,
    // and it has to be handed over explicitly: the guide object below reads it
    // from `meta` and does not exist yet. Passing `e` alone compared TCGplayer's
    // release date against `undefined` and refused the set, which is the check
    // working and the caller being wrong.
    const got = await tcgChecklist(id, { ...e, released: meta?.releaseDate || null }, official, setNative);
    if (got.refused) tcgRefused.push(`${id}: ${got.refused}`);
    else {
      tcgCards_ = got.cards;
      tcgMeta = got.meta;
      tcgFilled.push(
        `${id}: ${got.cards.length} cards from ${got.meta.setName} on ${got.meta.line}` +
          ` [${got.meta.setCode} / ${got.meta.released} / x/${String(got.meta.denominator).padStart(3, "0")}]` +
          `, scans from ${got.meta.art}`
      );
    }
  }

  if (!list.length && !tcgCards_) {
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

  const cards = tcgCards_ || list.map((brief, i) => {
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

  // THE NARROW VOCABULARY PASS. See the long note over jpRarityWords. It runs
  // only on a guide whose checklist is TCGdex's -- a TCGplayer checklist is
  // already in this vocabulary and `rarityVocab: "jp"` says so -- and it adds a
  // field. It never touches `rarity`, so `rarities`, `notable` and every rung
  // printed on the page below are computed from exactly the words they were
  // computed from before this existed.
  if (!tcgMeta && cards.length && TCG_SET_INTL[id]) {
    const jp = await jpRarityWords(id, { ...e, released: meta?.releaseDate || null }, official, cards);
    if (jp.refused) {
      jpRefused.push(`${id}: ${jp.refused}`);
    } else {
      let stamped = 0;
      for (const c of cards) {
        const w = jp.words.get(String(Number(c.localId)));
        if (w) {
          c.rarityJp = w;
          stamped++;
        }
      }
      jpStamped.push(
        `${id}: ${stamped} card(s) carry a TCGplayer Japanese word beside TCGdex's` +
          ` (${jp.agreed} of the ${jp.contested} TCGdex rows that state a tier)`
      );
      for (const n of jp.notTaken) jpNotTaken.push(`${id}: ${n}`);
      // A tier the two catalogues genuinely disagree about, as opposed to the
      // same tier spelled two ways, shows up as a MINORITY pairing under a word
      // whose other rows all agree. Nothing is refused for it -- it is somebody
      // else's data, and the word taken is still the one on the wrapper -- but a
      // silent one would be a wrong answer nobody could see.
      for (const [jpWord, m] of jp.pairs) {
        if (m.size < 2) continue;
        const sorted = [...m].sort((a, b) => b[1] - a[1]);
        for (const [tx, n] of sorted.slice(1)) {
          jpOutliers.push(
            `${id}: "${jpWord}" lines up with "${sorted[0][0]}" on ${sorted[0][1]} card(s)` +
              ` but with "${tx}" on ${n}`
          );
        }
      }
    }
  }

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
  // ONE LADDER PER GUIDE, CHOSEN BY WHICH CATALOGUE WROTE THE WORDS. A rarity
  // string only means anything inside the vocabulary it was published in, and
  // "Ultra Rare" is on both ladders at different heights, so ranking a
  // TCGplayer row against RARITY_ORDER would sort this set's three gold Ultra
  // Rares below its Special Art Rares. See JP_RARITY_ORDER.
  const rank = tcgMeta ? jpRarityRank : rarityRank;
  const chaseMin = tcgMeta ? JP_CHASE_MIN : CHASE_MIN;
  const chaseMinName = tcgMeta ? JP_RARITY_ORDER[JP_CHASE_MIN] : RARITY_ORDER[CHASE_MIN];
  const score = (c) => (c.image ? 2 : 0) + (c.en ? 1 : 0);
  const qualifying = cards.filter((c) => rank(c.rarity, id) >= chaseMin || c.secret);
  const notable = qualifying
    .sort(
      (a, b) =>
        rank(b.rarity, id) - rank(a.rarity, id) ||
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
        `"${[...new Set(cards.map((c) => c.rarity).filter(Boolean))].sort((a, b) => rank(b, id) - rank(a, id))[0] || "none"}", ` +
        `and the cut is "${chaseMinName}". Either the set genuinely has no hits, ` +
        `or its rarities are spelled differently from the ladder this guide is ranked on.`
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
    //
    // A TCGPLAYER CHECKLIST OVERRIDES THE TOTAL AND LEAVES THE OFFICIAL ALONE,
    // and both halves of that are the point. TCGdex's record for Cyber Judge
    // says total 71 and official 71 because it holds no cards to count, while
    // the checklist we now hold is 100 rows long; publishing 71 over a list of
    // 100 would put the top of the page in disagreement with the bottom of it,
    // which is the one thing the English guides' single-source rule exists to
    // stop. `official` stays TCGdex's 71 because it is independently confirmed:
    // every collector number in the TCGplayer pull is written x/071, and the
    // fallback refuses the whole set if that denominator disagrees. So 71
    // printed cards plus 29 numbered past them is arithmetic on two catalogues
    // that agree, and `declaredCount` below still carries TCGdex's own 71 for
    // anybody who wants to see the disagreement.
    cardCount: {
      total: tcgMeta ? cards.length : (borrowed ? from : meta)?.cardCount?.total ?? null,
      official: (borrowed ? from : meta)?.cardCount?.official ?? null,
    },
    declaredCount: own?.cardCount?.total ?? null,
    dataSource: { lang: src.lang, id: src.id, borrowed, langName: LANG_NAME[src.lang] || src.lang },
    // Present ONLY on a guide whose checklist is not TCGdex's. Every page that
    // prints a rarity word has to know which vocabulary it is in, and every
    // page that credits a source has to credit the right one; both read this.
    // Absent rather than null on the other twelve, so a reader of the JSON can
    // tell "TCGdex, as always" from "somebody set this to nothing".
    ...(tcgMeta ? { checklistFrom: tcgMeta } : {}),
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
  checked: localDay(),
  source: map.source || "TCGdex + PokeAPI",
  sets: guides,
};
await writeFile(OUT, JSON.stringify(doc, null, 2) + "\n");

console.log(
  `\nWrote public/data/intl-guides.json` +
    `\n  ${Object.keys(guides).length} guides, ${fetched} fetched, ${served} from cache`
);
if (tcgFilled.length) {
  console.log(
    `\n${tcgFilled.length} guide(s) TCGdex left empty were filled from TCGplayer` +
      ` (names, numbers and Japanese rarities only; the scans stay on TCGdex):`
  );
  for (const t of tcgFilled) console.log("  " + t);
}
if (tcgRefused.length) {
  console.log(`\n${tcgRefused.length} guide(s) TCGdex left empty were NOT filled from TCGplayer:`);
  for (const t of tcgRefused) console.log("  " + t);
}
if (jpStamped.length) {
  console.log(
    `\n${jpStamped.length} guide(s) keep TCGdex's checklist and TCGdex's rarity words, and carry` +
      ` TCGplayer's Japanese word alongside for the hit join only:`
  );
  for (const t of jpStamped) console.log("  " + t);
}
if (jpNotTaken.length) {
  console.log(`\n${jpNotTaken.length} row(s) got NO Japanese word, each named so it can be checked:`);
  for (const t of jpNotTaken) console.log("  " + t);
}
if (jpOutliers.length) {
  console.log(
    `\n${jpOutliers.length} tier(s) the two catalogues do not agree about. The wrapper's word is` +
      ` still the one taken; this is here so the disagreement is not silent:`
  );
  for (const t of jpOutliers) console.log("  " + t);
}
if (jpRefused.length) {
  console.log(`\n${jpRefused.length} guide(s) were refused a Japanese vocabulary:`);
  for (const t of jpRefused) console.log("  " + t);
}
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
    `\n${unknownRarities.size} rarity name(s) are not on the ladder their guide is ranked ` +
      `against, so nothing can rank them:\n  ` +
      [...unknownRarities].map(([r, sets]) => `"${r}"  (${[...sets].join(", ")})`).join("\n  ") +
      `\nAdd each one to RARITY_ORDER, or to JP_RARITY_ORDER where the line above says the ` +
      `TCGplayer ladder, at the tier it belongs to. Do not leave them off: the ` +
      `old fallback ranked an unknown rarity as "Rare", which dropped every Mega Hyper Rare ` +
      `and every Secret Rare out of the chase grid without a word.`
  );
}
if (_bad) process.exit(1);
