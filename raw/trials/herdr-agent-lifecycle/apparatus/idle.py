#!/usr/bin/env python3
"""Idle cost of the process tree under a pid: processes, threads, RSS, PSS, fds, TCP
connections, and CPU seconds used over a window. Reads /proc only.

    idle.py <window-seconds> <label>=<pid> [<label>=<pid> ...]
"""
import os, sys, time
HZ = os.sysconf("SC_CLK_TCK")
def children(pid):
    out, todo = [], [pid]
    while todo:
        p = todo.pop()
        out.append(p)
        try:
            for t in os.listdir("/proc/%d/task" % p):
                kids = open("/proc/%d/task/%s/children" % (p, t)).read().split()
                todo += [int(k) for k in kids]
        except OSError:
            pass
    return out
def cpu(p):
    f = open("/proc/%d/stat" % p).read().rsplit(")", 1)[1].split()
    return (int(f[11]) + int(f[12])) / HZ
def mem(p):
    rss = pss = 0
    for line in open("/proc/%d/smaps_rollup" % p):
        k, v = line.split(":", 1)
        if k == "Rss": rss = int(v.split()[0])
        if k == "Pss": pss = int(v.split()[0])
    return rss, pss
def tcp_inodes():
    ino = {}
    for f in ("/proc/net/tcp", "/proc/net/tcp6"):
        for line in open(f).readlines()[1:]:
            parts = line.split()
            ino[parts[9]] = parts[3]  # inode -> state
    return ino
window = float(sys.argv[1]); targets = [a.split("=") for a in sys.argv[2:]]
trees = {lab: children(int(pid)) for lab, pid in targets}
c0 = {lab: sum(cpu(p) for p in ps) for lab, ps in trees.items()}
time.sleep(window)
tcp = tcp_inodes()
for lab, ps in trees.items():
    c1 = sum(cpu(p) for p in ps)
    rss = pss = thr = fds = conns = est = 0
    names = []
    for p in ps:
        r, s = mem(p); rss += r; pss += s
        thr += len(os.listdir("/proc/%d/task" % p))
        names.append(open("/proc/%d/comm" % p).read().strip())
        for fd in os.listdir("/proc/%d/fd" % p):
            fds += 1
            try:
                tgt = os.readlink("/proc/%d/fd/%s" % (p, fd))
            except OSError:
                continue
            if tgt.startswith("socket:["):
                i = tgt[8:-1]
                if i in tcp:
                    conns += 1; est += tcp[i] == "01"
    print("%-8s procs=%d (%s) threads=%d rss=%.0f MiB pss=%.0f MiB fds=%d tcp=%d established=%d cpu_over_%ds=%.2fs" % (
        lab, len(ps), ",".join(names), thr, rss / 1024, pss / 1024, fds, conns, est, window, c1 - c0[lab]))
