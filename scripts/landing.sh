#!/usr/bin/env bash
# The landing's deterministic checks. The runbooks call this script instead of restating its
# predicates in prose; what it prints is the answer, and prose carries only what an agent must
# judge, such as putting a non-pass to the user.
#
#   landing.sh already-landed --repo <repo> --default <branch> --ticket <ref> --base <sha>
#       --card-head <sha> [--local-ticket <branch>] [--pr-merge <sha> --pr-head <sha>]
#       whether the ticket branch already landed. `landed` when the default branch contains
#       the ticket's HEAD and that HEAD is not the run's BASE, or when the provider reports
#       the pull request merged at the card's HEAD: --pr-merge names the merge commit it
#       reports, --pr-head the head it reports the pull request merged at, the merge is on
#       the default branch, and the reported head equals the card's HEAD. No content is
#       compared: a squash or rebase merge counts only as one the provider reports, with
#       both SHAs from its report, never from the local ticket ref, so a pruned or deleted
#       branch still answers. `unpushed` when --local-ticket names the local branch, it is
#       at the card's HEAD, and the ticket ref is behind that HEAD: push, re-fetch, and ask
#       again. `re-verify`, never `landed`, when the ticket ref and the card's HEAD
#       otherwise differ, or when a reported merge names another head: a reported
#       head that does not resolve locally names another head too, since the card's
#       HEAD resolved. Otherwise `not-landed`.
#   landing.sh anything-to-land --repo <repo> --default <branch> --ticket <ref> --base <sha>
#       whether the branch holds anything to land. `nothing-to-land` when the ticket's diff
#       against BASE is empty (its HEAD is BASE, whatever the default branch holds), or when
#       the default branch contains its HEAD. Otherwise `land`: a squash merge the provider
#       did not report is out of scope, and the pull request shows a person what landed.
#   landing.sh fresh --repo <repo> --default <branch> --ticket <ref>
#       --dispatch <dispatch> --wt <synthesis-wt>
#       whether the ticket is fresh to land. Prints `fresh` when the ticket branch contains
#       the current default branch, the worktree is at the ticket's head, and `verify.sh
#       results` shows the gate passing at that head. Otherwise one fault line each for the
#       head the worktree is not at, the default branch the ticket lacks, and the gate
#       that is not passing.
#   landing.sh results <dispatch> <synthesis-wt>
#       every recorded check's result at the worktree's HEAD, one `name: result` line each,
#       as the cards carry them. This is the one place the vocabulary mapping lives:
#       `no result logged` reads as `not run`, and the `at ...` suffix is dropped.
#   landing.sh card-block <dispatch> <synthesis-wt> <checkpoint>
#       the card's checked sections rendered from their sources as one exact block of
#       text: `## Checks` with one `- <name>: <result>` bullet per recorded check in
#       recorded order, then `## Open findings` with one `- [<severity>] <id>` bullet
#       per open checkpoint finding in file order, then `## Not re-reviewed` with one
#       `- [<severity>] <id>` bullet per user-applied finding in file order; an empty
#       section renders as `none`. The checkpoint gives each finding one bullet
#       `- [<severity>] <id>: <state>` with the state `open`, `closed round <n>`,
#       `dismissed: <reason>`, or `applied on user word, not re-reviewed`; a `-`, `*`
#       or `+` bullet starting `[`, or a numbered or bare line shaped as a finding
#       (`[` plus severity digit, an id, then a colon or end of line), that is not
#       such a finding is an input fault. A fence marker line is an input fault too.
#       The review leg writes this block into the card verbatim. Prints the block.
#   landing.sh card-results <dispatch> <synthesis-wt> <checkpoint> <card>
#   landing.sh card-findings <dispatch> <synthesis-wt> <checkpoint> <card>
#       whether the card holds the block `card-block` renders, as an exact, contiguous
#       byte string, found once. Nothing is parsed: a card holding `<!--` anywhere is an
#       input fault, and otherwise a card whose block differs in any way, or that holds
#       it never or more than once, is an input fault, never `match`. A card quoting
#       `<!--` escapes it, for example as `&lt;!--`. A copy inside a
#       code fence is text a reader sees, so it counts like any other copy.
#   landing.sh card-open <checkpoint>
#       the checkpoint's open P1 and P2 findings, one `- [<severity>] <id>` bullet
#       each, or `none`. Open P3 residue prints `none`: it lands.
#   landing.sh journey <dispatch> <synthesis-wt> <waybill>
#       whether the journey holds landing. Whether the waybill mentions a user journey
#       is asked of `ticket-check.sh --has-journey`, the flow's one reading of a ticket.
#       `clear` when no check's source names `web-journey`, or when the report exists and
#       the journey check passed. `blocked` when the waybill mentions one, a check uses
#       `web-journey`, and the report is missing or the check did not run: missing
#       evidence, not a result to weigh. `judge` when the waybill mentions none, or the
#       journey check failed with its report written: the postmaster weighs it like any
#       other non-pass.
#   landing.sh --self-test
#
#   exit 0  already-landed, anything-to-land, results, card-block, card-open: the answer,
#           printed; card-results, card-findings: `match`; journey: `clear` or `judge`;
#           fresh: `fresh`
#   exit 1  usage; a resolving input that does not resolve (--default, --base,
#           --card-head, --local-ticket, --pr-merge, and --ticket without a
#           report: --pr-head answers `re-verify` instead); a file that cannot
#           be read; checks
#           that cannot be recorded-read; `verify.sh results`, `journey-path` or
#           `ticket-check.sh --has-journey` failing; a checkpoint whose structure cannot
#           be read (a duplicate id, a finding-shaped line that is not a finding, an
#           unreadable state, a fence marker line, or a quoted line); a card holding an
#           HTML comment or not holding the rendered block exactly once
#   exit 2  fresh: the faults, one line each; journey: `blocked`
set -uo pipefail
HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_NAMESPACE
usage() { echo "usage: landing.sh already-landed --repo <repo> --default <branch> --ticket <ref> --base <sha> --card-head <sha> [--local-ticket <branch>] [--pr-merge <sha> --pr-head <sha>] | anything-to-land --repo <repo> --default <branch> --ticket <ref> --base <sha> | fresh --repo <repo> --default <branch> --ticket <ref> --dispatch <dispatch> --wt <synthesis-wt> | results <dispatch> <synthesis-wt> | card-block <dispatch> <synthesis-wt> <checkpoint> | card-results <dispatch> <synthesis-wt> <checkpoint> <card> | card-findings <dispatch> <synthesis-wt> <checkpoint> <card> | card-open <checkpoint> | journey <dispatch> <synthesis-wt> <waybill> | --self-test" >&2; exit 1; }

run_py() {  # run_py <subcommand> <args...>; VERIFY and TICKET_CHECK name the scripts beside this one
  VERIFY="$HERE/verify.sh" TICKET_CHECK="$HERE/ticket-check.sh" python3 - "$@" <<'PY'
import json, os, re, subprocess, sys

VERIFY = os.environ["VERIFY"]
TICKET_CHECK = os.environ["TICKET_CHECK"]

def die(msg):
    print("landing: " + msg, file=sys.stderr); sys.exit(1)

def git(repo, *args):  # bytes in, surrogate-escaped: git output is not always UTF-8
    r = subprocess.run(["git", "-C", repo] + list(args), capture_output=True)
    return r.returncode, r.stdout.decode("utf-8", "surrogateescape").strip()

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
    # Rename detection stays off: it names a rename by its new path one way and its old
    # path the other. Submodule differences are never ignored: the argv flag beats even
    # per-submodule ignore config, where -c would lose to it. A bumped gitlink is a path
    # the ticket changed.
    r = subprocess.run(["git", "-C", repo, "diff", "--no-renames", "--ignore-submodules=none",
                        "--name-only", "-z", old, new],
                       capture_output=True)
    if r.returncode != 0:
        die("cannot diff %s against %s: %s"
            % (old, new, r.stderr.decode("utf-8", "surrogateescape").strip()))
    return set(p for p in r.stdout.decode("utf-8", "surrogateescape").split("\0") if p)

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

FENCE_MARK = re.compile(r"^\s*(?:(?:[-*+]|\d{1,9}[.)])\s+)?(`{3,}|~{3,})")

def refuse_fences(text, which):  # no fence semantics: a marker line is an input fault
    for line in text.splitlines():
        if FENCE_MARK.match(line):
            die("%s: fence marker line: %s" % (which, line.strip()))
def refuse_quotes(text, which):  # nothing is unquoted: a quoted line is an input fault
    for line in text.splitlines():
        if re.match(r"^\s*>", line):
            die("%s: quoted line: %s" % (which, line.strip()))
def refuse_comments(text, which):  # neither the card nor the checkpoint needs a comment
    if "<!--" in text:
        die("%s: contains an HTML comment" % which)

FINDING = re.compile(r"^\s*[-*]\s+\[(P[123])\]\s+([A-Za-z0-9][A-Za-z0-9_.+-]*)\s*:\s*(.+?)\s*$")
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

def checkpoint_states(path):  # [(sev, fid, state)] in file order; malformed input dies
    text = load(path)
    refuse_comments(text, "checkpoint")
    refuse_fences(text, "checkpoint")
    refuse_quotes(text, "checkpoint")
    out = []
    for line in text.splitlines():
        m = FINDING.match(line)
        if not m:
            if re.match(r"^\s*[-*+]\s*\[", line) or re.match(
                    r"^\s*(?:\d{1,9}[.)]\s*)?\[[Pp]\d\]\s*[A-Za-z0-9][A-Za-z0-9_.+-]*(\s*:|\s*$)",
                    line):
                die("checkpoint: not a finding: %s" % line.strip())
            continue
        sev, fid, words = m.group(1), m.group(2), m.group(3)
        if fid in [f for _, f, _ in out]:
            die("checkpoint: %s: listed twice" % fid)
        state = finding_state(words)
        if state is None:
            die("checkpoint: %s: unreadable state: %s" % (fid, words))
        out.append((sev, fid, state))
    return out

def render_block(dispatch, wt, checkpoint):  # the card's checked sections, byte-exact
    checks = recorded_results(dispatch, wt)
    states = checkpoint_states(checkpoint)
    bodies = []
    bodies.append("\n".join("- %s: %s" % (name, result) for name, result in checks) or "none")
    bodies.append("\n".join("- [%s] %s" % (sev, fid)
                            for sev, fid, state in states if state == "open") or "none")
    bodies.append("\n".join("- [%s] %s" % (sev, fid)
                            for sev, fid, state in states if state == "user-applied") or "none")
    return "## Checks\n\n%s\n\n## Open findings\n\n%s\n\n## Not re-reviewed\n\n%s\n" % tuple(bodies)

def check_block(dispatch, wt, checkpoint, card):  # match iff the card holds the block once
    text = load(card)
    refuse_comments(text, "card")
    n = text.count(render_block(dispatch, wt, checkpoint))
    if n == 0:
        die("card: does not hold the expected block")
    if n > 1:
        die("card: holds the expected block more than once")
    print("match"); sys.exit(0)

mode = sys.argv[1]

if mode == "already-landed":
    o = sys.argv[2:]
    if len(o) not in (10, 12, 14, 16) or o[0] != "--repo" or o[2] != "--default" \
            or o[4] != "--ticket" or o[6] != "--base" or o[8] != "--card-head":
        print("usage: landing.sh already-landed --repo <repo> --default <branch> "
              "--ticket <ref> --base <sha> --card-head <sha> [--local-ticket <branch>] "
              "[--pr-merge <sha> --pr-head <sha>]", file=sys.stderr); sys.exit(1)
    i, local, pr_merge, pr_head = 10, None, None, None
    if len(o) > i and o[i] == "--local-ticket":
        local = o[i + 1]; i += 2
    if len(o) > i and o[i] == "--pr-merge":
        if len(o) <= i + 3 or o[i + 2] != "--pr-head":
            print("usage: landing.sh already-landed --repo <repo> --default <branch> "
                  "--ticket <ref> --base <sha> --card-head <sha> [--local-ticket <branch>] "
                  "[--pr-merge <sha> --pr-head <sha>]", file=sys.stderr); sys.exit(1)
        pr_merge, pr_head = o[i + 1], o[i + 3]; i += 4
    if i != len(o):
        print("usage: landing.sh already-landed --repo <repo> --default <branch> "
              "--ticket <ref> --base <sha> --card-head <sha> [--local-ticket <branch>] "
              "[--pr-merge <sha> --pr-head <sha>]", file=sys.stderr); sys.exit(1)
    repo, default, ticket, base = o[1], o[3], o[5], commit(o[1], o[7], "--base")
    card = commit(repo, o[9], "--card-head")
    commit(repo, default, "--default")
    rc, out = git(repo, "rev-parse", "--verify", "--quiet", ticket + "^{commit}")
    head = out if rc == 0 and out else None
    if head is None and pr_merge is None:  # a pruned branch with a report still answers
        die("--ticket does not resolve to a commit: %s" % ticket)
    if head is not None and head != card:
        if local is not None and commit(repo, local, "--local-ticket") == card \
                and contains(repo, head, card):
            print("unpushed"); sys.exit(0)
        print("re-verify"); sys.exit(0)
    if pr_merge is not None:  # the provider's report decides, never the local ref
        merge = commit(repo, pr_merge, "--pr-merge")
        # AI1: --card-head resolved already, so a reported head that does not resolve
        # names another head; an ambiguous abbreviation fails closed here too.
        rc, reported = git(repo, "rev-parse", "--verify", "--quiet", pr_head + "^{commit}")
        if rc != 0 or not reported or reported != card:
            print("re-verify"); sys.exit(0)
        print("landed" if contains(repo, merge, default) else "not-landed"); sys.exit(0)
    if head is not None and contains(repo, head, default) and head != base:
        print("landed"); sys.exit(0)
    print("not-landed"); sys.exit(0)

if mode == "anything-to-land":
    o = sys.argv[2:]
    if len(o) != 8 or o[0] != "--repo" or o[2] != "--default" or o[4] != "--ticket" or o[6] != "--base":
        print("usage: landing.sh anything-to-land --repo <repo> --default <branch> --ticket <ref> "
              "--base <sha>", file=sys.stderr); sys.exit(1)
    repo, default, ticket = o[1], o[3], o[5]
    base = commit(repo, o[7], "--base")
    head = commit(repo, ticket, "--ticket")
    commit(repo, default, "--default")
    if not changed(repo, base, head) or contains(repo, head, default):
        print("nothing-to-land")
    else:
        print("land")
    sys.exit(0)

if mode == "fresh":
    o = sys.argv[2:]
    if len(o) != 10 or o[0] != "--repo" or o[2] != "--default" or o[4] != "--ticket" \
            or o[6] != "--dispatch" or o[8] != "--wt":
        print("usage: landing.sh fresh --repo <repo> --default <branch> --ticket <ref> "
              "--dispatch <dispatch> --wt <synthesis-wt>", file=sys.stderr); sys.exit(1)
    repo, default, ticket, dispatch, wt = o[1], o[3], o[5], o[7], o[9]
    head = commit(repo, ticket, "--ticket")
    tip = commit(repo, default, "--default")
    rc, here = git(wt, "rev-parse", "HEAD")
    if rc != 0 or not here:
        die("cannot read the worktree HEAD: %s" % wt)
    faults = []
    if here != head:
        faults.append("head: the worktree is at %s, the ticket at %s" % (here[:12], head[:12]))
    if not contains(repo, tip, head):
        faults.append("stale: the ticket branch does not contain the default branch")
    got = dict(recorded_results(dispatch, wt))
    if "gate" not in got:
        die("the record names no gate")
    if got["gate"] != "pass":
        faults.append("gate: %s at %s" % (got["gate"], here[:12]))
    if faults:
        print("\n".join(faults)); sys.exit(2)
    print("fresh"); sys.exit(0)

if mode == "results":
    if len(sys.argv) != 4:
        print("usage: landing.sh results <dispatch> <synthesis-wt>", file=sys.stderr); sys.exit(1)
    for name, result in recorded_results(sys.argv[2], sys.argv[3]):
        print("%s: %s" % (name, result))
    sys.exit(0)

if mode == "card-block":
    if len(sys.argv) != 5:
        print("usage: landing.sh card-block <dispatch> <synthesis-wt> <checkpoint>",
              file=sys.stderr); sys.exit(1)
    sys.stdout.write(render_block(sys.argv[2], sys.argv[3], sys.argv[4]))
    sys.exit(0)

if mode == "card-results":
    if len(sys.argv) != 6:
        print("usage: landing.sh card-results <dispatch> <synthesis-wt> <checkpoint> <card>",
              file=sys.stderr); sys.exit(1)
    check_block(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])

if mode == "card-findings":
    if len(sys.argv) != 6:
        print("usage: landing.sh card-findings <dispatch> <synthesis-wt> <checkpoint> <card>",
              file=sys.stderr); sys.exit(1)
    check_block(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])

if mode == "card-open":
    if len(sys.argv) != 3:
        print("usage: landing.sh card-open <checkpoint>", file=sys.stderr); sys.exit(1)
    out = ["- [%s] %s" % (sev, fid)
           for sev, fid, state in checkpoint_states(sys.argv[2])
           if state == "open" and sev in ("P1", "P2")]
    print("\n".join(out) if out else "none"); sys.exit(0)

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
    r = subprocess.run([TICKET_CHECK, "--has-journey", waybill],
                       capture_output=True, text=True)
    said = r.stdout.strip()
    if r.returncode != 0 or said not in ("journey", "no journey"):
        die("ticket-check --has-journey gave no verdict: %s"
            % ((r.stderr.strip() or r.stdout.strip() or "no output") if r.returncode != 0
               else "said %r" % said))
    if said == "no journey":
        print("judge: no user journey mentioned; %s judged like any other non-pass"
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
  fresh|results|card-block|card-results|card-findings|card-open|journey) run_py "$@"; exit $? ;;
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
out=$("$SELF" already-landed --repo "$R" --default main --ticket sq --base "$BASE" --card-head "$(git -C "$R" rev-parse sq)" --pr-merge "$SQM" --pr-head "$(git -C "$R" rev-parse sq)" 2>&1); rc=$?
expect "a provider-reported squash merge at the card's HEAD is landed" 0 "landed"
git -C "$R" checkout -qb moved "$TIP" || exit 1; commit "$R" f T3 T3
out=$("$SELF" already-landed --repo "$R" --default main --ticket moved --base "$BASE" --card-head "$TIP" 2>&1); rc=$?
expect "a branch past the card's HEAD says re-verify, never landed" 0 "re-verify"
out=$("$SELF" already-landed --repo "$R" --default main --ticket side --base "$BASE" --card-head "$NOMERGE" --pr-merge "$NOMERGE" --pr-head "$NOMERGE" 2>&1); rc=$?
expect "a moved branch says re-verify even where the merge is real" 0 "re-verify"
out=$("$SELF" already-landed --repo "$R" --default main --ticket ticket --base "$BASE" --card-head "$TIP" --pr-merge "$TIP" --pr-head "$TIP" 2>&1); rc=$?
expect "V1: a --pr-merge equal to the tip of an unmerged branch is not landed" 0 "not-landed"
out=$("$SELF" already-landed --repo "$R" --default main --ticket ticket --base "$BASE" --card-head "$TIP" --pr-merge "$(git -C "$R" rev-parse moved)" --pr-head "$TIP" 2>&1); rc=$?
expect "V1: a merge off the default branch does not count" 0 "not-landed"
UP=$tmp/up; mkrepo "$UP"; commit "$UP" f A A   # AG1: the card at the local tip, the remote behind
git -C "$UP" checkout -qb ticket || exit 1; commit "$UP" f T T
UPB=$(git -C "$UP" rev-parse main)
git clone -q -c protocol.file.allow=always "$UP" "$tmp/uc" || exit 1
git -C "$UP" checkout -q main || exit 1
UC=$tmp/uc
git -C "$UC" config user.email t@t && git -C "$UC" config user.name t \
  && git -C "$UC" config commit.gpgsign false || exit 1
git -C "$UC" checkout -q ticket || exit 1; commit "$UC" f U U
UCH=$(git -C "$UC" rev-parse HEAD)
git -C "$UC" fetch -q origin || exit 1
out=$("$SELF" already-landed --repo "$UC" --default origin/main --ticket origin/ticket --base "$UPB" --card-head "$UCH" --local-ticket ticket 2>&1); rc=$?
expect "AG1: a card at the local tip with the remote behind is unpushed" 0 "unpushed"
out=$("$SELF" already-landed --repo "$UC" --default origin/main --ticket origin/ticket --base "$UPB" --card-head "$UCH" 2>&1); rc=$?
expect "AH5: the remote behind without --local-ticket stays re-verify" 0 "re-verify"
git -C "$UC" -c protocol.file.allow=always push -q origin ticket || exit 1
git -C "$UC" fetch -q origin || exit 1
out=$("$SELF" already-landed --repo "$UC" --default origin/main --ticket origin/ticket --base "$UPB" --card-head "$UCH" --local-ticket ticket 2>&1); rc=$?
expect "AG1: pushing clears unpushed" 0 "not-landed"
git -C "$UP" checkout -q main || exit 1
git -C "$UP" merge -q --no-ff ticket -m merge || exit 1; UPM=$(git -C "$UP" rev-parse HEAD)
git -C "$UC" fetch -q origin || exit 1
out=$("$SELF" already-landed --repo "$UC" --default origin/main --ticket origin/ticket --base "$UPB" --card-head "$UCH" --local-ticket ticket --pr-merge "$UPM" --pr-head "$UCH" 2>&1); rc=$?
expect "AG1: a card at the remote's tip answers as before" 0 "landed"
git -C "$UP" checkout -q ticket || exit 1; commit "$UP" f H2 H2
git -C "$UC" fetch -q origin || exit 1
out=$("$SELF" already-landed --repo "$UC" --default origin/main --ticket origin/ticket --base "$UPB" --card-head "$UCH" --local-ticket ticket 2>&1); rc=$?
expect "AG1: upstream past the card is still re-verify" 0 "re-verify"
H2=$(git -C "$UC" rev-parse origin/ticket)
out=$("$SELF" already-landed --repo "$UC" --default origin/main --ticket origin/ticket --base "$UPB" --card-head "$H2" --local-ticket ticket --pr-merge "$UPM" --pr-head "$UCH" 2>&1); rc=$?
expect "a reported merge at another head answers re-verify" 0 "re-verify"
out=$("$SELF" already-landed --repo "$R" --default main --ticket ticket --base "$BASE" --card-head "$TIP" --pr-merge "$SQM" --pr-head 1111111111111111111111111111111111111111 2>&1); rc=$?
expect "AI1: an unknown reported head over a ticket at the card answers re-verify" 0 "re-verify"
PO=$tmp/po; mkrepo "$PO"; commit "$PO" f A A   # AH1: the branch is gone; the report decides
git -C "$PO" checkout -qb ticket || exit 1; commit "$PO" f T T
POB=$(git -C "$PO" rev-parse main); POH=$(git -C "$PO" rev-parse ticket)
git -C "$PO" checkout -q main || exit 1
git -C "$PO" merge -q --no-ff ticket -m merge || exit 1; POM=$(git -C "$PO" rev-parse HEAD)
git -C "$PO" branch -q -D ticket || exit 1
git clone -q -c protocol.file.allow=always "$PO" "$tmp/pc" || exit 1; PC=$tmp/pc
git -C "$PC" fetch -q --prune origin || exit 1
out=$("$SELF" already-landed --repo "$PC" --default origin/main --ticket origin/ticket --base "$POB" --card-head "$POH" --pr-merge "$POM" --pr-head "$POH" 2>&1); rc=$?
expect "a pruned ticket ref with a reported merge answers from the report" 0 "landed"
out=$("$SELF" already-landed --repo "$PC" --default origin/main --ticket origin/ticket --base "$POB" --card-head "$POH" --pr-merge "$POM" --pr-head 1111111111111111111111111111111111111111 2>&1); rc=$?
expect "AI1: a pruned ticket ref with an unknown reported head answers re-verify" 0 "re-verify"
out=$("$SELF" already-landed --repo "$PC" --default origin/main --ticket origin/ticket --base "$POB" --card-head "$POH" 2>&1); rc=$?
[ "$rc" -eq 1 ] && ok "a pruned ticket ref without a report is still usage" || fail "a pruned ticket ref without a report is still usage" "$out"
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
RN=$tmp/rn; mkrepo "$RN"   # a ticket that renames old to new, content unchanged
commit "$RN" old X X; RNB=$(git -C "$RN" rev-parse HEAD)
git -C "$RN" checkout -qb ticket || exit 1; git -C "$RN" mv old new || exit 1
git -C "$RN" commit -qm rename || exit 1; RNH=$(git -C "$RN" rev-parse HEAD)
git -C "$RN" checkout -q main || exit 1
out=$("$SELF" anything-to-land --repo "$RN" --default main --ticket ticket --base "$RNB" 2>&1); rc=$?
expect "V6: a rename absent from the default branch lands" 0 "land"
SM=$tmp/sm; mkrepo "$SM/sub"; commit "$SM/sub" f S S
mkrepo "$SM/outer"
git -C "$SM/outer" -c protocol.file.allow=always submodule -q add ../sub sub || exit 1
git -C "$SM/outer/sub" config user.email t@t && git -C "$SM/outer/sub" config user.name t || exit 1
git -C "$SM/outer" commit -qm addsub || exit 1; SMB=$(git -C "$SM/outer" rev-parse HEAD)
git -C "$SM/outer" checkout -qb ticket || exit 1
printf 'S2\n' > "$SM/outer/sub/f"; git -C "$SM/outer/sub" commit -qam s2 || exit 1
git -C "$SM/outer" add sub && git -C "$SM/outer" commit -qm bump || exit 1
git -C "$SM/outer" checkout -q main || exit 1
git -C "$SM/outer" config diff.ignoreSubmodules all
out=$("$SELF" anything-to-land --repo "$SM/outer" --default main --ticket ticket --base "$SMB" 2>&1); rc=$?
expect "W2: a submodule bump lands with ignoreSubmodules set" 0 "land"
SI=$tmp/si; mkrepo "$SI/sub"; commit "$SI/sub" f S S
mkrepo "$SI/outer"
git -C "$SI/outer" -c protocol.file.allow=always submodule -q add ../sub sub || exit 1
git -C "$SI/outer/sub" config user.email t@t && git -C "$SI/outer/sub" config user.name t || exit 1
git -C "$SI/outer" commit -qm addsub || exit 1; SIB=$(git -C "$SI/outer" rev-parse HEAD)
git -C "$SI/outer" checkout -qb ticket || exit 1
printf 'T\n' > "$SI/outer/real.txt"
printf 'S2\n' > "$SI/outer/sub/f"; git -C "$SI/outer/sub" commit -qam s2 || exit 1
git -C "$SI/outer" add sub real.txt && git -C "$SI/outer" commit -qm both || exit 1
SIH=$(git -C "$SI/outer" rev-parse HEAD)
git -C "$SI/outer" checkout -q main || exit 1
printf 'T\n' > "$SI/outer/real.txt"
git -C "$SI/outer" add real.txt && git -C "$SI/outer" commit -qm squashlike || exit 1
SIM=$(git -C "$SI/outer" rev-parse HEAD)
git -C "$SI/outer" config submodule.sub.ignore all
out=$("$SELF" anything-to-land --repo "$SI/outer" --default main --ticket ticket --base "$SIB" 2>&1); rc=$?
expect "X1: a submodule bump lands with per-submodule ignore set" 0 "land"
SG=$tmp/sg; mkrepo "$SG/sub"; commit "$SG/sub" f S S
mkrepo "$SG/outer"
git -C "$SG/outer" -c protocol.file.allow=always submodule -q add ../sub sub || exit 1
git -C "$SG/outer/sub" config user.email t@t && git -C "$SG/outer/sub" config user.name t || exit 1
git -C "$SG/outer" config -f .gitmodules submodule.sub.ignore all
git -C "$SG/outer" commit -qm addsub || exit 1; SGB=$(git -C "$SG/outer" rev-parse HEAD)
git -C "$SG/outer" checkout -qb ticket || exit 1
printf 'S2\n' > "$SG/outer/sub/f"; git -C "$SG/outer/sub" commit -qam s2 || exit 1
git -C "$SG/outer" add sub && git -C "$SG/outer" commit -qm bump || exit 1
out=$("$SELF" anything-to-land --repo "$SG/outer" --default main --ticket ticket --base "$SGB" 2>&1); rc=$?
expect "Y8: a submodule bump lands with .gitmodules-shipped ignore" 0 "land"
SQ=$tmp/sq; mkrepo "$SQ"   # AG3: landed content stays landed past an independent edit
printf 'base\n' > "$SQ/f"; git -C "$SQ" add f && git -C "$SQ" commit -qm A || exit 1
SQB=$(git -C "$SQ" rev-parse HEAD)
git -C "$SQ" checkout -qb ticket || exit 1
printf 'base\nticket-line\n' > "$SQ/f"; git -C "$SQ" commit -qam T || exit 1
SQT=$(git -C "$SQ" rev-parse HEAD)
git -C "$SQ" checkout -q main || exit 1
git -C "$SQ" merge -q --squash ticket || exit 1; git -C "$SQ" commit -qm squash || exit 1
printf 'base\nticket-line\nindependent\n' > "$SQ/f"; git -C "$SQ" commit -qam IND || exit 1
out=$("$SELF" anything-to-land --repo "$SQ" --default main --ticket "$SQT" --base "$SQB" 2>&1); rc=$?
expect "an unreported squash merge answers land" 0 "land"
git -C "$SQ" checkout -q ticket || exit 1
printf 'base\nticket-line\nfresh\n' > "$SQ/f"; git -C "$SQ" commit -qam F || exit 1
SQT2=$(git -C "$SQ" rev-parse HEAD)
out=$("$SELF" anything-to-land --repo "$SQ" --default main --ticket "$SQT2" --base "$SQB" 2>&1); rc=$?
expect "AG3: genuinely new content still lands" 0 "land"
BP=$tmp/bp; mkrepo "$BP"; git -C "$BP" config core.quotePath false || exit 1   # AH4: paths decode
printf 'base\n' > "$BP/f"; git -C "$BP" add f && git -C "$BP" commit -qm A || exit 1
BPB=$(git -C "$BP" rev-parse HEAD)
git -C "$BP" checkout -qb ticket || exit 1
BP=$tmp/bp python3 -c "import os; open(os.path.join(os.environ['BP'].encode(), b'bad\xffname'), 'w').write('x\n')"
git -C "$BP" add -A && git -C "$BP" commit -qam T || exit 1
BPH=$(git -C "$BP" rev-parse HEAD)
out=$("$SELF" anything-to-land --repo "$BP" --default main --ticket "$BPH" --base "$BPB" 2>&1); rc=$?
expect "AH4: a raw-byte path answers without a traceback" 0 "land"

echo "fresh"
F=$tmp/fr; mkrepo "$F"
commit "$F" f A A
git -C "$F" checkout -qb ticket || exit 1; commit "$F" f T T; FH=$(git -C "$F" rev-parse HEAD)
FH12=$(printf '%s' "$FH" | cut -c1-12)
FD=$tmp/fd; mkdir "$FD"
printf '{"checks": [{"name": "gate", "source": "default:gate", "command": "true", "shows": "x"}]}\n' > "$FD/checks.json"
printf '{"action": "verify", "target": "gate", "ts": "2026-01-01T00:00:00Z", "detail": "on=ticket@%s result=pass exit=0 secs=1"}\n' "$FH12" > "$FD/actions.jsonl"
git -C "$F" checkout -q ticket || exit 1
out=$("$SELF" fresh --repo "$F" --default main --ticket ticket --dispatch "$FD" --wt "$F" 2>&1); rc=$?
expect "W1: a ticket holding default with the gate passing is fresh" 0 "fresh"
FU=$tmp/fu; mkdir "$FU"; cp "$FD/checks.json" "$FU/checks.json"; : > "$FU/actions.jsonl"
out=$("$SELF" fresh --repo "$F" --default main --ticket ticket --dispatch "$FU" --wt "$F" 2>&1); rc=$?
expect "W1: a head with no recorded gate is not fresh" 2 "gate: not run at $FH12"
FG=$tmp/fg; mkdir "$FG"; cp "$FD/checks.json" "$FG/checks.json"
printf '{"action": "verify", "target": "gate", "ts": "2026-01-01T00:00:00Z", "detail": "on=ticket@%s result=fail exit=2 secs=1"}\n' "$FH12" > "$FG/actions.jsonl"
out=$("$SELF" fresh --repo "$F" --default main --ticket ticket --dispatch "$FG" --wt "$F" 2>&1); rc=$?
expect "W1: a head with a failing gate is not fresh" 2 "gate: fail at $FH12"
git -C "$F" checkout -q main || exit 1; commit "$F" f M2 M2
git -C "$F" checkout -q ticket || exit 1
out=$("$SELF" fresh --repo "$F" --default main --ticket ticket --dispatch "$FD" --wt "$F" 2>&1); rc=$?
expect "W1: a ticket behind the default branch is not fresh" 2 "stale: the ticket branch does not contain the default branch"
FM=$tmp/fm; mkrepo "$FM"
commit "$FM" f A A; MA12=$(git -C "$FM" rev-parse HEAD | cut -c1-12)
git -C "$FM" checkout -qb ticket || exit 1; commit "$FM" f T T
git -C "$FM" checkout -q main || exit 1
MD=$tmp/md; mkdir "$MD"; cp "$FD/checks.json" "$MD/checks.json"
printf '{"action": "verify", "target": "gate", "ts": "2026-01-01T00:00:00Z", "detail": "on=main@%s result=pass exit=0 secs=1"}\n' "$MA12" > "$MD/actions.jsonl"
TH12=$(git -C "$FM" rev-parse ticket | cut -c1-12)
out=$("$SELF" fresh --repo "$FM" --default main --ticket ticket --dispatch "$MD" --wt "$FM" 2>&1); rc=$?
expect "W1: a worktree off the ticket head is not fresh" 2 "head: the worktree is at $MA12, the ticket at $TH12"
YO=$tmp/yo; mkrepo "$YO"; commit "$YO" f A A
git clone -q -c protocol.file.allow=always "$YO" "$tmp/yc" || exit 1
YC=$tmp/yc
git -C "$YC" config user.email t@t && git -C "$YC" config user.name t \
  && git -C "$YC" config commit.gpgsign false || exit 1
git -C "$YC" checkout -qb ticket || exit 1; commit "$YC" f T T; YH=$(git -C "$YC" rev-parse HEAD)
YH12=$(printf '%s' "$YH" | cut -c1-12)
YD=$tmp/yd; mkdir "$YD"
printf '{"checks": [{"name": "gate", "source": "default:gate", "command": "true", "shows": "x"}]}\n' > "$YD/checks.json"
printf '{"action": "verify", "target": "gate", "ts": "2026-01-01T00:00:00Z", "detail": "on=ticket@%s result=pass exit=0 secs=1"}\n' "$YH12" > "$YD/actions.jsonl"
commit "$YO" f M2 M2
git -C "$YC" fetch -q origin || exit 1
out=$("$SELF" fresh --repo "$YC" --default origin/main --ticket ticket --dispatch "$YD" --wt "$YC" 2>&1); rc=$?
expect "Y1: the remote-tracking ref sees the advanced default as stale" 2 "stale: the ticket branch does not contain the default branch"
out=$(git -C "$YC" for-each-ref --format='%(upstream:short)' refs/heads/main); rc=$?
expect "Z1: the default branch's upstream resolves" 0 "origin/main"
out=$(git -C "$YC" for-each-ref --format='%(upstream:remotename)' refs/heads/main); rc=$?
expect "AA5: the default branch's upstream remote resolves" 0 "origin"
out=$(git -C "$YC" for-each-ref --format='%(upstream:short) %(upstream:remotename)' refs/heads/main); rc=$?
expect "AB2: one format names the upstream ref and its remote" 0 "origin/main origin"
GN=$tmp/gn; mkrepo "$GN"; commit "$GN" f A A
out=$(git -C "$GN" for-each-ref --format='%(upstream:short) %(upstream:remotename)' refs/heads/main); rc=$?
expect "AC6: no upstream prints a blank answer" 0 " "
git -C "$GN" checkout -qb local-base || exit 1
git -C "$GN" checkout -qb ticket || exit 1
git -C "$GN" branch --set-upstream-to=local-base >/dev/null || exit 1
out=$(git -C "$GN" for-each-ref --format='%(upstream:short) %(upstream:remotename)' refs/heads/ticket); rc=$?
expect "AC6: a local upstream prints a dot remote" 0 "local-base ."
ZO=$tmp/zo; mkrepo "$ZO"; commit "$ZO" f A A
git clone -q -c protocol.file.allow=always "$ZO" "$tmp/zc" || exit 1
ZC=$tmp/zc
git -C "$ZC" config user.email t@t && git -C "$ZC" config user.name t \
  && git -C "$ZC" config commit.gpgsign false || exit 1
git -C "$ZC" remote rename origin upstream || exit 1
ZX=$tmp/zx; mkrepo "$ZX"; commit "$ZX" f A A
git -C "$ZC" remote add origin "$ZX" || exit 1
git -C "$ZC" checkout -qb ticket || exit 1; commit "$ZC" f T T; ZH=$(git -C "$ZC" rev-parse HEAD)
ZH12=$(printf '%s' "$ZH" | cut -c1-12)
git -C "$ZC" push -q -u origin ticket || exit 1
ZD=$tmp/zd; mkdir "$ZD"
printf '{"checks": [{"name": "gate", "source": "default:gate", "command": "true", "shows": "x"}]}\n' > "$ZD/checks.json"
printf '{"action": "verify", "target": "gate", "ts": "2026-01-01T00:00:00Z", "detail": "on=ticket@%s result=pass exit=0 secs=1"}\n' "$ZH12" > "$ZD/actions.jsonl"
commit "$ZO" f M2 M2
git -C "$ZC" fetch -q upstream || exit 1
out=$("$SELF" fresh --repo "$ZC" --default upstream/main --ticket ticket --dispatch "$ZD" --wt "$ZC" 2>&1); rc=$?
expect "Z1: a named-remote fetch with the upstream ref reads stale" 2 "stale: the ticket branch does not contain the default branch"

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

echo "card-block"
printf '%s\n' "## Findings (bug)" "" "- [P1] bug-1: open" "- [P2] bug-2: closed round 2" \
  "## Findings (security)" "" "- [P2] sec-1: dismissed: not reachable" "- [P2] sec-2: applied on user word, not re-reviewed" > "$D/checkpoint.md"
out=$("$SELF" card-block "$D" "$W" "$D/checkpoint.md" 2>&1); rc=$?
expect "the block renders the checks and the checkpoint states exactly" 0 "## Checks

- gate: pass
- unit: not run

## Open findings

- [P1] bug-1

## Not re-reviewed

- [P2] sec-2"
printf '%s\n' "## Findings (bug)" "" "- [P1] bug-1: open" "- [P2] bug-1: closed round 1" > "$D/cp-dup.md"
out=$("$SELF" card-block "$D" "$W" "$D/cp-dup.md" 2>&1); rc=$?
expect "a duplicate id in the checkpoint faults the render" 1 "landing: checkpoint: bug-1: listed twice"
printf '%s\n' "## Findings (bug)" "" "* [P1] bug-9: open" > "$D/cp-star.md"
out=$("$SELF" card-block "$D" "$W" "$D/cp-star.md" 2>&1); rc=$?
expect "AB5: a star bullet parses as a finding" 0 "## Checks

- gate: pass
- unit: not run

## Open findings

- [P1] bug-9

## Not re-reviewed

none"

echo "card-results"
printf '# Ship card\n\nSome prose.\n\n## Checks\n\n- gate: pass\n- unit: not run\n\n## Open findings\n\n- [P1] bug-1\n\n## Not re-reviewed\n\n- [P2] sec-2\n\nTrailing prose.\n' > "$D/card.md"
out=$("$SELF" card-results "$D" "$W" "$D/checkpoint.md" "$D/card.md" 2>&1); rc=$?
expect "a faithful card holding the block once matches" 0 "match"
out=$("$SELF" card-findings "$D" "$W" "$D/checkpoint.md" "$D/card.md" 2>&1); rc=$?
expect "card-findings agrees on the faithful card" 0 "match"
sed 's/- gate: pass/- gate: pasz/' "$D/card.md" > "$D/card-edited.md"
out=$("$SELF" card-results "$D" "$W" "$D/checkpoint.md" "$D/card-edited.md" 2>&1); rc=$?
expect "a block edited in one character is an input fault" 1 "landing: card: does not hold the expected block"
sed 's/^-/  -/' "$D/card.md" > "$D/card-indented.md"
out=$("$SELF" card-results "$D" "$W" "$D/checkpoint.md" "$D/card-indented.md" 2>&1); rc=$?
expect "an indented block is an input fault" 1 "landing: card: does not hold the expected block"
sed -e 's/^## Checks$/```\n## Checks/' -e 's/^- \[P2\] sec-2$/- [P2] sec-2\n```/' "$D/card.md" > "$D/card-fenced.md"
out=$("$SELF" card-results "$D" "$W" "$D/checkpoint.md" "$D/card-fenced.md" 2>&1); rc=$?
expect "a fenced block counts like any other copy" 0 "match"
{ cat "$D/card.md"; printf '\nMore prose.\n\n```\n'; sed -n '/^## Checks/,/sec-2$/p' "$D/card.md"; printf '```\n'; } > "$D/card-fencedtwice.md"
out=$("$SELF" card-results "$D" "$W" "$D/checkpoint.md" "$D/card-fencedtwice.md" 2>&1); rc=$?
expect "a second copy inside a fence is still a second copy" 1 "landing: card: holds the expected block more than once"
sed -e 's/^## Checks$/<!--\n## Checks/' -e 's/^- \[P2\] sec-2$/- [P2] sec-2\n-->/' "$D/card.md" > "$D/card-commented.md"
out=$("$SELF" card-results "$D" "$W" "$D/checkpoint.md" "$D/card-commented.md" 2>&1); rc=$?
expect "a commented-out block is an input fault" 1 "landing: card: contains an HTML comment"
sed -e 's/^## Checks$/<!--\n## Checks/' "$D/card.md" > "$D/card-unclosed.md"
out=$("$SELF" card-results "$D" "$W" "$D/checkpoint.md" "$D/card-unclosed.md" 2>&1); rc=$?
expect "a block inside an unclosed comment is an input fault" 1 "landing: card: contains an HTML comment"
sed 's/^## Checks$/## Checks ##/' "$D/card.md" > "$D/card-hashes.md"
out=$("$SELF" card-results "$D" "$W" "$D/checkpoint.md" "$D/card-hashes.md" 2>&1); rc=$?
expect "closing hashes on the block are an input fault" 1 "landing: card: does not hold the expected block"
{ cat "$D/card.md"; printf '\nMore prose.\n\n'; sed -n '/^## Checks/,/sec-2$/p' "$D/card.md"; } > "$D/card-repeated.md"
out=$("$SELF" card-results "$D" "$W" "$D/checkpoint.md" "$D/card-repeated.md" 2>&1); rc=$?
expect "a repeated block is an input fault" 1 "landing: card: holds the expected block more than once"
sed '/^## Checks/,/sec-2$/d' "$D/card.md" > "$D/card-noblock.md"
out=$("$SELF" card-results "$D" "$W" "$D/checkpoint.md" "$D/card-noblock.md" 2>&1); rc=$?
expect "a card missing the block is an input fault" 1 "landing: card: does not hold the expected block"
sed 's/^Some prose\./Some prose <!-- a note -->./' "$D/card.md" > "$D/card-note.md"
out=$("$SELF" card-results "$D" "$W" "$D/checkpoint.md" "$D/card-note.md" 2>&1); rc=$?
expect "a comment anywhere in the card is an input fault" 1 "landing: card: contains an HTML comment"

echo "card-findings"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-dup.md" "$D/card.md" 2>&1); rc=$?
expect "W9: a duplicate id in the checkpoint is an input fault" 1 "landing: checkpoint: bug-1: listed twice"
printf '%s\n' "## Findings (bug)" "" "- [P2] bug-2: closed round 1" "" '```' "## Example" "" "- [P1] ex-1: open" '```' > "$D/cp-fence.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-fence.md" "$D/card.md" 2>&1); rc=$?
expect "a fence marker line in the checkpoint is an input fault" 1 "landing: checkpoint: fence marker line: \`\`\`"
printf '%s\n' "## Findings (bug)" "" "- [P2] bug-2: closed round 1" "" '```' "- [P1] ex-1: open" '```' > "$D/cp-fbullet.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-fbullet.md" "$D/card.md" 2>&1); rc=$?
expect "an example bullet inside a fence is refused with its markers" 1 "landing: checkpoint: fence marker line: \`\`\`"
printf '%s\n' "## Findings (bug)" "" "- [P2] bug-2: closed round 1" "" "1. \`\`\`" "- [P1] ex-9: open" '```' '```' > "$D/cp-itemfence.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-itemfence.md" "$D/card.md" 2>&1); rc=$?
expect "an item fence marker line is an input fault" 1 "landing: checkpoint: fence marker line: 1. \`\`\`"
printf '%s\n' "## Findings (bug)" "" "- [P2] bug-2: closed round 1" "" "    \`\`\`" "    - [P1] ex-9: open" "    \`\`\`" > "$D/cp-listfence.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-listfence.md" "$D/card.md" 2>&1); rc=$?
expect "a list-column fence marker line is an input fault" 1 "landing: checkpoint: fence marker line: \`\`\`"
printf '%s\n' "# Notes" "" "Some prose." "" '```' "quoted" '```' "" "## Findings (bug)" "" "- [P2] bug-2: closed round 1" > "$D/cp-prosefence.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-prosefence.md" "$D/card.md" 2>&1); rc=$?
expect "a fence marker outside the findings list is still an input fault" 1 "landing: checkpoint: fence marker line: \`\`\`"
printf '%s\n' "## Findings (bug)" "" "- [P2] bug-2: closed round 1" "" '````' "- [P1] ghost: inside" '```' "- [P1] bug-1: open" '````' > "$D/cp-nest.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-nest.md" "$D/card.md" 2>&1); rc=$?
expect "a nested fence marker line is an input fault" 1 "landing: checkpoint: fence marker line: \`\`\`\`"
cp "$D/checkpoint.md" "$D/cp-comment.md" && printf '<!-- hidden -->\n' >> "$D/cp-comment.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-comment.md" "$D/card.md" 2>&1); rc=$?
expect "Y2: a comment anywhere in the checkpoint is an input fault" 1 "landing: checkpoint: contains an HTML comment"
cp "$D/checkpoint.md" "$D/cp-unclosed.md" && printf '<!-- unclosed\n' >> "$D/cp-unclosed.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-unclosed.md" "$D/card.md" 2>&1); rc=$?
expect "Y2: an unclosed comment in the checkpoint is an input fault" 1 "landing: checkpoint: contains an HTML comment"
cp "$D/checkpoint.md" "$D/cp-p4.md" && printf '%s\n' '- [P4] bug-9: open' >> "$D/cp-p4.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-p4.md" "$D/card.md" 2>&1); rc=$?
expect "Y4: a finding-shaped line with a bad severity is an input fault" 1 "landing: checkpoint: not a finding: - [P4] bug-9: open"
cp "$D/checkpoint.md" "$D/cp-nostate.md" && printf '%s\n' '- [P1] bug-9' >> "$D/cp-nostate.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-nostate.md" "$D/card.md" 2>&1); rc=$?
expect "Y4: a finding-shaped line with no state is an input fault" 1 "landing: checkpoint: not a finding: - [P1] bug-9"
cp "$D/checkpoint.md" "$D/cp-plus.md" && printf '%s\n' '+ [P1] bug-9: open' >> "$D/cp-plus.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-plus.md" "$D/card.md" 2>&1); rc=$?
expect "Z5: a plus-bullet finding-shaped line is an input fault" 1 "landing: checkpoint: not a finding: + [P1] bug-9: open"
cp "$D/checkpoint.md" "$D/cp-numbered.md" && printf '%s\n' '1. [P1] bug-9: open' >> "$D/cp-numbered.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-numbered.md" "$D/card.md" 2>&1); rc=$?
expect "AA4: a numbered finding-shaped line is an input fault" 1 "landing: checkpoint: not a finding: 1. [P1] bug-9: open"
cp "$D/checkpoint.md" "$D/cp-bare.md" && printf '%s\n' '[P2] bug-8: open' >> "$D/cp-bare.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-bare.md" "$D/card.md" 2>&1); rc=$?
expect "AA4: a bare finding-shaped line is an input fault" 1 "landing: checkpoint: not a finding: [P2] bug-8: open"
cp "$D/checkpoint.md" "$D/cp-linkref.md" && printf '%s\n' '[spec]: https://example.com/spec' >> "$D/cp-linkref.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-linkref.md" "$D/card.md" 2>&1); rc=$?
expect "AB3: a link reference is prose, not a finding" 0 "match"
cp "$D/checkpoint.md" "$D/cp-numlink.md" && printf '%s\n' '1. [roundup](https://example.com)' >> "$D/cp-numlink.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-numlink.md" "$D/card.md" 2>&1); rc=$?
expect "AB3: a numbered link is prose, not a finding" 0 "match"
cp "$D/checkpoint.md" "$D/cp-sevlink.md" && printf '%s\n' '[P1](https://example.com/p1) is the paper.' >> "$D/cp-sevlink.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-sevlink.md" "$D/card.md" 2>&1); rc=$?
expect "AC5: a severity link is prose, not a finding" 0 "match"
cp "$D/checkpoint.md" "$D/cp-numsevlink.md" && printf '%s\n' '1. [P1](https://example.com)' >> "$D/cp-numsevlink.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-numsevlink.md" "$D/card.md" 2>&1); rc=$?
expect "AC5: a numbered severity link is prose, not a finding" 0 "match"
cp "$D/checkpoint.md" "$D/cp-sevref.md" && printf '%s\n' '[P1]: https://example.com/p1' >> "$D/cp-sevref.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-sevref.md" "$D/card.md" 2>&1); rc=$?
expect "AC5: a severity link reference is prose, not a finding" 0 "match"
cp "$D/checkpoint.md" "$D/cp-sevsent.md" && printf '%s\n' '[P1] and [P2] are discussed above.' >> "$D/cp-sevsent.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-sevsent.md" "$D/card.md" 2>&1); rc=$?
expect "AC5: a severity sentence is prose, not a finding" 0 "match"
cp "$D/checkpoint.md" "$D/cp-barestate.md" && printf '%s\n' '[P1] bug-9' >> "$D/cp-barestate.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-barestate.md" "$D/card.md" 2>&1); rc=$?
expect "AC5: a bare stateless finding shape still faults" 1 "landing: checkpoint: not a finding: [P1] bug-9"
cp "$D/checkpoint.md" "$D/cp-numstate.md" && printf '%s\n' '1. [P1] bug-9' >> "$D/cp-numstate.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-numstate.md" "$D/card.md" 2>&1); rc=$?
expect "AC5: a numbered stateless finding shape still faults" 1 "landing: checkpoint: not a finding: 1. [P1] bug-9"
cp "$D/checkpoint.md" "$D/cp-badstate.md" && printf '%s\n' '- [P1] bug-9: someday' >> "$D/cp-badstate.md"
out=$("$SELF" card-findings "$D" "$W" "$D/cp-badstate.md" "$D/card.md" 2>&1); rc=$?
expect "an unreadable checkpoint state is an input fault" 1 "landing: checkpoint: bug-9: unreadable state: someday"

echo "card-open"
out=$("$SELF" card-open "$D/checkpoint.md" 2>&1); rc=$?
expect "an open P1 is named" 0 "- [P1] bug-1"
printf '%s\n' "## Findings (bug)" "" "- [P2] bug-2: closed round 1" > "$D/cp-allclosed.md"
out=$("$SELF" card-open "$D/cp-allclosed.md" 2>&1); rc=$?
expect "all closed prints none" 0 "none"
printf '%s\n' "## Findings (bug)" "" "- [P3] bug-9: open" > "$D/cp-p3open.md"
out=$("$SELF" card-open "$D/cp-p3open.md" 2>&1); rc=$?
expect "open P3 residue prints none" 0 "none"
printf '%s\n' "## Findings (bug)" "" "> - [P1] bug-9: open" > "$D/cp-quoted.md"
out=$("$SELF" card-open "$D/cp-quoted.md" 2>&1); rc=$?
expect "a quoted finding is an input fault" 1 "landing: checkpoint: quoted line: > - [P1] bug-9: open"
printf '%s\n' "## Findings (bug)" "" ">> - [P1] bug-9: open" > "$D/cp-nested.md"
out=$("$SELF" card-open "$D/cp-nested.md" 2>&1); rc=$?
expect "a nested quoted finding is an input fault" 1 "landing: checkpoint: quoted line: >> - [P1] bug-9: open"
printf '%s\n' "## Findings (bug)" "" "> \`\`\`" "> - [P1] bug-9: open" "> \`\`\`" > "$D/cp-qfence.md"
out=$("$SELF" card-open "$D/cp-qfence.md" 2>&1); rc=$?
expect "a quoted fence is an input fault" 1 "landing: checkpoint: quoted line: > \`\`\`"

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
expect "AE5: no mentioned journey is judged, not blocked" 0 "judge: no user journey mentioned; journey judged like any other non-pass"
out=$("$SELF" journey "$J" "$JW" "$J/journey.md" 2>&1); rc=$?
expect "a missing report blocks" 2 "blocked: journey: no journey report at $JREP"
mkdir -p "$(dirname "$JREP")" && printf 'walked\n' > "$JREP"
out=$("$SELF" journey "$J" "$JW" "$J/journey.md" 2>&1); rc=$?
expect "a journey that did not run blocks with its report written" 2 "blocked: journey: not run; the journey has no evidence"
printf '{"action": "verify", "target": "journey", "ts": "2026-01-01T00:00:00Z", "detail": "on=main@%s result=not-run exit=3 secs=1"}\n' "$JSHA12" >> "$J/actions.jsonl"
out=$("$SELF" journey "$J" "$JW" "$J/journey.md" 2>&1); rc=$?
expect "a logged not run blocks" 2 "blocked: journey: not run; the journey has no evidence"
printf '# T\n\n## Problem / feature\nA change.\n\n## User journey:\n1. Open it.\n' > "$J/colon.md"
out=$("$SELF" journey "$J" "$JW" "$J/colon.md" 2>&1); rc=$?
expect "V10: a trailing colon still names the section" 2 "blocked: journey: not run; the journey has no evidence"
printf '# T\n\n## Problem / feature\nA change.\n\n## User journey.\n1. Open it.\n' > "$J/dot.md"
out=$("$SELF" journey "$J" "$JW" "$J/dot.md" 2>&1); rc=$?
expect "W10: a trailing full stop still names the section" 2 "blocked: journey: not run; the journey has no evidence"
printf '# T\n\n## Problem / feature\nA change.\n\n## User journey log\n1. Open it.\n' > "$J/other.md"
out=$("$SELF" journey "$J" "$JW" "$J/other.md" 2>&1); rc=$?
expect "journey-phrase: extra heading words still hold the phrase" 2 "blocked: journey: not run; the journey has no evidence"
printf '# T\n\n## Problem / feature\nA change.\n\n```\n## User journey\n1. Open it.\n```\n' > "$J/fenced.md"
out=$("$SELF" journey "$J" "$JW" "$J/fenced.md" 2>&1); rc=$?
expect "fail-closed: a fenced User journey blocks" 2 "blocked: journey: not run; the journey has no evidence"
printf '# T\n\n## Problem / feature\nA change.\n\n<!--\n## User journey\n1. Open it.\n-->\n' > "$J/commented.md"
out=$("$SELF" journey "$J" "$JW" "$J/commented.md" 2>&1); rc=$?
expect "fail-closed: a commented-out User journey blocks" 2 "blocked: journey: not run; the journey has no evidence"
printf '# T\n\n## Problem / feature\nA change.\n\n<!--\n```\n-->\n\n## User journey\n1. Open it.\n' > "$J/fencecomment.md"
out=$("$SELF" journey "$J" "$JW" "$J/fencecomment.md" 2>&1); rc=$?
expect "Z4: a fence inside a comment does not hide the journey" 2 "blocked: journey: not run; the journey has no evidence"
printf '# T\n\n## Problem / feature\nA change.\n\n<!-- note --> ## User journey\n1. Open it.\n' > "$J/sameline.md"
out=$("$SELF" journey "$J" "$JW" "$J/sameline.md" 2>&1); rc=$?
expect "fail-closed: a same-line remainder blocks" 2 "blocked: journey: not run; the journey has no evidence"
printf '# T\n\n## Problem / feature\nA change.\n\n## User journey <!-- draft -->\n1. Open it.\n' > "$J/trailcomment.md"
out=$("$SELF" journey "$J" "$JW" "$J/trailcomment.md" 2>&1); rc=$?
expect "a comment inside the heading leaves it a heading" 2 "blocked: journey: not run; the journey has no evidence"
printf '# T\n\n## Problem / feature\nA change.\n\n# <!-- -->User journey\n1. Open it.\n' > "$J/midcomment.md"
out=$("$SELF" journey "$J" "$JW" "$J/midcomment.md" 2>&1); rc=$?
expect "a comment between the hashes and the words leaves it a heading" 2 "blocked: journey: not run; the journey has no evidence"
printf '# T\n\n## Problem / feature\nA change.\n\n```\nWrite <!-- to open\n```\n\n## User journey\n1. Open it.\n\n<!-- done -->\n' > "$J/fenceliteral.md"
out=$("$SELF" journey "$J" "$JW" "$J/fenceliteral.md" 2>&1); rc=$?
expect "a comment opener inside a fence does not eat the journey" 2 "blocked: journey: not run; the journey has no evidence"
printf '# T\n\n## Problem / feature\nA change.\n\n    ```\n    literal indented text\n\n## User journey\n1. Open it.\n' > "$J/indfence.md"
out=$("$SELF" journey "$J" "$JW" "$J/indfence.md" 2>&1); rc=$?
expect "AB1: indented code does not hide the journey" 2 "blocked: journey: not run; the journey has no evidence"
out=$("$SELF" journey "$J" "$JW" "$tmp/does-not-exist.md" 2>&1); rc=$?
expect "AB7: an unreadable waybill fails the delegation without a verdict" 1 "landing: ticket-check --has-journey gave no verdict: ticket-check: cannot read $tmp/does-not-exist.md"
printf '# T\n\n## Problem / feature\nA change.\n\n   ## User journey\n1. Open it.\n' > "$J/indented.md"
out=$("$SELF" journey "$J" "$JW" "$J/indented.md" 2>&1); rc=$?
expect "Y6: an indented User journey still names the section" 2 "blocked: journey: not run; the journey has no evidence"
printf '{"action": "verify", "target": "journey", "ts": "2026-01-01T00:00:01Z", "detail": "on=main@%s result=fail exit=1 secs=1"}\n' "$JSHA12" >> "$J/actions.jsonl"
out=$("$SELF" journey "$J" "$JW" "$J/journey.md" 2>&1); rc=$?
expect "a failed journey with its report is judged" 0 "judge: journey failed with its report at $JREP; weigh it"
printf '{"action": "verify", "target": "journey", "ts": "2026-01-01T00:00:02Z", "detail": "on=main@%s result=pass exit=0 secs=1"}\n' "$JSHA12" >> "$J/actions.jsonl"
out=$("$SELF" journey "$J" "$JW" "$J/journey.md" 2>&1); rc=$?
expect "a walked journey is clear" 0 "clear: journey walked: report at $JREP"

echo
if [ "$fails" -eq 0 ]; then echo "landing: all self-test controls behaved"; exit 0; fi
echo "landing: $fails control(s) misbehaved"; exit 1
