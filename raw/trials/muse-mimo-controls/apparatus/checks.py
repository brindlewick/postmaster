#!/usr/bin/env python3
"""Read what run.sh recorded and print each check with its positive (+) and negative (-)
control, ok when the control came out as it must. Each reader is the one harnesses.md names:

    muse thread id      stream.id of the first record
    muse final message  payload.text of the last run.terminal.* record
    muse model          run.model.configured's model_id, and its source
    mimo thread id      sessionID of the first event
    mimo final message  part.text of the last text event
    mimo prompt, model  what standin.py was sent

    checks.py <trial dir> <records dir> <standin log> <muse model>
"""
import json, pathlib, sys

T, R, LOG, MODEL = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3], sys.argv[4]
PROMPT = (T / "prompt.txt").read_text(encoding="utf-8")
fails = 0


def rc(n):
    try:
        return int((R / (n + ".rc")).read_text())
    except (OSError, ValueError):
        return None


def events(n):
    out = []
    try:
        for line in open(R / (n + ".jsonl"), encoding="utf-8", errors="replace"):
            try:
                out.append(json.loads(line))
            except ValueError:
                pass
    except OSError:
        pass
    return out


def err(n):
    try:
        return (R / (n + ".err")).read_text(errors="replace")
    except OSError:
        return ""


def control(sign, ok, text):
    global fails
    fails += 0 if ok else 1
    print("  %s %s %s" % ("ok  " if ok else "FAIL", sign, text))


def fact(text):
    print("       fact: " + text)


# muse readers
def m_id(ev):
    return ((ev[0].get("stream") or {}).get("id")) if ev else None


def m_ids(ev):
    return {(e.get("stream") or {}).get("id") for e in ev}


def m_final(ev):
    term = [e for e in ev if str(e.get("payload_type", "")).startswith("run.terminal.")]
    return ((term[-1].get("payload") or {}).get("text") or None) if term else None


def m_terminal(ev):
    term = [e for e in ev if str(e.get("payload_type", "")).startswith("run.terminal.")]
    return term[-1]["payload_type"] if term else None


def m_input(ev):
    got = [(e.get("payload") or {}).get("prompt") for e in ev if e.get("payload_type") == "turn.input.user"]
    return got[-1] if got else None


def m_model(ev):
    got = [e.get("payload") or {} for e in ev if e.get("payload_type") == "run.model.configured"]
    return (got[-1].get("model_id"), got[-1].get("source")) if got else (None, None)


def m_record(n):
    """session.opened and session.resumed from a muse session record."""
    opened, resumed = [], []
    try:
        for line in open(R / (n + ".jsonl"), encoding="utf-8"):
            e = json.loads(line)
            rec = (e.get("payload") or {}).get("record") or {}
            if e.get("payload_type") == "session.opened.observed":
                opened.append(rec.get("resume"))
            if e.get("payload_type") == "session.resumed":
                resumed.append(rec.get("prior_turn_count"))
    except (OSError, ValueError):
        pass
    return opened, resumed


# mimo readers
def x_id(ev):
    return ev[0].get("sessionID") if ev else None


def x_final(ev):
    texts = [e for e in ev if e.get("type") == "text"]
    return ((texts[-1].get("part") or {}).get("text")) if texts else None


def requests(n):
    """The stand-in's requests made during run n: between its mark and the next one."""
    reqs = [json.loads(l) for l in open(LOG, encoding="utf-8")]
    marks = [(name, int(count)) for name, count in (l.split() for l in open(R / "marks"))]
    for i, (name, start) in enumerate(marks):
        if name == n:
            return reqs[start:marks[i + 1][1]] if i + 1 < len(marks) else reqs[start:]
    return []


def main_request(n):
    got = [r for r in requests(n) if r.get("tools", 0) > 1]
    return got[-1] if got else None


def last_user(req):
    users = [m["text"] for m in (req or {}).get("messages", []) if m["role"] == "user"]
    return users[-1] if users else None


print("The prompt file: %d characters, %r" % (len(PROMPT), PROMPT))
print()
print("muse: its echo provider, and its own provider (%s) for the model checks" % MODEL)

launch, resume, fresh = events("muse-launch"), events("muse-resume"), events("muse-fresh")
mid = m_id(launch)
print("thread id: stream.id of the first record")
control("+", rc("muse-launch") == 0 and mid and m_ids(launch) == {mid} and rc("muse-export-real") == 0,
        "the launch's first stream.id, %s, is on each of its %d records, and muse's own export finds that thread in the launch's data directory (exit %s)"
        % (mid, len(launch), rc("muse-export-real")))
control("-", rc("muse-export-ghost") not in (0, None),
        "an id muse never issued: its export finds no such thread (exit %s)" % rc("muse-export-ghost"))

print("final message: payload.text of the last run.terminal.* record")
control("+", m_final(launch) == "echo: " + PROMPT,
        "the launch's last %s carries the echo provider's answer, \"echo: \" and the prompt file byte for byte" % m_terminal(launch))
bad = events("live-bad")
control("-", m_final(bad) is None and m_terminal(bad) == "run.terminal.failed",
        "a run that fails ends on %s, and the reader finds no final message (exit %s)" % (m_terminal(bad), rc("live-bad")))

print("prompt as received: turn.input.user, and what the echo provider answered")
control("+", m_input(launch) == PROMPT and m_final(launch) == "echo: " + PROMPT,
        "the launch form's --prompt-file reached the turn byte for byte")
argv = events("muse-argv")
control("-", m_input(argv) is not None and m_input(argv) != PROMPT,
        "the same prompt as an argument, `\"$(cat <file>)\"`, arrived as %r: the check tells a changed prompt apart" % (m_input(argv) or "")[-24:])

print("resume: the same thread, on its model")
opened, resumed = m_record("muse-session")
control("+", rc("muse-resume") == 0 and m_ids(resume) == {mid} and resumed and resumed[-1] >= 1,
        "through launch.sh the resume carries the launch's id on each record, and muse's record says session.resumed after %s turn(s)"
        % (resumed[-1] if resumed else None))
fopened, fresumed = m_record("muse-fresh-session")
control("-", m_id(fresh) not in (None, mid) and not fresumed and fopened == [False],
        "a fresh launch carries another id, %s, and its record says session.opened with resume false and no session.resumed" % m_id(fresh))
ll, lr = events("live-launch"), events("live-resume")
lmodel, lsource = m_model(ll)
rmodel, rsource = m_model(lr)
control("+", rc("live-launch") == 0 and rc("live-resume") == 0 and lmodel == MODEL and rmodel == MODEL and rsource == "replay"
        and m_ids(lr) == {m_id(ll)},
        "its own provider: the launch ran on %s (%s), the resume through launch.sh on the same thread and on %s (%s); final messages %r and %r"
        % (lmodel, lsource, rmodel, rsource, m_final(ll), m_final(lr)))
bmodel, bsource = m_model(bad)
control("-", bmodel not in (None, MODEL),
        "a resume of that thread naming another model reports it: run.model.configured %s (%s)" % (bmodel, bsource))

print("a thread muse does not hold")
ghost = events("muse-ghost-direct")
control("-", rc("muse-ghost-launchsh") == 1 and not events("muse-ghost-launchsh")
        and (R / "muse-ghost-launchsh.sessions").read_text().strip() == "0",
        "launch.sh refuses to resume an id muse never issued, exit %s, and no thread by that id appears: %s"
        % (rc("muse-ghost-launchsh"), err("muse-ghost-launchsh").strip()[:160]))
fact("muse itself, resuming that id, exited %s having opened a new thread under it: first stream.id %s, final message %r"
     % (rc("muse-ghost-direct"), m_id(ghost), (m_final(ghost) or "")[:40]))
control("-", rc("muse-other-launchsh") == 1 and not events("muse-other-launchsh"),
        "launch.sh refuses a resume from another directory, whose data directory holds no such thread (exit %s)" % rc("muse-other-launchsh"))
fact("muse itself, resuming the thread from another directory with its data directory, exited %s: %s"
     % (rc("muse-other-direct"), " ".join(l for l in err("muse-other-direct").splitlines() if "refusing" in l)[:400]))

print()
print("mimo: standin.py")
xl, xr, xo, xf = events("mimo-launch"), events("mimo-resume"), events("mimo-other-model"), events("mimo-fresh")
xid = x_id(xl)
exported = {}
try:
    exported = json.loads((R / "mimo-export-real.jsonl").read_text()).get("info", {})
except (OSError, ValueError):
    pass
print("thread id: sessionID of the first event")
control("+", rc("mimo-launch") == 0 and xid and {e.get("sessionID") for e in xl} == {xid} and rc("mimo-export-real") == 0
        and exported.get("id") == xid,
        "the launch's first sessionID, %s, is on each of its %d events, and mimo's own export finds it in the launch's data directory"
        % (xid, len(xl)))
control("-", rc("mimo-export-ghost") not in (0, None),
        "an id mimo never issued: its export finds no such thread (exit %s)" % rc("mimo-export-ghost"))

print("final message: part.text of the last text event")
req = main_request("mimo-launch")
control("+", x_final(xl) == "alpha" and req and req.get("reply") == "alpha",
        "the launch's last text event is %r, what the stand-in answered" % x_final(xl))
xfail = events("mimo-fail")
control("-", x_final(xfail) is None and any(e.get("type") == "error" for e in xfail),
        "a turn the stand-in fails has no text event and one error event, and the reader finds no final message (exit %s)" % rc("mimo-fail"))

print("prompt as received: the last user message the stand-in was sent")
got = last_user(req)
control("+", got == "\n" + PROMPT,
        "the launch form's stdin arrived as the prompt file byte for byte, after one newline mimo puts before it")
agot = last_user(main_request("mimo-argv"))
control("-", agot is not None and agot not in (PROMPT, "\n" + PROMPT),
        "the same prompt as an argument arrived as %r...: quoted, its own quotes escaped" % (agot or "")[:40])

print("resume: the same thread, on its model")
rreq, oreq, freq = main_request("mimo-resume"), main_request("mimo-other-model"), main_request("mimo-fresh")
history = [m["text"] for m in (rreq or {}).get("messages", [])]
control("+", rc("mimo-resume") == 0 and {e.get("sessionID") for e in xr} == {xid} and x_final(xr) == "beta"
        and (rreq or {}).get("model") == (req or {}).get("model") == "standin-a"
        and history[:2] == ["\n" + PROMPT, "alpha"],
        "through launch.sh the resume carries the launch's id, sends the launch's turn and answer first, and runs on %s, the launch's model"
        % (rreq or {}).get("model"))
control("-", (oreq or {}).get("model") == "standin-b" and {e.get("sessionID") for e in xo} == {xid},
        "a resume of that thread naming another model is sent as %s: the check tells another model apart" % (oreq or {}).get("model"))
control("-", freq is not None and len([m for m in freq["messages"] if m["role"] == "user"]) == 1 and x_id(xf) != xid,
        "a fresh launch sends one user message and no earlier turn, under another id, %s" % x_id(xf))

print("a thread mimo does not hold")
control("-", rc("mimo-ghost-launchsh") == 1 and not events("mimo-ghost-launchsh") and not requests("mimo-ghost-launchsh"),
        "launch.sh refuses to resume an id mimo never issued, exit %s, and nothing reaches the stand-in: %s"
        % (rc("mimo-ghost-launchsh"), err("mimo-ghost-launchsh").strip()[:160]))
fact("mimo itself, resuming that id, exited %s with %d events, sent the stand-in %d requests, and wrote on stderr: %s"
     % (rc("mimo-ghost-direct"), len(events("mimo-ghost-direct")), len(requests("mimo-ghost-direct")),
        " ".join(l for l in err("mimo-ghost-direct").splitlines() if "not found" in l.lower())[:160]))
control("-", rc("mimo-other-launchsh") == 1 and not events("mimo-other-launchsh") and not requests("mimo-other-launchsh"),
        "launch.sh refuses a resume from another directory, whose data directory holds no such thread (exit %s)" % rc("mimo-other-launchsh"))
tool = [m["text"] for r in requests("mimo-other-direct") for m in r.get("messages", []) if m["role"] == "tool"]
fact("mimo itself, resuming the thread from another directory with its data directory, exited %s, and its shell tool ran in %s"
     % (rc("mimo-other-direct"), (tool[-1].strip() if tool else None)))

print()
print("checks: %s" % ("every control behaved" if fails == 0 else "%d control(s) misbehaved" % fails))
sys.exit(1 if fails else 0)
