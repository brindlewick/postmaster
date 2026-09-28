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
# `--self-test` in argv position one is the flag, whatever follows; no harness is named that.
#
#   exit 0  printed `self` or `spawn` with its reasons
#   exit 1  no config or one that does not parse, team.postmaster missing, or a bad value
#   exit 2  usage
set -uo pipefail
# A GIT_DIR from the caller must not steer repo identity to another repository.
unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_NAMESPACE
CONFIG=${POSTMASTER_CONFIG:-$HOME/.postmaster/config.toml}
usage() { echo "usage: front-door.sh <harness> <model> <cwd> <at-terminal> <target> [--config <path>] | --self-test" >&2; exit 2; }

repo_of() {  # the git repository a path is in, as its common .git directory, or empty
  # An empty path is unresolvable: git -C "" would silently mean the process cwd.
  [ -n "${1:-}" ] || return 0
  git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true
}

add_reason() {  # add_reason <accumulated> <text>: append one reason, joined with "; "
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
team = cfg.get("team")
spec = team.get("postmaster") if isinstance(team, dict) else None
if not isinstance(spec, dict) or not spec.get("harness") or not spec.get("model"):
    print("front-door: %s has no team.postmaster with a harness and a model" % sys.argv[1], file=sys.stderr); sys.exit(1)
if not isinstance(spec["harness"], str) or not isinstance(spec["model"], str):
    print("front-door: %s team.postmaster harness and model must be strings" % sys.argv[1], file=sys.stderr); sys.exit(1)
if not spec["harness"].strip() or not spec["model"].strip():
    print("front-door: %s team.postmaster harness and model must not be blank" % sys.argv[1], file=sys.stderr); sys.exit(1)
if any(ord(c) < 0x20 or ord(c) == 0x7f for c in spec["harness"] + spec["model"]):
    print("front-door: %s team.postmaster harness and model must not contain control characters" % sys.argv[1], file=sys.stderr); sys.exit(1)
print(spec["harness"], spec["model"], sep="\t")
PY
) || return 1
  IFS=$'\t' read -r th tm <<EOF
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
  if [ -z "$tc" ] || [ -z "$tt" ]; then
    reasons=$(add_reason "$reasons" "not in a git repository: the session runs in $cwd, the target is $target")
  elif [ "$tc" != "$tt" ]; then
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
esac
[ $# -eq 0 ] && usage   # an empty value in five arguments still decides; only arity is usage

if [ "${1:-}" != --self-test ]; then
  if [ $# -eq 7 ] && [ "${6:-}" = --config ]; then CONFIG=$7; set -- "$1" "$2" "$3" "$4" "$5"
  elif [ $# -eq 5 ]; then :
  else usage
  fi
  decide "$1" "$2" "$3" "$4" "$5" "$CONFIG"; exit $?
fi

# --- self-test ----------------------------------------------------------------------------
tmp=$(mktemp -d) || exit 1
trap 'rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
case $0 in /*) self=$0 ;; *) self=$PWD/$0 ;; esac
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

absent() {  # absent <label> <must not print> <must print> <args...>: the negative control
  local label=$1 no=$2 yes=$3 out rc; shift 3
  out=$("$@" 2>"$tmp/err"); rc=$?
  [ "$rc" -eq 0 ] || { fail "$label: exit $rc, want 0" "$out$(cat "$tmp/err")"; return; }
  case $out in
    *"$no"*) fail "$label: '$no' was printed" "$out"; return ;;
  esac
  case $out in
    *"$yes"*) ok "$label" ;;
    *) fail "$label: '$yes' was not printed" "$out" ;;
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
mkdir -p "$tmp/notrepo"
run "a directory outside any repo fails closed naming both paths" 0 spawn "not in a git repository" \
  "$0" claude pm-model "$tmp/notrepo" yes "$tmp/here" --config "$tmp/match.toml"
run "a target outside any repo fails closed naming both paths" 0 spawn "not in a git repository" \
  "$0" claude pm-model "$tmp/here" yes "$tmp/notrepo" --config "$tmp/match.toml"
config spaces "claude code" pm-model
run "a harness name with a space still matches itself" 0 self - \
  "$0" "claude code" pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/spaces.toml"
run "an empty harness decides spawn, not usage" 0 spawn "harness differs" \
  "$0" "" pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/match.toml"
run "a reported model with a newline decides spawn" 0 spawn "model differs" \
  "$0" claude "$(printf 'pm-model\nother')" "$tmp/here" yes "$tmp/here" --config "$tmp/match.toml"

echo "empty paths fail closed from inside a repo"
# git -C "" means the process cwd, so these run from inside one repo: without the
# empty-path guard they would print self.
closed() {  # closed <label> <args...>: spawn naming unresolvable paths, exit 0
  local label=$1 out rc; shift
  out=$(cd "$tmp/here" && "$self" "$@" 2>"$tmp/err"); rc=$?
  [ "$rc" -eq 0 ] || { fail "$label: exit $rc, want 0" "$out$(cat "$tmp/err")"; return; }
  case $out in
    "spawn not in a git repository"*) ok "$label" ;;
    *) fail "$label: wanted spawn naming both paths" "$out" ;;
  esac
}
closed "an empty cwd fails closed from inside a repo" \
  claude pm-model "" yes "$tmp/here" --config "$tmp/match.toml"
closed "an empty target fails closed from inside a repo" \
  claude pm-model "$tmp/here" yes "" --config "$tmp/match.toml"
closed "an empty cwd and target fail closed from inside a repo" \
  claude pm-model "" yes "" --config "$tmp/match.toml"

echo "caller environment does not steer identity"
run "a GIT_DIR from the caller does not steer distinct repos to self" 0 spawn "target is another repo" \
  env GIT_DIR="$tmp/there/.git" GIT_COMMON_DIR="$tmp/there/.git" "$0" claude pm-model "$tmp/here" yes "$tmp/there" --config "$tmp/match.toml"

echo "negative controls"
# Each reason is absent when it does not apply, through the identical command.
absent "the harness matching does not print the harness reason" "harness differs" "model differs" \
  "$0" claude other-model "$tmp/here" yes "$tmp/here" --config "$tmp/match.toml"
absent "the model matching does not print the model reason" "model differs" "harness differs" \
  "$0" grok pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/match.toml"
absent "the target matching does not print the target reason" "target is another repo" "nobody at the terminal" \
  "$0" claude pm-model "$tmp/here" no "$tmp/here" --config "$tmp/match.toml"
absent "a person at the terminal does not print the terminal reason" "nobody at the terminal" "harness differs" \
  "$0" grok pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/match.toml"
absent "an unresolvable path does not print the another-repo label" "target is another repo" "not in a git repository" \
  "$0" claude pm-model "$tmp/notrepo" yes "$tmp/here" --config "$tmp/match.toml"
absent "resolved paths do not print the unresolvable label" "not in a git repository" "harness differs" \
  "$0" grok pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/match.toml"
out=$("$0" grok other-model "$tmp/there" no "$tmp/here" --config "$tmp/match.toml" 2>"$tmp/err")
for reason in "harness differs" "model differs" "target is another repo" "nobody at the terminal"; do
  case $out in
    *"$reason"*) ok "all four failing names $reason" ;;
    *) fail "all four failing names $reason" "$out" ;;
  esac
done
case $out in
  "spawn harness differs"*"; model differs"*"; target is another repo"*"; nobody at the terminal") ok "reasons print in ticket order" ;;
  *) fail "reasons print in ticket order" "$out" ;;
esac

echo "refusals"
run "no config is refused" 1 '' - \
  "$0" claude pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/none.toml"
printf '[team]\nworkhorses = ["a"]\n' > "$tmp/no-pm.toml"
run "a config with no team.postmaster is refused" 1 '' - \
  "$0" claude pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/no-pm.toml"
printf '[team\nbroken\n' > "$tmp/bad.toml"
run "a config that does not parse is refused" 1 '' - \
  "$0" claude pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/bad.toml"
printf 'team = "oops"\n' > "$tmp/strteam.toml"
run "a config whose team is not a table is refused" 1 '' - \
  "$0" claude pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/strteam.toml"
grep -q "team.postmaster" "$tmp/err" && ! grep -q "Traceback" "$tmp/err" \
  && ok "and refuses in its own words, with no traceback" \
  || fail "and refuses in its own words, with no traceback" "$(cat "$tmp/err")"
printf '[team]\npostmaster = { harness = 7, model = "pm-model" }\n' > "$tmp/nonstr.toml"
run "a config with a non-string harness is refused" 1 '' - \
  "$0" claude pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/nonstr.toml"
config empty "" pm-model
run "a config with an empty harness is refused" 1 '' - \
  "$0" claude pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/empty.toml"
config blank "   " pm-model
run "a config with a blank harness is refused" 1 '' - \
  "$0" claude pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/blank.toml"
printf '[team]\npostmaster = { harness = "claude", model = "pm-model\\nother" }\n' > "$tmp/newline.toml"
run "a config with a newline in the model is refused" 1 '' - \
  "$0" claude pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/newline.toml"
grep -q "control characters" "$tmp/err" && ok "and says control characters" \
  || fail "and says control characters" "$(cat "$tmp/err")"
printf '[team]\npostmaster = { harness = "a\\tb", model = "m" }\n' > "$tmp/tab.toml"
run "a config with a tab in the harness is refused" 1 '' - \
  "$0" "$(printf 'a\tb')" m "$tmp/here" yes "$tmp/here" --config "$tmp/tab.toml"
run "at-terminal is yes or no, not anything else" 1 '' - \
  "$0" claude pm-model "$tmp/here" maybe "$tmp/here" --config "$tmp/match.toml"
grep -q "at-terminal is yes or no" "$tmp/err" && ok "and says so" || fail "and says so" "$(cat "$tmp/err")"
run "POSTMASTER_CONFIG names the config" 0 self - \
  env POSTMASTER_CONFIG="$tmp/match.toml" "$0" claude pm-model "$tmp/here" yes "$tmp/here"
run "--config overrides POSTMASTER_CONFIG" 0 self - \
  env POSTMASTER_CONFIG="$tmp/no-pm.toml" "$0" claude pm-model "$tmp/here" yes "$tmp/here" --config "$tmp/match.toml"
run "four arguments is a usage error" 2 '' - \
  "$0" claude pm-model "$tmp/here" yes
run "--self-test takes no arguments" 2 '' - \
  "$0" --self-test extra

echo
[ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
echo "self-test: $fails control(s) misbehaved"; exit 1
