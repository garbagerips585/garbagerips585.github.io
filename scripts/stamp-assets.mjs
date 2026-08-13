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

import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
const RE = /(href|src)="(\/assets\/[^"?]+\.(?:css|js))(\?v=[a-f0-9]+)?"/g;

let files = 0;
let stamped = 0;
for await (const f of walk(PUB)) {
  const src = await readFile(f, "utf8");
  let changed = false;
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

console.log(`Stamped ${stamped} asset link(s) across ${files} file(s)`);
for (const [rel, v] of hashes) if (v) console.log(`  ${rel} -> ?v=${v}`);
