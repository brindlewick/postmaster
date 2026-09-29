#!/usr/bin/env python3
"""Summarise one launch sampled by sample.py.

    report.py <launch dir> <label>

The launch dir holds timeline.jsonl, events.jsonl and err.txt, and, for a launch on the
stand-in, standin.jsonl; a mimo launch's data directory is under hd/. The harness process is
the busiest process named .mimocode, bun or codex. Prints one line of JSON:

  wall_s, cpu_s          the launch's whole life, the harness process only
  wait, stream           on the stand-in: the agent's turn held silent, then streaming, each
                         trimmed by 2 s at the start and 0.5 s at the end
  model                  on a real provider: from the harness's first model request to its exit
                         (mimo: its log's first `service=llm` line; codex: its first event)
  each window            seconds, the harness's CPU as a share of one core, and its threads' shares
  gc                     with BUN_JSC_logGC on: eden and full collections, and their total cycle ms
"""
import datetime, glob, json, os, re, sys

HZ = os.sysconf("SC_CLK_TCK")
d, label = sys.argv[1], sys.argv[2]
recs = [json.loads(l) for l in open(f"{d}/timeline.jsonl")]
recs = [r for r in recs if r["procs"]]


def ticks(p):
    return p["utime"] + p["stime"]


last = {}
for r in recs:
    for pid, p in r["procs"].items():
        if p["comm"] in (".mimocode", "bun", "codex"):
            last[pid] = ticks(p)
hp = max(last, key=last.get)
mine = [r for r in recs if hp in r["procs"]]


def at(t):
    return min(mine, key=lambda r: abs(r["t"] - t))


def window(a, b):
    ra, rb = at(a), at(b)
    dt = rb["t"] - ra["t"]
    if dt < 3:
        return None
    pa, pb = ra["procs"][hp], rb["procs"][hp]
    th = {k: round((v - pa["threads"].get(k, 0)) / HZ / dt * 100, 1) for k, v in pb["threads"].items()}
    return {"s": round(dt, 1), "cpu_pct": round((ticks(pb) - ticks(pa)) / HZ / dt * 100, 1),
            "threads": {k: v for k, v in sorted(th.items(), key=lambda kv: -kv[1]) if v >= 0.5}}


out = {"launch": label, "harness": mine[0]["procs"][hp]["comm"],
       "wall_s": round(mine[-1]["t"] - mine[0]["t"], 1), "cpu_s": round(ticks(mine[-1]["procs"][hp]) / HZ, 1)}
if os.path.exists(f"{d}/standin.jsonl"):
    turn = [r for r in map(json.loads, open(f"{d}/standin.jsonl")) if r.get("agent_turn")]
    if turn:
        t = turn[0]
        out["pace"] = t["pace"]
        out["deltas"] = t["deltas"]
        out["wait"] = window(t["at"] + 2, t["stream_start"] - 0.5)
        out["stream"] = window(t["stream_start"] + 2, t["end"] - 0.5)
else:
    start = None
    for log in sorted(glob.glob(f"{d}/hd/mimo/*/mimocode/log/*.log")):
        for line in open(log, errors="replace"):
            m = re.match(r"\S+\s+(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d) .*service=llm ", line)
            if m:
                start = datetime.datetime.fromisoformat(m.group(1) + "+00:00").timestamp()
                break
        if start:
            break
    if start is None:
        start = next((r["t"] for r in recs if r.get("events")), None)
    if start is not None:
        out["model"] = window(start, mine[-1]["t"])
err = open(f"{d}/err.txt", errors="replace").read() if os.path.exists(f"{d}/err.txt") else ""
if "Collection," in err:
    out["gc"] = {"eden": err.count("=> EdenCollection"), "full": err.count("=> FullCollection"),
                 "cycle_ms": round(sum(float(x) for x in re.findall(r"cycle ([0-9.]+)ms END", err)))}
print(json.dumps(out))
