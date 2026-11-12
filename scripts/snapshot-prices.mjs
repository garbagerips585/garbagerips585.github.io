#!/usr/bin/env node
/**
 * One small file a week of what every card was worth, so a trend can be drawn
 * later from the site's own record.
 *
 *   node scripts/snapshot-prices.mjs           write this week's file if the data is newer
 *   node scripts/snapshot-prices.mjs --force   write it even if the file on disk is as new
 *   node scripts/snapshot-prices.mjs --check   validate every file under data/price-history/
 *
 * Reads public/data/cards/*.json and nothing else. NO NETWORK, NO CLOCK.
 * Writes data/price-history/<ISO week>.json, for example 2026-W46.json.
 *
 * WHY THIS EXISTS. The site prints today's raw, Grade 9 and PSA 10 figure for
 * 5,000-odd cards and keeps no yesterday: the nightly overwrites each set file
 * in place, and git history holds the old ones only as 30 files of 40 to 90KB a
 * night. "Up 12% in a month" needs four dated points per card that can be read
 * without walking 30 commits. This is those points and nothing more. NO PAGE
 * READS THIS YET, on purpose: the first comparison a reader can trust needs four
 * weeks of files, and the clock started on 11 November 2026.
 *
 * THE WEEK IS THE WEEK THE PRICES WERE READ IN, NOT THE WEEK THIS RAN IN. The
 * file is named for the ISO week of the newest `pricesChecked` among the set
 * files. So if the nightly stops for a fortnight and this runs anyway, it does
 * not mint a new week out of old figures: it finds the old week's file already
 * holds them and writes nothing. That is also what makes the script a pure
 * function of the card files: same inputs, same bytes, whatever day it is.
 *
 * IDEMPOTENT WITHIN A WEEK. A second run in the same week overwrites the file
 * only when the reads are NEWER: no set's read date may be older than the one
 * on disk and at least one must be newer (or a set must be new). A run on equal
 * or older data says so and leaves the file alone, so a hand run on a stale
 * checkout cannot put Tuesday's figures back over Sunday's.
 *
 * THE ENCODING, measured on the first file (31 sets, 5,3xx priced cards): a row
 * is [number, raw, grade9, psa10] under its set, with money as INTEGER CENTS and
 * null for a figure the card file does not carry. Cents because 0.1 + 0.2 is
 * not 0.3 and a trend is a subtraction; per-set arrays because repeating the
 * set id on every row was a quarter of the file. The header carries each set's
 * own read date: `pricesChecked` is per set, and a trend between two points has
 * to know how far apart they really are.
 *
 * WHAT IS NOT HERE: the printing. A card file carries one price per collector
 * number, the dearest printing's, and names it in `variant`. If the dearest
 * printing changes between two weeks the row's figure jumps for a reason that
 * is not the market. `variant` is therefore kept as an optional fifth element
 * ONLY where it is not a standard printing, so a later reader can refuse to
 * compare across a change instead of charting it.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARDS = join(ROOT, "public/data/cards");
const OUT_DIR = join(ROOT, "data/price-history");
const CHECK = process.argv.includes("--check");
const FORCE = process.argv.includes("--force");

const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** "2026-11-10" -> "2026-W46". Date-only arithmetic in UTC, so no timezone can move it. */
export function isoWeek(day) {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  // ISO 8601: the week belongs to the year its Thursday falls in.
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const cents = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null);
const STANDARD = new Set(["", "base", "normal", "unlimited", "holo"]);

/** Build the snapshot document out of the card files on disk. */
async function build() {
  const sets = {};
  const counts = { sets: 0, cards: 0, raw: 0, grade9: 0, psa10: 0 };
  const undated = [];
  for (const f of (await readdir(CARDS)).filter((x) => x.endsWith(".json")).sort()) {
    const doc = JSON.parse(await readFile(join(CARDS, f), "utf8"));
    if (!doc?.set || !Array.isArray(doc.cards)) continue;
    // A set whose money has no read date cannot be placed in a week, and a
    // figure with no date is the one thing a trend must never be drawn from.
    if (!isDay(doc.pricesChecked)) {
      undated.push(doc.set);
      continue;
    }
    const rows = [];
    for (const c of doc.cards) {
      if (c?.n == null) continue;
      const raw = cents(c.price);
      const g9 = cents(c.g9);
      const psa10 = cents(c.psa10);
      if (raw == null && g9 == null && psa10 == null) continue;
      const row = [String(c.n), raw, g9, psa10];
      const v = String(c.variant || "").trim();
      if (!STANDARD.has(v.toLowerCase())) row.push(v);
      rows.push(row);
      counts.cards += 1;
      if (raw != null) counts.raw += 1;
      if (g9 != null) counts.grade9 += 1;
      if (psa10 != null) counts.psa10 += 1;
    }
    if (!rows.length) continue;
    sets[doc.set] = { read: doc.pricesChecked, cards: rows };
    counts.sets += 1;
  }
  const reads = Object.values(sets).map((s) => s.read).sort();
  if (!reads.length) throw new Error("no set file under public/data/cards/ carries a dated price, so there is nothing to snapshot");
  const newestRead = reads[reads.length - 1];
  return {
    doc: {
      _readme: [
        "One week of card prices, written by scripts/snapshot-prices.mjs from",
        "public/data/cards/*.json. Kept so a trend can be drawn later. No page",
        "reads this yet. Format and rules: docs/nightly-and-deploy.md.",
        "",
        "`week` is the ISO week the NEWEST price read falls in, not the week the",
        "script ran. Each set carries its own `read` date (its `pricesChecked`).",
        "A row is [number, raw, grade9, psa10] in US CENTS, null where the card",
        "file holds no figure. A fifth element names the printing the figures",
        "are for when it is not a standard one. Source: pricecharting.com.",
      ],
      week: isoWeek(newestRead),
      unit: "US cents",
      columns: ["number", "raw", "grade9", "psa10", "printing (only when not standard)"],
      source: "pricecharting.com, as carried by public/data/cards/",
      newestRead,
      oldestRead: reads[0],
      counts,
      sets,
    },
    undated,
  };
}

/** One set per line: small, and a week-to-week git diff stays readable. */
function serialize(doc) {
  const { sets, ...head } = doc;
  const lines = Object.keys(sets)
    .sort()
    .map((id) => `    ${JSON.stringify(id)}: ${JSON.stringify(sets[id])}`);
  const headJson = JSON.stringify(head, null, 2).replace(/\n\}$/, "");
  return `${headJson},\n  "sets": {\n${lines.join(",\n")}\n  }\n}\n`;
}

/** Is `next` a newer reading than `prev`? No set older, and something newer or new. */
function newerThan(next, prev) {
  let newer = false;
  for (const [id, s] of Object.entries(next.sets)) {
    const was = prev.sets?.[id]?.read;
    if (!was) { newer = true; continue; }
    if (s.read < was) return { ok: false, why: `${id} was read ${s.read} here and ${was} in the file on disk` };
    if (s.read > was) newer = true;
  }
  return newer ? { ok: true } : { ok: false, why: "every set's read date matches the file on disk" };
}

async function check() {
  if (!existsSync(OUT_DIR)) {
    console.log("data/price-history/ does not exist yet: nothing to check");
    return 0;
  }
  const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith(".json")).sort();
  const bad = [];
  let prev = null;
  for (const f of files) {
    const where = `data/price-history/${f}`;
    let doc;
    try {
      doc = JSON.parse(await readFile(join(OUT_DIR, f), "utf8"));
    } catch (e) {
      bad.push(`${where} does not parse: ${e.message}`);
      continue;
    }
    if (!/^\d{4}-W\d{2}\.json$/.test(f)) bad.push(`${where}: the name is not <year>-W<week>.json`);
    if (`${doc.week}.json` !== f) bad.push(`${where}: says week ${doc.week}`);
    if (!isDay(doc.newestRead) || !isDay(doc.oldestRead)) bad.push(`${where}: newestRead or oldestRead is not a date`);
    else {
      if (isoWeek(doc.newestRead) !== doc.week) bad.push(`${where}: newestRead ${doc.newestRead} is in ${isoWeek(doc.newestRead)}, not ${doc.week}`);
      if (doc.oldestRead > doc.newestRead) bad.push(`${where}: oldestRead is after newestRead`);
      // MONOTONIC IN DATE. File names sort by week, so each file's newest read
      // must be later than the one before it, or two weeks hold the same reading.
      if (prev && !(doc.newestRead > prev.newestRead)) bad.push(`${where}: newestRead ${doc.newestRead} is not after ${prev.f}'s ${prev.newestRead}`);
    }
    let cards = 0;
    for (const [id, s] of Object.entries(doc.sets || {})) {
      if (!isDay(s.read)) bad.push(`${where}: set ${id} has no read date`);
      else if (isDay(doc.newestRead) && (s.read > doc.newestRead || s.read < doc.oldestRead)) bad.push(`${where}: set ${id} read ${s.read} is outside ${doc.oldestRead} to ${doc.newestRead}`);
      for (const r of s.cards || []) {
        cards += 1;
        const money = r.slice(1, 4);
        const okRow = Array.isArray(r) && (r.length === 4 || r.length === 5) && typeof r[0] === "string" &&
          money.every((v) => v === null || (Number.isInteger(v) && v > 0)) && money.some((v) => v !== null) &&
          (r.length === 4 || typeof r[4] === "string");
        if (!okRow) { bad.push(`${where}: set ${id} holds a malformed row ${JSON.stringify(r)}`); break; }
      }
    }
    if (cards !== doc.counts?.cards) bad.push(`${where}: counts.cards says ${doc.counts?.cards} and the file holds ${cards}`);
    if (isDay(doc.newestRead)) prev = { f, newestRead: doc.newestRead };
  }
  if (bad.length) {
    console.error(`price history: ${bad.length} problem(s)`);
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(`price history: ${files.length} week file(s) parse, are named for the week they hold, and are in date order` +
    (files.length ? ` (${files[0].replace(".json", "")} to ${files[files.length - 1].replace(".json", "")})` : ""));
  return 0;
}

async function main() {
  if (CHECK) return check();
  const { doc, undated } = await build();
  if (undated.length) console.log(`  skipped, no pricesChecked: ${undated.join(", ")}`);
  const file = join(OUT_DIR, `${doc.week}.json`);
  const rel = `data/price-history/${doc.week}.json`;
  const text = serialize(doc);
  // The serializer is hand rolled for the line layout, so prove it round-trips.
  if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(doc)) throw new Error("the snapshot did not serialize to what was built");
  if (existsSync(file) && !FORCE) {
    const prevText = await readFile(file, "utf8");
    if (prevText === text) {
      console.log(`${rel} already holds exactly this reading (${doc.newestRead}). Nothing written.`);
      return 0;
    }
    const verdict = newerThan(doc, JSON.parse(prevText));
    if (!verdict.ok) {
      console.log(`${rel} kept as it is: ${verdict.why}.`);
      return 0;
    }
  }
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(file, text);
  const c = doc.counts;
  console.log(`Wrote ${rel}: ${c.cards} cards in ${c.sets} sets (raw ${c.raw}, Grade 9 ${c.grade9}, PSA 10 ${c.psa10}), ` +
    `read ${doc.oldestRead === doc.newestRead ? doc.newestRead : `${doc.oldestRead} to ${doc.newestRead}`}, ${Buffer.byteLength(text)} bytes`);
  return 0;
}

// Importable for isoWeek() without running anything.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((code) => process.exit(code), (e) => { console.error(e.message || e); process.exit(1); });
}
