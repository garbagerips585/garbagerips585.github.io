#!/usr/bin/env node
// What the channel's public numbers actually say.
//
//   node scripts/analyse-channel.mjs           use the cached stats
//   node scripts/analyse-channel.mjs --fetch   refresh likes and comments first
//
// WHAT THIS CAN AND CANNOT SEE, because the difference matters more than any
// number below. YT_API_KEY reaches the YouTube DATA API, which serves the same
// public figures any viewer can read: views, likes, comment counts. It does NOT
// reach the YouTube ANALYTICS API, which answers 401 to an API key outright and
// wants an OAuth token proving channel ownership. So there is no watch time
// here, no average view duration, no retention curve, no impressions, no
// click-through rate, no traffic sources and no subscriber numbers. Those are
// the figures that actually explain why a video did well, and they are all in
// YouTube Studio rather than here. Nothing in this report should be described
// as "analytics" to anybody, because it is not.
//
// MEDIANS, NOT AVERAGES, EVERYWHERE. View counts are heavily skewed: one video
// that caught the algorithm drags a mean so far off that it stops describing
// anything. The median says what a typical video in the group did.
//
// AGE IS THE CONFOUND THAT RUINS THIS KIND OF COMPARISON. Views accumulate, so
// an older video has had longer to gather them, and any category that happens
// to hold older videos looks better for no reason at all. Every group below
// therefore prints its median AGE next to its median views, so a comparison
// with a big age gap can be discounted on sight. Where a group is younger than
// the channel overall it is flagged outright.
//
// LIKE RATE IS THE MORE HONEST SIGNAL. Likes per thousand views is close to
// age-independent: both halves of the ratio grow together. It measures whether
// the people who watched liked it, which is a different and better question
// than how many arrived.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CARD_SETS } from "../shared/taxonomy.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "yt-stats.json");
const FETCH = process.argv.includes("--fetch");

const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
// Same two-source lookup as stamp-labels.mjs: sets.json is English only, so a
// foreign set printed as the raw id "ja-abyss-eye" in the report. The taxonomy
// has a real name for every one of them.
const setName = new Map(CARD_SETS.map((s) => [s.id, s.label]));
for (const s of sets) setName.set(s.id, s.name);

let stats = {};
try {
  stats = JSON.parse(await readFile(CACHE, "utf8"));
} catch {
  /* no cache yet */
}

if (FETCH || !Object.keys(stats).length) {
  const KEY = process.env.YT_API_KEY;
  if (!KEY) {
    console.error("YT_API_KEY is not set. Run:  set -a; . ./.env; set +a");
    process.exit(1);
  }
  const ids = videos.map((v) => v.id);
  // 50 per request is the API's cap, so 311 videos is 7 calls rather than 311.
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.join(",")}&key=${KEY}`,
    );
    if (!r.ok) {
      console.error(`videos.list -> ${r.status}`);
      process.exit(1);
    }
    const j = await r.json();
    for (const it of j.items || []) {
      stats[it.id] = {
        views: Number(it.statistics.viewCount || 0),
        likes: Number(it.statistics.likeCount || 0),
        comments: Number(it.statistics.commentCount || 0),
      };
    }
  }
  await mkdir(dirname(CACHE), { recursive: true });
  await writeFile(CACHE, JSON.stringify({ ...stats, _checked: new Date().toISOString().slice(0, 10) }, null, 2));
  console.log(`Fetched statistics for ${Object.keys(stats).length - 1} videos\n`);
}

const TODAY = new Date("2026-08-13T00:00:00Z");
const ageDays = (d) => Math.max(1, Math.round((TODAY - new Date(d + "T00:00:00Z")) / 86400000));

const rows = videos
  .filter((v) => stats[v.id])
  .map((v) => ({
    ...v,
    views: stats[v.id].views,
    likes: stats[v.id].likes,
    comments: stats[v.id].comments,
    age: ageDays(v.published),
    likeRate: stats[v.id].views ? (stats[v.id].likes / stats[v.id].views) * 1000 : 0,
  }));

const med = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const n = (x) => Math.round(x).toLocaleString("en-US");
const pad = (s, w) => String(s).padEnd(w);

const ALL_MED_AGE = med(rows.map((r) => r.age));

console.log(`GARBAGE RIPS 585, public figures only, read ${stats._checked || "from cache"}`);
console.log(`${rows.length} videos, published ${rows.at(-1)?.published} to ${rows[0]?.published}\n`);

console.log("OVERALL");
console.log(`  total views        ${n(rows.reduce((s, r) => s + r.views, 0))}`);
console.log(`  median views       ${n(med(rows.map((r) => r.views)))}`);
console.log(`  mean views         ${n(rows.reduce((s, r) => s + r.views, 0) / rows.length)}   <- skewed, see the header`);
console.log(`  best               ${n(Math.max(...rows.map((r) => r.views)))}`);
console.log(`  worst              ${n(Math.min(...rows.map((r) => r.views)))}`);
console.log(`  median like rate   ${med(rows.map((r) => r.likeRate)).toFixed(1)} per 1,000 views`);
console.log(`  total likes        ${n(rows.reduce((s, r) => s + r.likes, 0))}`);
console.log(`  total comments     ${n(rows.reduce((s, r) => s + r.comments, 0))}\n`);

/** Group, sort by median views, and show the age confound next to it. */
function group(title, keyOf, minN = 4) {
  const g = new Map();
  for (const r of rows) {
    for (const k of [].concat(keyOf(r) ?? [])) {
      if (k === null || k === undefined) continue;
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(r);
    }
  }
  const out = [...g]
    .filter(([, v]) => v.length >= minN)
    .map(([k, v]) => ({
      k,
      n: v.length,
      views: med(v.map((x) => x.views)),
      age: med(v.map((x) => x.age)),
      like: med(v.map((x) => x.likeRate)),
    }))
    .sort((a, b) => b.views - a.views);
  if (!out.length) return;
  console.log(title);
  console.log(`  ${pad("", 30)} ${pad("n", 5)} ${pad("med views", 11)} ${pad("med age", 9)} like/1k`);
  for (const o of out) {
    const young = o.age < ALL_MED_AGE * 0.5 ? "  (young, discount this)" : "";
    console.log(
      `  ${pad(String(o.k).slice(0, 29), 30)} ${pad(o.n, 5)} ${pad(n(o.views), 11)} ${pad(o.age + "d", 9)} ${o.like.toFixed(1)}${young}`,
    );
  }
  console.log("");
}

group("BY SET", (r) => (r.sets || []).map((s) => setName.get(s) || s));
group("BY PRODUCT OPENED", (r) => r.products || []);
group("BY PULL TAG (what the title claims came out)", (r) => r.pulls || []);
group("BY FORMAT", (r) => (r.short ? "Short (60s or under)" : "Long form"), 1);
group(
  "BY DAY POSTED",
  (r) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(r.published + "T00:00:00Z").getUTCDay()],
);
group(
  "BY LENGTH",
  (r) => (r.duration <= 15 ? "0-15s" : r.duration <= 30 ? "16-30s" : r.duration <= 60 ? "31-60s" : "over 60s"),
);

// Title shape. Not a claim about causation: these are the channel's own habits,
// and a pattern it only used in one month carries that month's luck with it.
group(
  "BY TITLE SHAPE",
  (r) => {
    const t = r.title || "";
    const out = [];
    if (/\?/.test(t)) out.push("has a question mark");
    if (/[😀-🿿🀀-🯿]/u.test(t)) out.push("has an emoji");
    if (/\|/.test(t)) out.push("has a pipe divider");
    if (/\b(?:[A-Z]{3,})\b/.test(t.replace(/ETB|UPC|SPC|SIR|OG|PSA/g, ""))) out.push("has a SHOUTED word");
    if (/#\d/.test(t)) out.push("has a pack number");
    return out.length ? out : "plain title";
  },
);

console.log("TOP 10 BY VIEWS");
for (const r of [...rows].sort((a, b) => b.views - a.views).slice(0, 10)) {
  console.log(`  ${pad(n(r.views), 8)} ${pad(r.age + "d", 7)} ${(r.label || r.title).slice(0, 52)}`);
}

console.log("\nBEST LIKE RATE, 200+ views (what people who watched thought)");
for (const r of rows.filter((x) => x.views >= 200).sort((a, b) => b.likeRate - a.likeRate).slice(0, 10)) {
  console.log(`  ${pad(r.likeRate.toFixed(1), 6)} ${pad(n(r.views), 8)} ${(r.label || r.title).slice(0, 50)}`);
}

console.log("\nUPLOADS PER MONTH");
const byMonth = new Map();
for (const r of rows) {
  const m = r.published.slice(0, 7);
  if (!byMonth.has(m)) byMonth.set(m, []);
  byMonth.get(m).push(r);
}
for (const [m, v] of [...byMonth].sort()) {
  const bar = "#".repeat(Math.min(40, v.length));
  console.log(`  ${m}  ${pad(v.length, 4)} ${pad(bar, 41)} med ${n(med(v.map((x) => x.views)))}`);
}
