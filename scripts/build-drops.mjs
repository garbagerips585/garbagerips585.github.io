#!/usr/bin/env node
// Build /drops.html: what retailers are expected to have this week.
//
//   node scripts/build-drops.mjs
//
// Reads data/drops.json, which a human updates weekly.
//
// THIS IS THE ONLY PAGE ON THE SITE BUILT FROM FORECASTS, and everything here
// follows from that. Every other page obeys the rule that a published number
// traces to a source. Nothing on this one does: no retailer announces its
// restock schedule, and the people reporting it are reading shelves, backend
// listings and each other. Pretending otherwise would be the single most
// damaging thing this site could do, because a reader drives somewhere.
//
// So the page is built to be honest about its own reliability:
//   - the lede says nobody has announced any of this
//   - every row carries a confidence, in the three words upcoming.json uses
//     plus a fourth, `pattern`, for the claims with no official origin at all
//   - the compiled date is at the top, not in the footer
//   - and when the week has passed the page SAYS SO before anything else
//
// STALENESS IS THE FAILURE MODE. "Today" comes from the newest upload in the
// catalogue rather than the clock, the same trick build-upcoming.mjs uses, so
// a rebuild is reproducible and a stale checkout cannot silently make an old
// week look current.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS } from "../shared/chrome.mjs";
import { brandMark, BRAND_CREDIT, BRAND_STYLE } from "../shared/brands.mjs";
import { esc, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const doc = JSON.parse(await readFile(join(ROOT, "data/drops.json"), "utf8"));
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

const TODAY =
  [videos.map((v) => v.published).filter(Boolean).sort().pop(), doc.compiled]
    .filter(Boolean)
    .sort()
    .pop()
    .slice(0, 10);

const stale = Boolean(doc.weekEnds && doc.weekEnds < TODAY);
const daysOld = doc.weekEnds
  ? Math.round((new Date(TODAY) - new Date(doc.weekEnds)) / 86400000)
  : 0;

const R = doc.retailers || {};
const drops = (doc.drops || []).filter((d) => R[d.retailer]);
if (drops.length !== (doc.drops || []).length) {
  // A row naming a retailer with no entry would render an unlabelled card, and
  // the reader would have no idea which shop it meant.
  const bad = (doc.drops || []).filter((d) => !R[d.retailer]).map((d) => d.retailer);
  throw new Error(`drops.json names retailers with no entry in "retailers": ${bad.join(", ")}`);
}

// PATTERN IS THE WEAKEST TIER AND IT EARNED ITS OWN WORD. The other three all
// imply something official sits behind them, because that is what they mean on
// /upcoming.html. A recurring drop-time claim has no official origin at all:
// every retailer surface was probed and not one publishes a restock schedule,
// so "Walmart Wednesday" is folklore that happens to be well observed. Giving
// it the same badge as an announced date would have been the page telling a
// small lie in its own vocabulary.
const CONF = {
  confirmed: { label: "Confirmed", cls: "ok", note: "A date the retailer put on it, or stock already seen on shelves." },
  window: { label: "Usual window", cls: "win", note: "Expected inside a known range." },
  expected: { label: "Expected", cls: "exp", note: "The community thinks it is coming. No date." },
  pattern: { label: "Pattern only", cls: "pat", note: "A day or time people have noticed. No retailer publishes a restock schedule, so this is the weakest thing on the page." },
};

const byChannel = (c) => drops.filter((d) => d.channel === c);
const nStore = byChannel("store").length;
const nOnline = byChannel("online").length;

// Retailers in the order they first appear, so the filter row matches the page.
const order = [];
for (const d of drops) if (!order.includes(d.retailer)) order.push(d.retailer);

// COLOUR MEANS KIND OF SHOP, NOT WHICH SHOP. A retailer's own brand color was
// tried first and failed on its own terms: the two red pharmacies-and-discount
// chips landed close enough to be one color, and better sourcing makes it
// worse rather than better, because Target and Costco use the same Pantone.
// The name identifies. These are the site's own palette describing the site's
// own categories, so they assert nothing about anybody's brand.
// THE FIVE KIND TINTS ARE GONE AND THE RETAILER'S OWN MARK IS THERE INSTEAD.
//
// The tints were a deliberate, well argued idea: the stripe named the KIND of
// shop in the site's own palette rather than pretending to be anybody's brand
// colour, which sidestepped the fact that Target and Costco use the same
// Pantone. The repaint killed it. --navy and --ketchup are both #111111 now, so
// "Big box" and "Discount" were the identical stripe; --teal is #4A4A4A and
// --plum is #3A3A3A, which is a 1.13:1 difference nobody can see. Five
// categories, three visibly distinct stripes, and a key at the bottom of the
// page explaining a distinction that no longer existed.
//
// Reaching for five more tokens does not fix it: this palette is black, white
// and gold on purpose, so it does not hold five separable hues and should not
// be made to.
//
// What the chip actually needed was the thing a reader scans for, which is the
// SHOP, and scripts/sync-brands.mjs already mirrors five of these seven for
// /buying.html. So the chip is the mark, the name and the kind in words. The
// kind was always carried by the word next to the stripe rather than by the
// stripe, which is why removing the colour costs the page nothing.
//
// TWO RETAILERS HAVE NO MARK. Family Dollar is not on Commons at all, and it
// gets the site's hatched name tile from shared/brands.mjs, the same one eight
// venues on /buying.html and /selling.html carry.

const chip = (id) => {
  const r = R[id];
  if (!r) throw new Error(`drops.json: a drop names retailer "${id}", which is not in the retailers map`);
  return `<span class="rt">${brandMark(id, r.name)}<span class="rt-n">${esc(r.name)}<i>${esc(r.kind)}</i></span></span>`;
};

const card = (d) => {
  const r = R[d.retailer];
  const c = CONF[d.confidence] || CONF.expected;
  return `      <article class="drop" data-channel="${esc(d.channel)}" data-retailer="${esc(d.retailer)}">
        <div class="drop-top">
          ${chip(d.retailer)}
          <span class="drop-ch">${d.channel === "store" ? "In store" : "Online"}</span>
          <span class="drop-cf ${c.cls}">${esc(c.label)}</span>
        </div>
        <p class="drop-what">${esc(d.what)}</p>
        ${d.when ? `<p class="drop-when"><b>When.</b> ${esc(d.when)}</p>` : ""}
        ${(d.notes || []).map((n) => `<p class="drop-note">${esc(n)}</p>`).join("\n        ")}
        ${d.source ? `<p class="drop-src">${
          d.source.url
            ? `<a href="${esc(d.source.url)}" rel="noopener" target="_blank">${esc(d.source.name)}</a>`
            : esc(d.source.name)
        }${d.source.read ? `, read ${esc(longDate(d.source.read))}` : ""}</p>` : ""}
      </article>`;
};

const weekLabel =
  doc.weekOf && doc.weekEnds
    ? `${longDate(doc.weekOf)} to ${longDate(doc.weekEnds)}`
    : longDate(doc.compiled) || "this week";

// THE HEAD WAS OUTSIDE THE GUARD, so the one part of this page a search engine
// quotes was the one part that could not tell it was stale. The title promised
// "this week" and the description dated itself to a week a month back, in the
// same snippet, disagreeing with itself in front of exactly the person deciding
// whether to click. Both have a stale wording now, and both get it two ways:
// the build applies it when the build clock knows, and the pass at the bottom of
// the page applies it when the reader's clock knows and the build did not.
const TITLE_FRESH = "Pokemon Card Drops and Restocks This Week | Garbage Rips 585";
const TITLE_STALE = `Pokemon Card Drops and Restocks: Week of ${longDate(doc.weekOf)} | Garbage Rips 585`;
const OG_FRESH = "Pokemon card drops and restocks this week";
const OG_STALE = `Pokemon card drops and restocks, week of ${longDate(doc.weekOf)}`;
// SHORT ENOUGH NOT TO BE CUT. The slice is a backstop, not a plan: the old
// wording came to 168 characters and every search result ended "...and more, in
// store and online, for August 10, 2026 to August 16, 2026. Nobody", stopping
// one word into the sentence that says nobody announces any of this.
// Both are measured against the longest week label the data can produce, which
// is a pair of September dates at 40 characters, and both come in at 152.
const desc = `What Pokemon card stock is expected at Target, Walmart and more, in store and online, for ${weekLabel}. Nobody announces it.`.slice(0, 158);
const DESC_STALE = `What Pokemon card stock was expected at Target, Walmart and more for ${weekLabel}. Not updated since, so it is a record now.`.slice(0, 158);
const TITLE = stale ? TITLE_STALE : TITLE_FRESH;
const OG_TITLE = stale ? OG_STALE : OG_FRESH;
const DESC = stale ? DESC_STALE : desc;

const style = `
.dr-head{padding:var(--s6) 0 var(--s4)}
.dr-stale{background:var(--ketchup);color:#fff;border-radius:var(--r);padding:var(--s3) var(--s4);
  margin-bottom:var(--s4);font:700 var(--t-sm)/1.4 var(--body)}
.dr-when{font:700 var(--t-label)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink-2);margin-bottom:var(--s2)}
.dr-filters{display:flex;flex-wrap:wrap;gap:var(--s2);margin:var(--s4) 0 var(--s5)}
.dr-f{flex:none;font:700 var(--t-label)/1 var(--body);letter-spacing:.02em;padding:10px 14px;
  min-height:44px;display:inline-flex;align-items:center;border:2px solid var(--navy);
  border-radius:999px;background:var(--card);color:var(--ink);cursor:pointer}
.dr-f[aria-pressed="true"]{background:var(--navy);color:var(--chrome-ink)}
.dr-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4)}
@media(max-width:820px){.dr-grid{grid-template-columns:1fr}}
.drop{border:3px solid var(--navy);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4);display:flex;flex-direction:column;gap:var(--s2)}
.drop[hidden]{display:none}
.drop-top{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2)}
.rt{display:inline-flex;align-items:center;gap:var(--s2)}
.rt-n{font:700 var(--t-label)/1.1 var(--body);letter-spacing:.04em;text-transform:uppercase;
  color:var(--ink);display:inline-flex;flex-direction:column;gap:3px}
.rt i{font:400 var(--t-micro)/1 var(--mono);letter-spacing:.06em;color:var(--ink-2);font-style:normal}
${BRAND_STYLE}
.drop-ch,.drop-cf{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  padding:5px 8px;border-radius:5px;border:1px solid var(--hair);color:var(--ink-2)}
/* FOUR RUNGS, RANKED BY WEIGHT OF INK, WITH NO HUE AT ALL. Three faults, and
   the third is the one that would survive a contrast checker.
   "PATTERN ONLY" AND "EXPECTED" DIFFERED ONLY BY border-style. Two confidence
   levels, one border apart, on the page whose entire lede is "check the
   confidence on each one". The bottom rung was --card on a white card, 1.00:1,
   so the dashed hairline was carrying the whole distinction on its own.
   THE TOP RUNG WAS THE SITE'S ONLY GREEN, #1E5B34, which is legible at 7.73:1
   and is still wrong: the palette's stated idea is one accent hue.
   MUSTARD MEANT A DIFFERENT RANK ON EVERY PAGE THAT USED IT. Second here, best
   on /upcoming.html, middle on /how-many-packs.html, and because gold is the
   site's highlight the mustard chip is the loudest thing in each list. So on one
   page the middle tier outshouted the top one. Taking the accent out of the
   ladder entirely is the only fix that does not require three pages to agree
   about which rank gold means.
   What is left is four monotonically lighter treatments: solid ink, solid grey,
   filled chip, then the site's own 45 degree no-art hatch behind a dashed
   outline. The hatch already means "we do not hold this" everywhere else on the
   site, which is exactly what "no retailer publishes a restock schedule" is.
   NONE OF IT IS COLOUR ALONE: every chip prints its own label, and the key
   below the list spells all four out in words. */
.drop-cf.ok{background:var(--chrome-bg);color:var(--chrome-ink);border-color:var(--chrome-bg)}
.drop-cf.win{background:var(--ink-soft);color:var(--paper-2);border-color:var(--ink-soft)}
.drop-cf.exp{background:var(--paper-3);color:var(--ink);border-color:var(--hair)}
.drop-cf.pat{color:var(--ink);border:1.5px dashed var(--ink-2);
  background:repeating-linear-gradient(45deg,var(--paper-3) 0 6px,var(--paper-2) 6px 12px)}
.drop-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:auto;padding-top:var(--s2)}
.drop-what{font:600 var(--t-m)/1.35 var(--body)}
.drop-when,.drop-note{color:var(--ink-2);font-size:var(--t-sm);line-height:1.45}
.dr-empty{color:var(--ink-2);padding:var(--s5) 0}
.dr-key h2{margin-bottom:var(--s3)}
.dr-key{margin-top:var(--s5);color:var(--ink-2);font-size:var(--t-sm);line-height:1.5;max-width:44em}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(DESC)}">
<link rel="canonical" href="${SITE}/drops.html">
<meta property="og:title" content="${esc(OG_TITLE)}">
<meta property="og:description" content="${esc(DESC)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/drops.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-drops.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-drops.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
<style>${style}</style>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Drops this week" },
  ],
})}</script>
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Drops this week</span></nav>
      <div class="dr-head">
        <p class="dr-stale" id="drStale"${stale ? "" : " hidden"}
           data-week-ends="${esc(doc.weekEnds || "")}"
           data-title="${esc(TITLE_STALE)}"
           data-og-title="${esc(OG_STALE)}"
           data-desc="${esc(DESC_STALE)}">This list is <b data-dr-age>${
             // The age, when there is one. Rendering the arithmetic unguarded put
             // "This list is -1 days out of date" in the markup of every fresh
             // build, hidden but present, waiting for the day somebody read the
             // source or a tool ignored the attribute.
             stale ? `${daysOld} day${daysOld === 1 ? "" : "s"}` : "a few days"
           }</b> out of date. It covered ${esc(weekLabel)} and has not been updated since. Treat it as a record of what was expected, not as this week's plan.</p>
        <p class="dr-when">${esc(weekLabel)}</p>
        <h1>What is <span class="hl">dropping</span> this week</h1>
        <p class="lede" style="max-width:44em">Where Pokemon cards are expected to turn up, in store and online.
          <b>None of this is announced by anyone.</b> Retailers do not publish restock schedules, so every
          line here is people watching shelves and backend listings and comparing notes. Treat it as a
          decent guess, and check the confidence on each one.</p>
        <p class="lede" style="max-width:44em">${nStore} in store, ${nOnline} online, compiled ${esc(longDate(doc.compiled))}${
          doc.source?.name ? ` from ${esc(doc.source.name).toLowerCase()}` : ""
        }.</p>
      </div>

      <div class="dr-filters" role="group" aria-label="Filter drops">
        <button class="dr-f" type="button" data-f="all" aria-pressed="true">Everything</button>
        <button class="dr-f" type="button" data-f="store" aria-pressed="false">In store (${nStore})</button>
        <button class="dr-f" type="button" data-f="online" aria-pressed="false">Online (${nOnline})</button>
        ${order.map((id) => `<button class="dr-f" type="button" data-r="${esc(id)}" aria-pressed="false">${esc(R[id].name)}</button>`).join("\n        ")}
      </div>

      <div class="dr-grid" id="drGrid">
${drops.map(card).join("\n")}
      </div>
      <p class="dr-empty" id="drEmpty" hidden>Nothing matches that combination.</p>
      <!-- FILTERING WAS A SILENT CHANGE. The buttons were correct, aria-pressed
           and all, but pressing one took the grid from 8 cards to 3 and said
           nothing: a screen reader user got a state change with no result. The
           count is announced here rather than on the grid, because making the
           grid itself live would re-read every card on every keystroke. -->
      <p class="sr-only" id="drCount" role="status" aria-live="polite"></p>

      <div class="dr-key">
        <h2>How to read this page</h2>
        <p><b>What the labels mean.</b> ${Object.values(CONF).map((c) => `<b>${c.label}:</b> ${c.note}`).join(" ")}</p>
        <p style="margin-top:var(--s3)"><b>Whose logos these are.</b> ${BRAND_CREDIT}
          The kind of shop is the word under each name: ${[...new Set(Object.values(R).map((x) => x.kind))]
            .map((k) => esc(k))
            .join(", ")}.</p>
        <p style="margin-top:var(--s3)">Stock varies store to store and the good stuff goes fast, so this tells you
          where to look rather than what you will find. If you would rather buy without the hunt, the
          <a href="/shops.html">Rochester shops</a> and the <a href="/card-shows.html">card shows</a> have
          cards on a table right now, and <a href="/pack-prices.html">pack prices</a> shows what a pack
          actually costs before you pay a scalper for one.</p>
      </div>
    </div>
  </section>
</main>
${footer()}
<script>
(function () {
  // THE GUARD, RUN AGAIN ON THE READER'S CLOCK.
  //
  // The build already decides whether the week has passed, and that decision is
  // sound as far as it goes. What it cannot see is itself: its "today" is the
  // later of the newest upload in the catalogue and the compiled date in
  // drops.json, and both of those are written by the same person. Only a new
  // video moves the first and only a hand edit moves the second, so "nobody has
  // touched the site in a month" is precisely the case where the clock stops
  // and the page keeps insisting the week it names is this one. The nightly can
  // run all month and change nothing about that.
  //
  // The reader's clock has none of those problems. It only ever escalates: the
  // banner cannot be hidden here, and the number cannot be made smaller than
  // the one the build published.
  //
  // The head goes with it. A stale page whose title still promises "this week"
  // is a bad search result before it is a bad page, and the crawlers that run
  // scripts will see the corrected version.
  var el = document.getElementById("drStale");
  var ends = el && el.getAttribute("data-week-ends");
  // \\d, doubled. This script is inside a template literal in
  // scripts/build-drops.mjs, so a single backslash never reaches the page and
  // the pattern would ship as /^d{4}-d{2}-d{2}$/, which matches no date at all.
  // The guard would then be present, correct looking and permanently asleep.
  // COMPARE LOCAL MIDNIGHTS, NOT UTC ONES. This read the reader's "today" from
  // toISOString(), which is the UTC date, while anchoring each published date
  // at UTC midnight. West of Greenwich those disagree for the last hours of
  // every evening: at 9pm in Rochester it is already tomorrow in UTC, so every
  // date on the page aged by a day and the hero said "Yesterday's Rip" over a
  // video published that morning. Four hours a night, five in winter, in the
  // owner's own timezone. Both sides are local now.
  function localDay(iso) {
    var p = String(iso || "").split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]).getTime();
  }
  function todayLocal() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  }
  function todayIso() {
    var n = new Date();
    var m = n.getMonth() + 1, d = n.getDate();
    return n.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
  }
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(ends || "")) {
    var today = todayIso();
    if (ends < today) {
      var days = Math.round(
        (localDay(today) - localDay(ends)) / 86400000
      );
      var age = el.querySelector("[data-dr-age]");
      if (age && days > (parseInt(age.textContent, 10) || 0)) {
        age.textContent = days + (days === 1 ? " day" : " days");
      }
      el.hidden = false;
      var set = function (sel, attr, val) {
        var n = document.querySelector(sel);
        if (n && val) n.setAttribute(attr, val);
      };
      if (el.getAttribute("data-title")) document.title = el.getAttribute("data-title");
      set('meta[name="description"]', "content", el.getAttribute("data-desc"));
      set('meta[property="og:title"]', "content", el.getAttribute("data-og-title"));
      set('meta[property="og:description"]', "content", el.getAttribute("data-desc"));
    }
  }
})();
</script>
<script>
(function () {
  // PROGRESSIVE ENHANCEMENT. Without this every card is already visible, which
  // is the honest default: a filter that fails closed would hide stock.
  var grid = document.getElementById("drGrid");
  if (!grid) return;
  var cards = [].slice.call(grid.querySelectorAll(".drop"));
  var empty = document.getElementById("drEmpty");
  var count = document.getElementById("drCount");
  var btns = [].slice.call(document.querySelectorAll(".dr-f"));
  var channel = "all", retailer = null;

  function apply() {
    var shown = 0;
    cards.forEach(function (c) {
      var okC = channel === "all" || c.getAttribute("data-channel") === channel;
      var okR = !retailer || c.getAttribute("data-retailer") === retailer;
      var on = okC && okR;
      c.hidden = !on;
      if (on) shown++;
    });
    if (empty) empty.hidden = shown > 0;
    if (count) {
      count.textContent = shown
        ? shown + (shown === 1 ? " drop shown" : " drops shown")
        : "No drops match that combination";
    }
    btns.forEach(function (b) {
      var f = b.getAttribute("data-f"), r = b.getAttribute("data-r");
      var on = r ? r === retailer : f === "all" ? channel === "all" && !retailer : f === channel;
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      var f = b.getAttribute("data-f"), r = b.getAttribute("data-r");
      if (r) retailer = retailer === r ? null : r;
      else if (f === "all") { channel = "all"; retailer = null; }
      else channel = channel === f ? "all" : f;
      apply();
    });
  });
  apply();
})();
</script>
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/drops.html"), page);
console.log(`Wrote public/drops.html
  ${drops.length} drops across ${order.length} retailers, ${nStore} in store and ${nOnline} online
  week of ${doc.weekOf} to ${doc.weekEnds}${stale ? `  STALE by ${daysOld} days, the page says so` : ""}`);
