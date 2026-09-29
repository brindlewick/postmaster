#!/usr/bin/env bash
# The landing's deterministic checks. The runbooks call this script instead of restating its
# predicates in prose; what it prints is the answer, and prose carries only what an agent must
# judge, such as putting a non-pass to the user.
#
#   landing.sh already-landed --repo <repo> --default <branch> --ticket <ref> --base <sha>
#       --card-head <sha> [--pr-merge <sha>]
#       whether the ticket branch already landed. `landed` when the default branch contains
#       the ticket's HEAD and that HEAD is not the run's BASE, or when --pr-merge names the
#       merge commit of a provider-reported merged pull request whose merge contains the
#       card's final HEAD: by ancestry, or, for a squash or rebase merge, by tree, the merge
#       on the default branch with the card HEAD's tree on every path the ticket changed
#       since BASE. `re-verify`, never `landed`, when the ticket branch moved past the
#       card's HEAD. Otherwise `not-landed`.
#   landing.sh anything-to-land --repo <repo> --default <branch> --ticket <ref> --base <sha>
#       whether the branch holds anything to land. `nothing-to-land` when the ticket's diff
#       against BASE is empty (its HEAD is BASE, whatever the default branch holds), when
#       the default branch contains its HEAD, or when its changes are already on the
#       default branch's tip, as after a squash or rebase merge the provider did not
#       report. Otherwise `land`.
#   landing.sh results <dispatch> <synthesis-wt>
#       every recorded check's result at the worktree's HEAD, one `name: result` line each,
#       as the cards carry them. This is the one place the vocabulary mapping lives:
#       `no result logged` reads as `not run`, and the `at ...` suffix is dropped.
#   landing.sh card-results <dispatch> <synthesis-wt> <card>
#       whether the card's `## Checks` section (`- <name>: <result>` lines) gives every
#       recorded check with the result `results` reports. Prints `match`, or one fault
#       line per check that is missing, wrong, or not a recorded check.
#   landing.sh card-findings <checkpoint> <card>
#       whether the card's open findings match the checkpoint's final states. The checkpoint
#       gives each finding one bullet `- [<severity>] <id>: <state>` with the state `open`,
#       `closed round <n>`, `dismissed: <reason>`, or `applied on user word, not re-reviewed`.
#       Prints `match`, or one fault line per finding that breaks the mapping: an open
#       finding missing from the card's `## Open findings` or at another severity, a closed
#       or dismissed finding on that list, a user-applied finding on that list or missing
#       from the card's `## Not re-reviewed`, or a card id the checkpoint never gives.
#   landing.sh journey <dispatch> <synthesis-wt> <waybill>
#       whether the journey holds landing. `clear` when no check's source names
#       `web-journey`, or when the report exists and the journey check passed. `blocked`
#       when the waybill has a User journey section, a check uses `web-journey`, and the
#       report is missing or the check did not run: missing evidence, not a result to
#       weigh. `judge` when the waybill has no User journey section, or the journey check
#       failed with its report written: the postmaster weighs it like any other non-pass.
#   landing.sh --self-test
#
#   exit 0  already-landed, anything-to-land, results: the answer, printed; card-results,
#           card-findings: `match`; journey: `clear` or `judge`
#   exit 1  usage; a ref or SHA that does not resolve; a file that cannot be read; checks
#           that cannot be recorded-read; `verify.sh results` or `journey-path` failing
#   exit 2  card-results, card-findings: the faults, one line each; journey: `blocked`
set -uo pipefail
HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_NAMESPACE
usage() { echo "usage: landing.sh already-landed --repo <repo> --default <branch> --ticket <ref> --base <sha> --card-head <sha> [--pr-merge <sha>] | anything-to-land --repo <repo> --default <branch> --ticket <ref> --base <sha> | results <dispatch> <synthesis-wt> | card-results <dispatch> <synthesis-wt> <card> | card-findings <checkpoint> <card> | journey <dispatch> <synthesis-wt> <waybill> | --self-test" >&2; exit 1; }

run_py() {  # run_py <subcommand> <args...>; VERIFY names scripts/verify.sh beside this script
  VERIFY="$HERE/verify.sh" python3 - "$@" <<'PY'
import json, os, re, subprocess, sys

VERIFY = os.environ["VERIFY"]

def die(msg):
    print("landing: " + msg, file=sys.stderr); sys.exit(1)

def git(repo, *args):
    r = subprocess.run(["git", "-C", repo] + list(args), capture_output=True, text=True)
    return r.returncode, r.stdout.strip()

def commit(repo, ref, what):
    rc, out = git(repo, "rev-parse", "--verify", "--quiet", ref + "^{commit}")
    if rc != 0 or not out:
        die("%s does not resolve to a commit: %s" % (what, ref))
    return out

def contains(repo, maybe_ancestor, ref):
    rc, _ = git(repo, "merge-base", "--is-ancestor", maybe_ancestor, ref)
    if rc not in (0, 1):
        die("cannot test ancestry of %s in %s" % (maybe_ancestor, ref))
    return rc == 0

def changed(repo, old, new):  # the paths whose content differs, by NUL-split name list
    r = subprocess.run(["git", "-C", repo, "diff", "--name-only", "-z", old, new],
                       capture_output=True, text=True)
    if r.returncode != 0:
        die("cannot diff %s against %s: %s" % (old, new, r.stderr.strip()))
    return set(p for p in r.stdout.split("\0") if p)

def load(path):
    try:
        return open(path, encoding="utf-8", errors="replace").read()
    except OSError as e:
        die("cannot read %s: %s" % (path, e.strerror))

RESULT_LINE = re.compile(r"^([a-z][a-z0-9-]*): (.*)$")
RESULT_WORD = re.compile(r"^(pass|fail|not run),")

def recorded_results(dispatch, wt):  # [(name, result)]: verify.sh results with the mapping read
    r = subprocess.run([VERIFY, "results", dispatch, wt], capture_output=True, text=True)
    if r.returncode == 1:
        die("verify.sh results failed: %s" % (r.stderr.strip() or r.stdout.strip() or "no output"))
    out = []
    for line in r.stdout.splitlines():
        m = RESULT_LINE.match(line)
        if not m:
            die("cannot read a results line: %s" % line)
        rest = m.group(2)
        if rest.startswith("no result logged"):
            out.append((m.group(1), "not run"))
        else:
            w = RESULT_WORD.match(rest)
            if not w:
                die("cannot read a results line: %s" % line)
            out.append((m.group(1), w.group(1)))
    if not out:
        die("verify.sh results reported no checks")
    return out

def section(text, title):  # (found, lines): the ## section's lines, to the next ## or EOF
    found, inside, lines = False, False, []
    for line in text.splitlines():
        m = re.match(r"^##\s+(.*?)\s*$", line)
        if m:
            inside = (m.group(1) == title)
            found = found or inside
            continue
        if inside:
            lines.append(line)
    return found, lines

CHECK_BULLET = re.compile(r"^\s*[-*]\s+([a-z][a-z0-9-]*)\s*:\s*(.*?)\s*$")
FINDING = re.compile(r"^\s*[-*]\s+\[(P[123])\]\s+([A-Za-z0-9][A-Za-z0-9_.+-]*)\s*:\s*(.+?)\s*$")
OPENREF = re.compile(r"^\s*[-*]\s+\[(P[123])\]\s+([A-Za-z0-9][A-Za-z0-9_.+-]*)\b")
CLOSED = re.compile(r"^closed round (\d+)$")
DISMISSED = re.compile(r"^dismissed:\s*(.+?)\s*$")
USER_APPLIED = "applied on user word, not re-reviewed"

def finding_state(words):
    if words == "open":
        return "open"
    if CLOSED.match(words):
        return "closed"
    if DISMISSED.match(words):
        return "dismissed"
    if words == USER_APPLIED:
        return "user-applied"
    return None

mode = sys.argv[1]

if mode == "already-landed":
    o = sys.argv[2:]
    if len(o) not in (10, 12) or o[0] != "--repo" or o[2] != "--default" or o[4] != "--ticket" \
            or o[6] != "--base" or o[8] != "--card-head" \
            or (len(o) == 12 and o[10] != "--pr-merge"):
        print("usage: landing.sh already-landed --repo <repo> --default <branch> --ticket <ref> "
              "--base <sha> --card-head <sha> [--pr-merge <sha>]", file=sys.stderr); sys.exit(1)
    repo, default, ticket, base = o[1], o[3], o[5], commit(o[1], o[7], "--base")
    head = commit(repo, ticket, "--ticket")
    card = commit(repo, o[9], "--card-head")
    commit(repo, default, "--default")
    if head != card:
        print("re-verify"); sys.exit(0)
    landed = contains(repo, head, default) and head != base
    if not landed and len(o) == 12:
        merge = commit(repo, o[11], "--pr-merge")
        landed = contains(repo, card, merge) or (
            contains(repo, merge, default) and bool(changed(repo, base, card))
            and changed(repo, base, card).isdisjoint(changed(repo, card, merge)))
    print("landed" if landed else "not-landed"); sys.exit(0)

if mode == "anything-to-land":
    o = sys.argv[2:]
    if len(o) != 8 or o[0] != "--repo" or o[2] != "--default" or o[4] != "--ticket" or o[6] != "--base":
        print("usage: landing.sh anything-to-land --repo <repo> --default <branch> --ticket <ref> "
              "--base <sha>", file=sys.stderr); sys.exit(1)
    repo, default, ticket = o[1], o[3], o[5]
    base = commit(repo, o[7], "--base")
    head = commit(repo, ticket, "--ticket")
    tip = commit(repo, default, "--default")
    paths = changed(repo, base, head)
    if not paths or contains(repo, head, default) or paths.isdisjoint(changed(repo, head, tip)):
        print("nothing-to-land")
    else:
        print("land")
    sys.exit(0)

if mode == "results":
    if len(sys.argv) != 4:
        print("usage: landing.sh results <dispatch> <synthesis-wt>", file=sys.stderr); sys.exit(1)
    for name, result in recorded_results(sys.argv[2], sys.argv[3]):
        print("%s: %s" % (name, result))
    sys.exit(0)

if mode == "card-results":
    if len(sys.argv) != 5:
        print("usage: landing.sh card-results <dispatch> <synthesis-wt> <card>", file=sys.stderr)
        sys.exit(1)
    want = recorded_results(sys.argv[2], sys.argv[3])
    found, lines = section(load(sys.argv[4]), "Checks")
    faults, card = [], {}
    if not found:
        faults.append("card: no ## Checks section")
    else:
        for line in lines:
            m = CHECK_BULLET.match(line)
            if not m:
                continue
            name, words = m.group(1), m.group(2)
            if name in card:
                faults.append("%s: listed twice" % name)
            elif words not in ("pass", "fail", "not run"):
                faults.append("%s: unreadable result: %s" % (name, words))
            else:
                card[name] = words
    for name, result in want:
        if name not in card:
            faults.append("%s: missing: results says %s" % (name, result))
        elif card[name] != result:
            faults.append("%s: card says %s, results says %s" % (name, card[name], result))
    for name in card:
        if name not in dict(want):
            faults.append("%s: not a recorded check" % name)
    if faults:
        print("\n".join(faults)); sys.exit(2)
    print("match"); sys.exit(0)

if mode == "card-findings":
    if len(sys.argv) != 4:
        print("usage: landing.sh card-findings <checkpoint> <card>", file=sys.stderr); sys.exit(1)
    checkpoint, card_text = load(sys.argv[2]), load(sys.argv[3])
    faults, states = [], {}
    for line in checkpoint.splitlines():
        m = FINDING.match(line)
        if not m:
            continue
        sev, fid, words = m.group(1), m.group(2), m.group(3)
        if fid in states:
            faults.append("checkpoint: %s: listed twice" % fid)
            continue
        state = finding_state(words)
        if state is None:
            faults.append("checkpoint: %s: unreadable state: %s" % (fid, words))
            continue
        states[fid] = (sev, state)
    _, open_lines = section(card_text, "Open findings")
    _, nrr_lines = section(card_text, "Not re-reviewed")
    open_list, nrr = {}, set()
    for line in open_lines:
        m = OPENREF.match(line)
        if m:
            open_list[m.group(2)] = m.group(1)
    for line in nrr_lines:
        m = OPENREF.match(line)
        if m:
            nrr.add(m.group(2))
    for fid, (sev, state) in states.items():
        if state == "open":
            if fid not in open_list:
                faults.append("%s: open in the checkpoint, missing from the card's open list" % fid)
            elif open_list[fid] != sev:
                faults.append("%s: open at %s in the checkpoint, at %s on the card"
                              % (fid, sev, open_list[fid]))
        elif state in ("closed", "dismissed"):
            if fid in open_list:
                faults.append("%s: %s in the checkpoint, on the card's open list" % (fid, state))
        else:  # user-applied
            if fid in open_list:
                faults.append("%s: applied on user word, on the card's open list" % fid)
            if fid not in nrr:
                faults.append("%s: applied on user word, not marked not re-reviewed" % fid)
    for fid in open_list:
        if fid not in states:
            faults.append("%s: on the card's open list, not in the checkpoint" % fid)
    if faults:
        print("\n".join(faults)); sys.exit(2)
    print("match"); sys.exit(0)

if mode == "journey":
    if len(sys.argv) != 5:
        print("usage: landing.sh journey <dispatch> <synthesis-wt> <waybill>", file=sys.stderr)
        sys.exit(1)
    dispatch, wt, waybill = sys.argv[2], sys.argv[3], sys.argv[4]
    try:
        checks = json.load(open(dispatch + "/checks.json", encoding="utf-8"))["checks"]
    except (OSError, ValueError, KeyError, TypeError):
        die("cannot read %s/checks.json" % dispatch)
    names = [c["name"] for c in checks
             if isinstance(c, dict) and str(c.get("source", "")).split(":")[-1] == "web-journey"
             and isinstance(c.get("name"), str)]
    if not names:
        print("clear: no check uses web-journey"); sys.exit(0)
    if not re.search(r"^#{1,6}[ \t]+user journey[ \t]*$", load(waybill), re.M | re.I):
        print("judge: no User journey section; %s judged like any other non-pass"
              % ", ".join(names)); sys.exit(0)
    r = subprocess.run([VERIFY, "journey-path", wt, dispatch], capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.strip():
        die("verify.sh journey-path failed: %s" % (r.stderr.strip() or "no output"))
    report = r.stdout.strip().splitlines()[0]
    try:
        missing = not open(report, "rb").read(1)
    except OSError:
        missing = True
    if missing:
        print("blocked: %s: no journey report at %s" % (", ".join(names), report)); sys.exit(2)
    judges = []
    got = dict(recorded_results(dispatch, wt))
    for name in names:
        result = got.get(name, "not run")
        if result == "not run":
            print("blocked: %s: not run; the journey has no evidence" % name)
            sys.exit(2)
        if result == "fail":
            judges.append(name)
    if judges:
        print("judge: %s failed with its report at %s; weigh it" % (", ".join(judges), report))
        sys.exit(0)
    print("clear: %s walked: report at %s" % (", ".join(names), report)); sys.exit(0)

die("unknown subcommand: " + mode)
PY
}

case ${1:-} in
  --self-test) ;;
  already-landed|anything-to-land) run_py "$@"; exit $? ;;
  results|card-results|card-findings|journey) run_py "$@"; exit $? ;;
  *) usage ;;
esac

# --- self-test ----------------------------------------------------------------------------
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
SELF="$HERE/landing.sh"
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/         /'; fails=$((fails+1)); }

mkrepo() {  # mkrepo <dir>: a git repo with a main branch and a commit identity
  git init -q -b main "$1" || exit 1
  git -C "$1" config user.email t@t && git -C "$1" config user.name t \
    && git -C "$1" config commit.gpgsign false || exit 1
}
commit() {  # commit <repo> <file> <content> <msg>: write, add, commit
  printf '%s\n' "$3" > "$1/$2"
  git -C "$1" add "$2" && git -C "$1" commit -qm "$4" || exit 1
}

# A repo with every landing shape: main holds A-B, the ticket branch T1-T2 off B, main
# advanced past B, a --no-ff merge of another branch, and a squash of a third.
R=$tmp/r; mkrepo "$R"
commit "$R" f A A; commit "$R" f B B
BASE=$(git -C "$R" rev-parse HEAD)
git -C "$R" checkout -qb ticket || exit 1
commit "$R" f T1 T1; T1=$(git -C "$R" rev-parse HEAD)
commit "$R" g T2 T2; TIP=$(git -C "$R" rev-parse HEAD)
git -C "$R" checkout -q main || exit 1
commit "$R" f M1 M1
git -C "$R" checkout -qb side || exit 1; commit "$R" s S S
git -C "$R" checkout -q main || exit 1
git -C "$R" merge -q --no-ff -m merge side || exit 1; NOMERGE=$(git -C "$R" rev-parse HEAD)
git -C "$R" checkout -qb sq || exit 1; commit "$R" q Q Q
git -C "$R" checkout -q main || exit 1
git -C "$R" merge -q --squash sq || exit 1; git -C "$R" commit -qm squash || exit 1

expect() {  # expect <label> <want-exit> <want-stdout>; the command's in "$out"/"$rc"
  if [ "$rc" -eq "$2" ] && [ "$out" = "$3" ]; then ok "$1";
  else fail "$1: wanted exit $2 printing [$3], got exit $rc" "$out"; fi
}

echo "already-landed"
out=$("$SELF" already-landed --repo "$R" --default main --ticket "$TIP" --base "$BASE" --card-head "$TIP" 2>&1); rc=$?
expect "an unmerged branch is not landed" 0 "not-landed"
git -C "$R" checkout -q ticket || exit 1   # the default branch moves past an empty branch
git -C "$R" branch -qf empty "$BASE"
out=$("$SELF" already-landed --repo "$R" --default main --ticket empty --base "$BASE" --card-head "$BASE" 2>&1); rc=$?
expect "an empty branch after the default branch moves is not landed" 0 "not-landed"
FF=$tmp/ff; mkrepo "$FF"
commit "$FF" f A A; B2=$(git -C "$FF" rev-parse HEAD)
git -C "$FF" checkout -qb ticket || exit 1; commit "$FF" f T T; H2=$(git -C "$FF" rev-parse HEAD)
git -C "$FF" checkout -q main || exit 1; git -C "$FF" merge -q --ff-only ticket || exit 1
out=$("$SELF" already-landed --repo "$FF" --default main --ticket ticket --base "$B2" --card-head "$H2" 2>&1); rc=$?
expect "a fast-forward merge is landed" 0 "landed"
out=$("$SELF" already-landed --repo "$R" --default main --ticket side --base "$BASE" --card-head "$(git -C "$R" rev-parse side)" 2>&1); rc=$?
expect "a --no-ff merge is landed" 0 "landed"
out=$("$SELF" already-landed --repo "$R" --default main --ticket sq --base "$BASE" --card-head "$(git -C "$R" rev-parse sq)" 2>&1); rc=$?
expect "a squash merge the provider did not report is not landed" 0 "not-landed"
SQM=$(git -C "$R" rev-parse main)
out=$("$SELF" already-landed --repo "$R" --default main --ticket sq --base "$BASE" --card-head "$(git -C "$R" rev-parse sq)" --pr-merge "$SQM" 2>&1); rc=$?
expect "a squash merge counts when its merge has the card HEAD's tree" 0 "landed"
out=$("$SELF" already-landed --repo "$R" --default main --ticket sq --base "$BASE" --card-head "$(git -C "$R" rev-parse sq)" --pr-merge "$NOMERGE" 2>&1); rc=$?
expect "a merge without the card HEAD's content does not count" 0 "not-landed"
git -C "$R" checkout -qb moved "$TIP" || exit 1; commit "$R" f T3 T3
out=$("$SELF" already-landed --repo "$R" --default main --ticket moved --base "$BASE" --card-head "$TIP" 2>&1); rc=$?
expect "a branch past the card's HEAD says re-verify, never landed" 0 "re-verify"
out=$("$SELF" already-landed --repo "$R" --default main --ticket side --base "$BASE" --card-head "$NOMERGE" --pr-merge "$NOMERGE" 2>&1); rc=$?
expect "a moved branch says re-verify even where the merge is real" 0 "re-verify"
RB=$tmp/rb; mkrepo "$RB"   # a rebase merge: the content on main, the commits not ancestors
commit "$RB" f A A; RB0=$(git -C "$RB" rev-parse HEAD)
git -C "$RB" checkout -qb ticket || exit 1; commit "$RB" f T T; RBH=$(git -C "$RB" rev-parse HEAD)
git -C "$RB" checkout -q main || exit 1; git -C "$RB" checkout -q ticket -- f || exit 1
git -C "$RB" commit -qm rebase-merge || exit 1; RBM=$(git -C "$RB" rev-parse HEAD)
out=$("$SELF" already-landed --repo "$RB" --default main --ticket ticket --base "$RB0" --card-head "$RBH" --pr-merge "$RBM" 2>&1); rc=$?
expect "a rebase merge counts by tree" 0 "landed"
out=$("$SELF" already-landed --repo "$R" --default main --ticket missing --base "$BASE" --card-head "$TIP" 2>&1); rc=$?
[ "$rc" -eq 1 ] && ok "an unresolvable ticket ref is usage, not an answer" || fail "an unresolvable ticket ref is usage, not an answer" "$out"
out=$("$SELF" already-landed --repo "$R" --default main --ticket ticket 2>&1); rc=$?
[ "$rc" -eq 1 ] && ok "missing flags are usage" || fail "missing flags are usage" "$out"

echo "anything-to-land"
out=$("$SELF" anything-to-land --repo "$R" --default main --ticket "$TIP" --base "$BASE" 2>&1); rc=$?
expect "an unmerged branch with commits lands" 0 "land"
out=$("$SELF" anything-to-land --repo "$FF" --default main --ticket ticket --base "$B2" 2>&1); rc=$?
expect "a fast-forwarded branch holds nothing to land" 0 "nothing-to-land"
out=$("$SELF" anything-to-land --repo "$R" --default main --ticket empty --base "$BASE" 2>&1); rc=$?
expect "an empty branch holds nothing to land" 0 "nothing-to-land"
RW=$tmp/rw; mkrepo "$RW"   # reset to BASE with the default branch rewritten past it
commit "$RW" f A A; RWA=$(git -C "$RW" rev-parse HEAD)
commit "$RW" f B B; RWB=$(git -C "$RW" rev-parse HEAD)
git -C "$RW" checkout -qb ticket "$RWB" || exit 1
git -C "$RW" branch -qf main "$RWA" || exit 1
out=$("$SELF" anything-to-land --repo "$RW" --default main --ticket ticket --base "$RWB" 2>&1); rc=$?
expect "a branch reset to BASE lands nothing when the default branch is rewritten" 0 "nothing-to-land"
out=$("$SELF" anything-to-land --repo "$R" --default main --ticket sq --base "$BASE" 2>&1); rc=$?
expect "a squash-merged branch lands nothing without the provider saying so" 0 "nothing-to-land"
git -C "$R" checkout -q main || exit 1; git -C "$R" checkout -q ticket -- f || exit 1
git -C "$R" commit -qm partial || exit 1   # main gains f's content but not g's
out=$("$SELF" anything-to-land --repo "$R" --default main --ticket "$TIP" --base "$BASE" 2>&1); rc=$?
expect "a partly landed branch still lands" 0 "land"
git -C "$R" checkout -qb zero "$BASE" || exit 1; git -C "$R" commit -q --allow-empty -m zero || exit 1
out=$("$SELF" anything-to-land --repo "$RW" --default main --ticket ticket --base "$RWB" 2>&1); rc=$?
expect "the rewritten shape still answers after later fixtures move" 0 "nothing-to-land"
out=$("$SELF" anything-to-land --repo "$R" --default main --ticket zero --base "$BASE" 2>&1); rc=$?
expect "an empty commit on BASE lands nothing" 0 "nothing-to-land"
out=$("$SELF" anything-to-land --repo "$R" --default main --ticket missing --base "$BASE" 2>&1); rc=$?
[ "$rc" -eq 1 ] && ok "an unresolvable ticket ref is usage, not an answer" || fail "an unresolvable ticket ref is usage, not an answer" "$out"

# A dispatch with two recorded checks, one passed at the worktree's HEAD, one never run.
D=$tmp/d; W=$tmp/wt; mkrepo "$W"; commit "$W" f X X
SHA12=$(git -C "$W" rev-parse HEAD | cut -c1-12)
mkdir "$D"
printf '{"checks": [{"name": "gate", "source": "default:gate", "command": "true", "shows": "x"}, {"name": "unit", "source": "declared:unit", "command": "true", "shows": "x"}]}\n' > "$D/checks.json"
printf '{"action": "verify", "target": "gate", "ts": "2026-01-01T00:00:00Z", "detail": "on=main@%s result=pass exit=0 secs=1"}\n' "$SHA12" > "$D/actions.jsonl"
printf '# Card\n\n## Checks\n\n- gate: pass\n- unit: not run\n' > "$D/card.md"

echo "results"
out=$("$SELF" results "$D" "$W" 2>&1); rc=$?
expect "results prints each check with the mapping read" 0 "gate: pass
unit: not run"
out=$("$SELF" results "$tmp" "$W" 2>&1); rc=$?
[ "$rc" -eq 1 ] && ok "a dispatch with no record is usage, not results" || fail "a dispatch with no record is usage, not results" "$out"

echo "card-results"
out=$("$SELF" card-results "$D" "$W" "$D/card.md" 2>&1); rc=$?
expect "a card giving no result logged as not run matches" 0 "match"
printf '# Card\n\n## Checks\n\n- gate: pass\n- unit: pass\n' > "$D/card-wrong.md"
out=$("$SELF" card-results "$D" "$W" "$D/card-wrong.md" 2>&1); rc=$?
expect "a card giving it as pass faults" 2 "unit: card says pass, results says not run"
printf '# Card\n\n## Checks\n\n- gate: pass\n' > "$D/card-short.md"
out=$("$SELF" card-results "$D" "$W" "$D/card-short.md" 2>&1); rc=$?
expect "a card missing a check faults" 2 "unit: missing: results says not run"
printf '# Card\n\n## Checks\n\n- gate: pass\n- unit: not run\n- stray: pass\n' > "$D/card-extra.md"
out=$("$SELF" card-results "$D" "$W" "$D/card-extra.md" 2>&1); rc=$?
expect "a card naming a check results never printed faults" 2 "stray: not a recorded check"
printf '# Card\n\nNo checks section.\n' > "$D/card-bare.md"
out=$("$SELF" card-results "$D" "$W" "$D/card-bare.md" 2>&1); rc=$?
expect "a card with no Checks section faults" 2 "card: no ## Checks section
gate: missing: results says pass
unit: missing: results says not run"

echo "card-findings"
printf '%s\n' "## Findings (bug)" "" "- [P1] bug-1: open" "- [P2] bug-2: closed round 2" \
  "## Findings (security)" "" "- [P2] sec-1: dismissed: not reachable" "- [P2] sec-2: applied on user word, not re-reviewed" > "$D/checkpoint.md"
printf '%s\n' "# Card" "" "## Open findings" "" "- [P1] bug-1: the bypass" "" "## Not re-reviewed" "" "- [P2] sec-2" > "$D/card-f.md"
out=$("$SELF" card-findings "$D/checkpoint.md" "$D/card-f.md" 2>&1); rc=$?
expect "all four states carried rightly match" 0 "match"
printf '%s\n' "# Card" "" "## Open findings" "" "- [P2] bug-1: the bypass" "" "## Not re-reviewed" "" "- [P2] sec-2" > "$D/card-sev.md"
out=$("$SELF" card-findings "$D/checkpoint.md" "$D/card-sev.md" 2>&1); rc=$?
expect "an open finding at another severity faults" 2 "bug-1: open at P1 in the checkpoint, at P2 on the card"
printf '%s\n' "# Card" "" "## Open findings" "" "none" "" "## Not re-reviewed" "" "- [P2] sec-2" > "$D/card-drop.md"
out=$("$SELF" card-findings "$D/checkpoint.md" "$D/card-drop.md" 2>&1); rc=$?
expect "an open finding dropped from the card faults" 2 "bug-1: open in the checkpoint, missing from the card's open list"
printf '%s\n' "# Card" "" "## Open findings" "" "- [P1] bug-1: the bypass" "- [P2] bug-2: closed?" "" "## Not re-reviewed" "" "- [P2] sec-2" > "$D/card-closed.md"
out=$("$SELF" card-findings "$D/checkpoint.md" "$D/card-closed.md" 2>&1); rc=$?
expect "a closed finding on the open list faults" 2 "bug-2: closed in the checkpoint, on the card's open list"
printf '%s\n' "# Card" "" "## Open findings" "" "- [P1] bug-1: the bypass" "- [P2] sec-1: dismissed?" "" "## Not re-reviewed" "" "- [P2] sec-2" > "$D/card-dism.md"
out=$("$SELF" card-findings "$D/checkpoint.md" "$D/card-dism.md" 2>&1); rc=$?
expect "a dismissed finding on the open list faults" 2 "sec-1: dismissed in the checkpoint, on the card's open list"
printf '%s\n' "# Card" "" "## Open findings" "" "- [P1] bug-1: the bypass" "- [P2] sec-2: applied?" "" "## Not re-reviewed" "" "- [P2] sec-2" > "$D/card-useropen.md"
out=$("$SELF" card-findings "$D/checkpoint.md" "$D/card-useropen.md" 2>&1); rc=$?
expect "a user-applied finding on the open list faults" 2 "sec-2: applied on user word, on the card's open list"
printf '%s\n' "# Card" "" "## Open findings" "" "- [P1] bug-1: the bypass" "" "## Not re-reviewed" "" "none" > "$D/card-usermark.md"
out=$("$SELF" card-findings "$D/checkpoint.md" "$D/card-usermark.md" 2>&1); rc=$?
expect "a user-applied finding unmarked faults" 2 "sec-2: applied on user word, not marked not re-reviewed"
printf '%s\n' "# Card" "" "## Open findings" "" "- [P1] bug-1: the bypass" "- [P3] bug-9: unknown" "" "## Not re-reviewed" "" "- [P2] sec-2" > "$D/card-stray.md"
out=$("$SELF" card-findings "$D/checkpoint.md" "$D/card-stray.md" 2>&1); rc=$?
expect "a card id the checkpoint never gives faults" 2 "bug-9: on the card's open list, not in the checkpoint"

echo "journey"
printf '{"checks": [{"name": "gate", "source": "default:gate", "command": "true", "shows": "x"}, {"name": "journey", "source": "default:web-journey", "command": "true", "shows": "x"}]}\n' > "$D/jchecks.json"
J=$tmp/jd; mkdir "$J"; cp "$D/jchecks.json" "$J/checks.json"
JW=$tmp/jwt; mkrepo "$JW"; commit "$JW" f X X
JSHA12=$(git -C "$JW" rev-parse HEAD | cut -c1-12)
JREP=$("$HERE/verify.sh" journey-path "$JW" "$J") || exit 1
printf '# T\n\n## Problem / feature\nA change.\n' > "$J/plain.md"
printf '# T\n\n## Problem / feature\nA change.\n\n## User journey\n1. Open it.\n' > "$J/journey.md"
printf '{"action": "verify", "target": "gate", "ts": "2026-01-01T00:00:00Z", "detail": "on=main@%s result=pass exit=0 secs=1"}\n' "$JSHA12" > "$J/actions.jsonl"
printf '{"checks": [{"name": "gate", "source": "default:gate", "command": "true", "shows": "x"}]}\n' > "$tmp/nj.json"
NJ=$tmp/njd; mkdir "$NJ"; cp "$tmp/nj.json" "$NJ/checks.json"; cp "$J/actions.jsonl" "$NJ/actions.jsonl"
out=$("$SELF" journey "$NJ" "$JW" "$J/journey.md" 2>&1); rc=$?
expect "no check using web-journey is clear" 0 "clear: no check uses web-journey"
out=$("$SELF" journey "$J" "$JW" "$J/plain.md" 2>&1); rc=$?
expect "no User journey section is judged, not blocked" 0 "judge: no User journey section; journey judged like any other non-pass"
out=$("$SELF" journey "$J" "$JW" "$J/journey.md" 2>&1); rc=$?
expect "a missing report blocks" 2 "blocked: journey: no journey report at $JREP"
mkdir -p "$(dirname "$JREP")" && printf 'walked\n' > "$JREP"
out=$("$SELF" journey "$J" "$JW" "$J/journey.md" 2>&1); rc=$?
expect "a journey that did not run blocks with its report written" 2 "blocked: journey: not run; the journey has no evidence"
printf '{"action": "verify", "target": "journey", "ts": "2026-01-01T00:00:00Z", "detail": "on=main@%s result=not-run exit=3 secs=1"}\n' "$JSHA12" >> "$J/actions.jsonl"
out=$("$SELF" journey "$J" "$JW" "$J/journey.md" 2>&1); rc=$?
expect "a logged not run blocks" 2 "blocked: journey: not run; the journey has no evidence"
printf '{"action": "verify", "target": "journey", "ts": "2026-01-01T00:00:01Z", "detail": "on=main@%s result=fail exit=1 secs=1"}\n' "$JSHA12" >> "$J/actions.jsonl"
out=$("$SELF" journey "$J" "$JW" "$J/journey.md" 2>&1); rc=$?
expect "a failed journey with its report is judged" 0 "judge: journey failed with its report at $JREP; weigh it"
printf '{"action": "verify", "target": "journey", "ts": "2026-01-01T00:00:02Z", "detail": "on=main@%s result=pass exit=0 secs=1"}\n' "$JSHA12" >> "$J/actions.jsonl"
out=$("$SELF" journey "$J" "$JW" "$J/journey.md" 2>&1); rc=$?
expect "a walked journey is clear" 0 "clear: journey walked: report at $JREP"

echo
if [ "$fails" -eq 0 ]; then echo "landing: all self-test controls behaved"; exit 0; fi
echo "landing: $fails control(s) misbehaved"; exit 1
