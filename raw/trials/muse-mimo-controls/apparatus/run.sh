#!/usr/bin/env bash
# The checks issue #71 names for muse and mimo, each with a positive and a negative control: the
# thread id read from the stream, the final message, the prompt as the harness received it, a
# resume continuing its thread on its model, and a resume of a thread the harness does not hold.
# Launches and resumes go through postmaster's own launch.sh; runs marked direct call the harness
# as launch.sh would not, to show what it guards against. Muse Code runs on its echo provider,
# which answers with the prompt it was given, except for the model checks, which need its own
# provider and a key. MiMo Code runs on standin.py, which records what MiMo Code sent. HOME and
# every harness data directory are the trial's own. The records keep the fields method.md names,
# with the trial's folder written as <trial>.
#
#   run.sh <postmaster-checkout> <out-dir> <muse-env-file> [<muse-model>]
#
# <muse-env-file> sets META_API_KEY; it is sourced by launch.sh, never printed.
set -uo pipefail
ROOT=$(cd "${1:?usage: run.sh <postmaster-checkout> <out-dir> <muse-env-file> [<muse-model>]}" && pwd -P) || exit 1
OUT=${2:?}; ENVF=$(cd "$(dirname "${3:?}")" && pwd -P)/$(basename "$3"); MODEL=${4:-muse-spark-1.3-contributor}
HERE=$(cd "$(dirname "$0")" && pwd -P)
MUSE=$(command -v muse) && MIMO=$(command -v mimo) || { echo "run.sh: muse and mimo must be on PATH" >&2; exit 1; }
mkdir -p "$OUT" && OUT=$(cd "$OUT" && pwd -P) || exit 1
tmp=$(mktemp -d) && tmp=$(cd "$tmp" && pwd -P) || exit 1
standin=""
trap '[ -n "$standin" ] && kill "$standin" 2>/dev/null; rm -r -- "$tmp"' EXIT
export HOME=$tmp/home MUSE_NO_AUTO_UPDATE=1 POSTMASTER_HARNESS_DATA=$tmp/harness-data
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
mkdir -p "$HOME/.config/mimocode" "$tmp/echo-bin" "$tmp/r"
repo=$tmp/repo other=$tmp/other
git init -q -b main "$repo" && printf 'Marker: AGENTS-OK\n' > "$repo/AGENTS.md" && git -C "$repo" add -A && git -C "$repo" commit -qm fixture || exit 1
git init -q -b main "$other" && git -C "$other" commit -q --allow-empty -m fixture || exit 1

# Muse Code on its echo provider: `exec` gains --provider echo and loses --model and
# --reasoning-effort, which the echo provider refuses; everything else passes through.
cat > "$tmp/echo-bin/muse" <<EOF
#!/usr/bin/env bash
if [ "\$1" = exec ]; then
  shift; args=()
  while [ \$# -gt 0 ]; do
    case \$1 in --model|--reasoning-effort) shift 2 ;; *) args+=("\$1"); shift ;; esac
  done
  exec "$MUSE" exec --provider echo "\${args[@]}"
fi
exec "$MUSE" "\$@"
EOF
chmod +x "$tmp/echo-bin/muse"
port=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
: > "$tmp/requests.jsonl"; python3 "$HERE/standin.py" "$port" "$tmp/requests.jsonl" & standin=$!
printf '{\n  "provider": {\n    "standin": {\n      "npm": "@ai-sdk/openai-compatible",\n      "name": "Stand-in",\n      "options": { "baseURL": "http://127.0.0.1:%s/v1", "apiKey": "standin" },\n      "models": { "standin-a": { "name": "standin-a" }, "standin-b": { "name": "standin-b" } }\n    }\n  }\n}\n' "$port" > "$HOME/.config/mimocode/mimocode.jsonc"

# The prompt: quotes, a dollar sign, backticks, an @ mention, a line opening with a dash, non-ASCII
# text, and a final newline. REPLY=alpha is the stand-in's answer.
printf 'Line one of the trial prompt: say "pineapple", then stop. REPLY=alpha\n- a line that starts with a dash\n$HOME `backticks` and an @README.md mention\nunicode: caf\xc3\xa9 \xe2\x9c\x93\n' > "$tmp/prompt.txt"
printf 'Second turn. REPLY=beta\n' > "$tmp/beta.txt"
printf 'Second turn on another model. REPLY=gamma\n' > "$tmp/gamma.txt"
printf 'This turn fails. FAIL=400\n' > "$tmp/fail.txt"
printf 'Where do your tools run? RUNPWD REPLY=located\n' > "$tmp/pwd.txt"
printf 'Reply with the single word kumquat, and nothing else.\n' > "$tmp/live1.txt"
printf 'Reply with the single word damson, and nothing else.\n' > "$tmp/live2.txt"
printf '[lanes.x]\nharness = "mimo"\nmodel = "standin/standin-a"\n\n[team]\ncoachman = { harness = "muse", model = "%s", effort = "low" }\n' "$MODEL" > "$tmp/echo.toml"
printf '[lanes.x]\nharness = "mimo"\nmodel = "standin/standin-a"\n\n[team]\ncoachman = { harness = "muse", model = "%s", effort = "low", env_file = "%s" }\n' "$MODEL" "$ENVF" > "$tmp/live.toml"
printf '[lanes.x]\nharness = "mimo"\nmodel = "standin/standin-a"\n\n[team]\ncoachman = { harness = "muse", model = "no-such-model", effort = "low", env_file = "%s" }\n' "$ENVF" > "$tmp/bad.toml"
data_dir() {  # data_dir <harness> <cwd> <name> <leg>: the data directory launch.sh gives that launch, outside a run
  printf '%s/%s/%s\n' "$POSTMASTER_HARNESS_DATA" "$1" "$(printf '|%s|%s|%s' "$(cd -P "$2" && pwd -P)" "$3" "$4" | cksum | tr ' ' '-')"
}
L() {  # L <config> <name> <launch.sh args...>: through launch.sh, named as host.sh names a launch; out and err in $tmp/r/<name>
  local cfg=$1 n=$2; shift 2
  POSTMASTER_LAUNCH_NAME="#71, trial" POSTMASTER_CONFIG=$cfg "$ROOT/scripts/launch.sh" "$@" > "$tmp/r/$n.jsonl" 2> "$tmp/r/$n.err" < /dev/null
  echo $? > "$tmp/r/$n.rc"
}
D() {  # D <name> <cwd> <data dir> <command...>: direct, in <cwd> with that XDG_DATA_HOME; stdin is $STDIN
  local n=$1 cwd=$2 data=$3; shift 3
  ( cd "$cwd" && XDG_DATA_HOME=$data MIMOCODE_DISABLE_CLAUDE_IMPORT=1 "$@" > "$tmp/r/$n.jsonl" 2> "$tmp/r/$n.err" < "${STDIN:-/dev/null}"; echo $? > "$tmp/r/$n.rc" )
}
mark() { printf '%s %s\n' "$1" "$(wc -l < "$tmp/requests.jsonl" | tr -d ' ')" >> "$tmp/r/marks"; }   # the stand-in's log length as a run starts

# Muse Code, echo provider: the coachman's synthesis leg.
EP=$tmp/echo-bin:$PATH
PATH=$EP L "$tmp/echo.toml" muse-launch launch coachman "$repo" "$tmp/prompt.txt" --leg synthesis
msid=$(python3 -c 'import json,sys; print(json.loads(open(sys.argv[1]).readline())["stream"]["id"])' "$tmp/r/muse-launch.jsonl" 2>/dev/null)
mdata=$(data_dir muse "$repo" coachman synthesis)
PATH=$EP L "$tmp/echo.toml" muse-resume resume coachman "$repo" "$msid" "$tmp/beta.txt" --leg synthesis
PATH=$EP L "$tmp/echo.toml" muse-fresh launch coachman "$repo" "$tmp/beta.txt" --leg review
PATH=$EP D muse-argv "$repo" "$tmp/direct-muse" muse exec --json --model "$MODEL" --reasoning-effort low --yolo "$(cat "$tmp/prompt.txt")"
ghost=$(python3 -c 'import uuid; print(uuid.uuid4())')
PATH=$EP D muse-export-ghost "$repo" "$mdata" "$MUSE" export --session "$ghost" --out "$tmp/r/ghost-export.json"
PATH=$EP D muse-export-real "$repo" "$mdata" "$MUSE" export --session "$msid" --out "$tmp/r/real-export.json"
PATH=$EP L "$tmp/echo.toml" muse-ghost-launchsh resume coachman "$repo" "$ghost" "$tmp/beta.txt" --leg synthesis
ls "$mdata"/muse/sessions/*/*/*/ 2>/dev/null | grep -cx "$ghost" > "$tmp/r/muse-ghost-launchsh.sessions"
PATH=$EP D muse-ghost-direct "$repo" "$mdata" muse exec --json --prompt-file "$tmp/beta.txt" --session-id "$ghost" --model "$MODEL" --reasoning-effort low --yolo
PATH=$EP L "$tmp/echo.toml" muse-other-launchsh resume coachman "$other" "$msid" "$tmp/beta.txt" --leg synthesis
PATH=$EP D muse-other-direct "$other" "$mdata" muse exec --json --prompt-file "$tmp/beta.txt" --session-id "$msid" --model "$MODEL" --reasoning-effort low --yolo
cp "$(ls "$mdata"/muse/sessions/*/*/*/"$msid"/session.jsonl)" "$tmp/r/muse-session.jsonl" 2>/dev/null
fsid=$(python3 -c 'import json,sys; print(json.loads(open(sys.argv[1]).readline())["stream"]["id"])' "$tmp/r/muse-fresh.jsonl" 2>/dev/null)
cp "$(ls "$POSTMASTER_HARNESS_DATA"/muse/*/muse/sessions/*/*/*/"$fsid"/session.jsonl)" "$tmp/r/muse-fresh-session.jsonl" 2>/dev/null

# Muse Code, its own provider: the coachman's ship leg, with the key from the coachman's env file.
L "$tmp/live.toml" live-launch launch coachman "$repo" "$tmp/live1.txt" --leg ship
lsid=$(python3 -c 'import json,sys; print(json.loads(open(sys.argv[1]).readline())["stream"]["id"])' "$tmp/r/live-launch.jsonl" 2>/dev/null)
L "$tmp/live.toml" live-resume resume coachman "$repo" "$lsid" "$tmp/live2.txt" --leg ship
L "$tmp/bad.toml" live-bad resume coachman "$repo" "$lsid" "$tmp/live2.txt" --leg ship

# MiMo Code on the stand-in: lane x.
mark mimo-launch; L "$tmp/echo.toml" mimo-launch launch x "$repo" "$tmp/prompt.txt"
xsid=$(python3 -c 'import json,sys; print(json.loads(open(sys.argv[1]).readline())["sessionID"])' "$tmp/r/mimo-launch.jsonl" 2>/dev/null)
xdata=$(data_dir mimo "$repo" x "")
mark mimo-resume; L "$tmp/echo.toml" mimo-resume resume x "$repo" "$xsid" "$tmp/beta.txt"
mark mimo-other-model; STDIN=$tmp/gamma.txt D mimo-other-model "$repo" "$xdata" mimo run --format json -s "$xsid" -m standin/standin-b --dangerously-skip-permissions
mark mimo-fresh; L "$tmp/echo.toml" mimo-fresh launch x "$other" "$tmp/beta.txt"
mark mimo-argv; D mimo-argv "$repo" "$tmp/direct-mimo" mimo run --format json -m standin/standin-a --title argv --dangerously-skip-permissions "$(cat "$tmp/prompt.txt")"
mark mimo-fail; L "$tmp/echo.toml" mimo-fail launch x "$repo" "$tmp/fail.txt"
D mimo-export-real "$repo" "$xdata" mimo export "$xsid"
D mimo-export-ghost "$repo" "$xdata" mimo export ses_ffe5f1da0000000000000none
mark mimo-ghost-launchsh; L "$tmp/echo.toml" mimo-ghost-launchsh resume x "$repo" ses_ffe5f1da0000000000000none "$tmp/beta.txt"
mark mimo-ghost-direct; STDIN=$tmp/beta.txt D mimo-ghost-direct "$repo" "$xdata" mimo run --format json -s ses_ffe5f1da0000000000000none -m standin/standin-a --dangerously-skip-permissions
mark mimo-other-launchsh; L "$tmp/echo.toml" mimo-other-launchsh resume x "$other" "$xsid" "$tmp/pwd.txt"
mark mimo-other-direct; STDIN=$tmp/pwd.txt D mimo-other-direct "$other" "$xdata" mimo run --format json -s "$xsid" -m standin/standin-a --dangerously-skip-permissions
mark end

python3 "$HERE/checks.py" "$tmp" "$tmp/r" "$tmp/requests.jsonl" "$MODEL" > "$OUT/checks.txt"
sed "s#$tmp#<trial>#g" "$tmp/requests.jsonl" > "$OUT/standin-requests.jsonl"
{ echo "muse: $("$MUSE" --version 2>&1 | head -1)"; echo "mimo: $("$MIMO" --version 2>&1 | head -1)"; echo "git: $(git --version)"
  echo "python: $(python3 --version)"; echo "muse model, its own provider: $MODEL"; } > "$OUT/versions.txt"
sed -i "s#$tmp#<trial>#g" "$OUT/checks.txt"
grep -c '^  ok ' "$OUT/checks.txt" | sed 's/^/controls that behaved: /'; grep '^  FAIL ' "$OUT/checks.txt"
echo "recorded in $OUT"
