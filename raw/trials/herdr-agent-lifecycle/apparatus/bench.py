#!/usr/bin/env python3
"""Time the two ways a coachman learns a lane has finished and delivers it a new
instruction, against the stand-in provider, for one harness.

  live    the lane is an interactive agent in a Herdr pane: `herdr agent prompt` delivers,
          and `agent prompt --wait` (or a separate `agent wait`) says it has finished
  marker  the lane is headless: `launch.sh resume` delivers, the wrapper touches a marker
          on exit, and `wait-for-markers.sh` notices it, exactly as coachman.md runs it

For every repetition it records when the instruction was issued, when the request reached
the stand-in, when the stand-in finished the reply, and when the coachman's wait returned.

    bench.py live   <agent-name> <out-dir> <sleep,sleep,...> [--separate-wait]
    bench.py marker <lane> <cwd> <thread-id> <out-dir> <sleep,sleep,...>

Needs POSTMASTER_CONFIG for marker, the stand-in log at $STANDIN_LOG, and the postmaster
repo at $TOOL.
"""
import json, os, subprocess, sys, time, uuid

LOG, TOOL = os.environ["STANDIN_LOG"], os.environ["TOOL"]


def ms():
    return int(time.time() * 1000)


def standin_record(tag, timeout=900):
    """The stand-in's line for the request whose user message carries this tag."""
    end = time.time() + timeout
    while time.time() < end:
        for line in open(LOG):
            r = json.loads(line)
            if tag in (r.get("user_tail") or "") and "t_done" in r:
                return r
        time.sleep(0.05)
    return None


def live(agent, out, sleeps, separate):
    rows = []
    for i, s in enumerate(sleeps):
        tag = "rep-%s" % uuid.uuid4().hex[:8]
        text = "SLEEP=%s %s reply OK" % (s, tag)
        t0 = ms()
        if separate:
            p = subprocess.run(["herdr", "agent", "prompt", agent, text], capture_output=True, text=True)
            t_sent = ms()
            w = subprocess.run(["herdr", "agent", "wait", agent, "--timeout", "600000"], capture_output=True, text=True)
            rc, res = w.returncode, w.stdout or w.stderr
        else:
            p = subprocess.run(["herdr", "agent", "prompt", agent, text, "--wait", "--timeout", "600000"],
                               capture_output=True, text=True)
            t_sent, rc, res = None, p.returncode, p.stdout or p.stderr
        t1 = ms()
        r = standin_record(tag, 30) or {}
        try:
            status = json.loads(res)["result"]["agent"]["agent_status"]
        except Exception:
            status = res.strip()[:200]
        rows.append({"level": "live", "rep": i + 1, "sleep_s": s, "tag": tag, "issued": t0, "prompt_returned": t_sent,
                     "request_in": r.get("t_in"), "reply_done": r.get("t_done"), "wait_returned": t1,
                     "wait_exit": rc, "wait_status": status,
                     "deliver_ms": (r["t_in"] - t0) if r else None,
                     "detect_ms": (t1 - r["t_done"]) if r else None})
        print(json.dumps(rows[-1]), flush=True)
        time.sleep(1)
    return rows


def marker(lane, cwd, thread, out, sleeps):
    rows = []
    logs = os.path.join(out, "logs")
    os.makedirs(logs, exist_ok=True)
    for i, s in enumerate(sleeps):
        tag = "rep-%s" % uuid.uuid4().hex[:8]
        name = "r%d-%s" % (i + 1, tag)
        prompt = os.path.join(out, name + "-prompt.txt")
        open(prompt, "w").write("SLEEP=%s %s reply OK\n" % (s, tag))
        # the coachman's own wrapper and wait, in one command, as coachman.md writes them
        cmd = ("( %(tool)s/scripts/launch.sh resume %(lane)s %(cwd)s %(thread)s %(prompt)s "
               "> %(logs)s/%(name)s.jsonl 2> %(logs)s/%(name)s.err; touch %(logs)s/%(name)s.done ) & "
               "%(tool)s/scripts/wait-for-markers.sh %(logs)s '%(name)s.done' 1 600" %
               {"tool": TOOL, "lane": lane, "cwd": cwd, "thread": thread, "prompt": prompt, "logs": logs, "name": name})
        t0 = ms()
        w = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True)
        t1 = ms()
        r = standin_record(tag, 30) or {}
        done_mtime = int(os.path.getmtime(os.path.join(logs, name + ".done")) * 1000)
        rows.append({"level": "marker", "rep": i + 1, "sleep_s": s, "tag": tag, "issued": t0,
                     "request_in": r.get("t_in"), "reply_done": r.get("t_done"), "marker_touched": done_mtime,
                     "wait_returned": t1, "wait_exit": w.returncode, "wait_said": w.stdout.strip()[-80:],
                     "deliver_ms": (r["t_in"] - t0) if r else None,
                     "exit_after_reply_ms": (done_mtime - r["t_done"]) if r else None,
                     "detect_ms": (t1 - r["t_done"]) if r else None})
        print(json.dumps(rows[-1]), flush=True)
        time.sleep(1)
    return rows


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "live":
        agent, out, sleeps = sys.argv[2], sys.argv[3], [float(x) for x in sys.argv[4].split(",")]
        os.makedirs(out, exist_ok=True)
        rows = live(agent, out, sleeps, "--separate-wait" in sys.argv)
    else:
        lane, cwd, thread, out, sleeps = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], [float(x) for x in sys.argv[6].split(",")]
        os.makedirs(out, exist_ok=True)
        rows = marker(lane, cwd, thread, out, sleeps)
    with open(os.path.join(out, "rows.jsonl"), "a") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
