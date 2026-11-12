#!/usr/bin/env bash
# One GitHub issue per kind of trouble: open or comment when it is bad, close
# when it is good again. GitHub emails issue activity to the repository's
# watchers, which is the whole alerting mechanism; there is no outside service.
#
#   bash scripts/alert-issue.sh "<issue title>" "<what is wrong>"   bad: comment, or open
#   bash scripts/alert-issue.sh "<issue title>" ""                  good: close if open
#
# Needs GH_TOKEN (a token with issues: write) and REPO (owner/name), and the
# `gh` CLI, which GitHub's runners carry. RUN_URL is appended when set.
# ALERT_DRY_RUN=1 prints what it would do and calls nothing.
#
# IT NEVER FAILS. An alert that cannot be sent must not turn a green job red:
# the nightly's deploy is gated on the job's conclusion. Every path exits 0.
#
# The titles in use, so a new one does not collide with an old one:
#   "Nightly refresh is not healthy"     refresh.yml, a failed or degraded night
#   "Nightly refresh did not commit"     verify.yml, no nightly commit for 36 hours
#   "The live site is behind main"       verify.yml, the deploy did not land
set -u

title=${1:-}
body=${2:-}
if [ -z "$title" ]; then echo "alert-issue: no title given" >&2; exit 0; fi

day=$(date +%Y-%m-%d)
run=""
if [ -n "${RUN_URL:-}" ]; then run=" Run: $RUN_URL"; fi

if [ "${ALERT_DRY_RUN:-}" = "1" ]; then
  if [ -n "$body" ]; then echo "alert-issue (dry run): would open or comment on \"$title\": $day: $body$run"
  else echo "alert-issue (dry run): would close \"$title\" if it is open"; fi
  exit 0
fi

if [ -z "${REPO:-}" ] || [ -z "${GH_TOKEN:-}" ] || ! command -v gh >/dev/null 2>&1; then
  echo "alert-issue: REPO, GH_TOKEN or the gh CLI is missing, so no issue was touched. Title: \"$title\". Body: $body"
  exit 0
fi

# The search is fuzzy, so the exact title is matched again in jq.
n=$(gh issue list -R "$REPO" --state open --search "in:title \"$title\"" --json number,title \
      --jq "[.[] | select(.title == \"$title\")][0].number // empty" 2>/dev/null) || n=""

if [ -n "$body" ]; then
  if [ -n "$n" ]; then gh issue comment "$n" -R "$REPO" --body "$day: $body$run" || true
  else gh issue create -R "$REPO" --title "$title" --body "$day: $body$run" || true; fi
elif [ -n "$n" ]; then
  gh issue close "$n" -R "$REPO" --comment "$day: all clear. Closing.$run" || true
fi
exit 0
