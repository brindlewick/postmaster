#!/usr/bin/env bash
# Which ticket sources this machine can reach, detected without assuming any particular
# agent harness. The operator chooses; this reports what is genuinely available so the
# choice is informed rather than aspirational.
set -uo pipefail
row() { printf '  %-12s %-12s %s\n' "$1" "$2" "$3"; }
row TRACKER AVAILABLE "HOW IT IS REACHED"
row ------- --------- ------------------

if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then row github yes "gh CLI, authenticated"
  else row github partial "gh installed but not authenticated; run: gh auth login"; fi
else row github no "gh not installed"; fi

# Hosted and self-hosted trackers are reached through whatever tooling the operator's agent
# provides (an MCP server, a CLI). That is a property of their agent setup, not of this
# machine, and this script deliberately does not read any one harness's config to guess at it.
row other "ask" "any tracker reached through your agent's own tooling; needs the service reachable"

# File-based options need nothing installed, only a convention in the TARGET repo.
row files    file "markdown tickets in the target repo; no service, no auth"
echo
echo "  \"ask\" means: this script cannot tell, so the operator must say. An MCP being"
echo "  registered is not the same as the service being up, so a registration would be a"
echo "  misleading thing to report as availability."
echo
echo "  A file-based tracker is a first-class choice, not a fallback. Nothing to be down,"
echo "  no auth to expire, and the tickets travel with the code. What it lacks is a place"
echo "  for state that is not a commit."
