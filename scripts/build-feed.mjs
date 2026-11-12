#!/usr/bin/env node
// Write public/feed.xml, an Atom feed of the 30 newest rips.
//
//   node scripts/build-feed.mjs
//
// WHY A FEED. The site ships a new rip page most days and had no way to say so
// except the sitemap, which a person cannot subscribe to and a crawler reads on
// its own schedule. A feed is the one format a feed reader, a "new posts"
// widget and a search engine's freshness crawl all already understand, and it
// costs one static file.
//
// EVERY LINK GOES TO THE RIP'S OWN PAGE ON THIS SITE, never to youtube.com.
// That is the rule every video tile on the site follows (CLAUDE.md), and a
// feed is a list of video tiles with the pictures turned off.
//
// THE ENTRY IS READ BACK OFF THE BUILT PAGE, NOT RECOMPOSED. The title, the
// summary and the image are the page's own <title>, <meta name="description">
// and og:image, taken out of public/rip/<page>.html after build-pages.mjs has
// written it. build-pages.mjs spends about 150 lines deciding what a rip's
// description is (the owner's text, cleaned, clipped at a sentence, or a
// composed line when the description says nothing), and a second copy of that
// logic here would drift from it the first time either changed. Reading the
// page means the feed cannot say anything about a rip that its page does not.
// An image is listed only when the file it names exists under public/.
//
// ATOM, NOT RSS 2.0. Atom requires an id and an updated stamp per entry, in a
// date format with one legal spelling, and both are things this data already
// has exactly: the page's canonical url and the video's publishedAt.
//
// NOTHING IN IT IS THE BUILD CLOCK. <updated> on the feed is the newest rip's
// publish time, so two builds of the same data write the same bytes and the
// file only changes when a rip is added.
//
// ORDER IN build-all.mjs: after build-pages.mjs (it reads the rip pages) and
// before stamp-assets.mjs, with the other root files that are not pages.
import { readFile, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const HOW_MANY = 30;

const xml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // XML 1.0 has no spelling for most control characters, escaped or not.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

// The five entities esc() in shared/format.mjs can write into a head, undone.
const unhtml = (s) =>
  String(s ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, "&");

// Each value is read with a backreference to the quote that opened it, for the
// reason scripts/seo-sweep.py gives: a double-quoted description containing an
// apostrophe must not stop at the apostrophe.
const metaContent = (head, attr, name) => {
  const tag = new RegExp(`<meta\\b[^>]*\\b${attr}=(["'])${name}\\1[^>]*>`, "i").exec(head)?.[0];
  const m = tag && /\bcontent=(["'])([\s\S]*?)\1/i.exec(tag);
  return m ? unhtml(m[2]) : "";
};

const exists = (p) => access(p).then(() => true, () => false);

const { videos } = JSON.parse(await readFile(join(PUBLIC, "data/videos.json"), "utf8"));
const isStamp = (s) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(String(s || ""));
const newest = videos
  .filter((v) => v.path && isStamp(v.publishedAt))
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  .slice(0, HOW_MANY);

const entries = [];
let skipped = 0;
for (const v of newest) {
  const file = join(PUBLIC, v.path);
  if (!(await exists(file))) {
    skipped++;
    continue;
  }
  const html = await readFile(file, "utf8");
  const head = html.slice(0, html.indexOf("</head>"));
  const title = unhtml(/<title>([\s\S]*?)<\/title>/i.exec(head)?.[1] || "").trim();
  const summary = metaContent(head, "name", "description").trim();
  if (!title || !summary) {
    skipped++;
    continue;
  }
  // The share card the page names, kept only if that file is really there.
  const og = metaContent(head, "property", "og:image");
  const ogPath = og.startsWith(`${SITE}/`) ? og.slice(SITE.length).split("?")[0] : "";
  const image = ogPath && (await exists(join(PUBLIC, ogPath))) ? og : "";
  entries.push({ url: `${SITE}/${v.path}`, title, summary, image, when: v.publishedAt });
}

if (!entries.length) {
  console.error("build-feed: no rip page could be read, so public/feed.xml was not written. Run build-pages.mjs first.");
  process.exit(1);
}

const out = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Garbage Rips 585: new rips</title>
  <subtitle>The newest Pokemon pack rips from Garbage Rips 585 in Rochester, NY. Every entry opens the rip's own page on garbagerips.com.</subtitle>
  <id>${xml(`${SITE}/feed.xml`)}</id>
  <link rel="self" type="application/atom+xml" href="${xml(`${SITE}/feed.xml`)}"/>
  <link rel="alternate" type="text/html" href="${xml(`${SITE}/videos.html`)}"/>
  <updated>${xml(entries[0].when)}</updated>
  <author>
    <name>Garbage Rips 585</name>
    <uri>${xml(`${SITE}/`)}</uri>
  </author>
  <icon>${xml(`${SITE}/favicon-32.png`)}</icon>
  <logo>${xml(`${SITE}/assets/og-image.jpg`)}</logo>
${entries
  .map(
    (e) => `  <entry>
    <title>${xml(e.title)}</title>
    <link rel="alternate" type="text/html" href="${xml(e.url)}"/>
    <id>${xml(e.url)}</id>
    <published>${xml(e.when)}</published>
    <updated>${xml(e.when)}</updated>
    <summary>${xml(e.summary)}</summary>${
      e.image ? `\n    <link rel="enclosure" type="image/jpeg" href="${xml(e.image)}"/>` : ""
    }
  </entry>`,
  )
  .join("\n")}
</feed>
`;

await writeFile(join(PUBLIC, "feed.xml"), out, "utf8");
console.log(
  `Wrote public/feed.xml  ${entries.length} rips, newest ${entries[0].when.slice(0, 10)}, ` +
    `${entries.filter((e) => e.image).length} with an image${skipped ? `, ${skipped} skipped (no page or no description)` : ""}`,
);
