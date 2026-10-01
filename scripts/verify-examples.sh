#!/usr/bin/env bash
# The default check for a command-line app: run the ticket's examples through the project's own
# command. An example is a transcript in the ticket's `## User journey`: a fenced block whose first
# line starts with `$ `. A transcript anywhere else, such as one showing a bug as it is, is not an
# example. Each `$ ` line is a command, and the lines after it, up to the next `$ ` line, are what it
# prints, stdout and stderr together as a terminal shows them. A last line `[exit N]` says it
# exits N; without one it must exit 0. Each block runs in a fresh empty directory, which is also
# HOME, one command at a time through bash, so a later command sees what an earlier one wrote and
# no block sees another's.
#
#   verify-examples.sh [<worktree>] [--ticket <file>]
#   verify-examples.sh --self-test
#
# The project's command is each name package.json's `bin` gives, run from <worktree> through the
# interpreter its file's #! line names, or node for a .js file with none. Where package.json has
# a build script it runs first, through the package manager, since a bin may name what a build
# makes. <worktree> defaults to the current directory, and the ticket to the one
# scripts/verify.sh arm copied beside the run's checks ($POSTMASTER_VERIFY/ticket.md, else
# .postmaster/verify/ticket.md). A ticket that is a waybill is read from its `## Ticket` heading
# to its `## Project profile` heading.
#
#   exit 0  every command printed what its example says and exited as it says
#   exit 1  one did not, or the build failed; each difference is shown
#   exit 3  not run: no ticket, no transcript in its User journey, no command to run it through, or
#           a tool the command or its build needs is not on PATH; the reason is the last line
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
usage() { echo "usage: verify-examples.sh [<worktree>] [--ticket <file>] | --self-test" >&2; exit 1; }

examples() {  # examples <worktree> <ticket-file or ''>
  python3 -I - "$@" <<'PY'
import atexit, json, os, pathlib, re, shlex, shutil, subprocess, sys, tempfile

wt, ticket = pathlib.Path(sys.argv[1]).resolve(), sys.argv[2]
FENCE = re.compile(r"^(\s*)(`{3,}|~{3,})(.*)$")
EXIT = re.compile(r"\[exit (\d+)\]")
BIN_NAME = re.compile(r"[A-Za-z0-9@._+-]+")
TIMEOUT = 60

def not_run(msg):
    print("not run: " + msg); sys.exit(3)

def ticket_lines(text):  # the ticket, or a waybill's ticket part
    lines = text.splitlines()
    start = next((i for i, l in enumerate(lines) if re.match(r"^##\s+Ticket\s*$", l)), None)
    if start is None:
        return lines
    end = next((i for i in range(start + 1, len(lines)) if re.match(r"^##\s+Project profile\s*$", lines[i])), len(lines))
    return lines[start + 1:end]

def section(lines, title):  # the lines under `## <title>`, to the next heading of level 1 or 2 outside a fence
    start = next((i for i, l in enumerate(lines) if re.match(r"^##\s+%s\s*$" % re.escape(title), l, re.I)), None)
    if start is None:
        return None
    out, fence = [], None
    for l in lines[start + 1:]:
        m = FENCE.match(l)
        if fence is None and re.match(r"^#{1,2}\s", l):
            break
        if m and fence is None and not (m.group(2)[0] == "`" and "`" in m.group(3)):
            fence = m.group(2)
        elif m and fence and m.group(2)[0] == fence[0] and len(m.group(2)) >= len(fence) and not m.group(3).strip():
            fence = None
        out.append(l)
    return out

def blocks(lines):  # the body of every fenced block, dedented by its fence
    out, i = [], 0
    while i < len(lines):
        m = FENCE.match(lines[i])
        if m and not (m.group(2)[0] == "`" and "`" in m.group(3)):
            indent, fence, body = len(m.group(1)), m.group(2), []
            i += 1
            while i < len(lines):
                c = re.match(r"^\s*(`{3,}|~{3,})\s*$", lines[i])
                if c and c.group(1)[0] == fence[0] and len(c.group(1)) >= len(fence):
                    break
                body.append(re.sub(r"^ {0,%d}" % indent, "", lines[i]))
                i += 1
            out.append(body)
        i += 1
    return out

def trim(lines):
    lines = [l.rstrip() for l in lines]
    while lines and not lines[-1]:
        lines.pop()
    return lines

def transcript(body):  # [{"cmd", "out", "exit"}] or None when the block is not a transcript
    first = next((l for l in body if l.strip()), None)
    if first is None or not first.startswith("$ "):
        return None
    cmds = []
    for l in body:
        if l.startswith("$ "):
            cmds.append({"cmd": l[2:].strip(), "out": []})
        elif cmds:
            cmds[-1]["out"].append(l)
    for c in cmds:
        out, c["exit"] = trim(c["out"]), 0
        if out and EXIT.fullmatch(out[-1].strip()):
            c["exit"] = int(EXIT.fullmatch(out[-1].strip()).group(1))
            out = trim(out[:-1])
        c["out"] = out
    return cmds

if not ticket:
    spec = pathlib.Path(os.environ.get("POSTMASTER_VERIFY") or wt / ".postmaster" / "verify")
    ticket = str(spec / "ticket.md")
try:
    text = open(ticket, encoding="utf-8", errors="replace").read()
except OSError:
    not_run("no ticket at %s; scripts/verify.sh arm copies the run's there" % ticket)
journey = section(ticket_lines(text), "User journey")
if journey is None:
    not_run("the ticket has no User journey, where a command-line app's example transcripts go")
scripts = [t for t in (transcript(b) for b in blocks(journey)) if t]
if not scripts:
    not_run("the ticket's User journey has no example transcript: a fenced block whose first line starts with `$ `")

pkg_file = wt / "package.json"
if not pkg_file.is_file():
    not_run("no package.json in %s, so no command to run the examples through; this default runs a "
            "package.json project's bin, so declare the check in .postmaster/project.toml" % wt)
try:
    pkg = json.load(open(pkg_file, encoding="utf-8"))
except (OSError, ValueError) as e:
    not_run("package.json does not parse: %s" % e)
raw = pkg.get("bin")
if isinstance(raw, str):
    name = str(pkg.get("name") or "").split("/")[-1]
    bins = {name: raw} if name else {}
elif isinstance(raw, dict):
    bins = {k: v for k, v in raw.items() if isinstance(k, str) and isinstance(v, str)}
else:
    bins = {}
if not bins:
    not_run("package.json names no bin, so no command to run the examples through")
for name in bins:
    if not BIN_NAME.fullmatch(name) or name in (".", ".."):
        not_run("package.json names a bin %r, which is not a plain command name" % name)
runpath = os.pathsep.join([str(wt / "node_modules" / ".bin"), os.environ.get("PATH", "")])

if isinstance(pkg.get("scripts"), dict) and pkg["scripts"].get("build"):
    pm = ("pnpm" if (wt / "pnpm-lock.yaml").exists() else "bun" if (wt / "bun.lock").exists() or (wt / "bun.lockb").exists()
          else "yarn" if (wt / "yarn.lock").exists() else "npm")
    if not shutil.which(pm):
        not_run("package.json has a build script, run through %s, which is not on PATH" % pm)
    r = subprocess.run([pm, "run", "build"], cwd=wt, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if r.returncode != 0:
        print(r.stdout.decode("utf-8", "replace").rstrip())
        print("FAIL  the build failed: %s run build exited %d" % (pm, r.returncode)); sys.exit(1)

scratch = os.path.realpath(tempfile.mkdtemp(prefix="verify-examples-"))
atexit.register(shutil.rmtree, scratch, True)
shims = os.path.join(scratch, "bin")
os.mkdir(shims)
for name, rel in bins.items():
    f = (wt / rel).resolve()
    if not f.is_file():
        print("FAIL  bin %s names %s, which is not a file" % (name, rel)); sys.exit(1)
    first = open(f, "rb").readline().decode("utf-8", "replace").rstrip("\r\n")
    if first.startswith("#!"):
        argv = shlex.split(first[2:].strip())
    elif f.suffix in (".js", ".mjs", ".cjs"):
        argv = ["node"]
    else:
        not_run("cannot tell how to run bin %s: %s has no #! line" % (name, rel))
    prog = argv[0] if argv else ""
    if os.path.basename(prog) == "env":
        prog = next((a for a in argv[1:] if not a.startswith("-") and "=" not in a), "")
    if not prog or not (shutil.which(prog, path=runpath) if "/" not in prog else os.access(prog, os.X_OK)):
        not_run("bin %s runs through %s, which is not on PATH" % (name, prog or "an empty #! line"))
    shim = pathlib.Path(shims) / name
    shim.write_text("#!/bin/sh\nexec %s %s \"$@\"\n" % (" ".join(shlex.quote(a) for a in argv), shlex.quote(str(f))))
    shim.chmod(0o755)

failed = ran = 0
for n, cmds in enumerate(scripts, 1):
    home = os.path.join(scratch, "block-%d" % n)
    os.mkdir(home)
    env = dict(os.environ, HOME=home, PWD=home, NO_COLOR="1", PATH=os.pathsep.join([shims, runpath]))
    env.pop("BASH_ENV", None)
    for c in cmds:
        ran += 1
        try:
            r = subprocess.run(["bash", "-c", c["cmd"]], cwd=home, env=env, stdin=subprocess.DEVNULL,
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=TIMEOUT)
            got, code = trim(r.stdout.decode("utf-8", "replace").replace("\r\n", "\n").split("\n")), r.returncode
        except subprocess.TimeoutExpired:
            got, code = ["(timed out after %ds)" % TIMEOUT], None
        if got == c["out"] and code == c["exit"]:
            print("ok    $ %s" % c["cmd"])
            continue
        failed += 1
        print("FAIL  $ %s" % c["cmd"])
        if got != c["out"]:
            print("      expected:"); print("\n".join("        " + l for l in c["out"][:20]) or "        (nothing)")
            print("      got:"); print("\n".join("        " + l for l in got[:20]) or "        (nothing)")
        if code != c["exit"]:
            print("      exit: expected %d, got %s" % (c["exit"], "none, it timed out" if code is None else code))
print("%d of %d example commands did what the ticket says" % (ran - failed, ran))
sys.exit(1 if failed else 0)
PY
}

if [ "${1:-}" != "--self-test" ]; then
  WT=. TICKET=""
  while [ $# -gt 0 ]; do
    case $1 in
      --ticket) [ $# -ge 2 ] || usage; TICKET=$2; shift 2 ;;
      -*) usage ;;
      *) WT=$1; shift ;;
    esac
  done
  [ -d "$WT" ] || { echo "verify-examples: no such directory: $WT" >&2; exit 1; }
  examples "$WT" "$TICKET"; exit $?
fi

# --- self-test ----------------------------------------------------------------------------
tmp=$(cd "$(mktemp -d)" && pwd -P) || exit 1
trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
SELF="$HERE/verify-examples.sh"
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/         /'; fails=$((fails+1)); }
expect() {  # expect <label> <exit> <project> <ticket-file> [<text the output must hold>]
  local out rc
  out=$("$SELF" "$tmp/$3" --ticket "$4" 2>&1); rc=$?
  if [ "$rc" -eq "$2" ] && { [ -z "${5:-}" ] || grep -qF -- "$5" <<<"$out"; }; then ok "$1"; else fail "$1 (exit $rc)" "$out"; fi
}

# A command-line app whose bin is a bash script without the executable bit: the shim runs it
# through its #! line, as an installed package would.
mkdir -p "$tmp/app/bin"
printf '{"name": "greeter", "bin": {"greet": "bin/greet"}}\n' > "$tmp/app/package.json"
cat > "$tmp/app/bin/greet" <<'EOF'
#!/usr/bin/env bash
case "${1:-}" in
  "") echo "usage: greet <name> | greet save <name> | greet saved" >&2; exit 2 ;;
  save) echo "$2" > saved.txt; echo "saved $2" ;;
  saved) cat saved.txt 2>/dev/null || { echo "nothing saved" >&2; exit 1; } ;;
  *) echo "hello $1" ;;
esac
EOF
chmod 644 "$tmp/app/bin/greet"
mkdir -p "$tmp/nobin" "$tmp/noshebang/bin" "$tmp/built/bin" "$tmp/broken"
printf '{"name": "plain"}\n' > "$tmp/nobin/package.json"
printf '{"name": "x", "bin": {"x": "bin/x.sh"}}\n' > "$tmp/noshebang/package.json"
printf 'echo hi\n' > "$tmp/noshebang/bin/x.sh"
printf '{"name": "built", "bin": "dist/built.js", "scripts": {"build": "mkdir -p dist && cp bin/src.js dist/built.js"}}\n' > "$tmp/built/package.json"
printf "console.log('built ' + process.argv[2]);\n" > "$tmp/built/bin/src.js"
printf '{"name": "broken", "bin": "dist/broken.js", "scripts": {"build": "exit 4"}}\n' > "$tmp/broken/package.json"

cat > "$tmp/pass.md" <<'EOF'
## User journey
The user greets someone, saves a name and reads it back; a new directory has nothing saved.

```
$ greet world
hello world
$ greet
usage: greet <name> | greet save <name> | greet saved
[exit 2]
$ greet save ann
saved ann
$ greet saved
ann
$ test "$HOME" = "$PWD" && echo home is the block
home is the block
```

~~~sh
$ greet saved
nothing saved
[exit 1]
~~~
EOF
cat > "$tmp/output.md" <<'EOF'
## User journey
```
$ greet world
hello there
```
EOF
cat > "$tmp/exit.md" <<'EOF'
## User journey
```
$ greet
usage: greet <name> | greet save <name> | greet saved
```
EOF
cat > "$tmp/none.md" <<'EOF'
## Problem / feature
Today `greet` with no name greets nobody:

```
$ greet
hello
```

## User journey
The user types `greet world` and sees `hello world`.

```json
{"not": "a transcript"}
```
EOF
cat > "$tmp/nojourney.md" <<'EOF'
## Problem / feature
Greet people.
EOF
cat > "$tmp/waybill.md" <<'EOF'
# Waybill: T-1

## Ticket
## Problem / feature
Greet people.

## User journey
```
$ greet ann
hello ann
```

## Project profile
repo: /somewhere

```
$ greet ann
this block is not the ticket's, and would fail
```
EOF
cat > "$tmp/built.md" <<'EOF'
## User journey
```
$ built ok
built ok
```
EOF

echo "positive controls"
expect "matching transcripts pass, exits and state within a block included" 0 app "$tmp/pass.md" "6 of 6 example commands"
expect "only a waybill's ticket part is read"                               0 app "$tmp/waybill.md" "1 of 1"
expect "a build script runs before the bin is looked for"                   0 built "$tmp/built.md" "1 of 1"

echo "negative controls"
expect "a different output fails and shows both"      1 app "$tmp/output.md" "hello there"
expect "a different exit fails and names both"        1 app "$tmp/exit.md" "exit: expected 0, got 2"
expect "a failed build fails"                         1 broken "$tmp/built.md" "the build failed"
expect "a transcript outside the User journey is no example"  3 app "$tmp/none.md" "User journey has no example transcript"
expect "a ticket with no User journey is not run"     3 app "$tmp/nojourney.md" "has no User journey"
mkdir -p "$tmp/pathbin/bin"; printf '{"name": "p", "bin": {"%s": "bin/greet"}}\n' "$tmp/victim" > "$tmp/pathbin/package.json"; cp "$tmp/app/bin/greet" "$tmp/pathbin/bin/"
expect "a bin named with a path is not run"           3 pathbin "$tmp/pass.md" "not a plain command name"
[ ! -e "$tmp/victim" ] && ok "and nothing is written where it points" || fail "and nothing is written where it points"
mkdir -p "$tmp/nointerp/bin"; printf '{"name": "n", "bin": {"greet": "bin/greet"}}\n' > "$tmp/nointerp/package.json"
printf '#!/usr/bin/env no-such-interpreter-xyz\necho hi\n' > "$tmp/nointerp/bin/greet"
expect "a bin whose interpreter is not installed is not run"  3 nointerp "$tmp/pass.md" "runs through no-such-interpreter-xyz"
mkdir -p "$tmp/fewtools"; for t in bash python3 dirname; do ln -s "$(command -v $t)" "$tmp/fewtools/$t"; done
out=$(PATH="$tmp/fewtools" "$SELF" "$tmp/built" --ticket "$tmp/built.md" 2>&1); rc=$?
[ $rc -eq 3 ] && grep -qF "run through npm, which is not on PATH" <<<"$out" && ok "a build whose package manager is not installed is not run" || fail "a build whose package manager is not installed is not run (exit $rc)" "$out"
expect "a project with no bin is not run"             3 nobin "$tmp/pass.md" "names no bin"
expect "a bin with no #! line is not run"             3 noshebang "$tmp/pass.md" "has no #! line"
expect "a missing ticket is not run"                  3 app "$tmp/no-such-ticket.md" "no ticket at"
mkdir -p "$tmp/empty"
expect "a project with no package.json is not run"    3 empty "$tmp/pass.md" "no package.json"

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
