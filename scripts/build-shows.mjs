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
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(await readFile(join(ROOT, "data/shows.json"), "utf8"));

// The roads, the water and the county lines, written by
// scripts/sync-card-show-map.mjs from the Overpass API and committed. NO NETWORK
// HAPPENS HERE and none may be added: that script is not in build-all.mjs, same
// arrangement as sync-shop-map.mjs, sync-decks.mjs and sync-plate-photos.py, and
// its own header says why.
const mapDoc = JSON.parse(await readFile(join(ROOT, "data/card-show-map.json"), "utf8"));

const TODAY = localDay();

const REGIONS = [
  { id: "all", label: "All" },
  { id: "roc", label: "Rochester" },
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

/** A maps link built from the venue and city. Never an address we made up. */
const mapLink = (s) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [s.address || s.venue, s.address ? "" : s.city, s.address ? "" : "NY"].filter(Boolean).join(" ")
  )}`;

// The page covers three metro areas and nothing else. These feeds are regional
// and cheerfully mix in the Southern Tier, and a national search for "Rochester
// Pokemon league" returns Rochester MINNESOTA and Rochester MICHIGAN before it
// returns ours, so an out-of-area entry is a question of when, not whether.
// Anything not on this list stops the build rather than quietly telling somebody
// in the 585 to drive to another state.
const AREA = new Set([
  // Rochester and its ring
  "Rochester", "Fairport", "Henrietta", "Webster", "Greece", "Penfield", "Victor",
  "Batavia", "Canandaigua", "Brockport", "Pittsford",
  // Buffalo and Niagara
  "Buffalo", "Depew", "Sanborn", "Niagara Falls", "Amherst", "Cheektowaga",
  "Lancaster", "Hamburg", "Lockport", "Williamsville", "Tonawanda",
  // Syracuse and its ring
  "Syracuse", "Liverpool", "Cicero", "Camillus", "Baldwinsville", "East Syracuse",
]);
const strays = (data.shows || []).filter((s) => !AREA.has(s.city));
if (strays.length) {
  console.error(
    `${strays.length} show(s) outside the Rochester, Buffalo and Syracuse areas:\n` +
      strays.map((s) => `  ${s.id}: ${s.city}`).join("\n") +
      `\n\nEither drop them from data/shows.json or, if the city really is local, add it to AREA in this script.`
  );
  process.exit(1);
}

const upcoming = (data.shows || [])
  .filter((s) => s.date >= TODAY)
  .sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || ""));

// Group by calendar month so the page reads like a calendar rather than a list.
const byMonth = [];
for (const s of upcoming) {
  const key = s.date.slice(0, 7);
  let g = byMonth.find((x) => x.key === key);
  if (!g) byMonth.push((g = { key, label: `${MONTHS_LONG[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`, shows: [] }));
  g.shows.push(s);
}

const next = upcoming[0] || null;
const pokemonCount = upcoming.filter((s) => s.pokemon).length;

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

function showMap() {
  const towns = data._towns || {};
  const noCoord = [...townCounts.keys()].filter((c) => !Array.isArray(towns[c]));
  if (noCoord.length) {
    console.warn(
      `  no coordinate for ${noCoord.join(", ")}: left off the map. ` +
        `Add it to _towns in data/shows.json, see _towns_note there.`
    );
  }
  const pts = [...townCounts.entries()]
    .filter(([c]) => Array.isArray(towns[c]))
    .map(([city, n]) => ({ city, n, at: towns[city], region: townRegion.get(city) }));
  if (pts.length < 2) return "";

  const W = 660, H = 250, PAD = 40, FOOT = 30;
  const lats = pts.map((p) => p.at[0]);
  const lons = pts.map((p) => p.at[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const MI_PER_DEG_LAT = 69.0;
  const x0 = Math.min(...lons), y0 = Math.min(...lats);
  const mx = (lon) => (lon - x0) * MI_PER_DEG_LAT * kx;
  const my = (lat) => (lat - y0) * MI_PER_DEG_LAT;
  const wMi = Math.max(...lons.map(mx)) || 1;
  const hMi = Math.max(...lats.map(my)) || 1;
  const k = Math.min((W - PAD * 2) / wMi, (H - FOOT - PAD * 2) / hMi);
  const offX = (W - wMi * k) / 2, offY = FOOT + (H - FOOT - hMi * k) / 2;
  const px = (lon) => offX + mx(lon) * k;
  const py = (lat) => H - (offY + my(lat) * k);

  // THE CANVAS REACHES MUCH FURTHER THAN THE TOWNS DO, so the geometry has to as
  // well. px/py above are fitted to the towns and then centred, and on this page
  // that leaves the whole top of the frame north of the northernmost dot.
  // Inverting the projection at the four edges of the viewBox gives the ground
  // the drawing actually covers.
  const lonAt = (x) => x0 + (x - offX) / k / (MI_PER_DEG_LAT * kx);
  const latAt = (y) => y0 + (H - y - offY) / k / MI_PER_DEG_LAT;
  const canvas = { west: lonAt(0), east: lonAt(W), north: latAt(0), south: latAt(H) };

  // AND THE DATA FILE HAS TO COVER IT, WHICH IS THE ONE WAY THIS PAIRING CAN GO
  // QUIETLY WRONG, AND IT IS LIKELIER HERE THAN ON /shops.html. That page's six
  // dots are fixed. This page's canvas is fitted to the towns that have a show
  // COMING UP, so it moves every time a listing expires or a new one lands: one
  // show in a town nobody has listed before and the frame grows into ground
  // sync-card-show-map.mjs never fetched, and the map renders a clean empty
  // margin that looks like a design decision. Fail instead, and say which edge
  // and by how far.
  const b = mapDoc.box;
  const over = [
    ["west", b.west - canvas.west], ["east", canvas.east - b.east],
    ["south", b.south - canvas.south], ["north", canvas.north - b.north],
  ].filter(([, d]) => d > 0);
  if (over.length) {
    throw new Error(
      `The card show map now reaches outside the geometry in data/card-show-map.json: ` +
        over.map(([side, d]) => `${d.toFixed(4)} degrees past its ${side} edge`).join(", ") +
        `.\nWiden BOX in scripts/sync-card-show-map.mjs and re-run it with --refresh.`
    );
  }
  // A layer that came back empty is a query that stopped matching, not a corner
  // of New York with no roads in it. That has happened once on the sister map,
  // on its boundary query: Overpass answered 200 with nothing in it and the
  // layer silently vanished, because New York files a city at admin_level 7 and
  // the obvious query asks for 8. A layer that disappears looks exactly like a
  // layer nobody asked for, so refuse to draw the figure at all.
  for (const [name, lines] of Object.entries({
    roads: [...mapDoc.roads.major, ...mapDoc.roads.minor],
    water: mapDoc.water,
    boundary: mapDoc.boundary,
  })) {
    if (!lines.length) {
      throw new Error(
        `data/card-show-map.json has no ${name} in it. Overpass can answer 200 with an ` +
          `empty result, so re-run scripts/sync-card-show-map.mjs --refresh and check the counts.`
      );
    }
  }

  // ONE <path> PER LAYER, NOT ONE PER WAY. 178 stitched road lines as 178
  // elements is 178 sets of attributes before a coordinate is written; as two
  // paths with many M subpaths apiece it is two. Consecutive points that round to
  // the same tenth of a unit are dropped: RDP in the sync script works in miles
  // on the ground and cannot know that two of its survivors land on the same
  // pixel here.
  //
  // RELATIVE LINETOS AFTER THE FIRST POINT, and the trap in doing that is
  // ACCUMULATED ROUNDING: a hundred deltas each rounded to a tenth can walk a
  // shoreline several units off its own end. Every delta is taken from the last
  // point ACTUALLY EMITTED rather than from the true position, so the error is
  // bounded at a tenth of a unit for the whole polyline instead of compounding.
  // "cur" below is the emitted position and nothing else may be subtracted from.
  // Separators are a comma inside a pair and a space between pairs, which is the
  // shortest form that cannot be misread. Same code and same reasoning as
  // shopMap in build-shops.mjs; read the long version there.
  const d = (line, close) => {
    const parts = [];
    let cur = null;
    for (const [lat, lon] of line) {
      const x = +px(lon).toFixed(1), y = +py(lat).toFixed(1);
      if (!cur) { cur = [x, y]; continue; }
      const dx = +(x - cur[0]).toFixed(1), dy = +(y - cur[1]).toFixed(1);
      if (!dx && !dy) continue;
      parts.push(`${dx},${dy}`);
      cur = [cur[0] + dx, cur[1] + dy];
    }
    if (!parts.length) return "";
    const start = line[0];
    return `M${+px(start[1]).toFixed(1)},${+py(start[0]).toFixed(1)}l${parts.join(" ")}${close ? "Z" : ""}`;
  };
  const layer = (lines, close) => lines.map((l) => d(l, close)).filter(Boolean).join("");

  // THE ORDER IS THE MAP. Water under roads, because a bridge crosses a river and
  // not the other way round; the county lines above both because they are an idea
  // rather than a thing and have to survive being drawn over the Thruway; the
  // dots above everything.
  const base = `<g clip-path="url(#showmap-clip)" fill="none">
        <path class="map-water" d="${layer(mapDoc.water, true)}"/>
        <path class="map-road" d="${layer(mapDoc.roads.minor)}"/>
        <path class="map-road-major" d="${layer(mapDoc.roads.major)}"/>
        <path class="map-edge" d="${layer(mapDoc.boundary)}"/>
      </g>`;

  const nice = [1, 2, 5, 10, 20, 50].find((n) => n * k > (W - PAD * 2) * 0.15) || 1;
  const R = (n) => 5 * Math.sqrt(n);

  // Greedy slot placement, lifted from shopMap for the same reason: Liverpool
  // and Syracuse are 3.7 miles apart, which is 14 units here, and their names
  // are 60 units wide. The DOT never moves.
  //
  // EVERY LABEL SITS ON A PLATE OF ITS OWN NOW AND THAT IS NOT DECORATION. Until
  // the geometry went in, a name was cream type on one flat green and its
  // contrast was whatever --ink on --paper-3 measures, everywhere, always. It now
  // has Lake Ontario under it some of the time and a motorway the rest. Same fix
  // and the same class of bug as /shops.html: a colour that was only correct
  // because of what happened to be behind it.
  //
  // MEASURED RATHER THAN ARGUED, on the real figure at 390 and at 1440, by
  // hiding every glyph, every dot, the halo and the scale bar in the live DOM
  // and reading the BRIGHTEST pixel left inside each plate's own box. Worst
  // ground on the whole map is #2D4436, under Batavia, Liverpool and the scale
  // bar, and cream on it is 7.74:1 at both widths. The best is 8.42:1 under
  // Rochester. Nothing here is close to the 4.5 line.
  //
  // TWO TRAPS IN TAKING THAT MEASUREMENT, both recorded on /shops.html and both
  // reproduced here so the number means something. The plate has rx=5, so its
  // four CORNERS show bare map and sampling the whole box reports the ground
  // rather than the plate. And the outermost row of the rect is ANTIALIASED
  // against what is under it, which reads as a failure that exists only in a
  // pixel no glyph ever touches. The harness insets 3px past both.
  // TWO LABEL VARIANTS, AND THE SECOND ONE EXISTS BECAUSE THE FIRST ONE IS
  // UNREADABLE ON A PHONE. This whole viewBox is scaled to fit the box, so the
  // type scales with it, and a size that reads at 660 units wide does not read
  // at 350 CSS px. Measured on the built page with getBoundingClientRect and
  // with the computed font-size multiplied by the real viewBox-to-viewport
  // scale, which agree: a town name was 7.42 CSS px at 390 against an 11px
  // caption and 17.6px body copy sitting directly under it.
  //
  // getComputedStyle ON SVG TEXT REPORTS USER UNITS AND NOT CSS PIXELS, which
  // is why this went unnoticed for a month: the naive read says 14 and passes.
  // The number that means anything is units x (svg.getBoundingClientRect().width
  // / svg.viewBox.baseVal.width).
  //
  // THE FLOOR IS 12 CSS PX and it is argued rather than picked. --t-micro is
  // 11px and is the smallest type token this site has; it is what this figure's
  // own caption is set in. Nothing drawn ON the picture may be smaller than the
  // prose explaining it, so the floor is the next token up, --t-label at 12px.
  // Every mark on this map now measures at least 12.2px at every width from 320
  // to 1440.
  //
  // WHY NOT SIMPLY SCALE THE NAMES UP, which is the obvious fix and is the
  // wrong one here. At 390 this figure is 350 x 133 CSS px. A name at the floor
  // is 1.6x its current width in units, and the greedy placer below then has to
  // push labels 56 units clear of their own dots to keep them apart: "Batavia"
  // ends up 30 CSS px from Batavia with no leader line, which is a worse map
  // than a small one. There are only 250 units of height to spend and the towns
  // sit in a strip across the middle of them.
  //
  // SO THE PHONE GETS NUMBERS AND THE NAMES GO INTO HTML AT REAL TYPE, which is
  // exactly what plateDiagram() on /garbage-plate.html does and what CLAUDE.md
  // records as "the words are HTML, not SVG text". A number is one glyph, so it
  // fits at any size this map can be drawn at, and the key under the picture is
  // set in --t-sm. THE KEY IS A GAIN AND NOT A CONSOLATION: the note above the
  // stylesheet block in this file records that the label reads "Batavia · 8"
  // rather than "Batavia, 8 shows coming up" because the sentence would not fit
  // on the drawing. In the key it fits, because the key is not on the drawing.
  //
  // NUMBERED WEST TO EAST, and that is what makes the key cheap to use. The
  // numbers ascend across the picture, so a reader who has seen one dot already
  // knows roughly where 4 is without reading anything. On this page it is also
  // the true shape of the data: these towns are strung along the Thruway.
  //
  // THE SWITCH IS max-width:544px, which is this site's own phone breakpoint
  // (ui.css and homeCss in build-proto.mjs both use it). Above it the wrap is
  // wide enough that a 16 unit name renders at 12.2px or better, and at 708 and
  // up the map is at 1:1 and it is 16.0px. Below it the drawing would be doing
  // the shrinking, so the drawing stops carrying words.
  const NAME_F = 16; // wide: the town name. Was 14, which was 12px at 545.
  const NUM_F = 29; // narrow: the key number. 12.3px at 320, 15.4px at 390.

  // Greedy slot placement, lifted from shopMap for the same reason: Liverpool
  // and Syracuse are 3.7 miles apart, which is 14 units here, and their names
  // are 60 units wide. The DOT never moves.
  //
  // IT RUNS ONCE PER VARIANT, with its own placed list, because the two
  // variants are different widths and a shared list would let a name reserve a
  // slot against a number. COLLISIONS IN HERE ARE SCALE INVARIANT: two boxes in
  // user units either overlap or they do not, whatever the figure is drawn at,
  // so a variant that is clean is clean at every width it is shown at.
  //
  // EVERY LABEL SITS ON A PLATE OF ITS OWN NOW AND THAT IS NOT DECORATION. Until
  // the geometry went in, a name was cream type on one flat green and its
  // contrast was whatever --ink on --paper-3 measures, everywhere, always. It now
  // has Lake Ontario under it some of the time and a motorway the rest. Same fix
  // and the same class of bug as /shops.html: a colour that was only correct
  // because of what happened to be behind it. The number plate is the SAME
  // .map-plate at the same opacity, so that measurement carries over unchanged.
  const sorted = pts.slice().sort((a, b) => px(a.at[1]) - px(b.at[1]));
  const keyNo = new Map(sorted.map((p, i) => [p.city, i + 1]));

  // The plate and the baseline are expressed as ratios of the font size, taken
  // from the numbers this figure shipped with at 14 units: 9/14, 18/14, 4/14.
  // That is what lets one renderer draw both variants without either of them
  // getting a hand-tuned box that the collision test above does not know about.
  // THE DOTS ARE RESERVED AGAINST AS WELL AS THE LABELS, AND THIS MAP HAD ONE
  // OF THESE TOO. /shops.html's placer had the same hole and it was worse there
  // -- its Great Lakes Gaming plate sat on the Just Games marker itself, 14.4 x
  // 3.5 CSS px at 1440 -- so this figure was reported clean and was not. THE
  // DIFFERENCE IS WHICH CIRCLE YOU MEASURE AGAINST, and it is worth writing
  // down because a first pass here measured the wrong one and got zero:
  //
  //       plate over the DOT      0 at every width, both before and after
  //       plate over the HALO     "Depew . 1", 13.2 x 0.4 CSS px at 545,
  //                               17.2 x 0.5 at 768 and 1440, now 0
  //
  // THE HALO IS THE THING TO RESERVE, r + 4 AND NOT r. It is a ring of the map's
  // own ground painted under the marker so a dot reads as a dot rather than as a
  // junction of the roads it lands on, which is the whole reason it exists; a
  // plate lying over it undoes that and is a fault whether or not it has reached
  // the coloured circle in the middle yet. A label starts at x +/- (r + 8), so
  // its own halo is 4 units clear and every dot can go in one list.
  //
  // MEASURED AT 320, 390, 544, 545, 768 AND 1440 ON BOTH MAPS, before against
  // after, off getBoundingClientRect on the rendered SVG rather than off these
  // user units: 2 overlaps before (one per map), 0 after, with 0 plate-on-plate,
  // 0 label-on-label and 0 marks outside the frame throughout. One label moves
  // on each map and nothing else in either file changes.
  const haloes = sorted.map((p) => ({ x: px(p.at[1]), y: py(p.at[0]), r: R(p.n) + 4 }));
  const place = (font, textOf, charW, padW) => {
    const lh = Math.round((font * 18) / 14);
    const placed = [];
    return sorted.map((p) => {
      const x = px(p.at[1]), y = py(p.at[0]), r = R(p.n);
      const text = textOf(p);
      const left = x > W * 0.62;
      const w = text.length * charW + padW;
      const x1 = left ? x - r - 8 - w : x + r + 8;
      let ly = y;
      for (let step = 0; step < 15; step++) {
        const off = step === 0 ? 0 : (step % 2 ? -1 : 1) * Math.ceil(step / 2) * lh;
        ly = y + off;
        // The plate's real top and bottom, matching what mark() draws below:
        // ly - font*0.643, font*1.286 high. The label test keeps its lh proxy.
        const y0 = ly - font * 0.643, y1 = y0 + font * 1.286;
        const clash =
          placed.some((q) => Math.abs(q.y - ly) < lh && x1 < q.x + q.w && q.x < x1 + w) ||
          haloes.some((d) => x1 < d.x + d.r && d.x - d.r < x1 + w && y0 < d.y + d.r && d.y - d.r < y1);
        if (!clash) break;
      }
      placed.push({ x: x1, y: ly, w });
      return { x, y, r, left, text, w, x1, ly, font };
    });
  };
  const wideMarks = place(NAME_F, (p) => `${p.city} · ${p.n}`, (7.6 * NAME_F) / 14, NAME_F);
  const numMarks = place(NUM_F, (p) => String(keyNo.get(p.city)), NUM_F * 0.62, NUM_F * 0.7);

  // The plate is the box the collision test above already reasons about, so the
  // two cannot disagree about how wide a name is: same x1, same w. A number is
  // centred in its plate; a name hangs off the dot the way it always has.
  const mark = (m, cls, mid) => `<g class="${cls}">
        <rect class="map-plate" x="${m.x1.toFixed(1)}" y="${(m.ly - m.font * 0.643).toFixed(1)}"
          width="${m.w.toFixed(1)}" height="${(m.font * 1.286).toFixed(1)}" rx="5"/>
        <text class="map-lbl" x="${(mid ? m.x1 + m.w / 2 : m.left ? m.x - m.r - 8 : m.x + m.r + 8).toFixed(1)}"
          y="${(m.ly + m.font * 0.286).toFixed(1)}"
          style="font-size:${m.font}px;text-anchor:${mid ? "middle" : m.left ? "end" : "start"}">${esc(m.text)}</text>
      </g>`;

  // Both variants live inside the same <g> as the dot, because the area filter
  // toggles that group and a plate left behind by a faded label would be a hole
  // in the map. The hidden one is display:none, so it has no box and cannot
  // collide with anything, which is what keeps the collision count honest.
  const dots = sorted
    .map((p, i) => {
      const m = wideMarks[i];
      return `<g class="map-t" data-region="${esc(p.region || "")}">
        <circle class="map-halo" cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="${(m.r + 4).toFixed(1)}"/>
        <circle class="map-dot" cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="${m.r.toFixed(1)}"/>
        ${mark(m, "mk-w", false)}
        ${mark(numMarks[i], "mk-n", true)}
      </g>`;
    })
    .join("");

  // The scale bar gets a plate for the same reason the names do: it used to sit
  // on flat green and it now sits on whatever runs along the bottom of the frame.
  // It gets the same two variants as well, and it is the mark that was worst off
  // on a phone: 6.36 CSS px at 390, the smallest type anywhere on this page. The
  // plate is derived from the font here rather than hand-set, so the box cannot
  // fall out of step with the words in it.
  //
  // THE NARROW ONE PUTS THE WORDS BESIDE THE BAR RATHER THAN OVER IT, and that
  // is height rather than taste. Stacked, a 29 unit label plus the bar and its
  // ticks is a 57 unit plate, 23% of a 250 unit frame, and it was the loudest
  // object in the picture when it was screenshotted. Beside the bar it is 31,
  // which is the bar's own height, and it is the form every printed map uses.
  // It also abbreviates to "mi", which is the same 37% saving in width and is
  // what a scale bar says everywhere else in the world.
  const barW = nice * k;
  const barLabel = `${nice} mile${nice === 1 ? "" : "s"}`;
  const bar = (font, cls, beside) => {
    const label = beside ? `${nice} mi` : barLabel;
    const tw = label.length * font * 0.62;
    const ticks =
      `<line class="map-bar" x1="0" y1="0" x2="${barW.toFixed(1)}" y2="0"/>` +
      `<line class="map-bar" x1="0" y1="-5" x2="0" y2="5"/>` +
      `<line class="map-bar" x1="${barW.toFixed(1)}" y1="-5" x2="${barW.toFixed(1)}" y2="5"/>`;
    if (beside) {
      const top = -Math.max(font * 0.72, 8);
      const bot = Math.max(font * 0.34, 8);
      // UP 12 UNITS, AND IT IS A LINE BOX RATHER THAN A GLYPH. "50 mi" has no
      // descender, so the ink clears the frame; the TEXT NODE does not, because
      // its box runs from the ascender to the descender of a 29 unit face and
      // hung 5.2 units below the bottom of the viewBox. Nothing is clipped out
      // here (only the geometry layer is), so a mark that escapes the frame
      // paints over the page. Measured with getBoundingClientRect, not by eye.
      return `<g class="${cls}" transform="translate(0 -12)">
          <rect class="map-plate" x="-10" y="${top.toFixed(1)}" width="${(barW + tw + 32).toFixed(1)}"
            height="${(bot - top).toFixed(1)}" rx="5"/>
          ${ticks}
          <text class="map-bart" x="${(barW + 12).toFixed(1)}" y="${(font * 0.34).toFixed(1)}"
            style="font-size:${font}px;text-anchor:start">${label}</text>
        </g>`;
    }
    const base = -(font * 0.75) - 2;
    const top = base - font * 0.82;
    return `<g class="${cls}">
          <rect class="map-plate" x="-10" y="${top.toFixed(1)}"
            width="${(Math.max(barW, tw) + 20).toFixed(1)}" height="${(9 - top).toFixed(1)}" rx="5"/>
          ${ticks}
          <text class="map-bart" x="${(barW / 2).toFixed(1)}" y="${base.toFixed(1)}"
            style="font-size:${font}px">${label}</text>
        </g>`;
  };
  return `<figure class="show-map">
      <svg viewBox="0 0 ${W} ${H}" role="img"
        aria-label="A map of western and central New York from Niagara Falls to Syracuse, with the Lake Ontario shore, the Finger Lakes, the interstates and the county lines drawn from OpenStreetMap data. The ${pts.length} towns with a show coming up are marked and named, with a bigger dot for a town with more shows. On a narrow screen the marks are numbered instead and the numbers are listed under the map. Every listing below names its venue and town.">
        <defs><clipPath id="showmap-clip"><rect x="0" y="0" width="${W}" height="${H}" rx="10"/></clipPath></defs>
        <rect x="0" y="0" width="${W}" height="${H}" rx="10" class="map-bg"/>
        ${base}
        ${dots}
        <g transform="translate(${PAD} ${H - 16})">
          ${bar(NAME_F, "mk-w", false)}
          ${bar(NUM_F, "mk-n", true)}
        </g>
      </svg>
      ${/* THE KEY. Only on the narrow layout, where the drawing carries numbers
            instead of names; above 544 it is display:none and is out of the
            accessibility tree with the numbers it explains. It carries the
            sentence the map never had room for, and each row carries its town's
            region so the area buttons fade it in step with the dot it names. */ ""}
      <p class="map-key-h">The towns on the map, west to east</p>
      <ol class="map-key">
        ${sorted
          .map(
            (p, i) =>
              `<li data-region="${esc(p.region || "")}"><b>${i + 1}</b><span>${esc(p.city)}, ${p.n} show${
                p.n === 1 ? "" : "s"
              }</span></li>`
          )
          .join("\n        ")}
      </ol>
      ${/* THE TWO LINKS IN HERE ARE THE ODbL AND ARE NOT DISCRETIONARY, which is
            the same argument /shops.html's map makes, the same one the Garbage
            Plate photo credits make, and CLAUDE.md records it in full.
            OpenStreetMap's data is offered on condition that it is credited and
            that the licence is reachable; a page that draws the roads and does
            not link the deed is not making a tidier editorial choice, it is
            using the data outside the terms it was offered under. They sit in
            the figure's own credit line, at the end, labelled as leaving the
            site, exactly like every other outbound link on this page. */ ""}
      <figcaption>Where the shows are, and how far apart they are. One dot per town, at the town center, sized by
        how many shows it has coming up: ${
          [...townCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ""
        } has the most. The Lake Ontario shore, the Finger Lakes, the interstates, the trunk routes and the
        county lines are real geometry, drawn from OpenStreetMap's data rather than from anybody's map tiles,
        so nothing on this page asks another server for anything. North is up and the scale is true both ways,
        which is why these towns sit in a strip: they are strung along the Thruway. There are no venue pins,
        because most of these venues have no street address in our data, and every listing below names the
        venue and the town, which is the thing to put in a map app. Map data from
        <a href="https://www.openstreetmap.org/copyright" rel="noopener" target="_blank"
          aria-label="OpenStreetMap contributors, the source of the map data, opens on openstreetmap.org">OpenStreetMap contributors</a>,
        licensed <a href="https://opendatacommons.org/licenses/odbl/1-0/" rel="noopener" target="_blank"
          aria-label="The Open Database License version 1.0, which this map data is offered under, opens on opendatacommons.org">ODbL 1.0</a>,
        read ${esc(longDate(mapDoc.read) || mapDoc.read)}.</figcaption>
    </figure>`;
}

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
const flyerSrc = (s) => {
  if (!s.flyer) return null;
  const rel = `assets/shows/${s.flyer}`;
  if (existsSync(join(ROOT, "public", rel))) return `/${rel}`;
  missingFlyers.push(`${s.id}: public/${rel} not found`);
  return null;
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
    location: {
      "@type": "Place",
      name: s.venue,
      address: {
        "@type": "PostalAddress",
        ...(s.address ? { streetAddress: s.address.split(",")[0] } : {}),
        addressLocality: s.city,
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
  `Every upcoming Pokemon and trading card show near Rochester, Buffalo and Syracuse NY. ` +
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
const PAGE_CSS = `/* The map of where the shows are. Same box and the same currentColor-free,
   variable-only discipline as .shop-map on /shops.html, deliberately, because
   the two pages are a pair and a reader moves between them.

   THIS NOTE USED TO END "7.6px IS THE FLOOR AND 6.1 IS UNDER IT", WHICH IS THE
   SENTENCE THAT SHIPPED THE BUG. It had the arithmetic right and the conclusion
   wrong: it measured a town name at 7.6 CSS px at 390 and then wrote 7.6 down
   as an acceptable size, on a page whose own caption is set at 11px and whose
   body copy is 17.6px. It is not a floor, it is a defect, and it was measured
   again and called one on 21 August 2026. Re-measured off getBoundingClientRect
   AND off the computed font-size times the real viewBox-to-viewport scale,
   which agree to a hundredth, before -> after:

        320   svg 280.0 x 106.1   unit 0.424   name 5.94 ->  12.30px (a number)
        390   svg 350.0 x 132.6   unit 0.530   name 7.42 ->  15.38px (a number)
        768   svg 660.0 x 250.0   unit 1.000   name 14.00 -> 16.00px
       1440   svg 660.0 x 250.0   unit 1.000   name 14.00 -> 16.00px

   getComputedStyle ON SVG TEXT REPORTS USER UNITS, NOT CSS PIXELS, and that is
   why this sat here being quoted as a measurement. It reads 14 at every width
   and always will. Multiply by the scale or measure the rendered box.

   The two variants and why the phone gets numbers instead of names are argued
   in full beside NAME_F and NUM_F in showMap(). The short version: 250 units of
   height cannot hold six names at a legible size without pushing them off their
   own dots, and this site already has the answer written down on
   /garbage-plate.html -- the words are HTML, not SVG text. */
.show-map{margin:var(--s5) 0 0;color:var(--ink);max-width:660px}
.show-map svg{display:block;width:100%;height:auto;max-width:660px}
/* THE FIGURE USED TO BE THE FULL WIDTH OF THE WRAP AND THE MAP 660 OF IT, so at
   1440 it declared 1392px and left 732 of them bare, 52.6% of the viewport. It
   painted nothing in that space, so this is a box-model fault rather than a
   visible one, but a figure claiming width it never uses is the kind of thing
   that gets "fixed" later by stretching the map into it.

   GROWING THE MAP INSTEAD WAS THE OTHER OPTION AND IT WAS REJECTED, because it
   fights the fix above rather than complementing it. At 1392 the drawing is at
   2.11 units to the pixel, so a 16 unit town name renders at 33.8px, which
   would have to come back down in units, which is the opposite of what the
   phone needs. Every stroke width in the block below is also argued in units
   per mile at a stated rendered scale, and this map's feature list was chosen
   for this frame: the water cut is fifty times coarser than /shops.html's and
   the roads stop at trunk. Doubling the size shows the omissions rather than
   more of the map. So the figure shrinks to the map. */
.show-map figcaption{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);
  margin-top:var(--s2);max-width:52em}
/* THE ODbL CREDIT WAS THE ONLY PINK LINK ON A PAGE OF 58, AND THE OTHER 49
   WERE ALREADY TEAL. CLAUDE.md's accent rule is that teal is every route and
   pink is every mark that goes nowhere, so this page was breaking it twice in
   one document and agreeing with itself nowhere. The rule won; the full
   argument, and the contrast numbers that say the swap costs nothing (4.51 ->
   4.50 on the card, 6.25 -> 6.24 on the page), is beside .shop-link in
   build-shops.mjs, which had the same three rules and 21 of 25 links in them.
   Same caption, same credit, same pair: if that one changes, change this. */
.show-map figcaption a{color:var(--sky-deep);font-weight:600}
.show-map figcaption a:hover{text-decoration:underline}
.map-bg{fill:var(--paper-3)}
/* THE MAP'S OWN INK, AND IT IS THE SAME PALETTE AS .shop-map ON /shops.html,
   DELIBERATELY, because the two pages are a pair and a reader moves between
   them. Every value there is derived from a token by a stated move and the
   derivations are written out beside the rules in build-shops.mjs; do not
   re-derive them here, and if one of them changes, change both files.

   The ground is --paper-3. Roads are the page ink at an opacity, which is the
   one thing here that is not a new colour at all: a road is a lighter scratch on
   the land. Water is the only hue, because water being blue is the one map
   convention a reader has without being told, and it is --mustard pulled 65% of
   the way to --navy-deep, which lands DARKER than the land as well as bluer.
   That direction matters: water lighter than land reads as a road.

   THE ONE PLACE THE VALUES DIVERGE IS THE STROKE WIDTHS, and it is scale rather
   than taste. That map draws at 37 units to the mile and this one at 3.9, so a
   1.1 unit road there is a tenth of a mile wide and here it is a whole mile.
   Everything is thinner and fainter as a result: at 390px this figure is 2.05
   pixels to the mile and a stroke that reads as a hairline over there reads as a
   motorway ten lanes wide here. */
.map-water{fill:#34565E;stroke:none}
/* THERE IS NO .map-stream HERE AND /shops.html HAS ONE. The river and canal
   centrelines were fetched, drawn and looked at, and they came off: 1,702 points,
   30% of the data file, for 130 blue veins that at this size bury the Thruway.
   The full working is in scripts/sync-card-show-map.mjs beside the query that no
   longer runs. Every wide river here is a water POLYGON and is still drawn.

   AND THE ROADS ARE HEAVIER THAN THEY WERE IN THE FIRST DRAFT because of it,
   which is the other half of the same decision: with the veins gone the motorway
   is the only continuous line across the frame, and it is the line that explains
   why six towns 147 miles apart are a straight row of dots. Screenshotted at
   1440 both ways before the numbers were changed. */
.map-road{stroke:currentColor;stroke-width:.8;opacity:.22}
.map-road-major{stroke:currentColor;stroke-width:2;opacity:.5}
/* The county lines are an idea and not a thing, so they are dashed and they are
   the pink, which on this site is the mark that goes nowhere. It is the one
   place the map uses an accent, and it uses it because a dashed cream line at
   low opacity is indistinguishable from a trunk road at this size, which defeats
   the point of drawing it. They whisper: nine county lines across a frame this
   wide is a reference grid, and at full strength it would be the busiest object
   in the picture, which is exactly backwards for the thing here that matters
   least. Same judgement, same numbers, as .sm-edge on /shops.html. */
.map-edge{stroke:var(--ketchup);stroke-width:1;stroke-dasharray:4 3.5;opacity:.3;fill:none}
/* The plate under each town name, and under the scale bar. --page at 88%, so a
   label is legible over Lake Ontario and over the Thruway alike; see the note
   beside the placement code and the measured worst case on /shops.html. */
.map-plate{fill:var(--page);opacity:.88}
/* A disc of the map's own ground behind each dot, so a dot reads as a dot on a
   map and not as a junction of whatever roads it happens to land on. Depew sits
   on the I-90 and NY-33 interchange and is the point that made this necessary. */
.map-halo{fill:var(--paper-3);opacity:.8}
.map-dot{fill:var(--gold);stroke:var(--ink);stroke-width:2}
/* NO font-size IN EITHER OF THESE TWO RULES, and that is deliberate. Both
   variants of every mark set their own in a style attribute, computed from the
   same constant the plate under it was computed from, so a size can never drift
   from the box that was reserved for it. A size here would be a third opinion.
   The px in an SVG font-size is a USER UNIT, never a CSS pixel; see the note at
   the top of this block. */
.map-lbl{font-weight:700;font-family:var(--body);fill:var(--ink)}
.map-bar{stroke:var(--ink);stroke-width:2.5}
.map-bart{font-weight:700;font-family:var(--mono);fill:var(--ink);text-anchor:middle}
/* The two label variants. The wide one carries names, the narrow one carries
   the numbers in .map-key. display:none rather than an opacity or a visibility,
   so the hidden variant has no box at all and cannot collide with the visible
   one or hang off the edge of the frame. 544 is this site's own phone
   breakpoint; the arithmetic behind picking it is beside NAME_F in showMap(). */
.mk-n{display:none}
@media(max-width:544px){
.mk-w{display:none}
.mk-n{display:inline}
}
/* The key under the picture, and it is the half of this fix that carries the
   words. Set in --t-sm, which is real type on a real line rather than a mark on
   a drawing, so it is not affected by the figure's scale at all. Same shape as
   the ordered list beside plateDiagram() on /garbage-plate.html. */
.map-key-h,.map-key{display:none}
.map-key-h{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink-2);margin:var(--s3) 0 var(--s2)}
.map-key{list-style:none;margin:0;padding:0;
  grid-template-columns:repeat(auto-fill,minmax(10.5em,1fr));gap:var(--s2) var(--s3);
  font:400 var(--t-sm)/1.35 var(--body);color:var(--ink)}
.map-key li{display:flex;align-items:baseline;gap:8px}
/* THE CHIP IS THE MAP'S OWN GROUND, --paper-3, AND IT WENT IN AT --page AND
   CAME STRAIGHT BACK OUT. --page is what the plate on the drawing is filled
   with, so copying it here looked like the obvious match, and it is also what
   this section is painted in: the chip measured 0 pixels of difference from the
   page behind it and the number sat on nothing. Measured, not noticed by eye.
   --paper-3 is the colour of the map the number is sitting on, which is the
   better echo anyway, and --ink on it is 5.35:1, read off the built page. */
.map-key b{flex:none;min-width:1.7em;padding:2px 0;text-align:center;border-radius:4px;
  background:var(--paper-3);color:var(--ink);font:700 var(--t-label)/1.3 var(--mono)}
/* Faded by the same area filter that fades the dot it names, and by the same
   rule: a row that vanished would move the rest of the key and lose the numbers
   that are still on the map. */
.map-key li.is-off{opacity:.4}
@media(max-width:544px){
.map-key-h{display:block}
.map-key{display:grid}
}
/* Dimmed by the same area filter that drives the list. Kept visible rather than
   removed: a town vanishing off a map moves nothing else on it, so the reader
   loses the frame of reference that made the map worth having. Faded, it still
   says "Syracuse is over there and you have filtered it out". The PLATE fades
   with the name it sits under, or a filtered-out town leaves a blank tile lying
   on the map with nothing written on it. */
.map-t.is-off .map-dot{fill:none;stroke:var(--ink-2);stroke-width:1.4;opacity:.35}
.map-t.is-off .map-halo{opacity:.3}
.map-t.is-off .map-plate{opacity:.25}
.map-t.is-off .map-lbl{opacity:.3}
/* The one line of prose under the map, and it is the surviving half of the
   deleted calendar's note. See the headstone above dayCounts. */
.map-note{margin-top:var(--s3);font:400 var(--t-micro)/1.5 var(--body);color:var(--ink-2);
  max-width:44em}

/* DESKTOP READING MEASURE. 44em was written as if 1em were one character. It
   is not: Outfit at 11px runs about 2.31 characters per em, so that 484px box
   measured 95 real characters a line at 1440. ui.css already caps main prose
   at var(--measure) and this rule only outranked it by landing after the
   stylesheet. min-width:1000 is ui.css's own desktop breakpoint, so the phone
   and the tablet range keep exactly the rule they had. Note this is the body
   face, not the mono one: the same 44em on Space Mono would be about 78
   characters and would need leaving alone. */
@media(min-width:1000px){
.map-note{max-width:var(--measure)}
}
`;

const head = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Card Shows Near Rochester NY: Buffalo & Syracuse Calendar</title>
<meta name="description" content="${esc(clipMeta(desc))}">
<link rel="canonical" href="${SITE}/card-shows.html">
<meta property="og:title" content="Card shows near Rochester, Buffalo and Syracuse">
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
<style>${miniCSS(PAGE_CSS)}</style>
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
  const soon = daysAway(s.date);
  const d = new Date(s.date + "T12:00:00");
  return `      <article class="show${s.featured ? " is-featured" : ""}" data-region="${esc(s.region || "")}" data-date="${esc(s.date)}"${s.pokemon ? ' data-pokemon="1"' : ""}>
        <div class="show-when" aria-hidden="true">
          <span class="show-mon">${MONTHS_LONG[d.getMonth()].slice(0, 3)}</span>
          <span class="show-day">${d.getDate()}</span>
        </div>
        <div class="show-body">
          ${s.featured ? `<p class="show-flag">The big one</p>` : ""}
          <h3>${esc(s.name)}</h3>
          <p class="show-meta">${esc(weekday(s.date))}${
            timeRange(s.start, s.end) ? ` &bull; ${esc(timeRange(s.start, s.end))}` : ""
          }</p>
          <p class="show-where"><a href="${esc(mapLink(s))}" rel="noopener" target="_blank" aria-label="${esc(s.venue)}, ${esc(s.city)} NY, where ${esc(showRef(s))} is held, opens on ${esc(hostOf(mapLink(s)))}">${esc(s.venue)}, ${esc(s.city)} NY</a></p>
          <div class="show-tags">
            ${s.pokemon ? `<span class="chip pk">Pokemon show</span>` : ""}
            ${soon ? `<span class="chip soon">${esc(soon)}</span>` : ""}
            <span class="chip">${s.admission ? esc(s.admission) : "Check the listing"}</span>
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
          <p class="show-links">
            ${s.ticketUrl ? `<a class="tickets" href="${esc(s.ticketUrl)}" rel="noopener" target="_blank" aria-label="Get tickets for ${esc(showRef(s))}, opens on ${esc(hostOf(s.ticketUrl))}">Get tickets <span aria-hidden="true">&rarr;</span></a>` : ""}
            ${s.url ? `<a href="${esc(s.url)}" rel="noopener" target="_blank" aria-label="${s.organiserUrl && s.url === s.organiserUrl ? "Official site" : "Listing and details"} for ${esc(showRef(s))}, opens on ${esc(hostOf(s.url))}">${s.organiserUrl && s.url === s.organiserUrl ? "Official site" : "Listing &amp; details"}</a>` : ""}
            ${s.organiserUrl && s.organiserUrl !== s.url ? `<a href="${esc(s.organiserUrl)}" rel="noopener" target="_blank" aria-label="${esc(s.organiser && s.organiser !== s.name ? `${s.organiser}, who run ${showRef(s)}` : `The organizer of ${showRef(s)}`)}, opens on ${esc(hostOf(s.organiserUrl))}">${esc(s.organiser || "Organizer")}</a>` : ""}
          </p>
        </div>
        ${flyer ? `<a class="show-flyer" href="${esc(flyer)}" target="_blank" rel="noopener">
          <img src="${esc(flyer)}" alt="Flyer for ${esc(s.name)}, ${esc(longDate(s.date) || s.date)}" loading="lazy">
        </a>` : ""}
      </article>`;
}
const page = head + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">585 &bull; Get out of the house</span>
    <h1>Card <span class="hl">shows</span> near Rochester</h1>
    <p class="lede" style="max-width:36em">Every card show we can find within driving distance of Rochester, Buffalo
      and Syracuse. Dates, times, where to park yourself, and what it costs to get in. Built because working this out
      every month from six different Facebook pages is genuinely annoying.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/rochester.html">Local scene</a> / Card shows</nav>
${next ? `
    <a class="next-show" data-date="${esc(next.date)}" href="${esc(next.url || "#list")}"${next.url ? ` rel="noopener" target="_blank" aria-label="Next one up: ${esc(showRef(next))} at ${esc(next.venue)}, ${esc(next.city)}, opens on ${esc(hostOf(next.url))}"` : ""}>
      <span class="next-label">Next one up${daysAway(next.date) ? ` &bull; ${esc(daysAway(next.date))}` : ""}</span>
      <span class="next-name">${esc(next.name)}</span>
      <span class="next-meta">${esc(longDate(next.date) || next.date)}${
        timeRange(next.start, next.end) ? `, ${esc(timeRange(next.start, next.end))}` : ""
      } &bull; ${esc(next.venue)}, ${esc(next.city)}</span>
    </a>` : ""}

    <div class="facts" style="margin-top:20px">
      <div class="fact"><div class="n">${upcoming.length}</div><div class="l">Shows coming up</div></div>
      <div class="fact"><div class="n">${pokemonCount}</div><div class="l">All Pokemon shows</div></div>
      <div class="fact"><div class="n">${upcoming.filter((s) => s.admission === "Free").length}</div><div class="l">Free to get in</div></div>
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
${showMap()}
${upcoming.length ? `
    <p class="map-note">${upcoming.length} show${upcoming.length === 1 ? "" : "s"} on
      ${showDays} day${showDays === 1 ? "" : "s"}${
        showDoubles ? `, ${showDoubles === 1 ? "one day" : `${showDoubles} days`} with two of them` : ""
      }. The area buttons above move the map and the list together.</p>` : ""}

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
    <h2>Know one we <span class="hl">missed</span>?</h2>
    <p class="lede" style="max-width:44em">This list is kept by hand, so it is only as good as what we can find. If you
      run a show, or you have a flyer from a local Discord or a shop counter, send it over on any of the socials at the
      bottom of the page and it goes up here. Flyers get shown in full.</p>
    <ul class="facts-list">
      <li>Dates and times come from public listings, mostly ${(data.sources || []).map((s) => `<a href="${esc(s.url)}" rel="noopener" target="_blank" aria-label="${esc(s.name)}, one of the listings this calendar is read from, opens on ${esc(hostOf(s.url))}">${esc(s.name)}</a>`).join(" and ")}, read ${esc(longDate(data.checked) || data.checked)}.</li>
      <li><strong>Always check the listing before you drive.</strong> Small shows move, sell out of tables, or get called off, and a page like this is a starting point rather than a promise.</li>
      <li>We are not the organizer of any of these and we do not take a cut. It is just a list.</li>
      <li>Shows in the Southern Tier are left off on purpose. They show up in the same feeds but they are closer to Binghamton than to any of these three cities.</li>
    </ul>
    ${/* THE LOCAL CLUSTER. This page held no in-body link to any of the other
          three Rochester pages, and /vendors.html and /creators.html had no
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
      <a href="/shops.html">card shops around Rochester</a> are open the rest of the time and run league nights,
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
${footer("Show listings are collected by hand and change without notice. Check with the organizer before traveling.")}
<script>
(function(){
${CLIENT_DAY_JS}
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
      next.querySelector('.next-meta').textContent=first.querySelector('.show-meta').textContent
        + ' \u2022 ' + first.querySelector('.show-where').textContent;
      var lbl=next.querySelector('.next-label');
      if(lbl) lbl.textContent='Next one up';
      var href=first.querySelector('.show-links a');
      if(href) next.setAttribute('href', href.getAttribute('href'));
    } else {
      next.remove();
    }
  }

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
      el.hidden = region !== 'all' && el.dataset.region !== region;
    });
    var any = false;
    document.querySelectorAll('.show-month').forEach(function(m){
      var vis = m.querySelectorAll('.show:not([hidden])').length;
      m.hidden = vis === 0;
      if (vis) any = true;
    });
    if (empty) empty.hidden = any;
    ${/* Same filter, same click, both views. The map is the SECOND view of the
          same list and moves with it; a map still showing Syracuse while the
          list below had been narrowed to Rochester would be worse than no map.
          It was the third of three until the calendar came off, and this loop
          is unchanged by that: the two .cal- loops that sat above it were
          deleted whole rather than edited, so nothing here silently stopped
          driving something. Faded, not removed, so the geography stays put;
          see the .map-t.is-off rules and the note beside them. */ ""}
    document.querySelectorAll('.map-t').forEach(function(t){
      t.classList.toggle('is-off', region !== 'all' && t.dataset.region !== region);
    });
    ${/* The key is the narrow layout's half of the same mark, so it fades with
          it. Without this line a phone filtered to Rochester would show a faded
          dot with a full-strength name beside it saying the same town is on. */ ""}
    document.querySelectorAll('.map-key li').forEach(function(t){
      t.classList.toggle('is-off', region !== 'all' && t.dataset.region !== region);
    });
  }
  document.querySelectorAll('.chip.filt').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.chip.filt').forEach(function(o){ o.removeAttribute('aria-current'); });
      b.setAttribute('aria-current','true');
      apply(b.dataset.region);
    });
  });
  apply('all');
})();
</script>
${APP_JS}
</body>
</html>
`;

await mkdir(join(ROOT, "public/assets/shows"), { recursive: true });
await writeFile(join(ROOT, "public/card-shows.html"), page);

console.log(`Wrote public/card-shows.html
  ${upcoming.length} upcoming shows across ${byMonth.length} months
  ${pokemonCount} all-Pokemon, ${upcoming.filter((s) => s.admission === "Free").length} free entry
  next: ${next ? `${next.name}, ${next.date}, ${next.city}` : "nothing listed"}
  ${(data.shows || []).length - upcoming.length} past show(s) dropped
  flyers: ${upcoming.filter((s) => s.flyer).length} named`);
if (missingFlyers.length) {
  console.log(`\n${missingFlyers.length} flyer(s) named but missing:`);
  for (const m of missingFlyers) console.log("  " + m);
}
