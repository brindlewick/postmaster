#!/usr/bin/env bash
# Acceptance oracle for a pinned tool: a run runs wholly on the postmaster version it was
# dispatched from. Three stale sentences in AGENTS.md still say a contract change lands while
# the fleet is idle, matched verbatim after newlines are folded (carriage returns stripped
# first, so CRLF never hides one), and two claim phrases (`fleet is idle`, `fleet quiet`)
# catch the same claim reworded in AGENTS.md; further paraphrases are beyond a grep oracle.
# Two stale sentences name the main checkout as the run's tool: the waybill template's `tool:`
# line in SKILL.md, and the `<tool>` definition in coachman.md. Five presence checks hold the
# replacement: AGENTS.md says a run runs on the version it was dispatched from, the waybill
# template pins the tool to the dispatch commit, postmaster.md pins the run to a checkout at
# dispatch, coachman.md defines the tool as that checkout, and one of the runbooks shares a
# checkout per commit and removes it when no run uses it. Two keepers guard what survives:
# the fixture-run rule for contract changes stays in AGENTS.md. The replacement wording
# itself is judged by reading, not by this script, and so is the mechanism: run.json's
# record, legs actually running from the pinned checkout, the ticket's own control, and
# sharing and removal behaviour are verified at harvest by running each lane's work,
# because their shape is what the lanes were dispatched to choose.
#
#   pinned-tool-acceptance.sh [repo-root]   default: the repo this script lives in
#   pinned-tool-acceptance.sh --self-test   prove each check fails on its own fault alone,
#                                           a clean tree passes, and the live tree passes
#
#   exit 0  the prose interface is pinned
#   exit 1  stale claims remain, one per line on stdout: <file>: <what is wrong>
#   exit 2  usage, or a file that cannot be read
#
# The self-test fails on a tree that still carries the old claims, at its live-tree step;
# that failure is the control proving the checks bite on the real files, not only fixtures.
set -uo pipefail
HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
ROOT=$(dirname "$HERE")
usage() { echo "usage: pinned-tool-acceptance.sh [repo-root] | --self-test" >&2; exit 2; }

flat() { tr -d '\r' < "$1" | tr '\n\t' '  ' | sed 's/  */ /g'; }   # fold newlines so a reflow alone never passes

# stale <flat-text> <file> <label> <sentence...>: fault when the sentence is still claimed
fails=0
stale() {
  local text=$1 file=$2 label=$3; shift 3
  if printf '%s' "$text" | grep -q -F -- "$*"; then
    printf '%s: still says %s\n' "$file" "$label"
    fails=$((fails + 1))
  fi
}

# want <file> <label>: fault when a new concept is missing; kept <file> <label>: fault when
# a section that must survive the change is missing
want() {
  printf '%s: does not %s\n' "$1" "$2"
  fails=$((fails + 1))
}
kept() {
  printf '%s: no longer %s\n' "$1" "$2"
  fails=$((fails + 1))
}

accept() {  # accept <root>: the checks; stdout the faults, exit 0/1/2
  local root=$1 f
  for f in AGENTS.md skills/postmaster/SKILL.md skills/postmaster/postmaster.md skills/postmaster/coachman.md; do
    [ -r "$root/$f" ] || { echo "pinned-tool-acceptance: cannot read $root/$f" >&2; return 2; }
  done
  fails=0
  local agents skill post coach coachhead waybill
  agents=$(flat "$root/AGENTS.md") || return 2
  skill=$(flat "$root/skills/postmaster/SKILL.md") || return 2
  post=$(flat "$root/skills/postmaster/postmaster.md") || return 2
  coach=$(flat "$root/skills/postmaster/coachman.md") || return 2
  coachhead=$(head -n 60 "$root/skills/postmaster/coachman.md" | tr '\n\t' '  ' | sed 's/  */ /g') || return 2
  waybill=$(sed -n '/## The waybill/,/## Hard rules/p' "$root/skills/postmaster/SKILL.md" | tr '\n\t' '  ' | sed 's/  */ /g') || return 2
  stale "$agents" AGENTS.md 'contract changes land while the fleet is idle' \
    'land it while the fleet is idle, or the next dispatch will read a new contract while an older run is still writing to the old one.'
  stale "$agents" AGENTS.md 'only contract changes need the fleet quiet' \
    'Contract changes are the only category that needs the fleet quiet.'
  stale "$agents" AGENTS.md 'a ticket is for work that needs the fleet quiet' \
    'it touches another contract, needs the fleet quiet, or depends on something that does not exist yet.'
  stale "$skill" skills/postmaster/SKILL.md 'the waybill tool is the main checkout' \
    'tool: <abs path of the postmaster repo: <tool> in the runbooks>'
  stale "$coach" skills/postmaster/coachman.md 'the tool is the postmaster repo' \
    '`<tool>` is the postmaster repo, whose absolute path the waybill gives as `tool`.'
  # The idle claim itself, reworded in its plain phrasings: a new sentence in one of these
  # trips the same guard. Further paraphrases are beyond a grep oracle.
  for claim in 'fleet is idle' 'fleet quiet'; do
    if printf '%s' "$agents" | grep -q -F -- "$claim"; then
      printf 'AGENTS.md: still says %s\n' "$(case $claim in 'fleet is idle') echo 'the fleet must be idle';; *) echo 'the fleet must be quiet';; esac)"
      fails=$((fails + 1))
    fi
  done
  # The replacement concepts.
  printf '%s' "$agents" | grep -q -i -E 'it (was|is) dispatched from' \
    || want AGENTS.md 'say a run runs on the version it was dispatched from'
  printf '%s' "$waybill" | grep -q -i -E 'pinned|dispatch commit|dispatched from' \
    || want skills/postmaster/SKILL.md 'pin the waybill tool to the dispatch commit'
  printf '%s' "$post" | grep -q -i -E 'pinned|pin the|dispatch commit' \
    || want skills/postmaster/postmaster.md 'pin the run to a checkout at dispatch'
  { printf '%s' "$coachhead" | grep -q -i -E 'pinned|dispatch commit|dispatched from'; } \
    || { printf '%s' "$coach" | grep -q -i -E 'dispatch commit|dispatched from'; } \
    || want skills/postmaster/coachman.md 'define the tool as the pinned checkout the run was dispatched from'
  { printf '%s' "$post" | grep -q -i -E 'in flight|pinned checkout|shares? one'; } \
    || { printf '%s' "$coach" | grep -q -i -E 'in flight|pinned checkout|shares? one'; } \
    || want skills/postmaster/postmaster.md 'share one checkout per commit and remove it when no run uses it'
  # The sections that survive the change.
  printf '%s' "$agents" | grep -q -F 'scores clean' \
    || kept AGENTS.md 'merges a contract change only after a fixture run scores clean'
  printf '%s' "$agents" | grep -q -F 'fixture run' \
    || kept AGENTS.md 'score a contract change with a fixture run'
  [ "$fails" -eq 0 ]
}

case ${1:-} in
  --self-test) [ $# -eq 1 ] || usage ;;
  -*) usage ;;
  "") [ $# -eq 0 ] || usage; accept "$ROOT"; exit $? ;;
  *) [ $# -eq 1 ] || usage; accept "$1"; exit $? ;;
esac

# --- self-test ----------------------------------------------------------------------------
tmp=$(mktemp -d) || exit 2
trap 'rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
fails=0
has() {  # has <name> <output> <line>
  printf '%s\n' "$2" | grep -qxF -- "$3" && printf '  ok   %s\n' "$1" \
    || { printf '  FAIL %s: no line "%s" in:\n%s\n' "$1" "$3" "$2"; fails=$((fails + 1)); }
}

mkdir -p "$tmp/clean/skills/postmaster"
cat > "$tmp/clean/AGENTS.md" <<'EOF'
A run runs wholly on the postmaster version it was dispatched from.
A change to the coachman contract merges only after a fixture run from its branch.
The run scores clean before the change merges.
EOF
cat > "$tmp/clean/skills/postmaster/SKILL.md" <<'EOF'
## The waybill
The postmaster writes one per ticket.
tool: <abs path of the run's pinned postmaster checkout, cut at the dispatch commit>
## Hard rules
Prefer a script to a hand-rolled step.
EOF
cat > "$tmp/clean/skills/postmaster/postmaster.md" <<'EOF'
4. **Pin the run's tool.** Cut a postmaster checkout at the dispatch commit and name it as the waybill's tool.
Runs dispatched at the same commit share one checkout, removed once no run using it is in flight.
EOF
cat > "$tmp/clean/skills/postmaster/coachman.md" <<'EOF'
`<tool>` is the run's pinned tool, cut at the dispatch commit, whose absolute path the waybill gives as `tool`.
A lane is a harness plus a model plus an effort.
EOF

alone() {  # alone <name> <file> <want> <fault...>: the check fires on its fault alone
  local name=$1 file=$2 want=$3 out rc; shift 3
  rm -rf "$tmp/one" && cp -r "$tmp/clean" "$tmp/one"
  printf '%s\n' "$*" >> "$tmp/one/$file"
  out=$(accept "$tmp/one"); rc=$?
  [ "$rc" -eq 1 ] && [ "$out" = "$want" ] && printf '  ok   %s\n' "$name" \
    || { printf '  FAIL %s: exit %s with:\n%s\n' "$name" "$rc" "$out"; fails=$((fails + 1)); }
}

without() {  # without <name> <file> <want> <sed-expr>: the presence check fires alone
  local name=$1 file=$2 want=$3 out rc; shift 3
  rm -rf "$tmp/one" && cp -r "$tmp/clean" "$tmp/one"
  sed -i "$1" "$tmp/one/$file"
  out=$(accept "$tmp/one"); rc=$?
  [ "$rc" -eq 1 ] && [ "$out" = "$want" ] && printf '  ok   %s\n' "$name" \
    || { printf '  FAIL %s: exit %s with:\n%s\n' "$name" "$rc" "$out"; fails=$((fails + 1)); }
}

echo "each check fires on its own fault alone"
alone 'idle sentence' AGENTS.md \
  'AGENTS.md: still says contract changes land while the fleet is idle
AGENTS.md: still says the fleet must be idle' \
  'completion detection), land it while the fleet is idle, or the next dispatch will read a new contract while an older run is still writing to the old one.'
alone 'only-category sentence' AGENTS.md \
  'AGENTS.md: still says only contract changes need the fleet quiet
AGENTS.md: still says the fleet must be quiet' \
  'Contract changes are the only category that needs the fleet quiet.'
alone 'ticket sentence' AGENTS.md \
  'AGENTS.md: still says a ticket is for work that needs the fleet quiet
AGENTS.md: still says the fleet must be quiet' \
  'it touches another contract, needs the fleet quiet, or depends on something that does not exist yet.'
alone 'idle reworded' AGENTS.md \
  'AGENTS.md: still says the fleet must be idle' \
  'Merge while the fleet is idle, if you must.'
alone 'quiet reworded' AGENTS.md \
  'AGENTS.md: still says the fleet must be quiet' \
  'Keep the fleet quiet during the move.'
alone 'waybill tool line' skills/postmaster/SKILL.md \
  'skills/postmaster/SKILL.md: still says the waybill tool is the main checkout' \
  'tool: <abs path of the postmaster repo: <tool> in the runbooks>'
alone 'tool definition' skills/postmaster/coachman.md \
  'skills/postmaster/coachman.md: still says the tool is the postmaster repo' \
  '`<tool>` is the postmaster repo, whose absolute path the waybill gives as `tool`.'
without 'version sentence' AGENTS.md \
  'AGENTS.md: does not say a run runs on the version it was dispatched from' \
  '/dispatched from/d'
without 'template pin' skills/postmaster/SKILL.md \
  'skills/postmaster/SKILL.md: does not pin the waybill tool to the dispatch commit' \
  '/pinned postmaster checkout/d'
without 'dispatch pin' skills/postmaster/postmaster.md \
  'skills/postmaster/postmaster.md: does not pin the run to a checkout at dispatch' \
  '/Pin the run/d'
without 'tool definition pin' skills/postmaster/coachman.md \
  'skills/postmaster/coachman.md: does not define the tool as the pinned checkout the run was dispatched from' \
  '/pinned tool/d'
without 'shared removal' skills/postmaster/postmaster.md \
  'skills/postmaster/postmaster.md: does not share one checkout per commit and remove it when no run uses it' \
  '/in flight/d'
without 'scores clean kept' AGENTS.md \
  'AGENTS.md: no longer merges a contract change only after a fixture run scores clean' \
  '/scores clean/d'
without 'fixture run kept' AGENTS.md \
  'AGENTS.md: no longer score a contract change with a fixture run' \
  '/fixture run/d'

echo "all faults together"
rm -rf "$tmp/stale" && cp -r "$tmp/clean" "$tmp/stale"
printf '%s\n' 'completion detection), land it while the fleet is idle, or the next dispatch will read a new contract while an older run is still writing to the old one.' \
  'Contract changes are the only category that needs the fleet quiet.' \
  'it touches another contract, needs the fleet quiet, or depends on something that does not exist yet.' \
  >> "$tmp/stale/AGENTS.md"
printf '%s\n' 'tool: <abs path of the postmaster repo: <tool> in the runbooks>' >> "$tmp/stale/skills/postmaster/SKILL.md"
printf '%s\n' '`<tool>` is the postmaster repo, whose absolute path the waybill gives as `tool`.' >> "$tmp/stale/skills/postmaster/coachman.md"
out=$(accept "$tmp/stale"); rc=$?
[ "$rc" -eq 1 ] && printf '  ok   stale tree exits 1\n' \
  || { printf '  FAIL stale tree exits %s, want 1\n' "$rc"; fails=$((fails + 1)); }
[ "$(printf '%s\n' "$out" | wc -l | tr -d ' ')" -eq 7 ] && printf '  ok   stale tree lists 7 faults\n' \
  || { printf '  FAIL stale tree lists:\n%s\n' "$out"; fails=$((fails + 1)); }
has 'stale idle sentence' "$out" 'AGENTS.md: still says contract changes land while the fleet is idle'
has 'stale only-category' "$out" 'AGENTS.md: still says only contract changes need the fleet quiet'
has 'stale ticket sentence' "$out" 'AGENTS.md: still says a ticket is for work that needs the fleet quiet'
has 'stale idle claim' "$out" 'AGENTS.md: still says the fleet must be idle'
has 'stale quiet claim' "$out" 'AGENTS.md: still says the fleet must be quiet'
has 'stale waybill tool' "$out" 'skills/postmaster/SKILL.md: still says the waybill tool is the main checkout'
has 'stale tool definition' "$out" 'skills/postmaster/coachman.md: still says the tool is the postmaster repo'

out=$(accept "$tmp/clean"); rc=$?
[ "$rc" -eq 0 ] && [ -z "$out" ] && printf '  ok   clean tree passes\n' \
  || { printf '  FAIL clean tree exits %s with:\n%s\n' "$rc" "$out"; fails=$((fails + 1)); }

out=$(accept "$tmp/nowhere" 2>&1); rc=$?
[ "$rc" -eq 2 ] && printf '  ok   missing tree exits 2\n' \
  || { printf '  FAIL missing tree exits %s\n' "$rc"; fails=$((fails + 1)); }

"$0" "$tmp/clean" extra >/dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ] && printf '  ok   an extra argument exits 2\n' \
  || { printf '  FAIL an extra argument exits %s\n' "$rc"; fails=$((fails + 1)); }
"$0" --self-test extra >/dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ] && printf '  ok   --self-test with an extra argument exits 2\n' \
  || { printf '  FAIL --self-test with an extra argument exits %s\n' "$rc"; fails=$((fails + 1)); }

rm -rf "$tmp/crlf" && cp -r "$tmp/clean" "$tmp/crlf"
printf '`<tool>` is the postmaster repo, whose absolute path the waybill gives\r\nas `tool`.\r\n' >> "$tmp/crlf/skills/postmaster/coachman.md"
out=$(accept "$tmp/crlf"); rc=$?
[ "$rc" -eq 1 ] && [ "$out" = 'skills/postmaster/coachman.md: still says the tool is the postmaster repo' ] \
  && printf '  ok   a CRLF stale sentence is still caught\n' \
  || { printf '  FAIL a CRLF stale sentence: exit %s with:\n%s\n' "$rc" "$out"; fails=$((fails + 1)); }

rm -rf "$tmp/locked" && cp -r "$tmp/clean" "$tmp/locked" && chmod 000 "$tmp/locked/skills/postmaster/postmaster.md"
out=$(accept "$tmp/locked" 2>&1); rc=$?
chmod 644 "$tmp/locked/skills/postmaster/postmaster.md"
[ "$rc" -eq 2 ] && printf '  ok   an unreadable file exits 2, not a clean result\n' \
  || { printf '  FAIL an unreadable file exits %s with:\n%s\n' "$rc" "$out"; fails=$((fails + 1)); }

out=$(accept "$ROOT"); rc=$?
[ "$rc" -eq 0 ] && printf '  ok   live tree passes\n' \
  || { printf '  LIVE tree still carries stale claims (expected before the fix):\n%s\n' "$out"; fails=$((fails + 1)); }

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
