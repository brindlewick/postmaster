#!/usr/bin/env bash
# Append one structured action to a run's audit log and to the project's ledger.
#
#   log-action.sh <dispatch-dir> <actor> <action> <target> [detail...]
#   log-action.sh <dispatch-dir> <actor> tool-fault <postmaster-file> --ran <what ran>
#                 --failed <what failed> --error <the error, or none> --diagnosis <why>
#                 --fix <the fix proposed> [--workaround <what was done instead>] [--control <kind>]
#   log-action.sh --self-test
#
#   actor    postmaster | coachman | lane:<name>
#   action   a verb from a fixed set, enforced, so the log is computable:
#            dispatch resume harvest synthesize review-launch review-harvest finding apply
#            escalate rule ticket-check ticket-create ticket-edit ticket-state ticket-comment
#            gate merge teardown degrade handoff-accept handoff stage tool-fault note
#   target   what the action was done to: a lane, a ticket id, a branch, a path, a round
#   detail   free text; everything after the target, joined by spaces
#
# A tool-fault is postmaster itself misbehaving: a script, a runbook step or a harness adapter.
# Its target is the postmaster file, relative to the checkout this script is in, and its fields
# are flags, all required but --workaround and --control. The line carries them as a `fault`
# object, with --failed as its detail. A script skills/postmaster/controls.md lists is a control
# of the kind the list gives, whatever --control says; --control gives the kind of a runbook
# step the list names. A fault in a control is recorded as one, and the message says to stop.
#
# Writes one JSON line to <dispatch>/actions.jsonl and the same line, with the run named, to
# <dispatch>/../ledger.jsonl (the project's ledger across runs). Both are append-only. Nothing
# in the flow reads its own narrative back to learn from it; it reads these lines.
#
#   exit 0  written to both files
#   exit 1  usage, an action outside the set, a tool-fault missing a field or naming no
#           postmaster file, or a file could not be appended
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
TOOL=$(dirname "$HERE")
CONTROLS=$TOOL/skills/postmaster/controls.md
VERBS=" dispatch resume harvest synthesize review-launch review-harvest finding apply escalate rule ticket-check ticket-create ticket-edit ticket-state ticket-comment gate merge teardown degrade handoff-accept handoff stage tool-fault note "

json_str() {  # JSON string escaping in bash alone: backslash, quote, newline, CR, tab
  local s=$1
  [[ $s == *[[:cntrl:]]* ]] && s=$(printf '%s' "$s" | LC_ALL=C tr -d '\001-\010\013\014\016-\037')
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/\\r}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

tool_fault() {  # tool_fault <file> [flags...]; sets TARGET, DETAIL and FAULT, or says why not
  local given=$1 t=$1 ran="" failed="" error="" diagnosis="" fix="" workaround="" control="" kinds f
  shift
  while [ $# -gt 0 ]; do
    [ $# -ge 2 ] || { echo "log-action: $1 needs a value" >&2; return 1; }
    case $1 in
      --ran) ran=$2 ;; --failed) failed=$2 ;; --error) error=$2 ;; --diagnosis) diagnosis=$2 ;;
      --fix) fix=$2 ;; --workaround) workaround=$2 ;; --control) control=$2 ;;
      *) echo "log-action: a tool-fault takes --ran --failed --error --diagnosis --fix [--workaround] [--control], not '$1'" >&2; return 1 ;;
    esac
    shift 2
  done
  for f in ran failed error diagnosis fix; do
    [ -n "${!f//[[:space:]]/}" ] || { echo "log-action: a tool-fault needs --$f (the error may be 'none')" >&2; return 1; }
  done
  case $t in "$TOOL"/*) t=${t#"$TOOL"/} ;; ./*) t=${t#./} ;; esac
  case /$t/ in //*|*/../*) t="" ;; esac
  [ -n "$t" ] && [ -f "$TOOL/$t" ] \
    || { echo "log-action: a tool-fault names the postmaster file that misbehaved, relative to $TOOL; '$given' is not one" >&2; return 1; }
  kinds=" $(grep -E '^\| `' "$CONTROLS" 2>/dev/null | cut -d'|' -f3 | tr -d ' ' | sort -u | tr '\n' ' ')"
  [ -z "$control" ] || [[ $kinds == *" $control "* ]] \
    || { echo "log-action: '$control' is not a kind of control in $CONTROLS:$kinds" >&2; return 1; }
  f=$(grep -F "| \`$t\` |" "$CONTROLS" 2>/dev/null | head -1 | cut -d'|' -f3 | tr -d ' ')
  [ -n "$f" ] && control=$f
  [ -n "$control" ] && echo "log-action: $t is a control ($control): stop the leg and escalate; never work around it" >&2
  TARGET=$t DETAIL=$failed
  FAULT=$(printf ',"fault":{"ran":"%s","failed":"%s","error":"%s","diagnosis":"%s","fix":"%s","workaround":"%s","control":"%s"}' \
    "$(json_str "$ran")" "$(json_str "$failed")" "$(json_str "$error")" "$(json_str "$diagnosis")" \
    "$(json_str "$fix")" "$(json_str "$workaround")" "$(json_str "$control")")
}

log_action() {  # log_action <dispatch> <actor> <action> <target> [detail...]
  local given=$1 dispatch run project ts line
  ACTOR=$2 ACTION=$3 TARGET=$4 FAULT=""
  shift 4
  DETAIL=${*:-}
  case "$VERBS" in *" $ACTION "*) ;; *) echo "log-action: '$ACTION' is not an action in the set:$VERBS" >&2; return 1 ;; esac
  if [ "$ACTION" = tool-fault ]; then tool_fault "$TARGET" "$@" || return 1; fi

  dispatch=$(cd "$given" 2>/dev/null && pwd -P) || { echo "log-action: no such dir: $given" >&2; return 1; }
  run=$(basename "$dispatch")
  project=$(basename "$(dirname "$dispatch")")
  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  line=$(printf '{"ts":"%s","project":"%s","run":"%s","actor":"%s","action":"%s","target":"%s","detail":"%s"%s}' \
    "$ts" "$(json_str "$project")" "$(json_str "$run")" "$(json_str "$ACTOR")" \
    "$(json_str "$ACTION")" "$(json_str "$TARGET")" "$(json_str "$DETAIL")" "$FAULT")

  printf '%s\n' "$line" >> "$dispatch/actions.jsonl" || { echo "log-action: cannot append to $dispatch/actions.jsonl" >&2; return 1; }
  printf '%s\n' "$line" >> "$dispatch/../ledger.jsonl" || { echo "log-action: cannot append to the project ledger" >&2; return 1; }
}

if [ "${1:-}" != --self-test ]; then
  [ $# -ge 4 ] && [ -n "$1" ] && [ -n "$2" ] && [ -n "$3" ] && [ -n "$4" ] \
    || { echo "usage: log-action.sh <dispatch-dir> <actor> <action> <target> [detail...] | --self-test" >&2; exit 1; }
  log_action "$@"; exit $?
fi

# --- self-test ----------------------------------------------------------------------------
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
d="$tmp/project/RUN-1"; mkdir -p "$d"
SELF="$HERE/log-action.sh"
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/         /'; fails=$((fails+1)); }
lines() { if [ -f "$d/actions.jsonl" ]; then wc -l < "$d/actions.jsonl" | tr -d ' '; else echo 0; fi; }
last() {  # last <label> <python test of the last line, read as e>
  python3 -c 'import json, sys; e = json.loads(open(sys.argv[1]).read().splitlines()[-1]); sys.exit(0 if eval(sys.argv[2]) else 1)' \
    "$d/actions.jsonl" "$2" 2>/dev/null && ok "$1" || fail "$1" "$(tail -1 "$d/actions.jsonl")"
}
FIELDS=(--ran "scripts/wait-for-markers.sh <dispatch>/logs 'r1-*.done' 2 60" --failed "returned before every marker was in"
        --error $'exit 0\n\tall 2 markers present, \e[1mone a directory\e[0m' --diagnosis "find counts directories" --fix "count regular files only")

echo "positive controls"
"$SELF" "$d" postmaster note RUN-1 a plain "\"detail\"" >/dev/null 2>&1; rc=$?
[ $rc -eq 0 ] && [ "$(lines)" -eq 1 ] && cmp -s "$d/actions.jsonl" "$tmp/project/ledger.jsonl" \
  && ok "an action is one line in the run's log and the same line in the ledger" || fail "an action is one line in the run's log and the same line in the ledger (exit $rc)"
last "the detail is everything after the target" 'e["detail"] == "a plain \"detail\"" and (e["project"], e["run"]) == ("project", "RUN-1") and "fault" not in e'
"$SELF" "$d" coachman tool-fault scripts/launch.sh "${FIELDS[@]}" --workaround "launched in the recorded form by hand" >/dev/null 2>"$tmp/err"; rc=$?
[ $rc -eq 0 ] && [ "$(lines)" -eq 2 ] && [ ! -s "$tmp/err" ] && ok "a tool-fault with every field is written, and a part that is no control says nothing" \
  || fail "a tool-fault with every field is written, and a part that is no control says nothing (exit $rc)" "$(cat "$tmp/err")"
last "its fields are a fault object, with --failed as the detail and the error whole" \
  'e["action"] == "tool-fault" and e["target"] == "scripts/launch.sh" and e["detail"] == e["fault"]["failed"] == "returned before every marker was in" and e["fault"]["error"] == "exit 0\n\tall 2 markers present, [1mone a directory[0m" and e["fault"]["workaround"].startswith("launched") and e["fault"]["control"] == ""'
"$SELF" "$d" coachman tool-fault "$TOOL/scripts/log-action.sh" "${FIELDS[@]}" >/dev/null 2>"$tmp/err"
last "a script controls.md lists is a control of its kind, named relative to the checkout" 'e["target"] == "scripts/log-action.sh" and e["fault"]["control"] == "action-log"'
grep -qF "scripts/log-action.sh is a control (action-log): stop the leg" "$tmp/err" && ok "and the message says to stop" || fail "and the message says to stop" "$(cat "$tmp/err")"
"$SELF" "$d" coachman tool-fault scripts/log-action.sh "${FIELDS[@]}" --control gate >/dev/null 2>&1
last "the list's kind wins over --control" 'e["fault"]["control"] == "action-log"'
"$SELF" "$d" coachman tool-fault skills/postmaster/coachman.md "${FIELDS[@]}" --control wait >/dev/null 2>&1
last "--control gives the kind of a runbook step" 'e["target"] == "skills/postmaster/coachman.md" and e["fault"]["control"] == "wait"'
python3 -c 'import json, sys; [json.loads(l) for f in sys.argv[1:] for l in open(f)]' "$d/actions.jsonl" "$tmp/project/ledger.jsonl" 2>/dev/null \
  && cmp -s "$d/actions.jsonl" "$tmp/project/ledger.jsonl" && ok "every line in both files is JSON, control characters and all" \
  || fail "every line in both files is JSON, control characters and all"

echo "negative controls: nothing is written"
refused() {  # refused <label> <the text the message holds> <arguments after the actor...>
  local label=$1 why=$2 before; shift 2
  before=$(lines)
  "$SELF" "$d" coachman "$@" >/dev/null 2>"$tmp/err"; rc=$?
  if [ $rc -eq 1 ] && [ "$(lines)" -eq "$before" ] && grep -qF -- "$why" "$tmp/err"; then ok "$label"
  else fail "$label: wanted exit 1 with \"$why\" and no line, got exit $rc" "$(cat "$tmp/err")"; fi
}
refused "an action outside the set" "is not an action" tool-faults scripts/launch.sh x
refused "an empty target" "usage:" note ""
refused "a tool-fault with no fix" "needs --fix" tool-fault scripts/launch.sh "${FIELDS[@]:0:8}"
refused "a tool-fault with a blank diagnosis" "needs --diagnosis" tool-fault scripts/launch.sh "${FIELDS[@]}" --diagnosis "  "
refused "a tool-fault as plain words" "a tool-fault takes" tool-fault scripts/launch.sh the wait returned early
refused "a flag with no value" "--workaround needs a value" tool-fault scripts/launch.sh "${FIELDS[@]}" --workaround
refused "a file outside postmaster" "names the postmaster file" tool-fault src/app.ts "${FIELDS[@]}"
refused "a path through .., though it ends at a file" "names the postmaster file" tool-fault scripts/../scripts/log-action.sh "${FIELDS[@]}"
refused "an unknown kind of control" "is not a kind of control" tool-fault skills/postmaster/coachman.md "${FIELDS[@]}" --control vibes
"$SELF" "$tmp/nowhere" coachman note x y >/dev/null 2>"$tmp/err"; rc=$?
[ $rc -eq 1 ] && grep -qF "no such dir: $tmp/nowhere" "$tmp/err" && ok "a missing dispatch directory is refused, and named" \
  || fail "a missing dispatch directory is refused, and named (exit $rc)" "$(cat "$tmp/err")"

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
