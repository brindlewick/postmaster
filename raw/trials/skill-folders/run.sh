#!/usr/bin/env bash
# Which skills folders claude and pi read, and whether each follows a linked skill folder.
# Every case runs with a temporary HOME, so no real skills folder is read or written, and
# asks the harness which skills it found before any model is called: claude's first
# stream-json event (the init event, printed before authentication) and pi's RPC
# get_commands. No credentials are needed and no request reaches a provider.
#
#   run.sh <postmaster-checkout>
#
# Prints one line per case: where the link was put, and what the harness listed. For a link
# that points nowhere it also prints what the harness said about it, on stderr or in its output.
set -uo pipefail
SKILL=${1:?usage: run.sh <postmaster-checkout>}/skills/postmaster
[ -f "$SKILL/SKILL.md" ] || { echo "no skills/postmaster/SKILL.md under $1" >&2; exit 1; }
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
claude_lists() {  # claude_lists <case> [<config-dir>]: does claude list a skill named postmaster
  local d=$1 cfg=${2:-}
  ( cd "$d/work" || exit 1
    # A claude session started from inside another one inherits its markers; clear them.
    unset CLAUDECODE CLAUDE_CODE_ENTRYPOINT CLAUDE_CODE_SESSION_ID CLAUDE_CODE_CHILD_SESSION CLAUDE_PID \
          CLAUDE_CODE_MESSAGING_SOCKET CLAUDE_CODE_SESSION_ATTENDED CLAUDE_CODE_EXECPATH CLAUDE_EFFORT CLAUDE_CONFIG_DIR
    export HOME="$d/home"; [ -n "$cfg" ] && export CLAUDE_CONFIG_DIR="$cfg"
    timeout 60 claude -p "hi" --output-format stream-json --verbose < /dev/null > "$d/out" 2> "$d/err" )
  head -1 "$d/out" | python3 -c 'import json,sys; e=json.loads(sys.stdin.read() or "{}"); print("listed" if "postmaster" in e.get("skills", []) else "not listed")'
}
pi_lists() {  # pi_lists <case>: the postmaster skill pi lists, and the path it reports for it
  local d=$1
  ( cd "$d/work" || exit 1
    printf '%s\n' '{"id":"1","type":"get_commands"}' \
      | HOME="$d/home" timeout 60 pi --mode rpc --offline --no-session > "$d/out" 2> "$d/err" )
  python3 - "$d/home" "$d/out" <<'PY2'
import json, sys
home = sys.argv[1]
for line in open(sys.argv[2]):
    try: r = json.loads(line)
    except ValueError: continue
    if r.get("command") != "get_commands": continue
    found = [c for c in r["data"]["commands"] if c.get("name") == "skill:postmaster"]
    if not found: print("not listed"); break
    print("listed %d time(s), at %s" % (len(found), found[0]["sourceInfo"]["path"].replace(home, "$HOME")))
    break
else:
    print("no answer")
PY2
}
said() {  # said <case> <label> <string>: what the harness said about a link that points nowhere,
          # anywhere in its output, and as a control the same count of a string that output holds
  printf 'stderr %s bytes, the missing target named %s times (control: %s named %s times)' \
    "$(wc -c < "$1/err" | tr -d ' ')" "$(cat "$1/out" "$1/err" | grep -c -F "$1/nowhere")" \
    "$2" "$(cat "$1/out" "$1/err" | grep -c -F "$3")"
}
case_dir() {  # a fresh directory per case, holding an empty home and an empty working directory
  local d; d=$(mktemp -d "$tmp/case.XXXX") && mkdir -p "$d/home" "$d/work" && printf '%s\n' "$d"
}

echo "claude $(claude --version 2>/dev/null | head -1)"
d=$(case_dir); mkdir -p "$d/home/.claude/skills"; ln -s "$SKILL" "$d/home/.claude/skills/postmaster"
echo "  link in ~/.claude/skills:                 $(claude_lists "$d")"
d=$(case_dir); mkdir -p "$d/home/.claude/skills"
echo "  no link (control):                        $(claude_lists "$d")"
d=$(case_dir); mkdir -p "$d/home/.claude/skills"; ln -s "$d/nowhere" "$d/home/.claude/skills/postmaster"
echo "  dangling link in ~/.claude/skills:        $(claude_lists "$d"); $(said "$d" "its working directory" "$d/work")"
d=$(case_dir); mkdir -p "$d/home/.agents/skills"; ln -s "$SKILL" "$d/home/.agents/skills/postmaster"
echo "  link in ~/.agents/skills only:            $(claude_lists "$d")"
d=$(case_dir); mkdir -p "$d/cfg/skills"; ln -s "$SKILL" "$d/cfg/skills/postmaster"
echo "  link in \$CLAUDE_CONFIG_DIR/skills:        $(claude_lists "$d" "$d/cfg")"
d=$(case_dir); mkdir -p "$d/work/.claude/skills"; ln -s "$SKILL" "$d/work/.claude/skills/postmaster"
echo "  link in <project>/.claude/skills:         $(claude_lists "$d")"

echo "pi $(pi --version 2>/dev/null | head -1)"
d=$(case_dir); mkdir -p "$d/home/.pi/agent/skills"; ln -s "$SKILL" "$d/home/.pi/agent/skills/postmaster"
echo "  link in ~/.pi/agent/skills:               $(pi_lists "$d")"
d=$(case_dir); mkdir -p "$d/home/.pi/agent/skills"
echo "  no link (control):                        $(pi_lists "$d")"
d=$(case_dir); mkdir -p "$d/home/.pi/agent/skills"; ln -s "$d/nowhere" "$d/home/.pi/agent/skills/postmaster"
echo "  dangling link in ~/.pi/agent/skills:      $(pi_lists "$d"); $(said "$d" "the request it answered" "get_commands")"
d=$(case_dir); mkdir -p "$d/home/.agents/skills"; ln -s "$SKILL" "$d/home/.agents/skills/postmaster"
echo "  link in ~/.agents/skills:                 $(pi_lists "$d")"
d=$(case_dir); mkdir -p "$d/home/.pi/agent/skills" "$d/home/.agents/skills"
ln -s "$SKILL" "$d/home/.pi/agent/skills/postmaster"; ln -s "$SKILL" "$d/home/.agents/skills/postmaster"
echo "  links in both, one target:                $(pi_lists "$d")"
