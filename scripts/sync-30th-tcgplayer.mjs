/* THE ENGLISH 30th CELEBRATION CHECKLIST, AND ITS CARD PICTURES, FROM TCGPLAYER.
 *
 *     node scripts/sync-30th-tcgplayer.mjs [--force]
 *
 * Writes data/30th-checklist.json. build-30th.mjs reads it to give every binder
 * pocket a real card name, number and picture. NOT in build-all.mjs: that list
 * only builds and pulls no fresh data, which is the rule its own header states.
 *
 * WHY THIS EXISTS WHEN EVERY OTHER CARD PICTURE ON THIS SITE COMES FROM TCGDEX.
 * The owner, 16 September 2026: "can we pull all the images for the 30th
 * celebrations set yet to add to the site?" On release day TCGdex still had no
 * 2026 anniversary set -- 218 English sets and 184 Japanese, newest Pitch Black,
 * no anniversary series at all -- and pokemontcg.io had 174 sets whose only
 * "Celebrations" is the 2021 one. Both were checked the same morning rather than
 * assumed. So the canonical source cannot answer and TCGplayer can.
 *
 * IT IS THE SAME HOST data/card-shots.json ALREADY HOTLINKS, which is the whole
 * reason this is allowed to be the answer: that file pins tcgplayer-cdn images
 * for cards TCGdex has no scan for, and this is that situation for a whole set
 * rather than for three cards. Nothing is resized and nothing is rehosted, so
 * no derivative of anybody's artwork is created -- the clause in TPCi's asset
 * license that stops this site hosting official card images at all.
 *
 * AND IT IS A CHECKLIST BEFORE IT IS A PICTURE SOURCE. The set's English card
 * list was never published as data anywhere this site could read: PokeBeach
 * printed a gallery with no names attached, and build-30th.mjs's slotsFor() has
 * been a documented stub returning [] since 11 September waiting for one. This
 * fills that in too, which is why the output carries name, number and rarity
 * and not just a product id.
 *
 * THE FILTER IS EXACT AND IS VERIFIED, because this API IGNORES an unknown
 * setName rather than rejecting it. Four of six names guessed on 15 September
 * came back with all 32,813 Pokemon products and a cheerful 200; only the
 * verify step told them apart. sync-chase.mjs records the same trap. So every
 * row is re-checked against the name that was asked for and anything else is
 * dropped.
 *
 * WHEN TCGDEX GETS THE SET THIS RETIRES ON ITS OWN. build-30th.mjs prefers, in
 * order: the owner's own photograph, then TCGdex if data/30th.json's two ids are
 * filled in, then this. Filling those ids switches all 199 pockets over and
 * nothing here has to be deleted.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/30th-checklist.json");
const FORCE = process.argv.includes("--force");

/* The two set names, read off the API rather than guessed at. The Classic
   Collection is its OWN set on TCGplayer exactly as the 2021 one was, and its
   cards keep their ORIGINAL numbering ("85/124", "101/101"), because they are
   reprints of old cards. That is why `n` below is stored verbatim and never
   parsed into an integer for those. */
const MAIN_SET = "ME: 30th Celebration";
const CLASSIC_SET = "ME: 30th Celebration Classic Collection";

const HEADERS = {
  "content-type": "application/json",
  origin: "https://www.tcgplayer.com",
  referer: "https://www.tcgplayer.com/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchSet(setName) {
  const out = [];
  let total = null;
  for (let from = 0; from < 1000; from += 50) {
    const body = {
      algorithm: "sales_dismax",
      from,
      size: 50,
      filters: { term: { productLineName: ["pokemon"], setName: [setName] }, range: {}, match: {} },
      listingSearch: {
        context: { cart: {} },
        filters: { term: {}, range: {}, exclude: { channelExclusion: 0 } },
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
        if (res.ok) page = (await res.json()).results?.[0];
        else await sleep(attempt * 1500);
      } catch {
        await sleep(attempt * 1500);
      }
    }
    if (!page) throw new Error(`TCGplayer would not answer for "${setName}"`);
    // THE VERIFY. An unknown setName is ignored, not rejected, so a bad name
    // answers 200 with every set in it. Keep only rows that name the set asked
    // for; a wrong name then yields zero rows rather than 32,813 wrong ones.
    const rows = (page.results || []).filter((r) => r.setName === setName);
    if (rows.length === 0 && from === 0)
      throw new Error(
        `"${setName}" matched 0 of ${page.totalResults ?? "?"} rows returned. ` +
          `Either the set name changed or it was never right: this API ignores an ` +
          `unknown setName and answers with everything.`
      );
    total = page.totalResults ?? total;
    out.push(...rows);
    if (out.length >= (total || 0) || rows.length === 0) break;
    await sleep(600);
  }
  console.log(`  "${setName}": ${out.length} of ${total} products`);
  return out;
}

const num = (r) => ((r.customAttributes || {}).number || "").trim();

/* WHICH BINDER SECTION A CARD LANDS IN.
 *
 * THE 30 PIKACHU ARE FOUND BY RARITY, NOT BY A NUMBER RANGE, and that is the
 * only reliable handle: PokeBeach says the 128 main set cards INCLUDE 30
 * Pikachu, but never says which numbers they are, and they are not contiguous.
 * TCGplayer tags them with a rarity of its own, "Pikachu Rare", and there are
 * exactly 30 -- which is checked below rather than trusted, because a section
 * silently holding 29 or 31 would put the wrong count under the wrong bar.
 *
 * SECRETS ARE ANYTHING ABOVE THE 128, which is the set's own printed
 * denominator: every card in this set reads x/128, so 129 and up is by
 * definition outside the main set. Confirmed on the owner's own cards, which
 * read 099/128 and 120/128.
 */
function classify(r, setName) {
  if (setName === CLASSIC_SET) return "classic";
  if ((r.rarityName || "") === "Pikachu Rare") return "pikachu";
  const n = parseInt(num(r).split("/")[0], 10);
  if (!Number.isFinite(n)) return null;
  return n > 128 ? "secret" : "main";
}

const main = await fetchSet(MAIN_SET);
await sleep(600);
const classic = await fetchSet(CLASSIC_SET);

const cards = [];
for (const [setName, rows] of [[MAIN_SET, main], [CLASSIC_SET, classic]]) {
  for (const r of rows) {
    const n = num(r);
    // NO NUMBER MEANS IT IS SEALED PRODUCT, NOT A CARD. 48 of the main set's
    // 202 rows are Elite Trainer Boxes, tins, cases and displays. They are
    // filtered by the absence of a collector number rather than by matching
    // their names, because a name list would need editing every time TPCi
    // announced another product.
    if (!n) continue;
    const section = classify(r, setName);
    if (!section) continue;
    cards.push({
      section,
      n,
      name: String(r.productName || "").replace(/\s*-\s*\d+\/\d+$/, "").trim(),
      rarity: r.rarityName || null,
      pid: r.productId,
      /* TCGPLAYER'S OWN MARKET PRICE, AND IT IS THE SECOND SOURCE HERE RATHER
         THAN THE FIRST. Every price on this site is PriceCharting's guide value
         -- the owner, 18 August 2026: "lets use pricecharting as the main
         numbers for the entire site" -- and sync-30th-prices.mjs reads that.
         This is kept because it arrives free in the same response, it covers
         cards PriceCharting has not priced yet on a set this new, and a second
         independent number is what catches a parse going wrong on the first.
         It is ONE marketplace where the guide value spans several, so it is
         never printed beside a PriceCharting figure as an alternative. */
      tcgpMarket: typeof r.marketPrice === "number" ? r.marketPrice : null,
      tcgpLow: typeof r.lowestPrice === "number" ? r.lowestPrice : null,
    });
  }
}

/* ORDER BY SECTION THEN BY NUMBER, so the file reads like a binder and a diff
   of it is legible. Classic Collection numbers are original-set ones of mixed
   denominators, so they sort on the numerator and ties keep their name order. */
const ORDER = ["pikachu", "main", "secret", "classic", "energy"];
cards.sort(
  (a, b) =>
    ORDER.indexOf(a.section) - ORDER.indexOf(b.section) ||
    (parseInt(a.n, 10) || 0) - (parseInt(b.n, 10) || 0) ||
    a.name.localeCompare(b.name)
);

const bySection = {};
for (const c of cards) bySection[c.section] = (bySection[c.section] || 0) + 1;
console.log("\nby section:", JSON.stringify(bySection));

/* THE CHECKS. Each one is a fact this site already publishes, so a source that
   quietly changes shape fails here instead of on the page. */
const problems = [];
if (bySection.pikachu !== 30)
  problems.push(`${bySection.pikachu || 0} cards tagged "Pikachu Rare", expected exactly 30`);
const mainTotal = (bySection.pikachu || 0) + (bySection.main || 0);
if (mainTotal !== 128) problems.push(`${mainTotal} cards numbered 1..128, expected 128`);
if (bySection.classic !== 30)
  problems.push(`${bySection.classic || 0} Classic Collection cards, expected 30`);
const dupes = [...new Set(
  cards.map((c) => `${c.section}|${c.n}`).filter((k, i, a) => a.indexOf(k) !== i)
)];
if (dupes.length) problems.push(`duplicate section|number: ${dupes.slice(0, 6).join(", ")}`);

/* NEVER WRITE A SMALLER FILE OVER A BIGGER ONE WITHOUT BEING TOLD TO. This is
   sync-dex-art.mjs's recorded fault, which wrote an EMPTY manifest on a runner
   where its measuring failed and still exited 0, so a page said "no artwork
   held" and only --diff caught it. Here the set is still being revealed, so the
   count should only ever go UP; a drop means TCGplayer changed a set name or
   answered thin, and the committed file is the better answer. */
const prev = JSON.parse(await readFile(OUT, "utf8").catch(() => "null"));
if (prev && Array.isArray(prev.cards) && cards.length < prev.cards.length && !FORCE) {
  console.error(
    `\nREFUSING to write ${cards.length} cards over the committed ${prev.cards.length}. ` +
      `This set is still being revealed, so the count should only rise. ` +
      `Re-run with --force if the drop is real.`
  );
  process.exit(1);
}
if (problems.length) {
  console.error("\nThe source does not look like the set this site describes:");
  for (const p of problems) console.error(`  ${p}`);
  if (!FORCE) {
    console.error("\nNothing written. Re-run with --force if the set itself changed.");
    process.exit(1);
  }
  console.error("\n--force given, writing anyway.");
}

const doc = {
  _readme: [
    "THE ENGLISH 30th Celebration CHECKLIST, and the product ids its card",
    "pictures are hotlinked from. Written by scripts/sync-30th-tcgplayer.mjs;",
    "do not edit by hand, re-run that instead. It is NOT in build-all.mjs,",
    "because that list only builds and pulls no fresh data.",
    "",
    "WHY TCGPLAYER AND NOT TCGDEX. On 16 September 2026, the set's release day,",
    "TCGdex still held no 2026 anniversary set and pokemontcg.io's only",
    "Celebrations is the 2021 one; both were checked that morning. TCGplayer had",
    "the set. It is also the same host data/card-shots.json already hotlinks for",
    "cards TCGdex has no scan for, so this is that arrangement for a whole set.",
    "Nothing is resized or rehosted, so no derivative of anyone's artwork is",
    "made, which is the license clause that stops this site hosting official",
    "card images at all.",
    "",
    "THIS FILE RETIRES ITSELF. build-30th.mjs prefers the owner's own photograph",
    "first, then TCGdex once data/30th.json's `tcgdex.series` and `tcgdex.set`",
    "are filled in, then this. Filling those two ids moves all 199 pockets onto",
    "the canonical source with no edit here.",
    "",
    "SECTIONS match the binder's five. `pikachu` is found by TCGplayer's own",
    "\"Pikachu Rare\" rarity rather than by a number range, because the 30",
    "Pikachu are inside the 128 and are not contiguous; `secret` is anything",
    "numbered above 128, the set's own printed denominator; `classic` is a",
    "separate TCGplayer set whose cards keep their ORIGINAL numbering, which is",
    "why `n` is stored verbatim and never parsed.",
    "",
    "WHAT IS MISSING IS MISSING AT THE SOURCE, not dropped here. The eight foil",
    "basic Energy are numbered in a different set entirely -- the owner's own",
    "card reads MEE 016, not a 30C number -- and TCGplayer lists none of them",
    "under either set name above. Some secret rares were still unrevealed on",
    "release day, which PokeBeach's own guide says outright. Re-run this as they",
    "appear; the script refuses to write a smaller file than the committed one.",
  ],
  source: "tcgplayer.com marketplace search, product ids for tcgplayer-cdn",
  sets: { main: MAIN_SET, classic: CLASSIC_SET },
  checked: new Date().toISOString().slice(0, 10),
  counts: bySection,
  cards,
};
await writeFile(OUT, JSON.stringify(doc, null, 2) + "\n");
console.log(`\nWrote data/30th-checklist.json  ${cards.length} cards`);
