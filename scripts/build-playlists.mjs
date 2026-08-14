#!/usr/bin/env node
// Generate a page per YouTube playlist, under public/playlists/.
//
//   node scripts/build-playlists.mjs
//
// WHY THIS EXISTS. /playlists.html rendered 22 cards whose only action was a
// link to youtube.com, on a site whose first rule is that every click stays
// here. That was a real exception, not an oversight, and the argument for it
// was that a playlist is a YouTube object: an ordered, curated run, and
// watching one in order is something YouTube does and this site did not.
//
// It does now. Every video in every playlist already has a page here, so the
// run can be shown in its own order, with the packs, and each one plays in
// place exactly as it does on the home page. The only outbound link left on
// the site is Subscribe.
//
// THE TILES ARE THE SAME COMPONENT the library and the home page use: the same
// `.v` / `.art` / `.pack` markup app.js builds in makeCard, written server side
// here. That matters twice over. It means these pages need no JavaScript to
// show their content, and it means packplayer.js picks the tiles up for free,
// because it binds to any anchor pointing at /rip/ that contains a pack.
//
// ORDER IS THE PLAYLIST'S OWN. videoIds arrives in the order Tim arranged on
// YouTube, and that order is the whole point of a playlist, so it is not
// re-sorted by date or by anything else.

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS } from "../shared/chrome.mjs";
import { labelFor } from "../shared/taxonomy.mjs";
import { slugify } from "../shared/paths.mjs";
import { esc, longDate, shortDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/playlists");

const doc = JSON.parse(await readFile(join(ROOT, "public/data/playlists.json"), "utf8"));
const { playlists } = doc;
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const byId = new Map(videos.map((v) => [v.id, v]));

/**
 * The slug for a playlist page.
 *
 * The YouTube id is NOT in the url. Playlist titles are long and descriptive
 * and the slug reads well on its own, and unlike a video title a playlist
 * title is not one of hundreds that might collide. Collisions are still
 * checked below rather than assumed away.
 */
const slugFor = (p) => slugify(p.title) || p.id.toLowerCase();

// A playlist with nothing in it is not a page. Two exist on the channel: they
// were created and never filled. They come back on their own once a video
// goes in, and until then there is nothing here to show.
const live = playlists.filter((p) => (p.videoIds || []).length > 0);

const seen = new Map();
for (const p of live) {
  const s = slugFor(p);
  if (seen.has(s)) {
    // Two playlists whose titles slugify the same would silently overwrite one
    // another's page, which is the sort of thing that is noticed months later
    // by a missing url in the sitemap. Fail instead.
    console.error(
      `Two playlists produce the slug "${s}":\n  ${seen.get(s)}\n  ${p.title}\n` +
        `Rename one on YouTube, or add the id to slugFor in this file.`,
    );
    process.exit(1);
  }
  seen.set(s, p.title);
}

/**
 * The playlist's own description, cleaned the same way a rip page cleans a
 * video description: the trailing hashtag wall is a YouTube indexing device
 * and reads as a row of link-less tokens on a web page.
 */
const cleanDesc = (s) => {
  let t = String(s || "");
  // CUT AT THE FIRST HASHTAG, not just the trailing run. A rip page's
  // description ends in a hashtag wall, so stripping the tail is enough there.
  // A playlist description does something else: three of the twenty run
  // "#pokemon #pokemoncards #pokemontcg" mid-text and then continue with a
  // block of untagged search terms ("chaos rising elite trainer box pokemon
  // etb opening series pokemon chaos rising openings..."), which is 279
  // characters of keyword stuffing on the longest one. All of it is written
  // for YouTube's index and none of it is written for a reader, and the human
  // sentences always come first.
  const tag = t.search(/#[A-Za-z]/);
  if (tag > 0) t = t.slice(0, tag);
  return t.replace(/[ \t]{2,}/g, " ").replace(/\s+$/, "").replace(/[\s\u2022|,;:-]+$/, "").trim();
};

/** First sentence or so, for the meta description. */
const clip = (s, n) =>
  s.length <= n ? s : s.slice(0, n - 3).replace(/\s\S*$/, "").replace(/[.,;:\s]+$/, "") + "...";

/**
 * Which pack skin a tile wears. Identical to the rule in app.js makeCard: a
 * video carrying several sets wears the generic multi-set wrapper rather than
 * implying the rip was only one of them.
 */
function faceSet(v) {
  const sets = v.sets || [];
  if (sets.length > 1) return "multi";
  return sets[0] || "default";
}

const packMarkup = (setId) => `<span class="pack pack--${esc(setId)} pack--tile" aria-hidden="true">
            <span class="pack-face pack-l">
              <span class="pack-art"></span>
              <span class="pack-brand">${esc(setId === "default" ? "GARBAGE RIPS" : labelFor("sets", setId) || "GARBAGE RIPS")}<small>${
                setId === "default" ? "585" : "GARBAGE RIPS 585"
              }</small></span>
              <span class="pack-seal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>
            </span>
          </span>`;

const clock = (sec) =>
  sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "";

const compactViews = (n) =>
  !n ? "" : n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M VIEWS`
    : n >= 1000 ? `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "")}K VIEWS`
    : `${n} VIEWS`;

/**
 * The visible label for a tile, disambiguated within THIS page.
 *
 * ripLabel reduces a title to set plus product plus pack number, which is
 * exactly right in a mixed grid and collides badly inside a playlist: Tim
 * opened nine Chaos Rising ETBs, so nine tiles on that one page all read
 * "Chaos Rising ETB #2", each linking to a different video. Nine identical
 * links is a usability problem for everyone and an accessibility one for a
 * screen reader working from a link list.
 *
 * The upload date is the differentiator, because it is a fact already held and
 * it is the thing that actually separates the runs. Only repeats get it, so
 * the pages where every label is already distinct stay clean.
 */
function labelsFor(vids) {
  const count = new Map();
  for (const v of vids) {
    const l = v.label || v.siteTitle || v.title;
    count.set(l, (count.get(l) || 0) + 1);
  }
  // The date is not always enough. Two Perfect Order videos went up on the same
  // day and label the same, so the date left them still identical. Where that
  // happens the tile falls back to the video's own full title, which is the
  // real name and is always distinct. Longer, and correct beats tidy.
  const dated = new Map(
    vids.map((v) => {
      const l = v.label || v.siteTitle || v.title;
      return [v.id, count.get(l) > 1 && v.published ? `${l} (${shortDate(v.published)})` : l];
    }),
  );
  const after = new Map();
  for (const t of dated.values()) after.set(t, (after.get(t) || 0) + 1);
  return new Map(
    vids.map((v) => [
      v.id,
      after.get(dated.get(v.id)) > 1 ? v.siteTitle || v.title : dated.get(v.id),
    ]),
  );
}

function tile(v, labels) {
  const sets = v.sets || [];
  const meta = [
    sets.length > 1
      ? `${String(labelFor("sets", sets[0]) || sets[0]).toUpperCase()} +${sets.length - 1}`
      : sets.length
        ? String(labelFor("sets", sets[0]) || sets[0]).toUpperCase()
        : null,
    compactViews(v.views),
  ].filter(Boolean);
  const pull = (v.pulls || [])[0];
  return `        <article class="v">
          <a class="art" href="/${esc(v.path)}" aria-label="${esc(v.siteTitle || v.title)}">
            ${packMarkup(faceSet(v))}
            ${pull ? `<span class="hit">${esc(labelFor("pulls", pull))}</span>` : ""}
            ${v.duration ? `<span class="dur">${clock(v.duration)}</span>` : ""}
            <span class="play"></span>
          </a>
          <h3><a href="/${esc(v.path)}">${esc((labels && labels.get(v.id)) || v.label || v.siteTitle || v.title)}</a></h3>
          ${meta.length ? `<p>${esc(meta.join("  \u2022  "))}</p>` : ""}
        </article>`;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

let written = 0;
let missing = 0;

for (const p of live) {
  const slug = slugFor(p);
  const vids = (p.videoIds || []).map((id) => byId.get(id)).filter(Boolean);
  missing += (p.videoIds || []).length - vids.length;
  if (!vids.length) continue;

  const desc = cleanDesc(p.description);
  const url = `${SITE}/playlists/${slug}.html`;
  const newest = vids.map((v) => v.published).filter(Boolean).sort().pop();
  const metaDesc = clip(
    desc || `${vids.length} rip${vids.length === 1 ? "" : "s"} from Garbage Rips 585, in the order they were opened.`,
    158,
  );

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Playlists", item: `${SITE}/playlists.html` },
        { "@type": "ListItem", position: 3, name: p.title },
      ],
    },
    // Every entry has a real url on this site, which is the whole reason this
    // page exists. An ItemList whose entries point nowhere is not eligible for
    // anything and 76 of them were deleted from this site for exactly that.
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: p.title,
      numberOfItems: vids.length,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement: vids.map((v, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: v.siteTitle || v.title,
        url: `${SITE}/${v.path}`,
      })),
    },
  ];

  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.title)} | Garbage Rips 585</title>
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="stylesheet" href="/assets/fonts.css">
${STYLES}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> / <a href="/playlists.html">Playlists</a> / <span>${esc(p.title)}</span>
      </nav>
      <h1>${esc(p.title)}</h1>
      <p class="lede" style="max-width:44em">${
        desc ? esc(desc) : `${vids.length} rip${vids.length === 1 ? "" : "s"}, in playlist order.`
      }</p>
      <p class="pl-stat">${vids.length} video${vids.length === 1 ? "" : "s"}${
        newest ? ` &bull; newest ${esc(shortDate(newest))}` : ""
      } &bull; click a pack to rip it open here</p>
      <div class="wall">
${(() => { const labels = labelsFor(vids); return vids.map((v) => tile(v, labels)).join("\n"); })()}
      </div>
      <p style="margin-top:var(--s5)">
        <a class="btn btn-ghost btn-sm" href="/playlists.html">All playlists</a>
        <a class="btn btn-ghost btn-sm" href="/videos.html">Every rip</a>
      </p>
    </div>
  </section>
</main>
${footer()}
${APP_JS}
</body>
</html>
`;

  await writeFile(join(OUT, `${slug}.html`), page);
  written += 1;
}

// STAMP THE PATH ONTO THE DATA, the same way sync-youtube.mjs stamps `path`
// onto every video. CLAUDE.md's reason for that applies here word for word:
// shared/paths.mjs owns the URL shape, and if the browser recomputed the slug
// from the title it would be a second implementation free to drift from this
// one, and the drift would show up as a card linking to a 404. The browser
// reads the path it is given and computes nothing.
const stamped = { ...doc, playlists: playlists.map((p) => {
  const has = (p.videoIds || []).length > 0;
  return has ? { ...p, path: `playlists/${slugFor(p)}.html` } : { ...p };
}) };
await writeFile(join(ROOT, "public/data/playlists.json"), JSON.stringify(stamped, null, 1));

console.log(`Wrote ${written} playlist pages to public/playlists/
  ${live.length} playlists with videos, ${playlists.length - live.length} empty and skipped${
    missing ? `\n  ${missing} playlist entries point at videos not in the catalogue (deleted or private), skipped` : ""
  }`);
