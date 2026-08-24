#!/usr/bin/env node
// Fetch the upstate New York map geometry that /card-shows.html draws under its
// town dots.
//
//   node scripts/sync-card-show-map.mjs             uses the cache when it is warm
//   node scripts/sync-card-show-map.mjs --refresh   ignores the cache and re-fetches
//
// Overpass -> .cache/card-show-map/*.json (raw, gitignored) -> data/card-show-map.json
// (simplified, committed). build-shows.mjs reads the committed file and makes no
// network request, ever.
//
// THE NAME IS card-show-map AND NOT show-map, for the reason build-shows.mjs's
// own header gives about the page: /shops.html and /card-shows.html already sit
// one typo apart, and `sync-shop-map.mjs` versus `sync-show-map.mjs` would have
// been one letter apart in a directory of eighty scripts. The page is
// /card-shows.html, so the data file and the fetcher are card-show-map too.
//
// THIS IS NOT IN build-all.mjs AND MUST NOT BE ADDED TO IT. Same arrangement and
// the same reason as sync-shop-map.mjs, sync-decks.mjs and sync-plate-photos.py:
// it is three queries against a volunteer-run public server, and what it records
// is a dated read of somebody else's database. Refreshing it is a deliberate act
// by a person who then looks at the picture it produced. A scheduled build that
// depended on this would fail on Overpass being busy, which it is, often, which
// is why the fetch below retries with a backoff and says out loud when it gives
// up rather than writing a half-drawn map.
//
// LICENCE. OpenStreetMap data is ODbL. It must be attributed, so /card-shows.html
// carries "Map data from OpenStreetMap contributors, licensed ODbL 1.0" in the
// figure's own caption with the licence linked, and the `attribution` block
// written into data/card-show-map.json below is the copy the builder prints.
// That is a condition of use, not a courtesy: do not delete it from either file.
//
// NO RASTER TILES, AND THAT IS THE WHOLE DESIGN. Three reasons, each
// disqualifying on its own, and all three are argued in full at the top of
// scripts/sync-shop-map.mjs: OSM's tile usage policy prohibits systematic
// downloading; a tile served at page load is a request to somebody else's server
// on every visit, which is the objection that got the ytimg preconnect removed;
// and a tile is painted in somebody else's colours and cannot be repainted in
// ours, where vector geometry can. Fetching the DATA once, by hand, into a file
// we commit is a different act from harvesting tiles.
//
// WHAT IS DIFFERENT FROM /shops.html, AND IT IS THE SCALE. That map is metro
// Rochester, 24 miles across, and it draws motorway, trunk, primary and
// secondary because at 37 units to the mile a primary road is a legible object.
// This one spans SANBORN TO SYRACUSE, 147 miles, and draws at 3.95 units to the
// mile: at 390px that is 2.05 PIXELS PER MILE, so every stroke on it is a fifth
// of the size the same stroke is over there. Measured on the real box, the road
// classes hold 3,820 motorway ways, 2,284 trunk and 8,052 primary. Primary is
// twice the ink of the other two together for roads that at this size are a grey
// wash with no shape in it, so THE LIST ENDS AT TRUNK. The same arithmetic runs
// the other way on water: /shops.html keeps a pond over a hundredth of a square
// mile, which here would be a third of a pixel, so the cut is fifty times
// coarser and what survives is the Lake Ontario shore, the Finger Lakes, Oneida
// and Onondaga, and the Niagara River.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { SITE } from "../shared/site.mjs";
// localDay(), NOT new Date().toISOString().slice(0, 10). The `read` stamp below
// is printed on /card-shows.html as "read August 20, 2026", and toISOString is
// UTC: run after 8pm in Rochester it stamps TOMORROW and the page publishes a
// date that has not happened. That is not theoretical here, it is exactly what
// this script did on its first run and check-build.py failed the whole build for
// it. shared/today.mjs exists for this and its header lists the two other times
// the site shipped it. sync-shop-map.mjs still has the raw toISOString and will
// do the same thing to whoever refreshes it after dark.
import { localDay } from "../shared/today.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache/card-show-map");
const REFRESH = process.argv.includes("--refresh");

const ENDPOINT = "https://overpass-api.de/api/interpreter";
// Overpass asks that a script identify itself so an operator can tell a bug from
// an attack. This is a handful of requests run by hand, not a crawler. The
// contact url FOLLOWS THE FLIP through SITE, for the reason sync-shop-map.mjs
// records: a UA naming a host the site no longer serves is worse to an operator
// than no UA at all.
const UA = `garbagerips585-card-show-map/1.0 (${SITE}/card-shows.html; garbagerips585@gmail.com)`;

// THE BOX IS THE DRAWING, PLUS A MARGIN, AND THE BUILDER CHECKS IT.
//
// build-shows.mjs fits its town coordinates into a 660x250 viewBox and the
// canvas therefore reaches a long way past the towns: at today's data the towns
// span 42.9022 to 43.1573 north and -79.0615 to -76.1474 east, and the CANVAS
// that gets drawn is 42.5157 to 43.4337 north and -79.2624 to -75.9466 east.
// That is 63 miles by 167. The box below is that, rounded outwards with roughly
// eight miles of slack on every side, so a road or a shoreline that leaves the
// frame is drawn all the way to the edge rather than stopping short of it.
//
// The builder recomputes its own canvas extent on every build and THROWS if it
// falls outside this box. That is the failure this pairing is exposed to, and on
// THIS page it is likelier than on /shops.html, because the canvas is fitted to
// the towns that have a show COMING UP and that set changes every week. AREA in
// build-shows.mjs admits 28 towns and the widest of them all sit inside this
// box, but a show in a town nobody has listed yet would move the frame. Re-run
// this script with a wider box when the builder says so; its error names the
// edge and the distance.
const BOX = { south: 42.4, west: -79.45, north: 43.6, east: -75.75 };
const BBOX = `${BOX.south},${BOX.west},${BOX.north},${BOX.east}`;

// WHAT GETS DRAWN, AND WHY EACH LIST STOPS WHERE IT DOES.
const QUERIES = {
  // ROADS: motorway and trunk, nothing finer. See the note at the top of this
  // file for the counts that settled it. Two classes rather than one because
  // the Thruway is the reason these towns are a straight line on the picture
  // and it has to read as a heavier object than NY-104 does.
  roads: `[out:json][timeout:300];
way["highway"~"^(motorway|trunk)$"]["area"!="yes"](${BBOX});
out geom;`,

  // WATER. Ways are lakes and ponds; relations are the multipolygon ones, which
  // here is most of what matters (Lake Ontario, Lake Erie, Oneida, several of
  // the Finger Lakes).
  //
  // THE `length()` FILTER IS A DOWNLOAD SIZE FIX AND IT CANNOT DROP ANYTHING THE
  // AREA CUT WOULD HAVE KEPT, which is the only reason it is allowed to exist:
  // a server-side filter that silently disagrees with the client-side one is a
  // layer going missing. length() on a CLOSED way is its perimeter, and the
  // smallest perimeter a shape of MIN_WATER square miles can have is the circle,
  // which at 0.5 square miles is 4.03km. The filter is set at 3km, so every
  // shape the area cut below would keep is safely inside it. It takes the box
  // from 12,163 water ways to 238, which is the difference between a download
  // measured in tens of megabytes and one measured in hundreds of kilobytes.
  //
  // `out geom(BBOX)` RATHER THAN `out geom`, for the relations. Lake Ontario is
  // one relation whose geometry runs to Kingston and Toronto, none of which is
  // ever drawn here; asking Overpass to clip it to the box on the way out is the
  // difference between a usable cache file and a very large one. The clip is
  // redundant with clipLine below and is only about bytes on the wire.
  water: `[out:json][timeout:300];
(
  way["natural"="water"](if:length()>3000)(${BBOX});
  relation["natural"="water"](${BBOX});
);
out geom(${BBOX});`,

  // THERE IS NO WATERWAY LAYER HERE AND /shops.html HAS ONE. It was fetched,
  // built, drawn and then LOOKED AT, which is the only way this decision could
  // have been made: waterway = river or canal over 1.5km, stitched, cut at three
  // miles, came to 130 polylines and 1,702 POINTS, which was 30% of the whole
  // file and the largest layer after the lakes. On the sister map those lines
  // are load bearing, because they carry the Genesee and the Erie Canal through
  // the stretches where OSM holds a centreline and no riverbank polygon, and
  // without them the river arrives from the north and stops dead. At 2 pixels to
  // the mile they are not a river, they are a blue vein, and 130 of them across
  // the frame read as a rash of capillaries over the top of the thing the
  // picture is actually for. Screenshotted at 1440 with the layer on and off,
  // side by side: with it off the Thruway becomes the visible spine running
  // Buffalo to Batavia to Rochester to Syracuse, which is the ONE fact this map
  // exists to show, and with it on that line is one squiggle among fifty.
  //
  // NOTHING IS LOST THAT THE READER COULD SEE. The Niagara River, the widening
  // of the Genesee at the lake, Irondequoit Bay and the Oswego are all mapped as
  // natural=water POLYGONS and are still drawn, as fills, below. The caption
  // names what is on the map and does not claim a river.

  // THE COUNTY LINES, admin_level 6, WHICH IS THE ONE THING THAT CHANGES AT THIS
  // SCALE. /shops.html draws ONE boundary, the City of Rochester, because inside
  // one metro a city limit is the line that means something and the 20-odd town
  // lines around it are a second road network in dashes. Over 147 miles the city
  // limit is invisible and it is the COUNTY that a reader here has a feel for:
  // Monroe, Genesee, Erie, Niagara, Onondaga are how everybody upstate says
  // where something is, and the eight or nine of them across this frame are a
  // reference grid rather than a texture.
  //
  // READ sync-shop-map.mjs's NOTE BESIDE ITS OWN BOUNDARY QUERY BEFORE EDITING
  // THIS ONE. The obvious query there, admin_level 8 named "Rochester", returns
  // HTTP 200 WITH ZERO ELEMENTS, because New York files a city at level 7 under
  // its legal name. Nothing errors and the layer simply comes out blank. Level 6
  // is right for a US county and was checked rather than assumed: the count came
  // back 29 for this box, which is the western half of the state plus a few over
  // the lake, and not 0.
  boundary: `[out:json][timeout:300];
relation["boundary"="administrative"]["admin_level"="6"](${BBOX});
out geom(${BBOX});`,
};

/**
 * POST one Overpass query, with the retry this server genuinely needs.
 *
 * overpass-api.de answers 504 with an HTML page reading "The server is probably
 * too busy" rather than a 429, and it does it often enough that a single attempt
 * is not a test of anything. Five tries with a widening gap, then give up
 * loudly. It never writes a partial file: a failed layer throws, and the caller
 * leaves data/card-show-map.json exactly as it found it.
 */
async function overpass(name, query) {
  const cached = join(CACHE, `${name}.json`);
  if (!REFRESH && existsSync(cached)) {
    console.log(`  ${name}: cached`);
    return JSON.parse(await readFile(cached, "utf8"));
  }
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
    });
    const text = await res.text();
    if (res.ok && text.trimStart().startsWith("{")) {
      const doc = JSON.parse(text);
      await mkdir(CACHE, { recursive: true });
      await writeFile(cached, text);
      console.log(`  ${name}: ${doc.elements.length} elements, ${(text.length / 1024) | 0}KB`);
      return doc;
    }
    const why = res.ok ? "a non-JSON body" : `HTTP ${res.status}`;
    console.log(`  ${name}: attempt ${attempt} got ${why}`);
    if (attempt === 5) {
      throw new Error(
        `Overpass would not answer the "${name}" query after 5 attempts (${why}).\n` +
          `Nothing was written. data/card-show-map.json is unchanged and /card-shows.html\n` +
          `will keep drawing whatever it already holds. Try again later.`
      );
    }
    await new Promise((r) => setTimeout(r, attempt * 20_000));
  }
}

// ---------------------------------------------------------------------------
// Projection. The SAME arithmetic build-shows.mjs uses, and it is here only so
// simplification tolerances and area cuts can be expressed in MILES rather than
// in degrees. A degree of longitude is cos(latitude) of a degree of latitude,
// 0.731 at this box's 43.0, so a tolerance in raw degrees would simplify the
// east-west axis 37% harder than the north-south one.
const KX = Math.cos(((BOX.south + BOX.north) / 2 / 180) * Math.PI);
const MI_PER_DEG_LAT = 69.0;
const toMi = ([lat, lon]) => [lon * MI_PER_DEG_LAT * KX, lat * MI_PER_DEG_LAT];

/** Ramer-Douglas-Peucker, tolerance in miles. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const p = pts.map(toMi);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const [ax, ay] = p[a], [bx, by] = p[b];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let far = -1, best = tol;
    for (let i = a + 1; i < b; i++) {
      const [cx, cy] = p[i];
      let d;
      if (len2 === 0) {
        d = Math.hypot(cx - ax, cy - ay);
      } else {
        const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / len2));
        d = Math.hypot(cx - (ax + t * dx), cy - (ay + t * dy));
      }
      if (d > best) { best = d; far = i; }
    }
    if (far >= 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/**
 * Chain ways that share an endpoint into single polylines.
 *
 * THIS IS THE STEP THAT MAKES THE FILE SMALL ENOUGH TO COMMIT, and it is worth
 * the forty lines. OSM splits a road at every change of speed limit, lane count
 * or bridge, so the Thruway across this box is not one way, it is hundreds.
 * 6,000 road ways emitted as 6,000 polylines is 6,000 "M" commands before a
 * single coordinate is written, and simplification cannot help because a
 * two-node way is already minimal. Stitched first, the same network is a few
 * hundred long polylines that RDP can then take real bites out of.
 *
 * Endpoints are matched on the coordinate rounded to 7 decimal places, which is
 * 11mm, rather than on node id: `out geom` does not return ids, and two ways
 * that meet share the node exactly, so the rounding is not doing any work beyond
 * making a float a map key.
 */
function stitch(ways) {
  const key = ([lat, lon]) => `${lat.toFixed(7)},${lon.toFixed(7)}`;
  const ends = new Map();
  const at = (k) => { if (!ends.has(k)) ends.set(k, []); return ends.get(k); };
  const items = ways.map((pts, i) => ({ pts, i, used: false }));
  for (const it of items) {
    at(key(it.pts[0])).push(it);
    at(key(it.pts[it.pts.length - 1])).push(it);
  }
  const out = [];
  for (const seed of items) {
    if (seed.used) continue;
    seed.used = true;
    let line = seed.pts.slice();
    // Extend off both ends. A junction with three or more ways is ambiguous and
    // is simply left as a break: picking one arbitrarily would draw a road that
    // turns a corner it does not turn.
    for (const forward of [true, false]) {
      for (;;) {
        const tip = forward ? line[line.length - 1] : line[0];
        const cands = (ends.get(key(tip)) || []).filter((c) => !c.used);
        if (cands.length !== 1) break;
        const next = cands[0];
        next.used = true;
        const a = next.pts, sameStart = key(a[0]) === key(tip);
        const add = sameStart ? a.slice(1) : a.slice(0, -1).reverse();
        if (forward) line = line.concat(add);
        else line = add.reverse().concat(line);
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * Cohen-Sutherland, clipping a polyline to the box and splitting it where it
 * leaves and re-enters.
 *
 * The point is bytes, not correctness of the picture: the SVG carries a clipPath
 * anyway, so an unclipped road would look identical and simply cost coordinates
 * nobody ever sees. Doing it as a real segment clip rather than "drop the points
 * that are outside" matters for one case that is common in this data, a single
 * simplified motorway segment running clean across a corner of the frame with
 * both of its endpoints outside it: dropping points would erase that road,
 * clipping keeps the part that shows.
 */
function clipLine(pts, box) {
  const code = ([lat, lon]) =>
    (lon < box.west ? 1 : 0) | (lon > box.east ? 2 : 0) |
    (lat < box.south ? 4 : 0) | (lat > box.north ? 8 : 0);
  const runs = [];
  let run = [];
  for (let i = 0; i < pts.length - 1; i++) {
    let a = pts[i], b = pts[i + 1];
    let ca = code(a), cb = code(b), ok = false;
    for (let guard = 0; guard < 8; guard++) {
      if (!(ca | cb)) { ok = true; break; }
      if (ca & cb) break;
      const c = ca || cb;
      let lat, lon;
      if (c & 8) { lat = box.north; lon = a[1] + ((b[1] - a[1]) * (box.north - a[0])) / (b[0] - a[0]); }
      else if (c & 4) { lat = box.south; lon = a[1] + ((b[1] - a[1]) * (box.south - a[0])) / (b[0] - a[0]); }
      else if (c & 2) { lon = box.east; lat = a[0] + ((b[0] - a[0]) * (box.east - a[1])) / (b[1] - a[1]); }
      else { lon = box.west; lat = a[0] + ((b[0] - a[0]) * (box.west - a[1])) / (b[1] - a[1]); }
      if (c === ca) { a = [lat, lon]; ca = code(a); } else { b = [lat, lon]; cb = code(b); }
    }
    if (!ok) { if (run.length) { runs.push(run); run = []; } continue; }
    if (!run.length) run.push(a);
    run.push(b);
  }
  if (run.length) runs.push(run);
  return runs.filter((r) => r.length > 1);
}

/** Shoelace area in square miles, for deciding which lakes are worth ink. */
function areaMi2(ring) {
  const p = ring.map(toMi);
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  }
  return Math.abs(a / 2);
}

const round = (pts) => pts.map(([lat, lon]) => [+lat.toFixed(4), +lon.toFixed(4)]);

// ---------------------------------------------------------------------------
console.log(`Overpass, box ${BBOX}${REFRESH ? "  (--refresh)" : ""}`);
const raw = {};
for (const [name, q] of Object.entries(QUERIES)) raw[name] = await overpass(name, q);

const geom = (e) => (e.geometry || []).filter(Boolean).map((g) => [g.lat, g.lon]);

// EVERY TOLERANCE IN THIS FILE IS IN MILES AND IS SET AGAINST ONE NUMBER: the
// figure draws at 3.95 units per mile, and at 390px wide a unit is 0.52 of a
// pixel, so ONE MILE IS 2.05 PIXELS ON A PHONE. 0.12 miles is a quarter of a
// pixel. Detail finer than that is bytes the file pays for and nobody can see,
// which is why these numbers are six times the ones in sync-shop-map.mjs: that
// map draws nine times the units per mile.
//
// FIVE DECIMAL PLACES WOULD BE FALSE PRECISION HERE and the round() above uses
// FOUR. A ten-thousandth of a degree is 11 metres, which is a fortieth of a
// pixel at this scale; the fifth place is 1.1 metres and is a quarter of that
// again. sync-shop-map.mjs keeps five because it draws nine times bigger. On
// this file the difference is 8% of the committed bytes for nothing visible.
const TOL = { road: 0.12, water: 0.1, boundary: 0.2 };

// ROADS. Two classes: motorway is the Thruway and the interstates, trunk is
// everything else that is a real drive between these towns.
const roadClass = (h) => (h === "motorway" ? "major" : "minor");
const roads = { major: [], minor: [] };
for (const cls of ["major", "minor"]) {
  const ways = raw.roads.elements
    .filter((e) => e.type === "way" && roadClass(e.tags.highway) === cls)
    .map(geom)
    .filter((p) => p.length > 1);
  // Stitch, then clip, then simplify: simplifying first would round the shared
  // endpoints apart and stitch would find nothing to join.
  for (const line of stitch(ways)) {
    for (const run of clipLine(line, BOX)) {
      const s = simplify(run, TOL.road);
      if (s.length > 1) roads[cls].push(round(s));
    }
  }
}

// WATER POLYGONS. Ways are closed rings already. Relations are multipolygons, so
// their outer members are stitched into rings first; inner members (holes,
// mostly islands) are dropped, because a hole drawn as a second filled ring in
// the same colour is invisible and a hole drawn correctly needs fill-rule
// bookkeeping for islands nobody will see at this size.
const rings = [];
for (const e of raw.water.elements) {
  if (e.type === "way") {
    const p = geom(e);
    if (p.length > 3) rings.push(p);
  } else if (e.type === "relation") {
    const outers = (e.members || [])
      .filter((m) => m.type === "way" && (m.role === "outer" || !m.role))
      .map((m) => (m.geometry || []).filter(Boolean).map((g) => [g.lat, g.lon]))
      .filter((p) => p.length > 1);
    for (const ring of stitch(outers)) if (ring.length > 3) rings.push(ring);
  }
}
// THE AREA CUT IS THE DIFFERENCE BETWEEN A MAP AND A RASH, and on this page it
// is FIFTY TIMES /shops.html's. That map keeps anything over a hundredth of a
// square mile, which is a 190 metre square and is the smallest thing that is
// still a shape at 37 units to the mile. Here a hundredth of a square mile is
// 0.2 of a pixel by 0.2. Half a square mile is 1.4 pixels by 1.4 on a phone,
// which is the floor for something that reads as a lake rather than as dirt on
// the screen, and it is chosen to keep every Finger Lake: the smallest of them,
// Canadice, is 0.9.
//
// LAKE ONTARIO IS NOT AFFECTED BY THIS AND IS THE REASON THE LAYER EXISTS. It
// is one relation, its shoreline runs the whole width of the frame, and it is
// the single feature that turns this from a scatter plot into a map of a place
// somebody recognises.
const MIN_WATER = 0.5;
const water = [];
let ponds = 0;
for (const ring of rings) {
  if (areaMi2(ring) < MIN_WATER) { ponds++; continue; }
  const clipped = clipLine(ring.concat([ring[0]]), BOX);
  // A ring that leaves the box comes back as open runs. Each is emitted as its
  // own filled shape and closed by the renderer, which is right for a shape
  // clipped against a straight edge and is why the box has a margin: the join it
  // invents lands outside the drawing.
  for (const run of clipped) {
    const s = simplify(run, TOL.water);
    if (s.length > 2) water.push(round(s));
  }
}

// THE COUNTY LINES. Outer ways stitched into rings and drawn as strokes rather
// than fills, so an unclosed piece is not a bug.
const boundary = [];
for (const e of raw.boundary.elements) {
  const outers = (e.members || [])
    .filter((m) => m.type === "way" && (m.role === "outer" || !m.role))
    .map((m) => (m.geometry || []).filter(Boolean).map((g) => [g.lat, g.lon]))
    .filter((p) => p.length > 1);
  for (const ring of stitch(outers)) {
    for (const run of clipLine(ring, BOX)) {
      const s = simplify(run, TOL.boundary);
      if (s.length > 1) boundary.push(round(s));
    }
  }
}

const count = (a) => a.reduce((n, l) => n + l.length, 0);
const doc = {
  _readme: [
    "Road, water and county geometry for the map at the top of /card-shows.html.",
    "GENERATED. Do not hand edit: run `node scripts/sync-card-show-map.mjs --refresh`.",
    "",
    "Every array is a polyline of [lat, lon] pairs, degrees, 4 decimal places",
    "(about 11 metres, which is a fortieth of a pixel at the size this draws).",
    "`water` entries are closed by the renderer and filled; everything else is",
    "stroked. build-shows.mjs projects them with the same arithmetic it projects",
    "the town coordinates with, and clips them to its own canvas.",
    "",
    "This is the SISTER of data/shop-map.json and not a copy of it: same shape,",
    "same fetcher design, six times the ground and a much shorter feature list.",
    "The reasoning for every cut is in scripts/sync-card-show-map.mjs.",
    "",
    "ODbL. The attribution below is a condition of use and the page prints it.",
  ],
  attribution: {
    text: "Map data from OpenStreetMap contributors",
    license: "ODbL 1.0",
    licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
    copyrightUrl: "https://www.openstreetmap.org/copyright",
  },
  source: "Overpass API (overpass-api.de)",
  read: localDay(),
  osmTimestamp: raw.roads.osm3s?.timestamp_osm_base || null,
  box: BOX,
  // What was asked for, so the next reader does not have to reverse it out of
  // the polylines. These strings are the queries above with the box in them.
  layers: {
    roads: "highway = motorway or trunk",
    water: `natural = water, ways over 3km of perimeter and multipolygon relations, kept over ${MIN_WATER} square miles`,
    waterways: "NOT FETCHED. Measured, drawn and rejected: see the note in the query block.",
    boundary: "boundary = administrative, admin_level 6, which is a US county",
  },
  counts: {
    osmElements: raw.roads.elements.length + raw.water.elements.length +
      raw.boundary.elements.length,
    roadsMajor: roads.major.length,
    roadsMinor: roads.minor.length,
    water: water.length,
    waterDropped: ponds,
    boundary: boundary.length,
    points: count(roads.major) + count(roads.minor) + count(water) + count(boundary),
  },
  roads,
  water,
  boundary,
};

// ONE POLYLINE PER LINE. JSON.stringify's own indenting puts every latitude and
// every longitude on a line of its own, which turns a few thousand points into
// tens of thousands of lines and doubles the file. Each polyline is stashed
// behind a token, stringified compactly, and dropped back in, so the metadata at
// the top of the file stays readable and the geometry stays one row per shape. A
// diff of a re-run is then a diff of shapes.
const holes = [];
const stash = (arr) => arr.map((l) => { holes.push(JSON.stringify(l)); return `@@${holes.length - 1}@@`; });
doc.roads = { major: stash(roads.major), minor: stash(roads.minor) };
doc.water = stash(water);
doc.boundary = stash(boundary);

const out = join(ROOT, "data/card-show-map.json");
await writeFile(
  out,
  JSON.stringify(doc, null, 1).replace(/"@@(\d+)@@"/g, (_, i) => holes[+i]) + "\n"
);
const bytes = (await readFile(out)).length;
console.log(
  `Wrote data/card-show-map.json  (${doc.counts.osmElements} OSM elements in, ` +
    `${doc.counts.roadsMajor} motorway lines, ${doc.counts.roadsMinor} trunk lines, ` +
    `${doc.counts.water} water shapes (${ponds} under ${MIN_WATER} sq mi dropped), ` +
    `${doc.counts.boundary} county lines, ` +
    `${doc.counts.points} points, ${(bytes / 1024).toFixed(1)}KB)`
);
