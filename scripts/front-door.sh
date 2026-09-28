#!/usr/bin/env bash
# Decide whether the session that reached the launch card is the postmaster, or must spawn one.
# The session reports its own harness, model, working directory and whether a person is at the
# terminal; the target and the config are given. It is `self` when that session is already on
# team.postmaster's harness and model, in the target repo, with the user at the terminal. It is
# `spawn` with every condition that failed, in ticket order: the harness differs, the model
# differs, the target is another repo, or nobody is at the terminal.
#
#   front-door.sh <harness> <model> <cwd> <at-terminal> <target> [--config <path>]
#   front-door.sh --self-test
#
#   at-terminal  yes when a person is at the terminal, no otherwise
#
# POSTMASTER_CONFIG overrides the config path (~/.postmaster/config.toml).
#
#   exit 0  printed `self` or `spawn` with its reasons
#   exit 1  no config or one that does not parse, team.postmaster missing, or a bad value
#   exit 2  usage
set -uo pipefail
CONFIG=${POSTMASTER_CONFIG:-$HOME/.postmaster/config.toml}
usage() { echo "usage: front-door.sh <harness> <model> <cwd> <at-terminal> <target> [--config <path>] | --self-test" >&2; exit 2; }

repo_of() {  # the git repository a path is in, as its common .git directory, or empty
  git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true
}

add_reason() {  # add_reason <var> <text>: append one reason, joined with "; "
  if [ -z "$1" ]; then printf '%s' "$2"; else printf '%s; %s' "$1" "$2"; fi
}

decide() {  # decide <harness> <model> <cwd> <at-terminal> <target> <config>
  local h=$1 m=$2 cwd=$3 term=$4 target=$5 cfg=$6
  local th tm tc tt reasons=""
  case $term in
    yes|no) ;;
    *) echo "front-door: at-terminal is yes or no, not '$term'" >&2; return 1 ;;
  esac
  [ -f "$cfg" ] || { echo "front-door: no config at $cfg (POSTMASTER_CONFIG overrides the path)" >&2; return 1; }
  python3 -c 'import tomllib' 2>/dev/null \
    || { echo "front-door: python3 3.11 or newer is needed to read $cfg" >&2; return 1; }
  local spec
  spec=$(python3 - "$cfg" <<'PY'
import sys, tomllib
try:
    cfg = tomllib.load(open(sys.argv[1], "rb"))
except (OSError, tomllib.TOMLDecodeError) as e:
    print("front-door: %s does not parse: %s" % (sys.argv[1], e), file=sys.stderr); sys.exit(1)
spec = (cfg.get("team") or {}).get("postmaster")
if not isinstance(spec, dict) or not spec.get("harness") or not spec.get("model"):
    print("front-door: %s has no team.postmaster with a harness and a model" % sys.argv[1], file=sys.stderr); sys.exit(1)
print(spec["harness"], spec["model"])
PY
) || return 1
  read -r th tm <<EOF
$spec
EOF
  if [ "$h" != "$th" ]; then
    reasons=$(add_reason "$reasons" "harness differs: this session runs on $h, team.postmaster names $th")
  fi
  if [ "$m" != "$tm" ]; then
    reasons=$(add_reason "$reasons" "model differs: this session runs on $m, team.postmaster names $tm")
  fi
  tc=$(repo_of "$cwd")
  tt=$(repo_of "$target")
  if [ -z "$tc" ] || [ -z "$tt" ] || [ "$tc" != "$tt" ]; then
    reasons=$(add_reason "$reasons" "target is another repo: the session runs in $cwd, the target is $target")
  fi
  if [ "$term" != yes ]; then
    reasons=$(add_reason "$reasons" "nobody at the terminal")
  fi
  if [ -n "$reasons" ]; then
    printf 'spawn %s\n' "$reasons"
  else
    printf 'self team.postmaster harness and model, the target is this repo, and the user is at the terminal\n'
  fi
  return 0
}

case ${1:-} in
  --self-test) [ $# -eq 1 ] || usage ;;
  "") usage ;;
esac

if [ "${1:-}" != --self-test ]; then
  if [ $# -eq 7 ] && [ "${6:-}" = --config ]; then CONFIG=$7; set -- "$1" "$2" "$3" "$4" "$5"
  elif [ $# -eq 5 ]; then :
  else usage
  fi
  decide "$1" "$2" "$3" "$4" "$5" "$CONFIG"; exit $?
fi

# --- self-test ----------------------------------------------------------------------------
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" 2>/dev/null' EXIT
fails=0
ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/         /'; fails=$((fails+1)); }

# Two repositories, so the target reason has a difference to find.
mkdir -p "$tmp/here" "$tmp/there" || exit 1
git -C "$tmp/here" init -q && git -C "$tmp/here" -c user.email=t@t -c user.name=t commit -q --allow-empty -m base
git -C "$tmp/there" init -q && git -C "$tmp/there" -c user.email=t@t -c user.name=t commit -q --allow-empty -m base
# A worktree of "here", so the same-repo case is not path equality.
git -C "$tmp/here" worktree add -q "$tmp/here-wt" -b wt
mkdir -p "$tmp/here/sub"

config() {  # config <name> <harness> <model>: a config whose team.postmaster is that lane
  { printf '[team]\n'
    printf 'postmaster = { harness = "%s", model = "%s" }\n' "$2" "$3"; } > "$tmp/$1.toml"
}
config match claude pm-model

run() {  # run <label> <want exit> <want first word> <want reason contains, or -> <args...>
  local label=$1 want_rc=$2 want_word=$3 want_why=$4 out rc word; shift 4
  out=$("$@" 2>"$tmp/err"); rc=$?
  word=${out%% *}
  if [ "$rc" -ne "$want_rc" ]; then
    fail "$label: wanted exit $want_rc, got exit $rc" "$out$(cat "$tmp/err")"; return
  fi
  if [ "$word" != "$want_word" ]; then
    fail "$label: wanted '$want_word', got '$word'" "$out$(cat "$tmp/err")"; return
  fi
  if [ "$want_why" != - ]; then
    case $out in
      *"$want_why"*) ;;
      *) fail "$label: wanted the reason to contain '$want_why'" "$out"; return ;;
    esac
  fi
  ok "$label"
}

absent() {  # absent <label> <reason that must not be printed> <args...>: the negative control
  local label=$1 no=$2 out; shift 2
  out=$("$@" 2>"$tmp/err")
  case $out in
    *"$no"*) fail "$label: '$no' was printed" "$out" ;;
    *) ok "$label" ;;
  esac
}

echo "positive controls"
# Each reason fires when its condition fails; the others are held to a match.
run "harness differs prints spawn naming harness" 0 spawn "harness differs" \
  "$0" grok pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/match.toml"
run "model differs prints spawn naming model" 0 spawn "model differs" \
  "$0" claude other-model "$tmp/here" yes "$tmp/here" --config "$tmp/match.toml"
run "target is another repo prints spawn naming target" 0 spawn "target is another repo" \
  "$0" claude pm-model "$tmp/here" yes "$tmp/there" --config "$tmp/match.toml"
run "nobody at the terminal prints spawn naming terminal" 0 spawn "nobody at the terminal" \
  "$0" claude pm-model "$tmp/here" no "$tmp/here" --config "$tmp/match.toml"
run "all four match prints self" 0 self - \
  "$0" claude pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/match.toml"
run "a worktree of the target is the target's repo, so it is self" 0 self - \
  "$0" claude pm-model "$tmp/here-wt" yes "$tmp/here" --config "$tmp/match.toml"
run "a subdirectory of the target is the target's repo, so it is self" 0 self - \
  "$0" claude pm-model "$tmp/here/sub" yes "$tmp/here" --config "$tmp/match.toml"
run "every failed condition is reported" 0 spawn "harness differs" \
  "$0" grok other-model "$tmp/there" no "$tmp/here" --config "$tmp/match.toml"

echo "negative controls"
# Each reason is absent when it does not apply, through the identical command.
absent "the harness matching does not print the harness reason" "harness differs" \
  "$0" claude other-model "$tmp/here" yes "$tmp/here" --config "$tmp/match.toml"
absent "the model matching does not print the model reason" "model differs" \
  "$0" grok pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/match.toml"
absent "the target matching does not print the target reason" "target is another repo" \
  "$0" claude pm-model "$tmp/here" no "$tmp/here" --config "$tmp/match.toml"
absent "a person at the terminal does not print the terminal reason" "nobody at the terminal" \
  "$0" claude pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/match.toml"
out=$("$0" grok other-model "$tmp/there" no "$tmp/here" --config "$tmp/match.toml" 2>"$tmp/err")
for reason in "harness differs" "model differs" "target is another repo" "nobody at the terminal"; do
  case $out in
    *"$reason"*) ok "all four failing names $reason" ;;
    *) fail "all four failing names $reason" "$out" ;;
  esac
done
case $out in
  "spawn harness differs"*) ok "reasons print in ticket order" ;;
  *) fail "reasons print in ticket order" "$out" ;;
esac

echo "refusals"
run "no config is refused" 1 '' - \
  "$0" claude pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/none.toml"
printf '[team]\nworkhorses = ["a"]\n' > "$tmp/no-pm.toml"
run "a config with no team.postmaster is refused" 1 '' - \
  "$0" claude pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/no-pm.toml"
run "at-terminal is yes or no, not anything else" 1 '' - \
  "$0" claude pm-model "$tmp/here" maybe "$tmp/here" --config "$tmp/match.toml"
grep -q "at-terminal is yes or no" "$tmp/err" && ok "and says so" || fail "and says so" "$(cat "$tmp/err")"
run "four arguments is a usage error" 2 '' - \
  "$0" claude pm-model "$tmp/here" yes
run "--self-test takes no arguments" 2 '' - \
  "$0" --self-test extra

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
