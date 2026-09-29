#!/usr/bin/env bash
# One line per run under a project's run root: the run, its stage and leg from the manifest,
# the markers present, minutes since anything in it changed, and what the postmaster does
# next. This is the postmaster's poll; it reads files and nothing else. A pending escalation
# from the postmaster to the user is printed first, since it is what everything else may
# be waiting on. The waiting list itself is kept by host.sh leg waiting, never by hand.
#
#   runs-status.sh <project-run-root>        e.g. <project>/.postmaster/runs
#   runs-status.sh --self-test
#
#   next   USER      the postmaster has put this run's question to the user and waits for the
#                    answer (.waiting-on-user)
#          RULE      an escalation is waiting (.escalation-ready)
#          GATE      the ship card is complete (.card-ready)
#          DISPATCH  the current leg is done (.leg-<n>-done): the next leg, or after the last,
#                    the postmaster's close
#          ASK       a recorded refusal, pre-thread exit, or wall on the fallback needs a user
#          TAKEOVER  a primary coachman hit a recorded wall: start the fallback
#          RESUME    a leg exited with a thread id and no hand-off: resume it
#          READ      a checkpoint card is waiting to be read (.checkpoint-*-ready)
#          INSPECT   an attempt died without its record, the last record is corrupt,
#                    or no marker and nothing changed for 30 minutes, run not done
#          WAIT      a leg is running and its files are moving
#          -         the manifest says done or abandoned
#
# Idle time ignores the marker files themselves, so touching a marker never hides a stall.
#
#   exit 0  listed (an empty root lists nothing)
#   exit 1  usage, or no such root
set -uo pipefail

status() {  # status <root>
  python3 - "$1" <<'PY'
import sys, os, json, time, glob
root = sys.argv[1]; now = time.time()
pm_esc = os.path.join(root, "postmaster", "ESCALATION.md")
if os.path.isfile(pm_esc):
    print("POSTMASTER     escalation to the user is pending: %s" % pm_esc)
def owner_alive(d, leg):
    p = os.path.join(d, ".leg-%s-active" % leg)
    if os.path.isdir(p):
        p = os.path.join(p, "owner")  # a legacy directory lock holds no owner: stale
    try:
        with open(p, encoding="utf-8") as f:
            pid_s, _, start = f.read().strip().partition(" ")
        pid = int(pid_s)
    except (OSError, ValueError):
        return False
    if os.path.isdir("/proc/self"):
        try:
            with open("/proc/%d/stat" % pid) as f:
                rest = f.read().rpartition(")")[2].split()
        except OSError:
            return False
        return bool(rest) and rest[0] != "Z" and len(rest) > 19 and rest[19] == start
    import subprocess
    r = subprocess.run(["ps", "-o", "stat=,lstart=", "-p", str(pid)],
                       capture_output=True, text=True, env=dict(os.environ, LC_ALL="C"))
    f = r.stdout.split()
    return len(f) >= 6 and not f[0].startswith("Z") and " ".join(f[1:6]) == start
rows = []
for run in sorted(os.listdir(root)):
    d = os.path.join(root, run)
    if not os.path.isdir(d) or run == "postmaster": continue
    stage, leg = "no manifest", "?"
    mp = os.path.join(d, "manifest.json")
    if os.path.isfile(mp):
        try:
            m = json.load(open(mp)); stage = str(m.get("stage", "?")); leg = str(m.get("leg", "?"))
        except Exception:
            stage = "manifest unreadable"
    markers = sorted(os.path.basename(p)
                     for pat in (".*-ready", ".leg-*-done", ".leg-*-exited", ".waiting-on-user")
                     for p in glob.glob(os.path.join(d, pat)))
    newest = 0
    for dp, dn, fn in os.walk(d):
        for f in fn:
            if f.startswith("."): continue
            try: newest = max(newest, os.path.getmtime(os.path.join(dp, f)))
            except OSError: pass
    idle_min = int((now - newest) / 60) if newest else -1
    done = ".leg-%s-done" % leg in markers
    exited = ".leg-%s-exited" % leg in markers
    # A lock is active only while its owner lives: a lock whose owner is gone is
    # stale, with or without its exited marker, and a legacy directory lock
    # holds no owner and is stale too. The recorded outcome shows, never a
    # wedged WAIT, and the next start steals the stale lock.
    active = os.path.exists(os.path.join(d, ".leg-%s-active" % leg)) \
        and not exited and owner_alive(d, leg)
    # Only the last record decides; a corrupt middle line is superseded history.
    # A last line that is not a record is fail-closed INSPECT, never a guess.
    outcome, role, last_attempt, corrupt = "", "", -1, False
    try:
        attempt_path = os.path.join(d, "logs", "coachman-leg-%s-attempts.jsonl" % leg)
        with open(attempt_path, encoding="utf-8") as f:
            lines = [line for line in f if line.strip()]
        if lines:
            try:
                last = json.loads(lines[-1])
            except ValueError:
                corrupt = True
            else:
                if isinstance(last, dict):
                    outcome = last.get("outcome", "")
                    role = last.get("role", "")
                    try: last_attempt = int(last.get("attempt", -1))
                    except (TypeError, ValueError): last_attempt = -1
                else:
                    corrupt = True
    except OSError:
        pass
    # Currency: every started attempt ends in a record. A phase file beyond the
    # last record means an attempt died unrecorded: INSPECT, never the stale
    # outcome. A running attempt holds the lock, so it reads WAIT above.
    phase_max = -1
    for p in glob.glob(os.path.join(d, "logs", "coachman-leg-%s-phase-*" % leg)):
        tail = os.path.basename(p).rsplit("-", 1)[-1]
        if tail.isdigit(): phase_max = max(phase_max, int(tail))
    gap = phase_max > last_attempt
    if stage in ("done", "abandoned"): nxt = "-"
    elif ".waiting-on-user" in markers: nxt = "USER"
    elif ".escalation-ready" in markers: nxt = "RULE"
    elif ".card-ready" in markers: nxt = "GATE"
    elif active: nxt = "WAIT"
    elif gap or corrupt: nxt = "INSPECT"
    elif outcome == "finished": nxt = "DISPATCH"
    elif outcome in ("refused", "pre-thread"): nxt = "ASK"
    elif outcome == "walled" and role == "coachman": nxt = "TAKEOVER"
    elif outcome == "walled" and role == "coachman_fallback": nxt = "ASK"
    elif outcome == "incomplete": nxt = "RESUME"
    elif done: nxt = "DISPATCH"
    elif exited: nxt = "INSPECT"
    elif any(mk.startswith(".checkpoint-") for mk in markers): nxt = "READ"
    elif idle_min >= 30: nxt = "INSPECT"
    else: nxt = "WAIT"
    rows.append((run, stage, leg, ",".join(markers) or "-", idle_min, nxt))
print("%-14s %-16s %-4s %-44s %6s  %s" % ("RUN", "STAGE", "LEG", "MARKERS", "IDLE", "NEXT"))
for r in rows:
    print("%-14s %-16s %-4s %-44s %5sm  %s" % r)
PY
}

if [ "${1:-}" != --self-test ]; then
  [ $# -eq 1 ] || { echo "usage: runs-status.sh <project-run-root> | --self-test" >&2; exit 1; }
  ROOT=$(CDPATH= cd -P -- "$1" 2>/dev/null && pwd -P) || { echo "runs-status: no such root: $1" >&2; exit 1; }
  status "$ROOT"; exit $?
fi

# --- self-test ----------------------------------------------------------------------------
# Every NEXT state from a run built to show it, and the cases that must not be taken for one.
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; fails=$((fails+1)); }
run() {  # run <name> <stage> <leg> [marker...]: a run directory with a manifest and markers
  local d="$tmp/root/$1" stage=$2 leg=$3 m; shift 3
  mkdir -p "$d/logs"; printf '{"stage": "%s", "leg": %s}\n' "$stage" "$leg" > "$d/manifest.json"
  : > "$d/run-log.md"
  for m in "$@"; do : > "$d/$m"; done
}
record() {  # record <name> <outcome> <role>: one attempt result, as the leg script writes it
  printf '{"outcome":"%s","role":"%s"}\n' "$2" "$3" > "$tmp/root/$1/logs/coachman-leg-2-attempts.jsonl"
}
recordn() {  # recordn <name> <attempt> <outcome> <role>: append one numbered attempt result
  printf '{"attempt":%s,"outcome":"%s","role":"%s"}\n' "$2" "$3" "$4" >> "$tmp/root/$1/logs/coachman-leg-2-attempts.jsonl"
}
phase() {  # phase <name> <n>: attempt <n> started, as the leg script writes it
  printf 'started\n' > "$tmp/root/$1/logs/coachman-leg-2-phase-$2"
}
liveowner() {  # liveowner <name>: the lock's owner is this self-test, alive throughout it
  python3 - "$$" "$tmp/root/$1/.leg-2-active" <<'PY'
import os, subprocess, sys
pid = int(sys.argv[1])
try:
    rest = open("/proc/%d/stat" % pid).read().rpartition(")")[2].split()
    start = rest[19]
except (OSError, IndexError):
    start = " ".join(subprocess.run(["ps", "-o", "lstart=", "-p", str(pid)],
                     capture_output=True, text=True).stdout.split()[:5])
open(sys.argv[2], "w").write("%d %s\n" % (pid, start))
PY
}
deadowner() {  # deadowner <name>: the lock's owner is gone (no pid starts at 0)
  printf '999999999 0\n' > "$tmp/root/$1/.leg-2-active"
}
age() {  # age <name>: nothing in the run has changed for an hour
  python3 -c 'import os, sys, time
t = time.time() - 3600
for dp, dn, fn in os.walk(sys.argv[1]):
    for f in fn:
        os.utime(os.path.join(dp, f), (t, t))' "$tmp/root/$1"
}
next_of() { status "$tmp/root" | awk -v r="$1" '$1 == r { print $NF }'; }
expect() {  # expect <label> <run> <next>
  local got; got=$(next_of "$2")
  [ "$got" = "$3" ] && ok "$1" || fail "$1 (got '$got', wanted '$3')"
}

run rule review 2 .escalation-ready
run gate shipping 3 .card-ready
run dispatch review 2 .leg-2-done .leg-2-exited
record dispatch finished coachman
run refused review 2 .leg-2-exited; record refused refused coachman
run prethread review 2 .leg-2-exited; record prethread pre-thread coachman
run wall review 2 .leg-2-exited; record wall walled coachman
run fallbackwall review 2 .leg-2-exited; record fallbackwall walled coachman_fallback
run remount review 2 .leg-2-exited; record remount incomplete coachman
run read review 2 .checkpoint-review-ready
run inspect review 2; age inspect
run wait review 2
run user review 2 .waiting-on-user .leg-2-exited
run closed done 3 .leg-3-done .leg-3-exited
run earlier review 2 .leg-1-done
run usergate shipping 3 .card-ready .waiting-on-user
run userclosed done 3 .waiting-on-user
run refusedanswer review 2 .waiting-on-user .leg-2-exited; record refusedanswer refused coachman
run wallanswer review 2 .waiting-on-user .leg-2-exited; record wallanswer walled coachman_fallback
run incompleteanswer review 2 .waiting-on-user .leg-2-exited; record incompleteanswer incomplete coachman
run finishedclosed done 2 .leg-2-done .leg-2-exited; record finishedclosed finished coachman
run active review 2; record active refused coachman; liveowner active
run staleactive review 2 .leg-2-exited; record staleactive incomplete coachman; mkdir "$tmp/root/staleactive/.leg-2-active"
run ownergone review 2; record ownergone refused coachman; deadowner ownergone
run noowner review 2; record noowner refused coachman; mkdir "$tmp/root/noowner/.leg-2-active"
run gap review 2 .leg-2-exited; recordn gap 1 finished coachman; phase gap 1; phase gap 2
run gapactive review 2; recordn gapactive 1 incomplete coachman; phase gapactive 1; phase gapactive 2; liveowner gapactive
run corruptlast review 2 .leg-2-exited; record corruptlast incomplete coachman; printf 'NOT JSON\n' >> "$tmp/root/corruptlast/logs/coachman-leg-2-attempts.jsonl"
run corruptmid review 2 .leg-2-exited; printf 'NOT JSON\n' > "$tmp/root/corruptmid/logs/coachman-leg-2-attempts.jsonl"; recordn corruptmid 2 incomplete coachman
run unknown review 2 .leg-2-exited; record unknown mystery coachman
run wallunknown review 2 .leg-2-exited; record wallunknown walled unknown
run stall review 2; age stall; : > "$tmp/root/stall/.leg-1-done"
mkdir -p "$tmp/root/postmaster"

echo "positive controls"
expect "an escalation waiting is RULE" rule RULE
expect "a complete ship card is GATE" gate GATE
expect "the current leg done is DISPATCH" dispatch DISPATCH
expect "a refused launch is ASK" refused ASK
expect "an exit before a thread id is ASK" prethread ASK
expect "a wall on the primary coachman is TAKEOVER" wall TAKEOVER
expect "a wall on the fallback coachman is ASK" fallbackwall ASK
expect "an incomplete thread is RESUME" remount RESUME
expect "a checkpoint card waiting is READ" read READ
expect "nothing changed for an hour is INSPECT" inspect INSPECT
expect "a leg at work is WAIT" wait WAIT
expect "a run waiting on the user is USER, whatever else it holds" user USER
expect "a closed run is -" closed "-"
expect "a refusal stays USER while the user question is open" refusedanswer USER
expect "a fallback wall stays USER while the user question is open" wallanswer USER
expect "an incomplete thread waits on the user ahead of its outcome" incompleteanswer USER
expect "a closed run ignores a stale finished attempt" finishedclosed "-"
expect "a live attempt waits even when its previous outcome asked the user" active WAIT
expect "an active lock that survives its exited marker reads its outcome" staleactive RESUME
expect "a lock whose owner is gone reads its outcome, not a wedged WAIT" ownergone ASK
expect "a lock with no owner file is stale too" noowner ASK
expect "a phase file beyond the last record is inspected, not the stale outcome" gap INSPECT
expect "a corrupt middle line does not hide the last good record" corruptmid RESUME

echo "negative controls"
expect "an earlier leg's done marker dispatches nothing" earlier WAIT
expect "a ship card put to the user waits on the user, not the gate" usergate USER
expect "a closed run stays closed with a stale marker" userclosed "-"
expect "an unknown outcome is inspected instead of resumed" unknown INSPECT
expect "a wall without a known role is inspected" wallunknown INSPECT
expect "a running attempt's missing record is normal while it holds the lock" gapactive WAIT
expect "a last line that is not a record is inspected" corruptlast INSPECT
expect "touching a marker does not hide a stall" stall INSPECT
[ -z "$(next_of postmaster)" ] && ok "the postmaster's own directory is not a run" \
  || fail "the postmaster's own directory is not a run"

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
