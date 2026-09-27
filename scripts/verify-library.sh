#!/usr/bin/env bash
# The default check for a library: run the tests that reach it the way its users do, by its
# package name, which resolves only to what the package exports.
#
#   verify-library.sh [<worktree>]
#   verify-library.sh --list [<worktree>]   the test files it would run, one per line
#   verify-library.sh --self-test
#
# A test file is a JavaScript or TypeScript file under a test, tests or __tests__ directory, or
# named *.test.* or *.spec.*, tracked or new, outside node_modules and outside the directories
# that hold what tests use (fixtures, __fixtures__, helpers, support, __mocks__). It counts when a
# line of it opens with a test (test, it or describe, awaited or not), it imports the package by
# the name package.json gives, and it imports nothing else of the package's own by path: a
# relative import may reach only test files and the directories tests keep their files in. Where
# package.json has a build script it runs first, through the package manager, since the name
# resolves to what a build makes. The tests run through the project's own runner: vitest, jest or
# mocha where package.json depends on one, bun test where the project uses bun, node --test
# otherwise. <worktree> defaults to the current directory.
#
#   exit 0  the build, where there is one, and every such test passed
#   exit 1  the build or a test failed
#   exit 3  not run: no package.json, no name in it, no test that imports it by name, or its
#           runner, node or its package manager is not installed; the reason is the last line
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
usage() { echo "usage: verify-library.sh [--list] [<worktree>] | --self-test" >&2; exit 1; }

library() {  # library list|run <worktree>
  python3 - "$@" <<'PY'
import json, os, pathlib, re, shutil, subprocess, sys

mode, wt = sys.argv[1], pathlib.Path(sys.argv[2]).resolve()
CODE = re.compile(r"\.(?:c|m)?(?:j|t)sx?$")
TEST_NAME = re.compile(r"\.(?:test|spec)\.(?:c|m)?(?:j|t)sx?$")
TEST_DIRS = {"test", "tests", "__tests__"}
SUPPORT_DIRS = {"fixtures", "__fixtures__", "helpers", "support", "__mocks__"}
IMPORT = re.compile(r"""(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"\n]+)\1""")
TEST_CALL = re.compile(r"^\s*(?:await\s+)?(?:test|it|describe)(?:\.\w+)*\s*\(", re.M)   # a call that opens a line

def not_run(msg):
    print("not run: " + msg); sys.exit(3)

def is_test(rel):
    parts = rel.split("/")
    if not CODE.search(rel) or "node_modules" in parts or any(p in SUPPORT_DIRS for p in parts[:-1]):
        return False
    return bool(TEST_NAME.search(rel)) or any(p in TEST_DIRS for p in parts[:-1])

def helper(rel):  # a relative import that stays among the tests
    parts = rel.split("/")
    return is_test(rel) or any(p in TEST_DIRS | SUPPORT_DIRS for p in parts[:-1])

pkg_file = wt / "package.json"
if not pkg_file.is_file():
    not_run("no package.json in %s; this default runs a package.json project's tests, so declare the "
            "check in .postmaster/project.toml" % wt)
try:
    pkg = json.load(open(pkg_file, encoding="utf-8"))
except (OSError, ValueError) as e:
    not_run("package.json does not parse: %s" % e)
name = pkg.get("name")
if not isinstance(name, str) or not name:
    not_run("package.json has no name, so no test can import the library by it")

r = subprocess.run(["git", "-C", str(wt), "ls-files", "-co", "--exclude-standard"], capture_output=True, text=True)
files = sorted(set(r.stdout.split("\n")) - {""}) if r.returncode == 0 else sorted(
    str(p.relative_to(wt)) for p in wt.rglob("*") if p.is_file())
chosen = []
for rel in files:
    if not is_test(rel):
        continue
    try:
        src = open(wt / rel, encoding="utf-8", errors="replace").read()
    except OSError:
        continue
    by_name = inside = False
    for m in IMPORT.finditer(src):
        spec = m.group(2)
        if spec == name or spec.startswith(name + "/"):
            by_name = True
        elif spec.startswith("."):
            target = os.path.normpath(os.path.join(os.path.dirname(rel), spec))
            if target.startswith("..") or not helper(target.replace(os.sep, "/")):
                inside = True
    if by_name and not inside and TEST_CALL.search(src):
        chosen.append(rel)
if mode == "list":
    print("\n".join(chosen)); sys.exit(0)
if not chosen:
    not_run("no test imports %s by its name and nothing else of its own by path" % name)

deps = {}
for key in ("dependencies", "devDependencies"):
    if isinstance(pkg.get(key), dict):
        deps.update(pkg[key])
scripts = pkg.get("scripts") if isinstance(pkg.get("scripts"), dict) else {}
bun = (wt / "bun.lock").exists() or (wt / "bun.lockb").exists()
pm = "pnpm" if (wt / "pnpm-lock.yaml").exists() else "bun" if bun else "yarn" if (wt / "yarn.lock").exists() else "npm"

def local(tool):
    p = wt / "node_modules" / ".bin" / tool
    if not p.exists():
        not_run("package.json depends on %s, which is not installed: run %s install first" % (tool, pm))
    return str(p)

if "vitest" in deps:
    argv = [local("vitest"), "run", *chosen]
elif "jest" in deps:
    argv = [local("jest"), *chosen]
elif "mocha" in deps:
    argv = [local("mocha"), *chosen]
elif bun or str(scripts.get("test", "")).startswith("bun ") or "@types/bun" in deps or "bun-types" in deps:
    if not shutil.which("bun"):
        not_run("the project runs its tests with bun, which is not on PATH")
    argv = ["bun", "test", *("./" + f for f in chosen)]
else:
    if not shutil.which("node"):
        not_run("the tests run with node --test, and node is not on PATH")
    argv = ["node", "--test", *chosen]

if scripts.get("build"):
    if not shutil.which(pm):
        not_run("package.json has a build script, run through %s, which is not on PATH" % pm)
    b = subprocess.run([pm, "run", "build"], cwd=wt, stdin=subprocess.DEVNULL)
    if b.returncode != 0:
        print("the build failed: %s run build exited %d" % (pm, b.returncode)); sys.exit(1)
print("running %d test file(s) that import %s by name: %s" % (len(chosen), name, " ".join(chosen)), flush=True)
t = subprocess.run(argv, cwd=wt, stdin=subprocess.DEVNULL)
print("the tests through %s's public interface %s" % (name, "passed" if t.returncode == 0 else "failed, exit %d" % t.returncode))
sys.exit(0 if t.returncode == 0 else 1)
PY
}

case "${1:-}" in
  --self-test) ;;
  --list) [ $# -le 2 ] || usage; WT=${2:-.}; [ -d "$WT" ] || { echo "verify-library: no such directory: $WT" >&2; exit 1; }; library list "$WT"; exit $? ;;
  -*) usage ;;
  *) [ $# -le 1 ] || usage; WT=${1:-.}; [ -d "$WT" ] || { echo "verify-library: no such directory: $WT" >&2; exit 1; }; library run "$WT"; exit $? ;;
esac

# --- self-test ----------------------------------------------------------------------------
tmp=$(cd "$(mktemp -d)" && pwd -P) || exit 1
trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
SELF="$HERE/verify-library.sh"
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/         /'; fails=$((fails+1)); }
expect() {  # expect <label> <exit> <project> [<text the output must hold>]
  local out rc
  out=$("$SELF" "$tmp/$3" 2>&1); rc=$?
  if [ "$rc" -eq "$2" ] && { [ -z "${4:-}" ] || grep -qF -- "$4" <<<"$out"; }; then ok "$1"; else fail "$1 (exit $rc)" "$out"; fi
}

# A library whose package name resolves to its exports, with tests of every kind the selection
# must tell apart.
lib="$tmp/lib"; mkdir -p "$lib/test/helpers" "$lib/src"
printf '{"name": "sample-lib", "version": "1.0.0", "type": "module", "exports": "./src/index.js"}\n' > "$lib/package.json"
printf 'export const add = (a, b) => a + b;\n' > "$lib/src/index.js"
cat > "$lib/test/public.test.js" <<'EOF'
import test from "node:test";
import assert from "node:assert";
import { add } from "sample-lib";
test("add, through the package name", () => assert.equal(add(2, 3), 5));
EOF
printf 'export const two = 2;\n' > "$lib/test/helpers/two.js"
cat > "$lib/test/helped.test.js" <<'EOF'
import test from "node:test";
import assert from "node:assert";
import { add } from "sample-lib";
import { two } from "./helpers/two.js";
test("add, with a helper", () => assert.equal(add(two, two), 4));
EOF
cat > "$lib/test/internal.test.js" <<'EOF'
import test from "node:test";
import assert from "node:assert";
import { add } from "../src/index.js";
test("add, reached by path", () => assert.equal(add(1, 1), 2));
EOF
cat > "$lib/test/mixed.test.js" <<'EOF'
import { add } from "sample-lib";
import { add as inner } from "../src/index.js";
EOF
printf 'import * as lib from "sample-lib";\nexport const api = lib;\n' > "$lib/test/helpers/api.js"
mkdir -p "$lib/test/fixtures/app"; printf 'import "sample-lib";\nimport http from "node:http";\nhttp.createServer().listen(0);\n' > "$lib/test/fixtures/app/server.js"
printf 'import { add } from "sample-lib";\nexport const three = add(1, 2);\n' > "$lib/test/no-tests.js"
mkdir -p "$lib/test/utils" "$lib/test/apps"
printf 'import { add } from "sample-lib";\nexport const digits = (s) => /^[0-9]+$/.test(s);\n' > "$lib/test/utils/api.js"
printf '// run it (as a child) from the tests\nimport "sample-lib";\n' > "$lib/test/apps/server.js"
git -C "$lib" init -q -b main

echo "positive controls"
list=$("$SELF" --list "$lib" | paste -sd' ' -)
[ "$list" = "test/helped.test.js test/public.test.js" ] && ok "only the tests that import it by name and open a line with a test are chosen, not helpers, fixtures, method calls or comments" \
  || fail "only the tests that import it by name and open a line with a test are chosen, not helpers, fixtures, method calls or comments" "$list"
expect "those tests pass through the package's exports"  0 lib "the tests through sample-lib's public interface passed"
cp -r "$lib" "$tmp/built"
python3 - "$tmp/built/package.json" <<'PY'
import json, sys
p = json.load(open(sys.argv[1])); p["scripts"] = {"build": "touch built.flag"}; json.dump(p, open(sys.argv[1], "w"))
PY
expect "a build script runs first"                       0 built "passed"
[ -f "$tmp/built/built.flag" ] && ok "and it did run" || fail "and it did run"

echo "negative controls"
cp -r "$lib" "$tmp/broken"; printf 'export const add = (a, b) => a - b;\n' > "$tmp/broken/src/index.js"
expect "a library that breaks its interface fails"       1 broken "failed"
cp -r "$lib" "$tmp/badbuild"
python3 - "$tmp/badbuild/package.json" <<'PY'
import json, sys
p = json.load(open(sys.argv[1])); p["scripts"] = {"build": "exit 5"}; json.dump(p, open(sys.argv[1], "w"))
PY
expect "a failed build fails"                            1 badbuild "the build failed"
mkdir -p "$tmp/internal/test"; cp "$lib/package.json" "$tmp/internal/"; cp -r "$lib/src" "$tmp/internal/"; cp "$lib/test/internal.test.js" "$tmp/internal/test/"
expect "a library tested only by path is not run"        3 internal "no test imports sample-lib by its name"
mkdir -p "$tmp/noname"; printf '{"version": "1.0.0"}\n' > "$tmp/noname/package.json"
expect "a package with no name is not run"               3 noname "has no name"
mkdir -p "$tmp/nopkg"
expect "a project with no package.json is not run"       3 nopkg "no package.json"
cp -r "$lib" "$tmp/vitest"
python3 - "$tmp/vitest/package.json" <<'PY'
import json, sys
p = json.load(open(sys.argv[1])); p["devDependencies"] = {"vitest": "1"}; json.dump(p, open(sys.argv[1], "w"))
PY
expect "a runner the project names but has not installed is not run"  3 vitest "which is not installed"
mkdir -p "$tmp/helperonly/test/helpers" "$tmp/helperonly/src"; cp "$lib/package.json" "$tmp/helperonly/"; cp "$lib/src/index.js" "$tmp/helperonly/src/"
cp "$lib/test/helpers/api.js" "$tmp/helperonly/test/helpers/"; cp "$lib/test/internal.test.js" "$tmp/helperonly/test/"
expect "a library whose only by-name import is in a helper is not run"  3 helperonly "no test imports sample-lib by its name"
mkdir -p "$tmp/fewtools"; for t in bash python3 dirname git; do ln -s "$(command -v $t)" "$tmp/fewtools/$t"; done
out=$(PATH="$tmp/fewtools" "$SELF" "$lib" 2>&1); rc=$?
[ $rc -eq 3 ] && grep -qF "node is not on PATH" <<<"$out" && ok "tests with no node to run them are not run" || fail "tests with no node to run them are not run (exit $rc)" "$out"

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
