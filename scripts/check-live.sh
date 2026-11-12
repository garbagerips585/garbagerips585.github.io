#!/usr/bin/env bash
# Two questions nothing else in this repository asks:
#
#   1. Is the live site the commit at the head of main?
#   2. Has the nightly refresh committed in the last day and a half?
#
#   bash scripts/check-live.sh           read-only: prints, exits 1 if either is wrong
#   ALERT=1 bash scripts/check-live.sh   also opens, comments on or closes the two issues
#
# WHY. On 11 November 2026 a deploy sat queued for 30+ minutes during a GitHub
# incident, and in August one sat wedged for twelve days. In both cases main
# was correct, every check was green, and the site was old: nothing compared
# the two. pages.yml now writes the deployed commit's sha into build.txt in the
# uploaded artifact (it is never committed), and this reads it back.
#
# The second question is the "nightly did not commit" alarm. check-freshness
# watches data stamps on 3 day leashes; this is the faster and blunter signal,
# and it also catches a night that was skipped, cancelled or never scheduled.
#
# Env: LIVE_URL (default https://garbagerips.com/build.txt), BRANCH (main),
# GRACE_HOURS (2: a push younger than this may still be deploying),
# NIGHTLY_MAX_HOURS (36), plus what scripts/alert-issue.sh needs when ALERT=1.
set -u

LIVE_URL="${LIVE_URL:-https://garbagerips.com/build.txt}"
BRANCH="${BRANCH:-main}"
GRACE_HOURS="${GRACE_HOURS:-2}"
NIGHTLY_MAX_HOURS="${NIGHTLY_MAX_HOURS:-36}"
here=$(cd "$(dirname "$0")" && pwd)

alert() {  # alert "<title>" "<body or empty>"
  if [ "${ALERT:-}" = "1" ]; then bash "$here/alert-issue.sh" "$1" "$2"; fi
}

bad=0
now=$(date +%s)

# The freshest answer for "what is main": ask the remote, fall back to the
# checkout. A scheduled run can start hours after it was queued.
if git fetch -q origin "$BRANCH" 2>/dev/null; then ref=FETCH_HEAD; else ref=HEAD; fi
head=$(git rev-parse "$ref")
head_age_h=$(( (now - $(git log -1 --format=%ct "$ref")) / 3600 ))

# ---- 1. live equals HEAD ----------------------------------------------------
title="The live site is behind main"
tmp=$(mktemp)
code=$(curl -sS -L --max-time 20 --retry 3 --retry-delay 5 -o "$tmp" -w '%{http_code}' "$LIVE_URL?cb=$now" 2>/dev/null) || code=000
live=$(head -c 64 "$tmp" | tr -d '[:space:]')
rm -f "$tmp"

if [ "$code" = "000" ]; then
  # Could not reach the site at all from here. That is not evidence about the
  # deploy, so it neither alerts nor clears an alert.
  echo "::warning title=Live check could not run::No answer from $LIVE_URL. Nothing concluded."
elif [ "$code" = "200" ] && [ "$live" = "$head" ]; then
  echo "ok    live site is $head, the head of $BRANCH"
  alert "$title" ""
else
  if [ "$code" = "200" ] && printf '%s' "$live" | grep -qE '^[0-9a-f]{40}$'; then saw="commit $live"
  else saw="no readable build.txt (HTTP $code)"; fi
  if [ "$head_age_h" -lt "$GRACE_HOURS" ]; then
    echo "ok    live site shows $saw and $BRANCH is $head, pushed under $GRACE_HOURS hours ago: a deploy may still be in flight"
  else
    msg="The live site shows $saw but $BRANCH has been at $head for $head_age_h hours. The deploy did not land: look at the 'Deploy to GitHub Pages' workflow for a queued, failed or skipped run. An empty commit pushed to main redeploys (see DEPLOY.md)."
    echo "::error title=Live site is behind main::$msg"
    alert "$title" "$msg"
    bad=1
  fi
fi

# ---- 2. the nightly committed recently --------------------------------------
title="Nightly refresh did not commit"
last=$(git log "$ref" -1 --grep='^Nightly refresh: ' --format=%ct 2>/dev/null)
if [ -z "$last" ]; then
  # A shallow clone, or a history with no nightly commit in it. Not evidence.
  echo "::warning title=Nightly commit check could not run::No 'Nightly refresh:' commit found in this checkout's history. Nothing concluded."
else
  age_h=$(( (now - last) / 3600 ))
  if [ "$age_h" -gt "$NIGHTLY_MAX_HOURS" ]; then
    msg="The newest 'Nightly refresh:' commit on $BRANCH is $age_h hours old (limit $NIGHTLY_MAX_HOURS). The nightly did not run, was skipped, or ran and committed nothing. Look at the 'Nightly refresh' workflow, and at the JOB inside the newest run, not only the run. To run it by hand: gh workflow run \"Nightly refresh\""
    echo "::error title=Nightly refresh did not commit::$msg"
    alert "$title" "$msg"
    bad=1
  else
    echo "ok    newest nightly commit is $age_h hours old (limit $NIGHTLY_MAX_HOURS)"
    alert "$title" ""
  fi
fi

exit "$bad"
