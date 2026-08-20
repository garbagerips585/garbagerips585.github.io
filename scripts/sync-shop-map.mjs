#!/usr/bin/env node
// Fetch the Rochester map geometry that /shops.html draws under its shop dots.
//
//   node scripts/sync-shop-map.mjs             uses the cache when it is warm
//   node scripts/sync-shop-map.mjs --refresh   ignores the cache and re-fetches
//
// Overpass -> .cache/shop-map/*.json (raw, gitignored) -> data/shop-map.json
// (simplified, committed). build-shops.mjs reads the committed file and makes
// no network request, ever.
//
// THIS IS NOT IN build-all.mjs AND MUST NOT BE ADDED TO IT. Same arrangement
// and the same reason as sync-decks.mjs and sync-plate-photos.py: it is four
// queries against a volunteer-run public server, and what it records is a dated
// read of somebody else's database. Refreshing it is a deliberate act by a
// person who then looks at the picture it produced. A scheduled build that
// depended on this would fail on Overpass being busy, which it is, often: the
// first run of this script got a 504 on its first attempt and a 200 on its
// second, which is why the fetch below retries with a backoff and why it says
// out loud when it gives up rather than writing a half-drawn map.
//
// LICENCE. OpenStreetMap data is ODbL. It must be attributed, so /shops.html
// carries "Map data from OpenStreetMap contributors, ODbL" in the figure's own
// caption with the licence linked, and the `attribution` block written into
// data/shop-map.json below is the copy the builder prints. That is a condition
// of use, not a courtesy: do not delete it from either file.
//
// NO RASTER TILES, AND THAT IS THE WHOLE DESIGN. This site could have dropped
// an <img> of a tile onto the page in ten lines. It does not, for three
// separate reasons and all three are disqualifying on their own:
//   - OSM's tile usage policy prohibits systematic downloading of tiles, and a
//     build step that harvests them is exactly that.
//   - A tile served at page load is a request to somebody else's server on
//     every visit. This site removed a preconnect to ytimg for that reason; it
//     is not about to add a whole third-party image dependency to a page that
//     currently loads zero images.
//   - A raster tile is painted in somebody else's colours and cannot be
//     repainted in ours. Vector geometry can, and the shop dots have to stay
//     the loudest thing in the frame.
// Fetching the DATA once, at build time, into a file we commit, is a different
// act from harvesting tiles: it is four queries, run by hand, cached forever.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache/shop-map");
const REFRESH = process.argv.includes("--refresh");

const ENDPOINT = "https://overpass-api.de/api/interpreter";
// Overpass asks that a script identify itself so an operator can tell a bug
// from an attack. This is a handful of requests run by hand, not a crawler.
const UA = "garbagerips585-shop-map/1.0 (https://garbagerips585.com/shops.html)";

// THE BOX IS THE DRAWING, PLUS A MARGIN, AND THE BUILDER CHECKS IT.
//
// build-shops.mjs fits its six shop coordinates into a 640x446 viewBox and the
// canvas therefore reaches further than the shops do: at today's data the
// drawing spans 43.0561 to 43.2308 north and -77.7318 to -77.3884 east. The box
// below is that, rounded outwards and given roughly a mile of slack on every
// side, so a road that leaves the frame is still drawn all the way to the edge
// rather than stopping short of it.
//
// The builder recomputes its own canvas extent on every build and THROWS if it
// falls outside this box. That is the failure this pairing is exposed to: add a
// seventh shop out in Batavia, the canvas grows west, and the map would quietly
// render a white gap where the data ran out. Re-run this script with a wider
// box when that happens; the error message says so.
const BOX = { south: 43.045, west: -77.75, north: 43.245, east: -77.37 };
const BBOX = `${BOX.south},${BOX.west},${BOX.north},${BOX.east}`;

// WHAT GETS DRAWN, AND WHY THE LIST STOPS WHERE IT DOES. The figure is 640
// units wide and is drawn at 0.59 of that on a phone, so every stroke on it is
// under a pixel of real estate. Roads are here to say "this is a city and these
// are the ways through it", not to navigate by, and the moment the network gets
// dense enough to trace a route it is dense enough to bury six shop dots.
// Measured on the real box: motorway 623 ways, trunk 98, primary 1,699,
// secondary 1,270, tertiary 1,277. Adding tertiary is a 35% increase in ink for
// streets nobody could read at 0.59 scale, so the list ends at secondary.
const QUERIES = {
  roads: `[out:json][timeout:180];
way["highway"~"^(motorway|trunk|primary|secondary)$"]["area"!="yes"](${BBOX});
out geom;`,

  // Water is two different things and both are needed. The POLYGONS are what
  // makes a map look like a map: Irondequoit Bay, the widening of the Genesee
  // through the city, the reservoirs. The LINES carry the Genesee and the Erie
  // Canal through the stretches where OSM holds a centreline and no riverbank
  // polygon, and without them the river arrives from the north and stops dead.
  water: `[out:json][timeout:180];
(
  way["natural"="water"](${BBOX});
  relation["natural"="water"](${BBOX});
);
out geom;`,

  waterways: `[out:json][timeout:180];
way["waterway"~"^(river|canal)$"](${BBOX});
out geom;`,

  // ONE BOUNDARY, NOT EVERY BOUNDARY. admin_level 8 in Monroe County is 20-odd
  // towns and villages and drawing them all is a second road network in dashes.
  // The City of Rochester's own line is the one that means something to a
  // reader: three of the six shops are inside it and three are not, which is
  // the actual shape of "shops around Rochester" that the page's area labels
  // ("Penfield", "Henrietta", "Webster") are trying to convey.
  //
  // IT IS admin_level 7 AND ITS NAME IS "City of Rochester", WHICH COST A
  // ROUND TRIP. The obvious query, level 8 named "Rochester", is what every
  // tutorial writes and it returns ZERO here: New York files a city at 7 and
  // OSM carries the legal name. Overpass answered 200 with an empty element
  // list, so nothing errored and the layer simply came out blank -- which is
  // the failure mode this whole script is built to avoid, and it got in through
  // the one query nobody checked the count of. The builder now refuses to draw
  // a layer the data file says is empty.
  boundary: `[out:json][timeout:180];
relation["boundary"="administrative"]["admin_level"="7"]["name"="City of Rochester"](${BBOX});
out geom;`,
};

/**
 * POST one Overpass query, with the retry this server genuinely needs.
 *
 * overpass-api.de answers 504 with an HTML page reading "The server is probably
 * too busy" rather than a 429, and it does it often enough that a single
 * attempt is not a test of anything. Five tries with a widening gap, then give
 * up loudly. It never writes a partial file: a failed layer throws, and the
 * caller leaves data/shop-map.json exactly as it found it.
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
          `Nothing was written. data/shop-map.json is unchanged and /shops.html will\n` +
          `keep drawing whatever it already holds. Try again later.`
      );
    }
    await new Promise((r) => setTimeout(r, attempt * 20_000));
  }
}

// ---------------------------------------------------------------------------
// Projection. The SAME arithmetic build-shops.mjs uses, and it is here only so
// simplification tolerances and area cuts can be expressed in MILES rather than
// in degrees. A degree of longitude is cos(latitude) of a degree of latitude,
// 0.7296 at Rochester's 43.15, so a tolerance in raw degrees would simplify the
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
 * or bridge, so Monroe Avenue is not one way, it is thirty. 3,690 road ways
 * emitted as 3,690 <path> elements is 3,690 "M" commands and 3,690 sets of
 * attributes before a single coordinate is written, and simplification cannot
 * help because a two-node way is already minimal. Stitched first, the same
 * network is a few hundred long polylines that RDP can then take real bites
 * out of.
 *
 * Endpoints are matched on the coordinate rounded to 7 decimal places, which is
 * 11mm, rather than on node id: `out geom` does not return ids, and two ways
 * that meet share the node exactly, so the rounding is not doing any work
 * beyond making a float a map key.
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
 * The point is bytes, not correctness of the picture: the SVG carries a
 * clipPath anyway, so an unclipped road would look identical and simply cost
 * coordinates nobody ever sees. Doing it as a real segment clip rather than
 * "drop the points that are outside" matters for one case that is common in
 * this data, a single simplified motorway segment running clean across a corner
 * of the frame with both of its endpoints outside it: dropping points would
 * erase that road, clipping keeps the part that shows.
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

/** Shoelace area in square miles, for deciding which ponds are worth ink. */
function areaMi2(ring) {
  const p = ring.map(toMi);
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  }
  return Math.abs(a / 2);
}

const round = (pts) => pts.map(([lat, lon]) => [+lat.toFixed(5), +lon.toFixed(5)]);

// ---------------------------------------------------------------------------
console.log(`Overpass, box ${BBOX}${REFRESH ? "  (--refresh)" : ""}`);
const raw = {};
for (const [name, q] of Object.entries(QUERIES)) raw[name] = await overpass(name, q);

const geom = (e) => (e.geometry || []).filter(Boolean).map((g) => [g.lat, g.lon]);

// ROADS. Two classes, not four: motorway and trunk are the same stroke to a
// reader and so are primary and secondary. The page draws "big road" and
// "other road" and nothing finer, because a four-weight legend on a figure this
// size is a legend nobody reads.
const roadClass = (h) => (h === "motorway" || h === "trunk" ? "major" : "minor");
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
      // EVERY TOLERANCE IN THIS FILE IS IN MILES AND IS SET AGAINST ONE NUMBER:
      // the figure draws at 37 units per mile, and at 390px wide a unit is
      // 0.61 of a pixel. So 0.02 miles is 106 feet, 0.74 of a unit, and 0.45 of
      // a pixel on a phone. Detail finer than that is bytes the file pays for
      // and nobody can see.
      //
      // MEASURED BOTH WAYS RATHER THAN PICKED. At 0.012 the geometry was 5,053
      // points and put 63KB of path data on a 57KB page, which more than
      // doubled it. At these settings it is 3,312 points and 33KB, and the two
      // pictures are indistinguishable at 1440 with a screenshot of each open
      // side by side. Water and the city line take a coarser tolerance again
      // (0.014 and 0.03) because a shoreline and an administrative line have no
      // features a reader is looking for, where a road bending round the bay
      // does.
      const s = simplify(run, 0.02);
      if (s.length > 1) roads[cls].push(round(s));
    }
  }
}

// WATER POLYGONS. Ways are closed rings already. Relations are multipolygons,
// so their outer members are stitched into rings first; inner members (holes,
// mostly islands in the bay) are dropped, because a hole drawn as a second
// filled ring in the same colour is invisible and a hole drawn correctly needs
// fill-rule bookkeeping for one island nobody will see at this size.
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
// THE AREA CUT IS THE DIFFERENCE BETWEEN A MAP AND A RASH. The box holds 643
// natural=water ways and most of them are a farm pond or a golf course hazard,
// twenty feet across, which at this scale is a third of a pixel of teal. A
// hundredth of a square mile is about 190 metres square, which is the smallest
// thing that is still a shape rather than a speck when the figure is drawn at
// 0.61. It keeps 50 of the 676: the bay, the widened Genesee, the reservoirs
// and the handful of ponds big enough to be landmarks.
const MIN_WATER = 0.01;
const water = [];
for (const ring of rings) {
  if (areaMi2(ring) < MIN_WATER) continue;
  const clipped = clipLine(ring.concat([ring[0]]), BOX);
  // A ring that leaves the box comes back as open runs. Each is emitted as its
  // own filled shape and closed by the renderer, which is right for a shape
  // clipped against a straight edge and is why the box has a margin: the join
  // it invents lands outside the drawing.
  for (const run of clipped) {
    const s = simplify(run, 0.014);
    if (s.length > 2) water.push(round(s));
  }
}

// WATERWAY CENTRELINES.
const waterways = [];
{
  const ways = raw.waterways.elements.map(geom).filter((p) => p.length > 1);
  for (const line of stitch(ways)) {
    for (const run of clipLine(line, BOX)) {
      const s = simplify(run, 0.018);
      if (s.length > 1) waterways.push(round(s));
    }
  }
}

// THE CITY LINE. One relation, its outer ways stitched into a ring, and it is
// drawn as a stroke rather than a fill so an unclosed piece is not a bug.
const boundary = [];
for (const e of raw.boundary.elements) {
  const outers = (e.members || [])
    .filter((m) => m.type === "way" && (m.role === "outer" || !m.role))
    .map((m) => (m.geometry || []).filter(Boolean).map((g) => [g.lat, g.lon]))
    .filter((p) => p.length > 1);
  for (const ring of stitch(outers)) {
    for (const run of clipLine(ring, BOX)) {
      const s = simplify(run, 0.03);
      if (s.length > 1) boundary.push(round(s));
    }
  }
}

const count = (a) => a.reduce((n, l) => n + l.length, 0);
const doc = {
  _readme: [
    "Road, water and boundary geometry for the map at the top of /shops.html.",
    "GENERATED. Do not hand edit: run `node scripts/sync-shop-map.mjs --refresh`.",
    "",
    "Every array is a polyline of [lat, lon] pairs, degrees, 5 decimal places",
    "(about a metre, which is a hundredth of a pixel at the size this draws).",
    "`water` entries are closed by the renderer and filled; everything else is",
    "stroked. build-shops.mjs projects them with the same arithmetic it projects",
    "the shop coordinates with, and clips them to its own canvas.",
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
  read: new Date().toISOString().slice(0, 10),
  osmTimestamp: raw.roads.osm3s?.timestamp_osm_base || null,
  box: BOX,
  // What was asked for, so the next reader does not have to reverse it out of
  // the polylines. These strings are the queries above with the box in them.
  layers: {
    roads: "highway = motorway, trunk, primary or secondary",
    water: `natural = water, ways and multipolygon relations, over ${MIN_WATER} square miles`,
    waterways: "waterway = river or canal",
    boundary: "boundary = administrative, admin_level 8, name Rochester",
  },
  counts: {
    osmWays: raw.roads.elements.length + raw.water.elements.length +
      raw.waterways.elements.length + raw.boundary.elements.length,
    roadsMajor: roads.major.length,
    roadsMinor: roads.minor.length,
    water: water.length,
    waterways: waterways.length,
    boundary: boundary.length,
    points: count(roads.major) + count(roads.minor) + count(water) +
      count(waterways) + count(boundary),
  },
  roads,
  water,
  waterways,
  boundary,
};

// ONE POLYLINE PER LINE. JSON.stringify's own indenting puts every latitude and
// every longitude on a line of its own, which on this file is 5,000 points
// turned into 15,000 lines and 203KB where 111KB says the same thing. Each
// polyline is stashed behind a token, stringified compactly, and dropped back
// in, so the metadata at the top of the file stays readable and the geometry
// stays one row per shape. A diff of a re-run is then a diff of shapes.
const holes = [];
const stash = (arr) => arr.map((l) => { holes.push(JSON.stringify(l)); return `@@${holes.length - 1}@@`; });
doc.roads = { major: stash(roads.major), minor: stash(roads.minor) };
doc.water = stash(water);
doc.waterways = stash(waterways);
doc.boundary = stash(boundary);

const out = join(ROOT, "data/shop-map.json");
await writeFile(
  out,
  JSON.stringify(doc, null, 1).replace(/"@@(\d+)@@"/g, (_, i) => holes[+i]) + "\n"
);
const bytes = (await readFile(out)).length;
console.log(
  `Wrote data/shop-map.json  (${doc.counts.osmWays} OSM elements in, ` +
    `${doc.counts.roadsMajor + doc.counts.roadsMinor} road lines, ${doc.counts.water} water shapes, ` +
    `${doc.counts.waterways} waterways, ${doc.counts.boundary} boundary lines, ` +
    `${doc.counts.points} points, ${(bytes / 1024).toFixed(1)}KB)`
);
