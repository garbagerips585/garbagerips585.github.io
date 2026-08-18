#!/usr/bin/env node
// Resolve the hunt list in data/wanted.json against the Pokemon TCG API and
// write public/data/wanted.json for the site.
//
//   node scripts/sync-wanted.mjs           use the cache where possible
//   node scripts/sync-wanted.mjs --force   refetch every card
//
// What it fills in: the card image, the TCGplayer link, and the raw market
// price. Graded prices come from data/psa10.json, which is fed either by hand
// through the spreadsheet or by scripts/sync-prices.mjs. Nothing here ever
// invents a price: a card with no figure shows no figure.
//
// Shares the cache and the backoff behaviour of sync-sets.mjs, because the API
// answers 500/502 rather than 429 when it is unhappy.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "ptcg");
const API = "https://api.pokemontcg.io/v2";
const FORCE = process.argv.includes("--force");

// Our set ids -> the API's, same map sync-sets.mjs uses.
const SET_MAP = {
  "pitch-black": "me5", "chaos-rising": "me4", "perfect-order": "me3",
  "ascended-heroes": "me2pt5", "phantasmal-flames": "me2", "mega-evolution": "me1",
  "black-bolt": "zsv10pt5", "white-flare": "rsv10pt5", "destined-rivals": "sv10",
  "journey-together": "sv9", "prismatic-evolutions": "sv8pt5", "surging-sparks": "sv8",
  "stellar-crown": "sv7", "shrouded-fable": "sv6pt5", "twilight-masquerade": "sv6",
  "temporal-forces": "sv5", "paldean-fates": "sv4pt5", "paradox-rift": "sv4",
  "obsidian-flames": "sv3", "151": "sv3pt5", "paldea-evolved": "sv2",
  "scarlet-violet": "sv1", "pokemon-go": "pgo",
  "crown-zenith": "swsh12pt5", "celebrations": "cel25", "chilling-reign": "swsh6",
  "shining-fates": "swsh45", "rebel-clash": "swsh2",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Same honest agent string the other syncs send.
const UA = "GarbageRips585/1.0 (fan site; youtube.com/@GarbageRips585)";

async function apiGet(path, { tries = 6 } = {}) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${API}/${path}`, {
        headers: { "User-Agent": "garbagerips.com/1.0" },
      });
      if (res.ok) return res.json();
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = String(e.message || e).slice(0, 60);
    }
    await sleep(2000 + i * 2500);
  }
  throw new Error(`${path} failed after ${tries} tries (${last})`);
}

/** Highest market price across all printings, or 0 when there is no data. */
function marketPrice(card) {
  const prices = card?.tcgplayer?.prices || {};
  const vals = Object.values(prices)
    .map((p) => (p && typeof p === "object" ? p.market || p.mid : null))
    .filter((n) => typeof n === "number" && n > 0);
  return vals.length ? Math.max(...vals) : 0;
}

/**
 * The card's TCGplayer page, with somebody else's commission taken off it.
 *
 * The Pokemon TCG API hands back `prices.pokemontcg.io/tcgplayer/<id>`, which
 * looks like a neutral redirect and is not: it 302s to
 * `tcgplayer.pxf.io/scrydex?u=...` and lands on TCGplayer carrying Scrydex's
 * Impact Radius click id. Every buy link on /wanted.html was earning a third
 * party a commission, on a site that tells readers "Not affiliate links" on
 * five other pages. Whatever we decide about affiliate links later, it will not
 * be by accident and it will not pay somebody else.
 *
 * So the redirect is followed once, here, and the tracking query is thrown
 * away, leaving the plain product URL. The wrapper is also unreliable (three of
 * nine answered 500 or 502 on a first pass), which is a second reason not to
 * put it between a reader and the shop.
 *
 * Returns null rather than a guess when it cannot resolve: build-wanted.mjs
 * renders an unlinked card in that case, which is honest.
 */
async function directTcgplayer(url) {
  if (!url) return null;
  if (/^https:\/\/(?:www\.)?tcgplayer\.com\//.test(url)) return url.split("?")[0];
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { redirect: "follow", headers: { "user-agent": UA } });
      const final = r.url || "";
      if (/tcgplayer\.com\/product\//.test(final)) return final.split("?")[0];
    } catch {}
    await sleep(800 * (i + 1));
  }
  console.log(`  could not resolve a direct TCGplayer link, leaving the card unlinked`);
  return null;
}

/**
 * All cards in a set, across every page.
 *
 * Pages hold 250 and several sets are bigger: Ascended Heroes has 295. Reading
 * page one only made every card numbered past the 250th invisible, which is how
 * Mega Dragonite ex #290 came back as "no such card" when it exists.
 */
async function setCards(apiId) {
  const out = [];
  const PAGE_CAP = 6;
  let total = null;
  for (let page = 1; page <= PAGE_CAP; page++) {
    const file = join(CACHE, `${apiId}-p${page}.json`);
    let res = null;
    if (!FORCE) {
      try {
        res = JSON.parse(await readFile(file, "utf8"));
      } catch {
        /* not cached */
      }
    }
    if (!res) {
      res = await apiGet(`cards?q=set.id:${apiId}&pageSize=250&page=${page}`);
      await mkdir(CACHE, { recursive: true });
      await writeFile(file, JSON.stringify(res));
    }
    if (typeof res?.totalCount === "number") total = res.totalCount;
    const got = res.data || [];
    out.push(...got);
    if (got.length < 250) break;
    // `out.length >= (res.totalCount || out.length)` IS ALWAYS TRUE WHEN
    // totalCount IS ABSENT, because it becomes `out.length >= out.length`. The
    // walk then ends on a full 250 card page and hands back a slice as if it
    // were the set, which is the exact paragraph above this function describing
    // Mega Dragonite ex #290 coming back as "no such card" when it exists. The
    // fallback that was meant to be harmless recreates the bug the fix removed.
    // Same shape as the `|| 0` taken out of sync-sets.mjs.
    if (total == null) {
      throw new Error(
        `setCards("${apiId}"): a full 250 card page came back with no totalCount, so there is ` +
          `nothing to say whether ${out.length} cards is the whole set. Delete ` +
          `.cache/ptcg/${apiId}-p${page}.json and re-run. Do not read a missing count as done: ` +
          `that is how a card numbered past 250 becomes "no such card".`
      );
    }
    if (out.length >= total) break;
  }
  if (total != null && out.length < total) {
    throw new Error(
      `setCards("${apiId}") stopped at ${out.length} of ${total} cards on the ${PAGE_CAP} page ` +
        `cap. Raise PAGE_CAP: a short checklist looks exactly like a complete one, and every ` +
        `card past the last page reads as "no such card".`
    );
  }
  return out;
}

/**
 * THE CHECKLIST IS THE PRICE, THE RARITY AND THE SCAN.
 *
 * public/data/cards/<set>.json is TCGdex with TCGplayer market prices, and it
 * is what /sets/, /cards.html, /rarity.html, /complete-a-set.html and every
 * Pokedex page already print. This script read api.pokemontcg.io instead, which
 * is a second vendor reading the same moving market on a different day, and the
 * page ended up disagreeing with the rest of the site about the same card:
 * Mega Charizard X ex at $712.54 here against $715.98 everywhere else, and
 * three more like it about a dollar apart.
 *
 * Worse than the dollar: api.pokemontcg.io carries NO prices for the four
 * newest sets, so Mega Darkrai ex, Mega Greninja ex, Meowth ex and Mega
 * Dragonite ex printed "no market price yet" under a footnote explaining that a
 * set this new often has none, while the checklist priced all four ($233.10,
 * $212.59, $128.67, $704.76) and the set guides showed those figures. The
 * explanation had stopped being true and the page kept giving it.
 *
 * The API is still read, for one thing it has and the checklist does not: the
 * TCGplayer product link.
 */
const checklistFor = async (setId) => {
  try {
    const doc = JSON.parse(await readFile(join(ROOT, `public/data/cards/${setId}.json`), "utf8"));
    return { checked: doc.checked || null, by: new Map(doc.cards.map((c) => [String(Number(c.n)), c])) };
  } catch {
    return null;
  }
};
const CHECKLIST = new Map();

/**
 * The links this file already resolved, so a bad day at api.pokemontcg.io
 * cannot delete them.
 *
 * directTcgplayer() has to follow prices.pokemontcg.io's redirect to find the
 * plain product URL, and that host answers 502 under load often enough that a
 * run during one would have quietly unlinked eight of the ten cards. A product
 * URL does not change once resolved, so the previous answer is a better fallback
 * than null.
 */
let priorUrl = new Map();
try {
  const prev = JSON.parse(await readFile(join(ROOT, "public/data/wanted.json"), "utf8"));
  priorUrl = new Map((prev.cards || []).filter((c) => c.url).map((c) => [`${c.set}-${c.number}`, c.url]));
} catch {
  /* first run */
}

const source = JSON.parse(await readFile(join(ROOT, "data/wanted.json"), "utf8"));
// Graded prices live in one file for the whole site: hand-entered first, then
// whatever sync-prices.mjs fetched.
let graded = {};
try {
  graded = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8"));
} catch { /* optional */ }
const gradedFor = (setId, number) => {
  const k = `${setId}-${number}`;
  const m = graded.prices?.[k];
  if (m) return { price: m.price ?? m, asOf: m.asOf || null, source: m.source || null };
  const a = graded.auto?.[k];
  // Same floor as the set guides: under ten recorded sales is not a market.
  if (!a?.psa10 || (a.psa10Sales != null && a.psa10Sales < 10)) return null;
  return { price: a.psa10, asOf: a.asOf || null, source: a.source || null, sales: a.psa10Sales || null };
};
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const setName = new Map(sets.map((s) => [s.id, s.name]));

const out = [];
const problems = [];

for (const want of source.cards || []) {
  const apiId = SET_MAP[want.set];
  if (!apiId) {
    problems.push(`${want.name}: "${want.set}" is not a set id I know`);
    continue;
  }
  process.stdout.write(`  ${want.name} #${want.number} (${want.set})... `);

  let cards = [];
  try {
    cards = await setCards(apiId);
  } catch (e) {
    console.log(`API unavailable: ${e.message}`);
    problems.push(`${want.name}: could not reach the API`);
  }

  // Match on number first: a name alone is ambiguous when the same Pokemon has
  // an Ultra Rare, a Special Illustration Rare and a Mega Hyper Rare in one set.
  const card =
    cards.find((c) => String(c.number) === String(want.number)) ||
    cards.find((c) => c.name === want.name && /Special Illustration/i.test(c.rarity || ""));

  if (!card) {
    console.log("no such card");
    problems.push(`${want.name} #${want.number}: not found in ${want.set}`);
    continue;
  }
  if (card.name !== want.name) {
    problems.push(`#${want.number} in ${want.set} is "${card.name}", not "${want.name}"`);
  }

  if (!CHECKLIST.has(want.set)) CHECKLIST.set(want.set, await checklistFor(want.set));
  const cl = CHECKLIST.get(want.set);
  const row = cl?.by.get(String(Number(want.number))) || null;

  const listed = typeof row?.price === "number" && row.price > 0 ? row.price : 0;
  const apiRaw = marketPrice(card);
  const g = gradedFor(want.set, want.number);
  const autoRaw = graded.auto?.[`${want.set}-${want.number}`]?.rawNm ?? null;
  const scan = row?.img || null;
  const rarity = row?.rarity || card.rarity || want.rarity || null;
  out.push({
    set: want.set,
    setName: setName.get(want.set) || want.set,
    name: card.name,
    number: card.number,
    rarity,
    note: want.note || null,
    got: !!want.got,
    // TCGdex, which is the scan every other page on the site shows for this
    // card, and the only one of the two CDNs that also serves avif.
    image: scan ? `${scan}/low.webp` : card.images?.small || null,
    imageLarge: scan ? `${scan}/high.webp` : card.images?.large || null,
    url:
      (await directTcgplayer(card.tcgplayer?.url)) ||
      priorUrl.get(`${want.set}-${card.number}`) ||
      null,
    // Checklist first, then the API, then a hand-checked figure from the file,
    // so a card the market has not reached at all can still carry a number
    // somebody actually saw.
    raw: listed || apiRaw || (typeof want.raw === "number" ? want.raw : null) || autoRaw,
    rawFrom: listed || apiRaw ? "tcgplayer" : typeof want.raw === "number" ? "manual" : null,
    // THE RAW COLUMN GETS A DATE TOO. It always had one and never printed it,
    // so the page dated its PSA 10 figures and left the raw ones looking timeless.
    rawAsOf: listed ? cl?.checked || null : apiRaw ? card.tcgplayer?.updatedAt || null : null,
    // From data/psa10.json when it has one, else whatever this file carries.
    psa10: g?.price ?? (typeof want.psa10 === "number" ? want.psa10 : null),
    psa10AsOf: g?.asOf || want.psa10AsOf || null,
    psa10Source: g?.source || want.psa10Source || null,
  });
  const shown = listed || apiRaw;
  console.log(
    `${rarity || "?"}${shown ? `, $${shown}${listed ? " (checklist)" : " (api)"}` : ", no market price yet"}`
  );
  await sleep(400);
}

/**
 * A CARD THAT DROPPED OUT DOES NOT GET PUBLISHED AS A CARD THAT DROPPED OUT.
 *
 * Every failure above is tolerated on purpose and each one pushes a line into
 * `problems`. What was never decided is what happens NEXT: the loop `continue`s,
 * the card is simply absent from `out`, and this write then replaces a good
 * wanted.json with a shorter one. The page is /wanted.html, "the cards still
 * being chased", so an API wobble silently retires a card from the chase list
 * and the only trace is a line of stdout in a script nothing reads the output of.
 *
 * The same thing happens one level down. A card that resolves but loses its
 * price writes `raw: null`, and the tile then reads as a card with no market
 * rather than a fetch that failed.
 *
 * So both are compared against the file already on disk, which is the last
 * version known to be complete, and either one refuses the write. Nothing is
 * lost by refusing: the old file is still correct, and the cache means a re-run
 * only refetches what failed.
 */
let _prevWanted = [];
try {
  _prevWanted = JSON.parse(await readFile(join(ROOT, "public/data/wanted.json"), "utf8")).cards || [];
} catch {
  /* first ever run */
}
if (_prevWanted.length) {
  const _key = (c) => `${c.set}-${c.number}`;
  const _now = new Map(out.map((c) => [_key(c), c]));
  const _gone = _prevWanted.filter((c) => !_now.has(_key(c)));
  const _lostPrice = _prevWanted.filter(
    (c) => typeof c.raw === "number" && c.raw > 0 && _now.has(_key(c)) && !(typeof _now.get(_key(c)).raw === "number" && _now.get(_key(c)).raw > 0)
  );
  if (_gone.length || _lostPrice.length) {
    throw new Error(
      `refusing to write public/data/wanted.json: ` +
        (_gone.length ? `${_gone.length} card(s) that were on the list no longer resolve (${_gone.map((c) => `${c.name} #${c.number}`).join(", ")}). ` : "") +
        (_lostPrice.length ? `${_lostPrice.length} card(s) lost a price they had (${_lostPrice.map((c) => `${c.name} #${c.number} was $${c.raw}`).join(", ")}). ` : "") +
        `See "Problems" above for the reason. The file on disk is unchanged and still correct; ` +
        `re-run once the source is answering. If a card is meant to come off the list, remove ` +
        `it from data/wanted.json rather than letting a failed fetch do it.`
    );
  }
}

await mkdir(join(ROOT, "public/data"), { recursive: true });
await writeFile(
  join(ROOT, "public/data/wanted.json"),
  JSON.stringify({ updated: source.updated || null, cards: out }, null, 0) + "\n"
);

const noRaw = out.filter((c) => !c.raw);
const noPsa = out.filter((c) => !c.psa10);
console.log(`
Wrote public/data/wanted.json  (${out.length} cards)
`);
if (noRaw.length) {
  console.log(`No raw market price yet (normal for a set this new):
  ${noRaw.map((c) => c.name).join(", ")}
`);
}
if (noPsa.length) {
  console.log(`No PSA 10 price yet for:
  ${noPsa.map((c) => `${c.name} #${c.number}`).join("\n  ")}

Either run  node --env-file=.env scripts/sync-prices.mjs  to fetch them, or put
a number you have seen into the Chase Cards tab with the date and the source.
`);
}
if (problems.length) {
  console.log(`Problems:\n  ${problems.join("\n  ")}\n`);
}
console.log("Next: node scripts/build-wanted.mjs\n");
