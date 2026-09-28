#!/usr/bin/env bash
# Launch or resume a lane or a role by name, from the config, in the exact form harnesses.md
# records for its harness. One command for every harness, so no form is ever copied by hand;
# this script and harnesses.md must agree, and a change to one is a change to both.
#
#   launch.sh form    <name> [--leg <leg>] [--run <dispatch>]
#   launch.sh launch  <name> <cwd> <prompt-file> [--leg <leg>] [--last <file>] [--run <dispatch>]
#   launch.sh resume  <name> <cwd> <thread-id> <prompt-file> [--leg <leg>] [--last <file>]
#                     [--run <dispatch>]
#   launch.sh skill   <name> <skill> [--run <dispatch>]
#   launch.sh live    <name> <cwd> [--leg <leg>] [--resume <thread-id>] [--run <dispatch>]
#   launch.sh session <name> <cwd> id|path|records <value> [--leg <leg>] [--run <dispatch>]
#   launch.sh turn    <name> <cwd> <thread> <record> <offset> <since> <prompt-file> [--leg <leg>]
#                     [--run <dispatch>]
#   launch.sh --self-test
#
# The config is the live one, ~/.postmaster/config.toml (POSTMASTER_CONFIG overrides the path),
# unless --run names the dispatch directory of the run being served. Then it is the config that
# run recorded at dispatch, `config` in <dispatch>/run.json (scripts/run-meta.sh): the live
# config is not read at all, and a run.json that is missing or unreadable is refused. Every
# launch and resume inside a run passes --run; the postmaster's own spawn and the config check
# before dispatch do not. The checks below apply to a recorded config as to the live one.
#
# <name> is a lane from [lanes.<name>], or `coachman`, `coachman_fallback` or `postmaster`
# from [team]. <leg> is synthesis, review or ship, and with --leg, [team.coachman_legs.<leg>]
# overrides the coachman for that leg. Launching or resuming `coachman` needs --leg; `form`
# without it shows team.coachman. The coachman is refused when [team.coachman_legs] names any
# other leg or holds an entry that is not a table, and the coachman and the fallback are
# refused on a lane's model, a model id's bracketed suffixes aside. HARNESS, MODEL, EFFORT and
# ENV_FILE come from the config alone, never from the environment. A lane's env_file is how a
# harness reaches an alternate backend: a file outside this repo, never a value in the config,
# and a relative path is read from the live config's directory, under --run too. It is shell,
# sourced last, once the command, its directory and its stdin are fixed, so its assignments
# reach the harness and not this script's choices; it runs as code, and is the user's to write.
# The events stream goes to stdout; the caller redirects and backgrounds. --last names the file
# a harness writes its final message to, where the harness supports it (codex -o). `skill`
# prints the prompt that invokes the lane's harness's own skill (harnesses.md, Own review
# skills); `launch` runs it like any other prompt. The one skill is security-review. `form`
# prints two lines: `launch: ` and the launch form, then `resume: ` and the resume form, or
# `resume: none: ` and why there is none.
#
# With host.live_agents true in the config, lanes and coachman legs run as live agents in Herdr
# panes (harnesses.md and hosts.md, Live agents). `form` then prints a lane's or the coachman's
# live form: `herdr agent start ... -- <interactive form>`, or, for a harness Herdr has no agent
# kind for, the command typed into the pane's shell. A harness that runs on its own signal adds
# the variables its pane's shell sets and `finish: signal file`. The form is refused when the
# session host is not Herdr, or when claude, pi, grok or agy lacks its Herdr integration in the
# config its environment names, the env file included. codex, muse and mimo need none: such a
# lane signals its own finish by writing a file the flow names, and its thread comes from the
# harness's own records. `live` makes the same checks, readies what the harness would otherwise
# stop to ask about or run without (trust; MiMo's variant), and prints one JSON line for
# scripts/host.sh start: the kind or the typed command, the env file, the pane's variables, the
# interactive arguments and whether the lane signals, resuming <thread-id> with --resume.
# `session` turns a session reference into the thread id and the path of the harness's session
# record, tab-separated: the reference the integration reported to Herdr (id or path), or
# `records <since>`, the first thread the harness's own records hold for this launch that began
# at or after <since>, in epoch seconds, and nothing while none has. `turn` reads a turn from the
# harness's own record, past byte <offset> of <record>, or since <since> for a record that is not
# a file of lines, and prints one JSON line: whether the record holds the prompt in
# <prompt-file>, whether that turn has ended, and its final message. launch and resume stay
# headless, and the postmaster is never a live lane.
#
#   exit 0  the forms or the skill's prompt were printed, or the harness exited 0
#   exit 1  usage, config or run.json missing or unreadable, unknown name, a leg that is not
#           synthesis, review or ship, the coachman launched or resumed with no --leg, a
#           coachman or fallback on a lane's model, harness not on PATH, env_file missing, a
#           form this script does not have (agy resume), a skill that is not security-review,
#           or a muse or mimo resume of a thread the launch's data directory does not hold; with
#           the key on, no Herdr, or no Herdr integration where the harness reads its config
#   exit 3  skill: the lane's harness has no such skill recorded; turn: the harness's record is
#           not one this script reads
#   else    the harness's own exit code
set -uo pipefail
CONFIG=${POSTMASTER_CONFIG:-$HOME/.postmaster/config.toml}

if [ "${1:-}" = --self-test ]; then
  # Each control runs this script on a fixture config, with stub harnesses first on PATH.
  # `form` only prints, so nothing is launched. A run's record is written from a fixture by
  # run-meta.sh, as at dispatch, so what this script reads is what that one writes.
  self=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)/$(basename -- "$0")
  here=$(dirname "$self")
  tmp=$(mktemp -d) || exit 1
  trap 'rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
  # A stub prints its arguments and PROBE, which an env file may set, so a launch or a resume
  # shows the harness, model, effort and env file it would run on.
  mkdir "$tmp/bin" "$tmp/wt"
  for h in claude pi codex; do
    printf '#!/bin/sh\necho "$@ probe=${PROBE:-}"\n' > "$tmp/bin/$h" && chmod +x "$tmp/bin/$h"
  done
  # The muse and mimo stubs also print what arrived on their stdin. Their export finds a thread
  # only where a file of its name sits in their XDG_DATA_HOME; mimo's prints that file, and its
  # session list prints sessions.json there.
  cat > "$tmp/bin/mimo" <<'SH' && chmod +x "$tmp/bin/mimo"
#!/bin/sh
if [ "$1" = export ]; then [ -e "$XDG_DATA_HOME/$2" ] && { cat "$XDG_DATA_HOME/$2"; exit 0; }; echo "Session not found: $2" >&2; exit 1; fi
if [ "$1" = session ] && [ "$2" = list ]; then cat "$XDG_DATA_HOME/sessions.json" 2>/dev/null || echo "[]"; exit 0; fi
printf "%s probe=%s stdin=%s import-off=%s data=%s\n" "$*" "${PROBE:-}" "$(cat)" "${MIMOCODE_DISABLE_CLAUDE_IMPORT:-}" "${XDG_DATA_HOME:-}"
SH
  printf '#!/bin/sh\n[ "$1" = export ] && { [ -e "$XDG_DATA_HOME/$3" ] && : > "$5" && exit 0; echo "no retained session log found for session $3" >&2; exit 1; }\nprintf "%%s probe=%%s stdin=%%s data=%%s\\n" "$*" "${PROBE:-}" "$(cat)" "${XDG_DATA_HOME:-}"\n' > "$tmp/bin/muse" && chmod +x "$tmp/bin/muse"
  [ -x "$tmp/bin/claude" ] && [ -x "$tmp/bin/pi" ] && [ -x "$tmp/bin/codex" ] && [ -x "$tmp/bin/muse" ] \
    || { echo "self-test: cannot write the stub harnesses"; exit 1; }
  printf 'Continue.\n' > "$tmp/prompt.txt"
  fixture() {  # fixture <name> [<key>...]; each key in [team.coachman_legs] runs on <key>-model
    local name=$1 k; shift
    { printf '[lanes.one]\nharness = "claude"\nmodel = "lane-model"\n\n[team]\n'
      printf 'coachman = { harness = "claude", model = "coach-model" }\n'
      printf 'coachman_fallback = { harness = "claude", model = "fallback-model" }\n\n[team.coachman_legs]\n'
      for k in "$@"; do printf '%s = { harness = "claude", model = "%s-model" }\n' "$k" "$k"; done
    } > "$tmp/$name.toml"
  }
  rawfix() {  # rawfix <name> <[team.coachman_legs] body, \n-separated>
    fixture "$1"; printf '%b' "$2" >> "$tmp/$1.toml"
  }
  # The codex forms: a codex stub that prints the directory it runs in and then each argument
  # on its own line, lane one and the coachman on codex, a repo with a branch and a detached
  # worktree of it, and a check on the stub's exact output, since the form is what is tested.
  printf '#!/bin/sh\nprintf "%%s\\n" "$PWD" "$@"\n' > "$tmp/bin/codex" && chmod +x "$tmp/bin/codex"
  codexfix() {  # codexfix <name> <lane one's keys, \n-separated>
    { printf '[lanes.one]\nharness = "codex"\n%b\n\n[team]\n' "$2"
      printf 'coachman = { harness = "codex", model = "coach-model" }\n\n[team.coachman_legs]\n'
      printf 'review = { harness = "codex", model = "review-model", effort = "medium" }\n'
    } > "$tmp/$1.toml"
  }
  codexfix codex 'model = "lane-model"\neffort = "high"'
  codexfix codex-noeffort 'model = "lane-model"'
  codexfix codex-nomodel 'effort = "high"'
  printf -- '- Keep going, then stop.\n' > "$tmp/ruling.txt"
  printf 'Keep going, then stop.\n' > "$tmp/brief.txt"
  git init -q -b main "$tmp/cx" && git -C "$tmp/cx" -c user.name=t -c user.email=t@example.invalid \
    commit -q --allow-empty -m init && git -C "$tmp/cx" worktree add -q --detach "$tmp/cx-detached" \
    || { echo "self-test: cannot make the codex fixture repo"; exit 1; }
  lines() { printf '%s\n' "$@"; }
  runs_as() {  # runs_as <label> <fixture> <the stub's exact output> <args...>
    local label=$1 f=$2 want=$3; shift 3; run "$f" "$@"
    [ $rc -eq 0 ] && [ "$out" = "$want" ] && ok "$label" || fail "$label"
  }
  CODEX_BYPASS=--dangerously-bypass-approvals-and-sandbox
  CODEX_HIGH='model_reasoning_effort="high"'
  fixture legs synthesis review ship
  fixture none
  for k in style bug security; do fixture "old-$k" review "$k"; done
  fixture typo revue
  rawfix onlane 'review = { harness = "claude", model = "lane-model" }\n'
  rawfix notable 'review = "claude"\n'
  rawfix dup 'review = { harness = "claude", model = "a" }\nreview = { harness = "claude", model = "b" }\n'
  rawfix suffix 'review = { harness = "claude", model = "lane-model[1m]" }\n'
  rawfix suffixes 'review = { harness = "claude", model = "lane-model[1m][2m]" }\n'
  mkdir "$tmp/elsewhere"; printf 'PROBE=config-dir\n' > "$tmp/rel.env"; printf 'PROBE=worktree\n' > "$tmp/wt/rel.env"
  : > "$tmp/empty.txt"; printf 'x\n' > "$tmp/unreadable.txt"; chmod 000 "$tmp/unreadable.txt"
  rawfix emptyleg 'synthesis = {}\n'
  head='[lanes.one]\nharness = "claude"\nmodel = "lane-model"\n\n[team]\n'
  printf "$head"'coachman = { harness = "claude", model = "lane-model" }\n' > "$tmp/coachlane.toml"
  printf "$head"'coachman = { harness = "claude", model = "coach-model" }\ncoachman_fallback = { harness = "claude", model = "lane-model" }\n' > "$tmp/fblane.toml"
  printf '[lanes.one]\nharness = "claude"\n\n[team]\ncoachman = { harness = "claude" }\n' > "$tmp/bare.toml"
  printf 'MODEL=lane-model\nHARNESS=nope\nPROBE=reached\n' > "$tmp/over.env"
  printf "$head"'coachman = { harness = "claude", model = "coach-model", env_file = "%s" }\n' "$tmp/over.env" > "$tmp/envfile.toml"
  printf "$head"'coachman = { harness = "claude", model = "coach-model", env_file = "rel.env" }\n' > "$tmp/relenv.toml"
  rawfix edited 'review = { harness = "claude", model = "edited-model" }\n'
  # One lane as dispatched, and as edited since: every field a launch takes differs.
  printf 'PROBE=then\n' > "$tmp/then.env"; printf 'PROBE=now\n' > "$tmp/now.env"
  printf '[lanes.one]\nharness = "claude"\nmodel = "then-model"\neffort = "high"\nenv_file = "%s"\n' "$tmp/then.env" > "$tmp/then.toml"
  printf '[lanes.one]\nharness = "pi"\nmodel = "now-model"\neffort = "low"\nenv_file = "%s"\n' "$tmp/now.env" > "$tmp/now.toml"
  out="" err="" rc=0 fails=0 envx=""
  run() {  # run <fixture> <args...>; $envx is extra environment for the run
    local f=$1; shift
    out=$(env $envx POSTMASTER_CONFIG="$tmp/$f.toml" PATH="$tmp/bin:$PATH" "$self" "$@" 2>"$tmp/err"); rc=$?
    err=$(cat "$tmp/err")
  }
  ok()   { printf '  ok   %s\n' "$1"; }
  fail() { printf '  FAIL %s (exit %s)\n' "$1" "$rc"; printf '%s\n' "$out$err" | sed 's/^/         /'; fails=$((fails+1)); }
  runs_on() {  # runs_on <label> <fixture> <model> <args...>: the printed form runs on <model>
    local label=$1 f=$2 m=$3; shift 3; run "$f" "$@"
    [ $rc -eq 0 ] && case $out in *"--model $m "*) true ;; *) false ;; esac && ok "$label" || fail "$label"
  }
  refused() {  # refused <label> <fixture> <text the message must carry> <args...>
    local label=$1 f=$2 want=$3; shift 3; run "$f" "$@"
    [ $rc -eq 1 ] && [ -z "$out" ] && case $err in *"$want"*) true ;; *) false ;; esac && ok "$label" || fail "$label"
  }
  carries() {  # carries <label> <fixture> <text the output must carry> <args...>
    local label=$1 f=$2 want=$3; shift 3; run "$f" "$@"
    [ $rc -eq 0 ] && case $out in *"$want"*) true ;; *) false ;; esac && ok "$label" || fail "$label"
  }
  lacks() {  # lacks <label> <fixture> <text the output must not carry> <args...>
    local label=$1 f=$2 bad=$3; shift 3; run "$f" "$@"
    [ $rc -eq 0 ] && case $out in *"$bad"*) false ;; *) true ;; esac && ok "$label" || fail "$label"
  }
  printed() {  # printed <label> <text>...: the last run exited 0 and printed every <text>
    local label=$1 t; shift
    for t in "$@"; do case $out in *"$t"*) ;; *) fail "$label"; return ;; esac; done
    [ $rc -eq 0 ] && ok "$label" || fail "$label"
  }
  record() {  # record <run> <fixture>: $tmp/<run>/run.json, recording that fixture as at dispatch
    mkdir -p "$tmp/$1" && POSTMASTER_CONFIG="$tmp/$2.toml" PATH="$tmp/bin:$PATH" \
      "$here/run-meta.sh" "$tmp/$1" "$tmp/repo" >/dev/null \
      || { printf '  FAIL run-meta.sh records %s as run %s\n' "$2" "$1"; fails=$((fails+1)); }
  }
  calls() {  # calls <runbook>...: each launch and resume in them, one per line, marked run or unrun
    python3 - "$@" <<'PY'
import re, sys
CALL = re.compile(r"scripts/launch\.sh\s+(?:launch|resume)\b")
FENCE = re.compile(r"^([ \t]*```.*?^[ \t]*```)", re.S | re.M)
for path in sys.argv[1:]:
    cmds = []
    for i, part in enumerate(FENCE.split(open(path, encoding="utf-8").read())):
        if i % 2:   # a fenced block: a command is its line, once continuations are joined
            cmds += [line[m.start():] for line in re.sub(r"\\\n\s*", " ", part).splitlines()
                     for m in CALL.finditer(line)]
        else:       # prose: a command is an inline code span, which may cross a line break
            cmds += [span[m.start():] for span in re.findall(r"`([^`]+)`", part)
                     for m in CALL.finditer(span)]
    for c in cmds:
        print("%s %s: %s" % ("run" if "--run <dispatch>" in c else "unrun", path, " ".join(c.split())))
PY
  }
  printf '%s\n' 'Fenced, with no --run:' '' '```sh' '( scripts/launch.sh launch a <wt> <prompt-file> \' \
    '    > <dispatch>/logs/a-events.jsonl ) &' '```' '' 'Fenced and indented, with it:' '' '   ```sh' \
    '   ( scripts/launch.sh launch b <wt> <prompt-file> \' '       --run <dispatch> > <dispatch>/logs/b-events.jsonl ) &' \
    '   ```' '' 'Inline, with no --run: `scripts/launch.sh resume c <wt> <thread-id> <prompt-file>`. Inline and' \
    'across a line break, with it: `<tool>/scripts/launch.sh resume d <wt> <thread-id>' '<prompt-file> --run <dispatch>`.' \
    > "$tmp/runbook.md"
  git init -q "$tmp/repo" >/dev/null 2>&1
  record run legs
  record run-then then
  record run-old-bug old-bug
  record run-onlane onlane
  mkdir "$tmp/no-record" "$tmp/garbled" "$tmp/unrecorded"
  printf '{"config": \n' > "$tmp/garbled/run.json"
  printf '{"run": "T-1"}\n' > "$tmp/unrecorded/run.json"

  echo "positive controls"
  for k in synthesis review ship; do
    runs_on "--leg $k runs on its own [team.coachman_legs] entry" legs "$k-model" form coachman --leg "$k"
  done
  runs_on "a leg with no entry runs on team.coachman" none coach-model form coachman --leg review
  runs_on "a lane runs on its own model" legs lane-model form one
  runs_on "a lane launches on a config the coachman refuses" old-bug lane-model form one
  runs_on "a launch with --leg synthesis runs on the synthesis entry" legs synthesis-model launch coachman "$tmp/wt" "$tmp/prompt.txt" --leg synthesis
  runs_on "a resume with --leg review runs on the review entry" legs review-model resume coachman "$tmp/wt" T-1 "$tmp/prompt.txt" --leg review
  runs_as "a codex resume runs in its worktree on its lane's model and effort, streams JSON, writes -o, and passes a prompt that starts with -" codex \
    "$(lines "$tmp/wt" exec resume T-1 --json -o "$tmp/last.md" -m lane-model -c "$CODEX_HIGH" "$CODEX_BYPASS" -- '- Keep going, then stop.')" \
    resume one "$tmp/wt" T-1 "$tmp/ruling.txt" --last "$tmp/last.md"
  runs_as "a codex coachman resumes with --leg review on the review entry's model and effort" codex \
    "$(lines "$tmp/wt" exec resume T-1 --json -m review-model -c 'model_reasoning_effort="medium"' "$CODEX_BYPASS" -- '- Keep going, then stop.')" \
    resume coachman "$tmp/wt" T-1 "$tmp/ruling.txt" --leg review
  envx="HOME=$tmp/home"   # a codex launch marks its worktree trusted in $HOME/.codex
  runs_as "a codex launch on a branch runs with -C and --json, and no --skip-git-repo-check" codex \
    "$(lines "$tmp/cx" exec -C "$tmp/cx" --json -m lane-model -c "$CODEX_HIGH" "$CODEX_BYPASS" 'Keep going, then stop.')" \
    launch one "$tmp/cx" "$tmp/brief.txt"
  runs_as "a codex launch in a detached worktree adds --skip-git-repo-check" codex \
    "$(lines "$tmp/cx-detached" exec -C "$tmp/cx-detached" --json -m lane-model -c "$CODEX_HIGH" "$CODEX_BYPASS" --skip-git-repo-check 'Keep going, then stop.')" \
    launch one "$tmp/cx-detached" "$tmp/brief.txt"
  envx=""
  runs_as "form shows the codex launch and resume" codex \
    "$(lines "launch: cd <cwd> && codex exec -C <cwd> --json -m lane-model -c model_reasoning_effort=\\\"high\\\" $CODEX_BYPASS \$(cat <prompt-file>) " \
             "resume: cd <cwd> && codex exec resume <thread-id> --json -m lane-model -c model_reasoning_effort=\\\"high\\\" $CODEX_BYPASS -- \$(cat <prompt-file>) ")" \
    form one
  runs_on "the fallback resumes on its own model, with no --leg" legs fallback-model resume coachman_fallback "$tmp/wt" T-1 "$tmp/prompt.txt"
  runs_on "form with no --leg shows team.coachman" legs coach-model form coachman
  carries "a lane's env file reaches the harness's environment" envfile "probe=reached" launch coachman "$tmp/wt" "$tmp/prompt.txt" --leg review
  runs_on "inside a run, a resume runs on the model the run recorded, not the live config's" edited review-model resume coachman "$tmp/wt" T-1 "$tmp/prompt.txt" --leg review --run "$tmp/run"
  runs_on "outside a run, the same resume runs on the live config's model" edited edited-model resume coachman "$tmp/wt" T-1 "$tmp/prompt.txt" --leg review
  run now resume one "$tmp/wt" T-1 "$tmp/prompt.txt" --run "$tmp/run-then"
  printed "inside a run, a lane resumes on the harness, model, effort and env file the run recorded" "--resume T-1 " "--model then-model " "--effort high " "probe=then"
  run now resume one "$tmp/wt" T-1 "$tmp/prompt.txt"
  printed "outside a run, the same resume takes all four from the live config" "--mode json " "--session T-1 " "--model now-model " "--thinking low " "probe=now"
  runs_on "inside a run the live config is not read: with none at all, a launch runs on the recorded model" nowhere synthesis-model launch coachman "$tmp/wt" "$tmp/prompt.txt" --leg synthesis --run "$tmp/run"
  out=$(calls "$tmp/runbook.md"); rc=$?; err=""
  got=$(printf '%s\n' "$out" | sed -E 's/^([a-z]+) .*launch\.sh (launch|resume) ([a-z]) .*/\1 \3/' | tr '\n' ,)
  [ "$got" = "unrun a,run b,unrun c,run d," ] && ok "a runbook launch or resume with no --run is found, fenced or inline" \
    || fail "a runbook launch or resume with no --run is found, fenced or inline"

  echo "negative controls"
  for k in style bug security; do
    refused "a config naming $k is refused, and the message names review" "old-$k" "one leg now, review" form coachman --leg review
  done
  refused "a key that is no leg is refused" typo "no such leg: revue" form coachman --leg review
  refused "a leg entry on a lane's model is refused" onlane "a lane's model" form coachman --leg synthesis
  refused "a leg entry that is not a table is refused" notable "is not a table" form coachman --leg synthesis
  envx="HARNESS=claude MODEL=env-model"
  refused "a config that does not parse is refused, and the environment's HARNESS and MODEL go unused" dup "cannot read" launch one "$tmp/wt" "$tmp/prompt.txt"
  envx=""
  refused "a parse error names the file and where it breaks" dup "launch: cannot read $tmp/dup.toml: " form coachman --leg review
  refused "a leg entry on a lane's model with a bracketed suffix is refused" suffix "a lane's model" form coachman --leg synthesis
  refused "team.coachman on a lane's model is refused" coachlane "a lane's model" form coachman --leg synthesis
  refused "the fallback on a lane's model is refused" fblane "a lane's model" form coachman_fallback
  refused "a leg entry with no harness or model is refused" emptyleg "needs a harness and a model" form coachman --leg synthesis
  refused "a coachman with no model is refused by name" bare "coachman has no model" form coachman --leg review
  runs_on "an env file cannot put the coachman on another model" envfile coach-model launch coachman "$tmp/wt" "$tmp/prompt.txt" --leg review
  envx="STDIN_FILE=$tmp/prompt.txt"
  lacks "a STDIN_FILE from the environment is not used" legs "< " form one
  refused "a leg entry on a lane's model with stacked suffixes is refused" suffixes "a lane's model" form coachman --leg synthesis
  cd "$tmp/elsewhere" || exit 1
  carries "a relative env file is read from the config's directory, never the worktree" relenv "probe=config-dir" launch coachman "$tmp/wt" "$tmp/prompt.txt" --leg review
  cd - >/dev/null || exit 1
  refused "an empty prompt file is refused, and nothing runs" legs "prompt file missing, unreadable or empty" launch one "$tmp/wt" "$tmp/empty.txt"
  if [ -r "$tmp/unreadable.txt" ]; then
    printf '  ok   %s\n' "an unreadable prompt file is refused (skipped: this user reads every file)"
  else
    refused "an unreadable prompt file is refused, and nothing runs" legs "prompt file missing, unreadable or empty" launch one "$tmp/wt" "$tmp/unreadable.txt"
  fi
  envx=""
  refused "a resume with no thread id is refused, and nothing runs" legs "launch: resume needs a thread id" resume one "$tmp/wt" "" "$tmp/prompt.txt"
  refused "an argument launch.sh does not know is refused" legs "launch needs <cwd> <prompt-file>" launch one "$tmp/wt" "$tmp/prompt.txt" --leg=review
  for k in style bug security; do
    refused "--leg $k is refused" legs "no such leg: --leg $k" form coachman --leg "$k"
  done
  refused "a codex lane with no model is refused, and nothing resumes on codex's default" codex-nomodel "has no model" resume one "$tmp/wt" T-1 "$tmp/prompt.txt"
  runs_as "a codex resume with no effort and no --last passes neither -c nor -o" codex-noeffort \
    "$(lines "$tmp/wt" exec resume T-1 --json -m lane-model "$CODEX_BYPASS" -- '- Keep going, then stop.')" \
    resume one "$tmp/wt" T-1 "$tmp/ruling.txt"
  refused "resuming the coachman with no --leg is refused, and nothing runs" legs "coachman needs --leg" resume coachman "$tmp/wt" T-1 "$tmp/prompt.txt"
  refused "launching the coachman with no --leg is refused, and nothing runs" legs "coachman needs --leg" launch coachman "$tmp/wt" "$tmp/prompt.txt"
  refused "inside a run with no run.json, a resume is refused though the live config would serve, and nothing runs" legs "no run.json in $tmp/no-record" resume coachman "$tmp/wt" T-1 "$tmp/prompt.txt" --leg review --run "$tmp/no-record"
  refused "inside a run whose run.json does not parse, a launch is refused, and nothing runs" legs "cannot read $tmp/garbled/run.json" launch one "$tmp/wt" "$tmp/prompt.txt" --run "$tmp/garbled"
  refused "a run.json that records no config is refused" legs "it records no config" launch one "$tmp/wt" "$tmp/prompt.txt" --run "$tmp/unrecorded"
  refused "an empty --run is refused, never read as outside a run" legs "--run needs a dispatch directory" resume coachman "$tmp/wt" T-1 "$tmp/prompt.txt" --leg review --run ""
  refused "a recorded config naming bug is refused, though the live config passes" legs "one leg now, review" resume coachman "$tmp/wt" T-1 "$tmp/prompt.txt" --leg review --run "$tmp/run-old-bug"
  refused "a recorded leg on a lane's model is refused, though the live config passes" legs "a lane's model" resume coachman "$tmp/wt" T-1 "$tmp/prompt.txt" --leg synthesis --run "$tmp/run-onlane"
  got=$(calls "$here/../skills/postmaster/coachman.md" "$here/../skills/postmaster/postmaster.md"); rc=$?
  out=$(printf '%s\n' "$got" | grep '^unrun '); err=""
  [ $rc -eq 0 ] && [ -z "$out" ] && printf '%s\n' "$got" | grep -q '^run .*/coachman\.md: ' \
    && printf '%s\n' "$got" | grep -q '^run .*/postmaster\.md: ' \
    && ok "no launch or resume in coachman.md or postmaster.md lacks --run <dispatch>" \
    || fail "no launch or resume in coachman.md or postmaster.md lacks --run <dispatch>"

  echo "muse"
  printf '[lanes.m]\nharness = "muse"\nmodel = "muse-model"\neffort = "max"\nenv_file = "%s"\n\n[lanes.n]\nharness = "muse"\nmodel = "muse-model"\n\n[team]\ncoachman = { harness = "muse", model = "coach-muse" }\ncoachman_fallback = { harness = "claude", model = "fallback-model" }\n' "$tmp/over.env" > "$tmp/muse.toml"
  printf '[lanes.m]\nharness = "muse"\nmodel = "muse-model"\n' > "$tmp/muse-bare.toml"
  mkdir -p "$tmp/wt/sub" && cp "$tmp/prompt.txt" "$tmp/wt/sub/p.txt"
  hd=$tmp/harness-data
  mrun() {  # mrun <fixture> <args...>: the harness data root in the test's own folder, stdin a pipe that carries a line
    local f=$1; shift
    out=$(printf 'leak\n' | env POSTMASTER_HARNESS_DATA="$hd" POSTMASTER_CONFIG="$tmp/$f.toml" PATH="$tmp/bin:$PATH" "$self" "$@" 2>"$tmp/err"); rc=$?
    err=$(cat "$tmp/err")
  }
  data_of() { printf '%s\n' "$out" | sed -n 's/.* data=//p'; }
  mrefused() {  # mrefused <label> <fixture> <text the message must carry> <args...>: refused under mrun
    local label=$1 f=$2 want=$3; shift 3; mrun "$f" "$@"
    [ $rc -eq 1 ] && [ -z "$out" ] && case $err in *"$want"*) true ;; *) false ;; esac && ok "$label" || fail "$label"
  }
  mrun muse launch m "$tmp/wt" "$tmp/prompt.txt"; a=$(data_of)
  [ $rc -eq 0 ] && [ "$out" = "exec --json --prompt-file $tmp/prompt.txt --model muse-model --reasoning-effort max --yolo probe=reached stdin= data=$a" ] \
    && case $a in "$hd"/muse/?*) true ;; *) false ;; esac && [ -d "$a" ] \
    && ok "a muse launch: JSON events, the prompt file, model, effort, bypass form and env file, nothing on stdin, and its own data directory" \
    || fail "a muse launch: JSON events, the prompt file, model, effort, bypass form and env file, nothing on stdin, and its own data directory"
  : > "$a/01a0-sess"   # the launch's thread, in its data directory
  mrun muse resume m "$tmp/wt" 01a0-sess "$tmp/prompt.txt"; b=$(data_of)
  [ $rc -eq 0 ] && case $out in "exec --json --prompt-file $tmp/prompt.txt --session-id 01a0-sess --model muse-model --reasoning-effort max --yolo "*) true ;; *) false ;; esac \
    && [ "$b" = "$a" ] && ok "a muse resume names the session, keeps the model and effort, and finds the launch's data directory" \
    || fail "a muse resume names the session, keeps the model and effort, and finds the launch's data directory"
  mrun muse launch n "$tmp/wt" "$tmp/prompt.txt"; c=$(data_of)
  mrun muse launch coachman "$tmp/wt" "$tmp/prompt.txt" --leg synthesis; d=$(data_of)
  mrun muse launch coachman "$tmp/wt" "$tmp/prompt.txt" --leg review; e=$(data_of)
  mrun muse launch m "$tmp/elsewhere" "$tmp/prompt.txt"; f=$(data_of)
  [ -n "$c" ] && [ -n "$d" ] && [ -n "$e" ] && [ -n "$f" ] && [ "$(printf '%s\n' "$a" "$c" "$d" "$e" "$f" | sort -u | wc -l | tr -d ' ')" -eq 5 ] \
    && ok "another lane, each coachman leg, and the same lane elsewhere each get a data directory of their own" \
    || fail "another lane, each coachman leg, and the same lane elsewhere each get a data directory of their own"
  out=$(cd "$tmp/wt" && env POSTMASTER_HARNESS_DATA="$hd" POSTMASTER_CONFIG="$tmp/muse-bare.toml" PATH="$tmp/bin:$PATH" "$self" launch m "$tmp/elsewhere" sub/p.txt 2>"$tmp/err" </dev/null); rc=$?; err=$(cat "$tmp/err")
  [ $rc -eq 0 ] && case $out in "exec --json --prompt-file $tmp/wt/sub/p.txt --model muse-model --yolo "*) true ;; *) false ;; esac \
    && ok "a relative prompt file is made absolute before the cd, and no effort means no effort flag" \
    || fail "a relative prompt file is made absolute before the cd, and no effort means no effort flag"
  carries "the muse form shows its data directory, the bypass form and an empty stdin" muse \
    "env XDG_DATA_HOME=<harness-data>/muse/<key> muse exec --json --prompt-file <prompt-file> --model muse-model --reasoning-effort max --yolo < /dev/null" form m
  mrefused "a muse resume of a thread its data directory does not hold is refused, and nothing runs" muse \
    "no muse thread 01a0-none in this launch's data directory" resume m "$tmp/wt" 01a0-none "$tmp/prompt.txt"
  mrefused "a muse resume from another directory is refused: the thread is in its launch's data directory" muse \
    "no muse thread 01a0-sess in this launch's data directory" resume m "$tmp/elsewhere" 01a0-sess "$tmp/prompt.txt"
  : > "$d/01a0-coach"   # the synthesis leg's thread
  mrun muse resume coachman "$tmp/wt" 01a0-coach "$tmp/prompt.txt" --leg synthesis
  [ $rc -eq 0 ] && [ "$(data_of)" = "$d" ] && ok "a muse coachman resumes its thread on the leg it was launched on" \
    || fail "a muse coachman resumes its thread on the leg it was launched on"
  mrefused "a muse coachman resumed on another leg is refused, and nothing runs" muse \
    "no muse thread 01a0-coach in this launch's data directory" resume coachman "$tmp/wt" 01a0-coach "$tmp/prompt.txt" --leg review

  echo "mimo"
  printf '[lanes.x]\nharness = "mimo"\nmodel = "prov/mimo-model"\neffort = "high"\nenv_file = "%s"\n\n[lanes.y]\nharness = "mimo"\nmodel = "prov/mimo-model"\n' "$tmp/over.env" > "$tmp/mimo.toml"
  printf '[lanes.x]\nharness = "mimo"\nmodel = "prov/mimo-model"\n' > "$tmp/mimo-bare.toml"
  mrun mimo launch x "$tmp/wt" "$tmp/prompt.txt"; a=$(data_of)
  [ $rc -eq 0 ] && [ "$out" = "run --format json -m prov/mimo-model --variant high --dangerously-skip-permissions probe=reached stdin=Continue. import-off=1 data=$a" ] \
    && case $a in "$hd"/mimo/?*) true ;; *) false ;; esac && [ -d "$a" ] \
    && ok "a mimo launch: JSON events, model, variant, bypass form, env file, the prompt on stdin, its own data directory, and no history import" \
    || fail "a mimo launch: JSON events, model, variant, bypass form, env file, the prompt on stdin, its own data directory, and no history import"
  : > "$a/ses_01a0"   # the launch's thread, in its data directory
  mrun mimo resume x "$tmp/wt" ses_01a0 "$tmp/prompt.txt"; b=$(data_of)
  [ $rc -eq 0 ] && case $out in "run --format json -m prov/mimo-model -s ses_01a0 --variant high --dangerously-skip-permissions probe=reached stdin=Continue. "*) true ;; *) false ;; esac \
    && [ "$b" = "$a" ] && ok "a mimo resume names the session, keeps the model and the variant, and finds the launch's data directory" \
    || fail "a mimo resume names the session, keeps the model and the variant, and finds the launch's data directory"
  mrun mimo launch y "$tmp/wt" "$tmp/prompt.txt"; c=$(data_of)
  [ -n "$c" ] && [ "$c" != "$a" ] && ok "another mimo lane in the same directory gets a data directory of its own" \
    || fail "another mimo lane in the same directory gets a data directory of its own"
  out=$(cd "$tmp/wt" && env POSTMASTER_HARNESS_DATA="$hd" POSTMASTER_LAUNCH_NAME="#7, a run" POSTMASTER_CONFIG="$tmp/mimo-bare.toml" PATH="$tmp/bin:$PATH" "$self" launch x "$tmp/elsewhere" sub/p.txt 2>"$tmp/err" </dev/null); rc=$?; err=$(cat "$tmp/err")
  [ $rc -eq 0 ] && case $out in "run --format json -m prov/mimo-model --title #7, a run --dangerously-skip-permissions probe= stdin=Continue. "*) true ;; *) false ;; esac \
    && ok "a relative prompt file is read after the cd, no effort means no variant, and a launch is titled after its run" \
    || fail "a relative prompt file is read after the cd, no effort means no variant, and a launch is titled after its run"
  carries "the mimo form shows its data directory, the import switch and the prompt file on stdin" mimo \
    "env XDG_DATA_HOME=<harness-data>/mimo/<key> MIMOCODE_DISABLE_CLAUDE_IMPORT=1 mimo run --format json -m prov/mimo-model --variant high --dangerously-skip-permissions < <prompt-file>" form x
  run mimo skill x security-review
  [ $rc -eq 3 ] && [ -z "$out" ] && ok "a mimo lane has no security review skill: exit 3" || fail "a mimo lane has no security review skill: exit 3"
  mrefused "a mimo resume of a thread its data directory does not hold is refused, and nothing runs" mimo \
    "no mimo thread ses_none in this launch's data directory" resume x "$tmp/wt" ses_none "$tmp/prompt.txt"
  mrefused "a mimo resume from another directory is refused: the thread is in its launch's data directory" mimo \
    "no mimo thread ses_01a0 in this launch's data directory" resume x "$tmp/elsewhere" ses_01a0 "$tmp/prompt.txt"

  echo "the coachman on muse, a workhorse on mimo: both forms, each with its bypass flag"
  printf '[lanes.w]\nharness = "mimo"\nmodel = "prov/mimo-model"\neffort = "low"\n\n[lanes.v]\nharness = "claude"\nmodel = "lane-model"\n\n[team]\nworkhorses = ["w", "v"]\ncoachman = { harness = "muse", model = "coach-muse", effort = "max" }\n' > "$tmp/team.toml"
  # Copies of this script with each bypass flag gone, and with it gone from resumes only.
  sed -e 's/cmd+=(--yolo)/cmd+=()/' -e 's/cmd+=(--dangerously-skip-permissions)$/cmd+=()/' "$self" > "$tmp/nobypass.sh"
  sed -e 's/cmd+=(--yolo)/[ "$CMD" = resume ] || cmd+=(--yolo)/' \
    -e 's/cmd+=(--dangerously-skip-permissions)$/[ "$CMD" = resume ] || cmd+=(--dangerously-skip-permissions)/' "$self" > "$tmp/launchonly.sh"
  chmod +x "$tmp/nobypass.sh" "$tmp/launchonly.sh"
  bypassed() {  # bypassed <script> <flag> <form args...>: exit 0, and a launch line and a resume line each carry <flag>
    local script=$1 flag=$2 l n=0; shift 2
    out=$(POSTMASTER_CONFIG="$tmp/team.toml" PATH="$tmp/bin:$PATH" "$script" form "$@" 2>&1); rc=$?
    while IFS= read -r l; do
      case $l in launch:*|resume:*) case "$l " in *" $flag "*) n=$((n+1)) ;; esac ;; esac
    done <<< "$out"
    [ $rc -eq 0 ] && [ $n -eq 2 ]
  }
  for f in "coachman --yolo --leg review" "w --dangerously-skip-permissions"; do
    set -- $f; name=$1 flag=$2; shift 2
    bypassed "$self" "$flag" "$name" "$@" && ok "$name: the launch and resume forms both carry $flag" \
      || fail "$name: the launch and resume forms both carry $flag"
    printf '%s\n' "$out" | sed 's/^/         /'
    bypassed "$tmp/nobypass.sh" "$flag" "$name" "$@" && fail "$name: a form without $flag fails this check" \
      || ok "$name: a form without $flag fails this check"
    bypassed "$tmp/launchonly.sh" "$flag" "$name" "$@" && fail "$name: a resume form without $flag fails this check" \
      || ok "$name: a resume form without $flag fails this check"
  done
  run legs form one
  printed "a claude lane's form shows a resume form too" "launch: cd <cwd> && claude -p " "resume: cd <cwd> && claude -p --resume <thread-id> "
  printf '[lanes.g]\nharness = "agy"\nmodel = "agy-model"\n' > "$tmp/agy.toml"; printf '#!/bin/sh\n' > "$tmp/bin/agy"; chmod +x "$tmp/bin/agy"
  run agy form g
  printed "an agy lane's form says it has no resume form, and still exits 0" "launch: cd <cwd> && agy -p " "resume: none: agy resume form is not recorded"

  echo "skills"
  printf '[lanes.one]\nharness = "claude"\nmodel = "lane-model"\n\n[lanes.two]\nharness = "codex"\nmodel = "other-model"\n\n[lanes.three]\nharness = "muse"\nmodel = "muse-model"\n' > "$tmp/skills.toml"
  run skills skill one security-review
  [ $rc -eq 0 ] && [ "$out" = /security-review ] && ok "a claude lane's security review skill is /security-review" || fail "a claude lane's security review skill is /security-review"
  run skills skill two security-review
  [ $rc -eq 3 ] && [ -z "$out" ] && case $err in *"no security review skill"*) true ;; *) false ;; esac \
    && ok "a harness with no security review skill is exit 3, never a prompt" || fail "a harness with no security review skill is exit 3, never a prompt"
  refused "a skill that is not recorded is refused" skills "no such skill: code-review" skill one code-review
  run skills skill three security-review
  [ $rc -eq 3 ] && [ -z "$out" ] && ok "a muse lane has no security review skill: exit 3" || fail "a muse lane has no security review skill: exit 3"

  echo "live agents (host.live_agents), on a stub Herdr and scratch harness configs"
  # Live controls run with HOME and every harness config dir in scratch, so no control can write a
  # config of the user's; the stub Herdr answers for a server and reads no live one.
  mkdir -p "$tmp/stub" "$tmp/home" "$tmp/cc/hooks" "$tmp/cc-bare" "$tmp/pa/extensions"
  "$(dirname "$self")/host.sh" _stubs "$tmp/bin" || exit 1   # first on PATH in every run
  mkdir -p "$tmp/home/.gemini/config/hooks"; : > "$tmp/home/.gemini/config/hooks/herdr-agent-state.sh"
  : > "$tmp/cc/hooks/herdr-agent-state.sh"; : > "$tmp/pa/extensions/herdr-agent-state.ts"
  printf 'CLAUDE_CONFIG_DIR=%s\n' "$tmp/cc" > "$tmp/cc.env"; printf 'CLAUDE_CONFIG_DIR=%s\n' "$tmp/cc-bare" > "$tmp/cc-bare.env"
  printf 'PI_CODING_AGENT_DIR=%s\n' "$tmp/pa" > "$tmp/pa.env"; printf 'CODEX_HOME=%s\n' "$tmp/cx-home" > "$tmp/cx.env"
  printf '#!/bin/sh\nexit 0\n' > "$tmp/bin/pi"; printf '#!/bin/sh\nexit 0\n' > "$tmp/bin/agy"; chmod +x "$tmp/bin/pi" "$tmp/bin/agy"
  git init -q -b main "$tmp/repo" && git -C "$tmp/repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m first \
    && git -C "$tmp/repo" worktree add -q .worktrees/T-1-one -b T-1-one || exit 1
  repo=$(cd "$tmp/repo" && pwd -P); lwt=$repo/.worktrees/T-1-one
  livefix() {  # livefix <name> <live_agents value> [<env file>]: the legs fixture, one lane on <env file>
    local e=${3:-$tmp/cc.env}
    { printf '[lanes.one]\nharness = "claude"\nmodel = "lane-model"\nenv_file = "%s"\n\n' "$e"
      printf '[lanes.two]\nharness = "pi"\nmodel = "pi-model"\nenv_file = "%s"\n\n' "$tmp/pa.env"
      printf '[lanes.three]\nharness = "agy"\nmodel = "agy-model"\n\n'
      printf '[lanes.four]\nharness = "mimo"\nmodel = "prov/mimo-model"\neffort = "high"\n\n[lanes.five]\nharness = "muse"\nmodel = "muse-model"\n\n'
      printf '[lanes.six]\nharness = "codex"\nmodel = "codex-model"\neffort = "high"\nenv_file = "%s"\n\n[team]\n' "$tmp/cx.env"
      printf 'coachman = { harness = "claude", model = "coach-model", env_file = "%s" }\n' "$tmp/cc.env"
      printf 'coachman_fallback = { harness = "claude", model = "fallback-model" }\n'
      printf 'postmaster = { harness = "claude", model = "boss-model" }\n\n[team.coachman_legs]\n'
      printf 'ship = { harness = "claude", model = "ship-model", env_file = "%s" }\n' "$tmp/cc.env"
      [ -n "$2" ] && printf '\n[host]\nlive_agents = %s\n' "$2"
    } > "$tmp/$1.toml"
  }
  livefix nokey ""; livefix off false; livefix on true; livefix onbare true "$tmp/cc-bare.env"; livefix notbool '"yes"'
  envx="HOME=$tmp/home STUB=$tmp/stub"
  same=1
  for f in "form one" "form two" "form coachman" "form coachman --leg synthesis" "form coachman --leg ship" \
           "form coachman_fallback" "form postmaster" "launch one $tmp/wt $tmp/prompt.txt" \
           "resume coachman $tmp/wt T-1 $tmp/prompt.txt --leg review"; do
    run nokey $f; a="$rc|$out|$err"; run off $f
    [ "$a" = "$rc|$out|$err" ] && [ "$rc" -eq 0 ] || { same=0; printf '         differs: %s\n' "$f"; }
  done
  [ $same -eq 1 ] && ok "key off: every form, launch and resume is byte for byte what it is with no key" \
    || { rc=-; fail "key off: every form, launch and resume is byte for byte what it is with no key"; }
  carries "key on: a lane's form is its live form, bypass flag and all" on \
    "herdr agent start <agent> --kind claude --pane <pane> -- --model lane-model --dangerously-skip-permissions" form one
  carries "and the coachman's is its leg's own entry" on "-- --model ship-model --dangerously-skip-permissions" form coachman --leg ship
  runs_on "the postmaster keeps its own form: it is never a live lane" on boss-model form postmaster
  runs_on "launch and resume stay headless whatever the key says" on lane-model launch one "$tmp/wt" "$tmp/prompt.txt"
  lacks "and the headless form is -p, never the live one" on "herdr agent start" launch one "$tmp/wt" "$tmp/prompt.txt"
  envx="$envx POSTMASTER_HOST=none"
  refused "key on, and no Herdr: refused" on "need Herdr" form one
  envx="HOME=$tmp/home STUB=$tmp/stub"
  refused "key on, and the harness's integration missing from its config dir: refused, naming the command" onbare \
    "CLAUDE_CONFIG_DIR=$tmp/cc-bare herdr integration install claude" form one
  refused "a key that is not true or false is refused" notbool "must be true or false" form one
  carries "codex runs live on its own signal, with no integration: its form keeps its thread in its pane, and bypasses" on \
    "herdr agent start <agent> --kind codex --pane <pane> -- -m codex-model -c model_reasoning_effort=\\\"high\\\" --no-daemon --dangerously-bypass-approvals-and-sandbox; finish: signal file" form six
  carries "and resumes its thread by id" on "resume: herdr agent start <agent> --kind codex --pane <pane> -- resume <thread-id> -m codex-model" form six
  carries "muse runs live on its own signal, in its launch's own data directory" on \
    "herdr agent start <agent> --kind muse --pane <pane> -- --model muse-model --yolo; pane env XDG_DATA_HOME=<harness-data>/muse/<key>; finish: signal file" form five
  carries "and resumes its session by id" on "resume: herdr agent start <agent> --kind muse --pane <pane> -- resume <thread-id> --model muse-model --yolo" form five
  carries "MiMo, which Herdr has no kind for, is typed into its pane, bypassed by its variable, ready once it titles its terminal" on \
    'launch: herdr pane run <pane> "mimo -m prov/mimo-model --trust"; pane env XDG_DATA_HOME=<harness-data>/mimo/<key> XDG_STATE_HOME=<harness-data>/mimo/<key>/state MIMOCODE_DISABLE_CLAUDE_IMPORT=1 MIMOCODE_DANGEROUSLY_SKIP_PERMISSIONS=1; ready: title ^(MiMoCode|MC \|); finish: signal file' form four
  lacks "and never with the bypass flag, which asks a question on a terminal" on "--dangerously-skip-permissions" form four
  carries "and resumes its session with -s" on 'resume: herdr pane run <pane> "mimo -m prov/mimo-model -s <thread-id> --trust"' form four
  lacks "a lane on its own signal needs no Herdr integration, so none is looked for" onbare "integration install" form six
  field() { printf '%s' "$out" | python3 -c 'import json, sys; f = json.load(sys.stdin); v = eval(sys.argv[1]); print(" ".join(v) if isinstance(v, list) else v)' "$1"; }
  run on live four "$lwt"; mdata=$(field '[e.split("=", 1)[1] for e in f["env"] if e.startswith("XDG_DATA_HOME=")]')
  [ $rc -eq 0 ] && [ "$(field 'f["kind"]')|$(field 'f["typed"]')|$(field 'f["signal"]')|$(field 'f["args"]')" = "|mimo|True|-m prov/mimo-model --trust" ] \
    && [ "$(field 'f["env"]')" = "XDG_DATA_HOME=$mdata XDG_STATE_HOME=$mdata/state MIMOCODE_DISABLE_CLAUDE_IMPORT=1 MIMOCODE_DANGEROUSLY_SKIP_PERMISSIONS=1" ] \
    && case $mdata in "$tmp/home/.postmaster/harness-data/mimo/"?*) true ;; *) false ;; esac \
    && ok "live, for MiMo: the command to type, the title it is ready at, its variables, and that it signals" \
    || fail "live, for MiMo: the command to type, the title it is ready at, its variables, and that it signals"
  python3 -c 'import json, sys; sys.exit(0 if json.load(open(sys.argv[1]))["variant"] == {"prov/mimo-model": "high"} else 1)' \
    "$mdata/state/mimocode/model.json" 2>/dev/null && ok "and puts the lane's effort where MiMo's interface reads its variant, in the launch's own state" \
    || fail "and puts the lane's effort where MiMo's interface reads its variant, in the launch's own state"
  run on live six "$lwt"
  [ $rc -eq 0 ] && [ "$(field 'f["signal"]')" = True ] && grep -qxF "[projects.\"$lwt\"]" "$tmp/cx-home/config.toml" \
    && ok "live, for codex: it signals, and its directory is trusted in the config dir its env file names" \
    || fail "live, for codex: it signals, and its directory is trusted in the config dir its env file names"
  run on live six "$lwt"
  [ "$(grep -cxF "[projects.\"$lwt\"]" "$tmp/cx-home/config.toml")" = 1 ] && ok "and trusted once, however often it starts" \
    || fail "and trusted once, however often it starts"
  run on live five "$lwt"; udata=$(field '[e.split("=", 1)[1] for e in f["env"] if e.startswith("XDG_DATA_HOME=")]')
  [ $rc -eq 0 ] && [ -d "$udata" ] && ok "live, for muse: its launch's data directory is made" || fail "live, for muse: its launch's data directory is made"
  refused "a live muse resume of a thread its data directory does not hold is refused" on \
    "no muse thread 01a0-none in this launch's data directory" live five "$lwt" --resume 01a0-none
  : > "$udata/01a0-held"
  carries "and one it holds is resumed" on '"resume", "01a0-held", "--model", "muse-model"' live five "$lwt" --resume 01a0-held
  out=""; run on live one "$lwt"
  [ $rc -eq 0 ] && [ "$(printf '%s' "$out" | python3 -c 'import json, sys; f = json.load(sys.stdin); print(f["kind"], f["env_file"], " ".join(f["args"]))')" \
    = "claude $tmp/cc.env --model lane-model --dangerously-skip-permissions" ] \
    && ok "live prints the kind, the env file and the interactive arguments" || fail "live prints the kind, the env file and the interactive arguments"
  python3 -c 'import json, sys; sys.exit(0 if json.load(open(sys.argv[1]))["projects"][sys.argv[2]]["hasTrustDialogAccepted"] is True else 1)' \
    "$tmp/cc/.claude.json" "$repo" 2>/dev/null && ok "and trusts the worktree's repository in the lane's own claude config" \
    || fail "and trusts the worktree's repository in the lane's own claude config"
  cp "$tmp/cc/.claude.json" "$tmp/claude-before.json"; run on live one "$lwt"
  cmp -s "$tmp/cc/.claude.json" "$tmp/claude-before.json" && ok "a repository trusted already is left as it is" \
    || fail "a repository trusted already is left as it is"
  python3 -c 'import json, sys
d = json.load(open(sys.argv[1])); d["projects"] = {sys.argv[2]: {"hasTrustDialogAccepted": True}}; json.dump(d, open(sys.argv[1], "w"))' \
    "$tmp/cc/.claude.json" "$(dirname "$repo")"
  run on live one "$lwt"
  python3 -c 'import json, sys; sys.exit(0 if json.load(open(sys.argv[1]))["projects"].get(sys.argv[2], {}).get("hasTrustDialogAccepted") is True else 1)' \
    "$tmp/cc/.claude.json" "$repo" 2>/dev/null && ok "in a worktree a trusted folder above the repository counts for nothing: the repository is trusted" \
    || fail "in a worktree a trusted folder above the repository counts for nothing: the repository is trusted"
  # claude's own save: it takes <config>.lock, reads the config, holds on, writes what it read with
  # a change of its own, and lets go, refreshing the lock meanwhile. "unlocked" skips the lock.
  cat > "$tmp/session-save.py" <<'PY'
import json, os, sys, time
path, hold, locked = sys.argv[1], float(sys.argv[2]), sys.argv[3] == "locked"
if locked: os.mkdir(path + ".lock")
cfg = json.load(open(path))
open(path + ".read", "w").close()
end = time.time() + hold
while time.time() < end:
    if locked: os.utime(path + ".lock")
    time.sleep(0.2)
cfg["numStartups"] = 7
with open(path, "w") as f: json.dump(cfg, f, indent=2)
if locked: os.rmdir(path + ".lock")
PY
  trusts() {  # trusts <dir>: the scratch claude config trusts it
    python3 -c 'import json, sys; sys.exit(0 if json.load(open(sys.argv[1]))["projects"].get(sys.argv[2], {}).get("hasTrustDialogAccepted") is True else 1)' \
      "$tmp/cc/.claude.json" "$1" 2>/dev/null
  }
  saving() {  # saving <locked|unlocked>: a session's save under way, its read done
    printf '{"projects": {}}\n' > "$tmp/cc/.claude.json"; rm -f "$tmp/cc/.claude.json.read"
    python3 "$tmp/session-save.py" "$tmp/cc/.claude.json" 1.5 "$1" & spid=$!
    while [ ! -e "$tmp/cc/.claude.json.read" ]; do sleep 0.05; done
  }
  mkdir -p "$tmp/plain-a" "$tmp/plain-b" "$tmp/plain-c" "$tmp/plain-d"
  saving locked; run on live one "$tmp/plain-a"; wait "$spid"
  [ $rc -eq 0 ] && trusts "$(cd "$tmp/plain-a" && pwd -P)" && python3 -c 'import json, sys; sys.exit(json.load(open(sys.argv[1])).get("numStartups") != 7)' "$tmp/cc/.claude.json" \
    && ok "a session holding claude's config lock is waited for: its save and the trust entry both land" \
    || fail "a session holding claude's config lock is waited for: its save and the trust entry both land"
  saving unlocked; run on live one "$tmp/plain-b"; wait "$spid"
  ! trusts "$(cd "$tmp/plain-b" && pwd -P)" && ok "control: a session that skips the lock loses the trust entry in the same race" \
    || fail "control: a session that skips the lock loses the trust entry in the same race"
  printf '{"projects": {}}\n' > "$tmp/cc/.claude.json"; cp "$tmp/cc/.claude.json" "$tmp/claude-before.json"
  mkdir "$tmp/cc/.claude.json.lock"
  ( while [ -d "$tmp/cc/.claude.json.lock" ]; do touch "$tmp/cc/.claude.json.lock" 2>/dev/null; sleep 0.3; done ) & spid=$!
  envx="HOME=$tmp/home STUB=$tmp/stub POSTMASTER_TRUST_LOCK_WAIT=1"; run on live one "$tmp/plain-c"
  envx="HOME=$tmp/home STUB=$tmp/stub"; rmdir "$tmp/cc/.claude.json.lock"; wait "$spid"
  [ $rc -eq 1 ] && case $err in *"stayed locked"*) cmp -s "$tmp/cc/.claude.json" "$tmp/claude-before.json" ;; *) false ;; esac \
    && ok "a lock held past the wait is refused, and nothing is written" || fail "a lock held past the wait is refused, and nothing is written"
  mkdir "$tmp/cc/.claude.json.lock"; touch -d '1 minute ago' "$tmp/cc/.claude.json.lock"; run on live one "$tmp/plain-d"
  [ $rc -eq 0 ] && trusts "$(cd "$tmp/plain-d" && pwd -P)" && [ ! -e "$tmp/cc/.claude.json.lock" ] \
    && ok "a stale lock is taken over, as claude's own sessions take one over" || fail "a stale lock is taken over, as claude's own sessions take one over"
  carries "live resumes a thread in the harness's interactive resume form" on '"--resume", "T-9", "--model"' live one "$lwt" --resume T-9
  carries "pi's live form resumes by session" on '"--session", "P-1", "--model", "pi-model"' live two "$lwt" --resume P-1
  refused "an agy lane cannot be resumed live: its resume form is not recorded" on "agy resume form is not recorded" live three "$lwt" --resume A-1
  refused "--resume belongs to live alone" on "--resume is for live" launch one "$tmp/wt" "$tmp/prompt.txt" --resume T-9
  carries "session: claude's reported id is the thread, kept under its config dir" on \
    "T-9	$tmp/cc/projects/$(printf '%s' "$lwt" | tr -c 'A-Za-z0-9' '-')/T-9.jsonl" session one "$lwt" id T-9
  carries "session: pi's reported path names the thread" on "0199aa00-0000-7000-8000-000000000001	$tmp/pa/sessions/--x--/2026_0199aa00-0000-7000-8000-000000000001.jsonl" \
    session two "$lwt" path "$tmp/pa/sessions/--x--/2026_0199aa00-0000-7000-8000-000000000001.jsonl"
  # Session records in each harness's shape: an earlier turn, then this one's prompt and reply.
  # `turn` prints whether the record holds the prompt, whether its turn has ended, and its final message.
  turned() {  # turned <label> <heard> <ended> <final or -> <name> <record> <offset> [<thread> <since> <prompt>]
    local label=$1 want="$2 $3 $4"; shift 4
    run on turn "$1" "$lwt" "${4:-T}" "$2" "$3" "${5:-0}" "${6:-$tmp/p-turn.txt}"
    [ $rc -eq 0 ] && [ "$(printf '%s' "$out" | python3 -c 'import json, sys; t = json.load(sys.stdin)
print(str(t["heard"]).lower(), str(t["ended"]).lower(), "-" if t["final"] is None else t["final"])')" = "$want" ] && ok "$label" || fail "$label"
  }
  printf 'review it\n' > "$tmp/p-turn.txt"; printf 'something else\n' > "$tmp/p-other.txt"
  { printf '%s\n' '{"type":"user","message":{"role":"user","content":"an earlier turn"}}' \
      '{"type":"assistant","message":{"role":"assistant","stop_reason":"end_turn","content":[{"type":"text","text":"old"}]}}'
  } > "$tmp/cl.jsonl"; off=$(wc -c < "$tmp/cl.jsonl")
  printf '%s\n' '{"type":"user","message":{"role":"user","content":"review it"}}' \
    '{"type":"assistant","message":{"role":"assistant","stop_reason":"tool_use","content":[{"type":"tool_use","name":"Bash"}]}}' \
    '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","content":"ok"}]}}' \
    '{"type":"assistant","message":{"role":"assistant","stop_reason":"end_turn","content":[{"type":"text","text":"P2 a finding"}]}}' >> "$tmp/cl.jsonl"
  cut_last() { head -c "$(( $(wc -c < "$1") - $(tail -1 "$1" | wc -c) ))" "$1" > "$2"; }
  turned "turn: claude's final message is its last entry that ended the turn" true true "P2 a finding" one "$tmp/cl.jsonl" "$off"
  cut_last "$tmp/cl.jsonl" "$tmp/cl-cut.jsonl"
  turned "a claude turn cut off mid-tool has not ended, and an earlier turn's reply is not its message" true false - one "$tmp/cl-cut.jsonl" "$off"
  turned "a record that does not hold the prompt has not heard it" false false - one "$tmp/cl.jsonl" "$off" T 0 "$tmp/p-other.txt"
  printf '%s\n' '{"type":"session","id":"P-1"}' '{"type":"message","message":{"role":"user","content":[{"type":"text","text":"review it"}]}}' \
    '{"type":"message","message":{"role":"assistant","stopReason":"toolUse","content":[]}}' \
    '{"type":"message","message":{"role":"assistant","stopReason":"stop","content":[{"type":"text","text":"clean"}]}}' > "$tmp/pi.jsonl"
  turned "turn: pi's final message is its last assistant message that stopped" true true clean two "$tmp/pi.jsonl" 0
  # codex's rollout: session_meta first; each turn opens at task_started and ends at task_complete.
  cxs=$tmp/cx-home/sessions/2026/09/28; mkdir -p "$cxs"
  rollout() {  # rollout <file> <thread> <cwd> <began, epoch seconds>
    python3 - "$@" <<'PY'
import json, sys
from datetime import datetime, timezone
f, tid, cwd, began = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
ts = datetime.fromtimestamp(began, timezone.utc).isoformat().replace("+00:00", "Z")
ev = lambda t, **k: {"type": "event_msg", "payload": dict(type=t, **k)}
rows = [{"type": "session_meta", "payload": {"id": tid, "timestamp": ts, "cwd": cwd, "originator": "codex-tui"}},
        ev("task_started", turn_id="t1"),
        {"type": "response_item", "payload": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "review it"}]}},
        {"type": "response_item", "payload": {"type": "function_call", "name": "exec_command", "arguments": "{}"}},
        ev("task_complete", turn_id="t1", last_agent_message="codex found it")]
open(f, "w").write("".join(json.dumps(r) + "\n" for r in rows))
PY
  }
  now=$(date +%s)
  rollout "$cxs/rollout-2026-09-28T00-00-01-0199c0de-0000-7000-8000-00000000000a.jsonl" 0199c0de-0000-7000-8000-00000000000a "$lwt" $((now - 3600))
  rollout "$cxs/rollout-2026-09-28T00-00-02-0199c0de-0000-7000-8000-00000000000b.jsonl" 0199c0de-0000-7000-8000-00000000000b "$tmp/elsewhere" "$now"
  rollout "$cxs/rollout-2026-09-28T00-00-03-0199c0de-0000-7000-8000-00000000000c.jsonl" 0199c0de-0000-7000-8000-00000000000c "$lwt" "$now"
  rollout "$cxs/rollout-2026-09-28T00-00-04-0199c0de-0000-7000-8000-00000000000d.jsonl" 0199c0de-0000-7000-8000-00000000000d "$lwt" $((now + 5))
  touch -d '1 hour ago' "$cxs/rollout-2026-09-28T00-00-01-0199c0de-0000-7000-8000-00000000000a.jsonl"
  carries "session records: codex's thread is the first rollout begun in this directory since the agent started" on \
    "0199c0de-0000-7000-8000-00000000000c	$cxs/rollout-2026-09-28T00-00-03-0199c0de-0000-7000-8000-00000000000c.jsonl" session six "$lwt" records $((now - 1))
  run on session six "$lwt" records $((now + 60))
  [ $rc -eq 0 ] && [ "$out" = $'\t' ] && ok "and none, while no rollout has begun since" || fail "and none, while no rollout has begun since"
  cxr=$cxs/rollout-2026-09-28T00-00-03-0199c0de-0000-7000-8000-00000000000c.jsonl
  carries "session: codex's thread by id" on "0199c0de-0000-7000-8000-00000000000c	$cxr" session six "$lwt" id 0199c0de-0000-7000-8000-00000000000c
  turned "turn: codex's final message is its task_complete's" true true "codex found it" six "$cxr" 0
  cut_last "$cxr" "$tmp/cx-cut.jsonl"
  turned "a codex turn with no task_complete has not ended" true false - six "$tmp/cx-cut.jsonl" 0
  # muse's session.jsonl, in the launch's own data directory: a run starts, commits messages, and
  # ends at its terminal event; some records sit inside a transaction's children.
  uuid7() { python3 -c 'import sys; ms = int(float(sys.argv[1]) * 1000); h = "%012x" % ms; print("%s-%s-7000-8000-%012x" % (h[:8], h[8:], int(sys.argv[2])))' "$@"; }
  muse_session() {  # muse_session <thread> [cut]
    local dir=$udata/muse/sessions/2026/09/28/$1; mkdir -p "$dir"
    python3 - "$dir/session.jsonl" "$1" "${2:-}" <<'PY'
import json, sys
f, sid, cut = sys.argv[1], sys.argv[2], sys.argv[3] == "cut"
def rec(event): return {"stream": {"kind": "session", "id": sid}, "payload_type": "runtime.session", "payload": {"kind": "run", "event": event}}
rows = [{"retained_frame": "t", "children": [{"record_json": json.dumps(rec({"kind": "started", "prompt": "review it"}))}]},
        rec({"kind": "assistant_message_committed", "text": "looking"}),
        rec({"kind": "assistant_message_committed", "text": "muse found it"})]
if not cut: rows.append(rec({"kind": "terminal", "terminal": "completed"}))
open(f, "w").write("".join(json.dumps(r) + "\n" for r in rows))
PY
    printf '%s\n' "$dir/session.jsonl"
  }
  mold=$(uuid7 $((now - 3600)) 1); mnew=$(uuid7 "$now" 2); mcut=$(uuid7 $((now + 5)) 3)
  muse_session "$mold" >/dev/null; mrec=$(muse_session "$mnew"); mcutrec=$(muse_session "$mcut" cut)
  carries "session records: muse's thread is the first session begun in the launch's data directory since the agent started" on \
    "$mnew	$mrec" session five "$lwt" records $((now - 1))
  carries "session: muse's thread by id" on "$mnew	$mrec" session five "$lwt" id "$mnew"
  turned "turn: muse's final message is the last it committed before its run's terminal event" true true "muse found it" five "$mrec" 0
  turned "a muse run with no terminal event has not ended" true false - five "$mcutrec" 0
  # MiMo's own export, read through it: the stub prints the file of that name in its data directory.
  mimo_export() {  # mimo_export <thread> <last finish>
    python3 - "$mdata/$1" "$1" "$2" "$now" <<'PY'
import json, sys
f, sid, finish, now = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) * 1000
msg = lambda role, created, parts, **info: {"info": dict(role=role, time=dict(created=created, **({"completed": created + 1} if role == "assistant" else {})), **info),
                                           "parts": [{"type": "text", "text": t} for t in parts]}
json.dump({"info": {"id": sid}, "messages": [msg("user", now - 7200000, ["an earlier turn"]), msg("assistant", now - 7199000, ["old"], finish="stop"),
                                             msg("user", now, ["review it"]), msg("assistant", now + 10, [], finish="tool-calls"),
                                             msg("assistant", now + 20, ["mimo found it"], finish=finish)]}, open(f, "w"))
PY
  }
  mimo_export ses_new stop; mimo_export ses_cut tool-calls
  printf '[{"id": "ses_old", "directory": "%s", "created": %s}, {"id": "ses_away", "directory": "%s", "created": %s}, {"id": "ses_new", "directory": "%s", "created": %s}]\n' \
    "$lwt" $(( (now - 3600) * 1000 )) "$tmp/elsewhere" $((now * 1000)) "$lwt" $((now * 1000)) > "$mdata/sessions.json"
  carries "session records: MiMo's thread is the first session its own list shows begun here since the agent started, its record its database" on \
    "ses_new	$mdata/mimocode/mimocode.db" session four "$lwt" records $((now - 1))
  turned "turn: MiMo's final message is its last assistant message that completed for a reason but a tool call" true true "mimo found it" four "-" 0 ses_new "$now"
  turned "a MiMo turn whose last message is a tool call has not ended" true false - four "-" 0 ses_cut "$now"
  turned "and a MiMo prompt from before the turn began is not this turn's" false false - four "-" 0 ses_new $((now + 60))
  run on turn three "$lwt" T "$tmp/pi.jsonl" 0 0 "$tmp/p-turn.txt"
  [ $rc -eq 3 ] && ok "turn: a harness whose record is not recorded here exits 3" || fail "turn: a harness whose record is not recorded here exits 3"
  envx=""

  echo
  [ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
  echo "self-test: $fails control(s) misbehaved"; exit 1
fi

die() { echo "launch: $*" >&2; exit 1; }
HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)
[ $# -ge 2 ] || die "usage: launch.sh form|launch|resume|skill|live|session|turn <name> ... | --self-test"
CMD=$1; NAME=$2; shift 2
LEG=""; LAST=""; RUN=""; RESUME=""; STDIN_FILE=""; args=()
while [ $# -gt 0 ]; do
  case $1 in
    --leg) [ $# -ge 2 ] || die "--leg needs a value"; LEG=$2; shift ;;
    --last) [ $# -ge 2 ] || die "--last needs a file"; LAST=$2; shift ;;
    --run) [ $# -ge 2 ] && [ -n "$2" ] || die "--run needs a dispatch directory"; RUN=$2; shift ;;
    --resume) [ "$CMD" = live ] || die "--resume is for live"
              [ $# -ge 2 ] && [ -n "$2" ] || die "--resume needs a thread id"; RESUME=$2; shift ;;
    *) args+=("$1") ;;
  esac
  shift
done
[ "$NAME" = coachman ] && [ "$CMD" != form ] && [ -z "$LEG" ] \
  && die "coachman needs --leg synthesis, review or ship to $CMD"

if [ -n "$RUN" ]; then
  SOURCE=${RUN%/}/run.json
  [ -f "$SOURCE" ] || die "no run.json in $RUN; inside a run, a launch or resume runs only on the config the run recorded at dispatch"
else
  SOURCE=$CONFIG
  [ -f "$SOURCE" ] || die "no config at $CONFIG (POSTMASTER_CONFIG overrides the path)"
fi
python3 -c 'import tomllib' 2>/dev/null || die "python3 with tomllib (3.11 or newer) is needed to read the config"
spec=$(python3 - "$SOURCE" "$NAME" "$LEG" "${RUN:+run}" <<'PY'
import json, re, sys, tomllib, shlex
path, name, leg, recorded = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == "run"
def die(msg):
    print("die %s" % shlex.quote(msg)); sys.exit(0)
def table(v, what):
    if not isinstance(v, dict):
        die("%s in %s is not a table" % (what, path))
    return v
try:
    with open(path, "rb") as f:
        cfg = json.load(f) if recorded else tomllib.load(f)
except (OSError, ValueError) as e:
    die("cannot read %s: %s" % (path, e))
if recorded:
    # run.json is the run's whole record; its config is the one field run-meta.sh wrote as parsed.
    cfg = cfg.get("config") if isinstance(cfg, dict) else None
    if not isinstance(cfg, dict):
        die("cannot read %s: it records no config" % path)
LEGS = ("synthesis", "review", "ship")
if leg and leg not in LEGS:
    die("no such leg: --leg %s; the legs are synthesis, review and ship" % leg)
lanes = table(cfg.get("lanes", {}), "[lanes]")
def base(model):  # a model id without its bracketed suffixes: same[1m] is same
    return re.sub(r"(\[[^\]]*\])+$", "", str(model))
lane_models = {base(v["model"]) for v in lanes.values() if isinstance(v, dict) and v.get("model")}
def not_a_lane(spec, what):
    if isinstance(spec, dict) and spec.get("model") and base(spec["model"]) in lane_models:
        die("%s in %s runs on %s, a lane's model, and a coachman never does" % (what, path, spec["model"]))
if name == "coachman":
    team = table(cfg.get("team", {}), "[team]")
    legs = table(team.get("coachman_legs", {}), "[team.coachman_legs]")
    merged = [k for k in legs if k in ("style", "bug", "security")]
    if merged:
        die("[team.coachman_legs] in %s names %s: style, bug and security are one leg now, review; "
            "give review one entry instead" % (path, ", ".join(merged)))
    unknown = [k for k in legs if k not in LEGS]
    if unknown:
        die("[team.coachman_legs] in %s names no such leg: %s; the legs are synthesis, review and ship"
            % (path, ", ".join(unknown)))
    for k, v in legs.items():
        table(v, "[team.coachman_legs] %s" % k)
        if not v.get("harness") or not v.get("model"):
            die("[team.coachman_legs] %s in %s needs a harness and a model" % (k, path))
        not_a_lane(v, "[team.coachman_legs] %s" % k)
    not_a_lane(team.get("coachman"), "team.coachman")
    spec = (legs.get(leg) if leg else None) or team.get("coachman")
elif name == "coachman_fallback":
    spec = table(cfg.get("team", {}), "[team]").get("coachman_fallback")
    not_a_lane(spec, "team.coachman_fallback")
elif name == "postmaster":
    spec = table(cfg.get("team", {}), "[team]").get("postmaster")
else:
    spec = lanes.get(name)
if not spec:
    die("no such lane or role in %s: %s" % (path, name))
table(spec, name)
live = table(cfg.get("host", {}), "[host]").get("live_agents", False)
if not isinstance(live, bool):
    die("host.live_agents in %s must be true or false, not %r" % (path, live))
for k in ("harness", "model", "effort", "env_file"):
    v = spec.get(k)   # JSON can say null where TOML says nothing; both are unset
    print("%s=%s" % (k.upper(), shlex.quote("" if v is None else str(v))))
print("LIVE=%d" % live)
PY
) && [ -n "$spec" ] || die "cannot read the config at $SOURCE"
eval "$spec"
[ -n "${HARNESS:-}" ] || die "$NAME has no harness in $SOURCE"
[ -n "${MODEL:-}" ] || die "$NAME has no model in $SOURCE"
command -v "$HARNESS" >/dev/null 2>&1 || die "harness '$HARNESS' is not on PATH"
if [ -n "${ENV_FILE:-}" ]; then
  ENV_FILE=${ENV_FILE/#\~/$HOME}
  case $ENV_FILE in /*) ;; *) ENV_FILE=$(CDPATH= cd -P -- "$(dirname -- "$CONFIG")" && pwd -P)/$ENV_FILE ;; esac
  [ -f "$ENV_FILE" ] && [ -r "$ENV_FILE" ] || die "env_file for $NAME not found or not readable: $ENV_FILE"
fi

if [ "$CMD" = skill ]; then  # the prompt that invokes the lane's harness's own skill
  [ ${#args[@]} -eq 1 ] || die "skill needs <skill>"
  case $HARNESS:${args[0]} in
    claude:security-review) echo /security-review; exit 0 ;;
    *:security-review) echo "launch: $NAME runs on $HARNESS, which has no security review skill recorded in harnesses.md" >&2; exit 3 ;;
    *) die "no such skill: ${args[0]}; the one skill is security-review" ;;
  esac
fi

prompt_text() {  # the prompt file's text; a missing, unreadable or empty file is refused
  [ -f "$PROMPT" ] && [ -r "$PROMPT" ] && [ -s "$PROMPT" ] || die "prompt file missing, unreadable or empty: $PROMPT"
  PTEXT=$(cat "$PROMPT") || die "cannot read the prompt file: $PROMPT"
}
case $CMD in
  form)   [ ${#args[@]} -eq 0 ] || die "form takes no argument but --leg and --run"
          CWD='<cwd>'; PROMPT='<prompt-file>'; THREAD='<thread-id>'; PTEXT='$(cat <prompt-file>)' ;;
  launch) [ ${#args[@]} -eq 2 ] || die "launch needs <cwd> <prompt-file>"
          CWD=${args[0]}; PROMPT=${args[1]}; prompt_text ;;
  resume) [ ${#args[@]} -eq 3 ] || die "resume needs <cwd> <thread-id> <prompt-file>"
          CWD=${args[0]}; THREAD=${args[1]}; PROMPT=${args[2]}
          [ -n "$THREAD" ] || die "resume needs a thread id, and none was given"
          prompt_text ;;
  live)   [ ${#args[@]} -eq 1 ] || die "live needs <cwd>, and takes --leg and --resume"
          CWD=${args[0]}; THREAD=$RESUME; PROMPT='<prompt-file>'; PTEXT='' ;;
  session) [ ${#args[@]} -eq 3 ] || die "session needs <cwd> <kind> <value>"
          CWD=${args[0]}; THREAD='<thread-id>'; PROMPT='<prompt-file>'; PTEXT='' ;;
  turn)   [ ${#args[@]} -eq 6 ] || die "turn needs <cwd> <thread> <record> <offset> <since> <prompt-file>"
          CWD=${args[0]}; THREAD='<thread-id>'; PROMPT='<prompt-file>'; PTEXT='' ;;
  *) die "unknown command: $CMD" ;;
esac
[ "$CMD" = form ] || [ -d "$CWD" ] || die "no such directory: $CWD"
case $CMD in live|session|turn) CWD=$(CDPATH= cd -P -- "$CWD" && pwd -P) ;; esac
case $HARNESS in pi|muse|mimo) [ "$CMD" = launch ] || [ "$CMD" = resume ] ;; *) false ;; esac && {   # read after the cd
  prompt_dir=$(CDPATH= cd -P -- "$(dirname -- "$PROMPT")" && pwd -P) || die "cannot resolve prompt file: $PROMPT"
  PROMPT=$prompt_dir/$(basename "$PROMPT")
}

harness_data() {  # harness_data <harness>: this launch's own data directory, for a harness that keeps
  # state between sessions. Keyed by run, directory, name and leg, so a resume finds its session
  # and no lane, leg or run finds another's through the harness's own memory. It is not a
  # sandbox: a lane can still read files elsewhere on the machine.
  if [ "$CMD" = form ]; then echo "<harness-data>/$1/<key>"; return 0; fi
  printf '%s/%s/%s\n' "${POSTMASTER_HARNESS_DATA:-$HOME/.postmaster/harness-data}" "$1" \
    "$(printf '%s|%s|%s|%s' "$RUN" "$(CDPATH= cd -P -- "$CWD" && pwd -P)" "$NAME" "$LEG" | cksum | tr ' ' '-')"
}
forms() {  # the command for $CMD in cmd, its data directory in DATA, the file its stdin reads in STDIN_FILE
DATA=""
cmd=()
case $HARNESS in
  codex)
    # A resume takes the launch's flags but -C and --skip-git-repo-check, and runs in the
    # directory this script enters. Without -m and the effort it runs on codex's configured
    # default, not on the thread's own model. `--` stops a prompt that starts with - from being
    # read as a flag.
    if [ "$CMD" = resume ]; then cmd=(codex exec resume "$THREAD" --json)
    else cmd=(codex exec -C "$CWD" --json); fi
    [ -n "$LAST" ] && cmd+=(-o "$LAST")
    cmd+=(-m "$MODEL")
    [ -n "${EFFORT:-}" ] && cmd+=(-c "model_reasoning_effort=\"$EFFORT\"")
    cmd+=(--dangerously-bypass-approvals-and-sandbox)
    if [ "$CMD" = launch ] && ! git -C "$CWD" symbolic-ref -q HEAD >/dev/null 2>&1; then
      cmd+=(--skip-git-repo-check)   # a detached scratch
    fi
    if [ "$CMD" = resume ]; then cmd+=(--); fi
    cmd+=("$PTEXT") ;;
  grok)
    if [ "$CMD" = resume ]; then cmd=(grok --resume "$THREAD" -p "$PTEXT")
    else cmd=(grok --prompt-file "$PROMPT"); fi
    cmd+=(-m "$MODEL")
    [ -n "${EFFORT:-}" ] && cmd+=(--reasoning-effort "$EFFORT")
    cmd+=(--max-turns 1000 --always-approve --output-format streaming-json) ;;
  agy)
    [ "$CMD" = resume ] && die "agy resume form is not recorded; relaunch against its conversationId by hand (harnesses.md)"
    cmd=(agy -p "$PTEXT" --model "$MODEL" --output-format stream-json --dangerously-skip-permissions --add-dir "$CWD") ;;
  claude)
    if [ "$CMD" = resume ]; then cmd=(claude -p --resume "$THREAD" "$PTEXT")
    else cmd=(claude -p "$PTEXT"); fi
    cmd+=(--model "$MODEL")
    [ -n "${EFFORT:-}" ] && cmd+=(--effort "$EFFORT")
    # POSTMASTER_LAUNCH_NAME, set by scripts/host.sh, names the thread in the harness's own store.
    [ -n "${POSTMASTER_LAUNCH_NAME:-}" ] && cmd+=(--name "$POSTMASTER_LAUNCH_NAME")
    cmd+=(--output-format stream-json --verbose --dangerously-skip-permissions) ;;
  pi)
    # The prompt goes in on stdin. An `@file` argument is an attachment, and pi sends it as
    # <file name="..."> ... </file> with no instruction around it, which is not the same
    # message every other harness gets. pi also reads stdin to EOF before it starts in every
    # mode but rpc, so the redirect is what keeps an inherited pipe from hanging the launch.
    # `--mode json` already selects non-interactive, so no --print.
    cmd=(pi --mode json --approve)
    [ "$CMD" = resume ] && cmd+=(--session "$THREAD")
    cmd+=(--model "$MODEL")
    [ -n "${EFFORT:-}" ] && cmd+=(--thinking "$EFFORT")
    [ -n "${POSTMASTER_LAUNCH_NAME:-}" ] && cmd+=(--name "$POSTMASTER_LAUNCH_NAME")
    STDIN_FILE=$PROMPT ;;
  muse)
    # --yolo is the bypass form: it turns off approval and the sandbox, which needs unprivileged
    # user namespaces, and trusts the workspace for the run. A resume is a launch that names the
    # session. The prompt comes from its file, so stdin carries nothing. Muse Code keeps its
    # sessions and a memory that outlives them under XDG_DATA_HOME, so each launch has its own.
    DATA=$(harness_data muse)
    cmd=(env "XDG_DATA_HOME=$DATA" muse exec --json --prompt-file "$PROMPT")
    [ "$CMD" = resume ] && cmd+=(--session-id "$THREAD")
    cmd+=(--model "$MODEL")
    [ -n "${EFFORT:-}" ] && cmd+=(--reasoning-effort "$EFFORT")
    cmd+=(--yolo)
    STDIN_FILE=/dev/null ;;
  mimo)
    # MiMo Code reads its prompt from stdin, which it reads to the end, so the prompt file is its
    # stdin and an inherited pipe never is. --dangerously-skip-permissions is the bypass form: it
    # approves whatever no rule denies. A resume is the launch form naming the session, with the
    # model and the variant passed again; --title names a launch's session after the run. MiMo
    # Code keeps its sessions and a memory tool's notes under XDG_DATA_HOME, so each launch has
    # its own. In a new one it would copy Claude Code's session history in first, which the launch
    # turns off; the instruction files it reads from Claude Code are kept.
    DATA=$(harness_data mimo)
    cmd=(env "XDG_DATA_HOME=$DATA" MIMOCODE_DISABLE_CLAUDE_IMPORT=1 mimo run --format json -m "$MODEL")
    [ "$CMD" = resume ] && cmd+=(-s "$THREAD")
    [ -n "${EFFORT:-}" ] && cmd+=(--variant "$EFFORT")
    [ "$CMD" = launch ] && [ -n "${POSTMASTER_LAUNCH_NAME:-}" ] && cmd+=(--title "$POSTMASTER_LAUNCH_NAME")
    cmd+=(--dangerously-skip-permissions)
    STDIN_FILE=$PROMPT ;;
  *) die "no form for harness '$HARNESS'" ;;
esac
}
forms

# --- live agents (host.live_agents) ---------------------------------------------------------
lane_env() {  # lane_env <command...>: run it with the env file loaded, in a subshell
  ( if [ -n "${ENV_FILE:-}" ]; then set -a; . "$ENV_FILE"; set +a; fi; "$@" )
}
integration_of() {  # the name `herdr integration` gives a harness's integration; none for muse or mimo
  case $1 in agy) echo antigravity-cli ;; claude|codex|grok|pi) echo "$1" ;; esac
}
live_checks() {  # refuse a live agent Herdr cannot run. SIGNAL is 1 for a harness whose lane
  # signals its own finish with a file and whose thread the flow reads from the harness's own
  # records, 0 for one whose Herdr integration reports both.
  local host target line var="" val=""
  host=$("$HERE/host.sh" detect 2>/dev/null)
  [ "$host" = herdr ] || die "live agents (host.live_agents) need Herdr, and the session host here is ${host:-none}"
  case $HARNESS in codex|muse|mimo) SIGNAL=1; return 0 ;; esac
  SIGNAL=0
  target=$(integration_of "$HARNESS")
  [ -n "$target" ] || die "$HARNESS has no Herdr integration, so $NAME cannot run as a live agent"
  line=$(lane_env herdr integration status 2>/dev/null | grep -m1 "^$target: ")
  case $line in
    "") die "herdr integration status names no $target integration, so $NAME cannot run as a live agent" ;;
    *"not installed"*)
      case $target in claude) var=CLAUDE_CONFIG_DIR ;; pi) var=PI_CODING_AGENT_DIR ;; esac
      [ -n "$var" ] && val=$(lane_env printenv "$var" 2>/dev/null)
      die "$NAME runs on $HARNESS, and Herdr's $target integration is not installed where it reads its config (${line#*: }); install it with: ${val:+$var=$(printf '%q' "$val") }herdr integration install $target" ;;
  esac
}
live_args() {  # the harness's interactive form: KIND, or TYPED, the command typed into the pane's
  # shell for a harness Herdr has no agent kind for, with READY, the terminal title it sets once it
  # takes input; largs; and LENV, the variables its pane's shell sets. Resumes $THREAD when set.
  KIND=$HARNESS; TYPED=""; READY=""; largs=(); LENV=()
  local n=${POSTMASTER_LAUNCH_NAME:-}
  case $HARNESS in
    claude) [ -n "$THREAD" ] && largs+=(--resume "$THREAD")
            largs+=(--model "$MODEL"); [ -n "${EFFORT:-}" ] && largs+=(--effort "$EFFORT")
            [ -n "$n" ] && largs+=(--name "$n")
            largs+=(--dangerously-skip-permissions) ;;
    pi)     [ -n "$THREAD" ] && largs+=(--session "$THREAD")
            largs+=(--model "$MODEL"); [ -n "${EFFORT:-}" ] && largs+=(--thinking "$EFFORT")
            [ -n "$n" ] && largs+=(--name "$n")
            largs+=(--approve) ;;
    codex)  # --no-daemon keeps the thread in this process, in its pane: ending the agent ends it.
            [ -n "$THREAD" ] && largs+=(resume "$THREAD")
            largs+=(-m "$MODEL"); [ -n "${EFFORT:-}" ] && largs+=(-c "model_reasoning_effort=\"$EFFORT\"")
            largs+=(--no-daemon --dangerously-bypass-approvals-and-sandbox) ;;
    grok)   [ -n "$THREAD" ] && largs+=(--resume "$THREAD")
            largs+=(-m "$MODEL"); [ -n "${EFFORT:-}" ] && largs+=(--reasoning-effort "$EFFORT")
            largs+=(--always-approve) ;;
    agy)    [ -n "$THREAD" ] && die "agy resume form is not recorded, so a live agy lane cannot be resumed (harnesses.md)"
            largs+=(--model "$MODEL" --dangerously-skip-permissions --add-dir "$CWD") ;;
    muse)   [ -n "$THREAD" ] && largs+=(resume "$THREAD")
            largs+=(--model "$MODEL"); [ -n "${EFFORT:-}" ] && largs+=(--reasoning-effort "$EFFORT")
            largs+=(--yolo)
            LENV=("XDG_DATA_HOME=$DATA") ;;
    mimo)   # Herdr has no agent kind for MiMo Code, so its command is typed into the pane's shell,
            # and it takes input once it has titled its terminal. On a terminal the bypass flag asks
            # a question before anything else; MIMOCODE_DANGEROUSLY_SKIP_PERMISSIONS, its documented
            # bypass for any surface, asks none. Its state, where its variant is kept, is the launch's.
            KIND=""; TYPED=mimo; READY='^(MiMoCode|MC \|)'
            largs+=(-m "$MODEL"); [ -n "$THREAD" ] && largs+=(-s "$THREAD")
            largs+=(--trust)
            LENV=("XDG_DATA_HOME=$DATA" "XDG_STATE_HOME=$DATA/state" MIMOCODE_DISABLE_CLAUDE_IMPORT=1
                  MIMOCODE_DANGEROUSLY_SKIP_PERMISSIONS=1) ;;
  esac
}
prepare_live() {  # ready what the harness would otherwise stop at a question for, or run without
  case $HARNESS in
    claude)
      # Interactive claude asks whether to trust a folder its config has never trusted, bypass
      # flag or not. In a git worktree what counts is the worktree or its repository's own
      # checkout, never a folder above that; elsewhere, any folder above counts. So trust the
      # repository, once, unless one of those is trusted already. claude saves this file holding
      # <file>.lock, a lock directory that goes stale after 10 s unrefreshed, and re-reads the
      # file under it; so does this, and it waits while a session holds the lock.
      local lockwait=${POSTMASTER_TRUST_LOCK_WAIT:-30}
      case $lockwait in ''|*[!0-9]*) die "POSTMASTER_TRUST_LOCK_WAIT must be a whole number of seconds, not '$lockwait'" ;; esac
      lane_env python3 - "$CWD" "$lockwait" <<'PY' || die "could not mark $CWD trusted in claude's config"
import json, os, subprocess, sys, tempfile, time
cwd, lockwait = sys.argv[1], float(sys.argv[2])
home = os.environ.get("CLAUDE_CONFIG_DIR")
path = os.path.join(home, ".claude.json") if home else os.path.expanduser("~/.claude.json")
lock, stale = path + ".lock", 10.0
r = subprocess.run(["git", "-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"],
                   capture_output=True, text=True)
if r.returncode == 0:
    common = os.path.realpath(r.stdout.strip())
    main = os.path.dirname(common) if os.path.basename(common) == ".git" else common
    root = main if (cwd + "/").startswith(main.rstrip("/") + "/") else cwd
    counts = [cwd, root]
else:
    root, counts, d = cwd, [], cwd
    while True:
        counts.append(d)
        if os.path.dirname(d) == d: break
        d = os.path.dirname(d)
end = time.time() + lockwait
while True:
    try:
        os.mkdir(lock); break
    except FileExistsError:
        try:
            if os.stat(lock).st_mtime < time.time() - stale:
                os.rmdir(lock); continue           # stale, as claude's own processes judge it
        except OSError:
            continue
        if time.time() >= end:
            sys.exit("launch: claude's config %s stayed locked for %gs (%s is held); nothing was written"
                     % (path, lockwait, lock))
        time.sleep(0.1)
try:
    try:
        with open(path, encoding="utf-8") as f: cfg = json.load(f)
    except FileNotFoundError:
        cfg = {}
    projects = cfg.get("projects") if isinstance(cfg.get("projects"), dict) else {}
    if any(isinstance(projects.get(d), dict) and projects[d].get("hasTrustDialogAccepted") is True for d in counts):
        sys.exit(0)
    cfg.setdefault("projects", {})
    if not isinstance(cfg["projects"], dict): sys.exit("projects in %s is not an object" % path)
    cfg["projects"].setdefault(root, {})["hasTrustDialogAccepted"] = True
    real = os.path.realpath(path)
    mode = os.stat(real).st_mode & 0o777 if os.path.exists(real) else 0o600
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(real), prefix=".claude.json.postmaster.")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2); f.flush(); os.fsync(f.fileno())
    os.chmod(tmp, mode); os.replace(tmp, real)
    print("launch: trusted %s in %s" % (root, path), file=sys.stderr)
finally:
    try: os.rmdir(lock)
    except OSError: pass
PY
      ;;
    codex)
      # Interactive codex asks whether to trust a folder, and Herdr reads that question as an
      # agent at its prompt. Trusting the directory itself answers it, a git worktree included,
      # in the config dir the lane's environment names. Duplicate [projects] tables are invalid
      # TOML, so the grep guard is idempotent on purpose.
      lane_env bash -c 'c=${CODEX_HOME:-$HOME/.codex}/config.toml; mkdir -p "$(dirname "$c")" && touch "$c" &&
        { grep -qF "[projects.\"$1\"]" "$c" || printf "\n[projects.\"%s\"]\ntrust_level = \"trusted\"\n" "$1" >> "$c"; }' _ "$CWD" \
        || die "could not mark $CWD trusted in codex's config" ;;
    muse)
      mkdir -p "$DATA" || die "cannot create $DATA" ;;
    mimo)
      # MiMo Code's interface has no flag for the variant a headless launch passes. It sends the
      # one its state's model.json holds for the model, and this launch's state is its own.
      mkdir -p "$DATA/state/mimocode" || die "cannot create $DATA/state/mimocode"
      [ -z "${EFFORT:-}" ] || python3 - "$DATA/state/mimocode/model.json" "$MODEL" "$EFFORT" <<'PY' || die "cannot write MiMo's variant under $DATA/state"
import json, os, sys
path, model, effort = sys.argv[1:4]
try:
    with open(path, encoding="utf-8") as f: state = json.load(f)
except (OSError, ValueError):
    state = {}
if not isinstance(state, dict): state = {}
for k in ("recent", "favorite"):
    if not isinstance(state.get(k), list): state[k] = []
if not isinstance(state.get("variant"), dict): state["variant"] = {}
state["variant"][model] = effort
with open(path + ".postmaster", "w", encoding="utf-8") as f: json.dump(state, f, indent=2)
os.replace(path + ".postmaster", path)
PY
      ;;
  esac
}
thread_held() {  # muse opens a new thread under an id it does not hold, and mimo exits 0 having run
  # nothing (harnesses.md). So a resume on either goes ahead only where the harness's own export
  # finds the thread in this launch's data directory, which is its launch's only from the same
  # directory, name, leg and run.
  local held found why
  held=$(mktemp -d) || die "cannot make a temporary directory"
  ( CDPATH= cd -- "$CWD" || exit 1
    if [ -n "${ENV_FILE:-}" ]; then set -a; . "$ENV_FILE"; set +a; fi
    export XDG_DATA_HOME=$DATA MIMOCODE_DISABLE_CLAUDE_IMPORT=1
    if [ "$HARNESS" = muse ]; then muse export --session "$THREAD" --out "$held/thread.json"
    else mimo export "$THREAD" > "$held/thread.json"; fi ) </dev/null >/dev/null 2>"$held/err"
  found=$?; why=$(sed 's/\x1b\[[0-9;]*m//g' "$held/err" | tr '\n' ' ' | cut -c1-300); rm -r -- "$held"
  [ $found -eq 0 ] || die "no $HARNESS thread $THREAD in this launch's data directory, so nothing was resumed; resume from the directory, --leg and --run it was launched with (its export: ${why:-no message})"
}
show() { case $1 in '<'*|*'=<'*|'$(cat <prompt-file>)') printf '%s ' "$1" ;; *) printf '%q ' "$1" ;; esac; }

if [ "$CMD" = form ] && [ "$LIVE" = 1 ] && [ "$NAME" != postmaster ]; then
  live_checks
  put_live() {
    local l a w=""
    if [ -n "$TYPED" ]; then
      for a in "$TYPED" "${largs[@]}"; do w+=$(show "$a"); done
      l="herdr pane run <pane> \"${w% }\""
    else
      l="herdr agent start <agent> --kind $KIND --pane <pane> -- "
      for a in "${largs[@]}"; do l+=$(show "$a"); done
      l=${l% }
    fi
    if [ "$SIGNAL" = 1 ]; then
      if [ ${#LENV[@]} -gt 0 ]; then l+="; pane env"; for a in "${LENV[@]}"; do l+=" $(show "$a")"; l=${l% }; done; fi
      [ -n "$READY" ] && l+="; ready: title $READY"
      l+="; finish: signal file"
    fi
    printf '%s\n' "$l"
  }
  THREAD=""; live_args; printf 'launch: '; put_live
  if resume=$(THREAD='<thread-id>'; live_args 2>&1 && put_live); then printf 'resume: %s\n' "$resume"
  else printf 'resume: none: %s\n' "${resume#launch: }"; fi
  exit 0
fi
if [ "$CMD" = live ]; then
  [ "$NAME" != postmaster ] || die "the postmaster is spawned, never started as a live lane (SKILL.md)"
  live_checks; live_args
  if [ -n "$THREAD" ] && [ -n "$DATA" ]; then thread_held; fi
  prepare_live
  python3 -c 'import json, sys
a = sys.argv[1:]; i = a.index("--")
print(json.dumps({"kind": a[0], "typed": a[1], "ready_title": a[2], "signal": a[3] == "1", "env_file": a[4],
                  "env": a[5:i], "args": a[i + 1:]}))' "$KIND" "$TYPED" "$READY" "$SIGNAL" "${ENV_FILE:-}" "${LENV[@]}" -- "${largs[@]}"
  exit 0
fi
if [ "$CMD" = turn ]; then
  # A turn, from the harness's own session record: whether it holds the prompt, whether the turn
  # that took it has ended, and its final message. A new turn opens at claude's or pi's user
  # message, codex's task_started or muse's run start, and ends at claude's end_turn, pi's stop,
  # codex's task_complete (or turn_aborted, with no message) or muse's terminal run event. MiMo
  # keeps its record in a database, read through its own export: the turn ends at an assistant
  # message that has completed for any reason but a tool call.
  case $HARNESS in claude|pi|codex|muse|mimo) ;; *) echo "launch: the $HARNESS session record's form is not recorded" >&2; exit 3 ;; esac
  lane_env python3 - "$HARNESS" "$CWD" "${args[1]}" "${args[2]}" "${args[3]}" "${args[4]}" "${args[5]}" "$DATA" <<'PY'
import json, os, subprocess, sys
harness, cwd, thread, record, offset, since, prompt, data = sys.argv[1:9]
try:
    text = open(prompt, encoding="utf-8").read()
except OSError:
    text = ""
def norm(s): return " ".join(s.split())
head = norm(text)[:200]
def say(heard, ended, final):
    print(json.dumps({"heard": heard, "ended": bool(heard and ended), "final": final if heard and ended else None}))
    sys.exit(0)
def strings(v):
    if isinstance(v, str): yield v
    elif isinstance(v, dict):
        for x in v.values(): yield from strings(x)
    elif isinstance(v, list):
        for x in v: yield from strings(x)
def texts(content):
    if isinstance(content, str): return content
    return "".join(p.get("text", "") for p in content or [] if isinstance(p, dict) and p.get("type") == "text")
if harness == "mimo":
    if not thread: say(False, False, None)
    env = dict(os.environ, XDG_DATA_HOME=data, XDG_STATE_HOME=os.path.join(data, "state"), MIMOCODE_DISABLE_CLAUDE_IMPORT="1")
    try:
        r = subprocess.run(["mimo", "export", thread], cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                           capture_output=True, text=True, timeout=120)
        msgs = json.loads(r.stdout)["messages"]
    except (OSError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired):
        say(False, False, None)
    at, first = None, float(since) * 1000 - 2000
    for i, m in enumerate(msgs):
        info = m.get("info") or {}
        if info.get("role") != "user" or ((info.get("time") or {}).get("created") or 0) < first: continue
        if head and head in norm(texts(m.get("parts"))): at = i
    if at is None: say(False, False, None)
    ended, final = False, None
    for m in msgs[at + 1:]:
        info = m.get("info") or {}
        if info.get("role") == "user":
            ended, final = False, None                       # another turn has begun
        elif info.get("role") == "assistant":
            ended = bool((info.get("time") or {}).get("completed")) and info.get("finish") not in (None, "tool-calls", "unknown")
            final = texts(m.get("parts")) if ended else None
    say(True, ended, final)
try:
    f = open(record, "rb")
    f.seek(int(offset) if os.path.getsize(record) >= int(offset) else 0)
    lines = f.read().decode("utf-8", "replace").splitlines()
except (OSError, ValueError):
    say(False, False, None)
def entries(r):   # muse writes some records inside a transaction, as children
    if isinstance(r.get("children"), list):
        for c in r["children"]:
            try: yield json.loads(c.get("record_json") or "{}")
            except (ValueError, AttributeError): pass
    else:
        yield r
def kind_of(r):   # ("start" | "end" | "said" | None, text)
    m = r.get("message") or {}
    p = r.get("payload") or {}
    if harness == "claude":
        if r.get("type") == "user":
            c = m.get("content")
            if isinstance(c, str) or any(isinstance(x, dict) and x.get("type") == "text" for x in c or []): return "start", None
        elif r.get("type") == "assistant" and m.get("stop_reason") in ("end_turn", "stop_sequence"):
            return "end", texts(m.get("content"))
    elif harness == "pi":
        if r.get("type") == "message" and m.get("role") == "user": return "start", None
        if r.get("type") == "message" and m.get("role") == "assistant" and m.get("stopReason") == "stop":
            return "end", texts(m.get("content"))
    elif harness == "codex" and r.get("type") == "event_msg":
        if p.get("type") == "task_started": return "start", None
        if p.get("type") == "task_complete": return "end", p.get("last_agent_message") or ""
        if p.get("type") == "turn_aborted": return "end", None
    elif harness == "muse" and r.get("payload_type") == "runtime.session" and p.get("kind") == "run":
        e = p.get("event") or {}
        if e.get("kind") == "started": return "start", None
        if e.get("kind") == "assistant_message_committed": return "said", e.get("text") or ""
        if e.get("kind") == "terminal": return "end", "" if e.get("terminal") == "completed" else None
    return None, None
heard, ended, final, said = False, False, None, None
for line in lines:
    try: r = json.loads(line)
    except ValueError: continue
    if not isinstance(r, dict): continue
    for e in entries(r):
        if not isinstance(e, dict): continue
        if not heard and head and any(head in norm(s) for s in strings(e)): heard = True
        k, t = kind_of(e)
        if k == "start": ended, final, said = False, None, None
        elif k == "said": said = t
        elif k == "end":
            ended = True
            final = (said if t is not None else None) if harness == "muse" else t
say(heard, ended, final)
PY
  exit 0
fi
if [ "$CMD" = session ]; then
  # Herdr's session report: claude, codex and grok report a session id; pi reports the path of
  # its session file, whose name ends in the session id. `records` finds the thread in the
  # harness's own records instead: codex's rollouts name the directory each began in, and muse
  # and MiMo keep this launch's threads in its own data directory. The record is where the
  # harness keeps the thread, in the config dir the lane's environment names; for MiMo its
  # database. Empty where it is not recorded.
  lane_env python3 - "$HARNESS" "$CWD" "${args[1]}" "${args[2]}" "$DATA" <<'PY' || die "cannot read the session reference: ${args[1]} ${args[2]}"
import glob, json, os, re, subprocess, sys
from datetime import datetime
harness, cwd, kind, value, data = sys.argv[1:6]
thread, record = value, ""
def only(pattern):
    hits = glob.glob(pattern)
    return hits[0] if len(hits) == 1 else ""
def mimo_env():
    return dict(os.environ, XDG_DATA_HOME=data, XDG_STATE_HOME=os.path.join(data, "state"), MIMOCODE_DISABLE_CLAUDE_IMPORT="1")
if kind == "records":
    since, found = float(value), []                           # (began, thread, record)
    if harness == "codex":
        home = os.environ.get("CODEX_HOME") or os.path.expanduser("~/.codex")
        for p in glob.glob(os.path.join(home, "sessions", "*", "*", "*", "rollout-*.jsonl")):
            try:
                if os.path.getmtime(p) < since - 2: continue
                with open(p, encoding="utf-8") as f: r = json.loads(f.readline())
                m = r.get("payload") or {}
                began = datetime.fromisoformat(m["timestamp"].replace("Z", "+00:00")).timestamp()
            except (OSError, ValueError, KeyError, TypeError, AttributeError):
                continue
            if r.get("type") == "session_meta" and m.get("id") and os.path.realpath(m.get("cwd") or "/") == cwd \
                    and began >= since - 2:
                found.append((began, m["id"], p))
    elif harness == "muse":
        for p in glob.glob(os.path.join(data, "muse", "sessions", "*", "*", "*", "*", "session.jsonl")):
            sid = os.path.basename(os.path.dirname(p))
            try: began = int(sid.replace("-", "")[:12], 16) / 1000.0      # a UUIDv7 carries its time
            except ValueError: continue
            if began >= since - 2: found.append((began, sid, p))
    elif harness == "mimo":
        try:
            r = subprocess.run(["mimo", "session", "list", "--format", "json"], cwd=cwd, env=mimo_env(),
                               stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=120)
            sessions = json.loads(r.stdout or "[]")
        except (OSError, ValueError, subprocess.TimeoutExpired):
            sessions = []
        for s in sessions if isinstance(sessions, list) else []:
            began = (s.get("created") or 0) / 1000.0
            if s.get("id") and os.path.realpath(s.get("directory") or "/") == cwd and began >= since - 2:
                found.append((began, s["id"], os.path.join(data, "mimocode", "mimocode.db")))
    else:
        sys.exit("no records form for %s" % harness)
    thread, record = (min(found)[1:] if found else ("", ""))
    print("%s\t%s" % (thread, record)); sys.exit(0)
if harness == "claude":
    home = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude")
    if kind == "path":
        record, thread = value, re.sub(r"\.jsonl$", "", os.path.basename(value))
    else:
        record = os.path.join(home, "projects", re.sub(r"[^A-Za-z0-9]", "-", cwd), value + ".jsonl")
        if not os.path.exists(record):
            record = only(os.path.join(home, "projects", "*", glob.escape(value) + ".jsonl")) or record
elif harness == "pi":
    home = os.environ.get("PI_CODING_AGENT_DIR") or os.path.expanduser("~/.pi/agent")
    if kind == "path":
        record = value
        m = re.search(r"_([0-9A-Za-z-]+)\.jsonl$", value)
        thread = m.group(1) if m else ""
        try:
            first = json.loads(open(value, encoding="utf-8").readline())
            if first.get("type") == "session" and first.get("id"): thread = first["id"]
        except (OSError, ValueError):
            pass
    else:
        record = only(os.path.join(home, "sessions", "*", "*_" + glob.escape(value) + ".jsonl"))
elif harness == "codex":
    home = os.environ.get("CODEX_HOME") or os.path.expanduser("~/.codex")
    record = only(os.path.join(home, "sessions", "*", "*", "*", "*" + glob.escape(value) + ".jsonl"))
elif harness == "muse":
    record = only(os.path.join(data, "muse", "sessions", "*", "*", "*", glob.escape(value), "session.jsonl"))
elif harness == "mimo":
    record = os.path.join(data, "mimocode", "mimocode.db")
if not thread:
    sys.exit("no thread id in %s %s" % (kind, value))
print("%s\t%s" % (thread, record))
PY
  exit 0
fi

[ -n "$DATA" ] && [ "$CMD" != form ] && { mkdir -p "$DATA" || die "cannot create $DATA"; }
if [ "$CMD" = form ]; then
  show() { case $1 in '<'*'>'|*'=<'*'>'|'$(cat <prompt-file>)') printf '%s ' "$1" ;; *) printf '%q ' "$1" ;; esac; }
  put_form() {
    printf 'cd '; show "$CWD"; printf '&& '
    for a in "${cmd[@]}"; do show "$a"; done
    [ -n "${STDIN_FILE:-}" ] && { printf '< '; show "$STDIN_FILE"; }
    echo
  }
  printf 'launch: '; put_form
  if resume=$(CMD=resume; STDIN_FILE=""; harness_data() { echo "<harness-data>/$1/<key>"; }
              forms 2>&1 && put_form); then printf 'resume: %s\n' "$resume"
  else printf 'resume: none: %s\n' "${resume#launch: }"; fi
  exit 0
fi

[ "$CMD" = resume ] && [ -n "$DATA" ] && thread_held

if [ "$HARNESS" = codex ] && [ "$CMD" = launch ]; then
  # Mark the worktree trusted first. The grep guard is idempotent on purpose: duplicate
  # [projects] tables are invalid TOML.
  mkdir -p "$HOME/.codex"; touch "$HOME/.codex/config.toml"
  grep -qF "[projects.\"$CWD\"]" "$HOME/.codex/config.toml" \
    || printf '\n[projects."%s"]\ntrust_level = "trusted"\n' "$CWD" >> "$HOME/.codex/config.toml"
fi
CDPATH= cd -- "$CWD" || die "cannot enter $CWD"
# A harness whose prompt arrives on stdin reads it from the file, never from an inherited pipe.
if [ -n "$STDIN_FILE" ]; then exec < "$STDIN_FILE" || die "cannot read $STDIN_FILE"; fi
# The env file reaches the harness's environment only: the command above is already built.
if [ -n "${ENV_FILE:-}" ]; then set -a; . "$ENV_FILE"; set +a; fi
unset POSTMASTER_LAUNCH_NAME   # the thread's own launches are named by their own host.sh call
exec "${cmd[@]}"
