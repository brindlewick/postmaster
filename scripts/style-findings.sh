#!/usr/bin/env bash
# A run's style findings. They gate nothing: the review leg logs them and applies none, the ship
# card counts them, and aftercare sorts each into a rule for a linter the project's gate runs, a
# convention for the project's own docs, or neither. The postmaster puts the sort to the user
# after the merge.
#
#   style-findings.sh list <dispatch>    each style finding: its id, where it is, the rest of its line
#   style-findings.sh count <dispatch>   how many style findings the run has
#   style-findings.sh gate <dispatch>    what the waybill's gate runs, each line after where it is
#   style-findings.sh check <dispatch>   whether <dispatch>/style-sort.md sorts every style finding
#   style-findings.sh --self-test
#
# A style finding is a `finding` line in <dispatch>/actions.jsonl whose detail opens with `style`.
# A gating finding's opens with `gating`, and scripts/log-action.sh refuses a finding with neither.
# The ids are S1, S2, ... in the order the lines were logged.
#
# The sort holds one line per style finding, in any order, and may hold headings, blank lines and
# list bullets besides:
#
#   S<n> linter <linter> enable <rule>: <reason>        an existing rule of a linter the gate runs
#   S<n> linter <linter> write <rule>: <reason>         a custom rule to write for it
#   S<n> docs <doc>: <reason>                           a convention for the project's own docs
#   S<n> neither: <reason>
#   N<n> new-linter <linter> S<n>[,S<m>...]: <reason>   a linter the gate does not run, on its own
#
# The reason follows the first colon that ends a word, so a rule's name may hold colons. A linter
# is one the gate runs when its name is a word of the gate command or of what that command
# reaches: the package.json scripts it runs through npm, pnpm, yarn, bun, npm-run-all, run-s, run-p
# or npm:, with their pre and post scripts; the make targets it builds, with their prerequisites;
# and the files the repo tracks that it runs, less their comment lines. The gate and the repo are
# the ones the waybill's Project profile names. Nothing the gate runs is run to find out.
#
# On exit 0, check prints one line per proposal, with the findings that share a linter and rule,
# or a doc, on one line, and then the counts.
#
#   exit 0  printed
#   exit 1  usage, no waybill or action log where one is needed, or a file that cannot be read
#   exit 2  check: the sort is missing or wrong; gate: the waybill names no gate; list and count:
#           a finding line that is neither gating nor style. One line per fault, on stdout.
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
usage() { echo "usage: style-findings.sh list|count|gate|check <dispatch> | --self-test" >&2; exit 1; }

core() {  # core list|count|gate|check <dispatch>
  python3 - "$@" <<'PY'
import fnmatch, json, os, re, shlex, subprocess, sys

cmd, dispatch = sys.argv[1], sys.argv[2]
SORT = os.path.join(dispatch, "style-sort.md")
FORMS = ('a sort line is one of: "S<n> linter <linter> enable <rule>: <reason>", '
         '"S<n> linter <linter> write <rule>: <reason>", "S<n> docs <doc>: <reason>", '
         '"S<n> neither: <reason>", "N<n> new-linter <linter> S<n>[,S<m>...]: <reason>"')

def die(msg):
    print("style-findings: " + msg, file=sys.stderr); sys.exit(1)

def read(path, what):
    try:
        return open(path, encoding="utf-8", errors="replace").read()
    except FileNotFoundError:
        die("no %s at %s" % (what, path))
    except OSError as e:
        die("cannot read %s: %s" % (path, e.strerror))

def findings():  # ([(id, where, rest)], [fault])
    path = os.path.join(dispatch, "actions.jsonl")
    style, faults = [], []
    for n, line in enumerate(read(path, "action log").split("\n"), 1):
        if not line.strip():
            continue
        try:
            e = json.loads(line)
        except ValueError:
            die("%s line %d is not JSON" % (path, n))
        if not isinstance(e, dict) or e.get("action") != "finding":
            continue
        words = str(e.get("detail", "")).split(None, 1)
        if words and words[0] == "style":
            style.append(("S%d" % (len(style) + 1), str(e.get("target", "")), words[1] if len(words) > 1 else ""))
        elif not words or words[0] != "gating":
            faults.append("actions.jsonl line %d: a finding whose detail opens with %s, not gating or style"
                          % (n, '"%s"' % words[0] if words else "nothing"))
    return style, faults

def profile():  # (repo, gate) from the waybill's own Project profile, the last one, after the ticket
    lines = read(os.path.join(dispatch, "brief.md"), "waybill").split("\n")
    heads = [i for i, l in enumerate(lines) if re.fullmatch(r" {0,3}##[ \t]+project profile[ \t:#]*\r?", l, re.I)]
    repo = gate = None
    for l in (lines[heads[-1] + 1:] if heads else []):
        if re.match(r" {0,3}#{1,2}(?:[ \t]|\r?$)", l):
            break
        m = re.match(r"\s*repo:(.*?)(?:\s+default branch:.*|\s+BASE:.*)?\s*$", l, re.I)
        if m and repo is None:
            repo = m.group(1).strip() or None
        m = re.match(r"\s*gate:(.*?)(?:\s+build:.*|\s+browser suite:.*)?\s*$", l, re.I)
        if m and gate is None:
            gate = m.group(1).strip() if m.group(1).strip().lower() not in ("", "none") else None
    return repo, gate

# --- what the gate runs -------------------------------------------------------------------------
PUNCT = set(";&|()<>")
SHELL_WORDS = {"!", "{", "}", "if", "then", "do", "else", "elif", "while", "until", "time"}
INTERPRETERS = {"bash", "sh", "zsh", "dash", "ksh", "source", ".", "node", "nodejs", "python",
                "python3", "bun", "deno", "tsx", "ts-node", "ruby", "perl"}

def commands(line):  # the commands in one line of shell, each a list of words
    line = re.sub(r"\$\(MAKE\)|\$\{MAKE\}", "make", line)
    try:
        lex = shlex.shlex(line, posix=True, punctuation_chars=";&|()<>")
        lex.whitespace_split, lex.commenters = True, ""
        toks = list(lex)
    except ValueError:
        toks = re.sub(r"(&&|\|\||[;&|()<>])", r" \1 ", line).split()
    cmd, skip = [], False
    for t in toks:
        if skip:
            skip = False
        elif t and set(t) <= PUNCT:
            skip = "<" in t or ">" in t          # a redirection's target is not a command
            if cmd and not skip:
                yield cmd; cmd = []
        else:
            cmd.append(t)
    if cmd:
        yield cmd

def parse_make(path):  # ({target: (prerequisites, recipe lines)}, default goal)
    rules, first, default, current = {}, None, None, None
    try:
        text = open(path, encoding="utf-8", errors="replace").read()
    except OSError:
        return {}, None
    for line in re.sub(r"\\\r?\n", " ", text).split("\n"):
        if line.startswith("\t"):
            for t in current or []:
                rules[t][1].append(line[1:])
            continue
        body = line.split("#", 1)[0]
        if not body.strip() or re.match(r"\s*(ifeq|ifneq|ifdef|ifndef|else|endif)\b", body):
            continue                             # a conditional does not end a recipe
        m = re.match(r"\s*\.DEFAULT_GOAL\s*(?::{1,2}|[?+])?=\s*(\S+)", body)
        if m:
            default, current = m.group(1), None
            continue
        assign = r"\s*(?:export\s+|override\s+)?[A-Za-z0-9_.-]+\s*(?::{1,2}|[?+!])?="
        m = re.match(r"([^:=#]+?)\s*::?(?!=)(.*)$", body)
        if not m or re.match(assign, body) or re.match(assign, m.group(2)):
            current = None                       # an assignment or a directive ends a recipe
            continue
        prereqs, _, inline = m.group(2).partition(";")
        current = m.group(1).split()
        for t in current:
            rules.setdefault(t, ([], []))
            rules[t][0].extend(p for p in prereqs.split() if p != "|")
            if inline.strip():
                rules[t][1].append(inline.strip())
            if first is None and not t.startswith(".") and "%" not in t:
                first = t
    return rules, default or first

class Reach:  # the text a gate command reaches, as (where, line) pairs, found by reading alone
    def __init__(self, repo, gate):
        self.repo, self.lines, self.seen, self.warnings, self.makes = os.path.realpath(repo), [], set(), [], {}
        try:
            ls = subprocess.run(["git", "-C", self.repo, "ls-files", "-z"], capture_output=True, timeout=60)
            self.tracked = set(ls.stdout.decode("utf-8", "replace").split("\0")) - {""} if ls.returncode == 0 else None
        except (OSError, subprocess.SubprocessError):
            self.tracked = None
        if self.tracked is None:
            self.warnings.append("%s is not a git repository, so any file of it the gate runs was read" % self.repo)
        self.scripts = {}
        pj = os.path.join(self.repo, "package.json")
        if os.path.isfile(pj):
            try:
                s = json.load(open(pj, encoding="utf-8")).get("scripts") or {}
                self.scripts = {k: v for k, v in s.items() if isinstance(v, str)}
            except (OSError, ValueError, AttributeError):
                self.warnings.append("package.json does not parse, so no script of it was followed")
        self.text("gate", gate)

    def text(self, where, text, comments=False):
        for raw in re.sub(r"\\\r?\n", " ", text).split("\n"):
            line = raw.strip()
            if not line or (comments and re.match(r"(#|//)", line)):
                continue
            self.lines.append((where, line))
            self.scan(line)

    def scan(self, line):  # every command in the line, and in any quoted word that holds one
        for words in commands(line):
            self.command(words)
            for w in words:
                if re.search(r"\s", w):
                    self.scan(w)

    def command(self, words):
        while words and (words[0] in SHELL_WORDS or re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", words[0])):
            words = words[1:]
        if not words:
            return
        for i, w in enumerate(words):
            b, rest = os.path.basename(w), words[i + 1:]
            if b in ("npm", "pnpm", "yarn", "bun"):
                self.manager(b, rest)
            elif b in ("npm-run-all", "npm-run-all2", "run-s", "run-p"):
                for a in rest:
                    if not a.startswith("-"):
                        self.scripts_like(a)
            elif b in ("make", "gmake"):
                self.make(rest)
            if w.startswith("npm:"):
                self.scripts_like(w[4:])
        if os.path.basename(words[0]) in INTERPRETERS:
            args = [a for a in words[1:] if not a.startswith("-") and a != "run"]
            if args:
                self.file(args[0])
        elif "/" in words[0]:
            self.file(words[0])

    def manager(self, pm, rest):
        args = [a for a in rest if not a.startswith("-")]
        if not args:
            return
        sub, after = args[0], args[1:]
        if sub in ("run", "run-script", "rum", "urn"):
            if after and after[0] in self.scripts:
                self.script(after[0])
            elif after and pm == "bun":
                self.file(after[0])
        elif pm == "npm":
            if sub in ("test", "t", "tst", "start", "stop", "restart"):
                self.script({"t": "test", "tst": "test"}.get(sub, sub))
        elif sub in self.scripts and not (pm == "bun" and sub == "test"):
            self.script(sub)                     # pnpm, yarn and bun run a script by its name alone

    def scripts_like(self, pattern):
        for n in sorted(self.scripts):
            if fnmatch.fnmatchcase(n, pattern):
                self.script(n)

    def script(self, name):  # a script, with its pre and post scripts
        for n in ("pre" + name, name, "post" + name):
            if n in self.scripts and ("script", n) not in self.seen:
                self.seen.add(("script", n))
                self.text("package.json scripts.%s" % n, self.scripts[n])

    def make(self, rest):
        d, f, targets, i = self.repo, None, [], 0
        while i < len(rest):
            a = rest[i]
            if a in ("-C", "--directory", "-f", "--file", "--makefile") and i + 1 < len(rest):
                if a in ("-C", "--directory"):
                    d = os.path.join(d, rest[i + 1])
                else:
                    f = rest[i + 1]
                i += 2
                continue
            if a.startswith("--directory="):
                d = os.path.join(d, a.split("=", 1)[1])
            elif a.startswith("-C") and len(a) > 2:
                d = os.path.join(d, a[2:])
            elif a.startswith(("--file=", "--makefile=")):
                f = a.split("=", 1)[1]
            elif not a.startswith("-") and "=" not in a:
                targets.append(a)
            i += 1
        names = [f] if f else ["GNUmakefile", "makefile", "Makefile"]
        paths = [os.path.realpath(os.path.join(d, n)) for n in names]
        mk = next((p for p in paths if os.path.isfile(p) and self.inside(p)), None)
        if mk is None:
            return
        if mk not in self.makes:
            self.makes[mk] = parse_make(mk)
        rules, goal = self.makes[mk]
        for t in targets or ([goal] if goal else []):
            self.target(mk, t)

    def target(self, mk, t):
        rules = self.makes[mk][0]
        if ("make", mk, t) in self.seen or t not in rules:
            return
        self.seen.add(("make", mk, t))
        for p in rules[t][0]:
            self.target(mk, p)
        for line in rules[t][1]:
            line = re.sub(r"^\s*[@+-]*", "", line).replace("$$", "$")
            self.text("%s %s" % (os.path.relpath(mk, self.repo), t), line, comments=True)

    def inside(self, p):
        return p.startswith(self.repo + os.sep)

    def file(self, p):  # a file the repo tracks that a command runs, less its comment lines
        full = os.path.realpath(os.path.join(self.repo, p))
        if not self.inside(full) or not os.path.isfile(full) or ("file", full) in self.seen:
            return
        if self.tracked is not None and os.path.relpath(full, self.repo) not in self.tracked:
            return
        self.seen.add(("file", full))
        try:
            if os.path.getsize(full) > 512 * 1024:
                return
            data = open(full, "rb").read()
        except OSError:
            return
        if b"\0" in data[:8192]:
            return
        text = data.decode("utf-8", "replace")
        self.text(os.path.relpath(full, self.repo), text, comments=True)

    def runs(self, linter):
        pat = re.compile(r"(?<![A-Za-z0-9_-])" + re.escape(linter) + r"(?![A-Za-z0-9_-])")
        return any(pat.search(line) for _, line in self.lines)

def reach():  # (Reach, None) or (None, why not)
    repo, gate = profile()
    if not gate:
        return None, "the waybill's Project profile names no gate"
    if not repo or not os.path.isdir(repo):
        return None, "the waybill's Project profile names no repo that exists%s" % (": " + repo if repo else "")
    return Reach(repo, gate), None

# --- the commands -------------------------------------------------------------------------------
if cmd in ("list", "count"):
    style, faults = findings()
    if faults:
        print("\n".join(faults)); sys.exit(2)
    if cmd == "count":
        print(len(style))
    for i, where, rest in (style if cmd == "list" else []):
        print(" ".join(x for x in (i, where, rest) if x))
    sys.exit(0)

if cmd == "gate":
    r, why = reach()
    if r is None:
        print(why); sys.exit(2)
    for w in r.warnings:
        print("style-findings: " + w, file=sys.stderr)
    for where, line in r.lines:
        print("%s: %s" % (where, line))
    sys.exit(0)

# check
style, faults = findings()
ids = [s[0] for s in style]
if not os.path.exists(SORT):
    if faults or style:
        print("\n".join(faults + ["no style-sort.md in %s, and %d style finding%s to sort"
                                   % (dispatch, len(style), "" if len(style) == 1 else "s")]))
        sys.exit(2)
    print("no style findings, so nothing to sort"); sys.exit(0)
entry = re.compile(r"(?:[-*+][ \t]+)?(S\d+|N\d+)[ \t]+(.+?):(?:[ \t]+(.*))?")
sorted_on, new_on, props, shape = {}, {}, [], False
linters_to_check = []                      # (line number, id, linter, run or not)
for n, raw in enumerate(read(SORT, "sort").split("\n"), 1):
    line = raw.strip()
    if not line or line.startswith("#"):
        continue
    m = entry.fullmatch(line)
    head = m.group(2).split() if m else []
    ok = bool(m) and (
        (m.group(1)[0] == "S" and (
            (len(head) == 4 and head[0] == "linter" and head[2] in ("enable", "write"))
            or (len(head) == 2 and head[0] == "docs") or head == ["neither"]))
        or (m.group(1)[0] == "N" and len(head) >= 3 and head[0] == "new-linter"))
    if not ok:
        faults.append("line %d is not a sort line: %s" % (n, line)); shape = True
        continue
    i, reason = m.group(1), (m.group(3) or "").strip()
    if not reason:
        faults.append("line %d: %s has no reason" % (n, i))
    if i[0] == "S":
        sorted_on.setdefault(i, []).append(n)
        if i not in ids:
            faults.append("line %d: %s is not a style finding of this run" % (n, i))
        if head[0] == "linter":
            linters_to_check.append((n, i, head[1], True))
        props.append((i, " ".join(head)))
    else:
        new_on.setdefault(i, []).append(n)
        covers = [c for c in re.split(r"[,\s]+", " ".join(head[2:])) if c]
        for c in covers:
            if not re.fullmatch(r"S\d+", c) or c not in ids:
                faults.append("line %d: %s names %s, which is not a style finding of this run" % (n, i, c))
        linters_to_check.append((n, i, head[1], False))
        props.append((i, "new-linter %s, for %s" % (head[1], " ".join(covers))))
for i in ids:
    if i not in sorted_on:
        faults.append("%s is not sorted" % i)
for i, where in list(sorted_on.items()) + list(new_on.items()):
    if len(where) > 1:
        faults.append("%s is sorted twice, on lines %s" % (i, ", ".join(map(str, where))))
if linters_to_check:
    r, why = reach()
    for n, i, linter, must_run in linters_to_check:
        if r is None and must_run:
            faults.append("line %d: %s names %s, and %s to check it against" % (n, i, linter, why.replace("names no", "has no")))
        elif r is not None and must_run and not r.runs(linter):
            faults.append("line %d: %s names %s, which the gate does not run; sort it docs or neither, and propose %s on a new-linter line"
                          % (n, i, linter, linter))
        elif r is not None and not must_run and r.runs(linter):
            faults.append("line %d: %s proposes %s, which the gate already runs; sort its findings as linter lines" % (n, i, linter))
if faults:
    print("\n".join(faults + ([FORMS] if shape else []))); sys.exit(2)

groups = {}
for i, p in props:
    groups.setdefault(p, []).append(i)
rank = lambda p: (0 if p.startswith("linter") else 1 if p.startswith("docs") else 2 if p.startswith("new-linter") else 3)
for p in sorted(groups, key=rank):
    print("%s: %s" % (" ".join(groups[p]), p))
kinds = [p.split()[0] for i, p in props if i[0] == "S"]
plural = lambda k, one, many: "%d %s" % (k, one if k == 1 else many)
print("sorted %s: %d to a linter, %d to the docs, %d to neither; %s proposed"
      % (plural(len(ids), "style finding", "style findings"), kinds.count("linter"), kinds.count("docs"),
         kinds.count("neither"), plural(len(new_on), "new linter", "new linters")))
PY
}

case ${1:-} in
  list|count|gate|check)
    [ $# -eq 2 ] || usage
    [ -d "$2" ] || { echo "style-findings: no dispatch directory at $2" >&2; exit 1; }
    core "$1" "$2"; exit $? ;;
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
lines() { printf '%s\n' "$@"; }
waybill() {  # waybill <dispatch> <repo> <gate, or nothing>
  mkdir -p "$1"
  { printf '# Waybill: T-1\n\n## Ticket\n## Problem / feature\nA change.\n\n## Project profile\ngate: make decoy\n\n'
    printf '## Project profile\nrepo: %s          default branch: main       BASE: abc123\n' "$2"
    printf 'gate: %s  build: none    browser suite: none\ndocs to read first: AGENTS.md\n\n' "$3"
    printf '## Dispatch\ndispatch: %s\nturnpikes: style, bug, security\n' "$1"; } > "$1/brief.md"
}
logged() { "$HERE/log-action.sh" "$1" coachman "${@:2}" >/dev/null; }
sort_file() { lines "$@" > "$d/style-sort.md"; }

# An npm project: the gate reaches check, its pre script, lint through npm run, the test:* scripts
# through run-s, typos through pnpm, and a file precheck runs; never format, docs or test.
npm_repo=$tmp/npm; mkdir -p "$npm_repo/scripts"
cat > "$npm_repo/package.json" <<'EOF'
{
  "scripts": {
    "check": "tsc --noEmit && npm run lint && run-s 'test:*' && touch gate-ran",
    "precheck": "node scripts/versions.js && ./node_modules/.bin/helper",
    "lint": "cross-env NODE_ENV=ci biome check . && pnpm typos",
    "typos": "typos . > scripts/typos.txt",
    "test:unit": "bun test",
    "test": "vitest",
    "format": "eslint --fix .",
    "docs": "markdownlint docs"
  }
}
EOF
lines '// oxlint would catch more here' 'require("child_process").execSync("stylelint src")' > "$npm_repo/scripts/versions.js"
lines 'jscpd is written here, and nothing runs it' > "$npm_repo/scripts/typos.txt"
mkdir -p "$npm_repo/node_modules/.bin"; lines '#!/bin/sh' 'prettier --check .' > "$npm_repo/node_modules/.bin/helper"
git -C "$npm_repo" init -q && git -C "$npm_repo" add package.json scripts || exit 1

# A make project: the gate reaches check's prerequisites, a recursive make, and a script a recipe
# runs; never fmt, nor a tool its script names only in a comment.
make_repo=$tmp/make; mkdir -p "$make_repo/scripts"
printf '%s\n' '.PHONY: check lint test' 'check: lint test' 'lint:' '	@shellcheck scripts/*.sh' 'ifdef CI' '	$(MAKE) docs-lint' 'endif' \
  '	touch make-ran' 'docs-lint:' '	-markdownlint docs' 'test:' '	./scripts/test.sh' 'fmt:' '	ruff format .' > "$make_repo/Makefile"
lines '#!/bin/sh' '# pylint is not run here' 'bats test' > "$make_repo/scripts/test.sh"
git -C "$make_repo" init -q && git -C "$make_repo" add -A || exit 1

d=$tmp/runs/proj/T-1; waybill "$d" "$npm_repo" "npm run check"
logged "$d" dispatch luna thread-1
logged "$d" finding src/a.ts:12 "style P3 r1 style luna reading: a list named map"
logged "$d" finding src/b.ts:40 "gating P1 r1 style,bug luna,sol execution: an off-by-one the style lens found"
logged "$d" finding src/c.ts:7 "style P3 r2 bug sol reading: a let never reassigned, reported under bug"
logged "$d" apply abc1234 "src/b.ts:40"
none=$tmp/runs/proj/T-2; waybill "$none" "$npm_repo" "npm run check"
logged "$none" finding src/b.ts:40 "gating P2 r1 bug luna reading: style is named here, and the finding is gating"

echo "positive controls: a run's style findings"
run "$self" count "$d";                 is "a run with two style findings counts two" 0 2
run "$self" list "$d"
is "they are listed in the order logged, whichever lens found them, and not the gating one the style lens found" 0 \
  "$(lines 'S1 src/a.ts:12 P3 r1 style luna reading: a list named map' 'S2 src/c.ts:7 P3 r2 bug sol reading: a let never reassigned, reported under bug')"

echo "negative controls: a run's style findings"
run "$self" count "$none";              is "a run whose findings are all gating counts none" 0 0
run "$self" list "$none";               is "and lists none" 0 ""
before=$(wc -l < "$d/actions.jsonl")
"$HERE/log-action.sh" "$d" coachman finding src/x.ts:1 "P2 r1 bug luna reading: no class" >/dev/null 2>"$tmp/err"; rc=$?
[ $rc -eq 1 ] && [ "$(wc -l < "$d/actions.jsonl")" -eq "$before" ] && grep -qF "gating or style" "$tmp/err" \
  && ok "log-action.sh refuses a finding with no class, and writes nothing" || fail "log-action.sh refuses a finding with no class, and writes nothing (exit $rc)" "$(cat "$tmp/err")"
bad=$tmp/runs/proj/T-3; mkdir -p "$bad"; cp "$d/actions.jsonl" "$bad/"
printf '{"action":"finding","target":"src/x.ts:1","detail":"advisory P3 r1 style luna reading: old words"}\n' >> "$bad/actions.jsonl"
run "$self" count "$bad";               has "a finding logged with another class is named, and nothing is counted" 2 'line 6: a finding whose detail opens with "advisory"'
run "$self" count "$tmp/runs/proj";     has "no action log is refused, never read as no findings" 1 "no action log at"

echo "positive controls: what the gate runs"
run "$self" gate "$d"
for want in "gate: npm run check" "package.json scripts.precheck: node scripts/versions.js" \
            "package.json scripts.lint: cross-env NODE_ENV=ci biome check . && pnpm typos" "package.json scripts.typos: typos . > scripts/typos.txt" \
            "package.json scripts.test:unit: bun test" 'scripts/versions.js: require("child_process").execSync("stylelint src")'; do
  has "the gate reaches: $want" 0 "$want"
done
m=$tmp/runs/proj/T-4; waybill "$m" "$make_repo" "make check"; logged "$m" dispatch luna thread-1
run "$self" gate "$m"
for want in "Makefile lint: shellcheck scripts/*.sh" "Makefile docs-lint: markdownlint docs" "Makefile test: ./scripts/test.sh" "scripts/test.sh: bats test"; do
  has "a make gate reaches: $want" 0 "$want"
done
has "a recipe goes on past a conditional" 0 "Makefile lint: touch make-ran"

echo "negative controls: what the gate runs"
run "$self" gate "$d"
for not in scripts.format scripts.docs "scripts.test: " vitest oxlint prettier jscpd decoy; do
  has "the gate does not reach $not" 0 "gate: npm run check" "$not"
done
run "$self" gate "$m"
for not in ruff pylint decoy; do has "a make gate does not reach $not" 0 "Makefile lint:" "$not"; done
[ ! -e "$npm_repo/gate-ran" ] && [ ! -e "$make_repo/make-ran" ] && [ ! -e "$tmp/gate-ran" ] && [ ! -e "$tmp/make-ran" ] \
  && ok "nothing the gate runs was run" || fail "nothing the gate runs was run"
g=$tmp/runs/proj/T-5; waybill "$g" "$npm_repo" ""
run "$self" gate "$g";                  is "a waybill that names no gate is refused" 2 "the waybill's Project profile names no gate"

echo "positive controls: the sort"
sort_file "# Style sort: T-1" "" "- S2 linter biome enable style/useConst: biome flags a let that is never reassigned" \
  "- S1 docs AGENTS.md: the project names a collection by what it holds, and nothing says so"
run "$self" check "$d"
is "a sort of every finding passes, and prints its proposals and counts" 0 \
  "$(lines 'S2: linter biome enable style/useConst' 'S1: docs AGENTS.md' \
           'sorted 2 style findings: 1 to a linter, 1 to the docs, 0 to neither; 0 new linters proposed')"
five=$tmp/runs/proj/T-6; waybill "$five" "$npm_repo" "npm run check"
for f in "src/a.ts:1 let never reassigned" "src/b.ts:2 let never reassigned again" "src/c.sh:3 an unquoted variable" \
         "src/d.ts:4 an abbreviation the project spells out" "src/e.ts:5 a needless return"; do
  logged "$five" finding "${f%% *}" "style P3 r1 style luna reading: ${f#* }"
done
d=$five
sort_file "S1 linter biome enable style/useConst: biome flags a let never reassigned" "S2 linter biome enable style/useConst: the same rule" \
  "S3 neither: quoting needs a shell linter, proposed below" "S4 docs CONTRIBUTING.md: names are spelled out, which no linter checks" \
  "* S5 linter biome write plugin::no-needless-return: biome has no rule for it, and a plugin can add one" \
  "N1 new-linter shellcheck S3: the gate runs no shell linter"
run "$self" check "$d"
is "findings that share a rule share a line, a rule may hold colons, and a new linter is its own proposal" 0 \
  "$(lines 'S1 S2: linter biome enable style/useConst' 'S5: linter biome write plugin::no-needless-return' \
           'S4: docs CONTRIBUTING.md' 'N1: new-linter shellcheck, for S3' 'S3: neither' \
           'sorted 5 style findings: 3 to a linter, 1 to the docs, 1 to neither; 1 new linter proposed')"
good=$(cat "$d/style-sort.md")
sort_file "S1 linter stylelint enable declaration-no-important: a linter a file the gate runs runs" \
  "$(printf '%s\n' "$good" | sed 1d)"
run "$self" check "$d";                 has "a linter run by a file the gate runs counts as run" 0 "S1: linter stylelint enable"
run "$self" check "$none";              is "a run with no style findings and no sort has nothing to sort" 0 "no style findings, so nothing to sort"
sort_file "S1 linter shellcheck enable SC2086: a make gate runs shellcheck" "S2 neither: x" "S3 neither: x" "S4 neither: x" "S5 neither: x"
cp "$d/actions.jsonl" "$m/actions.jsonl"; cp "$d/style-sort.md" "$m/style-sort.md"
run "$self" check "$m";                 has "a linter a make target runs counts as run" 0 "S1: linter shellcheck enable SC2086"

echo "negative controls: the sort, each fault named"
broken() {  # broken <label> <text a fault line must hold> <sed script applied to the good sort>
  printf '%s\n' "$good" | sed "$3" > "$d/style-sort.md"; run "$self" check "$d"; has "$1" 2 "$2" " to neither;"
}
broken "a finding left out"                    "S4 is not sorted"                          '/^S4 /d'
broken "a finding sorted twice"                "S2 is sorted twice, on lines 2, 7"         '$a S2 neither: again'
broken "an id that is no style finding"        "line 7: S9 is not a style finding"         '$a S9 neither: no such finding'
broken "a line with no reason"                 "line 3: S3 has no reason"                  's/^S3 neither: .*/S3 neither:/'
broken "a kind that is not one of the three"   "line 4 is not a sort line"                 's/^S4 docs/S4 convention/'
broken "a linter line with no enable or write" "line 1 is not a sort line"                 's/biome enable/biome/;1!b'
broken "prose between the lines"               "line 7 is not a sort line: These are"      '$a These are the findings.'
broken "and the forms are then given"          'a sort line is one of: "S<n> linter'       '$a These are the findings.'
broken "a linter only an unreached script runs" "S1 names eslint, which the gate does not run" '1s/biome enable style\/useConst/eslint enable prefer-const/'
broken "a linter only a comment names"         "S1 names oxlint, which the gate does not run" '1s/biome enable style\/useConst/oxlint enable prefer-const/'
broken "a new linter the gate already runs"    "N1 proposes biome, which the gate already runs" 's/new-linter shellcheck/new-linter biome/'
broken "a new linter for no such finding"      "N1 names S9, which is not a style finding"  's/shellcheck S3/shellcheck S3,S9/'
rm -f "$d/style-sort.md"; run "$self" check "$d"
has "no sort at all, with findings to sort"    2 "no style-sort.md in $d, and 5 style findings to sort"
waybill "$d" "$npm_repo" ""; printf '%s\n' "$good" > "$d/style-sort.md"; run "$self" check "$d"
has "a linter line with no gate to check it against" 2 "S1 names biome, and the waybill's Project profile has no gate"
cp "$d/style-sort.md" "$none/"; run "$self" check "$none"
has "a sort for a run with no style findings" 2 "S1 is not a style finding of this run"
run "$self" check "$tmp/nowhere";       has "no dispatch directory is a usage error" 1 "no dispatch directory"

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
