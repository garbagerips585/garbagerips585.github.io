#!/usr/bin/env bash
# One network sync step of the nightly, with last-good semantics.
#
#   bash scripts/nightly-step.sh "<what the owner should know>" [path ...] -- <command ...>
#
# WHY THIS EXISTS. From 4 to 8 November 2026 the YouTube step failed nightly and,
# being a hard step, stopped every price refresh queued behind it. Making a step
# `continue-on-error` fixes the blast radius but leaves two holes: a script that
# dies half way can leave a half-written data file for the build to read, and
# nobody is told which step it was. This wrapper closes both, in one place, with
# no `if:` expression in the workflow to mistype:
#
#   1. It runs the command and passes its output through untouched.
#   2. If the command fails, every <path> is put back to the copy in HEAD (the
#      last good one), and files the step created that HEAD does not have are
#      removed. The build then runs on last night's data for that source.
#   3. The sentence is appended to the notes file the alert step reads, and
#      printed as a ::warning on the run.
#   4. It exits with the command's own code, so the workflow step still shows
#      as failed. The step carries `continue-on-error: true`, which is what
#      keeps the job going.
#
# A path may be a file, a directory, or a git exclude pathspec such as
# ':(exclude)public/data/cards/30th-celebration.json'. Give no paths for a
# script that keeps its own last good copy and must not be rolled back.
#
# KEEP_IF_LOGGED (optional env): a literal piece of text the command prints only
# AFTER it has written everything. Some scripts write a complete, consistent set
# of files and THEN exit 1 to flag one bad input (sync-cards.mjs does this when a
# checklist came back smaller: it keeps the old file for that set and says so).
# Rolling those back would throw away a good night because of one set. If the
# text is in the output, the files are kept and only the note is raised.
set -u

note=${1:?usage: nightly-step.sh "<note>" [path ...] -- <command ...>}
shift
paths=()
while [ $# -gt 0 ] && [ "$1" != "--" ]; do paths+=("$1"); shift; done
if [ "${1:-}" != "--" ] || [ $# -lt 2 ]; then
  echo "usage: nightly-step.sh \"<note>\" [path ...] -- <command ...>" >&2
  exit 64
fi
shift

# Outside the repository on purpose: the commit step runs `git add -A`.
NOTES="${NIGHTLY_NOTES:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/nightly-notes.txt}"

log=$(mktemp)
"$@" 2>&1 | tee "$log"
code=${PIPESTATUS[0]}
if [ "$code" -eq 0 ]; then rm -f "$log"; exit 0; fi

kept=""
if [ -n "${KEEP_IF_LOGGED:-}" ] && grep -qF -- "$KEEP_IF_LOGGED" "$log"; then
  kept=" (it finished writing first, so its files were kept)"
  echo "nightly-step: exit $code, but the output holds \"$KEEP_IF_LOGGED\", so the files it wrote are complete and are kept."
elif [ ${#paths[@]} -gt 0 ]; then
  pos=(); exc=()
  for p in "${paths[@]}"; do
    case "$p" in
      ':(exclude)'*|':!'*) exc+=("$p") ;;
      *) pos+=("$p") ;;
    esac
  done
  # Only what HEAD actually holds can be checked out; a path it lacks is a
  # pathspec error that would abort the whole restore.
  inhead=()
  for p in ${pos[@]+"${pos[@]}"}; do
    if [ -n "$(git ls-tree -r --name-only HEAD -- "$p" | head -1)" ]; then inhead+=("$p"); fi
  done
  if [ ${#inhead[@]} -gt 0 ]; then
    git checkout HEAD -- "${inhead[@]}" ${exc[@]+"${exc[@]}"}
  fi
  if [ ${#pos[@]} -gt 0 ]; then
    git clean -fdq -- "${pos[@]}" ${exc[@]+"${exc[@]}"}
  fi
  echo "nightly-step: exit $code. Put back from HEAD (last good): ${pos[*]}"
fi
rm -f "$log"

echo "$note$kept" >> "$NOTES"
echo "::warning title=Nightly step failed::$note$kept"
exit "$code"
