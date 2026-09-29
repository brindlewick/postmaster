#!/usr/bin/env bash
# The turnpikes: the checks a run must pass through before it ships. The project's gate is not
# one of them; it runs on every run. This is the one place the turnpikes and the default set are
# defined. A ticket names its run's turnpikes in its `## Turnpikes` section, and
# scripts/ticket-check.sh, the postmaster and the coachman all read them from here.
#
#   turnpikes.sh --list                 every turnpike, one per line: its name, `default` or `-`,
#                                       the leg that runs it, and what it checks
#   turnpikes.sh resolve [--project <repo>] [<text>...] a `## Turnpikes` section's text, as the turnpikes it
#                                       names; with no text given, the section is read from stdin
#   turnpikes.sh legs <dispatch> [--expect <line>]
#                                       a run's legs, from the `turnpikes:` line under its
#                                       waybill's title; with --expect, that line must be <line>
#   turnpikes.sh legs --line <line>     the legs a waybill with that `turnpikes:` line would have
#   turnpikes.sh short <line>           the default turnpikes a `turnpikes:` line leaves out
#   turnpikes.sh --self-test
#
# A section holds `default`, `none`, or turnpike names, separated by commas or spaces, and
# nothing else. `default` stands for the project's configured default turnpikes, or every
# turnpike --list marks default when the project has not declared its own;
# `none` stands alone. Case, backticks, a list marker at the start of a line, a thematic break,
# a hard line break, invisible characters and a closing full stop are ignored; every other
# token, a lone dash or dots among them, is a word, and a word that is not a turnpike is named.
# resolve prints the line the waybill carries: `turnpikes: ` and the names, in the order --list
# gives them, or `turnpikes: none`.
#
# legs prints one line per leg the run has, in order: its number, its name, and the turnpikes it
# runs. New runs always have synthesis (1); review (2) runs only when the waybill names a review
# turnpike. Older run.json files without a coachman_contract version keep synthesis (1), optional
# review (2), and ship (3). `legs --line` prints the current schedule for preflight. The waybill's
# line is the one `turnpikes:` line between its title and its first `##` heading, above the ticket,
# so nothing the ticket holds is ever read for it. It holds the names resolve printed, or `none`,
# never `default`. A waybill with no such line is refused, never read as `none`.
#
# A turnpike is added as one line of the table below, and to the runbook step that runs it.
# Every command checks the table first: each name a lowercase word, neither `default` nor
# `none`, listed once; `default` or `-`; a leg that exists; and words saying what it checks.
#
#   exit 0  printed
#   exit 1  usage, no waybill, or a table that breaks its rules
#   exit 2  resolve: the text is not a turnpikes section; legs and short: the line is missing,
#           is not names or none, or is not the one --expect gives; legs on a current run: a
#           turnpike homed on a leg it has none of. One line per fault, on stdout.
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
usage() { echo "usage: turnpikes.sh --list | resolve [--project <repo>] [<text>...] | legs <dispatch> [--expect <line>] | legs --line <line> | short [--project <repo>] <line> | --self-test" >&2; exit 1; }

# Both bodies are read with `read`, not `$(cat ...)`, so that a shell as old as bash 3.2 parses
# this file: it reads a here-document inside `$( )` as ordinary text, quotes and backticks included.
IFS= read -r -d '' TABLE <<'TURNPIKES' || true
# name     set      leg     what it checks
style      default  review  idiom, naming, abstraction and consistency with the project's own conventions
bug        default  review  correctness, logic, and whether the tests are adequate
security   default  review  exploit paths through the project's risk surfaces
TURNPIKES

IFS= read -r -d '' CORE <<'PY' || true
import json, os, re, subprocess, sys, unicodedata

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
here, table, cmd, args = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
CURRENT_LEGS = [(1, "synthesis"), (2, "review")]
LEGACY_LEGS = [(1, "synthesis"), (2, "review"), (3, "ship")]
ALWAYS = {"synthesis"}
RESERVED = ("default", "none")
BREAK = re.compile(r" {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*")
MARKER = re.compile(r"[ \t]*(?:[-*+]|\d{1,9}[.)])(?:[ \t]+|$)")
LINE = re.compile(r"[ \t]*turnpikes[ \t]*:")

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
    all_legs = [l for _, l in LEGACY_LEGS]
    if leg not in all_legs:
        faults.append('line %d: "%s" is not a leg; the legs are %s' % (n, leg, ", ".join(all_legs)))
    rows.append((name, mark == "default", leg, what.strip()))
if faults:
    print("\n".join("turnpikes: the table's " + f for f in faults), file=sys.stderr)
    sys.exit(1)
names = [r[0] for r in rows]
defaults = [r[0] for r in rows if r[1]]
project = os.environ.get("POSTMASTER_PROJECT", "")
if project and cmd in ("resolve", "short"):
    p = subprocess.run([os.path.join(here, "project-settings.sh"), "inspect", project], capture_output=True, text=True)
    if p.returncode:
        print(p.stderr.strip() or "turnpikes: cannot read project settings", file=sys.stderr); sys.exit(1)
    try:
        profile = json.loads(p.stdout)
    except ValueError as e:
        print("turnpikes: project settings gave no JSON: %s" % e, file=sys.stderr); sys.exit(1)
    declared = profile.get("project", {}).get("default_turnpikes")
    if declared is not None:
        defaults = declared
leg_of = {r[0]: r[2] for r in rows}

def words_of(text):
    words = []
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Cf")   # invisible format characters
    for line in text.split("\n"):
        line = re.sub(r"\\+$", "", line.rstrip("\r"))                        # a hard line break
        if BREAK.fullmatch(line):
            continue
        m = MARKER.match(line)                                               # a list marker opens a line
        if m:
            line = line[m.end():]
        for tok in re.split(r"[\s,;]+", line):
            if tok:
                words.append(tok.strip("`*_").rstrip(".").strip("`*_").lower() or tok)
    return words

def resolve(text):  # (names in table order, []) or (None, [fault, ...])
    words = words_of(text)
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
    chosen = set(words) | (set(defaults) if "default" in words else set())
    return [n for n in names if n in chosen], []

def named(line):  # a waybill's turnpikes: line, as the names it holds; exit 2 unless names or none
    if "\n" in line or not LINE.match(line):
        print('"%s" is not a turnpikes: line' % line.replace("\n", "\\n")); sys.exit(2)
    value = LINE.sub("", line, count=1)
    if "default" in words_of(value):
        print("the waybill's turnpikes line says default; it carries the names ticket-check.sh printed for the ticket")
        sys.exit(2)
    got, out = resolve(value)
    if out:
        print("\n".join("the waybill's turnpikes: " + o for o in out)); sys.exit(2)
    return got

def legs(line, legacy=False):
    got = named(line)
    if not legacy:
        for x in got:
            if leg_of[x] not in [l for _, l in CURRENT_LEGS]:
                print('"%s" runs in %s, and a current run has no %s leg' % (x, leg_of[x], leg_of[x])); sys.exit(2)
    for n, leg in (LEGACY_LEGS if legacy else CURRENT_LEGS):
        runs = [x for x in got if leg_of[x] == leg]
        if leg in ALWAYS or (legacy and leg == "ship") or runs:
            print(" ".join([str(n), leg] + runs))

def legacy_dispatch(waybill):
    """Missing contract metadata belongs to a run dispatched by the old flow."""
    import json, os
    path = os.path.join(os.path.dirname(os.path.abspath(waybill)), "run.json")
    if not os.path.isfile(path):
        return True
    try:
        record = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        print("turnpikes: cannot read %s: %s" % (path, e)); sys.exit(1)
    if not isinstance(record, dict):
        print("turnpikes: %s is not a JSON object" % path); sys.exit(1)
    if "coachman_contract" not in record:
        return True
    contract = record["coachman_contract"]
    if type(contract) is int and contract == 2:
        return False
    if type(contract) is int and contract == 1:
        return True
    print("turnpikes: unsupported coachman contract %r in %s" % (contract, path)); sys.exit(1)

if cmd == "list":
    for name, d, leg, what in rows:
        print("%-10s %-8s %-9s %s" % (name, "default" if d else "-", leg, what))
elif cmd == "resolve":
    got, out = resolve(" ".join(args) if args else sys.stdin.buffer.read().decode("utf-8", "replace"))
    if out:
        print("\n".join(out)); sys.exit(2)
    print("turnpikes: " + (", ".join(got) or "none"))
elif cmd == "short":
    got = named(args[0])
    for n in defaults:
        if n not in got:
            print(n)
elif cmd == "legs" and args[0] == "--line":
    legs(args[1])
elif cmd == "legs":
    try:
        lines = open(args[0], encoding="utf-8", errors="replace").read().split("\n")
    except OSError as e:
        print("turnpikes: cannot read %s: %s" % (args[0], e.strerror), file=sys.stderr); sys.exit(1)
    above = []                                  # the lines above the waybill's first ## heading
    for l in lines:
        if l.startswith("## "):
            break
        above.append(l.rstrip("\r"))
    found = [l for l in above if LINE.match(l)]
    if len(found) != 1:
        print("the waybill has %s turnpikes: line%s under its title, above the ticket, and one is needed; none is never assumed"
              % (len(found) or "no", "" if len(found) == 1 else "s")); sys.exit(2)
    if len(args) == 2 and " ".join(found[0].split()) != " ".join(args[1].split()):
        print('the waybill says "%s", and the ticket\'s check printed "%s"' % (found[0].strip(), args[1].strip()))
        sys.exit(2)
    legs(found[0], legacy_dispatch(args[0]))
PY
core() { python3 -I -c "$CORE" "$HERE" "$@"; }  # core <table> list | resolve [<text>...] | short <line> | legs <waybill> [<expect>] | legs --line <line>

case ${1:-} in
  --list) [ $# -eq 1 ] || usage; core "$TABLE" list; exit $? ;;
  resolve) shift
           if [ "${1:-}" = --project ]; then [ $# -ge 2 ] || usage; [ -n "$2" ] || { echo "turnpikes: no such project directory: $2" >&2; exit 1; }; export POSTMASTER_PROJECT=$2; shift 2; fi
           core "$TABLE" resolve "$@"; exit $? ;;
  short) shift
         if [ "${1:-}" = --project ]; then [ $# -eq 3 ] || usage; [ -n "$2" ] || { echo "turnpikes: no such project directory: $2" >&2; exit 1; }; export POSTMASTER_PROJECT=$2; shift 2; fi
         [ $# -eq 1 ] || usage; core "$TABLE" short "$1"; exit $? ;;
  legs) if [ "${2:-}" = --line ]; then [ $# -eq 3 ] || usage; core "$TABLE" legs --line "$3"; exit $?; fi
        [ $# -eq 2 ] || { [ $# -eq 4 ] && [ "$3" = --expect ]; } || usage
        [ -f "$2/brief.md" ] || { echo "turnpikes: no waybill at $2/brief.md" >&2; exit 1; }
        if [ $# -eq 4 ]; then core "$TABLE" legs "$2/brief.md" "$4"; else core "$TABLE" legs "$2/brief.md"; fi; exit $? ;;
  --self-test) [ $# -eq 1 ] || usage; unset POSTMASTER_PROJECT ;;
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
waybill() {  # waybill <dispatch> <the line under the title, or nothing> [<a line in the ticket's notes>]
  mkdir -p "$1"
  printf '{"coachman_contract": 2}\n' > "$1/run.json"
  { printf '# Waybill: T-1\n'; [ -n "$2" ] && printf '%s\n' "$2"
    printf '\n## Ticket\n## Problem / feature\nA change.\n\n## Turnpikes\ndefault\n\n## Notes\n%s\n\n' "${3:-}"
    printf '## Project profile\nrepo: /r\n\n## Dispatch\nname: #1, A change\ndispatch: %s\ntool: /t\n' "$1"; } > "$1/brief.md"
}
lines() { printf '%s\n' "$@"; }
# A name the table does not have, so that a turnpike added to it later breaks no control here.
NOPE=zz-not-listed
"$self" --list | awk '{print $1}' | grep -qx "$NOPE" && { echo "self-test: $NOPE is in the table; pick another unused name" >&2; exit 1; }
PLUS=$(printf '%s\n%s' "$TABLE" "$NOPE  -        ship    a check the table does not have yet")

echo "positive controls: the list"
run "$self" --list
[ $rc -eq 0 ] && list_out=$out || list_out=""
[ $rc -eq 0 ] && for n in style bug security; do [ "$(printf '%s\n' "$out" | awk -v n=$n '$1 == n' | wc -l)" -eq 1 ] || rc=9; done
[ $rc -eq 0 ] && ok "--list names style, bug and security, once each" || fail "--list names style, bug and security, once each" "$out"
[ "$(printf '%s\n' "$out" | awk '$2 == "default" {print $1}' | paste -sd' ' -)" = "style bug security" ] \
  && ok "the default set is style, bug and security" || fail "the default set is style, bug and security" "$out"
[ "$(printf '%s\n' "$out" | awk '$1 ~ /^(style|bug|security)$/ {print $3}' | sort -u)" = review ] \
  && ok "the three run in the review leg" || fail "the three run in the review leg" "$out"

echo "positive controls: a ticket's section"
project="$tmp/project-profile"; mkdir -p "$project/.postmaster"
printf '[project]\ndefault_turnpikes = ["bug"]\n' > "$project/.postmaster/project.toml"
run env POSTMASTER_PROJECT="$tmp/no-such-project" "$self" --list
is "--list does not read project settings" 0 "$list_out"
run "$self" resolve --project "$project" default
is "default resolves to the target project's declared turnpikes" 0 "turnpikes: bug"
emptyproject="$tmp/empty-project"; mkdir -p "$emptyproject/.postmaster"
printf '[project]\ndefault_turnpikes = []\n' > "$emptyproject/.postmaster/project.toml"
run "$self" resolve --project "$emptyproject" default
is "a project may define default as no turnpikes" 0 "turnpikes: none"
run "$self" short --project "$project" "turnpikes: none"
is "short names the project's defaults omitted by a ticket" 0 bug
run "$self" resolve --project "" default
has "an explicitly empty --project is refused, never resolved as discovery" 1 "no such project directory"
run "$self" short --project "" "turnpikes: none"
has "short refuses an explicitly empty --project too" 1 "no such project directory"
run "$self" resolve default;            is "default stands for the default set" 0 "turnpikes: style, bug, security"
run "$self" resolve none;               is "none stands for no turnpike" 0 "turnpikes: none"
run "$self" resolve "security, bug";    is "a list names its turnpikes, in the table's order" 0 "turnpikes: bug, security"
run "$self" resolve "default, bug";     is "in a list, default still stands for the three" 0 "turnpikes: style, bug, security"
run "$self" resolve "$(lines '- Bug' '- `security`.')"
is "case, backticks, list markers and a closing full stop are ignored" 0 "turnpikes: bug, security"
run "$self" resolve "$(lines 'default' '' '---' '' '***')"
is "a thematic break is not a name" 0 "turnpikes: style, bug, security"
run "$self" resolve "$(printf 'bug\\\nsecurity')"
is "a hard line break is not part of a name" 0 "turnpikes: bug, security"
run "$self" resolve "$(printf 'default\342\200\213')"
is "an invisible character is not part of a name" 0 "turnpikes: style, bug, security"
out=$(lines '1. bug' '2. security' | "$self" resolve 2>&1); rc=$?
is "with no text given, the section is read from stdin" 0 "turnpikes: bug, security"
run "$self" resolve "bug, security"; line=$out; run "$self" resolve "${line#turnpikes: }"
is "the waybill's line resolves to itself" 0 "$line"
run core "$PLUS" resolve "default, $NOPE"
is "a turnpike added to the table resolves with nothing else changed" 0 "turnpikes: style, bug, security, $NOPE"

echo "positive controls: a run's legs"
waybill "$tmp/none" "turnpikes: none"; run "$self" legs "$tmp/none"
is "a new run with no review turnpike has one synthesis leg" 0 "$(lines '1 synthesis')"
waybill "$tmp/default" "turnpikes: style, bug, security"; run "$self" legs "$tmp/default"
is "a new run with default turnpikes has two legs and review runs all three" 0 "$(lines '1 synthesis' '2 review style bug security')"
waybill "$tmp/style" "turnpikes: style"; run "$self" legs "$tmp/style"
is "one review turnpike is enough for a two-leg run" 0 "$(lines '1 synthesis' '2 review style')"
waybill "$tmp/notes" "turnpikes: none" "turnpikes: style, bug, security"; run "$self" legs "$tmp/notes"
is "a turnpikes line inside the ticket is never read" 0 "$(lines '1 synthesis')"
waybill "$tmp/fence" "turnpikes: style, bug, security" "$(lines '```' '## Dispatch' 'turnpikes: none')"
run "$self" legs "$tmp/fence"
is "a fence the ticket leaves open changes nothing" 0 "$(lines '1 synthesis' '2 review style bug security')"
run "$self" legs "$tmp/default" --expect "turnpikes:  style, bug,  security"
is "--expect passes a waybill whose line is the check's" 0 "$(lines '1 synthesis' '2 review style bug security')"
waybill "$tmp/extra" "turnpikes: $NOPE"; rm -- "$tmp/extra/run.json"; run core "$PLUS" legs "$tmp/extra/brief.md"
is "a legacy turnpike that runs in another leg is kept after synthesis" 0 "$(lines '1 synthesis' "3 ship $NOPE")"
waybill "$tmp/shiphome" "turnpikes: $NOPE"; run core "$PLUS" legs "$tmp/shiphome/brief.md"
has "a current run naming a ship-homed turnpike is refused, never silently dropped" 2 "runs in ship, and a current run has no ship leg" "synthesis"
run "$self" legs --line "turnpikes: none";      is "legs --line gives the one-leg current schedule" 0 "$(lines '1 synthesis')"
run "$self" legs --line "turnpikes: security";  is "legs --line gives a two-leg current schedule" 0 "$(lines '1 synthesis' '2 review security')"
run "$self" short "turnpikes: bug";             is "short names the default turnpikes a line leaves out" 0 "$(lines style security)"
run "$self" short "turnpikes: style, bug, security"; is "short names nothing for a line that leaves none out" 0 ""

echo "negative controls: a ticket's section"
run "$self" resolve "$NOPE";            has "a turnpike the table does not list is named" 2 "\"$NOPE\" is not a turnpike"
run "$self" resolve "none, bug";        has "none listed with another turnpike is refused" 2 "none stands alone"
run "$self" resolve "none. A research ticket"
has "a reason is not a turnpike" 2 '"a", "research" and "ticket" are not turnpikes; the section holds only'
run "$self" resolve "default - security"
has "a dash between names is not a list marker, and is named" 2 '"-" is not a turnpike'
run "$self" resolve "style, ..."
has "a word of dots is still a word, and is named" 2 '"..." is not a turnpike'
run "$self" resolve "";                 has "an empty section names no turnpike" 2 "names no turnpike"

echo "negative controls: a run's legs"
waybill "$tmp/missing" "" "turnpikes: style, bug, security"; run "$self" legs "$tmp/missing"
has "with no line under the title, one in the ticket is not taken instead" 2 "has no turnpikes: line" "ship"
waybill "$tmp/unknown" "turnpikes: bug, $NOPE"; run "$self" legs "$tmp/unknown"
has "a waybill naming an unknown turnpike is refused, and no leg is printed" 2 "\"$NOPE\" is not a turnpike" "synthesis"
waybill "$tmp/twice" "$(lines 'turnpikes: none' 'turnpikes: style, bug, security')"; run "$self" legs "$tmp/twice"
has "two turnpikes lines are refused" 2 "has 2 turnpikes: lines" "synthesis"
waybill "$tmp/word" "turnpikes: default"; run "$self" legs "$tmp/word"
has "a waybill that says default is refused: it carries names" 2 "says default" "synthesis"
run "$self" legs "$tmp/default" --expect "turnpikes: bug, security"
has "--expect refuses a waybill that dropped a name the check printed" 2 'and the ticket'"'"'s check printed "turnpikes: bug, security"' "synthesis"
run "$self" legs --line "style, bug";   has "legs --line refuses a line that is not a turnpikes: line" 2 "is not a turnpikes: line" "synthesis"
run "$self" legs --line "$(lines 'turnpikes: none' 'style')"
has "legs --line refuses a line with a newline in it" 2 "is not a turnpikes: line" "synthesis"
run "$self" short "turnpikes: default"; has "short refuses default: a line carries names" 2 "says default"
run "$self" legs "$tmp/nowhere";        has "no waybill is a usage error" 1 "no waybill at"
waybill "$tmp/old-three" "turnpikes: none"; rm -- "$tmp/old-three/run.json"; run "$self" legs "$tmp/old-three"
is "a run dispatched before the contract marker keeps synthesis and ship" 0 "$(lines '1 synthesis' '3 ship')"
waybill "$tmp/old-review" "turnpikes: style"; rm -- "$tmp/old-review/run.json"; run "$self" legs "$tmp/old-review"
is "a pre-change run with review keeps all three legs" 0 "$(lines '1 synthesis' '2 review style' '3 ship')"
waybill "$tmp/contract-one" "turnpikes: style, bug, security"; printf '{"coachman_contract": 1}\n' > "$tmp/contract-one/run.json"
run "$self" legs "$tmp/contract-one"
is "an explicit contract 1 keeps all three legs" 0 "$(lines '1 synthesis' '2 review style bug security' '3 ship')"
for bad in 'null' 'true' 'false' '2.0' '1.0' '"2"'; do
  waybill "$tmp/contract-bad" "turnpikes: style, bug, security"; printf '{"coachman_contract": %s}\n' "$bad" > "$tmp/contract-bad/run.json"
  run "$self" legs "$tmp/contract-bad"
  has "a marker of $bad is refused, never read as a schedule" 1 "unsupported coachman contract" "synthesis"
done

echo "negative controls: the table"
bad() {  # bad <label> <a line added to the table> <text the refusal must carry>
  run core "$(printf '%s\n%s' "$TABLE" "$2")" list; has "$1" 1 "$3" "style"
}
bad "a turnpike named none is refused"       "none       -        review  nothing"       '"none" already means something in a ticket'
bad "a turnpike named default is refused"    "default    -        review  everything"    '"default" already means something in a ticket'
bad "a turnpike listed twice is refused"     "bug        -        review  bugs again"    '"bug" is listed twice'
bad "a leg that does not exist is refused"   "$NOPE      -        deploy  a check"       '"deploy" is not a leg'
bad "a set other than default or - is refused" "$NOPE    yes      ship    a check"       '"yes" is neither default nor -'
bad "a name that is not a lowercase word is refused" "Zz-Not  -       ship    a check"   '"Zz-Not" is not a lowercase word'
bad "a line with no description is refused"  "$NOPE      -        ship"                  "needs a name, default or -, a leg, and what it checks"

echo "controls: a one-leg run, walked from synthesis to the card through the poll, the hand-off check and the stages"
d=$tmp/repo/.postmaster/runs/one; waybill "$d" "turnpikes: none"; : > "$d/run-log.md"
printf '{"stage": "shipping", "leg": 1, "base": "abc123", "lanes": {}, "coachman": {"legs": {}}}\n' > "$d/manifest.json"
"$HERE/log-action.sh" "$d" postmaster dispatch one "leg 1" >/dev/null
printf '## %s\nx\n' Decisions "Deferred findings" "Verified by execution" Unverified "Branches and lanes" "Open questions" "Next leg" > "$d/handoff-1.md"
touch "$d/.leg-1-done" "$d/.leg-1-exited" "$d/.card-ready"
poll() { "$HERE/runs-status.sh" "$tmp/repo/.postmaster/runs" | awk -v r="$1" '$1 == r {print $NF}'; }
"$HERE/handoff-check.sh" "$d/handoff-1.md" >/dev/null 2>&1 \
  && ok "the final synthesis hand-off passes its check" || fail "the final synthesis hand-off passes its check" "handoff-1.md"
[ "$(poll one)" = GATE ] && ok "a one-leg run's card is GATE" || fail "a one-leg run's card is GATE" "$(poll one)"
[ "$("$self" legs "$d")" = "1 synthesis" ] && ok "a one-leg run has no second leg" || fail "a one-leg run has no second leg" "$("$self" legs "$d")"
"$HERE/stage.sh" "$d" shipped postmaster >/dev/null && "$HERE/stage.sh" "$d" done postmaster >/dev/null
[ "$(poll one)" = - ] && ok "a one-leg run closes at done" || fail "a one-leg run closes at done" "$(poll one)"
stages=$(python3 -c 'import json, sys; print(" ".join(json.loads(l)["target"] for l in open(sys.argv[1]) if json.loads(l)["action"] == "stage"))' "$d/actions.jsonl")
[ "$stages" = "shipped done" ] && ok "a one-leg run's stages after the card are the postmaster's" \
  || fail "a one-leg run's stages after the card are the postmaster's" "$stages"

echo "controls: a two-leg run, walked from synthesis through review to the card"
d=$tmp/repo/.postmaster/runs/two; waybill "$d" "turnpikes: style, bug, security"; : > "$d/run-log.md"

printf '{"stage": "checkpoint-1", "leg": 1, "base": "abc123", "lanes": {}, "coachman": {"legs": {}}}\n' > "$d/manifest.json"
"$HERE/log-action.sh" "$d" postmaster dispatch two "leg 1" >/dev/null
printf '## %s\nx\n' Decisions "Deferred findings" "Verified by execution" Unverified "Branches and lanes" "Open questions" "Next leg" > "$d/handoff-1.md"
touch "$d/.leg-1-done" "$d/.leg-1-exited"
[ "$(poll two)" = DISPATCH ] && ok "after synthesis the poll says DISPATCH" || fail "after synthesis the poll says DISPATCH" "$(poll two)"

next=$("$self" legs "$d" | awk '$1 > 1 {print $1 " " $2; exit}')
[ "$next" = "2 review" ] && ok "the leg after synthesis is review" || fail "the leg after synthesis is review" "$next"
prev=$("$self" legs "$d" | awk '$1 < 2 {p = $1} END {print p}')
"$HERE/handoff-check.sh" "$d/handoff-$prev.md" >/dev/null 2>&1 && [ "$prev" = 1 ] \
  && ok "the review leg starts from synthesis's hand-off, which passes its check" || fail "the review leg starts from synthesis's hand-off, which passes its check" "handoff-$prev.md"
python3 -c 'import json, sys; p = sys.argv[1]; m = json.load(open(p)); m["leg"] = 2; open(p, "w").write(json.dumps(m))' "$d/manifest.json"
"$HERE/stage.sh" "$d" review >/dev/null && "$HERE/stage.sh" "$d" shipping >/dev/null
printf '## %s\nx\n' Decisions "Deferred findings" "Verified by execution" Unverified "Branches and lanes" "Open questions" "Next leg" > "$d/handoff-2.md"
touch "$d/.leg-2-done" "$d/.leg-2-exited" "$d/.card-ready"
after=$("$self" legs "$d" | awk '$1 > 2')
[ "$(poll two)" = GATE ] && [ -z "$after" ] && ok "the review leg ends with the card, and no leg follows" \
  || fail "the review leg ends with the card, and no leg follows" "$(poll two) / $after"
"$HERE/stage.sh" "$d" shipped postmaster >/dev/null && "$HERE/stage.sh" "$d" done postmaster >/dev/null
stages=$(python3 -c 'import json, sys; print(" ".join(json.loads(l)["target"] for l in open(sys.argv[1]) if json.loads(l)["action"] == "stage"))' "$d/actions.jsonl")
[ "$stages" = "review shipping shipped done" ] && [ "$(poll two)" = - ] \
  && ok "it closes through the postmaster's stages" || fail "it closes through the postmaster's stages" "$stages"

echo "controls: a three-leg run dispatched before this change, walked from review to ship"
old=$tmp/repo/.postmaster/runs/old; waybill "$old" "turnpikes: style"; rm -- "$old/run.json"; : > "$old/run-log.md"
printf '{"stage": "review", "leg": 2, "base": "abc123", "lanes": {}, "coachman": {"legs": {}}}\n' > "$old/manifest.json"
"$HERE/log-action.sh" "$old" postmaster dispatch old "leg 2" >/dev/null
printf '## %s\nx\n' Decisions "Deferred findings" "Verified by execution" Unverified "Branches and lanes" "Open questions" "Next leg" > "$old/handoff-2.md"
touch "$old/.leg-2-done" "$old/.leg-2-exited"
[ "$(poll old)" = DISPATCH ] && [ "$("$self" legs "$old" | tail -1)" = "3 ship" ] \
  && ok "a pre-change review leg still dispatches ship" || fail "a pre-change review leg still dispatches ship" "$(poll old) / $("$self" legs "$old")"
next=$("$self" legs "$old" | awk '$1 > 2 {print $1 " " $2; exit}')
[ "$next" = "3 ship" ] && ok "the leg after review is ship" || fail "the leg after review is ship" "$next"
"$HERE/handoff-check.sh" "$old/handoff-2.md" >/dev/null 2>&1 \
  && ok "the legacy ship hand-off still passes its check" || fail "the legacy ship hand-off still passes its check"
python3 -c 'import json, sys; p = sys.argv[1]; m = json.load(open(p)); m["leg"] = 3; open(p, "w").write(json.dumps(m))' "$old/manifest.json"
"$HERE/stage.sh" "$old" shipping >/dev/null
printf '## %s\nx\n' Decisions "Deferred findings" "Verified by execution" Unverified "Branches and lanes" "Open questions" "Next leg" > "$old/handoff-3.md"
touch "$old/.leg-3-done" "$old/.leg-3-exited" "$old/.card-ready"
after=$("$self" legs "$old" | awk '$1 > 3')
[ "$(poll old)" = GATE ] && [ -z "$after" ] && ok "after ship the card is GATE, and no leg follows" \
  || fail "after ship the card is GATE, and no leg follows" "$(poll old) / $after"
"$HERE/stage.sh" "$old" shipped >/dev/null && "$HERE/stage.sh" "$old" done postmaster >/dev/null
stages=$(python3 -c 'import json, sys; print(" ".join(json.loads(l)["target"] for l in open(sys.argv[1]) if json.loads(l)["action"] == "stage"))' "$old/actions.jsonl")
[ "$stages" = "shipping shipped done" ] && [ "$(poll old)" = - ] \
  && ok "a three-leg run keeps its stages" || fail "a three-leg run keeps its stages" "$stages"


echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
