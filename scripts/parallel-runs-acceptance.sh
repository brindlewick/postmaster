#!/usr/bin/env bash
# Acceptance oracle for parallel runs: nothing in skills/, AGENTS.md, README.md or the
# wiki still says two runs must not change the same files. Runs go in parallel up to
# `team.max_runs`, and whichever merges second resolves the conflicts at its merge.
# Five checks name one stale sentence each from before that change, matched verbatim
# after newlines are folded (carriage returns stripped first, so CRLF never hides one),
# and five match the claim itself in every file in scope (`overlapping file surfaces`,
# `never two runs on`, `not change/touch/edit the same files`): a new sentence in one
# of these phrasings trips the same guard. Further paraphrases are beyond a grep oracle.
# Four presence checks hold the sections that survive: the Order-them step still orders
# by dependencies, the `team.max_runs` limit stays, and the concurrency note is rewritten,
# not deleted. The replacement wording itself is judged by reading, not by this script.
#
#   parallel-runs-acceptance.sh [repo-root]   default: the repo this script lives in
#   parallel-runs-acceptance.sh --self-test   prove each check fails on its own fault alone,
#                                             a clean tree passes, and the live tree passes
#
#   exit 0  no stale claim remains
#   exit 1  stale claims, one per line on stdout: <file>: <what is still claimed>
#   exit 2  usage, or a file that cannot be read
#
# The self-test fails on a tree that still carries the old claims, at its live-tree step;
# that failure is the control proving the checks bite on the real files, not only fixtures.
set -uo pipefail
HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
ROOT=$(dirname "$HERE")
usage() { echo "usage: parallel-runs-acceptance.sh [repo-root] | --self-test" >&2; exit 2; }

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

# gone <file> <label>: fault when a section that must survive is missing
gone() {
  printf '%s: no longer %s\n' "$1" "$2"
  fails=$((fails + 1))
}

accept() {  # accept <root>: the checks; stdout the faults, exit 0/1/2
  local root=$1 f
  for f in AGENTS.md README.md skills/postmaster/postmaster.md skills/postmaster/coachman.md; do
    [ -r "$root/$f" ] || { echo "parallel-runs-acceptance: cannot read $root/$f" >&2; return 2; }
  done
  fails=0
  local post coach order_line
  post=$(flat "$root/skills/postmaster/postmaster.md") || return 2
  coach=$(flat "$root/skills/postmaster/coachman.md") || return 2
  stale "$post" skills/postmaster/postmaster.md 'step 6 orders by file surfaces' \
    'then the file surfaces'
  stale "$post" skills/postmaster/postmaster.md 'two tickets on one module do not run together' \
    'Two tickets touching the same route table, transport interface or shared module do not run at the same time'
  stale "$post" skills/postmaster/postmaster.md 'never two runs on overlapping file surfaces' \
    'never two runs on overlapping file surfaces'
  stale "$coach" skills/postmaster/coachman.md 'parallel runs are safe only on disjoint files' \
    'Parallel runs are safe when their tickets touch disjoint files'
  stale "$coach" skills/postmaster/coachman.md 'prefer sequencing colliding tickets' \
    'Prefer sequencing those tickets, or accept conflict resolution at each gated merge;'
  stale "$coach" skills/postmaster/coachman.md 'check file surfaces before mass-launching' \
    'check the file surfaces before mass-launching'
  # The claim itself, in every file in scope, in its plain phrasings: a new sentence in
  # one of these trips the same guard. Further paraphrases are beyond a grep oracle.
  while IFS= read -r f; do
    local text
    text=$(flat "$root/$f") || return 2
    for claim in 'overlapping file surfaces' 'never two runs on' 'not change the same files' \
        'not touch the same files' 'not edit the same files'; do
      stale "$text" "$f" 'two runs must not change the same files' "$claim"
    done
  done <<EOF
AGENTS.md
README.md
$(find "$root/skills" "$root/wiki" -name '*.md' -print 2>/dev/null | sed "s|^$root/||" | sort -u)
EOF
  # The sections that survive the change.
  if printf '%s' "$post" | grep -q -F 'Order them'; then
    order_line=$(grep -n -m1 -F 'Order them' "$root/skills/postmaster/postmaster.md" | cut -d: -f1 || true)
    sed -n "${order_line},$((order_line + 5))p" "$root/skills/postmaster/postmaster.md" \
      | grep -qi 'ependenc' || gone skills/postmaster/postmaster.md 'orders step 6 by dependencies'
  else
    gone skills/postmaster/postmaster.md 'orders tickets in an Order-them step'
  fi
  printf '%s' "$post" | grep -q -F 'team.max_runs' \
    || gone skills/postmaster/postmaster.md 'limits runs with team.max_runs'
  printf '%s' "$coach" | grep -q -F 'Concurrency note' \
    || gone skills/postmaster/coachman.md 'keeps a concurrency note'
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

mkdir -p "$tmp/clean/skills/postmaster" "$tmp/clean/wiki/concepts"
cat > "$tmp/clean/skills/postmaster/postmaster.md" <<'EOF'
## Stage A: the stream becomes tickets
6. **Order them.** Dependencies first: a ticket that needs another's change waits for it to land. Record the order and the reason in `<runs>/postmaster/plan.md`, current state only.
## Hard rules
- Never launch more runs than `team.max_runs`.
EOF
cat > "$tmp/clean/skills/postmaster/coachman.md" <<'EOF'
## Concurrency note (several runs on one project)
Runs go in parallel up to `team.max_runs`. When two runs change the same files, the one that merges second resolves the conflicts at its merge; merge, never rebase.
EOF
cat > "$tmp/clean/skills/postmaster/SKILL.md" <<'EOF'
You get the machine ready, choose a target, and start the postmaster.
EOF
cat > "$tmp/clean/skills/postmaster/harnesses.md" <<'EOF'
The launch keeps them, as a claude lane reads the same files.
EOF
cat > "$tmp/clean/AGENTS.md" <<'EOF'
| **postmaster** | decomposes a stream into tickets | `skills/postmaster/postmaster.md` |
Several models implement the same ticket independently, in separate worktrees.
EOF
cat > "$tmp/clean/README.md" <<'EOF'
Get one ticket implemented by several models at once, then judged before it lands.
EOF
cat > "$tmp/clean/wiki/concepts/review-loop.md" <<'EOF'
When the passes ran in sequence, each lens saw only its own output.
The overlap between independent reviewers estimates what an inspection left.
EOF

alone() {  # alone <name> <file> <want-line> <fault...>: the check fires on its fault alone
  local name=$1 file=$2 want=$3 out rc; shift 3
  rm -rf "$tmp/one" && cp -r "$tmp/clean" "$tmp/one"
  printf '%s\n' "$*" >> "$tmp/one/$file"
  out=$(accept "$tmp/one"); rc=$?
  [ "$rc" -eq 1 ] && [ "$out" = "$want" ] && printf '  ok   %s\n' "$name" \
    || { printf '  FAIL %s: exit %s with:\n%s\n' "$name" "$rc" "$out"; fails=$((fails + 1)); }
}

without() {  # without <name> <file> <want-line> <sed-expr>: the presence check fires alone
  local name=$1 file=$2 want=$3 out rc; shift 3
  rm -rf "$tmp/one" && cp -r "$tmp/clean" "$tmp/one"
  sed -i "$1" "$tmp/one/$file"
  out=$(accept "$tmp/one"); rc=$?
  [ "$rc" -eq 1 ] && [ "$out" = "$want" ] && printf '  ok   %s\n' "$name" \
    || { printf '  FAIL %s: exit %s with:\n%s\n' "$name" "$rc" "$out"; fails=$((fails + 1)); }
}

echo "each check fires on its own fault alone"
alone 'step 6 file surfaces' skills/postmaster/postmaster.md \
  'skills/postmaster/postmaster.md: still says step 6 orders by file surfaces' \
  '6. **Order them.** Dependencies first; then the file surfaces.'
alone 'two tickets one module' skills/postmaster/postmaster.md \
  'skills/postmaster/postmaster.md: still says two tickets on one module do not run together' \
  'Two tickets touching the same route table, transport interface or shared module do not run at the same time.'
alone 'disjoint files' skills/postmaster/coachman.md \
  'skills/postmaster/coachman.md: still says parallel runs are safe only on disjoint files' \
  'Parallel runs are safe when their tickets touch disjoint files.'
alone 'prefer sequencing' skills/postmaster/coachman.md \
  'skills/postmaster/coachman.md: still says prefer sequencing colliding tickets' \
  'Prefer sequencing those tickets, or accept conflict resolution at each gated merge;'
alone 'check surfaces' skills/postmaster/coachman.md \
  'skills/postmaster/coachman.md: still says check file surfaces before mass-launching' \
  'check the file surfaces before mass-launching.'
alone 'AGENTS general claim' AGENTS.md \
  'AGENTS.md: still says two runs must not change the same files' \
  'Two runs must not change the same files.'
alone 'README general claim' README.md \
  'README.md: still says two runs must not change the same files' \
  'Two runs do not touch the same files.'
alone 'wiki general claim' wiki/concepts/review-loop.md \
  'wiki/concepts/review-loop.md: still says two runs must not change the same files' \
  'Two runs must not edit the same files.'
alone 'SKILL general claim' skills/postmaster/SKILL.md \
  'skills/postmaster/SKILL.md: still says two runs must not change the same files' \
  'The old overlapping file surfaces rule is gone.'
without 'step 6 kept' skills/postmaster/postmaster.md \
  'skills/postmaster/postmaster.md: no longer orders tickets in an Order-them step' \
  '/Order them/d'
without 'max_runs kept' skills/postmaster/postmaster.md \
  'skills/postmaster/postmaster.md: no longer limits runs with team.max_runs' \
  '/team.max_runs/d'
without 'step 6 dependencies' skills/postmaster/postmaster.md \
  'skills/postmaster/postmaster.md: no longer orders step 6 by dependencies' \
  's/Dependencies first:/Order kept:/'
without 'note kept' skills/postmaster/coachman.md \
  'skills/postmaster/coachman.md: no longer keeps a concurrency note' \
  '/Concurrency note/d'
# The hard-rule clause carries two general phrasings inside it, so it fires three checks.
rm -rf "$tmp/one" && cp -r "$tmp/clean" "$tmp/one"
printf '%s\n' '- Never launch more runs than `team.max_runs`, and never two runs on overlapping file surfaces.' \
  >> "$tmp/one/skills/postmaster/postmaster.md"
out=$(accept "$tmp/one"); rc=$?
[ "$rc" -eq 1 ] && [ "$(printf '%s\n' "$out" | wc -l | tr -d ' ')" -eq 3 ] \
  && printf '%s\n' "$out" | grep -qxF 'skills/postmaster/postmaster.md: still says never two runs on overlapping file surfaces' \
  && [ "$(printf '%s\n' "$out" | grep -c -xF 'skills/postmaster/postmaster.md: still says two runs must not change the same files')" -eq 2 ] \
  && printf '  ok   hard-rule clause fires its check and the general one twice\n' \
  || { printf '  FAIL hard-rule clause: exit %s with:\n%s\n' "$rc" "$out"; fails=$((fails + 1)); }

echo "all faults together"
rm -rf "$tmp/stale" && cp -r "$tmp/clean" "$tmp/stale"
printf '%s\n' '6. **Order them.** Dependencies first; then the file surfaces. Two tickets touching the same route table, transport interface or shared module do not run at the same time.' \
  '- Never launch more runs than `team.max_runs`, and never two runs on overlapping file surfaces.' \
  >> "$tmp/stale/skills/postmaster/postmaster.md"
printf '%s\n' 'Parallel runs are safe when their tickets touch disjoint files.' \
  'Prefer sequencing those tickets, or accept conflict resolution at each gated merge;' \
  'check the file surfaces before mass-launching.' \
  >> "$tmp/stale/skills/postmaster/coachman.md"
printf '%s\n' 'Two runs must not change the same files.' >> "$tmp/stale/AGENTS.md"
printf '%s\n' 'Two runs do not touch the same files.' >> "$tmp/stale/README.md"
printf '%s\n' 'Two runs must not edit the same files.' >> "$tmp/stale/wiki/concepts/review-loop.md"
out=$(accept "$tmp/stale"); rc=$?
[ "$rc" -eq 1 ] && printf '  ok   stale tree exits 1\n' \
  || { printf '  FAIL stale tree exits %s, want 1\n' "$rc"; fails=$((fails + 1)); }
[ "$(printf '%s\n' "$out" | wc -l | tr -d ' ')" -eq 11 ] && printf '  ok   stale tree lists 11 faults\n' \
  || { printf '  FAIL stale tree lists:\n%s\n' "$out"; fails=$((fails + 1)); }
has 'stale step 6 surfaces' "$out" 'skills/postmaster/postmaster.md: still says step 6 orders by file surfaces'
has 'stale two tickets' "$out" 'skills/postmaster/postmaster.md: still says two tickets on one module do not run together'
has 'stale hard rule' "$out" 'skills/postmaster/postmaster.md: still says never two runs on overlapping file surfaces'
has 'stale disjoint' "$out" 'skills/postmaster/coachman.md: still says parallel runs are safe only on disjoint files'
has 'stale sequencing' "$out" 'skills/postmaster/coachman.md: still says prefer sequencing colliding tickets'
has 'stale check surfaces' "$out" 'skills/postmaster/coachman.md: still says check file surfaces before mass-launching'
has 'stale postmaster general' "$out" 'skills/postmaster/postmaster.md: still says two runs must not change the same files'
has 'stale AGENTS general' "$out" 'AGENTS.md: still says two runs must not change the same files'
has 'stale README general' "$out" 'README.md: still says two runs must not change the same files'
has 'stale wiki general' "$out" 'wiki/concepts/review-loop.md: still says two runs must not change the same files'

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
printf 'Prefer sequencing those tickets, or accept\r\nconflict resolution at each gated merge;\r\n' >> "$tmp/crlf/skills/postmaster/coachman.md"
out=$(accept "$tmp/crlf"); rc=$?
[ "$rc" -eq 1 ] && [ "$out" = 'skills/postmaster/coachman.md: still says prefer sequencing colliding tickets' ] \
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
