#!/usr/bin/env node
// The pictures on /topps.html: one card per Topps release, the sealed packaging
// where PriceCharting holds a photograph of it, the hero card and the two cards
// in the side-by-side comparison.
//
//   node scripts/sync-topps-images.mjs            resolve, verify, write
//   node scripts/sync-topps-images.mjs --report   resolve and verify, write nothing
//
// Writes data/topps-images.json, which scripts/build-topps.mjs reads. NOT in
// build-all.mjs, the same arrangement verify-topps-top.mjs and sync-decks.mjs
// have and for the same reason: it makes requests against somebody else's
// server, and a build that runs on a schedule must not depend on a step that
// does not.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS AT ALL: /topps.html SHIPPED WITH ZERO PICTURES
// ---------------------------------------------------------------------------
//
// The whole pitch of that page is that most collectors have never knowingly
// held one of these cards. A guide to cards nobody recognises, with no picture
// of one, cannot do its job, and no amount of prose about "anime stills on card
// stock" substitutes for showing a reader the thing. Tim, 18 August 2026: this
// page should be "loaded with image examples of everything", and site-wide, "i
// want no missing product images".
//
// The companion page /topps-card-values.html already carried 200 card scans off
// the same data, which is what made the gap invisible: the pictures existed in
// the tree and one of the two pages was not asking for them.
//
// ---------------------------------------------------------------------------
// EVERY PICTURE IS PINNED BY PRODUCT ID AND CHECKED BY NAME
// ---------------------------------------------------------------------------
//
// The same discipline VERDICTS in sync-topps-top.mjs and PRODUCT_PHOTOS in
// shared/product-photos.mjs are written with, and it matters more here than in
// either. These are 1999 anime stills filed under four Chrome finishes of the
// same collector number, so "the Charizard from the 1999 set" is four rows and
// a name lookup would pick whichever one the parser saw last.
//
// So each pin names PriceCharting's own product id AND the name we expect to
// find on it. If the name has drifted the id now points at something else, the
// pin is REFUSED rather than followed, and the picture is simply not published.
// A wrong picture is far worse than a missing one here: a reader who cannot see
// a card learns nothing, and a reader shown the wrong card learns something
// false and has no way to find out.
//
// ---------------------------------------------------------------------------
// TWO SOURCES, AND ONLY ONE OF THEM IS THE CRAWL WE ALREADY HAD
// ---------------------------------------------------------------------------
//
// THE CARDS COST NO REQUESTS. Every card pin is resolved out of
// .cache/pricecharting-console/, which scripts/sync-graded-top.mjs already
// filled and which sync-topps-top.mjs reads the same way. The listing row
// carries its scan url beside its prices, which is where /topps-card-values
// .html's 200 scans come from, so there was nothing to fetch.
//
// THE PACKAGING DID NEED A REQUEST, and this is the interesting half. That
// crawl runs with `exclude-hardware=true`, which is why CLAUDE.md says the
// PriceCharting corpus "holds essentially no sealed product" and why
// /most-expensive-sealed.html is priced off TCGplayer instead. Drop that one
// parameter and the same console pages carry the booster packs and boxes with
// their photographs: 1999 Topps TV alone holds "Booster Pack Series 1 Blue
// Logo", a "Booster Box" and "Booster Pack [Series 2]". Nothing else in this
// repo has a photograph of a Topps pack wrapper; TCGplayer does not carry these
// products, shared/product-photos.mjs is per modern expansion, and Bulbapedia
// was read for text only.
//
// Those pages are cached under .cache/pricecharting-topps-sealed/ so a re-run
// costs nothing, and the crawl is nine console paths at one request a second.
//
// **NOT ONE PRICE COMES OFF THOSE PAGES AND NONE MAY.** Only the product name
// and the photograph are read. Every figure this site publishes out of
// PriceCharting is read twice, from two different templates, and gated by
// shared/graded-gate.mjs; these rows have been read once, so they are not
// publishable as money and the page prints none. If a later editor wants a
// sealed Topps price, that is a verifier and a gate, not a field added here.
//
// ---------------------------------------------------------------------------
// EVERY URL IS VERIFIED BEFORE IT SHIPS, AND 404 IS NOT THE TEST
// ---------------------------------------------------------------------------
//
// A card PriceCharting has no scan for answers **403** on its CDN rather than
// 404, so "not a 404" is not evidence of anything. Every url below is fetched
// and only a 200 carrying a non-empty image body sets `ok`. build-topps.mjs
// emits no <img> at all for a pin that is not `ok`, rather than an <img> with an
// onerror: an image that is known to be dead should never cost a reader a round
// trip to discover it, which is the same call data/no-scan.json exists to make.
//
// The rendition is /240.jpg, the one /topps-card-values.html's rows already use.
// The listing gives /60.jpg, which is a 60px-wide thumbnail and is soft in a
// 64px box on a retina phone before you even reach the 112px boxes here.
//
// NO WIDTH OR HEIGHT IS RECORDED AND NONE MAY BE DECLARED ON THE PAGE. This host
// serves a fixed 240 HIGH and a VARIABLE width, exactly as CLAUDE.md records for
// tcgplayer-cdn, so a declared width is wrong for most of these files. The boxes
// are pinned in CSS instead, which is what keeps CLS at 0.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONSOLE_HEADERS, parsePage, text, unent } from "../shared/pricecharting.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONSOLE_CACHE = join(ROOT, ".cache/pricecharting-console");
const SEALED_CACHE = join(ROOT, ".cache/pricecharting-topps-sealed");
const OUT = join(ROOT, "data/topps-images.json");
const REPORT = process.argv.includes("--report");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// encodeURI leaves "&" alone, so "/console/pokemon-black-&-white" parses as a
// truncated path with a stray query parameter. Same helper, same reason, as
// sync-graded-top.mjs.
const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");

// ---------------------------------------------------------------------------
// THE PINS.
//
// `card` is what that release's cards look like. `pack` is its sealed
// packaging, or null where PriceCharting's catalogue holds none.
//
// HOW EACH CARD WAS CHOSEN, because "representative" is a judgement and it
// should be a readable one:
//   - a PLAIN printing, never a bracketed parallel, so the picture is the card
//     the set is made of rather than its chase version
//   - a Pokemon or a scene a reader is likely to recognise, because the point of
//     the picture is recognition
//   - from the bucket that holds that release's own base cards, and where two
//     releases share a bucket, from that release's OWN number range. Chrome
//     Series 1 is numbers 1 to 78 and Series 2 is 79 to 151; series 1 of the TV
//     cards is 1 to 76, series 2 picks up at 77 and series 3 covers 118 to 151,
//     which is the range data/topps-sets.json cites Bulbapedia for. A picture
//     from the wrong half of a merged bucket is exactly the error the whole
//     mapping check in build-topps.mjs exists to catch.
//
// THE PACK PINS ARE NAMED BY PRICECHARTING, NOT BY US. "Booster Pack Series 1
// Blue Logo" is their product name and the caption on the page prints it as
// theirs. The blue logo is not decoration either: data/topps-sets.json records
// that the Topps logo colour dates a series 1 printing, so that wrapper is the
// first printing and the page can say so from a source it already has.
const PINS = [
  {
    release: "series-1",
    card: { id: "3560956", name: "Bulbasaur #1", console: "/console/pokemon-1999-topps-tv" },
    pack: { id: "9271217", name: "Booster Pack Series 1 Blue Logo", console: "/console/pokemon-1999-topps-tv" },
  },
  {
    release: "first-movie",
    card: { id: "3560739", name: "Mechanical Mewtwo #6", console: "/console/pokemon-1999-topps-movie" },
    pack: { id: "6971307", name: "First Movie Booster Pack", console: "/console/pokemon-1999-topps-movie" },
  },
  {
    release: "series-2",
    card: { id: "3975758", name: "Gengar #94", console: "/console/pokemon-2000-topps-tv" },
    // Filed under the 1999 bucket rather than the 2000 one. That is
    // PriceCharting's filing, not ours, and the caption names the bucket.
    pack: { id: "7750396", name: "Booster Pack [Series 2]", console: "/console/pokemon-1999-topps-tv" },
  },
  {
    release: "chrome-1",
    card: { id: "3561219", name: "Blastoise #9", console: "/console/pokemon-2000-topps-chrome" },
    pack: { id: "10332476", name: "Booster Box [Series 1]", console: "/console/pokemon-2000-topps-chrome" },
  },
  {
    release: "movie-2000",
    card: { id: "3561550", name: "Lugia Rises #64", console: "/console/pokemon-2000-topps-movie" },
    pack: { id: "4787792", name: "Booster Pack", console: "/console/pokemon-2000-topps-movie" },
  },
  {
    release: "series-3",
    card: { id: "3975933", name: "Mew #151", console: "/console/pokemon-2000-topps-tv" },
    pack: { id: "7667580", name: "Booster Pack [Series 3]", console: "/console/pokemon-2000-topps-tv" },
  },
  {
    release: "chrome-2",
    card: { id: "3725966", name: "Mewtwo #150", console: "/console/pokemon-2000-topps-chrome" },
    pack: { id: "9745134", name: "Booster Pack: Series 2", console: "/console/pokemon-2000-topps-chrome" },
  },
  {
    release: "johto-1",
    card: { id: "5705966", name: "Chikorita #152", console: "/console/pokemon-2001-topps-johto" },
    pack: { id: "11282671", name: "Booster Box [Series 1]", console: "/console/pokemon-2001-topps-johto" },
  },
  // JOHTO SERIES 3 GETS NOTHING AND THAT IS THE HONEST ANSWER. It was released
  // in Europe only, PriceCharting files no bucket for it at all, and the set
  // card on the page already says so in words. There is no card of it in this
  // repo to show and none was substituted from a neighbouring set.
  { release: "johto-series-3", card: null, pack: null },
  {
    release: "johto-league-champions",
    card: { id: "5768755", name: "Ho-Oh #250", console: "/console/pokemon-2001-topps-johto-champions" },
    pack: null,
  },
  {
    release: "advanced",
    card: { id: "5769494", name: "Blaziken #19", console: "/console/pokemon-2003-topps-advanced" },
    pack: null,
  },
  {
    release: "advanced-challenge",
    card: { id: "5769736", name: "Rayquaza #54", console: "/console/pokemon-2004-topps-advanced-challenge" },
    pack: null,
  },
];

// THE THREE PICTURES THAT ARE NOT A SET ROW.
//
// `hero` is the first thing on the page and it is a Pikachu on purpose: the
// hero has one job, which is to show a stranger what a Topps Pokemon card looks
// like before they read a word, and the most recognisable Pokemon on the most
// recognisable Topps set does that better than the most valuable card does.
//
// `toppsCompare` and the TCG card beside it are the side-by-side in the "in your
// hand" section, and they are BOTH CHARIZARD BY DESIGN. The section is a visual
// comparison and prose cannot do it: the reader has to see that one has HP and
// an attack and a commissioned illustration, and the other has a screen still
// and nothing to play with. Holding the Pokemon and the year fixed is what makes
// it a comparison rather than two pictures. Base Set Charizard is the same 1999
// and the card everybody in Pokemon already knows.
const HERO = { id: "3561028", name: "Pikachu #25", console: "/console/pokemon-1999-topps-tv" };
const COMPARE = { id: "3560971", name: "Charizard #6", console: "/console/pokemon-1999-topps-tv" };

// The Pokemon TCG half of the comparison. TCGdex, the host every card scan on
// this site's set guides comes from, at the url /base-set.html already uses for
// this exact card. imgDims() in shared/format.mjs knows this host's intrinsic
// size, so unlike the PriceCharting scans this one CAN carry width and height.
const TCG_COMPARE = {
  url: "https://assets.tcgdex.net/en/base/base1/4/high.webp",
  name: "Charizard",
  set: "Base Set",
  number: "4",
  total: "102",
  year: "1999",
};

// ---------------------------------------------------------------------------
// Resolve the card pins out of the cache that already exists. NO NETWORK HERE.

async function readConsoleCache(dir, filter) {
  const rows = new Map();
  const sets = new Map();
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".html"));
  } catch {
    return { rows, sets };
  }
  for (const f of files) {
    const html = await readFile(join(dir, f), "utf8");
    const canon = /rel="canonical" href="([^"]+)"/.exec(html);
    if (!canon) continue;
    let path;
    try {
      path = decodeURIComponent(new URL(unent(canon[1])).pathname);
    } catch {
      continue;
    }
    if (!filter(path)) continue;
    const { rows: got, headers } = parsePage(html);
    // Same contract every reader of these pages enforces: a page whose columns
    // are not the expected ones is skipped, never read positionally.
    if (headers.length && headers.join("|") !== CONSOLE_HEADERS.join("|")) continue;
    const t = /<title>Pokemon (.*?) (?:Card )?Prices/.exec(html);
    sets.set(path, t ? text(t[1]) : path.replace("/console/pokemon-", ""));
    for (const r of got) if (!rows.has(r.id)) rows.set(r.id, { ...r, console: path });
  }
  return { rows, sets };
}

const isTopps = (p) => p.includes("/console/pokemon") && /topps/i.test(p);
const cached = await readConsoleCache(CONSOLE_CACHE, isTopps);
if (!cached.rows.size) {
  console.error(
    `No Topps consoles found in .cache/pricecharting-console.\n` +
      `Run: node scripts/sync-graded-top.mjs   (a crawl, one request a second)`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// The sealed listings. Cached, so a re-run makes no request at all.

const sealedPaths = [...new Set(PINS.map((p) => p.pack?.console).filter(Boolean))];
await mkdir(SEALED_CACHE, { recursive: true });

for (const path of sealedPaths) {
  let cursor = 0;
  let guard = 0;
  const seen = new Set();
  for (;;) {
    // NO exclude-hardware. That parameter is what keeps sealed product out of
    // the price crawl, and dropping it here is the entire reason this loop
    // exists. Nothing on these pages is read except a name and an image url.
    const url = `https://www.pricecharting.com${encPath(path)}` + (cursor ? `?cursor=${cursor}` : "");
    const key = createHash("sha1").update(url).digest("hex") + ".html";
    let html;
    try {
      html = await readFile(join(SEALED_CACHE, key), "utf8");
    } catch {
      const res = await fetch(url, { headers: { "user-agent": UA } });
      if (res.status !== 200) {
        console.error(`  HTTP ${res.status} on ${url}, stopping this console`);
        break;
      }
      html = await res.text();
      await writeFile(join(SEALED_CACHE, key), html);
      await sleep(1100);
    }
    const { rows, next } = parsePage(html);
    const fresh = rows.filter((r) => !seen.has(r.id));
    for (const r of rows) {
      seen.add(r.id);
      if (!cached.rows.has(r.id)) cached.rows.set(r.id, { ...r, console: path });
    }
    // A cursor that is ignored re-serves page one forever; sync-graded-top.mjs
    // has the same guard for the same reason.
    if (next == null || next <= cursor || fresh.length === 0 || ++guard > 20) break;
    cursor = next;
  }
}

// ---------------------------------------------------------------------------
// Resolve a pin, then verify its picture.

const scanOf = (url) => (/^https?:\/\//.test(String(url || "")) ? url : null);
const big = (url) => String(url).replace(/\/\d+\.jpg$/, "/240.jpg");

const problems = [];

function resolve(pin, what) {
  if (!pin) return null;
  const row = cached.rows.get(pin.id);
  if (!row) {
    problems.push(`${what}: product id ${pin.id} ("${pin.name}") is not in the crawl at all`);
    return null;
  }
  if (row.name !== pin.name) {
    problems.push(
      `${what}: product id ${pin.id} is pinned as "${pin.name}" and the crawl now calls it ` +
        `"${row.name}". The pin is REFUSED rather than followed. Work out what moved, then ` +
        `rewrite the pin and its name together.`,
    );
    return null;
  }
  const img = scanOf(row.img);
  if (!img) {
    problems.push(`${what}: ${pin.name} carries no absolute scan url (PriceCharting has no picture of it)`);
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    console: row.console,
    set: cached.sets.get(row.console) || row.console.replace("/console/pokemon-", ""),
    path: row.path,
    img: big(img),
  };
}

/**
 * Fetch the picture and decide whether it may ship.
 *
 * GET rather than HEAD, and the body length is checked. PriceCharting's CDN
 * answers 403 for a card it has no scan of, which is why a "not 404" test would
 * pass a dead url straight onto the page; and a 200 with an empty body is a
 * broken image in a box, which looks like a page fault rather than like missing
 * data.
 */
async function verify(url) {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA } });
    const buf = res.status === 200 ? Buffer.from(await res.arrayBuffer()) : null;
    return {
      ok: res.status === 200 && buf.length > 500,
      status: res.status,
      bytes: buf ? buf.length : 0,
      type: res.headers.get("content-type") || null,
    };
  } catch (e) {
    return { ok: false, status: 0, bytes: 0, error: String(e.message || e) };
  }
}

const checked = [];
async function checkedPicture(pin, what) {
  const got = resolve(pin, what);
  if (!got) return null;
  const v = await verify(got.img);
  await sleep(250);
  checked.push({ what, url: got.img, ...v });
  if (!v.ok) {
    problems.push(`${what}: ${got.name} scan answered ${v.status} (${v.bytes} bytes), so it is not published`);
    return null;
  }
  return { ...got, ...v };
}

const sets = [];
for (const pin of PINS) {
  sets.push({
    release: pin.release,
    card: await checkedPicture(pin.card, `${pin.release} card`),
    pack: await checkedPicture(pin.pack, `${pin.release} packaging`),
  });
}
const hero = await checkedPicture(HERO, "hero card");
const compare = await checkedPicture(COMPARE, "comparison Topps card");

const tcgCheck = await verify(TCG_COMPARE.url);
checked.push({ what: "comparison TCG card", url: TCG_COMPARE.url, ...tcgCheck });
if (!tcgCheck.ok) problems.push(`comparison TCG card: ${TCG_COMPARE.url} answered ${tcgCheck.status}`);

// ---------------------------------------------------------------------------

const out = {
  _readme: [
    "Pictures for /topps.html, written by scripts/sync-topps-images.mjs.",
    "",
    "Every entry is PINNED by PriceCharting's own product id and CHECKED by the",
    "name we expect on it. A pin whose name has drifted is refused and the",
    "picture is not published: a wrong card is worse than no card here, because",
    "these are four Chrome finishes of one collector number and a reader has no",
    "way to tell they were shown the wrong one.",
    "",
    "Cards come from .cache/pricecharting-console/, the crawl that already",
    "existed. Packaging needed the same console pages fetched WITHOUT",
    "exclude-hardware=true, which is the parameter that keeps sealed product out",
    "of the price crawl; those are cached under .cache/pricecharting-topps-sealed.",
    "",
    "NO PRICE COMES OFF THE SEALED ROWS AND NONE MAY. They were read once, and",
    "nothing out of PriceCharting is publishable on this site on a single read.",
    "Only the product name and the photograph are taken.",
    "",
    "`ok` means the url was FETCHED and answered 200 with a real image body on",
    "the date below. PriceCharting's CDN answers 403, not 404, for a card it has",
    "no scan of, so a 404 test proves nothing. build-topps.mjs emits no <img> at",
    "all for anything not ok.",
    "",
    "NO WIDTH OR HEIGHT. This host serves a fixed 240 HIGH and a variable width,",
    "so a declared width is wrong for most of these files. The boxes are pinned",
    "in CSS instead, which is what keeps CLS at 0.",
  ],
  source: "pricecharting.com",
  tcgSource: "assets.tcgdex.net",
  verified: new Date().toISOString().slice(0, 10),
  rendition: "240.jpg",
  hero,
  compare: { topps: compare, tcg: tcgCheck.ok ? TCG_COMPARE : null },
  sets,
  noPackaging: sets.filter((s) => !s.pack).map((s) => s.release),
  checked,
};

if (problems.length) {
  console.error(`\n${problems.length} picture(s) could not be published:`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    `\nNothing was substituted for them. A set with no picture shows no frame at all;\n` +
      `see build-topps.mjs. Fix a pin only by working out what moved.`,
  );
}

if (!REPORT) await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");

const okCount = checked.filter((c) => c.ok).length;
const bytes = checked.filter((c) => c.ok).reduce((n, c) => n + c.bytes, 0);
console.log(
  `${REPORT ? "Measured (wrote nothing)" : "Wrote data/topps-images.json"}\n` +
    `  ${okCount} of ${checked.length} pictures fetched and verified 200, ` +
    `${(bytes / 1024).toFixed(1)}KB of image on disk at the source\n` +
    `  ${sets.filter((s) => s.card).length} of ${sets.length} releases have a card, ` +
    `${sets.filter((s) => s.pack).length} have packaging\n` +
    (out.noPackaging.length
      ? `  no packaging in PriceCharting's catalogue for: ${out.noPackaging.join(", ")}\n`
      : "") +
    `  hero ${hero ? hero.name : "NONE"}, comparison ${compare ? compare.name : "NONE"} against ` +
    `${tcgCheck.ok ? `${TCG_COMPARE.set} ${TCG_COMPARE.name}` : "NONE"}`,
);
