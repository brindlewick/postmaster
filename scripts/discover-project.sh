#!/usr/bin/env bash
# Work out what a target project needs, rather than demanding it be configured.
# Prints key=value lines. Empty value means "could not determine, ask the user". Each check a
# change is verified by is a `check.<name>=<where it came from>: <what it shows>` line: declared in
# the project's .postmaster/project.toml, or a default and which one (scripts/verify.sh).
set -uo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_NAMESPACE
HERE=$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd -P)

if [ "${1:-}" = --self-test ]; then
  # The install line a fresh checkout needs before the gate, per manifest.
  self=$HERE/$(basename "$0")
  tmp=$(mktemp -d) || exit 1
  trap 'rm -r -- "$tmp" </dev/null 2>/dev/null' EXIT
  fails=0
  ok()   { printf '  ok   %s\n' "$1"; }
  fail() { printf '  FAIL %s: %s\n' "$1" "$2"; fails=$((fails+1)); }
  install_of() { "$self" "$1" 2>/dev/null | grep '^install=' || true; }
  gate_of() { "$self" "$1" 2>/dev/null | grep '^gate=' || true; }
  # Each family agrees with itself: install= and the gate runner name the same manager.
  agree() {  # agree <dir> <family> <install line> <gate line>
    [ "$(install_of "$1")" = "install=$3" ] && [ "$(gate_of "$1")" = "gate=$4" ] \
      && ok "$2 names one manager for install and gate" \
      || fail "$2 names one manager for install and gate" "$(install_of "$1") / $(gate_of "$1")"
  }
  pkg() { printf '{"scripts":{"check":"true"}}' > "$1/package.json"; }

  npm_lock=$tmp/npm-lock; mkdir "$npm_lock"
  pkg "$npm_lock"; : > "$npm_lock/package-lock.json"
  agree "$npm_lock" "npm with a lockfile" \
    "npm ci --prefer-offline --no-audit --no-fund" "npm run check"

  npm_bare=$tmp/npm-bare; mkdir "$npm_bare"
  pkg "$npm_bare"
  agree "$npm_bare" "npm without a lockfile" \
    "npm install --prefer-offline --no-audit --no-fund" "npm run check"

  pnpm=$tmp/pnpm; mkdir "$pnpm"
  pkg "$pnpm"; : > "$pnpm/pnpm-lock.yaml"
  agree "$pnpm" "pnpm with a lockfile" \
    "pnpm install --frozen-lockfile" "pnpm run check"

  bun=$tmp/bun; mkdir "$bun"
  pkg "$bun"; : > "$bun/bun.lock"
  agree "$bun" "bun with a lockfile" \
    "bun install --frozen-lockfile" "bun run check"

  bunb=$tmp/bunb; mkdir "$bunb"
  pkg "$bunb"; : > "$bunb/bun.lockb"
  agree "$bunb" "bun with a binary lockfile" \
    "bun install --frozen-lockfile" "bun run check"

  yarn1=$tmp/yarn1; mkdir "$yarn1"
  pkg "$yarn1"; : > "$yarn1/yarn.lock"
  agree "$yarn1" "yarn classic" \
    "yarn install --frozen-lockfile" "yarn run check"

  yarnberry=$tmp/yarnberry; mkdir "$yarnberry"
  pkg "$yarnberry"; : > "$yarnberry/yarn.lock"; : > "$yarnberry/.yarnrc.yml"
  agree "$yarnberry" "yarn berry" \
    "yarn install --immutable" "yarn run check"

  cargo=$tmp/cargo; mkdir "$cargo"; : > "$cargo/Cargo.toml"
  [ "$(install_of "$cargo")" = "install=" ] \
    && ok "cargo needs no install step" \
    || fail "cargo needs no install step" "$(install_of "$cargo")"

  bare=$tmp/bare; mkdir "$bare"
  [ "$(install_of "$bare")" = "install=" ] \
    && ok "a bare directory installs nothing" \
    || fail "a bare directory installs nothing" "$(install_of "$bare")"
  "$self" "$bare" 2>/dev/null | grep '^gate=' >/dev/null \
    && ok "the gate line is still emitted" \
    || fail "the gate line is still emitted" "(no gate= line)"

  echo
  [ "$fails" -eq 0 ] && { echo "self-test: all controls behaved"; exit 0; }
  echo "self-test: $fails control(s) misbehaved"; exit 1
fi
T=${1:?usage: discover-project.sh <path>}
# The tracker kind, before the cd, so a relative path or config is read from the caller's directory.
kind=$("$HERE/tracker-kind.sh" "$T" 2>/dev/null) || kind=""
CDPATH= cd -P -- "$T" 2>/dev/null || { echo "cannot enter $T" >&2; exit 1; }

# One package-manager choice feeds both the gate runner and install= below, in
# verify.sh's pm() order (pnpm, bun, yarn, npm), so the two can never disagree.
pm=npm
if [ -f pnpm-lock.yaml ]; then pm=pnpm
elif [ -f bun.lock ] || [ -f bun.lockb ]; then pm=bun
elif [ -f yarn.lock ]; then pm=yarn; fi

gate=""
[ -f package.json ] && ! command -v jq >/dev/null 2>&1 && echo "warn=jq not installed: package.json scripts were not read" >&2
if [ -f package.json ] && command -v jq >/dev/null 2>&1; then
  for s in check ci verify test lint; do
    jq -e --arg s "$s" '.scripts[$s]' package.json >/dev/null 2>&1 && { gate="$s"; break; }
  done
  [ -n "$gate" ] && gate="$pm run $gate"
fi
[ -z "$gate" ] && [ -f Makefile ] && grep -qE '^(check|test):' Makefile && gate="make check"
[ -z "$gate" ] && [ -f Cargo.toml ] && gate="cargo test"

# The dependency install a fresh checkout needs before the gate: the clean-checkout callers
# (the ship leg's post-merge verification, fixture scoring's gate) run it first. Empty where
# the project's runner fetches on its own (cargo, go) or nothing is known (make). Always
# lockfile-strict where a lockfile exists, so the gate runs the tree the project pins.
install=""
if [ -f package.json ]; then
  if [ "$pm" = pnpm ]; then install="pnpm install --frozen-lockfile"
  elif [ "$pm" = bun ]; then install="bun install --frozen-lockfile"
  elif [ "$pm" = yarn ]; then
    if [ -f .yarnrc.yml ]; then install="yarn install --immutable"
    else install="yarn install --frozen-lockfile"; fi
  elif [ -f package-lock.json ]; then install="npm ci --prefer-offline --no-audit --no-fund"
  else install="npm install --prefer-offline --no-audit --no-fund"; fi
fi

docs=$(ls AGENTS.md CLAUDE.md README.md CONTRIBUTING.md 2>/dev/null | tr '\n' ' ')
dirs=$(ls -d wiki docs .github 2>/dev/null | tr '\n' ' ')

# The tracker is visible in how the project already writes commits; nothing to configure.
tracker=$(git log --oneline -200 2>/dev/null \
          | grep -oE '\b[A-Z][A-Z0-9]{1,9}-[0-9]+\b' | sed 's/-[0-9]*$//' \
          | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')

# Optional project settings are validated and reported with their source. Missing files are not
# an error; their values remain discovery defaults for the session to settle in conversation.
project_report=$("$HERE/project-settings.sh" report .) \
  || { echo "discover-project: project settings could not be read for $T" >&2; exit 1; }

# The checks, declared or found as defaults; a declared gate is the gate.
out=$("$HERE/verify.sh" checks . --gate "$gate" --lines 2>&1); rc=$?
if [ $rc -eq 0 ]; then
  checks=$(printf '%s\n' "$out" | awk -F'\t' 'NF >= 4')
  gate=$(printf '%s\n' "$checks" | awk -F'\t' '$1 == "gate" {print $3}')
  printf '%s\n' "$out" | awk -F'\t' 'NF < 4' | sed -n 's/^verify: warn: /warn=checks: /p' >&2
else
  checks=""
  echo "warn=checks: $(printf '%s\n' "$out" | sed 's/^verify: //' | paste -sd' ' -)" >&2
fi

echo "gate=$gate"
echo "install=$install"
echo "docs=$(echo "$docs$dirs" | sed 's/ *$//')"
echo "tracker=$kind"
echo "tracker_prefix=$tracker"
printf '%s\n' "$project_report"
echo "ambient_context=$( [ -f AGENTS.md ] && echo AGENTS.md || echo NONE )"
printf '%s\n' "$checks" | awk -F'\t' 'NF >= 4 {print "check." $1 "=" $2 ": " $4}'
[ -f AGENTS.md ] || echo "warn=no AGENTS.md: lanes that read no ambient file will start blind" >&2
[ "$kind" = github ] && ! git remote get-url origin >/dev/null 2>&1 \
  && echo "warn=no origin remote, so no github board: with the user's word, scripts/local.sh <repo> store init gives it a local store" >&2
exit 0
