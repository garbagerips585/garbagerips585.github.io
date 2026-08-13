#!/usr/bin/env node
// Graded prices from PriceCharting, for the cards we actually pulled.
//
//   node scripts/sync-pricecharting.mjs            hits only
//   node scripts/sync-pricecharting.mjs --chase    hits plus the top 3 chase per set
//   node scripts/sync-pricecharting.mjs --chase --top=5   ...top 5 instead
//
// Writes data/graded.json. Nothing else on the site reads PriceCharting.
//
// WHY THIS EXISTS. TCGdex gives raw TCGplayer market prices nightly, free and
// keyless, and that stays the source for raw. What it has NO answer for is what
// a card is worth GRADED, and that is the question a hit page is really asking.
// PriceCharting publishes 18 tiers per card, including every grading company's
// 10, which is also the only way to show what each company's slab is actually
// worth: BGS 10 at $477.98 against PSA 10 at $176.57 on the same card says more
// than any fee table.
//
// SCOPED ON PURPOSE, and this is the important part. A product page is about
// 1MB. The 4,481 cards in the card index would be roughly 4.4GB of somebody
// else's bandwidth for data we would show on a handful of pages. This fetches
// only cards that appear in a rip or are a set's chase card: tens, not
// thousands. Do not point it at the whole catalogue.
//
// POLITENESS. One request a second, an honest User-Agent that says who we are
// and where to complain, and the search endpoint first so a product page is
// only fetched once we know which card it is. Their robots.txt allows this
// path; their terms are a separate question and were not retrievable when this
// was written, so keep the volume low and the identification honest.
//
// THE PRICES ARE A SNAPSHOT, not a feed. Each card records the date it was read
// and the url it came from, and the pages print both. They will go stale, which
// is the trade for having graded prices at all.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "GarbageRips585/1.0 (fan site; youtube.com/@GarbageRips585)";
const WANT_CHASE = process.argv.includes("--chase");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The tiers worth keeping. PriceCharting prints grades 1 to 8 as well; they are
// dropped because nobody grades a modern card hoping for a 6, and eighteen
// numbers on a card tile is not a comparison, it is a wall.
const TIERS = [
  ["ungraded", "Ungraded"],
  ["g9", "Grade 9"],
  ["g95", "Grade 9.5"],
  ["psa10", "PSA 10"],
  ["cgc10", "CGC 10"],
  ["bgs10", "BGS 10"],
  ["sgc10", "SGC 10"],
  ["tag10", "TAG 10"],
  ["ace10", "ACE 10"],
];

const money = (s) => (s ? Number(String(s).replace(/[^0-9.]/g, "")) || null : null);

// VALIDATE THE MATCH OR THROW IT AWAY. The search endpoint returns its best
// guess, and its best guess is wrong often enough to matter: asked for "Rotom"
// it returned "Rotom ex", asked for Mega Gengar ex in Phantasmal Flames it
// returned the Ascended Heroes printing, and asked for Dawn it returned #129
// when ours is #118. Three bad matches in fifteen numberless lookups. Publishing
// a graded price for the wrong card is worse than publishing none, so a result
// is only accepted when the set agrees with our own record and, where we know
// the number, the number agrees too.
// Fold accents BEFORE stripping, or "Pokémon GO" becomes "pokmongo" and never
// matches their "Pokemon Go". That cost three good matches on the first run.
const norm = (x) =>
  String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
// A promo set is named differently by everyone. We call it "MEP Black Star
// Promos"; PriceCharting files the same card under "Pokemon Promo". Treat any
// promo label as matching any other, and lean on the card name and number,
// which are what actually identify the printing.
const isPromo = (x) => /promo/i.test(String(x || ""));

function accept(found, want) {
  // "Pokemon Phantasmal Flames" against our "Phantasmal Flames"
  if (want.setName && !(isPromo(want.setName) && isPromo(found.consoleName))
      && !norm(found.consoleName).includes(norm(want.setName))) return "wrong set";
  // "Rotom ex" is not "Rotom". Compare the name with the number stripped off.
  const got = norm(String(found.productName).replace(/#\d+.*$/, ""));
  if (got !== norm(want.name)) return "different card";
  if (want.number && !String(found.productName).includes("#" + String(want.number).replace(/^0+/, "")))
    return "wrong printing";
  return null;
}

/** Find a card's PriceCharting page. Returns null rather than guessing. */
async function find(name, number) {
  const q = encodeURIComponent(`${name} ${number}`.trim());
  const r = await fetch(`https://www.pricecharting.com/search-products?q=${q}&type=prices&format=json`, {
    headers: { "User-Agent": UA },
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const hit = (j && j.products && j.products[0]) || null;
  if (!hit) return null;
  // The search result already carries three tiers. Keep them: if the product
  // page later fails we still have the two that matter most.
  return {
    productName: hit.productName,
    consoleName: hit.consoleName,
    id: hit.id,
    ungraded: money(hit.price1),
    psa10: money(hit.price2),
    g9: money(hit.price3),
  };
}

/** The full grade table, from the product page. */
async function table(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) return null;
  const html = await r.text();
  const rows = [...html.matchAll(/<td[^>]*>\s*([^<]{2,20}?)\s*<\/td>\s*<td[^>]*>\s*\$?([\d,]+\.\d\d)/g)];
  const byLabel = new Map(rows.map((m) => [m[1].trim(), money(m[2])]));
  const out = {};
  for (const [key, label] of TIERS) if (byLabel.has(label)) out[key] = byLabel.get(label);
  return Object.keys(out).length ? out : null;
}

// What to price: every hit, plus optionally every set's chase card.
const targets = new Map();
const hits = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")).videos || {};
for (const list of Object.values(hits)) {
  // Carry the set through: it is what makes a match checkable.
  for (const h of list)
    targets.set(`${h.card}|${h.number || ""}`, { name: h.card, number: h.number || "", setName: h.setName });
}
if (WANT_CHASE) {
  const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
  // TOP N PER SET, not every chase card. All 184 is about 193MB of their
  // bandwidth; the top three per set is 69 cards and covers the ones anybody
  // actually asks about. sets.json already sorts chase by price, so slicing
  // takes the dearest.
  const N = Number((process.argv.find((a) => a.startsWith("--top=")) || "--top=3").split("=")[1]) || 3;
  for (const s of sets)
    for (const c of (s.chase || []).slice(0, N))
      targets.set(`${c.name}|${c.number}`, { name: c.name, number: c.number, setName: s.name });
}

console.log(`Pricing ${targets.size} card(s) from PriceCharting, one a second...`);
const out = {};
let ok = 0;
let missed = 0;
for (const [key, t] of targets) {
  const found = await find(t.name, t.number);
  await sleep(1100);
  if (!found) {
    missed += 1;
    console.log(`  MISS  ${t.name} ${t.number}`);
    continue;
  }
  const why = accept(found, t);
  if (why) {
    missed += 1;
    console.log(`  DROP  ${t.name} ${t.number} (${t.setName || "?"}) -> ${found.productName} (${found.consoleName}) [${why}]`);
    continue;
  }
  const slug = `https://www.pricecharting.com/game/${found.consoleName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${found.productName
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
  const full = await table(slug);
  await sleep(1100);
  out[key] = {
    name: t.name,
    number: t.number,
    matched: found.productName,
    set: found.consoleName,
    url: slug,
    ...{ ungraded: found.ungraded, psa10: found.psa10, g9: found.g9 },
    ...(full || {}),
    // A page that did not parse still keeps its three search-result tiers, and
    // says so, rather than silently looking like a full record.
    partial: !full,
  };
  ok += 1;
  console.log(
    `  ok    ${t.name} ${t.number} -> ${found.productName} (${found.consoleName})` +
      `  raw ${out[key].ungraded ?? "-"}  PSA10 ${out[key].psa10 ?? "-"}` +
      `  BGS10 ${out[key].bgs10 ?? "-"}${full ? "" : "  [search only]"}`,
  );
}

await writeFile(
  join(ROOT, "data/graded.json"),
  JSON.stringify(
    {
      _readme: [
        "Graded prices from pricecharting.com, keyed by card name and number.",
        "",
        "A SNAPSHOT, NOT A FEED. Written by scripts/sync-pricecharting.mjs when it",
        "is run by hand. Every record carries the url it came from and the file",
        "carries the date, and the pages print both, because these do not refresh",
        "overnight the way the raw TCGdex prices do.",
        "",
        "RAW PRICES STILL COME FROM TCGDEX. `ungraded` here is kept only so the",
        "graded figures can be compared against the raw price PriceCharting itself",
        "saw. Where the two sources disagree the site quotes TCGdex for raw,",
        "because that is the number every other page uses.",
        "",
        "SCOPED TO CARDS WE PULLED. Do not run this over the whole card index: a",
        "product page is about 1MB and 4,481 of them is roughly 4.4GB of somebody",
        "else's bandwidth for data that would appear on a handful of pages.",
      ],
      source: "pricecharting.com",
      checked: new Date().toISOString().slice(0, 10),
      cards: out,
    },
    null,
    2,
  ) + "\n",
);
console.log(`\nWrote data/graded.json: ${ok} priced, ${missed} not found`);
