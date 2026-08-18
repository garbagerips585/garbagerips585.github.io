#!/usr/bin/env node
// The two Topps pages: /topps.html and /topps-card-values.html
//
//   node scripts/build-topps.mjs
//
// Reads data/topps-sets.json, which a human wrote with a citation on every
// fact, and data/topps-top.json, written by scripts/sync-topps-top.mjs off the
// cached PriceCharting crawl and stamped by scripts/verify-topps-top.mjs.
//
// Neither sync is in build-all.mjs. sync-topps-top.mjs makes no network request
// at all and could be, but the verifier is 176 requests against somebody else's
// server, and a builder that runs on a schedule must not depend on a step that
// does not. Same arrangement as /top-graded.html and /most-valuable-cards.html.
//
// ---------------------------------------------------------------------------
// WHY THERE ARE TWO PAGES AND NOT ONE, AND NOT THREE
// ---------------------------------------------------------------------------
//
// Tim asked for one thing: "can we build out a Topps cards guide, with all the
// info about the topps cards, what sets they came out with, what are the top
// 100 cards raw and graded values". That is a reference guide and two rankings,
// and they are read by the same person at different moments.
//
// ONE PAGE WOULD BE WRONG because the guide is prose and the rankings are 200
// rows. Measured on the existing pages, 100 PriceCharting rows is around
// 20,000px on a phone, so a single page would bury either the set list under
// 40,000px of table or the table under a guide, and a reader arriving at either
// one would scroll past the other.
//
// THREE PAGES WOULD ALSO BE WRONG, and that is the less obvious half. The
// obvious split is a raw top 100 and a graded top 100, mirroring
// /most-valuable-cards.html and /top-graded.html. It is refused here for a
// reason those two pages do not have: they rank two DIFFERENT catalogues of
// tens of thousands of cards, and their hundreds barely overlap. These two rank
// the SAME 2,701 Topps products, and measured on this corpus the two candidate
// windows share 54 of their rows. Two pages 47% identical, each having to
// explain the other, is a worse page twice over and it is the near-duplicate
// shape a search engine is right to be suspicious of.
//
// SO BOTH HUNDREDS ARE SERVER RENDERED ON ONE PAGE, one after the other, each
// with its own heading and its own honest description of what its column is.
// NOT a JavaScript toggle: a list hidden behind a button is a list a reader
// with no script never sees, and the whole point of publishing a ranking is
// that somebody can read it.
//
// ---------------------------------------------------------------------------
// THE TITLES SAY WHAT THE DATA IS. THEY DO NOT SAY WHAT PEOPLE SEARCH FOR
// ---------------------------------------------------------------------------
//
// The same discipline scripts/build-top100.mjs's header sets out. "The most
// valuable Topps Pokemon cards" is the phrase with the traffic and it is a
// claim this data cannot support: what we hold is one price guide's Ungraded
// and PSA 10 columns, read on one day, blind to auction and private sales. So
// the values page is titled for the measurement and names both the source and
// the read date in its own <title>, and the honesty block says what the ranking
// cannot see before the reader reaches a single row.
//
// THE READ DATE IS THE CRAWL'S, NOT THE BUILD'S. `checked` in
// data/topps-top.json is borrowed from data/top-graded.json because these are
// the same cached pages, so it is the day PriceCharting was actually read. A
// build that runs later must not make the page claim a fresher figure than it
// has, which is why no date on either page comes from `new Date()`.
//
// ---------------------------------------------------------------------------
// THE MAPPING BETWEEN TWO TAXONOMIES IS THE MOST LIKELY THING TO BE WRONG HERE,
// SO IT IS CHECKED ON EVERY BUILD
// ---------------------------------------------------------------------------
//
// Topps shipped TWELVE Pokemon sets between August 1999 and June 2004, eleven
// of them in the States and one, Johto Series 3, in Europe only. COUNT THEM
// BEFORE WRITING THE NUMBER DOWN: an early draft of this file said eleven in
// four places, because eleven is the length of the US list the page renders
// first and the twelfth sits under its own heading below it. Every count the
// two pages print comes off releases.length rather than a literal, which is
// why the pages were right while the comments were wrong.
// PriceCharting files THIRTY-THREE Pokemon "consoles" with Topps in the name,
// and they are card TYPE buckets rather than Topps releases: a set's die-cut
// chase run is split into its own bucket, and where two Topps sets shared a
// card type the two are merged into one bucket. "2000 Topps TV Heroes &
// Villians" holds HV1 to HV17, which is series 2's five Heroes & Villains cards
// and series 3's twelve, in a bucket that was never a Topps product.
//
// A page that prints those bucket names as set names tells a reader Topps
// released a set called Heroes & Villains. It did not. So data/topps-sets.json
// maps each bucket to the release it came out of, and MOST OF THOSE CLAIMS
// CARRY AN `expect` BLOCK: the shape our own crawl must have if the mapping is
// right. `checkMapping()` below recomputes every one of them and THROWS, which
// is the same call build-decks.mjs makes on its set-code map and for the same
// reason: the failure mode is a page confidently describing the wrong set, and
// nothing about it looks wrong.
//
// WHAT THE CHECKS ARE EVIDENCE FOR. Each `expect` was written by putting our
// count next to the count Bulbapedia states for that subset, and the strong
// ones are the ones where a wrong mapping could not produce the number:
//
//     19 OR-prefixed numbers          series 3's 19 Orange Islands episode cards
//     17 HV-prefixed numbers          series 2's 5 plus series 3's 12
//     62 numbers from 152 to 249      Johto series 1's 62 Pokemon cards
//     37 numbers from 169 to 250      Johto League Champions' 37 Pokemon cards
//     151 numbers from 1 to 151       Chrome Series 1's 78 plus Series 2's 73
//     76 plain numbers and 13 TV-     series 1's 76 Pokemon and 13 character
//     prefixed ones                   cards
//
// SIX BUCKETS CARRY NO `expect` AND THAT IS DELIBERATE. Where our count and
// Bulbapedia's did not line up exactly, no check was invented to make them: the
// two Johto episode buckets, the Johto hologram bucket, the Advanced pop-up
// bucket, the merged 2000 TV base bucket and the 1999 Movie base bucket are
// mapped on their bucket name alone, and the page prints no count for them. A
// green check that was tuned until it passed is worth less than no check.
//
// ---------------------------------------------------------------------------
// WHAT IS NOT ON THESE PAGES
// ---------------------------------------------------------------------------
//
// NO PULL RATES AND NO PACK ODDS. Site-wide hard rule, and it bites here
// specifically: Bulbapedia states insert odds for several of these sets. They
// were read and deliberately not recorded, and data/topps-sets.json says so, so
// there is nothing in the tree to emit by accident. Keep it that way.
//
// NO PRINT RUN TOTALS, because no source we could reach publishes one, and "not
// many were printed" is the exact shape of claim this site does not make.
//
// NO NAMED LICENSING COUNTERPARTY. Who Topps signed the Pokemon licence with is
// not stated by any source we reached. The page says the cards were licensed
// and does not guess at the other side of it.
//
// NO OUTBOUND LINK ON A PRICE ROW, and this one is a live disagreement on the
// site rather than a settled rule, so it is argued rather than assumed.
// CLAUDE.md records that /most-valuable-cards.html carries 100 "check on
// PriceCharting" links while /top-graded.html prints the same host's product
// PATH on all 100 of its rows as plain text and links none of it, and that
// which of those is right "is Tim's call". These pages follow /top-graded.html:
// two hundred more outbound links would be the largest single addition of them
// the site has ever made, and making it here would settle an open question in
// one file, quietly, which is precisely the mistake CLAUDE.md spends four
// paragraphs on. The path is printed on every row, so every figure is still
// checkable by hand. If Tim settles it the other way, both these lists and
// /top-graded.html change together, in one edit.
//
// ---------------------------------------------------------------------------
// NOBODY SAYS "DEAREST". Tim, 18 August 2026, reading the page he had just been
// handed: "not sure why it says the dearest cards ... not sure what dearest
// means". It is British English for "most expensive", it is this file's
// vocabulary rather than the site's, and it stopped the site's own owner dead.
// It is also worthless for search: nobody types "dearest Pokemon cards". Both
// pages now say "most valuable" and "highest PSA 10 values", which is what
// /most-valuable-cards.html and /top-graded.html already say, so the four
// value pages read as one cluster. The meta and og descriptions mattered most
// there, because they are the copy Google shows. Do not put it back.
//
// ---------------------------------------------------------------------------
// THE GUIDE PAGE HAD NO PICTURES AT ALL FOR ITS FIRST DAY
// ---------------------------------------------------------------------------
//
// /topps-card-values.html shipped with 200 card scans and /topps.html shipped
// with none, off the same data, which is why nobody noticed: the pictures were
// already in the tree and one of the two builders was not asking for them. A
// guide whose entire pitch is "most collectors have never knowingly held one of
// these" cannot work without showing one. Tim: this page should be "loaded with
// image examples of everything".
//
// WHAT IT SHOWS NOW, and the density is the decision rather than the maximum:
//
//   - ONE HERO CARD, eager, the only picture on the page that is not lazy.
//   - THE TWO FIVE-ROW SUMMARIES carry the card on every row, the same scans
//     the full lists on the values page use.
//   - EVERY RELEASE gets a card and, where PriceCharting's catalogue holds a
//     photograph of one, its sealed packaging. That is 11 cards and 8 packs,
//     NOT 33 of anything: PriceCharting's 33 "consoles" are card TYPE buckets
//     and Topps shipped TWELVE releases, which is what the set list renders. A
//     thumbnail per bucket would have put 33 pictures in a two column list of
//     12 cards and taught the reader the wrong taxonomy in the same stroke.
//   - THE SIDE BY SIDE in the "in your hand" section, which is the one place on
//     the page where prose genuinely cannot do the job.
//
// FOUR RELEASES HAVE NO PACKAGING PICTURE and they show a card and say nothing
// about packaging, rather than an empty frame captioned "no photo": Johto
// Series 3 (Europe only, and PriceCharting files no bucket for it at all, so it
// has no card either), Johto League Champions, Advanced and Advanced Challenge.
// Nothing was substituted from a neighbouring set to fill a hole.
//
// EVERY ONE OF THOSE URLS WAS FETCHED AND ANSWERED 200 BEFORE IT SHIPPED, by
// scripts/sync-topps-images.mjs, which writes data/topps-images.json. That check
// is not optional and 404 is not the test: PriceCharting's CDN answers 403 for a
// card it holds no scan of. Nothing in this file emits an <img> for a picture
// whose `ok` is not true.
//
// ---------------------------------------------------------------------------
// IMAGES COME FROM THE SAME PRODUCT RECORD AS THE PRICE
// ---------------------------------------------------------------------------
//
// The same call /top-graded.html and /most-valuable-cards.html make, and it
// matters more here than on either: these are anime stills from 1999 filed
// under four Chrome finishes of the same card number, so a name-only lookup
// against any other host would land on the wrong printing constantly. The
// /240.jpg rendition is HEADed by verify-topps-top.mjs on every run and a row
// without one emits no <img> at all rather than an <img> plus an onerror, so
// no reader ever spends the round trip. No width or height attributes: this
// host serves a fixed 240 HIGH and a variable width, which is why imgDims()
// correctly returns "" for it and avifPicture() correctly declines.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on either page plays a rip where
// it sits, so both attach to nothing: ~11.9KB gzipped and 2 requests for a
// script that finds no tile and a stylesheet whose classes never appear. The
// three conditions a page must meet before those go back are in
// shared/chrome.mjs beside the two exports; a video tile added without
// packplayer.js navigates instead of playing in place, which reads as a design
// choice rather than as a bug.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate, shortDate, moneyCompact, moneyExact, noValue, imgDims, avifPicture } from "../shared/format.mjs";
// THE PUBLICATION GATE, shared with /top-graded.html, /base-set.html and
// /most-valuable-cards.html. Nothing out of a PriceCharting file may be printed
// on a single read: `new_price` means PSA 10 on a listing page and Grade 8 on a
// product page, a 21x error on Base Set Charizard that looks like a reasonable
// price. Read shared/graded-gate.mjs before relaxing anything here.
import { gradedGate } from "../shared/graded-gate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(await readFile(join(ROOT, "data/topps-top.json"), "utf8"));
const facts = JSON.parse(await readFile(join(ROOT, "data/topps-sets.json"), "utf8"));
// The verified pictures. Written by scripts/sync-topps-images.mjs, which fetches
// every url and records the status; see this file's header. A missing file is a
// hard stop rather than a page that quietly loses its pictures again.
const pics = await readFile(join(ROOT, "data/topps-images.json"), "utf8")
  .then(JSON.parse)
  .catch(() => {
    throw new Error(
      "data/topps-images.json is missing. /topps.html is a guide to cards nobody\n" +
        "recognises and it must not ship without pictures of them.\n" +
        "Run: node scripts/sync-topps-images.mjs",
    );
  });
const picBy = new Map((pics.sets || []).map((s) => [s.release, s]));

const { verified: ok } = gradedGate(d, "data/topps-top.json", "scripts/verify-topps-top.mjs");

const read = longDate(d.checked);
const readShort = shortDate(d.checked);

// ---------------------------------------------------------------------------
// THE MAPPING CHECK. See the header for what it is evidence for and why six
// buckets deliberately carry no check at all.

const setBy = new Map(d.sets.map((s) => [s.console, s]));

function checkMapping() {
  const problems = [];
  let checked = 0;
  for (const rel of facts.releases) {
    for (const pc of rel.pcConsoles || []) {
      const got = setBy.get(pc.console);
      if (!got) {
        problems.push(
          `${rel.name}: data/topps-sets.json maps it to ${pc.console}, which is not a ` +
            `console in data/topps-top.json. Either the crawl no longer holds it or the path is wrong.`,
        );
        continue;
      }
      const e = pc.expect;
      if (!e) continue;
      checked += 1;
      const say = (what, want, have) =>
        problems.push(`${rel.name} -> ${pc.console}: expected ${what} ${want}, the crawl has ${have}`);
      if (e.rows != null && got.rows !== e.rows) say("rows", e.rows, got.rows);
      if (e.numbers != null && got.numbers !== e.numbers) say("distinct numbers", e.numbers, got.numbers);
      if (e.unnumbered != null && got.unnumbered !== e.unnumbered)
        say("unnumbered rows", e.unnumbered, got.unnumbered);
      if (e.numeric) {
        const n = got.numeric || {};
        for (const k of ["count", "min", "max"])
          if (e.numeric[k] != null && n[k] !== e.numeric[k]) say(`numeric ${k}`, e.numeric[k], n[k] ?? "none");
      }
      if (e.prefixes)
        for (const [p, n] of Object.entries(e.prefixes))
          if ((got.prefixes || {})[p] !== n) say(`${p}-prefixed numbers`, n, (got.prefixes || {})[p] ?? 0);
    }
  }
  if (problems.length) {
    throw new Error(
      `data/topps-sets.json maps PriceCharting's buckets onto Topps' releases and ` +
        `${problems.length} of those claims no longer hold against data/topps-top.json:\n  ` +
        problems.join("\n  ") +
        `\n\nDo NOT edit the \`expect\` blocks to match. They are the evidence that a bucket ` +
        `is the set it is labelled as, and tuning one until it passes is how this page ` +
        `starts describing the wrong set confidently. Work out what moved: a re-crawl ` +
        `picking up new rows, PriceCharting refiling a bucket, or the mapping simply ` +
        `being wrong. Then rewrite the claim and its evidence together.`,
    );
  }
  return checked;
}
const mappingChecks = checkMapping();

// ---------------------------------------------------------------------------
// THE TWO PUBLISHED HUNDREDS.
//
// A row is published in a list only if THAT LIST'S column was read twice and
// agreed. The row-level status the gate reads is not enough here, because this
// file has two ranking columns and a row can be sound in one and not the other;
// see the header of scripts/verify-topps-top.mjs. So each list filters on its
// own column's verdict, exactly as build-top100.mjs gates the two graded
// figures it prints beside a raw price.
//
// Ranks are the positions in the PUBLISHED list, 1 to 100 with no gaps, and how
// many candidates dropped out is said in words above each list. That is the
// same call /top-graded.html makes. Printing the source file's own index with
// visible gaps would claim to be a top 100 while showing 96 rows.

const byRank = new Map(d.cards.map((c) => [c.rank, c]));
const colOk = (rank, key) => ok.get(rank)?.cols?.[key]?.status === "agree";

const WANT = 100;
const buildList = (order, key) =>
  order
    .map((r) => byRank.get(r))
    .filter((c) => c && colOk(c.rank, key))
    .sort((a, b) => b[key] - a[key])
    .slice(0, WANT);

const rawList = buildList(d.rawOrder, "ungraded");
const psaList = buildList(d.psaOrder, "psa10");

// A figure that is not the list's own ranking column is printed only where its
// own column agreed, and where it did not the row says WHICH THING happened
// rather than showing a blank. An empty cell reads as a data gap; "no PSA 10
// value recorded" is an answer, and "our two reads did not agree" is a
// different answer, and the two must not be dressed up as each other.
const SAY = {
  none: (label) => `No ${label} value recorded for this card`,
  onesided: (label) => `Only one of our two reads found a ${label} value, so none is published`,
  disagree: (label) => `Our two reads of this card's ${label} value did not agree, so neither is published`,
  unreadable: (label) => `We could not read a ${label} value a second time, so none is published`,
};
function figure(c, key, label) {
  const status = ok.get(c.rank)?.cols?.[key]?.status || "unreadable";
  if (status === "agree" && c[key] != null)
    return `${moneyCompact(c[key])} <span class="tp-t">${esc(label)}</span>`;
  return `${noValue((SAY[status] || SAY.unreadable)(label), "tp-na")} <span class="tp-t">${esc(label)}</span>`;
}

// The source path, minus the host, which is stated once above each list. Per
// row rather than per page, because that is what makes an INDIVIDUAL figure
// checkable rather than the page as a whole.
const pathOf = (c) => c.url.replace(/^https?:\/\/(www\.)?pricecharting\.com/, "");

/** One row of either hundred. `key` is the column that list is ranked by. */
function row(c, i, key) {
  const src = scanSrc(c);
  // A row whose scan 404s says so in words. There is no placeholder card face:
  // a navy placeholder box on this site once read as a real card.
  const img = src
    ? `<img class="tp-scan" src="${esc(src)}" alt="${esc(c.name)}, ${esc(c.set)}" loading="lazy" decoding="async">`
    : `<span class="tp-noscan">No scan<span class="sr-only"> available for this card</span></span>`;

  // The ranked figure is the big one and the other two ride under it. Which one
  // is big depends on the list, which is the only difference between the two
  // tables and the reason one row function serves both.
  const lead = key === "ungraded" ? "ungraded" : "psa10";
  const leadLabel = key === "ungraded" ? "Ungraded" : "PSA 10";
  const rest =
    key === "ungraded"
      ? [["psa10", "PSA 10"], ["g9", "Grade 9"]]
      : [["ungraded", "Ungraded"], ["g9", "Grade 9"]];

  return `<li class="tp-row">
  <span class="tp-rank" aria-hidden="true">${i + 1}</span>
  <span class="sr-only">Number ${i + 1}.</span>
  <span class="tp-art">${img}</span>
  <span class="tp-body">
    <span class="tp-name">${esc(c.name)}</span>
    <span class="tp-set">${esc(c.set)}</span>
    <span class="tp-prices">
      <span class="tp-lead"><b>${moneyCompact(c[lead])}</b> <span class="tp-t">${esc(leadLabel)}</span></span>
      ${rest.map(([k, l]) => `<span class="tp-other">${figure(c, k, l)}</span>`).join("\n      ")}
    </span>
    <span class="tp-src">${esc(pathOf(c))} <span class="tp-t">read ${esc(readShort)}</span></span>
  </span>
</li>`;
}

// ---------------------------------------------------------------------------
// Numbers for the prose, all counted off the data rather than typed, because
// they are the kind of number that is right on the day it is written and wrong
// every day after.

const toppsOnRawTop100 = await (async () => {
  // How many rows of the SITE-WIDE raw hundred are Topps cards. This is the one
  // number behind Tim's "most don't realize how valuable they are", and it is
  // read off the published list rather than remembered: build-top100.mjs counts
  // it the same way for its own honesty block.
  try {
    const rawFile = JSON.parse(await readFile(join(ROOT, "data/top-raw.json"), "utf8"));
    const { verified } = gradedGate(rawFile, "data/top-raw.json", "scripts/verify-raw-top.mjs");
    return rawFile.cards
      .filter((c) => verified.get(c.rank)?.status === "agree")
      .slice(0, 100)
      .filter((c) => /\bTopps\b/i.test(c.set)).length;
  } catch {
    return null;
  }
})();

const releases = facts.releases;
const usSets = releases.filter((r) => !r.europeOnly);
const setYears = [...new Set(releases.map((r) => r.year))].sort();
const chromeNumbers = setBy.get("/console/pokemon-2000-topps-chrome");
// The four Chrome finishes, counted rather than listed from memory: the plain
// card has no bracket, the other three do.
const chromeFinishes = Object.entries(chromeNumbers?.printings || {}).filter(([, n]) => n >= 100);

const rawTop = rawList[0];
const psaTop = psaList[0];
const rawFloor = rawList[rawList.length - 1];
const psaFloor = psaList[psaList.length - 1];

// How many of each list came out of the Chrome bucket. Chrome dominates both
// and the page says so with a figure rather than an impression.
const chromeIn = (list) => list.filter((c) => c.console === "/console/pokemon-2000-topps-chrome").length;

// Rows on each list whose OTHER figures could not be published, so the copy can
// say how much of the detail survived instead of leaving a reader to wonder
// about the dashes.
const missing = (list, key) => list.filter((c) => !colOk(c.rank, key) || c[key] == null).length;

const v = d.verify || {};

// WHAT HAPPENED TO THE CANDIDATES THAT DID NOT CONFIRM, admitted rather than
// quietly missing, which is the same call /top-graded.html and /base-set.html
// make. The count above is not enough on its own: a reader who knows these
// cards will look for one and is owed the reason it is not there.
//
// THE EXCLUSION IS PER FIGURE, NOT PER ROW, AND THE SENTENCE HAS TO SAY SO.
// This file has two ranking columns, so a card whose Ungraded value could not
// be confirmed can still have a PSA 10 value that was confirmed twice, and it
// belongs on the second list. Saying "printed nowhere on this site" here, the
// way /top-graded.html can honestly say it, would be false: three of these six
// cards are on the other hundred. So the sentence names the COLUMN.
//
// EVERY PART OF EACH SENTENCE COMES OFF THE ENTRY rather than being written
// here, including the reason, so an exclusion made later for some other reason
// cannot inherit this one's explanation. No `public` string on an entry, no
// sentence at all: a vague admission would be worse than the bare count, which
// stands on its own either way. `excluded` has already been matched against the
// verification by shared/graded-gate.mjs, so by the time this runs every entry
// is known to describe a row that really did disagree.
const exc = d.excluded || [];
const excNote =
  !exc.length || exc.some((e) => !e.public || !e.column)
    ? ""
    : " The other " +
      (exc.length === 1 ? "one" : `${exc.length}`) +
      " are not dropped whole: it is one FIGURE on each that could not be confirmed, so each is off the list " +
      "ranked by that figure and still on the other one if its other column checked out. " +
      exc
        .map((e) => `${esc(e.name)}, ${esc(e.set)}, ${esc(e.column)}: ${esc(e.public)}`)
        .join(". ") +
      ".";

// Rows on either published list whose card scan 404s. Named as a count rather
// than assumed away, because an empty frame on a row is otherwise indis-
// tinguishable from a page fault.
const noScan = [...rawList, ...psaList].filter((c) => ok.get(c.rank)?.imgOk !== true);
const noScanRows = new Set(noScan.map((c) => c.rank)).size;

// ---------------------------------------------------------------------------
// Shared page furniture.

const head = (title, desc, slug, ogSlug) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/${slug}.html">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/${slug}.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-${ogSlug}.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-${ogSlug}.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}`;

const CSS = `
/* These two pages' own block rather than ui.css. ui.css is render blocking on
   every page on the site and these rules are used by two of them. */

/* THE PRICE ROW IS A GRID, NOT A TABLE, the same shape /top-graded.html uses
   and for the same reason: one card per row with four facts, where a real
   <table> would force three price columns that are empty on most rows and
   unreadable at 390px. Rank and scan are fixed columns; everything else is one
   flexible column that wraps inside itself. */
.tp-list{list-style:none;margin:20px 0 0;padding:0;border-top:1px solid var(--hair)}
.tp-row{display:grid;grid-template-columns:2.4em 64px 1fr;gap:12px;align-items:start;
  padding:14px 0;border-bottom:1px solid var(--hair)}
.tp-rank{font-family:var(--mono);font-size:15px;font-weight:700;
  color:var(--ink-2);text-align:right;padding-top:2px;font-variant-numeric:tabular-nums}
.tp-art{width:64px;height:90px;display:flex;align-items:center;justify-content:center;
  background:var(--paper-3);border:1px solid var(--hair);border-radius:3px;overflow:hidden}
/* Fixed box, object-fit, and NO width/height on the img. These scans are a
   fixed 240 HIGH and a variable width, so a declared width is wrong for most of
   them. Same treatment tcgplayer-cdn already gets in shared/format.mjs. */
.tp-scan{max-width:100%;max-height:100%;width:auto;height:auto;display:block}
.tp-noscan{font-family:var(--mono);font-size:10px;color:var(--ink-2);
  text-align:center;line-height:1.3;padding:4px}
.tp-body{min-width:0}
.tp-name{display:block;font-weight:700;line-height:1.25}
.tp-set{display:block;color:var(--ink-2);font-size:var(--t-sm);margin-top:1px}
.tp-prices{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:7px;align-items:baseline}
.tp-lead b{font-size:19px;font-variant-numeric:tabular-nums}
.tp-other{color:var(--ink-2);font-size:var(--t-sm);font-variant-numeric:tabular-nums}
/* The unit label. Small, muted, and never the same weight as the figure: the
   number is the fact and the grade is the caption. */
.tp-t{font-family:var(--mono);font-size:10px;text-transform:uppercase;
  letter-spacing:.04em;color:var(--ink-2)}
.tp-na{color:var(--ink-2)}
/* THE PROVENANCE LINE. Plain text, never a link, which is the call
   /top-graded.html makes and the one this page follows; the argument and the
   open question behind it are in this file's header. The path is enough to find
   the record and it is per row rather than per page, because that is what makes
   an individual figure checkable. word-break because the longest of these runs
   past a phone's width. */
.tp-src{display:block;margin-top:6px;font-family:var(--mono);
  font-size:11px;line-height:1.45;color:var(--ink-2);word-break:break-word}

@media (min-width:560px){
  .tp-row{grid-template-columns:3em 84px 1fr;gap:16px;padding:16px 0}
  .tp-art{width:84px;height:118px}
  .tp-rank{font-size:17px}
  .tp-name{font-size:18px}
}
/* Desktop puts the prices in their own column instead of under the name, so the
   eye can run down the ranked figures without the set names in the way. Grid
   AREAS rather than reordered markup, so the DOM order is untouched: name, set,
   prices, source is the right reading order on a phone and the right order for
   a screen reader at every width, and only the painting changes. */
@media (min-width:900px){
  .tp-row{grid-template-columns:3em 100px 1fr;align-items:center}
  .tp-art{width:100px;height:140px}
  .tp-body{display:grid;column-gap:24px;
    grid-template-columns:1fr minmax(190px,auto);
    grid-template-areas:"name prices" "set prices" "src prices"}
  .tp-name{grid-area:name}
  .tp-set{grid-area:set}
  .tp-src{grid-area:src;align-self:end}
  .tp-prices{grid-area:prices;margin-top:0;align-self:center;
    flex-direction:column;align-items:flex-end;gap:2px;text-align:right}
  .tp-lead b{font-size:22px}
}

/* ---------------------------------------------------------------------------
   THE GUIDE PAGE. */

/* One release per card. NOT a table: the widest thing on a release is a
   sentence of breakdown, and a table would either clip it or set five columns
   of ragged text at 390px. */
.tp-sets{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:10px}
@media (min-width:820px){.tp-sets{grid-template-columns:1fr 1fr}}
.tp-set-card{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-sm);
  padding:14px 16px}
.tp-set-card h3{margin:0;font-size:var(--t-body);font-family:var(--body);font-weight:700;line-height:1.25}
.tp-when{display:block;font-family:var(--mono);font-size:var(--t-micro);
  letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2);margin-top:4px}
.tp-set-card p{margin:8px 0 0;font-size:var(--t-sm);color:var(--ink-2);line-height:1.5}
.tp-count{font-weight:700;color:var(--ink)}
/* The chip that says a set was Europe only, or that it is the last one. Same
   weight as the date line above it: it is a label, not a headline. */
.tp-chip{display:inline-block;font-family:var(--mono);font-size:var(--t-micro);
  letter-spacing:.04em;text-transform:uppercase;background:var(--chip-gold-bg);
  color:var(--ink);border-radius:var(--r-pill);padding:2px 8px;margin-top:8px}
/* Where PriceCharting files this set's cards. Small, monospaced, and it wraps:
   one release can be six buckets. */
.tp-buckets{margin:10px 0 0;padding:0;list-style:none;font-family:var(--mono);
  font-size:var(--t-micro);color:var(--ink-2);line-height:1.6}
.tp-buckets li{word-break:break-word}

/* The explainer grids: printings, card types, and the tells. One shape for all
   three because they are the same object, a short name and a paragraph. */
.tp-defs{display:grid;gap:10px;margin-top:var(--s4)}
@media (min-width:760px){.tp-defs{grid-template-columns:1fr 1fr}}
/* min-width:0 IS LOAD BEARING AND IT WAS MISSING. A grid item's default minimum
   is its MIN-CONTENT width, so one unbreakable string inside a card widens the
   whole track and then the whole page. Measured at 390x844 before this line:
   documentElement.scrollWidth 434 against a clientWidth of 390, caused by the
   45 character methodology url in the <code> below, which at 0.85em min-contents
   to 387.7px inside a 366px wrap. Every heading and paragraph in the section
   inherited the blown track and measured 391.8 wide.
   THE PAGE STILL DID NOT SCROLL SIDEWAYS, which is why this needed looking for
   rather than reporting itself: scrollTo(400,0) left scrollX at 0 both before
   and after. scrollWidth alone is not proof of a horizontal scroll and is not
   treated as such anywhere on this site, but 44px of content hanging off the
   right edge is a real fault whether or not the document scrolls to meet it. */
.tp-defs>div{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-sm);
  padding:12px 14px;min-width:0}
.tp-defs h3{margin:0 0 4px;font-size:var(--t-body);font-family:var(--body);font-weight:700}
.tp-defs p{margin:0;font-size:var(--t-sm);color:var(--ink-2);line-height:1.5}
/* break-all rather than break-word, the same rule .t100-src code keeps: a url
   has no spaces to break at, so break-word finds nowhere to go and leaves the
   string whole. */
.tp-defs code{font-family:var(--mono);font-size:.85em;word-break:break-all}
.tp-defs .tp-cite{display:block;margin-top:6px;font-family:var(--mono);font-size:var(--t-micro);
  color:var(--ink-2);word-break:break-word}

/* The five-row teaser on the guide page. A list, not the full table: the point
   is to show what the ceiling looks like and send the reader to the page that
   holds the working. */
.tp-peek{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:6px}
.tp-peek li{display:flex;gap:10px;align-items:baseline;background:var(--card);
  border:1px solid var(--hair);border-radius:var(--r-sm);padding:9px 12px}
.tp-peek .n{font-family:var(--mono);font-size:var(--t-sm);color:var(--ink-2);
  font-variant-numeric:tabular-nums;min-width:1.6em}
.tp-peek .w{flex:1;min-width:0;font-weight:600;line-height:1.3}
.tp-peek .w small{display:block;font-weight:400;font-size:var(--t-label);color:var(--ink-2)}
.tp-peek .m{font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:700}

/* ---------------------------------------------------------------------------
   THE PICTURES. The guide page had none at all until 18 August 2026.

   EVERY FRAME IS A FIXED BOX AND THE PICTURE IS CENTRED INSIDE IT. PriceCharting
   serves these files at a fixed 240 HIGH and a VARIABLE width, which is why
   imgDims() in shared/format.mjs correctly returns "" for this host and why
   nothing here carries width or height: a declared width would be wrong for most
   of them, by up to a third. A box the stylesheet owns is what keeps CLS at 0
   without the markup claiming pixel sizes it does not know. Measured 0.000 at
   390x844 and 1440x900 with all 32 pictures forced to load. */
.tp-frame{display:flex;align-items:center;justify-content:center;overflow:hidden;
  background:var(--paper-3);border:1px solid var(--hair);border-radius:3px}
.tp-frame img{max-width:100%;max-height:100%;width:auto;height:auto;display:block}
/* The caption under a picture. It names the exact card or product in VISIBLE
   text, not only in the alt, which is the rule shared/product-photos.mjs sets
   out: a photograph with no visible name is quietly claiming to be a category. */
.tp-cap{display:block;margin-top:5px;font-family:var(--mono);font-size:var(--t-micro);
  line-height:1.4;color:var(--ink-2)}
.tp-cap b{color:var(--ink);font-weight:700}

/* THE HERO CARD IS THE ONE PICTURE ON THIS PAGE THAT IS NOT LAZY, on purpose.
   loading="lazy" is a VERTICAL heuristic and nothing else, so on a phone, where
   this sits inside the first screen, it buys nothing and delays the only thing
   the page opens with. 13.2KB. */
/* CENTRED AND STACKED AT EVERY WIDTH, which is not what this was first written
   as. ui.css sets .set-hero .wrap to display:flex, flex-direction:column,
   align-items:center and text-align:center at specificity 0,2,0, so a
   .tp-hero-grid rule here at 0,1,0 lost silently and the desktop
   two-column hero simply never rendered: the markup was right, the rule was
   right, and it was not applying. It could have been won with a longer selector
   and was not, because a card centred under centred copy is the hero every other
   guide on this site has and there was no reason for this one to be different.
   The caption gets a measure of its own so it does not set to the card's width. */
.tp-hero-fig{margin:18px auto 0;width:min(100%,320px)}
.tp-hero-fig .tp-frame{width:150px;height:210px;margin:0 auto}
@media (min-width:820px){
  .tp-hero-fig{margin:22px auto 0;width:min(100%,420px)}
  .tp-hero-fig .tp-frame{width:200px;height:280px}
}

/* One card and, where there is one, one packaging photograph per RELEASE. Two
   small frames in a row at the top of the set card, so the pictures read as
   belonging to the set named under them and the paragraph still runs the full
   width of the card. */
.tp-set-pics{display:flex;gap:10px;margin:12px 0 2px}
.tp-pic{margin:0;width:82px;flex:none}
.tp-pic .tp-frame{width:82px;height:115px}

/* The five-row summaries. Same fixed frame as a full row on the values page,
   one size down: these are a teaser for a list of 100, not the list. */
.tp-peek li{align-items:center}
.tp-peek .p{flex:none}
.tp-peek .p .tp-frame{width:44px;height:62px}

/* THE SIDE BY SIDE, and it is the one place on this page where a picture is not
   an illustration but the argument itself. Two frames, same box, same Pokemon,
   same year: prose can say "one has HP and an attack and the other has a screen
   still" all day and a reader still has to see it. aspect-ratio rather than a
   height, because these two hosts serve different intrinsic sizes and the frame
   has to be the same shape on both sides for the comparison to be fair. */
.tp-vs{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:var(--s4);max-width:44em}
@media (min-width:560px){.tp-vs{gap:24px}}
.tp-vs figure{margin:0;min-width:0}
.tp-vs .tp-frame{width:100%;aspect-ratio:5 / 7}
.tp-vs figcaption{margin-top:9px;font-size:var(--t-sm);line-height:1.45;color:var(--ink-2)}
.tp-vs figcaption b{display:block;color:var(--ink);font-family:var(--mono);
  font-size:var(--t-micro);letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px}

/* ui.css draws .fk-golden full bleed inside the wrap, which is right for the
   two or three sentences most pages put in one. These hold several paragraphs,
   and at 1440 that ran the text to about 700px inside a 1392px black box.
   Capped to a measure instead, exactly as build-top100.mjs caps its own. */
.fk-golden{max-width:58em}
`;

// ---------------------------------------------------------------------------
// PAGE ONE: /topps.html, the guide.

// NO DASH IN HERE. The obvious separator between a bucket name and what it
// holds is an em dash and this line used one, which is a site-wide copy rule
// broken in the one place a rule-checker would not look: generated markup
// rather than a written sentence. Thirty-six of them went onto the guide page.
// A colon does the same job. The only em dashes on either of these pages now
// are noValue() placeholders, each of which carries its own sr-only sentence,
// which is the documented exception.
const bucketLine = (pc) => {
  const got = setBy.get(pc.console);
  const name = pc.console.replace("/console/pokemon-", "");
  const size = got ? `${got.rows} priced rows` : "not in our crawl";
  return `<li>${esc(name)}: <span style="opacity:.7">${esc(pc.is)}, ${esc(size)}</span></li>`;
};

// `covers` is a sentence a human wrote and one of them ends in a full stop
// already, which printed "the last Topps Pokemon set..". Trailing punctuation is
// stripped rather than the data being made to follow a rule nobody would
// remember while writing prose.
const noDot = (s) => String(s).replace(/[.\s]+$/, "");

// ---------------------------------------------------------------------------
// THE PICTURE HELPERS. ONE place decides whether a picture may be emitted, so a
// url that is known to be dead cannot reach the page through a second path.
// `ok` means sync-topps-images.mjs FETCHED that file and got a 200 with a real
// image body; `imgOk` is the same promise made by verify-topps-top.mjs for the
// row scans. Anything else emits NOTHING: no frame, no placeholder, no onerror.
// A reader should never pay a round trip to discover a picture we already knew
// was gone, and a grey placeholder box on this site has read as a real card
// before now.

/** The 240 rendition of a ranked row's scan, or null. Shared by the rows and
    the five-row summaries so the two cannot disagree about which have one. */
const scanSrc = (c) => (ok.get(c.rank)?.imgOk && c.pcImg ? c.pcImg.replace(/\/\d+\.jpg$/, "/240.jpg") : null);

const frame = (img) => `<span class="tp-frame">${img}</span>`;

/** A verified PriceCharting picture. NO width or height: see the CSS block. */
function pcPic(p, alt, { lazy = true } = {}) {
  if (!p || !p.ok || !p.img) return "";
  return `<img src="${esc(p.img)}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ""} decoding="async">`;
}

/** Framed picture plus a caption that NAMES what is in it in visible text, not
    only in the alt. Same rule shared/product-photos.mjs sets out: a photograph
    with no visible name is quietly claiming to be a whole category. */
const figureOf = (img, cap, cls) =>
  img ? `<figure class="${cls}">${frame(img)}<figcaption class="tp-cap">${cap}</figcaption></figure>` : "";

/** The card, and the packaging where PriceCharting holds a photograph of one.
    A release with neither gets no strip at all rather than an empty frame. */
function setPics(r) {
  const p = picBy.get(r.id);
  if (!p) return "";
  const card = figureOf(
    pcPic(p.card, p.card ? `${p.card.name}, a Topps card from ${r.name}, ${r.released}` : ""),
    p.card ? `<b>${esc(p.card.name)}</b>` : "",
    "tp-pic",
  );
  const pack = figureOf(
    pcPic(p.pack, p.pack ? `${p.pack.name}: the sealed packaging ${r.name} was sold in` : ""),
    p.pack ? `<b>${esc(p.pack.name)}</b>` : "",
    "tp-pic",
  );
  return card || pack ? `<div class="tp-set-pics">${card}${pack}</div>` : "";
}

const setCard = (r) => `<li class="tp-set-card">
  <h3>${esc(r.name)}</h3>
  <span class="tp-when">${esc(r.released)} &bull; <span class="tp-count">${r.base} cards</span> in the base set</span>
  ${setPics(r)}
  <p>${esc(noDot(r.breakdown))}. ${esc(noDot(r.covers))}.</p>
  ${r.alsoKnown ? `<p>Also written as ${esc(r.alsoKnown)}.</p>` : ""}
  ${r.europeOnly ? `<span class="tp-chip">Europe only</span>` : ""}
  ${
    (r.pcConsoles || []).length
      ? `<ul class="tp-buckets">${(r.pcConsoles || []).map(bucketLine).join("")}</ul>`
      : `<p>PriceCharting holds no bucket for this one, so none of its cards are priced on this site.</p>`
  }
</li>`;

const defCard = (name, what, source) => `<div>
  <h3>${esc(name)}</h3>
  <p>${esc(what)}</p>
  ${source ? `<span class="tp-cite">${esc(source.replace(/^https?:\/\//, ""))}</span>` : ""}
</div>`;

// THE SUMMARY ROWS SHOW THE CARD. They used to be five names and five figures,
// on a page whose whole argument is that nobody would recognise the names.
const peek = (list, key, label) =>
  `<ol class="tp-peek">${list
    .slice(0, 5)
    .map((c, i) => {
      const src = scanSrc(c);
      const art = src
        ? `<span class="p">${frame(
            `<img src="${esc(src)}" alt="${esc(c.name)}, ${esc(c.set)}" loading="lazy" decoding="async">`,
          )}</span>`
        : "";
      return `<li><span class="n">${i + 1}</span>${art}<span class="w">${esc(c.name)}<small>${esc(
        c.set,
      )}</small></span><span class="m">${moneyCompact(c[key])}</span></li>`;
    })
    .join("")}</ol>
  <p class="price-note">${esc(label)} PriceCharting price guide values read ${esc(read)}, each read a second time
    from the card's own product page before it was printed. <a href="/topps-card-values.html">All 100, and the
    other hundred ranked the other way</a>.</p>`;

// ---------------------------------------------------------------------------
// THE SIDE BY SIDE. The one section on this page where a picture is not an
// illustration of the argument, it IS the argument: "a Topps card has a screen
// still and no HP, a TCG card has an illustration and a whole game on it" is a
// sentence a reader has to take on trust until they see the two next to each
// other.
//
// BOTH ARE CHARIZARD AND BOTH ARE 1999, deliberately. Hold the Pokemon and the
// year still and the only thing left varying is the thing being compared. Base
// Set Charizard is also the one Pokemon card a complete stranger has heard of,
// and it is the same TCGdex scan /base-set.html already uses.
//
// The TCG half is the only picture on either page that CAN carry width and
// height, because TCGdex serves a fixed 600x825 and imgDims() knows it. It also
// gets avifPicture(), which is 37% smaller for identical pixels at this width.
// The Topps half gets neither, for the reason in the CSS block above.
const versus = (() => {
  const t = pics.compare?.topps;
  const g = pics.compare?.tcg;
  if (!t?.ok || !g) return "";
  const toppsImg = pcPic(
    t,
    `${t.name}, a Topps trading card: a still of Charizard from the anime printed on plain card ` +
      `stock, with no HP, no attack and no energy cost anywhere on it`,
  );
  const tcgTag =
    `<img src="${esc(g.url)}" alt="Pokemon TCG ${esc(g.set)} ${esc(g.name)}, card ${esc(g.number)} of ` +
    `${esc(g.total)}: an illustration of Charizard with HP at the top, an attack with an energy cost, ` +
    `a retreat cost and an illustrator credit" loading="lazy" decoding="async"${imgDims(g.url)}>`;
  return `<div class="tp-vs">
      <figure>
        ${frame(toppsImg)}
        <figcaption><b>Topps, 1999</b>${esc(t.name)}, from ${esc(usSets[0].name)}. A frame from the
          cartoon on card stock. No HP, no attack, no energy cost, no retreat cost: nothing on it belongs
          to a game. Turn it over and the back is a Pokedex entry with the Topps logo under it.</figcaption>
      </figure>
      <figure>
        ${frame(avifPicture(tcgTag))}
        <figcaption><b>Pokemon TCG, 1999</b>${esc(g.set)} ${esc(g.name)}, card ${esc(g.number)} of
          ${esc(g.total)}. Commissioned artwork rather than a screen grab, HP in the top corner, an attack
          with an energy cost beside it, a retreat cost at the foot and the illustrator's name on it. The
          back is the blue Poke Ball pattern, the same on every card in the game.</figcaption>
      </figure>
    </div>`;
})();

const guideTitle = "Topps Pokemon Cards: Every Set, and How to Spot One";
const guideDesc =
  `Topps printed Pokemon trading cards from ${facts.window.from} to ${facts.window.to}: ${releases.length} sets, ` +
  `the two movie sets, and the Chrome cards that now sell for thousands. What they are, why they are not ` +
  `Pokemon TCG cards, every set with its year and card count, and how to tell one in your hand.`;

const guide = `${head(guideTitle, guideDesc, "topps", "topps")}
<style>${CSS}</style>
</head>
<body>
${SKIP}
${SPRITE}
${BAR}
${MENU}
<main id="main">

<header class="set-hero">
  <div class="wrap">
    <div>
      <span class="kicker">Topps trading cards &bull; ${esc(facts.window.from)} to ${esc(facts.window.to)}</span>
      <h1>Topps made <span class="hl">Pokemon cards</span> too</h1>
      <p class="lede" style="max-width:42em">Not Pokemon TCG cards. Trading cards: anime stills and film frames on
        card stock, ${releases.length} sets of them between ${esc(facts.window.from)} and ${esc(facts.window.to)}, and
        most people who collect Pokemon have never knowingly held one. Some of them are worth more than the cards
        everybody does know about.</p>
    </div>
    ${
      pics.hero?.ok
        ? `<figure class="tp-hero-fig">
      ${frame(
        pcPic(
          pics.hero,
          `${pics.hero.name}, a Topps trading card from ${usSets[0].name}, ${usSets[0].released}: a still of ` +
            `Pikachu from the anime printed on card stock`,
          { lazy: false },
        ),
      )}
      <figcaption class="tp-cap"><b>${esc(pics.hero.name)}</b> from ${esc(usSets[0].name)},
        ${esc(usSets[0].released)}. This is a Topps card, not a Pokemon TCG card.</figcaption>
    </figure>`
        : ""
    }
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Topps Pokemon cards</p>

    <div class="fk-golden">
      <p class="fk-golden-h">First, the thing that trips everybody up</p>
      <h2>These are trading cards, <span class="hl">not</span> game cards</h2>
      <p>Bulbapedia puts it in one line: <b>"${esc(facts.notTcg.quote)}"</b> Topps is a trading card company. It
        made cards <em>of</em> Pokemon, licensed, for people to collect and swap. It never made a card you could
        put on a table and play with.</p>
      <p>Which is why the fastest check is to turn one over. A Pokemon TCG card back is the blue Poke Ball
        pattern, the same on every card in the game, and the front carries HP, an attack, an energy cost and a
        retreat cost. A Topps card back carries a Pokedex entry or a summary of the episode the picture came
        from, with the Topps logo under it. There is nothing on it to play with. That last part follows from the
        line above rather than being quoted from anywhere, and it is written that way on purpose: no source we
        found spells the list out, but a card that was never made for the game was never going to carry it.</p>
      <p>The confusion is understandable and it is worth naming. Both came out at the same time, both are
        Pokemon, both were sold in packs in the same shops in 1999, and both are the standard trading card
        shape. Only one of them is a game.</p>
    </div>

    <div class="facts" style="margin-top:20px">
      <div class="fact"><div class="n">${releases.length}</div><div class="l">Topps Pokemon sets, ${setYears[0]} to ${setYears[setYears.length - 1]}</div></div>
      <div class="fact"><div class="n">${d.scanned.productsWithUngraded.toLocaleString("en-US")}</div><div class="l">Topps listings with a price on them</div></div>
      <div class="fact"><div class="n">${moneyCompact(rawTop.ungraded)}</div><div class="l">Top raw value, ${esc(rawTop.name)}</div></div>
      <div class="fact"><div class="n">${moneyCompact(psaTop.psa10)}</div><div class="l">Top PSA 10 value, ${esc(psaTop.name)}</div></div>
    </div>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Why this page exists</p>
    <h2>Nobody talks about them and <span class="hl">some are worth thousands</span></h2>
    <p class="lede" style="max-width:44em">This is not a hunch and it is checkable on this site in about ten
      seconds.${
        toppsOnRawTop100
          ? ` Our list of <a href="/most-valuable-cards.html">the 100 most valuable raw Pokemon cards</a> ranks
      every Pokemon card PriceCharting prices, in every language, and <b>${toppsOnRawTop100} of those hundred rows
      are Topps cards</b>. Anybody who has read that page has already scrolled past ${toppsOnRawTop100} of them.`
          : ""
      }</p>
    <p style="max-width:44em">The reason is roughly this. Topps' cards were treated as the cheap ones at the
      time, because the game cards were the ones with a game attached, so far fewer were kept in sleeves and far
      fewer have ever been graded. The Chrome sets are the extreme case: chromium stock, heavily embossed, thick,
      four different finishes of every card, and a coating that makes them stick together in a pack. That is a
      card which was hard to pull out of a pack undamaged in 2000 and is hard to find in a high grade now.</p>
    <p style="max-width:44em">What this page will not tell you is how hard any of them were to pull. Topps
      published insert odds for some of these sets and we deliberately did not record them. This site never
      states pull rates for anything.</p>

    <h3 style="margin-top:26px">The five most valuable raw, right now</h3>
    ${peek(rawList, "ungraded", "Ungraded")}

    <h3 style="margin-top:26px">The five most valuable in a PSA 10</h3>
    ${peek(psaList, "psa10", "PSA 10")}
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The sets</p>
    <h2>All ${releases.length}, in the order they <span class="hl">came out</span></h2>
    <p class="lede" style="max-width:44em">Set names, dates and card counts are Bulbapedia's, one page per set,
      linked at the foot of this page. Card counts are the BASE set: the chase and insert cards are extra and are
      described further down. The grey lines under each set are where PriceCharting files those cards, which is
      not the same thing at all, and the next section is about why.</p>
    <ol class="tp-sets">
${usSets.map(setCard).join("\n")}
    </ol>
    ${
      releases.some((r) => r.europeOnly)
        ? `<h3 style="margin-top:26px">And one that never came to the States</h3>
    <ol class="tp-sets">
${releases.filter((r) => r.europeOnly).map(setCard).join("\n")}
    </ol>`
        : ""
    }
    ${
      facts.neverReleased
        ? `<p class="price-note" style="margin-top:var(--s4)"><b>${esc(facts.neverReleased.name)} is not on that list
      and should not be on anybody's.</b> ${esc(facts.neverReleased.what)}</p>`
        : ""
    }
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>A trap worth knowing</p>
    <h2>Topps shipped ${releases.length} sets. Price guides list <span class="hl">${d.scanned.consoles}</span></h2>
    <p class="lede" style="max-width:44em">If you look these cards up anywhere that prices them, you will meet
      set names Topps never used. That is not an error, it is a different way of filing the same cards, and
      knowing which one you are reading saves a lot of confusion.</p>
    <p style="max-width:44em">Topps filed by RELEASE: one set, shipped on one date, containing its base cards
      and its chase cards. PriceCharting files by CARD TYPE: a set's die cut chase run gets its own bucket, its
      stickers get another, and where two Topps sets shared a card type the two are merged into one bucket.
      "2000 Topps TV Heroes &amp; Villians" is the clearest case. It holds HV1 to HV17, which is series 2's five
      Heroes &amp; Villains cards plus series 3's twelve, and Topps never released a set by that name.</p>
    <p style="max-width:44em">So on this site the set list above is Topps' own, and the grey lines under each
      one say which price guide buckets those cards ended up in. ${mappingChecks} of those ${
        releases.reduce((n, r) => n + (r.pcConsoles || []).length, 0)
      } claims are re-checked
      every time this page is built, against the card numbers in our own copy of the crawl: the build stops if,
      say, the Orange Islands bucket stops holding exactly 19 OR-numbered cards, or the Chrome bucket stops
      holding exactly 151 numbers. The ones with no check next to them are the ones where our count and
      Bulbapedia's did not line up exactly, and no check was invented to make them agree.</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What the subsets are</p>
    <h2>Chrome, die cut, stickers and the <span class="hl">film frames</span></h2>
    <p class="lede" style="max-width:44em">Most Topps sets are a base run plus several kinds of chase card, and
      the chase cards are where nearly all the money is. These are the ones you will meet.</p>
    <div class="tp-defs">
${facts.types.map((t) => defCard(t.name, t.what, t.source)).join("\n")}
    </div>

    <h3 style="margin-top:30px">And the parallels, which are the same card printed a different way</h3>
    <p style="max-width:44em">A parallel is not a different card, it is the same card number with a different
      finish, and it is why one set can hold four rows for one Pokemon. ${
        chromeNumbers
          ? `The Chrome bucket is the extreme: <b>${chromeNumbers.numbers} card numbers</b> and
      <b>${chromeNumbers.rows} priced rows</b>, because every number exists as a plain Chrome card and as
      ${chromeFinishes.map(([n]) => esc(n)).join(", ")}. ${chromeNumbers.numbers} times four is exactly
      ${chromeNumbers.rows}.`
          : ""
      } The word in square brackets in a card's name on a price guide is the finish.</p>
    <div class="tp-defs">
${facts.printings.map((p) => defCard(p.tag, p.what, p.source)).join("\n")}
    </div>
    ${
      facts.printings.find((p) => p.scarcityQuote)
        ? `<p class="price-note" style="margin-top:var(--s4)">On Tekno specifically, the collectibles press has
      written that it is <b>"${esc(facts.printings.find((p) => p.scarcityQuote).scarcityQuote)}"</b> That is hobby
      press rather than a Topps statement, so treat it as somebody's reporting. What is not in doubt is the
      arithmetic on this page: Tekno cards take ${esc(String(rawList.filter((c) => /\[Tekno\]/.test(c.name)).length))}
      of the ${rawList.length} places on the raw hundred, over on
      <a href="/topps-card-values.html">the values page</a>.</p>`
        : ""
    }
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>In your hand</p>
    <h2>How to tell a Topps card from a <span class="hl">real TCG card</span></h2>
    <p class="lede" style="max-width:44em">Here they are next to each other. Same Pokemon, same year, and only
      one of them is a game card.</p>
    ${versus}
    <h3 style="margin-top:30px">Every check, in words</h3>
    <p style="max-width:44em">Any one of these settles it. The first one settles it fastest.</p>
    <div class="tp-defs">
${facts.tells.map((t) => defCard(t.tell, t.detail, t.source)).join("\n")}
    </div>
    <p class="price-note" style="margin-top:var(--s4)"><b>One thing that does not work: ${esc(
      facts.notATell.tell.toLowerCase(),
    )}.</b> ${esc(facts.notATell.detail)}</p>
    <p style="max-width:44em;margin-top:var(--s4)">If what you are actually asking is whether a card is real at
      all, that is a different question and it has its own page: <a href="/fake-cards.html">eight checks for
      spotting a counterfeit</a>. A genuine Topps card is not a fake Pokemon card. It is a real card of a
      different kind.</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Where to go next</p>
    <h2>The prices, and the rest of the <span class="hl">site</span></h2>
    <p class="lede" style="max-width:44em"><a href="/topps-card-values.html">Topps card values</a> holds both
      hundreds in full, ranked raw and ranked by PSA 10, with the source path on every row and the date they
      were read.</p>
    <p style="max-width:44em">Elsewhere: <a href="/most-valuable-cards.html">the 100 most valuable raw Pokemon
      cards</a> and <a href="/top-graded.html">the 100 highest PSA 10 values</a> rank everything, Topps included,
      against the whole catalogue. <a href="/expansions.html">Every English set</a> and
      <a href="/sets/">the set guides</a> cover the actual card game. <a href="/grading.html">Is it worth
      grading?</a> does the subtraction on raw against graded prices, which is the question these two lists
      raise on nearly every row. And <a href="/lore.html">Pokemon lore</a> and
      <a href="/video-games.html">every Pokemon video game</a> are the other two pages here that are about
      Pokemon rather than about cards.</p>

    <h2 style="margin-top:30px">Where all of this came from</h2>
    <p style="max-width:44em"><b>Set names, dates, card counts and what each subset is:</b> Bulbapedia, read
      ${esc(longDate(facts.read) || facts.read)}. One page per set, and each set card above names the one it came
      from. Thanks to them for keeping it.</p>
    <p style="max-width:44em"><b>Prices, card scans and the packaging photographs:</b> pricecharting.com, read
      ${esc(read)}, methodology published at their /page/methodology. Every priced row on the values page carries
      its own path on that site. The pack and box photographs are theirs as well, and they are the reason this
      page can show you what a 1999 Topps wrapper looked like at all: nothing else we could reach has one.
      ${releases.length - pics.sets.filter((x) => x.pack).length} of the ${releases.length} sets have no
      packaging photograph in their catalogue, and those show a card and say nothing about packaging rather
      than borrowing a picture from a set next to them. Every picture on this page was fetched and checked
      before it was published.</p>
    <p style="max-width:44em"><b>The Pokemon TCG card in the comparison:</b> TCGdex
      (assets.tcgdex.net), which is where the card scans on this site's set guides come from.</p>
    <p style="max-width:44em"><b>Not sourced, and therefore not said here:</b> who Topps signed the Pokemon
      licence with, how many of anything was printed, what a pack cost, and any odds of pulling anything.</p>
    <p style="max-width:44em">Card images are the property of their respective owners and appear here for
      identification. Pokemon and all card artwork are trademarks of The Pokemon Company, Nintendo, Game Freak
      and Creatures Inc. Topps is a trademark of its owner. This is a fan page and none of them are involved
      in it.</p>
  </div>
</section>

</main>
${footer()}
${APP_JS}
</body>
</html>
`;

// ---------------------------------------------------------------------------
// PAGE TWO: /topps-card-values.html, the two hundreds.

const valuesTitle = `Topps Pokemon Card Values from PriceCharting, Read ${readShort}`;
const valuesDesc =
  `The ${rawList.length} most valuable Topps Pokemon cards ungraded and the ${psaList.length} highest PSA 10 values, ` +
  `ranked from PriceCharting's price guide across ${d.scanned.products.toLocaleString("en-US")} Topps products ` +
  `and read on ${readShort}. Every figure read twice. Not auction records, and prices move.`;

const listHead = (id, title, kicker, lede) => `
    <p class="sec-label" id="${id}"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>${esc(kicker)}</p>
    <h2>${title}</h2>
    <p class="lede" style="max-width:44em">${lede}</p>`;

const values = `${head(valuesTitle, valuesDesc, "topps-card-values", "topps-card-values")}
<style>${CSS}</style>
</head>
<body>
${SKIP}
${SPRITE}
${BAR}
${MENU}
<main id="main">

<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Topps trading cards &bull; Ungraded and PSA 10, priced by PriceCharting &bull; Read ${esc(read)}</span>
    <h1>Topps Pokemon card values: <span class="hl">two</span> top 100s</h1>
    <p class="lede" style="max-width:42em">The same ${d.scanned.products.toLocaleString("en-US")} Topps cards
      ranked twice, because raw and graded do not give the same answer and it is not close. The most valuable loose
      Topps card is ${esc(rawTop.name)}; the highest PSA 10 value is ${esc(psaTop.name)}, which does not make the
      top ${rawList.length} raw at all. Both read on ${esc(read)}.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / <a href="/topps.html">Topps Pokemon cards</a> / Values</p>

    <div class="fk-golden">
      <p class="fk-golden-h">What these numbers are</p>
      <h2>A price guide value, not an <span class="hl">auction record</span></h2>
      <p>Every figure here is PriceCharting's own price guide, the <b>Ungraded</b> column for the first hundred
        and the <b>PSA 10</b> column for the second, read on <b>${esc(read)}</b>. Their published method computes
        it from completed eBay sales plus their own marketplace, blending the most recent sale, the median, the
        average and an age weighted average, with outliers and sale dates taken into account. Shipping is
        excluded. It is an estimate of what a copy is worth right now. It is not a live listing, it is not any
        one sale, and it is not an appraisal.</p>
      <p><b>These are Topps cards, which are not Pokemon TCG cards.</b> They are trading cards of Pokemon:
        anime and film stills on card stock, made under licence between ${esc(facts.window.from)} and
        ${esc(facts.window.to)}, with nothing on them to play a game with. PriceCharting files and prices them
        under Pokemon, which is why they can be ranked here at all.
        <a href="/topps.html">What they are, every set, and how to spot one</a> is the guide.</p>
      <p><b>${esc(String(chromeIn(rawList)))} of the raw hundred and ${esc(String(chromeIn(psaList)))} of the
        PSA 10 hundred are Chrome cards</b>, out of ${releases.length} Topps sets. That is not a thumb on the
        scale, it is what the data says: the two Chrome sets are a small part of the catalogue and nearly all of
        the top of it.</p>
      <p><b>An empty grade cell is an answer, not a gap.</b> ${esc(String(missing(rawList, "psa10")))} rows of
        the raw hundred carry no PSA 10 figure and ${esc(String(missing(rawList, "g9")))} carry no Grade 9
        figure. This guide prices from completed sales, so a card nobody has sold in that grade recently has no
        value to report, and a row that could not be confirmed twice says so in place of the number rather than
        printing one.</p>
      <p><b>What this ranking cannot see.</b> Auction and private sales, which is where a lot of vintage Topps
        actually changes hands, and any card with no recent recorded sale in the column being ranked. It also
        cannot see condition: a raw price is a guide value for a loose copy, and the range between a beaten copy
        and a clean one on cards this old is enormous.</p>
      <p><b>Every figure was read twice before it went on this page.</b> The ranking comes off PriceCharting's
        set listings; each candidate was then re-read from that card's own product page, which is a different
        page with different columns, and the two readings compared. <b>${esc(String(v.agree))} of
        ${esc(String(v.checked))}</b> candidates agreed.${excNote} A figure that was read once is not published
        here, because the column names on those two pages do not mean the same thing and a single read cannot
        tell.</p>
      <p>Prices move every day and this page does not. The date above is the date the numbers were read, and if
        it looks old then the numbers are old.</p>
    </div>

    <div class="facts" style="margin-top:20px">
      <div class="fact"><div class="n">${moneyCompact(rawTop.ungraded)}</div><div class="l">Top raw value</div></div>
      <div class="fact"><div class="n">${moneyCompact(psaTop.psa10)}</div><div class="l">Top PSA 10 value</div></div>
      <div class="fact"><div class="n">${d.scanned.products.toLocaleString("en-US")}</div><div class="l">Topps listings read</div></div>
      <div class="fact"><div class="n">${d.scanned.consoles}</div><div class="l">Price guide buckets searched</div></div>
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${esc(read)}</div><div class="l">Prices read on</div></div>
    </div>

    <p class="lede" style="max-width:44em;margin-top:20px">Two lists, both below:
      <a href="#raw">the ${rawList.length} most valuable ungraded</a> and
      <a href="#psa">the ${psaList.length} highest PSA 10 values</a>. ${
        rawList.filter((c) => psaList.some((p) => p.rank === c.rank)).length
      } cards are on both. Paths under each row are all on pricecharting.com.</p>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
${listHead(
  "raw",
  `The ${rawList.length} most valuable <span class="hl">ungraded</span>`,
  "Raw",
  `Loose cards, out of a sleeve, ungraded, ranked by PriceCharting's Ungraded column on ${esc(read)}. The PSA 10 ` +
    `and Grade 9 figures from the same record sit under each one, because a raw price on a card this old is only ` +
    `half the story. Number one is ${esc(moneyCompact(rawTop.ungraded))} and number ${rawList.length} is ` +
    `${esc(moneyExact(rawFloor.ungraded))}.`,
)}
    <ol class="tp-list">
${rawList.map((c, i) => row(c, i, "ungraded")).join("\n")}
    </ol>
  </div>
</section>

<section class="tight">
  <div class="wrap">
${listHead(
  "psa",
  `The ${psaList.length} highest <span class="hl">PSA 10</span> values`,
  "Graded",
  `The same cards ranked by what PriceCharting says a copy graded PSA 10 is worth, read the same day. This is a ` +
    `different list rather than the same one reordered: number one here is ${esc(psaTop.name)} at ` +
    `${esc(moneyCompact(psaTop.psa10))}, and number ${psaList.length} is ${esc(moneyExact(psaFloor.psa10))}. ` +
    `${missing(psaList, "ungraded")} of these rows carry no confirmed ungraded figure at all.`,
)}
    <ol class="tp-list">
${psaList.map((c, i) => row(c, i, "psa10")).join("\n")}
    </ol>

    <p class="price-note" style="margin-top:var(--s5)">Prices are PriceCharting price guide values for that exact
      printing, read on ${esc(read)} and re-read from each card's own product page before publication. They move
      daily, so treat them as the shape of the market rather than a quote. The path under each row is that card's
      own address on pricecharting.com, printed rather than linked, so any single figure can be looked up on its
      own. Card scans are PriceCharting's, shown at the size these rows draw them.${
        noScanRows
          ? ` ${noScanRows === 1 ? "One card" : `${noScanRows} cards`} across the two lists ${
              noScanRows === 1 ? "has" : "have"
            } no scan in PriceCharting's catalogue and ${noScanRows === 1 ? "shows" : "show"} an empty frame
      saying so; that is their record, not a fault here.`
          : ""
      }
      Not financial advice, and definitely not a suggestion to buy any of this.</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Showing our working</p>
    <h2>How these lists were <span class="hl">made</span></h2>
    <div class="tp-defs">
      <div>
        <h3>Where the numbers come from</h3>
        <p>PriceCharting's own price guide: <code>pricecharting.com</code>, methodology published at
          <code>${esc(d.sourceMethodology || "")}</code>. It is the same source the set guides, the Pokedex pages
          and the two site-wide value lists here are priced from, so a Topps card on this page and the same card
          on any other page of this site cannot disagree.</p>
      </div>
      <div>
        <h3>How we know these are the top 100 and not the first 100 we found</h3>
        <p>There is no all-of-Topps listing to sort and their one price sort works a bucket at a time, so the top
          of any one bucket says nothing about the top of the rest. Every Topps bucket was pulled and ranked
          here: <b>${d.scanned.consoles}</b> buckets, <b>${d.scanned.products.toLocaleString("en-US")}</b>
          products, of which <b>${d.scanned.productsWithUngraded.toLocaleString("en-US")}</b> carry an ungraded
          value and <b>${d.scanned.productsWithPsa10.toLocaleString("en-US")}</b> a PSA 10 value. Each hundred is
          the top of all of those, not the top of a sample.</p>
      </div>
      <div>
        <h3>Checked twice, on purpose</h3>
        <p>Every candidate for either list was read again from its own product page, a different template with
          different columns, and <b>${esc(String(v.agree))} of ${esc(String(v.checked))}</b> agreed within
          ${esc(String(Math.round((v.tolerance || 0.15) * 100)))}%. That is the check that catches a column read
          off the wrong header, which on one card elsewhere on this site is a 21 times error that still looks
          like a reasonable price. Both ranking columns are gated on it independently, so a card whose raw price
          confirmed and whose PSA 10 price did not appears on one list and not the other.</p>
      </div>
      <div>
        <h3>What a row is</h3>
        <p>One PriceCharting product, which is one printing of one card. "Charizard #6", "Charizard [Sparkle] #6"
          and "Charizard [Tekno] #6" are three rows, not one, and the part in brackets is the finish. A guide
          value is computed across the sales that guide tracks rather than quoted from one of them, so treat a
          row as "what a loose copy of this printing is worth", not as a quote for a specific card.</p>
      </div>
      <div>
        <h3>Why the set names look wrong</h3>
        <p>They are PriceCharting's, and PriceCharting files these cards by card type rather than by the set
          Topps actually shipped. "2000 Topps TV Heroes &amp; Villians" was never a Topps release; it is where
          two different sets' character cards ended up. <a href="/topps.html">The guide</a> lists Topps' own
          ${releases.length} sets with their dates and card counts, and maps every one of these buckets onto the
          release it came out of.</p>
      </div>
      <div>
        <h3>What was taken out</h3>
        <p>${
          (d.notCards || []).length
            ? esc(String((d.notCards || []).length)) + " sealed products that leaked into the crawl."
            : "Nothing. Every row flagged as possibly not a single card was checked by hand and every one of them turned out to be a card, so no row was removed from either ranking."
        } Sealed Topps product is not ranked here at all: the crawl behind these figures excludes it, and
          unopened boxes have their own list at <a href="/most-expensive-sealed.html">the 100 most expensive
          sealed Pokemon products</a>.</p>
      </div>
    </div>

    <p class="price-note" style="margin-top:var(--s4)">Want the whole catalogue rather than just Topps?
      <a href="/most-valuable-cards.html">The 100 most valuable raw Pokemon cards</a> and
      <a href="/top-graded.html">the 100 highest PSA 10 values</a> rank every Pokemon card this source prices, in
      every language. <a href="/grading.html">Is it worth grading?</a> does the subtraction between the two
      columns on this page.</p>
    <p class="price-note">Card images are the property of their respective owners and appear here for
      identification. Pokemon and all card artwork are trademarks of The Pokemon Company, Nintendo, Game Freak
      and Creatures Inc.</p>
  </div>
</section>

</main>
${footer("Prices move daily. The date on this page is the date they were read.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/topps.html"), guide);
await writeFile(join(ROOT, "public/topps-card-values.html"), values);

console.log(
  `Wrote public/topps.html and public/topps-card-values.html\n` +
    `  ${releases.length} Topps releases from data/topps-sets.json, ` +
    `${mappingChecks} bucket mappings re-checked against the crawl, all passed\n` +
    `  ${d.scanned.consoles} PriceCharting buckets, ${d.scanned.products} products, read ${d.checked}\n` +
    `  raw hundred: ${rawList.length} rows, ${moneyExact(rawTop.ungraded)} down to ${moneyExact(rawFloor.ungraded)}, ` +
    `${chromeIn(rawList)} of them Chrome\n` +
    `  PSA 10 hundred: ${psaList.length} rows, ${moneyExact(psaTop.psa10)} down to ${moneyExact(psaFloor.psa10)}, ` +
    `${chromeIn(psaList)} of them Chrome\n` +
    `  ${v.agree}/${v.checked} candidates confirmed on a second read, ${v.disagree} not, ${v.unreadable} unreadable\n` +
    `  ${rawList.filter((c) => psaList.some((p) => p.rank === c.rank)).length} cards appear on both lists` +
    (toppsOnRawTop100 != null ? `\n  ${toppsOnRawTop100} of the site-wide raw top 100 are Topps cards` : ""),
);
if (rawList.length < WANT || psaList.length < WANT)
  console.log(
    `  NOTE: a list is short of ${WANT}. Candidates that failed their second read are not published and not\n` +
      `        padded out. Widen KEEP in scripts/sync-topps-top.mjs and re-run the verifier if that matters.`,
  );
