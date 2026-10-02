#!/usr/bin/env bash
# Blind oracle for #218: Every script runs as its TypeScript file, with no .sh wrapper left.
#
# Written by the leg-1 coachman from the ticket's acceptance criteria BEFORE reading any
# lane's diff or log, and committed on the ticket branch after the spec. Tests at the
# ticket's own interface: script paths, arguments, outputs and exits, package.json, and
# docs. Never a function shape, which is what the lanes were dispatched to choose.
#
# The form under test is the approved spec's: scripts/run <name> [args]. AC4's fixture
# run is the coachman's verification from the branch, not this file's: dispatching a run
# needs harnesses and hours, and this oracle stays a script run from the repo root.
#
#   ./oracle-218.sh        run every check; exit 0 when all pass, 1 otherwise
#
# Surface notes. The reference greps scan the ticket's named surfaces only, enumerated
# below, never the whole tree: the run's own WORKHORSE-SPEC.md, summaries and transcripts
# quote the ticket and its old commands, and raw/ holds trial evidence that stays as it
# was. scripts/skill-refs.test.ts and scripts/coachman-contract.test.ts may hold old-form
# strings as test data (the inputs fix mode rewrites, the detector paths the index parser
# accepts); their behavior is covered functionally here instead.

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

# The 51 wrappers on main at BASE, longest first so front-door-acceptance matches whole.
WRAPPERS='front-door-acceptance|parallel-runs-acceptance|verify-examples|verify-library|review-decide|review-findings|spec-review-link|coachman-contract|discover-project|handoff-check|project-settings|spec-decisions|style-findings|wait-for-markers|check-target|cut-scratch|export-session|find-projects|front-door|probe-harnesses|probe-trackers|review-forms|review-round|runs-status|ticket-check|tool-faults|tracker-kind|turnpikes|verify-journey|view-stream|fixture|github|landing|launch|link-skills|local|log-action|plane|reviewers|run-log|run-meta|run-times|runs-watch|setup|skill-refs|spec-session|stage|text|host|verify|wiki-lint'
# The 6 runnable .ts files that never had a wrapper (host-self-test.ts is import-only).
UNWRAPPED='clean-checkout fixture-lanes run-clash summary-evidence synthesis-shares usage'
NAMES='check-target coachman-contract cut-scratch discover-project export-session find-projects fixture front-door front-door-acceptance github handoff-check host landing launch link-skills local log-action parallel-runs-acceptance plane probe-harnesses probe-trackers project-settings review-decide review-findings review-forms review-round reviewers run-log run-meta run-times runs-status runs-watch setup skill-refs spec-decisions spec-review-link spec-session stage style-findings text ticket-check tool-faults tracker-kind turnpikes verify verify-examples verify-journey verify-library view-stream wait-for-markers wiki-lint clean-checkout fixture-lanes run-clash summary-evidence synthesis-shares usage'

SURFACES=(AGENTS.md README.md skills package.json .postmaster/project.toml project.example.toml config.example.toml fixtures docs/coachman-contract.toml scripts lint types)
for s in "${SURFACES[@]}"; do
  [ -e "$s" ] || bad "AC1: surface missing: $s"
done

echo "AC1: no scripts/*.sh remains, one form everywhere"
tracked=$(git ls-files 'scripts/*.sh' 2>/dev/null | tr '\n' ' ')
if [ -z "$tracked" ]; then ok "no tracked scripts/*.sh"; else bad "tracked wrappers remain: $tracked"; fi
if compgen -G "scripts/*.sh" >/dev/null; then
  bad "scripts/*.sh files present on disk: $(compgen -G 'scripts/*.sh' | tr '\n' ' ')"
else
  ok "no scripts/*.sh on disk"
fi
if [ -x scripts/run ]; then ok "scripts/run exists and is executable"; else bad "scripts/run missing or not executable"; fi

G1="((<tool>/|<rt>/)?scripts/)($WRAPPERS)\.sh([^A-Za-z0-9_-]|\$)"
hits=$(grep -rnE -m5 --exclude=skill-refs.test.ts --exclude=coachman-contract.test.ts -e "$G1" "${SURFACES[@]}" 2>/dev/null); rc=$?
if [ "$rc" -eq 2 ]; then bad "AC1: reference pattern G1 is invalid"; elif [ -z "$hits" ]; then ok "no path-shaped old reference on the named surfaces"; else bad "old path-shaped references:"; echo "$hits" | sed 's/^/         /'; fi
G2="(^|[^A-Za-z0-9_-])($WRAPPERS)\.sh([^A-Za-z0-9_-]|\$)"
hits=$(grep -rnE -m20 --exclude=skill-refs.test.ts --exclude=coachman-contract.test.ts -e "$G2" "${SURFACES[@]}" 2>/dev/null | grep -vE -e "$G1" | head -5)
if [ -z "$hits" ]; then ok "no other old-form wrapper token on the named surfaces"; else bad "old-form wrapper tokens:"; echo "$hits" | sed 's/^/         /'; fi
G3="bun.*scripts/[A-Za-z0-9_-]+\.ts"
hits=$(grep -rnE -m5 --exclude=skill-refs.test.ts --exclude=coachman-contract.test.ts -e "$G3" AGENTS.md README.md skills scripts fixtures 2>/dev/null); rc=$?
if [ "$rc" -eq 2 ]; then bad "AC1: reference pattern G3 is invalid"; elif [ -z "$hits" ]; then ok "no bare-bun script invocation survives"; else bad "bare-bun invocations:"; echo "$hits" | sed 's/^/         /'; fi

if grep -q '"check": "[^"]*scripts/run skill-refs[^"]*scripts/run wiki-lint' package.json 2>/dev/null \
  && ! grep -q '"check": "[^"]*\.sh' package.json 2>/dev/null; then
  ok "package.json check runs skill-refs and wiki-lint through the entry"
else
  bad "package.json check does not use the entry form"
fi
if grep -q "command = '''scripts/run coachman-contract --self-test'''" .postmaster/project.toml 2>/dev/null; then
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

if [ -x scripts/run ]; then
  STUB=$(mktemp -d)
  printf '#!/usr/bin/env bash\nprintf "STUB-ARGV:"; printf " <%%s>" "$@"; printf "\\n"\n' >"$STUB/bun"
  chmod +x "$STUB/bun"
  resolve_bad=0
  for n in $NAMES; do
    want="$WT/scripts/$n.ts"
    [ "$n" = text ] && want="$WT/scripts/lib/text.ts"
    got=$(PATH="$STUB:$PATH" "$WT/scripts/run" "$n" --probe a b 2>&1)
    case "$got" in
      *"<--no-env-file>"*"<--config=$WT/bunfig.toml>"*"<$want>"*) : ;;
      *)
        if [ "$resolve_bad" -lt 5 ]; then bad "AC1: entry mis-resolves $n: $got"; fi
        resolve_bad=$((resolve_bad + 1))
        ;;
    esac
    case "$got" in *"<--probe> <a> <b>"*) : ;; *) bad "AC1: entry drops args for $n: $got"; resolve_bad=$((resolve_bad + 1)) ;; esac
  done
  [ "$resolve_bad" -eq 0 ] && ok "all 57 scripts resolve through the entry with both flags"
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

echo "AC2: a script run inside a foreign repo loads neither its .env nor its bunfig"
FIX=$(mktemp -d)
printf 'ORACLE218_SENTINEL=target-env-loaded\n' >"$FIX/.env"
printf 'import { writeFileSync } from "node:fs";\nwriteFileSync("%s/marker.txt", "preload-fired\\n");\n' "$FIX" >"$FIX/preload.ts"
printf 'preload = ["./preload.ts"]\n' >"$FIX/bunfig.toml"
if [ -x scripts/run ]; then
  rm -f "$FIX/marker.txt"
  out=$(cd "$FIX" && "$WT/scripts/run" turnpikes --list 2>&1); rc=$?
  if [ "$rc" -eq 0 ] && [ ! -e "$FIX/marker.txt" ]; then
    ok "entry loads no preload (no marker), exit 0"
  else
    bad "entry from foreign repo: exit $rc, marker $([ -e "$FIX/marker.txt" ] && echo present || echo absent): $out"
  fi
  rm -f "$FIX/marker.txt"
  out=$(cd "$FIX" && bun "$WT/scripts/turnpikes.ts" --list 2>&1); rc=$?
  if [ "$rc" -eq 0 ] && [ -e "$FIX/marker.txt" ]; then
    ok "positive control: plain bun writes the marker"
  else
    bad "positive control failed: exit $rc, marker $([ -e "$FIX/marker.txt" ] && echo present || echo absent): $out"
  fi
  got=$(cd "$FIX" && bun --no-env-file -e 'console.log(process.env.ORACLE218_SENTINEL ?? "absent")' 2>&1)
  got_plain=$(cd "$FIX" && bun -e 'console.log(process.env.ORACLE218_SENTINEL ?? "absent")' 2>&1)
  if [ "$got" = "absent" ] && [ "$got_plain" = "target-env-loaded" ]; then
    ok "--no-env-file (which the entry passes) stops .env loading"
  else
    bad "--no-env-file semantics: flagged=$got plain=$got_plain"
  fi
else
  bad "AC2: skipped, scripts/run is not executable"
fi
rm -rf "$FIX"

echo "AC3: skill-refs checks the new form, fix rewrites the old"
if [ -x scripts/run ]; then
  out=$(scripts/run skill-refs 2>&1); rc=$?
  if [ "$rc" -eq 0 ]; then ok "skill-refs checks the converted tree clean"; else bad "skill-refs exits $rc: $out"; fi
  T3=$(mktemp -d)
  printf 'Run scripts/host.sh today.\nThen scripts/run stage tomorrow.\n' >"$T3/planted.md"
  out=$(scripts/run skill-refs --fix "$T3/planted.md" 2>&1); rc=$?
  if [ "$rc" -eq 0 ] && grep -q '<tool>/scripts/run host' "$T3/planted.md" && grep -q '<tool>/scripts/run stage' "$T3/planted.md"; then
    ok "fix mode rewrites the old .sh form"
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
  rm -rf "$T3"
else
  bad "AC3: skipped, scripts/run is not executable"
fi

echo "AC4: the gate passes on the converted tree"
if [ -x scripts/run ]; then
  out=$(scripts/run coachman-contract --self-test 2>&1); rc=$?
  if [ "$rc" -eq 0 ]; then ok "contract self-test passes through the entry"; else bad "contract self-test exits $rc"; echo "$out" | tail -5 | sed 's/^/         /'; fi
else
  bad "AC4: self-test skipped, scripts/run is not executable"
fi
out=$(bun run check 2>&1); rc=$?
if [ "$rc" -eq 0 ]; then ok "bun run check passes"; else bad "bun run check exits $rc"; echo "$out" | tail -8 | sed 's/^/         /'; fi

echo "oracle-218: $ok passed, $bad failed"
[ "$bad" -eq 0 ]
