#!/usr/bin/env bash
# Blind acceptance oracle for #259: what only degrades on macOS is fixed, or stated.
#
# Written from the ticket's agents' checks (C1-C9) before any lane's diff
# existed. It runs from the repository root of the implementation under
# test: `bash oracle-259.sh`. Exit 0 when every check passes, 1 otherwise.
# A SKIP marks a control the machine cannot run (named with its reason).
#
# Interface readings this oracle pins (all from the ticket's own words):
# - C1 runs with a PATH holding no timeout, tmux or real herdr, so the
#   fixed run must print host=none (the check allows tmux or none).
# - C3's "review-round check" is the restart check wait runs first: wait
#   exits 1 naming the restart, or 0 when the boot still matches.
# - C3's "forced" run sets POSTMASTER_PROC_ROOT at a folder that does not
#   exist, as #217's test setting names it.
# - C4's Mac-numbers case needs an implementation seam; without one it
#   skips, and the lane's own tests carry that case.
# - C8 counts lines saying launches run without memory/process limits.
# - C9 pins the section's place and shape; its prose is judged by reading.
set -uo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
RUN="$ROOT/scripts/run"
TIMEOUT=/usr/bin/timeout

for t in git bun mkfifo mktemp; do
  command -v "$t" >/dev/null || { echo "oracle-259: needs $t on PATH"; exit 2; }
done
[ -x "$TIMEOUT" ] || { echo "oracle-259: needs /usr/bin/timeout"; exit 2; }

PASS=0
FAIL=0
SKIP=0
FAILED=""

ok() { PASS=$((PASS + 1)); printf '  ok   %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); FAILED="$FAILED [$1]"; printf '  FAIL %s\n%s\n' "$1" "$2"; }
skip() { SKIP=$((SKIP + 1)); printf '  SKIP %s: %s\n' "$1" "$2"; }

TMP=$(mktemp -d)
cleanup() {
  tmux kill-session -t postmaster-tmuxbig 2>/dev/null || true
  tmux kill-session -t postmaster-tmuxsmall 2>/dev/null || true
  pkill -f "sleep 29[237]" 2>/dev/null || true
  rm -f /tmp/claude-"$(id -u)"/oracle259-c5-* 2>/dev/null || true
  rm -rf "$TMP" 2>/dev/null || true
}
trap cleanup EXIT

# wait_file <path> <secs>: 0 when the file lands in time.
wait_file() {
  local i=0
  while [ "$i" -lt "$2" ]; do
    [ -e "$1" ] && return 0
    sleep 1; i=$((i + 1))
  done
  [ -e "$1" ]
}

# make_sys <dir> <exclude...>: symlink every executable on PATH except the
# excluded basenames, so a tool is absent whatever directory holds it.
make_sys() {
  local dir=$1; shift
  mkdir -p "$dir"
  local IFS=:
  for d in $PATH; do
    [ -n "$d" ] && [ -d "$d" ] || continue
    for f in "$d"/*; do
      [ -x "$f" ] && [ -f "$f" ] || continue
      local b=${f##*/}
      local skip=no
      for x in "$@"; do [ "$b" = "$x" ] && skip=yes; done
      [ "$skip" = yes ] && continue
      [ -e "$dir/$b" ] || ln -s "$f" "$dir/$b"
    done
  done
}

printf '\nC1: a hung Herdr never holds a launch or a close\n'
C1=$TMP/c1; mkdir -p "$C1/bin" "$C1/repo" "$C1/state"
git -C "$C1/repo" init -q
C1CALLS=$C1/calls.log
cat > "$C1/bin/herdr" <<EOF
#!/bin/sh
echo "herdr \$*" >> "$C1CALLS"
exec sleep 297
EOF
chmod +x "$C1/bin/herdr"
make_sys "$C1/sys" timeout herdr tmux
make_sys "$C1/syst" herdr tmux

start=$(date +%s)
C1CLOSE_OUT=$($TIMEOUT 15 env -u POSTMASTER_HOST PATH="$C1/bin:$C1/sys" POSTMASTER_HOST_STATE="$C1/state" "$RUN" host close "$C1/repo" 2>&1) && C1CLOSE_CODE=$? || C1CLOSE_CODE=$?
elapsed=$(($(date +%s) - start))
if [ "$C1CLOSE_CODE" -eq 0 ] && [ "$elapsed" -le 10 ]; then
  ok "close gives up on a hung Herdr within 10 s (exit 0, ${elapsed}s)"
else
  bad "close gives up on a hung Herdr within 10 s" "exit $C1CLOSE_CODE after ${elapsed}s: $C1CLOSE_OUT"
fi
if grep -qi "close" "$C1CALLS" 2>/dev/null; then
  bad "close shuts no Herdr pane" "$(cat "$C1CALLS")"
else
  ok "close shuts no Herdr pane"
fi
pkill -f "sleep 297" 2>/dev/null || true

start=$(date +%s)
C1RUN_OUT=$($TIMEOUT 15 env -u POSTMASTER_HOST PATH="$C1/bin:$C1/sys" POSTMASTER_HOST_STATE="$C1/state" "$RUN" host run oracle259c1 "$C1/repo" --out "$C1/out.log" --err "$C1/err.log" --marker "$C1/done" -- echo hi 2>&1) && C1RUN_CODE=$? || C1RUN_CODE=$?
elapsed=$(($(date +%s) - start))
if [ "$C1RUN_CODE" -eq 0 ] && [ "$elapsed" -le 10 ] && printf '%s' "$C1RUN_OUT" | grep -q "host=none"; then
  ok "run without timeout detects host=none within 10 s (${elapsed}s)"
else
  bad "run without timeout detects host=none within 10 s" "exit $C1RUN_CODE after ${elapsed}s: $C1RUN_OUT"
fi
pkill -f "sleep 297" 2>/dev/null || true

start=$(date +%s)
C1T_OUT=$($TIMEOUT 15 env -u POSTMASTER_HOST PATH="$C1/bin:$C1/syst" POSTMASTER_HOST_STATE="$C1/state" "$RUN" host close "$C1/repo" 2>&1) && C1T_CODE=$? || C1T_CODE=$?
elapsed=$(($(date +%s) - start))
if [ "$C1T_CODE" -eq 0 ] && [ "$elapsed" -le 10 ]; then
  ok "close with timeout on PATH behaves as today (exit 0, ${elapsed}s)"
else
  bad "close with timeout on PATH behaves as today" "exit $C1T_CODE after ${elapsed}s: $C1T_OUT"
fi
pkill -f "sleep 297" 2>/dev/null || true

printf '\nC2: the whole environment reaches a pane\n'
C2=$TMP/c2; mkdir -p "$C2/logs"
STUBBIN=$C2/stubbin; mkdir -p "$STUBBIN"
cat > "$STUBBIN/herdr" <<EOF
#!/bin/sh
exec bun "$ROOT/scripts/host-self-test.ts" --stub herdr "\$@"
EOF
chmod +x "$STUBBIN/herdr"

# c2_one <tag> <size> <host> <path>: run one placement/size combo.
c2_one() {
  local tag=$1 size=$2 host=$3 path=$4
  local repo=$C2/$tag; mkdir -p "$repo"; git -C "$repo" init -q
  local lenfile=$C2/$tag.len; rm -f "$lenfile" "$C2/$tag.done"
  mkdir -p "$C2/stub-$tag"
  ORACLE_BIG=$(head -c "$size" /dev/zero | tr '\0' 'A')
  export ORACLE_BIG
  $TIMEOUT 120 env ORACLE_BIG="$ORACLE_BIG" ORACLE_LENFILE="$lenfile" STUB="$C2/stub-$tag" POSTMASTER_HOST="$host" PATH="$path" POSTMASTER_HOST_STATE="$C2/state" "$RUN" host run "oracle259$tag" "$repo" --out "$C2/$tag.out" --err "$C2/$tag.err" --marker "$C2/$tag.done" -- sh -c 'echo LEN=${#ORACLE_BIG}; echo "${#ORACLE_BIG}" > "$ORACLE_LENFILE"' >"$C2/$tag.run" 2>&1
  local code=$?
  unset ORACLE_BIG
  if grep -q "host=$host" "$C2/$tag.run"; then
    ok "$tag runs in a $host pane (exit $code)"
  else
    bad "$tag runs in a $host pane" "exit $code: $(cat "$C2/$tag.run")"
    return 0
  fi
  if wait_file "$C2/$tag.done" 60; then
    ok "$tag marker lands"
  else
    bad "$tag marker lands" "no marker after 60 s; err: $(cat "$C2/$tag.err" 2>/dev/null)"
  fi
  if [ "$(cat "$lenfile" 2>/dev/null)" = "$size" ]; then
    ok "$tag pane sees the whole $size-byte variable"
  else
    bad "$tag pane sees the whole $size-byte variable" "lenfile holds: $(cat "$lenfile" 2>/dev/null || echo MISSING)"
  fi
  if grep -q "environment never arrived" "$C2/$tag.err" 2>/dev/null; then
    bad "$tag reports no lost environment" "$(cat "$C2/$tag.err")"
  else
    ok "$tag reports no lost environment"
  fi
  if [ -e "$C2/$tag.done" ] && [ -e "$lenfile" ] && [ "$(stat -c %Y "$C2/$tag.done")" -ge "$(stat -c %Y "$lenfile")" ]; then
    ok "$tag marker lands after the command exits"
  else
    bad "$tag marker lands after the command exits" "marker or lenfile missing, or marker older"
  fi
  if [ "$host" = "tmux" ]; then
    $TIMEOUT 30 env POSTMASTER_HOST="$host" PATH="$path" POSTMASTER_HOST_STATE="$C2/state" "$RUN" host close "$repo" >/dev/null 2>&1 || true
  fi
}

c2_one herdbig 100000 herdr "$STUBBIN:$PATH"
c2_one herdsmall 1000 herdr "$STUBBIN:$PATH"
if command -v tmux >/dev/null; then
  mkdir -p "$C2/tmuxbig" "$C2/tmuxsmall"
  c2_one tmuxbig 100000 tmux "$PATH"
  tmux kill-session -t postmaster-tmuxbig 2>/dev/null || true
  c2_one tmuxsmall 1000 tmux "$PATH"
  tmux kill-session -t postmaster-tmuxsmall 2>/dev/null || true
else
  skip "tmuxbig runs in a tmux pane" "tmux is not on PATH"
  skip "tmuxsmall runs in a tmux pane" "tmux is not on PATH"
fi

printf '\nC3: a restart counts only when the machine restarted\n'
C3=$TMP/c3; mkdir -p "$C3/bin"
REAL_SYSCTL=$(command -v sysctl)
cat > "$C3/bin/sysctl" <<EOF
#!/bin/sh
state=\$(cat "$C3/sysctl.state" 2>/dev/null || echo A)
if [ "\$1" = "-n" ] && [ "\$2" = "kern.boottime" ]; then
  if [ "\$state" = "B" ] || [ "\$state" = "uuid" ]; then
    echo '{ sec = 1759500000, usec = 222222 } Sat Oct  4 10:00:00 2026'
  else
    echo '{ sec = 1759500000, usec = 111111 } Sat Oct  4 09:00:00 2026'
  fi
  exit 0
fi
if [ "\$1" = "-n" ] && [ "\$2" = "kern.bootsessionuuid" ]; then
  if [ "\$state" = "refused" ]; then exit 1; fi
  if [ "\$state" = "uuid" ]; then echo 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB'; else echo 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA'; fi
  exit 0
fi
exec "$REAL_SYSCTL" "\$@"
EOF
chmod +x "$C3/bin/sysctl"
# The old text forms, as the base reads them: host joins whitespace runs,
# review-round trims.
OA_HOST='{ sec = 1759500000, usec = 111111 } Sat Oct 4 09:00:00 2026'
OA_RR='{ sec = 1759500000, usec = 111111 } Sat Oct  4 09:00:00 2026'
LINUX_BOOT=$(cat /proc/sys/kernel/random/boot_id 2>/dev/null || echo NOBOOT)
C3ENV="POSTMASTER_PROC_ROOT=$C3/missing-proc POSTMASTER_HOST=none"

# A launch stopped across a clock correction: same boot session, new text.
mkdir -p "$C3/ha"; echo A > "$C3/sysctl.state"
$TIMEOUT 90 env $C3ENV PATH="$C3/bin:$PATH" POSTMASTER_HOST_STATE="$C3/state-a" "$RUN" host run oracle259c3a "$C3/ha" --out "$C3/a.out" --err "$C3/a.err" --marker "$C3/a.done" -- sleep 293 >"$C3/a.run" 2>&1
SLEEP_A=$(pgrep -f "sleep 293" | head -1 || true)
echo B > "$C3/sysctl.state"
C3A_OUT=$($TIMEOUT 60 env $C3ENV PATH="$C3/bin:$PATH" POSTMASTER_HOST_STATE="$C3/state-a" "$RUN" host stop "$C3/ha" 2>&1) && C3A_CODE=$? || C3A_CODE=$?
if [ "$C3A_CODE" -eq 0 ] && printf '%s' "$C3A_OUT" | grep -q "stopped 1 launch"; then
  ok "a launch survives a clock correction (uuid stable)"
else
  bad "a launch survives a clock correction (uuid stable)" "exit $C3A_CODE: $C3A_OUT"
fi
if [ -n "$SLEEP_A" ] && kill -0 "$SLEEP_A" 2>/dev/null; then
  bad "the corrected launch is stopped" "sleep $SLEEP_A still runs"; kill "$SLEEP_A" 2>/dev/null || true
else
  ok "the corrected launch is stopped"
fi

# A new boot session drops the record.
mkdir -p "$C3/hb"; echo A > "$C3/sysctl.state"
$TIMEOUT 90 env $C3ENV PATH="$C3/bin:$PATH" POSTMASTER_HOST_STATE="$C3/state-b" "$RUN" host run oracle259c3b "$C3/hb" --out "$C3/b.out" --err "$C3/b.err" --marker "$C3/b.done" -- sleep 293 >"$C3/b.run" 2>&1
SLEEP_B=$(pgrep -f "sleep 293" | head -1 || true)
echo uuid > "$C3/sysctl.state"
C3B_OUT=$($TIMEOUT 60 env $C3ENV PATH="$C3/bin:$PATH" POSTMASTER_HOST_STATE="$C3/state-b" "$RUN" host stop "$C3/hb" 2>&1) && C3B_CODE=$? || C3B_CODE=$?
if [ "$C3B_CODE" -eq 0 ] && printf '%s' "$C3B_OUT" | grep -q "no launch is running"; then
  ok "a changed boot session drops the record"
else
  bad "a changed boot session drops the record" "exit $C3B_CODE: $C3B_OUT"
fi
LEFT_B=""
for _i in $(seq 1 15); do
  LEFT_B=$(ls "$C3/state-b/launches" 2>/dev/null | wc -l | tr -d ' ')
  [ "$LEFT_B" -eq 0 ] && break
  sleep 1
done
if [ "$LEFT_B" -eq 0 ]; then
  ok "the dropped record file is gone"
else
  bad "the dropped record file is gone" "$LEFT_B record(s) left"
fi
[ -n "$SLEEP_B" ] && kill "$SLEEP_B" 2>/dev/null || true

# A refused boot session reads the same: restart.
mkdir -p "$C3/hc"; echo A > "$C3/sysctl.state"
$TIMEOUT 90 env $C3ENV PATH="$C3/bin:$PATH" POSTMASTER_HOST_STATE="$C3/state-c" "$RUN" host run oracle259c3c "$C3/hc" --out "$C3/c.out" --err "$C3/c.err" --marker "$C3/c.done" -- sleep 293 >"$C3/c.run" 2>&1
SLEEP_C=$(pgrep -f "sleep 293" | head -1 || true)
echo refused > "$C3/sysctl.state"
C3C_OUT=$($TIMEOUT 60 env $C3ENV PATH="$C3/bin:$PATH" POSTMASTER_HOST_STATE="$C3/state-c" "$RUN" host stop "$C3/hc" 2>&1) && C3C_CODE=$? || C3C_CODE=$?
if [ "$C3C_CODE" -eq 0 ] && printf '%s' "$C3C_OUT" | grep -q "no launch is running"; then
  ok "a refused boot session drops the record"
else
  bad "a refused boot session drops the record" "exit $C3C_CODE: $C3C_OUT"
fi
[ -n "$SLEEP_C" ] && kill "$SLEEP_C" 2>/dev/null || true

# A record written by the base's code on the same boot still matches.
mkdir -p "$C3/hd" "$C3/state-d/launches"; echo A > "$C3/sysctl.state"
setsid sleep 292 &
SLEEP_D=$!
sleep 1
D_PGID=$(ps -o pgid= -p "$SLEEP_D" | tr -d ' ')
D_START=$(LC_ALL=C ps -o lstart= -p "$SLEEP_D" | tr -s ' ' | sed 's/^ *//;s/ *$//')
D_DIR=$(CDPATH= cd -- "$C3/hd" && pwd -P)
printf '%s\n%s\nstart %s\nboot %s\n' "$D_DIR" "oracle259c3d" "$D_START" "$OA_HOST" > "$C3/state-d/launches/$D_PGID"
C3D_OUT=$($TIMEOUT 60 env $C3ENV PATH="$C3/bin:$PATH" POSTMASTER_HOST_STATE="$C3/state-d" "$RUN" host stop "$C3/hd" 2>&1) && C3D_CODE=$? || C3D_CODE=$?
if [ "$C3D_CODE" -eq 0 ] && printf '%s' "$C3D_OUT" | grep -q "stopped 1 launch"; then
  ok "a base-written record still matches on the same boot"
else
  bad "a base-written record still matches on the same boot" "exit $C3D_CODE: $C3D_OUT"
fi
if kill -0 "$SLEEP_D" 2>/dev/null; then
  bad "the base-written launch is stopped" "sleep $SLEEP_D still runs"; kill "$SLEEP_D" 2>/dev/null || true
else
  ok "the base-written launch is stopped"
fi

# Unforced, the Linux boot id is read as today.
mkdir -p "$C3/he"
$TIMEOUT 90 env -u POSTMASTER_PROC_ROOT POSTMASTER_HOST=none PATH="$C3/bin:$PATH" POSTMASTER_HOST_STATE="$C3/state-e" "$RUN" host run oracle259c3e "$C3/he" --out "$C3/e.out" --err "$C3/e.err" --marker "$C3/e.done" -- sleep 293 >"$C3/e.run" 2>&1
SLEEP_E=$(pgrep -f "sleep 293" | head -1 || true)
REC_BOOT=$(grep -h "^boot " "$C3/state-e/launches"/* 2>/dev/null | head -1 | sed 's/^boot //')
if [ "$REC_BOOT" = "$LINUX_BOOT" ]; then
  ok "unforced records carry the Linux boot id"
else
  bad "unforced records carry the Linux boot id" "record holds: $REC_BOOT"
fi
C3E_OUT=$($TIMEOUT 60 env -u POSTMASTER_PROC_ROOT POSTMASTER_HOST=none PATH="$PATH" POSTMASTER_HOST_STATE="$C3/state-e" "$RUN" host stop "$C3/he" 2>&1) && C3E_CODE=$? || C3E_CODE=$?
if [ "$C3E_CODE" -eq 0 ] && printf '%s' "$C3E_OUT" | grep -q "stopped 1 launch"; then
  ok "an unforced launch stops as today"
else
  bad "an unforced launch stops as today" "exit $C3E_CODE: $C3E_OUT"
fi
[ -n "$SLEEP_E" ] && kill "$SLEEP_E" 2>/dev/null || true

# Rounds: start under A, correct the clock, change the session, refuse it.
C3REPO=$C3/repo; mkdir -p "$C3REPO"; git -C "$C3REPO" init -q
C3D=$C3/d; mkdir -p "$C3D/logs"
printf '{"config": {"review": {"round_timeout_seconds": 120}}}\n' > "$C3D/run.json"
echo A > "$C3/sysctl.state"
R1=$($TIMEOUT 60 env $C3ENV PATH="$C3/bin:$PATH" "$RUN" review-round start "$C3D" 1 2>&1) && R1C=$? || R1C=$?
touch "$C3D/logs/review-r1-lens-lane.done"
W1=$($TIMEOUT 60 env $C3ENV PATH="$C3/bin:$PATH" "$RUN" review-round wait "$C3D" 1 "$C3REPO" lens:lane 2>&1) && W1C=$? || W1C=$?
if [ "$R1C" -eq 0 ] && [ "$W1C" -eq 0 ]; then
  ok "a forced round starts and collects"
else
  bad "a forced round starts and collects" "start $R1C wait $W1C: $W1"
fi
echo B > "$C3/sysctl.state"
W1B=$($TIMEOUT 60 env $C3ENV PATH="$C3/bin:$PATH" "$RUN" review-round wait "$C3D" 1 "$C3REPO" lens:lane 2>&1) && W1BC=$? || W1BC=$?
if [ "$W1BC" -eq 0 ]; then
  ok "a round reports no restart across a clock correction"
else
  bad "a round reports no restart across a clock correction" "exit $W1BC: $W1B"
fi
echo uuid > "$C3/sysctl.state"
W1U=$($TIMEOUT 60 env $C3ENV PATH="$C3/bin:$PATH" "$RUN" review-round wait "$C3D" 1 "$C3REPO" lens:lane 2>&1) && W1UC=$? || W1UC=$?
if [ "$W1UC" -eq 1 ] && printf '%s' "$W1U" | grep -q "machine has restarted"; then
  ok "a round reports the restart on a changed boot session"
else
  bad "a round reports the restart on a changed boot session" "exit $W1UC: $W1U"
fi
echo A > "$C3/sysctl.state"
$TIMEOUT 60 env $C3ENV PATH="$C3/bin:$PATH" "$RUN" review-round start "$C3D" 2 >/dev/null 2>&1
touch "$C3D/logs/review-r2-lens-lane.done"
echo refused > "$C3/sysctl.state"
W2=$($TIMEOUT 60 env $C3ENV PATH="$C3/bin:$PATH" "$RUN" review-round wait "$C3D" 2 "$C3REPO" lens:lane 2>&1) && W2C=$? || W2C=$?
if [ "$W2C" -eq 1 ] && printf '%s' "$W2" | grep -q "machine has restarted"; then
  ok "a round reports the restart on a refused boot session"
else
  bad "a round reports the restart on a refused boot session" "exit $W2C: $W2"
fi
echo A > "$C3/sysctl.state"
$TIMEOUT 60 env $C3ENV PATH="$C3/bin:$PATH" "$RUN" review-round start "$C3D" 3 >/dev/null 2>&1
touch "$C3D/logs/review-r3-lens-lane.done"
python3 - "$C3D/logs/review-r3.json" "$OA_RR" <<'EOF'
import json, sys
p = sys.argv[1]
st = json.load(open(p))
st["boot"] = sys.argv[2]
json.dump(st, open(p, "w"), indent=2)
EOF
W3=$($TIMEOUT 60 env $C3ENV PATH="$C3/bin:$PATH" "$RUN" review-round wait "$C3D" 3 "$C3REPO" lens:lane 2>&1) && W3C=$? || W3C=$?
if [ "$W3C" -eq 0 ]; then
  ok "a base-written round state still matches on the same boot"
else
  bad "a base-written round state still matches on the same boot" "exit $W3C: $W3"
fi
$TIMEOUT 60 env -u POSTMASTER_PROC_ROOT PATH="$PATH" "$RUN" review-round start "$C3D" 4 >/dev/null 2>&1
U_BOOT=$(python3 -c "import json; print(json.load(open('$C3D/logs/review-r4.json'))['boot'])")
if [ "$U_BOOT" = "$LINUX_BOOT" ]; then
  ok "an unforced round carries the Linux boot id"
else
  bad "an unforced round carries the Linux boot id" "round holds: $U_BOOT"
fi

printf '\nC4: a signal death reports the exit code for this system\n'
C4=$TMP/c4; mkdir -p "$C4"
cat > "$C4/check.ts" <<EOF
import { run, signalExitCode } from "$ROOT/scripts/lib/proc.ts";
import os from "node:os";
const numbers = os.constants.signals as Record<string, number>;
const mapFails: string[] = [];
for (const [name, num] of Object.entries(numbers)) {
  const got = signalExitCode(name);
  if (got !== 128 + num) mapFails.push(name + ": got " + got + " want " + (128 + num));
}
console.log("MAPPINGS total=" + Object.keys(numbers).length + " fails=" + mapFails.length);
for (const f of mapFails) console.log("  " + f);
const fatal = ["SIGHUP", "SIGINT", "SIGQUIT", "SIGILL", "SIGTRAP", "SIGABRT", "SIGBUS", "SIGFPE", "SIGUSR1", "SIGSEGV", "SIGUSR2", "SIGPIPE", "SIGALRM", "SIGTERM", "SIGXCPU", "SIGXFSZ", "SIGVTALRM", "SIGPROF", "SIGSYS"];
const deathFails: string[] = [];
for (const sig of fatal) {
  const num = numbers[sig];
  if (num === undefined) { deathFails.push(sig + ": no number on this system"); continue; }
  const r = run("sh", ["-c", "kill -" + sig.slice(3) + " \$\$"]);
  if (r.code !== 128 + num) deathFails.push(sig + ": got " + r.code + " want " + (128 + num));
}
console.log("DEATHS total=" + fatal.length + " fails=" + deathFails.length);
for (const f of deathFails) console.log("  " + f);
if (signalExitCode.length >= 2) {
  const mac = { SIGUSR1: 30, SIGBUS: 10, SIGSYS: 12 } as Record<string, number>;
  const picks = [
    ["SIGUSR1", 158],
    ["SIGBUS", 138],
    ["SIGSYS", 140],
  ] as Array<[string, number]>;
  const macFails: string[] = [];
  for (const [sig, want] of picks) {
    const got = (signalExitCode as (s: string, t: Record<string, number>) => number)(sig, mac);
    if (got !== want) macFails.push(sig + ": got " + got + " want " + want);
  }
  console.log("MAC fails=" + macFails.length);
  for (const f of macFails) console.log("  " + f);
} else {
  console.log("SEAM none");
}
EOF
C4_OUT=$(bun --no-env-file "$C4/check.ts" 2>&1) && C4_CODE=$? || C4_CODE=$?
C4_MAP_FAILS=$(printf '%s' "$C4_OUT" | sed -n 's/^MAPPINGS total=[0-9]* fails=\([0-9]*\)/\1/p')
C4_MAP_TOTAL=$(printf '%s' "$C4_OUT" | sed -n 's/^MAPPINGS total=\([0-9]*\) fails=[0-9]*/\1/p')
if [ "$C4_CODE" -eq 0 ] && [ "$C4_MAP_FAILS" = "0" ] && [ -n "$C4_MAP_TOTAL" ] && [ "$C4_MAP_TOTAL" -gt 20 ]; then
  ok "every signal maps to 128 plus this system's number ($C4_MAP_TOTAL signals)"
else
  bad "every signal maps to 128 plus this system's number" "exit $C4_CODE: $C4_OUT"
fi
C4_DEATH_FAILS=$(printf '%s' "$C4_OUT" | sed -n 's/^DEATHS total=[0-9]* fails=\([0-9]*\)/\1/p')
if [ "$C4_CODE" -eq 0 ] && [ "$C4_DEATH_FAILS" = "0" ]; then
  ok "children dead by signal report 128 plus the number through run()"
else
  bad "children dead by signal report 128 plus the number through run()" "exit $C4_CODE: $C4_OUT"
fi
if printf '%s' "$C4_OUT" | grep -q "^SEAM none"; then
  skip "Mac numbers report 158, 138 and 140" "signalExitCode exposes no numbers seam"
else
  C4_MAC_FAILS=$(printf '%s' "$C4_OUT" | sed -n 's/^MAC fails=\([0-9]*\)/\1/p')
  if [ "$C4_MAC_FAILS" = "0" ]; then
    ok "Mac numbers report 158, 138 and 140"
  else
    bad "Mac numbers report 158, 138 and 140" "$C4_OUT"
  fi
fi

printf '\nC5: background output is collected from the users own temporary folder\n'
C5=$TMP/c5; mkdir -p "$C5"
UIDN=$(id -u)
mkdir -p "$C5/tmp/claude-$UIDN" "$C5/logs-a" "$C5/logs-b" "$C5/logs-c" "$C5/else"
echo "task output a" > "$C5/tmp/claude-$UIDN/out.txt"
printf '{"type":"system","subtype":"task_notification","output_file":"%s"}\n' "$C5/tmp/claude-$UIDN/out.txt" > "$C5/ev-a.jsonl"
C5A_OUT=$(TMPDIR="$C5/tmp" "$RUN" review-findings harvest "$C5/ev-a.jsonl" "$C5/logs-a" --prefix oracle259 2>&1) && C5A_CODE=$? || C5A_CODE=$?
if [ "$C5A_CODE" -eq 0 ] && [ -e "$C5/logs-a/oracle259-claude-task-01-out.txt" ]; then
  ok "output under the users own temporary folder is collected"
else
  bad "output under the users own temporary folder is collected" "exit $C5A_CODE: $C5A_OUT"
fi
mkdir -p "/tmp/claude-$UIDN"
echo "task output b" > "/tmp/claude-$UIDN/oracle259-c5-b.txt"
printf '{"type":"system","subtype":"task_notification","output_file":"%s"}\n' "/tmp/claude-$UIDN/oracle259-c5-b.txt" > "$C5/ev-b.jsonl"
C5B_OUT=$(env -u TMPDIR "$RUN" review-findings harvest "$C5/ev-b.jsonl" "$C5/logs-b" --prefix oracle259 2>&1) && C5B_CODE=$? || C5B_CODE=$?
if [ "$C5B_CODE" -eq 0 ] && [ -e "$C5/logs-b/oracle259-claude-task-01-oracle259-c5-b.txt" ]; then
  ok "output under the shared temporary folder is collected, as today"
else
  bad "output under the shared temporary folder is collected, as today" "exit $C5B_CODE: $C5B_OUT"
fi
echo "task output c" > "$C5/else/out.txt"
printf '{"type":"system","subtype":"task_notification","output_file":"%s"}\n' "$C5/else/out.txt" > "$C5/ev-c.jsonl"
C5C_OUT=$(TMPDIR="$C5/tmp" "$RUN" review-findings harvest "$C5/ev-c.jsonl" "$C5/logs-c" --prefix oracle259 2>&1) && C5C_CODE=$? || C5C_CODE=$?
if [ "$C5C_CODE" -ne 0 ] && printf '%s' "$C5C_OUT" | grep -q "Claude task output is outside"; then
  ok "output outside both folders is refused"
else
  bad "output outside both folders is refused" "exit $C5C_CODE: $C5C_OUT"
fi

printf '\nC6: the ticket prefix is found without GNU grep\n'
C6=$TMP/c6; mkdir -p "$C6/bin" "$C6/repo"
cat > "$C6/bin/grep" <<'EOF'
#!/bin/sh
exit 2
EOF
chmod +x "$C6/bin/grep"
git -C "$C6/repo" init -q
git -C "$C6/repo" config user.email "oracle@example.test"
git -C "$C6/repo" config user.name "oracle"
echo one > "$C6/repo/f1"; git -C "$C6/repo" add f1; git -C "$C6/repo" commit -qm "ABC-1 first"
echo two > "$C6/repo/f2"; git -C "$C6/repo" add f2; git -C "$C6/repo" commit -qm "ABC-2 second"
echo three > "$C6/repo/f3"; git -C "$C6/repo" add f3; git -C "$C6/repo" commit -qm "ABC-3 third"
C6_OUT=$(PATH="$C6/bin:$PATH" "$RUN" discover-project "$C6/repo" 2>&1) && C6_CODE=$? || C6_CODE=$?
if [ "$C6_CODE" -eq 0 ] && printf '%s' "$C6_OUT" | grep -q "^tracker_prefix=ABC$"; then
  ok "the prefix is found when grep exits 2"
else
  bad "the prefix is found when grep exits 2" "exit $C6_CODE: $C6_OUT"
fi
C6R_OUT=$("$RUN" discover-project "$C6/repo" 2>&1) && C6R_CODE=$? || C6R_CODE=$?
if [ "$C6R_CODE" -eq 0 ] && printf '%s' "$C6R_OUT" | grep -q "^tracker_prefix=ABC$"; then
  ok "the prefix is found with the real grep, as today"
else
  bad "the prefix is found with the real grep, as today" "exit $C6R_CODE: $C6R_OUT"
fi

printf '\nC7/C8: setup on a Mac drops launch limits and says so once\n'
C7=$TMP/c7; mkdir -p "$C7/bin"
REAL_UNAME=$(command -v uname)
cat > "$C7/bin/uname" <<EOF
#!/bin/sh
if [ "\$1" = "-s" ]; then echo Darwin; else exec "$REAL_UNAME" "\$@"; fi
EOF
chmod +x "$C7/bin/uname"
cat > "$C7/answers" <<'EOF'
lanes=alpha, beta, sentinel
lane.alpha.harness=bash
lane.alpha.model=m1
lane.beta.harness=bash
lane.beta.model=m2
lane.sentinel.harness=bash
lane.sentinel.model=m3
workhorses=alpha, beta
coachman.harness=bash
coachman.model=judge
fallback.harness=bash
fallback.model=spare
postmaster.harness=bash
postmaster.model=pm
limits.memory_max=bogus
EOF
C7_KEYS_D=$(PATH="$C7/bin:$PATH" "$RUN" setup --keys 2>&1) && C7_KEYS_DC=$? || C7_KEYS_DC=$?
C7_DARWIN_N=$(printf '%s' "$C7_KEYS_D" | grep -c "limits\." || true)
if [ "$C7_KEYS_DC" -eq 0 ] && [ "$C7_DARWIN_N" -eq 0 ]; then
  ok "setup on a Mac lists no limits key"
else
  bad "setup on a Mac lists no limits key" "exit $C7_KEYS_DC, $C7_DARWIN_N limits lines"
fi
C7_D=$(PATH="$C7/bin:$PATH" "$RUN" setup --answers "$C7/answers" --dry-run 2>&1) && C7_DC=$? || C7_DC=$?
if [ "$C7_DC" -eq 0 ] && ! printf '%s' "$C7_D" | grep -q "memory_max" && ! printf '%s' "$C7_D" | grep -q "^\[limits\]"; then
  ok "setup on a Mac ignores a bogus limit answer (exit 0, no table)"
else
  bad "setup on a Mac ignores a bogus limit answer (exit 0, no table)" "exit $C7_DC: $C7_D"
fi
C7_KEYS_L=$("$RUN" setup --keys 2>&1) && C7_KEYS_LC=$? || C7_KEYS_LC=$?
C7_LINUX_N=$(printf '%s' "$C7_KEYS_L" | grep -c "limits\." || true)
if [ "$C7_KEYS_LC" -eq 0 ] && [ "$C7_LINUX_N" -eq 8 ]; then
  ok "setup on Linux lists the eight limit keys, as today"
else
  bad "setup on Linux lists the eight limit keys, as today" "exit $C7_KEYS_LC, $C7_LINUX_N limits lines"
fi
C7_L=$("$RUN" setup --answers "$C7/answers" --dry-run 2>&1) && C7_LC=$? || C7_LC=$?
if [ "$C7_LC" -eq 1 ] && printf '%s' "$C7_L" | grep -q "memory_max"; then
  ok "setup on Linux refuses the bogus limit, as today"
else
  bad "setup on Linux refuses the bogus limit, as today" "exit $C7_LC: $C7_L"
fi
# C8: exactly one uncapped line on a Mac, none on Linux, both driven ways.
C8_D_N=$(printf '%s' "$C7_D" | grep -ci "without.*limit\|limit.*without" || true)
if [ "$C8_D_N" -eq 1 ]; then
  ok "setup on a Mac says once that launches run without limits (answers)"
else
  bad "setup on a Mac says once that launches run without limits (answers)" "$C8_D_N such lines: $C7_D"
fi
# Interactive answers in setup's question order: defaults everywhere except the
# harness and model each role requires. The limits block takes only defaults,
# so the same input fits Linux and a Mac that skips it (trailing lines unread).
printf '%s\n' "" "" claude m1 "" "" codex m2 "" "" "" "" "" "" "" mimo m3 "" "" pi m4 "" "" claude m5 "" "" "" "" "" "" "" "" "" "" "" "" "" "" "" "" "" "" "" "" > "$C7/interactive.in"
C8_DI=$($TIMEOUT 60 env PATH="$C7/bin:$PATH" "$RUN" setup --dry-run <"$C7/interactive.in" 2>&1) && C8_DIC=$? || C8_DIC=$?
C8_DI_N=$(printf '%s' "$C8_DI" | grep -ci "without.*limit\|limit.*without" || true)
if [ "$C8_DIC" -eq 0 ] && [ "$C8_DI_N" -eq 1 ]; then
  ok "setup on a Mac says once that launches run without limits (interactive)"
else
  bad "setup on a Mac says once that launches run without limits (interactive)" "exit $C8_DIC, $C8_DI_N such lines"
fi
C8_L_N=$(printf '%s' "$C7_L" | grep -ci "without.*limit\|limit.*without" || true)
if [ "$C8_L_N" -eq 0 ]; then
  ok "setup on Linux says no such line (answers)"
else
  bad "setup on Linux says no such line (answers)" "$C8_L_N such lines"
fi
C8_LI=$($TIMEOUT 60 "$RUN" setup --dry-run <"$C7/interactive.in" 2>&1) && C8_LIC=$? || C8_LIC=$?
C8_LI_N=$(printf '%s' "$C8_LI" | grep -ci "without.*limit\|limit.*without" || true)
if [ "$C8_LIC" -eq 0 ] && [ "$C8_LI_N" -eq 0 ]; then
  ok "setup on Linux says no such line (interactive)"
else
  bad "setup on Linux says no such line (interactive)" "exit $C8_LIC, $C8_LI_N such lines"
fi

printf '\nC9: the readme tells Mac users what still differs\n'
NEEDS_LINE=$(grep -n "What it needs" "$ROOT/README.md" | head -1 | cut -d: -f1 || true)
SEC_HEAD=$(awk -v start="${NEEDS_LINE:-0}" 'NR > start && /^#+ +.*[Mm]ac/ {print NR; exit}' "$ROOT/README.md" || true)
if [ -n "$NEEDS_LINE" ] && [ -n "$SEC_HEAD" ]; then
  ok "the readme has a Mac section after What it needs"
else
  bad "the readme has a Mac section after What it needs" "needs line: $NEEDS_LINE, section head: $SEC_HEAD"
  SEC_HEAD=1
fi
SECTION=$(awk -v s="$SEC_HEAD" 'NR >= s { if (NR > s && /^#+ /) exit; print }' "$ROOT/README.md")
c9_has() {
  if printf '%s' "$SECTION" | grep -qiE "$2"; then
    ok "the section covers $1"
  else
    bad "the section covers $1" "nothing matching: $2"
  fi
}
c9_has "uncapped launches (D5)" "limit|cap"
c9_has "lane-data separation unknown (D6)" "confine|isolat|XDG|not known|unknown"
c9_has "the lock fallback (D7)" "flock|lock"
c9_has "other users tilde paths (D8)" "tilde|home folder|other user"
c9_has "undecodable arguments (D9)" "argument|decod|UTF|byte"
c9_has "the clock-following round limit (D10)" "clock|monotonic|sleep"
c9_has "the time-zone move (D11)" "time.zone"
c9_has "Linux-only trial and oracle scripts" "trial|oracle"
if printf '%s' "$SECTION" | grep -qiE "herdr|FIFO|never arrived|kern\.boottime|bootsession|SIG[A-Z]|exit code|TMPDIR|temporary director|word boundar|tracker prefix|ticket prefix"; then
  bad "the section carries no fixed item" "$(printf '%s' "$SECTION" | grep -iE "herdr|FIFO|never arrived|kern\.boottime|bootsession|SIG[A-Z]|exit code|TMPDIR|temporary director|word boundar|tracker prefix|ticket prefix" | head -3)"
else
  ok "the section carries no fixed item"
fi
if printf '%s' "$SECTION" | grep -qE "scripts/|[A-Za-z0-9_-]+\.ts"; then
  bad "the section names no file" "$(printf '%s' "$SECTION" | grep -E "scripts/|[A-Za-z0-9_-]+\.ts" | head -3)"
else
  ok "the section names no file"
fi
# Stale self-test scratch from an earlier gate run is not part of the tree;
# a failing suite leaves its own behind, and the gate still reports it red.
rm -rf "$ROOT"/scripts/.host-self-test-*
if [ ! -x "$ROOT/node_modules/.bin/tsc" ]; then
  (cd "$ROOT" && $TIMEOUT 300 bun install --frozen-lockfile >/dev/null 2>&1) || true
fi
if [ ! -x "$ROOT/node_modules/.bin/tsc" ]; then
  skip "bun run check passes" "dependencies are not installed and install failed"
elif (cd "$ROOT" && $TIMEOUT 600 bun run check >"$TMP/gate.log" 2>&1); then
  ok "bun run check passes"
else
  bad "bun run check passes" "$(tail -5 "$TMP/gate.log")"
fi

printf '\npass %s, fail %s, skip %s\n' "$PASS" "$FAIL" "$SKIP"
if [ -n "$FAILED" ]; then printf 'failed:%s\n' "$FAILED"; fi
[ "$FAIL" -eq 0 ]
