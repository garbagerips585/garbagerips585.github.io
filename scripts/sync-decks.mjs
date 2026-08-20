#!/usr/bin/env node
// Pull the current Standard metagame and a corpus of real decklists from
// Limitless, and write data/decks.json.
//
//   node scripts/sync-decks.mjs
//
// Feeds TWO pages, both of which are only as honest as this file:
//   scripts/build-decks.mjs     -> /decks.html and the .txt files it offers
//   scripts/build-playable.mjs  -> /top-100-playable.html
//
// WHAT THIS DATA ACTUALLY IS, because the page has to say so and a later editor
// has to not quietly widen the claim. play.limitlesstcg.com is Limitless's OWN
// ONLINE TOURNAMENT PLATFORM. The events in here are things called "Moujii's
// Dojo", "Sunny's Weekly" and "SEASAC League Challenge": online tournaments
// played in Pokemon TCG Live, usually for booster-code prizes, run by community
// organisers. THEY ARE NOT Play! Pokemon paper events, they are not Regionals,
// and nothing in this file is a Worlds result. That distinction is the whole
// reason the page can be trusted: it is a large, real, dated, checkable sample
// of what people actually queue up and play in the client this site sends
// people to, and it is not dressed up as something with a trophy attached.
//
// It is also, conveniently, the right sample for the question being asked. The
// two pages are about decks you can BUILD AND PLAY IN TCG LIVE. A paper
// Regional top cut is a worse answer to that than a few hundred lists played in
// the client itself.
//
// THE RANKING METRIC IS USAGE AND IT IS THE ONLY ONE THE PAGES RANK BY.
// Limitless gives Count, Share and Win %, and those are three different claims.
// The archetype list is ordered by SHARE, which is "how much of the recorded
// field played this", and the pages say so in those words. Win % is carried
// through and PRINTED, because withholding it would be its own distortion, but
// it never sets an order and it is labelled as a separate measurement. A deck
// that wins a lot is not the same claim as a deck that gets played a lot, and
// "best deck" is not a claim this site can source at all, so it is never made.
//
// THE FORMAT FILTER IS PINNED AND RECORDED. The request is
// format=standard&rotation=2026&set=PBL, which is Limitless's own name for
// "Standard, under the 2026 rotation, over the period Pitch Black has been
// legal". Because every list in the corpus is drawn through that filter, format
// legality is NOT something this script adjudicates card by card: the lists are
// legal by construction, and both pages say that is why. The rotation itself
// (which regulation marks are legal, and from when) is a separate, official
// fact and lives in the `format` block below, sourced to Pokemon's own
// announcement rather than to Limitless.
//
// NO PULL RATES, NO DROP RATES, NO ODDS. Nothing here touches them and nothing
// here should grow a field that does. See CLAUDE.md; the ban is absolute and it
// covers the digital client too.
//
// POLITE AND CACHED. Every response is cached under .cache/decks/ (gitignored),
// so a re-run costs nothing and a page rebuild never touches the network. A
// cold run makes roughly 200 requests with a delay between them and takes a few
// minutes. Failures are counted and reported rather than swallowed: a short
// corpus silently becomes a wrong top-100.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache/decks");
const OUT = join(ROOT, "data/decks.json");

const BASE = "https://play.limitlesstcg.com";
const FILTER = "format=standard&rotation=2026&set=PBL";

// How wide the corpus is. ARCHETYPES caps the deck list on /decks.html;
// LISTS_PER caps how many top-finishing lists are collected per archetype and
// is what the top-100 page counts over. Both are printed on the pages, because
// LISTS_PER in particular is a deliberate bias that has to be disclosed: every
// archetype contributes the same number of lists regardless of how popular it
// is, so a card in one niche deck is not drowned out by a card in a common one.
// LISTS_PER is 20 because that is EVERY list Limitless publishes on an
// archetype's Best Finishes table, not a number we picked. Taking all of them
// makes the corpus definition a fact rather than a choice ("all the top
// finishes Limitless shows") and it spreads out the bottom of the top-100,
// where cards that are staples of exactly one deck otherwise pile up on the cap
// and tie. At 12 the cap produced a 53 card tie; the cap is still where those
// cards land, so raising it improves the resolution rather than removing the
// effect, and /top-100-playable.html discloses the pile-up either way.
const ARCHETYPES = 18;
const LISTS_PER = 20;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

let fetched = 0;
let cached = 0;
const failures = [];

/** Fetch a Limitless path, caching the raw HTML by url hash. */
async function get(path) {
  const url = path.startsWith("http") ? path : BASE + path;
  const key = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const file = join(CACHE, `${key}.html`);
  try {
    const hit = await readFile(file, "utf8");
    cached += 1;
    return hit;
  } catch {
    /* cold */
  }
  // Three tries. Limitless is not an API and answers 5xx under load rather than
  // rate-limit codes, which reads as missing data unless you retry.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      await mkdir(CACHE, { recursive: true });
      await writeFile(file, html);
      fetched += 1;
      await sleep(500);
      return html;
    } catch (e) {
      if (attempt === 3) {
        failures.push(`${url}: ${e.message}`);
        return null;
      }
      await sleep(1500 * attempt);
    }
  }
  return null;
}

const strip = (s) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const attr = (tag, name) => {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? strip(m[1]) : "";
};

// ---------------------------------------------------------------------------
// 1. The metagame table.
// ---------------------------------------------------------------------------

console.log("Fetching the Standard metagame table...");
const metaHtml = await get(`/decks?${FILTER}`);
if (!metaHtml) throw new Error("could not fetch the metagame table");

// The filter row tells us which set/rotation Limitless thinks it is showing.
// Assert it rather than trust the query string: if Limitless ever ignores or
// renames a parameter, the whole page silently describes a different format.
const selSet = /<option([^>]*\bselected\b[^>]*)>([^<]*)/g;
let setLabel = "";
let setCode = "";
let rotation = "";
for (const m of metaHtml.matchAll(selSet)) {
  const code = attr(m[1], "data-set");
  if (code) {
    setCode = code;
    setLabel = strip(m[2]);
    rotation = attr(m[1], "data-rotation");
  }
}
if (setCode !== "PBL" || rotation !== "2026") {
  throw new Error(
    `Limitless answered with set=${setCode || "?"} rotation=${rotation || "?"}, ` +
      `not PBL/2026. The pages describe a specific format and must not be built ` +
      `from a different one. Check the filter names on play.limitlesstcg.com.`
  );
}

// "354 tournaments, 25782 players, 58299 matches" sits under the table and is
// the sample size the pages print.
const sampleLine = (() => {
  const m = /([\d,]+)\s+tournaments,\s*([\d,]+)\s+players,\s*([\d,]+)\s+matches/.exec(
    strip(metaHtml)
  );
  if (!m) throw new Error("could not read the sample size line");
  return {
    tournaments: Number(m[1].replace(/,/g, "")),
    players: Number(m[2].replace(/,/g, "")),
    matches: Number(m[3].replace(/,/g, "")),
  };
})();

const table = /<table[\s\S]*?<\/table>/.exec(metaHtml)?.[0] || "";
const metaRows = [];
for (const row of table.match(/<tr[\s\S]*?<\/tr>/g) || []) {
  const cells = [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) =>
    strip(m[1])
  );
  if (cells.length < 6 || cells[0] === "") continue;
  const rank = Number(cells[0]);
  if (!Number.isFinite(rank)) continue;
  const name = cells[2];
  // "Other" is Limitless's catch-all bucket, not a deck. It cannot be built,
  // downloaded or linked, so it never reaches a page.
  if (!name || /^other$/i.test(name)) continue;
  const href = /href="(\/decks\/[^"?]+)/.exec(row)?.[1] || "";
  const share = Number(String(cells[4]).replace("%", ""));
  const win = Number(String(cells[6] ?? cells[5]).replace("%", ""));
  metaRows.push({
    rank,
    name,
    slug: href.replace("/decks/", ""),
    count: Number(String(cells[3]).replace(/,/g, "")),
    share,
    record: cells[5],
    winPct: Number.isFinite(win) ? win : null,
  });
}
if (metaRows.length < 10) throw new Error(`only parsed ${metaRows.length} archetypes`);
console.log(`  ${metaRows.length} archetypes parsed`);

// ---------------------------------------------------------------------------
// 2. Best-finish lists per archetype.
// ---------------------------------------------------------------------------

/** Pull the verbatim export block Limitless puts in an inline script. */
function exportText(html) {
  // The page carries the exact string its "Copy to Clipboard" button writes.
  // Taking it verbatim is the entire reason the .txt files this site offers can
  // be trusted: nothing here re-formats, re-orders or re-spells a decklist, so
  // the file a reader downloads is byte for byte what Limitless hands its own
  // users to paste into the client.
  const m = /const decklist = `([\s\S]*?)`/.exec(html);
  return m ? m[1] : null;
}

/** Parse an export block into structured lines, without altering the text. */
function parseExport(text) {
  const sections = { Pokémon: [], Trainer: [], Energy: [] };
  let current = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const head = /^(Pokémon|Trainer|Energy):\s*(\d+)$/.exec(line);
    if (head) {
      current = head[1];
      continue;
    }
    // "4 Buddy-Buddy Poffin TEF 144" -> qty, name, set, number.
    // The name can hold spaces, apostrophes and hyphens, so anchor on the tail.
    //
    // THE SET CODE CAN CONTAIN A HYPHEN and leaving it out silently threw away
    // real lists. Promos carry codes like "PR-SV", as in "2 Pecharunt PR-SV
    // 149", and an expression that stopped at [A-Z0-9] failed the whole line,
    // which failed the whole 60-card check, which dropped an entire legal deck
    // from the corpus. Eleven of the first run's thirteen "problems" were this
    // one bug rather than anything wrong upstream. A parser that rejects valid
    // input is worse than one that errors, because the loss looks like a
    // finding about the source.
    const m = /^(\d+)\s+(.+?)\s+([A-Z][A-Z0-9-]{1,7})\s+([A-Za-z0-9]+)$/.exec(line);
    if (!m || !current) return null;
    sections[current].push({
      qty: Number(m[1]),
      name: m[2],
      set: m[3],
      number: m[4],
    });
  }
  const total = Object.values(sections)
    .flat()
    .reduce((n, c) => n + c.qty, 0);
  if (total !== 60) return null;
  return sections;
}

const decks = [];
const top = metaRows.slice(0, ARCHETYPES);
for (const arch of top) {
  if (!arch.slug) continue;
  console.log(`Fetching ${arch.name}...`);
  const html = await get(`/decks/${arch.slug}?${FILTER}`);
  if (!html) continue;
  const t = /<table[\s\S]*?<\/table>/.exec(html)?.[0] || "";
  const finishes = [];
  for (const row of t.match(/<tr[\s\S]*?<\/tr>/g) || []) {
    const open = /<tr[^>]*>/.exec(row)?.[0] || "";
    const player = attr(open, "data-player");
    if (!player) continue;
    const link = /href="(\/tournament\/[^"]*\/decklist)"/.exec(row)?.[1];
    if (!link) continue;
    const placeCell =
      [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]))[3] || "";
    finishes.push({
      player,
      tournament: attr(open, "data-tournament"),
      date: attr(open, "data-date").slice(0, 10),
      place: Number(attr(open, "data-place")) || null,
      placing: placeCell,
      record: [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
        .map((m) => strip(m[1]))[4] || "",
      link,
    });
    if (finishes.length >= LISTS_PER) break;
  }

  const lists = [];
  for (const f of finishes) {
    const page = await get(f.link);
    if (!page) continue;
    const text = exportText(page);
    if (!text) {
      failures.push(`${f.link}: no export block`);
      continue;
    }
    const parsed = parseExport(text);
    if (!parsed) {
      failures.push(`${f.link}: export did not parse to 60 cards`);
      continue;
    }
    lists.push({ ...f, text, cards: parsed });
  }
  if (!lists.length) {
    failures.push(`${arch.name}: no usable lists`);
    continue;
  }
  decks.push({ ...arch, lists });
}

// ---------------------------------------------------------------------------
// 3. Write.
// ---------------------------------------------------------------------------

const listCount = decks.reduce((n, d) => n + d.lists.length, 0);
const dates = decks
  .flatMap((d) => d.lists.map((l) => l.date))
  .filter(Boolean)
  .sort();

const out = {
  _readme: [
    "Generated by scripts/sync-decks.mjs. Do not hand-edit.",
    "",
    "Two pages read this: build-decks.mjs and build-playable.mjs.",
    "",
    "WHAT THE SAMPLE IS. Online tournaments run on Limitless's own play",
    "platform, played in Pokemon TCG Live, filtered to Standard under the 2026",
    "rotation over the period Pitch Black has been legal. These are NOT paper",
    "Play! Pokemon events. Both pages say so in those words.",
    "",
    "THE ARCHETYPE ORDER IS USAGE SHARE, never win rate and never opinion.",
    "winPct is carried for display and is a different measurement.",
    "",
    "Every `text` field is the VERBATIM export string from the decklist page,",
    "which is what Limitless's own Copy to Clipboard button writes and what",
    "Pokemon TCG Live's deck importer takes. Nothing reformats it.",
  ],
  checked: localDay(),
  source: {
    name: "Limitless TCG",
    what: "online tournaments played in Pokemon TCG Live on Limitless's play platform",
    filter: "Standard, 2026 rotation, Pitch Black era",
    setLabel,
    setCode,
    rotation,
    sample: sampleLine,
  },
  // The rotation itself is an official Pokemon fact, not a Limitless one, so it
  // is sourced separately and read on the date recorded here.
  format: {
    name: "Standard",
    legalMarks: ["H", "I", "J"],
    rotatedOut: ["G"],
    note: "Cards with H, I and J regulation marks are legal, as are any future marks. G rotated out.",
    paperEffective: "2026-04-10",
    liveEffective: "2026-03-26",
    source: "Pokemon.com, 2026 Pokemon TCG Standard Format Rotation Announcement",
    read: "2026-08-16",
  },
  corpus: {
    archetypes: decks.length,
    listsPerArchetype: LISTS_PER,
    lists: listCount,
    earliest: dates[0] || null,
    latest: dates[dates.length - 1] || null,
  },
  decks,
};

await writeFile(OUT, `${JSON.stringify(out, null, 2)}\n`);

console.log(
  `\n${decks.length} archetypes, ${listCount} decklists ` +
    `(${fetched} fetched, ${cached} from cache)`
);
if (dates.length) console.log(`Lists dated ${dates[0]} to ${dates[dates.length - 1]}`);
console.log(`Wrote ${OUT}`);
if (failures.length) {
  console.log(`\n${failures.length} problems:`);
  for (const f of failures.slice(0, 20)) console.log(`  ${f}`);
}
