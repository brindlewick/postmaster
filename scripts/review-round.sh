#!/usr/bin/env bash
# The end of a review round: wait for its reviewers within the round's time limit, record and
# stop the ones that did not finish, and tear its scratches down with nothing left running in
# them.
#
#   review-round.sh wait     <dispatch> <round> <repo> "<lenses>" "<lanes>"
#   review-round.sh teardown <dispatch> <round> <repo> "<lenses>" "<lanes>"
#   review-round.sh --self-test
#
# The round's reviewers are every lane under every lens, each list separated by spaces or
# commas. Reviewer <lens> <lane> lands its marker at <dispatch>/logs/review-r<round>-<lens>-<lane>.done
# and works in its scratch, <repo>/.worktrees/<TICKET>-rev-<lens>-<lane>, where <TICKET> is the
# name of the dispatch directory.
#
# wait blocks until every reviewer's marker is in (scripts/wait-for-markers.sh), for at most
# the round's time limit: review.round_timeout_seconds in the config recorded in
# <dispatch>/run.json, or 2400 seconds where it sets none. At the limit it names each reviewer
# with no marker, records it DEGRADED with timeout as its cause, in run-log.md and a degrade
# line, and stops everything still running in its scratch.
#
# teardown stops anything still running in each of the round's scratches, then removes each
# one with git worktree remove --force, and logs teardown for it. A scratch that is not a
# detached worktree of <repo>, or that something still runs in, is left in place and named.
#
# A process is selected by its working directory, in a scratch, or by descent from a process
# that is; never by its command line, which can carry a prompt. It is frozen, sent TERM, and
# sent KILL if it is still there after a grace period. This script's own process, and every
# process above it, is never signalled. REVIEW_ROUND_GRACE and REVIEW_ROUND_READER are for the
# self-test only.
#
#   exit 0  wait: every marker is in · teardown: every scratch removed
#   exit 3  wait: the limit passed; the reviewers with no marker are recorded and stopped
#   exit 1  usage; a reader failed its control; wait: a marker no reviewer of the round lands;
#           teardown: a scratch left in place
#
# Controls: each reader is proved both ways before it is trusted. A marker this script plants
# must be seen and one it did not plant must not; a process it starts in an empty directory
# must be found, and a second empty directory must show none.
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
DEFAULT_LIMIT=2400
GRACE=${REVIEW_ROUND_GRACE:-5}   # seconds between TERM and KILL
USAGE='usage: review-round.sh wait|teardown <dispatch> <round> <repo> "<lenses>" "<lanes>" | --self-test'
die() { echo "review-round: $*" >&2; exit 1; }

limit_of() {  # limit_of <dispatch>: "<seconds> config|default"; says on stderr why a set value was not used
  python3 - "$1/run.json" "$DEFAULT_LIMIT" <<'PY'
import json, sys
path, default = sys.argv[1], int(sys.argv[2])
def fall(why):
    print("review-round: %s; the round's time limit is the default, %ds" % (why, default), file=sys.stderr)
    print(default, "default"); sys.exit(0)
try:
    cfg = json.load(open(path)).get("config")
except FileNotFoundError:
    fall("no run.json at %s" % path)
except (OSError, ValueError, AttributeError) as e:
    fall("%s cannot be read (%s)" % (path, e))
review = cfg.get("review") if isinstance(cfg, dict) else None
v = review.get("round_timeout_seconds") if isinstance(review, dict) else None
if v is None:
    print(default, "default")
elif isinstance(v, int) and not isinstance(v, bool) and v > 0:
    print(v, "config")
else:
    fall("review.round_timeout_seconds in %s is %r, not a whole number of seconds above zero" % (path, v))
PY
}

stop_py() {  # stop_py <scratch>...: stops what runs in each, and reports it
  # One line per process, tab-separated: stopped|left|caller, the scratch, the pid, its name;
  # or one line, blind, when a reader fails its control. Exits 0 when nothing is left running
  # in any scratch, 2 when something is, and 1 when a reader failed its control.
  python3 - "$GRACE" "$@" <<'PY'
import os, signal, subprocess, sys, tempfile, time

GRACE = float(sys.argv[1])
ROOTS = [os.path.realpath(r) for r in sys.argv[2:]]
READER = os.environ.get("REVIEW_ROUND_READER") or ("proc" if os.path.exists("/proc/self/cwd") else "lsof")
DELETED = " (deleted)"

class Blind(Exception):
    pass

def table():
    """pid -> (ppid, state, start, name) for every process; ps prints no command line here."""
    try:
        out = subprocess.run(["ps", "-A", "-o", "pid=,ppid=,stat=,lstart=,comm="], capture_output=True,
                             text=True, env=dict(os.environ, LC_ALL="C")).stdout
    except OSError:
        out = ""
    t = {}
    for line in out.splitlines():
        f = line.split(None, 8)
        if len(f) == 9 and f[0].isdigit() and f[1].isdigit():
            t[int(f[0])] = (int(f[1]), f[2], " ".join(f[3:8]), f[8].strip())
    if os.getpid() not in t:
        raise Blind("ps does not list this process")
    return t

def cwds():
    """pid -> working directory, for every process whose working directory can be read."""
    out = {}
    if READER == "proc":
        for name in os.listdir("/proc"):
            if name.isdigit():
                try:
                    out[int(name)] = os.readlink("/proc/%s/cwd" % name)
                except OSError:
                    pass
    else:
        try:
            text = subprocess.run(["lsof", "-w", "-n", "-P", "-d", "cwd", "-F", "pn"],
                                  capture_output=True, text=True).stdout
        except OSError:
            text = ""
        pid = None
        for line in text.splitlines():
            if line[:1] == "p" and line[1:].isdigit():
                pid = int(line[1:])
            elif line[:1] == "n" and pid is not None:
                out[pid] = line[1:]
    if out.get(os.getpid()) != os.getcwd():
        raise Blind("the %s reader cannot see this process's own working directory" % READER)
    return out

def inside(cwd, roots):
    if not cwd:
        return None
    if cwd.endswith(DELETED):
        cwd = cwd[: -len(DELETED)]
    for r in roots:
        if cwd == r or cwd.startswith(r.rstrip("/") + "/"):
            return r
    return None

def ancestry(t):
    """This process and every process above it: never signalled."""
    mine, p = {0, 1}, os.getpid()
    while p in t and p not in mine:
        mine.add(p)
        p = t[p][0]
    return mine

def targets(roots, spare):
    """(pid -> root, table, cwds): every live process working in a root, and all it started."""
    t, c = table(), cwds()
    live = {p for p, v in t.items() if not v[1].startswith("Z")}
    hit = {p: inside(c.get(p), roots) for p in live - spare}
    hit = {p: r for p, r in hit.items() if r}
    kids = {}
    for p, v in t.items():
        kids.setdefault(v[0], []).append(p)
    todo = list(hit)
    while todo:
        p = todo.pop()
        for k in kids.get(p, ()):
            if k in live and k not in spare and k not in hit:
                hit[k] = hit[p]
                todo.append(k)
    return hit, t, c

def sig(p, s):
    try:
        os.kill(p, s)
    except OSError:
        pass

def still(sent):
    """The processes sent a signal that are still there: same pid, same start, not a zombie."""
    t = table()
    return {p for p, (start, _, _) in sent.items()
            if p in t and t[p][2] == start and not t[p][1].startswith("Z")}

def control():
    try:
        a = os.path.realpath(tempfile.mkdtemp(prefix="review-round-control-"))
        b = os.path.realpath(tempfile.mkdtemp(prefix="review-round-control-"))
        probe = subprocess.Popen(["sleep", "60"], cwd=a, stdin=subprocess.DEVNULL,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError as e:
        raise Blind("cannot start the control process: %s" % e)
    try:
        seen, give_up = False, time.time() + 5
        while not seen and time.time() < give_up:
            seen = probe.pid in targets([a], set())[0]
            seen or time.sleep(0.1)
        empty = len(targets([b], set())[0])
    finally:
        probe.kill()
        probe.wait()
        os.rmdir(a)
        os.rmdir(b)
    if not seen or empty:
        raise Blind("positive control %s, negative control %d" % ("found" if seen else "not found", empty))

def stop(roots):
    touched = set()
    try:
        return stopping(roots, touched)
    except BaseException:
        for p in touched:                  # stopped part-way: leave nothing frozen
            sig(p, signal.SIGCONT)
        raise

def stopping(roots, touched):
    spare = ancestry(table())
    sent = {}                              # pid -> (start, root, name): everything signalled
    kill_at, end_at = time.time() + GRACE, None
    def new(hit, t):                       # not yet signalled, or a new process on a pid that was
        return {p: r for p, r in hit.items() if p not in sent or sent[p][0] != t[p][2]}
    while True:
        hit, t, _ = targets(roots, spare)
        if not hit and not still(sent):
            break
        fresh, frozen = new(hit, t), {}
        for _ in range(20):                # freeze first, so nothing forks between listing and signal
            if not fresh:
                break
            for p in fresh:
                sig(p, signal.SIGSTOP)
            touched.update(fresh)
            frozen.update(fresh)
            hit, t, _ = targets(roots, spare)
            fresh = {p: r for p, r in new(hit, t).items() if p not in frozen}
        for p, r in frozen.items():
            if p in t:
                sent[p] = (t[p][2], r, t[p][3])
            sig(p, signal.SIGKILL if end_at else signal.SIGTERM)
        for p in frozen:
            sig(p, signal.SIGCONT)
        now = time.time()
        if end_at is None and now >= kill_at:
            for p in still(sent):
                sig(p, signal.SIGKILL)
            end_at = now + 5
        elif end_at is not None and now >= end_at:
            break
        time.sleep(0.1)
    hit, t, c = targets(roots, spare)
    left = {p: sent[p][1] for p in still(sent)}
    left.update(hit)
    callers = {p: inside(c.get(p), roots) for p in spare if inside(c.get(p), roots)}
    return sent, left, callers, t

try:
    control()
    sent, left, callers, t = stop(ROOTS)
except Blind as e:
    print("blind\t-\t-\t%s" % e)
    sys.exit(1)
except Exception as e:                     # anything else stops the same way: nothing is trusted
    print("blind\t-\t-\t%s: %s" % (type(e).__name__, e))
    sys.exit(1)
name = lambda p: t[p][3] if p in t else sent.get(p, (None, None, "?"))[2]
for p, (_, root, _) in sorted(sent.items()):
    print("%s\t%s\t%d\t%s" % ("left" if p in left else "stopped", root, p, name(p)))
for p, root in sorted(left.items()):
    if p not in sent:
        print("left\t%s\t%d\t%s" % (root, p, name(p)))
for p, root in sorted(callers.items()):
    print("caller\t%s\t%d\t%s" % (root, p, name(p)))
sys.exit(2 if left or callers else 0)
PY
}
stop_in() { STOPS=$(stop_py "$@"); }   # the report goes to $STOPS; returns as stop_py exits

report() {  # report <kind> <scratch>: "<n> process(es): <pid>/<name>, ..." from $STOPS, or nothing
  printf '%s\n' "$STOPS" | awk -F'\t' -v k="$1" -v s="$2" '
    $1 == k && $2 == s { n++; l = l (n > 1 ? ", " : "") $3 "/" $4 }
    END { if (n) printf "%d process%s: %s", n, (n > 1 ? "es" : ""), l }'
}
blind() { printf '%s\n' "$STOPS" | awk -F'\t' '$1 == "blind" { print $4 }'; }
scratch() { printf '%s/.worktrees/%s-rev-%s-%s' "$REPO" "$TICKET" "$1" "$2"; }
record() {  # record <run-log text> <log-action args...>: both, or say which could not be written
  local text=$1; shift
  "$HERE/run-log.sh" "$D" "$text" || echo "review-round: could not write to run-log.md: $text" >&2
  "$HERE/log-action.sh" "$D" coachman "$@" || echo "review-round: could not log: $*" >&2
}

not_a_scratch() {  # not_a_scratch <path>: why it is not a detached worktree of the repo, or nothing
  local top common
  top=$(cd "$1" 2>/dev/null && cd "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null && pwd -P)
  common=$(cd "$1" 2>/dev/null && cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P)
  if [ "$top" != "$1" ] || [ "$common" != "$REPO_COMMON" ]; then echo "not a worktree of $REPO"
  elif git -C "$1" symbolic-ref -q HEAD >/dev/null; then echo "on a branch, so not a scratch"
  fi
}

round_wait() {
  local n=$(( ${#LENSES[@]} * ${#LANES[@]} )) lim src rc lens lane m s probe got left expected="" f strays=""
  read -r lim src <<< "$(limit_of "$D")"
  echo "review-round: round $R, $n reviewers, time limit ${lim}s ($( [ "$src" = config ] && echo "review.round_timeout_seconds in run.json" || echo "the default"))"
  probe="$LOGS/.review-round-control.$$"
  : > "$probe"
  [ -e "$probe" ] && [ ! -e "$LOGS/.review-round-unplanted.$$" ]; rc=$?
  rm -f "$probe"
  [ $rc -eq 0 ] || die "the marker reader failed its control in $LOGS"

  "$HERE/wait-for-markers.sh" "$LOGS" "review-r$R-*.done" "$n" "$lim"; rc=$?
  case $rc in 0|3) ;; *) exit 1 ;; esac
  MISSING=()
  for lens in "${LENSES[@]}"; do
    for lane in "${LANES[@]}"; do
      expected="$expected review-r$R-$lens-$lane.done "
      [ -e "$LOGS/review-r$R-$lens-$lane.done" ] || MISSING+=("$lens $lane")
    done
  done
  if [ ${#MISSING[@]} -eq 0 ]; then
    [ $rc -eq 3 ] && echo "review-round: every marker was in by the time the reviewers were named; none timed out"
    exit 0
  fi
  if [ $rc -eq 0 ]; then
    for f in "$LOGS"/review-r"$R"-*.done; do
      case $expected in *" ${f##*/} "*) ;; *) [ -e "$f" ] && strays="$strays ${f##*/}" ;; esac
    done
    die "the count was made up by markers no reviewer of round $R lands:$strays; these reviewers have none: $(printf '%s, ' "${MISSING[@]}" | sed 's/, $//')"
  fi

  # The limit passed: record each reviewer with no marker, then stop what it was running.
  record "round $R: WAIT-TIMEOUT after ${lim}s; $((n - ${#MISSING[@]})) of $n reviewers reported" \
    note "r$R" "WAIT-TIMEOUT after ${lim}s: $((n - ${#MISSING[@]})) of $n reviewers reported"
  local scratches=()
  for m in "${MISSING[@]}"; do
    set -- $m
    echo "TIMEOUT $1 $2: DEGRADED, timeout"
    record "$2 $1: DEGRADED, timeout" degrade "$2" "$1 r$R: timeout"
    scratches+=("$(scratch "$1" "$2")")
  done
  stop_in "${scratches[@]}"; rc=$?
  [ $rc -eq 1 ] && die "nothing was stopped: the process reader failed its control ($(blind))"
  for m in "${MISSING[@]}"; do
    set -- $m; s=$(scratch "$1" "$2")
    got=$(report stopped "$s")
    if [ -n "$got" ]; then
      echo "  stopped in $s: $got"
      record "$2 $1: stopped at the time limit, $got" note "$s" "r$R $1 $2: stopped at the time limit, $got"
    else
      echo "  nothing was running in $s"
    fi
    left=$(report left "$s"); got=$(report caller "$s")
    [ -z "$left$got" ] || echo "  STILL RUNNING in $s: $left${left:+${got:+; }}${got:+the process that ran this, $got}"
  done
  exit 3
}

round_teardown() {
  local lens lane s rc got why removed=0 kept=0 all=()
  for lens in "${LENSES[@]}"; do
    for lane in "${LANES[@]}"; do all+=("$(scratch "$lens" "$lane")"); done
  done
  stop_in "${all[@]}"; rc=$?
  [ $rc -eq 1 ] && die "nothing was removed: the process reader failed its control ($(blind))"
  for s in "${all[@]}"; do
    got=$(report stopped "$s")
    if [ -n "$got" ]; then
      echo "stopped in $s: $got"
      record "${s##*/}: stopped at teardown, $got" note "$s" "r$R: stopped at teardown, $got"
    fi
    why=$(report left "$s")
    [ -z "$why" ] || why="still running, $why"
    got=$(report caller "$s")
    [ -z "$got" ] || why="${why:+$why; }the process that ran this works in it, $got"
    if [ -z "$why" ] && [ ! -e "$s" ]; then echo "no scratch at $s"; continue; fi
    [ -n "$why" ] || why=$(not_a_scratch "$s")
    if [ -z "$why" ]; then
      if got=$(git -C "$REPO" worktree remove --force "$s" 2>&1); then
        echo "removed $s"; removed=$((removed + 1))
        "$HERE/log-action.sh" "$D" coachman teardown "$s" "review scratch, round $R" \
          || echo "review-round: could not log the teardown of $s" >&2
        continue
      fi
      why="git could not remove it: $got"
    fi
    echo "LEFT IN PLACE $s: $why"; kept=$((kept + 1))
    record "${s##*/}: left in place at teardown, $why" note "$s" "r$R: left in place at teardown, $why"
  done
  "$HERE/run-log.sh" "$D" "round $R: removed $removed of ${#all[@]} scratches$( [ "$kept" -eq 0 ] || echo ", $kept left in place")" \
    || echo "review-round: could not write to run-log.md" >&2
  [ "$kept" -eq 0 ]
  exit $?
}

if [ "${1:-}" != --self-test ]; then
  [ $# -eq 6 ] || die "$USAGE"
  case $1 in wait|teardown) CMD=$1 ;; *) die "$USAGE" ;; esac
  D=$(cd "$2" 2>/dev/null && pwd -P) || die "no such dispatch directory: $2"
  case $3 in ''|0*|*[!0-9]*) die "a round is a whole number from 1: $3" ;; esac
  R=$3
  REPO=$(cd "$4" 2>/dev/null && pwd -P) || die "no such repo: $4"
  git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1 || die "not a git repository: $4"
  REPO_COMMON=$(cd "$REPO" && cd "$(git rev-parse --git-common-dir)" && pwd -P) || die "cannot find the git directory of $4"
  TICKET=${D##*/} LOGS="$D/logs"
  [ -d "$LOGS" ] || die "no logs directory in $D"
  LENSES=() LANES=()
  IFS=', ' read -r -a list <<< "$5"
  for n in ${list[@]+"${list[@]}"}; do [ -n "$n" ] && LENSES+=("$n"); done
  IFS=', ' read -r -a list <<< "$6"
  for n in ${list[@]+"${list[@]}"}; do [ -n "$n" ] && LANES+=("$n"); done
  [ ${#LENSES[@]} -gt 0 ] && [ ${#LANES[@]} -gt 0 ] || die "no lenses or no lanes given; $USAGE"
  for n in "${LENSES[@]}" "${LANES[@]}"; do
    case $n in .|..|*[!A-Za-z0-9._-]*) die "'$n' is not a lens or lane name" ;; esac
  done
  cd / || die "cannot leave the working directory"   # never work inside a scratch it stops
  case $CMD in wait) round_wait ;; teardown) round_teardown ;; esac
  exit 1
fi

# --- self-test ----------------------------------------------------------------------------
# A real repository with real scratches, a dispatch with a run.json, and planted processes:
# sleepers working in scratches, one whose child has left its scratch, one deaf to TERM, and a
# control outside every scratch that must outlive everything.
self="$HERE/$(basename "$0")"
tmp=$(mktemp -d) && tmp=$(cd "$tmp" && pwd -P) || exit 1
trap 'for f in "$tmp"/pid.*; do [ -s "$f" ] && kill -KILL "$(cat "$f")" 2>/dev/null; done; chmod -R u+w "$tmp" 2>/dev/null; rm -r -- "$tmp" 2>/dev/null' EXIT
repo="$tmp/repo" d="$tmp/runs/proj/T-1"
mkdir -p "$d/logs" "$tmp/elsewhere" "$tmp/bin" || exit 1
git init -q -b main "$repo" && git -C "$repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m first || exit 1
printf '{"config": {"review": {"round_timeout_seconds": 1}}}\n' > "$d/run.json"
cat > "$tmp/plant.sh" <<'SH'
#!/bin/sh
# plant.sh <dir> <pidfile> [leaver|deaf]: a sleeper working in <dir>, its pid in <pidfile> once it is there
cd "$1" || exit 1
case ${3:-} in
  leaver) sh -c 'cd / && echo $$ > "$1.child" && exec sleep 300' sh "$2" & ;;
  deaf) trap '' TERM ;;
esac
echo $$ > "$2"
case ${3:-} in deaf) while :; do sleep 1; done ;; *) exec sleep 300 ;; esac
SH
n=0 planted="" child=""
plant() {  # plant <dir> [leaver|deaf]: sets $planted, and $child for a leaver
  n=$((n + 1)); sh "$tmp/plant.sh" "$1" "$tmp/pid.$n" "${2:-}" & planted=$!
  disown   # its end is the test's business, not a job report
  local i=0
  until [ -s "$tmp/pid.$n" ] && { [ "${2:-}" != leaver ] || [ -s "$tmp/pid.$n.child" ]; }; do
    i=$((i + 1)); [ $i -gt 50 ] && break; sleep 0.1
  done
  child=""; [ "${2:-}" = leaver ] && child=$(cat "$tmp/pid.$n.child")
}
cut() { git -C "$repo" worktree add -q --detach "$repo/.worktrees/T-1-rev-$1-$2" HEAD; }
alive() { local s; s=$(ps -o stat= -p "$1" 2>/dev/null) && [ -n "$s" ] && [ "${s#Z}" = "$s" ]; }
fails=0 out="" rc=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s (exit %s)\n' "$1" "$rc"; printf '%s\n' "$out" | sed 's/^/         /'; fails=$((fails+1)); }
check() { if eval "$2"; then ok "$1"; else fail "$1"; fi; }   # check <label> <condition>
run()  { out=$("$self" "$@" 2>&1); rc=$?; }
has()  { case $out in *"$1"*) true ;; *) false ;; esac; }
lines() { grep -c -- "$1" "$d/actions.jsonl" 2>/dev/null || true; }
limit() { mkdir -p "$tmp/limit"; rm -f "$tmp/limit/run.json"; [ -z "$1" ] || printf '%s\n' "$1" > "$tmp/limit/run.json"
          got=$(limit_of "$tmp/limit" 2>"$tmp/err"); out=$(cat "$tmp/err"); }

# Round 1: bug under lanes one and two. One reported; two is still running at the limit, with
# a child that has left its scratch. One's scratch still has a process of its own.
cut bug one; cut bug two
touch "$d/logs/review-r1-bug-one.done"
plant "$repo/.worktrees/T-1-rev-bug-two" leaver; p2=$planted c2=$child
plant "$repo/.worktrees/T-1-rev-bug-one"; p1=$planted
plant "$tmp/elsewhere"; px=$planted
run wait "$d" 1 "$repo" bug "one, two"; wait_rc=$rc wait_out=$out
p1_after_wait=$(alive "$p1" && echo running || echo gone)
p2_after_wait=$(alive "$p2" || alive "$c2" && echo running || echo gone)
run teardown "$d" 1 "$repo" "bug" "one two"; td_rc=$rc td_out=$out

echo "positive controls"
out=$wait_out rc=$wait_rc
check "at the limit, wait exits 3 and names the reviewer with no marker" \
  '[ $rc -eq 3 ] && has "WAIT-TIMEOUT after 1s" && has "TIMEOUT bug two: DEGRADED, timeout"'
out=$(cat "$d/run-log.md")
check "run-log.md records it as <lane> <lens>: DEGRADED, timeout" 'grep -q " two bug: DEGRADED, timeout$" "$d/run-log.md"'
out=$(cat "$d/actions.jsonl")
check "a degrade line records it, with the lens, the round and the cause" \
  'grep -q "\"action\":\"degrade\",\"target\":\"two\",\"detail\":\"bug r1: timeout\"" "$d/actions.jsonl"'
out=$wait_out rc=$wait_rc
check "what it was running is stopped, a child that left its scratch included" '[ "$p2_after_wait" = gone ]'
limit '{"config": {"review": {"round_timeout_seconds": 7}}}'
check "the limit is review.round_timeout_seconds in run.json" '[ "$got" = "7 config" ] && [ -z "$out" ]'
limit '{"config": {"ship": {}}}'
check "a config that sets none gets the default, 2400, and no warning" '[ "$got" = "2400 default" ] && [ -z "$out" ]'
out=$td_out rc=$td_rc
check "teardown removes each scratch, and logs teardown for it" \
  '[ $rc -eq 0 ] && [ ! -e "$repo/.worktrees/T-1-rev-bug-one" ] && [ ! -e "$repo/.worktrees/T-1-rev-bug-two" ] && ! git -C "$repo" worktree list | grep -q rev- && [ "$(lines "\"action\":\"teardown\"")" -eq 2 ]'
check "teardown first stops what still runs in a scratch, and says what" \
  '! alive "$p1" && has "stopped in $repo/.worktrees/T-1-rev-bug-one: 1 process: $p1/sleep"'
cut bug three; plant "$repo/.worktrees/T-1-rev-bug-three" deaf; pd=$planted
out=$(REVIEW_ROUND_GRACE=1 "$self" teardown "$d" 2 "$repo" bug three 2>&1); rc=$?
check "a process deaf to TERM is killed after the grace period" \
  '[ $rc -eq 0 ] && ! alive "$pd" && [ ! -e "$repo/.worktrees/T-1-rev-bug-three" ]'
if command -v lsof >/dev/null 2>&1; then
  cut bug four; plant "$repo/.worktrees/T-1-rev-bug-four"; pl=$planted
  out=$(REVIEW_ROUND_READER=lsof "$self" teardown "$d" 2 "$repo" bug four 2>&1); rc=$?
  check "the lsof reader, for where there is no /proc, finds and stops it too" \
    '[ $rc -eq 0 ] && ! alive "$pl" && [ ! -e "$repo/.worktrees/T-1-rev-bug-four" ]'
else
  echo "  skip the lsof reader, for where there is no /proc (lsof is not installed)"
fi

echo "negative controls"
out=$wait_out rc=$wait_rc
check "a reviewer that reported is neither recorded nor stopped by wait" \
  '[ "$p1_after_wait" = running ] && ! has "TIMEOUT bug one" && [ "$(lines "\"action\":\"degrade\"")" -eq 1 ]'
check "a process outside every scratch outlives wait and teardown" 'alive "$px"'
touch "$d/logs/review-r2-bug-one.done" "$d/logs/review-r2-bug-two.done"
run wait "$d" 2 "$repo" bug "one two"
check "when every marker is in, wait exits 0 and records nothing" \
  '[ $rc -eq 0 ] && [ "$(lines "\"action\":\"degrade\"")" -eq 1 ] && [ "$(lines "WAIT-TIMEOUT")" -eq 1 ]'
touch "$d/logs/review-r3-bug-one.done" "$d/logs/review-r3-style-one.done"
run wait "$d" 3 "$repo" bug "one two"
check "a marker another reviewer landed never stands in for a missing one" \
  '[ $rc -eq 1 ] && has "review-r3-style-one.done" && has "bug two" && [ "$(lines "\"action\":\"degrade\"")" -eq 1 ]'
for v in '"7"' 0 -3 true 1.5; do
  limit "{\"config\": {\"review\": {\"round_timeout_seconds\": $v}}}"
  check "a limit of $v is not used, and the warning says why" '[ "$got" = "2400 default" ] && has "not a whole number of seconds above zero"'
done
limit ""
check "no run.json gets the default, and the warning says so" '[ "$got" = "2400 default" ] && has "no run.json"'
cut security one; s1="$repo/.worktrees/T-1-rev-security-one"
out=$(cd "$s1" && "$self" teardown "$d" 4 "$repo" security one 2>&1; rc=$?; exit $rc); rc=$?
check "a scratch the caller works in is left in place, and the caller is not signalled" \
  '[ $rc -eq 1 ] && [ -e "$s1" ] && has "LEFT IN PLACE $s1" && has "the process that ran this works in it"'
# Stub readers, each wrong in one way. None may lead to a stop or a removal.
mkdir -p "$tmp/stubs/none" "$tmp/stubs/self" "$tmp/stubs/everywhere" "$tmp/t"
printf '#!/bin/sh\nexit 0\n' > "$tmp/stubs/none/lsof"
printf '#!/bin/sh\nprintf "p%%s\\nn/\\n" "$PPID"\n' > "$tmp/stubs/self/lsof"
cat > "$tmp/stubs/everywhere/lsof" <<'SH'
#!/bin/sh
# every process where it really is, except two of the caller's ancestors, put one in each
# control directory: a reader that finds a process in any directory it is asked about
set -- $(ls -d "$TMPDIR"/review-round-control-* 2>/dev/null)
for p in /proc/[0-9]*; do cwd=$(readlink "$p/cwd" 2>/dev/null) && printf 'p%s\nn%s\n' "${p#/proc/}" "$cwd"; done
a=$(ps -o ppid= -p "$PPID" | tr -d ' '); b=$(ps -o ppid= -p "$a" | tr -d ' ')
[ -n "${1:-}" ] && printf 'p%s\nn%s\n' "$a" "$1"
[ -n "${2:-}" ] && printf 'p%s\nn%s\n' "$b" "$2"
SH
chmod +x "$tmp"/stubs/*/lsof
plant "$s1"; pb=$planted
stub() { out=$(PATH="$tmp/stubs/$1:$PATH" TMPDIR="$tmp/t" REVIEW_ROUND_READER=lsof "$self" teardown "$d" 4 "$repo" security one 2>&1); rc=$?; }
stub none
check "a process reader that sees nothing fails its control, and nothing is stopped or removed" \
  '[ $rc -eq 1 ] && [ -e "$s1" ] && alive "$pb" && has "failed its control"'
stub self
check "a reader that sees only its own process fails the positive control" \
  '[ $rc -eq 1 ] && [ -e "$s1" ] && alive "$pb" && has "positive control not found"'
if [ -d /proc/self ]; then
  stub everywhere
  check "a reader that sees a process in every directory fails the negative control" \
    '[ $rc -eq 1 ] && [ -e "$s1" ] && alive "$pb" && has "positive control found, negative control" && ! has "negative control 0"'
else
  echo "  skip a reader that sees a process in every directory (the stub reads /proc)"
fi
run teardown "$d" 4 "$repo" security one
check "the same scratch is removed once nothing runs in it" '[ $rc -eq 0 ] && [ ! -e "$s1" ] && ! alive "$pb"'
git -C "$repo" worktree add -q -b wb/x "$repo/.worktrees/T-1-rev-style-one" HEAD
run teardown "$d" 4 "$repo" style one
check "a worktree on a branch is never removed as a scratch" \
  '[ $rc -eq 1 ] && [ -e "$repo/.worktrees/T-1-rev-style-one" ] && has "on a branch, so not a scratch"'
if [ "$(id -u)" -ne 0 ]; then
  chmod a-w "$d/logs"; run wait "$d" 5 "$repo" bug one; chmod u+w "$d/logs"
  check "a marker reader that cannot see its planted marker stops the wait" '[ $rc -eq 1 ] && has "marker reader failed its control"'
else
  echo "  skip a marker reader that cannot see its planted marker (root writes anywhere)"
fi
for args in "wait $d 0 $repo bug one" "wait $d 1 $repo bug ../x" "wait $tmp/nowhere 1 $repo bug one" \
            "wait $d 1 $tmp/elsewhere bug one" "stop $d 1 $repo bug one"; do
  run $args
  check "refused: review-round.sh ${args//$tmp/<tmp>}" '[ $rc -eq 1 ]'
done

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
