#!/usr/bin/env bash
# Blind oracle for #218: Every script runs as its TypeScript file, with no .sh wrapper left.
#
# Written by the leg-1 coachman from the ticket's acceptance criteria BEFORE reading any
# lane's diff or log, and committed on the ticket branch after the spec. Revised once
# before any lane started, to the approved spec text (c520afc): the AC2 probe now reads
# the .env value end to end, AC3 plants a wrapperless name and the two new gate checks,
# AC1 covers the pinned-copy runner and the launch-role check structurally, and AC4 runs
# the detector's BASE mode both ways. Still blind: no lane diff or log read at revision.
# Tests at the ticket's own interface: script paths, arguments, outputs and exits,
# package.json, and docs. Never a function shape, which is what the lanes were dispatched
# to choose.
#
# The form under test is the approved spec's: scripts/run <name> [args]. AC4's fixture
# run is the coachman's verification from the branch, not this file's: dispatching a run
# needs harnesses and hours, and this oracle stays a script run from the repo root, on a
# committed tree.
#
#   ./oracle-218.sh        run every check; exit 0 when all pass, 1 otherwise
#
# Surface notes. The reference greps scan the ticket's named surfaces only, enumerated
# below, never the whole tree: the run's own WORKHORSE-SPEC.md, summaries and transcripts
# quote the ticket and its old commands, and raw/ holds trial evidence that stays as it
# was. Inside scripts/, *.test.ts files may plant the old form as test inputs (fix
# fixtures, the entry's .sh-name refusal, fake old-form pinned copies), coachman-contract.ts
# may plant old-form names in its BASE-mode self-test fixtures, and the new pinned-copy
# runner module holds the old-form branch; the gate proves the live test argv works, and
# the AC3 probes prove fix behavior. BASE citations (a `BASE ... name.sh:line` comment
# naming the pre-port source a port mirrors) are evidence about the past, not live
# references, and G2 skips them; added in review, when round 1 found the mechanical
# rename had falsified them. What this file cannot see mechanically it does not
# guess at: the runner's cross-form behavior, the supervising command's shape, and the
# launch-role negative control are verified by the coachman reading each lane's diff and
# running that lane's own tests and commands.

ok=0
bad=0
ok() { ok=$((ok + 1)); echo "ok $1"; }
bad() { bad=$((bad + 1)); echo "BAD $1"; }

[ -f package.json ] && [ -d scripts ] || {
  echo "oracle: run from the repo root" >&2
  exit 2
}
WT=$(pwd -P)
command -v git >/dev/null && command -v bun >/dev/null || {
  echo "oracle: needs git and bun" >&2
  exit 2
}

# The 51 wrappers on main at BASE, plus the 2 main added after BASE, longest first so front-door-acceptance matches whole.
WRAPPERS='front-door-acceptance|parallel-runs-acceptance|verify-examples|verify-library|review-decide|review-findings|spec-review-link|coachman-contract|discover-project|handoff-check|project-settings|spec-decisions|style-findings|wait-for-markers|probe-confine|ticket-parts|check-target|cut-scratch|export-session|find-projects|front-door|probe-harnesses|probe-trackers|review-forms|review-round|runs-status|ticket-check|tool-faults|tracker-kind|turnpikes|verify-journey|view-stream|fixture|github|landing|launch|link-skills|local|log-action|plane|reviewers|run-log|run-meta|run-times|runs-watch|setup|skill-refs|spec-session|stage|text|host|verify|wiki-lint'
# The 7 runnable .ts files that never had a wrapper (host-self-test.ts is import-only).
NAMES='check-target coachman-contract cut-scratch discover-project export-session find-projects fixture front-door front-door-acceptance github handoff-check host landing launch link-skills local log-action parallel-runs-acceptance plane probe-confine probe-harnesses probe-trackers project-settings review-decide review-findings review-forms review-page review-round reviewers run-log run-meta run-times runs-status runs-watch setup skill-refs spec-decisions spec-review-link spec-session stage style-findings text ticket-check ticket-parts tool-faults tracker-kind turnpikes verify verify-examples verify-journey verify-library view-stream wait-for-markers wiki-lint clean-checkout fixture-lanes run-clash summary-evidence synthesis-shares usage'
set -- $NAMES
[ $# -eq 60 ] || bad "oracle: NAMES lists $# scripts, want 60"

SURFACES=(AGENTS.md README.md skills package.json .postmaster/project.toml project.example.toml config.example.toml fixtures docs/coachman-contract.toml scripts lint types)
for s in "${SURFACES[@]}"; do
  [ -e "$s" ] || bad "AC1: surface missing: $s"
done

# The pinned-copy runner: new non-test .ts in scripts/lib/ holding the old-form branch.
BASE_LIB="data.ts paths.ts proc.ts text.ts"
new_lib=""
for f in scripts/lib/*.ts; do
  [ -e "$f" ] || continue
  b=$(basename "$f")
  case "$b" in *.test.ts) continue ;; esac
  case " $BASE_LIB " in *" $b "*) continue ;; esac
  new_lib="$new_lib $b"
done
runner_files=""
for b in $new_lib; do
  if grep -q '\.sh' "scripts/lib/$b" 2>/dev/null; then runner_files="$runner_files $b"; fi
done
if [ -z "$new_lib" ]; then
  bad "AC1: no pinned-copy runner module in scripts/lib/"
else
  ok "pinned-copy runner module present:$new_lib"
fi

echo "AC1: no scripts/*.sh remains, one form everywhere"
tracked=$(git ls-files 'scripts/*.sh' 2>/dev/null | tr '\n' ' ')
if [ -z "$tracked" ]; then ok "no tracked scripts/*.sh"; else bad "tracked wrappers remain: $tracked"; fi
if compgen -G "scripts/*.sh" >/dev/null; then
  bad "scripts/*.sh files present on disk: $(compgen -G 'scripts/*.sh' | tr '\n' ' ')"
else
  ok "no scripts/*.sh on disk"
fi
if [ -x scripts/run ]; then ok "scripts/run exists and is executable"; else bad "scripts/run missing or not executable"; fi

EXCLUDES=(--exclude='*.test.ts' --exclude='coachman-contract.ts')
for b in $runner_files; do EXCLUDES+=(--exclude="$b"); done
G1="((<tool>/|<rt>/)?scripts/)($WRAPPERS)\.sh([^A-Za-z0-9_-]|\$)"
hits=$(grep -rnE -m5 "${EXCLUDES[@]}" -e "$G1" "${SURFACES[@]}" 2>/dev/null); rc=$?
if [ "$rc" -eq 2 ]; then bad "AC1: reference pattern G1 is invalid"; elif [ -z "$hits" ]; then ok "no path-shaped old reference on the named surfaces"; else bad "old path-shaped references:"; echo "$hits" | sed 's/^/         /'; fi
G2="(^|[^A-Za-z0-9_-])($WRAPPERS)\.sh([^A-Za-z0-9_-]|\$)"
hits=$(grep -rnE -m20 "${EXCLUDES[@]}" -e "$G2" "${SURFACES[@]}" 2>/dev/null | grep -vE -e "$G1" | grep -vE 'BASE.*\.sh:[0-9]+' | head -5)
if [ -z "$hits" ]; then ok "no other old-form wrapper token on the named surfaces"; else bad "old-form wrapper tokens:"; echo "$hits" | sed 's/^/         /'; fi
G3="bun.*scripts/[A-Za-z0-9_-]+\.ts"
hits=$(grep -rnE -m5 "${EXCLUDES[@]}" -e "$G3" AGENTS.md README.md skills scripts fixtures 2>/dev/null); rc=$?
if [ "$rc" -eq 2 ]; then bad "AC1: reference pattern G3 is invalid"; elif [ -z "$hits" ]; then ok "no bare-bun script invocation survives"; else bad "bare-bun invocations:"; echo "$hits" | sed 's/^/         /'; fi

if grep -qF '"check": "tsc --noEmit && bunx oxlint && bunx biome format scripts types lint package.json tsconfig.json biome.json .oxlintrc.json && bun test scripts/ lint/ && scripts/run skill-refs && scripts/run wiki-lint"' package.json 2>/dev/null; then
  ok "package.json check is the old line through the entry, rest identical"
else
  bad "package.json check is not the converted line"
fi
if grep -qF "command = '''scripts/run coachman-contract --self-test'''" .postmaster/project.toml 2>/dev/null; then
  ok ".postmaster/project.toml contract check uses the entry"
else
  bad ".postmaster/project.toml contract check is not the entry form"
fi
if grep -q 'is a one-line wrapper' AGENTS.md 2>/dev/null; then
  bad "AGENTS.md still describes the wrapper mechanism"
else
  ok "AGENTS.md no longer describes wrappers"
fi
if grep -q 'scripts/run' AGENTS.md 2>/dev/null; then ok "AGENTS.md names the entry"; else bad "AGENTS.md never names scripts/run"; fi
catalog=$(grep -o 'scripts/run ' README.md 2>/dev/null | wc -l)
if [ "$catalog" -ge 45 ]; then ok "README names the entry $catalog times"; else bad "README names the entry only $catalog times"; fi
for f in SKILL.md coachman.md controls.md harnesses.md hosts.md postmaster.md trackers.md; do
  if grep -q '<tool>/scripts/run ' "skills/postmaster/$f" 2>/dev/null; then
    ok "skills/postmaster/$f converted"
  else
    bad "skills/postmaster/$f has no entry-form reference"
  fi
done
if grep -q '<tool>/scripts/run ' skills/wiki/SKILL.md 2>/dev/null; then ok "skills/wiki/SKILL.md converted"; else bad "skills/wiki/SKILL.md has no entry-form reference"; fi
if grep -q 'run spec-session' skills/postmaster/spec-session.md 2>/dev/null; then ok "spec-session.md converted"; else bad "spec-session.md keeps the bare wrapper name"; fi
runcount=$(grep -r -o '<tool>/scripts/run ' skills/ 2>/dev/null | wc -l)
if [ "$runcount" -ge 300 ]; then ok "runbooks name the entry $runcount times"; else bad "runbooks name the entry only $runcount times"; fi
if grep -qF 'detector = "scripts/coachman-contract.ts"' docs/coachman-contract.toml 2>/dev/null; then
  ok "contract detector names the .ts holder"
else
  bad "contract detector is not scripts/coachman-contract.ts"
fi
toml_bad=0
while IFS= read -r p; do
  [ -n "$p" ] || continue
  case "$p" in
    scripts/*.sh)
      want="path = \"${p%.sh}.ts\""
      grep -qF "$want" docs/coachman-contract.toml 2>/dev/null || { bad "AC1: contract list lost ${p%.sh}.ts"; toml_bad=1; }
      ;;
    *)
      grep -qF "path = \"$p\"" docs/coachman-contract.toml 2>/dev/null || { bad "AC1: contract list lost $p"; toml_bad=1; }
      ;;
  esac
done < <(git show 0620bfc90eb32a35124279d9780df42174e6ccd9:docs/coachman-contract.toml 2>/dev/null | grep -oE 'path = "[^"]*"' | sed 's/path = "\(.*\)"/\1/')
[ "$toml_bad" -eq 0 ] && ok "contract list carries every BASE file to its holder"

if [ -x scripts/run ]; then
  STUB=$(mktemp -d)
  printf '#!/usr/bin/env bash\nprintf "STUB-ARGV:"; printf " <%%s>" "$@"; printf "\\n"\n' >"$STUB/bun"
  chmod +x "$STUB/bun"
  resolve_bad=0
  for n in $NAMES; do
    want="$WT/scripts/$n.ts"
    [ "$n" = text ] && want="$WT/scripts/lib/text.ts"
    got=$(PATH="$STUB:$PATH" "$WT/scripts/run" "$n" --probe a b 2>&1)
    res_ok=1
    case "$got" in *"<--no-env-file>"*) : ;; *) res_ok=0 ;; esac
    case "$got" in *"<--config=$WT/bunfig.toml>"*|*"<--config=$WT/scripts/../bunfig.toml>"*) : ;; *) res_ok=0 ;; esac
    case "$got" in *"<$want>"*) : ;; *) res_ok=0 ;; esac
    if [ "$res_ok" -eq 0 ]; then
      if [ "$resolve_bad" -lt 5 ]; then bad "AC1: entry mis-resolves $n: $got"; fi
      resolve_bad=$((resolve_bad + 1))
    fi
    case "$got" in *"<--probe> <a> <b>"*) : ;; *) bad "AC1: entry drops args for $n: $got"; resolve_bad=$((resolve_bad + 1)) ;; esac
  done
  [ "$resolve_bad" -eq 0 ] && ok "all 60 scripts resolve through the entry with both flags"
  rm -rf "$STUB"
  err=$(scripts/run no-such-script-zzz 2>&1); rc=$?
  if [ "$rc" -eq 2 ] && [ "$err" = "run: no such script: no-such-script-zzz" ]; then
    ok "unknown script exits 2 and names itself"
  else
    bad "unknown script: exit $rc, says: $err"
  fi
  err=$(scripts/run ../package 2>&1); rc=$?
  err2=$(scripts/run a/b 2>&1); rc2=$?
  if [ "$rc" -eq 2 ] && [ "$rc2" -eq 2 ]; then ok "path escape refused"; else bad "path escape: exits $rc/$rc2: $err / $err2"; fi
  err=$(scripts/run stage.sh 2>&1); rc=$?
  if [ "$rc" -eq 2 ]; then ok ".sh suffix is not resolved"; else bad "scripts/run stage.sh exits $rc"; fi
  scripts/run >/dev/null 2>&1; rc=$?
  if [ "$rc" -eq 2 ]; then ok "no arguments exits 2"; else bad "no arguments exits $rc"; fi
  out=$(scripts/run turnpikes --list 2>&1); rc=$?
  case "$out" in *style*) has_style=1 ;; *) has_style=0 ;; esac
  if [ "$rc" -eq 0 ] && [ "$has_style" -eq 1 ]; then ok "relative invocation runs end to end"; else bad "scripts/run turnpikes --list: exit $rc: $out"; fi
else
  bad "AC1: entry probes skipped, scripts/run is not executable"
fi

if [ -n "$runner_files" ]; then
  joined=$(for b in $runner_files; do cat "scripts/lib/$b"; done)
  if printf '%s' "$joined" | grep -q '"run"' && printf '%s' "$joined" | grep -q '\.sh'; then
    ok "runner holds both the entry branch and the wrapper branch"
  else
    bad "AC1: runner lacks a branch (needs the entry name and the wrapper suffix)"
  fi
  wired=0
  for b in $runner_files; do
    if grep -q "${b%.ts}" scripts/runs-watch.ts 2>/dev/null; then wired=1; fi
  done
  if [ "$wired" -eq 1 ]; then
    ok "runs-watch uses the runner module"
  else
    hard=$(grep -nE '"scripts", *"run"' scripts/runs-watch.ts 2>/dev/null | grep -vE 'HERE|TOOL|toolRoot|scriptsDir|import\.meta' | head -3)
    hard2=$(grep -nE '\$\{[^}]*\}/scripts/run' scripts/runs-watch.ts 2>/dev/null | grep -vE '\$\{(HERE|TOOL)\}' | head -3)
    if [ -n "$hard" ] || [ -n "$hard2" ]; then
      bad "AC1: runs-watch hardcodes the entry against pinned copies (old copies break):"; printf '%s\n' "$hard $hard2" | sed 's/^/         /'
    else
      ok "runs-watch wiring is by supervising command (coachman verifies by reading)"
    fi
  fi
else
  bad "AC1: runner branch checks skipped, no runner module found"
fi
for verb in 'leg launch' 'leg resume' 'leg retry' 'leg takeover' 'leg waiting'; do
  if grep -qF "$verb" skills/postmaster/postmaster.md 2>/dev/null; then
    ok "postmaster.md keeps \`$verb\`"
  else
    bad "AC1: postmaster.md lost \`$verb\`"
  fi
done
if grep -q 'POSTMASTER_LAUNCH_ROLE' scripts/host.ts 2>/dev/null; then
  assign_lines=$(grep -n 'POSTMASTER_LAUNCH_ROLE *=' scripts/host.ts | cut -d: -f1)
  role_ok=0
  for ln in $assign_lines; do
    lo=$((ln - 10)); [ "$lo" -lt 1 ] && lo=1
    window=$(sed -n "${lo},$((ln + 10))p" scripts/host.ts)
    if printf '%s' "$window" | grep -q '"run"' && printf '%s' "$window" | grep -q '"launch"'; then role_ok=1; fi
  done
  if [ "$role_ok" -eq 1 ]; then
    ok "launch-role check recognises the entry form"
  else
    helper=$(grep -nE 'function +[^ ]*[Ll]aunch[^ ]*([Rr]ole|[Cc]heck)|const +[^ =]*[Ll]aunch[^ =]*([Rr]ole|[Cc]heck) *=' scripts/host.ts | cut -d: -f1 | head -1)
    if [ -n "$helper" ] && sed -n "${helper},$((helper + 30))p" scripts/host.ts | grep -q '"run"' \
      && sed -n "${helper},$((helper + 30))p" scripts/host.ts | grep -q '"launch"'; then
      ok "launch-role check recognises the entry form (helper)"
    else
      bad "AC1: launch-role check does not recognise the entry form (coachman: verify by reading)"
    fi
  fi
else
  bad "AC1: host.ts lost the launch-role mechanism"
fi
if grep -q 'POSTMASTER_LAUNCH_ROLE' scripts/host-self-test.ts 2>/dev/null; then
  ok "host self-test keeps the launch-role control"
else
  bad "AC1: host self-test lost the launch-role control"
fi

echo "AC2: a script run inside a foreign repo loads neither its .env nor its bunfig"
FIX=$(mktemp -d)
git init -q -b main "$FIX" 2>/dev/null || bad "AC2: cannot git-init the scratch repo"
printf 'PM_ISOLATION_SENTINEL=from-env\n' >"$FIX/.env"
printf 'import { writeFileSync } from "node:fs";\nwriteFileSync("%s/marker.txt", process.env.PM_ISOLATION_SENTINEL ?? "unset");\n' "$FIX" >"$FIX/preload.ts"
printf 'preload = ["./preload.ts"]\n' >"$FIX/bunfig.toml"
if [ -x scripts/run ]; then
  rm -f "$FIX/marker.txt"
  out=$(cd "$FIX" && "$WT/scripts/run" turnpikes --list 2>&1); rc=$?
  case "$out" in *style*) has_style=1 ;; *) has_style=0 ;; esac
  if [ "$rc" -eq 0 ] && [ "$has_style" -eq 1 ] && [ ! -e "$FIX/marker.txt" ]; then
    ok "entry loads no preload (no marker), exit 0"
  else
    bad "entry from foreign repo: exit $rc, marker $([ -e "$FIX/marker.txt" ] && echo present || echo absent): $out"
  fi
  rm -f "$FIX/marker.txt"
  out=$(cd "$FIX" && bun "$WT/scripts/turnpikes.ts" --list 2>&1); rc=$?
  marker=$(cat "$FIX/marker.txt" 2>/dev/null)
  case "$out" in *style*) has_style=1 ;; *) has_style=0 ;; esac
  if [ "$rc" -eq 0 ] && [ "$has_style" -eq 1 ] && [ "$marker" = "from-env" ]; then
    ok "positive control: plain bun loads both files (marker holds from-env)"
  else
    bad "positive control failed: exit $rc, marker [$marker]: $out"
  fi
  COPY=$(mktemp -d)
  mkdir -p "$COPY/scripts"
  cp -p "$WT/scripts/run" "$COPY/scripts/run"
  chmod +x "$COPY/scripts/run"
  cp -p "$WT/bunfig.toml" "$COPY/bunfig.toml"
  printf 'console.log(process.env.PM_ISOLATION_SENTINEL ?? "unset");\n' >"$COPY/scripts/probe.ts"
  rm -f "$FIX/marker.txt"
  got=$(cd "$FIX" && "$COPY/scripts/run" probe 2>&1); rc=$?
  if [ "$rc" -eq 0 ] && [ "$got" = "unset" ] && [ ! -e "$FIX/marker.txt" ]; then
    ok ".env probe: entry prints unset, no marker"
  else
    bad ".env probe through entry: exit $rc, printed [$got], marker $([ -e "$FIX/marker.txt" ] && echo present || echo absent)"
  fi
  rm -f "$FIX/marker.txt"
  got=$(cd "$FIX" && bun "$COPY/scripts/probe.ts" 2>&1); rc=$?
  marker=$(cat "$FIX/marker.txt" 2>/dev/null)
  if [ "$rc" -eq 0 ] && [ "$got" = "from-env" ] && [ "$marker" = "from-env" ]; then
    ok ".env probe: plain bun prints from-env, marker holds from-env"
  else
    bad ".env probe plain bun: exit $rc, printed [$got], marker [$marker]"
  fi
  rm -rf "$COPY"
else
  bad "AC2: skipped, scripts/run is not executable"
fi
rm -rf "$FIX"

echo "AC3: skill-refs checks the new form, fix rewrites the old"
if [ -x scripts/run ]; then
  out=$(scripts/run skill-refs 2>&1); rc=$?
  if [ "$rc" -eq 0 ]; then ok "skill-refs checks the converted tree clean"; else bad "skill-refs exits $rc: $out"; fi
  T3=$(mktemp -d)
  printf 'Run scripts/host.sh today.\nRun <tool>/scripts/usage.sh today.\nThen scripts/run stage tomorrow.\n' >"$T3/planted.md"
  out=$(scripts/run skill-refs --fix "$T3/planted.md" 2>&1); rc=$?
  if [ "$rc" -eq 0 ] && grep -q '<tool>/scripts/run host' "$T3/planted.md" \
    && grep -q '<tool>/scripts/run usage' "$T3/planted.md" && grep -q '<tool>/scripts/run stage' "$T3/planted.md"; then
    ok "fix mode rewrites every old name the entry resolves"
  else
    bad "fix mode: exit $rc: $out: $(cat "$T3/planted.md")"
  fi
  out=$(scripts/run skill-refs "$T3/planted.md" 2>&1); rc=$?
  if [ "$rc" -eq 0 ]; then ok "fixed file checks clean"; else bad "fixed file checks exit $rc: $out"; fi
  before=$(cat "$T3/planted.md")
  scripts/run skill-refs --fix "$T3/planted.md" >/dev/null 2>&1
  if [ "$(cat "$T3/planted.md")" = "$before" ]; then ok "fix mode is idempotent"; else bad "second fix changed the file"; fi
  printf 'Run <tool>/scripts/run no-such-zzz today.\n' >"$T3/negative.md"
  out=$(scripts/run skill-refs "$T3/negative.md" 2>&1); rc=$?
  if [ "$rc" -eq 1 ]; then ok "unresolvable new-form reference fails the check"; else bad "negative check exits $rc: $out"; fi
  printf 'Run <tool>/scripts/host.sh today.\n' >"$T3/oldform.md"
  out=$(scripts/run skill-refs "$T3/oldform.md" 2>&1); rc=$?
  if [ "$rc" -eq 1 ]; then ok "old form through <tool> fails the check"; else bad "old-form check exits $rc: $out"; fi
  printf 'Run bun <tool>/scripts/stage.ts --list today.\n' >"$T3/direct.md"
  out=$(scripts/run skill-refs "$T3/direct.md" 2>&1); rc=$?
  if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q 'stage\.ts'; then
    ok "direct bun invocation fails the check and is named"
  else
    bad "direct-bun check exits $rc: $out"
  fi
  rm -rf "$T3"
  SCR=$(mktemp -d)
  rm -rf "$SCR"
  if git clone -q "$WT" "$SCR" 2>/dev/null && [ -x "$SCR/scripts/run" ]; then
    : >"$SCR/scripts/zz-old.sh"
    out=$(cd "$SCR" && scripts/run skill-refs 2>&1); rc=$?
    if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q 'zz-old\.sh'; then
      ok "a scripts/*.sh file fails the gate's check, naming it"
    else
      if [ ! -e "$SCR/node_modules" ]; then
        if [ -e "$WT/node_modules" ]; then ln -s "$WT/node_modules" "$SCR/node_modules"; else (cd "$SCR" && bun install >/dev/null 2>&1); fi
      fi
      out=$(cd "$SCR" && bun run check 2>&1); rc=$?
      if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q 'zz-old\.sh'; then
        ok "a scripts/*.sh file fails the gate, naming it"
      else
        bad "AC3: planted scripts/zz-old.sh not caught (gate exit $rc)"
      fi
    fi
  else
    bad "AC3: cannot clone the worktree for the no-wrapper check"
  fi
  rm -rf "$SCR"
else
  bad "AC3: skipped, scripts/run is not executable"
fi

echo "AC4: the gate passes on the converted tree"
BASE_SHA=0620bfc90eb32a35124279d9780df42174e6ccd9
BASE_FLAG=""
if [ -x scripts/run ]; then
  usage=$(scripts/run coachman-contract 2>&1)
  cands=$(printf '%s' "$usage" | grep -oE '\-\-[a-z0-9-]*[Bb][Aa][Ss][Ee][a-z0-9-]*' | sort -u)
  if printf '%s' "$usage" | grep -q 'run coachman-contract' \
    && ! printf '%s' "$usage" | grep -q '^usage: [a-z-]*\.sh'; then
    ok "detector usage names the entry form"
  else
    bad "AC4: detector usage is not the entry form: $usage"
  fi
  for c in $cands; do
    if grep -qF -- "$c" skills/postmaster/postmaster.md 2>/dev/null; then
      if [ -z "$BASE_FLAG" ]; then BASE_FLAG="$c"; else BASE_FLAG="AMBIGUOUS"; fi
    fi
  done
  if [ -z "$BASE_FLAG" ]; then
    bad "AC4: no BASE-mode flag of the detector reaches the runbook"
  elif [ "$BASE_FLAG" = "AMBIGUOUS" ]; then
    bad "AC4: several BASE-mode flags reach the runbook"
  else
    ok "BASE mode is $BASE_FLAG, called from the runbook"
  fi
  if grep -q 'Classify the final branch' skills/postmaster/postmaster.md 2>/dev/null; then
    ok "classify step survives in postmaster.md"
  else
    bad "AC4: postmaster.md lost the classify step"
  fi
  if [ -n "$BASE_FLAG" ] && [ "$BASE_FLAG" != "AMBIGUOUS" ]; then
    SHAPE=""
    out=$(scripts/run coachman-contract "$BASE_FLAG" . "$BASE_SHA" HEAD 2>&1); rc=$?
    if [ "$rc" -ne 2 ] || ! printf '%s' "$out" | grep -q 'usage:'; then SHAPE="repo base head"; else
      out2=$(scripts/run coachman-contract "$BASE_FLAG" "$BASE_SHA" HEAD 2>&1); rc2=$?
      if [ "$rc2" -ne 2 ] || ! printf '%s' "$out2" | grep -q 'usage:'; then SHAPE="base head"; else
        out3=$(scripts/run coachman-contract "$BASE_FLAG" --repo . "$BASE_SHA" HEAD 2>&1); rc3=$?
        if [ "$rc3" -ne 2 ] || ! printf '%s' "$out3" | grep -q 'usage:'; then SHAPE="--repo base head"; fi
      fi
    fi
    if [ -z "$SHAPE" ]; then
      bad "AC4: BASE mode takes no tested shape: $out"
    else
      ok "BASE mode takes ($SHAPE)"
      ls_before=$(ls -A)
      case "$SHAPE" in
        "repo base head") shape_args() { printf '%s' ". $BASE_SHA HEAD"; } ;;
        "base head") shape_args() { printf '%s' "$BASE_SHA HEAD"; } ;;
        *) shape_args() { printf '%s' "--repo . $BASE_SHA HEAD"; } ;;
      esac
      T1=$(mktemp -d); T2=$(mktemp -d)
      # shellcheck disable=SC2086
      out=$(TMPDIR="$T1" scripts/run coachman-contract "$BASE_FLAG" $(shape_args) 2>&1); rc=$?
      if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q 'yes scripts/host\.sh'; then
        ok "BASE mode on wrapper BASE exits 1 naming scripts/host.sh"
      else
        bad "AC4: BASE mode on 0620bfc exits $rc: $out"
      fi
      if [ -z "$(ls -A "$T1")" ]; then ok "BASE mode leaves no temp folder (wrapper BASE)"; else bad "AC4: temp leftovers: $(ls -A "$T1")"; fi
      case "$SHAPE" in
        "repo base head") shape_self() { printf '%s' ". HEAD HEAD"; } ;;
        "base head") shape_self() { printf '%s' "HEAD HEAD"; } ;;
        *) shape_self() { printf '%s' "--repo . HEAD HEAD"; } ;;
      esac
      # shellcheck disable=SC2086
      out=$(TMPDIR="$T2" scripts/run coachman-contract "$BASE_FLAG" $(shape_self) 2>&1); rc=$?
      if [ "$rc" -eq 0 ] && printf '%s' "$out" | grep -q 'no coachman contract change'; then
        ok "BASE mode on entry BASE exits 0 with no change"
      else
        bad "AC4: BASE mode on HEAD exits $rc: $out"
      fi
      if [ -z "$(ls -A "$T2")" ]; then ok "BASE mode leaves no temp folder (entry BASE)"; else bad "AC4: temp leftovers: $(ls -A "$T2")"; fi
      rm -rf "$T1" "$T2"
      ls_after=$(ls -A)
      if [ "$ls_before" = "$ls_after" ]; then ok "BASE mode leaves the repo root clean"; else bad "AC4: repo root changed: $(comm -13 <(printf '%s\n' "$ls_before") <(printf '%s\n' "$ls_after") | tr '\n' ' ')"; fi
    fi
  fi
  out=$(scripts/run coachman-contract --self-test 2>&1); rc=$?
  if [ "$rc" -eq 0 ]; then ok "contract self-test passes through the entry"; else bad "contract self-test exits $rc"; echo "$out" | tail -5 | sed 's/^/         /'; fi
else
  bad "AC4: self-test skipped, scripts/run is not executable"
fi
out=$(bun run check 2>&1); rc=$?
if [ "$rc" -eq 0 ]; then ok "bun run check passes"; else bad "bun run check exits $rc"; echo "$out" | tail -8 | sed 's/^/         /'; fi

echo "oracle-218: $ok passed, $bad failed"
[ "$bad" -eq 0 ]
