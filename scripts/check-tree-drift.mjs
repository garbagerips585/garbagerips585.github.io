/**
 * Does public/ match the source that is committed beside it?
 *
 * WHY THIS EXISTS. public/ is generated AND committed, so a commit can change a
 * builder and not change a single page, and everything reports success:
 * build-all exits 0 because it builds the working tree, and check-build.py
 * exits 0 because it reads public/ from disk and public/ is a perfectly good
 * build of the PREVIOUS source. Neither can see the gap between them.
 *
 * IT HAPPENED THREE TIMES ON 19 AUGUST 2026, the night before launch week.
 * Twice the whole site was stale; the third time it was 1,026 /pokemon/ pages,
 * two thirds of the site, sitting on the live domain built from a builder that
 * had since changed. Each time it was caught only because somebody happened to
 * fetch the live file instead of trusting the commit. Two of that night's
 * commit subjects are literally about the fixes not being on the site.
 *
 * The check is the obvious one and it is cheap: export HEAD to a scratch
 * directory, build it, and hash every file against the committed public/. Zero
 * differing files means the deployed tree is the source. Anything else names
 * exactly which pages are stale.
 *
 *   node scripts/check-tree-drift.mjs
 *
 * It asks only about the COMMIT: does HEAD contain the pages HEAD's own source
 * produces. The working tree is never consulted, so the answer is the same on
 * any machine and does not change while somebody is mid-edit.
 *
 * BUILDS FROM `git archive HEAD`, NOT FROM THE WORKING TREE, which is the whole
 * point: the working tree always looks right to its own author, because their
 * uncommitted edits are in it.
 *
 * SOME DRIFT IS THE CALENDAR AND NOT A MISTAKE. The build stamps today's date
 * and drops content whose day has passed: perishable rows on the home page's
 * drops band, past days on /card-shows.html's calendar. So every midnight this
 * reports one or two files, and it is RIGHT to: the committed pages really are
 * stale, and the site really would serve a drop that has already happened. The
 * nightly refresh rebuilds and commits, which clears it. If the only files
 * named are index.html and card-shows.html and the diff is expiry, that is the
 * clock. Anything else is source.
 *
 * Two steps of the build touch the network, fetch-fonts.sh and sync-symbols.mjs,
 * both no-ops once the files are held and neither fails the build without one.
 * The scratch copy has no .cache, so they fetch. If this reports drift ONLY in
 * font-hashed asset urls, suspect that rather than a real regression.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function filesUnder(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) out.push(relative(dir, join(e.parentPath || e.path, e.name)));
  }
  return out.sort();
}

const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

const tmp = mkdtempSync(join(tmpdir(), "tree-drift-"));
try {
  const tar = execFileSync("git", ["archive", "HEAD"], { cwd: ROOT, maxBuffer: 1 << 30 });
  execFileSync("tar", ["-x", "-C", tmp], { input: tar, maxBuffer: 1 << 30 });

  // THE BASELINE IS HEAD'S OWN public/, NOT THE WORKING TREE'S. Comparing
  // against the working tree makes this useless the moment anyone is editing:
  // it reports every page as drifted because an uncommitted builder change has
  // already been built into public/ locally. The question this answers is
  // "does this COMMIT contain the pages its own source produces", which is a
  // property of the commit alone and is the same answer on any machine.
  execFileSync("cp", ["-R", join(tmp, "public"), join(tmp, "__committed")]);

  console.log("building HEAD in a scratch copy...");
  try {
    execFileSync("node", ["scripts/build-all.mjs"], { cwd: tmp, stdio: "pipe" });
  } catch (e) {
    console.error("FAIL  build-all exited non-zero on a clean export of HEAD.");
    console.error(String(e.stdout || "").slice(-3000));
    process.exit(1);
  }

  const built = join(tmp, "public");
  const live = join(tmp, "__committed");
  const [a, b] = await Promise.all([filesUnder(built), filesUnder(live)]);
  const setA = new Set(a), setB = new Set(b);

  const missing = a.filter((f) => !setB.has(f));   // built but never committed
  const extra = b.filter((f) => !setA.has(f));     // committed but no longer built
  const differ = a.filter((f) => setB.has(f) && hash(join(built, f)) !== hash(join(live, f)));

  const total = missing.length + extra.length + differ.length;
  if (!total) {
    console.log(`\nno drift: ${a.length} files, public/ is exactly what HEAD builds.`);
    process.exit(0);
  }

  console.error(`\nDRIFT: ${total} file(s). public/ is not what HEAD builds, so the site is`);
  console.error("serving pages from source that has since changed. Rebuild and commit public/.");
  const show = (label, list) => {
    if (!list.length) return;
    console.error(`\n  ${label} (${list.length}):`);
    for (const f of list.slice(0, 12)) console.error(`    ${f}`);
    if (list.length > 12) console.error(`    ... and ${list.length - 12} more`);
  };
  show("stale, HEAD builds them differently", differ);
  show("built by HEAD but not committed", missing);
  show("committed but HEAD no longer builds them", extra);
  process.exit(1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
