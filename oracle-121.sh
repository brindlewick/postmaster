#!/usr/bin/env bash
# Oracle for #121: the coachman's blind acceptance tests, written from the ticket
# before any lane's diff was read, committed as the first commit on the ticket
# branch. Tests runs-watch.sh at the ticket's interface only:
#   scripts/runs-watch.sh <runs> [--timeout <seconds>]
# Exit-code and table assertions only. The exact wording with which the script
# "names each run that needs it with its NEXT" is the implementer's choice, so
# this oracle does not pin it; the review leg judges it by reading.
#
# Usage: oracle-121.sh <repo-root>
#   The repo root must hold scripts/runs-watch.sh; fixtures live under mktemp.
set -uo pipefail

ROOT=${1:?usage: oracle-121.sh <repo-root>}
WATCH=$ROOT/scripts/runs-watch.sh
[ -x "$WATCH" ] || { echo "oracle: no runs-watch.sh at $WATCH"; exit 1; }

tmp=$(mktemp -d) || exit 1
trap 'rm -rf -- "$tmp" </dev/null 2>/dev/null' EXIT
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; fails=$((fails+1)); }

# mkhome <name> [poll]: fixture HOME with .postmaster/config.toml (poll omitted = no config)
mkhome() {
  local h=$tmp/home-$1 runs
  runs=$h/.postmaster/runs/proj
  mkdir -p "$runs/postmaster"
  if [ $# -ge 2 ]; then printf '[postmaster]\npoll_seconds = %s\n' "$2" > "$h/.postmaster/config.toml"; fi
  printf '%s' "$runs"
}
# mkrun <runs> <name> <stage> <leg> [marker...]
mkrun() {
  local runs=$1 name=$2 stage=$3 leg=$4 m d=$1/$2
  shift 4; mkdir -p "$d/logs"
  printf '{"stage": "%s", "leg": %s}\n' "$stage" "$leg" > "$d/manifest.json"
  : > "$d/run-log.md"
  for m in "$@"; do : > "$d/$m"; done
}
# age <runs> <name>: nothing in the run changed for an hour
age() {
  python3 -c 'import os, sys, time
t = time.time() - 3600
for dp, dn, fn in os.walk(sys.argv[1]):
    for f in fn:
        os.utime(os.path.join(dp, f), (t, t))' "$1/$2"
}
# watch <home> <runs> [args...]: run the watcher with fixture HOME, capture output+exit
WOUT=; WEXIT=0
watch() {
  local home=$1 runs=$2; shift 2
  WOUT=$(HOME=$home timeout 120 bash "$WATCH" "$runs" "$@" 2>&1); WEXIT=$?
}
has_table() { printf '%s' "$WOUT" | grep -q '^RUN .* NEXT'; }

echo "positive controls: an actionable run makes it return 0"
# RULE
r=$(mkhome rule 1); h=$tmp/home-rule; mkrun "$r" alpha review 2 .escalation-ready
watch "$h" "$r" --timeout 25
[ "$WEXIT" -eq 0 ] && ok "RULE run returns 0" || fail "RULE run returns 0 (exit $WEXIT)"
has_table && ok "RULE output prints the table" || fail "RULE output prints the table"

# GATE
r=$(mkhome gate 1); h=$tmp/home-gate; mkrun "$r" alpha shipping 3 .card-ready
watch "$h" "$r" --timeout 25
[ "$WEXIT" -eq 0 ] && ok "GATE run returns 0" || fail "GATE run returns 0 (exit $WEXIT)"

# DISPATCH
r=$(mkhome dispatch 1); h=$tmp/home-dispatch; mkrun "$r" alpha review 2 .leg-2-done
watch "$h" "$r" --timeout 25
[ "$WEXIT" -eq 0 ] && ok "DISPATCH run returns 0" || fail "DISPATCH run returns 0 (exit $WEXIT)"

# REMOUNT
r=$(mkhome remount 1); h=$tmp/home-remount; mkrun "$r" alpha review 2 .leg-2-exited
watch "$h" "$r" --timeout 25
[ "$WEXIT" -eq 0 ] && ok "REMOUNT run returns 0" || fail "REMOUNT run returns 0 (exit $WEXIT)"

# READ
r=$(mkhome read 1); h=$tmp/home-read; mkrun "$r" alpha review 2 .checkpoint-1-ready
watch "$h" "$r" --timeout 25
[ "$WEXIT" -eq 0 ] && ok "READ run returns 0" || fail "READ run returns 0 (exit $WEXIT)"

# INSPECT (stale, no markers)
r=$(mkhome inspect 1); h=$tmp/home-inspect; mkrun "$r" alpha review 2; age "$r" alpha
watch "$h" "$r" --timeout 25
[ "$WEXIT" -eq 0 ] && ok "INSPECT run returns 0" || fail "INSPECT run returns 0 (exit $WEXIT)"

# Held actionable run beside an unheld one: still returns 0 (held never needs it, other does)
r=$(mkhome mixed 1); h=$tmp/home-mixed
mkrun "$r" alpha review 2 .escalation-ready; mkrun "$r" beta review 2 .escalation-ready
printf 'alpha\n' > "$r/postmaster/held"
watch "$h" "$r" --timeout 25
[ "$WEXIT" -eq 0 ] && ok "held+unheld actionable returns 0" || fail "held+unheld actionable returns 0 (exit $WEXIT)"

echo "negative controls: nothing actionable waits until the timeout, exit 3"
# WAIT
r=$(mkhome wait 1); h=$tmp/home-wait; mkrun "$r" alpha review 2
watch "$h" "$r" --timeout 4
[ "$WEXIT" -eq 3 ] && ok "WAIT run waits to timeout (3)" || fail "WAIT run waits to timeout (exit $WEXIT)"
has_table && ok "timeout output prints the table" || fail "timeout output prints the table"

# USER
r=$(mkhome user 1); h=$tmp/home-user; mkrun "$r" alpha review 2 .waiting-on-user
watch "$h" "$r" --timeout 4
[ "$WEXIT" -eq 3 ] && ok "USER run waits to timeout (3)" || fail "USER run waits to timeout (exit $WEXIT)"

# closed
r=$(mkhome closed 1); h=$tmp/home-closed; mkrun "$r" alpha done 3 .leg-3-done
watch "$h" "$r" --timeout 4
[ "$WEXIT" -eq 3 ] && ok "closed run waits to timeout (3)" || fail "closed run waits to timeout (exit $WEXIT)"

# held actionable run alone: never needs the postmaster
r=$(mkhome held 1); h=$tmp/home-held; mkrun "$r" alpha review 2 .escalation-ready
printf 'alpha\n' > "$r/postmaster/held"
watch "$h" "$r" --timeout 4
[ "$WEXIT" -eq 3 ] && ok "held RULE run waits to timeout (3)" || fail "held RULE run waits to timeout (exit $WEXIT)"

# no config file: default poll, still runs (all-WAIT root times out)
r=$(mkhome noconfig); h=$tmp/home-noconfig; mkrun "$r" alpha review 2
watch "$h" "$r" --timeout 4
[ "$WEXIT" -eq 3 ] && ok "missing config still runs (3)" || fail "missing config still runs (exit $WEXIT)"

echo
[ "$fails" -eq 0 ] && { echo "oracle-121: all controls behaved"; exit 0; }
echo "oracle-121: $fails control(s) misbehaved"; exit 1
