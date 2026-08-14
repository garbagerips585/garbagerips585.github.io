#!/usr/bin/env node
// Build public/luck.html: what 300+ rips actually produced.
//
//   node scripts/build-luck.mjs
//
// This is the one page on the site nobody else can write. Every other Pokemon
// site quotes the same official rarity distributions; this one reports what
// came out of packs that were actually opened on camera, which is a different
// and more interesting thing.
//
// HONESTY IS THE WHOLE VALUE HERE, so the rules are strict:
//
// 1. Only rips Tim has explicitly marked count toward a rate. The `pulls` tags
//    are derived from video titles, and titles are biased: one that says "NO
//    HITS" gets no pull tag and would silently read as an untested rip, while
//    one that says "SIR!!" does. Computing a rate over those would not measure
//    luck, it would measure how he writes titles. `hasHit` is a deliberate
//    yes/no from the spreadsheet, so that is the denominator.
//
// 2. Every rate carries its sample size, and rates below MIN_SAMPLE are shown
//    as "not enough yet" rather than as a number. Three rips of a set is an
//    anecdote and printing "33% hit rate" next to it would be a lie told with
//    real data.
//
// 3. These are OBSERVED rates from one person's openings, never presented as
//    official pull rates. The Pokemon Company does not publish those and we do
//    not have them. The page says so in its own words, not in fine print.
//
// The page therefore starts mostly empty and fills in as the log is tagged.
// That is correct behaviour, not a bug: it shows what is known and says how
// much is still unknown.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, FONTS, footer, APP_JS } from "../shared/chrome.mjs";
import { esc, shortDate } from "../shared/format.mjs";
import { labelFor } from "../shared/taxonomy.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Below this many tagged rips, a rate is noise and is not shown as a number. */
const MIN_SAMPLE = 12;

// LUCK_DATA points the build at a different videos.json. Used to preview how
// this page will look once the rip log is tagged, without writing test values
// over the real catalogue.
const DATA = process.env.LUCK_DATA || join(ROOT, "public/data/videos.json");
const OUT = process.env.LUCK_OUT || join(ROOT, "public/luck.html");
const { videos } = JSON.parse(await readFile(DATA, "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const setName = Object.fromEntries(sets.map((s) => [s.id, s.name]));

// A rip counts toward a rate only once its outcome is known either way.
const judged = videos.filter((v) => typeof v.hasHit === "boolean");
const hits = judged.filter((v) => v.hasHit);
const coverage = videos.length ? judged.length / videos.length : 0;

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const packsIn = (v) => (Number.isFinite(v.packs) && v.packs > 0 ? v.packs : null);

/** Group the judged rips by a key, and rate each group. */
function rateBy(keyFn, labelFn) {
  const g = new Map();
  for (const v of judged) {
    for (const k of keyFn(v)) {
      if (!g.has(k)) g.set(k, { rips: 0, hits: 0, packs: 0, hitPacks: 0 });
      const e = g.get(k);
      e.rips++;
      if (v.hasHit) e.hits++;
      const p = packsIn(v);
      if (p) {
        e.packs += p;
        if (v.hasHit) e.hitPacks += p;
      }
    }
  }
  return [...g.entries()]
    .map(([k, e]) => ({ key: k, label: labelFn(k), ...e, rate: pct(e.hits, e.rips) }))
    .filter((r) => r.rips > 0)
    .sort((a, b) => (b.rips >= MIN_SAMPLE) - (a.rips >= MIN_SAMPLE) || b.rate - a.rate || b.rips - a.rips);
}

const bySet = rateBy((v) => v.sets || [], (k) => setName[k] || labelFor("sets", k) || k);
const byProduct = rateBy((v) => v.products || [], (k) => labelFor("products", k) || k);

// What actually came out, from the rarity Tim recorded. Falls back to the
// derived pull tags only for the count of each kind, never for a rate.
const rarityCount = new Map();
for (const v of videos) {
  if (v.hitRarity) rarityCount.set(v.hitRarity, (rarityCount.get(v.hitRarity) || 0) + 1);
}
const rarities = [...rarityCount.entries()].sort((a, b) => b[1] - a[1]);

const pullCount = new Map();
for (const v of videos) for (const p of v.pulls || []) pullCount.set(p, (pullCount.get(p) || 0) + 1);
const pulls = [...pullCount.entries()].sort((a, b) => b[1] - a[1]);

/**
 * The longest run of consecutive judged rips with no hit, in upload order.
 *
 * The most human number on the page: everyone who opens packs knows the
 * feeling of a cold streak, and this one is real rather than remembered.
 */
const chrono = [...judged].sort((a, b) => String(a.published).localeCompare(String(b.published)));
let worst = { len: 0, from: null, to: null };
let run = 0, runFrom = null;
for (const v of chrono) {
  if (!v.hasHit) {
    if (!run) runFrom = v;
    run++;
    if (run > worst.len) worst = { len: run, from: runFrom, to: v };
  } else run = 0;
}
let bestRun = { len: 0, from: null, to: null };
run = 0; runFrom = null;
for (const v of chrono) {
  if (v.hasHit) {
    if (!run) runFrom = v;
    run++;
    if (run > bestRun.len) bestRun = { len: run, from: runFrom, to: v };
  } else run = 0;
}

const totalPacks = judged.reduce((n, v) => n + (packsIn(v) || 0), 0);
const packsKnown = judged.filter(packsIn).length;

// ---------------------------------------------------------------------------

const row = (r, hrefBase) => {
  const enough = r.rips >= MIN_SAMPLE;
  return `        <tr${enough ? "" : ' class="thin"'}>
          <th scope="row">${
            hrefBase ? `<a href="${hrefBase}${esc(r.key)}">${esc(r.label)}</a>` : esc(r.label)
          }</th>
          <td class="num">${r.rips}</td>
          <td class="num">${r.hits}</td>
          <td class="rate">${
            enough
              ? `<span class="lbar" style="--w:${Math.max(2, r.rate)}%"><b>${r.rate}%</b></span>`
              : `<span class="thin-note">need ${MIN_SAMPLE - r.rips} more</span>`
          }</td>
        </tr>`;
};

const table = (rows, what, hrefBase) =>
  rows.length
    ? `    <div class="luck-scroll">
      <table class="luck-table">
        <caption class="sr-only">Hit rate by ${what}</caption>
        <thead><tr><th scope="col">${what}</th><th scope="col">Rips</th><th scope="col">Hits</th><th scope="col">Hit rate</th></tr></thead>
        <tbody>
${rows.map((r) => row(r, hrefBase)).join("\n")}
        </tbody>
      </table>
    </div>`
    : `    <p class="luck-empty">Nothing tagged yet. This fills in as the rip log gets marked up.</p>`;

const style = `
.luck{padding:var(--s7) 0 var(--s5)}
.luck-lede{font-size:var(--t-lede);color:var(--ink-2);max-width:42em;margin-bottom:var(--s5)}
.luck-head{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3);margin-bottom:var(--s5)}
@media(max-width:700px){.luck-head{grid-template-columns:repeat(2,1fr)}}
.luck-stat{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);box-shadow:var(--lift)}
.luck-stat b{display:block;font:400 var(--t-xl)/1 var(--display);color:var(--ink);margin-bottom:4px}
.luck-stat span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);
  letter-spacing:.06em;text-transform:uppercase}

/* How much of the log is actually tagged. Shown at the top rather than buried,
   because every number under it is only as good as this bar. */
.luck-cov{background:var(--lilac-pale);border:1px solid rgba(78,47,72,.2);border-radius:var(--r);
  padding:var(--s4);margin-bottom:var(--s6)}
.luck-cov p{font:700 var(--t-micro)/1.6 var(--mono);color:var(--plum);letter-spacing:.04em;
  text-transform:uppercase;margin-bottom:8px}
.luck-covbar{height:10px;border-radius:99px;background:rgba(78,47,72,.16);overflow:hidden}
.luck-covbar i{display:block;height:100%;background:var(--plum);border-radius:99px}

.luck-sec{padding:var(--s6) 0}
.luck-sec h2{font:400 var(--t-l)/1.15 var(--display);margin-bottom:var(--s2)}
.luck-note{color:var(--ink-2);max-width:44em;margin-bottom:var(--s4)}
.luck-scroll{overflow-x:auto;border:1px solid var(--hair);border-radius:var(--r);background:var(--card)}
.luck-table{border-collapse:collapse;width:100%;min-width:400px;font-size:var(--t-sm)}
.luck-table th,.luck-table td{text-align:left;padding:10px var(--s3);border-bottom:1px solid var(--hair)}
.luck-table tbody tr:last-child th,.luck-table tbody tr:last-child td{border-bottom:0}
.luck-table thead th{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink-2);background:var(--page)}
.luck-table tbody th{font-weight:600}
.luck-table tbody th a:hover{text-decoration:underline}
.luck-table .num{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink-2);width:1%}
.luck-table .rate{width:40%;min-width:120px}
.luck-table tr.thin{opacity:.62}
.thin-note{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);letter-spacing:.04em;text-transform:uppercase}
/* Number first, bar second. With the bar leading, the percentage was pushed
   past the right edge of a 375px viewport and the one value the row exists to
   communicate was the one you had to scroll sideways to see. */
.lbar{display:flex;align-items:center;gap:8px}
.lbar b{flex:none;min-width:3.4em;font:700 var(--t-sm)/1 var(--body);font-variant-numeric:tabular-nums}
.lbar::after{content:"";height:10px;width:var(--w);min-width:3px;max-width:100%;flex:0 1 auto;
  background:var(--mustard);border:1px solid var(--gold-deep);border-radius:99px}

.pull-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--s3)}
.pull{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s4);
  text-align:center;box-shadow:var(--lift)}
.pull b{display:block;font:400 var(--t-l)/1 var(--display);color:var(--ketchup-deep)}
.pull span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);letter-spacing:.05em;text-transform:uppercase}

.streaks{display:grid;grid-template-columns:1fr 1fr;gap:var(--s4)}
@media(max-width:640px){.streaks{grid-template-columns:1fr}}
.streak{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s5);box-shadow:var(--lift)}
.streak b{display:block;font:400 var(--t-xl)/1 var(--display);margin-bottom:4px}
.streak .k{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)}
.streak p{color:var(--ink-2);font-size:var(--t-sm);margin-top:8px}
.streak.cold b{color:var(--plum)}
.streak.hot b{color:var(--ketchup-deep)}

.luck-method{font:700 var(--t-micro)/1.7 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin:var(--s6) 0;max-width:56em}
.luck-empty{color:var(--ink-2);background:var(--card);border:1px dashed var(--hair);
  border-radius:var(--r);padding:var(--s5);text-align:center}
`;

const headline = judged.length
  ? `${pct(hits.length, judged.length)}%`
  : "-";

const body = `
<main id="main">
  <section class="luck">
    <div class="wrap">
      <div class="brk"><h1>Luck, <span class="hl">measured</span></h1><span class="ln"></span></div>
      <p class="luck-lede">Every other site quotes the same official rarity numbers. This one reports
        what actually came out of packs opened on camera, one rip at a time. It is one person's
        luck, not the odds, and it is counted rather than remembered.</p>

      <div class="luck-head">
        <div class="luck-stat"><b>${videos.length}</b><span>rips filmed</span></div>
        <div class="luck-stat"><b>${judged.length}</b><span>logged either way</span></div>
        <div class="luck-stat"><b>${hits.length}</b><span>had a hit</span></div>
        <div class="luck-stat"><b>${headline}</b><span>hit rate so far</span></div>
      </div>

      <div class="luck-cov">
        <p>${judged.length} of ${videos.length} rips logged &bull; ${Math.round(coverage * 100)}% of the catalogue${
          packsKnown ? ` &bull; ${totalPacks.toLocaleString("en-US")} packs counted` : ""
        }</p>
        <div class="luck-covbar"><i style="width:${Math.max(1, Math.round(coverage * 100))}%"></i></div>
      </div>
    </div>
  </section>

  <section class="band luck-sec">
    <div class="wrap">
      <h2>Which sets have been <span class="hl">kind</span></h2>
      <p class="luck-note">Hit rate is the share of logged rips from that set that produced something
        worth keeping. Sets with fewer than ${MIN_SAMPLE} logged rips do not get a number: at that
        size it would be noise dressed up as a fact.</p>
${table(bySet, "Set", "/videos.html?set=")}
    </div>
  </section>

  <section class="luck-sec">
    <div class="wrap">
      <h2>Which products have been <span class="hl">worth it</span></h2>
      <p class="luck-note">The same question asked of what was opened rather than what was in it.
        A booster box holds far more packs than a single blister, so a higher rate here is expected
        rather than surprising: what is worth reading is the gap between similar products.</p>
${table(byProduct, "Product", "/videos.html?product=")}
    </div>
  </section>

  ${
    rarities.length || pulls.length
      ? `<section class="band luck-sec">
    <div class="wrap">
      <h2>What has actually <span class="hl">come out</span></h2>
      <p class="luck-note">Counted from what the titles say, not from the rip log, which is why these
      have numbers while the hit rate above still reads zero. They are totals, not rates: a set that gets opened
      more will show more of everything. Once the log is filled in these become real per-pack rates.</p>
      <div class="pull-grid">
${(rarities.length ? rarities : pulls.map(([k, n]) => [labelFor("pulls", k) || k, n]))
  .map(([k, n]) => `        <div class="pull"><b>${n}</b><span>${esc(k)}</span></div>`)
  .join("\n")}
      </div>
    </div>
  </section>`
      : ""
  }

  ${
    worst.len || bestRun.len
      ? `<section class="luck-sec">
    <div class="wrap">
      <h2>Cold streaks and <span class="hl">hot ones</span></h2>
      <p class="luck-note">Consecutive logged rips, in upload order.</p>
      <div class="streaks">
        <div class="streak cold">
          <span class="k">Longest drought</span>
          <b>${worst.len} rips</b>
          <p>${worst.from ? `${shortDate(worst.from.published)} to ${shortDate(worst.to.published)}, nothing worth keeping.` : ""}</p>
        </div>
        <div class="streak hot">
          <span class="k">Best run</span>
          <b>${bestRun.len} rips</b>
          <p>${bestRun.from ? `${shortDate(bestRun.from.published)} to ${shortDate(bestRun.to.published)}, a hit every time.` : ""}</p>
        </div>
      </div>
    </div>
  </section>`
      : ""
  }

  <section class="luck-sec">
    <div class="wrap">
      <p class="luck-method">HOW THIS IS COUNTED. A rip counts only once it has been marked as a hit
        or not a hit in the rip log, so an untagged video is absent rather than assumed. "Hit" means
        a card worth keeping, judged by eye, not a fixed rarity threshold. These are observed results
        from one person opening packs on camera, not official pull rates: The Pokemon Company does not
        publish those, and anyone who tells you they know them is guessing. Small samples are labelled
        rather than rounded into confidence. Numbers move as more rips are logged.</p>
    </div>
  </section>
</main>`;

// NO Dataset MARKUP UNTIL THERE IS A DATASET. With nothing logged this
// declared a dataset of "0 logged pack openings" to search engines, which is
// structured data asserting something the page does not have. The page itself
// was already honest, showing a dash and "0 of 311 rips logged"; the markup was
// not. Same reason the page is dropped from the sitemap below.
const ld =
  judged.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: "Observed Pokemon card hit rates from Garbage Rips 585",
        description: `Hit rates observed across ${judged.length} logged pack openings, by set and by product type.`,
        url: `${SITE}/luck.html`,
        creator: { "@type": "Organization", name: "Garbage Rips 585", url: `${SITE}/` },
        isAccessibleForFree: true,
      }
    : null;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pokemon Pack Luck, Measured: What Actually Came Out of ${videos.length} Rips | Garbage Rips 585</title>
<meta name="description" content="${
  judged.length
    ? `Observed hit rates from ${judged.length} logged Pokemon pack openings, broken down by set and product. Not official pull rates: what actually came out on camera.`
    : `What actually came out of ${videos.length} pack openings on camera, counted from our own rip log rather than estimated.`
}">
${judged.length ? "" : '<meta name="robots" content="noindex,follow">\n'}<link rel="canonical" href="${SITE}/luck.html">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#15263A">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="Pokemon Pack Luck, Measured">
<meta property="og:description" content="Hit rates observed across ${judged.length} real pack openings, by set and by product.">
<meta property="og:url" content="${SITE}/luck.html">
<meta property="og:image" content="${SITE}/assets/og-luck.jpg">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
${STYLES}
<style>${style}</style>
${ld ? `<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>` : "<!-- No Dataset markup: there are no judged rips yet, so there is nothing to describe. -->"}
</head>
<body>
${SKIP}
${SPRITE}

${BAR}
${MENU}
${body}

${footer()}

${APP_JS}
</body>
</html>
`;

await writeFile(OUT, html);

console.log(`Wrote public/luck.html
  ${judged.length} of ${videos.length} rips logged either way (${Math.round(coverage * 100)}%)
  ${hits.length} hits, ${headline} overall
  ${bySet.filter((r) => r.rips >= MIN_SAMPLE).length} of ${bySet.length} sets have a big enough sample to show a rate
  ${packsKnown} rips have a pack count, ${totalPacks} packs counted`);
if (!judged.length) {
  console.log(`
  Nothing is marked "Has Hit" in the rip log yet, so every rate is empty.
  Fill that column in the spreadsheet, run import-sheet.mjs, and this fills in.`);
}
