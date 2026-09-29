#!/usr/bin/env bash
# Oracle for #122: blind acceptance tests at the ticket's own interface.
#
# Written by the leg-1 coachman before reading any lane's diff, committed as the
# first commit on the ticket branch. It stages fixture runs (a done leg with a
# hand-off, a leg ended on a provider error, each wake case, a held run) and runs
# the worktree's scripts/runs-watch.sh against them through a shadow tool tree:
# a copy of the worktree's scripts/ and skills/ in which host.sh and launch.sh
# are stubs that record their argv, emulate a still-running leg (fake stream,
# marker cleared, never landed), and delegate every other verb to the real
# script. Nothing ever launches a real agent thread.
#
#   oracle-122.sh            run from the repo root; exit 0 when the worktree's
#                            watcher meets the ticket, 1 otherwise
#
# The probes assert behaviour the ticket names, not one implementation of it: a
# lane may keep its resume count where it likes, name its transient patterns as
# it likes, and add whatever helper scripts it likes, as long as the dispatch
# lands as Stage C says with a watcher detail, the resume fires on the ticket's
# named error and stops at three, every AC3 case wakes, and a held run is left
# alone. The take-probes first run the BASE watcher over the same fixture and
# require it to wake without acting, so a probe that cannot fail fails loudly.
# P14 (self-test wording) is heuristic by nature: it requires the watcher's own
# --self-test to pass and to print a control mentioning each step and each wake
# case. If a lane ever fails only P14, read its self-test before believing it.
set -uo pipefail

BASE_SHA=baa28c14245d68fd5a5b1e9b53afad549a39c8d4
NEW=scripts/runs-watch.sh
[ -f "$NEW" ] || { echo "oracle: run from the repo root: $NEW not found" >&2; exit 1; }

tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
printf '[postmaster]\npoll_seconds = 1\n' > "$tmp/config.toml"
mkdir -p "$tmp/fakerepo/.worktrees/oracle"

fails=0 rc=0 out=""
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; printf '%s\n' "$out" | sed 's/^/         /'; fails=$((fails+1)); }
has()  { case $out in *"$1"*) true ;; *) false ;; esac; }

install_stubs() {  # install_stubs <tool-dir>: stub host.sh and launch.sh, keeping the real ones
  local d=$1
  mv "$d/scripts/host.sh" "$d/scripts/host.real.sh"
  mv "$d/scripts/launch.sh" "$d/scripts/launch.real.sh"
  cat > "$d/scripts/host.sh" <<'STUB'
#!/usr/bin/env bash
# Oracle stub for host.sh: `run` records its argv, clears the marker like the
# real run does at start, writes a fake codex-shaped stream, and never lands
# the marker (the faked leg is still running); `name` answers a constant; any
# other verb is delegated to the real script.
set -uo pipefail
HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
if [ "${1:-}" = run ]; then
  printf 'STUB host %s\n' "$*" >> "$ORACLE_STUBLOG"
  out=""; marker=""; append=0; prev=""
  for a in "$@"; do
    case $prev in --out) out=$a; prev="";; --marker) marker=$a; prev="";; esac
    case $a in --out) prev=--out;; --marker) prev=--marker;; --append) append=1;; esac
  done
  [ -n "$marker" ] && rm -f -- "$marker"
  tid=ORACLE-NEW-THREAD
  if [ "$append" = 1 ]; then
    tid=$(printf '%s\n' "$*" | python3 -c 'import sys; t=sys.stdin.read().split()
try: print(t[t.index("resume")+4])
except (ValueError, IndexError): print("ORACLE-THREAD-1")')
  fi
  if [ -n "$out" ]; then
    if [ "$append" = 1 ]; then
      printf '{"type":"thread.started","thread_id":"%s"}\n' "$tid" >> "$out"
    else
      printf '{"type":"thread.started","thread_id":"%s"}\n' "$tid" > "$out"
    fi
  fi
  exit 0
fi
if [ "${1:-}" = name ]; then printf 'CALL host %s\n' "$*" >> "$ORACLE_STUBLOG"; echo ORACLE-HOST-NAME; exit 0; fi
printf 'REAL host %s\n' "$*" >> "$ORACLE_STUBLOG"
exec "$HERE/host.real.sh" "$@"
STUB
  cat > "$d/scripts/launch.sh" <<'STUB'
#!/usr/bin/env bash
# Oracle stub for launch.sh: launch/resume record their argv and print a fake
# codex-shaped stream; any other verb is delegated to the real script.
set -uo pipefail
HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
case "${1:-}" in
  launch|resume)
    printf 'STUB launch %s\n' "$*" >> "$ORACLE_STUBLOG"
    printf '{"type":"thread.started","thread_id":"ORACLE-NEW-THREAD"}\n'
    exit 0 ;;
  *)
    printf 'REAL launch %s\n' "$*" >> "$ORACLE_STUBLOG"
    exec "$HERE/launch.real.sh" "$@" ;;
esac
STUB
  chmod +x "$d/scripts/host.sh" "$d/scripts/launch.sh"
}

# The BASE shadow proves the take-probes non-vacuous; the NEW shadow is the worktree under test.
mkdir -p "$tmp/base" "$tmp/new"
git archive "$BASE_SHA" scripts skills 2>/dev/null | tar -x -C "$tmp/base" \
  || { echo "oracle: cannot read BASE $BASE_SHA" >&2; exit 1; }
cp -r scripts skills "$tmp/new/"
install_stubs "$tmp/base"
install_stubs "$tmp/new"

mkdispatch() {  # mkdispatch <root> <stage> <leg> [marker...]: a fixture run named oracle
  local root=$1 stage=$2 leg=$3; shift 3
  local d="$root/oracle" m
  mkdir -p "$d/logs" "$root/postmaster"
  cat > "$d/manifest.json" <<EOF
{"stage": "$stage", "leg": $leg, "base": "ORACLE",
 "lanes": {}, "coachman": {"legs": {"1": {"thread_id": "ORACLE-THREAD-1", "name": "coachman"}}}}
EOF
  cat > "$d/brief.md" <<EOF
# Waybill: oracle
turnpikes: style, bug, security

## Ticket
oracle fixture

## Project profile
repo: $tmp/fakerepo
tool: $tmp/new
EOF
  printf '{"config": {"team": {"coachman": {"harness": "codex", "model": "oracle"}}}}\n' > "$d/run.json"
  printf '{"written": "oracle", "repo": "%s", "head": "ORACLE", "checks": []}\n' "$tmp/fakerepo" > "$d/checks.json"
  : > "$d/run-log.md"
  for m in "$@"; do : > "$d/$m"; done
}

good_handoff() {  # good_handoff <dispatch>: a hand-off that passes handoff-check.sh
  local d=$1 s
  : > "$d/handoff-1.md"
  for s in Decisions "Deferred findings" "Verified by execution" Unverified "Branches and lanes" "Open questions" "Next leg"; do
    printf '## %s\noracle\n' "$s" >> "$d/handoff-1.md"
  done
}

bad_handoff() {  # bad_handoff <dispatch>: a hand-off missing its last section
  local d=$1 s
  : > "$d/handoff-1.md"
  for s in Decisions "Deferred findings" "Verified by execution" Unverified "Branches and lanes" "Open questions"; do
    printf '## %s\noracle\n' "$s" >> "$d/handoff-1.md"
  done
}

mktransient() {  # mktransient <dispatch> <err-text>: a leg ended with no hand-off
  local d=$1
  printf '{"type":"thread.started","thread_id":"ORACLE-THREAD-1"}\n' > "$d/logs/coachman-leg-1-events.jsonl"
  printf '%s\n' "$2" > "$d/logs/coachman-leg-1.err"
  : > "$d/.leg-1-exited"
}

run_watch() {  # run_watch <tool> <root> <timeout> <stublog>: run the shadow watcher once
  out=$(POSTMASTER_CONFIG="$tmp/config.toml" ORACLE_STUBLOG=$4 bash "$1/scripts/runs-watch.sh" --timeout "$3" "$2" 2>&1); rc=$?
}

leg_of() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["leg"])' "$1/manifest.json"; }
thread2_of() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["coachman"]["legs"]["2"]["thread_id"])' "$1/manifest.json"; }
count_action() { grep -cE "\"action\": ?\"$2\"" "$1/actions.jsonl" 2>/dev/null || true; }
count_stub() { grep -c '^STUB ' "$1" 2>/dev/null || true; }
clean() {  # clean <dispatch> <stublog> <leg>: no step taken and nothing launched
  local d=$1 s=$2 leg=$3
  [ ! -f "$d/actions.jsonl" ] \
    && [ "$(count_stub "$s")" = 0 ] \
    && [ "$(leg_of "$d")" = "$leg" ] \
    && [ -z "$(ls "$d"/leg-*-prompt.txt "$d"/leg-*-resume-*.txt 2>/dev/null)" ]
}

echo "P1 (AC1): a done leg with a checked hand-off is dispatched by the watcher"
root=$tmp/p1; mkdispatch "$root" checkpoint-1 1 .leg-1-done; good_handoff "$root/oracle"
: > "$root/stub-base.log"; run_watch "$tmp/base" "$root" 2 "$root/stub-base.log"
[ $rc -eq 0 ] && has "needs oracle DISPATCH" && clean "$root/oracle" "$root/stub-base.log" 1 \
  && ok "BASE wakes on DISPATCH and dispatches nothing" \
  || { fail "BASE wakes on DISPATCH and dispatches nothing"; }
: > "$root/stub.log"; run_watch "$tmp/new" "$root" 2 "$root/stub.log"
dispatch_detail=$(grep -E '"action": ?"dispatch"' "$root/oracle/actions.jsonl" 2>/dev/null || true)
[ $rc -eq 3 ] && ! has "needs oracle" \
  && [ -f "$root/oracle/leg-2-prompt.txt" ] \
  && grep -qi 'leg 2' "$root/oracle/leg-2-prompt.txt" && grep -qi 'coachman' "$root/oracle/leg-2-prompt.txt" \
  && [ "$(leg_of "$root/oracle")" = 2 ] \
  && [ "$(thread2_of "$root/oracle" 2>/dev/null)" = ORACLE-NEW-THREAD ] \
  && [ "$(count_action "$root/oracle" dispatch)" = 1 ] \
  && case $dispatch_detail in *[Ww][Aa][Tt][Cc][Hh][Ee][Rr]*) true;; *) false;; esac \
  && [ "$(count_stub "$root/stub.log")" = 1 ] \
  && grep -q '^STUB .*launch coachman' "$root/stub.log" && grep -q -- '--run' "$root/stub.log" \
  && ok "the watcher dispatches leg 2 as Stage C says and logs dispatch with a watcher detail" \
  || { out="$out / stub: $(cat "$root/stub.log" 2>/dev/null) / actions: $dispatch_detail"; fail "the watcher dispatches leg 2 as Stage C says and logs dispatch with a watcher detail"; }

echo "P2 (AC2): a leg ended on a transient provider error is resumed on its own thread"
root=$tmp/p2; mkdispatch "$root" synthesis 1
mktransient "$root/oracle" "provider error: model stream idle timeout: no data for 120s"
: > "$root/stub-base.log"; run_watch "$tmp/base" "$root" 2 "$root/stub-base.log"
[ $rc -eq 0 ] && has "needs oracle REMOUNT" && clean "$root/oracle" "$root/stub-base.log" 1 \
  && ok "BASE wakes on REMOUNT and resumes nothing" \
  || { fail "BASE wakes on REMOUNT and resumes nothing"; }
: > "$root/stub.log"; run_watch "$tmp/new" "$root" 2 "$root/stub.log"
prompt=$(ls "$root/oracle"/leg-1-resume-*.txt 2>/dev/null || true)
[ $rc -eq 3 ] && ! has "needs oracle" \
  && [ "$(count_stub "$root/stub.log")" = 1 ] \
  && grep -q '^STUB .*resume coachman' "$root/stub.log" && grep -q 'ORACLE-THREAD-1' "$root/stub.log" \
  && [ -n "$prompt" ] && grep -qi 'Continue leg 1' $prompt \
  && [ "$(count_action "$root/oracle" resume)" = 1 ] \
  && [ "$(leg_of "$root/oracle")" = 1 ] \
  && ok "the watcher resumes the leg on its own thread with the remount prompt and logs resume" \
  || { out="$out / stub: $(cat "$root/stub.log" 2>/dev/null) / prompt: $prompt"; fail "the watcher resumes the leg on its own thread with the remount prompt and logs resume"; }

echo "P3 (AC2): the fourth transient end in a leg goes to the postmaster"
root=$tmp/p3; mkdispatch "$root" synthesis 1
mktransient "$root/oracle" "provider error: model stream idle timeout: no data for 120s"
: > "$root/stub.log"
p3ok=1
for n in 1 2 3; do
  run_watch "$tmp/new" "$root" 2 "$root/stub.log"
  [ $rc -eq 3 ] && ! has "needs oracle" && [ "$(count_action "$root/oracle" resume)" = "$n" ] || p3ok=0
  mktransient "$root/oracle" "provider error: model stream idle timeout: no data for 120s"
done
[ "$(count_stub "$root/stub.log")" = 3 ] || p3ok=0
run_watch "$tmp/new" "$root" 2 "$root/stub.log"
[ $rc -eq 0 ] && has "needs oracle REMOUNT" \
  && [ "$(count_action "$root/oracle" resume)" = 3 ] \
  && [ "$(count_stub "$root/stub.log")" = 3 ] || p3ok=0
[ $p3ok = 1 ] \
  && ok "three transient ends resume, the fourth wakes the postmaster" \
  || { out="$out / resumes: $(count_action "$root/oracle" resume) stubs: $(count_stub "$root/stub.log")"; fail "three transient ends resume, the fourth wakes the postmaster"; }

echo "P4-P6 (AC3): an escalation, a checkpoint card and a ship card wake the postmaster"
root=$tmp/p4; mkdispatch "$root" review 2 .escalation-ready; : > "$root/stub.log"
run_watch "$tmp/new" "$root" 2 "$root/stub.log"
[ $rc -eq 0 ] && has "needs oracle RULE" && clean "$root/oracle" "$root/stub.log" 2 \
  && ok "an escalation wakes and nothing is taken" || { fail "an escalation wakes and nothing is taken"; }
root=$tmp/p5; mkdispatch "$root" review 2 .checkpoint-review-ready; : > "$root/stub.log"
run_watch "$tmp/new" "$root" 2 "$root/stub.log"
[ $rc -eq 0 ] && has "needs oracle READ" && clean "$root/oracle" "$root/stub.log" 2 \
  && ok "a checkpoint card wakes and nothing is taken" || { fail "a checkpoint card wakes and nothing is taken"; }
root=$tmp/p6; mkdispatch "$root" shipping 3 .card-ready; : > "$root/stub.log"
run_watch "$tmp/new" "$root" 2 "$root/stub.log"
[ $rc -eq 0 ] && has "needs oracle GATE" && clean "$root/oracle" "$root/stub.log" 3 \
  && ok "a ship card wakes and nothing is taken" || { fail "a ship card wakes and nothing is taken"; }

echo "P7-P10 (AC3): a wall, a refusal, an unknown end and a threadless leg wake the postmaster"
root=$tmp/p7; mkdispatch "$root" synthesis 1
mktransient "$root/oracle" "provider error: quota exceeded: monthly spend budget exhausted"; : > "$root/stub.log"
run_watch "$tmp/new" "$root" 2 "$root/stub.log"
[ $rc -eq 0 ] && has "needs oracle REMOUNT" && clean "$root/oracle" "$root/stub.log" 1 \
  && ok "a quota wall wakes and is never resumed" || { fail "a quota wall wakes and is never resumed"; }
root=$tmp/p8; mkdispatch "$root" synthesis 1
mktransient "$root/oracle" "launch: no such lane 'oracle'"; : > "$root/stub.log"
run_watch "$tmp/new" "$root" 2 "$root/stub.log"
[ $rc -eq 0 ] && has "needs oracle REMOUNT" && clean "$root/oracle" "$root/stub.log" 1 \
  && ok "a launch refusal wakes and is never resumed" || { fail "a launch refusal wakes and is never resumed"; }
root=$tmp/p9; mkdispatch "$root" synthesis 1
mktransient "$root/oracle" "AssertionError: oracleFoundNoSuchKey (a lane bug, not a provider error)"; : > "$root/stub.log"
run_watch "$tmp/new" "$root" 2 "$root/stub.log"
[ $rc -eq 0 ] && has "needs oracle REMOUNT" && clean "$root/oracle" "$root/stub.log" 1 \
  && ok "an unclassifiable end wakes and is never resumed" || { fail "an unclassifiable end wakes and is never resumed"; }
root=$tmp/p10; mkdispatch "$root" synthesis 1
python3 -c 'import json; p="'"$root"'/oracle/manifest.json"; m=json.load(open(p)); m["coachman"]={"legs": {}}; json.dump(m, open(p, "w"))'
: > "$root/oracle/logs/coachman-leg-1.err"; : > "$root/oracle/.leg-1-exited"; : > "$root/stub.log"
run_watch "$tmp/new" "$root" 2 "$root/stub.log"
[ $rc -eq 0 ] && has "needs oracle REMOUNT" && clean "$root/oracle" "$root/stub.log" 1 \
  && ok "a leg with no thread id wakes and is never resumed" || { fail "a leg with no thread id wakes and is never resumed"; }

echo "P11-P12 (AC3): INSPECT and a step the watcher cannot complete wake the postmaster"
root=$tmp/p11; mkdispatch "$root" synthesis 1
python3 -c 'import os, sys, time
t = time.time() - 3600
for dp, dn, fn in os.walk(sys.argv[1]):
    for f in fn: os.utime(os.path.join(dp, f), (t, t))' "$root/oracle"
: > "$root/stub.log"
run_watch "$tmp/new" "$root" 2 "$root/stub.log"
[ $rc -eq 0 ] && has "needs oracle INSPECT" && clean "$root/oracle" "$root/stub.log" 1 \
  && ok "an idle run wakes for INSPECT and nothing is taken" || { fail "an idle run wakes for INSPECT and nothing is taken"; }
root=$tmp/p12; mkdispatch "$root" checkpoint-1 1 .leg-1-done; bad_handoff "$root/oracle"; : > "$root/stub.log"
run_watch "$tmp/new" "$root" 2 "$root/stub.log"
[ $rc -eq 0 ] && has "needs oracle DISPATCH" && clean "$root/oracle" "$root/stub.log" 1 \
  && ok "a hand-off that fails its check wakes and is never dispatched" || { fail "a hand-off that fails its check wakes and is never dispatched"; }

echo "P13 (AC4): a held run is left alone"
root=$tmp/p13; mkdispatch "$root" checkpoint-1 1 .leg-1-done; good_handoff "$root/oracle"
printf 'oracle\n' > "$root/postmaster/held"; : > "$root/stub.log"
run_watch "$tmp/new" "$root" 2 "$root/stub.log"
[ $rc -eq 3 ] && ! has "needs " && clean "$root/oracle" "$root/stub.log" 1 \
  && ok "a held dispatch-ready run is left alone" || { fail "a held dispatch-ready run is left alone"; }

echo "P14 (AC5): the watcher's self-test passes and names each step and wake case"
selfout=$(bash scripts/runs-watch.sh --self-test 2>&1); selfrc=$?
selfmiss=""
for kw in dispatch resume held refus inspect; do
  grep -qi -- "$kw" <<<"$selfout" || selfmiss="$selfmiss $kw"
done
for grp in 'checkpoint|read:checkpoint/READ' 'card|gate:ship-card/GATE' 'escalation|rule:escalation/RULE' 'quota|wall:quota/wall'; do
  kw=${grp%%:*}; name=${grp##*:}
  grep -qiE "(^|[^a-z])($kw)([^a-z]|$)" <<<"$selfout" || selfmiss="$selfmiss $name"
done
grep -qiE 'incomplete|could not|cannot|fail|bad|invalid|missing' <<<"$selfout" || selfmiss="$selfmiss incomplete-step"
[ $selfrc -eq 0 ] && [ -z "$selfmiss" ] \
  && ok "the self-test passes and names each step and each wake case" \
  || { out="exit $selfrc missing:$selfmiss / $(printf '%s\n' "$selfout" | tail -n 20)"; fail "the self-test passes and names each step and each wake case"; }

echo "P15 (guard): a leg at work is left waiting"
root=$tmp/p15; mkdispatch "$root" synthesis 1; : > "$root/stub.log"
run_watch "$tmp/new" "$root" 2 "$root/stub.log"
[ $rc -eq 3 ] && ! has "needs " && clean "$root/oracle" "$root/stub.log" 1 \
  && ok "a leg at work is left waiting" || { fail "a leg at work is left waiting"; }

echo
[ "$fails" -eq 0 ] && { echo "oracle-122: all probes behaved"; exit 0; }
echo "oracle-122: $fails probe(s) misbehaved"; exit 1
