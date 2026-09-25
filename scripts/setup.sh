#!/usr/bin/env bash
# Set this machine up: probe the agent CLIs, ask which harness and model fills each role, how
# tickets are tracked, where projects live and who says the merge word, then write
# ~/.postmaster/config.toml in the shape of config.example.toml.
#
#   setup.sh [--answers <file>] [--dry-run] [--config <path>]
#   setup.sh --keys
#
# An agent drives it: the user's answers go in a file, one key=value per line (--keys
# lists them with their prompts and defaults), and --answers reads them by name, so the order
# of the questions never matters. A missing key takes its default and a key with no default
# is an error naming it. Without --answers the questions are asked on stdin one at a time, so
# a person can drive it too. --dry-run prints the config instead of writing it.
#
#   exit 0  config written (or printed), or keys listed
#   exit 1  a harness was named that is not on PATH, the coachman shares a lane's model, fewer
#           than two lanes were given, an answer was missing, or an existing config was not
#           overwritten
#
# Control: the written file is parsed back as TOML where a parser is available, so a config
# that would fail to load is never left on disk as if it were fine.
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
DRY=0; ANSWERS=""
CONFIG="$HOME/.postmaster/config.toml"
while [ $# -gt 0 ]; do
  case $1 in
    --dry-run) DRY=1 ;;
    --config) CONFIG=${2:?--config needs a path}; shift ;;
    --answers) ANSWERS=${2:?--answers needs a file}; [ -f "$ANSWERS" ] || { echo "setup: no such answers file: $ANSWERS" >&2; exit 1; }; shift ;;
    --keys) cat <<'EOF'
key (? = may be left out)  default            asked as
projects_roots             ~/Code             where projects live, comma separated
lanes                      alpha, beta        lane names, comma separated; then per lane:
lane.<name>.harness                           harness (codex, grok, agy, claude, muse, pi)
lane.<name>.model                             model id
lane.<name>.effort?        (none)             effort, blank if the harness has no effort flag
lane.<name>.env_file?      (none)             env file for an alternate backend
workhorses                 <lanes>            workhorse lanes, comma separated
reviewers                  <workhorses>       reviewer lanes, comma separated
coachman.harness                              never a lane's model
coachman.model
coachman.effort?           (none)
fallback.harness                              never a lane's model
fallback.model
fallback.effort?           (none)
postmaster.harness
postmaster.model
postmaster.effort?         (none)
max_runs                   2                  concurrent runs per project
poll_seconds               120                postmaster poll interval
tracker                    github             github, plane or other
plane.url                  https://api.plane.so   plane only
plane.workspace                               plane only; the slug in the workspace's web URL
plane.env_file             ~/.postmaster/plane.env   plane only; holds PLANE_API_KEY=<key>
tracker.name                                  other only
postmaster_may_create      no                 yes lets the postmaster create tickets unasked
merge_authority            user               user or postmaster
checkpoint_mode            autonomous         autonomous or consult
review_link?               (none)             template with {path}
overwrite                  no                 yes replaces an existing config
EOF
      exit 0 ;;
    *) echo "usage: setup.sh [--answers <file>] [--dry-run] [--config <path>] | --keys" >&2; exit 1 ;;
  esac
  shift
done

ask() {  # ask VAR "prompt" "default" [key]; empty answer takes the default. A key ending in ?
         # may be left out of the answers file; any other key with no default is required.
  local var=$1 prompt=$2 default=${3:-} key=${4:-$1} answer optional=0
  case $key in *\?) optional=1; key=${key%\?} ;; esac
  if [ -n "$ANSWERS" ]; then
    answer=$(awk -v k="$key=" 'index($0, k) == 1 { print substr($0, length(k) + 1); exit }' "$ANSWERS")
    if [ -z "$answer" ]; then
      if [ -z "$default" ] && [ "$optional" -eq 0 ] && ! grep -q "^$key=" "$ANSWERS"; then
        echo "setup: no answer for $key in $ANSWERS ($prompt)" >&2; exit 1
      fi
      answer=$default
    fi
    printf '%s: %s\n' "$prompt" "$answer"
  else
    if [ -n "$default" ]; then printf '%s [%s]: ' "$prompt" "$default"; else printf '%s: ' "$prompt"; fi
    IFS= read -r answer || answer=""
    [ -t 0 ] || echo   # piped answers echo nothing, so keep the transcript one question per line
    [ -z "$answer" ] && answer=$default
  fi
  printf -v "$var" '%s' "$answer"
}
installed() { command -v "$1" >/dev/null 2>&1; }
need_harness() {
  installed "$1" || { echo "setup: harness '$1' is not on PATH; install it or choose another" >&2; exit 1; }
}
toml_list() {  # "a, b" -> ["a", "b"]
  local out="" item
  for item in $(printf '%s' "$1" | tr ',' ' '); do out="$out${out:+, }\"$item\""; done
  printf '[%s]' "$out"
}

echo "== Installed agent CLIs =="
"$HERE/probe-harnesses.sh"
echo

ask ROOTS "Where do projects live (comma separated)" "~/Code" "projects_roots"

echo
echo "== The horses: lanes that implement a ticket. At least two, from different vendors. =="
ask LANES "Lane names, comma separated" "alpha, beta" "lanes"
LANE_LIST=$(printf '%s' "$LANES" | tr ',' ' ')
set -- $LANE_LIST
[ $# -ge 2 ] || { echo "setup: at least two lanes are needed" >&2; exit 1; }
LANE_BLOCKS=""; LANE_MODELS=""
for lane in $LANE_LIST; do
  ask h "  $lane: harness (codex, grok, agy, claude, muse, pi)" "" "lane.$lane.harness"
  need_harness "$h"
  ask m "  $lane: model id" "" "lane.$lane.model"
  ask e "  $lane: effort (blank if the harness has no effort flag)" "" "lane.$lane.effort?"
  ask ef "  $lane: env file for an alternate backend (blank if none)" "" "lane.$lane.env_file?"
  block="[lanes.$lane]"$'\n'"harness = \"$h\""$'\n'"model = \"$m\""
  [ -n "$e" ] && block="$block"$'\n'"effort = \"$e\""
  [ -n "$ef" ] && block="$block"$'\n'"env_file = \"$ef\""
  LANE_BLOCKS="$LANE_BLOCKS"$'\n'"$block"$'\n'
  LANE_MODELS="$LANE_MODELS $m"
done

echo
ask WORKHORSES "Workhorse lanes, comma separated" "$LANES" "workhorses"
for a in $(printf '%s' "$WORKHORSES" | tr ',' ' '); do
  ok=0; for lane in $LANE_LIST; do [ "$lane" = "$a" ] && ok=1; done
  [ "$ok" -eq 1 ] || { echo "setup: workhorse '$a' is not one of the lanes ($LANES)" >&2; exit 1; }
done
set -- $(printf '%s' "$WORKHORSES" | tr ',' ' '); [ $# -ge 2 ] || { echo "setup: at least two workhorses are needed" >&2; exit 1; }
ask REVIEWERS "Reviewer lanes, comma separated" "$WORKHORSES" "reviewers"
for rv in $(printf '%s' "$REVIEWERS" | tr ',' ' '); do
  ok=0; for lane in $LANE_LIST; do [ "$lane" = "$rv" ] && ok=1; done
  [ "$ok" -eq 1 ] || { echo "setup: reviewer '$rv' is not one of the lanes ($LANES)" >&2; exit 1; }
done

echo
echo "== The coachman: judges the lanes and runs the review rounds. Never a lane's model. =="
ask CH "  coachman: harness" "" "coachman.harness"
need_harness "$CH"
ask CM "  coachman: model id" "" "coachman.model"
for m in $LANE_MODELS; do
  [ "$m" = "$CM" ] && { echo "setup: the coachman cannot run on a lane's model ($CM)" >&2; exit 1; }
done
ask CE "  coachman: effort (blank if none)" "" "coachman.effort?"
echo
echo "== The coachman's fallback: takes over a leg when the coachman hits a wall. Not a lane either. =="
ask FH "  fallback: harness" "" "fallback.harness"
need_harness "$FH"
ask FM "  fallback: model id" "" "fallback.model"
for m in $LANE_MODELS; do
  [ "$m" = "$FM" ] && { echo "setup: the fallback coachman cannot run on a lane's model ($FM)" >&2; exit 1; }
done
ask FE "  fallback: effort (blank if none)" "" "fallback.effort?"

echo
echo "== The postmaster: decomposes the stream, dispatches coachmen, supervises. =="
ask PH "  postmaster: harness" "" "postmaster.harness"
need_harness "$PH"
ask PM "  postmaster: model id" "" "postmaster.model"
ask PE "  postmaster: effort (blank if none)" "" "postmaster.effort?"
ask MR "  concurrent runs per project" "2" "max_runs"
ask PS "  postmaster poll interval, seconds" "120" "poll_seconds"

echo
echo "== Tickets: GitHub Issues on a Projects board by default; Plane; or another tracker. =="
ask TK "How are tickets tracked (github, plane, other)" "github" "tracker"
PURL=""; PWS=""; PENV=""; OTHER=""
case $TK in
  github) ;;
  plane)
    ask PURL "  Plane API origin (https://api.plane.so for cloud; a self-hosted instance is its own)" "https://api.plane.so" "plane.url"
    ask PWS "  workspace slug (the segment after the host in the workspace's web URL)" "" "plane.workspace"
    [ -n "$PWS" ] || { echo "setup: a Plane workspace slug is needed" >&2; exit 1; }
    ask PENV "  file holding PLANE_API_KEY=<key>, written by you, never pasted here" "~/.postmaster/plane.env" "plane.env_file" ;;
  other) ask OTHER "  tracker name (then describe it in ~/.postmaster/trackers/<name>.md)" "" "tracker.name" ;;
  *) echo "setup: tracker kind must be github, plane or other" >&2; exit 1 ;;
esac

echo
ask PMC "May the postmaster create tickets without asking (yes/no)" "no" "postmaster_may_create"
case $PMC in yes|no) ;; *) echo "setup: answer yes or no" >&2; exit 1 ;; esac
ask MA "Who says the merge word (user, postmaster)" "user" "merge_authority"
case $MA in user|postmaster) ;; *) echo "setup: merge authority must be user or postmaster" >&2; exit 1 ;; esac
ask CPM "Checkpoint mode (autonomous, consult)" "autonomous" "checkpoint_mode"
case $CPM in autonomous|consult) ;; *) echo "setup: checkpoint mode must be autonomous or consult" >&2; exit 1 ;; esac
ask RL "Review link template with {path} for the synthesis worktree (blank for none)" "" "review_link?"

TRACKER_EXTRA=""
[ -n "$PWS" ] && TRACKER_EXTRA="url = \"$PURL\""$'\n'"workspace = \"$PWS\""$'\n'"env_file = \"$PENV\""
[ -n "$OTHER" ] && TRACKER_EXTRA="name = \"$OTHER\""

OUT=$(cat <<EOF
# Written by scripts/setup.sh on $(date -u +%Y-%m-%d). Shape: config.example.toml.
projects_roots = $(toml_list "$ROOTS")
${LANE_BLOCKS}

[team]
workhorses = $(toml_list "$WORKHORSES")
reviewers = $(toml_list "$REVIEWERS")
coachman = { harness = "$CH", model = "$CM"$( [ -n "$CE" ] && printf ', effort = "%s"' "$CE" ) }
coachman_fallback = { harness = "$FH", model = "$FM"$( [ -n "$FE" ] && printf ', effort = "%s"' "$FE" ) }
postmaster = { harness = "$PH", model = "$PM"$( [ -n "$PE" ] && printf ', effort = "%s"' "$PE" ) }
max_runs = $MR

[postmaster]
poll_seconds = $PS

[tracker]
kind = "$TK"
${TRACKER_EXTRA}
postmaster_may_create = $( [ "$PMC" = yes ] && echo true || echo false )

[ship]
merge_authority = "$MA"
checkpoint_mode = "$CPM"
review_link = "$RL"
EOF
)

if [ "$DRY" -eq 1 ]; then printf '%s\n' "$OUT"; exit 0; fi
if [ -e "$CONFIG" ]; then
  ask OW "$CONFIG exists; overwrite (yes/no)" "no" "overwrite"
  [ "$OW" = "yes" ] || { echo "setup: left $CONFIG as it was" >&2; exit 1; }
fi
mkdir -p "$(dirname "$CONFIG")"
printf '%s\n' "$OUT" > "$CONFIG"
if python3 -c 'import tomllib' 2>/dev/null; then
  python3 -c 'import sys,tomllib; tomllib.load(open(sys.argv[1],"rb"))' "$CONFIG" \
    || { echo "setup: $CONFIG does not parse as TOML; fix it before running anything" >&2; exit 1; }
  echo "wrote $CONFIG (parsed back as TOML)"
else
  echo "wrote $CONFIG (no TOML parser found to check it; python3 3.11+ would)"
fi
exit 0
