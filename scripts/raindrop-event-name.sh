#!/usr/bin/env bash
# Merge a Postmaster launch name into RAINDROP_EVENT_METADATA as eventName.
#
#   raindrop-event-name.sh <name>
#   raindrop-event-name.sh --self-test
#
# Prints one JSON object and no trailing newline. A valid existing object is
# preserved and the Postmaster name wins for eventName. An unset or empty value
# becomes {"eventName": <name>}. Invalid JSON and valid non-objects are refused:
# replacing either would silently discard caller metadata.
set -uo pipefail

if [ "${1:-}" = --self-test ]; then
  self=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)/$(basename -- "$0")
  fails=0
  ok()   { printf '  ok   %s\n' "$1"; }
  fail() { printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/         /'; fails=$((fails + 1)); }
  raw_of() { env ${2+"RAINDROP_EVENT_METADATA=$2"} "$self" "$1"; }
  keep='{"userId":"u","properties":{"k":1,"ok":true},"eventName":"old"}'

  got=$(raw_of alpha)
  [ "$got" = '{"eventName":"alpha"}' ] && ok "unset metadata becomes a named object" \
    || fail "unset metadata becomes a named object" "$got"
  bytes=$("$self" alpha | python3 -c 'import sys; sys.stdout.write(repr(sys.stdin.buffer.read()))')
  [ "$bytes" = 'b'"'"'{"eventName":"alpha"}'"'" ] && ok "stdout has no trailing newline" \
    || fail "stdout has no trailing newline" "$bytes"
  got=$(raw_of alpha "$keep")
  python3 -c 'import json,sys; d=json.loads(sys.argv[1]); sys.exit(0 if d=={"userId":"u","properties":{"k":1,"ok":True},"eventName":"alpha"} else 1)' "$got" \
    && ok "existing fields survive and the Postmaster name wins" \
    || fail "existing fields survive and the Postmaster name wins" "$got"
  name='#123, Pass "session" names \ to Workshop · alpha'
  got=$(raw_of "$name")
  python3 -c 'import json,sys; sys.exit(0 if json.loads(sys.argv[1]).get("eventName")==sys.argv[2] else 1)' "$got" "$name" \
    && ok "quotes, a backslash and a middle dot survive" \
    || fail "quotes, a backslash and a middle dot survive" "$got"

  err=$(mktemp)
  for bad in 'not-json' '["x"]' '{"x":NaN}' '   '; do
    out=$(env RAINDROP_EVENT_METADATA="$bad" "$self" alpha 2>"$err"); rc=$?
    [ $rc -eq 1 ] && [ -z "$out" ] \
      && ok "invalid or non-object metadata is refused: $bad" \
      || fail "invalid or non-object metadata is refused: $bad" "exit=$rc out=$out err=$(cat "$err")"
  done
  out=$(env -u RAINDROP_EVENT_METADATA "$self" '' 2>"$err"); rc=$?
  [ $rc -eq 1 ] && [ -z "$out" ] && ok "an empty name is refused" \
    || fail "an empty name is refused" "exit=$rc out=$out"
  rm -f "$err"

  echo
  [ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
  echo "self-test: $fails control(s) misbehaved"; exit 1
fi

[ $# -eq 1 ] && [ -n "$1" ] || { echo "usage: raindrop-event-name.sh <name> | --self-test" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "raindrop-event-name: python3 is needed to merge JSON" >&2; exit 1; }
python3 - "$1" <<'PY'
import json, os, sys

name = sys.argv[1]

def reject_constant(value):
    raise json.JSONDecodeError("invalid JSON constant: %s" % value, value, 0)

raw = os.environ.get("RAINDROP_EVENT_METADATA")
if raw is None or raw == "":
    obj = {}
else:
    try:
        obj = json.loads(raw, parse_constant=reject_constant)
    except (json.JSONDecodeError, ValueError) as error:
        print("raindrop-event-name: RAINDROP_EVENT_METADATA is not valid JSON: %s" % error, file=sys.stderr)
        raise SystemExit(1)
    if not isinstance(obj, dict):
        print("raindrop-event-name: RAINDROP_EVENT_METADATA must be a JSON object", file=sys.stderr)
        raise SystemExit(1)
obj["eventName"] = name
try:
    encoded = json.dumps(obj, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
except ValueError as error:
    print("raindrop-event-name: RAINDROP_EVENT_METADATA is not valid JSON: %s" % error, file=sys.stderr)
    raise SystemExit(1)
try:
    sys.stdout.write(encoded)
except UnicodeEncodeError:
    sys.stdout.write(json.dumps(obj, separators=(",", ":"), ensure_ascii=True, allow_nan=False))
PY
