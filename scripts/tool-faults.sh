#!/usr/bin/env bash
# Turn the faults a run met in postmaster itself into tickets on postmaster's own tracker, once
# the run has closed. A run never fixes postmaster: each fault is logged as it happens, as a
# `tool-fault` action (scripts/log-action.sh), and this script collects them afterwards.
#
#   tool-faults.sh harvest <dispatch>             group the run's tool-fault lines, one entry per
#                                                 distinct fault; draft a ticket for each; look
#                                                 each up on postmaster's own tracker
#   tool-faults.sh comment <dispatch> <id> [<ticket>]
#                                                 comment on a known fault's ticket that it was
#                                                 seen again, naming the run by its public id; with
#                                                 <ticket>, on that one, on the user's word that
#                                                 it holds the same fault
#   tool-faults.sh file <dispatch> <id>           file a new fault's draft as a ticket
#   tool-faults.sh decline <dispatch> <id> <word> the user said no: recorded, and nothing filed
#   tool-faults.sh --self-test
#
# <dispatch> is a closed run's directory (stage done or abandoned), or <runs>/postmaster for the
# faults the postmaster met outside any run.
#
# Repeats of one fault are grouped: the same postmaster file, and the same --failed text once
# case, punctuation, paths, numbers, ids and the target's names are set aside. A fault's id,
# tf-<8 hex>, is taken from those two, so one fault has one id in every run, and the title of
# its ticket carries it.
#
# postmaster's own tracker is the one the config's [tracker] kind gives postmaster's own
# checkout, the directory above this script: github through scripts/github.sh, and only when
# the user administers the repository (github.sh access); plane through scripts/plane.sh, under
# the identifier postmaster's own commit messages carry. With neither, or no config, the faults
# stay in the run's records.
#
# A ticket or a comment carries the postmaster file, the failure (--failed) and the proposed fix
# (--fix), and nothing else of a fault, once made safe to publish: a path or a link is kept only
# when it is postmaster's own; the target's names are withheld; so is a word of the waybill that
# postmaster's own text never uses, a run of four words the waybill shares with it that
# postmaster's text does not, and a token that looks like code and is not postmaster's own
# word. The run is named by a public id kept in <dispatch>/tool-faults.json, where grep finds
# it again, and never by its directory, whose name is the target's ticket. comment and file
# check the text again before anything is written, and file refuses a draft
# scripts/ticket-check.sh fails.
#
# Writes <dispatch>/tool-faults.json (the public run id, how many tool-fault lines have been
# harvested, each fault's state), a draft per fault at <dispatch>/tool-faults/<id>.md with its
# title in <id>.title, left alone once written so a draft the user changed stays changed, and
# <dispatch>/.tool-faults-ready while a fault waits on the postmaster. A fault's state is:
#   known <ticket>   postmaster's tracker has it: a ticket's title carries its id, or a comment
#                    on a fault ticket for the same file does; comment
#   new              it has none: put the draft to the user; "like" names fault tickets for the
#                    same file
#   kept             postmaster has no tracker this script can reach, and the line says why
#   commented, filed, declined   done, as the run's log or tool-faults.json records
#
#   exit 0  done; harvest prints a line for the run, then one per fault
#   exit 1  usage; no such dispatch, fault or draft; a run still open; an unreadable log or
#           config; or the tracker failed a read or a write
#   exit 2  comment or file refused: the text is not safe to publish, the draft fails
#           scripts/ticket-check.sh, or the fault is not in a state for it
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
TOOL=$(dirname "$HERE")
CONFIG=${POSTMASTER_CONFIG:-$HOME/.postmaster/config.toml}
usage() { echo "usage: tool-faults.sh harvest <dispatch> | comment <dispatch> <id> [<ticket>] | file <dispatch> <id> | decline <dispatch> <id> <the user's word> | --self-test" >&2; exit 1; }

run_py() {  # run_py <command> <dispatch> [args...]
  python3 - "$HERE" "$TOOL" "$CONFIG" "$@" <<'PY'
import datetime as dt, hashlib, json, os, pathlib, re, secrets, subprocess, sys, tempfile, tomllib

HERE, TOOL, CONFIG = (pathlib.Path(a) for a in sys.argv[1:4])
CMD, ARGS = sys.argv[4], sys.argv[5:]

def die(msg, code=1):
    print("tool-faults: " + msg, file=sys.stderr); sys.exit(code)

if not pathlib.Path(ARGS[0]).is_dir():
    die("no such dispatch directory: %s" % ARGS[0])
D = pathlib.Path(ARGS[0]).resolve()
LOG, STATE, DRAFTS, MARKER = D / "actions.jsonl", D / "tool-faults.json", D / "tool-faults", D / ".tool-faults-ready"
PENDING, TERMINAL = ("known", "new"), ("commented", "filed", "declined")

def run(argv, **kw):
    return subprocess.run([str(a) for a in argv], capture_output=True, text=True, **kw)

def git(where, *args):
    r = run(["git", "-C", where, *args])
    return r.stdout.strip() if r.returncode == 0 else ""

def why(r):
    return ((r.stderr or r.stdout).strip().splitlines() or ["exit %d" % r.returncode])[-1]

def closed():
    if D.name == "postmaster":
        return
    try:
        stage = json.loads((D / "manifest.json").read_text()).get("stage")
    except (OSError, ValueError):
        die("%s has no manifest to read" % D)
    if stage not in ("done", "abandoned"):
        die("the run is still open (stage %s); its faults are harvested when it closes" % stage)

def read_log():
    out = []
    if LOG.exists():
        for n, line in enumerate(LOG.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            if line.strip():
                try:
                    out.append(json.loads(line))
                except ValueError:
                    die("%s line %d is not a log line" % (LOG, n))
    return out

def log(action, target, detail):
    r = run([HERE / "log-action.sh", D, "postmaster", action, target, detail])
    if r.returncode:
        die("the log could not be written: %s" % why(r))

# --- what may be published ------------------------------------------------------------------

WORD = re.compile(r"[A-Za-z][A-Za-z']*")
URL = re.compile(r"\b[A-Za-z][A-Za-z0-9+.-]*://[^\s)\]>'\"`]+")
PATHLIKE = re.compile(r"[~<>\w.@+-]*/[<>\w./@+-]*")
FILELIKE = re.compile(r"(?<![\w./-])[\w-]+(?:\.[\w-]+)*\.[A-Za-z]\w{1,7}(?![\w/])")
IDENT = re.compile(r"(?<![\w\[])[A-Za-z_][A-Za-z0-9_]*(?![\w\]])")
TICKS = re.compile(r"`([^`\n]+)`")
HEX = re.compile(r"(?=[0-9a-f]*\d)[0-9a-f]{7,40}")
IDS = re.compile(r"\btf-[0-9a-f]{8}\b|\b(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b")
N = 4

def words(text):
    return [w.lower().strip("'") for w in WORD.findall(text)]

def grams(ws):
    return {tuple(ws[i:i + N]) for i in range(len(ws) - N + 1)}

def origin(where):
    m = re.search(r"([^/:]+)/([^/]+?)(?:\.git)?/?$", git(where, "remote", "get-url", "origin"))
    return (m.group(1), m.group(2)) if m else None

class Safe:
    """What of a fault may be published: postmaster's own words and paths, and nothing of the target's."""
    def __init__(self):
        files = [p for sub in ("scripts", "skills", "wiki") if (TOOL / sub).is_dir()
                 for p in sorted((TOOL / sub).rglob("*")) if p.is_file()]
        files += sorted(TOOL.glob("*.md")) + [TOOL / "config.example.toml"]
        texts = []
        for p in files:
            try:
                texts.append(p.read_text(encoding="utf-8"))
            except (OSError, UnicodeDecodeError):
                pass
        own = "\n".join(texts)
        ws = words(own)
        self.vocab, self.grams = set(ws), grams(ws)
        self.idents = {t.lower() for t in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", own)}
        self.paths = {p.lower() for p in PATHLIKE.findall(own)}
        self.urls = {u.lower().rstrip(".,;:") for u in URL.findall(own)}
        self.files = {f.lower() for f in FILELIKE.findall(own)} | {p.name.lower() for p in files}
        waybill = ""
        try:
            waybill = (D / "brief.md").read_text(encoding="utf-8", errors="replace")
        except OSError:
            pass
        m = re.search(r"^repo:\s*(\S+)", waybill, re.M)
        repo = pathlib.Path(os.path.expanduser(m.group(1))) if m else None
        names = set()
        if repo and repo.is_dir() and self.is_postmaster(repo):
            waybill = ""                  # postmaster's own ticket, name and paths are public
        else:
            names = {D.parent.name} | ({D.name} if D.name != "postmaster" else set())
            k = re.match(r"([A-Za-z][A-Za-z0-9]*)[-_]\d+$", D.name)
            names |= {k.group(1)} if k else set()
            if repo:
                names.add(repo.name)
                names |= set(origin(repo) or ()) if repo.is_dir() else set()
        names = sorted((n for n in names if len(n) >= 2 and not n.isdigit()), key=len, reverse=True)
        self.names = re.compile(r"(?<![A-Za-z0-9])(%s)(?![A-Za-z0-9])" % "|".join(map(re.escape, names)), re.I) if names else None
        ws = words(waybill)
        self.waybill_words = set(ws) - self.vocab
        self.waybill_grams = grams(ws) - self.grams

    @staticmethod
    def is_postmaster(repo):
        a = git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir")
        b = git(TOOL, "rev-parse", "--path-format=absolute", "--git-common-dir")
        if a and b and os.path.realpath(a) == os.path.realpath(b):
            return True
        o = origin(repo)
        return bool(o) and tuple(x.lower() for x in o) == tuple(x.lower() for x in (origin(TOOL) or ()))

    def own_path(self, p):
        if p.startswith(str(TOOL) + "/"):
            p = p[len(str(TOOL)) + 1:]
        rel = p[2:] if p.startswith("./") else p
        if rel and not rel.startswith(("/", "~")) and ".." not in rel.split("/") and (TOOL / rel).exists():
            return rel
        return p if p.lower() in self.paths else None

    def publish(self, text):
        def path(m):
            tok = m.group(0); core = tok.rstrip(".,;:"); own = self.own_path(core)
            return (own if own else "[path]") + tok[len(core):]
        text = URL.sub(lambda m: m.group(0) if m.group(0).lower().rstrip(".,;:") in self.urls else "[link]", text)
        text = PATHLIKE.sub(path, text)
        text = FILELIKE.sub(lambda m: m.group(0) if m.group(0).lower() in self.files else "[path]", text)
        ids = []                          # fault ids, the run id and commit shas are postmaster's
        def protect(m):
            ids.append(m.group(0)); return "\x01%d\x02" % (len(ids) - 1)
        text = IDS.sub(protect, text)
        if self.names:
            text = self.names.sub("[project]", text)
        spans = [(m.start(), m.end(), m.group(0).lower().strip("'")) for m in WORD.finditer(text)]
        hide = set()
        for i in range(len(spans) - N + 1):
            if tuple(s[2] for s in spans[i:i + N]) in self.waybill_grams:
                hide.update(range(i, i + N))
        for i in sorted(hide, reverse=True):
            s, e, _ = spans[i]
            text = text[:s] + "\0" + text[e:]
        text = re.sub(r"\0(?:[\s,.;:'\"()-]*\0)*", "[ticket text]", text)
        def code(m):
            tok = m.group(0)
            return tok if tok.lower() in self.idents or HEX.fullmatch(tok) else "[code]"
        text = TICKS.sub(lambda m: "`" + IDENT.sub(code, m.group(1)) + "`", text)
        def codeish(m):
            tok = m.group(0)
            looks = "_" in tok or re.search(r"[a-z][A-Z]", tok) or re.search(r"\d", tok)
            return code(m) if looks else tok
        text = IDENT.sub(codeish, text)
        text = WORD.sub(lambda m: "[withheld]" if m.group(0).lower().strip("'") in self.waybill_words else m.group(0), text)
        return re.sub(r"\x01(\d+)\x02", lambda m: ids[int(m.group(1))], text)

    def key(self, failed):
        t = PATHLIKE.sub(" path ", failed)
        t = (self.names.sub(" project ", t) if self.names else t).lower()
        t = IDS.sub(" id ", t)
        return " ".join(re.findall(r"[a-z]+", re.sub(r"\d+", " n ", t)))

def tidy(text):
    return " ".join(text.split())

def clip(text, n):
    return text if len(text) <= n else text[:n - 3].rstrip() + "..."

# --- the run's faults -----------------------------------------------------------------------

def controls():
    try:
        text = (TOOL / "skills/postmaster/controls.md").read_text()
    except OSError:
        return {}
    return dict(re.findall(r"^\| `([^`]+)` \| ([\w-]+) \|", text, re.M))

DONE = re.compile(r"^tool fault (tf-[0-9a-f]{8}) (filed|seen again|declined)")

def fields(e):
    return e.get("fault") if isinstance(e.get("fault"), dict) else {}

def faults(entries, safe):
    """The run's distinct faults, in the order first seen, and what the log says was done with each."""
    listed, groups = controls(), {}
    for i, e in enumerate(entries):
        if e.get("action") != "tool-fault":
            continue
        f, file = fields(e), str(e.get("target", ""))
        fid = "tf-" + hashlib.sha256(("%s\n%s" % (file, safe.key(str(f.get("failed", ""))))).encode()).hexdigest()[:8]
        g = groups.setdefault(fid, {"id": fid, "file": file, "entries": [], "at": i})
        g["entries"].append(e)
    for g in groups.values():
        es = g["entries"]
        g["control"] = listed.get(g["file"]) or next((fields(e)["control"] for e in es if fields(e).get("control")), "")
        g["workarounds"] = [fields(e)["workaround"] for e in es if fields(e).get("workaround")]
        g["escalated"] = any(e.get("action") == "escalate" for e in entries[g["at"] + 1:])
    done = {}
    for e in entries:
        m = DONE.match(str(e.get("detail", "")))
        if m and e.get("actor") == "postmaster" and e.get("action") in ("ticket-create", "ticket-comment", "note"):
            done[m.group(1)] = ({"filed": "filed", "seen again": "commented", "declined": "declined"}[m.group(2)],
                                "" if e["action"] == "note" else str(e.get("target", "")))
    return list(groups.values()), done

def load_state():
    try:
        return json.loads(STATE.read_text())
    except (OSError, ValueError):
        return {}

def save_state(st):
    fd, tmp = tempfile.mkstemp(dir=D); os.close(fd)
    with open(tmp, "w") as f:
        json.dump(st, f, indent=2); f.write("\n")
    os.replace(tmp, STATE)
    if any(x.get("state") in PENDING for x in st.get("faults", [])):
        MARKER.touch()
    elif MARKER.exists():
        MARKER.unlink()

def meta():
    try:
        pm = json.loads((D / "run.json").read_text()).get("postmaster") or {}
    except (OSError, ValueError):
        return ""
    if not pm.get("commit"):
        return ""
    return ", which ran postmaster %s%s" % (pm["commit"][:12], " with uncommitted changes" if pm.get("uncommitted_changes") else "")

def seen(n):
    return "once" if n == 1 else "%d times" % n

# --- postmaster's own tracker ---------------------------------------------------------------

class Tracker:
    def __init__(self, kind, ident=""):
        self.kind, self.ident = kind, ident
    def call(self, op, *args):
        if self.kind == "github":
            argv = [HERE / "github.sh", TOOL, op, *args]
        else:
            argv = [HERE / "plane.sh", op, *((self.ident,) if op in ("list", "create") else ()), *args]
        return run(argv, env={**os.environ, "POSTMASTER_CONFIG": str(CONFIG)})
    def tickets(self):
        r = self.call("list")
        if r.returncode:
            return None, why(r)
        return [tuple(l.split("\t", 2)) for l in r.stdout.splitlines() if l.count("\t") >= 2], ""

def reach():
    """postmaster's own tracker and its tickets, or None and why not."""
    try:
        cfg = tomllib.load(open(CONFIG, "rb"))
    except FileNotFoundError:
        return None, [], "no config at %s" % CONFIG
    except (OSError, tomllib.TOMLDecodeError) as e:
        die("cannot read %s: %s" % (CONFIG, e))
    kind = (cfg.get("tracker") or {}).get("kind", "github")
    if kind == "github":
        if not origin(TOOL):
            return None, [], "postmaster's checkout has no origin remote"
        r = run([HERE / "github.sh", TOOL, "access"])
        if r.returncode:
            return None, [], "github.sh access: %s" % why(r)
        if r.stdout.strip() != "ADMIN":
            return None, [], "the user does not own postmaster's repository (github.sh access: %s)" % r.stdout.strip()
        t = Tracker("github")
    elif kind == "plane":
        m = re.search(r"^tracker_prefix=(\S+)$", run([HERE / "discover-project.sh", TOOL]).stdout, re.M)
        if not m:
            return None, [], "postmaster's commit messages name no Plane project"
        t = Tracker("plane", m.group(1))
    else:
        return None, [], "the %s tracker has no adapter script" % kind
    rows, err = t.tickets()
    return (t, rows, "") if rows is not None else (None, [], "its tickets could not be listed: %s" % err)

def lookup(tracker, rows, fid, file):
    """The ticket that carries a fault, if any, and the other fault tickets for its file."""
    k = next((r for r in rows if "[%s]" % fid in r[2]), None)
    like = [r for r in rows if r is not k and r[2].startswith("Tool fault in %s:" % file)]
    for r in like if not k else []:
        got = tracker.call("read", r[0])
        if got.returncode == 0 and "tool fault %s " % fid in got.stdout:
            k = r
            break
    return k, [r[0] for r in like if r is not k]

# --- the drafts -----------------------------------------------------------------------------

def draft(g, rid, safe):
    es = g["entries"]
    file = safe.publish(g["file"])
    failed = tidy(safe.publish(str(fields(es[0]).get("failed", ""))))
    fixes = list(dict.fromkeys(tidy(safe.publish(str(fields(e).get("fix", "")))) for e in es))
    roles = " and ".join(dict.fromkeys(str(e.get("actor", "")) for e in es))
    title = "Tool fault in %s: %s [%s]" % (file, clip(failed.rstrip("."), 90), g["id"])
    facts = ["A run met a fault in `%s`: %s%s" % (file, failed, "" if failed.endswith((".", "!", "?")) else ".")]
    if g["control"]:
        facts.append("It is a fault in a control (%s), which stops the leg." % g["control"])
    if g["workarounds"]:
        facts.append("The run worked around it.")
    if g["escalated"]:
        facts.append("The run stopped and escalated.")
    facts.append("It was seen %s in run %s%s." % (seen(len(es)), rid, meta()))
    if len(fixes) == 1:
        direction = ["The fix the %s that met it proposed: %s" % (roles, fixes[0])]
    else:
        direction = ["The fixes proposed by the %s that met it:" % roles, ""] + ["- " + f for f in fixes]
    body = ["## Problem / feature", " ".join(facts), "",
            "## Acceptance criteria",
            "1. The fault above no longer happens.",
            "2. A control that fails on this fault, and passes with the fix, is part of the change.", "",
            "## Direction"] + direction + ["",
            "## Turnpikes", "default", "",
            "## Notes",
            "Filed from run %s by `scripts/tool-faults.sh`. The run's own records keep the full evidence: "
            "what ran, the error and the diagnosis. This ticket carries only the file, the failure and the "
            "proposed fix. If the fix changes the coachman contract (markers, the waybill shape, completion "
            "detection), a fixture run confirms it before it merges." % rid, "",
            "Tool fault id: `%s`." % g["id"]]
    return title, "\n".join(body) + "\n"

def checked(title, body_path, safe):
    """Why a draft may not be filed, or nothing."""
    body = body_path.read_text()
    bad = [("title", title)] if safe.publish(title) != title else []
    bad += [("body", l) for l in body.splitlines() if safe.publish(l) != l]
    if bad:
        return "not safe to publish:\n" + "\n".join("  %s: %s\n  made safe: %s" % (w, t, safe.publish(t)) for w, t in bad)
    r = run([HERE / "ticket-check.sh", "--body", body_path, "--title", title])
    return "" if r.returncode == 0 else "the draft fails scripts/ticket-check.sh:\n" + (r.stdout + r.stderr).rstrip()

# --- the commands ---------------------------------------------------------------------------

def harvest():
    closed()
    entries, safe = read_log(), Safe()
    groups, done = faults(entries, safe)
    st = load_state()
    rid = st.get("run_id")
    while not rid or not re.search(r"\d", rid):
        rid = secrets.token_hex(5)
    before = {x["id"]: x for x in st.get("faults", [])}
    todo = [g for g in groups if g["id"] not in done and before.get(g["id"], {}).get("state") not in TERMINAL]
    tracker, rows, reason = reach() if todo else (None, [], "no fault waits on it")
    if groups:
        DRAFTS.mkdir(exist_ok=True)
    out, notes = [], []
    for g in groups:
        fid, x = g["id"], {"id": g["id"], "file": g["file"], "control": g["control"], "count": len(g["entries"]),
                           "first": g["entries"][0].get("ts", ""), "last": g["entries"][-1].get("ts", ""),
                           "escalated": g["escalated"], "workarounds": g["workarounds"], "ticket": "", "like": []}
        prior = before.get(fid, {})
        if fid in done:
            x["state"], x["ticket"] = done[fid]
        elif prior.get("state") in TERMINAL:
            x["state"], x["ticket"] = prior["state"], prior.get("ticket", "")
        elif not tracker:
            x["state"] = "kept"
        else:
            k, x["like"] = lookup(tracker, rows, fid, safe.publish(g["file"]))
            if k:
                x["state"], x["ticket"], x["ticket_state"], x["like"] = "known", k[0], k[1], []
            else:
                x["state"] = "new"
        title_path, body_path = DRAFTS / (fid + ".title"), DRAFTS / (fid + ".md")
        if not body_path.exists():
            title, body = draft(g, rid, safe)
            title_path.write_text(title + "\n"); body_path.write_text(body)
        x["draft"] = str(body_path.relative_to(D))
        problem = checked(title_path.read_text().strip(), body_path, safe) if x["state"] in PENDING + ("kept",) else ""
        x["fileable"] = not problem
        st_line = x["state"] + (" " + x["ticket"] if x["ticket"] else "") + (", " + x["ticket_state"] if x.get("ticket_state") else "")
        st_line += (", like " + " ".join(x["like"])) if x["like"] else ""
        out.append("%s  %s  %s%s  %s" % (fid, g["file"], "control (%s)  " % g["control"] if g["control"] else "", seen(x["count"]), st_line))
        if g["control"] and not g["escalated"]:
            notes.append("  %s: a fault in a control, and the run's log has no escalation after it" % fid)
        for w in g["workarounds"] if g["control"] else []:
            notes.append("  %s: a fault in a control, worked around: %s" % (fid, w))
        if problem:
            notes.append("  %s: %s" % (fid, problem.replace("\n", "\n    ")))
        before[fid] = x
    lines = sum(1 for e in entries if e.get("action") == "tool-fault")
    st = {"run_id": rid, "harvested": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
          "lines": lines, "tracker": tracker.kind if tracker else reason, "faults": [before[g["id"]] for g in groups]}
    save_state(st)
    if not groups:
        print("run %s: no tool faults" % rid); return
    where = ("postmaster's own tracker, " + tracker.kind) if tracker else ("no tracker of postmaster's own, so they stay in %s: %s" % (STATE, reason) if todo else "every fault dealt with")
    print("run %s: %d tool-fault line%s, %d fault%s; %s" % (rid, lines, "" if lines == 1 else "s", len(groups), "" if len(groups) == 1 else "s", where))
    print("\n".join(out + notes))
    if any(before[g["id"]]["state"] in PENDING + ("kept",) for g in groups):
        print("drafts: %s" % DRAFTS)

def fault_of(fid):
    closed()
    st = load_state()
    if not st:
        die("no harvest yet in %s; run: tool-faults.sh harvest %s" % (D, D))
    x = next((x for x in st.get("faults", []) if x["id"] == fid), None)
    if not x:
        die("no fault %s in %s" % (fid, STATE))
    return st, x

def settle(st, x, state, ticket):
    x["state"], x["ticket"] = state, ticket
    save_state(st)

def comment(fid, ticket):
    st, x = fault_of(fid)
    safe = Safe()
    groups, done = faults(read_log(), safe)
    if fid in done or x["state"] in TERMINAL:
        print("%s: already %s" % (fid, " ".join(filter(None, done.get(fid) or (x["state"], x.get("ticket", "")))))); return
    tracker, rows, reason = reach()
    if not tracker:
        die("no tracker of postmaster's own: %s" % reason)
    g = next(g for g in groups if g["id"] == fid)
    if ticket:
        k = next((r for r in rows if r[0].lstrip("#") == ticket.lstrip("#")), None)
        if not k:
            die("postmaster's tracker has no ticket %s" % ticket)
    else:
        k = lookup(tracker, rows, fid, safe.publish(g["file"]))[0]
        if not k:
            die("%s has no ticket on postmaster's tracker, so it is new: file it, or decline it" % fid, 2)
    text = "tool fault %s seen again: %s in run %s%s." % (fid, seen(len(g["entries"])), st["run_id"], meta())
    text += " This ticket is %s." % k[1] if k[1] in ("done", "cancelled") else ""
    if safe.publish(text) != text:
        die("the comment is not safe to publish: %s" % text, 2)
    r = tracker.call("comment", k[0], "postmaster", text)
    if r.returncode:
        die("the tracker refused the comment: %s" % why(r))
    settle(st, x, "commented", k[0])
    log("ticket-comment", k[0], "tool fault %s seen again, on postmaster's own tracker" % fid)
    print("%s: commented on %s" % (fid, k[0]))

def file(fid):
    st, x = fault_of(fid)
    safe = Safe()
    groups, done = faults(read_log(), safe)
    if fid in done or x["state"] in TERMINAL:
        print("%s: already %s" % (fid, " ".join(filter(None, done.get(fid) or (x["state"], x.get("ticket", "")))))); return
    title_path, body_path = DRAFTS / (fid + ".title"), DRAFTS / (fid + ".md")
    if not (title_path.exists() and body_path.exists()):
        die("no draft for %s in %s" % (fid, DRAFTS))
    tracker, rows, reason = reach()
    if not tracker:
        die("no tracker of postmaster's own: %s" % reason)
    k = lookup(tracker, rows, fid, safe.publish(x["file"]))[0]
    if k:
        die("%s is already %s on postmaster's tracker: comment on it instead" % (fid, k[0]), 2)
    title = title_path.read_text().strip()
    problem = checked(title, body_path, safe)
    if problem:
        die("%s is not filed: %s" % (fid, problem), 2)
    r = tracker.call("create", title, body_path)
    if r.returncode:
        die("the tracker refused the ticket: %s" % why(r))
    made = r.stdout.strip().splitlines()[-1]
    ticket = "#" + made if tracker.kind == "github" and made.isdigit() else made
    settle(st, x, "filed", ticket)
    log("ticket-create", ticket, "tool fault %s filed on postmaster's own tracker" % fid)
    print("%s: filed as %s" % (fid, ticket))

def decline(fid, word):
    st, x = fault_of(fid)
    groups, done = faults(read_log(), Safe())
    if fid in done or x["state"] in TERMINAL:
        print("%s: already %s" % (fid, " ".join(filter(None, done.get(fid) or (x["state"], x.get("ticket", "")))))); return
    settle(st, x, "declined", "")
    log("note", fid, "tool fault %s declined by the user: %s" % (fid, word))
    print("%s: declined" % fid)

if CMD == "harvest":
    harvest()
elif CMD in ("comment", "file", "decline"):
    fid = ARGS[1]
    if not re.fullmatch(r"tf-[0-9a-f]{8}", fid):
        die("not a fault id: %s" % fid)
    if CMD == "comment":
        comment(fid, ARGS[2] if len(ARGS) > 2 else "")
    elif CMD == "file":
        file(fid)
    else:
        decline(fid, " ".join(ARGS[2:]))
PY
}

case ${1:-} in
  --self-test) ;;
  harvest) [ $# -eq 2 ] || usage; run_py "$@"; exit $? ;;
  comment) [ $# -eq 3 ] || [ $# -eq 4 ] || usage; run_py "$@"; exit $? ;;
  file) [ $# -eq 3 ] || usage; run_py "$@"; exit $? ;;
  decline) [ $# -ge 4 ] || usage; run_py "$@"; exit $? ;;
  *) usage ;;
esac

# --- self-test ----------------------------------------------------------------------------
# Runs a copy of postmaster's scripts and skills, whose checkout's origin is a stand-in GitHub
# repository, with a stub gh first on PATH: it answers from canned files and records every issue
# it is asked to create or comment on, so nothing reaches GitHub. The target's name, owner, paths,
# an identifier and a sentence of its ticket are made up afresh on each run, so that none of them
# is in postmaster's own text, this file included.
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
T="$tmp/tool"; S="$tmp/stub"; RUNS="$tmp/runs"
mkdir -p "$T/skills" "$S" "$tmp/bin" || exit 1
cp -R "$HERE" "$T/scripts" && cp -R "$TOOL/skills/postmaster" "$T/skills/postmaster" || exit 1
git -C "$T" init -q && git -C "$T" remote add origin https://github.com/o/postmaster.git || exit 1
cat > "$tmp/bin/gh" <<'GH'
#!/usr/bin/env bash
d=$TOOL_FAULTS_STUB
case "$1 $2" in
  "auth status") exit 0 ;;
  "api graphql")
    q=""
    for a in "$@"; do case $a in query=*) q=$a ;; esac; done
    case $q in
      *viewerPermission*) cat "$d/access.json" ;;
      *projectsV2*) cat "$d/boards.json" ;;
      *"issues(first:"*) cat "$d/issues.json" ;;
      *"issue(number:"*)
        n=""; for a in "$@"; do case $a in number=*) n=${a#number=} ;; esac; done
        python3 - "$d" "$n" <<'ISSUE'
import json, sys
d, n = sys.argv[1], int(sys.argv[2])
nodes = json.load(open(d + "/issues.json"))["data"]["repository"]["issues"]["nodes"]
iss = next((x for x in nodes if x["number"] == n), None)
said = []
try:
    said = [l.split(" ", 2)[2].rstrip("\n") for l in open(d + "/comments.log") if l.startswith("#%d " % n)]
except OSError:
    pass
if iss:
    iss = dict(iss, body="", url="https://github.com/o/postmaster/issues/%d" % n, createdAt="2026-01-01T00:00:00Z",
               comments={"nodes": [{"body": b, "createdAt": "2026-01-01T00:00:00Z", "author": {"login": "o"}} for b in said]})
print(json.dumps({"data": {"repository": {"issue": iss}}}))
ISSUE
        ;;
      *) echo "stub gh: unexpected query" >&2; exit 1 ;;
    esac ;;
  "project item-list") echo '{"items": []}' ;;
  "project field-list") echo '{"fields": [{"id": "F1", "name": "Status", "options": [{"id": "o1", "name": "Todo"}, {"id": "o2", "name": "In Progress"}, {"id": "o3", "name": "Done"}]}]}' ;;
  "project item-add") echo '{"id": "PVTI_new"}' ;;
  "project item-edit") exit 0 ;;
  "issue create")
    t="" f="" prev=""
    for a in "$@"; do case $prev in --title) t=$a ;; --body-file) f=$a ;; esac; prev=$a; done
    n=$(( $(cat "$d/next" 2>/dev/null || echo 60) )); echo $((n + 1)) > "$d/next"
    printf 'create #%s %s\n' "$n" "$t" >> "$d/writes.log"; cp -- "$f" "$d/created-$n.md"
    echo "https://github.com/o/postmaster/issues/$n" ;;
  "issue comment")
    b="" prev=""
    for a in "$@"; do [ "$prev" = --body ] && b=$a; prev=$a; done
    printf 'comment #%s %s\n' "$3" "$b" >> "$d/writes.log"; printf '#%s %s\n' "$3" "$b" >> "$d/comments.log" ;;
  *) echo "stub gh: unexpected: $*" >&2; exit 1 ;;
esac
GH
chmod +x "$tmp/bin/gh"
printf '%s\n' '{"data": {"repository": {"projectsV2": {"nodes": [{"id": "PVT_1", "number": 1, "title": "postmaster", "closed": false, "url": "https://github.com/users/o/projects/1", "owner": {"login": "o"}}]}}}}' > "$S/boards.json"
access() { printf '{"data": {"repository": {"viewerPermission": "%s"}}}\n' "$1" > "$S/access.json"; }
issues() {  # issues [<number> <title>]...: the issues postmaster's own repository holds
  python3 - "$@" > "$S/issues.json" <<'PY'
import json, sys
a = sys.argv[1:]
nodes = [{"number": int(a[i]), "title": a[i + 1], "state": "OPEN", "stateReason": None, "labels": {"nodes": []}} for i in range(0, len(a), 2)]
print(json.dumps({"data": {"repository": {"issues": {"pageInfo": {"hasNextPage": False, "endCursor": None}, "nodes": nodes}}}}))
PY
}
printf '[tracker]\nkind = "github"\n' > "$tmp/config.toml"
tf() { PATH="$tmp/bin:$PATH" TOOL_FAULTS_STUB="$S" POSTMASTER_CONFIG="$tmp/config.toml" "$T/scripts/tool-faults.sh" "$@"; }
logf() { "$T/scripts/log-action.sh" "$@" >/dev/null 2>&1 || echo "self-test: could not log $*" >&2; }
writes() { grep -c "^$1 " "$S/writes.log" 2>/dev/null || true; }
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/         /'; fails=$((fails+1)); }

# The target, made up. NG holds the words of a sentence of its ticket out of order, so that no
# run of four of them, in the order the ticket has them, is in this file.
rand() { python3 -c 'import secrets, string, sys; print("".join(secrets.choice(string.ascii_lowercase) for _ in range(int(sys.argv[1]))))' "$1"; }
NAME="zq$(rand 6)"; OWNER="yq$(rand 6)"; WORD="xq$(rand 6)"; IDENT="vq$(rand 5)Totals"
UUID=$(python3 -c 'import uuid; print(uuid.uuid4())'); HOMEP="/home/wq$(rand 5)/code/$NAME/$UUID"
NG=(column harness before board lane every merge)
SENTENCE="${NG[6]} ${NG[5]} ${NG[4]} ${NG[3]} ${NG[2]} the ${NG[1]} ${NG[0]}"
TICKET="${NAME^^}-12"
REPO="$tmp/home/$NAME"; mkdir -p "$REPO" && git -C "$REPO" init -q && git -C "$REPO" remote add origin "https://github.com/$OWNER/$NAME.git" || exit 1
PLANTED=("$NAME" "$OWNER" "$WORD" "$IDENT" "$HOMEP" "$REPO" "$TICKET" "$SENTENCE" "${NG[6]} ${NG[5]} ${NG[4]} ${NG[3]}" "${UUID%%-*}" "${UUID##*-}")

newrun() {  # newrun <ticket> <stage>: a run directory with its waybill, manifest and run.json
  local d="$RUNS/$NAME/$1"
  mkdir -p "$d"
  printf '# Waybill: %s\n\n## Ticket\nThe %s ledger for %s: %s.\n\n## Project profile\nrepo: %s          default branch: main       BASE: 0123abc\n' \
    "$1" "$WORD" "$NAME" "$SENTENCE" "$REPO" > "$d/brief.md"
  printf '{"stage": "%s", "leg": 3, "base": "0123abc", "lanes": {}, "coachman": {"legs": {}}}\n' "$2" > "$d/manifest.json"
  printf '{"postmaster": {"commit": "89abcdef0123456789abcdef0123456789abcdef", "uncommitted_changes": false}}\n' > "$d/run.json"
  printf '%s\n' "$d"
}
d=$(newrun "$TICKET" done)
logf "$d" postmaster dispatch "$TICKET" "leg 1"
logf "$d" coachman tool-fault scripts/wait-for-markers.sh --ran "scripts/wait-for-markers.sh $REPO/logs 'r1-*.done' 3 2400" \
  --failed "returned before 1 of 3 markers were in $HOMEP/logs" --error "exit 0; $NAME has 1 marker" \
  --diagnosis "\`$IDENT\` wrote its marker early" --fix "count only regular files, with find -type f"
logf "$d" coachman escalate "$TICKET" "the wait is a control"
logf "$d" coachman tool-fault "$T/scripts/wait-for-markers.sh" --ran "the same wait, round 2" \
  --failed "Returned before 2 of 3 markers were in /elsewhere/logs." --error none --diagnosis same --fix "count only regular files, with find -type f"
logf "$d" coachman tool-fault scripts/wait-for-markers.sh --ran "the same wait, round 3" \
  --failed "returned before 1 of 3 markers were in $HOMEP/logs" --error none --diagnosis same --fix "count only regular files"
logf "$d" coachman tool-fault skills/postmaster/harnesses.md --ran "resume of $TICKET's leg 2" \
  --failed "the resume form hung while the $WORD ledger was open, reading src/$WORD/billing.ts in $NAME, after scripts/ticket-check.sh quoted: $SENTENCE" \
  --error "timeout after 600s in $HOMEP" --diagnosis "the prompt went to $OWNER/$NAME" \
  --fix "pass the prompt on stdin, as for \`$IDENT\` in $HOMEP/src; see https://github.com/$OWNER/$NAME" \
  --workaround "resumed by hand in the recorded form"
logf "$d" coachman tool-fault scripts/wait-for-markers.sh --ran "wait, round 4" \
  --failed "counted a directory named like a marker" --error none --diagnosis "find has no -type" --fix "add -type f to the find"
logf "$d" coachman ticket-comment "$TICKET" "ready to merge"
logf "$d" postmaster note "$TICKET" "tool fault is a phrase, not a fault"

drafts() { cat "$d"/tool-faults/*.title "$d"/tool-faults/*.md 2>/dev/null; }
leaks() {  # leaks <text>: the planted pieces of the target it holds, one per line
  local p; for p in "${PLANTED[@]}"; do printf '%s\n' "$1" | grep -qiF -- "$p" && printf '%s\n' "$p"; done
}
fault_line() { printf '%s\n' "$out" | grep -E "^tf-[0-9a-f]{8}  $1  " | head -1; }
id_of() { fault_line "$1" | cut -c1-11; }

poll() { "$T/scripts/runs-status.sh" "$RUNS/$NAME" | awk -v r="$1" '$1 == r { print $NF }'; }

echo "positive controls"
[ "$(poll "$TICKET")" = FAULTS ] && ok "the poll says FAULTS for a closed run whose faults are not harvested" \
  || fail "the poll says FAULTS for a closed run whose faults are not harvested" "$("$T/scripts/runs-status.sh" "$RUNS/$NAME")"
access ADMIN; issues
out=$(tf harvest "$d" 2>&1); rc=$?
A=$(printf '%s\n' "$out" | grep -E '^tf-[0-9a-f]{8}  scripts/wait-for-markers.sh  control \(wait\)  3 times' | cut -c1-11)
B=$(id_of skills/postmaster/harnesses.md)
C=$(printf '%s\n' "$out" | grep -E '^tf-[0-9a-f]{8}  scripts/wait-for-markers.sh  control \(wait\)  once' | cut -c1-11)
[ $rc -eq 0 ] && [ "$(printf '%s\n' "$out" | grep -cE '^tf-[0-9a-f]{8}  ')" -eq 3 ] && [ -n "$A" ] && [ -n "$B" ] && [ -n "$C" ] \
  && ok "five planted faults, three of them one fault seen three ways, are three entries" \
  || fail "five planted faults, three of them one fault seen three ways, are three entries (exit $rc)" "$out"
printf '%s\n' "$out" | grep -qE "^$A .* new$" && printf '%s\n' "$out" | grep -qE "^$B .* new$" \
  && ok "with no ticket for them on postmaster's tracker, they are new" || fail "with no ticket for them on postmaster's tracker, they are new" "$out"
[ -f "$d/.tool-faults-ready" ] && ok "a fault waiting on the postmaster leaves the marker" || fail "a fault waiting on the postmaster leaves the marker"
printf '%s\n' "$out" | grep -qxF "  $C: a fault in a control, and the run's log has no escalation after it" \
  && ! printf '%s\n' "$out" | grep -qF "  $A: a fault in a control, and" \
  && ok "a fault in a control with no escalation after it is named; one escalated is not" \
  || fail "a fault in a control with no escalation after it is named; one escalated is not" "$out"
shape=0
for f in "$d"/tool-faults/tf-*.md; do
  "$T/scripts/ticket-check.sh" --body "$f" --title "$(cat "${f%.md}.title")" >/dev/null 2>&1 || shape=$((shape+1))
done
[ "$shape" -eq 0 ] && [ "$(grep -lx '## Turnpikes' "$d"/tool-faults/tf-*.md | wc -l | tr -d ' ')" -eq 3 ] \
  && ok "each draft is in the ticket shape, with its turnpikes, and passes scripts/ticket-check.sh" \
  || fail "each draft is in the ticket shape, with its turnpikes, and passes scripts/ticket-check.sh ($shape fail)" "$(drafts)"
grep -qF 'It was seen 3 times in run' "$d/tool-faults/$A.md" && grep -qF 'which ran postmaster 89abcdef0123' "$d/tool-faults/$A.md" \
  && ok "a draft names the run by its public id, and the postmaster it ran" || fail "a draft names the run by its public id, and the postmaster it ran" "$(cat "$d/tool-faults/$A.md")"
marked() { local m; for m in path project code link withheld "ticket text"; do grep -qF "[$m]" "$1" || return 1; done; }
grep -qF 'skills/postmaster/harnesses.md' "$d/tool-faults/$B.title" && grep -qF 'pass the prompt on stdin' "$d/tool-faults/$B.md" \
  && marked "$d/tool-faults/$B.md" \
  && ok "postmaster's own file and words are kept, and what is withheld is marked" || fail "postmaster's own file and words are kept, and what is withheld is marked" "$(cat "$d/tool-faults/$B.title" "$d/tool-faults/$B.md")"
issues 57 "Tool fault in scripts/wait-for-markers.sh: returned before the markers were in [$A]"
out=$(tf harvest "$d" 2>&1)
printf '%s\n' "$out" | grep -qE "^$A .* known #57, todo$" && printf '%s\n' "$out" | grep -qE "^$C .* new, like #57$" \
  && ok "a fault whose id a ticket's title carries is known; another on the same file is new, like it" || fail "a fault whose id a ticket's title carries is known; another on the same file is new, like it" "$out"
: > "$S/writes.log"
out=$(tf comment "$d" "$A" 2>&1); rc=$?
c=$(grep '^comment #57 ' "$S/writes.log")
[ $rc -eq 0 ] && [ "$(writes comment)" -eq 1 ] && printf '%s\n' "$c" | grep -qF "tool fault $A seen again: 3 times in run " \
  && grep -qF "\"target\":\"#57\",\"detail\":\"tool fault $A seen again" "$d/actions.jsonl" \
  && ok "comment says once, on the known ticket, that it was seen again, and logs it" || fail "comment says once, on the known ticket, that it was seen again, and logs it (exit $rc)" "$out$(printf '\n'; cat "$S/writes.log")"
out=$(tf file "$d" "$B" 2>&1); rc=$?
[ $rc -eq 0 ] && [ "$(writes create)" -eq 1 ] && cmp -s "$S/created-60.md" "$d/tool-faults/$B.md" && printf '%s\n' "$out" | grep -qF "filed as #60" \
  && grep -qF "\"target\":\"#60\",\"detail\":\"tool fault $B filed" "$d/actions.jsonl" \
  && ok "file files the draft as it is, once, and logs the new ticket" || fail "file files the draft as it is, once, and logs the new ticket (exit $rc)" "$out$(printf '\n'; cat "$S/writes.log")"
out=$(tf comment "$d" "$C" "#57" 2>&1); rc=$?
[ $rc -eq 0 ] && [ "$(writes comment)" -eq 2 ] && tail -1 "$S/writes.log" | grep -qF "comment #57 " && tail -1 "$S/writes.log" | grep -qF "tool fault $C seen again: once in run " \
  && ok "on the user's word that a new fault is a ticket's, comment names it there" || fail "on the user's word that a new fault is a ticket's, comment names it there (exit $rc)" "$out$(printf '\n'; cat "$S/writes.log")"
[ ! -e "$d/.tool-faults-ready" ] && [ "$(poll "$TICKET")" = - ] && ok "once every fault is dealt with, the marker goes and the poll says -" \
  || fail "once every fault is dealt with, the marker goes and the poll says -" "$("$T/scripts/runs-status.sh" "$RUNS/$NAME")"
out=$(tf harvest "$d" 2>&1)
printf '%s\n' "$out" | grep -qE "^$A .* commented #57$" && printf '%s\n' "$out" | grep -qE "^$B .* filed #60$" && printf '%s\n' "$out" | grep -qE "^$C .* commented #57$" \
  && ok "a later harvest reads what was done from the run's own records" || fail "a later harvest reads what was done from the run's own records" "$out"
again=$(newrun "${NAME^^}-16" done)
logf "$again" coachman tool-fault scripts/wait-for-markers.sh --ran "wait" --failed "counted a directory named like a marker" \
  --error none --diagnosis "find has no -type" --fix "add -type f to the find"
out=$(tf harvest "$again" 2>&1)
printf '%s\n' "$out" | grep -qE "^$C .* known #57, todo$" && ok "in a later run, a fault that a comment names on a ticket is known there" \
  || fail "in a later run, a fault that a comment names on a ticket is known there" "$out"

echo "negative controls"
l=$(leaks "$(drafts; cat "$S/writes.log" "$S"/created-*.md)")
[ -z "$l" ] && ok "no planted name, owner, path, identifier or ticket text reaches a draft, a ticket or a comment" \
  || fail "no planted name, owner, path, identifier or ticket text reaches a draft, a ticket or a comment" "$l"
: > "$S/writes.log"
tf comment "$d" "$A" >/dev/null 2>&1; tf file "$d" "$B" >/dev/null 2>&1
[ "$(writes comment)" -eq 0 ] && [ "$(writes create)" -eq 0 ] && ok "a second comment or file does nothing" || fail "a second comment or file does nothing" "$(cat "$S/writes.log")"
clean=$(newrun "${NAME^^}-13" done)
logf "$clean" coachman note "$TICKET" "nothing went wrong"
out=$(tf harvest "$clean" 2>&1); rc=$?
[ $rc -eq 0 ] && [ "$out" = "$(printf 'run %s: no tool faults' "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["run_id"])' "$clean/tool-faults.json")")" ] \
  && [ ! -e "$clean/tool-faults" ] && [ ! -e "$clean/.tool-faults-ready" ] && [ ! -s "$S/writes.log" ] \
  && ok "a clean log yields no fault, no draft and no marker" || fail "a clean log yields no fault, no draft and no marker (exit $rc)" "$out"
open=$(newrun "${NAME^^}-14" review-bug)
logf "$open" coachman tool-fault scripts/launch.sh --ran x --failed y --error none --diagnosis z --fix w
out=$(tf harvest "$open" 2>&1); rc=$?
[ $rc -eq 1 ] && printf '%s\n' "$out" | grep -qF "still open" && [ ! -e "$open/tool-faults.json" ] \
  && ok "a run still open is not harvested" || fail "a run still open is not harvested (exit $rc)" "$out"
mine=$(newrun "${NAME^^}-15" abandoned)
logf "$mine" coachman tool-fault scripts/launch.sh --ran "launch" --failed "the stream flag was refused" --error none --diagnosis "renamed" --fix "use the new flag"
issues; access READ
out=$(tf harvest "$mine" 2>&1); rc=$?
F=$(id_of scripts/launch.sh)
[ $rc -eq 0 ] && printf '%s\n' "$out" | grep -qF "the user does not own postmaster's repository" && printf '%s\n' "$out" | grep -qE "^$F .* kept$" \
  && [ ! -e "$mine/.tool-faults-ready" ] && ok "a repository the user does not own is no tracker: the faults are kept" \
  || fail "a repository the user does not own is no tracker: the faults are kept (exit $rc)" "$out"
out=$(tf file "$mine" "$F" 2>&1); rc=$?
[ $rc -eq 1 ] && [ "$(writes create)" -eq 0 ] && ok "and nothing is filed there" || fail "and nothing is filed there (exit $rc)" "$out"
access ADMIN; printf '[tracker]\nkind = "other"\nname = "notes"\n' > "$tmp/config.toml"
out=$(tf harvest "$mine" 2>&1)
printf '%s\n' "$out" | grep -qF "the other tracker has no adapter script" && ok "a tracker with no adapter script keeps them too" || fail "a tracker with no adapter script keeps them too" "$out"
printf '[tracker]\nkind = "github"\n' > "$tmp/config.toml"
tf harvest "$mine" >/dev/null 2>&1
printf '%s\n' "\`$IDENT\` is the one to fix" >> "$mine/tool-faults/$F.md"
out=$(tf file "$mine" "$F" 2>&1); rc=$?
[ $rc -eq 2 ] && [ "$(writes create)" -eq 0 ] && printf '%s\n' "$out" | grep -qF "not safe to publish" \
  && ok "file refuses a draft changed to carry the target's code" || fail "file refuses a draft changed to carry the target's code (exit $rc)" "$out"
out=$(tf decline "$mine" "$F" "the user: not worth a ticket" 2>&1); rc=$?
[ $rc -eq 0 ] && [ ! -e "$mine/.tool-faults-ready" ] && [ "$(writes create)" -eq 0 ] \
  && grep -qF "\"target\":\"$F\",\"detail\":\"tool fault $F declined by the user: the user: not worth a ticket\"" "$mine/actions.jsonl" \
  && ok "decline records the user's no, and files nothing" || fail "decline records the user's no, and files nothing (exit $rc)" "$out"

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
