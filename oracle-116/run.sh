#!/usr/bin/env bash
# Oracle for #116: blind acceptance tests at the ticket's interface.
#
# Written by the leg-1 coachman BEFORE reading any lane's diff or log, committed as
# the first commit on the ticket branch. At harvest it is cherry-picked onto a
# scratch of each lane's branch and run there, so each lane is ranked on the
# ticket's criteria before its diff is read.
#
# What it exercises (ticket acceptance criteria):
#   AC1  a launch and its children run under finite memory + process caps
#   AC2  a launch that trips a cap stops on its own; others keep running;
#        its marker lands and its .err names the cap
#   AC3  caps have defaults and per-role config (heuristic: key names are the lanes' choice)
#   AC4  host.sh --self-test has fork, alloc and within-caps controls, and passes
#   AC5  with no capping mechanism the launch still runs and says uncapped
#
# Usage: oracle-116/run.sh   (from the worktree root; uses that tree's scripts/host.sh)
#
# Each probe prints:  oracle: <name> <PASS|FAIL|UNPROVEN> <detail>
# Exit 0 iff every probe passes; 1 if any fails; 2 if unproven-only.
#
# Safety: every workload is self-bounding. The fork probe caps its live children
# (absolute max 3000 tiny sleepers); the alloc probe sizes from the launch's own
# applied memory cap and never probes above an absolute bound; every wait has a
# timeout; leftover probe sleepers are killed by a unique argv[0] that matches
# nothing else on the machine.
set -uo pipefail

ROOT=$(CDPATH= cd -P -- "$(dirname "$0")/.." && pwd -P)
HOST=$ROOT/scripts/host.sh
ODIR=$ROOT/oracle-116
TMP=$(mktemp -d /tmp/oracle-116.XXXXXX) || exit 1
trap 'pkill -f oracle-116-sleeper 2>/dev/null; rm -rf "$TMP"' EXIT

export POSTMASTER_HOST=none POSTMASTER_HOST_STATE=$TMP/host-state

PASS=0; FAIL=0; UNPROVEN=0
report() { # name verdict detail
  printf 'oracle: %s %s %s\n' "$1" "$2" "$3"
  case $2 in PASS) PASS=$((PASS+1));; FAIL) FAIL=$((FAIL+1));; *) UNPROVEN=$((UNPROVEN+1));; esac
}

launch() { # name timeout cmd...  -> sets L_OUT L_ERR L_MARK, returns 0 if marker landed
  local name=$1 timeout=$2; shift 2
  L_OUT=$TMP/$name.out; L_ERR=$TMP/$name.err; L_MARK=$TMP/$name.done
  "$HOST" run "oracle-$name" "$ROOT" --out "$L_OUT" --err "$L_ERR" --marker "$L_MARK" -- "$@" >/dev/null 2>&1
  local waited=0
  while [ ! -e "$L_MARK" ] && [ "$waited" -lt "$timeout" ]; do sleep 2; waited=$((waited+2)); done
  [ -e "$L_MARK" ]
}

finite() { # value -> 0 if numeric and > 0 (not "max")
  case $1 in ''|*[!0-9]*) return 1;; *) [ "$1" -gt 0 ] ;; esac
}
# The oracle's own ambient maxima: a launch "under a cap" must bind tighter
# than what it would inherit by doing nothing (pids.max is finite system-wide).
AMB_CG=/sys/fs/cgroup/$(sed -n 's|^0::/||p' /proc/$$/cgroup | head -1)
AMB_MEM=$(cat "$AMB_CG/memory.max" 2>/dev/null); AMB_PIDS=$(cat "$AMB_CG/pids.max" 2>/dev/null)
tighter() { # launch-value ambient-value -> 0 if the launch binds tighter
  finite "$1" || return 1
  finite "$2" || return 0
  [ "$1" -lt "$2" ]
}

# --- AC1: the launch and its children run under finite caps -------------------
MEMMAX=""; PIDSMAX=""
if launch limits 60 bash "$ODIR/probe_limits.sh"; then
  MEMMAX=$(sed -n 's/^MEMMAX=//p' "$L_OUT" | head -1)
  PIDSMAX=$(sed -n 's/^PIDSMAX=//p' "$L_OUT" | head -1)
  CMEMMAX=$(sed -n 's/^CHILD_MEMMAX=//p' "$L_OUT" | head -1)
  CPIDSMAX=$(sed -n 's/^CHILD_PIDSMAX=//p' "$L_OUT" | head -1)
  if [ -z "$MEMMAX" ]; then
    if grep -qi 'uncapped' "$L_OUT" "$L_ERR" 2>/dev/null; then
      report limits UNPROVEN "no cgroup limits visible but launch says uncapped (non-cgroup mechanism?)"
    else
      report limits FAIL "probe printed no MEMMAX (out: $(head -c 200 "$L_OUT" | tr '\n' ';'))"
    fi
  elif tighter "$MEMMAX" "$AMB_MEM" && tighter "$PIDSMAX" "$AMB_PIDS" \
      && [ "$MEMMAX" = "$CMEMMAX" ] && [ "$PIDSMAX" = "$CPIDSMAX" ]; then
    report limits PASS "memory.max=$MEMMAX pids.max=$PIDSMAX (ambient $AMB_MEM/$AMB_PIDS), child identical"
  else
    report limits FAIL "memory.max=$MEMMAX pids.max=$PIDSMAX child=$CMEMMAX/$CPIDSMAX ambient=$AMB_MEM/$AMB_PIDS (want finite, tighter than ambient, parent==child)"
  fi
else
  report limits FAIL "marker never landed for limits probe"
fi

# --- AC2 (process cap): fork-without-end is stopped at its cap ----------------
# Size from the applied cap so the workload always exceeds it; absolute-bounded.
FORKN=2500
if tighter "${PIDSMAX:-}" "$AMB_PIDS"; then FORKN=$(( PIDSMAX + PIDSMAX / 2 )); fi
[ "$FORKN" -lt 100 ] && FORKN=100
[ "$FORKN" -gt 2500 ] && FORKN=2500
# Start the fork storm and a control launch together: the control must survive it.
F_OUT=$TMP/fork.out; F_ERR=$TMP/fork.err; F_MARK=$TMP/fork.done
"$HOST" run "oracle-fork" "$ROOT" --out "$F_OUT" --err "$F_ERR" --marker "$F_MARK" \
  -- bash "$ODIR/probe_fork.sh" "$FORKN" >/dev/null 2>&1
sleep 5
if launch isolated 120 echo isolation-ok; then
  ISO_OUT=$L_OUT; ISO_MARK=yes
else
  ISO_OUT=$L_OUT; ISO_MARK=no
fi
waited=0; while [ ! -e "$F_MARK" ] && [ "$waited" -lt 240 ]; do sleep 2; waited=$((waited+2)); done
if [ ! -e "$F_MARK" ]; then
  report fork FAIL "fork launch marker never landed (storm escaped its cap?)"
  pkill -f oracle-116-sleeper 2>/dev/null
else
  SPAWNED=$(sed -n 's/^SPAWNED=//p' "$F_OUT" | head -1)
  if [ -z "$SPAWNED" ]; then
    report fork FAIL "fork probe printed no SPAWNED count (out: $(head -c 200 "$F_OUT" | tr '\n' ';'))"
  elif [ "$SPAWNED" -ge "$FORKN" ]; then
    report fork FAIL "spawned $SPAWNED/$FORKN live children with no trip (no process cap bound it)"
  elif grep -qiE 'process|tasks' "$F_ERR"; then
    report fork PASS "tripped at $SPAWNED/$FORKN live children, marker landed, .err names process cap"
  else
    report fork FAIL "tripped at $SPAWNED/$FORKN but .err names no process cap (err: $(head -c 200 "$F_ERR" | tr '\n' ';'))"
  fi
fi
if [ "${ISO_MARK:-no}" = yes ] && grep -q 'isolation-ok' "$ISO_OUT" 2>/dev/null; then
  report isolation PASS "control launch completed during the fork storm"
else
  report isolation FAIL "control launch did not complete during the fork storm (marker: ${ISO_MARK:-no})"
fi
pkill -f oracle-116-sleeper 2>/dev/null

# --- AC2 (memory cap): alloc-without-end is stopped at its cap ----------------
# Sized from the launch's own applied cap; skipped (UNPROVEN) when uncapped so a
# broken lane is failed by `limits`, not by OOMing this machine.
if tighter "${MEMMAX:-}" "$AMB_MEM"; then
  ALLOCMB=$(( MEMMAX / 1024 / 1024 + MEMMAX / 1024 / 1024 / 2 ))
  [ "$ALLOCMB" -lt 200 ] && ALLOCMB=200
  [ "$ALLOCMB" -gt 6144 ] && ALLOCMB=6144
  if launch alloc 300 python3 "$ODIR/probe_alloc.py" "$ALLOCMB"; then
    HELD=$(sed -n 's/^HELD_MB=//p' "$L_OUT" | head -1)
    if [ -z "$HELD" ]; then
      report alloc FAIL "alloc probe printed no HELD_MB (out: $(head -c 200 "$L_OUT" | tr '\n' ';'))"
    elif [ "$HELD" -ge "$ALLOCMB" ]; then
      report alloc FAIL "held ${HELD}MB of ${ALLOCMB}MB with no trip (no memory cap bound it)"
    elif grep -qiE 'memory' "$L_ERR"; then
      report alloc PASS "tripped at ${HELD}MB of ${ALLOCMB}MB, marker landed, .err names memory cap"
    else
      report alloc FAIL "tripped at ${HELD}MB but .err names no memory cap (err: $(head -c 200 "$L_ERR" | tr '\n' ';'))"
    fi
  else
    report alloc FAIL "alloc launch marker never landed"
  fi
else
  report alloc UNPROVEN "no finite memory cap to size from (see limits); refusing to probe blind"
fi

# --- Control: a launch within the caps runs as before -------------------------
if launch control 120 bash "$ODIR/probe_control.sh"; then
  if grep -q 'CONTROL-OK' "$L_OUT" 2>/dev/null; then
    if grep -qiE 'cap .*(reached|exceeded)|limit .*(reached|exceeded)|out of memory|[^a-z]oom[^a-z]' "$L_ERR" 2>/dev/null; then
      report control FAIL ".err names a cap on a launch within the caps (err: $(head -c 200 "$L_ERR" | tr '\n' ';'))"
    else
      report control PASS "completed, marker landed, no cap named"
    fi
  else
    report control FAIL "marker landed but CONTROL-OK missing (out: $(head -c 200 "$L_OUT" | tr '\n' ';'))"
  fi
else
  report control FAIL "control launch marker never landed"
fi

# --- AC3: defaults + per-role config (heuristic; key names are the lanes') ----
AC3OUT=$(python3 - "$ROOT/config.example.toml" <<'EOF'
import re, sys
try:
    lines = open(sys.argv[1]).read().splitlines()
except OSError:
    print("config.example.toml missing"); sys.exit(0)
code = [l for l in lines if l.strip() and not l.strip().startswith('#')]
mem = [l for l in code if re.search(r'(?i)mem\w*.{0,20}(max|cap|limit)|.{0,20}(max|cap|limit).{0,20}mem', l)]
tsk = [l for l in code if re.search(r'(?i)(tasks|process).{0,20}(max|cap|limit)|.{0,20}(max|cap|limit).{0,20}(tasks|process)', l)]
roles = [l for l in code if re.search(r'(?i)(lane|coachman|reviewer|role)', l) and re.search(r'(?i)(mem|task|process|cap|limit)', l)]
print("MEM:%d TSK:%d ROLE:%d" % (len(mem), len(tsk), len(roles)))
for l in (mem + tsk + roles)[:10]:
    print("  | " + l.strip())
EOF
)
AC3SUM=$(printf '%s\n' "$AC3OUT" | head -1)
case $AC3SUM in
  MEM:0*|*TSK:0*|*ROLE:0*)
    report config FAIL "want memory + tasks defaults and a per-role override in config.example.toml ($AC3SUM)"
    printf '%s\n' "$AC3OUT" | sed 's/^/         /'
    ;;
  *)
    if "$ROOT/scripts/setup.sh" --keys 2>/dev/null | grep -qiE 'mem|task'; then
      report config PASS "memory + tasks defaults with per-role override ($AC3SUM), setup.sh --keys agrees"
    else
      report config FAIL "config.example.toml has caps ($AC3SUM) but setup.sh --keys names none"
    fi
    ;;
esac

# --- AC4: host.sh --self-test has the controls, and passes --------------------
# Scoped to the self-test body: the stop logic elsewhere already says "fork".
STBODY=$(sed -n '/^self_test()/,/^}/p' "$ROOT/scripts/host.sh")
CHASFORK=$(printf '%s' "$STBODY" | grep -ciE 'fork|tasksmax|pids\.max')
CHASALLOC=$(printf '%s' "$STBODY" | grep -ciE 'alloc|memorymax|memory\.max')
if [ "$CHASFORK" -gt 0 ] && [ "$CHASALLOC" -gt 0 ]; then
  if timeout 900 "$HOST" --self-test >"$TMP/selftest.log" 2>&1; then
    report selftest PASS "self-test body has fork ($CHASFORK) + alloc ($CHASALLOC) controls, --self-test exits 0"
  else
    report selftest FAIL "host.sh --self-test exits $?: $(tail -c 300 "$TMP/selftest.log" | tr '\n' ';')"
  fi
else
  report selftest FAIL "self-test body mentions fork-ish ${CHASFORK}x + alloc-ish ${CHASALLOC}x (want both controls)"
fi

# --- AC5: no mechanism -> still runs, says uncapped ---------------------------
STUB=$TMP/nostub; mkdir -p "$STUB"
printf '#!/usr/bin/env bash\necho "oracle stub: no systemd" >&2\nexit 1\n' >"$STUB/systemd-run"
printf '#!/usr/bin/env bash\necho "oracle stub: no systemctl" >&2\nexit 1\n' >"$STUB/systemctl"
chmod +x "$STUB/systemd-run" "$STUB/systemctl"
if PATH="$STUB:$PATH" launch nomech 120 echo nomech-probe-ok; then
  if grep -qi 'uncapped' "$L_OUT" "$L_ERR" 2>/dev/null; then
    report uncapped PASS "completed without a mechanism and says uncapped"
  elif grep -q 'nomech-probe-ok' "$L_OUT" 2>/dev/null; then
    report uncapped UNPROVEN "completed but says nothing (stub may not engage a non-systemd mechanism)"
  else
    report uncapped FAIL "marker landed but probe output missing"
  fi
else
  report uncapped FAIL "launch without a mechanism never landed its marker (must still run)"
fi

printf 'oracle: summary pass=%d fail=%d unproven=%d\n' "$PASS" "$FAIL" "$UNPROVEN"
[ "$FAIL" -gt 0 ] && exit 1
[ "$UNPROVEN" -gt 0 ] && exit 2
exit 0
