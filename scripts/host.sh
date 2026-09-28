#!/usr/bin/env bash
# The session host: where a launch runs and how the user watches it. Herdr wherever a Herdr
# server answers, tmux where it does not, and a detached background process with neither.
# skills/postmaster/hosts.md records each form per host; this script is their executable
# form, and the two change together.
#
#   host.sh detect                        herdr, tmux or none, on stdout
#   host.sh name <dispatch> [<role>]      the run's name from its waybill, then " · <role>"
#   host.sh run <name> <cwd> [--out <file>] [--err <file>] [--append] [--marker <file>]
#               [--pidfile <file>] -- <command...>
#   host.sh stop <worktree>               stop every launch still running in a worktree
#   host.sh close <worktree>              close its space (Herdr) and its windows (tmux)
#   host.sh spawn <handle> <cwd> [--label <text>] -- <command...>   an interactive session;
#                                         the handle becomes a Herdr agent name
#   host.sh send <handle> <file> [--wait [<seconds>]]   submit the file's text to that session,
#                                         and with --wait block until it settles (default 600)
#   host.sh wait <handle> [<seconds>]     block until it settles, when nothing was just sent
#   host.sh read <handle> [<lines>]       print what it shows (default 120 lines)
#   host.sh start <agent> <cwd> [--label <text>] [--exited <file>] [--err <file>] [--env-file <file>]
#               [--env <KEY=VALUE>]... [--timeout <seconds>] [--no-session] [--typed <title-regex>]
#               -- <kind> <args...>                       a live agent (Herdr only, below)
#   host.sh prompt <agent> <file> [--timeout <seconds>] [--no-wait]   give a live agent work
#   host.sh state <agent>                 a live agent's status and session reference, as JSON
#   host.sh report <agent> idle|working   a typed agent's status, for Herdr to show
#   host.sh end <agent>                   end a live agent host.sh started
#   host.sh --self-test                   stub hosts on PATH; never touches a live server
#   host.sh --live-test                   the ticket's controls, against the hosts on this machine
#
# run: <command> is the same headless command a caller would otherwise background with `&`. It
# runs from the directory host.sh was called in, with the caller's environment and an empty
# stdin, in a session of its own with no terminal; its stdout goes to --out, added to with
# --append, and its stderr to --err, which holds only this launch's errors. --marker is removed
# as it starts and touched when it exits,
# whatever its exit, and also when host.sh cannot start it, with the reason in --err. --pidfile
# gets its pid, which is also its process group: `kill -- -<pid>` stops all of it. <cwd> is the
# directory the launch belongs to, usually its worktree: in Herdr the launch runs in a new tab of
# that worktree's space, opened with `herdr worktree open` under the repository's space if it is
# not open yet; in tmux in a window of session postmaster-<repo>; with no host, detached from
# the caller. A reviewer's scratch clone (cut-scratch.sh --clone) opens as a space of its own in
# Herdr, and in tmux joins the session of the repository it was cut from. <name> labels the space when host.sh opens it, the tab or window and the pane's
# title, and names the thread where the harness can (POSTMASTER_LAUNCH_NAME, read by launch.sh).
# Pass it as "$(host.sh name <dispatch> <role>)", so a ticket's title never passes through a
# shell. A pane shows the stream through view-stream.sh. A launch carries its own pane's
# identity (HERDR_PANE_ID and the like, or TMUX_PANE), never its caller's. If the host cannot
# place it, it runs in the background. While it runs it is registered under
# POSTMASTER_HOST_STATE (default ~/.postmaster/host), whatever its host, so stop and close see it.
#
# start, prompt, state and end are for live agents (hosts.md, Live agents), and need Herdr. start
# runs <kind> with <args> as a Herdr agent named <agent>, in a fresh tab of <cwd>'s space placed as
# run places a launch, so no screen an earlier agent left is read as this one's. The pane's shell
# becomes a bash on the pane's own environment, with the caller's POSTMASTER_ settings, handed
# over as run hands an environment, then the env file, then each --env, and never the user's shell
# startup files; no other variable of the caller's reaches it. The agent is registered as a launch
# in <cwd>, so stop and close see it. --exited is removed as it
# starts and touched when it exits, or when it cannot start, with the reason in --err. start
# returns once the agent is ready and its Herdr integration has reported its session, or with
# --no-session once it is ready, and prints one JSON line: where it runs, its process group and
# the session reference, null with --no-session. With --typed, <kind> and <args> are a command
# typed into the pane's shell, for a harness Herdr has no agent kind for; it is ready once it
# sets its terminal title to match <title-regex>, within --timeout (default 60), and host.sh then
# reports it to Herdr as agent <kind> under the name <agent>. prompt sends the file's text only to
# an agent that has settled, and waits for it in the same call; a settled state says the agent
# looks ready, never that its work is done, so the caller checks what the turn left on disk. With
# --no-wait it sends the text and returns at once, for a caller that follows the agent's turns
# itself; a typed agent's text is pasted into its pane and entered. report sets the status Herdr
# shows for a typed agent, and does nothing for any other.
#
# POSTMASTER_HOST=herdr|tmux|none overrides detection; nothing needs setting to get the default.
# POSTMASTER_HOST_CLAIM_WAIT (20) is how long a new pane has to start its launch, and
# POSTMASTER_HOST_CLOSE_WAIT (15) how long close waits for a launch that is just ending.
# POSTMASTER_HOST_SESSION_WAIT (20) is how long start waits for the integration's session report.
#
#   exit 0  detected, named, started, stopped, closed, sent, settled or read
#   exit 1  usage, or nothing could be started
#   exit 2  close refused: a launch still runs in the worktree, or its space holds something
#           host.sh did not open
#   exit 3  spawn, send, wait or read with no host that keeps an interactive session; or a send
#           or wait that did not settle, stopped at an approval or a question, or showed no turn;
#           start, prompt, state, report or end with no Herdr; prompt to an agent that has not settled
#   exit 4  start: the agent stopped at a question before taking any work, or a typed agent never
#           set its title; prompt: no turn was seen, so read the harness's session before sending
#           the text again
#   exit 5  start: no session report from the harness's integration; prompt: timed out
#   exit 6  prompt, state or report: no live agent has that name
set -uo pipefail
HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
SELF=$HERE/$(basename "$0")
SOURCE=custom:postmaster        # Herdr source for a launch's agent state
META=custom:postmaster-meta     # Herdr source for its name and ownership tokens
STATE=${POSTMASTER_HOST_STATE:-$HOME/.postmaster/host}   # where running launches are registered
PANE_IDS="HERDR_PANE_ID HERDR_TAB_ID HERDR_WORKSPACE_ID TMUX_PANE"   # which pane a process is in
PLACE_ENV=()                    # --env KEY=VALUE for the pane host.sh opens next (spawn)

die()  { echo "host: $*" >&2; exit 1; }
warn() { echo "host: $*" >&2; }
has()  { command -v "$1" >/dev/null 2>&1; }
limit() { local s=$1; shift; if has timeout; then timeout "$s" "$@"; else "$@"; fi; }
q() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }   # quote for any shell
clean() { printf '%s' "$1" | tr -d '\000-\037\177'; }   # a label or title, without control characters
count() {  # count <value> <what>: a whole number, so no arithmetic ever sees anything else
  case $1 in ''|*[!0-9]*) die "$2 must be a whole number, not '$1'" ;; esac
  printf '%d\n' "$((10#$1))"
}
json() {  # json <python expression over d, the parsed stdin>; prints it, '' for None
  python3 -c 'import json, sys
d = json.load(sys.stdin)
v = eval(sys.argv[1])
print("" if v is None else v)' "$1"
}

herdr_up() { has herdr && limit 5 herdr workspace list >/dev/null 2>&1; }

detect() {
  local forced=${POSTMASTER_HOST:-}
  case $forced in
    none) echo none; return ;;
    ""|auto|herdr|tmux) ;;
    *) warn "POSTMASTER_HOST=$forced is not herdr, tmux, none or auto; detecting" ;;
  esac
  if [ "$forced" = tmux ]; then
    has tmux && { echo tmux; return; }
    warn "POSTMASTER_HOST=tmux, but tmux is not on PATH; detecting"
  fi
  herdr_up && { echo herdr; return; }
  [ "$forced" = herdr ] && warn "POSTMASTER_HOST=herdr, but no Herdr server answers; detecting"
  has tmux && { echo tmux; return; }
  echo none
}

clone_origin() {  # clone_origin <dir>: for a reviewer's scratch clone, the repository it was cut from
  local k; k=$("$HERE/cut-scratch.sh" --kind "$1" 2>/dev/null) && [ "${k%% *}" = clone ] && printf '%s\n' "${k#clone }"
}
repo_of() {  # repo_of <dir>: the main checkout's path, a scratch clone's origin, or nothing outside a repository
  local common
  clone_origin "$1" && return 0
  common=$(git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || return 1
  case $common in */.git) dirname "$common" ;; *) printf '%s\n' "$common" ;; esac
}
tmux_session() {  # tmux_session <dir>: postmaster-<repo>, with the characters tmux refuses replaced
  local repo; repo=$(repo_of "$1") || repo=$1
  printf 'postmaster-%s\n' "$(basename "$repo" | tr '.:' '__')"
}
handle_of() {  # handle_of <text>: a Herdr agent name, [a-z][a-z0-9_-]{0,31}, and the tmux window's.
  # Longer text keeps its start and gains a checksum of the whole, so two long names differ.
  local h sum
  h=$(printf '%s' "$1" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9_-' '-')
  case $h in [a-z]*) ;; *) h=p$h ;; esac
  if [ ${#h} -gt 32 ]; then
    sum=$(printf '%s' "$1" | cksum | cut -d' ' -f1)
    h=$(printf '%s-%08x' "${h:0:23}" "$sum")
  fi
  printf '%s\n' "$h"
}

name_cmd() {  # name <dispatch> [<role>]: the `name:` of the waybill's Dispatch section, else the run
  local d=${1:?usage: host.sh name <dispatch> [<role or lane>]} role=${2:-} n
  n=$(python3 - "$d/brief.md" <<'PY'
import re, sys
try:
    lines = open(sys.argv[1], encoding="utf-8", errors="replace").read().splitlines()
except OSError:
    sys.exit(0)
inside = False
for line in lines:
    if line.startswith("## "):
        inside = line.strip() == "## Dispatch"
    elif inside and line.startswith("name:"):
        print(re.sub(r"\s{2,}\(.*\)$", "", line[5:]).strip())      # a template's trailing note
        break
PY
)
  [ -n "$n" ] || n=$(basename "$d")
  clean "$n${role:+ · $role}"; echo
}

# --- the registry of running launches ------------------------------------------------------
# One file per launch, named for its process group, holding the directory it was placed in and
# its name. A launch is running while any process of its group is alive; the file of one that
# is not is removed by whoever reads it next.
reg_add() { mkdir -p "$STATE/launches" 2>/dev/null && printf '%s\n%s\n' "$2" "$3" > "$STATE/launches/$1"; }
reg_live() {  # reg_live <dir>: "<group>\t<name>" per launch still running that was placed in <dir>
  local f pg cwd name
  for f in "$STATE"/launches/*; do
    [ -f "$f" ] || continue
    pg=${f##*/}
    case $pg in ''|*[!0-9]*) continue ;; esac
    if ! kill -0 -- "-$pg" 2>/dev/null && ! kill -0 "$pg" 2>/dev/null; then rm -f -- "$f"; continue; fi
    { IFS= read -r cwd; IFS= read -r name; } < "$f"
    [ "$cwd" = "$1" ] && printf '%s\t%s\n' "$pg" "$name"
  done
}

# --- Herdr placement ----------------------------------------------------------------------
# herdr_place <name> <cwd> [repo]: find or open the space for <cwd> and a pane in it. With
# `repo`, the pane goes in the repository's own space whatever worktree <cwd> is. Prints
# "<space> <tab> <pane>".
herdr_place() {
  local name=$1 cwd=$2 where=${3:-worktree} top list src="" root="" rname wpath wkind wopen out space tab pane="" opened=0
  top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || top=""
  if [ -n "$top" ] && list=$(herdr worktree list --cwd "$cwd" 2>/dev/null); then
    IFS=$'\t' read -r src root rname wpath wkind wopen < <(printf '%s' "$list" | python3 -c '
import json, os, sys
d = json.load(sys.stdin)["result"]
s = d.get("source") or {}
top = os.path.realpath(sys.argv[1])
w = next((w for w in d.get("worktrees") or [] if os.path.realpath(w["path"]) == top), {})
print("\t".join([s.get("source_workspace_id") or "-", s.get("repo_root") or "-", s.get("repo_name") or "-",
                 w.get("path") or "-", "linked" if w.get("is_linked_worktree") else "main",
                 w.get("open_workspace_id") or "-"]))' "$top")
    [ "$src" = - ] && src=""; [ "$root" = - ] && root=""; [ "${wopen:-}" = - ] && wopen=""
  fi
  if [ -z "$root" ] || [ "${wpath:--}" = - ] || { [ -z "${wopen:-}" ] && clone_origin "$top" >/dev/null; }; then
    # Not a checkout Herdr can read, or a reviewer's scratch clone, which Herdr reads as a
    # repository of its own: a space of the launch's own.
    out=$(herdr workspace create --cwd "$cwd" --label "$name" --no-focus ${PLACE_ENV[@]+"${PLACE_ENV[@]}"}) || return 1
    space=$(printf '%s' "$out" | json 'd["result"]["workspace"]["workspace_id"]')
    tab=$(printf '%s' "$out" | json 'd["result"]["tab"]["tab_id"]')
    pane=$(printf '%s' "$out" | json 'd["result"]["root_pane"]["pane_id"]')
    opened=1
  else
    if [ -z "$src" ]; then   # the repository has no space yet: open it, so the worktree nests
      out=$(herdr workspace create --cwd "$root" --label "$rname" --no-focus) || return 1
      src=$(printf '%s' "$out" | json 'd["result"]["workspace"]["workspace_id"]')
    fi
    if [ "$where" = repo ] || [ "$wkind" = main ]; then space=$src
    elif [ -n "$wopen" ]; then space=$wopen
    else
      out=$(herdr worktree open --workspace "$src" --path "$wpath" --label "$name" --no-focus) || return 1
      space=$(printf '%s' "$out" | json 'd["result"]["workspace"]["workspace_id"]')
      tab=$(printf '%s' "$out" | json 'd["result"]["tab"]["tab_id"]')
      pane=$(printf '%s' "$out" | json 'd["result"]["root_pane"]["pane_id"]')
      herdr tab rename "$tab" "$name" >/dev/null 2>&1
      opened=1
    fi
    if [ -z "$pane" ]; then
      out=$(herdr tab create --workspace "$space" --cwd "$cwd" --label "$name" --no-focus ${PLACE_ENV[@]+"${PLACE_ENV[@]}"}) || return 1
      tab=$(printf '%s' "$out" | json 'd["result"]["tab"]["tab_id"]')
      pane=$(printf '%s' "$out" | json 'd["result"]["root_pane"]["pane_id"]')
    fi
  fi
  [ -n "$space" ] && [ -n "$tab" ] && [ -n "$pane" ] || return 1
  # Ownership, so `close` never closes what host.sh did not open.
  [ "$opened" = 1 ] && herdr workspace report-metadata "$space" --source "$META" --token postmaster=opened >/dev/null 2>&1
  herdr pane report-metadata "$pane" --source "$META" --title "$name" --token postmaster=launch >/dev/null 2>&1
  printf '%s %s %s\n' "$space" "$tab" "$pane"
}

# --- launch plumbing ----------------------------------------------------------------------
# A launch is handed to its runner through a private directory: the fields as files, the argv
# NUL-separated, and for a pane the caller's environment through a FIFO, so it is never written
# to disk or put on any command line. Whoever creates <spec>/claimed first runs it; the runner
# removes the spec once it has read it.
SPEC_FIELDS="name cwd rundir state out err marker pidfile append envfile setenv"
write_spec() {  # write_spec <spec> <name> <cwd> <out> <err> <marker> <pidfile> <append> <argv...>
  local s=$1; shift
  printf '%s' "$1" > "$s/name"; printf '%s' "$2" > "$s/cwd"; printf '%s' "$PWD" > "$s/rundir"
  printf '%s' "$STATE" > "$s/state"; printf '%s' "$3" > "$s/out"; printf '%s' "$4" > "$s/err"
  printf '%s' "$5" > "$s/marker"; printf '%s' "$6" > "$s/pidfile"; printf '%s' "$7" > "$s/append"
  shift 7
  printf '%s\0' "$@" > "$s/argv"
}
drop_spec() {  # drop_spec <spec>: its files, then the directory
  local f
  for f in $SPEC_FIELDS argv env; do rm -f -- "$1/$f"; done
  rmdir -- "$1/claimed" "$1" 2>/dev/null
}
dump_env() { python3 -c 'import os, sys
for k, v in os.environb.items(): sys.stdout.buffer.write(k + b"=" + v + b"\0")'; }

start_env_writer() {  # start_env_writer <fifo>: hand this environment to whoever opens the FIFO,
  # from a process of its own that gives up after 120 s, so the caller never waits on it
  python3 -c 'import os, sys, time
if os.fork(): os._exit(0)
os.setsid()
fd = os.open(os.devnull, os.O_RDWR)
for n in (0, 1, 2): os.dup2(fd, n)
path, data = sys.argv[1], b"".join(k + b"=" + v + b"\0" for k, v in os.environb.items())
deadline = time.time() + 120
while True:
    try:
        out = os.open(path, os.O_WRONLY | os.O_NONBLOCK)
        break
    except OSError:                          # no reader yet, or the spec is gone
        if time.time() > deadline or not os.path.exists(path): os._exit(0)
        time.sleep(0.1)
os.set_blocking(out, True)
while data: data = data[os.write(out, data):]' "$1" </dev/null >/dev/null 2>&1
}
read_env() {  # read_env <fifo>: the caller's environment NUL-separated, then an OK sentinel;
  # nothing but the environment, without the sentinel, if no writer arrives within 30 s
  python3 -c 'import os, signal, sys
signal.signal(signal.SIGALRM, lambda *a: os._exit(1))
signal.alarm(30)
with open(sys.argv[1], "rb") as f: data = f.read()
signal.alarm(0)
sys.stdout.buffer.write(data + b"POSTMASTER_ENV_OK=1\0")' "$1"
}
start_runner_bg() {  # start_runner_bg <spec>: the runner in a session of its own; prints its pid
  python3 -c 'import os, sys
pid = os.fork()
if pid:
    print(pid); sys.stdout.flush(); os._exit(0)
os.setsid()
fd = os.open(os.devnull, os.O_RDWR)
for n in (0, 1, 2): os.dup2(fd, n)
os.execv(sys.argv[1], sys.argv[1:])' "$SELF" _run bg "$1"
}
# The launch itself: a session of its own, so no terminal and no share in the pane's signals,
# and its environment read from fd 3 rather than taken as arguments.
START_CHILD='import os, sys
env = {}
with os.fdopen(3, "rb") as f:
    for kv in f.read().split(b"\0"):
        k, eq, v = kv.partition(b"=")
        if eq: env[k] = v
os.setsid()
try:
    os.execvpe(sys.argv[1], sys.argv[1:], env)
except OSError as e:
    sys.stderr.write("host: cannot run %s: %s\n" % (sys.argv[1], e.strerror)); os._exit(127)'

watch_exit() {  # watch_exit <pid> <marker>: touch the marker once <pid> is gone, from outside the
  # pane, so it lands even when the pane is closed and takes its runner with it
  python3 -c 'import os, sys, time
if os.fork(): os._exit(0)
os.setsid()
pid, marker = int(sys.argv[1]), sys.argv[2]
while True:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        break
    except PermissionError:
        pass
    time.sleep(0.5)
with open(marker, "a"):
    os.utime(marker)' "$1" "$2" </dev/null >/dev/null 2>&1
}

herdr_report() {  # herdr_report <pid> <name>: the pane's launch working while <pid> runs, released after
  # It reports at once, whatever Herdr detects in the pane later. A closing idle report is
  # ignored once an agent has run in the pane, so the end is a release, under the same label.
  local cpid=$1 name=$2
  herdr pane report-agent "$HERDR_PANE_ID" --source "$SOURCE" --agent headless --state working >/dev/null 2>&1
  herdr pane report-metadata "$HERDR_PANE_ID" --source "$META" --title "$name" --display-agent "$name" \
    --token postmaster=launch --token state=running --token pgid="$cpid" >/dev/null 2>&1
  while kill -0 "$cpid" 2>/dev/null; do sleep 0.25; done
  herdr pane release-agent "$HERDR_PANE_ID" --source "$SOURCE" --agent headless >/dev/null 2>&1
  herdr pane report-metadata "$HERDR_PANE_ID" --source "$META" --title "$name" --display-agent "$name" \
    --token postmaster=launch --token state=done --token pgid="$cpid" >/dev/null 2>&1
}

# --- run ----------------------------------------------------------------------------------
FAIL_ERR="" FAIL_MARKER=""
launch_failed() {  # launch_failed <reason>: what a backgrounded launch left when nothing ran, the
  # reason in --err and the marker, so a wait on it ends and a reader finds why
  [ -n "$FAIL_ERR" ] && printf 'host: %s\n' "$1" >> "$FAIL_ERR" 2>/dev/null
  [ -n "$FAIL_MARKER" ] && touch "$FAIL_MARKER" 2>/dev/null
  die "$1"
}

run_cmd() {
  local name=${1:-} cwd=${2:-} out="" err="" marker="" pidfile="" append=0 bad=""
  [ $# -ge 2 ] && shift 2 || set --
  while [ $# -gt 0 ]; do
    case $1 in
      --out|--err|--marker|--pidfile)
        [ $# -ge 2 ] || { bad="$1 needs a file"; break; }
        case $1 in --out) out=$2 ;; --err) err=$2 ;; --marker) marker=$2 ;; --pidfile) pidfile=$2 ;; esac
        shift ;;
      --append) append=1 ;;
      --) shift; break ;;
      *) bad="unknown option for run: $1 (the command goes after --)"; set --; break ;;
    esac
    shift
  done
  abs() { case $1 in ""|/*) printf '%s' "$1" ;; *) printf '%s/%s' "$PWD" "$1" ;; esac; }
  out=$(abs "$out"); err=$(abs "$err"); marker=$(abs "$marker"); pidfile=$(abs "$pidfile")
  FAIL_ERR=$err FAIL_MARKER=$marker
  [ -z "$bad" ] || launch_failed "$bad"
  [ -n "$name" ] && [ -n "$cwd" ] || launch_failed "usage: host.sh run <name> <cwd> [options] -- <command...>"
  [ $# -gt 0 ] || launch_failed "run needs a command after --"
  [ -d "$cwd" ] || launch_failed "no such directory: $cwd"
  local claim_wait
  claim_wait=$(count "${POSTMASTER_HOST_CLAIM_WAIT:-20}" POSTMASTER_HOST_CLAIM_WAIT) || launch_failed "no launch: POSTMASTER_HOST_CLAIM_WAIT"
  cwd=$(CDPATH= cd -P -- "$cwd" && pwd -P); name=$(clean "$name")
  [ -n "$pidfile" ] && rm -f -- "$pidfile"          # never an earlier launch's pid
  [ -n "$marker" ] && rm -f -- "$marker"            # or its marker

  local spec host where="" rpid=""
  spec=$(mktemp -d "${TMPDIR:-/tmp}/postmaster-host.XXXXXX") || launch_failed "cannot make a spec directory"
  write_spec "$spec" "$name" "$cwd" "$out" "$err" "$marker" "$pidfile" "$append" "$@"
  host=$(detect)
  case $host in
    herdr)
      local placed space tab pane
      if placed=$(herdr_place "$name" "$cwd"); then
        read -r space tab pane <<< "$placed"
        mkfifo "$spec/env" && start_env_writer "$spec/env"
        if herdr pane run "$pane" " $(q "$SELF") _run herdr $(q "$spec")" >/dev/null 2>&1; then
          where="host=herdr space=$space tab=$tab pane=$pane"
        fi
      fi
      [ -n "$where" ] || warn "Herdr could not place '$name'; running it in the background" ;;
    tmux)
      local session win
      session=$(tmux_session "$cwd")
      mkfifo "$spec/env" && start_env_writer "$spec/env"
      if tmux has-session -t "=$session" 2>/dev/null; then
        win=$(tmux new-window -d -P -F '#{window_id}' -t "=$session:" -n "$name" -c "$cwd" \
              bash -c '"$0" _run tmux "$1"; exec "${SHELL:-/bin/sh}"' "$SELF" "$spec" 2>/dev/null)
      else
        win=$(tmux new-session -d -P -F '#{window_id}' -s "$session" -n "$name" -c "$cwd" \
              bash -c '"$0" _run tmux "$1"; exec "${SHELL:-/bin/sh}"' "$SELF" "$spec" 2>/dev/null)
      fi
      if [ -n "$win" ]; then
        tmux set-option -w -t "$win" @postmaster_cwd "$cwd" >/dev/null 2>&1
        tmux set-option -w -t "$win" automatic-rename off >/dev/null 2>&1
        where="host=tmux session=$session window=$win"
      else
        warn "tmux could not open a window for '$name'; running it in the background"
      fi ;;
  esac

  if [ -n "$where" ]; then
    local i=0
    while [ ! -d "$spec/claimed" ] && [ -d "$spec" ] && [ $i -lt $((claim_wait * 4)) ]; do sleep 0.25; i=$((i + 1)); done
    if mkdir "$spec/claimed" 2>/dev/null; then   # the pane never started it: nothing ran yet
      warn "the $host pane did not start '$name' within ${claim_wait}s; running it in the background"
      where=""
    fi
  else
    mkdir "$spec/claimed" 2>/dev/null
  fi
  if [ -z "$where" ]; then
    rpid=$(start_runner_bg "$spec")
    where="host=none"
  fi
  # The runner removes the spec once it has read it and writes the pid file as it starts the
  # command, so a caller can use either once this returns. A background runner that died before
  # taking the spec started nothing, and says so the way any failed launch does.
  local i=0
  while [ -d "$spec" ] && [ $i -lt 120 ]; do
    if [ -n "$rpid" ] && ! kill -0 "$rpid" 2>/dev/null; then break; fi
    sleep 0.25; i=$((i + 1))
  done
  if [ -d "$spec" ] && [ -n "$rpid" ] && ! kill -0 "$rpid" 2>/dev/null; then
    drop_spec "$spec"; launch_failed "'$name' did not start in the background"
  fi
  if [ -n "$pidfile" ] && [ ! -d "$spec" ]; then
    i=0; while [ ! -s "$pidfile" ] && [ $i -lt 40 ]; do sleep 0.25; i=$((i + 1)); done
  fi
  echo "$where"
}

# The runner: _run <herdr|tmux|bg> <spec>. In a pane it claims the launch first; in the
# background the caller has already claimed it.
runner() {
  local mode=$1 spec=$2
  if [ "$mode" != bg ]; then
    mkdir "$spec/claimed" 2>/dev/null || { echo "host: this launch was started elsewhere; nothing to do here."; return 0; }
  fi
  local name cwd rundir out err marker pidfile append argv=() envs=() kv k last=""
  name=$(cat "$spec/name"); cwd=$(cat "$spec/cwd"); rundir=$(cat "$spec/rundir"); STATE=$(cat "$spec/state")
  out=$(cat "$spec/out"); err=$(cat "$spec/err"); marker=$(cat "$spec/marker")
  pidfile=$(cat "$spec/pidfile"); append=$(cat "$spec/append")
  FAIL_ERR=$err FAIL_MARKER=$marker
  while IFS= read -r -d '' kv; do argv+=("$kv"); done < "$spec/argv"
  if [ "$mode" = bg ]; then
    while IFS= read -r -d '' kv; do envs+=("$kv"); done < <(dump_env)
  else
    while IFS= read -r -d '' kv; do envs+=("$kv"); done < <(read_env "$spec/env")
    [ ${#envs[@]} -gt 0 ] && last=${envs[${#envs[@]}-1]}
    if [ "$last" != POSTMASTER_ENV_OK=1 ]; then
      drop_spec "$spec"
      echo "host: the caller's environment never arrived, so '$name' did not start"
      [ -n "$err" ] && printf "host: the caller's environment never arrived, so '%s' did not start\n" "$name" >> "$err"
      [ -n "$marker" ] && touch "$marker"
      return 1
    fi
    unset "envs[${#envs[@]}-1]"
  fi
  drop_spec "$spec"

  # The launch's environment is its caller's, except for identity: which pane it is in comes
  # from where it actually runs, so nothing it reports lands in its caller's pane.
  local drop="POSTMASTER_LAUNCH_NAME $PANE_IDS" keep=""
  case $mode in
    herdr) drop="$drop HERDR_ENV HERDR_SOCKET_PATH HERDR_BIN_PATH"; keep="HERDR_PANE_ID HERDR_TAB_ID HERDR_WORKSPACE_ID HERDR_ENV HERDR_SOCKET_PATH HERDR_BIN_PATH" ;;
    tmux)  drop="$drop TMUX"; keep="TMUX TMUX_PANE" ;;
  esac
  local childenv=()
  for kv in ${envs[@]+"${envs[@]}"}; do
    k=${kv%%=*}
    case " $drop " in *" $k "*) continue ;; esac
    childenv+=("$kv")
  done
  for k in $keep; do [ -n "${!k+x}" ] && childenv+=("$k=${!k}"); done
  childenv+=("POSTMASTER_LAUNCH_NAME=$name")

  # Its streams are emptied once and then only ever appended to, so a second writer on the same
  # file, such as a resume started too soon, cannot overwrite what the first wrote. --append
  # keeps what --out held; --err holds only this launch's errors.
  local o=/dev/null e=/dev/null from=0 cpid rc=0 vpid="" rpid="" t0
  [ "$mode" != bg ] && { o=/dev/stdout; e=/dev/stderr; }
  [ -n "$out" ] && { o=$out; [ "$append" = 1 ] || : > "$out"; }
  [ -n "$err" ] && { e=$err; : > "$err"; }
  [ "$append" = 1 ] && [ -f "$out" ] && from=$(wc -c < "$out" | tr -d ' ')
  t0=$(date +%s)
  ( CDPATH= cd -- "$rundir" && exec python3 -c "$START_CHILD" "${argv[@]}" 3< <(printf '%s\0' "${childenv[@]}") ) \
    >> "$o" 2>> "$e" < /dev/null &
  cpid=$!
  [ -n "$pidfile" ] && printf '%s\n' "$cpid" > "$pidfile"
  reg_add "$cpid" "$cwd" "$name"
  trap 'kill -TERM -- "-$cpid" 2>/dev/null || kill -TERM "$cpid" 2>/dev/null' HUP INT TERM

  if [ "$mode" != bg ]; then
    printf '\033]0;%s\007' "$name"                 # the terminal title, for a pane with an agent
    [ "$mode" = tmux ] && tmux select-pane -t "${TMUX_PANE:-}" -T "$name" >/dev/null 2>&1
    printf '%s\nstarted %s in %s\n' "$name" "$(date '+%H:%M:%S')" "$rundir"
    [ -n "$out" ] && printf 'events: %s\n' "$out"
    printf '%s\n' "----"
    [ -n "$marker" ] && watch_exit "$cpid" "$marker"
    if [ -n "$out" ]; then "$HERE/view-stream.sh" --follow "$out" --pid "$cpid" --from "$from" & vpid=$!; fi
    [ "$mode" = herdr ] && [ -n "${HERDR_PANE_ID:-}" ] && { herdr_report "$cpid" "$name" & rpid=$!; }
    [ "$mode" = tmux ] && tmux set-option -w -t "${TMUX_PANE:-}" @postmaster_state running >/dev/null 2>&1
  fi

  while :; do
    wait "$cpid"; rc=$?
    kill -0 "$cpid" 2>/dev/null || break            # a trapped signal interrupts wait, not the launch
  done
  [ -n "$marker" ] && touch "$marker"
  trap - HUP INT TERM
  kill -0 -- "-$cpid" 2>/dev/null || rm -f -- "$STATE/launches/$cpid"
  [ "$mode" = bg ] && return 0

  [ -n "$vpid" ] && wait "$vpid" 2>/dev/null
  [ -n "$rpid" ] && wait "$rpid" 2>/dev/null
  [ "$mode" = tmux ] && tmux set-option -w -t "${TMUX_PANE:-}" @postmaster_state done >/dev/null 2>&1
  printf '%s\nexit %s at %s after %ss%s\n' "----" "$rc" "$(date '+%H:%M:%S')" "$(( $(date +%s) - t0 ))" \
    "${marker:+, marker $marker}"
  return 0
}

# --- stop and close -----------------------------------------------------------------------
worktree_arg() {  # worktree_arg <dir> <what>: its real path, or die
  [ -n "${1:-}" ] || die "usage: host.sh $2 <worktree>"
  [ -d "$1" ] || die "no such directory: $1"
  (CDPATH= cd -P -- "$1" && pwd -P)
}

stop_cmd() {  # stop <worktree>: every launch still running in it, whatever its host
  local path pg name n=0 live i=0
  path=$(worktree_arg "${1:-}" stop) || exit 1
  case $(pwd -P)/ in "$path"/*) die "not stopping the launches in $path from inside it: that stops this session too" ;; esac
  live=$(reg_live "$path")
  [ -n "$live" ] || { echo "no launch is running in $path"; return 0; }
  while IFS=$'\t' read -r pg name; do
    kill -TERM -- "-$pg" 2>/dev/null || kill -TERM "$pg" 2>/dev/null
    n=$((n + 1))
  done <<< "$live"
  while [ -n "$(reg_live "$path")" ] && [ $i -lt 80 ]; do sleep 0.25; i=$((i + 1)); done
  live=$(reg_live "$path")
  [ -z "$live" ] || while IFS=$'\t' read -r pg name; do kill -KILL -- "-$pg" 2>/dev/null; done <<< "$live"
  echo "stopped $n launch(es) in $path"
}

close_cmd() {  # close <worktree>: refuse while a launch runs there; then its windows and its space
  local path live i=0 rc=0 patience
  path=$(worktree_arg "${1:-}" close) || exit 1
  patience=$(count "${POSTMASTER_HOST_CLOSE_WAIT:-15}" POSTMASTER_HOST_CLOSE_WAIT) || exit 1
  while live=$(reg_live "$path"); [ -n "$live" ]; do   # one whose marker just landed ends a moment later
    if [ $i -ge "$patience" ]; then
      warn "a launch is still running in $path: $(printf '%s\n' "$live" | cut -f2 | tr '\n' ';' | sed 's/;$//')"
      return 2
    fi
    sleep 1; i=$((i + 1))
  done
  if has tmux; then close_tmux "$path" || rc=$?; fi
  if herdr_up; then close_herdr "$path" || rc=$?; fi
  [ $rc -eq 0 ] && echo "closed what host.sh opened for $path"
  return $rc
}
close_tmux() {
  local session w cwd n=0
  session=$(tmux_session "$1")
  tmux has-session -t "=$session" 2>/dev/null || return 0
  while IFS=$'\t' read -r w cwd; do
    [ -n "$w" ] && [ "$cwd" = "$1" ] && tmux kill-window -t "$w" 2>/dev/null && n=$((n + 1))
  done < <(tmux list-windows -t "=$session" -F '#{window_id}	#{@postmaster_cwd}' 2>/dev/null)
  [ $n -gt 0 ] && echo "host=tmux: closed $n window(s)"
  return 0
}
close_herdr() {
  local list space kind verdict
  list=$(herdr worktree list --cwd "$1" 2>/dev/null) || return 0
  read -r space kind < <(printf '%s' "$list" | python3 -c '
import json, os, sys
d = json.load(sys.stdin)["result"]
p = os.path.realpath(sys.argv[1])
w = next((w for w in d.get("worktrees") or [] if os.path.realpath(w["path"]) == p), {})
print(w.get("open_workspace_id") or "-", "linked" if w.get("is_linked_worktree") else "main")' "$1")
  [ "$space" = - ] && return 0
  [ "$kind" = main ] && ! clone_origin "$1" >/dev/null \
    && { warn "$1 is a repository's own checkout; its space is never closed"; return 2; }
  verdict=$(python3 -c '
import json, sys
ws = json.loads(sys.argv[1])["result"]["workspace"]
if (ws.get("tokens") or {}).get("postmaster") != "opened":
    print("space %s was not opened by host.sh" % ws["workspace_id"]); sys.exit(0)
for p in json.loads(sys.argv[2])["result"]["panes"]:
    if (p.get("tokens") or {}).get("postmaster") != "launch":
        print("pane %s in space %s was not opened by host.sh" % (p["pane_id"], ws["workspace_id"])); sys.exit(0)
print("ok")' "$(herdr workspace get "$space" 2>/dev/null)" "$(herdr pane list --workspace "$space" 2>/dev/null)" 2>/dev/null)
  [ "$verdict" = ok ] || { warn "${verdict:-could not read space $space}; left open"; return 2; }
  herdr workspace close "$space" >/dev/null || die "herdr could not close space $space"
  echo "host=herdr: closed space $space"
}

# --- interactive sessions -----------------------------------------------------------------
no_session_host() {
  echo "host: no Herdr or tmux here to keep an interactive session; run it headless as a native session (hosts.md, none)" >&2
  exit 3
}
is_kind() {  # is_kind <name>: an agent kind this Herdr can start, from its own help (which exits 2)
  local help; help=$(herdr agent 2>&1)
  printf '%s\n' "$help" | sed -n 's/^ *kinds: //p' | tr '|' '\n' | grep -qxF "$1"
}
tmux_target() {  # tmux_target <handle>: the one window with that name, in any session
  local hits
  hits=$(tmux list-windows -a -F '#{window_id}	#{window_name}' 2>/dev/null | awk -F'\t' -v h="$1" '$2 == h {print $1}')
  [ -n "$hits" ] || die "no tmux window named $1"
  [ "$(printf '%s\n' "$hits" | wc -l | tr -d ' ')" -eq 1 ] || die "more than one tmux window is named $1"
  printf '%s\n' "$hits"
}

spawn_cmd() {
  local handle=${1:-} cwd=${2:-} label="" v err code placed space tab pane kind cmd a session win
  [ -n "$handle" ] && [ -n "$cwd" ] || die "usage: host.sh spawn <handle> <cwd> [--label <text>] -- <command...>"
  shift 2
  while [ $# -gt 0 ]; do
    case $1 in --label) label=${2:?--label needs text}; shift ;; --) shift; break ;; *) die "unknown option for spawn: $1" ;; esac
    shift
  done
  [ $# -gt 0 ] || die "spawn needs a command after --"
  [ -d "$cwd" ] || die "no such directory: $cwd"
  cwd=$(CDPATH= cd -P -- "$cwd" && pwd -P); label=$(clean "${label:-$handle}"); handle=$(handle_of "$handle")
  # The caller's own settings for the flow reach the session, as they reach every launch.
  local tmux_env=()
  PLACE_ENV=()
  for v in $(compgen -e | grep '^POSTMASTER_'); do PLACE_ENV+=(--env "$v=${!v}"); tmux_env+=(-e "$v=${!v}"); done
  case $(detect) in
    herdr)
      herdr agent get "$handle" >/dev/null 2>&1 && die "a live Herdr agent is already named $handle; spawn under another handle"
      placed=$(herdr_place "$label" "$cwd" repo) || die "Herdr could not open a tab for $handle"
      read -r space tab pane <<< "$placed"
      kind=$(basename "$1")
      if is_kind "$kind"; then
        shift
        if ! err=$(herdr agent start "$handle" --kind "$kind" --pane "$pane" -- "$@" 2>&1 >/dev/null); then
          code=$(printf '%s' "$err" | json 'd["error"]["code"]' 2>/dev/null)
          case $code in
            agent_not_ready) warn "$handle is asking something before it takes a message; the user answers it in space $space, then send" ;;
            *) die "herdr could not start $handle: ${code:-$err}" ;;
          esac
        fi
      else
        cmd=""; for a in "$@"; do cmd="$cmd $(q "$a")"; done
        herdr pane run "$pane" "$cmd" >/dev/null || die "herdr could not start $handle"
        herdr agent rename "$pane" "$handle" >/dev/null 2>&1
      fi
      echo "host=herdr space=$space tab=$tab pane=$pane handle=$handle" ;;
    tmux)
      [ "$(tmux list-windows -a -F '#{window_name}' 2>/dev/null | grep -cxF "$handle")" -eq 0 ] \
        || die "a tmux window is already named $handle; spawn under another handle"
      session=$(tmux_session "$cwd")
      if tmux has-session -t "=$session" 2>/dev/null; then
        win=$(tmux new-window -d -P -F '#{window_id}' -t "=$session:" ${tmux_env[@]+"${tmux_env[@]}"} -n "$handle" -c "$cwd" "$@")
      else
        win=$(tmux new-session -d -P -F '#{window_id}' -s "$session" ${tmux_env[@]+"${tmux_env[@]}"} -n "$handle" -c "$cwd" "$@")
      fi
      [ -n "$win" ] || die "tmux could not start $handle"
      tmux set-option -w -t "$win" automatic-rename off >/dev/null 2>&1
      echo "host=tmux session=$session window=$win handle=$handle" ;;
    none) no_session_host ;;
  esac
}

send_cmd() {  # send <handle> <file> [--wait [<seconds>]]
  local handle=${1:-} file=${2:-} waitfor="" err code st t buf=postmaster-send-$$
  [ -n "$handle" ] && [ -n "$file" ] || die "usage: host.sh send <handle> <file> [--wait [<seconds>]]"
  if [ "${3:-}" = --wait ]; then waitfor=$(count "${4:-600}" seconds) || exit 1; fi
  handle=$(handle_of "$handle")
  [ -f "$file" ] || die "no such file: $file"
  case $(detect) in
    herdr)
      # Sending and waiting are one call: a separate `agent wait` straight after a prompt can
      # return the previous turn's settled state before the new turn has started.
      if [ -z "$waitfor" ]; then
        herdr agent prompt "$handle" "$(cat "$file")" >/dev/null || die "herdr could not prompt $handle"
      elif ! err=$(herdr agent prompt "$handle" "$(cat "$file")" --wait --timeout "$((waitfor * 1000))" 2>&1 >/dev/null); then
        code=$(printf '%s' "$err" | json 'd["error"]["code"]' 2>/dev/null)
        case $code in
          agent_prompt_stalled) warn "the message went in, but Herdr saw no turn start; read the session before sending it again"; exit 3 ;;
          agent_blocked) warn "$handle is at an approval or a question; the user answers it in Herdr first"; exit 3 ;;
          timeout) echo "sent; $handle did not settle within ${waitfor}s"; exit 3 ;;
          *) die "herdr could not prompt $handle: ${code:-$err}" ;;
        esac
      else
        st=$(herdr agent get "$handle" 2>/dev/null | json 'd["result"]["agent"]["agent_status"]' 2>/dev/null)
        [ "$st" = blocked ] && { echo "sent; $handle stopped at an approval or a question: the user answers it in Herdr"; exit 3; }
      fi ;;
    tmux)
      t=$(tmux_target "$handle") || exit 1
      tmux load-buffer -b "$buf" "$file" && tmux paste-buffer -p -d -b "$buf" -t "$t" || die "tmux could not paste into $handle"
      sleep 0.5
      tmux send-keys -t "$t" Enter     # a separate key after the paste, never part of it
      [ -n "$waitfor" ] && { wait_cmd "$handle" "$waitfor" >/dev/null || { echo "sent; $handle did not settle within ${waitfor}s"; exit 3; }; } ;;
    none) no_session_host ;;
  esac
  echo "sent $(wc -c < "$file" | tr -d ' ') bytes to $handle${waitfor:+, and it settled}"
}

wait_cmd() {  # wait <handle> [<seconds>]
  local handle=${1:-} secs t quiet last="" now same=0 end st
  [ -n "$handle" ] || die "usage: host.sh wait <handle> [<seconds>]"
  secs=$(count "${2:-600}" seconds) || exit 1
  handle=$(handle_of "$handle")
  case $(detect) in
    herdr)
      herdr agent wait "$handle" --timeout "$((secs * 1000))" >/dev/null || { echo "$handle did not settle within ${secs}s"; return 3; }
      st=$(herdr agent get "$handle" 2>/dev/null | json 'd["result"]["agent"]["agent_status"]' 2>/dev/null)
      [ "$st" = blocked ] && { echo "$handle stopped at an approval or a question: the user answers it in Herdr"; return 3; }
      echo "$handle settled" ;;
    tmux)
      # Settled when the screen has not changed for QUIET seconds.
      quiet=$(count "${POSTMASTER_HOST_QUIET:-10}" POSTMASTER_HOST_QUIET) || exit 1
      t=$(tmux_target "$handle") || exit 1
      end=$(( $(date +%s) + secs ))
      while [ "$(date +%s)" -lt "$end" ]; do
        now=$(tmux capture-pane -p -t "$t" 2>/dev/null) || die "tmux cannot read $handle"
        if [ "$now" = "$last" ]; then same=$((same + 1)); else same=0; last=$now; fi
        [ $same -ge "$quiet" ] && { echo "$handle settled"; return 0; }
        sleep 1
      done
      echo "$handle did not settle within ${secs}s"; return 3 ;;
    none) no_session_host ;;
  esac
}

read_cmd() {  # read <handle> [<lines>]
  local handle=${1:-} lines t
  [ -n "$handle" ] || die "usage: host.sh read <handle> [<lines>]"
  lines=$(count "${2:-120}" lines) || exit 1
  handle=$(handle_of "$handle")
  case $(detect) in
    herdr) herdr agent read "$handle" --source recent-unwrapped --lines "$lines" ;;
    tmux) t=$(tmux_target "$handle") || exit 1; tmux capture-pane -p -J -S "-$lines" -t "$t" ;;
    none) no_session_host ;;
  esac
}

# --- live agents (host.live_agents) -------------------------------------------------------
# A live agent is a harness in its interactive form, started by Herdr in a pane of its worktree's
# space and kept there between turns. Herdr only: nothing else reports an agent's state.
need_herdr() {
  local h; h=$(detect)
  [ "$h" = herdr ] || { echo "host: live agents need Herdr, and the session host here is $h" >&2; exit 3; }
}
agent_json() {  # agent_json <agent>: Herdr's record of that live agent as one JSON line, or nothing
  herdr agent get "$1" 2>/dev/null | python3 -c 'import json, sys
try: print(json.dumps(json.load(sys.stdin)["result"]["agent"]))
except Exception: pass'
}
fg_group() {  # fg_group <pane>: the process group in the pane's foreground, unless it is the shell's
  herdr pane process-info --pane "$1" 2>/dev/null | python3 -c 'import json, sys
try:
    p = json.load(sys.stdin)["result"]["process_info"]
    g = p.get("foreground_process_group_id")
    if g and g != p.get("shell_pid"): print(g)
except Exception: pass'
}
end_group() {  # end_group <pgid>: TERM, then KILL whatever is left after 10 s
  local g=$1 i=0
  kill -TERM -- "-$g" 2>/dev/null || kill -TERM "$g" 2>/dev/null || return 0
  while kill -0 -- "-$g" 2>/dev/null && [ $i -lt 40 ]; do sleep 0.25; i=$((i + 1)); done
  kill -0 -- "-$g" 2>/dev/null && kill -KILL -- "-$g" 2>/dev/null
  return 0
}
seq_now() { python3 -c 'import time; print(int(time.time() * 1000))'; }   # Herdr orders reports by it
pane_tokens() {  # pane_tokens <pane>: host.sh's metadata tokens on it, as JSON
  herdr pane get "$1" 2>/dev/null | json 'json.dumps(d["result"]["pane"].get("tokens") or {})' 2>/dev/null
}
typed_group() {  # typed_group <pane>: a typed agent's process group, from its pane's tokens; nothing
  # for an agent Herdr started itself
  pane_tokens "$1" | json '(d.get("pgid") or "") if d.get("input") == "typed" else ""' 2>/dev/null
}
forget_typed() {  # forget_typed <agent> <pane> <label>: Herdr stops showing it, and its name is free
  herdr pane release-agent "$2" --source "$SOURCE" --agent "$3" --seq "$(seq_now)" >/dev/null 2>&1
  herdr agent rename "$1" --clear >/dev/null 2>&1
}
typed_alive() {  # typed_alive <agent> <record>: 0 unless a typed agent has gone, which Herdr does
  # not notice itself. It has gone once its process group no longer holds its pane's foreground:
  # MiMo Code's launcher can exit and leave its binary running in the group, busy, so whatever is
  # left of the group is ended, and then the agent is forgotten.
  local pane group label
  pane=$(printf '%s' "$2" | json 'd.get("pane_id")')
  group=$(typed_group "$pane")
  [ -n "$group" ] || return 0
  [ "$(fg_group "$pane")" = "$group" ] && return 0
  kill -0 -- "-$group" 2>/dev/null && end_group "$group"
  label=$(printf '%s' "$2" | json 'd.get("agent") or ""')
  forget_typed "$1" "$pane" "$label"
  return 1
}

START_FAIL_ERR="" START_FAIL_MARKER=""
start_failed() {  # start_failed <exit> <reason>: the reason in --err, the exited marker landed
  [ -n "$START_FAIL_ERR" ] && printf 'host: %s\n' "$2" >> "$START_FAIL_ERR" 2>/dev/null
  [ -n "$START_FAIL_MARKER" ] && touch "$START_FAIL_MARKER" 2>/dev/null
  echo "host: $2" >&2
  exit "$1"
}

start_cmd() {
  local agent=${1:-} cwd=${2:-} label="" exited="" err="" envfile="" timeout="" typed="" nosession=0 bad="" v
  local setenv=()
  [ $# -ge 2 ] && shift 2 || set --
  while [ $# -gt 0 ]; do
    case $1 in
      --label|--exited|--err|--env-file|--timeout|--env|--typed)
        [ $# -ge 2 ] || { bad="$1 needs a value"; break; }
        case $1 in
          --label) label=$2 ;; --exited) exited=$2 ;; --err) err=$2 ;; --env-file) envfile=$2 ;; --timeout) timeout=$2 ;;
          --typed) typed=$2 ;;
          --env) case $2 in [A-Za-z_]*=*) setenv+=("$2") ;; *) bad="--env takes KEY=VALUE, not $2"; break ;; esac ;;
        esac
        shift ;;
      --no-session) nosession=1 ;;
      --) shift; break ;;
      *) bad="unknown option for start: $1 (the kind and its arguments go after --)"; set --; break ;;
    esac
    shift
  done
  abs() { case $1 in ""|/*) printf '%s' "$1" ;; *) printf '%s/%s' "$PWD" "$1" ;; esac; }
  exited=$(abs "$exited"); err=$(abs "$err"); envfile=$(abs "$envfile")
  START_FAIL_ERR=$err START_FAIL_MARKER=$exited
  [ -n "$err" ] && : > "$err" 2>/dev/null
  [ -z "$bad" ] || start_failed 1 "$bad"
  [ -n "$agent" ] && [ -n "$cwd" ] && [ $# -ge 1 ] || start_failed 1 "usage: host.sh start <agent> <cwd> [options] -- <kind> <args...>"
  [ -d "$cwd" ] || start_failed 1 "no such directory: $cwd"
  [ -z "$envfile" ] || [ -r "$envfile" ] || start_failed 1 "env file not readable: $envfile"
  [ -z "$timeout" ] || timeout=$(count "$timeout" "--timeout") || start_failed 1 "--timeout must be a whole number of seconds"
  local claim_wait session_wait kind=$1; shift
  claim_wait=$(count "${POSTMASTER_HOST_CLAIM_WAIT:-20}" POSTMASTER_HOST_CLAIM_WAIT) || start_failed 1 "POSTMASTER_HOST_CLAIM_WAIT"
  session_wait=$(count "${POSTMASTER_HOST_SESSION_WAIT:-20}" POSTMASTER_HOST_SESSION_WAIT) || start_failed 1 "POSTMASTER_HOST_SESSION_WAIT"
  local h; h=$(detect)
  [ "$h" = herdr ] || start_failed 3 "live agents need Herdr, and the session host here is $h"
  agent=$(handle_of "$agent"); cwd=$(CDPATH= cd -P -- "$cwd" && pwd -P); label=$(clean "${label:-$agent}")
  [ -z "$(agent_json "$agent")" ] || start_failed 1 "a live agent is already named $agent"
  [ -n "$exited" ] && rm -f -- "$exited"            # never an earlier agent's

  # A fresh tab in the worktree's space, as run places a launch, whose shell hands over to a
  # bash on the pane's own environment, the caller's POSTMASTER_ settings, the env file and each
  # --env: the settings through a FIFO and never a command line, and the user's shell startup
  # files not at all, so the agent runs in exactly the form it was given.
  local placed space tab pane spec i=0
  placed=$(herdr_place "$label" "$cwd") || start_failed 1 "Herdr could not open a tab for $agent in $cwd"
  read -r space tab pane <<< "$placed"
  spec=$(mktemp -d "${TMPDIR:-/tmp}/postmaster-host.XXXXXX") || start_failed 1 "cannot make a spec directory"
  printf '%s' "$cwd" > "$spec/cwd"; printf '%s' "$envfile" > "$spec/envfile"
  printf '%s\0' ${setenv[@]+"${setenv[@]}"} > "$spec/setenv"
  mkfifo "$spec/env" && start_env_writer "$spec/env"
  herdr pane run "$pane" " exec $(q "$SELF") _shell $(q "$spec")" >/dev/null 2>&1 \
    || { drop_spec "$spec"; start_failed 1 "Herdr could not run the shell for $agent in pane $pane"; }
  while [ -d "$spec" ] && [ $i -lt $((claim_wait * 4)) ]; do sleep 0.25; i=$((i + 1)); done
  if [ -d "$spec" ]; then
    mkdir "$spec/claimed" 2>/dev/null && drop_spec "$spec"
    start_failed 1 "the pane for $agent did not take its shell within ${claim_wait}s"
  fi
  i=0                                                 # until the handed-over shell is at its prompt
  until herdr pane process-info --pane "$pane" 2>/dev/null | python3 -c 'import json, sys
p = json.load(sys.stdin)["result"]["process_info"]
f = p.get("foreground_processes") or [{}]
sys.exit(0 if f[0].get("argv") == ["bash", "--noprofile", "--norc", "-i"] and p.get("foreground_process_group_id") == p.get("shell_pid") else 1)' 2>/dev/null; do
    [ $i -lt $((claim_wait * 4)) ] || start_failed 1 "the shell for $agent never reached its prompt in pane $pane"
    sleep 0.25; i=$((i + 1))
  done

  local out code="" screen group session="null" line w title ready_wait
  if [ -n "$typed" ]; then
    # A harness Herdr has no agent kind for: its command typed into the shell, ready once it has
    # titled the terminal as it does when it takes input, then reported to Herdr under its name.
    line=""; for w in "$kind" "$@"; do line+="$(q "$w") "; done
    herdr pane run "$pane" "${line% }" >/dev/null 2>&1 || start_failed 1 "Herdr could not type the command for $agent into pane $pane"
    ready_wait=${timeout:-60}; i=0
    while :; do
      title=$(herdr pane get "$pane" 2>/dev/null | json 'd["result"]["pane"].get("terminal_title_stripped") or ""' 2>/dev/null)
      printf '%s' "$title" | grep -Eq -- "$typed" && break
      group=$(fg_group "$pane")
      if [ -z "$group" ] && [ $i -ge 8 ]; then
        start_failed 1 "$agent exited before it was ready: $(herdr pane read "$pane" --source visible --lines 40 2>/dev/null | grep -v '^[[:space:]]*$' | tail -6 | tr -s ' ' | tr '\n' ' ')"
      fi
      if [ $i -ge $((ready_wait * 4)) ]; then
        screen=$(herdr pane read "$pane" --source visible --lines 40 2>/dev/null | grep -v '^[[:space:]]*$' | tail -8 | tr -s ' ')
        [ -n "$group" ] && end_group "$group"
        start_failed 4 "$agent never set a terminal title matching $typed within ${ready_wait}s, so it was ended: $(printf '%s' "$screen" | tr '\n' ' ')"
      fi
      sleep 0.25; i=$((i + 1))
    done
    group=$(fg_group "$pane")
    [ -n "$group" ] || start_failed 1 "$agent set its title, but no process of its own is in its pane's foreground"
    herdr pane report-agent "$pane" --source "$SOURCE" --agent "$kind" --state idle --seq "$(seq_now)" >/dev/null 2>&1
    if ! herdr agent rename "$pane" "$agent" >/dev/null 2>&1; then
      end_group "$group"; start_failed 1 "Herdr could not name the agent in pane $pane $agent"
    fi
    herdr pane report-metadata "$pane" --source "$META" --title "$label" --token postmaster=launch --token input=typed \
      --token pgid="$group" >/dev/null 2>&1
  else
    i=0
    # Herdr takes a moment to see the new shell at its prompt; until it does, the pane is busy.
    while ! out=$(herdr agent start "$agent" --kind "$kind" --pane "$pane" ${timeout:+--timeout "$((timeout * 1000))"} -- "$@" 2>&1 >/dev/null); do
      code=$(printf '%s' "$out" | json 'd["error"]["code"]' 2>/dev/null)
      [ "$code" = agent_pane_busy ] && [ $i -lt $((claim_wait * 2)) ] || break
      sleep 0.5; i=$((i + 1)); code=""
    done
    if [ -n "$code" ]; then
      screen=$(herdr agent read "$agent" --source visible --lines 40 2>/dev/null | grep -v '^[[:space:]]*$' | tail -8 | tr -s ' ')
      group=$(fg_group "$pane"); [ -n "$group" ] && end_group "$group"
      case $code in
        agent_not_ready) start_failed 4 "$agent stopped at a question before taking any work, so it was ended: $(printf '%s' "$screen" | tr '\n' ' ')" ;;
        *) start_failed 1 "herdr could not start $agent: ${code:-$out}" ;;
      esac
    fi
    group=$(fg_group "$pane")
    [ -n "$group" ] || start_failed 1 "$agent started, but no process of its own is in its pane's foreground"
  fi
  reg_add "$group" "$cwd" "$label"
  [ -n "$exited" ] && watch_exit "$group" "$exited"

  # The integration's session report is where the thread id comes from; a harness that sends
  # none is not running with its integration, and cannot be resumed. With --no-session the caller
  # reads the thread from the harness's own records instead.
  i=0
  while [ "$nosession" = 0 ]; do
    session=$(agent_json "$agent" | python3 -c 'import json, sys
s = (json.loads(sys.stdin.read() or "{}").get("agent_session") or {})
if s.get("value"): print(json.dumps({"kind": s.get("kind"), "value": s["value"]}))' 2>/dev/null)
    [ -n "$session" ] && break
    if [ $i -ge $((session_wait * 4)) ]; then
      end_group "$group"
      start_failed 5 "$agent started, but its $kind integration reported no session within ${session_wait}s, so it was ended; is Herdr's $kind integration installed where it reads its config?"
    fi
    sleep 0.25; i=$((i + 1))
  done
  python3 -c 'import json, sys
print(json.dumps({"host": "herdr", "space": sys.argv[1], "tab": sys.argv[2], "pane": sys.argv[3], "agent": sys.argv[4],
                  "group": int(sys.argv[5]), "session": json.loads(sys.argv[6])}))' "$space" "$tab" "$pane" "$agent" "$group" "$session"
}

# _shell <spec>: the pane's shell, replaced, by one exec after another and nothing forked, since
# Herdr counts a pane with any other process in it as busy. It claims the spec and becomes an
# interactive bash with no startup files, on the pane's own environment, the caller's POSTMASTER_
# settings from the FIFO, the env file, then each --env. Nothing else of the caller's reaches it:
# a caller that is itself a harness session exports its own identity to its children, and claude
# started with claude's writes no session record of its own. Its history goes nowhere.
START_SHELL='import os, signal, sys
spec = sys.argv[1]
def field(n):
    try:
        with open(os.path.join(spec, n)) as f: return f.read()
    except OSError: return ""
cwd, envfile = field("cwd"), field("envfile")
setenv = [kv for kv in field("setenv").split("\0") if "=" in kv]
def late(*a): raise TimeoutError()
signal.signal(signal.SIGALRM, late); signal.alarm(30)
try:
    with open(os.path.join(spec, "env"), "rb") as f: data, ok = f.read(), True
except (OSError, TimeoutError):
    data, ok = b"", False
signal.alarm(0)
for n in ("cwd", "envfile", "setenv", "env"):
    try: os.unlink(os.path.join(spec, n))
    except OSError: pass
for d in (os.path.join(spec, "claimed"), spec):
    try: os.rmdir(d)
    except OSError: pass
login = os.environ.get("SHELL") or "/bin/sh"
if not ok:
    print("host: the environment of the caller never arrived, so no agent starts in this pane")
    os.execv(login, [login])
env = dict(os.environb)
for kv in data.split(b"\0"):
    k, eq, v = kv.partition(b"=")
    if eq and k.startswith(b"POSTMASTER_"): env[k] = v
for k in (b"POSTMASTER_LAUNCH_NAME", b"OLDPWD", b"_"): env.pop(k, None)
env[b"HISTFILE"] = b"/dev/null"; env[b"PWD"] = cwd.encode()
try:
    os.chdir(cwd)
except OSError:
    print("host: cannot enter %s" % cwd); os.execv(login, [login])
argv = ["bash", "--noprofile", "--norc", "-i"]
if envfile or setenv:
    argv = ["bash", "-c", "if [ -n \"$1\" ]; then set -a; . \"$1\"; set +a; fi; shift; for kv in \"$@\"; do export \"$kv\"; done; "
            "exec bash --noprofile --norc -i", "live-agent", envfile] + setenv
os.execvpe("bash", argv, env)'
live_shell() {
  local spec=$1
  if ! mkdir "$spec/claimed" 2>/dev/null; then
    echo "host: this shell was handed over elsewhere; nothing to do here."; exec "${SHELL:-/bin/sh}"
  fi
  exec python3 -c "$START_SHELL" "$spec"
}

prompt_cmd() {  # prompt <agent> <file> [--timeout <seconds>] [--no-wait]
  local agent=${1:-} file=${2:-} secs="" nowait=0 rec st out rc code pane label
  [ -n "$agent" ] && [ -n "$file" ] || die "usage: host.sh prompt <agent> <file> [--timeout <seconds>] [--no-wait]"
  shift 2
  while [ $# -gt 0 ]; do
    case $1 in
      --timeout) secs=$(count "${2:-}" seconds) || exit 1; shift ;;
      --no-wait) nowait=1 ;;
      *) die "unknown option for prompt: $1" ;;
    esac
    shift
  done
  [ -f "$file" ] && [ -s "$file" ] || die "no such file, or it is empty: $file"
  need_herdr
  agent=$(handle_of "$agent")
  rec=$(agent_json "$agent")
  [ -n "$rec" ] && typed_alive "$agent" "$rec" || { echo '{"outcome": "gone"}'; return 6; }
  st=$(printf '%s' "$rec" | json 'd.get("agent_status")')
  pane=$(printf '%s' "$rec" | json 'd.get("pane_id")')
  if [ -n "$(typed_group "$pane")" ]; then
    # A typed agent: its text pasted into its pane and entered, and Herdr told it is working.
    label=$(printf '%s' "$rec" | json 'd.get("agent") or ""')
    herdr pane report-agent "$pane" --source "$SOURCE" --agent "$label" --state working --seq "$(seq_now)" >/dev/null 2>&1
    if herdr pane send-text "$pane" "$(cat "$file")" >/dev/null 2>&1 && sleep 0.3 && herdr pane send-keys "$pane" enter >/dev/null 2>&1; then
      echo '{"outcome": "sent"}'; return 0
    fi
    echo '{"outcome": "error", "code": "send"}'; echo "host: Herdr could not type into pane $pane for $agent" >&2; return 1
  fi
  if [ "$nowait" = 1 ]; then
    out=$(herdr agent prompt "$agent" "$(cat "$file")" ${secs:+--timeout "$((secs * 1000))"} 2>&1); rc=$?
    [ $rc -eq 0 ] && { echo '{"outcome": "sent"}'; return 0; }
  else
    # Only to an agent that has settled: sent to one still working, Herdr's wait can match the end
    # of the turn already running.
    case $st in idle|done) ;; *) printf '{"outcome": "not settled", "status": "%s"}\n' "$st"; return 3 ;; esac
    out=$(herdr agent prompt "$agent" "$(cat "$file")" --wait ${secs:+--timeout "$((secs * 1000))"} 2>&1); rc=$?
    if [ $rc -eq 0 ]; then
      st=$(printf '%s' "$out" | json 'd["result"]["agent"]["agent_status"]' 2>/dev/null)
      printf '{"outcome": "settled", "status": "%s"}\n' "$st"; return 0
    fi
  fi
  code=$(printf '%s' "$out" | json 'd["error"]["code"]' 2>/dev/null)
  case $code in
    agent_prompt_stalled) echo '{"outcome": "stalled"}'; return 4 ;;
    timeout) echo '{"outcome": "timeout"}'; return 5 ;;
    agent_not_found) echo '{"outcome": "gone"}'; return 6 ;;
    agent_blocked) echo '{"outcome": "not settled", "status": "blocked"}'; return 3 ;;
    *) printf '{"outcome": "error", "code": "%s"}\n' "${code:-unknown}"; echo "host: herdr could not prompt $agent: ${code:-$out}" >&2; return 1 ;;
  esac
}

state_cmd() {  # state <agent>
  local agent=${1:-} rec
  [ -n "$agent" ] || die "usage: host.sh state <agent>"
  need_herdr
  agent=$(handle_of "$agent")
  rec=$(agent_json "$agent")
  [ -n "$rec" ] && typed_alive "$agent" "$rec" || { echo '{"status": "gone"}'; return 6; }
  printf '%s' "$rec" | python3 -c 'import json, sys
a = json.load(sys.stdin); s = a.get("agent_session") or {}
print(json.dumps({"status": a.get("agent_status"), "pane": a.get("pane_id"),
                  "session": {"kind": s.get("kind"), "value": s.get("value")} if s.get("value") else None}))'
}

report_cmd() {  # report <agent> idle|working: what Herdr shows for a typed agent
  local agent=${1:-} state=${2:-} rec pane
  case $state in idle|working) ;; *) die "usage: host.sh report <agent> idle|working" ;; esac
  need_herdr
  agent=$(handle_of "$agent")
  rec=$(agent_json "$agent")
  [ -n "$rec" ] && typed_alive "$agent" "$rec" || { echo "no live agent is named $agent" >&2; return 6; }
  pane=$(printf '%s' "$rec" | json 'd.get("pane_id")')
  [ -n "$(typed_group "$pane")" ] || return 0            # Herdr follows an agent it started itself
  herdr pane report-agent "$pane" --source "$SOURCE" --agent "$(printf '%s' "$rec" | json 'd.get("agent") or ""')" \
    --state "$state" --seq "$(seq_now)" >/dev/null 2>&1
}

end_cmd() {  # end <agent>: only an agent in a pane host.sh opened
  local agent=${1:-} rec pane tokens group typed label
  [ -n "$agent" ] || die "usage: host.sh end <agent>"
  need_herdr
  agent=$(handle_of "$agent")
  rec=$(agent_json "$agent")
  [ -n "$rec" ] || { echo "no live agent is named $agent"; return 0; }
  pane=$(printf '%s' "$rec" | json 'd.get("pane_id")')
  tokens=$(pane_tokens "$pane")
  [ "$(printf '%s' "$tokens" | json 'd.get("postmaster")' 2>/dev/null)" = launch ] || die "$agent runs in pane $pane, which host.sh did not open; not ending it"
  typed=$(typed_group "$pane")
  group=$(fg_group "$pane")
  [ -n "$group" ] && end_group "$group"
  if [ -n "$typed" ]; then                              # and whatever its launcher left in its group
    label=$(printf '%s' "$rec" | json 'd.get("agent") or ""')
    kill -0 -- "-$typed" 2>/dev/null && end_group "$typed"
    forget_typed "$agent" "$pane" "$label"
  fi
  echo "ended $agent"
}

# --- tests --------------------------------------------------------------------------------
test_setup() {  # a scratch repository with worktrees, and the commands the tests launch
  tmp=$(mktemp -d) || exit 1
  fails=0
  repo=$tmp/hosttest-$$
  git init -q -b main "$repo" && git -C "$repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m first || exit 1
  local w; for w in T-1-luna T-1-sol; do git -C "$repo" worktree add -q ".worktrees/$w" -b "wb/$w" || exit 1; done
  git -C "$repo" worktree add -q --detach .worktrees/T-1-rev-luna || exit 1
  repo=$(CDPATH= cd -P -- "$repo" && pwd -P); rname=$(basename "$repo")
  clone=$repo/.worktrees/T-1-rev-security-opus   # a reviewer's scratch clone
  "$HERE/cut-scratch.sh" "$repo" "$repo" "$clone" "$(git -C "$repo" rev-parse HEAD)" --clone main >/dev/null 2>&1 || exit 1
  mkdir -p "$tmp/caller" "$tmp/logs" "$tmp/run-1"
  cat > "$tmp/caller/fixed.sh" <<'EOF'
#!/usr/bin/env bash
printf '{"type":"system","subtype":"init","session_id":"fixed-1","model":"m"}\n'
printf '{"type":"assistant","message":{"content":[{"type":"text","text":"step one"}]}}\n'
printf 'a line on stderr\n' >&2
sleep "${EMIT_SLEEP:-0}"
printf '{"type":"result","subtype":"success","num_turns":1}\n'
exit 3
EOF
  cat > "$tmp/caller/probe.sh" <<'EOF'
#!/usr/bin/env bash
printf '{"type":"system","subtype":"init","session_id":"probe-1","model":"m"}\n'
if (: < /dev/tty) 2>/dev/null; then tty=yes; else tty=no; fi
printf 'from=%s|name=%s|pane=%s|tmuxpane=%s|var=%s|sid=%s|pid=%s|pgid=%s|tty=%s\n' "$PWD" "${POSTMASTER_LAUNCH_NAME:-}" \
  "${HERDR_PANE_ID:-unset}" "${TMUX_PANE:-unset}" "${CALLER_VAR:-unset}" "$(python3 -c 'import os; print(os.getsid(0))')" "$$" \
  "$(python3 -c 'import os; print(os.getpgid(0))')" "$tty"
echo x >> "${COUNT:-/dev/null}"
sleep "${EMIT_SLEEP:-0}"
EOF
  chmod +x "$tmp/caller/fixed.sh" "$tmp/caller/probe.sh"
  # A waybill whose title is written to break any shell it is typed into.
  cat > "$tmp/run-1/brief.md" <<EOF
# Waybill: 1

## Ticket
name: not this one

## Dispatch
name: #1, Stop \`touch $tmp/canary\` \$(touch $tmp/canary) "breaking" a shell
dispatch: $tmp/run-1
EOF
  NAME=$("$SELF" name "$tmp/run-1" luna)
}
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/         /'; fails=$((fails+1)); }
check() { if eval "$2"; then ok "$1"; else fail "$1" "${3:-}"; fi; }   # check <label> <test> [<detail>]
marker() {  # marker <file> [<seconds>]: wait for a marker to land
  local i=0; while [ ! -e "$1" ] && [ $i -lt $(( ${2:-30} * 5 )) ]; do sleep 0.2; i=$((i + 1)); done; [ -e "$1" ]
}
field() { tr '|' '\n' < "$1" | sed -n "s/^$2=//p" | head -1; }   # field <probe output> <key>
finish() {
  echo
  [ "$fails" -eq 0 ] && { echo "$1: all controls behaved"; return 0; }
  echo "$1: $fails control(s) misbehaved"; return 1
}

write_stubs() {  # write_stubs <dir>: a stub herdr and tmux, which keep their state under $STUB and
  # reach no live server; the live-agent tests of live.sh use them too
  cat > "$1/herdr" <<'EOF'
#!/usr/bin/env python3
import fcntl, glob, json, os, re, shlex, signal, subprocess, sys, time
from datetime import datetime, timezone
S = os.environ["STUB"]; a = sys.argv[1:]
with open(os.path.join(S, "herdr.calls"), "a") as f: f.write("\t".join(a) + "\n")
if os.path.exists(os.path.join(S, "herdr.down")): sys.exit(1)
if a == ["agent"]: print("herdr agent commands:\n  kinds: pi|claude|codex"); sys.exit(2)
lock = open(os.path.join(S, "herdr.lock"), "w"); fcntl.flock(lock, fcntl.LOCK_EX)
path = os.path.join(S, "herdr.json")
st = json.load(open(path)) if os.path.exists(path) else {"n": 0, "spaces": {}, "panes": {}, "open": {}, "agents": [], "live": {}}
st.setdefault("typed", {})
def save(): json.dump(st, open(path, "w"))
def new(prefix): st["n"] += 1; return "%s%d" % (prefix, st["n"])
def opt(name): return a[a.index(name) + 1] if name in a else None
def tokens(): return dict(a[i + 1].split("=", 1) for i in range(len(a) - 1) if a[i] == "--token")
def out(obj): print(json.dumps({"id": "stub", "result": obj}))
def error(code): print(json.dumps({"error": {"code": code, "message": code}}), file=sys.stderr); sys.exit(1)
def flag(name): return os.path.exists(os.path.join(S, name))
def git(*args): return subprocess.run(["git", *args], capture_output=True, text=True).stdout.strip()
def main_of(d):
    c = git("-C", d, "rev-parse", "--path-format=absolute", "--git-common-dir")
    return os.path.realpath(os.path.dirname(c)) if c else None
def space(label, cwd):
    ws, tab, pane = new("w"), new("t"), new("p")
    st["spaces"][ws] = {"label": label, "tokens": {}, "panes": [pane]}; st["panes"][pane] = {"ws": ws, "tokens": {}, "cwd": cwd}
    return {"workspace": {"workspace_id": ws}, "tab": {"tab_id": tab}, "root_pane": {"pane_id": pane}}
def alive(pid):
    try: os.kill(pid, 0); return True
    except ProcessLookupError: return False
    except PermissionError: return True
def pane_env(pane):   # what the pane's shell had when it reached its prompt: `env` output, one line each
    p = os.path.join(S, "pane-%s.env" % pane)
    return dict(l.split("=", 1) for l in open(p).read().splitlines() if "=" in l) if os.path.exists(p) else {}
def live_agent(name):
    v = st["live"].get(name)
    if v and not alive(v["pgid"]) and not v.get("typed"):   # released: its name goes with it
        del st["live"][name]; st["agents"] = [n for n in st["agents"] if n != name]; save(); v = None
    return v                                                 # a typed agent's name stays until cleared
def typed_in(pane):
    t = st["typed"].get(pane)
    return t if t and alive(t["pgid"]) else None
def fake_agent():   # a process standing in for a harness, in a process group of its own; with
    # typed.straggler, a launcher whose child stays in its group when the launcher alone is ended
    argv = (["sleep", "0"] if flag("typed.dies") else ["bash", "-c", "sleep 120 & wait"] if flag("typed.straggler")
            else ["sleep", "120"])
    proc = subprocess.Popen(argv, start_new_session=True,
                            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    with open(os.environ.get("STUB_PIDS") or os.path.join(S, "fake.pids"), "a") as f: f.write("%d\n" % proc.pid)
    return proc.pid
def stamp(): return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
def append(rec, *lines):
    os.makedirs(os.path.dirname(rec), exist_ok=True)
    with open(rec, "a") as f:
        for line in lines: f.write(json.dumps(line) + "\n")
def turn(v, text):
    """A turn as a harness takes it: STUB_RUN lines run, STUB_KILL kills it mid-turn, and the
    command its finish instruction names runs last, unless STUB_NOFINISH. Returns False if killed."""
    for line in text.splitlines():
        if line.startswith("STUB_RUN="): subprocess.run(["bash", "-c", line[9:]], cwd=v["cwd"])
    if "STUB_KILL" in text:
        os.killpg(v["pgid"], signal.SIGTERM)
        for _ in range(40):
            if not alive(v["pgid"]): break
            time.sleep(0.05)
        return False
    m = re.search(r"your very last command: (.+)$", text, re.M)
    if m and "STUB_NOFINISH" not in text: subprocess.run(["bash", "-c", m.group(1)], cwd=v["cwd"])
    return True
def mimo_turn(t, text):   # MiMo's session list and its export, where the stub mimo reads them
    data = t["env"].get("XDG_DATA_HOME") or S
    os.makedirs(data, exist_ok=True)
    now = int(time.time() * 1000)
    if not t.get("session"):
        t["session"] = "ses_stub%d" % t["pgid"]
        lst = os.path.join(data, "sessions.json")
        sessions = json.load(open(lst)) if os.path.exists(lst) else []
        sessions.append({"id": t["session"], "directory": t["cwd"], "created": now})
        json.dump(sessions, open(lst, "w"))
    exp = os.path.join(data, t["session"])
    d = json.load(open(exp)) if os.path.exists(exp) else {"info": {"id": t["session"]}, "messages": []}
    d["messages"].append({"info": {"role": "user", "time": {"created": now}}, "parts": [{"type": "text", "text": text}]})
    json.dump(d, open(exp, "w"))
    if not turn(t, text): return
    d["messages"].append({"info": {"role": "assistant", "finish": "stop", "time": {"created": now + 1, "completed": now + 2}},
                          "parts": [{"type": "text", "text": "OK."}]})
    json.dump(d, open(exp, "w"))
cmd = " ".join(a[:2])
if cmd == "workspace list": out({"workspaces": [{"workspace_id": w} for w in st["spaces"]]})
elif cmd == "worktree list":
    cwd = opt("--cwd"); root = main_of(cwd)
    if not root: sys.exit(1)
    wts = []
    for block in git("-C", cwd, "worktree", "list", "--porcelain").split("\n\n"):
        p = os.path.realpath(block.splitlines()[0].split(" ", 1)[1])
        w = {"path": p, "is_linked_worktree": p != root}
        if p in st["open"]: w["open_workspace_id"] = st["open"][p]
        wts.append(w)
    src = {"repo_root": root, "repo_name": os.path.basename(root)}
    if root in st["open"]: src["source_workspace_id"] = st["open"][root]
    out({"source": src, "worktrees": wts})
elif cmd == "workspace create":
    cwd = os.path.realpath(opt("--cwd")); r = space(opt("--label"), cwd)
    if main_of(cwd) == cwd: st["open"][cwd] = r["workspace"]["workspace_id"]
    save(); out(r)
elif cmd == "worktree open":
    cwd = os.path.realpath(opt("--path")); r = space(opt("--label"), cwd); st["open"][cwd] = r["workspace"]["workspace_id"]
    save(); out(r)
elif cmd == "tab create":
    ws = opt("--workspace"); tab, pane = new("t"), new("p")
    st["spaces"][ws]["panes"].append(pane); st["panes"][pane] = {"ws": ws, "tokens": {}, "cwd": os.path.realpath(opt("--cwd") or S)}
    save(); out({"tab": {"tab_id": tab}, "root_pane": {"pane_id": pane}})
elif cmd == "workspace report-metadata": st["spaces"][a[2]]["tokens"] = tokens(); save()
elif cmd == "pane report-metadata": st["panes"][a[2]]["tokens"] = tokens(); save()
elif cmd == "workspace get":
    out({"workspace": {"workspace_id": a[2], "tokens": st["spaces"][a[2]]["tokens"]}})
elif cmd == "pane list":
    out({"panes": [{"pane_id": p, "tokens": st["panes"][p]["tokens"]} for p in st["spaces"][opt("--workspace")]["panes"]]})
elif cmd == "pane get":
    pv = st["panes"].get(a[2], {}); t = typed_in(a[2]); r = pv.get("reported") or {}
    out({"pane": {"pane_id": a[2], "agent": r.get("agent"), "agent_status": r.get("state") or "unknown", "tokens": pv.get("tokens", {}),
                  "terminal_title_stripped": (t or {}).get("title")}})
elif cmd == "pane report-agent":
    st["panes"][a[2]]["reported"] = {"agent": opt("--agent"), "state": opt("--state")}; save()
elif cmd == "pane release-agent": st["panes"][a[2]].pop("reported", None); save()
elif cmd == "pane send-text":
    t = typed_in(a[2])
    if t: t["pending"] = t.get("pending", "") + a[3]; save()
elif cmd == "pane send-keys":
    t = typed_in(a[2])
    if t and a[3] == "enter" and t.get("pending") and not flag("typed.deaf"):
        text, t["pending"] = t["pending"], ""
        with open(os.path.join(S, "prompts.log"), "a") as f: f.write(json.dumps({"pane": a[2], "text": text}) + "\n")
        save(); fcntl.flock(lock, fcntl.LOCK_UN)
        mimo_turn(t, text)
        fcntl.flock(lock, fcntl.LOCK_EX); st2 = json.load(open(path)); st2["typed"][a[2]] = t; json.dump(st2, open(path, "w"))
elif cmd == "agent rename":
    if "--clear" in a:
        st["live"].pop(a[2], None); st["agents"] = [n for n in st["agents"] if n != a[2]]
    else:
        t = typed_in(a[2])
        if not t: error("agent_not_found")
        st["live"][a[3]] = {"pane": a[2], "pgid": t["pgid"], "kind": t["argv"][0], "args": t["argv"][1:], "cwd": t["cwd"],
                            "record": None, "session": None, "env": t["env"], "typed": True}
        st["agents"].append(a[3])
    save()
elif cmd == "pane run" and pane_env(a[2]) and not flag("pane.dead"):
    # A shell at its prompt runs what is typed into it: a typed agent, which titles its terminal
    # once it takes input.
    env, argv = pane_env(a[2]), shlex.split(a[3])
    st["typed"][a[2]] = {"pgid": fake_agent(), "argv": argv, "cwd": env.get("PWD") or st["panes"][a[2]]["cwd"],
                         "env": env, "title": "" if flag("typed.notitle") else "MiMoCode", "pending": "",
                         "session": argv[argv.index("-s") + 1] if "-s" in argv[:-1] else None}
    save()
elif cmd == "pane run":
    pane, text, ws = a[2], a[3], st["panes"][a[2]]["ws"]
    fcntl.flock(lock, fcntl.LOCK_UN)
    if flag("pane.dead"): sys.exit(0)                     # accepted, never run
    late = "sleep 5; " if flag("pane.late") else ""
    env = {"PATH": os.environ["PATH"], "HOME": os.environ.get("HOME", "/"), "STUB": S, "HERDR_ENV": "1",
           "HERDR_PANE_ID": pane, "HERDR_TAB_ID": "tab-of-" + pane, "HERDR_WORKSPACE_ID": ws, "TERM": "stub-term"}
    proc = subprocess.Popen(["bash", "-c", late + text], env=env, stdin=subprocess.PIPE, start_new_session=True,
                            stdout=open(os.path.join(S, "pane-%s.out" % pane), "ab"), stderr=subprocess.STDOUT)
    open(os.path.join(S, "pane-%s.pid" % pane), "w").write(str(proc.pid))
    # A shell that reaches an interactive prompt in this pane reads this: it records what it has.
    proc.stdin.write(("env > '%s'\n" % os.path.join(S, "pane-%s.env" % pane)).encode()); proc.stdin.close()
elif cmd == "pane process-info":
    pane = opt("--pane"); pf = os.path.join(S, "pane-%s.pid" % pane)
    shell = int(open(pf).read()) if os.path.exists(pf) else 1
    ag = next((v for n, v in list(st["live"].items()) if v["pane"] == pane and live_agent(n) and alive(v["pgid"])), None)
    t = typed_in(pane)
    if t: fg, procs = t["pgid"], [{"pid": t["pgid"], "argv": t["argv"], "name": t["argv"][0]}]
    elif ag: fg, procs = ag["pgid"], [{"pid": ag["pgid"], "argv": [ag["kind"]] + ag["args"], "name": ag["kind"]}]
    elif pane_env(pane): fg, procs = shell, [{"pid": shell, "argv": ["bash", "--noprofile", "--norc", "-i"], "name": "bash"}]
    else: fg, procs = shell, [{"pid": shell, "argv": ["bash"], "name": "bash"}]
    out({"process_info": {"pane_id": pane, "shell_pid": shell, "foreground_process_group_id": fg, "foreground_processes": procs}})
elif cmd == "agent get":
    v = live_agent(a[2])
    if not v: error("agent_not_found")
    sf = os.path.join(S, "agent-%s.status" % a[2])
    reported = (st["panes"].get(v["pane"], {}).get("reported") or {}).get("state") if v.get("typed") else None
    status = open(sf).read().strip() if os.path.exists(sf) else (reported or ("blocked" if flag("agent.blocked") else "idle"))
    out({"agent": {"name": a[2], "agent": v["kind"], "agent_status": status, "pane_id": v["pane"], "agent_session": v["session"]}})
elif cmd == "agent start":
    name, kind, pane = a[2], opt("--kind"), opt("--pane")
    if live_agent(name): error("agent_name_taken")
    args = a[a.index("--") + 1:] if "--" in a else []
    env = pane_env(pane); cwd = env.get("PWD") or st["panes"].get(pane, {}).get("cwd") or S
    pgid = fake_agent()
    # The session the harness's integration would report, and where the harness would keep it.
    sid = "%08x-0000-4000-8000-%012x" % (st["n"] + 1, pgid); st["n"] += 1
    home = env.get("HOME") or S
    session = None
    if kind in ("codex", "muse"):
        # Neither reports a session: codex begins its rollout at its first prompt, muse its
        # session.jsonl as it starts, each named by a UUIDv7 that carries its time.
        sid = "%012x-7000-8000-%012x" % (int(time.time() * 1000), pgid); sid = sid[:8] + "-" + sid[8:]
        if "resume" in args: sid = args[args.index("resume") + 1]
        if kind == "codex":
            base = os.path.join(env.get("CODEX_HOME") or os.path.join(home, ".codex"), "sessions")
            rec = (glob.glob(os.path.join(base, "*", "*", "*", "*%s.jsonl" % sid)) or
                   [os.path.join(base, "2026", "01", "01", "rollout-2026-01-01T00-00-00-%s.jsonl" % sid)])[0]
        else:
            base = os.path.join(env.get("XDG_DATA_HOME") or os.path.join(home, ".local", "share"), "muse", "sessions")
            rec = (glob.glob(os.path.join(base, "*", "*", "*", sid, "session.jsonl")) or
                   [os.path.join(base, "2026", "01", "01", sid, "session.jsonl")])[0]
            if not os.path.exists(rec):
                append(rec, {"payload_type": "session.opened.observed", "payload": {"session_id": sid}})
    elif kind == "pi":
        base = env.get("PI_CODING_AGENT_DIR") or os.path.join(home, ".pi", "agent")
        ref = args[args.index("--session") + 1] if "--session" in args else None
        if ref and not ref.endswith(".jsonl"):
            ref = (glob.glob(os.path.join(base, "sessions", "*", "*_%s.jsonl" % ref)) or [None])[0]
        rec = ref or os.path.join(base, "sessions", "--stub--", "2026-01-01T00-00-00-000Z_%s.jsonl" % sid)
        session = {"agent": "pi", "kind": "path", "source": "herdr:pi", "value": rec}
    else:
        if "--resume" in args: sid = args[args.index("--resume") + 1]
        base = env.get("CLAUDE_CONFIG_DIR") or os.path.join(home, ".claude")
        rec = os.path.join(base, "projects", re.sub(r"[^A-Za-z0-9]", "-", cwd), sid + ".jsonl")
        session = {"agent": kind, "kind": "id", "source": "herdr:" + kind, "value": sid}
    st["agents"].append(name)
    st["live"][name] = {"pane": pane, "pgid": pgid, "kind": kind, "args": args, "cwd": cwd, "record": rec,
                        "session": None if flag("agent.nosession") else session, "env": env}
    save()
    if flag("agent.notready"): error("agent_not_ready")
    out({"agent": {"name": name, "agent_status": "idle", "pane_id": pane}})
elif cmd == "agent prompt":
    name, text = a[2], a[3]
    v = live_agent(name)
    if not v: error("agent_not_found")
    if v.get("typed"): error("agent_not_ready")                      # Herdr prompts only agents it started
    if flag("prompt.blocked"): error("agent_blocked")
    fcntl.flock(lock, fcntl.LOCK_UN)
    def record(line):
        os.makedirs(os.path.dirname(v["record"]), exist_ok=True)
        with open(v["record"], "a") as f: f.write(json.dumps(line) + "\n")
    with open(os.path.join(S, "prompts.log"), "a") as f: f.write(json.dumps({"agent": name, "text": text}) + "\n")
    if flag("prompt.dropped"): error("agent_prompt_stalled")          # never reached the harness
    # Each turn goes in the record in its harness's shape: pi's messages, claude's entries, codex's
    # rollout events or muse's run events.
    kind = v["kind"]
    if kind == "codex" and not os.path.exists(v["record"]):
        record({"type": "session_meta", "payload": {"id": re.search(r"([0-9a-f-]{36})\.jsonl$", v["record"]).group(1),
                                                    "timestamp": stamp(), "cwd": v["cwd"], "originator": "codex-tui"}})
    record({"type": "message", "message": {"role": "user", "content": [{"type": "text", "text": text}]}} if kind == "pi"
           else {"type": "event_msg", "payload": {"type": "task_started"}} if kind == "codex"
           else {"payload_type": "runtime.session", "payload": {"kind": "run", "event": {"kind": "started", "prompt": text}}} if kind == "muse"
           else {"type": "user", "message": {"role": "user", "content": text}})
    if kind == "codex":
        record({"type": "response_item", "payload": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": text}]}})
    finished = turn(v, text)
    if flag("prompt.stalled"): error("agent_prompt_stalled")          # ran at once, and no turn was seen
    if not finished:                                                 # killed mid-turn: reported done
        out({"agent": {"name": name, "agent_status": "done"}}); sys.exit(0)
    record({"type": "message", "message": {"role": "assistant", "stopReason": "stop", "content": [{"type": "text", "text": "OK."}]}} if kind == "pi"
           else {"type": "event_msg", "payload": {"type": "task_complete", "last_agent_message": "OK."}} if kind == "codex"
           else {"payload_type": "runtime.session", "payload": {"kind": "run", "event": {"kind": "assistant_message_committed", "text": "OK."}}} if kind == "muse"
           else {"type": "assistant", "message": {"role": "assistant", "stop_reason": "end_turn", "content": [{"type": "text", "text": "OK."}]}})
    if kind == "muse":
        record({"payload_type": "runtime.session", "payload": {"kind": "run", "event": {"kind": "terminal", "terminal": "completed"}}})
    if flag("prompt.timeout"): error("timeout")
    if "--wait" in a: out({"agent": {"name": name, "agent_status": "blocked" if flag("prompt.ends-blocked") else "done"}})
    else: out({})
elif cmd == "agent read": print("stub screen of " + a[2])
elif cmd == "integration status":
    home = os.environ.get("HOME", "/")
    where = {"pi": (os.environ.get("PI_CODING_AGENT_DIR") or home + "/.pi/agent") + "/extensions/herdr-agent-state.ts",
             "claude": (os.environ.get("CLAUDE_CONFIG_DIR") or home + "/.claude") + "/hooks/herdr-agent-state.sh",
             "codex": (os.environ.get("CODEX_HOME") or home + "/.codex") + "/herdr-agent-state.sh",
             "antigravity-cli": home + "/.gemini/config/hooks/herdr-agent-state.sh",
             "grok": home + "/.grok/hooks/herdr-agent-state.sh"}
    for k, p in where.items(): print("%s: %s (%s)" % (k, "current (v1)" if os.path.exists(p) else "not installed", p))
EOF
  cat > "$1/tmux" <<'EOF'
#!/usr/bin/env python3
import fcntl, json, os, subprocess, sys
S = os.environ["STUB"]; a = sys.argv[1:]
with open(os.path.join(S, "tmux.calls"), "a") as f: f.write("\t".join(a) + "\n")
lock = open(os.path.join(S, "tmux.lock"), "w"); fcntl.flock(lock, fcntl.LOCK_EX)
path = os.path.join(S, "tmux.json")
st = json.load(open(path)) if os.path.exists(path) else {"n": 0, "sessions": [], "windows": {}}
def save(): json.dump(st, open(path, "w"))
def opt(name): return a[a.index(name) + 1] if name in a else None
def launch(session):
    st["n"] += 1; win = "@%d" % st["n"]
    st["windows"][win] = {"session": session, "name": opt("-n"), "opts": {}}
    save(); fcntl.flock(lock, fcntl.LOCK_UN)
    env = {"PATH": os.environ["PATH"], "HOME": os.environ.get("HOME", "/"), "STUB": S,
           "TMUX": "/stub/tmux,1,0", "TMUX_PANE": "%%%d" % st["n"]}
    env.update(a[i + 1].split("=", 1) for i in range(len(a) - 1) if a[i] == "-e")
    open(os.path.join(S, "win-%d.env" % st["n"]), "w").write("\n".join("%s=%s" % kv for kv in sorted(env.items())))
    try:
        subprocess.Popen(a[a.index("-c") + 2:], env=env, stdin=subprocess.DEVNULL, start_new_session=True,
                         stdout=open(os.path.join(S, "win-%d.out" % st["n"]), "ab"), stderr=subprocess.STDOUT)
    except OSError:
        pass                                    # a window whose command is missing dies at once
    print(win)
fmt = opt("-F") or ""
if a[0] == "has-session": sys.exit(0 if opt("-t").lstrip("=") in st["sessions"] else 1)
elif a[0] == "new-session": st["sessions"].append(opt("-s")); launch(opt("-s"))
elif a[0] == "new-window": launch(opt("-t").lstrip("=").rstrip(":"))
elif a[0] == "set-option":
    t = opt("-t"); w = t if t in st["windows"] else "@" + t.lstrip("%")
    if w in st["windows"]: st["windows"][w]["opts"][a[-2]] = a[-1]; save()
elif a[0] == "list-windows":
    for w, v in st["windows"].items():
        if "-a" in a: print("%s\t%s" % (w, v["name"]) if "#{window_id}" in fmt else v["name"])
        elif v["session"] == opt("-t").lstrip("="): print("%s\t%s" % (w, v["opts"].get("@postmaster_cwd", "")))
elif a[0] == "capture-pane": print("stub screen")
EOF
  chmod +x "$1/herdr" "$1/tmux"
}

self_test() {
  # Stub hosts on a curated PATH, so no control can reach a live Herdr or tmux server. A stub
  # pane or window runs what it is given with only a server's environment, never the caller's,
  # so the environment a launch sees has to have come through host.sh.
  test_setup
  trap 'while read -r p; do kill -- "-$p" 2>/dev/null; done < "$tmp/fake.pids" 2>/dev/null; rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
  mkdir -p "$tmp/bin" "$tmp/sys" "$tmp/stub"
  local t p
  for t in bash sh python3 git env cat mkdir rmdir rm mkfifo mktemp sleep date touch wc tr sed awk \
           dirname basename grep head tail cut sort cmp ls seq timeout find cksum; do
    p=$(command -v "$t" 2>/dev/null) && [ ! -e "$tmp/sys/$t" ] && ln -s "$p" "$tmp/sys/$t"
  done
  write_stubs "$tmp/bin"
  SYS=$tmp/sys; STUBS=$tmp/bin:$tmp/sys
  hs() {  # hs <PATH> [VAR=value ...] -- <host.sh arguments>: host.sh in a clean environment
    local p=$1 vars=(); shift
    while [ "$1" != -- ]; do vars+=("$1"); shift; done; shift
    env -i HOME="$HOME" PATH="$p" STUB="$tmp/stub" STUB_PIDS="$tmp/fake.pids" TMPDIR="$tmp" POSTMASTER_HOST_STATE="$tmp/state" \
      POSTMASTER_HOST_CLAIM_WAIT=3 POSTMASTER_HOST_CLOSE_WAIT=1 ${vars[@]+"${vars[@]}"} "$SELF" "$@"
  }
  reset() { rm -f -- "$tmp"/stub/*; }
  calls() { cat "$tmp/stub/$1.calls" 2>/dev/null; }
  T=$'\t'
  local got got2 rc a b c space pane lunaspace live panepid o1 o2

  echo "detect"
  check "a Herdr server that answers is the host" '[ "$(hs "$STUBS" -- detect)" = herdr ]'
  touch "$tmp/stub/herdr.down"
  check "with no Herdr server answering, tmux is" '[ "$(hs "$STUBS" -- detect)" = tmux ]'
  reset
  check "with neither on PATH, none" '[ "$(hs "$SYS" -- detect)" = none ]'
  check "POSTMASTER_HOST=none wins over a live Herdr" '[ "$(hs "$STUBS" POSTMASTER_HOST=none -- detect)" = none ]'
  check "POSTMASTER_HOST=tmux wins over a live Herdr" '[ "$(hs "$STUBS" POSTMASTER_HOST=tmux -- detect)" = tmux ]'

  echo "name: from the waybill, so no title is typed into a shell"
  check "it is the Dispatch section's name, then the role" \
    '[ "$NAME" = "#1, Stop \`touch $tmp/canary\` \$(touch $tmp/canary) \"breaking\" a shell · luna" ]' "$NAME"
  check "a waybill without one falls back to the run's directory" '[ "$(hs "$SYS" -- name "$tmp/logs" coachman)" = "logs · coachman" ]'
  printf '## Dispatch\nname: #2, a bell\a and an escape\033]0;x\007 · y\n' > "$tmp/logs/brief.md"
  check "control characters never reach a label" '[ "$(hs "$SYS" -- name "$tmp/logs")" = "#2, a bell and an escape]0;x · y" ]'
  rm -f "$tmp/logs/brief.md"

  echo "run, no host: the same headless command, backgrounded"
  ( cd "$tmp/caller" && ./fixed.sh > "$tmp/direct.out" 2> "$tmp/direct.err" )
  got=$(cd "$tmp/caller" && hs "$SYS" -- run "$NAME" "$repo/.worktrees/T-1-luna" --out ../logs/n1.out --err ../logs/n1.err \
        --marker ../logs/n1.done -- ./fixed.sh)
  check "it says it ran in the background" '[ "$got" = host=none ]' "$got"
  marker "$tmp/logs/n1.done"
  check "stdout and stderr are byte for byte a direct run's" 'cmp -s "$tmp/direct.out" "$tmp/logs/n1.out" && cmp -s "$tmp/direct.err" "$tmp/logs/n1.err"'
  check "and the title's shell syntax never ran" '[ ! -e "$tmp/canary" ]'
  touch "$tmp/logs/n2.done"
  (cd "$tmp/caller" && hs "$SYS" EMIT_SLEEP=2 -- run "$NAME" "$repo" --marker ../logs/n2.done -- ./fixed.sh >/dev/null)
  check "an earlier launch's marker is gone once run returns" '[ ! -e "$tmp/logs/n2.done" ]'
  check "and it lands again when this one exits, whatever its exit" 'marker "$tmp/logs/n2.done" 20'
  (cd "$tmp/caller" && hs "$SYS" CALLER_VAR=v HERDR_PANE_ID=caller-pane TMUX_PANE=%9 -- run "$NAME" "$repo/.worktrees/T-1-luna" \
     --out ../logs/n3.out --marker ../logs/n3.done --pidfile ../logs/n3.pid -- ./probe.sh >/dev/null)
  marker "$tmp/logs/n3.done"
  check "it runs from the caller's directory, with the caller's environment and its name" \
    '[ "$(field "$tmp/logs/n3.out" from)" = "$tmp/caller" ] && [ "$(field "$tmp/logs/n3.out" var)" = v ] && [ "$(field "$tmp/logs/n3.out" name)" = "$NAME" ]' "$(cat "$tmp/logs/n3.out")"
  check "but never with its caller's pane" '[ "$(field "$tmp/logs/n3.out" pane)" = unset ] && [ "$(field "$tmp/logs/n3.out" tmuxpane)" = unset ]' "$(cat "$tmp/logs/n3.out")"
  check "it is a session of its own: its group is its pid, not the caller's session" \
    '[ "$(field "$tmp/logs/n3.out" pgid)" = "$(field "$tmp/logs/n3.out" pid)" ] && [ "$(field "$tmp/logs/n3.out" sid)" = "$(field "$tmp/logs/n3.out" pid)" ]'
  check "--pidfile holds the launch's pid" '[ "$(cat "$tmp/logs/n3.pid")" = "$(field "$tmp/logs/n3.out" pid)" ]'
  (cd "$tmp/caller" && hs "$SYS" EMIT_SLEEP=3 -- run "$NAME" "$repo" --pidfile ../logs/n5.pid --marker ../logs/n5.done -- ./fixed.sh >/dev/null)
  check "and it is there, for a live process, the moment run returns" '[ -s "$tmp/logs/n5.pid" ] && kill -0 "$(cat "$tmp/logs/n5.pid")" 2>/dev/null'
  marker "$tmp/logs/n5.done"
  printf 'before\n' > "$tmp/logs/n4.out"; printf 'old error\n' > "$tmp/logs/n4.err"
  (cd "$tmp/caller" && hs "$SYS" -- run "$NAME" "$repo" --out ../logs/n4.out --err ../logs/n4.err --append --marker ../logs/n4.done -- ./fixed.sh >/dev/null)
  marker "$tmp/logs/n4.done"
  check "--append keeps what the stream held, and --err holds only this launch's errors" \
    '[ "$(head -1 "$tmp/logs/n4.out")" = before ] && [ "$(wc -l < "$tmp/logs/n4.out")" -eq 4 ] && [ "$(cat "$tmp/logs/n4.err")" = "a line on stderr" ]'
  hs "$SYS" -- run "$NAME" "$repo" --marker "$tmp/logs/n6.done" ./fixed.sh >/dev/null 2>&1; rc=$?
  check "a command without -- is refused, and its marker lands" '[ $rc -eq 1 ] && [ -e "$tmp/logs/n6.done" ]'
  hs "$SYS" -- run "$NAME" "$tmp/nowhere" --err "$tmp/logs/n7.err" --marker "$tmp/logs/n7.done" -- ./fixed.sh >/dev/null 2>&1; rc=$?
  check "a directory that does not exist: refused, the marker lands and --err says why" \
    '[ $rc -eq 1 ] && [ -e "$tmp/logs/n7.done" ] && grep -q "no such directory" "$tmp/logs/n7.err"'
  got=$(hs "$SYS" POSTMASTER_HOST_CLAIM_WAIT=2.5 -- run "$NAME" "$repo" --marker "$tmp/logs/n8.done" -- ./fixed.sh 2>&1); rc=$?
  check "a count that is not a whole number is refused, and never reaches the tests" \
    '[ $rc -eq 1 ] && [ -e "$tmp/logs/n8.done" ] && ! printf "%s" "$got" | grep -q "controls"' "$got"
  got=$(hs "$STUBS" -- wait postmaster-x 10m 2>&1); rc=$?
  check "the same for wait" '[ $rc -eq 1 ] && ! printf "%s" "$got" | grep -q "controls"' "$got"

  echo "run, Herdr (stub): a pane in the worktree's space, nested under the repository's"
  reset
  got=$(cd "$tmp/caller" && hs "$STUBS" CALLER_VAR=v HERDR_PANE_ID=caller-pane -- run "$NAME" "$repo/.worktrees/T-1-luna" \
        --out ../logs/h1.out --err ../logs/h1.err --marker ../logs/h1.done -- ./probe.sh)
  check "it says where it ran" 'case $got in "host=herdr space=w"*" pane=p"*) true ;; *) false ;; esac' "$got"
  space=${got#*space=}; space=${space%% *}; pane=${got##*pane=}
  check "a repository with no space gets one first, labelled with its name" \
    'calls herdr | grep -qxF "workspace${T}create${T}--cwd${T}$repo${T}--label${T}$rname${T}--no-focus"'
  check "the worktree opens as a space under it, labelled with the launch's name" \
    'calls herdr | grep -qxF "worktree${T}open${T}--workspace${T}w1${T}--path${T}$repo/.worktrees/T-1-luna${T}--label${T}$NAME${T}--no-focus"'
  check "host.sh marks the space it opened as its own" 'python3 -c "import json,sys; sys.exit(json.load(open(\"$tmp/stub/herdr.json\"))[\"spaces\"][\"$space\"][\"tokens\"] != {\"postmaster\": \"opened\"})"'
  marker "$tmp/logs/h1.done"
  check "the launch ran in that pane, with that pane's identity" '[ "$(field "$tmp/logs/h1.out" pane)" = "$pane" ]' "$(cat "$tmp/logs/h1.out")"
  check "and with its caller's environment, handed over by host.sh" '[ "$(field "$tmp/logs/h1.out" var)" = v ] && [ "$(field "$tmp/logs/h1.out" from)" = "$tmp/caller" ]'
  sleep 1
  check "the pane shows the name and the rendered stream, not raw JSON" \
    'grep -qF "$NAME" "$tmp/stub/pane-$pane.out" && grep -qE "^[0-9:]{8} session probe-1 · m$" "$tmp/stub/pane-$pane.out" && ! grep -q "{" "$tmp/stub/pane-$pane.out"' "$(cat "$tmp/stub/pane-$pane.out" 2>/dev/null)"
  check "and reports the launch working, then releases it" \
    'calls herdr | grep -q "^pane${T}report-agent${T}$pane${T}.*--state${T}working" && calls herdr | grep -q "^pane${T}release-agent${T}$pane${T}"'
  got2=$(cd "$tmp/caller" && hs "$STUBS" -- run "$NAME" "$repo/.worktrees/T-1-luna" --marker ../logs/h2.done -- ./fixed.sh)
  check "a second launch in the same worktree is a new tab in the same space" \
    '[ "$(calls herdr | grep -c "^worktree${T}open")" -eq 1 ] && calls herdr | grep -q "^tab${T}create${T}--workspace${T}$space${T}"' "$got2"
  marker "$tmp/logs/h2.done"
  ( cd "$tmp/caller" && ./fixed.sh > "$tmp/direct.out" 2> "$tmp/direct.err" )
  (cd "$tmp/caller" && hs "$STUBS" -- run "$NAME" "$repo/.worktrees/T-1-luna" --out ../logs/h3.out --err ../logs/h3.err --marker ../logs/h3.done -- ./fixed.sh >/dev/null)
  marker "$tmp/logs/h3.done"
  check "the stream and the marker are what a background run writes" 'cmp -s "$tmp/direct.out" "$tmp/logs/h3.out" && cmp -s "$tmp/direct.err" "$tmp/logs/h3.err"'
  got=$(cd "$tmp/caller" && hs "$STUBS" -- run "$NAME" "$repo/.worktrees/T-1-luna" --marker ../logs/h6.done --pidfile ../logs/h6.pid -- sleep 60)
  panepid=$(cat "$tmp/stub/pane-${got##*pane=}.pid")
  kill -HUP -- "-$panepid" 2>/dev/null
  check "a pane closed mid-run: the launch stops, and its marker lands" \
    'marker "$tmp/logs/h6.done" 10 && ! kill -0 "$(cat "$tmp/logs/h6.pid")" 2>/dev/null'
  got=$(cd "$tmp/caller" && hs "$STUBS" -- run "$NAME" "$repo/.worktrees/T-1-luna" --marker ../logs/h7.done --pidfile ../logs/h7.pid -- sleep 60)
  panepid=$(cat "$tmp/stub/pane-${got##*pane=}.pid")
  i=0; while [ ! -s "$tmp/logs/h7.pid" ] && [ $i -lt 50 ]; do sleep 0.2; i=$((i + 1)); done   # the runner writes it once the launch runs
  kill -KILL -- "-$panepid" 2>/dev/null; kill -KILL -- "-$(cat "$tmp/logs/h7.pid")" 2>/dev/null
  check "its runner and the launch killed outright: the marker still lands" 'marker "$tmp/logs/h7.done" 10'
  touch "$tmp/stub/pane.dead"
  got=$(cd "$tmp/caller" && hs "$STUBS" COUNT="$tmp/logs/h4.count" -- run "$NAME" "$repo/.worktrees/T-1-sol" --out ../logs/h4.out --marker ../logs/h4.done -- ./probe.sh 2>/dev/null)
  marker "$tmp/logs/h4.done"
  check "a pane that never starts the launch: it runs in the background instead" '[ "$got" = host=none ] && [ "$(wc -l < "$tmp/logs/h4.count")" -eq 1 ]' "$got"
  rm -f "$tmp/stub/pane.dead"; touch "$tmp/stub/pane.late"
  got=$(cd "$tmp/caller" && hs "$STUBS" POSTMASTER_HOST_CLAIM_WAIT=1 COUNT="$tmp/logs/h5.count" -- run "$NAME" "$repo/.worktrees/T-1-sol" --marker ../logs/h5.done -- ./probe.sh 2>/dev/null)
  marker "$tmp/logs/h5.done"; sleep 6
  check "a pane that starts it late: it still runs exactly once" '[ "$got" = host=none ] && [ "$(wc -l < "$tmp/logs/h5.count")" -eq 1 ]' "$(cat "$tmp/logs/h5.count" 2>/dev/null)"
  rm -f "$tmp/stub/pane.late"
  check "no launch leaves its hand-over directory behind" '[ -z "$(find "$tmp" -maxdepth 1 -name "postmaster-host.*")" ]'

  echo "stop and close, Herdr (stub)"
  lunaspace=$(python3 -c "import json; print(json.load(open('$tmp/stub/herdr.json'))['open']['$repo/.worktrees/T-1-luna'])")
  check "a space host.sh opened, its launches done, is closed" \
    'hs "$STUBS" -- close "$repo/.worktrees/T-1-luna" >/dev/null && calls herdr | grep -qx "workspace${T}close${T}$lunaspace"'
  hs "$STUBS" -- close "$repo" >/dev/null 2>&1; rc=$?
  check "the repository's own checkout is refused" '[ $rc -eq 2 ]'
  python3 - "$tmp/stub/herdr.json" "$repo/.worktrees/T-1-rev-luna" <<'PY'
import json, sys
st = json.load(open(sys.argv[1])); st["n"] += 1; ws, p = "w%d" % st["n"], "p%d" % st["n"]
# A space the user opened, holding nothing now but a tab host.sh added, its launch done.
st["spaces"][ws] = {"label": "the user's", "tokens": {}, "panes": [p]}
st["panes"][p] = {"ws": ws, "tokens": {"postmaster": "launch", "state": "done"}}
st["open"][sys.argv[2]] = ws; json.dump(st, open(sys.argv[1], "w"))
PY
  hs "$STUBS" -- close "$repo/.worktrees/T-1-rev-luna" >/dev/null 2>&1; rc=$?
  check "a space host.sh did not open is refused, and left open" '[ $rc -eq 2 ] && ! calls herdr | grep -q "^workspace${T}close${T}w$(python3 -c "import json; print(json.load(open(\"$tmp/stub/herdr.json\"))[\"n\"])")$"'
  touch "$tmp/stub/pane.dead"
  got=$(cd "$tmp/caller" && hs "$STUBS" -- run "$NAME" "$repo/.worktrees/T-1-sol" --marker ../logs/s1.done -- sleep 60 2>/dev/null)
  rm -f "$tmp/stub/pane.dead"
  got2=$(hs "$STUBS" -- close "$repo/.worktrees/T-1-sol" 2>&1); rc=$?
  check "a launch that fell back to the background still holds its worktree: close refuses" '[ "$got" = host=none ] && [ $rc -eq 2 ]' "$got / $got2"
  (cd "$repo/.worktrees/T-1-sol" && hs "$STUBS" -- stop "$repo/.worktrees/T-1-sol" >/dev/null 2>&1); rc=$?
  check "stop refuses to run from inside the worktree it would stop" '[ $rc -eq 1 ] && [ ! -e "$tmp/logs/s1.done" ]'
  hs "$STUBS" -- stop "$repo/.worktrees/T-1-sol" >/dev/null
  check "stop ends it, and its marker lands" 'marker "$tmp/logs/s1.done" 10'
  check "then close closes the space" 'hs "$STUBS" -- close "$repo/.worktrees/T-1-sol" >/dev/null'

  echo "a reviewer's scratch clone, Herdr (stub): a space of its own, which close shuts"
  reset
  got=$(cd "$tmp/caller" && hs "$STUBS" -- run "$NAME" "$clone" --marker ../logs/c1.done -- ./fixed.sh)
  space=${got#*space=}; space=${space%% *}
  check "it opens as a space of the launch's own, labelled with its name, and no other" \
    'calls herdr | grep -qxF "workspace${T}create${T}--cwd${T}$clone${T}--label${T}$NAME${T}--no-focus" && [ "$(calls herdr | grep -c "^workspace${T}create")" -eq 1 ]' "$(calls herdr)"
  check "host.sh marks that space as its own" 'python3 -c "import json,sys; sys.exit(json.load(open(\"$tmp/stub/herdr.json\"))[\"spaces\"][\"$space\"][\"tokens\"] != {\"postmaster\": \"opened\"})"'
  marker "$tmp/logs/c1.done"
  got2=$(cd "$tmp/caller" && hs "$STUBS" -- run "$NAME" "$clone" --marker ../logs/c2.done -- ./fixed.sh)
  check "a second launch there is a new tab in the same space" \
    '[ "$(calls herdr | grep -c "^workspace${T}create")" -eq 1 ] && calls herdr | grep -q "^tab${T}create${T}--workspace${T}$space${T}"' "$got2"
  marker "$tmp/logs/c2.done"
  check "close shuts it" 'hs "$STUBS" -- close "$clone" >/dev/null && calls herdr | grep -qx "workspace${T}close${T}$space"'
  git clone -q "$repo" "$tmp/plain" >/dev/null 2>&1
  got=$(cd "$tmp/caller" && hs "$STUBS" -- run "$NAME" "$tmp/plain" --marker ../logs/c3.done -- ./fixed.sh)
  space=${got#*space=}; space=${space%% *}
  marker "$tmp/logs/c3.done"
  hs "$STUBS" -- close "$tmp/plain" >/dev/null 2>&1; rc=$?
  check "a plain clone is no scratch: it opens as a repository, and close refuses its space" \
    'calls herdr | grep -qxF "workspace${T}create${T}--cwd${T}$tmp/plain${T}--label${T}plain${T}--no-focus" && [ $rc -eq 2 ] && ! calls herdr | grep -qx "workspace${T}close${T}$space"' "$(calls herdr)"

  echo "run, stop and close, tmux (stub)"
  reset
  got=$(cd "$tmp/caller" && hs "$STUBS" POSTMASTER_HOST=tmux CALLER_VAR=v -- run "$NAME" "$repo/.worktrees/T-1-sol" --out ../logs/t1.out --marker ../logs/t1.done -- ./probe.sh)
  marker "$tmp/logs/t1.done"
  check "a first launch opens session postmaster-<repo>, a window named for it" \
    'calls tmux | grep -q "^new-session${T}-d${T}-P${T}-F${T}#{window_id}${T}-s${T}postmaster-$rname${T}-n${T}$NAME${T}"' "$got"
  check "the launch ran with that window's pane and its caller's environment" '[ "$(field "$tmp/logs/t1.out" tmuxpane)" = %1 ] && [ "$(field "$tmp/logs/t1.out" var)" = v ]' "$(cat "$tmp/logs/t1.out")"
  (cd "$tmp/caller" && hs "$STUBS" POSTMASTER_HOST=tmux -- run "$NAME" "$repo/.worktrees/T-1-sol" --marker ../logs/t2.done -- sleep 60 >/dev/null)
  check "the next is a window in the same session" 'calls tmux | grep -q "^new-window${T}-d${T}-P${T}-F${T}#{window_id}${T}-t${T}=postmaster-$rname:${T}"'
  hs "$STUBS" POSTMASTER_HOST=tmux -- close "$repo/.worktrees/T-1-sol" >/dev/null 2>&1; rc=$?
  check "close refuses while a launch still runs in the worktree" '[ $rc -eq 2 ] && [ "$(calls tmux | grep -c "^kill-window")" -eq 0 ]'
  hs "$STUBS" POSTMASTER_HOST=tmux -- stop "$repo/.worktrees/T-1-sol" >/dev/null; marker "$tmp/logs/t2.done" 10
  check "once it is stopped, close kills that worktree's windows" \
    'hs "$STUBS" POSTMASTER_HOST=tmux -- close "$repo/.worktrees/T-1-sol" >/dev/null && [ "$(calls tmux | grep -c "^kill-window")" -eq 2 ]'
  (cd "$tmp/caller" && hs "$STUBS" POSTMASTER_HOST=tmux -- run "$NAME" "$clone" --marker ../logs/t3.done -- ./fixed.sh >/dev/null)
  marker "$tmp/logs/t3.done"
  check "a reviewer's scratch clone gets a window in the session of the repository it was cut from" \
    'python3 -c "import json,sys; st = json.load(open(\"$tmp/stub/tmux.json\")); sys.exit(not any(w[\"session\"] == \"postmaster-$rname\" and w[\"opts\"].get(\"@postmaster_cwd\") == \"$clone\" for w in st[\"windows\"].values()) or len(st[\"sessions\"]) != 1)"'
  check "and close kills it" \
    'hs "$STUBS" POSTMASTER_HOST=tmux -- close "$clone" >/dev/null && [ "$(calls tmux | grep -c "^kill-window")" -eq 3 ]'

  echo "interactive sessions"
  hs "$SYS" -- spawn postmaster-repo "$repo" -- claude >/dev/null 2>&1; a=$?
  hs "$SYS" -- send postmaster-repo "$tmp/caller/fixed.sh" >/dev/null 2>&1; b=$?
  hs "$SYS" -- read postmaster-repo >/dev/null 2>&1; c=$?
  check "with no host, spawn, send and read say so, exit 3" '[ $a -eq 3 ] && [ $b -eq 3 ] && [ $c -eq 3 ]'
  reset
  hs "$STUBS" POSTMASTER_CONFIG=/elsewhere/config.toml -- spawn postmaster-repo "$repo/.worktrees/T-1-luna" --label "repo · postmaster" -- claude --model m >/dev/null
  check "Herdr: spawn starts the agent in a tab of the repository's own space" \
    'calls herdr | grep -q "^tab${T}create${T}--workspace${T}w1${T}--cwd${T}$repo/.worktrees/T-1-luna${T}--label${T}repo · postmaster${T}--no-focus" && calls herdr | grep -qx "agent${T}start${T}postmaster-repo${T}--kind${T}claude${T}--pane${T}p5${T}--${T}--model${T}m"' "$(calls herdr)"
  check "with the caller's POSTMASTER_ settings in its pane" 'calls herdr | grep "^tab${T}create" | grep -qF -- "--env${T}POSTMASTER_CONFIG=/elsewhere/config.toml"'
  hs "$STUBS" -- spawn postmaster-repo "$repo" -- claude >/dev/null 2>&1; rc=$?
  check "a handle a live agent already has is refused" '[ $rc -eq 1 ] && [ "$(calls herdr | grep -c "^agent${T}start${T}postmaster-repo")" -eq 1 ]'
  touch "$tmp/stub/agent.notready"
  hs "$STUBS" -- spawn postmaster-other "$repo" -- claude >/dev/null 2>&1; rc=$?
  rm -f "$tmp/stub/agent.notready"
  check "a harness asking something on first start: spawn says so, and does not fail" '[ $rc -eq 0 ]'
  hs "$STUBS" -- spawn "My.Project postmaster" "$repo" -- claude >/dev/null
  check "a handle becomes a Herdr agent name: lowercase, no dots or spaces" 'calls herdr | grep -q "^agent${T}start${T}my-project-postmaster${T}"'
  o1=$("$SELF" _handle "postmaster-acme-platform-service-billing"); o2=$("$SELF" _handle "postmaster-acme-platform-service-payments")
  check "two long names that share a start get two handles, each always the same, none over 32" \
    '[ "$o1" != "$o2" ] && [ "$o1" = "$("$SELF" _handle "postmaster-acme-platform-service-billing")" ] && [ ${#o1} -le 32 ] && [ ${#o2} -le 32 ]' "$o1 / $o2"
  printf 'Read the brief.' > "$tmp/msg.txt"
  hs "$STUBS" -- send postmaster-repo "$tmp/msg.txt" >/dev/null
  check "Herdr: send submits the file's text as the agent's prompt" 'calls herdr | grep -qx "agent${T}prompt${T}postmaster-repo${T}Read the brief."'
  hs "$STUBS" -- send postmaster-repo "$tmp/msg.txt" --wait 30 >/dev/null
  check "Herdr: send --wait sends and waits in one call, never a prompt then a wait" \
    'calls herdr | grep -qx "agent${T}prompt${T}postmaster-repo${T}Read the brief.${T}--wait${T}--timeout${T}30000" && ! calls herdr | grep -q "^agent${T}wait"'
  touch "$tmp/stub/agent.blocked"
  hs "$STUBS" -- send postmaster-repo "$tmp/msg.txt" --wait 30 >/dev/null 2>&1; a=$?
  hs "$STUBS" -- wait postmaster-repo 5 >/dev/null 2>&1; b=$?
  rm -f "$tmp/stub/agent.blocked"
  check "a turn that stops at an approval or a question is not settled: exit 3" '[ $a -eq 3 ] && [ $b -eq 3 ]'
  hs "$STUBS" -- wait postmaster-repo 5 >/dev/null; hs "$STUBS" -- read postmaster-repo 7 >/dev/null
  check "Herdr: wait and read go to the agent by its handle" \
    'calls herdr | grep -qx "agent${T}wait${T}postmaster-repo${T}--timeout${T}5000" && calls herdr | grep -qx "agent${T}read${T}postmaster-repo${T}--source${T}recent-unwrapped${T}--lines${T}7"'
  hs "$STUBS" POSTMASTER_HOST=tmux POSTMASTER_CONFIG=/elsewhere/config.toml -- spawn postmaster-repo "$repo" -- claude >/dev/null
  check "tmux: spawn passes the caller's POSTMASTER_ settings to the window" 'grep -qx "POSTMASTER_CONFIG=/elsewhere/config.toml" "$tmp/stub/win-1.env"'
  hs "$STUBS" POSTMASTER_HOST=tmux -- send postmaster-repo "$tmp/msg.txt" >/dev/null
  a=$(calls tmux | awk -F'\t' '$1 ~ /^(load-buffer|paste-buffer|send-keys)$/ {printf "%s%s ", $1, ($1 == "paste-buffer" && $2 == "-p") ? "(-p)" : ""}')
  check "tmux: send pastes bracketed, then presses Enter as its own key" '[ "$a" = "load-buffer paste-buffer(-p) send-keys " ]' "$a"
  hs "$STUBS" POSTMASTER_HOST=tmux POSTMASTER_HOST_QUIET=2 -- wait postmaster-repo 20 >/dev/null; a=$?
  hs "$STUBS" POSTMASTER_HOST=tmux -- read postmaster-repo 7 >/dev/null
  check "tmux: wait settles on a quiet screen, and read takes the lines asked for" \
    '[ $a -eq 0 ] && calls tmux | grep -qx "capture-pane${T}-p${T}-J${T}-S${T}-7${T}-t${T}@1"'

  echo "live agents (stub Herdr)"
  reset
  local wt group
  printf 'SECRET_PROBE=from-the-env-file\n' > "$tmp/lane.env"
  wt=$repo/.worktrees/T-1-luna
  got=$(cd "$tmp/caller" && hs "$STUBS" CALLER_VAR=v HERDR_PANE_ID=caller-pane POSTMASTER_LAUNCH_NAME=stale \
        POSTMASTER_CONFIG=/elsewhere/config.toml CLAUDECODE=1 CLAUDE_CODE_SESSION_ID=parent-session -- start t1-luna "$wt" \
        --label "$NAME" --exited ../logs/a1.exited --err ../logs/a1.err --env-file "$tmp/lane.env" \
        -- claude --model m --dangerously-skip-permissions); rc=$?
  pane=$(printf '%s' "$got" | json 'd["pane"]' 2>/dev/null); group=$(printf '%s' "$got" | json 'd["group"]' 2>/dev/null)
  check "start: the agent runs in a fresh tab of its worktree's space, and start says where" \
    '[ $rc -eq 0 ] && [ -n "$pane" ] && [ -n "$group" ] && calls herdr | grep -q "^worktree${T}open${T}.*--path${T}$wt${T}"' "$got"
  check "with the session its integration reported" '[ "$(printf "%s" "$got" | json "d[\"session\"][\"kind\"]")" = id ]' "$got"
  check "Herdr started the kind with exactly its arguments, in that pane" \
    'calls herdr | grep -qx "agent${T}start${T}t1-luna${T}--kind${T}claude${T}--pane${T}$pane${T}--${T}--model${T}m${T}--dangerously-skip-permissions"'
  env_of() { sed -n "s/^$1=//p" "$tmp/stub/pane-$pane.env" | head -1; }
  check "the pane's shell has the pane's own environment, the caller's POSTMASTER_ settings and the env file" \
    '[ "$(env_of POSTMASTER_CONFIG)" = /elsewhere/config.toml ] && [ "$(env_of SECRET_PROBE)" = from-the-env-file ] && [ "$(env_of HERDR_PANE_ID)" = "$pane" ] && [ "$(env_of TERM)" = stub-term ]' \
    "$(cat "$tmp/stub/pane-$pane.env" 2>/dev/null)"
  check "and nothing else of the caller's: not its variables, nor a harness session's identity" \
    '[ -z "$(env_of CALLER_VAR)" ] && [ -z "$(env_of CLAUDECODE)" ] && [ -z "$(env_of CLAUDE_CODE_SESSION_ID)" ]'
  check "not the caller's launch name, and no history file" '[ -z "$(env_of POSTMASTER_LAUNCH_NAME)" ] && [ "$(env_of HISTFILE)" = /dev/null ]'
  check "it runs in its worktree" '[ "$(env_of PWD)" = "$wt" ]'
  check "the env file's values never reach a command line" '! calls herdr | grep -q from-the-env-file'
  check "its exited marker is gone while it runs" '[ ! -e "$tmp/logs/a1.exited" ]'
  got2=$(hs "$STUBS" -- start t1-luna "$wt" --exited "$tmp/logs/a2.exited" -- claude 2>&1); rc=$?
  check "a second agent under the same name is refused, and that start's marker lands" '[ $rc -eq 1 ] && [ -e "$tmp/logs/a2.exited" ]' "$got2"
  got=$(hs "$STUBS" -- state t1-luna); rc=$?
  check "state gives its status and its session" \
    '[ $rc -eq 0 ] && [ "$(printf "%s" "$got" | json "d[\"status\"]")" = idle ] && [ -n "$(printf "%s" "$got" | json "d[\"session\"][\"value\"]")" ]' "$got"
  printf 'Write the summary.\nSTUB_RUN=echo done > WORKHORSE-SUMMARY.md\n' > "$tmp/p1.txt"
  got=$(hs "$STUBS" -- prompt t1-luna "$tmp/p1.txt"); rc=$?
  check "prompt: a settled agent takes the text, waited on in the same call" \
    '[ $rc -eq 0 ] && [ -s "$wt/WORKHORSE-SUMMARY.md" ] && calls herdr | grep -q "SUMMARY.md${T}--wait$" && ! calls herdr | grep -q "^agent${T}wait"' "$got"
  echo working > "$tmp/stub/agent-t1-luna.status"; a=$(wc -l < "$tmp/stub/prompts.log")
  got=$(hs "$STUBS" -- prompt t1-luna "$tmp/p1.txt"); rc=$?
  rm -f "$tmp/stub/agent-t1-luna.status"
  check "an agent still working is sent nothing: exit 3" '[ $rc -eq 3 ] && [ "$(wc -l < "$tmp/stub/prompts.log")" -eq "$a" ]' "$got"
  touch "$tmp/stub/prompt.stalled"; hs "$STUBS" -- prompt t1-luna "$tmp/p1.txt" >/dev/null; a=$?; rm -f "$tmp/stub/prompt.stalled"
  check "no turn seen: exit 4, so the caller reads the session before sending again" '[ $a -eq 4 ]'
  hs "$STUBS" -- close "$wt" >/dev/null 2>&1; rc=$?
  check "close refuses while a live agent runs in the worktree" '[ $rc -eq 2 ]'
  got=$(hs "$STUBS" -- end t1-luna); rc=$?
  check "end: the agent stops, and its exited marker lands" '[ $rc -eq 0 ] && marker "$tmp/logs/a1.exited" 10 && ! kill -0 "$group" 2>/dev/null' "$got"
  hs "$STUBS" -- state t1-luna >/dev/null; a=$?; hs "$STUBS" -- prompt t1-luna "$tmp/p1.txt" >/dev/null; b=$?
  check "an agent that has gone: state and prompt exit 6" '[ $a -eq 6 ] && [ $b -eq 6 ]'
  check "and then close closes its space" 'hs "$STUBS" -- close "$wt" >/dev/null'
  wt=$repo/.worktrees/T-1-sol
  touch "$tmp/stub/agent.notready"
  got=$(hs "$STUBS" -- start t1-sol "$wt" --exited "$tmp/logs/a3.exited" --err "$tmp/logs/a3.err" -- claude 2>&1); rc=$?
  rm -f "$tmp/stub/agent.notready"; hs "$STUBS" -- state t1-sol >/dev/null; a=$?
  check "an agent that stops at a question before any work: exit 4, ended, its marker lands and --err says why" \
    '[ $rc -eq 4 ] && [ $a -eq 6 ] && [ -e "$tmp/logs/a3.exited" ] && grep -q "stopped at a question" "$tmp/logs/a3.err"' "$got"
  touch "$tmp/stub/agent.nosession"
  got=$(hs "$STUBS" POSTMASTER_HOST_SESSION_WAIT=1 -- start t1-sol "$wt" --exited "$tmp/logs/a4.exited" -- pi 2>&1); rc=$?
  rm -f "$tmp/stub/agent.nosession"; hs "$STUBS" -- state t1-sol >/dev/null; a=$?
  check "an agent whose integration reports no session: exit 5, ended, and its marker lands" \
    '[ $rc -eq 5 ] && [ $a -eq 6 ] && [ -e "$tmp/logs/a4.exited" ]' "$got"
  got=$(hs "$STUBS" POSTMASTER_HOST=none -- start t1-sol "$wt" --exited "$tmp/logs/a5.exited" -- claude 2>&1); rc=$?
  hs "$STUBS" POSTMASTER_HOST=none -- prompt t1-sol "$tmp/p1.txt" >/dev/null 2>&1; a=$?
  check "no Herdr: start and prompt exit 3, and start's marker lands" '[ $rc -eq 3 ] && [ $a -eq 3 ] && [ -e "$tmp/logs/a5.exited" ]' "$got"
  got=$(hs "$STUBS" -- start t1-own "$wt" -- claude); pane=$(printf '%s' "$got" | json 'd["pane"]' 2>/dev/null)
  group=$(printf '%s' "$got" | json 'd["group"]' 2>/dev/null)
  python3 -c 'import json, sys
st = json.load(open(sys.argv[1])); st["panes"][sys.argv[2]]["tokens"] = {}; json.dump(st, open(sys.argv[1], "w"))' "$tmp/stub/herdr.json" "$pane"
  hs "$STUBS" -- end t1-own >/dev/null 2>&1; rc=$?
  check "end never ends an agent in a pane host.sh did not open" '[ $rc -eq 1 ] && kill -0 "$group" 2>/dev/null' "$got"

  echo "live agents Herdr has no kind for, and ones that report no session (stub Herdr)"
  wt=$repo/.worktrees/T-1-sol
  got=$(hs "$STUBS" -- start t1-mimo "$wt" --label "$NAME" --exited "$tmp/logs/m1.exited" --env-file "$tmp/lane.env" \
        --env XDG_DATA_HOME="$tmp/mimo-data" --env MIMO_FLAG=on --no-session --typed '^(MiMoCode|MC \|)' \
        -- mimo -m 'prov/a model' --trust); rc=$?
  pane=$(printf '%s' "$got" | json 'd["pane"]' 2>/dev/null); group=$(printf '%s' "$got" | json 'd["group"]' 2>/dev/null)
  want=$(printf 'pane\trun\t%s\t%s' "$pane" "'mimo' '-m' 'prov/a model' '--trust'")
  check "start --typed: the command is typed into the pane's shell, each word quoted, and start returns once it titles its terminal" \
    '[ $rc -eq 0 ] && [ -n "$group" ] && calls herdr | grep -qxF "$want"' "$got"
  check "with no session, as --no-session asks, and never through herdr agent start" \
    '[ "$(printf "%s" "$got" | json "d[\"session\"]")" = "" ] && ! calls herdr | grep -q "^agent${T}start${T}t1-mimo"' "$got"
  check "Herdr is told it is an agent, idle, and names it" \
    'calls herdr | grep -q "^pane${T}report-agent${T}$pane${T}--source${T}custom:postmaster${T}--agent${T}mimo${T}--state${T}idle${T}--seq${T}[0-9]" && calls herdr | grep -qx "agent${T}rename${T}$pane${T}t1-mimo"'
  check "each --env reaches the pane's shell after the env file, and no command line" \
    '[ "$(env_of XDG_DATA_HOME)" = "$tmp/mimo-data" ] && [ "$(env_of MIMO_FLAG)" = on ] && [ "$(env_of SECRET_PROBE)" = from-the-env-file ] && ! calls herdr | grep -q "MIMO_FLAG"' \
    "$(cat "$tmp/stub/pane-$pane.env" 2>/dev/null)"
  printf 'Write it.\nSTUB_RUN=echo typed > TYPED.md\nWhen this turn is over, run this as your very last command: touch %s\n' "$tmp/logs/m1.finished" > "$tmp/p-typed.txt"
  got=$(hs "$STUBS" -- prompt t1-mimo "$tmp/p-typed.txt" --no-wait); rc=$?
  check "prompt to a typed agent: its text pasted into its pane and entered, and it reads as working" \
    '[ $rc -eq 0 ] && [ "$(printf "%s" "$got" | json "d[\"outcome\"]")" = sent ] && calls herdr | grep -q "^pane${T}send-text${T}$pane${T}Write it." && calls herdr | grep -qx "pane${T}send-keys${T}$pane${T}enter" && [ "$(hs "$STUBS" -- state t1-mimo | json "d[\"status\"]")" = working ]' "$got"
  check "and the turn it took ran its work, then its finish command" '[ -s "$wt/TYPED.md" ] && [ -e "$tmp/logs/m1.finished" ]'
  hs "$STUBS" -- report t1-mimo idle; rc=$?
  check "report: a typed agent's status is what host.sh tells Herdr" '[ $rc -eq 0 ] && [ "$(hs "$STUBS" -- state t1-mimo | json "d[\"status\"]")" = idle ]'
  kill -TERM -- "-$group" 2>/dev/null; marker "$tmp/logs/m1.exited" 10
  hs "$STUBS" -- state t1-mimo >/dev/null; a=$?
  check "a typed agent whose process has gone is gone, though Herdr still holds its name, and the name is freed" \
    '[ $a -eq 6 ] && calls herdr | grep -qx "agent${T}rename${T}t1-mimo${T}--clear" && ! hs "$STUBS" -- state t1-mimo >/dev/null'
  got=$(hs "$STUBS" -- start t1-mimo2 "$wt" --no-session --typed '^MiMoCode' -- mimo --trust); group=$(printf '%s' "$got" | json 'd["group"]' 2>/dev/null)
  hs "$STUBS" -- end t1-mimo2 >/dev/null; hs "$STUBS" -- state t1-mimo2 >/dev/null; a=$?
  check "end: a typed agent stops, Herdr is released from it, and its name is freed" \
    '[ -n "$group" ] && ! kill -0 "$group" 2>/dev/null && [ $a -eq 6 ] && calls herdr | grep -q "^pane${T}release-agent${T}.*--agent${T}mimo${T}--seq"' "$got"
  touch "$tmp/stub/typed.straggler"
  got=$(hs "$STUBS" -- start t1-mimo5 "$wt" --no-session --typed '^MiMoCode' -- mimo --trust); group=$(printf '%s' "$got" | json 'd["group"]' 2>/dev/null)
  rm -f "$tmp/stub/typed.straggler"
  kill -TERM "$group" 2>/dev/null; sleep 0.5
  a=$(kill -0 -- "-$group" 2>/dev/null && echo left || echo none); hs "$STUBS" -- state t1-mimo5 >/dev/null; b=$?
  check "a typed agent whose launcher exits is gone, and what it left running in its group is ended" \
    '[ -n "$group" ] && [ "$a" = left ] && [ $b -eq 6 ] && ! kill -0 -- "-$group" 2>/dev/null' "$got"
  touch "$tmp/stub/typed.notitle"
  got=$(hs "$STUBS" -- start t1-mimo3 "$wt" --exited "$tmp/logs/m3.exited" --err "$tmp/logs/m3.err" --timeout 2 --no-session --typed '^MiMoCode' -- mimo 2>&1); rc=$?
  rm -f "$tmp/stub/typed.notitle"
  check "a typed agent that never sets its title: exit 4, ended, and its marker lands" \
    '[ $rc -eq 4 ] && [ -e "$tmp/logs/m3.exited" ] && grep -q "never set a terminal title" "$tmp/logs/m3.err"' "$got"
  touch "$tmp/stub/typed.dies"
  got=$(hs "$STUBS" -- start t1-mimo4 "$wt" --no-session --typed '^MiMoCode' -- mimo 2>&1); rc=$?
  rm -f "$tmp/stub/typed.dies"
  check "one that exits before it is ready: exit 1, said so" '[ $rc -eq 1 ] && case $got in *"exited before it was ready"*) true ;; *) false ;; esac' "$got"
  wt=$repo/.worktrees/T-1-luna
  got=$(hs "$STUBS" POSTMASTER_HOST_SESSION_WAIT=1 -- start t1-codex "$wt" --no-session -- codex -m m --no-daemon); rc=$?
  check "--no-session: an agent Herdr starts that reports no session still starts, with none" \
    '[ $rc -eq 0 ] && [ "$(printf "%s" "$got" | json "d[\"session\"]")" = "" ]' "$got"
  printf 'Look.\nWhen this turn is over, run this as your very last command: touch %s\n' "$tmp/logs/c1.finished" > "$tmp/p-codex.txt"
  echo working > "$tmp/stub/agent-t1-codex.status"
  got=$(hs "$STUBS" -- prompt t1-codex "$tmp/p-codex.txt" --no-wait); rc=$?
  rm -f "$tmp/stub/agent-t1-codex.status"
  check "prompt --no-wait sends at once, never waiting, whatever Herdr reads the agent as" \
    '[ $rc -eq 0 ] && [ -e "$tmp/logs/c1.finished" ] && calls herdr | grep "^agent${T}prompt${T}t1-codex" | tail -1 | grep -qv -- "--wait"' "$got"
  hs "$STUBS" -- report t1-codex working; rc=$?
  check "report does nothing for an agent Herdr started itself" '[ $rc -eq 0 ] && ! calls herdr | grep -q "report-agent.*--agent${T}codex"'
  hs "$STUBS" -- end t1-codex >/dev/null

  finish self-test
}

live_test() {
  test_setup
  export POSTMASTER_HOST_STATE=$tmp/state
  opened=() tsession=""
  trap 'for (( i=${#opened[@]}-1; i>=0; i-- )); do herdr workspace close "${opened[i]}" >/dev/null 2>&1; done
        [ -n "$tsession" ] && tmux kill-session -t "=$tsession" >/dev/null 2>&1
        rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
  openspace() { herdr worktree list --cwd "$1" 2>/dev/null | python3 -c 'import json, sys
d = json.load(sys.stdin)
print(([w.get("open_workspace_id") for w in d["result"]["worktrees"] if w["path"] == sys.argv[1]] or [None])[0] or "")' "$1" 2>/dev/null; }
  local got wt rs space pane tab info seen i screen rev rspace cspace before
  ( cd "$tmp/caller" && ./fixed.sh > "$tmp/direct.out" 2> "$tmp/direct.err" )
  echo "detected here: $(detect)"

  if herdr_up; then
    echo "Herdr, the positive control"
    rs=$(herdr workspace create --cwd "$repo" --label "$rname" --no-focus | json 'd["result"]["workspace"]["workspace_id"]')
    [ -n "$rs" ] && opened+=("$rs")
    wt=$repo/.worktrees/T-1-luna
    got=$(cd "$tmp/caller" && EMIT_SLEEP=8 "$SELF" run "$NAME" "$wt" --out ../logs/l1.out --err ../logs/l1.err --marker ../logs/l1.done -- ./fixed.sh)
    space=$(printf '%s' "$got" | sed -n 's/.*space=\([^ ]*\).*/\1/p'); pane=${got##*pane=}; tab=$(printf '%s' "$got" | sed -n 's/.*tab=\([^ ]*\).*/\1/p')
    [ -n "$space" ] && opened+=("$space")
    check "the launch runs in Herdr" 'case $got in host=herdr*) true ;; *) false ;; esac' "$got"
    check "in a pane of its own worktree's space" '[ -n "$space" ] && [ "$(openspace "$wt")" = "$space" ]'
    info=$(herdr workspace get "$space" 2>/dev/null)
    check "that space is a linked worktree of the repository, whose own space is its parent" \
      '[ "$(printf "%s" "$info" | json "d[\"result\"][\"workspace\"][\"worktree\"][\"is_linked_worktree\"]")" = True ] && [ "$(printf "%s" "$info" | json "d[\"result\"][\"workspace\"][\"worktree\"][\"repo_root\"]")" = "$repo" ] && [ "$(herdr worktree list --cwd "$wt" | json "d[\"result\"][\"source\"].get(\"source_workspace_id\")")" = "$rs" ]' "$info"
    check "the space and the tab carry the launch's name, shell syntax and all, as written" \
      '[ "$(printf "%s" "$info" | json "d[\"result\"][\"workspace\"][\"label\"]")" = "$NAME" ] && [ "$(herdr tab get "$tab" | json "d[\"result\"][\"tab\"][\"label\"]")" = "$NAME" ] && [ ! -e "$tmp/canary" ]'
    seen="" i=0
    while [ $i -lt 30 ]; do
      seen=$(herdr pane get "$pane" 2>/dev/null | json '"%s|%s" % (d["result"]["pane"].get("agent_status"), d["result"]["pane"].get("terminal_title_stripped"))')
      [ "$seen" = "working|$NAME" ] && break
      sleep 0.25; i=$((i + 1))
    done
    check "while it runs, the pane is working and its terminal title is the name" '[ "$seen" = "working|$NAME" ]' "$seen"
    check "its marker lands" 'marker "$tmp/logs/l1.done" 60'
    check "its stream and errors are what a direct run writes" 'cmp -s "$tmp/direct.out" "$tmp/logs/l1.out" && cmp -s "$tmp/direct.err" "$tmp/logs/l1.err"'
    sleep 1; screen=$(herdr pane read "$pane" --source recent-unwrapped --lines 40 2>/dev/null)
    check "the pane shows one line per event, not raw JSON" \
      'printf "%s" "$screen" | grep -q "says: step one" && printf "%s" "$screen" | grep -q "result: success" && ! printf "%s" "$screen" | grep -qF "{\"type\""' "$screen"
    check "and the launch is released when it ends" \
      '[ "$(herdr pane get "$pane" | json "d[\"result\"][\"pane\"].get(\"agent_status\")")" != working ]'
    (cd "$tmp/caller" && "$SELF" run "$NAME" "$wt" --out ../logs/l6.out --marker ../logs/l6.done -- ./probe.sh >/dev/null)
    check "the launch has no terminal, and a group of its own" \
      'marker "$tmp/logs/l6.done" 30 && [ "$(field "$tmp/logs/l6.out" tty)" = no ] && [ "$(field "$tmp/logs/l6.out" pgid)" = "$(field "$tmp/logs/l6.out" pid)" ]' "$(cat "$tmp/logs/l6.out" 2>/dev/null)"
    got=$(cd "$tmp/caller" && "$SELF" run "$NAME" "$wt" --marker ../logs/l5.done --pidfile ../logs/l5.pid -- sleep 120)
    sleep 2; herdr tab close "$(printf '%s' "$got" | sed -n 's/.*tab=\([^ ]*\).*/\1/p')" >/dev/null 2>&1
    check "closing a launch's pane mid-run stops it, and its marker still lands" \
      'marker "$tmp/logs/l5.done" 10 && ! kill -0 "$(cat "$tmp/logs/l5.pid")" 2>/dev/null' "$got"
    rev=$repo/.worktrees/T-1-rev-luna
    got=$(cd "$tmp/caller" && "$SELF" run "$NAME review" "$rev" --marker ../logs/l2.done -- ./fixed.sh)
    rspace=$(printf '%s' "$got" | sed -n 's/.*space=\([^ ]*\).*/\1/p'); [ -n "$rspace" ] && opened+=("$rspace")
    check "a detached reviewer scratch opens as a space too" '[ -n "$rspace" ] && [ "$(openspace "$rev")" = "$rspace" ] && marker "$tmp/logs/l2.done" 60' "$got"
    got=$(cd "$tmp/caller" && "$SELF" run "$NAME security review" "$clone" --marker ../logs/l7.done -- ./fixed.sh)
    cspace=$(printf '%s' "$got" | sed -n 's/.*space=\([^ ]*\).*/\1/p'); [ -n "$cspace" ] && opened+=("$cspace")
    check "a reviewer's scratch clone opens as a space of its own" \
      '[ -n "$cspace" ] && [ "$(openspace "$clone")" = "$cspace" ] && [ "$(herdr workspace get "$cspace" | json "d[\"result\"][\"workspace\"][\"label\"]")" = "$NAME security review" ] && marker "$tmp/logs/l7.done" 60' "$got"
    check "and close shuts it" '"$SELF" close "$clone" >/dev/null && [ -z "$(openspace "$clone")" ]'
    "$SELF" close "$repo" >/dev/null 2>&1; i=$?
    check "close refuses the repository's own space" '[ $i -eq 2 ]'
    check "close shuts the worktree's space, and only that" '"$SELF" close "$wt" >/dev/null && [ -z "$(openspace "$wt")" ] && [ "$(openspace "$rev")" = "$rspace" ]'
    check "and the reviewer's" '"$SELF" close "$rev" >/dev/null && [ -z "$(openspace "$rev")" ]'

    echo "no host, the negative control"
    wt=$repo/.worktrees/T-1-sol
    before=$(herdr workspace list | json 'len(d["result"]["workspaces"])')
    got=$(cd "$tmp/caller" && POSTMASTER_HOST=none "$SELF" run "$NAME" "$wt" --out ../logs/l3.out --err ../logs/l3.err --marker ../logs/l3.done -- ./fixed.sh)
    check "the same launch runs in the background" '[ "$got" = host=none ]' "$got"
    check "no space opens for it" '[ -z "$(openspace "$wt")" ] && [ "$(herdr workspace list | json "len(d[\"result\"][\"workspaces\"])")" = "$before" ]'
    check "its marker lands" 'marker "$tmp/logs/l3.done" 60'
    check "its stream and errors are the same" 'cmp -s "$tmp/direct.out" "$tmp/logs/l3.out" && cmp -s "$tmp/direct.err" "$tmp/logs/l3.err"'
  else
    echo "Herdr: no server answers here; its controls are skipped"
  fi

  if has tmux; then
    echo "tmux"
    wt=$repo/.worktrees/T-1-sol
    got=$(cd "$tmp/caller" && POSTMASTER_HOST=tmux "$SELF" run "$NAME" "$wt" --out ../logs/l4.out --err ../logs/l4.err --marker ../logs/l4.done -- ./fixed.sh)
    tsession=$(printf '%s' "$got" | sed -n 's/.*session=\([^ ]*\).*/\1/p')
    check "the launch runs in a window of session postmaster-<repo>, named for it" \
      '[ "$tsession" = "postmaster-$rname" ] && tmux list-windows -t "=$tsession" -F "#{window_name}" | grep -qxF "$NAME"' "$got"
    check "its marker lands" 'marker "$tmp/logs/l4.done" 60'
    check "its stream and errors are the same" 'cmp -s "$tmp/direct.out" "$tmp/logs/l4.out" && cmp -s "$tmp/direct.err" "$tmp/logs/l4.err"'
    check "close kills the worktree's window" 'POSTMASTER_HOST=tmux "$SELF" close "$wt" >/dev/null && ! tmux list-windows -t "=$tsession" -F "#{window_name}" 2>/dev/null | grep -qxF "$NAME"'
  else
    echo "tmux: not on PATH; its controls are skipped"
  fi

  finish "live test"
}

case ${1:-} in
  detect) detect ;;
  name) shift; name_cmd "$@" ;;
  run) shift; run_cmd "$@" ;;
  stop) shift; stop_cmd "$@" ;;
  close) shift; close_cmd "$@" ;;
  spawn) shift; spawn_cmd "$@" ;;
  send) shift; send_cmd "$@" ;;
  wait) shift; wait_cmd "$@" ;;
  read) shift; read_cmd "$@" ;;
  start) shift; start_cmd "$@" ;;
  prompt) shift; prompt_cmd "$@" ;;
  state) shift; state_cmd "$@" ;;
  report) shift; report_cmd "$@" ;;
  end) shift; end_cmd "$@" ;;
  _run) runner "$2" "$3" ;;
  _shell) live_shell "$2" ;;
  _handle) handle_of "$2" ;;
  _stubs) write_stubs "$2" ;;
  --self-test) self_test ;;
  --live-test) live_test ;;
  *) echo "usage: host.sh detect | name | run | stop | close | spawn | send | wait | read | start | prompt | state | report | end | --self-test | --live-test (see the header)" >&2; exit 1 ;;
esac
