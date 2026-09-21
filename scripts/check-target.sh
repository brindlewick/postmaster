#!/usr/bin/env bash
# Verify a chosen target before dispatching anything at it.
#   exit 0  usable
#   exit 1  not a git repository: refuse
#   exit 2  git repository, but the tree is dirty: ask, do not proceed silently
set -uo pipefail
T=${1:?usage: check-target.sh <path>}

if ! root=$(git -C "$T" rev-parse --show-toplevel 2>/dev/null); then
  echo "not a git repository: $T" >&2
  exit 1
fi
echo "root   $root"
echo "head   $(git -C "$T" rev-parse --short HEAD 2>/dev/null || echo '(no commits)')"
echo "branch $(git -C "$T" rev-parse --abbrev-ref HEAD 2>/dev/null)"
git -C "$T" fetch --quiet 2>/dev/null || true

dirty=$(git -C "$T" status --porcelain | wc -l | tr -d ' ')
if [ "$dirty" -ne 0 ]; then
  echo "dirty  $dirty uncommitted path(s):"
  git -C "$T" status --porcelain | head -20 | sed 's/^/       /'
  echo
  echo "A coachman branches from committed HEAD, so this work would be silently excluded."
  echo "Ask before proceeding. Offer: commit it / stash it (shared stack, say where) /"
  echo "commit to a base branch and dispatch from there / hand back. Never discard."
  exit 2
fi
echo "dirty  0"
exit 0
