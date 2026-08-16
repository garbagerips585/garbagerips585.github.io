#!/usr/bin/env node
// Fill in chase cards for sets the Pokemon TCG API has no prices for.
//
//   node scripts/sync-chase.mjs            only sets that need it
//   node scripts/sync-chase.mjs --force    refetch even if cached
//
// Writes data/chase-tcg.json.
//
// WHAT THIS IS FOR NOW: THE LINKS, NOT THE PRICES.
// build-set-pages.mjs used to merge this file in as a chase list wherever
// sets.json carried an empty one. It no longer does. Every price and every card
// on a set guide is read out of public/data/cards/<id>.json, the same checklist
// the page renders row by row, so the top of the page cannot disagree with the
// bottom of it. This file is read for one field the checklist does not carry:
// the TCGplayer product URL behind each chase card, matched on collector number.
//
// That change was forced by this script publishing a wrong card. See the note
// above fetchSingles for how a paging cap did it and why nothing looked broken.
// A chase list that is merely INCOMPLETE is indistinguishable from a correct
// one, which is why a fallback is no longer allowed to name the card at all.
//
// The checklist is not the missing piece. Names, numbers, rarities and card
// images are all already cached under .cache/ptcg. Only the prices are
// missing, and TCGplayer has those for the same cards, on the same
// unauthenticated endpoint the sealed product sync already uses. So this joins
// the two: the card comes from the Pokemon TCG API, the price from TCGplayer.
//
// MATCHING IS ON CARD NUMBER, NOT NAME
// Names collide and are formatted differently on each side ("Mega Excadrill ex"
// against "Mega Excadrill ex - 065/084"), while the collector number is exact
// and printed on the card. TCGplayer gives "065/084", the TCG API gives "65";
// both are reduced to an integer before comparing.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { TCG_SET } from "../shared/tcgplayer.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "ptcg");

const FORCE = process.argv.includes("--force");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const HEADERS = {
  "content-type": "application/json",
  origin: "https://www.tcgplayer.com",
  referer: "https://www.tcgplayer.com/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Reduce any printed collector number to a comparable integer. */
const numOf = (raw) => {
  const m = String(raw ?? "").match(/\d+/);
  return m ? String(Number(m[0])) : null;
};

/**
 * Every single from one set, paged.
 *
 * There is no working server-side price sort (field names that look right
 * answer 500), so this pulls the whole set and sorts here.
 *
 * THE OLD CAP WAS 400 AND IT SILENTLY TRUNCATED A SET, which is how this file
 * came to publish a wrong chase card rather than none. "ME: Ascended Heroes"
 * answers totalResults 620, because a 295 card set lists far more than 295
 * products once reverse holos and printings are counted, so the walk stopped
 * 220 products short and every Special Illustration Rare in the set was in the
 * part it never reached. The eight "chase cards" that came out of it were led
 * by Psyduck at $69.94 while the set's real top card, Mega Gengar ex, is
 * $1,118.76: sixteen times bigger and completely absent from the list. Nothing
 * errored, and a short list looks exactly like a complete one.
 *
 * The loop already stops on totalResults, so the cap is only a runaway guard
 * and it should be well clear of the biggest set rather than near it. It also
 * shouts if it ever hits the cap again, because that is the failure that hides.
 */
async function fetchSingles(setName) {
  const out = [];
  const CAP = 1600;
  let total = null;
  for (let from = 0; from < CAP; from += 50) {
    const body = {
      algorithm: "sales_dismax",
      from,
      size: 50,
      filters: {
        term: { productLineName: ["pokemon"], setName: [setName] },
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
    let page = null;
    for (let attempt = 1; attempt <= 4 && !page; attempt++) {
      try {
        const res = await fetch(
          "https://mp-search-api.tcgplayer.com/v1/search/request?q=&isList=false",
          { method: "POST", headers: HEADERS, body: JSON.stringify(body) }
        );
        if (res.ok) {
          page = (await res.json()).results?.[0];
          // An unknown setName is ignored by the API rather than rejected, so
          // it answers with every set. Verify rather than trust.
          if (page) page.results = (page.results || []).filter((r) => r.setName === setName);
        }
        else await sleep(attempt * 2000);
      } catch {
        await sleep(attempt * 2000);
      }
    }
    if (!page) throw new Error(`TCGplayer would not answer for "${setName}"`);
    total = page.totalResults ?? total;
    out.push(...(page.results || []));
    if (out.length >= (total || 0)) break;
    await sleep(600);
  }
  if (total != null && out.length < total) {
    throw new Error(
      `fetchSingles("${setName}") stopped at ${out.length} of ${total} products because of the ${CAP} cap. ` +
        `Raise CAP: a truncated set produces a chase list that looks complete and names the wrong card.`
    );
  }
  return out;
}

/**
 * The cached Pokemon TCG API checklist for one set, across its pages.
 *
 * Returns nothing rather than throwing when the cache is absent. This is only
 * ever populated by sync-sets.mjs, which is deliberately NOT in the nightly job
 * because api.pokemontcg.io is currently failing about half its requests. So on
 * a fresh CI runner the directory does not exist at all, and readdirSync threw
 * ENOENT and took the whole nightly build down with it on its very first run.
 *
 * With no checklist there is nothing to join TCGplayer's prices onto, so the
 * set is skipped and whatever is already in data/chase-tcg.json stands. That
 * file is committed, so the pages keep their chase cards either way.
 */
async function cachedCards(apiId) {
  if (!existsSync(CACHE)) return [];
  const files = readdirSync(CACHE).filter((f) => new RegExp(`^${apiId}-p\\d+\\.json$`).test(f));
  const cards = [];
  for (const f of files.sort()) {
    const j = JSON.parse(await readFile(join(CACHE, f), "utf8"));
    cards.push(...(j.data || j));
  }
  return cards;
}

// ---------------------------------------------------------------------------

const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));

const outPath = join(ROOT, "data/chase-tcg.json");
let doc = { checked: null, source: "TCGplayer market prices, cards from the Pokemon TCG API", sets: {} };
if (existsSync(outPath)) {
  try {
    doc = JSON.parse(await readFile(outPath, "utf8"));
    doc.sets ||= {};
  } catch {}
}

// Only sets that actually need it: an empty chase list, or one with no prices.
const needs = sets.filter((s) => {
  if (only.length) return only.includes(s.id);
  const c = s.chase || [];
  return c.length === 0 || c.every((x) => !x.price);
});

console.log(
  needs.length
    ? `${needs.length} set(s) have no priced chase cards: ${needs.map((s) => s.id).join(", ")}\n`
    : "Every set already has priced chase cards. Nothing to do.\n"
);

const today = new Date().toISOString().slice(0, 10);
let touched = 0;

for (const s of needs) {
  const setName = TCG_SET[s.id];
  if (!setName) {
    console.log(`  ${s.id}: no TCGplayer set name pinned in shared/tcgplayer.mjs, skipped`);
    continue;
  }
  if (!FORCE && doc.sets[s.id]?.cards?.length) {
    console.log(`  ${s.id}: already have ${doc.sets[s.id].cards.length}, use --force to refetch`);
    continue;
  }

  const [singles, checklist] = await Promise.all([fetchSingles(setName), cachedCards(s.apiId)]);

  // Price by collector number.
  const priceBy = new Map();
  for (const p of singles) {
    const n = numOf(p.customAttributes?.number);
    const price = Number(p.marketPrice);
    if (!n || !(price > 0)) continue;
    // A number can appear twice (reverse holo printings). Keep the dearest,
    // which is the one people mean by "the chase card".
    if (!priceBy.has(n) || priceBy.get(n).price < price) {
      priceBy.set(n, { price, url: `https://www.tcgplayer.com/product/${Math.round(Number(p.productId))}` });
    }
  }

  const cards = checklist
    .map((c) => {
      const hit = priceBy.get(numOf(c.number));
      if (!hit) return null;
      return {
        name: c.name,
        number: String(c.number),
        rarity: c.rarity || null,
        price: Math.round(hit.price * 100) / 100,
        image: c.images?.small || null,
        imageLarge: c.images?.large || c.images?.small || null,
        url: hit.url,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.price - a.price)
    .slice(0, 8);

  if (!cards.length) {
    console.log(`  ${s.id}: matched nothing, leaving it alone`);
    continue;
  }

  doc.sets[s.id] = { tcgSet: setName, checked: today, cards };
  touched++;
  console.log(
    `  ${s.id.padEnd(18)} ${String(cards.length).padStart(2)} cards, top: ${cards[0].name} #${cards[0].number} $${cards[0].price}`
  );
  await sleep(800);
}

// Only when something actually changed. Stamping unconditionally rewrote the
// file every night on a run that reported "0 set(s) updated".
if (touched) doc.checked = today;
await writeFile(outPath, JSON.stringify(doc, null, 2) + "\n");

console.log(`\nWrote data/chase-tcg.json  (${touched} set(s) updated)`);
if (touched) console.log("Next: node scripts/build-set-pages.mjs");
