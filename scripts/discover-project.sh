#!/usr/bin/env bash
# Work out what a target project needs, rather than demanding it be configured.
# Prints key=value lines. Empty value means "could not determine, ask the user".
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
CONFIG=${POSTMASTER_CONFIG:-$HOME/.postmaster/config.toml}
T=${1:?usage: discover-project.sh <path>}
cd "$T" 2>/dev/null || { echo "cannot enter $T" >&2; exit 1; }

gate=""
[ -f package.json ] && ! command -v jq >/dev/null 2>&1 && echo "warn=jq not installed: package.json scripts were not read" >&2
if [ -f package.json ] && command -v jq >/dev/null 2>&1; then
  for s in check ci verify test lint; do
    jq -e --arg s "$s" '.scripts[$s]' package.json >/dev/null 2>&1 && { gate="$s"; break; }
  done
  [ -n "$gate" ] && gate="$( [ -f pnpm-lock.yaml ] && echo pnpm || echo npm ) run $gate"
fi
[ -z "$gate" ] && [ -f Makefile ] && grep -qE '^(check|test):' Makefile && gate="make check"
[ -z "$gate" ] && [ -f Cargo.toml ] && gate="cargo test"

docs=$(ls AGENTS.md CLAUDE.md README.md CONTRIBUTING.md 2>/dev/null | tr '\n' ' ')
dirs=$(ls -d wiki docs .github 2>/dev/null | tr '\n' ' ')

# The tracker kind: a repo whose local ticket store exists uses it, whatever the config names;
# any other repo uses the config's kind (skills/postmaster/trackers.md, local).
if "$HERE/local.sh" . store >/dev/null 2>&1; then kind=local
else kind=$(python3 -c 'import sys, tomllib; print(tomllib.load(open(sys.argv[1], "rb")).get("tracker", {}).get("kind", "github"))' "$CONFIG" 2>/dev/null) || kind=""
fi

# The tracker is visible in how the project already writes commits; nothing to configure.
tracker=$(git log --oneline -200 2>/dev/null \
          | grep -oE '\b[A-Z][A-Z0-9]{1,9}-[0-9]+\b' | sed 's/-[0-9]*$//' \
          | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')

echo "gate=$gate"
echo "docs=$(echo "$docs$dirs" | sed 's/ *$//')"
echo "tracker=$kind"
echo "tracker_prefix=$tracker"
echo "ambient_context=$( [ -f AGENTS.md ] && echo AGENTS.md || echo NONE )"
[ -f AGENTS.md ] || echo "warn=no AGENTS.md: lanes that read no ambient file will start blind" >&2
