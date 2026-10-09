#!/usr/bin/env bash
# Does the evidence check pass a summary whose every entry is `not shown`? Four summaries for one
# ticket, each run through the check, with two of them there to show the check can fail.
#
#   summary-evidence-controls.sh <postmaster checkout> [ticket file]
#
# The ticket defaults to the fixture ticket `remove`, which numbers eight acceptance criteria. The
# scratch worktree is made under $TMPDIR and left in place.
set -u
TOOL=$(cd "${1:?usage: summary-evidence-controls.sh <postmaster checkout> [ticket file]}" && pwd)
TICKET=${2:-$TOOL/fixtures/tickets/remove/ticket.md}
W=$(mktemp -d)
mkdir -p "$W/.postmaster/verify"
echo "output the check can find" >"$W/.postmaster/verify/a.txt"

n=$("$TOOL/scripts/run" ticket-check --body "$TICKET" | sed -n 's/^well-formed, \([0-9]*\) acceptance criteria$/\1/p')
echo "criteria the ticket numbers: $n"

nots() { # nots <from> <to>: the entries numbered from..to, each one `not shown` with a reason
  local i
  for ((i = $1; i <= $2; i++)); do echo "$i. not shown: no browser to open here"; done
}
{
  echo "## Evidence"
  nots 1 "$n"
} >"$W/all-not-shown.md"
{
  echo "## Evidence"
  nots 1 $((n - 1))
} >"$W/one-missing.md"
{
  echo "## Evidence"
  echo '1. `.postmaster/verify/nope.txt`'
  nots 2 "$n"
} >"$W/cites-a-missing-file.md"
{
  echo "## Evidence"
  echo '1. `.postmaster/verify/a.txt`'
  nots 2 "$n"
} >"$W/one-shown.md"

run() { # run <name>: the check on the summary of that name, its exit status and its first line
  local out code
  out=$("$TOOL/scripts/run" summary-evidence "$W/$1.md" "$W" --ticket "$TICKET" 2>&1)
  code=$?
  printf '%-22s exit %s   %s\n' "$1" "$code" "$(printf '%s' "$out" | head -1)"
}
run all-not-shown
run one-missing
run cites-a-missing-file
run one-shown
