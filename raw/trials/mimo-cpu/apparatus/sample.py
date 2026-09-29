#!/usr/bin/env python3
"""Sample a launch's CPU from /proc, without touching its processes.

    sample.py <pidfile> <marker> <timeline.jsonl> [interval] [events file]

Waits for <pidfile>, which host.sh writes, then every <interval> seconds (0.5) records the
launched process and every descendant: its name, its CPU ticks (user and system), its bytes
read, and the CPU ticks of its threads by name (the main thread as `main`). Stops once <marker>
exists, which host.sh touches when the launch exits, and the tree is gone. With an events file,
each record also holds its size, so a harness's first event can be timed.
"""
import json, os, sys, time

pidfile, marker, out = sys.argv[1:4]
interval = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5
events = sys.argv[5] if len(sys.argv) > 5 else None


def table():
    t = {}
    for d in os.listdir("/proc"):
        if d.isdigit():
            try:
                s = open(f"/proc/{d}/stat").read()
            except OSError:
                continue
            f = s[s.rindex(")") + 2:].split()
            t[int(d)] = (s[s.index("(") + 1:s.rindex(")")], int(f[1]), int(f[11]), int(f[12]))
    return t


def threads(pid):
    by = {}
    try:
        tids = os.listdir(f"/proc/{pid}/task")
    except OSError:
        return by
    for tid in tids:
        try:
            s = open(f"/proc/{pid}/task/{tid}/stat").read()
        except OSError:
            continue
        name = "main" if tid == str(pid) else s[s.index("(") + 1:s.rindex(")")]
        f = s[s.rindex(")") + 2:].split()
        by[name] = by.get(name, 0) + int(f[11]) + int(f[12])
    return by


def rchar(pid):
    try:
        for line in open(f"/proc/{pid}/io"):
            if line.startswith("rchar:"):
                return int(line.split()[1])
    except OSError:
        pass
    return None


while not (os.path.exists(pidfile) and open(pidfile).read().strip()):
    time.sleep(0.05)
root = int(open(pidfile).read().strip())
seen = {root}
with open(out, "w") as o:
    while True:
        t = time.time()
        tab = table()
        kids = {}
        for pid, (_, ppid, _, _) in tab.items():
            kids.setdefault(ppid, []).append(pid)
        tree, stack = [], [p for p in seen if p in tab]
        while stack:
            p = stack.pop()
            if p in tab and p not in tree:
                tree.append(p)
                stack.extend(kids.get(p, []))
        seen.update(tree)
        rec = {"t": round(t, 3), "events": os.path.getsize(events) if events and os.path.exists(events) else 0, "procs": {p: {"comm": tab[p][0], "utime": tab[p][2], "stime": tab[p][3],
                                                "rchar": rchar(p), "threads": threads(p)} for p in tree}}
        o.write(json.dumps(rec) + "\n")
        o.flush()
        if not tree and os.path.exists(marker):
            break
        time.sleep(max(0, interval - (time.time() - t)))
