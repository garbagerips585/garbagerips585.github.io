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
 *   node scripts/check-tree-drift.mjs            asks about HEAD
 *   node scripts/check-tree-drift.mjs --staged   asks about the commit you are ABOUT to make
 *
 * It asks only about a COMMIT: does that commit contain the pages its own
 * source produces. The working tree is never consulted, so the answer is the
 * same on any machine and does not change while somebody is mid-edit.
 *
 * --staged EXISTS BECAUSE CHECKING HEAD IS ALWAYS ONE COMMIT TOO LATE, and an
 * adversarial pass on 20 August 2026 measured the cost: FIVE of that day's ten
 * commits contained a sentence that was true in the author's working tree and
 * false in the commit's own bytes. A packplayer.js fix was described in a commit
 * that did not contain it (another agent had restored the file from HEAD in
 * between). An alt-text correction was argued for in one commit and actually
 * shipped 81 minutes later inside an unrelated one. The lilac asset went out in
 * a data-import commit while the commit that argues for it holds only the
 * deletion it replaced. Each time the tip eventually became correct, so checking
 * HEAD said "no drift" and the false claim survived in the log.
 *
 * The same mechanism catches the subtler orphan: commit a content-hashed asset
 * without the pages whose urls embed its hash and nothing 404s, so every gate
 * passes while returning visitors keep the old file. That happened twice on 20
 * August -- packplayer.js at 13:59 and ui.css at 15:41 -- and the second one
 * cost 1,476 pages.
 *
 * It builds `git write-tree`, the index exactly as a commit would freeze it, so
 * it answers "would the commit I am about to write be internally consistent"
 * rather than "was the last one". Unstaged edits are invisible to it, which is
 * the point: they are not going in the commit either.
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

const STAGED = process.argv.includes("--staged");
/* NAMING A DRIFTED FILE IS NOT THE SAME AS EXPLAINING IT. The list of paths
   answers "is public/ stale", which is what this script is for, but when the
   answer is yes on a machine you cannot reach -- a CI runner -- the next
   question is always "different HOW", and there is no way to ask it from here.
   lore.html drifted on Linux and on no local run under any timezone, and
   without this the only way forward was guessing.
   Text only, and a few lines of it: a diff of two JPEGs helps nobody. */
const SHOW_DIFF = process.argv.includes("--diff");

// `git write-tree` freezes the index as a real tree object and prints its sha.
// It writes an object and touches nothing else -- no commit, no ref, no index
// change -- so it is safe to run mid-edit. That tree IS what `git commit` would
// record, which is the only honest thing to build when the question is whether
// the commit about to be written holds its own output.
const TREE = STAGED
  ? execFileSync("git", ["write-tree"], { cwd: ROOT, encoding: "utf8" }).trim()
  : "HEAD";
const WHAT = STAGED ? "the staged tree" : "HEAD";

const tmp = mkdtempSync(join(tmpdir(), "tree-drift-"));
try {
  const tar = execFileSync("git", ["archive", TREE], { cwd: ROOT, maxBuffer: 1 << 30 });
  execFileSync("tar", ["-x", "-C", tmp], { input: tar, maxBuffer: 1 << 30 });

  // THE BASELINE IS HEAD'S OWN public/, NOT THE WORKING TREE'S. Comparing
  // against the working tree makes this useless the moment anyone is editing:
  // it reports every page as drifted because an uncommitted builder change has
  // already been built into public/ locally. The question this answers is
  // "does this COMMIT contain the pages its own source produces", which is a
  // property of the commit alone and is the same answer on any machine.
  execFileSync("cp", ["-R", join(tmp, "public"), join(tmp, "__committed")]);

  console.log(`building ${WHAT} in a scratch copy...`);
  try {
    execFileSync("node", ["scripts/build-all.mjs"], { cwd: tmp, stdio: "pipe" });
  } catch (e) {
    // A FAILING check-build.py IS NOT A REASON THIS QUESTION CANNOT BE ANSWERED,
    // AND TREATING IT AS ONE MAKES THIS SCRIPT UNRUNNABLE FOR AS LONG AS ONE
    // SPREADSHEET CELL IS WRONG.
    //
    // Every other step in build-all WRITES into public/, so one of them failing
    // leaves a half-built tree and the comparison below would report the gap as
    // drift, which is a different fault wearing this one's name. check-build.py
    // is the exception and it is the exception BY CONSTRUCTION: it runs LAST,
    // it opens files and never writes one, so a run where it is the only
    // failing step has still produced the complete tree this script exists to
    // hash. That became load bearing the day check-build.py started failing on a
    // hit whose written rarity tier the card is not printed at: a real gate on
    // real data, on a row only the sheet's owner can correct, and it would
    // otherwise have taken the launch week's last verification step down with
    // it until he did.
    //
    // THAT PARTICULAR CASE NOW EXITS 2 RATHER THAN 1, and this block does not
    // key on that. check-build.py grew two severities the same afternoon --
    // 1 for a broken build, 2 for a wrong answer in the workbook -- so the
    // nightly could keep committing through a mistyped rarity. This script
    // tolerates BOTH, because its reason has nothing to do with how bad the
    // problem is: a step that runs last and writes nothing cannot leave a
    // half-built tree, whichever code it exits with. Keying on the severity
    // would make this script's correctness depend on a number chosen for CI's
    // benefit, which is a coupling worth not having.
    //
    // The distinction is made on the step NAME, not on the exit code, so any
    // builder failing still stops this dead.
    const log = String(e.stdout || "");
    const failed = [...log.matchAll(/^ {2}FAIL {2}(.+)$/gm)].map((m) => m[1].trim());
    const onlyTheGate = failed.length > 0 && failed.every((s) => s === "python3 scripts/check-build.py");
    if (!onlyTheGate) {
      console.error(`FAIL  build-all exited non-zero on a clean export of ${WHAT}.`);
      console.error(log.slice(-3000));
      process.exit(1);
    }
    console.log("  note: check-build.py failed on this tree and every builder ran.");
    console.log("  It writes nothing and runs last, so the tree below is complete and the");
    console.log("  drift question is still answerable. Its own report:");
    for (const line of log.split("\n").slice(-8)) console.log("    " + line);
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
    console.log(`\nno drift: ${a.length} files, public/ is exactly what ${WHAT} builds.`);
    process.exit(0);
  }

  console.error(`\nDRIFT: ${total} file(s). public/ is not what ${WHAT} builds, so the site is`);
  console.error("serving pages from source that has since changed. Rebuild and commit public/.");
  const show = (label, list) => {
    if (!list.length) return;
    console.error(`\n  ${label} (${list.length}):`);
    for (const f of list.slice(0, 12)) console.error(`    ${f}`);
    if (list.length > 12) console.error(`    ... and ${list.length - 12} more`);
  };
  show(`stale, ${WHAT} builds them differently`, differ);
  if (SHOW_DIFF) {
    const TEXT = /\.(html|css|js|json|xml|txt|svg)$/i;
    for (const f of differ.filter((x) => TEXT.test(x)).slice(0, 3)) {
      console.error(`\n  --- how ${f} differs (built vs committed, first 20 lines) ---`);
      try {
        execFileSync("diff", ["-u", join(live, f), join(built, f)], { encoding: "utf8" });
      } catch (e) {
        const lines = String(e.stdout || "").split("\n").slice(2, 22);
        for (const l of lines) console.error(`    ${l}`);
      }
    }
  }
  show(`built by ${WHAT} but not committed`, missing);
  show(`committed but ${WHAT} no longer builds them`, extra);
  process.exit(1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
