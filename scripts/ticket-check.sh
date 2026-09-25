#!/usr/bin/env bash
# Check a ticket's shape before it is accepted: a title, the problem or feature, numbered
# acceptance criteria each answerable yes or no, and the direction. This is the executable form
# of the ticket shape in skills/postmaster/trackers.md.
#
#   ticket-check.sh <repo> <ticket-id>                    through the tracker adapter the config
#                                                         names ([tracker] kind)
#   ticket-check.sh --body <body-file> [--title <title>]  a body file, as an adapter's create
#                                                         takes it
#   ticket-check.sh --self-test
#
# What it judges, and nothing more:
#   - The title has words.
#   - `## Problem / feature`, `## Acceptance criteria` and `## Direction` are each present once,
#     at level two, in that order, with words under them and nothing marked TBD, TBC or TODO.
#     Headings match ignoring case, a trailing colon, a closing run of # and the spacing
#     around the slash.
#   - The acceptance criteria are a list numbered 1, 2, 3 in order, with nothing outside the
#     list. Indented lines, nested lists and lines running straight on belong to the criterion
#     above them.
#   - Each criterion is answerable yes or no, which here means three things a script can see:
#     it has words, it asks no question (no question mark ends a sentence in it), and it marks
#     nothing TBD, TBC or TODO.
# Code spans, fenced blocks and HTML comments are not read for questions, markers or headings.
#
# What it does not judge: whether the description says why the change matters; whether a
# criterion is vague ("fast enough", "where possible") or can really be tested; whether the
# criteria are the right ones, or enough; what the direction says. `## Notes` and
# `## User journey` are optional and not checked.
#
# POSTMASTER_CONFIG overrides the config path (~/.postmaster/config.toml). A tracker of kind
# `other` has no adapter script: read the ticket with its own tooling and check it with --body.
#
#   exit 0  well-formed; prints how many acceptance criteria it has
#   exit 1  usage, no such body file, no config or one that does not parse, a tracker kind with
#           no adapter script, or the adapter could not read the ticket
#   exit 2  malformed; one line per missing or malformed part on stdout, the part named first
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
CONFIG=${POSTMASTER_CONFIG:-$HOME/.postmaster/config.toml}
usage() { echo "usage: ticket-check.sh <repo> <ticket-id> | --body <body-file> [--title <title>] | --self-test" >&2; exit 1; }

check() {  # check body <body-file> <title> | check printed <adapter-read-output-file>
  python3 - "$@" <<'PY'
import re, sys

mode, path = sys.argv[1], sys.argv[2]
title = sys.argv[3] if len(sys.argv) > 3 else ""
try:
    text = open(path, encoding="utf-8", errors="replace").read()
except OSError as e:
    print("ticket-check: cannot read %s: %s" % (path, e.strerror), file=sys.stderr); sys.exit(1)
if mode == "printed":  # an adapter's read: `key: value` lines, a blank line, then the body
    head, _, text = text.partition("\n\n")
    title = next((l[len("title:"):] for l in head.split("\n") if l.startswith("title:")), "")
text = re.sub(r"<!--.*?-->", "", text, flags=re.S)

PARTS = [("problem / feature", "Problem / feature"),
         ("acceptance criteria", "Acceptance criteria"),
         ("direction", "Direction")]
HEADING = re.compile(r"^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$")
FENCE = re.compile(r"^\s*(`{3,}|~{3,})")
ITEM = re.compile(r"^ {0,2}(\d{1,9})[.)](?:[ \t]+(.*))?$")
BULLET = re.compile(r"^ {0,3}[-*+](?:[ \t]|$)")
MARKED = re.compile(r"\b(TBD|TBC|TODO)\b")
QUESTION = re.compile(r"\?(?=\s|$)")

def norm(h):
    h = re.sub(r"[ \t]+#+$", "", h.strip()).strip().rstrip(":")
    return re.sub(r"\s+", " ", re.sub(r"\s*/\s*", " / ", h)).strip().lower()

def has_words(lines):
    return bool(re.search(r"[^\W_]", " ".join(t for t, _ in lines)))

def prose(lines):  # the text a reader is asked to judge: no fenced blocks, no code spans
    return re.sub(r"(`+).+?\1", " ", "\n".join(t for t, code in lines if not code))

def clip(s, n=70):
    s = " ".join(s.split())
    return s if len(s) <= n else s[:n - 3] + "..."

lines, fence = [], None  # (text, inside a fenced block)
for t in text.split("\n"):
    m = FENCE.match(t)
    if fence:
        lines.append((t, True))
        if m and m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence) and not t.strip().strip(fence[0]):
            fence = None
    elif m:
        fence = m.group(1); lines.append((t, True))
    else:
        lines.append((t, False))

heads = []  # (line, level, normalised text, as written)
for i, (t, code) in enumerate(lines):
    m = None if code else HEADING.match(t)
    if m:
        heads.append((i, len(m.group(1)), norm(m.group(2) or ""), t.strip()))
# A section ends at the next heading of level one or two, or at any heading naming a part of the
# shape, so a part written at the wrong level is not read as the text of the part above it.
SHAPE = {k for k, _ in PARTS} | {"notes", "user journey"}
bounds = [h for h in heads if h[1] <= 2 or h[2] in SHAPE]

def section(i):
    end = next((b[0] for b in bounds if b[0] > i), len(lines))
    return lines[i + 1:end]

faults = []
def fault(part, msg):
    faults.append("%s: %s" % (part, msg))

def criteria(part, body):
    items, strays = [], []  # items: [number, lines]; strays: the first line of each block outside the list
    cur, blank, owner, prev_code, in_stray = None, False, None, False, False
    for t, code in body:
        if code:
            if not prev_code:  # a fence opens: it belongs to the criterion above it, or to nothing
                owner = cur if cur is not None and (t[:1].isspace() or not blank) else None
                if owner is None and not in_stray:
                    strays.append(t.strip())
                in_stray = owner is None
            if owner is not None:
                owner[1].append((t, True))
            prev_code, blank = True, False
            continue
        prev_code = False
        if not t.strip():
            blank, in_stray = True, False
            continue
        m = ITEM.match(t)
        if m:
            cur = [int(m.group(1)), [(m.group(2) or "", False)]]
            items.append(cur); blank = in_stray = False
            continue
        if cur is not None and (t[:1].isspace() or not (blank or BULLET.match(t) or HEADING.match(t))):
            cur[1].append((t, False)); blank = False
            continue
        if not in_stray:
            strays.append(t.strip())
        cur, blank, in_stray = None, False, True
    if not items:
        fault(part, "not a numbered list")
        return 0
    for s in strays:
        fault(part, 'not part of a numbered criterion: "%s"' % clip(s))
    numbers = [n for n, _ in items]
    if numbers != list(range(1, len(items) + 1)):
        fault(part, "numbered %s; number them 1 to %d in order" % (", ".join(map(str, numbers)), len(items)))
    for pos, (_, ls) in enumerate(items, 1):
        if not has_words(ls):
            fault(part, "criterion %d is empty" % pos); continue
        p = prose(ls)
        m = MARKED.search(p)
        if m:
            fault(part, "criterion %d is marked %s" % (pos, m.group(1)))
        if QUESTION.search(p):
            fault(part, 'criterion %d asks a question: "%s"' % (pos, clip(ls[0][0] or p)))
    return len(items)

if not re.search(r"[^\W_]", title):
    fault("title", "missing")

at, count = {}, 0
for key, name in PARTS:
    found = [h for h in bounds if h[1] == 2 and h[2] == key]
    if not found:
        near = [h for h in heads if h[2] == key]
        msg = 'no "## %s" section' % name
        if near:
            msg += '; "%s" is there, at the wrong level' % near[0][3]
        elif key == "direction":
            msg += '; one is needed even if it says "None: any approach that meets the criteria"'
        fault(key, msg)
        continue
    if len(found) > 1:
        fault(key, '"## %s" appears %d times' % (name, len(found)))
    at[key] = found[0][0]
    body = section(found[0][0])
    if not has_words(body):
        fault(key, '"## %s" is empty' % name)
    elif key == "acceptance criteria":
        count = criteria(key, body)
    else:
        m = MARKED.search(prose(body))
        if m:
            fault(key, '"## %s" is marked %s' % (name, m.group(1)))

for j, (key, name) in enumerate(PARTS):
    after = [n for k, n in PARTS[:j] if k in at and key in at and at[k] > at[key]]
    if after:
        fault(key, '"## %s" comes before "## %s"; the order is %s' % (name, after[0], ", ".join(n for _, n in PARTS)))

if faults:
    print("\n".join(faults)); sys.exit(2)
print("well-formed, %d acceptance criteria" % count)
PY
}

through_adapter() {  # through_adapter <repo> <id>; checks the ticket as the configured adapter reads it
  local kind out rc
  [ -f "$CONFIG" ] || { echo "ticket-check: no config at $CONFIG (POSTMASTER_CONFIG overrides the path)" >&2; return 1; }
  kind=$(python3 -c 'import sys, tomllib; print(tomllib.load(open(sys.argv[1], "rb")).get("tracker", {}).get("kind", "github"))' "$CONFIG" 2>/dev/null) \
    || { echo "ticket-check: cannot read [tracker] kind from $CONFIG (python3 3.11 or newer reads it)" >&2; return 1; }
  out=$(mktemp) || return 1
  case $kind in
    github) "$HERE/github.sh" "$1" read "$2" > "$out" ;;
    plane)  "$HERE/plane.sh" read "$2" > "$out" ;;
    *) rm -f -- "$out"
       echo "ticket-check: tracker kind '$kind' has no adapter script; read the ticket with its own tooling (trackers.md, other), write its body to a file, and run: ticket-check.sh --body <file> --title <title>" >&2
       return 1 ;;
  esac
  rc=$?
  if [ $rc -ne 0 ]; then rm -f -- "$out"; echo "ticket-check: the $kind adapter could not read $2 (exit $rc)" >&2; return 1; fi
  check printed "$out"; rc=$?
  rm -f -- "$out"; return $rc
}

case ${1:-} in
  --self-test) ;;
  --body)
    [ $# -eq 2 ] || { [ $# -eq 4 ] && [ "$3" = --title ]; } || usage
    [ -f "$2" ] || { echo "ticket-check: no such body file: $2" >&2; exit 1; }
    check body "$2" "${4:-}"; exit $? ;;
  ""|-*) usage ;;
  *) [ $# -eq 2 ] || usage
     through_adapter "$1" "$2"; exit $? ;;
esac

# --- self-test ----------------------------------------------------------------------------
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/         /'; fails=$((fails+1)); }

# The parts of a well-formed body. Each negative control leaves one out or breaks one.
P='## Problem / feature
A ticket reaches a coachman with no criteria, so it has nothing to judge the lanes against.'
A='## Acceptance criteria
1. The check exits 0 on a well-formed ticket and prints how many criteria it has.
2. It exits 2 and names each missing part:
   - the title
   - the direction
   1. a nested number is part of criterion 2, not a criterion

   ```
   ## Direction
   ticket-check.sh --body draft.md   # which draft? TODO
   ```
3. A question or a marker in code, `a?` or `TODO`, is not read,
and a line that runs straight on belongs to the criterion above it.

   So does an indented paragraph after a blank line.'
D='## Direction
<!-- a template comment is not read: TODO -->
None: any approach that meets the criteria.'
N='## Notes
A heading inside a fenced block is not a section:

```
## Direction
```'
T="Check a ticket's shape"
body() { printf '%s\n\n' "$@" > "$tmp/body.md"; }

expect() {  # expect <label> <exit> <parts named, comma-separated, or none> [<text a line must contain>]
  local label=$1 rc_want=$2 parts_want=$3 why=${4:-} parts
  parts=$(printf '%s\n' "$out" | grep -E '^(title|problem / feature|acceptance criteria|direction): ' | sed 's/: .*//' | LC_ALL=C sort -u | paste -sd, -)
  [ -n "$parts" ] || parts=none
  if [ "$rc" -eq "$rc_want" ] && [ "$parts" = "$parts_want" ] && { [ -z "$why" ] || printf '%s\n' "$out" | grep -qF -- "$why"; }; then
    ok "$label"
  else
    fail "$label: wanted exit $rc_want naming $parts_want${why:+ with \"$why\"}, got exit $rc naming $parts" "$out"
  fi
}
run() { out=$(check body "$tmp/body.md" "$1" 2>&1); rc=$?; }  # run <title>

echo "positive controls"
body "$P" "$A" "$D" "$N"; run "$T"
expect "a well-formed ticket passes" 0 none
[ "$out" = "well-formed, 3 acceptance criteria" ] && ok "it counts three criteria, not the nested number or the lines under them" \
  || fail "it counts three criteria, not the nested number or the lines under them" "$out"
body "$P" "$A" "$D"; run "$T"
expect "Notes and User journey are optional" 0 none
body "## Problem/Feature
Tickets arrive without criteria." "## Acceptance Criteria:
1) The check runs on every ticket." "## Direction ##
Use the tracker adapters."; run "$T"
expect "headings match ignoring case, a colon, the slash's spacing and a closing #" 0 none
body "$P" "## Acceptance criteria
1.
The check runs, the criterion's text on the line below its number." "$D"; run "$T"
expect "a criterion's text may start on the line below its number" 0 none
body "$P" '## Acceptance criteria
1. Setup asks "Overwrite the config?" before writing, and prints https://example.org/board?view=kanban.' "$D"; run "$T"
expect "a question mark that ends no sentence is not a question" 0 none
printf '%s\r\n' "## Problem / feature" "Tickets arrive without criteria." "" "## Acceptance criteria" "1. The check runs." "" "## Direction" "None." > "$tmp/body.md"; run "$T"
expect "a body with CRLF line endings passes" 0 none
{ printf 'id: #7\ntitle: %s\nstate: todo\nlabels: \ncreated: 2026-09-23\n\n' "$T"; printf '%s\n\n' "$P" "$A" "$D"
  printf '## Log\n- 2026-09-25 10:00 postmaster: does a question here count?\n'; } > "$tmp/printed.txt"
out=$(check printed "$tmp/printed.txt" 2>&1); rc=$?
expect "an adapter's read output passes, its log included" 0 none

echo "negative controls: each part is named on its own"
body "$P" "$A" "$D" "$N"; run ""
expect "no title" 2 title "title: missing"
sed 's/^title: .*/title: /' "$tmp/printed.txt" > "$tmp/printed-untitled.txt"
out=$(check printed "$tmp/printed-untitled.txt" 2>&1); rc=$?
expect "no title in an adapter's read output" 2 title "title: missing"
body "$A" "$D" "$N"; run "$T"
expect "no problem or feature" 2 "problem / feature" 'no "## Problem / feature" section'
body "## Problem / feature" "$A" "$D"; run "$T"
expect "an empty problem or feature" 2 "problem / feature" "is empty"
body "$P" "$D" "$N"; run "$T"
expect "no acceptance criteria" 2 "acceptance criteria" 'no "## Acceptance criteria" section'
body "$P" "## Acceptance criteria
- The check runs.
- It names each part." "$D"; run "$T"
expect "criteria that are not numbered" 2 "acceptance criteria" "not a numbered list"
body "$P" "## Acceptance criteria
1. The check runs.
1. It names each part.
1. It exits 2." "$D"; run "$T"
expect "criteria numbered out of order" 2 "acceptance criteria" "numbered 1, 1, 1; number them 1 to 3 in order"
body "$P" "## Acceptance criteria
1. The check runs.
2. Should it also run at dispatch?" "$D"; run "$T"
expect "a criterion that asks a question" 2 "acceptance criteria" "criterion 2 asks a question"
body "$P" "## Acceptance criteria
1. The check runs.
2. The retry limit is TBD." "$D"; run "$T"
expect "a criterion marked TBD" 2 "acceptance criteria" "criterion 2 is marked TBD"
body "$P" "## Acceptance criteria
1. The check runs.
2." "$D"; run "$T"
expect "an empty criterion" 2 "acceptance criteria" "criterion 2 is empty"
body "$P" "## Acceptance criteria
1. The check runs.
2. It names each part.

Also, the README names it,
and the runbook." "$D"; run "$T"
expect "a criterion outside the numbered list" 2 "acceptance criteria" 'not part of a numbered criterion: "Also, the README names it,"'
[ "$(printf '%s\n' "$out" | grep -c 'not part of')" -eq 1 ] && ok "a paragraph outside the list is named once, not per line" \
  || fail "a paragraph outside the list is named once, not per line" "$out"
body "$P" "## Acceptance criteria
1. The check runs.
- It names each part." "$D"; run "$T"
expect "an unnumbered criterion straight after a numbered one" 2 "acceptance criteria" 'not part of a numbered criterion: "- It names each part."'
body "$P" "## Acceptance criteria
1. The check runs.
### Details" "$D"; run "$T"
expect "a heading straight after a criterion" 2 "acceptance criteria" 'not part of a numbered criterion: "### Details"'
body "$P" "$A" "$A" "$D"; run "$T"
expect "acceptance criteria twice" 2 "acceptance criteria" "appears 2 times"
body "$P" "$A" "$N"; run "$T"
expect "no direction, even with one inside a fenced block" 2 direction 'no "## Direction" section; one is needed even if'
body "$P" "$A" "## Direction
TBD, once the spike is done."; run "$T"
expect "a direction marked TBD" 2 direction '"## Direction" is marked TBD'
body "$P" "$A" "### Direction
None: any approach that meets the criteria."; run "$T"
expect "a direction at the wrong level" 2 direction '"### Direction" is there, at the wrong level'
body "$P" "$D" "$A"; run "$T"
expect "a direction before the criteria" 2 direction '"## Direction" comes before "## Acceptance criteria"'
: > "$tmp/body.md"; run ""
expect "an empty ticket names all four parts" 2 "acceptance criteria,direction,problem / feature,title"

echo "negative controls: a ticket that cannot be read is not a verdict"
"$HERE/ticket-check.sh" >/dev/null 2>&1; rc=$?
[ $rc -eq 1 ] && ok "no arguments is a usage error" || fail "no arguments is a usage error (exit $rc)"
"$HERE/ticket-check.sh" --body "$tmp/nowhere.md" >/dev/null 2>&1; rc=$?
[ $rc -eq 1 ] && ok "a missing body file is refused" || fail "a missing body file is refused (exit $rc)"
printf '[tracker]\nkind = "other"\nname = "notes"\n' > "$tmp/config.toml"
out=$(POSTMASTER_CONFIG="$tmp/config.toml" "$HERE/ticket-check.sh" "$tmp" 7 2>/dev/null); rc=$?
[ $rc -eq 1 ] && [ -z "$out" ] && ok "a tracker kind with no adapter script is refused, not judged" \
  || fail "a tracker kind with no adapter script is refused, not judged (exit $rc)" "$out"
printf '[tracker]\nkind = "github"\n' > "$tmp/config.toml"
out=$(POSTMASTER_CONFIG="$tmp/config.toml" "$HERE/ticket-check.sh" "$tmp/no-such-repo" 7 2>/dev/null); rc=$?
[ $rc -eq 1 ] && [ -z "$out" ] && ok "an adapter that cannot read the ticket is exit 1, not a shape fault" \
  || fail "an adapter that cannot read the ticket is exit 1, not a shape fault (exit $rc)" "$out"

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
