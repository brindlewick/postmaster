#!/usr/bin/env bash
# Blind oracle for #251: A booking clerk prepares every ticket that is not ready to run.
#
# Written by the leg-1 coachman from the ticket's acceptance criteria BEFORE
# reading any lane's diff or log, and committed on the ticket branch before any
# synthesis code. Tests at the ticket's own interface: script CLIs, exit codes,
# runbook words, file presence and absence. Never a function shape, which is
# what the lanes were dispatched to choose.
#
# The ticket leaves the new scripts' file names to the lanes, so this oracle
# discovers them by pinned anchors and verifies each by behavior before
# trusting it:
#   readiness: the invocation postmaster.md Stage B names, else any new script
#     whose help speaks of readiness; trusted only when it exits 0 on the ready
#     ticket and 2 on the unready one.
#   premises: the script docs/coachman-contract.toml registers for premises,
#     else any new script whose help speaks of premises; trusted only when it
#     answers `same` on the untouched fixture.
# Verbs of those scripts come from their --help. Anything undiscoverable is a
# loud SKIP, never a silent pass and never a FAIL: the coachman judges those
# from the diff at harvest.
#
# Usage: ./oracle-251.sh   (runs from the repo root)
# Exit 0 when every acceptance criterion holds, 1 otherwise.
set -uo pipefail
ROOT=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
cd "$ROOT" || exit 1
BASE=ede70e22b13ea48da0d574c214f72229b71dadf3 # this run's base == the ticket's Verified-at commit

PASS=0; FAIL=0; SKIP=0
pass() { PASS=$((PASS + 1)); echo "PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "FAIL: $1"; }
skip() { SKIP=$((SKIP + 1)); echo "SKIP: $1"; }

SCR=$(mktemp -d /tmp/oracle-251.XXXXXXXX)
cleanup() { rm -rf "$SCR"; }
trap cleanup EXIT

export HOME=$SCR/home
mkdir -p "$HOME"
export GIT_AUTHOR_NAME=oracle GIT_AUTHOR_EMAIL=oracle@example.invalid
export GIT_COMMITTER_NAME=oracle GIT_COMMITTER_EMAIL=oracle@example.invalid

# --- the test store: tickets 1..4 per the ticket's Checks preamble ---
STORE=$SCR/store
mkdir -p "$STORE" && git -C "$STORE" init -q
scripts/local.sh "$STORE" store init >/dev/null
# (a): a minimal two-part body passing ticket-check and ticket-parts --final at BASE.
cat > "$SCR/a.md" <<'TICKET'
## Problem / feature

The list view shows entries in whatever order they arrive. When this is done the list shows entries sorted by name.

## Acceptance criteria

1. The list shows its entries sorted by name.

## Decisions

- **D1 (proposed)** Sorting ignores letter case. Why: users expect mixed-case names together. Instead of: byte order, which splits them.

## Out of scope

- Grouping entries by kind.

## Direction

Linux and macOS. None: any approach that meets the criterion.

## Turnpikes

default

## For the agents

*Everything above is what the user signed off. This part follows from it and adds nothing to it.*

### Checks

- **C1** `list --sort name` on three entries out of order → names in case-blind order, exit 0. **At the base:** entries arrive unsorted.

### Technical notes

- The list renders in `list.ts`, sorted with a case-blind comparator. (C1, D1)

### Verified at ede70e2

- `list.ts` exists and renders entries unsorted.
TICKET
# (c): the one-part fixture ticket `remove` as it is at BASE (the lanes rewrite it).
if ! git show "$BASE:fixtures/tickets/remove/ticket.md" > "$SCR/c.md" 2>/dev/null; then
  echo "BASE $BASE not in this clone; store-dependent groups cannot run"
  HAVE_STORE=0
else
  HAVE_STORE=1
  { echo "DRAFT: still being written"; echo; cat "$SCR/a.md"; } > "$SCR/d.md"
  scripts/local.sh "$STORE" create "Sorted list" "$SCR/a.md" >/dev/null
  scripts/local.sh "$STORE" create "Fix the list" "$SCR/a.md" >/dev/null
  scripts/local.sh "$STORE" create "Remove" "$SCR/c.md" >/dev/null
  scripts/local.sh "$STORE" create "Draft list" "$SCR/d.md" >/dev/null
  python3 - "$STORE" <<'PY'
import json, sys
store = sys.argv[1]
for n in (1, 3, 4):
    p = f"{store}/.git/postmaster/tickets/{n}.json"
    rec = json.load(open(p))
    rec["labels"] = ["ready"]
    json.dump(rec, open(p, "w"), indent=2)
PY
fi
labels_of() { python3 -c "import json,sys;print(' '.join(json.load(open(sys.argv[1]))['labels']))" "$STORE/.git/postmaster/tickets/$1.json"; }

# --- AC1: the role is the booking clerk everywhere ---
if [ "$(grep -rniE "ticket.session" AGENTS.md README.md skills scripts docs config.example.toml | wc -l)" -eq 0 ]; then
  pass "AC1 no ticket.session mention remains"
else
  fail "AC1 ticket.session mentions remain:"; grep -rniE "ticket.session" AGENTS.md README.md skills scripts docs config.example.toml | head -12
fi
[ "$(grep -cE '^\|.*[Bb]ooking clerk' AGENTS.md)" -ge 1 ] && [ "$(grep -cE '^\|.*[Bb]ooking clerk' README.md)" -ge 1 ] \
  && pass "AC1 both role tables have a clerk row" \
  || fail "AC1 a role table has no clerk row"
if [ -d skills/clerk ] && [ "$(grep -rli 'booking clerk' skills/clerk/ | wc -l)" -ge 2 ]; then
  pass "AC1 the clerk skill names the booking clerk"
else
  fail "AC1 skills/clerk/ missing or does not name the booking clerk"
fi

# --- AC2: setup asks for the clerk, launch resolves it ---
KEYS=$(scripts/setup.sh --keys)
for k in clerk.harness clerk.model 'clerk.effort?' 'clerk.env_file?'; do
  printf '%s\n' "$KEYS" | grep -q "^$k" && pass "AC2 --keys lists $k" || fail "AC2 --keys lacks $k"
done
printf '%s\n' "$KEYS" | grep -q '^postmaster\.harness' && KH=$(printf '%s\n' "$KEYS" | grep -n '^clerk\.harness' | cut -d: -f1) && \
  PH=$(printf '%s\n' "$KEYS" | grep -n '^postmaster\.harness' | cut -d: -f1) && [ -n "$KH" ] && [ "$KH" -gt "$PH" ] \
  && pass "AC2 clerk keys sit beside the postmaster's" || fail "AC2 clerk keys not beside the postmaster's"
cat > "$SCR/answers-clerk.txt" <<'EOF'
lanes=luna,mimo
lane.luna.harness=codex
lane.luna.model=gpt-6-luna
lane.luna.effort=max
lane.mimo.harness=mimo
lane.mimo.model=xiaomi-token-plan-sgp/mimo-v2.6-pro
lane.mimo.effort=high
coachman.harness=muse
coachman.model=muse-spark-x
fallback.harness=claude
fallback.model=claude-fallback-y
postmaster.harness=pi
postmaster.model=pi-postmaster-z
clerk.harness=claude
clerk.model=claude-clerk-w
EOF
grep -v '^clerk\.' "$SCR/answers-clerk.txt" > "$SCR/answers-noclerk.txt"
sed 's/^clerk\.harness=claude$/clerk.harness=grok/' "$SCR/answers-clerk.txt" > "$SCR/answers-badharness.txt"
timeout 60 scripts/setup.sh --answers "$SCR/answers-clerk.txt" --dry-run </dev/null >"$SCR/dry-clerk.out" 2>&1; RC=$?
if [ $RC -eq 0 ] && grep -q '^clerk = { harness = "claude", model = "claude-clerk-w"' "$SCR/dry-clerk.out"; then
  pass "AC2 dry-run writes the clerk under [team] in the postmaster's form"
else
  fail "AC2 dry-run with a clerk on claude (exit $RC) lacks the clerk line"
fi
timeout 60 scripts/setup.sh --answers "$SCR/answers-badharness.txt" --dry-run </dev/null >"$SCR/dry-bad.out" 2>&1; RC=$?
[ $RC -eq 1 ] && grep -qi clerk "$SCR/dry-bad.out" \
  && pass "AC2 a clerk harness not on PATH exits 1 naming it" \
  || fail "AC2 bad clerk harness: exit $RC, must be 1 naming the clerk"
timeout 60 scripts/setup.sh --answers "$SCR/answers-noclerk.txt" --dry-run </dev/null >"$SCR/dry-no.out" 2>&1; RC=$?
[ $RC -eq 1 ] && grep -qi clerk "$SCR/dry-no.out" \
  && pass "AC2 no clerk harness or model exits 1 naming it" \
  || fail "AC2 missing clerk keys: exit $RC, must be 1 naming the clerk"
if grep -qi clerk scripts/setup.sh scripts/setup.ts 2>/dev/null; then
  pass "AC2 setup has a clerk path (adding verb judged from the diff)"
else
  fail "AC2 setup mentions no clerk anywhere"
fi
skip "AC2 the adding verb's behavior: its arguments are the lane's choice"
printf '[team]\nclerk = { harness = "claude", model = "m1" }\n' > "$SCR/config-clerk.toml"
printf '[team]\npostmaster = { harness = "claude", model = "m1" }\n' > "$SCR/config-noclerk.toml"
if POSTMASTER_CONFIG=$SCR/config-clerk.toml timeout 60 scripts/launch.sh form clerk >"$SCR/form-clerk.out" 2>&1; then
  grep -q claude "$SCR/form-clerk.out" && pass "AC2 launch form clerk prints the clerk's command" \
    || fail "AC2 launch form clerk names no claude command"
else
  fail "AC2 launch form clerk exits nonzero on a config with team.clerk"
fi
POSTMASTER_CONFIG=$SCR/config-noclerk.toml timeout 60 scripts/launch.sh form clerk >"$SCR/form-no.out" 2>&1; RC=$?
[ $RC -eq 1 ] && grep -qi clerk "$SCR/form-no.out" \
  && pass "AC2 launch form clerk exits 1 naming it with no team.clerk" \
  || fail "AC2 launch form clerk without team.clerk: exit $RC, must be 1 naming it"

# --- AC3: the readiness script (discovered, then behavior-verified) ---
READY=""
if [ "$HAVE_STORE" -eq 1 ]; then
  CANDS=$(grep -hi 'readiness' skills/postmaster/postmaster.md 2>/dev/null | grep -oE 'scripts/[a-z0-9-]+\.sh' | sort -u)
  if [ -z "$CANDS" ]; then
    if git cat-file -e "$BASE:scripts/launch.sh" 2>/dev/null; then
      NEWSCRIPTS=$(comm -23 <(cd scripts && ls *.sh | sort) <(git ls-tree "$BASE" scripts/ --name-only | xargs -n1 basename | sort))
    else
      NEWSCRIPTS=$(cd scripts && ls *.sh)
    fi
    for s in $NEWSCRIPTS; do
      timeout 20 scripts/"$s" --help </dev/null >"$SCR/help-$s.out" 2>&1
      grep -qiE 'readiness|ticket[^a-z]*ready|ready[^a-z]*(ticket|mark|label)' "$SCR/help-$s.out" 2>/dev/null && CANDS="$CANDS scripts/$s"
    done
  fi
  for c in $CANDS; do
    timeout 60 "$c" "$STORE" 1 </dev/null >"$SCR/ready-a.out" 2>&1; RA=$?
    timeout 60 "$c" "$STORE" 2 </dev/null >"$SCR/ready-b.out" 2>&1; RB=$?
    if [ "$RA" -eq 0 ] && [ "$RB" -eq 2 ]; then READY=$c; break; fi
  done
fi
if [ -z "$READY" ]; then
  [ "$HAVE_STORE" -eq 1 ] && fail "AC3 no readiness script found (runbook names none, no new script exits 0/2 on tickets 1/2)" \
    || skip "AC3 no BASE in this clone; readiness undiscoverable"
else
  pass "AC3 readiness script is $READY (exit 0 on the ready ticket, 2 on the unready one)"
  grep -qiE 'ready|label|mark' "$SCR/ready-b.out" \
    && pass "AC3 the unready ticket's reason names the missing mark" \
    || fail "AC3 ticket 2 names no missing mark"
  timeout 60 "$READY" "$STORE" 3 </dev/null >"$SCR/ready-c.out" 2>&1; RC3=$?
  [ "$RC3" -eq 2 ] && grep -qiE 'parts|for the agents|agents' "$SCR/ready-c.out" \
    && pass "AC3 the one-part ticket's reason names the parts finding" \
    || fail "AC3 ticket 3: exit $RC3, must be 2 naming the parts finding"
  timeout 60 "$READY" "$STORE" 4 </dev/null >"$SCR/ready-d.out" 2>&1; RC4=$?
  [ "$RC4" -eq 2 ] && grep -qi 'draft' "$SCR/ready-d.out" \
    && pass "AC3 the draft ticket's reason names the draft line" \
    || fail "AC3 ticket 4: exit $RC4, must be 2 naming the draft line"
  { echo "DRAFT: still being written"; echo; cat "$SCR/c.md"; } > "$SCR/e.md"
  EID=$(scripts/local.sh "$STORE" create "Bad all ways" "$SCR/e.md")
  timeout 60 "$READY" "$STORE" "$EID" </dev/null >"$SCR/ready-e.out" 2>&1; RC5=$?
  if [ "$RC5" -eq 2 ] && grep -qi 'draft' "$SCR/ready-e.out" && grep -qiE 'parts|for the agents' "$SCR/ready-e.out" \
      && grep -qiE 'ready|label|mark' "$SCR/ready-e.out"; then
    pass "AC3 a ticket failing several ways names every reason"
  else
    fail "AC3 ticket 5: exit $RC5, must be 2 naming the draft, parts and mark reasons"
  fi
  timeout 60 "$READY" "$STORE" 9999 </dev/null >"$SCR/ready-unknown.out" 2>&1; RCU=$?
  [ "$RCU" -eq 1 ] && pass "AC3 an unknown id exits 1" || fail "AC3 unknown id: exit $RCU, must be 1"
  for ad in github plane local; do
    timeout 20 scripts/$ad.sh "$STORE" </dev/null >"$SCR/usage-$ad.out" 2>&1
    grep -qi 'label' "$SCR/usage-$ad.out" \
      && pass "AC3 the $ad adapter has label verbs" \
      || fail "AC3 the $ad adapter shows no label verb"
  done
  for ad in github plane; do
    grep -qi 'title' "$SCR/usage-$ad.out" \
      && pass "AC3 the $ad adapter has a title verb" \
      || fail "AC3 the $ad adapter shows no title verb"
  done
  grep -qi 'title' "$SCR/usage-local.out" \
    && pass "AC3 control: the local adapter keeps its title verb" \
    || fail "AC3 control: the local adapter lost its title verb"
  skip "AC3 github and plane results through each adapter's test double: lane-internal seams"
  LABELFLAG=$(timeout 20 "$READY" --help </dev/null 2>&1 | grep -oiE '\-\-[a-z-]*label[a-z-]*' | head -1)
  if [ -n "$LABELFLAG" ]; then
    timeout 60 "$READY" --body "$SCR/a.md" "$LABELFLAG" ready </dev/null >"$SCR/ready-other-a.out" 2>&1; RBO=$?
    timeout 60 "$READY" --body "$SCR/a.md" "$LABELFLAG" '' </dev/null >"$SCR/ready-other-b.out" 2>&1; RBU=$?
    [ "$RBO" -eq 0 ] && [ "$RBU" -eq 2 ] \
      && pass "AC3 kind=other: body file plus label list reads ready/unready" \
      || fail "AC3 kind=other: exits $RBO/$RBU, must be 0/2"
  else
    skip "AC3 kind=other body-plus-labels: no label flag in $READY --help"
  fi
fi

# --- AC4: the clerk marks a ticket ready (marking verb discovered from --help) ---
MARK=""
if [ -n "$READY" ]; then
  for v in $(timeout 20 "$READY" --help </dev/null 2>&1 | grep -oiE '\b(mark|mark-ready|add-label|label)\b' | sort -u); do
    timeout 20 "$READY" "$v" --help </dev/null >"$SCR/markhelp-$v.out" 2>&1
    grep -qi 'label' "$SCR/markhelp-$v.out" 2>/dev/null && MARK=$v && break
  done
  [ -z "$MARK" ] && for v in $(timeout 20 "$READY" --help </dev/null 2>&1 | grep -oiE '\b(mark|mark-ready|add-label|label)\b' | sort -u); do
    MARK=$v; break
  done
fi
if [ -z "$MARK" ]; then
  skip "AC4 the marking verb: undiscoverable from ${READY:-no-readiness-script} --help"
else
  pass "AC4 marking verb is $READY $MARK"
  BEFORE_C=$(labels_of 3)
  timeout 60 "$READY" "$MARK" "$STORE" 3 </dev/null >"$SCR/mark-c.out" 2>&1; MC=$?
  [ "$MC" -eq 2 ] && [ "$(labels_of 3)" = "$BEFORE_C" ] \
    && pass "AC4 marking the one-part ticket exits 2, no label added" \
    || fail "AC4 marking ticket 3: exit $MC, must be 2 with labels unchanged"
  MID=$(scripts/local.sh "$STORE" create "To mark" "$SCR/a.md")
  timeout 60 "$READY" "$MARK" "$STORE" "$MID" </dev/null >"$SCR/mark-mid.out" 2>&1; MM=$?
  if [ "$MM" -eq 0 ] && [ "$(labels_of "$MID")" = "ready" ]; then
    pass "AC4 marking a passing ticket adds the label"
    timeout 60 "$READY" "$STORE" "$MID" </dev/null >"$SCR/ready-marked.out" 2>&1 \
      && pass "AC4 the marked ticket then reads ready" \
      || fail "AC4 the marked ticket does not read ready"
    if grep -rq 'turnpikes:' "$STORE/.postmaster/" 2>/dev/null; then
      pass "AC4 the project's ledger has the turnpikes note"
    else
      fail "AC4 no turnpikes note under $STORE/.postmaster/"
    fi
  else
    fail "AC4 marking ticket $MID: exit $MM, must be 0 adding the label"
  fi
fi
if [ -d skills/clerk ]; then
  grep -rqi 'label' skills/clerk/ && pass "AC4 the clerk runbook marks with a label" || fail "AC4 the clerk runbook names no label"
  grep -rqi 'note' skills/clerk/ && grep -rqi 'turnpikes' skills/clerk/ \
    && pass "AC4 the clerk runbook logs the turnpikes note" || fail "AC4 the clerk runbook names no turnpikes note"
fi
skip "AC4 the interactive sign-off and the label coming off a reopened ticket: needs a clerk session"

# --- AC5/AC6/AC7: the postmaster starts clerks and never dispatches unready tickets ---
PM=skills/postmaster/postmaster.md
grep -qi 'readiness' $PM && grep -i 'readiness' $PM | grep -q 'scripts/' \
  && pass "AC5 Stage B runs the readiness script" \
  || fail "AC5 postmaster.md names no readiness script invocation"
grep -qi 'clerk' $PM && [ "$(grep -ci 'clerk' $PM)" -ge 3 ] \
  && pass "AC5 the postmaster starts a clerk session for an unready ticket" \
  || fail "AC5 postmaster.md does not start a clerk"
grep -i 'never dispatch' $PM | grep -qi 'readiness' \
  && pass "AC6 the hard rule names the readiness script" \
  || fail "AC6 the hard rule does not name the readiness script"
grep -qiE 'ready[- ]marker' $PM \
  && pass "AC7 a ready marker wakes the postmaster to dispatch" \
  || fail "AC7 postmaster.md names no ready marker"
grep -i 'ready' scripts/runs-watch.ts | grep -vi 'spec-review-ready' | grep -qwi 'ready' \
  && pass "AC7 the watcher wakes on the ready marker" \
  || fail "AC7 runs-watch.ts knows no ready marker"
skip "AC5/AC6/AC7 clerk sessions, headless refusal and pickup: needs a postmaster and a model"

# --- AC8: the clerk opens in a new tab of the project's space ---
grep -rn 'host\.sh spawn' skills/ | grep -q '\-\-label' \
  && pass "AC8 control: host.sh spawn takes --label" \
  || fail "AC8 control: no spawn --label form in the skills"
[ -d skills/clerk ] && grep -rqi 'spawn' skills/clerk/ && grep -rq '\-\-label' skills/clerk/ \
  && pass "AC8 the clerk's launch spawns with a label" \
  || fail "AC8 the clerk's launch names no spawn with a label"
skip "AC8 the live tab labelled '#2, Fix the list': needs Herdr and a model"

# --- AC9: one clerk skill for both ways in ---
[ -f skills/clerk/SKILL.md ] && pass "AC9 skills/clerk/SKILL.md exists" || fail "AC9 no skills/clerk/SKILL.md"
[ -d skills/clerk ] && [ "$(ls skills/clerk/*.md 2>/dev/null | wc -l)" -ge 3 ] \
  && pass "AC9 the runbook and the template moved into the clerk's folder" \
  || fail "AC9 the clerk's folder lacks the runbook or the template"
timeout 60 scripts/link-skills.sh --dry-run </dev/null 2>&1 | grep -qi clerk \
  && pass "AC9 link-skills finds the clerk skill" \
  || fail "AC9 link-skills finds no clerk skill"
grep -qF 'skills/clerk/SKILL.md' $PM \
  && pass "AC9 the postmaster's start prompt names the skill's file by path" \
  || fail "AC9 the postmaster names no clerk skill path"
grep -qi clerk skills/postmaster/SKILL.md \
  && pass "AC9 the front door says the clerk has its own skill" \
  || fail "AC9 SKILL.md still says there is no per-ticket skill"
skip "AC9 the user's own start writing the same brief: needs a clerk session"

# --- AC10: the clerk tests each draft on a fresh reader ---
if [ -d skills/clerk ]; then
  if grep -rqiE 'agent tool|model: sonnet' skills/clerk/; then
    fail "AC10 the clerk runbook still names a harness's own tool"
  else
    pass "AC10 the clerk runbook names no harness's own tool"
  fi
  grep -rqiE 'host\.sh run|headless' skills/clerk/ \
    && pass "AC10 the fresh reader runs headless like a lane" \
    || fail "AC10 the clerk runbook names no headless lane reader"
fi
skip "AC10 the reader's checks and guesses: needs a model on another lane"

# --- AC11/AC12: no coachman spec, no spec-review pause ---
CM=skills/postmaster/coachman.md
[ "$(grep -c '### Checks' $CM)" -ge 1 ] \
  && pass "AC11 the workhorse brief names the ticket's ### Checks" \
  || fail "AC11 coachman.md names no ### Checks"
grep -q 'Showing each criterion' $CM \
  && fail "AC11 coachman.md still names Showing each criterion" \
  || pass "AC11 no Showing each criterion in coachman.md"
skip "AC11 the fixture run's spec-free history: needs a fixture run"
if scripts/stage.sh --list | grep -qx 'planning'; then
  fail "AC12 stage.sh --list still has planning"
else
  pass "AC12 stage.sh --list has no planning"
fi
scripts/stage.sh --list | grep -qx 'synthesis' && scripts/stage.sh --list | grep -qx 'workhorses-running' \
  && pass "AC12 control: the other stages are still listed" \
  || fail "AC12 control: stage.sh --list lost stages"
skip "AC12 the run's stageless history: needs a fixture run"

# --- AC13: the premises check before any workhorse starts ---
PREM=$SCR/prem
mkdir -p "$PREM/docs" && git -C "$PREM" init -q
{ for i in $(seq 1 30); do echo "filler line $i"; done; } > "$PREM/docs/a.md"
sed -i '5s/.*/THE CITED MARKER LINE/' "$PREM/docs/a.md"
echo "untouched helper" > "$PREM/docs/b.md"
git -C "$PREM" add -A && git -C "$PREM" commit -qm seed
V=$(git -C "$PREM" rev-parse HEAD)
prem_body() { # $1 = verified-commit ; writes the ticket body citing a.md L5 and b.md L1
  cat > "$SCR/prem-body-$2.md" <<TICKET
## Problem / feature

The list view shows entries in whatever order they arrive.

## Acceptance criteria

1. The list shows its entries sorted by name.

## Turnpikes

default

## For the agents

### Checks

- **C1** x → y. **At the base:** z.

### Technical notes

- The list renders per [THE CITED MARKER LINE](https://github.com/example/fixture/blob/$1/docs/a.md#L5-L5), with [untouched helper](https://github.com/example/fixture/blob/$1/docs/b.md#L1-L1). (C1)

### Verified at $1

- \`docs/a.md\` holds the list as cited.
TICKET
}
prem_body "$V" ok
prem_body 0000000000000000000000000000000000000000 bad
git -C "$PREM" checkout -qb moved "$V" >/dev/null
for i in $(seq 1 10); do sed -i '1i inserted line' "$PREM/docs/a.md"; done
git -C "$PREM" commit -qam moved
MOVED=$(git -C "$PREM" rev-parse HEAD)
git -C "$PREM" checkout -qb changed "$V" >/dev/null
sed -i '5s/.*/THE CITED MARKER LINE, EDITED/' "$PREM/docs/a.md"
git -C "$PREM" commit -qam changed
CHANGED=$(git -C "$PREM" rev-parse HEAD)
git -C "$PREM" checkout -qb missing "$V" >/dev/null
git -C "$PREM" rm -q docs/a.md && git -C "$PREM" commit -qm missing
MISSING=$(git -C "$PREM" rev-parse HEAD)
PREMCMD=""
if [ -f docs/coachman-contract.toml ]; then
  PREMCMD=$(awk '/^path = /{p=$0} /holds = / && tolower($0) ~ /premis/{print p}' docs/coachman-contract.toml \
    | grep -oE '"[^"]+"' | tr -d '"' | head -1)
fi
if [ -n "$PREMCMD" ] && [ -x "$PREMCMD" ]; then
  pass "AC13 the contract registers a premises script: $PREMCMD"
else
  PREMCMD=""
  fail "AC13 docs/coachman-contract.toml registers no premises script"
fi
PREMRUN=""
if [ -n "$PREMCMD" ]; then
  mkdir -p "$SCR/fd"
  printf '{"stage":"bootstrapped","leg":1,"base":"%s","lanes":{}}' "$V" > "$SCR/fd/manifest.json"
  printf '{"coachman_contract":2}' > "$SCR/fd/run.json"
  cp "$SCR/prem-body-ok.md" "$SCR/fd/brief.md"
  try_prem() { # $1 = base ; remaining args = invocation ; locks PREMRUN on exit 0 + `same`
    local b=$1; shift
    printf '{"stage":"bootstrapped","leg":1,"base":"%s","lanes":{}}' "$b" > "$SCR/fd/manifest.json"
    timeout 60 "$@" </dev/null >"$SCR/prem-try.out" 2>&1
    [ $? -eq 0 ] && grep -qiE '\bsame\b' "$SCR/prem-try.out" && PREMRUN="$*"
  }
  [ -z "$PREMRUN" ] && try_prem "$V" "$PREMCMD" "$PREM" "$SCR/prem-body-ok.md" "$V"
  [ -z "$PREMRUN" ] && try_prem "$V" "$PREMCMD" --repo "$PREM" --body "$SCR/prem-body-ok.md" --base "$V"
  [ -z "$PREMRUN" ] && try_prem "$V" "$PREMCMD" "$SCR/prem-body-ok.md" "$PREM" "$V"
  [ -z "$PREMRUN" ] && try_prem "$V" "$PREMCMD" --body "$SCR/prem-body-ok.md" --repo "$PREM" --base "$V"
  [ -z "$PREMRUN" ] && try_prem "$V" "$PREMCMD" "$SCR/fd"
fi
run_prem() { # $1 = base, $2 = body, $3 = out ; runs the locked invocation with base/body swapped in
  local b=$1 body=$2 out=$3
  printf '{"stage":"bootstrapped","leg":1,"base":"%s","lanes":{}}' "$b" > "$SCR/fd/manifest.json"
  cp "$body" "$SCR/fd/brief.md"
  # shellcheck disable=SC2086
  case "$PREMRUN" in
    *--repo*) timeout 60 $PREMCMD --repo "$PREM" --body "$body" --base "$b" </dev/null >"$out" 2>&1 ;;
    *"$SCR/fd"*) timeout 60 $PREMCMD "$SCR/fd" </dev/null >"$out" 2>&1 ;;
    "$PREMCMD $PREM"*) timeout 60 $PREMCMD "$PREM" "$body" "$b" </dev/null >"$out" 2>&1 ;;
    *) timeout 60 $PREMCMD "$body" "$PREM" "$b" </dev/null >"$out" 2>&1 ;;
  esac
  return $?
}
if [ -z "$PREMRUN" ]; then
  skip "AC13 moved/changed/missing/same: no premises invocation answers same on the untouched fixture"
else
  pass "AC13 premises invocation locked: $PREMRUN"
  run_prem "$MOVED" "$SCR/prem-body-ok.md" "$SCR/prem-moved.out"; RPM=$?
  [ "$RPM" -eq 0 ] && grep -qiE '\bmoved\b' "$SCR/prem-moved.out" \
    && pass "AC13 cited text ten lines down reads moved, exit 0" \
    || fail "AC13 moved fixture: exit $RPM, must be 0 reading moved"
  run_prem "$CHANGED" "$SCR/prem-body-ok.md" "$SCR/prem-changed.out"; RPC=$?
  [ "$RPC" -eq 2 ] && grep -qiE '\bchanged\b' "$SCR/prem-changed.out" \
    && pass "AC13 edited text reads changed, exit 2" \
    || fail "AC13 changed fixture: exit $RPC, must be 2 reading changed"
  run_prem "$MISSING" "$SCR/prem-body-ok.md" "$SCR/prem-missing.out"; RPN=$?
  [ "$RPN" -eq 2 ] && grep -qiE '\bmissing\b' "$SCR/prem-missing.out" \
    && pass "AC13 a deleted file reads missing, exit 2" \
    || fail "AC13 missing fixture: exit $RPN, must be 2 reading missing"
  run_prem "$V" "$SCR/prem-body-bad.md" "$SCR/prem-unknown.out"
  grep -qiE '\bunknown\b' "$SCR/prem-unknown.out" \
    && pass "AC13 an unknown Verified-at commit reads unknown" \
    || fail "AC13 unknown Verified-at commit reads no unknown"
fi
mkdir -p "$SCR/act"
printf '{"stage":"synthesis","leg":1,"base":"x","lanes":{}}' > "$SCR/act/manifest.json"
printf '{"coachman_contract":2}' > "$SCR/act/run.json"
if timeout 60 scripts/log-action.sh "$SCR/act" coachman premises target detail >/dev/null 2>&1 \
    && grep -q '"action":"premises"' "$SCR/act/actions.jsonl"; then
  pass "AC13 log-action.sh records a premises line"
else
  fail "AC13 log-action.sh takes no premises action"
fi
grep -qiE 'premis[^.]{0,120}before (any workhorse|the workhorses|launching)|before (any workhorse|the workhorses|launching)[^.]{0,120}premis' $CM \
  && pass "AC13 the coachman checks premises before any workhorse starts" \
  || fail "AC13 coachman.md names no premises step before the workhorses"
skip "AC13 the premises line before the first workhorse dispatch: needs a full run"

# --- AC14: a failed premise stops the run with a question ---
grep -qi 'premis' $PM && grep -qi 'premis' $CM \
  && pass "AC14 the runbooks route a failed premise to the user" \
  || fail "AC14 the runbooks do not route premises"
skip "AC14 the stopped run, the ruling and the send-back: needs a full run"

# --- AC15: the spec-review machinery is gone ---
GONE="skills/postmaster/spec-session.md skills/postmaster/workhorse-spec-template.md scripts/spec-session.sh scripts/spec-session.ts scripts/spec-session.test.ts scripts/spec-decisions.sh scripts/spec-decisions.ts scripts/spec-decisions.test.ts scripts/spec-review-link.sh scripts/spec-review-link.ts scripts/spec-review-link.test.ts"
LEFT=""
for f in $GONE; do [ -e "$f" ] && LEFT="$LEFT $f"; done
[ -z "$LEFT" ] && pass "AC15 all eleven spec files are gone" || fail "AC15 spec files remain:$LEFT"
RESIDUE=$(grep -rnE "WORKHORSE-SPEC|spec-review|spec session" skills scripts docs AGENTS.md config.example.toml 2>/dev/null || true)
BADRES=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  printf '%s\n' "$line" | grep -qiE '<rt>|runs-watch|runs-status|older|legacy|pause|previous|before this change|in flight|contract 1|\.spec-review-ready' \
    || BADRES="$BADRES
$line"
done <<EOF
$RESIDUE
EOF
[ -z "$BADRES" ] && pass "AC15 residue names only older runs, the status table and the watcher" \
  || fail "AC15 residue beyond the older-run lines:$BADRES"

# --- AC16: an older run finishes the way it started ---
grep -qF 'coachman_contract: 2' scripts/run-meta.ts \
  && pass "AC16 the contract version stays 2" \
  || fail "AC16 run-meta.ts does not pin coachman_contract 2"
mkdir -p "$SCR/runsroot/99"
printf '{"stage":"planning","leg":1,"base":"ede70e2","lanes":{},"coachman":{"legs":{"1":{"thread_id":"t","name":"c"}}}}' > "$SCR/runsroot/99/manifest.json"
printf '{"coachman_contract":2}' > "$SCR/runsroot/99/run.json"
touch "$SCR/runsroot/99/.spec-review-ready" "$SCR/runsroot/99/.leg-1-exited"
timeout 60 scripts/runs-status.sh "$SCR/runsroot" 2>/dev/null | grep -qE '99 +planning +1 +.*SPEC' \
  && pass "AC16 an old planning pause still reads NEXT SPEC" \
  || fail "AC16 runs-status does not read SPEC on the old pause"
timeout 60 scripts/stage.sh "$SCR/runsroot/99" workhorses-running >/dev/null 2>&1 \
  && pass "AC16 an old run's terminal move still works" \
  || fail "AC16 stage.sh refuses the old run's terminal move"
grep -qF '<rt>/skills/postmaster/postmaster.md' $PM \
  && pass "AC16 Spec review points at the old run's own copy" \
  || fail "AC16 postmaster.md points nowhere at <rt>"
if git archive "$BASE" scripts bunfig.toml >/dev/null 2>&1; then
  mkdir -p "$SCR/rt" && git archive "$BASE" scripts bunfig.toml | tar -x -C "$SCR/rt"
  timeout 60 "$SCR/rt/scripts/spec-decisions.sh" "$SCR/runsroot/99" fresh >/dev/null 2>&1
  COUNT=$(timeout 60 "$SCR/rt/scripts/spec-decisions.sh" "$SCR/runsroot/99" count 2>&1)
  [ "$COUNT" = "$(printf 'approved 0\nchanges 0')" ] \
    && pass "AC16 control: the base tool counts an empty package 0/0" \
    || fail "AC16 control: base spec-decisions count gave: $COUNT"
else
  skip "AC16 base-tool control: no BASE in this clone"
fi

# --- AC17/AC18: the fixture run and its premises check ---
skip "AC17 a fixture run from this branch scores clean: needs a full model run"
if command -v bun >/dev/null 2>&1; then
  BASETEST=$(git ls-tree "$BASE" scripts/ --name-only 2>/dev/null | grep '\.test\.ts$' | head -1)
  if [ -n "$BASETEST" ] && timeout 300 bun test "$BASETEST" >/dev/null 2>&1; then
    pass "AC18 control: the test runner runs a base test file"
    if timeout 300 bun test scripts/fixture.test.ts >"$SCR/fixture-test.out" 2>&1; then
      pass "AC18 bun test scripts/fixture.test.ts passes"
    else
      fail "AC18 bun test scripts/fixture.test.ts fails"
    fi
    grep -qi 'premis' scripts/fixture.test.ts && grep -qi 'premis' scripts/fixture.ts \
      && pass "AC18 the fixture score checks the premises order" \
      || fail "AC18 the fixture score names no premises check"
  else
    skip "AC18 the test runner cannot run a base test file here"
  fi
else
  skip "AC18 bun is not on PATH"
fi

echo "oracle-251: $PASS pass / $FAIL fail / $SKIP skip"
[ "$FAIL" -eq 0 ]
