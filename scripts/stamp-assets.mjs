#!/usr/bin/env node
// Stamp every CSS and JS link in public/ with a hash of the file it points at.
//
//   node scripts/stamp-assets.mjs
//
// RUN LAST, after every builder. It rewrites the built HTML, so anything that
// regenerates a page afterwards undoes it.
//
// WHY THIS EXISTS AS A SEPARATE PASS. The stylesheet link used to be a bare
// /assets/ui.css. A browser holding an older copy kept using it after a deploy,
// which is invisible for a colour change and breaks a page outright for a new
// component: the hits grid shipped its markup and its CSS in the same commit,
// and anyone with a cached ui.css got the markup with none of the rules. It
// rendered as one full-width list item per card with a 245px scan stretched
// across the viewport, which looks exactly like a layout bug and was not one.
//
// shared/chrome.mjs stamps the pages it generates, but not every page comes
// from there: index.html is hand maintained, and several builders write their
// own head. Chasing each one leaves the next new builder to forget again.
// Doing it here means the guarantee holds for every file in public/, however
// it was produced.
//
// WHAT THIS DOES NOT SOLVE. The HTML itself is still cached by whatever rules
// the host sends; GitHub Pages revalidates HTML on each request, so a new
// deploy is picked up, and because the HTML carries the new hashes the assets
// come with it. The chain only works in that order: HTML fresh, assets keyed
// to content. Never add a far-future cache header to the HTML.
//
// IT ALSO STRIPS THE COMMENTS OUT OF EVERY INLINE <style> BLOCK, and that is a
// second job in one pass rather than a second pass, for the reason the four
// paragraphs above give about the ?v= stamp: this is the only step that sees
// every file in public/ however it was produced, and it runs last, so nothing
// regenerates a page after it.
//
// WHY IT IS HERE RATHER THAN IN THE BUILDERS. build-css.mjs already makes this
// trade for ui.css and twenty-two builders make it again for their own page CSS
// with a private regex copy of it, so the argument is settled; what was not
// settled is the pages that no builder edit can reach. Measured at HEAD on
// 21 August 2026 across all 1,487 built files, 1,488 inline blocks, whole
// document, gzip -9c < file:
//
//   2,694,105 raw bytes of comments and the blank lines they left, 37.8% of all
//   inline CSS on the site, 1,325.1KB of it gzipped, 8.07% of ALL the HTML this
//   site serves. 1,062 pages move; 2 move by 2 bytes the wrong way.
//
//   /pokemon/ x1026   1,237 B/page gzipped   11.05% of the document
//   root      x30     1,706 B/page            8.57%
//   /games/   x6        701 B/page            5.71%
//   rip, sets, playlists, openings, retailers: nothing. They already strip.
//
// and the shape of that number is why a central strip wins:
//
//   - 1,026 /pokemon/ pages carry 1,237 gzipped bytes each, from
//     build-pokemon.mjs, which has no miniCSS. That is 93% of the whole saving
//     in one builder.
//   - THE BIGGEST PER-PAGE WINS BELONG TO NO BUILDER AT ALL. about, shops,
//     wanted, hall and garbage-plate take their head by SLICING index.html, so
//     they each ship build-proto.mjs's homeCss comments verbatim, 5,289 raw
//     bytes of prose about a band none of them render. No edit to those five
//     builders could remove it.
//   - base-set (7,089 gz), hall (5,178) and rarity (3,132) are the three
//     largest single pages and all three are owned by builders a given pass may
//     not be allowed to touch.
//   - Nothing new has to remember. The next builder is covered by construction,
//     which is the same sentence the ?v= argument above already makes.
//
// THE ARGUMENTS ARE NOT LOST AND THAT IS THE CONDITION OF DOING IT HERE. This
// rewrites the GENERATED page and never the source, so every comment stays in
// the builder, next to the rule it explains, where somebody editing reads it.
// Nothing in assets-source/ or scripts/ changes.
//
// IT USES build-css.mjs's TOKENIZER, NOT A REGEX, and that is not fastidiousness.
// A regex comment-stripper treats a /* inside a quoted value as an open comment
// and eats CSS to the next */ anywhere in the file, and this repo shipped a
// stray */ that silently ate a rule on 14 pages two commits before this one.
// strip() runs lintComments() first, so a block that cannot be parsed stops the
// build with the page named rather than emitting a healthy byte count over a
// broken stylesheet. All 1,488 blocks pass today.
//
// ============================================================================
// THIS WAS ASKED FOR AS AN LCP FIX AND IT IS NOT ONE ON A COLD LOAD. READ THIS
// BEFORE QUOTING THE PARAGRAPH ABOVE AT ANYBODY.
//
// The case made for it was that the LCP element on the Pokemon pages, the set
// guides and the root guides is a paragraph of TEXT, so LCP equals FCP and "is
// gated by exactly two things: the document bytes, and the render-blocking
// stylesheets". The first half of that is right and was re-confirmed: LCP is
// P.lede on all three families and LCP == FCP to the millisecond on every run.
// THE SECOND HALF IS WRONG, and it is wrong in a way that is worth writing down
// because it is where the site's next real paint win actually is.
//
// Driven in headless Chrome over CDP at 390x844, Slow 3G (400ms / 400kbps),
// 4x CPU, cache off, medians of 9, against the two trees on two ports:
//
//                        doc gz     doc arrives          LCP
//   /base-set.html       -7,089    1,289 -> 821ms   2,456 -> 2,500ms
//   /pokemon/charizard   -1,250      733 -> 700     2,880 -> 2,868
//   /sets/151.html (0 byte control)  763 -> 762     2,616 -> 2,628
//
// The document lands 468ms earlier on the biggest page and the paint does not
// move at all. The waterfall says why in one line: the last render-blocking
// resource is /assets/ui.css, 21,209 bytes, and it lands at 2,338ms, which is
// 1,226ms AFTER the document has finished. The preload scanner finds it in the
// first KB of the head and it then takes the whole of a throttled pipe. The
// inline <style> IS render blocking, but it rides in with the document and is
// never the LAST render-blocking thing, so shrinking it cannot move the paint.
// THE PAINT ON THIS SITE IS GATED BY ui.css ALONE. If somebody wants an LCP
// win on the text pages, that is the file to attack, and CLAUDE.md's "a
// kilobyte here is worth more than a kilobyte anywhere else" is now measured
// rather than asserted.
//
// AND THEN THE WIN SHOWS UP ON THE SECOND PAGE OF THE VISIT, which is the
// condition nobody measured and is the common one: a reader who arrived on the
// home page, and a crawler walking 1,487 urls. ui.css, fonts.css and the woff2
// files are content-hashed and immutable -- that is what the ?v= stamp above
// exists for -- so on page two they come from cache, the document is the ONLY
// thing on the critical path, and the bytes convert almost 1:1 into paint:
//
//   warm cache, Slow 3G, after /index.html      LCP before -> after
//     /base-set.html                              744 -> 632ms   -112ms, -15%
//     /pokemon/charizard.html                     604 -> 560ms    -44ms,  -7%
//     /sets/151.html (0 byte control)             564 -> 564ms      0ms
//   warm cache, Slow 4G
//     /base-set.html                              276 -> 248ms    -28ms, -10%
//     /sets/151.html (0 byte control)             236 -> 236ms      0ms
//
// The noise floor for those numbers is 0 to 8ms, taken by running the SAME tree
// against itself on both ports, which is the check that makes the rest of them
// mean anything.
//
// NOTHING RENDERS DIFFERENTLY AND THAT WAS MEASURED, NOT REASONED. 121 pages
// across every family at 390 and 1440, 244,066 elements, each compared on 108
// computed properties plus its box plus ::before and ::after: 236 of 242
// page-width runs byte-identical, and all 6 that were not reproduce when a tree
// is compared AGAINST ITSELF (lore.html's SVG bars are mid-animation, the two
// /games/ pages pick a random question, and the /playlists/ pack-hint is a
// running transition -- and those playlist FILES are byte-identical in both
// trees, so they cannot have changed). CSSOM rule counts, counted recursively
// so a media block's children count too: 306,582 -> 306,582, zero mismatches on
// any page at either width. That is the check that proves the stripper took
// comments and not rules.
// ============================================================================

import { createHash } from "node:crypto";
import { GA4_ID, SEARCH_CONSOLE } from "../shared/analytics.mjs";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { strip } from "./build-css.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "public");

const hashes = new Map();
async function hashOf(rel) {
  if (!hashes.has(rel)) {
    try {
      hashes.set(rel, createHash("sha1").update(await readFile(join(PUB, rel))).digest("hex").slice(0, 8));
    } catch {
      hashes.set(rel, null); // asset does not exist; leave the link alone
    }
  }
  return hashes.get(rel);
}

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith(".html")) yield p;
  }
}

// Matches href/src on an asset under /assets/, with or without an existing ?v=,
// so re-running is idempotent and a changed file gets a changed stamp.
//
// THE THREE ROOT ICONS ARE IN HERE TOO, ADDED 24 AUGUST 2026, AND THEY ARE THE
// ONLY FILES THIS STAMPS THAT DO NOT LIVE UNDER /assets/. The owner: "my devices
// are cached and showing the old ones want to make sure they are updated". The
// files on disk were correct and had been since 23 August; what was missing was
// any way for a browser to find that out. Every stylesheet and script on this
// site carries a content hash and these three carried nothing, so a reader who
// had ever loaded the site kept the old mark.
//
// A FAVICON IS THE WORST CASE FOR THIS, NOT AN ORDINARY IMAGE. Browsers cache
// icons far more aggressively than they cache anything else and routinely hold
// one past its own cache headers, and the tab icon is the thing a returning
// reader recognises the site by. og:image already carried a hand-typed ?v=2,
// which is the same fix done manually once and then never moved again; these
// are hashed, so they update themselves whenever the artwork does.
const RE = /(href|src)="(\/(?:assets\/[^"?]+\.(?:css|js)|favicon\.ico|favicon-32\.png|apple-touch-icon\.png))(\?v=[a-f0-9]+)?"/g;

// THE SHARE CARDS, ADDED 24 AUGUST 2026, AND THEY ARE THE REASON THIS PASS
// EXISTS AT ALL RATHER THAN A TIDY-UP. og:image and twitter:image are absolute
// urls in a content="" attribute, so the /assets/ rule above cannot see them,
// and every one of the 1,412 pages that carries one carried a HAND-TYPED
// "?v=2". That number was written once and never moved again, so when the 22
// share cards were rebuilt on 24 August the url did not change, and a link
// preview scraper keys its cache on the url. Facebook, iMessage and Slack
// would each have gone on serving the OLD card for as long as they felt like
// it, on the one asset whose entire job is to be seen by somebody who has
// never been to the site.
//
// THIS IS THE FAVICON BUG ON A SECOND ASSET and it was found the same way: by
// fetching the live file, confirming it was the new one, and then reading the
// tag that points at it. A correct file behind a stale url looks exactly like
// a broken deploy from the outside.
//
// The origin is stripped before hashing because hashOf() takes a path under
// public/, and it is put back unchanged, so this is agnostic to whether
// shared/site.mjs is pointing at the Pages host or the real domain.
// IT MATCHES THE URL WHEREVER IT IS QUOTED, not just in content="". The first
// version anchored on content= and left TWELVE behind, all of them the "image"
// field inside the Organization JSON-LD on the eight pages that build their
// head by slicing index.html. That is the SAME picture addressed by a SECOND
// url on the SAME page, one stamped and one not, which is worse than leaving
// both alone: a crawler reading the structured data and a scraper reading the
// meta tag would have disagreed about which file they were looking at. The
// path is specific enough (/assets/og-*.jpg) that no other quoted string on
// the site can match it.
const OG = /"(https?:\/\/[^"]*?)(\/assets\/og-[^"?]+\.(?:jpg|png))(\?v=[^"]*)?"/g;

// The inline blocks. Lazy, so the first </style> after an opening tag ends the
// block, which is what the parser does too. A <style> written INSIDE a CSS
// comment is therefore consumed as content rather than opening a second block:
// there is one on /hall.html today and it is the reason this is written down.
const STYLE = /<style([^>]*)>([\s\S]*?)<\/style>/g;

// strip() drops blank lines and trims, then adds a closing newline for a
// standalone .css file. An inline block does not want that byte: without the
// trim, 96 already-minified pages get ONE byte BIGGER, which is a change that
// costs something on a page it cannot pay back on.
//
// The error is re-thrown with the page named because lintComments() reports
// against assets-source/ui.css, which is the wrong file to send somebody to
// when the fault is in a builder's template literal.
function stripInlineCSS(html, name) {
  return html.replace(STYLE, (whole, attrs, css) => {
    let out;
    try {
      out = strip(css).trim();
    } catch (err) {
      throw new Error(`inline <style> in public/${name} did not parse:\n\n${err.message}`);
    }
    return `<style${attrs}>${out}</style>`;
  });
}

let files = 0;
let stamped = 0;
let cssBefore = 0;
let cssAfter = 0;
for await (const f of walk(PUB)) {
  const raw = await readFile(f, "utf8");
  const src = stripInlineCSS(raw, relative(PUB, f));
  cssBefore += Buffer.byteLength(raw);
  cssAfter += Buffer.byteLength(src);
  let changed = src !== raw;
  const out = [];
  let last = 0;
  for (const m of src.matchAll(RE)) {
    const v = await hashOf(m[2].replace(/^\//, ""));
    if (!v) continue;
    const want = `${m[1]}="${m[2]}?v=${v}"`;
    if (m[0] !== want) {
      out.push(src.slice(last, m.index), want);
      last = m.index + m[0].length;
      changed = true;
      stamped += 1;
    }
  }
  if (changed) {
    out.push(src.slice(last));
    await writeFile(f, out.join(""));
    files += 1;
  }
}

// SECOND PASS FOR THE SHARE CARDS. Separate from the loop above rather than
// folded into one regex, because these are absolute urls in a content=""
// attribute and the two rewrites have nothing in common but the hash lookup.
// Run over the files as they now stand on disk, so a page rewritten above is
// read back with its stylesheet stamps already in it.
let ogStamped = 0;
for await (const f of walk(PUB)) {
  const src = await readFile(f, "utf8");
  let changed = false;
  const out = [];
  let last = 0;
  for (const m of src.matchAll(OG)) {
    const v = await hashOf(m[2].replace(/^\//, ""));
    if (!v) continue;
    const want = `"${m[1]}${m[2]}?v=${v}"`;
    if (m[0] !== want) {
      out.push(src.slice(last, m.index), want);
      last = m.index + m[0].length;
      changed = true;
      ogStamped += 1;
    }
  }
  if (changed) {
    out.push(src.slice(last));
    await writeFile(f, out.join(""));
  }
}
if (ogStamped) console.log(`  ${ogStamped} share-card urls stamped`);

console.log(`Stamped ${stamped} asset link(s) across ${files} file(s)`);
console.log(
  `Inline CSS comments stripped: ${(cssBefore - cssAfter).toLocaleString()} bytes ` +
    `out of ${cssBefore.toLocaleString()} of HTML`
);
for (const [rel, v] of hashes) if (v) console.log(`  ${rel} -> ?v=${v}`);

// ---------------------------------------------------------------------------
// THIRD PASS: ANALYTICS AND SITE VERIFICATION
// ---------------------------------------------------------------------------
// WHY IT IS HERE AND NOT IN A BUILDER. There is no shared head() on this site:
// every one of the 66 builders writes its own <head>, and index.html's is hand
// maintained on top of that. Adding a snippet builder by builder would be 66
// edits with 66 chances to miss one, and the one missed would be invisible --
// a page that quietly reports nothing looks exactly like a page nobody visits.
// This step already runs LAST over every built file however it was produced,
// which is the same argument the inline-CSS strip makes in its own header.
//
// NOTHING IS EMITTED UNTIL AN ID IS SET. Both constants are "" in
// shared/analytics.mjs, so today this pass is a no-op and the tree is byte for
// byte what it was. That is deliberate: the diff that turns tracking on should
// be a one-line diff that is obviously about tracking.
//
// IT IS IDEMPOTENT. A page that already carries the tag is skipped, so a
// rebuild does not stack two copies, and check-tree-drift stays honest.
//
// PLACEMENT IS THE PART WORTH ARGUING. The snippet goes immediately before
// </head>, which puts it AFTER the render-blocking stylesheet link. CLAUDE.md
// records that first paint on this site is gated by ui.css alone, arriving
// 1,226ms after the document on Slow 3G, so a script that jumped the queue in
// front of it would cost real paint time for nothing. `async` on top of that
// means it never blocks the parse. No preconnect: it would buy a few ms of
// analytics latency in exchange for an early connection to a third party, on a
// page whose paint is already waiting on our own file.
// IT STRIPS BEFORE IT INJECTS, AND THAT IS NOT TIDINESS. The first version
// only ADDED, guarded by "skip a page that already has the tag", and that was
// wrong in a way that took a test with fake ids to show. public/index.html is
// HAND MAINTAINED and COMMITTED, so a tag written into it is written into the
// repo; and eight pages (about, shops, wanted, hall, garbage-plate, videos,
// playlists and index itself) build their <head> by SLICING index.html, so on
// the next build they copied the tag out of it. Setting the ids back to "" then
// left the tag live on all eight, because a pass that only adds can never take
// anything away. Turning tracking OFF has to actually turn it off.
//
// So the block is fenced in markers and every page has the fence removed first,
// unconditionally, whether or not an id is set. Inject-after-strip is also what
// makes a CHANGED id work: pasting a new G- id replaces the old one rather than
// leaving two configs racing on the same page.
const GA_OPEN = "<!--analytics:start-->";
const GA_CLOSE = "<!--analytics:end-->";
const GA_FENCE = /<!--analytics:start-->[\s\S]*?<!--analytics:end-->/g;

{
  const verify = SEARCH_CONSOLE
    ? `<meta name="google-site-verification" content="${SEARCH_CONSOLE}">`
    : "";
  const ga = GA4_ID
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>` +
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}` +
      `gtag('js',new Date());gtag('config','${GA4_ID}');</script>`
    : "";
  const block = verify || ga ? GA_OPEN + verify + ga + GA_CLOSE : "";
  let injected = 0;
  let cleaned = 0;
  for await (const f of walk(PUB)) {
    const src = await readFile(f, "utf8");
    const bare = src.replace(GA_FENCE, "");
    if (bare !== src) cleaned += 1;
    let out = bare;
    if (block) {
      const i = bare.indexOf("</head>");
      if (i !== -1) {
        out = bare.slice(0, i) + block + bare.slice(i);
        injected += 1;
      }
    }
    if (out !== src) await writeFile(f, out);
  }
  if (block) {
    const what = [GA4_ID && `GA4 ${GA4_ID}`, SEARCH_CONSOLE && "site verification"]
      .filter(Boolean).join(" + ");
    console.log(`  ${what} on ${injected} pages`);
  } else if (cleaned) {
    console.log(`  analytics removed from ${cleaned} pages (no id set)`);
  }
}
