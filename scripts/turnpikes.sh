#!/usr/bin/env bash
# The turnpikes: the checks a run must pass through before it ships. The project's gate is not
# one of them; it runs on every run. This is the one place the turnpikes and the default set are
# defined. A ticket names its run's turnpikes in its `## Turnpikes` section, and
# scripts/ticket-check.sh, the postmaster and the coachman all read them from here.
#
#   turnpikes.sh --list              every turnpike, one per line: its name, `default` or `-`,
#                                    the leg that runs it, and what it checks
#   turnpikes.sh resolve <text>...   a `## Turnpikes` section's text, as the turnpikes it names
#   turnpikes.sh legs <dispatch>     a run's legs, from the `turnpikes:` line of its waybill
#   turnpikes.sh --self-test
#
# A section holds `default`, `none`, or turnpike names, separated by commas or spaces, and
# nothing else. `default` stands for every turnpike --list marks default, alone or in a list;
# `none` stands alone. Case, backticks, list bullets and a closing full stop are ignored.
# resolve prints the line the waybill carries: `turnpikes: ` and the names, in the order --list
# gives them, or `turnpikes: none`.
#
# legs prints one line per leg the run has, in order: its number, its name, and the turnpikes it
# runs. Synthesis (1) and ship (3) always run. Review (2) runs only when the waybill names a
# turnpike that runs in it, so a run with none goes from synthesis to ship. The waybill's line
# is the `turnpikes:` line in its `## Dispatch` section, after the ticket; a waybill with none
# is refused, never read as `none`.
#
# A turnpike is added as one line of the table below, and to the runbook step that runs it.
# Every command checks the table first: each name a lowercase word, neither `default` nor
# `none`, listed once; `default` or `-`; a leg that exists; and words saying what it checks.
#
#   exit 0  printed
#   exit 1  usage, no waybill, or a table that breaks its rules
#   exit 2  resolve: the text is not a turnpikes section; legs: the waybill has no turnpikes
#           line, or names a turnpike that is not in the table. One line per fault, on stdout.
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
usage() { echo "usage: turnpikes.sh --list | resolve <text>... | legs <dispatch> | --self-test" >&2; exit 1; }

TABLE=$(cat <<'TURNPIKES'
# name     set      leg     what it checks
style      default  review  idiom, naming, abstraction and consistency with the project's own conventions
bug        default  review  correctness, logic, and whether the tests are adequate
security   default  review  exploit paths through the project's risk surfaces
TURNPIKES
)

core() {  # core <table> list | resolve <text>... | legs <waybill-file>
  python3 - "$@" <<'PY'
import re, sys

table, cmd, args = sys.argv[1], sys.argv[2], sys.argv[3:]
LEGS = [(1, "synthesis"), (2, "review"), (3, "ship")]
ALWAYS = {"synthesis", "ship"}
RESERVED = ("default", "none")

rows, faults = [], []
for n, line in enumerate(table.split("\n"), 1):
    if not line.strip() or line.lstrip().startswith("#"):
        continue
    f = line.split(None, 3)
    if len(f) < 4 or not re.search(r"[^\W_]", f[3]):
        faults.append("line %d needs a name, default or -, a leg, and what it checks" % n)
        continue
    name, mark, leg, what = f
    if not re.fullmatch(r"[a-z][a-z0-9-]*", name):
        faults.append('line %d: "%s" is not a lowercase word' % (n, name))
    elif name in RESERVED:
        faults.append('line %d: "%s" already means something in a ticket, so no turnpike is named it' % (n, name))
    elif name in [r[0] for r in rows]:
        faults.append('line %d: "%s" is listed twice' % (n, name))
    if mark not in ("default", "-"):
        faults.append('line %d: "%s" is neither default nor -' % (n, mark))
    if leg not in [l for _, l in LEGS]:
        faults.append('line %d: "%s" is not a leg; the legs are %s' % (n, leg, ", ".join(l for _, l in LEGS)))
    rows.append((name, mark == "default", leg, what.strip()))
if faults:
    print("\n".join("turnpikes: the table's " + f for f in faults), file=sys.stderr)
    sys.exit(1)
names = [r[0] for r in rows]
leg_of = {r[0]: r[2] for r in rows}

def resolve(text):  # (names in table order, []) or (None, [fault, ...])
    words = []
    for tok in re.split(r"[\s,;]+", text):
        if not tok or re.fullmatch(r"[-*+]|\d{1,9}[.)]", tok):  # a list bullet
            continue
        w = tok.strip("`*_").rstrip(".").strip("`*_").lower()
        if w:
            words.append(w)
    holds = "the section holds only default, none, or names from: %s" % (", ".join(names) or "(no turnpikes)")
    if not words:
        return None, ["names no turnpike; " + holds]
    out = []
    unknown = ['"%s"' % w for w in dict.fromkeys(words) if w not in names and w not in RESERVED]
    if unknown:
        which = unknown[0] if len(unknown) == 1 else ", ".join(unknown[:-1]) + " and " + unknown[-1]
        out.append("%s %s; %s" % (which, "is not a turnpike" if len(unknown) == 1 else "are not turnpikes", holds))
    if "none" in words and len(set(words)) > 1:
        out.append("none stands alone, and is not listed with other turnpikes")
    if out:
        return None, out
    chosen = set(words) | ({r[0] for r in rows if r[1]} if "default" in words else set())
    return [n for n in names if n in chosen], []

if cmd == "list":
    for name, d, leg, what in rows:
        print("%-10s %-8s %-9s %s" % (name, "default" if d else "-", leg, what))
elif cmd == "resolve":
    got, out = resolve(" ".join(args))
    if out:
        print("\n".join(out)); sys.exit(2)
    print("turnpikes: " + (", ".join(got) or "none"))
elif cmd == "legs":
    try:
        lines = open(args[0], encoding="utf-8", errors="replace").read().split("\n")
    except OSError as e:
        print("turnpikes: cannot read %s: %s" % (args[0], e.strerror), file=sys.stderr); sys.exit(1)
    heads = [i for i, l in enumerate(lines) if re.fullmatch(r" {0,3}##[ \t]+dispatch[ \t:#]*\r?", l, re.I)]
    found = []
    if heads:  # the waybill's own section is its last `## Dispatch`, which follows the ticket
        for l in lines[heads[-1] + 1:]:
            if re.match(r" {0,3}#{1,2}(?:[ \t]|\r?$)", l):
                break
            if re.match(r"\s*turnpikes\s*:", l, re.I):
                found.append(l)
    if len(found) != 1:
        print("the waybill has %s turnpikes: line%s in its ## Dispatch section, and one is needed; none is never assumed"
              % (len(found) or "no", "" if len(found) == 1 else "s")); sys.exit(2)
    got, out = resolve(found[0].split(":", 1)[1])
    if out:
        print("\n".join("the waybill's turnpikes: " + o for o in out)); sys.exit(2)
    for n, leg in LEGS:
        runs = [x for x in got if leg_of[x] == leg]
        if leg in ALWAYS or runs:
            print(" ".join([str(n), leg] + runs))
PY
}

case ${1:-} in
  --list) [ $# -eq 1 ] || usage; core "$TABLE" list; exit $? ;;
  resolve) shift; core "$TABLE" resolve "$@"; exit $? ;;
  legs) [ $# -eq 2 ] || usage
        [ -f "$2/brief.md" ] || { echo "turnpikes: no waybill at $2/brief.md" >&2; exit 1; }
        core "$TABLE" legs "$2/brief.md"; exit $? ;;
  --self-test) [ $# -eq 1 ] || usage ;;
  *) usage ;;
esac

# --- self-test ----------------------------------------------------------------------------
self=$HERE/$(basename "$0")
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
fails=0 out="" rc=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/         /'; fails=$((fails+1)); }
run()  { out=$("$@" 2>&1); rc=$?; }
is()   {  # is <label> <exit> <the whole output>
  if [ "$rc" -eq "$2" ] && [ "$out" = "$3" ]; then ok "$1"; else fail "$1: wanted exit $2, got $rc" "$out"; fi
}
has()  {  # has <label> <exit> <text a line must contain> [<text no line may contain>]
  if [ "$rc" -eq "$2" ] && printf '%s\n' "$out" | grep -qF -- "$3" \
     && { [ -z "${4:-}" ] || ! printf '%s\n' "$out" | grep -qF -- "$4"; }; then ok "$1"
  else fail "$1: wanted exit $2 with \"$3\"${4:+ and no \"$4\"}, got exit $rc" "$out"; fi
}
waybill() {  # waybill <dispatch> <its Dispatch section's turnpikes line, or nothing> [<a line in the ticket's notes>]
  mkdir -p "$1"
  { printf '# Waybill: T-1\n\n## Ticket\n## Problem / feature\nA change.\n\n## Turnpikes\ndefault\n\n'
    printf '## Notes\n%s\n\n## Project profile\nrepo: /r\n\n## Team\nreviewers: a, b\n\n' "${3:-}"
    printf '## Dispatch\ndispatch: %s\n' "$1"; [ -n "$2" ] && printf '%s\n' "$2"; printf 'tool: /t\n'; } > "$1/brief.md"
}
lines() { printf '%s\n' "$@"; }
PLUS=$(printf '%s\n%s' "$TABLE" "fixture    -        ship    whether a run on the fixture app scores clean")

echo "positive controls: the list"
run "$self" --list
[ $rc -eq 0 ] && for n in style bug security; do [ "$(printf '%s\n' "$out" | awk -v n=$n '$1 == n' | wc -l)" -eq 1 ] || rc=9; done
[ $rc -eq 0 ] && ok "--list names style, bug and security, once each" || fail "--list names style, bug and security, once each" "$out"
[ "$(printf '%s\n' "$out" | awk '$2 == "default" {print $1}' | paste -sd' ' -)" = "style bug security" ] \
  && ok "the default set is style, bug and security" || fail "the default set is style, bug and security" "$out"
[ "$(printf '%s\n' "$out" | awk '$1 ~ /^(style|bug|security)$/ {print $3}' | sort -u)" = review ] \
  && ok "the three run in the review leg" || fail "the three run in the review leg" "$out"

echo "positive controls: a ticket's section"
run "$self" resolve default;            is "default stands for the default set" 0 "turnpikes: style, bug, security"
run "$self" resolve none;               is "none stands for no turnpike" 0 "turnpikes: none"
run "$self" resolve "security, bug";    is "a list names its turnpikes, in the table's order" 0 "turnpikes: bug, security"
run "$self" resolve "default, bug";     is "in a list, default still stands for the three" 0 "turnpikes: style, bug, security"
run "$self" resolve "$(lines '- Bug' '- `security`.')"
is "case, backticks, bullets and a closing full stop are ignored" 0 "turnpikes: bug, security"
run "$self" resolve "bug, security"; line=$out; run "$self" resolve "${line#turnpikes: }"
is "the waybill's line resolves to itself" 0 "$line"
run core "$PLUS" resolve "default, fixture"
is "a turnpike added to the table resolves with nothing else changed" 0 "turnpikes: style, bug, security, fixture"

echo "positive controls: a run's legs"
waybill "$tmp/none" "turnpikes: none"; run "$self" legs "$tmp/none"
is "a run with no turnpikes goes from synthesis to ship" 0 "$(lines '1 synthesis' '3 ship')"
waybill "$tmp/default" "turnpikes: style, bug, security"; run "$self" legs "$tmp/default"
is "a run with the default turnpikes has a review leg that runs all three" 0 "$(lines '1 synthesis' '2 review style bug security' '3 ship')"
waybill "$tmp/style" "turnpikes: style"; run "$self" legs "$tmp/style"
is "one review turnpike is enough for a review leg" 0 "$(lines '1 synthesis' '2 review style' '3 ship')"
waybill "$tmp/notes" "turnpikes: none" "turnpikes: style, bug, security"; run "$self" legs "$tmp/notes"
is "the Dispatch section's line counts, not one in the ticket" 0 "$(lines '1 synthesis' '3 ship')"
waybill "$tmp/fixture" "turnpikes: fixture"; run core "$PLUS" legs "$tmp/fixture/brief.md"
is "a turnpike that runs in another leg makes no review leg" 0 "$(lines '1 synthesis' '3 ship fixture')"

echo "negative controls: a ticket's section"
run "$self" resolve fixture;            has "a turnpike the table does not list is named" 2 '"fixture" is not a turnpike'
run "$self" resolve "none, bug";        has "none listed with another turnpike is refused" 2 "none stands alone"
run "$self" resolve "none. A research ticket"
has "a reason is not a turnpike" 2 '"a", "research" and "ticket" are not turnpikes; the section holds only'
run "$self" resolve "";                 has "an empty section names no turnpike" 2 "names no turnpike"

echo "negative controls: a run's legs"
waybill "$tmp/missing" ""; run "$self" legs "$tmp/missing"
has "a waybill with no turnpikes line is refused, not read as none" 2 "has no turnpikes: line" "ship"
waybill "$tmp/unknown" "turnpikes: bug, fixture"; run "$self" legs "$tmp/unknown"
has "a waybill naming an unknown turnpike is refused, and no leg is printed" 2 '"fixture" is not a turnpike' "synthesis"
waybill "$tmp/twice" "$(lines 'turnpikes: none' 'turnpikes: style, bug, security')"; run "$self" legs "$tmp/twice"
has "two turnpikes lines are refused" 2 "has 2 turnpikes: lines" "synthesis"
run "$self" legs "$tmp/nowhere";        has "no waybill is a usage error" 1 "no waybill at"

echo "negative controls: the table"
bad() {  # bad <label> <a line added to the table> <text the refusal must carry>
  run core "$(printf '%s\n%s' "$TABLE" "$2")" list; has "$1" 1 "$3" "style"
}
bad "a turnpike named none is refused"       "none       -        review  nothing"       '"none" already means something in a ticket'
bad "a turnpike named default is refused"    "default    -        review  everything"    '"default" already means something in a ticket'
bad "a turnpike listed twice is refused"     "bug        -        review  bugs again"    '"bug" is listed twice'
bad "a leg that does not exist is refused"   "fixture    -        deploy  a fixture run" '"deploy" is not a leg'
bad "a set other than default or - is refused" "fixture  yes      ship    a fixture run" '"yes" is neither default nor -'
bad "a name that is not a lowercase word is refused" "Fix-Ture  -      ship    a fixture run" '"Fix-Ture" is not a lowercase word'
bad "a line with no description is refused"  "fixture    -        ship"                  "needs a name, default or -, a leg, and what it checks"

echo "a run with no turnpikes, walked from synthesis to ship through the poll, the hand-off check and the stages"
d=$tmp/runs/proj/T-9; waybill "$d" "turnpikes: none"; : > "$d/run-log.md"
printf '{"stage": "checkpoint-1", "leg": 1, "base": "abc123", "lanes": {}, "coachman": {"legs": {}}}\n' > "$d/manifest.json"
"$HERE/log-action.sh" "$d" postmaster dispatch T-9 "leg 1" >/dev/null
printf '## %s\nx\n' Decisions "Deferred findings" "Verified by execution" Unverified "Branches and lanes" "Open questions" "Next leg" > "$d/handoff-1.md"
touch "$d/.leg-1-done" "$d/.leg-1-exited"
poll() { "$HERE/runs-status.sh" "$tmp/runs/proj" | awk '$1 == "T-9" {print $NF}'; }
[ "$(poll)" = DISPATCH ] && ok "after synthesis the poll says DISPATCH" || fail "after synthesis the poll says DISPATCH" "$("$HERE/runs-status.sh" "$tmp/runs/proj")"
next=$("$self" legs "$d" | awk '$1 > 1 {print $1 " " $2; exit}')
[ "$next" = "3 ship" ] && ok "the leg after synthesis is ship" || fail "the leg after synthesis is ship" "$next"
prev=$("$self" legs "$d" | awk '$1 < 3 {p = $1} END {print p}')
"$HERE/handoff-check.sh" "$d/handoff-$prev.md" >/dev/null 2>&1 && [ "$prev" = 1 ] \
  && ok "the ship leg starts from synthesis's hand-off, which passes its check" || fail "the ship leg starts from synthesis's hand-off, which passes its check" "handoff-$prev.md"
python3 -c 'import json, sys; p = sys.argv[1]; m = json.load(open(p)); m["leg"] = 3; open(p, "w").write(json.dumps(m))' "$d/manifest.json"
"$HERE/stage.sh" "$d" shipping >/dev/null && "$HERE/stage.sh" "$d" shipped >/dev/null && touch "$d/.leg-3-done" "$d/.leg-3-exited"
after=$("$self" legs "$d" | awk '$1 > 3')
[ "$(poll)" = DISPATCH ] && [ -z "$after" ] && ok "after ship the poll says DISPATCH, and no leg follows: Stage G" \
  || fail "after ship the poll says DISPATCH, and no leg follows: Stage G" "$(poll) / $after"
"$HERE/stage.sh" "$d" done postmaster >/dev/null
stages=$(python3 -c 'import json, sys; print(" ".join(json.loads(l)["target"] for l in open(sys.argv[1]) if json.loads(l)["action"] == "stage"))' "$d/actions.jsonl")
[ "$stages" = "shipping shipped done" ] && [ "$(poll)" = - ] && ok "it closes with no review stage" || fail "it closes with no review stage" "$stages"

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
