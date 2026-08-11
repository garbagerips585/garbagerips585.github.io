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
// back to `auto`, so a sync can never silently replace a number Tim checked
// himself.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://www.pokemonpricetracker.com/api/v2";
const KEY = process.env.PPT_API_KEY;
const PROBE = process.argv.includes("--probe");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i > -1 ? Number(process.argv[i + 1]) || Infinity : Infinity;
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

/** 60 calls a minute on the free and $9.99 tiers, so one per second is safe. */
let spent = 0;
async function apiGet(path, { tries = 4 } = {}) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${API}/${path}`, {
      headers: { Authorization: `Bearer ${KEY}`, "User-Agent": "garbagerips585.com/1.0" },
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
 * Find a number in a response whose shape we have not seen.
 *
 * The API's exact field names are not documented publicly, and this was
 * written without a key to inspect. Rather than guess one path and silently
 * write nulls forever, walk the object for the first plausible match and
 * report which path won, so --probe tells us what to hard-code later.
 */
function findPrice(obj, patterns, path = "", depth = 0) {
  if (obj == null || depth > 6) return null;
  if (typeof obj === "number" && obj > 0) {
    return patterns.some((p) => p.test(path)) ? { value: obj, path } : null;
  }
  if (typeof obj !== "object") return null;
  for (const [k, v] of Object.entries(obj)) {
    const hit = findPrice(v, patterns, `${path}.${k}`, depth + 1);
    if (hit) return hit;
  }
  return null;
}

const PSA10_PATTERNS = [/psa[^a-z]*10/i, /grade[^a-z]*10/i];
const RAW_PATTERNS = [/near.?mint/i, /\bnm\b/i, /raw/i, /ungraded/i, /market/i];

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

if (PROBE) {
  const t = targets[0];
  console.log(`Probing with ${t.name} #${t.number} (${t.setName})\n`);
  const res = await apiGet(`cards?name=${encodeURIComponent(t.name)}&limit=1`);
  console.log(JSON.stringify(res, null, 2).slice(0, 4000));
  const card = res?.data?.[0] || res?.cards?.[0] || res;
  const psa = findPrice(card, PSA10_PATTERNS);
  const raw = findPrice(card, RAW_PATTERNS);
  console.log(`\n---\nPSA 10 found at: ${psa ? `${psa.path} = ${psa.value}` : "NOT FOUND"}`);
  console.log(`Raw NM found at: ${raw ? `${raw.path} = ${raw.value}` : "NOT FOUND"}`);
  console.log(`\nCredits used: ${spent}. Paste this output back and the field paths get hard-coded.\n`);
  process.exit(0);
}

/* --------------------------------------------------------------- the sweep */

let doc = { prices: {}, auto: {} };
try {
  doc = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8"));
} catch { /* first run */ }
doc.prices = doc.prices || {};
const auto = {};

const today = new Date().toISOString().slice(0, 10);
const todo = targets.slice(0, LIMIT);
let hits = 0, misses = 0;
const problems = [];

console.log(`Fetching ${todo.length} of ${targets.length} cards...\n`);
for (const t of todo) {
  process.stdout.write(`  ${t.name} #${t.number} (${t.setName})... `);
  try {
    const res = await apiGet(
      `cards?name=${encodeURIComponent(t.name)}&setId=${encodeURIComponent(t.setId)}&number=${encodeURIComponent(t.number)}&limit=1`
    );
    const card = res?.data?.[0] || res?.cards?.[0] || null;
    if (!card) {
      console.log("no match");
      misses++;
      continue;
    }
    const psa = findPrice(card, PSA10_PATTERNS);
    const raw = findPrice(card, RAW_PATTERNS);
    if (!psa && !raw) {
      console.log("matched, no prices");
      misses++;
      continue;
    }
    auto[t.key] = {
      psa10: psa?.value ?? null,
      rawNm: raw?.value ?? null,
      asOf: today,
      source: "pokemonpricetracker.com",
    };
    hits++;
    console.log(`${psa ? `PSA10 $${psa.value}` : "no PSA10"}${raw ? `, raw $${raw.value}` : ""}`);
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
  credits used     ${spent}
`);
if (problems.length) console.log(`Stopped early: ${problems.join("; ")}\n`);
console.log("Next: node scripts/build-set-pages.mjs && node scripts/sync-wanted.mjs && node scripts/build-wanted.mjs\n");
