#!/usr/bin/env node
// TCGplayer product links for every card the site prices.
//
//   node scripts/sync-chase.mjs                  sets with no links yet
//   node scripts/sync-chase.mjs --force          refetch every set
//   node scripts/sync-chase.mjs 151 black-bolt   named sets only
//
// Writes data/chase-tcg.json.
//
// THIS FETCHES LINKS AND NOTHING ELSE.
//
// It used to fetch a whole chase list: name, number, rarity, price and two
// image urls per card, for the handful of sets api.pokemontcg.io had no prices
// for. build-set-pages.mjs merged that in wherever sets.json carried an empty
// chase list, so the file was a second source of prices and card identities.
//
// It is not any more. Every chase card and every price on a set guide is read
// out of public/data/cards/<set>.json, the same checklist the page renders row
// by row, so the top of a page cannot disagree with the bottom of it. The one
// thing that checklist does not carry is the TCGplayer product url, so that is
// the only thing this writes.
//
// DO NOT ADD A PRICE BACK. The reason is in the note above the chase block in
// build-set-pages.mjs and in the Set pages section of CLAUDE.md: two feeds
// pricing the same card is how /sets/151.html came to say $372 in one paragraph
// and $378 three hundred pixels lower, and how one set page named a $69.94
// Psyduck as its chase card while four other pages named a $1,118.76 Mega
// Gengar ex. A page can only show its working from one source.
//
// WHY IT NOW WALKS THE CHECKLISTS RATHER THAN sets.json
//
// It used to pick its work by looking for an empty or unpriced `chase` array in
// public/data/sets.json. After the change above that is only ever true of the
// newest sets, so it covered 4 of 28 and the other 24 fell back to the `url`
// field in sets.json, which is a prices.pokemontcg.io address that has to be
// followed through a redirect at build time. A build that depends on a third
// party answering a redirect is a build that breaks when they do not, and that
// host has been 502ing.
//
// So the unit of work is public/data/cards/*.json: 28 checklists, 28 pinned set
// names in shared/tcgplayer.mjs, one link map covering all of them. The old
// path also could not reach a set that sync-sets.mjs had not cached, which tied
// link coverage to an API this file does not otherwise use.
//
// MATCHING IS ON CARD NUMBER, NOT NAME. Names collide and are written
// differently on each side ("Mega Excadrill ex" against "Mega Excadrill ex -
// 065/084"), while the collector number is exact and printed on the card.
// TCGplayer gives "065/084" and the checklists give "065"; cardNumKey reduces
// both, and it strips leading zeros per digit run so TG05 and SV001 survive.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TCG_SET } from "../shared/tcgplayer.mjs";
import { cardNumKey } from "../shared/format.mjs";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARDS = join(ROOT, "public/data/cards");

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

/**
 * Every single from one set, paged.
 *
 * There is no working server-side sort here (field names that look right answer
 * 500), so this pulls the whole set.
 *
 * THE OLD CAP WAS 400 AND IT SILENTLY TRUNCATED A SET, which is how this file
 * came to publish a wrong chase card rather than none. "ME: Ascended Heroes"
 * answers totalResults 620, because a 295 card set lists far more than 295
 * products once reverse holos and printings are counted, so the walk stopped
 * 220 products short and every Special Illustration Rare in the set was in the
 * part it never reached. Nothing errored, and a short list looks exactly like a
 * complete one.
 *
 * The loop stops on totalResults, so the cap is only a runaway guard and it
 * belongs well clear of the biggest set rather than near it. It still throws if
 * it ever hits the cap, because that is the failure that hides. The file no
 * longer publishes a chase card, so a truncated set now costs missing buy
 * buttons rather than a wrong headline, but silent truncation stays fatal.
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
          // An unknown setName is ignored by the API rather than rejected, so it
          // answers with every set. Verify rather than trust.
          if (page) page.results = (page.results || []).filter((r) => r.setName === setName);
        } else await sleep(attempt * 2000);
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
        `Raise CAP: a truncated set silently loses buy links and used to name the wrong chase card.`
    );
  }
  return out;
}

// ---------------------------------------------------------------------------

const slugs = (await readdir(CARDS))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();

const outPath = join(ROOT, "data/chase-tcg.json");
let doc = {
  checked: null,
  source: "TCGplayer product links. Prices and card identities come from public/data/cards.",
  sets: {},
};
if (existsSync(outPath)) {
  try {
    doc = JSON.parse(await readFile(outPath, "utf8"));
    doc.sets ||= {};
  } catch {}
}

const wanted = slugs.filter((s) => (only.length ? only.includes(s) : true));
const todo = wanted.filter((s) => FORCE || !Object.keys(doc.sets[s]?.links || {}).length);

console.log(
  `${slugs.length} checklist(s) on disk, ${todo.length} to fetch` +
    (todo.length === wanted.length ? "" : ` (${wanted.length - todo.length} already have links)`) +
    "\n"
);

const today = localDay();
let touched = 0;
const missing = [];

for (const slug of todo) {
  const setName = TCG_SET[slug];
  if (!setName) {
    // Every checklist should have a pinned name. A new one without it is a gap
    // to fill in shared/tcgplayer.mjs, not something to guess: the API ignores
    // an unknown setName rather than rejecting it, so a guess answers with
    // every set rather than failing.
    missing.push(slug);
    console.log(`  ${slug.padEnd(20)} no TCGplayer set name pinned in shared/tcgplayer.mjs, skipped`);
    continue;
  }

  const singles = await fetchSingles(setName);

  const links = {};
  const dearest = new Map();
  for (const p of singles) {
    // TCGplayer prints the number as a fraction, "9/165", and the checklists
    // hold the numerator alone, "009". cardNumKey reduces the zero padding but
    // not the fraction, so keying on the raw value gave "9/165" against "9" and
    // matched nothing: 207 links and 0 of 207 checklist cards covered. Take the
    // numerator first. Verified across all 28 checklists and both feeds that
    // every number here is plain digits, so the split cannot cut a suffix.
    const n = cardNumKey(String(p.customAttributes?.number ?? "").split("/")[0]);
    const id = Math.round(Number(p.productId));
    if (!n || !Number.isFinite(id)) continue;
    // A number appears more than once when a card has reverse holo or other
    // printings. Keep the dearest, which is the printing people mean when they
    // click through from a chase card.
    const price = Number(p.marketPrice) || 0;
    if (!dearest.has(n) || dearest.get(n) < price) {
      dearest.set(n, price);
      links[n] = `https://www.tcgplayer.com/product/${id}`;
    }
  }

  const checklist = JSON.parse(await readFile(join(CARDS, `${slug}.json`), "utf8"));
  const total = (checklist.cards || []).length;
  const hit = (checklist.cards || []).filter((c) => links[cardNumKey(c.n)]).length;

  doc.sets[slug] = { tcgSet: setName, checked: today, links };
  touched++;
  console.log(
    `  ${slug.padEnd(20)} ${String(Object.keys(links).length).padStart(4)} links, ` +
      `${hit} of ${total} checklist cards covered`
  );
  await sleep(800);
}

// Card identities and prices used to live here and no longer do. Drop them on
// the way past rather than leaving a second, staler copy of every chase card in
// a file nothing reads them from.
let stripped = 0;
for (const entry of Object.values(doc.sets)) {
  if (entry.cards) {
    delete entry.cards;
    stripped++;
  }
}

// Only when something actually changed. Stamping unconditionally rewrote the
// file every night on a run that reported nothing updated.
if (touched || stripped) doc.checked = today;
await writeFile(outPath, JSON.stringify(doc, null, 2) + "\n");

const covered = Object.values(doc.sets).filter((e) => Object.keys(e.links || {}).length).length;
console.log(
  `\nWrote data/chase-tcg.json  (${touched} set(s) fetched, ${covered} of ${slugs.length} sets have links` +
    (stripped ? `, dropped stale card lists from ${stripped}` : "") +
    ")"
);
if (missing.length) {
  console.log(
    `\n${missing.length} set(s) have a checklist but no pinned TCGplayer name, so they get no buy links: ` +
      missing.join(", ") +
      "\nAdd them to TCG_SET in shared/tcgplayer.mjs, reading setName back off a probe rather than guessing."
  );
}
if (touched) console.log("Next: node scripts/build-set-pages.mjs");
