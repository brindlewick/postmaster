#!/usr/bin/env bash
# Launch or resume a lane or a role by name, from the config, in the exact form harnesses.md
# records for its harness. One command for every harness, so no form is ever copied by hand;
# this script and harnesses.md must agree, and a change to one is a change to both.
#
#   launch.sh form   <name> [--leg <leg>]
#   launch.sh launch <name> <cwd> <prompt-file> [--leg <leg>] [--last <file>]
#   launch.sh resume <name> <cwd> <thread-id> <prompt-file> [--leg <leg>]
#
# <name> is a lane from [lanes.<name>], or `coachman`, `coachman_fallback` or `postmaster`
# from [team]. With --leg, [team.coachman_legs.<leg>] overrides the coachman for that leg. The events stream
# goes to stdout; the caller redirects and backgrounds. A lane's env_file, if set, is loaded
# first, so an alternate backend for a harness is an environment file outside this repo,
# never a value in the config. --last names the file a harness writes its final message to,
# where the harness supports it (codex -o).
#
#   exit 0  the form was printed, or the harness exited 0
#   exit 1  usage, config missing or unreadable, unknown name, harness not on PATH, env_file
#           missing, or a form this script does not have (muse; agy resume)
#   else    the harness's own exit code
set -uo pipefail
CONFIG=${POSTMASTER_CONFIG:-$HOME/.postmaster/config.toml}
CMD=${1:?usage: launch.sh form|launch|resume <name> ...}; shift
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

[ -f "$CONFIG" ] || die "no config at $CONFIG (POSTMASTER_CONFIG overrides the path)"
python3 -c 'import tomllib' 2>/dev/null || die "python3 with tomllib (3.11 or newer) is needed to read the config"
eval "$(python3 - "$CONFIG" "$NAME" "$LEG" <<'PY'
import sys, tomllib, shlex
cfg = tomllib.load(open(sys.argv[1], "rb")); name, leg = sys.argv[2], sys.argv[3]
team = cfg.get("team", {})
if name == "coachman":
    spec = (team.get("coachman_legs", {}).get(leg) if leg else None) or team.get("coachman")
elif name == "coachman_fallback":
    spec = team.get("coachman_fallback")
elif name == "postmaster":
    spec = team.get("postmaster")
else:
    spec = cfg.get("lanes", {}).get(name)
if not spec:
    print("die %s" % shlex.quote("no such lane or role in the config: " + name)); sys.exit(0)
for k in ("harness", "model", "effort", "env_file"):
    print("%s=%s" % (k.upper(), shlex.quote(str(spec.get(k, "")))))
PY
)"
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
unset POSTMASTER_LAUNCH_NAME   # the thread's own launches are named by their own host.sh call
[ -n "${STDIN_FILE:-}" ] && exec "${cmd[@]}" < "$STDIN_FILE"
exec "${cmd[@]}"
