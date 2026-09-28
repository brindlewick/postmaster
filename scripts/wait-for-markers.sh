#!/usr/bin/env bash
# Block until <count> files matching <glob> exist directly under <dir>, or <timeout> seconds
# pass. The wait goes in the SAME command as the launch that will produce the markers; a turn
# that ends between launching a round and collecting it is a round nobody collects.
#
#   wait-for-markers.sh <dir> <glob> <count> <timeout-seconds>
#   wait-for-markers.sh --self-test
#
# It looks every 20 seconds, and once more at the timeout, so the timeout is kept to the second.
# The timeout counts the seconds it has slept, so time the machine spends asleep is not counted,
# and a clock set forward does not end the wait early. A count or a timeout is at most 9 digits.
#
#   exit 0  all markers present
#   exit 3  timeout; the matches that did arrive are listed
#   exit 1  usage, a count or timeout that is not a whole number, or the reader failed its own
#           control
#
# Control: before polling, the reader is proved both ways through the identical find. It must
# count a marker this script plants (positive control) and count zero for a pattern that cannot
# match (negative control). A poller that can only ever say 0 is indistinguishable from lanes
# that are still working, so it reads as patience rather than as a broken instrument.
set -uo pipefail
if [ "${1:-}" = --self-test ]; then
  # Each control runs this script on a directory of planted markers.
  self=$(CDPATH= cd -P -- "$(dirname "$0")" && pwd -P)/$(basename "$0")
  tmp=$(mktemp -d) || exit 1
  trap 'chmod -R u+w "$tmp" 2>/dev/null; rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
  d="$tmp/logs"; mkdir "$d"
  fails=0 out="" rc=0 took=0
  ok()   { printf '  ok   %s\n' "$1"; }
  fail() { printf '  FAIL %s (exit %s, %ss)\n' "$1" "$rc" "$took"; printf '%s\n' "$out" | sed 's/^/         /'; fails=$((fails+1)); }
  run() { local t0; t0=$(date +%s); out=$("$self" "$@" 2>&1); rc=$?; took=$(( $(date +%s) - t0 )); }
  has() { case $out in *"$1"*) true ;; *) false ;; esac; }

  echo "positive controls"
  touch "$d/review-r1-bug-one.done" "$d/review-r1-bug-two.done"
  run "$d" 'review-r1-*.done' 2 5
  [ $rc -eq 0 ] && [ "$out" = "all 2 markers present" ] && [ "$took" -le 1 ] \
    && ok "markers already in are collected at once" || fail "markers already in are collected at once"
  ( sleep 1; touch "$d/review-r2-bug-one.done" ) &
  run "$d" 'review-r2-*.done' 1 3
  [ $rc -eq 0 ] && [ "$out" = "all 1 markers present" ] \
    && ok "a marker that lands during the wait is collected by the timeout" || fail "a marker that lands during the wait is collected by the timeout"
  for i in 1 2 3 4 5 6 7 8 9; do touch "$d/review-r5-bug-$i.done"; done
  run "$d" 'review-r5-*.done' 010 1
  [ $rc -eq 3 ] && has "9 of 10 markers" \
    && ok "a count with a leading zero is decimal: 010 is ten, which nine markers do not meet" \
    || fail "a count with a leading zero is decimal: 010 is ten, which nine markers do not meet"

  echo "negative controls"
  touch "$d/review-r3-bug-one.done" "$d/review-r4-bug-two.done"
  run "$d" 'review-r3-*.done' 2 1
  [ $rc -eq 3 ] && has "WAIT-TIMEOUT after 1s: 1 of 2 markers matching review-r3-*.done" \
    && has "present: $d/review-r3-bug-one.done" && ! has "review-r4" \
    && ok "a missing marker times out, and another round's marker is not counted" \
    || fail "a missing marker times out, and another round's marker is not counted"
  [ $rc -eq 3 ] && [ "$took" -le 3 ] && ok "the timeout is kept to the second, not the next 20-second look" \
    || fail "the timeout is kept to the second, not the next 20-second look"
  mkdir "$tmp/clock"   # a clock that jumps an hour ahead after its first reading, as after a sleep
  printf '#!/bin/sh\nf=%s/clock/n; n=$(cat "$f" 2>/dev/null || echo 0); echo $((n + 1)) > "$f"\nexec /bin/date "$@" -d "@$(( $(/bin/date +%%s) + n * 3600 ))"\n' "$tmp" > "$tmp/clock/date"
  chmod +x "$tmp/clock/date"
  t0=$(date +%s); out=$(PATH="$tmp/clock:$PATH" "$self" "$d" 'review-r3-*.done' 2 2 2>&1); rc=$?; took=$(( $(date +%s) - t0 ))
  [ $rc -eq 3 ] && [ "$took" -ge 2 ] && ok "a clock that jumps ahead does not end the wait early" \
    || fail "a clock that jumps ahead does not end the wait early"
  run "$d" 'review-r1-*.done' two 5
  [ $rc -eq 1 ] && ! has "markers present" && ok "a count that is not a number is refused, not read as every marker in" \
    || fail "a count that is not a number is refused, not read as every marker in"
  run "$d" 'review-r1-*.done' 2 soon
  [ $rc -eq 1 ] && ok "a timeout that is not a number is refused" || fail "a timeout that is not a number is refused"
  run "$d" 'review-r1-*.done' 2 9999999999999999999
  [ $rc -eq 1 ] && has "more than 9 digits" && ok "a timeout past 9 digits is refused, never wrapped round to a past deadline" \
    || fail "a timeout past 9 digits is refused, never wrapped round to a past deadline"
  run "$tmp/nowhere" 'review-r1-*.done' 2 1
  [ $rc -eq 1 ] && has "no such dir" && ok "a directory that does not exist is refused" || fail "a directory that does not exist is refused"
  if [ "$(id -u)" -ne 0 ]; then
    chmod a-w "$d"; run "$d" 'review-r1-*.done' 2 1; chmod u+w "$d"
    [ $rc -eq 1 ] && has "reader failed its control (positive=0" \
      && ok "a reader that cannot see its own planted marker stops the wait" \
      || fail "a reader that cannot see its own planted marker stops the wait"
  else
    echo "  skip a reader that cannot see its own planted marker (root writes anywhere)"
  fi

  echo
  [ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
  echo "self-test: $fails control(s) misbehaved"; exit 1
fi

DIR=${1:?usage: wait-for-markers.sh <dir> <glob> <count> <timeout-seconds> | --self-test}
GLOB=${2:?}
COUNT=${3:?}
TIMEOUT=${4:?}
for n in "$COUNT" "$TIMEOUT"; do
  case $n in *[!0-9]*) echo "wait-for-markers: '$n' is not a whole number of markers or seconds" >&2; exit 1 ;; esac
  m=${n#"${n%%[!0]*}"}
  [ ${#m} -le 9 ] || { echo "wait-for-markers: '$n' is more than 9 digits" >&2; exit 1; }
done
COUNT=$((10#$COUNT)) TIMEOUT=$((10#$TIMEOUT))

DIR=$(CDPATH= cd -P -- "$DIR" 2>/dev/null && pwd -P) || { echo "wait-for-markers: no such dir: $1" >&2; exit 1; }
count() { find "$DIR" -maxdepth 1 -name "$1" 2>/dev/null | wc -l | tr -d ' '; }

probe="$DIR/.wait-for-markers-control.$$"
: > "$probe"
pos=$(count ".wait-for-markers-control.$$")
neg=$(count ".wait-for-markers-impossible-$$-*")
rm -f "$probe"
[ "$pos" -eq 1 ] && [ "$neg" -eq 0 ] \
  || { echo "wait-for-markers: reader failed its control (positive=$pos negative=$neg)" >&2; exit 1; }

left=$TIMEOUT
while [ "$(count "$GLOB")" -lt "$COUNT" ]; do
  if [ "$left" -le 0 ]; then
    echo "WAIT-TIMEOUT after ${TIMEOUT}s: $(count "$GLOB") of $COUNT markers matching $GLOB"
    find "$DIR" -maxdepth 1 -name "$GLOB" 2>/dev/null | sed 's/^/  present: /'
    exit 3
  fi
  nap=$(( left < 20 ? left : 20 ))
  sleep "$nap"
  left=$(( left - nap ))
done
echo "all $COUNT markers present"
exit 0
