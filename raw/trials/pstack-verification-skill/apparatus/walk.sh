#!/usr/bin/env bash
# Walk the generated feature map: run every recipe through the helper and check each claim the
# map makes against what the app does. A wrong expectation is run first, as the control.
#
#   walk.sh <app copy that holds .cursor/skills/verify-todo> <scratch directory for lists and proof>
set -u
T=$(cd "${1:?usage: walk.sh <app copy> <scratch directory>}" && pwd)
cd "$T" || exit 1
export TMPDIR=${2:?usage: walk.sh <app copy> <scratch directory>}
mkdir -p "$TMPDIR"
H="bun .cursor/skills/verify-todo/control-todo.ts"
USAGE='stderr: "usage: todo add <text> | todo list | todo done <id>\n"'
total=0
passed=0

check() { # check <name> <text> <exact line>...
  local name=$1 block=$2 ok=1 want
  shift 2
  for want in "$@"; do
    grep -qxF -- "$want" <<<"$block" || { ok=0; echo "    expected line not found: $want"; }
  done
  total=$((total + 1))
  if [ $ok = 1 ]; then passed=$((passed + 1)); echo "PASS  $name"; else echo "FAIL  $name"; fi
}
same() { [ "$1" = "$2" ] && echo same || echo different; }

echo "## control: a wrong expectation must be reported as FAIL"
b=$($H run ctl -- add "buy milk")
out=$(check "control, wrong exit code" "$b" 'exit: 1' 2>&1 | tail -1)
case "$out" in FAIL*) echo "control ok: $out" ;; *) echo "CONTROL BROKEN: $out" ;; esac
$H cleanup >/dev/null

echo "## add"
b=$($H run add1 -- add "buy milk")
check "add: one task" "$b" 'stdout: "added 1\n"' 'stderr: ""' 'exit: 0' 'list after: { "tasks": [ { "id": 1, "text": "buy milk", "done": false } ] }'
b=$($H run add1 -- add post the letter)
check "add: words are joined" "$b" 'stdout: "added 2\n"' 'exit: 0'
check "add: the joined text is stored" "$(grep -c '"text": "post the letter"' "$($H path add1)")" 1
f=$($H path add1)
check "add: file ends in a newline" "$(tail -c1 "$f" | od -An -c | tr -d ' ')" '\n'
check "add: file is indented by two spaces" "$(sed -n '2p' "$f")" '  "tasks": ['
b=$($H run add1 -- add "  buy milk ")
check "add: text is trimmed, id follows the highest" "$b" 'stdout: "added 3\n"'
check "add: trimmed text stored" "$(grep -c '"text": "buy milk"' "$f")" 2
check "add: proof file holds a block per command" "$(grep -c '^\$ todo' "$TMPDIR/todo-verify-proof/add1.txt")" 3

echo "## list"
$H run list1 -- add "buy milk" >/dev/null
$H run list1 -- add "post the letter" >/dev/null
b=$($H run list1 -- list)
check "list: lines" "$b" 'stdout: "1 [ ] buy milk\n2 [ ] post the letter\n"' 'exit: 0'
before=$($H show list1)
$H run list1 -- list >/dev/null
check "list: read-only" "$(same "$before" "$($H show list1)")" same
$H run list1 -- done 1 >/dev/null
b=$($H run list1 -- list)
check "list: done marker" "$b" 'stdout: "1 [x] buy milk\n2 [ ] post the letter\n"'
b=$($H run list2 -- list)
check "list: empty" "$b" 'stdout: "no tasks\n"' 'exit: 0' 'list after: (no list file)'
b=$($H run list1 -- list all)
check "list: an argument is a usage error" "$b" "$USAGE" 'exit: 2'
b=$($H run list1 -- list --json)
check "list: --json is a usage error" "$b" "$USAGE" 'exit: 2'

echo "## done"
$H run done1 -- add "buy milk" >/dev/null
b=$($H run done1 -- done 1)
check "done: mark" "$b" 'stdout: "done 1\n"' 'exit: 0' 'list after: { "tasks": [ { "id": 1, "text": "buy milk", "done": true } ] }'
b=$($H run done1 -- done 1)
check "done: again" "$b" 'stdout: "done 1\n"' 'exit: 0'
before=$($H show done1)
b=$($H run done1 -- done 7)
check "done: missing id" "$b" 'stdout: ""' 'stderr: "no task 7\n"' 'exit: 1'
check "done: missing id leaves the list as it was" "$(same "$before" "$($H show done1)")" same
for id in 01 1.5 -1 1e3 one; do
  b=$($H run done1 -- done "$id")
  check "done: id form $id" "$b" "$USAGE" 'exit: 2'
done
b=$($H run done1 -- done 1 2)
check "done: two ids" "$b" "$USAGE" 'exit: 2'

echo "## usage"
b=$($H run u1 --)
check "usage: no arguments" "$b" 'stdout: ""' "$USAGE" 'exit: 2' 'list after: (no list file)'
b=$($H run u1 -- help)
check "usage: help" "$b" "$USAGE" 'exit: 2'
b=$($H run u1 -- add "  ")
check "usage: blank add" "$b" "$USAGE" 'exit: 2' 'list after: (no list file)'
b=$($H run u1 -- --help)
check "usage: --help" "$b" "$USAGE" 'exit: 2'
b=$($H run u1 -- --version)
check "usage: --version" "$b" "$USAGE" 'exit: 2'

echo "## store"
p=$($H path store1)
$H run store1 -- add "buy milk" >/dev/null
check "store: the file TODO_FILE names holds the task" "$(grep -c '"text": "buy milk"' "$p")" 1
printf 'not a list' >"$p"
b=$($H run store1 -- add x)
check "store: not JSON" "$b" "stderr: \"todo: $p is not valid JSON\\n\"" 'exit: 1'
check "store: not JSON, file left as it was" "$($H show store1)" 'not a list'
printf '{"tasks": 3}' >"$p"
b=$($H run store1 -- list)
check "store: JSON that is not a list" "$b" "stderr: \"todo: $p does not hold a todo list\\n\"" 'exit: 1'
check "store: no leftover tmp file" "$(ls "$(dirname "$p")" | grep -c '\.tmp$')" 0
d=$(mktemp -d -p "$TMPDIR")
(cd "$d" && env -i PATH="$PATH" bun "$T/src/cli.ts" add q >/dev/null)
check "store: default is todo.json in the working directory" "$([ -f "$d/todo.json" ] && echo yes || echo no)" yes
rm -f "$d/todo.json"
(cd "$d" && env -i PATH="$PATH" TODO_FILE= bun "$T/src/cli.ts" add q >/dev/null)
check "store: an empty TODO_FILE also means todo.json" "$([ -f "$d/todo.json" ] && echo yes || echo no)" yes
check "store: todo.json is git-ignored" "$(git check-ignore -q todo.json && echo yes || echo no)" yes

echo
echo "claims checked: $total, held: $passed, failed: $((total - passed))"

echo
echo "## race: 30 parallel adds on one list file, three rounds (the map says a task can be lost)"
mkdir -p "$(dirname "$p")"
for round in 1 2 3; do
  f=$($H path race$round)
  rm -f "$f"
  for i in $(seq 30); do TODO_FILE="$f" bun src/cli.ts add "t$i" >/dev/null 2>&1 & done
  wait
  n=$(grep -c '"text"' "$f")
  dup=$(grep -o '"id": [0-9]*' "$f" | sort | uniq -d | wc -l)
  echo "round $round: 30 adds ran, $n tasks stored, $dup repeated ids"
done

echo
echo "## cleanup, then confirm the proof survives"
$H cleanup
echo "lists folder: $([ -e "$TMPDIR/todo-verify" ] && echo STILL THERE || echo gone)"
echo "proof files: $(ls "$TMPDIR/todo-verify-proof" | tr '\n' ' ')"
