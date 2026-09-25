#!/usr/bin/env bash
# Append one structured action to a run's audit log and to the project's ledger.
#
#   log-action.sh <dispatch-dir> <actor> <action> <target> [detail...]
#
#   actor    postmaster | coachman | lane:<name>
#   action   a verb from a fixed set, enforced, so the log is computable:
#            dispatch resume harvest synthesize review-launch review-harvest finding apply
#            escalate rule ticket-create ticket-state ticket-comment gate merge teardown
#            degrade handoff-accept handoff stage note
#   target   what the action was done to: a lane, a ticket id, a branch, a path, a round
#   detail   free text; everything after the target, joined by spaces
#
# Writes one JSON line to <dispatch>/actions.jsonl and the same line, with the run named, to
# <dispatch>/../ledger.jsonl (the project's ledger across runs). Both are append-only. Nothing
# in the flow reads its own narrative back to learn from it; it reads these lines.
#
#   exit 0  written to both files
#   exit 1  usage, an action outside the set, or a file could not be appended
set -uo pipefail
DISPATCH=${1:?usage: log-action.sh <dispatch-dir> <actor> <action> <target> [detail...]}
ACTOR=${2:?}
ACTION=${3:?}
TARGET=${4:?}
shift 4
DETAIL=${*:-}
VERBS=" dispatch resume harvest synthesize review-launch review-harvest finding apply escalate rule ticket-create ticket-state ticket-comment gate merge teardown degrade handoff-accept handoff stage note "
case "$VERBS" in *" $ACTION "*) ;; *) echo "log-action: '$ACTION' is not an action in the set:$VERBS" >&2; exit 1 ;; esac

DISPATCH=$(cd "$DISPATCH" 2>/dev/null && pwd -P) || { echo "log-action: no such dir: $1" >&2; exit 1; }
RUN=$(basename "$DISPATCH")
PROJECT=$(basename "$(dirname "$DISPATCH")")
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

json_str() {  # JSON string escaping in bash alone: backslash, quote, newline, CR, tab
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/\\r}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

line=$(printf '{"ts":"%s","project":"%s","run":"%s","actor":"%s","action":"%s","target":"%s","detail":"%s"}' \
  "$TS" "$(json_str "$PROJECT")" "$(json_str "$RUN")" "$(json_str "$ACTOR")" \
  "$(json_str "$ACTION")" "$(json_str "$TARGET")" "$(json_str "$DETAIL")")

printf '%s\n' "$line" >> "$DISPATCH/actions.jsonl" || { echo "log-action: cannot append to $DISPATCH/actions.jsonl" >&2; exit 1; }
printf '%s\n' "$line" >> "$DISPATCH/../ledger.jsonl" || { echo "log-action: cannot append to the project ledger" >&2; exit 1; }
exit 0
