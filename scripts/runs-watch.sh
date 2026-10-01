#!/usr/bin/env bash
# Take the steps that need no judgment, and wait until a run under a project's run root needs
# the postmaster. Then print runs-status.sh's table, name each run that needs it with its NEXT,
# and exit. This is the loop Stage D keeps in the background. A session that improvises this
# look loses it on a restart and fires on runs it must leave alone.
#
#   runs-watch.sh <project-run-root> [--timeout <seconds>]
#   runs-watch.sh --help
#   runs-watch.sh --self-test
#
# Mechanical steps this script takes itself, logging each through log-action.sh with "the
# watcher took it" in the detail. Every leg start runs from the run's own checkout
# (`run-meta.sh path`, checked first): a checkout that does not serve its dispatch commit
# wakes the postmaster instead.
#
#   DISPATCH  the leg is done and its hand-off passes handoff-check.sh: dispatch the next leg
#             turnpikes.sh legs lists, through `host.sh leg launch` (Stage C). The thread id
#             lands in the attempt record when the attempt ends, never at dispatch. A hand-off
#             that fails, a turnpikes.sh legs that exits non-zero, no next leg after the ship
#             leg, or a launch it cannot complete are steps it could not complete: they wake
#             the postmaster.
#   RESUME    the attempt record says incomplete and the end is a transient provider error the
#             harness adapter names (launch.sh transient, reading only the current launch's
#             stream lines past the skip in <run>/watcher.json, vetoing on any wall-like
#             token): resume it on its recorded thread with the remount prompt through
#             `host.sh leg resume`, at most three times per leg (the count is beside the skip
#             and survives a restart). A start that fails spends no retry: the count is
#             restored and the refusal is logged. A fourth such end, a non-transient end, or
#             a resume it cannot complete wakes the postmaster.
#
# Everything that needs judgment still wakes the postmaster: RULE (an escalation), GATE (a
# ship card), READ (a checkpoint card), SPEC (a spec package), ASK (a recorded refusal or
# pre-thread exit, or a wall on the fallback), TAKEOVER (a recorded wall on the primary),
# INSPECT (a stall, or an attempt without its record), and any step the watcher could not
# complete. USER (already put to the user), WAIT (a leg at work) and - (closed) never do.
#
# It looks at once, then every postmaster.poll_seconds (default 120) from the config
# (POSTMASTER_CONFIG overrides the path). A run listed in <runs>/postmaster/held, one ticket
# per line, is never touched: hold a run by writing its ticket there exactly as the RUN column
# shows it, and release it by removing the line. A held line that matches no run warns on
# stderr. The held list and the config are read on every look, and the held list is re-read
# immediately before every mutation, so a hold takes effect without restarting the watcher.
# A hold that lands mid-step aborts the step: silently before its first mutation, and by
# waking the postmaster with the partial state after one.
# A missing config, or a poll interval that is not usable, gets the default, 120 seconds,
# which it says; an unset one is silent.
#
# With --timeout, a look that finds nothing for that many seconds prints the table and exits 3;
# the timeout counts the seconds it has slept, so a clock set forward does not end the wait
# early. A count or a timeout is at most 9 digits. Without --timeout it waits until a run needs
# the postmaster. Taking a step does not reset the timeout.
#
# POSTMASTER_WATCH_TEST_MODE stages the leg boundary for the self-test: with it set to 1,
# leg starts are recorded under POSTMASTER_WATCH_TEST_CALLS instead of started, the starting
# attempt's markers are cleared, and no agent thread is ever started.
# POSTMASTER_WATCH_TEST_FAIL=dispatch|resume makes that start fail after recording a refused
# attempt, as a host that could not start one; =1 on POSTMASTER_WATCH_TEST_REFUSE refuses
# that start with no record, as a validation refusal.
#
#   exit 0  a run needs the postmaster: the table, then one `needs <run> <NEXT>` line each
#   exit 3  --timeout passed with nothing to act on: the table
#   exit 1  usage, no such root, the held list cannot be read, or a timeout
#           that is not a whole number
#
# Controls: every step it takes (dispatch taken, resume taken) and every NEXT that must wake
# the postmaster names its run on exit 0 (positive), and WAIT, USER, -, and a held run leave
# it waiting until its timeout (negative). A held run is left alone entirely: no step, no
# count, no wake.
set -uo pipefail
HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)

usage() {
  sed -n '2,68p' "$0" | sed 's/^# \{0,1\}//'
}

if [ "${1:-}" = --help ] || [ "${1:-}" = -h ]; then usage; exit 0; fi

waking_runs() {  # waking_runs: `needs <run> <NEXT>` per waking run; the table on stdin, held lines in $POSTMASTER_HELD_LINES
  awk '
  BEGIN {
    n = split(ENVIRON["POSTMASTER_HELD_LINES"], lines, "\n")
    for (i = 1; i <= n; i++) {
      line = lines[i]
      gsub(/^[ \t]+|[ \t]+$/, "", line)
      if (line != "") hold[line] = 1
    }
  }
  $1 == "POSTMASTER" { next }
  $1 == "RUN" && $NF == "NEXT" { next }
  NF < 2 { next }
  { seen[$1] = 1 }
  $NF == "USER" || $NF == "WAIT" || $NF == "-" { next }
  $1 in hold { next }
  { print "needs " $1 " " $NF }
  END {
    for (h in hold) if (!(h in seen)) print "runs-watch: held \"" h "\" matches no run" > "/dev/stderr"
  }
  '
}

poll_seconds() {  # poll_seconds: the config's postmaster.poll_seconds, or the default, 120
  python3 - "$CONFIG" <<'PY'
import sys, tomllib
path = sys.argv[1]
try:
    with open(path, "rb") as f:
        cfg = tomllib.load(f)
except FileNotFoundError:
    print("runs-watch: no config at %s; the poll interval is the default, 120s" % path, file=sys.stderr)
    print(120); raise SystemExit(0)
except (OSError, tomllib.TOMLDecodeError, UnicodeDecodeError) as e:
    print("runs-watch: cannot read %s (%s); the poll interval is the default, 120s" % (path, e), file=sys.stderr)
    print(120); raise SystemExit(0)
pm = cfg.get("postmaster", {})
if not isinstance(pm, dict):
    print("runs-watch: postmaster is %r, not a table; the poll interval is the default, 120s" % (pm,), file=sys.stderr)
    print(120); raise SystemExit(0)
if "poll_seconds" not in pm:
    print(120); raise SystemExit(0)
ps = pm["poll_seconds"]
if isinstance(ps, bool) or not isinstance(ps, int) or not 1 <= ps <= 999999999:
    print("runs-watch: postmaster.poll_seconds is %r, not a whole number of seconds from 1 to 999999999; the poll interval is the default, 120s" % (ps,), file=sys.stderr)
    print(120); raise SystemExit(0)
print(ps)
PY
}

held_lines() {  # held_lines <postmaster-dir>: the held tickets, one per line; nothing when no held file
  python3 - "$1" <<'PY'
import os, sys
d = sys.argv[1]
try:
    names = os.listdir(d)
except FileNotFoundError:
    if os.path.lexists(d):
        print("runs-watch: cannot read %s (dangling link)" % d, file=sys.stderr)
        raise SystemExit(1)
    raise SystemExit(0)
except OSError as e:
    print("runs-watch: cannot read %s (%s)" % (d, e), file=sys.stderr)
    raise SystemExit(1)
if "held" not in names:
    raise SystemExit(0)
p = os.path.join(d, "held")
if not os.path.isfile(p):
    print("runs-watch: cannot read %s (not a regular file)" % p, file=sys.stderr)
    raise SystemExit(1)
try:
    with open(p) as f:
        sys.stdout.write(f.read())
except (OSError, ValueError) as e:
    print("runs-watch: cannot read %s (%s)" % (p, e), file=sys.stderr)
    raise SystemExit(1)
PY
}

is_held_run() {  # is_held_run <run> <postmaster-dir>: refresh the held list immediately before a step
  local held=$1 lines
  lines=$(held_lines "$2") || return 2
  printf '%s\n' "$lines" | awk -v wanted="$held" '
    { line=$0; gsub(/^[ \t]+|[ \t]+$/, "", line); if (line == wanted) found=1 }
    END { exit(found ? 0 : 1) }
  '
}

ACTION_ERROR=""
NEEDS=""
mark_needs() {  # mark_needs <run> <NEXT> [reason]
  local run=$1 next=$2 reason=${3:-}
  NEEDS="${NEEDS}${NEEDS:+$'\n'}needs $run $next"
  [ -z "$reason" ] || printf 'runs-watch: %s %s: %s\n' "$run" "$next" "$reason" >&2
}

repo_from_brief() {  # repo_from_brief <dispatch>: the repo in the waybill's own Project profile, the last one, after the ticket
  python3 - "$1/brief.md" <<'PY'
import re, sys
try:
    with open(sys.argv[1], encoding="utf-8", errors="replace") as f:
        waybill = f.read()
except OSError:
    raise SystemExit(0)
starts = [m.end() for m in re.finditer(r"^## Project profile[ \t]*$", waybill, re.M)]
if not starts:
    raise SystemExit(0)
body = waybill[starts[-1]:]
end = re.search(r"^## ", body, re.M)
m = re.search(r"^repo:[ \t]*(\S.*?)(?:[ \t]{2,}\S.*)?[ \t]*$", body[:end.start()] if end else body, re.M)
if m:
    print(m.group(1).strip())
PY
}

repo_from_checks() {  # repo_from_checks <dispatch>: the repo the run recorded at dispatch
  python3 - "$1/checks.json" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except (OSError, ValueError):
    raise SystemExit(0)
repo = d.get("repo") if isinstance(d, dict) else None
if isinstance(repo, str) and repo.strip():
    print(repo.strip())
PY
}

run_repo() {  # run_repo <dispatch>: the target repo, from the waybill or the recorded checks
  local repo
  repo=$(repo_from_brief "$1" 2>/dev/null)
  case $repo in /*) printf '%s\n' "$repo"; return 0 ;; esac
  repo=$(repo_from_checks "$1" 2>/dev/null)
  case $repo in /*) printf '%s\n' "$repo"; return 0 ;; esac
  return 1
}

leg_job() {  # leg_job <rt> <number>: the one-line job from that checkout's coachman.md legs table
  python3 - "$1/skills/postmaster/coachman.md" "$2" <<'PY'
import pathlib, re, sys
path, number = pathlib.Path(sys.argv[1]), sys.argv[2]
for line in path.read_text().splitlines():
    if not line.startswith("|"): continue
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    if len(cells) != 4 or cells[0] != number: continue
    name, covers, ends = (re.sub(r"`", "", value) for value in cells[1:])
    print("Your %s leg covers %s; it ends with %s." % (name, covers, ends))
    raise SystemExit(0)
raise SystemExit(1)
PY
}

manifest_leg() {  # manifest_leg <dispatch> <number> <thread-id-or-empty>: set the active leg and its coachman record
  python3 - "$1/manifest.json" "$2" "$3" <<'PY'
import json, os, pathlib, sys, tempfile
path, number, thread = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
try: manifest = json.loads(path.read_text())
except (OSError, ValueError) as e:
    print("runs-watch: cannot read %s: %s" % (path, e), file=sys.stderr); raise SystemExit(1)
if not isinstance(manifest, dict):
    print("runs-watch: %s is not a JSON object" % path, file=sys.stderr); raise SystemExit(1)
try:
    coachman = manifest.setdefault("coachman", {})
    legs = coachman.setdefault("legs", {})
    entry = legs.setdefault(number, {})
    if not all(isinstance(x, dict) for x in (coachman, legs, entry)):
        raise ValueError("coachman.legs is not an object")
    manifest["leg"] = int(number)
    entry["name"] = "coachman"
    if thread: entry["thread_id"] = thread
    else: entry.pop("thread_id", None)
except (AttributeError, TypeError, ValueError) as e:
    print("runs-watch: cannot update %s: %s" % (path, e), file=sys.stderr); raise SystemExit(1)
fd, tmp = tempfile.mkstemp(dir=str(path.parent)); os.close(fd)
try:
    with open(tmp, "w") as f: json.dump(manifest, f, indent=2); f.write("\n")
    os.replace(tmp, path)
except OSError as e:
    try: os.unlink(tmp)
    except OSError: pass
    print("runs-watch: cannot write %s: %s" % (path, e), file=sys.stderr); raise SystemExit(1)
PY
}

resume_count() {  # resume_count <dispatch> <leg>: prints the persisted automatic-remount count
  python3 - "$1/watcher.json" "$2" <<'PY'
import json, pathlib, sys
path, leg = pathlib.Path(sys.argv[1]), sys.argv[2]
if not path.exists(): print(0); raise SystemExit(0)
try:
    data = json.loads(path.read_text())
    counts = data.get("resume_attempts", {})
    value = counts.get(leg, 0)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0: raise ValueError("invalid count")
except (OSError, ValueError, AttributeError, TypeError) as e:
    print("runs-watch: cannot read %s: %s" % (path, e), file=sys.stderr); raise SystemExit(1)
print(value)
PY
}

stream_skip() {  # stream_skip <dispatch> <leg>: the stream lines an earlier launch wrote, to skip when classifying
  python3 - "$1/watcher.json" "$2" <<'PY'
import json, pathlib, sys
path, leg = pathlib.Path(sys.argv[1]), sys.argv[2]
if not path.exists(): print(0); raise SystemExit(0)
try:
    data = json.loads(path.read_text())
    skips = data.get("stream_skip", {})
    value = skips.get(leg, 0)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0: raise ValueError("invalid skip")
except (OSError, ValueError, AttributeError, TypeError) as e:
    print("runs-watch: cannot read %s: %s" % (path, e), file=sys.stderr); raise SystemExit(1)
print(value)
PY
}

set_resume_count() {  # set_resume_count <dispatch> <leg> <count> [skip]: atomically persist the count and the stream lines the next launch starts after
  python3 - "$1/watcher.json" "$2" "$3" "${4:-}" <<'PY'
import json, os, pathlib, sys, tempfile
path, leg, skip_arg = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[4]
count = int(sys.argv[3])
try:
    skip = None
    if skip_arg != "":
        skip = int(skip_arg)
        if skip < 0: raise ValueError("negative skip")
    data = json.loads(path.read_text()) if path.exists() else {}
    if not isinstance(data, dict): raise ValueError("not an object")
    counts = data.setdefault("resume_attempts", {})
    if not isinstance(counts, dict): raise ValueError("resume_attempts is not an object")
    data["resume_attempts"][leg] = count
    if skip is not None:
        skips = data.setdefault("stream_skip", {})
        if not isinstance(skips, dict): raise ValueError("stream_skip is not an object")
        data["stream_skip"][leg] = skip
except (OSError, ValueError, TypeError) as e:
    print("runs-watch: cannot update %s: %s" % (path, e), file=sys.stderr); raise SystemExit(1)
fd, tmp = tempfile.mkstemp(dir=str(path.parent)); os.close(fd)
try:
    with open(tmp, "w") as f: json.dump(data, f, indent=2); f.write("\n")
    os.replace(tmp, path)
except OSError as e:
    try: os.unlink(tmp)
    except OSError: pass
    print("runs-watch: cannot write %s: %s" % (path, e), file=sys.stderr); raise SystemExit(1)
PY
}

leg_rt() {  # leg_rt <dispatch>: print the run's checked tool checkout, or the wake reason
  local d=$1 rt check_err
  rt=$("$HERE/run-meta.sh" path "$d" 2>&1) || { printf "cannot resolve the run's tool checkout: %s\n" "$rt"; return 1; }
  check_err=$("$HERE/run-meta.sh" check "$d" 2>&1) || { printf "the run's tool checkout does not serve its dispatch commit: %s\n" "$check_err"; return 1; }
  printf '%s\n' "$rt"
}

watch_leg() {  # watch_leg <dispatch|resume> <rt> <dispatch> <worktree> <leg> <number> <thread-or-empty> <prompt>
  local kind=$1 rt=$2 d=$3 wt=$4 leg=$5 n=$6 thread=$7 prompt=$8 callfile request attempt
  if [ "${POSTMASTER_WATCH_TEST_MODE:-}" = 1 ]; then
    [ -n "${POSTMASTER_WATCH_TEST_CALLS:-}" ] || return 1
    callfile=$POSTMASTER_WATCH_TEST_CALLS/$kind-$(basename "$d")-$n
    mkdir -p "${POSTMASTER_WATCH_TEST_CALLS:-}" "$d/logs" || return 1
    printf 'kind=%s\nrt=%s\ndispatch=%s\nworktree=%s\nleg=%s\nnumber=%s\nthread=%s\nprompt=%s\n' \
      "$kind" "$rt" "$d" "$wt" "$leg" "$n" "$thread" "$prompt" > "$callfile"
    # The leg command clears the starting attempt's markers before its intent
    # lands; the double clears the same markers and writes no intent.
    rm -f -- "$d"/logs/coachman-leg-"$n"-wall-* "$d/.leg-$n-done" "$d/.leg-$n-exited"
    if [ "${POSTMASTER_WATCH_TEST_FAIL:-}" = "$kind" ]; then
      # A host that could not start the attempt: the leg records the refusal.
      request=launch; [ "$kind" = dispatch ] || request=resume
      attempt=$(($(wc -l < "$d/logs/coachman-leg-$n-attempts.jsonl" 2>/dev/null || echo 0) + 1))
      printf '{"attempt":%s,"leg":%s,"name":"%s","request":"%s","role":"coachman","prompt":"%s","thread_id":"","outcome":"refused","on_answer":"retry","backfilled":false}\n' \
        "$attempt" "$n" "$leg" "$request" "$prompt" >> "$d/logs/coachman-leg-$n-attempts.jsonl"
      echo "leg: simulated $kind failure" >&2
      return 1
    fi
    if [ "${POSTMASTER_WATCH_TEST_REFUSE:-}" = 1 ]; then
      # A validation refusal leaves markers, stream and records untouched.
      echo "leg: simulated refusal" >&2
      return 1
    fi
    return 0
  fi
  if [ "$kind" = dispatch ]; then
    "$rt/host.sh" leg launch "$d" "$wt" "$leg" "$n" "$prompt"
  else
    "$rt/host.sh" leg resume "$d" "$wt" "$leg" "$n" "$thread" "$prompt"
  fi
}

stream_lines() {  # stream_lines <events-file>: the stream's line count, counting an unterminated last line, which wc -l misses
  [ -f "$1" ] && [ -r "$1" ] || { echo 0; return 0; }
  awk 'END{print NR+0}' < "$1"
}

prepare_dispatch() {  # prepare_dispatch <dispatch> <run> <current leg>: dispatch next leg or report why it could not
  local d=$1 run=$2 current=$3 list next job repo worktree prompt rt leg_err leg_first number leg listed
  ACTION_ERROR=""
  if ! list=$("$HERE/turnpikes.sh" legs "$d" 2>&1); then
    ACTION_ERROR="turnpikes.sh legs failed: $list"; return 1
  fi
  # The manifest leg is validated before anything uses it: it must be a canonical
  # integer and one of the run's listed legs. Anything else is reported as corrupt
  # and the run is skipped — never dispatched from, and never allowed near
  # arithmetic that would abort the whole watcher. resume_transient twins the
  # integer check: its awk listed-leg match is numeric, so "02" would match leg
  # 2 there, and only the canonical check reports it corrupt on both paths.
  case $current in ''|*[!0-9]*|0[0-9]*)
    ACTION_ERROR="manifest leg '$current' is not a canonical integer; the run is corrupt"; return 1 ;;
  esac
  listed=$(printf '%s\n' "$list" | awk -v n="$current" '$1 == n { print $2; exit }')
  [ -n "$listed" ] || { ACTION_ERROR="manifest leg $current is not a listed leg; the run is corrupt"; return 1; }
  next=$(printf '%s\n' "$list" | awk -v n="$current" '$1 ~ /^[0-9]+$/ && $1 + 0 > n { print $1 "\t" $2; exit }')
  if [ -z "$next" ]; then ACTION_ERROR="no later leg is listed; Stage G remains with the postmaster"; return 1; fi
  IFS=$'\t' read -r number leg <<< "$next"
  local handoff="$d/handoff-$current.md" check
  check=$("$HERE/handoff-check.sh" "$handoff" 2>&1)
  local check_rc=$?
  if [ $check_rc -ne 0 ]; then ACTION_ERROR="handoff check failed for $handoff (exit $check_rc): $check"; return 1; fi
  repo=$(run_repo "$d") || { ACTION_ERROR="neither the waybill nor the recorded checks name an absolute repo path"; return 1; }
  worktree=$repo/.worktrees/$run
  [ -d "$worktree" ] || { ACTION_ERROR="the synthesis worktree is missing: $worktree"; return 1; }
  rt=$(leg_rt "$d") || { ACTION_ERROR="$rt"; return 1; }
  job=$(leg_job "$rt" "$number") || { ACTION_ERROR="coachman.md has no job for leg $number"; return 1; }
  prompt="$d/leg-$number-prompt.txt"
  local time_file="${prompt}.tmp.$$"
  local held_rc
  is_held_run "$run" "$ROOT/postmaster"; held_rc=$?
  if [ $held_rc -eq 0 ]; then return 3; fi
  if [ $held_rc -ne 1 ]; then ACTION_ERROR="cannot re-read the held list"; return 1; fi
  {
    printf 'You are the coachman for leg %s of %s.\n' "$number" "$run"
    printf 'Read %s/brief.md, then %s/skills/postmaster/coachman.md, then %s/handoff-%s.md.\n' \
      "$d" "$rt" "$d" "$current"
    printf '%s\n' "$job"
  } > "$time_file" || { ACTION_ERROR="cannot write the leg prompt: $prompt"; return 1; }
  is_held_run "$run" "$ROOT/postmaster"; held_rc=$?
  if [ $held_rc -eq 0 ]; then rm -f -- "$time_file"; return 3; fi
  if [ $held_rc -ne 1 ]; then rm -f -- "$time_file"; ACTION_ERROR="cannot re-read the held list"; return 1; fi
  mv -f -- "$time_file" "$prompt" || { ACTION_ERROR="cannot install the leg prompt: $prompt"; return 1; }
  is_held_run "$run" "$ROOT/postmaster"; held_rc=$?
  if [ $held_rc -eq 0 ]; then ACTION_ERROR="held mid-step after installing the leg $number prompt; the manifest and the launch are unchanged"; return 1; fi
  if [ $held_rc -ne 1 ]; then ACTION_ERROR="cannot re-read the held list"; return 1; fi
  if ! manifest_leg "$d" "$number" ""; then ACTION_ERROR="could not record leg $number in manifest.json"; return 1; fi
  is_held_run "$run" "$ROOT/postmaster"; held_rc=$?
  if [ $held_rc -eq 0 ]; then ACTION_ERROR="held mid-step after recording leg $number in manifest.json with no launch"; return 1; fi
  if [ $held_rc -ne 1 ]; then ACTION_ERROR="cannot re-read the held list"; return 1; fi
  # The leg command owns markers, stream and records; the thread id lands in
  # the attempt record when the attempt ends. A start that fails names why on
  # stderr, and a host failure records the refusal for the next look's ASK.
  if ! leg_err=$(watch_leg dispatch "$rt" "$d" "$worktree" "$leg" "$number" "" "$prompt" 2>&1); then
    leg_first=$(printf '%s\n' "$leg_err" | head -1)
    ACTION_ERROR="could not start coachman leg $number: ${leg_first:-no message}"; return 1
  fi
  if [ "$number" -gt $((current + 1)) ]; then
    if ! "$HERE/log-action.sh" "$d" postmaster note "$run" "turnpikes omit the review leg; the watcher followed the listed legs"; then
      ACTION_ERROR="could not log the omitted review leg"; return 1
    fi
  fi
  if ! "$HERE/log-action.sh" "$d" postmaster dispatch coachman "leg $number ($leg); the watcher took it"; then
    ACTION_ERROR="could not log dispatch of leg $number"; return 1
  fi
  return 0
}

resume_transient() {  # resume_transient <dispatch> <run> <leg number>
  local d=$1 run=$2 number=$3 err="$1/logs/coachman-leg-$3.err" out="$1/logs/coachman-leg-$3-events.jsonl"
  local info name thread classifier classifier_rc count skip repo worktree prompt stamp held_rc list leg rt leg_err leg_first
  ACTION_ERROR=""
  if ! list=$("$HERE/turnpikes.sh" legs "$d" 2>&1); then ACTION_ERROR="turnpikes.sh legs failed: $list"; return 2; fi
  case $number in ''|*[!0-9]*|0[0-9]*)
    ACTION_ERROR="manifest leg '$number' is not a canonical integer; the run is corrupt"; return 2 ;;
  esac
  leg=$(printf '%s\n' "$list" | awk -v n="$number" '$1 == n { print $2; exit }')
  [ -n "$leg" ] || { ACTION_ERROR="turnpikes.sh legs has no entry for current leg $number"; return 2; }
  info=$(python3 - "$d/manifest.json" "$number" <<'PY'
import json, sys
try:
    m=json.load(open(sys.argv[1])); entry=m.get("coachman",{}).get("legs",{}).get(sys.argv[2],{})
    print("%s\t%s" % (entry.get("name", ""), entry.get("thread_id", "")))
except (OSError, ValueError, AttributeError, TypeError): raise SystemExit(1)
PY
  ) || { ACTION_ERROR="cannot read coachman leg $number from manifest.json"; return 2; }
  IFS=$'\t' read -r name thread <<< "$info"
  case $name in coachman|coachman_fallback) ;; *) ACTION_ERROR="leg $number has no recorded coachman name"; return 2 ;; esac
  [ -n "$thread" ] || { ACTION_ERROR="leg $number has no recorded thread id"; return 2; }
  skip=$(stream_skip "$d" "$number") || { ACTION_ERROR="the stream skip for leg $number is unreadable"; return 2; }
  classifier=$("$HERE/launch.sh" transient "$err" "$out" "$skip" 2>&1)
  classifier_rc=$?
  if [ $classifier_rc -ne 0 ]; then ACTION_ERROR="the leg is not eligible for automatic resume (adapter: ${classifier:-exit $classifier_rc}); read $err and the stream tail"; return 2; fi
  count=$(resume_count "$d" "$number") || { ACTION_ERROR="the remount count for leg $number is unreadable"; return 2; }
  if [ "$count" -ge 3 ]; then ACTION_ERROR="leg $number ended on a transient provider error after three watcher resumes"; return 2; fi
  repo=$(run_repo "$d") || { ACTION_ERROR="neither the waybill nor the recorded checks name an absolute repo path"; return 2; }
  worktree=$repo/.worktrees/$run
  [ -d "$worktree" ] || { ACTION_ERROR="the synthesis worktree is missing: $worktree"; return 2; }
  rt=$(leg_rt "$d") || { ACTION_ERROR="$rt"; return 2; }
  prompt="$d/leg-$number-resume-$(date -u +%Y%m%dT%H%M%SZ).txt"
  while [ -e "$prompt" ]; do
    is_held_run "$run" "$ROOT/postmaster"; held_rc=$?
    if [ $held_rc -eq 0 ]; then return 3; fi
    if [ $held_rc -ne 1 ]; then ACTION_ERROR="cannot re-read the held list"; return 2; fi
    sleep 1
    prompt="$d/leg-$number-resume-$(date -u +%Y%m%dT%H%M%SZ).txt"
  done
  is_held_run "$run" "$ROOT/postmaster"; held_rc=$?
  if [ $held_rc -eq 0 ]; then return 3; fi
  if [ $held_rc -ne 1 ]; then ACTION_ERROR="cannot re-read the held list"; return 2; fi
  printf 'Continue leg %s; your last written state is in the dispatch directory and the worktree.\n' "$number" > "$prompt" \
    || { ACTION_ERROR="cannot write the remount prompt: $prompt"; return 2; }
  is_held_run "$run" "$ROOT/postmaster"; held_rc=$?
  if [ $held_rc -eq 0 ]; then ACTION_ERROR="held mid-step after writing the remount prompt for leg $number; no count, no launch"; return 2; fi
  if [ $held_rc -ne 1 ]; then ACTION_ERROR="cannot re-read the held list"; return 2; fi
  if [ -f "$out" ]; then skip=$(stream_lines "$out"); else skip=0; fi
  if ! set_resume_count "$d" "$number" "$((count + 1))" "$skip"; then ACTION_ERROR="cannot persist the remount count for leg $number"; return 2; fi
  is_held_run "$run" "$ROOT/postmaster"; held_rc=$?
  if [ $held_rc -eq 0 ]; then ACTION_ERROR="held mid-step after persisting resume $((count + 1)) for leg $number with no launch"; return 2; fi
  if [ $held_rc -ne 1 ]; then ACTION_ERROR="cannot re-read the held list"; return 2; fi
  # The leg command resumes on the recorded thread and owns markers, stream
  # and records; its exit code is the refusal, never .err text. A start that
  # fails spends no retry: the count is restored, the refusal is logged, and
  # the run is named in this look. A host failure records the refusal for the
  # next look's ASK; a validation refusal leaves the records untouched.
  if ! leg_err=$(watch_leg resume "$rt" "$d" "$worktree" "$leg" "$number" "$thread" "$prompt" 2>&1); then
    leg_first=$(printf '%s\n' "$leg_err" | head -1)
    if ! set_resume_count "$d" "$number" "$count" "$skip"; then ACTION_ERROR="cannot restore the remount count for leg $number"; return 2; fi
    if ! "$HERE/log-action.sh" "$d" postmaster refuse coachman "leg $number, thread $thread; the resume did not start (${leg_first:-no message})"; then
      ACTION_ERROR="could not log refusal of leg $number"; return 2
    fi
    ACTION_ERROR="could not resume leg $number: ${leg_first:-no message}"; return 2
  fi
  if ! "$HERE/log-action.sh" "$d" postmaster resume coachman "leg $number, thread $thread, $classifier, resume $((count + 1)) of 3; the watcher took it"; then
    ACTION_ERROR="could not log resume of leg $number"; return 2
  fi
  return 0
}

process_table() {  # process_table <runs-root> <table>: take mechanical steps and fill NEEDS for the postmaster
  local root=$1 table=$2 row run leg next rc held_rc
  ROOT=$root; NEEDS=""
  while IFS= read -r row; do
    run=$(printf '%s\n' "$row" | awk '{print $1}')
    [ -n "$run" ] && [ "$run" != RUN ] && [ "$run" != POSTMASTER ] || continue
    next=$(printf '%s\n' "$row" | awk '{print $NF}')
    leg=$(python3 - "$ROOT/$run/manifest.json" <<'PY'
import json,sys
try: print(json.load(open(sys.argv[1])).get("leg", ""))
except Exception: print("")
PY
    )
    is_held_run "$run" "$ROOT/postmaster"; held_rc=$?
    if [ $held_rc -eq 0 ]; then continue; fi
    if [ $held_rc -ne 1 ]; then ACTION_ERROR="cannot read the held list"; return 1; fi
    case $next in
      DISPATCH)
        prepare_dispatch "$ROOT/$run" "$run" "$leg"; rc=$?
        case $rc in 0|3) ;; *) mark_needs "$run" DISPATCH "$ACTION_ERROR" ;; esac ;;
      RESUME)
        resume_transient "$ROOT/$run" "$run" "$leg"; rc=$?
        if [ $rc -eq 0 ]; then :
        elif [ $rc -eq 3 ]; then :
        else mark_needs "$run" RESUME "$ACTION_ERROR"; fi ;;
      WAIT|USER|-) ;;
      *) mark_needs "$run" "$next" ;;
    esac
  done <<< "$table"
}

if [ "${1:-}" = --self-test ]; then
  self=$(CDPATH= cd -P -- "$(dirname "$0")" && pwd -P)/$(basename "$0")
  tmp=$(mktemp -d) || exit 1
  trap 'rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
  printf '[postmaster]\npoll_seconds = 1\n' > "$tmp/config.toml"
  POSTMASTER_CONFIG="$tmp/config.toml"; export POSTMASTER_CONFIG
  fails=0 rc=0 out=""
  ok()   { printf '  ok   %s\n' "$1"; }
  fail() { printf '  FAIL %s (exit %s)\n' "$1" "$rc"; printf '%s\n' "$out" | sed 's/^/         /'; fails=$((fails+1)); }
  has()  { case $out in *"$1"*) true ;; *) false ;; esac; }
  watch() { out=$("$self" --timeout 2 "$1" 2>&1); rc=$?; }
  mkrun() {  # mkrun <root> <name> <stage> <leg> [marker...]
    local d="$1/$2" stage=$3 leg=$4 m; shift 4
    mkdir -p "$d/logs"
    printf '{"stage": "%s", "leg": %s}\n' "$stage" "$leg" > "$d/manifest.json"
    : > "$d/run-log.md"
    for m in "$@"; do : > "$d/$m"; done
  }
  age() {  # age <root> <name>: nothing in the run has changed for an hour
    python3 -c 'import os, sys, time
t = time.time() - 3600
for dp, dn, fn in os.walk(sys.argv[1]):
    for f in fn:
        os.utime(os.path.join(dp, f), (t, t))' "$1/$2"
  }
  auto_run() {  # auto_run <root> <name> <leg> <thread-id-or-empty>: dispatch-shaped fixture with a recorded claude config
    local root=$1 name=$2 leg=$3 thread=$4 d="$1/$2" repo="$1-project"
    mkdir -p "$d/logs" "$d/audit" "$d/render" "$root/postmaster" "$repo/.worktrees/$name"
    : > "$d/run-log.md"; : > "$d/actions.jsonl"; : > "$root/ledger.jsonl"
    cat > "$d/brief.md" <<EOF
# Waybill: $name
turnpikes: style, bug, security

## Ticket
## Project profile
repo: $repo

## Dispatch
name: #1, Watcher fixture
EOF
    python3 - "$d/manifest.json" "$d/run.json" "$leg" "$thread" "$pin_commit" "$pin" <<'PY'
import json, pathlib, sys
manifest, record = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
leg, thread = int(sys.argv[3]), sys.argv[4]
entry = {"name": "coachman"}
if thread: entry["thread_id"] = thread
manifest.write_text(json.dumps({"stage": "review", "leg": leg, "coachman": {"legs": {str(leg): entry}}}, indent=2) + "\n")
config = {"lanes": {}, "team": {"coachman": {"harness": "claude", "model": "coach-test"}}}
postmaster = {"commit": sys.argv[5], "checkout": sys.argv[6]}
record.write_text(json.dumps({"config": config, "postmaster": postmaster}, indent=2) + "\n")
PY
  }
  record_attempt() {  # record_attempt <dispatch> <leg> <outcome> [role] [thread]: one attempt row for the run's record
    local d=$1 n=$2 outcome=$3 role=${4:-coachman} thread=${5:-}
    printf '{"attempt":1,"leg":"%s","name":"synthesis","request":"launch","role":"%s","prompt":"%s","thread_id":"%s","outcome":"%s","on_answer":"none","backfilled":false}\n' \
      "$n" "$role" "$d/prompt.txt" "$thread" "$outcome" > "$d/logs/coachman-leg-$n-attempts.jsonl"
  }
  handoff() {  # handoff <dispatch> <leg>: a hand-off with every required section
    local d=$1 n=$2
    printf '## Decisions\nsettled\n## Deferred findings\nnone\n## Verified by execution\nnone\n## Unverified\nnone\n## Branches and lanes\nnone\n## Open questions\nnone\n## Next leg\nnone\n' > "$d/handoff-$n.md"
  }
  watch_stub() {  # watch_stub <root> [dispatch|resume failure|refusal]: runs the watcher with only its leg boundary replaced
    local root=$1 mode=${2:-} extra=""
    case $mode in
      "dispatch failure") extra="POSTMASTER_WATCH_TEST_FAIL=dispatch" ;;
      "resume failure") extra="POSTMASTER_WATCH_TEST_FAIL=resume" ;;
      "dispatch refusal") extra="POSTMASTER_WATCH_TEST_REFUSE=1" ;;
      "resume refusal") extra="POSTMASTER_WATCH_TEST_REFUSE=1" ;;
    esac
    out=$(env POSTMASTER_WATCH_TEST_MODE=1 POSTMASTER_WATCH_TEST_CALLS="$tmp/calls" $extra "$self" --timeout 0 "$root" 2>&1); rc=$?
  }
  watch_stub_wait() {  # watch_stub_wait <root>: several polls under a standing refusal
    out=$(env POSTMASTER_WATCH_TEST_MODE=1 POSTMASTER_WATCH_TEST_CALLS="$tmp/calls" \
      POSTMASTER_WATCH_TEST_REFUSE=1 "$self" --timeout 3 "$1" 2>&1); rc=$?
  }
  action_count() {  # action_count <dispatch> <action>
    python3 - "$1/actions.jsonl" "$2" <<'PY'
import json, pathlib, sys
p=pathlib.Path(sys.argv[1]); action=sys.argv[2]
if not p.exists(): print(0); raise SystemExit(0)
print(sum(1 for line in p.read_text().splitlines() if json.loads(line).get("action") == action))
PY
  }

  echo "positive controls: each NEXT that needs the postmaster names its run"
  for spec in \
    "rule review 2 .escalation-ready RULE" \
    "gate shipping 3 .card-ready GATE" \
    "spec planning 1 .spec-review-ready SPEC" \
    "dispatch review 2 .leg-2-done DISPATCH" \
    "resume review 2 .leg-2-exited RESUME incomplete coachman" \
    "read review 2 .checkpoint-review-ready READ"
  do
    set -- $spec; name=$1 stage=$2 leg=$3 marker=$4 want=$5 outcome=${6:-} role=${7:-}
    root="$tmp/pos-$name"; mkdir -p "$root"; mkrun "$root" "$name" "$stage" "$leg" "$marker"
    if [ -n "$outcome" ]; then
      printf '{"outcome":"%s","role":"%s"}\n' "$outcome" "$role" > "$root/$name/logs/coachman-leg-$leg-attempts.jsonl"
    fi
    watch "$root"
    [ $rc -eq 0 ] && has "needs $name $want" && has "NEXT" \
      && ok "NEXT $want names $name" \
      || fail "NEXT $want names $name"
  done
  root="$tmp/pos-inspect"; mkdir -p "$root"; mkrun "$root" inspect review 2; age "$root" inspect
  watch "$root"
  [ $rc -eq 0 ] && has "needs inspect INSPECT" \
    && ok "NEXT INSPECT names inspect" || fail "NEXT INSPECT names inspect"
  root="$tmp/pos-late"; mkdir -p "$root"; mkrun "$root" late review 2
  "$self" --timeout 10 "$root" > "$tmp/late.out" 2>&1 &
  w=$!; sleep 2; : > "$root/late/.escalation-ready"; wait "$w"; rc=$?
  out=$(cat "$tmp/late.out")
  [ $rc -eq 0 ] && has "needs late RULE" && ! has "the poll interval is the default" \
    && ok "a run that becomes actionable mid-wait is named" \
    || fail "a run that becomes actionable mid-wait is named"
  root="$tmp/pos-multi"; mkdir -p "$root"
  mkrun "$root" first review 2 .escalation-ready
  mkrun "$root" second shipping 3 .card-ready
  watch "$root"
  [ $rc -eq 0 ] && has "needs first RULE" && has "needs second GATE" && has "NEXT" \
    && ok "every waking run is named" || fail "every waking run is named"
  root="$tmp/pos-prompt"; mkdir -p "$root"; mkrun "$root" prompt review 2
  t0=$(date +%s)
  "$self" --timeout 30 "$root" > "$tmp/prompt.out" 2>&1 &
  w=$!; sleep 2; : > "$root/prompt/.escalation-ready"; wait "$w"; rc=$?
  took=$(( $(date +%s) - t0 ))
  out=$(cat "$tmp/prompt.out")
  [ $rc -eq 0 ] && has "needs prompt RULE" && [ "$took" -le 15 ] \
    && ok "a usable poll interval wakes promptly" \
    || fail "a usable poll interval wakes promptly"

  echo "negative controls: WAIT, USER, - and a held run leave it waiting"
  root="$tmp/neg-wait"; mkdir -p "$root"; mkrun "$root" wait review 2
  watch "$root"
  [ $rc -eq 3 ] && has "NEXT" && has "wait " && has "WAIT" && ! has "needs " \
    && ok "a leg at work is left waiting until the timeout" \
    || fail "a leg at work is left waiting until the timeout"
  root="$tmp/neg-user"; mkdir -p "$root"; mkrun "$root" user review 2 .waiting-on-user .leg-2-exited
  watch "$root"
  [ $rc -eq 3 ] && has "NEXT" && has "user " && has ".waiting-on-user" && ! has "needs " \
    && ok "a run put to the user is left waiting until the timeout" \
    || fail "a run put to the user is left waiting until the timeout"
  root="$tmp/neg-closed"; mkdir -p "$root"; mkrun "$root" closed done 3 .leg-3-done
  watch "$root"
  [ $rc -eq 3 ] && has "NEXT" && has "closed " && has ".leg-3-done" && ! has "needs " \
    && ok "a closed run is left waiting until the timeout" \
    || fail "a closed run is left waiting until the timeout"
  root="$tmp/neg-held"; mkdir -p "$root"; mkrun "$root" held review 2 .escalation-ready
  mkdir -p "$root/postmaster"; printf 'held\n' > "$root/postmaster/held"
  watch "$root"
  [ $rc -eq 3 ] && has "NEXT" && has "held " && has ".escalation-ready" && ! has "needs " && ! has "matches no run" \
    && ok "a run on the held list never needs the postmaster" \
    || fail "a run on the held list never needs the postmaster"
  root="$tmp/neg-heldhash"; mkdir -p "$root"; mkrun "$root" 121 review 2 .escalation-ready
  mkdir -p "$root/postmaster"; printf '#121\n' > "$root/postmaster/held"
  out=$("$self" --timeout 0 "$root" 2>&1); rc=$?
  [ $rc -eq 0 ] && has "needs 121 RULE" && has "held \"#121\" matches no run" \
    && ok "a #ticket held line warns that it matches no run" || fail "a #ticket held line warns that it matches no run"
  root="$tmp/neg-heldtypo"; mkdir -p "$root"; mkrun "$root" wait review 2
  mkdir -p "$root/postmaster"; printf '999\n' > "$root/postmaster/held"
  out=$("$self" --timeout 0 "$root" 2>&1); rc=$?
  [ $rc -eq 3 ] && has "wait " && has "held \"999\" matches no run" && ! has "needs " \
    && ok "a held line for no run warns" || fail "a held line for no run warns"
  root="$tmp/neg-mixed"; mkdir -p "$root"
  mkrun "$root" free review 2 .card-ready
  mkrun "$root" held review 2 .escalation-ready
  mkdir -p "$root/postmaster"; printf 'held\n' > "$root/postmaster/held"
  watch "$root"
  [ $rc -eq 0 ] && has "needs free GATE" && has "held " && has ".escalation-ready" && ! has "needs held" \
    && ok "a held run is left out of the names even beside a waking run" \
    || fail "a held run is left out of the names even beside a waking run"
  root="$tmp/neg-heldlink"; mkdir -p "$root"; mkrun "$root" held review 2 .escalation-ready
  mkdir -p "$root/postmaster"; ln -s "$tmp/no-such-target" "$root/postmaster/held"
  out=$("$self" --timeout 0 "$root" 2>&1); rc=$?
  [ $rc -eq 1 ] && has "cannot read" && ! has "needs " \
    && ok "a dangling held link is refused" || fail "a dangling held link is refused"
  root="$tmp/neg-helddir"; mkdir -p "$root"; mkrun "$root" held review 2 .escalation-ready
  mkdir -p "$root/postmaster/held"
  out=$("$self" --timeout 0 "$root" 2>&1); rc=$?
  [ $rc -eq 1 ] && has "cannot read" && ! has "needs " \
    && ok "a held list that is a directory is refused" || fail "a held list that is a directory is refused"
  root="$tmp/neg-heldperm"; mkdir -p "$root"; mkrun "$root" held review 2 .escalation-ready
  mkdir -p "$root/postmaster"; printf 'held\n' > "$root/postmaster/held"; chmod 000 "$root/postmaster/held"
  out=$("$self" --timeout 0 "$root" 2>&1); rc=$?
  [ $rc -eq 1 ] && has "cannot read" && ! has "needs " \
    && ok "an unreadable held list is refused" || fail "an unreadable held list is refused"
  chmod 644 "$root/postmaster/held"
  root="$tmp/neg-heldlock"; mkdir -p "$root"; mkrun "$root" held review 2 .escalation-ready
  mkdir -p "$root/postmaster"; printf 'held\n' > "$root/postmaster/held"; chmod 000 "$root/postmaster"
  out=$("$self" --timeout 0 "$root" 2>&1); rc=$?
  [ $rc -eq 1 ] && has "cannot read" && ! has "needs " \
    && ok "an unlistable postmaster dir is refused" || fail "an unlistable postmaster dir is refused"
  chmod 755 "$root/postmaster"
  root="$tmp/neg-bsroot"; mkdir -p "$root"; mkrun "$root" heldrun review 2 .escalation-ready
  mkdir -p "$root/postmaster"; printf 'heldrun\n' > "$root/postmaster/held"
  bsroot="$tmp/neg-bs\\q"; mv "$root" "$bsroot"
  out=$("$self" --timeout 0 "$bsroot" 2>&1); rc=$?
  [ $rc -eq 3 ] && has "NEXT" && has "heldrun " && ! has "needs " && ! has "warning" \
    && ok "a run root with a backslash still holds its held runs" || fail "a run root with a backslash still holds its held runs"
  root="$tmp/neg-none"; mkdir -p "$root"; mkrun "$root" alone done 1
  out=$("$self" --timeout 0 "$root" 2>&1); rc=$?
  [ $rc -eq 3 ] && has "NEXT" && has "alone " && ! has "needs " \
    && ok "an empty timeout still looks once, prints the table and exits 3" \
    || fail "an empty timeout still looks once, prints the table and exits 3"

  echo "stream skip: the line count"
  printf 'a\nb' > "$tmp/unterminated.jsonl"
  printf 'a\nb\n' > "$tmp/terminated.jsonl"
  : > "$tmp/empty.jsonl"
  [ "$(stream_lines "$tmp/unterminated.jsonl")" = 2 ] \
    && [ "$(stream_lines "$tmp/terminated.jsonl")" = 2 ] \
    && [ "$(stream_lines "$tmp/empty.jsonl")" = 0 ] \
    && [ "$(stream_lines "$tmp/no-such.jsonl")" = 0 ] \
    && ok "the skip counts lines, including an unterminated last line" \
    || fail "the skip counts lines, including an unterminated last line"

  echo "watcher steps: dispatch and resume controls"
  pin="$tmp/pin"
  git init -q -b main "$pin" || { echo "self-test: cannot make the pin fixture"; exit 1; }
  mkdir -p "$pin/skills/postmaster"
  cp "$HERE/../skills/postmaster/coachman.md" "$pin/skills/postmaster/coachman.md" || exit 1
  git -C "$pin" -c user.name=t -c user.email=t@example.invalid add . \
    && git -C "$pin" -c user.name=t -c user.email=t@example.invalid commit -qm pin || exit 1
  pin_commit=$(git -C "$pin" rev-parse HEAD) || exit 1
  pin=$(CDPATH= cd -P -- "$pin" && pwd -P) || exit 1
  mkdir -p "$tmp/calls"
  root="$tmp/auto-dispatch"; auto_run "$root" dispatch 1 ""; handoff "$root/dispatch" 1
  : > "$root/dispatch/.leg-1-done"; : > "$root/dispatch/.leg-1-exited"
  watch_stub "$root"
  python3 - "$root/dispatch/manifest.json" "$root/dispatch/actions.jsonl" <<'PY'
import json, sys
m=json.load(open(sys.argv[1])); rows=[json.loads(x) for x in open(sys.argv[2])]
e=[x for x in rows if x.get("action")=="dispatch"]
assert m["leg"] == 2
assert m["coachman"]["legs"]["2"] == {"name":"coachman"}
assert len(e)==1 and "watcher took it" in e[0]["detail"] and "leg 2 (review)" in e[0]["detail"]
PY
  rc_test=$?
  [ $rc -eq 3 ] && [ $rc_test -eq 0 ] && [ -f "$tmp/calls/dispatch-dispatch-2" ] \
    && grep -qxF 'kind=dispatch' "$tmp/calls/dispatch-dispatch-2" \
    && grep -qxF "rt=$pin" "$tmp/calls/dispatch-dispatch-2" \
    && grep -qxF 'leg=review' "$tmp/calls/dispatch-dispatch-2" \
    && grep -qxF 'number=2' "$tmp/calls/dispatch-dispatch-2" \
    && grep -qxF 'thread=' "$tmp/calls/dispatch-dispatch-2" \
    && grep -qxF "prompt=$root/dispatch/leg-2-prompt.txt" "$tmp/calls/dispatch-dispatch-2" \
    && grep -qF 'Your review leg covers stage 2' "$root/dispatch/leg-2-prompt.txt" \
    && grep -qF "$pin/skills/postmaster/coachman.md" "$root/dispatch/leg-2-prompt.txt" \
    && ok "a checked hand-off dispatches the listed leg through its own checkout with no thread yet, and logs watcher ownership without launching an agent in the control" \
    || fail "a checked hand-off dispatches the listed leg through its own checkout with no thread yet, and logs watcher ownership without launching an agent in the control"
  root="$tmp/auto-skip-review"; auto_run "$root" skip-review 1 ""; handoff "$root/skip-review" 1
  sed -i 's/^turnpikes:.*/turnpikes: none/' "$root/skip-review/brief.md"
  : > "$root/skip-review/.leg-1-done"; : > "$root/skip-review/.leg-1-exited"
  watch_stub "$root"
  python3 - "$root/skip-review/manifest.json" "$root/skip-review/actions.jsonl" <<'PY'
import json,sys
m=json.load(open(sys.argv[1])); rows=[json.loads(x) for x in open(sys.argv[2])]
assert m["leg"] == 3 and m["coachman"]["legs"]["3"] == {"name":"coachman"}
assert any(x.get("action")=="note" and "omit the review leg" in x.get("detail","") for x in rows)
assert any(x.get("action")=="dispatch" and "watcher took it" in x.get("detail","") for x in rows)
PY
  rc_test=$?
  [ $rc -eq 3 ] && [ $rc_test -eq 0 ] && [ -f "$tmp/calls/dispatch-skip-review-3" ] \
    && grep -qxF 'leg=ship' "$tmp/calls/dispatch-skip-review-3" \
    && ok "the watcher follows a legs list without review and records the omission" \
    || fail "the watcher follows a legs list without review and records the omission"
  root="$tmp/auto-unpinned"; auto_run "$root" unpinned 1 ""; handoff "$root/unpinned" 1
  python3 - "$root/unpinned/run.json" <<'PY'
import json, sys
p = sys.argv[1]
r = json.load(open(p)); r["postmaster"] = {}
json.dump(r, open(p, "w"), indent=2)
PY
  printf 'tool: %s\n' "$pin" >> "$root/unpinned/brief.md"
  : > "$root/unpinned/.leg-1-done"; : > "$root/unpinned/.leg-1-exited"
  watch_stub "$root"
  [ $rc -eq 3 ] && [ -f "$tmp/calls/dispatch-unpinned-2" ] \
    && grep -qxF "rt=$pin" "$tmp/calls/dispatch-unpinned-2" \
    && [ "$(action_count "$root/unpinned" dispatch)" -eq 1 ] \
    && ok "a run with no checkout recorded dispatches from its waybill tool" \
    || fail "a run with no checkout recorded dispatches from its waybill tool"
  root="$tmp/auto-stale-pin"; auto_run "$root" stale-pin 1 ""; handoff "$root/stale-pin" 1
  python3 - "$root/stale-pin/run.json" <<'PY'
import json, sys
p = sys.argv[1]
r = json.load(open(p)); r["postmaster"]["commit"] = "0" * 40
json.dump(r, open(p, "w"), indent=2)
PY
  : > "$root/stale-pin/.leg-1-done"; : > "$root/stale-pin/.leg-1-exited"
  watch_stub "$root"
  [ $rc -eq 0 ] && has "needs stale-pin DISPATCH" && has "does not serve" \
    && [ ! -e "$tmp/calls/dispatch-stale-pin-2" ] \
    && ok "a checkout that moved past its dispatch commit wakes and launches nothing" \
    || fail "a checkout that moved past its dispatch commit wakes and launches nothing"
  root="$tmp/auto-repo-fallback"; auto_run "$root" repo-fallback 1 ""; handoff "$root/repo-fallback" 1
  sed -i '/^repo: /d' "$root/repo-fallback/brief.md"
  python3 - "$root" "$root/repo-fallback/checks.json" <<'PY'
import json, sys
json.dump({"repo": sys.argv[1] + "-project", "head": "fixture", "checks": []},
          open(sys.argv[2], "w"))
PY
  : > "$root/repo-fallback/.leg-1-done"; : > "$root/repo-fallback/.leg-1-exited"
  watch_stub "$root"
  [ $rc -eq 3 ] && [ -f "$tmp/calls/dispatch-repo-fallback-2" ] \
    && [ "$(action_count "$root/repo-fallback" dispatch)" -eq 1 ] \
    && ok "a waybill with no repo path dispatches from the recorded checks" \
    || fail "a waybill with no repo path dispatches from the recorded checks"
  root="$tmp/auto-no-repo"; auto_run "$root" no-repo 1 ""; handoff "$root/no-repo" 1
  sed -i '/^repo: /d' "$root/no-repo/brief.md"
  : > "$root/no-repo/.leg-1-done"; : > "$root/no-repo/.leg-1-exited"
  watch_stub "$root"
  [ $rc -eq 0 ] && has "needs no-repo DISPATCH" && [ ! -e "$tmp/calls/dispatch-no-repo-2" ] \
    && ok "a run with no repo anywhere wakes and launches nothing" \
    || fail "a run with no repo anywhere wakes and launches nothing"
  root="$tmp/auto-one-line"; auto_run "$root" one-line 1 ""; handoff "$root/one-line" 1
  sed -i "s|^repo: \(.*\)|repo: \1          default branch: main       BASE: fixture|" "$root/one-line/brief.md"
  : > "$root/one-line/.leg-1-done"; : > "$root/one-line/.leg-1-exited"
  watch_stub "$root"
  [ $rc -eq 3 ] && [ -f "$tmp/calls/dispatch-one-line-2" ] \
    && [ "$(action_count "$root/one-line" dispatch)" -eq 1 ] \
    && ok "a one-line profile dispatches from the repo field alone" \
    || fail "a one-line profile dispatches from the repo field alone"
  root="$tmp/auto-early-profile"; auto_run "$root" early-profile 1 ""; handoff "$root/early-profile" 1
  python3 - "$root/early-profile/brief.md" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
text = p.read_text().replace("## Ticket\n", "## Ticket\n## Problem\nx\n## Project profile\nrepo: /tmp/nowhere-shadow\n\n", 1)
p.write_text(text)
PY
  : > "$root/early-profile/.leg-1-done"; : > "$root/early-profile/.leg-1-exited"
  watch_stub "$root"
  [ $rc -eq 3 ] && [ -f "$tmp/calls/dispatch-early-profile-2" ] \
    && ok "a ticket-text profile does not shadow the waybill's own" \
    || fail "a ticket-text profile does not shadow the waybill's own"

  echo "corrupt manifests: reported once, never dispatched from, never fatal"
  for bad in 0 true null 2.0 '[]'; do
    case $bad in 0) s=0;; true) s=True;; null) s=None;; 2.0) s=2.0;; '[]') s='[]';; esac
    root="$tmp/auto-corrupt-$s"; auto_run "$root" bad 1 ""; handoff "$root/bad" "$s"
    python3 - "$root/bad/manifest.json" "$bad" <<'PY'
import json, sys
p = sys.argv[1]
m = json.load(open(p))
m["leg"] = json.loads(sys.argv[2])
json.dump(m, open(p, "w"), indent=2)
PY
    : > "$root/bad/.leg-$s-done"; : > "$root/bad/.leg-$s-exited"
    mkrun "$root" good review 2 .escalation-ready
    watch_stub "$root"
    still_bad=$(python3 -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1]))["leg"]))' "$root/bad/manifest.json")
    launched=$(find "$tmp/calls" -name 'dispatch-bad-*' | head -1)
    [ $rc -eq 0 ] && has "needs bad DISPATCH" && has "manifest leg" \
      && has "needs good RULE" && [ "$still_bad" = "$bad" ] && [ -z "$launched" ] \
      && ok "corrupt manifest leg $bad is reported, never dispatched, never fatal" \
      || fail "corrupt manifest leg $bad is reported, never dispatched, never fatal"
  done
  echo "leading-zero legs: reported corrupt on the dispatch path, never dispatched from, never fatal"
  for bad in 02 08; do
    root="$tmp/auto-corrupt-$bad"; auto_run "$root" badleg 1 ""; handoff "$root/badleg" "$bad"
    python3 - "$root/badleg/manifest.json" "$bad" <<'PY'
import json, sys
p = sys.argv[1]
m = json.load(open(p))
m["leg"] = sys.argv[2]
json.dump(m, open(p, "w"), indent=2)
PY
    : > "$root/badleg/.leg-$bad-done"; : > "$root/badleg/.leg-$bad-exited"
    mkrun "$root" good review 2 .escalation-ready
    watch_stub "$root"
    still_bad=$(python3 -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1]))["leg"]))' "$root/badleg/manifest.json")
    launched=$(find "$tmp/calls" -name 'dispatch-badleg-*' | head -1)
    [ $rc -eq 0 ] && has "needs badleg DISPATCH" && has "not a canonical integer" \
      && has "needs good RULE" && [ "$still_bad" = "\"$bad\"" ] && [ -z "$launched" ] \
      && ok "leading-zero leg $bad is reported corrupt, never dispatched, never fatal" \
      || fail "leading-zero leg $bad is reported corrupt, never dispatched, never fatal"
  done
  echo "leading-zero legs: reported corrupt on the resume path, never resumed, never fatal"
  for bad in 02 08; do
    root="$tmp/auto-corrupt-remount-$bad"; auto_run "$root" badremount 1 "thread-badremount"
    python3 - "$root/badremount/manifest.json" "$bad" <<'PY'
import json, sys
p = sys.argv[1]
m = json.load(open(p))
m["leg"] = sys.argv[2]
json.dump(m, open(p, "w"), indent=2)
PY
    record_attempt "$root/badremount" "$bad" incomplete coachman thread-badremount
    printf '%s\n' 'model stream idle timeout' > "$root/badremount/logs/coachman-leg-$bad.err"
    : > "$root/badremount/logs/coachman-leg-$bad-events.jsonl"; : > "$root/badremount/.leg-$bad-exited"
    mkrun "$root" good review 2 .escalation-ready
    watch_stub "$root"
    launched=$(find "$tmp/calls" -name 'resume-badremount-*' | head -1)
    [ $rc -eq 0 ] && has "needs badremount RESUME" && has "not a canonical integer" \
      && has "needs good RULE" && [ -z "$launched" ] \
      && [ ! -e "$root/badremount/watcher.json" ] \
      && ok "leading-zero leg $bad on a resume is reported corrupt, never resumed, never fatal" \
      || fail "leading-zero leg $bad on a resume is reported corrupt, never resumed, never fatal"
  done

  root="$tmp/auto-resume"; auto_run "$root" resume 1 "prior-thread"
  record_attempt "$root/resume" 1 incomplete coachman prior-thread
  printf '%s\n' 'Model stream idle timeout' > "$root/resume/logs/coachman-leg-1.err"
  : > "$root/resume/logs/coachman-leg-1-events.jsonl"; : > "$root/resume/.leg-1-exited"
  watch_stub "$root"
  [ $rc -eq 3 ] && has "resume " \
    && [ "$(action_count "$root/resume" resume)" -eq 1 ] \
    && grep -qF 'watcher took it' "$root/resume/actions.jsonl" \
    && grep -qF 'resume 1 of 3' "$root/resume/actions.jsonl" \
    && grep -qF 'Continue leg 1; your last written state is in the dispatch directory and the worktree.' "$root/resume/leg-1-resume-"*.txt \
    && grep -qxF 'kind=resume' "$tmp/calls/resume-resume-1" \
    && grep -qxF "rt=$pin" "$tmp/calls/resume-resume-1" \
    && grep -qxF 'leg=synthesis' "$tmp/calls/resume-resume-1" \
    && grep -qxF 'thread=prior-thread' "$tmp/calls/resume-resume-1" \
    && [ ! -e "$root/resume/.leg-1-exited" ] \
    && ok "a named transient end resumes the recorded thread with the remount prompt and logs it without launching an agent in the control" \
    || fail "a named transient end resumes the recorded thread with the remount prompt and logs it without launching an agent in the control"
  for attempt in 2 3; do
    printf '%s\n' 'model_stream_idle_timeout' > "$root/resume/logs/coachman-leg-1.err"
    : > "$root/resume/.leg-1-exited"
    watch_stub "$root"
    got=$(python3 - "$root/resume/watcher.json" <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))["resume_attempts"]["1"])
PY
    )
    [ $rc -eq 3 ] && [ "$got" = "$attempt" ] && [ "$(action_count "$root/resume" resume)" -eq "$attempt" ] \
      && ok "transient end $attempt is resumed and its per-leg count persists" \
      || fail "transient end $attempt is resumed and its per-leg count persists"
  done
  printf '%s\n' 'model stream idle timeout' > "$root/resume/logs/coachman-leg-1.err"
  : > "$root/resume/.leg-1-exited"
  watch_stub "$root"
  got=$(python3 - "$root/resume/watcher.json" <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))["resume_attempts"]["1"])
PY
  )
  [ $rc -eq 0 ] && has "needs resume RESUME" && [ "$got" = 3 ] \
    && [ "$(action_count "$root/resume" resume)" -eq 3 ] \
    && ok "the fourth transient end wakes the postmaster without incrementing or resuming" \
    || fail "the fourth transient end wakes the postmaster without incrementing or resuming"
  root="$tmp/auto-resume-fallback"; auto_run "$root" resume-fallback 1 "thread-fb"
  python3 - "$root/resume-fallback/manifest.json" <<'PY'
import json, sys
p = sys.argv[1]
m = json.load(open(p)); m["coachman"]["legs"]["1"]["name"] = "coachman_fallback"
json.dump(m, open(p, "w"), indent=2)
PY
  record_attempt "$root/resume-fallback" 1 incomplete coachman_fallback thread-fb
  printf '%s\n' 'model stream idle timeout' > "$root/resume-fallback/logs/coachman-leg-1.err"
  : > "$root/resume-fallback/logs/coachman-leg-1-events.jsonl"; : > "$root/resume-fallback/.leg-1-exited"
  watch_stub "$root"
  [ $rc -eq 3 ] && [ "$(action_count "$root/resume-fallback" resume)" -eq 1 ] \
    && grep -qxF 'thread=thread-fb' "$tmp/calls/resume-resume-fallback-1" \
    && ok "a transient end on a fallback leg resumes on its recorded thread" \
    || fail "a transient end on a fallback leg resumes on its recorded thread"
  root="$tmp/auto-stale"; auto_run "$root" stale 1 "thread-stale"
  record_attempt "$root/stale" 1 incomplete coachman thread-stale
  printf '%s\n' 'model stream idle timeout' > "$root/stale/logs/coachman-leg-1.err"
  printf '%s\n' '{"type":"error","message":"model stream idle timeout"}' > "$root/stale/logs/coachman-leg-1-events.jsonl"
  : > "$root/stale/.leg-1-exited"
  watch_stub "$root"
  [ $rc -eq 3 ] && [ "$(action_count "$root/stale" resume)" -eq 1 ] \
    || fail "an old transient error in the stream does not resume a later unrelated failure (setup: no first resume)"
  printf '%s\n' 'AssertionError: something the lane did wrong' > "$root/stale/logs/coachman-leg-1.err"
  : > "$root/stale/.leg-1-exited"
  watch_stub "$root"
  got=$(python3 - "$root/stale/watcher.json" <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))["resume_attempts"]["1"])
PY
  )
  [ $rc -eq 0 ] && has "needs stale RESUME" && [ "$got" = 1 ] \
    && [ "$(action_count "$root/stale" resume)" -eq 1 ] \
    && ok "an old transient error in the stream does not resume a later unrelated failure" \
    || fail "an old transient error in the stream does not resume a later unrelated failure"
  root="$tmp/auto-unterm"; auto_run "$root" unterm 1 "thread-unterm"
  record_attempt "$root/unterm" 1 incomplete coachman thread-unterm
  printf '%s\n' 'model stream idle timeout' > "$root/unterm/logs/coachman-leg-1.err"
  printf '{"type":"assistant","message":"hi"}\n{"type":"error","message":"model stream idle timeout"}' > "$root/unterm/logs/coachman-leg-1-events.jsonl"
  : > "$root/unterm/.leg-1-exited"
  watch_stub "$root"
  [ $rc -eq 3 ] && [ "$(action_count "$root/unterm" resume)" -eq 1 ] \
    || fail "an unterminated old error stays out of the new classification (setup: no first resume)"
  # The stub always appends; a resumed launch that dies silent appends nothing. Restore the
  # lane's exact shape to model it: the old error last and unterminated, nothing after.
  printf '{"type":"assistant","message":"hi"}\n{"type":"error","message":"model stream idle timeout"}' > "$root/unterm/logs/coachman-leg-1-events.jsonl"
  printf '%s\n' 'AssertionError: something the lane did wrong' > "$root/unterm/logs/coachman-leg-1.err"
  : > "$root/unterm/.leg-1-exited"
  watch_stub "$root"
  got=$(python3 - "$root/unterm/watcher.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
print("%s/%s" % (d["resume_attempts"]["1"], d["stream_skip"]["1"]))
PY
  )
  [ $rc -eq 0 ] && has "needs unterm RESUME" && [ "$got" = 1/2 ] \
    && [ "$(action_count "$root/unterm" resume)" -eq 1 ] \
    && ok "an unterminated old error stays out of the new classification" \
    || fail "an unterminated old error stays out of the new classification (got $got)"
  for spec in "gateway 529 overloaded" "drop read: connection reset by peer"; do
    set -- $spec; name=$1; message=${spec#* }
    root="$tmp/auto-$name"; auto_run "$root" "$name" 1 "thread-$name"
    record_attempt "$root/$name" 1 incomplete coachman "thread-$name"
    printf '%s\n' "$message" > "$root/$name/logs/coachman-leg-1.err"
    : > "$root/$name/logs/coachman-leg-1-events.jsonl"; : > "$root/$name/.leg-1-exited"
    watch_stub "$root"
    [ $rc -eq 3 ] && [ "$(action_count "$root/$name" resume)" -eq 1 ] \
      && [ -f "$tmp/calls/resume-$name-1" ] \
      && ok "a $name failure is resumed as a named transient end" \
      || fail "a $name failure is resumed as a named transient end"
  done

  echo "postmaster wake controls: recorded walls and refusals"
  for spec in "wall TAKEOVER walled coachman quota exceeded: provider capacity reached" "provider TAKEOVER walled coachman provider wall: model capacity exhausted" "fallbackwall ASK walled coachman_fallback quota exceeded on the fallback leg" "refusal ASK refused coachman launch: resume needs a thread id"; do
    set -- $spec; name=$1 want=$2 outcome=$3 role=$4; shift 4; message=$*
    root="$tmp/wake-$name"; auto_run "$root" "$name" 1 "thread-$name"
    record_attempt "$root/$name" 1 "$outcome" "$role" "thread-$name"
    printf '%s\n' "$message" > "$root/$name/logs/coachman-leg-1.err"
    : > "$root/$name/logs/coachman-leg-1-events.jsonl"; : > "$root/$name/.leg-1-exited"
    watch_stub "$root"
    [ $rc -eq 0 ] && has "needs $name $want" && [ ! -e "$root/$name/watcher.json" ] \
      && [ ! -e "$tmp/calls/resume-$name-1" ] \
      && ok "$name remains with the postmaster and is not retried" \
      || fail "$name remains with the postmaster and is not retried"
  done
  root="$tmp/wake-other-error"; auto_run "$root" other-error 1 "thread-other"
  record_attempt "$root/other-error" 1 incomplete coachman thread-other
  printf '%s\n' 'AssertionError: something the lane did wrong' > "$root/other-error/logs/coachman-leg-1.err"
  : > "$root/other-error/logs/coachman-leg-1-events.jsonl"; : > "$root/other-error/.leg-1-exited"
  watch_stub "$root"
  [ $rc -eq 0 ] && has "needs other-error RESUME" \
    && [ ! -e "$root/other-error/watcher.json" ] \
    && [ ! -e "$tmp/calls/resume-other-error-1" ] \
    && ok "an unlisted provider error stays with the postmaster" \
    || fail "an unlisted provider error stays with the postmaster"
  root="$tmp/wake-no-thread-remount"; auto_run "$root" no-thread-remount 1 ""
  record_attempt "$root/no-thread-remount" 1 incomplete coachman thread-elsewhere
  printf '%s\n' 'model stream idle timeout' > "$root/no-thread-remount/logs/coachman-leg-1.err"
  : > "$root/no-thread-remount/logs/coachman-leg-1-events.jsonl"; : > "$root/no-thread-remount/.leg-1-exited"
  watch_stub "$root"
  [ $rc -eq 0 ] && has "needs no-thread-remount RESUME" \
    && has "no recorded thread id" \
    && [ ! -e "$root/no-thread-remount/watcher.json" ] \
    && [ ! -e "$tmp/calls/resume-no-thread-remount-1" ] \
    && ok "a resume the manifest cannot thread stays with the postmaster" \
    || fail "a resume the manifest cannot thread stays with the postmaster"

  echo "postmaster wake controls: incomplete watcher steps"
  root="$tmp/wake-handoff"; auto_run "$root" handoff 1 ""; : > "$root/handoff/.leg-1-done"; : > "$root/handoff/.leg-1-exited"
  printf '## Decisions\nmissing the other required sections\n' > "$root/handoff/handoff-1.md"
  watch_stub "$root"
  [ $rc -eq 0 ] && has "needs handoff DISPATCH" && [ ! -e "$tmp/calls/dispatch-handoff-2" ] \
    && ok "a failed hand-off check wakes the postmaster and launches nothing" \
    || fail "a failed hand-off check wakes the postmaster and launches nothing"
  root="$tmp/wake-legs"; auto_run "$root" legs 1 ""; : > "$root/legs/.leg-1-done"; : > "$root/legs/.leg-1-exited"
  sed -i 's/^turnpikes:.*/not a turnpikes line/' "$root/legs/brief.md"; handoff "$root/legs" 1
  watch_stub "$root"
  [ $rc -eq 0 ] && has "needs legs DISPATCH" && [ ! -e "$tmp/calls/dispatch-legs-2" ] \
    && ok "a failed turnpikes lookup wakes the postmaster and launches nothing" \
    || fail "a failed turnpikes lookup wakes the postmaster and launches nothing"
  root="$tmp/wake-close"; auto_run "$root" close 3 "thread-close"; handoff "$root/close" 3
  sed -i 's/^turnpikes:.*/turnpikes: none/' "$root/close/brief.md"
  : > "$root/close/.leg-3-done"; : > "$root/close/.leg-3-exited"
  watch_stub "$root"
  [ $rc -eq 0 ] && has "needs close DISPATCH" && [ ! -e "$tmp/calls/dispatch-close-4" ] \
    && ok "a done ship leg with nothing after it wakes for the close" \
    || fail "a done ship leg with nothing after it wakes for the close"
  root="$tmp/wake-dispatch"; auto_run "$root" dispatch-failure 1 ""; handoff "$root/dispatch-failure" 1
  : > "$root/dispatch-failure/.leg-1-done"; : > "$root/dispatch-failure/.leg-1-exited"
  watch_stub "$root" "dispatch failure"
  refused_outcome=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["outcome"])' "$root/dispatch-failure/logs/coachman-leg-2-attempts.jsonl")
  [ $rc -eq 0 ] && has "needs dispatch-failure DISPATCH" \
    && [ ! -e "$root/dispatch-failure/.leg-2-exited" ] \
    && [ "$refused_outcome" = refused ] \
    && [ "$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["leg"])' "$root/dispatch-failure/manifest.json")" = 2 ] \
    && [ "$(action_count "$root/dispatch-failure" dispatch)" -eq 0 ] \
    && ok "a dispatch the host cannot start wakes with its refusal recorded" \
    || fail "a dispatch the host cannot start wakes with its refusal recorded"
  root="$tmp/wake-launch-refusal"; auto_run "$root" launch-refusal 1 ""; handoff "$root/launch-refusal" 1
  : > "$root/launch-refusal/.leg-1-done"; : > "$root/launch-refusal/.leg-1-exited"
  watch_stub "$root" "dispatch refusal"
  [ $rc -eq 0 ] && has "needs launch-refusal DISPATCH" \
    && [ ! -e "$root/launch-refusal/logs/coachman-leg-2-attempts.jsonl" ] \
    && [ ! -e "$root/launch-refusal/.leg-2-exited" ] \
    && [ ! -e "$root/launch-refusal/.leg-2-done" ] \
    && [ ! -e "$root/launch-refusal/watcher.json" ] \
    && [ "$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["leg"])' "$root/launch-refusal/manifest.json")" = 2 ] \
    && ok "a dispatch the leg refuses wakes with markers and records untouched" \
    || fail "a dispatch the leg refuses wakes with markers and records untouched"
  root="$tmp/wake-resume"; auto_run "$root" resume-failure 1 "thread-resume"
  record_attempt "$root/resume-failure" 1 incomplete coachman thread-resume
  printf '%s\n' 'model stream idle timeout' > "$root/resume-failure/logs/coachman-leg-1.err"
  : > "$root/resume-failure/logs/coachman-leg-1-events.jsonl"; : > "$root/resume-failure/.leg-1-exited"
  watch_stub "$root" "resume failure"
  [ $rc -eq 0 ] && has "needs resume-failure RESUME" \
    && [ "$(action_count "$root/resume-failure" resume)" -eq 0 ] \
    && [ "$(action_count "$root/resume-failure" refuse)" -eq 1 ] \
    && [ "$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["resume_attempts"]["1"])' "$root/resume-failure/watcher.json")" = 0 ] \
    && [ "$(tail -1 "$root/resume-failure/logs/coachman-leg-1-attempts.jsonl" | python3 -c 'import json,sys;print(json.load(sys.stdin)["outcome"])')" = refused ] \
    && ok "a resume the host cannot start wakes with its refusal recorded and the count restored" \
    || fail "a resume the host cannot start wakes with its refusal recorded and the count restored"
  root="$tmp/wake-resume-refusal"; auto_run "$root" resume-refusal 1 "thread-resume-refusal"
  record_attempt "$root/resume-refusal" 1 incomplete coachman thread-resume-refusal
  printf '%s\n' 'model stream idle timeout' > "$root/resume-refusal/logs/coachman-leg-1.err"
  : > "$root/resume-refusal/logs/coachman-leg-1-events.jsonl"; : > "$root/resume-refusal/.leg-1-exited"
  watch_stub "$root" "resume refusal"
  refused_count=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["resume_attempts"]["1"])' "$root/resume-refusal/watcher.json")
  [ $rc -eq 0 ] && has "needs resume-refusal RESUME" \
    && has "leg: simulated refusal" \
    && [ "$(action_count "$root/resume-refusal" refuse)" -eq 1 ] \
    && [ "$(action_count "$root/resume-refusal" resume)" -eq 0 ] \
    && ! grep -q 'watcher took it' "$root/resume-refusal/actions.jsonl" \
    && [ "$refused_count" = 0 ] \
    && [ "$(tail -1 "$root/resume-refusal/logs/coachman-leg-1-attempts.jsonl" | python3 -c 'import json,sys;print(json.load(sys.stdin)["outcome"])')" = incomplete ] \
    && ok "a refused resume wakes in the same look with a refusal record, the count unchanged, and no success line" \
    || fail "a refused resume wakes in the same look with a refusal record, the count unchanged, and no success line"
  root="$tmp/wake-resume-refusal-many"; auto_run "$root" refusal-many 1 "thread-refusal-many"
  record_attempt "$root/refusal-many" 1 incomplete coachman thread-refusal-many
  printf '%s\n' 'model stream idle timeout' > "$root/refusal-many/logs/coachman-leg-1.err"
  : > "$root/refusal-many/logs/coachman-leg-1-events.jsonl"; : > "$root/refusal-many/.leg-1-exited"
  watch_stub_wait "$root"
  [ $rc -eq 0 ] && has "needs refusal-many RESUME" \
    && [ "$(action_count "$root/refusal-many" refuse)" -ge 1 ] \
    && [ "$(action_count "$root/refusal-many" resume)" -eq 0 ] \
    && [ "$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["resume_attempts"]["1"])' "$root/refusal-many/watcher.json")" = 0 ] \
    && ok "a standing refusal is named every look without spending a remount" \
    || fail "a standing refusal is named every look without spending a remount"
  root="$tmp/wake-log"; auto_run "$root" log-failure 1 ""; handoff "$root/log-failure" 1
  : > "$root/log-failure/.leg-1-done"; : > "$root/log-failure/.leg-1-exited"
  rm -- "$root/log-failure/actions.jsonl"; mkdir "$root/log-failure/actions.jsonl"
  watch_stub "$root"
  [ $rc -eq 0 ] && has "needs log-failure DISPATCH" \
    && [ -f "$tmp/calls/dispatch-log-failure-2" ] \
    && ok "a dispatch whose action cannot be logged wakes the postmaster" \
    || fail "a dispatch whose action cannot be logged wakes the postmaster"
  root="$tmp/wake-resume-log"; auto_run "$root" resume-log 1 "thread-resume-log"
  record_attempt "$root/resume-log" 1 incomplete coachman thread-resume-log
  printf '%s\n' 'model stream idle timeout' > "$root/resume-log/logs/coachman-leg-1.err"
  : > "$root/resume-log/logs/coachman-leg-1-events.jsonl"; : > "$root/resume-log/.leg-1-exited"
  rm -- "$root/resume-log/actions.jsonl"; mkdir "$root/resume-log/actions.jsonl"
  watch_stub "$root"
  [ $rc -eq 0 ] && has "needs resume-log RESUME" \
    && [ -f "$tmp/calls/resume-resume-log-1" ] \
    && [ "$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["resume_attempts"]["1"])' "$root/resume-log/watcher.json")" = 1 ] \
    && ok "a resume whose action cannot be logged wakes the postmaster" \
    || fail "a resume whose action cannot be logged wakes the postmaster"

  echo "negative controls: held runs are left untouched"
  root="$tmp/held-dispatch"; auto_run "$root" held-dispatch 1 ""; handoff "$root/held-dispatch" 1
  : > "$root/held-dispatch/.leg-1-done"; : > "$root/held-dispatch/.leg-1-exited"
  printf 'held-dispatch\n' > "$root/postmaster/held"
  watch_stub "$root"
  [ $rc -eq 3 ] && ! has "needs " && [ ! -e "$tmp/calls/dispatch-held-dispatch-2" ] \
    && [ ! -e "$root/held-dispatch/leg-2-prompt.txt" ] \
    && [ ! -e "$root/held-dispatch/watcher.json" ] \
    && [ -e "$root/held-dispatch/.leg-1-done" ] && [ -e "$root/held-dispatch/.leg-1-exited" ] \
    && [ "$(action_count "$root/held-dispatch" dispatch)" -eq 0 ] \
    && [ "$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["leg"])' "$root/held-dispatch/manifest.json")" = 1 ] \
    && ok "a held dispatch run keeps its manifest, markers, log, and files unchanged" \
    || fail "a held dispatch run keeps its manifest, markers, log, and files unchanged"
  root="$tmp/held-resume"; auto_run "$root" held-resume 1 "thread-held"
  record_attempt "$root/held-resume" 1 incomplete coachman thread-held
  printf '%s\n' 'model stream idle timeout' > "$root/held-resume/logs/coachman-leg-1.err"
  : > "$root/held-resume/logs/coachman-leg-1-events.jsonl"; : > "$root/held-resume/.leg-1-exited"
  printf 'held-resume\n' > "$root/postmaster/held"
  watch_stub "$root"
  [ $rc -eq 3 ] && ! has "needs " && [ ! -e "$tmp/calls/resume-held-resume-1" ] \
    && [ ! -e "$root/held-resume/watcher.json" ] \
    && [ -e "$root/held-resume/.leg-1-exited" ] \
    && [ "$(action_count "$root/held-resume" resume)" -eq 0 ] \
    && ok "a held resume run keeps its count, marker, and log unchanged" \
    || fail "a held resume run keeps its count, marker, and log unchanged"

  echo "config: a missing or unusable poll interval falls back to the default"
  root="$tmp/cfg-missing"; mkdir -p "$root"; mkrun "$root" wait review 2
  out=$(POSTMASTER_CONFIG="$tmp/nowhere.toml" "$self" --timeout 2 "$root" 2>&1); rc=$?
  [ $rc -eq 3 ] && has "NEXT" && has "wait " && ! has "needs " && has "the poll interval is the default, 120s" \
    && ok "a missing config still runs on the default, and says so" \
    || fail "a missing config still runs on the default, and says so"
  printf '[postmaster]\npoll_seconds = "soon"\n' > "$tmp/bad.toml"
  out=$(POSTMASTER_CONFIG="$tmp/bad.toml" "$self" --timeout 2 "$root" 2>&1); rc=$?
  [ $rc -eq 3 ] && has "NEXT" && has "wait " && has "the poll interval is the default, 120s" \
    && ok "an unusable poll interval falls back to the default, and says so" \
    || fail "an unusable poll interval falls back to the default, and says so"
  printf '[postmaster]\npoll_seconds = 0\n' > "$tmp/zero.toml"
  out=$(POSTMASTER_CONFIG="$tmp/zero.toml" "$self" --timeout 2 "$root" 2>&1); rc=$?
  [ $rc -eq 3 ] && has "wait " && has "the poll interval is the default, 120s" \
    && ok "a zero poll interval falls back to the default, and says so" \
    || fail "a zero poll interval falls back to the default, and says so"
  python3 -c "open('$tmp/badutf8.toml','wb').write(b'\xff\xfe\x00bad\x80')"
  out=$(POSTMASTER_CONFIG="$tmp/badutf8.toml" "$self" --timeout 2 "$root" 2>&1); rc=$?
  [ $rc -eq 3 ] && has "wait " && has "the poll interval is the default, 120s" && ! has "Traceback" \
    && ok "a config that is not UTF-8 falls back to the default, and says so" \
    || fail "a config that is not UTF-8 falls back to the default, and says so"
  printf '[postmaster]\npoll_seconds = 8\n' > "$tmp/slow.toml"
  t0=$(date +%s)
  out=$(POSTMASTER_CONFIG="$tmp/slow.toml" "$self" --timeout 2 "$root" 2>&1); rc=$?
  took=$(( $(date +%s) - t0 ))
  [ $rc -eq 3 ] && has "wait " && [ "$took" -le 5 ] \
    && ok "a timeout shorter than the poll interval still ends on time" \
    || fail "a timeout shorter than the poll interval still ends on time"

  echo "usage"
  out=$("$self" 2>&1); rc=$?
  [ $rc -eq 1 ] && has "usage:" && ! has "NEXT" \
    && ok "no run root is refused with the usage" || fail "no run root is refused with the usage"
  out=$("$self" --timeout soon "$tmp/neg-wait" 2>&1); rc=$?
  [ $rc -eq 1 ] && has "not a whole number" \
    && ok "a timeout that is not a number is refused" || fail "a timeout that is not a number is refused"
  out=$("$self" --timeout "" "$tmp/neg-wait" 2>&1); rc=$?
  [ $rc -eq 1 ] && has "not a whole number" \
    && ok "an empty timeout is refused" || fail "an empty timeout is refused"
  out=$("$self" --timeout 2 "$tmp/nowhere" 2>&1); rc=$?
  [ $rc -eq 1 ] && has "no such root" \
    && ok "a run root that does not exist is refused" || fail "a run root that does not exist is refused"
  out=$("$self" --help 2>&1); rc=$?
  [ $rc -eq 0 ] && has "runs-watch.sh" && has "held" \
    && ok "--help prints the usage" || fail "--help prints the usage"

  echo
  [ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
  echo "self-test: $fails control(s) misbehaved"; exit 1
fi

ROOT="" TIMEOUT="" CONFIG=${POSTMASTER_CONFIG:-${HOME:-}/.postmaster/config.toml}
while [ $# -gt 0 ]; do
  case $1 in
    --timeout)
      [ $# -ge 2 ] || { echo "usage: runs-watch.sh <project-run-root> [--timeout <seconds>] | --help | --self-test" >&2; exit 1; }
      [ -n "$2" ] || { echo "runs-watch: '' is not a whole number of seconds" >&2; exit 1; }
      TIMEOUT=$2; shift ;;
    -*) echo "usage: runs-watch.sh <project-run-root> [--timeout <seconds>] | --help | --self-test" >&2; exit 1 ;;
    *) [ -z "$ROOT" ] || { echo "usage: runs-watch.sh <project-run-root> [--timeout <seconds>] | --help | --self-test" >&2; exit 1; }
       ROOT=$1 ;;
  esac
  shift
done
[ -n "$ROOT" ] || { echo "usage: runs-watch.sh <project-run-root> [--timeout <seconds>] | --help | --self-test" >&2; exit 1; }
if [ -n "$TIMEOUT" ]; then
  case $TIMEOUT in *[!0-9]*) echo "runs-watch: '$TIMEOUT' is not a whole number of seconds" >&2; exit 1 ;; esac
  t=${TIMEOUT#"${TIMEOUT%%[!0]*}"}
  [ ${#t} -le 9 ] || { echo "runs-watch: '$TIMEOUT' is more than 9 digits" >&2; exit 1; }
  TIMEOUT=$((10#$TIMEOUT))
fi
ROOT=$(CDPATH= cd -P -- "$ROOT" 2>/dev/null && pwd -P) || { echo "runs-watch: no such root: $ROOT" >&2; exit 1; }

pm="$ROOT/postmaster"
left=${TIMEOUT:-}

while :; do
  POLL=$(poll_seconds) || exit 1
  HELD_LIST=$(held_lines "$pm") || exit 1
  table=$("$HERE/runs-status.sh" "$ROOT") || { echo "runs-watch: runs-status.sh failed on $ROOT" >&2; exit 1; }
  printf '%s\n' "$table" | POSTMASTER_HELD_LINES="$HELD_LIST" waking_runs >/dev/null
  process_table "$ROOT" "$table" || { echo "runs-watch: could not read the held list" >&2; exit 1; }
  table=$("$HERE/runs-status.sh" "$ROOT") || { echo "runs-watch: runs-status.sh failed on $ROOT" >&2; exit 1; }
  if [ -n "$NEEDS" ]; then
    printf '%s\n' "$table"
    printf '%s\n' "$NEEDS"
    exit 0
  fi
  if [ -n "${TIMEOUT:-}" ] && [ "$left" -le 0 ]; then
    printf '%s\n' "$table"
    exit 3
  fi
  if [ -n "${TIMEOUT:-}" ]; then
    nap=$(( left < POLL ? left : POLL ))
  else
    nap=$POLL
  fi
  sleep "$nap"
  if [ -n "${TIMEOUT:-}" ]; then left=$(( left - nap )); fi
done
