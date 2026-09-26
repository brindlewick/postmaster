#!/usr/bin/env python3
"""Which flags `codex exec resume` accepts, and which model and effort a resumed thread runs on.

    trial.py <out-dir> [<launch.sh before> <launch.sh after>]

Drives the `codex` on PATH against a stand-in Responses API provider on 127.0.0.1. The stand-in
records every request and answers each turn with one message naming the model and effort it was
asked for. codex runs with HOME set to a fresh directory, so it reads no user configuration and
writes nothing outside that directory, and with stdin empty.

Part 1 launches a fresh thread per case, in the launch form scripts/launch.sh builds, then
resumes it in the form under test. Part 2, given two copies of scripts/launch.sh, launches and
resumes a lane and a coachman leg through each. In the output, the work directory is written
<trial> and the temporary directory holding it <tmp>.
"""
import json, os, pathlib, re, shutil, socket, subprocess, sys, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

if len(sys.argv) not in (2, 4) or not shutil.which("codex"):
    sys.exit("usage: trial.py <out-dir> [<launch.sh before> <launch.sh after>], with codex on PATH")
OUT = pathlib.Path(sys.argv[1]).resolve()
LAUNCH_SH = [str(pathlib.Path(p).resolve()) for p in sys.argv[2:4]]
W = pathlib.Path(tempfile.mkdtemp(prefix="codex-resume-trial."))

# --- the stand-in -------------------------------------------------------------------------
requests, lock = [], threading.Lock()


def sse(event, data):
    return ("event: %s\ndata: %s\n\n" % (event, json.dumps(data))).encode()


class StandIn(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def reply(self, code, body=b"", ctype=None):
        self.send_response(code)
        if ctype:
            self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        with lock:
            requests.append({"method": "GET", "path": self.path})
        self.reply(404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"null")
        except ValueError:
            body = None
        with lock:
            requests.append({"method": "POST", "path": self.path, "body": body})
            seq = len(requests)
        if not self.path.rstrip("/").endswith("/responses") or not isinstance(body, dict):
            return self.reply(404)
        text = "stand-in reply: model=%s effort=%s" % (
            body.get("model"), (body.get("reasoning") or {}).get("effort"))
        rid = "resp_standin_%d" % seq
        self.reply(200, b"".join([
            sse("response.created", {"type": "response.created", "response": {"id": rid}}),
            sse("response.output_item.done", {
                "type": "response.output_item.done", "output_index": 0,
                "item": {"type": "message", "role": "assistant", "id": "msg_standin_%d" % seq,
                         "content": [{"type": "output_text", "text": text}]}}),
            sse("response.completed", {"type": "response.completed", "response": {
                "id": rid, "usage": {"input_tokens": 1, "input_tokens_details": None,
                                     "output_tokens": 1, "output_tokens_details": None,
                                     "total_tokens": 2}}}),
        ]), "text/event-stream")


server = ThreadingHTTPServer(("127.0.0.1", 0), StandIn)
PORT = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()

# --- the codex homes and the worktrees ----------------------------------------------------
PROVIDER = """model_provider = "standin"

[model_providers.standin]
name = "stand-in"
base_url = "http://127.0.0.1:%d/v1"
wire_api = "responses"
""" % PORT
DEFAULTS = 'model = "config-model"\nmodel_reasoning_effort = "low"\n'


def codex_home(name, defaults=True, trust=()):
    home = W / name
    (home / ".codex").mkdir(parents=True)
    text = (DEFAULTS if defaults else "") + PROVIDER
    for d in trust:
        text += '\n[projects."%s"]\ntrust_level = "trusted"\n' % d
    (home / ".codex" / "config.toml").write_text(text)
    return home


def git(*args):
    subprocess.run(["git", *args], check=True, capture_output=True)


WT, SCRATCH = W / "wt", W / "scratch"
git("init", "-q", "-b", "main", str(WT))
git("-C", str(WT), "-c", "user.name=trial", "-c", "user.email=trial@example.invalid",
    "commit", "-q", "--allow-empty", "-m", "init")
git("-C", str(WT), "worktree", "add", "-q", "--detach", str(SCRATCH), "HEAD")
HOMES = {"defaults": codex_home("home-defaults", True, (WT, SCRATCH)),
         "no-defaults": codex_home("home-no-defaults", False, (WT, SCRATCH))}

# --- running and reading ------------------------------------------------------------------


def scrub(text):
    return text.replace(str(W), "<trial>").replace(str(W.parent), "<tmp>")


def run(argv, cwd, home, env_extra=None):
    """Run argv from cwd with HOME=home and stdin empty; return (exit, stdout, stderr, requests)."""
    env = dict(os.environ, HOME=str(home), **(env_extra or {}))
    env.pop("CODEX_HOME", None)
    with lock:
        mark = len(requests)
    try:
        p = subprocess.run(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                           capture_output=True, text=True, timeout=180)
        rc, out, err = p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired as e:
        rc, out, err = "timeout", e.stdout or "", e.stderr or ""
    with lock:
        made = requests[mark:]
    return rc, out, err, made


def turns(made):
    """What each turn request asked for: model, effort, and the prompts it carried."""
    rows = []
    for r in made:
        b = r.get("body")
        if r["method"] != "POST" or not isinstance(b, dict):
            continue
        texts = []
        for item in b.get("input", []):
            if item.get("type") == "message" and item.get("role") == "user":
                for c in item.get("content", []):
                    t = c.get("text", "")
                    if c.get("type") == "input_text" and not t.startswith("<environment_context>"):
                        texts.append(t)
        rows.append({"path": r["path"], "model": b.get("model"),
                     "effort": (b.get("reasoning") or {}).get("effort"),
                     "input_items": len(b.get("input", [])), "user_prompts": texts})
    return rows


def thread_id(stream):
    m = re.search(r'"thread_id":"([^"]+)"', stream)
    return m.group(1) if m else None


def shape(stream):
    """The event types of a JSONL stream, repeats collapsed; or 'text' when it is not JSONL."""
    lines = [l for l in stream.splitlines() if l.strip()]
    if not lines:
        return "empty"
    kinds = []
    for l in lines:
        try:
            e = json.loads(l)
        except ValueError:
            return "text"
        k = e["item"]["type"] if e.get("type") == "item.completed" else e.get("type")
        if kinds and kinds[-1][0] == k:
            kinds[-1][1] += 1
        else:
            kinds.append([k, 1])
    return ", ".join(k if n == 1 else "%s x%d" % (k, n) for k, n in kinds)


def turn_contexts(home, tid):
    rows = []
    for f in sorted((home / ".codex" / "sessions").rglob("rollout-*%s.jsonl" % tid)):
        for line in f.read_text().splitlines():
            e = json.loads(line)
            if e.get("type") == "turn_context":
                p = e["payload"]
                rows.append({"model": p.get("model"), "effort": p.get("effort"),
                             "approval_policy": p.get("approval_policy"),
                             "sandbox": (p.get("sandbox_policy") or {}).get("type")})
    return rows


def show(argv):
    return " ".join(a if re.fullmatch(r"[\w@%+=:,./<>-]+", a) else "'%s'" % a for a in argv)


def block(label, text, lang=""):
    text = text if text.endswith("\n") or not text else text + "\n"
    return "%s\n\n```%s\n%s```\n\n" % (label, lang, text or "(empty)\n")


def jsonl(rows):
    return "".join(json.dumps(r) + "\n" for r in rows)


def step_md(title, argv, rc, out, err, rows, last=None):
    md = "## %s\n\n" % title + block("Command:", show(argv), "sh") + "Exit: %s\n\n" % rc
    md += block("stdout:", out, "jsonl" if shape(out) not in ("text", "empty") else "")
    md += block("stderr:", err)
    if last is not None:
        md += block("The `-o` file:", last.read_text() if last.exists() else "(not written)\n")
    md += block("What each turn request to the stand-in asked for:", jsonl(rows), "jsonl")
    return md


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(scrub(text))


def models(rows):
    return "; ".join("%s, %s" % (r["model"], r["effort"]) for r in rows) or "no request"


# --- part 1: the resume forms -------------------------------------------------------------
LAUNCH = ["codex", "exec", "-C", "{cwd}", "--json", "-o", "{launch_last}", "-m", "launch-model",
          "-c", 'model_reasoning_effort="high"', "--dangerously-bypass-approvals-and-sandbox"]
BYPASS = "--dangerously-bypass-approvals-and-sandbox"
FLAGS = ["--json", "-o", "{last}", "-m", "resume-model", "-c", 'model_reasoning_effort="medium"']
R = ["codex", "exec", "resume", "{thread}"]
CASES = [  # name, codex home, cwd, launch extra, resume argv
    ("bare", "defaults", WT, [], R + [BYPASS, "{prompt}"]),
    ("json", "defaults", WT, [], R + ["--json", BYPASS, "{prompt}"]),
    ("last", "defaults", WT, [], R + ["-o", "{last}", BYPASS, "{prompt}"]),
    ("model", "defaults", WT, [], R + ["-m", "resume-model", BYPASS, "{prompt}"]),
    ("effort", "defaults", WT, [], R + ["-c", 'model_reasoning_effort="medium"', BYPASS, "{prompt}"]),
    ("all-four", "defaults", WT, [], R + FLAGS + [BYPASS, "{prompt}"]),
    ("all-four-before-resume", "defaults", WT, [],
     ["codex", "exec"] + FLAGS + [BYPASS, "resume", "{thread}", "{prompt}"]),
    ("no-bypass", "defaults", WT, [], R + FLAGS + ["{prompt}"]),
    ("sandbox-flag", "defaults", WT, [], R + ["-s", "danger-full-access", "{prompt}"]),
    ("cd-flag", "defaults", WT, [], R + ["-C", "{cwd}", BYPASS, "{prompt}"]),
    ("detached-scratch", "defaults", SCRATCH, ["--skip-git-repo-check"], R + FLAGS + [BYPASS, "{prompt}"]),
    ("bare-no-config-defaults", "no-defaults", WT, [], R + [BYPASS, "{prompt}"]),
]


def fill(argv, **kw):
    return [a.format(**kw) if "{" in a else a for a in argv]


summary = ["# Results", "",
           "Written by `trial.py`, from the files beside it. The codex config's defaults are",
           "`config-model`, effort `low`, except in `bare-no-config-defaults`, where it names neither.",
           "Every launch passes `-m launch-model` and effort `high`. A resume passing `-m` names",
           "`resume-model`, and one passing an effort names `medium`.", "",
           "## Part 1: the resume forms, run directly", "",
           "| case | exit | stdout | `-o` file | request: model, effort | codex's record: model, "
           "effort, sandbox | same thread |",
           "|---|---|---|---|---|---|---|"]
for name, home_key, cwd, extra, resume in CASES:
    home = HOMES[home_key]
    launch_last = W / (name + "-launch-last.md")
    launch_argv = fill(LAUNCH, cwd=cwd, launch_last=launch_last) + extra
    launch_argv.append("Say the word pineapple and stop. (%s, launch)" % name)
    rc, out, err, made = run(launch_argv, cwd, home)
    tid = thread_id(out)
    md = "# %s\n\n" % name + step_md("Launch", launch_argv, rc, out, err, turns(made), launch_last)
    last = W / (name + "-resume-last.md")
    argv = fill(resume, thread=tid, last=last, cwd=cwd,
                prompt="Say the word pineapple again. (%s, resume)" % name)
    rc, out, err, made = run(argv, cwd, home)
    rows = turns(made)
    md += step_md("Resume", argv, rc, out, err, rows, last)
    ctx = turn_contexts(home, tid) if tid else []
    md += block("codex's own record of each turn, from the thread's rollout file:", jsonl(ctx), "jsonl")
    write(OUT / "part1" / (name + ".md"), md)
    same = thread_id(out) in (None, tid) and any(launch_argv[-1] in r["user_prompts"] for r in rows)
    summary.append("| [%s](part1/%s.md) | %s | %s | %s | %s | %s | %s |" % (
        name, name, rc, shape(out), "written" if last.exists() else "none", models(rows),
        "; ".join("%s, %s, %s" % (c["model"], c["effort"], c["sandbox"]) for c in ctx[1:]) or "no turn",
        ("yes" if same else "no") if rows else "n/a"))

# --- part 2: through launch.sh -------------------------------------------------------------
if LAUNCH_SH:
    CONFIG = W / "postmaster.toml"
    CONFIG.write_text("""[lanes.one]
harness = "codex"
model = "lane-model"
effort = "high"

[team]
coachman = { harness = "codex", model = "coach-model", effort = "medium" }

[team.coachman_legs]
review = { harness = "codex", model = "review-model", effort = "medium" }
""")
    summary += ["", "## Part 2: through launch.sh", "",
                "The postmaster config puts lane `one` on `lane-model`, effort `high`, and the",
                "coachman's review leg on `review-model`, effort `medium`. The codex config's",
                "defaults are `config-model`, effort `low`, as in part 1.", "",
                "| launch.sh | name | step | exit | stdout | `-o` file | request: model, effort | "
                "codex's record: model, effort |",
                "|---|---|---|---|---|---|---|---|"]
    for label, script in zip(("before", "after"), LAUNCH_SH):
        home = codex_home("lhome-" + label)
        env = {"POSTMASTER_CONFIG": str(CONFIG)}
        for name, extra in (("one", []), ("coachman", ["--leg", "review"])):
            key = "%s-%s" % (label, name)
            p1, p2 = W / (key + "-launch.txt"), W / (key + "-resume.txt")
            p1.write_text("Say the word pineapple and stop. (%s %s, launch)\n" % (label, name))
            p2.write_text("Say the word pineapple again. (%s %s, resume)\n" % (label, name))
            l1, l2 = W / (key + "-launch-last.md"), W / (key + "-resume-last.md")
            md = "# launch.sh %s, %s\n\n" % (label, name + (" --leg review" if extra else ""))
            md += block("The postmaster config:", CONFIG.read_text(), "toml")
            tid, ctx_n = None, 0
            for step, lastf in (("launch", l1), ("resume", l2)):
                argv = [script, step, name, str(WT)] + ([str(tid)] if step == "resume" else [])
                argv += [str(p1 if step == "launch" else p2)] + extra
                argv += ["--last", str(lastf)] if name == "one" else []
                rc, out, err, made = run(argv, WT, home, env)
                if step == "launch":
                    tid = thread_id(out)
                rows = turns(made)
                shown = ["launch.sh" if a == script else a for a in argv]
                md += step_md(step.capitalize(), shown, rc, out, err, rows,
                              lastf if name == "one" else None)
                ctx = turn_contexts(home, tid) if tid else []
                summary.append("| %s | [%s](part2/%s.md) | %s | %s | %s | %s | %s | %s |" % (
                    label, name + (" --leg review" if extra else ""), key, step, rc, shape(out),
                    ("written" if lastf.exists() else "none") if name == "one" else "not asked",
                    models(rows),
                    "; ".join("%s, %s" % (c["model"], c["effort"]) for c in ctx[ctx_n:]) or "no turn"))
                ctx_n = len(ctx)
            md += block("codex's own record of each turn, from the thread's rollout file:",
                        jsonl(turn_contexts(home, tid) if tid else []), "jsonl")
            write(OUT / "part2" / (key + ".md"), md)

version = subprocess.run(["codex", "--version"], capture_output=True, text=True,
                         env=dict(os.environ, HOME=str(HOMES["defaults"]))).stdout.strip()
summary += ["", "codex: `%s`" % version, ""]
write(OUT / "results.md", "\n".join(summary))

server.shutdown()
print("work directory: %s" % W)
print("output: %s" % OUT)
needles = ["/tmp/", "/home/", os.environ.get("USER") or "\0", socket.gethostname()]
leaks = sorted({"%s (%s)" % (p.relative_to(OUT), n) for p in OUT.rglob("*") if p.is_file()
                for n in needles if n in p.read_text()})
if leaks:
    sys.exit("left in the output: %s" % ", ".join(leaks))
