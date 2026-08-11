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
import { BAR, MENU } from "../shared/chrome.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/** Pages with the chrome inlined rather than imported. */
const PAGES = [
  "public/index.html",
  "public/videos.html",
  "public/playlists.html",
  "public/hall.html",
  "public/404.html",
];

const BLOCKS = [
  { name: "bar", re: /<header class="bar">[\s\S]*?<\/header>/, want: BAR },
  { name: "menu", re: /<nav class="menu"[\s\S]*?<\/nav>/, want: MENU },
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
  for (const { name, re, want } of BLOCKS) {
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
