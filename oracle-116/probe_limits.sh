#!/usr/bin/env bash
# Print this launch's own cgroup memory + process maxima, and a child's.
# Output lines: MEMMAX=<n|max> PIDSMAX=<n|max> CHILD_MEMMAX=... CHILD_PIDSMAX=...
set -uo pipefail
cg_of() { # pid -> cgroup path under /sys/fs/cgroup, or empty
  local rel; rel=$(sed -n 's|^0::/||p' "/proc/$1/cgroup" 2>/dev/null | head -1)
  [ -n "${rel:-}" ] && printf '/sys/fs/cgroup/%s' "$rel"
}
show() { # pid prefix
  local cg; cg=$(cg_of "$1")
  local mem="" pids=""
  [ -n "$cg" ] && [ -f "$cg/memory.max" ] && mem=$(cat "$cg/memory.max" 2>/dev/null)
  [ -n "$cg" ] && [ -f "$cg/pids.max" ] && pids=$(cat "$cg/pids.max" 2>/dev/null)
  printf '%sMEMMAX=%s\n%sPIDSMAX=%s\n' "$2" "${mem:-none}" "$2" "${pids:-none}"
}
show "$$" ""
bash -c 'cg_of() { sed -n "s|^0::/||p" "/proc/$1/cgroup" 2>/dev/null | head -1; }; cg="/sys/fs/cgroup/$(cg_of $$)"; mem=none; pids=none; [ -f "$cg/memory.max" ] && mem=$(cat "$cg/memory.max"); [ -f "$cg/pids.max" ] && pids=$(cat "$cg/pids.max"); echo "CHILD_MEMMAX=$mem"; echo "CHILD_PIDSMAX=$pids"'
