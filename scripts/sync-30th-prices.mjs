/* PRICES FOR 30th CELEBRATION, FROM PRICECHARTING, JOINED ONTO THE CHECKLIST.
 *
 *     node scripts/sync-30th-prices.mjs [--dry-run]
 *
 * Writes data/30th-prices.json. build-30th.mjs reads it for the set page's
 * value bands. NOT in build-all.mjs: that list only builds and fetches nothing.
 *
 * WHY THIS IS A SEPARATE SCRIPT AND NOT THE NORMAL PIPELINE. Every other set's
 * prices reach the site through refresh-prices.mjs -> sync-pricecharting-cards
 * .mjs -> sync-cards.mjs, and that chain is keyed on TCGdex sets: sync-cards
 * .mjs builds public/data/cards/<slug>.json from the TCGdex checklist. TCGdex
 * has never held this set, so there is no checklist for that chain to hang a
 * price on and /sets/30th-celebration.html cannot exist. The card list here
 * comes from data/30th-checklist.json instead, so the join has to be made here.
 *
 * IT IS STILL PRICECHARTING, WHICH IS THE POINT. The owner, 18 August 2026:
 * "lets use pricecharting as the main numbers for the entire site". A guide
 * value computed across the venues PriceCharting tracks is a different and
 * better number than one marketplace's last sale, and it is the number every
 * other set guide on this site prints. Using TCGplayer's market price here
 * instead would have made this the one set page whose figures cannot be
 * compared with any other.
 *
 * SAME CRAWL, SAME MANNERS. Same host, same exclude-hardware=true, same
 * User-Agent and the same 1.1s pacing as refresh-prices.mjs and
 * sync-graded-top.mjs, because it IS that crawl -- one console the rotation
 * does not carry yet. The headers are checked against CONSOLE_HEADERS before a
 * single price is read positionally, which is that module's own rule.
 *
 * THE JOIN IS ON THE COLLECTOR NUMBER AND THE NAME IS A CHECK.
 * PriceCharting titles a row "Mew ex #158"; the checklist holds "158/128". The
 * number is the key and the name is compared after, because a number that
 * matches while the names disagree means one of the two lists moved and that is
 * exactly the case a price must not be published through. Mismatches are
 * counted and named, never silently dropped.
 *
 * SEALED PRODUCT IS IN THE SAME LISTING and is skipped: the console carries
 * "Elite Trainer Box" and "Booster Box" rows with an Ungraded price and no
 * card number, which is how they are told apart.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONSOLE_HEADERS, parsePage, productColumns } from "../shared/pricecharting.mjs";
import { localDay } from "../shared/today.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONSOLE = "/console/pokemon-30th-celebration";
const OUT = join(ROOT, "data/30th-prices.json");
const DRY = process.argv.includes("--dry-run");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const checklist = JSON.parse(await readFile(join(ROOT, "data/30th-checklist.json"), "utf8"));
/* KEYED ON THE NUMERATOR, WITH THE CLASSIC COLLECTION DELIBERATELY LEFT OUT OF
   THE KEY SPACE. Its reprints keep their ORIGINAL numbering, so it holds 11/101
   and 11/113 and three different 106s -- the same collision build-30th.mjs
   records. PriceCharting numbers those rows by the 30th's own sequence, not the
   original set's, so they cannot be joined on a numerator at all and are left
   unpriced rather than guessed at. */
const byNum = new Map();
for (const c of checklist.cards || []) {
  if (c.section === "classic") continue;
  const k = String(c.n).split("/")[0].replace(/^0+/, "") || "0";
  if (!byNum.has(k)) byNum.set(k, c);
}
console.log(`checklist: ${checklist.cards.length} cards, ${byNum.size} joinable by number`);

/* THE TWO LISTS SPELL THE NIDORAN DIFFERENTLY AND IT IS THE ONLY DISAGREEMENT.
   TCGplayer writes "Nidoran F" for the female; PriceCharting writes plain
   "Nidoran". Across all 154 joinable rows that is the single name mismatch, so
   it is aliased explicitly rather than loosened into a prefix rule -- a prefix
   rule would happily match "Mew" to "Mewtwo", which is two real cards in this
   very set. The sex sign is part of the name and gets stripped only where it is
   trailing and alone. It carries no price today, so this loses nothing now and
   stops losing one the day PriceCharting computes it. */
const norm = (s) =>
  String(s || "")
    .replace(/\s+[FM\u2640\u2642]$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/* THE CLASSIC COLLECTION JOINS ON NAME AND NUMBER TOGETHER, added 23 September
   2026. On the 16th PriceCharting titled those reprints with a bracket and no
   price ("Charizard [Holo] #4") and they were skipped wholesale. A week later
   the bracket is gone and all 30 are priced, titled by name and the ORIGINAL
   set's number: "Charizard #4", "Lugia #149", "Magikarp #203". The numerator
   alone still cannot key them -- 4 is Illumise in the main set, and the
   section itself holds two 11s and three 106s -- but name plus numerator is
   unique across all 30 (checked below, and the run refuses if it is not), so a
   row whose number matches a main set card and whose NAME does not is tried
   here before it is called a mismatch. */
/* The checklist tells five of them apart with a parenthetical PriceCharting does
   not print -- "Metagross (Delta Species)", "Gengar (Prime)", "Darkrai &
   Cresselia Legend (Top)" -- so it is dropped before the compare. The number
   still separates the Top and Bottom halves (99 and 100) and the two 11s. */
const classicKey = (name, num) => `${norm(String(name).replace(/\s*\([^)]*\)\s*$/, ""))}#${String(num).split("/")[0].replace(/^0+/, "") || "0"}`;
const classic = new Map();
for (const c of checklist.cards || []) {
  if (c.section !== "classic") continue;
  const k = classicKey(c.name, c.n);
  if (classic.has(k)) { console.error(`classic key collides: ${k}`); process.exit(1); }
  classic.set(k, c);
}

const rows = [];
let cursor = 0;
for (let page = 1; page <= 12; page++) {
  const url =
    `https://www.pricecharting.com${CONSOLE}?exclude-hardware=true` + (cursor ? `&cursor=${cursor}` : "");
  if (DRY) {
    console.log(`  would fetch  ${url}`);
    break;
  }
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" } });
  if (!res.ok) {
    // REFUSED IS NOT FINISHED. refresh-prices.mjs records the same distinction:
    // stopping on a 429 halfway through and calling the console done dates every
    // card in it as read today while 40% of them were never seen.
    console.error(`  HTTP ${res.status} on page ${page}; stopping WITHOUT claiming the set is complete`);
    process.exit(1);
  }
  const html = await res.text();
  const parsed = parsePage(html);
  if (page === 1 && JSON.stringify(parsed.headers) !== JSON.stringify(CONSOLE_HEADERS)) {
    console.error(
      `  column layout changed: ${JSON.stringify(parsed.headers)}\n` +
        `  expected ${JSON.stringify(CONSOLE_HEADERS)}. Refusing to read prices positionally.`
    );
    process.exit(1);
  }
  rows.push(...parsed.rows);
  console.log(`  page ${page}: ${parsed.rows.length} rows (${rows.length} total)`);
  if (!parsed.next) break;
  cursor = parsed.next;
  await sleep(1100);
}
if (DRY) process.exit(0);

const priced = {};
let sealed = 0, bracketed = 0, unmatched = [], nameMismatch = [], noPrice = 0;
for (const r of rows) {
  /* A BRACKETED NAME IS NOT A MAIN SET CARD, AND THIS GUARD IS WHY THE FIRST
     RUN REFUSED TO WRITE. PriceCharting titles the Classic Collection reprints
     with their ORIGINAL set's number and a bracket -- "Charizard [Holo] #4",
     "Genesect EX [Team Plasma Holo] #11", "Metagross [Delta Species Holo] #11"
     -- and those numbers collide head on with the 30th's own main set, where 4
     is Illumise and 11 is Moltres. Joining on the numerator alone matched 33
     rows to the wrong card and the name check caught every one of them.
     The same bracket also marks retailer and product variants: [Knockout
     Collection], [Best Buy], [Gamestop], [Prime Holo], [Top Holo],
     [Bottom Holo]. ALL 33 CARRY NO PRICE AT ALL TODAY, so skipping them costs
     nothing and guessing at them would have cost 33 wrong prices on the page.
     The 154 plain rows are exactly the 128 main set plus 26 of the secrets. */
  if (/\[/.test(r.name)) { bracketed += 1; continue; }
  const m = /^(.*?)\s*#([A-Za-z0-9/]+)\s*$/.exec(r.name);
  if (!m) { sealed += 1; continue; }
  const [, rawName, num] = m;
  const key = String(num).split("/")[0].replace(/^0+/, "") || "0";
  const main = byNum.get(key);
  const card = main && norm(rawName) === norm(main.name) ? main : classic.get(classicKey(rawName, num));
  if (!card) {
    if (main) nameMismatch.push(`${r.name} vs ${main.name} ${main.n}`);
    else unmatched.push(r.name);
    continue;
  }
  if (r.ungraded == null && r.psa10 == null) { noPrice += 1; continue; }
  priced[`${card.section}|${card.n}`] = {
    n: card.n, name: card.name, section: card.section,
    raw: r.ungraded ?? null, g9: r.g9 ?? null, psa10: r.psa10 ?? null,
    pc: r.path || null,
  };
}
const list = Object.values(priced);
console.log(`\n${rows.length} console rows -> ${list.length} priced cards`);
console.log(`  sealed rows skipped:      ${sealed}`);
console.log(`  bracketed rows skipped:   ${bracketed}  (Classic Collection reprints and retailer variants; none is priced yet)`);
console.log(`  no number match:          ${unmatched.length}${unmatched.length ? "  " + unmatched.slice(0,4).join(", ") : ""}`);
console.log(`  number matched, NAME NOT: ${nameMismatch.length}${nameMismatch.length ? "  " + nameMismatch.slice(0,4).join(" | ") : ""}`);
console.log(`  matched but unpriced:     ${noPrice}`);
console.log(`  with a PSA 10:            ${list.filter((c) => c.psa10 != null).length}`);

/* NEVER WRITE FEWER PRICES OVER MORE. Same rule as the checklist sync and for
   the same recorded reason: a source that answers thin must not silently
   replace a good file. On a set this new the count should climb for weeks. */
const prev = JSON.parse(await readFile(OUT, "utf8").catch(() => "null"));
if (prev && prev.cards && Object.keys(prev.cards).length > list.length && !process.argv.includes("--force")) {
  console.error(
    `\nREFUSING to write ${list.length} priced cards over the committed ${Object.keys(prev.cards).length}. ` +
      `Re-run with --force if the drop is real.`
  );
  process.exit(1);
}
if (nameMismatch.length > 5) {
  console.error(`\nREFUSING: ${nameMismatch.length} rows matched a number but not the name. One of the two lists has moved.`);
  process.exit(1);
}

/* THE PROMOS AND JUMBOS, added 23 September 2026. They are in no console this
   script reads: PriceCharting files every English promo in one "Pokemon Promo"
   console of thousands, so each is read off its own product page instead, one
   request apiece at the same pacing. The list is the binder's own promos and
   jumbos, so a promo the owner adds is priced on the next run.

   THE SLUG IS BUILT, SO THE PAGE IS CHECKED BEFORE ITS PRICE IS TRUSTED. The
   title has to name the card and the number, and the page has to mention the
   30th at least once, because that console also holds older promos and a built
   slug could land on one. All six promos and both jumbos were also checked by
   eye against PriceCharting's own scan on the day this went in: each carries
   the 30th Celebration logo.

   ARTICUNO 097 IS LEFT UNPRICED ON PURPOSE. Its page read $12.02 against $1.99
   to $3.99 for the five other promos, and its recent sales are all three-card
   lots of the Poster Collection's Zapdos, Articuno and Moltres, so that figure
   is the price of three cards filed against one. A wrong number is worse than
   none; re-check it when single sales appear. */
const NOT_YET = { "promo|097": "recent sales are three-card Poster Collection lots, not the single card" };
const binder = JSON.parse(await readFile(join(ROOT, "data/30th-binder.json"), "utf8"));
const pslug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const promoPrices = {};
for (const [kind, list] of [["promo", binder.promos || []], ["jumbo", binder.jumbos || []]]) {
  for (const o of list) {
    const num = Number(o.n);
    const key = `${kind}|${String(o.n).padStart(3, "0")}`;
    if (NOT_YET[key]) { console.log(`  ${key.padEnd(10)} ${o.name}: skipped, ${NOT_YET[key]}`); continue; }
    const path = `/game/pokemon-promo/${pslug(o.name)}${kind === "jumbo" ? "-jumbo" : ""}-${num}`;
    await sleep(1100);
    const res = await fetch(`https://www.pricecharting.com${path}`, { headers: { "user-agent": UA, accept: "text/html" } });
    if (!res.ok) { console.log(`  ${key.padEnd(10)} ${o.name}: HTTP ${res.status}, left unpriced`); continue; }
    const html = await res.text();
    const title = (/<title>([^<]*)/.exec(html) || [])[1] || "";
    if (!norm(title).startsWith(norm(o.name)) || !new RegExp(`#${num}\\b`).test(title) || !/30th/i.test(html)) {
      console.log(`  ${key.padEnd(10)} ${o.name}: page "${title.trim()}" is not this card, left unpriced`);
      continue;
    }
    const { cols } = productColumns(html);
    const raw = cols?.Ungraded ?? null;
    if (raw == null) { console.log(`  ${key.padEnd(10)} ${o.name}: no ungraded price yet`); continue; }
    promoPrices[key] = { n: o.n, name: o.name, kind, raw, g9: cols["Grade 9"] ?? null, psa10: cols["PSA 10"] ?? null, pc: path };
    console.log(`  ${key.padEnd(10)} ${o.name}: $${raw}${cols["PSA 10"] != null ? `, PSA 10 $${cols["PSA 10"]}` : ""}`);
  }
}

await writeFile(OUT, JSON.stringify({
  _readme: [
    "PRICECHARTING PRICES FOR 30th Celebration, joined onto data/30th-checklist",
    ".json by collector number. Written by scripts/sync-30th-prices.mjs; do not",
    "edit by hand, re-run that. NOT in build-all.mjs, which fetches nothing.",
    "",
    "SAME SOURCE AS EVERY OTHER SET GUIDE ON THIS SITE, which is the whole",
    "reason it exists: the normal chain is keyed on TCGdex sets and TCGdex has",
    "never held this one, so the join had to be made somewhere. `raw` is",
    "PriceCharting's Ungraded guide value, the same figure other set pages call",
    "raw NM. `g9` and `psa10` are its graded columns.",
    "",
    "THE CLASSIC COLLECTION JOINS ON NAME AND NUMBER TOGETHER. Its 30 cards",
    "are reprints that keep their ORIGINAL numbering, so the section holds two",
    "cards numbered 11 and three numbered 106, and 4 is also Illumise in the",
    "main set. PriceCharting titles them by name and that original number, and",
    "the pair is unique across all 30, so the pair is the key.",
    "",
    "A CARD MISSING FROM HERE IS UNPRICED, NOT WORTHLESS. The set came out on 16",
    "September 2026 and PriceCharting prices a card once it has sales to compute",
    "a guide value from, so this file fills in over weeks. The page says how many",
    "of the set it has a price for and never implies a missing one is cheap.",
  ],
  source: "pricecharting.com console listing, Ungraded / Grade 9 / PSA 10",
  console: CONSOLE,
  checked: localDay(),
  counts: { rows: rows.length, priced: list.length, psa10: list.filter((c) => c.psa10 != null).length },
  cards: priced,
  promos: promoPrices,
}, null, 2) + "\n");
console.log(`\nWrote data/30th-prices.json  ${list.length} priced cards`);
