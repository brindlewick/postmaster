#!/usr/bin/env bash
# Tickets kept in the target repository's own git directory, with no service and no login: no
# network, and nothing installed beyond the bash, git and python3 the other scripts use. The
# store is postmaster/tickets/ in the repository's common git directory (.git/postmaster/tickets/
# in a plain checkout): outside the working tree and every branch, one copy whatever branch or
# worktree is checked out, and removed with the repository. A ticket is two files there: <n>.md,
# its body exactly as written, and <n>.json, its title, state, labels, created time and log.
# Every write holds the store's lock and replaces a whole file, so a reader sees a file as it was
# before a write or after it, never in between.
#
#   local.sh <repo> store                          the store's path; exit 3 when there is none
#   local.sh <repo> store init                     make the store; idempotent
#   local.sh <repo> create <title> <body-file>     new ticket in todo; prints its number
#   local.sh <repo> read <n> [--body]              title, state, labels, body, log; with --body,
#                                                  only the body, exactly as stored
#   local.sh <repo> edit <n> <body-file> <base-file>
#                                                  replace the ticket's body; never its title
#   local.sh <repo> state <n> <state>              todo | in-progress | blocked | done | cancelled
#   local.sh <repo> comment <n> <actor> <text>     one log line, dated to the minute, actor first
#   local.sh <repo> list [state]                   one line per ticket: number, state, title;
#                                                  grouped by state, in the order above
#   local.sh --self-test                           every command against throwaway repos, offline
#
# <repo> is any checkout of the repository: the main one, a linked worktree or a directory in
# either. A repository whose store exists uses this tracker, whatever the config names; any other
# uses the config's kind (skills/postmaster/trackers.md, local).
#
# edit takes the body as it was read when the change was drafted (read --body) and refuses when
# the ticket no longer matches it, so a change made meanwhile is not lost.
#
#   exit 0  ok
#   exit 1  usage, git or python3 missing, not a git repository, unknown ticket, a title that is
#           empty or more than one line, a body file that cannot be read or is empty, or a store
#           that cannot be read or written
#   exit 2  invalid state
#   exit 3  the repository has no store (run: local.sh <repo> store init)
#   exit 4  the ticket changed since the base was read
set -uo pipefail
die() { echo "local: $*" >&2; exit 1; }
if [ "${1:-}" != --self-test ]; then
  [ $# -ge 2 ] || die "usage: local.sh <repo> store|create|edit|read|state|comment|list ... | --self-test"
  REPO=$1
  [ -d "$REPO" ] || die "no such directory: $REPO"
  command -v git >/dev/null 2>&1 || die "git is not on PATH"
  command -v python3 >/dev/null 2>&1 || die "python3 is not on PATH"
  # Every worktree of a repository shares its common git directory, so each finds the one store.
  COMMON=$(git -C "$REPO" rev-parse --git-common-dir 2>/dev/null) || die "not a git repository: $REPO"
  case $COMMON in /*) ;; *) COMMON=$REPO/$COMMON ;; esac
  COMMON=$(cd "$COMMON" 2>/dev/null && pwd -P) || die "cannot enter the git directory of $REPO"

  exec python3 - "$COMMON/postmaster/tickets" "${@:2}" <<'PY'
import contextlib, datetime, fcntl, json, os, re, signal, sys

signal.signal(signal.SIGPIPE, signal.SIG_DFL)  # a reader that stops early, such as head, ends us quietly
STATES = ["todo", "in-progress", "blocked", "done", "cancelled"]
STORE = sys.argv[1]
args = sys.argv[2:]
cmd = args[0]

def die(msg, code=1):
    print("local: " + msg, file=sys.stderr); sys.exit(code)

def usage(text):
    die("usage: local.sh <repo> " + text)

def number_arg(s):
    if not re.fullmatch(r"#?0*[1-9]\d*", s):
        die("not a ticket number: " + s)
    return int(s.lstrip("#"))

def state_arg(s):
    if s not in STATES:
        die("invalid state %s (one of: %s)" % (s, ", ".join(STATES)), 2)
    return s

def need_store():
    if not os.path.isdir(STORE):
        die("no ticket store at %s; with the user's word, run: local.sh <repo> store init" % STORE, 3)

def path(n, ext):
    return os.path.join(STORE, "%d.%s" % (n, ext))

def bytes_of(p, what):  # a file's bytes; exit 1 when it cannot be read
    try:
        with open(p, "rb") as f:
            return f.read()
    except OSError as e:
        die("cannot read %s %s: %s" % (what, p, e.strerror))

def text_of(data, p, what):
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        die("cannot read %s %s: it is not UTF-8" % (what, p))

def body_file(p):  # a body file's bytes; exit 1 when it cannot be read or holds nothing
    data = bytes_of(p, "body file")
    if not text_of(data, p, "body file").strip():
        die("the body file %s is empty" % p)
    return data

def normal(text):  # a body as edit compares it: line endings, trailing spaces and blank edges aside
    lines = [l.rstrip() for l in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    while lines and not lines[0]: lines.pop(0)
    while lines and not lines[-1]: lines.pop()
    return "\n".join(lines)

def meta(n):  # a ticket's title, state, labels, created time and log; exit 1 when there is none
    p = path(n, "json")
    if not os.path.exists(p):
        die("no ticket #%d in %s" % (n, STORE))
    try:
        m = json.loads(text_of(bytes_of(p, "ticket"), p, "ticket"))
    except ValueError as e:
        die("cannot read ticket #%d at %s: %s" % (n, p, e))
    if not isinstance(m, dict):
        die("ticket #%d at %s is not a JSON object" % (n, p))
    return m

def body(n):
    return bytes_of(path(n, "md"), "the body of #%d at" % n)

def write(p, data):  # replace a whole file: a reader sees the old one or the new one, never part
    tmp = "%s.%d.tmp" % (p, os.getpid())
    try:
        with open(tmp, "wb") as f:
            f.write(data); f.flush(); os.fsync(f.fileno())
        os.replace(tmp, p)
    except OSError as e:
        with contextlib.suppress(OSError):
            os.unlink(tmp)
        die("cannot write %s: %s" % (p, e.strerror))

def write_meta(n, m):
    write(path(n, "json"), (json.dumps(m, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))

@contextlib.contextmanager
def locked():  # every write holds the store's lock; it is released when the process ends, whatever happens
    try:
        fd = os.open(os.path.join(STORE, ".lock"), os.O_RDWR | os.O_CREAT, 0o644)
        fcntl.flock(fd, fcntl.LOCK_EX)
    except OSError as e:
        die("cannot lock the store %s: %s" % (STORE, e.strerror))
    try:
        yield
    finally:
        os.close(fd)

def numbers():  # every ticket's number, ascending; a ticket exists once its .json is written
    return sorted(int(m.group(1)) for m in (re.fullmatch(r"(\d+)\.json", f) for f in os.listdir(STORE)) if m)

def next_number():  # one past every number in use, including a body an unfinished create left
    used = [int(m.group(1)) for m in (re.fullmatch(r"(\d+)\.(?:json|md)", f) for f in os.listdir(STORE)) if m]
    return max(used, default=0) + 1

if cmd == "store":
    if len(args) == 1:
        need_store(); print(STORE)
    elif args[1:] == ["init"]:
        existed = os.path.isdir(STORE)
        try:
            os.makedirs(STORE, exist_ok=True)
        except OSError as e:
            die("cannot make %s: %s" % (STORE, e.strerror))
        print("store %s: %s" % ("exists" if existed else "created", STORE))
    else:
        usage("store [init]")

elif cmd == "create":
    if len(args) != 3: usage("create <title> <body-file>")
    title = args[1].strip()
    if not title: die("the title is empty")
    if "\n" in title or "\r" in title: die("the title is more than one line")
    data = body_file(args[2])
    need_store()
    with locked():
        n = next_number()
        write(path(n, "md"), data)
        created = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        write_meta(n, {"title": title, "state": "todo", "labels": [], "created": created, "log": []})
    print(n)

elif cmd == "edit":
    # Four arguments whose second is not a file are the form the other adapters once took, with a title.
    if len(args) != 4 or not os.path.isfile(args[2]):
        usage("edit <n> <body-file> <base-file>" + ("; no such body file: " + args[2] if len(args) == 4 else ""))
    n = number_arg(args[1])
    data = body_file(args[2]); base = text_of(bytes_of(args[3], "base file"), args[3], "base file")
    need_store()
    with locked():
        meta(n)
        if normal(body(n).decode("utf-8", errors="replace")) != normal(base):
            die("#%d changed since %s was read; read it again" % (n, args[3]), 4)
        write(path(n, "md"), data)
    print("#%d: edited" % n)

elif cmd == "read":
    body_only = args[2:] == ["--body"]
    if len(args) != 2 and not body_only: usage("read <n> [--body]")
    n = number_arg(args[1]); need_store(); m = meta(n); data = body(n)
    if body_only:
        sys.stdout.buffer.write(data if data.endswith(b"\n") else data + b"\n"); sys.exit(0)
    print("id: #%d" % n)
    print("title: %s" % m.get("title", ""))
    print("state: %s" % m.get("state", ""))
    print("labels: %s" % ", ".join(str(l) for l in m.get("labels") or []))
    print("created: %s" % str(m.get("created", ""))[:10])
    print("path: %s" % path(n, "md"))
    print()
    print(data.decode("utf-8", errors="replace").strip())
    log = m.get("log") or []
    if log:
        print("\n## Log")
        for line in log:
            print("- " + " ".join(str(line).split()))

elif cmd == "state":
    if len(args) != 3: usage("state <n> <state>")
    n = number_arg(args[1]); new = state_arg(args[2])
    need_store()
    with locked():
        m = meta(n); m["state"] = new; write_meta(n, m)
    print("#%d: %s" % (n, new))

elif cmd == "comment":
    if len(args) < 4: usage("comment <n> <actor> <text>")
    n = number_arg(args[1]); actor = args[2]; text = " ".join(args[3:])
    line = " ".join(("%s %s: %s" % (datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), actor, text)).split())
    need_store()
    with locked():
        m = meta(n); m["log"] = list(m.get("log") or []) + [line]; write_meta(n, m)
    print("#%d: %s" % (n, line))

elif cmd == "list":
    if len(args) not in (1, 2): usage("list [state]")
    want = state_arg(args[1]) if len(args) == 2 else None
    need_store()
    rows = [(n, str(m.get("state", "")), str(m.get("title", ""))) for n, m in ((n, meta(n)) for n in numbers())]
    rank = lambda r: (STATES.index(r[1]) if r[1] in STATES else len(STATES), r[0])
    for n, st, title in sorted(rows, key=rank):
        if want is None or st == want:
            print("#%d\t%s\t%s" % (n, st, title))

else:
    usage("store|create|edit|read|state|comment|list ...")
PY
fi

# --- self-test ----------------------------------------------------------------------------
# Every command runs for real, against throwaway repositories with no remote. HOME is an empty
# directory, every proxy points at a closed port, and a gh first on PATH records any call, so a
# control passing here needed no service and no login.
SELF="$(cd "$(dirname "$0")" && pwd -P)/$(basename "$0")"
HERE=$(dirname "$SELF")
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
mkdir -p "$tmp/bin" "$tmp/home" || exit 1
printf '#!/bin/sh\necho "gh $*" >> "%s/gh.log"\nexit 1\n' "$tmp" > "$tmp/bin/gh" && chmod +x "$tmp/bin/gh" || exit 1
export HOME="$tmp/home" PATH="$tmp/bin:$PATH" POSTMASTER_CONFIG="$tmp/home/no-config.toml" GIT_CEILING_DIRECTORIES="$tmp"
for v in http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY; do export "$v=http://127.0.0.1:9"; done
export GIT_AUTHOR_NAME=self-test GIT_AUTHOR_EMAIL=self-test@example.org GIT_COMMITTER_NAME=self-test GIT_COMMITTER_EMAIL=self-test@example.org

newrepo() {  # newrepo <dir>: a repository with no remote, one commit, and worktrees excluded as the flow does
  git init -q "$1" && git -C "$1" commit -q --allow-empty -m "Initial commit" \
    && printf '.worktrees/\n' >> "$1/.git/info/exclude"
}
R="$tmp/repo"; W="$R/.worktrees/7"
newrepo "$R" && mkdir "$R/sub" && git -C "$R" worktree add -q "$W" -b 7 || exit 1
ST="$R/.git/postmaster/tickets"
lt() { out=$("$SELF" "$@" 2>&1); rc=$?; }                   # lt <repo> <command...>: sets out and rc
snap() { local f; for f in "$ST"/*; do [ -f "$f" ] && printf '%s %s\n' "${f##*/}" "$(cksum < "$f")"; done; }
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/         /'; fails=$((fails+1)); }
check() {  # check <label> <exit wanted> <text the output holds, or empty>: judges the last lt
  if [ "$rc" -eq "$2" ] && { [ -z "$3" ] || printf '%s\n' "$out" | grep -qF -- "$3"; }; then ok "$1"
  else fail "$1: wanted exit $2${3:+ with \"$3\"}, got exit $rc" "$out"; fi
}

printf '## Problem / feature\nA ticket with `code`, "quotes" and a trailing space. \n\n## Acceptance criteria\n1. It is read back as written.\n\n## Direction\nNone: any approach that meets the criteria.\n\n## Turnpikes\ndefault\n' > "$tmp/body.md"
printf '## Problem / feature\r\nStored with CRLF line endings.\r\n' > "$tmp/crlf.md"
printf '## Problem / feature\nThe new body.\n' > "$tmp/new.md"
printf ' \n\n' > "$tmp/empty.md"

echo "negative controls: a repository with no store"
lt "$R" store; check "store says there is none, exit 3, and names store init" 3 "store init"
nostore() { local label=$1; shift; lt "$R" "$@"; check "$label exits 3" 3 "no ticket store"; }   # nostore <label> <command...>
nostore create create "A title" "$tmp/body.md"
nostore read read 1
nostore "read --body" read 1 --body
nostore edit edit 1 "$tmp/new.md" "$tmp/body.md"
nostore state state 1 done
nostore comment comment 1 postmaster "hello"
nostore list list
[ ! -e "$ST" ] && ok "and none of them made a store" || fail "and none of them made a store"
mkdir "$tmp/plain"; lt "$tmp/plain" list; check "a directory that is not a git repository exits 1" 1 "not a git repository"

echo "positive controls"
refs=$(git -C "$R" for-each-ref | cksum); commits=$(git -C "$R" rev-list --all | wc -l)
lt "$R" store init; check "store init makes the store in the repository's git directory" 0 "store created: $(cd "$R/.git" && pwd -P)/postmaster/tickets"
lt "$R" store init; check "store init again leaves it as it was" 0 "store exists:"
want=$(cd "$ST" && pwd -P); same=1
for d in "$R" "$R/sub" "$W"; do lt "$d" store; [ "$rc" -eq 0 ] && [ "$out" = "$want" ] || same=0; done
[ $same -eq 1 ] && ok "the main checkout, a directory in it and a linked worktree find the same store" \
  || fail "the main checkout, a directory in it and a linked worktree find the same store" "$out"
before=$(date -u +%Y-%m-%d); lt "$R" create "  A tracker that needs no service  " "$tmp/body.md"; after=$(date -u +%Y-%m-%d)
[ "$rc" -eq 0 ] && [ "$out" = 1 ] && ok "create prints the new ticket's number, 1" || fail "create prints the new ticket's number, 1 (exit $rc)" "$out"
lt "$R" create "Line endings" "$tmp/crlf.md"
[ "$rc" -eq 0 ] && [ "$out" = 2 ] && ok "the next create prints 2" || fail "the next create prints 2 (exit $rc)" "$out"
"$SELF" "$R" read 1 --body > "$tmp/out" 2>&1; rc=$?
[ $rc -eq 0 ] && cmp -s "$tmp/out" "$tmp/body.md" && ok "read --body prints the body byte for byte" \
  || fail "read --body prints the body byte for byte (exit $rc)" "$(cat -A "$tmp/out")"
"$SELF" "$R" read 2 --body > "$tmp/out" 2>&1; rc=$?
[ $rc -eq 0 ] && cmp -s "$tmp/out" "$tmp/crlf.md" && ok "a CRLF body keeps its line endings" \
  || fail "a CRLF body keeps its line endings (exit $rc)" "$(cat -A "$tmp/out")"
lt "$R" read 1
head=$(printf '%s\n' "$out" | sed -n '1,7p' | tr '\n' '|')
case $head in
  "id: #1|title: A tracker that needs no service|state: todo|labels: |created: $before|path: $want/1.md||" \
  | "id: #1|title: A tracker that needs no service|state: todo|labels: |created: $after|path: $want/1.md||") good=1 ;;
  *) good=0 ;;
esac
[ "$rc" -eq 0 ] && [ $good -eq 1 ] && [ "$(printf '%s\n' "$out" | sed -n 8p)" = "## Problem / feature" ] \
  && ok "read prints id, title, state, labels, created and path, a blank line, then the body" \
  || fail "read prints id, title, state, labels, created and path, a blank line, then the body (exit $rc)" "$out"
lt "$W" read 1; from_worktree=$out; lt "$R/sub" read 1
[ "$rc" -eq 0 ] && [ "$out" = "$from_worktree" ] && ok "a linked worktree and a subdirectory read the same ticket" \
  || fail "a linked worktree and a subdirectory read the same ticket" "$out"
lt "$W" state 1 in-progress; lt "$R" read 1
printf '%s\n' "$out" | grep -qx 'state: in-progress' && ok "a state set from a linked worktree is the state the main checkout reads" \
  || fail "a state set from a linked worktree is the state the main checkout reads" "$out"
line='[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2} coachman: Harvested both lanes\.'
lt "$R/sub" comment 1 coachman "Harvested both
lanes."; written=$out; lt "$R" read 1
[ "$(printf '%s\n' "$written" | wc -l)" -eq 1 ] && printf '%s\n' "$written" | grep -qxE -e "#1: $line" \
  && printf '%s\n' "$out" | sed -n '/^## Log$/,$p' | grep -qxE -e "- $line" \
  && ok "comment adds one dated line to the log, actor first, on one line" \
  || fail "comment adds one dated line to the log, actor first, on one line" "$written$(printf '\n'; printf '%s' "$out")"
"$SELF" "$R" read 1 --body > "$tmp/base.md" 2>/dev/null
lt "$R" edit 1 "$tmp/new.md" "$tmp/base.md"; check "edit against the body as read replaces it" 0 "#1: edited"
"$SELF" "$R" read 1 --body > "$tmp/out" 2>&1
lt "$R" read 1
cmp -s "$tmp/out" "$tmp/new.md" && printf '%s\n' "$out" | grep -qx 'title: A tracker that needs no service' && printf '%s\n' "$out" | grep -qx 'state: in-progress' \
  && ok "the body is the new one, and the title and state are as they were" || fail "the body is the new one, and the title and state are as they were" "$out"
printf '## Problem / feature  \r\nThe new body.  \r\n\r\n' > "$tmp/base-crlf.md"
lt "$R" edit 1 "$tmp/new.md" "$tmp/base-crlf.md"; check "a base that differs only in line endings and trailing spaces matches" 0 "#1: edited"
lt "$R" create "Blocked one" "$tmp/body.md"; lt "$R" state 3 blocked
lt "$R" create "Done one" "$tmp/body.md"; lt "$R" state 4 done
lt "$R" create "Cancelled one" "$tmp/body.md"; lt "$R" state 5 cancelled
lt "$R" create "Another todo" "$tmp/body.md"; lt "$R" state 2 done
lt "$R" list
want_list=$(printf '#6\ttodo\tAnother todo\n#1\tin-progress\tA tracker that needs no service\n#3\tblocked\tBlocked one\n#2\tdone\tLine endings\n#4\tdone\tDone one\n#5\tcancelled\tCancelled one')
[ "$rc" -eq 0 ] && [ "$out" = "$want_list" ] && ok "list groups every ticket by state, in the flow's order, then by number" \
  || fail "list groups every ticket by state, in the flow's order, then by number (exit $rc)" "$out"
lt "$R" list done
[ "$rc" -eq 0 ] && [ "$out" = "$(printf '#2\tdone\tLine endings\n#4\tdone\tDone one')" ] && ok "list <state> lists only that state" \
  || fail "list <state> lists only that state (exit $rc)" "$out"
[ -z "$(git -C "$R" status --porcelain --ignored=no)" ] && [ "$(git -C "$R" for-each-ref | cksum)" = "$refs" ] \
  && [ "$(git -C "$R" rev-list --all | wc -l)" = "$commits" ] && [ -z "$(git -C "$W" status --porcelain)" ] \
  && ok "no ticket is in a working tree, on a branch or in a commit" \
  || fail "no ticket is in a working tree, on a branch or in a commit" "$(git -C "$R" status --porcelain; git -C "$R" for-each-ref)"
C="$tmp/concurrent"; newrepo "$C" && "$SELF" "$C" store init > /dev/null || exit 1
pids=""; for k in 1 2 3 4 5 6 7 8 9 10; do "$SELF" "$C" create "Ticket $k" "$tmp/body.md" > "$tmp/c.$k" 2>&1 & pids="$pids $!"; done
bad=0; for p in $pids; do wait "$p" || bad=$((bad+1)); done
got=$(cat "$tmp"/c.* | sort -n | paste -sd' ' -)
[ $bad -eq 0 ] && [ "$got" = "1 2 3 4 5 6 7 8 9 10" ] && [ "$("$SELF" "$C" list | wc -l | tr -d ' ')" = 10 ] \
  && ok "ten creates at once get ten different numbers" || fail "ten creates at once get ten different numbers ($bad failed)" "$got"

echo "negative controls: nothing is written"
refused() {  # refused <label> <exit> <text the message holds> <command...>: exits so and changes no file
  local label=$1 want=$2 why=$3 was; shift 3
  was=$(snap); lt "$R" "$@"
  if [ "$rc" -eq "$want" ] && printf '%s\n' "$out" | grep -qF -- "$why" && [ "$(snap)" = "$was" ]; then ok "$label"
  else fail "$label: wanted exit $want with \"$why\" and no file changed, got exit $rc" "$out"; fi
}
"$SELF" "$R" read 1 --body > "$tmp/base.md" 2>/dev/null
printf '## Problem / feature\nChanged in the store since.\n' > "$tmp/stale.md"
refused "a base the ticket no longer matches exits 4" 4 "#1 changed since" edit 1 "$tmp/body.md" "$tmp/stale.md"
refused "an empty body file exits 1" 1 "is empty" edit 1 "$tmp/empty.md" "$tmp/base.md"
refused "a missing base file exits 1" 1 "cannot read base file" edit 1 "$tmp/body.md" "$tmp/nowhere.md"
refused "the form with a title is a usage error" 1 "usage:" edit 1 "A title" "$tmp/body.md"
refused "edit on an unknown ticket exits 1" 1 "no ticket #99" edit 99 "$tmp/body.md" "$tmp/base.md"
refused "an invalid state exits 2" 2 "invalid state" state 1 finished
refused "state on an unknown ticket exits 1" 1 "no ticket #99" state 99 done
refused "a comment on an unknown ticket exits 1" 1 "no ticket #99" comment 99 coachman "hello"
refused "create with an empty body exits 1" 1 "is empty" create "A title" "$tmp/empty.md"
refused "create with an empty title exits 1" 1 "title is empty" create "  " "$tmp/body.md"
refused "create with a title of two lines exits 1" 1 "more than one line" create "Two
lines" "$tmp/body.md"
refused "something that is not a number exits 1" 1 "not a ticket number" read "PM-1"
refused "an unknown ticket exits 1" 1 "no ticket #99" read 99
refused "list with an invalid state exits 2" 2 "invalid state" list finished
[ ! -e "$tmp/gh.log" ] && ok "no command called gh" || fail "no command called gh" "$(cat "$tmp/gh.log")"

echo "controls: a repository whose store exists uses this tracker, whatever the config names"
printf '[tracker]\nkind = "github"\n' > "$tmp/github.toml"; printf '[tracker]\nkind = "plane"\n' > "$tmp/plane.toml"
tracker() { POSTMASTER_CONFIG=$1 "$HERE/discover-project.sh" "$2" 2>/dev/null | sed -n 's/^tracker=//p'; }
[ "$(tracker "$tmp/github.toml" "$R")" = local ] && [ "$(tracker "$tmp/github.toml" "$W")" = local ] \
  && ok "discover-project.sh names local for it and its worktree, with a config naming github" \
  || fail "discover-project.sh names local for it and its worktree, with a config naming github" "$(tracker "$tmp/github.toml" "$R")"
U="$tmp/unticketed"; newrepo "$U" || exit 1
[ "$(tracker "$tmp/github.toml" "$U")" = github ] && [ "$(tracker "$tmp/plane.toml" "$U")" = plane ] \
  && [ -z "$(tracker "$tmp/home/no-config.toml" "$U")" ] \
  && ok "a repository with no store gets the config's kind, and none without a config" \
  || fail "a repository with no store gets the config's kind, and none without a config" "$(tracker "$tmp/github.toml" "$U")"
out=$(POSTMASTER_CONFIG="$tmp/github.toml" "$HERE/ticket-check.sh" "$R" 3 2>&1); rc=$?
[ $rc -eq 0 ] && printf '%s\n' "$out" | grep -q '^well-formed' && [ ! -e "$tmp/gh.log" ] \
  && ok "ticket-check.sh reads a ticket through this store, with a config naming github" \
  || fail "ticket-check.sh reads a ticket through this store, with a config naming github (exit $rc)" "$out"
out=$(POSTMASTER_CONFIG="$tmp/github.toml" "$HERE/ticket-check.sh" "$U" 3 2>&1); rc=$?
[ $rc -eq 1 ] && printf '%s\n' "$out" | grep -qF "github adapter" && [ -s "$tmp/gh.log" ] \
  && ok "without a store it goes to the github adapter, and the gh on PATH saw the call" \
  || fail "without a store it goes to the github adapter, and the gh on PATH saw the call (exit $rc)" "$out"

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
