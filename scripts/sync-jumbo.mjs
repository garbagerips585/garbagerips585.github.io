#!/usr/bin/env node
/* THE JUMBO CARD CATALOGUE, from tcgcsv.com.
 *
 *     node scripts/sync-jumbo.mjs
 *
 * NOT IN build-all.mjs AND MUST NOT BE ADDED TO IT, same arrangement and same
 * reason as sync-decks.mjs: it is a few requests against somebody else's server
 * and what it records is a dated snapshot, so refreshing it is a deliberate act
 * by a person who then re-reads what the page claims.
 *
 * WHY tcgcsv AND NOT TCGplayer DIRECTLY, which is the interesting part and was
 * a decision rather than a convenience. The data originates with TCGplayer
 * either way -- tcgcsv describes itself as a public entrypoint for TCGplayer's
 * API and its operator holds a key. The difference is permission. TCGplayer's
 * Terms of Service, updated 27 September 2023, say "You agree not to crawl,
 * scrape or spider any of our websites without express permission from us", and
 * their Developer Portal says "We are no longer granting new API access at this
 * time", so the sanctioned route is shut. tcgcsv's own FAQ asks the opposite
 * question and answers it "go ahead", its robots.txt is `Allow: /`, and its
 * sample code asks callers to identify themselves, which is why this sends a
 * real User-Agent. That is a better footing than robots.txt-says-yes-ToS-says-no.
 *
 * WHAT IT CANNOT GIVE, recorded here so nobody goes looking twice:
 *   - A RELEASE DATE PER CARD. Every product in this group carries the GROUP's
 *     publishedOn, 2015-04-01, including cards from 1999 and from 2026. It is a
 *     set-level constant and printing it as a card date would be a fabrication.
 *     The builder does not read it.
 *   - PRICE HISTORY. tcgcsv's daily archive has returned 403 since its operator
 *     withdrew it pending clarification from TCGplayer. Current snapshot only.
 *   - COMPLETENESS. This group is TCGplayer's filing of what a jumbo is, and it
 *     is not the whole truth: the 25th Anniversary First Partner Pack jumbos are
 *     filed under their own set, and Japanese jumbos are absent entirely.
 *     Bulbapedia's international list runs to 395 against this group's 345 and
 *     NEITHER CONTAINS THE OTHER. The page says so rather than picking a number.
 */
import { writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { localDay } from "../shared/today.mjs";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/jumbo-catalogue.json");
const UA = "garbagerips585-site/1.0 (Pokemon card reference page; https://garbagerips.com)";
const GROUP = 1528;

const get = async (url) => {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
  if (!r.ok) throw new Error(`${r.status} on ${url}`);
  return r.json();
};
const rows = (j) => j.results || j.Results || (Array.isArray(j) ? j : []);

/* THE GUARD, and it is the same shape sync-30th-tcgplayer.mjs uses: a group id
   is a number and a number cannot tell you it now means something else. If 1528
   ever stops being "Jumbo Cards" this refuses rather than quietly rewriting the
   catalogue with another set's products. */
const groups = rows(await get("https://tcgcsv.com/tcgplayer/3/groups"));
const g = groups.find((x) => x.groupId === GROUP);
if (!g) throw new Error(`group ${GROUP} is gone from tcgcsv`);
if (g.name !== "Jumbo Cards") throw new Error(`group ${GROUP} is now "${g.name}", not "Jumbo Cards" -- refusing`);

const products = rows(await get(`https://tcgcsv.com/tcgplayer/3/${GROUP}/products`));
const prices = rows(await get(`https://tcgcsv.com/tcgplayer/3/${GROUP}/prices`));
if (!products.length) throw new Error("no products came back");

/* ONE PRICE PER PRODUCT AND THE SUBTYPE IS NOT NOISE. A product can carry a
   Holofoil row and a Normal row; taking whichever arrived last would make the
   figure depend on tcgcsv's ordering. Prefer the printing with a market price,
   and where both have one prefer Holofoil, because a jumbo is foil by default. */
const RANK = { Holofoil: 0, "Reverse Holofoil": 1, Normal: 2 };
const byId = new Map();
for (const p of prices) {
  const cur = byId.get(p.productId);
  const better = !cur
    || (cur.marketPrice == null && p.marketPrice != null)
    || (cur.marketPrice != null && p.marketPrice != null
        && (RANK[p.subTypeName] ?? 9) < (RANK[cur.subTypeName] ?? 9));
  if (better) byId.set(p.productId, p);
}

const ex = (p, k) => (p.extendedData || []).find((d) => d.name === k)?.value ?? null;
const cards = products.map((p) => {
  const pr = byId.get(p.productId) || {};
  return {
    pid: p.productId,
    name: p.name,
    n: ex(p, "Number"),
    rarity: ex(p, "Rarity"),
    market: pr.marketPrice ?? null,
    low: pr.lowPrice ?? null,
    sub: pr.subTypeName ?? null,
  };
}).sort((a, b) => (b.market ?? -1) - (a.market ?? -1) || a.name.localeCompare(b.name));

/* REFUSES TO SHRINK. A partial answer from upstream looks exactly like a set
   that lost cards, and the difference matters because this file is the page's
   denominator. */
let prevCount = 0;
try { prevCount = JSON.parse(await readFile(OUT, "utf8")).cards.length; } catch {}
if (prevCount && cards.length < prevCount * 0.9)
  throw new Error(`only ${cards.length} cards against ${prevCount} on file -- refusing to shrink`);

const priced = cards.filter((c) => c.market != null).length;
await writeFile(OUT, JSON.stringify({
  _readme: [
    "TCGPLAYER'S 'Jumbo Cards' GROUP (groupId 1528), via tcgcsv.com. Written by",
    "scripts/sync-jumbo.mjs; do not edit by hand, re-run that instead.",
    "",
    "THIS IS NOT EVERY JUMBO CARD AND THE PAGE MUST NOT SAY IT IS. It is how",
    "TCGplayer files them. The 25th Anniversary First Partner Pack jumbos sit in",
    "their own set and are absent here; Japanese jumbos are absent entirely.",
    "Bulbapedia's international list holds 395 entries against this 345, about 89%",
    "of its names appear here, and neither list contains the other.",
    "",
    "NO RELEASE DATE IS STORED even though the upstream carries one, because the",
    "upstream's is the GROUP's publishedOn (2015-04-01) repeated on every card,",
    "including cards from 1999. It is a set-level constant, not a card date.",
    "",
    "`market` is TCGplayer's market price for the preferred printing, Holofoil",
    "first. It is a marketplace figure and NOT the guide value the rest of this",
    "site prints; the graded numbers on the page come from PriceCharting instead.",
  ],
  source: { name: "tcgcsv.com, a public entrypoint for TCGplayer's API", url: "https://tcgcsv.com/tcgplayer/3/1528/products" },
  group: { id: GROUP, name: g.name, modifiedOn: g.modifiedOn },
  // localDay(), NOT toISOString(). UTC is already tomorrow for most of the
  // evening here, and check-build fails a file that claims to have been read in
  // the future -- which is how this line was caught rather than shipped.
  checked: localDay(),
  counts: { cards: cards.length, priced },
  cards,
}, null, 2) + "\n");

console.log(`Wrote data/jumbo-catalogue.json`);
console.log(`  ${cards.length} cards, ${priced} with a market price`);
console.log(`  dearest: ${cards[0].name} $${cards[0].market}`);
console.log(`  group last modified upstream: ${g.modifiedOn}`);
