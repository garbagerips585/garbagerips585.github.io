#!/usr/bin/env node
// Mirror the two official app listings' own artwork, at the size it is drawn.
//
//   node scripts/sync-app-shots.mjs            fetch anything not held yet
//   node scripts/sync-app-shots.mjs --force    refetch all of them
//
// WHY THIS EXISTS. /tcg-live.html and /tcg-pocket.html were the two pages on
// this site with no picture at all, and they are the two whose subject is
// almost entirely visual: both are guides to an app. Both builders carried a
// "NO IMAGERY" note whose reason was that the site does not use other people's
// pictures and there are no in-house screenshots. The owner has since said that
// official Pokemon imagery may be used on this site, which removes the first
// half of that reason and leaves the second half solved: the publisher ships
// its own screenshots.
//
// WHOSE PICTURES THESE ARE, WHICH IS THE WHOLE POINT. Every file here comes off
// the app's own App Store listing, which is artwork the DEVELOPER uploads. Both
// developers are verified against the listing on every run rather than trusted:
// Pokemon TCG Live is published by THE POKEMON COMPANY INTERNATIONAL, INC. and
// Pokemon TCG Pocket by The Pokemon Company. If the seller name or the bundle id
// ever stops matching, the sync fails loudly instead of quietly mirroring
// somebody else's app. The pages credit the listing in one line.
//
// ONE SCREENSHOT IS DELIBERATELY EXCLUDED AND IT IS NOT AN OVERSIGHT. Pocket's
// first listed screenshot carries a visible "Offering Rates" button. The site
// never states pull rates and data/tcg-pocket.json's forbidden block extends
// that to naming them as an invitation, so a picture of the button is the same
// claim made at one remove. It is excluded by INDEX below rather than by taking
// "the first three", and this paragraph is why: "the first three" would put it
// back the next time somebody tidies this file. Every other shot mirrored here
// was looked at before it was pinned, which is also how that one was caught.
//
// SIZE. Apple's image host takes the box in the url path, so this asks for the
// exact size the page paints rather than fetching a 1242x2208 marketing asset
// and letting the browser throw 90% of it away. The strip draws each shot in a
// 132px column, so 264 wide covers it at DPR2, and the icon sits in a 56px box.
// Measured: the listing's own 392x696 jpg is 136KB a shot; 264x469 webp is 20KB.
//
// WEBP DIRECTLY FROM THE HOST, so there is no Pillow step here at all. Apple's
// thumb service honours the extension as well as the box, which the other image
// pipelines in this repo cannot do (TCGdex publishes fixed widths, the Pokemon
// TCG API publishes one file), so this one is a download and nothing else.
//
// IDEMPOTENT. A file already on disk is not refetched. The manifest is rebuilt
// from what is ON DISK, the way sync-symbols.mjs does it, so a run that fetches
// nothing still writes a complete manifest.
//
// FALLBACK IS THE REMOTE URL. A shot with no local file keeps the listing url it
// came from, so a fetch that fails degrades to a slower picture rather than to a
// hole. That is decided at build time from this manifest, not with onerror:
// onerror never fires for a lazy image below the fold.

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "assets", "apps");
const MANIFEST = join(ROOT, "data", "app-shots.json");
const FORCE = process.argv.includes("--force");

/** Rendered boxes, in CSS px, doubled for DPR2. Change these and re-run --force. */
const SHOT_W = 132;
const ICON_W = 56;

/**
 * The two apps, pinned by App Store id.
 *
 * `seller` and `bundle` are asserted, not read. Apple's lookup answers 200 with
 * an empty result set for an id it does not know, and 200 with a DIFFERENT app
 * if an id is ever reassigned, so neither the status code nor the shape of the
 * response tells you that you got the app you asked for. The same discipline
 * sync-products.mjs uses on TCGplayer's set names, and for the same reason.
 *
 * `index` picks which of the listed screenshots to mirror, by position in the
 * listing, and every one was looked at first. See the note at the top about
 * Pocket 0. The order here is the order the page uses.
 */
const APPS = [
  {
    key: "live",
    id: 1557962344,
    name: "Pokemon TCG Live",
    bundle: "com.pokemon.pokemontcgl",
    seller: "THE POKEMON COMPANY INTERNATIONAL, INC.",
    index: [0, 1, 2],
    // What each mirrored shot actually shows, checked by opening the file. Both
    // are descriptions of THAT file and nothing more: no claim about how the app
    // usually looks, and nothing that touches odds of any kind.
    //
    // TWO LENGTHS BECAUSE THEY GO TO TWO PLACES. `shows` is the alt text, which
    // is where a screen reader gets the picture and which costs a sighted reader
    // nothing. `brief` is the visible caption, and both pages hold a hard word
    // budget, so a caption that runs long there is paid for out of the prose.
    shows: [
      "one card open at full size, with its attack and its printed weakness and retreat",
      "a match in progress, with both players' benches, decks and prize counts on screen",
      "an attack resolving, with the damage on the defending Pokemon",
    ],
    brief: ["one card at full size", "a match in progress", "an attack landing"],
  },
  {
    key: "pocket",
    id: 6479970832,
    name: "Pokemon TCG Pocket",
    bundle: "jp.pokemon.pokemontcgp",
    seller: "The Pokemon Company",
    index: [5, 4, 3],
    shows: [
      "a battle in progress, with both sides' Pokemon on the screen at once",
      "one card open at full size, its attack taking Energy from an Energy Zone rather than from a card",
      "the collection screen, with the cards owned so far laid out in set order",
    ],
    brief: ["a battle in progress", "one card at full size", "the collection screen"],
  },
];

const file = (key, what) => `pokemon-tcg-${key}-app-${what}.webp`;

/**
 * Ask Apple's thumb service for one exact box, as WebP.
 *
 * The listing hands back a url ending in `/<w>x<h>bb.<ext>`; everything before
 * that is the asset and the last segment is a request. So the resize is a string
 * edit, and the source pixels are never downloaded at all.
 */
const at = (url, w, h, ext = "webp") =>
  url.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/, `/${w}x${h}bb.${ext}`);

/** The intrinsic size the listing url declares, so the box keeps the shape. */
function sourceShape(url) {
  const m = /\/(\d+)x(\d+)bb\.(?:jpg|png|webp)$/.exec(url);
  return m ? [Number(m[1]), Number(m[2])] : [392, 696];
}

async function download(url, dest) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length) {
          await writeFile(dest, buf);
          return buf.length;
        }
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, attempt * 1500));
  }
  return 0;
}

/** Decoded size, so the manifest carries the real shape rather than the request. */
function decoded(paths) {
  const py = `
import json, sys
from PIL import Image
out = {}
for p in json.load(sys.stdin):
    im = Image.open(p)
    out[p] = list(im.size)
json.dump(out, sys.stdout)
`;
  if (!paths.length) return {};
  try {
    return JSON.parse(
      execFileSync("python3", ["-c", py], { input: JSON.stringify(paths) }).toString()
    );
  } catch (e) {
    console.error("Pillow could not read the mirrored files. Install it with:");
    console.error("  python3 -m pip install --user Pillow");
    console.error(String(e.stderr || e.message).trim().split("\n").slice(-3).join("\n"));
    process.exit(1);
  }
}

await mkdir(OUT, { recursive: true });

const apps = {};
const paths = [];
let fetched = 0;
let held = 0;

for (const app of APPS) {
  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${app.id}&entity=software&country=us`
  );
  if (!res.ok) throw new Error(`App Store lookup failed for ${app.name}: HTTP ${res.status}`);
  // The response is served as text/javascript and contains raw control
  // characters in the release notes, which JSON.parse rejects. Strip them.
  const row = JSON.parse((await res.text()).replace(/[\u0000-\u001f]/g, " ")).results?.[0];
  if (!row) throw new Error(`App Store returned no app for id ${app.id} (${app.name})`);
  if (row.bundleId !== app.bundle) {
    throw new Error(
      `App Store id ${app.id} is now ${row.bundleId}, not ${app.bundle}. Do not mirror it.`
    );
  }
  if (row.sellerName !== app.seller) {
    throw new Error(
      `App Store id ${app.id} is now published by "${row.sellerName}", not "${app.seller}". ` +
        "These files are only usable here because the publisher is Pokemon's own. Stop."
    );
  }

  const shots = [];
  for (let i = 0; i < app.index.length; i++) {
    const src = row.screenshotUrls?.[app.index[i]];
    if (!src) {
      console.log(`  ${app.name}: the listing no longer has a screenshot at index ${app.index[i]}`);
      continue;
    }
    const [sw, sh] = sourceShape(src);
    const w = SHOT_W * 2;
    const h = Math.round((w * sh) / sw);
    const name = file(app.key, `screenshot-${i + 1}`);
    const dest = join(OUT, name);
    if (!FORCE && existsSync(dest)) held += 1;
    else if (await download(at(src, w, h), dest)) fetched += 1;
    else {
      console.log(`  ${app.name}: screenshot ${i + 1} would not download, keeping the remote url`);
      shots.push({ file: null, remote: src, shows: app.shows[i], brief: app.brief[i], listing: src });
      continue;
    }
    paths.push(dest);
    shots.push({ file: name, remote: src, shows: app.shows[i], brief: app.brief[i], listing: src });
  }

  let icon = null;
  if (row.artworkUrl512) {
    const name = file(app.key, "icon");
    const dest = join(OUT, name);
    let ok = true;
    if (!FORCE && existsSync(dest)) held += 1;
    else if (await download(at(row.artworkUrl512, ICON_W * 2, ICON_W * 2), dest)) fetched += 1;
    else ok = false;
    if (ok) paths.push(dest);
    icon = { file: ok ? name : null, remote: row.artworkUrl512 };
  }

  apps[app.key] = {
    name: app.name,
    listedAs: row.trackName,
    seller: row.sellerName,
    bundle: row.bundleId,
    trackId: row.trackId,
    version: row.version,
    listingUpdated: String(row.currentVersionReleaseDate || "").slice(0, 10),
    icon,
    shots,
  };
}

const sizes = decoded(paths);
for (const app of Object.values(apps)) {
  for (const s of [...app.shots, app.icon].filter((x) => x && x.file)) {
    const p = join(OUT, s.file);
    const [w, h] = sizes[p] || [];
    s.w = w;
    s.h = h;
    s.bytes = statSync(p).size;
  }
}

await writeFile(
  MANIFEST,
  JSON.stringify(
    {
      _readme: [
        "Artwork from the two official Pokemon app listings on the App Store,",
        "mirrored locally by scripts/sync-app-shots.mjs at the size the pages draw it.",
        "",
        "Every file is the publisher's own: THE POKEMON COMPANY INTERNATIONAL, INC.",
        "for Pokemon TCG Live and The Pokemon Company for Pokemon TCG Pocket, both",
        "asserted against the listing on every sync rather than trusted.",
        "",
        "`shows` and `brief` both describe THAT file, written after opening it.",
        "`shows` becomes the alt text and `brief` the visible caption, which is",
        "shorter because both pages hold a hard word budget. Neither characterises",
        "the app in general and neither touches odds of any kind.",
        "",
        "`w` and `h` are the decoded size of the mirrored file. Builders emit them as",
        "the width and height attributes and fall back to `remote` for any shot with",
        "no local file.",
        "",
        "Files live at public/assets/apps/.",
      ],
      syncedAt: localDay(),
      shotBox: SHOT_W,
      iconBox: ICON_W,
      source: "https://itunes.apple.com/lookup (App Store listing artwork)",
      apps,
    },
    null,
    2
  ) + "\n"
);

const total = paths.reduce((n, p) => n + statSync(p).size, 0);
console.log(
  `Wrote data/app-shots.json
  ${paths.length} file(s) mirrored to public/assets/apps/
  ${held} already held, ${fetched} downloaded
  ${(total / 1024).toFixed(1)} KB on disk, ${(total / Math.max(1, paths.length)).toFixed(0)} B average`
);
