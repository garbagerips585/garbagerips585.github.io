#!/usr/bin/env node
// Pull the full card list for every English set, with rarity, art and price.
//
//   node scripts/sync-cards.mjs                    cached, near instant
//   node scripts/sync-cards.mjs --force            refetch everything
//   node scripts/sync-cards.mjs --prices           refresh every price
//   node scripts/sync-cards.mjs --prices --rotate  refresh a quarter (nightly)
//
// Writes public/data/cards/<slug>.json per set, plus public/data/card-index.json
// for the search page. build-set-pages.mjs renders the checklist and
// build-cards.mjs renders /cards.html.
//
// WHAT THIS REPLACES. api.pokemontcg.io gave counts but never a card list, and
// it now fails about half its requests. TCGdex has all 218 English sets with
// per-card rarity, images AND TCGplayer market prices in USD refreshed daily,
// which is strictly more than we had. The old API is left in place for
// sync-sets.mjs for now; this does not depend on it.
//
// THE PRICE SHOWN IS THE BEST VARIANT'S. A modern card exists as normal,
// holofoil and reverse holofoil at three different prices, and one number has
// to be picked for a checklist row. It takes the highest market price of the
// variants that exist, because that is the one people mean when they ask what a
// card is worth, and the variant is stored alongside so the page can say which.
// Every variant is kept in `all` so nothing is thrown away.
//
// COST. Roughly 4,500 cards, one request each, because TCGdex's set endpoint
// returns names only and rarity lives on the card. Everything is cached under
// .cache/tcgdex, so a cold run takes a few minutes and every run after it,
// including the nightly, does no network work unless --prices is passed.
//
// --prices refetches card detail without re-reading the card LIST, which is the
// right nightly shape: a checklist never changes, prices change daily. Paired
// with --rotate it does a quarter of the sets per run, so every set is current
// within four days for about 1,100 requests instead of 4,500. That matters
// because TCGdex is a free community project, and because the eight chase cards
// per set that anyone actually watches already refresh daily from TCGplayer.
//
// Every set is still written out on every run either way. Only the FETCHING
// rotates, so no set's file can go stale on disk or disappear.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "tcgdex");
const OUTDIR = join(ROOT, "public/data/cards");
const API = "https://api.tcgdex.net/v2/en";

const FORCE = process.argv.includes("--force");
const PRICES = process.argv.includes("--prices");
// --rotate refreshes a quarter of the sets per run, chosen by the day number, so
// every set's prices are re-read within four days for about 1,100 requests a
// night instead of 4,500. TCGdex is a free community API and the top eight chase
// cards on each set already refresh daily from TCGplayer directly, so hammering
// it nightly for the other 4,473 buys very little.
const ROTATE = process.argv.includes("--rotate");
const DAY = Math.floor(Date.now() / 86400000);
const SLICES = 4;

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * The date on a set file is a claim about when its PRICES were read.
 *
 * It used to be stamped `today` on every set on every run, including the three
 * quarters that --rotate deliberately served from cache. So a file said
 * "checked today" about prices up to four days old, and 23 files changed every
 * night whether or not a number moved. That churn is not cosmetic: it makes
 * `git diff --cached --quiet` unreachable, so the nightly commits every single
 * night, and a real regression lands inside a 45 file date-only diff that
 * nobody would look at twice.
 */
const previousChecked = async (slug) => {
  const f = join(OUTDIR, `${slug}.json`);
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(await readFile(f, "utf8")).checked || null;
  } catch {
    return null;
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fetched = 0;
let cached = 0;

async function getJson(url, key, { refresh = false } = {}) {
  const file = join(CACHE, key.replace(/[^\w.-]/g, "_") + ".json");
  if (!FORCE && !refresh && existsSync(file)) {
    cached++;
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
      if (res.status === 404) return null;
    } catch {
      /* retry */
    }
    await sleep(attempt * 1200);
  }
  // A single card failing must not lose the other 4,480. Returning undefined
  // signals "no answer"; it is the CALLER's job not to turn that into a null.
  return undefined;
}

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

/** Best market price across a card's variants, and which variant it was.
 *
 * ALSO KEEPS THE CHEAPEST LISTING (`low`). TCGdex returns lowPrice in the same
 * response as marketPrice and we were throwing it away, which cost us the more
 * useful of the two numbers for cheap cards. Measured on Chaos Rising: summed
 * across the 86 card base set, market is $14.00 and the lowest listings are
 * $2.13, a 6.6x gap. Across the master set it is $708.29 against $646.17, only
 * 1.10x. The spread is enormous on commons and negligible on chase cards,
 * because a $0.03 common's cheapest copy is a penny while a $213 card's is
 * close to what it sells for.
 *
 * The two numbers answer different questions and the site must not conflate
 * them. Market is what copies have been SELLING for, so it is the honest
 * estimate of what a card costs. Low is a single listing, right now, condition
 * unstated, from one seller. You cannot buy 200 cards at 200 different lowest
 * listings in one order, so summing `low` is a floor nobody can actually
 * reach, never a quote. */
function bestPrice(pricing) {
  const tp = pricing?.tcgplayer;
  if (!tp) return { price: null, variant: null, all: null, low: null };
  const all = {};
  let price = null;
  let variant = null;
  let low = null;
  for (const [name, v] of Object.entries(tp)) {
    if (!v || typeof v !== "object") continue; // skips `unit` and `updated`
    // Cheapest listing is tracked across ALL variants, independently of which
    // variant won on market price: someone completing a set buys whichever
    // printing is going cheapest, and it is routinely not the dearest one.
    const l = typeof v.lowPrice === "number" && v.lowPrice > 0 ? v.lowPrice : null;
    if (l != null && (low == null || l < low)) low = l;
    const m = typeof v.marketPrice === "number" ? v.marketPrice : null;
    if (m == null) continue;
    all[name] = m;
    if (price == null || m > price) {
      price = m;
      variant = name;
    }
  }
  return { price, variant, all: Object.keys(all).length ? all : null, low };
}

const VARIANT_LABEL = {
  normal: "Normal",
  holofoil: "Holo",
  "reverse-holofoil": "Reverse holo",
  "1st-edition": "1st edition",
  "1st-edition-holofoil": "1st ed holo",
};

const map = JSON.parse(await readFile(join(ROOT, "data/tcgdex-en.json"), "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const bySlug = new Map(sets.map((s) => [s.id, s]));

await mkdir(OUTDIR, { recursive: true });

const warnings = [];
const failedSets = [];
// Sets whose upstream answer was SMALLER than what is already on disk. Kept
// apart from failedSets because it is the one failure here that sets the exit
// code: a failed fetch is weather, a shrinking checklist is a bug somewhere.
const shrankSets = [];
const index = [];
const imgBase = {};
const summary = [];
let totalCards = 0;
let totalPriced = 0;

const entries = Object.entries(map.sets || {});
let refreshedSets = 0;
let newestChecked = null;
let totalFromPc = 0;

// PriceCharting's figures for every card in every guide, written by
// scripts/sync-pricecharting-cards.mjs out of the crawl sync-graded-top.mjs
// already cached. See that script's header for the coverage measurement that
// justified the swap. If the file is absent this sync still runs and every card
// keeps its TCGdex price, which is the honest degraded state rather than a
// build that fails on a missing overlay.
let pcCards = { sets: {} };
try {
  pcCards = JSON.parse(await readFile(join(ROOT, "data/pricecharting-cards.json"), "utf8"));
} catch {
  console.log("  data/pricecharting-cards.json missing: prices stay on TCGdex.");
  console.log("  run: node scripts/sync-pricecharting-cards.mjs");
}

for (const [slug, tcgdexId] of entries) {
  const i = entries.findIndex(([k]) => k === slug);
  // Which sets get fresh prices this run. Everything still gets READ from cache
  // and rewritten, so no set's file goes stale or missing; only the fetching
  // rotates.
  const refreshNow = PRICES && (!ROTATE || i % SLICES === DAY % SLICES);
  if (refreshNow) refreshedSets++;
  const ours = bySlug.get(slug);
  if (!ours) {
    warnings.push(`${slug}: not in sets.json, skipped`);
    continue;
  }

  const set = await getJson(`${API}/sets/${tcgdexId}`, `en-${tcgdexId}`);
  if (!set) {
    // Dropping the set here removed it from card-index.json while
    // public/data/cards/<slug>.json stayed on disk, so every set guide looked
    // perfect and only the search quietly covered fewer cards.
    warnings.push(`${slug}: TCGdex returned nothing for "${tcgdexId}", kept the previous file`);
    failedSets.push(slug);
    const prev = join(OUTDIR, `${slug}.json`);
    if (existsSync(prev)) {
      const old = JSON.parse(await readFile(prev, "utf8"));
      for (const c of old.cards || []) index.push([c.name, slug, c.n, c.rarity || "", c.price ?? null]);
      const sample = (old.cards || []).find((c) => c.img);
      if (sample) imgBase[slug] = sample.img.replace(/\/[^/]+$/, "");
      summary.push({ slug, name: ours.name, cards: (old.cards || []).length, priced: old.priced ?? 0 });
    }
    continue;
  }

  // The guard that stops a renamed or re-scoped set upstream silently swapping
  // a checklist under a page. Counts were exact for all 23 when pinned.
  const theirs = set.cardCount?.total ?? 0;
  const mine = ours.total || ours.printedTotal || 0;
  if (mine && theirs && mine !== theirs) {
    warnings.push(`${slug}: we say ${mine} cards, TCGdex says ${theirs} for ${tcgdexId}. Check data/tcgdex-en.json.`);
  }

  const list = set.cards || [];
  const details = await pool(list, 8, (c) =>
    getJson(`${API}/cards/${c.id}`, `en-card-${c.id}`, { refresh: refreshNow })
  );

  const cards = [];
  let missing = 0;
  for (let i = 0; i < list.length; i++) {
    const brief = list[i];
    const full = details[i];
    if (full === undefined) missing++;
    const { price, variant, all, low } = bestPrice(full?.pricing);
    cards.push({
      n: brief.localId || null,
      name: brief.name || full?.name || "",
      rarity: full?.rarity && full.rarity !== "None" ? full.rarity : null,
      cat: full?.category || null,
      img: full?.image || null, // append /low.webp or /high.webp at render time
      price,
      variant: variant ? VARIANT_LABEL[variant] || variant : null,
      all,
      // Cheapest listing across variants. Omitted rather than nulled when the
      // card has none, so it does not add a key to 4,481 records for nothing.
      ...(low != null ? { low } : {}),
      ill: full?.illustrator || null,
    });
  }
  // REFUSE TO WRITE A DEGRADED FILE. The loop above rebuilds every card from
  // the fetch result, so a card that would not load came out with price, rarity
  // and image all null, and the file was then written unconditionally.
  //
  // That is the worst shape a failure can take here. --rotate passes
  // refresh:true, which bypasses the cache for exactly the sets being
  // refreshed, so the cache cannot rescue them: one TCGdex wobble blanks ~1,100
  // cards, the set guides then state "0 of 195 cards have a price" as a fact
  // about the market, and the run exits 0 with one line in warnings.
  //
  // Staleness is the safe failure. Keep yesterday's file, say so loudly, and
  // let the next run fix it.
  if (missing) {
    warnings.push(
      `${slug}: ${missing} of ${list.length} card(s) failed to load. ` +
        `KEPT THE PREVIOUS FILE rather than writing nulls over good data.`
    );
    failedSets.push(slug);
    const prev = join(OUTDIR, `${slug}.json`);
    if (existsSync(prev)) {
      const old = JSON.parse(await readFile(prev, "utf8"));
      for (const c of old.cards || []) index.push([c.name, slug, c.n, c.rarity || "", c.price ?? null]);
      const sample = (old.cards || []).find((c) => c.img);
      if (sample) imgBase[slug] = sample.img.replace(/\/[^/]+$/, "");
      summary.push({ slug, name: ours.name, cards: (old.cards || []).length, priced: old.priced ?? 0 });
      totalCards += (old.cards || []).length;
      totalPriced += old.priced ?? 0;
      console.log(`  ${slug.padEnd(21)} ${missing} card(s) failed, kept the previous file`);
    } else {
      warnings.push(`${slug}: no previous file to fall back on, so this set is MISSING from the index`);
    }
    continue;
  }

  // THE GUARD ABOVE COUNTS THE WRONG KIND OF NOTHING.
  //
  // `missing` counts cards whose DETAIL fetch failed, so it protects against
  // TCGdex answering per-card requests badly. It cannot see the other shape:
  // the SET endpoint answering with a short `cards` array, or none at all.
  // `set.cards || []` turns that into an empty list, an empty list produces zero
  // failed details, `missing` is 0, and the whole refuse-to-write block above is
  // skipped. The file written is `{"total":0,"cards":[]}` on top of a 295 card
  // checklist, which is the single most destructive write in this tree: every
  // price on that set guide, its rarity ladder, its chase grid and its rows in
  // /cards.html and /complete-a-set.html all read that one file.
  //
  // Nothing downstream would have caught it either. check-build.py floors the
  // card index at 4,000 of 5,181, so a set the size of Ascended Heroes can
  // vanish entirely and still clear it, and the "90% of cards carry a price"
  // check reads the cards that are LEFT, which all still have prices.
  //
  // A checklist does not shrink. Sets are printed once and TCGdex only ever adds
  // to them, so fewer cards than last run means the answer was wrong, not that
  // the set got smaller. Same remedy the block above uses, because it is the
  // right one: keep yesterday's file, which is stale at worst, and say so. The
  // difference is that this one also sets the exit code, because a shrinking
  // upstream is a thing somebody has to look at rather than a wobble that fixes
  // itself on the next run.
  const _prevPath = join(OUTDIR, `${slug}.json`);
  let _prevCards = null;
  if (existsSync(_prevPath)) {
    try {
      _prevCards = JSON.parse(await readFile(_prevPath, "utf8")).cards || null;
    } catch {
      /* unreadable previous file; nothing to compare against */
    }
  }
  if (_prevCards && cards.length < _prevCards.length) {
    warnings.push(
      `${slug}: TCGdex returned ${cards.length} cards where the file on disk has ` +
        `${_prevCards.length}. A checklist does not shrink, so this is a bad answer from ` +
        `${API}/sets/${tcgdexId}, not a smaller set. KEPT THE PREVIOUS FILE. ` +
        `Re-run with --force once TCGdex is answering properly; if the set really was ` +
        `re-scoped, delete public/data/cards/${slug}.json first so there is nothing to shrink from.`
    );
    failedSets.push(slug);
    shrankSets.push(slug);
    for (const c of _prevCards) index.push([c.name, slug, c.n, c.rarity || "", c.price ?? null]);
    const sample = _prevCards.find((c) => c.img);
    if (sample) imgBase[slug] = sample.img.replace(/\/[^/]+$/, "");
    const oldPriced = _prevCards.filter((c) => c.price != null).length;
    summary.push({ slug, name: ours.name, cards: _prevCards.length, priced: oldPriced });
    totalCards += _prevCards.length;
    totalPriced += oldPriced;
    console.log(`  ${slug.padEnd(21)} ${cards.length} cards from TCGdex against ${_prevCards.length} on disk, kept the previous file`);
    continue;
  }
  if (!cards.length) {
    // No previous file to fall back on, so there is nothing to keep and nothing
    // to write. Writing an empty checklist would publish a set guide that
    // states, as fact, that its set has no cards.
    warnings.push(
      `${slug}: TCGdex returned no cards at all for "${tcgdexId}" and there is no previous ` +
        `file to keep. Nothing written. Check data/tcgdex-en.json maps ${slug} to the right id.`
    );
    failedSets.push(slug);
    shrankSets.push(slug);
    console.log(`  ${slug.padEnd(21)} no cards returned, nothing written`);
    continue;
  }

  // PRICECHARTING OVERLAYS THE PRICES, HERE, ONCE, ON THE WAY TO DISK.
  //
  // This is the single place the swap happens and that is the whole design. Ten
  // builders read public/data/cards/<set>.json for money and CLAUDE.md's "ONE
  // SOURCE PER PAGE" rule exists because 22 of 28 guides once priced their own
  // chase card twice. Changing the source in ten builders would have been ten
  // chances to leave one of them on the old feed; changing the FILE they all
  // read cannot desynchronise them.
  //
  // It sits before the `priced` count so the count describes what was written,
  // and inside the successful-write branch only. The failure branches above all
  // keep the previous file and read their prices back out of it, so they carry
  // whatever overlay the last good run wrote rather than silently reverting a
  // set to TCGdex.
  const pcSet = pcCards.sets?.[slug];
  let fromPc = 0;
  for (const c of cards) {
    const hit = pcSet?.cards?.[c.n];
    if (hit && typeof hit.price === "number") {
      c.price = hit.price;
      c.variant = hit.variant;
      c.all = hit.all;
      // The graded columns come off the SAME PriceCharting row as the raw
      // price, so a page printing both is describing one printing of one card.
      // Carrying them here is what lets the set guides show a PSA 10 without
      // introducing a second feed to a page that already has one.
      if (hit.psa10 != null) c.psa10 = hit.psa10;
      if (hit.g9 != null) c.g9 = hit.g9;
      c.pcUrl = hit.url;
      fromPc += 1;
    } else if (c.price != null) {
      // NAMED FALLBACK, NOT A SILENT ONE. PriceCharting covers 5,179 of 5,181,
      // so this marks a handful of rows, and the mark is what lets a page say
      // "TCGdex" against that one figure instead of crediting PriceCharting for
      // a number it did not supply. Stamped only on the exceptions: the file's
      // `source` says what the other 99.96% are.
      c.src = "tcgdex";
    }
  }
  // `low` IS DELIBERATELY LEFT ON TCGDEX AND IS NOT A SECOND PRICE FEED.
  // PriceCharting publishes no lowest-listing figure at all, and `low` is not
  // the same quantity as `price`: build-complete.mjs's own comment calls it "one
  // listing, condition unstated, from one seller". It is the same case as the
  // Pokemon Center MSRP, which also stays where it is. The page that prints it
  // names TCGplayer for it specifically.

  const priced = cards.filter((c) => c.price != null).length;
  totalCards += cards.length;
  totalPriced += priced;
  totalFromPc += fromPc;

  await writeFile(
    join(OUTDIR, `${slug}.json`),
    JSON.stringify(
      {
        set: slug,
        name: ours.name,
        tcgdexId,
        // Only advances when this set's prices were actually re-read. This is
        // the CHECKLIST's date: the names, numbers, rarities and art come from
        // TCGdex on this day. It is no longer the date of the prices, which is
        // `pricesChecked` below, and a page must not print it as one.
        checked: refreshNow || !(await previousChecked(slug)) ? TODAY : await previousChecked(slug),
        // TWO SOURCES, TWO DATES, AND THEY ARE SEPARATE FIELDS BECAUSE THEY ARE
        // SEPARATE FACTS. The checklist is TCGdex's and refreshes nightly; the
        // prices are PriceCharting's and refresh when somebody runs the crawl.
        // Collapsing them into one `source` string is how a page ends up
        // stamping a price with the day a card name was read.
        source: "Card data from TCGdex. Prices from PriceCharting.",
        priceSource: pcCards.source || "pricecharting.com",
        priceMeasurement: pcCards.measurement || null,
        priceMethodology: pcCards.sourceMethodology || null,
        pricesChecked: pcCards.checked || null,
        // The named fallback, so a page can say which figures are not
        // PriceCharting's without hunting for the `src` marks itself.
        priceFallback: "TCGdex, prices from TCGplayer",
        // `low` is a lowest live listing on TCGplayer. PriceCharting publishes
        // no such figure, so this one stays where it was and is named for what
        // it is wherever it is printed.
        lowSource: "TCGplayer lowest listing, via TCGdex",
        total: cards.length,
        priced,
        pricedBy: { pricecharting: fromPc, tcgdex: priced - fromPc },
        cards,
      },
      null,
      0
    ) + "\n"
  );

  // The search index is deliberately slim. It is downloaded by anyone who opens
  // /cards.html, so it carries only what a result row shows and nothing else.
  for (const c of cards) {
    index.push([c.name, slug, c.n, c.rarity || "", c.price ?? null]);
  }
  // The shared half of every image url in this set, e.g.
  // https://assets.tcgdex.net/en/sv/sv08.5 . The card's own number and the size
  // are appended at render time. One string per set instead of 4,481.
  const sample = cards.find((c) => c.img);
  if (sample) imgBase[slug] = sample.img.replace(/\/[^/]+$/, "");

  summary.push({ slug, name: ours.name, cards: cards.length, priced });
  const stamped = refreshNow ? TODAY : (await previousChecked(slug)) || TODAY;
  if (!newestChecked || stamped > newestChecked) newestChecked = stamped;
  console.log(
    `  ${slug.padEnd(21)} ${String(cards.length).padStart(4)} cards, ${String(priced).padStart(4)} priced` +
      (missing ? `, ${missing} failed` : "")
  );
}

await writeFile(
  join(ROOT, "public/data/card-index.json"),
  JSON.stringify({
    // The freshest set, not "today". The index is only as current as its most
    // recently refreshed member.
    checked: newestChecked || TODAY,
    // THE INDEX CARRIES THE PRICE DATE SEPARATELY FOR THE SAME REASON THE SET
    // FILES DO. `checked` above is the freshest CHECKLIST date and moves
    // nightly; the prices in this index are PriceCharting's and were read on
    // `pricesChecked`. /cards.html prints one of these under a column of dollar
    // figures, and until they were split it printed the one that moves nightly.
    priceSource: pcCards.source || "pricecharting.com",
    pricesChecked: pcCards.checked || null,
    pricedBy: { pricecharting: totalFromPc, tcgdex: totalPriced - totalFromPc },
    fields: ["name", "set", "number", "rarity", "price"],
    sets: Object.fromEntries(summary.map((s) => [s.slug, s.name])),
    imgBase,
    cards: index,
  }) + "\n"
);

console.log(`
Wrote public/data/cards/*.json and card-index.json
  ${summary.length} sets, ${totalCards} cards, ${totalPriced} with a price
  ${fetched} fetched, ${cached} from cache${PRICES ? `\n  prices refreshed for ${refreshedSets} of ${entries.length} sets${ROTATE ? ` (rotating, all ${entries.length} within ${SLICES} days)` : ""}` : ""}`);
if (failedSets.length) {
  console.log(`\n${failedSets.length} set(s) kept their previous file: ${failedSets.join(", ")}`);
}
if (warnings.length) {
  console.log(`\n${warnings.length} thing(s) to look at:`);
  for (const w of warnings) console.log("  " + w);
}
// EXIT CODE, NOT JUST A LINE OF TEXT. Everything above is printed to stdout,
// and the nightly workflow reads exit codes rather than prose. A checklist that
// came back smaller than the one on disk is the failure that has to be noticed
// on the run it happens, because the file it would have overwritten is the only
// copy of those prices.
if (shrankSets.length) {
  console.error(
    `\n${shrankSets.length} set(s) came back smaller than the file on disk and were NOT ` +
      `overwritten: ${shrankSets.join(", ")}. The checklists on disk are unchanged and still ` +
      `correct; TCGdex is the thing to look at. Re-run when it is answering properly.`
  );
  process.exit(1);
}
