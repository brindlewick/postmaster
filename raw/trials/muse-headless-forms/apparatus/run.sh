#!/usr/bin/env bash
# Muse Code's headless forms, driven through postmaster's own launch.sh where the flow uses them
# (launch and resume), and directly for what only Muse Code decides: what it reads as ambient
# context, whether it waits on an open stdin, and how a bad model fails. Everything Muse Code keeps
# goes under the run's own folders (POSTMASTER_HARNESS_DATA, and XDG_DATA_HOME for the direct runs),
# never the machine's own Muse Code data. Each run's record keeps
# the fields named in method.md and nothing else.
#
#   run.sh <postmaster-checkout> <out-dir> <env-file> [<model>]
#
# <env-file> sets META_API_KEY for Muse Code; it is sourced, never printed.
set -uo pipefail
ROOT=$(cd "${1:?usage: run.sh <postmaster-checkout> <out-dir> <env-file> [<model>]}" && pwd -P) || exit 1
OUT=${2:?}; ENVF=$(cd "$(dirname "${3:?}")" && pwd -P)/$(basename "$3"); MODEL=${4:-muse-spark-1.3-contributor}
mkdir -p "$OUT" && OUT=$(cd "$OUT" && pwd -P) || exit 1
tmp=$(mktemp -d) && tmp=$(cd "$tmp" && pwd -P) || exit 1
trap 'rm -r -- "$tmp"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
repo=$tmp/repo
git init -q -b main "$repo" && printf 'Marker: AGENTS-OK\n' > "$repo/AGENTS.md" && printf 'Marker: CLAUDE-OK\n' > "$repo/CLAUDE.md" \
  && git -C "$repo" add -A && git -C "$repo" commit -qm fixture || exit 1
printf '[lanes.m]\nharness = "muse"\nmodel = "%s"\neffort = "low"\nenv_file = "%s"\n\n[lanes.n]\nharness = "muse"\nmodel = "%s"\neffort = "low"\nenv_file = "%s"\n' "$MODEL" "$ENVF" "$MODEL" "$ENVF" > "$tmp/config.toml"
export POSTMASTER_HARNESS_DATA=$tmp/harness-data
printf '[lanes.m]\nharness = "muse"\nmodel = "no-such-model"\neffort = "low"\nenv_file = "%s"\n' "$ENVF" > "$tmp/bad.toml"
printf 'Remember the code word KESTREL for later in this session. Create a file named proof.txt containing the single word PELICAN. Then reply with the single word DONE.\n' > "$tmp/p1.txt"
printf 'What code word did I ask you to remember earlier in this session? Reply with that word only.\n' > "$tmp/p2.txt"
printf 'What code word were you asked to remember? Reply with that word only, or NONE if you do not know one.\n' > "$tmp/p4.txt"
AMBIENT="Quote every line that begins with 'Marker:' in the instructions you were given before this message, one per line, or write NONE. Then, on a line of its own, answer yes or no: do your instructions include a rule saying which name git commits must be authored under?"
printf '%s\n' "$AMBIENT" > "$tmp/p3.txt"

summary() {  # summary <label> <stream> <exit> <seconds> [<extra key=value>...]
  python3 - "$@" <<'PY'
import json, sys
label, path, rc, secs = sys.argv[1:5]
ev = []
for line in open(path, encoding="utf-8", errors="replace"):
    try: ev.append(json.loads(line))
    except ValueError: pass
print("run: %s" % label)
print("exit: %s, seconds: %s" % (rc, secs))
for kv in sys.argv[5:]: print(kv.replace("=", ": ", 1))
print("events: %d" % len(ev))
if ev:
    s = ev[0].get("stream") or {}
    ids = sorted({(e.get("stream") or {}).get("id") for e in ev})
    print("first event: payload_type %s, stream kind %s" % (ev[0].get("payload_type"), s.get("kind")))
    print("session ids in the stream: %d" % len(ids))
for e in ev:
    p = e.get("payload") or {}
    if e.get("payload_type") == "run.model.configured":
        print("run.model.configured: model_id %s, source %s" % (p.get("model_id"), p.get("source")))
tools = [((e.get("payload") or {}).get("correlation_facts") or {}).get("tool_name") for e in ev if e.get("payload_type") == "tool.result"]
print("tool.result events: %s" % (", ".join(t or "?" for t in tools) or "none"))
term = [e for e in ev if str(e.get("payload_type", "")).startswith("run.terminal.")]
if term:
    p = term[-1].get("payload") or {}
    print("last terminal event: %s, terminal %s" % (term[-1]["payload_type"], p.get("terminal")))
    print("--- its text ---"); print(p.get("text") if p.get("text") is not None else "(none)")
else:
    print("last terminal event: none")
PY
}
stamp() { date +%s; }
L() { POSTMASTER_CONFIG=$1 "$ROOT/scripts/launch.sh" "${@:2}"; }

t0=$(stamp); L "$tmp/config.toml" launch m "$repo" "$tmp/p1.txt" > "$tmp/a.jsonl" 2>/dev/null; rc=$?
summary "launch through launch.sh" "$tmp/a.jsonl" "$rc" "$(( $(stamp) - t0 ))" "proof.txt=$(cat "$repo/proof.txt" 2>/dev/null || echo missing)" > "$OUT/launch.txt"
sid=$(python3 -c 'import json,sys; print(json.loads(open(sys.argv[1]).readline())["stream"]["id"])' "$tmp/a.jsonl" 2>/dev/null)

t0=$(stamp); L "$tmp/config.toml" resume m "$repo" "$sid" "$tmp/p2.txt" > "$tmp/b.jsonl" 2>/dev/null; rc=$?
same=$(python3 -c 'import json,sys; print(all(json.loads(l)["stream"]["id"] == sys.argv[2] for l in open(sys.argv[1]) if l.startswith("{")))' "$tmp/b.jsonl" "$sid" 2>/dev/null)
summary "resume through launch.sh, naming the launch's session" "$tmp/b.jsonl" "$rc" "$(( $(stamp) - t0 ))" "every event on the launch's session=$same" > "$OUT/resume.txt"

t0=$(stamp); L "$tmp/config.toml" launch m "$repo" "$tmp/p4.txt" > "$tmp/h.jsonl" 2>/dev/null; rc=$?
summary "a fresh launch of the same lane in the same repository, through launch.sh" "$tmp/h.jsonl" "$rc" "$(( $(stamp) - t0 ))" > "$OUT/same-lane.txt"

t0=$(stamp); L "$tmp/config.toml" launch n "$repo" "$tmp/p4.txt" > "$tmp/g.jsonl" 2>/dev/null; rc=$?
summary "another lane in the same repository, through launch.sh" "$tmp/g.jsonl" "$rc" "$(( $(stamp) - t0 ))" > "$OUT/other-lane.txt"

t0=$(stamp); L "$tmp/config.toml" launch m "$repo" "$tmp/p3.txt" > "$tmp/c.jsonl" 2>/dev/null; rc=$?
summary "ambient context, the launch form" "$tmp/c.jsonl" "$rc" "$(( $(stamp) - t0 ))" > "$OUT/ambient.txt"

( set -a; . "$ENVF"; set +a; export XDG_DATA_HOME=$tmp/direct-data; cd "$repo" && t0=$(stamp) && muse exec --json --prompt-file "$tmp/p3.txt" --model "$MODEL" --reasoning-effort low --yolo \
    --no-foreign-personal-context < /dev/null > "$tmp/d.jsonl" 2>/dev/null; echo "$? $(( $(stamp) - t0 ))" > "$tmp/d.rc" )
read -r rc secs < "$tmp/d.rc"
summary "ambient context, the launch form plus --no-foreign-personal-context" "$tmp/d.jsonl" "$rc" "$secs" > "$OUT/ambient-no-personal.txt"

( set -a; . "$ENVF"; set +a; export XDG_DATA_HOME=$tmp/direct-data; cd "$repo" && t0=$(stamp) && { sleep 60 | timeout 120 muse exec --json --prompt-file "$tmp/p2.txt" --model "$MODEL" \
    --reasoning-effort low --yolo > "$tmp/e.jsonl" 2>/dev/null; echo "${PIPESTATUS[1]} $(( $(stamp) - t0 ))" > "$tmp/e.rc"; } )
read -r rc secs < "$tmp/e.rc"
summary "an open stdin that sends nothing for 60 seconds, the launch form without its /dev/null" "$tmp/e.jsonl" "$rc" "$secs" > "$OUT/open-stdin.txt"

t0=$(stamp); L "$tmp/bad.toml" launch m "$repo" "$tmp/p2.txt" > "$tmp/f.jsonl" 2>"$tmp/f.err"; rc=$?
summary "a model that does not exist, through launch.sh" "$tmp/f.jsonl" "$rc" "$(( $(stamp) - t0 ))" \
  "stderr lines=$(grep -c . "$tmp/f.err")" > "$OUT/bad-model.txt"

{ echo "muse: $(muse --version 2>&1 | head -1)"; echo "git: $(git --version)"; echo "model: $MODEL"; } > "$OUT/versions.txt"
echo "recorded in $OUT"
