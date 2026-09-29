#!/usr/bin/env bash
# Blind oracle for #106: Getting started tells a new user to say hi to their agent.
#
# Written by the leg-1 coachman from the ticket's acceptance criteria BEFORE
# reading any lane's diff or solution, and committed as the first commit on the
# ticket branch. Tests at the ticket's own interface: the words in README.md
# and AGENTS.md a new user and their agent read first. Never a sentence shape,
# which is what the lanes were dispatched to choose; only the phrases the
# ticket itself requires ("say hi", "says hi", "any first message starts the
# flow") and the BASE sentences that imply the agent starts on its own.
#
# Usage: ./oracle-106.sh   (runs from the repo root)
# Exit 0 when every acceptance criterion holds, 1 otherwise.
set -uo pipefail
ROOT=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
cd "$ROOT" || exit 1

pass=0; failed=0
ok()   { echo "  ok   $1"; }
bad()  { echo "  FAIL $1"; }
ac_pass() { echo "AC$1: pass - $2"; pass=$((pass+1)); }
ac_fail() { echo "AC$1: FAIL - $2"; failed=$((failed+1)); }

echo "oracle-106: blind acceptance tests for #106"
echo "root: $ROOT  branch: $(git symbolic-ref --short -q HEAD 2>/dev/null || echo detached)"
echo

# --- AC1: README Getting started says to open your agent in the clone and say hi ---
echo "AC1: README Getting started says open your agent in the clone and say hi"
ac1_bad=0
if [ ! -f README.md ]; then bad "README.md missing"; ac1_bad=1; else
  section=$(sed -n '/^## Getting started/,/^## /p' README.md | sed '$d')
  [ -n "$section" ] || section=$(cat README.md)
  if printf '%s' "$section" | grep -qi "say hi"; then ok "Getting started says 'say hi'"; else bad "Getting started has no 'say hi'"; ac1_bad=1; fi
  if printf '%s' "$section" | grep -qi "open.*agent" && printf '%s' "$section" | grep -qi "clone"; then ok "Getting started says to open your agent in the clone"; else bad "Getting started does not say to open your agent in the clone"; ac1_bad=1; fi
fi
[ $ac1_bad -eq 0 ] && ac_pass 1 "README Getting started says to open your agent in the clone and say hi" || ac_fail 1 "see FAIL lines above"
echo

# --- AC2: AGENTS.md session-opening says the user opens their agent, says hi, any first message starts the flow ---
echo "AC2: AGENTS.md session-opening says says hi, any first message starts the flow"
ac2_bad=0
if [ ! -f AGENTS.md ]; then bad "AGENTS.md missing"; ac2_bad=1; else
  if grep -qi "says hi" AGENTS.md; then ok "AGENTS.md says 'says hi'"; else bad "AGENTS.md has no 'says hi'"; ac2_bad=1; fi
  if grep -qi "first message" AGENTS.md && grep -qi "start" AGENTS.md; then ok "AGENTS.md says a first message starts the flow"; else bad "AGENTS.md does not say a first message starts the flow"; ac2_bad=1; fi
  if grep -qi "open.*agent" AGENTS.md; then ok "AGENTS.md mentions opening the agent"; else bad "AGENTS.md does not mention opening the agent"; ac2_bad=1; fi
fi
[ $ac2_bad -eq 0 ] && ac_pass 2 "AGENTS.md says says hi and any first message starts the flow" || ac_fail 2 "see FAIL lines above"
echo

# --- AC3: nothing left says or implies the agent starts on its own ---
echo "AC3: nothing left implies the agent starts on its own"
ac3_bad=0
if grep -q "open your agent in it" README.md 2>/dev/null; then bad "README still has BASE 'open your agent in it' (open with no hi)"; ac3_bad=1; else ok "README has no BASE 'open your agent in it'"; fi
if grep -qi "takes it from there" AGENTS.md 2>/dev/null; then
  # Acceptable only when hi is beside it (after hi, the file takes it from there).
  if grep -qi -B3 -A3 "takes it from there" AGENTS.md | grep -qi "hi"; then ok "'takes it from there' remains but hi is beside it"; else bad "AGENTS.md still has 'takes it from there' with no hi beside it"; ac3_bad=1; fi
else
  ok "AGENTS.md has no 'takes it from there'"
fi
[ $ac3_bad -eq 0 ] && ac_pass 3 "no BASE auto-start sentence remains" || ac_fail 3 "see FAIL lines above"
echo

echo "oracle-106: $pass passed, $failed failed"
[ "$failed" -eq 0 ]
