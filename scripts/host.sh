#!/usr/bin/env bash
# The session host: where a launch runs and how the user watches it. Herdr wherever a Herdr
# server answers, tmux where it does not, and a detached background process with neither.
# skills/postmaster/hosts.md records each form per host; this script is their executable
# form, and the two change together.
#
#   host.sh detect                        herdr, tmux or none, on stdout
#   host.sh run <name> <cwd> [--out <file>] [--err <file>] [--append] [--marker <file>]
#               [--pidfile <file>] -- <command...>
#   host.sh close <worktree>              close the space (Herdr) or windows (tmux) of a worktree
#   host.sh spawn <handle> <cwd> [--label <text>] -- <command...>   an interactive session; the
#                                         handle is lowercased to a Herdr agent name
#   host.sh send <handle> <file> [--wait [<seconds>]]   submit the file's text to that session,
#                                         and with --wait block until it settles (default 600)
#   host.sh wait <handle> [<seconds>]     block until it settles, when nothing was just sent
#   host.sh read <handle> [<lines>]       print what it shows (default 120 lines)
#   host.sh --self-test                   stub hosts on PATH; never touches a live server
#   host.sh --live-test                   the ticket's controls, against the hosts on this machine
#
# run: <command> is the same headless command a caller would otherwise background with `&`. It
# runs from the directory host.sh was called in, with the caller's environment, its stdout to
# --out and its stderr to --err (appended with --append), and --marker is touched when it exits,
# whatever its exit. <cwd> is the directory the launch belongs to, usually its worktree: in
# Herdr the launch runs in a new tab of that worktree's space, opened with `herdr worktree open`
# under the repository's space if it is not open yet; in tmux it runs in a window of session
# postmaster-<repo>; with no host, detached from the caller. <name> labels the space when
# host.sh opens it, the tab or window, and the pane's title, and names the thread where the
# harness can (POSTMASTER_LAUNCH_NAME, read by launch.sh). A pane shows the stream through
# view-stream.sh. The launch carries its own pane's identity (HERDR_PANE_ID and the like, or
# TMUX_PANE), never its caller's. If the host cannot place it, it runs in the background.
#
# POSTMASTER_HOST=herdr|tmux|none overrides detection; nothing needs setting to get the default.
#
#   exit 0  detected, started, closed, sent, settled or read
#   exit 1  usage, or nothing could be started
#   exit 2  close refused: the space or a window holds something host.sh did not open, or a
#           launch that is still running
#   exit 3  spawn, send, wait or read with no host that keeps an interactive session; or a
#           wait that timed out
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
SELF=$HERE/$(basename "$0")
SOURCE=custom:postmaster        # Herdr source for a launch's agent state
META=custom:postmaster-meta     # Herdr source for its name and ownership tokens
CLAIM_WAIT=${POSTMASTER_HOST_CLAIM_WAIT:-20}   # seconds a new pane has to start its launch
PANE_IDS="HERDR_PANE_ID HERDR_TAB_ID HERDR_WORKSPACE_ID TMUX_PANE"   # which pane a process is in

die()  { echo "host: $*" >&2; exit 1; }
warn() { echo "host: $*" >&2; }
has()  { command -v "$1" >/dev/null 2>&1; }
limit() { local s=$1; shift; if has timeout; then timeout "$s" "$@"; else "$@"; fi; }
q() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }   # quote for any shell
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

repo_of() {  # repo_of <dir>: the main checkout's path, or nothing outside a repository
  local common
  common=$(git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || return 1
  case $common in */.git) dirname "$common" ;; *) printf '%s\n' "$common" ;; esac
}
tmux_session() {  # tmux_session <dir>: postmaster-<repo>, with the characters tmux refuses replaced
  local repo; repo=$(repo_of "$1") || repo=$1
  printf 'postmaster-%s\n' "$(basename "$repo" | tr '.:' '__')"
}

# --- Herdr placement --------------------------------------------------------------------
# herdr_place <name> <cwd> [repo]: find or open the space for <cwd> and a pane in it. With
# `repo`, the pane goes in the repository's own space whatever worktree <cwd> is. Prints
# "<space> <tab> <pane>".
herdr_place() {
  local name=$1 cwd=$2 where=${3:-worktree} top list src root rname wpath wkind wopen out space tab pane opened=0
  top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || top=""
  src="" root=""
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
  if [ -z "$root" ] || [ "${wpath:--}" = - ]; then
    # Not a checkout Herdr can read: a space of the launch's own.
    out=$(herdr workspace create --cwd "$cwd" --label "$name" --no-focus) || return 1
    space=$(printf '%s' "$out" | json 'd["result"]["workspace"]["workspace_id"]')
    tab=$(printf '%s' "$out" | json 'd["result"]["tab"]["tab_id"]')
    pane=$(printf '%s' "$out" | json 'd["result"]["root_pane"]["pane_id"]')
    opened=1
  else
    if [ -z "$src" ]; then   # the repository has no space yet: open it, so the worktree nests
      out=$(herdr workspace create --cwd "$root" --label "$rname" --no-focus) || return 1
      src=$(printf '%s' "$out" | json 'd["result"]["workspace"]["workspace_id"]')
      [ "$wkind" = main ] && wopen=$src
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
    if [ -z "${pane:-}" ]; then
      out=$(herdr tab create --workspace "$space" --cwd "$cwd" --label "$name" --no-focus) || return 1
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

# --- run ----------------------------------------------------------------------------------
# A launch is handed to its runner through a private directory: the fields as files, the argv
# NUL-separated, and, for a pane, the caller's environment through a FIFO, so it is never
# written to disk. Whoever creates <spec>/claimed first runs it; the runner removes the spec.
write_spec() {  # write_spec <spec> <name> <out> <err> <marker> <pidfile> <append> <argv...>
  local spec=$1; shift
  printf '%s' "$1" > "$spec/name"; printf '%s' "$PWD" > "$spec/rundir"
  printf '%s' "$2" > "$spec/out";  printf '%s' "$3" > "$spec/err"
  printf '%s' "$4" > "$spec/marker"; printf '%s' "$5" > "$spec/pidfile"; printf '%s' "$6" > "$spec/append"
  shift 6
  printf '%s\0' "$@" > "$spec/argv"
}
dump_env() { python3 -c 'import os, sys
for k, v in os.environb.items(): sys.stdout.buffer.write(k + b"=" + v + b"\0")'; }

watch_exit() {  # watch_exit <pid> <marker>: touch the marker once <pid> is gone, from outside the pane,
  # so it lands even when the pane is closed and takes its runner with it
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
    --token postmaster=launch --token state=running --token pid=$$ >/dev/null 2>&1
  while kill -0 "$cpid" 2>/dev/null; do sleep 0.25; done
  herdr pane release-agent "$HERDR_PANE_ID" --source "$SOURCE" --agent headless >/dev/null 2>&1
  herdr pane report-metadata "$HERDR_PANE_ID" --source "$META" --title "$name" --display-agent "$name" \
    --token postmaster=launch --token state=done --token pid=$$ >/dev/null 2>&1
}

start_detached() {  # start_detached <spec>: the runner in its own session, outliving the caller
  python3 -c 'import os, sys
if os.fork(): os._exit(0)
os.setsid()
os.execv(sys.argv[1], sys.argv[1:])' "$SELF" _run bg "$1" </dev/null >/dev/null 2>&1
}

run() {
  local name=${1:?usage: host.sh run <name> <cwd> [options] -- <command...>} cwd=${2:?usage: host.sh run <name> <cwd> [options] -- <command...>}
  shift 2
  local out="" err="" marker="" pidfile="" append=0
  while [ $# -gt 0 ]; do
    case $1 in
      --out) out=${2:?--out needs a file}; shift ;;
      --err) err=${2:?--err needs a file}; shift ;;
      --marker) marker=${2:?--marker needs a file}; shift ;;
      --pidfile) pidfile=${2:?--pidfile needs a file}; shift ;;
      --append) append=1 ;;
      --) shift; break ;;
      *) die "unknown option for run: $1 (the command goes after --)" ;;
    esac
    shift
  done
  [ $# -gt 0 ] || die "run needs a command after --"
  [ -d "$cwd" ] || die "no such directory: $cwd"
  cwd=$(cd "$cwd" && pwd -P)
  abs() { case $1 in ""|/*) printf '%s' "$1" ;; *) printf '%s/%s' "$PWD" "$1" ;; esac; }
  out=$(abs "$out"); err=$(abs "$err"); marker=$(abs "$marker"); pidfile=$(abs "$pidfile")

  local spec host
  [ -n "$pidfile" ] && rm -f -- "$pidfile"          # never leave a caller an earlier launch's pid
  spec=$(mktemp -d "${TMPDIR:-/tmp}/postmaster-host.XXXXXX") || die "cannot make a spec directory"
  write_spec "$spec" "$name" "$out" "$err" "$marker" "$pidfile" "$append" "$@"
  host=$(detect)

  local where="" writer=""
  case $host in
    herdr)
      local placed
      if placed=$(herdr_place "$name" "$cwd"); then
        set -- $placed
        mkfifo "$spec/env" && { ( dump_env > "$spec/env" ) 2>/dev/null & writer=$!; }
        if herdr pane run "$3" " $(q "$SELF") _run herdr $(q "$spec")" >/dev/null 2>&1; then
          where="host=herdr space=$1 tab=$2 pane=$3"
        fi
      fi
      [ -n "$where" ] || warn "Herdr could not place '$name'; running it in the background" ;;
    tmux)
      local session win
      session=$(tmux_session "$cwd")
      mkfifo "$spec/env" && { ( dump_env > "$spec/env" ) 2>/dev/null & writer=$!; }
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
    while [ ! -d "$spec/claimed" ] && [ -d "$spec" ] && [ $i -lt $((CLAIM_WAIT * 4)) ]; do sleep 0.25; i=$((i + 1)); done
    if mkdir "$spec/claimed" 2>/dev/null; then   # the pane never started it: nothing ran yet
      warn "the $host pane did not start '$name' within ${CLAIM_WAIT}s; running it in the background"
      where=""
    fi
  else
    mkdir "$spec/claimed" 2>/dev/null
  fi
  if [ -z "$where" ]; then
    start_detached "$spec" || die "could not start '$name' in the background"
    where="host=none"
  fi
  # The runner removes the spec once it has read it, and writes the pid file as it starts the
  # command, so a caller can use either as soon as this returns.
  local i=0
  while [ -d "$spec" ] && [ $i -lt 40 ]; do sleep 0.25; i=$((i + 1)); done
  [ -n "$writer" ] && kill "$writer" 2>/dev/null
  if [ -d "$spec" ] && [ "$where" = host=none ]; then die "'$name' did not start in the background"; fi
  if [ -n "$pidfile" ]; then i=0; while [ ! -s "$pidfile" ] && [ $i -lt 40 ]; do sleep 0.25; i=$((i + 1)); done; fi
  echo "$where"
}

# The runner: _run <herdr|tmux|bg> <spec>. In a pane it claims the launch first; in the
# background the caller has already claimed it.
runner() {
  local mode=$1 spec=$2
  if [ "$mode" != bg ]; then
    mkdir "$spec/claimed" 2>/dev/null || { echo "host: this launch was started elsewhere; nothing to do here."; return 0; }
  fi
  local name rundir out err marker pidfile append argv=() envs=() kv k
  name=$(cat "$spec/name"); rundir=$(cat "$spec/rundir"); out=$(cat "$spec/out"); err=$(cat "$spec/err")
  marker=$(cat "$spec/marker"); pidfile=$(cat "$spec/pidfile"); append=$(cat "$spec/append")
  while IFS= read -r -d '' kv; do argv+=("$kv"); done < "$spec/argv"
  if [ "$mode" != bg ] && [ -p "$spec/env" ]; then
    while IFS= read -r -d '' kv; do envs+=("$kv"); done < "$spec/env"
  else
    while IFS= read -r -d '' kv; do envs+=("$kv"); done < <(dump_env)
  fi
  rm -f -- "$spec"/name "$spec"/rundir "$spec"/out "$spec"/err "$spec"/marker "$spec"/pidfile "$spec"/append "$spec"/argv "$spec"/env
  rmdir -- "$spec/claimed" "$spec" 2>/dev/null

  # The launch's environment is its caller's, except for identity: which pane it is in comes
  # from where it actually runs, so nothing it reports lands in its caller's pane.
  local drop="POSTMASTER_LAUNCH_NAME $PANE_IDS" keep=""
  case $mode in
    herdr) drop="$drop HERDR_ENV HERDR_SOCKET_PATH HERDR_BIN_PATH"; keep="HERDR_PANE_ID HERDR_TAB_ID HERDR_WORKSPACE_ID HERDR_ENV HERDR_SOCKET_PATH HERDR_BIN_PATH" ;;
    tmux)  drop="$drop TMUX"; keep="TMUX TMUX_PANE" ;;
  esac
  local childenv=()
  for kv in "${envs[@]}"; do
    k=${kv%%=*}
    case " $drop " in *" $k "*) continue ;; esac
    childenv+=("$kv")
  done
  for k in $keep; do [ -n "${!k+x}" ] && childenv+=("$k=${!k}"); done
  childenv+=("POSTMASTER_LAUNCH_NAME=$name")

  local o=/dev/null e=/dev/null from=0 cpid rc=0 vpid="" rpid="" t0
  [ "$mode" != bg ] && { o=/dev/stdout; e=/dev/stderr; }
  [ -n "$out" ] && o=$out
  [ -n "$err" ] && e=$err
  [ "$append" = 1 ] && [ -f "$out" ] && from=$(wc -c < "$out" | tr -d ' ')
  t0=$(date +%s)
  if [ "$append" = 1 ]; then
    ( cd "$rundir" && exec env -i "${childenv[@]}" "${argv[@]}" ) >> "$o" 2>> "$e" &
  else
    ( cd "$rundir" && exec env -i "${childenv[@]}" "${argv[@]}" ) > "$o" 2> "$e" &
  fi
  cpid=$!
  [ -n "$pidfile" ] && printf '%s\n' "$cpid" > "$pidfile"
  trap 'kill -TERM "$cpid" 2>/dev/null' HUP INT TERM

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
  [ "$mode" = bg ] && return 0

  [ -n "$vpid" ] && wait "$vpid" 2>/dev/null
  [ -n "$rpid" ] && wait "$rpid" 2>/dev/null
  [ "$mode" = tmux ] && tmux set-option -w -t "${TMUX_PANE:-}" @postmaster_state done >/dev/null 2>&1
  printf '%s\nexit %s at %s after %ss%s\n' "----" "$rc" "$(date '+%H:%M:%S')" "$(( $(date +%s) - t0 ))" \
    "${marker:+, marker $marker}"
  return 0
}

# --- close ------------------------------------------------------------------------------
close_space() {
  local path=${1:?usage: host.sh close <worktree>} host
  [ -d "$path" ] || die "no such directory: $path"
  path=$(cd "$path" && pwd -P)
  host=$(detect)
  case $host in
    none) echo "host=none: nothing to close"; return 0 ;;
    tmux)
      local session wins w cwd dead state n=0
      session=$(tmux_session "$path")
      tmux has-session -t "=$session" 2>/dev/null || { echo "host=tmux: no session $session"; return 0; }
      local busy tries=0
      while :; do   # a launch whose marker just landed is marked done a moment later
        wins=$(tmux list-windows -t "=$session" -F '#{window_id}	#{@postmaster_cwd}	#{pane_dead}	#{@postmaster_state}')
        busy=""
        while IFS=$'\t' read -r w cwd dead state; do
          [ "$cwd" = "$path" ] && [ "$state" = running ] && [ "$dead" != 1 ] && busy=$w
        done <<< "$wins"
        [ -z "$busy" ] && break
        [ $tries -ge 15 ] && { warn "a launch is still running in tmux window $busy"; return 2; }
        sleep 1; tries=$((tries + 1))
      done
      while IFS=$'\t' read -r w cwd dead state; do
        [ "$cwd" = "$path" ] || continue
        tmux kill-window -t "$w" && n=$((n + 1))
      done <<< "$wins"
      echo "host=tmux: closed $n window(s) of $path"; return 0 ;;
  esac
  local list space kind verdict
  list=$(herdr worktree list --cwd "$path" 2>/dev/null) || { echo "host=herdr: $path is not a checkout Herdr knows"; return 0; }
  read -r space kind < <(printf '%s' "$list" | python3 -c '
import json, os, sys
d = json.load(sys.stdin)["result"]
p = os.path.realpath(sys.argv[1])
w = next((w for w in d.get("worktrees") or [] if os.path.realpath(w["path"]) == p), {})
print(w.get("open_workspace_id") or "-", "linked" if w.get("is_linked_worktree") else "main")' "$path")
  [ "$space" = - ] && { echo "host=herdr: no space is open for $path"; return 0; }
  [ "$kind" = main ] && { warn "$path is a repository's own checkout; its space is never closed"; return 2; }
  local tries=0
  while :; do   # a launch whose marker just landed is marked done a moment later
  verdict=$(python3 -c '
import json, os, sys
docs = [json.loads(a) for a in sys.argv[1:3]]
ws = docs[0]["result"]["workspace"]
if (ws.get("tokens") or {}).get("postmaster") != "opened":
    print("space %s was not opened by host.sh" % ws["workspace_id"]); sys.exit(0)
for p in docs[1]["result"]["panes"]:
    t = p.get("tokens") or {}
    if t.get("postmaster") != "launch":
        print("pane %s in space %s was not opened by host.sh" % (p["pane_id"], ws["workspace_id"])); sys.exit(0)
    if t.get("state") == "running" and t.get("pid", "").isdigit():
        try:
            os.kill(int(t["pid"]), 0)
        except ProcessLookupError:
            continue
        except PermissionError:
            pass
        print("a launch is still running in pane %s" % p["pane_id"]); sys.exit(0)
print("ok")' "$(herdr workspace get "$space" 2>/dev/null)" "$(herdr pane list --workspace "$space" 2>/dev/null)" 2>/dev/null)
  case $verdict in "a launch is still running"*) [ $tries -lt 15 ] && { sleep 1; tries=$((tries + 1)); continue; } ;; esac
  break
  done
  [ "$verdict" = ok ] || { warn "${verdict:-could not read space $space}; left open"; return 2; }
  herdr workspace close "$space" >/dev/null || die "herdr could not close space $space"
  echo "host=herdr: closed space $space of $path"
}

# --- interactive sessions -----------------------------------------------------------------
handle_of() {  # handle_of <text>: a Herdr agent name, [a-z][a-z0-9_-]{0,31}, and the tmux window's
  local h; h=$(printf '%s' "$1" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9_-' '-')
  case $h in [a-z]*) ;; *) h=p$h ;; esac
  printf '%s\n' "${h:0:32}"
}
KINDS=" pi claude codex gemini cursor devin agy cline omp mastracode opencode copilot kimi kiro droid amp grok hermes kilo qodercli qwen letta maki muse "
no_session_host() {
  echo "host: no Herdr or tmux here to keep an interactive session; run it headless as a native session (hosts.md, none)" >&2
  exit 3
}
tmux_target() {  # tmux_target <handle>: the one window with that name, in any session
  local hits
  hits=$(tmux list-windows -a -F '#{window_id}	#{window_name}' 2>/dev/null | awk -F'\t' -v h="$1" '$2 == h {print $1}')
  [ -n "$hits" ] || die "no tmux window named $1"
  [ "$(printf '%s\n' "$hits" | wc -l | tr -d ' ')" -eq 1 ] || die "more than one tmux window is named $1"
  printf '%s\n' "$hits"
}

spawn() {
  local handle=${1:?usage: host.sh spawn <handle> <cwd> [--label <text>] -- <command...>} cwd=${2:?usage: host.sh spawn <handle> <cwd> [--label <text>] -- <command...>} label=""
  shift 2
  while [ $# -gt 0 ]; do
    case $1 in --label) label=${2:?--label needs text}; shift ;; --) shift; break ;; *) die "unknown option for spawn: $1" ;; esac
    shift
  done
  [ $# -gt 0 ] || die "spawn needs a command after --"
  [ -d "$cwd" ] || die "no such directory: $cwd"
  cwd=$(cd "$cwd" && pwd -P); label=${label:-$handle}; handle=$(handle_of "$handle")
  case $(detect) in
    herdr)
      local placed kind
      placed=$(herdr_place "$label" "$cwd" repo) || die "Herdr could not open a tab for $handle"
      set -- $placed "$@"
      kind=$(basename "$4")
      case $KINDS in
        *" $kind "*) local space=$1 tab=$2 pane=$3 err; shift 4
                     err=$(herdr agent start "$handle" --kind "$kind" --pane "$pane" -- "$@" 2>&1 >/dev/null) \
                       || warn "$handle is not ready for a message ($(printf '%s' "$err" | json 'd["error"]["message"]' 2>/dev/null || printf '%s' "$err")); answer it in space $space, then send" ;;
        *) local space=$1 tab=$2 pane=$3 cmd=""; shift 3
           for a in "$@"; do cmd="$cmd $(q "$a")"; done
           herdr pane run "$pane" "$cmd" >/dev/null || die "herdr could not start $handle"
           herdr agent rename "$pane" "$handle" >/dev/null 2>&1 ;;
      esac
      echo "host=herdr space=$space tab=$tab pane=$pane handle=$handle" ;;
    tmux)
      local session win
      session=$(tmux_session "$cwd")
      if tmux has-session -t "=$session" 2>/dev/null; then
        win=$(tmux new-window -d -P -F '#{window_id}' -t "=$session:" -n "$handle" -c "$cwd" "$@")
      else
        win=$(tmux new-session -d -P -F '#{window_id}' -s "$session" -n "$handle" -c "$cwd" "$@")
      fi
      [ -n "$win" ] || die "tmux could not start $handle"
      tmux set-option -w -t "$win" automatic-rename off >/dev/null 2>&1
      echo "host=tmux session=$session window=$win handle=$handle" ;;
    none) no_session_host ;;
  esac
}

send() {  # send <handle> <file> [--wait [<seconds>]]
  local handle=${1:?usage: host.sh send <handle> <file> [--wait [<seconds>]]} file=${2:?usage: host.sh send <handle> <file> [--wait [<seconds>]]}
  local waitfor=""
  [ "${3:-}" = --wait ] && waitfor=${4:-600}
  handle=$(handle_of "$handle")
  [ -f "$file" ] || die "no such file: $file"
  case $(detect) in
    herdr)
      # Sending and waiting are one call: a separate `agent wait` straight after a prompt can
      # return the previous turn's settled state before the new turn has started.
      local err code
      if [ -z "$waitfor" ]; then
        herdr agent prompt "$handle" "$(cat "$file")" >/dev/null || die "herdr could not prompt $handle"
      elif ! err=$(herdr agent prompt "$handle" "$(cat "$file")" --wait --timeout "$((waitfor * 1000))" 2>&1 >/dev/null); then
        code=$(printf '%s' "$err" | json 'd["error"]["code"]' 2>/dev/null)
        case $code in
          agent_prompt_stalled) warn "the message went in, but Herdr saw no turn start; read the session before sending it again"; exit 3 ;;
          agent_blocked) warn "$handle is at an approval or a question; answer it in Herdr first"; exit 3 ;;
          timeout) echo "sent; $handle did not settle within ${waitfor}s"; exit 3 ;;
          *) die "herdr could not prompt $handle: ${code:-$err}" ;;
        esac
      fi ;;
    tmux)
      local t buf=postmaster-send-$$
      t=$(tmux_target "$handle") || exit 1
      tmux load-buffer -b "$buf" "$file" && tmux paste-buffer -p -d -b "$buf" -t "$t" || die "tmux could not paste into $handle"
      sleep 0.5
      tmux send-keys -t "$t" Enter     # a separate key after the paste, never part of it
      [ -n "$waitfor" ] && { wait_settle "$handle" "$waitfor" >/dev/null || { echo "sent; $handle did not settle within ${waitfor}s"; exit 3; }; } ;;
    none) no_session_host ;;
  esac
  echo "sent $(wc -c < "$file" | tr -d ' ') bytes to $handle${waitfor:+, and it settled}"
}

wait_settle() {
  local handle=${1:?usage: host.sh wait <handle> [<seconds>]} secs=${2:-600}
  handle=$(handle_of "$handle")
  case $(detect) in
    herdr) herdr agent wait "$handle" --timeout "$((secs * 1000))" >/dev/null && { echo "$handle settled"; return 0; }
           echo "$handle did not settle within ${secs}s"; return 3 ;;
    tmux)
      # Settled when the screen has not changed for QUIET seconds.
      local t quiet=${POSTMASTER_HOST_QUIET:-10} last="" now same=0 end
      t=$(tmux_target "$handle") || exit 1
      end=$(( $(date +%s) + secs ))
      while [ "$(date +%s)" -lt "$end" ]; do
        now=$(tmux capture-pane -p -t "$t" 2>/dev/null) || die "tmux cannot read $handle"
        if [ "$now" = "$last" ]; then same=$((same + 2)); else same=0; last=$now; fi
        [ $same -ge "$quiet" ] && { echo "$handle settled"; return 0; }
        sleep 2
      done
      echo "$handle did not settle within ${secs}s"; return 3 ;;
    none) no_session_host ;;
  esac
}

read_pane() {
  local handle=${1:?usage: host.sh read <handle> [<lines>]} lines=${2:-120}
  handle=$(handle_of "$handle")
  case $(detect) in
    herdr) herdr agent read "$handle" --source recent-unwrapped --lines "$lines" ;;
    tmux) local t; t=$(tmux_target "$handle") || exit 1; tmux capture-pane -p -J -S "-$lines" -t "$t" ;;
    none) no_session_host ;;
  esac
}

case ${1:-} in
  detect) detect; exit 0 ;;
  run) shift; run "$@"; exit $? ;;
  close) shift; close_space "$@"; exit $? ;;
  spawn) shift; spawn "$@"; exit $? ;;
  send) shift; send "$@"; exit $? ;;
  wait) shift; wait_settle "$@"; exit $? ;;
  read) shift; read_pane "$@"; exit $? ;;
  _run) runner "$2" "$3"; exit $? ;;
  --self-test|--live-test) ;;
  *) echo "usage: host.sh detect | run | close | spawn | send | wait | read | --self-test | --live-test (see the header)" >&2; exit 1 ;;
esac

# --- shared by both tests -----------------------------------------------------------------
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/         /'; fails=$((fails+1)); }
check() { if eval "$2"; then ok "$1"; else fail "$1" "${3:-}"; fi; }   # check <label> <test> [<detail>]
marker() {  # marker <file> [<seconds>]: wait for a marker to land
  local i=0; while [ ! -e "$1" ] && [ $i -lt $(( ${2:-30} * 5 )) ]; do sleep 0.2; i=$((i + 1)); done; [ -e "$1" ]
}
repo=$tmp/hosttest-$$
git init -q -b main "$repo" && git -C "$repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m first || exit 1
for w in T-1-luna T-1-sol; do git -C "$repo" worktree add -q ".worktrees/$w" -b "wb/$w" || exit 1; done
git -C "$repo" worktree add -q --detach .worktrees/T-1-rev-luna || exit 1
repo=$(cd "$repo" && pwd -P); rname=$(basename "$repo")
mkdir -p "$tmp/caller" "$tmp/logs"
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
printf 'from=%s|name=%s|pane=%s|tmuxpane=%s|var=%s|sid=%s|pid=%s\n' "$PWD" "${POSTMASTER_LAUNCH_NAME:-}" \
  "${HERDR_PANE_ID:-unset}" "${TMUX_PANE:-unset}" "${CALLER_VAR:-unset}" "$(python3 -c 'import os; print(os.getsid(0))')" "$$"
echo x >> "${COUNT:-/dev/null}"
sleep "${EMIT_SLEEP:-0}"
EOF
chmod +x "$tmp/caller/fixed.sh" "$tmp/caller/probe.sh"
NAME="#1, A test ticket · luna"
field() { tr '|' '\n' < "$1" | sed -n "s/^$2=//p" | head -1; }   # field <probe output> <key>

if [ "${1:-}" = --self-test ]; then
# Stub hosts on a curated PATH, so no control can reach a live Herdr or tmux server. A stub
# pane or window runs what it is given with only a server's environment, never the caller's,
# so the environment a launch sees has to have come through host.sh.
mkdir -p "$tmp/bin" "$tmp/sys" "$tmp/stub"
for t in bash sh python3 git env cat mkdir rmdir rm mkfifo mktemp sleep date touch wc tr sed awk \
         dirname basename grep head tail cut sort cmp ls seq timeout find; do
  p=$(command -v "$t" 2>/dev/null) && [ ! -e "$tmp/sys/$t" ] && ln -s "$p" "$tmp/sys/$t"
done
cat > "$tmp/bin/herdr" <<'EOF'
#!/usr/bin/env python3
import fcntl, json, os, subprocess, sys
S = os.environ["STUB"]; a = sys.argv[1:]
with open(os.path.join(S, "herdr.calls"), "a") as f: f.write("\t".join(a) + "\n")
if os.path.exists(os.path.join(S, "herdr.down")): sys.exit(1)
lock = open(os.path.join(S, "herdr.lock"), "w"); fcntl.flock(lock, fcntl.LOCK_EX)
path = os.path.join(S, "herdr.json")
st = json.load(open(path)) if os.path.exists(path) else {"n": 0, "spaces": {}, "panes": {}, "open": {}}
def save(): json.dump(st, open(path, "w"))
def new(prefix): st["n"] += 1; return "%s%d" % (prefix, st["n"])
def opt(name): return a[a.index(name) + 1] if name in a else None
def tokens(): return dict(a[i + 1].split("=", 1) for i in range(len(a) - 1) if a[i] == "--token")
def out(obj): print(json.dumps({"id": "stub", "result": obj}))
def git(*args): return subprocess.run(["git", *args], capture_output=True, text=True).stdout.strip()
def main_of(d):
    c = git("-C", d, "rev-parse", "--path-format=absolute", "--git-common-dir")
    return os.path.realpath(os.path.dirname(c)) if c else None
def space(label):
    ws, tab, pane = new("w"), new("t"), new("p")
    st["spaces"][ws] = {"label": label, "tokens": {}, "panes": [pane]}; st["panes"][pane] = {"ws": ws, "tokens": {}}
    return {"workspace": {"workspace_id": ws}, "tab": {"tab_id": tab}, "root_pane": {"pane_id": pane}}
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
    r = space(opt("--label")); cwd = os.path.realpath(opt("--cwd"))
    if main_of(cwd) == cwd: st["open"][cwd] = r["workspace"]["workspace_id"]
    save(); out(r)
elif cmd == "worktree open":
    r = space(opt("--label")); st["open"][os.path.realpath(opt("--path"))] = r["workspace"]["workspace_id"]
    save(); out(r)
elif cmd == "tab create":
    ws = opt("--workspace"); tab, pane = new("t"), new("p")
    st["spaces"][ws]["panes"].append(pane); st["panes"][pane] = {"ws": ws, "tokens": {}}
    save(); out({"tab": {"tab_id": tab}, "root_pane": {"pane_id": pane}})
elif cmd == "workspace report-metadata": st["spaces"][a[2]]["tokens"] = tokens(); save()
elif cmd == "pane report-metadata": st["panes"][a[2]]["tokens"] = tokens(); save()
elif cmd == "workspace get":
    out({"workspace": {"workspace_id": a[2], "tokens": st["spaces"][a[2]]["tokens"]}})
elif cmd == "pane list":
    out({"panes": [{"pane_id": p, "tokens": st["panes"][p]["tokens"]} for p in st["spaces"][opt("--workspace")]["panes"]]})
elif cmd == "pane get": out({"pane": {"pane_id": a[2], "agent": None}})
elif cmd == "pane run":
    pane, text, ws = a[2], a[3], st["panes"][a[2]]["ws"]
    fcntl.flock(lock, fcntl.LOCK_UN)
    if os.path.exists(os.path.join(S, "pane.dead")): sys.exit(0)          # accepted, never run
    late = "sleep 5; " if os.path.exists(os.path.join(S, "pane.late")) else ""
    env = {"PATH": os.environ["PATH"], "HOME": os.environ.get("HOME", "/"), "STUB": S, "HERDR_ENV": "1",
           "HERDR_PANE_ID": pane, "HERDR_TAB_ID": "tab-of-" + pane, "HERDR_WORKSPACE_ID": ws}
    subprocess.Popen(["bash", "-c", late + text], env=env, stdin=subprocess.DEVNULL, start_new_session=True,
                     stdout=open(os.path.join(S, "pane-%s.out" % pane), "ab"), stderr=subprocess.STDOUT)
elif cmd == "agent read": print("stub screen of " + a[2])
EOF
cat > "$tmp/bin/tmux" <<'EOF'
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
    try:
        subprocess.Popen(a[a.index("-c") + 2:], env=env, stdin=subprocess.DEVNULL, start_new_session=True,
                         stdout=open(os.path.join(S, "win-%d.out" % st["n"]), "ab"), stderr=subprocess.STDOUT)
    except OSError:
        pass                                    # a window whose command is missing dies at once
    print(win)
if a[0] == "has-session": sys.exit(0 if opt("-t").lstrip("=") in st["sessions"] else 1)
elif a[0] == "new-session": st["sessions"].append(opt("-s")); launch(opt("-s"))
elif a[0] == "new-window": launch(opt("-t").lstrip("=").rstrip(":"))
elif a[0] == "set-option":
    t = opt("-t"); w = t if t in st["windows"] else "@" + t.lstrip("%")
    if w in st["windows"]: st["windows"][w]["opts"][a[-2]] = a[-1]; save()
elif a[0] == "list-windows":
    for w, v in st["windows"].items():
        if "-a" in a: print("%s\t%s" % (w, v["name"]))
        elif v["session"] == opt("-t").lstrip("="):
            print("\t".join([w, v["opts"].get("@postmaster_cwd", ""), "0", v["opts"].get("@postmaster_state", "")]))
elif a[0] == "capture-pane": print("stub screen")
EOF
chmod +x "$tmp/bin/herdr" "$tmp/bin/tmux"
SYS=$tmp/sys; STUBS=$tmp/bin:$tmp/sys
hs() {  # hs <PATH> [VAR=value ...] -- <host.sh arguments>: host.sh in a clean environment
  local p=$1 vars=(); shift
  while [ "$1" != -- ]; do vars+=("$1"); shift; done; shift
  env -i HOME="$HOME" PATH="$p" STUB="$tmp/stub" TMPDIR="$tmp" POSTMASTER_HOST_CLAIM_WAIT=3 "${vars[@]}" "$SELF" "$@"
}
reset() { rm -f -- "$tmp"/stub/*; }
calls() { cat "$tmp/stub/$1.calls" 2>/dev/null; }
T=$'\t'

echo "detect"
check "a Herdr server that answers is the host" '[ "$(hs "$STUBS" -- detect)" = herdr ]'
touch "$tmp/stub/herdr.down"
check "with no Herdr server answering, tmux is" '[ "$(hs "$STUBS" -- detect)" = tmux ]'
reset
check "with neither on PATH, none" '[ "$(hs "$SYS" -- detect)" = none ]'
check "POSTMASTER_HOST=none wins over a live Herdr" '[ "$(hs "$STUBS" POSTMASTER_HOST=none -- detect)" = none ]'
check "POSTMASTER_HOST=tmux wins over a live Herdr" '[ "$(hs "$STUBS" POSTMASTER_HOST=tmux -- detect)" = tmux ]'

echo "run, no host: the same headless command, backgrounded"
( cd "$tmp/caller" && ./fixed.sh > "$tmp/direct.out" 2> "$tmp/direct.err" )
got=$(cd "$tmp/caller" && hs "$SYS" -- run "$NAME" "$repo/.worktrees/T-1-luna" --out ../logs/n1.out --err ../logs/n1.err \
      --marker ../logs/n1.done -- ./fixed.sh)
check "it says it ran in the background" '[ "$got" = host=none ]' "$got"
marker "$tmp/logs/n1.done"
check "stdout and stderr are byte for byte a direct run's" 'cmp -s "$tmp/direct.out" "$tmp/logs/n1.out" && cmp -s "$tmp/direct.err" "$tmp/logs/n1.err"'
(cd "$tmp/caller" && hs "$SYS" EMIT_SLEEP=2 -- run "$NAME" "$repo" --marker ../logs/n2.done -- ./fixed.sh >/dev/null)
sleep 0.7
check "the marker is not there while the launch runs" '[ ! -e "$tmp/logs/n2.done" ]'
check "and lands when it exits, whatever its exit" 'marker "$tmp/logs/n2.done" 20'
(cd "$tmp/caller" && hs "$SYS" CALLER_VAR=v HERDR_PANE_ID=caller-pane TMUX_PANE=%9 -- run "$NAME" "$repo/.worktrees/T-1-luna" \
   --out ../logs/n3.out --marker ../logs/n3.done --pidfile ../logs/n3.pid -- ./probe.sh >/dev/null)
marker "$tmp/logs/n3.done"
check "it runs from the caller's directory, with the caller's environment and its name" \
  '[ "$(field "$tmp/logs/n3.out" from)" = "$tmp/caller" ] && [ "$(field "$tmp/logs/n3.out" var)" = v ] && [ "$(field "$tmp/logs/n3.out" name)" = "$NAME" ]' "$(cat "$tmp/logs/n3.out")"
check "but never with its caller's pane" '[ "$(field "$tmp/logs/n3.out" pane)" = unset ] && [ "$(field "$tmp/logs/n3.out" tmuxpane)" = unset ]' "$(cat "$tmp/logs/n3.out")"
check "it is detached: its session is not the caller's" '[ "$(field "$tmp/logs/n3.out" sid)" != "$(python3 -c "import os; print(os.getsid(0))")" ]'
check "--pidfile holds the launch's pid" '[ "$(cat "$tmp/logs/n3.pid")" = "$(field "$tmp/logs/n3.out" pid)" ]'
(cd "$tmp/caller" && hs "$SYS" EMIT_SLEEP=3 -- run "$NAME" "$repo" --pidfile ../logs/n5.pid --marker ../logs/n5.done -- ./fixed.sh >/dev/null)
check "and it is there, for a live process, the moment run returns" '[ -s "$tmp/logs/n5.pid" ] && kill -0 "$(cat "$tmp/logs/n5.pid")" 2>/dev/null'
marker "$tmp/logs/n5.done"
printf 'before\n' > "$tmp/logs/n4.out"
(cd "$tmp/caller" && hs "$SYS" -- run "$NAME" "$repo" --out ../logs/n4.out --append --marker ../logs/n4.done -- ./fixed.sh >/dev/null)
marker "$tmp/logs/n4.done"
check "--append keeps what the stream held" '[ "$(head -1 "$tmp/logs/n4.out")" = before ] && [ "$(wc -l < "$tmp/logs/n4.out")" -eq 4 ]'
hs "$SYS" -- run "$NAME" "$repo" ./fixed.sh >/dev/null 2>&1; rc=$?
check "a command without -- is refused" '[ $rc -eq 1 ]'
hs "$SYS" -- run "$NAME" "$tmp/nowhere" -- ./fixed.sh >/dev/null 2>&1; rc=$?
check "a directory that does not exist is refused" '[ $rc -eq 1 ]'

echo "run, Herdr (stub): a pane in the worktree's space, nested under the repository's"
reset
got=$(cd "$tmp/caller" && hs "$STUBS" CALLER_VAR=v HERDR_PANE_ID=caller-pane -- run "$NAME" "$repo/.worktrees/T-1-luna" \
      --out ../logs/h1.out --err ../logs/h1.err --marker ../logs/h1.done -- ./probe.sh)
check "it says where it ran" 'case $got in "host=herdr space=w"*" pane=p"*) true ;; *) false ;; esac' "$got"
space=${got#*space=}; space=${space%% *}; pane=${got##*pane=}
repo_space=$(calls herdr | awk -F'\t' '$1 == "workspace" && $2 == "create" {print NR; exit}')
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
(cd "$tmp/caller" && hs "$STUBS" -- run "$NAME" "$repo/.worktrees/T-1-luna" --marker ../logs/h6.done --pidfile ../logs/h6.pid -- sleep 60 >/dev/null)
kill -KILL -- "-$(python3 -c "import os; print(os.getpgid($(cat "$tmp/logs/h6.pid")))")" 2>/dev/null
check "a pane killed outright mid-run: the launch stops, and its marker still lands" \
  'marker "$tmp/logs/h6.done" 10 && ! kill -0 "$(cat "$tmp/logs/h6.pid")" 2>/dev/null'
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

echo "close, Herdr (stub)"
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
sleep 60 & live=$!
python3 - "$tmp/stub/herdr.json" "$repo/.worktrees/T-1-sol" "$live" <<'PY'
import json, sys
st = json.load(open(sys.argv[1])); ws = st["open"][sys.argv[2]]
for p in st["spaces"][ws]["panes"]: st["panes"][p]["tokens"] = {"postmaster": "launch", "state": "running", "pid": sys.argv[3]}
json.dump(st, open(sys.argv[1], "w"))
PY
hs "$STUBS" -- close "$repo/.worktrees/T-1-sol" >/dev/null 2>&1; rc=$?
kill "$live" 2>/dev/null
check "a space whose launch is still running is refused" '[ $rc -eq 2 ]'

echo "run and close, tmux (stub)"
reset
got=$(cd "$tmp/caller" && hs "$STUBS" POSTMASTER_HOST=tmux CALLER_VAR=v -- run "$NAME" "$repo/.worktrees/T-1-sol" --out ../logs/t1.out --marker ../logs/t1.done -- ./probe.sh)
marker "$tmp/logs/t1.done"
check "a first launch opens session postmaster-<repo>, a window named for it" \
  'calls tmux | grep -q "^new-session${T}-d${T}-P${T}-F${T}#{window_id}${T}-s${T}postmaster-$rname${T}-n${T}$NAME${T}"' "$got"
check "the launch ran with that window's pane and its caller's environment" '[ "$(field "$tmp/logs/t1.out" tmuxpane)" = %1 ] && [ "$(field "$tmp/logs/t1.out" var)" = v ]' "$(cat "$tmp/logs/t1.out")"
(cd "$tmp/caller" && hs "$STUBS" POSTMASTER_HOST=tmux -- run "$NAME" "$repo/.worktrees/T-1-sol" --marker ../logs/t2.done -- ./fixed.sh >/dev/null)
marker "$tmp/logs/t2.done"; sleep 1
check "the next is a window in the same session" 'calls tmux | grep -q "^new-window${T}-d${T}-P${T}-F${T}#{window_id}${T}-t${T}=postmaster-$rname:${T}"'
check "close kills that worktree's windows" \
  'hs "$STUBS" POSTMASTER_HOST=tmux -- close "$repo/.worktrees/T-1-sol" >/dev/null && [ "$(calls tmux | grep -c "^kill-window")" -eq 2 ]'

echo "interactive sessions"
hs "$SYS" -- spawn postmaster-repo "$repo" -- claude >/dev/null 2>&1; a=$?
hs "$SYS" -- send postmaster-repo "$tmp/caller/fixed.sh" >/dev/null 2>&1; b=$?
hs "$SYS" -- read postmaster-repo >/dev/null 2>&1; c=$?
check "with no host, spawn, send and read say so, exit 3" '[ $a -eq 3 ] && [ $b -eq 3 ] && [ $c -eq 3 ]'
reset
hs "$STUBS" -- spawn postmaster-repo "$repo/.worktrees/T-1-luna" --label "repo · postmaster" -- claude --model m >/dev/null
check "Herdr: spawn starts the agent in a tab of the repository's own space" \
  'calls herdr | grep -qxF "tab${T}create${T}--workspace${T}w1${T}--cwd${T}$repo/.worktrees/T-1-luna${T}--label${T}repo · postmaster${T}--no-focus" && calls herdr | grep -qx "agent${T}start${T}postmaster-repo${T}--kind${T}claude${T}--pane${T}p5${T}--${T}--model${T}m"' "$(calls herdr)"
hs "$STUBS" -- spawn "My.Project postmaster" "$repo" -- claude >/dev/null
check "a handle becomes a Herdr agent name: lowercase, no dots or spaces" 'calls herdr | grep -q "^agent${T}start${T}my-project-postmaster${T}"'
printf 'Read the brief.' > "$tmp/msg.txt"
hs "$STUBS" -- send postmaster-repo "$tmp/msg.txt" >/dev/null
check "Herdr: send submits the file's text as the agent's prompt" 'calls herdr | grep -qx "agent${T}prompt${T}postmaster-repo${T}Read the brief."'
hs "$STUBS" -- send postmaster-repo "$tmp/msg.txt" --wait 30 >/dev/null
check "Herdr: send --wait sends and waits in one call, never a prompt then a wait" \
  'calls herdr | grep -qx "agent${T}prompt${T}postmaster-repo${T}Read the brief.${T}--wait${T}--timeout${T}30000" && ! calls herdr | grep -q "^agent${T}wait"'
hs "$STUBS" POSTMASTER_HOST=tmux -- spawn postmaster-repo "$repo" -- claude >/dev/null
hs "$STUBS" POSTMASTER_HOST=tmux -- send postmaster-repo "$tmp/msg.txt" >/dev/null
order=$(calls tmux | awk -F'\t' '$1 ~ /^(load-buffer|paste-buffer|send-keys)$/ {printf "%s%s ", $1, ($1 == "paste-buffer" && $2 == "-p") ? "(-p)" : ""}')
check "tmux: send pastes bracketed, then presses Enter as its own key" '[ "$order" = "load-buffer paste-buffer(-p) send-keys " ]' "$order"

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
fi

# --- live test ----------------------------------------------------------------------------
# The ticket's own controls, against the hosts on this machine: a launch that lands in its
# worktree's space, nested under its repository's space, with its marker landing; and the same
# launch with no host, backgrounded, with its marker landing. Everything happens in the scratch
# repository above. It opens only its own spaces and tmux session, and closes them all.
opened=() tsession=""
cleanup() {
  local i
  for (( i=${#opened[@]}-1; i>=0; i-- )); do herdr workspace close "${opened[i]}" >/dev/null 2>&1; done
  [ -n "$tsession" ] && tmux kill-session -t "=$tsession" >/dev/null 2>&1
  rm -r -- "$tmp" 2>/dev/null
}
trap cleanup EXIT
openspace() { herdr worktree list --cwd "$1" 2>/dev/null | json '([w.get("open_workspace_id") for w in d["result"]["worktrees"] if w["path"] == sys.argv[2]] or [None])[0]' "$2" 2>/dev/null; }
json() { python3 -c 'import json, sys
d = json.load(sys.stdin)
v = eval(sys.argv[1])
print("" if v is None else v)' "$1" "${2:-}"; }
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
  check "in a pane of its own worktree's space" '[ -n "$space" ] && [ "$(openspace "$wt" "$wt")" = "$space" ]'
  info=$(herdr workspace get "$space" 2>/dev/null)
  check "that space is a linked worktree of the repository, whose own space is its parent" \
    '[ "$(printf "%s" "$info" | json "d[\"result\"][\"workspace\"][\"worktree\"][\"is_linked_worktree\"]")" = True ] && [ "$(printf "%s" "$info" | json "d[\"result\"][\"workspace\"][\"worktree\"][\"repo_root\"]")" = "$repo" ] && [ "$(herdr worktree list --cwd "$wt" | json "d[\"result\"][\"source\"].get(\"source_workspace_id\")")" = "$rs" ]' "$info"
  check "the space and the tab carry the launch's name" \
    '[ "$(printf "%s" "$info" | json "d[\"result\"][\"workspace\"][\"label\"]")" = "$NAME" ] && [ "$(herdr tab get "$tab" | json "d[\"result\"][\"tab\"][\"label\"]")" = "$NAME" ]'
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
  got=$(cd "$tmp/caller" && "$SELF" run "$NAME" "$wt" --marker ../logs/l5.done --pidfile ../logs/l5.pid -- sleep 120)
  sleep 2; herdr tab close "$(printf '%s' "$got" | sed -n 's/.*tab=\([^ ]*\).*/\1/p')" >/dev/null 2>&1
  check "closing a launch's pane mid-run stops it, and its marker still lands" \
    'marker "$tmp/logs/l5.done" 10 && ! kill -0 "$(cat "$tmp/logs/l5.pid")" 2>/dev/null' "$got"
  rev=$repo/.worktrees/T-1-rev-luna
  got=$(cd "$tmp/caller" && "$SELF" run "$NAME review" "$rev" --marker ../logs/l2.done -- ./fixed.sh)
  rspace=$(printf '%s' "$got" | sed -n 's/.*space=\([^ ]*\).*/\1/p'); [ -n "$rspace" ] && opened+=("$rspace")
  check "a detached reviewer scratch opens as a space too" '[ -n "$rspace" ] && [ "$(openspace "$rev" "$rev")" = "$rspace" ] && marker "$tmp/logs/l2.done" 60' "$got"
  "$SELF" close "$repo" >/dev/null 2>&1; rc=$?
  check "close refuses the repository's own space" '[ $rc -eq 2 ]'
  check "close shuts the worktree's space, and only that" '"$SELF" close "$wt" >/dev/null && [ -z "$(openspace "$wt" "$wt")" ] && [ "$(openspace "$rev" "$rev")" = "$rspace" ]'
  check "and the reviewer's" '"$SELF" close "$rev" >/dev/null && [ -z "$(openspace "$rev" "$rev")" ]'

  echo "no host, the negative control"
  wt=$repo/.worktrees/T-1-sol
  before=$(herdr workspace list | json 'len(d["result"]["workspaces"])')
  got=$(cd "$tmp/caller" && POSTMASTER_HOST=none "$SELF" run "$NAME" "$wt" --out ../logs/l3.out --err ../logs/l3.err --marker ../logs/l3.done -- ./fixed.sh)
  check "the same launch runs in the background" '[ "$got" = host=none ]' "$got"
  check "no space opens for it" '[ -z "$(openspace "$wt" "$wt")" ] && [ "$(herdr workspace list | json "len(d[\"result\"][\"workspaces\"])")" = "$before" ]'
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
  sleep 1
  check "close kills the worktree's window" 'POSTMASTER_HOST=tmux "$SELF" close "$wt" >/dev/null && ! tmux list-windows -t "=$tsession" -F "#{window_name}" 2>/dev/null | grep -qxF "$NAME"'
else
  echo "tmux: not on PATH; its controls are skipped"
fi

echo
[ "$fails" -eq 0 ] && { echo "live test: all controls behaved"; exit 0; }
echo "live test: $fails control(s) misbehaved"; exit 1
