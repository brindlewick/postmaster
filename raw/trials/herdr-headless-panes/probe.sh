#!/usr/bin/env bash
# Probe how Herdr shows a headless harness launch. Run from inside a Herdr pane, with claude on
# PATH and Herdr's claude integration installed. It opens two spaces of its own in a scratch
# repository, closes them at the end, and prints what it saw with local paths replaced.
set -uo pipefail
tmp=$(mktemp -d); repo=$tmp/probe-repo
git init -q -b main "$repo" && git -C "$repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m first
git -C "$repo" worktree add -q "$repo/.worktrees/lane" -b lane
repo=$(cd "$repo" && pwd -P); wt=$repo/.worktrees/lane
scrub() { sed -e "s#$tmp#<tmp>#g" -e "s#$HOME#~#g" -e "s#$(hostname)#<host>#g" -e "s#$(id -un)#<user>#g"; }
say() { printf '%s\n' "$*" | scrub; }
j() { python3 -c 'import json, sys
d = json.load(sys.stdin)
print(eval(sys.argv[1]))' "$1"; }
state() { herdr pane get "$1" | j '"agent=%s status=%s" % (d["result"]["pane"].get("agent"), d["result"]["pane"].get("agent_status"))'; }
spaces=()
cleanup() { local i; for (( i=${#spaces[@]}-1; i>=0; i-- )); do herdr workspace close "${spaces[i]}" >/dev/null 2>&1; done; rm -r -- "$tmp"; }
trap cleanup EXIT
PROMPT="Run the shell command: sleep 4. Then reply with the single word: done"
claude_run() { claude -p "$PROMPT" --model haiku --output-format stream-json --verbose --dangerously-skip-permissions "$@"; }

say "herdr $(herdr --version | cut -d' ' -f2), claude $(claude --version | cut -d' ' -f1)"

say "== 1. nesting: a worktree opened under its repository's space"
R=$(herdr workspace create --cwd "$repo" --label probe-repo --no-focus | j 'd["result"]["workspace"]["workspace_id"]'); spaces+=("$R")
open=$(herdr worktree open --workspace "$R" --path "$wt" --label lane --no-focus)
W=$(printf '%s' "$open" | j 'd["result"]["workspace"]["workspace_id"]'); spaces+=("$W")
P=$(printf '%s' "$open" | j 'd["result"]["root_pane"]["pane_id"]')
say "worktree space: $(herdr workspace get "$W" | j '"label=%s linked=%s repo_root=%s" % (d["result"]["workspace"]["label"], d["result"]["workspace"]["worktree"]["is_linked_worktree"], d["result"]["workspace"]["worktree"]["repo_root"])')"
say "repository space is its source: $(herdr worktree list --cwd "$wt" | j 'd["result"]["source"]["source_workspace_id"]') == $R"
say "closing the repository's space first: $(herdr workspace close "$R" 2>&1 >/dev/null | j 'd["error"]["code"]')"

runin() {  # runin <pane> <script>: run a script in a pane, and wait for it to finish
  local done=$tmp/done.$RANDOM
  printf '%s\ntouch %q\n' "$2" "$done" > "$tmp/step.sh"
  herdr pane run "$1" " bash '$tmp/step.sh'" >/dev/null
  local i=0; while [ ! -e "$done" ] && [ $i -lt 240 ]; do sleep 0.5; i=$((i + 1)); done
}

say "== 2. what Herdr makes of a headless claude in a pane, with nothing reported"
herdr pane run "$P" " cd '$wt' && command claude -p '$PROMPT' --model haiku --output-format stream-json --verbose --dangerously-skip-permissions > '$tmp/s2.jsonl' 2>&1; touch '$tmp/s2.done'" >/dev/null
: > "$tmp/seen"; i=0
while [ ! -e "$tmp/s2.done" ] && [ $i -lt 120 ]; do state "$P" >> "$tmp/seen"; sleep 1; i=$((i + 1)); done
say "while it ran, once a second: $(sort "$tmp/seen" | uniq -c | sed 's/^ *//' | tr '\n' ';')"
say "the stream says it worked: $(grep -c '"type":"assistant"' "$tmp/s2.jsonl") assistant events"

say "== 3. a reported state, and a closing idle report, around a headless claude"
T3=$(herdr tab create --workspace "$W" --cwd "$wt" --label t3 --no-focus | j 'd["result"]["root_pane"]["pane_id"]')
runin "$T3" "
herdr pane report-agent \"\$HERDR_PANE_ID\" --source custom:probe --agent claude --state working >/dev/null
( cd '$wt' && command claude -p '$PROMPT' --model haiku --output-format stream-json --verbose --dangerously-skip-permissions > '$tmp/s3.jsonl' 2>&1 )
herdr pane report-agent \"\$HERDR_PANE_ID\" --source custom:probe --agent claude --state idle >/dev/null
echo \"after claude exits, idle reported: \$(herdr pane get \$HERDR_PANE_ID | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"result\"][\"pane\"][\"agent_status\"])')\" > '$tmp/s3.txt'
sleep 10
herdr pane report-agent \"\$HERDR_PANE_ID\" --source custom:probe --agent claude --state idle >/dev/null
echo \"idle reported again 10 s later: \$(herdr pane get \$HERDR_PANE_ID | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"result\"][\"pane\"][\"agent_status\"])')\" >> '$tmp/s3.txt'
herdr pane release-agent \"\$HERDR_PANE_ID\" --source custom:probe --agent claude >/dev/null
echo \"after release-agent: \$(herdr pane get \$HERDR_PANE_ID | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"result\"][\"pane\"][\"agent_status\"])')\" >> '$tmp/s3.txt'
"
while read -r line; do say "$line"; done < "$tmp/s3.txt"

say "== 3, control: the same reports around a child that is not an agent"
T4=$(herdr tab create --workspace "$W" --cwd "$wt" --label t4 --no-focus | j 'd["result"]["root_pane"]["pane_id"]')
runin "$T4" "
herdr pane report-agent \"\$HERDR_PANE_ID\" --source custom:probe --agent claude --state working >/dev/null
sleep 6
herdr pane report-agent \"\$HERDR_PANE_ID\" --source custom:probe --agent claude --state idle >/dev/null
echo \"after sleep exits, idle reported: \$(herdr pane get \$HERDR_PANE_ID | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"result\"][\"pane\"][\"agent_status\"])')\" > '$tmp/s4.txt'
"
while read -r line; do say "$line"; done < "$tmp/s4.txt"

say "== 4. pane identity: a headless claude run outside the pane, naming it in HERDR_PANE_ID"
T5=$(herdr tab create --workspace "$W" --cwd "$wt" --label t5 --no-focus | j 'd["result"]["root_pane"]["pane_id"]')
say "the pane's session before: $(herdr pane get "$T5" | j '(d["result"]["pane"].get("agent_session") or {}).get("value")')"
( cd "$wt" && HERDR_PANE_ID=$T5 HERDR_ENV=1 claude -p "Reply with the single word: done" --model haiku --output-format stream-json --verbose --dangerously-skip-permissions > "$tmp/s5.jsonl" 2>&1 )
sid=$(grep -m1 '"subtype":"init"' "$tmp/s5.jsonl" | j 'd["session_id"]')
say "the run's session id is ${sid:0:8}; the pane's session after: $(herdr pane get "$T5" | j '(d["result"]["pane"].get("agent_session") or {}).get("value", "")[:8]')"

say "== 5. the terminal title: claude -p --name, against a title the pane set itself"
T6=$(herdr tab create --workspace "$W" --cwd "$wt" --label t6 --no-focus | j 'd["result"]["root_pane"]["pane_id"]')
herdr pane run "$T6" " printf '\\033]0;%s\\007' set-by-the-pane; cd '$wt' && command claude -p '$PROMPT' --name named-by-claude --model haiku --output-format stream-json --verbose --dangerously-skip-permissions > '$tmp/s6.jsonl' 2>'$tmp/s6.err'; touch '$tmp/s6.done'" >/dev/null
: > "$tmp/titles"; i=0
while [ ! -e "$tmp/s6.done" ] && [ $i -lt 120 ]; do herdr pane get "$T6" | j 'd["result"]["pane"].get("terminal_title_stripped")' >> "$tmp/titles"; sleep 1; i=$((i + 1)); done
say "titles while it ran, once a second: $(sort "$tmp/titles" | uniq -c | sed 's/^ *//' | tr '\n' ';')"
say "escape bytes in its stdout and stderr: $(cat "$tmp/s6.jsonl" "$tmp/s6.err" | tr -cd '\033' | wc -c | tr -d ' ')"
