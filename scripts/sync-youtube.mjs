#!/usr/bin/env node
// Pull the full Garbage Rips 585 catalogue from the YouTube Data API and write
// it to data/videos.json + data/playlists.json.
//
//   YT_API_KEY=xxxxx node scripts/sync-youtube.mjs
//
// The key is read from the environment on purpose: it never lands in the repo,
// never ships to the browser, and the deployed site stays a pile of static
// files. Re-run this whenever you want the back catalogue refreshed.
//
// Quota cost is trivial (roughly 25 units of the free 10,000/day for ~300
// videos), so running it often is fine.

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveTags, isShort, parseDuration } from "../shared/taxonomy.mjs";
import { raritiesIn } from "../shared/rarity.mjs";
import { ripPath } from "../shared/paths.mjs";

const CHANNEL_ID = "UCnpEGJ2G_0af1YRyW2euIZQ";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://www.googleapis.com/youtube/v3";

const KEY = process.env.YT_API_KEY;
if (!KEY) {
  console.error(`
Missing YT_API_KEY.

  1. https://console.cloud.google.com/ -> create a project (free)
  2. APIs & Services -> Library -> enable "YouTube Data API v3"
  3. APIs & Services -> Credentials -> Create credentials -> API key
  4. Run:  YT_API_KEY=your_key_here node scripts/sync-youtube.mjs

The key stays on your machine. Nothing is committed and nothing is deployed.
`);
  process.exit(1);
}

async function api(path, params) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", KEY);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} -> HTTP ${res.status}\n${body.slice(0, 500)}`);
  }
  return res.json();
}

// Walk every page of a list endpoint.
async function paginate(path, params, cap = 5000) {
  const items = [];
  let pageToken;
  do {
    const page = await api(path, { ...params, maxResults: 50, ...(pageToken ? { pageToken } : {}) });
    items.push(...(page.items || []));
    pageToken = page.nextPageToken;
    process.stdout.write(`\r  ${path}: ${items.length} items`);
  } while (pageToken && items.length < cap);
  process.stdout.write("\n");
  return items;
}

console.log("Fetching channel...");
const channel = (await api("channels", { part: "contentDetails,snippet,statistics", id: CHANNEL_ID })).items?.[0];
if (!channel) throw new Error("Channel not found. Check CHANNEL_ID.");
const uploadsId = channel.contentDetails.relatedPlaylists.uploads;

console.log("Fetching every upload...");
const uploads = await paginate("playlistItems", { part: "snippet,contentDetails", playlistId: uploadsId });

// Durations and view counts come from a separate endpoint, 50 ids at a time.
console.log("Fetching durations and view counts...");
const ids = uploads.map((i) => i.contentDetails.videoId).filter(Boolean);
const details = new Map();
for (let i = 0; i < ids.length; i += 50) {
  const batch = ids.slice(i, i + 50);
  const res = await api("videos", { part: "contentDetails,statistics", id: batch.join(",") });
  for (const v of res.items || []) {
    details.set(v.id, {
      duration: parseDuration(v.contentDetails?.duration),
      views: Number(v.statistics?.viewCount || 0),
    });
  }
  process.stdout.write(`\r  videos: ${details.size}/${ids.length}`);
}
process.stdout.write("\n");

console.log("Fetching playlists...");
const rawPlaylists = await paginate("playlists", { part: "snippet,contentDetails", channelId: CHANNEL_ID });

const playlists = [];
for (const p of rawPlaylists) {
  const items = await paginate("playlistItems", { part: "contentDetails", playlistId: p.id });
  // Keep the playlist's own cover. Tim sets these by hand and they show the
  // sealed packaging rather than a pulled card, so unlike a video's poster
  // frame they give nothing away and are better than any wrapper we could
  // substitute. Widest available: maxres is 1280 wide, standard 640, high 480.
  const t = p.snippet.thumbnails || {};
  let cover = t.maxres || t.standard || t.high || t.medium || t.default || null;
  // A playlist with no cover chosen yet answers with i.ytimg.com/img/
  // no_thumbnail.jpg, a 120x90 grey placeholder. Treat that as no cover at all
  // so the site falls back to the set's wrapper instead of shipping the grey.
  if (cover && /no_thumbnail/.test(cover.url || "")) cover = null;

  playlists.push({
    id: p.id,
    title: p.snippet.title,
    description: p.snippet.description || "",
    count: items.length,
    thumb: cover?.url || null,
    thumbW: cover?.width || null,
    thumbH: cover?.height || null,
    videoIds: items.map((i) => i.contentDetails.videoId).filter(Boolean),
  });
  console.log(`  ${p.snippet.title} (${items.length})`);
}

// Duration does not tell you orientation: this channel has vertical rips well
// over 60s. The reliable signal is whether YouTube serves an "original aspect
// ratio" thumbnail, which only exists for vertical uploads.
console.log("Probing orientation...");
const vertical = new Map();
for (let i = 0; i < ids.length; i += 16) {
  await Promise.all(
    ids.slice(i, i + 16).map(async (id) => {
      try {
        const r = await fetch(`https://i.ytimg.com/vi/${id}/oardefault.jpg`, { method: "HEAD" });
        vertical.set(id, r.ok);
      } catch {
        vertical.set(id, true); // network hiccup: assume vertical, it is the norm here
      }
    })
  );
  process.stdout.write(`\r  probed: ${vertical.size}/${ids.length}`);
}
process.stdout.write("\n");

// Playlist titles are a far better tag source than video titles: a video sitting
// in "Perfect Order Booster Bundle Series" is definitively Perfect Order and
// definitively a bundle, even when its own title only says "DID WE GET THE ZARD".
// Used to fill gaps only, never to overwrite a tag the video stated itself.
const fromPlaylist = new Map();
for (const p of playlists) {
  const tags = deriveTags({ title: p.title });
  if (!tags.sets.length && !tags.products.length) continue;
  for (const id of p.videoIds) {
    const prev = fromPlaylist.get(id) || { sets: [], products: [] };
    for (const s of tags.sets) if (!prev.sets.includes(s)) prev.sets.push(s);
    for (const pr of tags.products) if (!prev.products.includes(pr)) prev.products.push(pr);
    fromPlaylist.set(id, prev);
  }
}
console.log(`Playlist titles supply tags for ${fromPlaylist.size} videos.`);

// Whatever Tim filled in on the video log: hit card, rarity, greatest-hit
// flag, affiliate link. Written by scripts/import-sheet.mjs.
let manual_ = {};
try {
  manual_ = JSON.parse(await readFile(join(ROOT, "data/manual.json"), "utf8"));
} catch {
  /* no log imported yet */
}

// Hand corrections always win over the automatic matcher.
let overrides = {};
try {
  overrides = JSON.parse(await readFile(join(ROOT, "data/overrides.json"), "utf8"));
} catch {
  /* no overrides yet, that is fine */
}


/**
 * "Hit Rarity" from the spreadsheet -> the pull tag ids the site renders.
 *
 * The dropdown stores a human label with a hint in brackets, e.g.
 * "Special Illustration Rare (2 gold stars)", so the bracket is stripped before
 * matching. "No hit" is an explicit answer, not a missing one: it returns an
 * empty list so the tile shows no badge rather than falling back to whatever
 * the title implied.
 */
// ULTRA RARE USED TO MAP ONTO THE SIR BADGE and Mega Hyper Rare onto Hyper
// Rare, because those tiers had no tag of their own. That is not a shorthand,
// it is a two tier promotion printed on the page as fact: a card logged Ultra
// Rare rendered as "Special Illustration Rare". Both have real tags now.
const RARITY_TO_PULL = {
  "mega hyper rare": "mega-hyper",
  "hyper rare": "gold",
  "special illustration rare": "sir",
  "illustration rare": "ir",
  "ultra rare": "ultra",
  "ace spec rare": "ace-spec",
  "super rare": "super",
  "double rare": "double-rare",
  "charizard": "charizard",
};

// The rarity ids shared/rarity.mjs reads out of the free text hit field, mapped
// onto the same tags. Without this a hit typed into Hit Card reached its own
// rip page and nowhere else: seven of the nine logged hits had pulls: [], so
// they were missing from the homepage hit count, the Hall of Fame pool, every
// tile badge and the luck page.
const RARITY_ID_TO_PULL = {
  "mega-hyper": "mega-hyper", gold: "gold", sir: "sir", ir: "ir",
  "ace-spec": "ace-spec", ultra: "ultra", "double-rare": "double-rare",
  charizard: "charizard", rare: null,
  "jp-sar": "sir", "jp-sr": "super", "jp-ar": "ir", "jp-rr": "double-rare",
};
/** Every tier named in the free text hit field, as pull tags. */
function pullsFromHitCard(hitCard) {
  if (!hitCard) return null;
  const ids = raritiesIn(hitCard).map((id) => RARITY_ID_TO_PULL[id]).filter(Boolean);
  return ids.length ? [...new Set(ids)] : null;
}

function rarityToPulls(rarity, hasHit) {
  if (hasHit === false) return [];
  if (!rarity) return null;
  const key = String(rarity).replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
  if (/^no hit$/.test(key)) return [];
  const tag = RARITY_TO_PULL[key];
  return tag ? [tag] : null;
}

const videos = uploads
  .map((item) => {
    const id = item.contentDetails.videoId;
    const title = item.snippet.title || "";
    const description = item.snippet.description || "";
    const d = details.get(id) || {};
    const auto = deriveTags({ title, description });
    const inherited = fromPlaylist.get(id) || { sets: [], products: [] };
    if (!auto.sets.length) auto.sets = inherited.sets;
    if (!auto.products.length) auto.products = inherited.products.slice(0, 1);
    const manual = overrides[id] || {};
    const log = manual_[id] || {};
    const base = { id, title };
    return {
      id,
      title,
      path: ripPath(base),
      published: (item.contentDetails.videoPublishedAt || item.snippet.publishedAt || "").slice(0, 10),
      duration: d.duration ?? 0,
      views: d.views ?? 0,
      vertical: manual.vertical ?? vertical.get(id) ?? true,
      short: isShort(d.duration),
      sets: manual.sets ?? auto.sets,
      products: manual.products ?? auto.products,
      // Hit Rarity from the rip log wins over the tags derived from the title.
      // Without this, filling that column in for 310 videos improved the luck
      // page and nothing else: the badge on every tile and the Hall of Fame
      // ordering both read `pulls`, which was still coming from whatever the
      // title happened to say. A deliberate answer should beat a guess.
      // A HIT BADGE REQUIRES A NAMED CARD, and nothing else counts.
      //
      // This used to fall back to tags derived from the title and description,
      // which is how videos got a "Gold" or "Ultra Rare" badge for saying they
      // were HUNTING a card. The site was claiming pulls that never happened,
      // on the one subject where this site's whole promise is that it does not.
      //
      // The Hit Rarity column is not enough either, because build-sheet.py used
      // to prefill it from those same derived tags and the CSV round trip loses
      // the styling that marked it a guess: 62 of 64 values arrived that way.
      // A card NAME is the one thing only a person types.
      //
      // So: an explicit override wins, then a named card, then nothing. As the
      // log fills in, badges come back one video at a time, each one true.
      pulls: manual.pulls ?? pullsFromHitCard(log.hitCard) ?? [],
      // Everything the spreadsheet can say about a video. This list used to
      // name five fields, so the other eight columns were imported into
      // manual.json and then silently dropped here, which is why nothing ever
      // read openingType, siteTitle, blurb, feature, hide, box or notes.
      ...(log.hitCard ? { hitCard: log.hitCard } : {}),
      ...(log.hitRarity ? { hitRarity: log.hitRarity } : {}),
      ...(log.hasHit != null ? { hasHit: log.hasHit } : {}),
      ...(log.packs ? { packs: log.packs } : {}),
      // WHICH ONE OF THESE, AND WHICH PACK OUT OF IT. Both spread like `packs`
      // above, so a video with neither carries neither KEY, not a null and not
      // a zero. Every reader is written as "show it if it is there", and the
      // absent case is 316 of 316 videos today, so absence has to be the shape
      // that costs nothing and renders nothing.
      ...(log.boxNumber ? { boxNumber: log.boxNumber } : {}),
      ...(log.packNumber ? { packNumber: log.packNumber } : {}),
      ...(log.greatest ? { greatest: true } : {}),
      ...(log.hofRank != null ? { hofRank: log.hofRank } : {}),
      ...(log.affiliate ? { affiliate: log.affiliate } : {}),
      ...(log.openingType ? { openingType: log.openingType } : {}),
      ...(log.siteTitle ? { siteTitle: log.siteTitle } : {}),
      // AN OVERRIDE BEATS THE SHEET HERE TOO. blurb read only from manual.json,
      // which is spreadsheet-imported, so a correction made by hand was liable
      // to be cleared the next time that column came back empty. overrides.json
      // already outranks the sheet for sets, products and vertical, and its own
      // readme calls it "hand corrections that always beat the automatic
      // tagging". Blurb was the one field that did not honour that.
      ...((manual.blurb ?? log.blurb) ? { blurb: manual.blurb ?? log.blurb } : {}),
      ...(log.box ? { box: log.box } : {}),
      ...(log.notes ? { notes: log.notes } : {}),
      ...(log.feature ? { feature: true } : {}),
      ...(log.hide ? { hide: true } : {}),
    };
  })
  // "Hide" on the sheet means keep it off the site entirely: no page, no tile,
  // no sitemap entry. Dropping it here rather than at each generator means one
  // rule instead of six.
  .filter((v) => v.id && !v.hide)
  .sort((a, b) => (a.published < b.published ? 1 : -1));

// Descriptions are only needed when generating the per-video pages, so they
// live outside public/ rather than bloating the JSON every visitor downloads.
const descriptions = Object.fromEntries(
  uploads.map((i) => [i.contentDetails.videoId, i.snippet.description || ""]).filter(([id]) => id)
);
await mkdir(join(ROOT, "data"), { recursive: true });
await writeFile(join(ROOT, "data/descriptions.json"), JSON.stringify(descriptions, null, 0) + "\n");

await mkdir(join(ROOT, "public/data"), { recursive: true });
await writeFile(
  join(ROOT, "public/data/videos.json"),
  JSON.stringify({ channelId: CHANNEL_ID, syncedAt: new Date().toISOString().slice(0, 10), videos }, null, 0) + "\n"
);
await writeFile(
  join(ROOT, "public/data/playlists.json"),
  JSON.stringify({ syncedAt: new Date().toISOString().slice(0, 10), playlists }, null, 0) + "\n"
);

const untaggedSet = videos.filter((v) => !v.sets.length).length;
const untaggedProduct = videos.filter((v) => !v.products.length).length;
console.log(`
Wrote data/videos.json     ${videos.length} videos
Wrote data/playlists.json  ${playlists.length} playlists

  vertical (Shorts): ${videos.filter((v) => v.vertical).length}
  no set tag:        ${untaggedSet}
  no product tag:    ${untaggedProduct}

Untagged videos still show up in the library, they just do not match a filter.
Fix any of them by adding an entry to data/overrides.json, for example:

  { "dQw4w9WgXcQ": { "sets": ["pitch-black"], "products": ["etb"] } }
`);
