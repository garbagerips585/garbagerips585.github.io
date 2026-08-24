#!/usr/bin/env node
// Pull PSA 10 and raw near-mint prices for every chase card on the site.
//
//   node --env-file=.env scripts/sync-prices.mjs --probe    see one raw response
//   node --env-file=.env scripts/sync-prices.mjs            fetch everything
//   node --env-file=.env scripts/sync-prices.mjs --limit 40 stay inside a budget
//
// Needs PPT_API_KEY in the environment. Get one at
// https://www.pokemonpricetracker.com  (free tier: 100 credits a day, and a
// card with graded data costs 2, so about 50 cards a day; $9.99/mo lifts that
// to 20,000). The key goes in .env, which is gitignored, exactly like
// YT_API_KEY. Never paste it into a file that gets committed.
//
// WHY THIS EXISTS. The Pokemon TCG API gives raw TCGplayer prices and knows
// nothing about graded cards, so PSA 10 had to be typed in by hand. This reads
// it instead, and leaves anything hand-entered alone.
//
// HAND-ENTERED PRICES ALWAYS WIN. data/psa10.json keeps two sections:
// `prices`, which a person filled in through the spreadsheet, and `auto`,
// which this script owns and overwrites. The site prefers `prices` and falls
// back to `auto`, so a sync can never silently replace a number the owner checked
// himself.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SITE } from "../shared/site.mjs";
import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://www.pokemonpricetracker.com/api/v2";

// Our set ids -> theirs, confirmed against /v2/sets rather than matched by
// name. Two of these are why: fuzzy matching sent Scarlet & Violet to the 151
// set, because "scarletandviolet" is a prefix of "scarletandviolet151"; and
// Pokemon GO missed entirely because stripping non-alphanumerics turns the
// accented e in "Pokemon" into nothing rather than into an e.
const SET_MAP = {
  "pitch-black": "me05-pitch-black",
  "chaos-rising": "me04-chaos-rising",
  "perfect-order": "me03-perfect-order",
  "ascended-heroes": "me-ascended-heroes",
  "phantasmal-flames": "me02-phantasmal-flames",
  "mega-evolution": "me01-mega-evolution",
  "white-flare": "sv-white-flare",
  "black-bolt": "sv-black-bolt",
  "destined-rivals": "sv10-destined-rivals",
  "journey-together": "sv09-journey-together",
  "prismatic-evolutions": "sv-prismatic-evolutions",
  "surging-sparks": "sv08-surging-sparks",
  "stellar-crown": "sv07-stellar-crown",
  "shrouded-fable": "sv-shrouded-fable",
  "twilight-masquerade": "sv06-twilight-masquerade",
  "temporal-forces": "sv05-temporal-forces",
  "paldean-fates": "sv-paldean-fates",
  "paradox-rift": "sv04-paradox-rift",
  "obsidian-flames": "sv03-obsidian-flames",
  "151": "sv-scarlet-and-violet-151",
  "paldea-evolved": "sv02-paldea-evolved",
  "scarlet-violet": "sv01-scarlet-and-violet-base-set",
  "pokemon-go": "pokemon-go",
};
const KEY = process.env.PPT_API_KEY;
const PROBE = process.argv.includes("--probe");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  if (i === -1) return Infinity;
  // Number("0") is falsy, and "|| Infinity" would turn --limit 0 into "all".
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n >= 0 ? n : Infinity;
})();

if (!KEY) {
  console.error(`
No PPT_API_KEY found.

  1. Sign up at https://www.pokemonpricetracker.com and copy your API key.
  2. Put it in .env at the repo root, on its own line:

       PPT_API_KEY=your-key-here

  3. Run this with:  node --env-file=.env scripts/sync-prices.mjs --probe

.env is gitignored, so the key never reaches the repo.
`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// THE CONTACT URL FOLLOWS THE FLIP, AND IT IS THE SAME BUG shared/site.mjs WAS
// WRITTEN TO DELETE, POINTING THE OTHER WAY. This header used to name the real
// domain as a literal. That domain is bought but NOT YET SERVING -- the site is
// on the staging host until LIVE flips in shared/site.mjs -- so every request
// this script made introduced itself to an operator with an address that does
// not resolve, which is worse to them than sending no UA at all. Hardcoding the
// staging host instead would simply break on the day of the flip.
// Derived from SITE, so it is correct in both states and needs no launch step.
// scripts/sync-shop-map.mjs carries the same construction and the same reason.
const UA = `garbagerips585-prices/1.0 (${SITE}/grading.html; garbagerips585@gmail.com)`;

/** 60 calls a minute on the free and $9.99 tiers, so one per second is safe. */
let spent = 0;
async function apiGet(path, { tries = 4 } = {}) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${API}/${path}`, {
      headers: { Authorization: `Bearer ${KEY}`, "User-Agent": UA },
    }).catch((e) => ({ ok: false, status: 0, _err: String(e.message || e) }));

    if (res.ok) {
      spent++;
      return res.json();
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`key rejected (HTTP ${res.status}). Check PPT_API_KEY.`);
    }
    if (res.status === 402 || res.status === 429) {
      // Out of credits or going too fast. Neither is worth hammering.
      throw new Error(
        res.status === 402
          ? "out of credits for today. Re-run tomorrow, or use --limit to spread it out."
          : "rate limited. Wait a minute and re-run."
      );
    }
    last = `HTTP ${res.status}${res._err ? ` ${res._err}` : ""}`;
    await sleep(1500 + i * 2000);
  }
  throw new Error(`${path} failed after ${tries} tries (${last})`);
}

/**
 * Pull the two numbers we want out of a card.
 *
 * PSA 10 lives at ebay.salesByGrade.psa10. Their smartMarketPrice is a
 * weighted recent-window figure and is the one to show; medianPrice over all
 * recorded sales is the fallback, and is preferred to averagePrice because a
 * single silly sale moves an average and barely moves a median.
 *
 * Raw near mint is prices.market, the TCGplayer market price, which the
 * variants block confirms is the Near Mint printing.
 */
function extract(card) {
  const g = card?.ebay?.salesByGrade?.psa10;
  const psa10 = g?.smartMarketPrice?.price ?? g?.medianPrice ?? null;
  return {
    psa10: typeof psa10 === "number" && psa10 > 0 ? Math.round(psa10 * 100) / 100 : null,
    // How much to trust it. 539 sales at high confidence is a fact; three
    // sales is an anecdote, and the site should be able to tell them apart.
    psa10Confidence: g?.smartMarketPrice?.confidence || null,
    psa10Sales: typeof g?.count === "number" ? g.count : null,
    psa10LastSale: g?.lastSaleDate ? String(g.lastSaleDate).slice(0, 10) : null,
    rawNm: typeof card?.prices?.market === "number" ? card.prices.market : null,
    theirNumber: card?.cardNumber || null,
    theirName: card?.name || null,
  };
}

/* ------------------------------------------------------------- the targets */

const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
let wantedSrc = { cards: [] };
try {
  wantedSrc = JSON.parse(await readFile(join(ROOT, "data/wanted.json"), "utf8"));
} catch { /* optional */ }

const targets = [];
const seen = new Set();
for (const s of sets) {
  for (const c of s.chase || []) {
    const key = `${s.id}-${c.number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ key, setId: s.id, setName: s.name, name: c.name, number: c.number });
  }
}
for (const w of wantedSrc.cards || []) {
  const key = `${w.set}-${w.number}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const s = sets.find((x) => x.id === w.set);
  targets.push({ key, setId: w.set, setName: s?.name || w.set, name: w.name, number: w.number });
}

/* -------------------------------------------------------------------- probe */

// Credits are charged per CARD RETURNED, not per request: limit=1 with eBay
// data costs 2, limit=5 costs 10. So every query asks for exactly one card and
// searches by card number, which the API matches and which is unambiguous
// where a name is not: the same Pokemon often has three printings in one set.
const query = (t) =>
  `cards?setId=${encodeURIComponent(SET_MAP[t.setId])}` +
  `&search=${encodeURIComponent(t.number)}&includeEbay=true&limit=1`;

if (PROBE) {
  const t = targets.find((x) => SET_MAP[x.setId]) || targets[0];
  console.log(`Probing with ${t.name} #${t.number} (${t.setName})\n`);
  const res = await apiGet(query(t));
  const card = res?.data?.[0];
  console.log(card ? JSON.stringify(extract(card), null, 2) : "no card returned");
  console.log(`\nCredits used: ${spent * 2}\n`);
  process.exit(0);
}

/* --------------------------------------------------------------- the sweep */

let doc = { prices: {}, auto: {} };
try {
  doc = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8"));
} catch { /* first run */ }
doc.prices = doc.prices || {};
doc.auto = doc.auto || {};
const auto = {};

const today = localDay();
// Skip what we already have, or --limit re-buys the same cards every run: on
// the free tier day two would spend 74 of 90 credits re-pricing the 37 cards
// day one fetched, and advance eight.
const pending = targets.filter((t) => !doc.auto?.[t.key]);
const todo = pending.slice(0, LIMIT);
let hits = 0, misses = 0;
const problems = [];
const mismatches = [];

console.log(`${targets.length} cards total, ${targets.length - pending.length} already priced.`);
console.log(`Fetching ${todo.length} now (${todo.length * 2} credits), ${pending.length - todo.length} left after this.\n`);
for (const t of todo) {
  process.stdout.write(`  ${t.name} #${t.number} (${t.setName})... `);
  try {
    if (!SET_MAP[t.setId]) {
      console.log("set not on their side");
      misses++;
      continue;
    }
    const res = await apiGet(query(t));
    const card = res?.data?.[0];
    if (!card) {
      console.log("no match");
      misses++;
      continue;
    }
    const e = extract(card);

    // Their numbers look like "161/131", ours like "161". Compare the part
    // before the slash, and refuse the row on a mismatch rather than writing a
    // price for whichever card the search happened to return.
    const theirs = String(e.theirNumber || "").split("/")[0].trim();
    if (theirs !== String(t.number).trim()) {
      console.log(`wrong card back (#${e.theirNumber} "${e.theirName}"), skipped`);
      mismatches.push(`${t.key}: asked #${t.number}, got #${e.theirNumber}`);
      misses++;
      continue;
    }
    if (!e.psa10 && !e.rawNm) {
      console.log("matched, no prices");
      misses++;
      continue;
    }
    auto[t.key] = {
      psa10: e.psa10,
      psa10Confidence: e.psa10Confidence,
      psa10Sales: e.psa10Sales,
      psa10LastSale: e.psa10LastSale,
      rawNm: e.rawNm,
      asOf: today,
      source: "pokemonpricetracker.com",
    };
    hits++;
    console.log(
      `${e.psa10 ? `PSA10 $${e.psa10}${e.psa10Sales ? ` (${e.psa10Sales} sales)` : ""}` : "no PSA10"}` +
        `${e.rawNm ? `, raw $${e.rawNm}` : ""}`
    );
  } catch (e) {
    console.log(`stopped: ${e.message}`);
    problems.push(e.message);
    break;
  }
  await sleep(1100);
}

doc.auto = { ...(doc.auto || {}), ...auto };
await mkdir(join(ROOT, "data"), { recursive: true });
await writeFile(join(ROOT, "data/psa10.json"), JSON.stringify(doc, null, 2) + "\n");

const manual = Object.keys(doc.prices).length;
console.log(`
Wrote data/psa10.json

  fetched          ${hits}
  no data          ${misses}
  hand-entered     ${manual}  (untouched: these always win over a sync)
  credits used     ${spent * 2}
`);
if (mismatches.length) {
  console.log(`Skipped, because the search returned a different card:\n  ${mismatches.join("\n  ")}\n`);
}
if (problems.length) console.log(`Stopped early: ${problems.join("; ")}\n`);
console.log("Next: node scripts/build-set-pages.mjs && node scripts/sync-wanted.mjs && node scripts/build-wanted.mjs\n");
