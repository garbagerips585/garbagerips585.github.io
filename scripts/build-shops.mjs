#!/usr/bin/env node
// Build public/shops.html from data/shops.json: the card shops around
// Rochester that Tim actually buys from.
//
//   node scripts/build-shops.mjs
//
// This is the most local-SEO page on the site. "pokemon card shop rochester ny"
// is a real search with real intent, and a page that names shops, links them
// properly and says what each is good for is the kind of page that earns it.
// LocalBusiness schema is deliberately NOT emitted: these are other people's
// businesses and we are not their authority. ItemList is what this actually is.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// APP_JS_NO_PACKPLAYER, not APP_JS. Nothing on this page plays a rip where it
// sits; verified by driving it with a real dispatched click, not by grepping.
// packs.css is NOT dropped here and cannot be from this file: these four pages
// take their <head> by slicing index.html, so their stylesheet links are the
// home page's. See shared/chrome.mjs beside the two exports.
import { APP_JS_NO_PACKPLAYER as APP_JS, dropUnusedPacksCSS } from "../shared/chrome.mjs";
import { esc, longDate, plateRule, PLATE_CSS } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");



/**
 * Strip tracking and session parameters from an outbound link.
 *
 * A URL copied out of a shop's own site usually carries them. They point at one
 * person's browsing session rather than at the page, they stop working, and
 * they leak where the visitor came from. The clean path is the durable link.
 */
function cleanUrl(raw) {
  try {
    const u = new URL(raw);
    const junk = /^(_su_rec|_su_rec_id|utm_|fbclid|gclid|gbraid|wbraid|mc_eid|mc_cid|ref|_ga|igshid|si)$/i;
    for (const k of [...u.searchParams.keys()]) {
      if (junk.test(k) || k.startsWith("utm_")) u.searchParams.delete(k);
    }
    u.hash = "";
    return u.toString().replace(/\?$/, "");
  } catch {
    return raw;
  }
}

const shopsDoc = JSON.parse(await readFile(join(ROOT, "data/shops.json"), "utf8"));
const { shops } = shopsDoc;

// The roads, the water and the city line, written by scripts/sync-shop-map.mjs
// from the Overpass API and committed. NO NETWORK HAPPENS HERE and none may be
// added: that script is not in build-all.mjs, same arrangement as sync-decks.mjs
// and sync-plate-photos.py, and its own header says why.
const mapDoc = JSON.parse(await readFile(join(ROOT, "data/shop-map.json"), "utf8"));

/**
 * A drawn map of where the shops actually are.
 *
 * WHY THIS PAGE NEEDED A PICTURE AND WHAT IT HAD TO BE. Every card here says
 * something like "Panorama Plaza, Penfield" or "Jefferson Road, Henrietta",
 * which is precise and useful to somebody who already lives here and means
 * nothing at all to anybody else. This is the most local-SEO page on the site,
 * so a good share of its readers are exactly the people those labels fail. Six
 * dots and a scale bar answer "how far apart are these" in one look, which is
 * the question a list of addresses cannot answer at any length.
 *
 * DRAWN, NOT A MAP TILE, and that is a hard constraint rather than a
 * preference. A tile from any provider is a network request per tile, a
 * terms-of-use surface and about 200KB; this is a static site with no keys in
 * it. This is an SVG, so it costs one HTTP request that was happening anyway
 * and cannot break when somebody's tile server changes.
 *
 * THIS COMMENT USED TO SAY "THERE IS NO COASTLINE, NO ROAD AND NO CITY OUTLINE,
 * BECAUSE THIS SITE HAS NO LICENSED GEOMETRY FOR ANY OF THOSE", and the
 * figure's own caption admitted the gap out loud: "There are no roads on it
 * because we do not have any to draw." Tim read that and asked for the obvious
 * thing: "we should update the image to be an actual maps with the dots showing
 * where the stores are in the area."
 *
 * THE SENTENCE WAS THE SAME SHAPE OF MISTAKE AS THE GARBAGE PLATE PHOTOGRAPHS,
 * and CLAUDE.md describes that shape in full: a true statement about the
 * candidates somebody looked at, written as a statement about the subject. What
 * had been ruled out was TILES, correctly. What had not been looked at was the
 * DATA those tiles are drawn from, which OpenStreetMap gives away under the
 * ODbL and which the Overpass API will hand over in four queries. The gap was a
 * search, not a licence.
 *
 * SO THERE ARE ROADS ON IT NOW, and water, and the city line, all of them real
 * geometry projected through exactly the same arithmetic as the shop dots.
 * scripts/sync-shop-map.mjs fetches them once into data/shop-map.json and this
 * builder reads that file offline; the ODbL credit is in the caption with the
 * licence linked, because that is a condition of use rather than a courtesy.
 *
 * STILL NOT TILES, AND THAT PART OF THE OLD ARGUMENT SURVIVES INTACT. A raster
 * tile is a request to somebody else's server on every page load, from a page
 * that currently loads zero images; OSM's tile usage policy prohibits
 * systematically downloading them; and a tile is painted in somebody else's
 * colours and cannot be repainted in ours, which vector geometry can. Every
 * stroke below is a site token.
 *
 * THE SHOPS ARE STILL THE POINT AND THE MAP IS STILL THE BACKGROUND. Roads are
 * hairlines of the page ink at low opacity, water is a fill darker than the
 * land, and the dots and their names sit above all of it on their own plates.
 * The map has to answer "where are these relative to each other and to me". It
 * is not a navigation tool and the addresses on the cards below are still the
 * exact thing to put in a map app.
 *
 * THE PROJECTION IS THE ONE PART THAT COULD BE QUIETLY WRONG. A degree of
 * longitude is shorter than a degree of latitude everywhere except the equator,
 * by cos(latitude), which at Rochester's 43.15 degrees is 0.729. Plotting raw
 * lon against raw lat stretches the map 37% east to west, so two shops on the
 * same road would look further apart than two the same distance north of each
 * other. The x scale below carries that cosine, which is why the scale bar can
 * be one bar rather than two.
 *
 * A SHOP WITH NO COORDINATE IS NOT PLOTTED. data/shops.json carries `at` only
 * where the geocoder returned the shop's own street address, checked by hand.
 * The alternative, dropping a pin at the middle of the city, would look exactly
 * as authoritative as the other six and be a lie about a drive.
 */
function shopMap(list) {
  const pts = list.filter((s) => Array.isArray(s.at) && s.at.length === 2);
  if (pts.length < 2) return "";

  // H carries 26px of bottom margin the points never use, so the scale bar has
  // a strip of its own and cannot land on a shop name.
  const W = 640, H = 446, PAD = 46, FOOT = 26;
  const lats = pts.map((s) => s.at[0]);
  const lons = pts.map((s) => s.at[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);

  // Work in miles from the south-west corner, so the scale bar is exact.
  const MI_PER_DEG_LAT = 69.0;
  const x0 = Math.min(...lons), y0 = Math.min(...lats);
  const mx = (lon) => (lon - x0) * MI_PER_DEG_LAT * kx;
  const my = (lat) => (lat - y0) * MI_PER_DEG_LAT;
  const wMi = Math.max(...lons.map(mx)) || 1;
  const hMi = Math.max(...lats.map(my)) || 1;
  // One scale for both axes, or the map is not a map.
  const k = Math.min((W - PAD * 2) / wMi, (H - FOOT - PAD * 2) / hMi);
  const offX = (W - wMi * k) / 2, offY = FOOT + (H - FOOT - hMi * k) / 2;
  const px = (lon) => offX + mx(lon) * k;
  // SVG y grows downward and latitude grows northward, so this flips.
  const py = (lat) => H - (offY + my(lat) * k);

  // A round number of miles that is between a fifth and a half of the drawing.
  const nice = [1, 2, 5, 10, 20].find((n) => n * k > (W - PAD * 2) * 0.2) || 1;

  // THE CANVAS REACHES FURTHER THAN THE SHOPS DO, so the geometry has to as
  // well. px/py above are fitted to the six points and then centred, which
  // leaves 123 units of map either side of the easternmost and westernmost
  // shop. Inverting the projection at the four edges of the viewBox gives the
  // ground the drawing actually covers.
  const lonAt = (x) => x0 + (x - offX) / k / (MI_PER_DEG_LAT * kx);
  const latAt = (y) => y0 + (H - y - offY) / k / MI_PER_DEG_LAT;
  const canvas = { west: lonAt(0), east: lonAt(W), north: latAt(0), south: latAt(H) };

  // AND THE DATA FILE HAS TO COVER IT, WHICH IS THE ONE WAY THIS PAIRING CAN GO
  // QUIETLY WRONG. Add a seventh shop out past Batavia and the canvas grows
  // west into ground sync-shop-map.mjs never fetched, and the map renders a
  // clean empty margin that looks like a design decision. Fail instead, and say
  // which edge and by how far.
  const b = mapDoc.box;
  const over = [
    ["west", b.west - canvas.west], ["east", canvas.east - b.east],
    ["south", b.south - canvas.south], ["north", canvas.north - b.north],
  ].filter(([, d]) => d > 0);
  if (over.length) {
    throw new Error(
      `The shop map now reaches outside the geometry in data/shop-map.json: ` +
        over.map(([side, d]) => `${d.toFixed(4)} degrees past its ${side} edge`).join(", ") +
        `.\nWiden BOX in scripts/sync-shop-map.mjs and re-run it with --refresh.`
    );
  }
  // A layer that came back empty is a query that stopped matching, not a part
  // of Rochester that has no roads in it. That happened once already, on the
  // boundary: Overpass answered 200 with nothing in it and the layer silently
  // vanished. See the note beside that query.
  for (const [name, lines] of Object.entries({
    roads: [...mapDoc.roads.major, ...mapDoc.roads.minor],
    water: mapDoc.water,
    waterways: mapDoc.waterways,
    boundary: mapDoc.boundary,
  })) {
    if (!lines.length) {
      throw new Error(
        `data/shop-map.json has no ${name} in it. Overpass can answer 200 with an ` +
          `empty result, so re-run scripts/sync-shop-map.mjs --refresh and check the counts.`
      );
    }
  }

  // ONE <path> PER LAYER, NOT ONE PER WAY, and on this file that is the
  // difference between a page you can serve and a page you cannot. 311 stitched
  // road lines as 311 elements is 311 sets of attributes before a coordinate is
  // written. As five paths with many M subpaths apiece it is five.
  //
  // Consecutive points that round to the same tenth of a unit are dropped: RDP
  // in sync-shop-map.mjs works in miles on the ground and cannot know that two
  // of its survivors land on the same pixel here.
  //
  // RELATIVE LINETOS AFTER THE FIRST POINT, WHICH IS WORTH 21% OF THE PATH DATA
  // AND CANNOT DRIFT. An absolute point is "413.7 208.4", eleven characters, and
  // the step from it to the next one is usually under ten units: "3.1 -1.6" is
  // eight. THE TRAP IN DOING THIS IS ACCUMULATED ROUNDING, and it is a real one
  // -- a hundred deltas each rounded to a tenth can walk a road several units
  // off its own end. It is avoided by taking every delta from the last point
  // ACTUALLY EMITTED rather than from the true position, so the rounding error
  // is bounded at one tenth of a unit for the whole polyline instead of
  // compounding. `cur` below is the emitted position and nothing else may be
  // subtracted from.
  //
  // The separators are a comma inside a pair and a space between pairs, which
  // is the shortest form that cannot be misread. SVG's own grammar would let
  // "3.1-1.62.4" through, because a minus and a second decimal point both end
  // the number in front of them, but a path that depends on that is a path
  // nobody can debug and one renderer away from a straight line across the map.
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
    const start = line.find(() => true);
    return `M${+px(start[1]).toFixed(1)},${+py(start[0]).toFixed(1)}l${parts.join(" ")}${close ? "Z" : ""}`;
  };
  const layer = (lines, close) => lines.map((l) => d(l, close)).filter(Boolean).join("");

  // THE ORDER IS THE MAP. Water under roads, because a bridge crosses a river
  // and not the other way round; the city line above both because it is an idea
  // rather than a thing and has to survive being drawn over a motorway; the
  // dots above everything.
  const base = `<g clip-path="url(#shopmap-clip)" fill="none">
        <path class="sm-water" d="${layer(mapDoc.water, true)}"/>
        <path class="sm-stream" d="${layer(mapDoc.waterways)}"/>
        <path class="sm-road" d="${layer(mapDoc.roads.minor)}"/>
        <path class="sm-road-major" d="${layer(mapDoc.roads.major)}"/>
        <path class="sm-edge" d="${layer(mapDoc.boundary)}"/>
      </g>`;

  // THE DOTS ARE WHERE THE SHOPS ARE. THE LABELS ARE NOT, AND ONLY THE LABELS
  // MOVE. Just Games and Great Lakes Gaming are five miles apart east to west
  // and within 0.006 degrees of latitude, so at this scale their names sat on
  // the same line and overprinted each other. Nudging a DOT to fix that would
  // make the picture wrong, which is the one thing this figure cannot be, so
  // the label is what shifts and a leader is not needed at 16px of travel.
  //
  // Greedy, in reading order, and it terminates: each label takes the first free
  // slot at its own height or within four steps of it, up then down. Six points
  // is not a case that needs anything cleverer, and something cleverer would be
  // harder to check by eye than the map it is drawing.
  //
  // EVERY LABEL NOW SITS ON A PLATE OF ITS OWN AND THAT IS NOT DECORATION. Until
  // the roads went in, a name was cream type on one flat green and the contrast
  // was whatever `--ink` on `--paper-3` measures, everywhere, always. It now has
  // a motorway under it some of the time. The lightest thing the map paints is a
  // major road, cream at 42% over `--paper-3`, which blends to #859280; cream
  // type on that measures 2.39:1 and fails. The plate is `--page` at 88%, so the
  // worst ground a label can have is that road seen through it.
  //
  // MEASURED RATHER THAN ARGUED, on the real figure at 390x844 and 1440x900,
  // by hiding every glyph, every dot and the scale bar in the live DOM and
  // reading the brightest pixel left inside each label's own box: worst case
  // #2E4537 under Legacy Games at 390 and Just Games at 1440, and the pair is
  // 7.62:1 at both. It is the same fix, and the same class of bug, as the three
  // surface-token-where-ink-belongs rules CLAUDE.md lists in ui.css: a colour
  // that was only correct because of what happened to be behind it.
  //
  // TWO TRAPS IN TAKING THAT MEASUREMENT, both of which produced a confident
  // wrong number first. The plate has rx=5, so the four CORNERS show bare
  // ground and sampling the whole box reports the ground rather than the plate.
  // And the outermost row of the rect is ANTIALIASED against what is under it,
  // which read as 2.94:1 -- a failure that exists only in a pixel no glyph ever
  // touches. Inset past both before believing the figure.
  // TWO LABEL VARIANTS, AND THE SECOND ONE EXISTS BECAUSE THE FIRST ONE IS
  // UNREADABLE ON A PHONE. The whole viewBox is scaled to fit its box, so the
  // type scales with it: a shop name is 15 units here and 15 CSS px only when
  // the drawing is at 1:1. Measured on the built page, off getBoundingClientRect
  // and off the computed font-size times the real viewBox-to-viewport scale,
  // which agree: 8.20 CSS px at 390, and the scale bar 7.11, against an 11px
  // caption and 17px body copy sitting directly under them.
  //
  // getComputedStyle ON SVG TEXT REPORTS USER UNITS AND NOT CSS PIXELS. It reads
  // 15 at every width and always will, which is how a figure this small passed a
  // type check for a month.
  //
  // THE FLOOR IS 12 CSS PX and it is argued rather than picked. --t-micro is
  // 11px, the smallest type token this site has, and it is what this figure's own
  // caption is set in; nothing drawn ON the picture may be smaller than the prose
  // explaining it, so the floor is the next token up, --t-label at 12px.
  //
  // WHY NOT SIMPLY SCALE THE NAMES UP. At 390 this figure is 350 x 244 CSS px
  // and these are shop names rather than town names: "Great Lakes Gaming" at the
  // floor is 232 units wide out of 640, 36% of the frame, and there are six of
  // them. The greedy placer below answers that by pushing labels off their own
  // dots, which is a worse map than a small one.
  //
  // SO THE PHONE GETS NUMBERS AND THE NAMES GO INTO HTML AT REAL TYPE, exactly
  // what plateDiagram() on /garbage-plate.html does and what CLAUDE.md records
  // as "the words are HTML, not SVG text". SAME FIX, SAME BREAKPOINT AND THE
  // SAME NUMBERS AS showMap() IN build-shows.mjs, because these two maps are a
  // pair and a reader moves between them: if one of them changes, change both.
  // NUM_F is 28 against that file's 29 for the one reason the two ever differ,
  // which is that this viewBox is 640 units wide and that one is 660, so the two
  // render within a tenth of a pixel of each other at every width.
  //
  // NUMBERED WEST TO EAST, so the numbers ascend across the picture and a reader
  // who has found one dot knows roughly where the next one is without reading.
  const NAME_F = 16; // wide: the shop name. Was 15, which was 11.8px at 545.
  const NUM_F = 28; // narrow: the key number. 12.25px at 320, 15.3px at 390.

  const sorted = pts.slice().sort((a, b) => px(a.at[1]) - px(b.at[1]));
  const keyNo = new Map(sorted.map((s, i) => [s.name, i + 1]));

  // Greedy, in reading order, and it terminates: each label takes the first free
  // slot at its own height or within four steps of it, up then down.
  //
  // IT RUNS ONCE PER VARIANT, with its own list of placed boxes, because the two
  // variants are different widths and a shared list would let a name reserve a
  // slot against a number. COLLISIONS IN HERE ARE SCALE INVARIANT: two boxes in
  // user units either overlap or they do not, whatever the figure is drawn at,
  // so a variant that is clean is clean at every width it is shown at.
  //
  // The plate and the baseline are ratios of the font size, taken from the
  // numbers this figure shipped with at 15 units: 10/15, 20/15, 4/15. That is
  // what lets one renderer draw both variants without either of them getting a
  // hand-tuned box the collision test does not know about.
  //
  // IT RESERVED SPACE AGAINST LABELS AND NEVER AGAINST THE DOTS, WHICH ARE THE
  // ONE THING ON THIS FIGURE THAT CANNOT MOVE. The block above says so in as
  // many words -- "nudging a DOT to fix that would make the picture wrong" --
  // and then the search below only ever asked whether a slot was free of other
  // LABELS. So the Great Lakes Gaming plate took a slot whose top right corner
  // was sitting on the Just Games marker. Measured on the built page against the
  // r=7 dot: 11.0 x 2.7 CSS px of overlap at 545 and 14.4 x 3.5 at 768 and 1440;
  // against the r=11 halo, 17.4 x 5.8 and 22.7 x 7.6. 0 plate-on-plate and 0
  // label-on-label at any width, so the placer's own test was working and was
  // simply blind to half the drawing.
  //
  // /card-shows.html HAD ONE OF THESE AS WELL AND WAS REPORTED CLEAN, so its
  // placer gets the same guard rather than a comment saying it does not need
  // one. Its "Depew . 1" plate was lying over a halo by 17.2 x 0.5 CSS px at
  // 1440. It reads as zero if you only test the coloured circle, which is what
  // a first pass here did, and it is exactly the same bug as this one caught a
  // few pixels earlier. Both are 0 at 320, 390, 544, 545, 768 and 1440 now.
  //
  // THE RADIUS IS 11 AND THAT IS THE HALO, NOT THE DOT. The visible mark is r=7
  // with a 2-unit stroke, so its ink stops at 8; the halo is a ring of the map's
  // own ground painted under it at r=11 so the dot reads as a dot rather than as
  // a junction of the roads it lands on. A plate covering that ring undoes the
  // thing the ring is for, so the reservation is the halo's box and not the
  // dot's -- and reserving only the dot is what made the sister map read clean.
  // It costs a 2-unit margin and no more: a label starts at x +/- 13, so its OWN
  // halo is 2 units clear of it and every dot can go in one list.
  const DOT_R = 11;
  const dotPts = sorted.map((s) => ({ x: px(s.at[1]), y: py(s.at[0]) }));
  const place = (font, textOf, charW, padW) => {
    const lh = Math.round((font * 17) / 15);
    const placed = [];
    return sorted.map((s) => {
      const x = px(s.at[1]), y = py(s.at[0]);
      // Labels flip to the left of the dot in the right third, so nothing runs
      // off the edge of the viewBox on a narrow phone.
      const left = x > W * 0.62;
      const text = textOf(s);
      const w = text.length * charW + padW;
      const x1 = left ? x - 13 - w : x + 13;
      let ly = y;
      for (let step = 0; step < 9; step++) {
        // 0, -1, +1, -2, +2 ... so a label prefers to stay where its dot is.
        const off = step === 0 ? 0 : (step % 2 ? -1 : 1) * Math.ceil(step / 2) * lh;
        ly = y + off;
        // The plate's REAL top and bottom, not the lh proxy the label test uses:
        // mark() draws it at ly - font*0.667, font*1.333 high, and the dot test
        // has to reason about the box that is actually painted.
        const y0 = ly - font * 0.667, y1 = y0 + font * 1.333;
        const clash =
          placed.some((q) => Math.abs(q.y - ly) < lh && x1 < q.x + q.w && q.x < x1 + w) ||
          dotPts.some((d) => x1 < d.x + DOT_R && d.x - DOT_R < x1 + w && y0 < d.y + DOT_R && d.y - DOT_R < y1);
        if (!clash) break;
      }
      placed.push({ x: x1, y: ly, w });
      return { x, y, left, text, w, x1, ly, font };
    });
  };
  const wideMarks = place(NAME_F, (s) => s.name, (8.4 * NAME_F) / 15, NAME_F);
  const numMarks = place(NUM_F, (s) => String(keyNo.get(s.name)), NUM_F * 0.62, NUM_F * 0.7);

  // The plate is the box the collision test above already reasons about, so the
  // two cannot disagree about how wide a name is: same x1, same w. A number is
  // centred in its plate; a name hangs off the dot the way it always has. The
  // hidden variant is display:none, so it has no box and cannot collide with the
  // visible one, which is what keeps the collision count honest.
  const mark = (m, cls, mid) => `<g class="${cls}">
        <rect class="sm-plate" x="${m.x1.toFixed(1)}" y="${(m.ly - m.font * 0.667).toFixed(1)}"
          width="${m.w.toFixed(1)}" height="${(m.font * 1.333).toFixed(1)}" rx="5"/>
        <text x="${(mid ? m.x1 + m.w / 2 : m.left ? m.x - 13 : m.x + 13).toFixed(1)}"
          y="${(m.ly + m.font * 0.267).toFixed(1)}" text-anchor="${mid ? "middle" : m.left ? "end" : "start"}"
          font-size="${m.font}" font-weight="700" fill="currentColor" font-family="var(--body)">${esc(m.text)}</text>
      </g>`;

  // Marks are drawn in a second pass, after every dot, or a plate could cover
  // the dot of the shop whose label it is not.
  const marks = sorted.map((s, i) => mark(wideMarks[i], "mk-w", false) + mark(numMarks[i], "mk-n", true));
  const dots = sorted
    .map((s, i) => {
      const { x, y } = wideMarks[i];
      // The dot keeps a ring of the map's own ground under its outline, so it
      // reads as a dot on a map rather than as a junction of the roads it lands
      // on. Millennium Games sits on the Jefferson Road interchange and was the
      // point that showed this was needed.
      return `<circle class="sm-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11"/>` +
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="var(--gold)" stroke="currentColor" stroke-width="2"/>`;
    })
    .join("");

  // The scale bar gets a plate for the same reason the names do: it used to sit
  // on flat green and it now sits on whatever runs along the bottom of the
  // frame, which round here is the Erie Canal and the Thruway. It gets the same
  // two variants, and it was the worst off of anything on this page at 390:
  // 7.11 CSS px, the smallest type on the whole document. The plate is derived
  // from the font rather than hand-set, so the box cannot fall out of step with
  // the words in it.
  //
  // THE NARROW ONE PUTS THE WORDS BESIDE THE BAR RATHER THAN OVER IT, and that
  // is height rather than taste: stacked, a 28 unit label plus the bar and its
  // ticks is a 55 unit plate and it was the loudest object in the picture when
  // it was screenshotted. Beside the bar it is 30, which is the bar's own
  // height, and it is the form every printed map uses. It also abbreviates to
  // "mi", which is what a scale bar says everywhere else in the world. Same
  // change, same day, on /card-shows.html.
  const barW = nice * k;
  const barLabel = `${nice} mile${nice === 1 ? "" : "s"}`;
  const bar = (font, cls, beside) => {
    const label = beside ? `${nice} mi` : barLabel;
    const tw = label.length * font * 0.62;
    const ticks =
      `<line x1="0" y1="0" x2="${barW.toFixed(1)}" y2="0" stroke="currentColor" stroke-width="2.5"/>` +
      `<line x1="0" y1="-5" x2="0" y2="5" stroke="currentColor" stroke-width="2.5"/>` +
      `<line x1="${barW.toFixed(1)}" y1="-5" x2="${barW.toFixed(1)}" y2="5" stroke="currentColor" stroke-width="2.5"/>`;
    const type = (x, y, anchor) =>
      `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-size="${font}"` +
      ` font-weight="700" fill="currentColor" font-family="var(--mono)">${label}</text>`;
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
          <rect class="sm-plate" x="-10" y="${top.toFixed(1)}" width="${(barW + tw + 32).toFixed(1)}"
            height="${(bot - top).toFixed(1)}" rx="5"/>
          ${ticks}
          ${type(barW + 12, font * 0.34, "start")}
        </g>`;
    }
    const base = -(font * 0.75) - 2;
    const top = base - font * 0.82;
    return `<g class="${cls}">
          <rect class="sm-plate" x="-10" y="${top.toFixed(1)}"
            width="${(Math.max(barW, tw) + 20).toFixed(1)}" height="${(9 - top).toFixed(1)}" rx="5"/>
          ${ticks}
          ${type(barW / 2, base, "middle")}
        </g>`;
  };
  return `<figure class="shop-map">
      <svg viewBox="0 0 ${W} ${H}" role="img"
        aria-label="A map of ${
          pts.length
        } card shops around Rochester, New York. Roads, water and the city boundary are drawn from OpenStreetMap data, with each shop marked and named. On a narrow screen the marks are numbered instead and the numbers are listed under the map. Their addresses are on each card below.">
        <defs><clipPath id="shopmap-clip"><rect x="0" y="0" width="${W}" height="${H}" rx="10"/></clipPath></defs>
        <rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="var(--paper-3)"/>
        ${base}
        ${dots}
        ${marks.join("")}
        <g transform="translate(${PAD} ${H - 20})">
          ${bar(NAME_F, "mk-w", false)}
          ${bar(NUM_F, "mk-n", true)}
        </g>
      </svg>
      ${/* THE KEY. Only on the narrow layout, where the drawing carries numbers
            instead of names; above 544 it is display:none and is out of the
            accessibility tree along with the numbers it explains. Every name in
            it is also an h2 on a card further down the page, so this is a second
            view of the list rather than a new claim, exactly like the map. */ ""}
      <p class="map-key-h">The shops on the map, west to east</p>
      <ol class="map-key">
        ${sorted.map((s, i) => `<li><b>${i + 1}</b><span>${esc(s.name)}</span></li>`).join("\n        ")}
      </ol>
      ${/* THE TWO LINKS IN HERE ARE THE ODbL AND ARE NOT DISCRETIONARY, which is
            the same argument the Garbage Plate photo credits make and CLAUDE.md
            records in full. OpenStreetMap's data is offered on condition that it
            is credited and that the licence is reachable; a page that draws the
            roads and does not link the deed is not making a tidier editorial
            choice, it is using the data outside the terms it was offered under.
            They sit in the figure's own credit line, at the end, labelled as
            leaving the site, exactly like every other outbound link here. */ ""}
      <figcaption>Where the shops are, and where they are relative to each other. North is up, the scale is
        true in both directions, and each dot is that shop's own street address rather than a pin dropped
        near it. The roads, the water and the dashed City of Rochester line are real geometry, drawn from
        OpenStreetMap's data rather than from anybody's map tiles, so nothing on this page asks another
        server for anything. It is here to answer how far apart these are; the addresses on the cards below
        are the exact thing to put in a map app. Map data from
        <a href="https://www.openstreetmap.org/copyright" rel="noopener" target="_blank"
          aria-label="OpenStreetMap contributors, the source of the map data, opens on openstreetmap.org">OpenStreetMap contributors</a>,
        licensed <a href="https://opendatacommons.org/licenses/odbl/1-0/" rel="noopener" target="_blank"
          aria-label="The Open Database License version 1.0, which this map data is offered under, opens on opendatacommons.org">ODbL 1.0</a>,
        read ${esc(longDate(mapDoc.read) || mapDoc.read)}.</figcaption>
    </figure>`;
}

// THE HOURS CHART WAS HERE AND IT IS GONE, 20 August 2026, ON TIM'S CALL:
// "Remove the time chart below that map image doesn't need it, as each listing
// for a store lists out its hours of operations and days they are open."
//
// It was a seven column Mon-to-Sun grid, one row per shop, drawn from the same
// `hours` string each card prints verbatim. The argument for it was real and is
// worth keeping in view rather than deleting silently: it answered "who is open
// right now" by looking, which six sentences scattered down 6,000px of page
// cannot. The argument against it is the one that won, and it is simply that it
// said a second time, in a second shape, something every card already says in
// full a screen further down, and it charged 170 lines of parser and 3.5KB of
// page for the repetition.
//
// WHAT WENT WITH IT, so nobody hunts for a caller: DAYS, DAY_IX, parseClock and
// parseHours existed only to feed this chart, and nothing else on this site
// imports from this file. The `hours` FIELD in data/shops.json stays exactly as
// it is and is still printed on every card; the chart was a second reader of it,
// never a second source, so nothing about the data changes.
//
// ONE THING THE PARSER WAS DOING THAT NOW NOBODY DOES: it threw on an hours
// string it could not read in full, which meant a typo in data/shops.json
// failed the build instead of rendering something plausible. That check is gone
// with it. The string is now printed and not parsed, so a typo shows up as a
// typo on the card, which a person reading the page can see.

// The bare host, for the "opens on <host>" half of an outbound aria-label.
// Falls back to the empty string rather than throwing: a malformed url in the
// data should cost a label, not the build. Same helper, same reasoning, as the
// one at the top of build-shows.mjs.
function hostOf(u) {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// ALL THIRTEEN OUTBOUND LINKS ON THIS PAGE WERE UNLABELLED, which CLAUDE.md
// makes the condition of every outbound link on the site, and this page was the
// worst case of it in the guides: 13 of 13, where the site as a whole had 783 of
// 877 labelled. Six of the thirteen are the ADDRESS, which is the primary action
// here -- the page says in as many words that the address is "the exact thing to
// put in a map app" -- so the least labelled control was the one the page is for.
// The other seven are the shop's own site and, on one row, its league page.
//
// The visible text could not survive being read alone either. Six links read as
// a bare street address with no shop attached, and "Official league page" named
// no shop at all. The shop name is in the h2 above and was in no link name, so a
// screen reader's link list was six addresses and seven domains in no order.
const cards = shops
  .map((s) => {
    const url = cleanUrl(s.url);
    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return url;
      }
    })();
    return `      <li class="shop">
        <div class="shop-head">
          <h2>${esc(s.name)}</h2>
          ${s.visited ? `<span class="shop-flag">Filmed here</span>` : ""}
        </div>
        ${s.area ? `<p class="shop-area">${esc(s.area)}</p>` : ""}
        ${s.blurb ? `<p class="shop-blurb">${esc(s.blurb)}</p>` : ""}
        ${
          (s.goodFor || []).length
            ? `<ul class="shop-tags">${s.goodFor
                .map((t) => `<li>${esc(t)}</li>`)
                .join("")}</ul>`
            : ""
        }
        ${s.address || s.phone || s.hours ? `<dl class="shop-facts">
          ${s.address ? `<dt>Where</dt><dd><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}" rel="noopener" target="_blank" aria-label="${esc(s.address)}, where ${esc(s.name)} is, opens on google.com">${esc(s.address)}</a></dd>` : ""}
          ${s.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(s.phone.replace(/[^0-9+]/g, ""))}">${esc(s.phone)}</a></dd>` : ""}
          ${s.hours ? `<dt>Open</dt><dd>${esc(s.hours)}</dd>` : ""}
        </dl>` : ""}
        ${(s.plays || []).length ? `<div class="shop-play">
          <p class="shop-play-h">You can play here</p>
          <ul>${s.plays.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
          ${s.playNote ? `<p class="shop-play-note">${esc(s.playNote)}</p>` : ""}
          ${s.playWarn ? `<p class="shop-play-warn">${esc(s.playWarn)}</p>` : ""}
        </div>` : ""}
        <p class="shop-links">
          <a class="shop-link" href="${esc(url)}" rel="noopener" target="_blank" aria-label="${esc(host)}, ${esc(s.name)}'s own site, opens on their site">
            ${esc(host)} <span aria-hidden="true">&rarr;</span>
          </a>
          ${s.leagueUrl ? `<a class="shop-link" href="${esc(s.leagueUrl)}" rel="noopener" target="_blank" aria-label="Official league page for ${esc(s.name)}, the Play! Pokemon listing, opens on ${esc(hostOf(s.leagueUrl))}">Official league page <span aria-hidden="true">&rarr;</span></a>` : ""}
        </p>
      </li>`;
  })
  .join("\n");

const schema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Pokemon card shops in Rochester, NY",
  description:
    "Local card shops around Rochester, New York that Garbage Rips 585 buys from.",
  itemListElement: shops.map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: s.name,
    url: cleanUrl(s.url),
  })),
};

// COMMENTS OUT OF THE SHIPPED PAGE, ARGUMENT KEPT IN THIS FILE. Same regex and
// the same trade as build-css.mjs makes for ui.css and miniCSS makes in seven
// other builders including build-pack-prices.mjs, which argues it in full: this
// block is inline in a render blocking <head>, so every line of reasoning in it
// is paid for by every reader on shop wifi.
//
// THIS PAGE NEVER ADOPTED IT AND IT SHOWED. Measured on the built file before
// this line went in: 6249 bytes of inline <style>, 1875 of them comment, which is
// 30%. The comments stay exactly where they are; they simply stop being served.
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const style = `
.shops{padding:var(--s7) 0 var(--s8)}
.shops-lede{color:var(--ink-2);max-width:46em;margin-bottom:var(--s5)}
.shop-list{list-style:none;display:grid;align-items:start;grid-template-columns:repeat(3,1fr);gap:var(--s4)}
@media(max-width:980px){.shop-list{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.shop-list{grid-template-columns:1fr}}
/* align-items:start on the list above, so a card is as tall as its own content.
   Stretched to a common height, a shop with less to say grew a hole in the
   middle: LingSter Games had 280px of blank white between its facts and its
   website link, Millennium 147px, because something below them is pushed to the
   bottom of whatever height the tallest card sets. One full card beside two
   that look broken is worse than three cards of honest, different heights. */
.shop{display:flex;flex-direction:column;gap:var(--s2);background:var(--card);
  border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);
  box-shadow:var(--lift)}
.shop-head{display:flex;align-items:center;gap:var(--s2);flex-wrap:wrap}
.shop h2{font:400 var(--t-m)/1.15 var(--display)}
.shop-flag{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  background:var(--mustard);color:var(--on-accent);border:1px solid var(--gold-deep);
  padding:4px 7px;border-radius:var(--r-pill)}
.shop-area{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.05em;
  text-transform:uppercase}
.shop-blurb{color:var(--ink-2);font-size:var(--t-sm)}
.shop-tags{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--s1)}
.shop-tags li{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.03em;
  background:var(--lilac-pale);color:var(--plum);padding:5px 9px;border-radius:var(--r-pill)}
/* The auto margin moved off .shop-link and onto the wrapper. Left on the link
   itself it stopped pushing anything anywhere once the links were wrapped in a
   <p>, and the cards lost their aligned bottom row. */
/* EVERY LINK ON THIS PAGE IS TEAL NOW, AND THE RULE WON RATHER THAN THE
   EXCEPTION. CLAUDE.md's accent rule is one sentence: teal is how you get
   around, pink is what the site is saying. These three rules painted 21 of this
   page's 25 links --ketchup-deep -- every shop address, every phone number,
   every shop's own site, and both halves of the ODbL credit -- so the mark that
   means "this goes nowhere" was on the things that go somewhere. /card-shows
   .html did the same to 2 of its 58 and left the other 49 teal IN THE SAME
   DOCUMENT, which is what settles it: there is no exception being argued here,
   there is one page disagreeing with itself and another agreeing with it 4% of
   the time. Neither file carried a word of reasoning for the pink; all four
   rules were a literal color:var(--ketchup-deep) and nothing else.

   AND IT COSTS NO CONTRAST, which was the one thing that could have made the
   pink worth defending. Read off the built pages against the ground actually
   painted under each: on --card, where every shop card's links sit, the small
   pink is 4.51:1 and the small teal --sky-deep is 4.50:1; on --page, where
   the caption credit sits, 6.25 against 6.24. The two accents are a hundredth
   of a ratio apart at these sizes, so this is a semantic fix with no legibility
   trade in either direction. The 0.01 loss is the site's documented worst pair
   (CLAUDE.md: "the small teal at 4.50:1, deliberate") and not a new low.

   --sky-deep AND NOT --mustard, which is the same teal one step darker
   (#70B5D9) and measures 4.05:1 on the card. Small type takes the light one. */
.shop-links{margin-top:auto;padding-top:var(--s3);display:flex;flex-wrap:wrap;gap:var(--s4)}
.shop-link{font:700 var(--t-sm)/1 var(--body);
  color:var(--sky-deep);min-height:44px;display:inline-flex;align-items:center}
.shop-link:hover{text-decoration:underline}

/* Address, phone and hours. A definition list because that is what it is, and
   it gives the labels somewhere to live without inventing a class each. */
.shop-facts{display:grid;grid-template-columns:auto 1fr;gap:2px var(--s3);margin-top:var(--s2);
  font-size:var(--t-sm)}
.shop-facts dt{font:700 var(--t-micro)/1.6 var(--mono);letter-spacing:.05em;
  text-transform:uppercase;color:var(--ink-2)}
.shop-facts dd{line-height:1.5}
.shop-facts a{color:var(--sky-deep);font-weight:600}
.shop-facts a:hover{text-decoration:underline}

/* What you can actually turn up and play. */
.shop-play{margin-top:var(--s3);padding:var(--s3);background:var(--paper-3);border-radius:var(--r-sm)}
.shop-play-h{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--plum);margin-bottom:6px}
.shop-play ul{list-style:none;display:grid;gap:4px}
.shop-play li{font-size:var(--t-sm);padding-left:14px;position:relative}
.shop-play li::before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;
  border-radius:50%;background:var(--gold-deep)}
.shop-play-note{font-size:var(--t-micro);color:var(--ink-2);margin-top:8px;line-height:1.5}
/* Where the shop's own league page and a secondhand listing disagree. Loud,
   because the cost of being wrong is a wasted drive. */
.shop-play-warn{font:700 var(--t-micro)/1.6 var(--mono);color:var(--plum);
  background:var(--lilac-pale);border-radius:var(--r-sm);padding:8px 10px;margin-top:8px}
/* The map. Capped so it does not become a poster on a desktop, and the SVG
   scales with the box because it has a viewBox and no width attribute.
   currentColor throughout, so it is correct on the light page and would still
   be correct if this block ever moved onto the dark chrome.

   THE FIGURE USED TO BE THE FULL WIDTH OF THE WRAP AND THE MAP 660 OF IT, so at
   1440 it declared 1392px and left 732 of them bare, 52.6% of the viewport. It
   painted nothing in that space, so this was a box-model fault rather than a
   visible one, but a figure claiming width it never uses is the kind of thing
   that gets "fixed" later by stretching the map into it.

   GROWING THE MAP INSTEAD WAS THE OTHER OPTION AND IT WAS REJECTED, because it
   fights the type fix rather than complementing it. At 1392 the drawing is at
   2.18 units to the pixel, so a 16 unit shop name renders at 34.9px, which
   would have to come back down in units, which is the opposite of what a phone
   needs. Every stroke width and dash length in the block below is also argued
   in units per mile at a stated rendered scale ("5 on 4 at 640 units is 3px on
   and 2.4px off at 390"), and all of it would have to be re-derived. So the
   figure shrinks to the map. Same call, same reasons, on /card-shows.html.

   RENDERED TYPE, before -> after, measured off getBoundingClientRect and off
   the computed font-size times the real viewBox-to-viewport scale, which agree:

        320   unit 0.438   name 6.56 -> 12.25px (a number)   bar 5.69 -> 12.25
        390   unit 0.547   name 8.20 -> 15.32px (a number)   bar 7.11 -> 15.32
        768   unit 1.031   name 15.47 -> 16.50px             bar 13.41 -> 16.50
       1440   unit 1.031   name 15.47 -> 16.50px             bar 13.41 -> 16.50 */
.shop-map{margin:0 0 var(--s5);color:var(--ink);max-width:660px}
.shop-map svg{display:block;width:100%;height:auto;max-width:660px}
/* The two label variants, and the key that carries the names on a phone. Same
   rules, same breakpoint and the same reasoning as .mk-w / .map-key in
   build-shows.mjs; the two maps are a pair. display:none rather than an opacity
   or a visibility, so the hidden variant has no box at all and cannot collide
   with the visible one or hang off the edge of the frame. */
.mk-n{display:none}
@media(max-width:544px){
.mk-w{display:none}
.mk-n{display:inline}
}
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
@media(max-width:544px){
.map-key-h{display:block}
.map-key{display:grid}
}
.shop-map figcaption{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);
  margin-top:var(--s2);max-width:52em}
/* The ODbL credit's two links, teal for the reason argued above .shop-link.
   These are the pair /card-shows.html also painted pink, and that page's other
   49 links were already teal, so the two figures agree with each other now as
   well as with the rest of the site. If one of these two rules changes, change
   both: the maps are a pair and so are their captions. */
.shop-map figcaption a{color:var(--sky-deep);font-weight:600}
.shop-map figcaption a:hover{text-decoration:underline}
/* THE MAP'S OWN INK, AND EVERY VALUE IS DERIVED FROM A TOKEN BY A STATED MOVE,
   which is the rule the palette section of CLAUDE.md sets and the reason the
   derivation is written beside the number rather than in a commit message.
   Three of them are literal hexes because they are BLENDS of two tokens and CSS
   cannot state that in a custom property without color-mix, which this
   stylesheet does not use anywhere yet.

   THE GROUND IS --paper-3 (#405D49), unchanged, and everything else is judged
   against it. Roads are the page ink at an opacity, so they are the one thing
   here that is not a new colour at all: a road is a lighter scratch on the land
   and nothing more. Water is the only hue on the map, because water being blue
   is the one map convention a reader has without being told, and it is derived
   from --mustard (#70B5D9) pulled most of the way to --navy-deep (#13231B):
   35/65 gives #34565E, which is DARKER than the land as well as bluer. That
   direction matters. Water lighter than land reads as a road, and the first
   pass of this map had exactly that problem with the Genesee.

   NOTHING HERE COMPETES WITH THE DOTS, WHICH IS THE WHOLE BRIEF. The dot is
   --gold (#609CBB) inside a 2px cream ring, and it is the lightest, most
   saturated and only ringed thing in the frame. The brightest the map itself
   gets is a major road at 42% cream, which is a flat #859280. */
.sm-water{fill:#34565E;stroke:none}
.sm-stream{stroke:#467384;stroke-width:1.6;fill:none}
.sm-road{stroke:currentColor;stroke-width:1.1;opacity:.2}
.sm-road-major{stroke:currentColor;stroke-width:2.4;opacity:.42}
/* The city line is an idea and not a thing, so it is dashed and it is the pink,
   which on this site is the mark that goes nowhere. It is the one place the map
   uses an accent, and it uses it because a dashed cream line at low opacity is
   indistinguishable from a minor road at this size, which defeats the point of
   drawing it. 5 on 4 at 640 units is 3px on and 2.4px off at 390.

   IT WENT IN AT 1.6 AND .62 AND CAME STRAIGHT BACK OUT AT 1.4 AND .46. Look at
   the drawing rather than the value: Rochester's line is a genuinely jagged
   thing, full of annexation notches, and at full strength it was the busiest
   object in the frame, which is exactly backwards for the piece of information
   here that matters least. It is context, so it whispers. */
.sm-edge{stroke:var(--ketchup);stroke-width:1.4;stroke-dasharray:5 4;opacity:.46;fill:none}
/* The plate under each shop name, and under the scale bar. --page at 88%, so a
   label is legible over a motorway; see the note beside the placement code. */
.sm-plate{fill:var(--page);opacity:.88}
/* A disc of the map's own ground behind each dot, so the dot reads as a dot on
   a map and not as a junction of whatever roads it happens to land on.
   Millennium Games sits on the Jefferson Road interchange and is the point that
   made this necessary. */
.sm-halo{fill:var(--paper-3);opacity:.8}
.shops-note{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin-top:var(--s6);max-width:52em}
/* The section ornament, from shared/format.mjs, same as /buying.html and
   /selling.html. Not in ui.css: render blocking on 1,483 pages, drawn on five. */
${PLATE_CSS}
`;

const body = `
<main id="main" class="shops">
  <div class="wrap">
    <div class="brk"><h1>Card shops and <span class="hl">where to play</span></h1><span class="ln"></span></div>
    <p class="shops-lede">Where I actually buy, and where you can sit down and play. Real shops around
      Rochester, New York, run by people who know the hobby. Around here the counter you buy from and the
      table you play at are usually the same building, so both are on one page. Buy local when you can:
      the shop is why the local scene exists.</p>
${shopMap(shops)}
    <ul class="shop-list">
${cards}
    </ul>
${/* THE ONE ORNAMENT ON THIS PAGE, AND THIS IS THE PAGE THE PLATE WAS DRAWN
      FOR. Measured on the built page at 390x844: 7,271px tall, ZERO img tags,
      and the only two pictures on it were the shop map and the hours chart,
      both generated SVG, both in the first 894px. The hours chart is gone now
      and the map is the only picture above the fold, so the page is SHORTER and
      even less illustrated than that measurement says. Everything below the
      list is six shop entries and a sign off with nothing to look at. It is the
      least illustrated Rochester page on the site.

      HERE RATHER THAN AT THE TOP because the sentence under it is the page
      speaking in its own voice: the list of shops ends, and then "NOT SPONSORED
      AND NOT AFFILIATE LINKS. THESE ARE SHOPS I GO TO." A Rochester dish is the
      mark for a Rochester page saying that, and it is the same turn
      /buying.html and /selling.html both make when they end on a local counter.

      NOT UNDER THE h1, which was the obvious spot and is the wrong one: the map
      is 366px down and an ornament above it would put two marks in the first
      screen of the page and none in the 6,377px underneath. */ ""}${plateRule()}
    ${shopsDoc.playNote ? `<p class="shops-lede" style="margin-top:var(--s5)">${esc(shopsDoc.playNote)}</p>` : ""}
    <p class="shops-lede">Looking for a one off rather than a weekly night? The
      <a href="/card-shows.html">card show calendar</a> has every show coming up around Rochester, Buffalo
      and Syracuse.</p>
    ${/* THE LOCAL CLUSTER WAS THREE PAGES AND ONE EDGE. /vendors.html and
          /creators.html had ZERO in-body inbound links from anywhere on the
          site on 18 August 2026, reachable only from the hamburger, and this is
          the page whose reader is looking for exactly what they hold. The three
          are the same subject cut three ways, which is the case for linking
          them and also the reason a reader who finds one wants the others. */ ""}${/* "shopfront" IS BRITISH AND THIS PAGE GETS IT RIGHT 40 LINES LOWER, in
         "They run a separate singles storefront alongside the main site". Same
         word on /card-shows.html. */ ""}
    ${/* THE ORNAMENT ABOVE THIS IS A GARBAGE PLATE AND UNTIL 20 AUGUST 2026 IT
          POINTED NOWHERE. There is a whole page about the dish now, this page is
          the one whose reader is already out driving around Rochester, and the
          mark itself is the natural handle for the link. */ ""}
    <p class="shops-lede">Making a day of it? A plate is the other thing this city is known for,
      and <a href="/garbage-plate.html">the Garbage Plate page</a> has the sourced history, a
      diagram of what is actually on one, and eleven places around here that serve one.</p>
    <p class="shops-lede">Not everyone selling cards around here has a storefront.
      <a href="/vendors.html">Local vendors</a> are the breakers and sellers we buy from without one, and
      <a href="/creators.html">local creators</a> is who else is filming Pokemon in Rochester, Buffalo and
      Syracuse.</p>
    <p class="shops-lede">Addresses, phone numbers and opening hours were last checked on
      ${esc(longDate(shopsDoc.updated) || "an unrecorded date")}. Shops move and change their hours, so call ahead if you are
      making a trip of it.</p>
    <p class="shops-note">NOT SPONSORED AND NOT AFFILIATE LINKS. THESE ARE SHOPS I GO TO.
      IF YOU RUN A CARD SHOP AROUND ROCHESTER AND YOU ARE NOT ON HERE, SAY HELLO ON ANY OF THE SOCIALS.</p>
  </div>
</main>`;

// Share the home page's shell so this page cannot drift from the design.
const home = await readFile(join(ROOT, "public/index.html"), "utf8");
const head = home.slice(home.indexOf("<head>") + 6, home.indexOf("</head>"));
// Stop at </header>. Slicing to the rail also swallowed the menu that sits
// between them, and these pages then append their own copy, so every one
// shipped two <nav id="menu"> blocks: invalid HTML and a duplicated landmark.
const bar = home.slice(home.indexOf('<header class="bar">'), home.indexOf('</header>') + '</header>'.length);
const sprite = /<svg[^>]*(?:hidden|display:none)[^>]*>[\s\S]*?<\/svg>/.exec(home)?.[0] || "";
// The bar carries the menu button; the panel it controls lives after </header>,
// so it has to be copied across too or the button opens nothing.
const menuPanel = /<nav class="menu"[\s\S]*?<\/nav>/.exec(home)?.[0] || "";
const skipLink = '<a class="skip" href="#main">Skip to content</a>';
const footer = home.slice(home.lastIndexOf("<footer"), home.indexOf("</footer>") + 9);

const swapped = head
  .replace(
    /<title>[\s\S]*?<\/title>/,
    // Both halves of what the page now answers. "Where to play pokemon rochester
    // ny" is its own search with its own intent, and the old title only claimed
    // the buying half.
    `<title>Pokemon Card Shops in Rochester NY &amp; Where to Play</title>`
  )
  .replace(
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="${
      shops.length
    } local Pokemon card shops around Rochester, New York, and where to play: league nights, prereleases and organized play, with addresses and hours.">`
  )
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/shops.html">`)
  .replace(/(<meta property="og:image" content="[^"]*\/assets\/)og-image\.jpg/, `$1og-shops.jpg`)
  .replace(/(<meta name="twitter:image" content="[^"]*\/assets\/)og-image\.jpg/, `$1og-shops.jpg`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}/shops.html`)
  .replace(
    /(<meta property="og:title" content=")[^"]*/,
    `$1Pokemon Card Shops in Rochester, NY`
  );

const html = `<!DOCTYPE html>
<html lang="en">
<head>${swapped}<style>${miniCSS(style)}</style>
<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>
</head>
<body>
${skipLink}
${sprite}

${bar}
${menuPanel}
${body}
${footer}

${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/shops.html"), dropUnusedPacksCSS(html));

const cleaned = shops.filter((s) => cleanUrl(s.url) !== s.url);
console.log(`Wrote public/shops.html  (${shops.length} shop${shops.length === 1 ? "" : "s"})`);
for (const s of cleaned) {
  console.log(`  cleaned tracking parameters off ${s.name}:\n    ${cleanUrl(s.url)}`);
}
