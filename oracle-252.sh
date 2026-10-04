#!/usr/bin/env bash
# Blind oracle for #252: Cleaning up after a run is one script, with a dry run and clear errors.
#
# Written by the leg-1 coachman from the ticket's acceptance criteria and its
# agents' checks BEFORE reading any lane's diff or log, and committed on the
# ticket branch after the spec. Tests at the ticket's own interface: the
# aftercare command line on run records built fresh in temporary folders, plus
# the runbook and contract-list lines the ticket names. Never a function shape,
# which is what the lanes were dispatched to choose.
#
# Casing note: the action-log fixtures below use the key "detail" (byte 0x64),
# exactly as the ticket writes it and as log-action.sh writes it at this base.
# Verified byte by byte against the ticket text, the writer's output and the
# base readers (style-findings, host, review-decide) before any lane started,
# not against any lane's work; the C2 style case re-checks the byte.
#
# Check notes, all from the ticket text alone:
# - C3 "in order": the dry run's folder order (first single-folder line per
#   folder, in output order) must match the real run's teardown order on a twin
#   record. Lines naming two or more folders (list lines) are skipped, since
#   only ordered steps show order. Folder 7 reads only by its full worktree
#   path: a bare 7 also names the run.
# - Folder identity in action lines reads only target and detail, never the
#   whole line: every line carries "run":"7", which would otherwise pass the
#   pin's teardown off as the synthesis folder's (C10, C14).
#
# Repairs after the first scoring (commit after the blind one, each proven by
# the ticket's own text, never by a lane's output): the C2 fixture's finding
# key is lowercase "detail" as the ticket writes it; the C15 steps parser reads
# lowercase "detail" as the ticket shapes it; C16 accepts the ticket's own
# "exit 2 or 3" phrasing; folder identity is target/detail-scoped as above;
# C14 counts five teardowns total.
# - C6/C15 flag reading: the ticket's C15 calls the folders entry field "its
#   flag" and its technical notes call it "flagged". Both spellings are
#   accepted; exactly one must be present per entry.
# - C10's ordering case runs on the in-progress ticket variant, the only one
#   with a ticket-state line. C13's line list is checked by presence, count and
#   relative order, never by exact wording, which the ticket leaves open.
# - C12's "a line naming the step and a line saying what to do next" is checked
#   as: the step's own noun present (folder, ticket, style, close, ...) and at
#   least two non-empty output lines.
# - C16's Stage G wording is checked for the ticket's literal strings
#   (aftercare, dry run, exit 2/3, flag, fault, tool faults, proposals,
#   archiving) and the absence of the hand steps it names.
# - C17 (a fixture run scores clean) cannot run here: it needs a dispatched
#   run. The coachman exercises it at synthesis, not this file.
#
#   ./oracle-252.sh        run every check; exit 0 when all pass, 1 otherwise
#
# Run from the repo root, on a committed tree.

ok=0
bad=0
ok() { ok=$((ok + 1)); echo "ok $1"; }
bad() { bad=$((bad + 1)); echo "BAD $1"; }

[ -f package.json ] && [ -d scripts ] && [ -f scripts/aftercare.ts ] || {
  echo "oracle: run from the repo root, on a tree with scripts/aftercare.ts" >&2
  exit 2
}
command -v git >/dev/null && command -v bun >/dev/null && command -v python3 >/dev/null || {
  echo "oracle: needs git, bun and python3" >&2
  exit 2
}

export GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_SYSTEM=/dev/null

TDIRS=()
STRANGER_PIDS=""
cleanup() {
  for p in $STRANGER_PIDS; do kill "$p" 2>/dev/null || true; done
  for t in ${TDIRS[@]+"${TDIRS[@]}"}; do
    if [ -d "$t/repo/.worktrees" ]; then
      for wt in "$t"/repo/.worktrees/*; do
        [ -e "$wt" ] || continue
        PATH="$t/bin:$PATH" POSTMASTER_HOST_STATE="$t/state" POSTMASTER_HOST_FIXTURE="$t" \
          POSTMASTER_HOST_CLOSE_WAIT=1 ./scripts/host.sh stop "$wt" >/dev/null 2>&1
      done
    fi
  done
  [ "${#TDIRS[@]}" -gt 0 ] && rm -rf -- "${TDIRS[@]}"
}
trap cleanup EXIT

freshT() {
  local d
  d=$(mktemp -d) || exit 2
  T=$(cd "$d" && pwd -P) || exit 2
  TDIRS+=("$T")
}

mkstubs() {
  mkdir -p "$T/bin" "$T/state"
  printf '#!/bin/sh\nexit 1\n' >"$T/bin/herdr"
  printf '#!/bin/sh\nexit 1\n' >"$T/bin/tmux"
  chmod +x "$T/bin/herdr" "$T/bin/tmux"
}

GID="git -c user.name=oracle -c user.email=oracle@example.com -c commit.gpgsign=false"

# Full record R per the ticket's ### Checks preamble. Sets T, D, BASE,
# ORACLE_SHA, WB_SOL, C (pin commit). Ticket 7 starts in done.
mkR() {
  freshT
  mkstubs
  $GID init -b main -q "$T/repo" || exit 2
  printf '.worktrees/\n.postmaster/\nnode_modules/\n' >"$T/repo/.gitignore"
  mkdir -p "$T/repo/src"
  printf 'export const a = 1;\n' >"$T/repo/src/a.ts"
  $GID -C "$T/repo" add -A || exit 2
  $GID -C "$T/repo" commit -qm base || exit 2
  BASE=$($GID -C "$T/repo" rev-parse HEAD) || exit 2
  ./scripts/local.sh "$T/repo" store init >/dev/null || exit 2
  printf 'body\n' >"$T/body.txt"
  for i in 1 2 3 4 5 6 7; do
    ./scripts/local.sh "$T/repo" create "t$i" "$T/body.txt" >/dev/null || exit 2
  done
  ./scripts/local.sh "$T/repo" state 7 done >/dev/null || exit 2
  $GID -C "$T/repo" checkout -qb 7 || exit 2
  mkdir -p "$T/repo/test"
  printf 'oracle v1\n' >"$T/repo/test/oracle-7.test.ts"
  $GID -C "$T/repo" add -A && $GID -C "$T/repo" commit -qm oracle || exit 2
  ORACLE_SHA=$($GID -C "$T/repo" rev-parse HEAD) || exit 2
  printf 'oracle v2\n' >"$T/repo/test/oracle-7.test.ts"
  printf 'export const a = 2;\n' >"$T/repo/src/a.ts"
  $GID -C "$T/repo" add -A && $GID -C "$T/repo" commit -qm synth || exit 2
  $GID -C "$T/repo" checkout -q main || exit 2
  $GID -C "$T/repo" merge -q --no-ff 7 -m merge7 || exit 2
  $GID -C "$T/repo" checkout -qb wb/7-sol "$BASE" -q || exit 2
  printf 'sol\n' >"$T/repo/sol.txt"
  $GID -C "$T/repo" add -A && $GID -C "$T/repo" commit -qm sol || exit 2
  WB_SOL=$($GID -C "$T/repo" rev-parse HEAD) || exit 2
  $GID -C "$T/repo" checkout -qb wb/7-mimo "$BASE" -q || exit 2
  printf 'mimo\n' >"$T/repo/mimo.txt"
  $GID -C "$T/repo" add -A && $GID -C "$T/repo" commit -qm mimo || exit 2
  $GID -C "$T/repo" branch 70-x "$BASE" || exit 2
  $GID -C "$T/repo" checkout -q main || exit 2
  $GID -C "$T/repo" worktree add "$T/repo/.worktrees/7" 7 >/dev/null 2>&1 || exit 2
  $GID -C "$T/repo" worktree add "$T/repo/.worktrees/7-sol" wb/7-sol >/dev/null 2>&1 || exit 2
  $GID -C "$T/repo" worktree add "$T/repo/.worktrees/7-mimo" wb/7-mimo >/dev/null 2>&1 || exit 2
  $GID -C "$T/repo" worktree add --detach "$T/repo/.worktrees/7-oracle-sol" wb/7-sol >/dev/null 2>&1 || exit 2
  $GID -C "$T/repo" worktree add "$T/repo/.worktrees/70-x" 70-x >/dev/null 2>&1 || exit 2
  $GID -C "$T/repo" worktree add --detach "$T/repo/.worktrees/ticket-7-base" main >/dev/null 2>&1 || exit 2
  mkdir -p "$T/repo/.worktrees/7-sol/scripts/.host-self-test-abc"
  printf 'a\n' >"$T/repo/.worktrees/7-sol/scripts/.host-self-test-abc/1.txt"
  printf 'b\n' >"$T/repo/.worktrees/7-sol/scripts/.host-self-test-abc/2.txt"
  printf 'c\n' >"$T/repo/.worktrees/7-sol/scripts/.host-self-test-abc/3.txt"
  mkdir -p "$T/repo/.worktrees/7-mimo/node_modules/p"
  printf 'i\n' >"$T/repo/.worktrees/7-mimo/node_modules/p/i.js"
  mkdir -p "$T/repo/.worktrees/7-oracle-sol/test"
  $GID -C "$T/repo" show "$ORACLE_SHA:test/oracle-7.test.ts" >"$T/repo/.worktrees/7-oracle-sol/test/oracle-7.test.ts" || exit 2
  $GID -C "$T/repo/.worktrees/7-oracle-sol" add test/oracle-7.test.ts || exit 2
  mkdir -p "$T/pins"
  $GID init -b main -q "$T/pinrepo" || exit 2
  printf 'pin\n' >"$T/pinrepo/f.txt"
  $GID -C "$T/pinrepo" add -A && $GID -C "$T/pinrepo" commit -qm pin || exit 2
  C=$($GID -C "$T/pinrepo" rev-parse HEAD) || exit 2
  $GID -C "$T/pinrepo" worktree add --detach "$T/pins/$C" "$C" >/dev/null 2>&1 || exit 2
  D=$T/repo/.postmaster/runs/7
  mkdir -p "$D/logs"
  printf '## Dispatch\nname: #7, test\nsynthesis worktree: %s/repo/.worktrees/7\n' "$T" >"$D/brief.md"
  printf '{"stage":"shipped","leg":2,"base":"%s","lanes":{"sol":{},"mimo":{}}}' "$BASE" >"$D/manifest.json"
  printf '{"coachman_contract":2,"postmaster":{"checkout":"%s/pins/%s"},"config":{"team":{"workhorses":["sol","mimo"]}}}' "$T" "$C" >"$D/run.json"
  printf '%s\n' "$D" >"$T/pins/$C.claims"
  {
    printf '{"ts":"2026-10-03T09:00:00Z","actor":"postmaster","action":"dispatch","target":"sol","detail":"thread t1"}\n'
    for s in bootstrapped planning workhorses-running synthesis checkpoint-1 review shipping; do
      printf '{"ts":"2026-10-03T09:01:00Z","actor":"coachman","action":"stage","target":"%s","detail":"from x after 1s"}\n' "$s"
    done
    printf '{"ts":"2026-10-03T09:02:00Z","actor":"postmaster","action":"merge","target":"7","detail":"merged"}\n'
    printf '{"ts":"2026-10-03T09:03:00Z","actor":"postmaster","action":"stage","target":"shipped","detail":"from shipping after 1s"}\n'
  } >"$D/actions.jsonl"
  touch "$D/.leg-1-done" "$D/.leg-1-exited" "$D/.leg-2-done" "$D/.leg-2-exited"
  printf 'run log\n' >"$D/run-log.md"
  printf '{"reviewers":[["bug","mimo"]]}' >"$D/logs/review-r1.json"
  printf '[{"target":"x:1"}]' >"$D/logs/review-r1-bug-mimo-findings.json"
}

OUT=""
ERR=""
CODE=0
runA() {
  local errf="$T/after.err"
  OUT=$(PATH="$T/bin:$PATH" POSTMASTER_HOST_STATE="$T/state" POSTMASTER_HOST_FIXTURE="$T" \
    POSTMASTER_HOST_CLOSE_WAIT=1 POSTMASTER_TOOL_PINS="$T/pins" \
    bun --no-env-file --config=/dev/null scripts/aftercare.ts "$D" "$@" 2>"$errf")
  CODE=$?
  ERR=$(cat "$errf")
  printf '%s' "$OUT" >"$T/after.out"
}

STORE=""
storeOf() {
  STORE=$(git -C "$T/repo" rev-parse --path-format=absolute --git-common-dir)/postmaster/tickets
}

snapR() {
  mkdir -p "$T/snap"
  git -C "$T/repo" worktree list >"$T/snap/worktrees.txt" 2>/dev/null
  ls "$T/repo/.worktrees" >"$T/snap/ls.txt" 2>/dev/null
  cp "$D/actions.jsonl" "$D/run-log.md" "$D/manifest.json" "$T/snap/"
  storeOf
  cp "$STORE/7.json" "$STORE/7.md" "$T/snap/"
  [ -e "$T/repo/.postmaster/runs/ledger.jsonl" ] && SN_LEDGER=yes || SN_LEDGER=no
  [ -e "$D/stray" ] && SN_STRAY=yes || SN_STRAY=no
  [ -e "$T/pins/$C" ] && SN_PIN=yes || SN_PIN=no
  [ -e "$T/pins/$C.claims" ] && SN_CLAIMS=yes || SN_CLAIMS=no
}

# assertUnchanged <label>: R unchanged per the preamble.
assertUnchanged() {
  local label="$1" same=1
  git -C "$T/repo" worktree list 2>/dev/null | cmp -s - "$T/snap/worktrees.txt" || same=0
  ls "$T/repo/.worktrees" 2>/dev/null | cmp -s - "$T/snap/ls.txt" || same=0
  cmp -s "$D/actions.jsonl" "$T/snap/actions.jsonl" || same=0
  cmp -s "$D/run-log.md" "$T/snap/run-log.md" || same=0
  cmp -s "$D/manifest.json" "$T/snap/manifest.json" || same=0
  storeOf
  cmp -s "$STORE/7.json" "$T/snap/7.json" || same=0
  cmp -s "$STORE/7.md" "$T/snap/7.md" || same=0
  if [ "$SN_LEDGER" = yes ]; then [ -e "$T/repo/.postmaster/runs/ledger.jsonl" ] || same=0
  else [ ! -e "$T/repo/.postmaster/runs/ledger.jsonl" ] || same=0; fi
  if [ "$SN_STRAY" = yes ]; then [ -e "$D/stray" ] || same=0
  else [ ! -e "$D/stray" ] || same=0; fi
  if [ "$SN_PIN" = yes ]; then [ -e "$T/pins/$C" ] || same=0
  else [ ! -e "$T/pins/$C" ] || same=0; fi
  if [ "$SN_CLAIMS" = yes ]; then [ -e "$T/pins/$C.claims" ] || same=0
  else [ ! -e "$T/pins/$C.claims" ] || same=0; fi
  if [ "$same" = 1 ]; then ok "$label unchanged"; else bad "$label unchanged"; fi
}

actionCount() {
  # $1 = actions file, $2 = action name; prints count of lines with that action.
  python3 - "$1" "$2" <<'EOF'
import json, sys
n = 0
for line in open(sys.argv[1], encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    try:
        e = json.loads(line)
    except Exception:
        continue
    if isinstance(e, dict) and e.get("action") == sys.argv[2]:
        n += 1
print(n)
EOF
}

addedLines() {
  # $1 = before-line-count; prints actions.jsonl lines added since.
  tail -n +"$(($1 + 1))" "$D/actions.jsonl"
}

twoLines() {
  # $1 = label; asserts combined output holds at least two non-empty lines.
  local label="$1" n
  n=$(printf '%s\n%s\n' "$OUT" "$ERR" | grep -c "[^[:space:]]")
  if [ "$n" -ge 2 ]; then ok "$label two lines"; else bad "$label two lines"; fi
}

flagOf() {
  # $1 = json file, $2 = folder; prints the entry's flag value (true/false/?).
  python3 - "$1" "$2" <<'EOF'
import json, sys
try:
    o = json.load(open(sys.argv[1]))
except Exception:
    print("?");
    raise SystemExit
want = sys.argv[2]
found = []
for e in o.get("folders", []):
    p = str(e.get("path", ""))
    if p.split("/")[-1] == want:
        v = e.get("flagged", e.get("flag", "?"))
        found.append("true" if v is True else ("false" if v is False else "?"))
print(found[0] if len(found) == 1 else "?")
EOF
}

launchAlive() {
  # $1 = worktree path; exit 0 when the registry names a live pid for it.
  local wt="$1" f pid
  for f in "$T"/state/launches/*; do
    [ -f "$f" ] || continue
    [ "$(head -n 1 "$f")" = "$wt" ] || continue
    pid=$(basename "$f")
    case "$pid" in
      *[!0-9]*) continue ;;
    esac
    if kill -0 "$pid" 2>/dev/null; then return 0; fi
  done
  return 1
}

hostEnv() {
  PATH="$T/bin:$PATH" POSTMASTER_HOST_STATE="$T/state" POSTMASTER_HOST_FIXTURE="$T" \
    POSTMASTER_HOST_CLOSE_WAIT=1 POSTMASTER_TOOL_PINS="$T/pins" "$@"
}

foldersGone() {
  # $1 = label; asserts the four run folders are gone from git and disk.
  local label="$1" gone=1
  for f in 7 7-sol 7-mimo 7-oracle-sol; do
    [ -e "$T/repo/.worktrees/$f" ] && gone=0
    git -C "$T/repo" worktree list --porcelain 2>/dev/null | grep -q "worktree $T/repo/.worktrees/$f\$" && gone=0
  done
  if [ "$gone" = 1 ]; then ok "$label folders gone"; else bad "$label folders gone"; fi
}

othersRemain() {
  # $1 = label; asserts 70-x and ticket-7-base worktrees still exist, clean.
  local label="$1" kept=1
  for f in 70-x ticket-7-base; do
    [ -d "$T/repo/.worktrees/$f" ] || kept=0
    git -C "$T/repo" worktree list --porcelain 2>/dev/null | grep -q "worktree $T/repo/.worktrees/$f\$" || kept=0
    [ -n "$(git -C "$T/repo/.worktrees/$f" status --porcelain 2>/dev/null)" ] && kept=0
  done
  if [ "$kept" = 1 ]; then ok "$label others remain"; else bad "$label others remain"; fi
}

# Folder identity in an action line reads only its target and detail: the whole
# line also carries the run ("run":"7"), which a bare-7 match would mistake for
# the synthesis folder on every line, including the pin's teardown.
teardownOrder() {
  # $1 = actions file; prints run-folder names in first-teardown-mention order.
  python3 - "$1" <<'EOF'
import json, re, sys
seen = []
for line in open(sys.argv[1], encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    try:
        e = json.loads(line)
    except Exception:
        continue
    if not isinstance(e, dict) or e.get("action") != "teardown":
        continue
    tgt = str(e.get("target", ""))
    det = str(e.get("detail", ""))
    blob = tgt + "\n" + det
    base = tgt.rsplit("/", 1)[-1]
    for f in ("7-oracle-sol", "7-mimo", "7-sol"):
        if f in blob and f not in seen:
            seen.append(f)
    if (base == "7" or re.search(r"(?<![\w-])7(?![-\w])", det)) and "7" not in seen:
        seen.append("7")
print(" ".join(seen))
EOF
}

# --- C1: one command takes a landed run to done ---
mkR
T1=$T
D1=$D
C1PIN=$C
BEFORE1=$(wc -l <"$D/actions.jsonl")
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C1 exit 0" || bad "C1 exit 0 (got $CODE: $OUT $ERR)"
WT=$(git -C "$T/repo" worktree list --porcelain 2>/dev/null | grep -c "^worktree ")
if [ "$WT" = 3 ] \
  && git -C "$T/repo" worktree list --porcelain | grep -q "worktrees/70-x\$" \
  && git -C "$T/repo" worktree list --porcelain | grep -q "worktrees/ticket-7-base\$" \
  && [ "$(ls "$T/repo/.worktrees" | tr '\n' ' ')" = "70-x ticket-7-base " ]; then
  ok "C1 worktrees"
else
  bad "C1 worktrees"
fi
[ "$(python3 -c "import json;print(json.load(open('$D/manifest.json'))['stage'])")" = "done" ] \
  && ok "C1 stage done" || bad "C1 stage done"
./scripts/local.sh "$T/repo" read 7 2>/dev/null | grep -q "^state: done$" \
  && ok "C1 ticket done" || bad "C1 ticket done"
[ ! -e "$T/pins/$C" ] && [ ! -e "$T/pins/$C.claims" ] \
  && ok "C1 pin released" || bad "C1 pin released"
BR=$(git -C "$T/repo" branch --list)
if echo "$BR" | grep -qE "^[* ] *7$" && echo "$BR" | grep -q "wb/7-sol" && echo "$BR" | grep -q "wb/7-mimo"; then
  ok "C1 branches kept"
else
  bad "C1 branches kept"
fi
ORDER1=$(addedLines "$BEFORE1" >"$T/added1.txt"; teardownOrder "$T/added1.txt")
# C1 in-progress variant: same, ticket ends done, one ticket-state line.
mkR
./scripts/local.sh "$T/repo" state 7 in-progress >/dev/null || exit 2
BEFOREIP=$(wc -l <"$D/actions.jsonl")
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C1-ip exit 0" || bad "C1-ip exit 0 (got $CODE: $OUT $ERR)"
./scripts/local.sh "$T/repo" read 7 2>/dev/null | grep -q "^state: done$" \
  && ok "C1-ip ticket done" || bad "C1-ip ticket done"
foldersGone "C1-ip"
[ "$(addedLines "$BEFOREIP" | python3 -c "
import json,sys
n=0
for line in sys.stdin:
    line=line.strip()
    if line and json.loads(line).get('action')=='ticket-state': n+=1
print(n)")" = 1 ] && ok "C1-ip one ticket-state" || bad "C1-ip one ticket-state"
TIP=$T
DIP=$D
# C1 cancelled variant: stays cancelled, no ticket-state line, summary says so.
mkR
./scripts/local.sh "$T/repo" state 7 cancelled >/dev/null || exit 2
BEFORECX=$(wc -l <"$D/actions.jsonl")
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C1-cx exit 0" || bad "C1-cx exit 0 (got $CODE: $OUT $ERR)"
./scripts/local.sh "$T/repo" read 7 2>/dev/null | grep -q "^state: cancelled$" \
  && ok "C1-cx stays cancelled" || bad "C1-cx stays cancelled"
[ "$(addedLines "$BEFORECX" | python3 -c "
import json,sys
n=0
for line in sys.stdin:
    line=line.strip()
    if line and json.loads(line).get('action')=='ticket-state': n+=1
print(n)")" = 0 ] && ok "C1-cx no ticket-state" || bad "C1-cx no ticket-state"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -qi "cancel" \
  && ok "C1-cx summary says so" || bad "C1-cx summary says so"

# --- C2: not ready means exit 2 with nothing changed ---
mkR
python3 - "$D/manifest.json" <<'EOF'
import json, sys
p = sys.argv[1]
m = json.load(open(p))
m["stage"] = "shipping"
json.dump(m, open(p, "w"))
EOF
snapR
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 2 ] && ok "C2-shipping exit 2" || bad "C2-shipping exit 2 (got $CODE: $OUT $ERR)"
assertUnchanged "C2-shipping"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -qi "shipp" \
  && ok "C2-shipping reason" || bad "C2-shipping reason"
twoLines "C2-shipping"
mkR
rm "$D/.leg-2-exited"
snapR
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 2 ] && ok "C2-leg exit 2" || bad "C2-leg exit 2 (got $CODE: $OUT $ERR)"
assertUnchanged "C2-leg"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -qi "leg\|exit\|marker\|runn" \
  && ok "C2-leg reason" || bad "C2-leg reason"
twoLines "C2-leg"
mkR
printf '{"ts":"2026-10-03T10:00:00Z","actor":"coachman","action":"finding","target":"src/a.ts:1","detail":"style P3 r1 style mimo, verified by reading"}\n' >>"$D/actions.jsonl"
grep -c '"detail":"style P3' "$D/actions.jsonl" | grep -q "^1$" \
  && ok "C2-style fixture byte" || bad "C2-style fixture byte"
snapR
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 2 ] && ok "C2-style exit 2" || bad "C2-style exit 2 (got $CODE: $OUT $ERR)"
assertUnchanged "C2-style"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -qi "style" \
  && ok "C2-style reason" || bad "C2-style reason"
twoLines "C2-style"

# --- C3: dry run shows every action, changes nothing ---
mkR
TDRY=$T
DDRY=$D
snapR
runA --dry-run --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C3 exit 0" || bad "C3 exit 0 (got $CODE: $OUT $ERR)"
assertUnchanged "C3"
printf '%s' "$OUT" >"$T/dry.out"
for f in 7-sol 7-mimo 7-oracle-sol; do
  grep -q "$f" "$T/dry.out" && ok "C3 names $f" || bad "C3 names $f"
done
grep -Eq "(^|[^0-9])7([^0-9-]|$)" "$T/dry.out" && ok "C3 names 7" || bad "C3 names 7"
grep -q "70-x" "$T/dry.out" && bad "C3 omits 70-x" || ok "C3 omits 70-x"
grep -q "ticket-7-base" "$T/dry.out" && bad "C3 omits ticket-7-base" || ok "C3 omits ticket-7-base"
grep -qi "sav" "$T/dry.out" && ok "C3 says what it saves" || bad "C3 says what it saves"
DRYORDER=$(python3 - "$T/dry.out" <<'EOF'
import re, sys
# Only unambiguous folder references carry order: dashed names, and folder 7
# by its full worktree path. A bare 7 also names the run ("run 7" headers),
# so it is never read as the folder here.
order = []
for line in open(sys.argv[1], encoding="utf-8", errors="replace"):
    found = []
    for f in ("7-oracle-sol", "7-mimo", "7-sol"):
        if f in line and f not in found:
            found.append(f)
    if re.search(r"\.worktrees/7(?![-\w])", line) and "7" not in found:
        found.append("7")
    if len(found) == 1 and found[0] not in order:
        order.append(found[0])
print(" ".join(order))
EOF
)
if [ -n "$DRYORDER" ] && [ -n "$ORDER1" ]; then
  RESTRICTED=""
  for f in $ORDER1; do
    case " $DRYORDER " in
      *" $f "*) RESTRICTED="$RESTRICTED $f" ;;
    esac
  done
  RESTRICTED=$(echo "$RESTRICTED" | tr -s ' ' | sed 's/^ //')
  if [ "$DRYORDER" = "$RESTRICTED" ]; then
    ok "C3 order matches"
  else
    bad "C3 order matches (dry [$DRYORDER] vs run [$RESTRICTED])"
  fi
else
  bad "C3 order matches (empty order)"
fi
# C3 flagged variant.
mkR
printf 'export const a = 9;\n' >"$T/repo/.worktrees/7-mimo/src/a.ts"
snapR
runA --dry-run --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C3-flag exit 0" || bad "C3-flag exit 0 (got $CODE)"
assertUnchanged "C3-flag"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -q "7-mimo" \
  && ok "C3-flag names 7-mimo" || bad "C3-flag names 7-mimo"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -qi "flag" \
  && ok "C3-flag shows flag" || bad "C3-flag shows flag"
# C3 without words: exit 1, nothing changed.
T=$TDRY
D=$DDRY
snapR
runA --dry-run
[ "$CODE" = 1 ] && ok "C3-nowords exit 1" || bad "C3-nowords exit 1 (got $CODE: $OUT $ERR)"
assertUnchanged "C3-nowords"
twoLines "C3-nowords"

# --- C4: every working folder the run made, blind-test scratch included ---
mkR
./scripts/cut-scratch.sh "$T/repo" "$T/repo/.worktrees/7" "$T/repo/.worktrees/7-rev-security-sol" "$WB_SOL" --clone "$BASE" >/dev/null || exit 2
BEFORE4=$(wc -l <"$D/actions.jsonl")
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C4 exit 0" || bad "C4 exit 0 (got $CODE: $OUT $ERR)"
foldersGone "C4"
[ -e "$T/repo/.worktrees/7-rev-security-sol" ] && bad "C4 clone gone" || ok "C4 clone gone"
othersRemain "C4"
NTEAR=$(addedLines "$BEFORE4" | python3 -c "
import json,sys
print(sum(1 for line in sys.stdin if line.strip() and json.loads(line).get('action')=='teardown'))")
[ "$NTEAR" = 6 ] && ok "C4 six teardowns" || bad "C4 six teardowns (got $NTEAR)"
for f in 7-sol 7-mimo 7-oracle-sol 7-rev-security-sol; do
  n=$(addedLines "$BEFORE4" | python3 -c "
import json,sys
f = '$f'
n = 0
for line in sys.stdin:
    line = line.strip()
    if line and json.loads(line).get('action') == 'teardown' and f in line:
        n += 1
print(n)")
  [ "$n" = 1 ] && ok "C4 one teardown $f" || bad "C4 one teardown $f (got $n)"
done
# C4 by-hand folder: exit 3, remains, named.
mkR
mkdir -p "$T/repo/.worktrees/7-by-hand"
printf 'x\n' >"$T/repo/.worktrees/7-by-hand/f.txt"
BEFOREBH=$(wc -l <"$D/actions.jsonl")
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 3 ] && ok "C4-bh exit 3" || bad "C4-bh exit 3 (got $CODE: $OUT $ERR)"
[ -d "$T/repo/.worktrees/7-by-hand" ] && ok "C4-bh remains" || bad "C4-bh remains"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -q "7-by-hand" \
  && ok "C4-bh named" || bad "C4-bh named"
twoLines "C4-bh"
foldersGone "C4-bh"
# C4 runbook naming.
NCOACH=$(grep -cF '<repo>/.worktrees/<TICKET>-oracle-<lane>' skills/postmaster/coachman.md)
if [ "$NCOACH" -ge 2 ]; then ok "C4 coachman names oracle scratch"; else bad "C4 coachman names oracle scratch (got $NCOACH)"; fi

# --- C5: saves before removal ---
T=$T1
D=$D1
if [ -d "$D/stray" ]; then ok "C5 stray dir"; else bad "C5 stray dir"; fi
ls "$D/stray" 2>/dev/null | grep -qE "^7\.|7-mimo\." && bad "C5 nothing for 7, 7-mimo" || ok "C5 nothing for 7, 7-mimo"
EMPTY=$(find "$D/stray" -type f -empty 2>/dev/null | wc -l)
[ "$EMPTY" = 0 ] && ok "C5 no empty file" || bad "C5 no empty file"
grep -rq "node_modules" "$D/stray" 2>/dev/null && bad "C5 no node_modules" || ok "C5 no node_modules"
find "$D/stray" -name "*node_modules*" 2>/dev/null | grep -q . && bad "C5 no node_modules names" || ok "C5 no node_modules names"
$GID -C "$T/repo" worktree add --detach "$T/fresh-oracle" wb/7-sol >/dev/null 2>&1 || exit 2
STAGED_OK=no
for f in "$D"/stray/7-oracle-sol.*; do
  [ -f "$f" ] || continue
  if git -C "$T/fresh-oracle" apply --cached --check "$f" 2>/dev/null; then
    STAGED_OK="$f"
    break
  fi
done
if [ "$STAGED_OK" = no ]; then
  bad "C5 staged diff applies"
else
  ok "C5 staged diff applies"
  git -C "$T/fresh-oracle" apply --cached "$STAGED_OK" 2>/dev/null
  GOT=$(git -C "$T/fresh-oracle" show :test/oracle-7.test.ts 2>/dev/null)
  WANT=$(git -C "$T/repo" show 7~1:test/oracle-7.test.ts 2>/dev/null)
  if [ -n "$GOT" ] && [ "$GOT" = "$WANT" ]; then ok "C5 staged adds oracle v1"; else bad "C5 staged adds oracle v1"; fi
fi
TAR_OK=no
for f in "$D"/stray/7-sol.*; do
  [ -f "$f" ] || continue
  LIST=$(tar -tf "$f" 2>/dev/null | sed 's|^\./||' | grep -v '/$' | sort)
  WANT_LIST="scripts/.host-self-test-abc/1.txt
scripts/.host-self-test-abc/2.txt
scripts/.host-self-test-abc/3.txt"
  if [ "$LIST" = "$WANT_LIST" ]; then TAR_OK="$f"; break; fi
done
[ "$TAR_OK" = no ] && bad "C5 sol archive exact" || ok "C5 sol archive exact"
# C5 committed variant: a patch of the unbranched commit, git am applies it.
mkR
$GID -C "$T/repo/.worktrees/7-oracle-sol" commit -qm stray || exit 2
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C5-commit exit 0" || bad "C5-commit exit 0 (got $CODE: $OUT $ERR)"
$GID -C "$T/repo" worktree add --detach "$T/fresh-am" wb/7-sol >/dev/null 2>&1 || exit 2
AM_OK=no
for f in "$D"/stray/7-oracle-sol.*; do
  [ -f "$f" ] || continue
  if $GID -C "$T/fresh-am" am --quiet "$f" >/dev/null 2>&1; then
    AM_OK="$f"
    break
  fi
done
if [ "$AM_OK" = no ]; then
  bad "C5 patch git-am applies"
else
  ok "C5 patch git-am applies"
  GOT=$(cat "$T/fresh-am/test/oracle-7.test.ts" 2>/dev/null)
  WANT=$(git -C "$T/repo" show 7~1:test/oracle-7.test.ts 2>/dev/null)
  if [ -n "$GOT" ] && [ "$GOT" = "$WANT" ]; then ok "C5 patch holds oracle v1"; else bad "C5 patch holds oracle v1"; fi
fi

# --- C6: the summary flags work no branch holds ---
mkR
printf 'export const a = 9;\n' >"$T/repo/.worktrees/7-mimo/src/a.ts"
BEFORE6=$(wc -l <"$D/actions.jsonl")
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C6 exit 0" || bad "C6 exit 0 (got $CODE: $OUT $ERR)"
[ -e "$T/repo/.worktrees/7-mimo" ] && bad "C6 7-mimo gone" || ok "C6 7-mimo gone"
ls "$D/stray"/7-mimo.* >/dev/null 2>&1 && ok "C6 change saved" || bad "C6 change saved"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -q "7-mimo" \
  && ok "C6 summary names 7-mimo" || bad "C6 summary names 7-mimo"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -qi "flag" \
  && ok "C6 summary flags" || bad "C6 summary flags"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -q "src/a.ts" \
  && ok "C6 summary names file" || bad "C6 summary names file"
FLAGGED_TEARDOWNS=$(addedLines "$BEFORE6" | python3 -c "
import json,sys
bad = []
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    e = json.loads(line)
    if e.get('action') != 'teardown' or 'flag' not in line.lower():
        continue
    if '7-mimo' not in line:
        bad.append(line)
print(len(bad))")
[ "$FLAGGED_TEARDOWNS" = 0 ] && ok "C6 no other folder flagged" || bad "C6 no other folder flagged"
MIMO_TEARDOWN_FLAG=$(addedLines "$BEFORE6" | python3 -c "
import json,sys
hit = 0
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    e = json.loads(line)
    if e.get('action') == 'teardown' and '7-mimo' in line and 'flag' in line.lower() and 'src/a.ts' in line:
        hit += 1
print(hit)")
[ "$MIMO_TEARDOWN_FLAG" = 1 ] && ok "C6 mimo teardown carries flag" || bad "C6 mimo teardown carries flag"
# C6 negative variants: same content as branch 7, deletion, unchanged move.
mkR
printf 'export const a = 2;\n' >"$T/repo/.worktrees/7-mimo/src/a.ts"
runA --json --comment "closing words" --run-log "closing line"
printf '%s' "$OUT" >"$T/j6a.json"
[ "$CODE" = 0 ] && ok "C6-eq exit 0" || bad "C6-eq exit 0 (got $CODE)"
[ "$(flagOf "$T/j6a.json" 7-mimo)" = "false" ] && ok "C6-eq no flag" || bad "C6-eq no flag"
mkR
rm "$T/repo/.worktrees/7-mimo/src/a.ts"
runA --json --comment "closing words" --run-log "closing line"
printf '%s' "$OUT" >"$T/j6b.json"
[ "$CODE" = 0 ] && ok "C6-del exit 0" || bad "C6-del exit 0 (got $CODE)"
[ "$(flagOf "$T/j6b.json" 7-mimo)" = "false" ] && ok "C6-del no flag" || bad "C6-del no flag"
mkR
mkdir -p "$T/repo/.worktrees/7-mimo/src"
mv "$T/repo/.worktrees/7-mimo/src/a.ts" "$T/repo/.worktrees/7-mimo/src/b.ts"
runA --json --comment "closing words" --run-log "closing line"
printf '%s' "$OUT" >"$T/j6c.json"
[ "$CODE" = 0 ] && ok "C6-mv exit 0" || bad "C6-mv exit 0 (got $CODE)"
[ "$(flagOf "$T/j6c.json" 7-mimo)" = "false" ] && ok "C6-mv no flag" || bad "C6-mv no flag"

# --- C7: a folder in use is left in place and named ---
mkR
T7=$T
D7=$D
hostEnv ./scripts/host.sh run probe "$T/repo/.worktrees/7-sol" --out "$T/o" --err "$T/e" -- sleep 300 >/dev/null || exit 2
BEFORE7=$(wc -l <"$D/actions.jsonl")
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 3 ] && ok "C7 exit 3" || bad "C7 exit 3 (got $CODE: $OUT $ERR)"
[ -d "$T/repo/.worktrees/7-sol" ] && ok "C7 7-sol remains" || bad "C7 7-sol remains"
launchAlive "$T/repo/.worktrees/7-sol" && ok "C7 probe runs" || bad "C7 probe runs"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -q "7-sol" \
  && ok "C7 names 7-sol" || bad "C7 names 7-sol"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -q "probe" \
  && ok "C7 names launch" || bad "C7 names launch"
twoLines "C7"
for f in 7 7-mimo 7-oracle-sol; do
  [ -e "$T/repo/.worktrees/$f" ] && bad "C7 $f gone" || ok "C7 $f gone"
done
othersRemain "C7"
hostEnv ./scripts/host.sh stop "$T/repo/.worktrees/7-sol" >/dev/null || exit 2
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C7-again exit 0" || bad "C7-again exit 0 (got $CODE: $OUT $ERR)"
[ -e "$T/repo/.worktrees/7-sol" ] && bad "C7-again 7-sol gone" || ok "C7-again 7-sol gone"

# --- C8: the preview server is stopped ---
mkR
mkdir -p "$D/render"
hostEnv ./scripts/host.sh run "preview server" "$T/repo/.worktrees/7" --under "$D" --role coachman --run "$D" --pidfile "$D/render/preview.pid" --out "$T/p" --err "$T/pe" -- sleep 300 >/dev/null || exit 2
PREV_PID=$(cat "$D/render/preview.pid")
PREV_PGID=$(python3 -c "import os,sys;print(os.getpgid(int(sys.argv[1])))" "$PREV_PID" 2>/dev/null)
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C8 exit 0" || bad "C8 exit 0 (got $CODE: $OUT $ERR)"
if [ -n "$PREV_PGID" ] && python3 -c "import os,sys;os.killpg(int(sys.argv[1]),0)" "$PREV_PGID" 2>/dev/null; then
  bad "C8 group gone"
else
  ok "C8 group gone"
fi
[ -e "$T/repo/.worktrees/7" ] && bad "C8 7 gone" || ok "C8 7 gone"
# C8 no pid file: no stop step in the summary.
mkR
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C8-nopid exit 0" || bad "C8-nopid exit 0 (got $CODE)"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -qi "preview.*stop\|stop.*preview" \
  && bad "C8-nopid no stop step" || ok "C8-nopid no stop step"
# C8 unregistered pid: that process still runs.
mkR
mkdir -p "$D/render"
setsid -f sleep 297 </dev/null >/dev/null 2>&1
STRANGER=$(pgrep -f "^sleep 297$" | head -n 1 || true)
if [ -z "$STRANGER" ]; then
  bad "C8-stranger setup"
else
  printf '%s\n' "$STRANGER" >"$D/render/preview.pid"
  STRANGER_PIDS="$STRANGER_PIDS $STRANGER"
  runA --comment "closing words" --run-log "closing line"
  [ "$CODE" = 0 ] && ok "C8-stranger exit 0" || bad "C8-stranger exit 0 (got $CODE: $OUT $ERR)"
  if kill -0 "$STRANGER" 2>/dev/null; then ok "C8-stranger alive"; else bad "C8-stranger alive"; fi
  kill "$STRANGER" 2>/dev/null || true
  [ -e "$T/repo/.worktrees/7" ] && bad "C8-stranger 7 gone" || ok "C8-stranger 7 gone"
fi

# --- C9: closing words go to their place once ---
T=$T1
D=$D1
storeOf
[ "$(grep -c "closing line" "$D/run-log.md")" = 1 ] && ok "C9 run-log once" || bad "C9 run-log once"
[ "$(grep -c "postmaster: closing words" "$STORE/7.json")" = 1 ] && ok "C9 ticket log once" || bad "C9 ticket log once"
[ "$(actionCount "$D/actions.jsonl" ticket-comment)" = 1 ] && ok "C9 one ticket-comment" || bad "C9 one ticket-comment"
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C9-again exit 0" || bad "C9-again exit 0 (got $CODE)"
[ "$(grep -c "closing line" "$D/run-log.md")" = 1 ] && ok "C9-again run-log once" || bad "C9-again run-log once"
[ "$(grep -c "postmaster: closing words" "$STORE/7.json")" = 1 ] && ok "C9-again ticket log once" || bad "C9-again ticket log once"
[ "$(actionCount "$D/actions.jsonl" ticket-comment)" = 1 ] && ok "C9-again still one" || bad "C9-again still one"

# --- C10: closing steps wait for the folders ---
# Ordering on the in-progress variant (TIP/DIP), the run with a ticket-state line.
python3 - "$DIP/actions.jsonl" <<'EOF' >"$TIP/c10.txt"
import json, re, sys
lastFolderTear = 0
firstState = firstComment = firstDone = 0
for i, line in enumerate(open(sys.argv[1], encoding="utf-8"), 1):
    line = line.strip()
    if not line:
        continue
    try:
        e = json.loads(line)
    except Exception:
        continue
    a = e.get("action")
    tgt = str(e.get("target", ""))
    det = str(e.get("detail", ""))
    blob = tgt + "\n" + det
    base = tgt.rsplit("/", 1)[-1]
    isFolder = ("7-sol" in blob or "7-mimo" in blob or "7-oracle-sol" in blob
                or base == "7" or re.search(r"(?<![\w-])7(?![-\w])", det))
    if a == "teardown" and isFolder:
        lastFolderTear = i
    elif a == "ticket-state" and not firstState:
        firstState = i
    elif a == "ticket-comment" and not firstComment:
        firstComment = i
    elif a == "stage" and e.get("target") == "done" and not firstDone:
        firstDone = i
print(lastFolderTear, firstState, firstComment, firstDone)
EOF
read -r LAST_TS FIRST_STATE FIRST_COMMENT FIRST_DONE <"$TIP/c10.txt"
if [ "$LAST_TS" -gt 0 ] && [ "$FIRST_STATE" -gt "$LAST_TS" ] && [ "$FIRST_COMMENT" -gt "$LAST_TS" ] && [ "$FIRST_DONE" -gt "$LAST_TS" ]; then
  ok "C10 closing after folders"
else
  bad "C10 closing after folders ($LAST_TS $FIRST_STATE $FIRST_COMMENT $FIRST_DONE)"
fi
# After C7's stop on an in-progress ticket: nothing closing happened.
mkR
./scripts/local.sh "$T/repo" state 7 in-progress >/dev/null || exit 2
hostEnv ./scripts/host.sh run probe "$T/repo/.worktrees/7-sol" --out "$T/o" --err "$T/e" -- sleep 300 >/dev/null || exit 2
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 3 ] && ok "C10-stop exit 3" || bad "C10-stop exit 3 (got $CODE)"
[ "$(python3 -c "import json;print(json.load(open('$D/manifest.json'))['stage'])")" = "shipped" ] \
  && ok "C10-stop stage shipped" || bad "C10-stop stage shipped"
./scripts/local.sh "$T/repo" read 7 2>/dev/null | grep -q "^state: in-progress$" \
  && ok "C10-stop ticket in-progress" || bad "C10-stop ticket in-progress"
storeOf
grep -q "closing words" "$STORE/7.json" && bad "C10-stop no comment" || ok "C10-stop no comment"
grep -q "closing line" "$D/run-log.md" && bad "C10-stop no run-log line" || ok "C10-stop no run-log line"
[ -e "$T/pins/$C" ] && ok "C10-stop pin remains" || bad "C10-stop pin remains"

# --- C11: the pin is released unless another run uses it ---
# Release covered in C1; here the pin's teardown line and the shared-pin case.
T=$T1
D=$D1
PIN_TEARDOWN=$(python3 -c "
import json
n = 0
for line in open('$D/actions.jsonl', encoding='utf-8'):
    line = line.strip()
    if not line:
        continue
    e = json.loads(line)
    if e.get('action') == 'teardown' and ('$C1PIN' in line or 'pin' in line.lower()):
        n += 1
print(n)")
[ "$PIN_TEARDOWN" = 1 ] && ok "C11 pin teardown line" || bad "C11 pin teardown line (got $PIN_TEARDOWN)"
mkR
D2=$T/repo/.postmaster/runs/8
mkdir -p "$D2"
printf '{"stage":"review","leg":2,"base":"%s","lanes":{}}' "$BASE" >"$D2/manifest.json"
printf '%s\n%s\n' "$D" "$D2" >"$T/pins/$C.claims"
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C11-shared exit 0" || bad "C11-shared exit 0 (got $CODE: $OUT $ERR)"
[ -d "$T/pins/$C" ] && [ -f "$T/pins/$C.claims" ] \
  && ok "C11-shared pin remains" || bad "C11-shared pin remains"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -qi "another run" \
  && ok "C11-shared summary says so" || bad "C11-shared summary says so"
[ "$(python3 -c "import json;print(json.load(open('$D/manifest.json'))['stage'])")" = "done" ] \
  && ok "C11-shared stage done" || bad "C11-shared stage done"

# --- C12: nothing ends silently ---
mkR
python3 - "$D/run.json" <<'EOF'
import json, sys
p = sys.argv[1]
r = json.load(open(p))
del r["coachman_contract"]
json.dump(r, open(p, "w"))
EOF
snapR
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 1 ] && ok "C12-nocontract exit 1" || bad "C12-nocontract exit 1 (got $CODE: $OUT $ERR)"
assertUnchanged "C12-nocontract"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -qi "contract\|legacy\|abandon" \
  && ok "C12-nocontract named" || bad "C12-nocontract named"
twoLines "C12-nocontract"
mkR
python3 - "$D/manifest.json" <<'EOF'
import json, sys
p = sys.argv[1]
m = json.load(open(p))
m["stage"] = "abandoned"
json.dump(m, open(p, "w"))
EOF
snapR
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 1 ] && ok "C12-abandoned exit 1" || bad "C12-abandoned exit 1 (got $CODE: $OUT $ERR)"
assertUnchanged "C12-abandoned"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -qi "abandon" \
  && ok "C12-abandoned named" || bad "C12-abandoned named"
twoLines "C12-abandoned"
mkR
storeOf
chmod 000 "$STORE/7.json"
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 3 ] && ok "C12-ticket exit 3" || bad "C12-ticket exit 3 (got $CODE: $OUT $ERR)"
foldersGone "C12-ticket"
[ "$(python3 -c "import json;print(json.load(open('$D/manifest.json'))['stage'])")" = "shipped" ] \
  && ok "C12-ticket stage shipped" || bad "C12-ticket stage shipped"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -qi "ticket" \
  && ok "C12-ticket named" || bad "C12-ticket named"
twoLines "C12-ticket"
chmod 644 "$STORE/7.json"
mkR
mkdir -p "$T/state/placements"
printf '{"run":"%s","workspace":"w1","tab":"w1:t1","pane":"w1:p1","cwd":"%s/repo/.worktrees/7-rev-bug-mimo"}' "$D" "$T" >"$T/state/placements/x.json"
cat >"$T/bin/herdr" <<'EOF'
#!/bin/sh
if [ "$1 $2" = "workspace list" ]; then echo '{"result":{"workspaces":[]}}'; exit 0; fi
if [ "$1 $2" = "workspace get" ]; then echo '{"result":{"workspace":{}}}'; exit 0; fi
exit 1
EOF
chmod +x "$T/bin/herdr"
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 3 ] && ok "C12-place exit 3" || bad "C12-place exit 3 (got $CODE: $OUT $ERR)"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -qi "close" \
  && ok "C12-place names close step" || bad "C12-place names close step"
twoLines "C12-place"

# --- C13: every action logged as it happens ---
T=$T1
D=$D1
LEDGER=$T/repo/.postmaster/runs/ledger.jsonl
if [ -f "$LEDGER" ]; then ok "C13 ledger exists"; else bad "C13 ledger exists"; fi
tail -n +"$((BEFORE1 + 1))" "$D/actions.jsonl" >"$T/delta1.txt"
if [ -f "$LEDGER" ] && cmp -s "$T/delta1.txt" "$LEDGER"; then
  ok "C13 ledger matches"
else
  bad "C13 ledger matches"
fi
NON_PM=$(python3 -c "
import json
n = 0
for line in open('$T/delta1.txt', encoding='utf-8'):
    line = line.strip()
    if line and json.loads(line).get('actor') != 'postmaster':
        n += 1
print(n)")
[ "$NON_PM" = 0 ] && ok "C13 actor postmaster" || bad "C13 actor postmaster"
python3 - "$T/delta1.txt" <<'EOF' >"$T/c13.txt"
import json, sys
notes = [json.loads(l) for l in open(sys.argv[1]) if l.strip() and json.loads(l).get("action") == "note"]
tears = [(i, json.loads(l)) for i, l in enumerate(open(sys.argv[1])) if l.strip() and json.loads(l).get("action") == "teardown"]
style = [n for n in notes if "style" in json.dumps(n).lower()]
sol = [n for n in notes if "7-sol" in json.dumps(n)]
ora = [n for n in notes if "7-oracle-sol" in json.dumps(n)]
runlog = [n for n in notes if "run-log" in json.dumps(n).lower() or "run log" in json.dumps(n).lower() or "closing line" in json.dumps(n)]
print(len(style), len(sol), len(ora), len(runlog), len(tears))
EOF
read -r NSTYLE NSOL NORA NRUNLOG NTEAR1 <"$T/c13.txt"
[ "$NSTYLE" -ge 1 ] && ok "C13 style note" || bad "C13 style note"
[ "$NSOL" -ge 1 ] && ok "C13 sol save note" || bad "C13 sol save note"
[ "$NORA" -ge 1 ] && ok "C13 oracle save note" || bad "C13 oracle save note"
[ "$NRUNLOG" -ge 1 ] && ok "C13 run-log note" || bad "C13 run-log note"
[ "$NTEAR1" = 5 ] && ok "C13 five teardowns" || bad "C13 five teardowns (got $NTEAR1)"
# Notes before their folder's teardown.
python3 - "$T/delta1.txt" <<'EOF' >"$T/c13b.txt"
import json, sys
lines = [l for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
def first(pred):
    for i, l in enumerate(lines):
        if pred(json.loads(l), l):
            return i
    return -1
ok = True
for f in ("7-sol", "7-oracle-sol"):
    n = first(lambda e, l, f=f: e.get("action") == "note" and f in l)
    t = first(lambda e, l, f=f: e.get("action") == "teardown" and f in l)
    if not (0 <= n < t):
        ok = False
print("yes" if ok else "no")
EOF
[ "$(cat "$T/c13b.txt")" = yes ] && ok "C13 notes precede teardowns" || bad "C13 notes precede teardowns"
# C7's stop leaves 7-sol a note naming why.
T=$T7
D=$D7
WHY_NOTE=$(python3 -c "
import json
n = 0
for line in open('$D/actions.jsonl', encoding='utf-8'):
    line = line.strip()
    if not line:
        continue
    e = json.loads(line)
    low = line.lower()
    if e.get('action') == 'note' and '7-sol' in line and ('probe' in low or 'running' in low or 'launch' in low or 'in use' in low or 'busy' in low):
        n += 1
print(n)")
[ "$WHY_NOTE" -ge 1 ] && ok "C13 left note names why" || bad "C13 left note names why"

# --- C14: reruns carry on and repeat nothing ---
T=$T1
D=$D1
BEFORE14=$(wc -l <"$D/actions.jsonl")
cp "$D/actions.jsonl" "$T/pre14-actions.txt"
cp "$D/run-log.md" "$T/pre14-runlog.txt"
cp "$D/manifest.json" "$T/pre14-manifest.txt"
ls "$D/stray" >"$T/pre14-stray.txt"
runA --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C14 exit 0" || bad "C14 exit 0 (got $CODE: $OUT $ERR)"
AFTER14=$(wc -l <"$D/actions.jsonl")
[ "$AFTER14" = "$BEFORE14" ] && ok "C14 no new lines" || bad "C14 no new lines"
cmp -s "$D/run-log.md" "$T/pre14-runlog.txt" && ok "C14 run-log same" || bad "C14 run-log same"
cmp -s "$D/manifest.json" "$T/pre14-manifest.txt" && ok "C14 manifest same" || bad "C14 manifest same"
ls "$D/stray" | cmp -s - "$T/pre14-stray.txt" && ok "C14 stray same" || bad "C14 stray same"
printf '%s\n%s\n' "$OUT" "$ERR" | grep -q "already done" \
  && ok "C14 already done" || bad "C14 already done"
# C7's stop, then stop and rerun: only 7-sol's teardown is new.
T=$T7
D=$D7
NTEAR7=$(python3 -c "
import json
n = 0
for line in open('$D/actions.jsonl', encoding='utf-8'):
    line = line.strip()
    if line and json.loads(line).get('action') == 'teardown':
        n += 1
print(n)")
[ "$NTEAR7" = 5 ] && ok "C14 five teardowns total" || bad "C14 five teardowns total (got $NTEAR7)"
SECOND_TEARDOWNS=$(python3 -c "
import json, re
out = []
for line in open('$D/actions.jsonl', encoding='utf-8'):
    line = line.strip()
    if not line:
        continue
    e = json.loads(line)
    if e.get('action') != 'teardown':
        continue
    tgt = str(e.get('target', ''))
    det = str(e.get('detail', ''))
    blob = tgt + '\n' + det
    base = tgt.rsplit('/', 1)[-1]
    folders = [f for f in ('7-sol', '7-mimo', '7-oracle-sol') if f in blob]
    if base == '7' or re.search(r'(?<![\w-])7(?![-\w])', det):
        folders.append('7')
    out.append(' '.join(folders) if folders else 'pin')
print('\n'.join(out))" | tail -n 2)
echo "$SECOND_TEARDOWNS" | grep -q "7-sol" \
  && ok "C14 second run tears 7-sol" || bad "C14 second run tears 7-sol"
if [ "$SECOND_TEARDOWNS" = "$(printf '7-sol\npin')" ]; then
  ok "C14 no second teardown"
else
  bad "C14 no second teardown ($SECOND_TEARDOWNS)"
fi

# --- C15: one record a script can read ---
mkR
runA --json --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C15 exit 0" || bad "C15 exit 0 (got $CODE: $OUT $ERR)"
printf '%s' "$OUT" >"$T/j15.json"
python3 - "$T/j15.json" "$D" <<'EOF' >"$T/c15.txt"
import json, sys
try:
    raw = open(sys.argv[1], encoding="utf-8").read()
    o = json.loads(raw)
    solo = raw.strip().startswith("{") and raw.strip().endswith("}")
except Exception:
    print("no-json 0 0 0 0 0")
    raise SystemExit
keys = ("run" in o) and ("dry_run" in o) and ("outcome" in o) and ("steps" in o) and ("folders" in o) and ("next" in o)
folders = o.get("folders", [])
fok = 0
if isinstance(folders, list) and len(folders) == 4:
    good = 0
    for e in folders:
        last = str(e.get("path", "")).split("/")[-1]
        has = "path" in e and "saves" in e and "result" in e and ("flag" in e or "flagged" in e)
        if last in ("7", "7-sol", "7-mimo", "7-oracle-sol") and has:
            good += 1
    fok = 1 if good == 4 else 0
steps = o.get("steps", [])
sok = 1 if isinstance(steps, list) and len(steps) > 0 and all("name" in s and "status" in s and "detail" in s for s in steps) else 0
print("json", 1 if solo else 0, 1 if keys else 0, fok, sok, 1 if o.get("dry_run") is False else 0)
EOF
read -r J TAG KEYS FOK SOK DRY <"$T/c15.txt"
[ "$J" = json ] && ok "C15 stdout is one object" || bad "C15 stdout is one object"
[ "$TAG" = 1 ] && ok "C15 nothing else" || bad "C15 nothing else"
[ "$KEYS" = 1 ] && ok "C15 keys" || bad "C15 keys"
[ "$FOK" = 1 ] && ok "C15 folders" || bad "C15 folders"
[ "$SOK" = 1 ] && ok "C15 steps" || bad "C15 steps"
[ "$DRY" = 1 ] && ok "C15 dry_run false" || bad "C15 dry_run false"
python3 -c "
import json,sys
o = json.load(open('$T/j15.json'))
sys.exit(0 if 'done' in json.dumps(o.get('outcome')).lower() else 1)" \
  && ok "C15 outcome done" || bad "C15 outcome done"
mkR
runA --dry-run --json --comment "closing words" --run-log "closing line"
[ "$CODE" = 0 ] && ok "C15-dry exit 0" || bad "C15-dry exit 0 (got $CODE)"
printf '%s' "$OUT" >"$T/j15d.json"
python3 -c "
import json,sys
o = json.load(open('$T/j15d.json'))
sys.exit(0 if o.get('dry_run') is True and all(k in o for k in ('run','outcome','steps','folders','next')) else 1)" \
  && ok "C15-dry shape" || bad "C15-dry shape"
# C6 with --json: 7-mimo flagged, naming src/a.ts.
mkR
printf 'export const a = 9;\n' >"$T/repo/.worktrees/7-mimo/src/a.ts"
runA --json --comment "closing words" --run-log "closing line"
printf '%s' "$OUT" >"$T/j15f.json"
[ "$(flagOf "$T/j15f.json" 7-mimo)" = "true" ] && ok "C15-flagged true" || bad "C15-flagged true"
python3 -c "
import json,sys
o = json.load(open('$T/j15f.json'))
hit = [e for e in o.get('folders', []) if str(e.get('path','')).split('/')[-1] == '7-mimo']
sys.exit(0 if hit and 'src/a.ts' in json.dumps(hit[0]) else 1)" \
  && ok "C15-flagged names file" || bad "C15-flagged names file"
[ "$(flagOf "$T/j15f.json" 7-sol)" = "false" ] && [ "$(flagOf "$T/j15f.json" 7-oracle-sol)" = "false" ] \
  && ok "C15-flagged others false" || bad "C15-flagged others false"
# C7 with --json: outcome names the stop, next says what to do.
mkR
hostEnv ./scripts/host.sh run probe "$T/repo/.worktrees/7-sol" --out "$T/o" --err "$T/e" -- sleep 300 >/dev/null || exit 2
runA --json --comment "closing words" --run-log "closing line"
[ "$CODE" = 3 ] && ok "C15-stop exit 3" || bad "C15-stop exit 3 (got $CODE)"
printf '%s' "$OUT" >"$T/j15s.json"
python3 -c "
import json,sys
o = json.load(open('$T/j15s.json'))
out = json.dumps(o.get('outcome')).lower()
nxt = o.get('next')
sys.exit(0 if 'done' not in out and isinstance(nxt, str) and nxt.strip() else 1)" \
  && ok "C15-stop outcome and next" || bad "C15-stop outcome and next"
hostEnv ./scripts/host.sh stop "$T/repo/.worktrees/7-sol" >/dev/null || true

# --- C16: the after-merge instructions call the command ---
python3 - skills/postmaster/postmaster.md <<'EOF' >"$T/stageg.txt"
import re, sys
text = open(sys.argv[1], encoding="utf-8").read()
m = re.search(r"## Stage G \(contract 2\)(.*?)(?=\n## |\Z)", text, re.S)
print(m.group(1) if m else "")
EOF
[ -s "$T/stageg.txt" ] && ok "C16 stage G present" || bad "C16 stage G present"
grep -qi "aftercare" "$T/stageg.txt" && ok "C16 names command" || bad "C16 names command"
grep -qi "dry" "$T/stageg.txt" && ok "C16 dry run" || bad "C16 dry run"
if grep -q "exit 2 or 3" "$T/stageg.txt" \
  || { grep -q "exit 2" "$T/stageg.txt" && grep -q "exit 3" "$T/stageg.txt"; }; then
  ok "C16 exits 2 and 3"
else
  bad "C16 exits 2 and 3"
fi
grep -qi "flag" "$T/stageg.txt" && ok "C16 flagged folders" || bad "C16 flagged folders"
grep -qi "fault" "$T/stageg.txt" && ok "C16 fault to user" || bad "C16 fault to user"
grep -q "host.sh close-run" "$T/stageg.txt" && bad "C16 no close-run step" || ok "C16 no close-run step"
grep -q "worktree remove" "$T/stageg.txt" && bad "C16 no remove step" || ok "C16 no remove step"
grep -q "stage.sh <dispatch> done" "$T/stageg.txt" && bad "C16 no stage-done step" || ok "C16 no stage-done step"
grep -qi "tool fault" "$T/stageg.txt" && ok "C16 tool faults kept" || bad "C16 tool faults kept"
grep -qi "proposal" "$T/stageg.txt" && ok "C16 proposals kept" || bad "C16 proposals kept"
grep -qi "archiv" "$T/stageg.txt" && ok "C16 archiving kept" || bad "C16 archiving kept"
grep -q "aftercare" docs/coachman-contract.toml \
  && ok "C16 contract lists command" || bad "C16 contract lists command"
grep -q "aftercare" skills/postmaster/controls.md \
  && ok "C16 controls lists command" || bad "C16 controls lists command"
./scripts/skill-refs.sh >/dev/null 2>&1 \
  && ok "C16 skill-refs clean" || bad "C16 skill-refs clean"
./scripts/coachman-contract.sh . 40d50ce HEAD >/dev/null 2>&1
[ "$?" = 1 ] && ok "C16 contract change" || bad "C16 contract change"

echo "---"
echo "ok=$ok bad=$bad"
[ "$bad" = 0 ] && exit 0 || exit 1
