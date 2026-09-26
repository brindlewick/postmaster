#!/usr/bin/env bash
# Launch or resume a lane or a role by name, from the config, in the exact form harnesses.md
# records for its harness. One command for every harness, so no form is ever copied by hand;
# this script and harnesses.md must agree, and a change to one is a change to both.
#
#   launch.sh form   <name> [--leg <leg>]
#   launch.sh launch <name> <cwd> <prompt-file> [--leg <leg>] [--last <file>]
#   launch.sh resume <name> <cwd> <thread-id> <prompt-file> [--leg <leg>]
#   launch.sh --self-test
#
# <name> is a lane from [lanes.<name>], or `coachman`, `coachman_fallback` or `postmaster`
# from [team]. <leg> is synthesis, review or ship, and with --leg, [team.coachman_legs.<leg>]
# overrides the coachman for that leg. Launching or resuming `coachman` needs --leg; `form`
# without it shows team.coachman. The coachman is refused when [team.coachman_legs] names any
# other leg or holds an entry that is not a table, and the coachman and the fallback are
# refused on a lane's model. HARNESS, MODEL, EFFORT and ENV_FILE come from the config alone,
# never from the environment. The events stream goes to stdout; the caller redirects and
# backgrounds. A lane's env_file, if set, is
# loaded first, so an alternate backend for a harness is an environment file outside this
# repo, never a value in the config. --last names the file a harness writes its final message
# to, where the harness supports it (codex -o).
#
#   exit 0  the form was printed, or the harness exited 0
#   exit 1  usage, config missing or unreadable, unknown name, a leg that is not synthesis,
#           review or ship, the coachman launched or resumed with no --leg, a coachman or
#           fallback on a lane's model, harness not on PATH, env_file missing, or a form this
#           script does not have (muse; agy resume)
#   else    the harness's own exit code
set -uo pipefail
CONFIG=${POSTMASTER_CONFIG:-$HOME/.postmaster/config.toml}

if [ "${1:-}" = --self-test ]; then
  # Each control runs this script on a fixture config, with a stub harness first on PATH.
  # `form` only prints, so nothing is launched.
  self=$(cd "$(dirname "$0")" && pwd -P)/$(basename "$0")
  tmp=$(mktemp -d) || exit 1
  trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
  # The stub prints its arguments, so a launch or a resume shows the model it would run on.
  mkdir "$tmp/bin" "$tmp/wt" && printf '#!/bin/sh\necho "$@"\n' > "$tmp/bin/claude" && chmod +x "$tmp/bin/claude"
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
  fixture legs synthesis review ship
  fixture none
  for k in style bug security; do fixture "old-$k" review "$k"; done
  fixture typo revue
  rawfix onlane 'review = { harness = "claude", model = "lane-model" }\n'
  rawfix notable 'review = "claude"\n'
  rawfix dup 'review = { harness = "claude", model = "a" }\nreview = { harness = "claude", model = "b" }\n'
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

  echo "positive controls"
  for k in synthesis review ship; do
    runs_on "--leg $k runs on its own [team.coachman_legs] entry" legs "$k-model" form coachman --leg "$k"
  done
  runs_on "a leg with no entry runs on team.coachman" none coach-model form coachman --leg review
  runs_on "a lane runs on its own model" legs lane-model form one
  runs_on "a lane launches on a config the coachman refuses" old-bug lane-model form one
  runs_on "a launch with --leg synthesis runs on the synthesis entry" legs synthesis-model launch coachman "$tmp/wt" "$tmp/prompt.txt" --leg synthesis
  runs_on "a resume with --leg review runs on the review entry" legs review-model resume coachman "$tmp/wt" T-1 "$tmp/prompt.txt" --leg review
  runs_on "the fallback resumes on its own model, with no --leg" legs fallback-model resume coachman_fallback "$tmp/wt" T-1 "$tmp/prompt.txt"
  runs_on "form with no --leg shows team.coachman" legs coach-model form coachman

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
  for k in style bug security; do
    refused "--leg $k is refused" legs "no such leg: --leg $k" form coachman --leg "$k"
  done
  refused "resuming the coachman with no --leg is refused, and nothing runs" legs "coachman needs --leg" resume coachman "$tmp/wt" T-1 "$tmp/prompt.txt"
  refused "launching the coachman with no --leg is refused, and nothing runs" legs "coachman needs --leg" launch coachman "$tmp/wt" "$tmp/prompt.txt"

  echo
  [ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
  echo "self-test: $fails control(s) misbehaved"; exit 1
fi

CMD=${1:?usage: launch.sh form|launch|resume <name> ... | --self-test}; shift
NAME=${1:?usage: launch.sh $CMD <name> ...}; shift
LEG=""; LAST=""; args=()
while [ $# -gt 0 ]; do
  case $1 in
    --leg) LEG=${2:?--leg needs a value}; shift ;;
    --last) LAST=${2:?--last needs a file}; shift ;;
    *) args+=("$1") ;;
  esac
  shift
done
die() { echo "launch: $*" >&2; exit 1; }
[ "$NAME" = coachman ] && [ "$CMD" != form ] && [ -z "$LEG" ] \
  && die "coachman needs --leg synthesis, review or ship to $CMD"

[ -f "$CONFIG" ] || die "no config at $CONFIG (POSTMASTER_CONFIG overrides the path)"
python3 -c 'import tomllib' 2>/dev/null || die "python3 with tomllib (3.11 or newer) is needed to read the config"
unset HARNESS MODEL EFFORT ENV_FILE
spec=$(python3 - "$CONFIG" "$NAME" "$LEG" <<'PY'
import sys, tomllib, shlex
path, name, leg = sys.argv[1], sys.argv[2], sys.argv[3]
def die(msg):
    print("die %s" % shlex.quote(msg)); sys.exit(0)
def table(v, what):
    if not isinstance(v, dict):
        die("%s in %s is not a table" % (what, path))
    return v
try:
    cfg = tomllib.load(open(path, "rb"))
except (OSError, ValueError) as e:
    die("cannot read %s: %s" % (path, e))
LEGS = ("synthesis", "review", "ship")
if leg and leg not in LEGS:
    die("no such leg: --leg %s; the legs are synthesis, review and ship" % leg)
lanes = table(cfg.get("lanes", {}), "[lanes]")
lane_models = {str(v.get("model")) for v in lanes.values() if isinstance(v, dict)}
def not_a_lane(spec, what):
    if isinstance(spec, dict) and str(spec.get("model")) in lane_models:
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
        not_a_lane(table(v, "[team.coachman_legs] %s" % k), "[team.coachman_legs] %s" % k)
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
    die("no such lane or role in the config: " + name)
table(spec, name)
for k in ("harness", "model", "effort", "env_file"):
    print("%s=%s" % (k.upper(), shlex.quote(str(spec.get(k, "")))))
PY
) && [ -n "$spec" ] || die "cannot read the config at $CONFIG"
eval "$spec"
[ -n "${HARNESS:-}" ] || die "$NAME has no harness in the config"
[ -n "${MODEL:-}" ] || die "$NAME has no model in the config"
command -v "$HARNESS" >/dev/null 2>&1 || die "harness '$HARNESS' is not on PATH"
if [ -n "${ENV_FILE:-}" ]; then
  f=${ENV_FILE/#\~/$HOME}
  [ -f "$f" ] || die "env_file for $NAME not found: $f"
  set -a; . "$f"; set +a
fi

case $CMD in
  form)   CWD='<cwd>'; PROMPT='<prompt-file>'; THREAD='<thread-id>'; PTEXT='$(cat <prompt-file>)' ;;
  launch) CWD=${args[0]:?launch needs <cwd>}; PROMPT=${args[1]:?launch needs <prompt-file>}
          [ -f "$PROMPT" ] || die "no such prompt file: $PROMPT"; PTEXT=$(cat "$PROMPT") ;;
  resume) CWD=${args[0]:?resume needs <cwd>}; THREAD=${args[1]:?resume needs <thread-id>}
          PROMPT=${args[2]:?resume needs <prompt-file>}
          [ -f "$PROMPT" ] || die "no such prompt file: $PROMPT"; PTEXT=$(cat "$PROMPT") ;;
  *) die "unknown command: $CMD" ;;
esac
[ "$CMD" = form ] || [ -d "$CWD" ] || die "no such directory: $CWD"
if [ "$HARNESS" = pi ] && [ "$CMD" != form ]; then
  prompt_dir=$(cd "$(dirname "$PROMPT")" && pwd -P) || die "cannot resolve prompt file: $PROMPT"
  PROMPT=$prompt_dir/$(basename "$PROMPT")
fi

cmd=()
case $HARNESS in
  codex)
    if [ "$CMD" = resume ]; then
      cmd=(codex exec resume "$THREAD" --dangerously-bypass-approvals-and-sandbox "$PTEXT")
    else
      cmd=(codex exec -C "$CWD" --json)
      [ -n "$LAST" ] && cmd+=(-o "$LAST")
      cmd+=(-m "$MODEL")
      [ -n "${EFFORT:-}" ] && cmd+=(-c "model_reasoning_effort=\"$EFFORT\"")
      cmd+=(--dangerously-bypass-approvals-and-sandbox)
      if [ "$CMD" = launch ] && ! git -C "$CWD" symbolic-ref -q HEAD >/dev/null 2>&1; then
        cmd+=(--skip-git-repo-check)   # a detached scratch
      fi
      cmd+=("$PTEXT")
    fi ;;
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
    STDIN_FILE=$PROMPT ;;
  muse)
    die "muse adapter is incomplete (stream flag, bypass form, thread id, resume form); fill harnesses.md and this script from a trial run first" ;;
  *) die "no form for harness '$HARNESS'" ;;
esac

if [ "$CMD" = form ]; then
  show() { case $1 in '<'*'>'|'$(cat <prompt-file>)') printf '%s ' "$1" ;; *) printf '%q ' "$1" ;; esac; }
  printf 'cd '; show "$CWD"; printf '&& '
  for a in "${cmd[@]}"; do show "$a"; done
  [ -n "${STDIN_FILE:-}" ] && { printf '< '; show "$STDIN_FILE"; }
  echo
  exit 0
fi

if [ "$HARNESS" = codex ] && [ "$CMD" = launch ]; then
  # Mark the worktree trusted first. The grep guard is idempotent on purpose: duplicate
  # [projects] tables are invalid TOML.
  mkdir -p "$HOME/.codex"; touch "$HOME/.codex/config.toml"
  grep -qF "[projects.\"$CWD\"]" "$HOME/.codex/config.toml" \
    || printf '\n[projects."%s"]\ntrust_level = "trusted"\n' "$CWD" >> "$HOME/.codex/config.toml"
fi
cd "$CWD" || die "cannot enter $CWD"
# A harness whose prompt arrives on stdin reads it from the file, never from an inherited pipe.
[ -n "${STDIN_FILE:-}" ] && exec "${cmd[@]}" < "$STDIN_FILE"
exec "${cmd[@]}"
