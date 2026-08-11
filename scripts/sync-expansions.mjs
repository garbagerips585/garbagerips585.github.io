#!/usr/bin/env node
// Pull the complete list of Pokemon TCG sets into public/data/expansions.json.
//
//   node scripts/sync-expansions.mjs
//
// This is every English set the Pokemon TCG API knows about, 1999 to now: main
// expansions, promo sets, POP series kits, the lot. sync-sets.mjs pulls the
// full card list for the 23 sets Tim has actually ripped; this pulls only the
// set-level facts, but for all of them.
//
// Kept separate from sets.json on purpose. sets.json drives the Card Pokedex
// and the rip filters, and those must stay limited to sets he has opened, or
// the site starts claiming coverage it does not have. This file drives one
// page: the complete reference list.
//
// The response is cached under .cache/ptcg/all-sets.json by sync-sets.mjs and
// reused here when present, because that API rate-limits hard and answers 500
// rather than 429 when it is unhappy.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "ptcg", "all-sets.json");

const FORCE = process.argv.includes("--force");

async function pull() {
  if (!FORCE && existsSync(CACHE)) {
    const j = JSON.parse(await readFile(CACHE, "utf8"));
    return j.data || j;
  }
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch("https://api.pokemontcg.io/v2/sets?pageSize=250");
      if (res.ok) {
        const text = await res.text();
        // A 200 with an empty body happens under load. Treat it as a failure
        // rather than letting JSON.parse throw a useless syntax error.
        if (text.trim()) {
          await mkdir(dirname(CACHE), { recursive: true });
          await writeFile(CACHE, text);
          return JSON.parse(text).data;
        }
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, attempt * 3000));
  }
  throw new Error("api.pokemontcg.io would not return the set list");
}

const raw = await pull();

// Ours, so the page can link a set to its guide and say how many we ripped.
const { sets: mine } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

const bySlug = new Map(mine.map((s) => [s.apiId, s.id]));
const ripCount = {};
for (const v of videos) for (const s of v.sets || []) ripCount[s] = (ripCount[s] || 0) + 1;

/**
 * Promo sets, tournament kits and tie-in boxes are real sets and belong on a
 * complete list, but they are not what somebody means by "the next expansion".
 * Flagging them lets the page group them without dropping them.
 */
const isPromo = (s) =>
  /promo|black star|trainer kit|POP Series|McDonald|Best of|Legendary Collection Ex/i.test(s.name) ||
  s.series === "NP" ||
  s.series === "POP";

const sets = raw
  .map((s) => {
    const slug = bySlug.get(s.id) || null;
    return {
      apiId: s.id,
      name: s.name,
      series: s.series,
      released: (s.releaseDate || "").replace(/\//g, "-") || null,
      printedTotal: s.printedTotal ?? null,
      total: s.total ?? null,
      logo: s.images?.logo || null,
      symbol: s.images?.symbol || null,
      promo: isPromo(s),
      // null unless it is one of ours, which is what the page links on.
      slug,
      rips: slug ? ripCount[slug] || 0 : 0,
    };
  })
  .sort((a, b) => String(a.released).localeCompare(String(b.released)) || a.name.localeCompare(b.name));

// Series in first-release order, so the page reads as a timeline rather than
// whatever order the API happened to answer in.
const seriesOrder = [];
for (const s of sets) if (!seriesOrder.includes(s.series)) seriesOrder.push(s.series);

/**
 * Check every symbol image actually exists.
 *
 * The API hands out a symbol URL for all 174 sets and four of them 404: me3,
 * me4, me5 and me2pt5, which are Perfect Order, Chaos Rising, Pitch Black and
 * Ascended Heroes. Those are the four newest sets, so they sit at the top of
 * the page where a broken icon is most visible.
 *
 * Deciding this at sync time rather than with an onerror handler is deliberate:
 * onerror does not fire on a lazy image that is still below the fold, so the
 * broken icon would sit there and then vanish mid-scroll, shifting the row.
 *
 * Results are cached, so this costs one slow run and nothing after that.
 */
const okCache = join(ROOT, ".cache", "ptcg", "symbol-ok.json");
let known = {};
if (existsSync(okCache)) {
  try {
    known = JSON.parse(await readFile(okCache, "utf8"));
  } catch {}
}

const unchecked = sets.filter((s) => s.symbol && known[s.apiId] === undefined);
if (unchecked.length) {
  process.stdout.write(`Checking ${unchecked.length} set symbols`);
  // Six at a time: enough to finish quickly, gentle enough not to look abusive.
  for (let i = 0; i < unchecked.length; i += 6) {
    await Promise.all(
      unchecked.slice(i, i + 6).map(async (s) => {
        try {
          const res = await fetch(s.symbol, { method: "HEAD" });
          known[s.apiId] = res.ok;
        } catch {
          known[s.apiId] = false;
        }
      })
    );
    process.stdout.write(".");
  }
  process.stdout.write("\n");
  await writeFile(okCache, JSON.stringify(known, null, 2));
}
for (const s of sets) if (s.symbol && known[s.apiId] === false) s.symbol = null;

const out = {
  syncedAt: new Date().toISOString().slice(0, 10),
  source: "https://api.pokemontcg.io",
  seriesOrder,
  sets,
};

await writeFile(join(ROOT, "public/data/expansions.json"), JSON.stringify(out, null, 2) + "\n");

const ripped = sets.filter((s) => s.slug).length;
const cards = sets.reduce((n, s) => n + (s.total || 0), 0);
console.log(
  `Wrote public/data/expansions.json
  ${sets.length} sets across ${seriesOrder.length} series, ${sets[0].released} to ${sets.at(-1).released}
  ${cards.toLocaleString("en-US")} cards in total
  ${ripped} of them are sets we have ripped and link to a guide
  ${sets.filter((s) => s.promo).length} flagged as promo or tie-in sets`
);
