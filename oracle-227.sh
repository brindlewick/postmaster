#!/usr/bin/env bash
# Blind oracle for #227: Teardown closes a run's spaces when its logs hold review findings lists.
#
# Written by the leg-1 coachman from the ticket's acceptance criteria BEFORE reading any
# lane's diff or log, and committed on the ticket branch after the spec. Tests at the
# ticket's own interface: scripts/host.sh stop-run and close-run on run records built
# fresh in temporary folders, plus the host suite's green run. Never a function shape,
# which is what the lanes were dispatched to choose.
#
# Casing note: the action-log fixtures below use the key "detail" (byte 100),
# exactly as the ticket writes it and as log-action.sh writes it. The first
# committed revision of this file used "Detail" (byte 68) in its fixtures by
# mistake, and its R+opus checks failed on correct implementations. The
# fixtures were corrected to the ticket's spelling (verified byte by byte
# against the ticket text and the base reader, not against any lane's work),
# and both lanes were scored with the corrected oracle.
#
#   ./oracle-227.sh        run every check; exit 0 when all pass, 1 otherwise
#
# Run from the repo root, on a committed tree.

ok=0
bad=0
ok() { ok=$((ok + 1)); echo "ok $1"; }
bad() { bad=$((bad + 1)); echo "BAD $1"; }

[ -f package.json ] && [ -d scripts ] && [ -x scripts/host.sh ] || {
  echo "oracle: run from the repo root" >&2
  exit 2
}
command -v git >/dev/null && command -v bun >/dev/null || {
  echo "oracle: needs git and bun" >&2
  exit 2
}

TDIRS=()
cleanup() { [ "${#TDIRS[@]}" -gt 0 ] && rm -rf -- "${TDIRS[@]}"; }
trap cleanup EXIT

freshT() {
  local d
  d=$(mktemp -d) || exit 2
  T=$(cd "$d" && pwd -P) || exit 2
  TDIRS+=("$T")
}

mkstubs() {
  mkdir -p "$T/bin" "$T/state"
  printf '#!/bin/sh\nexit 1\n' >"$T/bin/herdr"
  printf '#!/bin/sh\nexit 1\n' >"$T/bin/tmux"
  chmod +x "$T/bin/herdr" "$T/bin/tmux"
}

# Full record R per the ticket's ### Checks preamble.
mkR() {
  freshT
  mkdir -p "$T/repo/.worktrees/227" "$T/repo/.worktrees/227-sol" "$T/repo/.worktrees/227-mimo" \
    "$T/repo/.worktrees/227-rev-bug-mimo" "$T/repo/.worktrees/227-rev-bug-decoy" \
    "$T/repo/.worktrees/227-rev-security-opus" "$T/runs/227/logs"
  printf '## Dispatch\nname: #227, test\nsynthesis worktree: %s/repo/.worktrees/227\n' "$T" >"$T/runs/227/brief.md"
  printf '{"config":{"team":{"workhorses":["sol","mimo"]}}}' >"$T/runs/227/run.json"
  printf '{"lanes":{"sol":{},"mimo":{}}}' >"$T/runs/227/manifest.json"
  printf '{"attempt":"1","deadline":"2030-01-01T00:00:00Z","reviewers":[["bug","mimo"]]}' >"$T/runs/227/logs/review-r1.json"
  printf '[{"target":"scripts/host.ts:1"}]' >"$T/runs/227/logs/review-r1-bug-mimo-findings.json"
  printf '{"reviewers":[["bug","decoy"]]}' >"$T/runs/227/logs/review-r1-bug-mimo-usage.json"
  printf '["not","a","record"]' >"$T/runs/227/logs/review-r1-notes.json"
  mkstubs
}

OUT=""
ERR=""
CODE=0
exechost() { # $1 = stop-run|close-run, $2 = dispatch
  local errf="$T/host.stderr"
  OUT=$(PATH="$T/bin:$PATH" POSTMASTER_HOST_STATE="$T/state" POSTMASTER_HOST_FIXTURE="$T" ./scripts/host.sh "$1" "$2" 2>"$errf")
  CODE=$?
  ERR=$(cat "$errf")
}

want() { # $1 = stop-run|close-run, rest = worktree names in order
  local cmd=$1
  shift
  local prefix
  if [ "$cmd" = "stop-run" ]; then prefix="no launch is running in "; else prefix="closed what host.sh opened for "; fi
  local e=""
  for n in "$@"; do
    if [ -z "$e" ]; then e="$prefix$T/repo/.worktrees/$n"; else e="$e
$prefix$T/repo/.worktrees/$n"; fi
  done
  printf '%s' "$e"
}

oneliner() { # $1 = text; true when exactly one line
  [ -n "$1" ] && case "$1" in *$'\n'*) return 1 ;; *) return 0 ;; esac
}

check_ok() { # $1=label $2=cmd $3=dispatch, rest = expected names
  local label=$1 cmd=$2 disp=$3
  shift 3
  exechost "$cmd" "$disp"
  local exp
  exp=$(want "$cmd" "$@")
  if [ "$CODE" -eq 0 ] && [ -z "$ERR" ] && [ "$OUT" = "$exp" ]; then ok "$label $cmd"
  else bad "$label $cmd (exit=$CODE stdout=<$OUT> stderr=<$ERR>)"; fi
}

check_refuse_named() { # $1=label $2=cmd $3=dispatch $4+=needles (each must appear, one stderr line)
  local label=$1 cmd=$2 disp=$3
  shift 3
  exechost "$cmd" "$disp"
  local miss=""
  for needle in "$@"; do
    case "$ERR" in *"$needle"*) ;; *) miss="$miss<$needle>" ;; esac
  done
  if [ "$CODE" -eq 2 ] && [ -z "$OUT" ] && oneliner "$ERR" && [ -z "$miss" ]; then ok "$label $cmd"
  else bad "$label $cmd (exit=$CODE stdout=<$OUT> stderr=<$ERR> missing=$miss)"; fi
}

check_refuse_exact() { # $1=label $2=cmd $3=dispatch $4=exact stderr
  local label=$1 cmd=$2 disp=$3 exp=$4
  exechost "$cmd" "$disp"
  if [ "$CODE" -eq 2 ] && [ -z "$OUT" ] && [ "$ERR" = "$exp" ]; then ok "$label $cmd"
  else bad "$label $cmd (exit=$CODE stdout=<$OUT> stderr=<$ERR>)"; fi
}

CMDS="stop-run close-run"

# C1: R -> four lines; R plus the opus action line -> five; R without logs/ -> three.
mkR
for c in $CMDS; do check_ok "C1 R" "$c" "$T/runs/227" 227-mimo 227-sol 227-rev-bug-mimo 227; done
mkR
printf '{"action":"review-launch","target":"opus","detail":"security r1"}' >"$T/runs/227/actions.jsonl"
for c in $CMDS; do check_ok "C1 R+opus" "$c" "$T/runs/227" 227-mimo 227-sol 227-rev-bug-mimo 227-rev-security-opus 227; done
mkR
rm -rf "$T/runs/227/logs"
for c in $CMDS; do check_ok "C1 no-logs" "$c" "$T/runs/227" 227-mimo 227-sol 227; done

# C2: a round record holding a non-mapping still refuses, naming the record.
for content in '[["bug","mimo"]]' '"text"' '5' 'true' 'null'; do
  mkR
  printf '%s' "$content" >"$T/runs/227/logs/review-r1.json"
  for c in $CMDS; do check_refuse_named "C2 r1=$content" "$c" "$T/runs/227" "$T/runs/227/logs/review-r1.json"; done
done
# Through a link to the dispatch folder, the refusal still names the resolved path.
mkR
printf '[["bug","mimo"]]' >"$T/runs/227/logs/review-r1.json"
ln -s "$T/runs/227" "$T/link227"
for c in $CMDS; do
  exechost "$c" "$T/link227"
  case "$ERR" in *"link227"*) bad "C2 symlink $c (names the link: <$ERR>)" ;;
  *)
    if [ "$CODE" -eq 2 ] && [ -z "$OUT" ] && oneliner "$ERR"; then
      case "$ERR" in *"$T/runs/227/logs/review-r1.json"*) ok "C2 symlink $c" ;;
      *) bad "C2 symlink $c (exit=$CODE stdout=<$OUT> stderr=<$ERR>)" ;; esac
    else bad "C2 symlink $c (exit=$CODE stdout=<$OUT> stderr=<$ERR>)"; fi ;;
  esac
done
# Two damaged round records: one line naming one of them.
mkR
printf '[["bug","mimo"]]' >"$T/runs/227/logs/review-r1.json"
printf 'null' >"$T/runs/227/logs/review-r2.json"
for c in $CMDS; do
  exechost "$c" "$T/runs/227"
  if [ "$CODE" -eq 2 ] && [ -z "$OUT" ] && oneliner "$ERR"; then
    case "$ERR" in *"$T/runs/227/logs/review-r1.json"*|*"$T/runs/227/logs/review-r2.json"*) ok "C2 two-damaged $c" ;;
    *) bad "C2 two-damaged $c (names neither record: <$ERR>)" ;; esac
  else bad "C2 two-damaged $c (exit=$CODE stdout=<$OUT> stderr=<$ERR>)"; fi
done
# A damaged round record plus a refusing action log: still one line.
mkR
printf '[["bug","mimo"]]' >"$T/runs/227/logs/review-r1.json"
{
  printf '%s\n' '{"action":"review-launch","target":"mimo","detail":"bug r1"}' '' '{broken' '["review-launch"]'
} >"$T/runs/227/actions.jsonl"
for c in $CMDS; do
  exechost "$c" "$T/runs/227"
  if [ "$CODE" -eq 2 ] && [ -z "$OUT" ] && oneliner "$ERR" ]; then ok "C2 record-plus-log $c"
  else bad "C2 record-plus-log $c (exit=$CODE stdout=<$OUT> stderr=<$ERR>)"; fi
done

# C3: unreadable or unusable round records stay silent skips.
mkR
printf '%s' '{broken' >"$T/runs/227/logs/review-r1.json"
for c in $CMDS; do check_ok "C3 broken" "$c" "$T/runs/227" 227-mimo 227-sol 227; done
mkR
: >"$T/runs/227/logs/review-r1.json"
for c in $CMDS; do check_ok "C3 empty" "$c" "$T/runs/227" 227-mimo 227-sol 227; done
mkR
rm "$T/runs/227/logs/review-r1.json"
mkdir "$T/runs/227/logs/review-r1.json"
for c in $CMDS; do check_ok "C3 dir" "$c" "$T/runs/227" 227-mimo 227-sol 227; done
mkR
printf '{}' >"$T/runs/227/logs/review-r1.json"
for c in $CMDS; do check_ok "C3 no-reviewers" "$c" "$T/runs/227" 227-mimo 227-sol 227; done
mkR
printf '{"reviewers":"bug"}' >"$T/runs/227/logs/review-r1.json"
for c in $CMDS; do check_ok "C3 str-reviewers" "$c" "$T/runs/227" 227-mimo 227-sol 227; done
mkR
printf '{"attempt":"1","reviewers":[["bug","mimo"],["bug"]]}' >"$T/runs/227/logs/review-r1.json"
for c in $CMDS; do check_ok "C3 partial" "$c" "$T/runs/227" 227-mimo 227-sol 227-rev-bug-mimo 227; done
mkR
mkdir "$T/runs/227/actions.jsonl"
for c in $CMDS; do check_ok "C3 actionsdir" "$c" "$T/runs/227" 227-mimo 227-sol 227-rev-bug-mimo 227; done

# C4: a refusing action-log line names the log and its line number.
for fourth in '["review-launch"]' 'null' '"text"'; do
  mkR
  {
    printf '%s\n' '{"action":"review-launch","target":"mimo","detail":"bug r1"}' '' '{broken' "$fourth"
  } >"$T/runs/227/actions.jsonl"
  for c in $CMDS; do check_refuse_named "C4 fourth=$fourth" "$c" "$T/runs/227" "$T/runs/227/actions.jsonl" "line 4"; done
done
mkR
{
  printf '%s\n' '{"action":"review-launch","target":"mimo","detail":"bug r1"}' '' '{broken'
} >"$T/runs/227/actions.jsonl"
for c in $CMDS; do check_ok "C4 three-lines" "$c" "$T/runs/227" 227-mimo 227-sol 227-rev-bug-mimo 227; done

# C5: the refusals that already print a message keep it word for word.
freshT
mkdir -p "$T/runs/227"
mkstubs
for c in $CMDS; do check_refuse_exact "C5 empty" "$c" "$T/runs/227" "host: run waybill has no synthesis worktree"; done
freshT
mkdir -p "$T/runs/227"
printf '## Dispatch\nname: #227, test\nsynthesis worktree: %s/repo/elsewhere/227\n' "$T" >"$T/runs/227/brief.md"
mkstubs
for c in $CMDS; do check_refuse_exact "C5 elsewhere" "$c" "$T/runs/227" "host: synthesis worktree is not under .worktrees"; done
mkR
printf '%s' '{broken' >"$T/runs/227/run.json"
printf '%s' '{broken' >"$T/runs/227/manifest.json"
for c in $CMDS; do check_refuse_exact "C5 lanes" "$c" "$T/runs/227" "host: run lane records unreadable"; done
mkR
printf '%s' '{broken' >"$T/runs/227/run.json"
printf '%s' '{broken' >"$T/runs/227/manifest.json"
printf '[["bug","mimo"]]' >"$T/runs/227/logs/review-r1.json"
for c in $CMDS; do check_refuse_exact "C5 lanes-first" "$c" "$T/runs/227" "host: run lane records unreadable"; done

# C6: the host suite passes, and its header count states the true sum.
C6OUT=$(bun test scripts/host.test.ts 2>&1)
C6CODE=$?
if [ "$C6CODE" -eq 0 ]; then ok "C6 host suite green"
else bad "C6 host suite exit=$C6CODE ($(printf '%s' "$C6OUT" | tail -n 5 | tr '\n' ';'))"; fi
HDR=$(sed -n '1p' scripts/host.test.ts | grep -o '[0-9][0-9]* controls' | grep -o '[0-9][0-9]*')
SUM=$(grep -o 'count: [0-9][0-9]*' scripts/host.test.ts | awk '{s+=$2} END {print s+0}')
if [ -n "$HDR" ] && [ "$HDR" = "$SUM" ]; then ok "C6 header count $HDR"
else bad "C6 header count (header=$HDR sum=$SUM)"; fi

echo "oracle-227: $ok passed, $bad failed"
[ "$bad" -eq 0 ]
