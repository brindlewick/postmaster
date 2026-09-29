#!/usr/bin/env bash
# The trial of issue #115: what a headless MiMo Code launch spends its CPU on, and whether MiMo Code's
# own modules run on a newer Bun (the stopgap) spend less, launch, stream, resume and export as before.
#
#   run.sh <stage> <work dir> <record dir>
#
# Stages, each writing <record dir>/<stage>.txt:
#   versions  the versions everything ran at
#   extract   MiMo Code's modules out of its executable twice: onto the installed Bun (the stopgap),
#             and onto the Bun its executable carries (the control, differing only in extraction)
#   bench     no MiMo Code: fetch reading a 20-event-a-second stream on each runtime; Bun's own
#             garbage-collection cadence workload (from its test suite) on each Bun
#   forms     real provider, shipped and stopgap: launch, events, tool use, resume, export, and a
#             resume of an id the thread store does not hold
#   standin   stand-in provider, shipped, control and stopgap at once, twice: 20 s silent, then 20
#             deltas a second for 45 s
#   gc        the stand-in again, 10 s silent then 30 s streaming, with BUN_JSC_logGC on
#   real      real providers, the same prompt at once on mimo shipped, mimo stopgap and codex, twice
#
# Every launch goes through the flow's own scripts/host.sh run (no host) and scripts/launch.sh, in a
# fresh copy of a one-commit repository, and is sampled from /proc by sample.py. The real stages
# read the lanes `mimo` (harness mimo) and `luna` (harness codex) from ~/.postmaster/config.toml as
# they are; the stopgap lane is `mimo` with an env file that sources the lane's own env file and then
# names the stopgap in MIMOCODE_BIN_PATH. Nothing here prints an env file.
set -uo pipefail
stage=${1:?stage}; W=$(mkdir -p "${2:?work dir}" && cd "$2" && pwd); R=$(mkdir -p "${3:?record dir}" && cd "$3" && pwd)
HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
ROOT=$(git -C "$HERE" rev-parse --show-toplevel)
MIMO_EXE=$(dirname "$(readlink -f "$(command -v mimo)")")/.mimocode
BUN=$(readlink -f "$(command -v bun)")
OUT=$R/$stage.txt
# The provider id of the mimo lane's plan names a region, so it is read from the config and shown as
# <plan-provider>, as the trial of #74 shows it.
PLAN=$(python3 -c 'import os, tomllib; print(tomllib.load(open(os.path.expanduser("~/.postmaster/config.toml"), "rb"))["lanes"]["mimo"]["model"].split("/")[0])' 2>/dev/null)
scrub() {  # the work dir, the home directory and the plan's provider id never reach a record
  sed -e "s#$W#<trial>#g" -e "s#$HOME#~#g" ${PLAN:+-e "s#$PLAN/#<plan-provider>/#g"}
}
say() { printf '%s\n' "$*" | scrub | tee -a "$OUT"; }
port() { python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])'; }

[ -x "$MIMO_EXE" ] || { echo "no MiMo Code executable at $MIMO_EXE" >&2; exit 1; }
: > "$OUT"

# L <name> <config> <lane> <prompt file> [resume <thread>]: one launch or resume through host.sh and
# launch.sh in <W>/runs/<name>, sampled until it exits. A resume reuses the named launch's copy and
# harness data (RESUME_OF=<launch name>).
L() {
  local name=$1 cfg=$2 lane=$3 prompt=$4 d=$W/runs/$1 wt hd
  mkdir -p "$d"
  if [ -n "${RESUME_OF:-}" ]; then wt=$W/runs/$RESUME_OF/wt; hd=$W/runs/$RESUME_OF/hd
  else cp -a "$W/target" "$d/wt"; wt=$d/wt; hd=$d/hd; fi
  [ -n "${STANDIN_PORT:-}" ] && printf '{\n  "provider": {\n    "standin": {\n      "npm": "@ai-sdk/openai-compatible",\n      "name": "Stand-in",\n      "options": { "baseURL": "http://127.0.0.1:%s/v1", "apiKey": "standin" },\n      "models": { "standin-a": { "name": "standin-a" } }\n    }\n  }\n}\n' "$STANDIN_PORT" > "$wt/mimocode.jsonc"
  ( cd "$wt" || exit 1
    export POSTMASTER_CONFIG=$cfg POSTMASTER_HARNESS_DATA=$hd POSTMASTER_HOST=none POSTMASTER_HOST_STATE=$d/host
    python3 "$HERE/sample.py" "$d/pid" "$d/done" "$d/timeline.jsonl" 0.5 "$d/events.jsonl" &
    local s=$!
    if [ -n "${THREAD:-}" ]; then set -- resume "$lane" "$wt" "$THREAD" "$prompt"; else set -- launch "$lane" "$wt" "$prompt"; fi
    "$ROOT/scripts/host.sh" run "#115 trial $name" "$wt" --out "$d/events.jsonl" --err "$d/err.txt" \
      --marker "$d/done" --pidfile "$d/pid" -- "$ROOT/scripts/launch.sh" "$@" > /dev/null
    wait $s )
}

standin_config() {  # standin_config <file> [env file]: lane x on the stand-in
  printf '[lanes.x]\nharness = "mimo"\nmodel = "standin/standin-a"\n' > "$1"
  [ -n "${2:-}" ] && printf 'env_file = "%s"\n' "$2" >> "$1"
}

real_config() {  # the live lanes mimo and luna as they are, and mimo-stopgap
  python3 - "$W/real.toml" "$W/stopgap-real.env" "$W/stopgap/mimo" <<'EOF'
import os, sys, tomllib
out, envf, launcher = sys.argv[1:4]
c = tomllib.load(open(os.path.expanduser("~/.postmaster/config.toml"), "rb"))
lanes = c["lanes"]
m, x = dict(lanes["mimo"]), dict(lanes["luna"])
own = os.path.expanduser(m["env_file"])
open(envf, "w").write(f". '{own}'\nMIMOCODE_BIN_PATH='{launcher}'\n")
def lane(name, d):
    return f"[lanes.{name}]\n" + "".join(f'{k} = "{os.path.expanduser(v) if k == "env_file" else v}"\n' for k, v in d.items() if k in ("harness", "model", "effort", "env_file")) + "\n"
open(out, "w").write(lane("mimo", m) + lane("mimo-stopgap", {**m, "env_file": envf}) + lane("luna", x))
EOF
}

case $stage in
versions)
  say "flow: $(git -C "$ROOT" rev-parse --short HEAD)"
  say "mimo: $(mimo --version 2>&1) (executable sha256 $(sha256sum "$MIMO_EXE" | cut -c1-16)...)"
  say "bun inside mimo: $(BUN_BE_BUN=1 "$MIMO_EXE" --version 2>&1)"
  say "bun installed: $("$BUN" --version)"
  say "node: $(node --version)"
  say "codex: $(codex --version 2>&1 | head -1)"
  say "python: $(python3 --version 2>&1)"
  say "kernel: $(uname -r), $(nproc) cores"
  ;;

extract)
  printf '#!/bin/sh\nBUN_BE_BUN=1 exec "%s" "$@"\n' "$MIMO_EXE" > "$W/bun-1.3.14"; chmod +x "$W/bun-1.3.14"
  say "stopgap: $(python3 "$HERE/extract.py" "$MIMO_EXE" "$BUN" "$W/stopgap")"
  say "control: $(python3 "$HERE/extract.py" "$MIMO_EXE" "$W/bun-1.3.14" "$W/control")"
  printf "MIMOCODE_BIN_PATH='%s'\n" "$W/stopgap/mimo" > "$W/stopgap.env"
  printf "MIMOCODE_BIN_PATH='%s'\n" "$W/control/mimo" > "$W/control.env"
  say "stopgap reports: $(cd "$W" && MIMOCODE_BIN_PATH=$W/stopgap/mimo mimo --version 2>&1)"
  say "control reports: $(cd "$W" && MIMOCODE_BIN_PATH=$W/control/mimo mimo --version 2>&1)"
  [ -d "$W/target/.git" ] || { mkdir -p "$W/target" && ( cd "$W/target" && git init -q -b main \
    && printf '# scratch\n\nA one-commit repository for trials.\n' > README.md && git add -A \
    && git -c user.name=trial -c user.email=trial@example.invalid commit -q -m scratch ); }
  say "target: $(git -C "$W/target" log --oneline | wc -l) commit, $(git -C "$W/target" ls-files | wc -l) file"
  ;;

bench)
  p=$(port); python3 "$HERE/bench-server.py" "$p" & srv=$!; sleep 1
  U="http://127.0.0.1:$p/sse?rate=20&secs=20&size=150"
  say "## fetch reading 20 events a second for 20 s, 150 bytes each, at once on each runtime"
  { BUN_BE_BUN=1 "$MIMO_EXE" "$HERE/bench-client.js" "$U" 2>/dev/null & "$BUN" "$HERE/bench-client.js" "$U" 2>/dev/null & node "$HERE/bench-client.js" "$U" 2>/dev/null & wait; } | while read -r l; do say "$l"; done
  say "## the same with 250 MB of objects retained, eden collections counted (BUN_JSC_logGC=1)"
  for b in mimo installed; do
    if [ $b = mimo ]; then line=$(BUN_JSC_logGC=1 BUN_BE_BUN=1 "$MIMO_EXE" "$HERE/bench-client.js" "$U" 250 2> "$W/gc-$b.err")
    else line=$(BUN_JSC_logGC=1 "$BUN" "$HERE/bench-client.js" "$U" 250 2> "$W/gc-$b.err"); fi
    say "$line eden_collections=$(grep -c '=> EdenCollection' "$W/gc-$b.err")"
  done
  kill $srv
  say "## Bun's cadence workload (test/js/bun/gc/gc-controller-cadence.test.ts): 100 small objects every 20 ms, 150 times"
  WL='let n=0; const fill=Buffer.alloc(80,"x").toString(); const id=setInterval(()=>{const arr=[]; for(let i=0;i<100;i++) arr.push({i,s:fill+i}); globalThis.sink=arr; if(++n>=150){clearInterval(id); process.exit(0);}},20);'
  say "bun $(BUN_BE_BUN=1 "$MIMO_EXE" --version): $(BUN_JSC_logGC=1 BUN_BE_BUN=1 "$MIMO_EXE" -e "$WL" 2>&1 | grep -c '=> EdenCollection') eden collections"
  say "bun $(BUN_BE_BUN=1 "$MIMO_EXE" --version) with BUN_GC_TIMER_DISABLE=1: $(BUN_JSC_logGC=1 BUN_GC_TIMER_DISABLE=1 BUN_BE_BUN=1 "$MIMO_EXE" -e "$WL" 2>&1 | grep -c '=> EdenCollection') eden collections"
  say "bun $("$BUN" --version): $(BUN_JSC_logGC=1 "$BUN" -e "$WL" 2>&1 | grep -c '=> EdenCollection') eden collections"
  ;;

forms)
  real_config
  printf 'Remember the code word KESTREL. Use your shell tool to run `echo PELICAN > proof.txt`. Then reply with the single word DONE.\n' > "$W/forms-launch.txt"
  printf 'What was the code word? Reply with the word only.\n' > "$W/forms-resume.txt"
  for c in shipped:mimo stopgap:mimo-stopgap; do
    n=${c%%:*} lane=${c#*:}
    L "forms-$n" "$W/real.toml" "$lane" "$W/forms-launch.txt"
    sid=$(python3 -c 'import json,sys; print(next((json.loads(l).get("sessionID") for l in open(sys.argv[1]) if l.strip()), ""))' "$W/runs/forms-$n/events.jsonl")
    RESUME_OF=forms-$n THREAD=$sid L "forms-$n-resume" "$W/real.toml" "$lane" "$W/forms-resume.txt"
    ghost=$(cd "$W/runs/forms-$n/wt" && POSTMASTER_CONFIG=$W/real.toml POSTMASTER_HARNESS_DATA=$W/runs/forms-$n/hd \
      "$ROOT/scripts/launch.sh" resume "$lane" "$W/runs/forms-$n/wt" ses_none "$W/forms-resume.txt" 2>&1 >/dev/null < /dev/null; echo "exit $?")
    data=$(ls -d "$W/runs/forms-$n/hd/mimo/"*/ | head -1)
    ( cd "$W/runs/forms-$n/wt" && if [ $n = stopgap ]; then export MIMOCODE_BIN_PATH=$W/stopgap/mimo; fi
      XDG_DATA_HOME=$data MIMOCODE_DISABLE_CLAUDE_IMPORT=1 mimo export "$sid" > "$W/runs/forms-$n/export.json" 2>/dev/null < /dev/null )
    python3 - "$W/runs/forms-$n" "$n" "$ghost" <<'EOF' | while read -r l; do say "$l"; done
import collections, json, sys
d, n, ghost = sys.argv[1:4]
def events(p):
    return [json.loads(l) for l in open(p) if l.strip()]
def summary(ev):
    types = collections.Counter(e.get("type") for e in ev)
    texts = [e["part"].get("text", "") for e in ev if e.get("type") == "text"]
    tools = [e["part"].get("tool") for e in ev if e.get("type") == "tool_use"]
    return {"events": dict(types), "sessions": len({e.get("sessionID") for e in ev}), "tools": tools,
            "finish": [e["part"].get("reason") for e in ev if e.get("type") == "step_finish"],
            "errors": [e.get("error", {}).get("name") for e in ev if e.get("type") == "error"],
            "last_text": texts[-1].strip() if texts else None}
a, b = events(f"{d}/events.jsonl"), events(f"{d}-resume/events.jsonl")
hc = sorted({v["comm"] for l in open(f"{d}/timeline.jsonl") for v in json.loads(l)["procs"].values()} & {".mimocode", "bun", "codex"})
proof = open(f"{d}/wt/proof.txt").read().strip() if __import__("os").path.exists(f"{d}/wt/proof.txt") else None
ex = json.load(open(f"{d}/export.json"))
msgs = [m.get("info", m) for m in ex.get("messages", [])]
models = collections.Counter(f'{m.get("providerID")}/{m.get("modelID")} variant={m.get("variant")}' for m in msgs if m.get("role") == "assistant")
print(json.dumps({"condition": n, "processes": hc, "launch": summary(a), "proof.txt": proof,
                  "resume": summary(b), "same_thread": {x.get("sessionID") for x in a} == {x.get("sessionID") for x in b},
                  "export_assistant_messages": dict(models), "resume_of_unknown_id": ghost.replace("\n", " ")[-160:]}))
EOF
  done
  ;;

standin|gc)
  standin_config "$W/standin-shipped.toml"; standin_config "$W/standin-control.toml" "$W/control.env"; standin_config "$W/standin-stopgap.toml" "$W/stopgap.env"
  if [ $stage = gc ]; then export BUN_JSC_logGC=1; rounds=1; P="Reply OK. WAIT=10 RATE=20 SECS=30"
  else rounds=2; P="Reply OK. WAIT=20 RATE=20 SECS=45"; fi
  printf '%s\n' "$P" > "$W/$stage-prompt.txt"
  say "## stand-in: \"$P\", shipped, control and stopgap at once"
  for r in $(seq 1 $rounds); do
    servers=(); launches=()
    for c in shipped control stopgap; do
      n=$stage-$r-$c; mkdir -p "$W/runs/$n"; sp=$(port)
      python3 "$HERE/standin.py" "$sp" "$W/runs/$n/standin.jsonl" & servers+=($!)
      ( sleep 0.5; STANDIN_PORT=$sp L "$n" "$W/standin-$c.toml" x "$W/$stage-prompt.txt" ) & launches+=($!)
    done
    wait "${launches[@]}"
    kill "${servers[@]}" 2>/dev/null
    for c in shipped control stopgap; do say "$(python3 "$HERE/report.py" "$W/runs/$stage-$r-$c" "$c")"; done
  done
  ;;

real)
  real_config
  printf 'Write a story of about 2000 words about a lighthouse keeper who repairs clocks. Reply with the story only, in plain prose, and do not use any tools.\n' > "$W/real-prompt.txt"
  say "## real providers: \"$(cat "$W/real-prompt.txt")\", at once"
  for r in 1 2; do
    for c in shipped:mimo stopgap:mimo-stopgap codex:luna; do
      n=real-$r-${c%%:*}; ( L "$n" "$W/real.toml" "${c#*:}" "$W/real-prompt.txt" ) &
    done
    wait
    for c in shipped stopgap codex; do
      words=$(python3 -c '
import json, sys
t = ""
for l in open(sys.argv[1]):
    e = json.loads(l) if l.strip() else {}
    p = e.get("part") or e.get("item") or {}
    if e.get("type") in ("text", "item.completed") and p.get("text"): t = p["text"]
print(len(t.split()))' "$W/runs/real-$r-$c/events.jsonl")
      say "$(python3 "$HERE/report.py" "$W/runs/real-$r-$c" "$c") words=$words"
    done
  done
  ;;
*) echo "unknown stage $stage" >&2; exit 1 ;;
esac
