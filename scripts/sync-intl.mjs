#!/usr/bin/env node
// Pull the foreign-language sets behind each English one, from TCGdex.
//
//   node scripts/sync-intl.mjs           cached
//   node scripts/sync-intl.mjs --force   refetch
//
// Writes public/data/intl-sets.json, which build-set-pages.mjs renders as an
// "Also released as" panel on each English set guide.
//
// WHY TCGDEX AND NOT THE SOURCES ALREADY IN USE
// api.pokemontcg.io is English only. TCGplayer sells English product. Neither
// knows a Japanese set exists. TCGdex is open source, needs no key, and carries
// 218 English, 177 Japanese, 95 Korean and 98 Chinese sets, including all four
// of the newest English releases that the other two handle badly.
//
// THE MAPPING IS NOT ONE TO ONE and that is the whole reason this is worth
// showing. Mega Evolution, 188 cards, is Mega Symphonia plus Mega Brave, 92
// each. So data/intl-map.json holds an ARRAY of sources per English set, every
// entry checked three ways before it was written down: the id pattern, the card
// counts lining up with English slightly higher, and the Japanese set coming
// first. This script re-checks the counts on every run and says so when they
// have drifted, because a reference page that quietly goes wrong is worse than
// one that is missing.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "tcgdex");
const FORCE = process.argv.includes("--force");

const API = "https://api.tcgdex.net/v2";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, cacheKey) {
  const file = join(CACHE, cacheKey + ".json");
  if (!FORCE && existsSync(file)) return JSON.parse(await readFile(file, "utf8"));
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "garbagerips585-build" } });
      if (res.ok) {
        const j = await res.json();
        await mkdir(CACHE, { recursive: true });
        await writeFile(file, JSON.stringify(j));
        return j;
      }
      if (res.status === 404) return null;
    } catch {
      /* retry */
    }
    await sleep(attempt * 1500);
  }
  throw new Error("TCGdex would not answer for " + url);
}

const LANG_NAME = { ja: "Japanese", ko: "Korean", "zh-tw": "Chinese" };

const map = JSON.parse(await readFile(join(ROOT, "data/intl-map.json"), "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const bySlug = new Map(sets.map((s) => [s.id, s]));

const out = { checked: new Date().toISOString().slice(0, 10), source: "TCGdex", sets: {} };
const warnings = [];

for (const [slug, entry] of Object.entries(map.sets || {})) {
  const english = bySlug.get(slug);
  if (!english) {
    warnings.push(`${slug}: no such English set in sets.json, skipped`);
    continue;
  }

  const sources = [];
  for (const src of entry.sources || []) {
    const set = await getJson(`${API}/${src.lang}/sets/${src.id}`, `${src.lang}-${src.id}`);
    if (!set) {
      warnings.push(`${slug}: TCGdex has no ${src.lang} set "${src.id}"`);
      continue;
    }
    sources.push({
      lang: src.lang,
      langName: LANG_NAME[src.lang] || src.lang,
      id: src.id,
      name: set.name || src.name,
      romaji: src.romaji || null,
      total: set.cardCount?.total ?? null,
      official: set.cardCount?.official ?? null,
      released: set.releaseDate || null,
      logo: set.logo ? `${set.logo}.png` : null,
      symbol: set.symbol ? `${set.symbol}.png` : null,
      url: `https://www.tcgdex.net/${src.lang}/sets/${src.id}`,
    });
    await sleep(250);
  }

  if (!sources.length) continue;

  // The check that keeps this page honest. English should be at least as large
  // as the sources it came from; if it is smaller, the mapping is wrong.
  const srcTotal = sources.reduce((n, s) => n + (s.total || 0), 0);
  const enTotal = english.total || english.printedTotal || 0;
  const ratio = srcTotal ? enTotal / srcTotal : 0;
  if (srcTotal && (ratio < 0.85 || ratio > 1.4)) {
    warnings.push(
      `${slug}: ${enTotal} English cards against ${srcTotal} from ${sources
        .map((s) => s.id)
        .join(" + ")} (${ratio.toFixed(2)}x). Check data/intl-map.json.`
    );
  }

  out.sets[slug] = {
    confidence: entry.confidence || "likely",
    note: entry.note || null,
    englishTotal: enTotal,
    sourceTotal: srcTotal,
    sources,
  };
}

await writeFile(join(ROOT, "public/data/intl-sets.json"), JSON.stringify(out, null, 2) + "\n");

console.log(`Wrote public/data/intl-sets.json`);
for (const [slug, v] of Object.entries(out.sets)) {
  console.log(
    `  ${slug.padEnd(20)} ${v.sources.map((s) => `${s.name} (${s.langName}, ${s.total})`).join(" + ")}` +
      `  ->  ${v.englishTotal} English`
  );
}
if (warnings.length) {
  console.log(`\n${warnings.length} thing(s) to look at:`);
  for (const w of warnings) console.log("  " + w);
}
