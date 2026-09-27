#!/usr/bin/env bash
# One line per run under a project's run root: the run, its stage and leg from the manifest,
# the markers present, minutes since anything in it changed, and what the postmaster does
# next. This is the postmaster's poll; it reads files and nothing else. A pending escalation
# from the postmaster to the user is printed first, since it is what everything else may
# be waiting on.
#
#   runs-status.sh <project-run-root>        e.g. ~/.postmaster/runs/<project>
#
#   next   RULE      an escalation is waiting (.escalation-ready)
#          GATE      the ship card is complete (.card-ready)
#          DISPATCH  the current leg is done (.leg-<n>-done) and the next is not launched
#          REMOUNT   the current leg's process exited (.leg-<n>-exited) with no hand-off,
#                    escalation or card: resume it, or relaunch it on the fallback after a wall
#          READ      a checkpoint card is waiting to be read (.checkpoint-*-ready)
#          INSPECT   no marker, nothing changed for 30 minutes, run not done
#          WAIT      a leg is running and its files are moving
#          -         the manifest says done or abandoned
#
# Idle time ignores the marker files themselves, so touching a marker never hides a stall.
#
#   exit 0  listed (an empty root lists nothing)
#   exit 1  no such root
set -uo pipefail
ROOT=${1:?usage: runs-status.sh <project-run-root>}
ROOT=$(cd "$ROOT" 2>/dev/null && pwd -P) || { echo "runs-status: no such root: $1" >&2; exit 1; }
python3 - "$ROOT" <<'PY'
import sys, os, json, time, glob
root = sys.argv[1]; now = time.time()
pm_esc = os.path.join(root, "postmaster", "ESCALATION.md")
if os.path.isfile(pm_esc):
    print("POSTMASTER     escalation to the user is pending: %s" % pm_esc)
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
    if stage in ("done", "abandoned"): nxt = "-"
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
