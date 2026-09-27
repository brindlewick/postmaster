#!/usr/bin/env python3
"""Record Herdr's pushed events for given panes, one JSON line each with the local receipt
time. Subscribes over the session socket with events.subscribe, to agent status changes on
the named panes and to pane exits, closes and agent detections anywhere (filtered here to
the named panes). Reads only; sends nothing but the subscription.

    events.py <out.jsonl> <pane-id> [<pane-id> ...]
"""
import json, os, socket, sys, time

out, panes = sys.argv[1], sys.argv[2:]
subs = [{"type": "pane.agent_status_changed", "pane_id": p} for p in panes]
subs += [{"type": t} for t in ("pane.exited", "pane.closed", "pane.agent_detected", "pane.updated")]
s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
s.connect(os.environ["HERDR_SOCKET_PATH"])
s.sendall((json.dumps({"id": "trial16:sub", "method": "events.subscribe", "params": {"subscriptions": subs}}) + "\n").encode())
buf = b""
with open(out, "a", buffering=1) as f:
    while True:
        chunk = s.recv(65536)
        if not chunk:
            f.write(json.dumps({"t": int(time.time() * 1000), "closed": True}) + "\n")
            break
        buf += chunk
        while b"\n" in buf:
            line, buf = buf.split(b"\n", 1)
            if not line.strip():
                continue
            t = int(time.time() * 1000)
            try:
                msg = json.loads(line)
            except ValueError:
                f.write(json.dumps({"t": t, "unparsed": line[:200].decode("utf-8", "replace")}) + "\n")
                continue
            data = msg.get("data") or {}
            pane = data.get("pane_id") or (data.get("pane") or {}).get("pane_id")
            if msg.get("event") and pane not in panes and msg.get("event") != "pane.agent_status_changed":
                continue
            f.write(json.dumps({"t": t, "msg": msg}) + "\n")
