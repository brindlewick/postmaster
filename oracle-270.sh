#!/usr/bin/env bash
# Blind oracle for #270: a run can be single-thread: the coachman writes the
# change itself and no workhorse lane runs.
#
# Written by the leg-1 coachman from the ticket's ### Checks BEFORE reading any
# lane's diff or log, and committed on the ticket branch before any synthesis
# code. Tests at the ticket's own interface: script CLIs, exit codes, run.json
# records, score report lines, runbook words. Never a function shape, which is
# what the lanes were dispatched to choose.
#
# Two names are the lanes' choice and are discovered, never pinned:
#   the mode key: the setup --keys line naming single-thread, a token that
#     exists nowhere at BASE; used in answers files, and the config key it
#     emits under [team] is read back from the dry-run output and used in
#     crafted configs.
#   the mode read verb: `mode` first, else any new run-meta verb whose output
#     on a dispatch prints the run's mode, its source and the setting.
# Anything undiscoverable is a loud SKIP, never a silent pass and never a
# FAIL: the coachman judges those from the diff at harvest. Anything needing a
# full model run (a fixture run in either mode) is a SKIP the same way.
#
# Usage: ./oracle-270.sh   (runs from the repo root)
# Exit 0 when every acceptance criterion holds, 1 otherwise.
set -uo pipefail
ROOT=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
cd "$ROOT" || exit 1
BASE=393f263a61c7291f2720d1fa76ad6a2b982adda1 # this run's base == the ticket's Verified-at commit

PASS=0; FAIL=0; SKIP=0
pass() { PASS=$((PASS + 1)); echo "PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "FAIL: $1"; }
skip() { SKIP=$((SKIP + 1)); echo "SKIP: $1"; }

SCR=$(mktemp -d /tmp/oracle-270.XXXXXXXX)
cleanup() { rm -rf "$SCR"; }
trap cleanup EXIT

export GIT_AUTHOR_NAME=oracle GIT_AUTHOR_EMAIL=oracle@example.invalid
export GIT_COMMITTER_NAME=oracle GIT_COMMITTER_EMAIL=oracle@example.invalid
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null

# --- answers files for setup -----------------------------------------------
ANS=$SCR/answers-base.txt
cat > "$ANS" <<'EOF'
lanes=alpha, beta
lane.alpha.harness=bash
lane.alpha.model=m1
lane.beta.harness=bash
lane.beta.model=m2
workhorses=alpha, beta
coachman.harness=bash
coachman.model=judge
fallback.harness=bash
fallback.model=spare
postmaster.harness=bash
postmaster.model=pm
clerk.harness=claude
clerk.model=clerk-model
EOF

# --- C1: the mode key in setup (AC1) ---
KEYS=$(scripts/run setup --keys 2>/dev/null)
MODEL=$(printf '%s\n' "$KEYS" | grep "single-thread" | head -1)
MODEKEY=""
if [ -z "$MODEL" ]; then
  fail "C1 setup --keys lists no mode key naming single-thread"
else
  MODEKEY=$(printf '%s\n' "$MODEL" | awk '{print $1}')
  pass "C1 setup --keys lists a mode key: $MODEKEY"
  for w in synthesis single-thread alternate; do
    case "$MODEL" in
      *"$w"*) pass "C1 the mode key names $w" ;;
      *) fail "C1 the mode key names no $w: $MODEL" ;;
    esac
  done
  DEF=$(printf '%s\n' "$MODEL" | awk '{print $2}')
  if [ "$DEF" = "synthesis" ]; then
    pass "C1 the mode key defaults to synthesis"
  else
    fail "C1 the mode key default is '$DEF', must be synthesis: $MODEL"
  fi
fi
if printf '%s\n' "$KEYS" | grep -q "^max_runs "; then
  pass "C1 control: --keys still lists max_runs"
else
  fail "C1 control: --keys lost max_runs"
fi

CFGKEY=""
if [ -n "$MODEKEY" ]; then
  for v in synthesis single-thread alternate; do
    { cat "$ANS"; printf '%s=%s\n' "$MODEKEY" "$v"; } > "$SCR/answers-$v.txt"
    timeout 120 scripts/run setup --answers "$SCR/answers-$v.txt" --dry-run </dev/null >"$SCR/dry-$v.out" 2>&1
    echo "$v $?" >> "$SCR/dry-rc.txt"
  done
  dryrc() { awk -v v="$1" '$1==v{print $2}' "$SCR/dry-rc.txt"; }
  # The config key is whatever the dry-run emits for single-thread, a token
  # that exists nowhere at BASE, so the match is exact.
  CFGKEY=$(grep -oE "[A-Za-z_][A-Za-z0-9_]* *= *\"single-thread\"" "$SCR/dry-single-thread.out" 2>/dev/null | head -1 | sed -E 's/ *=.*//')
  if [ -z "$CFGKEY" ]; then
    fail "C1 no dry-run emits a config key for single-thread"
  else
    pass "C1 the config key is $CFGKEY (read back from the dry-run)"
    for v in synthesis single-thread alternate; do
      if [ "$(dryrc "$v")" = "0" ] && grep -qE "^$CFGKEY *= *\"$v\"" "$SCR/dry-$v.out" 2>/dev/null; then
        pass "C1 dry-run with $MODEKEY=$v carries $CFGKEY = \"$v\" (exit 0)"
      else
        fail "C1 dry-run with $MODEKEY=$v: exit $(dryrc "$v"), must be 0 carrying $CFGKEY = \"$v\""
      fi
    done
  fi
  { cat "$ANS"; printf '%s=%s\n' "$MODEKEY" "two-lanes"; } > "$SCR/answers-bogus.txt"
  timeout 120 scripts/run setup --answers "$SCR/answers-bogus.txt" --dry-run </dev/null >"$SCR/dry-bogus.out" 2>&1
  RC=$?
  if [ $RC -eq 1 ] && grep -q "synthesis" "$SCR/dry-bogus.out" && grep -q "single-thread" "$SCR/dry-bogus.out" && grep -q "alternate" "$SCR/dry-bogus.out"; then
    pass "C1 another value exits 1 naming the three"
  else
    fail "C1 bogus mode value: exit $RC, must be 1 naming synthesis, single-thread and alternate"
  fi
else
  skip "C1 dry-runs: no mode key discovered"
fi
timeout 120 scripts/run setup --answers "$ANS" --dry-run </dev/null >"$SCR/dry-plain.out" 2>&1
RC=$?
if [ $RC -eq 0 ]; then
  pass "C1 control: the base answers still dry-run exit 0"
else
  fail "C1 control: base dry-run exit $RC"
fi
if grep -q "single-thread" config.example.toml; then
  pass "C1 config.example.toml shows the mode"
else
  fail "C1 config.example.toml names no single-thread"
fi

# --- run-meta dispatches on scratch projects --------------------------------
# Every dispatch runs under a crafted POSTMASTER_CONFIG and scratch
# POSTMASTER_TOOL_PINS, so the machine's config and pins are untouched.
METAREPO=$SCR/metarepo
mkdir -p "$METAREPO" && git -C "$METAREPO" init -q -b main . \
  && git -C "$METAREPO" commit -q --allow-empty -m seed
mkconfig() { # $1 = out, $2 = extra [team] lines
  {
    printf '[lanes.one]\nharness = "bash"\nmodel = "m1"\n'
    printf '[lanes.two]\nharness = "bash"\nmodel = "m2"\n'
    printf '[team]\nworkhorses = ["one", "two"]\n'
    printf 'coachman = { harness = "bash", model = "judge" }\n'
    printf 'coachman_fallback = { harness = "bash", model = "backup" }\n'
    printf '%s\n' "$2"
  } > "$1"
}
METAPINS=$SCR/pins
METARC=0
metarun() { # $1 = dispatch dir (made), $2 = config, rest = extra run-meta args
  d=$1; c=$2; shift 2
  mkdir -p "$d"
  POSTMASTER_CONFIG="$c" POSTMASTER_TOOL_PINS="$METAPINS" timeout 170 scripts/run run-meta "$d" "$METAREPO" "$@" >"$SCR/meta-last.out" 2>&1
  METARC=$?
}
jget() { # $1 = file, $2 = python expr on loaded r; MISSING on any failure
  python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); print(eval(sys.argv[2]))' "$1" "$2" 2>/dev/null || echo "MISSING"
}
jhas() { # $1 = file, $2 = value; exit 0 when any top-level value equals it
  python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); sys.exit(0 if sys.argv[2] in [str(v) for v in r.values()] else 1)' "$1" "$2" 2>/dev/null
}
sib() { # $1 = dir, $2 = written, $3 = mode or empty, $4 = stage or empty
  mkdir -p "$1"
  if [ -n "$3" ]; then printf '{"written":"%s","mode":"%s"}' "$2" "$3" > "$1/run.json"
  else printf '{"written":"%s"}' "$2" > "$1/run.json"; fi
  [ -n "$4" ] && printf '{"stage":"%s","leg":1,"base":"x","lanes":{}}' "$4" > "$1/manifest.json" || true
}

# --- C2: no setting dispatches synthesis (AC2, AC5) ---
mkconfig "$SCR/cfg-plain.toml" ""
metarun "$SCR/c2" "$SCR/cfg-plain.toml"
C2MODE=$(jget "$SCR/c2/run.json" 'r.get("mode")')
if [ $METARC -eq 0 ] && [ "$C2MODE" = "synthesis" ]; then
  pass "C2 no mode key records mode synthesis"
else
  fail "C2 no mode key: exit $METARC, mode $C2MODE (must be synthesis)"
fi
if jhas "$SCR/c2/run.json" "setting"; then
  pass "C2 the mode's source is the setting"
else
  fail "C2 no top-level source reads setting"
fi
if grep -q "synthesis" "$SCR/meta-last.out" 2>/dev/null; then
  pass "C2 run-meta names the mode, for the postmaster's note (AC15)"
else
  fail "C2 run-meta output names no synthesis"
fi

# --- C3: alternate alternates per project (AC3) ---
if [ -z "$CFGKEY" ]; then
  skip "C3 alternate: no config key discovered"
else
  mkconfig "$SCR/cfg-alt.toml" "$CFGKEY = \"alternate\""
  metarun "$SCR/runs-none/103" "$SCR/cfg-alt.toml"
  M=$(jget "$SCR/runs-none/103/run.json" 'r.get("mode")')
  [ "$M" = "single-thread" ] && pass "C3 a project with no run gets single-thread" \
    || fail "C3 no previous run: mode $M (must be single-thread)"
  sib "$SCR/runs-nomode/101" "2026-01-01T00:00:00Z" "" "done"
  metarun "$SCR/runs-nomode/102" "$SCR/cfg-alt.toml"
  M=$(jget "$SCR/runs-nomode/102/run.json" 'r.get("mode")')
  [ "$M" = "single-thread" ] && pass "C3 a latest run with no mode reads synthesis, so single-thread" \
    || fail "C3 latest run with no mode: mode $M (must be single-thread)"
  sib "$SCR/runs-st/101" "2026-01-01T00:00:00Z" "single-thread" "done"
  metarun "$SCR/runs-st/102" "$SCR/cfg-alt.toml"
  M=$(jget "$SCR/runs-st/102/run.json" 'r.get("mode")')
  [ "$M" = "synthesis" ] && pass "C3 after single-thread comes synthesis" \
    || fail "C3 after single-thread: mode $M (must be synthesis)"
  sib "$SCR/runs-syn/101" "2026-01-01T00:00:00Z" "synthesis" "done"
  metarun "$SCR/runs-syn/102" "$SCR/cfg-alt.toml"
  M=$(jget "$SCR/runs-syn/102/run.json" 'r.get("mode")')
  [ "$M" = "single-thread" ] && pass "C3 after synthesis comes single-thread" \
    || fail "C3 after synthesis: mode $M (must be single-thread)"
  # The latest run is the one whose run.json was written last, whatever its
  # stage: a done run written in January loses to a bootstrapped one from June.
  sib "$SCR/runs-order/101" "2026-01-01T00:00:00Z" "single-thread" "done"
  sib "$SCR/runs-order/102" "2026-06-01T00:00:00Z" "synthesis" "bootstrapped"
  metarun "$SCR/runs-order/103" "$SCR/cfg-alt.toml"
  M=$(jget "$SCR/runs-order/103/run.json" 'r.get("mode")')
  [ "$M" = "single-thread" ] && pass "C3 the latest write wins whatever its stage" \
    || fail "C3 written-order: mode $M (must be single-thread)"
fi

# --- C4: the user's --mode wins (AC4, AC5) ---
if [ -z "$CFGKEY" ]; then
  skip "C4 --mode: no config key discovered"
else
  mkconfig "$SCR/cfg-syn.toml" "$CFGKEY = \"synthesis\""
  metarun "$SCR/c4" "$SCR/cfg-syn.toml" --mode single-thread
  M=$(jget "$SCR/c4/run.json" 'r.get("mode")')
  [ $METARC -eq 0 ] && [ "$M" = "single-thread" ] \
    && pass "C4 --mode single-thread records single-thread under a synthesis setting" \
    || fail "C4 --mode single-thread: exit $METARC, mode $M"
  if jhas "$SCR/c4/run.json" "user"; then
    pass "C4 the mode's source is the user"
  else
    fail "C4 no top-level source reads user"
  fi
  SETTING_HIT=$(python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); print("yes" if any(k!="mode" and v=="synthesis" for k,v in r.items()) else "no")' "$SCR/c4/run.json" 2>/dev/null || echo "MISSING")
  [ "$SETTING_HIT" = "yes" ] && pass "C4 the setting synthesis is kept beside the user's mode" \
    || fail "C4 no top-level setting reads synthesis ($SETTING_HIT)"
  grep -q "single-thread" "$SCR/meta-last.out" 2>/dev/null \
    && pass "C4 run-meta names the user's mode (AC15)" \
    || fail "C4 run-meta output names no single-thread"
  metarun "$SCR/c4b" "$SCR/cfg-syn.toml" --mode two-lanes
  if [ $METARC -eq 1 ] && grep -q "synthesis" "$SCR/meta-last.out" && grep -q "single-thread" "$SCR/meta-last.out"; then
    pass "C4 --mode two-lanes exits 1 naming synthesis and single-thread"
  else
    fail "C4 --mode two-lanes: exit $METARC, must be 1 naming synthesis and single-thread"
  fi
  # A run the user named counts as its project's latest run under alternate.
  sib "$SCR/runs-user/101" "2026-06-01T00:00:00Z" "single-thread" "done"
  metarun "$SCR/runs-user/102" "$SCR/cfg-alt.toml"
  M=$(jget "$SCR/runs-user/102/run.json" 'r.get("mode")')
  [ "$M" = "synthesis" ] && pass "C4 a user-named single-thread run is the latest under alternate" \
    || fail "C4 user-named latest: mode $M (must be synthesis)"
fi

# --- C5: the read verb prints mode, source and setting (AC5) ---
MODEVERB=""
if [ -f "$SCR/c2/run.json" ] && [ "$(jget "$SCR/c2/run.json" 'r.get("mode")')" = "synthesis" ]; then
  tryverb() { # $1 = verb; sets MODEVERB when it prints mode, source and setting
    timeout 60 scripts/run run-meta "$1" "$SCR/c2" </dev/null >"$SCR/verb.out" 2>&1
    RC=$?
    [ $RC -eq 0 ] && grep -q "synthesis" "$SCR/verb.out" && grep -q "setting" "$SCR/verb.out" && MODEVERB="$1"
  }
  tryverb mode
  if [ -z "$MODEVERB" ]; then
    for v in $(scripts/run run-meta 2>&1 | tr '|' '\n' | awk '{print $1}' | grep -E '^[a-z-]+$' | grep -v -E '^(pin|path|run-pinned|check|release|efforts)$' | sort -u); do
      tryverb "$v"
      [ -n "$MODEVERB" ] && break
    done
  fi
  if [ -n "$MODEVERB" ]; then
    pass "C5 the read verb is run-meta $MODEVERB"
    if [ -f "$SCR/c4/run.json" ] && [ "$(jget "$SCR/c4/run.json" 'r.get("mode")')" = "single-thread" ]; then
      timeout 60 scripts/run run-meta "$MODEVERB" "$SCR/c4" </dev/null >"$SCR/verb4.out" 2>&1
      RC=$?
      if [ $RC -eq 0 ] && grep -q "single-thread" "$SCR/verb4.out" && grep -q "user" "$SCR/verb4.out" && grep -q "synthesis" "$SCR/verb4.out"; then
        pass "C5 the verb prints the mode, its source and the setting (exit 0)"
      else
        fail "C5 run-meta $MODEVERB on the user-named run: exit $RC, must print single-thread, user and synthesis"
      fi
    else
      skip "C5 the user-named print: no C4 dispatch to read"
    fi
  else
    skip "C5 the read verb: undiscoverable (judge from the diff)"
  fi
else
  skip "C5 the read verb: no C2 dispatch to read"
fi

# --- runbook rules (C6-C11, C13-C15) ------------------------------------------
CM=skills/postmaster/coachman.md
PM=skills/postmaster/postmaster.md
SK=skills/postmaster/SKILL.md
ctx() { # $1 = file, $2 = pattern, $3 = out: the pattern's lines plus 8 around each
  grep -n -i "$2" "$1" 2>/dev/null | cut -d: -f1 | while read -r n; do
    a=$((n - 8)); [ $a -lt 1 ] && a=1; b=$((n + 8)); sed -n "${a},${b}p" "$1"
    echo "---"
  done > "$3" 2>/dev/null || true
}
ctx "$CM" "single-thread" "$SCR/stctx.txt"
ctx "$PM" "single-thread" "$SCR/pmctx.txt"
ctx "$CM" "boundary" "$SCR/bctx.txt"
ctx "$CM" "acceptance test" "$SCR/actx.txt"
awk '/^## Stage 2/{f=1} /^## Stage 3/{f=0} f' "$CM" > "$SCR/review-sec.txt" 2>/dev/null || true

# --- C6: single-thread starts no workhorse (AC6) ---
if [ -s "$SCR/stctx.txt" ]; then
  pass "C6 coachman.md has a single-thread section"
else
  fail "C6 coachman.md names no single-thread"
fi
if grep -qiE "no workhorse" "$SCR/stctx.txt" 2>/dev/null; then
  pass "C6 the section starts no workhorse lane"
else
  fail "C6 the single-thread section starts no workhorse nowhere"
fi
if grep -q -- "--mode" "$PM" 2>/dev/null; then
  pass "C6 Stage B passes --mode to run-meta"
else
  fail "C6 postmaster.md passes no --mode"
fi
if grep -q "mode:" "$PM" 2>/dev/null; then
  pass "C6 Stage B puts a mode: line in the waybill"
else
  fail "C6 postmaster.md names no mode: line"
fi
if grep -q "mode:" "$SK" 2>/dev/null; then
  pass "C6 the waybill template carries the mode: line"
else
  fail "C6 SKILL.md names no mode: line"
fi
if grep -qiE "no workhorse|names no" "$SCR/pmctx.txt" 2>/dev/null; then
  pass "C6 the Team section names no workhorse lane in single-thread mode"
else
  fail "C6 postmaster.md names no workhorse-less Team for single-thread"
fi
skip "C6 a single-thread run starts no lane and commits on its branch: needs a model run"

# --- C7: the acceptance tests come first (AC7) ---
if grep -qiE "before (any|the)|first commit" "$SCR/stctx.txt" 2>/dev/null; then
  pass "C7 the tests are committed before any of the change"
else
  fail "C7 the single-thread section commits the tests first nowhere"
fi
if grep -q "first commit" "$PM" 2>/dev/null; then
  pass "C7 control: Stage F still checks the blind tests are the first commit"
else
  fail "C7 control: postmaster.md lost the first-commit check"
fi
skip "C7 the tests-first history of a single-thread run: needs a model run"

# --- C8: tests at the boundary where the feature is used (AC8) ---
if grep -qiE "boundary where (it is|they are) used" "$CM" 2>/dev/null; then
  pass "C8 the runbook states the boundary rule for every run"
else
  fail "C8 coachman.md states no boundary rule"
fi
if grep -qi "browser" "$SCR/bctx.txt" 2>/dev/null; then
  pass "C8 the rule names a browser for a web app"
else
  fail "C8 the boundary rule names no browser"
fi
if grep -qi "public interface" "$SCR/bctx.txt" 2>/dev/null; then
  pass "C8 the rule names the public interface for a library"
else
  fail "C8 the boundary rule names no public interface"
fi
skip "C8 fixture acceptance tests at the boundary: needs model runs"

# --- C9: a test changes only in a commit of its own that says why (AC9) ---
if grep -qiE "commit of its own|touches .* alone|tests alone" "$CM" 2>/dev/null; then
  pass "C9 a changed test gets a commit of its own with its reason"
else
  fail "C9 coachman.md gives changed tests no commit of their own"
fi
skip "C9 test-change commits in the fixture runs: needs model runs"

# --- C10: a failing check escalates to the postmaster (AC10) ---
if grep -q "cannot pass as written" "$CM" 2>/dev/null; then
  pass "C10 control: the cannot-pass-as-written rule is still stated"
else
  fail "C10 control: coachman.md lost the cannot-pass-as-written rule"
fi
if grep -qi "escalat" "$SCR/actx.txt" 2>/dev/null; then
  pass "C10 a check that cannot pass is an escalation naming it"
else
  fail "C10 the acceptance-test rules escalate nowhere"
fi
skip "C10 the postmaster's ruling on a check: needs a run"

# --- C11: the single-thread loop (AC11) ---
if grep -qiE "until every check passes|stopping only when stuck|as a workhorse" "$SCR/stctx.txt" 2>/dev/null; then
  pass "C11 the single-thread loop repeats build, check and fix to green or stuck"
else
  fail "C11 the single-thread section gives no workhorse loop"
fi
skip "C11 verify lines for the synthesis worktree: needs a model run"

# --- C13: review and landing are the same in both modes (AC13, D13) ---
sed 's/^workhorses=.*/workhorses=alpha/' "$ANS" > "$SCR/answers-one.txt"
timeout 120 scripts/run setup --answers "$SCR/answers-one.txt" --dry-run </dev/null >"$SCR/dry-one.out" 2>&1
RC=$?
if [ $RC -eq 1 ]; then
  pass "C13 control: setup still refuses fewer than two workhorses"
else
  fail "C13 control: one workhorse exits $RC, must be 1"
fi
printf '[lanes.alpha]\nharness="bash"\nmodel="m1"\n[lanes.beta]\nharness="bash"\nmodel="m2"\n[team]\nworkhorses=["alpha","beta"]\n' > "$SCR/rev-fallback.toml"
if scripts/run reviewers lines --config "$SCR/rev-fallback.toml" 2>/dev/null | grep -q "^reviewers: alpha, beta"; then
  pass "C13 control: empty reviewers still fall back to the workhorses"
else
  fail "C13 control: reviewers lost the workhorse fallback"
fi
printf '[lanes.alpha]\nharness="bash"\nmodel="m1"\n[lanes.beta]\nharness="bash"\nmodel="m2"\n[team]\nworkhorses=["alpha","beta"]\nreviewers=["alpha"]\n' > "$SCR/rev-set.toml"
if scripts/run reviewers lines --config "$SCR/rev-set.toml" 2>/dev/null | grep -q "^reviewers: alpha$"; then
  pass "C13 control: set reviewers are still used as set"
else
  fail "C13 control: set reviewers are not used"
fi
skip "C13 both modes share reviewers, gate and card: needs both fixture runs"

# --- C14: no review brief names the mode (AC14) ---
if [ "$(wc -l < "$SCR/review-sec.txt" 2>/dev/null || echo 0)" -gt 50 ]; then
  if grep -qiE "single-thread|synthesis mode" "$SCR/review-sec.txt"; then
    fail "C14 the review leg names the mode"
  else
    pass "C14 the review leg names no mode"
  fi
else
  fail "C14 the review section cannot be found in coachman.md"
fi
if grep -q "already known" "$CM" 2>/dev/null; then
  pass "C14 control: review briefs still carry findings already known"
else
  fail "C14 control: coachman.md lost the known-findings line"
fi
skip "C14 fixture review briefs name no mode: needs model runs"

# --- C15: the log and the card say the mode (AC15) ---
if grep -q "mode=single-thread" "$CM" 2>/dev/null; then
  pass "C15 the SYNTHESIS line carries mode=single-thread"
else
  fail "C15 coachman.md gives the SYNTHESIS line no mode="
fi
if grep -q "Mode: single-thread" "$CM" 2>/dev/null; then
  pass "C15 the card carries a Mode: line"
else
  fail "C15 coachman.md gives the card no Mode: line"
fi
skip "C15 fixture logs and cards: needs model runs"

# --- C16: a leg whose waybill disagrees with the record does not start (AC16) ---
CHKTOOL=$SCR/chktool
mkdir -p "$CHKTOOL" && git -C "$CHKTOOL" init -q -b main . && git -C "$CHKTOOL" commit -q --allow-empty -m t
mkchk() { # $1=dir $2=run.json mode|- $3=brief mode:|- $4=workhorses line 0|1
  mkdir -p "$1"
  if [ "$2" = "-" ]; then
    printf '{"written":"2026-10-04T00:00:00Z","coachman_contract":2,"postmaster":{},"config":{"confine":"off"}}' > "$1/run.json"
  else
    printf '{"written":"2026-10-04T00:00:00Z","coachman_contract":2,"mode":"%s","postmaster":{},"config":{"confine":"off"}}' "$2" > "$1/run.json"
  fi
  {
    printf '# Waybill: 9\nturnpikes: style\n\n## Team\n'
    [ "$4" = "1" ] && printf 'workhorses: one=h1/m1/max\n' || true
    printf 'coachman: muse/m/max\n'
    [ "$3" != "-" ] && printf 'mode: %s\n' "$3" || true
    printf '\n## Dispatch\nname: x\ntool: %s\ndispatch: %s\n' "$CHKTOOL" "$1"
  } > "$1/brief.md"
}
mkchk "$SCR/chk-match" single-thread single-thread 0
timeout 60 scripts/run run-meta check "$SCR/chk-match" </dev/null >"$SCR/chk-match.out" 2>&1
RC=$?
if [ $RC -eq 0 ]; then
  pass "C16 a matching record checks exit 0"
else
  fail "C16 matching record: exit $RC, must be 0"
fi
mkchk "$SCR/chk-mm" single-thread synthesis 0
timeout 60 scripts/run run-meta check "$SCR/chk-mm" </dev/null >"$SCR/chk-mm.out" 2>&1
RC=$?
if [ $RC -eq 1 ] && grep -q "single-thread" "$SCR/chk-mm.out" && grep -q "synthesis" "$SCR/chk-mm.out"; then
  pass "C16 a mismatching waybill exits 1 naming both modes"
else
  fail "C16 mismatch: exit $RC, must be 1 naming single-thread and synthesis"
fi
mkchk "$SCR/chk-rev" synthesis single-thread 1
timeout 60 scripts/run run-meta check "$SCR/chk-rev" </dev/null >"$SCR/chk-rev.out" 2>&1
RC=$?
if [ $RC -eq 1 ] && grep -q "single-thread" "$SCR/chk-rev.out" && grep -q "synthesis" "$SCR/chk-rev.out"; then
  pass "C16 the reversed mismatch exits 1 naming both modes"
else
  fail "C16 reversed mismatch: exit $RC, must be 1 naming both modes"
fi
mkchk "$SCR/chk-neither" - - 1
timeout 60 scripts/run run-meta check "$SCR/chk-neither" </dev/null >"$SCR/chk-neither.out" 2>&1
RC=$?
if [ $RC -eq 0 ]; then
  pass "C16 a dispatch from before the change checks exit 0"
else
  fail "C16 pre-change dispatch: exit $RC, must be 0"
fi

# --- synthetic finished runs for the stages and mode checks (C12, C17) ---
# Each is complete enough for `fixture score` to report every check line; the
# other lines fail, which is fine, since only the stages and mode lines are read.
mkrepo() { # $1 = dir, $2 = wb branch 0|1; prints main's SHA
  mkdir -p "$1" && git -C "$1" init -q -b main . && git -C "$1" commit -q --allow-empty -m seed
  [ "$2" = "1" ] && git -C "$1" branch "wb/9-one" || true
  git -C "$1" rev-parse HEAD
}
mkdisp() { # $1=dir $2=main $3=mode $4=W 0|1 $5=dispatch line 0|1
  d=$1; mkdir -p "$d"
  if [ "$3" = "single-thread" ]; then LANES='{}'; else LANES='{"one":{"thread_id":"t","outcome":"harvested"}}'; fi
  printf '{"stage":"done","leg":2,"base":"%s","lanes":%s,"coachman":{"legs":{"1":{"thread_id":"c1","name":"coachman"},"2":{"thread_id":"c2","name":"coachman"}}}}' "$2" "$LANES" > "$d/manifest.json"
  printf '{"written":"2026-10-04T00:00:00Z","coachman_contract":2,"mode":"%s","config":{"team":{"workhorses":["one"]},"confine":"off"}}' "$3" > "$d/run.json"
  {
    printf '# Waybill: 9\nturnpikes: style, bug, security\n\n## Team\n'
    if [ "$3" = "single-thread" ]; then printf 'coachman: muse/m/max\nmode: single-thread\n'
    else printf 'workhorses: one=h1/m1/max\nmode: synthesis\n'; fi
    printf '\n## Dispatch\nname: x\ndispatch: %s\n' "$d"
  } > "$d/brief.md"
  {
    printf '{"ts":"2026-10-04T00:00:00Z","actor":"coachman","action":"premises","target":"v","detail":""}\n'
    if [ "$4" = "1" ]; then STAGES="bootstrapped workhorses-running synthesis checkpoint-1 review shipping shipped done"
    else STAGES="bootstrapped synthesis checkpoint-1 review shipping shipped done"; fi
    for s in $STAGES; do
      printf '{"ts":"2026-10-04T00:00:00Z","actor":"coachman","action":"stage","target":"%s","detail":""}\n' "$s"
    done
    [ "$5" = "1" ] && printf '{"ts":"2026-10-04T00:00:00Z","actor":"coachman","action":"dispatch","target":"one","detail":"thread t"}\n' || true
  } > "$d/actions.jsonl"
  echo card > "$d/card.md"
  printf '## Decisions\na\n## Deferred findings\nb\n## Verified by execution\nc\n## Unverified\nd\n## Branches and lanes\ne\n## Open questions\nf\n## Next leg\ng\n' > "$d/handoff-1.md"
  cp "$d/handoff-1.md" "$d/handoff-2.md"
  echo cp1 > "$d/checkpoint-1.md"; echo cpr > "$d/checkpoint-review.md"
}
stageline() { grep -E "^(ok|FAIL) +stages " "$1" 2>/dev/null | head -1; }
modeline() { grep -E "^(ok|FAIL) +[^ ]*[Mm]ode[^ ]* " "$1" 2>/dev/null | head -1; }
want() { # $1 = out, $2 = stages|mode, $3 = ok|FAIL, $4 = label
  line=$(stageline "$1"); [ "$2" = "mode" ] && line=$(modeline "$1")
  if [ -z "$line" ]; then fail "$4: the score names no $2 check"; return; fi
  case "$line" in
    "$3"*) pass "$4: $line" ;;
    *) fail "$4: want $3, got: $line" ;;
  esac
}
scoreit() { # $1 = disp, $2 = repo, $3 = out
  timeout 300 scripts/run fixture score "$1" "$2" >"$3" 2>"$3.err" || true
}
R1=$SCR/sr1; M1=$(mkrepo "$R1" 0); mkdisp "$SCR/s1" "$M1" single-thread 0 0; scoreit "$SCR/s1" "$R1" "$SCR/s1.out"
want "$SCR/s1.out" stages ok "C12 single-thread stages without workhorses-running score ok"
want "$SCR/s1.out" mode ok "C17 a clean single-thread record passes the mode check"
mkdisp "$SCR/s2" "$M1" single-thread 1 0; scoreit "$SCR/s2" "$R1" "$SCR/s2.out"
want "$SCR/s2.out" stages FAIL "C12 single-thread stages with workhorses-running fail"
want "$SCR/s2.out" mode ok "C17 control: a stage line is not a workhorse start"
R3=$SCR/sr3; M3=$(mkrepo "$R3" 1); mkdisp "$SCR/s3" "$M3" synthesis 1 1; scoreit "$SCR/s3" "$R3" "$SCR/s3.out"
want "$SCR/s3.out" stages ok "C12 control: synthesis stages score ok"
want "$SCR/s3.out" mode ok "C17 a clean synthesis record passes the mode check"
mkdisp "$SCR/s4" "$M3" synthesis 1 0; scoreit "$SCR/s4" "$R3" "$SCR/s4.out"
want "$SCR/s4.out" mode FAIL "C17 synthesis without its dispatch lines fails the mode check"
mkdisp "$SCR/s5" "$M1" single-thread 0 1; scoreit "$SCR/s5" "$R1" "$SCR/s5.out"
want "$SCR/s5.out" stages ok "C12 single-thread stages score ok with a dispatch line present"
want "$SCR/s5.out" mode FAIL "C17 single-thread with a workhorse dispatch fails the mode check"
R6=$SCR/sr6; M6=$(mkrepo "$R6" 1); mkdisp "$SCR/s6" "$M6" single-thread 0 0; scoreit "$SCR/s6" "$R6" "$SCR/s6.out"
want "$SCR/s6.out" stages ok "C12 single-thread stages score ok with a wb/ branch present"
want "$SCR/s6.out" mode FAIL "C17 single-thread with a wb/ branch fails the mode check"
mkdisp "$SCR/s7" "$M3" synthesis 0 1; scoreit "$SCR/s7" "$R3" "$SCR/s7.out"
want "$SCR/s7.out" stages FAIL "C12 control: synthesis stages without workhorses-running fail"
want "$SCR/s7.out" mode ok "C17 control: the mode check reads records, not stages"
skip "C12 the stages of the two fixture runs: needs model runs"

# --- C18: lane discovery on a single-thread record (AC18) ---
timeout 120 scripts/run fixture-lanes "$SCR/s1" "$R1" remove >"$SCR/lanes1.out" 2>&1
RC=$?
if [ $RC -eq 0 ] && [ ! -s "$SCR/lanes1.out" ]; then
  pass "C18 a single-thread record discovers no lane"
else
  fail "C18 single-thread record: exit $RC, must be 0 printing nothing: $(head -c 200 "$SCR/lanes1.out")"
fi
timeout 120 scripts/run fixture-lanes "$SCR/s3" "$R3" remove >"$SCR/lanes3.out" 2>&1
RC=$?
if [ $RC -eq 0 ] && grep -q "^one:" "$SCR/lanes3.out"; then
  pass "C18 control: a synthesis record still discovers its lane"
else
  fail "C18 control: synthesis record discovers no one lane (exit $RC)"
fi
skip "C18 a fixture run in each mode scores clean: needs full model runs"

echo "oracle-270: $PASS pass / $FAIL fail / $SKIP skip"
[ "$FAIL" -eq 0 ]
