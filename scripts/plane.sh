#!/usr/bin/env bash
# Plane work items as tickets, through Plane's REST API. One Plane project per target repo,
# matched by the project identifier that prefixes every work item id (PM-12): the same prefix
# scripts/discover-project.sh reads off the target's commit messages, so a project that has
# shipped one ticket needs nothing configured.
#
#   plane.sh projects                             identifier, id and name of every project
#   plane.sh create <IDENT> <title> <body-file>   new work item in the todo state; prints its id
#   plane.sh read <IDENT-n>                       title, state, labels, body, comments
#   plane.sh state <IDENT-n> <state>              todo | in-progress | blocked | done | cancelled
#   plane.sh comment <IDENT-n> <actor> <text>     one comment, dated to the minute, actor first
#   plane.sh list <IDENT> [state]                 one line per work item: id, state, title
#
# The instance and workspace come from [tracker] in ~/.postmaster/config.toml (url and
# workspace; POSTMASTER_CONFIG overrides the path). The key is PLANE_API_KEY in the
# environment, else in the file [tracker] env_file names (default ~/.postmaster/plane.env),
# loaded first. The key never enters the config or this repo.
#
# The flow's states map onto Plane's state groups: todo is the first state in the unstarted
# group (backlog if none), in-progress is started, done is completed, cancelled is cancelled.
# Plane has no blocked group, so blocked is a label named `blocked`, added without moving the
# state and removed by the next state change. Bodies are the three-heading ticket shape in
# markdown; the script renders them to the HTML Plane stores and back to text on read.
#
#   exit 0  ok
#   exit 1  usage, config or key missing, the API refused or was unreachable, unknown
#           project or id
#   exit 2  invalid state
set -uo pipefail
CONFIG=${POSTMASTER_CONFIG:-$HOME/.postmaster/config.toml}
die() { echo "plane: $*" >&2; exit 1; }
[ $# -ge 1 ] || die "usage: plane.sh projects|create|read|state|comment|list ..."
[ -f "$CONFIG" ] || die "no config at $CONFIG (POSTMASTER_CONFIG overrides the path)"
python3 -c 'import tomllib' 2>/dev/null || die "python3 with tomllib (3.11 or newer) is needed to read the config"

ENV_FILE=$(python3 -c '
import sys, tomllib
t = tomllib.load(open(sys.argv[1], "rb")).get("tracker", {})
print(t.get("env_file") or "~/.postmaster/plane.env")' "$CONFIG") || die "cannot read $CONFIG"
f=${ENV_FILE/#\~/$HOME}
if [ -z "${PLANE_API_KEY:-}" ] && [ -f "$f" ]; then set -a; . "$f"; set +a; fi
[ -n "${PLANE_API_KEY:-}" ] || die "no PLANE_API_KEY in the environment or in $f (skills/postmaster/trackers.md, plane)"

exec python3 - "$CONFIG" "$@" <<'PY'
import datetime, html, json, re, sys, tomllib, os
import urllib.error, urllib.parse, urllib.request
from html.parser import HTMLParser

STATES = ["todo", "in-progress", "blocked", "done", "cancelled"]
GROUPS_FOR = {"todo": ["unstarted", "backlog"], "in-progress": ["started"],
              "done": ["completed"], "cancelled": ["cancelled"]}
STATE_FOR_GROUP = {"backlog": "todo", "unstarted": "todo", "triage": "todo",
                   "started": "in-progress", "completed": "done", "cancelled": "cancelled"}
BLOCKED = "blocked"

def die(msg, code=1):
    print("plane: " + msg, file=sys.stderr); sys.exit(code)

cfg = tomllib.load(open(sys.argv[1], "rb")).get("tracker", {})
BASE = str(cfg.get("url", "")).rstrip("/"); WS = str(cfg.get("workspace", ""))
if not BASE or not WS:
    die("[tracker] url and workspace are needed in %s (skills/postmaster/trackers.md, plane)" % sys.argv[1])
KEY = os.environ["PLANE_API_KEY"]
args = sys.argv[2:]
cmd = args[0]

def api(method, path, body=None, params=None):
    url = "%s/api/v1/%s" % (BASE, path)
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "X-Api-Key": KEY, "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        die("%s %s: HTTP %d %s" % (method, path, e.code, e.read().decode(errors="replace")[:300]))
    except urllib.error.URLError as e:
        die("%s %s: %s" % (method, path, e.reason))

def pages(path, params=None):
    params = dict(params or {}); params["per_page"] = 100
    while True:
        page = api("GET", path, params=params)
        yield from page.get("results", [])
        if not page.get("next_page_results"):
            return
        params["cursor"] = page["next_cursor"]

def usage(text):
    die("usage: plane.sh " + text)

def parse_id(tid):
    m = re.fullmatch(r"([A-Za-z][A-Za-z0-9]*)-(\d+)", tid)
    if not m:
        die("not a work item id: %s (expected IDENT-n)" % tid)
    return m.group(1).upper(), int(m.group(2))

def project_for(ident):
    ident = ident.upper()
    for p in pages("workspaces/%s/projects/" % WS):
        if str(p.get("identifier", "")).upper() == ident:
            return p
    die("no project with identifier %s in workspace %s" % (ident, WS))

def states_of(pid):
    return list(pages("workspaces/%s/projects/%s/states/" % (WS, pid)))

def labels_of(pid):
    return list(pages("workspaces/%s/projects/%s/labels/" % (WS, pid)))

def state_id_for(states, flow_state):
    for group in GROUPS_FOR[flow_state]:
        found = sorted((s for s in states if s.get("group") == group), key=lambda s: s.get("sequence", 0))
        if found:
            return found[0]["id"]
    die("project has no state in group %s for %s" % (" or ".join(GROUPS_FOR[flow_state]), flow_state))

def ref(x):  # a related object arrives as an id or, when expanded, as an object with one
    return x["id"] if isinstance(x, dict) else x

def flow_state(item, states, labels):
    label_names = {l["id"]: l["name"] for l in labels}
    if any(label_names.get(ref(l), "").lower() == BLOCKED for l in item.get("labels") or []):
        return "blocked"
    group = next((s.get("group") for s in states if s["id"] == ref(item.get("state"))), None)
    return STATE_FOR_GROUP.get(group, group or "unknown")

def item_for(tid):
    ident, n = parse_id(tid)
    item = api("GET", "workspaces/%s/work-items/%s-%d/" % (WS, ident, n))
    return ident, item

# --- markdown <-> html, enough for the three-heading ticket shape --------------------------

def inline(text):
    text = html.escape(text, quote=False)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2">\1</a>', text)
    return text

def md_to_html(md):
    out, para, lst, fence = [], [], None, None
    def flush_para():
        if para:
            out.append("<p>%s</p>" % inline(" ".join(para))); para.clear()
    def flush_list():
        nonlocal lst
        if lst:
            out.append("</%s>" % lst); lst = None
    for line in md.splitlines():
        if fence is not None:
            if line.strip().startswith("```"):
                out.append("<pre><code>%s</code></pre>" % html.escape("\n".join(fence), quote=False)); fence = None
            else:
                fence.append(line)
            continue
        if line.strip().startswith("```"):
            flush_para(); flush_list(); fence = []; continue
        m = re.match(r"(#{1,6})\s+(.*)", line)
        if m:
            flush_para(); flush_list()
            out.append("<h%d>%s</h%d>" % (len(m.group(1)), inline(m.group(2)), len(m.group(1)))); continue
        m = re.match(r"\s*(\d+)[.)]\s+(.*)", line) or re.match(r"\s*([-*])\s+(.*)", line)
        if m:
            flush_para()
            kind = "ol" if m.group(1).isdigit() else "ul"
            if lst != kind:
                flush_list(); out.append("<%s>" % kind); lst = kind
            out.append("<li>%s</li>" % inline(m.group(2))); continue
        if not line.strip():
            flush_para(); flush_list(); continue
        if lst and line.startswith("  "):
            out[-1] = out[-1][:-5] + " " + inline(line.strip()) + "</li>"; continue
        flush_list(); para.append(line.strip())
    flush_para(); flush_list()
    return "\n".join(out)

class ToText(HTMLParser):
    def __init__(self):
        super().__init__(); self.out = []; self.lists = []; self.pre = False; self.href = None
    def handle_starttag(self, tag, attrs):
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.out.append("\n" + "#" * int(tag[1]) + " ")
        elif tag in ("ol", "ul"):
            self.lists.append([tag, 0]); self.out.append("\n")
        elif tag == "li":
            if self.lists:
                self.lists[-1][1] += 1
                self.out.append("%d. " % self.lists[-1][1] if self.lists[-1][0] == "ol" else "- ")
            else:
                self.out.append("- ")
        elif tag == "br":
            self.out.append("\n")
        elif tag == "pre":
            self.pre = True; self.out.append("\n```\n")
        elif tag == "code" and not self.pre:
            self.out.append("`")
        elif tag == "strong" or tag == "b":
            self.out.append("**")
        elif tag == "a":
            self.href = dict(attrs).get("href"); self.out.append("[" if self.href else "")
        elif tag == "p":
            self.out.append("\n")
    def handle_endtag(self, tag):
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6", "p", "li"):
            self.out.append("\n")
        elif tag in ("ol", "ul"):
            if self.lists: self.lists.pop()
        elif tag == "pre":
            self.pre = False
            if self.out and not self.out[-1].endswith("\n"): self.out.append("\n")
            self.out.append("```\n")
        elif tag == "code" and not self.pre:
            self.out.append("`")
        elif tag == "strong" or tag == "b":
            self.out.append("**")
        elif tag == "a" and self.href:
            self.out.append("](%s)" % self.href); self.href = None
    def handle_data(self, data):
        if self.pre:
            self.out.append(data)
        elif data.strip():
            self.out.append(re.sub(r"\s+", " ", data))

def html_to_text(h):
    p = ToText(); p.feed(h or ""); p.close()
    text = "\n".join(line.rstrip() for line in "".join(p.out).splitlines())
    return re.sub(r"\n{3,}", "\n\n", text).strip()

# --- commands ------------------------------------------------------------------------------

if cmd == "projects":
    for p in pages("workspaces/%s/projects/" % WS):
        print("%s\t%s\t%s" % (p.get("identifier", ""), p["id"], p.get("name", "")))

elif cmd == "create":
    if len(args) != 4: usage("create <IDENT> <title> <body-file>")
    ident, title, body_file = args[1], args[2], args[3]
    try:
        body = open(body_file, encoding="utf-8").read()
    except OSError as e:
        die("cannot read body file: %s" % e)
    proj = project_for(ident)
    todo = state_id_for(states_of(proj["id"]), "todo")
    made = api("POST", "workspaces/%s/projects/%s/work-items/" % (WS, proj["id"]),
               {"name": title, "description_html": md_to_html(body), "state": todo})
    print("%s-%s" % (proj["identifier"], made["sequence_id"]))

elif cmd == "read":
    if len(args) != 2: usage("read <IDENT-n>")
    ident, item = item_for(args[1])
    pid = ref(item["project"])
    states, labels = states_of(pid), labels_of(pid)
    names = {l["id"]: l["name"] for l in labels}
    print("id: %s-%s" % (ident, item["sequence_id"]))
    print("title: %s" % item.get("name", ""))
    print("state: %s" % flow_state(item, states, labels))
    print("labels: %s" % ", ".join(names.get(ref(l), "?") for l in item.get("labels") or []))
    print("created: %s" % str(item.get("created_at", ""))[:10])
    print()
    print(html_to_text(item.get("description_html")))
    comments = list(pages("workspaces/%s/projects/%s/work-items/%s/comments/" % (WS, pid, item["id"])))
    if comments:
        print("\n## Log")
        for c in sorted(comments, key=lambda c: c.get("created_at", "")):
            print("- " + html_to_text(c.get("comment_html")).replace("\n", " "))

elif cmd == "state":
    if len(args) != 3: usage("state <IDENT-n> <state>")
    ident, item = item_for(args[1]); new = args[2]
    if new not in STATES:
        die("invalid state %s (one of: %s)" % (new, ", ".join(STATES)), 2)
    pid = ref(item["project"])
    labels = labels_of(pid)
    current = [ref(l) for l in item.get("labels") or []]
    blocked_ids = [l["id"] for l in labels if l["name"].lower() == BLOCKED]
    if new == "blocked":
        if not blocked_ids:
            blocked_ids = [api("POST", "workspaces/%s/projects/%s/labels/" % (WS, pid), {"name": BLOCKED})["id"]]
        patch = {"labels": sorted(set(current) | {blocked_ids[0]})}
    else:
        patch = {"state": state_id_for(states_of(pid), new)}
        if set(current) & set(blocked_ids):
            patch["labels"] = [l for l in current if l not in blocked_ids]
    api("PATCH", "workspaces/%s/projects/%s/work-items/%s/" % (WS, pid, item["id"]), patch)
    print("%s-%s: %s" % (ident, item["sequence_id"], new))

elif cmd == "comment":
    if len(args) < 4: usage("comment <IDENT-n> <actor> <text>")
    ident, item = item_for(args[1]); actor = args[2]; text = " ".join(args[3:])
    stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    line = "%s %s: %s" % (stamp, actor, text)
    api("POST", "workspaces/%s/projects/%s/work-items/%s/comments/" % (WS, ref(item["project"]), item["id"]),
        {"comment_html": "<p>%s</p>" % html.escape(line, quote=False)})
    print("%s-%s: %s" % (ident, item["sequence_id"], line))

elif cmd == "list":
    if len(args) not in (2, 3): usage("list <IDENT> [state]")
    want = args[2] if len(args) == 3 else None
    if want and want not in STATES:
        die("invalid state %s (one of: %s)" % (want, ", ".join(STATES)), 2)
    proj = project_for(args[1])
    states, labels = states_of(proj["id"]), labels_of(proj["id"])
    items = list(pages("workspaces/%s/projects/%s/work-items/" % (WS, proj["id"])))
    for it in sorted(items, key=lambda i: i.get("sequence_id", 0)):
        st = flow_state(it, states, labels)
        if want is None or st == want:
            print("%s-%s\t%s\t%s" % (proj["identifier"], it["sequence_id"], st, it.get("name", "")))

else:
    usage("projects|create|read|state|comment|list ...")
PY
