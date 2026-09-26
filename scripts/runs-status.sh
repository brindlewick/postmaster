#!/usr/bin/env bash
# One line per run under a project's run root: the run, its stage and leg from the manifest,
# the markers present, minutes since anything in it changed, and what the postmaster does
# next. This is the postmaster's poll; it reads files and nothing else. A pending escalation
# from the postmaster to the user is printed first, since it is what everything else may
# be waiting on, and so are tool faults the postmaster met outside any run.
#
#   runs-status.sh <project-run-root>        e.g. ~/.postmaster/runs/<project>
#   runs-status.sh --self-test
#
#   next   RULE      an escalation is waiting (.escalation-ready)
#          GATE      the ship card is complete (.card-ready)
#          DISPATCH  the current leg is done (.leg-<n>-done) and the next is not launched
#          REMOUNT   the current leg's process exited (.leg-<n>-exited) with no hand-off,
#                    escalation or card: resume it, or relaunch it on the fallback after a wall
#          READ      a checkpoint card is waiting to be read (.checkpoint-*-ready)
#          INSPECT   no marker, nothing changed for 30 minutes, run not done
#          WAIT      a leg is running and its files are moving
#          FAULTS    the run is done or abandoned, and its tool faults wait on the postmaster:
#                    tool-fault lines scripts/tool-faults.sh has not harvested, or
#                    .tool-faults-ready after it did
#          -         the manifest says done or abandoned, and nothing waits
#
# Idle time ignores the marker files themselves, so touching a marker never hides a stall.
#
#   exit 0  listed (an empty root lists nothing)
#   exit 1  no such root
set -uo pipefail

status() {  # status <project-run-root>
  python3 - "$1" <<'PY'
import sys, os, json, time, glob
root = sys.argv[1]; now = time.time()

def faults_waiting(d):
    if os.path.exists(os.path.join(d, ".tool-faults-ready")):
        return True
    try:
        with open(os.path.join(d, "actions.jsonl"), errors="replace") as f:
            logged = sum(1 for l in f if '"action":"tool-fault"' in l)
    except OSError:
        return False
    try:
        harvested = int(json.load(open(os.path.join(d, "tool-faults.json"))).get("lines", 0))
    except (OSError, ValueError, TypeError, AttributeError):
        harvested = 0
    return logged > harvested

pm = os.path.join(root, "postmaster")
pm_esc = os.path.join(pm, "ESCALATION.md")
if os.path.isfile(pm_esc):
    print("POSTMASTER     escalation to the user is pending: %s" % pm_esc)
if faults_waiting(pm):
    print("POSTMASTER     tool faults wait on the postmaster: %s" % pm)
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
    markers = sorted(os.path.basename(p) for pat in (".*-ready", ".leg-*-done", ".leg-*-exited")
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
    if stage in ("done", "abandoned"): nxt = "FAULTS" if faults_waiting(d) else "-"
    elif ".escalation-ready" in markers: nxt = "RULE"
    elif ".card-ready" in markers: nxt = "GATE"
    elif done: nxt = "DISPATCH"
    elif exited: nxt = "REMOUNT"
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
  ROOT=${1:?usage: runs-status.sh <project-run-root> | --self-test}
  ROOT=$(cd "$ROOT" 2>/dev/null && pwd -P) || { echo "runs-status: no such root: $1" >&2; exit 1; }
  status "$ROOT"; exit $?
fi

# --- self-test ----------------------------------------------------------------------------
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
root="$tmp/project"; mkdir -p "$root/postmaster"
SELF="$(cd "$(dirname "$0")" && pwd -P)/$(basename "$0")"
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/         /'; fails=$((fails+1)); }
run() {  # run <name> <stage> [marker...]: a run directory with a manifest at leg 2
  local d="$root/$1" m; shift
  mkdir -p "$d"; printf '{"stage": "%s", "leg": 2}\n' "$1" > "$d/manifest.json"; shift
  for m in "$@"; do : > "$d/$m"; done
}
fault() { printf '{"ts":"2026-01-01T00:00:00Z","project":"project","run":"%s","actor":"coachman","action":"tool-fault","target":"scripts/launch.sh","detail":"x","fault":{}}\n' "$(basename "$1")" >> "$1/actions.jsonl"; }
harvested() { printf '{"run_id": "0a1b2c3d4e", "lines": %s, "faults": []}\n' "$2" > "$1/tool-faults.json"; }
next_of() { printf '%s\n' "$out" | awk -v r="$1" '$1 == r { print $NF }'; }
expect() {  # expect <label> <run> <next>
  [ "$(next_of "$2")" = "$3" ] && ok "$1" || fail "$1: wanted $3 for $2" "$out"
}

run DONE-CLEAN done; printf '{"action":"note"}\n' > "$root/DONE-CLEAN/actions.jsonl"
run DONE-UNHARVESTED done; fault "$root/DONE-UNHARVESTED"
run DONE-HARVESTED done; fault "$root/DONE-HARVESTED"; harvested "$root/DONE-HARVESTED" 1
run DONE-WAITING abandoned .tool-faults-ready; fault "$root/DONE-WAITING"; harvested "$root/DONE-WAITING" 1
run DONE-LATER done; fault "$root/DONE-LATER"; harvested "$root/DONE-LATER" 1; fault "$root/DONE-LATER"
run OPEN-FAULT review-bug; fault "$root/OPEN-FAULT"
run ESCALATED review-bug .escalation-ready
run CARD shipping .card-ready
run LEG-DONE synthesis .leg-2-done .leg-2-exited
run LEG-GONE synthesis .leg-2-exited
fault "$root/postmaster"
out=$("$SELF" "$root" 2>&1); rc=$?

echo "positive controls"
[ $rc -eq 0 ] && ok "the poll lists the root" || fail "the poll lists the root (exit $rc)" "$out"
expect "a closed run with tool faults not yet harvested says FAULTS" DONE-UNHARVESTED FAULTS
expect "a closed run whose harvest left a fault waiting says FAULTS" DONE-WAITING FAULTS
expect "a fault logged after the harvest says FAULTS again" DONE-LATER FAULTS
printf '%s\n' "$out" | grep -qF "POSTMASTER     tool faults wait on the postmaster: $root/postmaster" \
  && ok "the postmaster's own faults outside any run are named first" || fail "the postmaster's own faults outside any run are named first" "$out"
expect "an escalation says RULE" ESCALATED RULE
expect "a ship card says GATE" CARD GATE
expect "a done leg says DISPATCH" LEG-DONE DISPATCH
expect "a leg gone without a hand-off says REMOUNT" LEG-GONE REMOUNT

echo "negative controls"
expect "a closed run with no tool fault says -" DONE-CLEAN -
expect "a closed run whose faults were all harvested and dealt with says -" DONE-HARVESTED -
expect "an open run's fault waits for the run to close" OPEN-FAULT WAIT
harvested "$root/postmaster" 1; out=$("$SELF" "$root" 2>&1)
printf '%s\n' "$out" | grep -qF "tool faults wait" && fail "the postmaster's faults, once harvested, are not named" "$out" \
  || ok "the postmaster's faults, once harvested, are not named"
"$SELF" "$tmp/nowhere" >/dev/null 2>&1; rc=$?
[ $rc -eq 1 ] && ok "no such root exits 1" || fail "no such root exits 1 (exit $rc)"

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
