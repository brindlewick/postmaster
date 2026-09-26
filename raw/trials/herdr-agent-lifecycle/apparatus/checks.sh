#!/usr/bin/env bash
# The commands the trial ran, in the order it ran them, with its own paths and Herdr ids replaced
# by variables. It is a record first: run one function at a time, and read the ids each Herdr
# command returns before the next, since Herdr allocates them.
#
#   TRIAL  a scratch directory outside any repository
#   TOOL   the postmaster repository, at the commit method.md names
#   A B C  the three panes (pane-a, pane-b, pane-c), from the JSON that created them
#   WS     the Herdr workspace the trial's tab was created in
#
# bench.py, standin.py, events.py and idle.py sit beside this file.
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd -P)
export STANDIN_LOG=$TRIAL/logs/standin.jsonl

isolate() {  # isolated harness configs, a scratch config for launch.sh, and the stand-in
  mkdir -p "$TRIAL"/{pi-agent-dir,work-pi,work-pi-hl,work-claude,work-claude-hl,claude-config,logs}
  cat > "$TRIAL/pi-agent-dir/models.json" <<'EOF'
{"providers": {"standin": {"baseUrl": "http://127.0.0.1:18716/v1", "api": "openai-completions",
 "apiKey": "standin", "compat": {"supportsDeveloperRole": false, "supportsReasoningEffort": false},
 "models": [{"id": "fixed"}]}}}
EOF
  python3 - "$TRIAL" <<'PY'
import json, sys
T = sys.argv[1]
trusted = {"hasTrustDialogAccepted": True, "hasCompletedProjectOnboarding": True}
json.dump({"hasCompletedOnboarding": True, "theme": "dark", "bypassPermissionsModeAccepted": True,
           "projects": {T + "/work-claude": trusted, T + "/work-claude-hl": trusted}},
          open(T + "/claude-config/.claude.json", "w"))
json.dump({"skipDangerousModePermissionPrompt": True}, open(T + "/claude-config/settings.json", "w"))
PY
  printf 'PI_CODING_AGENT_DIR=%s\nPI_OFFLINE=1\n' "$TRIAL/pi-agent-dir" > "$TRIAL/standin-pi.env"
  printf 'ANTHROPIC_BASE_URL=http://127.0.0.1:18716\nANTHROPIC_AUTH_TOKEN=standin\nCLAUDE_CONFIG_DIR=%s\n' \
    "$TRIAL/claude-config" > "$TRIAL/standin-claude.env"
  cat > "$TRIAL/config.toml" <<EOF
[lanes.standin-pi]
harness = "pi"
model = "standin/fixed"
env_file = "$TRIAL/standin-pi.env"
[lanes.standin-claude]
harness = "claude"
model = "claude-haiku-4-5"
env_file = "$TRIAL/standin-claude.env"
[team]
workhorses = ["standin-pi"]
reviewers = ["standin-pi"]
coachman = { harness = "pi", model = "standin/fixed" }
EOF
  nohup python3 "$HERE/standin.py" 18716 "$STANDIN_LOG" > "$TRIAL/logs/standin.out" 2>&1 &
}

pi_integration() {  # Herdr's pi integration, cut from the herdr binary rather than installed
  python3 - "$(readlink -f "$(command -v herdr)")" "$TRIAL/herdr-pi-integration.ts" <<'PY'
import re, sys
data = open(sys.argv[1], "rb").read()
m = re.search(rb"HERDR_INTEGRATION_ID=pi\b", data)
start = data.rfind(b"//", 0, data.rfind(b"installed by herdr", 0, m.start()))
end = data.find(b"ompherdr-omp-agent-state.ts", m.start())   # the next embedded file, in 0.9.1
open(sys.argv[2], "w").write(data[start:end].decode().rstrip() + "\n")
PY
}

headless_sanity() {
  echo "Reply with OK. (headless sanity)" > "$TRIAL/prompt-sanity.txt"
  (cd "$TRIAL/work-pi" && PI_CODING_AGENT_DIR=$TRIAL/pi-agent-dir PI_OFFLINE=1 \
    pi --mode json --approve --model standin/fixed < "$TRIAL/prompt-sanity.txt")
}

start_pi() {  # pane-a, pi on screen rules
  herdr tab create --workspace "$WS" --cwd "$TRIAL/work-pi" --label trial-16 \
    --env PI_CODING_AGENT_DIR="$TRIAL/pi-agent-dir" --env PI_OFFLINE=1 --no-focus
  python3 "$HERE/events.py" "$TRIAL/logs/events.jsonl" "$A" &
  herdr agent start t16-pi --kind pi --pane "$A" -- --model standin/fixed
}

first_prompt() {
  herdr agent prompt t16-pi "SLEEP=5 turn one, reply OK" --wait --timeout 60000
}

bench_live() {  # bench_live <agent> <out>
  python3 "$HERE/bench.py" live "$1" "$2" 3,7,11,16,23
}

bench_marker() {  # bench_marker <lane> <cwd> <out>; launches once, then times five resumes
  echo "Reply with OK. (first launch)" > "$TRIAL/prompt-first.txt"
  local tid
  tid=$(POSTMASTER_CONFIG=$TRIAL/config.toml "$TOOL/scripts/launch.sh" launch "$1" "$2" "$TRIAL/prompt-first.txt" |
        python3 -c 'import json,sys
for l in sys.stdin:
    r = json.loads(l)
    t = r.get("session_id") or (r.get("id") if r.get("type") == "session" else None)
    if t: print(t); break')
  echo "$tid" > "$TRIAL/logs/$(basename "$3").thread"
  POSTMASTER_CONFIG=$TRIAL/config.toml python3 "$HERE/bench.py" marker "$1" "$2" "$tid" "$3" 3,7,11,16,23
}

kill_separate_wait() {  # pi on screen rules, killed under a separate wait
  local pid
  pid=$(herdr pane process-info --pane "$A" | python3 -c 'import json,sys
print(json.load(sys.stdin)["result"]["process_info"]["foreground_processes"][0]["pid"])')
  herdr agent prompt t16-pi "SLEEP=30 kill-test reply OK"
  ( herdr agent wait t16-pi --timeout 60000 > "$TRIAL/logs/kill-wait.json" ) &
  sleep 4
  herdr agent get t16-pi
  kill -TERM "$pid"
  wait
  herdr agent get t16-pi
}

start_pix() {  # pane-b, pi with Herdr's pi integration; also restarts t16-pi in pane-a
  herdr pane split "$A" --direction right --cwd "$TRIAL/work-pi" \
    --env PI_CODING_AGENT_DIR="$TRIAL/pi-agent-dir" --env PI_OFFLINE=1 --no-focus
  herdr agent start t16-pi --kind pi --pane "$A" -- --model standin/fixed
  python3 "$HERE/events.py" "$TRIAL/logs/events.jsonl" "$A" "$B" &
  herdr agent start t16-pix --kind pi --pane "$B" -- --model standin/fixed -e "$TRIAL/herdr-pi-integration.ts"
}

stale_wait() {
  # After each try, "noop" is sent while the held turn is still running (pi queues it), then
  # the waits bring the agent back to settled before the next try. The stale wait has already
  # returned by then.
  local a i tag t0 t1 t2 st
  for a in t16-pi t16-pix; do
    for i in 1 2 3; do
      tag="race-$a-$i"; t0=$(date +%s%3N)
      herdr agent prompt "$a" "SLEEP=6 $tag reply OK" >/dev/null 2>&1
      t1=$(date +%s%3N)
      st=$(herdr agent wait "$a" --timeout 60000 2>&1 |
           python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["agent"]["agent_status"])')
      t2=$(date +%s%3N)
      echo "$a rep $i: prompt returned +$((t1-t0)) ms; separate agent wait returned +$((t2-t0)) ms with '$st'"
      herdr agent prompt "$a" "noop" >/dev/null 2>&1 || true
      herdr agent wait "$a" --until working --timeout 10000 >/dev/null 2>&1
      herdr agent wait "$a" --timeout 60000 >/dev/null 2>&1
      sleep 7
    done
  done
}

kill_prompt_wait() {  # each pi variant, killed under agent prompt --wait
  local a p pid t0
  for a in t16-pi t16-pix; do
    p=$(herdr agent get "$a" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["agent"]["pane_id"])')
    pid=$(herdr pane process-info --pane "$p" | python3 -c 'import json,sys
print(json.load(sys.stdin)["result"]["process_info"]["foreground_processes"][0]["pid"])')
    t0=$(date +%s%3N)
    ( herdr agent prompt "$a" "SLEEP=30 kill2-$a reply OK" --wait --timeout 60000 > "$TRIAL/logs/kill2-$a.json"
      echo "exit=$? returned=+$(( $(date +%s%3N) - t0 ))" ) &
    sleep 4
    echo "killed at +$(( $(date +%s%3N) - t0 ))"; kill -TERM "$pid"
    wait
    sleep 3
    herdr agent get "$a"
  done
}

restart_and_idle_pi() {
  herdr agent start t16-pi --kind pi --pane "$A" -- --model standin/fixed
  herdr agent start t16-pix --kind pi --pane "$B" -- --model standin/fixed -e "$TRIAL/herdr-pi-integration.ts"
  herdr agent prompt t16-pi "one turn before idling, reply OK" --wait --timeout 60000
  herdr agent prompt t16-pix "one turn before idling, reply OK" --wait --timeout 60000
  python3 "$HERE/idle.py" 60 pE="$(fg_pid "$A")" pF="$(fg_pid "$B")"
}

fg_pid() {  # fg_pid <pane>
  herdr pane process-info --pane "$1" | python3 -c 'import json,sys
print(json.load(sys.stdin)["result"]["process_info"]["foreground_processes"][0]["pid"])'
}

start_claude() {  # pane-c; the first start ran on the machine's own claude config
  herdr pane split "$B" --direction down --cwd "$TRIAL/work-claude" \
    --env ANTHROPIC_BASE_URL=http://127.0.0.1:18716 --env ANTHROPIC_AUTH_TOKEN=standin --no-focus
  python3 "$HERE/events.py" "$TRIAL/logs/events.jsonl" "$A" "$B" "$C" &
  herdr agent start t16-cl --kind claude --pane "$C" -- --model claude-haiku-4-5 --dangerously-skip-permissions
  herdr agent read t16-cl --source visible
  herdr agent send-keys t16-cl esc          # answers the trust question with its default, "No, exit"
  herdr pane run "$C" "export CLAUDE_CONFIG_DIR=$TRIAL/claude-config"
  herdr agent start t16-cl --kind claude --pane "$C" -- --model claude-haiku-4-5 --dangerously-skip-permissions
}

idle_claude() {
  python3 "$HERE/idle.py" 60 pG-claude="$(fg_pid "$C")" pE-pi="$(fg_pid "$A")"
}

grow() {  # four 1 MB replies into each headless session and the live pi with its integration
  local k
  for k in 1 2 3 4; do
    echo "PAD=1024 grow turn $k" > "$TRIAL/grow.txt"
    POSTMASTER_CONFIG=$TRIAL/config.toml "$TOOL/scripts/launch.sh" resume standin-pi "$TRIAL/work-pi-hl" \
      "$(cat "$TRIAL/logs/pi-marker.thread")" "$TRIAL/grow.txt" > /dev/null
    POSTMASTER_CONFIG=$TRIAL/config.toml "$TOOL/scripts/launch.sh" resume standin-claude "$TRIAL/work-claude-hl" \
      "$(cat "$TRIAL/logs/cl-marker.thread")" "$TRIAL/grow.txt" > /dev/null
  done
  POSTMASTER_CONFIG=$TRIAL/config.toml python3 "$HERE/bench.py" marker standin-pi "$TRIAL/work-pi-hl" \
    "$(cat "$TRIAL/logs/pi-marker.thread")" "$TRIAL/logs/pi-marker-big" 1,1,1
  POSTMASTER_CONFIG=$TRIAL/config.toml python3 "$HERE/bench.py" marker standin-claude "$TRIAL/work-claude-hl" \
    "$(cat "$TRIAL/logs/cl-marker.thread")" "$TRIAL/logs/cl-marker-big" 1,1,1
  for k in 1 2 3 4; do
    herdr agent prompt t16-pix "PAD=1024 grow live turn $k" --wait --timeout 120000
  done
  python3 "$HERE/bench.py" live t16-pix "$TRIAL/logs/pix-live-big" 1,1,1
  python3 "$HERE/idle.py" 30 pF-pi-4MB="$(fg_pid "$B")" pE-pi-small="$(fg_pid "$A")"
}

multistep() {  # after restarting the stand-in, whose TOOL knob was added here
  local a
  for a in t16-pi t16-pix t16-cl; do
    herdr agent prompt "$a" "TOOL=4x3 SLEEP=2 multistep-$a-$(date +%s) reply OK" --wait --timeout 120000
  done
}

long_prompt() {
  python3 - > "$TRIAL/long-prompt.txt" <<'PY'
import hashlib
body = "\n".join("line %04d: the quick brown fox jumps over the lazy dog, again and again." % i for i in range(280))
print("LONGTEST start"); print(body)
print("LONGTEST end sha=%s reply OK" % hashlib.sha256(body.encode()).hexdigest()[:16])
PY
  local a
  for a in t16-pix t16-cl; do
    herdr agent prompt "$a" "$(cat "$TRIAL/long-prompt.txt")" --wait --timeout 120000
  done
  # then compare the sha256 of the text sent with that of the user message each harness recorded
  # in its own session (pi-agent-dir/sessions, claude-config/projects)
}
