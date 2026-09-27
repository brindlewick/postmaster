#!/usr/bin/env bash
# MiMo Code's headless forms, driven through postmaster's own launch.sh where the flow uses them
# (launch and resume), and directly for what only MiMo Code decides: whether it waits on an open
# stdin, and what a resume runs on when it is not told. Each run's record keeps the fields named
# in method.md and nothing else.
#
#   run.sh <postmaster-checkout> <out-dir> <env-file> [<model>]
#
# <env-file> sets XIAOMI_API_KEY for MiMo Code; it is sourced, never printed. Each launch keeps its
# data where launch.sh puts it, under POSTMASTER_HARNESS_DATA, here in the trial's own folder; the
# direct runs use a data directory in that folder too, so nothing touches the machine's own.
set -uo pipefail
ROOT=$(cd "${1:?usage: run.sh <postmaster-checkout> <out-dir> <env-file> [<model>]}" && pwd -P) || exit 1
OUT=${2:?}; ENVF=$(cd "$(dirname "${3:?}")" && pwd -P)/$(basename "$3"); MODEL=${4:-<plan-provider>/mimo-v2.6-pro}
mkdir -p "$OUT" && OUT=$(cd "$OUT" && pwd -P) || exit 1
tmp=$(mktemp -d) && tmp=$(cd "$tmp" && pwd -P) || exit 1
trap 'rm -r -- "$tmp"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export POSTMASTER_HARNESS_DATA=$tmp/harness-data
export TRIAL_TMP=$tmp
repo=$tmp/repo
git init -q -b main "$repo" && printf 'Marker: AGENTS-OK\n' > "$repo/AGENTS.md" && printf 'Marker: CLAUDE-OK\n' > "$repo/CLAUDE.md" \
  && git -C "$repo" add -A && git -C "$repo" commit -qm fixture || exit 1
# A project hook and a project MCP server, set up in Claude Code's files, each leaving a mark
# outside the repository if MiMo Code runs it, so what it takes from Claude Code's settings is
# answered by what happens.
mkdir -p "$repo/.claude" "$tmp/marks"
printf '{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"touch %s/hook-ran"}]}]}}\n' "$tmp/marks" > "$repo/.claude/settings.json"
printf '{"mcpServers":{"probe":{"command":"sh","args":["-c","touch %s/mcp-started; sleep 5"]}}}\n' "$tmp/marks" > "$repo/.claude.json"
lane() { printf '[lanes.%s]\nharness = "mimo"\nmodel = "%s"\neffort = "low"\nenv_file = "%s"\n\n' "$1" "$2" "$ENVF"; }
{ lane x "$MODEL"; lane y "$MODEL"; } > "$tmp/config.toml"
lane x "no-such-provider/no-such-model" > "$tmp/bad.toml"
printf 'Remember the code word KESTREL for later in this session. Create a file named proof.txt containing the single word PELICAN. Then reply with the single word DONE.\n' > "$tmp/p1.txt"
printf 'What code word did I ask you to remember earlier in this session? Reply with that word only.\n' > "$tmp/p2.txt"
printf 'Search your memory and your session history for a code word you were asked to remember. Reply with that word only, or NONE if you find none.\n' > "$tmp/p4.txt"
printf 'Run the shell command: echo hi. Then reply with its output only.\n' > "$tmp/p5.txt"
printf "Quote every line that begins with 'Marker:' in the instructions you were given before this message, one per line, or write NONE. Then, on a line of its own, answer yes or no: do your instructions include a rule saying which name git commits must be authored under?\n" > "$tmp/p3.txt"

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
print("events: %d, of types: %s" % (len(ev), ", ".join(sorted({str(e.get("type")) for e in ev})) or "none"))
print("sessions in the stream: %d" % len({e.get("sessionID") for e in ev if e.get("sessionID")}))
import os
tools = [(e.get("part") or {}).get("tool") for e in ev if e.get("type") == "tool_use"]
print("tool_use events: %s" % (", ".join(t or "?" for t in tools) or "none"))
tmp, home = os.environ.get("TRIAL_TMP", "\0"), os.path.expanduser("~")
def clean(v): return str(v).replace(tmp, "<trial>").replace(home, "~")
for e in ev:
    part = e.get("part") or {}
    if e.get("type") != "tool_use": continue
    inp = (part.get("state") or {}).get("input") or {}
    where = [clean(inp[k]) for k in ("file_path", "filePath", "path", "pattern", "command", "query", "action") if isinstance(inp.get(k), str)]
    if where: print("  %s: %s" % (part.get("tool"), " | ".join(w[:160] for w in where)))
fin = [(e.get("part") or {}).get("reason") for e in ev if e.get("type") == "step_finish"]
print("step_finish reasons: %s" % (", ".join(r or "?" for r in fin) or "none"))
errs = [e for e in ev if e.get("type") == "error"]
if errs: print("error events: %d, the first naming %s" % (len(errs), json.dumps((errs[0].get("error") or {}).get("name"))))
texts = [(e.get("part") or {}).get("text") for e in ev if e.get("type") == "text"]
print("--- the last text event ---"); print(texts[-1] if texts else "(none)")
PY
}
models() {  # models <session> <data dir>: each assistant message's model and variant, from MiMo Code's own record
  (cd "$repo" && XDG_DATA_HOME=$2 MIMOCODE_DISABLE_CLAUDE_IMPORT=1 timeout 60 mimo export "$1" < /dev/null 2>/dev/null) | python3 -c '
import json, sys
try: d = json.load(sys.stdin)
except ValueError: print("export: none"); sys.exit(0)
rows = [(m.get("info") or {}) for m in d.get("messages") or []]
print("assistant messages, model and variant: " + "; ".join("%s/%s %s" % (i.get("providerID"), i.get("modelID"), i.get("variant")) for i in rows if i.get("role") == "assistant"))'
}
sid_of() { python3 -c 'import json,sys; print(next((json.loads(l).get("sessionID") for l in open(sys.argv[1]) if l.startswith("{")), ""))' "$1" 2>/dev/null; }
stamp() { date +%s; }
L() { POSTMASTER_CONFIG=$1 "$ROOT/scripts/launch.sh" "${@:2}"; }
set -a; . "$ENVF"; set +a      # for the direct runs and the exports

t0=$(stamp); L "$tmp/config.toml" launch x "$repo" "$tmp/p1.txt" > "$tmp/a.jsonl" 2>/dev/null; rc=$?
summary "launch through launch.sh" "$tmp/a.jsonl" "$rc" "$(( $(stamp) - t0 ))" "proof.txt=$(cat "$repo/proof.txt" 2>/dev/null || echo missing)" > "$OUT/launch.txt"
sid=$(sid_of "$tmp/a.jsonl")
xdata=$(ls -d "$POSTMASTER_HARNESS_DATA"/mimo/* | head -1)     # lane x's, the only one so far

t0=$(stamp); L "$tmp/config.toml" resume x "$repo" "$sid" "$tmp/p2.txt" > "$tmp/b.jsonl" 2>/dev/null; rc=$?
same=$(python3 -c 'import json,sys; print(all(json.loads(l).get("sessionID") == sys.argv[2] for l in open(sys.argv[1]) if l.startswith("{")))' "$tmp/b.jsonl" "$sid")
{ summary "resume through launch.sh, naming the launch's session" "$tmp/b.jsonl" "$rc" "$(( $(stamp) - t0 ))" "every event on the launch's session=$same"
  models "$sid" "$xdata"; } > "$OUT/resume.txt"

t0=$(stamp); (cd "$repo" && XDG_DATA_HOME=$xdata MIMOCODE_DISABLE_CLAUDE_IMPORT=1 timeout 300 mimo run --format json -s "$sid" < "$tmp/p2.txt" > "$tmp/r.jsonl" 2>/dev/null); rc=$?
{ summary "resume with no model or variant named, direct, in lane x's data directory" "$tmp/r.jsonl" "$rc" "$(( $(stamp) - t0 ))"
  models "$sid" "$xdata"; } > "$OUT/resume-unnamed.txt"

t0=$(stamp); L "$tmp/config.toml" launch x "$repo" "$tmp/p4.txt" > "$tmp/h.jsonl" 2>/dev/null; rc=$?
summary "a fresh launch of the same lane in the same repository, through launch.sh" "$tmp/h.jsonl" "$rc" "$(( $(stamp) - t0 ))" > "$OUT/same-lane.txt"

t0=$(stamp); L "$tmp/config.toml" launch y "$repo" "$tmp/p4.txt" > "$tmp/g.jsonl" 2>/dev/null; rc=$?
summary "another lane in the same repository, through launch.sh" "$tmp/g.jsonl" "$rc" "$(( $(stamp) - t0 ))" > "$OUT/other-lane.txt"

t0=$(stamp); L "$tmp/config.toml" launch x "$repo" "$tmp/p3.txt" > "$tmp/c.jsonl" 2>/dev/null; rc=$?
summary "ambient context, the launch form" "$tmp/c.jsonl" "$rc" "$(( $(stamp) - t0 ))" > "$OUT/ambient.txt"

t0=$(stamp); MIMOCODE_DISABLE_CLAUDE_CODE_PROMPT=1 L "$tmp/config.toml" launch x "$repo" "$tmp/p3.txt" > "$tmp/d.jsonl" 2>/dev/null; rc=$?
summary "ambient context, the launch form with MIMOCODE_DISABLE_CLAUDE_CODE_PROMPT=1" "$tmp/d.jsonl" "$rc" "$(( $(stamp) - t0 ))" > "$OUT/ambient-no-claude.txt"

t0=$(stamp); L "$tmp/config.toml" launch x "$repo" "$tmp/p5.txt" > "$tmp/k.jsonl" 2>/dev/null; rc=$?
summary "a shell command, with a project hook and a project MCP server in Claude Code's files, through launch.sh" "$tmp/k.jsonl" "$rc" "$(( $(stamp) - t0 ))" \
  "the project hook ran=$([ -e "$tmp/marks/hook-ran" ] && echo yes || echo no)" \
  "the project MCP server was started=$([ -e "$tmp/marks/mcp-started" ] && echo yes || echo no)" > "$OUT/claude-settings.txt"

t0=$(stamp); (cd "$repo" && { sleep 60 | XDG_DATA_HOME=$tmp/direct-data MIMOCODE_DISABLE_CLAUDE_IMPORT=1 timeout 120 mimo run --format json -m "$MODEL" \
  --variant low --dangerously-skip-permissions "Reply with the single word OK." > "$tmp/e.jsonl" 2>/dev/null; echo "${PIPESTATUS[1]}" > "$tmp/e.rc"; })
summary "an open stdin that sends nothing for 60 seconds, the prompt in argv, direct" "$tmp/e.jsonl" "$(cat "$tmp/e.rc")" "$(( $(stamp) - t0 ))" > "$OUT/open-stdin.txt"

t0=$(stamp); L "$tmp/bad.toml" launch x "$repo" "$tmp/p4.txt" > "$tmp/f.jsonl" 2>"$tmp/f.err"; rc=$?
summary "a model that does not exist, through launch.sh" "$tmp/f.jsonl" "$rc" "$(( $(stamp) - t0 ))" "stderr lines=$(grep -c . "$tmp/f.err")" > "$OUT/bad-model.txt"

{ echo "mimo: $(mimo --version 2>&1 | head -1)"; echo "git: $(git --version)"; echo "model: $MODEL"; } > "$OUT/versions.txt"
echo "recorded in $OUT"
