#!/usr/bin/env bash
# Rebuild every page for the nightly, with a degraded-night fallback.
#
#   bash scripts/nightly-build.sh node scripts/build-all.mjs
#
# The build command is given as the arguments and run exactly as given, twice
# at most. refresh.yml passes it on its run line ON PURPOSE: check-build.py
# fails the build if refresh.yml stops naming scripts/build-all.mjs (the day the
# workflow enumerated the builders itself it drifted and left six pages stale),
# and that guard should keep reading the truth off the workflow. With no
# arguments it runs the same command.
#
# WHY THIS EXISTS. On 11 November 2026 a new rarity word arrived from upstream,
# one page builder threw on it, build-all.mjs exited 1, and the job stopped with
# no commit: not even the date roll, the show sweep or the "3 days ago" labels
# moved, over one word in one synced file. The same thing happened on 13, 14
# and 15 August for a different reason.
#
# So the build gets two tries:
#
#   1. Build on tonight's freshly synced data. Normal night: done, exit 0.
#   2. If that fails, throw away EVERYTHING tonight's syncs wrote (data/ and
#      public/data/ go back to HEAD, the last committed and published copy) and
#      build again. If that passes, the night is DEGRADED but still commits and
#      deploys: dates roll, prices and videos wait for tomorrow. The failing
#      builders from the first try are named in the notes file, which the alert
#      step posts to the owner's issue.
#   3. If the second build fails as well, the fault is in the source, not in
#      tonight's data. Exit 1: no commit, red job, no deploy, as before.
#
# public/ is never merged or patched here. Whatever is committed is a complete
# build-all.mjs run over one consistent set of inputs.
set -u

if [ $# -eq 0 ]; then set -- node scripts/build-all.mjs; fi

NOTES="${NIGHTLY_NOTES:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/nightly-notes.txt}"

# Pillow is installed by a soft step. If it is missing (PyPI was down), run the
# build the way verify.yml does every day: skip the image builders and keep the
# committed images. The HTML comes out the same; see IMAGE_STEPS in
# build-all.mjs. Without this, build-og-pages.py throws and the night is lost.
if ! python3 -c "import PIL" 2>/dev/null; then
  export GR_SKIP_IMAGE_BUILDERS=1
  msg="Pillow could not be imported, so the share-card images were not redrawn tonight. The committed ones are in use."
  echo "$msg" >> "$NOTES"
  echo "::warning title=Image builders skipped::$msg"
fi

log=$(mktemp)
workbook_warning() {
  if grep -qE '^[[:space:]]+SHEET ' "$log"; then
    echo "::warning::check-build.py exit 2: the workbook needs a fix (see the build output above). The build itself is sound and is published."
  fi
}

echo "== $* on tonight's data"
"$@" 2>&1 | tee "$log"
if [ "${PIPESTATUS[0]}" -eq 0 ]; then workbook_warning; rm -f "$log"; exit 0; fi

# build-all.mjs prints "  FAIL  <command>" for each step that failed.
failed=$(grep -E '^[[:space:]]+FAIL ' "$log" | sed -E 's/^[[:space:]]+FAIL[[:space:]]+//; s/^(node|python3|bash) scripts\///' | paste -sd, - | sed 's/,/, /g')
[ -n "$failed" ] || failed="unknown (read the build output)"

echo
echo "== The build failed on tonight's data. Failing: $failed"
echo "== Going back to the last committed data and building again."
# The whole tree goes back to HEAD, not only the two data directories, and the
# files the failed build created are removed: a rip page written for a video
# that is no longer in videos.json would otherwise be committed as an orphan.
# .cache is gitignored and is left alone.
git checkout HEAD -- .
git clean -fdq -- data public

"$@" 2>&1 | tee "$log"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then
  echo "== The build also fails on the last committed data, so this is not tonight's data. Nothing is committed."
  failed2=$(grep -E '^[[:space:]]+FAIL ' "$log" | sed -E 's/^[[:space:]]+FAIL[[:space:]]+//; s/^(node|python3|bash) scripts\///' | paste -sd, - | sed 's/,/, /g')
  echo "The page build failed on tonight's data (failing: $failed) AND on the last committed data (failing: ${failed2:-unknown}), so nothing was committed or deployed. That points at the source or at a date-dependent check, not at tonight's syncs." >> "$NOTES"
  rm -f "$log"
  exit 1
fi
workbook_warning
rm -f "$log"

msg="DEGRADED NIGHT: the page build failed on tonight's fresh data (failing: $failed). Tonight's synced prices and videos were thrown away and the site was rebuilt from the last good data, so dates rolled but nothing else is new. It will keep happening nightly until that builder is fixed."
echo "$msg" >> "$NOTES"
echo "::warning title=Degraded night::$msg"
exit 0
