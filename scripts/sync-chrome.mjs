#!/usr/bin/env node
// Push the shared bar and menu into every hand-maintained page.
//
//   node scripts/sync-chrome.mjs           fix them
//   node scripts/sync-chrome.mjs --check   report drift, exit 1, change nothing
//
// Most of the site is generated and imports shared/chrome.mjs directly, so its
// nav cannot drift. A few pages are hand-written HTML with the bar and menu
// inlined: index, videos, playlists, hall. Those have to be kept in step, and
// "have to be kept in step by hand" has failed every time it has been tried.
//
// Adding "Every set ever" to NAV_LINKS updated 335 generated pages and silently
// missed videos.html and playlists.html, which are two of the most visited
// pages on the site. Nothing errored. The link was simply absent, and the only
// reason it was caught was a spot check.
//
// So: this rewrites those blocks from the one source. Run it after any change
// to NAV_LINKS. --check is what CI or a pre-commit hook should call.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { BAR, BAR_HOME, MENU, FOOT_NAV, FOOT_SUB, FOOT_COPY } from "../shared/chrome.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/** Pages with the chrome inlined rather than imported. */
// Every hand-maintained page. about, shops and wanted were missing, so their
// bar and menu were unguarded too; they happened to match, which is luck rather
// than a guarantee.
const PAGES = [
  "public/index.html",
  "public/videos.html",
  "public/playlists.html",
  "public/hall.html",
  "public/about.html",
  "public/shops.html",
  "public/wanted.html",
  "public/404.html",
  // ADDED 24 AUGUST 2026, and it was already relying on this list without being
  // on it. FIVE builders slice the bar straight out of public/index.html --
  // about, hall, shops, wanted and garbage-plate -- and the first four are
  // listed above, so whatever they sliced gets overwritten from the shared
  // source here afterwards. garbage-plate was not, so it kept whatever
  // index.html happened to hold.
  //
  // That was invisible until index.html's bar stopped being identical to
  // everyone else's: BAR_HOME wraps the brand in an h1, garbage-plate sliced
  // it, and that page shipped with TWO h1 elements. Caught by counting h1 tags
  // across all 1,491 built pages rather than by looking at the page.
  "public/garbage-plate.html",
  // ADDED 27 AUGUST 2026, ON ITS FIRST BUILD, FOR THE REASON DIRECTLY ABOVE.
  // /privacy.html is the sixth builder that slices the bar out of index.html,
  // so it inherited BAR_HOME's h1 around the brand and shipped with TWO h1
  // elements exactly as garbage-plate did. Caught the same way, by counting
  // them on the built page rather than by looking at it. A builder that slices
  // index.html belongs on this list in the same commit that creates it.
  "public/privacy.html",
];

const BLOCKS = [
  { name: "bar", re: /<header class="bar">[\s\S]*?<\/header>/, want: BAR },
  /* THE COPYRIGHT LINE, ADDED 27 AUGUST 2026 WITH THE PRIVACY LINK IN IT.
     MATCHES UP TO THE FIRST <br> AND NO FURTHER, which is the whole care
     required here: everything after that break is the page's own `extra`
     sentence, different on all nine of these pages, and a block that swallowed
     it would replace nine distinct disclaimers with one. Anchored on the entity
     and the year span rather than on the text between them, so the line can be
     reworded without the regex going quietly non-matching, which is the failure
     mode that leaves a sync passing while it syncs nothing. */
  { name: "foot-copyright",
    re: /<p>&copy; <span id="year">\d{4}<\/span> Garbage Rips 585[\s\S]*?(?=<br>)/,
    want: FOOT_COPY },
  { name: "menu", re: /<nav class="menu"[\s\S]*?<\/nav>/, want: MENU },
  // See checkDrift: the footer is where the drift actually happened.
  {
    name: "foot-nav",
    re: /<nav class="foot-nav"[\s\S]*?<\/nav>/,
    want: FOOT_NAV,
  },
  // The footer Subscribe block, added 17 August 2026. See FOOT_SUB in
  // shared/chrome.mjs for what it is and why it carries a reason.
  //
  // ANCHORED ON ITS NEIGHBOURS RATHER THAN ON ITSELF, because on the first run
  // these eight pages do not have it yet: there is nothing of its own to match.
  // What they all do have is the footer nav directly above and .foot-social
  // directly below, so the block is defined as everything between the two.
  //
  // `(?:(?!<\/nav>)[\s\S])*?` IS THE WHOLE TRICK AND A PLAIN `[\s\S]*?` IS WRONG
  // HERE. Three navs close before .foot-social does (the bar's Primary, the menu
  // panel, then the footer's). A lazy any-character run would start at the FIRST
  // </nav> on the page and swallow the menu and the footer nav with it, which
  // deletes the entire site navigation from all eight pages and still looks like
  // a successful sync. Refusing to cross a </nav> forces the match to begin at
  // the LAST one before .foot-social, which is the footer nav's.
  {
    name: "foot-sub",
    re: /<\/nav>(?:(?!<\/nav>)[\s\S])*?<div class="foot-social">/,
    want: `</nav>\n    ${FOOT_SUB}\n    <div class="foot-social">`,
  },
];

const norm = (s) => s.replace(/\s+/g, " ").trim();

let drifted = 0;
let fixed = 0;
const notes = [];

for (const rel of PAGES) {
  let html;
  try {
    html = await readFile(join(ROOT, rel), "utf8");
  } catch {
    notes.push(`  ${rel}: not found, skipped`);
    continue;
  }

  let next = html;
  const changed = [];
  for (const { name, re, want: wantBase } of BLOCKS) {
    // THE HOME PAGE TAKES A DIFFERENT BAR, AND ONLY THE HOME PAGE.
    // BAR_HOME wraps the brand lockup in an h1, because /index.html is the one
    // page whose own h1 was sr-only and the lockup is already the visible title
    // it never had. Every other page here has an h1 in <main>; giving them this
    // one would leave them with two. See BAR_HOME in shared/chrome.mjs.
    //
    // THIS IS ALSO WHY EDITING public/index.html BY HAND DID NOT STICK. This
    // script rewrites the bar from the shared source and runs TWICE in
    // build-all.mjs, so an h1 added to the file itself was silently reverted
    // on the next build with no error. The header is not hand-maintained even
    // though the page around it is.
    const want = name === "bar" && rel === "public/index.html" ? BAR_HOME : wantBase;
    const found = re.exec(next)?.[0];
    if (!found) {
      notes.push(`  ${rel}: no ${name} block`);
      continue;
    }
    if (norm(found) === norm(want)) continue;
    changed.push(name);
    next = next.replace(re, () => want);
  }

  if (!changed.length) continue;
  drifted++;
  if (CHECK) {
    notes.push(`  ${rel}: ${changed.join(" and ")} out of date`);
  } else {
    await writeFile(join(ROOT, rel), next);
    fixed++;
    notes.push(`  ${rel}: rewrote ${changed.join(" and ")}`);
  }
}

console.log(notes.length ? notes.join("\n") : "  all pages already match shared/chrome.mjs");

if (CHECK && drifted) {
  console.error(`\n${drifted} page(s) have drifted. Run: node scripts/sync-chrome.mjs`);
  process.exit(1);
}
if (!CHECK) console.log(`\n${fixed} of ${PAGES.length} pages updated`);
