#!/usr/bin/env bash
# Oracle for #57: blind acceptance tests at the ticket's own interface.
#
# Written by the leg-1 coachman before reading any lane's diff, committed as the
# first commit on the ticket branch. It checks properties the ticket names, never
# one phrasing of them: one script for a leg's launch, resume and takeover, found
# as a script under scripts/ changed vs BASE with the launch/resume/takeover and
# outcome vocabulary; the runbook no longer writing its own markers, redirects or
# stream paths; the outcome record read mechanically, never from .err text;
# runs-status.sh reporting the next action with the REMOUNT rules gone; a stated
# on-answer action for a refused resume (it delivers its prompt) and for a wall
# on the fallback; walls counting before or after the first event; the waiting
# list kept by a script; and the self-test's controls, including an env file that
# fails to load and a resume refused after the leg has a thread id.
#
#   oracle-57.sh            run from the repo root; exit 0 when the worktree meets
#                           the ticket, 1 otherwise, one line per probe
#
# BASE calibration (c994e8f): 2/20 pass (P7, P11 are guards that already hold);
# the other 18 fail. A lane passes a probe only by implementing the ticket.
#
# Wording-sensitive probes (P12, P13, P14, P18, P19, P20) match ticket-literal
# words (deliver/prompt, answer, first event, env/fail, resume/refuse/thread). A
# lane that implements the behavior under other words faults the probe by wording;
# adjudicate those literally at synthesis, as #38 did, not as failures.
#
# Deferred to synthesis against the decided contract (the record's name and shape
# are the lanes' to choose, so no blind fixture can build one): the behavioral
# record -> runs-status -> postmaster-action matrix for each outcome, the
# wall-before/after-first-event takeover end to end, the refused resume delivering
# its carried prompt end to end, and legacy shapes.
set -uo pipefail

BASE_SHA=c994e8f2558d4176e3f18573ee4fb6a267597e31
PM=skills/postmaster/postmaster.md
[ -f "$PM" ] || { echo "oracle: run from the repo root: $PM not found" >&2; exit 1; }

fail=0
pass() { echo "PASS $1: $2"; }
nope() { echo "FAIL $1: $2"; fail=1; }

# near <file> <n> <patA> <patB>: an A-line within n lines of a B-line (case-insensitive).
near() {
  local file=$1 n=$2 a=$3 b=$4 la lb x y d
  la=$(grep -n -iE -e "$a" "$file" 2>/dev/null | cut -d: -f1)
  lb=$(grep -n -iE -e "$b" "$file" 2>/dev/null | cut -d: -f1)
  [ -z "$la" ] || [ -z "$lb" ] && return 1
  for x in $la; do for y in $lb; do
    d=$(( x > y ? x - y : y - x ))
    [ "$d" -le "$n" ] && return 0
  done; done
  return 1
}

# after_within <file> <n> <patA> <patB>: a B-line within n lines AFTER an A-line.
after_within() {
  local file=$1 n=$2 a=$3 b=$4 la lb x y
  la=$(grep -n -iE -e "$a" "$file" 2>/dev/null | cut -d: -f1)
  lb=$(grep -n -iE -e "$b" "$file" 2>/dev/null | cut -d: -f1)
  [ -z "$la" ] || [ -z "$lb" ] && return 1
  for x in $la; do for y in $lb; do
    [ "$y" -ge "$x" ] && [ $((y - x)) -le "$n" ] && return 0
  done; done
  return 1
}

# code <file>: the file without full-line comments.
code() { grep -v '^[[:space:]]*#' "$1"; }

# --- the leg script (AC1, AC2): discovered, never named ------------------------
# The ticket names no script, so the interface is the lanes' to choose: either
# host.sh extended or one script beside it ("in it or beside it, not in a second
# launcher"). The oracle finds it as a script under scripts/ changed vs BASE
# that carries the launch/resume/takeover vocabulary and all five outcomes.
CHANGED=$(git diff --name-only "$BASE_SHA" HEAD -- scripts/ 2>/dev/null || true)
BASE_CALLS=$(git show "$BASE_SHA:$PM" 2>/dev/null | grep -o '<tool>/scripts/[a-z0-9-]*\.sh' | sort -u || true)
NEW_CALLS=$(grep -o '<tool>/scripts/[a-z0-9-]*\.sh' "$PM" | sort -u | comm -23 - <(printf '%s\n' "$BASE_CALLS") || true)
LEG=""
for f in $CHANGED; do
  [ -f "$f" ] || continue
  if grep -qi 'launch' "$f" && grep -qi 'resume' "$f" \
      && grep -qiE 'takeover|take over|take-over' "$f" \
      && grep -qi 'refus' "$f" && grep -qi 'thread' "$f" \
      && grep -qi 'wall' "$f" && grep -qiE 'hand-?off' "$f" \
      && grep -qiE 'finish|complete' "$f"; then
    LEG="$LEG $f"
  fi
done
LEG=${LEG# }

if [ "$(echo "$LEG" | wc -w)" -eq 1 ]; then
  CALLED="<tool>/$LEG"
  if printf '%s\n' "$NEW_CALLS" | grep -qxF "$CALLED" || [ "$LEG" = scripts/host.sh ]; then
    pass P1-leg-script "one leg script, called from the runbook: $LEG (changed vs BASE)"
  else
    nope P1-leg-script "$LEG matches but the runbook does not newly call it (new calls: $(echo $NEW_CALLS | tr '\n' ' '))"
  fi
else
  nope P1-leg-script "want exactly one changed scripts/*.sh with launch/resume/takeover and all five outcomes (changed: $(echo $CHANGED | tr '\n' ' '); matching: $(echo $LEG | tr '\n' ' '))"
fi

# P2: it parses and its self-test passes; its output is kept for P20.
SELFTEST_LOG=/tmp/oracle-57-selftest.$$.log
if [ -z "$LEG" ] || [ "$(echo "$LEG" | wc -w)" -ne 1 ]; then
  nope P2-self-test "no single leg script to test"
else
  bash -n "$LEG" 2>/dev/null || nope P2-self-test "$LEG does not parse"
  if bash "$LEG" --self-test >"$SELFTEST_LOG" 2>&1; then
    pass P2-self-test "$LEG --self-test exits 0"
  else
    nope P2-self-test "$LEG --self-test exits nonzero"
  fi
fi

# --- the runbook calls one script (AC1, direction) ------------------------------
n=$(grep -c -- '--marker' "$PM")
[ "$n" -eq 0 ] && pass P3-no-marker "postmaster.md writes no --marker itself" \
  || nope P3-no-marker "postmaster.md still writes $n --marker lines itself"
n=$(grep -c 'launch\.sh \(launch\|resume\)' "$PM")
[ "$n" -eq 0 ] && pass P4-no-launchsh "postmaster.md invokes no launch.sh launch/resume itself" \
  || nope P4-no-launchsh "postmaster.md still invokes launch.sh launch/resume $n times"
n=$(grep -c 'host\.sh run' "$PM")
[ "$n" -eq 0 ] && pass P5-no-hostrun "postmaster.md runs no host.sh run itself" \
  || nope P5-no-hostrun "postmaster.md still runs host.sh run $n times"
n=$(grep -c 'coachman-leg-<n>' "$PM")
[ "$n" -eq 0 ] && pass P6-no-streampath "postmaster.md writes no leg stream path itself" \
  || nope P6-no-streampath "postmaster.md still writes $n leg stream paths itself"

# --- the record is mechanical, never from .err text (AC2) -----------------------
n=$(code scripts/runs-status.sh | grep -c '\.err')
[ "$n" -eq 0 ] && pass P7-no-err-status "runs-status.sh reads no .err text (guard)" \
  || nope P7-no-err-status "runs-status.sh reads .err text $n times"
if [ -n "$LEG" ] && [ "$(echo "$LEG" | wc -w)" -eq 1 ]; then
  n=$(code "$LEG" | grep -c '\.err')
  [ "$n" -eq 0 ] && pass P8-no-err-leg "$LEG reads no .err text" \
    || nope P8-no-err-leg "$LEG reads .err text $n times"
else
  nope P8-no-err-leg "no single leg script to read"
fi

# --- runs-status.sh reports the next action; REMOUNT rules gone (AC3) ------------
n=$(grep -c 'REMOUNT' "$PM")
[ "$n" -eq 0 ] && pass P9-no-remount "postmaster.md carries no REMOUNT rules" \
  || nope P9-no-remount "postmaster.md still carries REMOUNT $n times"
n=$(code scripts/runs-status.sh | grep -c 'outcome')
[ "$n" -ge 1 ] && pass P10-status-record "runs-status.sh reads the outcome record" \
  || nope P10-status-record "runs-status.sh never names the outcome record in code"
tmp=$(mktemp -d); mkdir -p "$tmp/root/9/logs"
printf '{"stage":"review","leg":1}\n' > "$tmp/root/9/manifest.json"
touch "$tmp/root/9/brief.md" "$tmp/root/9/.leg-1-exited"
if out=$(bash scripts/runs-status.sh "$tmp/root" 2>&1) && echo "$out" | grep -q '^9 '; then
  pass P11-status-legacy "runs-status.sh reports a spent-leg fixture (guard)"
else
  nope P11-status-legacy "runs-status.sh fails a spent-leg fixture: $(echo "$out" | head -2 | tr '\n' ' ')"
fi
rm -rf "$tmp"

# --- every user-bound outcome states its on-answer action (AC4) ------------------
rlines=$(grep -n -iE 'refus' "$PM" | cut -d: -f1)
dlines=$(grep -n -i 'deliver' "$PM" | grep -i 'prompt' | cut -d: -f1)
found=1
for x in $rlines; do for y in $dlines; do
  d=$(( x > y ? x - y : y - x )); [ "$d" -le 8 ] && found=0
done; done
if [ "$found" -eq 0 ] || code scripts/runs-status.sh | grep -qi 'deliver'; then
  pass P12-refused-delivers "an answered refusal delivers the prompt it was carrying"
else
  nope P12-refused-delivers "no deliver+prompt within 8 lines of a refusal"
fi
if after_within "$PM" 6 'fallback.*user|user.*fallback' 'answer' \
   || code scripts/runs-status.sh | grep -qi 'answer'; then
  pass P13-fallback-answer "a wall on the fallback states its on-answer action"
else
  nope P13-fallback-answer "no answer within 6 lines after a fallback wall goes to the user"
fi

# --- walls take over on the fallback wherever they fell (AC5) --------------------
WALLPOS=""
for f in scripts/*.sh; do
  near "$f" 10 'wall' 'first event|no event|empty stream|before.*event' && WALLPOS="$WALLPOS $f"
done
WALLPOS=${WALLPOS# }
[ -n "$WALLPOS" ] && pass P14-wall-position "a wall counts before or after the first event:$WALLPOS" \
  || nope P14-wall-position "no script relates walls to stream position"
if code scripts/runs-status.sh | grep -qi 'fallback' \
   || { [ -n "$LEG" ] && [ "$(echo "$LEG" | wc -w)" -eq 1 ] && grep -qi 'fallback' "$LEG"; }; then
  pass P15-fallback-scripted "fallback routing is scripted"
else
  nope P15-fallback-scripted "no fallback in runs-status.sh code or the leg script"
fi

# --- the waiting list is kept by a script (AC6) -----------------------------------
WAITSCRIPTS=""
for f in scripts/*.sh; do
  case $(basename "$f") in runs-status.sh|runs-watch.sh) continue;; esac
  grep -qiE 'waiting-on-user|waiting list' "$f" && WAITSCRIPTS="$WAITSCRIPTS $f"
done
WAITSCRIPTS=${WAITSCRIPTS# }
if [ -n "$WAITSCRIPTS" ] \
   || code scripts/runs-status.sh | grep -qiE 'waiting.*(add|remove|record|append)|(add|remove|record|append).*waiting'; then
  pass P16-waiting-script "a script keeps the waiting list:$WAITSCRIPTS"
else
  nope P16-waiting-script "the waiting list is still hand-edited"
fi
STAGEE=$(grep -n '^## Stage E' "$PM" | cut -d: -f1)
NAMED=""
for ln in $(grep -n 'ESCALATION\.md' "$PM" | cut -d: -f1); do
  [ "$ln" -lt "$STAGEE" ] && continue
  NAMED="$NAMED $(sed -n "$((ln-4)),$((ln+4))p" "$PM" | grep -o '<tool>/scripts/[a-z0-9-]*\.sh' | sed 's|<tool>/||')"
done
NAMED=$(echo "$NAMED" | tr ' ' '\n' | grep . | sort -u | tr '\n' ' ')
if [ -n "$NAMED" ]; then
  ok=1
  for s in $NAMED; do
    bash "$s" --self-test >/dev/null 2>&1 || { ok=0; nope P17-waiting-called "$s --self-test exits nonzero"; }
  done
  [ "$ok" = 1 ] && pass P17-waiting-called "postmaster.md names waiting-list script(s), self-test green:$NAMED"
else
  nope P17-waiting-called "postmaster.md names no script near its waiting-list step"
fi

# --- positive and negative controls per outcome (AC7) ------------------------------
if [ -n "$LEG" ] && [ "$(echo "$LEG" | wc -w)" -eq 1 ] \
    && near "$LEG" 5 'env' 'fail|invalid|bad|unload|missing'; then
  pass P18-env-control "self-test covers an env file that fails to load"
else
  nope P18-env-control "no env failure control in ${LEG:-no leg script}"
fi
if [ -n "$LEG" ] && [ "$(echo "$LEG" | wc -w)" -eq 1 ] \
    && near "$LEG" 5 'resum' 'refus' && near "$LEG" 10 'resum' 'thread'; then
  pass P19-refused-resume-control "self-test covers a resume refused after the leg has a thread id"
else
  nope P19-refused-resume-control "no refused-resume-with-thread-id control in ${LEG:-no leg script}"
fi
if [ -f "$SELFTEST_LOG" ] \
    && grep -qi 'refus' "$SELFTEST_LOG" \
    && grep -qi 'thread' "$SELFTEST_LOG" \
    && grep -qi 'wall' "$SELFTEST_LOG" \
    && grep -qiE 'hand-?off' "$SELFTEST_LOG" \
    && grep -qiE 'finish|complete' "$SELFTEST_LOG"; then
  pass P20-outcome-span "self-test output covers every outcome"
else
  nope P20-outcome-span "self-test output does not cover every outcome"
fi
rm -f "$SELFTEST_LOG"

echo "oracle-57: $([ "$fail" -eq 0 ] && echo PASS || echo FAIL)"
exit "$fail"
