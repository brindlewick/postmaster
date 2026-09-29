#!/usr/bin/env bash
# Oracle for #124: blind acceptance tests at the ticket's own interface.
#
# Written by the leg-1 coachman before reading any lane's diff, committed as the
# first commit on the ticket branch. It builds fresh dispatch dirs in the current
# postmaster format and asserts `turnpikes.sh legs` lists synthesis and review
# only (AC1, AC3, AC5) — and that the same cases fail on the BASE script, so the
# oracle is a control both ways, not a tautology.
#
#   oracle-124.sh            run from the repo root; exit 0 when the worktree's
#                            script meets the ticket, 1 otherwise
#
# It pins only what the ticket pins exactly. How a run dispatched before the
# change is recognized is the implementation's design decision, so no case here
# builds a pre-change dispatch; that half of AC5 is verified by reading plus the
# lanes' own self-test controls (AC6). The stage vocabulary and the card's exact
# shape are likewise the lanes' to choose.
set -uo pipefail
BASE_SHA=6e9f87cc776c0769ab099400087ca3a33a9ca770
NEW=scripts/turnpikes.sh
[ -f "$NEW" ] || { echo "oracle: run from the repo root: $NEW not found" >&2; exit 1; }
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
BASE_SCRIPT=$tmp/turnpikes-base.sh
git show "$BASE_SHA:scripts/turnpikes.sh" > "$BASE_SCRIPT" 2>/dev/null \
  || { echo "oracle: cannot read BASE $BASE_SHA:scripts/turnpikes.sh" >&2; exit 1; }
waybill() {  # waybill <dispatch> <the turnpikes: line under the title>
  mkdir -p "$1"
  { printf '# Waybill: T-1\n%s\n\n## Ticket\n## Problem / feature\nA change.\n\n' "$2"
    printf '## Dispatch\nname: #1, A change\ndispatch: %s\ntool: /t\n' "$1"; } > "$1/brief.md"
  printf '{"stage": "dispatched", "leg": 1, "base": "abc123", "lanes": {}, "coachman": {"legs": {}}}\n' > "$1/manifest.json"
}
waybill "$tmp/default" "turnpikes: style, bug, security"
waybill "$tmp/one" "turnpikes: style"
waybill "$tmp/none" "turnpikes: none"
fails=0
check() {  # check <label> <script> <dispatch> <want, \n-separated> <want-pass: 1|0>
  local got= rc=0
  got=$("$2" legs "$3" 2>&1) || rc=$?
  local pass=0; [ "$rc" -eq 0 ] && [ "$got" = "$(printf '%b' "$4")" ] && pass=1
  if [ "$pass" -eq "$5" ]; then printf 'ok   %s\n' "$1"
  else printf 'FAIL %s (wanted %s):\n--- wanted output ---\n%b\n--- got (exit %s) ---\n%s\n' \
      "$1" "$([ "$5" -eq 1 ] && echo pass || echo fail)" "$4" "$rc" "$got"; fails=$((fails+1)); fi
}
D12='1 synthesis\n2 review style bug security'
D1='1 synthesis\n2 review style'
D0='1 synthesis'
echo "new script: fresh runs list no ship leg"
check "AC1+AC5: default turnpikes list synthesis and review only" "$NEW" "$tmp/default" "$D12" 1
check "AC5: one review turnpike still lists synthesis and review only" "$NEW" "$tmp/one" "$D1" 1
check "AC3+AC5: no turnpikes list synthesis only" "$NEW" "$tmp/none" "$D0" 1
echo "BASE script: the same cases fail (negative control)"
check "BASE still lists a ship leg for default turnpikes" "$BASE_SCRIPT" "$tmp/default" "$D12" 0
check "BASE still lists a ship leg for no turnpikes" "$BASE_SCRIPT" "$tmp/none" "$D0" 0
echo
if [ "$fails" -eq 0 ]; then echo "oracle: all cases behaved"; exit 0; fi
echo "oracle: $fails case(s) misbehaved"; exit 1
