#!/usr/bin/env node
/**
 * The judgment a person used to supply when the weekly price syncs were run by
 * hand, written down so a schedule can supply it. NO NETWORK. Run by
 * scripts/weekly-run.sh, which .github/workflows/weekly-prices.yml calls.
 *
 *   node scripts/weekly-check.mjs graded                    is the new data/graded.json a full read?
 *   node scripts/weekly-check.mjs redate data/top-raw.json  date a ranked list by its real listing reads
 *   node scripts/weekly-check.mjs ranked data/top-raw.json  may a verified ranked list be published?
 *   node scripts/weekly-check.mjs first-partner             keep the art, take the new prices
 *
 * Every subcommand exits 0 for "keep the new file" and 1 for "put the old one
 * back", and scripts/nightly-step.sh does the putting back. Nothing here edits a
 * figure. What each one guards, and why a schedule needs it:
 *
 * graded. sync-pricecharting.mjs writes whatever it found and exits 0, including
 * NOTHING: on a night PriceCharting refuses every search it would write an empty
 * file under today's date and the Hall of Fame would lose every promo price. A
 * person sees "0 priced" scroll past. This refuses a file that lost more than a
 * tenth of its rows, its PSA 10 figures or its full grade tables against HEAD.
 *
 * redate. The three ranked syncs stamp `checked` with the day they RAN, which
 * was true while a person ran sync-graded-top.mjs --refresh and read every page
 * that day. The weekly job builds from the nightly's page cache instead (the
 * owner's limit: no extra crawl), and that cache is a month deep by design.
 * Measured 11 November 2026 off data/price-rotation.json: of the rows these
 * lists publish, the listing behind 2 of 120 (graded), 5 of 160 (raw) and 0 of
 * 179 (Topps) had been read in the last 7 days; most were over 3 weeks old. A
 * page saying "read November 15" over those would credit a reading that never
 * happened, which is the one thing every price file on this site refuses to
 * do. So `checked` is set to the OLDEST listing read behind the rows the page
 * can print, out of the nightly's own per-console bookmarks, and the spread is
 * recorded in `listingReads`. It runs BEFORE the verifier, which stamps its
 * `for` against `checked`. The verifier's own `ran` date is the day every
 * published row was re-read from its product page, and that one is today.
 *
 * ranked. shared/graded-gate.mjs stops the BUILD on a disagreeing row with no
 * recorded reason, and a person used to write that reason. Seven were written
 * on 13 October 2026 and all seven were the same finding: the product page's
 * own "dollar change from last update", subtracted from its figure, gave the
 * listing figure to the cent. That is mechanical, so it is done here, plus one
 * more class a weekly run creates: the listing was read on an EARLIER day than
 * the product page (the bookmarks say which day) and the value moved between
 * them. Either way the row is recorded in `excluded` and is printed nowhere,
 * exactly as before; an exclusion never publishes anything.
 *
 * WHAT STILL REFUSES THE WHOLE FILE, because it is what the gate is really for,
 * a parse that broke everywhere: a disagreeing row neither class explains; more
 * than a fifth of the rows disagreeing; fewer than three quarters agreeing; a
 * corpus that shrank (a thin cache would rank a partial catalogue and every
 * surviving row would still "agree"); or gradedGate() itself throwing.
 *
 * first-partner. sync-first-partner.mjs also mirrors 30 images from pokemon.com
 * and re-encodes them. The weekly job runs it with that host blocked (see
 * scripts/weekly-net-guard.mjs), so the file it writes has the new prices and
 * no pictures. This puts HEAD's file back with ONLY `checked` and each card's
 * `pc` block taken from the new one.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gradedGate } from "../shared/graded-gate.mjs";
import { columnChange } from "../shared/pricecharting.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [cmd, arg] = process.argv.slice(2);

const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const readJson = async (rel) => JSON.parse(await readFile(join(ROOT, rel), "utf8"));
/** The last committed copy of a file, or null when HEAD has none. */
function headJson(rel) {
  try {
    return JSON.parse(execFileSync("git", ["show", `HEAD:${rel}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }));
  } catch {
    return null;
  }
}
function refuse(lines) {
  for (const l of [].concat(lines)) console.error(`weekly-check: ${l}`);
  process.exit(1);
}

/* What is particular to each ranked file. `rows` is the slice of `cards` the
   verifier re-reads and a page can therefore print; `column` says which figure
   a disagreeing row disagreed on, as [key, the product page's <th> label]. */
const HEADER = { ungraded: "Ungraded", psa10: "PSA 10", g9: "Grade 9" };
const RANKED = {
  "data/top-graded.json": {
    verifier: "scripts/verify-graded-top.mjs",
    // verify-graded-top.mjs reads the first 120 unless it is given --all.
    rows: (d) => d.cards.slice(0, 120),
    column: () => "psa10",
  },
  "data/top-raw.json": {
    verifier: "scripts/verify-raw-top.mjs",
    rows: (d) => d.cards,
    column: () => "ungraded",
  },
  "data/topps-top.json": {
    verifier: "scripts/verify-topps-top.mjs",
    rows: (d) => d.cards,
    column: (r) => r.statusCol || "ungraded",
  },
};

/** The day the nightly last read the console listing a row's figure came from. */
async function listingReader() {
  const rot = (await readJson("data/price-rotation.json")).refreshed || {};
  const byPath = new Map(Object.entries(rot).map(([k, v]) => [decodeURIComponent(k).toLowerCase(), v]));
  return (url) => {
    const m = /\/game\/([^/]+)\//.exec(String(url || ""));
    if (!m) return null;
    let slug = m[1];
    try { slug = decodeURIComponent(slug); } catch { /* keep it as written */ }
    const day = byPath.get(`/console/${slug.toLowerCase()}`);
    return isDay(day) && day > "2000-01-01" ? day : null;
  };
}

async function redate(rel) {
  const cfg = RANKED[rel];
  if (!cfg) refuse(`redate: ${rel} is not one of ${Object.keys(RANKED).join(", ")}`);
  const d = await readJson(rel);
  const readOf = await listingReader();
  const rows = cfg.rows(d);
  const days = [];
  const undated = [];
  for (const c of rows) {
    const day = readOf(c.url);
    if (day) days.push(day);
    else undated.push(`#${c.rank} ${c.name} (${c.url})`);
  }
  // A row whose listing cannot be dated cannot be published under ANY date.
  if (undated.length) {
    refuse([
      `${rel}: data/price-rotation.json holds no read date for the console behind ${undated.length} row(s), so the list cannot be dated:`,
      ...undated.slice(0, 8).map((u) => `  ${u}`),
    ]);
  }
  if (!days.length) refuse(`${rel}: no rows to date`);
  days.sort();
  const stamped = d.checked;
  const byDay = {};
  for (const x of days) byDay[x] = (byDay[x] || 0) + 1;
  d.checked = days[0];
  d.listingReads = {
    note: "When the nightly last read the console listing behind each row a page can print, from data/price-rotation.json. `checked` is the oldest of them. Written by scripts/weekly-check.mjs.",
    oldest: days[0],
    newest: days[days.length - 1],
    rows: days.length,
    byDay,
  };
  // The verification belongs to the stamp it was made against; a redated file
  // has none until the verifier runs again.
  delete d.verify;
  delete d.excluded;
  await writeFile(join(ROOT, rel), JSON.stringify(d, null, 2) + "\n");
  console.log(`${rel}: the sync stamped ${stamped}; the ${days.length} listing reads behind it run ${days[0]} to ${days[days.length - 1]}. checked is now ${days[0]}.`);
}

async function ranked(rel) {
  const cfg = RANKED[rel];
  if (!cfg) refuse(`ranked: ${rel} is not one of ${Object.keys(RANKED).join(", ")}`);
  const d = await readJson(rel);
  const head = headJson(rel);
  const v = d.verify;
  if (!v || !Array.isArray(v.rows) || !v.rows.length) refuse(`${rel}: no verify block, so nothing in it has been read twice`);
  if (v.for !== d.checked) refuse(`${rel}: verified for ${v.for} but the data says ${d.checked}`);

  // THE CORPUS. A ranking taken from part of the catalogue is a wrong ranking
  // whose every row still verifies.
  const was = head?.scanned?.products;
  const now = d.scanned?.products;
  if (typeof was === "number" && !(typeof now === "number" && now >= was * 0.97)) {
    refuse(`${rel}: ranked out of ${now} products where the last committed list had ${was}. The page cache is thin, so this ranking is not the whole catalogue.`);
  }

  const total = v.rows.length;
  const disagreeing = v.rows.filter((r) => r.status === "disagree");
  const agreeing = v.rows.filter((r) => r.status === "agree");
  if (agreeing.length < total * 0.75) {
    refuse(`${rel}: only ${agreeing.length} of ${total} rows agree between the listing and the product page. That is a parse or a block, not a market. Nothing is published.`);
  }
  if (disagreeing.length > total * 0.2) {
    refuse(`${rel}: ${disagreeing.length} of ${total} rows disagree, more than a fifth. Too many to call one card at a time. Nothing is published.`);
  }

  const readOf = await listingReader();
  const cardByRank = new Map(d.cards.map((c) => [c.rank, c]));
  const excluded = [];
  const unexplained = [];
  for (const r of disagreeing) {
    const card = cardByRank.get(r.rank);
    const key = cfg.column(r);
    const label = HEADER[key] || key;
    const where = `#${r.rank} ${r.name} (${r.set}) ${label}: listing ${r.listing}, product ${r.product}`;
    const base = { rank: r.rank, name: r.name, set: r.set, listing: r.listing, product: r.product, decided: v.ran, column: label, auto: true };
    if (!card || typeof r.listing !== "number" || typeof r.product !== "number") {
      unexplained.push(`${where} (one side holds no figure)`);
      continue;
    }
    // Class 1: PriceCharting's own change figure walks the product reading back
    // to the listing reading, to the cent. Read from the page the verifier
    // just fetched and cached.
    let change = null;
    const page = join(ROOT, ".cache/pricecharting-product", createHash("sha1").update(card.url).digest("hex") + ".html");
    if (existsSync(page)) {
      try { change = columnChange(await readFile(page, "utf8"), label); } catch { change = null; }
    }
    if (typeof change === "number" && Number((r.product - change).toFixed(2)) === r.listing) {
      excluded.push({
        ...base,
        kind: "reconciles",
        public: "its guide value moved between the two reads, so there are two correct readings of it and no basis for picking one",
        why: `Recorded by scripts/weekly-check.mjs, not by a person. The product page carries its own dollar change from last update of ${change} on the ${label} cell, and ${r.product} minus that change is ${r.listing} exactly, which is the figure the listing read recorded. Same finding as the seven hand-written entries of 13 October 2026: the market moved between the reads, the columns were read correctly, and there is no basis for calling either figure the value.`,
      });
      continue;
    }
    // Class 2: the two reads were taken on different days, by the nightly's own
    // record, and the value is more than the tolerance apart.
    const listed = readOf(card.url);
    if (listed && isDay(v.ran) && listed < v.ran) {
      excluded.push({
        ...base,
        kind: "stale-listing",
        listingRead: listed,
        public: "its guide value moved between our two reads, which were taken on different days, so there is no single figure to print",
        why: `Recorded by scripts/weekly-check.mjs, not by a person. The listing page behind this row was last read on ${listed} (data/price-rotation.json) and its product page on ${v.ran}, and the two ${label} figures are more than ${Math.round((v.tolerance ?? 0.15) * 100)}% apart. ${agreeing.length} of ${total} rows in the same run agree, so the columns are being read correctly; this card's value moved between the reads. Neither figure is published.`,
      });
      continue;
    }
    unexplained.push(where);
  }
  if (unexplained.length) {
    refuse([
      `${rel}: ${unexplained.length} disagreeing row(s) that neither PriceCharting's own change figure nor an older listing read explains:`,
      ...unexplained.map((u) => `  ${u}`),
      "A person has to look at these. Nothing from this file is published this week.",
    ]);
  }

  if (excluded.length) d.excluded = excluded;
  else delete d.excluded;
  // The same gate the page builders call. If it throws here the build would
  // have thrown, so the file goes back instead.
  try {
    gradedGate(d, rel, cfg.verifier);
  } catch (e) {
    refuse([`${rel}: shared/graded-gate.mjs refuses it:`, ...String(e.message).split("\n").map((l) => `  ${l}`)]);
  }
  await writeFile(join(ROOT, rel), JSON.stringify(d, null, 2) + "\n");
  console.log(
    `${rel}: publishable. ${agreeing.length} of ${total} rows agree` +
      (excluded.length
        ? `; ${excluded.length} excluded with a recorded reason (${excluded.filter((e) => e.kind === "reconciles").length} reconcile to the cent, ${excluded.filter((e) => e.kind === "stale-listing").length} had an older listing read)`
        : "; none excluded") +
      `. Listing reads ${d.listingReads ? `${d.listingReads.oldest} to ${d.listingReads.newest}` : d.checked}, product pages read ${v.ran}.`,
  );
  for (const e of excluded) console.log(`  excluded #${e.rank} ${e.name} (${e.set}) ${e.column}: listing ${e.listing}, product ${e.product} [${e.kind}]`);
}

async function graded() {
  const rel = "data/graded.json";
  const d = await readJson(rel);
  const head = headJson(rel);
  const tally = (doc) => {
    const rows = Object.values(doc?.cards || {});
    return {
      rows: rows.length,
      psa10: rows.filter((r) => typeof r.psa10 === "number").length,
      full: rows.filter((r) => r.partial === false).length,
    };
  };
  const now = tally(d);
  const was = tally(head);
  if (!isDay(d.checked)) refuse(`${rel}: no read date`);
  if (!now.rows) refuse(`${rel}: the sync priced nothing`);
  const lost = Object.keys(was).filter((k) => was[k] > 0 && now[k] < was[k] * 0.9);
  if (lost.length) {
    refuse(`${rel}: the new read is thinner than the last committed one (${lost.map((k) => `${k} ${was[k]} -> ${now[k]}`).join(", ")}). PriceCharting refused part of the run, so last week's file stands.`);
  }
  console.log(`${rel}: ${now.rows} cards priced (${was.rows} last time), ${now.psa10} with a PSA 10, ${now.full} with the full grade table, read ${d.checked}.`);
}

async function firstPartner() {
  const rel = "data/first-partner.json";
  const fresh = await readJson(rel);
  const head = headJson(rel);
  if (!head) refuse(`${rel}: HEAD holds no copy to keep the art from`);
  if (!isDay(fresh.checked)) refuse(`${rel}: no read date`);
  const byNumber = new Map((fresh.cards || []).map((c) => [c.number, c]));
  const agreeing = (cards) => cards.filter((c) => c.pc?.cols?.raw?.status === "agree").length;
  const out = { ...head, checked: fresh.checked, cards: [] };
  for (const c of head.cards || []) {
    const n = byNumber.get(c.number);
    if (!n || n.name !== c.name) refuse(`${rel}: the new read has no card ${c.number} ${c.name}`);
    // Identity, artwork and dimensions stay exactly as committed. Only the
    // price block moves, and a card the new read could not match keeps none,
    // which is what the script itself would have written.
    out.cards.push({ ...c, pc: n.pc ?? null });
  }
  if ((fresh.cards || []).length !== out.cards.length) refuse(`${rel}: ${fresh.cards.length} cards read, ${out.cards.length} committed`);
  // A read where far fewer raw figures agree is a refused crawl, not a market.
  if (agreeing(out.cards) < agreeing(head.cards || []) * 0.75) {
    refuse(`${rel}: raw agrees on ${agreeing(out.cards)} cards where the committed file has ${agreeing(head.cards)}. Last week's file stands.`);
  }
  // Same serialization the sync uses (one space), so a week with no price move
  // changes one line.
  await writeFile(join(ROOT, rel), JSON.stringify(out, null, 1) + "\n");
  console.log(`${rel}: prices read ${fresh.checked}, raw agrees on ${agreeing(out.cards)} of ${out.cards.length}; artwork and packaging kept from the committed file.`);
}

const run = { graded, redate: () => redate(arg), ranked: () => ranked(arg), "first-partner": firstPartner }[cmd];
if (!run) {
  console.error("usage: weekly-check.mjs graded | redate <file> | ranked <file> | first-partner");
  process.exit(64);
}
run().catch((e) => refuse(e.stack || String(e)));
