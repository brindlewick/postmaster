#!/usr/bin/env bash
# Which skills folders claude, pi, mimo, codex and muse read, and whether each follows a linked
# skill folder. Every case runs with a temporary HOME, so no real skills folder is read or
# written, and asks the harness which skills it found before any model is called: claude's
# first stream-json event (the init event, printed before authentication), pi's RPC
# get_commands, mimo's `debug skill`, codex's `debug prompt-input` and muse's `skills list`.
# No credentials are needed and no request reaches a provider.
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
  python3 - "$d" "$d/out" <<'PY'
import json, sys
for line in open(sys.argv[2]):
    try: r = json.loads(line)
    except ValueError: continue
    if r.get("command") != "get_commands": continue
    found = [c for c in r["data"]["commands"] if c.get("name") == "skill:postmaster"]
    if not found: print("not listed"); break
    print("listed %d time(s), at %s" % (len(found), found[0]["sourceInfo"]["path"].replace(sys.argv[1] + "/home", "$HOME").replace(sys.argv[1] + "/work", "<project>")))
    break
else:
    print("no answer")
PY
}
mimo_lists() {  # mimo_lists <case> [<subfolder>]: the postmaster skill mimo lists, and the path it reports
  local d=$1 sub=${2:-}
  ( cd "$d/work/$sub" || exit 1; HOME="$d/home" timeout 120 mimo debug skill > "$d/out" 2> "$d/err" )
  python3 - "$d" "$d/out" <<'PY'
import json, sys
try: skills = json.load(open(sys.argv[2]))
except ValueError: print("no answer"); sys.exit()
found = [s for s in skills if s.get("name") == "postmaster"]
print(("listed %d time(s), at %s" % (len(found), found[0]["location"].replace(sys.argv[1] + "/home", "$HOME").replace(sys.argv[1] + "/work", "<project>")))
      if found else "not listed")
PY
}
codex_lists() {  # codex_lists <case>: the postmaster skill codex shows the model, and its folder
  local d=$1
  ( cd "$d/work" || exit 1; HOME="$d/home" timeout 120 codex debug prompt-input < /dev/null > "$d/out" 2> "$d/err" )
  python3 - "$d" "$d/out" <<'PY'
import re, sys
text = open(sys.argv[2]).read().replace("\\n", "\n")
entries = re.findall(r"^- postmaster: .*?\(file: (r\d+)/postmaster/SKILL\.md\)", text, re.M)
if not entries: print("not listed"); sys.exit()
roots = dict(re.findall(r"^- `(r\d+)` = `([^`]*)`", text, re.M))
where = roots.get(entries[0], "?").replace(sys.argv[1] + "/home", "$HOME").replace(sys.argv[1] + "/work", "<project>")
print("listed %d time(s), at %s/postmaster/SKILL.md" % (len(entries), where))
PY
}
muse_lists() {  # muse_lists <case>: the postmaster skill muse lists, and the path it reports
  local d=$1
  ( cd "$d/work" || exit 1; HOME="$d/home" timeout 120 muse skills list --json < /dev/null > "$d/out" 2> "$d/err" )
  python3 - "$d" "$d/out" <<'PY'
import json, sys
try: skills = json.load(open(sys.argv[2]))
except ValueError: print("no answer"); sys.exit()
found = [s for s in skills.get("skills", []) if s.get("name") == "postmaster"]
print(("listed %d time(s), at %s" % (len(found), found[0]["path"].replace(sys.argv[1] + "/home", "$HOME")))
      if found else "not listed (%d diagnostics)" % len(skills.get("diagnostics", [])))
PY
}
said() {  # said <case> <link> <label> <string>: what the harness said about a link that points
          # nowhere, anywhere in its output, and as a control the same count of a string the
          # output is known to hold
  printf 'stderr %s bytes; the link or its target named %s times (control: %s named %s times)' \
    "$(wc -c < "$1/err" | tr -d ' ')" "$(cat "$1/out" "$1/err" | grep -c -F -e "$2" -e "$1/nowhere")" \
    "$3" "$(cat "$1/out" "$1/err" | grep -c -F "$4")"
}
case_dir() {  # a fresh directory per case, holding an empty home and an empty working directory
  local d; d=$(mktemp -d "$tmp/case.XXXX") && mkdir -p "$d/home" "$d/work" && printf '%s\n' "$d"
}
link() {  # link <case> <folder under the case>: link the skill in as <folder>/postmaster
  mkdir -p "$1/$2" && ln -s "$SKILL" "$1/$2/postmaster"
}
dangle() {  # dangle <case> <folder under the case>: a link there that points nowhere
  mkdir -p "$1/$2" && ln -s "$1/nowhere" "$1/$2/postmaster"
}

echo "claude $(claude --version 2>/dev/null | head -1)"
d=$(case_dir); link "$d" home/.claude/skills
echo "  link in ~/.claude/skills:                 $(claude_lists "$d")"
d=$(case_dir); mkdir -p "$d/home/.claude/skills"
echo "  no link (control):                        $(claude_lists "$d")"
d=$(case_dir); dangle "$d" home/.claude/skills
echo "  dangling link in ~/.claude/skills:        $(claude_lists "$d"); $(said "$d" "$d/home/.claude/skills/postmaster" "its working directory" "$d/work")"
d=$(case_dir); link "$d" home/.agents/skills
echo "  link in ~/.agents/skills only:            $(claude_lists "$d")"
d=$(case_dir); link "$d" cfg/skills
echo "  link in \$CLAUDE_CONFIG_DIR/skills:        $(claude_lists "$d" "$d/cfg")"
d=$(case_dir); link "$d" work/.claude/skills
echo "  link in <project>/.claude/skills:         $(claude_lists "$d")"

echo "pi $(pi --version 2>/dev/null | head -1)"
d=$(case_dir); link "$d" home/.pi/agent/skills
echo "  link in ~/.pi/agent/skills:               $(pi_lists "$d")"
d=$(case_dir); mkdir -p "$d/home/.pi/agent/skills"
echo "  no link (control):                        $(pi_lists "$d")"
d=$(case_dir); dangle "$d" home/.pi/agent/skills
echo "  dangling link in ~/.pi/agent/skills:      $(pi_lists "$d"); $(said "$d" "$d/home/.pi/agent/skills/postmaster" "the request it answered" "get_commands")"
d=$(case_dir); link "$d" home/.agents/skills
echo "  link in ~/.agents/skills:                 $(pi_lists "$d")"
d=$(case_dir); link "$d" home/.pi/agent/skills; link "$d" home/.agents/skills
echo "  links in both, one target:                $(pi_lists "$d")"

echo "mimo $(mimo --version 2>/dev/null | head -1)"
d=$(case_dir); link "$d" home/.agents/skills
echo "  link in ~/.agents/skills:                 $(mimo_lists "$d")"
d=$(case_dir); mkdir -p "$d/home/.agents/skills"
echo "  no link (control):                        $(mimo_lists "$d")"
d=$(case_dir); dangle "$d" home/.agents/skills
echo "  dangling link in ~/.agents/skills:        $(mimo_lists "$d"); $(said "$d" "$d/home/.agents/skills/postmaster" "its data folder" "$d/home/.local/share/mimocode")"
d=$(case_dir); link "$d" home/.config/mimocode/skills
echo "  link in ~/.config/mimocode/skills:        $(mimo_lists "$d")"
d=$(case_dir); link "$d" home/.mimocode/skills
echo "  link in ~/.mimocode/skills:               $(mimo_lists "$d")"
d=$(case_dir); link "$d" home/.claude/skills
echo "  link in ~/.claude/skills:                 $(mimo_lists "$d")"
d=$(case_dir); link "$d" work/.agents/skills
echo "  link in <project>/.agents/skills:         $(mimo_lists "$d")"
d=$(case_dir); link "$d" work/.mimocode/skills
echo "  link in <project>/.mimocode/skills:       $(mimo_lists "$d")"
d=$(case_dir); link "$d" work/.claude/skills
echo "  link in <project>/.claude/skills:         $(mimo_lists "$d")"
d=$(case_dir); git init -q "$d/work"; mkdir -p "$d/work/sub"; link "$d" work/.agents/skills
echo "  <repo>/.agents/skills, from a subfolder:  $(mimo_lists "$d" sub)"

echo "codex $(codex --version 2>/dev/null | head -1)"
d=$(case_dir); link "$d" home/.agents/skills
echo "  link in ~/.agents/skills:                 $(codex_lists "$d")"
d=$(case_dir); mkdir -p "$d/home/.agents/skills"
echo "  no link (control):                        $(codex_lists "$d")"
d=$(case_dir); dangle "$d" home/.agents/skills
echo "  dangling link in ~/.agents/skills:        $(codex_lists "$d"); $(said "$d" "$d/home/.agents/skills/postmaster" "its working directory" "$d/work")"
d=$(case_dir); link "$d" home/.codex/skills
echo "  link in ~/.codex/skills:                  $(codex_lists "$d")"
d=$(case_dir); link "$d" home/.claude/skills
echo "  link in ~/.claude/skills:                 $(codex_lists "$d")"

echo "muse $(muse --version 2>/dev/null | head -1)"
d=$(case_dir); link "$d" home/.agents/skills
echo "  link in ~/.agents/skills:                 $(muse_lists "$d")"
d=$(case_dir); mkdir -p "$d/home/.agents/skills"
echo "  no link (control):                        $(muse_lists "$d")"
d=$(case_dir); dangle "$d" home/.agents/skills
echo "  dangling link in ~/.agents/skills:        $(muse_lists "$d"); $(said "$d" "$d/home/.agents/skills/postmaster" "its built-in skills" '"type": "local"')"
d=$(case_dir); link "$d" home/.config/muse/skills
echo "  link in ~/.config/muse/skills:            $(muse_lists "$d")"
d=$(case_dir); link "$d" home/.claude/skills
echo "  link in ~/.claude/skills:                 $(muse_lists "$d")"
d=$(case_dir); link "$d" home/.codex/skills
echo "  link in ~/.codex/skills:                  $(muse_lists "$d")"
d=$(case_dir); link "$d" home/.agents/skills; link "$d" home/.claude/skills
echo "  links in ~/.agents and ~/.claude, one target: $(muse_lists "$d")"
