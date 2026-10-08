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

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, mailtoHref, SHOW_FORM } from "../shared/site.mjs";
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
import { slugify } from "../shared/paths.mjs";
import { avifSource } from "../shared/logo-srcset.mjs";

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
        avifSource(ROOT, "creators", v.logo, "34px") +
        `<img src="/assets/creators/${esc(v.logo)}-200.webp" alt="" width="34" height="${mh}" loading="lazy" decoding="async" ` +
        `srcset="/assets/creators/${esc(v.logo)}-200.webp 200w, /assets/creators/${esc(v.logo)}-400.webp 400w" sizes="34px"></picture></span>`;
    }

    /* WHAT THEY SELL, NOT HOW WE KNOW THEY ARE COMING. The owner, 3 September
       2026: "lets remove the text below their name and logo on how we confirmed
       it ... if its confirmed that means I confirmed it myself from a flyer or
       with a vendor or both". He is right that the provenance was answering a
       question the reader never asked: the heading already says CONFIRMED, and
       he is the one who confirmed it. A reader looking at a show wants to know
       what this vendor brings.

       THE `confirmed` SENTENCE IS STILL REQUIRED AND STILL CHECKED, it just
       stops being printed. The guard above still throws on a missing or blank
       one, and every note written so far is kept in data/shows.json. That is
       deliberate: the reason this list is worth trusting is that each row has a
       source behind it, and dropping the field because the page stopped showing
       it would quietly turn a checked list into an unchecked one.

       The link now goes to the vendor's own card rather than the top of the
       page, using the anchor build-locals.mjs writes from the same slugify. */
    const what = typeof v.sells === "string" && v.sells.trim() ? v.sells.trim() : "";
    return `<li class="sv"><a class="sv-link" href="/vendors.html#v-${esc(slugify(v.name || ""))}" aria-label="${
      esc(v.name)}, on the vendors page">${mark}<span class="sv-id">${esc(v.name)}</span></a>` +
      (what ? `<span class="sv-src">${esc(what)}</span>` : "") + `</li>`;
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
/* A SHOW OUT OF AREA BUT INSIDE A DRIVE STILL BELONGS UNDER THE NEAREST CITY'S
   CHIP. The owner, 8 September 2026, asked for exactly this and set the number:
   "ill take your suggestion of 2 hours drives from the main cities, could maybe
   extended it to 3 hours but not further than that."

   WHAT IT FIXES. `farAfield` rows get region "away", which no chip carries, so
   they appeared ONLY under All. A Buffalo collector pressing "Buffalo & Niagara"
   -- the obvious thing to press -- never saw the Erie show at all, though it is a
   two hour drive and the nearest out-of-state show to them. That is the same
   fault the DUAL_MI note above describes for Waterloo: the chip a reader
   obviously presses hiding the show they would most want.

   IT IS A DRIVE, NOT A RADIUS, AND THAT DISTINCTION IS THE WHOLE POINT. The 45
   mile rule stays where it is and stays in straight lines; this reads measured
   ROAD time out of data/shows.json's `_drives`, which is why Erie qualifies at
   92 road miles when its 81 mile straight line tells you nothing useful about a
   lake shore. Nothing is computed here and no build touches the network.

   SET AT TWO HOURS, HIS PRIMARY NUMBER, NOT THE THREE HE WOULD TOLERATE, AND
   TODAY THE TWO ARE THE SAME PAGE. Measured: Erie is 1h59m from Buffalo and
   3h19m from Rochester, NY; Harmony PA is 3h41m from Buffalo, its own nearest
   city. So at 2 hours exactly one pairing qualifies, Erie under Buffalo, and at
   3 hours it is still exactly that one -- Erie/Rochester and Harmony/Buffalo both
   fall outside either way. Taking the tighter number costs nothing today and is
   one constant to move when it does. Do not raise it past 3. */
const DRIVE_HOURS = 2;
const drives = data._drives || {};
const driveFor = (city) => {
  const dr = drives[city];
  return dr && typeof dr.hours === "number" ? dr : null;
};
/* The nearest city's chip, but ONLY when the measured drive is inside the
   threshold. A town with no measured drive returns nothing, which is the honest
   default: absent evidence is not a short drive. */
const driveRegions = (city) => {
  const dr = driveFor(city);
  return dr && dr.hours <= DRIVE_HOURS && dr.anchor ? [dr.anchor] : [];
};
/* Straight-line chips first, then any earned by a drive, de-duplicated. Falls
   back to the row's own `region` so an away show with no qualifying drive still
   carries "away" and still appears under All, exactly as before. */
const chipRegions = (s) => {
  const merged = [...new Set([...regionsFor(s.city), ...driveRegions(s.city)])];
  return merged.length ? merged : [s.region];
};

const areaProblems = [];
for (const s of data.shows || []) {
  const pt = towns[s.city];
  if (!pt) {
    areaProblems.push(`${s.id}: ${s.city} has no lat/lon in _towns, so it cannot be placed`);
    continue;
  }
  /* A NAMED, REASONED OPT-OUT RATHER THAN A WIDER RADIUS, and the difference is
     the whole point of this guard. The owner, 3 September 2026, on The Big Show
     in Harmony, PA: "its still driving distance from Rochester, NY so its worth
     adding to the show page list". It is 158 miles from Buffalo and 208 from
     Rochester, against a 45 mile rule whose farthest current city is Dryden at
     39. Widening RADIUS_MI to reach it would have to go to 160+, which would
     stop catching anything: every mis-filed row this check exists for, and most
     of Ontario, Cleveland and Pennsylvania besides.

     THERE ARE TWO GROUNDS FOR THE OPT-OUT NOW, added 9 September 2026, and only
     the first is about distance. The second is the owner's: "we can make these
     types of exceptions when its one of our confirmed local vendors is vending at
     a show out of state or further away ... and list them as confirmed to show
     support." That one has no limit -- EC3CON at Mohegan Sun is SIX HOURS from
     Syracuse -- because it is not a claim that the show is near, it is a claim
     that somebody local is going. A row added on that ground exists FOR its
     `vendors` entry, so one that loses its local vendor has lost its reason.

     So the radius stays where it is and a row may opt OUT of it by saying why.
     `farAfield` is a sentence, not a boolean, because the reason is the thing
     worth keeping: a future editor reads why this one is here rather than
     finding a flag and guessing. The city must STILL be in _towns, so a typo is
     still caught -- the exemption is from the distance rule, not from being
     placed at all -- and the distance is printed so the decision stays visible.

     Such a show gets `region: "away"`. regionsFor() returns nothing past the
     radius, so the card falls back to that, and apply() in the page script
     shows it under All and hides it under the three area buttons. That is the
     honest behaviour: it is genuinely not near any of them. */
  if (s.farAfield) {
    const near = nearestAnchor(pt);
    console.log(`  ${s.id}: out of area on purpose, ${near.mi.toFixed(0)} mi from ${near.id}. ${s.farAfield}`);
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

/* ---------------------------------------------- runs, days and far out --
 *
 * THE PHONE REDESIGN, 8 October 2026. The owner asked for the busiest page on
 * the site to be "the best it can be on phones", five agents audited it, and he
 * approved the mockup. Three of the changes are about how the list is CUT, and
 * all three are decided here, at build time, from the data:
 *
 * - A MULTI-DAY SHOW IS ONE CARD. The file stores one row per day (Buffalo
 *   Trading Card Con is three rows), which is right for the Event markup and
 *   wrong for a reader: those repeats were 4,670px of a 41,718px page at 390.
 *   A RUN is consecutive days with the same name and venue. Its fields come off
 *   the first day, its hours are listed per day, and its vendors are the union
 *   of every day's, because a vendor confirmed for Saturday is still at the show.
 *   The JSON-LD keeps one Event per DAY and does not use runs at all.
 * - THE LIST IS GROUPED BY DAY, NOT MONTH. 60 of 66 shows fall on a weekend and
 *   the question is "what is on Saturday", which a month heading 13,000px tall
 *   cannot answer.
 * - ANYTHING MORE THAN FAR_DAYS OUT IS A ONE LINE ROW that opens to the full
 *   card. Those were 29% of the page and are mostly next year's monthly repeats,
 *   where the date, the name and the town are all anybody needs from a row. The
 *   full card is still in the HTML inside the <details>, so nothing is hidden
 *   from search or from a reader with no script.
 */
const FAR_DAYS = 60;
const addDays = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const dayGap = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const WD3 = (iso) => weekday(iso).slice(0, 3);
const MON3 = (iso) => MONTHS_LONG[Number(iso.slice(5, 7)) - 1].slice(0, 3);
const DNUM = (iso) => Number(iso.slice(8, 10));

function toRuns(list) {
  const out = [], open = new Map();
  for (const s of list) {
    const k = `${s.name}|${s.venue}`, prev = open.get(k);
    if (prev && dayGap(prev.days[prev.days.length - 1].date, s.date) === 1) {
      prev.days.push(s);
      prev.last = s.date;
      for (const v of s.vendors || []) if (!prev.vendors.some((x) => x.name === v.name)) prev.vendors.push(v);
      for (const f of ["flyer", "flyerW", "flyerH", "blurb", "url", "ticketUrl", "phone", "organiserUrl", "logo"]) {
        if (!prev[f] && s[f]) prev[f] = s[f];
      }
      continue;
    }
    const r = { ...s, days: [s], last: s.date, vendors: [...(s.vendors || [])] };
    open.set(k, r);
    out.push(r);
  }
  return out;
}
const runs = toRuns(upcoming);
const farFrom = addDays(TODAY, FAR_DAYS);
const nearRuns = runs.filter((r) => r.date <= farFrom);
const farRuns = runs.filter((r) => r.date > farFrom);
const byDay = [];
for (const r of nearRuns) {
  let g = byDay.find((x) => x.date === r.date);
  if (!g) byDay.push((g = { date: r.date, runs: [] }));
  g.runs.push(r);
}

/* THE WEEKEND, Friday to Sunday. Monday to Thursday it is the coming one; from
   Friday it starts today. The page script recomputes this on the reader's own
   clock, so this copy only decides what a reader with no script sees. UTC day
   arithmetic, because local noon arithmetic was a day out in EDT the first time
   it was prototyped. */
const weekendOf = (iso) => {
  const d = new Date(iso + "T00:00:00Z").getUTCDay();
  const fri = d === 0 ? addDays(iso, -2) : d === 6 ? addDays(iso, -1) : addDays(iso, (5 - d + 7) % 7);
  return [fri < iso ? iso : fri, addDays(fri, 2)];
};

/* ONE LINE A READER CAN SCAN: hours, town, price. The town is the city field
   AS PRINTED, so Rochester keeps its ", NY" exactly as everywhere else on the
   site. A show that has not published its hours or its price says so in words
   rather than with a pill that looks like a button: "Check the listing" sat on
   18 cards that had no listing to check. */
const hoursOf = (run) =>
  run.days.length === 1
    ? timeRange(run.days[0].start, run.days[0].end) || "Hours not published"
    : run.days.map((d) => `${WD3(d.date)} ${timeRange(d.start, d.end) || "hours not published"}`).join(", ");
const priceOf = (s) => {
  if (s.admission) return s.admission;
  const t = (s.tiers || []).map((x) => x.price).filter(Boolean);
  if (!t.length) return null;
  const n = (p) => parseFloat(String(p).replace(/[^0-9.]/g, "")) || 0;
  return `From ${t.sort((a, b) => n(a) - n(b))[0]}`;
};
const longWhen = (run) => {
  const a = run.days[0].date, b = run.days[run.days.length - 1].date;
  const one = (iso) => `${weekday(iso)}, ${MONTHS_LONG[Number(iso.slice(5, 7)) - 1]} ${DNUM(iso)}`;
  return a === b ? one(a) : `${one(a)} to ${one(b)}`;
};
const dirLink = (s) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery(s))}`;
const appleDirLink = (s) => `https://maps.apple.com/?daddr=${encodeURIComponent(mapQuery(s))}`;
const townPt = (city) => (Array.isArray(towns[city]) ? towns[city] : null);
const unitData = (s) => {
  const pt = townPt(s.city), lastDay = s.days[s.days.length - 1];
  return ` data-region="${esc(chipRegions(s).join(" "))}" data-date="${esc(s.date)}" data-last="${esc(s.last || s.date)}"` +
    `${lastDay.end ? ` data-end="${esc(lastDay.end)}"` : ""}${pt ? ` data-lat="${pt[0]}" data-lon="${pt[1]}"` : ""}` +
    `${s.pokemon ? ' data-pokemon="1"' : ""}${s.admission === "Free" ? ' data-free="1"' : ""}${s.vendors?.length ? ' data-vendors="1"' : ""}`;
};

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
  const t280 = rel.replace(/\.(jpg|jpeg|png|webp)$/i, "-280.$1");
  const a280 = rel.replace(/\.(jpg|jpeg|png|webp)$/i, "-280.avif");
  return { thumb: `/${rel}`, full: `/${full}`,
    t280: has(t280) ? `/${t280}` : "", avif280: has(a280) ? `/${a280}` : "",
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
            ${avifSource(ROOT, "shows", s.logo, "(min-width:720px) 80px, 56px")}
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
      // READ OFF THE PRINTED ADDRESS, NOT ASSUMED, 8 October 2026. This
      // hard-coded addressRegion "NY", so The Big Show told Google it was in
      // "Harmony, PA, NY" and EC3CON in Uncasville, CT was filed under NY, and
      // no Event carried the zip the card prints. The town, state and zip are
      // the tail of every address in data/shows.json ("..., Lewiston, NY
      // 14092"); a row without that tail keeps the old city-and-NY fallback.
      address: (() => {
        const m = /,\s*([^,]+),\s*([A-Z]{2})(?:\s+(\d{5}))?\s*$/.exec(s.address || "");
        return {
          "@type": "PostalAddress",
          ...(s.address ? { streetAddress: s.address.split(",")[0] } : {}),
          addressLocality: m ? m[1].trim() : bareCity(s.city),
          addressRegion: m ? m[2] : "NY",
          ...(m && m[3] ? { postalCode: m[3] } : {}),
          addressCountry: "US",
        };
      })(),
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
function showCard(input, opts = {}) {
  /* A RUN OR A SINGLE ROW. The calendar passes runs (see toRuns); the archive
     passes one row per day and keeps doing so, because a past show is looked up
     by the day somebody went. */
  const s = input.days ? input : { ...input, days: [input], last: input.date };
  const first = s.days[0].date, last = s.days[s.days.length - 1].date;
  const archive = !!opts.archive;
  const flyer = flyerSrc(s);
  /* THE LABEL IS THE ORGANIZER'S OWN FORMATTING AND THE HREF IS DIGITS, because
     a reader recognises the number as the one printed on the flyer while the
     dialler only accepts E.164. Both come off ONE field so they cannot drift. */
  const telHref = s.phone ? `tel:+1${String(s.phone).replace(/\D/g, "")}` : null;
  const telWho = s.organiser || s.name;
  const price = priceOf(s);
  /* THE UNIT ATTRIBUTES. Everything the page script filters, sorts or sweeps on
     is on the element it hides, so the script never has to read card text. On a
     far-out row the <details> is the unit and carries them instead, and the
     archive's cards are not units at all. */
  const cls = `show${s.featured ? " is-featured" : ""}`;
  const open = opts.unit === false ? ` class="${cls}"`
    : archive ? ` class="${cls}" data-date="${esc(first)}"`
    : ` id="s-${esc(s.id)}" class="${cls} cs-unit"${unitData(s)}`;
  const when = first === last
    ? `<span class="show-wd">${WD3(first)}</span><span class="show-day">${DNUM(first)}</span><span class="show-mon">${MON3(first)}</span>`
    : `<span class="show-wd">${WD3(first)}&ndash;${WD3(last)}</span><span class="show-day">${DNUM(first)}&ndash;${DNUM(last)}</span><span class="show-mon">${MON3(first) === MON3(last) ? MON3(first) : `${MON3(first)}&ndash;${MON3(last)}`}</span>`;
  return `      <article${open}>
          ${flyer ? `<button type="button" class="show-flyer" data-imglb="${esc(flyer.full)}" data-imglb-avif="${esc(flyer.fullAvif)}" data-imglb-alt="Flyer for ${esc(s.name)}, ${esc(longDate(first) || first)}">
            <picture>${flyer.avif ? `<source type="image/avif" srcset="${flyer.avif280 ? `${esc(flyer.avif280)} 280w, ` : ""}${esc(flyer.avif)} 440w" sizes="(min-width:720px) 120px, 64px">` : ""}<img src="${esc(flyer.t280 || flyer.thumb)}" srcset="${flyer.t280 ? `${esc(flyer.t280)} 280w, ` : ""}${esc(flyer.thumb)} 440w" sizes="(min-width:720px) 120px, 64px" alt="Flyer for ${esc(s.name)}, ${esc(longDate(first) || first)}. Opens larger"${flyer.w && flyer.h ? ` width="${flyer.w}" height="${flyer.h}"` : ""} loading="lazy" decoding="async"></picture>
            <span class="show-flyer-tag" aria-hidden="true">Flyer</span>
          </button>` : ""}
        <div class="show-top">
          <div class="show-when${first === last ? "" : " is-run"}" aria-hidden="true">${when}</div>
          <div class="show-head">
            ${s.featured ? `<p class="show-flag">The big one</p>` : ""}
            <h3>${esc(s.name)}<span class="sr-only">, ${esc(longWhen(s))}</span></h3>
            <p class="show-meta"><span>${esc(hoursOf(s))}</span><span class="show-town">${esc(s.city)}</span><span class="show-price${price ? "" : " is-none"}">${price ? esc(price) : "Price not published"}</span></p>
          </div>
        </div>
        <div class="show-org">${logoFor(s)}<p class="show-where"><a class="venue-link" href="${esc(mapLink(s))}" data-map-apple="${esc(appleMapLink(s))}" rel="noopener" target="_blank" aria-label="${esc(s.venue)}${s.address ? `, ${esc(s.address)}` : `, ${esc(s.city)} NY`}, where ${esc(showRef(s))} is held, opens on ${esc(hostOf(mapLink(s)))}"><span class="show-venue">${esc(s.venue)}${s.address ? "" : `, ${esc(s.city)} NY`}</span>${s.address ? `<span class="show-addr">${esc(s.address)}</span>` : ""}</a></p></div>
        <div class="show-tags">
          ${s.pokemon
            ? `<span class="chip pk">Pokemon show</span>`
            : s.pkmn === "some"
              ? `<span class="chip pk-some">Pokemon here too</span>`
              : s.pkmn === "none"
                ? `<span class="chip pk-no">Sports only</span>`
                : `<span class="chip pk-un">Pokemon not confirmed</span>`}
          ${archive ? "" : `<span class="chip soon" data-soon${daysAway(first) ? "" : " hidden"}>${esc(daysAway(first) || "")}</span>`}
          ${(() => {
            const dr = driveFor(s.city);
            return dr ? `<span class="chip drive">Drive: ${esc(dr.label)} from ${esc(dr.anchorName)}</span>` : "";
          })()}
          ${s.tables ? `<span class="chip">${esc(String(s.tables))} tables</span>` : ""}
          ${archive ? "" : `<span class="chip dist" data-dist hidden></span>`}
        </div>
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
            <p class="show-vend-h" id="sv-h-${esc(s.id)}${opts.unit === false ? "-x" : ""}">${archive ? "Vendors we confirmed" : "Confirmed vendors"}</p>
            <ul class="show-vend-l" aria-labelledby="sv-h-${esc(s.id)}${opts.unit === false ? "-x" : ""}">${showVendors(s, archive)}</ul>
          </div>` : ""}
          ${archive ? "" : `<div class="show-acts">
            <a class="show-act" href="${esc(dirLink(s))}" data-map-apple="${esc(appleDirLink(s))}" rel="noopener" target="_blank" aria-label="Directions to ${esc(s.venue)} for ${esc(showRef(s))}, opens on ${esc(hostOf(dirLink(s)))}">Directions</a>
            <a class="show-act" href="/shows/ics/${esc(s.id)}.ics" aria-label="Add ${esc(showRef(s))} to your calendar">Calendar</a>
            <button type="button" class="show-act" data-share="s-${esc(s.id)}" data-share-title="${esc(s.name)}, ${esc(longWhen(s))}" hidden>Share</button>
          </div>`}
          ${s.ticketUrl || s.url || s.phone || (s.organiserUrl && s.organiserUrl !== s.url) ? `<p class="show-links">
            ${s.ticketUrl ? `<a class="tickets" href="${esc(s.ticketUrl)}" rel="noopener" target="_blank" aria-label="Get tickets for ${esc(showRef(s))}, opens on ${esc(hostOf(s.ticketUrl))}">Get tickets <span aria-hidden="true">&rarr;</span></a>` : ""}
            ${s.url ? `<a href="${esc(s.url)}" rel="noopener" target="_blank" aria-label="${s.organiserUrl && s.url === s.organiserUrl ? "Official site" : "Listing and details"} for ${esc(showRef(s))}, opens on ${esc(hostOf(s.url))}">${s.organiserUrl && s.url === s.organiserUrl ? "Official site" : "Listing &amp; details"}</a>` : ""}
            ${s.organiserUrl && s.organiserUrl !== s.url ? `<a href="${esc(s.organiserUrl)}" rel="noopener" target="_blank" aria-label="${esc(s.organiser && s.organiser !== s.name ? `${s.organiser}, who run ${showRef(s)}` : `The organizer of ${showRef(s)}`)}, opens on ${esc(hostOf(s.organiserUrl))}">${esc(s.organiser || "Organizer")}</a>` : ""}
            ${s.phone ? `<a href="${esc(telHref)}" aria-label="Call or text ${esc(s.phone)}, ${esc(telWho)}, about ${esc(showRef(s))}">Call or text ${esc(s.phone)}</a>` : ""}
          </p>` : ""}
      </article>`;
}
// THE PHONE LINK'S NAME NOW STARTS WITH ITS VISIBLE TEXT (WCAG 2.5.3): it was
// "Call or text <organizer> about <show> on <number>" against a visible "Call or
// text <number>". The calendar button is a plain internal link to a prebuilt .ics,
// so it needs no script and no outbound label.
const page = head + `
<header class="set-hero cs-hero">
  <div class="wrap">
    <span class="kicker">585 &bull; Get out of the house</span>
    <h1>Card <span class="hl">shows</span> near Rochester,&nbsp;NY, Buffalo and Syracuse</h1>
    <p class="lede">Every Pokemon and trading card show within a drive of Rochester,&nbsp;NY, Buffalo and Syracuse, collected by hand.</p>
  </div>
</header>
${/* THE FIRST SCREEN IS THE CALENDAR NOW, 8 October 2026. At 390x844 the first
     show card used to start at y=1,236, a screen and a half down, behind a
     three-sentence lede, a breadcrumb, the "Next one up" slab and four stat
     tiles, none of which a reader can act on. The slab and the tiles are gone:
     the slab hid itself under every area filter and once advertised a show in
     Pennsylvania, and the weekend strip below does its job better. The "last
     checked" date is a quiet line rather than a big pink figure. */ ""}
<section class="tight cs-top">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/rochester.html">Local scene</a> / Card shows</nav>
    ${/* THE FIND PANEL SHIPS HIDDEN AND THE SCRIPT REVEALS IT, because every
          control in it needs the script, and a dead control is worse than none.
          With no script the list below is complete and in date order. */ ""}
    <div class="cs-find" id="csFind" hidden>
      <form class="cs-near" id="csNear" role="search" aria-label="Find shows near you">
        <label class="sr-only" for="csWhere">Zip code or town</label>
        <input id="csWhere" type="text" placeholder="Zip or town" autocomplete="postal-code" enterkeyhint="search" spellcheck="false">
        <button type="submit" class="btn btn-ghost btn-sm">Go</button>
        <button type="button" class="btn btn-sky btn-sm" id="csLocate">Near me</button>
      </form>
      <p class="cs-hint" id="csHint" aria-live="polite"></p>
      <div class="cs-group" role="group" aria-label="Area">
        ${REGIONS.map((r) => `<button class="chip filt" type="button" data-region="${r.id}" aria-pressed="${r.id === "all"}">${esc(r.label)}</button>`).join("\n        ")}
      </div>
      <div class="cs-group" id="csDist" role="group" aria-label="Distance and order" hidden>
        <button class="chip df" type="button" data-within="25" aria-pressed="false">Within 25 mi</button>
        <button class="chip df" type="button" data-within="50" aria-pressed="false">Within 50 mi</button>
        <button class="chip df" type="button" data-within="0" aria-pressed="true">Any distance</button>
        <button class="chip sf" type="button" data-sort="near" aria-pressed="false">Nearest first</button>
      </div>
    </div>
    <p class="cs-checked">Listings last checked ${esc(longDate(data.checked) || data.checked)}. <a href="/past-shows.html">Past shows</a> are kept on their own page, with the flyers.</p>
  </div>
</section>
${(() => {
  /* THE WEEKEND STRIP, which replaced "Next one up". Twelve tiles are built and
     the script shows the ones inside this Friday to Sunday, or the next four if
     the weekend is empty; the build makes the same call on its own clock for a
     reader with no script. A tile is a link to its card on this page, so the
     biggest tap targets at the top stay on the site. No flyer, no picture: a
     tile without one is just the date, the name and the town. */
  const [ws, we] = weekendOf(TODAY);
  const tiles = runs.slice(0, 12);
  const inWk = (r) => r.date <= we && r.last >= ws;
  const anyWk = tiles.some(inWk);
  const tileWhen = (r) => `${WD3(r.date)} ${MON3(r.date)} ${DNUM(r.date)}${r.last !== r.date ? `&ndash;${DNUM(r.last)}` : ""}`;
  return `
<section class="tight cs-wk" aria-labelledby="csWkH">
  <div class="wrap">
    <h2 class="sec-label cs-wk-h" id="csWkH"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg><span id="csWkLbl">${anyWk ? "This weekend" : "Coming up next"}</span></h2>
    <div class="wk-strip">
${tiles.map((r, i) => {
  const f = flyerSrc(r);
  const show = anyWk ? inWk(r) : i < 4;
  const p = priceOf(r);
  return `      <a class="wk-tile" href="#s-${esc(r.id)}" data-date="${esc(r.date)}" data-last="${esc(r.last)}" data-region="${esc(chipRegions(r).join(" "))}"${townPt(r.city) ? ` data-lat="${townPt(r.city)[0]}" data-lon="${townPt(r.city)[1]}"` : ""}${show ? "" : " hidden"}>${f ? `<picture>${f.avif ? `<source type="image/avif" srcset="${f.avif280 ? `${esc(f.avif280)} 280w, ` : ""}${esc(f.avif)} 440w" sizes="(min-width:720px) 200px, 44vw">` : ""}<img src="${esc(f.t280 || f.thumb)}" srcset="${f.t280 ? `${esc(f.t280)} 280w, ` : ""}${esc(f.thumb)} 440w" sizes="(min-width:720px) 200px, 44vw" alt="" width="160" height="90" decoding="async"${i > 2 ? ' loading="lazy"' : ""}></picture>` : ""}<span class="wk-b"><span class="wk-d">${tileWhen(r)}</span><span class="wk-t">${esc(r.name)}</span><span class="wk-m">${esc(r.city)} &bull; ${p ? esc(p) : "Price not published"}</span></span></a>`;
}).join("\n")}
    </div>
  </div>
</section>`;
})()}

<section class="tight" id="list">
  <div class="rail cs-rail" id="csRail" hidden>
    <div class="rail-in cs-q" role="group" aria-label="Filter shows">
      <button class="chip qf" type="button" data-q="weekend" aria-pressed="false">This weekend</button>
      <button class="chip qf" type="button" data-q="30" aria-pressed="false" aria-label="Next 30 days">30 days</button>
      <button class="chip qf" type="button" data-q="free" aria-pressed="false" aria-label="Free entry">Free</button>
      <button class="chip qf" type="button" data-q="pk" aria-pressed="false" aria-label="Pokemon shows">Pokemon</button>
    </div>
    <div class="cs-status"><span id="showCount" role="status"></span><button type="button" class="cs-clear" id="csClear" hidden>Clear all</button></div>
  </div>
  <div class="wrap">
    <div id="showList">
${byDay
  .map(
    (g) => `    <div class="show-dayg" data-day="${esc(g.date)}">
      <h2 class="show-day-h"><span>${esc(`${weekday(g.date)}, ${MONTHS_LONG[Number(g.date.slice(5, 7)) - 1]} ${DNUM(g.date)}`)}</span><span class="show-day-n">${g.runs.length} ${g.runs.length === 1 ? "show" : "shows"}</span></h2>
${g.runs.map((r) => showCard(r)).join("\n")}
    </div>`
  )
  .join("\n")}
${farRuns.length ? `    <div class="show-dayg show-further" id="further">
      <h2 class="show-day-h"><span>Further out</span><span class="show-day-n">${farRuns.length} ${farRuns.length === 1 ? "show" : "shows"}</span></h2>
${farRuns.map((r) => {
  const p = priceOf(r);
  return `      <details class="cs-far cs-unit" id="s-${esc(r.id)}"${unitData(r)}>
        <summary><span class="far-d">${WD3(r.date)} ${MON3(r.date)} ${DNUM(r.date)}${r.last !== r.date ? `&ndash;${DNUM(r.last)}` : ""}</span><span class="far-t">${esc(r.name)}<span class="far-m">${esc(r.city)} &bull; ${p ? esc(p) : "Price not published"}</span></span><span class="far-x" aria-hidden="true"></span></summary>
${showCard(r, { unit: false })}
      </details>`;
}).join("\n")}
    </div>` : ""}
    </div>
    <div id="showFlat" hidden></div>
    <div class="show-empty" id="showEmpty" hidden>
      <p>No shows match these filters.</p>
      <p><button type="button" class="btn btn-ghost btn-sm" id="csClear2">Clear filters</button> <a href="${esc(SHOW_FORM)}" rel="noopener" target="_blank" aria-label="Know one we missed? Submit it on our Google Form, opens on forms.gle">Know one we missed? Submit it</a></p>
    </div>
    <p class="cs-submit"><b>Know a show we missed?</b> <a href="${esc(SHOW_FORM)}" rel="noopener" target="_blank" aria-label="Submit a show on our Google Form, opens on forms.gle">Submit it here</a>. It takes about three minutes, and you can upload the flyer.</p>
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
      <li><b><span data-all="free">${nFree}</span> of the <span data-all="shows">${upcoming.length}</span> coming up are free to walk into.</b> Where a show has not published a
        price we say so rather than guess, so check the listing before you head out.</li>
    </ul>
    ${/* BEFORE YOU GO, 8 October 2026, from the redesign the owner approved. The
          note above this section said nothing about what to bring is asserted
          because none of it was established. Three things now are, and they are
          written as advice rather than as facts about any one show: cash comes up
          in every collector thread the research agent read (and a venue ATM's
          fee with it), a budget for kids came from parents in the same threads,
          and a zipped binder from a news story about a card stolen at a show.
          Nothing here names a show, a price or a rule. */ ""}
    <h3 class="cs-tips-h">Before you go</h3>
    <ul class="cs-tips">
      <li>Bring some cash. Plenty of tables take cards now, but not all of them, and an ATM at the venue usually charges a fee.</li>
      <li>Agree on a budget with kids before you walk in. It is easy to spend it all at the first table.</li>
      <li>Keep your own cards in a binder that zips or a case, especially in a busy room.</li>
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
      run a show, or you have a flyer from a local Discord or a shop counter, the show form takes every detail plus
      the flyer and logo as uploads, in about three minutes. Email or any of the socials at the bottom of the page work
      too. If we can confirm the date it goes up here, and flyers get shown in full.</p>
    <p class="btn-row" style="margin:var(--s4) 0 var(--s2)"><a class="btn btn-sky btn-sm" href="${esc(SHOW_FORM)}" rel="noopener" target="_blank" aria-label="Submit a show on our Google Form, opens on forms.gle">Submit a show</a></p>
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
    <p class="price-note" style="margin-top:var(--s4)"><b>Running a show?</b> <a href="${esc(SHOW_FORM)}" rel="noopener" target="_blank" aria-label="Use the show form, our Google Form, opens on forms.gle">Use the show form</a>
      (it asks you to sign in with Google so it can take the flyer), or send the date, the venue and what a
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
  var today = todayIso();
  var now = new Date();
  var nowHM = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
  function over(el){
    var last = el.dataset.last || el.dataset.date;
    if (last < today) return true;
    return last === today && el.dataset.end && el.dataset.end <= nowHM;
  }
  [].slice.call(document.querySelectorAll('.cs-unit, .wk-tile')).forEach(function(el){ if (over(el)) el.remove(); });
  document.querySelectorAll('.show-dayg').forEach(function(g){ if (!g.querySelector('.cs-unit')) g.remove(); });
  (function(){
    var all = document.querySelectorAll('.cs-unit');
    var free = 0; all.forEach(function(el){ if (el.dataset.free === '1') free++; });
    document.querySelectorAll('[data-all="shows"]').forEach(function(el){ el.textContent = all.length; });
    document.querySelectorAll('[data-all="free"]').forEach(function(el){ el.textContent = free; });
  })();
  function dn(iso){ return Date.parse(iso + 'T00:00:00Z') / 864e5; }
  function isoOf(n){ return new Date(n * 864e5).toISOString().slice(0, 10); }
  function dayWord(el){
    var a = el.dataset.date, b = el.dataset.last || a;
    if (a <= today && b >= today) return 'Today';
    var away = dn(a) - dn(today);
    return away === 1 ? 'Tomorrow' : away > 1 && away <= 7 ? 'In ' + away + ' days' : '';
  }
  document.querySelectorAll('.cs-unit').forEach(function(el){
    var chip = el.querySelector('[data-soon]');
    if (!chip) return;
    var w = dayWord(el);
    chip.textContent = w; chip.hidden = !w;
  });
  function weekend(){
    var t = dn(today), d = new Date(today + 'T00:00:00Z').getUTCDay();
    var fri = d === 0 ? t - 2 : d === 6 ? t - 1 : t + ((5 - d + 7) % 7);
    return [isoOf(Math.max(fri, t)), isoOf(fri + 2)];
  }
  var WK = weekend(), D30 = [today, isoOf(dn(today) + 29)];
  var R = 3958.8;
  function rad(d){ return d * Math.PI / 180; }
  function miles(a, b){
    var dp = rad(b[0] - a[0]), dl = rad(b[1] - a[1]);
    var h = Math.pow(Math.sin(dp / 2), 2) + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.pow(Math.sin(dl / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function miLabel(m){ return m < 5 ? 'Under 5 mi away' : Math.round(m / (m < 30 ? 1 : 5)) * (m < 30 ? 1 : 5) + ' mi away'; }
  var S = { area: 'all', q: {}, from: null, label: '', within: 0, sort: 'soon' };
  var list = document.getElementById('showList'), flat = document.getElementById('showFlat');
  var empty = document.getElementById('showEmpty'), countEl = document.getElementById('showCount');
  var hint = document.getElementById('csHint'), clearBtn = document.getElementById('csClear');
  var rail = document.getElementById('csRail'), find = document.getElementById('csFind');
  var distBox = document.getElementById('csDist'), input = document.getElementById('csWhere');
  if (find) find.hidden = false;
  if (rail) rail.hidden = false;
  function inArea(el, area){ return area === 'all' || (' ' + (el.dataset.region || '') + ' ').indexOf(' ' + area + ' ') !== -1; }
  function overlaps(el, w){ var a = el.dataset.date, b = el.dataset.last || a; return a <= w[1] && b >= w[0]; }
  function distOf(el){ return S.from && el.dataset.lat ? miles(S.from, [+el.dataset.lat, +el.dataset.lon]) : null; }
  var units = [].slice.call(document.querySelectorAll('.cs-unit'));
  units.forEach(function(el, i){ el._home = el.parentNode; el._i = i; });
  function keep(el){
    if (!inArea(el, S.area)) return false;
    if (S.q.weekend && !overlaps(el, WK)) return false;
    if (S.q['30'] && !overlaps(el, D30)) return false;
    if (S.q.free && el.dataset.free !== '1') return false;
    if (S.q.pk && el.dataset.pokemon !== '1') return false;
    if (S.from && S.within) { var m = distOf(el); if (m === null || m > S.within) return false; }
    return true;
  }
  function apply(user){
    var shown = 0;
    units.forEach(function(el){
      var ok = keep(el); el.hidden = !ok; if (ok) shown++;
      var chip = el.querySelector('[data-dist]');
      if (chip) { var m = distOf(el); chip.hidden = m === null; chip.textContent = m === null ? '' : miLabel(m); }
    });
    var nearMode = S.sort === 'near' && S.from;
    if (nearMode) {
      units.slice().sort(function(a, b){ return (distOf(a) || 1e9) - (distOf(b) || 1e9) || a._i - b._i; })
        .forEach(function(el){ flat.appendChild(el); });
    } else {
      units.forEach(function(el){ if (el.parentNode !== el._home) el._home.appendChild(el); });
    }
    flat.hidden = !nearMode; list.hidden = !!nearMode;
    document.querySelectorAll('.show-dayg').forEach(function(g){
      var n = g.querySelectorAll('.cs-unit:not([hidden])').length;
      g.hidden = n === 0;
      var c = g.querySelector('.show-day-n'); if (c) c.textContent = n + (n === 1 ? ' show' : ' shows');
    });
    if (empty) empty.hidden = shown > 0;
    var tiles = [].slice.call(document.querySelectorAll('.wk-tile'));
    function reach(t){ if (!inArea(t, S.area)) return false; if (S.from && S.within) { var m = distOf(t); return m !== null && m <= S.within; } return true; }
    var wkTiles = tiles.filter(function(t){ return overlaps(t, WK) && reach(t); });
    var lbl = document.getElementById('csWkLbl');
    if (wkTiles.length) { tiles.forEach(function(t){ t.hidden = wkTiles.indexOf(t) === -1; }); if (lbl) lbl.textContent = 'This weekend'; }
    else { var c4 = 0; tiles.forEach(function(t){ var ok = reach(t) && c4 < 4; if (ok) c4++; t.hidden = !ok; }); if (lbl) lbl.textContent = 'Coming up next'; }
    var wkSec = document.querySelector('.cs-wk'); if (wkSec) wkSec.hidden = !tiles.some(function(t){ return !t.hidden; });
    var parts = [];
    if (S.area !== 'all') { var ab = document.querySelector('.chip.filt[data-region="' + S.area + '"]'); if (ab) parts.push('in ' + ab.textContent.trim()); }
    if (S.q.weekend) parts.push('this weekend');
    if (S.q['30']) parts.push('in the next 30 days');
    if (S.q.free) parts.push('free to get in');
    if (S.q.pk) parts.push('Pokemon shows');
    if (S.from && S.within) parts.push('within ' + S.within + ' mi of ' + S.label);
    var msg = shown === 0 ? 'No shows match' : shown + (shown === 1 ? ' show' : ' shows');
    if (parts.length) msg += ' ' + parts.join(', ');
    if (shown) msg += nearMode ? ', nearest first' : ', soonest first';
    if (countEl) countEl.textContent = msg;
    var active = S.area !== 'all' || Object.keys(S.q).some(function(k){ return S.q[k]; }) || S.from;
    if (clearBtn) clearBtn.hidden = !active;
    document.querySelectorAll('.chip.filt').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.region === S.area)); });
    document.querySelectorAll('.chip.qf').forEach(function(b){ b.setAttribute('aria-pressed', String(!!S.q[b.dataset.q])); });
    document.querySelectorAll('.chip.df').forEach(function(b){ b.setAttribute('aria-pressed', String(+b.dataset.within === S.within)); });
    document.querySelectorAll('.chip.sf').forEach(function(b){ b.setAttribute('aria-pressed', String(S.sort === 'near')); });
    if (distBox) distBox.hidden = !S.from;
    try {
      var p = new URLSearchParams();
      if (S.area !== 'all') p.set('area', S.area);
      Object.keys(S.q).forEach(function(k){ if (S.q[k]) p.set(k === '30' ? 'next30' : k, '1'); });
      if (S.from && S.label && S.label !== 'your location') p.set('near', S.label);
      if (S.from && S.within) p.set('within', String(S.within));
      if (nearMode && S.label !== 'your location') p.set('sort', 'near');
      var qs = p.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    } catch (e) {}
    if (user) {
      var top = document.getElementById('list').getBoundingClientRect().top;
      var under = rail ? rail.getBoundingClientRect().bottom : 0;
      if (top < under) window.scrollTo(0, window.scrollY + top - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 0));
    }
  }
  function setRailH(){ if (rail) document.documentElement.style.setProperty('--rail-h', rail.offsetHeight + 'px'); }
  setRailH();
  try { new ResizeObserver(setRailH).observe(rail); } catch (e) {}
  var places = null, loading = null;
  function loadPlaces(){
    if (places) return Promise.resolve(places);
    if (!loading) loading = fetch('/data/places.json').then(function(r){ return r.json(); }).then(function(j){ places = j; return j; }).catch(function(){ places = { z: {}, t: {} }; return places; });
    return loading;
  }
  function norm(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/,?\\s*(ny|new york)\\s*$/, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\\s+/g, ' ').trim(); }
  function say(t){ if (hint) hint.textContent = t; }
  function setFrom(pt, label){
    S.from = pt; S.label = label;
    if (!S.within) S.within = 50;
    say('Distances are from ' + label + ', in a straight line to each show’s town.');
    apply(true);
  }
  function resolve(q){
    var raw = String(q || '').trim();
    if (!raw) { say('Type a zip code or a town, or tap Near me.'); return Promise.resolve(); }
    return loadPlaces().then(function(pl){
      var zip = raw.match(/^\\d{5}/);
      var pt = zip ? pl.z[zip[0]] : pl.t[norm(raw)];
      if (!pt) { say('We do not have “' + raw + '” on file. Try a nearby town, a zip code in Western or Central New York, or tap Near me.'); return; }
      setFrom(pt, zip ? zip[0] : raw.replace(/\\b\\w/g, function(c){ return c.toUpperCase(); }));
    });
  }
  if (input) input.addEventListener('focus', loadPlaces, { once: true });
  var nearForm = document.getElementById('csNear');
  if (nearForm) nearForm.addEventListener('submit', function(e){ e.preventDefault(); resolve(input.value); });
  var loc = document.getElementById('csLocate');
  if (loc) loc.addEventListener('click', function(){
    if (!navigator.geolocation) { say('Your browser cannot share a location here. Type a zip code or a town instead.'); return; }
    say('Finding you…');
    navigator.geolocation.getCurrentPosition(function(pos){
      setFrom([pos.coords.latitude, pos.coords.longitude], 'your location');
    }, function(){
      say('We could not get your location. Type a zip code or a town instead.');
      if (input) input.focus();
    }, { maximumAge: 600000, timeout: 10000 });
  });
  document.querySelectorAll('.chip.filt').forEach(function(b){ b.addEventListener('click', function(){ S.area = b.dataset.region; apply(true); }); });
  document.querySelectorAll('.chip.qf').forEach(function(b){ b.addEventListener('click', function(){
    var k = b.dataset.q; S.q[k] = !S.q[k];
    if (k === 'weekend' && S.q[k]) S.q['30'] = false;
    if (k === '30' && S.q[k]) S.q.weekend = false;
    apply(true);
  }); });
  document.querySelectorAll('.chip.df').forEach(function(b){ b.addEventListener('click', function(){ S.within = +b.dataset.within; apply(true); }); });
  document.querySelectorAll('.chip.sf').forEach(function(b){ b.addEventListener('click', function(){ S.sort = S.sort === 'near' ? 'soon' : 'near'; apply(true); }); });
  function clearAll(){ S = { area: 'all', q: {}, from: null, label: '', within: 0, sort: 'soon' }; if (input) input.value = ''; say(''); apply(true); }
  if (clearBtn) clearBtn.addEventListener('click', clearAll);
  var c2 = document.getElementById('csClear2'); if (c2) c2.addEventListener('click', clearAll);
  document.querySelectorAll('[data-share]').forEach(function(b){
    b.hidden = false;
    b.addEventListener('click', function(){
      var url = location.origin + location.pathname + '#' + b.dataset.share;
      var done = function(t){ var o = b.textContent; b.textContent = t; setTimeout(function(){ b.textContent = o; }, 1800); };
      if (navigator.share) { navigator.share({ title: b.dataset.shareTitle, url: url }).catch(function(){}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function(){ done('Link copied'); }, function(){ done('Copy failed'); });
    });
  });
  function openHash(){
    var id = decodeURIComponent((location.hash || '').slice(1));
    var el = id && document.getElementById(id);
    if (el && el.tagName === 'DETAILS') { el.open = true; el.scrollIntoView(); }
  }
  window.addEventListener('hashchange', openHash);
  openHash();
  var qp = new URLSearchParams(location.search);
  if (qp.get('area') && document.querySelector('.chip.filt[data-region="' + qp.get('area') + '"]')) S.area = qp.get('area');
  ['weekend', 'free', 'pk'].forEach(function(k){ if (qp.get(k) === '1') S.q[k] = true; });
  if (qp.get('next30') === '1') S.q['30'] = true;
  if (/^(25|50)$/.test(qp.get('within') || '')) S.within = +qp.get('within');
  if (qp.get('sort') === 'near') S.sort = 'near';
  apply(false);
  if (qp.get('near')) { if (input) input.value = qp.get('near'); resolve(qp.get('near')); }
${imgLbJs("Show flyer or logo")}
})();
</script>
${APP_JS}
</body>
</html>
`;

await mkdir(join(ROOT, "public/assets/shows"), { recursive: true });
await writeFile(join(ROOT, "public/card-shows.html"), page);

/* ADD TO CALENDAR, 8 October 2026. One .ics per run, prebuilt, so the button is a
   plain link that works with no script: iOS and macOS open it in Calendar, Android
   hands it to whichever calendar app is installed. A multi-day run is one file
   with one event per day, each with that day's own hours. A day with no published
   start time is an ALL-DAY event rather than a guessed hour, and an end time is
   only written when the show published one. Times are converted to UTC through
   tzOffset(), the same offset the Event markup uses, so a reader in another zone
   gets the right local time. DTSTAMP is the build day at midnight so the tree is
   reproducible. The directory is cleared first, so a past show's file goes away
   the night it drops off the calendar. */
const ICS_DIR = join(ROOT, "public/shows/ics");
await rm(ICS_DIR, { recursive: true, force: true });
await mkdir(ICS_DIR, { recursive: true });
const icsEsc = (t) => String(t ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsFold = (line) => {
  const out = [];
  let cur = line;
  while (Buffer.byteLength(cur) > 75) {
    let n = 75;
    while (Buffer.byteLength(cur.slice(0, n)) > 75) n--;
    if (cur[n - 1] === "\\") n--; // never split an escape from what it escapes
    out.push(cur.slice(0, n));
    cur = " " + cur.slice(n);
  }
  out.push(cur);
  return out.join("\r\n");
};
const icsUtc = (iso, hm) =>
  new Date(`${iso}T${hm}:00${tzOffset(iso)}`).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
for (const r of runs) {
  const events = r.days.map((d) => {
    const lines = ["BEGIN:VEVENT", `UID:${d.id}@garbagerips.com`, `DTSTAMP:${TODAY.replace(/-/g, "")}T000000Z`];
    if (d.start) {
      lines.push(`DTSTART:${icsUtc(d.date, d.start)}`);
      if (d.end) lines.push(`DTEND:${icsUtc(d.date, d.end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${d.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${addDays(d.date, 1).replace(/-/g, "")}`);
    }
    const p = priceOf(d);
    lines.push(
      `SUMMARY:${icsEsc(d.name)}`,
      `LOCATION:${icsEsc([d.venue, d.address || d.city].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${icsEsc(`${p ? `Admission: ${p}` : "Admission not published"}\nDetails: ${SITE}/card-shows.html#s-${r.id}`)}`,
      `URL:${SITE}/card-shows.html#s-${r.id}`,
      "END:VEVENT",
    );
    return lines.map(icsFold).join("\r\n");
  });
  await writeFile(join(ICS_DIR, `${r.id}.ics`), [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Garbage Rips 585//Card shows//EN", "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH", ...events, "END:VCALENDAR", "",
  ].join("\r\n"));
}

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
${g.shows.map((s) => (s.date < TODAY ? showCard(s, { archive: true }) : `<div class="show-pending" hidden data-date="${esc(s.date)}">${showCard(s, { archive: true })}</div>`)).join("\n")}
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
${/* THE ARCHIVE'S FLYER AND LOGO BUTTONS OPENED NOTHING until 29 September
     2026: showCard() renders them with data-imglb on both pages, and only the
     calendar page carried the dialog and its script. */""}${imgLbMarkup("Show flyer or logo")}
${footer("Show listings are collected by hand and change without notice. This page is a record of shows that have already happened.")}
<script>
(function(){
${imgLbJs("Show flyer or logo")}
})();
</script>
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
