#!/usr/bin/env bash
# Set this machine up: probe the agent CLIs, ask which harness and model fills each role, how
# tickets are tracked, where projects live and who says the merge word, then write
# ~/.postmaster/config.toml in the shape of config.example.toml.
#
#   setup.sh [--dry-run] [--config <path>]
#
# Answers are read from stdin one line at a time with the default in brackets, so a person can
# drive it or a here-doc can. --dry-run prints the config instead of writing it.
#
#   exit 0  config written (or printed)
#   exit 1  a harness was named that is not on PATH, the coachman shares a lane's model, fewer
#           than two lanes were given, or an existing config was not overwritten
#
# Control: the written file is parsed back as TOML where a parser is available, so a config
# that would fail to load is never left on disk as if it were fine.
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
DRY=0
CONFIG="$HOME/.postmaster/config.toml"
while [ $# -gt 0 ]; do
  case $1 in
    --dry-run) DRY=1 ;;
    --config) CONFIG=${2:?--config needs a path}; shift ;;
    *) echo "usage: setup.sh [--dry-run] [--config <path>]" >&2; exit 1 ;;
  esac
  shift
done

ask() {  # ask VAR "prompt" "default"; empty answer takes the default
  local var=$1 prompt=$2 default=${3:-} answer
  if [ -n "$default" ]; then printf '%s [%s]: ' "$prompt" "$default"; else printf '%s: ' "$prompt"; fi
  IFS= read -r answer || answer=""
  [ -t 0 ] || echo   # piped answers echo nothing, so keep the transcript one question per line
  [ -z "$answer" ] && answer=$default
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

ask ROOTS "Where do projects live (comma separated)" "~/Code"

echo
echo "== The horses: lanes that implement a ticket. At least two, from different vendors. =="
ask LANES "Lane names, comma separated" "alpha, beta"
LANE_LIST=$(printf '%s' "$LANES" | tr ',' ' ')
set -- $LANE_LIST
[ $# -ge 2 ] || { echo "setup: at least two lanes are needed" >&2; exit 1; }
LANE_BLOCKS=""; LANE_MODELS=""
for lane in $LANE_LIST; do
  ask h "  $lane: harness (codex, grok, agy, claude, muse)" ""
  need_harness "$h"
  ask m "  $lane: model id" ""
  ask e "  $lane: effort (blank if the harness has no effort flag)" ""
  ask ef "  $lane: env file for an alternate backend (blank if none)" ""
  block="[lanes.$lane]"$'\n'"harness = \"$h\""$'\n'"model = \"$m\""
  [ -n "$e" ] && block="$block"$'\n'"effort = \"$e\""
  [ -n "$ef" ] && block="$block"$'\n'"env_file = \"$ef\""
  LANE_BLOCKS="$LANE_BLOCKS"$'\n'"$block"$'\n'
  LANE_MODELS="$LANE_MODELS $m"
done

echo
ask ARMS "Arm lanes, the horses, comma separated" "$LANES"
for a in $(printf '%s' "$ARMS" | tr ',' ' '); do
  ok=0; for lane in $LANE_LIST; do [ "$lane" = "$a" ] && ok=1; done
  [ "$ok" -eq 1 ] || { echo "setup: arm '$a' is not one of the lanes ($LANES)" >&2; exit 1; }
done
set -- $(printf '%s' "$ARMS" | tr ',' ' '); [ $# -ge 2 ] || { echo "setup: at least two arms are needed" >&2; exit 1; }
ask REVIEWERS "Reviewer lanes, comma separated" "$ARMS"
for rv in $(printf '%s' "$REVIEWERS" | tr ',' ' '); do
  ok=0; for lane in $LANE_LIST; do [ "$lane" = "$rv" ] && ok=1; done
  [ "$ok" -eq 1 ] || { echo "setup: reviewer '$rv' is not one of the lanes ($LANES)" >&2; exit 1; }
done

echo
echo "== The coachman: judges the lanes and runs the review rounds. Never a lane's model. =="
ask CH "  coachman: harness" ""
need_harness "$CH"
ask CM "  coachman: model id" ""
for m in $LANE_MODELS; do
  [ "$m" = "$CM" ] && { echo "setup: the coachman cannot run on a lane's model ($CM)" >&2; exit 1; }
done
ask CE "  coachman: effort (blank if none)" ""
echo
echo "== The coachman's fallback: takes over a leg when the coachman hits a wall. Not a lane either. =="
ask FH "  fallback: harness" ""
need_harness "$FH"
ask FM "  fallback: model id" ""
for m in $LANE_MODELS; do
  [ "$m" = "$FM" ] && { echo "setup: the fallback coachman cannot run on a lane's model ($FM)" >&2; exit 1; }
done
ask FE "  fallback: effort (blank if none)" ""

echo
echo "== The postmaster: takes tickets in, checks their packing, dispatches coachmen, supervises. =="
ask PH "  postmaster: harness" ""
need_harness "$PH"
ask PM "  postmaster: model id" ""
ask PE "  postmaster: effort (blank if none)" ""
ask MR "  concurrent runs per project" "2"
ask PS "  postmaster poll interval, seconds" "120"

echo
echo "== Tickets =="
ask TK "How are tickets tracked (files, github, other)" "files"
PREFIX=""; OTHER=""
case $TK in
  files) ask PREFIX "  ticket id prefix" "PM" ;;
  github) ;;
  other) ask OTHER "  tracker name (then describe it in ~/.postmaster/trackers/<name>.md)" "" ;;
  *) echo "setup: tracker kind must be files, github or other" >&2; exit 1 ;;
esac

echo
ask PMC "May the postmaster create tickets without asking (yes/no)" "no"
case $PMC in yes|no) ;; *) echo "setup: answer yes or no" >&2; exit 1 ;; esac
ask MA "Who says the merge word (operator, postmaster)" "operator"
case $MA in operator|postmaster) ;; *) echo "setup: merge authority must be operator or postmaster" >&2; exit 1 ;; esac
ask CPM "Checkpoint mode (autonomous, consult)" "autonomous"
case $CPM in autonomous|consult) ;; *) echo "setup: checkpoint mode must be autonomous or consult" >&2; exit 1 ;; esac
ask RL "Review link template with {path} for the synthesis worktree (blank for none)" ""

TRACKER_EXTRA=""
[ -n "$PREFIX" ] && TRACKER_EXTRA="prefix = \"$PREFIX\""
[ -n "$OTHER" ] && TRACKER_EXTRA="name = \"$OTHER\""

OUT=$(cat <<EOF
# Written by scripts/setup.sh on $(date -u +%Y-%m-%d). Shape: config.example.toml.
projects_roots = $(toml_list "$ROOTS")
${LANE_BLOCKS}

[team]
arms = $(toml_list "$ARMS")
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
  ask OW "$CONFIG exists; overwrite (yes/no)" "no"
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
