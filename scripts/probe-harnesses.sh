#!/usr/bin/env bash
# Which agent CLIs are installed and answering on this machine.
# Presence on PATH is not enough: a walled account or a missing key looks identical to a
# working harness until a run has already been dispatched at it.
set -uo pipefail
LIVE=${LIVE:-0}          # LIVE=1 spends a token or two per harness to prove it answers
row() { printf '  %-8s %-9s %-13s %s\n' "$1" "$2" "$3" "$4"; }
row HARNESS INSTALLED HEADLESS NOTES
row ------- --------- -------- -----
for h in claude codex grok agy muse pi; do
  if ! command -v "$h" >/dev/null 2>&1; then row "$h" no - "not on PATH"; continue; fi
  case $h in
    claude) hl="-p" ;; codex) hl="exec" ;; grok) hl="-p" ;; agy) hl="-p" ;; muse) hl="exec" ;; pi) hl="--mode json" ;;
  esac
  note=""
  [ "$h" = muse ] && note="--prompt-file, --api-key-stdin"
  [ "$h" = grok ] && note="--prompt-file"
  [ "$h" = agy  ] && note="reads NO ambient context file"
  [ "$h" = muse ] && note="$note; reads no ambient file"
  [ "$h" = pi ] && note="reads AGENTS.md or CLAUDE.md (AGENTS.md first); prompt on stdin"
  row "$h" yes "$hl" "$note"
done
echo
echo "  A harness that reads no ambient context must be handed AGENTS.md explicitly in its"
echo "  prompt, or it starts blind while its siblings do not. That has silently handicapped"
echo "  a lane before, and the run looked normal throughout."
