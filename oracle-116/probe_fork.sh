#!/usr/bin/env bash
# Fork without end, self-bounded: spawn up to $1 live sleepers, stopping when a
# spawn is refused (the cap tripping). Prints SPAWNED=<live children>.
# Children carry a unique argv[0] so the oracle's cleanup matches nothing else.
set -uo pipefail
MAX=${1:-2500}
pids=""
i=0
while [ "$i" -lt "$MAX" ]; do
  bash -c 'exec -a oracle-116-sleeper sleep 60' 2>/dev/null &
  pid=$!
  if kill -0 "$pid" 2>/dev/null; then
    pids="$pids $pid"; i=$((i+1))
  else
    break # spawn refused: the cap tripped (or the child died at once)
  fi
done
sleep 2
n=0; for p in $pids; do kill -0 "$p" 2>/dev/null && n=$((n+1)); done
echo "SPAWNED=$n"
# Hold the storm briefly so the cap, not our exit, is what stops it; then exit
# and let the scope teardown plus the oracle's pkill reap the sleepers.
sleep 20
