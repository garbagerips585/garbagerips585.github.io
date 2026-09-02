#!/usr/bin/env node
// Generate /card-shows.html, the local card show calendar.
//
//   node scripts/build-shows.mjs
//
// Reads data/shows.json. Everything on the page came off a real listing and
// carries the link it came from, because there is no card show API and the
// aggregators that exist disagree with each other often enough to matter.
//
// NOTE THE URL. /card-shows.html, not /shows.html, because /shops.html already
// exists for card SHOPS and the two would be one typo apart forever. It also
// happens to be the better search target: people type "card shows near me".
//
// PAST EVENTS ARE HANDLED TWICE, on purpose. The build drops anything already
// gone, and the page hides stragglers again on load. The build filter alone
// would be enough only if the site rebuilt every single day; the nightly does,
// but the client pass means a stale deploy still never shows somebody a date
// that has already been and gone, which on this page is the one unforgivable
// bug. The client pass is also why the empty state is written in HTML rather
// than decided at build time.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, mailtoHref} from "../shared/site.mjs";
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
import { esc, longDate, MONTHS_LONG, clipMeta} from "../shared/format.mjs";

import { localDay } from "../shared/today.mjs";
/* CLIENT_DAY_JS is the BROWSER half of the question localDay() answers on this
   side of the build, and the two are not interchangeable. localDay is a node
   import: putting its NAME inside the <script> template at the foot of this
   file shipped a call to a function no page defines. See the note there. */
import { CLIENT_DAY_JS } from "../shared/drops.mjs";
// ONE LIGHTBOX FOR FOUR PAGES. This overlay started here, for the flyers; the
// logos on /shops.html, /vendors.html and /creators.html now open in the same
// one, so it lives in shared/ rather than in three more copies of itself.
import { imgLbMarkup, imgLbJs } from "../shared/lightbox.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(await readFile(join(ROOT, "data/shows.json"), "utf8"));

// The roads, the water and the county lines, written by
// scripts/sync-card-show-map.mjs from the Overpass API and committed. NO NETWORK
// HAPPENS HERE and none may be added: that script is not in build-all.mjs, same
// arrangement as sync-shop-map.mjs, sync-decks.mjs and sync-plate-photos.py, and
// its own header says why.

const TODAY = localDay();

const REGIONS = [
  { id: "all", label: "All" },
  { id: "roc", label: "Rochester, NY" },
  { id: "buffalo", label: "Buffalo & Niagara" },
  { id: "syracuse", label: "Syracuse" },
];

/** "10:00" -> "10am", "16:30" -> "4:30pm". */
function clock(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hr}:${String(m).padStart(2, "0")}${ampm}` : `${hr}${ampm}`;
}
const timeRange = (s, e) => [clock(s), clock(e)].filter(Boolean).join(" to ");

// HOW A SHOW IS NAMED INSIDE A LINK LABEL, AND THE DATE IS NOT DECORATION.
// Naming the show alone was not enough: the recurring ones run monthly and each
// date has its own listing url, so "CollectorFest Monthly" was still the name of
// three different links and "Batavia Sports Card, Toys and Collectible Show" of
// four. The date is exactly what tells them apart and it is already visible on
// the card, so it belongs in the label too.
//
// THAT MEASUREMENT READ "26 outbound links on the page, 26 distinct accessible
// names" AND THE FIRST HALF WAS HALF THE PAGE. There were 52, because the venue
// name on every row is a Google Maps link and this file's notes had not counted
// it; the 26 that were measured were the 26 that had just been labelled. Re-run
// on 20 August 2026 over the whole of main: 52 outbound links, 52 with an
// aria-label, 52 distinct accessible names. Count what the page emits, not what
// the edit touched.
const showRef = (s) => {
  const when = longDate(s.date) || s.date || "";
  return when ? `${s.name}, ${when}` : s.name;
};

// The bare host, for the "opens on <host>" half of an outbound aria-label.
// Falls back to the empty string rather than throwing: a malformed url in the
// data should cost a label, not the build.
function hostOf(u) {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Eastern offset for a given date: -04:00 in daylight time, -05:00 in standard.
 * This was hardcoded to -04:00, which is wrong for every show from November on,
 * and there are eight of those. Google reads these times literally, so it was
 * advertising those shows an hour early while the page itself showed the right
 * time. US DST runs from the second Sunday in March to the first Sunday in
 * November.
 */
function tzOffset(iso) {
  const d = new Date(iso + "T12:00:00Z");
  const y = d.getUTCFullYear();
  const nth = (month, weekday, n) => {
    const first = new Date(Date.UTC(y, month, 1));
    const shift = (weekday - first.getUTCDay() + 7) % 7;
    return new Date(Date.UTC(y, month, 1 + shift + (n - 1) * 7));
  };
  const start = nth(2, 0, 2); // second Sunday in March
  const end = nth(10, 0, 1); // first Sunday in November
  return d >= start && d < end ? "-04:00" : "-05:00";
}

/** Days from today, for the "this weekend" style nudge. */
function daysAway(iso) {
  const d = Math.round((new Date(iso + "T12:00:00") - new Date(TODAY + "T12:00:00")) / 86400000);
  if (d < 0) return null;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d <= 7) return `In ${d} days`;
  return null;
}

const weekday = (iso) =>
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date(iso + "T12:00:00").getDay()
  ];

/* THE CITY FIELD CARRIES THE STATE FOR THE READER; THESE TWO CALLERS MUST NOT.
   data/shows.json says "Rochester, NY" so the visible listing reads that way,
   but schema.org addressLocality is the locality ALONE (addressRegion already
   carries NY, and every other town in the file is bare), and the maps query
   appends its own " NY" and would otherwise ask for "Rochester, NY NY". */
/* ------------------------------------------------- confirmed vendors -------
 *
 * The owner, 29 August 2026: "if we know there are confirmed vendors showing at a
 * show that we list on the vendor page, we should list them as confirmed
 * vendors even adding their logo. I know for sure that TOAK Pulls will be at
 * the JCC event tomorrow."
 *
 * A SHOW NAMES A VENDOR, AND THE VENDOR'S OWN LISTING SUPPLIES EVERYTHING ELSE.
 * data/shows.json carries nothing but the name and how it was confirmed; the
 * logo, the link and what they sell are read out of data/vendors.json, so a
 * vendor who changes their mark or their handle changes it in one place. Same
 * shape as the seller credit on a rip page (shared/pack-source.mjs), and for
 * the same reason.
 *
 * "CONFIRMED" IS A CLAIM ABOUT SOMEBODY ELSE'S BUSINESS, so it carries its
 * source like every other claim here. `confirmed` is the sentence that says who
 * said so and when, it is REQUIRED, and the build fails without it. A table
 * list that is wrong sends somebody to a show to meet a vendor who is not
 * there, which is the same cost as a wrong opening hour and gets the same rule.
 *
 * AND A NAME THAT MATCHES NO LISTING FAILS THE BUILD RATHER THAN VANISHING.
 * Silently dropping a vendor is the "absent means unconfirmed" rule inverted:
 * here absent would mean a confirmed vendor the reader never sees, which is a
 * typo shaped exactly like a correct build. */
const VENDOR_LIST = (JSON.parse(await readFile(join(ROOT, "data/vendors.json"), "utf8")).vendors) || [];
/* NAME IS THE JOIN KEY AND NOTHING ENFORCES THAT IT IS UNIQUE, so this does.
   A Map keeps the LAST entry, so two vendors called the same thing would have
   published one of them under the other's mark, silently, on somebody else's
   business. Trimmed and NFC-normalised on both sides because the readme in
   data/shows.json spells RocPokeCon without its accent twice. */
const vKey = (n) => String(n ?? "").trim().normalize("NFC").toLowerCase();
const VENDORS = new Map();
for (const v of VENDOR_LIST) {
  const k = vKey(v.name);
  if (VENDORS.has(k)) {
    throw new Error(
      `data/vendors.json has two vendors named "${v.name}". The show cards join on name, ` +
      `so a duplicate publishes one vendor under the other's logo. Rename one.`
    );
  }
  VENDORS.set(k, v);
}

function showVendors(s, past) {
  /* NOT .filter(Boolean). A null in the array is malformed data, and quietly
     dropping it is the same silent-vendor failure the guards below exist for. */
  const list = s.vendors || [];
  if (!list.length) return "";
  const seen = new Set();
  return list.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Show "${s.name}" (${s.id}) has a vendor entry that is not an object: ${JSON.stringify(entry)}`);
    }
    const name = entry.name;
    const v = VENDORS.get(vKey(name));
    if (!v) {
      throw new Error(
        `Show "${s.name}" (${s.id}) names vendor "${name}", which is not in data/vendors.json. ` +
        `Add them there first, or fix the spelling: a confirmed vendor that silently does not render ` +
        `is a typo that looks exactly like a correct build.`
      );
    }
    /* A NON-EMPTY STRING, not merely something truthy. `confirmed: true` passed
       the first version of this guard and published the literal word "true" as
       the source line, and "   " published a blank one. A required source that
       accepts any value is not a required source. */
    if (typeof entry.confirmed !== "string" || !entry.confirmed.trim()) {
      throw new Error(
        `Show "${s.name}" (${s.id}) lists vendor "${name}" with no \`confirmed\` sentence. ` +
        `Say who confirmed it and when: this page tells a reader who to expect to meet.`
      );
    }
    if (seen.has(vKey(name))) {
      throw new Error(`Show "${s.name}" (${s.id}) lists vendor "${name}" twice.`);
    }
    seen.add(vKey(name));

    /* THE LOGO ONLY WHERE ITS OWNER SENT ONE AND THE FILE IS ACTUALLY THERE.
       build-locals.mjs checks the rendition exists before pointing at it and
       this did not, so a vendor with a `logo` and no built files would have
       published four dead urls inside an empty plate. logoW/logoH are required
       WITH a logo, because without them the height falls back to a square and a
       non-square mark reserves the wrong space and shifts on load. */
    let mark = "";
    if (v.logo) {
      const base = join(ROOT, "public/assets/creators", `${v.logo}-200.webp`);
      if (!existsSync(base)) {
        throw new Error(
          `Vendor "${v.name}" has logo "${v.logo}" but public/assets/creators/${v.logo}-200.webp ` +
          `does not exist. Run the logo builder, or drop the logo field.`
        );
      }
      if (!v.logoW || !v.logoH) {
        throw new Error(`Vendor "${v.name}" has a logo but no logoW/logoH, so its height cannot be reserved.`);
      }
      const mh = Math.round(34 * v.logoH / v.logoW);
      mark = `<span class="sv-logo"><picture>` +
        `<source type="image/avif" srcset="/assets/creators/${esc(v.logo)}-200.avif 200w, /assets/creators/${esc(v.logo)}-400.avif 400w" sizes="34px">` +
        `<img src="/assets/creators/${esc(v.logo)}-200.webp" alt="" width="34" height="${mh}" loading="lazy" decoding="async" ` +
        `srcset="/assets/creators/${esc(v.logo)}-200.webp 200w, /assets/creators/${esc(v.logo)}-400.webp 400w" sizes="34px"></picture></span>`;
    }

    /* THE SOURCE SITS ON ITS OWN VENDOR. The first version pushed every
       `confirmed` sentence through a Set and joined them under the list, so at
       two vendors a reader could not tell which sentence belonged to which
       name, and two vendors sharing a sentence collapsed to one line over two
       names. This is the one feature whose entire purpose is provenance, and it
       stopped carrying it at n=2. .rip-src-src is per item for the same reason. */
    return `<li class="sv"><a class="sv-link" href="/vendors.html" aria-label="${
      esc(v.name)}, on the vendors page">${mark}<span class="sv-id">${esc(v.name)}</span></a>` +
      `<span class="sv-src">${esc(entry.confirmed.trim())}</span></li>`;
  }).join("");
}

const bareCity = (c) => String(c || "").replace(/,\s*(NY|New York)$/i, "");

/** A maps link built from the venue and city. Never an address we made up. */
const mapQuery = (s) =>
  [s.address || s.venue, s.address ? "" : bareCity(s.city), s.address ? "" : "NY"].filter(Boolean).join(" ");
const mapLink = (s) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(s))}`;

/* THERE IS NO URL THAT MEANS "the reader's default maps app" AND THAT IS WHY
 * THIS IS TWO LINKS AND A PIECE OF PLAIN TEXT rather than one clever scheme.
 * A google.com/maps link opens the Google Maps APP where it is installed and a
 * web page otherwise, so an iPhone without it gets a website when it wanted
 * directions; maps.apple.com opens Apple Maps on Apple platforms and a web page
 * everywhere else. Neither is right for everybody, so the page SERVES the Google
 * one, which is the safe default and needs no script, and the block at the foot
 * swaps it on Apple platforms only. The reliable answer for everyone else is the
 * address itself, printed as selectable text under the venue: it costs nothing
 * and it pastes into whatever app the reader actually uses. */
const appleMapLink = (s) =>
  `https://maps.apple.com/?q=${encodeURIComponent(mapQuery(s))}`;

// The page covers three metro areas and nothing else. These feeds are regional
// and cheerfully mix in the Southern Tier, and a national search for "Rochester
// Pokemon league" returns Rochester MINNESOTA and Rochester MICHIGAN before it
// returns ours, so an out-of-area entry is a question of when, not whether.
// Anything not on this list stops the build rather than quietly telling somebody
// in the 585 to drive to another state.
/* WHICH SHOWS BELONG HERE, MEASURED RATHER THAN LISTED.
 *
 * This was a hand-typed Set of about thirty city names, and a hand-typed list of
 * exceptions is the thing this repo has been burned by most: it goes stale the
 * first time somebody adds a show and then it lies without anybody editing it.
 * Every city already carries a lat/lon in _towns, so the rule can just be the
 * rule, and it is the owner's own words: "if a show is within 30-45 miles of the
 * main city filters just add it into that filter."
 *
 * FORTY-FIVE MILES FROM ONE OF THREE ANCHORS. Checked against the calendar as it
 * stood when this went in: the farthest city in use was Batavia at 31.2 miles,
 * and every single city's nearest anchor already matched its declared region,
 * 13 of 13. So this codifies what the data was doing rather than changing it.
 *
 * IT CHECKS THE REGION TOO, which the old Set could not. A show in Dryden filed
 * under Rochester would have passed a name list happily; here the nearest anchor
 * IS the answer, so a mis-filed region is caught rather than shipped. That is a
 * real class of bug on a page whose only navigation is three area buttons.
 *
 * The radius is the one number to argue about. Widening it is a decision about
 * how far the owner will tell somebody to drive, not a technical one. */
const ANCHORS = { roc: [43.1566, -77.6088], buffalo: [42.8864, -78.8784], syracuse: [43.0481, -76.1474] };
const RADIUS_MI = 45;
const milesBetween = ([la1, lo1], [la2, lo2]) => {
  const R = 3958.8, r = (d) => (d * Math.PI) / 180;
  const dp = r(la2 - la1), dl = r(lo2 - lo1);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const nearestAnchor = (pt) =>
  Object.entries(ANCHORS)
    .map(([id, a]) => ({ id, mi: milesBetween(pt, a) }))
    .sort((x, y) => x.mi - y.mi)[0];

const towns = data._towns || {};
/* A TOWN BETWEEN TWO CITIES BELONGS IN BOTH FILTERS. The owner, 29 August 2026:
   "waterloo is honestly pretty much inbetween Syracuse and Rochester so just put
   it in both filters ... if anything is close to more than one city just make it
   filter into both."
   Waterloo is 37.5 miles from Syracuse and 41.5 from Rochester, so it filed
   under Syracuse and the Rochester chip -- the one a Rochester reader obviously
   presses -- deleted the nearest show on the calendar while the hero above kept
   advertising it. `region` still holds the NEAREST anchor, so the build guard
   below still checks the one true filing; this only widens which chips show it.
   DUAL_MI is a margin, not a second radius: a town qualifies for a second city
   only if that city is within 15 miles of being its nearest. */
const DUAL_MI = 15;
const regionsFor = (city) => {
  const pt = towns[city];
  if (!pt) return [];
  const all = Object.entries(ANCHORS)
    .map(([id, a]) => ({ id, mi: milesBetween(pt, a) }))
    .sort((x, y) => x.mi - y.mi);
  const best = all[0];
  return all.filter((a) => a.mi <= RADIUS_MI && a.mi - best.mi <= DUAL_MI).map((a) => a.id);
};
const areaProblems = [];
for (const s of data.shows || []) {
  const pt = towns[s.city];
  if (!pt) {
    areaProblems.push(`${s.id}: ${s.city} has no lat/lon in _towns, so it cannot be placed`);
    continue;
  }
  const near = nearestAnchor(pt);
  if (near.mi > RADIUS_MI) {
    areaProblems.push(
      `${s.id}: ${s.city} is ${near.mi.toFixed(1)} miles from ${near.id}, past the ${RADIUS_MI} mile radius`
    );
  } else if (s.region !== near.id) {
    areaProblems.push(
      `${s.id}: ${s.city} is filed under "${s.region}" but its nearest anchor is "${near.id}" (${near.mi.toFixed(1)} mi)`
    );
  }
}
if (areaProblems.length) {
  console.error(
    `${areaProblems.length} show(s) fail the area rule:\n` +
      areaProblems.map((t) => `  ${t}`).join("\n") +
      `\n\nEvery show must be within ${RADIUS_MI} miles of Rochester, NY, Buffalo or Syracuse, ` +
      `filed under the nearest one, with its city in _towns. Widen RADIUS_MI only on purpose.`
  );
  process.exit(1);
}

const upcoming = (data.shows || [])
  .filter((s) => s.date >= TODAY)
  .sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || ""));

// Free-to-enter count, from the same test the counter tile uses.
const nFree = upcoming.filter((s) => String(s.admission || "").trim().toLowerCase() === "free").length;

// Group by calendar month so the page reads like a calendar rather than a list.
const byMonth = [];
for (const s of upcoming) {
  const key = s.date.slice(0, 7);
  let g = byMonth.find((x) => x.key === key);
  if (!g) byMonth.push((g = { key, label: `${MONTHS_LONG[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`, shows: [] }));
  g.shows.push(s);
}

/* ------------------------------------------------------------ the archive --
 *
 * The owner, 27 August 2026: "when shows happen we build out a past shows page
 * and just keep a record and history of all the shows that have happened, people
 * like to look back and see the shows they went to or see when the last one of a
 * show was, look at the old flyers etc".
 *
 * IT IS THE SAME DATA AND THE SAME CARD, which is the whole reason it is built
 * in this file rather than a new one. A show does not get copied anywhere when
 * it passes and nothing has to be remembered: it stops matching `date >= TODAY`
 * and starts matching `date < TODAY`, so the nightly build moves it. The two
 * pages read one array and render one showCard(), so they cannot drift apart in
 * look, and a flyer that was on the calendar is on the archive.
 *
 * NEWEST FIRST, unlike the calendar. The calendar answers "what is next" and
 * counts forward; this answers "when was the last one" and "what did I go to in
 * the spring", and both of those read backwards from now.
 */
/* THIS PAGE WAS BUILT BEHIND A DATE GATE FOR ABOUT AN HOUR AND THE GATE IS
   GONE. The owner asked for the archive and said "we dont need to take the past
   shows archive page live until Sunday", because he believed there was nothing
   to put in it: "nothing to put in it yet". There was. PokeKon Fest on 16 August
   was already past and already in data/shows.json, so the page had a real entry
   from its first build. Shown that, he said to take it live now.
   THE OTHER HALF OF WHAT HE ASKED FOR NEEDS NO GATE AND NEVER DID. "dont put it
   on that page until Sunday", about the GI Cards show on the 29th, is what this
   page already does on its own: the show is on the calendar while it is still
   ahead and moves here the morning after, because the two lists are one array
   split on `date < TODAY`. Verified by faking the clock and building twice: on
   the 29th the archive holds one show and the calendar holds GI Cards; on the
   30th the archive holds two, GI Cards first. */

/* SHOWS DATED TODAY ARE RENDERED HERE TOO, HIDDEN, AND THAT CLOSES A REAL HOLE.
   The owner: "set a rule for the shows to auto move over to the past shows pages
   once its after the date of the show, 1 day after the show". Splitting the one
   array on `date < TODAY` already does exactly that, and it was verified by
   faking the clock: on 29 August the GI Cards show is on the calendar, on the
   30th it is here.
   WHAT IT DEPENDS ON IS A BUILD RUNNING, AND THE NIGHTLY HAS FAILED BEFORE, on
   23 and 24 August, which is why /card-shows.html carries a client sweep that
   drops a past show on the READER'S clock rather than the build's. That sweep
   only ever REMOVES, so between a show ending and the next successful build it
   was on neither page. A card that is not in the HTML cannot be revealed by any
   script, so the only shows that can cross over before the next build, the ones
   dated today, are rendered here now and hidden. The sweep at the foot of this
   page unhides them the moment the reader's own date is past. One or two cards
   of markup, and the promise holds through a failed build. */
const past = (data.shows || [])
  .filter((s) => s.date <= TODAY)
  .sort((a, b) => b.date.localeCompare(a.date) || (b.start || "").localeCompare(a.start || ""));

const pastByMonth = [];
for (const s of past) {
  const key = s.date.slice(0, 7);
  let g = pastByMonth.find((x) => x.key === key);
  if (!g) pastByMonth.push((g = { key, label: `${MONTHS_LONG[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`, shows: [] }));
  g.shows.push(s);
}

const next = upcoming[0] || null;
const pokemonCount = upcoming.filter((s) => s.pokemon).length;
/* THE NEWEST SOURCE ON THE PAGE, NOT THE FILE'S OWN FIELD. data.checked is when
   cardshows.io was last read, but fourteen shows come from an organizer's flyer
   or a message sent to the channel and carry their own later dates, and the
   confirmed-vendor lines are later still. The tile read "August 26" on the day
   the page shipped content read on the 29th, which undersells the calendar on
   the one number a reader uses to decide whether to trust it. */
/* THE TILE STAYS ON data.checked AND THAT IS DELIBERATE, after briefly not
   being. An audit read "Listings last checked: August 26" beside shows sourced
   from flyers dated the 27th and a vendor line dated the 29th, and called the
   tile stale. It is not: "listings last checked" is the day the FEEDS were
   swept, which is the last time anybody looked for a show that is not here yet,
   and the footnote under it says exactly that ("mostly cardshows.io ... read
   August 26, 2026"). Taking the newest fact on the page instead made the tile
   claim the calendar had been swept on the 29th when it had not, which
   overstates freshness -- the one direction this site treats as serious. The
   newer per-show sources are printed on the shows they belong to. */

// ------------------------------------------------------------------- the map
//
// THE PAGE ANSWERED WHEN AND NEVER WHERE. The calendar below turned the dates
// into a picture and left the other half of every listing as a place name:
// "Quality Inn, Batavia", "American Legion, Sanborn", "Randolph House Hotel,
// Liverpool". Those are exact and they are meaningless to anybody who does not
// already know this corner of New York, which on a page written to be opened on
// a phone in a queue is most of the people reading it. The filter chips say
// Rochester, Buffalo & Niagara and Syracuse, so the page already knows the
// answer is spatial; it just never drew it.
//
// SAME PICTURE AS /shops.html AND THE SAME REASONS. Drawn from coordinates, not
// a map tile: no key, no network request, no terms of use, no 200KB. One scale
// on both axes with the cos(latitude) correction, or it is not a map.
//
// THIS BLOCK USED TO END "No coastline and no roads, because this site holds no
// licensed geometry for either and drawing them freehand would be inventing
// data", AND THE FIGURE'S OWN CAPTION SAID THE SAME THING OUT LOUD: "There are
// no roads on it because we do not have any to draw." The owner read the picture and
// asked for the obvious thing: "make the image at the top an actual map showing
// the cities and surrounding areas right now its just names of cities and dots,
// needs to be a map".
//
// IT WAS THE SAME SENTENCE, WORD FOR WORD, THAT /shops.html HAD ALREADY BEEN
// CAUGHT BY, and CLAUDE.md describes the shape in full: a true statement about
// the candidates somebody looked at, written as a statement about the subject.
// What had been ruled out was TILES, correctly. What had never been looked at
// was the DATA those tiles are drawn from, which OpenStreetMap gives away under
// the ODbL. The gap was a search, not a licence, and it had already been closed
// on the sister page a day earlier. So this is not a new argument, it is the
// same fix applied to the second of a pair of pages a reader moves between.
//
// SO THERE IS REAL GEOMETRY ON IT NOW: the Lake Ontario shore, the Finger Lakes,
// Oneida and Onondaga, the Niagara River, the interstates and trunk routes, and
// the county lines. scripts/sync-card-show-map.mjs fetches it once into
// data/card-show-map.json and this builder reads that file offline; the ODbL
// credit is in the caption with the licence linked, because that is a condition
// of use rather than a courtesy. STILL NOT TILES, for the three reasons that
// script's header sets out and that CLAUDE.md records.
//
// FEWER FEATURES THAN /shops.html AND HEAVIER ONES, WHICH IS THE WHOLE
// DIFFERENCE BETWEEN THE TWO MAPS. That one is 24 miles across and draws at 37
// units to the mile, so it can afford primary and secondary roads and a pond a
// tenth of a mile wide. This one is 147 miles across and draws at 3.9 units to
// the mile, which at 390px is TWO PIXELS PER MILE. The same feature list here is
// a grey wash with no shape in it. The road list stops at trunk and the water
// cut is fifty times coarser; the reasoning and the measured element counts are
// in the sync script beside each query.
//
// TOWNS, NOT VENUES, AND THE CAPTION SAYS SO. Five of the eight venues on this
// page are named places with no street address in our data. Rather than plot
// three real addresses and five guesses that would look identical, every dot is
// its town centre, which over a strip 147 miles long is the honest resolution.
// The venue and the town are printed on every listing below for the map app.
//
// THE DOT AREA IS THE NUMBER OF SHOWS, not its radius, so eight shows is eight
// times the ink and not sixty-four. That is the second thing this picture says
// and it is not written anywhere else on the page: Batavia has a show almost
// every month, which is a different fact from where Batavia is.
//
// THE FRAME IS TALLER THAN THE TOWNS NEED AND THAT IS NOT A SCALE ERROR. These
// towns sit in a band 147 miles east to west and 18 north to south, a 8:1 strip,
// so at one honest scale the dots occupy 70 of the 250 units and sit across the
// middle of the frame. That headroom was originally for the LABELS alone, which
// is the trade shopMap makes with its greedy slot placement: the dots are where
// the towns are and only the names move. It now also buys the map. The 250 units
// reach from Lake Ontario down past the head of the Finger Lakes, so the space
// above and below the strip of dots is the ground that explains why the dots are
// a strip. Squashing the drawing to its own bounding box would put "Niagara
// Falls", "Sanborn" and "Depew" on one line 35 units apart AND throw away every
// feature that makes this a place rather than a scatter plot.
const townCounts = new Map();
for (const s of upcoming) townCounts.set(s.city, (townCounts.get(s.city) || 0) + 1);
const townRegion = new Map();
for (const s of upcoming) if (!townRegion.has(s.city)) townRegion.set(s.city, s.region);

// -------------------------------------------- a headstone for the map
//
// THE DRAWN MAP WAS HERE AND IT IS GONE, ON THE OWNER'S CALL: "remove the map and
// the all the text and links below the map, and just get straight into the show
// listings ... too much stuff to scroll past before you get to what people want
// to read which is the show listing info".
//
// HE ASKED FOR IT IN THE FIRST PLACE, on 21 August 2026, and it goes because of
// what it cost rather than because it was wrong: 414 lines of builder and FIFTY
// THOUSAND characters of inline SVG standing between the filter buttons and the
// first show card, on a page whose entire job is the show cards. It answered
// "where are these towns", and almost nobody arrives with that question. The
// ones who do get the venue and a full street address on every listing, each a
// link into their own maps app since 26 August.
//
// WHAT WENT WITH IT: the town key and its .map-go buttons (town-level filtering,
// replaced by the three area buttons he asked to keep), the "How this map is
// drawn" disclosure, the show and day counter, the whole of PAGE_CSS, and the
// OpenStreetMap and ODbL credit, which was NOT discretionary while the geometry
// was on the page and is simply not owed now that it is not.
//
// data/card-show-map.json and scripts/sync-card-show-map.mjs are LEFT IN PLACE.
// Nothing reads either now. They are the whole cost of putting it back, so
// deleting them would be the expensive kind of tidy.

// ------------------------------------------------------- the days, and a
// ------------------------------------------------------- headstone for the
// ------------------------------------------------------- calendar that was here
//
// THE FIVE MONTH CALENDAR GRID WAS HERE AND IT IS GONE, ON THE OWNER'S CALL: "also
// please delete the calendar below the map not needed." Same call, same page and
// the same reasoning as the hours chart that came off /shops.html on 20 August
// 2026, which build-shops.mjs still carries the headstone for.
//
// It was five drawn months, one <figure> apiece, with a pill on every day that
// had a show, a dot per show, a second dot colour for an all-Pokemon show, an
// outline for the big one, and a four item key reading "a day with a show / a
// card show / an all Pokemon show / the big one". It moved with the area filter
// and it re-swept itself on the reader's own clock.
//
// The argument FOR it was real and is worth keeping in view rather than deleting
// silently: it answered "which Saturdays are free and where are the gaps" by
// looking, which a list answers badly. The argument AGAINST it is the one that
// won, and it is the same one that won on /shops.html: every listing below
// already carries its own date, in full, in a month-grouped list with the day in
// a slab down the side of every card, so the grid said a second time in a second
// shape a thing the page already says. It charged about 120 lines of date
// arithmetic, 30 lines of CSS and a screen of page height for the repetition.
//
// WHAT WENT WITH IT, so nobody hunts for a caller: CAL_W, CAL_H, CAL_TOP,
// calMonths, CAL, daysIn, firstDow, rowsFor, CAL_ROWS, CAL_VB_H, the showsOn
// map, ordinal and calMonth existed only to feed it, and so did the .cal-* half
// of PAGE_CSS and the two .cal-dot / .cal-d sweeps in the page script. NOTHING
// ELSE READ ANY OF IT: checked across the tree, no other builder and no shared
// module imports from this file, and data/shows.json is unchanged, because the
// calendar was a second READER of `upcoming` and never a second source.
//
// ONE SENTENCE OF ITS CAPTION SURVIVES AND IT IS THE HALF THE MAP NEEDS. The
// note under the grid read "22 shows on 19 days, 3 days with two of them. Same
// list as below, drawn. The area buttons above move both." "Same list as below,
// drawn" was about the grid and went with it. The DAY COUNT is a fact the page
// states nowhere else, and "two shows on one day" is the one thing a reader
// planning a Saturday actually needs a second view to see. And the sentence
// about the buttons is now the only place the page says that the map moves with
// the filter, which it does. So those two clauses move under the map.
const dayCounts = new Map();
for (const s of upcoming) dayCounts.set(s.date, (dayCounts.get(s.date) || 0) + 1);
const showDays = dayCounts.size;
const showDoubles = [...dayCounts.values()].filter((n) => n > 1).length;

// ---------------------------------------------------------------- flyer check

// A flyer named in the data but missing on disk would render as a broken box on
// the most visual part of the page, so it is checked here rather than trusted.
const missingFlyers = [];

/* TWO FILES, NOT ONE, AND THE THUMBNAIL IS THE REASON. This returned a single
 * url that was BOTH the `src` of a 220px thumbnail on the card and the image
 * the lightbox enlarges to 900px. One file cannot be both: Cold Front's flyer
 * is 1024x1536 and the smallest JPEG that still reads at 900px is 375KB, which
 * is what the card was going to pull to paint a 220px box. So `<name>.jpg` is
 * the thumbnail and `<name>-full.jpg` is what opens, and BOTH are checked,
 * because a lightbox that opens onto a 404 is worse than no lightbox: the
 * thumbnail looks perfect right up until somebody taps it. */
const flyerSrc = (s) => {
  if (!s.flyer) return null;
  const rel = `assets/shows/${s.flyer}`;
  const full = rel.replace(/\.(jpg|jpeg|png|webp)$/i, "-full.$1");
  const avif = rel.replace(/\.(jpg|jpeg|png|webp)$/i, ".avif");
  const fullAvif = rel.replace(/\.(jpg|jpeg|png|webp)$/i, "-full.avif");
  // THE AVIFs ARE OPTIONAL AND THE JPEGs ARE NOT. build-show-logos.py declines to
  // write an AVIF that came out BIGGER than its JPEG, which happens on a small
  // already-compressed source, so a missing AVIF is a deliberate decision rather
  // than a broken build and the <picture> simply omits that <source>.
  const missing = [rel, full].filter((r) => !existsSync(join(ROOT, "public", r)));
  if (missing.length) {
    missingFlyers.push(`${s.id}: ${missing.map((r) => `public/${r}`).join(" and ")} not found`);
    return null;
  }
  const has = (r) => existsSync(join(ROOT, "public", r));
  return { thumb: `/${rel}`, full: `/${full}`,
    avif: has(avif) ? `/${avif}` : "", fullAvif: has(fullAvif) ? `/${fullAvif}` : "",
    w: s.flyerW || 0, h: s.flyerH || 0 };
};

/* ------------------------------------------------------------------- logos --
 *
 * BUILT AHEAD OF THE FIRST REPLY, 26 August 2026. Four organisers were emailed
 * today asking for a logo and a bio in their own words, and this page had
 * nowhere to put a logo: the creators and vendors pages have had one since
 * Elliot's went up, and the calendar never did. A yes arriving to a page that
 * cannot show it turns a five minute job into a project, which is how a yes
 * goes stale.
 *
 * THE SAME LADDER THE CREATOR CARDS USE, deliberately: 200 and 400 wide, AVIF
 * then WebP, sizes 56px, and the height computed from a stored logoW/logoH
 * rather than assumed square. Elliot's is 1024x856 and a hardcoded square would
 * have squashed it; the next one will be some other shape.
 *
 * AND THE SAME MISSING-FILE GUARD AS flyerSrc, for the same reason: a logo named
 * in the data but absent from disk renders as a broken box at the top of a show
 * card. Named here, reported at the end of the run, never shipped.
 *
 * A LOGO GOES UP ONLY WHEN ITS OWNER SENDS IT FOR THIS USE. That is the standing
 * rule on this site and it is why none of these are filled in yet.
 */
const missingLogos = [];
const logoFor = (s) => {
  if (!s.logo) return "";
  const rel = `assets/shows/${s.logo}-200.webp`;
  if (!existsSync(join(ROOT, "public", rel))) {
    missingLogos.push(`${s.id}: public/${rel} not found`);
    return "";
  }
  const h = Math.round(200 * (s.logoH || 1) / (s.logoW || 1));
  /* CLICKABLE ONLY WHERE THERE IS SOMETHING BIGGER TO OPEN. build-show-logos.py
     writes a -lg rendition at min(800, master) and writes NOTHING under a 500px
     master, because a 400px logo reopened at 400px is a control that appears to
     do nothing. The capability is read off the disk rather than off a flag in
     the data somebody has to remember to set. The AVIF is separately optional:
     the same script drops one that came out bigger than its WebP, and Cold
     Front's did, so this checks for the two files independently. */
  const lgW = `assets/shows/${s.logo}-lg.webp`;
  const lgA = `assets/shows/${s.logo}-lg.avif`;
  const big = existsSync(join(ROOT, "public", lgW));
  const bigAvif = big && existsSync(join(ROOT, "public", lgA));
  const who = s.organiser || s.name;
  const open = big
    ? `<button type="button" class="show-logo" aria-label="Enlarge the ${esc(who)} logo" data-imglb="/${lgW}"${
        bigAvif ? ` data-imglb-avif="/${lgA}"` : ""
      } data-imglb-alt="${esc(who)} logo">`
    : `<span class="show-logo">`;
  return `${open}<picture>
            <source type="image/avif" srcset="/assets/shows/${esc(s.logo)}-200.avif 200w, /assets/shows/${esc(s.logo)}-400.avif 400w" sizes="(min-width:720px) 80px, 56px">
            <img src="/assets/shows/${esc(s.logo)}-200.webp" alt="${esc(s.name)} logo" width="200" height="${h}" loading="lazy" decoding="async" srcset="/assets/shows/${esc(s.logo)}-200.webp 200w, /assets/shows/${esc(s.logo)}-400.webp 400w" sizes="(min-width:720px) 80px, 56px">
          </picture>${big ? "</button>" : "</span>"}`;
};

// ------------------------------------------------------------------ structured

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    /* THREE LEVELS SINCE /rochester.html EXISTS. This page sat directly under
       Home, which told a crawler it is a top-level subject of this site. It is
       one of five pages that make up the local section, and the hub is the page
       that says what that section is. The visible crumb below emits the same
       three: a breadcrumb that disagrees with its own markup is worse than
       neither, and the two used to be checked only by eye. */
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      /* "Local scene" AND NOT "Rochester, NY". The nav group holding these five
         pages is headed Rochester, NY, so that is the SECTION's name and not the
         hub page's; a page named after its own group is the two-names-one-page
         failure read backwards. The label here matches the nav item, the visible
         crumb below and the routing row at the foot of this page, because a page
         called one thing in the menu and another in the breadcrumb is two pages
         to a reader. See the note beside HUB in build-locals.mjs. */
      { "@type": "ListItem", position: 2, name: "Local scene", item: SITE + "/rochester.html" },
      { "@type": "ListItem", position: 3, name: "Card shows" },
    ],
  },
  ...upcoming.map((s) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: s.name,
    startDate: s.start ? `${s.date}T${s.start}:00${tzOffset(s.date)}` : s.date,
    ...(s.end ? { endDate: `${s.date}T${s.end}:00${tzOffset(s.date)}` } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    /* SEARCH CONSOLE ASKED FOR FIVE FIELDS ON 25 August 2026 AND TWO OF THEM
       ARE THINGS THIS SITE KNOWS. All five were flagged "non-critical", which
       Google defines as suggestions that do not stop the page appearing.

       description  the listing's own blurb, on 8 of the 23 shows.
       organizer    the promoter, on 4. NOT s.source: that is the aggregator the
                    listing was read from, cardshows.io, which runs none of
                    these shows. Naming it organizer would be a plain untruth
                    dressed as structured data.

       THE OTHER THREE ARE LEFT OFF ON PURPOSE, because filling a schema field
       is a claim and we have nothing true to put in any of them:

       performer    a card show has no performer. It is a room of dealer tables.
                    Schema.org lists the field as optional for exactly this kind
                    of event.
       image        WAS LEFT OFF FOR A REASON THAT HAS STOPPED BEING TRUE, and
                    this note said so until 28 August 2026: "there is no
                    photograph of any of these shows in the repo. The site's own
                    share card would be an image of Garbage Rips, not of the
                    event." The first half is what changed. Organisers started
                    sending flyers on 26 August and 13 shows carry one now, and
                    a flyer is the event's OWN artwork rather than ours, which
                    is exactly what this field wants. It is filled where there
                    is a flyer and left off where there is not; the share card
                    is still never used, for the reason the old note gave.
       validFrom    the date an offer opens. Nothing in the listings states when
                    admission goes on sale, and inventing one would date a
                    ticket window that may not exist.

       This is the same rule the offers block below already follows: a show whose
       admission was never stated gets no offers block rather than a made up
       zero that would read as "Free" in a search result. */
    ...(s.blurb ? { description: s.blurb } : {}),
    /* THE FLYER, ABSOLUTE, AND ONLY WHERE ONE IS ON DISK. flyerSrc() already
       refuses to name a file that is not there, for the reason its own header
       gives: a lightbox that opens onto a 404 is worse than no lightbox, and a
       404 in structured data is worse still because nobody sees it fail. The
       -full rendition rather than the thumbnail, because Google wants the
       largest available and these are 1024px or better. */
    ...((() => {
      const f = flyerSrc(s);
      return f ? { image: [`${SITE}${f.full}`] } : {};
    })()),
    ...(s.organiser
      ? {
          organizer: {
            "@type": "Organization",
            name: s.organiser,
            ...(s.organiserUrl ? { url: s.organiserUrl } : {}),
            ...(s.phone ? { telephone: s.phone } : {}),
          },
        }
      : {}),
    location: {
      "@type": "Place",
      name: s.venue,
      address: {
        "@type": "PostalAddress",
        ...(s.address ? { streetAddress: s.address.split(",")[0] } : {}),
        addressLocality: bareCity(s.city),
        addressRegion: "NY",
        addressCountry: "US",
      },
    },
    // Offers only where a real price exists. A free show is price 0; a show with
    // ticket tiers lists each one; a show whose admission was never stated gets
    // no offers block at all, rather than a made up zero that would show as
    // "Free" in a search result.
    ...((s.tiers || []).length
      ? {
          offers: s.tiers.map((t) => ({
            "@type": "Offer",
            name: t.name,
            price: String(t.price).replace(/[^0-9.]/g, ""),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: s.ticketUrl || s.url,
          })),
        }
      : /^\$\d/.test(String(s.admission || "").trim())
        ? {
            /* A STATED DOLLAR PRICE IS A REAL PRICE AND WAS EMITTING NOTHING.
               Four shows carry an admission like "$20, under 11 free" and no
               tiers, so offers came out null -- including PokeKon Fest
               Rochester, the most expensive show on the calendar, whose search
               result therefore showed no price at all while every free show
               showed one. Only the leading figure is taken; the concession is
               prose and does not belong in a single Offer. */
            offers: {
              "@type": "Offer",
              price: String(s.admission).trim().match(/^\$(\d+(?:\.\d{2})?)/)[1],
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              url: s.ticketUrl || s.url,
            },
          }
      : s.admission === "Free"
        ? {
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              url: s.url,
            },
          }
        : {}),
    ...(s.url ? { url: s.url } : {}),
  })),
];

const desc =
  `Every upcoming Pokemon and trading card show near Rochester, NY, Buffalo and Syracuse. ` +
  `${upcoming.length} shows with dates, venues and admission, checked ${longDate(data.checked) || data.checked}.`;

// COMMENTS OUT OF THE SHIPPED PAGE, ARGUMENT KEPT IN THIS FILE. Same regex and
// the same trade as build-css.mjs makes for ui.css and miniCSS makes in seven
// other builders including build-pack-prices.mjs, which argues it in full: this
// block is inline in a render blocking <head>, so every line of reasoning in it
// is paid for by every reader on shop wifi, and this page is written for a
// reader standing in a queue.
//
// THIS PAGE NEVER ADOPTED IT AND IT SHOWED. Measured on the built file before
// this line went in: 3950 bytes of inline <style>, 1767 of them comment, which is
// 44%, the worst ratio of any root page. The comments stay exactly where they
// are; they simply stop being served.
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();
// PAGE_CSS IS GONE WITH THE MAP. Every rule in it was a .map-* or .show-map
// rule: the figure, the geometry strokes, the town plates, the key and the
// note under it. With the drawn map removed there is nothing on this page that
// ui.css does not already style, so the page ships no inline <style> at all.

const head = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Card Shows Near Rochester, NY: Buffalo & Syracuse Calendar</title>
<meta name="description" content="${esc(clipMeta(desc))}">
<link rel="canonical" href="${SITE}/card-shows.html">
<meta property="og:title" content="Card shows near Rochester, NY, Buffalo and Syracuse">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/card-shows.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-card-shows.jpg?v=2">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-card-shows.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
${/* Inline, not in ui.css: this page is the only user and ui.css is render
      blocking on all 426 pages. The set guides already work this way. */ ""}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main" tabindex="-1">
`;

/** One event card. */
// EVERY OUTBOUND LINK ON A SHOW ROW CARRIES AN aria-label, WHICH CLAUDE.md
// MAKES THE CONDITION OF EVERY OUTBOUND LINK ON THE SITE. The visible wording
// could not survive being read on its own: computed off the AX tree, "Listing &
// details" was the accessible name of TWENTY-ONE links on this page, each going
// to a different show, so a screen reader's link list was twenty-one identical
// rows. The show's name and date are visible in the card above but were in no
// link name. Naming the show inside each label fixes the ambiguity and the
// missing outbound warning in one move, in the house wording
// ("<what>, opens on <host>"). Keep the visible text short: it is the
// accessible NAME that has to be unique, and WCAG 2.5.3 is satisfied because
// the visible words still start the label.
//
// THIS NOTE SAID "THE THREE LINKS ON A SHOW ROW ARE THE ONLY OUTBOUND ONES ON
// THIS PAGE" AND IT WAS WRONG BY ONE, WHICH IS THE WHOLE REASON TO WRITE A COUNT
// DOWN AND THEN NOT TRUST IT. The show-where paragraph is a FOURTH, four lines
// above the block it was describing: the venue name is a link to Google Maps on
// every row, so the page carried 22 more unlabelled outbound links than the note
// admitted to. It is labelled now, and it is the one on the row a reader most
// wants, because the whole job of this page is getting somebody to a venue.
//
// AND IT WAS AN HTML COMMENT SITTING INSIDE THIS TEMPLATE LITERAL, so it shipped
// ONCE PER SHOW: 22 copies, 23,393 bytes, 19.5% of the served document and about
// 1KB gzipped, of prose no reader can see. Measured 20 August 2026: 120,276 ->
// 96,883 bytes raw, 15,654 -> 14,656 gzipped. build-shows.mjs does not strip
// HTML comments, so a note that belongs to the BUILDER has to be a line comment
// out here, or the dollar-brace block-comment-then-empty-string form used lower
// down this file, and never an HTML comment inside a string that repeats.
function showCard(s) {
  const flyer = flyerSrc(s);
  /* THE LABEL IS THE ORGANIZER'S OWN FORMATTING AND THE HREF IS DIGITS, because
     a reader recognises the number as the one printed on the flyer while the
     dialler only accepts E.164. Both come off ONE field so they cannot drift.
     `who` is NOT in scope here -- logoFor() has one and this function does not,
     which is how the first version of this threw on every card with a phone. */
  const telHref = s.phone ? `tel:+1${String(s.phone).replace(/\D/g, "")}` : null;
  const telWho = s.organiser || s.name;
  const soon = daysAway(s.date);
  const d = new Date(s.date + "T12:00:00");
  return `      <article class="show${s.featured ? " is-featured" : ""}" data-region="${esc((regionsFor(s.city).length ? regionsFor(s.city) : [s.region]).join(" "))}" data-date="${esc(s.date)}"${s.pokemon ? ' data-pokemon="1"' : ""}${s.admission === "Free" ? ' data-free="1"' : ""}>
        <div class="show-when" aria-hidden="true">
          <span class="show-mon">${MONTHS_LONG[d.getMonth()].slice(0, 3)}</span>
          <span class="show-day">${d.getDate()}</span>
        </div>
        <div class="show-body">
          ${s.featured ? `<p class="show-flag">The big one</p>` : ""}
          <div class="show-h">${logoFor(s)}<h3>${esc(s.name)}</h3></div>
          <p class="show-meta">${esc(weekday(s.date))}${
            timeRange(s.start, s.end) ? ` &bull; ${esc(timeRange(s.start, s.end))}` : ""
          }</p>
          <p class="show-where"><a class="venue-link" href="${esc(mapLink(s))}" data-map-apple="${esc(appleMapLink(s))}" rel="noopener" target="_blank" aria-label="${esc(s.venue)}${s.address ? `, ${esc(s.address)}` : `, ${esc(s.city)} NY`}, where ${esc(showRef(s))} is held, opens on ${esc(hostOf(mapLink(s)))}"><span class="show-venue">${esc(s.venue)}${s.address ? "" : `, ${esc(s.city)} NY`}</span>${
            /* THE ADDRESS IS INSIDE THE LINK NOW, and it was deliberately outside
               it a few hours ago, so here is the trade rather than a silent flip.
               It was out because selecting text inside an anchor is awkward: a drag
               starts a drag on the link, and a long press on a phone opens the
               share sheet. The owner asked for it in anyway: "so the venue name and
               address are links and will open your default maps app on whatever
               platform you are on". That is the better trade now that the Apple
               swap below actually lands people in the right app, and iOS puts Copy
               on the share sheet regardless.
               ONE ANCHOR AROUND BOTH, not two anchors to the same place: two would
               read as two destinations to a screen reader and halve the tap target.
               The anchor is display:block so the whole two-line run is the target,
               which is the fix .show-links needed for the same reason. */ ""
          }${s.address ? `<span class="show-addr">${esc(s.address)}</span>` : ""}</a></p>
          <div class="show-tags">
            ${/* THREE STATES, NOT TWO, ADDED 26 August 2026 AT THE OWNER'S INSTRUCTION.
              This is a Pokemon site. He will happily list a sports show that has Pokemon on the floor, and he
              does not want to send a reader on an hour's drive to a show that has none. `pokemon: true` has
              always meant ALL-POKEMON and drives the counter tile; it could not say "sports show, Pokemon
              definitely there", which is most of this calendar.
              `pkmn: "some"` is that missing state, and it is only ever set where there is EVIDENCE: the
              organiser's own flyer, the venue's listing, or the owner having stood in the room. Absent means we
              have not confirmed it, and absent renders nothing rather than a guess dressed as a fact.
              The reader is told what the marks mean under the calendar, so an unmarked show reads as
              unconfirmed rather than as denied. */ ""}
            ${s.pokemon
              ? `<span class="chip pk">Pokemon show</span>`
              : s.pkmn === "some"
                ? `<span class="chip pk">Pokemon here too</span>`
                : s.pkmn === "none"
                  ? `<span class="chip pk-no">Sports only</span>`
                  : `<span class="chip pk-un">Pokemon not confirmed</span>`}
            ${soon ? `<span class="chip soon" data-soon>${esc(soon)}</span>` : ""}
            ${/* THE ADMISSION CHIP IS SUPPRESSED WHERE THERE ARE TIERS, added 27 August
              2026, and it is a de-duplication rather than a cut. A tiered show
              prints every price WITH THE DOOR TIME IT BUYS a few lines below
              this: "$20 Early VIP from 9am", "$5 General admission from 10am, 12
              and under free". The chip could only ever repeat the headline one
              and without the time, which is the half that matters when a show
              has two doors, and RocPokeCon shipped exactly that confusion until
              the tiers were added. Untiered shows, which is 63 of the 66, are
              untouched and still carry the chip.
              IT IS ALSO 29px OF THE 60 that had to come off the GI Cards card to
              fit an iPhone with Safari's own chrome on screen: it was the third
              chip, so it was wrapping the row onto a second line by itself. */ ""
            }${(s.tiers || []).length ? "" : `<span class="chip">${s.admission ? esc(s.admission) : "Check the listing"}</span>`}${/* TABLE COUNT,
              ADDED 26 August 2026, because it is the question the r/Rochester thread kept circling: is this show
              worth the drive. Two commenters asked whether a show was any good and what the mix was, and the size
              of the room is the fastest honest answer to both. It was already being written into blurbs by hand
              ("160+ vendor tables" on RocPokeCon), which is where a fact goes to become unsearchable and to
              disagree with itself. It is a field now. Absent on most shows, and absent renders nothing. */ ""}
            ${s.tables ? `<span class="chip">${esc(String(s.tables))} tables</span>` : ""}
          </div>
          ${/* THE `pkmnWhy` SENTENCE WAS PRINTED HERE AND IS NOT ANY MORE, 27 August
             2026. The owner asked for it off two shows on the same day, an hour
             apart, which is a preference rather than two corrections, and it was
             also 63px of the 305 that had to come off a card to fit an iPhone
             screen. THE FIELD IS NOT DELETED and must not be: `pkmn: "some"` is
             only ever set where there is evidence, and pkmnWhy is where that
             evidence is written down. It is a record now rather than a caption.
             Putting it back is this one line. */ ""}${/* THE REASON, PRINTED. Every other
            calendar asserts a category and leaves you to trust it. This one says WHY it believes Pokemon is or is not
            there, in one line, per show: whose flyer, whose post, whose vendor list. It is also the honest way to
            carry a weak claim, because "the regional calendar says so, single source" reads as exactly what it is. */ ""}
          ${s.blurb ? `<p class="show-blurb">${esc(s.blurb)}</p>` : ""}
          ${(s.tiers || []).length ? `<ul class="tiers">
            ${s.tiers.map((t) => `<li>
              <span class="tier-price">${esc(t.price)}</span>
              <span class="tier-name">${esc(t.name)}${t.from ? ` <span class="tier-from">from ${esc(clock(t.from))}</span>` : ""}</span>
              ${t.note ? `<span class="tier-note">${esc(t.note)}</span>` : ""}
            </li>`).join("\n            ")}
          </ul>` : ""}
          ${s.warn ? `<p class="show-warn">${esc(s.warn)}</p>` : ""}
          ${s.vendors?.length ? `<div class="show-vend">
            <p class="show-vend-h" id="sv-h-${esc(s.id)}">${s.date < TODAY ? "Vendors we confirmed" : "Confirmed vendors"}</p>
            <ul class="show-vend-l" aria-labelledby="sv-h-${esc(s.id)}">${showVendors(s, s.date < TODAY)}</ul>
          </div>` : ""}
          ${/* THE WHOLE PARAGRAPH IS CONDITIONAL, because it can now be empty. Every
             show used to carry a url, so this <p> always had something in it. Cold
             Front's does not: the organiser sent the flyer directly and the only
             "listing" was a third-party aggregator page carrying less than the
             flyer already shows, so the owner asked for the link to go. An empty
             <p class="show-links"> is display:flex with a 10px top margin, so it
             would have left a gap between the chips and the flyer that nothing on
             the page could explain. */ ""}
          ${s.ticketUrl || s.url || s.phone || (s.organiserUrl && s.organiserUrl !== s.url) ? `<p class="show-links">
            ${s.ticketUrl ? `<a class="tickets" href="${esc(s.ticketUrl)}" rel="noopener" target="_blank" aria-label="Get tickets for ${esc(showRef(s))}, opens on ${esc(hostOf(s.ticketUrl))}">Get tickets <span aria-hidden="true">&rarr;</span></a>` : ""}
            ${s.url ? `<a href="${esc(s.url)}" rel="noopener" target="_blank" aria-label="${s.organiserUrl && s.url === s.organiserUrl ? "Official site" : "Listing and details"} for ${esc(showRef(s))}, opens on ${esc(hostOf(s.url))}">${s.organiserUrl && s.url === s.organiserUrl ? "Official site" : "Listing &amp; details"}</a>` : ""}
            ${s.organiserUrl && s.organiserUrl !== s.url ? `<a href="${esc(s.organiserUrl)}" rel="noopener" target="_blank" aria-label="${esc(s.organiser && s.organiser !== s.name ? `${s.organiser}, who run ${showRef(s)}` : `The organizer of ${showRef(s)}`)}, opens on ${esc(hostOf(s.organiserUrl))}">${esc(s.organiser || "Organizer")}</a>` : ""}
            ${s.phone ? `<a href="${esc(telHref)}" aria-label="Call or text ${esc(telWho)} about ${esc(showRef(s))} on ${esc(s.phone)}">Call or text ${esc(s.phone)}</a>` : ""}
          </p>` : ""}
        </div>
        ${flyer ? `<button type="button" class="show-flyer" data-imglb="${esc(flyer.full)}" data-imglb-avif="${esc(flyer.fullAvif)}" data-imglb-alt="Flyer for ${esc(s.name)}, ${esc(longDate(s.date) || s.date)}">
          <picture>${flyer.avif ? `<source type="image/avif" srcset="${esc(flyer.avif)}">` : ""}
          <img src="${esc(flyer.thumb)}" alt="Flyer for ${esc(s.name)}, ${esc(longDate(s.date) || s.date)}"${flyer.w && flyer.h ? ` width="${flyer.w}" height="${flyer.h}"` : ""} loading="lazy" decoding="async"></picture>
          <span class="show-flyer-hint">Tap to enlarge</span>
        </button>` : ""}
      </article>`;
}
const page = head + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">585 &bull; Get out of the house</span>
    <h1>Card <span class="hl">shows</span> near Rochester, NY</h1>
    <p class="lede" style="max-width:36em">Every card show we can find within driving distance of Rochester, NY, Buffalo
      and Syracuse. Dates, times, where to park yourself, and what it costs to get in. Built because working this out
      every month from six different Facebook pages is genuinely annoying.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/rochester.html">Local scene</a> / Card shows</nav>
${next ? `
    <a class="next-show" data-region="${esc((regionsFor(next.city).length ? regionsFor(next.city) : [next.region]).join(" "))}" data-date="${esc(next.date)}" href="${esc(next.url || "#list")}"${next.url ? ` rel="noopener" target="_blank" aria-label="Next one up: ${esc(showRef(next))} at ${esc(next.venue)}, ${esc(next.city)}, opens on ${esc(hostOf(next.url))}"` : ""}>
      <span class="next-label">Next one up${daysAway(next.date) ? ` &bull; ${esc(daysAway(next.date))}` : ""}</span>
      <span class="next-name">${esc(next.name)}</span>
      <span class="next-meta">${esc(longDate(next.date) || next.date)}${
        timeRange(next.start, next.end) ? `, ${esc(timeRange(next.start, next.end))}` : ""
      } &bull; ${esc(next.venue)}, ${esc(next.city)}</span>
    </a>` : ""}

    <div class="facts" style="margin-top:20px">
      <div class="fact"><div class="n" data-fact="shows">${upcoming.length}</div><div class="l">Shows coming up</div></div>
      <div class="fact"><div class="n" data-fact="pkmn">${pokemonCount}</div><div class="l">Pokemon shows</div>${/* WAS "All Pokemon shows" AND THE WORD ALL WAS DOING WORK IT COULD NOT
        BACK. RIT's own listing calls RocPokeCon "centered around Pokemon but not exclusive to it" and names One
        Piece and Magic; Buffalo Trading Card Con bills itself as a "Pokemon and TCG" convention. Neither is ALL
        Pokemon. What they share, and what separates them from the rest of this page, is that Pokemon is the
        billed subject and there are no sports. That is what the number counts, so that is what it says now. */ ""}</div>
      <div class="fact"><div class="n" data-fact="free">${upcoming.filter((s) => s.admission === "Free").length}</div><div class="l">Free to get in</div></div>
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${esc(longDate(data.checked) || data.checked)}</div><div class="l">Listings last checked</div></div>
    </div>
  </div>
</section>

<section class="tight" id="list">
  <div class="wrap">
    <div class="rail">
      <div class="rail-in" role="group" aria-label="Filter by area">
        ${REGIONS.map((r) => `<button class="chip filt" type="button" data-region="${r.id}"${r.id === "all" ? ' aria-current="true"' : ""}>${esc(r.label)}</button>`).join("\n        ")}
      </div>
    </div>

    ${/* THE WAY IN TO THE ARCHIVE. It sits above the calendar rather than at the
          foot of it, because the reader who wants it is looking for a show that
          has already gone and would otherwise scroll seventeen months of
          upcoming ones to find out there is a page for that. */ ""}<p class="shows-lede"><a href="/past-shows.html">Shows that have already happened</a> are kept on their own page, newest first, with the flyers.</p>
    <div id="showList">
${byMonth
  .map(
    (g) => `    <div class="show-month" data-month="${esc(g.key)}">
      <h2 class="show-mon-h">${esc(g.label)}</h2>
${g.shows.map(showCard).join("\n")}
    </div>`
  )
  .join("\n")}
    </div>
    <!-- "or send us one" was here until 19 August 2026, and there was nowhere to
         send it: the site has no mailto, no contact page and no form. The ask is
         worth keeping, so it now names the route the rest of the site already
         uses for exactly this. /rarity.html and /upcoming.html both end "say so
         on any of the socials and it gets fixed", and /shops.html says "say
         hello on any of the socials". The footer's four social buttons are that
         route, and they are on this page too. Match those three if you edit
         this: one wording for one action. -->
    <p class="show-empty" id="showEmpty" hidden>No shows listed in that area yet. Try another area, or tell us about one on any of the socials.</p>
    ${/* THE FILTER WAS COMPLETELY SILENT, 25 August 2026. Pressing a region
          chip hid and showed shows with no announcement of any kind: no count,
          no role, nothing. A sighted reader watches 22 shows become 5; a
          screen reader reader hears the chip's own label and then silence, with
          no way to know whether anything happened or how much is left.

          #showEmpty could not cover it either. It carried no role and no
          aria-live, so even the zero case -- the one it was written for --
          appeared silently. That case is reachable: the past-date sweep in the
          same script removes .show nodes at runtime, so a stale deploy can
          empty a region that was full at build time.

          /videos.html already does this correctly with #libCount, and this is
          the same thing in the same shape. sr-only because the count is plain
          on screen already; this is the non-visual half of a change that was
          only ever visual. */ ""}
    <p class="sr-only" id="showCount" role="status"></p>
  </div>
</section>
${/* "ARE THESE SHOWS TO PURCHASE CARDS, SELL THEM OR BOTH?" -- asked on
     r/Rochester on 26 August 2026 by somebody who had never been to one, under
     a post that was nothing but this calendar. The page answered WHEN and WHERE
     and had not one word on what actually happens in the room: zero mentions of
     trade, graded, singles or cash anywhere on it.

     That is a bigger gap than any missing show. Somebody deciding whether this
     is a thing for them cannot get there from a list of dates, and a calendar
     that only serves people who already go is only half a calendar.

     EVERYTHING HERE IS FIRST HAND OR ALREADY ON THE PAGE. The owner has been
     going to these since February; the admission split is computed from the
     same data the tiles use. Nothing about etiquette, haggling or what to bring
     is asserted, because none of that is established -- "ask the vendor" is the
     honest answer and it is the one given. */ ""}
<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Never been to one?</p>
    <h2>What actually <span class="hl">happens</span> at a card show</h2>
    <p class="lede intl-lede">A room of tables, each one somebody's stock. You can buy, you can sell, and you can
      trade, at the same table, in the same visit. Nobody minds which one you are there for.</p>
    <ul class="facts-list">
      <li><b>Buy, sell or trade.</b> All three, and you do not have to decide before you walk in. Bringing cards to
        sell is as normal as bringing money to spend.</li>
      <li><b>Sealed, singles and graded.</b> Booster boxes and packs, loose cards out of binders and cases, and slabs.
        Which of the three a table carries varies table to table.</li>
      <li><b>Every vendor is different, so ask them.</b> Walk up and ask what they have and what they are after. That
        is the whole etiquette, and it is how you find the person holding the thing you want.</li>
      <li><b>${nFree} of the ${upcoming.length} coming up are free to walk into.</b> Where a show has not published a
        price we say so rather than guess, so check the listing before you head out.</li>
    </ul>
    <p style="margin-top:var(--s4)"><a class="btn btn-sky btn-sm" href="/card-show-101.html">Card show 101: how it all
      works &rarr;</a></p>
  </div>
</section>
${/* THE LEGEND LIVES AT THE FOOT OF THE CALENDAR, NOT ABOVE IT, moved 26 August
     2026 at the owner's request and he was right. Three paragraphs of
     explanation had stacked up in front of the hero: on a phone you landed on
     the page and read a key before you could see the next show or a single
     date. The marks are on the cards, so the key belongs where somebody who has
     just scrolled past thirty of them is standing, and the top of the page
     belongs to what is on this weekend. */ ""}
<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What the marks mean</p>
    <p class="lede" style="max-width:44em">Most of these are general card shows: sports, Pokemon and other TCG on the
      same floor. A show marked <b>Pokemon show</b> is a Pokemon event: Pokemon is what it is billed as and there are
      no sports, though a few also carry Magic or One Piece. One marked <b>Pokemon here too</b> is a general show where
      we have confirmed Pokemon is on the floor, either because we go to it or because the organizer says so.</p>
    <p class="lede" style="max-width:44em">A show marked <b>Pokemon not confirmed</b> is one we have not been able to
      check. Shows tend to say so when they are one thing only, so a general collectors show usually does have a mix,
      but that is a rule of thumb and not a promise. We are asking the organizers, and marks change as answers come
      back. <a href="#missed">Know a show we are missing, or can you confirm one? Tell us &rarr;</a></p>
  </div>
</section>
${(data.watchFor || []).length ? `
<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>No date yet</p>
    <h2>Worth <span class="hl">watching for</span></h2>
    <p class="lede intl-lede">Real shows that run around here but have not announced their next date. Worth a follow so
      you are not the person who finds out on the Monday after.</p>
    <ul class="watch-list">
      ${(data.watchFor || []).map((w) => `<li>
        <h3>${esc(w.name)}</h3>
        <p>${esc(w.what)}</p>
        ${w.where ? `<p class="watch-where">${esc(w.where)}</p>` : ""}
        ${w.url ? `<a class="intl-link" href="${esc(w.url)}" rel="noopener" target="_blank" aria-label="Keep an eye on it: ${esc(w.name)}, opens on ${esc(hostOf(w.url))}">Keep an eye on it &rarr;</a>` : ""}
      </li>`).join("\n      ")}
    </ul>
  </div>
</section>` : ""}

<section class="tight">
  <div class="wrap">
    <h2 id="missed">Know one we <span class="hl">missed</span>?</h2>
    <p class="lede" style="max-width:44em">This list is kept by hand, so it is only as good as what we can find. If you
      run a show, or you have a flyer from a local Discord or a shop counter, send it over on any of the socials at the
      bottom of the page and if we can confirm the date it goes up here. Flyers get shown in full.</p>
    <ul class="facts-list">
      ${/* THE AGGREGATORS ARE NAMED AND NO LONGER LINKED, on the owner's instruction:
         "we should remove any links going to outside sites that arent the official
         show sites". That is this repo's own documented test arriving here rather
         than a new rule. CLAUDE.md: "Does the READER need the destination, or does
         the SOURCE deserve a credit? The first earns a link. The second earns a
         name in plain text and nothing more." Nobody reading this calendar needs
         cardshows.io: every date, time, venue and address it gave us is printed
         on the card above, which is exactly the /decks.html argument. The credit
         is owed and is kept, in full, with the date it was read. */ ""}
      <li>Dates and times come from public listings, mostly ${(data.sources || []).map((s) => esc(s.name)).join(" and ")}, read ${esc(longDate(data.checked) || data.checked)}.</li>
      <li><strong>Always check the listing before you drive.</strong> Small shows move, sell out of tables, or get called off, and a page like this is a starting point rather than a promise.</li>
      <li>We are not the organizer of any of these and we do not take a cut. It is just a list.</li>
      <li>Shows in the Southern Tier are left off on purpose. They show up in the same feeds but they are closer to Binghamton than to any of these three cities.</li>
    </ul>
    ${/* THE LOCAL CLUSTER. This page held no in-body link to any of the other
          three Rochester, NY pages, and /vendors.html and /creators.html had no
          in-body inbound link from anywhere at all. A reader who has just
          decided not to drive to a show is the exact reader for the shops and
          the vendors, so this is a service rather than a link drop. */ ""}
    ${/* AND THE HUB, ADDED WHEN /rochester.html WAS BUILT. The paragraph above
          names the three sibling pages and it is still the right sentence, but a
          list of three siblings is not the same thing as a way UP: a reader who
          wants the local section rather than one page of it had nowhere to go,
          which is the fault the hub page exists to fix. One sentence after the
          three, not four links in one, because the three answer "what else is
          on tonight" and this one answers "what else is here at all". */ ""}
    <p class="price-note" style="margin-top:var(--s4)">Nothing on for a while? The
      <a href="/shops.html">card shops around Rochester, NY</a> are open the rest of the time and run league nights,
      <a href="/vendors.html">local vendors</a> are the sellers and breakers without a storefront, and
      <a href="/creators.html">local creators</a> is everyone else filming Pokemon up here.
      <a href="/rochester.html">Everything local in one place</a> is the short version of all of it, counted.</p>
    ${/* RUNNING A SHOW IS THE ONE THING ON THIS PAGE A READER MIGHT DO. The
          calendar is collected by hand, so the only way it covers a show is if
          somebody says so, and the flyer is the thing that makes a listing look
          like the event. The owner, 24 August 2026: "with shows I want them to send me
          flyers etc." */ ""}
    <p class="price-note" style="margin-top:var(--s4)"><b>Running a show?</b> Send the date, the venue and what a
      table costs, and attach the flyer: <a href="${esc(mailtoHref("card show listing", ["Show name: ",
      "Date and times: ", "Venue and address: ", "Admission and table cost: ", "Website or socials: ", "",
      "(attach the flyer)"]))}">email the channel</a>. Listings are collected by hand and cost nothing.</p>
  </div>
</section>

</main>
${imgLbMarkup("Show flyer or logo")}
${footer("Show listings are collected by hand and change without notice. Check with the organizer before traveling.")}
<script>
(function(){
${CLIENT_DAY_JS}
  // APPLE PLATFORMS GET APPLE MAPS. See the note over appleMapLink. Progressive
  // enhancement: the served href is the Google one and is correct with no script
  // at all, so this only ever swaps a working link for a better-targeted one.
  // The aria-label names the host it opens on, per the site's outbound rule, so
  // the LABEL has to move with the href or the page starts lying to a screen
  // reader about where it is sending them.
  try {
    var ua = navigator.userAgent || "";
    var apple = /iPhone|iPad|iPod/.test(ua) ||
      (/Mac/.test(ua) && navigator.maxTouchPoints > 1) || /Macintosh/.test(ua);
    if (apple) {
      var links = document.querySelectorAll("a[data-map-apple]");
      for (var i = 0; i < links.length; i++) {
        var a = links[i], to = a.getAttribute("data-map-apple");
        if (!to) continue;
        a.setAttribute("href", to);
        var lab = a.getAttribute("aria-label");
        if (lab) a.setAttribute("aria-label", lab.replace(/opens on .*$/, "opens on maps.apple.com"));
      }
    }
  } catch (e) {}
  // Belt and braces on dates. The build already dropped past shows, but a deploy
  // can sit for a few days, and a card show calendar that lists yesterday is
  // worse than no calendar at all.
  // todayIso(), NOT localDay(): this block is a STRING and every name in it has
  // to exist in the BROWSER. The 38-script sweep onto shared/today.mjs put a
  // node import's name in here, so the page threw on its first statement and
  // took the whole sweep with it -- past shows, empty months and the "next one
  // up" slab all stayed. todayIso is from CLIENT_DAY_JS above, same local day.
  var today = todayIso();
  document.querySelectorAll('.show').forEach(function(el){
    if (el.dataset.date < today) el.remove();
  });
  document.querySelectorAll('.show-month').forEach(function(m){
    if (!m.querySelector('.show')) m.remove();
  });
  // The "next one up" slab is neither a .show nor a .show-month, so the sweep
  // above walked straight past the single most prominent thing on the page. A
  // stale deploy showed a date that had already been and gone, in the biggest
  // type on the page, which is the exact failure this pass exists to prevent.
  var next=document.querySelector('.next-show');
  if(next && next.dataset.date && next.dataset.date < today){
    var first=document.querySelector('.show');
    if(first){
      next.querySelector('.next-name').textContent=first.querySelector('h3').textContent;
      var _v=first.querySelector('.show-venue'), _a=first.querySelector('.show-addr');
      var _where=_v ? (_v.textContent + (_a ? ', ' + _a.textContent : '')) : first.querySelector('.show-where').textContent;
      next.querySelector('.next-meta').textContent=first.querySelector('.show-meta').textContent
        + ' \u2022 ' + _where;
      var lbl=next.querySelector('.next-label');
      if(lbl) lbl.textContent='Next one up';
      var href=first.querySelector('.show-links a');
      if(href) next.setAttribute('href', href.getAttribute('href'));
      // AND THE DATE MOVES WITH IT. Without this the slab keeps the date of the
      // show it just rolled past, so the countdown guard below never fires again
      // and the label is stuck on a bare "Next one up" from then on. Never wrong,
      // just quietly less useful, which is the kind of bug that survives.
      if(first.dataset.date) next.dataset.date=first.dataset.date;
      /* AND ITS AREA. This copied the date and not the region, so on a stale
         deploy the hero repointed at a new show while keeping the old one's
         chips. Today the hero IS the dual-region show, which makes it maximally
         wrong: drop Waterloo and repoint to CollectorFest (roc), and the hero
         still answers to "syracuse", advertising a Rochester show as "Next one
         up" over a Syracuse list whose real next entry is a week later. That is
         the exact failure the filter fix was written to remove, through the
         other door. Cleared rather than left when the new card has none. */
      if(first.dataset.region) next.dataset.region=first.dataset.region;
      else next.removeAttribute('data-region');
    } else {
      next.remove();
    }
  }
  // AND THE COUNTDOWN GOES STALE WITHOUT EVER GOING PAST. The block above only
  // fires once the date has BEEN, so a page built on Wednesday still said
  // "In 4 days" when a reader opened it on Friday: not wrong enough to trip any
  // check, wrong enough to send somebody on the wrong day. The nightly rebuild
  // normally hides this, and the nightly rebuild failed on 23 and 24 August.
  // Recomputed here against the reader's own clock, mirroring daysAway() in the
  // builder exactly: Today, Tomorrow, In N days up to seven, nothing after that.
  // ONE FUNCTION, BECAUSE THE FIRST VERSION OF THIS FIXED ONE OF THE TWO PLACES
  // AND SHIPPED. The hero slab got recomputed and the per-show chips did not, so
  // a stale deploy would have said "Tomorrow" in the biggest type on the page and
  // "In 4 days" on the listing card for the SAME SHOW, one screen apart. Worse
  // than the staleness it replaced, because the page now disagrees with itself.
  function dayWord(iso){
    var away=Math.round((new Date(iso+'T12:00:00') - new Date(today+'T12:00:00'))/86400000);
    if(away<0) return null;
    return away===0 ? 'Today' : away===1 ? 'Tomorrow' : away<=7 ? 'In '+away+' days' : '';
  }
  if(next && next.dataset.date && next.dataset.date >= today){
    var lbl2=next.querySelector('.next-label');
    if(lbl2){
      var word=dayWord(next.dataset.date);
      lbl2.textContent = 'Next one up' + (word ? ' \u2022 ' + word : '');
    }
  }
  // Every listing card's own chip, against the same clock and the same wording.
  // A chip whose show is more than a week out loses the chip rather than keeping
  // a stale one, which is what daysAway() does at build time.
  document.querySelectorAll('.show[data-date]').forEach(function(el){
    var chip=el.querySelector('[data-soon]');
    if(!chip) return;
    var word=dayWord(el.dataset.date);
    if(!word) chip.remove(); else chip.textContent=word;
  });

${/* THE CALENDAR'S OWN CLIENT SWEEP WAS HERE and went with the calendar. It
        removed a .cal-dot whose date had passed and re-derived .is-past on
        every day cell against the reader's own clock. NOTHING REPLACES IT and
        nothing needs to: there is no per-date mark left on this page that the
        sweep above does not already reach. The map's marks are per-TOWN and a
        town keeps its dot for as long as it has a show. THAT IS THE ONE THING
        TO RE-READ IF THE MAP EVER GAINS A DATE.

        The dot sizes and the counts in the labels ARE stamped at build time and
        are not re-derived here, which is the same small staleness the map on
        /shops.html carries and is bounded by the nightly rebuild. A count that
        reads one high on a deploy that has stopped moving is a different order
        of wrong from a date that has already been and gone, which is the one
        unforgivable bug on this page and is what the sweep above is for.

        THIS IS THE $-BRACE-COMMENT FORM AND NOT A // LINE, deliberately: this
        block is inside the page template, so a note written as a JS comment
        here SHIPS to every reader. The file's own header records that lesson
        costing 23KB once. Notes that belong to the builder go in this form or
        out of the template entirely. */ ""}

  var empty = document.getElementById('showEmpty');
  function apply(region){
    document.querySelectorAll('.show').forEach(function(el){
      // A SHOW CAN NOW BE IN TWO AREAS, so this matches a token rather than the
      // whole attribute: data-region is "syracuse roc" for a town between them.
      el.hidden = region !== 'all' &&
        (' ' + (el.dataset.region || '') + ' ').indexOf(' ' + region + ' ') === -1;
    });
    var any = false;
    document.querySelectorAll('.show-month').forEach(function(m){
      var vis = m.querySelectorAll('.show:not([hidden])').length;
      m.hidden = vis === 0;
      if (vis) any = true;
    });
    if (empty) empty.hidden = any;
    /* THE TILES AND THE HERO MOVE WITH THE LIST, and until now neither did.
       "47 Free to get in" sat over the Syracuse list where nine of ten charge
       at the door, which is a money claim a reader acts on; and the hero kept
       advertising GI Cards in the largest type on the page after the Rochester
       filter had removed it from the list underneath. The right number was
       already being computed one line below for the screen-reader status, and
       announced only to the readers who cannot see the tiles contradicting it. */
    var shown = [].slice.call(document.querySelectorAll('.show:not([hidden])'));
    var set = function(k, v){ var el = document.querySelector('[data-fact="' + k + '"]'); if (el) el.textContent = v; };
    set('shows', shown.length);
    set('pkmn', shown.filter(function(el){ return el.dataset.pokemon === '1'; }).length);
    set('free', shown.filter(function(el){ return el.dataset.free === '1'; }).length);
    var hero = document.querySelector('.next-show');
    if (hero) hero.hidden = region !== 'all' &&
      (' ' + (hero.dataset.region || '') + ' ').indexOf(' ' + region + ' ') === -1;
    var countEl = document.getElementById('showCount');
    if (countEl) {
      var n = document.querySelectorAll('.show:not([hidden])').length;
      // THE CHIP'S OWN WORDS, NOT THE REGION ID. The ids are 'roc', 'buffalo'
      // and 'syracuse', so the id would announce "12 shows in roc". The button
      // the reader just pressed already says "Rochester, NY".
      var chip = document.querySelector('.chip.filt[data-region="' + region + '"]');
      var where = region === 'all' || !chip ? '' : ' in ' + chip.textContent.trim();
      // Built as one string and written once: the region is role="status",
      // which is implicitly aria-atomic, so a half-built value would be read
      // out on its way to the finished one.
      countEl.textContent = n === 0
        ? 'No shows' + where + '. ' + (empty ? empty.textContent : '')
        : n + (n === 1 ? ' show' : ' shows') + where + '.';
    }
  }
  document.querySelectorAll('.chip.filt').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.chip.filt').forEach(function(o){ o.removeAttribute('aria-current'); });
      b.setAttribute('aria-current','true');
      apply(b.dataset.region);
    });
  });
  /* THE TOWN NAMES ON THE MAP KEY ARE BUTTONS NOW, 26 August 2026. The map
     showed you where Batavia was and named its twelve shows, and then made you
     go back up to the area buttons to actually see them. Clicking the town does
     what the reader already expected clicking the town to do.
     IT DRIVES THE EXISTING AREA FILTER rather than adding a town filter, because
     the areas are what the list is grouped by, and a second filtering model on
     one page is how two controls end up disagreeing about what is shown. So
     Batavia selects Rochester, NY and the chip updates to match: the control that
     moved is visibly the one you already had. */
  /* THE FLYER OPENED IN A NEW TAB AND NOW OPENS IN PLACE, at the owner's
     request. A flyer is the densest thing on a show listing -- date, hours,
     admission, table price, the promoter's phone number -- and sending somebody
     to a raw .jpg on its own tab to read it means they lose the calendar and
     have to come back.
     THE HANDLER MOVED TO shared/lightbox.mjs ON 27 AUGUST 2026 and did not
     change on the way: same single node, same focus return, same Escape, same
     refuse-Tab trap. It moved because the shop, vendor and creator logos open
     in it now too, and four copies of a focus trap diverge. The organiser
     logos on THIS page are openers as well, which is why the dialog's resting
     label says flyer or logo rather than flyer. */
${imgLbJs("Show flyer or logo")}
  apply('all');
})();
</script>
${APP_JS}
</body>
</html>
`;

await mkdir(join(ROOT, "public/assets/shows"), { recursive: true });
await writeFile(join(ROOT, "public/card-shows.html"), page);

/* ------------------------------------------------------- /past-shows.html --
 *
 * ITS OWN <head>, ITS OWN CHROME, THE SAME CARDS. The head is written out here
 * rather than sliced off `head` above, because every line of that one names the
 * calendar: title, description, canonical, og:url and the share card.
 *
 * IT GOES LIVE ON ITS OWN, AND THE DATE IS THE OWNER'S. He asked for the page
 * on 27 August and said "we dont need to take the past shows archive page live
 * until Sunday", which is the day after the first show he wants in it. So it is
 * built every night from now, and ARCHIVE_LIVE_FROM decides whether it is a page
 * anybody can find: before that date it is noindex and nothing links to it,
 * after it the calendar links to it and it enters the sitemap. Nobody has to
 * remember to flip anything, which is the point.
 *
 * THE SHOW HE WANTS FIRST IN IT ARRIVES BY ITSELF FOR THE SAME REASON. GI Cards
 * is 29 August; on the 30th it stops matching `date >= TODAY` and starts
 * matching `date < TODAY`, so the nightly build moves it with no edit. He asked
 * for exactly that: "dont put it on that page until Sunday".
 */
const archiveDesc =
  `Every Pokemon and card show around Rochester, NY, Buffalo and Syracuse that has already happened, newest first, ` +
  `with the flyers. A record of what was on, and when the last one of a show was.`;

/* THE ARCHIVE'S BREADCRUMB, AND IT IS THE ONLY STRUCTURED DATA THIS PAGE GETS.
 *
 * seo-sweep.py flagged past-shows.html on 2 September 2026 as the one page in the
 * tree with no ld+json at all. The other two without it, 404.html and
 * search.html, are deliberately noindex; this one is indexable, so it was simply
 * the odd one out. 42 of the 53 root pages carry a BreadcrumbList and this page
 * already renders the visible nav for one -- Home / Card shows / Past shows -- so
 * the markup only describes what a reader can already see.
 *
 * IT DELIBERATELY DOES NOT EMIT Event, WHICH IS THE OBVIOUS THING TO COPY.
 * /card-shows.html carries 65 of them, and duplicating that here would be one
 * line of code. But Google's event rich results are for events a reader can still
 * go to, and every row on this page has already happened. Marking up sixty-odd
 * ended events buys no rich result and pushes dead dates into a slot meant for
 * live ones. The breadcrumb is the honest half.
 */
const archiveCrumbs = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Card shows", item: `${SITE}/card-shows.html` },
    // The current page carries no item URL, matching how build-shows.mjs writes
    // the last crumb on /card-shows.html itself.
    { "@type": "ListItem", position: 3, name: "Past shows" },
  ],
};

const archiveHead = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Past Card Shows Around Rochester, NY, Buffalo and Syracuse</title>
<meta name="description" content="${esc(clipMeta(archiveDesc))}">
<link rel="canonical" href="${SITE}/past-shows.html">
<meta property="og:title" content="Past card shows around Rochester, NY">
<meta property="og:description" content="${esc(archiveDesc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/past-shows.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-card-shows.jpg?v=2">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-card-shows.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
<script type="application/ld+json">${JSON.stringify(archiveCrumbs)}</script>
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main" tabindex="-1">
`;

const archive = archiveHead + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">585 &bull; The record</span>
    <h1>Past card <span class="hl">shows</span></h1>
    <p class="lede" style="max-width:36em">Every show from the calendar that has already happened, newest first,
      with the flyers kept. Useful for working out when the last one of a show was, or for finding the one you
      went to.</p>
  </div>
</header>

<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/card-shows.html">Card shows</a> / <span>Past shows</span></nav>
  <p class="shows-lede"><a href="/card-shows.html">The calendar of what is coming up</a> is the page to start on.
    Nothing here is on any more.</p>
${past.length ? `
  <div id="showList">
${pastByMonth
  .map(
    (g) => `    <div class="show-month" data-month="${esc(g.key)}">
      <h2 class="show-mon-h">${esc(g.label)}</h2>
${g.shows.map((s) => (s.date < TODAY ? showCard(s) : `<div class="show-pending" hidden data-date="${esc(s.date)}">${showCard(s)}</div>`)).join("\n")}
    </div>`
  )
  .join("\n")}
  </div>` : `
  ${/* THE EMPTY STATE IS THE STATE THIS PAGE LAUNCHES IN and it says so plainly
        rather than rendering an empty frame. The owner: "nothing to put in it
        yet". */ ""}
  <p class="show-empty">Nothing in here yet. The first show to finish since this
    page was built will appear on the morning after it happens, and every one
    after that.</p>`}
  ${/* THE READER'S OWN CLOCK, not the build's. Mirrors the sweep on
        /card-shows.html exactly: same CLIENT_DAY_JS, same local-day rule, so
        the two pages can never disagree about whether a show has happened. */ ""}
  <script>
  (function(){
${CLIENT_DAY_JS}
    var today = todayIso();
    document.querySelectorAll('.show-pending').forEach(function(el){
      if (el.dataset.date < today) {
        el.hidden = false;
        /* AND THE CHIP GOES WITH IT. These cards are built while the show is
           still ahead, so they carry a "Today" or "Tomorrow" chip; the sweep
           revealed them on the archive and left the chip alone, so a page
           headed "Nothing here is on any more" printed a show marked Today.
           Harmless while the nightly runs, and the nightly failed on 23 and 24
           August, which is the whole reason this sweep exists. card-shows.html
           already guards its own chips; this page did not. */
        var chip = el.querySelector('[data-soon]');
        if (chip) chip.remove();
      }
    });
    // A month that is still entirely ahead should not print its heading.
    document.querySelectorAll('.show-month').forEach(function(m){
      var shown = m.querySelector('.show:not([hidden])') ||
        m.querySelector('.show-pending:not([hidden])');
      if (!shown) m.hidden = true;
    });
  })();
  </script>
  <p class="shows-lede" style="margin-top:var(--s6)">Shows move on to this page by themselves the morning after they
    happen. If one you went to is missing, or a detail here is wrong, say so on any of the socials and it gets fixed.</p>
</div>
</main>
${footer("Show listings are collected by hand and change without notice. This page is a record of shows that have already happened.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/past-shows.html"), archive);

console.log(`Wrote public/card-shows.html
  ${upcoming.length} upcoming shows across ${byMonth.length} months
  ${pokemonCount} all-Pokemon, ${upcoming.filter((s) => s.admission === "Free").length} free entry
  next: ${next ? `${next.name}, ${next.date}, ${next.city}` : "nothing listed"}
  ${(data.shows || []).length - upcoming.length} past show(s) dropped
  flyers: ${upcoming.filter((s) => s.flyer).length} named`);
if (missingLogos.length) {
  console.log(`\n  ${missingLogos.length} logo(s) named in the data but not on disk:`);
  for (const m of missingLogos) console.log(`    ${m}`);
}
if (missingFlyers.length) {
  console.log(`\n${missingFlyers.length} flyer(s) named but missing:`);
  for (const m of missingFlyers) console.log("  " + m);
}
