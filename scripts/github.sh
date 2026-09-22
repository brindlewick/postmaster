#!/usr/bin/env bash
# GitHub Issues as tickets, on a GitHub Projects board as the kanban. One board per target
# repo, linked to it and found through that link, so nothing is configured: the board's Status
# column, which every new board has as Todo, In Progress and Done, carries the flow's state,
# and closing an issue is done. GitHub has no blocked column by default, so blocked is a label
# named `blocked`, added without moving the card and removed by the next state change.
#
#   github.sh <repo> board                         the linked board; exit 3 when there is none
#   github.sh <repo> board init [title]            create a board named after the repo and
#                                                  link it; idempotent
#   github.sh <repo> create <title> <body-file>    new issue on the board in Todo; prints its number
#   github.sh <repo> read <n>                      title, state, labels, body, comments
#   github.sh <repo> state <n> <state>             todo | in-progress | blocked | done | cancelled
#   github.sh <repo> comment <n> <actor> <text>    one comment, dated to the minute, actor first
#   github.sh <repo> list [state]                  one line per issue: number, state, title
#
# <repo> is a local checkout; the GitHub repository is read from its origin remote. Everything
# goes through the gh CLI, which must be logged in with the `project` scope
# (`gh auth refresh -s project`); scripts/probe-trackers.sh says whether it is.
#
#   exit 0  ok
#   exit 1  usage, gh missing or not logged in, no origin remote, unknown issue, or gh failed
#   exit 2  invalid state
#   exit 3  the repo has no linked board (run: github.sh <repo> board init)
set -uo pipefail
die() { echo "github: $*" >&2; exit 1; }
REPO=${1:?usage: github.sh <repo> board|create|read|state|comment|list ...}
[ $# -ge 2 ] || die "usage: github.sh <repo> board|create|read|state|comment|list ..."
[ -d "$REPO" ] || die "no such directory: $REPO"
command -v gh >/dev/null 2>&1 || die "gh is not on PATH"
gh auth status >/dev/null 2>&1 || die "gh is not logged in; the operator runs: gh auth login"
REMOTE=$(git -C "$REPO" remote get-url origin 2>/dev/null) || die "$REPO has no origin remote"

exec python3 - "$REMOTE" "${@:2}" <<'PY'
import datetime, json, re, subprocess, sys

STATES = ["todo", "in-progress", "blocked", "done", "cancelled"]
COLUMN = {"todo": "todo", "in-progress": "inprogress", "done": "done", "cancelled": "done"}
BLOCKED = "blocked"

def die(msg, code=1):
    print("github: " + msg, file=sys.stderr); sys.exit(code)

m = re.search(r"github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?/?$", sys.argv[1])
if not m:
    die("origin is not a GitHub remote: " + sys.argv[1])
OWNER, NAME = m.group(1), m.group(2)
NWO = "%s/%s" % (OWNER, NAME)
args = sys.argv[2:]
cmd = args[0]

def gh(*argv, ok=(0,)):
    r = subprocess.run(["gh", *argv], capture_output=True, text=True)
    if r.returncode not in ok:
        die("gh %s: %s" % (" ".join(argv[:3]), (r.stderr or r.stdout).strip()[:300]))
    return r.stdout

def ghj(*argv):
    out = gh(*argv)
    try:
        return json.loads(out)
    except ValueError:
        die("gh %s returned no JSON" % " ".join(argv[:3]))

# --- the board ---------------------------------------------------------------------------

def linked_boards():
    q = ("query($owner:String!,$name:String!){repository(owner:$owner,name:$name){"
         "projectsV2(first:20){nodes{id number title closed url "
         "owner{... on User{login} ... on Organization{login}}}}}}")
    data = ghj("api", "graphql", "-f", "query=" + q, "-F", "owner=" + OWNER, "-F", "name=" + NAME)
    nodes = data.get("data", {}).get("repository", {}).get("projectsV2", {}).get("nodes", []) or []
    return [n for n in nodes if not n.get("closed")]

def board():
    boards = linked_boards()
    if not boards:
        die("%s has no linked board; run: github.sh <repo> board init" % NWO, 3)
    named = [b for b in boards if b.get("title") == NAME]
    b = named[0] if len(boards) > 1 and named else boards[0]
    b["ownerLogin"] = (b.get("owner") or {}).get("login") or OWNER
    return b

def board_init(title):
    boards = linked_boards()
    if boards:
        b = boards[0]; print("board exists: #%s %s %s" % (b["number"], b["title"], b["url"])); return
    made = ghj("project", "create", "--owner", OWNER, "--title", title, "--format", "json")
    gh("project", "link", str(made["number"]), "--owner", OWNER, "--repo", NWO)
    print("board created: #%s %s %s" % (made["number"], title, made.get("url", "")))

def status_field(b):
    fields = ghj("project", "field-list", str(b["number"]), "--owner", b["ownerLogin"], "--format", "json")
    for f in fields.get("fields", []):
        if f.get("name", "").lower() == "status" and f.get("options") is not None:
            opts = {re.sub(r"\W", "", o["name"]).lower(): o["id"] for o in f["options"]}
            return f["id"], opts
    die("board #%s has no Status field" % b["number"])

def item_id(b, number, url):
    items = ghj("project", "item-list", str(b["number"]), "--owner", b["ownerLogin"], "--format", "json", "--limit", "1000")
    for it in items.get("items", []):
        c = it.get("content") or {}
        if c.get("type") == "Issue" and c.get("number") == number and c.get("repository") == NWO:
            return it["id"], it.get("status")
    added = ghj("project", "item-add", str(b["number"]), "--owner", b["ownerLogin"], "--url", url, "--format", "json")
    return added["id"], None

def set_column(b, number, url, flow):
    field, opts = status_field(b)
    key = COLUMN[flow]
    if key not in opts:
        die("board #%s has no Status column for %s (its columns: %s)" % (b["number"], flow, ", ".join(opts)))
    iid, _ = item_id(b, number, url)
    gh("project", "item-edit", "--project-id", b["id"], "--id", iid, "--field-id", field,
       "--single-select-option-id", opts[key])

def board_statuses(b):
    items = ghj("project", "item-list", str(b["number"]), "--owner", b["ownerLogin"], "--format", "json", "--limit", "1000")
    out = {}
    for it in items.get("items", []):
        c = it.get("content") or {}
        if c.get("type") == "Issue" and c.get("repository") == NWO:
            out[c.get("number")] = it.get("status") or ""
    return out

# --- issues ------------------------------------------------------------------------------

def issue(number):
    return ghj("issue", "view", str(number), "-R", NWO, "--json",
               "number,title,body,state,stateReason,labels,comments,url,createdAt")

def flow_state(iss, status):
    if iss.get("state") == "CLOSED":
        return "cancelled" if iss.get("stateReason") == "NOT_PLANNED" else "done"
    if any(l.get("name", "").lower() == BLOCKED for l in iss.get("labels") or []):
        return "blocked"
    return "in-progress" if re.sub(r"\W", "", status or "").lower() == "inprogress" else "todo"

def ensure_label():
    names = {l["name"].lower() for l in ghj("label", "list", "-R", NWO, "--json", "name", "--limit", "200")}
    if BLOCKED not in names:
        gh("label", "create", BLOCKED, "-R", NWO, "--color", "B60205", "--description", "Waiting on something outside the run")

def set_label(number, present):
    if present:
        ensure_label(); gh("issue", "edit", str(number), "-R", NWO, "--add-label", BLOCKED)
    else:
        gh("issue", "edit", str(number), "-R", NWO, "--remove-label", BLOCKED)

def usage(text):
    die("usage: github.sh <repo> " + text)

def number_arg(s):
    if not re.fullmatch(r"#?\d+", s):
        die("not an issue number: " + s)
    return int(s.lstrip("#"))

if cmd == "board":
    if len(args) == 1:
        b = board(); print("#%s\t%s\t%s" % (b["number"], b["title"], b["url"]))
    elif args[1] == "init" and len(args) in (2, 3):
        board_init(args[2] if len(args) == 3 else NAME)
    else:
        usage("board [init [title]]")

elif cmd == "create":
    if len(args) != 3: usage("create <title> <body-file>")
    b = board()
    url = gh("issue", "create", "-R", NWO, "--title", args[1], "--body-file", args[2]).strip().splitlines()[-1]
    number = int(url.rstrip("/").rsplit("/", 1)[-1])
    set_column(b, number, url, "todo")
    print(number)

elif cmd == "read":
    if len(args) != 2: usage("read <n>")
    n = number_arg(args[1]); iss = issue(n)
    statuses = board_statuses(board())
    print("id: #%d" % n)
    print("title: %s" % iss.get("title", ""))
    print("state: %s" % flow_state(iss, statuses.get(n)))
    print("labels: %s" % ", ".join(l["name"] for l in iss.get("labels") or []))
    print("created: %s" % str(iss.get("createdAt", ""))[:10])
    print("url: %s" % iss.get("url", ""))
    print()
    print((iss.get("body") or "").strip())
    comments = iss.get("comments") or []
    if comments:
        print("\n## Log")
        for c in sorted(comments, key=lambda c: c.get("createdAt", "")):
            text = " ".join((c.get("body") or "").split())
            if not re.match(r"\d{4}-\d{2}-\d{2} ", text):
                text = "%s %s: %s" % (str(c.get("createdAt", ""))[:10], (c.get("author") or {}).get("login", "?"), text)
            print("- " + text)

elif cmd == "state":
    if len(args) != 3: usage("state <n> <state>")
    n = number_arg(args[1]); new = args[2]
    if new not in STATES:
        die("invalid state %s (one of: %s)" % (new, ", ".join(STATES)), 2)
    b = board(); iss = issue(n)
    blocked_now = any(l.get("name", "").lower() == BLOCKED for l in iss.get("labels") or [])
    closed = iss.get("state") == "CLOSED"
    if new == "blocked":
        if closed: gh("issue", "reopen", str(n), "-R", NWO)
        if not blocked_now: set_label(n, True)
    else:
        if blocked_now: set_label(n, False)
        if new in ("todo", "in-progress") and closed:
            gh("issue", "reopen", str(n), "-R", NWO)
        elif new == "done" and not closed:
            gh("issue", "close", str(n), "-R", NWO, "--reason", "completed")
        elif new == "cancelled" and not (closed and iss.get("stateReason") == "NOT_PLANNED"):
            if closed: gh("issue", "reopen", str(n), "-R", NWO)
            gh("issue", "close", str(n), "-R", NWO, "--reason", "not planned")
        set_column(b, n, iss["url"], new)
    print("#%d: %s" % (n, new))

elif cmd == "comment":
    if len(args) < 4: usage("comment <n> <actor> <text>")
    n = number_arg(args[1]); actor = args[2]; text = " ".join(args[3:])
    line = "%s %s: %s" % (datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), actor, text)
    gh("issue", "comment", str(n), "-R", NWO, "--body", line)
    print("#%d: %s" % (n, line))

elif cmd == "list":
    if len(args) not in (1, 2): usage("list [state]")
    want = args[1] if len(args) == 2 else None
    if want and want not in STATES:
        die("invalid state %s (one of: %s)" % (want, ", ".join(STATES)), 2)
    statuses = board_statuses(board())
    issues = ghj("issue", "list", "-R", NWO, "--state", "all", "--limit", "500", "--json",
                 "number,title,state,stateReason,labels")
    for iss in sorted(issues, key=lambda i: i["number"]):
        st = flow_state(iss, statuses.get(iss["number"]))
        if want is None or st == want:
            print("#%d\t%s\t%s" % (iss["number"], st, iss.get("title", "")))

else:
    usage("board|create|read|state|comment|list ...")
PY
