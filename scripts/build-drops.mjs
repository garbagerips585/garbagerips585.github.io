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
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where
// it sits, so both attach to nothing: ~11.9KB gzipped and 2 requests for a
// script that finds no tile and a stylesheet whose classes never appear.
// CHECKED BY DRIVING THE PAGE, not by grepping it: packplayer's entry point is
// a delegated click on an <a> to a rip that WRAPS an <img> or a .pack facade,
// which no scan for [data-vcar] or img[data-packsrc] can see. The three
// conditions a page must meet, and why the obvious scan gives the wrong answer,
// are in shared/chrome.mjs beside the two exports. READ THAT BEFORE ADDING A
// VIDEO TILE OR A CAROUSEL HERE: a tile added without putting packplayer.js
// back navigates instead of playing in place, which reads as a design choice
// rather than as a bug.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { brandMark, BRAND_CREDIT, BRAND_STYLE } from "../shared/brands.mjs";
import { esc, longDate } from "../shared/format.mjs";
// THE EXPIRY MODEL MOVED OUT OF THIS FILE ON 17 AUGUST 2026 and it did not
// change on the way. The home page now carries a compact band built from the
// same rows, so "which rows are still true today" is a question two pages ask
// and neither may own: a row that has expired here and not there is exactly the
// failure this page was written to avoid, in the more damaging of the two
// places. shared/drops.mjs holds the predicates and the two client-side date
// helpers; the arguments for both layers are written up there and in
// data/drops.json's _readme. Nothing below computes an expiry of its own.
import {
  dropsClock, expiresOn as dropExpiresOn, isPerishable, splitByExpiry,
  isStale, daysStale, CONF_LABEL, CLIENT_DATE_JS,
} from "../shared/drops.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const doc = JSON.parse(await readFile(join(ROOT, "data/drops.json"), "utf8"));
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

const TODAY = dropsClock(doc, videos);

const stale = isStale(doc, TODAY);
const daysOld = daysStale(doc, TODAY);

const R = doc.retailers || {};
const all = doc.drops || [];
const known = all.filter((d) => R[d.retailer]);
if (known.length !== all.length) {
  // A row naming a retailer with no entry would render an unlabelled card, and
  // the reader would have no idea which shop it meant. Checked against the FULL
  // list rather than the surviving one, so a typo in a row that has already
  // expired still fails the build instead of going quiet for a week.
  const bad = all.filter((d) => !R[d.retailer]).map((d) => d.retailer);
  throw new Error(`drops.json names retailers with no entry in "retailers": ${bad.join(", ")}`);
}

// THE SECOND EXPIRY MECHANISM, AND IT IS NOT A DUPLICATE OF THE FIRST.
//
// The week banner below covers one failure: nobody has touched the site in a
// month and the page still calls its week "this week". It is deliberately a
// banner rather than a delete, because last week's expectations are still worth
// reading as a pattern.
//
// This covers the other failure, which the banner cannot reach because it
// happens while the week is still perfectly current. Some rows are not a week's
// worth of shelf watching, they are ONE AFTERNOON: "be ready for a possible drop
// today between 10am and 2pm". On Tuesday that row is not a record of anything,
// it is simply wrong, and it is wrong in the most expensive direction because
// somebody sits refreshing a shop page for a window that closed yesterday.
//
// So a row may carry `expires`, the last day it can be true. When that date is
// EARLIER than weekEnds the row is PERISHABLE and it is deleted rather than
// banded: here when the build clock is past it, and again in the browser on the
// reader's clock, which is the belt-and-braces shape build-shows.mjs uses on
// shows that have already happened. A row with no `expires` inherits weekEnds,
// is never perishable, and lives or dies with the week like everything else.
//
// The three lines below were the definition of all of that and are now two
// bindings onto shared/drops.mjs, unchanged in behaviour. The home page band
// reads the same functions, so the two pages cannot disagree about which rows
// are alive.
const expiresOn = (d) => dropExpiresOn(doc, d);
const perishable = (d) => isPerishable(doc, d);
const { live: drops, expired } = splitByExpiry(doc, known, TODAY);

// PATTERN IS THE WEAKEST TIER AND IT EARNED ITS OWN WORD. The other three all
// imply something official sits behind them, because that is what they mean on
// /upcoming.html. A recurring drop-time claim has no official origin at all:
// every retailer surface was probed and not one publishes a restock schedule,
// so "Walmart Wednesday" is folklore that happens to be well observed. Giving
// it the same badge as an announced date would have been the page telling a
// small lie in its own vocabulary.
// THE FOUR LABELS MOVED TO shared/drops.mjs AND NOTHING ELSE DID. The home page
// band prints a confidence on each of its rows too, and "Pattern only" rounding
// itself up to "Expected" on the smaller of the two surfaces is the exact way a
// hedge gets lost. The class and the note stay here: only this page has room to
// explain the ladder, and only this page has the ladder's CSS.
const CONF = {
  confirmed: { label: CONF_LABEL.confirmed, cls: "ok", note: "A date the retailer put on it, or stock already seen on shelves." },
  window: { label: CONF_LABEL.window, cls: "win", note: "Expected inside a known range." },
  expected: { label: CONF_LABEL.expected, cls: "exp", note: "The community thinks it is coming. No date." },
  pattern: { label: CONF_LABEL.pattern, cls: "pat", note: "A day or time people have noticed. No retailer publishes a restock schedule, so this is the weakest thing on the page." },
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
  const c = CONF[d.confidence] || CONF.expected;
  const ex = expiresOn(d);
  const dies = perishable(d);
  const w = d.window || {};
  // ATTRIBUTION IS PER CARD, NOT PER PAGE, and the page-level credit at the top
  // is not enough on its own. A card is the unit somebody screenshots and pastes
  // into a group chat, and it travels without the lede that says none of this is
  // ours. A row may name its own source when it has one; otherwise it inherits
  // the week's, which is the whole point of putting `source` at the top of
  // drops.json. Nine identical lines in micro type is the correct amount of
  // repetition here.
  const src = d.source || doc.source;
  return `      <article class="drop" data-channel="${esc(d.channel)}" data-retailer="${esc(d.retailer)}"
        data-expires="${esc(ex)}"${dies ? ` data-perish="1"` : ""}${
          w.from ? ` data-from="${esc(w.from)}"` : ""
        }${w.to ? ` data-to="${esc(w.to)}"` : ""}>
        <div class="drop-top">
          ${chip(d.retailer)}
          <span class="drop-ch">${d.channel === "store" ? "In store" : "Online"}</span>
          <span class="drop-cf ${c.cls}">${esc(c.label)}</span>
        </div>
        <p class="drop-what">${esc(d.what)}</p>
        ${d.when ? `<p class="drop-when"><b>When.</b> ${esc(d.when)}</p>` : ""}
        ${dies ? `<p class="drop-exp">Good until <time datetime="${esc(ex)}">${esc(longDate(ex))}</time>, then it comes off this page. A window that has closed is not a forecast.</p>` : ""}
        ${(d.notes || []).map((n) => `<p class="drop-note">${esc(n)}</p>`).join("\n        ")}
        ${src?.name ? `<p class="drop-src">${
          src.url
            ? `<a href="${esc(src.url)}" rel="noopener" target="_blank">${esc(src.name)}</a>`
            : esc(src.name)
        }${src.read ? `, read ${esc(longDate(src.read))}` : ""}</p>` : ""}
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
const TITLE_FRESH = "Pokemon Card Drops and Restocks This Week";
const TITLE_STALE = `Pokemon Card Drops and Restocks: Week of ${longDate(doc.weekOf)}`;
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
.dr-stale{background:var(--ketchup);color:var(--on-accent);border-radius:var(--r);padding:var(--s3) var(--s4);
  margin-bottom:var(--s4);font:700 var(--t-sm)/1.4 var(--body)}
.dr-when{font:700 var(--t-label)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink-2);margin-bottom:var(--s2)}
.dr-filters{display:flex;flex-wrap:wrap;gap:var(--s2);margin:var(--s4) 0 var(--s5)}
.dr-f{flex:none;font:700 var(--t-label)/1 var(--body);letter-spacing:.02em;padding:10px 14px;
  min-height:44px;display:inline-flex;align-items:center;border:2px solid var(--keyline);
  border-radius:999px;background:var(--card);color:var(--ink);cursor:pointer}
.dr-f[aria-pressed="true"]{background:var(--mustard);color:var(--on-accent)}
.dr-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4)}
/* 700 AND NOT 820, BECAUSE 820 PUT AN iPAD ON THE PHONE LAYOUT. An iPad in
   portrait is 768 CSS px, under the old 820, so a tablet got the phone's single
   column and every drop card was stretched across the full 720px wrap. 700 is
   the widest boundary that leaves 768 on two columns and it is a measured line
   rather than a round one: the wrap is 660px inside a 700px viewport, so two
   322px cards and a 16px gap fit exactly, and at 390 the wrap is 350px where
   one column is still the only thing that fits.
   These cards are short, 233 to 683 characters over a photo, so narrowing them
   barely adds height and pairing them halves the rows: 1,448px to 1,123 at 768,
   a 22% shorter band. NOT auto-fit, because the base repeat(2,1fr) IS this
   grid's desktop rule at every width above 820 and there is no min-width rule
   over it; an auto-fit floor low enough to give two columns at 720 computes
   FOUR at the 1,392px wrap of a 1440 window, which nobody chose. */
@media(max-width:700px){.dr-grid{grid-template-columns:1fr}}
.drop{border:3px solid var(--keyline);border-radius:12px;background:var(--card);
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
/* THE PERISHABLE ROW SAYS SO ON ITS OWN FACE. The sweep at the bottom of the
   page takes these away on the day after, but a reader should not have to trust
   a script they cannot see to know what they are looking at: the row that is
   only true for one afternoon prints the date it stops being true, in a <time>,
   next to the hour it names. Ink weight rather than colour, same as the
   confidence ladder above, so it survives the palette having one hue. */
.drop-exp{font:700 var(--t-sm)/1.4 var(--body);color:var(--ink);
  border-left:3px solid var(--ink-soft);padding:2px 0 2px var(--s3)}
.drop-exp time{font-family:var(--mono);letter-spacing:.01em}
/* The note the sweep writes when it has removed something. Hidden until it has,
   because "nothing has expired" is not news and an empty box is worse. */
.dr-swept{border:2px dashed var(--ink-2);border-radius:var(--r);padding:var(--s3) var(--s4);
  margin-bottom:var(--s4);color:var(--ink);font:600 var(--t-sm)/1.45 var(--body)}
.dr-swept[hidden]{display:none}
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
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-drops.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
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
        <!-- THE HEADLINE GOES STALE TOO, and it was the last thing on the page
             that did not. The title, the description and both og tags already
             switch to a past tense when the week has gone, for the reason
             argued above TITLE_FRESH: a page cannot say "not this week's plan"
             in a banner and "this week" in the biggest type on the screen and
             expect to be believed about either. Two spans carrying their own
             replacement TEXT rather than one element carrying replacement
             MARKUP, so the swap below never touches innerHTML. -->
        <h1><span data-s="What was">${stale ? "What was" : "What is"}</span> <span class="hl">dropping</span> <span data-s="that week">${stale ? "that week" : "this week"}</span></h1>
        <p class="lede" style="max-width:44em">Where Pokemon cards are expected to turn up, in store and online.
          <b>This is community intelligence, not fact, and none of it is announced by anyone.</b>
          Retailers do not publish restock schedules, so every line here is other people watching shelves
          and backend listings and comparing notes. <b>These are not our findings.</b> We are passing on
          what the trackers said, in the words they hedged it with. Treat it as a decent guess, and check
          the confidence on each one.</p>
        <p class="lede" style="max-width:44em"><b data-n="store">${nStore}</b> in store,
          <b data-n="online">${nOnline}</b> online. A snapshot compiled ${esc(longDate(doc.compiled))}${
          doc.source?.name
            ? ` from ${esc(doc.source.name).toLowerCase()}${
                doc.source.read ? `, read ${esc(longDate(doc.source.read))}` : ""
              }`
            : ""
        }. It is what somebody else expected on that date, and it has not been checked since.</p>
      </div>

      <div class="dr-filters" role="group" aria-label="Filter drops">
        <button class="dr-f" type="button" data-f="all" aria-pressed="true">Everything</button>
        <button class="dr-f" type="button" data-f="store" aria-pressed="false">In store (<b data-n="store">${nStore}</b>)</button>
        <button class="dr-f" type="button" data-f="online" aria-pressed="false">Online (<b data-n="online">${nOnline}</b>)</button>
        ${order.map((id) => `<button class="dr-f" type="button" data-r="${esc(id)}" aria-pressed="false">${esc(R[id].name)}</button>`).join("\n        ")}
      </div>

      <p class="dr-swept" id="drSwept" hidden></p>

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
        <p><b>Where it came from.</b> ${doc.source?.name ? `${esc(doc.source.name)}${doc.source.read ? `, read ${esc(longDate(doc.source.read))}` : ""}. ` : ""}Stock
          tracking communities that Tim follows, passed on with the hedges they were written with. We do not
          name them, and there is no link, because several are private or paid and a reader is not served by
          being pointed at a door they cannot open. None of this is our own reporting and none of it is a
          retailer speaking.</p>
        <p style="margin-top:var(--s3)"><b>What the labels mean.</b> ${Object.values(CONF).map((c) => `<b>${c.label}:</b> ${c.note}`).join(" ")}</p>
        <p style="margin-top:var(--s3)"><b>When rows disappear.</b> A row that covers one afternoon or one
          evening prints the date it stops being true, and it is removed from this page the day after,
          on your clock rather than ours. The rest of the list runs to the end of the week at the top of
          the page, and once that week has passed the page says so before it says anything else. Nothing
          here is refreshed automatically, so an old page is an old page and it will tell you it is one.</p>
        <p style="margin-top:var(--s3)"><b>Whose logos these are.</b> ${BRAND_CREDIT}
          The kind of shop is the word under each name: ${[...new Set(Object.values(R).map((x) => x.kind))]
            .map((k) => esc(k))
            .join(", ")}.</p>
        <p style="margin-top:var(--s3)">Stock varies store to store and the good stuff goes fast, so this tells you
          where to look rather than what you will find. If you would rather buy without the hunt, the
          <a href="/shops.html">Rochester shops</a> and the <a href="/card-shows.html">card shows</a> have
          cards on a table right now, and <a href="/pack-prices.html">pack prices</a> shows what a pack
          actually costs before you pay a scalper for one. Several of the rows above are First
          Partner collection boxes, and there is a
          <a href="/first-partner-illustration-collection.html">full guide to those</a> with all 27
          cards, what is in the box and what it should cost.</p>
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
  // The four date helpers come from shared/drops.mjs, which the home page band
  // inlines too. The backslash-doubling trap that used to be described here
  // (a lone backslash-d written once ships as a bare d, and the guard is then
  // present, correct looking and permanently asleep) is written up beside them,
  // and interpolating a string built there cannot reintroduce it.
  // NOTE FOR THE NEXT EDITOR OF THIS COMMENT: you are inside a template
  // literal. A backtick here is a syntax error, which is how this line was
  // written the first time.
${CLIENT_DATE_JS}
  if (isIsoDay(ends)) {
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
      // The headline, in the same breath as the head. textContent only, on the
      // two spans that carry their own past tense, so this can never inject
      // markup and can never lose the .hl highlight between them.
      [].slice.call(document.querySelectorAll("h1 [data-s]")).forEach(function (sp) {
        sp.textContent = sp.getAttribute("data-s");
      });
      if (el.getAttribute("data-title")) document.title = el.getAttribute("data-title");
      set('meta[name="description"]', "content", el.getAttribute("data-desc"));
      set('meta[property="og:title"]', "content", el.getAttribute("data-og-title"));
      set('meta[property="og:description"]', "content", el.getAttribute("data-desc"));
    }
  }

  // THE PER ROW SWEEP, AND IT RUNS WHETHER OR NOT THE WEEK HAS PASSED.
  //
  // Same argument as the guard above, one rung finer. The build deletes a
  // perishable row once its day has gone, but the build clock is the newest
  // upload plus a hand-edited date, and neither of those moves on a Tuesday
  // morning. A page built on Monday and served untouched all week would keep
  // "be ready for a possible drop today between 10am and 2pm" on it until
  // Saturday, and that row is not stale in the harmless way the banner
  // describes: it is an instruction to go and refresh a shop page for a window
  // that shut days ago.
  //
  // Straight out of the DOM rather than hidden, the same call build-shows.mjs
  // makes on a show that has already happened, and for the same reason: there
  // is nothing to read in a closed window. A row with no data-perish is
  // untouched, so the week's ordinary rows still stand as a record when the
  // banner fires.
  //
  // This runs BEFORE the filter script below, which caches the cards it finds,
  // so the two cannot disagree about how many there are.
  var todayNow = todayIso();
  var swept = 0;
  [].slice.call(document.querySelectorAll(".drop[data-perish]")).forEach(function (c) {
    var ex = c.getAttribute("data-expires");
    if (isIsoDay(ex) && ex < todayNow && c.parentNode) {
      c.parentNode.removeChild(c);
      swept++;
    }
  });
  if (swept) {
    // EVERY COUNT ON THE PAGE IS NOW WRONG, and they are baked into the markup:
    // two in the lede and two inside the filter buttons. A filter reading
    // "Online (4)" that shows three is a small lie on a page whose whole subject
    // is not telling small lies.
    var grid = document.getElementById("drGrid");
    var live = grid ? [].slice.call(grid.querySelectorAll(".drop")) : [];
    var count = function (ch) {
      var k = 0;
      live.forEach(function (c) { if (c.getAttribute("data-channel") === ch) k++; });
      return k;
    };
    var ns = count("store"), no = count("online");
    [].slice.call(document.querySelectorAll('[data-n="store"]')).forEach(function (e) { e.textContent = ns; });
    [].slice.call(document.querySelectorAll('[data-n="online"]')).forEach(function (e) { e.textContent = no; });
    // A retailer chip with nothing behind it filters to an empty grid, which
    // reads as a broken page rather than as an expired row.
    [].slice.call(document.querySelectorAll(".dr-f[data-r]")).forEach(function (b) {
      var r = b.getAttribute("data-r"), any = false;
      live.forEach(function (c) { if (c.getAttribute("data-retailer") === r) any = true; });
      if (!any && b.parentNode) b.parentNode.removeChild(b);
    });
    var note = document.getElementById("drSwept");
    if (note) {
      // "AND THE REST STILL STANDS" IS A CLAIM, so it is only made when the
      // page is entitled to make it. Once the week banner is up, everything
      // below is a record rather than a forecast, and a note underneath the
      // banner vouching for the remaining rows would be the page arguing with
      // itself in two consecutive paragraphs.
      var banner = el && !el.hidden;
      var head = live.length
        ? (swept === 1
            ? "One row on this list covered a window that has since closed, so it has been taken off."
            : swept + " rows on this list covered windows that have since closed, so they have been taken off.")
        : "Every row on this list covered a window that has since closed, so there is nothing left to show.";
      var tail = !live.length
        ? " Nothing here has been updated since it was compiled."
        : banner
          ? " What is left is the rest of that week's list, and the notice above applies to all of it."
          : " The rest of the list runs to the end of the week.";
      note.textContent = head + tail;
      note.hidden = false;
    }
    // Filtering an empty grid is a control with no job.
    if (!live.length) {
      var f = document.querySelector(".dr-filters");
      if (f && f.parentNode) f.parentNode.removeChild(f);
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
const perish = drops.filter(perishable);
console.log(`Wrote public/drops.html
  ${drops.length} drops across ${order.length} retailers, ${nStore} in store and ${nOnline} online
  week of ${doc.weekOf} to ${doc.weekEnds}${stale ? `  STALE by ${daysOld} days, the page says so` : ""}
  ${perish.length} perishable row(s) still live: ${
    perish.map((d) => `${d.retailer}/${d.channel} to ${expiresOn(d)}`).join(", ") || "none"
  }${
    expired.length
      ? `\n  ${expired.length} perishable row(s) dropped, already past on ${TODAY}: ${expired
          .map((d) => `${d.retailer}/${d.channel} expired ${expiresOn(d)}`)
          .join(", ")}`
      : ""
  }`);
